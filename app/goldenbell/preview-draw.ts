import { createHash, randomInt } from "node:crypto";
import { mkdirSync } from "node:fs";
import { join } from "node:path";

const WEEKLY_LIMIT = 200;
const KOREA_OFFSET = 9 * 60 * 60 * 1000;
const DAY_MS = 24 * 60 * 60 * 1000;
export type Outcome = "won" | "lost" | "sold-out" | "already-entered";
export type PreviewReviewStatus = "pending" | "approved" | "rejected";
export type PreviewEntry = { name: string; phone: string; store: string; mime: string; photo: Uint8Array };
export type PreviewReviewRow = {
  id: string; name: string; phone: string; store: string; created_at: string;
  outcome: "won" | "lost"; status: PreviewReviewStatus; photo_hash: string; reject_reason: string | null;
};
type DbValue = string | number | Uint8Array | null;
type DrawDatabase = {
  exec(sql: string): void;
  prepare(sql: string): {
    get(...values: DbValue[]): Record<string, unknown> | undefined;
    all(...values: DbValue[]): Record<string, unknown>[];
    run(...values: DbValue[]): { changes: number | bigint };
  };
  close(): void;
};

export function currentWeek(now = Date.now()) {
  const koreaDate = new Date(now + KOREA_OFFSET);
  const daysSinceMonday = (koreaDate.getUTCDay() + 6) % 7;
  koreaDate.setUTCDate(koreaDate.getUTCDate() - daysSinceMonday);
  return koreaDate.toISOString().slice(0, 10);
}

function openDatabase() {
  const { DatabaseSync } = process.getBuiltinModule("node:sqlite") as {
    DatabaseSync: new (path: string) => DrawDatabase;
  };
  const directory = join(process.cwd(), ".next");
  mkdirSync(directory, { recursive: true });
  const db = new DatabaseSync(join(directory, "goldenbell-preview.sqlite"));
  db.exec(`
    PRAGMA busy_timeout = 3000;
    CREATE TABLE IF NOT EXISTS preview_draws (
      id TEXT PRIMARY KEY,
      week TEXT NOT NULL,
      outcome TEXT NOT NULL
    );
    CREATE INDEX IF NOT EXISTS preview_draws_week ON preview_draws (week, outcome);
    CREATE TABLE IF NOT EXISTS preview_entries (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      phone TEXT NOT NULL,
      store TEXT NOT NULL,
      mime TEXT NOT NULL,
      photo BLOB NOT NULL,
      created_at TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','approved','rejected'))
    );
    CREATE INDEX IF NOT EXISTS preview_entries_phone_date ON preview_entries (phone, created_at);
    CREATE TABLE IF NOT EXISTS preview_entry_details (
      id TEXT PRIMARY KEY,
      reject_reason TEXT,
      photo_hash TEXT
    );
  `);
  return db;
}

function isSoldOut(db: DrawDatabase, week: string) {
  const row = db.prepare("SELECT COUNT(*) AS issued FROM preview_draws WHERE week = ? AND outcome = 'won'").get(week);
  return Number(row?.issued) >= WEEKLY_LIMIT;
}

export function previewSoldOut() {
  const db = openDatabase();
  try {
    return isSoldOut(db, currentWeek());
  } finally {
    db.close();
  }
}

export function drawPreview(id: string, entry: PreviewEntry): Outcome {
  const db = openDatabase();
  try {
    // Serialize the stock check and coupon allocation across concurrent submissions.
    db.exec("BEGIN IMMEDIATE");
    const previous = db.prepare("SELECT outcome FROM preview_draws WHERE id = ?").get(id);
    if (previous) {
      db.exec("COMMIT");
      return previous.outcome as Outcome;
    }
    const now = Date.now();
    const week = currentWeek(now);
    if (isSoldOut(db, week)) {
      db.exec("COMMIT");
      return "sold-out";
    }
    const dayStart = Math.floor((now + KOREA_OFFSET) / DAY_MS) * DAY_MS - KOREA_OFFSET;
    const submittedToday = db.prepare("SELECT 1 FROM preview_entries WHERE phone = ? AND created_at >= ? AND created_at < ? LIMIT 1")
      .get(entry.phone, new Date(dayStart).toISOString(), new Date(dayStart + DAY_MS).toISOString());
    if (submittedToday) {
      db.exec("COMMIT");
      return "already-entered";
    }

    const outcome = randomInt(2) === 0 ? "won" : "lost";
    db.prepare("INSERT INTO preview_draws (id, week, outcome) VALUES (?, ?, ?)").run(id, week, outcome);
    db.prepare("INSERT INTO preview_entries (id, name, phone, store, mime, photo, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)")
      .run(id, entry.name, entry.phone, entry.store, entry.mime, entry.photo, new Date(now).toISOString());
    db.prepare("INSERT INTO preview_entry_details (id, photo_hash) VALUES (?, ?)")
      .run(id, createHash("sha256").update(entry.photo).digest("hex"));
    db.exec("COMMIT");
    return outcome;
  } finally {
    db.close();
  }
}

export function listPreviewEntries() {
  const db = openDatabase();
  try {
    const rows = db.prepare(`
      SELECT e.id, e.name, e.phone, e.store, e.created_at, e.status, d.outcome, details.reject_reason, details.photo_hash
      FROM preview_entries e JOIN preview_draws d ON e.id = d.id
      LEFT JOIN preview_entry_details details ON e.id = details.id
      ORDER BY e.created_at DESC, e.id
    `).all() as PreviewReviewRow[];
    const receipt = db.prepare("SELECT photo FROM preview_entries WHERE id = ?");
    const saveHash = db.prepare("INSERT INTO preview_entry_details (id, photo_hash) VALUES (?, ?) ON CONFLICT (id) DO UPDATE SET photo_hash = excluded.photo_hash");
    for (const row of rows) {
      if (row.photo_hash) continue;
      const photo = receipt.get(row.id)?.photo as Uint8Array;
      row.photo_hash = createHash("sha256").update(photo).digest("hex");
      saveHash.run(row.id, row.photo_hash);
    }
    return rows;
  } finally {
    db.close();
  }
}

export function readPreviewReceipt(id: string) {
  const db = openDatabase();
  try {
    return db.prepare("SELECT mime, photo FROM preview_entries WHERE id = ?").get(id) as {mime: string; photo: Uint8Array} | undefined;
  } finally {
    db.close();
  }
}

export function updatePreviewReview(ids: string[], status: PreviewReviewStatus, reason: string | null) {
  const db = openDatabase();
  try {
    db.exec("BEGIN IMMEDIATE");
    const update = db.prepare("UPDATE preview_entries SET status = ? WHERE id = ?");
    const saveReason = db.prepare("INSERT INTO preview_entry_details (id, reject_reason) VALUES (?, ?) ON CONFLICT (id) DO UPDATE SET reject_reason = excluded.reject_reason");
    let changed = 0;
    for (const id of new Set(ids)) {
      if (!Number(update.run(status, id).changes)) continue;
      saveReason.run(id, reason);
      changed++;
    }
    db.exec("COMMIT");
    return changed;
  } finally {
    db.close();
  }
}
