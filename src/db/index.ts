import { Database } from 'bun:sqlite';
import { drizzle } from 'drizzle-orm/bun-sqlite';
import * as schema from './schema';

const dbPath = Bun.env['DATABASE_URL'] || Bun.env['DB_PATH'] || 'sqlite.db';
const sqlite = new Database(dbPath);
export const db = drizzle(sqlite, { schema });
