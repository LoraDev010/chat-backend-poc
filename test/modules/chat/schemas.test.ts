import { messageSchema, typingSchema } from '../../../src/modules/chat/chat.schemas';
import { joinRoomSchema, kickUserSchema } from '../../../src/modules/users/users.schemas';

describe('messageSchema', () => {
  it('should accept valid message', () => {
    expect(messageSchema.safeParse({ room: 'lobby', text: 'hi' }).success).toBe(true);
  });

  it('should reject empty text', () => {
    const r = messageSchema.safeParse({ room: 'lobby', text: '' });
    expect(r.success).toBe(false);
  });

  it('should reject text over 1000 chars', () => {
    const r = messageSchema.safeParse({ room: 'lobby', text: 'x'.repeat(1001) });
    expect(r.success).toBe(false);
    expect(r.error?.issues[0]?.message).toBe('too_long');
  });

  it('should reject missing room', () => {
    expect(messageSchema.safeParse({ text: 'hi' }).success).toBe(false);
  });
});

describe('typingSchema', () => {
  it('should accept valid payload', () => {
    expect(typingSchema.safeParse({ room: 'lobby' }).success).toBe(true);
  });

  it('should reject empty room', () => {
    expect(typingSchema.safeParse({ room: '' }).success).toBe(false);
  });
});

describe('joinRoomSchema', () => {
  it('should accept valid input', () => {
    expect(joinRoomSchema.safeParse({ room: 'lobby', alias: 'Alice' }).success).toBe(true);
  });

  it('should reject room with special characters', () => {
    expect(joinRoomSchema.safeParse({ room: 'foo bar!', alias: 'A' }).success).toBe(false);
  });

  it('should reject alias over 32 chars', () => {
    expect(joinRoomSchema.safeParse({ room: 'lobby', alias: 'x'.repeat(33) }).success).toBe(false);
  });

  it('should reject empty alias', () => {
    expect(joinRoomSchema.safeParse({ room: 'lobby', alias: '' }).success).toBe(false);
  });
});

describe('kickUserSchema', () => {
  it('should accept valid input', () => {
    expect(kickUserSchema.safeParse({ room: 'lobby', targetAlias: 'Bob' }).success).toBe(true);
  });

  it('should reject empty targetAlias', () => {
    expect(kickUserSchema.safeParse({ room: 'lobby', targetAlias: '' }).success).toBe(false);
  });
});
