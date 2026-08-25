// ---------------- VARIÁVEIS ---------------- //
window.products = [];
let modaisState = {};
let deliveryValue = 0;
let discountPercent = 0;
let taxaCartao = 0;
let taxaPix = 0;
let asaasPixFeePercent = 2;
let pacoteSelecionado = null;

const pacotesFixos = [201,202,203,204,205,206,207,401,402];
const prodMultiplicado = [401,402,209];
const pacotesEspeciais = [201,202,203,204,205,206,207,208,401,402];
const pacotesUnicos = [209];

const showItems = document.getElementById("showItems");
const showAllItemsValue = document.getElementById("showAllItemsValue");
const showDelivery = document.getElementById("showDelivery");
const showDiscount = document.getElementById("showDiscount");
const showTotal = document.getElementById("showTotal");
const inputPromotionCode = document.getElementById("promotionCode");
const btnAddPromotionCode = document.getElementById("addPromotionCode");
const btnGenerateOrder = document.getElementById("generateOrder");
const radiosEntrega = document.querySelectorAll("input[name='tipoEntrega']");
const formaPagamento = document.getElementById("formaPagamento");
const showcep = document.getElementById("regCep");
var bairrosAtendidos = [];


// Verifica login
const userLogged = JSON.parse(localStorage.getItem("userLogged"));
if (userLogged) {
  document.getElementById("nome").value = userLogged.nome || "";
  document.getElementById("whatsapp").value = userLogged.phone || "";
  document.getElementById("endereco").value = userLogged.endereco || "";
  document.getElementById("numero").value = userLogged.numero || "";
  document.getElementById("enderecoCEP").value = userLogged.cep || "";
  document.getElementById("bairroCliente").value = userLogged.bairro || "";
  document.getElementById("pontoReferencia").value = userLogged.ponto || "";
  document.getElementById("cidadeCliente").value = userLogged.cidade || "";
  document.getElementById("estadoCliente").value = userLogged.estado || "";
}

// Máscaras de input
document.addEventListener('DOMContentLoaded', function () {
  var elWhatsapp = document.getElementById('whatsapp');
  var elCep = document.getElementById('enderecoCEP');
  if (elWhatsapp) maskPhone(elWhatsapp);
  if (elCep) {
    maskCEP(elCep);
    elCep.addEventListener('blur', function() {
      var cep = this.value.replace(/\D/g, '');
      if (cep.length === 8) {
        fetch('https://viacep.com.br/ws/' + cep + '/json/')
          .then(function(r) { return r.json(); })
          .then(function(d) {
            if (!d.erro) {
              document.getElementById('endereco').value = d.logradouro || '';
              document.getElementById('bairroCliente').value = d.bairro || '';
              document.getElementById('cidadeCliente').value = d.localidade || '';
              document.getElementById('estadoCliente').value = d.uf || '';
              calcularTaxaEntregaPorBairro();
            }
          })
          .catch(function(e) { console.warn('Erro ao buscar CEP:', e); });
      }
    });
  }
});


function calcularTaxaEntregaPorBairro() {
  const bairro = document.getElementById("bairroCliente").value.trim();
  if (!bairro) return;

  var encontrado = null;
  for (var i = 0; i < bairrosAtendidos.length; i++) {
    if (bairrosAtendidos[i].nome.toLowerCase() === bairro.toLowerCase()) {
      encontrado = bairrosAtendidos[i];
      break;
    }
  }

  if (encontrado) {
    deliveryValue = Number(encontrado.taxa);
    document.getElementById('bairroNaoAtendidoOverlay')?.classList.add('hidden');
  } else {
    deliveryValue = 0;
    document.getElementById('bairroNaoAtendidoOverlay')?.classList.remove('hidden');
  }

  updateValores();
}


async function carregarBairros() {
  try {
    const config = await PUBLIC_API.lojaSettings();
    if (Array.isArray(config.bairrosAtendidos)) {
      bairrosAtendidos = config.bairrosAtendidos;
    }
  } catch (e) { console.warn('Erro ao carregar bairros:', e); }
}

function fecharOverlayBairro() {
  document.getElementById('bairroNaoAtendidoOverlay')?.classList.add('hidden');
}

carregarBairros();

var _cartCache = null;

function getCart() {
  if (_cartCache !== null) return _cartCache;
  try {
    _cartCache = JSON.parse(localStorage.getItem('cart')) || [];
  } catch (e) {
    _cartCache = [];
  }
  return _cartCache;
}

function setCart(cart) {
  _cartCache = cart;
  localStorage.setItem('cart', JSON.stringify(cart));
}

