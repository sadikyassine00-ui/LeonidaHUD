#!/usr/bin/env node

import fs from "node:fs";
import path from "node:path";
import nodemailer from "nodemailer";

const ROOT_DIR = process.cwd();
const DEFAULT_CSV_FILE = path.join(ROOT_DIR, "scripts", "master-leads.csv");
const HISTORY_FILE = path.join(ROOT_DIR, "scripts", "emailed-history.json");

const DEFAULT_PER_ACCOUNT = 15;
const MIN_DELAY_MS = 35_000;
const MAX_DELAY_MS = 60_000;

const SUBJECT_OPTIONS = [
  "your GTA 6 story % tracker",
  "GTA 6 on console",
  "quick question about your GTA 6 stream",
];

const GREETING_OPTIONS = [
  "yo {username},",
  "hey {username},",
  "sup {username},",
];

const SIGNOFF_OPTIONS = [
  "want me to send the link?",
  "down to test it out?",
  "want me to shoot over the link?",
];

function pickRandom(items) {
  return items[Math.floor(Math.random() * items.length)];
}

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

function resolveSenderPool() {
  const localEnv = {
    ...loadEnvFile(path.join(ROOT_DIR, ".env")),
    ...loadEnvFile(path.join(ROOT_DIR, ".env.local")),
    ...process.env,
  };

  const suffixes = new Set();
  for (const key of Object.keys(localEnv)) {
    const emailMatch = key.match(/^OUTREACH_EMAIL(.*)$/);
    if (emailMatch) suffixes.add(emailMatch[1]);
    const passMatch = key.match(/^OUTREACH_APP_PASSWORD(.*)$/);
    if (passMatch) suffixes.add(passMatch[1]);
  }

  const orderedSuffixes = Array.from(suffixes).sort((a, b) => {
    if (a === "") return -1;
    if (b === "") return 1;
    return a.localeCompare(b, undefined, { numeric: true });
  });

  const pool = [];
  const seenUsers = new Set();

  for (const suffix of orderedSuffixes) {
    const emailKey = `OUTREACH_EMAIL${suffix}`;
    const passKey = `OUTREACH_APP_PASSWORD${suffix}`;
    const user = (localEnv[emailKey] || "").trim().toLowerCase();
    const pass = (localEnv[passKey] || "").replace(/\s+/g, "");

    if (!user || !pass) {
      if (user || pass) {
        console.warn(
          `Skipping incomplete sender pair (${emailKey} / ${passKey}).`
        );
      }
      continue;
    }

    if (seenUsers.has(user)) continue;
    seenUsers.add(user);
    pool.push({
      label: suffix ? `Account ${suffix.replace(/^_/, "")}` : "Account 1",
      user,
      pass,
    });
  }

  if (pool.length === 0) {
    console.error(
      "No valid outreach sender pairs found. Set OUTREACH_EMAIL and OUTREACH_APP_PASSWORD in .env.local."
    );
    process.exit(1);
  }

  return pool;
}

