#!/usr/bin/env node
// Smoke test — post-deploy verification
// Usage: node scripts/smoke-test.mjs [BASE_URL]
const BASE = process.argv[2] || process.env.BACKEND_URL || 'http://localhost:3000';

let failures = 0;

async function check(label, fn) {
  try {
    await fn();
    console.log(`  ✓ ${label}`);
  } catch (e) {
    failures++;
    console.error(`  ✗ ${label}: ${e.message}`);
  }
}

function assert(status, body, expectedStatus, expectedKey) {
  if (status !== expectedStatus) throw new Error(`expected ${expectedStatus}, got ${status}`);
  if (expectedKey && !body[expectedKey]) throw new Error(`missing key: ${expectedKey}`);
}

async function run() {
  console.log(`Smoke test → ${BASE}\n`);

  // 1. /live
  await check('GET /live => 200 { status: "ok" }', async () => {
    const r = await fetch(`${BASE}/live`);
    const b = await r.json();
    assert(r.status, b, 200, 'status');
  });

  // 2. /health
  await check('GET /health => 200 { db: "up" }', async () => {
    const r = await fetch(`${BASE}/health`);
    const b = await r.json();
    assert(r.status, b, 200, 'db');
  });

  // 3. Root
  await check('GET / => 200 { sistema }', async () => {
    const r = await fetch(`${BASE}/`);
    const b = await r.json();
    assert(r.status, b, 200, 'sistema');
  });

  // 4. CORS preflight (no Origin => pass)
  await check('GET /api/config (no auth) => 401', async () => {
    const r = await fetch(`${BASE}/api/config`);
    // Should be 401 unauthorized (no token)
    if (r.status !== 401 && r.status !== 403) throw new Error(`expected 401/403, got ${r.status}`);
  });

  // 5. X-Request-Id header
  await check('X-Request-Id header present', async () => {
    const r = await fetch(`${BASE}/live`);
    const rid = r.headers.get('x-request-id');
    if (!rid) throw new Error('X-Request-Id header missing');
  });

  console.log(`\n${failures === 0 ? 'ALL PASS' : `${failures} FAILED`}`);
  process.exit(failures === 0 ? 0 : 1);
}

run();
