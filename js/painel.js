(function guard(){
  const u = localStorage.getItem('authUser');
  if(!u) window.location.replace('login.html');
})();

const API_BASE = window.location.origin + '/api';
const authUser = JSON.parse(localStorage.getItem('authUser') || 'null');
const TOKEN = authUser?.token || '';

async function apiRequest(path, options = {}) {
  const url = API_BASE + path;
  const headers = { 'Content-Type': 'application/json', ...options.headers };
  if (TOKEN) headers['Authorization'] = 'Bearer ' + TOKEN;
  if (options.body && typeof options.body === 'object' && !(options.body instanceof FormData)) {
    options.body = JSON.stringify(options.body);
  }
  const res = await fetch(url, { ...options, headers });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: 'Erro na requisição' }));
    throw new Error(err.error || 'Erro HTTP ' + res.status);
  }
  return res.json();
}

// ===== Tabs =====
const tabs = ['horarios', 'produtos', 'categorias', 'config', 'personalizacao', 'financeiro', 'pagamentos'];
function selectTab(which){
  tabs.forEach(t => {
    const btn = document.getElementById('tab-' + t);
    const view = document.getElementById('view-' + t);
    if (btn) btn.setAttribute('aria-selected', t === which);
    if (view) view.classList.toggle('hidden', t !== which);
  });
}
document.getElementById('tab-horarios')?.addEventListener('click', () => selectTab('horarios'));
document.getElementById('tab-produtos')?.addEventListener('click', () => { selectTab('produtos'); carregarCategorias(); });
document.getElementById('tab-categorias')?.addEventListener('click', () => { selectTab('categorias'); carregarCategorias(); });
document.getElementById('tab-config')?.addEventListener('click', () => { selectTab('config'); carregarConfigLoja(); });
document.getElementById('tab-personalizacao')?.addEventListener('click', () => { selectTab('personalizacao'); carregarTema(); });
document.getElementById('tab-financeiro')?.addEventListener('click', () => { selectTab('financeiro'); carregarFinanceiro(); });
document.getElementById('tab-pagamentos')?.addEventListener('click', () => { selectTab('pagamentos'); carregarPaymentConfig(); });

// ===== produtos congelados =====
const fCongelado = document.getElementById('prodCongelado');

// ===== Horários =====
const DIAS = ['Dom','Seg','Ter','Qua','Qui','Sex','Sáb'];
const horariosForm = document.getElementById('horarios-form');
const btnSalvarHoras = document.getElementById('btnSalvarHoras');
const btnReloadHoras = document.getElementById('btnReloadHoras');

function linhaHorario(dia, dados){
  const isFechado = !!(dados && dados.fechado);
  const vIni = (dados && dados.inicio) ? dados.inicio : '';
  const vFim = (dados && dados.fim) ? dados.fim : '';
  return `
    <div class="row" data-dia="${dia}">
      <div class="lbl">${dia}</div>
      <div class="inline">
        <input type="time" class="h-inicio" value="${vIni}" ${isFechado? 'disabled': ''} />
        <span class="muted">às</span>
        <input type="time" class="h-fim" value="${vFim}" ${isFechado? 'disabled': ''} />
      </div>
      <div class="inline">
        <label class="chip"><input type="checkbox" class="h-fechado" ${isFechado? 'checked': ''}/> Fechado</label>
      </div>
    </div>
  `;
}

async function carregarHorarios(){
  try {
    var settings = await apiRequest('/loja/settings-admin');
    var workingDays = Array.isArray(settings.workingDays) ? settings.workingDays : [];
    var data = {};
    DIAS.forEach(function(d) { data[d] = { inicio: settings.openingTime || '', fim: settings.closingTime || '', fechado: !workingDays.includes(d) }; });
    horariosForm.innerHTML = DIAS.map(d => linhaHorario(d, data[d])).join('');
  } catch(e) {
    horariosForm.innerHTML = DIAS.map(d => linhaHorario(d, {})).join('');
  }
  horariosForm.querySelectorAll('.h-fechado').forEach(chk => {
    chk.addEventListener('change', () => {
      const row = chk.closest('.row');
      row.querySelectorAll('.h-inicio, .h-fim').forEach(i => i.disabled = chk.checked);
    });
  });
}

btnReloadHoras?.addEventListener('click', carregarHorarios);

btnSalvarHoras?.addEventListener('click', async () => {
  const rows = [...horariosForm.querySelectorAll('.row')];
  let abertos = 0;
  let openingTime = '', closingTime = '';
  const workingDays = [];
  for(const r of rows){
    const dia = r.getAttribute('data-dia');
    const fechado = r.querySelector('.h-fechado').checked;
    const inicio = r.querySelector('.h-inicio').value || null;
    const fim = r.querySelector('.h-fim').value || null;
    if (!fechado && inicio && fim) {
      abertos++;
      workingDays.push(dia);
      if (!openingTime || inicio < openingTime) openingTime = inicio;
      if (!closingTime || fim > closingTime) closingTime = fim;
    }
  }
  if(abertos === 0) return toast('Pelo menos um dia deve ficar aberto.', '#f59e0b');
  try {
    await apiRequest('/loja/settings', { method: 'PUT', body: { workingDays, openingTime, closingTime } });
    blink(btnSalvarHoras);
    toast('Horários salvos');
  } catch(e) {
    toast('Erro ao salvar horários', '#ef4444');
  }
});

// ===== Loja Settings (backend API) =====
const DIAS_SEMANA = ['Dom','Seg','Ter','Qua','Qui','Sex','Sab'];

async function carregarLojaConfig() {
  try {
    const settings = await apiRequest('/loja/settings-admin');
    document.getElementById('lojaOpeningTime').value = settings.openingTime || '';
    document.getElementById('lojaClosingTime').value = settings.closingTime || '';
    document.getElementById('lojaManualOverride').checked = settings.manualOverride || false;
    document.getElementById('lojaIsOpen').checked = settings.isOpen !== false;

    const container = document.getElementById('workingDaysContainer');
    container.innerHTML = DIAS_SEMANA.map(d => {
      const checked = Array.isArray(settings.workingDays) && settings.workingDays.includes(d);
      return `<label class="chip"><input type="checkbox" class="wd-chk" value="${d}" ${checked?'checked':''} /> ${d}</label>`;
    }).join('');
  } catch (e) {
    console.warn('Erro ao carregar config loja:', e.message);
  }
}

document.getElementById('btnSalvarLojaConfig')?.addEventListener('click', async () => {
  const workingDays = [...document.querySelectorAll('.wd-chk:checked')].map(el => el.value);
  const payload = {
    openingTime: document.getElementById('lojaOpeningTime').value || null,
    closingTime: document.getElementById('lojaClosingTime').value || null,
    workingDays,
    manualOverride: document.getElementById('lojaManualOverride').checked,
    isOpen: document.getElementById('lojaIsOpen').checked,
  };
  try {
    await apiRequest('/loja/settings', { method: 'PUT', body: JSON.stringify(payload) });
    blink(document.getElementById('btnSalvarLojaConfig'));
    toast('Configuração salva!');
  } catch (e) {
    toast(e.message, 'danger');
  }
});

