// js/pages/whatsapp.js — extracted from whatsapp.html inline scripts
(function () {
  var API = (window.getApiBase ? window.getApiBase() : window.location.origin) + '/api';
  var authUser = JSON.parse(localStorage.getItem('authUser') || 'null');
  if (!authUser) { window.location.href = 'login.html'; return; }

  var TOKEN = authUser.token || '';

  async function apiRequest(path, options) {
    options = options || {};
    var url = API + path;
    var headers = Object.assign({ 'Content-Type': 'application/json' }, options.headers || {});
    if (TOKEN) headers['Authorization'] = 'Bearer ' + TOKEN;
    var res = await fetch(url, Object.assign({}, options, { headers: headers }));
    if (!res.ok) {
      var err = await res.json().catch(function () { return { error: 'Erro na requisição' }; });
      throw new Error(err.error || 'Erro');
    }
    return res.json();
  }

  function toast(msg, type) {
    type = type || 'success';
    var c = document.getElementById('toastContainer');
    var d = document.createElement('div');
    d.className = 'toast toast-' + type;
    d.textContent = msg;
    d.onclick = function () { d.remove(); };
    c.appendChild(d);
    setTimeout(function () { d.style.opacity = '0'; d.style.transition = 'opacity 0.3s'; setTimeout(function () { d.remove(); }, 300); }, 4000);
  }

  function statusHtml(status) {
    var map = {
      connected: ['Conectado', 'status-connected'],
      disconnected: ['Desconectado', 'status-disconnected'],
      qrcode: ['Aguardando pareamento', 'status-qrcode'],
      reconnecting: ['Reconectando', 'status-reconnecting'],
      open: ['Conectado', 'status-connected'],
      close: ['Desconectado', 'status-disconnected'],
      connecting: ['Conectando', 'status-qrcode'],
    };
    var entry = map[status] || [status, 'status-disconnected'];
    return '<span class="status-badge ' + entry[1] + '"><i class="fas fa-circle"></i> ' + entry[0] + '</span>';
  }

  function isConectada(status) {
    return status === 'connected' || status === 'open';
  }

  async function carregarInstancias() {
    try {
      var instancias = await apiRequest('/whatsapp');
      var container = document.getElementById('instancesContainer');

      if (!instancias.length) {
        container.innerHTML =
          '<div class="info-box"><i class="fas fa-info-circle"></i> Conecte o WhatsApp da sua loja para receber notificações automaticas de pedidos.</div>' +
          '<div class="card"><div class="empty-state">' +
          '<i class="fab fa-whatsapp"></i>' +
          '<p>Nenhuma instância WhatsApp configurada.</p>' +
          '<p style="font-size:12px;color:#94a3b8;margin-top:4px;">Crie uma instância para conectar o WhatsApp da loja.</p>' +
          '<button class="btn btn-primary" style="margin-top:16px;" data-action="criarInstanciaAction">' +
          '<i class="fas fa-plus"></i> Criar Instância</button>' +
          '</div></div>';
        return;
      }

      var inst = instancias[0];
      var conectada = isConectada(inst.connectionStatus);

      var actionsHtml;
      if (!conectada) {
        actionsHtml =
          '<button class="btn btn-sm btn-primary" data-action="gerarQRAction" data-instid="' + inst.id + '"><i class="fas fa-qrcode"></i> Obter QR Code</button>' +
          '<button class="btn btn-sm btn-ghost" data-action="reconectarAction" data-instid="' + inst.id + '"><i class="fas fa-sync"></i> Reconectar</button>';
      } else {
        actionsHtml =
          '<button class="btn btn-sm btn-test" data-action="enviarTesteAction" data-instid="' + inst.id + '"><i class="fas fa-paper-plane"></i> Enviar Teste</button>' +
          '<button class="btn btn-sm btn-ghost" data-action="atualizarStatusAction" data-instid="' + inst.id + '"><i class="fas fa-sync"></i> Atualizar</button>';
      }

      container.innerHTML =
        '<div class="info-box"><i class="fas fa-info-circle"></i> ' +
        (conectada
          ? 'WhatsApp conectado. Notificações de pedidos serão enviadas automaticamente para os clientes.'
          : 'Conecte o WhatsApp escaneando o QR Code abaixo. As notificações só funcionam quando a instância estiver conectada.') +
        '</div>' +
        '<div class="card"><div class="instance-card">' +
        '<div class="instance-header"><div>' +
        '<div class="name">' + inst.instanceId + '</div>' +
        '<div class="instance-detail">' +
        (inst.phoneNumber
          ? '<i class="fas fa-phone"></i> <strong>' + inst.phoneNumber + '</strong>'
          : '<i class="fas fa-phone-slash"></i> Número não registrado') +
        '</div></div>' + statusHtml(inst.connectionStatus) +
        '</div>' +
        '<div class="actions">' + actionsHtml +
        '<button class="btn btn-sm btn-danger" data-action="excluirInstanciaAction" data-instid="' + inst.id + '"><i class="fas fa-trash"></i> Deletar</button>' +
        '</div></div></div>';

      var qrContainer = document.getElementById('qrContainer');
      if (conectada) {
        qrContainer.innerHTML = '';
      } else if (!qrContainer.innerHTML) {
        qrContainer.innerHTML =
          '<div class="card qr-box"><div class="empty-state">' +
          '<i class="fas fa-qrcode"></i>' +
          '<p>Nenhum QR Code ativo. Clique em "Gerar QR Code" para conectar.</p>' +
          '</div></div>';
      }
    } catch (e) {
      document.getElementById('instancesContainer').innerHTML =
        '<div class="card"><div class="empty-state"><i class="fas fa-exclamation-triangle"></i><p>' + e.message + '</p></div></div>';
    }
  }

  window.criarInstanciaAction = function () {
    document.getElementById('criarModal').style.display = 'flex';
  };

  window.fecharModalAction = function () {
    document.getElementById('criarModal').style.display = 'none';
  };

  window.confirmarCriacaoAction = async function () {
    var instanceName = document.getElementById('inputInstanceName').value.trim();
    var phoneRaw = document.getElementById('inputPhoneNumber').value.trim();
    if (!instanceName) return toast('Informe o nome da instância', 'danger');
    if (!phoneRaw) return toast('Informe o número da loja', 'danger');
    var phoneNumber = phoneRaw.replace(/\D/g, '');
    if (phoneNumber.length < 10) return toast('Número inválido. Informe DDI + DDD + número.', 'danger');
    try {
      await apiRequest('/whatsapp/criar', {
        method: 'POST',
        body: JSON.stringify({ instanceName: instanceName, phoneNumber: phoneNumber }),
      });
      toast('Instância criada com sucesso!');
      document.getElementById('criarModal').style.display = 'none';
      document.getElementById('inputInstanceName').value = '';
      document.getElementById('inputPhoneNumber').value = '';
      carregarInstancias();
      var instancias = await apiRequest('/whatsapp');
      if (instancias.length > 0) gerarQR(instancias[0].id);
    } catch (e) {
      toast(e.message, 'danger');
    }
  };

  async function gerarQR(id) {
    try {
      var res = await apiRequest('/whatsapp/' + id + '/qrcode', { method: 'POST' });
      if (res.base64) {
        mostrarQR({ base64: res.base64, pairingCode: res.pairingCode });
        iniciarPollingQR(id);
      } else {
        toast('QR Code não disponível. Evolution não retornou dados de conexão.', 'danger');
      }
      carregarInstancias();
    } catch (e) {
      toast('Erro ao gerar QR Code: ' + e.message, 'danger');
    }
  }
  window.gerarQR = gerarQR;

  function mostrarQR(qrData) {
    var container = document.getElementById('qrContainer');

    var base64 = typeof qrData === 'object' && qrData !== null ? (qrData.base64 || null) : null;
    var pairingCode = typeof qrData === 'string' ? qrData : (qrData ? qrData.pairingCode || null : null);

    var content, title;
    if (base64) {
      title = 'QR Code';
      content = '<img src="' + base64 + '" alt="QR Code" loading="lazy" style="width:256px;height:256px;margin:16px 0;" />' +
        '<p>Escaneie o QR Code com o WhatsApp do celular da loja</p>';
    } else if (pairingCode) {
      title = 'Código de Pareamento';
      content = '<p style="font-size:28px;font-weight:800;letter-spacing:6px;margin:16px 0;color:#25d366;font-family:monospace;">' + pairingCode + '</p>' +
        '<p>1. Abra o WhatsApp no celular da loja</p>' +
        '<p>2. Va em <strong>Menu → Dispositivos Conectados → Conectar um dispositivo</strong></p>' +
        '<p>3. Digite o código acima</p>';
    } else {
      return;
    }

    if (base64 && pairingCode && pairingCode.indexOf('@') === -1 && pairingCode.length < 20) {
      content += '<hr style="margin:16px 0;border:none;border-top:1px solid #e2e8f0;">' +
        '<p style="font-size:13px;color:#64748b;">Ou use o código de pareamento:</p>' +
        '<p style="font-size:24px;font-weight:800;letter-spacing:4px;margin:8px 0;color:#25d366;font-family:monospace;">' + pairingCode + '</p>';
    }

    container.innerHTML =
      '<div class="card qr-box" id="qrCard"><h3><i class="fas fa-qrcode"></i> ' + title + '</h3>' +
      content +
      '<button class="btn btn-ghost" style="margin-top:12px;" data-action="fecharQRCard">Fechar</button></div>';
  }

  var qrPollingId = null;

  async function iniciarPollingQR(id) {
    if (qrPollingId) clearInterval(qrPollingId);
    qrPollingId = setInterval(async function () {
      try {
        var res = await apiRequest('/whatsapp/' + id + '/status');
        if (res.connectionStatus === 'connected' || res.connectionStatus === 'open') {
          clearInterval(qrPollingId);
          qrPollingId = null;
          carregarInstancias();
          return;
        }
        if (res.connectionStatus === 'qrcode' || res.connectionStatus === 'disconnected') {
          var qrRes = await apiRequest('/whatsapp/' + id + '/qrcode', { method: 'POST' });
          if (qrRes.base64) {
            mostrarQR({ base64: qrRes.base64, pairingCode: qrRes.pairingCode });
          }
        }
      } catch (e) { /* polling continues silently */ }
    }, 10000);
  }

  window.enviarTesteAction = async function (ds) {
    try {
      await apiRequest('/whatsapp/' + ds.instid + '/teste', { method: 'POST' });
      toast('Mensagem de teste enviada com sucesso!');
    } catch (e) {
      toast(e.message, 'danger');
    }
  };

  window.reconectarAction = async function (ds) {
    try {
      await apiRequest('/whatsapp/' + ds.instid + '/reconectar', { method: 'POST' });
      toast('Reconectando...', 'info');
      carregarInstancias();
    } catch (e) {
      toast(e.message, 'danger');
    }
  };

  window.atualizarStatusAction = async function (ds) {
    try {
      var res = await apiRequest('/whatsapp/' + ds.instid + '/status');
      toast('Status: ' + (res.connectionStatus || 'desconhecido'), 'info');
      carregarInstancias();
    } catch (e) {
      toast(e.message, 'danger');
    }
  };

  window.excluirInstanciaAction = async function (ds) {
    if (!(await confirmModal('Excluir esta instância WhatsApp? As notificações pararão de funcionar.'))) return;
    try {
      await apiRequest('/whatsapp/' + ds.instid, { method: 'DELETE' });
      toast('Instância removida', 'danger');
      carregarInstancias();
    } catch (e) {
      toast(e.message, 'danger');
    }
  };

  // Dynamic content action bridges
  window.fecharQRCard = function () {
    var card = document.getElementById('qrCard');
    if (card) card.remove();
  };

  carregarInstancias();
  setInterval(carregarInstancias, 15000);
})();
