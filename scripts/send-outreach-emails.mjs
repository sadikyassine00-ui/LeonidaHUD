#!/usr/bin/env node

import fs from "node:fs";
import path from "node:path";
import nodemailer from "nodemailer";

const ROOT_DIR = process.cwd();
const DEFAULT_CSV_FILE = path.join(ROOT_DIR, "scripts", "master-leads.csv");
const HISTORY_FILE = path.join(ROOT_DIR, "scripts", "emailed-history.json");

const DEFAULT_LIMIT = 15;
const MIN_DELAY_MS = 35_000;
const MAX_DELAY_MS = 65_000;

const EMAIL_SUBJECT = "quick question about your GTA 6 stream";

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

function resolveMailerCredentials() {
  const localEnv = {
    ...loadEnvFile(path.join(ROOT_DIR, ".env")),
    ...loadEnvFile(path.join(ROOT_DIR, ".env.local")),
    ...process.env,
  };

  const user = (localEnv.OUTREACH_EMAIL || "").trim();
  const pass = (localEnv.OUTREACH_APP_PASSWORD || "").replace(/\s+/g, "");

  if (!user || !pass) {
    console.error(
      "Missing outreach credentials. Set OUTREACH_EMAIL and OUTREACH_APP_PASSWORD in .env.local."
    );
    process.exit(1);
  }

  return { user, pass };
}

function parseCliArgs(argv) {
  const opts = {
    csvPath: DEFAULT_CSV_FILE,
    limit: DEFAULT_LIMIT,
    send: false,
    help: false,
  };

  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === "--help" || arg === "-h") {
      opts.help = true;
    } else if (arg === "--send") {
      opts.send = true;
    } else if (arg === "--dry-run") {
      opts.send = false;
    } else if (arg === "--limit" && argv[i + 1]) {
      const n = Number(argv[i + 1]);
      if (Number.isFinite(n) && n >= 1) opts.limit = Math.floor(n);
      i += 1;
    } else if (arg.startsWith("--limit=")) {
      const n = Number(arg.slice(8));
      if (Number.isFinite(n) && n >= 1) opts.limit = Math.floor(n);
    } else if (arg === "--csv" && argv[i + 1]) {
      opts.csvPath = path.resolve(ROOT_DIR, argv[i + 1]);
      i += 1;
    } else if (arg.startsWith("--csv=")) {
      opts.csvPath = path.resolve(ROOT_DIR, arg.slice(6));
    }
  }

  return opts;
}

function printHelp() {
  console.log(`
Leonida HUD - Safe Plain-Text Outreach Mailer

Usage:
  npm run send-invites [-- options]

Options:
  --dry-run        Preview batch and rendered plain-text emails (default)
  --send           Actually send emails via Gmail SMTP (35-65s random delay)
  --limit <n>      Max recipients per run (default: ${DEFAULT_LIMIT})
  --csv <path>     Custom CSV path (default: scripts/master-leads.csv)
  -h, --help       Show this help message
`);
}

function parseCsv(rawText) {
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
    const values = rows[r];
    if (values.every((v) => v.trim() === "")) continue;
    const obj = {};
    for (let c = 0; c < headers.length; c += 1) {
      obj[headers[c]] = (values[c] ?? "").trim();
    }
    records.push(obj);
  }

  return records;
}

function loadEmailedHistory() {
  if (!fs.existsSync(HISTORY_FILE)) {
    return { updatedAt: null, count: 0, sent: {} };
  }
  try {
    const parsed = JSON.parse(fs.readFileSync(HISTORY_FILE, "utf8"));
    const sent =
      parsed && typeof parsed.sent === "object" && parsed.sent !== null
        ? parsed.sent
        : {};
    return {
      updatedAt: parsed.updatedAt || null,
      count: Object.keys(sent).length,
      sent,
    };
  } catch {
    return { updatedAt: null, count: 0, sent: {} };
  }
}

function saveEmailedHistory(history) {
  fs.mkdirSync(path.dirname(HISTORY_FILE), { recursive: true });
  const payload = {
    updatedAt: new Date().toISOString(),
    count: Object.keys(history.sent).length,
    sent: history.sent,
  };
  fs.writeFileSync(HISTORY_FILE, JSON.stringify(payload, null, 2), "utf8");
}

