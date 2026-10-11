// js/pages/painelLoja.js — módulo da rota painelLoja
import { mountPainelCore } from './painel-loja-core.js';

const HTML_PAINELLOJA = `<body>

<div class="wrapper">
  <header>
    <div class="title">Painel da Loja</div>
    <nav class="tabs" role="tablist">
      <button class="tab-btn" id="tab-horarios" role="tab" aria-selected="true">Horários</button>
      <button class="tab-btn" id="tab-produtos" role="tab" aria-selected="false">Produtos</button>
      <button class="tab-btn" id="tab-categorias" role="tab" aria-selected="false">Categorias</button>
      <button class="tab-btn" id="tab-config" role="tab" aria-selected="false">Config. Loja</button>
      <button class="tab-btn" id="tab-personalizacao" role="tab" aria-selected="false">Personalizar</button>
    </nav>
  </header>

  <!-- ABA: Horários -->
  <section id="view-horarios" class="grid" role="tabpanel">
    <div class="card">
      <h3><i class="fas fa-clock" style="color:var(--brand-2)"></i> Horário de Funcionamento</h3>
      <p class="tip">Edite abertura/fechamento por dia da semana.</p>
      <div class="hr"></div>
      <div id="horarios-form"></div>
      <div style="display:flex; gap:10px; margin-top:14px; flex-wrap:wrap;">
        <button class="btn refresh" id="btnReloadHoras"><i class="fas fa-sync-alt"></i> Recarregar</button>
        <button class="btn save" id="btnSalvarHoras"><i class="fas fa-save"></i> Salvar Horários</button>
      </div>
    </div>

    <div class="card">
      <h3><i class="fas fa-store" style="color:var(--brand)"></i> Configuração da Loja</h3>
      <p class="tip">Configure o status automático e manual da loja.</p>
      <div class="hr"></div>
      <div class="form-section">
        <h4><i class="fas fa-calendar-week"></i> Dias de Funcionamento</h4>
        <div id="workingDaysContainer" style="display:flex;gap:6px;flex-wrap:wrap;margin-bottom:12px;"></div>
      </div>
      <div class="form-section">
        <h4><i class="fas fa-clock"></i> Horário Padrão</h4>
        <div class="row">
          <div class="lbl">Abertura</div>
          <input type="time" id="lojaOpeningTime" />
        </div>
        <div class="row">
          <div class="lbl">Fechamento</div>
          <input type="time" id="lojaClosingTime" />
        </div>
      </div>
      <div class="form-section">
        <h4><i class="fas fa-toggle-on"></i> Override Manual</h4>
        <div class="row">
          <div class="lbl">Forçar Status</div>
          <label class="chip"><input type="checkbox" id="lojaManualOverride" /> Ignorar horário automático</label>
        </div>
        <div class="row" id="lojaManualStatusRow">
          <div class="lbl">Status Manual</div>
          <label class="chip"><input type="checkbox" id="lojaIsOpen" checked /> Loja Aberta</label>
        </div>
      </div>
      <div style="display:flex; gap:10px; margin-top:14px; flex-wrap:wrap;">
        <button class="btn save" id="btnSalvarLojaConfig"><i class="fas fa-save"></i> Salvar Configuração</button>
      </div>
    </div>
  </section>

  <!-- ABA: Produtos -->
  <section id="view-produtos" class="grid hidden" role="tabpanel">
    <!-- Toolbar -->
    <div class="card" style="padding:12px 16px;">
      <div class="toolbar">
        <input type="text" id="busca" aria-label="Buscar por nome ou ID" placeholder="Buscar por nome ou ID..." style="flex:1;min-width:150px;">
        <select id="filtroStatus" aria-label="Filtrar por status">
          <option value="">Todos os status</option>
          <option value="active">Ativos</option>
          <option value="paused">Pausados</option>
          <option value="sem_estoque">Sem Estoque</option>
        </select>
        <button class="btn refresh" id="btnReloadProdutos"><i class="fas fa-sync-alt"></i> Atualizar</button>
      </div>
    </div>

    <!-- Lista -->
    <div class="card" style="padding:16px;">
      <h3><i class="fas fa-box" style="color:var(--brand)"></i> Produtos</h3>
      <div class="table-wrapper">
        <table class="table">
          <thead><tr><th>ID</th><th>Nome</th><th>Preço</th><th>Status</th><th>Ações</th></tr></thead>
          <tbody id="tbodyProdutos"></tbody>
        </table>
      </div>
      <div id="skeletonArea"></div>
    </div>

    <!-- Formulário -->
    <div class="card" id="cardFormProduto" style="padding:16px;">
      <h3><i class="fas fa-edit" style="color:var(--brand-2)"></i> <span id="formTitle">Novo Produto</span></h3>
      <form id="formProduto">
        <div class="form-section">
          <h4><i class="fas fa-tag"></i> Dados Principais</h4>
          <div class="row">
            <div class="lbl">ID (numérico)</div>
            <input type="number" id="prodId" required />
          </div>
          <div class="row">
            <div class="lbl">Nome do Item</div>
            <input type="text" id="prodName" required />
          </div>
          <div class="row">
            <div class="lbl">Valor (R$)</div>
            <input type="number" id="prodPrice" step="0.01" required />
          </div>
          <div class="row">
            <div class="lbl">Descrição</div>
            <textarea id="prodDesc" rows="2" placeholder="Descrição do produto..."></textarea>
          </div>
          <div class="row">
            <div class="lbl">Foto do Item</div>
            <div style="display:flex;flex-direction:column;gap:8px;">
              <input type="file" id="prodImgFile" accept="image/*" />
              <input type="hidden" id="prodImg" />
              <img id="prodImgPreview" loading="lazy" style="max-width:150px;max-height:150px;border-radius:8px;display:none;object-fit:cover;" />
            </div>
          </div>
        </div>

        <div class="form-section">
          <h4><i class="fas fa-layer-group"></i> Tipo de Produto</h4>
          <div class="row">
            <div class="lbl">Tipo</div>
            <select id="prodTipo">
              <option value="">Simples</option>
              <option value="combo_salgado">Combo Salgado</option>
              <option value="combo_acai">Combo Açaí</option>
            </select>
          </div>
          <div class="row">
            <div class="lbl">Status</div>
            <select id="prodStatus">
              <option value="active">Ativo</option>
              <option value="paused">Pausado</option>
            </select>
          </div>
          <div class="row">
            <div class="lbl">Categoria</div>
            <select id="prodCategoryId">
              <option value="">Sem categoria</option>
            </select>
          </div>
          <div id="camposComboSalgado" style="display:none;">
            <div class="row">
              <div class="lbl">Total de unidades</div>
              <input type="number" id="comboUnidades" min="1" placeholder="Ex.: 50" />
            </div>
            <div class="row">
              <div class="lbl">Sabores</div>
              <div id="listaSabores" style="flex:1;display:flex;flex-direction:column;gap:6px;min-height:80px;"></div>
              <button class="btn ghost" type="button" data-action="adicionarLinhaSaborAction" style="align-self:flex-start;"><i class="fas fa-plus"></i> Adicionar sabor</button>
            </div>
          </div>
          <div id="camposComboAcai" style="display:none;">
            <div class="row">
              <div class="lbl">Acréscimos grátis</div>
              <input type="number" id="comboGratis" min="0" placeholder="Ex.: 3" />
            </div>
            <div class="row">
              <div class="lbl">Máximo de acréscimos</div>
              <input type="number" id="comboMax" min="0" placeholder="Ex.: 5" />
            </div>
            <div class="row">
              <div class="lbl">Acréscimos (nome + preço)</div>
              <div id="listaAcrescimos" style="flex:1;display:flex;flex-direction:column;gap:6px;min-height:80px;"></div>
              <button class="btn ghost" type="button" data-action="adicionarLinhaAcrescimoAction" style="align-self:flex-start;"><i class="fas fa-plus"></i> Adicionar acréscimo</button>
            </div>
          </div>
        </div>

        <details style="margin-bottom:12px;background:#0a1224;border:1px solid #1f2a4d;border-radius:12px;padding:12px;cursor:pointer;">
          <summary style="font-size:12px;color:var(--brand-2);text-transform:uppercase;letter-spacing:0.5px;font-weight:700;">
            <i class="fas fa-cog"></i> Avançado (opcional)
          </summary>
          <div style="margin-top:12px;">
            <div class="row">
              <div class="lbl">Congelado</div>
              <label class="chip"><input type="checkbox" id="prodCongelado" /> Congelado</label>
            </div>
            <div class="row">
              <div class="lbl">Controlar Estoque</div>
              <label class="chip"><input type="checkbox" id="prodControlaEstoque" /> Ativar controle</label>
            </div>
            <div class="row estoque-fields">
              <div class="lbl">Estoque Atual</div>
              <input type="number" id="prodEstoqueAtual" min="0" />
            </div>
            <div class="row estoque-fields">
              <div class="lbl">Avisar quando chegar em</div>
              <input type="number" id="prodEstoqueMinimo" min="0" />
            </div>
            <div class="row">
              <div class="lbl">Qdo estoque = 0</div>
              <label class="chip"><input type="checkbox" id="prodHideWhenOutOfStock" checked /> Ocultar da vitrine</label>
            </div>
          </div>
        </details>

        <div style="display:flex; gap:10px; margin-top:14px; flex-wrap:wrap;">
          <button type="submit" class="btn save" id="btnSalvarProduto"><i class="fas fa-save"></i> Salvar</button>
          <button type="button" class="btn ghost" id="btnLimparForm"><i class="fas fa-undo"></i> Limpar</button>
        </div>
      </form>
    </div>
  </section>

  <!-- ABA: Categorias -->
  <section id="view-categorias" class="grid hidden" role="tabpanel">
    <div class="card half">
      <h3><i class="fas fa-tags" style="color:var(--brand-2)"></i> Categorias</h3>
      <p class="tip">Gerencie as categorias de produtos da loja.</p>
      <div class="hr"></div>

      <div class="form-section">
        <h4><i class="fas fa-plus-circle"></i> Nova Categoria</h4>
        <div class="row">
          <div class="lbl">Nome</div>
          <input type="text" id="catNome" aria-label="Nome da categoria" placeholder="Ex.: Salgadinhos 20g, Salgadinho 45g..." />
        </div>
        <div style="display:flex; gap:8px; margin-top:8px;">
          <button class="btn save" id="btnSalvarCategoria"><i class="fas fa-save"></i> Salvar</button>
          <button class="btn ghost" id="btnLimparCategoria"><i class="fas fa-undo"></i> Limpar</button>
        </div>
      </div>
    </div>

    <div class="card half">
      <h3><i class="fas fa-list"></i> Lista de Categorias</h3>
      <div id="categoriaList">
        <p class="tip" style="padding:16px;text-align:center;">Carregando...</p>
      </div>
    </div>
  </section>

  <!-- ABA: Configurações da Loja -->
  <section id="view-config" class="grid hidden" role="tabpanel">
    <div class="card">
      <h3><i class="fas fa-store" style="color:var(--brand)"></i> Configurações da Loja</h3>
      <p class="tip">Edite as informações públicas da sua loja.</p>
      <div class="hr"></div>

      <div class="form-section">
        <h4><i class="fas fa-info-circle"></i> Informações da Loja</h4>
        <div class="row">
          <div class="lbl">Nome da Loja</div>
          <input type="text" id="confNome" aria-label="Nome da loja" placeholder="Ex.: Fábrica de Salgados Costa" />
        </div>
        <div class="row">
          <div class="lbl">WhatsApp (com DDD)</div>
          <input type="text" id="confTelefone" aria-label="WhatsApp com DDD" placeholder="5521966017085" />
        </div>
        <div class="row">
          <div class="lbl">Descrição</div>
          <textarea id="confDescricao" aria-label="Descrição" rows="3" placeholder="Sobre a loja..."></textarea>
        </div>
        <div class="row">
          <div class="lbl">Ano de Abertura</div>
          <input type="number" id="confAno" aria-label="Ano de abertura" min="1900" max="2999" placeholder="Ex.: 1998" />
        </div>
      </div>

      <div class="form-section">
        <h4><i class="fas fa-map-marker-alt"></i> Endereço</h4>
        <div class="row">
          <div class="lbl">CEP</div>
          <input type="text" id="confCep" aria-label="CEP" placeholder="Somente números" />
        </div>
        <div class="row">
          <div class="lbl">Logradouro</div>
          <input type="text" id="confEndereco" aria-label="Logradouro" />
        </div>
        <div class="row">
          <div class="lbl">Número</div>
          <input type="text" id="confNumero" aria-label="Número" />
        </div>
        <div class="row">
          <div class="lbl">Bairro</div>
          <input type="text" id="confBairro" aria-label="Bairro" />
        </div>
        <div class="row">
          <div class="lbl">Cidade</div>
          <input type="text" id="confCidade" aria-label="Cidade" />
        </div>
        <div class="row">
          <div class="lbl">Estado</div>
          <input type="text" id="confEstado" aria-label="Estado" maxlength="2" placeholder="RJ" />
        </div>
        <div class="row">
          <div class="lbl">Latitude</div>
          <input type="text" id="confLatitude" aria-label="Latitude" placeholder="-22.764..." />
        </div>
        <div class="row">
          <div class="lbl">Longitude</div>
          <input type="text" id="confLongitude" aria-label="Longitude" placeholder="-43.399..." />
        </div>
      </div>

      <div class="form-section">
        <h4><i class="fas fa-image"></i> Logo da Loja</h4>
        <div class="row">
          <div class="lbl">Logo</div>
          <div style="display:flex;flex-direction:column;gap:8px;">
            <input type="file" id="confLogoFile" accept="image/*" />
            <input type="hidden" id="confLogo" />
            <img id="confLogoPreview" loading="lazy" style="max-width:150px;max-height:150px;border-radius:8px;display:none;object-fit:cover;" />
          </div>
        </div>
      </div>

      <div class="form-section">
        <h4><i class="fas fa-image"></i> Banner da Loja</h4>
        <div class="row">
          <div class="lbl">Banner (capa)</div>
          <div style="display:flex;flex-direction:column;gap:8px;">
            <input type="file" id="confCapaFile" accept="image/*" />
            <input type="hidden" id="confCapa" />
            <img id="confCapaPreview" loading="lazy" style="max-width:300px;max-height:150px;border-radius:8px;display:none;object-fit:cover;" />
          </div>
        </div>
      </div>

      <div class="form-section">
        <h4><i class="fas fa-truck"></i> Bairros Atendidos</h4>
        <p class="tip">Cadastre os bairros que sua loja atende e o valor da taxa de entrega para cada um.</p>
        <div id="bairrosContainer"></div>
        <button class="btn add" id="btnAddBairro" type="button" style="margin-top:8px;"><i class="fas fa-plus"></i> Adicionar Bairro</button>
      </div>

      <div style="display:flex; gap:10px; margin-top:14px; flex-wrap:wrap;">
        <button class="btn save" id="btnSalvarConfig"><i class="fas fa-save"></i> Salvar Configurações</button>
        <button class="btn refresh" id="btnRecarregarConfig"><i class="fas fa-sync-alt"></i> Recarregar</button>
      </div>
    </div>
  </section>

  <!-- ABA: Personalizacao -->
  <section id="view-personalizacao" class="grid hidden" role="tabpanel">
    <!-- Alerta tema pendente (filial) -->
    <div id="themePendingAlert" style="display:none;background:linear-gradient(135deg,#FEF3CD 0%,#FFF8E1 100%);border:1px solid #F59E0B;border-left:4px solid #F59E0B;border-radius:12px;padding:16px 20px;margin-bottom:16px;align-items:flex-start;gap:14px;">
      <div style="width:40px;height:40px;background:#F59E0B;border-radius:10px;display:flex;align-items:center;justify-content:center;color:white;font-size:18px;flex-shrink:0;">
        <i class="fas fa-clock"></i>
      </div>
      <div style="flex:1;">
        <div style="font-size:14px;font-weight:700;color:#92400E;margin-bottom:4px;">Alteração de tema pendente de aprovação</div>
        <div style="font-size:12px;color:#A16207;line-height:1.5;">Suas alterações de personalização foram enviadas para aprovação da loja matriz. Aguarde até que o administrador aprove ou rejeite as mudanças.</div>
        <div id="themePendingColors" style="display:flex;gap:8px;margin-top:10px;flex-wrap:wrap;"></div>
      </div>
    </div>

    <div class="card">
      <h3><i class="fas fa-palette" style="color:var(--primary, #F26D3D)"></i> Personalização Visual</h3>
      <p class="tip">Personalize as cores da sua loja. As alterações são visíveis imediatamente no cardápio online.</p>
      <div class="hr"></div>

      <div style="display:flex;gap:16px;flex-wrap:wrap;margin-bottom:16px;padding:16px;background:var(--primary-bg, #FFF0EA);border-radius:12px;">
        <div style="flex:1;min-width:80px;text-align:center;">
          <div id="previewPrimary" style="width:100%;height:40px;background:var(--primary, #F26D3D);border-radius:8px;"></div>
          <span style="font-size:11px;color:var(--text-muted, #7C7C7C);">Primária</span>
        </div>
        <div style="flex:1;min-width:80px;text-align:center;">
          <div id="previewSecondary" style="width:100%;height:40px;background:var(--secondary, #FFFAF8);border-radius:8px;border:1px solid var(--border, #E8E4DF);"></div>
          <span style="font-size:11px;color:var(--text-muted, #7C7C7C);">Fundo</span>
        </div>
        <div style="flex:1;min-width:80px;text-align:center;">
          <div id="previewSurface" style="width:100%;height:40px;background:var(--surface, #FFFFFF);border-radius:8px;border:1px solid var(--border, #E8E4DF);"></div>
          <span style="font-size:11px;color:var(--text-muted, #7C7C7C);">Superfície</span>
        </div>
        <div style="flex:1;min-width:80px;text-align:center;">
          <div id="previewText" style="width:100%;height:40px;background:var(--text, #2D1A12);border-radius:8px;"></div>
          <span style="font-size:11px;color:var(--text-muted, #7C7C7C);">Texto</span>
        </div>
      </div>

      <div class="form-section">
        <h4><i class="fas fa-paint-brush"></i> Cores</h4>
        <div class="row">
          <div class="lbl">Cor Primária</div>
          <input type="color" id="themePrimary" value="#F26D3D" />
        </div>
        <div class="row">
          <div class="lbl">Fundo da Página</div>
          <input type="color" id="themeBackground" value="#FFFAF8" />
        </div>
        <div class="row">
          <div class="lbl">Superfície (cards)</div>
          <input type="color" id="themeSurface" value="#FFFFFF" />
        </div>
        <div class="row">
          <div class="lbl">Cor do Texto</div>
          <input type="color" id="themeText" value="#2D1A12" />
        </div>
      </div>

      <div class="form-section">
        <h4><i class="fas fa-adjust"></i> Modo</h4>
        <div class="row">
          <div class="lbl">Modo Escuro</div>
          <label class="chip"><input type="checkbox" id="themeIsDark" /> Ativar modo escuro</label>
        </div>
      </div>

      <div class="form-section">
        <h4><i class="fas fa-bell"></i> Notificação Sonora</h4>
        <div class="row">
          <div class="lbl">Som de Pedido</div>
          <div style="display:flex;flex-direction:column;gap:8px;flex:1;">
            <input type="file" id="notifSoundFile" accept="audio/mp3,audio/wav,audio/ogg,audio/mpeg" style="font-size:12px;">
            <div id="notifSoundPreview" style="display:none;align-items:center;gap:8px;">
              <audio id="notifSoundAudio" controls style="height:32px;flex:1;"></audio>
              <button class="btn ghost" id="btnRemoveSound" style="font-size:11px;padding:4px 8px;"><i class="fas fa-times"></i> Remover</button>
            </div>
            <small style="color:#999;">MP3, WAV ou OGG · máx 500KB</small>
          </div>
        </div>
      </div>

      <div style="display:flex; gap:10px; margin-top:14px; flex-wrap:wrap;">
        <button class="btn save" id="btnSalvarTema"><i class="fas fa-save"></i> Salvar Personalização</button>
        <button class="btn ghost" id="btnResetarTema"><i class="fas fa-undo"></i> Restaurar Padrão</button>
      </div>
    </div>
  </section>

</div>

<link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.5.1/css/all.min.css">
<link href="https://fonts.googleapis.com/css2?family=Bebas+Neue&family=Inter:wght@400;500;700&display=swap" rel="stylesheet">
<link rel="stylesheet" href="css/admin/hungry-tiger.css">
</body>`;

