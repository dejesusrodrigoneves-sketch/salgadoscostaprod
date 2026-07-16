

const menu = document.querySelector('#showMenu');
const promotions = document.querySelector('#showPromotions');
const categoryContainer = document.getElementById('categoryFilters');

let itemsHTML = '';
let products = [];
let categories = [];

const clearItems = type => {
    itemsHTML = '';
    if(type === 'normal') menu.innerHTML = '';
    else promotions.innerHTML = '';
}

async function buscarEnderecoPorCEP(cep) {
    const cleanCEP = cep.replace(/\D/g, '');
    if(cleanCEP.length !== 8) return null;

    const url = `https://brasilapi.com.br/api/cep/v2/${cleanCEP}`;

    try {
        const res = await fetch(url);
        if(!res.ok) throw new Error('CEP não encontrado');

        const data = await res.json();
        return {
            rua: data.street || '',
            bairro: data.neighborhood || '',
            cidade: data.city || '',
            estado: data.state || ''
        };
    } catch(err) {
        console.error('Erro ao consultar BuscaCEP Brasil', err);
        return null;
    }
}

const inputCEP = document.getElementById('regCep');
inputCEP.addEventListener('input', debounce(async () => {
    const cep = inputCEP.value.replace(/\D/g,'');
    if(cep.length === 8) {
        const enderecoData = await buscarEnderecoPorCEP(cep);
        if(enderecoData){
            document.getElementById('regEndereco').value = enderecoData.rua || '';
            document.getElementById('regBairro').value = enderecoData.bairro || '';

            const userLogged = JSON.parse(localStorage.getItem('userLogged'));
            if(userLogged && localStorage.getItem('clientToken')){
                try {
                    await PUBLIC_API.updateMe({ endereco: enderecoData.rua || '', bairro: enderecoData.bairro || '' });
                } catch(e) { /* fallback silencioso */ }
                userLogged.endereco = enderecoData.rua || '';
                userLogged.bairro = enderecoData.bairro || '';
                localStorage.setItem('userLogged', JSON.stringify(userLogged));
            }
        }
    }
}));

const removeClasses = () => {
    document.querySelectorAll('.linkMenu[data-cat-id]').forEach(function(btn) {
        btn.classList.remove('active');
    });
}

const checkIfHaveItem = html => {
    if(html === '') menu.innerHTML = '<div class=\"empty-state\"><span class=\"iconify-inline\" data-icon=\"mdi:food-off\"></span><p>Nenhum produto encontrado</p></div>';
    else menu.innerHTML = html;
}

const addItemToArray = prod => {
    let price = Number(prod.price).toFixed(2).replace('.', ',');
    const cart = JSON.parse(localStorage.getItem('cart')) || [];
    const inCart = cart.find(i => i.id === prod.id);
    const qtd = inCart ? inCart.qtd || 1 : 0;
    const btnHTML = qtd > 0
      ? '<button class="btn btn-minus" onclick="removeFromCart(' + prod.id + ',event)"><span class="iconify-inline" data-icon="mdi:minus"></span></button><span class="cart-qty">' + qtd + '</span><button class="btn btn-plus" onclick="addToCart(' + prod.id + ',event)"><span class="iconify-inline" data-icon="mdi:plus"></span></button>'
      : '<button class="btn btn-add" onclick="addToCart(' + prod.id + ',event)"><span class="iconify-inline" data-icon="mdi:plus"></span></button>';
    itemsHTML += `
    <div class="card">
        <div>
            <div class="cardImg">
<img src="${prod.img || ''}" alt="${escapeHtml(prod.name)}" loading="lazy">
            </div>
            <h4>${escapeHtml(prod.name)}</h4>
            <p>${escapeHtml(prod.description)}</p>
        </div>
        <div>
            <p class="price">R$ <span>${price}</span></p>
            <div class="card-actions">${btnHTML}</div>
        </div>
    </div>`;
}

const showProducts = catId => {
    clearItems('normal');
    itemsHTML = '';

    let filteredProducts = [];

    if(catId === 0){
        filteredProducts = products.filter(prod => !prod.lastPrice || prod.lastPrice === 0);
    } else {
        filteredProducts = products.filter(prod => prod.categoryId === catId && (!prod.lastPrice || prod.lastPrice === 0));
    }

    filteredProducts.forEach(prod => addItemToArray(prod));

    checkIfHaveItem(itemsHTML);
    removeClasses();

    var activeBtn = document.querySelector('.linkMenu[data-cat-id="' + catId + '"]');
    if(activeBtn) activeBtn.classList.add('active');
}

