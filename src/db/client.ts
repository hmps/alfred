import { Database } from 'bun:sqlite';
import { ALFRED_DB_PATH } from '../paths';
import { SCHEMA } from './schema';

let db: Database | null = null;
let currentDbPath: string | null = null;

export function getDb(dbPath: string = ALFRED_DB_PATH): Database {
  if (!db || currentDbPath !== dbPath) {
    if (db) {
      db.close();
    }
    db = new Database(dbPath);
    db.exec('PRAGMA journal_mode = WAL');
    db.exec('PRAGMA foreign_keys = ON');
    currentDbPath = dbPath;
  }
  return db;
}

export function initDb(dbPath: string = ALFRED_DB_PATH): void {
  const database = getDb(dbPath);
  database.exec(SCHEMA);
}

export function closeDb(): void {
  if (db) {
    db.close();
    db = null;
    currentDbPath = null;
  }
}

export function resetDbConnection(): void {
  if (db) {
    db.close();
  }
  db = null;
  currentDbPath = null;
}
