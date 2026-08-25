# Asaas Split + Weekly Transfer - Implementation Plan

**Date:** 2026-08-24
**Spec:** docs/superpowers/specs/2026-08-24-asaas-split-design.md

---

## Phase 1: Schema + Infrastructure

### Task 1.1: Prisma Schema Migration
- Add 9 fields to Empresa model
- Add 4 fields to WeeklySettlement model
- Run `npx prisma migrate dev`
- **Files:** `backend/prisma/schema.prisma`

### Task 1.2: Crypto Utility
- Create `backend/src/utils/crypto.js`
- Functions: encrypt(text), decrypt(encrypted)
- AES-256-GCM with env var ASAAS_SUBCONTA_KEY
- **Files:** `backend/src/utils/crypto.js` (NEW)

### Task 1.4: Business Days Utility
- Create `backend/src/utils/businessDays.js`
- Functions: getNextBusinessDay(date), isFeriado(date)
- Skips weekends + fixed national holidays (static table)
- Deterministic, no network dependency
- **Files:** `backend/src/utils/businessDays.js` (NEW)

### Task 1.3: Env Config
- Add ASAAS_SUBCONTA_KEY to env.js
- Document in README
- **Files:** `backend/src/config/env.js`

---

## Phase 2: Asaas Client

### Task 2.1: criarSubconta()
- POST /v3/accounts
- Input: { nome, email, cpfCnpj, phone, address }
- Output: { id, apiKey, walletId }
- **Files:** `backend/src/services/asaasClient.js`

### Task 2.2: criarPixComSplit()
- Modify existing criarPix() to accept splits parameter
- Add split array to POST /v3/payments body
- **Files:** `backend/src/services/asaasClient.js`

### Task 2.3: agendarTransferencia()
- POST /v3/transfers with scheduleDate
- Input: { accessToken, valor, pixAddressKey, pixAddressKeyType, scheduleDate, description }
- **IMPORTANT:** accessToken must be the SUBconta's apiKey (decrypted asaasApiKey), NOT platform token
- Output: { id, status }
- **Files:** `backend/src/services/asaasClient.js`

### Task 2.4: consultarSaldo()
- GET /v3/accounts/{subcontaId}/balance
- Input: { accessToken, subcontaId }
- Output: available balance
- Uses subconta apiKey
- Used to cap transfer amount (avoid insufficient balance)
- **Files:** `backend/src/services/asaasClient.js`

### Task 2.5: Unit Tests
- Mock axios for each new function
- Test success + error cases
- Test that agendarTransferencia passes subconta token
- **Files:** `backend/tests/asaasClient.test.js`

---

## Phase 3: Payment Setup Service

### Task 3.1: paymentSetupService.js
- `setup(empresaId, { email, cpfCnpj, pixKey, pixKeyType })`
  - Validate inputs
  - Get existing empresa data
  - Call asaasClient.criarSubconta()
  - Encrypt apiKey
  - Save to Empresa: asaasSubcontaId, asaasWalletId, asaasApiKey, asaasOnboarded, asaasCreatedAt, email, cpfCnpj, pixKey, pixKeyType
  - Audit log: 'empresa.payment_setup'
- `getStatus(empresaId)`
  - Return onboarding status + last settlement splitStatus + next Monday
- `update(empresaId, { pixKey, pixKeyType })`
  - Update PIX data only
  - Validate PIX key format
- `deactivate(empresaId)`
  - Clear asaas fields
  - Audit log: 'empresa.payment_deactivated'
- **Files:** `backend/src/services/paymentSetupService.js` (NEW)

### Task 3.2: Payment Controller
- POST /api/empresa/payment/setup
- GET /api/empresa/payment/status
- PUT /api/empresa/payment
- DELETE /api/empresa/payment
- All require authenticate + authorize
- **Files:** `backend/src/controllers/paymentController.js` (NEW)

### Task 3.3: Payment Setup Routes
- Create `backend/src/routes/paymentSetupRoutes.js` (SEPARATE from existing paymentRoutes.js)
- Wire up controller to routes
- Apply auth middleware (authenticate + authorize admin/superadmin)
- **Files:** `backend/src/routes/paymentSetupRoutes.js` (NEW)

### Task 3.4: Register Routes in app.js
- Import paymentSetupRoutes
- Mount at /api/empresa/payment
- **NOTE:** existing paymentRoutes stays mounted at /api/payment (SSE + refund) - do NOT replace it
- **Files:** `backend/src/app.js`

### Task 3.5: Unit Tests
- Test setup flow
- Test validation
- Test deactivate
- **Files:** `backend/tests/paymentSetupService.test.js` (NEW)

---

## Phase 4: Payment Flow with Split

### Task 4.1: Modify paymentService.criarPixPedido()
- After existing customer creation:
  - Lookup empresa
  - If asaasOnboarded && asaasWalletId:
    - Add split { walletId: empresa.asaasWalletId, percentualValue: 98 }
    - Call criarPixComSplit instead of criarPix
  - Else: call criarPix (current behavior)
- Log PIX_SPLIT_CREATED
- NO auto-transfer (money accumulates in wallet)
- **Files:** `backend/src/services/paymentService.js`

