/* R1485: public API view-count history, observed deltas and owner live viewers, never synthetic zeros. */
(() => {
  'use strict';
  const root = document.getElementById('radioAudienceR1156');
  if (!root || window.AndrikRadioAudienceR1483) return;
  const $ = id => document.getElementById(id);
  const esc = value => String(value ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const number = value => new Intl.NumberFormat('ru-RU', {maximumFractionDigits:1}).format(Math.max(0, Number(value) || 0));
  const text = (id, value) => { const el = $(id); if (el) el.textContent = value; };
  const dateInput = $('radioAudienceDateR1156'), previous = $('radioAudiencePrevR1156'), next = $('radioAudienceNextR1156'), todayButton = $('radioAudienceTodayR1156');
  const containers = {viewers:$('radioAudienceViewersChartR1235'), launches:$('radioAudienceLaunchesChartR1235'), views:$('radioAudienceCumulativeChartR1485')};
  const timeFormatter = new Intl.DateTimeFormat('ru-RU', {timeZone:'Europe/Bratislava', hour:'2-digit', minute:'2-digit', hourCycle:'h23'});
  const fullTimeFormatter = new Intl.DateTimeFormat('ru-RU', {timeZone:'Europe/Bratislava',hour:'2-digit',minute:'2-digit',second:'2-digit',timeZoneName:'shortOffset',hourCycle:'h23'});
  const dayFormatter = new Intl.DateTimeFormat('en-CA', {timeZone:'Europe/Bratislava',year:'numeric',month:'2-digit',day:'2-digit'});
  let data = null, serverToday = '', generation = 0, selected = null, modalKind = '', modal = null;
  let windowMinutes = 360, startMinute = 0, followLatest = true, resizeTimer = 0;
  const currentDay = () => {if(serverToday)return serverToday;const p=Object.fromEntries(dayFormatter.formatToParts(new Date()).map(part=>[part.type,part.value]));return `${p.year}-${p.month}-${p.day}`;};
  const isToday = () => Boolean(data && data.date === data.today);
  const parsedTime = value => {
    const raw = String(value || '');
    return Date.parse(/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}$/.test(raw) ? raw.replace(' ', 'T') + 'Z' : raw);
  };
  function shiftDate(date, days) {
    const stamp = Date.parse(`${date}T12:00:00Z`);
    return Number.isFinite(stamp) ? new Date(stamp + days * 86400000).toISOString().slice(0, 10) : currentDay();
  }
  function dayStart(date) {
    const parts = new Intl.DateTimeFormat('en-CA', {timeZone:'Europe/Bratislava',year:'numeric',month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit',hourCycle:'h23'});
    const midnight = Date.parse(`${date}T00:00:00Z`);
    let candidate = midnight;
    for (let i = 0; i < 3; i++) {
      const p = Object.fromEntries(parts.formatToParts(new Date(candidate)).map(part => [part.type, part.value]));
      const local = Date.UTC(+p.year, +p.month - 1, +p.day, +p.hour, +p.minute);
      const correction = midnight - local;
      candidate += correction;
      if (!correction) break;
    }
    return candidate;
  }
  function context() {
    const date = data?.date || dateInput.value || currentDay(), start = dayStart(date), end = dayStart(shiftDate(date, 1));
    const length = (end - start) / 60000;
    const points = (Array.isArray(data?.series) ? data.series : []).map((row, index) => {
      const at = parsedTime(row.sampledAt), match = String(row.minute || '').match(/^(\d{2}):(\d{2})$/);
      const minute = Number.isFinite(at) ? (at - start) / 60000 : match ? +match[1] * 60 + +match[2] : null;
      return {...row, index, at, minute, online:row.concurrentViewers == null ? null : Math.max(0, Number(row.concurrentViewers) || 0), launches:row.launches==null?null:Math.max(0, Number(row.launches) || 0), views:row.views==null?null:Math.max(0,Number(row.views)||0)};
    }).filter(point => point.minute != null && point.minute >= 0 && point.minute < length).sort((a, b) => a.minute - b.minute || a.index - b.index);
    return {date, start, end, length, points};
  }
  function range(ctx = context()) {
    const width = windowMinutes ? Math.min(windowMinutes, ctx.length) : ctx.length;
    if (followLatest) {
      const latest = isToday() ? Math.max(0, Math.min(ctx.length, (Date.now() - ctx.start) / 60000)) : ctx.length;
      startMinute = windowMinutes ? Math.max(0, Math.min(ctx.length - width, Math.ceil(latest / 15) * 15 - width)) : 0;
    }
    startMinute = Math.max(0, Math.min(ctx.length - width, startMinute));
    return {start:startMinute, end:startMinute + width, width};
  }
  function label(minute, ctx, endOfDay = false) {
    if (endOfDay && Math.abs(minute - ctx.length) < .01) return '24:00';
    return timeFormatter.format(new Date(ctx.start + minute * 60000));
  }
  function setState(value, kind) {
    const state = $('radioAudienceStateR1156');
    if (state) { state.textContent = value; state.dataset.kind = kind || ''; }
  }
  function dateButtons() {
    if (dateInput) dateInput.max = currentDay();
    if (next) next.disabled = !dateInput.value || dateInput.value >= currentDay();
    if (todayButton) todayButton.disabled = dateInput.value === currentDay();
  }
  function controls(ctx, span) {
    document.querySelectorAll('[data-audience-window]').forEach(button => button.setAttribute('aria-pressed', String(Number(button.dataset.audienceWindow) === windowMinutes)));
    const title = `${label(span.start, ctx)}–${label(span.end, ctx, true)}`;
    text('radioAudienceRangeR1483', title);
    document.querySelectorAll('[data-audience-range]').forEach(el => { el.textContent = title; });
    document.querySelectorAll('#radioAudiencePanR1483,[data-audience-pan-slider]').forEach(input => {
      input.max = String(Math.max(0, ctx.length - span.width)); input.value = String(Math.round(span.start)); input.disabled = !windowMinutes || span.width >= ctx.length;
      input.setAttribute('aria-valuetext', title);
    });
    document.querySelectorAll('[data-audience-pan]').forEach(button => { button.disabled = !windowMinutes || (Number(button.dataset.audiencePan) < 0 ? span.start <= 0 : span.end >= ctx.length); });
    document.querySelectorAll('[data-audience-zoom="in"]').forEach(button => { button.disabled = span.width <= 15; });
    document.querySelectorAll('[data-audience-zoom="out"]').forEach(button => { button.disabled = span.width >= ctx.length; });
  }
  function axes(ctx, span, width, height, values) {
    const left = 40, right = 16, top = 22, bottom = 48, plotW = width - left - right, plotH = height - top - bottom;
    const largest = Math.max(2, ...values), ideal = Math.ceil(largest / 4);
    const step = [1,2,5,10,20,50,100,200,500,1000,2000,5000].find(value => value >= ideal) || ideal;
    const max = Math.ceil(largest / step) * step;
    const x = minute => left + (minute - span.start) / span.width * plotW, y = value => top + plotH * (1 - value / max);
    const tickStep = span.width <= 60 ? 10 : span.width <= 180 ? 30 : span.width <= 360 ? 60 : span.width <= 720 ? 120 : 240;
    const ticks = [span.start];
    for (let m = Math.ceil(span.start / tickStep) * tickStep; m < span.end; m += tickStep) {
      if (x(m) - left >= 74 && width - right - x(m) >= 74 && x(m) - x(ticks[ticks.length - 1]) >= 74) ticks.push(m);
    }
    ticks.push(span.end);
    let markup = ticks.map((m, i) => `<line class="grid" x1="${x(m)}" y1="${top}" x2="${x(m)}" y2="${top+plotH}"/><text class="axis-text" x="${x(m)}" y="${height-24}" text-anchor="${i===0?'start':i===ticks.length-1?'end':'middle'}">${label(m, ctx, true)}</text>`).join('');
    for (let value = 0; value <= max; value += step) markup += `<line class="grid" x1="${left}" y1="${y(value)}" x2="${width-right}" y2="${y(value)}"/><text class="axis-text axis-y" x="${left-6}" y="${y(value)+4}" text-anchor="end">${number(value)}</text>`;
    markup += `<path class="axis-line" fill="none" d="M ${left} ${top} V ${top+plotH} H ${width-right}"/><text class="axis-caption" x="${width-right}" y="${height-5}" text-anchor="end">Время · Bratislava</text>`;
    return {left,right,top,bottom,plotW,plotH,x,y,max,markup};
  }
  function bucketSize(span) { return span.width <= 60 ? 5 : span.width <= 180 ? 10 : span.width <= 360 ? 15 : span.width <= 720 ? 30 : 60; }
  function bucketsFor(ctx, span) {
    const size = bucketSize(span), buckets = [];
    for (let start = span.start; start < span.end; start += size) buckets.push({start,end:Math.min(span.end,start+size),value:0});
    for (const point of ctx.points) if (point.minute >= span.start && point.minute <= span.end && buckets.length) buckets[Math.min(buckets.length-1, Math.floor((point.minute-span.start)/size))].value += point.launches;
    return {size, buckets};
  }
  function collectorMessageR1484(raw) {
    const value=String(raw||'');
    if(/quota|dailyLimit/i.test(value))return 'Исчерпана квота YouTube API.';
    if(/oauth-not-connected|oauth-client-not-configured|invalid_grant|expired|revoked/i.test(value))return 'Проверь подключение YouTube для статистики.';
    if(/sample-not-saved|D1|database|binding/i.test(value))return 'Не удалось записать замер в историю.';
    if(/concurrentViewers-missing/i.test(value))return 'YouTube API не вернул число зрителей онлайн.';
    if(/viewCount-missing/i.test(value))return 'YouTube API не вернул счётчик просмотров.';
    return value;
  }
  function draw(kind, container, ctx, span, expanded = false) {
    if (!container) return;
    const points = ctx.points.filter(point => point.minute >= span.start && point.minute <= span.end);
    const values = kind === 'viewers' ? points.filter(p => p.online != null).map(p => p.online) : kind === 'views' ? points.filter(p=>p.views!=null).map(p=>p.views) : bucketsFor(ctx, span).buckets.map(bucket => bucket.value);
    const any = kind === 'viewers' || kind === 'views' ? values.length : points.some(point => point.launches != null);
    if (!any) {
      const problem=collectorMessageR1484(data?.collector?.warning);
      const message=!ctx.points.length?(isToday()?(problem?'Нет замеров: '+problem:'Ещё не получен первый замер YouTube.'):'За этот день нет замеров.'):
        kind==='viewers'&&!ctx.points.some(p=>p.online!=null)?'YouTube пока не сообщает число зрителей онлайн. График просмотров LIVE ниже доступен независимо.':kind==='views'?'YouTube пока не вернул viewCount для этого интервала.':'Пока нет двух замеров для вычисления прироста. Общий счётчик LIVE смотри на следующем графике.';
      container.innerHTML='<div class="r1156-chart-empty">'+esc(message)+'</div>';return;
    }
    const width = Math.max(260, Math.round(container.getBoundingClientRect().width || 360));
    const height = expanded ? Math.max(185, Math.min(560, window.innerHeight - 265)) : Math.max(280, Math.min(380, Math.round(width * .52)));
    const a = axes(ctx, span, width, height, values), suffix = `${kind}-${expanded?'large':'inline'}`, gradient = `r1483Gradient-${suffix}`, clip = `r1483Clip-${suffix}`;
    let plot = '', definitions = `<clipPath id="${clip}"><rect x="${a.left}" y="${a.top-7}" width="${a.plotW}" height="${a.plotH+8}"/></clipPath>`;
    if (kind === 'viewers' || kind === 'views') {
      definitions += `<linearGradient id="${gradient}" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stop-color="#ff526e" stop-opacity=".27"/><stop offset="100%" stop-color="#ff526e" stop-opacity=".01"/></linearGradient>`;
      const segments = []; let segment = [], previousPoint = null;
      for (const point of points) {
        const value = kind==='views'?point.views:point.online;
        const gap = previousPoint && (point.minute - previousPoint.minute > 10 || point.videoId !== previousPoint.videoId || (kind==='views'?previousPoint.views:previousPoint.online) == null);
        if (value == null || gap) { if (segment.length) segments.push(segment); segment = []; }
        if (value != null) segment.push(point);
        previousPoint = point;
      }
      if (segment.length) segments.push(segment);
      for (const group of segments) {
        const line = group.map((point, i) => `${i?'L':'M'} ${a.x(point.minute).toFixed(2)} ${a.y(kind==='views'?point.views:point.online).toFixed(2)}`).join(' ');
        if (group.length > 1) plot += `<path fill="url(#${gradient})" d="${line} L ${a.x(group[group.length-1].minute)} ${a.top+a.plotH} L ${a.x(group[0].minute)} ${a.top+a.plotH} Z"/>`;
        plot += `<path class="viewer-line" d="${line}"/>`;
      }
      const known = points.filter(point => (kind==='views'?point.views:point.online) != null);
      plot += known.map((point, index) => `<circle class="viewer-point${index===known.length-1?' current':''}" cx="${a.x(point.minute)}" cy="${a.y(kind==='views'?point.views:point.online)}" r="${index===known.length-1?4:2.1}"><title>${esc(Number.isFinite(point.at)?fullTimeFormatter.format(new Date(point.at)):point.minute)} · ${number(kind==='views'?point.views:point.online)} ${kind==='views'?'просмотров LIVE':'зр.'}</title></circle>`).join('');
      if (selected && selected.minute >= span.start && selected.minute <= span.end && (kind==='views'?selected.views:selected.online) != null) plot += `<line class="selected-line" x1="${a.x(selected.minute)}" y1="${a.top}" x2="${a.x(selected.minute)}" y2="${a.top+a.plotH}"/><circle class="selected-dot" cx="${a.x(selected.minute)}" cy="${a.y(kind==='views'?selected.views:selected.online)}" r="5"/>`;
    } else {
      definitions += `<linearGradient id="${gradient}" x1="0" y1="0" x2="0" y2="1"><stop stop-color="#ffe69d"/><stop offset="100%" stop-color="#d18722"/></linearGradient>`;
      const {buckets} = bucketsFor(ctx, span), max = Math.max(0, ...buckets.map(bucket => bucket.value));
      for (const bucket of buckets) if (bucket.value > 0) {
        const x = a.x(bucket.start) + 2, barWidth = Math.max(2, a.x(bucket.end) - a.x(bucket.start) - 4), y = a.y(bucket.value), center = x + barWidth / 2;
        plot += `<rect fill="url(#${gradient})" rx="3" x="${x}" y="${y}" width="${barWidth}" height="${Math.max(2,a.top+a.plotH-y)}"><title>${label(bucket.start,ctx)}–${label(bucket.end,ctx,true)} · +${number(bucket.value)}</title></rect>`;
        if (buckets.length <= 15 || bucket.value === max) plot += `<text class="launch-value" x="${center}" y="${Math.max(a.top+12,y-6)}" text-anchor="middle">+${number(bucket.value)}</text>`;
      }
    }
    container.innerHTML = `<svg class="r1483-chart" viewBox="0 0 ${width} ${height}" role="img" aria-label="${kind==='viewers'?'Одновременные зрители':kind==='views'?'Всего просмотров LIVE по YouTube API':'Новые просмотры'} · ${label(span.start,ctx)}–${label(span.end,ctx,true)}" tabindex="0" data-audience-svg="${kind}" data-plot-left="${a.left}" data-plot-width="${a.plotW}" data-svg-width="${width}"><defs>${definitions}</defs>${a.markup}<g clip-path="url(#${clip})">${plot}</g><rect class="sample-hit" x="${a.left}" y="${a.top}" width="${a.plotW}" height="${a.plotH}"/></svg>`;
  }
  function renderGraphs() {
    if (!data) return;
    const ctx = context(), span = range(ctx); controls(ctx, span);
    for (const [kind, container] of Object.entries(containers)) draw(kind, container, ctx, span);
    const {size, buckets} = bucketsFor(ctx, span);
    text('r1235LaunchPeak', data?.summary?.deltaSamples ? `+${number(Math.max(0, ...buckets.map(bucket => bucket.value)))}` : '—');
    text('r1485CumulativeLatest',data?.summary?.lastCumulativeViews==null?'—':number(data.summary.lastCumulativeViews));
    text('r1235LaunchBucketLabel', `Столбик ${size} мин`);
    if (modal?.open) draw(modalKind, modal.querySelector('[data-audience-modal-chart]'), ctx, span, true);
  }
  function renderLists() {
    const arrivals = (data.series || []).filter(row => Number(row.launches) > 0).slice().reverse().slice(0, 120);
    $('radioAudienceEventsR1156').innerHTML = arrivals.length ? arrivals.map(row => `<article class="r1156-event"><time>${esc(row.minute)}</time><div><strong>Прирост просмотров API</strong><small>онлайн ${row.concurrentViewers==null?'—':number(row.concurrentViewers)}</small></div><b>+${number(row.launches)}</b></article>`).join('') : '<div class="r1156-event-empty">Новых просмотров между замерами пока не зафиксировано.</div>';
    const site = (data.exactOpens || []).slice().reverse().slice(0, 120);
    $('radioAudienceSiteEventsR1156').innerHTML = site.length ? site.map(row => `<article class="r1156-event is-site"><time>${esc(Number.isFinite(parsedTime(row.createdAt))?timeFormatter.format(new Date(parsedTime(row.createdAt))):'—')}</time><div><strong>Переход в LIVE через сайт</strong><small>${esc([row.city,row.country].filter(Boolean).join(' · ')||'Город не определён')}</small></div><b>+1</b></article>`).join('') : '<div class="r1156-event-empty">Переходов с сайта за выбранный день пока нет.</div>';
  }
  function render(nextData) {
    const changed = data?.date && data.date !== nextData.date;
    data = nextData; serverToday = data.today || serverToday;
    dateInput.value = data.date; dateButtons();
    if (changed) { windowMinutes = isToday() ? 360 : 0; followLatest = true; selected = null; }
    const ctx = context(), summary = data.summary || {}, online = ctx.points.filter(point => point.online != null), last = ctx.points[ctx.points.length-1];
    const peak = online.length ? Math.max(...online.map(point => point.online)) : null;
    const peakPoint = online.find(point => point.online === peak), current = summary.currentConcurrent;
    text('radioAudienceLaunchesR1156', summary.launches==null ? '—' : number(summary.launches));
    text('radioAudiencePeakR1156', peak==null?'—':number(peak));
    text('radioAudienceCurrentR1156', current==null?'—':number(current));
    text('radioAudienceCurrentLabelR1483', isToday() ? 'сейчас онлайн' : 'последний замер');
    text('radioAudienceSiteR1156', number(summary.siteVisitors));
    text('r1235ViewerCurrent', current==null?'—':number(current));
    text('r1267ViewerCurrentLabel', isToday() ? 'Сейчас' : 'Последний');
    text('r1235ViewerPeak', peak==null?'—':number(peak));
    text('r1235ViewerAverage', online.length ? number(online.reduce((sum,point)=>sum+point.online,0)/online.length) : '—');
    text('r1235LaunchTotal', summary.launches==null ? '—' : number(summary.launches));
    const dateParts = data.date.split('-'); text('radioAudienceDayLabelR1156', `${dateParts[2]}.${dateParts[1]}.${dateParts[0]}`);
    const lastMinute = last?.minute ?? 0;
    const lastHour = ctx.points.filter(point => point.minute > lastMinute-60 && point.minute <= lastMinute).reduce((sum,point)=>sum+point.launches,0);
    $('radioAudienceInsightsR1483').innerHTML = `<span title="Прирост API за 60 минут до последнего замера">API · 60 мин<b>${summary.deltaSamples?'+'+number(lastHour):'—'}</b></span><span title="Время первого максимума одновременных зрителей за день">Время пика<b>${peakPoint?label(peakPoint.minute,ctx):'—'}</b></span><span title="Время последнего сохранённого замера">Замер<b>${last?label(last.minute,ctx):'—'}</b></span>`;
    const age = last && Number.isFinite(last.at) ? Math.max(0, Math.floor((Date.now()-last.at)/60000)) : null;
    text('radioAudienceCollectionR1156', last ? `${data.samples} замеров · ${label(ctx.points[0].minute,ctx)}–${label(last.minute,ctx)} · Bratislava${isToday()&&age>3?' · последний '+age+' мин назад':''}` : 'Ожидаю первый замер нового эфира.');
    const stale = isToday() && (age == null || age > 5);
    const warningR1484=String(data?.collector?.warning||'');
    if(warningR1484)text('radioAudienceCollectionR1156',(last?data.samples+' замеров · ':'')+'Причина: '+collectorMessageR1484(warningR1484)+' · '+warningR1484);
    const partialR1484=warningR1484&&data.samples>0;
    setState(warningR1484?(partialR1484?'Неполные данные':'Сбой сбора'):stale?'Жду замер':isToday()?'Сегодня':'Архив',warningR1484?(partialR1484?'warn':'error'):stale?'warn':'ok');
    renderLists(); renderGraphs();
  }
  async function load(date = '') {
    const mine = ++generation; setState('Загрузка…', 'loading');
    root.setAttribute('aria-busy','true');
    try { const result = await window.AndrikRadioDataR1483.load(date); if (mine === generation) render(result); }
    catch (error) {
      if (mine !== generation) return;
      setState('Ошибка', 'error');
      for (const container of Object.values(containers)) container.innerHTML = `<div class="r1156-chart-empty">Не удалось получить статистику: ${esc(error.message)}</div>`;
    } finally { if (mine === generation) root.setAttribute('aria-busy','false'); }
  }
  function chooseDate(date) {
    const value = date > currentDay() ? currentDay() : date;
    dateInput.value = value; dateButtons();
    if (data?.date !== value) {
      selected = null; followLatest = true; windowMinutes = value === currentDay() ? 360 : 0;
      for (const id of ['radioAudienceLaunchesR1156','radioAudiencePeakR1156','radioAudienceCurrentR1156','radioAudienceSiteR1156']) text(id,'—');
    }
    load(value);
  }
  function showModal(kind) {
    if (!modal) {
      modal = document.createElement('dialog'); modal.id = 'r1483ChartDialog';
      modal.innerHTML = `<div class="r1483-dialog-head"><h2 id="r1483ModalTitle"></h2><button type="button" data-audience-close aria-label="Закрыть увеличенный график">✕ Закрыть</button></div><div class="r1483-time-controls"><div class="r1483-range-presets" role="group" aria-label="Период на графике">${[60,180,360,0].map(value=>`<button type="button" data-audience-window="${value}">${value?value/60+' ч':'День'}</button>`).join('')}</div><div class="r1483-time-navigation"><button type="button" data-audience-pan="-1" aria-label="Раньше по времени">←</button><output data-audience-range></output><button type="button" data-audience-pan="1" aria-label="Позже по времени">→</button><button type="button" data-audience-zoom="in" aria-label="Приблизить время">＋</button><button type="button" data-audience-zoom="out" aria-label="Отдалить время">−</button></div><input type="range" data-audience-pan-slider min="0" max="1440" value="0" step="1" aria-label="Переместить окно по времени"></div><div data-audience-modal-chart></div><p class="r1483-point-readout" data-audience-readout aria-live="polite">Нажми на график: точное время → значение.</p>`;
      modal.setAttribute('aria-labelledby','r1483ModalTitle'); document.body.append(modal);
      modal.addEventListener('close', () => { document.body.style.overflow = ''; modalKind = ''; });
    }
    modalKind = kind; text('r1483ModalTitle', kind === 'viewers' ? 'Зрители · время' : kind === 'views' ? 'Всего просмотров эфира · время' : 'Новые просмотры · время');
    if (!modal.open) { modal.showModal(); document.body.style.overflow = 'hidden'; }
    renderGraphs();
  }
  function interaction(event) {
    if (!event.target.closest('#radioAudienceR1156,#r1483ChartDialog')) return;
    const windowButton = event.target.closest('[data-audience-window]'), pan = event.target.closest('[data-audience-pan]'), zoom = event.target.closest('[data-audience-zoom]'), expand = event.target.closest('[data-audience-expand]');
    if (event.target.closest('[data-audience-close]')) { modal?.close(); return; }
    if (!data) return;
    if (expand) { showModal(expand.dataset.audienceExpand); return; }
    const ctx = context(), span = range(ctx);
    if (windowButton) { windowMinutes = Number(windowButton.dataset.audienceWindow); followLatest = true; }
    else if (pan) { followLatest = false; startMinute = span.start + Number(pan.dataset.audiencePan) * Math.max(15,span.width/2); }
    else if (zoom) {
      const width = zoom.dataset.audienceZoom === 'in' ? Math.max(15,span.width/2) : Math.min(ctx.length,span.width*2);
      windowMinutes = width >= ctx.length ? 0 : width;
      if (!followLatest) startMinute = span.start + (span.width-width)/2;
    } else return;
    selected = null; renderGraphs();
  }
  function readPoint(event) {
    const svg = event.target.closest('[data-audience-svg]');
    if (!svg || !data || (event.type === 'pointermove' && event.pointerType !== 'mouse')) return;
    const ctx = context(), span = range(ctx), rect = svg.getBoundingClientRect();
    const x = (event.clientX-rect.left)/rect.width*Number(svg.dataset.svgWidth);
    const minute = span.start + (x-Number(svg.dataset.plotLeft))/Number(svg.dataset.plotWidth)*span.width;
    const points = ctx.points.filter(point => point.minute >= span.start && point.minute <= span.end && (svg.dataset.audienceSvg === 'viewers' ? point.online != null : svg.dataset.audienceSvg === 'views' ? point.views != null : true));
    if (!points.length || x < Number(svg.dataset.plotLeft) || x > Number(svg.dataset.plotLeft)+Number(svg.dataset.plotWidth)) return;
    selected = points.reduce((nearest,point)=>Math.abs(point.minute-minute)<Math.abs(nearest.minute-minute)?point:nearest,points[0]);
    const stamp = Number.isFinite(selected.at) ? fullTimeFormatter.format(new Date(selected.at)) : label(selected.minute,ctx);
    let message = `${stamp} → онлайн ${selected.online==null?'нет данных':number(selected.online)} · всего LIVE ${selected.views==null?'—':number(selected.views)} · прирост API ${selected.launches==null?'—':'+'+number(selected.launches)}`;
    if(svg.dataset.audienceSvg==='views') message=`${stamp} → всего просмотров LIVE: ${selected.views==null?'—':number(selected.views)}`;
    if (svg.dataset.audienceSvg === 'launches') {
      const bucket = bucketsFor(ctx,span).buckets.find(item=>minute>=item.start&&minute<=item.end);
      if (bucket) message = `${label(bucket.start,ctx)}–${label(bucket.end,ctx,true)} → API +${number(bucket.value)} · замер ${stamp}`;
    }
    text('radioAudiencePointR1483',message);
    modal?.querySelectorAll('[data-audience-readout]').forEach(el => { el.textContent = message; });
    // Keep the pointer's SVG in place: replacing it on every mousemove loses focus.
    document.querySelectorAll('[data-audience-svg="viewers"]').forEach(plot => {
      plot.querySelectorAll('.selected-line,.selected-dot').forEach(el => el.remove());
      if (selected.online == null) return;
      const height = plot.viewBox.baseVal.height, width = plot.viewBox.baseVal.width;
      const values = ctx.points.filter(point=>point.minute>=span.start&&point.minute<=span.end&&point.online!=null).map(point=>point.online);
      const a = axes(ctx,span,width,height,values), group = plot.querySelector('[clip-path]');
      group?.insertAdjacentHTML('beforeend',`<line class="selected-line" x1="${a.x(selected.minute)}" y1="${a.top}" x2="${a.x(selected.minute)}" y2="${a.top+a.plotH}"/><circle class="selected-dot" cx="${a.x(selected.minute)}" cy="${a.y(selected.online)}" r="5"/>`);
    });
  }
  dateInput.addEventListener('change', () => chooseDate(dateInput.value || currentDay()));
  previous?.addEventListener('click', () => chooseDate(shiftDate(dateInput.value || currentDay(), -1)));
  next?.addEventListener('click', () => chooseDate(shiftDate(dateInput.value || currentDay(), 1)));
  todayButton?.addEventListener('click', () => chooseDate(currentDay()));
  document.addEventListener('click', interaction);
  document.addEventListener('input', event => {
    if (!event.target.matches('#radioAudiencePanR1483,[data-audience-pan-slider]') || !data) return;
    followLatest = false; startMinute = Number(event.target.value); selected = null; renderGraphs();
  });
  document.addEventListener('pointerdown', readPoint, {passive:true});
  document.addEventListener('pointermove', readPoint, {passive:true});
  document.addEventListener('visibilitychange', () => { if (!document.hidden && (!dateInput.value || dateInput.value === currentDay())) load(dateInput.value || ''); });
  window.addEventListener('resize', () => { clearTimeout(resizeTimer); resizeTimer = setTimeout(renderGraphs, 120); });
  window.addEventListener('andrik:radio-audience-r1446', event => {
    const incoming = event.detail;
    if (incoming?.ok && incoming.date === incoming.today && (!dateInput.value || dateInput.value === incoming.today)) render(incoming);
  });
  setInterval(() => { if (!document.hidden && dateInput.value === currentDay()) load(dateInput.value); }, 120000);
  window.AndrikRadioAudienceR1485 = window.AndrikRadioAudienceR1483 = window.AndrikRadioAudienceR1235 = {refresh:()=>load(dateInput.value||''),get data(){return data;},get range(){return data?{...range(),windowMinutes}:null;}};
  containers.viewers.dataset.kind = 'viewers'; containers.launches.dataset.kind = 'launches'; if(containers.views)containers.views.dataset.kind='views';
  dateInput.value=currentDay(); dateButtons(); load('');
})();
