# G6 Inventory — Inline Scripts & Handlers

## Summary

| # | HTML File | Inline `<script>` blocks | `onclick=/onchange=` handlers |
|---|-----------|------------------------|-------------------------------|
| 1 | login.html | 1 (L62-148) | 0 |
| 2 | dashboard.html | 1 (L77-380) | 5 |
| 3 | balcao.html | 2 (L79-81, L83-972) | ~15 |
| 4 | caixa.html | 2 (L17-30, L75-242) | 3 |
| 5 | entregador.html | 2 (L15-19, L97-270) | 6 |
| 6 | financeiro.html | 1 (L121-238) | 2 |
| 7 | relatorios.html | 2 (L16-20, L84-194) | 4 |
| 8 | relatorios-entregadores.html | 2 (L21-25, L58-207) | 1 |
| 9 | painelLoja.html | 2 (L16-20, L522-637) | 0 |
| 10 | superadmin.html | 2 (L404-426, L428-943) | ~18 |
| 11 | whatsapp.html | 1 (L50-337) | ~9 |
| 12 | alterar-senha.html | 1 (L50-100) | 0 |
| 13 | 404-subscription.html | 1 (L90-107) | 0 |
| 14 | integracoes.html | 1 (L34-43) | 0 |

### Additional files with ONLY onclick handlers (no inline scripts)
| HTML File | onclick handlers |
|-----------|-----------------|
| index.html | 3 (L141, L198, L215) |
| filiais.html | 3 (L38, L68, L69) |
| view/cart.html | 4 (L99, L109, L121, L123) |

---

## File 1: login.html

### Inline Script (L62-148)
**Destination:** `js/pages/login.js`

Contents:
- URL param handler (`?entregador=1`)
- Login form submit handler (fetch API auth)
- Session auto-redirect (authUser + entregador)

### Handlers
None (form uses `addEventListener` in script).

---

## File 2: dashboard.html

### Inline Script (L77-380)
**Destination:** `js/pages/dashboard.js`

Contents:
- Auth guard
- Sidebar navigation & menu rendering
- Page navigation (iframe)
- Sidebar collapse/restore
- User info display
- Logout modal
- Message listener (badge, notifications)
- Notification system
- Store name loader (`carregarNomeLoja`)
- Idle timer init

### Handlers
| Line | Attribute | Function |
|------|-----------|----------|
| 31 | `onclick="closeSidebar()"` | closeSidebar |
| 42 | `onclick="toggleSidebarCollapse()"` | toggleSidebarCollapse |
| 51 | `onclick="toggleSidebar()"` | toggleSidebar |
| 58 | `onclick="logout()"` | logout |
| 278 | `onclick="this.closest('.modal-overlay').remove()"` | inline |

---

## File 3: balcao.html

### Inline Script 1 (L79-81)
**Destination:** merge into `js/pages/balcao.js`

Contents: authGuard call

### Inline Script 2 (L83-972)
**Destination:** `js/pages/balcao.js`

Contents:
- Product loading & filtering
- Cart (carrinho) management
- Flavor/combo selectors (abrirSeletorSabores, abrirSeletorComboSalgado, abrirSeletorComboAcai, abrirSeletorAvulso)
- Dynamic form (atualizarFormulario)
- Payment calculation
- Order submission (pagar)
- Confirmation overlay
- Embedded mode (postMessage)
- Toast helper
- Sabores formatting

### Handlers
| Line | Attribute | Function |
|------|-----------|----------|
| 49 | `onchange="atualizarFormulario()"` | atualizarFormulario |
| 54 | `onchange="atualizarFormulario()"` | atualizarFormulario |
| 71 | `onclick="pagar()"` | pagar |
| 212 | `onchange="calcularTotalFinal()"` | calcularTotalFinal |
| 213 | `onchange="calcularTotalFinal()"` | calcularTotalFinal |
| 214 | `onchange="calcularTotalFinal()"` | calcularTotalFinal |
| 215 | `onchange="calcularTotalFinal()"` | calcularTotalFinal |
| 511 | `onclick="editarSabores(${index})"` | editarSabores |
| 514 | `onclick="removerItem(${index})"` | removerItem |
| 521 | `onclick="editarSabores(${index})"` | editarSabores |
| 524 | `onclick="removerItem(${index})"` | removerItem |
| 528 | `onclick="diminuirQtd(${index})"` | diminuirQtd |
| 530 | `onclick="aumentarQtd(${index})"` | aumentarQtd |
| 966 | `onclick="this.closest('#pdvConfirmOverlay').remove()"` | inline |

---

## File 4: caixa.html

### Inline Script 1 (L17-30)
**Destination:** merge into `js/pages/caixa.js`

Contents: authGuard, role check, api() helper

### Inline Script 2 (L75-242)
**Destination:** `js/pages/caixa.js`

Contents:
- toast helper
- Cash register state (resumo, trocoInicial)
- abrirCaixa, carregarResumo, atualizarTela, gerarGrafico
- fecharCaixa, imprimirRelatorio
- verRelatorios, imprimirRelatorioAntigo
- calcularTotalPedidos, calcularTotalComTroco
- window.onload auto-load

