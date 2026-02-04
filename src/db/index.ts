import { Database } from 'bun:sqlite';
import { drizzle } from 'drizzle-orm/bun-sqlite';
import * as schema from './schema';

function getDbPath(): string {
  return process.env['DB_PATH'] || process.env['DATABASE_URL'] || './data/sqlite.db';
}

const sqlite = new Database(getDbPath());
export const db = drizzle(sqlite, { schema });
