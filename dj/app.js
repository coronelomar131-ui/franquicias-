'use strict';
/* DJ Maquiavélico: control de Spotify desde el navegador.
   Usa la Web API oficial con login PKCE (sin servidor ni Client Secret)
   y el Web Playback SDK para que el navegador pueda sonar como bocina. */

const $ = (s) => document.querySelector(s);
const S = {
  get(k) { try { return localStorage.getItem(k); } catch { return null; } },
  set(k, v) { try { localStorage.setItem(k, v); } catch { /* sin almacenamiento */ } },
  del(k) { try { localStorage.removeItem(k); } catch { /* sin almacenamiento */ } },
};
const REDIRECT_URI = location.origin + location.pathname.replace(/index\.html$/, '');
const SCOPES = [
  'streaming', 'user-read-email', 'user-read-private',
  'user-read-playback-state', 'user-modify-playback-state',
  'user-read-currently-playing', 'user-top-read',
].join(' ');
const API = 'https://api.spotify.com/v1';
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const fmt = (ms) => { const s = Math.max(0, Math.floor(ms / 1000)); return Math.floor(s / 60) + ':' + String(s % 60).padStart(2, '0'); };
const shuffle = (a) => { for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; };
const show = (sel, on) => $(sel).classList.toggle('hidden', !on);

function toast(msg, ms = 4000) {
  const t = $('#toast');
  t.textContent = msg;
  t.classList.add('show');
  clearTimeout(toast.t);
  toast.t = setTimeout(() => t.classList.remove('show'), ms);
}

function loadJSON(k, fallback) {
  try { return JSON.parse(S.get(k)) ?? fallback; } catch { return fallback; }
}

/* ---------------- Login (Authorization Code + PKCE) ---------------- */

function randStr(n) {
  const c = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  return Array.from(crypto.getRandomValues(new Uint8Array(n)), (b) => c[b % c.length]).join('');
}
async function pkceChallenge(v) {
  const d = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(v));
  return btoa(String.fromCharCode(...new Uint8Array(d))).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

async function login() {
  const verifier = randStr(64);
  const state = randStr(16);
  S.set('dj_verifier', verifier);
  S.set('dj_state', state);
  const p = new URLSearchParams({
    client_id: S.get('dj_client'),
    response_type: 'code',
    redirect_uri: REDIRECT_URI,
    code_challenge_method: 'S256',
    code_challenge: await pkceChallenge(verifier),
    scope: SCOPES,
    state,
  });
  location.assign('https://accounts.spotify.com/authorize?' + p);
}

function saveTokens(j) {
  S.set('dj_access', j.access_token);
  if (j.refresh_token) S.set('dj_refresh', j.refresh_token);
  S.set('dj_expires', String(Date.now() + (j.expires_in || 3600) * 1000));
}

async function tokenRequest(params) {
  const r = await fetch('https://accounts.spotify.com/api/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams(params),
  });
  const j = await r.json().catch(() => ({}));
  if (!r.ok) {
    const e = new Error(j.error_description || j.error || 'HTTP ' + r.status);
    e.code = j.error;
    throw e;
  }
  return j;
}

async function handleCallback() {
  const u = new URL(location.href);
  const code = u.searchParams.get('code');
  const err = u.searchParams.get('error');
  if (!code && !err) return;
  history.replaceState(null, '', u.pathname);
  if (err) {
    toast(err === 'access_denied' ? 'Cancelaste el permiso en Spotify.' : 'Spotify respondió: ' + err, 7000);
    return;
  }
  if (u.searchParams.get('state') !== S.get('dj_state')) {
    toast('La respuesta de Spotify no coincide. Dale "Conectar" otra vez.', 7000);
    return;
  }
  try {
    saveTokens(await tokenRequest({
      grant_type: 'authorization_code',
      code,
      redirect_uri: REDIRECT_URI,
      client_id: S.get('dj_client'),
      code_verifier: S.get('dj_verifier'),
    }));
    toast('Conectado con Spotify ✅');
  } catch (e) {
    toast('No se pudo conectar: ' + e.message, 9000);
  }
  S.del('dj_verifier');
  S.del('dj_state');
}

