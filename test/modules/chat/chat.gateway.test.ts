import { registerChatHandlers } from '../../../src/modules/chat/chat.gateway';
import { _resetRooms, getRoom, addUserToRoom } from '../../../src/modules/rooms/rooms.service';
import { initDb } from '../../../src/modules/rooms/rooms.repository';

// ---- Socket / IO mocks ----
function makeMockSocket(id = 'sock1') {
  const handlers = new Map<string, Function>();
  const rooms = new Set<string>([id]);
  return {
    id,
    rooms,
    data: {} as Record<string, unknown>,
    on: jest.fn((event: string, handler: Function) => { handlers.set(event, handler); }),
    join: jest.fn((room: string) => rooms.add(room)),
    leave: jest.fn((room: string) => rooms.delete(room)),
    to: jest.fn(() => ({ emit: jest.fn() })),
    emit: jest.fn(),
    disconnect: jest.fn(),
    _trigger(event: string, ...args: any[]) { handlers.get(event)?.(...args); },
  };
}

function makeMockIO() {
  let connectionHandler: Function;
  const socketsMap = new Map<string, any>();
  const io: any = {
    on: jest.fn((event: string, handler: Function) => {
      if (event === 'connection') connectionHandler = handler;
    }),
    to: jest.fn(() => ({ emit: jest.fn() })),
    in: jest.fn(() => ({ socketsLeave: jest.fn() })),
    sockets: { sockets: socketsMap },
    _connect(socket: any) {
      socketsMap.set(socket.id, socket);
      connectionHandler(socket);
    },
  };
  return io;
}

beforeAll(() => initDb(':memory:'));
beforeEach(() => _resetRooms());