let _abort = null;
const _cleanups = [];

export async function mount(container, params) {
  unmount();
  _abort = new AbortController();
  await loadScriptOnce('js/comboConfig.js');
  _cleanups.push(pageCss('css/painelloja-page.css', 'painelLoja'), pageCss('css/painelstyle.css', 'painelLoja'));
  container.innerHTML = HTML_PAINELLOJA;
  _cleanups.push(mountPainelCore(container, _abort));
  (function () {
(function () {
  var _au = JSON.parse(localStorage.getItem('authUser') || '{}');
  if (!_au.role || !['admin', 'superadmin'].includes(_au.role)) { goTo('admin'); return; }

  // Task 8: Filial — tema pendente de aprovação
  var authUser = JSON.parse(localStorage.getItem('authUser') || '{}');
  if (authUser.empresaTipo !== 'filial') return;

  var alertEl = document.getElementById('themePendingAlert');
  var colorsEl = document.getElementById('themePendingColors');
  var saveBtn = document.getElementById('btnSalvarTema');

  async function checkPendingTheme() {
    try {
      var empresaId = authUser.empresaId || authUser.id;
      var res = await authFetch((window.getApiBase ? window.getApiBase() : '') + '/api/admin/empresas/' + empresaId);
      if (!res.ok) return;
      var data = await res.json();
      var empresa = data.empresa || data;

      if (empresa.pendingThemeSettings) {
        var pending = typeof empresa.pendingThemeSettings === 'string'
          ? JSON.parse(empresa.pendingThemeSettings)
          : empresa.pendingThemeSettings;

        alertEl.style.display = 'flex';

        colorsEl.innerHTML = '';
        var labels = { primary: 'Primária', background: 'Fundo', surface: 'Superfície', text: 'Texto' };
        Object.entries(labels).forEach(function (entry) {
          var key = entry[0], label = entry[1];
          if (pending[key]) {
            var chip = document.createElement('div');
            chip.style.cssText = 'display:flex;align-items:center;gap:6px;background:rgba(255,255,255,0.7);border:1px solid #FDE68A;border-radius:8px;padding:4px 10px 4px 6px;font-size:11px;color:#92400E;';
            chip.innerHTML = '<div style="width:16px;height:16px;border-radius:4px;border:1px solid rgba(0,0,0,0.1);background:' + pending[key] + ';"></div>' + label;
            colorsEl.appendChild(chip);
          }
        });

        if (saveBtn) {
          saveBtn.innerHTML = '<i class="fas fa-paper-plane"></i> Enviar para Aprovação';
        }
      } else {
        alertEl.style.display = 'none';
        if (saveBtn) {
          saveBtn.innerHTML = '<i class="fas fa-save"></i> Salvar Personalização';
        }
      }
    } catch (e) {
      console.error('Erro ao verificar tema pendente:', e);
    }
  }

  checkPendingTheme();

    var observer = new MutationObserver(function () {
      var personalizacaoView = document.getElementById('view-personalizacao');
      if (personalizacaoView && !personalizacaoView.classList.contains('hidden')) {
        checkPendingTheme();
      }
    });
    var personalizacaoView = document.getElementById('view-personalizacao');
  if (personalizacaoView) {
    observer.observe(personalizacaoView, { attributes: true, attributeFilter: ['class'] });
  }

  if (saveBtn) {
    saveBtn.addEventListener('click', async function (e) {
      if (authUser.empresaTipo !== 'filial') return;

      e.preventDefault();
      e.stopPropagation();

      var themeSettings = {
        primary: document.getElementById('themePrimary') ? document.getElementById('themePrimary').value : null,
        background: document.getElementById('themeBackground') ? document.getElementById('themeBackground').value : null,
        surface: document.getElementById('themeSurface') ? document.getElementById('themeSurface').value : null,
        text: document.getElementById('themeText') ? document.getElementById('themeText').value : null,
        isDark: document.getElementById('themeIsDark') ? document.getElementById('themeIsDark').checked : false
      };

      try {
        var empresaId = authUser.empresaId || authUser.id;
        var res = await authFetch((window.getApiBase ? window.getApiBase() : '') + '/api/admin/empresas/' + empresaId + '/theme/pending', {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ pendingThemeSettings: themeSettings })
        });

        if (res.ok) {
          alert('Tema enviado para aprovação da matriz!');
          checkPendingTheme();
        } else {
          var err = await res.json();
          alert('Erro: ' + (err.error || 'Não foi possível enviar tema'));
        }
      } catch (err) {
        alert('Erro de conexão ao enviar tema');
      }
    }, true);
  }
})();

// Bridge functions for painel.js onclick → data-action
window.adicionarLinhaSaborAction = function () {
  if (typeof adicionarLinhaSabor === 'function') adicionarLinhaSabor();
};

window.adicionarLinhaAcrescimoAction = function () {
  if (typeof adicionarLinhaAcrescimo === 'function') adicionarLinhaAcrescimo();
};
  })();
  return cleanup;
}
function cleanup() {
  _cleanups.splice(0).forEach(function (f) { try { f(); } catch (e) {} });
  if (_abort) { _abort.abort(); _abort = null; }
}
export function unmount() { cleanup(); }