let refreshing = null;
async function getToken() {
  const exp = Number(S.get('dj_expires') || 0);
  if (S.get('dj_access') && Date.now() < exp - 60000) return S.get('dj_access');
  if (!S.get('dj_refresh')) throw new Error('NO_SESSION');
  refreshing ||= tokenRequest({
    grant_type: 'refresh_token',
    refresh_token: S.get('dj_refresh'),
    client_id: S.get('dj_client'),
  }).then(saveTokens).finally(() => { refreshing = null; });
  await refreshing;
  return S.get('dj_access');
}

function logout(expired) {
  ['dj_access', 'dj_refresh', 'dj_expires'].forEach(S.del);
  if (player) { try { player.disconnect(); } catch { /* nada */ } }
  if (expired) S.set('dj_msg', 'Tu sesión de Spotify se venció. Conéctate otra vez.');
  location.replace(location.pathname);
}

/* ---------------- Web API ---------------- */

function explain(status, j) {
  const reason = j?.error?.reason;
  const msg = j?.error?.message || '';
  if (reason === 'PREMIUM_REQUIRED') return 'Spotify pide Premium para controlar la música.';
  if (reason === 'NO_ACTIVE_DEVICE' || (status === 404 && /device/i.test(msg))) {
    return 'No hay bocina activa: abre Spotify en algún aparato y dale play, o elige "Este navegador".';
  }
  if (status === 403) {
    return 'Spotify no lo permitió (' + (msg || '403') + '). Si tu app está en modo desarrollo, agrega tu cuenta en "User Management" del dashboard.';
  }
  return 'Spotify: ' + (msg || 'error ' + status);
}

async function api(method, path, body) {
  for (let attempt = 0; attempt < 3; attempt++) {
    let token;
    try {
      token = await getToken();
    } catch (e) {
      if (e.message === 'NO_SESSION' || e.code === 'invalid_grant') logout(true);
      throw e;
    }
    const headers = { Authorization: 'Bearer ' + token };
    if (body) headers['Content-Type'] = 'application/json';
    const r = await fetch(API + path, { method, headers, body: body ? JSON.stringify(body) : undefined });
    if (r.status === 401 && attempt === 0) { S.set('dj_expires', '0'); continue; }
    if (r.status === 429) { await sleep(clamp(Number(r.headers.get('Retry-After') || 1), 1, 10) * 1000); continue; }
    if (r.status === 204) return null;
    const text = await r.text();
    let j = null;
    try { j = text ? JSON.parse(text) : null; } catch { j = null; }
    if (!r.ok) {
      const e = new Error(explain(r.status, j));
      e.status = r.status;
      throw e;
    }
    return j;
  }
  throw new Error('Spotify no respondió. Intenta otra vez.');
}

/* ---------------- Estado ---------------- */

const st = {
  track: null, progress: 0, duration: 0, playing: false, at: 0,
  deviceId: null, deviceName: '', canVol: true,
  userVol: clamp(Number(S.get('dj_vol') || 70), 0, 100),
  lastVolSet: 0, fading: false, lastTrackId: null, introSkipped: 0,
  pendingNext: null,
  mode: 'normal', level: 0, inLevel: 0, used: new Set(),
  wild: loadJSON('dj_wild', []),
};
const curProgress = () => (st.playing ? st.progress + (Date.now() - st.at) : st.progress);
const fadeMs = () => Number($('#fadeSec').value) * 1000;
const sameTrack = (item, t) => !!(item && t && (item.id === t.id || item.linked_from?.id === t.id));

function toTrack(t) {
  const imgs = t.album?.images || [];
  return {
    id: t.id,
    uri: t.uri,
    name: t.name,
    artist: (t.artists || []).map((a) => a.name).join(', '),
    img: (imgs[imgs.length - 1] || imgs[0] || {}).url || '',
    big: (imgs[0] || {}).url || '',
  };
}

/* ---------------- Reproductor web (SDK) ---------------- */

let player = null;
let sdkDeviceId = null;
const setDevNote = (t) => { $('#devNote').textContent = t; };

