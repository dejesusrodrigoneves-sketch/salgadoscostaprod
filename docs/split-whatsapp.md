# Plano: Cadastro de Nome + Telefone ao criar Instância WhatsApp

## Objetivo

Ao criar uma instância em `whatsapp.html`, o usuário informa:
1. **Nome da instância** (ex: "WhatsApp Loja Matriz")
2. **Número de telefone da loja** (ex: "5511999999999")

Esses dados são enviados para a Evolution API no momento da criação e salvos no banco local, eliminando a captura tardia do telefone (que hoje só acontece após o pareamento).

---

## Status atual

### Fluxo atual de criação

```
whatsapp.html                    whatsappController.js        whatsappInstanceService.js
    │                                   │                             │
    | POST /api/whatsapp/criar          |                             |
    | (body: vazio — não envia nada)    |                             |
    ▼                                   ▼                             ▼
criarInstancia() →                service.criar(role) →       buildInstanceName()
                                                               → retorna 'loja_1' (HARDCODED)
                                                               → POST /instance/create
                                                                 { instanceName: 'loja_1',
                                                                   integration: 'WHATSAPP-BAILEYS',
                                                                   qrcode: true }
                                                               → salva no banco SEM phoneNumber
```

**Pontos problemáticos:**
- `criarInstancia()` no frontend faz POST sem body — não pergunta nome nem telefone
- `buildInstanceName()` retorna `'loja_1'` fixo — apenas uma instância possível
- `phoneNumber` só é preenchido depois, quando `status()` detecta o telefone retornado pela Evolution (`data.instance.phone.number`)
- Se o QR nunca for scaneado, o telefone nunca fica registrado (o `enviarTeste()` barra com "não possui número registrado")

### Modelo atual (`schema.prisma:244-258`)

```prisma
model WhatsAppInstance {
  id               Int       @id @default(autoincrement())
  empresaId        Int
  instanceId       String    // 'loja_1' hardcoded
  connectionStatus String    @default("disconnected")
  phoneNumber      String?   // opcional, preenchido após conexão
  qrCode           String?
  isActive         Boolean   @default(false)
  createdAt        DateTime
  updatedAt        DateTime
}
```

---

## O que muda em cada camada

### 1. Frontend — Modal de criação com formulário

**Arquivo:** `whatsapp.html`

**O que muda:**
- `criarInstancia()` abre modal (não chama API direto)
- Modal contém:
  - Campo **Nome da Instância** (text, obrigatório, placeholder: "WhatsApp Loja Matriz")
  - Campo **Número de Telefone** (text, obrigatório, placeholder: "5511999999999" ou "(11) 99999-9999")
  - Botão "Criar" e "Cancelar"
- Ao confirmar, faz POST `/api/whatsapp/criar` com body `{ instanceName, phoneNumber }`
- Antes de enviar: valida se `phoneNumber` tem pelo dígitos mínimos e formata como DDI+DDD+numero (remove não-dígitos)

**Campos do modal:**

```html
<div id="criarModal" class="modal-overlay" style="display:none;">
  <div class="modal-content">
    <h3><i class="fas fa-plus-circle"></i> Criar Instância WhatsApp</h3>
    <input id="inputInstanceName" type="text" placeholder="Nome da instância (ex: WhatsApp Matriz)" required />
    <input id="inputPhoneNumber" type="text" placeholder="Número da loja (ex: 5511999999999)" required />
    <div class="modal-actions">
      <button class="btn btn-primary" onclick="confirmarCriacao()">Criar</button>
      <button class="btn btn-ghost" onclick="fecharModal()">Cancelar</button>
    </div>
  </div>
</div>
```

**Estilos adicionais** (para modal):
- `.modal-overlay`: fundo escuro semi-transparente, flex center
- `.modal-content`: card branco, max-width 480px, padding 24px
- `#inputInstanceName`, `#inputPhoneNumber`: largura total, padding 10px, borda, font-size 14px
- `.modal-actions`: flex row, gap 8px, justify-content flex-end

**Funções novas no JS:**

```js
function criarInstancia() {
  document.getElementById('criarModal').style.display = 'flex';
}

function fecharModal() {
  document.getElementById('criarModal').style.display = 'none';
}

async function confirmarCriacao() {
  const instanceName = document.getElementById('inputInstanceName').value.trim();
  const phoneRaw = document.getElementById('inputPhoneNumber').value.trim();
  if (!instanceName) return toast('Informe o nome da instância', 'danger');
  if (!phoneRaw) return toast('Informe o número da loja', 'danger');
  const phoneNumber = phoneRaw.replace(/\D/g, '');
  if (phoneNumber.length < 10) return toast('Número inválido', 'danger');

  try {
    await apiRequest('/whatsapp/criar', {
      method: 'POST',
      body: JSON.stringify({ instanceName, phoneNumber }),
    });
    toast('Instância criada com sucesso!');
    fecharModal();
    // limpa campos
    document.getElementById('inputInstanceName').value = '';
    document.getElementById('inputPhoneNumber').value = '';
    carregarInstancias();
    const instancias = await apiRequest('/whatsapp');
    if (instancias.length > 0) gerarQR(instancias[0].id);
  } catch (e) {
    toast(e.message, 'danger');
  }
}
```

---

### 2. Backend — Controller aceita body

**Arquivo:** `backend/src/controllers/whatsappController.js`

