export interface ChatMessage {
  id: string;
  type: 'user' | 'system';
  text: string;
  alias: string;
  ts: number;
}

export interface JoinRoomDTO {
  room: string;
  alias: string;
}

export interface MessageDTO {
  room: string;
  text: string;
}

export interface TypingDTO {
  room: string;
}

export interface KickDTO {
  room: string;
  targetAlias: string;
}

export interface LeaveRoomDTO {
  room: string;
}

export interface JoinAck {
  ok: boolean;
  code?: number;
  message?: string;
  users?: string[];
  you?: { id: string; alias: string };
  roomId?: string;
  roomName?: string;
}

export interface SimpleAck {
  ok: boolean;
  code?: number;
  message?: string;
}

export interface ServerToClientEvents {
  message: (msg: ChatMessage) => void;
  user_joined: (data: { alias: string; id: string }) => void;
  user_left: (data: { alias: string; id: string }) => void;
  typing: (data: { alias: string }) => void;
  user_kicked: (data: { alias: string; by: string; durationMinutes: number }) => void;
  room_deleted: (data: { roomId: string; name: string }) => void;
}

export interface ClientToServerEvents {
  join_room: (data: JoinRoomDTO, ack: (res: JoinAck) => void) => void;
  leave_room: (data: LeaveRoomDTO) => void;
  message: (data: MessageDTO, ack: (res: SimpleAck) => void) => void;
  typing: (data: TypingDTO) => void;
  kick_user: (data: KickDTO, ack: (res: SimpleAck) => void) => void;
  create_room: (data: CreateRoomDTO, ack: (res: CreateRoomAck) => void) => void;
  join_room_by_code: (data: JoinByCodeDTO, ack: (res: JoinAck) => void) => void;
  delete_room: (data: DeleteRoomDTO, ack: (res: SimpleAck) => void) => void;
  list_my_rooms: (data: { alias?: string }, ack: (res: ListRoomsAck) => void) => void;
}

export interface InterServerEvents {}

export interface SocketData {
  alias?: string;
  room?: string;
}

// Room management DTOs
export interface CreateRoomDTO {
  name: string;
  alias: string;
}

export interface JoinByCodeDTO {
  code: string;
  alias: string;
}

export interface DeleteRoomDTO {
  roomId: string;
  alias: string;
}

export interface RoomInfo {
  id: string;
  name: string;
  code: string;
  userCount: number;
  isOwner: boolean;
  isActive: boolean;
}

export interface CreateRoomAck {
  ok: boolean;
  code?: number;
  message?: string;
  roomId?: string;
  roomCode?: string;
  roomName?: string;
}

export interface ListRoomsAck {
  ok: boolean;
  rooms?: RoomInfo[];
}
