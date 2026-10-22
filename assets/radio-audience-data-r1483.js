/* R1483: one dated audience request shared by the counters and graphs. */
(() => {
  'use strict';
  if (window.AndrikRadioDataR1483) return;
  const cache = new Map(), pending = new Map();
  const today = () => new Intl.DateTimeFormat('en-CA', {timeZone:'Europe/Bratislava',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date());
  function headers() {
    let key = '';
    try { key = localStorage.getItem('andrik-comments-admin-key-persistent') || sessionStorage.getItem('andrik-comments-admin-key') || ''; } catch (_) {}
    return {accept:'application/json', ...(key ? {'x-admin-key':key, authorization:`Bearer ${key}`} : {})};
  }
  async function load(date = '', {force = false} = {}) {
    const day = today(), selected = date && date !== day ? String(date) : '';
    const key = selected || day, saved = cache.get(key);
    if (!force && saved && Date.now() - saved.at < 15000) return saved.data;
    if (pending.has(key)) return pending.get(key);
    const work = (async () => {
      const controller = new AbortController(), timer = setTimeout(() => controller.abort(), 30000);
      try {
        const qs = new URLSearchParams({ts:String(Date.now())});
        if (selected) qs.set('date', selected);
        const response = await fetch(`/api/control/radio-audience-r1157?${qs}`, {credentials:'include', cache:'no-store', headers:headers(), signal:controller.signal});
        const data = await response.json().catch(() => ({}));
        if (!response.ok || !data.ok) throw new Error(data.message || data.error || `HTTP ${response.status}`);
        cache.set(key, {at:Date.now(), data});
        if (cache.size > 12) cache.delete(cache.keys().next().value);
        return data;
      } catch (error) {
        if (error.name === 'AbortError') throw new Error('Сервер не ответил за 30 секунд. Повтори обновление.');
        throw error;
      } finally { clearTimeout(timer); }
    })();
    pending.set(key, work);
    try { return await work; } finally { if (pending.get(key) === work) pending.delete(key); }
  }
  window.AndrikRadioDataR1483 = {load, invalidate:() => cache.clear()};
})();
