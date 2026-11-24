#!/usr/bin/env node

import fs from "node:fs";
import path from "node:path";

const ROOT_DIR = process.cwd();
const OUT_DIR = path.join(ROOT_DIR, "scripts", "out");
const MASTER_CSV_FILE = path.join(ROOT_DIR, "scripts", "master-leads.csv");
const DISCORD_CSV_FILE = path.join(ROOT_DIR, "scripts", "discord-leads.csv");
const HISTORY_FILE = path.join(OUT_DIR, "seen-streamers.json");

const TWITCH_GQL_CLIENT_ID = "kimne78kx3ncx6brgo4mv6wki5h1ko";
const DEFAULT_CATEGORY = "Grand Theft Auto VI";
const DEFAULT_MIN_VIEWERS = 5;
const DEFAULT_MAX_VIEWERS = 200;
const DEFAULT_LANGUAGE = "en";
const DEFAULT_MAX_PAGES = 100;
const DEFAULT_WATCH_INTERVAL_MIN = 60;

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
    maxLeads: Infinity,
    consoleOnly: false,
    hasContact: true,
    hasEmail: false,
    noHistory: false,
    watch: false,
    intervalMinutes: DEFAULT_WATCH_INTERVAL_MIN,
    backfillDiscord: false,
    reset: false,
    save: null,
    help: false,
  };

  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === "--help" || arg === "-h") {
      opts.help = true;
    } else if (arg === "--console-only") {
      opts.consoleOnly = true;
    } else if (arg === "--has-email") {
      opts.hasEmail = true;
    } else if (arg === "--has-contact") {
      opts.hasContact = true;
      opts.hasEmail = false;
    } else if (arg === "--all") {
      opts.hasContact = false;
      opts.hasEmail = false;
    } else if (arg === "--no-history") {
      opts.noHistory = true;
    } else if (arg === "--backfill-discord") {
      opts.backfillDiscord = true;
    } else if (arg === "--watch") {
      opts.watch = true;
    } else if (arg === "--interval" && argv[i + 1]) {
      const n = Number(argv[i + 1]);
      if (Number.isFinite(n) && n >= 1) opts.intervalMinutes = n;
      i += 1;
    } else if (arg.startsWith("--interval=")) {
      const n = Number(arg.slice(11));
      if (Number.isFinite(n) && n >= 1) opts.intervalMinutes = n;
    } else if (arg === "--reset") {
      opts.reset = true;
    } else if (arg.startsWith("--min-viewers=") || arg.startsWith("--min=")) {
      const val = arg.startsWith("--min-viewers=") ? arg.slice(14) : arg.slice(6);
      const n = Number(val);
      if (Number.isFinite(n) && n >= 0) opts.min = Math.floor(n);
    } else if (arg.startsWith("--max-viewers=") || arg.startsWith("--max=")) {
      const val = arg.startsWith("--max-viewers=") ? arg.slice(14) : arg.slice(6);
      const n = Number(val);
      if (Number.isFinite(n) && n >= 0) opts.max = Math.floor(n);
    } else if (arg.startsWith("--max-leads=")) {
      const n = Number(arg.slice(12));
      if (Number.isFinite(n) && n >= 1) opts.maxLeads = Math.floor(n);
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
  npm run find-streamers [-- options]

Options:
  --min-viewers=<n>  Minimum concurrent viewers (default: ${DEFAULT_MIN_VIEWERS}, alias: --min)
  --max-viewers=<n>  Maximum concurrent viewers (default: ${DEFAULT_MAX_VIEWERS}, alias: --max)
  --max-leads=<n>    Maximum leads to output/export (default: all matches)
  --lang=<code>      Stream language filter (default: ${DEFAULT_LANGUAGE})
  --category=<name>  Twitch category name (default: "${DEFAULT_CATEGORY}")
  --max-pages=<n>    Max Helix pages of 100 streams to scan (default: ${DEFAULT_MAX_PAGES})
  --has-contact      Require bio email OR Discord link (default)
  --has-email        Only show leads with a public email found in their channel bio
  --all              Include all non-partner matches even without bio contact info
  --console-only     Only show streams matching PS5, Xbox, or console in title/tags
  --watch            Keep running and append new leads every --interval minutes
  --interval <min>   Watch interval in minutes (default: ${DEFAULT_WATCH_INTERVAL_MIN})
  --backfill-discord Scan Twitch GQL social links/panels for all rows in master-leads.csv
  --no-history       Ignore and do not update seen history (inspect full live pool)
  --reset            Clear seen history, master-leads.csv, and discord-leads.csv before scanning
  --save=csv|json|both  Also save timestamped report(s) to scripts/out/
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
  if (fs.existsSync(MASTER_CSV_FILE)) {
    fs.unlinkSync(MASTER_CSV_FILE);
  }
  if (fs.existsSync(DISCORD_CSV_FILE)) {
    fs.unlinkSync(DISCORD_CSV_FILE);
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

function normalizeDiscordInvite(raw) {
  const match = String(raw || "").match(
    /(?:https?:\/\/)?(?:www\.)?(?:discord\.gg|discord\.com\/invite|discordapp\.com\/invite)\/([a-zA-Z0-9-]+)/i
  );
  if (!match || !match[1]) return null;
  const code = match[1].replace(/[.,;:!?)]+$/, "");
  if (!code) return null;
  return `https://discord.gg/${code}`;
}

function extractDiscordInvitesFromTexts(texts) {
  const found = [];
  const seen = new Set();
  for (const rawText of texts) {
    const matches = String(rawText || "").match(DISCORD_REGEX) || [];
    for (const rawMatch of matches) {
      const normalized = normalizeDiscordInvite(rawMatch);
      if (normalized && !seen.has(normalized)) {
        seen.add(normalized);
        found.push(normalized);
      }
    }
  }
  return found;
}

function extractBioContacts(description) {
  const text = String(description || "");
  const rawEmails = text.match(EMAIL_REGEX) || [];
  const emails = Array.from(
    new Set(
      rawEmails
        .map((e) =>
          e
            .replace(/^[^a-zA-Z0-9]+/, "")
            .replace(/[.,;:!?)]+$/, "")
            .toLowerCase()
        )
        .filter((e) => e.includes(".") && !e.endsWith(".png") && !e.endsWith(".jpg"))
    )
  );

  const discordLinks = extractDiscordInvitesFromTexts([text]);

  return { emails, discordLinks };
}

