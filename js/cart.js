// ---------------- VARIÁVEIS ---------------- //
window.products = [];
let modaisState = {};
let deliveryValue = 0;
let discountPercent = 0;
let taxaCartao = 0;
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
const taxasPorBairro = {
  "Centro": 7.00,
  "São Vicente": 4.00,
  "Heliópolis": 6.50,
  "Jardim Redentor": 8.00,
  "Belford Roxo": 9.00,
  "Pauline": 5.00
};


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
  // Atualiza a taxa automaticamente se houver valor
}

// Máscaras de input
document.addEventListener('DOMContentLoaded', function () {
  var elWhatsapp = document.getElementById('whatsapp');
  var elCep = document.getElementById('enderecoCEP');
  if (elWhatsapp) maskPhone(elWhatsapp);
  if (elCep) maskCEP(elCep);
});


function calcularTaxaEntregaPorBairro() {
  const bairro = document.getElementById("bairroCliente").value.trim();
  if (!bairro) return;

  // procura taxa
  const taxa = taxasPorBairro[bairro] ?? 0;
  deliveryValue = taxa;

  // atualiza valores em tela
  updateValores();
}


// ---------------- HELPER FUNCTIONS ---------------- //
function toast(msg){
  Toastify({
    text: msg,
    duration: 4000,
    close: true,
    gravity: "bottom",
    position: "right",
    style: { background: "#FF7F0A", boxShadow: "0 0 160px 0 #0008" }
  }).showToast();
}

function getCart(){ return JSON.parse(localStorage.getItem('cart')) || []; }
function setCart(cart){ localStorage.setItem("cart", JSON.stringify(cart)); }

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

  document.getElementById("taxaCartaoBox").style.display = "block";
  document.getElementById("showTaxaCartao").textContent =
    "+ R$ " + taxaCartao.toFixed(2).replace(".", ",");

  totalComDesconto += taxaCartao;

} else {
  taxaCartao = 0;
  document.getElementById("taxaCartaoBox").style.display = "none";
}


  showAllItemsValue.textContent = "R$ " + allItemsValue.toFixed(2).replace(".", ",");
  showDelivery.textContent = "+ R$ " + deliveryValue.toFixed(2).replace(".", ",");
  showDiscount.textContent = "- R$ " + discountAmount.toFixed(2).replace(".", ",");
  showTotal.textContent = "R$ " + totalComDesconto.toFixed(2).replace(".", ",");
}