// ===== Categorias (backend API) =====
let categoriasCache = [];

async function carregarCategorias() {
  try {
    categoriasCache = await apiRequest('/categorias');
    const list = document.getElementById('categoriaList');
    if (!categoriasCache.length) {
      list.innerHTML = '<p class="tip" style="padding:16px;text-align:center;">Nenhuma categoria cadastrada.</p>';
    } else {
      list.innerHTML = categoriasCache.map(c => {
        const produtos = c.produtos || [];
        const itemsHtml = produtos.map(p => `
          <div style="display:flex;align-items:center;justify-content:space-between;padding:4px 8px 4px 24px;border-bottom:1px solid #1a2440;font-size:12px;">
            <span>${escapeHtml(p.name)} — R$ ${(Number(p.price)||0).toFixed(2).replace('.',',')}</span>
            <div style="display:flex;gap:4px;">
              <button class="btn btn-sm ghost" onclick="carregarNoForm(${p.id})" style="padding:2px 8px;"><i class="fas fa-pen"></i></button>
              <button class="btn btn-sm danger" onclick="removerProduto(${p.id})" style="padding:2px 8px;"><i class="fas fa-trash"></i></button>
            </div>
          </div>
        `).join('');
        return `
          <div style="border:1px solid #1f2a4d;border-radius:8px;margin-bottom:8px;overflow:hidden;">
            <div style="display:flex;align-items:center;justify-content:space-between;padding:8px 12px;background:#0a1224;">
              <strong>${escapeHtml(c.nome)} <span class="tip" style="font-weight:400;">(${produtos.length} itens)</span></strong>
              <div style="display:flex;gap:4px;">
                <button class="btn btn-sm save" onclick="criarItemNaCategoria(${c.id})" style="padding:4px 10px;"><i class="fas fa-plus"></i> Item</button>
                <button class="btn btn-sm ghost" onclick="editarCategoria(${c.id})"><i class="fas fa-pen"></i></button>
                <button class="btn btn-sm danger" onclick="excluirCategoria(${c.id})"><i class="fas fa-trash"></i></button>
              </div>
            </div>
            ${itemsHtml || '<div style="padding:8px 12px;font-size:12px;color:var(--muted);text-align:center;">Nenhum item nesta categoria</div>'}
          </div>
        `;
      }).join('');
    }
    // Update product form category dropdown
    const sel = document.getElementById('prodCategoryId');
    if (sel) {
      const current = sel.value;
      sel.innerHTML = '<option value="">Sem categoria</option>' +
        categoriasCache.map(c => `<option value="${c.id}" ${current == c.id ? 'selected' : ''}>${escapeHtml(c.nome)}</option>`).join('');
    }
  } catch (e) {
    document.getElementById('categoriaList').innerHTML = '<p class="tip" style="padding:16px;text-align:center;color:var(--danger)">Erro ao carregar: ' + e.message + '</p>';
  }
}

let editandoCategoriaId = null;

document.getElementById('btnSalvarCategoria')?.addEventListener('click', async () => {
  const nome = document.getElementById('catNome').value.trim();
  if (!nome) { toast('Nome obrigatório', 'warning'); return; }
  try {
    if (editandoCategoriaId) {
      await apiRequest('/categorias/' + editandoCategoriaId, { method: 'PUT', body: JSON.stringify({ nome }) });
      toast('Categoria atualizada!');
    } else {
      await apiRequest('/categorias', { method: 'POST', body: JSON.stringify({ nome }) });
      toast('Categoria criada!');
    }
    document.getElementById('catNome').value = '';
    editandoCategoriaId = null;
    carregarCategorias();
  } catch (e) {
    toast(e.message, 'danger');
  }
});

document.getElementById('btnLimparCategoria')?.addEventListener('click', () => {
  document.getElementById('catNome').value = '';
  editandoCategoriaId = null;
});

function editarCategoria(id) {
  const c = categoriasCache.find(x => x.id === id);
  if (!c) return;
  document.getElementById('catNome').value = c.nome;
  editandoCategoriaId = id;
  selectTab('categorias');
  toast('Editando categoria', 'info');
}

async function excluirCategoria(id) {
  if (!(await confirmModal('Excluir esta categoria?'))) return;
  try {
    await apiRequest('/categorias/' + id, { method: 'DELETE' });
    toast('Categoria removida');
    carregarCategorias();
  } catch (e) {
    toast(e.message, 'danger');
  }
}

function criarItemNaCategoria(catId) {
  limparFormProduto();
  if (fCategoryId) fCategoryId.value = catId;
  toggleEstoqueFields();
  selectTab('produtos');
  const topo = document.getElementById('view-produtos');
  if (topo) topo.scrollIntoView({ behavior: 'smooth', block: 'start' });
  fName.focus();
  toast('Novo item na categoria selecionada', 'info');
}

// ===== Produtos (Firestore) =====
const formProduto = document.getElementById('formProduto');
const tbodyProdutos = document.getElementById('tbodyProdutos');
const buscaInput = document.getElementById('busca');
const filtroStatus = document.getElementById('filtroStatus');
const btnReloadProdutos = document.getElementById('btnReloadProdutos');
const btnLimparForm = document.getElementById('btnLimparForm');
const skeletonArea = document.getElementById('skeletonArea');
const formTitle = document.getElementById('formTitle');

const fId = document.getElementById('prodId');
const fName = document.getElementById('prodName');
const fDesc = document.getElementById('prodDesc');
const fPrice = document.getElementById('prodPrice');
const fImg = document.getElementById('prodImg');
const fImgFile = document.getElementById('prodImgFile');
const fImgPreview = document.getElementById('prodImgPreview');
const fStatus = document.getElementById('prodStatus');
const fCategoryId = document.getElementById('prodCategoryId');
const fHideWhenOutOfStock = document.getElementById('prodHideWhenOutOfStock');

const fTipo = document.getElementById('prodTipo');
const camposSalgado = document.getElementById('camposComboSalgado');
const camposAcai = document.getElementById('camposComboAcai');
const listaSabores = document.getElementById('listaSabores');
const listaAcrescimos = document.getElementById('listaAcrescimos');

function toggleCamposCombo() {
  const t = fTipo.value;
  camposSalgado.style.display = t === 'combo_salgado' ? '' : 'none';
  camposAcai.style.display = t === 'combo_acai' ? '' : 'none';
  if (t === 'combo_salgado' && listaSabores.children.length === 0) adicionarLinhaSabor();
  if (t === 'combo_acai' && listaAcrescimos.children.length === 0) adicionarLinhaAcrescimo();
}
fTipo?.addEventListener('change', toggleCamposCombo);

