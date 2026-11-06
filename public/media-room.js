import { DiscordSDK } from 'https://esm.sh/@discord/embedded-app-sdk@2.5.0';

const $ = (id) => document.getElementById(id);
const connection = $('connection');
const notice = $('notice');
const form = $('add-form');
const queueList = $('queue-list');
let sdk, accessToken, user, roomId, roomState, player, playerReady = false;
let applyingRemote = false;
let lastVideoId = null;
let lastPlaying = false;
let lastHostSync = 0;

function say(message) { notice.textContent = message; }
function fmt(seconds) {
  const s = Math.max(0, Math.floor(Number(seconds) || 0));
  return Math.floor(s / 60) + ':' + String(s % 60).padStart(2, '0');
}
function extractVideoId(raw) {
  try {
    const url = new URL(raw);
    let id = '';
    if (url.hostname === 'youtu.be' || url.hostname.endsWith('.youtu.be')) id = url.pathname.split('/').filter(Boolean)[0] || '';
    else if (url.hostname === 'youtube.com' || url.hostname.endsWith('.youtube.com') || url.hostname === 'youtube-nocookie.com') {
      id = url.searchParams.get('v') || url.pathname.match(/\/(?:embed|shorts|live)\/([A-Za-z0-9_-]{11})/)?.[1] || '';
    }
    return /^[A-Za-z0-9_-]{11}$/.test(id) ? id : null;
  } catch (_) { return null; }
}
async function api(path, options = {}) {
  const response = await fetch('/api/media' + path, {
    ...options,
    headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + accessToken, ...(options.headers || {}) }
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data.error || 'Media room request failed.');
  return data;
}
function render(state) {
  roomState = state;
  const current = state.queue[state.index] || null;
  $('now-title').textContent = current?.title || 'Nothing playing yet';
  $('host-label').textContent = 'ROOM HOST: ' + (state.hostId === user?.id ? 'YOU' : 'ANOTHER MEMBER');
  $('member-name').textContent = user?.username || '';
  $('count').textContent = state.queue.length + ' / 50';
  $('room-status').textContent = state.playing ? '● Playing for everyone' : 'Ⅱ Paused';
  queueList.innerHTML = '';
  if (!state.queue.length) {
    const empty = document.createElement('li'); empty.className = 'empty'; empty.textContent = 'The queue is empty.'; queueList.append(empty);
  } else {
    state.queue.forEach((item, index) => {
      const li = document.createElement('li'); if (index === state.index) li.className = 'active';
      const n = document.createElement('span'); n.textContent = String(index + 1).padStart(2, '0');
      const text = document.createElement('div'); text.className = 'track';
      const title = document.createElement('strong'); title.textContent = item.title;
      const added = document.createElement('small'); added.textContent = 'Added by ' + item.addedBy;
      text.append(title, added); li.append(n, text); queueList.append(li);
    });
  }
  const hasVideo = Boolean(current);
  ['play','pause','next','seek'].forEach(id => $(id).disabled = !hasVideo);
  if (!playerReady) return;
  if (!current) {
    $('player-placeholder').hidden = false;
    lastVideoId = null; lastPlaying = false;
    return;
  }
  $('player-placeholder').hidden = true;
  if (current.videoId !== lastVideoId) {
    applyingRemote = true;
    player.cueVideoById(current.videoId);
    lastVideoId = current.videoId;
    lastPlaying = false;
    setTimeout(() => { applyingRemote = false; }, 600);
  }
  const targetPosition = Number(state.position) || 0;
  const actualPosition = Number(player.getCurrentTime?.() || 0);
  if (Math.abs(actualPosition - targetPosition) > 3 && (state.playing || actualPosition > 0)) {
    applyingRemote = true; player.seekTo(targetPosition, true);
    setTimeout(() => { applyingRemote = false; }, 500);
  }
  if (state.playing && !lastPlaying) {
    applyingRemote = true; player.playVideo();
    setTimeout(() => { applyingRemote = false; }, 800);
  } else if (!state.playing && lastPlaying) {
    applyingRemote = true; player.pauseVideo();
    setTimeout(() => { applyingRemote = false; }, 500);
  }
  lastPlaying = Boolean(state.playing);
  if (state.hostId === user?.id && state.playing && Date.now() - lastHostSync > 4000) {
    lastHostSync = Date.now();
    api('/rooms/' + encodeURIComponent(roomId), { method: 'POST', body: JSON.stringify({ action: 'sync', position: player.getCurrentTime?.() || targetPosition }) }).catch(() => {});
  }
}
async function refresh() {
  try { render(await api('/rooms/' + encodeURIComponent(roomId))); }
  catch (error) { say(error.message); }
}
async function action(action, extra = {}) {
  try { render(await api('/rooms/' + encodeURIComponent(roomId), { method: 'POST', body: JSON.stringify({ action, ...extra }) })); say('Room updated for everyone.'); }
  catch (error) { say(error.message); }
}
window.onYouTubeIframeAPIReady = () => {
  player = new YT.Player('player', {
    width: '100%', height: '100%', videoId: '',
    playerVars: { playsinline: 1, controls: 1, rel: 0, enablejsapi: 1 },
    events: {
      onReady: () => { playerReady = true; if (roomState) render(roomState); },
      onStateChange: event => {
        if (applyingRemote || !roomState || roomState.hostId !== user?.id) return;
        if (event.data === YT.PlayerState.PLAYING && !roomState.playing) action('play');
        if (event.data === YT.PlayerState.PAUSED && roomState.playing) action('pause');
      }
    }
  });
};

