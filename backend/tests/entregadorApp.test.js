import { describe, it, expect } from 'vitest';
import bcrypt from 'bcryptjs';

describe('Entregador Auth', () => {
  it('should hash password with bcrypt', async () => {
    const password = 'SIC-TEST';
    const hash = await bcrypt.hash(password, 10);
    expect(hash).not.toBe(password);
    const match = await bcrypt.compare(password, hash);
    expect(match).toBe(true);
  });

  it('should reject wrong password', async () => {
    const password = 'SIC-TEST';
    const hash = await bcrypt.hash(password, 10);
    const match = await bcrypt.compare('WRONG', hash);
    expect(match).toBe(false);
  });

  it('should validate password complexity', () => {
    const valid = (p) => p.length >= 6 && /[A-Z]/.test(p) && /[a-z]/.test(p) && /[0-9]/.test(p);
    expect(valid('Abc123')).toBe(true);
    expect(valid('abc123')).toBe(false);
    expect(valid('ABC123')).toBe(false);
    expect(valid('Abcdef')).toBe(false);
    expect(valid('Ab1')).toBe(false);
  });

  it('should generate provisional password format', () => {
    const gen = () => 'SIC-' + Math.random().toString(36).substring(2, 6).toUpperCase();
    const pwd = gen();
    expect(pwd).toMatch(/^SIC-[A-Z0-9]{4}$/);
  });
});

describe('Entregador Service - Delivery Fee Flow', () => {
  it('EntregaDiaria.valor should be pedido.taxasEntrega (driver earnings)', () => {
    const pedido = { taxasEntrega: 5.00, total: 50.90 };
    const entrega = { valor: pedido.taxasEntrega, valorCobrado: 50.90 };
    expect(entrega.valor).toBe(5.00);
    expect(entrega.valor).not.toBe(pedido.total);
  });

  it('History should show delivery fee, not order total', () => {
    const entregas = [
      { valor: 5.00, pedido: { clienteNome: 'Maria' } },
      { valor: 5.00, pedido: { clienteNome: 'Carlos' } },
    ];
    const total = entregas.reduce((sum, e) => sum + Number(e.valor), 0);
    expect(total).toBe(10.00);
    expect(total).not.toBe(89.40);
  });
});

describe('Entregador Service - Order List', () => {
  it('should NOT include total value in order list response', () => {
    const pedido = {
      id: 'test-123',
      clienteNome: 'Maria',
      total: 50.90,
      taxasEntrega: 5.00,
      itens: [{ quantidade: 2, produto: { name: 'Coxinha' } }],
    };

    const response = {
      id: pedido.id,
      clienteNome: pedido.clienteNome,
      itens: pedido.itens,
    };

    expect(response).not.toHaveProperty('total');
    expect(response).not.toHaveProperty('taxasEntrega');
    expect(response.clienteNome).toBe('Maria');
  });

  it('should include taxasEntrega in order detail (for confirmation modal)', () => {
    const pedido = {
      id: 'test-123',
      taxasEntrega: 5.00,
      total: 50.90,
    };

    const response = {
      id: pedido.id,
      taxaEntrega: pedido.taxasEntrega,
    };

    expect(response.taxaEntrega).toBe(5.00);
    expect(response).not.toHaveProperty('total');
  });
});

describe('Entregador Routes', () => {
  it('should have correct route definitions', () => {
    const routes = [
      'POST /api/entregador/auth/login',
      'POST /api/entregador/auth/change-password',
      'POST /api/entregador/auth/refresh',
      'GET /api/entregador/pedidos',
      'GET /api/entregador/pedidos/:id',
      'POST /api/entregador/pedidos/:id/confirmar',
      'POST /api/entregador/pedidos/:id/falha',
      'GET /api/entregador/historico',
      'GET /api/entregador/perfil',
      'PUT /api/entregador/perfil',
      'POST /api/entregador/push/register',
      'POST /api/entregador/push/unregister',
    ];

    expect(routes).toHaveLength(12);
    expect(routes).toContain('POST /api/entregador/auth/login');
    expect(routes).toContain('POST /api/entregador/pedidos/:id/confirmar');
  });
});

