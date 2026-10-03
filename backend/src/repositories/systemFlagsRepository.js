const prisma = require('../config/prisma');

async function getFlag(key) {
  const r = await prisma.systemFlag.findUnique({ where: { key: String(key) } });
  return r ? r.value : null;
}

async function setFlag(key, value) {
  const k = String(key);
  const v = String(value);
  await prisma.systemFlag.upsert({ where: { key: k }, create: { key: k, value: v }, update: { value: v } });
  return v;
}

module.exports = { getFlag, setFlag };
