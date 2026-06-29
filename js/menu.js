

const menu = document.querySelector('#showMenu');
const promotions = document.querySelector('#showPromotions');

const showAll = document.querySelector('#showAll');
const showSnacks = document.querySelector('#showSnacks');
const showCombos = document.querySelector('#showCombos');
const showPortions = document.querySelector('#showPortions');
const showDrinks = document.querySelector('#showDrinks');

const showFrozen = document.createElement('button');
showFrozen.classList.add('linkMenu');
showFrozen.id = 'showFrozen';
showFrozen.innerText = 'Salgadinhos Congelados';
document.querySelector('.linksMenu').appendChild(showFrozen);
showFrozen.addEventListener('click', () => showProducts(6));

let itemsHTML = '';
let products = [];

const clearItems = type => {
    itemsHTML = '';
    if(type === 'normal') menu.innerHTML = '';
    else promotions.innerHTML = '';
}

async function buscarEnderecoPorCEP(cep) {
    const cleanCEP = cep.replace(/\D/g, ''); // remove não números
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
});



const removeClasses = () => {
    showAll.classList.remove('active');
    showSnacks.classList.remove('active');
    showCombos.classList.remove('active');
    showPortions.classList.remove('active');
    showDrinks.classList.remove('active');
    showFrozen.classList.remove('active');
}

const checkIfHaveItem = html => {
    if(html === '') menu.innerHTML = '<p>Nenhum produto encontrado!</p>';
    else menu.innerHTML = html;
}

const addItemToArray = prod => {
    let price = prod.price.toFixed(2).replace('.', ',');
    itemsHTML += `
    <div class="card">
        <div>
            <div class="cardImg">
                <img src="./img/${prod.img}" alt="${prod.name}" loading="lazy">
            </div>
            <h4>${prod.name}</h4>
            <p>${prod.description}</p>
        </div>
        <div>
            <p class="price">R$ <span>${price}</span></p>
            <button class="btn" onclick="addToCart(${prod.id})">
                <span class="iconify-inline" data-icon="mdi:cart-plus"></span> Adicionar
            </button>
        </div>
    </div>`;
}

const showProducts = type => {
    clearItems('normal');
    itemsHTML = '';

    let filteredProducts = [];

    if(type === 0){
        // Tudo
        filteredProducts = products.filter(prod => !prod.lastPrice || prod.lastPrice === 0);
    }
    else if(type === 1){
        // Salgadinhos
        filteredProducts = products.filter(prod => prod.type === type && (!prod.lastPrice || prod.lastPrice === 0));
    }
    else if(type === 2){
        // Massas / Combos
        filteredProducts = products.filter(prod => prod.type === type && (!prod.lastPrice || prod.lastPrice === 0));
    }
    else if(type === 3){
    // Salgadinhos de Festa
    filteredProducts = products.filter(prod => prod.type === type && (!prod.lastPrice || prod.lastPrice === 0));
    
    // Se houver produto com id 209, remove e adiciona no início
    const index209 = filteredProducts.findIndex(prod => prod.id === 209);
    if(index209 !== -1){
        const [prod209] = filteredProducts.splice(index209, 1);
        filteredProducts.unshift(prod209); // adiciona no início
    }
}
    else if(type === 4){
        // Bebidas
        filteredProducts = products.filter(prod => prod.type === type && (!prod.lastPrice || prod.lastPrice === 0));
    }
    else if(type === 6){
        // Salgadinhos Congelados
        filteredProducts = products.filter(prod => prod.type === type && prod.congelado);
    }

    // Adiciona os produtos filtrados ao HTML
    filteredProducts.forEach(prod => addItemToArray(prod));

    checkIfHaveItem(itemsHTML);
    removeClasses();

    // Atualiza a aba ativa
    if(type === 0) showAll.classList.add('active');
    else if(type === 1) showSnacks.classList.add('active');
    else if(type === 2) showCombos.classList.add('active');
    else if(type === 3) showPortions.classList.add('active');
    else if(type === 4) showDrinks.classList.add('active');
    else if(type === 6) showFrozen.classList.add('active');
}