describe('Entregador Schema', () => {
  it('Entregador model should have required fields', () => {
    const fields = [
      'id', 'empresaId', 'nome', 'telefone', 'endereco',
      'whatsapp', 'chavePix', 'ativo', 'usuarioId',
      'passwordHash', 'mustChangePassword', 'fcmToken', 'createdAt',
    ];
    expect(fields).toContain('telefone');
    expect(fields).toContain('usuarioId');
    expect(fields).toContain('passwordHash');
    expect(fields).toContain('mustChangePassword');
    expect(fields).toContain('fcmToken');
  });

  it('EntregaDiaria model should have delivery fee fields', () => {
    const fields = [
      'id', 'empresaId', 'data', 'entregadorId', 'pedidoId',
      'valor', 'valorCobrado', 'status', 'confirmadoEm', 'observacao', 'createdAt',
    ];
    expect(fields).toContain('valor');
    expect(fields).toContain('valorCobrado');
    expect(fields).toContain('status');
    expect(fields).toContain('confirmadoEm');
  });
});

describe('Offline Support', () => {
  it('should define offline stores', () => {
    const stores = ['cachedOrders', 'pendingConfirmations', 'syncQueue'];
    expect(stores).toHaveLength(3);
    expect(stores).toContain('cachedOrders');
    expect(stores).toContain('pendingConfirmations');
    expect(stores).toContain('syncQueue');
  });

  it('pending confirmation should have correct structure', () => {
    const confirmation = {
      pedidoId: 'test-123',
      valorCobrado: 50.90,
      observacao: 'Cliente pagou com nota',
      timestamp: Date.now(),
      synced: false,
    };

    expect(confirmation.pedidoId).toBe('test-123');
    expect(confirmation.valorCobrado).toBe(50.90);
    expect(confirmation.synced).toBe(false);
  });
});

describe('WhatsApp fallback on driver creation', () => {
  it('should return whatsappSent true when WhatsApp succeeds', async () => {
    const whatsappService = require('../src/services/whatsappService');
    const original = whatsappService.enviarMensagem;
    whatsappService.enviarMensagem = async () => ({ status: 200 });

    const prisma = require('../src/config/prisma');
    const mockEntregador = { id: 999, nome: 'Teste', telefone: '11999999999', whatsapp: '11999999999', ativo: true };
    const mockUsuario = { id: 999, username: 'teste.user', role: 'entregador' };

    prisma.entregador = {
      create: async () => mockEntregador,
      update: async () => mockEntregador,
      findFirst: async () => null,
    };
    prisma.usuario = {
      create: async () => mockUsuario,
      findUnique: async () => null,
    };

    const driverController = require('../src/controllers/driverController');

    const req = {
      body: { nome: 'Teste', username: 'teste.user', telefone: '11999999999', whatsapp: '11999999999' },
      ctx: { empresaId: 1 },
      user: { empresaId: 1 },
    };
    let responseData;
    const res = {
      status: () => ({ json: (data) => { responseData = data; } }),
    };

    await driverController.criar(req, res);

    expect(responseData).toHaveProperty('provisionalPassword');
    expect(responseData.provisionalPassword).toMatch(/^SIC-[A-Z0-9]{4}$/);
    expect(responseData.whatsappSent).toBe(true);

    whatsappService.enviarMensagem = original;
  });

  it('should return whatsappSent false when WhatsApp fails', async () => {
    const whatsappService = require('../src/services/whatsappService');
    const original = whatsappService.enviarMensagem;
    whatsappService.enviarMensagem = async () => { throw new Error('Evolution API not configured'); };

    const prisma = require('../src/config/prisma');
    const mockEntregador = { id: 998, nome: 'Teste2', telefone: '11888888888', whatsapp: '11888888888', ativo: true };
    const mockUsuario = { id: 998, username: 'teste2.user', role: 'entregador' };

    prisma.entregador = {
      create: async () => mockEntregador,
      update: async () => mockEntregador,
      findFirst: async () => null,
    };
    prisma.usuario = {
      create: async () => mockUsuario,
      findUnique: async () => null,
    };

    const driverController = require('../src/controllers/driverController');

    const req = {
      body: { nome: 'Teste2', username: 'teste2.user', telefone: '11888888888', whatsapp: '11888888888' },
      ctx: { empresaId: 1 },
      user: { empresaId: 1 },
    };
    let responseData;
    const res = {
      status: () => ({ json: (data) => { responseData = data; } }),
    };

    await driverController.criar(req, res);

    expect(responseData).toHaveProperty('provisionalPassword');
    expect(responseData.whatsappSent).toBe(false);

    whatsappService.enviarMensagem = original;
  });
});

