// js/services/order-notifier.js — Singleton global de notificação de pedidos
// - Polling /api/pedidos contínuo
// - Detecta novos pedidos status="pendente"
// - Toca som (playNotification) + loop enquanto houver pendentes
// - Expõe callbacks para UI (badges, contadores, dados completos)

import { playNotification, loadNotifSound } from '../utils/audio.js';

let pollTimer = null;
let beepLoopTimer = null;
let beepLoopRunning = false;
let pedidosAtuais = [];
let pendentesAtuais = [];
let callbacks = [];
let dataCallbacks = [];
let isPolling = false;
const POLL_INTERVAL = 15000; // 15s
const BEEP_LOOP_INTERVAL = 3000; // 3s
const JANELA_CACHE_MS = 30000;

let _janelaCache = null;
let _janelaCacheTs = 0;

function authHeaders() {
  const headers = { 'Content-Type': 'application/json' };
  const au = JSON.parse(localStorage.getItem('authUser') || 'null');
  if (au && au.token) headers['Authorization'] = 'Bearer ' + au.token;
  return headers;
}

async function getJanelaDoDia() {
  const now = Date.now();
  if (_janelaCache && (now - _janelaCacheTs) < JANELA_CACHE_MS) return _janelaCache;

  const base = (window.getApiBase ? window.getApiBase() : '');
  let caixa = null;
  try {
    const r = await fetch(base + '/api/caixa/hoje', { headers: authHeaders() });
    if (r.ok) caixa = await r.json();
  } catch (e) { /* sem caixa → fallback dia UTC */ }

  let janela;
  if (caixa && caixa.status === 'aberto' && caixa.abertoEm) {
    janela = { createdAtFrom: caixa.abertoEm };
  } else if (caixa && caixa.abertoEm && caixa.fechadoEm) {
    janela = { createdAtFrom: caixa.abertoEm, createdAtTo: caixa.fechadoEm };
  } else {
    const diaUtc = new Date().toISOString().split('T')[0];
    janela = { createdAtFrom: new Date(diaUtc + 'T00:00:00Z').toISOString(), createdAtTo: new Date().toISOString() };
  }
  _janelaCache = janela;
  _janelaCacheTs = now;
  return janela;
}

function janelaToQuery(janela) {
  const qs = [];
  if (janela && janela.createdAtFrom) qs.push('createdAtFrom=' + encodeURIComponent(janela.createdAtFrom));
  if (janela && janela.createdAtTo) qs.push('createdAtTo=' + encodeURIComponent(janela.createdAtTo));
  return qs.length ? '?' + qs.join('&') : '';
}

async function fetchPedidos() {
  try {
    const base = (window.getApiBase ? window.getApiBase() : '');
    const janela = await getJanelaDoDia();
    const url = base + '/api/pedidos' + janelaToQuery(janela);
    let r;
    if (typeof window.authFetch === 'function') {
      r = await window.authFetch(url, { headers: { 'Content-Type': 'application/json' } });
    } else {
      r = await fetch(url, { headers: authHeaders() });
    }
    if (!r.ok) {
      // 401 = refresh falhou; authFetch já trata (refresh/hardLogout). Só pula este ciclo.
      return [];
    }
    return await r.json();
  } catch (e) {
    console.warn('[order-notifier] fetch falhou:', e);
    return [];
  }
}

function notifyCallbacks(count) {
  callbacks.forEach(function(cb) {
    try { cb(count); } catch (e) { console.warn('[order-notifier] callback erro:', e); }
  });
}

function notifyDataCallbacks(pedidos) {
  dataCallbacks.forEach(function(cb) {
    try { cb(pedidos); } catch (e) { console.warn('[order-notifier] dataCallback erro:', e); }
  });
}

function startBeepLoop() {
  if (beepLoopRunning) return;
  beepLoopRunning = true;
  function tick() {
    if (!beepLoopRunning) return;
    playNotification();
    beepLoopTimer = setTimeout(tick, BEEP_LOOP_INTERVAL);
  }
  tick();
}

function stopBeepLoop() {
  beepLoopRunning = false;
  if (beepLoopTimer) { clearTimeout(beepLoopTimer); beepLoopTimer = null; }
}

async function checkPedidos() {
  const pedidos = await fetchPedidos();
  if (!Array.isArray(pedidos)) return;

  const pendentes = pedidos.filter(function(p) { return p && p.status === 'pendente'; });
  const novosIds = pendentes.filter(function(p) {
    return !pendentesAtuais.some(function(a) { return a.id === p.id; });
  });

  if (novosIds.length > 0) {
    playNotification();
  }

  pedidosAtuais = pedidos;
  pendentesAtuais = pendentes;
  notifyCallbacks(pendentesAtuais.length);
  notifyDataCallbacks(pedidosAtuais);

  if (pendentesAtuais.length > 0) startBeepLoop();
  else stopBeepLoop();
}

function startPolling() {
  if (isPolling) return;
  isPolling = true;
  loadNotifSound(); // carrega som custom se houver
  checkPedidos(); // primeira checagem imediata
  function schedule() {
    if (!isPolling) return;
    pollTimer = setTimeout(async function() {
      await checkPedidos();
      schedule();
    }, POLL_INTERVAL);
  }
  schedule();
}

function stopPolling() {
  isPolling = false;
  if (pollTimer) { clearTimeout(pollTimer); pollTimer = null; }
  stopBeepLoop();
}

function onCountChange(cb) {
  if (typeof cb === 'function') callbacks.push(cb);
}

function offCountChange(cb) {
  callbacks = callbacks.filter(function (c) { return c !== cb; });
}

function onDataChange(cb) {
  if (typeof cb === 'function') dataCallbacks.push(cb);
}

function offDataChange(cb) {
  dataCallbacks = dataCallbacks.filter(function (c) { return c !== cb; });
}

function getPendentesCount() {
  return pendentesAtuais.length;
}

function getPendentes() {
  return pendentesAtuais.slice();
}

function getAllPedidos() {
  return pedidosAtuais.slice();
}

// expõe para debug / testes
window.__orderNotifier = { startPolling, stopPolling, checkPedidos, getPendentesCount, getPendentes, getAllPedidos, getJanelaDoDia };

export const orderNotifier = {
  init: function() {
    // chamada uma vez no boot do shell
    // já carrega som e anexa gesto de desbloqueio
    loadNotifSound();
  },
  startPolling,
  stopPolling,
  onCountChange,
  offCountChange,
  onDataChange,
  offDataChange,
  getPendentesCount,
  getPendentes,
  getAllPedidos,
  getJanelaDoDia,
  janelaToQuery
};