function loadSDK() {
  window.onSpotifyWebPlaybackSDKReady = () => {
    player = new window.Spotify.Player({
      name: 'DJ Maquiavélico',
      getOAuthToken: (cb) => { getToken().then(cb).catch(() => {}); },
      volume: st.userVol / 100,
    });
    player.addListener('ready', ({ device_id }) => { sdkDeviceId = device_id; refreshDevices(); });
    player.addListener('not_ready', () => { sdkDeviceId = null; refreshDevices(); });
    player.addListener('initialization_error', () => {
      setDevNote('Este navegador no puede sonar como bocina (pasa en celulares). Úsalo como control remoto: abre Spotify en tu celular, bocina o compu y elígelo arriba.');
    });
    player.addListener('authentication_error', ({ message }) => toast('Spotify rechazó el reproductor: ' + message, 7000));
    player.addListener('account_error', () => setDevNote('Para que este navegador suene como bocina se necesita Spotify Premium.'));
    player.addListener('playback_error', ({ message }) => toast('Error al reproducir: ' + message));
    player.addListener('player_state_changed', () => schedulePoll(400));
    player.connect();
  };
  const s = document.createElement('script');
  s.src = 'https://sdk.scdn.co/spotify-player.js';
  s.async = true;
  s.onerror = () => setDevNote('No cargó el reproductor web de Spotify. La app sigue funcionando como control remoto.');
  document.head.appendChild(s);
}

const onSdkDevice = () => !!(player && sdkDeviceId && st.deviceId === sdkDeviceId);

async function setVolRaw(v) {
  v = Math.round(clamp(v, 0, 100));
  if (onSdkDevice()) return player.setVolume(v / 100);
  return api('PUT', '/me/player/volume?volume_percent=' + v);
}

async function ramp(from, to, ms) {
  const steps = onSdkDevice() ? Math.max(10, Math.round(ms / 100)) : Math.max(4, Math.round(ms / 450));
  for (let i = 1; i <= steps; i++) {
    await setVolRaw(from + ((to - from) * i) / steps);
    await sleep(ms / steps);
  }
}

/* ---------------- Lectura del estado ---------------- */

let pollT = null;
function schedulePoll(ms = 2000) {
  clearTimeout(pollT);
  pollT = setTimeout(poll, ms);
}
async function poll() {
  try {
    applyState(await api('GET', '/me/player?additional_types=episode'));
  } catch (e) {
    if (e.message !== 'NO_SESSION') console.warn(e);
  }
  schedulePoll(document.hidden ? 5000 : 2000);
}

function applyState(p) {
  if (!p || !p.item) {
    st.track = null;
    st.playing = false;
    st.deviceId = p?.device?.id || null;
    renderNow();
    return;
  }
  st.track = p.item;
  st.progress = p.progress_ms || 0;
  st.duration = p.item.duration_ms || 0;
  st.playing = !!p.is_playing;
  st.at = Date.now();
  st.deviceId = p.device?.id || null;
  st.deviceName = p.device?.id === sdkDeviceId ? 'Este navegador' : p.device?.name || '';
  st.canVol = p.device?.supports_volume !== false;
  if (!st.fading && Date.now() - st.lastVolSet > 5000 && typeof p.device?.volume_percent === 'number' && !onSdkDevice()) {
    st.userVol = p.device.volume_percent;
    renderVol();
  }
  if (p.item.id !== st.lastTrackId) {
    const first = st.lastTrackId === null;
    st.lastTrackId = p.item.id;
    onTrackChange(first);
  }
  renderNow();
}

async function waitChange(prevId, ms = 4500) {
  const t0 = Date.now();
  while (Date.now() - t0 < ms) {
    await sleep(350);
    const p = await api('GET', '/me/player');
    if (p?.item && p.item.id !== prevId) return p;
  }
  return null;
}

/* ---------------- Transiciones (el "DJ") ---------------- */

