import type { Room, RoomUser } from './rooms.types.js';
import {
  insertRoom,
  deleteRoomRow,
  findRoomRowById,
  findRoomRowByCode,
  listRoomRowsByOwner,
  codeExistsInDb,
  findRoomByNameAndOwner,
  _truncateRooms,
} from './rooms.repository.js';

/** Estado en memoria — usuarios, aliases, bans. Se pierde al reiniciar. */
const rooms = new Map<string, Room>();

/** Solo para tests — limpia el Map en memoria y la tabla SQLite. */
export function _resetRooms(): void {
  rooms.clear();
  _truncateRooms();
}

/** Hidrata un row de SQLite a un Room con estado runtime vacío. */
function hydrateRoom(row: { id: string; name: string; code: string; ownerAlias: string }): Room {
  return {
    id: row.id,
    name: row.name,
    code: row.code,
    ownerAlias: row.ownerAlias,
    users: new Map(),
    aliases: new Set(),
    bans: new Map(),
  };
}

/**
 * Devuelve la sala con el ID dado, creándola solo en memoria si no existe.
 * Se usa para salas "lobby" legacy que no se persisten.
 */
export function getRoom(roomId: string): Room {
  if (!rooms.has(roomId)) {
    rooms.set(roomId, hydrateRoom({ id: roomId, name: roomId, code: '', ownerAlias: 'system' }));
  }
  return rooms.get(roomId)!;
}

/**
 * Genera un código alfanumérico único de 6 caracteres,
 * verificando tanto el Map runtime como SQLite.
 */
function generateUniqueCode(): string {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  let code: string;
  do {
    code = Array.from({ length: 6 }, () => chars[Math.floor(Math.random() * chars.length)]).join('');
  } while (codeExistsInDb(code));
  return code;
}

/**
 * Crea una sala nueva, la persiste en SQLite y la agrega al estado runtime.
 *
 * @param name       - Nombre de la sala.
 * @param ownerAlias - Alias del creador.
 * @throws {Error} Si el usuario ya tiene una sala con ese nombre.
 */
export function createRoom(name: string, ownerAlias: string): Room {
  // Validar que el usuario no tenga ya una sala con ese nombre
  const existingRoom = findRoomByNameAndOwner(name, ownerAlias);
  if (existingRoom) {
    throw new Error(`Ya tienes una sala activa con el nombre "${name}"`);
  }

  const id = `room-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
  const code = generateUniqueCode();

  insertRoom({ id, name, code, ownerAlias });

  const room = hydrateRoom({ id, name, code, ownerAlias });
  rooms.set(id, room);
  return room;
}

/**
 * Elimina una sala del Map runtime y de SQLite.
 *
 * @returns La sala eliminada, o `undefined` si no existía.
 */
export function deleteRoom(roomId: string): Room | undefined {
  const room = rooms.get(roomId);
  rooms.delete(roomId);
  deleteRoomRow(roomId);
  return room;
}

/**
 * Busca una sala por su código de 6 caracteres.
 * Primero busca en memoria; si no la encuentra, hidrata desde SQLite.
 */
export function findRoomByCode(code: string): Room | undefined {
  for (const room of rooms.values()) {
    if (room.code === code) return room;
  }

  const row = findRoomRowByCode(code);
  if (!row) return undefined;

  const room = hydrateRoom(row);
  rooms.set(row.id, room);
  return room;
}

/**
 * Devuelve todas las salas de un owner, mezclando estado runtime con SQLite.
 * Tras un reinicio, las salas devueltas tienen estado runtime vacío.
 */
export function listRoomsByOwner(ownerAlias: string): Room[] {
  const rows = listRoomRowsByOwner(ownerAlias);
  return rows.map((row) => {
    const runtime = rooms.get(row.id);
    if (runtime) return runtime;
    return hydrateRoom(row);
  });
}

/**
 * Busca una sala por ID sin crearla.
 * Primero busca en memoria; si no la encuentra, hidrata desde SQLite.
 */
export function findRoom(roomId: string): Room | undefined {
  const room = rooms.get(roomId);
  if (room) return room;

  const row = findRoomRowById(roomId);
  if (!row) return undefined;

  const hydrated = hydrateRoom(row);
  rooms.set(row.id, hydrated);
  return hydrated;
}

/** Devuelve la lista de aliases de los usuarios actualmente en la sala. */
export function getRoomUserAliases(room: Room): string[] {
  return Array.from(room.users.values()).map((u) => u.alias);
}

/** Busca un usuario en una sala por su alias. */
export function findUserByAlias(room: Room, alias: string): { socketId: string; user: RoomUser } | undefined {
  for (const [sid, u] of room.users.entries()) {
    if (u.alias === alias) return { socketId: sid, user: u };
  }
  return undefined;
}

/** Agrega un usuario a una sala y registra su alias. */
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

/** Elimina un usuario de una sala por socket ID, liberando su alias. */
export function removeUserFromRoom(room: Room, socketId: string): RoomUser | undefined {
  const user = room.users.get(socketId);
  if (user) {
    room.aliases.delete(user.alias);
    room.users.delete(socketId);
  }
  return user;
}

/**
 * Obtiene todas las salas relevantes para un usuario:
 * - Salas donde está actualmente conectado (socket.rooms)
 * - Salas que ha creado (owner), aunque no esté conectado
 * @param socketRooms - Set de room IDs del socket (socket.rooms)
 * @param socketId - ID del socket para excluir
 * @param ownerAlias - Alias del usuario para buscar salas creadas
 * @returns Array de información de salas con flag isOwner e isActive
 */
export function getSocketRooms(
  socketRooms: Set<string>, 
  socketId: string, 
  ownerAlias?: string
): Array<{ id: string; name: string; code: string; userCount: number; isOwner: boolean; isActive: boolean }> {
  const result = new Map<string, { id: string; name: string; code: string; userCount: number; isOwner: boolean; isActive: boolean }>();
  
  // 1. Agregar salas donde el socket está actualmente conectado
  for (const roomId of socketRooms) {
    if (roomId === socketId) continue; // Excluir el room personal del socket
    
    const room = findRoom(roomId);
    if (room) {
      result.set(roomId, {
        id: room.id,
        name: room.name,
        code: room.code,
        userCount: room.users.size,
        isOwner: ownerAlias ? room.ownerAlias === ownerAlias : false,
        isActive: true,
      });
    }
  }
  
  // 2. Agregar salas que el usuario ha creado (aunque no esté conectado)
  if (ownerAlias) {
    const ownedRooms = listRoomsByOwner(ownerAlias);
    for (const room of ownedRooms) {
      if (!result.has(room.id)) {
        // Solo agregar si no está ya en el resultado (no está activo en ella)
        result.set(room.id, {
          id: room.id,
          name: room.name,
          code: room.code,
          userCount: room.users.size,
          isOwner: true,
          isActive: false,
        });
      }
    }
  }
  
  return Array.from(result.values());
}

/**
 * Verifica si una sala está vacía y la elimina si es necesario.
 * @param roomId - ID de la sala a verificar
 * @returns true si la sala fue eliminada, false si no
 */
export function cleanupEmptyRoom(roomId: string): boolean {
  const room = findRoom(roomId);
  if (room && room.users.size === 0) {
    deleteRoom(roomId);
    return true;
  }
  return false;
}

