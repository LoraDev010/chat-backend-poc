import type { Room } from '../rooms/rooms.types.js';
import { getRoom, addUserToRoom, removeUserFromRoom, getRoomUserAliases, findUserByAlias } from '../rooms/rooms.service.js';
import type { JoinResult, KickResult } from './users.types.js';

/** Duración (ms) durante la cual un alias baneado no puede volver a unirse. */
const BAN_DURATION_MS = 10 * 60 * 1000;

/**
 * Maneja el flujo completo de unirse a una sala para un usuario que se conecta.
 *
 * Verifica los baneos activos y la disponibilidad del alias antes de agregar
 * al usuario al estado en memoria de la sala. La sala se crea de forma lazy
 * via {@link getRoom} si aún no existe.
 *
 * @param roomId   - ID de la sala destino.
 * @param socketId - Socket ID de la conexión que se une.
 * @param alias    - Nombre de display deseado.
 * @returns `JoinResult` con `ok: true` y la lista de usuarios actual en caso de éxito,
 *          o un resultado de error con códigos `4010` (baneado) / `4002` (alias ocupado).
 */
export function joinRoom(roomId: string, socketId: string, alias: string): JoinResult {
  const room = getRoom(roomId);

  if (room.bans.has(alias) && room.bans.get(alias)! > Date.now()) {
    return { ok: false, code: 4010, message: 'banned' };
  }

  if (room.aliases.has(alias)) {
    return { ok: false, code: 4002, message: 'alias taken' };
  }

  addUserToRoom(room, socketId, alias);

  return {
    ok: true,
    users: getRoomUserAliases(room),
    you: { id: socketId, alias },
  };
}

/**
 * Elimina un usuario de una sala cuando se desconecta o se va voluntariamente.
 *
 * @param room     - Sala de la que eliminar al usuario.
 * @param socketId - Socket ID del usuario que se va.
 * @returns El alias del usuario eliminado, o `undefined` si no se encontró.
 */
export function leaveRoom(room: Room, socketId: string): string | undefined {
  const user = removeUserFromRoom(room, socketId);
  return user?.alias;
}

/**
 * Expulsa a un usuario por alias, lo desconecta y aplica un ban temporal para
 * que no pueda volver a unirse inmediatamente.
 *
 * @param room        - Sala donde se ejecuta la expulsión.
 * @param targetAlias - Alias del usuario a expulsar.
 * @returns `KickResult & { targetSocketId }` en caso de éxito para que el gateway
 *          pueda desconectar el socket específico, o un resultado de error (`4301`)
 *          si el alias no se encuentra en la sala.
 */
export function kickUser(room: Room, targetAlias: string): KickResult & { targetSocketId?: string } {
  const found = findUserByAlias(room, targetAlias);
  if (!found) {
    return { ok: false, code: 4301, message: 'user not found' };
  }

  room.bans.set(targetAlias, Date.now() + BAN_DURATION_MS);
  removeUserFromRoom(room, found.socketId);

  return { ok: true, targetSocketId: found.socketId };
}
