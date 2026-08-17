# Progress Ledger — PIX via Asaas

Plan: `docs/superpowers/plans/2026-08-15-pix-asaas.md`
Branch: `feat/pix-asaas`
Constraint: sem commitar (no commits until authorized)

| Task | Status | Tests | Review |
|------|--------|-------|--------|
| 1. Prisma schema | ✅ done | schema OK | verified |
| 2. env.js + .env.example | ✅ done | boot OK | verified |
| 3. asaasClient.js + test | ✅ done | 2/2 pass | ESM deviation noted |
| 4. paymentService.js + test | ✅ done | 4/4 pass | ESM deviation noted |
| 5. sqlRepository additions | ✅ done | smoke OK | verified |
| 6. Routes + app.js + test | ✅ done | 2/2 pass | ESM + supertest added |
| 7. publicController PIX branch | ✅ done | boot OK | verified |
| 8. Admin tabs | ✅ done | syntax OK | verified |
| 9. Frontend cart/PIX/SSE | ✅ done | syntax OK | verified |
| 10. Docs + regression | ✅ done | 52/54 pass | 2 pre-existing failures |

**Regression:** 52/54 (96%). 8/8 new PIX tests pass. 2 failures pre-existing (entregaService assertion drift, sqlRepository Neon timeout).