### Handlers
| Line | Attribute | Function |
|------|-----------|----------|
| 43 | `onclick="abrirCaixa()"` | abrirCaixa |
| 66 | `onclick="verRelatorios()"` | verRelatorios |
| 67 | `onclick="fecharCaixa()"` | fecharCaixa |

---

## File 5: entregador.html

### Inline Script 1 (L15-19)
**Destination:** merge into `js/pages/entregador.js`

Contents: authGuard, role check

### Inline Script 2 (L97-270)
**Destination:** `js/pages/entregador.js`

Contents:
- API setup (authUser, API_BASE, TOKEN)
- apiRequest helper
- CRUD: salvarEntregador, editarEntregador, toggleAtivo, excluirEntregador
- Password reset: abrirModalReset, fecharModalReset, confirmarResetSenha
- carregarEntregadores (with polling)

### Handlers
| Line | Attribute | Function |
|------|-----------|----------|
| 50 | `onclick="fecharModalReset()"` | fecharModalReset |
| 51 | `onclick="confirmarResetSenha()"` | confirmarResetSenha |
| 84 | `onclick="salvarEntregador()"` | salvarEntregador |
| 256 | `onclick="editarEntregador(...)"` | editarEntregador |
| 257 | `onclick="toggleAtivo(...)"` | toggleAtivo |
| 260 | `onclick="abrirModalReset(...)"` | abrirModalReset |
| 261 | `onclick="excluirEntregador(...)"` | excluirEntregador |

---

## File 6: financeiro.html

### Inline Script (L121-238)
**Destination:** `js/pages/financeiro.js`

Contents:
- Auth check
- fmtBRL helper
- Tab switching
- URL params handling (consolidated=1)
- carregarConsolidado
- Init (Financeiro.carregarBalanco)

### Handlers
| Line | Attribute | Function |
|------|-----------|----------|
| 79 | `onclick="Financeiro.sincronizar()"` | Financeiro.sincronizar |
| 82 | `onclick="Financeiro.gerarFechamento()"` | Financeiro.gerarFechamento |

---

## File 7: relatorios.html

### Inline Script 1 (L16-20)
**Destination:** merge into `js/pages/relatorios.js`

Contents: authGuard, role check

### Inline Script 2 (L84-194)
**Destination:** `js/pages/relatorios.js`

Contents:
- abrirAba (tab switching)
- carregarRelatoriosDia (chart + table)
- carregarRelatoriosPeriodo (chart + table)
- Chart cleanup

### Handlers
| Line | Attribute | Function |
|------|-----------|----------|
| 33 | `onclick="abrirAba(event,'abaResumo')"` | abrirAba |
| 34 | `onclick="abrirAba(event,'abaPeriodo')"` | abrirAba |
| 53 | `onclick="carregarRelatoriosDia()"` | carregarRelatoriosDia |
| 67 | `onclick="carregarRelatoriosPeriodo()"` | carregarRelatoriosPeriodo |

---

## File 8: relatorios-entregadores.html

### Inline Script 1 (L21-25)
**Destination:** merge into `js/pages/relatorios-entregadores.js`

Contents: authGuard, role check

### Inline Script 2 (L58-207)
**Destination:** `js/pages/relatorios-entregadores.js`

Contents:
- API setup
- apiRequest, fmtMoeda, fmtItens helpers
- carregarEntregadores (populate filter)
- carregarRelatorio (fetch + render)
- renderRelatorio (HTML table generation)
- togglePedidos (expand/collapse)
- Init

### Handlers
| Line | Attribute | Function |
|------|-----------|----------|
| 49 | `onclick="carregarRelatorio()"` | carregarRelatorio |

---

## File 9: painelLoja.html

### Inline Script 1 (L16-20)
**Destination:** merge into `js/pages/painelLoja.js`

Contents: authGuard, role check

### Inline Script 2 (L522-637)
**Destination:** `js/pages/painelLoja.js`

Contents:
- Filial pending theme alert (checkPendingTheme)
- Theme save interception for filial (approval flow)
- MutationObserver for tab changes

### Handlers
None inline (all handlers in existing `js/painel.js`).

---

## File 10: superadmin.html

### Inline Script 1 (L404-426)
**Destination:** merge into `js/pages/superadmin.js`

Contents: domain check, authGuard, api() helper

### Inline Script 2 (L428-943)
**Destination:** `js/pages/superadmin.js`

Contents:
- Sidebar nav sections & rendering
- Sidebar collapse/expand
- Mobile drawer
- switchTab
- CRUD: carregarUsuarios, cadastrarUsuario, excluirUsuario, alterarSenha
- Clientes: carregarClientes, abrirModalEditar, salvarEdicaoCliente, etc.
- Empresas: carregarEmpresas, cadastrarEmpresa, abrirModalEditarEmpresa, salvarEdicaoEmpresa, desativarSplit, excluirEmpresa
- Settlements: carregarSettlements
- activarTabPorQuery
- Init calls