describe('registerChatHandlers', () => {
  it('should register connection handler', () => {
    const io = makeMockIO();
    registerChatHandlers(io);
    expect(io.on).toHaveBeenCalledWith('connection', expect.any(Function));
  });

  describe('join_room', () => {
    it('should ack success on valid join', () => {
      const io = makeMockIO();
      const socket = makeMockSocket();
      registerChatHandlers(io);
      io._connect(socket);

      const ack = jest.fn();
      socket._trigger('join_room', { room: 'lobby', alias: 'Alice' }, ack);
      expect(ack).toHaveBeenCalledWith(expect.objectContaining({ ok: true }));
      expect(socket.join).toHaveBeenCalledWith('lobby');
    });

    it('should ack error on invalid payload', () => {
      const io = makeMockIO();
      const socket = makeMockSocket();
      registerChatHandlers(io);
      io._connect(socket);

      const ack = jest.fn();
      socket._trigger('join_room', { room: '', alias: '' }, ack);
      expect(ack).toHaveBeenCalledWith(expect.objectContaining({ ok: false, code: 4003 }));
    });
  });

  describe('message', () => {
    it('should ack success and broadcast valid message', () => {
      const io = makeMockIO();
      const broadcastEmit = jest.fn();
      io.to = jest.fn(() => ({ emit: broadcastEmit }));
      const socket = makeMockSocket();
      registerChatHandlers(io);
      io._connect(socket);

      // Join first
      socket._trigger('join_room', { room: 'lobby', alias: 'Alice' }, jest.fn());

      const ack = jest.fn();
      socket._trigger('message', { room: 'lobby', text: 'Hello' }, ack);
      expect(ack).toHaveBeenCalledWith({ ok: true });
      expect(broadcastEmit).toHaveBeenCalledWith('message', expect.objectContaining({ text: 'Hello' }));
    });

    it('should ack error for invalid payload', () => {
      const io = makeMockIO();
      const socket = makeMockSocket();
      registerChatHandlers(io);
      io._connect(socket);

      const ack = jest.fn();
      socket._trigger('message', { room: 'lobby', text: '' }, ack);
      expect(ack).toHaveBeenCalledWith(expect.objectContaining({ ok: false }));
    });

    it('should ack error when room does not exist', () => {
      const io = makeMockIO();
      const socket = makeMockSocket();
      registerChatHandlers(io);
      io._connect(socket);

      const ack = jest.fn();
      socket._trigger('message', { room: 'ghost', text: 'hi' }, ack);
      expect(ack).toHaveBeenCalledWith(expect.objectContaining({ ok: false, code: 4103 }));
    });

    it('should ack error for too_long text with code 4101', () => {
      const io = makeMockIO();
      const socket = makeMockSocket();
      registerChatHandlers(io);
      io._connect(socket);

      const ack = jest.fn();
      socket._trigger('message', { room: 'lobby', text: 'x'.repeat(1001) }, ack);
      expect(ack).toHaveBeenCalledWith(expect.objectContaining({ ok: false, code: 4101 }));
    });
  });

  describe('typing', () => {
    it('should broadcast typing when not throttled', () => {
      const io = makeMockIO();
      const socket = makeMockSocket();
      const broadcastEmit = jest.fn();
      socket.to = jest.fn(() => ({ emit: broadcastEmit }));
      registerChatHandlers(io);
      io._connect(socket);

      socket._trigger('join_room', { room: 'lobby', alias: 'Alice' }, jest.fn());
      socket._trigger('typing', { room: 'lobby' });

      expect(broadcastEmit).toHaveBeenCalledWith('typing', { alias: 'Alice' });
    });

    it('should ignore invalid typing payload', () => {
      const io = makeMockIO();
      const socket = makeMockSocket();
      const broadcastEmit = jest.fn();
      socket.to = jest.fn(() => ({ emit: broadcastEmit }));
      registerChatHandlers(io);
      io._connect(socket);

      socket._trigger('typing', { room: '' });
      expect(broadcastEmit).not.toHaveBeenCalled();
    });
  });

  describe('kick_user', () => {
    it('should kick user and disconnect their socket', () => {
      const io = makeMockIO();
      const target = makeMockSocket('target1');
      const kicker = makeMockSocket('kicker1');
      registerChatHandlers(io);
      io._connect(target);
      io._connect(kicker);

      target._trigger('join_room', { room: 'lobby', alias: 'Victim' }, jest.fn());
      kicker._trigger('join_room', { room: 'lobby', alias: 'Mod' }, jest.fn());

      const ack = jest.fn();
      kicker._trigger('kick_user', { room: 'lobby', targetAlias: 'Victim' }, ack);
      expect(ack).toHaveBeenCalledWith({ ok: true });
      expect(target.disconnect).toHaveBeenCalled();
    });

    it('should ack error for invalid payload', () => {
      const io = makeMockIO();
      const socket = makeMockSocket();
      registerChatHandlers(io);
      io._connect(socket);

      const ack = jest.fn();
      socket._trigger('kick_user', { room: '', targetAlias: '' }, ack);
      expect(ack).toHaveBeenCalledWith(expect.objectContaining({ ok: false, code: 4301 }));
    });

    it('should ack error when room does not exist', () => {
      const io = makeMockIO();
      const socket = makeMockSocket();
      registerChatHandlers(io);
      io._connect(socket);

      const ack = jest.fn();
      socket._trigger('kick_user', { room: 'ghost', targetAlias: 'Bob' }, ack);
      expect(ack).toHaveBeenCalledWith(expect.objectContaining({ ok: false, code: 4301 }));
    });
  });

  describe('leave_room', () => {
    it('should emit user_left on leave', () => {
      const io = makeMockIO();
      const broadcastEmit = jest.fn();
      io.to = jest.fn(() => ({ emit: broadcastEmit }));
      const socket = makeMockSocket();
      registerChatHandlers(io);
      io._connect(socket);

      socket._trigger('join_room', { room: 'lobby', alias: 'Alice' }, jest.fn());
      socket._trigger('leave_room', { room: 'lobby' });

      expect(socket.leave).toHaveBeenCalledWith('lobby');
      expect(broadcastEmit).toHaveBeenCalledWith('user_left', expect.objectContaining({ alias: 'Alice' }));
    });

    it('should do nothing for non-existent room', () => {
      const io = makeMockIO();
      const socket = makeMockSocket();
      registerChatHandlers(io);
      io._connect(socket);

      socket._trigger('leave_room', { room: 'ghost' });
      expect(socket.leave).not.toHaveBeenCalled();
    });
  });

  describe('disconnecting', () => {
    it('should clean up rooms on disconnect', () => {
      const io = makeMockIO();
      const broadcastEmit = jest.fn();
      io.to = jest.fn(() => ({ emit: broadcastEmit }));
      const socket = makeMockSocket();
      registerChatHandlers(io);
      io._connect(socket);

      socket._trigger('join_room', { room: 'lobby', alias: 'Alice' }, jest.fn());
      // socket.rooms now contains socket.id + 'lobby'
      socket._trigger('disconnecting');

      expect(broadcastEmit).toHaveBeenCalledWith('user_left', expect.objectContaining({ alias: 'Alice' }));
    });
  });

  describe('create_room', () => {
    it('should create room and ack with roomId and roomCode', () => {
      const io = makeMockIO();
      const socket = makeMockSocket();
      registerChatHandlers(io);
      io._connect(socket);

      const ack = jest.fn();
      socket._trigger('create_room', { name: 'MyRoom', alias: 'Alice' }, ack);
      expect(ack).toHaveBeenCalledWith(expect.objectContaining({ ok: true, roomId: expect.any(String), roomCode: expect.any(String) }));
    });

    it('should ack error 4200 on invalid payload (missing alias)', () => {
      const io = makeMockIO();
      const socket = makeMockSocket();
      registerChatHandlers(io);
      io._connect(socket);

      const ack = jest.fn();
      socket._trigger('create_room', { name: '' }, ack);
      expect(ack).toHaveBeenCalledWith(expect.objectContaining({ ok: false, code: 4200 }));
    });

    it('should create room but not join user until explicit join_room', () => {
      const io = makeMockIO();
      const socket = makeMockSocket();
      registerChatHandlers(io);
      io._connect(socket);

      const createAck = jest.fn();
      socket._trigger('create_room', { name: 'MyRoom', alias: 'Alice' }, createAck);
      const roomId = createAck.mock.calls[0][0].roomId as string;

      // Verificar que la sala existe pero está vacía
      const listAck = jest.fn();
      socket._trigger('list_my_rooms', { alias: 'Alice' }, listAck);
      const rooms = listAck.mock.calls[0][0].rooms as Array<{ userCount: number; isOwner: boolean; isActive: boolean }>;
      const createdRoom = rooms.find((r: any) => r.id === roomId);
      expect(createdRoom?.userCount).toBe(0);
      expect(createdRoom?.isOwner).toBe(true);
      expect(createdRoom?.isActive).toBe(false);
    });
  });

  describe('join_room_by_code', () => {
    it('should join room by code and return roomId and roomName', () => {
      const io = makeMockIO();
      const socket1 = makeMockSocket('creator');
      const socket2 = makeMockSocket('joiner');
      registerChatHandlers(io);
      io._connect(socket1);
      io._connect(socket2);

      const createAck = jest.fn();
      socket1._trigger('create_room', { name: 'TestRoom', alias: 'Alice' }, createAck);
      const roomCode = createAck.mock.calls[0][0].roomCode as string;

      const joinAck = jest.fn();
      socket2._trigger('join_room_by_code', { code: roomCode, alias: 'Bob' }, joinAck);
      expect(joinAck).toHaveBeenCalledWith(expect.objectContaining({ ok: true, roomId: expect.any(String), roomName: 'TestRoom' }));
      expect(socket2.join).toHaveBeenCalledWith(expect.any(String));
    });

    it('should ack error 4201 for non-existent code', () => {
      const io = makeMockIO();
      const socket = makeMockSocket();
      registerChatHandlers(io);
      io._connect(socket);

      const ack = jest.fn();
      socket._trigger('join_room_by_code', { code: 'ZZZZZZ', alias: 'Alice' }, ack);
      expect(ack).toHaveBeenCalledWith(expect.objectContaining({ ok: false, code: 4201 }));
    });

    it('should ack error 4202 when socket is already in the room', () => {
      const io = makeMockIO();
      const socket = makeMockSocket();
      registerChatHandlers(io);
      io._connect(socket);

      const createAck = jest.fn();
      socket._trigger('create_room', { name: 'TestRoom', alias: 'Alice' }, createAck);
      const roomId = createAck.mock.calls[0][0].roomId as string;
      const roomCode = createAck.mock.calls[0][0].roomCode as string;

      // First join explicitly
      socket._trigger('join_room', { room: roomId, alias: 'Alice' }, jest.fn());

      // Try to join again via code
      const joinAck = jest.fn();
      socket._trigger('join_room_by_code', { code: roomCode, alias: 'Alice' }, joinAck);
      expect(joinAck).toHaveBeenCalledWith(expect.objectContaining({ ok: false, code: 4202 }));
    });
  });

  describe('delete_room', () => {
    it('should delete room and emit room_deleted, ack ok', () => {
      const io = makeMockIO();
      const broadcastEmit = jest.fn();
      io.to = jest.fn(() => ({ emit: broadcastEmit }));
      const socket = makeMockSocket();
      registerChatHandlers(io);
      io._connect(socket);

      const createAck = jest.fn();
      socket._trigger('create_room', { name: 'TestRoom', alias: 'Alice' }, createAck);
      const roomId = createAck.mock.calls[0][0].roomId as string;

      const ack = jest.fn();
      socket._trigger('delete_room', { roomId, alias: 'Alice' }, ack);
      expect(ack).toHaveBeenCalledWith({ ok: true });
      expect(broadcastEmit).toHaveBeenCalledWith('room_deleted', expect.objectContaining({ roomId }));
    });

    it('should ack error 4401 when socket is not the owner', () => {
      const io = makeMockIO();
      const creator = makeMockSocket('creator');
      const other = makeMockSocket('other');
      registerChatHandlers(io);
      io._connect(creator);
      io._connect(other);

      const createAck = jest.fn();
      creator._trigger('create_room', { name: 'TestRoom', alias: 'Alice' }, createAck);
      const roomId = createAck.mock.calls[0][0].roomId as string;

      const ack = jest.fn();
      other._trigger('delete_room', { roomId, alias: 'Bob' }, ack);
      expect(ack).toHaveBeenCalledWith(expect.objectContaining({ ok: false, code: 4401 }));
    });

    it('should ack error 4401 when room does not exist', () => {
      const io = makeMockIO();
      const socket = makeMockSocket();
      registerChatHandlers(io);
      io._connect(socket);

      const ack = jest.fn();
      socket._trigger('delete_room', { roomId: 'ghost-room', alias: 'Alice' }, ack);
      expect(ack).toHaveBeenCalledWith(expect.objectContaining({ ok: false, code: 4401 }));
    });
  });

  describe('list_my_rooms', () => {
    it('should return rooms the socket has joined with correct flags', () => {
      const io = makeMockIO();
      const socket = makeMockSocket();
      registerChatHandlers(io);
      io._connect(socket);

      // Crear salas
      const createAck1 = jest.fn();
      const createAck2 = jest.fn();
      socket._trigger('create_room', { name: 'Room1', alias: 'Alice' }, createAck1);
      socket._trigger('create_room', { name: 'Room2', alias: 'Alice' }, createAck2);
      
      const room1Id = createAck1.mock.calls[0][0].roomId as string;
      const room2Id = createAck2.mock.calls[0][0].roomId as string;
      
      // Unirse explícitamente a Room1
      socket._trigger('join_room', { room: room1Id, alias: 'Alice' }, jest.fn());

      const ack = jest.fn();
      socket._trigger('list_my_rooms', { alias: 'Alice' }, ack);
      const result = ack.mock.calls[0][0];
      
      // Room1: isOwner=true, isActive=true (está conectado)
      const room1 = result.rooms.find((r: any) => r.name === 'Room1');
      expect(room1?.isOwner).toBe(true);
      expect(room1?.isActive).toBe(true);
      
      // Room2: isOwner=true, isActive=false (no está conectado)
      const room2 = result.rooms.find((r: any) => r.name === 'Room2');
      expect(room2?.isOwner).toBe(true);
      expect(room2?.isActive).toBe(false);
    });

    it('should return empty rooms array when socket has not joined any rooms', () => {
      const io = makeMockIO();
      const socket = makeMockSocket();
      registerChatHandlers(io);
      io._connect(socket);

      const ack = jest.fn();
      socket._trigger('list_my_rooms', { alias: 'Alice' }, ack);
      expect(ack).toHaveBeenCalledWith(expect.objectContaining({ ok: true, rooms: [] }));
    });

    it('should include owned rooms even if not active in them', () => {
      const io = makeMockIO();
      const alice = makeMockSocket('alice');
      const bob = makeMockSocket('bob');
      registerChatHandlers(io);
      io._connect(alice);
      io._connect(bob);

      // Alice crea sala y se une
      const createAck = jest.fn();
      alice._trigger('create_room', { name: 'MyRoom', alias: 'Alice' }, createAck);
      const roomId = createAck.mock.calls[0][0].roomId as string;
      const roomCode = createAck.mock.calls[0][0].roomCode as string;
      
      alice._trigger('join_room', { room: roomId, alias: 'Alice' }, jest.fn());
      
      // Bob se une
      const joinAck = jest.fn();
      bob._trigger('join_room_by_code', { code: roomCode, alias: 'Bob' }, joinAck);
      
      // Alice sale (pero Bob sigue, entonces la sala no se elimina)
      alice._trigger('leave_room', { room: roomId });

      // Alice pide su lista de salas
      const ack = jest.fn();
      alice._trigger('list_my_rooms', { alias: 'Alice' }, ack);
      expect(ack).toHaveBeenCalledWith(expect.objectContaining({
        ok: true,
        rooms: expect.arrayContaining([
          expect.objectContaining({ name: 'MyRoom', isOwner: true, isActive: false }),
        ]),
      }));
    });
  });
});
