import { joinRoom, leaveRoom, kickUser } from '../../../src/modules/users/users.service';
import { getRoom, _resetRooms, addUserToRoom } from '../../../src/modules/rooms/rooms.service';
import { initDb } from '../../../src/modules/rooms/rooms.repository';

beforeAll(() => initDb(':memory:'));
beforeEach(() => _resetRooms());

describe('joinRoom', () => {
  it('should join successfully with a new alias', () => {
    const result = joinRoom('lobby', 's1', 'Alice');
    expect(result.ok).toBe(true);
    expect(result.users).toContain('Alice');
    expect(result.you).toEqual({ id: 's1', alias: 'Alice' });
  });

  it('should reject duplicate alias', () => {
    joinRoom('lobby', 's1', 'Alice');
    const result = joinRoom('lobby', 's2', 'Alice');
    expect(result.ok).toBe(false);
    expect(result.code).toBe(4002);
  });

  it('should reject banned alias', () => {
    const room = getRoom('lobby');
    room.bans.set('Alice', Date.now() + 600_000);
    const result = joinRoom('lobby', 's1', 'Alice');
    expect(result.ok).toBe(false);
    expect(result.code).toBe(4010);
  });

  it('should allow expired ban', () => {
    const room = getRoom('lobby');
    room.bans.set('Alice', Date.now() - 1);
    const result = joinRoom('lobby', 's1', 'Alice');
    expect(result.ok).toBe(true);
  });
});

describe('leaveRoom', () => {
  it('should return alias on successful leave', () => {
    const room = getRoom('lobby');
    addUserToRoom(room, 's1', 'Alice');
    expect(leaveRoom(room, 's1')).toBe('Alice');
  });

  it('should return undefined for unknown socket', () => {
    const room = getRoom('lobby');
    expect(leaveRoom(room, 'nope')).toBeUndefined();
  });
});

describe('kickUser', () => {
  it('should kick and ban existing user', () => {
    const room = getRoom('lobby');
    addUserToRoom(room, 's1', 'Alice');
    const result = kickUser(room, 'Alice');
    expect(result.ok).toBe(true);
    expect(result.targetSocketId).toBe('s1');
    expect(room.bans.has('Alice')).toBe(true);
    expect(room.users.has('s1')).toBe(false);
  });

  it('should fail for non-existent user', () => {
    const room = getRoom('lobby');
    const result = kickUser(room, 'Ghost');
    expect(result.ok).toBe(false);
    expect(result.code).toBe(4301);
  });
});
