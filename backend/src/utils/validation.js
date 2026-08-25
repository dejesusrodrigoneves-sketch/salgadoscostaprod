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

module.exports = { MAX_LENGTHS, validateLength, validateMaxLen };
