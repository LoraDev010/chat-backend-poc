import type { Room } from '../rooms/rooms.types.js';
import type { ChatMessage } from '../../shared/types/socket.types.js';
import type { ProcessMessageResult } from './chat.types.js';

/** Milisegundos mínimos entre mensajes consecutivos del mismo usuario. */
const RATE_LIMIT_MS = 2000;

/**
 * Valida y procesa un mensaje de chat entrante.
 *
 * Aplica un rate limit por usuario ({@link RATE_LIMIT_MS}) y construye
 * el {@link ChatMessage} que se transmitirá a la sala.
 *
 * @param room     - Sala a la que va dirigido el mensaje.
 * @param socketId - Socket ID del remitente.
 * @param text     - Texto del mensaje sin procesar (ya validado por esquema Zod).
 * @returns `{ ok: true, chatMessage }` en caso de éxito, o un resultado de error con
 *          código numérico si el usuario es desconocido (`4103`) o excedió el rate limit (`4102`).
 */
export function processMessage(room: Room, socketId: string, text: string): ProcessMessageResult {
  const user = room.users.get(socketId);
  if (!user) {
    return { ok: false, code: 4103, message: 'not_in_room' };
  }

  const now = Date.now();
  if (user.lastMessageAt && now - user.lastMessageAt < RATE_LIMIT_MS) {
    return { ok: false, code: 4102, message: 'rate_limited' };
  }

  user.lastMessageAt = now;

  const chatMessage: ChatMessage = {
    id: `${socketId}-${now}`,
    type: 'user',
    text,
    alias: user.alias,
    ts: now,
  };

  return { ok: true, chatMessage };
}

/** Milisegundos mínimos entre eventos de tipeo emitidos para el mismo usuario. */
const TYPING_THROTTLE_MS = 1000;

/**
 * Registra un evento de tipeo para un usuario y devuelve su alias si el evento
 * debe reenviarse a la sala (es decir, no está throttled).
 *
 * @param room     - Sala donde se está tipeando.
 * @param socketId - Socket ID del usuario que tipea.
 * @returns El alias del usuario cuando el evento debe transmitirse, o `undefined`
 *          cuando está limitado por throttle.
 */
export function processTyping(room: Room, socketId: string): string | undefined {
  const user = room.users.get(socketId);
  if (!user) return undefined;

  const now = Date.now();
  if (user.lastTypingAt && now - user.lastTypingAt < TYPING_THROTTLE_MS) return undefined;

  user.lastTypingAt = now;
  return user.alias;
}
