#!/usr/bin/env node

import fs from "node:fs";
import path from "node:path";

const ROOT_DIR = process.cwd();
const OUT_DIR = path.join(ROOT_DIR, "scripts", "out");
const HISTORY_FILE = path.join(OUT_DIR, "seen-streamers.json");

const DEFAULT_CATEGORY = "Grand Theft Auto VI";
const DEFAULT_MIN_VIEWERS = 15;
const DEFAULT_MAX_VIEWERS = 150;
const DEFAULT_LANGUAGE = "en";
const DEFAULT_MAX_PAGES = 25;

const CONSOLE_PATTERNS = [
  { label: "PS5", regex: /\bps5/i },
  { label: "PlayStation", regex: /\bplaystation/i },
  { label: "Xbox", regex: /\bxbox/i },
  { label: "Xbox Series", regex: /\bseries\s*[xs]\b/i },
  { label: "Console", regex: /\bconsole/i },
];

const EMAIL_REGEX = /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g;
const DISCORD_REGEX =
  /(?:https?:\/\/)?(?:www\.)?(?:discord\.gg|discord\.com\/invite|discordapp\.com\/invite)\/[a-zA-Z0-9-]+/gi;

function loadEnvFile(filePath) {
  if (!fs.existsSync(filePath)) return {};
  const raw = fs.readFileSync(filePath, "utf8");
  const out = {};
  for (const line of raw.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const eqIndex = trimmed.indexOf("=");
    if (eqIndex <= 0) continue;
    const key = trimmed.slice(0, eqIndex).trim();
    let val = trimmed.slice(eqIndex + 1).trim();
    if (
      (val.startsWith('"') && val.endsWith('"')) ||
      (val.startsWith("'") && val.endsWith("'"))
    ) {
      val = val.slice(1, -1);
    }
    out[key] = val;
  }
  return out;
}

function resolveTwitchCredentials() {
  const localEnv = {
    ...loadEnvFile(path.join(ROOT_DIR, ".env")),
    ...loadEnvFile(path.join(ROOT_DIR, ".env.local")),
    ...process.env,
  };

  const clientId = localEnv.AUTH_TWITCH_ID || localEnv.TWITCH_CLIENT_ID || "";
  const clientSecret =
    localEnv.AUTH_TWITCH_SECRET || localEnv.TWITCH_CLIENT_SECRET || "";

  if (!clientId || !clientSecret) {
    console.error(
      "Missing Twitch credentials. Set AUTH_TWITCH_ID and AUTH_TWITCH_SECRET in .env.local."
    );
    process.exit(1);
  }

  return { clientId, clientSecret };
}

function parseCliArgs(argv) {
  const opts = {
    min: DEFAULT_MIN_VIEWERS,
    max: DEFAULT_MAX_VIEWERS,
    lang: DEFAULT_LANGUAGE,
    category: DEFAULT_CATEGORY,
    maxPages: DEFAULT_MAX_PAGES,
    consoleOnly: false,
    hasEmail: false,
    reset: false,
    save: null,
    help: false,
  };

  for (const arg of argv) {
    if (arg === "--help" || arg === "-h") {
      opts.help = true;
    } else if (arg === "--console-only") {
      opts.consoleOnly = true;
    } else if (arg === "--has-email") {
      opts.hasEmail = true;
    } else if (arg === "--reset") {
      opts.reset = true;
    } else if (arg.startsWith("--min=")) {
      const n = Number(arg.slice(6));
      if (Number.isFinite(n) && n >= 0) opts.min = Math.floor(n);
    } else if (arg.startsWith("--max=")) {
      const n = Number(arg.slice(6));
      if (Number.isFinite(n) && n >= 0) opts.max = Math.floor(n);
    } else if (arg.startsWith("--lang=")) {
      opts.lang = arg.slice(7).trim() || DEFAULT_LANGUAGE;
    } else if (arg.startsWith("--category=")) {
      opts.category = arg.slice(11).trim() || DEFAULT_CATEGORY;
    } else if (arg.startsWith("--max-pages=")) {
      const n = Number(arg.slice(12));
      if (Number.isFinite(n) && n >= 1) opts.maxPages = Math.floor(n);
    } else if (arg.startsWith("--save=")) {
      const mode = arg.slice(7).trim().toLowerCase();
      if (mode === "csv" || mode === "json" || mode === "both") {
        opts.save = mode;
      }
    }
  }

  if (opts.min > opts.max) {
    [opts.min, opts.max] = [opts.max, opts.min];
  }

  return opts;
}

