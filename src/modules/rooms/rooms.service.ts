import Database from 'better-sqlite3';
import type { Room, RoomUser } from './rooms.types.js';

/** SQLite database instance — initialized via initDb(). */
let db: InstanceType<typeof Database> | null = null;

/** Runtime state — users, aliases, bans. Lost on restart (intentional). */
const rooms = new Map<string, Room>();

interface RoomRow {
  id: string;
  name: string;
  code: string;
  ownerAlias: string;
}

/**
 * Initializes the SQLite database and creates the rooms table if it does not exist.
 * Call this once at server startup. Accepts ':memory:' for in-memory (tests).
 *
 * @param path - File path or ':memory:' for an in-memory database.
 */
export function initDb(path: string = './rooms.db'): void {
  db = new Database(path);
  db.exec(`
    CREATE TABLE IF NOT EXISTS rooms (
      id        TEXT PRIMARY KEY,
      name      TEXT NOT NULL,
      code      TEXT UNIQUE NOT NULL,
      ownerAlias TEXT NOT NULL
    )
  `);
}

function getDb(): InstanceType<typeof Database> {
  if (!db) throw new Error('Database not initialized. Call initDb() first.');
  return db;
}

/** @internal Only for tests — clears both the runtime Map and the SQLite table. */
export function _resetRooms(): void {
  rooms.clear();
  if (db) {
    db.exec('DELETE FROM rooms');
  }
}

/**
 * Returns the room with the given ID, creating it in-memory only if it does not exist.
 * Used for legacy "lobby"-style rooms that are not persisted to SQLite.
 */
export function getRoom(roomId: string): Room {
  if (!rooms.has(roomId)) {
    rooms.set(roomId, {
      id: roomId,
      name: roomId,
      code: '',
      ownerAlias: 'system',
      users: new Map(),
      aliases: new Set(),
      bans: new Map(),
    });
  }
  return rooms.get(roomId)!;
}

/**
 * Generates a unique 6-character alphanumeric code, checking both the runtime Map
 * and the SQLite database to ensure uniqueness across server restarts.
 */
function generateUniqueCode(): string {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  const db = getDb();
  const stmt = db.prepare('SELECT id FROM rooms WHERE code = ?');
  let code: string;
  do {
    code = Array.from({ length: 6 }, () => chars[Math.floor(Math.random() * chars.length)]).join('');
  } while (stmt.get(code) !== undefined);
  return code;
}

/**
 * Creates a new room, persisting its metadata to SQLite and adding runtime state to the Map.
 *
 * @param name       - Room name.
 * @param ownerAlias - Alias of the user creating the room.
 * @returns The newly created {@link Room}.
 */