### Task 4.2: Update Tests
- Test split flow with mocked asaas
- Test fallback without split
- **Files:** `backend/tests/paymentService.test.js`

---

## Phase 5: Settlement + Scheduled Transfer

### Task 5.1: Modify fecharSemana()
- After creating settlement:
  - Lookup empresa
  - Set splitStatus = asaasOnboarded ? 'auto' : 'manual'
  - If asaasOnboarded && pixKey:
    - Decrypt asaasApiKey (subconta token)
    - Query subconta balance via consultarSaldo
    - transferAmount = min(totalLiquido, availableBalance)
    - Get next business day (weekends + feriados) via getNextBusinessDay
    - Call agendarTransferencia({
        accessToken: decrypted,
        valor: transferAmount,
        pixAddressKey: empresa.pixKey,
        pixAddressKeyType: empresa.pixKeyType,
        scheduleDate: nextBusinessDay,
        description: `Settlement ${weekStart} - ${weekEnd}`
      })
    - Save transferId + transferStatus: 'scheduled'
  - Save settlement
- transferAmount uses env.asaasPixFeePercent (NOT hardcoded 98)
- **Files:** `backend/src/services/settlementService.js`

### Task 5.2: getNextBusinessDay (feriado fallback)
- Import getNextBusinessDay from businessDays.js
- Falls back to next business day when Monday is holiday/weekend
- Feriados: static national holiday table (deterministic, no API)
- Municipal/state holidays not covered (documented limitation)
- **Files:** `backend/src/utils/businessDays.js`, `backend/src/services/settlementService.js`

### Task 5.3: Settlement status lifecycle
- status stays 'pendente' while transfer 'scheduled'
- status becomes 'pago' when webhook confirms transfer executed (TRANSFER_RECEIVED)
- Update confirmarPagamento to listen for transfer completion
- **Files:** `backend/src/services/settlementService.js`, `backend/src/services/paymentService.js`

### Task 5.4: Settlement Tests
- Create `backend/tests/settlementService.test.js`
- Test settlement with splitStatus + scheduled transfer
- Test getNextBusinessDay calculation (weekend + feriado)
- Test transfer amount capped at balance
- **Files:** `backend/tests/settlementService.test.js` (NEW), `backend/tests/businessDays.test.js` (NEW)

---

## Phase 6: Frontend - PainelLoja

### Task 6.1: painelLoja.html Tab
- Add "Receber Pagamentos" tab in sidebar
- Add tab content div with:
  - Form (email, CPF/CNPJ, PIX key, tipo)
  - Status display
  - Action buttons
- **Files:** `painelLoja.html`

### Task 6.2: painel.js Functions
- `carregarPaymentConfig()` - GET /api/empresa/payment/status
- `ativarPayment()` - POST /api/empresa/payment/setup
- `atualizarPayment()` - PUT /api/empresa/payment
- `desativarPayment()` - DELETE /api/empresa/payment
- `renderPaymentState(empresa)` - render form/status/error
- **Files:** `js/painel.js`

### Task 6.3: Form Validation
- Email format validation
- CPF/CNPJ validation (basic)
- PIX key format based on type
- **Files:** `js/painel.js`

---

## Phase 7: Superadmin

### Task 7.1: Empresas Modal Update
- Add split status icon (green/red/gray)
- Add payment details section:
  - walletId (full)
  - Subconta ID
  - Onboarded at
  - Last 5 settlements with splitStatus + transferStatus
- **Files:** `superadmin.html`

### Task 7.2: Admin Payment Endpoint
- DELETE /api/admin/empresa/:id/payment
- Allow superadmin to deactivate any empresa's split
- **Files:** `backend/src/controllers/adminController.js`, `backend/src/routes/adminRoutes.js`

---

## Phase 8: Integration Tests

### Task 8.1: End-to-End Flow
- Empresa without walletId -> PIX without split
- Empresa with walletId -> PIX with split
- Settlement -> transfer scheduled for Monday
- **Files:** `backend/tests/paymentService.test.js`

---

## Execution Order

1. Phase 1 (Schema + Infrastructure: crypto, businessDays) - foundation
2. Phase 2 (Asaas Client: subconta, split, transfer, saldo) - API layer
3. Phase 3 (Payment Setup: onboarding + rotas separadas) - onboarding
4. Phase 4 (Payment Flow: split, no auto-transfer) - core logic
5. Phase 5 (Settlement + Transfer agendada + feriado fallback) - weekly batch
6. Phase 6 (Frontend: painelLoja) - UI
7. Phase 7 (Superadmin) - admin tools
8. Phase 8 (Tests) - validation

---

## Dependencies

- Asaas sandbox account for testing
- ASAAS_SUBCONTA_KEY env var (for apiKey encryption)
- Prisma migrate for schema changes
- Subconta apiKey must be decrypted before transfer/balance calls

---

## Risk Mitigation

- Fallback: if no walletId, current behavior unchanged
- All new fields nullable: no breaking changes
- Scheduled transfer can fail: logged, settlement marked, retry possible
- PIX key validation before API calls
- Transfer amount capped at available balance (avoid insufficient-balance)
- Feriados: static national holiday table, deterministic, no network dependency
- Transfer auth uses subconta apiKey (decrypted), not platform token
- Existing paymentRoutes (SSE + refund) preserved at /api/payment
