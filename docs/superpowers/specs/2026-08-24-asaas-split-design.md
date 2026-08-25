# Asaas Split + Weekly Transfer - Design Spec

**Date:** 2026-08-24
**Status:** Approved v3

---

## Context

SIC-IA multi-tenant processes PIX payments via Asaas. Money goes to platform main account. Settlement calculates 98% empresa / 2% but does NOT transfer. Empresa doesn't receive automatically.

**Goal:** Lojista provides email + CPF/CNPJ + PIX key. Backend creates Asaas subconta. Payments accumulate Mon-Fri. Saturday settlement processes. Monday transfer to lojista's PIX.

---

## Weekly Flow

| Day | What Happens |
|-----|--------------|
| Mon-Fri | Customer pays PIX → split → 98% accumulates in subconta wallet |
| Saturday | Settlement job runs → calculates total → creates scheduled transfer for Monday |
| Monday | Asaas executes transfer → lojista receives in PIX |

---

## Lojista Form (One Screen)

PainelLoja > "Receber Pagamentos" tab:

- **Email** (obrigatório pro Asaas)
- **CPF ou CNPJ** (dono da empresa)
- **Chave PIX** (CPF, CNPJ, email, telefone, ou EVP)
- **Tipo da chave** (CPF | CNPJ | EMAIL | PHONE | EVP)

All other data (nome, endereco, telefone) comes from existing Empresa record.

---

## Schema Changes

### Empresa (Prisma) - 9 fields to add

- email String? - Email da empresa
- cpfCnpj String? - CPF ou CNPJ do dono
- pixKey String? - Chave PIX do lojista
- pixKeyType String? - Tipo: CPF, CNPJ, EMAIL, PHONE, EVP
- asaasSubcontaId String? - Asaas subconta ID
- asaasWalletId String? - walletId for splits
- asaasApiKey String? - subconta API key (encrypted AES-256-GCM)
- asaasOnboarded Boolean @default(false)
- asaasCreatedAt DateTime?

### WeeklySettlement (Prisma) - 4 fields to add

- splitStatus String? @default("manual") - 'auto' | 'manual' | 'failed'
- splitError String? - error message if split failed
- transferId String? - Asaas transfer ID
- transferStatus String? - 'scheduled' | 'executed' | 'failed'

---

## Asaas Client - 3 New Functions

### criarSubconta({ nome, email, cpfCnpj, phone, address })

POST /v3/accounts. Returns { id, apiKey, walletId }.
Uses platform token.

### criarPixComSplit({ customerId, valor, descricao, dueDate, splits })

POST /v3/payments with split array.
splits = [{ walletId, percentualValue: 98 }]
Uses platform token.

### agendarTransferencia({ accessToken, valor, pixAddressKey, pixAddressKeyType, scheduleDate, description })

POST /v3/transfers with scheduleDate.
Returns { id, status }.

**IMPORTANT:** Must use the SUBconta's apiKey (decrypted asaasApiKey) as access_token, NOT the platform token.
Money sits in the subconta wallet, so transferring out requires authenticating as the subconta.

### consultarSaldo({ accessToken })

GET /v3/accounts/{subcontaId}/balance (or wallets endpoint).
Returns available balance of subconta wallet. Used to cap transfer amount and avoid insufficient-balance failures.
Uses subconta apiKey.

### Encryption

- asaasApiKey encrypted with AES-256-GCM
- Key from env: ASAAS_SUBCONTA_KEY
- Helpers in backend/src/utils/crypto.js
- Decrypt asaasApiKey before any subconta-scoped call (transfer, balance)

---

## Payment Flow

### criarPixPedido() changes

1. Existing customer creation stays
2. Lookup empresa -> check asaasWalletId + asaasOnboarded
3. If both present:
   a. Add split { walletId, percentualValue: 98 }
   b. Call criarPixComSplit
4. Money accumulates in subconta wallet (no transfer yet)
5. Log PIX_SPLIT_CREATED