### Handlers (many — all in HTML and dynamically generated HTML)
| Line | Attribute | Function |
|------|-----------|----------|
| 76 | `onchange="onEmpresaChange()"` | onEmpresaChange (in superadminDashboard.js) |
| 83 | `onclick="carregarDashboard()"` | carregarDashboard (in superadminDashboard.js) |
| 119 | `onclick="cadastrarUsuario()"` | cadastrarUsuario |
| 133 | `onclick="alterarSenha()"` | alterarSenha |
| 163 | `onclick="fecharModal('modalEditarCliente')"` | fecharModal |
| 164 | `onclick="salvarEdicaoCliente()"` | salvarEdicaoCliente |
| 176 | `onclick="fecharModal('modalSenhaCliente')"` | fecharModal |
| 177 | `onclick="salvarSenhaCliente()"` | salvarSenhaCliente |
| 202 | `onclick="cadastrarEmpresa()"` | cadastrarEmpresa |
| 230 | `onclick="desativarSplit()"` | desativarSplit |
| 234 | `onclick="fecharModal('modalEditarEmpresa')"` | fecharModal |
| 235 | `onclick="salvarEdicaoEmpresa()"` | salvarEdicaoEmpresa |
| 246 | `onclick="abrirModalCriarFilial()"` | abrirModalCriarFilial (in filiais.js?) |
| 278 | `onclick="fecharModal('modalCriarFilial')"` | fecharModal |
| 279 | `onclick="criarFilial()"` | criarFilial (in filiais.js?) |
| 390 | `onclick="savePricing()"` | savePricing (in superadminBilling.js) |

---

## File 11: whatsapp.html

### Inline Script (L50-337)
**Destination:** `js/pages/whatsapp.js`

Contents:
- API setup (auth, token)
- apiRequest helper
- toast helper
- statusHtml, isConectada helpers
- carregarInstancias (full rendering)
- criarInstancia, fecharModal, confirmarCriacao
- gerarQR, mostrarQR
- iniciarPollingQR
- enviarTeste, reconectar, atualizarStatus
- excluirInstancia
- Init + polling

### Handlers
| Line | Attribute | Function |
|------|-----------|----------|
| 42 | `onclick="fecharModal()"` | fecharModal |
| 43 | `onclick="confirmarCriacao()"` | confirmarCriacao |
| 113 | `onclick="criarInstancia()"` | criarInstancia |
| 146 | `onclick="gerarQR('${inst.id}')"` | gerarQR |
| 149 | `onclick="reconectar('${inst.id}')"` | reconectar |
| 153 | `onclick="enviarTeste('${inst.id}')"` | enviarTeste |
| 156 | `onclick="atualizarStatus('${inst.id}')"` | atualizarStatus |
| 160 | `onclick="excluirInstancia('${inst.id}')"` | excluirInstancia |
| 266 | `onclick="document.getElementById('qrCard').remove()"` | inline |

---

## File 12: alterar-senha.html

### Inline Script (L50-100)
**Destination:** `js/pages/alterar-senha.js`

Contents:
- Auth check (redirect superadmin)
- Form submit handler (bcrypt compare, hash, update)
- showMsg helper

### Handlers
None (form uses `addEventListener`).

---

## File 13: 404-subscription.html

### Inline Script (L90-107)
**Destination:** `js/pages/404-subscription.js`

Contents:
- URL param `slug` handler
- Fetch company contact info
- Update WhatsApp link and company name

### Handlers
None.

---

## File 14: integracoes.html

### Inline Script (L34-43)
**Destination:** `js/pages/integracoes.js`

Contents:
- Init: load Integracoes.carregar()
- Error handling for loading state

### Handlers
None.

---

## Additional: index.html (onclick only)

### Handlers
| Line | Attribute | Function |
|------|-----------|----------|
| 141 | `onclick="event.preventDefault(); abrirPedidosNav()"` | abrirPedidosNav |
| 198 | `onclick="fecharOverlayPedidos()"` | fecharOverlayPedidos |
| 215 | `onclick="fecharOverlayPedidos()"` | fecharOverlayPedidos |

These functions are defined in `js/navbar.js`. The onclick handlers should be replaced with `data-action` attributes and a delegator in `js/navbar.js`.

## Additional: filiais.html (onclick only)

### Handlers
| Line | Attribute | Function |
|------|-----------|----------|
| 38 | `onclick="abrirModalCriar()"` | abrirModalCriar |
| 68 | `onclick="fecharModal()"` | fecharModal |
| 69 | `onclick="criarFilial()"` | criarFilial |

These functions are defined in `js/filiais.js`. The onclick handlers should be replaced with `data-action` attributes and a delegator in `js/filiais.js`.

## Additional: view/cart.html (onclick only)

### Handlers
| Line | Attribute | Function |
|------|-----------|----------|
| 99 | `onclick="fecharOverlayBairro()"` | fecharOverlayBairro |
| 109 | `onclick="fecharOverlay()"` | fecharOverlay |
| 121 | `onclick="copiarPix()"` | copiarPix |
| 123 | `onclick="fecharPix()"` | fecharPix |

These functions are defined in `js/cart.js`. The onclick handlers should be replaced with `data-action` attributes and a delegator in `js/cart.js`.