export function createRoom(name: string, ownerAlias: string): Room {
  const id = `room-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
  const code = generateUniqueCode();
  getDb().prepare('INSERT INTO rooms (id, name, code, ownerAlias) VALUES (?, ?, ?, ?)').run(id, name, code, ownerAlias);
  const room: Room = {
    id,
    name,
    code,
    ownerAlias,
    users: new Map(),
    aliases: new Set(),
    bans: new Map(),
  };
  rooms.set(id, room);
  return room;
}

/**
 * Deletes a room from both the runtime Map and SQLite.
 *
 * @param roomId - ID of the room to delete.
 * @returns The deleted {@link Room}, or `undefined` if it was not found.
 */
export function deleteRoom(roomId: string): Room | undefined {
  const room = rooms.get(roomId);
  rooms.delete(roomId);
  getDb().prepare('DELETE FROM rooms WHERE id = ?').run(roomId);
  return room;
}

/**
 * Finds a room by its 6-character code.
 * Checks the runtime Map first; if not found, hydrates from SQLite (lazy load).
 *
 * @param code - 6-character alphanumeric room code.
 * @returns The {@link Room} or `undefined` if not found.
 */
export function findRoomByCode(code: string): Room | undefined {
  for (const room of rooms.values()) {
    if (room.code === code) return room;
  }
  const row = getDb().prepare('SELECT id, name, code, ownerAlias FROM rooms WHERE code = ?').get(code) as RoomRow | undefined;
  if (!row) return undefined;
  const room: Room = {
    id: row.id,
    name: row.name,
    code: row.code,
    ownerAlias: row.ownerAlias,
    users: new Map(),
    aliases: new Set(),
    bans: new Map(),
  };
  rooms.set(row.id, room);
  return room;
}

/**
 * Returns all rooms owned by the given alias, merging SQLite metadata with runtime state.
 * After a server restart, returned rooms have empty runtime state (users/aliases/bans).
 *
 * @param ownerAlias - The alias to look up.
 * @returns Array of {@link Room} owned by the given alias.
 */
export function listRoomsByOwner(ownerAlias: string): Room[] {
  const rows = getDb().prepare('SELECT id, name, code, ownerAlias FROM rooms WHERE ownerAlias = ?').all(ownerAlias) as RoomRow[];
  return rows.map((row) => {
    const runtime = rooms.get(row.id);
    if (runtime) return runtime;
    return {
      id: row.id,
      name: row.name,
      code: row.code,
      ownerAlias: row.ownerAlias,
      users: new Map(),
      aliases: new Set(),
      bans: new Map(),
    };
  });
}

/**
 * Finds a room by ID without creating it.
 * Checks the runtime Map first; if not found, hydrates from SQLite.
 *
 * @param roomId - Room ID.
 * @returns The {@link Room} or `undefined` if not found.
 */
export function findRoom(roomId: string): Room | undefined {
  const room = rooms.get(roomId);
  if (room) return room;
  const row = db?.prepare('SELECT id, name, code, ownerAlias FROM rooms WHERE id = ?').get(roomId) as RoomRow | undefined;
  if (!row) return undefined;
  const hydrated: Room = {
    id: row.id,
    name: row.name,
    code: row.code,
    ownerAlias: row.ownerAlias,
    users: new Map(),
    aliases: new Set(),
    bans: new Map(),
  };
  rooms.set(row.id, hydrated);
  return hydrated;
}

/**
 * Returns the list of aliases of all users currently in the room.
 *
 * @param room - The room to query.
 * @returns Array of alias strings.
 */
export function getRoomUserAliases(room: Room): string[] {
  return Array.from(room.users.values()).map((u) => u.alias);
}

/**
 * Finds a user in a room by their display alias.
 *
 * @param room  - Room to search.
 * @param alias - Alias to look for.
 * @returns Object with `socketId` and `user`, or `undefined` if not found.
 */
export function findUserByAlias(room: Room, alias: string): { socketId: string; user: RoomUser } | undefined {
  for (const [sid, u] of room.users.entries()) {
    if (u.alias === alias) return { socketId: sid, user: u };
  }
  return undefined;
}

/**
 * Adds a new user to a room and registers their alias.
 *
 * @param room     - Target room.
 * @param socketId - Socket.io connection ID of the joining user.
 * @param alias    - Chosen display name.
 * @returns The created {@link RoomUser} record.
 */
export function addUserToRoom(room: Room, socketId: string, alias: string): RoomUser {
  const user: RoomUser = {
    socketId,
    alias,
    joinedAt: Date.now(),
    lastMessageAt: 0,
    lastTypingAt: 0,
  };
  room.users.set(socketId, user);
  room.aliases.add(alias);
  return user;
}

/**
 * Removes a user from a room by socket ID, freeing their alias.
 *
 * @param room     - Room the user belongs to.
 * @param socketId - Socket ID of the user to remove.
 * @returns The removed {@link RoomUser}, or `undefined` if not found.
 */
export function removeUserFromRoom(room: Room, socketId: string): RoomUser | undefined {
  const user = room.users.get(socketId);
  if (user) {
    room.aliases.delete(user.alias);
    room.users.delete(socketId);
  }
  return user;
}

 * Devuelve la lista de aliases de todos los usuarios actualmente en la sala.
 *
 * @param room - La sala a consultar.
 * @returns Array de strings con los aliases.
 */
export function getRoomUserAliases(room: Room): string[] {
  return Array.from(room.users.values()).map((u) => u.alias);
}

/**
 * Busca un usuario en una sala por su alias de display.
 *
 * @param room  - Sala donde buscar.
 * @param alias - Alias a buscar.
 * @returns Objeto con `socketId` y `user`, o `undefined` si no se encontró.
 */
export function findUserByAlias(room: Room, alias: string): { socketId: string; user: RoomUser } | undefined {
  for (const [sid, u] of room.users.entries()) {
    if (u.alias === alias) return { socketId: sid, user: u };
  }
  return undefined;
}
