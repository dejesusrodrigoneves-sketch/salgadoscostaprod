// js/pages/superadmin.js — módulo da rota superadmin
const HTML_SUPERADMIN = `<body>

<div class="sa-layout">
  <div class="sa-overlay" id="saOverlay"></div>
  <aside class="sa-sidebar" id="saSidebar">
    <div class="sa-sidebar-header">
      <div class="sa-logo"><i class="fas fa-shield-alt"></i></div>
      <div class="sa-brand"><strong>Super Admin</strong><span>Controle geral</span></div>
      <button class="sa-hamburger" id="saCollapseBtn" title="Recolher menu"><i class="fas fa-bars"></i></button>
      <button class="sa-expand" id="saExpandBtn" title="Expandir menu"><i class="fas fa-chevron-right"></i></button>
    </div>
    <nav class="sa-nav" id="saNav"></nav>
    <div class="sa-sidebar-foot">v1.0</div>
  </aside>
  <div class="sa-main">

<!-- Dashboard tab -->
<div class="tab-content active" id="tabDashboard">
  <div class="empresa-selector">
    <label><i class="fas fa-building"></i> Visualizar:</label>
    <select id="dashEmpresaSelect" data-action-change="onEmpresaChangeAction">
      <option value="">Todas as Empresas (Visão Geral)</option>
    </select>
    <span class="empresa-badge" id="dashEmpresaBadge"><i class="fas fa-globe"></i> Global</span>
  </div>
  <div class="dash-header">
    <h2 id="dashTitle">Visão Geral do SaaS</h2>
    <button class="btn-refresh" data-action="carregarDashboardAction"><i class="fas fa-sync-alt"></i> Atualizar</button>
  </div>
  <div class="dash-cards" id="dashCards"></div>
  <div class="dash-table-card" id="dashTableCard">
    <h3><i class="fas fa-building"></i> Empresas - Resumo Financeiro</h3>
    <table class="dash-table">
      <thead><tr><th>Empresa</th><th>Pedidos Mês</th><th>Recebido</th><th>A Receber</th><th>Status</th></tr></thead>
      <tbody id="dashEmpresasBody"></tbody>
    </table>
  </div>
</div>

<!-- Users tab -->
<div class="tab-content" id="tabUsuarios">
  <div class="card">
    <h2><i class="fas fa-list"></i> Usuários Cadastrados</h2>
    <div style="display:flex;align-items:center;gap:8px;margin-bottom:12px;">
      <label for="filtroEmpresaUsuarios" style="font-weight:600;color:#94a3b8;">Filtrar por empresa:</label>
      <select id="filtroEmpresaUsuarios" aria-label="Filtrar por empresa" style="background:#1e293b;color:#e2e8f0;border:1px solid #334155;border-radius:6px;padding:6px 10px;">
        <option value="">Todas as empresas</option>
      </select>
    </div>
    <div style="overflow-x:auto">
    <table class="user-table">
      <thead><tr><th>Usuário</th><th>Papel</th><th>Empresa</th><th>Loja</th><th>Criado em</th><th>Ações</th></tr></thead>
      <tbody id="userTableBody"></tbody>
    </table>
    </div>
  </div>
  <div class="card">
    <h2><i class="fas fa-plus-circle"></i> Cadastrar Novo Usuário</h2>
    <div style="max-width:400px;">
      <input type="text" id="newUsername" aria-label="Nome de usuário" placeholder="Nome de usuário">
      <input type="password" id="newPassword" aria-label="Senha" placeholder="Senha">
      <select id="newRole" aria-label="Papel do usuário">
        <option value="user">Usuário</option>
        <option value="admin">Administrador</option>
        <option value="superadmin">Super Admin</option>
      </select>
      <select id="newEmpresa" aria-label="Empresa da conta">
        <option value="">— selecionar empresa —</option>
      </select>
      <button class="btn btn-primary" data-action="cadastrarUsuarioAction"><i class="fas fa-user-plus"></i> Cadastrar</button>
    </div>
    <div class="toast" id="registerMsg" style="display:none;margin-top:10px;"></div>
  </div>
</div>

<!-- Passwords tab -->
<div class="tab-content" id="tabSenhas">
  <div class="card">
    <h2><i class="fas fa-exchange-alt"></i> Alterar Senha de Usuário</h2>
    <div style="max-width:400px;">
      <select id="userSelect" aria-label="Selecionar usuário"><option value="">Carregando...</option></select>
      <input type="password" id="newPassInput" aria-label="Nova senha" placeholder="Nova senha">
      <input type="password" id="newPassConfirm" aria-label="Confirmar nova senha" placeholder="Confirmar nova senha">
      <button class="btn btn-primary" data-action="alterarSenhaAction"><i class="fas fa-save"></i> Salvar</button>
    </div>
    <div class="toast" id="passMsg" style="display:none;margin-top:10px;"></div>
  </div>
</div>

<!-- Clientes tab -->
<div class="tab-content" id="tabClientes">
  <div class="card">
    <h2><i class="fas fa-user-tie"></i> Clientes Cadastrados</h2>
    <div style="display:flex;align-items:center;gap:8px;margin-bottom:12px;">
      <label for="filtroEmpresaClientes" style="font-weight:600;color:#94a3b8;">Filtrar por empresa:</label>
      <select id="filtroEmpresaClientes" aria-label="Filtrar por empresa" style="background:#1e293b;color:#e2e8f0;border:1px solid #334155;border-radius:6px;padding:6px 10px;">
        <option value="">Todas as empresas</option>
      </select>
    </div>
    <div style="overflow-x:auto">
    <table class="user-table">
      <thead><tr><th>Nome</th><th>Telefone</th><th>Bairro</th><th>Empresa</th><th>Criado em</th><th>Ações</th></tr></thead>
      <tbody id="clientesTableBody"></tbody>
    </table>
    </div>
  </div>

  <!-- Modal Editar Cliente -->
  <div class="modal-overlay" id="modalEditarCliente" style="display:none;">
    <div class="modal-card">
      <h3><i class="fas fa-user-edit"></i> Editar Cliente</h3>
      <label>Nome <input type="text" id="editNome"></label>
      <label>Telefone <input type="text" id="editTelefone"></label>
      <label>Endereço <input type="text" id="editEndereco"></label>
      <label>Número <input type="text" id="editNumero"></label>
      <label>Bairro <input type="text" id="editBairro"></label>
      <label>CEP <input type="text" id="editCep"></label>
      <label>Ponto de Referência <input type="text" id="editPontoReferencia"></label>
      <div class="modal-actions">
        <button class="btn btn-secondary" data-action="fecharModalAction" data-modal="modalEditarCliente">Cancelar</button>
        <button class="btn btn-primary" data-action="salvarEdicaoClienteAction"><i class="fas fa-save"></i> Salvar</button>
      </div>
    </div>
  </div>

  <!-- Modal Trocar Senha -->
  <div class="modal-overlay" id="modalSenhaCliente" style="display:none;">
    <div class="modal-card">
      <h3><i class="fas fa-key"></i> Trocar Senha</h3>
      <label>Nova senha <input type="password" id="novaSenhaCliente" aria-label="Nova senha" placeholder="Nova senha"></label>
      <label>Confirmar senha <input type="password" id="confirmarSenhaCliente" aria-label="Confirmar senha" placeholder="Confirmar senha"></label>
      <div class="modal-actions">
        <button class="btn btn-secondary" data-action="fecharModalAction" data-modal="modalSenhaCliente">Cancelar</button>
        <button class="btn btn-primary" data-action="salvarSenhaClienteAction"><i class="fas fa-save"></i> Salvar</button>
      </div>
    </div>
  </div>
</div>

<!-- Empresas tab -->
<div class="tab-content" id="tabEmpresas">
  <div class="card">
    <h2><i class="fas fa-store"></i> Empresas Cadastradas</h2>
    <div style="overflow-x:auto">
    <table class="user-table">
      <thead><tr><th>Nome</th><th>Slug</th><th>Telefone</th><th>Cidade</th><th>Split</th><th>Produtos</th><th>Pedidos</th><th>Criado em</th><th>Ações</th></tr></thead>
      <tbody id="empresasTableBody"></tbody>
    </table>
    </div>
  </div>
  <div class="card">
    <h2><i class="fas fa-plus-circle"></i> Cadastrar Nova Empresa</h2>
    <div style="max-width:600px;display:grid;grid-template-columns:1fr 1fr;gap:0.5rem;">
      <input type="text" id="empNome" aria-label="Nome da loja" placeholder="Nome da loja *">
      <input type="text" id="empSlug" aria-label="Slug da loja" placeholder="Slug (URL) *">
      <input type="text" id="empTelefone" aria-label="Telefone" placeholder="Telefone">
      <input type="text" id="empCidade" aria-label="Cidade" placeholder="Cidade">
    </div>
    <button class="btn btn-primary" data-action="cadastrarEmpresaAction"><i class="fas fa-plus"></i> Cadastrar</button>
  </div>

  <!-- Modal Editar Empresa -->
  <div class="modal-overlay" id="modalEditarEmpresa" style="display:none;">
    <div class="modal-card">
      <h3><i class="fas fa-store"></i> Editar Empresa</h3>
      <input type="hidden" id="editEmpId">
      <label>Nome <input type="text" id="editEmpNome"></label>
      <label>Slug <input type="text" id="editEmpSlug"></label>
      <label>Telefone <input type="text" id="editEmpTelefone"></label>
      <label>Endereço <input type="text" id="editEmpEndereco"></label>
      <label>Número <input type="text" id="editEmpNumero"></label>
      <label>Bairro <input type="text" id="editEmpBairro"></label>
      <label>CEP <input type="text" id="editEmpCep"></label>
      <label>Cidade <input type="text" id="editEmpCidade"></label>
      <label>Estado <input type="text" id="editEmpEstado"></label>
      <label>Descrição <textarea id="editEmpDescricao" rows="2"></textarea></label>
      <div class="payment-section" id="paymentSection" style="display:none;margin-top:12px;padding:12px;border:1px solid #334155;border-radius:8px;">
        <h4 style="margin:0 0 8px;color:var(--accent,#f97316);font-size:0.95rem;"><i class="fas fa-credit-card"></i> Pagamento</h4>
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:6px;font-size:0.85rem;">
          <div><strong>Status:</strong> <span id="paymentStatusIcon"></span></div>
          <div><strong>Onboarded:</strong> <span id="paymentOnboardedAt">—</span></div>
          <div><strong>Wallet ID:</strong> <span id="paymentWalletId" style="font-family:monospace;font-size:0.8rem;word-break:break-all;">—</span></div>
          <div><strong>Subconta ID:</strong> <span id="paymentSubcontaId" style="font-family:monospace;font-size:0.8rem;word-break:break-all;">—</span></div>
        </div>
        <div id="paymentSettlements" style="margin-top:8px;font-size:0.85rem;"></div>
        <div style="margin-top:10px;" id="paymentDeactivateWrap">
          <button class="btn btn-secondary" id="btnDesativarSplit" data-action="desativarSplitAction" style="font-size:0.8rem;"><i class="fas fa-ban"></i> Desativar Split</button>
        </div>
      </div>
      <div class="modal-actions">
        <button class="btn btn-secondary" data-action="fecharModalAction" data-modal="modalEditarEmpresa">Cancelar</button>
        <button class="btn btn-primary" data-action="salvarEdicaoEmpresaAction"><i class="fas fa-save"></i> Salvar</button>
      </div>
    </div>
  </div>
</div>

<!-- Filiais tab -->
<div class="tab-content" id="tabFiliais">
  <div class="card">
    <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:16px;">
      <h2 style="font-size:16px;font-weight:600;"><i class="fas fa-sitemap"></i> Gerenciar Filiais</h2>
      <button class="btn btn-primary" data-action="abrirModalCriarFilialAction"><i class="fas fa-plus"></i> Criar Filial</button>
    </div>
    <div style="overflow-x:auto">
      <table class="user-table">
        <thead>
          <tr>
            <th>Nome</th>
            <th>Slug</th>
            <th>Matriz Pai</th>
            <th>Justificativa</th>
            <th>Data Criação</th>
            <th>Status</th>
            <th>Ações</th>
          </tr>
        </thead>
        <tbody id="filiaisTableBody"></tbody>
      </table>
    </div>
  </div>

  <!-- Modal Criar Filial -->
  <div class="modal-overlay" id="modalCriarFilial" style="display:none;">
    <div class="modal-card">
      <h3><i class="fas fa-plus"></i> Criar Nova Filial</h3>
      <label>Nome <input type="text" id="filialNome" placeholder="Nome da filial"></label>
      <label>Justificativa <textarea id="filialJustificativa" rows="2" placeholder="Ex: expansão bairro X"></textarea></label>
      <label>Matriz
        <select id="filialMatriz">
          <option value="">Selecionar matriz...</option>
        </select>
      </label>
      <div class="modal-actions">
        <button class="btn btn-secondary" data-action="fecharModalAction" data-modal="modalCriarFilial">Cancelar</button>
        <button class="btn btn-primary" data-action="criarFilialAction"><i class="fas fa-plus"></i> Criar</button>
      </div>
    </div>
  </div>
</div>

<!-- Modal Desvincular Filial -->
<div class="modal-overlay" id="modalDesvincularFilial" style="display:none;">
  <div class="modal-card" style="max-width:420px;text-align:center;">
    <div style="width:56px;height:56px;border-radius:14px;display:flex;align-items:center;justify-content:center;margin:0 auto 18px;font-size:24px;background:rgba(245,158,11,0.12);color:#F59E0B;">
      <i class="fas fa-link"></i>
    </div>
    <h3 style="font-size:17px;font-weight:700;color:#FFFCE1;margin-bottom:10px;">Desvincular Filial</h3>
    <p style="font-size:13px;line-height:1.65;color:#94A3B8;margin-bottom:16px;">
      Ao desvincular sua empresa filial, acarretará que ela entrará em <strong style="color:#F59E0B;">modo de teste</strong> e isso <strong style="color:#FFFCE1;">não poderá ser revertido</strong>.
    </p>
    <div style="display:inline-flex;align-items:center;gap:6px;padding:6px 12px;border-radius:8px;font-size:11px;font-weight:600;background:rgba(245,158,11,0.1);border:1px solid rgba(245,158,11,0.25);color:#F59E0B;margin-bottom:20px;">
      <i class="fas fa-exclamation-triangle"></i> Modo teste a partir de <strong id="dataCicloDesvincularSA">...</strong> — mensalidade integral. Tem certeza disso?
    </div>
    <div class="modal-actions">
      <button class="btn btn-secondary" data-action="cancelarDesvincularAction">Não</button>
      <button class="btn btn-primary" data-action="confirmarDesvincularAction" style="background:#F59E0B;color:#000;border:none;">Sim, desvincular</button>
    </div>
  </div>
</div>

<!-- Modal Excluir Filial -->
<div class="modal-overlay" id="modalExcluirFilial" style="display:none;">
  <div class="modal-card" style="max-width:420px;text-align:center;">
    <div style="width:56px;height:56px;border-radius:14px;display:flex;align-items:center;justify-content:center;margin:0 auto 18px;font-size:24px;background:rgba(239,68,68,0.12);color:#EF4444;">
      <i class="fas fa-trash-alt"></i>
    </div>
    <h3 style="font-size:17px;font-weight:700;color:#FFFCE1;margin-bottom:10px;">Excluir Filial</h3>
    <p style="font-size:13px;line-height:1.65;color:#94A3B8;margin-bottom:16px;">
      Você está prestes a apagar essa filial do seu sistema. Todos os valores irão para a <strong style="color:#FFFCE1;">chave PIX cadastrada</strong> na mesma e todos os dados permanecerão guardados conforme <strong style="color:#FFFCE1;">LGPD</strong>.
    </p>
    <div style="display:inline-flex;align-items:center;gap:6px;padding:6px 12px;border-radius:8px;font-size:11px;font-weight:600;background:rgba(239,68,68,0.1);border:1px solid rgba(239,68,68,0.25);color:#EF4444;margin-bottom:20px;">
      <i class="fas fa-exclamation-circle"></i> Ação irreversível — filial apagada a partir da data de <strong id="dataCicloExcluirSA">...</strong>. Tem certeza disso?
    </div>
    <div class="modal-actions">
      <button class="btn btn-secondary" data-action="cancelarExcluirAction">Não</button>
      <button class="btn btn-primary" data-action="confirmarExcluirAction" style="background:#EF4444;color:#fff;border:none;">Sim, excluir</button>
    </div>
  </div>
</div>

<div class="tab-content" id="tabSettlements">
  <div class="card">
    <h2><i class="fas fa-dollar-sign"></i> Settlements Globais</h2>
    <div style="overflow-x:auto">
    <table class="user-table">
      <thead><tr><th>Empresa</th><th>Periodo</th><th>Pedidos</th><th>Bruto</th><th>Liquido</th><th>Status</th></tr></thead>
      <tbody id="settlementsTableBody"></tbody>
    </table>
    </div>
  </div>
</div>

<!-- Integrações tab -->
<div class="tab-content" id="tabIntegracoes">
  <div class="card">
    <h2><i class="fas fa-plug"></i> Integrações Marketplace</h2>
    <div id="super-integ-lista" style="display:grid;grid-template-columns:repeat(auto-fill,minmax(260px,1fr));gap:1rem;"></div>
  </div>
</div>

<!-- Audit logs tab -->
<div class="tab-content" id="tabRegistros">
  <div class="card">
    <h2><i class="fas fa-scroll"></i> Registros de Auditoria</h2>
    <div class="audit-filters">
      <div>
        <label for="filtroUsuario">Usuário</label>
        <select id="filtroUsuario" aria-label="Filtrar por usuário"><option value="">Todos os usuários</option></select>
      </div>
      <div>
        <label for="filtroModulo">Módulo</label>
        <select id="filtroModulo" aria-label="Filtrar por módulo">
          <option value="">Todos os módulos</option>
          <option value="cliente">cliente</option>
          <option value="whatsapp">whatsapp</option>
          <option value="auth">auth</option>
          <option value="pedido">pedido</option>
          <option value="geral">geral</option>
        </select>
      </div>
      <div>
        <label for="filtroSeveridade">Severidade</label>
        <select id="filtroSeveridade" aria-label="Filtrar por severidade">
          <option value="">Todas</option>
          <option value="info">Info</option>
          <option value="warning">Aviso</option>
          <option value="critical">Crítico</option>
        </select>
      </div>
      <div>
        <label for="filtroInicio">De</label>
        <input type="date" id="filtroInicio" aria-label="Data inicial">
      </div>
      <div>
        <label for="filtroFim">Até</label>
        <input type="date" id="filtroFim" aria-label="Data final">
      </div>
      <div class="audit-filters-actions">
        <button class="btn btn-primary" id="btnLimparFiltros"><i class="fas fa-eraser"></i> Limpar filtros</button>
      </div>
    </div>
    <div class="audit-summary" id="timelineErro" style="display:none;"></div>
    <div class="timeline" id="timeline"><div class="timeline-empty">Carregando...</div></div>
    <div class="audit-footer">
      <span id="auditContador"></span>
      <button class="btn btn-primary" id="btnLoadMore" style="display:none;"><i class="fas fa-plus"></i> Carregar mais</button>
    </div>
  </div>
</div>

<!-- Billing tab -->
<div class="tab-content" id="tabBilling">
  <div class="dash-cards" id="billingCards"></div>
  <div class="dash-table-card">
    <h3><i class="fas fa-credit-card"></i> Assinaturas</h3>
    <div style="display:flex;align-items:center;gap:8px;margin-bottom:12px;">
      <label for="filtroEmpresaBilling" style="font-weight:600;color:#7C7C6F;font-size:12px;text-transform:uppercase;letter-spacing:0.5px;">Filtrar por empresa:</label>
      <select id="filtroEmpresaBilling" aria-label="Filtrar por empresa" style="background:#111;color:#FFFCE1;border:1px solid #333;border-radius:8px;padding:6px 10px;font-size:13px;font-family:inherit;">
        <option value="">Todas as empresas</option>
      </select>
    </div>
    <table class="dash-table">
      <thead>
        <tr>
          <th>Empresa</th>
          <th>Status</th>
          <th>Próximo Vencimento</th>
          <th>Último Pagamento</th>
          <th>Ações</th>
        </tr>
      </thead>
      <tbody id="billingTableBody"></tbody>
    </table>
  </div>
  <div class="dash-table-card" style="margin-top: 24px;">
    <h3><i class="fas fa-dollar-sign"></i> Configurar Mensalidade</h3>
    <div style="display: flex; gap: 16px; align-items: end;">
      <div>
        <label style="font-size: 12px; color: #7C7C6F;">Valor (R$)</label>
        <input type="number" id="pricingValue" value="100" step="0.01" style="
          padding: 10px; border: 1px solid #333; border-radius: 8px;
          background: #111; color: #FFFCE1; font-size: 14px; width: 150px;
        ">
      </div>
      <div>
        <label style="font-size: 12px; color: #7C7C6F;">Data de Efetivação</label>
        <input type="date" id="pricingDate" style="
          padding: 10px; border: 1px solid #333; border-radius: 8px;
          background: #111; color: #FFFCE1; font-size: 14px;
        ">
      </div>
      <button data-action="savePricingAction" style="
        padding: 10px 20px; background: #F26D3D; color: white;
        border: none; border-radius: 8px; font-weight: 600; cursor: pointer;
      ">
        Salvar Alterações
      </button>
    </div>
  </div>
</div>

<!-- Modal Detalhes Assinatura -->
<div class="modal-overlay-sub" id="modalDetalhesAssinatura">
  <div class="modal-card-sub">
    <div class="modal-title-sub">Detalhes da Assinatura</div>
    <div class="modal-subtitle-sub">Informações completas da assinatura desta empresa</div>
    <div class="empresa-header-sub">
      <div class="empresa-header-icon-sub"><i class="fas fa-building"></i></div>
      <div class="empresa-header-info-sub">
        <div class="empresa-header-name-sub" id="subEmpresaNome">—</div>
        <div class="empresa-header-slug-sub" id="subEmpresaSlug">—</div>
      </div>
    </div>
    <div class="status-section-sub">
      <div class="status-section-label-sub">Status</div>
      <span class="status-badge" id="subStatusBadge" style="font-size:12px;padding:5px 14px;"><i class="fas fa-circle" style="font-size:6px;"></i> <span id="subStatusText">—</span></span>
    </div>
    <div class="detail-grid-sub">
      <div><div class="detail-label-sub">Valor Mensal</div><div class="detail-value-sub" id="subValor">—</div></div>
      <div><div class="detail-label-sub">Tipo Cobrança</div><div class="detail-value-sub" id="subBillingType">—</div></div>
      <div><div class="detail-label-sub">Próx. Vencimento</div><div class="detail-value-sub" id="subNextDue">—</div></div>
      <div><div class="detail-label-sub">Último Pagamento</div><div class="detail-value-sub" id="subLastPayment">—</div></div>
      <div><div class="detail-label-sub">Fim do Trial</div><div class="detail-value-sub muted" id="subTrialEnds">—</div></div>
      <div><div class="detail-label-sub">Cancelado em</div><div class="detail-value-sub muted" id="subCanceledAt">—</div></div>
    </div>
    <div class="id-box-sub">
      <div class="id-box-label-sub">ID Asaas</div>
      <div class="id-box-value-sub" id="subAsaasId">—</div>
    </div>
    <div class="created-at-sub"><i class="far fa-clock" style="margin-right:4px;"></i> Criado em <strong id="subCreatedAt">—</strong></div>
    <div class="modal-divider-sub"></div>
    <div>
      <div class="status-section-label-sub" style="margin-bottom:10px;">Alterar Status</div>
      <div class="status-change-row-sub">
        <select class="status-select-sub" id="subStatusSelect">
          <option value="TRIAL">TRIAL</option>
          <option value="ACTIVE">ACTIVE</option>
          <option value="PAST_DUE">PAST_DUE</option>
          <option value="SUSPENDED">SUSPENDED</option>
          <option value="CANCELED">CANCELED</option>
        </select>
        <button class="btn-update-sub" data-action="atualizarStatusAssinaturaAction"><i class="fas fa-save" style="margin-right:4px;"></i> Atualizar</button>
        <button class="btn-close-sub" data-action="fecharModalDetalhesAction">Fechar</button>
      </div>
    </div>
  </div>
</div>

<div class="toast-container" id="toastContainer"></div>


  </div><!-- /.sa-main -->
</div><!-- /.sa-layout -->

</body>`;