const allPromotions = () => {
    clearItems('promotions');
    let promoItems = '';
    products.forEach(prod=>{
        if(prod.lastPrice && prod.lastPrice!=0){
            let price=Number(prod.price).toFixed(2).replace('.', ',');
            let lastPrice=Number(prod.lastPrice).toFixed(2).replace('.', ',');
            const cart = JSON.parse(localStorage.getItem('cart')) || [];
            const inCart = cart.find(i => i.id === prod.id);
            const qtd = inCart ? inCart.qtd || 1 : 0;
            const btnHTML = qtd > 0
              ? '<button class="btn btn-minus" onclick="removeFromCart(' + prod.id + ',event)"><span class="iconify-inline" data-icon="mdi:minus"></span></button><span class="cart-qty">' + qtd + '</span><button class="btn btn-plus" onclick="addToCart(' + prod.id + ',event)"><span class="iconify-inline" data-icon="mdi:plus"></span></button>'
              : '<button class="btn btn-add" onclick="addToCart(' + prod.id + ',event)"><span class="iconify-inline" data-icon="mdi:plus"></span></button>';
            promoItems += `<div class="card">
                <div>
                    <div class="cardImg"><img src="${prod.img || ''}" alt="${escapeHtml(prod.name)}" loading="lazy"></div>
                    <h4>${escapeHtml(prod.name)}</h4>
                    <p>${escapeHtml(prod.description)}</p>
                </div>
                <div>
                    <p class="oldPrice">R$ ${lastPrice}</p>
                    <p class="price">R$ ${price}</p>
                    <div class="card-actions">${btnHTML}</div>
                </div>
            </div>`;
        }
    });
    promotions.innerHTML = promoItems==='' ? '<p>Nenhuma promoção hoje, tente novamente amanhã! =(</p>' : promoItems;
}

function showSkeletonLoading() {
    var sk = '';
    for (var i = 0; i < 6; i++) {
      sk += '<div class="skeleton-card"><div class="skeleton-img"></div><div class="skeleton-body"><div class="skeleton-line short"></div><div class="skeleton-line"></div><div class="skeleton-line medium"></div></div></div>';
    }
    menu.innerHTML = sk;
}

async function loadCategories() {
    try {
        const data = await PUBLIC_API.listarCategorias();
        categories = data || [];
        var container = document.getElementById('categoryFilters');
        var promoLink = container.querySelector('a[href="#promotions"]');
        container.innerHTML = '<button class="linkMenu active" data-cat-id="0">Tudo</button>';
        categories.forEach(function(c) {
            var btn = document.createElement('button');
            btn.className = 'linkMenu';
            btn.setAttribute('data-cat-id', c.id);
            btn.textContent = c.nome;
            container.appendChild(btn);
        });
        container.appendChild(promoLink);
    } catch(e) {
        console.warn('Erro ao carregar categorias:', e);
    }
}

async function loadProducts() {
    showSkeletonLoading();
    try {
        const data = await PUBLIC_API.listarProdutos();
        products = data.filter(function(p) { return p.status !== "removed" && p.status !== "paused"; });
        showProducts(0);
        allPromotions();
    } catch(e) {
        console.error("Erro ao carregar produtos:", e);
        menu.innerHTML = '<div class=\"error-state\"><span class=\"iconify-inline\" data-icon=\"mdi:alert-circle-outline\"></span><p>Erro ao carregar cardápio</p></div>';
    }
}

document.getElementById('categoryFilters').addEventListener('click', function(e) {
    var btn = e.target.closest('.linkMenu[data-cat-id]');
    if(btn) {
        e.preventDefault();
        showProducts(Number(btn.getAttribute('data-cat-id')));
    }
});

loadCategories();
loadProducts();

