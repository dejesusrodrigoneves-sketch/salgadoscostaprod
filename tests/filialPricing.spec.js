import { test, expect } from '@playwright/test';

const ADMIN_TOKEN = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpZCI6NSwidXNlcm5hbWUiOiJzaW1vbmUiLCJyb2xlIjoiYWRtaW4iLCJlbXByZXNhSWQiOjEsImp0aSI6ImMwYTk5NTUzLWViZWYtNGQ1Yy1iOGE4LWFjOGJjZDlhODg4ZiIsImlhdCI6MTc4OTAwNDY2NywiZXhwIjoxNzg5MDA2NDY3fQ.Eywq5KHiNj3DoEI-z2Dymxu_tZ0RAlEav6Ahy7guugI';
const SUPERADMIN_TOKEN = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpZCI6MSwidXNlcm5hbWUiOiJkamVzdXMiLCJyb2xlIjoic3VwZXJhZG1pbiIsImVtcHJlc2FJZCI6bnVsbCwianRpIjoiNjJjZDMxM2QtMGM3MS00OGRiLWJjOWYtNzg1NTgxYjVlZWRmIiwiaWF0IjoxNzg5MDA0NjY3LCJleHAiOjE3ODkwMDY0Njd9.dJhBovmxUPz6uoYJf-OLH0B5Qt7_sq-f3RST_SmWSlc';

const BASE = 'http://localhost:5173';
const API = 'http://localhost:3000';

async function injectAuth(page) {
  await page.goto(BASE);
  await page.evaluate(({ token }) => {
    localStorage.setItem('authUser', JSON.stringify({
      id: 5, username: 'simone', role: 'admin', empresaId: 1,
      token, _expiry: Date.now() + 30 * 60 * 1000,
    }));
  }, { token: ADMIN_TOKEN });
}

// Single serial block — all tests run in order, no parallelism
test.describe.serial('Filial Pricing — Full E2E', () => {
  test.setTimeout(60000);

  // ── Phase 0: Reset DB ──
  test('00-reset DB state', async ({ request }) => {
    const res = await request.post(`${API}/api/admin/filial-pricing/test-reset`, {
      headers: { Authorization: `Bearer ${SUPERADMIN_TOKEN}` }
    });
    expect(res.ok()).toBeTruthy();
  });

  // ── Phase 1: Create pending config ──
  test('10-superadmin creates pending config', async ({ request }) => {
    const res = await request.post(`${API}/api/admin/filial-pricing`, {
      headers: {
        Authorization: `Bearer ${SUPERADMIN_TOKEN}`,
        'Content-Type': 'application/json'
      },
      data: { valorX: 40, effectiveDate: '2026-11-01', termosTexto: 'V4 E2E Playwright' }
    });
    expect(res.ok()).toBeTruthy();
  });

  // ── Phase 2: API status checks ──
  test('20-superadmin list configs', async ({ request }) => {
    const res = await request.get(`${API}/api/admin/filial-pricing`, {
      headers: { Authorization: `Bearer ${SUPERADMIN_TOKEN}` }
    });
    expect(res.ok()).toBeTruthy();
    const data = await res.json();
    expect(data).toHaveProperty('current');
    expect(data).toHaveProperty('pending');
  });

  test('21-admin status shows needsConsent=true', async ({ request }) => {
    const res = await request.get(`${API}/api/admin/filial-pricing/status`, {
      headers: { Authorization: `Bearer ${ADMIN_TOKEN}` }
    });
    expect(res.ok()).toBeTruthy();
    const data = await res.json();
    expect(data.needsConsent).toBe(true);
    expect(data).toHaveProperty('valorX');
    expect(data).toHaveProperty('valorY');
    expect(data).toHaveProperty('baseMensalidade');
    expect(data).toHaveProperty('nFiliaisAtivas');
    expect(data).toHaveProperty('mensalidadeAtual');
    expect(data).toHaveProperty('mensalidadeProjetado');
    expect(data).toHaveProperty('termosTexto');
  });

  // ── Phase 3: Browser overlay ──
  test('30-overlay appears in browser with correct values', async ({ page }) => {
    await injectAuth(page);
    await page.goto(`${BASE}/dashboard.html`);
    await page.waitForLoadState('domcontentloaded');

    const overlay = page.locator('#filialPricingOverlay');
    await expect(overlay).toBeVisible({ timeout: 20000 });

    await expect(overlay).toContainText('V4 E2E Playwright');
    await expect(overlay).toContainText('R$ 40,00');
    await expect(overlay.locator('#fpAcceptBtn')).toBeVisible();
    await expect(overlay.locator('#fpRejectBtn')).toBeVisible();
    await expect(overlay.locator('#fpLaterBtn')).toBeVisible();

    await expect(overlay).toContainText('V4 E2E Playwright');
    await expect(overlay).toContainText('R$ 40,00');
    await expect(overlay.locator('#fpAcceptBtn')).toBeVisible();
    await expect(overlay.locator('#fpRejectBtn')).toBeVisible();
    await expect(overlay.locator('#fpLaterBtn')).toBeVisible();
  });

  test('31-accept button in browser works', async ({ page, request }) => {
    await injectAuth(page);
    await page.goto(`${BASE}/dashboard.html`);
    await page.waitForLoadState('domcontentloaded');
    const overlay = page.locator('#filialPricingOverlay');
    await expect(overlay).toBeVisible({ timeout: 20000 });

    // Click Accept — overlay calls POST /accept then location.reload()
    await page.click('#fpAcceptBtn');

    // Page will reload — wait for it
    await page.waitForLoadState('domcontentloaded');
    await page.waitForTimeout(3000);

    // Verify consent was registered via API (not relying on overlay state)
    const statusRes = await request.get(`${API}/api/admin/filial-pricing/status`, {
      headers: { Authorization: `Bearer ${ADMIN_TOKEN}` }
    });
    const statusData = await statusRes.json();
    expect(statusData.needsConsent).toBe(false);
  });

  // ── Phase 4: Verify consent via API ──
  test('40-status shows needsConsent=false after accept', async ({ request }) => {
    const res = await request.get(`${API}/api/admin/filial-pricing/status`, {
      headers: { Authorization: `Bearer ${ADMIN_TOKEN}` }
    });
    expect(res.ok()).toBeTruthy();
    const data = await res.json();
    expect(data.needsConsent).toBe(false);
  });

  // ── Phase 5: Verify overlay absent after consent ──
  test('50-overlay absent after consent given', async ({ page }) => {
    await injectAuth(page);
    await page.goto(`${BASE}/dashboard.html`);
    await page.waitForTimeout(4000);
    const visible = await page.locator('#filialPricingOverlay').isVisible().catch(() => false);
    expect(visible).toBe(false);
  });
});