function printHelp() {
  console.log(`
Leonida HUD - Twitch Beta Outreach Finder

Usage:
  npm run outreach:twitch [-- options]

Options:
  --min=<n>          Minimum concurrent viewers (default: ${DEFAULT_MIN_VIEWERS})
  --max=<n>          Maximum concurrent viewers (default: ${DEFAULT_MAX_VIEWERS})
  --lang=<code>      Stream language filter (default: ${DEFAULT_LANGUAGE})
  --category=<name>  Twitch category name (default: "${DEFAULT_CATEGORY}")
  --max-pages=<n>    Max Helix pages of 100 streams to scan (default: ${DEFAULT_MAX_PAGES})
  --console-only     Only show streams matching PS5, Xbox, or console in title/tags
  --has-email        Only show leads with a public email found in their channel bio
  --reset            Clear previously surfaced streamer history before scanning
  --save=csv|json|both  Save gitignored report to scripts/out/
  -h, --help         Show this help message
`);
}

function loadSeenHistory() {
  if (!fs.existsSync(HISTORY_FILE)) return new Set();
  try {
    const parsed = JSON.parse(fs.readFileSync(HISTORY_FILE, "utf8"));
    const list = Array.isArray(parsed?.seenLogins) ? parsed.seenLogins : [];
    return new Set(list.map((s) => String(s).toLowerCase()));
  } catch {
    return new Set();
  }
}

function saveSeenHistory(seenSet) {
  fs.mkdirSync(OUT_DIR, { recursive: true });
  fs.writeFileSync(
    HISTORY_FILE,
    JSON.stringify(
      {
        updatedAt: new Date().toISOString(),
        count: seenSet.size,
        seenLogins: Array.from(seenSet).sort(),
      },
      null,
      2
    ),
    "utf8"
  );
}

function clearSeenHistory() {
  if (fs.existsSync(HISTORY_FILE)) {
    fs.unlinkSync(HISTORY_FILE);
  }
}

async function getAppAccessToken(clientId, clientSecret) {
  const body = new URLSearchParams({
    client_id: clientId,
    client_secret: clientSecret,
    grant_type: "client_credentials",
  });

  const res = await fetch("https://id.twitch.tv/oauth2/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body,
  });

  if (!res.ok) {
    const errText = await res.text();
    throw new Error(`Twitch token request failed (${res.status}): ${errText}`);
  }

  const data = await res.json();
  if (!data.access_token) {
    throw new Error("Twitch token response missing access_token");
  }
  return data.access_token;
}

async function helixGet(endpoint, params, clientId, token) {
  const url = new URL(`https://api.twitch.tv/helix/${endpoint}`);
  for (const [k, v] of Object.entries(params)) {
    if (v === undefined || v === null || v === "") continue;
    if (Array.isArray(v)) {
      for (const item of v) {
        url.searchParams.append(k, String(item));
      }
    } else {
      url.searchParams.set(k, String(v));
    }
  }

  const res = await fetch(url, {
    headers: {
      "Client-Id": clientId,
      Authorization: `Bearer ${token}`,
    },
  });

  if (!res.ok) {
    const errText = await res.text();
    throw new Error(`Twitch Helix ${endpoint} failed (${res.status}): ${errText}`);
  }

  return res.json();
}

async function resolveCategory(clientId, token, categoryName) {
  const exact = await helixGet(
    "games",
    { name: categoryName },
    clientId,
    token
  );
  if (Array.isArray(exact.data) && exact.data.length > 0) {
    return exact.data[0];
  }

  const searched = await helixGet(
    "search/categories",
    { query: categoryName, first: 10 },
    clientId,
    token
  );
  if (!Array.isArray(searched.data) || searched.data.length === 0) {
    return null;
  }

  const lowerTarget = categoryName.toLowerCase();
  const exactMatch = searched.data.find(
    (item) => String(item.name || "").toLowerCase() === lowerTarget
  );
  return exactMatch || searched.data[0];
}

function detectConsoleSignals(title, tags) {
  const haystack = `${title || ""} ${(tags || []).join(" ")}`;
  const matches = [];
  for (const entry of CONSOLE_PATTERNS) {
    if (entry.regex.test(haystack)) {
      matches.push(entry.label);
    }
  }
  return matches;
}

function extractBioContacts(description) {
  const text = String(description || "");
  const rawEmails = text.match(EMAIL_REGEX) || [];
  const emails = Array.from(
    new Set(
      rawEmails
        .map((e) => e.replace(/[.,;:!?)]+$/, "").toLowerCase())
        .filter((e) => e.includes(".") && !e.endsWith(".png") && !e.endsWith(".jpg"))
    )
  );

  const rawDiscords = text.match(DISCORD_REGEX) || [];
  const discordLinks = Array.from(
    new Set(
      rawDiscords.map((link) => {
        const cleaned = link.replace(/[.,;:!?)]+$/, "");
        return /^https?:\/\//i.test(cleaned) ? cleaned : `https://${cleaned}`;
      })
    )
  );

  return { emails, discordLinks };
}

