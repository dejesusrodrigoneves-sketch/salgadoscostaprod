// js/filialPricingOverlay.js
// Overlay de consentimento de reajuste de preço filial (§36.3).
// Consome GET /api/admin/filial-pricing/status; ações accept/reject.
(function() {
  const KEY_PREFIX = 'filial-pricing-overlay:';

  function getAuthUser() {
    try {
      return JSON.parse(localStorage.getItem('authUser') || '{}');
    } catch { return {}; }
  }

  function fmtCurrency(v) {
    return 'R$ ' + Number(v || 0).toFixed(2).replace('.', ',');
  }

  function fmtDate(d) {
    if (!d) return '—';
    const dt = new Date(d);
    if (isNaN(dt.getTime())) return '—';
    return dt.toLocaleDateString('pt-BR');
  }

  async function checkAndShow() {
    const authUser = getAuthUser();
    // Apenas admin (filial ou matriz logada como admin)
    if (!authUser.token || authUser.role !== 'admin') return;

    let data;
    try {
      const res = await fetch((window.getApiBase?window.getApiBase():'') + '/api/admin/filial-pricing/status', {
        headers: { 'Authorization': 'Bearer ' + authUser.token }
      });
      if (!res.ok) return; // 401/403/409/500 — skip sem barulho
      data = await res.json();
    } catch (e) {
      console.error('Filial pricing overlay error:', e);
      return;
    }

    if (!data.needsConsent) return;

    // Session storage por versão: rejeitou ou adiou => não reaparece (até nova versão)
    const versao = data.versaoVigente;
    if (versao && sessionStorage.getItem(KEY_PREFIX + versao)) return;

    showOverlay(data);
  }

  function showOverlay(s) {
    const consequencia = s.motivo === 'aumento_nao_aceito_pos_vigencia'
      ? 'Um reajuste anterior não foi aceito a tempo. Filiais ativas foram suspensas até a regularização.'
      : 'Se rejeitar ou não responder até a vigência, filiais ativas poderão ser suspensas; acesso ficará bloqueado; dados serão preservados; matriz continuará pagando apenas a Base.';

    const termos = s.termosTexto
      || 'O valor mensal por filial (X) será atualizado. Leia as condições abaixo e escolha como proceder.';

    const versao = s.versaoVigente;

    const overlay = document.createElement('div');
    overlay.id = 'filialPricingOverlay';
    overlay.style.cssText = `
      position: fixed;
      top: 0; left: 0; right: 0; bottom: 0;
      background: rgba(0, 0, 0, 0.9);
      z-index: 10001;
      display: flex;
      justify-content: center;
      align-items: center;
      padding: 20px;
    `;

    overlay.innerHTML = `
      <div style="
        background: #191919;
        border-radius: 20px;
        padding: 32px;
        max-width: 520px;
        width: 100%;
        border: 1px solid #2a2a2a;
        max-height: 90vh;
        overflow-y: auto;
      ">
        <div style="font-size: 40px; text-align: center; margin-bottom: 12px;">📢</div>
        <h2 style="color: #FFFCE1; font-size: 19px; text-align: center; margin: 0 0 8px;">
          Atualização de Plano — Filiais
        </h2>
        <p style="color: #7C7C6F; font-size: 12px; text-align: center; margin: 0 0 20px;">
          Alteração do valor mensal por filial (X)
        </p>

        <div style="
          background: rgba(255, 252, 225, 0.06);
          border: 1px solid #2a2a2a;
          border-radius: 12px;
          padding: 16px;
          margin-bottom: 16px;
        ">
          <div style="color: #7C7C6F; font-size: 12px; margin-bottom: 6px;">Comunicado do administrador:</div>
          <div style="color: #FFFCE1; font-size: 14px; line-height: 1.6; white-space: pre-wrap;">${escapeHtml(termos)}</div>
        </div>

        <div style="
          background: #101010;
          border-radius: 12px;
          padding: 16px;
          margin-bottom: 16px;
          font-size: 13px;
        ">
          <div style="display: flex; justify-content: space-between; padding: 4px 0; color: #7C7C6F;">
            <span>Valor atual (X)</span>
            <span style="color: #FFFCE1;">${fmtCurrency(s.valorX)}</span>
          </div>
          <div style="display: flex; justify-content: space-between; padding: 4px 0; color: #7C7C6F;">
            <span>Valor proposto (Y)</span>
            <span style="color: #F26D3D; font-weight: 700;">${fmtCurrency(s.valorY)}</span>
          </div>
          <div style="display: flex; justify-content: space-between; padding: 4px 0; color: #7C7C6F;">
            <span>Base de mensalidade</span>
            <span style="color: #FFFCE1;">${fmtCurrency(s.baseMensalidade)}</span>
          </div>
          <div style="display: flex; justify-content: space-between; padding: 4px 0; color: #7C7C6F;">
            <span>Nº de filiais ativas</span>
            <span style="color: #FFFCE1;">${s.nFiliaisAtivas}</span>
          </div>
          <div style="border-top: 1px solid #242424; margin: 8px 0;"></div>
          <div style="display: flex; justify-content: space-between; padding: 4px 0;">
            <span style="color: #7C7C6F;">Mensalidade atual</span>
            <span style="color: #FFFCE1; font-weight: 600;">${fmtCurrency(s.mensalidadeAtual)}</span>
          </div>
          <div style="display: flex; justify-content: space-between; padding: 4px 0;">
            <span style="color: #7C7C6F;">Mensalidade projetada <span style="color: #666; font-size: 11px;">(estimativa)</span></span>
            <span style="color: #FFFCE1; font-weight: 600;">${fmtCurrency(s.mensalidadeProjetado)}</span>
          </div>
          <div style="display: flex; justify-content: space-between; padding: 4px 0; color: #7C7C6F;">
            <span>Vigência</span>
            <span style="color: #FFFCE1;">${fmtDate(s.effectiveDate)}</span>
          </div>
        </div>

        <div style="
          background: rgba(242, 109, 61, 0.1);
          border: 1px solid rgba(242, 109, 61, 0.35);
          border-radius: 12px;
          padding: 14px;
          margin-bottom: 20px;
        ">
          <div style="color: #F26D3D; font-weight: 700; font-size: 13px; margin-bottom: 4px;">⚠️ Consequência</div>
          <div style="color: #FFE4D6; font-size: 12px; line-height: 1.6;">${consequencia}</div>
        </div>

        <button id="fpAcceptBtn" style="
          background: #2E9E63;
          color: white;
          border: none;
          padding: 14px 28px;
          border-radius: 12px;
          font-weight: 600;
          font-size: 14px;
          cursor: pointer;
          width: 100%;
          margin-bottom: 10px;
        ">Aceitar Alteração</button>
        <button id="fpRejectBtn" style="
          background: transparent;
          color: #F26D3D;
          border: 1px solid #F26D3D;
          padding: 12px 24px;
          border-radius: 12px;
          font-weight: 600;
          font-size: 13px;
          cursor: pointer;
          width: 100%;
          margin-bottom: 10px;
        ">Rejeitar</button>
        <button id="fpLaterBtn" style="
          background: transparent;
          color: #7C7C6F;
          border: 1px solid #333;
          padding: 12px 24px;
          border-radius: 12px;
          font-weight: 500;
          font-size: 13px;
          cursor: pointer;
          width: 100%;
        ">Decidir depois</button>
      </div>
    `;

    document.body.appendChild(overlay);

    function dismiss() {
      overlay.remove();
    }

    document.getElementById('fpAcceptBtn').addEventListener('click', async () => {
      try {
        const authUser = getAuthUser();
        const res = await fetch((window.getApiBase?window.getApiBase():'') + '/api/admin/filial-pricing/accept', {
          method: 'POST',
          headers: { 'Authorization': 'Bearer ' + authUser.token }
        });
        if (!res.ok) {
          const err = await res.json().catch(() => ({}));
          alert(err.error || 'Erro ao aceitar alteração.');
          return;
        }
        dismiss();
        location.reload();
      } catch (e) {
        console.error('Accept error:', e);
        alert('Erro ao aceitar alteração.');
      }
    });

    document.getElementById('fpRejectBtn').addEventListener('click', async () => {
      try {
        const authUser = getAuthUser();
        const res = await fetch((window.getApiBase?window.getApiBase():'') + '/api/admin/filial-pricing/reject', {
          method: 'POST',
          headers: { 'Authorization': 'Bearer ' + authUser.token }
        });
        if (!res.ok) {
          const err = await res.json().catch(() => ({}));
          alert(err.error || 'Erro ao rejeitar alteração.');
          return;
        }
        if (versao) sessionStorage.setItem(KEY_PREFIX + versao, 'rejected');
        dismiss();
      } catch (e) {
        console.error('Reject error:', e);
        alert('Erro ao rejeitar alteração.');
      }
    });

    document.getElementById('fpLaterBtn').addEventListener('click', () => {
      if (versao) sessionStorage.setItem(KEY_PREFIX + versao, 'later');
      dismiss();
    });

    overlay.addEventListener('click', (e) => {
      if (e.target === overlay) {
        if (versao) sessionStorage.setItem(KEY_PREFIX + versao, 'later');
        dismiss();
      }
    });
  }

  function escapeHtml(str) {
    return String(str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;');
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', checkAndShow);
  } else {
    checkAndShow();
  }
})();