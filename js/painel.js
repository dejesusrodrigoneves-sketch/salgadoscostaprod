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
  const res = await fetch(url, { ...options, headers });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: 'Erro na requisição' }));
    throw new Error(err.error || 'Erro HTTP ' + res.status);
  }
  return res.json();
}

// ===== Tabs =====
const tabs = ['horarios', 'produtos', 'categorias', 'config'];
function selectTab(which){
  tabs.forEach(t => {
    const btn = document.getElementById('tab-' + t);
    const view = document.getElementById('view-' + t);
    if (btn) btn.setAttribute('aria-selected', t === which);
    if (view) view.classList.toggle('hidden', t !== which);
  });
}
document.getElementById('tab-horarios')?.addEventListener('click', () => selectTab('horarios'));
document.getElementById('tab-produtos')?.addEventListener('click', () => selectTab('produtos'));
document.getElementById('tab-categorias')?.addEventListener('click', () => { selectTab('categorias'); carregarCategorias(); });
document.getElementById('tab-config')?.addEventListener('click', () => { selectTab('config'); carregarConfigLoja(); });

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
    var settings = await apiRequest('/loja/settings');
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
      list.innerHTML = categoriasCache.map(c => `
        <div style="display:flex;align-items:center;justify-content:space-between;padding:8px 12px;border:1px solid #1f2a4d;border-radius:8px;margin-bottom:6px;">
          <div>
            <strong>${escapeHtml(c.nome)}</strong>
            ${c.type ? `<span class="tip" style="margin-left:8px;">Tipo: ${c.type}</span>` : ''}
          </div>
          <div class="actions" style="display:flex;gap:4px;">
            <button class="btn btn-sm ghost" onclick="editarCategoria(${c.id})"><i class="fas fa-pen"></i></button>
            <button class="btn btn-sm danger" onclick="excluirCategoria(${c.id})"><i class="fas fa-trash"></i></button>
          </div>
        </div>
      `).join('');
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
  const type = document.getElementById('catType').value ? Number(document.getElementById('catType').value) : null;
  if (!nome) { toast('Nome obrigatório', 'warning'); return; }
  try {
    if (editandoCategoriaId) {
      await apiRequest('/categorias/' + editandoCategoriaId, { method: 'PUT', body: JSON.stringify({ nome, type }) });
      toast('Categoria atualizada!');
    } else {
      await apiRequest('/categorias', { method: 'POST', body: JSON.stringify({ nome, type }) });
      toast('Categoria criada!');
    }
    document.getElementById('catNome').value = '';
    document.getElementById('catType').value = '';
    editandoCategoriaId = null;
    carregarCategorias();
  } catch (e) {
    toast(e.message, 'danger');
  }
});

document.getElementById('btnLimparCategoria')?.addEventListener('click', () => {
  document.getElementById('catNome').value = '';
  document.getElementById('catType').value = '';
  editandoCategoriaId = null;
});