async function transition(useFade) {
  if (st.fading) return;
  st.fading = true;
  renderNow();
  const target = st.pendingNext;
  st.pendingNext = null;
  const canVol = st.canVol;
  let applied = false;
  try {
    if (canVol) {
      if (useFade) await ramp(st.userVol, 0, fadeMs());
      else if (target) await setVolRaw(0);
    }
    let prevId = st.lastTrackId;
    // Si la canción ya cambió sola mientras bajaba el volumen, no saltamos de más.
    const fresh = await api('GET', '/me/player');
    let lastP = null;
    if (fresh?.item && fresh.item.id !== prevId) { lastP = fresh; prevId = fresh.item.id; }
    if (!lastP || (target && !sameTrack(lastP.item, target))) {
      // Con el volumen en cero se brinca lo que haga falta hasta llegar al objetivo.
      for (let i = 0; i < 6; i++) {
        await api('POST', '/me/player/next');
        const p = await waitChange(prevId);
        if (!p) break;
        lastP = p;
        prevId = p.item.id;
        if (!target || sameTrack(p.item, target)) break;
      }
    }
    if (lastP) { applyState(lastP); applied = true; }
    if (canVol) {
      if (useFade) await ramp(0, st.userVol, 1500);
      else if (target) await setVolRaw(st.userVol);
    }
  } catch (e) {
    toast(e.message);
    if (canVol) await setVolRaw(st.userVol).catch(() => {});
  } finally {
    st.fading = false;
    if (!applied) schedulePoll(300);
    renderNow();
  }
}

function checkTransition() {
  if (!st.playing || st.fading || !st.track || st.track.type !== 'track') return;
  const fade = $('#autoFade').checked;
  const max = Number($('#maxLen').value) * 1000;
  const needs = fade || max > 0 || !!st.pendingNext;
  if (!needs) return;
  const end = max > 0 ? Math.min(st.duration, st.introSkipped + max) : st.duration;
  const lead = fade ? fadeMs() : 1500;
  if (end > lead * 2 && end - curProgress() <= lead) transition(fade);
}

function onTrackChange(first) {
  st.introSkipped = 0;
  const skip = Number($('#skipIntro').value) * 1000;
  if (!first && skip > 0 && st.track?.type === 'track' && st.progress < skip && st.duration > skip * 4) {
    st.introSkipped = skip;
    st.progress = skip;
    st.at = Date.now();
    api('PUT', '/me/player/seek?position_ms=' + skip).catch(() => {});
  }
  refreshQueue();
  if (!first) runMode();
  renderGuest();
}

/* ---------------- Modos maquiavélicos ---------------- */

const MODES = {
  prender: {
    volStep: +3, volLimit: 95,
    levels: [
      { name: 'Calentando', q: 'genre:"latin pop"' },
      { name: 'Cumbia', q: 'genre:"cumbia"' },
      { name: 'Reggaetón clásico', q: 'genre:"reggaeton" year:2004-2016' },
      { name: 'Reggaetón actual', q: 'genre:"reggaeton" year:2020-2026' },
      { name: 'Perreo intenso', q: 'perreo' },
    ],
  },
  correr: {
    volStep: -5, volLimit: 20,
    levels: [
      { name: 'Baladas', q: 'genre:"latin pop" year:1985-1999' },
      { name: 'Boleros', q: 'genre:"bolero"' },
      { name: 'Canciones tristes', q: 'canciones tristes' },
      { name: 'Piano para dormir', q: 'piano para dormir' },
    ],
  },
};

async function pickTracks(q, n) {
  const fetchSome = async (offset) => {
    const r = await api('GET', '/search?type=track&limit=10&market=from_token&offset=' + offset + '&q=' + encodeURIComponent(q));
    return (r?.tracks?.items || []).filter((t) => t && t.id && !st.used.has(t.id));
  };
  let items = await fetchSome(Math.floor(Math.random() * 40));
  if (!items.length) items = await fetchSome(0);
  return shuffle(items).slice(0, n);
}

async function queueUri(uri) {
  await api('POST', '/me/player/queue?uri=' + encodeURIComponent(uri));
}

async function queueFromLevel(n) {
  const m = MODES[st.mode];
  if (!m) return;
  const lvl = m.levels[st.level];
  try {
    const tracks = await pickTracks(lvl.q, n);
    for (const t of tracks) { st.used.add(t.id); await queueUri(t.uri); }
    if (!tracks.length) toast('No encontré canciones para "' + lvl.name + '".');
    refreshQueue();
  } catch (e) {
    toast(e.message);
  }
}