async function atualizarStatusBar(){
    try{
        let aberto = false;
        try {
            const res = await fetch('/api/loja/status');
            if (res.ok) {
                const data = await res.json();
                aberto = data.isOpen;
            }
        } catch (e) {}

        const statusBar = document.getElementById("statusBar");
        statusBar.style.backgroundColor = aberto ? "green" : "red";
        statusBar.textContent = aberto
          ? "Faça agora seu pedido"
          : "Estamos Fechados !! Faça seus agendamento pelo nosso Whatsapp";

        // Update status pill in header
        const pill = document.getElementById("statusPill");
        const pillLabel = document.getElementById("statusLabel");
        if (pill && pillLabel) {
          pill.className = aberto ? 'open' : 'closed';
          pillLabel.textContent = aberto ? 'Aberto agora' : 'Fechado';
        }

        const elementos = document.querySelectorAll(".btn, .linkMenu, a[href='#menu']");
        elementos.forEach(el => {
            el.disabled = !aberto;
            el.style.pointerEvents = aberto ? "auto" : "none";
            el.style.opacity = aberto ? 1 : 0.5;
        });
    } catch(err){
        console.error("Erro ao carregar horários:",err);
        const statusBar = document.getElementById("statusBar");
        statusBar.textContent = "Erro ao carregar status!";
        statusBar.style.backgroundColor = "gray";
        const pill = document.getElementById("statusPill");
        if (pill) pill.className = 'closed';
    }
}
atualizarStatusBar();
setInterval(atualizarStatusBar,60000);

// Search filter
document.addEventListener('DOMContentLoaded', function() {
  const input = document.getElementById('searchInput');
  if (!input) return;
  input.addEventListener('input', debounce(function() {
    const query = this.value.toLowerCase().trim();
    const cards = document.querySelectorAll('#showMenu .card, #showPromotions .card');
    cards.forEach(function(card) {
      var name = (card.querySelector('h4') || {}).textContent || '';
      var desc = (card.querySelector('p') || {}).textContent || '';
      card.style.display = (!query || name.toLowerCase().includes(query) || desc.toLowerCase().includes(query)) ? '' : 'none';
    });
  }));
});

function addToCart(id, event){
    if (event) event.stopPropagation();
    const statusBar=document.getElementById("statusBar");
    const isOpen=statusBar.style.backgroundColor==="green";
    if(!isOpen){
        toast("Loja fechada! Só é possível adicionar itens durante o horário de funcionamento.", "danger");
        return;
    }
    const cart=JSON.parse(localStorage.getItem('cart'))||[];
    const existing = cart.find(i=>i.id===id);
    if (existing) {
      existing.qtd = (existing.qtd || 1) + 1;
    } else {
      cart.push({id:id,qtd:1});
    }
    localStorage.setItem('cart',JSON.stringify(cart));
    refreshProductCards();
}

function removeFromCart(id, event){
    if (event) event.stopPropagation();
    const cart=JSON.parse(localStorage.getItem('cart'))||[];
    const idx = cart.findIndex(i=>i.id===id);
    if (idx === -1) return;
    if (cart[idx].qtd > 1) {
      cart[idx].qtd--;
    } else {
      cart.splice(idx, 1);
    }
    localStorage.setItem('cart',JSON.stringify(cart));
    refreshProductCards();
}

function refreshProductCards(){
    const currentTab = document.querySelector('.linkMenu.active');
    if (currentTab) {
      var catId = currentTab.getAttribute('data-cat-id');
      showProducts(catId ? Number(catId) : 0);
    }
    allPromotions();
    updateOrderBar();
}

function updateOrderBar(){
    var cart = JSON.parse(localStorage.getItem('cart')) || [];
    var bar = document.getElementById('orderBar');
    var badge = document.getElementById('cartBadge');
    if (!bar) return;
    if (cart.length === 0) {
      bar.style.display = 'none';
      if (badge) badge.style.display = 'none';
      return;
    }
    bar.style.display = 'flex';
    var total = 0;
    var count = 0;
    cart.forEach(function(item) {
      count += item.qtd || 1;
      var prod = products.find(function(p) { return p.id === item.id; });
      if (prod) total += (prod.price || 0) * (item.qtd || 1);
    });
    var el = document.getElementById('orderBarCount');
    if (el) el.textContent = count + (count === 1 ? ' item' : ' itens');
    el = document.getElementById('orderBarTotal');
    if (el) el.textContent = 'R$ ' + total.toFixed(2).replace('.', ',');
    if (badge) {
      badge.style.display = count > 0 ? 'flex' : 'none';
      badge.textContent = count > 99 ? '99+' : count;
    }
}

function abrirPedidosNav(){
    var savedUser = JSON.parse(localStorage.getItem("userLogged"));
    if (!savedUser) return toast("Faça login primeiro!", 'warning');
    if (typeof abrirOverlayPedidos === 'function') abrirOverlayPedidos(savedUser);
}