const PAUSA_BTN = 'width:auto;flex:0 0 auto;padding:8px 10px;border-radius:8px;border:1px solid #22315b;background:#0a1224;color:var(--text);cursor:pointer;font-size:13px;';
const PAUSA_BTN_OFF = PAUSA_BTN;
const PAUSA_BTN_ON = 'width:auto;flex:0 0 auto;padding:8px 10px;border-radius:8px;border:1px solid #ef4444;background:#3b11117a;color:#ef4444;cursor:pointer;font-size:13px;';
const DELETE_BTN = 'width:auto;flex:0 0 auto;padding:8px 10px;border-radius:8px;border:1px solid #22315b;background:#0a1224;color:var(--text);cursor:pointer;font-size:13px;';
const ROW_NORMAL = 'display:flex;gap:6px;align-items:center;padding:6px 8px;border-radius:10px;border:1px solid transparent;transition:all .2s;';
const ROW_PAUSADO = 'display:flex;gap:6px;align-items:center;padding:6px 8px;border-radius:10px;border:1px solid #ef444480;background:#ef44440d;opacity:0.55;transition:all .2s;';

function togglePausa(btn) {
  const row = btn.closest('div');
  const isPausado = row.classList.toggle('pausado');
  row.style.cssText = isPausado ? ROW_PAUSADO : ROW_NORMAL;
  btn.style.cssText = isPausado ? PAUSA_BTN_ON : PAUSA_BTN_OFF;
  btn.innerHTML = isPausado ? '<i class="fas fa-play"></i>' : '<i class="fas fa-pause"></i>';
  btn.title = isPausado ? 'Reativar' : 'Pausar';
}

function adicionarLinhaSabor(nome, pausado) {
  const d = document.createElement('div');
  d.className = 'sabor-row' + (pausado ? ' pausado' : '');
  d.style.cssText = pausado ? ROW_PAUSADO : ROW_NORMAL;
  d.innerHTML = '<button type="button" class="sabor-pausa-btn" style="' + (pausado ? PAUSA_BTN_ON : PAUSA_BTN_OFF) + '" title="' + (pausado ? 'Reativar' : 'Pausar') + '" onclick="togglePausa(this)"><i class="fas fa-' + (pausado ? 'play' : 'pause') + '"></i></button>' +
    '<input type="text" class="sabor-nome" placeholder="Ex.: Coxinha" value="' + (nome ? escapeHtml(nome) : '') + '" style="flex:1;padding:10px 12px;border-radius:12px;border:1px solid #22315b;background:#0a1224;color:var(--text);font-weight:600;outline:none;">' +
    '<button type="button" class="btn ghost btn-sm" style="' + DELETE_BTN + '" onclick="this.parentElement.remove()"><i class="fas fa-times"></i></button>';
  listaSabores.appendChild(d);
}
function adicionarLinhaAcrescimo(nome, preco, pausado) {
  const d = document.createElement('div');
  d.className = 'acres-row' + (pausado ? ' pausado' : '');
  d.style.cssText = pausado ? ROW_PAUSADO : ROW_NORMAL;
  d.innerHTML = '<button type="button" class="acres-pausa-btn" style="' + (pausado ? PAUSA_BTN_ON : PAUSA_BTN_OFF) + '" title="' + (pausado ? 'Reativar' : 'Pausar') + '" onclick="togglePausa(this)"><i class="fas fa-' + (pausado ? 'play' : 'pause') + '"></i></button>' +
    '<input type="text" class="acres-nome" placeholder="Ex.: Oreo" value="' + (nome ? escapeHtml(nome) : '') + '" style="flex:2;padding:10px 12px;border-radius:12px;border:1px solid #22315b;background:#0a1224;color:var(--text);font-weight:600;outline:none;">' +
    '<input type="number" step="0.01" min="0" class="acres-preco" placeholder="R$" value="' + (preco != null ? preco : '') + '" style="flex:1;padding:10px 12px;border-radius:12px;border:1px solid #22315b;background:#0a1224;color:var(--text);font-weight:600;outline:none;">' +
    '<button type="button" class="btn ghost btn-sm" style="' + DELETE_BTN + '" onclick="this.parentElement.remove()"><i class="fas fa-times"></i></button>';
  listaAcrescimos.appendChild(d);
}

// File upload handler
fImgFile?.addEventListener('change', async function() {
  const file = this.files[0];
  if (!file) return;
  if (file.size > 5 * 1024 * 1024) {
    toast('Imagem muito grande! Máximo 5MB.', 'danger');
    this.value = '';
    return;
  }
  const allowedExt = /\.(jpg|jpeg|png|gif|webp|svg)$/i;
  const allowedMime = ['image/jpeg', 'image/png', 'image/gif', 'image/webp', 'image/svg+xml'];
  if (!allowedExt.test(file.name)) {
    toast('Formato inválido. Use jpg, png, gif, webp ou svg.', 'danger');
    this.value = '';
    return;
  }
  if (file.type && !allowedMime.includes(file.type)) {
    toast('Tipo de arquivo inválido. O arquivo não é uma imagem válida.', 'danger');
    this.value = '';
    return;
  }
  const imgAnterior = fImg.value;
  const previewAnterior = fImgPreview.src;
  const reader = new FileReader();
  reader.onload = e => { fImgPreview.src = e.target.result; fImgPreview.style.display = 'block'; };
  reader.readAsDataURL(file);
  const formData = new FormData();
  formData.append('file', file);
  try {
    const res = await fetch(API_BASE + '/upload', {
      method: 'POST',
      headers: { 'Authorization': 'Bearer ' + TOKEN },
      body: formData
    });
    const data = await res.json();
    if (!res.ok) {
      fImgPreview.src = previewAnterior;
      fImgPreview.style.display = previewAnterior ? 'block' : 'none';
      fImg.value = imgAnterior;
      toast(data.error || 'Erro no upload', 'danger');
      this.value = '';
      return;
    }
    fImg.value = data.url;
    toast('Imagem enviada!');
  } catch (e) {
    fImgPreview.src = previewAnterior;
    fImgPreview.style.display = previewAnterior ? 'block' : 'none';
    fImg.value = imgAnterior;
    this.value = '';
    toast('Falha no upload: ' + e.message, 'danger');
  }
});

let cacheProdutos = [];
var produtosTimer = null;

function showSkeleton(count=5){
  skeletonArea.innerHTML = Array(count).fill('<div class="skeleton-row"></div>').join('');
}
function hideSkeleton(){ skeletonArea.innerHTML = ''; }

async function carregarProdutosApi(){
  showSkeleton();
  try {
    cacheProdutos = await apiRequest('/produtos');
    cacheProdutos.forEach(p => {
      if (p.controlaEstoque && p.estoqueAtual !== null && p.estoqueMinimo !== null && p.estoqueAtual <= p.estoqueMinimo) {
        window.parent.postMessage({ tipo: "estoqueBaixo", produto: p.name }, window.location.origin);
      }
    });
  } catch(e) {
    console.error('Erro ao carregar produtos:', e);
    cacheProdutos = [];
  }
  hideSkeleton();
  renderProdutos();
}

function listenProdutos(){
  carregarProdutosApi();
  if(produtosTimer) clearInterval(produtosTimer);
  produtosTimer = setInterval(carregarProdutosApi, 30000);
}