### Fallback

- No walletId or not onboarded: PIX without split (current behavior)
- Settlement marks splitStatus: 'manual'

---

## Settlement Flow (Saturday Job)

### Modified fecharSemana()

1. Calculate totals (existing logic)
2. Create settlement record with splitStatus
3. If empresa.asaasOnboarded && empresa.pixKey:
   a. Decrypt asaasApiKey (subconta token)
   b. Query subconta balance via consultarSaldo(accessToken)
   c. transferAmount = min(totalLiquido, availableBalance) - avoids insufficient-balance
   d. Get next business day (Monday, skipping weekends + feriados)
   e. Call agendarTransferencia({
        accessToken,
        valor: transferAmount,
        pixAddressKey: empresa.pixKey,
        pixAddressKeyType: empresa.pixKeyType,
        scheduleDate: nextBusinessDay,
        description: `Settlement ${weekStart} - ${weekEnd}`
      })
   f. Save transferId + transferStatus: 'scheduled'
   g. Audit log: 'settlement.transfer_scheduled'
4. If transfer fails:
   a. Mark transferStatus: 'failed'
   b. Log error
   c. Can retry manually

### transferAmount calculation

- Split percentualValue is on Asaas NET value (after Asaas fees), not gross.
- Settlement totalLiquido must reflect actual wallet receipt.
- Use `env.asaasPixFeePercent` (2%) consistently, and cap at actual subconta balance.
- Do NOT hardcode 98.

### Next Business Day (feriado fallback)

```javascript
// backend/src/utils/businessDays.js
const FERIADOS_NACIONAIS = [
  '01-01', // Ano Novo
  '02-12', // Carnaval (2024) - configurable
  '04-21', // Tiradentes
  '05-01', // Dia do Trabalho
  '09-07', // Independencia
  '10-12', // Nossa Senhora Aparecida
  '11-02', // Finados
  '11-15', // Proclamacao da Republica
  '12-25', // Natal
];

function getNextBusinessDay(date) {
  const d = new Date(date);
  d.setDate(d.getDate() + 1); // start from next day
  while (d.getDay() === 0 || d.getDay() === 6 || isFeriado(d)) {
    d.setDate(d.getDate() + 1);
  }
  d.setHours(0, 0, 0, 0);
  return d;
}

function isFeriado(date) {
  const mmdd = date.toISOString().slice(5, 10);
  return FERIADOS_NACIONAIS.includes(mmdd);
}
```

- Feriados are fixed-date national holidays in a static table (deterministic, no network dependency).
- Municipal/state holidays NOT covered (documented limitation; can extend table later).
- Weekend always skipped.

### Settlement status lifecycle

- status stays 'pendente' while transfer is 'scheduled'
- status becomes 'pago' when Asaas webhook confirms transfer executed (TRANSFER_RECEIVED)
- This keeps existing confirmarPagamento flow: it now listens for transfer completion instead of per-payment

---

## Status Display

### Settlement splitStatus

- auto: "Split processado automaticamente"
- manual: "Configure dados bancarios"
- failed: "Erro no split"

### Settlement transferStatus

- scheduled: "Transferencia agendada para segunda"
- executed: "Transferencia concluida"
- failed: "Erro na transferencia"
- null: "Sem transferencia"

---

## Frontend - PainelLoja

### Tab: "Receber Pagamentos"

**State 1: Not configured**
- Title: "Receba seus pagamentos automaticamente"
- Description: "Preencha seus dados para receber o valor dos pedidos toda segunda-feira."
- Form: email, CPF/CNPJ, chave PIX, tipo da chave
- Button: "Ativar Pagamento Automatico"

**State 2: Active**
- Green badge: "Pagamento Automatico Ativo"
- Shows: email, CPF/CNPJ (masked), PIX key (masked)
- Shows: "Proximo pagamento: segunda-feira, [date]"
- Buttons: "Atualizar Dados" / "Desativar"