// ---------------- RENDER ---------------- //
function renderizaItens(){
  if(!window.products || window.products.length === 0){
    setTimeout(renderizaItens, 100);
    return;
  }

  const cart = getCart();
  if(cart.length === 0){
    showItems.innerHTML = "<p>Você ainda não adicionou itens no carrinho.</p>";
    updateValores(); 
    return; 
  }

  let html = "";
  cart.forEach(prod => {
    const item = window.products.find(p => p.id === prod.id);
    if(!item) return;

    let precoItem;
if (pacotesFixos.includes(prod.id) || pacotesEspeciais.includes(prod.id)) {
  precoItem = item.price; // preço fixo
} else {
  precoItem = item.price * (prod.qtd || 1); // multiplica quantidade
}
const preco = precoItem.toFixed(2).replace(".", ",");

    html += `
      <div class="item" id="item-${item.id}">
        <img src="../img/${item.img}" alt="${item.name}" loading="lazy" />
        <div>
          <p class="title">${item.name}</p>
          <p>${item.description}</p>
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
      <div class="sabores-container" id="sabores-${item.id}"></div>
     ${prod.sabores && Object.keys(prod.sabores).length > 0 ? (() => {
  const saboresArray = Object.entries(prod.sabores)
    .filter(([idSabor,qtd]) => qtd>0)
    .map(([idSabor,qtd]) => {
      const s = window.products.find(p => p.id == idSabor);
      return `${qtd}x ${s.name}`;
    });
  const totalSabores = Object.values(prod.sabores).reduce((a,b)=>a+b,0);
  return `<p class="caixaItem">${saboresArray.join(', <br />')}</p>`;
})() : ""}
    `;
  });

  showItems.innerHTML = html;
  updateValores();

//Abre automaticamente todos os modais que precisam abrir
cart.forEach(prod => {
  const precisaAbrir = pacotesEspeciais.includes(prod.id) || pacotesUnicos.includes(prod.id);
  if (precisaAbrir) {
    // cria estado inicial se não existir
    if (!modaisState[prod.id]) {
      modaisState[prod.id] = { open: false, sabores: {}, qtd: prod.qtd || 1 };
    }

    // verifica se o produto tem sabores já escolhidos
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

  let saboresParaExibir = products.filter(p => p.type === 1);
  if (pacote.type === 3 || pacote.type === 6) {
    saboresParaExibir = saboresParaExibir.filter(s => ![4, 5, 12].includes(s.id));
  }

  let html = `<div class="boxSabores">
      <h4>Escolha os sabores (${pacote.name})</h4>
      ${saboresParaExibir.map(sabor => {
        const val = state.sabores[sabor.id] ?? 0;
        return `<div class="saborItem">
          <span>${sabor.name}</span>
          <div class="counter">
            <button type="button" onclick="mudaQtdSabor(${pacote.id},${sabor.id},-1)">-</button>
            <span id="qtd-sabor-${pacote.id}-${sabor.id}">${val}</span>
            <button type="button" onclick="mudaQtdSabor(${pacote.id},${sabor.id},1)">+</button>
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
  const atual = modaisState[pacoteId].sabores[saborId] || 0;
  const novo = Math.max(0, atual + delta);
  modaisState[pacoteId].sabores[saborId] = novo;
  document.getElementById(`qtd-sabor-${pacoteId}-${saborId}`).textContent = novo;

  const total = Object.values(modaisState[pacoteId].sabores).reduce((a,b)=>a+b,0);
  const el = document.getElementById(`totalEscolhido-${pacoteId}`);
  if(el) el.textContent = total;
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

  let cart = getCart();
  const index = cart.findIndex(i=>i.id===pacoteId);
  if(index!==-1){
    cart[index].qtd = totalEscolhido; // quantidade atualizada
    cart[index].sabores = {...state.sabores};
    setCart(cart);
  }

  fecharSabores(pacoteId);
  renderizaItens(); // recalcula valores
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
    window.products = await PUBLIC_API.listarProdutos();
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
  updateValores();
}

 // Supondo que você tenha uma função para pegar o usuário logado
  const usuarioLogado = localStorage.getItem('userPhone'); // exemplo: +5511999999999

  const campos = {
    nome: document.getElementById('campoNome'),
    whatsapp: document.getElementById('campoWhatsapp'),
    endereco: document.getElementById('campoEndereco'),
    numero: document.getElementById('campoNumero'),
    bairro: document.getElementById('campoBairro'),
    ponto: document.getElementById('campoPonto')
  };

  const tipoPedido = document.getElementById('tipo-pedido');

  // Função para mostrar os campos
  function mostrarCampos(tipo) {
    if(tipo === 'retirada'){
      campos.nome.style.display = 'block';
      campos.whatsapp.style.display = 'block';
      campos.endereco.style.display = 'none';
      campos.numero.style.display = 'none';
      campos.bairro.style.display = 'none';
      campos.ponto.style.display = 'none';
    } else if(tipo === 'delivery'){
      campos.nome.style.display = 'block';
      campos.whatsapp.style.display = 'block';
      campos.endereco.style.display = 'block';
      campos.numero.style.display = 'block';
      campos.bairro.style.display = 'block';
      campos.ponto.style.display = 'block';
    } else {
      // Nenhum selecionado
      Object.values(campos).forEach(c => c.style.display = 'none');
    }
  }

  // Se usuário logado, preenche campos automaticamente
  var savedUser = JSON.parse(localStorage.getItem('userLogged') || 'null');
  if(savedUser){
    campos.nome.value = savedUser.nome || '';
    campos.whatsapp.value = (savedUser.telefone || '').replace('+55','');
    campos.endereco.value = savedUser.endereco || '';
    campos.numero.value = savedUser.numero || '';
    campos.bairro.value = savedUser.bairro || '';
    campos.ponto.value = savedUser.pontoReferencia || '';
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
    showToast('Erro ao obter localização. O pedido será processado sem coordenadas.', 'warning');
    return { lat: null, lon: null };
  }
}





// ---------------- GERAR PEDIDO ---------------- //
async function generateOrder() {
  const token = localStorage.getItem('clientToken');
  if (!token) {
    toast("Faça login ou cadastre-se para finalizar o pedido!", 'warning');
    return;
  }

  const tipoEntrega = document.querySelector("input[name='tipoEntrega']:checked")?.value || "";
  const nome = document.getElementById("nome")?.value.trim() || "";
  const endereco = document.getElementById("endereco")?.value.trim() || "";
  const numero = document.getElementById("numero")?.value.trim() || "";
  const bairro = document.getElementById("bairroCliente")?.value.trim() || "";
  const pontoReferencia = document.getElementById("pontoReferencia")?.value.trim() || "";
  const formaPagamentoValue = document.getElementById("formaPagamento")?.value || "";
  const troco = parseFloat(document.getElementById("trocoPara")?.value) || 0;
  

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

  if (tipoEntrega === "delivery" && formaPagamentoValue === "dinheiro"){
    if(!troco){
      toast("Preencher campo Troco", 'warning');
      return;
    }
  }

  const cart = getCart();
  if (cart.length === 0) {
    toast("O carrinho está vazio.", 'warning');
    return;
  }

  const productsMap = await getProductsMap();

  function typeToText(type) {
    switch (Number(type)) {
      case 3: return "festa";
      case 6: return "congelado";
      default: return "Salgado Grande";
    }
  }

  // Formata os itens do pedido
  const itensFormatados = cart.map(prod => {
  const produto = productsMap[String(prod.id)];
  if (!produto) return null;

  const tipoTexto = typeToText(produto.type);

  // 🔹 Caso o produto tenha sabores (modal aberto)
  if (prod.sabores && Object.keys(prod.sabores).length > 0) {
    const saboresFormatados = Object.entries(prod.sabores)
      .map(([idSabor, qtd]) => {
        const s = productsMap[idSabor];
        return `${qtd}x ${s?.name || "??"}`;
      }).join(", ");

    return `${prod.qtd}x ${produto.name} [${tipoTexto}] → ${saboresFormatados}`;
  }

  // 🔹 Produtos normais (sem modal) exibem com valor unitário
  const unitario = produto.price.toFixed(2).replace(".", ",");
  return `${prod.qtd}x ${produto.name} [${tipoTexto}] x${unitario}`;
}).filter(Boolean);


  // Calcula valores
function roundTo2(num) {
  return Math.round(num * 100) / 100;
}

const valorItens = roundTo2(cart.reduce((acc, prod) => {
  const produto = productsMap[String(prod.id)];
  if (!produto) return acc;
  if (pacotesFixos.includes(prod.id) || pacotesEspeciais.includes(prod.id)) return acc + produto.price;
  return acc + (produto.price * (prod.qtd || 1));
}, 0));




  // Endereço completo para geocodificação
 let coords = { lat: null, lon: null };
if (tipoEntrega === "delivery") {
    const enderecoCompleto = `${endereco}, ${numero}, ${bairro}, ${userLogged?.cidade}, ${userLogged?.estado}`;
    coords = await getLatLon(enderecoCompleto);

    if (!coords.lat || !coords.lon) {
        toast("Não foi possível obter as coordenadas. Verifique o endereço!", 'danger');
        return;
    }
}





  
 const deliveryValueLocal = deliveryValue; // já definido no updateValores()
const taxaCartaoLocal = taxaCartao; // já definido
const desconto = (discountPercent > 0) ? ((valorItens + deliveryValueLocal) * discountPercent / 100) : 0;

const totalFinal = valorItens + deliveryValueLocal + taxaCartaoLocal - desconto;




  // Gera o código sequencial do pedido
  const pedidoCodigo = await gerarPedidoSequencial(); // Ex: "001"

let clientePedido;
if (tipoEntrega === "retirada") {
    // Retirada no local: envia apenas nome e whatsapp
    clientePedido = { nome, whatsapp };
} else if (tipoEntrega === "delivery") {
    // Delivery: envia todos os dados incluindo o CEP
    clientePedido = { 
        nome, 
        whatsapp, 
        endereco, 
        numero, 
        bairro, 
        pontoReferencia, 
        formaPagamento: formaPagamentoValue,
        cep // enviado apenas para delivery
    };
}





const payload = {
    slug: document.body.getAttribute('data-slug') || 'salgadoscosta',
    clienteNome: nome,
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
  };

  try {
    var result = await PUBLIC_API.criarPedido(payload);
    toast("Pedido gerado com sucesso! #" + result.id, 'success');
    localStorage.removeItem("cart");
    renderizaItens();
  } catch (error) {
    console.error("Erro ao salvar pedido:", error);
    toast(error.message || "Erro ao salvar pedido.", 'danger');
  }
}


// Inicializa
window.onload=init;