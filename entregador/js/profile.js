/**
 * Profile module for delivery driver app
 */
const EntregadorProfile = {
  async load() {
    const view = document.getElementById('perfilView');
    const loading = document.getElementById('loadingView');

    loading.classList.remove('hidden');
    view.classList.add('hidden');

    try {
      const perfil = await EntregadorAPI.getPerfil();
      loading.classList.add('hidden');

      view.innerHTML = this.render(perfil);
      view.classList.remove('hidden');

      // Bind events
      this.bindEvents(view, perfil);
    } catch (err) {
      loading.classList.add('hidden');
      view.innerHTML = `<div class="error-msg visible" style="display:block;">${err.message}</div>`;
      view.classList.remove('hidden');
    }
  },

  render(p) {
    const isDark = document.documentElement.getAttribute('data-theme') === 'dark';
    return `
      <div class="profile-header">
        <div class="profile-avatar"><i class="bi bi-person"></i></div>
        <div class="profile-name">${p.nome}</div>
        <div class="profile-phone">📱 ${p.telefone || ''}</div>
      </div>

      <div class="profile-section">
        <div class="profile-section-title">Dados Pessoais</div>
        <div class="input-group">
          <label for="whatsapp">WhatsApp</label>
          <input type="tel" id="whatsapp" value="${p.whatsapp || ''}" placeholder="(00) 00000-0000">
        </div>
        <div class="input-group">
          <label for="chavePix">Chave PIX</label>
          <input type="text" id="chavePix" value="${p.chavePix || ''}" placeholder="Sua chave PIX">
        </div>
        <button class="btn-primary" id="saveProfile" style="font-size:14px;">
          <i class="bi bi-check2"></i> Salvar Alterações
        </button>
      </div>

      <div class="profile-section">
        <div class="profile-section-title">Aparência</div>
        <div class="theme-switch">
          <span class="label">🌙 Modo escuro</span>
          <div class="toggle ${isDark ? 'on' : ''}" id="themeToggle">
            <div class="knob"></div>
          </div>
        </div>
      </div>

      <button class="btn-danger" id="logoutBtn">
        <i class="bi bi-box-arrow-right"></i> Sair
      </button>

      <div class="app-version">SIC.ia Entregador v1.0.0</div>
    `;
  },

  bindEvents(view, perfil) {
    // Save profile
    view.querySelector('#saveProfile').addEventListener('click', async () => {
      const whatsapp = view.querySelector('#whatsapp').value.replace(/\D/g, '');
      const chavePix = view.querySelector('#chavePix').value.trim();

      try {
        await EntregadorAPI.updatePerfil({ whatsapp, chavePix });
        this.showToast('Dados salvos!');
      } catch (err) {
        alert('Erro ao salvar: ' + err.message);
      }
    });

    // Theme toggle
    view.querySelector('#themeToggle').addEventListener('click', () => {
      const toggle = view.querySelector('#themeToggle');
      const isDark = document.documentElement.getAttribute('data-theme') === 'dark';
      const newTheme = isDark ? 'light' : 'dark';
      document.documentElement.setAttribute('data-theme', newTheme);
      localStorage.setItem('entregador_theme', newTheme);
      toggle.classList.toggle('on');
    });

    // Logout
    view.querySelector('#logoutBtn').addEventListener('click', () => {
      if (confirm('Deseja sair?')) {
        EntregadorAuth.logout();
      }
    });
  },

  showToast(msg) {
    const toast = document.createElement('div');
    toast.style.cssText = `
      position: fixed; bottom: 80px; left: 50%; transform: translateX(-50%);
      background: #059669; color: #fff; padding: 12px 24px; border-radius: 12px;
      font-size: 14px; font-weight: 600; z-index: 200; box-shadow: 0 4px 12px rgba(0,0,0,0.2);
    `;
    toast.textContent = msg;
    document.body.appendChild(toast);
    setTimeout(() => toast.remove(), 3000);
  },
};