function parseCliArgs(argv) {
  const opts = {
    csvPath: DEFAULT_CSV_FILE,
    perAccount: DEFAULT_PER_ACCOUNT,
    limit: Infinity,
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
    } else if (arg === "--per-account" && argv[i + 1]) {
      const n = Number(argv[i + 1]);
      if (Number.isFinite(n) && n >= 1) opts.perAccount = Math.floor(n);
      i += 1;
    } else if (arg.startsWith("--per-account=")) {
      const n = Number(arg.slice(14));
      if (Number.isFinite(n) && n >= 1) opts.perAccount = Math.floor(n);
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
Leonida HUD - Multi-Inbox Plain-Text Outreach Mailer

Usage:
  npm run send-invites [-- options]

Options:
  --dry-run            Preview batch and sender rotation (default)
  --send               Send live via Gmail SMTP (35-60s random delay)
  --per-account <n>    Daily UTC cap per Gmail inbox (default: ${DEFAULT_PER_ACCOUNT})
  --limit <n>          Optional total cap for this run (default: all remaining daily quota)
  --csv <path>         Custom CSV path (default: scripts/master-leads.csv)
  -h, --help           Show this help message
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

function getTodayUtcDate() {
  return new Date().toISOString().slice(0, 10);
}

function countSentTodayBySender(history, senderPool) {
  const todayUtc = getTodayUtcDate();
  const counts = new Map(senderPool.map((s) => [s.user, 0]));
  const fallbackSender = senderPool[0]?.user || "";

  for (const record of Object.values(history.sent)) {
    if (!record || typeof record !== "object") continue;
    const sentAt = String(record.sent_at || record.sentAt || "");
    if (!sentAt.startsWith(todayUtc)) continue;

    const sentFrom = String(record.sent_from || fallbackSender)
      .trim()
      .toLowerCase();
    if (counts.has(sentFrom)) {
      counts.set(sentFrom, (counts.get(sentFrom) || 0) + 1);
    }
  }

  return { todayUtc, counts };
}

function buildRotatedAssignments(candidates, senderPool, countsToday, perAccount, maxTotal) {
  const remaining = new Map(
    senderPool.map((s) => [
      s.user,
      Math.max(0, perAccount - (countsToday.get(s.user) || 0)),
    ])
  );

  const assignments = [];
  let senderCursor = 0;

  for (const candidate of candidates) {
    if (assignments.length >= maxTotal) break;

    let assignedSender = null;
    for (let tried = 0; tried < senderPool.length; tried += 1) {
      const idx = (senderCursor + tried) % senderPool.length;
      const sender = senderPool[idx];
      const left = remaining.get(sender.user) || 0;
      if (left > 0) {
        assignedSender = sender;
        remaining.set(sender.user, left - 1);
        senderCursor = (idx + 1) % senderPool.length;
        break;
      }
    }

    if (!assignedSender) break;
    assignments.push({ recipient: candidate, sender: assignedSender });
  }

  return assignments;
}

function renderEmailMessage(username) {
  const cleanName = String(username || "").trim();
  if (!cleanName) {
    throw new Error("Cannot personalize email with empty username");
  }

  const subject = pickRandom(SUBJECT_OPTIONS);
  const greeting = pickRandom(GREETING_OPTIONS).replace(
    /\{username\}/gi,
    cleanName
  );
  const signoff = pickRandom(SIGNOFF_OPTIONS);

  const text = [
    `${greeting} saw you grinding GTA 6 on Twitch.`,
    "",
    "i made a small browser tool for console players so you can tap Wasted, Busted, and live story % straight from your phone onto your stream without touching OBS.",
    "",
    `looking for 5 streamers to test it free this week and tell me what's broken. ${signoff}`,
  ].join("\n");

  if (/\{username\}|\{greeting\}|\{signoff\}/i.test(text) || /\{username\}/i.test(subject)) {
    throw new Error("Template placeholder was not replaced");
  }
  if (/[\u2014\u2013]/.test(text) || /[\u2014\u2013]/.test(subject)) {
    throw new Error("Outreach template must not contain em/en dashes");
  }
  if (/(https?:\/\/|www\.)/i.test(text)) {
    throw new Error("Plain-text outreach body must not contain URLs");
  }

  return { subject, text };
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

  const senderPool = resolveSenderPool();

  if (!fs.existsSync(opts.csvPath)) {
    console.error(
      `CSV file not found: ${path.relative(ROOT_DIR, opts.csvPath)}\nRun "npm run find-streamers" first.`
    );
    process.exit(1);
  }

  const rawCsv = fs.readFileSync(opts.csvPath, "utf8");
  const rows = parseCsv(rawCsv);
  const history = loadEmailedHistory();
  const { todayUtc, counts: countsToday } = countSentTodayBySender(
    history,
    senderPool
  );

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

  const assignments = buildRotatedAssignments(
    candidates,
    senderPool,
    countsToday,
    opts.perAccount,
    opts.limit
  );

  console.log("");
  console.log(
    `Outreach Mailer | Mode: ${opts.send ? "LIVE SEND" : "DRY RUN (preview only)"} | Senders: ${senderPool.length} | Date (UTC): ${todayUtc}`
  );
  for (const s of senderPool) {
    const used = countsToday.get(s.user) || 0;
    const left = Math.max(0, opts.perAccount - used);
    console.log(
      `  - ${s.label}: ${s.user} | Sent today: ${used}/${opts.perAccount} (${left} remaining)`
    );
  }
  console.log(
    `CSV rows: ${rows.length} | Skipped (no email: ${skippedNoEmail}, dup in CSV: ${skippedDuplicateCsv}, already emailed: ${skippedAlreadyEmailed})`
  );
  console.log(
    `Eligible leads: ${candidates.length} | Queued this run: ${assignments.length}`
  );
  console.log("-".repeat(80));

  if (assignments.length === 0) {
    console.log(
      "No emails queued (either no fresh email leads or daily per-account caps reached)."
    );
    return;
  }

  if (!opts.send) {
    assignments.forEach(({ recipient, sender }, idx) => {
      const { subject, text } = renderEmailMessage(recipient.username);
      console.log(
        `[${idx + 1}/${assignments.length}] From: ${sender.user} (${sender.label}) -> To: ${recipient.email} (Twitch: ${recipient.username})`
      );
      console.log(`Subject: ${subject}`);
      console.log(text);
      console.log("-".repeat(80));
    });
    console.log(
      `Dry run complete. Re-run with "npm run send-invites -- --send" to send these ${assignments.length} email(s).`
    );
    return;
  }

  const transports = new Map();
  for (const { sender } of assignments) {
    if (!transports.has(sender.user)) {
      const transporter = nodemailer.createTransport({
        service: "gmail",
        auth: { user: sender.user, pass: sender.pass },
      });
      await transporter.verify();
      console.log(`Verified Gmail SMTP for ${sender.user} (${sender.label})`);
      transports.set(sender.user, transporter);
    }
  }
  console.log("Starting staggered multi-inbox sends...\n");

  let sentCount = 0;
  for (let i = 0; i < assignments.length; i += 1) {
    const { recipient, sender } = assignments[i];
    const transporter = transports.get(sender.user);
    const { subject, text } = renderEmailMessage(recipient.username);

    const info = await transporter.sendMail({
      from: sender.user,
      to: recipient.email,
      subject,
      text,
    });

    history.sent[recipient.email] = {
      email: recipient.email,
      username: recipient.username,
      sent_from: sender.user,
      sent_at: new Date().toISOString(),
      messageId: info.messageId || null,
    };
    saveEmailedHistory(history);
    sentCount += 1;

    console.log(
      `[${sentCount}/${assignments.length}] Sent via ${sender.user} -> ${recipient.email} (${recipient.username}) | id=${info.messageId || "ok"}`
    );

    if (i < assignments.length - 1) {
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
