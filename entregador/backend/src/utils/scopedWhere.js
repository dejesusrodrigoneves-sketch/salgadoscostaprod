function scopedWhere(ctx, extra = {}) {
  // Superadmin em admin.sua-app.com (empresaId null) => sem filtro de empresa
  if (ctx && ctx.role === 'superadmin' && !ctx.empresaId) {
    return extra;
  }
  return { empresaId: ctx?.empresaId, ...extra };
}

module.exports = scopedWhere;