function runMode() {
  const m = MODES[st.mode];
  if (!m) return;
  st.inLevel++;
  if (st.inLevel >= Number($('#perLevel').value) && st.level < m.levels.length - 1) {
    st.level++;
    st.inLevel = 0;
  }
  const v = m.volStep > 0 ? Math.min(m.volLimit, st.userVol + m.volStep) : Math.max(m.volLimit, st.userVol + m.volStep);
  if (v !== st.userVol && st.canVol) {
    st.userVol = v;
    st.lastVolSet = Date.now();
    renderVol();
    if (!st.fading) setVolRaw(v).catch(() => {});
  }
  renderMode();
  queueFromLevel(1);
}

function setMode(mode) {
  st.mode = mode;
  st.level = 0;
  st.inLevel = 0;
  renderMode();
  if (MODES[mode]) {
    toast(mode === 'prender' ? '🔥 Prendiendo la fiesta poco a poco' : '😴 Bajando la fiesta poco a poco');
    queueFromLevel(2);
  }
}

function renderMode() {
  const m = MODES[st.mode];
  $('#modeInfo').textContent = m
    ? 'Nivel ' + (st.level + 1) + '/' + m.levels.length + ': ' + m.levels[st.level].name + ' · volumen ' + st.userVol + '% (cambia ' + (m.volStep > 0 ? '+' : '') + m.volStep + ' por canción)'
    : 'Sin trucos: suena lo que pongas.';
}

/* ---------------- Comodines y votación arreglada ---------------- */

function saveWild() { S.set('dj_wild', JSON.stringify(st.wild)); renderWild(); }

function addWild(t) {
  if (st.wild.some((w) => w.id === t.id)) return toast('Ya es comodín.');
  st.wild.push(t);
  saveWild();
  toast('😈 ' + t.name + ' ahora es comodín');
}

async function playNext(t, now) {
  // Lo forma en la cola y, al cambiar, brinca con el volumen en cero hasta llegar a él.
  try {
    if (!st.track) {
      await api('PUT', '/me/player/play', { uris: [t.uri] });
      schedulePoll(600);
      return;
    }
    await queueUri(t.uri);
    st.pendingNext = t;
    refreshQueue();
    if (now) transition($('#autoFade').checked);
    else toast('⏭ ' + t.name + ' va después de esta');
  } catch (e) {
    toast(e.message);
  }
}

let vote = null;

async function pickOther(excludeId) {
  const bad = (t) => !t || t.type !== 'track' || t.id === excludeId || st.wild.some((w) => w.id === t.id);
  try {
    const q = await api('GET', '/me/player/queue');
    const c = (q?.queue || []).filter((t) => !bad(t)).slice(0, 5);
    if (c.length) return toTrack(c[Math.floor(Math.random() * c.length)]);
  } catch { /* sigue */ }
  try {
    const top = await api('GET', '/me/top/tracks?limit=20&time_range=short_term');
    const c = (top?.items || []).filter((t) => !bad(t));
    if (c.length) return toTrack(c[Math.floor(Math.random() * c.length)]);
  } catch { /* sigue */ }
  const c = (await pickTracks('éxitos', 5).catch(() => [])).filter((t) => !bad(t));
  return c[0] ? toTrack(c[0]) : null;
}

async function startVote() {
  if (vote) return;
  if (!st.wild.length) return toast('Primero agrega un comodín con el botón 😈 en Buscar.');
  const w = st.wild[Math.floor(Math.random() * st.wild.length)];
  const other = await pickOther(w.id);
  if (!other) return toast('No encontré otra canción para ponerla de rival.');
  vote = { opts: shuffle([{ ...w, rig: true }, { ...other, rig: false }]), counts: [0, 0], ends: Date.now() + 20000, done: false };
  openGuest();
  show('#gVote', true);
  $('#gResult').textContent = '';
  ['#gA', '#gB'].forEach((sel, i) => {
    const b = $(sel);
    b.classList.remove('win');
    b.disabled = false;
    b.querySelector('img').src = vote.opts[i].big || vote.opts[i].img || '';
    b.querySelector('.n').textContent = vote.opts[i].name + ' — ' + vote.opts[i].artist;
    b.querySelector('.c').textContent = '0';
  });
  vote.timer = setInterval(voteTick, 250);
  voteTick();
}

