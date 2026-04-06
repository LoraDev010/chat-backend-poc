import { sqliteTable, text } from 'drizzle-orm/sqlite-core';

/** Tabla rooms — datos persistentes de cada sala de chat. */
export const rooms = sqliteTable('rooms', {
  id: text('id').primaryKey(),
  name: text('name').notNull(),
  code: text('code').unique().notNull(),
  ownerAlias: text('ownerAlias').notNull(),
});
