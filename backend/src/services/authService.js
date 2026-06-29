const bcrypt = require('bcryptjs');
const sql = require('../repositories/sqlRepository');

const SALT_ROUNDS = 10;

async function login(username, password, empresaId) {
  const user = await sql.buscarUsuario(username, empresaId);
  if (!user) throw Object.assign(new Error('Usuário não encontrado'), { status: 401 });

  const match = await bcrypt.compare(password, user.passwordHash);
  if (!match) throw Object.assign(new Error('Senha incorreta'), { status: 401 });

  const token = Buffer.from(JSON.stringify({
    id: user.id, username: user.username, role: user.role,
    empresaId: user.empresaId, lojaNome: user.lojaNome,
  })).toString('base64url');

  return { token, user: { id: user.id, username: user.username, role: user.role, lojaNome: user.lojaNome } };
}

async function criarUsuario(data) {
  const hash = await bcrypt.hash(data.password, SALT_ROUNDS);
  return sql.criarUsuario({ ...data, passwordHash: hash });
}

async function alterarSenha(userId, senhaAtual, novaSenha) {
  const user = await sql.buscarUsuarioPorId(userId);
  const match = await bcrypt.compare(senhaAtual, user.passwordHash);
  if (!match) throw Object.assign(new Error('Senha atual incorreta'), { status: 400 });
  const hash = await bcrypt.hash(novaSenha, SALT_ROUNDS);
  return sql.atualizarUsuario(userId, { passwordHash: hash });
}

async function criarConta({ username, password, lojaNome }) {
  // Check if user already exists
  const existing = await sql.buscarUsuario(username, 1);
  if (existing) throw Object.assign(new Error('Usuário já existe'), { status: 409 });

  // Find empresa by matching slug, or create
  let empresa = await sql.buscarEmpresaPorSlug(username);
  if (!empresa) {
    empresa = await sql.criarEmpresa({ nome: lojaNome || username, slug: username });
  }

  const hash = await bcrypt.hash(password, SALT_ROUNDS);
  const user = await sql.criarUsuario({
    empresaId: empresa.id,
    username,
    passwordHash: hash,
    lojaNome: lojaNome || username,
    role: 'admin',
  });

  const token = Buffer.from(JSON.stringify({
    id: user.id, username: user.username, role: user.role,
    empresaId: user.empresaId, lojaNome: user.lojaNome,
  })).toString('base64url');

  return { token, user: { id: user.id, username: user.username, role: user.role, lojaNome: user.lojaNome } };
}

module.exports = { login, criarUsuario, alterarSenha, criarConta };