// ---------------- CÁLCULO ---------------- //
function calculaValorItens() {
  const cart = getCart();
  let total = 0;

  cart.forEach(prod => {
    const item = window.products.find(p => p.id === prod.id);
    if (!item) return;

    if (pacotesFixos.includes(prod.id) || pacotesEspeciais.includes(prod.id)) {
      total += item.price; // preço fixo
    } else if (prodMultiplicado.includes(prod.id)) {
      total += item.price * (prod.qtd || 1); // multiplica pela quantidade
    } else {
      total += item.price * (prod.qtd || 1); // outros produtos também multiplicam
    }
    total += Number(prod.extra) || 0; // açaí acréscimos
  });

  return total;
}


function updateValores(){
  const allItemsValue = calculaValorItens();
  const subtotal = allItemsValue + deliveryValue;

  // Calcula desconto em reais
  const discountAmount = (discountPercent > 0) ? (subtotal * discountPercent / 100) : 0;

  let totalComDesconto = subtotal - discountAmount;

  // taxa cartão (crédito e débito)
if(formaPagamento.value === "credito" || formaPagamento.value === "debito"){
  
  // Taxas dos cartoes
 let percentual = 0;

if(formaPagamento.value === "credito"){
  percentual = 0.06;
}

if(formaPagamento.value === "debito"){
  percentual = 0.03;
}





  taxaCartao = totalComDesconto * percentual;

  document.getElementById("taxaCartaoBox").style.display = "flex";
  document.getElementById("showTaxaCartao").textContent =
    "+ R$ " + taxaCartao.toFixed(2).replace(".", ",");

  totalComDesconto += taxaCartao;

} else if (formaPagamento.value === "pix") {
  taxaPix = totalComDesconto * (asaasPixFeePercent / 100);
  document.getElementById("taxaPixBox").style.display = "flex";
  document.getElementById("showTaxaPix").textContent =
    "+ R$ " + taxaPix.toFixed(2).replace(".", ",");
  totalComDesconto += taxaPix;
} else {
  taxaCartao = 0;
  taxaPix = 0;
  document.getElementById("taxaCartaoBox").style.display = "none";
  document.getElementById("taxaPixBox").style.display = "none";
}


  showAllItemsValue.textContent = "R$ " + allItemsValue.toFixed(2).replace(".", ",");
  showDelivery.textContent = "+ R$ " + deliveryValue.toFixed(2).replace(".", ",");
  showDiscount.textContent = "- R$ " + discountAmount.toFixed(2).replace(".", ",");
  showTotal.textContent = "R$ " + totalComDesconto.toFixed(2).replace(".", ",");
}


