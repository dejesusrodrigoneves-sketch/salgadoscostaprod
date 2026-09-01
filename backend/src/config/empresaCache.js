import prisma from './prisma.js';

const slugCache = new Map();
const idCache = new Map();
const TTL_MS = 5 * 60 * 1000; // 5 minutos

export async function getEmpresaFromCache(slug) {
  const entry = slugCache.get(slug);
  if (entry && Date.now() < entry.expirouEm) {
    return entry.empresa;
  }

  const empresa = await prisma.empresa.findUnique({ where: { slug } });
  if (empresa) {
    slugCache.set(slug, { empresa, expirouEm: Date.now() + TTL_MS });
  } else {
    slugCache.set(slug, { empresa: null, expirouEm: Date.now() + 60000 });
  }
  return empresa;
}

export async function getEmpresaFromIdCache(id) {
  const entry = idCache.get(id);
  if (entry && Date.now() < entry.expirouEm) {
    return entry.empresa;
  }

  const empresa = await prisma.empresa.findUnique({ where: { id } });
  if (empresa) {
    idCache.set(id, { empresa, expirouEm: Date.now() + TTL_MS });
  } else {
    idCache.set(id, { empresa: null, expirouEm: Date.now() + 60000 });
  }
  return empresa;
}

export function invalidateEmpresaCache(slug) {
  slugCache.delete(slug);
}