const STYLE_SUPERADMIN = `
  /* Superadmin Dashboard dark theme override */
  #pageContainer { color: var(--text, #FFFCE1); }
  .empresa-selector { display: flex; align-items: center; gap: 12px; margin-bottom: 20px; padding: 14px 20px; background: var(--surface, #191919); border-radius: 16px; border: 1px solid #2a2a2a; }
  .empresa-selector label { font-size: 12px; color: #7C7C6F; font-weight: 600; text-transform: uppercase; letter-spacing: 0.5px; white-space: nowrap; }
  .empresa-selector select { flex: 1; padding: 8px 12px; border: 1px solid #333; border-radius: 8px; background: #111; color: var(--text, #FFFCE1); font-size: 13px; font-family: inherit; font-weight: 500; cursor: pointer; }
  .empresa-selector select:focus { outline: none; border-color: var(--primary, #F26D3D); }
  .empresa-badge { display: inline-flex; align-items: center; gap: 6px; padding: 4px 10px; border-radius: 999px; font-size: 11px; font-weight: 600; background: rgba(242,109,61,0.15); color: var(--primary, #F26D3D); }
  .dash-header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 24px; }
  .dash-header h2 { font-size: 14px; font-weight: 600; color: #7C7C6F; }
  .btn-refresh { padding: 8px 16px; border: 1px solid #333; border-radius: 8px; background: transparent; color: var(--text, #FFFCE1); font-size: 12px; cursor: pointer; font-family: inherit; display: flex; align-items: center; gap: 6px; }
  .dash-cards { display: grid; grid-template-columns: repeat(4, minmax(0, 1fr)); gap: 16px; margin-bottom: 24px; }
  .dash-card { background: var(--surface, #191919); border-radius: 16px; padding: 20px; border-left: 4px solid var(--primary, #F26D3D); }
  .dash-card-icon { font-size: 20px; color: var(--primary, #F26D3D); margin-bottom: 8px; opacity: 0.8; }
  .dash-card-value { font-size: 28px; font-weight: 800; color: var(--text, #FFFCE1); line-height: 1.2; }
  .dash-card-label { font-size: 11px; color: #7C7C6F; margin-top: 4px; text-transform: uppercase; letter-spacing: 0.5px; font-weight: 600; }
  .dash-table-card { background: var(--surface, #191919); border-radius: 16px; padding: 20px; overflow-x: auto; }
  .dash-table-card h3 { font-size: 14px; font-weight: 600; margin-bottom: 16px; display: flex; align-items: center; gap: 8px; }
  .dash-table-card h3 i { color: var(--primary, #F26D3D); }
  .dash-table { width: 100%; border-collapse: collapse; font-size: 13px; }
  .dash-table th { text-align: left; padding: 12px; color: #7C7C6F; font-weight: 600; border-bottom: 1px solid #2a2a2a; font-size: 11px; text-transform: uppercase; letter-spacing: 0.5px; }
  .dash-table td { padding: 14px 12px; border-bottom: 1px solid #1e1e1e; }
  .empresa-name { font-weight: 700; }
  .empresa-slug { font-size: 11px; color: #7C7C6F; font-family: monospace; }
  .status-badge { display: inline-flex; align-items: center; gap: 4px; padding: 4px 10px; border-radius: 999px; font-size: 11px; font-weight: 600; }
  .status-active { background: rgba(16,185,129,0.15); color: #10B981; }
  .status-inactive { background: rgba(124,124,111,0.15); color: #7C7C6F; }
  .status-trial { background: rgba(59,130,246,0.15); color: #3B82F6; }
  .status-past_due { background: rgba(245,158,11,0.15); color: #F59E0B; }
  .status-suspended { background: rgba(239,68,68,0.15); color: #EF4444; }
  .status-canceled { background: rgba(124,124,111,0.15); color: #7C7C6F; }
  .amount-positive { color: #10B981; font-weight: 600; }
  .amount-pending { color: #F59E0B; font-weight: 600; }
  @media (max-width: 1024px) { .dash-cards { grid-template-columns: repeat(2, minmax(0, 1fr)); } }
  @media (max-width: 600px) { .dash-cards { grid-template-columns: minmax(0, 1fr); } .dash-card-value { font-size: 22px; } }

  /* Modal Detalhes Assinatura */
  .modal-overlay-sub { position:fixed;top:0;left:0;right:0;bottom:0;background:rgba(0,0,0,0.65);backdrop-filter:blur(6px);display:none;align-items:center;justify-content:center;z-index:1000; }
  .modal-overlay-sub.show { display:flex; }
  .modal-card-sub { background:#191919;border:1px solid #2a2a2a;border-radius:16px;padding:28px 32px;width:100%;max-width:480px;max-height:90vh;overflow-y:auto;box-shadow:0 20px 60px rgba(0,0,0,0.5); }
  .modal-title-sub { font-size:18px;font-weight:700;color:#FFFCE1;margin-bottom:4px; }
  .modal-subtitle-sub { font-size:11px;color:#7C7C6F;text-transform:uppercase;letter-spacing:0.5px;font-weight:600;margin-bottom:20px; }
  .empresa-header-sub { background:rgba(242,109,61,0.06);border:1px solid rgba(242,109,61,0.12);border-radius:12px;padding:14px 16px;margin-bottom:20px;display:flex;align-items:center;gap:12px; }
  .empresa-header-icon-sub { width:36px;height:36px;background:rgba(242,109,61,0.15);border-radius:10px;display:flex;align-items:center;justify-content:center;color:#F26D3D;font-size:16px;flex-shrink:0; }
  .empresa-header-name-sub { font-size:14px;font-weight:700;color:#FFFCE1; }
  .empresa-header-slug-sub { font-size:11px;color:#7C7C6F;font-family:monospace; }
  .status-section-sub { margin-bottom:20px; }
  .status-section-label-sub { font-size:11px;color:#7C7C6F;font-weight:600;text-transform:uppercase;letter-spacing:0.5px;margin-bottom:8px; }
  .detail-grid-sub { display:grid;grid-template-columns:1fr 1fr;gap:16px;margin-bottom:20px; }
  .detail-label-sub { font-size:11px;color:#7C7C6F;font-weight:600;text-transform:uppercase;letter-spacing:0.5px;margin-bottom:4px; }
  .detail-value-sub { font-size:14px;color:#FFFCE1;font-weight:500; }
  .detail-value-sub.muted { color:#7C7C6F; }
  .id-box-sub { background:#111;border:1px solid #333;border-radius:8px;padding:10px 14px;margin-bottom:16px; }
  .id-box-label-sub { font-size:11px;color:#7C7C6F;font-weight:600;text-transform:uppercase;letter-spacing:0.5px;margin-bottom:6px; }
  .id-box-value-sub { font-family:monospace;font-size:12px;color:#7C7C6F;word-break:break-all; }
  .created-at-sub { font-size:12px;color:#7C7C6F;margin-bottom:20px; }
  .modal-divider-sub { height:1px;background:#2a2a2a;margin:0 -32px 20px; }
  .status-change-row-sub { display:flex;align-items:center;gap:10px;flex-wrap:wrap; }
  .status-select-sub { background:#111;color:#FFFCE1;border:1px solid #333;border-radius:8px;padding:8px 12px;font-size:13px;font-family:inherit;font-weight:500;cursor:pointer;flex:1; }
  .status-select-sub:focus { outline:none;border-color:#F26D3D; }
  .btn-update-sub { padding:8px 16px;background:#F26D3D;color:white;border:none;border-radius:8px;font-weight:600;font-size:13px;cursor:pointer;font-family:inherit;white-space:nowrap;transition:background 0.15s; }
  .btn-update-sub:hover { background:#e85d2a; }
  .btn-close-sub { padding:8px 16px;background:transparent;color:#7C7C6F;border:1px solid #333;border-radius:8px;font-size:13px;cursor:pointer;font-family:inherit;white-space:nowrap;transition:all 0.15s; }
  .btn-close-sub:hover { border-color:#555;color:#FFFCE1; }

  /* Modal overlays (desvincular / excluir filial) */
  .modal-overlay { position:fixed;top:0;left:0;right:0;bottom:0;background:rgba(0,0,0,0.65);backdrop-filter:blur(6px);display:none;align-items:center;justify-content:center;z-index:1000; }
  .modal-card { background:#191919;border:1px solid #2a2a2a;border-radius:16px;padding:28px 32px;width:100%;max-width:480px;box-shadow:0 20px 60px rgba(0,0,0,0.5); }
  .modal-actions { display:flex;gap:10px;margin-top:20px; }
  .modal-actions .btn { flex:1;padding:12px 16px;border-radius:10px;font-size:13px;font-weight:600;font-family:inherit;cursor:pointer;border:none;transition:all 0.2s; }
  .btn-secondary { background:#2a2a2a;color:#94A3B8;border:1px solid #333; }
  .btn-secondary:hover { background:#333;color:#FFFCE1; }
  .btn-primary { background:#F26D3D;color:#fff; }
  .btn-primary:hover { background:#e85d2a; }
`;