// ---------------- RENDER ---------------- //
function renderizaItens(){
  const cart = getCart();
  if(cart.length === 0){
    showItems.innerHTML = '<div class="empty-cart"><span class="iconify-inline" data-icon="mdi:cart-off"></span><p>Você ainda não adicionou itens no carrinho.</p></div>';
    updateValores();
    return;
  }

  const grouped = {};
  cart.forEach(prod => {
    const item = window.products.find(p => p.id === prod.id);
    if (!item) return;
    const catName = item.category?.nome || 'Outros';
    if (!grouped[catName]) grouped[catName] = [];
    grouped[catName].push({ prod, item });
  });

  let html = "";
  Object.entries(grouped).forEach(([catName, entries]) => {
    html += `<div class="category-group"><h3 class="cat-header">${escapeHtml(catName)} <span class="cat-count">${entries.length} item(ns)</span></h3>`;
    entries.forEach(({ prod, item }) => {
      let precoItem;
      if (pacotesFixos.includes(prod.id) || pacotesEspeciais.includes(prod.id)) {
        precoItem = item.price;
      } else {
        precoItem = item.price * (prod.qtd || 1);
      }
      precoItem += Number(prod.extra) || 0;
      const preco = precoItem.toFixed(2).replace(".", ",");

      html += `
      <div class="item" id="item-${item.id}">
        <img src="${item.img}" alt="${escapeHtml(item.name)}" loading="lazy" />
        <div>
          <p class="title">${escapeHtml(item.name)}</p>
          <p>${escapeHtml(item.description)}</p>
          <div class="bottom">
            <div class="counter">
              <button onclick="remItem(${item.id})">-</button>
              <input type="text" value="${prod.qtd}" disabled />
              <button onclick="addItem(${item.id})">+</button>
            </div>
            <p class="price">R$ <span>${preco}</span></p>
          </div>
        </div>
      </div>
      <div class="sabores-container" id="sabores-${item.id}"></div>`;
      if (prod.sabores && Object.keys(prod.sabores).length > 0) {
        const tipoCombo = item && item.config && ComboConfig && ComboConfig.tipoDe(item.config);
        if (tipoCombo === 'combo_salgado') {
          const linhas = Object.entries(prod.sabores)
            .filter(([,qtd]) => Number(qtd) > 0)
            .map(([idSabor,qtd]) => {
              const ehIdNumerico = /^\d+$/.test(String(idSabor));
              const nome = ehIdNumerico
                ? (window.products.find(p => p.id == idSabor) || {}).name
                : idSabor;
              return `<div class="sabor-linha"><span>${escapeHtml(nome || 'Sabor #' + idSabor)}</span><span>${qtd}</span></div>`;
            }).join('');
          html += `<div class="combo-sabores">${linhas}
            <button onclick="abrirModalSaboresEdicao(${prod.id})" class="btn-editar-combo">✏️ Editar combo</button>
          </div>`;
        } else if (tipoCombo === 'combo_acai' && item.config) {
          const split = ComboConfig.separarAcai(item.config, prod.sabores);
          const precoMap = {};
          (item.config.acrescimos || []).forEach(a => { precoMap[a.nome] = Number(a.preco) || 0; });
          let gratisHtml = '';
          let extrasHtml = '';
          if (split.gratis.length) {
            gratisHtml = `<div style="margin-bottom:4px;"><span style="color:#1FA58D;font-size:11px;font-weight:600;">Grátis</span>` +
              split.gratis.map(s => `<div class="sabor-linha"><span>${escapeHtml(s.nome)}</span><span>${s.qtd}</span></div>`).join('') +
              '</div>';
          }
          if (split.pagos.length) {
            extrasHtml = `<div style="margin-bottom:4px;"><span style="color:#F26D3D;font-size:11px;font-weight:600;">Extras + R$ ${split.extra.toFixed(2)}</span>` +
              split.pagos.map(s => {
                const p = precoMap[s.nome] || 0;
                return `<div class="sabor-linha"><span>${escapeHtml(s.nome)}</span><span>${s.qtd} × R$ ${p.toFixed(2)}</span></div>`;
              }).join('') +
              '</div>';
          }
          html += `<div class="combo-sabores">${gratisHtml}${extrasHtml}
            <button onclick="abrirModalSaboresEdicao(${prod.id})" class="btn-editar-combo">✏️ Editar combo</button>
          </div>`;
        } else {
          const saboresArray = Object.entries(prod.sabores)
            .filter(([idSabor,qtd]) => qtd>0)
            .map(([idSabor,qtd]) => {
              const s = window.products.find(p => p.id == idSabor);
              return `${qtd}x ${escapeHtml(s.name)}`;
            });
          html += `<p class="caixaItem">${saboresArray.join(', <br />')}</p>`;
        }
      }
    });
    html += `</div>`;
  });

  showItems.innerHTML = html;
  updateValores();

  cart.forEach(prod => {
    const precisaAbrir = pacotesEspeciais.includes(prod.id) || pacotesUnicos.includes(prod.id);
    if (precisaAbrir) {
      if (!modaisState[prod.id]) {
        modaisState[prod.id] = { open: false, sabores: {}, qtd: prod.qtd || 1 };
      }
      const jaConfirmado = prod.sabores && Object.keys(prod.sabores).length > 0;
      if (!jaConfirmado && !modaisState[prod.id].open) {
        const pacote = window.products.find(p => p.id === prod.id);
        if (pacote) {
          modaisState[prod.id].open = true;
          setTimeout(() => abrirModalSabores(pacote), 50);
        }
      }
    }
  });




  // Abre automaticamente os modais marcados como abertos
  cart.forEach(prod => {
    if(modaisState[prod.id]?.open){
      const pacote = window.products.find(p=>p.id===prod.id);
      if(pacote){
        abrirModalSabores(pacote);
      }
    }
  });
}


// ---------------- MODAIS ---------------- //
function salvarModaisAbertos() {
  const cart = getCart();
  cart.forEach(item => {
    const container = document.getElementById(`sabores-${item.id}`);
    if(!container) return;

    if(!modaisState[item.id]) modaisState[item.id] = { open: container.innerHTML.trim() !== "", sabores: {}, qtd: item.qtd || 1 };
    const state = modaisState[item.id];
    state.open = container.innerHTML.trim() !== "";

    const qtdInput = container.querySelector(`#qtdPacote-${item.id}`);
    if(qtdInput) state.qtd = parseInt(qtdInput.value) || state.qtd;

    container.querySelectorAll('input[data-sabor-id]').forEach(inp=>{
      const sid = inp.dataset.saborId;
      const qtd = parseInt(inp.value) || 0;
      if(qtd>0) state.sabores[sid]=qtd;
    });
  });
}

function restaurarModais() {
  const cart = getCart();
  Object.keys(modaisState).forEach(id=>{
    const state = modaisState[id];
    if(state && state.open && cart.some(i=>i.id==id)){
      const pacote = window.products.find(p=>p.id==id);
      if(pacote){
        // garante que o DOM exista
        setTimeout(()=>abrirModalSabores(pacote), 50);
      }
    }
  });
}



