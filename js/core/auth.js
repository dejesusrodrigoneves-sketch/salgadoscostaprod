// Sistema de autenticação — compatível com login.html existente
// Futuramente usará API REST (/api/auth/login)

const AUTH_KEY = 'authUser';

export function getAuthUser() {
  try { return JSON.parse(localStorage.getItem(AUTH_KEY) || 'null'); } catch { return null; }
}

export function setAuthUser(user) {
  localStorage.setItem(AUTH_KEY, JSON.stringify(user));
}

export function clearAuth() {
  localStorage.removeItem(AUTH_KEY);
}

export function isAuthenticated() {
  const u = getAuthUser();
  return !!(u && u.username);
}

export function isSuperadmin() {
  const u = getAuthUser();
  return u?.role === 'superadmin';
}

export function authGuard() {
  if (!isAuthenticated()) {
    window.location.replace('login.html');
    return false;
  }
  return true;
}

export function loginRedirect() {
  if (isAuthenticated()) {
    window.location.replace('dashboard.html');
    return true;
  }
  return false;
}