async function fetchUsersInBatches(clientId, token, userIds) {
  const byId = new Map();
  const uniqueIds = Array.from(new Set(userIds.filter(Boolean)));
  for (let i = 0; i < uniqueIds.length; i += 100) {
    const chunk = uniqueIds.slice(i, i + 100);
    const payload = await helixGet("users", { id: chunk }, clientId, token);
    const users = Array.isArray(payload.data) ? payload.data : [];
    for (const user of users) {
      byId.set(user.id, user);
    }
  }
  return byId;
}

async function fetchCandidateStreams(clientId, token, gameId, opts, seenHistory) {
  const rawCandidates = [];
  const seenIds = new Set();
  let cursor = null;
  let pagesScanned = 0;
  let skippedDuplicates = 0;

  while (pagesScanned < opts.maxPages) {
    pagesScanned += 1;
    const payload = await helixGet(
      "streams",
      {
        game_id: gameId,
        language: opts.lang,
        first: 100,
        after: cursor,
      },
      clientId,
      token
    );

    const rows = Array.isArray(payload.data) ? payload.data : [];
    if (rows.length === 0) break;

    let minViewersInPage = Infinity;
    for (const stream of rows) {
      const viewers = Number(stream.viewer_count || 0);
      if (viewers < minViewersInPage) minViewersInPage = viewers;

      if (viewers < opts.min || viewers > opts.max) continue;
      if (seenIds.has(stream.user_id)) continue;
      seenIds.add(stream.user_id);

      const login = String(stream.user_login || "").toLowerCase();
      if (seenHistory.has(login)) {
        skippedDuplicates += 1;
        continue;
      }

      const tags = Array.isArray(stream.tags) ? stream.tags : [];
      const consoleMatches = detectConsoleSignals(stream.title, tags);
      const isConsole = consoleMatches.length > 0;
      if (opts.consoleOnly && !isConsole) continue;

      rawCandidates.push({
        userId: stream.user_id,
        channelName: stream.user_name || stream.user_login,
        login: stream.user_login,
        viewers,
        isConsole,
        consoleKeywords: consoleMatches,
        title: String(stream.title || "").replace(/\s+/g, " ").trim(),
        aboutUrl: `https://www.twitch.tv/${stream.user_login}/about`,
        streamUrl: `https://www.twitch.tv/${stream.user_login}`,
        tags,
        startedAt: stream.started_at || null,
      });
    }

    cursor = payload.pagination?.cursor || null;
    if (!cursor || minViewersInPage < opts.min) {
      break;
    }
  }

  const usersById = await fetchUsersInBatches(
    clientId,
    token,
    rawCandidates.map((s) => s.userId)
  );

  let excludedPartners = 0;
  const enriched = [];

  for (const item of rawCandidates) {
    const profile = usersById.get(item.userId);
    const broadcasterType = String(
      profile?.broadcaster_type || ""
    ).toLowerCase();

    if (broadcasterType === "partner") {
      excludedPartners += 1;
      continue;
    }

    const description = String(profile?.description || "")
      .replace(/\s+/g, " ")
      .trim();
    const { emails, discordLinks } = extractBioContacts(profile?.description);

    if (opts.hasEmail && emails.length === 0) {
      continue;
    }

    enriched.push({
      ...item,
      broadcasterType: broadcasterType || "standard",
      emails,
      discordLinks,
      description,
    });
  }

  enriched.sort((a, b) => {
    if (a.isConsole !== b.isConsole) return a.isConsole ? -1 : 1;
    const aAff = a.broadcasterType === "affiliate";
    const bAff = b.broadcasterType === "affiliate";
    if (aAff !== bAff) return aAff ? -1 : 1;
    const aEmail = a.emails.length > 0;
    const bEmail = b.emails.length > 0;
    if (aEmail !== bEmail) return aEmail ? -1 : 1;
    return b.viewers - a.viewers;
  });

  return {
    streams: enriched,
    pagesScanned,
    skippedDuplicates,
    excludedPartners,
  };
}

