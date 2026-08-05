import { describe, it, expect } from 'vitest';
import {
  formatarAcao,
  formatarSeveridade,
  SEVERIDADE_CLASSES,
  buildQueryParams,
  MODULOS,
} from '../js/superadmin-audit.js';

describe('formatarAcao', () => {
  it('traduz ações conhecidas', () => {
    expect(formatarAcao('cliente.register')).toBe('Cadastro de cliente');
    expect(formatarAcao('cliente.login_failed')).toBe('Login de cliente falhou');
    expect(formatarAcao('whatsapp.qr_gerado')).toBe('QR gerado');
    expect(formatarAcao('auth.login')).toBe('Login');
    expect(formatarAcao('pedido.create')).toBe('Pedido criado');
  });
  it('fallback para ação desconhecida', () => {
    expect(formatarAcao('modulo.desconhecido')).toBe('modulo.desconhecido');
  });
});

describe('formatarSeveridade', () => {
  it('mapeia severidades', () => {
    expect(formatarSeveridade('info')).toBe('Info');
    expect(formatarSeveridade('warning')).toBe('Aviso');
    expect(formatarSeveridade('critical')).toBe('Crítico');
  });
  it('fallback para valor desconhecido', () => {
    expect(formatarSeveridade('weird')).toBe('weird');
  });
  it('expõe classes de severidade', () => {
    expect(SEVERIDADE_CLASSES).toEqual({
      info: 'severity-info',
      warning: 'severity-warning',
      critical: 'severity-critical',
    });
  });
});

describe('MODULOS', () => {
  it('contém os módulos conhecidos', () => {
    expect(MODULOS).toEqual(['cliente', 'whatsapp', 'auth', 'pedido', 'geral']);
  });
});

describe('buildQueryParams', () => {
  it('converte datas para ISO local', () => {
    const qs = buildQueryParams({ dataInicio: '2026-08-01', dataFim: '2026-08-04' });
    expect(qs).toContain('dataInicio=2026-08-01T00%3A00%3A00');
    expect(qs).toContain('dataFim=2026-08-04T23%3A59%3A59');
  });
  it('omite campos vazios', () => {
    expect(buildQueryParams({ module: '', severity: undefined, page: 1 })).toBe('page=1');
  });
  it('mantém actorId anon', () => {
    expect(buildQueryParams({ actorId: 'anon' })).toBe('actorId=anon');
  });
  it('inclui todos os filtros preenchidos', () => {
    const qs = buildQueryParams({ actorId: '5', module: 'whatsapp', severity: 'critical', page: 2, limit: 50 });
    expect(qs).toBe('actorId=5&module=whatsapp&severity=critical&page=2&limit=50');
  });
});
