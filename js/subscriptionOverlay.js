// js/subscriptionOverlay.js
(function() {
  const OVERLAY_KEY = 'subscriptionOverlayDismissed';
  const USER_KEY = 'lastOverlayUser';
  
  function getAuthUser() {
    try {
      return JSON.parse(localStorage.getItem('authUser') || '{}');
    } catch { return {}; }
  }
  
  function shouldShowOverlay() {
    const authUser = getAuthUser();
    const currentUsername = authUser.username;
    const lastUser = localStorage.getItem(USER_KEY);
    
    // Show if user changed
    if (currentUsername !== lastUser) {
      localStorage.removeItem(OVERLAY_KEY);
      localStorage.setItem(USER_KEY, currentUsername);
      return true;
    }
    
    // Show if not dismissed
    return !localStorage.getItem(OVERLAY_KEY);
  }
  
  async function checkSubscriptionAndShowOverlay() {
    const authUser = getAuthUser();
    if (!authUser.token || authUser.role === 'superadmin') return;
    
    try {
      const res = await fetch('/api/empresa/subscription/status', {
        headers: { 'Authorization': 'Bearer ' + authUser.token }
      });
      
      if (!res.ok) return;
      
      const data = await res.json();
      
      if (data.status === 'PAST_DUE' || data.status === 'SUSPENDED') {
        if (shouldShowOverlay()) {
          showOverlay(data);
        }
      }
    } catch (e) {
      console.error('Subscription overlay error:', e);
    }
  }
  
  function showOverlay(subscription) {
    const daysOverdue = subscription.daysOverdue || 0;
    const interest = subscription.interest || 0;
    const totalDue = subscription.totalDue || subscription.value;
    
    const overlay = document.createElement('div');
    overlay.id = 'subscriptionOverlay';
    overlay.style.cssText = `
      position: fixed;
      top: 0;
      left: 0;
      right: 0;
      bottom: 0;
      background: rgba(0, 0, 0, 0.9);
      z-index: 10000;
      display: flex;
      justify-content: center;
      align-items: center;
      padding: 20px;
    `;
    
    overlay.innerHTML = `
      <div style="
        background: #191919;
        border-radius: 20px;
        padding: 40px;
        max-width: 500px;
        width: 100%;
        text-align: center;
        border: 1px solid #2a2a2a;
      ">
        <div style="font-size: 48px; margin-bottom: 20px;">⚠️</div>
        <h2 style="color: #FFFCE1; font-size: 20px; margin-bottom: 16px;">
          Pagamento Pendente
        </h2>
        <p style="color: #7C7C6F; font-size: 14px; line-height: 1.6; margin-bottom: 24px;">
          Sua empresa está com pagamento pendente. Regularize para ter acesso novamente a todas as funções.
          Ficará suspensa apenas para leitura até o pagamento ser confirmado.
        </p>
        ${daysOverdue > 0 ? `
          <div style="
            background: rgba(242, 109, 61, 0.1);
            border: 1px solid rgba(242, 109, 61, 0.3);
            border-radius: 12px;
            padding: 16px;
            margin-bottom: 24px;
          ">
            <div style="color: #F26D3D; font-weight: 700; font-size: 14px;">
              ${daysOverdue} dias de atraso
            </div>
            <div style="color: #7C7C6F; font-size: 12px; margin-top: 4px;">
              Juros: R$ ${interest.toFixed(2)} (0,02%/dia)
            </div>
            <div style="color: #FFFCE1; font-weight: 700; font-size: 16px; margin-top: 8px;">
              Total: R$ ${totalDue.toFixed(2)}
            </div>
          </div>
        ` : ''}
        <button id="payNowBtn" style="
          background: #F26D3D;
          color: white;
          border: none;
          padding: 14px 28px;
          border-radius: 12px;
          font-weight: 600;
          font-size: 14px;
          cursor: pointer;
          width: 100%;
          margin-bottom: 12px;
        ">
          Gerar Link de Pagamento
        </button>
        <button id="dismissOverlayBtn" style="
          background: transparent;
          color: #7C7C6F;
          border: 1px solid #333;
          padding: 12px 24px;
          border-radius: 12px;
          font-weight: 500;
          font-size: 13px;
          cursor: pointer;
          width: 100%;
        ">
          Fechar
        </button>
      </div>
    `;
    
    document.body.appendChild(overlay);
    
    document.getElementById('payNowBtn').addEventListener('click', async () => {
      try {
        const authUser = getAuthUser();
        const res = await fetch('/api/empresa/subscription/pay', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': 'Bearer ' + authUser.token
          }
        });
        
        const data = await res.json();
        if (data.url) {
          window.open(data.url, '_blank');
        }
      } catch (e) {
        console.error('Pay error:', e);
      }
    });
    
    document.getElementById('dismissOverlayBtn').addEventListener('click', () => {
      overlay.remove();
      localStorage.setItem(OVERLAY_KEY, 'true');
    });
    
    overlay.addEventListener('click', (e) => {
      if (e.target === overlay) {
        overlay.remove();
        localStorage.setItem(OVERLAY_KEY, 'true');
      }
    });
  }
  
  // Run on DOM ready
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', checkSubscriptionAndShowOverlay);
  } else {
    checkSubscriptionAndShowOverlay();
  }
})();
