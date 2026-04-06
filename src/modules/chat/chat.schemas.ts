import { z } from 'zod';

export const messageSchema = z.object({
  room: z.string().min(1),
  text: z.string().min(1, 'empty').max(1000, 'too_long'),
});

export const typingSchema = z.object({
  room: z.string().min(1),
});