function castVote(i) {
  if (!vote || vote.done) return;
  vote.counts[i]++;
  const b = i === 0 ? $('#gA') : $('#gB');
  b.querySelector('.c').textContent = vote.counts[i];
  b.classList.remove('bump');
  void b.offsetWidth;
  b.classList.add('bump');
}

async function voteTick() {
  if (!vote || vote.done) return;
  const left = Math.ceil((vote.ends - Date.now()) / 1000);
  $('#gTimer').textContent = left > 0 ? left + ' s' : '';
  if (left > 0) return;
  vote.done = true;
  clearInterval(vote.timer);
  const ri = vote.opts.findIndex((o) => o.rig);
  const oi = 1 - ri;
  const c = [...vote.counts];
  if (c[ri] <= c[oi]) c[ri] = c[oi] + 1 + Math.floor(Math.random() * 3);
  ['#gA', '#gB'].forEach((sel, i) => {
    $(sel).querySelector('.c').textContent = c[i];
    $(sel).disabled = true;
  });
  (ri === 0 ? $('#gA') : $('#gB')).classList.add('win');
  const winner = vote.opts[ri];
  $('#gResult').textContent = '¡Ganó ' + winner.name + '! Va después de esta.';
  await playNext(winner, false);
  setTimeout(() => { show('#gVote', false); vote = null; }, 6000);
}

/* ---------------- Pantalla de invitados ---------------- */

let guestOn = false;
let wakeLock = null;

function openGuest() {
  guestOn = true;
  show('#guest', true);
  renderGuest();
  try { document.documentElement.requestFullscreen?.().catch(() => {}); } catch { /* nada */ }
  try { navigator.wakeLock?.request('screen').then((l) => { wakeLock = l; }).catch(() => {}); } catch { /* nada */ }
}
function closeGuest() {
  guestOn = false;
  show('#guest', false);
  try { if (document.fullscreenElement) document.exitFullscreen(); } catch { /* nada */ }
  try { wakeLock?.release(); } catch { /* nada */ }
  wakeLock = null;
}
function renderGuest() {
  if (!guestOn) return;
  const t = st.track;
  const imgs = t?.album?.images || t?.images || [];
  $('#gArt').src = (imgs[0] || {}).url || '';
  $('#gTitle').textContent = t ? t.name : 'Esperando música…';
  $('#gArtist').textContent = t ? (t.artists || []).map((a) => a.name).join(', ') || t.show?.name || '' : '';
}

/* ---------------- Pintar pantalla ---------------- */

function renderNow() {
  const t = st.track;
  const imgs = t?.album?.images || t?.images || [];
  const art = (imgs[1] || imgs[0] || {}).url || '';
  if ($('#npArt').getAttribute('src') !== art) $('#npArt').src = art;
  $('#npTitle').textContent = t ? t.name : 'Nada sonando';
  $('#npArtist').textContent = t ? (t.artists || []).map((a) => a.name).join(', ') || t.show?.name || '' : 'Elige una bocina y busca una canción.';
  $('#npDevice').textContent = st.deviceName ? 'Suena en: ' + st.deviceName : '';
  $('#bPlay').textContent = st.playing ? '⏸' : '▶';
  $('#npDur').textContent = fmt(st.duration);
  const badge = $('#npStatus');
  badge.textContent = st.fading ? 'transición…' : st.pendingNext ? 'sigue: ' + st.pendingNext.name : '';
  badge.classList.toggle('hidden', !st.fading && !st.pendingNext);
}

function renderVol() {
  $('#vol').value = st.userVol;
  $('#volTxt').textContent = st.userVol;
}

function tick() {
  const pos = st.track ? Math.min(curProgress(), st.duration) : 0;
  const pct = st.duration ? (pos / st.duration) * 100 : 0;
  $('#npBar').style.width = pct + '%';
  $('#npPos').textContent = fmt(pos);
  if (guestOn) $('#gBar').style.width = pct + '%';
  checkTransition();
}

