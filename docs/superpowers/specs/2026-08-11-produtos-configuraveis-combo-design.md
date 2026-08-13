# Produtos Configuráveis — Combo Salgado + Combo Açaí

## Goal

Permitir ao lojista cadastrar **produtos configuráveis** no painel, com dois tipos distintos e independentes:

1. **Combo Salgado** (ex. 50 salgadinhos): cliente distribui exatamente N unidades entre sabores, sem custo extra. Preço = fixo do combo.
2. **Combo Açaí** (ex. 500ml): cliente escolhe acréscimos (Oreo, Aveia...). N primeiros grátis, demais pagam preço individual configurável. Teto máximo de acréscimos.

Ambos usam o mesmo campo `config` no Produto, mas com **schemas JSON separados** — nunca misturados.

## Regras de Negócio

### Combo Salgado (`combo_salgado`)
- Cliente distribui **exatamente** `unidades` entre os sabores da lista.
- Sabores **sem preço** — inclusos no valor total do combo.
- PDV valida soma das unidades = `unidades` exato (não permite mais nem menos).

### Combo Açaí (`combo_acai`)
- Cliente escolhe acréscimos da lista.
- **N grátis** = os **primeiros N clicados** (ordem de seleção), contam como grátis.
- Acréscimos além dos N grátis pagam `preco` individual de cada um.
- **Teto máximo** `maxAcrescimos` — bloqueia seleção além.
- Preço final = preço fixo do açaí + soma dos acréscimos pagos.

## Modelo de Dados

Adicionar 1 coluna no Produto. Campo `type` já existe, agora passa a ser configurável pelo painel.

```prisma
type    Int   @default(0)   // já existe — produtos configuráveis usam type = 3 (combo, reuso)
config  Json?               // novo — JSONB
```

**Decisão de `type`:** o PDV decide o comportamento pelo `config.tipo`, **não** pelo campo `type`. Produtos configuráveis reusam `type = 3` (combo) para manter compatibilidade com cart/mini-cart existentes (tratam `type===3` como combo sem controle de qtd). A presença de `config` distingue configurável de combo legado. Sem número mágico novo.

### Schema JSON — Combo Salgado
```json
{
  "tipo": "combo_salgado",
  "unidades": 50,
  "sabores": ["Coxinha", "Pastel", "Esfirra"]
}
```

### Schema JSON — Combo Açaí
```json
{
  "tipo": "combo_acai",
  "acrescimosGratis": 3,
  "maxAcrescimos": 5,
  "acrescimos": [
    { "nome": "Oreo", "preco": 2.00 },
    { "nome": "Aveia", "preco": 1.00 }
  ]
}
```

## Arquitetura

Fluxo de pedido inalterado — `sabores` continua string JSON em `ItensPedido`. O `config` apenas orienta o seletor do PDV.

```
Painel (config + type) ──► API /produtos ──► Produto.config (JSONB)
                                                        │
PDV clica no produto ──────────────────────────────────► ler config
                                                        │
                        combo_salgado ──► seletor unidades/sabores
                        combo_acai    ──► seletor acréscimos (N grátis, preço, teto)
                                                        │
                                        item.sabores (JSON) ──► pedido
```

## Componentes

### Painel (`js/painel.js` + `painelLoja.html`)
- Form de produto ganha bloco **"Tipo de Produto"**: dropdown `Simples | Combo Salgado | Combo Açaí`.
- Combo Salgado: campo `unidades` + lista de sabores (input + adicionar/remover).
- Combo Açaí: `acrescimosGratis`, `maxAcrescimos` + lista de acréscimos (nome + preço).
- Payload envia `type = 3` + `config` JSON.
- Tabela de produtos mostra badge do tipo.
- Edição: ao carregar produto existente, repreenche os campos dinâmicos a partir do `config`.

### PDV (`balcao.html`)
- `adicionarAoCarrinho`: se `produto.config?.tipo` existe, abre seletor conforme `tipo`.
- **combo_salgado**: lista sabores com input numérico. Valida soma = `unidades`. Preço fixo.
- **combo_acai**: lista acréscimos (checkbox). Marca N grátis = primeiros clicados; demais somam `preco`. Bloqueia em `maxAcrescimos`.
- `item.sabores` = `{nome: qtd}` (salgado) ou `{nome: 1}` (açaí) — compatível com exibição atual no admin.
- Cart/mini-cart exibem sabores/acréscimos + adicionais cobrados.

### Backend
- `productService.criar/atualizar`: `config` passa no payload. Sanitizar nomes (strip de tags) dentro de `config`.
- `sqlRepository`: create/update já usam `{...rest}`, então JSONB persiste automático. `buscarProduto` retorna `config`.
- Auditoria: já loga campos alterados; `config` entra em `changedFields`.

## Cálculo de Preço — Helper

Função compartilhada (unit-testável):

```js
// combo_acai
function calcularPrecoAcai(config, escolhidos) {
  const gratis = escolhidos.slice(0, config.acrescimosGratis);
  const pagos = escolhidos.slice(config.acrescimosGratis);
  const extra = pagos.reduce((s, nome) => {
    const op = config.acrescimos.find(a => a.nome === nome);
    return s + (op ? Number(op.preco) : 0);
  }, 0);
  return { extra, gratis, pagos };
}
```

## Erros e Validação

- Painel: `unidades` >= 1; `maxAcrescimos` >= `acrescimosGratis`; acréscimos sem duplicar nome; preço >= 0.
- PDV salgado: bloqueia finalizar se soma != `unidades`.
- PDV açaí: bloqueia marcar além de `maxAcrescimos`.
- Backend: rejeita `config` com nomes vazios ou preço negativo; `type` inválido rejeitado.

## Testes

- **Unit (vitest)**: `calcularPrecoAcai` — N grátis = primeiros; max bloqueia; preço dos pagos correto. Validação de `config` (limites, duplicados, preço negativo).
- **E2E (playwright)**: painel salva combo com config → PDV abre seletor certo → valida limites → total correto.
- **Regressão**: produtos simples e combos antigos (type 3/6) continuam funcionando.

## Arquivos

| File | Mudança |
|------|---------|
| `backend/prisma/schema.prisma` | `Produto.config Json?` |
| `backend/prisma/ensureColumns.js` | ALTER TABLE adiciona `config JSONB` |
| `backend/src/services/productService.js` | sanitizar `config`; passar no payload |
| `backend/src/repositories/sqlRepository.js` | confirmar `config` persiste em create/update |
| `painelLoja.html` | bloco Tipo de Produto + campos dinâmicos |
| `js/painel.js` | montar `config`/`type`; repreenchimento na edição; badge tipo |
| `balcao.html` | seletor genérico combo_salgado/combo_acai |
| `tests/comboConfig.test.js` | unit tests `calcularPrecoAcai` + validação |

## Fora de Escopo

- Nenhuma mudança em: cardápio público (`index.html`), fluxo de pedido, `ItensPedido`, relatórios.
- Sem nova tabela de opções (JSON escolhido sobre tabela).
