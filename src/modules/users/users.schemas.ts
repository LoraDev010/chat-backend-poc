import { z } from 'zod';

export const joinRoomSchema = z.object({
  room: z.string().min(1).regex(/^[a-zA-Z0-9-]+$/, 'room name invalid: only alphanumeric and hyphens allowed'),
  alias: z.string().min(1).max(32).trim(),
});

export const kickUserSchema = z.object({
  room: z.string().min(1),
  targetAlias: z.string().min(1),
});
