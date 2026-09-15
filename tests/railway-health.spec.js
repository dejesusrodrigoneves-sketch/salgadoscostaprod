import { test, expect } from '@playwright/test';

const RAILWAY_URL = process.env.RAILWAY_URL || 'http://localhost:3000';

test.describe('Railway health E2E', () => {
  test.setTimeout(15000);

  test('/live => 200 ok', async ({ request }) => {
    const r = await request.get(`${RAILWAY_URL}/live`);
    expect(r.ok()).toBeTruthy();
    const b = await r.json();
    expect(b.status).toBe('ok');
  });

  test('/health => 200 with db up', async ({ request }) => {
    const r = await request.get(`${RAILWAY_URL}/health`);
    expect(r.ok()).toBeTruthy();
    const b = await r.json();
    expect(b.db).toBe('up');
  });

  test('/health returns X-Request-Id', async ({ request }) => {
    const r = await request.get(`${RAILWAY_URL}/health`);
    const rid = r.headers()['x-request-id'];
    expect(rid).toBeTruthy();
    expect(typeof rid).toBe('string');
    expect(rid.length).toBeGreaterThan(0);
  });

  test('GET / => 200 sistema online', async ({ request }) => {
    const r = await request.get(`${RAILWAY_URL}/`);
    expect(r.ok()).toBeTruthy();
    const b = await r.json();
    expect(b.sistema).toBeTruthy();
  });

  test('CORS拒绝未知Origin', async ({ request }) => {
    const r = await request.get(`${RAILWAY_URL}/api/config`, {
      headers: { Origin: 'https://evil.com' },
    });
    // Should not have Access-Control-Allow-Origin for evil.com
    const acao = r.headers()['access-control-allow-origin'];
    expect(acao).toBeFalsy();
  });
});
