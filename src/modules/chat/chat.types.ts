import type { ChatMessage } from '../../shared/types/socket.types.js';

export interface ProcessMessageResult {
  ok: boolean;
  code?: number;
  message?: string;
  chatMessage?: ChatMessage;
}