// Init order bar on load
document.addEventListener('DOMContentLoaded', function() {
  updateOrderBar();
});

// Cart notify badge also via floating cart (keep compatible)
var _origRefresh = refreshProductCards;
refreshProductCards = function() { _origRefresh(); updateOrderBar(); };

async function carregarHorarios() {
    const container = document.getElementById("daysContainer");
    const diasSemana = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"];

    try {
        const res = await fetch('/api/loja/settings');
        if (res.ok) {
            const data = await res.json();
            const workingDays = Array.isArray(data.workingDays) ? data.workingDays : [];
            const opening = data.openingTime || '08:00';
            const closing = data.closingTime || '18:00';
            let html = "";
            diasSemana.forEach(dia => {
                const aberto = workingDays.includes(dia);
                html += `<p><b>${dia}:</b> ${aberto ? opening + ' - ' + closing : 'Fechado'}</p>`;
            });
            container.innerHTML = html;
            return;
        }
    } catch (e) {
        container.innerHTML = "<p>Erro ao carregar horários!</p>";
    }
}

async function carregarConfigLoja() {
  try {
    const res = await fetch('/api/loja/settings');
    if (!res.ok) return;
    const config = await res.json();
    const nome = config.nome || 'Fabrica de Salgados Costa';

    // Update page title
    const titleEl = document.getElementById('pageTitle');
    if (titleEl) titleEl.textContent = nome + ' | Cardapio Online';

    // Update store name in header
    const nameEl = document.getElementById('storeName');
    if (nameEl) nameEl.textContent = nome;

    // Update cover image
    const coverEl = document.getElementById('coverImg');
    if (coverEl && config.capaUrl) coverEl.src = config.capaUrl;

    // Update logo
    const logoImg = document.getElementById('logoImg');
    if (logoImg && config.logoUrl) logoImg.src = config.logoUrl;

    // Update quick info
    const qiDel = document.getElementById('qiDelivery');
    if (qiDel) {
      var bairros = config.bairrosAtendidos;
      if (Array.isArray(bairros) && bairros.length > 0) {
        var taxas = bairros.map(function(b) { return Number(b.taxa); }).filter(function(t) { return !isNaN(t) && t >= 0; });
        if (taxas.length > 0) {
          var min = Math.min.apply(null, taxas);
          var unica = taxas.every(function(t) { return t === min; });
          var fmt = 'R$ ' + min.toFixed(2).replace('.', ',');
          qiDel.textContent = unica ? fmt : 'a partir de ' + fmt;
        } else {
          qiDel.textContent = 'Consulte-nos';
        }
      } else {
        qiDel.textContent = 'Consulte-nos';
      }
    }
    const qiTime = document.getElementById('qiTime');
    if (qiTime) qiTime.textContent = config.tempoMedio || '30-40 min';
    const tel = config.telefone || '5521966017085';
    const qiTel = document.getElementById('qiPhone');
    if (qiTel) qiTel.textContent = tel.replace('5521', '(21) ');

    // Update footer logo
    const logoEl = document.getElementById('logo');
    if (logoEl) {
      logoEl.textContent = '';
      var span = document.createElement('span');
      span.textContent = nome;
      logoEl.appendChild(span);
    }

    // Update copyright
    const crEl = document.getElementById('footerCopyright');
    if (crEl) crEl.textContent = nome + ' - 2024 \u00A9 Todos os direitos reservados.';

    // Update WhatsApp links
    const waFloat = document.getElementById('whatsappFloatLink');
    if (waFloat) waFloat.href = 'https://wa.me/' + tel;
    const waService = document.getElementById('whatsappServiceLink');
    if (waService) waService.href = 'https://wa.me/' + tel;

    // Update address
    const addrEl = document.getElementById('storeAddress');
    if (addrEl && config.endereco) {
      const parts = [config.endereco, config.numero].filter(Boolean).join(', ');
      const bairro = config.bairro || '';
      addrEl.innerHTML = '';
      var bold = document.createElement('b');
      bold.style.color = 'black';
      bold.appendChild(document.createTextNode(parts));
      bold.appendChild(document.createElement('br'));
      bold.appendChild(document.createTextNode(bairro));
      addrEl.appendChild(bold);
    }

    // Update map
    const mapIframe = document.getElementById('mapIframe');
    if (mapIframe && config.endereco) {
      const q = encodeURIComponent([config.endereco, config.numero, config.bairro, config.cidade, config.estado].filter(Boolean).join(', '));
      if (q) mapIframe.src = 'https://www.google.com/maps?q=' + q + '&output=embed';
    }
    // Aplica tema da loja
    if (config.themeSettings && typeof applyTheme === 'function') {
      applyTheme(config.themeSettings);
    }
  } catch (e) {
    console.warn('Failed to load store config:', e);
  }
}

