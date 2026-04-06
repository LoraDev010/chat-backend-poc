import type { ServerOptions } from 'socket.io';
import { ENV } from './env.js';

export const socketConfig: Partial<ServerOptions> = {
  cors: { origin: ENV.CORS_ORIGIN },
  maxHttpBufferSize: 1e6,
};