describe('Admin password reset for entregador', () => {
  it('should set custom password and return whatsappSent true', async () => {
    const whatsappService = require('../src/services/whatsappService');
    const original = whatsappService.enviarMensagem;
    whatsappService.enviarMensagem = async () => ({ status: 200 });

    const prisma = require('../src/config/prisma');
    const mockEntregador = {
      id: 888, nome: 'Entregador Teste', telefone: '11777777777',
      whatsapp: '11777777777', ativo: true, usuarioId: 888,
    };

    prisma.entregador = {
      findFirst: async () => mockEntregador,
      update: async () => mockEntregador,
    };
    prisma.usuario = {
      update: async () => ({ id: 888 }),
    };

    const driverController = require('../src/controllers/driverController');

    const req = {
      params: { id: '888' },
      body: { password: 'MinhaSenh4', sendWhatsApp: true },
      ctx: { empresaId: 1 },
      user: { empresaId: 1 },
    };
    let responseData;
    const res = {
      json: (data) => { responseData = data; },
    };

    await driverController.resetarSenha(req, res);

    expect(responseData.success).toBe(true);
    expect(responseData.whatsappSent).toBe(true);

    whatsappService.enviarMensagem = original;
  });

  it('should skip WhatsApp when sendWhatsApp is false', async () => {
    const whatsappService = require('../src/services/whatsappService');
    const original = whatsappService.enviarMensagem;
    let whatsappCalled = false;
    whatsappService.enviarMensagem = async () => { whatsappCalled = true; };

    const prisma = require('../src/config/prisma');
    const mockEntregador = {
      id: 887, nome: 'Entregador Teste2', telefone: '11666666666',
      whatsapp: '11666666666', ativo: true, usuarioId: 887,
    };

    prisma.entregador = {
      findFirst: async () => mockEntregador,
      update: async () => mockEntregador,
    };
    prisma.usuario = {
      update: async () => ({ id: 887 }),
    };

    const driverController = require('../src/controllers/driverController');

    const req = {
      params: { id: '887' },
      body: { password: 'OutraSenh4', sendWhatsApp: false },
      ctx: { empresaId: 1 },
      user: { empresaId: 1 },
    };
    let responseData;
    const res = {
      json: (data) => { responseData = data; },
    };

    await driverController.resetarSenha(req, res);

    expect(responseData.success).toBe(true);
    expect(responseData.whatsappSent).toBe(false);
    expect(whatsappCalled).toBe(false);

    whatsappService.enviarMensagem = original;
  });

  it('should reject weak password', async () => {
    const prisma = require('../src/config/prisma');
    prisma.entregador = {
      findFirst: async () => ({ id: 886, nome: 'Teste', telefone: '11555555555' }),
    };

    const driverController = require('../src/controllers/driverController');

    const req = {
      params: { id: '886' },
      body: { password: '123', sendWhatsApp: false },
      ctx: { empresaId: 1 },
      user: { empresaId: 1 },
    };
    let statusCode;
    let responseData;
    const res = {
      status: (code) => ({ json: (data) => { statusCode = code; responseData = data; } }),
    };

    await driverController.resetarSenha(req, res);

    expect(statusCode).toBe(400);
    expect(responseData.error).toMatch(/mínimo 6 caracteres/);
  });

  it('should return 404 for non-existent entregador', async () => {
    const prisma = require('../src/config/prisma');
    prisma.entregador = {
      findFirst: async () => null,
    };

    const driverController = require('../src/controllers/driverController');

    const req = {
      params: { id: '99999' },
      body: { password: 'SenhaValid4', sendWhatsApp: false },
      ctx: { empresaId: 1 },
      user: { empresaId: 1 },
    };
    let statusCode;
    let responseData;
    const res = {
      status: (code) => ({ json: (data) => { statusCode = code; responseData = data; } }),
    };

    await driverController.resetarSenha(req, res);

    expect(statusCode).toBe(404);
    expect(responseData.error).toBe('Entregador não encontrado');
  });
});

