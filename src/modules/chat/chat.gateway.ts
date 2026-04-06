import type { Server, Socket } from 'socket.io';
import type {
  ServerToClientEvents,
  ClientToServerEvents,
  InterServerEvents,
  SocketData,
} from '../../shared/types/socket.types.js';
import { findRoom, removeUserFromRoom, createRoom, deleteRoom, findRoomByCode, listRoomsByOwner, addUserToRoom } from '../rooms/rooms.service.js';
import * as usersService from '../users/users.service.js';
import * as chatService from './chat.service.js';
import { joinRoomSchema, kickUserSchema } from '../users/users.schemas.js';
import { messageSchema, typingSchema } from './chat.schemas.js';
import { createRoomSchema, joinByCodeSchema, deleteRoomSchema } from '../rooms/rooms.schemas.js';

type TypedIO = Server<ClientToServerEvents, ServerToClientEvents, InterServerEvents, SocketData>;
type TypedSocket = Socket<ClientToServerEvents, ServerToClientEvents, InterServerEvents, SocketData>;

/**
 * Registers all Socket.io event handlers for the chat feature.
 *
 * @param io - The fully-typed Socket.io server instance.
 */
export function registerChatHandlers(io: TypedIO): void {
  io.on('connection', (socket: TypedSocket) => {

    socket.on('typing', (payload) => {
      const parsed = typingSchema.safeParse(payload);
      if (!parsed.success) return;
      const { room } = parsed.data;
      const r = findRoom(room);
      if (!r) return;
      const alias = chatService.processTyping(r, socket.id);
      if (alias) {
        socket.to(room).emit('typing', { alias });
      }
    });

    socket.on('join_room', (payload, ack) => {
      const parsed = joinRoomSchema.safeParse(payload);
      if (!parsed.success) {
        return ack?.({ ok: false, code: 4003, message: parsed.error.issues[0]?.message || 'invalid input' });
      }
      const { room, alias } = parsed.data;
      const result = usersService.joinRoom(room, socket.id, alias);
      if (!result.ok) {
        return ack?.(result);
      }
      socket.join(room);
      ack?.(result);
      io.to(room).emit('user_joined', { alias, id: socket.id });
    });

    socket.on('leave_room', (payload) => {
      const { room } = payload || {};
      const r = findRoom(room);
      if (!r) return;
      const alias = usersService.leaveRoom(r, socket.id);
      if (alias) {
        socket.leave(room);
        io.to(room).emit('user_left', { alias, id: socket.id });
      }
    });

    socket.on('message', (payload, ack) => {
      const parsed = messageSchema.safeParse(payload);
      if (!parsed.success) {
        const firstIssue = parsed.error.issues[0];
        const code = firstIssue?.message === 'too_long' ? 4101 : 4104;
        return ack?.({ ok: false, code, message: firstIssue?.message || 'invalid' });
      }
      const { room, text } = parsed.data;
      const r = findRoom(room);
      if (!r) return ack?.({ ok: false, code: 4103, message: 'not_in_room' });

      const result = chatService.processMessage(r, socket.id, text);
      if (!result.ok) return ack?.(result);

      io.to(room).emit('message', result.chatMessage!);
      ack?.({ ok: true });
    });

    socket.on('kick_user', (payload, ack) => {
      const parsed = kickUserSchema.safeParse(payload);
      if (!parsed.success) {
        return ack?.({ ok: false, code: 4301, message: 'invalid input' });
      }
      const { room, targetAlias } = parsed.data;
      const r = findRoom(room);
      if (!r) return ack?.({ ok: false, code: 4301, message: 'room not found' });

      const result = usersService.kickUser(r, targetAlias);
      if (!result.ok) return ack?.(result);

      const targetSocket = io.sockets.sockets.get(result.targetSocketId!);
      if (targetSocket) {
        targetSocket.leave(room);
        targetSocket.emit('user_kicked', { alias: targetAlias, by: 'moderator', durationMinutes: 10 });
        try { targetSocket.disconnect(true); } catch (_) {}
      }

      io.to(room).emit('user_kicked', { alias: targetAlias, by: 'moderator', durationMinutes: 10 });
      ack?.({ ok: true });
    });

    socket.on('create_room', (payload, ack) => {
      const parsed = createRoomSchema.safeParse(payload);
      if (!parsed.success) {
        return ack?.({ ok: false, code: 4200, message: parsed.error.issues[0]?.message || 'invalid input' });
      }
      const { name, alias } = parsed.data;

      // Enforce 3-owned-rooms limit (owned = created by this alias)
      const owned = listRoomsByOwner(alias);
      if (owned.length >= 3) {
        return ack?.({ ok: false, code: 4203, message: 'room_limit_reached' });
      }

      // Persist alias on this socket for stable ownership lookups
      socket.data.alias = alias;

      const room = createRoom(name, alias);
      socket.join(room.id);
      addUserToRoom(room, socket.id, alias);
      ack?.({ ok: true, roomId: room.id, roomCode: room.code });
    });

    socket.on('join_room_by_code', (payload, ack) => {
      const parsed = joinByCodeSchema.safeParse(payload);
      if (!parsed.success) {
        return ack?.({ ok: false, code: 4200, message: parsed.error.issues[0]?.message || 'invalid input' });
      }
      const { code, alias } = parsed.data;
      const room = findRoomByCode(code);
      if (!room) {
        return ack?.({ ok: false, code: 4201, message: 'room_not_found' });
      }
      if (socket.rooms.has(room.id)) {
        return ack?.({ ok: false, code: 4202, message: 'already_joined' });
      }

      // Persist alias on this socket for stable ownership lookups
      socket.data.alias = alias;

      const result = usersService.joinRoom(room.id, socket.id, alias);
      if (!result.ok) {
        return ack?.(result);
      }
      socket.join(room.id);
      ack?.({ ...result, roomId: room.id, roomName: room.name });
      io.to(room.id).emit('user_joined', { alias, id: socket.id });
    });

    socket.on('delete_room', (payload, ack) => {
      const parsed = deleteRoomSchema.safeParse(payload);
      if (!parsed.success) {
        return ack?.({ ok: false, code: 4400, message: 'invalid input' });
      }
      const { roomId } = parsed.data;
      const room = findRoom(roomId);
      if (!room) {
        return ack?.({ ok: false, code: 4401, message: 'room_not_found' });
      }

      // Use socket.data.alias (set during create/join) or fallback to payload alias
      const ownerAlias = socket.data.alias ?? (payload as Record<string, string>).alias;
      if (room.ownerAlias !== ownerAlias) {
        return ack?.({ ok: false, code: 4401, message: 'not_owner' });
      }

      const deleted = deleteRoom(roomId);
      if (deleted) {
        io.to(roomId).emit('room_deleted', { roomId, name: deleted.name });
        io.in(roomId).socketsLeave(roomId);
      }
      ack?.({ ok: true });
    });

    socket.on('list_my_rooms', (data, ack) => {
      const alias = socket.data.alias ?? data?.alias;
      if (!alias) return ack?.({ ok: true, rooms: [] });
      const myRooms = listRoomsByOwner(alias).map((r) => ({
        id: r.id,
        name: r.name,
        code: r.code,
        userCount: r.users.size,
      }));
      ack?.({ ok: true, rooms: myRooms });
    });

    socket.on('disconnecting', () => {
      for (const room of socket.rooms) {
        if (room === socket.id) continue;
        const r = findRoom(room);
        if (!r) continue;
        const user = removeUserFromRoom(r, socket.id);
        if (user) {
          io.to(room).emit('user_left', { alias: user.alias, id: socket.id });
        }
      }
    });
  });
}

