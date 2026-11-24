#!/usr/bin/env node

const fs = require("node:fs");
const path = require("node:path");
const readline = require("node:readline");
const { spawnSync } = require("node:child_process");

const ROOT_DIR = process.cwd();
const DISCORD_CSV_FILE = path.join(ROOT_DIR, "scripts", "discord-leads.csv");
const DEFAULT_SESSION_LIMIT = 5;

const GREETING_OPTIONS = [
  "yo {username},",
  "hey {username},",
  "sup {username},",
];

const BODY_OPTIONS = [
  "saw your GTA 6 stream on Twitch. i made a small browser tool for console players so you can tap Wasted, Busted, and live story % straight from your phone onto your stream without touching OBS.",
  "caught your GTA 6 stream on Twitch. i built a lightweight browser overlay for console players so you can tap Wasted, Busted, and live story % right from your phone without touching OBS.",
];

const SIGNOFF_OPTIONS = [
  "looking for 5 streamers to test it free this week and tell me what's broken. want me to send the link?",
  "looking for 5 streamers to test it free this week and tell me what feels clunky. down to test it out?",
  "letting 5 console streamers test it free this week to catch bugs. want me to shoot over the link?",
];

function pickRandom(items) {
  return items[Math.floor(Math.random() * items.length)];
}

function parseCliArgs(argv) {
  const opts = {
    limit: DEFAULT_SESSION_LIMIT,
    preview: false,
    help: false,
  };

  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === "--help" || arg === "-h") {
      opts.help = true;
    } else if (arg === "--preview" || arg === "--dry-run") {
      opts.preview = true;
    } else if (arg === "--limit" && argv[i + 1]) {
      const n = Number(argv[i + 1]);
      if (Number.isFinite(n) && n >= 1) opts.limit = Math.floor(n);
      i += 1;
    } else if (arg.startsWith("--limit=")) {
      const n = Number(arg.slice(8));
      if (Number.isFinite(n) && n >= 1) opts.limit = Math.floor(n);
    }
  }

  return opts;
}

function printHelp() {
  console.log(`
Leonida HUD - Manual Discord DM Helper

Usage:
  npm run next-dm [-- options]

Options:
  --limit <n>     Max leads per session (default: ${DEFAULT_SESSION_LIMIT})
  --preview       Print the top lead and copy its DM without waiting/updating CSV
  -h, --help      Show this help message
`);
}

function parseCsvTable(rawText) {
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

  if (rows.length === 0) return { headers: [], records: [] };
  const headers = rows[0].map((h) => h.trim());
  const records = [];

  for (let r = 1; r < rows.length; r += 1) {
    if (rows[r].every((v) => v.trim() === "")) continue;
    const obj = {};
    for (let c = 0; c < headers.length; c += 1) {
      obj[headers[c]] = rows[r][c] ?? "";
    }
    records.push(obj);
  }

  return { headers, records };
}

