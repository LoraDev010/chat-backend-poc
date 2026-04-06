import express from 'express';
import cors from 'cors';

export function createApp() {
  const app = express();
  app.use(cors());
  app.get('/health', (_req, res) => res.json({ ok: true }));
  return app;
}