**State 3: Error**
- Red badge with error message
- Button: "Tentar novamente"

### API Endpoints

- POST /api/empresa/payment/setup - create subconta
- GET /api/empresa/payment/status - check status + next transfer
- PUT /api/empresa/payment - update PIX data
- DELETE /api/empresa/payment - deactivate

---

## Error Handling

| Error | Action |
|-------|--------|
| Subconta creation fails | Return error, empresa stays pending |
| Split fails on payment | PIX created without split, settlement marked failed |
| Scheduled transfer fails | Mark transferStatus: 'failed', log, can retry |
| Insufficient balance | Transfer fails, retry next business day |
| Invalid PIX key | Reject at setup, validate format |

---

## Monitoring

### Audit Logs
- settlement.split_status
- settlement.transfer_scheduled
- settlement.transfer_executed
- settlement.transfer_failed

### App Logs
- PIX_SPLIT_CREATED
- PIX_SPLIT_FAILED
- TRANSFER_SCHEDULED
- TRANSFER_EXECUTED
- TRANSFER_FAILED
- SUBCONTA_CREATED
- SUBCONTA_FAILED

---

## Tests

### Unit
1. asaasClient.criarSubconta() - mock axios
2. asaasClient.criarPixComSplit() - mock axios
3. asaasClient.agendarTransferencia() - mock axios
4. paymentService.criarPixPedido() - verify split
5. settlementService.fecharSemana() - verify schedule transfer

### Integration
1. Empresa without walletId -> PIX without split
2. Empresa with walletId -> PIX with split
3. Settlement -> transfer scheduled for Monday
4. Transfer executed on Monday

---

## Migration

1. Add 9 columns to empresas table
2. Add 4 columns to weekly_settlements table
3. No data migration (all nullable/default)

---

## Security

- asaasApiKey encrypted (AES-256-GCM)
- Only superadmin can view payment details
- pixKey needed for transfers, stored plaintext
- ASAAS_SUBCONTA_KEY in env/secrets manager

---

## File Changes Summary

| File | Change |
|------|--------|
| `backend/prisma/schema.prisma` | Add 9 fields to Empresa, 4 to WeeklySettlement |
| `backend/src/utils/crypto.js` | NEW: encrypt/decrypt AES-256-GCM |
| `backend/src/utils/businessDays.js` | NEW: getNextBusinessDay + feriados |
| `backend/src/services/asaasClient.js` | Add criarSubconta, criarPixComSplit, agendarTransferencia, consultarSaldo |
| `backend/src/services/paymentService.js` | Add split to criarPixPedido (no auto-transfer) |
| `backend/src/services/settlementService.js` | Add splitStatus + scheduled transfer + status lifecycle |
| `backend/src/services/paymentSetupService.js` | NEW: onboarding logic |
| `backend/src/controllers/paymentController.js` | NEW: setup/status/update/deactivate |
| `backend/src/routes/paymentSetupRoutes.js` | NEW: routes (separate from existing paymentRoutes) |
| `js/painel.js` | Add payment config functions |
| `painelLoja.html` | Add "Receber Pagamentos" tab |
| `superadmin.html` | Add split status modal |
| `backend/tests/asaasClient.test.js` | Add tests |
| `backend/tests/paymentService.test.js` | Add tests |
| `backend/tests/settlementService.test.js` | NEW: settlement + transfer tests |
| `backend/tests/businessDays.test.js` | NEW: feriado/weekend tests |

---

## Scope

### In Scope
- Schema changes (Empresa + WeeklySettlement)
- Asaas client new functions
- Payment flow with split (no auto-transfer)
- Settlement with scheduled transfer (Monday)
- PainelLoja "Receber Pagamentos" tab
- Superadmin payment visibility
- Unit + integration tests

### Out of Scope
- Multi-currency support
- International payments
- Invoice generation
- Per-payment transfers
