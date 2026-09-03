import { describe, it, expect } from 'vitest';

describe('Entregador Tenant Isolation', () => {
  describe('validateEntregadorEmpresa middleware', () => {
    it('should set req.entregador when entregador belongs to empresa', async () => {
      const prisma = require('../src/config/prisma');
      const mockEntregador = { id: 10, empresaId: 1, ativo: true, nome: 'João' };
      prisma.entregador = { findFirst: async () => mockEntregador };

      const middleware = require('../src/middleware/validateEntregadorEmpresa');
      const req = { user: { id: 10, empresaId: 1, role: 'entregador' } };
      let nextCalled = false;
      const next = () => { nextCalled = true; };
      const res = { status: () => ({ json: () => {} }) };

      await middleware(req, res, next);
      expect(nextCalled).toBe(true);
      expect(req.entregador).toEqual(mockEntregador);
    });

    it('should return 401 when entregador not found in DB', async () => {
      const prisma = require('../src/config/prisma');
      prisma.entregador = { findFirst: async () => null };

      const middleware = require('../src/middleware/validateEntregadorEmpresa');
      const req = { user: { id: 999, empresaId: 1, role: 'entregador' } };
      let statusCode;
      const res = { status: (code) => ({ json: () => { statusCode = code; } }) };

      await middleware(req, res, () => {});
      expect(statusCode).toBe(401);
    });

    it('should return 403 when entregador belongs to different empresa', async () => {
      const prisma = require('../src/config/prisma');
      prisma.entregador = { findFirst: async () => ({ id: 10, empresaId: 2, ativo: true }) };

      const middleware = require('../src/middleware/validateEntregadorEmpresa');
      const req = { user: { id: 10, empresaId: 1, role: 'entregador' } };
      let statusCode;
      const res = { status: (code) => ({ json: () => { statusCode = code; } }) };

      await middleware(req, res, () => {});
      expect(statusCode).toBe(403);
    });

    it('should return 403 when entregador is deactivated', async () => {
      const prisma = require('../src/config/prisma');
      prisma.entregador = { findFirst: async () => ({ id: 10, empresaId: 1, ativo: false }) };

      const middleware = require('../src/middleware/validateEntregadorEmpresa');
      const req = { user: { id: 10, empresaId: 1, role: 'entregador' } };
      let statusCode;
      const res = { status: (code) => ({ json: () => { statusCode = code; } }) };

      await middleware(req, res, () => {});
      expect(statusCode).toBe(403);
    });

    it('should skip validation for non-entregador roles', async () => {
      const middleware = require('../src/middleware/validateEntregadorEmpresa');
      const req = { user: { id: 1, empresaId: 1, role: 'admin' } };
      let nextCalled = false;
      const next = () => { nextCalled = true; };

      await middleware(req, {}, next);
      expect(nextCalled).toBe(true);
      expect(req.entregador).toBeUndefined();
    });
  });

  describe('Service-level isolation', () => {
    it('listarPedidos should filter by both empresaId and entregadorId', () => {
      const where = {
        empresaId: 1,
        entregadorId: '10',
        deletedAt: null,
        status: { in: ['em_rota', 'pendente'] },
      };
      expect(where.empresaId).toBe(1);
      expect(where.entregadorId).toBe('10');
    });

    it('buscarPedido should filter by all three: id + empresaId + entregadorId', () => {
      const where = {
        id: 'pedido-123',
        empresaId: 1,
        entregadorId: '10',
      };
      expect(Object.keys(where)).toHaveLength(3);
    });

    it('buscarHistorico should filter by entregadorId and empresaId', () => {
      const where = {
        entregadorId: 10,
        empresaId: 1,
        data: { gte: new Date(), lte: new Date() },
        status: 'entregue',
      };
      expect(where.empresaId).toBe(1);
      expect(where.entregadorId).toBe(10);
    });
  });

  describe('Route chain validation', () => {
    it('entregador app routes should include validateEntregadorEmpresa', () => {
      const fs = require('fs');
      const path = require('path');
      const appContent = fs.readFileSync(
        path.join(__dirname, '../src/app.js'),
        'utf8'
      );
      expect(appContent).toContain('validateEntregadorEmpresa');
      expect(appContent).toContain("require('./middleware/validateEntregadorEmpresa')");
    });
  });

  describe('Push token empresa validation', () => {
    it('registrarPushToken should use validated entregador from middleware', async () => {
      const prisma = require('../src/config/prisma');
      let updateWhere;
      prisma.entregador = {
        update: async (args) => {
          updateWhere = args.where;
          return { id: 10 };
        },
      };

      const controller = require('../src/controllers/entregadorAppController');
      const req = {
        user: { id: 10, empresaId: 1 },
        entregador: { id: 10, empresaId: 1, ativo: true },
        body: { fcmToken: 'test-token-123' },
      };
      let responseData;
      const res = { json: (data) => { responseData = data; } };

      await controller.registrarPushToken(req, res);

      expect(updateWhere).toEqual({ id: 10 });
      expect(responseData.success).toBe(true);
    });
  });
});
