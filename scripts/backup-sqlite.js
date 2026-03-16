const fs = require("fs");
const path = require("path");
const dotenv = require("dotenv");

dotenv.config();

const defaultDbPath = path.join(process.cwd(), "data", "bot.sqlite");
const configuredPath = process.env.DB_PATH || defaultDbPath;
const dbPath = path.isAbsolute(configuredPath)
  ? configuredPath
  : path.resolve(process.cwd(), configuredPath);

const configuredBackupDir = process.env.BACKUP_DIR || "backups";
const backupsDir = path.isAbsolute(configuredBackupDir)
  ? configuredBackupDir
  : path.resolve(process.cwd(), configuredBackupDir);

function parsePositiveInt(rawValue, fallback) {
  const parsed = Number.parseInt(rawValue ?? "", 10);
  if (Number.isNaN(parsed) || parsed <= 0) {
    return fallback;
  }

  return parsed;
}

const BACKUP_RETENTION = parsePositiveInt(process.env.BACKUP_RETENTION, 50);

function timestamp() {
  return new Date().toISOString().replace(/[:.]/g, "-");
}

function copyIfExists(sourcePath, destinationPath) {
  if (!fs.existsSync(sourcePath)) {
    return false;
  }

  fs.copyFileSync(sourcePath, destinationPath);
  return true;
}

function pruneOldBackups(dbFileName) {
  const baseBackups = fs
    .readdirSync(backupsDir)
    .filter(
      (name) =>
        name.startsWith(`${dbFileName}.`) &&
        !name.endsWith("-wal") &&
        !name.endsWith("-shm"),
    )
    .map((name) => path.join(backupsDir, name))
    .sort((a, b) => fs.statSync(b).mtimeMs - fs.statSync(a).mtimeMs);

  const toRemove = baseBackups.slice(BACKUP_RETENTION);
  let removedSets = 0;

  for (const baseFilePath of toRemove) {
    const relatedFiles = [
      baseFilePath,
      `${baseFilePath}-wal`,
      `${baseFilePath}-shm`,
    ];
    let removedAny = false;

    for (const filePath of relatedFiles) {
      if (fs.existsSync(filePath)) {
        fs.unlinkSync(filePath);
        removedAny = true;
      }
    }

    if (removedAny) {
      removedSets += 1;
    }
  }

  if (removedSets > 0) {
    console.log(`Pruned old backups. Removed sets: ${removedSets}`);
  }

  return {
    removedSets,
    keptSets: Math.min(baseBackups.length, BACKUP_RETENTION),
    totalSets: baseBackups.length - removedSets,
  };
}

function runBackup() {
  if (!fs.existsSync(dbPath)) {
    throw new Error(`Database file not found: ${dbPath}`);
  }

  fs.mkdirSync(backupsDir, { recursive: true });

  const stamp = timestamp();
  const dbFileName = path.basename(dbPath);

  const filesToCopy = [dbPath, `${dbPath}-wal`, `${dbPath}-shm`];
  const copied = [];

  for (const sourcePath of filesToCopy) {
    const suffix = sourcePath.slice(dbPath.length);
    const destinationPath = path.join(
      backupsDir,
      `${dbFileName}.${stamp}${suffix}`,
    );

    if (copyIfExists(sourcePath, destinationPath)) {
      copied.push(destinationPath);
    }
  }

  if (copied.length === 0) {
    throw new Error("No files were copied to backup.");
  }

  console.log(`Backup completed. Files copied: ${copied.length}`);
  for (const filePath of copied) {
    console.log(`- ${filePath}`);
  }

  const stats = pruneOldBackups(dbFileName);
  console.log(
    `Backup sets retained: ${stats.keptSets}/${BACKUP_RETENTION} (total now: ${stats.totalSets})`,
  );
}

runBackup();
