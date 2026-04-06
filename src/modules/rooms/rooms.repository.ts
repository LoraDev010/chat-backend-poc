import { eq } from 'drizzle-orm';
import { rooms } from '../../config/database/schema.js';
import { initDatabase, getDatabase, getRawDatabase } from '../../config/database/client.js';

export interface RoomRow {
  id: string;
  name: string;
  code: string;
  ownerAlias: string;
}

/**
 * Inicializa la base de datos SQLite y crea la tabla de salas si no existe.
 * Llamar una sola vez al arrancar el servidor.
 *
 * @param path - Ruta al archivo SQLite o ':memory:' para tests.
 */
export function initDb(path: string = './rooms.db'): void {
  initDatabase(path);
}

/** Inserta una sala en la base de datos. */
export function insertRoom(row: RoomRow): void {
  getDatabase().insert(rooms).values(row).run();
}

/** Elimina una sala por ID. */
export function deleteRoomRow(roomId: string): void {
  getDatabase().delete(rooms).where(eq(rooms.id, roomId)).run();
}

/** Busca una sala por ID. */
export function findRoomRowById(roomId: string): RoomRow | undefined {
  return getDatabase()
    .select()
    .from(rooms)
    .where(eq(rooms.id, roomId))
    .get();
}

/** Busca una sala por su código de 6 caracteres. */
export function findRoomRowByCode(code: string): RoomRow | undefined {
  return getDatabase()
    .select()
    .from(rooms)
    .where(eq(rooms.code, code))
    .get();
}

/** Devuelve todas las salas de un owner. */
export function listRoomRowsByOwner(ownerAlias: string): RoomRow[] {
  return getDatabase()
    .select()
    .from(rooms)
    .where(eq(rooms.ownerAlias, ownerAlias))
    .all();
}

/** Verifica si un código ya existe en la base de datos. */
export function codeExistsInDb(code: string): boolean {
  const row = getDatabase()
    .select({ id: rooms.id })
    .from(rooms)
    .where(eq(rooms.code, code))
    .get();
  return row !== undefined;
}

/** Busca una sala por nombre y owner. */
export function findRoomByNameAndOwner(name: string, ownerAlias: string): RoomRow | undefined {
  return getDatabase()
    .select()
    .from(rooms)
    .where(eq(rooms.name, name))
    .all()
    .find(room => room.ownerAlias === ownerAlias);
}

/** Borra todos los registros de la tabla rooms. Solo para tests. */
export function _truncateRooms(): void {
  getRawDatabase().exec('DELETE FROM rooms');
}