carregarHorarios();
carregarConfigLoja();

// --- Login & Cadastro ---
const userMenuBtn = document.getElementById("userMenuBtn");
const userDropdown = document.getElementById("userDropdown");
const registerOverlay = document.getElementById("registerOverlay");

// Abrir/fechar ao clicar no botão
userMenuBtn.addEventListener("click", () => {
  userDropdown.classList.toggle("hidden");
});

// Fechar ao clicar fora do botão ou do dropdown
document.addEventListener("click", (e) => {
  const isClickInside = userDropdown.contains(e.target) || userMenuBtn.contains(e.target);
  if (!isClickInside) {
    userDropdown.classList.add("hidden");
  }
});

// Fechar ao apertar Esc
document.addEventListener("keydown", (e) => {
  if (e.key === "Escape") {
    userDropdown.classList.add("hidden");
  }
});

document.getElementById("btnShowRegister").addEventListener("click", () => {
  registerOverlay.classList.remove("hidden");
});

document.getElementById("btnCloseRegister").addEventListener("click", () => {
  registerOverlay.classList.add("hidden");
});

// ===== AUTH CLIENTE =====
// Sistema de login para clientes finais (coleção 'users').
// O login administrativo fica em login.html (coleção 'usuarios').
// Futuramente ambos serão unificados via backend API.
document.getElementById("btnLogin").addEventListener("click", async () => {
  let phone = document.getElementById("loginPhone").value.trim();
  const password = document.getElementById("loginPassword").value;

  if (!phone || !password) {
    toast("Preencha todos os campos", 'warning');
    return;
  }

  phone = adicionarPrefixoTelefone(phone);

  try {
    var result = await PUBLIC_API.login({ telefone: phone, password: password });
    localStorage.setItem('clientToken', result.token);
    localStorage.setItem("userLogged", JSON.stringify(result.cliente));
    toast("Login realizado!", 'success');
    userDropdown.classList.add("hidden");
    atualizarUserMenu(result.cliente);
  } catch(e) {
    toast(e.message || "Erro no login", 'danger');
  }

});



// Função para adicionar o prefixo ao telefone
function adicionarPrefixoTelefone(telefone) {
  // Verifica se o número já possui o prefixo
  if (telefone.startsWith('+55')) {
    return telefone;
  } else {
    return '+55' + telefone.replace(/[^\d]/g, ''); // Remove qualquer caractere não numérico antes de adicionar o prefixo
  }
}


// CADASTRO / EDITAR PERFIL
document.getElementById("btnRegister").addEventListener("click", async () => {
    const nome = document.getElementById("regNome").value;
    let phone = document.getElementById("regPhone").value.trim();
    const password = document.getElementById("regPassword").value;
    const cep = document.getElementById("regCep").value;
    const endereco = document.getElementById("regEndereco").value;
    const numero = document.getElementById("regNumero").value;
    const bairro = document.getElementById("regBairro").value;
    const ponto = document.getElementById("regPonto").value;
    var isEditing = !!localStorage.getItem('clientToken');

    if (isEditing) {
        try {
            var result = await PUBLIC_API.updateMe({ nome: nome, endereco: endereco, numero: numero, bairro: bairro, cep: cep, pontoReferencia: ponto });
            var savedUser = JSON.parse(localStorage.getItem("userLogged") || '{}');
            savedUser.nome = nome; savedUser.endereco = endereco; savedUser.numero = numero; savedUser.bairro = bairro; savedUser.cep = cep; savedUser.pontoReferencia = ponto;
            localStorage.setItem("userLogged", JSON.stringify(savedUser));
            toast("Perfil atualizado!", 'success');
            registerOverlay.classList.add("hidden");
        } catch(e) { toast(e.message || "Erro ao editar", 'danger'); }
        return;
    }

    if (!nome || !phone || !password) {
        toast("Preencha nome, telefone e senha", 'warning');
        return;
    }

    phone = adicionarPrefixoTelefone(phone);

    try {
        var result = await PUBLIC_API.register({
            nome: nome, telefone: phone, password: password,
            endereco: endereco, numero: numero, bairro: bairro, cep: cep, pontoReferencia: ponto,
        });
        localStorage.setItem('clientToken', result.token);
        localStorage.setItem("userLogged", JSON.stringify(result.cliente));
        toast("Cadastro realizado!", 'success');
        registerOverlay.classList.add("hidden");
    } catch(e) {
        toast(e.message || "Erro no cadastro", 'danger');
    }
});