function escapeCsvCell(value) {
  const str = String(value ?? "");
  if (/[",\r\n]/.test(str)) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}

function saveReport(streams, saveMode, meta) {
  fs.mkdirSync(OUT_DIR, { recursive: true });
  const stamp = new Date()
    .toISOString()
    .replace(/[:.]/g, "-")
    .replace("T", "_")
    .slice(0, 19);
  const written = [];

  if (saveMode === "json" || saveMode === "both") {
    const jsonPath = path.join(OUT_DIR, `twitch-outreach-${stamp}.json`);
    fs.writeFileSync(
      jsonPath,
      JSON.stringify(
        {
          generatedAt: new Date().toISOString(),
          ...meta,
          count: streams.length,
          streams,
        },
        null,
        2
      ),
      "utf8"
    );
    written.push(jsonPath);
  }

  if (saveMode === "csv" || saveMode === "both") {
    const csvPath = path.join(OUT_DIR, `twitch-outreach-${stamp}.csv`);
    const header = [
      "channel_name",
      "login",
      "broadcaster_type",
      "viewers",
      "console_match",
      "console_keywords",
      "emails",
      "discord_links",
      "title",
      "about_url",
      "stream_url",
      "tags",
      "description",
      "started_at",
    ].join(",");
    const lines = streams.map((s) =>
      [
        s.channelName,
        s.login,
        s.broadcasterType,
        s.viewers,
        s.isConsole ? "yes" : "no",
        s.consoleKeywords.join("; "),
        s.emails.join("; "),
        s.discordLinks.join("; "),
        s.title,
        s.aboutUrl,
        s.streamUrl,
        s.tags.join("; "),
        s.description,
        s.startedAt || "",
      ]
        .map(escapeCsvCell)
        .join(",")
    );
    fs.writeFileSync(csvPath, [header, ...lines].join("\n"), "utf8");
    written.push(csvPath);
  }

  return written;
}

async function main() {
  const opts = parseCliArgs(process.argv.slice(2));
  if (opts.help) {
    printHelp();
    return;
  }

  if (opts.reset) {
    clearSeenHistory();
    console.log("Cleared previously surfaced streamer history.");
  }

  const seenHistory = loadSeenHistory();
  const { clientId, clientSecret } = resolveTwitchCredentials();
  const token = await getAppAccessToken(clientId, clientSecret);
  const category = await resolveCategory(clientId, token, opts.category);

  if (!category) {
    console.log(`Category "${opts.category}" was not found on Twitch.`);
    return;
  }

  const { streams, pagesScanned, skippedDuplicates, excludedPartners } =
    await fetchCandidateStreams(
      clientId,
      token,
      category.id,
      opts,
      seenHistory
    );

  const consoleCount = streams.filter((s) => s.isConsole).length;
  const emailCount = streams.filter((s) => s.emails.length > 0).length;
  const discordCount = streams.filter((s) => s.discordLinks.length > 0).length;

  console.log("");
  console.log(
    `Twitch Outreach Scan | Category: ${category.name} (ID ${category.id}) | Lang: ${opts.lang} | Viewers: ${opts.min}-${opts.max}`
  );
  console.log(
    `Scanned ${pagesScanned} page(s) | Fresh leads: ${streams.length} (${consoleCount} console, ${emailCount} with email, ${discordCount} with Discord)`
  );
  console.log(
    `Filtered out: ${excludedPartners} partner(s), ${skippedDuplicates} previously seen`
  );
  console.log("-".repeat(88));

  if (streams.length === 0) {
    console.log(
      "No fresh streams match your filters right now. Use --reset to clear history or adjust flags."
    );
  } else {
    streams.forEach((s, idx) => {
      const rank = String(idx + 1).padStart(2, "0");
      const typeTag =
        s.broadcasterType === "affiliate" ? " [AFFILIATE]" : "";
      const consoleTag = s.isConsole
        ? ` [CONSOLE: ${s.consoleKeywords.join(", ")}]`
        : "";
      console.log(
        `${rank}. ${s.channelName} (${s.viewers} viewers)${typeTag}${consoleTag}`
      );
      console.log(`    Title:   ${s.title || "(no title)"}`);
      console.log(`    About:   ${s.aboutUrl}`);
      if (s.emails.length > 0) {
        console.log(`    Email:   ${s.emails.join(", ")}`);
      }
      if (s.discordLinks.length > 0) {
        console.log(`    Discord: ${s.discordLinks.join(", ")}`);
      }
      if (s.tags.length > 0) {
        console.log(`    Tags:    ${s.tags.slice(0, 8).join(", ")}`);
      }
    });

    for (const s of streams) {
      seenHistory.add(String(s.login).toLowerCase());
    }
    saveSeenHistory(seenHistory);
  }

  if (opts.save) {
    const files = saveReport(streams, opts.save, {
      category: category.name,
      categoryId: category.id,
      language: opts.lang,
      minViewers: opts.min,
      maxViewers: opts.max,
      consoleOnly: opts.consoleOnly,
      hasEmail: opts.hasEmail,
    });
    console.log("-".repeat(88));
    for (const file of files) {
      console.log(`Saved report: ${path.relative(ROOT_DIR, file)}`);
    }
  }
}

main().catch((err) => {
  console.error("Outreach script error:", err instanceof Error ? err.message : err);
  process.exit(1);
});
