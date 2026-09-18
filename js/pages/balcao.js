// js/pages/balcao.js — extracted from balcao.html inline scripts
(function () {
  if (!authGuard(['admin', 'user'])) throw new Error('Redirect');

  var total = 0;
  var todosProdutos = [];
  var typeAtual = null;

  async function carregarProdutos() {
    try {
      var authUser = JSON.parse(localStorage.getItem('authUser') || '{}');
      var token = authUser.token || '';
      var res = await fetch((getApiBase() || '') + '/api/produtos', { headers: token ? { 'Authorization': 'Bearer ' + token } : {} });
      if (!res.ok) throw new Error('Erro ao carregar produtos');
      todosProdutos = await res.json();
      todosProdutos = todosProdutos.filter(function (p) { return p.status === 'active'; });
    } catch (e) {
      console.error('Erro ao carregar produtos:', e);
      todosProdutos = [];
    }
    criarFiltros();
    renderizarProdutos();
  }

  function criarFiltros() {
    var filtrosDiv = document.getElementById('filtros');
    filtrosDiv.innerHTML = '';
    var categorias = [...new Set(todosProdutos.map(function (p) { return (p.category && p.category.nome) || 'Sem categoria'; }))];

    var btnTodos = document.createElement('button');
    btnTodos.innerText = 'Todos';
    btnTodos.className = 'filtro-btn ativo';
    btnTodos.addEventListener('click', function () {
      typeAtual = null;
      atualizarBotoes();
      renderizarProdutos();
    });
    filtrosDiv.appendChild(btnTodos);

    categorias.forEach(function (categoria) {
      var btn = document.createElement('button');
      btn.innerText = categoria;
      btn.className = 'filtro-btn';
      btn.dataset.category = categoria;
      btn.addEventListener('click', function () {
        typeAtual = categoria;
        atualizarBotoes();
        renderizarProdutos();
      });
      filtrosDiv.appendChild(btn);
    });
  }

  function atualizarBotoes() {
    document.querySelectorAll('.filtro-btn').forEach(function (btn) {
      btn.classList.remove('ativo');
      if ((btn.innerText === 'Todos' && typeAtual === null) || btn.dataset.category === typeAtual) {
        btn.classList.add('ativo');
      }
    });
  }

  function renderizarProdutos() {
    var grid = document.querySelector('.grid-produtos');
    grid.innerHTML = '';
    var produtosFiltrados = typeAtual
      ? todosProdutos.filter(function (p) { return (p.category && p.category.nome) || 'Sem categoria' === typeAtual; })
      : todosProdutos;
    produtosFiltrados.forEach(function (produto) {
      var div = document.createElement('div');
      div.className = 'produto';
      div.innerHTML =
        '<img src="' + (produto.img || '') + '" alt="' + produto.name + '" loading="lazy">' +
        '<h4>' + produto.name + '</h4>' +
        '<span>R$ ' + Number(produto.price).toFixed(2) + '</span>';
      div.addEventListener('click', function () {
        adicionarAoCarrinho(produto);
      });
      grid.appendChild(div);
    });
  }

  window.addEventListener('DOMContentLoaded', carregarProdutos);

  function atualizarFormulario() {
    var tipo = document.querySelector('input[name="tipoEntrega"]:checked').value;
    var div = document.getElementById('form-informacoes');
    var camposComuns =
      '<strong>Informações</strong><br>' +
      '<input type="text" id="nomeCliente" aria-label="Nome do cliente" placeholder="Nome">' +
      '<input type="number" id="whatsappCliente" aria-label="WhatsApp do cliente" placeholder="WhatsApp">';
    var camposDelivery =
      '<input type="number" id="cepCliente" aria-label="CEP" placeholder="CEP">' +
      '<input type="text" id="enderecoCliente" aria-label="Endereço" placeholder="Endereço">' +
      '<input type="number" id="numeroCasa" aria-label="Número da casa" placeholder="Número da casa">' +
      '<input type="text" id="bairroCliente" aria-label="Bairro" placeholder="Bairro">' +
      '<input type="text" id="referenciaCliente" aria-label="Ponto de referência" placeholder="Ponto de referência">';
    var pagamento =
      '<div class="pagamento-box">' +
      '<strong>Forma de Pagamento</strong><br>' +
      '<label><input type="radio" name="pagamento" value="dinheiro" checked data-action-change="calcularTotalFinalBridge"> Dinheiro</label>' +
      '<label><input type="radio" name="pagamento" value="pix" data-action-change="calcularTotalFinalBridge"> Pix</label>' +
      '<label><input type="radio" name="pagamento" value="debito" data-action-change="calcularTotalFinalBridge"> Cartão Débito (+2%)</label>' +
      '<label><input type="radio" name="pagamento" value="credito" data-action-change="calcularTotalFinalBridge"> Cartão Crédito (+6%)</label>' +
      '</div>';

    if (tipo === 'delivery') {
      div.innerHTML = camposComuns + camposDelivery + pagamento;
    } else {
      div.innerHTML = camposComuns + pagamento;
    }
    calcularTotalFinal();
    notifyParent();
  }
  window.atualizarFormularioBridge = function () { atualizarFormulario(); };
  window.calcularTotalFinalBridge = function () { calcularTotalFinal(); };

  function abrirSeletorSabores(itemIndex) {
    var item = carrinho[itemIndex];
    var produtoOriginal = todosProdutos.find(function (p) { return p.id === item.id; });
    var totalSabores = item.type === 6 ? null : (produtoOriginal ? produtoOriginal.quantidadeTotal : 1) || 1;
    var saboresDisponiveis = todosProdutos.filter(function (p) { return p.type == 1 && p.id != 10; });
    if (item.id == 402) {
      var saborExtra = todosProdutos.find(function (p) { return p.id == 10; });
      if (saborExtra) saboresDisponiveis.push(saborExtra);
    }
    var saboresSelecionados = item.sabores ? item.sabores.slice() : [];

    var modal = document.createElement('div');
    modal.className = 'modal-sabores';
    modal.innerHTML =
      '<div class="box-sabores"><h3>' +
      (item.type === 6 ? 'Escolha os sabores' : 'Escolha os sabores (Total: ' + totalSabores + ')') +
      '</h3><div class="lista-sabores"></div>' +
      '<p id="contadorTotal" style="margin:10px 0;font-weight:600;text-align:right;">Selecionados: ' +
      saboresSelecionados.reduce(function (acc, s) { return acc + s.qtd; }, 0) + '/' + totalSabores + '</p>' +
      '<button id="finalizarSabores" style="width:100%;padding:12px;border:none;border-radius:10px;background:#16a34a;color:white;font-weight:600;cursor:pointer;transition:0.2s;">Finalizar</button>' +
      '</div>';
    document.body.appendChild(modal);

    var lista = modal.querySelector('.lista-sabores');
    var contadorTotal = modal.querySelector('#contadorTotal');

    function atualizarContador() {
      var totalSelecionado = saboresSelecionados.reduce(function (acc, s) { return acc + s.qtd; }, 0);
      contadorTotal.textContent = item.type === 6 ? 'Selecionados: ' + totalSelecionado : 'Selecionados: ' + totalSelecionado + '/' + totalSabores;
    }

    saboresDisponiveis.forEach(function (sabor) {
      var qtd = (saboresSelecionados.find(function (s) { return s.nome === sabor.name; }) || {}).qtd || 0;
      var div = document.createElement('div');
      div.className = 'sabor-item';
      div.style.cssText = 'display:flex;justify-content:space-between;align-items:center;padding:8px 12px;margin-bottom:6px;border:1px solid #e2e8f0;border-radius:10px;background:#f8fafc;';
      div.innerHTML = '<span>' + sabor.name + '</span><input type="number" min="0" value="' + qtd + '" style="width:50px;text-align:center;">';
      var inputQtd = div.querySelector('input');
      inputQtd.addEventListener('input', function () {
        var valor = parseInt(inputQtd.value) || 0;
        var totalSelecionadoAtual = saboresSelecionados.reduce(function (acc, s) { return acc + s.qtd; }, 0) - qtd;
        if (item.type !== 6 && totalSelecionadoAtual + valor > totalSabores) {
          valor = totalSabores - totalSelecionadoAtual;
          inputQtd.value = valor;
        }
        qtd = valor;
        var existente = saboresSelecionados.find(function (s) { return s.nome === sabor.name; });
        if (existente) { existente.qtd = qtd; if (qtd === 0) saboresSelecionados = saboresSelecionados.filter(function (s) { return s.nome !== sabor.name; }); }
        else if (qtd > 0) saboresSelecionados.push({ nome: sabor.name, qtd: qtd });
        atualizarContador();
      });
      lista.appendChild(div);
    });

    modal.querySelector('#finalizarSabores').addEventListener('click', function () {
      var totalSelecionado = saboresSelecionados.reduce(function (acc, s) { return acc + s.qtd; }, 0);
      if (item.type !== 6 && totalSelecionado !== totalSabores) { toast('Você deve selecionar exatamente ' + totalSabores + ' unidades.', 'warning'); return; }
      item.sabores = saboresSelecionados;
      if (item.type === 3) item.qtd = 1;
      else if (item.type === 6) item.qtd = totalSelecionado;
      else item.qtd = totalSabores;
      modal.remove();
      renderizarCarrinho();
    });
  }

  function escapeHtml(str) {
    if (!str) return '';
    return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  }

  function abrirSeletorComboSalgado(produto) {
    var cfg = produto.config;
    var saboresSelecionados = [];
    var modal = document.createElement('div');
    modal.className = 'modal-sabores';
    modal.innerHTML =
      '<div class="box-sabores"><h3>' + escapeHtml(produto.nome || produto.name) + ' — escolha ' + cfg.unidades + ' unidades</h3>' +
      '<div class="lista-sabores"></div>' +
      '<p id="contadorTotal" style="margin:10px 0;font-weight:600;text-align:right;">Selecionados: 0/' + cfg.unidades + '</p>' +
      '<button id="finalizarSabores" style="width:100%;padding:12px;border:none;border-radius:10px;background:#16a34a;color:white;font-weight:600;cursor:pointer;">Finalizar</button></div>';
    document.body.appendChild(modal);
    var lista = modal.querySelector('.lista-sabores');
    var contador = modal.querySelector('#contadorTotal');
    cfg.sabores.filter(function (s) { return !s.pausado; }).forEach(function (sabor) {
      var qtd = (saboresSelecionados.find(function (s) { return s.nome === sabor.nome; }) || {}).qtd || 0;
      var div = document.createElement('div');
      div.className = 'sabor-item';
      div.style.cssText = 'display:flex;justify-content:space-between;align-items:center;padding:8px 12px;margin-bottom:6px;border:1px solid #e2e8f0;border-radius:10px;background:var(--secondary, #f8fafc);';
      div.innerHTML = '<span>' + escapeHtml(sabor.nome) + '</span><input type="number" min="0" value="' + qtd + '" style="width:50px;text-align:center;">';
      var input = div.querySelector('input');
      input.addEventListener('input', function () {
        var valor = parseInt(input.value) || 0;
        var usados = saboresSelecionados.reduce(function (a, s) { return a + s.qtd; }, 0) - qtd;
        if (usados + valor > cfg.unidades) { valor = cfg.unidades - usados; input.value = valor; }
        qtd = valor;
        var ex = saboresSelecionados.find(function (s) { return s.nome === sabor.nome; });
        if (ex) { ex.qtd = qtd; if (qtd === 0) saboresSelecionados = saboresSelecionados.filter(function (s) { return s.nome !== sabor.nome; }); }
        else if (qtd > 0) saboresSelecionados.push({ nome: sabor.nome, qtd: qtd });
        var total = saboresSelecionados.reduce(function (a, s) { return a + s.qtd; }, 0);
        contador.textContent = 'Selecionados: ' + total + '/' + cfg.unidades;
      });
      lista.appendChild(div);
    });
    modal.querySelector('#finalizarSabores').addEventListener('click', function () {
      var total = saboresSelecionados.reduce(function (a, s) { return a + s.qtd; }, 0);
      if (total !== cfg.unidades) { toast('Distribua exatamente ' + cfg.unidades + ' unidades.', 'warning'); return; }
      carrinho.push({ id: produto.id, nome: produto.name, preco: Number(produto.price), qtd: 1, type: 3, config: produto.config, sabores: saboresSelecionados });
      modal.remove();
      renderizarCarrinho();
      notifyParent();
    });
  }

  function abrirSeletorComboAcai(produto) {
    var cfg = produto.config;
    var escolhidos = [];
    var modal = document.createElement('div');
    modal.className = 'modal-sabores';
    modal.innerHTML =
      '<div class="box-sabores"><h3>' + escapeHtml(produto.name) + ' — acréscimos</h3>' +
      '<p style="font-size:12px;color:#64748b;margin-bottom:8px;">' + cfg.acrescimosGratis + ' grátis · máx ' + cfg.maxAcrescimos + '</p>' +
      '<div class="lista-sabores"></div>' +
      '<p id="contadorAcai" style="margin:10px 0;font-weight:600;text-align:right;">Escolhidos: 0</p>' +
      '<button id="finalizarSabores" style="width:100%;padding:12px;border:none;border-radius:10px;background:#16a34a;color:white;font-weight:600;cursor:pointer;">Finalizar</button></div>';
    document.body.appendChild(modal);
    var lista = modal.querySelector('.lista-sabores');
    var contador = modal.querySelector('#contadorAcai');
    cfg.acrescimos.forEach(function (op) {
      var div = document.createElement('div');
      div.className = 'sabor-item';
      div.style.cssText = 'display:flex;justify-content:space-between;align-items:center;padding:8px 12px;margin-bottom:6px;border:1px solid #e2e8f0;border-radius:10px;background:#f8fafc;cursor:pointer;';
      div.innerHTML = '<span>' + escapeHtml(op.nome) + '</span><span style="color:' + (op.preco > 0 ? '#dc2626' : '#16a34a') + '">' + (op.preco > 0 ? '+ R$ ' + Number(op.preco).toFixed(2) : 'grátis') + '</span>';
      if (escolhidos.indexOf(op.nome) !== -1) div.style.borderColor = '#16a34a';
      div.addEventListener('click', function () {
        var idx = escolhidos.indexOf(op.nome);
        if (idx !== -1) { escolhidos.splice(idx, 1); div.style.borderColor = '#e2e8f0'; }
        else {
          if (escolhidos.length >= cfg.maxAcrescimos) { toast('Máximo de ' + cfg.maxAcrescimos + ' acréscimos.', 'warning'); return; }
          escolhidos.push(op.nome); div.style.borderColor = '#16a34a';
        }
        contador.textContent = 'Escolhidos: ' + escolhidos.length;
      });
      lista.appendChild(div);
    });
    modal.querySelector('#finalizarSabores').addEventListener('click', function () {
      var r = ComboConfig.calcularPrecoAcai(cfg, escolhidos);
      var sabores = escolhidos.map(function (nome) { return { nome: nome, qtd: 1 }; });
      carrinho.push({ id: produto.id, nome: produto.name, preco: Number(produto.price), qtd: 1, type: 3, config: produto.config, sabores: sabores, extra: r.extra });
      modal.remove();
      renderizarCarrinho();
      notifyParent();
    });
  }

  var carrinho = [];

  function renderizarCarrinho() {
    var lista = document.getElementById('lista-carrinho');
    lista.innerHTML = '';
    if (carrinho.length === 0) {
      lista.innerHTML = '<div class="empty-cart-msg"><div class="icon">&#9744;</div><p>Carrinho vazio<br>Clique nos produtos acima</p></div>';
      document.getElementById('total').innerText = 'R$ 0,00';
      notifyParent();
      return;
    }
    var totalVal = 0;
    carrinho.forEach(function (item, index) {
      var extraItem = Number(item.extra) || 0;
      totalVal += item.preco * item.qtd + extraItem;
      var div = document.createElement('div');
      div.classList.add('item-carrinho');
      var saboresHtml = '';
      if (item.sabores && item.sabores.length > 0) {
        saboresHtml = "<div style='font-size:12px;color:#64748b;margin-top:4px'>" +
          item.sabores.map(function (s) { return typeof s === 'string' ? s : s.nome + ' (' + s.qtd + ')'; }).join(', ') +
          '</div>';
      }
      var extraHtml = Number(item.extra) > 0 ? "<div style='font-size:12px;color:#dc2626;margin-top:4px;'>+ R$ " + Number(item.extra).toFixed(2) + ' (acréscimos)</div>' : '';
      var controleHtml;
      if (item.type === 3 || item.type === 6) {
        controleHtml =
          '<span>' + (item.type === 6 ? item.qtd : 1) + '</span>' +
          '<div class="carrinho-botoes">' +
          '<button class="btn-carrinho btn-editar" data-action="editarSaboresAction" data-index="' + index + '">Editar</button>' +
          '<button class="btn-carrinho btn-remover" data-action="removerItemAction" data-index="' + index + '">Excluir</button></div>';
      } else {
        controleHtml =
          '<button class="btn-carrinho" data-action="diminuirQtdAction" data-index="' + index + '">−</button>' +
          '<span>' + item.qtd + '</span>' +
          '<button class="btn-carrinho" data-action="aumentarQtdAction" data-index="' + index + '">+</button>';
      }
      div.innerHTML =
        '<div class="nome">' + item.nome + saboresHtml + extraHtml + '</div>' +
        '<div class="controle-qtd">' + controleHtml + '</div>' +
        '<div class="subtotal">R$ ' + (item.preco * item.qtd + (Number(item.extra) || 0)).toFixed(2) + '</div>';
      lista.appendChild(div);
    });
    calcularTotalFinal();
    notifyParent();
  }

  // Delegator bridges for cart actions
  window.editarSaboresAction = function (ds) { editarSabores(Number(ds.index)); };
  window.removerItemAction = function (ds) { removerItem(Number(ds.index)); };
  window.diminuirQtdAction = function (ds) { diminuirQtd(Number(ds.index)); };
  window.aumentarQtdAction = function (ds) { aumentarQtd(Number(ds.index)); };

  function removerItem(index) { carrinho.splice(index, 1); renderizarCarrinho(); }
  function editarSabores(index) {
    var item = carrinho[index];
    var cfgTipo = ComboConfig.tipoDe(item.config || {});
    if (cfgTipo === 'combo_salgado') { abrirSeletorComboSalgado(item); return; }
    if (cfgTipo === 'combo_acai') { abrirSeletorComboAcai(item); return; }
    abrirSeletorSabores(index);
  }
  function aumentarQtd(index) { carrinho[index].qtd++; renderizarCarrinho(); }
  function diminuirQtd(index) { carrinho[index].qtd--; if (carrinho[index].qtd <= 0) carrinho.splice(index, 1); renderizarCarrinho(); }

  function notifyParent() {
    if (!isEmbedded) return;
    var itens = carrinho.map(function (item) {
      return { produtoId: item.id, quantidade: item.qtd, sabores: formatarSabores(item.sabores), preco: item.preco, nome: item.nome, extra: item.extra || 0 };
    });
    var totalVal = carrinho.reduce(function (sum, item) { return sum + item.preco * item.qtd + (Number(item.extra) || 0); }, 0);
    window.parent.postMessage({ type: 'CARRINHO_UPDATE', itens: itens, total: totalVal, totalItens: itens.reduce(function (sum, i) { return sum + i.quantidade; }, 0) }, '*');
  }

  function fecharPedido() {
    if (carrinho.length === 0) { toast('Carrinho vazio. Adicione produtos antes de finalizar.', 'warning'); return; }
    var itens = carrinho.map(function (item) { return { produtoId: item.id, quantidade: item.qtd, sabores: formatarSabores(item.sabores) }; });
    window.parent.postMessage({ type: 'FECHAR_PEDIDO', itens: itens }, '*');
    toast('Pedido enviado!', 'success');
    carrinho = [];
    renderizarCarrinho();
    notifyParent();
  }

  function toast(msg, type) {
    var container = document.querySelector('.toast-container');
    if (!container) { container = document.createElement('div'); container.className = 'toast-container'; document.body.appendChild(container); }
    var t = document.createElement('div');
    t.className = 'toast-msg ' + (type || '');
    t.textContent = msg;
    container.appendChild(t);
    setTimeout(function () { t.remove(); }, 2500);
  }

  function formatarSabores(sabores) {
    if (!Array.isArray(sabores) || sabores.length === 0) return null;
    var obj = {};
    sabores.forEach(function (s) {
      var prod = todosProdutos.find(function (p) { return p.name === s.nome; });
      obj[prod ? prod.id : s.nome] = Number(s.qtd) || 1;
    });
    return JSON.stringify(obj);
  }

  var isEmbedded = new URLSearchParams(window.location.search).get('embedded') === '1';
  var itensNotificados = new Set();

  if (isEmbedded) {
    var elCheckout = document.querySelector('.checkout');
    if (elCheckout) elCheckout.style.display = 'none';
    window.addEventListener('message', function (e) {
      if (e.origin !== window.location.origin) return;
      if (e.data && e.data.type === 'SOLICITAR_ITENS') {
        var itens = carrinho.map(function (item) {
          return { produtoId: item.id, quantidade: item.qtd, sabores: formatarSabores(item.sabores) };
        });
        e.source.postMessage({ type: 'ITENS', itens: itens }, e.origin);
      }
    });
  }

  function adicionarAoCarrinho(produto) {
    if (produto.id == 209) { abrirSeletorAvulso(produto); return; }
    var cfgTipo = ComboConfig.tipoDe(produto.config);
    if (cfgTipo === 'combo_salgado') { abrirSeletorComboSalgado(produto); return; }
    if (cfgTipo === 'combo_acai') { abrirSeletorComboAcai(produto); return; }
    var existente = carrinho.find(function (p) { return p.id === produto.id; });
    if (existente) { existente.qtd++; renderizarCarrinho(); notifyParent(); return; }
    carrinho.push({ id: produto.id, nome: produto.name || produto.nome || 'Produto', preco: Number(produto.price), qtd: produto.type === 3 ? 1 : produto.type === 6 ? 0 : produto.quantidadeTotal || 1, type: produto.type, sabores: [] });
    renderizarCarrinho();
    notifyParent();
    var index = carrinho.length - 1;
    if (!itensNotificados.has(produto.id)) {
      itensNotificados.add(produto.id);
      if (typeof toast === 'function') toast((produto.name || produto.nome) + ' adicionado!', 'success');
    }
    if (produto.type === 3 || produto.type === 6) abrirSeletorSabores(index);
  }

  function abrirSeletorAvulso(produtoBase, indexCarrinho) {
    indexCarrinho = indexCarrinho != null ? indexCarrinho : null;
    var totalSabores = produtoBase.quantidadeTotal || null;
    var saboresDisponiveis = todosProdutos.filter(function (p) { return p.type == 1 && !p.quantidadeLivre; });
    var saboresSelecionados = indexCarrinho !== null ? carrinho[indexCarrinho].sabores.slice() : [];
    var modal = document.createElement('div');
    modal.className = 'modal-sabores';
    modal.innerHTML =
      '<div class="box-sabores"><h3>Escolha os sabores</h3><div class="lista-sabores"></div>' +
      '<p id="contadorTotal" style="margin:10px 0;font-weight:600;text-align:right;">Selecionados: 0</p>' +
      '<button id="finalizarAvulso" style="width:100%;padding:12px;border:none;border-radius:10px;background:#16a34a;color:white;font-weight:600;cursor:pointer;transition:0.2s;">Finalizar</button></div>';
    document.body.appendChild(modal);
    var lista = modal.querySelector('.lista-sabores');
    var contadorTotal = modal.querySelector('#contadorTotal');
    function atualizarContador() {
      var totalSelecionado = saboresSelecionados.reduce(function (acc, s) { return acc + s.qtd; }, 0);
      contadorTotal.textContent = 'Selecionados: ' + totalSelecionado;
    }
    saboresDisponiveis.forEach(function (sabor) {
      var qtd = 0;
      if (indexCarrinho !== null) { var existente = saboresSelecionados.find(function (s) { return s.nome === sabor.name; }); qtd = existente ? existente.qtd : 0; }
      var div = document.createElement('div');
      div.className = 'sabor-item';
      div.style.cssText = 'display:flex;justify-content:space-between;align-items:center;padding:8px 12px;margin-bottom:6px;border:1px solid #e2e8f0;border-radius:10px;background:#f8fafc;';
      div.innerHTML = '<span>' + sabor.name + '</span><input type="number" min="0" value="' + qtd + '" style="width:50px;text-align:center;">';
      var inputQtd = div.querySelector('input');
      inputQtd.addEventListener('input', function () {
        var valor = parseInt(inputQtd.value) || 0;
        qtd = valor;
        var existente = saboresSelecionados.find(function (s) { return s.nome === sabor.name; });
        if (existente) { existente.qtd = qtd; if (qtd === 0) saboresSelecionados = saboresSelecionados.filter(function (s) { return s.nome !== sabor.name; }); }
        else if (qtd > 0) saboresSelecionados.push({ nome: sabor.name, qtd: qtd });
        atualizarContador();
      });
      lista.appendChild(div);
    });
    modal.querySelector('#finalizarAvulso').addEventListener('click', function () {
      var totalSelecionado = saboresSelecionados.reduce(function (acc, s) { return acc + s.qtd; }, 0);
      if (totalSelecionado === 0) { toast('Selecione pelo menos 1 unidade.', 'warning'); return; }
      if (indexCarrinho !== null) { carrinho[indexCarrinho].sabores = saboresSelecionados; carrinho[indexCarrinho].qtd = totalSelecionado; }
      else { carrinho.push({ id: produtoBase.id, nome: 'Salgadinhos Avulsos', preco: produtoBase.price, qtd: totalSelecionado, type: produtoBase.type, sabores: saboresSelecionados }); }
      modal.remove();
      renderizarCarrinho();
    });
    atualizarContador();
  }

  function calcularTotalFinal() {
    var subtotal = 0;
    carrinho.forEach(function (item) { subtotal += item.preco * item.qtd; });
    var formaPagamento = document.querySelector('input[name="pagamento"]:checked');
    var totalFinal = subtotal;
    if (formaPagamento) {
      if (formaPagamento.value === 'debito') totalFinal += subtotal * 0.02;
      if (formaPagamento.value === 'credito') totalFinal += subtotal * 0.06;
    }
    document.getElementById('total').innerText = 'R$ ' + totalFinal.toFixed(2);
  }

  window.addEventListener('DOMContentLoaded', atualizarFormulario);

  async function pagar() {
    if (carrinho.length === 0) { toast('Carrinho vazio. Adicione produtos antes de finalizar.', 'warning'); return; }
    var tipoEntrega = (document.querySelector('input[name="tipoEntrega"]:checked') || {}).value || 'balcao';
    var formaPagamento = (document.querySelector('input[name="pagamento"]:checked') || {}).value || 'dinheiro';
    var nomeCliente = (document.getElementById('nomeCliente') || {}).value || '';
    var whatsappCliente = ((document.getElementById('whatsappCliente') || {}).value || '').replace(/\D/g, '');
    var endereco = (document.getElementById('enderecoCliente') || {}).value || '';
    var numero = (document.getElementById('numeroCasa') || {}).value || '';
    var bairro = (document.getElementById('bairroCliente') || {}).value || '';
    var cep = ((document.getElementById('cepCliente') || {}).value || '').replace(/\D/g, '');
    var pontoReferencia = (document.getElementById('referenciaCliente') || {}).value || '';
    var troco = parseFloat((document.getElementById('trocoPara') || {}).value) || 0;
    if (!nomeCliente) { toast('Preencha o nome do cliente.', 'warning'); return; }
    if (!whatsappCliente) { toast('Preencha o WhatsApp do cliente.', 'warning'); return; }
    var subtotal = 0;
    carrinho.forEach(function (item) { subtotal += item.preco * item.qtd; });
    var taxaCartao = 0;
    if (formaPagamento === 'debito') taxaCartao = subtotal * 0.02;
    if (formaPagamento === 'credito') taxaCartao = subtotal * 0.06;
    var totalFinal = subtotal + taxaCartao;
    var snapshotCarrinho = carrinho.map(function (item) { return Object.assign({}, item); });
    var payload = {
      clienteNome: nomeCliente, clienteWhatsapp: whatsappCliente, clienteEndereco: endereco,
      clienteNumero: numero, clienteBairro: bairro, clienteCep: cep, clienteReferencia: pontoReferencia,
      tipoEntrega: tipoEntrega, formaPagamento: formaPagamento, troco: troco > 0 ? troco : null,
      itens: carrinho.map(function (item) { return { produtoId: item.id, quantidade: item.qtd, sabores: formatarSabores(item.sabores) }; }),
      taxasEntrega: 0, taxasCartao: taxaCartao, desconto: 0, total: totalFinal,
    };
    try {
      var authUser = JSON.parse(localStorage.getItem('authUser') || '{}');
      var token = authUser.token || '';
      var res = await fetch((getApiBase() || '') + '/api/pedidos', {
        method: 'POST',
        headers: Object.assign({ 'Content-Type': 'application/json' }, token ? { 'Authorization': 'Bearer ' + token } : {}),
        body: JSON.stringify(payload),
      });
      if (!res.ok) { var err = await res.json().catch(function () { return ({}); }); throw new Error(err.error || 'Erro ao criar pedido'); }
      var pedido = await res.json();
      carrinho = [];
      renderizarCarrinho();
      mostrarConfirmacaoPedido(pedido.id, snapshotCarrinho, totalFinal);
      setTimeout(function () { window.location.href = 'admin.html'; }, 2000);
    } catch (error) {
      console.error('Erro ao finalizar venda:', error);
      toast(error.message || 'Erro ao finalizar venda.', 'danger');
    }
  }

  function mostrarConfirmacaoPedido(orderId, itens, total) {
    var existing = document.getElementById('pdvConfirmOverlay');
    if (existing) existing.remove();
    var overlay = document.createElement('div');
    overlay.id = 'pdvConfirmOverlay';
    overlay.style.cssText = 'position:fixed;top:0;left:0;width:100%;height:100%;background:rgba(0,0,0,0.6);z-index:9999;display:flex;align-items:center;justify-content:center;';
    var itensHtml = itens.map(function (i) {
      return '<div style="display:flex;justify-content:space-between;padding:4px 0;">' + i.nome + ' x' + i.qtd + '<span>R$ ' + (i.preco * i.qtd).toFixed(2) + '</span></div>';
    }).join('');
    overlay.innerHTML =
      '<div style="background:white;border-radius:16px;padding:32px;max-width:420px;width:90%;text-align:center;box-shadow:0 20px 60px rgba(0,0,0,0.3);">' +
      '<div style="width:64px;height:64px;background:#16a34a;border-radius:50%;display:flex;align-items:center;justify-content:center;margin:0 auto 16px;"><i class="fas fa-check" style="color:white;font-size:28px;"></i></div>' +
      '<h2 style="margin-bottom:8px;">Pedido Finalizado!</h2>' +
      '<p style="color:#64748b;margin-bottom:16px;">Pedido #' + orderId + '</p>' +
      '<div style="text-align:left;background:#f8fafc;border-radius:8px;padding:12px;margin-bottom:16px;">' + itensHtml +
      '<hr style="margin:8px 0;"><div style="display:flex;justify-content:space-between;font-weight:700;">Total: R$ ' + total.toFixed(2) + '</div></div>' +
      '<p style="color:#64748b;font-size:13px;">Redirecionando para o admin...</p>' +
      '<button data-action="fecharConfirmacao" style="margin-top:12px;padding:10px 24px;border:none;border-radius:8px;background:#f97316;color:white;font-weight:600;cursor:pointer;">Fechar</button></div>';
    document.body.appendChild(overlay);
  }

  window.fecharConfirmacao = function () {
    var el = document.getElementById('pdvConfirmOverlay');
    if (el) el.remove();
  };

  // Expose needed to delegator
  window.pagar = pagar;
})();