// ---------------- ADD / REMOVE ITEM ---------------- //
function addItem(id){
  salvarModaisAbertos();

  let cart = getCart();
  const produto = window.products.find(p=>p.id===id);
  if(!produto) return;

  const precisaModal = (produto.type===3 || produto.type===6);

  if(pacotesUnicos.includes(id) && cart.find(i=>i.id===id)) return;

 if(precisaModal){
  const itemNoCarrinho = cart.find(i=>i.id===id);
  if(!itemNoCarrinho){
    cart.push({...produto,qtd:1,sabores:null});
    modaisState[id] = {open:false, sabores:{}, qtd:1};
  }
  setCart(cart);
  renderizaItens(); // aqui o modal abrirá automaticamente
  return;
}


  const item = cart.find(i=>i.id===id);
  if(item) item.qtd++;
  else cart.push({...produto,qtd:1});

  setCart(cart);
  renderizaItens();
}


function remItem(id){
  salvarModaisAbertos();
  let cart = getCart();
  const produto = window.products.find(p=>p.id===id);
  if(!produto) return;

  if(produto.type===6 || pacotesEspeciais.includes(id) || pacotesUnicos.includes(id)){
    cart = cart.filter(i=>i.id!==id);
    // Remove modal do estado se item removido
    if(modaisState[id]) delete modaisState[id];
    setCart(cart);
    renderizaItens();
    restaurarModais();
    return;
  }

  const item = cart.find(i=>i.id===id);
  if(item){
    if(item.qtd>1) item.qtd--; 
    else {
      cart = cart.filter(i=>i.id!==id);
      if(modaisState[id]) delete modaisState[id];
    }
    setCart(cart);
    renderizaItens();
    restaurarModais();
  }
}


// ---------------- SABORES ---------------- //
// ---------------- MODAIS ---------------- //
function abrirModalSabores(pacote) {
  pacoteSelecionado = pacote;
  if (!modaisState[pacote.id]) modaisState[pacote.id] = { open: true, sabores: {}, qtd: 1 };
  const state = modaisState[pacote.id];

  const tipoCombo = typeof ComboConfig !== 'undefined' ? ComboConfig.tipoDe(pacote.config) : null;
  if (tipoCombo === 'combo_acai') {
    // Delegate to overlay with prefill
    const cart = getCart();
    const item = cart.find(i => i.id === pacote.id);
    const prefill = item && item.sabores ? item.sabores : {};
    abrirOverlayCombo(pacote.id, prefill, { skipOpenCheck: true });
    return;
  }
  const ehComboSalgado = tipoCombo === 'combo_salgado';
  let saboresParaExibir;
  if (ehComboSalgado) {
    saboresParaExibir = (pacote.config.sabores || []).filter(s => !s.pausado).map(s => ({ id: s.nome, name: s.nome }));
    state.nomes = saboresParaExibir.map(s => s.id);
  } else {
    saboresParaExibir = products.filter(p => p.type === 1);
    if (pacote.type === 3 || pacote.type === 6) {
      saboresParaExibir = saboresParaExibir.filter(s => ![4, 5, 12].includes(s.id));
    }
  }

  let html = `<div class="boxSabores">
      <h4>Escolha os sabores (${pacote.name})</h4>
      ${saboresParaExibir.map((sabor, idx) => {
        const val = state.sabores[sabor.id] ?? 0;
        const argSabor = ehComboSalgado ? "'" + String(sabor.id).replace(/'/g, "\\'") + "'" : sabor.id;
        return `<div class="saborItem">
          <span>${sabor.name}</span>
          <div class="counter">
            <button type="button" onclick="mudaQtdSabor(${pacote.id},${argSabor},-1)">-</button>
            <span id="qtd-sabor-${pacote.id}-${idx}">${val}</span>
            <button type="button" onclick="mudaQtdSabor(${pacote.id},${argSabor},1)">+</button>
          </div>
        </div>`;
      }).join("")}

      <p>Total escolhido: <span id="totalEscolhido-${pacote.id}">
        ${Object.values(state.sabores).reduce((a,b)=>a+b,0)}
      </span></p>
      <button onclick="confirmarSabores(${pacote.id})" class="btnConfirm">Confirmar</button>
      <button onclick="fecharSabores(${pacote.id})" class="btnCancel">Fechar</button>
    </div>`;

  const container = document.getElementById(`sabores-${pacote.id}`);
  if (container) container.innerHTML = html;
}

