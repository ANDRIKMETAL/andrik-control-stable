/* R1513 — a ZIP album upload through existing owner-authenticated music endpoints. */
(() => {
  'use strict';
  const ALBUM = 'no-one-to-become';
  const ALBUM_NAME = 'No One to Become';
  const MAX_ZIP = 1024 * 1024 * 1024;
  const MAX_TRACK = 40 * 1024 * 1024;
  const PART_SIZE = 8 * 1024 * 1024;
  const decoder = new TextDecoder('utf-8');
  let crcTable;

  function crc32(bytes) {
    if (!crcTable) {
      crcTable = new Uint32Array(256);
      for (let n = 0; n < 256; n++) {
        let c = n;
        for (let k = 0; k < 8; k++) c = (c & 1) ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
        crcTable[n] = c >>> 0;
      }
    }
    let crc = 0xffffffff;
    for (const byte of bytes) crc = crcTable[(crc ^ byte) & 255] ^ (crc >>> 8);
    return (crc ^ 0xffffffff) >>> 0;
  }

  function titleFromName(name) {
    return String(name).split('/').pop().replace(/\.mp3$/i, '')
      .replace(/^\s*\d{1,3}[\s._-]+/, '').replace(/_+/g, ' ').replace(/\s+/g, ' ').trim() || 'Track';
  }

  function trackNumber(name) {
    return Number(String(name).split('/').pop().match(/^\s*(\d{1,3})[\s._-]+/)?.[1]) || 0;
  }

  async function scanZip(file) {
    if (!file || file.size < 22 || file.size > MAX_ZIP) throw new Error('Нужен ZIP размером до 1 ГБ.');
    const tailStart = Math.max(0, file.size - 65557);
    const tail = new DataView(await file.slice(tailStart).arrayBuffer());
    let end = -1;
    for (let p = tail.byteLength - 22; p >= 0; p--) {
      if (tail.getUint32(p, true) === 0x06054b50 && p + 22 + tail.getUint16(p + 20, true) === tail.byteLength) { end = p; break; }
    }
    if (end < 0) throw new Error('ZIP повреждён или загружен не полностью.');
    if (tail.getUint16(end + 4, true) || tail.getUint16(end + 6, true)) throw new Error('Выбери один обычный ZIP без разделения на тома.');
    const count = tail.getUint16(end + 10, true);
    const centralSize = tail.getUint32(end + 12, true);
    const centralStart = tail.getUint32(end + 16, true);
    if (count === 65535 || centralSize === 0xffffffff || centralStart === 0xffffffff) throw new Error('Выбери обычный ZIP без ZIP64.');
    if (!count || count > 512 || count !== tail.getUint16(end + 8, true) || centralSize > 2 * 1024 * 1024 || centralStart + centralSize > tailStart + end) throw new Error('Некорректный каталог ZIP.');
    const centralBytes = await file.slice(centralStart, centralStart + centralSize).arrayBuffer();
    const central = new DataView(centralBytes);
    let pos = 0;
    const entries = [], names = new Set();
    for (let i = 0; i < count; i++) {
      if (pos + 46 > central.byteLength || central.getUint32(pos, true) !== 0x02014b50) throw new Error('Повреждён каталог ZIP.');
      const flags = central.getUint16(pos + 8, true), method = central.getUint16(pos + 10, true);
      const crc = central.getUint32(pos + 16, true), compressedSize = central.getUint32(pos + 20, true);
      const size = central.getUint32(pos + 24, true), nameSize = central.getUint16(pos + 28, true);
      const extraSize = central.getUint16(pos + 30, true), commentSize = central.getUint16(pos + 32, true);
      const attributes = central.getUint32(pos + 38, true), localOffset = central.getUint32(pos + 42, true);
      const next = pos + 46 + nameSize + extraSize + commentSize;
      if (next > central.byteLength) throw new Error('Повреждено имя файла в ZIP.');
      const name = decoder.decode(new Uint8Array(centralBytes, pos + 46, nameSize)).replace(/\\/g, '/');
      pos = next;
      if (!/\.mp3$/i.test(name) || /(^|\/)__MACOSX\//.test(name) || /(^|\/)\._/.test(name)) continue;
      if (name.startsWith('/') || /^[A-Za-z]:/.test(name) || name.split('/').some(part => !part || part === '..' || part === '.') || /[\x00-\x1f]/.test(name)) throw new Error('Недопустимое имя MP3 в ZIP.');
      if (names.has(name)) throw new Error('Повторяющийся MP3 в ZIP: ' + name);
      names.add(name);
      if (flags & 1) throw new Error('ZIP с паролем не поддерживается.');
      if (((attributes >>> 16) & 0xf000) === 0xa000) throw new Error('В ZIP вместо MP3 обнаружена ссылка.');
      if (![0, 8].includes(method)) throw new Error('Создай ZIP с обычным сжатием DEFLATE или без сжатия.');
      if (!size || size > MAX_TRACK || compressedSize > MAX_TRACK || localOffset === 0xffffffff) throw new Error('Каждый MP3 должен быть не больше 40 МБ: ' + name);
      if (localOffset + 30 > centralStart) throw new Error('Повреждён заголовок MP3: ' + name);
      const local = new DataView(await file.slice(localOffset, localOffset + 30).arrayBuffer());
      if (local.getUint32(0, true) !== 0x04034b50 || local.getUint16(8, true) !== method || (local.getUint16(6, true) & 1)) throw new Error('Повреждён заголовок MP3: ' + name);
      const dataStart = localOffset + 30 + local.getUint16(26, true) + local.getUint16(28, true);
      if (dataStart + compressedSize > centralStart || (method === 0 && compressedSize !== size)) throw new Error('Повреждены данные MP3: ' + name);
      entries.push({name, title: titleFromName(name), method, crc, compressedSize, size, dataStart});
    }
    if (!entries.length) throw new Error('В ZIP не найдено MP3. WAV сначала преобразуй в MP3.');
    entries.sort((a, b) => {
      const an = trackNumber(a.name), bn = trackNumber(b.name);
      if (an && bn && an !== bn) return an - bn;
      if (Boolean(an) !== Boolean(bn)) return an ? -1 : 1;
      return a.name.localeCompare(b.name, 'en', {numeric: true, sensitivity: 'base'});
    });
    return entries.map((entry, index) => ({...entry, track: index + 1}));
  }

  async function unpackTrack(file, entry, signal) {
    signal?.throwIfAborted();
    const compressed = file.slice(entry.dataStart, entry.dataStart + entry.compressedSize);
    let bytes;
    if (entry.method === 0) bytes = new Uint8Array(await compressed.arrayBuffer());
    else {
      let stream;
      try { stream = new DecompressionStream('deflate-raw'); }
      catch (_) { throw new Error('Этот браузер не распаковывает сжатый ZIP. Создай ZIP без сжатия или обнови браузер.'); }
      const reader = compressed.stream().pipeThrough(stream).getReader(), chunks = [];
      let total = 0;
      const onAbort = () => { reader.cancel().catch(() => {}); };
      signal?.addEventListener('abort', onAbort, {once: true});
      try {
        while (true) {
          signal?.throwIfAborted();
          const part = await reader.read();
          if (part.done) break;
          total += part.value.byteLength;
          if (total > entry.size || total > MAX_TRACK) { await reader.cancel(); throw new Error('MP3 превышает заявленный размер: ' + entry.name); }
          chunks.push(part.value);
        }
        bytes = new Uint8Array(total);
        let offset = 0;
        for (const chunk of chunks) { bytes.set(chunk, offset); offset += chunk.byteLength; }
      } finally { signal?.removeEventListener('abort', onAbort); reader.releaseLock(); }
    }
    signal?.throwIfAborted();
    if (bytes.length !== entry.size || crc32(bytes) !== entry.crc) throw new Error('Не совпала контрольная сумма MP3: ' + entry.name);
    return new Blob([bytes], {type: 'audio/mpeg'});
  }

  window.AndrikAlbumZipR1513 = Object.freeze({scanZip, unpackTrack});
  const root = document.getElementById('albumZipUploadR1513');
  if (!root) return;
  const element = id => document.getElementById(id);
  const input = element('albumZipFileR1513'), pick = element('albumZipPickR1513'), go = element('albumZipGoR1513');
  const cancel = element('albumZipCancelR1513'), progress = element('albumZipProgressR1513');
  const status = element('albumZipStatusR1513'), preview = element('albumZipPreviewR1513'), download = element('albumZipDownloadR1513');
  let selected = null, entries = [], busy = false, scanVersion = 0, controller = null;

  function setStatus(text, kind = '') { status.textContent = text; status.dataset.kind = kind; }
  function auth(headers = {}) {
    const key = element('lyricsAdminKey')?.value?.trim();
    return key ? {...headers, 'x-admin-key': key} : headers;
  }
  async function request(url, options = {}) {
    const response = await fetch(url, {cache: 'no-store', credentials: 'same-origin', ...options, headers: auth(options.headers)});
    const data = await response.json().catch(() => ({}));
    if (response.status === 401) throw new Error('Доступ владельца истёк. Войди в контрольку и повтори загрузку.');
    if (!response.ok || data.ok === false) {
      const error = new Error(data.message || data.error || ('HTTP ' + response.status));
      error.status = response.status;
      throw error;
    }
    return data;
  }
  const endpoint = (action, uploadId = '') => '/api/control/music/albums/mpu/' + action + '?album=' + ALBUM + (uploadId ? '&uploadId=' + encodeURIComponent(uploadId) : '');
  function safeName(entry) {
    const stem = entry.title.toLowerCase().normalize('NFKD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 120) || 'track';
    return String(entry.track).padStart(2, '0') + '-' + stem + '.mp3';
  }
  async function uploadArchive(file, signal) {
    const start = await request(endpoint('start') + '&direct=1', {method: 'POST', signal});
    const parts = [];
    let completed = false;
    try {
      const partSize = Number(start.partSize) || PART_SIZE;
      for (let offset = 0, number = 1; offset < file.size; offset += partSize, number++) {
        signal.throwIfAborted();
        const part = file.slice(offset, Math.min(file.size, offset + partSize));
        setStatus('ZIP → R2: часть ' + number + ' · ' + Math.round(offset / file.size * 100) + '%');
        let result;
        for (let attempt = 0; attempt < 3; attempt++) {
          try { result = await request(endpoint('part', start.uploadId) + '&partNumber=' + number, {method: 'PUT', headers: {'content-type': 'application/octet-stream'}, body: part, signal}); break; }
          catch (error) {
            if (signal.aborted || (error.status && error.status < 500 && error.status !== 429) || attempt === 2) throw error;
            await new Promise(resolve => setTimeout(resolve, 400 * (attempt + 1)));
            signal.throwIfAborted();
          }
        }
        parts.push({partNumber: result.partNumber, etag: result.etag});
        progress.value = 75 + Math.round(Math.min(file.size, offset + part.size) / file.size * 24);
      }
      const result = await request(endpoint('complete', start.uploadId), {method: 'POST', headers: {'content-type': 'application/json'}, body: JSON.stringify({parts}), signal});
      completed = true;
      return result;
    } finally {
      if (!completed) await request(endpoint('abort', start.uploadId), {method: 'DELETE'}).catch(() => {});
    }
  }

  pick.addEventListener('click', () => input.click());
  input.addEventListener('change', async () => {
    const version = ++scanVersion;
    selected = input.files?.[0] || null;
    entries = [];
    go.disabled = true;
    progress.value = 0;
    preview.replaceChildren();
    download.hidden = true;
    if (!selected) { setStatus('Выбери ZIP с MP3 для ' + ALBUM_NAME + '.'); return; }
    const file = selected;
    setStatus('Проверяем ZIP…');
    try {
      const parsed = await scanZip(file);
      if (version !== scanVersion) return;
      // Confirm decompression support and the first track before making any network writes.
      await unpackTrack(file, parsed[0]);
      if (version !== scanVersion) return;
      entries = parsed;
      for (const entry of entries) {
        const li = document.createElement('li'), title = document.createElement('span'), size = document.createElement('small');
        title.textContent = entry.title;
        size.textContent = (entry.size / 1024 / 1024).toFixed(1) + ' МБ';
        li.append(title, size);
        preview.append(li);
      }
      setStatus(file.name + ' · ' + entries.length + ' MP3 · ' + (file.size / 1024 / 1024).toFixed(1) + ' МБ' + (entries.length === 12 ? '. Можно загружать.' : '. Ожидается 12 треков — проверь состав архива.'), entries.length === 12 ? 'ok' : '');
      go.disabled = false;
    } catch (error) { if (version === scanVersion) setStatus(error.message, 'error'); }
  });
  cancel.addEventListener('click', () => { controller?.abort(); setStatus('Отменяем загрузку…'); });
  window.addEventListener('beforeunload', event => { if (busy) { event.preventDefault(); event.returnValue = ''; } });
  go.addEventListener('click', async () => {
    if (busy || !selected || !entries.length) return;
    busy = true;
    controller = new AbortController();
    const signal = controller.signal, file = selected, tracks = entries.slice();
    let uploaded = 0;
    go.disabled = true;
    pick.disabled = true;
    cancel.hidden = false;
    download.hidden = true;
    progress.value = 0;
    try {
      for (const entry of tracks) {
        signal.throwIfAborted();
        setStatus('MP3 ' + entry.track + '/' + tracks.length + ': ' + entry.title);
        const body = await unpackTrack(file, entry, signal);
        await request('/api/control/music/mp3?folder=albums%2F' + ALBUM + '&name=' + encodeURIComponent(safeName(entry)), {
          method: 'PUT', signal, body,
          headers: {'content-type': 'audio/mpeg', 'x-andrik-track-title': encodeURIComponent(entry.title), 'x-andrik-track-artist': 'ANDRIK', 'x-andrik-track-album': encodeURIComponent(ALBUM_NAME), 'x-andrik-track-number': String(entry.track), 'x-andrik-track-year': '2026', 'x-andrik-track-genre': 'Heavy Metal'}
        });
        uploaded++;
        progress.value = Math.round(uploaded / tracks.length * 75);
      }
      const result = await uploadArchive(file, signal);
      download.href = result.album?.zip?.downloadUrl || '/api/music/album-download?album=' + ALBUM;
      download.hidden = false;
      progress.value = 100;
      setStatus('Готово ✅ ' + ALBUM_NAME + ': ZIP и ' + uploaded + ' MP3 сохранены в R2. Прослушивание и скачивание доступны на странице альбома.', 'ok');
    } catch (error) {
      setStatus((signal.aborted ? 'Загрузка отменена.' : 'Загрузка не завершена: ' + error.message) + (uploaded ? ' Уже сохранено MP3: ' + uploaded + '/' + tracks.length + '. Можно повторить с тем же ZIP.' : ''), signal.aborted ? '' : 'error');
    } finally {
      busy = false;
      controller = null;
      go.disabled = false;
      pick.disabled = false;
      cancel.hidden = true;
    }
  });
})();