let _abort = null;
const _cleanups = [];

export async function mount(container, params) {
  unmount();
  _abort = new AbortController();
  container.innerHTML = HTML_SUPERADMIN;
  if (STYLE_SUPERADMIN) {
    const s = document.createElement('style');
    s.dataset.page = 'superadmin';
    s.textContent = STYLE_SUPERADMIN;
    document.head.appendChild(s);
    _cleanups.push(function () { s.remove(); });
  }
  _cleanups.push(
    pageCss('css/superadmin-page.css', 'superadmin'),
    pageCss('https://cdn.jsdelivr.net/npm/bootstrap-icons@1.11.3/font/bootstrap-icons.min.css', 'superadmin')
  );
  // HTML primeiro: helpers com init auto (readyState) precisam dos nós.
  // superadmin-audit.js é ES module (export) — import dinâmico, não loadScriptOnce.
  const audit = await import('../superadmin-audit.js');
  await loadScriptOnce('js/password-toggle.js');
  await loadScriptOnce('js/superadminDashboard.js');
  await loadScriptOnce('js/superadminBilling.js');
  await loadScriptOnce('js/superadmin-integracoes.js');
  await loadScriptOnce('https://cdnjs.cloudflare.com/ajax/libs/bcryptjs/2.4.3/bcrypt.min.js');
(function () {
  var host = window.location.hostname;
  var isLocal = host === 'localhost' || /^\d+(\.\d+){3}$/.test(host);
  var isSuperadminDomain = isLocal || host.split('.')[0] === 'admin';
  var isVercel = host.endsWith('.vercel.app') || host.endsWith('.now.sh');
  if (!isSuperadminDomain && !isVercel) {
    var labels = host.split('.');
    if (labels.length >= 3) {
      window.location.href = 'https://admin.' + labels.slice(1).join('.');
    }
  }

  function _doFetch(path, opts) {
    var headers = { 'Content-Type': 'application/json' };
    return authFetch((window.getApiBase ? window.getApiBase() : '') + '/api' + path, {
      headers: headers,
      method: opts ? opts.method : undefined,
      body: opts ? opts.body : undefined
    });
  }

  function api(path, opts) {
    var skip = opts && opts.skipLoading === true;
    if (!skip && typeof showLoading === 'function') showLoading();
    return _doFetch(path, opts).then(function (r) {
      if (r.status === 401) {
        // Token inválido/expirado — hard logout (sem refresh; sessão não revive).
        // NÃO redirecionar aqui: o redirect é o passo 4 do contrato, feito por hardLogout
        // DEPOIS do revoke + wipe. Redirect imediato abortaria a cadeia (unload) e criaría loop.
        if (typeof window.hardLogout === 'function') window.hardLogout('401');
        throw new Error('Sessão expirada');
      }
      if (!r.ok) return r.json().then(function (e) { throw new Error(e.error || 'Erro ' + r.status); });
      return r.json();
    }).finally(function () {
      if (!skip && typeof hideLoading === 'function') hideLoading();
    });
  }
  window.api = api;

  // Sidebar Navigation
  var navSections = [
    { title: 'Visão Geral', items: [{ id: 'dashboard', icon: 'fa-chart-line', label: 'Dashboard' }] },
    { title: 'Administração', items: [
      { id: 'usuarios', icon: 'fa-users', label: 'Usuários' },
      { id: 'senhas', icon: 'fa-key', label: 'Gerenciar Senhas' },
      { id: 'registros', icon: 'fa-scroll', label: 'Registros' },
    ]},
    { title: 'Organização', items: [
      { id: 'clientes', icon: 'fa-user-tie', label: 'Clientes' },
      { id: 'empresas', icon: 'fa-store', label: 'Empresas' },
      { id: 'filiais', icon: 'fa-sitemap', label: 'Empresas Filiais' },
    ]},
    { title: 'Financeiro', items: [
      { id: 'settlements', icon: 'fa-dollar-sign', label: 'Settlements' },
      { id: 'billing', icon: 'fa-credit-card', label: 'Billing' },
      { id: 'integracoes', icon: 'fa-plug', label: 'Integrações' },
    ]},
  ];

  function renderSaNav() {
    var nav = document.getElementById('saNav');
    if (!nav) return;
    nav.innerHTML = '';
    navSections.forEach(function (sec) {
      var wrap = document.createElement('div');
      wrap.className = 'sa-section open';
      wrap.innerHTML =
        '<button class="sa-section-head"><span class="lbl">' + sec.title + '</span><i class="fas fa-chevron-right chev"></i></button>' +
        '<div class="sa-items">' +
        sec.items.map(function (it) {
          return '<div class="sa-item" data-tab="' + it.id + '" title="' + it.label + '"><i class="fas ' + it.icon + '"></i><span class="lbl">' + it.label + '</span></div>';
        }).join('') +
        '</div>';
      nav.appendChild(wrap);
    });
    nav.querySelectorAll('.sa-section-head').forEach(function (btn) {
      btn.addEventListener('click', function () { btn.closest('.sa-section').classList.toggle('open'); });
    });
    nav.querySelectorAll('.sa-item').forEach(function (item) {
      item.addEventListener('click', function () {
        nav.querySelectorAll('.sa-item').forEach(function (i) { i.classList.remove('active'); });
        item.classList.add('active');
        switchTab(item.dataset.tab);
        if (window.innerWidth <= 820) closeSaDrawer();
      });
    });
    var first = nav.querySelector('.sa-item');
    if (first) first.classList.add('active');
  }

  // Sidebar Collapse
  var saSidebar = document.getElementById('saSidebar');
  var saCollapseBtn = document.getElementById('saCollapseBtn');
  var saExpandBtn = document.getElementById('saExpandBtn');
  var saOverlay = document.getElementById('saOverlay');

  if (saCollapseBtn) {
    saCollapseBtn.addEventListener('click', function () {
      saSidebar.classList.toggle('collapsed');
      var icon = saCollapseBtn.querySelector('i');
      icon.classList.toggle('fa-bars');
      icon.classList.toggle('fa-angles-right');
    });
  }
  if (saExpandBtn) {
    saExpandBtn.addEventListener('click', function () {
      saSidebar.classList.remove('collapsed');
      var icon = saCollapseBtn.querySelector('i');
      icon.classList.add('fa-bars');
      icon.classList.remove('fa-angles-right');
    });
  }

  function openSaDrawer() { if (saSidebar) saSidebar.classList.add('open'); if (saOverlay) saOverlay.classList.add('show'); }
  function closeSaDrawer() { if (saSidebar) saSidebar.classList.remove('open'); if (saOverlay) saOverlay.classList.remove('show'); }
  window.closeSaDrawer = closeSaDrawer;

  var saMobileToggle = document.querySelector('.sa-mobile-toggle');
  if (saMobileToggle) saMobileToggle.addEventListener('click', openSaDrawer);
  if (saOverlay) saOverlay.addEventListener('click', closeSaDrawer);

  renderSaNav();

  function switchTab(tab) {
    document.querySelectorAll('.tab').forEach(function (t) { t.classList.remove('active'); });
    document.querySelectorAll('.tab-content').forEach(function (c) { c.classList.remove('active'); });
    var map = { dashboard: 'tabDashboard', usuarios: 'tabUsuarios', senhas: 'tabSenhas', empresas: 'tabEmpresas', filiais: 'tabFiliais', registros: 'tabRegistros', clientes: 'tabClientes', settlements: 'tabSettlements', integracoes: 'tabIntegracoes', billing: 'tabBilling' };
    var el = document.getElementById(map[tab]);
    if (el) el.classList.add('active');
    if (tab === 'registros' && window.superadminAudit) superadminAudit.carregarAudit(1);
    if (tab === 'clientes') carregarClientes();
    if (tab === 'empresas') carregarEmpresas();
    if (tab === 'filiais') { carregarFiliais(); try { if (typeof window.popularDataCiclo === 'function') window.popularDataCiclo(); } catch (e) {} }
    if (tab === 'billing' && window.loadBillingDashboard) loadBillingDashboard();
    if (tab === 'settlements') carregarSettlements();
    if (tab === 'integracoes' && window.SuperIntegracoes) SuperIntegracoes.carregar();
  }
  window.switchTab = switchTab;

  var filtroSelect = document.getElementById('filtroEmpresaClientes');
  if (filtroSelect) filtroSelect.addEventListener('change', function () { window.filtrarClientes(); });

  var filtroUsuariosSelect = document.getElementById('filtroEmpresaUsuarios');
  if (filtroUsuariosSelect) filtroUsuariosSelect.addEventListener('change', function () { window.filtrarUsuarios(); });

  var usuariosEmpresas = [];
  var usuariosEmpresaMap = {};

  async function carregarUsuarios() {
    var tbody = document.getElementById('userTableBody');
    var select = document.getElementById('userSelect');
    select.innerHTML = '<option value="">Selecione um usuário</option>';
    try {
      var [usuarios, empresas] = await Promise.all([api('/usuarios', { skipLoading: true }), api('/admin', { skipLoading: true })]);
      usuariosEmpresas = usuarios || [];
      usuariosEmpresaMap = {};
      (empresas || []).forEach(function(e) { usuariosEmpresaMap[e.id] = e.nome; });

      // Populate filter select
      var filtroSelect = document.getElementById('filtroEmpresaUsuarios');
      if (filtroSelect && empresas && empresas.length > 0) {
        var prevFiltro = filtroSelect.value;
        filtroSelect.innerHTML = '<option value="">Todas as empresas</option>';
        empresas.forEach(function(e) {
          filtroSelect.innerHTML += '<option value="' + e.id + '">' + escapeHtml(e.nome || '-') + '</option>';
        });
        if (prevFiltro) filtroSelect.value = prevFiltro;
      }

      renderUsuarios(usuariosEmpresas, usuariosEmpresaMap);
    } catch (e) {
      tbody.innerHTML = '<tr><td colspan="6" style="color:#94a3b8;text-align:center;">Erro ao carregar usuários</td></tr>';
    }
  }

  function renderUsuarios(lista, empresaMap) {
    var tbody = document.getElementById('userTableBody');
    if (!lista || lista.length === 0) {
      tbody.innerHTML = '<tr><td colspan="6" style="color:#94a3b8;text-align:center;">Nenhum usuário cadastrado</td></tr>';
      return;
    }
    var roleLabels = { superadmin: 'Super Admin', admin: 'Admin', user: 'Usuário' };
    tbody.innerHTML = '';
    lista.forEach(function (u) {
      var roleClass = u.role === 'superadmin' ? ' style="color:#f97316;font-weight:700;"' : '';
      var usernameEsc = escapeHtml(u.username);
      var empresaNome = empresaMap[u.empresaId] || '—';
      tbody.innerHTML += '<tr><td><strong>' + usernameEsc + '</strong></td><td' + roleClass + '>' + (roleLabels[u.role] || escapeHtml(u.role)) + '</td><td>' + escapeHtml(empresaNome) + '</td><td>' + escapeHtml(u.lojaNome || '-') + '</td><td>' + (u.createdAt ? new Date(u.createdAt).toLocaleDateString('pt-BR') : '-') + '</td><td><button class="btn btn-danger btn-sm" aria-label="Excluir usuário" data-action="excluirUsuarioAction" data-id="' + u.id + '"><i class="fas fa-trash"></i></button></td></tr>';
    });
    // Also update password select
    var select = document.getElementById('userSelect');
    if (select) {
      select.innerHTML = '<option value="">Selecione um usuário</option>';
      lista.forEach(function (u) {
        select.innerHTML += '<option value="' + u.id + '">' + escapeHtml(u.username) + '</option>';
      });
    }
  }

  window.filtrarUsuarios = function() {
    var emp = document.getElementById('filtroEmpresaUsuarios').value;
    if (!emp) { renderUsuarios(usuariosEmpresas, usuariosEmpresaMap); return; }
    var empNum = Number(emp);
    renderUsuarios(usuariosEmpresas.filter(function(u) { return u.empresaId === empNum; }), usuariosEmpresaMap);
  };

  window.cadastrarUsuario = async function () {
    var username = document.getElementById('newUsername').value.trim();
    var password = document.getElementById('newPassword').value.trim();
    var role = document.getElementById('newRole').value;
    var empresaId = document.getElementById('newEmpresa').value;
    if (!username || !password) { toast('Preencha todos os campos', 'danger'); return; }
    if (password.length < 6) { toast('Senha deve ter 6+ caracteres', 'danger'); return; }
    if (role !== 'superadmin' && !empresaId) { toast('Selecione a empresa da conta', 'danger'); return; }
    if (role === 'superadmin' && !(await confirmModal('ATENÇÃO: você está criando um Super Admin com acesso total ao sistema. Confirma?'))) return;
    try {
      await api('/usuarios', { method: 'POST', body: JSON.stringify({ username: username, password: password, lojaNome: username, role: role, empresaId: empresaId ? Number(empresaId) : null }) });
      document.getElementById('newUsername').value = '';
      document.getElementById('newPassword').value = '';
      document.getElementById('newRole').value = 'user';
      toast('Usuário ' + username + ' cadastrado!');
      carregarUsuarios();
    } catch (e) {
      toast(e.message || 'Erro ao cadastrar', 'danger');
    }
  };

  window.excluirUsuario = async function (id) {
    var username = 'este usuário';
    try {
      var usuarios = await api('/usuarios');
      var u = usuarios.find(function (x) { return x.id === id; });
      if (u && u.username) username = u.username;
    } catch (e) { /* segue com genérico */ }
    if (!(await confirmModal('Excluir usuário ' + username + '?'))) return;
    try {
      await api('/usuarios/' + id, { method: 'DELETE' });
      toast('Usuário ' + username + ' removido', 'danger');
      carregarUsuarios();
    } catch (e) {
      toast('Erro ao remover', 'danger');
    }
  };

  window.alterarSenha = async function () {
    var select = document.getElementById('userSelect');
    var pass = document.getElementById('newPassInput').value.trim();
    var pass2 = document.getElementById('newPassConfirm').value.trim();
    if (!select.value) { toast('Selecione um usuário', 'danger'); return; }
    if (!pass || pass.length < 6) { toast('Senha deve ter 6+ caracteres', 'danger'); return; }
    if (pass !== pass2) { toast('Senhas não conferem', 'danger'); return; }
    try {
      await api('/usuarios/' + select.value + '/password', { method: 'PUT', body: JSON.stringify({ password: pass }) });
      document.getElementById('newPassInput').value = '';
      document.getElementById('newPassConfirm').value = '';
      toast('Senha alterada com sucesso!');
    } catch (e) {
      toast(e.message || 'Erro ao alterar senha', 'danger');
    }
  };

  var clienteEditandoId = null;
  var clienteSenhaId = null;

  var todosClientes = [];

  async function carregarClientes() {
    var tbody = document.getElementById('clientesTableBody');
    var select = document.getElementById('filtroEmpresaClientes');
    try {
      var [clientes, empresas] = await Promise.all([api('/admin/clientes'), api('/admin')]);
      todosClientes = clientes || [];
      if (empresas && empresas.length > 0) {
        var prev = select.value;
        select.innerHTML = '<option value="">Todas as empresas</option>';
        empresas.forEach(function (e) {
          select.innerHTML += '<option value="' + e.id + '">' + escapeHtml(e.nome || '-') + '</option>';
        });
        if (prev) select.value = prev;
      }
      renderClientes(todosClientes);
    } catch (e) {
      tbody.innerHTML = '<tr><td colspan="6" style="color:#dc2626;text-align:center;">Erro ao carregar clientes: ' + e.message + '</td></tr>';
    }
  }

  function renderClientes(lista) {
    var tbody = document.getElementById('clientesTableBody');
    if (!lista || lista.length === 0) {
      tbody.innerHTML = '<tr><td colspan="6" style="color:#94a3b8;text-align:center;">Nenhum cliente cadastrado</td></tr>';
      return;
    }
    tbody.innerHTML = '';
    lista.forEach(function (c) {
      tbody.innerHTML += '<tr>'
        + '<td><strong>' + escapeHtml(c.nome || '-') + '</strong></td>'
        + '<td>' + escapeHtml(c.telefone || '-') + '</td>'
        + '<td>' + escapeHtml(c.bairro || '-') + '</td>'
        + '<td>' + escapeHtml(c.empresaNome || '-') + '</td>'
        + '<td>' + (c.createdAt ? new Date(c.createdAt).toLocaleDateString('pt-BR') : '-') + '</td>'
        + '<td style="white-space:nowrap;">'
        + '<button class="btn btn-primary btn-sm" aria-label="Editar cliente" data-action="abrirModalEditarAction" data-id="' + c.id + '"><i class="fas fa-pen"></i></button> '
        + '<button class="btn btn-secondary btn-sm" aria-label="Trocar senha" data-action="abrirModalSenhaAction" data-id="' + c.id + '"><i class="fas fa-key"></i></button> '
        + '<button class="btn btn-danger btn-sm" aria-label="Excluir cliente" data-action="excluirClienteAction" data-id="' + c.id + '"><i class="fas fa-trash"></i></button>'
        + '</td></tr>';
    });
  }

  window.filtrarClientes = function () {
    var emp = document.getElementById('filtroEmpresaClientes').value;
    if (!emp) { renderClientes(todosClientes); return; }
    var empNum = Number(emp);
    renderClientes(todosClientes.filter(function (c) { return Number(c.empresaId) === empNum; }));
  };

  window.abrirModalEditarAction = function (ds) { window.abrirModalEditar(Number(ds.id)); };
  window.abrirModalModalEditar = function (id) { window.abrirModalEditar(id); };

  window.abrirModalEditar = function (id) {
    clienteEditandoId = id;
    api('/admin/clientes').then(function (list) {
      var c = list.find(function (x) { return x.id === id; });
      if (!c) return;
      document.getElementById('editNome').value = c.nome || '';
      document.getElementById('editTelefone').value = c.telefone || '';
      document.getElementById('editEndereco').value = c.endereco || '';
      document.getElementById('editNumero').value = c.numero || '';
      document.getElementById('editBairro').value = c.bairro || '';
      document.getElementById('editCep').value = c.cep || '';
      document.getElementById('editPontoReferencia').value = c.pontoReferencia || '';
      document.getElementById('modalEditarCliente').style.display = 'flex';
    }).catch(function (e) { toast(e.message || 'Erro ao carregar cliente', 'danger'); });
  };

  window.salvarEdicaoCliente = async function () {
    var body = {
      nome: document.getElementById('editNome').value.trim(),
      telefone: document.getElementById('editTelefone').value.trim(),
      endereco: document.getElementById('editEndereco').value.trim(),
      numero: document.getElementById('editNumero').value.trim(),
      bairro: document.getElementById('editBairro').value.trim(),
      cep: document.getElementById('editCep').value.trim(),
      pontoReferencia: document.getElementById('editPontoReferencia').value.trim(),
    };
    if (!body.nome) { toast('Nome é obrigatório', 'danger'); return; }
    try {
      await api('/admin/clientes/' + clienteEditandoId, { method: 'PUT', body: JSON.stringify(body) });
      fecharModal('modalEditarCliente');
      toast('Cliente atualizado!');
      carregarClientes();
    } catch (e) {
      toast(e.message || 'Erro ao salvar', 'danger');
    }
  };

  window.abrirModalSenhaAction = function (ds) { window.abrirModalSenha(Number(ds.id)); };

  window.abrirModalSenha = function (id) {
    clienteSenhaId = id;
    document.getElementById('novaSenhaCliente').value = '';
    document.getElementById('confirmarSenhaCliente').value = '';
    document.getElementById('modalSenhaCliente').style.display = 'flex';
  };

  window.salvarSenhaCliente = async function () {
    var senha = document.getElementById('novaSenhaCliente').value.trim();
    var senha2 = document.getElementById('confirmarSenhaCliente').value.trim();
    if (!senha || senha.length < 6) { toast('Senha deve ter 6+ caracteres', 'danger'); return; }
    if (senha !== senha2) { toast('Senhas não conferem', 'danger'); return; }
    try {
      await api('/admin/clientes/' + clienteSenhaId + '/password', { method: 'PUT', body: JSON.stringify({ password: senha }) });
      fecharModal('modalSenhaCliente');
      toast('Senha alterada com sucesso!');
    } catch (e) {
      toast(e.message || 'Erro ao alterar senha', 'danger');
    }
  };

  window.excluirClienteAction = function (ds) { window.excluirCliente(Number(ds.id)); };

  window.excluirCliente = async function (id) {
    var ok = await confirmModal('Excluir a conta deste cliente? Dados pessoais serão removidos (pedidos retidos por obrigação fiscal).');
    if (!ok) return;
    try {
      await api('/admin/clientes/' + id, { method: 'DELETE' });
      toast('Conta de cliente excluída', 'danger');
      carregarClientes();
    } catch (e) {
      toast(e.message || 'Erro ao excluir', 'danger');
    }
  };

  function fecharModal(id) { document.getElementById(id).style.display = 'none'; }
  window.fecharModal = fecharModal;

  async function carregarEmpresas() {
    var tbody = document.getElementById('empresasTableBody');
    try {
      var empresas = await api('/admin');
      if (!empresas || empresas.length === 0) {
        tbody.innerHTML = '<tr><td colspan="9" style="color:#94a3b8;text-align:center;">Nenhuma empresa cadastrada</td></tr>';
        return;
      }
      tbody.innerHTML = '';
      var newEmpresa = document.getElementById('newEmpresa');
      newEmpresa.innerHTML = '<option value="">— selecionar empresa —</option>';
      empresas.forEach(function (e) {
        var created = e.createdAt ? new Date(e.createdAt).toLocaleDateString('pt-BR') : '-';
        var count = e._count || {};
        var nomeEsc = escapeHtml(e.nome || '-');
        newEmpresa.innerHTML += '<option value="' + e.id + '">' + escapeHtml(e.nome) + ' (' + escapeHtml(e.slug) + ')</option>';
        tbody.innerHTML += '<tr>'
          + '<td><strong>' + nomeEsc + '</strong></td>'
          + '<td><code style="background:#334155;padding:2px 6px;border-radius:4px;font-size:0.8rem;">' + escapeHtml(e.slug || '-') + '</code></td>'
          + '<td>' + escapeHtml(e.telefone || '-') + '</td>'
          + '<td>' + escapeHtml(e.cidade || '-') + '</td>'
          + '<td>' + (e.asaasOnboarded ? '<i class="fas fa-circle" style="color:#10b981;" title="Onboarded"></i>' : '<i class="fas fa-circle" style="color:#6b7280;" title="Não onboarded"></i>') + '</td>'
          + '<td>' + (count.produtos || 0) + '</td>'
          + '<td>' + (count.pedidos || 0) + '</td>'
          + '<td>' + created + '</td>'
          + '<td style="white-space:nowrap;">'
          + '<button class="btn btn-primary btn-sm" aria-label="Editar empresa" data-action="abrirModalEditarEmpresaAction" data-id="' + e.id + '"><i class="fas fa-pen"></i></button> '
          + '<button class="btn btn-danger btn-sm" aria-label="Excluir empresa" data-action="excluirEmpresaAction" data-id="' + e.id + '"><i class="fas fa-trash"></i></button>'
          + '</td></tr>';
      });
    } catch (e) {
      tbody.innerHTML = '<tr><td colspan="9" style="color:#dc2626;text-align:center;">Erro ao carregar empresas: ' + e.message + '</td></tr>';
    }
  }

  window.cadastrarEmpresa = async function () {
    var nome = document.getElementById('empNome').value.trim();
    var slug = document.getElementById('empSlug').value.trim();
    var telefone = document.getElementById('empTelefone').value.trim();
    var cidade = document.getElementById('empCidade').value.trim();
    if (!nome || !slug) { toast('Nome e slug são obrigatórios', 'danger'); return; }
    try {
      await api('/admin', { method: 'POST', body: JSON.stringify({ nome: nome, slug: slug, telefone: telefone, cidade: cidade }) });
      document.getElementById('empNome').value = '';
      document.getElementById('empSlug').value = '';
      document.getElementById('empTelefone').value = '';
      document.getElementById('empCidade').value = '';
      toast('Empresa ' + nome + ' cadastrada!');
      carregarEmpresas();
    } catch (e) {
      toast(e.message || 'Erro ao cadastrar', 'danger');
    }
  };

  window.abrirModalEditarEmpresaAction = function (ds) { window.abrirModalEditarEmpresa(Number(ds.id)); };

  window.abrirModalEditarEmpresa = async function (id) {
    try {
      var empresas = await api('/admin');
      var emp = empresas.find(function (e) { return e.id === id; });
      if (!emp) return;
      document.getElementById('editEmpId').value = emp.id;
      document.getElementById('editEmpNome').value = emp.nome || '';
      document.getElementById('editEmpSlug').value = emp.slug || '';
      document.getElementById('editEmpTelefone').value = emp.telefone || '';
      document.getElementById('editEmpEndereco').value = emp.endereco || '';
      document.getElementById('editEmpNumero').value = emp.numero || '';
      document.getElementById('editEmpBairro').value = emp.bairro || '';
      document.getElementById('editEmpCep').value = emp.cep || '';
      document.getElementById('editEmpCidade').value = emp.cidade || '';
      document.getElementById('editEmpEstado').value = emp.estado || '';
      document.getElementById('editEmpDescricao').value = emp.descricao || '';

      var ps = document.getElementById('paymentSection');
      if (emp.asaasOnboarded) {
        ps.style.display = 'block';
        document.getElementById('paymentStatusIcon').innerHTML = '<i class="fas fa-circle" style="color:#10b981;"></i> Ativo';
        document.getElementById('paymentWalletId').textContent = emp.asaasWalletId || '—';
        document.getElementById('paymentSubcontaId').textContent = emp.asaasSubcontaId || '—';
        document.getElementById('paymentOnboardedAt').textContent = emp.asaasCreatedAt ? new Date(emp.asaasCreatedAt).toLocaleDateString('pt-BR') : '—';
      } else {
        ps.style.display = 'block';
        document.getElementById('paymentStatusIcon').innerHTML = '<i class="fas fa-circle" style="color:#6b7280;"></i> Inativo';
        document.getElementById('paymentWalletId').textContent = '—';
        document.getElementById('paymentSubcontaId').textContent = '—';
        document.getElementById('paymentOnboardedAt').textContent = '—';
      }

      var settleDiv = document.getElementById('paymentSettlements');
      settleDiv.innerHTML = '<em style="color:#94a3b8;">Carregando settlements...</em>';
      try {
        var setData = await api('/empresa/settlement/global?empresaId=' + id);
        var emps = (setData.settlements || []).slice(0, 5);
        if (emps.length === 0) {
          settleDiv.innerHTML = '<em style="color:#94a3b8;">Nenhum settlement</em>';
        } else {
          var html = '<strong style="display:block;margin-bottom:4px;">Últimos settlements:</strong>';
          html += '<table style="width:100%;font-size:0.8rem;border-collapse:collapse;">';
          html += '<tr style="color:#94a3b8;"><th style="text-align:left;padding:2px 4px;">Período</th><th style="text-align:left;padding:2px 4px;">Split</th><th style="text-align:left;padding:2px 4px;">Transfer</th></tr>';
          emps.forEach(function (s) {
            var period = new Date(s.weekStart).toLocaleDateString('pt-BR') + ' - ' + new Date(s.weekEnd).toLocaleDateString('pt-BR');
            var splitColor = s.splitStatus === 'auto' ? '#10b981' : s.splitStatus === 'manual' ? '#f59e0b' : '#6b7280';
            var transferColor = s.transferStatus === 'scheduled' ? '#10b981' : s.transferStatus === 'completed' ? '#10b981' : '#6b7280';
            html += '<tr style="border-top:1px solid #334155;">';
            html += '<td style="padding:2px 4px;">' + period + '</td>';
            html += '<td style="padding:2px 4px;color:' + splitColor + ';">' + (s.splitStatus || '—') + '</td>';
            html += '<td style="padding:2px 4px;color:' + transferColor + ';">' + (s.transferStatus || '—') + '</td>';
            html += '</tr>';
          });
          html += '</table>';
          settleDiv.innerHTML = html;
        }
      } catch (err) {
        settleDiv.innerHTML = '<em style="color:#ef4444;">Erro ao carregar settlements</em>';
      }

      document.getElementById('modalEditarEmpresa').style.display = 'flex';
    } catch (e) { toast(e.message || 'Erro ao carregar', 'danger'); }
  };

  window.salvarEdicaoEmpresa = async function () {
    var id = document.getElementById('editEmpId').value;
    var body = {
      nome: document.getElementById('editEmpNome').value.trim(),
      slug: document.getElementById('editEmpSlug').value.trim(),
      telefone: document.getElementById('editEmpTelefone').value.trim(),
      endereco: document.getElementById('editEmpEndereco').value.trim(),
      numero: document.getElementById('editEmpNumero').value.trim(),
      bairro: document.getElementById('editEmpBairro').value.trim(),
      cep: document.getElementById('editEmpCep').value.trim(),
      cidade: document.getElementById('editEmpCidade').value.trim(),
      estado: document.getElementById('editEmpEstado').value.trim(),
      descricao: document.getElementById('editEmpDescricao').value.trim(),
    };
    if (!body.nome) { toast('Nome é obrigatório', 'danger'); return; }
    try {
      await api('/admin/' + id, { method: 'PUT', body: JSON.stringify(body) });
      fecharModal('modalEditarEmpresa');
      toast('Empresa atualizada!');
      carregarEmpresas();
    } catch (e) {
      toast(e.message || 'Erro ao salvar', 'danger');
    }
  };

  window.desativarSplit = async function () {
    var id = document.getElementById('editEmpId').value;
    if (!(await confirmModal('Desativar Split desta empresa? O onboarding Asaas será removido.'))) return;
    try {
      await api('/admin/empresa/' + id + '/payment', { method: 'DELETE' });
      toast('Split desativado', 'warning');
      fecharModal('modalEditarEmpresa');
      carregarEmpresas();
    } catch (e) {
      toast(e.message || 'Erro ao desativar', 'danger');
    }
  };

  window.excluirEmpresaAction = function (ds) { window.excluirEmpresa(Number(ds.id)); };

  window.excluirEmpresa = async function (id) {
    var nome = 'esta empresa';
    try {
      var empresas = await api('/admin');
      var emp = empresas.find(function (e) { return e.id === id; });
      if (emp && emp.nome) nome = emp.nome;
    } catch (e) { /* segue com nome genérico */ }
    if (!(await confirmModal('Excluir empresa ' + nome + '? Todos os dados vinculados serão protegidos de exclusão (409 se houver dados).'))) return;
    try {
      await api('/admin/' + id, { method: 'DELETE' });
      toast('Empresa removida', 'danger');
      carregarEmpresas();
    } catch (e) {
      toast(e.message || 'Erro ao remover', 'danger');
    }
  };

  window.excluirUsuarioAction = function (ds) { window.excluirUsuario(Number(ds.id)); };

  function activarTabPorQuery() {
    var p = new URLSearchParams(window.location.search);
    var tab = p.get('tab');
    if (tab && ['dashboard', 'usuarios', 'senhas', 'clientes', 'registros', 'empresas', 'filiais', 'settlements', 'integracoes', 'billing'].includes(tab)) {
      switchTab(tab);
    }
  }

  carregarUsuarios();
  carregarClientes();
  carregarEmpresas();
  activarTabPorQuery();

  async function carregarSettlements() {
    try {
      var data = await api('/empresa/settlement/global');
      var tbody = document.getElementById('settlementsTableBody');
      if (!data.settlements || !data.settlements.length) {
        tbody.innerHTML = '<tr><td colspan="6" style="text-align:center;color:var(--text-muted)">Nenhum settlement encontrado</td></tr>';
        return;
      }
      var statusColors = { processando: '#F59E0B', pendente: '#3B82F6', pago: '#10B981', erro: '#EF4444' };
      tbody.innerHTML = data.settlements.map(function (s) {
        var empresa = s.empresa ? escapeHtml(s.empresa.nome) : 'ID ' + s.empresaId;
        var periodo = new Date(s.weekStart).toLocaleDateString('pt-BR') + ' - ' + new Date(s.weekEnd).toLocaleDateString('pt-BR');
        var cor = statusColors[s.status] || '#666';
        return '<tr><td><strong>' + empresa + '</strong></td><td>' + periodo + '</td><td>' + s.totalPedidos + '</td><td>R$ ' + Number(s.totalBruto).toFixed(2) + '</td><td>R$ ' + Number(s.totalLiquido).toFixed(2) + '</td><td style="color:' + cor + ';font-weight:600">' + s.status + '</td></tr>';
      }).join('');
    } catch (e) {
      console.error('Erro ao carregar settlements', e);
    }
  }

  // Bridge functions for data-action handlers
  window.carregarDashboardAction = function () {
    if (typeof carregarDashboard === 'function') carregarDashboard();
  };

  window.fecharModalAction = function (ds) {
    var modalId = ds && ds.modal ? ds.modal : null;
    if (modalId) fecharModal(modalId);
  };

  window.cadastrarUsuarioAction = function (ds) {
    if (typeof window.cadastrarUsuario === 'function') return window.cadastrarUsuario(ds);
    console.warn('[delegator] handler not ready:', 'cadastrarUsuarioAction');
  };
  window.alterarSenhaAction = function (ds) {
    if (typeof window.alterarSenha === 'function') return window.alterarSenha(ds);
    console.warn('[delegator] handler not ready:', 'alterarSenhaAction');
  };
  window.salvarEdicaoClienteAction = function (ds) {
    if (typeof window.salvarEdicaoCliente === 'function') return window.salvarEdicaoCliente(ds);
    console.warn('[delegator] handler not ready:', 'salvarEdicaoClienteAction');
  };
  window.salvarSenhaClienteAction = function (ds) {
    if (typeof window.salvarSenhaCliente === 'function') return window.salvarSenhaCliente(ds);
    console.warn('[delegator] handler not ready:', 'salvarSenhaClienteAction');
  };
  window.cadastrarEmpresaAction = function (ds) {
    if (typeof window.cadastrarEmpresa === 'function') return window.cadastrarEmpresa(ds);
    console.warn('[delegator] handler not ready:', 'cadastrarEmpresaAction');
  };
  window.salvarEdicaoEmpresaAction = function (ds) {
    if (typeof window.salvarEdicaoEmpresa === 'function') return window.salvarEdicaoEmpresa(ds);
    console.warn('[delegator] handler not ready:', 'salvarEdicaoEmpresaAction');
  };
  window.desativarSplitAction = function (ds) {
    if (typeof window.desativarSplit === 'function') return window.desativarSplit(ds);
    console.warn('[delegator] handler not ready:', 'desativarSplitAction');
  };
  window.savePricingAction = function (ds) {
    if (typeof window.savePricing === 'function') return window.savePricing(ds);
    console.warn('[delegator] handler not ready:', 'savePricingAction (superadminBilling.js loaded?)');
  };

  // External scripts (superadminDashboard.js, superadminBilling.js) define:
  // onEmpresaChange, carregarDashboard, savePricing, abrirModalCriarFilial, criarFilial
})();
  // re-init por mount (loadScriptOnce pula re-eval em visitas seguintes)
  try { if (window.initPasswordToggles) window.initPasswordToggles(); } catch (e) {}
  try { audit.init(); } catch (e) {}
  try { if (window.autoLoadDashboard) window.autoLoadDashboard(); } catch (e) {}
  return cleanup;
}
function cleanup() {
  _cleanups.splice(0).forEach(function (f) { try { f(); } catch (e) {} });
  if (_abort) { _abort.abort(); _abort = null; }
}
export function unmount() { cleanup(); }
