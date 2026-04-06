import { defineConfig } from 'drizzle-kit';

export default defineConfig({
  schema: './src/config/database/schema.ts',
  out: './drizzle',
  dialect: 'sqlite',
  dbCredentials: {
    url: process.env.DB_PATH || './rooms.db',
  },
});
