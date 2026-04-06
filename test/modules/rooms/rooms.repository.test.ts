import {
  initDb,
  insertRoom,
  deleteRoomRow,
  findRoomRowById,
  findRoomRowByCode,
  listRoomRowsByOwner,
  codeExistsInDb,
  _truncateRooms,
} from '../../../src/modules/rooms/rooms.repository';

beforeAll(() => initDb(':memory:'));
beforeEach(() => _truncateRooms());

describe('insertRoom + findRoomRowById', () => {
  it('should persist and retrieve a room by ID', () => {
    insertRoom({ id: 'r1', name: 'Room 1', code: 'AAAAAA', ownerAlias: 'Alice' });
    const row = findRoomRowById('r1');
    expect(row).toEqual({ id: 'r1', name: 'Room 1', code: 'AAAAAA', ownerAlias: 'Alice' });
  });

  it('should return undefined for a non-existent ID', () => {
    expect(findRoomRowById('ghost')).toBeUndefined();
  });
});

describe('findRoomRowByCode', () => {
  it('should find a room by its code', () => {
    insertRoom({ id: 'r1', name: 'Room 1', code: 'BBBBBB', ownerAlias: 'Alice' });
    const row = findRoomRowByCode('BBBBBB');
    expect(row?.id).toBe('r1');
  });

  it('should return undefined for unknown code', () => {
    expect(findRoomRowByCode('ZZZZZZ')).toBeUndefined();
  });
});

describe('listRoomRowsByOwner', () => {
  it('should list all rooms for a given owner', () => {
    insertRoom({ id: 'r1', name: 'Room 1', code: 'CCCCCC', ownerAlias: 'Alice' });
    insertRoom({ id: 'r2', name: 'Room 2', code: 'DDDDDD', ownerAlias: 'Alice' });
    insertRoom({ id: 'r3', name: 'Room 3', code: 'EEEEEE', ownerAlias: 'Bob' });
    const rows = listRoomRowsByOwner('Alice');
    expect(rows).toHaveLength(2);
    expect(rows.every((r) => r.ownerAlias === 'Alice')).toBe(true);
  });

  it('should return empty array when owner has no rooms', () => {
    expect(listRoomRowsByOwner('nobody')).toEqual([]);
  });
});

describe('codeExistsInDb', () => {
  it('should return true for existing code', () => {
    insertRoom({ id: 'r1', name: 'Room 1', code: 'FFFFFF', ownerAlias: 'Alice' });
    expect(codeExistsInDb('FFFFFF')).toBe(true);
  });

  it('should return false for non-existent code', () => {
    expect(codeExistsInDb('XXXXXX')).toBe(false);
  });
});

describe('deleteRoomRow', () => {
  it('should remove a room from SQLite', () => {
    insertRoom({ id: 'r1', name: 'Room 1', code: 'GGGGGG', ownerAlias: 'Alice' });
    deleteRoomRow('r1');
    expect(findRoomRowById('r1')).toBeUndefined();
  });

  it('should not throw when deleting non-existent room', () => {
    expect(() => deleteRoomRow('ghost')).not.toThrow();
  });
});

describe('_truncateRooms', () => {
  it('should clear all rows from the table', () => {
    insertRoom({ id: 'r1', name: 'Room 1', code: 'HHHHHH', ownerAlias: 'Alice' });
    insertRoom({ id: 'r2', name: 'Room 2', code: 'IIIIII', ownerAlias: 'Bob' });
    _truncateRooms();
    expect(listRoomRowsByOwner('Alice')).toEqual([]);
    expect(listRoomRowsByOwner('Bob')).toEqual([]);
  });
});