function getStatusLabel(p){
  if(p.controlaEstoque){
    if(p.estoqueAtual <= 0) return { text: 'Esgotado', cls: 'pill-estoque' };
    if(p.estoqueAtual <= p.estoqueMinimo) return { text: `Estoque Baixo (${p.estoqueAtual})`, cls: 'pill-baixo' };
    return { text: `Em estoque (${p.estoqueAtual})`, cls: 'pill-active' };
  }
  if(p.status === 'paused') return { text: 'Pausado', cls: 'pill-paused' };
  return { text: 'Ativo', cls: 'pill-active' };
}

function renderProdutos(){
  const q = (buscaInput?.value||'').trim().toLowerCase();
  const sf = filtroStatus?.value || '';

  let filtered = cacheProdutos;
  if(q) filtered = filtered.filter(p => (String(p.name||'')).toLowerCase().includes(q) || String(p.id).toLowerCase().includes(q));
  if(sf === 'active') filtered = filtered.filter(p => !p.controlaEstoque && p.status !== 'paused');
  else if(sf === 'paused') filtered = filtered.filter(p => !p.controlaEstoque && p.status === 'paused');
  else if(sf === 'sem_estoque') filtered = filtered.filter(p => p.controlaEstoque && p.estoqueAtual <= 0);

  tbodyProdutos.innerHTML = filtered.map(p => {
    const st = getStatusLabel(p);
    return `
      <tr>
        <td>${p.id ?? '-'}</td>
        <td>
          <img class="prodThumb" src="${p.img||''}" alt="${escapeHtml(p.name||'')}">
          ${escapeHtml(p.name||'')}
          ${p.config && p.config.tipo
            ? '<span class="pill pill-active" style="font-size:10px;">' + (p.config.tipo === 'combo_acai' ? 'Açaí' : 'Combo') + '</span>'
            : ''}
        </td>
        <td>R$ ${(Number(p.price)||0).toFixed(2).replace('.',',')}</td>
        <td><span class="pill ${st.cls}">${st.text}</span></td>
        <td>
          <div class="actions">
            <button class="btn ghost btn-sm" data-act="edit" data-id="${p.id}"><i class="fas fa-pen"></i></button>
            ${p.status==='paused'
              ? `<button class="btn save btn-sm" data-act="resume" data-id="${p.id}"><i class="fas fa-play"></i></button>`
              : `<button class="btn pause btn-sm" data-act="pause" data-id="${p.id}"><i class="fas fa-pause"></i></button>`}
            <button class="btn danger btn-sm" data-act="del" data-id="${p.id}"><i class="fas fa-trash"></i></button>
          </div>
        </td>
      </tr>
    `;
  }).join('');

  tbodyProdutos.querySelectorAll('button[data-act]').forEach(btn=>btn.addEventListener('click', onActionProduto));
}

function onActionProduto(e){
  const act = e.currentTarget.getAttribute('data-act');
  const id = Number(e.currentTarget.getAttribute('data-id'));
  if(isNaN(id)) return;
  if(act==='edit') return carregarNoForm(id);
  if(act==='pause') return pauseResume(id,true);
  if(act==='resume') return pauseResume(id,false);
  if(act==='del') return removerProduto(id);
}

let isEditando = false;

function limparFormProduto() {
  formProduto.reset();
  fImgPreview.src = '';
  fImgPreview.style.display = 'none';
  isEditando = false;
  document.getElementById("btnSalvarProduto").textContent = "Salvar";
  document.getElementById("formTitle").textContent = "Novo Produto";
  toggleEstoqueFields();
  if (fTipo) fTipo.value = '';
  if (listaSabores) listaSabores.innerHTML = '';
  if (listaAcrescimos) listaAcrescimos.innerHTML = '';
  toggleCamposCombo();
}

function carregarNoForm(id) {
  const p = cacheProdutos.find(x => x.id === id);
  if (!p) return;

  fId.value = p.id;
  fName.value = p.name || '';
  fDesc.value = p.description || '';
  fPrice.value = p.price;
  fImg.value = p.img || '';
  if (p.img) { fImgPreview.src = p.img; fImgPreview.style.display = 'block'; }
  else { fImgPreview.style.display = 'none'; fImgPreview.src = ''; }
  fStatus.value = p.status || 'active';
  fCongelado.checked = p.congelado || false;
  fControlaEstoque.checked = p.controlaEstoque || false;
  fEstoqueAtual.value = p.estoqueAtual ?? '';
  fEstoqueMinimo.value = p.estoqueMinimo ?? '';
  fHideWhenOutOfStock.checked = p.hideWhenOutOfStock !== false;

  if (fCategoryId) {
    fCategoryId.value = p.categoryId || '';
  }

  const cfg = p.config || null;
  if (fTipo) {
    fTipo.value = cfg && cfg.tipo ? cfg.tipo : '';
    if (listaSabores) listaSabores.innerHTML = '';
    if (listaAcrescimos) listaAcrescimos.innerHTML = '';
    if (cfg && cfg.tipo === 'combo_salgado') {
      document.getElementById('comboUnidades').value = cfg.unidades || '';
      (cfg.sabores || []).forEach(s => {
        if (typeof s === 'string') adicionarLinhaSabor(s, false);
        else adicionarLinhaSabor(s.nome, s.pausado);
      });
    } else if (cfg && cfg.tipo === 'combo_acai') {
      document.getElementById('comboGratis').value = cfg.acrescimosGratis || 0;
      document.getElementById('comboMax').value = cfg.maxAcrescimos || 0;
      (cfg.acrescimos || []).forEach(a => adicionarLinhaAcrescimo(a.nome, a.preco, a.pausado));
    }
    toggleCamposCombo();
  }

  toggleEstoqueFields();
  isEditando = true;
  document.getElementById("btnSalvarProduto").textContent = "Atualizar";
  selectTab('produtos');

  const card = document.getElementById("cardFormProduto");
  setTimeout(() => {
    card.scrollIntoView({ behavior: "smooth", block: "start" });
    card.classList.add("highlight-edit");
    setTimeout(() => card.classList.remove("highlight-edit"), 2000);
  }, 100);
  fName.focus();
}

async function pauseResume(id, pause){
  try {
    await apiRequest('/produtos/' + id, { method: 'PUT', body: { status: pause ? "paused" : "active" } });
    toast(pause ? 'Produto pausado' : 'Produto ativado');
    carregarProdutosApi();
  } catch(e) {
    toast('Erro ao atualizar produto', '#ef4444');
  }
}

async function removerProduto(id){
  const confirmed = await confirmModal(`Remover produto ID ${id}?`);
  if(!confirmed) return;
  try {
    await apiRequest('/produtos/' + id, { method: 'DELETE' });
    toast('Produto removido', '#ef4444');
    carregarProdutosApi();
  } catch(e) {
    toast('Erro ao remover produto', '#ef4444');
  }
}

