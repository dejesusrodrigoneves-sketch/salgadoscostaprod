// Contrato FinancialMarketplaceProvider (adaptado, não TS):
// {
//   platform: 'SAAS'|'IFOOD'|'KEETA'|'NINEFOOD',
//   isConfigured(): boolean,
//   buildAuthorizeUrl(state): string|null,
//   exchangeCode(code): Promise<{accessToken, refreshToken, expiresIn, externalAccountId}>,
//   refreshToken(refreshToken): Promise<{accessToken, refreshToken, expiresIn}>,
//   revoke(accessToken): Promise<void>,
//   syncFinancialData(connection, from, to): Promise<NormalizedEntry[]>,
//   syncSettlements(connection, from, to): Promise<NormalizedSettlement[]>,
//   handleWebhook(payload): Promise<void>,
// }
export function isProvider(p) {
  return Boolean(p && typeof p.platform === 'string' && typeof p.isConfigured === 'function');
}

export default { isProvider };