async function fetchGqlAboutInBatches(logins) {
  const byLogin = new Map();
  const uniqueLogins = Array.from(
    new Set(logins.map((l) => String(l || "").trim().toLowerCase()).filter(Boolean))
  );
  if (uniqueLogins.length === 0) return byLogin;

  const query = `
    query ChannelAbout($login: String!) {
      user(login: $login) {
        login
        description
        channel {
          socialMedias {
            url
            title
          }
        }
        panels {
          ... on DefaultPanel {
            title
            description
            linkURL
          }
        }
      }
    }
  `;

  for (let i = 0; i < uniqueLogins.length; i += 25) {
    const chunk = uniqueLogins.slice(i, i + 25);
    const body = chunk.map((login) => ({
      query,
      variables: { login },
    }));

    try {
      const res = await fetch("https://gql.twitch.tv/gql", {
        method: "POST",
        headers: {
          "Client-Id": TWITCH_GQL_CLIENT_ID,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(body),
      });
      if (!res.ok) continue;

      const results = await res.json();
      if (!Array.isArray(results)) continue;

      for (let idx = 0; idx < results.length; idx += 1) {
        const login = chunk[idx];
        const user = results[idx]?.data?.user;
        if (!user) continue;

        const texts = [user.description];
        const socials = Array.isArray(user.channel?.socialMedias)
          ? user.channel.socialMedias
          : [];
        for (const social of socials) {
          if (social?.url) texts.push(social.url);
          if (social?.title) texts.push(social.title);
        }

        const panels = Array.isArray(user.panels) ? user.panels : [];
        for (const panel of panels) {
          if (panel?.linkURL) texts.push(panel.linkURL);
          if (panel?.description) texts.push(panel.description);
          if (panel?.title) texts.push(panel.title);
        }

        byLogin.set(login, extractDiscordInvitesFromTexts(texts));
      }
    } catch {
      // Keep Helix bio results even if GQL batch fails transiently
    }
  }

  return byLogin;
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
  const nonPartners = [];

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

    nonPartners.push({
      ...item,
      broadcasterType: broadcasterType || "standard",
      emails,
      discordLinks,
      description,
    });
  }

  const gqlDiscordsByLogin = opts.hasEmail
    ? new Map()
    : await fetchGqlAboutInBatches(nonPartners.map((s) => s.login));

  const enriched = [];
  for (const item of nonPartners) {
    const loginKey = String(item.login || "").toLowerCase();
    const gqlLinks = gqlDiscordsByLogin.get(loginKey) || [];
    const mergedDiscords = Array.from(
      new Set([...item.discordLinks, ...gqlLinks])
    );

    if (!opts.hasEmail && opts.hasContact) {
      if (item.emails.length === 0 && mergedDiscords.length === 0) continue;
    }

    enriched.push({
      ...item,
      discordLinks: mergedDiscords,
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

  const finalStreams = Number.isFinite(opts.maxLeads)
    ? enriched.slice(0, opts.maxLeads)
    : enriched;

  return {
    streams: finalStreams,
    totalMatched: enriched.length,
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

const MASTER_CSV_HEADERS = [
  "discovered_at",
  "username",
  "contact_type",
  "email",
  "discord",
  "viewer_count",
  "broadcaster_type",
  "title",
  "about_url",
];

function parseCsvRecords(rawText) {
  const rows = [];
  let row = [];
  let cell = "";
  let inQuotes = false;

  for (let i = 0; i < rawText.length; i += 1) {
    const ch = rawText[i];
    const next = rawText[i + 1];

    if (inQuotes) {
      if (ch === '"' && next === '"') {
        cell += '"';
        i += 1;
      } else if (ch === '"') {
        inQuotes = false;
      } else {
        cell += ch;
      }
      continue;
    }

    if (ch === '"') {
      inQuotes = true;
    } else if (ch === ",") {
      row.push(cell);
      cell = "";
    } else if (ch === "\r" && next === "\n") {
      row.push(cell);
      rows.push(row);
      row = [];
      cell = "";
      i += 1;
    } else if (ch === "\n" || ch === "\r") {
      row.push(cell);
      rows.push(row);
      row = [];
      cell = "";
    } else {
      cell += ch;
    }
  }

  if (cell.length > 0 || row.length > 0) {
    row.push(cell);
    rows.push(row);
  }

  if (rows.length === 0) return [];
  const headers = rows[0].map((h) => h.trim().toLowerCase());
  const records = [];
  for (let r = 1; r < rows.length; r += 1) {
    if (rows[r].every((v) => v.trim() === "")) continue;
    const obj = {};
    for (let c = 0; c < headers.length; c += 1) {
      obj[headers[c]] = (rows[r][c] ?? "").trim();
    }
    records.push(obj);
  }
  return records;
}

function loadMasterCsvIndex() {
  const existingUsernames = new Set();
  const existingEmails = new Set();
  if (!fs.existsSync(MASTER_CSV_FILE)) {
    return { existingUsernames, existingEmails, totalRows: 0 };
  }

  const raw = fs.readFileSync(MASTER_CSV_FILE, "utf8");
  const records = parseCsvRecords(raw);
  for (const row of records) {
    const username = (row.username || "").trim().toLowerCase();
    const email = (row.email || "").trim().toLowerCase();
    if (username) existingUsernames.add(username);
    if (email) existingEmails.add(email);
  }

  return {
    existingUsernames,
    existingEmails,
    totalRows: records.length,
  };
}

function getContactType(emails, discordLinks) {
  const hasEmail = emails.length > 0;
  const hasDiscord = discordLinks.length > 0;
  if (hasEmail && hasDiscord) return "both";
  if (hasEmail) return "email";
  if (hasDiscord) return "discord";
  return "none";
}

function appendMasterCsv(streams) {
  const master = loadMasterCsvIndex();
  const discoveredAt = new Date().toISOString();
  const freshRows = [];
  let appendedEmails = 0;

  for (const s of streams) {
    const login = String(s.login || "").trim().toLowerCase();
    const email = String(s.emails[0] || "").trim().toLowerCase();
    const discord = String(s.discordLinks[0] || "").trim();

    if (!login || master.existingUsernames.has(login)) continue;
    if (email && master.existingEmails.has(email)) continue;

    master.existingUsernames.add(login);
    if (email) {
      master.existingEmails.add(email);
      appendedEmails += 1;
    }

    freshRows.push(
      [
        discoveredAt,
        login,
        getContactType(s.emails, s.discordLinks),
        email,
        discord,
        s.viewers,
        s.broadcasterType,
        s.title,
        s.aboutUrl,
      ]
        .map(escapeCsvCell)
        .join(",")
    );
  }

  if (freshRows.length === 0) {
    return {
      filePath: MASTER_CSV_FILE,
      appendedCount: 0,
      appendedEmails: 0,
      totalRows: master.totalRows,
    };
  }

  fs.mkdirSync(path.dirname(MASTER_CSV_FILE), { recursive: true });
  const needsHeader =
    !fs.existsSync(MASTER_CSV_FILE) ||
    fs.statSync(MASTER_CSV_FILE).size === 0;
  const header = MASTER_CSV_HEADERS.join(",");
  const chunk = (needsHeader ? [header, ...freshRows] : freshRows).join("\n") + "\n";
  fs.appendFileSync(MASTER_CSV_FILE, chunk, "utf8");

  return {
    filePath: MASTER_CSV_FILE,
    appendedCount: freshRows.length,
    appendedEmails,
    totalRows: master.totalRows + freshRows.length,
  };
}

const DISCORD_CSV_HEADERS = [
  "discovered_at",
  "username",
  "discord",
  "viewer_count",
  "broadcaster_type",
  "title",
  "about_url",
  "dm_status",
];

function loadDiscordCsvIndex() {
  const existingUsernames = new Set();
  const existingDiscords = new Set();
  if (!fs.existsSync(DISCORD_CSV_FILE)) {
    return { existingUsernames, existingDiscords, totalRows: 0 };
  }

  const raw = fs.readFileSync(DISCORD_CSV_FILE, "utf8");
  const records = parseCsvRecords(raw);
  for (const row of records) {
    const username = (row.username || "").trim().toLowerCase();
    const discord = normalizeDiscordInvite(row.discord || "");
    if (username) existingUsernames.add(username);
    if (discord) existingDiscords.add(discord);
  }

  return {
    existingUsernames,
    existingDiscords,
    totalRows: records.length,
  };
}

function appendDiscordCsv(streams) {
  const discordIndex = loadDiscordCsvIndex();
  const discoveredAt = new Date().toISOString();
  const freshRows = [];

  for (const s of streams) {
    const login = String(s.login || "").trim().toLowerCase();
    const rawDiscord = s.discordLinks?.[0] || s.discord || "";
    const discord = normalizeDiscordInvite(rawDiscord);

    if (!login || !discord) continue;
    if (discordIndex.existingUsernames.has(login)) continue;
    if (discordIndex.existingDiscords.has(discord)) continue;

    discordIndex.existingUsernames.add(login);
    discordIndex.existingDiscords.add(discord);

    freshRows.push(
      [
        discoveredAt,
        login,
        discord,
        s.viewers ?? s.viewer_count ?? "",
        s.broadcasterType || s.broadcaster_type || "standard",
        s.title || "",
        s.aboutUrl || s.about_url || `https://www.twitch.tv/${login}/about`,
        "pending",
      ]
        .map(escapeCsvCell)
        .join(",")
    );
  }

  if (freshRows.length === 0) {
    return {
      filePath: DISCORD_CSV_FILE,
      appendedCount: 0,
      totalRows: discordIndex.totalRows,
    };
  }

  fs.mkdirSync(path.dirname(DISCORD_CSV_FILE), { recursive: true });
  const needsHeader =
    !fs.existsSync(DISCORD_CSV_FILE) ||
    fs.statSync(DISCORD_CSV_FILE).size === 0;
  const header = DISCORD_CSV_HEADERS.join(",");
  const chunk = (needsHeader ? [header, ...freshRows] : freshRows).join("\n") + "\n";
  fs.appendFileSync(DISCORD_CSV_FILE, chunk, "utf8");

  return {
    filePath: DISCORD_CSV_FILE,
    appendedCount: freshRows.length,
    totalRows: discordIndex.totalRows + freshRows.length,
  };
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

async function runScanOnce(opts, credentials, quietWatch = false) {
  const seenHistory = opts.noHistory ? new Set() : loadSeenHistory();
  const masterIndex = opts.noHistory
    ? { existingUsernames: new Set(), existingEmails: new Set(), totalRows: 0 }
    : loadMasterCsvIndex();

  const token = await getAppAccessToken(
    credentials.clientId,
    credentials.clientSecret
  );
  const category = await resolveCategory(
    credentials.clientId,
    token,
    opts.category
  );

  if (!category) {
    console.log(`Category "${opts.category}" was not found on Twitch.`);
    return;
  }

  const combinedSeen = new Set([
    ...seenHistory,
    ...masterIndex.existingUsernames,
  ]);

  const {
    streams,
    totalMatched,
    pagesScanned,
    skippedDuplicates,
    excludedPartners,
  } = await fetchCandidateStreams(
    credentials.clientId,
    token,
    category.id,
    opts,
    combinedSeen
  );

  const finalStreams = opts.noHistory
    ? streams
    : streams.filter((s) => {
        const email = String(s.emails[0] || "").trim().toLowerCase();
        return !email || !masterIndex.existingEmails.has(email);
      });

  const consoleCount = finalStreams.filter((s) => s.isConsole).length;
  const emailCount = finalStreams.filter((s) => s.emails.length > 0).length;
  const discordCount = finalStreams.filter((s) => s.discordLinks.length > 0).length;

  const appendResult = appendMasterCsv(finalStreams);
  const discordResult = appendDiscordCsv(finalStreams);

  if (!opts.noHistory && finalStreams.length > 0) {
    for (const s of finalStreams) {
      seenHistory.add(String(s.login).toLowerCase());
    }
    saveSeenHistory(seenHistory);
  }

  const now = new Date();
  const hh = String(now.getHours()).padStart(2, "0");
  const mm = String(now.getMinutes()).padStart(2, "0");
  const summaryLine = `[${hh}:${mm}] Emails: +${appendResult.appendedEmails} (Total: ${appendResult.totalRows}) | Discords: +${discordResult.appendedCount} (Total: ${discordResult.totalRows})`;

  if (quietWatch) {
    console.log(summaryLine);
    return;
  }

  console.log("");
  console.log(
    `Twitch Outreach Scan | Category: ${category.name} (ID ${category.id}) | Lang: ${opts.lang} | Viewers: ${opts.min}-${opts.max}`
  );
  console.log(
    `Scanned ${pagesScanned} page(s) | Output leads: ${finalStreams.length}${totalMatched > finalStreams.length ? ` of ${totalMatched}` : ""} (${emailCount} with email, ${discordCount} with Discord, ${consoleCount} tagged console)`
  );
  console.log(
    `Filtered out: ${excludedPartners} partner(s), ${opts.noHistory ? "history bypassed (--no-history)" : `${skippedDuplicates} previously seen`}`
  );
  console.log("-".repeat(88));

  if (finalStreams.length === 0) {
    console.log("No fresh streams match your filters right now.");
  } else {
    finalStreams.forEach((s, idx) => {
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
  }

  console.log("-".repeat(88));
  console.log(summaryLine);

  if (opts.save) {
    const files = saveReport(finalStreams, opts.save, {
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

async function runBackfillDiscord() {
  if (!fs.existsSync(MASTER_CSV_FILE)) {
    console.error(
      `Master CSV not found: ${path.relative(ROOT_DIR, MASTER_CSV_FILE)}`
    );
    process.exit(1);
  }

  const rawMaster = fs.readFileSync(MASTER_CSV_FILE, "utf8");
  const masterRows = parseCsvRecords(rawMaster);
  const discordIndex = loadDiscordCsvIndex();

  const pendingRows = [];
  const seenLogins = new Set();
  for (const row of masterRows) {
    const login = String(row.username || "").trim().toLowerCase();
    if (!login || seenLogins.has(login)) continue;
    seenLogins.add(login);
    if (discordIndex.existingUsernames.has(login)) continue;
    pendingRows.push({ ...row, login });
  }

  console.log(
    `Backfilling Discord invites from ${masterRows.length} master-leads.csv rows (${pendingRows.length} not yet in discord-leads.csv)...`
  );

  const gqlDiscordsByLogin = await fetchGqlAboutInBatches(
    pendingRows.map((r) => r.login)
  );

  const enriched = [];
  for (const row of pendingRows) {
    const existingInvite = normalizeDiscordInvite(row.discord || "");
    const gqlInvites = gqlDiscordsByLogin.get(row.login) || [];
    const discordLinks = Array.from(
      new Set([...(existingInvite ? [existingInvite] : []), ...gqlInvites])
    );
    if (discordLinks.length === 0) continue;

    enriched.push({
      login: row.login,
      discordLinks,
      viewers: row.viewer_count || "",
      broadcasterType: row.broadcaster_type || "standard",
      title: row.title || "",
      aboutUrl: row.about_url || `https://www.twitch.tv/${row.login}/about`,
    });
  }

  const discordResult = appendDiscordCsv(enriched);
  const now = new Date();
  const hh = String(now.getHours()).padStart(2, "0");
  const mm = String(now.getMinutes()).padStart(2, "0");
  console.log(
    `[${hh}:${mm}] Backfill complete | Emails: +0 (Total: ${masterRows.length}) | Discords: +${discordResult.appendedCount} (Total: ${discordResult.totalRows})`
  );
}

async function main() {
  const opts = parseCliArgs(process.argv.slice(2));
  if (opts.help) {
    printHelp();
    return;
  }

  if (opts.reset) {
    clearSeenHistory();
    console.log(
      "Cleared previously surfaced streamer history, master CSV, and Discord CSV."
    );
  }

  if (opts.backfillDiscord) {
    await runBackfillDiscord();
    return;
  }

  const credentials = resolveTwitchCredentials();

  if (!opts.watch) {
    await runScanOnce(opts, credentials, false);
    return;
  }

  let running = true;
  const stop = () => {
    running = false;
    console.log("\nStopping watch mode...");
    process.exit(0);
  };
  process.on("SIGINT", stop);
  process.on("SIGTERM", stop);

  console.log(
    `Watch mode active (interval: ${opts.intervalMinutes} min). Writing new leads to scripts/master-leads.csv...`
  );

  while (running) {
    try {
      await runScanOnce(opts, credentials, true);
    } catch (err) {
      const now = new Date();
      const hh = String(now.getHours()).padStart(2, "0");
      const mm = String(now.getMinutes()).padStart(2, "0");
      console.error(
        `[${hh}:${mm}] Scan error:`,
        err instanceof Error ? err.message : err
      );
    }
    if (!running) break;
    await new Promise((resolve) =>
      setTimeout(resolve, opts.intervalMinutes * 60 * 1000)
    );
  }
}

main().catch((err) => {
  console.error("Outreach script error:", err instanceof Error ? err.message : err);
  process.exit(1);
});