// ===== Ordem dos pedidos: polling globals =====
var _pollTimer = null;
var _ultimosStatus = {};
var _pollFalhas = 0;

function shortDate(d) {
  if (!d) return '';
  return new Date(d).toLocaleDateString('pt-BR');
}

function formatTime(d) {
  if (!d) return '';
  return new Date(d).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
}

function stepStatus(pedido) {
  var ordem = { pendente: 0, preparando: 1, pronto: 2, entregue: 3, retirado: 3, cancelado: -1 };
  return ordem[pedido.status] !== undefined ? ordem[pedido.status] : -1;
}

function nomeStatus(status) {
  var nomes = { pendente: 'Pendente', preparando: 'Preparando', pronto: 'Pronto', entregue: 'Entregue', retirado: 'Retirado', cancelado: 'Cancelado' };
  return nomes[status] || status;
}

var STATUS_STEPS = ['pendente', 'preparando', 'pronto', 'entregue'];

function renderTimeline(pedido) {
  var idx = stepStatus(pedido);
  if (idx < 0) return '';
  var html = '<div class="orders-timeline">';
  STATUS_STEPS.forEach(function(s, i) {
    if (i > 0) {
      var cls = i <= idx ? '' : 'dashed';
      html += '<div class="timeline-step"><div class="step-line ' + cls + '"></div>';
    } else {
      html += '<div class="timeline-step">';
    }
    if (i < idx) { html += '<div class="step-circle done">✓</div>'; }
    else if (i === idx) { html += '<div class="step-circle active">◉</div>'; }
    else { html += '<div class="step-circle future"></div>'; }
    html += '<div class="step-content">';
    html += '<span class="step-label">' + nomeStatus(s) + '</span>';
    if (i <= idx) { html += '<span class="step-time">' + (pedido.updatedAt ? formatTime(pedido.updatedAt) : '') + '</span>'; }
    if (i === idx) { html += '<span class="step-now">Agora</span>'; }
    html += '</div></div>';
  });
  html += '</div>';
  return html;
}

function renderOrderItems(pedido) {
  var html = '<div class="order-items-section"><span class="order-items-title">Itens</span>';
  var totalItens = 0;
  if (pedido.itens && pedido.itens.length > 0) {
    pedido.itens.forEach(function(item) {
      var nome = item.produto ? (item.produto.name || item.produto.nome) : (item.nome || 'Item');
      var qtd = item.quantidade || 1;
      var preco = Number(item.precoUnitario || item.price || 0);
      var subtotal = preco * qtd;
      totalItens += subtotal;
      html += '<div class="order-item-row"><span class="item-qtd">' + qtd + 'x</span><span class="item-name">' + escapeHtml(nome) + '</span><span class="item-price">R$ ' + subtotal.toFixed(2) + '</span></div>';
    });
  }
  html += '<div class="order-item-divider"></div><div class="order-total-line"><span>Total</span><span>R$ ' + Number(pedido.total || totalItens).toFixed(2) + '</span></div></div>';

  var sabores = [];
  if (pedido.itens && pedido.itens.length > 0) {
    pedido.itens.forEach(function(item) {
      if (item.sabores) {
        var arr = typeof item.sabores === 'string' ? JSON.parse(item.sabores) : item.sabores;
        if (Array.isArray(arr)) arr.forEach(function(s) {
          var n = typeof s === 'string' ? s : (s.nome || '');
          var q = typeof s === 'string' ? 1 : (s.qtd || 1);
          sabores.push(n + (q > 1 ? ' (' + q + 'x)' : ''));
        });
      }
    });
  }
  if (sabores.length > 0) html += '<div class="order-sabores"><strong>Sabores</strong>' + sabores.join(', ') + '</div>';

  var infos = [];
  if (pedido.tipoEntrega) infos.push(pedido.tipoEntrega === 'delivery' ? '📍 Delivery' : '🏪 Balcão');
  if (pedido.clienteEndereco) {
    var end = pedido.clienteEndereco;
    if (pedido.clienteNumero) end += ', ' + pedido.clienteNumero;
    if (pedido.clienteBairro) end += ' - ' + pedido.clienteBairro;
    infos.push(end);
  }
  if (pedido.formaPagamento) {
    var pag = '💳 ' + pedido.formaPagamento.charAt(0).toUpperCase() + pedido.formaPagamento.slice(1);
    if (pedido.troco) pag += ' · Troco p/ R$ ' + Number(pedido.troco).toFixed(2);
    infos.push(pag);
  }
  if (infos.length > 0) html += '<div class="order-info">' + infos.join('<br>') + '</div>';
  return html;
}

