#!/usr/bin/env node

import fs from "node:fs";
import path from "node:path";

const ROOT_DIR = process.cwd();
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
    save: null,
    help: false,
  };

  for (const arg of argv) {
    if (arg === "--help" || arg === "-h") {
      opts.help = true;
    } else if (arg === "--console-only") {
      opts.consoleOnly = true;
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
  --console-only     Only show streams matching console keywords in title/tags
  --save=csv|json|both  Save gitignored report to scripts/out/
  -h, --help         Show this help message
`);
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
    if (v !== undefined && v !== null && v !== "") {
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

async function fetchTargetStreams(clientId, token, gameId, opts) {
  const collected = [];
  const seenIds = new Set();
  let cursor = null;
  let pagesScanned = 0;

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

      const tags = Array.isArray(stream.tags) ? stream.tags : [];
      const consoleMatches = detectConsoleSignals(stream.title, tags);
      const isConsole = consoleMatches.length > 0;
      if (opts.consoleOnly && !isConsole) continue;

      collected.push({
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

  collected.sort((a, b) => {
    if (a.isConsole !== b.isConsole) return a.isConsole ? -1 : 1;
    return b.viewers - a.viewers;
  });

  return { streams: collected, pagesScanned };
}

function escapeCsvCell(value) {
  const str = String(value ?? "");
  if (/[",\r\n]/.test(str)) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}

function saveReport(streams, saveMode, meta) {
  const outDir = path.join(ROOT_DIR, "scripts", "out");
  fs.mkdirSync(outDir, { recursive: true });
  const stamp = new Date()
    .toISOString()
    .replace(/[:.]/g, "-")
    .replace("T", "_")
    .slice(0, 19);
  const written = [];

  if (saveMode === "json" || saveMode === "both") {
    const jsonPath = path.join(outDir, `twitch-outreach-${stamp}.json`);
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
    const csvPath = path.join(outDir, `twitch-outreach-${stamp}.csv`);
    const header = [
      "channel_name",
      "login",
      "viewers",
      "console_match",
      "console_keywords",
      "title",
      "about_url",
      "stream_url",
      "tags",
      "started_at",
    ].join(",");
    const lines = streams.map((s) =>
      [
        s.channelName,
        s.login,
        s.viewers,
        s.isConsole ? "yes" : "no",
        s.consoleKeywords.join("; "),
        s.title,
        s.aboutUrl,
        s.streamUrl,
        s.tags.join("; "),
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

  const { clientId, clientSecret } = resolveTwitchCredentials();
  const token = await getAppAccessToken(clientId, clientSecret);
  const category = await resolveCategory(clientId, token, opts.category);

  if (!category) {
    console.log(`Category "${opts.category}" was not found on Twitch.`);
    return;
  }

  const { streams, pagesScanned } = await fetchTargetStreams(
    clientId,
    token,
    category.id,
    opts
  );

  const consoleCount = streams.filter((s) => s.isConsole).length;
  console.log("");
  console.log(
    `Twitch Outreach Scan | Category: ${category.name} (ID ${category.id}) | Lang: ${opts.lang} | Viewers: ${opts.min}-${opts.max}`
  );
  console.log(
    `Scanned ${pagesScanned} page(s) | Matched ${streams.length} channel(s) (${consoleCount} console-flagged)`
  );
  console.log("-".repeat(88));

  if (streams.length === 0) {
    console.log(
      "No live streams currently match those filters. Try widening --min/--max or running during peak hours."
    );
  } else {
    streams.forEach((s, idx) => {
      const rank = String(idx + 1).padStart(2, "0");
      const badge = s.isConsole
        ? ` [CONSOLE: ${s.consoleKeywords.join(", ")}]`
        : "";
      console.log(`${rank}. ${s.channelName} (${s.viewers} viewers)${badge}`);
      console.log(`    Title: ${s.title || "(no title)"}`);
      console.log(`    About: ${s.aboutUrl}`);
      if (s.tags.length > 0) {
        console.log(`    Tags:  ${s.tags.slice(0, 8).join(", ")}`);
      }
    });
  }

  if (opts.save) {
    const files = saveReport(streams, opts.save, {
      category: category.name,
      categoryId: category.id,
      language: opts.lang,
      minViewers: opts.min,
      maxViewers: opts.max,
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
