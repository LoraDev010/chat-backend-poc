import Database from 'better-sqlite3';
import { drizzle, BetterSQLite3Database } from 'drizzle-orm/better-sqlite3';
import * as schema from './schema.js';

let db: BetterSQLite3Database<typeof schema> | null = null;
let sqlite: InstanceType<typeof Database> | null = null;

/**
 * Inicializa la conexión a SQLite y aplica el schema.
 * Llamar una sola vez al arrancar el servidor.
 *
 * @param path - Ruta al archivo SQLite o ':memory:' para tests.
 */
export function initDatabase(path: string = './rooms.db'): void {
  sqlite = new Database(path);

  sqlite.exec(`
    CREATE TABLE IF NOT EXISTS rooms (
      id         TEXT PRIMARY KEY,
      name       TEXT NOT NULL,
      code       TEXT UNIQUE NOT NULL,
      ownerAlias TEXT NOT NULL
    )
  `);

  db = drizzle(sqlite, { schema });
}

/**
 * Devuelve la instancia de Drizzle.
 * Lanza si no se llamó a `initDatabase` antes.
 */
export function getDatabase(): BetterSQLite3Database<typeof schema> {
  if (!db) throw new Error('Database not initialized. Call initDatabase() first.');
  return db;
}

/**
 * Devuelve la conexión raw de better-sqlite3.
 * Útil para operaciones de bajo nivel como truncar tablas en tests.
 */
export function getRawDatabase(): InstanceType<typeof Database> {
  if (!sqlite) throw new Error('Database not initialized. Call initDatabase() first.');
  return sqlite;
}