function renderEmailText(username) {
  const cleanName = String(username || "").trim();
  if (!cleanName) {
    throw new Error("Cannot personalize email with empty username");
  }

  const body = [
    `yo ${cleanName}, saw your GTA 6 stream on Twitch. i built a lightweight OBS browser overlay for console streamers so you can tap Wasted, Busted, and 9:16 TikTok-safe counters straight from your phone.`,
    "",
    "i'm looking for 5 console streamers to test it out this week and tell me what feels clunky. happy to unlock full access on my end at no cost if you want to try it on stream.",
    "",
    "want me to send it over?",
  ].join("\n");

  if (/\{username\}/i.test(body) || /\{username\}/i.test(EMAIL_SUBJECT)) {
    throw new Error("Template placeholder {username} was not replaced");
  }
  if (/(https?:\/\/|www\.)/i.test(body)) {
    throw new Error("Plain-text outreach body must not contain URLs");
  }

  return body;
}

function randomDelayMs() {
  return (
    MIN_DELAY_MS + Math.floor(Math.random() * (MAX_DELAY_MS - MIN_DELAY_MS + 1))
  );
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function main() {
  const opts = parseCliArgs(process.argv.slice(2));
  if (opts.help) {
    printHelp();
    return;
  }

  const { user, pass } = resolveMailerCredentials();

  if (!fs.existsSync(opts.csvPath)) {
    console.error(
      `CSV file not found: ${path.relative(ROOT_DIR, opts.csvPath)}\nRun "npm run find-streamers" first.`
    );
    process.exit(1);
  }

  const rawCsv = fs.readFileSync(opts.csvPath, "utf8");
  const rows = parseCsv(rawCsv);
  const history = loadEmailedHistory();

  const seenInCsv = new Set();
  const candidates = [];
  let skippedNoEmail = 0;
  let skippedDuplicateCsv = 0;
  let skippedAlreadyEmailed = 0;

  for (const row of rows) {
    const email = (row.email || "").trim().toLowerCase();
    const username = (row.username || "").trim();

    if (!email || !email.includes("@") || !username) {
      skippedNoEmail += 1;
      continue;
    }
    if (seenInCsv.has(email)) {
      skippedDuplicateCsv += 1;
      continue;
    }
    seenInCsv.add(email);

    if (Object.prototype.hasOwnProperty.call(history.sent, email)) {
      skippedAlreadyEmailed += 1;
      continue;
    }

    candidates.push({
      username,
      email,
      viewers: row.viewer_count || "",
    });
  }

  const batch = candidates.slice(0, opts.limit);

  console.log("");
  console.log(
    `Outreach Mailer | Mode: ${opts.send ? "LIVE SEND" : "DRY RUN (preview only)"} | From: ${user}`
  );
  console.log(
    `CSV rows: ${rows.length} | Skipped (no email: ${skippedNoEmail}, dup in CSV: ${skippedDuplicateCsv}, already emailed: ${skippedAlreadyEmailed})`
  );
  console.log(
    `Eligible leads: ${candidates.length} | Batch cap: ${opts.limit} | Queued this run: ${batch.length}`
  );
  console.log("-".repeat(80));

  if (batch.length === 0) {
    console.log("No new recipients to message.");
    return;
  }

  if (!opts.send) {
    batch.forEach((recipient, idx) => {
      const body = renderEmailText(recipient.username);
      console.log(
        `[${idx + 1}/${batch.length}] To: ${recipient.email} (Twitch: ${recipient.username})`
      );
      console.log(`Subject: ${EMAIL_SUBJECT}`);
      console.log(body);
      console.log("-".repeat(80));
    });
    console.log(
      `Dry run complete. Re-run with "npm run send-invites -- --send" to send these ${batch.length} email(s).`
    );
    return;
  }

  const transporter = nodemailer.createTransport({
    service: "gmail",
    auth: { user, pass },
  });

  await transporter.verify();
  console.log("Gmail SMTP connection verified. Starting staggered sends...\n");

  let sentCount = 0;
  for (let i = 0; i < batch.length; i += 1) {
    const recipient = batch[i];
    const text = renderEmailText(recipient.username);

    const info = await transporter.sendMail({
      from: user,
      to: recipient.email,
      subject: EMAIL_SUBJECT,
      text,
    });

    history.sent[recipient.email] = {
      username: recipient.username,
      sentAt: new Date().toISOString(),
      messageId: info.messageId || null,
    };
    saveEmailedHistory(history);
    sentCount += 1;

    console.log(
      `[${sentCount}/${batch.length}] Sent to ${recipient.email} (${recipient.username}) | id=${info.messageId || "ok"}`
    );

    if (i < batch.length - 1) {
      const waitMs = randomDelayMs();
      const waitSec = Math.round(waitMs / 1000);
      console.log(`Waiting ${waitSec}s before next send...`);
      await sleep(waitMs);
    }
  }

  console.log("");
  console.log(
    `Done. Sent ${sentCount} plain-text email(s) and updated scripts/emailed-history.json.`
  );
}

main().catch((err) => {
  console.error("Mailer error:", err instanceof Error ? err.message : err);
  process.exit(1);
});
