(() => {
  const fileInput = document.getElementById('bulkLyricsFiles');
  const dropZone = document.getElementById('bulkLyricsDrop');
  const list = document.getElementById('bulkLyricsList');
  const status = document.getElementById('bulkLyricsStatus');
  const importButton = document.getElementById('bulkLyricsImportButton');
  const clearButton = document.getElementById('bulkLyricsClear');
  const refreshButton = document.getElementById('bulkLyricsRefreshCatalog');
  const skipExistingInput = document.getElementById('bulkLyricsSkipExisting');
  const enabledInput = document.getElementById('bulkLyricsEnabled');
  const summary = document.getElementById('bulkLyricsSummary');
  if (!fileInput || !dropZone || !list || !status || !importButton) return;

  const KEY_SESSION = 'andrik-comments-admin-key';
  const KEY_LOCAL = 'andrik-comments-admin-key-persistent';
  const MAX_ARCHIVE_BYTES = 20 * 1024 * 1024;
  const MAX_TEXT_BYTES = 2 * 1024 * 1024;
  const MAX_FILES = 100;
  let catalog = [];
  let entries = [];
  let existingIds = new Set();
  let loadingCatalog = false;

  const escapeHtml = value => String(value ?? '')
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;').replace(/'/g, '&#39;');

  function getKey() {
    const inputValue = document.getElementById('lyricsAdminKey')?.value?.trim();
    if (inputValue) return inputValue;
    try { return localStorage.getItem(KEY_LOCAL) || sessionStorage.getItem(KEY_SESSION) || ''; }
    catch (_) { return ''; }
  }

  async function api(path, options = {}) {
    const response = await fetch(path, {
      cache: 'no-store',
      ...options,
      headers: { ...(options.headers || {}), 'x-admin-key': getKey() }
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok || data.ok === false) throw new Error(data.error || `HTTP ${response.status}`);
    return data;
  }

  function normalizeTitle(value) {
    return String(value || '')
      .normalize('NFKD')
      .replace(/[\u0300-\u036f]/g, '')
      .toLowerCase()
      .replace(/ё/g, 'е')
      .replace(/^\s*andrik\s*[|–—-]\s*/i, '')
      .replace(/\b(?:official\s+(?:audio|music\s+video|video)|lyrics?\s+video|visualizer|english\s+version|официальн\p{L}*\s+(?:аудио|клип|видео))\b/giu, ' ')
      .replace(/\([^)]*\)/g, ' ')
      .replace(/[^\p{L}\p{N}]+/gu, ' ')
      .replace(/\s+/g, ' ')
      .trim();
  }

  function titleFromFilename(name) {
    const base = String(name || '').split('/').pop().replace(/\.(?:txt|lrc)$/i, '');
    return base
      .replace(/(?:^|[\s[_-])([A-Za-z0-9_-]{11})(?=$|[\s\]_-])/g, ' ')
      .replace(/^\s*\d{1,3}\s*[.)_-]+\s*/, '')
      .replace(/^\s*andrik\s*[|–—-]\s*/i, '')
      .replace(/\s+/g, ' ')
      .trim();
  }

  function extractVideoId(value) {
    const matches = String(value || '').match(/(?:youtu\.be\/|v=|shorts\/|embed\/)?([A-Za-z0-9_-]{11})(?![A-Za-z0-9_-])/g) || [];
    for (const match of matches) {
      const id = match.match(/([A-Za-z0-9_-]{11})$/)?.[1];
      if (id) return id;
    }
    return '';
  }

  function similarity(a, b) {
    if (!a || !b) return 0;
    if (a === b) return 1;
    if (a.includes(b) || b.includes(a)) return Math.min(a.length, b.length) / Math.max(a.length, b.length) * 0.95;
    const aTokens = new Set(a.split(' ').filter(Boolean));
    const bTokens = new Set(b.split(' ').filter(Boolean));
    const common = [...aTokens].filter(token => bTokens.has(token)).length;
    const union = new Set([...aTokens, ...bTokens]).size || 1;
    const tokenScore = common / union;
    const maxLength = Math.max(a.length, b.length);
    if (maxLength > 80) return tokenScore;
    const previous = Array.from({ length: b.length + 1 }, (_, i) => i);
    for (let i = 1; i <= a.length; i += 1) {
      let diagonal = previous[0];
      previous[0] = i;
      for (let j = 1; j <= b.length; j += 1) {
        const old = previous[j];
        previous[j] = Math.min(previous[j] + 1, previous[j - 1] + 1, diagonal + (a[i - 1] === b[j - 1] ? 0 : 1));
        diagonal = old;
      }
    }
    const editScore = 1 - previous[b.length] / maxLength;
    return Math.max(tokenScore, editScore * 0.9);
  }

  function findCatalogMatch(entry) {
    const explicitId = extractVideoId(`${entry.fileName} ${entry.title}`);
    if (explicitId) {
      const byId = catalog.find(item => item.videoId === explicitId);
      if (byId) return { item: byId, score: 1, reason: 'ID YouTube' };
    }
    const needle = normalizeTitle(entry.title);
    if (!needle) return null;
    const ranked = catalog.map(item => ({ item, score: similarity(needle, normalizeTitle(item.title)) }))
      .sort((a, b) => b.score - a.score);
    if (!ranked.length || ranked[0].score < 0.68) return null;
    if (ranked[1] && ranked[0].score < 0.86 && ranked[0].score - ranked[1].score < 0.08) return null;
    return { ...ranked[0], reason: ranked[0].score === 1 ? 'точное название' : 'похожее название' };
  }

  function decodeText(bytes) {
    let slice = bytes;
    if (slice[0] === 0xef && slice[1] === 0xbb && slice[2] === 0xbf) slice = slice.slice(3);
    if (slice[0] === 0xff && slice[1] === 0xfe) return new TextDecoder('utf-16le').decode(slice.slice(2));
    if (slice[0] === 0xfe && slice[1] === 0xff) {
      const swapped = new Uint8Array(slice.length - 2);
      for (let i = 2; i + 1 < slice.length; i += 2) { swapped[i - 2] = slice[i + 1]; swapped[i - 1] = slice[i]; }
      return new TextDecoder('utf-16le').decode(swapped);
    }
    const utf8 = new TextDecoder('utf-8', { fatal: false }).decode(slice);
    const replacementCount = (utf8.match(/�/g) || []).length;
    if (replacementCount > Math.max(2, utf8.length * 0.005)) {
      try { return new TextDecoder('windows-1251').decode(slice); } catch (_) {}
    }
    return utf8;
  }

  function parseLyricsText(text, fileName) {
    const source = String(text || '').replace(/^\uFEFF/, '').replace(/\r\n?/g, '\n');
    const metadata = {};
    const timed = [];
    const plain = [];
    for (const rawLine of source.split('\n')) {
      const meta = rawLine.match(/^\s*\[(ti|ar|al|by):\s*(.*?)\]\s*$/i);
      if (meta) { metadata[meta[1].toLowerCase()] = meta[2].trim(); continue; }
      const tags = [...rawLine.matchAll(/\[(\d{1,3}):(\d{2})(?:[.:](\d{1,3}))?\]/g)];
      if (tags.length) {
        const lyricText = rawLine.replace(/\[(\d{1,3}):(\d{2})(?:[.:](\d{1,3}))?\]/g, '').trim();
        if (!lyricText) continue;
        for (const tag of tags) {
          const fraction = String(tag[3] || '0');
          const ms = fraction.length === 1 ? Number(fraction) * 100 : fraction.length === 2 ? Number(fraction) * 10 : Number(fraction.slice(0, 3));
          timed.push({ startMs: (Number(tag[1]) * 60 + Number(tag[2])) * 1000 + ms, text: lyricText });
        }
      } else {
        const trimmed = rawLine.trim();
        if (trimmed) plain.push(trimmed);
      }
    }
    const lines = timed.length
      ? timed.sort((a, b) => a.startMs - b.startMs).slice(0, 1200)
      : plain.slice(0, 1200).map(line => ({ startMs: null, text: line }));
    return {
      fileName,
      title: metadata.ti || titleFromFilename(fileName),
      artist: metadata.ar || 'ANDRIK',
      lines,
      synced: Boolean(timed.length) && lines.every(line => Number.isFinite(line.startMs)),
      selectedVideoId: '',
      status: 'ready',
      note: '',
      imported: false
    };
  }

  function findEocd(view) {
    const min = Math.max(0, view.byteLength - 65557);
    for (let offset = view.byteLength - 22; offset >= min; offset -= 1) {
      if (view.getUint32(offset, true) === 0x06054b50) return offset;
    }
    return -1;
  }

  async function inflateRaw(bytes) {
    if (typeof DecompressionStream !== 'function') throw new Error('Этот браузер не умеет распаковывать ZIP. Распакуйте архив и выберите TXT/LRC.');
    let lastError;
    for (const format of ['deflate-raw', 'deflate']) {
      try {
        const stream = new Blob([bytes]).stream().pipeThrough(new DecompressionStream(format));
        return new Uint8Array(await new Response(stream).arrayBuffer());
      } catch (error) { lastError = error; }
    }
    throw lastError || new Error('Не удалось распаковать ZIP');
  }

  async function readZip(file) {
    if (file.size > MAX_ARCHIVE_BYTES) throw new Error(`ZIP больше ${Math.round(MAX_ARCHIVE_BYTES / 1024 / 1024)} МБ`);
    const buffer = await file.arrayBuffer();
    const view = new DataView(buffer);
    const eocd = findEocd(view);
    if (eocd < 0) throw new Error('Не найден каталог ZIP');
    const totalEntries = view.getUint16(eocd + 10, true);
    let offset = view.getUint32(eocd + 16, true);
    const output = [];
    for (let index = 0; index < totalEntries && output.length < MAX_FILES; index += 1) {
      if (offset + 46 > view.byteLength || view.getUint32(offset, true) !== 0x02014b50) throw new Error('Повреждён каталог ZIP');
      const flags = view.getUint16(offset + 8, true);
      const method = view.getUint16(offset + 10, true);
      const compressedSize = view.getUint32(offset + 20, true);
      const uncompressedSize = view.getUint32(offset + 24, true);
      const nameLength = view.getUint16(offset + 28, true);
      const extraLength = view.getUint16(offset + 30, true);
      const commentLength = view.getUint16(offset + 32, true);
      const localOffset = view.getUint32(offset + 42, true);
      const nameBytes = new Uint8Array(buffer, offset + 46, nameLength);
      const name = new TextDecoder(flags & 0x0800 ? 'utf-8' : 'utf-8').decode(nameBytes);
      offset += 46 + nameLength + extraLength + commentLength;
      if (name.endsWith('/') || /(^|\/)__MACOSX\//.test(name) || /(^|\/)\./.test(name) || !/\.(?:txt|lrc)$/i.test(name)) continue;
      if (flags & 0x0001) throw new Error(`Файл ${name} зашифрован`);
      if (uncompressedSize > MAX_TEXT_BYTES) throw new Error(`Файл ${name} слишком большой`);
      if (localOffset + 30 > view.byteLength || view.getUint32(localOffset, true) !== 0x04034b50) throw new Error(`Повреждён файл ${name}`);
      const localNameLength = view.getUint16(localOffset + 26, true);
      const localExtraLength = view.getUint16(localOffset + 28, true);
      const dataOffset = localOffset + 30 + localNameLength + localExtraLength;
      if (dataOffset + compressedSize > view.byteLength) throw new Error(`Повреждены данные ${name}`);
      const compressed = new Uint8Array(buffer, dataOffset, compressedSize);
      let bytes;
      if (method === 0) bytes = compressed.slice();
      else if (method === 8) bytes = await inflateRaw(compressed);
      else throw new Error(`Метод сжатия ${method} не поддерживается: ${name}`);
      output.push({ name, text: decodeText(bytes) });
    }
    return output;
  }

  async function filesToEntries(files) {
    const unpacked = [];
    for (const file of [...files].slice(0, MAX_FILES)) {
      if (/\.zip$/i.test(file.name)) {
        const contents = await readZip(file);
        unpacked.push(...contents);
      } else if (/\.(?:txt|lrc)$/i.test(file.name)) {
        if (file.size > MAX_TEXT_BYTES) throw new Error(`${file.name} больше 2 МБ`);
        unpacked.push({ name: file.name, text: decodeText(new Uint8Array(await file.arrayBuffer())) });
      }
    }
    if (!unpacked.length) throw new Error('В выбранных файлах нет TXT или LRC');
    return unpacked.slice(0, MAX_FILES).map(item => parseLyricsText(item.text, item.name)).filter(item => item.lines.length);
  }

  async function loadCatalog(force = false) {
    if (loadingCatalog) return;
    if (!getKey()) { status.textContent = 'Сначала сохраните ключ владельца в «Служебное».'; return; }
    if (catalog.length && !force) return;
    loadingCatalog = true;
    refreshButton && (refreshButton.disabled = true);
    status.textContent = 'Получаем 34 песни из официальных YouTube-плейлистов…';
    try {
      const [catalogData, lyricsData] = await Promise.all([
        api('/api/lyrics/catalog'),
        api('/api/lyrics/admin')
      ]);
      catalog = catalogData.items || [];
      existingIds = new Set((lyricsData.lyrics || []).map(item => item.videoId));
      status.textContent = `Каталог загружен: ${catalog.length} песен. Можно выбирать TXT, LRC или ZIP.`;
      rematchEntries();
    } catch (error) {
      status.textContent = `Не удалось загрузить каталог: ${error.message}`;
    } finally {
      loadingCatalog = false;
      refreshButton && (refreshButton.disabled = false);
    }
  }

  function rematchEntries() {
    entries.forEach(entry => {
      if (entry.selectedVideoId && catalog.some(item => item.videoId === entry.selectedVideoId)) return;
      const match = findCatalogMatch(entry);
      entry.selectedVideoId = match?.item?.videoId || '';
      entry.note = match ? `Совпадение: ${match.reason}` : 'Выберите песню вручную';
    });
    render();
  }

  function optionHtml(entry) {
    const groups = new Map();
    for (const item of catalog) {
      if (!groups.has(item.playlistTitle)) groups.set(item.playlistTitle, []);
      groups.get(item.playlistTitle).push(item);
    }
    let html = '<option value="">— выберите песню —</option>';
    for (const [group, items] of groups) {
      html += `<optgroup label="${escapeHtml(group || 'ANDRIK')}">`;
      html += items.map(item => `<option value="${escapeHtml(item.videoId)}"${item.videoId === entry.selectedVideoId ? ' selected' : ''}>${escapeHtml(item.title)}</option>`).join('');
      html += '</optgroup>';
    }
    return html;
  }

  function render() {
    if (!entries.length) {
      list.innerHTML = '<div class="admin-empty">Выберите несколько TXT/LRC или один ZIP. Каждый файл считается отдельной песней.</div>';
      summary.textContent = catalog.length ? `${catalog.length} песен в каталоге` : 'Каталог загружается…';
      importButton.disabled = true;
      return;
    }
    const matched = entries.filter(item => item.selectedVideoId).length;
    const synced = entries.filter(item => item.synced).length;
    const imported = entries.filter(item => item.imported).length;
    summary.textContent = `${entries.length} файлов · сопоставлено ${matched} · с таймингами ${synced}${imported ? ` · импортировано ${imported}` : ''}`;
    importButton.disabled = matched === 0;
    list.innerHTML = entries.map((entry, index) => {
      const selected = catalog.find(item => item.videoId === entry.selectedVideoId);
      const exists = selected && existingIds.has(selected.videoId);
      const state = entry.status === 'error' ? 'is-error' : entry.imported ? 'is-done' : !entry.selectedVideoId ? 'is-warning' : exists ? 'is-existing' : 'is-ready';
      const badge = entry.status === 'error' ? entry.note : entry.imported ? 'Импортировано' : !entry.selectedVideoId ? 'Нужно выбрать песню' : exists ? 'Текст уже есть' : entry.synced ? 'LRC · тайминги готовы' : 'TXT · без таймингов';
      return `<article class="bulk-lyric-row ${state}" data-index="${index}">
        <div class="bulk-lyric-file"><span>${entry.synced ? '⏱' : '📄'}</span><div><strong>${escapeHtml(entry.fileName)}</strong><small>${entry.lines.length} строк · ${escapeHtml(entry.title || 'без названия')}</small></div></div>
        <label>Песня в каталоге<select data-action="song">${optionHtml(entry)}</select></label>
        <div class="bulk-lyric-result"><span>${escapeHtml(badge)}</span><small>${escapeHtml(entry.note || '')}</small></div>
        <button class="bulk-lyric-remove" data-action="remove" type="button" aria-label="Убрать файл">×</button>
      </article>`;
    }).join('');
  }

  async function acceptFiles(files) {
    if (!files?.length) return;
    status.textContent = 'Читаем файлы…';
    try {
      if (!catalog.length) await loadCatalog();
      const parsed = await filesToEntries(files);
      entries.push(...parsed);
      if (entries.length > MAX_FILES) entries = entries.slice(0, MAX_FILES);
      rematchEntries();
      status.textContent = `Подготовлено ${parsed.length} файлов. Проверьте совпадения перед импортом.`;
    } catch (error) {
      status.textContent = `Ошибка файлов: ${error.message}`;
    } finally {
      fileInput.value = '';
    }
  }

  async function importAll() {
    const key = getKey();
    if (!key) { status.textContent = 'Сначала сохраните ключ владельца в «Служебное».'; return; }
    const candidates = entries.filter(item => item.selectedVideoId && !item.imported);
    if (!candidates.length) { status.textContent = 'Нет подготовленных файлов для импорта.'; return; }
    importButton.disabled = true;
    clearButton && (clearButton.disabled = true);
    let saved = 0;
    let skipped = 0;
    let failed = 0;
    for (let index = 0; index < candidates.length; index += 1) {
      const entry = candidates[index];
      const item = catalog.find(song => song.videoId === entry.selectedVideoId);
      if (!item) { entry.status = 'error'; entry.note = 'Песня исчезла из каталога'; failed += 1; continue; }
      if (skipExistingInput?.checked && existingIds.has(item.videoId)) {
        entry.status = 'skipped'; entry.note = 'Пропущено: текст уже сохранён'; skipped += 1; render(); continue;
      }
      status.textContent = `Импорт ${index + 1} из ${candidates.length}: ${item.title}…`;
      try {
        await api('/api/lyrics/admin', {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({
            videoId: item.videoId,
            title: item.title,
            artist: entry.artist || 'ANDRIK',
            enabled: enabledInput?.checked !== false,
            lines: entry.lines
          })
        });
        entry.imported = true;
        entry.status = 'done';
        entry.note = entry.synced ? 'Сохранено с таймингами' : 'Сохранено как обычный текст';
        existingIds.add(item.videoId);
        saved += 1;
      } catch (error) {
        entry.status = 'error';
        entry.note = `Ошибка: ${error.message}`;
        failed += 1;
      }
      render();
    }
    status.textContent = `Готово: сохранено ${saved}, пропущено ${skipped}, ошибок ${failed}. Push-уведомления не отправлялись.`;
    importButton.disabled = false;
    clearButton && (clearButton.disabled = false);
    document.getElementById('lyricsRefreshList')?.click();
  }

  fileInput.addEventListener('change', event => acceptFiles(event.target.files));
  dropZone.addEventListener('dragover', event => { event.preventDefault(); dropZone.classList.add('is-dragover'); });
  dropZone.addEventListener('dragleave', () => dropZone.classList.remove('is-dragover'));
  dropZone.addEventListener('drop', event => { event.preventDefault(); dropZone.classList.remove('is-dragover'); acceptFiles(event.dataTransfer.files); });
  list.addEventListener('change', event => {
    const row = event.target.closest('[data-index]');
    if (!row || event.target.dataset.action !== 'song') return;
    const entry = entries[Number(row.dataset.index)];
    entry.selectedVideoId = event.target.value;
    entry.note = entry.selectedVideoId ? 'Выбрано вручную' : 'Выберите песню вручную';
    entry.imported = false;
    entry.status = 'ready';
    render();
  });
  list.addEventListener('click', event => {
    if (event.target.dataset.action !== 'remove') return;
    const row = event.target.closest('[data-index]');
    if (!row) return;
    entries.splice(Number(row.dataset.index), 1);
    render();
  });
  importButton.addEventListener('click', importAll);
  clearButton?.addEventListener('click', () => { entries = []; render(); status.textContent = 'Список очищен.'; });
  refreshButton?.addEventListener('click', () => loadCatalog(true));

  render();
  if (getKey()) loadCatalog();
  else status.textContent = 'Сохраните ключ в «Служебное», затем вернитесь сюда.';
})();
