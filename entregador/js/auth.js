/**
 * Auth utilities for delivery driver app
 */
const EntregadorAuth = {
  isAuthenticated() {
    const token = localStorage.getItem('entregador_token');
    const expiry = localStorage.getItem('entregador_expiry');
    return token && expiry && Date.now() < Number(expiry);
  },

  getUser() {
    try {
      return JSON.parse(localStorage.getItem('entregador_user'));
    } catch {
      return null;
    }
  },

  mustChangePassword() {
    const user = this.getUser();
    return user?.mustChangePassword === true;
  },

  logout() {
    // Try to revoke token on server (fire and forget)
    const token = localStorage.getItem('entregador_token');
    const refresh = localStorage.getItem('entregador_refresh');
    if (token) {
      fetch('/api/auth/logout', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify({ refreshToken: refresh }),
      }).catch(() => {});
    }

    localStorage.removeItem('entregador_token');
    localStorage.removeItem('entregador_refresh');
    localStorage.removeItem('entregador_user');
    localStorage.removeItem('entregador_expiry');
    window.location.href = 'entregador-login.html';
  },

  // Check session validity, refresh if needed
  async checkSession() {
    const expiry = localStorage.getItem('entregador_expiry');
    if (!expiry) return false;

    const remaining = Number(expiry) - Date.now();
    if (remaining <= 0) {
      // Try refresh
      try {
        await EntregadorAPI.refreshToken();
        return true;
      } catch {
        this.logout();
        return false;
      }
    }

    // If less than 5 min remaining, try refresh
    if (remaining < 5 * 60 * 1000) {
      try {
        await EntregadorAPI.refreshToken();
      } catch {
        // Will expire soon, but don't logout yet
      }
    }

    return true;
  },
};
