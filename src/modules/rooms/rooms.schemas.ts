import { z } from 'zod';

export const createRoomSchema = z.object({
  name: z.string().min(1).max(50).trim(),
  alias: z.string().min(1).max(32).trim(),
});

export const joinByCodeSchema = z.object({
  code: z.string().length(6).transform((s) => s.toUpperCase()),
  alias: z.string().min(1).max(32).trim(),
});

export const deleteRoomSchema = z.object({
  roomId: z.string().min(1),
  alias: z.string().min(1).max(32).trim(),
});
