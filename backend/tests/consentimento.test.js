import { describe, it, expect } from 'vitest';
import { validarConsentimento, POLITICA_VERSAO } from '../src/services/consentimentoService.js';

describe('validarConsentimento (LGPD Art. 8)', () => {
  it('aceita consentimento explícito com versão', () => {
    const r = validarConsentimento({ aceitePoliticas: true, consentVersion: 'v1.0' });
    expect(r.ok).toBe(true);
    expect(r.versao).toBe(1);
  });

  it('aceita consentimento sem versão → usa versão padrão', () => {
    const r = validarConsentimento({ aceitePoliticas: true });
    expect(r.ok).toBe(true);
    expect(r.versao).toBe(POLITICA_VERSAO);
  });

  it('rejeita sem aceitePoliticas (campo ausente → 400)', () => {
    const r = validarConsentimento({ nome: 'João', telefone: '21999999999' });
    expect(r.ok).toBe(false);
    expect(r.erro).toContain('obrigatório');
  });

  it('rejeita aceitePoliticas falso (consentimento não inequívoco)', () => {
    const r = validarConsentimento({ aceitePoliticas: false });
    expect(r.ok).toBe(false);
  });

  it('rejeita body nulo', () => {
    const r = validarConsentimento(null);
    expect(r.ok).toBe(false);
  });
});