function mudaQtdSabor(pacoteId, saborId, delta){
  if(!modaisState[pacoteId]) modaisState[pacoteId] = {open:true, sabores:{}, qtd:1};
  const state = modaisState[pacoteId];
  const idx = Array.isArray(state.nomes) ? state.nomes.indexOf(String(saborId)) : -1;
  const key = idx !== -1 ? state.nomes[idx] : saborId;
  const atual = state.sabores[key] || 0;
  const novo = Math.max(0, atual + delta);
  if (novo > atual) {
    const pacote = window.products.find(p => p.id === pacoteId);
    const unidades = pacote && pacote.config ? Number(pacote.config.unidades) || 0 : 0;
    if (unidades > 0 && typeof ComboLimite !== 'undefined' && !ComboLimite.podeIncrementar(state.sabores, unidades)) {
      toast('Limite de ' + unidades + ' unidades atingido.', 'warning');
      return;
    }
  }
  state.sabores[key] = novo;
  const el = document.getElementById(`qtd-sabor-${pacoteId}-${idx !== -1 ? idx : key}`);
  if (el) el.textContent = novo;

  const total = Object.values(state.sabores).reduce((a,b)=>a+b,0);
  const elTotal = document.getElementById(`totalEscolhido-${pacoteId}`);
  if(elTotal) elTotal.textContent = total;
}


function fecharSabores(pacoteId) {
  const container = document.getElementById(`sabores-${pacoteId}`);
  if (container) container.innerHTML = "";
  if (modaisState[pacoteId]) modaisState[pacoteId].open = false;
}




function atualizarSabores(idSabor, qtd, pacoteId){
  if(!modaisState[pacoteId]) modaisState[pacoteId] = {open:true,sabores:{},qtd:1};
  modaisState[pacoteId].sabores[idSabor]=parseInt(qtd)||0;
  const total = Object.values(modaisState[pacoteId].sabores).reduce((a,b)=>a+b,0);
  const el = document.getElementById(`totalEscolhido-${pacoteId}`);
  if(el) el.textContent = total;
}

function confirmarSabores(pacoteId){
  const state = modaisState[pacoteId];
  const totalEscolhido = Object.values(state.sabores).reduce((a,b)=>a+b,0);

  if(totalEscolhido <= 0){ 
    toast("Escolha pelo menos 1 salgado.", 'warning');
    return;
  }

  const pacote = window.products.find(p => p.id === pacoteId);
  const unidades = pacote && pacote.config ? Number(pacote.config.unidades) || 0 : 0;
  if (unidades > 0 && totalEscolhido > unidades) {
    toast('Máximo de ' + unidades + ' unidades.', 'warning');
    return;
  }

  let cart = getCart();
  const index = cart.findIndex(i=>i.id===pacoteId);
  if(index!==-1){
    cart[index].qtd = totalEscolhido;
    cart[index].sabores = {...state.sabores};
    setCart(cart);
  }

  fecharSabores(pacoteId);
  renderizaItens();
}




function abrirModalSaboresEdicao(pacoteId) {
  const cart = getCart();
  const item = cart.find(i => i.id === pacoteId);
  const pacote = window.products.find(p => p.id === pacoteId);
  if (!pacote || !item) return;
  modaisState[pacoteId] = { open: true, sabores: item.sabores || {}, qtd: item.qtd || 1 };
  abrirModalSabores(pacote);
  window.scrollTo({ top: 0, behavior: 'smooth' });
}


const pacoteQuantidades = {201:25,202:50,203:100,204:150,205:200,206:300,207:400,208:500};

// ---------------- CUPOM ---------------- //
function addDiscount(){
  const code = inputPromotionCode.value.trim().toLowerCase();
  if(!code){ toast("Digite um cupom válido!"); return; }
  PUBLIC_API.validarCupom(code).then(function(data){
    discountPercent = Number(data.desconto)||0;
    if(discountPercent<=0){ discountPercent=0; toast("Desconto inválido."); return; }
    toast(`Cupom aplicado! ${discountPercent}%`);
    updateValores();
  }).catch(function(e){
    toast(e.message || "Erro ao verificar cupom.");
  });
}

// ---------------- INICIALIZAÇÃO ---------------- //
async function loadProductsFromFirestore(){
  try {
    const data = await PUBLIC_API.listarProdutos();
    window.products = (data || []).map(function(p) {
      return { ...p, price: Number(p.price), lastPrice: p.lastPrice ? Number(p.lastPrice) : null };
    });
  } catch(e) {
    console.error("Erro ao carregar produtos:", e);
    window.products = [];
  }
}