function escapeCsvCell(value) {
  const str = String(value ?? "");
  if (/[",\r\n]/.test(str)) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}

function writeCsvTable(filePath, headers, records) {
  const headerLine = headers.map(escapeCsvCell).join(",");
  const dataLines = records.map((rec) =>
    headers.map((h) => escapeCsvCell(rec[h] ?? "")).join(",")
  );
  fs.writeFileSync(filePath, [headerLine, ...dataLines].join("\n") + "\n", "utf8");
}

function scoreLead(rec) {
  const title = String(rec.title || "");
  const hasStoryPct = /\bstory\b|\b\d{1,3}\s*%/i.test(title);
  const hasConsole = /\bps5|\bplaystation|\bxbox|\bseries\s*[xs]\b|\bconsole/i.test(
    title
  );
  const viewers = Number(rec.viewer_count || 0) || 0;
  return (hasStoryPct ? 200000 : 0) + (hasConsole ? 100000 : 0) + viewers;
}

function renderDmText(username) {
  const cleanName = String(username || "").trim();
  const greeting = pickRandom(GREETING_OPTIONS).replace(/\{username\}/gi, cleanName);
  const body = pickRandom(BODY_OPTIONS);
  const signoff = pickRandom(SIGNOFF_OPTIONS);

  const dm = `${greeting} ${body}\n\n${signoff}`;
  if (/\{username\}/i.test(dm)) {
    throw new Error("Placeholder {username} was not replaced");
  }
  if (/(https?:\/\/|www\.)/i.test(dm)) {
    throw new Error("DM template must not contain links");
  }
  return dm;
}

function copyToClipboard(text) {
  if (process.platform === "win32") {
    const res = spawnSync("clip", [], {
      input: text,
      encoding: "utf8",
      windowsHide: true,
    });
    if (res.status === 0) return true;
  }

  const psRes = spawnSync(
    "powershell",
    ["-NoProfile", "-Command", "Set-Clipboard -Value ([Console]::In.ReadToEnd())"],
    { input: text, encoding: "utf8", windowsHide: true }
  );
  return psRes.status === 0;
}

function askLine(rl, promptText) {
  return new Promise((resolve) => rl.question(promptText, resolve));
}

async function main() {
  const opts = parseCliArgs(process.argv.slice(2));
  if (opts.help) {
    printHelp();
    return;
  }

  if (!fs.existsSync(DISCORD_CSV_FILE)) {
    console.error(
      `Discord leads CSV not found: ${path.relative(ROOT_DIR, DISCORD_CSV_FILE)}\nRun "npm run find-streamers -- --backfill-discord" first.`
    );
    process.exit(1);
  }

  const rawCsv = fs.readFileSync(DISCORD_CSV_FILE, "utf8");
  const { headers, records } = parseCsvTable(rawCsv);
  if (!headers.includes("dm_status")) {
    headers.push("dm_status");
  }

  const pendingIndices = records
    .map((rec, idx) => ({ rec, idx }))
    .filter(
      ({ rec }) =>
        String(rec.dm_status || "pending")
          .trim()
          .toLowerCase() === "pending"
    )
    .sort((a, b) => scoreLead(b.rec) - scoreLead(a.rec));

  if (pendingIndices.length === 0) {
    console.log("No pending Discord leads left in scripts/discord-leads.csv.");
    return;
  }

  const sessionMax = Math.min(opts.limit, pendingIndices.length);
  console.log(
    `\nPending Discord leads: ${pendingIndices.length} | Session queue: ${sessionMax}\n`
  );

  if (opts.preview) {
    const { rec } = pendingIndices[0];
    const dmText = renderDmText(rec.username);
    const copied = copyToClipboard(dmText);
    console.log(`Lead [1/${sessionMax}]`);
    console.log(`  Username: ${rec.username}`);
    console.log(`  Viewers:  ${rec.viewer_count}`);
    console.log(`  Title:    ${rec.title}`);
    console.log(`  Discord:  ${rec.discord}`);
    console.log("-".repeat(72));
    console.log(dmText);
    console.log("-".repeat(72));
    console.log(
      copied
        ? "Preview DM copied to clipboard (CSV not modified)."
        : "Clipboard copy unavailable (CSV not modified)."
    );
    return;
  }

  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });

  let processed = 0;
  try {
    for (let i = 0; i < sessionMax; i += 1) {
      const { rec, idx } = pendingIndices[i];
      const dmText = renderDmText(rec.username);
      const copied = copyToClipboard(dmText);

      console.log("=".repeat(72));
      console.log(`Lead [${i + 1}/${sessionMax}] (${pendingIndices.length - i} pending total)`);
      console.log(`  Username: ${rec.username}`);
      console.log(`  Viewers:  ${rec.viewer_count}`);
      console.log(`  Title:    ${rec.title}`);
      console.log(`  Discord:  ${rec.discord}`);
      console.log("-".repeat(72));
      console.log(dmText);
      console.log("-".repeat(72));
      console.log(
        copied
          ? "Copied personalized DM to your Windows clipboard."
          : "Could not copy automatically; copy the text above."
      );

      const answer = (
        await askLine(
          rl,
          "Press [Enter] when sent (or type 's' + Enter to skip, 'q' + Enter to quit): "
        )
      )
        .trim()
        .toLowerCase();

      if (answer === "q") {
        console.log(`Stopped early. Marked ${processed} lead(s) in this session.`);
        break;
      }

      records[idx].dm_status = answer === "s" ? "skipped" : "sent";
      writeCsvTable(DISCORD_CSV_FILE, headers, records);
      processed += 1;
      console.log(
        `Updated ${rec.username} -> dm_status=${records[idx].dm_status}\n`
      );
    }
  } finally {
    rl.close();
  }

  console.log(`Session complete. Updated ${processed} lead(s) in scripts/discord-leads.csv.`);
}

main().catch((err) => {
  console.error("next-dm error:", err instanceof Error ? err.message : err);
  process.exit(1);
});