function trackItem(t, buttons) {
  const li = document.createElement('li');
  li.className = 'item';
  const img = document.createElement('img');
  img.alt = '';
  img.loading = 'lazy';
  if (t.img) img.src = t.img;
  const meta = document.createElement('div');
  meta.className = 'meta';
  const b = document.createElement('b');
  b.textContent = t.name;
  const s = document.createElement('span');
  s.textContent = t.artist;
  meta.append(b, s);
  const acts = document.createElement('div');
  acts.className = 'acts';
  for (const [label, title, fn, cls] of buttons) {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.textContent = label;
    btn.title = title;
    btn.setAttribute('aria-label', title);
    if (cls) btn.className = cls;
    btn.addEventListener('click', fn);
    acts.append(btn);
  }
  li.append(img, meta, acts);
  return li;
}

function renderWild() {
  const ul = $('#wild');
  ul.innerHTML = '';
  if (!st.wild.length) {
    const li = document.createElement('li');
    li.className = 'muted small';
    li.textContent = 'Todavía no hay comodines.';
    ul.append(li);
    return;
  }
  for (const w of st.wild) {
    ul.append(trackItem(w, [
      ['⚡', 'Soltar ya', () => playNext(w, true)],
      ['✕', 'Quitar comodín', () => { st.wild = st.wild.filter((x) => x.id !== w.id); saveWild(); }],
    ]));
  }
}

async function refreshQueue() {
  try {
    const q = await api('GET', '/me/player/queue');
    const ul = $('#queue');
    ul.innerHTML = '';
    const items = (q?.queue || []).filter((t) => t && t.type === 'track').slice(0, 8);
    if (!items.length) {
      const li = document.createElement('li');
      li.className = 'muted small';
      li.textContent = 'La cola está vacía.';
      ul.append(li);
    }
    for (const t of items) ul.append(trackItem(toTrack(t), []));
  } catch { /* la cola es opcional */ }
}

const TYPES = { Computer: 'compu', Smartphone: 'celular', Speaker: 'bocina', TV: 'tele', Tablet: 'tableta', CastVideo: 'Chromecast', CastAudio: 'Chromecast', GameConsole: 'consola', Automobile: 'coche' };

async function refreshDevices() {
  try {
    const d = await api('GET', '/me/player/devices');
    const list = d?.devices || [];
    const sel = $('#devices');
    sel.innerHTML = '';
    if (!list.length && !sdkDeviceId) sel.append(new Option('Ninguna: abre Spotify en algún aparato', ''));
    let active = false;
    for (const x of list) {
      const o = new Option((x.id === sdkDeviceId ? 'Este navegador' : x.name) + ' · ' + (TYPES[x.type] || x.type), x.id);
      if (x.is_active) { o.selected = true; active = true; }
      sel.append(o);
    }
    if (sdkDeviceId && !list.some((x) => x.id === sdkDeviceId)) sel.append(new Option('Este navegador', sdkDeviceId));
    if (!active) {
      const o = new Option('Elige dónde suena…', '');
      o.selected = true;
      sel.prepend(o);
    }
  } catch (e) {
    toast(e.message);
  }
}

/* ---------------- Eventos ---------------- */

