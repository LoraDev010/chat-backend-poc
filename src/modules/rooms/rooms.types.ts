export interface RoomUser {
  socketId: string;
  alias: string;
  joinedAt: number;
  lastMessageAt: number;
  lastTypingAt: number;
}

export interface Room {
  id: string;
  name: string;
  code: string;
  ownerAlias: string;
  users: Map<string, RoomUser>;
  aliases: Set<string>;
  bans: Map<string, number>;
}
