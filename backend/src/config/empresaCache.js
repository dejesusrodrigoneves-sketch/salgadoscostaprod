import prisma from './prisma.js';

const cache = new Map();
const TTL_MS = 5 * 60 * 1000; // 5 minutos

export async function getEmpresaFromCache(slug) {
  const entry = cache.get(slug);
  if (entry && Date.now() < entry.expirouEm) {
    return entry.empresa;
  }

  const empresa = await prisma.empresa.findUnique({ where: { slug } });
  if (empresa) {
    cache.set(slug, { empresa, expirouEm: Date.now() + TTL_MS });
  } else {
    cache.set(slug, { empresa: null, expirouEm: Date.now() + 60000 });
  }
  return empresa;
}

export function invalidateEmpresaCache(slug) {
  cache.delete(slug);
}