function bind() {
  $('#copyRedirect').addEventListener('click', async () => {
    try { await navigator.clipboard.writeText(REDIRECT_URI); toast('Copiado'); } catch { toast('Selecciónalo y cópialo a mano.'); }
  });
  $('#fClient').addEventListener('submit', (e) => {
    e.preventDefault();
    S.set('dj_client', $('#inClient').value.trim());
    route();
  });
  $('#btnLogin').addEventListener('click', login);
  $('#btnResetClient').addEventListener('click', () => { S.del('dj_client'); route(); });
  $('#bLogout').addEventListener('click', () => logout(false));

  $('#bPlay').addEventListener('click', async () => {
    try { player?.activateElement?.(); } catch { /* nada */ }
    try {
      await api('PUT', st.playing ? '/me/player/pause' : '/me/player/play');
      st.playing = !st.playing;
      st.at = Date.now();
      renderNow();
      schedulePoll(700);
    } catch (e) { toast(e.message); }
  });
  $('#bNext').addEventListener('click', () => {
    if (st.track) transition($('#autoFade').checked);
  });
  $('#bPrev').addEventListener('click', async () => {
    try { await api('POST', '/me/player/previous'); schedulePoll(600); } catch (e) { toast(e.message); }
  });

  let volT = null;
  $('#vol').addEventListener('input', (e) => {
    st.userVol = Number(e.target.value);
    st.lastVolSet = Date.now();
    $('#volTxt').textContent = st.userVol;
    S.set('dj_vol', String(st.userVol));
    clearTimeout(volT);
    volT = setTimeout(() => { if (!st.fading) setVolRaw(st.userVol).catch((err) => toast(err.message)); }, 250);
    renderMode();
  });

  $('#devices').addEventListener('change', async (e) => {
    const id = e.target.value;
    if (!id) return;
    try { player?.activateElement?.(); } catch { /* nada */ }
    try {
      await api('PUT', '/me/player', { device_ids: [id], play: true });
      toast('Cambiando de bocina…');
      schedulePoll(1200);
    } catch (err) { toast(err.message); }
  });
  $('#bDevRefresh').addEventListener('click', refreshDevices);

  $('#fadeSec').addEventListener('input', (e) => { $('#fadeTxt').textContent = e.target.value + ' s'; });

  $('#fSearch').addEventListener('submit', async (e) => {
    e.preventDefault();
    const q = $('#q').value.trim();
    if (!q) return;
    const ul = $('#results');
    ul.innerHTML = '<li class="muted small">Buscando…</li>';
    try {
      const r = await api('GET', '/search?type=track&limit=10&market=from_token&q=' + encodeURIComponent(q));
      ul.innerHTML = '';
      const items = (r?.tracks?.items || []).filter(Boolean).map(toTrack);
      if (!items.length) ul.innerHTML = '<li class="muted small">Nada.</li>';
      for (const t of items) {
        ul.append(trackItem(t, [
          ['▶', 'Poner ya', () => playNext(t, true)],
          ['＋', 'Agregar a la cola', async () => {
            try { await queueUri(t.uri); toast('Agregada a la cola'); refreshQueue(); } catch (err) { toast(err.message); }
          }],
          ['😈', 'Hacer comodín', () => addWild(t), 'needSecret'],
        ]));
      }
    } catch (err) {
      ul.innerHTML = '';
      toast(err.message);
    }
  });

  // 5 toques al logo abren o cierran el panel secreto.
  let taps = [];
  $('#logo').addEventListener('click', () => {
    const now = Date.now();
    taps = taps.filter((t) => now - t < 2000);
    taps.push(now);
    if (taps.length >= 5 && !$('#vApp').classList.contains('hidden')) {
      taps = [];
      const on = !document.body.classList.contains('secret-on');
      document.body.classList.toggle('secret-on', on);
      show('#secret', on);
      if (on) { renderWild(); renderMode(); $('#secret').scrollIntoView({ behavior: 'smooth' }); }
    }
  });
  $('#mode').addEventListener('change', (e) => setMode(e.target.value));
  $('#bVote').addEventListener('click', startVote);

  $('#btnGuest').addEventListener('click', openGuest);
  $('#gA').addEventListener('click', () => castVote(0));
  $('#gB').addEventListener('click', () => castVote(1));
  // 3 toques en la esquina superior derecha para salir de la pantalla de invitados.
  let exitTaps = [];
  $('#gExit').addEventListener('click', () => {
    const now = Date.now();
    exitTaps = exitTaps.filter((t) => now - t < 1500);
    exitTaps.push(now);
    if (exitTaps.length >= 3) { exitTaps = []; closeGuest(); }
  });
  document.addEventListener('visibilitychange', () => { if (!document.hidden) schedulePoll(100); });
}

/* ---------------- Arranque ---------------- */

let started = false;
function route() {
  const hasClient = !!S.get('dj_client');
  const hasSession = !!S.get('dj_refresh');
  show('#vSetup', !hasClient);
  show('#vLogin', hasClient && !hasSession);
  show('#vApp', hasClient && hasSession);
  show('#btnGuest', hasClient && hasSession);
  if (hasClient && hasSession && !started) start();
}

function start() {
  started = true;
  renderVol();
  renderNow();
  renderMode();
  loadSDK();
  poll();
  refreshDevices();
  refreshQueue();
  setInterval(tick, 250);
}

async function init() {
  $('#redirectUri').textContent = REDIRECT_URI;
  bind();
  await handleCallback();
  const msg = S.get('dj_msg');
  if (msg) { S.del('dj_msg'); toast(msg, 6000); }
  route();
}

init();
