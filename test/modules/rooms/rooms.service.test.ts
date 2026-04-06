import {
  getRoom,
  findRoom,
  addUserToRoom,
  removeUserFromRoom,
  getRoomUserAliases,
  findUserByAlias,
  _resetRooms,
  createRoom,
  deleteRoom,
  findRoomByCode,
  listRoomsByOwner,
} from '../../../src/modules/rooms/rooms.service';
import { initDb } from '../../../src/modules/rooms/rooms.repository';

beforeAll(() => initDb(':memory:'));
beforeEach(() => _resetRooms());

describe('getRoom', () => {
  it('should create a new room when it does not exist', () => {
    const room = getRoom('lobby');
    expect(room.id).toBe('lobby');
    expect(room.users.size).toBe(0);
    expect(room.aliases.size).toBe(0);
    expect(room.bans.size).toBe(0);
  });

  it('should return same room on repeated calls', () => {
    const a = getRoom('lobby');
    const b = getRoom('lobby');
    expect(a).toBe(b);
  });
});

describe('findRoom', () => {
  it('should return undefined for non-existent room', () => {
    expect(findRoom('ghost')).toBeUndefined();
  });

  it('should return existing room', () => {
    getRoom('lobby');
    expect(findRoom('lobby')).toBeDefined();
  });
});

describe('addUserToRoom / removeUserFromRoom', () => {
  it('should add a user and register alias', () => {
    const room = getRoom('r1');
    const user = addUserToRoom(room, 'sock1', 'Alice');
    expect(user.socketId).toBe('sock1');
    expect(user.alias).toBe('Alice');
    expect(room.users.has('sock1')).toBe(true);
    expect(room.aliases.has('Alice')).toBe(true);
  });

  it('should remove user and free alias', () => {
    const room = getRoom('r1');
    addUserToRoom(room, 'sock1', 'Alice');
    const removed = removeUserFromRoom(room, 'sock1');
    expect(removed?.alias).toBe('Alice');
    expect(room.users.size).toBe(0);
    expect(room.aliases.has('Alice')).toBe(false);
  });

  it('should return undefined when removing non-existent user', () => {
    const room = getRoom('r1');
    expect(removeUserFromRoom(room, 'nope')).toBeUndefined();
  });
});

describe('getRoomUserAliases', () => {
  it('should return all aliases', () => {
    const room = getRoom('r1');
    addUserToRoom(room, 's1', 'Alice');
    addUserToRoom(room, 's2', 'Bob');
    expect(getRoomUserAliases(room).sort()).toEqual(['Alice', 'Bob']);
  });

  it('should return empty array for empty room', () => {
    expect(getRoomUserAliases(getRoom('empty'))).toEqual([]);
  });
});

describe('findUserByAlias', () => {
  it('should find user by alias', () => {
    const room = getRoom('r1');
    addUserToRoom(room, 's1', 'Alice');
    const found = findUserByAlias(room, 'Alice');
    expect(found?.socketId).toBe('s1');
    expect(found?.user.alias).toBe('Alice');
  });

  it('should return undefined for unknown alias', () => {
    const room = getRoom('r1');
    expect(findUserByAlias(room, 'Nobody')).toBeUndefined();
  });
});

describe('createRoom', () => {
  it('should create a room with a unique 6-char uppercase code', () => {
    const room = createRoom('TestRoom', 'owner1');
    expect(room.name).toBe('TestRoom');
    expect(room.ownerAlias).toBe('owner1');
    expect(room.code).toMatch(/^[A-Z0-9]{6}$/);
    expect(room.users.size).toBe(0);
  });

  it('should generate unique codes for multiple rooms', () => {
    const rooms = Array.from({ length: 5 }, (_, i) => createRoom(`Room${i}`, 'owner'));
    const codes = rooms.map((r) => r.code);
    const unique = new Set(codes);
    expect(unique.size).toBe(5);
  });

  it('should return the created room when calling findRoom', () => {
    const room = createRoom('TestRoom', 'owner1');
    expect(findRoom(room.id)).toBe(room);
  });

  it('should throw error when creating room with duplicate name for same owner', () => {
    createRoom('SameName', 'owner1');
    expect(() => createRoom('SameName', 'owner1')).toThrow('Ya tienes una sala activa con el nombre "SameName"');
  });

  it('should allow different owners to create rooms with the same name', () => {
    const room1 = createRoom('SharedName', 'owner1');
    const room2 = createRoom('SharedName', 'owner2');
    expect(room1.name).toBe('SharedName');
    expect(room2.name).toBe('SharedName');
    expect(room1.ownerAlias).toBe('owner1');
    expect(room2.ownerAlias).toBe('owner2');
    expect(room1.id).not.toBe(room2.id);
  });

  it('should allow creating room with same name after deleting the old one', () => {
    const room1 = createRoom('RecycleName', 'owner1');
    deleteRoom(room1.id);
    const room2 = createRoom('RecycleName', 'owner1');
    expect(room2.name).toBe('RecycleName');
    expect(room2.ownerAlias).toBe('owner1');
  });
});

describe('deleteRoom', () => {
  it('should delete an existing room and return it', () => {
    const room = createRoom('TestRoom', 'owner1');
    const deleted = deleteRoom(room.id);
    expect(deleted).toBe(room);
    expect(findRoom(room.id)).toBeUndefined();
  });

  it('should return undefined when deleting non-existent room', () => {
    expect(deleteRoom('ghost-room')).toBeUndefined();
  });
});

describe('findRoomByCode', () => {
  it('should find a room by its code', () => {
    const room = createRoom('CodeRoom', 'owner1');
    const found = findRoomByCode(room.code);
    expect(found).toBe(room);
  });

  it('should return undefined for unknown code', () => {
    expect(findRoomByCode('XXXXXX')).toBeUndefined();
  });

  it('should find the correct room among multiple rooms', () => {
    const room1 = createRoom('Room1', 'owner1');
    const room2 = createRoom('Room2', 'owner2');
    expect(findRoomByCode(room1.code)).toBe(room1);
    expect(findRoomByCode(room2.code)).toBe(room2);
  });
});

describe('listRoomsByOwner', () => {
  it('should return rooms owned by the given socket', () => {
    createRoom('Room1', 'ownerA');
    createRoom('Room2', 'ownerA');
    createRoom('Room3', 'ownerB');
    const ownerARooms = listRoomsByOwner('ownerA');
    expect(ownerARooms).toHaveLength(2);
    expect(ownerARooms.every((r) => r.ownerAlias === 'ownerA')).toBe(true);
  });

  it('should return empty array when owner has no rooms', () => {
    expect(listRoomsByOwner('nobody')).toEqual([]);
  });

  it('should not include rooms from other owners', () => {
    createRoom('Room1', 'ownerA');
    const ownerBRooms = listRoomsByOwner('ownerB');
    expect(ownerBRooms).toHaveLength(0);
  });
});
