// js/utils/audio.js — AudioContext lazy singleton + queue
// Carregado uma vez, compartilhado por todo o app

let audioCtx = null;
let audioCtxReady = false;
let audioQueue = [];

function ensureAudioCtx() {
  if (audioCtxReady) return;
  try {
    audioCtx = new (window.AudioContext || window.webkitAudioContext)();
    audioCtxReady = true;
    audioQueue.forEach(function(fn) { fn(); });
    audioQueue = [];
  } catch (e) {}
}

function queueAudio(fn) {
  if (audioCtxReady) { fn(); }
  else { audioQueue.push(fn); }
}

function getAudioCtx() {
  return audioCtx;
}

function beep(freq, duration, type) {
  queueAudio(function() {
    try {
      const ctx = getAudioCtx();
      if (!ctx || ctx.state === 'closed') return;
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = type || 'square';
      osc.frequency.value = freq || 880;
      gain.gain.setValueAtTime(0.3, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + duration);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(ctx.currentTime);
      osc.stop(ctx.currentTime + duration);
    } catch (e) {}
  });
}

let customNotifSound = null;

async function loadNotifSound() {
  try {
    const base = (window.getApiBase ? window.getApiBase() : '');
    const reqUrl = base + '/api/loja/settings-admin';
    let r;
    if (typeof window.authFetch === 'function') {
      r = await window.authFetch(reqUrl, { headers: { 'Content-Type': 'application/json' } });
    } else {
      const au = JSON.parse(localStorage.getItem('authUser') || 'null');
      const headers = { 'Content-Type': 'application/json' };
      if (au && au.token) headers['Authorization'] = 'Bearer ' + au.token;
      r = await fetch(reqUrl, { headers: headers });
    }
    if (!r.ok) return;
    const config = await r.json();
    const url = config.notificationSound || (config.themeSettings && config.themeSettings.notificationSound);
    if (url) {
      customNotifSound = new Audio(url);
      customNotifSound.load();
    }
  } catch (e) { /* fallback to beep */ }
}

function playNotification() {
  if (customNotifSound) {
    try {
      const clone = customNotifSound.cloneNode();
      clone.volume = 1;
      clone.play().catch(function(e) {
        console.warn('Som custom falhou, usando beep:', e);
        beep(880, 0.2);
        setTimeout(function() { beep(880, 0.2); }, 250);
        setTimeout(function() { beep(880, 0.3); }, 500);
      });
      return;
    } catch (e) {
      console.warn('Som custom erro:', e);
      customNotifSound = null;
    }
  }
  beep(880, 0.2);
  setTimeout(function() { beep(880, 0.2); }, 250);
  setTimeout(function() { beep(880, 0.3); }, 500);
}

function initAudioOnGesture() {
  ensureAudioCtx();
  var ctx = getAudioCtx();
  if (ctx && ctx.state === 'suspended') ctx.resume();
}

// gesto único no document (shell anexa no boot)
function attachGestureUnlock() {
  ['click', 'keydown', 'touchstart'].forEach(function(ev) {
    document.addEventListener(ev, initAudioOnGesture, { passive: ev === 'touchstart' });
  });
}

export { ensureAudioCtx, queueAudio, getAudioCtx, beep, loadNotifSound, playNotification, initAudioOnGesture, attachGestureUnlock };