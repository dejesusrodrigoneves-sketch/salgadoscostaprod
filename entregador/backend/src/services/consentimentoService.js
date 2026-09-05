// ===== consentimentoService.js — LGPD Art. 8 — lógica pura (testável sem DB) =====

const POLITICA_VERSAO = 2;

// Art. 8 §1/§4: consentimento livre, informado, inequívoco e com finalidade determinada.
// Contrato: `aceitePoliticas === true` e `consentVersion` (string 'v2.0' ou int 2).
// Retorna `{ ok: true, versao: 2 }` ou `{ ok: false, erro: '<msg>' }`.
function validarConsentimento(body) {
  if (!body || body.aceitePoliticas !== true) {
    return { ok: false, erro: 'Consentimento da Política de Privacidade obrigatório' };
  }
  if (typeof body.consentVersion === 'string' && body.consentVersion.trim() !== '') {
    const major = parseInt(body.consentVersion.trim().replace('v', ''), 10);
    return { ok: true, versao: isNaN(major) ? POLITICA_VERSAO : major };
  }
  if (typeof body.consentVersion === 'number') {
    return { ok: true, versao: body.consentVersion };
  }
  return { ok: true, versao: POLITICA_VERSAO };
}

module.exports = { POLITICA_VERSAO, validarConsentimento };