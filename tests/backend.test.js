const { describe, it, expect } = require('vitest');

describe('Logger', () => {
  const logger = require('../backend/src/config/logger');

  it('tem métodos debug, info, warn, error', () => {
    expect(typeof logger.debug).toBe('function');
    expect(typeof logger.info).toBe('function');
    expect(typeof logger.warn).toBe('function');
    expect(typeof logger.error).toBe('function');
  });
});

describe('Auth Middleware', () => {
  const { authenticate, authorize } = require('../backend/src/middleware/auth');

  it('authenticate retorna 401 sem token', () => {
    const req = { headers: {} };
    const res = { status: (c) => ({ json: (o) => { expect(c).toBe(401); expect(o.error).toBeTruthy(); } }) };
    authenticate(req, res, () => {});
  });

  it('authorize com role correta chama next', () => {
    const req = { user: { role: 'admin' } };
    let called = false;
    authorize('admin')(req, {}, () => { called = true; });
    expect(called).toBe(true);
  });

  it('authorize com role errada retorna 403', () => {
    const req = { user: { role: 'user' } };
    const res = { status: (c) => ({ json: (o) => { expect(c).toBe(403); expect(o.error).toBe('Acesso negado'); } }) };
    authorize('admin')(req, res, () => {});
  });
});

describe('Error Handler', () => {
  const { errorHandler, asyncHandler } = require('../backend/src/middleware/errorHandler');

  it('errorHandler retorna status 500 com mensagem', () => {
    const err = new Error('Test error');
    const res = { status: (c) => ({ json: (o) => { expect(c).toBe(500); expect(o.error).toBe('Test error'); } }) };
    errorHandler(err, {}, res, () => {});
  });

  it('asyncHandler captura erros e chama next', async () => {
    const fn = asyncHandler(async () => { throw new Error('Async error'); });
    let nextCalled = false;
    await fn({}, {}, (err) => { nextCalled = true; expect(err.message).toBe('Async error'); });
    expect(nextCalled).toBe(true);
  });
});
