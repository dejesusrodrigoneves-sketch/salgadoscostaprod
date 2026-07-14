

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
<img src="${prod.img}" alt="${prod.name}" loading="lazy">
            </div>
            <h4>${prod.name}</h4>
            <p>${prod.description}</p>
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
                    <div class="cardImg"><img src="${prod.img}" alt="${prod.name}" loading="lazy"></div>
                    <h4>${prod.name}</h4>
                    <p>${prod.description}</p>
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
    if (qiDel) qiDel.textContent = config.taxaEntrega ? 'R$ ' + Number(config.taxaEntrega).toFixed(2).replace('.', ',') : 'Grátis';
    const qiTime = document.getElementById('qiTime');
    if (qiTime) qiTime.textContent = config.tempoMedio || '30-40 min';
    const tel = config.telefone || '5521966017085';
    const qiTel = document.getElementById('qiPhone');
    if (qiTel) qiTel.textContent = tel.replace('5521', '(21) ');

    // Update footer logo
    const logoEl = document.getElementById('logo');
    if (logoEl) logoEl.innerHTML = nome.replace(' ', '<br />');

    // Update copyright
    const crEl = document.getElementById('footerCopyright');
    if (crEl) crEl.innerHTML = nome + ' - 2024 &copy; Todos os direitos reservados.';

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
      addrEl.innerHTML = '<b><font color="black">' + parts + '<br />' + bairro + '</font></b>';
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


function atualizarUserMenu(user) {
  userDropdown.innerHTML = `
    <h4>Olá, ${user.nome}</h4>
    <button id="btnEditProfile">Editar perfil</button>
    <button id="btnMyOrders">Meus pedidos <span id="orderCount"></span></button>
    <button id="btnLogout">Sair</button>
  `;

  // Editar perfil
  document.getElementById("btnEditProfile").addEventListener("click", () => {
    // Preenche o overlay de cadastro com os dados do usuário
    registerOverlay.classList.remove("hidden");
    document.getElementById("regNome").value = user.nome;
    document.getElementById("regPhone").value = (user.telefone || user.phone || '').replace('+55','');
    document.getElementById("regEndereco").value = user.endereco || '';
    document.getElementById("regNumero").value = user.numero || '';
    document.getElementById("regBairro").value = user.bairro || '';
    document.getElementById("regPonto").value = user.pontoReferencia || user.ponto || '';
  });

  // Meus pedidos
// Função para abrir o overlay de pedidos
async function abrirOverlayPedidos(user) {
    let pedidosOverlay = document.getElementById("ordersOverlay");

    // Cria o overlay se não existir
    if (!pedidosOverlay) {
        pedidosOverlay = document.createElement('div');
        pedidosOverlay.id = 'ordersOverlay';
        Object.assign(pedidosOverlay.style, {
            position: 'fixed',
            top: '0',
            left: '0',
            width: '100%',
            height: '100%',
            background: 'rgba(0,0,0,0.6)',
            display: 'none', // começa escondido
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: '10001',
            overflow: 'auto',
        });

        pedidosOverlay.innerHTML = `
            <div id="ordersBox" style="
                background:white;
                padding:20px;
                width:90%;
                max-width:500px;
                border-radius:10px;
                position:relative;
                max-height:90%;
                display:flex;
                flex-direction:column;
            ">
                <h3 style="margin-bottom:10px;">Meus pedidos <span id="totalOrders"></span></h3>
                <div id="ordersContainer" style="
                    flex:1;
                    overflow-y:auto;
                    padding-right:5px;
                "></div>
                <button id="btnCloseOrders" style="
                    margin-top:10px;
                    padding:10px;
                    border:none;
                    background:#ff5722;
                    color:white;
                    border-radius:6px;
                    cursor:pointer;
                ">Fechar</button>
            </div>
        `;

        document.body.appendChild(pedidosOverlay);

        // Fecha clicando fora da caixa
        pedidosOverlay.addEventListener("click", (e) => {
            if (e.target === pedidosOverlay) {
                fecharOverlayPedidos();
            }
        });

        // Fecha apertando Esc
        document.addEventListener("keydown", (e) => {
            if (e.key === "Escape") {
                fecharOverlayPedidos();
            }
        });

        // Botão Fechar
        const btnClose = pedidosOverlay.querySelector("#btnCloseOrders");
        btnClose.addEventListener("click", fecharOverlayPedidos);
    }

    // Carrega os pedidos do usuário via API
    var ordersContainer = document.getElementById("ordersContainer");
    var totalOrders = document.getElementById("totalOrders");
    ordersContainer.innerHTML = '';
    try {
        var pedidos = await PUBLIC_API.meusPedidos();
        if (pedidos && pedidos.length > 0) {
            pedidos.forEach(function(p) {
                var total = p.total ? Number(p.total).toFixed(2) : '0,00';
                ordersContainer.innerHTML += '<div style="border-bottom:1px solid #ddd;padding:5px 0;"><b>Pedido #' + p.id + '</b> - R$ ' + total + ' <span style="color:#888;font-size:12px;">(' + p.status + ')</span></div>';
            });
            totalOrders.textContent = '(' + pedidos.length + ')';
        } else {
            ordersContainer.innerHTML = '<p style="color:#888;">Nenhum pedido encontrado.</p>';
            totalOrders.textContent = '(0)';
        }
    } catch(e) {
        ordersContainer.innerHTML = '<p style="color:#888;">Erro ao carregar pedidos.</p>';
        totalOrders.textContent = '(0)';
    }

    // Mostra o overlay
    pedidosOverlay.style.display = "flex";
}

// Função para fechar o overlay
function fecharOverlayPedidos() {
    const overlay = document.getElementById("ordersOverlay");
    if (overlay) overlay.style.display = "none";
}

// Evento do menu "Meus Pedidos"
document.getElementById("btnMyOrders").addEventListener("click", async () => {
    const savedUser = JSON.parse(localStorage.getItem("userLogged"));
    if (!savedUser) return toast("Faça login primeiro!", 'warning');
    abrirOverlayPedidos(savedUser);
});



  // Logout
  document.getElementById("btnLogout").addEventListener("click", () => {
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