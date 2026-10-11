// Input length validation utilities

const MAX_LENGTHS = {
  username: 50,
  password: 128,
  nome: 200,
  telefone: 20,
  email: 254,
  endereco: 300,
  bairro: 100,
  cidade: 100,
  estado: 2,
  cep: 10,
  descricao: 1000,
  slug: 100,
  codigo: 50,
  clienteNome: 200,
  clienteWhatsapp: 20,
  clienteEndereco: 300,
  clienteBairro: 100,
  clienteCep: 10,
  clienteReferencia: 200,
  total: 20,
  sabores: 500,
};

function validateLength(fieldName, value, maxLength) {
  if (value === undefined || value === null) return true;
  const len = maxLength || MAX_LENGTHS[fieldName];
  if (!len) return true;
  return String(value).length <= len;
}

function validateMaxLen(fieldName, value) {
  const maxLen = MAX_LENGTHS[fieldName];
  if (!maxLen) return { valid: true };
  if (value !== undefined && value !== null && String(value).length > maxLen) {
    return { valid: false, error: `${fieldName} deve ter no máximo ${maxLen} caracteres` };
  }
  return { valid: true };
}

function validateAnoAbertura(value) {
  if (value === undefined) return undefined;
  if (value === null || value === '') return null;
  const n = Number(value);
  if (!Number.isInteger(n) || n < 1900 || n > 2999) {
    const err = new Error('Ano de abertura deve ser um número inteiro entre 1900 e 2999');
    err.status = 400;
    throw err;
  }
  return n;
}

module.exports = { MAX_LENGTHS, validateLength, validateMaxLen, validateAnoAbertura };
