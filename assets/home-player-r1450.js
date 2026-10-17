/* ANDRIK R1450: one audio element for the homepage, started only by the listener. */
export function normaliseTrack(raw, origin) {
  try {
    const url = new URL(raw.url, origin);
    const local = url.origin === origin && (/^\/api\/music\//.test(url.pathname) || /^\/assets\/.+\.(mp3|ogg|wav)$/i.test(url.pathname));
    if (url.username || url.password || !(local || (url.protocol === 'https:' && url.hostname === 'music.andrikmetal.com'))) return null;
    const title = String(raw.title || raw.name || '').trim().slice(0, 240);
    if (!title) return null;
    let art = '/assets/andrik-radio-mini-r1199.webp';
    if (/^\/assets\/[A-Za-z0-9_.-]+\.(webp|jpg|jpeg|png)$/i.test(raw.art || '')) art = raw.art;
    return {id: url.href, url: url.href, title, album: String(raw.album || 'ANDRIK').slice(0, 100), art};
  } catch { return null; }
}

export function formatTime(value) {
  const n = Number.isFinite(value) && value > 0 ? Math.floor(value) : 0;
  return `${Math.floor(n / 60)}:${String(n % 60).padStart(2, '0')}`;
}

export function createHomePlayer({doc = document, win = window, text}) {
  const audio = doc.getElementById('homeAudio');
  const dock = doc.getElementById('homePlayer');
  const play = doc.getElementById('homePlayerPlay');
  const next = doc.getElementById('homePlayerNext');
  const previous = doc.getElementById('homePlayerPrevious');
  const close = doc.getElementById('homePlayerClose');
  const seek = doc.getElementById('homePlayerSeek');
  const title = doc.getElementById('homePlayerTitle');
  const album = doc.getElementById('homePlayerAlbum');
  const art = doc.getElementById('homePlayerArt');
  const currentTime = doc.getElementById('homePlayerTime');
  const duration = doc.getElementById('homePlayerDuration');
  const status = doc.getElementById('homePlayerStatus');
  const tracks = new Map(), bindings = new Map();
  let queue = [], selected = null, request = 0, busy = false, lastInvoker = null, mediaMetadata = null;
  const embedded = win.parent !== win;
  const durationOf = () => Number.isFinite(audio.duration) && audio.duration > 0 ? audio.duration : 0;

  function progress() {
    const total = durationOf(), time = Math.max(0, audio.currentTime || 0);
    seek.disabled = !total;
    seek.value = total ? String(Math.round(Math.min(1, time / total) * 1000)) : '0';
    seek.style.setProperty('--progress', `${Number(seek.value) / 10}%`);
    seek.setAttribute('aria-valuetext', `${formatTime(time)} / ${formatTime(total)}`);
    currentTime.textContent = formatTime(time);
    duration.textContent = formatTime(total);
    if (!embedded && win.navigator?.mediaSession && total && time <= total) {
      try { win.navigator.mediaSession.setPositionState({duration: total, position: time, playbackRate: audio.playbackRate || 1}); } catch {}
    }
  }

  function reflect() {
    const playing = Boolean(selected && !audio.paused && !audio.ended);
    play.textContent = playing ? 'Ⅱ' : '▶';
    play.setAttribute('aria-label', playing ? text.pause : text.play);
    play.setAttribute('aria-pressed', String(playing));
    play.disabled = !selected;
    dock.classList.toggle('is-playing', playing);
    dock.setAttribute('aria-busy', String(busy));
    next.disabled = previous.disabled = queue.length < 2;
    for (const [button, binding] of bindings) {
      const active = selected?.id === binding.id && playing;
      button.setAttribute('aria-pressed', String(active));
      button.setAttribute('aria-label', `${active ? text.pause : binding.label || text.play} — ${tracks.get(binding.id)?.title || 'ANDRIK'}`);
      if (binding.label) button.textContent = `${active ? 'Ⅱ' : '▶'} ${active ? text.pause : binding.label}`;
      else button.textContent = active ? 'Ⅱ' : '▶';
    }
    if (!embedded && win.navigator?.mediaSession && mediaMetadata && win.navigator.mediaSession.metadata === mediaMetadata) {
      win.navigator.mediaSession.playbackState = playing ? 'playing' : 'paused';
    }
    progress();
  }

  function announce(message, failed = false) {
    status.textContent = message;
    dock.classList.toggle('has-error', failed);
  }

  function mediaSession() {
    if (embedded || !win.navigator?.mediaSession || !selected) return;
    const session = win.navigator.mediaSession;
    try {
      if (win.MediaMetadata) {
        mediaMetadata = new win.MediaMetadata({title: selected.title, artist: 'ANDRIK', album: selected.album, artwork: [{src: new URL(selected.art, win.location.origin).href}]});
        session.metadata = mediaMetadata;
      }
      const handlers = {
        play: () => { void resume(); }, pause: () => pause(),
        previoustrack: () => step(-1), nexttrack: () => step(1),
        seekto: e => { if (Number.isFinite(e.seekTime) && durationOf()) { audio.currentTime = Math.max(0, Math.min(durationOf(), e.seekTime)); progress(); } }
      };
      for (const [name, handler] of Object.entries(handlers)) {
        try { session.setActionHandler(name, handler); } catch {}
      }
    } catch {}
  }

  async function resume() {
    if (!selected) return false;
    const token = ++request;
    busy = true;
    announce(text.loading);
    reflect();
    try {
      await audio.play();
      if (token !== request) return false;
      busy = false;
      announce(selected.title);
      reflect();
      return true;
    } catch (error) {
      if (token !== request) return false;
      busy = false;
      audio.pause();
      announce(error?.name === 'NotAllowedError' ? text.tapAgain : text.error, true);
      reflect();
      return false;
    }
  }

  function select(id) {
    const track = tracks.get(id);
    if (!track) return false;
    ++request;
    audio.pause();
    selected = track;
    audio.src = track.url;
    audio.load();
    title.textContent = track.title;
    album.textContent = track.album;
    art.src = track.art;
    dock.hidden = false;
    doc.body.classList.add('home-player-visible');
    announce(track.title);
    mediaSession();
    reflect();
    return true;
  }

  function pause() {
    ++request;
    busy = false;
    audio.pause();
    reflect();
  }

  async function toggle(id, invoker) {
    if (!tracks.has(id)) return false;
    if (invoker && !dock.contains(invoker)) lastInvoker = invoker;
    if (selected?.id === id && !audio.paused) { pause(); return true; }
    if (selected?.id !== id) select(id);
    return resume();
  }

  function step(direction) {
    if (!selected || !queue.length) return;
    if (direction < 0 && audio.currentTime > 3) { audio.currentTime = 0; progress(); return; }
    const index = queue.indexOf(selected.id);
    const id = queue[(Math.max(0, index) + direction + queue.length) % queue.length];
    select(id);
    void resume();
  }

  function clear() {
    pause();
    selected = null;
    audio.removeAttribute('src');
    audio.load();
    if (dock.contains(doc.activeElement)) lastInvoker?.focus?.({preventScroll: true});
    dock.hidden = true;
    doc.body.classList.remove('home-player-visible');
    const session = win.navigator?.mediaSession;
    if (!embedded && session && mediaMetadata && session.metadata === mediaMetadata) {
      session.metadata = null;
      session.playbackState = 'none';
      for (const name of ['play', 'pause', 'previoustrack', 'nexttrack', 'seekto']) {
        try { session.setActionHandler(name, null); } catch {}
      }
    }
    mediaMetadata = null;
    reflect();
  }

  function register(raw) {
    const track = normaliseTrack(raw, win.location.origin);
    if (!track) return null;
    tracks.set(track.id, track);
    return track.id;
  }

  function setQueue(ids) {
    queue = [...new Set(ids)].filter(id => tracks.has(id));
    if (selected && !queue.includes(selected.id)) queue.push(selected.id);
    reflect();
  }

  function bind(button, id, label = '') {
    if (!button || !tracks.has(id)) return;
    if (!bindings.has(button)) {
      button.addEventListener('click', event => {
        const binding = bindings.get(button);
        if (!binding) return;
        event.preventDefault();
        void toggle(binding.id, button);
      });
      if (button.tagName === 'A') {
        button.setAttribute('role', 'button');
        button.addEventListener('keydown', event => {
          if (event.key === ' ') { event.preventDefault(); button.click(); }
        });
      }
    }
    bindings.set(button, {id, label});
    reflect();
  }

  play.addEventListener('click', () => { if (selected) void toggle(selected.id, play); });
  next.addEventListener('click', () => step(1));
  previous.addEventListener('click', () => step(-1));
  close.addEventListener('click', clear);
  seek.addEventListener('input', () => {
    const total = durationOf();
    if (!total) return;
    audio.currentTime = Math.max(0, Math.min(1000, Number(seek.value) || 0)) / 1000 * total;
    progress();
  });
  for (const event of ['timeupdate', 'durationchange', 'loadedmetadata', 'seeked']) audio.addEventListener(event, progress);
  for (const event of ['play', 'pause', 'playing', 'waiting', 'stalled']) audio.addEventListener(event, () => {
    if (!selected) { audio.pause(); return; }
    if (event === 'play') {
      doc.querySelectorAll('audio').forEach(other => { if (other !== audio && !other.paused) other.pause(); });
      if (embedded) win.parent.postMessage({type: 'andrik-home-audio-start'}, win.location.origin);
    }
    if (event === 'pause') busy = false;
    if ((event === 'waiting' || event === 'stalled') && !audio.paused) { busy = true; announce(text.loading); }
    if (event === 'playing') { busy = false; announce(selected.title); }
    reflect();
  });
  audio.addEventListener('error', () => { if (selected) { pause(); announce(text.error, true); reflect(); } });
  audio.addEventListener('ended', () => {
    const index = queue.indexOf(selected?.id);
    if (index >= 0 && index + 1 < queue.length) { select(queue[index + 1]); void resume(); }
    else { busy = false; announce(text.finished); reflect(); }
  });
  doc.addEventListener('play', event => { if (event.target?.tagName === 'AUDIO' && event.target !== audio) pause(); }, true);
  win.addEventListener('message', event => {
    if (!embedded || event.source !== win.parent || event.origin !== win.location.origin) return;
    if (event.data?.type === 'andrik-mini-player-visibility' && event.data.playing) pause();
  });
  win.addEventListener('pagehide', pause);
  reflect();
  return {register, bind, setQueue, toggle, pause, clear, getState: () => ({selected: selected?.id || null, queue: [...queue], playing: Boolean(selected && !audio.paused), busy})};
}
