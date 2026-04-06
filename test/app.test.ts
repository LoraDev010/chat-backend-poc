import { createApp } from '../src/app';
import request from 'supertest';

describe('createApp', () => {
  it('should return an express app with /health endpoint', async () => {
    const app = createApp();
    const res = await request(app).get('/health');
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ ok: true });
  });
});