async function init(){
  await loadProductsFromFirestore();
  renderizaItens();

  // Listener rádios entrega
  radiosEntrega.forEach(radio=>{
  radio.addEventListener("change",()=>{
    atualizarCamposEntrega(radio.value);

    if(radio.value === "delivery"){
      calcularTaxaEntregaPorBairro(); // aplica taxa
    } else {
      deliveryValue = 0; // retirada não cobra taxa
    }

    updateValores();
  });
});

// ---------------- CEP AUTO-PREENCHIMENTO ---------------- //
async function buscarCEP(cep) {
  try {
    // Limpa o CEP, deixando apenas números
    const cepLimpo = cep.replace(/\D/g, '');
    if (cepLimpo.length !== 8) {
      console.warn('⚠️ CEP inválido, deve ter 8 dígitos');
      return;
    }

    console.log('🔎 Buscando CEP:', cepLimpo);
    const res = await fetch(`https://viacep.com.br/ws/${cepLimpo}/json/`);
    if (!res.ok) throw new Error('Erro na requisição do CEP');
    
    const data = await res.json();
    if (data.erro) {
      console.warn('⚠️ CEP não encontrado');
      return;
    }

    // Preencher automaticamente os campos de endereço
    const ruaInput = document.querySelector('#endereco');        // Rua
    const bairroInput = document.querySelector('#bairroCliente'); // Bairro
    const cidadeInput = document.querySelector('#cidadeCliente'); // Cidade
    const estadoInput = document.querySelector('#estadoCliente'); // Estado

    if (ruaInput) ruaInput.value = data.logradouro || '';
    if (bairroInput) bairroInput.value = data.bairro || '';
    if (cidadeInput) cidadeInput.value = data.localidade || '';
    if (estadoInput) estadoInput.value = data.uf || '';

    console.log('✅ Endereço preenchido automaticamente:', {
      rua: data.logradouro,
      bairro: data.bairro,
      cidade: data.localidade,
      estado: data.uf
    });

  } catch (error) {
    console.error('❌ Erro ao buscar CEP:', error);
  }
}

// Exemplo de uso com input
const cepInput = document.querySelector('#enderecoCEP');
cepInput.addEventListener('input', debounce((e) => {
  const valor = e.target.value.replace(/\D/g, '');
  if (valor.length === 8) {
    atualizarTaxaCEP(valor);
  }
}, 300));


async function atualizarTaxaCEP(cep) {
  await buscarCEP(cep); // busca e preenche os campos

  // Só recalcula a taxa se o usuário NÃO estiver logado
  if (!userLogged && document.querySelector("#bairroCliente").value) {
    calcularTaxaEntregaPorBairro();
    updateValores();
  }
}





  // Listener forma pagamento
  formaPagamento.addEventListener("change",()=>{
    atualizarCamposEntrega(
      Array.from(radiosEntrega).find(r=>r.checked)?.value
    );
    updateValores();
  });

  // Listener bairro
 document.getElementById("bairroCliente").addEventListener("input",()=>{
  if(Array.from(radiosEntrega).find(r=>r.checked)?.value==="delivery"){
      calcularTaxaEntregaPorBairro(); // define deliveryValue
      updateValores(); // atualiza tela
  }
});


  // Listener cupom
  btnAddPromotionCode.addEventListener("click",e=>{
    e.preventDefault();
    addDiscount();
    updateValores();
  });

  // Listener pedido
  btnGenerateOrder.addEventListener("click",e=>{
    e.preventDefault();
    updateValores();
    generateOrder();
  });
}



// ---------------- ENTREGA ---------------- //
function atualizarCamposEntrega(tipo){
  const campoNome = document.getElementById("campoNome");
  const campoWhatsapp = document.getElementById("campoWhatsapp");
  const campoEndereco = document.getElementById("campoEndereco");
  const campoPonto = document.getElementById("campoPonto");
  const campoBairro = document.getElementById("campoBairro");
  const campoPagamento = document.getElementById("campoPagamento");
  const campoTroco = document.getElementById("campoTroco");
  const campoNumero = document.getElementById("campoNumero");
  const campoCEP = document.getElementById("campoCEP"); // ✅ adicionado


  if(tipo==="retirada"){
    campoNome.style.display="block";
    campoWhatsapp.style.display="block";
    campoEndereco.style.display="none";
    campoCEP.style.display = "none";
    campoPonto.style.display="none";
    campoBairro.style.display="none";
    campoNumero.style.display="none";
    campoPagamento.style.display="block";
    campoTroco.style.display=formaPagamento.value==="dinheiro"?"block":"none";
    deliveryValue=0;
  } else if(tipo==="delivery"){
    campoNome.style.display="block";
    campoWhatsapp.style.display="block";
    campoEndereco.style.display="block";
    campoCEP.style.display="block";
    campoPonto.style.display="block";
    campoBairro.style.display="block";
    campoNumero.style.display="block";
    campoPagamento.style.display="block";
    campoTroco.style.display=formaPagamento.value==="dinheiro"?"block":"none";
  }
  const campoCPF = document.getElementById("campoCPF");
  if (campoCPF) campoCPF.style.display = (formaPagamento.value === "pix") ? "block" : "none";
  updateValores();
}



function getProductsMap() {
  var map = {};
  (window.products || []).forEach(function(p) { map[String(p.id)] = p; });
  return map;
}

// ID do pedido gerado pelo servidor
async function gerarPedidoSequencial() {
  return Date.now().toString(36).toUpperCase().slice(-4);
}

