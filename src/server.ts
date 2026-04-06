import http from 'http';
import { Server } from 'socket.io';
import { createApp } from './app.js';
import { socketConfig } from './config/socket.js';
import { ENV } from './config/env.js';
import { registerChatHandlers } from './modules/chat/chat.gateway.js';
import { initDb } from './modules/rooms/rooms.service.js';
import type {
  ServerToClientEvents,
  ClientToServerEvents,
  InterServerEvents,
  SocketData,
} from './shared/types/socket.types.js';

initDb(ENV.DB_PATH);

const app = createApp();
const server = http.createServer(app);

const io = new Server<ClientToServerEvents, ServerToClientEvents, InterServerEvents, SocketData>(
  server,
  socketConfig,
);

registerChatHandlers(io);

server.listen(ENV.PORT, () => {
  console.log(`Server listening ${ENV.PORT}`);
});