function toggleOrderExpand(headerEl) {
  var card = headerEl.closest('.order-card');
  if (card) card.classList.toggle('expanded');
}

function renderOrders(pedidos) {
  var activeSection = document.getElementById('ordersActiveSection');
  var activeContainer = document.getElementById('ordersActiveContainer');
  var historyContainer = document.getElementById('ordersHistoryContainer');
  var countEl = document.getElementById('ordersCount');
  var historyTitle = document.getElementById('ordersHistoryTitle');
  activeContainer.innerHTML = '';
  historyContainer.innerHTML = '';

  if (!pedidos || pedidos.length === 0) {
    activeSection.style.display = 'none';
    historyContainer.innerHTML = '<div class="orders-empty"><span class="icon">📋</span><p>Nenhum pedido encontrado.</p><p style="font-size:13px;">Faça seu primeiro pedido pelo cardápio!</p></div>';
    if (countEl) countEl.textContent = '(0)';
    return;
  }
  if (countEl) countEl.textContent = '(' + pedidos.length + ')';

  var ativos = pedidos.filter(function(p) { return p.status === 'pendente' || p.status === 'preparando'; });
  var historico = pedidos.filter(function(p) { return p.status !== 'pendente' && p.status !== 'preparando'; });

  if (ativos.length > 0) {
    activeSection.style.display = 'block';
    ativos.forEach(function(p) {
      var card = document.createElement('div');
      card.className = 'order-card active';
      card.setAttribute('data-order-id', p.id);
      card.innerHTML = '<div class="order-card-header" onclick="toggleOrderExpand(this)"><span class="chevron">▶</span><div><strong>Pedido #' + p.id + '</strong><span class="order-time">' + (p.createdAt ? shortDate(p.createdAt) : '') + '</span></div><span class="live-badge">Ao vivo</span></div><div class="order-card-body"><div class="order-card-body-inner">' + renderTimeline(p) + renderOrderItems(p) + '</div></div>';
      activeContainer.appendChild(card);
    });
  } else {
    activeSection.style.display = 'none';
  }

  if (historico.length > 0) {
    if (historyTitle) historyTitle.textContent = 'Histórico';
    historico.forEach(function(p) {
      var statusClass = p.status || '';
      var statusNome = nomeStatus(p.status);
      var card = document.createElement('div');
      card.className = 'order-card';
      card.setAttribute('data-order-id', p.id);
      card.innerHTML = '<div class="order-card-header" onclick="toggleOrderExpand(this)"><span class="chevron">▶</span><div><strong>Pedido #' + p.id + '</strong><span class="order-date">' + (p.createdAt ? shortDate(p.createdAt) : '') + '</span></div><span class="status-badge ' + statusClass + '">' + (statusClass === 'cancelado' ? '✕' : statusClass === 'entregue' || statusClass === 'retirado' ? '✅' : '●') + ' ' + statusNome + '</span></div><div class="order-card-body"><div class="order-card-body-inner">' + renderOrderItems(p) + '</div></div>';
      historyContainer.appendChild(card);
    });
  } else {
    historyContainer.innerHTML = '<div class="orders-empty"><span class="icon">📋</span><p>Nenhum pedido anterior.</p></div>';
  }
}

async function abrirOverlayPedidos(user) {
  var overlay = document.getElementById('ordersOverlay');
  if (!overlay) return;
  overlay.classList.remove('hidden');

  var body = document.getElementById('ordersBody');
  body.innerHTML = '<div class="orders-empty"><span class="icon">⏳</span><p>Carregando pedidos...</p></div>';

  try {
    var pedidos = await PUBLIC_API.meusPedidos();
    renderOrders(pedidos || []);
    _ultimosStatus = {};
    (pedidos || []).forEach(function(p) { _ultimosStatus[p.id] = p.status; });
    iniciarPolling();
  } catch (e) {
    body.innerHTML = '<div class="orders-empty"><span class="icon">⚠️</span><p>Erro ao carregar pedidos.</p><p style="font-size:13px;">Verifique sua conexão e tente novamente.</p></div>';
  }
}