async function start() {
  try {
    const config = await fetch('/api/media/config').then(r => r.json());
    if (!config.clientId) throw new Error('Discord application ID is missing.');
    sdk = new DiscordSDK(config.clientId);
    await sdk.ready();
    roomId = sdk.instanceId;
    if (!roomId) throw new Error('Discord did not provide an Activity room ID. Launch this page from Discord.');
    connection.textContent = 'Discord connected';
    connection.style.color = 'var(--green)';
    const authorization = await sdk.commands.authorize({
      client_id: config.clientId,
      response_type: 'code',
      state: '',
      prompt: 'none',
      scope: ['identify']
    });
    const exchanged = await fetch('/api/media/token', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ code: authorization.code })
    }).then(async r => { const d = await r.json(); if (!r.ok) throw new Error(d.error || 'Discord sign-in failed.'); return d; });
    accessToken = exchanged.access_token;
    const auth = await sdk.commands.authenticate({ access_token: accessToken });
    user = auth.user;
    $('member-name').textContent = user.username;
    render(await api('/rooms/' + encodeURIComponent(roomId)));
    say('Room ready. Add a YouTube link to begin.');
    setInterval(refresh, 1800);
  } catch (error) {
    connection.textContent = 'Setup required';
    connection.style.color = '#ffb37b';
    say(error.message || 'Unable to start the Activity.');
  }
}
form.addEventListener('submit', async event => {
  event.preventDefault();
  const videoId = extractVideoId($('video-url').value.trim());
  if (!videoId) return say('Please paste a valid YouTube video URL.');
  if (!accessToken) return say('Discord sign-in is not ready yet.');
  await action('add', { videoId, title: 'YouTube video' });
  $('video-url').value = '';
});
$('play').addEventListener('click', () => action('play'));
$('pause').addEventListener('click', () => action('pause'));
$('next').addEventListener('click', () => action('next'));
$('seek').addEventListener('change', event => {
  const duration = Number(player?.getDuration?.() || 0);
  if (duration > 0) action('seek', { position: duration * Number(event.target.value) / 100 });
});
setInterval(() => {
  if (!playerReady || !player?.getDuration) return;
  const duration = Number(player.getDuration() || 0), current = Number(player.getCurrentTime() || 0);
  $('elapsed').textContent = fmt(current); $('duration').textContent = fmt(duration);
  if (duration > 0 && document.activeElement !== $('seek')) $('seek').value = String(Math.round(current / duration * 100));
}, 1000);
start();
