import { processMessage, processTyping } from '../../../src/modules/chat/chat.service';
import type { Room } from '../../../src/modules/rooms/rooms.types';

function makeRoom(users: Record<string, { alias: string; lastMessageAt?: number; lastTypingAt?: number }>): Room {
  const room: Room = {
    id: 'test',
    name: 'test',
    code: '',
    ownedBy: 'system',
    users: new Map(),
    aliases: new Set(),
    bans: new Map(),
  };
  for (const [sid, u] of Object.entries(users)) {
    room.users.set(sid, {
      socketId: sid,
      alias: u.alias,
      joinedAt: Date.now(),
      lastMessageAt: u.lastMessageAt ?? 0,
      lastTypingAt: u.lastTypingAt ?? 0,
    });
    room.aliases.add(u.alias);
  }
  return room;
}

describe('processMessage', () => {
  it('should process a valid message', () => {
    const room = makeRoom({ s1: { alias: 'Alice' } });
    const result = processMessage(room, 's1', 'Hello');
    expect(result.ok).toBe(true);
    expect(result.chatMessage?.text).toBe('Hello');
    expect(result.chatMessage?.alias).toBe('Alice');
    expect(result.chatMessage?.type).toBe('user');
  });

  it('should reject unknown socket', () => {
    const room = makeRoom({});
    const result = processMessage(room, 'ghost', 'Hi');
    expect(result.ok).toBe(false);
    expect(result.code).toBe(4103);
  });

  it('should rate-limit rapid messages', () => {
    const room = makeRoom({ s1: { alias: 'Alice', lastMessageAt: Date.now() - 500 } });
    const result = processMessage(room, 's1', 'spam');
    expect(result.ok).toBe(false);
    expect(result.code).toBe(4102);
  });

  it('should allow message after rate limit expires', () => {
    const room = makeRoom({ s1: { alias: 'Alice', lastMessageAt: Date.now() - 3000 } });
    const result = processMessage(room, 's1', 'ok now');
    expect(result.ok).toBe(true);
  });
});

describe('processTyping', () => {
  it('should return alias when not throttled', () => {
    const room = makeRoom({ s1: { alias: 'Alice' } });
    expect(processTyping(room, 's1')).toBe('Alice');
  });

  it('should return undefined when throttled', () => {
    const room = makeRoom({ s1: { alias: 'Alice', lastTypingAt: Date.now() - 200 } });
    expect(processTyping(room, 's1')).toBeUndefined();
  });

  it('should return undefined for unknown socket', () => {
    const room = makeRoom({});
    expect(processTyping(room, 'ghost')).toBeUndefined();
  });

  it('should allow typing after throttle window', () => {
    const room = makeRoom({ s1: { alias: 'Alice', lastTypingAt: Date.now() - 2000 } });
    expect(processTyping(room, 's1')).toBe('Alice');
  });
});