async function getLatLon(enderecoCompleto) {
  const url = `/api/proxy/geoapify?path=/geocode/search&text=${encodeURIComponent(enderecoCompleto)}&format=json`;

  try {
    const res = await fetch(url);
    if (!res.ok) throw new Error('Proxy indisponível');
    const data = await res.json();
    if (data && data.results && data.results.length > 0) {
      return { lat: data.results[0].lat, lon: data.results[0].lon };
    }
    return { lat: null, lon: null };
    } catch (err) {
    console.error("Erro ao buscar coordenadas:", err);
    toast('Erro ao obter localização. O pedido será processado sem coordenadas.', 'warning');
    return { lat: null, lon: null };
  }
}





// ---------------- GERAR PEDIDO ---------------- //
async function generateOrder() {
  const tipoEntrega = document.querySelector("input[name='tipoEntrega']:checked")?.value || "";
  const nome = document.getElementById("nome")?.value.trim() || "";
  const endereco = document.getElementById("endereco")?.value.trim() || "";
  const numero = document.getElementById("numero")?.value.trim() || "";
  const bairro = document.getElementById("bairroCliente")?.value.trim() || "";
  const cidade = document.getElementById("cidadeCliente")?.value.trim() || "";
  const estado = document.getElementById("estadoCliente")?.value.trim() || "";
  const pontoReferencia = document.getElementById("pontoReferencia")?.value.trim() || "";
  const formaPagamentoValue = document.getElementById("formaPagamento")?.value || "";
  const troco = parseFloat(document.getElementById("trocoPara")?.value) || 0;
  const whatsapp = document.getElementById("whatsapp")?.value.replace(/\D/g, '') || "";

  let cep = "";
  if (tipoEntrega === "delivery") {
    cep = document.getElementById("enderecoCEP")?.value.replace(/\D/g, '') || "";
  }

  if (!nome) {
    toast("Preencha seu nome!", 'warning');
    return;
  }
  if(!formaPagamentoValue){
    toast("Preencher tipo de pagamento!", 'warning');
    return;
  }
  if (tipoEntrega === "delivery" && formaPagamentoValue === "dinheiro" && !troco){
    toast("Preencher campo Troco", 'warning');
    return;
  }

  const cart = getCart();
  if (cart.length === 0) {
    toast("O carrinho está vazio.", 'warning');
    return;
  }

  btnGenerateOrder.disabled = true;
  btnGenerateOrder.textContent = "Gerando...";

  function getProductsMap() {
    var map = {};
    (window.products || []).forEach(function(p) { map[String(p.id)] = p; });
    return map;
  }
  const productsMap = getProductsMap();

  function typeToText(type) {
    switch (Number(type)) {
      case 3: return "festa";
      case 6: return "congelado";
      default: return "Salgado Grande";
    }
  }

  const itensFormatados = cart.map(prod => {
    const produto = productsMap[String(prod.id)];
    if (!produto) return null;
    const tipoTexto = typeToText(produto.type);
    if (prod.sabores && Object.keys(prod.sabores).length > 0) {
      const saboresFormatados = Object.entries(prod.sabores)
        .map(([idSabor, qtd]) => {
          const s = productsMap[idSabor];
          const nome = s ? s.name : (/^\d+$/.test(String(idSabor)) ? '??' : idSabor);
          return `${qtd}x ${nome}`;
        }).join(", ");
      return `${prod.qtd}x ${produto.name} [${tipoTexto}] → ${saboresFormatados}`;
    }
    const unitario = Number(produto.price.toFixed(2).replace(".", ","));
    return `${prod.qtd}x ${produto.name} [${tipoTexto}] x${unitario}`;
  }).filter(Boolean);

  function roundTo2(num) { return Math.round(num * 100) / 100; }

  const valorItens = roundTo2(cart.reduce((acc, prod) => {
    const produto = productsMap[String(prod.id)];
    if (!produto) return acc;
    if (pacotesFixos.includes(prod.id) || pacotesEspeciais.includes(prod.id)) return acc + produto.price;
    return acc + (produto.price * (prod.qtd || 1)) + (Number(prod.extra) || 0);
  }, 0));

  let coords = { lat: null, lon: null };
  if (tipoEntrega === "delivery") {
    const enderecoCompleto = `${endereco}, ${numero}, ${bairro}, ${cidade}, ${estado}`;
    coords = await getLatLon(enderecoCompleto);
  }

  const deliveryValueLocal = deliveryValue;
  const taxaCartaoLocal = taxaCartao;
  const desconto = (discountPercent > 0) ? ((valorItens + deliveryValueLocal) * discountPercent / 100) : 0;
  const totalFinal = valorItens + deliveryValueLocal + taxaCartaoLocal - desconto;

  const cpfCliente = document.getElementById("cpfCliente")?.value.replace(/\D/g, "") || "";
  if (formaPagamentoValue === "pix" && cpfCliente.length !== 11) {
    toast("Informe um CPF válido para pagamento via PIX.", 'warning');
    btnGenerateOrder.disabled = false;
    btnGenerateOrder.textContent = "Gerar Pedido";
    return;
  }

  const payload = {
    clienteNome: nome,
    clienteWhatsapp: whatsapp,
    clienteEndereco: endereco,
    clienteNumero: numero,
    clienteBairro: bairro,
    clienteCep: cep,
    clienteReferencia: pontoReferencia,
    tipoEntrega: tipoEntrega,
    formaPagamento: formaPagamentoValue,
    troco: isNaN(troco) ? null : troco,
    itens: cart.map(function(prod) {
      return { produtoId: prod.id, quantidade: prod.qtd || 1, sabores: prod.sabores ? JSON.stringify(prod.sabores) : null };
    }),
    taxasEntrega: deliveryValueLocal,
    taxasCartao: taxaCartaoLocal,
    desconto: desconto,
    total: totalFinal,
    cpf: cpfCliente,
  };

  try {
    var result = await PUBLIC_API.criarPedido(payload);

  // Atualiza taxa PIX se veio do backend
  if (result.pagamento && result.pagamento.taxaServico !== undefined) {
    taxaPix = Number(result.pagamento.taxaServico);
    document.getElementById("showTaxaPix").textContent =
      "+ R$ " + taxaPix.toFixed(2).replace(".", ",");
    document.getElementById("taxaPixBox").style.display = "flex";
    updateValores(); // recalcula total com taxa real
  }

  // Recalcula totalFinal incluindo taxa PIX se aplicável
  var totalFinalComPix = valorItens + deliveryValueLocal + taxaCartaoLocal + (formaPagamentoValue === "pix" ? taxaPix : 0) - desconto;

    _cartCache = null;
    localStorage.removeItem("cart");
    renderizaItens();
    if (result.pagamento && result.pagamento.pixCode) {
      mostrarPagamentoPix(result.id, result.pagamento, itensFormatados, totalFinalComPix);
    } else {
      mostrarConfirmacaoPedido(result.id, itensFormatados, totalFinalComPix);
    }
  } catch (error) {
    console.error("Erro ao salvar pedido:", error);
    toast(error.message || "Erro ao salvar pedido.", 'danger');
  } finally {
    btnGenerateOrder.disabled = false;
    btnGenerateOrder.textContent = "Gerar Pedido";
  }
}


