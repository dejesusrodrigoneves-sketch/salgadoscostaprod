function normalizarSlug(slug) {
  if (typeof slug !== 'string') return '';
  return slug
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9-]/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-+|-+$/g, '');
}

module.exports = { normalizarSlug };