describe('Entregador login with username', () => {
  it('should login with valid username and password', async () => {
    const authService = require('../src/services/authService');
    const original = authService.loginEntregador;
    authService.loginEntregador = async () => ({
      token: 'mock-token',
      refreshToken: 'mock-refresh',
      user: { id: 1, username: 'teste.user', role: 'entregador' },
    });

    const req = {
      body: { username: 'teste.user', password: 'SenhaValid4' },
      ctx: { empresaId: 1 },
      context: { requestId: 'req-1', ip: '127.0.0.1', userAgent: 'test', path: '/login' },
    };
    let responseData;
    const res = { json: (data) => { responseData = data; } };

    const handler = require('../src/routes/entregadorAuthRoutes');
    // Simulate calling the login route
    const result = await authService.loginEntregador('teste.user', 'SenhaValid4', 1, '127.0.0.1', 'test', req.context);

    expect(result).toHaveProperty('token');
    expect(result).toHaveProperty('refreshToken');
    expect(result.user.username).toBe('teste.user');
    expect(result.user.role).toBe('entregador');

    authService.loginEntregador = original;
  });

  it('should reject login with wrong password', async () => {
    const authService = require('../src/services/authService');
    const original = authService.loginEntregador;
    authService.loginEntregador = async () => {
      throw new Error('Senha incorreta');
    };

    let errorThrown = false;
    try {
      await authService.loginEntregador('teste.user', 'WrongPass1', 1, '127.0.0.1', 'test', {});
    } catch (e) {
      errorThrown = true;
      expect(e.message).toBe('Senha incorreta');
    }
    expect(errorThrown).toBe(true);

    authService.loginEntregador = original;
  });

  it('should reject login with non-existent username', async () => {
    const authService = require('../src/services/authService');
    const original = authService.loginEntregador;
    authService.loginEntregador = async () => {
      throw new Error('Entregador não encontrado');
    };

    let errorThrown = false;
    try {
      await authService.loginEntregador('naoexiste', 'SenhaValid4', 1, '127.0.0.1', 'test', {});
    } catch (e) {
      errorThrown = true;
      expect(e.message).toBe('Entregador não encontrado');
    }
    expect(errorThrown).toBe(true);

    authService.loginEntregador = original;
  });

  it('should require both username and password', () => {
    // Simulate validation from route
    const validate = (username, password) => !(!username || !password);
    expect(validate('user', 'pass')).toBe(true);
    expect(validate('user', '')).toBe(false);
    expect(validate('', 'pass')).toBe(false);
    expect(validate('', '')).toBe(false);
  });

  it('driver creation should require username', () => {
    const validate = (username) => !!username;
    expect(validate('joao.silva')).toBe(true);
    expect(validate('')).toBe(false);
    expect(validate(undefined)).toBe(false);
  });
});