// ---------------- OVERLAY PIX ---------------- //
function mostrarPagamentoPix(orderId, pagamento, itens, total) {
  const el = document.getElementById("pixOverlay");
  if (!el) return;
  document.getElementById("pixQrImg").src = "data:image/png;base64," + pagamento.pixQrCode;
  document.getElementById("pixCodeText").textContent = pagamento.pixCode;
  document.getElementById("pixOrderId").textContent = orderId;
  document.getElementById("pixStatusMsg").textContent = "Aguardando pagamento... O pedido será liberado após a confirmação do pagamento.";

  // Exibe resumo do pedido no overlay
  var detailsEl = document.getElementById("pixOrderDetails");
  if (detailsEl) {
    var itensHtml = itens.map(function(i) { return escapeHtml(i); }).join('<br>');
    detailsEl.innerHTML = itensHtml + '<br><br><strong>Total: R$ ' + total.toFixed(2).replace('.', ',') + '</strong>';
  }

  el.classList.remove("hidden");

  // SSE
  try {
    var es = new EventSource("/api/payment/status/" + encodeURIComponent(orderId));
    es.onmessage = function (ev) {
      var data = JSON.parse(ev.data);
      if (data.status === "pago") {
        document.getElementById("pixStatusMsg").textContent = "Pagamento confirmado! Pedido recebido com sucesso.";
        es.close();
      } else if (data.status === "expirado") {
        document.getElementById("pixStatusMsg").textContent = "Pagamento expirado. Gere um novo pedido.";
        es.close();
      }
    };
  } catch (e) {
    // fallback polling
  }
}

function copiarPix() {
  var code = document.getElementById("pixCodeText").textContent;
  if (navigator.clipboard && navigator.clipboard.writeText) {
    navigator.clipboard.writeText(code).then(function(){ toast("Código copiado!"); });
  } else {
    toast("Código copiado!");
  }
}

function fecharPix() {
  var el = document.getElementById("pixOverlay");
  if (el) el.classList.add("hidden");
}

// ---------------- OVERLAY CONFIRMAÇÃO ---------------- //
function mostrarConfirmacaoPedido(orderId, itens, total) {
  document.getElementById("overlayOrderId").textContent = orderId;
  document.getElementById("overlayDetails").innerHTML = itens.map(function(i) { return escapeHtml(i); }).join('<br>') + '<br><br><strong>Total: R$ ' + total.toFixed(2).replace('.', ',') + '</strong>';
  document.getElementById("orderOverlay").classList.remove("hidden");
}

function fecharOverlay() {
  document.getElementById("orderOverlay").classList.add("hidden");
}

// Inicializa
window.onload=init;