const allPromotions = () => {
    clearItems('promotions');
    let promoItems = '';
    products.forEach(prod=>{
        if(prod.lastPrice && prod.lastPrice!=0){
            let price=prod.price.toFixed(2).replace('.', ',');
            let lastPrice=prod.lastPrice.toFixed(2).replace('.', ',');
            promoItems += `<div class="card">
                <div>
                    <div class="cardImg"><img src="./img/${prod.img}" alt="${prod.name}" loading="lazy"></div>
                    <h4>${prod.name}</h4>
                    <p>${prod.description}</p>
                </div>
                <div>
                    <p class="oldPrice">R$ ${lastPrice}</p>
                    <p class="price">R$ ${price}</p>
                    <button class="btn" onclick="addToCart(${prod.id})">
                        <span class="iconify-inline" data-icon="mdi:cart-plus"></span> Adicionar
                    </button>
                </div>
            </div>`;
        }
    });
    promotions.innerHTML = promoItems==='' ? '<p>Nenhuma promoção hoje, tente novamente amanhã! =(</p>' : promoItems;
}

async function loadProducts() {
    try {
        const data = await PUBLIC_API.listarProdutos();
        products = data.filter(function(p) { return p.status !== "removed" && p.status !== "paused"; });
        showProducts(0);
        allPromotions();
    } catch(e) {
        console.error("Erro ao carregar produtos:", e);
        toast("Erro ao carregar cardápio", "danger");
    }
}
loadProducts();

showAll.addEventListener('click',()=>showProducts(0));
showSnacks.addEventListener('click',()=>showProducts(1));
showCombos.addEventListener('click',()=>showProducts(2));
showPortions.addEventListener('click',()=>showProducts(3));
showDrinks.addEventListener('click',()=>showProducts(4));

async function atualizarStatusBar(){
    try{
        let aberto = false;
        let mensagem = "A loja encontra-se fechada no momento.";
        try {
            const res = await fetch('/api/loja/status?slug=salgadoscosta');
            if (res.ok) {
                const data = await res.json();
                aberto = data.isOpen;
                mensagem = data.message;
            }
        } catch (e) {}

        const statusBar = document.getElementById("statusBar");
        statusBar.style.backgroundColor = aberto ? "green" : "red";
        statusBar.textContent = mensagem;
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
    }
}
atualizarStatusBar();
setInterval(atualizarStatusBar,60000);

function addToCart(id){
    const statusBar=document.getElementById("statusBar");
    const isOpen=statusBar.style.backgroundColor==="green";
    if(!isOpen){
        toast("Loja fechada! Só é possível adicionar itens durante o horário de funcionamento.", "danger");
        return;
    }
    const cart=JSON.parse(localStorage.getItem('cart'))||[];
    if(cart.find(i=>i.id===id)) return;
    cart.push({id:id,qtd:1});
    localStorage.setItem('cart',JSON.stringify(cart));
    toast("Item adicionado ao carrinho!", "success");
}

async function carregarHorarios() {
    const container = document.getElementById("daysContainer");
    const diasSemana = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"];
    const horariosDocRef = db.collection("settings").doc("horarios");

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

    // Update footer logo
    const logoEl = document.getElementById('logo');
    if (logoEl) logoEl.innerHTML = nome.replace(' ', '<br />');

    // Update copyright
    const crEl = document.getElementById('footerCopyright');
    if (crEl) crEl.innerHTML = nome + ' - 2024 &copy; Todos os direitos reservados.';

    // Update WhatsApp links
    const tel = config.telefone || '5521966017085';
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
  var slug = document.body.getAttribute('data-slug') || 'salgadoscosta';

  try {
    var result = await PUBLIC_API.login({ slug: slug, telefone: phone, password: password });
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
    var slug = document.body.getAttribute('data-slug') || 'salgadoscosta';

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
            slug: slug, nome: nome, telefone: phone, password: password,
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

        //-----------Controle de exibição de pedidos-------//

        if (produto.controlaEstoque && produto.estoqueAtual <= 0) {
  return; // não exibe
}

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