**O que muda no `criar()`:**

```js
exports.criar = asyncHandler(async (req, res) => {
  const { instanceName, phoneNumber } = req.body;
  const resultado = await service.criar(req.user.role, instanceName, phoneNumber);
  res.status(201).json(resultado);
});
```

Atual: `service.criar(req.user.role)`  
Novo: `service.criar(req.user.role, instanceName, phoneNumber)`

---

### 3. Backend — Service aceita parâmetros e envia para Evolution API

**Arquivo:** `backend/src/services/whatsappInstanceService.js`

**O que muda:**

#### 3a. Remover `buildInstanceName()`

Remover função que retornava `'loja_1'` fixo.

#### 3b. `criar(role, instanceName, phoneNumber)` — novos parâmetros

```js
async function criar(role, instanceName, phoneNumber) {
  if (!instanceName || !phoneNumber) {
    throw Object.assign(new Error('Nome da instância e número de telefone são obrigatórios'), { status: 400 });
  }

  // Validação de role para quantidade de instâncias
  const existentes = await sql.listarWhatsAppInstances();
  if (role !== 'superadmin' && existentes.length >= 1) {
    throw Object.assign(new Error('Já existe uma instância. Delete a existente para criar uma nova.'), { status: 409 });
  }

  // Verifica se já existe instância com mesmo nome
  const jaExisteMesmoNome = existentes.find(i => i.instanceId === instanceName);
  if (jaExisteMesmoNome) {
    throw Object.assign(new Error('Já existe uma instância com este nome.'), { status: 409 });
  }

  // Envia para Evolution API com número
  let evolutionData = null;
  if (config.evolutionUrl && config.evolutionApiKey) {
    try {
      const { data } = await axios.post(
        `${config.evolutionUrl}/instance/create`,
        {
          instanceName,
          integration: 'WHATSAPP-BAILEYS',
          qrcode: true,
          number: phoneNumber,  // ← NOVO: envia número para Evolution
        },
        { headers: { apikey: config.evolutionApiKey } }
      );
      evolutionData = data;
    } catch (err) {
      // ... mesmo tratamento de erro
    }
  }

  // Salva no banco com phoneNumber preenchido
  const instancia = await sql.criarWhatsAppInstance({
    empresaId: 1,
    instanceId: instanceName,
    phoneNumber,  // ← NOVO: salva no banco imediatamente
    connectionStatus: evolutionData ? 'qrcode' : 'disconnected',
    qrCode: evolutionData?.qrcode?.code || evolutionData?.qrcode?.pairingCode || null,
    isActive: true,
  });

  return { instancia, evolutionData };
}
```

**Observação:** o `number` field na Evolution API é usado principalmente para Business API, mas para Baileys ele também é aceito e fica registrado no dashboard da Evolution.

---

### 4. Frontend — Exibição do telefone na listagem

**Arquivo:** `whatsapp.html`

O código atual já exibe o telefone:

```html
<div class="instance-detail">
  ${inst.phoneNumber
    ? '<i class="fas fa-phone"></i> <strong>' + inst.phoneNumber + '</strong>'
    : '<i class="fas fa-phone-slash"></i> Número não registrado'}
</div>
```

Como agora `phoneNumber` vem preenchido desde a criação, a mensagem "Número não registrado" não aparecerá mais (a menos que o admin não preencha, o que a validação no frontend impede).

---

### 5. Backend — Ajuste no teste (opcional, para robustez)

**Arquivo:** `whatsappController.js:44`

A verificação atual:
```js
if (!instancia.phoneNumber) {
  return res.status(400).json({ error: 'Instância não possui número de telefone registrado' });
}
```

Após a mudança, o phoneNumber sempre existirá (criação exige). Mas manter a validação como fallback é seguro.

---

## Resumo de arquivos alterados

| Arquivo | Tipo | Mudança |
|---------|------|---------|
| `whatsapp.html` | Frontend | Modal de criação com inputs nome + telefone; substitui chamada direta |
| `backend/src/controllers/whatsappController.js` | Backend | Extrair `instanceName` e `phoneNumber` do `req.body` e passar ao service |
| `backend/src/services/whatsappInstanceService.js` | Backend | Aceitar parâmetros; enviar `number` à Evolution API; salvar phoneNumber no banco |
| `backend/src/repositories/sqlRepository.js` | Backend | Nenhuma mudança necessária — `criarWhatsAppInstance` já aceita `phoneNumber` |

---

## Impacto

- **Positivo**: Telefone registrado de imediato, sem depender de pareamento
- **Positivo**: Nome customizável da instância (não mais `'loja_1'` fixo)
- **Positivo**: Evolution API passa a receber o número, que aparece no dashboard
- **Negativo**: Usuários que já tinham instância criada sem telefone continuarão sem — podem editar manualmente (fora do escopo deste plano) ou recriar a instância
- **Risco mínimo**: A Evolution API aceita `number` como opcional para Baileys, então instâncias existentes continuam funcionando

---

## Ordem de implantação

1. **Backend** — Alterar `whatsappInstanceService.js` (aceitar parâmetros, enviar número à Evolution)
2. **Backend** — Alterar `whatsappController.js` (extrair body)
3. **Frontend** — Adicionar modal + lógica em `whatsapp.html`
4. **Teste manual** — Criar instância com nome+telefone, verificar se aparece no dashboard Evolution
5. **Deploy**

---