function fecharOverlayPedidos() {
  var overlay = document.getElementById('ordersOverlay');
  if (overlay) overlay.classList.add('hidden');
  pararPolling();
}

function iniciarPolling() {
  pararPolling();
  _pollTimer = setInterval(async function() {
    try {
      var pedidos = await PUBLIC_API.meusPedidos();
      _pollFalhas = 0;
      if (!pedidos) return;
      var ativosAntes = Object.keys(_ultimosStatus).filter(function(id) { return _ultimosStatus[id] === 'pendente' || _ultimosStatus[id] === 'preparando'; });
      pedidos.forEach(function(p) {
        var antigo = _ultimosStatus[p.id];
        if (antigo && antigo !== p.status && (antigo === 'pendente' || antigo === 'preparando' || p.status === 'pendente' || p.status === 'preparando')) {
          toast('Pedido #' + p.id + ' agora está ' + nomeStatus(p.status) + '!', 'info');
        }
        _ultimosStatus[p.id] = p.status;
      });
      renderOrders(pedidos);
      var ativosDepois = pedidos.filter(function(p) { return p.status === 'pendente' || p.status === 'preparando'; });
      if (ativosDepois.length === 0 && ativosAntes.length > 0) pararPolling();
    } catch (e) {
      _pollFalhas++;
      if (_pollFalhas >= 3) pararPolling();
    }
  }, 30000);
}

function pararPolling() {
  if (_pollTimer) { clearInterval(_pollTimer); _pollTimer = null; }
}

// Fecha ao clicar fora
document.addEventListener('click', function(e) {
  var overlay = document.getElementById('ordersOverlay');
  if (!overlay || overlay.classList.contains('hidden')) return;
  if (e.target === overlay) fecharOverlayPedidos();
});

// Fecha ao apertar Esc
document.addEventListener('keydown', function(e) {
  if (e.key === 'Escape') fecharOverlayPedidos();
});

function atualizarUserMenu(user) {
  userDropdown.innerHTML = '';
  var h4 = document.createElement('h4');
  h4.textContent = 'Ol\u00E1, ' + user.nome;
  userDropdown.appendChild(h4);
  var btns = [
    { id: 'btnEditProfile', text: 'Editar perfil' },
    { id: 'btnMyOrders', html: 'Meus pedidos <span id="orderCount"></span>' },
    { id: 'btnLogout', text: 'Sair' }
  ];
  btns.forEach(function(b) {
    var btn = document.createElement('button');
    btn.id = b.id;
    if (b.html) btn.innerHTML = b.html;
    else btn.textContent = b.text;
    userDropdown.appendChild(btn);
  });

  document.getElementById("btnEditProfile").addEventListener("click", function() {
    registerOverlay.classList.remove("hidden");
    document.getElementById("regNome").value = user.nome;
    document.getElementById("regPhone").value = (user.telefone || user.phone || '').replace('+55','');
    document.getElementById("regEndereco").value = user.endereco || '';
    document.getElementById("regNumero").value = user.numero || '';
    document.getElementById("regBairro").value = user.bairro || '';
    document.getElementById("regPonto").value = user.pontoReferencia || user.ponto || '';
  });

  document.getElementById("btnMyOrders").addEventListener("click", function() {
    var u = JSON.parse(localStorage.getItem("userLogged"));
    if (!u) return toast("Faça login primeiro!", 'warning');
    abrirOverlayPedidos(u);
  });

  document.getElementById("btnLogout").addEventListener("click", function() {
    localStorage.removeItem("userLogged");
    location.reload();
  });
}

const savedUser = JSON.parse(localStorage.getItem("userLogged"));
if (savedUser) {
  atualizarUserMenu(savedUser);
}

// Máscaras de input
document.addEventListener('DOMContentLoaded', function () {
  var elLoginPhone = document.getElementById('loginPhone');
  var elRegPhone = document.getElementById('regPhone');
  var elRegCep = document.getElementById('regCep');
  if (elLoginPhone) maskPhone(elLoginPhone);
  if (elRegPhone) maskPhone(elRegPhone);
  if (elRegCep) maskCEP(elRegCep);
});