function editarCategoria(id) {
  const c = categoriasCache.find(x => x.id === id);
  if (!c) return;
  document.getElementById('catNome').value = c.nome;
  document.getElementById('catType').value = c.type || '';
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
const fType = document.getElementById('prodType');
const fName = document.getElementById('prodName');
const fDesc = document.getElementById('prodDesc');
const fPrice = document.getElementById('prodPrice');
const fImg = document.getElementById('prodImg');
const fImgFile = document.getElementById('prodImgFile');
const fImgPreview = document.getElementById('prodImgPreview');
const fStatus = document.getElementById('prodStatus');
const fCategoryId = document.getElementById('prodCategoryId');
const fHideWhenOutOfStock = document.getElementById('prodHideWhenOutOfStock');

// File upload handler
fImgFile?.addEventListener('change', async function() {
  const file = this.files[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = e => { fImgPreview.src = e.target.result; fImgPreview.style.display = 'block'; };
  reader.readAsDataURL(file);
  const formData = new FormData();
  formData.append('file', file);
  try {
    const res = await fetch(API_BASE + '/upload', { method: 'POST', body: formData });
    const data = await res.json();
    fImg.value = data.filename;
    toast('Imagem enviada: ' + data.filename);
  } catch (e) {
    console.warn('Upload falhou, salvando apenas preview local:', e.message);
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

function getCategoriaNome(type) {
  const c = categoriasCache.find(x => x.type === type);
  return c ? c.nome : (type || '-');
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
          <img class="prodThumb" src="img/${p.img||'default.png'}" alt="${escapeHtml(p.name||'')}">
          ${escapeHtml(p.name||'')}
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

function carregarNoForm(id) {
  const p = cacheProdutos.find(x => x.id === id);
  if (!p) return;

  fId.value = p.id;
  fType.value = p.type;
  fName.value = p.name || '';
  fDesc.value = p.description || '';
  fPrice.value = p.price;
  fImg.value = p.img || '';
  if (p.img) { fImgPreview.src = 'img/' + p.img; fImgPreview.style.display = 'block'; }
  else { fImgPreview.style.display = 'none'; fImgPreview.src = ''; }
  fStatus.value = p.status || 'active';
  fCongelado.checked = p.congelado || false;
  fControlaEstoque.checked = p.controlaEstoque || false;
  fEstoqueAtual.value = p.estoqueAtual ?? '';
  fEstoqueMinimo.value = p.estoqueMinimo ?? '';
  fHideWhenOutOfStock.checked = p.hideWhenOutOfStock !== false;

  // Match category by type
  if (fCategoryId && p.type) {
    const match = categoriasCache.find(c => c.type === p.type);
    fCategoryId.value = match ? match.id : '';
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
    type: fType.value ? Number(fType.value) : 1,
    name: (fName.value || '').trim(),
    description: (fDesc.value || '').trim(),
    price: Number(fPrice.value),
    img: (fImg.value || '').trim(),
    status: fStatus.value || 'active',
    congelado: fCongelado.checked,
    controlaEstoque: fControlaEstoque.checked,
    estoqueAtual: fControlaEstoque.checked ? Number(fEstoqueAtual.value) || 0 : null,
    estoqueMinimo: fControlaEstoque.checked ? Number(fEstoqueMinimo.value) || 0 : null,
    hideWhenOutOfStock: fHideWhenOutOfStock.checked,
  };

  if (fCategoryId && fCategoryId.value) {
    const cat = categoriasCache.find(c => c.id == fCategoryId.value);
    if (cat && cat.type) payload.type = cat.type;
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
    formProduto.reset();
    isEditando = false;
    document.getElementById("btnSalvarProduto").textContent = "Salvar";
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
  formProduto.reset();
  isEditando = false;
  document.getElementById("btnSalvarProduto").textContent = "Salvar";
  toggleEstoqueFields();
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
    if (settings.logo) {
      document.getElementById('confLogoPreview').src = 'img/' + settings.logo;
      document.getElementById('confLogoPreview').style.display = 'block';
    }
  } catch (e) {
    console.warn('Erro ao carregar config loja:', e.message);
  }
}

// Logo upload handler
document.getElementById('confLogoFile')?.addEventListener('change', async function() {
  const file = this.files[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = e => { document.getElementById('confLogoPreview').src = e.target.result; document.getElementById('confLogoPreview').style.display = 'block'; };
  reader.readAsDataURL(file);
  const formData = new FormData();
  formData.append('file', file);
  try {
    const res = await fetch(API_BASE + '/upload', { method: 'POST', body: formData });
    const data = await res.json();
    document.getElementById('confLogo').value = data.filename;
    toast('Logo enviada: ' + data.filename);
  } catch (e) {
    console.warn('Upload logo falhou:', e.message);
  }
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

(function init(){ carregarHorarios(); carregarLojaConfig(); listenProdutos(); })();