formProduto.addEventListener('submit', async e => {
  e.preventDefault();

  const payload = {
    id: Number(fId.value),
    name: (fName.value || '').trim(),
    description: (fDesc.value || '').trim(),
    price: Number(fPrice.value),
    img: (fImg.value || '').trim(),
    status: fStatus.value || 'active',
    congelado: fCongelado.checked,
    controlaEstoque: fControlaEstoque.checked,
    estoqueAtual: fControlaEstoque.checked ? Number(fEstoqueAtual.value) || 0 : 0,
    estoqueMinimo: fControlaEstoque.checked ? Number(fEstoqueMinimo.value) || 0 : 0,
    hideWhenOutOfStock: fHideWhenOutOfStock.checked,
  };

  if (fCategoryId && fCategoryId.value) {
    payload.categoryId = Number(fCategoryId.value);
  }

  if (fTipo && fTipo.value) {
    let cfg = null;
    if (fTipo.value === 'combo_salgado') {
      const sabores = Array.from(document.querySelectorAll('#listaSabores .sabor-row'))
        .map(row => ({
          nome: row.querySelector('.sabor-nome').value.trim(),
          pausado: row.classList.contains('pausado')
        }))
        .filter(s => s.nome);
      cfg = { tipo: 'combo_salgado', unidades: Number(document.getElementById('comboUnidades').value) || 0, sabores: sabores };
    } else if (fTipo.value === 'combo_acai') {
      const acrescimos = Array.from(document.querySelectorAll('#listaAcrescimos .acres-row'))
        .map(row => ({
          nome: row.querySelector('.acres-nome').value.trim(),
          preco: Number(row.querySelector('.acres-preco').value) || 0,
          pausado: row.classList.contains('pausado')
        }))
        .filter(a => a.nome);
      cfg = {
        tipo: 'combo_acai',
        acrescimosGratis: Number(document.getElementById('comboGratis').value) || 0,
        maxAcrescimos: Number(document.getElementById('comboMax').value) || 0,
        acrescimos: acrescimos,
      };
    }
    const v = ComboConfig.validarConfig(fTipo.value, cfg);
    if (!v.ok) { toast(v.erro, 'warning'); return; }
    payload.type = 3;
    payload.config = cfg;
  }

  if (payload.controlaEstoque && payload.estoqueAtual <= 0) {
    payload.status = "paused";
  }

  if (!payload.id || !payload.name || isNaN(payload.price)) {
    toast('Preencha ID, Nome e Preço corretamente.', '#ef4444');
    fId.focus();
    return;
  }

  try {
    if (isEditando) {
      await apiRequest('/produtos/' + payload.id, { method: 'PUT', body: payload });
    } else {
      // Check if ID already exists
      var existing = cacheProdutos.find(function(p) { return p.id === payload.id; });
      if (existing) {
        toast('ID já cadastrado!', '#f59e0b');
        fId.focus();
        fId.style.transition = "box-shadow 0.3s";
        fId.style.boxShadow = "0 0 5px 2px red";
        setTimeout(() => fId.style.boxShadow = "", 800);
        return;
      }
      await apiRequest('/produtos', { method: 'POST', body: payload });
    }
    toast(isEditando ? 'Produto atualizado!' : 'Produto cadastrado!');
    blink(e.submitter);
    limparFormProduto();
    selectTab('produtos');
    const topo = document.getElementById('view-produtos');
    if (topo) topo.scrollIntoView({ behavior: 'smooth', block: 'start' });
    carregarProdutosApi();
  } catch (err) {
    console.error("Erro ao salvar produto:", err);
    toast('Erro ao salvar produto', '#ef4444');
  }
});

const fControlaEstoque = document.getElementById("prodControlaEstoque");
const fEstoqueAtual = document.getElementById("prodEstoqueAtual");
const fEstoqueMinimo = document.getElementById("prodEstoqueMinimo");

function toggleEstoqueFields() {
  const fields = document.querySelectorAll(".estoque-fields");
  fields.forEach(f => {
    f.style.display = fControlaEstoque.checked ? "" : "none";
  });
}

fControlaEstoque?.addEventListener("change", toggleEstoqueFields);
toggleEstoqueFields();

btnLimparForm?.addEventListener('click', () => {
  limparFormProduto();
});

buscaInput?.addEventListener('input', renderProdutos);
filtroStatus?.addEventListener('change', renderProdutos);
btnReloadProdutos?.addEventListener('click', ()=>{ listenProdutos(); blink(btnReloadProdutos); toast('Lista atualizada') });

