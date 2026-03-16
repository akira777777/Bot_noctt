const fs = require("fs");
const path = require("path");
const dotenv = require("dotenv");
const Database = require("better-sqlite3");

dotenv.config();

const defaultDbPath = path.join(process.cwd(), "data", "bot.sqlite");
const configuredPath = process.env.DB_PATH || defaultDbPath;
const dbPath = path.isAbsolute(configuredPath)
  ? configuredPath
  : path.resolve(process.cwd(), configuredPath);
const dbFileName = path.basename(dbPath);
const configuredBackupDir = process.env.BACKUP_DIR || "backups";
const backupsDir = path.isAbsolute(configuredBackupDir)
  ? configuredBackupDir
  : path.resolve(process.cwd(), configuredBackupDir);

function resolveBackupPath() {
  const fromArg = process.argv[2];
  if (fromArg) {
    return path.isAbsolute(fromArg)
      ? fromArg
      : path.resolve(process.cwd(), fromArg);
  }

  if (!fs.existsSync(backupsDir)) {
    throw new Error(`Backups directory does not exist: ${backupsDir}`);
  }

  const candidates = fs
    .readdirSync(backupsDir)
    .filter(
      (name) =>
        name.startsWith(`${dbFileName}.`) &&
        !name.endsWith("-wal") &&
        !name.endsWith("-shm"),
    )
    .sort((a, b) => b.localeCompare(a))
    .map((name) => path.join(backupsDir, name));

  if (candidates.length === 0) {
    throw new Error(`No backup files found for ${dbFileName} in ${backupsDir}`);
  }

  return candidates[0];
}

function checkBackup() {
  const backupPath = resolveBackupPath();
  if (!fs.existsSync(backupPath)) {
    throw new Error(`Backup file not found: ${backupPath}`);
  }

  const db = new Database(backupPath, { readonly: true, fileMustExist: true });
  try {
    const row = db.prepare("PRAGMA integrity_check").get();
    if (!row || row.integrity_check !== "ok") {
      throw new Error(`Integrity check failed: ${JSON.stringify(row)}`);
    }

    const tables = db
      .prepare(
        "SELECT COUNT(*) AS count FROM sqlite_master WHERE type = 'table'",
      )
      .get();

    console.log("Restore check passed.");
    console.log(`- backup: ${backupPath}`);
    console.log(`- tables: ${tables.count}`);
  } finally {
    db.close();
  }
}

checkBackup();