function blink(el){ const prev=el.style.boxShadow; el.style.boxShadow='0 0 0 6px var(--ring)'; setTimeout(()=>el.style.boxShadow=prev,300) }
function escapeHtml(str){ return String(str).replace(/[&<>"']/g, s => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;','\'':'&#39;'}[s])) }

// ===== Configurações da Loja (backend API) =====
async function carregarConfigLoja() {
  try {
    const settings = await apiRequest('/loja/settings-admin');
    document.getElementById('confNome').value = settings.nome || '';
    document.getElementById('confTelefone').value = settings.telefone || '';
    document.getElementById('confDescricao').value = settings.descricao || '';
    document.getElementById('confEndereco').value = settings.endereco || '';
    document.getElementById('confNumero').value = settings.numero || '';
    document.getElementById('confBairro').value = settings.bairro || '';
    document.getElementById('confCidade').value = settings.cidade || '';
    document.getElementById('confEstado').value = settings.estado || '';
    document.getElementById('confCep').value = settings.cep || '';
    document.getElementById('confLatitude').value = settings.latitude || '';
    document.getElementById('confLongitude').value = settings.longitude || '';
    document.getElementById('confLogo').value = settings.logo || '';
    if (settings.logoUrl) {
      document.getElementById('confLogoPreview').src = settings.logoUrl;
      document.getElementById('confLogoPreview').style.display = 'block';
    }
    document.getElementById('confCapa').value = settings.capa || '';
    if (settings.capaUrl) {
      document.getElementById('confCapaPreview').src = settings.capaUrl;
      document.getElementById('confCapaPreview').style.display = 'block';
    }
    renderBairros(settings.bairrosAtendidos || []);
  } catch (e) {
    console.warn('Erro ao carregar config loja:', e.message);
  }
}

// Logo upload handler
document.getElementById('confLogoFile')?.addEventListener('change', async function() {
  const file = this.files[0];
  if (!file) return;
  if (file.size > 5 * 1024 * 1024) {
    toast('Imagem muito grande! Máximo 5MB.', 'danger');
    this.value = '';
    return;
  }
  const allowed = /\.(jpg|jpeg|png|gif|webp|svg)$/i;
  if (!allowed.test(file.name)) {
    toast('Formato inválido. Use jpg, png, gif, webp ou svg.', 'danger');
    this.value = '';
    return;
  }
  const reader = new FileReader();
  reader.onload = e => { document.getElementById('confLogoPreview').src = e.target.result; document.getElementById('confLogoPreview').style.display = 'block'; };
  reader.readAsDataURL(file);
  const formData = new FormData();
  formData.append('file', file);
  try {
    const res = await fetch(API_BASE + '/upload', { method: 'POST', body: formData });
    const data = await res.json();
    if (!res.ok) {
      toast(data.error || 'Erro no upload', 'danger');
      return;
    }
    document.getElementById('confLogo').value = data.filename;
    toast('Logo enviada: ' + data.filename);
  } catch (e) {
    toast('Falha no upload da logo: ' + e.message, 'danger');
  }
});

// Banner upload handler
document.getElementById('confCapaFile')?.addEventListener('change', async function() {
  const file = this.files[0];
  if (!file) return;
  if (file.size > 5 * 1024 * 1024) {
    toast('Imagem muito grande! Máximo 5MB.', 'danger');
    this.value = '';
    return;
  }
  const allowed = /\.(jpg|jpeg|png|gif|webp|svg)$/i;
  if (!allowed.test(file.name)) {
    toast('Formato inválido. Use jpg, png, gif, webp ou svg.', 'danger');
    this.value = '';
    return;
  }
  const reader = new FileReader();
  reader.onload = e => { document.getElementById('confCapaPreview').src = e.target.result; document.getElementById('confCapaPreview').style.display = 'block'; };
  reader.readAsDataURL(file);
  const formData = new FormData();
  formData.append('file', file);
  try {
    const res = await fetch(API_BASE + '/upload', { method: 'POST', body: formData });
    const data = await res.json();
    if (!res.ok) {
      toast(data.error || 'Erro no upload', 'danger');
      return;
    }
    document.getElementById('confCapa').value = data.filename;
    toast('Banner enviado: ' + data.filename);
  } catch (e) {
    toast('Falha no upload do banner: ' + e.message, 'danger');
  }
});

// ===== Bairros Atendidos =====
function renderBairros(lista) {
  const container = document.getElementById('bairrosContainer');
  if (!container) return;
  container.innerHTML = '';
  (lista || []).forEach(function(b, i) { addBairroRow(b.nome, b.taxa); });
  if (!lista || lista.length === 0) addBairroRow('', '');
}

function addBairroRow(nome, taxa) {
  const container = document.getElementById('bairrosContainer');
  if (!container) return;
  const div = document.createElement('div');
  div.className = 'bairro-row';
  div.style.cssText = 'display:flex;gap:8px;align-items:center;margin-bottom:6px;';
  div.innerHTML =
    '<input type="text" class="bairro-nome" placeholder="Nome do bairro" value="' + escapeHtml(nome || '') + '" style="flex:2;padding:6px 10px;border:1px solid var(--border);border-radius:6px;" />' +
    '<input type="number" step="0.01" min="0" class="bairro-taxa" placeholder="Taxa R$" value="' + (taxa != null ? taxa : '') + '" style="flex:1;padding:6px 10px;border:1px solid var(--border);border-radius:6px;" />' +
    '<button class="btn remove-bairro" type="button" style="padding:6px 10px;background:var(--danger);color:#fff;border:none;border-radius:6px;cursor:pointer;"><i class="fas fa-times"></i></button>';
  div.querySelector('.remove-bairro').onclick = function() {
    div.remove();
  };
  container.appendChild(div);
}

function collectBairros() {
  const linhas = document.querySelectorAll('#bairrosContainer .bairro-row');
  const result = [];
  linhas.forEach(function(row) {
    const nome = row.querySelector('.bairro-nome').value.trim();
    const taxa = parseFloat(row.querySelector('.bairro-taxa').value);
    if (nome && !isNaN(taxa) && taxa >= 0) {
      result.push({ nome: nome, taxa: taxa });
    }
  });
  return result;
}

document.getElementById('btnAddBairro')?.addEventListener('click', function() {
  addBairroRow('', '');
});

document.getElementById('btnSalvarConfig')?.addEventListener('click', async () => {
  const payload = {
    nome: document.getElementById('confNome').value.trim(),
    telefone: document.getElementById('confTelefone').value.trim(),
    descricao: document.getElementById('confDescricao').value.trim(),
    endereco: document.getElementById('confEndereco').value.trim(),
    numero: document.getElementById('confNumero').value.trim(),
    bairro: document.getElementById('confBairro').value.trim(),
    cidade: document.getElementById('confCidade').value.trim(),
    estado: document.getElementById('confEstado').value.trim(),
    cep: document.getElementById('confCep').value.trim(),
    latitude: document.getElementById('confLatitude').value.trim() || null,
    longitude: document.getElementById('confLongitude').value.trim() || null,
    logo: document.getElementById('confLogo').value.trim() || null,
    capa: document.getElementById('confCapa').value.trim() || null,
    bairrosAtendidos: collectBairros(),
  };
  try {
    await apiRequest('/loja/settings', { method: 'PUT', body: JSON.stringify(payload) });
    blink(document.getElementById('btnSalvarConfig'));
    toast('Configurações salvas!');
  } catch (e) {
    toast(e.message, 'danger');
  }
});

document.getElementById('btnRecarregarConfig')?.addEventListener('click', () => { carregarConfigLoja(); blink(document.getElementById('btnRecarregarConfig')); toast('Configurações recarregadas'); });

// ===== Personalização do Tema =====
function previewTema() {
  var t = {
    primaryColor: (document.getElementById('themePrimary') || {}).value || '#F26D3D',
    backgroundColor: (document.getElementById('themeBackground') || {}).value || '#FFFAF8',
    surfaceColor: (document.getElementById('themeSurface') || {}).value || '#FFFFFF',
    textColor: (document.getElementById('themeText') || {}).value || '#2D1A12',
    isDark: (document.getElementById('themeIsDark') || {}).checked || false,
  };
  if (typeof applyTheme === 'function') applyTheme(t);
  var pp = document.getElementById('previewPrimary');
  var ps = document.getElementById('previewSecondary');
  var psu = document.getElementById('previewSurface');
  var pt = document.getElementById('previewText');
  if (pp) pp.style.background = t.primaryColor;
  if (ps) ps.style.background = t.backgroundColor;
  if (psu) psu.style.background = t.surfaceColor;
  if (pt) pt.style.background = t.textColor;
}

async function carregarTema() {
  try {
    var settings = await apiRequest('/loja/settings-admin');
    var t = settings.themeSettings || {};
    var p = document.getElementById('themePrimary');
    var bg = document.getElementById('themeBackground');
    var sf = document.getElementById('themeSurface');
    var tx = document.getElementById('themeText');
    var dk = document.getElementById('themeIsDark');
    if (p) p.value = t.primaryColor || '#F26D3D';
    if (bg) bg.value = t.backgroundColor || '#FFFAF8';
    if (sf) sf.value = t.surfaceColor || '#FFFFFF';
    if (tx) tx.value = t.textColor || '#2D1A12';
    if (dk) dk.checked = t.isDark || false;
    previewTema();
  } catch (e) {
    toast('Erro ao carregar tema', 'danger');
  }
}

['themePrimary','themeBackground','themeSurface','themeText'].forEach(function(id) {
  var el = document.getElementById(id);
  if (el) el.addEventListener('input', previewTema);
});
var dk = document.getElementById('themeIsDark');
if (dk) dk.addEventListener('change', previewTema);

document.getElementById('btnSalvarTema')?.addEventListener('click', async function() {
  var themeSettings = {
    primaryColor: (document.getElementById('themePrimary') || {}).value || '#F26D3D',
    backgroundColor: (document.getElementById('themeBackground') || {}).value || '#FFFAF8',
    surfaceColor: (document.getElementById('themeSurface') || {}).value || '#FFFFFF',
    textColor: (document.getElementById('themeText') || {}).value || '#2D1A12',
    isDark: (document.getElementById('themeIsDark') || {}).checked || false,
  };
  try {
    await apiRequest('/loja/settings', {
      method: 'PUT',
      body: JSON.stringify({ themeSettings: themeSettings }),
    });
    blink(document.getElementById('btnSalvarTema'));
    toast('Tema salvo com sucesso!');
  } catch (e) {
    toast(e.message, 'danger');
  }
});

// Notification sound upload
const notifSoundFile = document.getElementById('notifSoundFile');
const notifSoundPreview = document.getElementById('notifSoundPreview');
const notifSoundAudio = document.getElementById('notifSoundAudio');
const btnRemoveSound = document.getElementById('btnRemoveSound');

// Load current sound on page load
(async function() {
  try {
    const settings = await apiRequest('/loja/settings-admin');
    const soundUrl = settings.notificationSound || (settings.themeSettings && settings.themeSettings.notificationSound);
    if (soundUrl && notifSoundAudio) {
      notifSoundAudio.src = soundUrl;
      notifSoundPreview.style.display = 'flex';
    }
  } catch(e) { /* silent — default beep used */ }
})();

notifSoundFile?.addEventListener('change', async function() {
  const file = this.files[0];
  if (!file) return;
  if (file.size > 500 * 1024) {
    toast('Som muito grande! Máximo 500KB.', 'danger');
    this.value = '';
    return;
  }
  const allowedMime = ['audio/mpeg', 'audio/mp3', 'audio/wav', 'audio/ogg', 'audio/x-wav', 'audio/webm'];
  const allowedExt = /\.(mp3|wav|ogg)$/i;
  if (!allowedExt.test(file.name)) {
    toast('Formato inválido. Use MP3, WAV ou OGG.', 'danger');
    this.value = '';
    return;
  }
  if (file.type && !allowedMime.includes(file.type)) {
    toast('Tipo de arquivo inválido. Envie um áudio MP3, WAV ou OGG.', 'danger');
    this.value = '';
    return;
  }
  const formData = new FormData();
  formData.append('file', file);
  try {
    const res = await fetch(API_BASE + '/upload', {
      method: 'POST',
      headers: { 'Authorization': 'Bearer ' + TOKEN },
      body: formData
    });
    const data = await res.json();
    if (!res.ok) {
      toast(data.error || 'Erro no upload do som', 'danger');
      this.value = '';
      return;
    }
    // Save URL to settings
    await apiRequest('/loja/settings', {
      method: 'PUT',
      body: JSON.stringify({ notificationSound: data.url }),
    });
    notifSoundAudio.src = data.url;
    notifSoundPreview.style.display = 'flex';
    toast('Som de notificação salvo!');
  } catch (e) {
    toast('Falha ao enviar som: ' + e.message, 'danger');
    this.value = '';
  }
});

btnRemoveSound?.addEventListener('click', async function() {
  try {
    await apiRequest('/loja/settings', {
      method: 'PUT',
      body: JSON.stringify({ notificationSound: '' }),
    });
    notifSoundAudio.src = '';
    notifSoundPreview.style.display = 'none';
    notifSoundFile.value = '';
    toast('Som removido. Usando beep padrão.');
  } catch (e) {
    toast('Erro ao remover som: ' + e.message, 'danger');
  }
});

document.getElementById('btnResetarTema')?.addEventListener('click', async function() {
  var defaults = {
    primaryColor: '#F26D3D',
    backgroundColor: '#FFFAF8',
    surfaceColor: '#FFFFFF',
    textColor: '#2D1A12',
    isDark: false,
  };
  try {
    await apiRequest('/loja/settings', {
      method: 'PUT',
      body: JSON.stringify({ themeSettings: defaults }),
    });
    carregarTema();
    toast('Tema restaurado para o padrão!');
  } catch (e) {
    toast(e.message, 'danger');
  }
});

(function init(){ carregarHorarios(); carregarLojaConfig(); listenProdutos(); carregarCategorias(); })();

async function carregarFinanceiro() {
  try {
    var actual = await apiRequest('/empresa/settlement/actual');
    var card = document.getElementById('settlementCard');
    if (actual.message) {
      card.innerHTML = '<p style="color:var(--text-muted)">Nenhum settlement nesta semana</p>';
    } else {
      var statusColors = { processando: '#F59E0B', pendente: '#3B82F6', pago: '#10B981', erro: '#EF4444' };
      var cor = statusColors[actual.status] || '#666';
      var periodo = new Date(actual.weekStart).toLocaleDateString('pt-BR') + ' - ' + new Date(actual.weekEnd).toLocaleDateString('pt-BR');
      card.innerHTML = '<p><strong>Periodo:</strong> ' + periodo + '</p>' +
        '<p><strong>Pedidos:</strong> ' + actual.totalPedidos + '</p>' +
        '<p><strong>Bruto:</strong> R$ ' + Number(actual.totalBruto).toFixed(2) + '</p>' +
        '<p><strong>Liquido:</strong> R$ ' + Number(actual.totalLiquido).toFixed(2) + '</p>' +
        '<p><strong>Status:</strong> <span style="color:' + cor + ';font-weight:600">' + actual.status + '</span></p>';
    }
  } catch(e) {
    document.getElementById('settlementCard').innerHTML = '<p style="color:var(--text-muted)">Nenhum settlement nesta semana</p>';
  }

  try {
    var history = await apiRequest('/empresa/settlement/history');
    var container = document.getElementById('settlementHistory');
    if (!history.settlements || !history.settlements.length) {
      container.innerHTML = '<p style="color:var(--text-muted)">Nenhum settlement anterior</p>';
      return;
    }
    container.innerHTML = history.settlements.map(function(s) {
      var periodo = new Date(s.weekStart).toLocaleDateString('pt-BR') + ' - ' + new Date(s.weekEnd).toLocaleDateString('pt-BR');
      var cor = s.status === 'pago' ? '#10B981' : '#F59E0B';
      return '<div style="display:flex;justify-content:space-between;padding:8px 0;border-bottom:1px solid var(--border,#eee)">' +
        '<span>' + periodo + '</span>' +
        '<span>R$ ' + Number(s.totalLiquido).toFixed(2) + '</span>' +
        '<span style="color:' + cor + ';font-weight:600">' + s.status + '</span>' +
        '</div>';
    }).join('');
  } catch(e) {
    document.getElementById('settlementHistory').innerHTML = '<p style="color:var(--text-muted)">Nenhum settlement anterior</p>';
  }
}

// ===== Pagamentos (PIX) =====

function validatePaymentForm() {
  var email = (document.getElementById('payEmail') || {}).value || '';
  var cpfCnpj = (document.getElementById('payCpfCnpj') || {}).value || '';
  var pixKey = (document.getElementById('payPixKey') || {}).value || '';
  var pixKeyType = (document.getElementById('payPixKeyType') || {}).value || '';

  // Email validation
  var emailRe = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRe.test(email)) {
    return { ok: false, msg: 'E-mail inválido.' };
  }

  // CPF/CNPJ validation (basic: strip non-digits, check length)
  var digits = cpfCnpj.replace(/\D/g, '');
  if (digits.length !== 11 && digits.length !== 14) {
    return { ok: false, msg: 'CPF deve ter 11 dígitos ou CNPJ 14 dígitos.' };
  }

  // PIX key validation based on type
  if (!pixKey.trim()) {
    return { ok: false, msg: 'Chave PIX é obrigatória.' };
  }
  if (pixKeyType === 'cpf') {
    var pkDigits = pixKey.replace(/\D/g, '');
    if (pkDigits.length !== 11) return { ok: false, msg: 'Chave PIX CPF deve ter 11 dígitos.' };
  } else if (pixKeyType === 'cnpj') {
    var pkDigits2 = pixKey.replace(/\D/g, '');
    if (pkDigits2.length !== 14) return { ok: false, msg: 'Chave PIX CNPJ deve ter 14 dígitos.' };
  } else if (pixKeyType === 'email') {
    if (!emailRe.test(pixKey)) return { ok: false, msg: 'Chave PIX e-mail inválida.' };
  } else if (pixKeyType === 'phone') {
    var pkDigits3 = pixKey.replace(/\D/g, '');
    if (pkDigits3.length < 10 || pkDigits3.length > 13) return { ok: false, msg: 'Chave PIX telefone inválida.' };
  }

  return { ok: true };
}

function renderPaymentState(empresa) {
  var statusBox = document.getElementById('payment-status-box');
  var statusContent = document.getElementById('payment-status-content');
  var formContainer = document.getElementById('payment-form-container');
  var errorDiv = document.getElementById('payment-error');
  var btnAtivar = document.getElementById('btnAtivarPayment');
  var btnAtualizar = document.getElementById('btnAtualizarPayment');
  var btnDesativar = document.getElementById('btnDesativarPayment');

  if (errorDiv) errorDiv.style.display = 'none';

  if (!empresa || !empresa.pixKey) {
    // No payment configured
    statusBox.style.display = 'none';
    btnAtivar.style.display = '';
    btnAtualizar.style.display = 'none';
    btnDesativar.style.display = 'none';
    return;
  }

  // Payment active
  statusBox.style.display = 'block';
  var nextMonday = empresa.nextMonday ? new Date(empresa.nextMonday).toLocaleDateString('pt-BR') : '—';
  var statusColor = empresa.status === 'active' ? '#10B981' : '#F59E0B';
  statusContent.innerHTML =
    '<p style="margin:0;"><strong>Status:</strong> <span style="color:' + statusColor + ';">' + (empresa.status || 'active') + '</span></p>' +
    '<p style="margin:4px 0 0 0;"><strong>Chave PIX:</strong> ' + escapeHtml(empresa.pixKey) + ' (' + escapeHtml(empresa.pixKeyType || '') + ')</p>' +
    '<p style="margin:4px 0 0 0;"><strong>Próximo pagamento:</strong> ' + nextMonday + '</p>';
  statusBox.style.borderColor = statusColor;
  statusBox.style.background = statusColor + '10';

  // Fill form with current values
  if (empresa.email) document.getElementById('payEmail').value = empresa.email;
  if (empresa.cpfCnpj) document.getElementById('payCpfCnpj').value = empresa.cpfCnpj;
  if (empresa.pixKey) document.getElementById('payPixKey').value = empresa.pixKey;
  if (empresa.pixKeyType) document.getElementById('payPixKeyType').value = empresa.pixKeyType;

  btnAtivar.style.display = 'none';
  btnAtualizar.style.display = '';
  btnDesativar.style.display = '';
}

async function carregarPaymentConfig() {
  try {
    var data = await apiRequest('/empresa/payment/status');
    renderPaymentState(data);
  } catch (e) {
    // Not configured yet — show empty form
    renderPaymentState(null);
  }
}

async function ativarPayment() {
  var validation = validatePaymentForm();
  if (!validation.ok) {
    var errDiv = document.getElementById('payment-error');
    errDiv.textContent = validation.msg;
    errDiv.style.display = 'block';
    return;
  }

  var payload = {
    email: document.getElementById('payEmail').value.trim(),
    cpfCnpj: document.getElementById('payCpfCnpj').value.replace(/\D/g, ''),
    pixKey: document.getElementById('payPixKey').value.trim(),
    pixKeyType: document.getElementById('payPixKeyType').value,
  };

  try {
    await apiRequest('/empresa/payment/setup', { method: 'POST', body: payload });
    blink(document.getElementById('btnAtivarPayment'));
    toast('Pagamentos ativados com sucesso!');
    carregarPaymentConfig();
  } catch (e) {
    var errDiv = document.getElementById('payment-error');
    errDiv.textContent = e.message;
    errDiv.style.display = 'block';
  }
}

async function atualizarPayment() {
  var validation = validatePaymentForm();
  if (!validation.ok) {
    var errDiv = document.getElementById('payment-error');
    errDiv.textContent = validation.msg;
    errDiv.style.display = 'block';
    return;
  }

  var pixKey = document.getElementById('payPixKey').value.trim();
  var pixKeyType = document.getElementById('payPixKeyType').value;

  try {
    await apiRequest('/empresa/payment', { method: 'PUT', body: { pixKey: pixKey, pixKeyType: pixKeyType } });
    blink(document.getElementById('btnAtualizarPayment'));
    toast('Chave PIX atualizada!');
    carregarPaymentConfig();
  } catch (e) {
    var errDiv = document.getElementById('payment-error');
    errDiv.textContent = e.message;
    errDiv.style.display = 'block';
  }
}

async function desativarPayment() {
  var confirmed = await confirmModal('Desativar pagamentos? Você não receberá transferências automaticamente.');
  if (!confirmed) return;

  try {
    await apiRequest('/empresa/payment', { method: 'DELETE' });
    toast('Pagamentos desativados.');
    document.getElementById('payPixKey').value = '';
    document.getElementById('payPixKeyType').value = 'cpf';
    carregarPaymentConfig();
  } catch (e) {
    var errDiv = document.getElementById('payment-error');
    errDiv.textContent = e.message;
    errDiv.style.display = 'block';
  }
}

document.getElementById('btnAtivarPayment')?.addEventListener('click', ativarPayment);
document.getElementById('btnAtualizarPayment')?.addEventListener('click', atualizarPayment);
document.getElementById('btnDesativarPayment')?.addEventListener('click', desativarPayment);
