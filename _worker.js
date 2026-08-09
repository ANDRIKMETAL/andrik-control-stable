const ANDRIK_CONTROL_RELEASE = Object.freeze({ short:'R380', number:380, version:'55.00', full:'55.00 LIVE WEB AI FINAL R380', siteUpdater:'55.00-r356' });

const OWNER_SESSION_COOKIE = 'andrik_owner_session_v197';
const OWNER_SESSION_TOKEN_HEADER = 'x-andrik-owner-token';

const JSON_HEADERS = {
  'content-type': 'application/json; charset=utf-8',
  'cache-control': 'no-store',
  'x-content-type-options': 'nosniff',
  'referrer-policy': 'strict-origin-when-cross-origin',
  'permissions-policy': 'camera=(), microphone=(), geolocation=()',
  'strict-transport-security': 'max-age=31536000; includeSubDomains',
  'x-frame-options': 'SAMEORIGIN'
};

const PUBLIC_CACHE_HEADERS = {
  'content-type': 'application/json; charset=utf-8',
  'cache-control': 'public, max-age=30, s-maxage=60, stale-while-revalidate=120',
  'x-content-type-options': 'nosniff'
};

function json(data, status = 200, headers = JSON_HEADERS) {
  return new Response(JSON.stringify(data), { status, headers });
}

function cleanPlainText(value, maxLength) {
  return String(value ?? '')
    .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, '')
    .replace(/\r\n?/g, '\n')
    .trim()
    .slice(0, maxLength);
}

function normalizeWhitespace(value) {
  return cleanPlainText(value, 1600).replace(/\s+/g, ' ').trim().toLowerCase();
}

function youtubeAppLauncherUrl(targetUrl) {
  let target = 'https://www.youtube.com/@andrikmetal';
  try {
    const parsed = new URL(String(targetUrl || target));
    const allowed = new Set(['youtube.com', 'www.youtube.com', 'm.youtube.com', 'music.youtube.com', 'youtu.be']);
    if (parsed.protocol === 'https:' && allowed.has(parsed.hostname.toLowerCase())) target = parsed.href;
  } catch (_) {}
  // R212: push notifications open the real YouTube HTTPS link directly.
  // Android hands it to the installed YouTube app; if no handler exists,
  // the same URL opens normally in the browser. No intermediate Control page.
  return target;
}

function normalizeTitle(value) {
  return cleanPlainText(value, 240)
    .toLowerCase()
    .replace(/\([^)]*\)/g, ' ')
    .replace(/[^\p{L}\p{N}]+/gu, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function isSameOrigin(request) {
  const origin = request.headers.get('origin');
  if (!origin) return true;
  try { return new URL(origin).origin === new URL(request.url).origin; }
  catch (_) { return false; }
}

async function sha256Hex(value) {
  const data = new TextEncoder().encode(value);
  const digest = await crypto.subtle.digest('SHA-256', data);
  return [...new Uint8Array(digest)].map(byte => byte.toString(16).padStart(2, '0')).join('');
}

async function stablePushUuid(value) {
  const hex = await sha256Hex(String(value || 'andrik-push'));
  const chars = hex.slice(0, 32).split('');
  chars[12] = '4';
  chars[16] = (8 + (parseInt(chars[16], 16) % 4)).toString(16);
  const raw = chars.join('');
  return `${raw.slice(0,8)}-${raw.slice(8,12)}-${raw.slice(12,16)}-${raw.slice(16,20)}-${raw.slice(20,32)}`;
}

async function claimPushOnce(db, key, value = '1') {
  const safeKey = cleanPlainText(key, 220);
  const result = await db.prepare(`
    INSERT OR IGNORE INTO push_state (key, value, updated_at)
    VALUES (?, ?, datetime('now'))
  `).bind(safeKey, cleanPlainText(value, 500)).run();
  return Number(result?.meta?.changes || 0) > 0;
}

async function hasSentPushExact(db, { type = '', source = '', message = '', title = '', sinceHours = 168 } = {}) {
  const clauses = [`status = 'sent'`];
  const binds = [];
  if (type) { clauses.push(`type = ?`); binds.push(cleanPlainText(type, 80)); }
  if (source) { clauses.push(`source = ?`); binds.push(cleanPlainText(source, 120)); }
  if (message) { clauses.push(`message = ?`); binds.push(cleanPlainText(message, 700)); }
  if (title) { clauses.push(`title = ?`); binds.push(cleanPlainText(title, 220)); }
  const hours = Math.max(1, Math.min(24 * 31, Number(sinceHours || 168)));
  clauses.push(`created_at >= datetime('now', ?)`);
  binds.push(`-${hours} hours`);
  const row = await db.prepare(`
    SELECT 1 AS found
    FROM push_history
    WHERE ${clauses.join(' AND ')}
    ORDER BY created_at DESC
    LIMIT 1
  `).bind(...binds).first();
  return Boolean(row?.found);
}

async function releasePushOnceClaim(db, key) {
  const safeKey = cleanPlainText(key, 220);
  await db.prepare(`DELETE FROM push_state WHERE key = ?`).bind(safeKey).run().catch(() => {});
}


async function hasSentYoutubeLikeTotalR376(db, videoId, totalLikes) {
  const safeVideoId = cleanPlainText(videoId || '', 80);
  const safeTotal = Math.max(0, Math.trunc(Number(totalLikes || 0)));
  if (!safeVideoId || safeTotal <= 0) return false;
  const row = await db.prepare(`
    SELECT 1 AS found
    FROM push_history
    WHERE type='youtube-like'
      AND video_id=?
      AND status='sent'
      AND message LIKE ?
    ORDER BY datetime(created_at) DESC
    LIMIT 1
  `).bind(safeVideoId, `%всего ${safeTotal}%`).first().catch(() => null);
  return Boolean(row?.found);
}

async function claimYoutubeLikePushR376(db, videoId, totalLikes, startedAt) {
  const safeVideoId = cleanPlainText(videoId || '', 80);
  const safeTotal = Math.max(0, Math.trunc(Number(totalLikes || 0)));
  const onceKey = `push-once:youtube-like:${safeVideoId}:${safeTotal}`;

  if (await hasSentYoutubeLikeTotalR376(db, safeVideoId, safeTotal)) {
    return { onceKey, claimed:false, delivered:true, busy:false, recoveredStale:false };
  }

  let claimed = await claimPushOnce(db, onceKey, startedAt);
  if (claimed) return { onceKey, claimed:true, delivered:false, busy:false, recoveredStale:false };

  // R376: a Worker can die after claiming an event. Unlike the old fast-like
  // path, an orphaned claim must not suppress that like forever. 8 minutes is
  // deliberately longer than a normal OneSignal attempt but short enough to
  // recover automatically within a few cron cycles.
  const staleDelete = await db.prepare(`
    DELETE FROM push_state
    WHERE key=? AND updated_at < datetime('now','-8 minutes')
  `).bind(onceKey).run().catch(() => null);

  if (Number(staleDelete?.meta?.changes || 0) > 0) {
    // The previous attempt might actually have reached OneSignal before dying.
    // sendOneSignalPush also uses a stable idempotency_key, and this history
    // check lets us finalize the local high-water mark without another push.
    if (await hasSentYoutubeLikeTotalR376(db, safeVideoId, safeTotal)) {
      return { onceKey, claimed:false, delivered:true, busy:false, recoveredStale:true };
    }
    claimed = await claimPushOnce(db, onceKey, startedAt);
    if (claimed) return { onceKey, claimed:true, delivered:false, busy:false, recoveredStale:true };
  }

  if (await hasSentYoutubeLikeTotalR376(db, safeVideoId, safeTotal)) {
    return { onceKey, claimed:false, delivered:true, busy:false, recoveredStale:false };
  }
  return { onceKey, claimed:false, delivered:false, busy:true, recoveredStale:false };
}

function getClientIp(request) {
  return request.headers.get('cf-connecting-ip') || request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || 'unknown';
}

async function verifyTurnstile(token, request, env) {
  if (!env.TURNSTILE_SECRET_KEY) return { success: true, skipped: true };
  if (!token) return { success: false, error: 'turnstile-required' };
  const form = new FormData();
  form.set('secret', env.TURNSTILE_SECRET_KEY);
  form.set('response', token);
  const ip = getClientIp(request);
  if (ip && ip !== 'unknown') form.set('remoteip', ip);
  try {
    const response = await fetch('https://challenges.cloudflare.com/turnstile/v0/siteverify', {
      method: 'POST',
      body: form
    });
    const data = await response.json();
    if (!data?.success) return { success:false, error:'turnstile-failed' };
    const allowed = new Set(
      String(env.TURNSTILE_HOSTNAMES || 'andrikmetal.com,www.andrikmetal.com')
        .split(',').map(item=>item.trim().toLowerCase()).filter(Boolean)
    );
    const hostname = String(data.hostname || '').toLowerCase();
    if (hostname && allowed.size && !allowed.has(hostname)) {
      return { success:false, error:'turnstile-hostname' };
    }
    return { success:true, hostname };
  } catch (_) {
    return { success: false, error: 'turnstile-unavailable' };
  }
}

function calculateSpamScore(name, message, blocklist = '') {
  const text = `${name} ${message}`;
  const normalized = text.toLowerCase();
  let score = 0;
  const urls = text.match(/https?:\/\/|www\.|t\.me\/|bit\.ly\//gi) || [];
  if (urls.length > 0) score += urls.length * 2;
  if (urls.length > 2) score += 5;
  if (/(.)\1{8,}/u.test(text)) score += 3;
  if (/\b(?:casino|crypto investment|forex signal|viagra|loan offer|seo service|buy followers|казино|криптоинвест|заработок без вложений|быстрый займ|ставки на спорт)\b/i.test(normalized)) score += 5;
  const custom = String(blocklist || '').split(',').map(item => item.trim().toLowerCase()).filter(Boolean);
  if (custom.some(term => normalized.includes(term))) score += 6;
  const letters = [...text].filter(ch => /\p{L}/u.test(ch));
  const upper = letters.filter(ch => ch === ch.toUpperCase() && ch !== ch.toLowerCase());
  if (letters.length > 25 && upper.length / letters.length > 0.72) score += 2;
  return score;
}



let commentsSchemaV4Promise = null;

async function ensureSecuritySchema(db) {
  // R155: D1 executes each schema statement separately. This avoids
  // SQLITE "incomplete input" errors from multi-statement db.exec().
  const statements = [
    `CREATE TABLE IF NOT EXISTS security_events (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      kind TEXT NOT NULL,
      path TEXT NOT NULL DEFAULT '',
      ip_hash TEXT NOT NULL DEFAULT '',
      detail TEXT NOT NULL DEFAULT '',
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    )`,
    `CREATE INDEX IF NOT EXISTS idx_security_events_created
      ON security_events(created_at DESC)`,
    `CREATE INDEX IF NOT EXISTS idx_security_events_kind_created
      ON security_events(kind, created_at DESC)`,
    `CREATE TABLE IF NOT EXISTS security_rate_buckets (
      bucket TEXT PRIMARY KEY,
      event TEXT NOT NULL,
      count INTEGER NOT NULL DEFAULT 0,
      window_id INTEGER NOT NULL,
      updated_at TEXT NOT NULL DEFAULT (datetime('now'))
    )`,
    `CREATE INDEX IF NOT EXISTS idx_security_rate_updated
      ON security_rate_buckets(updated_at DESC)`,
    `CREATE TABLE IF NOT EXISTS security_alert_state (
      alert_key TEXT PRIMARY KEY,
      pending_count INTEGER NOT NULL DEFAULT 0,
      last_sent_at TEXT NOT NULL DEFAULT '',
      last_kind TEXT NOT NULL DEFAULT '',
      last_country TEXT NOT NULL DEFAULT '',
      updated_at TEXT NOT NULL DEFAULT (datetime('now'))
    )`
  ];
  for (const statement of statements) await db.prepare(statement).run();
  await db.prepare(`ALTER TABLE security_events ADD COLUMN country TEXT NOT NULL DEFAULT ''`).run().catch(() => {});
  await db.prepare(`ALTER TABLE security_events ADD COLUMN region TEXT NOT NULL DEFAULT ''`).run().catch(() => {});
  await db.prepare(`ALTER TABLE security_events ADD COLUMN city TEXT NOT NULL DEFAULT ''`).run().catch(() => {});
  await db.prepare(`ALTER TABLE security_events ADD COLUMN colo TEXT NOT NULL DEFAULT ''`).run().catch(() => {});
  await db.prepare(`CREATE INDEX IF NOT EXISTS idx_security_events_country_created ON security_events(country, created_at DESC)`).run();
}

async function securityIpHash(request, env) {
  const salt = String(env.COMMENTS_HASH_SALT || 'andrik-security');
  return sha256Hex(`${salt}:security:${getClientIp(request)}`);
}

async function recordSecurityEvent(db, request, env, kind, detail = '') {
  try {
    await ensureSecuritySchema(db);
    const ipHash = await securityIpHash(request, env);
    const cf = request.cf || {};
    const event = {
      kind:cleanPlainText(kind, 80),
      path:cleanPlainText(new URL(request.url).pathname, 180),
      ipHash,
      detail:cleanPlainText(detail, 500),
      country:cleanPlainText(cf.country || '', 8).toUpperCase(),
      region:cleanPlainText(cf.region || cf.regionCode || '', 100),
      city:cleanPlainText(cf.city || '', 100),
      colo:cleanPlainText(cf.colo || '', 16)
    };
    await db.prepare(`
      INSERT INTO security_events(kind, path, ip_hash, detail, country, region, city, colo, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, datetime('now'))
    `).bind(
      event.kind, event.path, event.ipHash, event.detail,
      event.country, event.region, event.city, event.colo
    ).run();
    await maybeSendSecurityAttackPush(db, env, event).catch(() => {});
  } catch (_) {}
}

function securityAttackPushEnabled(env) {
  return !/^(0|false|off|no)$/i.test(String(env.ATTACK_PUSH_ENABLED || 'true').trim());
}

async function maybeSendSecurityAttackPush(db, env, event) {
  if (!securityAttackPushEnabled(env)) return;
  const kind = String(event?.kind || '');
  if (!kind || !/(?:turnstile|spam|honeypot|rate-limit|blocked|abuse|attack|bot)/i.test(kind)) return;

  const cooldownSeconds = Math.max(60, Math.min(3600, Number(env.ATTACK_PUSH_COOLDOWN_SECONDS || 300)));
  const alertKey = 'owner-attacks';
  await db.prepare(`
    INSERT INTO security_alert_state(
      alert_key, pending_count, last_sent_at, last_kind, last_country, updated_at
    )
    VALUES (?, 1, '', ?, ?, datetime('now'))
    ON CONFLICT(alert_key) DO UPDATE SET
      pending_count = pending_count + 1,
      last_kind = excluded.last_kind,
      last_country = excluded.last_country,
      updated_at = datetime('now')
  `).bind(alertKey, cleanPlainText(kind, 80), cleanPlainText(event.country || '', 8)).run();

  const state = await db.prepare(`
    SELECT pending_count AS pendingCount, last_sent_at AS lastSentAt
    FROM security_alert_state WHERE alert_key=? LIMIT 1
  `).bind(alertKey).first();

  const lastSentMs = Date.parse(String(state?.lastSentAt || '')) || 0;
  if (lastSentMs && Date.now() - lastSentMs < cooldownSeconds * 1000) return;

  const [totals, kinds, countries] = await Promise.all([
    db.prepare(`
      SELECT COUNT(*) AS total
      FROM security_events
      WHERE datetime(created_at) >= datetime('now', '-5 minutes')
        AND kind NOT IN ('csrf-blocked','csrf-attack-blocked','csrf-stale')
        AND (
          kind LIKE '%turnstile%' OR kind LIKE '%spam%' OR kind LIKE '%honeypot%'
          OR kind LIKE '%rate-limit%' OR kind LIKE '%blocked%'
          OR kind LIKE '%abuse%' OR kind LIKE '%attack%' OR kind LIKE '%bot%'
        )
    `).first(),
    db.prepare(`
      SELECT kind, COUNT(*) AS count
      FROM security_events
      WHERE datetime(created_at) >= datetime('now', '-5 minutes')
        AND kind NOT IN ('csrf-blocked','csrf-attack-blocked','csrf-stale')
      GROUP BY kind ORDER BY count DESC LIMIT 3
    `).all(),
    db.prepare(`
      SELECT country, COUNT(*) AS count
      FROM security_events
      WHERE datetime(created_at) >= datetime('now', '-5 minutes') AND country<>'' AND kind NOT IN ('csrf-blocked','csrf-attack-blocked','csrf-stale')
      GROUP BY country ORDER BY count DESC LIMIT 3
    `).all()
  ]);

  const total = Math.max(1, Number(totals?.total || state?.pendingCount || 1));
  const kindText = (kinds.results || []).map(row => `${row.kind} ×${row.count}`).join(', ');
  const countryText = (countries.results || []).map(row => `${row.country} ×${row.count}`).join(', ');
  const message = [
    `${total} заблокирован${total === 1 ? 'ная попытка' : 'ных попыток'} за 5 минут.`,
    kindText || cleanPlainText(kind, 80),
    countryText ? `Страны: ${countryText}.` : ''
  ].filter(Boolean).join(' ');

  const result = await sendOwnerPush(env, {
    title:'🛡️ ANDRIK: атака заблокирована',
    message,
    url:'https://control.andrikmetal.com/attack-map.html'
  }).catch(error => ({ ok:false, message:String(error?.message || error) }));

  await db.prepare(`
    UPDATE security_alert_state
    SET pending_count=0, last_sent_at=datetime('now'), updated_at=datetime('now')
    WHERE alert_key=?
  `).bind(alertKey).run();

  await recordSystemLog(env, {
    scope:'security',
    level:result?.ok === false ? 'warning' : 'info',
    event:'attack-push-sent',
    message,
    details:{
      total,
      kinds:kinds.results || [],
      countries:countries.results || [],
      oneSignalOk:result?.ok !== false
    }
  }).catch(() => {});
}

async function securityRateLimit(db, request, env, event, limit, windowSeconds, blockedKind) {
  await ensureSecuritySchema(db);
  const ipHash = await securityIpHash(request, env);
  const windowId = Math.floor(Date.now() / (Math.max(1, windowSeconds) * 1000));
  const rawBucket = `${event}:${ipHash}:${windowId}`;
  const bucket = await sha256Hex(rawBucket);

  await db.prepare(`
    INSERT INTO security_rate_buckets(bucket, event, count, window_id, updated_at)
    VALUES (?, ?, 1, ?, datetime('now'))
    ON CONFLICT(bucket) DO UPDATE SET
      count = count + 1,
      updated_at = datetime('now')
  `).bind(bucket, cleanPlainText(event, 80), windowId).run();

  const row = await db.prepare(`
    SELECT count FROM security_rate_buckets WHERE bucket = ? LIMIT 1
  `).bind(bucket).first();

  const count = Number(row?.count || 0);
  if (count > limit) {
    await recordSecurityEvent(
      db, request, env, blockedKind || `${event}-rate-limit`,
      `${count}/${limit} за ${windowSeconds} сек.`
    );
    return { allowed:false, count, limit, windowSeconds };
  }
  return { allowed:true, count, limit, windowSeconds };
}

async function fetchTxtRecords(name) {
  try {
    const url = new URL('https://cloudflare-dns.com/dns-query');
    url.searchParams.set('name', name);
    url.searchParams.set('type', 'TXT');
    const response = await fetch(url.toString(), {
      headers:{ accept:'application/dns-json' },
      cf:{ cacheTtl:300, cacheEverything:true }
    });
    if (!response.ok) return [];
    const data = await response.json();
    return (data.Answer || []).map(item => String(item.data || '').replace(/^"|"$/g, '').replace(/"\s+"/g, ''));
  } catch (_) {
    return [];
  }
}

// R211: Guard status is cached in Worker memory. Repeated Control refreshes no longer
// hit the external Guard/KV every time. Manual /run always bypasses this cache.
const guardStatusMemoryR211 = { value:null, expiresAt:0, inflight:null };
const GUARD_STATUS_OK_TTL_R211 = 10 * 60 * 1000;
const GUARD_STATUS_ERROR_TTL_R211 = 60 * 1000;

async function fetchGuardStatus(env, run = false) {
  if (!run && guardStatusMemoryR211.value && Date.now() < guardStatusMemoryR211.expiresAt) {
    return guardStatusMemoryR211.value;
  }
  if (!run && guardStatusMemoryR211.inflight) return guardStatusMemoryR211.inflight;

  const execute = async () => {
  const base = String(env.GUARD_URL || '').trim().replace(/\/+$/, '');
  const key = String(env.GUARD_KEY || '').trim();
  const missing = [];
  if (!base) missing.push('GUARD_URL');
  if (!key) missing.push('GUARD_KEY');
  const endpoint = base ? `${base}${run ? '/run' : '/status'}` : '';
  if (missing.length) {
    return {
      configured:false, connected:false, url:base,
      diagnostic:{ code:'guard-config-missing', missing, endpoint },
      message:`В Cloudflare Pages Production отсутствуют: ${missing.join(', ')}.`
    };
  }

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), run ? 105000 : 16000);
  try {
    const response = await fetch(endpoint, {
      method: run ? 'POST' : 'GET',
      signal: controller.signal,
      headers:{
        authorization:`Bearer ${key}`,
        accept:'application/json',
        ...(run ? {'content-type':'application/json'} : {})
      },
      body: run ? '{}' : undefined
    });
    const raw = await response.text();
    let data = {};
    try { data = raw ? JSON.parse(raw) : {}; } catch (_) {}
    if (!response.ok) {
      const code = response.status === 401 ? 'guard-key-mismatch' : `guard-http-${response.status}`;
      return {
        configured:true, connected:false, url:base,
        diagnostic:{ code, httpStatus:response.status, endpoint, response:cleanPlainText(raw, 220) },
        message:response.status === 401
          ? 'GUARD_KEY в Pages не совпадает с GUARD_KEY внешнего Worker.'
          : (data.message || data.error || `Guard ответил HTTP ${response.status}.`)
      };
    }
    const guardBuild = cleanPlainText(data.build || '', 100);
    const lastAction = cleanPlainText(data.status?.action || '', 60);
    const lastMessage = cleanPlainText(data.status?.message || '', 400);
    return {
      configured:true, connected:true, compatible:/ANDRIK Guard 2\.(?:1|2)/i.test(guardBuild),
      url:base, status:data, build:guardBuild,
      diagnostic:{ code:'guard-connected', httpStatus:response.status, endpoint },
      message:run
        ? (data.message || lastMessage || 'Guard завершил проверку.')
        : (lastMessage || (guardBuild ? `${guardBuild} подключён${lastAction ? ` · ${lastAction}` : ''}.` : 'Guard подключён.'))
    };
  } catch (error) {
    const timeout = error?.name === 'AbortError';
    return {
      configured:true, connected:false, url:base,
      diagnostic:{ code:timeout ? 'guard-timeout' : 'guard-network-error', endpoint, error:cleanPlainText(error?.message || error, 220) },
      message:timeout ? 'Guard не ответил вовремя.' : `Guard недоступен: ${cleanPlainText(error?.message || error, 180)}`
    };
  } finally {
    clearTimeout(timer);
  }
  };

  if (run) {
    const value = await execute();
    guardStatusMemoryR211.value = value;
    guardStatusMemoryR211.expiresAt = Date.now() + (value?.connected ? GUARD_STATUS_OK_TTL_R211 : GUARD_STATUS_ERROR_TTL_R211);
    return value;
  }

  guardStatusMemoryR211.inflight = execute().then(value => {
    guardStatusMemoryR211.value = value;
    guardStatusMemoryR211.expiresAt = Date.now() + (value?.connected ? GUARD_STATUS_OK_TTL_R211 : GUARD_STATUS_ERROR_TTL_R211);
    return value;
  }).finally(() => { guardStatusMemoryR211.inflight = null; });
  return guardStatusMemoryR211.inflight;
}
async function handleControlProtectionStatus(request, env) {
  if (!adminAuthorized(request, env)) return json({ ok:false, error:'unauthorized' }, 401);

  // Guard is intentionally checked independently from D1 and the remaining cards.
  const [guard, spfRecords, dmarcRecords] = await Promise.all([
    fetchGuardStatus(env, false),
    fetchTxtRecords('andrikmetal.com'),
    fetchTxtRecords('_dmarc.andrikmetal.com')
  ]);

  let countsResult = { results:[] };
  let recentResult = { results:[] };
  let securityDbError = '';
  try {
    const db = requireDb(env);
    await ensureSecuritySchema(db);
    await db.prepare(`DELETE FROM security_events WHERE created_at < datetime('now', '-7 days')`).run().catch(() => {});
    await db.prepare(`DELETE FROM security_events WHERE kind IN ('csrf-blocked','csrf-attack-blocked','csrf-stale')`).run().catch(() => {});
    await db.prepare(`DELETE FROM security_rate_buckets WHERE updated_at < datetime('now', '-2 days')`).run().catch(() => {});
    [countsResult, recentResult] = await Promise.all([
      db.prepare(`
        SELECT kind, COUNT(*) AS count
        FROM security_events
        WHERE created_at >= datetime('now', '-1 day')
          AND kind NOT IN ('csrf-blocked','csrf-attack-blocked','csrf-stale')
        GROUP BY kind
      `).all(),
      db.prepare(`
        SELECT kind, path, detail, country, region, colo, created_at AS createdAt
        FROM security_events
        WHERE created_at >= datetime('now', '-1 day')
          AND kind NOT IN ('csrf-blocked','csrf-attack-blocked','csrf-stale')
        ORDER BY created_at DESC
        LIMIT 20
      `).all()
    ]);
  } catch (error) {
    securityDbError = cleanPlainText(error?.message || error, 300);
  }

  let headerStatus = { hsts:false, frame:false, nosniff:false };
  try {
    const probe = new URL('/control-home.html', request.url);
    probe.searchParams.set('security_probe', String(Date.now()));
    const response = await fetch(probe.toString(), {
      method:'GET', cache:'no-store',
      headers:{ 'cache-control':'no-cache', 'user-agent':'ANDRIK-Control-R155-Security' }
    });
    const csp = response.headers.get('content-security-policy') || '';
    headerStatus = {
      hsts:Boolean(response.headers.get('strict-transport-security')),
      frame:Boolean(response.headers.get('x-frame-options')) || /frame-ancestors/i.test(csp),
      nosniff:(response.headers.get('x-content-type-options') || '').toLowerCase() === 'nosniff'
    };
    try { await response.body?.cancel(); } catch (_) {}
  } catch (_) {}

  const spf = spfRecords.some(value => /^v=spf1\b/i.test(value));
  const dmarcRecord = dmarcRecords.find(value => /^v=dmarc1\b/i.test(value)) || '';
  const policyMatch = dmarcRecord.match(/(?:^|;)\s*p\s*=\s*([a-z]+)/i);
  const dmarcPolicy = policyMatch ? policyMatch[1].toLowerCase() : '';
  const counts = {};
  for (const row of countsResult.results || []) counts[row.kind] = Number(row.count || 0);

  const turnstileSecret = Boolean(String(env.TURNSTILE_SECRET_KEY || '').trim());
  const turnstileSite = Boolean(String(env.TURNSTILE_SITE_KEY || '').trim());
  const application = {
    adminKey:Boolean(String(env.ADMIN_KEY || '').trim()),
    turnstile:turnstileSecret && turnstileSite,
    turnstileSecret,
    turnstileSite,
    turnstileScope:'pages-production',
    d1:Boolean(env.COMMENTS_DB),
    d1Healthy:!securityDbError,
    d1Error:securityDbError
  };

  // R161: Bot Fight Mode was enabled and visually confirmed for the ANDRIK zone.
  // No extra key or Pages variable is required. An explicit optional 'off' value
  // can still lower the score later if the owner deliberately disables it.
  const botState = cleanPlainText(env.CLOUDFLARE_BOT_STATE || 'on', 20).toLowerCase();
  let score = 10;
  if (application.adminKey) score += 10;
  if (application.turnstile) score += 15;
  if (application.d1 && application.d1Healthy) score += 15;
  if (guard.connected && guard.status?.status?.ok) score += 20;
  else if (guard.configured) score += 8;
  if (headerStatus.hsts) score += 10;
  if (headerStatus.frame) score += 5;
  if (spf) score += 7;
  if (dmarcRecord) score += 4;
  if (botState === 'on') score += 4;
  score = Math.max(0, Math.min(100, score));

  return json({
    ok:true,
    version:ANDRIK_CONTROL_RELEASE.full,
    checkedAt:new Date().toISOString(),
    score,
    summary:score === 100
      ? 'Все доступные уровни защиты активны.'
      : score >= 85
      ? 'Guard и основные уровни защиты работают.'
      : score >= 65
        ? 'Базовая защита сильная, но есть пункты для настройки.'
        : 'Нужно проверить отдельные уровни защиты.',
    guard,
    application,
    edge:{
      ddos:true,
      bot:botState
    },
    headers:headerStatus,
    phishing:{ spf, spfRecords, dmarc:Boolean(dmarcRecord), dmarcPolicy, dmarcRecord },
    events:{ counts, recent:recentResult.results || [] }
  });
}

async function handleControlProtectionGuardStatus(request, env) {
  if (!adminAuthorized(request, env)) return json({ ok:false, error:'unauthorized' }, 401);
  const guard = await fetchGuardStatus(env, false);
  return json({
    ok:Boolean(guard.connected),
    checkedAt:new Date().toISOString(),
    guard,
    message:guard.message || (guard.connected ? 'Guard подключён.' : 'Guard недоступен.')
  }, guard.connected ? 200 : 503);
}

async function handleControlProtectionGuardRun(request, env) {
  if (!adminAuthorized(request, env)) return json({ ok:false, error:'unauthorized' }, 401);
  // ADMIN_KEY already protects this Control endpoint. Some Android PWA/WebView
  // requests omit Origin, so Origin must not prevent a valid owner command.
  const result = await fetchGuardStatus(env, true);
  if (!result.configured || !result.connected) {
    return json({
      ok:false,
      error:'guard-unavailable',
      message:result.message,
      diagnostic:result.diagnostic || null
    }, 503);
  }
  return json({ ok:true, ...result.status, message:result.message, diagnostic:result.diagnostic || null });
}

function protectionDashboardRange(value) {
  const key = ['2h','24h','7d'].includes(String(value || '')) ? String(value) : '24h';
  return { key, sql:key === '7d' ? '-7 days' : key === '2h' ? '-2 hours' : '-24 hours', ms:key === '7d' ? 7*86400000 : key === '2h' ? 2*3600000 : 86400000 };
}

function parseSystemLogDetails(value) { try { return JSON.parse(value || '{}') || {}; } catch (_) { return {}; } }

async function handleControlProtectionDashboard(request, env) {
  if (!adminAuthorized(request, env)) return json({ ok:false, error:'unauthorized' }, 401);
  const db = requireDb(env);
  await Promise.all([ensureSecuritySchema(db), ensurePushAutomationSchema(db), ensureNativeMonitorSchema(db), ensureControlV1Schema(db), ensureSiteMetricsSchema(db)]);
  const range = protectionDashboardRange(new URL(request.url).searchParams.get('range'));
  const [monitorRaw, securityBuckets, securityKinds, securityRows, systemRows, backupRows, pushRows, incidentRows, traffic] = await Promise.all([
    getNativeMonitorDashboardData(env, range.key === '7d' ? '7d' : '24h'),
    db.prepare(`SELECT (CAST(strftime('%s', created_at) AS INTEGER)/300)*300 AS bucket, COUNT(*) AS count FROM security_events WHERE datetime(created_at) >= datetime('now', ?) AND kind NOT IN ('csrf-blocked','csrf-attack-blocked','csrf-stale') GROUP BY bucket ORDER BY bucket ASC`).bind(range.sql).all(),
    db.prepare(`SELECT kind, COUNT(*) AS count FROM security_events WHERE datetime(created_at) >= datetime('now', ?) AND kind NOT IN ('csrf-blocked','csrf-attack-blocked','csrf-stale') GROUP BY kind`).bind(range.sql).all(),
    db.prepare(`SELECT kind, path, detail, country, region, colo, created_at AS createdAt FROM security_events WHERE datetime(created_at) >= datetime('now', ?) AND kind NOT IN ('csrf-blocked','csrf-attack-blocked','csrf-stale') ORDER BY datetime(created_at) DESC LIMIT 50`).bind(range.sql).all(),
    db.prepare(`SELECT scope, level, event, message, details_json AS detailsJson, created_at AS createdAt FROM system_logs WHERE datetime(created_at) >= datetime('now', ?) ORDER BY datetime(created_at) DESC LIMIT 60`).bind(range.sql).all(),
    db.prepare(`SELECT id, storage, status, row_count AS rowCount, size_bytes AS sizeBytes, reason, error, created_at AS createdAt FROM backup_history ORDER BY datetime(created_at) DESC LIMIT 20`).all(),
    db.prepare(`SELECT type, status, title, message, error, created_at AS createdAt FROM push_history WHERE datetime(created_at) >= datetime('now', ?) ORDER BY datetime(created_at) DESC LIMIT 30`).bind(range.sql).all(),
    db.prepare(`SELECT target_id AS targetId, target_name AS targetName, event_type AS eventType, status, reason, started_at AS startedAt, ended_at AS endedAt FROM control_monitor_incidents WHERE datetime(started_at) >= datetime('now', ?) ORDER BY datetime(started_at) DESC LIMIT 30`).bind(range.sql).all(),
    getSiteLiveMetrics(db)
  ]);
  const cutoff = Date.now() - range.ms;
  const monitor = { ...monitorRaw, samples:(monitorRaw.samples || []).filter(item => Date.parse(item.checkedAt || 0) >= cutoff) };
  const counts = {}; for (const row of securityKinds.results || []) counts[row.kind] = Number(row.count || 0);
  const events = [];
  for (const row of securityRows.results || []) events.push({ type:'security', category:'security', level:'warning', title:row.kind || 'Защита', message:[row.country,row.detail || row.path].filter(Boolean).join(' · '), createdAt:row.createdAt || '', details:{ country:row.country || '', region:row.region || '', colo:row.colo || '' } });
  for (const row of systemRows.results || []) events.push({ type:'system', category:row.scope || 'system', level:row.level || 'info', title:row.event || row.scope || 'Система', message:row.message || '', createdAt:row.createdAt || '', details:parseSystemLogDetails(row.detailsJson) });
  for (const row of backupRows.results || []) events.push({ type:'backup', category:'backup', level:row.status === 'failed' ? 'error' : 'info', title:row.status === 'failed' ? 'Ошибка резервной копии' : 'Резервная копия D1', message:row.status === 'failed' ? row.error : `${row.storage || 'D1'} · ${Number(row.rowCount || 0)} строк · ${row.reason || ''}`, createdAt:row.createdAt || '', details:{ id:row.id, sizeBytes:Number(row.sizeBytes || 0) } });
  for (const row of pushRows.results || []) events.push({ type:'push', category:'push', level:row.status === 'failed' ? 'error' : 'info', title:row.title || row.type || 'Push', message:row.error || row.message || '', createdAt:row.createdAt || '' });
  for (const row of incidentRows.results || []) events.push({ type:'monitor', category:'monitor', level:row.status === 'error' ? 'error' : 'warning', title:`${row.targetName || row.targetId}: ${row.eventType || 'событие'}`, message:row.reason || '', createdAt:row.startedAt || '' });
  events.sort((a,b) => Date.parse(b.createdAt || 0) - Date.parse(a.createdAt || 0));
  return json({ ok:true, range:range.key, updatedAt:new Date().toISOString(), monitor, traffic, security:{ total:Object.values(counts).reduce((a,b)=>a+Number(b || 0),0), counts, buckets:(securityBuckets.results || []).map(row => ({ at:new Date(Number(row.bucket || 0)*1000).toISOString(), count:Number(row.count || 0) })), recent:securityRows.results || [] }, backup:{ latest:(backupRows.results || [])[0] || null, count:(backupRows.results || []).filter(row=>row.status==='completed').length }, events:events.slice(0,100) });
}

async function handleControlProtectionAttacks(request, env) {
  if (!adminAuthorized(request, env)) return json({ ok:false, error:'unauthorized' }, 401);
  const db = requireDb(env); await ensureSecuritySchema(db);
  const range = String(new URL(request.url).searchParams.get('range') || '') === '7d' ? { key:'7d', sql:'-7 days' } : { key:'24h', sql:'-24 hours' };
  const [countriesRaw, totalRaw, recentRaw] = await Promise.all([
    db.prepare(`SELECT country, MAX(region) AS region, MAX(colo) AS colo, COUNT(*) AS count, MAX(created_at) AS lastAt FROM security_events WHERE datetime(created_at) >= datetime('now', ?) AND country <> '' AND kind NOT IN ('csrf-blocked','csrf-attack-blocked','csrf-stale') GROUP BY country ORDER BY count DESC, lastAt DESC LIMIT 60`).bind(range.sql).all(),
    db.prepare(`SELECT COUNT(*) AS total, SUM(CASE WHEN country='' THEN 1 ELSE 0 END) AS unknown FROM security_events WHERE datetime(created_at) >= datetime('now', ?) AND kind NOT IN ('csrf-blocked','csrf-attack-blocked','csrf-stale')`).bind(range.sql).first(),
    db.prepare(`SELECT kind, path, detail, country, region, colo, created_at AS createdAt FROM security_events WHERE datetime(created_at) >= datetime('now', ?) AND kind NOT IN ('csrf-blocked','csrf-attack-blocked','csrf-stale') ORDER BY datetime(created_at) DESC LIMIT 30`).bind(range.sql).all()
  ]);
  return json({ ok:true, range:range.key, updatedAt:new Date().toISOString(), total:Number(totalRaw?.total || 0), unknown:Number(totalRaw?.unknown || 0), countries:(countriesRaw.results || []).map(row=>({ country:cleanPlainText(row.country || '',8).toUpperCase(), region:row.region || '', colo:row.colo || '', count:Number(row.count || 0), lastAt:row.lastAt || '' })), recent:recentRaw.results || [], note:'Карта показывает события, дошедшие до Worker. DDoS, остановленный Cloudflare edge раньше Worker, сюда не попадает.' });
}


const COMMENT_GENERAL_SUBJECTS = [
  { slug: 'project', title: 'Проект ANDRIK', group: 'general' },
  { slug: 'album-illusion-of-life', title: 'Альбом «Illusion of Life»', group: 'general' },
  { slug: 'album-ocean', title: 'Альбом «OCEAN»', group: 'general' },
  { slug: 'album-trika', title: 'Альбом «Трика»', group: 'general' }
];

const COMMENT_PLAYLISTS = [
  {
    key: 'ocean',
    title: 'OCEAN',
    playlistId: 'PLOWKqAipKxhk',
    tracks: [
      ['istok', 'Исток'],
      ['probuzhdenie', 'Пробуждение'],
      ['holy-void', 'Holy Void'],
      ['ya-est', 'Я ЕСТЬ'],
      ['beskrainyaya-lyubov', 'Бескрайняя любовь'],
      ['axis-mundi', 'Axis Mundi'],
      ['pohititel-svobody', 'Похититель свободы'],
      ['svyashchennyy-razrushitel', 'Священный Разрушитель'],
      ['zhivoy-svet', 'Живой Свет'],
      ['spasibo', 'Спасибо штормам']
    ]
  },
  {
    key: 'illusion',
    title: 'Illusion of Life',
    playlistId: 'PLf3D55CqULs8',
    tracks: [
      ['intro', 'Интро'],
      ['posledniy-svet', 'Последний свет'],
      ['krik-v-pustotu', 'Крик в пустоту'],
      ['eto-ty', 'Это ты'],
      ['reka', 'Река'],
      ['obychnyy-chelovek', 'Обычный человек'],
      ['vremya', 'Время'],
      ['kto-smotrit', 'Кто смотрит?'],
      ['vzglyad', 'Взгляд'],
      ['ya-zdes', 'Я здесь'],
      ['illusion-of-life', 'Illusion of Life']
    ]
  },
  {
    key: 'official-audio',
    title: 'Official Audio Collection',
    playlistId: 'PLVEjOX_ujSMc',
    tracks: [
      ['prosnis', 'ПРОСНИСЬ'],
      ['mir-zatih', 'Мир затих'],
      ['plen-illyuziy', 'Плен иллюзий'],
      ['bitva-teney', 'Битва теней'],
      ['ne-dumay-o-tom', 'Не думай о том…'],
      ['zhidkiy-kak-rtut', 'Жидкий, как ртуть'],
      ['svet-proektora', 'Свет проектора'],
      ['personazh', 'Персонаж'],
      ['radost-bytiya', 'Радость Бытия'],
      ['pulsatsiya', 'Пульсация'],
      ['temnaya-noch-dushi', 'Тёмная ночь души'],
      ['drugoy-put', 'Другой путь'],
      ['belyy-holst', 'Белый холст']
    ]
  }
];

// Все 34 песни теперь берутся из трёх официальных YouTube-плейлистов.
// Отдельная группа больше не нужна и не должна создавать дубликаты.
const COMMENT_OTHER_SUBJECTS = [];

const COMMENT_SUBJECTS = [
  ...COMMENT_GENERAL_SUBJECTS,
  ...COMMENT_PLAYLISTS.flatMap(playlist => playlist.tracks.map(([slug, title], index) => ({
    slug,
    title,
    group: playlist.key,
    groupTitle: playlist.title,
    playlistId: playlist.playlistId,
    playlistOrder: index + 1
  }))),
  ...COMMENT_OTHER_SUBJECTS
];

function getCommentSubject(value) {
  const slug = cleanPlainText(value, 80).toLowerCase();
  if (!slug) return { slug: '', title: '' };
  return COMMENT_SUBJECTS.find(item => item.slug === slug) || { slug: '', title: '' };
}

function cleanVisitorToken(value) {
  const token = cleanPlainText(value, 100);
  return /^[A-Za-z0-9_-]{16,100}$/.test(token) ? token : '';
}

async function hashVisitorToken(token, env, purpose) {
  if (!token) return '';
  const salt = String(env.COMMENTS_HASH_SALT || 'andrik-comments');
  return sha256Hex(`${salt}:${purpose}:${token}`);
}

async function ensureCommentsV4Schema(db) {
  if (commentsSchemaV4Promise) return commentsSchemaV4Promise;
  commentsSchemaV4Promise = (async () => {
    const tableInfo = await db.prepare(`PRAGMA table_info(comments)`).all();
    const existingColumns = new Set((tableInfo.results || []).map(row => String(row.name || '')));
    const alterations = [
      ['author_hash', `ALTER TABLE comments ADD COLUMN author_hash TEXT NOT NULL DEFAULT ''`],
      ['is_pinned', `ALTER TABLE comments ADD COLUMN is_pinned INTEGER NOT NULL DEFAULT 0`],
      ['pinned_at', `ALTER TABLE comments ADD COLUMN pinned_at TEXT`],
      ['owner_reply', `ALTER TABLE comments ADD COLUMN owner_reply TEXT NOT NULL DEFAULT ''`],
      ['owner_reply_at', `ALTER TABLE comments ADD COLUMN owner_reply_at TEXT`],
      ['song_slug', `ALTER TABLE comments ADD COLUMN song_slug TEXT NOT NULL DEFAULT ''`],
      ['song_title', `ALTER TABLE comments ADD COLUMN song_title TEXT NOT NULL DEFAULT ''`]
    ];
    for (const [column, sql] of alterations) {
      if (existingColumns.has(column)) continue;
      try {
        await db.prepare(sql).run();
      } catch (error) {
        const message = String(error?.message || error || '');
        if (!/duplicate column|already exists/i.test(message)) throw error;
      }
    }
    await db.prepare(`
      CREATE TABLE IF NOT EXISTS comment_likes (
        comment_id TEXT NOT NULL,
        voter_hash TEXT NOT NULL,
        created_at TEXT NOT NULL DEFAULT (datetime('now')),
        PRIMARY KEY (comment_id, voter_hash),
        FOREIGN KEY (comment_id) REFERENCES comments(id) ON DELETE CASCADE
      )
    `).run();
    await db.prepare(`
      CREATE TABLE IF NOT EXISTS comment_reports (
        comment_id TEXT NOT NULL,
        reporter_hash TEXT NOT NULL,
        reason TEXT NOT NULL DEFAULT '',
        created_at TEXT NOT NULL DEFAULT (datetime('now')),
        PRIMARY KEY (comment_id, reporter_hash),
        FOREIGN KEY (comment_id) REFERENCES comments(id) ON DELETE CASCADE
      )
    `).run();
    await db.prepare(`CREATE INDEX IF NOT EXISTS idx_comment_likes_comment ON comment_likes(comment_id, created_at DESC)`).run();
    await db.prepare(`CREATE INDEX IF NOT EXISTS idx_comment_reports_comment ON comment_reports(comment_id, created_at DESC)`).run();
    await db.prepare(`CREATE INDEX IF NOT EXISTS idx_comments_pinned_created ON comments(status, is_pinned DESC, pinned_at DESC, created_at DESC)`).run();
    await db.prepare(`CREATE INDEX IF NOT EXISTS idx_comments_author_hash ON comments(author_hash, status, created_at DESC)`).run();
    await db.prepare(`CREATE INDEX IF NOT EXISTS idx_comments_song_status ON comments(song_slug, status, created_at DESC)`).run();
  })();
  try {
    await commentsSchemaV4Promise;
  } catch (error) {
    commentsSchemaV4Promise = null;
    throw error;
  }
}


let lyricsSchemaV2Promise = null;

async function ensureLyricsV2Schema(db) {
  if (lyricsSchemaV2Promise) return lyricsSchemaV2Promise;
  lyricsSchemaV2Promise = (async () => {
    await db.prepare(`
      CREATE TABLE IF NOT EXISTS lyrics (
        video_id TEXT PRIMARY KEY,
        normalized_title TEXT NOT NULL DEFAULT '',
        title TEXT NOT NULL,
        artist TEXT NOT NULL DEFAULT 'ANDRIK',
        body_json TEXT NOT NULL,
        enabled INTEGER NOT NULL DEFAULT 1,
        source TEXT NOT NULL DEFAULT 'manual',
        source_meta_json TEXT NOT NULL DEFAULT '{}',
        source_refreshed_at TEXT,
        created_at TEXT NOT NULL DEFAULT (datetime('now')),
        updated_at TEXT NOT NULL DEFAULT (datetime('now'))
      )
    `).run();
    const tableInfo = await db.prepare(`PRAGMA table_info(lyrics)`).all();
    const columns = new Set((tableInfo.results || []).map(row => String(row.name || '')));
    const alterations = [
      ['source', `ALTER TABLE lyrics ADD COLUMN source TEXT NOT NULL DEFAULT 'manual'`],
      ['source_meta_json', `ALTER TABLE lyrics ADD COLUMN source_meta_json TEXT NOT NULL DEFAULT '{}'`],
      ['source_refreshed_at', `ALTER TABLE lyrics ADD COLUMN source_refreshed_at TEXT`]
    ];
    for (const [column, sql] of alterations) {
      if (columns.has(column)) continue;
      try { await db.prepare(sql).run(); }
      catch (error) {
        if (!/duplicate column|already exists/i.test(String(error?.message || error || ''))) throw error;
      }
    }
    await db.prepare(`CREATE INDEX IF NOT EXISTS idx_lyrics_source_refresh ON lyrics(source, source_refreshed_at DESC)`).run();
  })();
  try { await lyricsSchemaV2Promise; }
  catch (error) { lyricsSchemaV2Promise = null; throw error; }
}

let pushAutomationSchemaPromise = null;

async function ensurePushAutomationSchema(db) {
  if (pushAutomationSchemaPromise) return pushAutomationSchemaPromise;
  pushAutomationSchemaPromise = (async () => {
    await db.prepare(`
      CREATE TABLE IF NOT EXISTS push_history (
        id TEXT PRIMARY KEY,
        type TEXT NOT NULL DEFAULT 'system',
        source TEXT NOT NULL DEFAULT '',
        audience TEXT NOT NULL DEFAULT 'all',
        status TEXT NOT NULL DEFAULT 'sent',
        title TEXT NOT NULL DEFAULT '',
        message TEXT NOT NULL DEFAULT '',
        url TEXT NOT NULL DEFAULT '',
        video_id TEXT NOT NULL DEFAULT '',
        video_title TEXT NOT NULL DEFAULT '',
        onesignal_id TEXT NOT NULL DEFAULT '',
        recipients INTEGER NOT NULL DEFAULT 0,
        error TEXT NOT NULL DEFAULT '',
        details_json TEXT NOT NULL DEFAULT '{}',
        created_at TEXT NOT NULL DEFAULT (datetime('now'))
      )
    `).run();
    await db.prepare(`CREATE INDEX IF NOT EXISTS idx_push_history_created ON push_history(created_at DESC)`).run();
    await db.prepare(`CREATE INDEX IF NOT EXISTS idx_push_history_type_created ON push_history(type, created_at DESC)`).run();
    await db.prepare(`CREATE INDEX IF NOT EXISTS idx_push_history_video ON push_history(video_id, created_at DESC)`).run();
    await db.prepare(`
      CREATE TABLE IF NOT EXISTS system_logs (
        id TEXT PRIMARY KEY,
        scope TEXT NOT NULL DEFAULT 'system',
        level TEXT NOT NULL DEFAULT 'info',
        event TEXT NOT NULL DEFAULT '',
        message TEXT NOT NULL DEFAULT '',
        details_json TEXT NOT NULL DEFAULT '{}',
        created_at TEXT NOT NULL DEFAULT (datetime('now'))
      )
    `).run();
    await db.prepare(`CREATE INDEX IF NOT EXISTS idx_system_logs_created ON system_logs(created_at DESC)`).run();
    await db.prepare(`CREATE INDEX IF NOT EXISTS idx_system_logs_scope_created ON system_logs(scope, created_at DESC)`).run();
    await db.prepare(`
      CREATE TABLE IF NOT EXISTS push_subscribers (
        subscription_id TEXT PRIMARY KEY,
        status TEXT NOT NULL DEFAULT 'active',
        source TEXT NOT NULL DEFAULT 'site',
        label TEXT NOT NULL DEFAULT '',
        country TEXT NOT NULL DEFAULT '',
        region TEXT NOT NULL DEFAULT '',
        city TEXT NOT NULL DEFAULT '',
        latitude REAL,
        longitude REAL,
        created_at TEXT NOT NULL DEFAULT (datetime('now')),
        updated_at TEXT NOT NULL DEFAULT (datetime('now')),
        last_seen_at TEXT NOT NULL DEFAULT (datetime('now'))
      )
    `).run();
    const pushGeoAlterations = [
      `ALTER TABLE push_subscribers ADD COLUMN country TEXT NOT NULL DEFAULT ''`,
      `ALTER TABLE push_subscribers ADD COLUMN region TEXT NOT NULL DEFAULT ''`,
      `ALTER TABLE push_subscribers ADD COLUMN city TEXT NOT NULL DEFAULT ''`,
      `ALTER TABLE push_subscribers ADD COLUMN latitude REAL`,
      `ALTER TABLE push_subscribers ADD COLUMN longitude REAL`
    ];
    for (const sql of pushGeoAlterations) {
      await db.prepare(sql).run().catch(error => {
        if (!/duplicate column|already exists/i.test(String(error?.message || error || ''))) throw error;
      });
    }
    await db.prepare(`CREATE INDEX IF NOT EXISTS idx_push_subscribers_status_seen ON push_subscribers(status, last_seen_at DESC)`).run();
    await db.prepare(`CREATE INDEX IF NOT EXISTS idx_push_subscribers_geo ON push_subscribers(status, country, region, city)`).run().catch(() => {});
  })();
  try {
    await pushAutomationSchemaPromise;
  } catch (error) {
    pushAutomationSchemaPromise = null;
    throw error;
  }
}


let observabilitySchemaPromise = null;

async function ensureObservabilitySchema(db) {
  if (observabilitySchemaPromise) return observabilitySchemaPromise;
  observabilitySchemaPromise = (async () => {
    await db.prepare(`
      CREATE TABLE IF NOT EXISTS observability_usage (
        date_key TEXT NOT NULL,
        service TEXT NOT NULL,
        units INTEGER NOT NULL DEFAULT 0,
        requests INTEGER NOT NULL DEFAULT 0,
        details_json TEXT NOT NULL DEFAULT '{}',
        updated_at TEXT NOT NULL DEFAULT (datetime('now')),
        PRIMARY KEY (date_key, service)
      )
    `).run();
    await db.prepare(`CREATE INDEX IF NOT EXISTS idx_observability_usage_updated ON observability_usage(updated_at DESC)`).run();
  })();
  try { await observabilitySchemaPromise; }
  catch (error) { observabilitySchemaPromise = null; throw error; }
}

async function trackObservabilityUsage(env, service, units = 0, requests = 1, details = {}) {
  if (!env.COMMENTS_DB) return;
  const db = env.COMMENTS_DB;
  await ensureObservabilitySchema(db);
  const dateKey = getBratislavaClock().date;
  let detailsJson = '{}';
  try { detailsJson = JSON.stringify(details || {}); } catch (_) {}
  await db.prepare(`
    INSERT INTO observability_usage (date_key, service, units, requests, details_json, updated_at)
    VALUES (?, ?, ?, ?, ?, datetime('now'))
    ON CONFLICT(date_key, service) DO UPDATE SET
      units = observability_usage.units + excluded.units,
      requests = observability_usage.requests + excluded.requests,
      details_json = excluded.details_json,
      updated_at = datetime('now')
  `).bind(
    dateKey,
    cleanPlainText(service || 'unknown', 80),
    Math.max(0, Number(units || 0)),
    Math.max(0, Number(requests || 0)),
    detailsJson
  ).run();
  if (cleanPlainText(service || '', 80) === 'youtube-data-api') {
    await maybeSendYoutubeQuota50AlertR333(env, db, dateKey).catch(()=>{});
  }
}

function observabilityQuotaCost(endpoint, method = 'GET') {
  const key = cleanPlainText(endpoint || '', 80).toLowerCase();
  if (method !== 'GET') {
    if (key === 'comments' || key === 'commentthreads' || key === 'subscriptions') return 50;
    return 50;
  }
  if (key === 'captions-list') return 50;
  if (key === 'captions-download') return 200;
  if (key === 'search') return 100;
  return 1;
}

async function maybeSendYoutubeQuota50AlertR333(env, db, dateKey='') {
  try {
    const keyDate=cleanPlainText(dateKey || getBratislavaClock().date,20);
    const row=await db.prepare(`
      SELECT units,requests FROM observability_usage
      WHERE date_key=? AND service='youtube-data-api' LIMIT 1
    `).bind(keyDate).first();
    const units=Math.max(0,Number(row?.units || 0));
    const requests=Math.max(0,Number(row?.requests || 0));
    const limit=Math.max(100,Number(env.YOUTUBE_DAILY_QUOTA_LIMIT || 10000));
    if(units < Math.ceil(limit*0.50)) return {ok:true,sent:false,units,limit};

    await ensurePushAutomationSchema(db);
    const onceKey=`push-once:youtube-quota-50:${keyDate}`;
    const claimed=await claimPushOnce(db,onceKey,new Date().toISOString());
    if(!claimed)return {ok:true,sent:false,duplicate:true,units,limit};

    const percent=Math.min(100,Math.round((units/limit)*1000)/10);
    const remaining=Math.max(0,limit-units);
    const result=await sendOwnerPush(env,{
      title:'⚠️ YouTube API — 50% квоты',
      message:`Использовано ${units.toLocaleString('ru-RU')} из ${limit.toLocaleString('ru-RU')} units · ${percent}% · осталось ${remaining.toLocaleString('ru-RU')}`,
      url:'https://control.andrikmetal.com/youtube-admin.html',
      name:`youtube-quota-50-${keyDate}`,
      ttl:43200,
      history:{type:'youtube-quota-50',source:'YouTube Data API',details:{dateKey:keyDate,units,requests,limit,percent,remaining,threshold:50,mode:'approximate-observability-r333'}}
    });
    if(!result.ok){
      await releasePushOnceClaim(db,onceKey);
      return {ok:false,sent:false,error:result.error || 'push-failed',units,limit};
    }
    await setPushState(db,`youtube-quota-50-sent:${keyDate}`,JSON.stringify({units,requests,limit,percent,remaining,sentAt:new Date().toISOString()})).catch(()=>{});
    return {ok:true,sent:true,units,limit,percent,remaining};
  }catch(error){
    return {ok:false,sent:false,error:cleanPlainText(error?.message || error,300)};
  }
}


let nativeMonitorSchemaPromise = null;

async function ensureNativeMonitorSchema(db) {
  if (nativeMonitorSchemaPromise) return nativeMonitorSchemaPromise;
  nativeMonitorSchemaPromise = (async () => {
    await db.prepare(`
      CREATE TABLE IF NOT EXISTS control_monitor_samples (
        id TEXT PRIMARY KEY,
        target_id TEXT NOT NULL,
        target_name TEXT NOT NULL DEFAULT '',
        target_url TEXT NOT NULL DEFAULT '',
        status TEXT NOT NULL DEFAULT 'warning',
        http_status INTEGER NOT NULL DEFAULT 0,
        response_time_ms INTEGER NOT NULL DEFAULT 0,
        detail TEXT NOT NULL DEFAULT '',
        checked_at TEXT NOT NULL,
        source TEXT NOT NULL DEFAULT 'cron'
      )
    `).run();
    await db.prepare(`CREATE INDEX IF NOT EXISTS idx_control_monitor_samples_target_time ON control_monitor_samples(target_id, checked_at DESC)`).run();
    await db.prepare(`CREATE INDEX IF NOT EXISTS idx_control_monitor_samples_time ON control_monitor_samples(checked_at DESC)`).run();
    await db.prepare(`
      CREATE TABLE IF NOT EXISTS control_monitor_incidents (
        id TEXT PRIMARY KEY,
        target_id TEXT NOT NULL,
        target_name TEXT NOT NULL DEFAULT '',
        target_url TEXT NOT NULL DEFAULT '',
        event_type TEXT NOT NULL DEFAULT 'down',
        status TEXT NOT NULL DEFAULT 'error',
        reason TEXT NOT NULL DEFAULT '',
        started_at TEXT NOT NULL,
        ended_at TEXT NOT NULL DEFAULT '',
        duration_seconds INTEGER NOT NULL DEFAULT 0,
        created_at TEXT NOT NULL DEFAULT (datetime('now'))
      )
    `).run();
    await db.prepare(`CREATE INDEX IF NOT EXISTS idx_control_monitor_incidents_time ON control_monitor_incidents(started_at DESC)`).run();
    await db.prepare(`CREATE INDEX IF NOT EXISTS idx_control_monitor_incidents_target ON control_monitor_incidents(target_id, started_at DESC)`).run();
  })();
  try { await nativeMonitorSchemaPromise; }
  catch (error) { nativeMonitorSchemaPromise = null; throw error; }
}

function getNativeMonitorTargets(env) {
  const publicOrigin = cleanPlainText(env.PUBLIC_SITE_ORIGIN || 'https://andrikmetal.com/', 300) || 'https://andrikmetal.com/';
  const controlOrigin = cleanPlainText(env.CONTROL_SITE_ORIGIN || 'https://control.andrikmetal.com/', 300) || 'https://control.andrikmetal.com/';
  let healthUrl = 'https://control.andrikmetal.com/api/health';
  try { healthUrl = new URL('/api/health', controlOrigin).toString(); } catch (_) {}
  return [
    { id:'site', name:'Сайт ANDRIK', url:publicOrigin, kind:'asset', assetPath:'/index.html', accept:'text/html', warningMs:1200, timeoutMs:5000 },
    { id:'control', name:'Control ANDRIK', url:controlOrigin, kind:'asset', assetPath:'/analytics-admin.html', accept:'text/html', warningMs:1200, timeoutMs:5000 },
    { id:'health', name:'Worker + D1', url:healthUrl, kind:'database', accept:'application/json', warningMs:800, timeoutMs:5000 }
  ];
}

function nativeMonitorSampleId(targetId, checkedAt, source='cron') {
  const stamp = Math.floor(Date.parse(checkedAt || new Date().toISOString()) / 60000);
  return `${cleanPlainText(targetId, 40)}:${stamp}:${cleanPlainText(source, 30)}`;
}

function nativeMonitorStatusLabel(status) {
  if (status === 'good') return 'Работает';
  if (status === 'error') return 'Недоступен';
  return 'Медленный ответ';
}

async function probeNativeMonitorTarget(target, env) {
  const started = Date.now();
  try {
    let response;
    if (target.kind === 'database') {
      if (!env.COMMENTS_DB) throw new Error('COMMENTS_DB не подключена');
      await promiseWithTimeout(env.COMMENTS_DB.prepare('SELECT 1 AS ok').first(), Number(target.timeoutMs || 5000), `monitor-timeout-${target.id}`);
      response = { ok:true, status:200, body:null };
    } else if (target.kind === 'asset') {
      if (!env.ASSETS) throw new Error('ASSETS не подключены');
      const assetUrl = new URL(target.assetPath || '/', target.url);
      response = await promiseWithTimeout(env.ASSETS.fetch(new Request(assetUrl.toString(), {
        method:'GET',
        headers:{ accept:target.accept || '*/*', 'cache-control':'no-cache' }
      })), Number(target.timeoutMs || 5000), `monitor-timeout-${target.id}`);
    } else {
      response = await promiseWithTimeout(fetch(target.url, {
        method:'GET', redirect:'follow',
        headers:{ accept:target.accept || '*/*', 'cache-control':'no-cache', 'user-agent':'ANDRIK-Control-Monitor/55.00g' }
      }), Number(target.timeoutMs || 5000), `monitor-timeout-${target.id}`);
    }
    const responseTimeMs = Math.max(0, Date.now() - started);
    const httpStatus = Number(response.status || 0);
    const ok = Boolean(response.ok);
    try { await response.body?.cancel?.(); } catch (_) {}
    const status = !ok ? 'error' : responseTimeMs > Number(target.warningMs || 2500) ? 'warning' : 'good';
    return {
      ...target,
      status,
      httpStatus,
      responseTimeMs,
      detail:!ok ? `HTTP ${httpStatus}` : status === 'warning' ? `HTTP ${httpStatus} · медленно ${responseTimeMs} мс` : `HTTP ${httpStatus} · ${responseTimeMs} мс`
    };
  } catch (error) {
    return {
      ...target,
      status:'error',
      httpStatus:0,
      responseTimeMs:Math.max(0, Date.now() - started),
      detail:cleanPlainText(error?.message || error || 'Ошибка соединения', 240)
    };
  }
}

async function recordNativeMonitorTransition(env, db, result, previous, checkedAt, sendNotifications) {
  const previousStatus = cleanPlainText(previous?.status || '', 20);
  const currentStatus = result.status;
  if (previousStatus === currentStatus) return { changed:false };

  if (currentStatus === 'error') {
    const incidentId = `monitor-down:${result.id}:${Date.now()}`;
    await db.prepare(`
      INSERT INTO control_monitor_incidents (
        id, target_id, target_name, target_url, event_type, status, reason, started_at
      ) VALUES (?, ?, ?, ?, 'down', 'error', ?, ?)
    `).bind(incidentId, result.id, result.name, result.url, result.detail, checkedAt).run();
    if (sendNotifications) {
      const title = `🔴 ${result.name} недоступен`;
      const message = `${result.detail}\nANDRIK Monitor зафиксировал сбой.`;
      const push = await sendOwnerPush(env, {
        title,
        message,
        url:'https://control.andrikmetal.com/observability-admin.html?v=55.00-r3d',
        name:`ANDRIK monitor down ${result.id} ${Date.now()}`,
        collapseId:`andrik-monitor-${result.id}`,
        webPushTopic:`andrik-monitor-${result.id}`,
        ttl:21600,
        history:{
          type:'monitor-down', source:`native-monitor:${result.id}:${checkedAt}`, title, message,
          url:'https://control.andrikmetal.com/observability-admin.html?v=55.00-r3d',
          details:{ targetId:result.id, targetUrl:result.url, responseTimeMs:result.responseTimeMs, httpStatus:result.httpStatus }
        }
      });
      return { changed:true, eventType:'down', push };
    }
    return { changed:true, eventType:'down' };
  }

  if (previousStatus === 'error' && currentStatus !== 'error') {
    const openIncident = await db.prepare(`
      SELECT id, started_at AS startedAt
      FROM control_monitor_incidents
      WHERE target_id=? AND event_type='down' AND ended_at=''
      ORDER BY datetime(started_at) DESC LIMIT 1
    `).bind(result.id).first();
    if (openIncident?.id) {
      const durationSeconds = Math.max(0, Math.round((Date.parse(checkedAt) - Date.parse(openIncident.startedAt || checkedAt)) / 1000));
      await db.prepare(`UPDATE control_monitor_incidents SET ended_at=?, duration_seconds=? WHERE id=?`)
        .bind(checkedAt, durationSeconds, openIncident.id).run();
    }
    await db.prepare(`
      INSERT INTO control_monitor_incidents (
        id, target_id, target_name, target_url, event_type, status, reason, started_at, ended_at
      ) VALUES (?, ?, ?, ?, 'recovery', ?, ?, ?, ?)
    `).bind(`monitor-recovery:${result.id}:${Date.now()}`, result.id, result.name, result.url, currentStatus, result.detail, checkedAt, checkedAt).run();
    if (sendNotifications) {
      const title = `✅ ${result.name} снова работает`;
      const message = `${result.detail}\nANDRIK Monitor подтвердил восстановление.`;
      const push = await sendOwnerPush(env, {
        title,
        message,
        url:'https://control.andrikmetal.com/observability-admin.html?v=55.00-r3d',
        name:`ANDRIK monitor recovery ${result.id} ${Date.now()}`,
        collapseId:`andrik-monitor-${result.id}`,
        webPushTopic:`andrik-monitor-${result.id}`,
        ttl:21600,
        history:{
          type:'monitor-recovery', source:`native-monitor:${result.id}:${checkedAt}`, title, message,
          url:'https://control.andrikmetal.com/observability-admin.html?v=55.00-r3d',
          details:{ targetId:result.id, targetUrl:result.url, responseTimeMs:result.responseTimeMs, httpStatus:result.httpStatus }
        }
      });
      return { changed:true, eventType:'recovery', push };
    }
    return { changed:true, eventType:'recovery' };
  }

  if (currentStatus === 'warning') {
    await db.prepare(`
      INSERT INTO control_monitor_incidents (
        id, target_id, target_name, target_url, event_type, status, reason, started_at, ended_at
      ) VALUES (?, ?, ?, ?, 'warning', 'warning', ?, ?, ?)
    `).bind(`monitor-warning:${result.id}:${Date.now()}`, result.id, result.name, result.url, result.detail, checkedAt, checkedAt).run();
    return { changed:true, eventType:'warning' };
  }

  return { changed:true, eventType:'normal' };
}

async function runNativeMonitor(env, options={}) {
  const db = requireDb(env);
  await Promise.all([ensurePushAutomationSchema(db), ensureNativeMonitorSchema(db)]);
  const checkedAt = new Date().toISOString();
  const source = cleanPlainText(options.source || 'manual', 30) || 'manual';
  const targets = getNativeMonitorTargets(env);
  const results = await Promise.all(targets.map(target => probeNativeMonitorTarget(target, env)));
  const transitions = [];

  for (const result of results) {
    const previous = await db.prepare(`
      SELECT status, checked_at AS checkedAt
      FROM control_monitor_samples
      WHERE target_id=?
      ORDER BY datetime(checked_at) DESC LIMIT 1
    `).bind(result.id).first();
    await db.prepare(`
      INSERT INTO control_monitor_samples (
        id, target_id, target_name, target_url, status, http_status,
        response_time_ms, detail, checked_at, source
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(id) DO UPDATE SET
        target_name=excluded.target_name, target_url=excluded.target_url,
        status=excluded.status, http_status=excluded.http_status,
        response_time_ms=excluded.response_time_ms, detail=excluded.detail,
        checked_at=excluded.checked_at, source=excluded.source
    `).bind(
      nativeMonitorSampleId(result.id, checkedAt, source), result.id, result.name, result.url,
      result.status, result.httpStatus, result.responseTimeMs, result.detail, checkedAt, source
    ).run();
    transitions.push(await recordNativeMonitorTransition(env, db, result, previous, checkedAt, options.sendNotifications !== false));
  }

  const errorCount = results.filter(item => item.status === 'error').length;
  const warningCount = results.filter(item => item.status === 'warning').length;
  const status = errorCount ? 'error' : warningCount ? 'warning' : 'good';
  await Promise.all([
    setPushState(db, 'native-monitor-last-sync-at', checkedAt),
    setPushState(db, 'native-monitor-last-status', status),
    setPushState(db, 'native-monitor-target-count', String(results.length)),
    setPushState(db, 'native-monitor-error-count', String(errorCount)),
    setPushState(db, 'native-monitor-warning-count', String(warningCount))
  ]);
  await recordSystemLog(env, {
    scope:'monitor', level:errorCount?'error':warningCount?'warning':'info', event:'native-check',
    message:`ANDRIK Monitor: ${results.length-errorCount-warningCount}/${results.length} быстро, предупреждений ${warningCount}, ошибок ${errorCount}.`,
    details:{ source, checkedAt, results, transitions }
  }).catch(() => {});
  return { ok:errorCount===0, status, checkedAt, errorCount, warningCount, results, transitions };
}

function nativeMonitorRange(value) {
  const key = ['24h','7d','30d'].includes(String(value || '')) ? String(value) : '24h';
  return { key, sql:key === '30d' ? '-30 days' : key === '7d' ? '-7 days' : '-24 hours' };
}

async function getNativeMonitorDashboardData(env, rangeValue='24h') {
  const db = requireDb(env);
  await Promise.all([ensurePushAutomationSchema(db), ensureNativeMonitorSchema(db)]);
  const range = nativeMonitorRange(rangeValue);
  const [sampleRows, latestRows, incidentRows, lastSync, lastStatus] = await Promise.all([
    db.prepare(`
      SELECT target_id AS targetId, target_name AS targetName, target_url AS targetUrl,
             status, http_status AS httpStatus, response_time_ms AS responseTimeMs,
             detail, checked_at AS checkedAt
      FROM control_monitor_samples
      WHERE datetime(checked_at) >= datetime('now', ?)
      ORDER BY datetime(checked_at) ASC
      LIMIT 4000
    `).bind(range.sql).all(),
    db.prepare(`
      SELECT s.target_id AS targetId, s.target_name AS targetName, s.target_url AS targetUrl,
             s.status, s.http_status AS httpStatus, s.response_time_ms AS responseTimeMs,
             s.detail, s.checked_at AS checkedAt,
             ROUND(100.0 * SUM(CASE WHEN r.status='error' THEN 0 ELSE 1 END) / NULLIF(COUNT(r.id), 0), 3) AS availability
      FROM control_monitor_samples s
      JOIN (
        SELECT target_id, MAX(datetime(checked_at)) AS max_checked
        FROM control_monitor_samples GROUP BY target_id
      ) latest ON latest.target_id=s.target_id AND datetime(s.checked_at)=latest.max_checked
      LEFT JOIN control_monitor_samples r ON r.target_id=s.target_id AND datetime(r.checked_at) >= datetime('now', ?)
      GROUP BY s.target_id, s.target_name, s.target_url, s.status, s.http_status, s.response_time_ms, s.detail, s.checked_at
      ORDER BY s.target_id
    `).bind(range.sql).all(),
    db.prepare(`
      SELECT target_id AS targetId, target_name AS targetName, target_url AS targetUrl,
             event_type AS eventType, status, reason, started_at AS startedAt,
             ended_at AS endedAt, duration_seconds AS durationSeconds
      FROM control_monitor_incidents
      WHERE datetime(started_at) >= datetime('now', '-30 days')
      ORDER BY datetime(started_at) DESC LIMIT 40
    `).all(),
    getPushState(db, 'native-monitor-last-sync-at'),
    getPushState(db, 'native-monitor-last-status')
  ]);
  const targets = latestRows.results || [];
  return {
    range:range.key,
    connected:Boolean(targets.length),
    status:lastStatus?.value || (targets.length ? 'warning' : 'waiting'),
    lastSyncAt:lastSync?.value || '',
    monitorCount:targets.length,
    errorCount:targets.filter(item => item.status === 'error').length,
    warningCount:targets.filter(item => item.status === 'warning').length,
    targets,
    samples:sampleRows.results || [],
    incidents:incidentRows.results || []
  };
}

async function handleControlNativeMonitor(request, env) {
  if (!adminAuthorized(request, env)) return json({ ok:false, error:'unauthorized' }, 401);
  const url = new URL(request.url);
  if (url.searchParams.get('refresh') === '1') {
    await runNativeMonitor(env, { sendNotifications:true, source:'manual-view' });
  }
  return json({ ok:true, ...(await getNativeMonitorDashboardData(env, url.searchParams.get('range') || '24h')) });
}

async function handleControlNativeMonitorCheck(request, env) {
  if (!adminAuthorized(request, env)) return json({ ok:false, error:'unauthorized' }, 401);
  const result = await runNativeMonitor(env, { sendNotifications:true, source:'manual-control' });
  return json(result, result.ok ? 200 : 207);
}


let siteMetricsSchemaPromise = null;

async function ensureSiteMetricsSchema(db) {
  if (siteMetricsSchemaPromise) return siteMetricsSchemaPromise;
  siteMetricsSchemaPromise = (async () => {
    await db.prepare(`
      CREATE TABLE IF NOT EXISTS site_visit_events (
        id TEXT PRIMARY KEY,
        visitor_hash TEXT NOT NULL,
        path TEXT NOT NULL DEFAULT '/',
        event_type TEXT NOT NULL DEFAULT 'visit',
        target TEXT NOT NULL DEFAULT '',
        country TEXT NOT NULL DEFAULT '',
        region TEXT NOT NULL DEFAULT '',
        city TEXT NOT NULL DEFAULT '',
        latitude REAL,
        longitude REAL,
        local_date TEXT NOT NULL,
        created_at TEXT NOT NULL DEFAULT (datetime('now'))
      )
    `).run();
    const siteGeoAlterations = [
      `ALTER TABLE site_visit_events ADD COLUMN event_type TEXT NOT NULL DEFAULT 'visit'`,
      `ALTER TABLE site_visit_events ADD COLUMN target TEXT NOT NULL DEFAULT ''`,
      `ALTER TABLE site_visit_events ADD COLUMN country TEXT NOT NULL DEFAULT ''`,
      `ALTER TABLE site_visit_events ADD COLUMN region TEXT NOT NULL DEFAULT ''`,
      `ALTER TABLE site_visit_events ADD COLUMN city TEXT NOT NULL DEFAULT ''`,
      `ALTER TABLE site_visit_events ADD COLUMN latitude REAL`,
      `ALTER TABLE site_visit_events ADD COLUMN longitude REAL`
    ];
    for (const sql of siteGeoAlterations) {
      await db.prepare(sql).run().catch(error => {
        if (!/duplicate column|already exists/i.test(String(error?.message || error || ''))) throw error;
      });
    }
    await db.prepare(`CREATE INDEX IF NOT EXISTS idx_site_visit_local_date ON site_visit_events(local_date, created_at DESC)`).run();
    await db.prepare(`CREATE INDEX IF NOT EXISTS idx_site_visit_visitor_date ON site_visit_events(visitor_hash, local_date)`).run();
    await db.prepare(`CREATE INDEX IF NOT EXISTS idx_site_visit_geo ON site_visit_events(event_type, country, region, city, created_at DESC)`).run().catch(() => {});
  })();
  try { await siteMetricsSchemaPromise; }
  catch (error) { siteMetricsSchemaPromise = null; throw error; }
}

function normalizeSitePath(value) {
  const path = cleanPlainText(value || '/', 260).split('?')[0].split('#')[0];
  return path.startsWith('/') ? path : `/${path}`;
}

async function handleSiteVisit(request, env) {
  if (!isSameOrigin(request)) return json({ ok:false, error:'origin' }, 403);
  const db = requireDb(env);
  await ensureSiteMetricsSchema(db);
  let body;
  try { body = await readJsonBody(request, 4000); }
  catch (_) { return json({ ok:false, error:'invalid-json' }, 400); }
  const visitorId = cleanPlainText(body.visitorId, 120);
  if (!/^[a-z0-9_-]{16,120}$/i.test(visitorId)) return json({ ok:false, error:'validation' }, 400);
  const visitorHash = await sha256Hex(`andrik-site:${visitorId}`);
  const localDate = getBratislavaClock().date;
  const allowedEventTypes = new Set([
    'visit','music-download','music-listen','telegram-open','youtube-open',
    'spotify-open','apple-music-open','soundcloud-open','amazon-music-open','external-open'
  ]);
  const requestedType = cleanPlainText(body.eventType || 'visit', 40).toLowerCase();
  const eventType = allowedEventTypes.has(requestedType) ? requestedType : 'external-open';
  const target = cleanPlainText(body.target || '', 500);
  const cf = request.cf || {};
  const country = cleanPlainText(cf.country || '', 8).toUpperCase();
  const region = cleanPlainText(cf.region || cf.regionCode || '', 120);
  const city = cleanPlainText(cf.city || '', 120);
  const latRaw = Number(cf.latitude);
  const lonRaw = Number(cf.longitude);
  // R338 keeps R336 privacy and adds country drilldown UI: only coarse (~11 km) edge coordinates are stored; raw IP is never stored.
  const latitude = Number.isFinite(latRaw) ? Math.round(latRaw * 10) / 10 : null;
  const longitude = Number.isFinite(lonRaw) ? Math.round(lonRaw * 10) / 10 : null;
  await db.prepare(`
    INSERT INTO site_visit_events(
      id, visitor_hash, path, event_type, target, country, region, city, latitude, longitude, local_date, created_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now'))
  `).bind(
    crypto.randomUUID(), visitorHash, normalizeSitePath(body.path), eventType, target,
    country, region, city, latitude, longitude, localDate
  ).run();
  // Keep this lightweight first-party counter small; long-term analytics remains in GA4.
  await db.prepare(`DELETE FROM site_visit_events WHERE local_date < date('now','-62 days')`).run().catch(() => {});
  return json({ ok:true, localDate, eventType });
}

async function getSiteLiveMetrics(db) {
  await ensureSiteMetricsSchema(db);
  const localDate = getBratislavaClock().date;
  const [today, realtime] = await Promise.all([
    db.prepare(`
      SELECT COUNT(*) AS views, COUNT(DISTINCT visitor_hash) AS users
      FROM site_visit_events WHERE local_date = ? AND event_type = 'visit'
    `).bind(localDate).first(),
    db.prepare(`
      SELECT COUNT(*) AS views, COUNT(DISTINCT visitor_hash) AS users
      FROM site_visit_events WHERE created_at >= datetime('now','-30 minutes') AND event_type = 'visit'
    `).first()
  ]);
  return {
    configured:true,
    localDate,
    today:{ views:Number(today?.views || 0), users:Number(today?.users || 0) },
    realtime:{ views:Number(realtime?.views || 0), users:Number(realtime?.users || 0) },
    updatedAt:new Date().toISOString()
  };
}

async function getSiteWindowMetrics(db, startAt, endAt = '') {
  await ensureSiteMetricsSchema(db);
  const safeStart = cleanPlainText(startAt || '', 80);
  const safeEnd = cleanPlainText(endAt || '', 80);
  const row = safeEnd
    ? await db.prepare(`
        SELECT COUNT(*) AS views, COUNT(DISTINCT visitor_hash) AS users
        FROM site_visit_events
        WHERE event_type = 'visit'
          AND datetime(created_at) >= datetime(?1)
          AND datetime(created_at) < datetime(?2)
      `).bind(safeStart, safeEnd).first()
    : await db.prepare(`
        SELECT COUNT(*) AS views, COUNT(DISTINCT visitor_hash) AS users
        FROM site_visit_events
        WHERE event_type = 'visit'
          AND datetime(created_at) >= datetime(?1)
      `).bind(safeStart).first();
  return {
    views:Number(row?.views || 0),
    users:Number(row?.users || 0),
    startAt:safeStart,
    endAt:safeEnd,
    updatedAt:new Date().toISOString()
  };
}

function mergeGoogleWithSiteLive(google = {}, live = {}) {
  const today = { ...(google?.today || {}) };
  const realtime = { ...(google?.realtime || {}) };
  const liveToday = live?.today || {};
  const liveRealtime = live?.realtime || {};
  today.activeUsers = Math.max(Number(today.activeUsers || 0), Number(liveToday.users || 0));
  today.sessions = Math.max(Number(today.sessions || 0), Number(liveToday.users || 0));
  today.screenPageViews = Math.max(Number(today.screenPageViews || 0), Number(liveToday.views || 0));
  today.eventCount = Math.max(Number(today.eventCount || 0), Number(liveToday.views || 0));
  realtime.activeUsers = Math.max(Number(realtime.activeUsers || 0), Number(liveRealtime.users || 0));
  realtime.screenPageViews = Math.max(Number(realtime.screenPageViews || 0), Number(liveRealtime.views || 0));
  return {
    ...google,
    configured:Boolean(google?.configured || live?.configured),
    propertyName:google?.propertyName || 'andrikmetal.com',
    realtime,
    today,
    liveCounter:live,
    updatedAt:new Date().toISOString()
  };
}


let controlV1SchemaPromise = null;

async function ensureControlV1Schema(db) {
  if (controlV1SchemaPromise) return controlV1SchemaPromise;
  controlV1SchemaPromise = (async () => {
    await db.prepare(`
      CREATE TABLE IF NOT EXISTS release_history (
        video_id TEXT PRIMARY KEY,
        title TEXT NOT NULL DEFAULT '',
        url TEXT NOT NULL DEFAULT '',
        source TEXT NOT NULL DEFAULT '',
        push_status TEXT NOT NULL DEFAULT 'unknown',
        lyrics_status TEXT NOT NULL DEFAULT 'missing',
        published_at TEXT NOT NULL DEFAULT (datetime('now')),
        updated_at TEXT NOT NULL DEFAULT (datetime('now')),
        details_json TEXT NOT NULL DEFAULT '{}'
      )
    `).run();
    await db.prepare(`CREATE INDEX IF NOT EXISTS idx_release_history_published ON release_history(published_at DESC)`).run();
    await db.prepare(`CREATE INDEX IF NOT EXISTS idx_release_history_push ON release_history(push_status, published_at DESC)`).run();

    await db.prepare(`
      CREATE TABLE IF NOT EXISTS backup_history (
        id TEXT PRIMARY KEY,
        storage TEXT NOT NULL DEFAULT '',
        object_key TEXT NOT NULL DEFAULT '',
        status TEXT NOT NULL DEFAULT 'completed',
        table_count INTEGER NOT NULL DEFAULT 0,
        row_count INTEGER NOT NULL DEFAULT 0,
        size_bytes INTEGER NOT NULL DEFAULT 0,
        checksum TEXT NOT NULL DEFAULT '',
        reason TEXT NOT NULL DEFAULT '',
        error TEXT NOT NULL DEFAULT '',
        created_at TEXT NOT NULL DEFAULT (datetime('now'))
      )
    `).run();
    await db.prepare(`CREATE INDEX IF NOT EXISTS idx_backup_history_created ON backup_history(created_at DESC)`).run();

    await db.prepare(`
      CREATE TABLE IF NOT EXISTS backup_snapshots (
        id TEXT PRIMARY KEY,
        payload_json TEXT NOT NULL,
        created_at TEXT NOT NULL DEFAULT (datetime('now'))
      )
    `).run();
    await db.prepare(`CREATE INDEX IF NOT EXISTS idx_backup_snapshots_created ON backup_snapshots(created_at DESC)`).run();

    await db.prepare(`
      CREATE TABLE IF NOT EXISTS youtube_oauth_tokens (
        id TEXT PRIMARY KEY,
        refresh_token_enc TEXT NOT NULL DEFAULT '',
        scope TEXT NOT NULL DEFAULT '',
        channel_id TEXT NOT NULL DEFAULT '',
        created_at TEXT NOT NULL DEFAULT (datetime('now')),
        updated_at TEXT NOT NULL DEFAULT (datetime('now'))
      )
    `).run();
  })();
  try { await controlV1SchemaPromise; }
  catch (error) { controlV1SchemaPromise = null; throw error; }
}

async function upsertReleaseHistory(db, entry = {}) {
  await ensureControlV1Schema(db);
  const videoId = cleanPlainText(entry.videoId, 32);
  if (!videoId) return;
  const title = normalizeReleaseTitle(entry.title || entry.videoTitle || 'Новый трек');
  const url = cleanPlainText(entry.url || `https://www.youtube.com/watch?v=${encodeURIComponent(videoId)}`, 700);
  const detailsJson = (() => { try { return JSON.stringify(entry.details || {}); } catch (_) { return '{}'; } })();
  await db.prepare(`
    INSERT INTO release_history (
      video_id, title, url, source, push_status, lyrics_status,
      published_at, updated_at, details_json
    ) VALUES (?, ?, ?, ?, ?, ?, COALESCE(NULLIF(?, ''), datetime('now')), datetime('now'), ?)
    ON CONFLICT(video_id) DO UPDATE SET
      title = excluded.title,
      url = excluded.url,
      source = CASE WHEN excluded.source != '' THEN excluded.source ELSE release_history.source END,
      push_status = excluded.push_status,
      lyrics_status = CASE WHEN excluded.lyrics_status != '' THEN excluded.lyrics_status ELSE release_history.lyrics_status END,
      published_at = CASE
        WHEN release_history.published_at IS NULL OR release_history.published_at = '' THEN excluded.published_at
        ELSE release_history.published_at
      END,
      updated_at = datetime('now'),
      details_json = excluded.details_json
  `).bind(
    videoId,
    title,
    url,
    cleanPlainText(entry.source || '', 100),
    cleanPlainText(entry.pushStatus || 'unknown', 30),
    cleanPlainText(entry.lyricsStatus || 'missing', 30),
    cleanPlainText(entry.publishedAt || '', 50),
    detailsJson
  ).run();
}

async function backfillReleaseHistory(db) {
  await Promise.all([ensurePushAutomationSchema(db), ensureLyricsV2Schema(db), ensureControlV1Schema(db)]);
  const result = await db.prepare(`
    SELECT video_id AS videoId, video_title AS videoTitle, title, url, source, status, created_at AS createdAt
    FROM push_history
    WHERE type IN ('auto-release', 'auto-release-retry', 'release-publish') AND video_id IS NOT NULL AND video_id != ''
    ORDER BY created_at ASC
    LIMIT 1000
  `).all();
  const rows = result.results || [];
  if (!rows.length) return;
  const statements = rows.map(row => db.prepare(`
    INSERT INTO release_history (
      video_id, title, url, source, push_status, lyrics_status,
      published_at, updated_at, details_json
    ) VALUES (?, ?, ?, ?, ?,
      CASE WHEN EXISTS(SELECT 1 FROM lyrics WHERE video_id = ?) THEN 'saved' ELSE 'missing' END,
      ?, datetime('now'), '{}')
    ON CONFLICT(video_id) DO UPDATE SET
      title = excluded.title,
      url = excluded.url,
      source = CASE WHEN excluded.source != '' THEN excluded.source ELSE release_history.source END,
      push_status = CASE WHEN release_history.push_status = 'sent' THEN release_history.push_status ELSE excluded.push_status END,
      lyrics_status = CASE WHEN excluded.lyrics_status != 'missing' THEN excluded.lyrics_status ELSE release_history.lyrics_status END,
      updated_at = datetime('now')
  `).bind(
    row.videoId,
    normalizeReleaseTitle(row.videoTitle || row.title),
    row.url || `https://www.youtube.com/watch?v=${encodeURIComponent(row.videoId)}`,
    cleanPlainText(row.source || 'История уведомлений', 100),
    cleanPlainText(row.status || 'unknown', 30),
    row.videoId,
    cleanPlainText(row.createdAt || '', 50)
  ));
  for (let i = 0; i < statements.length; i += 80) await db.batch(statements.slice(i, i + 80));
}

async function setPushState(db, key, value) {
  await db.prepare(`
    INSERT INTO push_state (key, value, updated_at)
    VALUES (?, ?, datetime('now'))
    ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = datetime('now')
  `).bind(key, String(value ?? '')).run();
}

async function getPushState(db, key) {
  const row = await db.prepare(`SELECT value, updated_at AS updatedAt FROM push_state WHERE key = ? LIMIT 1`).bind(key).first();
  return row || null;
}

function russianLikeWord(value) {
  const count = Math.max(0, Math.trunc(Number(value || 0)));
  const mod100 = count % 100;
  const mod10 = count % 10;
  if (mod100 >= 11 && mod100 <= 14) return 'лайков';
  if (mod10 === 1) return 'лайк';
  if (mod10 >= 2 && mod10 <= 4) return 'лайка';
  return 'лайков';
}

async function resolveYoutubeLikeBurst(db, item, startedAt) {
  const videoId = cleanPlainText(item?.videoId || '', 80);
  const currentLikes = Math.max(0, Number(item?.likes || 0));
  const previousLikes = Math.max(0, Number(item?.before || 0));
  const nowMs = Date.parse(startedAt || '') || Date.now();
  const stateKey = `youtube-like-burst-v54-97:${videoId}`;
  const row = await getPushState(db, stateKey);
  let state = null;
  try { state = row?.value ? JSON.parse(row.value) : null; } catch (_) { state = null; }
  const lastChangeMs = Date.parse(state?.lastChangeAt || '');
  const withinBurst = Boolean(
    state
    && Number.isFinite(lastChangeMs)
    && nowMs - lastChangeMs <= 90 * 60 * 1000
    && Number(state.baselineLikes) >= 0
    && Number(state.baselineLikes) <= previousLikes
    && Number(state.lastLikes) <= currentLikes
  );
  const baselineLikes = withinBurst ? Number(state.baselineLikes) : previousLikes;
  const cumulativeDelta = Math.max(1, currentLikes - baselineLikes);
  const nextState = {
    videoId,
    baselineLikes,
    lastLikes: currentLikes,
    cumulativeDelta,
    startedAt: withinBurst ? (state.startedAt || startedAt) : startedAt,
    lastChangeAt: startedAt
  };
  await setPushState(db, stateKey, JSON.stringify(nextState));
  return { ...nextState, previousState:state };
}


function youtubeLikeGlowTheme(deltaValue) {
  const delta = Math.max(1, Math.trunc(Number(deltaValue || 1)));
  if (delta >= 7) return {
    level: 'green', primary: '#3fff89', secondary: '#00d968', glowOpacity: 0.95,
    icon: 'https://andrikmetal.com/assets/andrik-like-glow-green-192.png?v=54.98'
  };
  if (delta >= 4) return {
    level: 'lime', primary: '#adff54', secondary: '#43e36f', glowOpacity: 0.88,
    icon: 'https://andrikmetal.com/assets/andrik-like-glow-lime-192.png?v=54.98'
  };
  if (delta >= 2) return {
    level: 'gold', primary: '#ffcc46', secondary: '#ff8f24', glowOpacity: 0.82,
    icon: 'https://andrikmetal.com/assets/andrik-like-glow-gold-192.png?v=54.98'
  };
  return {
    level: 'yellow', primary: '#ffd64a', secondary: '#ffb000', glowOpacity: 0.76,
    icon: 'https://andrikmetal.com/assets/andrik-like-glow-yellow-192.png?v=54.98'
  };
}

function youtubeLikeGlowImageUrl(videoId, cumulativeDelta) {
  const safeVideoId = cleanPlainText(videoId || '', 32);
  const safeDelta = Math.max(1, Math.min(9999, Math.trunc(Number(cumulativeDelta || 1))));
  return `https://andrikmetal.com/api/public/youtube-like-glow?videoId=${encodeURIComponent(safeVideoId)}&delta=${safeDelta}&v=54.98`;
}

function arrayBufferToBase64(buffer) {
  const bytes = new Uint8Array(buffer);
  let binary = '';
  const chunkSize = 0x8000;
  for (let offset = 0; offset < bytes.length; offset += chunkSize) {
    binary += String.fromCharCode(...bytes.subarray(offset, Math.min(bytes.length, offset + chunkSize)));
  }
  return btoa(binary);
}

async function handlePublicYoutubeLikeGlow(request) {
  const url = new URL(request.url);
  const videoId = cleanPlainText(url.searchParams.get('videoId') || '', 32);
  const delta = Math.max(1, Math.min(9999, Math.trunc(Number(url.searchParams.get('delta') || 1))));
  if (!/^[A-Za-z0-9_-]{6,24}$/.test(videoId)) {
    return new Response('invalid-video-id', { status: 400, headers: { 'content-type':'text/plain; charset=utf-8', 'cache-control':'no-store' } });
  }
  const theme = youtubeLikeGlowTheme(delta);
  let embeddedImage = '';
  try {
    const thumbnailUrl = `https://i.ytimg.com/vi/${encodeURIComponent(videoId)}/hqdefault.jpg`;
    const response = await fetch(thumbnailUrl, { cf: { cacheEverything: true, cacheTtl: 86400 } });
    const contentType = cleanPlainText(response.headers.get('content-type') || 'image/jpeg', 80);
    if (response.ok && contentType.startsWith('image/')) {
      const buffer = await response.arrayBuffer();
      if (buffer.byteLength > 0 && buffer.byteLength <= 900000) {
        embeddedImage = `data:${contentType};base64,${arrayBufferToBase64(buffer)}`;
      }
    }
  } catch (_) {}

  const imageMarkup = embeddedImage
    ? `<image href="${embeddedImage}" x="58" y="58" width="1084" height="512" preserveAspectRatio="xMidYMid slice" clip-path="url(#clip)"/>`
    : `<rect x="58" y="58" width="1084" height="512" rx="44" fill="#071018"/><text x="600" y="330" text-anchor="middle" fill="#eef9ff" font-size="74" font-weight="900" font-family="system-ui,Segoe UI,sans-serif">ANDRIK</text>`;

  const svg = `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="628" viewBox="0 0 1200 628">
  <defs>
    <clipPath id="clip"><rect x="58" y="58" width="1084" height="512" rx="44"/></clipPath>
    <radialGradient id="bg" cx="50%" cy="50%" r="72%">
      <stop offset="0" stop-color="${theme.primary}" stop-opacity="0.22"/>
      <stop offset="0.52" stop-color="${theme.secondary}" stop-opacity="0.10"/>
      <stop offset="1" stop-color="#020609" stop-opacity="1"/>
    </radialGradient>
    <linearGradient id="badge" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0" stop-color="${theme.primary}"/>
      <stop offset="1" stop-color="${theme.secondary}"/>
    </linearGradient>
    <filter id="glow" x="-30%" y="-30%" width="160%" height="160%">
      <feGaussianBlur stdDeviation="23" result="blur"/>
      <feMerge><feMergeNode in="blur"/><feMergeNode in="SourceGraphic"/></feMerge>
    </filter>
  </defs>
  <rect width="1200" height="628" rx="52" fill="#020609"/>
  <rect width="1200" height="628" rx="52" fill="url(#bg)"/>
  <rect x="47" y="47" width="1106" height="534" rx="55" fill="none" stroke="${theme.primary}" stroke-width="20" opacity="${theme.glowOpacity}" filter="url(#glow)"/>
  ${imageMarkup}
  <rect x="58" y="58" width="1084" height="512" rx="44" fill="none" stroke="${theme.primary}" stroke-width="8" opacity="0.96"/>
  <rect x="935" y="82" width="170" height="86" rx="43" fill="url(#badge)" filter="url(#glow)"/>
  <text x="1020" y="140" text-anchor="middle" fill="#041008" font-size="46" font-weight="1000" font-family="system-ui,Segoe UI,sans-serif">+${delta}</text>
</svg>`;

  return new Response(svg, {
    headers: {
      'content-type':'image/svg+xml; charset=utf-8',
      'cache-control':'public, max-age=86400, s-maxage=86400, immutable',
      'access-control-allow-origin':'*',
      'x-content-type-options':'nosniff'
    }
  });
}

async function recordPushHistory(env, entry = {}) {
  if (!env.COMMENTS_DB) return;
  const db = env.COMMENTS_DB;
  await ensurePushAutomationSchema(db);
  const safeDetails = (() => {
    try { return JSON.stringify(entry.details || {}); }
    catch (_) { return '{}'; }
  })();
  await db.prepare(`
    INSERT INTO push_history (
      id, type, source, audience, status, title, message, url,
      video_id, video_title, onesignal_id, recipients, error, details_json, created_at
    )
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now'))
  `).bind(
    cleanPlainText(entry.id || crypto.randomUUID(), 80),
    cleanPlainText(entry.type || 'system', 40),
    cleanPlainText(entry.source || '', 80),
    cleanPlainText(entry.audience || 'all', 24),
    cleanPlainText(entry.status || 'sent', 24),
    cleanPlainText(entry.title || '', 120),
    cleanPlainText(entry.message || '', 500),
    cleanPlainText(entry.url || '', 700),
    cleanPlainText(entry.videoId || '', 80),
    cleanPlainText(entry.videoTitle || '', 220),
    cleanPlainText(entry.oneSignalId || '', 120),
    Math.max(0, Number(entry.recipients || 0)),
    cleanPlainText(entry.error || '', 700),
    safeDetails
  ).run();
}


async function recordSystemLog(env, entry = {}) {
  if (!env.COMMENTS_DB) return;
  const db = env.COMMENTS_DB;
  await ensurePushAutomationSchema(db);
  const safeDetails = (() => {
    try { return JSON.stringify(entry.details || {}); }
    catch (_) { return '{}'; }
  })();
  await db.prepare(`
    INSERT INTO system_logs (id, scope, level, event, message, details_json, created_at)
    VALUES (?, ?, ?, ?, ?, ?, datetime('now'))
  `).bind(
    cleanPlainText(entry.id || crypto.randomUUID(), 80),
    cleanPlainText(entry.scope || 'system', 40),
    cleanPlainText(entry.level || 'info', 20),
    cleanPlainText(entry.event || '', 80),
    cleanPlainText(entry.message || '', 700),
    safeDetails
  ).run();
  // Keep the diagnostics compact while preserving several weeks of normal activity.
  await db.prepare(`
    DELETE FROM system_logs
    WHERE id IN (
      SELECT id FROM system_logs ORDER BY created_at DESC LIMIT -1 OFFSET 600
    )
  `).run().catch(() => {});
}

async function cacheLatestYoutubeItem(db, item, meta = {}) {
  if (!item?.videoId) return;
  await setPushState(db, 'youtube-latest-public', JSON.stringify({
    videoId: cleanPlainText(item.videoId, 80),
    title: normalizeReleaseTitle(item.title),
    publishedAt: cleanPlainText(item.publishedAt || '', 80),
    thumbnail: cleanPlainText(item.thumbnail || '', 700),
    source: cleanPlainText(item.source || meta.source || 'YouTube', 120),
    url: `https://www.youtube.com/watch?v=${encodeURIComponent(item.videoId)}`,
    mode: cleanPlainText(meta.mode || '', 40),
    updatedAt: new Date().toISOString()
  }));
}

async function fetchOneSignalMessageReport(env, messageId) {
  const id = cleanPlainText(messageId, 120);
  if (!oneSignalConfigured(env) || !id) return { ok: false, error: 'message-report-unavailable' };
  const url = new URL(`https://api.onesignal.com/notifications/${encodeURIComponent(id)}`);
  url.searchParams.set('app_id', String(env.ONESIGNAL_APP_ID));
  const response = await fetch(url.toString(), {
    headers: { accept: 'application/json', authorization: `Key ${getOneSignalApiKey(env)}` }
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) return { ok: false, status: response.status, error: data?.errors || data?.error || 'message-report-error' };
  return {
    ok: true,
    id,
    successful: Math.max(0, Number(data?.successful || 0)),
    received: Math.max(0, Number(data?.received || 0)),
    failed: Math.max(0, Number(data?.failed || 0)),
    errored: Math.max(0, Number(data?.errored || 0)),
    remaining: data?.remaining == null ? null : Math.max(0, Number(data.remaining || 0)),
    completedAt: data?.completed_at || null,
    platformDeliveryStats: data?.platform_delivery_stats || {},
    includedSegments: data?.included_segments || []
  };
}

function normalizeReleaseTitle(value) {
  return cleanPlainText(value, 180)
    .replace(/\s*[-–—|]\s*(official\s+audio|official\s+video|официальное\s+аудио|официальный\s+клип)\s*$/i, '')
    .replace(/\s*\((official\s+audio|official\s+video|официальное\s+аудио|официальный\s+клип)\)\s*$/i, '')
    .trim() || 'Новый трек';
}

function compactReleasePushTitle(value) {
  const normalized = normalizeReleaseTitle(value)
    .replace(/^ANDRIK\s*[-–—|]\s*/i, '')
    .replace(/\s*[-–—|]\s*(English\s+Version|Russian\s+Version|Українська\s+версія|Slovenská\s+verzia)\s*$/i, '')
    .trim();
  return cleanPlainText(normalized || 'Новый трек', 72);
}

function compactYoutubePushTitle(value, fallback = 'ANDRIK') {
  const normalized = compactReleasePushTitle(value)
    .replace(/^ANDRIK\s*[-–—|]\s*/i, '')
    .trim();
  return cleanPlainText(normalized || fallback, 72);
}

function getOneSignalApiKey(env) {
  return String(env.ONESIGNAL_APP_API_KEY || env.ONESIGNAL_REST_API_KEY || '');
}

function oneSignalConfigured(env) {
  return Boolean(env.ONESIGNAL_APP_ID && getOneSignalApiKey(env));
}

async function upsertPushSubscriber(db, {
  subscriptionId,
  active = true,
  source = 'site',
  label = '',
  country = '',
  region = '',
  city = '',
  latitude = null,
  longitude = null
}) {
  const id = cleanPlainText(subscriptionId, 80);
  if (!/^[0-9a-f-]{30,80}$/i.test(id)) throw new Error('validation');
  await ensurePushAutomationSchema(db);
  const previous = await db.prepare(`SELECT status, source FROM push_subscribers WHERE subscription_id = ? LIMIT 1`).bind(id).first();
  const safeCountry = cleanPlainText(country, 8).toUpperCase();
  const safeRegion = cleanPlainText(region, 120);
  const safeCity = cleanPlainText(city, 120);
  const latNumber = latitude === null || latitude === '' || latitude === undefined ? NaN : Number(latitude);
  const lonNumber = longitude === null || longitude === '' || longitude === undefined ? NaN : Number(longitude);
  const safeLatitude = Number.isFinite(latNumber) ? Math.round(latNumber * 10) / 10 : null;
  const safeLongitude = Number.isFinite(lonNumber) ? Math.round(lonNumber * 10) / 10 : null;
  await db.prepare(`
    INSERT INTO push_subscribers (
      subscription_id, status, source, label, country, region, city, latitude, longitude, created_at, updated_at, last_seen_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now'), datetime('now'), datetime('now'))
    ON CONFLICT(subscription_id) DO UPDATE SET
      status = excluded.status,
      source = CASE WHEN push_subscribers.source = 'owner' THEN 'owner' ELSE excluded.source END,
      label = CASE WHEN excluded.label <> '' THEN excluded.label ELSE push_subscribers.label END,
      country = CASE WHEN excluded.country <> '' THEN excluded.country ELSE push_subscribers.country END,
      region = CASE WHEN excluded.region <> '' THEN excluded.region ELSE push_subscribers.region END,
      city = CASE WHEN excluded.city <> '' THEN excluded.city ELSE push_subscribers.city END,
      latitude = COALESCE(excluded.latitude, push_subscribers.latitude),
      longitude = COALESCE(excluded.longitude, push_subscribers.longitude),
      updated_at = datetime('now'),
      last_seen_at = datetime('now')
  `).bind(
    id,
    active ? 'active' : 'inactive',
    cleanPlainText(source, 40) || 'site',
    cleanPlainText(label, 120),
    safeCountry, safeRegion, safeCity, safeLatitude, safeLongitude
  ).run();
  return {
    id,
    isNew: !previous,
    reactivated: Boolean(previous && previous.status !== 'active' && active),
    wasOwner: previous?.source === 'owner'
  };
}

async function getBroadcastSubscriptionIds(env) {
  if (!env.COMMENTS_DB) return [];
  const db = env.COMMENTS_DB;
  await ensurePushAutomationSchema(db);
  const result = await db.prepare(`
    SELECT subscription_id FROM (
      SELECT subscription_id FROM push_subscribers WHERE status = 'active'
      UNION
      SELECT subscription_id FROM push_admin_devices
    )
    WHERE subscription_id <> ''
    LIMIT 20000
  `).all();
  return [...new Set((result.results || []).map(row => row.subscription_id).filter(Boolean))];
}

async function getPushAudienceCounts(env) {
  if (!env.COMMENTS_DB) return { public: 0, owners: 0, total: 0 };
  const db = env.COMMENTS_DB;
  await ensurePushAutomationSchema(db);
  const [publicRow, ownerRow, totalRow] = await Promise.all([
    db.prepare(`SELECT COUNT(*) AS total FROM push_subscribers WHERE status = 'active' AND source <> 'owner'`).first(),
    db.prepare(`SELECT COUNT(*) AS total FROM push_admin_devices`).first(),
    db.prepare(`
      SELECT COUNT(*) AS total FROM (
        SELECT subscription_id FROM push_subscribers WHERE status = 'active'
        UNION
        SELECT subscription_id FROM push_admin_devices
      )
    `).first()
  ]);
  return {
    public: Number(publicRow?.total || 0),
    owners: Number(ownerRow?.total || 0),
    total: Number(totalRow?.total || 0)
  };
}

function pushTopicToken(value, fallback = 'andrik-event') {
  const token = String(value || fallback)
    .toLowerCase()
    .replace(/[^a-z0-9_-]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 64);
  return token || fallback;
}

// R187: every owner event uses one universal replacement stack. This keeps
// exactly one ANDRIK eye in Android's status bar while preserving the latest
// event and an accumulated +N counter inside the notification itself.
function ownerPushPresentation(history = null, name = '') {
  const type = cleanPlainText(history?.type || '', 80).toLowerCase();
  return {
    androidGroup: 'andrik-single-eye',
    threadId: 'andrik-single-eye',
    collapseId: 'andrik-single-eye',
    webPushTopic: 'andrik-single-eye',
    ttl: type === 'daily-summary' ? 86400 : 43200
  };
}

function ownerPushStackLabel(count) {
  const n = Math.max(1, Number(count || 1));
  const n10 = n % 10, n100 = n % 100;
  const word = n10 === 1 && n100 !== 11 ? 'событие' : (n10 >= 2 && n10 <= 4 && (n100 < 12 || n100 > 14) ? 'события' : 'событий');
  return `👁 ANDRIK · +${n} ${word}`;
}

async function nextOwnerPushStack(env, history = null) {
  const type = cleanPlainText(history?.type || '', 80).toLowerCase();
  if (!env.COMMENTS_DB) return { enabled:true, count:1, windowMinutes:30, key:'andrik-single-eye' };
  const db = env.COMMENTS_DB;
  await ensurePushAutomationSchema(db);
  const stateKey = 'owner-push-stack-r187';
  const now = Date.now();
  const windowMs = 30 * 60 * 1000;
  let previous = {};
  try {
    const row = await getPushState(db, stateKey);
    previous = JSON.parse(row?.value || '{}');
  } catch (_) { previous = {}; }
  const lastAtMs = Date.parse(previous?.lastAt || '');
  const withinWindow = Number.isFinite(lastAtMs) && now - lastAtMs >= 0 && now - lastAtMs <= windowMs;
  const count = withinWindow ? Math.min(99, Math.max(1, Number(previous?.count || 0)) + 1) : 1;
  const value = { count, lastAt:new Date(now).toISOString(), firstAt:withinWindow ? (previous?.firstAt || previous?.lastAt || new Date(now).toISOString()) : new Date(now).toISOString(), lastType:type };
  await setPushState(db, stateKey, JSON.stringify(value));
  return { enabled:true, count, windowMinutes:30, key:'andrik-single-eye' };
}

async function sendOneSignalPush(env, {
  title,
  message,
  url,
  image = '',
  icon = '',
  audience = 'all',
  subscriptionIds = [],
  name = '',
  webButtons = [],
  history = null,
  androidGroup = '',
  threadId = '',
  collapseId = '',
  webPushTopic = '',
  ttl = null,
  data = null
}) {
  if (!oneSignalConfigured(env)) {
    if (history) {
      await recordPushHistory(env, {
        ...history,
        audience,
        status: 'skipped',
        title,
        message,
        url,
        error: 'push-not-configured'
      }).catch(() => {});
    }
    return { ok: false, skipped: true, error: 'push-not-configured' };
  }
  const presentation = audience === 'owner' ? ownerPushPresentation(history, name) : {};
  const ownerStack = audience === 'owner' ? await nextOwnerPushStack(env, history) : { enabled:false, count:1 };
  const stackCount = Math.max(1, Number(ownerStack?.count || 1));
  const displayTitle = ownerStack.enabled && stackCount > 1 ? ownerPushStackLabel(stackCount) : title;
  const displayMessage = ownerStack.enabled && stackCount > 1
    ? `Последнее: ${cleanPlainText(title, 120)}\n${cleanPlainText(message, 260)}`
    : message;
  // For the owner feed the universal stack wins over event-specific topics.
  // This keeps one eye icon in the Android status bar instead of one icon per event.
  const resolvedAndroidGroup = cleanPlainText(ownerStack.enabled ? presentation.androidGroup : (androidGroup || presentation.androidGroup || ''), 64);
  const resolvedThreadId = cleanPlainText(ownerStack.enabled ? presentation.threadId : (threadId || presentation.threadId || ''), 64);
  const resolvedCollapseId = cleanPlainText(ownerStack.enabled ? presentation.collapseId : (collapseId || presentation.collapseId || ''), 64);
  const resolvedWebPushTopic = cleanPlainText(ownerStack.enabled ? presentation.webPushTopic : (webPushTopic || presentation.webPushTopic || ''), 64);
  const resolvedTtl = Number.isFinite(Number(ttl ?? presentation.ttl)) ? Math.max(0, Math.min(2419200, Number(ttl ?? presentation.ttl))) : null;
  const notificationIcon = cleanPlainText(icon || 'https://andrikmetal.com/assets/andrik-eye-v22-192.png', 700);
  const payload = {
    app_id: String(env.ONESIGNAL_APP_ID),
    headings: { en: displayTitle, ru: displayTitle },
    contents: { en: displayMessage, ru: displayMessage },
    target_channel: 'push',
    name: cleanPlainText(name || title, 128),
    web_url: url || 'https://andrikmetal.com/',
    chrome_web_icon: notificationIcon,
    firefox_icon: notificationIcon,
    chrome_web_badge: 'https://andrikmetal.com/assets/andrik-eye-notification-badge-192.png',
    large_icon: notificationIcon,
    huawei_large_icon: notificationIcon,
    adm_large_icon: notificationIcon,
    idempotency_key: await stablePushUuid(`${audience}|${name || title}|${history?.type || ''}|${history?.source || ''}`)
  };
  if (resolvedAndroidGroup) payload.android_group = resolvedAndroidGroup;
  if (resolvedThreadId) payload.thread_id = resolvedThreadId;
  if (resolvedCollapseId) payload.collapse_id = resolvedCollapseId;
  if (resolvedWebPushTopic) payload.web_push_topic = resolvedWebPushTopic;
  if (resolvedTtl !== null) payload.ttl = resolvedTtl;
  const historyType = cleanPlainText(history?.type || '', 80);
  const historySource = cleanPlainText(history?.source || '', 120);
  const extraData = data && typeof data === 'object' && !Array.isArray(data) ? data : {};
  if (historyType || historySource || Object.keys(extraData).length || ownerStack.enabled) {
    payload.data = {
      ...extraData,
      ...(historyType ? { andrikType: historyType } : {}),
      ...(historySource ? { andrikSource: historySource } : {}),
      ...(ownerStack.enabled ? {
        andrikGroupKey: ownerStack.key || 'andrik-single-eye',
        andrikGroupCount: stackCount,
        andrikGroupWindowMinutes: Number(ownerStack.windowMinutes || 30),
        andrikOriginalTitle: cleanPlainText(title, 180),
        andrikOriginalMessage: cleanPlainText(message, 500)
      } : {}),
      andrikUrl: url || 'https://andrikmetal.com/'
    };
  }
  if (image) payload.chrome_web_image = image;
  if (Array.isArray(webButtons) && webButtons.length) {
    payload.web_buttons = webButtons.slice(0, 2).map((button, index) => ({
      id: cleanPlainText(button?.id || `action-${index + 1}`, 40),
      text: cleanPlainText(button?.text || 'Открыть', 40),
      url: cleanPlainText(button?.url || url || 'https://andrikmetal.com/', 700),
      ...(button?.icon ? { icon: cleanPlainText(button.icon, 700) } : {})
    }));
  }
  if (audience === 'owner') {
    const ids = [...new Set(subscriptionIds.filter(Boolean))].slice(0, 20000);
    if (!ids.length) {
      if (history) {
        await recordPushHistory(env, {
          ...history,
          audience,
          status: 'skipped',
          title,
          message,
          url,
          error: 'owner-device-not-registered'
        }).catch(() => {});
      }
      return { ok: false, skipped: true, error: 'owner-device-not-registered' };
    }
    payload.include_subscription_ids = ids;
  } else {
    const ids = [...new Set(subscriptionIds.filter(Boolean))].slice(0, 20000);
    const registeredIds = ids.length ? ids : await getBroadcastSubscriptionIds(env);
    if (registeredIds.length) {
      payload.include_subscription_ids = registeredIds;
    } else {
      // Compatibility fallback for legacy OneSignal installations. New ANDRIK
      // subscriptions are registered in D1 and normally use explicit ids.
      payload.included_segments = ['Subscribed Users'];
    }
  }
  let response = null;
  let oneSignalFetchError = null;
  for (let attempt = 0; attempt < 2 && !response; attempt += 1) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort('onesignal-timeout'), 12000);
    try {
      response = await fetch('https://api.onesignal.com/notifications?c=push', {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          authorization: `Key ${getOneSignalApiKey(env)}`
        },
        body: JSON.stringify(payload),
        signal: controller.signal
      });
    } catch (error) {
      oneSignalFetchError = error;
      if (attempt === 0) await new Promise(resolve => setTimeout(resolve, 650));
    } finally {
      clearTimeout(timer);
    }
  }
  if (!response) {
    const errorCode = oneSignalFetchError?.name === 'AbortError' ? 'onesignal-timeout' : 'onesignal-network-error';
    const errorMessage = cleanPlainText(oneSignalFetchError?.message || errorCode, 500);
    if (history) {
      await recordPushHistory(env, {
        ...history,
        audience,
        status:'failed',
        title,
        message,
        url,
        error:errorCode,
        details:{ ...(history?.details && typeof history.details === 'object' ? history.details : {}), errorMessage }
      }).catch(() => {});
    }
    await recordSystemLog(env, {
      scope:'push', level:'error', event:errorCode,
      message:`OneSignal не ответил: ${errorMessage}`,
      details:{ audience, title, url, errorMessage }
    }).catch(() => {});
    return { ok:false, error:errorCode, message:errorMessage };
  }
  const responseData = await response.json().catch(() => ({}));
  if (!response.ok) {
    console.error('OneSignal push failed', response.status, responseData);
    const errorText = JSON.stringify(responseData?.errors || responseData || 'onesignal-error');
    if (history) {
      await recordPushHistory(env, {
        ...history,
        audience,
        status: 'failed',
        title,
        message,
        url,
        error: errorText,
        details: { ...(history?.details && typeof history.details === 'object' ? history.details : {}), httpStatus: response.status, response: responseData }
      }).catch(() => {});
    }
    await recordSystemLog(env, {
      scope: 'push', level: 'error', event: 'onesignal-http-error',
      message: `OneSignal отклонил запрос: HTTP ${response.status}`,
      details: { audience, httpStatus: response.status, response: responseData, title, url }
    }).catch(() => {});
    return { ok: false, status: response.status, error: responseData?.errors || 'onesignal-error', data: responseData };
  }
  const oneSignalId = cleanPlainText(responseData?.id || responseData?.external_id || '', 120);
  // OneSignal returns HTTP 200 with an empty id when the request is valid,
  // but no active subscription matches the selected audience. Such a result
  // must not mark a YouTube video as already notified.
  if (!oneSignalId) {
    const errorCode = 'no-subscribers-matched';
    if (history) {
      await recordPushHistory(env, {
        ...history,
        audience,
        status: 'failed',
        title,
        message,
        url,
        error: errorCode,
        details: { ...(history?.details && typeof history.details === 'object' ? history.details : {}), httpStatus: response.status, response: responseData }
      }).catch(() => {});
    }
    await recordSystemLog(env, {
      scope: 'push', level: 'error', event: errorCode,
      message: 'OneSignal принял запрос, но не нашёл активных подписчиков. Видео не помечено как уведомлённое.',
      details: { audience, response: responseData, title, url }
    }).catch(() => {});
    return { ok: false, skipped: false, status: response.status, error: errorCode, data: responseData };
  }
  const result = {
    ok: true,
    data: responseData,
    recipients: Math.max(0, Number(responseData?.recipients || 0)),
    oneSignalId
  };
  if (history) {
    await recordPushHistory(env, {
      ...history,
      audience,
      status: 'sent',
      title,
      message,
      url,
      recipients: result.recipients,
      oneSignalId: result.oneSignalId,
      details: { ...(history?.details && typeof history.details === 'object' ? history.details : {}), warnings: responseData?.warnings || null, response: responseData, acceptedByOneSignal: true }
    }).catch(() => {});
  }
  await recordSystemLog(env, {
    scope: 'push', level: 'info', event: 'onesignal-accepted',
    message: `OneSignal принял уведомление ${oneSignalId}`,
    details: { audience, oneSignalId, response: responseData, title, url }
  }).catch(() => {});
  return result;
}

async function getOwnerSubscriptionIds(env) {
  if (!env.COMMENTS_DB) return [];
  const result = await env.COMMENTS_DB.prepare('SELECT subscription_id FROM push_admin_devices ORDER BY updated_at DESC LIMIT 20').all();
  return (result.results || []).map(row => row.subscription_id).filter(Boolean);
}

async function sendOwnerPush(env, payload) {
  const ids = await getOwnerSubscriptionIds(env);
  return sendOneSignalPush(env, { ...payload, audience: 'owner', subscriptionIds: ids });
}

function cronAuthorized(request, env) {
  const expected = String(env.CRON_SECRET || '');
  if (!expected) return false;
  const supplied = request.headers.get('x-cron-key') || '';
  return supplied.length === expected.length && supplied === expected;
}

function requireDb(env) {
  if (!env.COMMENTS_DB) throw new Error('COMMENTS_DB binding is missing');
  return env.COMMENTS_DB;
}

function configuredAdminKeys(env) {
  return [...new Set([
    String(env.ADMIN_KEY || '').trim(),
    String(env.COMMENTS_ADMIN_KEY || '').trim()
  ].filter(Boolean))];
}

function adminAuthorized(request, env) {
  const expectedKeys = configuredAdminKeys(env);
  if (!expectedKeys.length) return false;
  const auth = request.headers.get('authorization') || '';
  const supplied = (auth.startsWith('Bearer ') ? auth.slice(7).trim() : request.headers.get('x-admin-key') || '').trim();
  if (!supplied) return false;
  return expectedKeys.some(expected => supplied.length === expected.length && supplied === expected);
}

function readCookieValues(request, name) {
  const source = String(request.headers.get('cookie') || '');
  const values = [];
  for (const part of source.split(';')) {
    const item = part.trim();
    if (!item.startsWith(`${name}=`)) continue;
    try { values.push(decodeURIComponent(item.slice(name.length + 1))); }
    catch (_) { values.push(item.slice(name.length + 1)); }
  }
  return values.filter(Boolean);
}

function readCookieValue(request, name) {
  return readCookieValues(request, name)[0] || '';
}

function readOwnerSessionTokens(request) {
  const headerToken = String(request.headers.get(OWNER_SESSION_TOKEN_HEADER) || '').trim();
  return [
    ...readCookieValues(request, OWNER_SESSION_COOKIE),
    headerToken
  ].filter(Boolean);
}

function timingSafeTextEqual(left, right) {
  const a = String(left || '');
  const b = String(right || '');
  if (a.length !== b.length) return false;
  let difference = 0;
  for (let index = 0; index < a.length; index += 1) difference |= a.charCodeAt(index) ^ b.charCodeAt(index);
  return difference === 0;
}

async function hmacSha256Hex(secret, value) {
  const encoder = new TextEncoder();
  const key = await crypto.subtle.importKey(
    'raw', encoder.encode(String(secret || '')), { name:'HMAC', hash:'SHA-256' }, false, ['sign']
  );
  const signature = await crypto.subtle.sign('HMAC', key, encoder.encode(String(value || '')));
  return [...new Uint8Array(signature)].map(byte => byte.toString(16).padStart(2, '0')).join('');
}

function ownerSessionSecret(env) {
  return `${configuredAdminKeys(env).join('|')}|${String(env.CRON_SECRET || '')}|ANDRIK-OWNER-SESSION-R124`;
}

async function createOwnerSessionToken(env) {
  const expiresAt = Date.now() + 90 * 24 * 60 * 60 * 1000;
  const nonce = crypto.randomUUID().replace(/-/g, '');
  const payload = `${expiresAt}.${nonce}`;
  const signature = await hmacSha256Hex(ownerSessionSecret(env), payload);
  return { token:`${payload}.${signature}`, expiresAt };
}

async function verifyOwnerSessionToken(token, env) {
  const parts = String(token || '').split('.');
  if (parts.length !== 3 || !configuredAdminKeys(env).length) return false;
  const [expiresRaw, nonce, suppliedSignature] = parts;
  const expiresAt = Number(expiresRaw || 0);
  if (!Number.isFinite(expiresAt) || expiresAt <= Date.now() || expiresAt > Date.now() + 92 * 24 * 60 * 60 * 1000) return false;
  if (!/^[a-f0-9]{20,80}$/i.test(nonce)) return false;
  const expectedSignature = await hmacSha256Hex(ownerSessionSecret(env), `${expiresRaw}.${nonce}`);
  return timingSafeTextEqual(suppliedSignature, expectedSignature);
}

function ownerSessionCookie(name, token, maxAge = 7776000, domain = '') {
  const domainPart = domain ? `; Domain=${domain}` : '';
  const expiresPart = Number(maxAge) > 0 ? '' : '; Expires=Thu, 01 Jan 1970 00:00:00 GMT';
  return `${name}=${encodeURIComponent(token)}; Path=/; Max-Age=${maxAge}${expiresPart}; HttpOnly; Secure; SameSite=Lax; Priority=High${domainPart}`;
}

function ownerSessionJson(_request, data, status, token, maxAge) {
  const headers = new Headers(JSON_HEADERS);
  headers.set('vary', 'Cookie');
  // R197 compatibility fix: emit exactly one host-only Set-Cookie header.
  // Some Android PWA/WebView builds drop cookie responses containing several
  // deletion and creation headers at once.
  headers.set('set-cookie', ownerSessionCookie(OWNER_SESSION_COOKIE, token, maxAge, ''));
  return new Response(JSON.stringify(data), { status, headers });
}

async function handleOwnerSessionCreate(request, env) {
  if (!isSameOrigin(request)) return json({ ok:false, error:'origin' }, 403);

  // A verified owner session may renew itself without spending the brute-force
  // bucket. Verify the signed credential here instead of trusting a client-set
  // marker header.
  let fromOwnerSession = false;
  for (const token of readOwnerSessionTokens(request)) {
    if (await verifyOwnerSessionToken(token, env).catch(() => false)) { fromOwnerSession = true; break; }
  }
  if (!fromOwnerSession && env.COMMENTS_DB) {
    try {
      const limit = await securityRateLimit(
        env.COMMENTS_DB, request, env,
        'owner-session-login-10m', 12, 600,
        'owner-session-rate-limit'
      );
      if (!limit.allowed) {
        return json({ ok:false, error:'rate-limit', retryAfter:600 }, 429, {
          ...JSON_HEADERS,
          'retry-after':'600'
        });
      }
    } catch (_) {
      // Login remains available if the protection database is temporarily down.
    }
  }

  if (!adminAuthorized(request, env)) {
    if (env.COMMENTS_DB) {
      recordSecurityEvent(
        env.COMMENTS_DB, request, env,
        'owner-login-failed',
        'Неверный ADMIN_KEY без сохранения значения ключа.'
      ).catch(() => {});
    }
    return json({ ok:false, error:'unauthorized' }, 401);
  }

  const session = await createOwnerSessionToken(env);
  return ownerSessionJson(request, {
    ok:true,
    owner:true,
    storage:'HttpOnly cookie + signed Android PWA fallback',
    sessionDays:90,
    expiresAt:new Date(session.expiresAt).toISOString(),
    compatToken:session.token
  }, 200, session.token, 7776000);
}

async function handleOwnerStatus(request, env) {
  const tokens = readOwnerSessionTokens(request);
  let owner = false;
  for (const token of tokens) {
    if (await verifyOwnerSessionToken(token, env).catch(() => false)) { owner = true; break; }
  }
  return json({ ok:true, owner, version:ANDRIK_CONTROL_RELEASE.short, storage:'HttpOnly cookie + signed Android PWA fallback', sessionDays:90 }, 200, {
    ...JSON_HEADERS,
    'vary':'Cookie'
  });
}

async function handleOwnerSessionDelete(request) {
  if (!isSameOrigin(request)) return json({ ok:false, error:'origin' }, 403);
  return ownerSessionJson(request, { ok:true, owner:false }, 200, '', 0);
}


async function handleControlEcosystemMap(request, env) {
  if (!adminAuthorized(request, env)) return json({ ok:false, error:'unauthorized' }, 401);
  const db = requireDb(env);
  await Promise.all([ensureSiteMetricsSchema(db), ensurePushAutomationSchema(db)]);
  const age = "-30 days";
  const [siteCountriesRaw, sitePointsRaw, musicCountriesRaw, musicPointsRaw, pushCountriesRaw, pushPointsRaw, linkRowsRaw, recentRaw] = await Promise.all([
    db.prepare(`
      SELECT country, COUNT(DISTINCT visitor_hash) AS value, COUNT(*) AS events
      FROM site_visit_events
      WHERE event_type='visit' AND country<>'' AND datetime(created_at)>=datetime('now', ?)
      GROUP BY country ORDER BY value DESC, events DESC LIMIT 120
    `).bind(age).all(),
    db.prepare(`
      SELECT country, MAX(region) AS region, MAX(city) AS city,
             ROUND(AVG(latitude),1) AS latitude, ROUND(AVG(longitude),1) AS longitude,
             COUNT(DISTINCT visitor_hash) AS value, COUNT(*) AS events, MAX(created_at) AS lastAt
      FROM site_visit_events
      WHERE event_type='visit' AND country<>'' AND latitude IS NOT NULL AND longitude IS NOT NULL
        AND datetime(created_at)>=datetime('now', ?)
      GROUP BY country, region, city, ROUND(latitude,1), ROUND(longitude,1)
      ORDER BY value DESC, events DESC LIMIT 180
    `).bind(age).all(),
    db.prepare(`
      SELECT country, COUNT(*) AS value,
             SUM(CASE WHEN event_type='music-download' THEN 1 ELSE 0 END) AS downloads,
             SUM(CASE WHEN event_type='music-listen' THEN 1 ELSE 0 END) AS listens
      FROM site_visit_events
      WHERE event_type IN ('music-download','music-listen') AND country<>'' AND datetime(created_at)>=datetime('now', ?)
      GROUP BY country ORDER BY value DESC LIMIT 120
    `).bind(age).all(),
    db.prepare(`
      SELECT country, MAX(region) AS region, MAX(city) AS city,
             ROUND(AVG(latitude),1) AS latitude, ROUND(AVG(longitude),1) AS longitude,
             COUNT(*) AS value,
             SUM(CASE WHEN event_type='music-download' THEN 1 ELSE 0 END) AS downloads,
             SUM(CASE WHEN event_type='music-listen' THEN 1 ELSE 0 END) AS listens,
             MAX(created_at) AS lastAt
      FROM site_visit_events
      WHERE event_type IN ('music-download','music-listen') AND country<>''
        AND latitude IS NOT NULL AND longitude IS NOT NULL AND datetime(created_at)>=datetime('now', ?)
      GROUP BY country, region, city, ROUND(latitude,1), ROUND(longitude,1)
      ORDER BY value DESC LIMIT 180
    `).bind(age).all(),
    db.prepare(`
      SELECT country, COUNT(*) AS value
      FROM push_subscribers
      WHERE status='active' AND source<>'owner' AND country<>''
      GROUP BY country ORDER BY value DESC LIMIT 120
    `).all(),
    db.prepare(`
      SELECT country, MAX(region) AS region, MAX(city) AS city,
             ROUND(AVG(latitude),1) AS latitude, ROUND(AVG(longitude),1) AS longitude,
             COUNT(*) AS value, MAX(last_seen_at) AS lastAt
      FROM push_subscribers
      WHERE status='active' AND source<>'owner' AND country<>'' AND latitude IS NOT NULL AND longitude IS NOT NULL
      GROUP BY country, region, city, ROUND(latitude,1), ROUND(longitude,1)
      ORDER BY value DESC LIMIT 180
    `).all(),
    db.prepare(`
      SELECT event_type AS type, COUNT(*) AS value
      FROM site_visit_events
      WHERE event_type IN ('telegram-open','youtube-open','spotify-open','apple-music-open','soundcloud-open','amazon-music-open')
        AND datetime(created_at)>=datetime('now', ?)
      GROUP BY event_type ORDER BY value DESC
    `).bind(age).all(),
    db.prepare(`
      SELECT event_type AS type, country, region, city, latitude, longitude, target, created_at AS createdAt
      FROM site_visit_events
      WHERE datetime(created_at)>=datetime('now','-60 minutes')
      ORDER BY datetime(created_at) DESC LIMIT 40
    `).all()
  ]);
  const [siteWeeklyRaw, sitePreviousWeeklyRaw, musicWeeklyRaw, musicPreviousWeeklyRaw, pushWeeklyRaw, pushPreviousWeeklyRaw] = await Promise.all([
    db.prepare(`
      SELECT country, COUNT(DISTINCT visitor_hash) AS value
      FROM site_visit_events
      WHERE event_type='visit' AND country<>'' AND datetime(created_at)>=datetime('now','-7 days')
      GROUP BY country ORDER BY value DESC LIMIT 120
    `).all(),
    db.prepare(`
      SELECT country, COUNT(DISTINCT visitor_hash) AS value
      FROM site_visit_events
      WHERE event_type='visit' AND country<>''
        AND datetime(created_at)>=datetime('now','-14 days') AND datetime(created_at)<datetime('now','-7 days')
      GROUP BY country ORDER BY value DESC LIMIT 120
    `).all(),
    db.prepare(`
      SELECT country, COUNT(*) AS value
      FROM site_visit_events
      WHERE event_type IN ('music-download','music-listen') AND country<>''
        AND datetime(created_at)>=datetime('now','-7 days')
      GROUP BY country ORDER BY value DESC LIMIT 120
    `).all(),
    db.prepare(`
      SELECT country, COUNT(*) AS value
      FROM site_visit_events
      WHERE event_type IN ('music-download','music-listen') AND country<>''
        AND datetime(created_at)>=datetime('now','-14 days') AND datetime(created_at)<datetime('now','-7 days')
      GROUP BY country ORDER BY value DESC LIMIT 120
    `).all(),
    db.prepare(`
      SELECT country, COUNT(*) AS value
      FROM push_subscribers
      WHERE status='active' AND source<>'owner' AND country<>'' AND datetime(created_at)>=datetime('now','-7 days')
      GROUP BY country ORDER BY value DESC LIMIT 120
    `).all(),
    db.prepare(`
      SELECT country, COUNT(*) AS value
      FROM push_subscribers
      WHERE status='active' AND source<>'owner' AND country<>''
        AND datetime(created_at)>=datetime('now','-14 days') AND datetime(created_at)<datetime('now','-7 days')
      GROUP BY country ORDER BY value DESC LIMIT 120
    `).all()
  ]);
  const normalizeWeekly = rows => (rows?.results || []).map(row => ({
    country: cleanPlainText(row.country || '', 8).toUpperCase(),
    value: Number(row.value || 0)
  })).filter(row => row.country && row.value >= 0);

  const normalizeCountries = rows => (rows?.results || []).map(row => ({
    country: cleanPlainText(row.country || '', 8).toUpperCase(),
    value: Number(row.value || 0),
    events: Number(row.events || 0),
    downloads: Number(row.downloads || 0),
    listens: Number(row.listens || 0)
  })).filter(row => row.country && row.value > 0);
  const normalizePoints = rows => (rows?.results || []).map(row => ({
    country: cleanPlainText(row.country || '', 8).toUpperCase(),
    region: cleanPlainText(row.region || '', 120),
    city: cleanPlainText(row.city || '', 120),
    latitude: Number(row.latitude),
    longitude: Number(row.longitude),
    value: Number(row.value || 0),
    events: Number(row.events || 0),
    downloads: Number(row.downloads || 0),
    listens: Number(row.listens || 0),
    lastAt: cleanPlainText(row.lastAt || '', 60)
  })).filter(row => row.country && Number.isFinite(row.latitude) && Number.isFinite(row.longitude));
  const links = {};
  for (const row of linkRowsRaw?.results || []) links[cleanPlainText(row.type || '', 40)] = Number(row.value || 0);
  const pushCounts = await getPushAudienceCounts(env);
  return json({
    ok:true,
    updatedAt:new Date().toISOString(),
    periodDays:30,
    privacy:{ rawIpStored:false, coordinatePrecision:'0.1-degree', adminOnly:true },
    site:{
      countries:normalizeCountries(siteCountriesRaw), points:normalizePoints(sitePointsRaw),
      weeklyCountries:normalizeWeekly(siteWeeklyRaw), previousWeekCountries:normalizeWeekly(sitePreviousWeeklyRaw)
    },
    music:{
      countries:normalizeCountries(musicCountriesRaw), points:normalizePoints(musicPointsRaw),
      weeklyCountries:normalizeWeekly(musicWeeklyRaw), previousWeekCountries:normalizeWeekly(musicPreviousWeeklyRaw)
    },
    push:{
      countries:normalizeCountries(pushCountriesRaw), points:normalizePoints(pushPointsRaw), counts:pushCounts,
      weeklyCountries:normalizeWeekly(pushWeeklyRaw), previousWeekCountries:normalizeWeekly(pushPreviousWeeklyRaw)
    },
    links,
    recent:(recentRaw?.results || []).map(row => ({
      type:cleanPlainText(row.type || '',40), country:cleanPlainText(row.country || '',8).toUpperCase(),
      region:cleanPlainText(row.region || '',120), city:cleanPlainText(row.city || '',120),
      latitude:row.latitude === null || row.latitude === undefined || row.latitude === '' ? null : Number(row.latitude),
      longitude:row.longitude === null || row.longitude === undefined || row.longitude === '' ? null : Number(row.longitude),
      target:cleanPlainText(row.target || '',300), createdAt:cleanPlainText(row.createdAt || '',60)
    }))
  });
}

async function handleControlAccess(request, env) {
  if (!adminAuthorized(request, env)) return json({ ok:false, error:'unauthorized' }, 401);
  return json({
    ok: true,
    access: 'owner',
    version: ANDRIK_CONTROL_RELEASE.full,
    adminKeyConfigured: Boolean(String(env.ADMIN_KEY || '').trim()),
    legacyCommentsKeyConfigured: Boolean(String(env.COMMENTS_ADMIN_KEY || '').trim()),
    acceptedKeyCount: configuredAdminKeys(env).length
  });
}

async function readJsonBody(request, maxBytes = 20000) {
  const length = Number(request.headers.get('content-length') || 0);
  if (length > maxBytes) throw new Error('payload-too-large');
  const text = await request.text();
  if (text.length > maxBytes) throw new Error('payload-too-large');
  return text ? JSON.parse(text) : {};
}


async function handlePushConfig(_request, env) {
  return json({
    enabled: Boolean(env.ONESIGNAL_APP_ID),
    appId: String(env.ONESIGNAL_APP_ID || ''),
    serviceWorkerPath: 'push/onesignal/OneSignalSDKWorker.js',
    serviceWorkerScope: '/push/onesignal/',
    siteOrigin: String(env.ONESIGNAL_SITE_ORIGIN || 'https://andrikmetal.com')
  }, 200, PUBLIC_CACHE_HEADERS);
}

async function handlePushSubscriber(request, env, ctx) {
  if (!isSameOrigin(request)) return json({ ok: false, error: 'origin' }, 403);
  const db = requireDb(env);
  let body;
  try { body = await readJsonBody(request, 5000); }
  catch (_) { return json({ ok: false, error: 'invalid-json' }, 400); }
  const subscriptionId = cleanPlainText(body.subscriptionId, 80);
  const active = body.active !== false;
  const requestedSource = cleanPlainText(body.source, 40) || 'site';
  const label = cleanPlainText(body.label, 120);
  if (!/^[0-9a-f-]{30,80}$/i.test(subscriptionId)) return json({ ok: false, error: 'validation' }, 400);
  const ownerAuthorized = adminAuthorized(request, env);
  const source = ownerAuthorized ? 'owner' : requestedSource;
  const cf = request.cf || {};
  const transition = await upsertPushSubscriber(db, {
    subscriptionId, active, source, label,
    country: cf.country || '',
    region: cf.region || cf.regionCode || '',
    city: cf.city || '',
    latitude: cf.latitude,
    longitude: cf.longitude
  });

  // When the owner renews the browser subscription after a Service Worker or
  // OneSignal change, bind the new subscription id automatically. This keeps
  // the 06:00 summary and admin alerts on the current phone instead of a stale id.
  if (ownerAuthorized && active) {
    await ensurePushAutomationSchema(db);
    if (label) {
      await db.prepare(`DELETE FROM push_admin_devices WHERE label = ? AND subscription_id <> ?`).bind(label, subscriptionId).run().catch(() => {});
    }
    await db.prepare(`
      INSERT INTO push_admin_devices (subscription_id, label, created_at, updated_at)
      VALUES (?, ?, datetime('now'), datetime('now'))
      ON CONFLICT(subscription_id) DO UPDATE SET label = excluded.label, updated_at = datetime('now')
    `).bind(subscriptionId, label || 'ANDRIK owner device').run();
  }

  const counts = await getPushAudienceCounts(env);
  if (active && ownerAuthorized && (transition.isNew || transition.reactivated)) {
    await recordPushHistory(env, {
      type:'owner-subscription', source:'andrikmetal.com', audience:'owner', status:'sent',
      title:'Подписка сайта обновлена', message:'Устройство владельца подписано на уведомления ANDRIK',
      url:'https://control.andrikmetal.com/', recipients:1,
      details:{ ownerRebound:true, subscriptionId }
    }).catch(() => {});
  } else if (active && source !== 'owner' && !transition.wasOwner && (transition.isNew || transition.reactivated)) {
    const siteSubscriberOnce = await claimPushOnce(db, `push-once:site-subscriber:${subscriptionId}`, new Date().toISOString());
    if (!siteSubscriberOnce) return json({ ok: true, subscriptionId, active, counts, transition, ownerBound:false, duplicatePushSuppressed:true });
    const summaryUrl = 'https://control.andrikmetal.com/control-home.html?page=summary';
    const ownerNotice = sendOwnerPush(env, {
      title: '👤 Новый подписчик сайта',
      message: `На уведомления ANDRIK подписался новый слушатель · всего ${counts.public}`,
      url: summaryUrl,
      name: `site-subscriber-${subscriptionId}`,
      webButtons: [{ id:'open-summary', text:'📊 За день', url:summaryUrl }],
      history: { type: 'site-subscriber', source: 'andrikmetal.com', audience: 'owner' }
    });
    if (ctx?.waitUntil) ctx.waitUntil(ownerNotice); else await ownerNotice;
  }
  return json({ ok: true, subscriptionId, active, counts, transition, ownerBound:ownerAuthorized && active });
}

async function handleAdminPushDevice(request, env) {
  if (!adminAuthorized(request, env)) return json({ ok: false, error: 'unauthorized' }, 401);
  const db = requireDb(env);
  let body;
  try { body = await readJsonBody(request); } catch (_) { return json({ ok: false, error: 'invalid-json' }, 400); }
  const subscriptionId = cleanPlainText(body.subscriptionId, 80);
  const label = cleanPlainText(body.label, 80) || 'ANDRIK owner device';
  if (!/^[0-9a-f-]{30,80}$/i.test(subscriptionId)) return json({ ok: false, error: 'validation' }, 400);
  await db.prepare(`
    INSERT INTO push_admin_devices (subscription_id, label, created_at, updated_at)
    VALUES (?, ?, datetime('now'), datetime('now'))
    ON CONFLICT(subscription_id) DO UPDATE SET label = excluded.label, updated_at = datetime('now')
  `).bind(subscriptionId, label).run();
  await upsertPushSubscriber(db, { subscriptionId, active: true, source: 'owner', label });
  const counts = await getPushAudienceCounts(env);
  return json({ ok: true, subscriptionId, counts });
}

async function handleAdminPushSend(request, env) {
  if (!adminAuthorized(request, env)) return json({ ok: false, error: 'unauthorized' }, 401);
  let body;
  try { body = await readJsonBody(request); } catch (_) { return json({ ok: false, error: 'invalid-json' }, 400); }
  const audience = body.audience === 'owner' ? 'owner' : 'all';
  const title = cleanPlainText(body.title, 80) || 'ANDRIK';
  const message = cleanPlainText(body.message, 240);
  const url = cleanPlainText(body.url, 500) || 'https://andrikmetal.com/';
  if (!message) return json({ ok: false, error: 'validation' }, 400);
  const historyType = audience === 'owner' ? 'owner-test' : 'manual-broadcast';
  const result = audience === 'owner'
    ? await sendOwnerPush(env, {
        title,
        message,
        url,
        name: `manual-owner-${Date.now()}`,
        history: { type: historyType, source: 'ANDRIK Control' }
      })
    : await sendOneSignalPush(env, {
        title,
        message,
        url,
        audience: 'all',
        name: `manual-all-${Date.now()}`,
        history: { type: historyType, source: 'ANDRIK Control' }
      });
  return json(result, result.ok ? 200 : 503);
}

function configuredPlaylistIds(env) {
  const value = String(
    env.OFFICIAL_PLAYLIST_IDS ||
    env.OFFICIAL_PLAYLIST_ID ||
    'PLOWKqAipKxhk,PLVEjOX_ujSMc,PLf3D55CqULs8'
  );
  return [...new Set(value.split(/[\s,;]+/).map(item => item.trim()).filter(item => /^[A-Za-z0-9_-]{10,80}$/.test(item)))];
}

async function resolveUploadsPlaylistId(env, db) {
  const explicit = cleanPlainText(env.YOUTUBE_UPLOADS_PLAYLIST_ID, 100);
  if (explicit) return explicit;
  const saved = await getPushState(db, 'youtube-uploads-playlist-id');
  if (saved?.value) return saved.value;
  const apiKey = String(env.YOUTUBE_API_KEY || '');
  if (!apiKey) return '';
  const channelHandle = cleanPlainText(env.YOUTUBE_CHANNEL_HANDLE || '@andrikmetal', 100);
  const url = new URL('https://www.googleapis.com/youtube/v3/channels');
  url.searchParams.set('part', 'contentDetails,snippet');
  url.searchParams.set('forHandle', channelHandle.replace(/^@/, ''));
  url.searchParams.set('key', apiKey);
  await trackObservabilityUsage(env, 'youtube-data-api', observabilityQuotaCost('channels'), 1, { endpoint:'channels', source:'resolve-uploads-playlist' }).catch(() => {});
  const response = await fetch(url.toString(), { headers: { accept: 'application/json' } });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data?.error?.message || 'youtube-channel-api-error');
  const playlistId = cleanPlainText(data?.items?.[0]?.contentDetails?.relatedPlaylists?.uploads, 100);
  if (playlistId) await setPushState(db, 'youtube-uploads-playlist-id', playlistId);
  return playlistId;
}

async function fetchYoutubePlaylistItems(env, apiKey, playlistId, source) {
  const items = [];
  let pageToken = '';
  for (let page = 0; page < 3; page += 1) {
    const url = new URL('https://www.googleapis.com/youtube/v3/playlistItems');
    url.searchParams.set('part', 'snippet,contentDetails');
    url.searchParams.set('playlistId', playlistId);
    url.searchParams.set('maxResults', '50');
    url.searchParams.set('key', apiKey);
    if (pageToken) url.searchParams.set('pageToken', pageToken);
    await trackObservabilityUsage(env, 'youtube-data-api', observabilityQuotaCost('playlistItems'), 1, { endpoint:'playlistItems', playlistId:cleanPlainText(playlistId,80) }).catch(() => {});
    const response = await fetch(url.toString(), { headers: { accept: 'application/json' } });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(data?.error?.message || 'youtube-api-error');
    for (const item of data.items || []) {
      const videoId = item?.contentDetails?.videoId || item?.snippet?.resourceId?.videoId;
      const title = cleanPlainText(item?.snippet?.title, 180);
      if (!videoId || !title || /private video|deleted video/i.test(title)) continue;
      items.push({
        videoId,
        title,
        publishedAt: cleanPlainText(item?.contentDetails?.videoPublishedAt || item?.snippet?.publishedAt, 40),
        thumbnail: item?.snippet?.thumbnails?.maxres?.url || item?.snippet?.thumbnails?.high?.url || item?.snippet?.thumbnails?.medium?.url || '',
        source,
        playlistId
      });
    }
    pageToken = data.nextPageToken || '';
    if (!pageToken) break;
  }
  return items;
}

function xmlEntityDecode(value) {
  return String(value || '')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;|&apos;/g, "'");
}

async function fetchYoutubePlaylistFeed(playlistId, source) {
  const response = await fetch(`https://www.youtube.com/feeds/videos.xml?playlist_id=${encodeURIComponent(playlistId)}`, {
    headers: { accept: 'application/atom+xml, application/xml, text/xml' }
  });
  if (!response.ok) throw new Error(`youtube-feed-error-${response.status}`);
  const xml = await response.text();
  const entries = xml.match(/<entry>[\s\S]*?<\/entry>/g) || [];
  return entries.map(entry => {
    const videoId = entry.match(/<yt:videoId>([^<]+)<\/yt:videoId>/)?.[1] || '';
    const title = xmlEntityDecode(entry.match(/<title>([\s\S]*?)<\/title>/)?.[1] || '').trim();
    const publishedAt = entry.match(/<published>([^<]+)<\/published>/)?.[1] || '';
    const thumbnail = entry.match(/<media:thumbnail[^>]+url="([^"]+)"/)?.[1] || '';
    return { videoId, title, publishedAt, thumbnail, source, playlistId };
  }).filter(item => item.videoId && item.title);
}

async function fetchOfficialPlaylist(env, db) {
  const apiKey = String(env.YOUTUBE_API_KEY || '');
  const uploadsPlaylistId = await resolveUploadsPlaylistId(env, db);
  const sources = [];
  if (uploadsPlaylistId) sources.push({ playlistId: uploadsPlaylistId, source: `Канал ${cleanPlainText(env.YOUTUBE_CHANNEL_HANDLE || '@andrikmetal', 100)}` });
  for (const playlistId of configuredPlaylistIds(env)) {
    if (playlistId !== uploadsPlaylistId) sources.push({ playlistId, source: `Плейлист ${playlistId}` });
  }
  if (!sources.length) throw new Error('youtube-source-not-configured');

  const settled = await Promise.allSettled(sources.map(source => (
    apiKey
      ? fetchYoutubePlaylistItems(env, apiKey, source.playlistId, source.source)
      : fetchYoutubePlaylistFeed(source.playlistId, source.source)
  )));
  const items = [];
  const errors = [];
  settled.forEach((result, index) => {
    if (result.status === 'fulfilled') items.push(...result.value);
    else errors.push(`${sources[index].source}: ${String(result.reason?.message || result.reason || 'error')}`);
  });
  if (!items.length && errors.length) throw new Error(errors.join(' | '));

  const byVideo = new Map();
  for (const item of items) {
    const existing = byVideo.get(item.videoId);
    if (!existing || String(item.publishedAt || '') > String(existing.publishedAt || '')) byVideo.set(item.videoId, item);
  }
  return {
    items: [...byVideo.values()].sort((a, b) => String(b.publishedAt || '').localeCompare(String(a.publishedAt || ''))),
    sources: sources.map(item => item.source),
    errors,
    mode: apiKey ? 'youtube-data-api' : 'youtube-feed'
  };
}


const YOUTUBE_WEBSUB_HUB_R332 = 'https://pubsubhubbub.appspot.com/subscribe';
const YOUTUBE_WEBSUB_CALLBACK_R332 = 'https://control.andrikmetal.com/api/youtube/websub';
const YOUTUBE_FAST_CRON_R332 = '*/5 * * * *';
const YOUTUBE_ENGAGEMENT_CRON_R333 = '*/2 * * * *';

async function claimYoutubeReleaseOnceR332(db, videoId, value = new Date().toISOString()) {
  const safeVideoId = cleanPlainText(videoId || '', 80);
  if (!safeVideoId) return { ok:false, reason:'video-id-required', key:'' };
  const key = `push-once:youtube-release:${safeVideoId}`;
  const delivered = await db.prepare(`
    SELECT 1 AS found FROM push_history
    WHERE type='auto-release' AND status='sent' AND video_id=?
      AND onesignal_id IS NOT NULL AND onesignal_id != ''
    ORDER BY created_at DESC LIMIT 1
  `).bind(safeVideoId).first().catch(() => null);
  if (delivered?.found) return { ok:false, reason:'already-sent', key };
  let claimed = await claimPushOnce(db, key, value);
  if (!claimed) {
    await db.prepare(`
      DELETE FROM push_state
      WHERE key=? AND updated_at < datetime('now','-10 minutes')
    `).bind(key).run().catch(() => {});
    claimed = await claimPushOnce(db, key, value);
  }
  return { ok:Boolean(claimed), reason:claimed ? 'claimed' : 'busy', key };
}

async function resolveYoutubeWebSubChannelIdR332(env, db) {
  const explicit = cleanPlainText(env.YOUTUBE_CHANNEL_ID || '', 120);
  if (explicit) return explicit;
  const saved = await getPushState(db, 'youtube-websub-channel-id-r332').catch(() => null);
  if (saved?.value) return cleanPlainText(saved.value, 120);
  const row = await db.prepare(`
    SELECT resource_id AS channelId
    FROM youtube_event_seen
    WHERE event_key='channel-subscriber-count' AND resource_id IS NOT NULL AND resource_id != ''
    LIMIT 1
  `).first().catch(() => null);
  if (row?.channelId) {
    const id = cleanPlainText(row.channelId, 120);
    await setPushState(db, 'youtube-websub-channel-id-r332', id).catch(() => {});
    return id;
  }
  const identity = await fetchYoutubeMonitorIdentity(env);
  const id = cleanPlainText(identity?.channelId || '', 120);
  if (id) await setPushState(db, 'youtube-websub-channel-id-r332', id).catch(() => {});
  return id;
}

function youtubeWebSubTopicR332(channelId) {
  return `https://www.youtube.com/feeds/videos.xml?channel_id=${encodeURIComponent(channelId)}`;
}

async function ensureYoutubeWebSubSubscriptionR332(env, db, { force=false } = {}) {
  const now = Date.now();
  const [statusState, expiryState, requestedState] = await Promise.all([
    getPushState(db, 'youtube-websub-status-r332').catch(() => null),
    getPushState(db, 'youtube-websub-lease-expires-at-r332').catch(() => null),
    getPushState(db, 'youtube-websub-requested-at-r332').catch(() => null)
  ]);
  const expiresMs = Date.parse(expiryState?.value || '');
  if (!force && statusState?.value === 'verified' && Number.isFinite(expiresMs) && expiresMs - now > 24 * 60 * 60 * 1000) {
    return { ok:true, skipped:true, status:'verified', leaseExpiresAt:expiryState.value };
  }
  const requestedMs = Date.parse(requestedState?.value || '');
  if (!force && statusState?.value === 'pending' && Number.isFinite(requestedMs) && now - requestedMs < 10 * 60 * 1000) {
    return { ok:true, skipped:true, status:'pending', requestedAt:requestedState.value };
  }

  const channelId = await resolveYoutubeWebSubChannelIdR332(env, db);
  if (!channelId) return { ok:false, error:'youtube-websub-channel-id-unavailable' };
  const topic = youtubeWebSubTopicR332(channelId);
  const callback = cleanPlainText(env.YOUTUBE_WEBSUB_CALLBACK || YOUTUBE_WEBSUB_CALLBACK_R332, 500);
  const requestedAt = new Date().toISOString();
  await Promise.all([
    setPushState(db, 'youtube-websub-channel-id-r332', channelId),
    setPushState(db, 'youtube-websub-topic-r332', topic),
    setPushState(db, 'youtube-websub-callback-r332', callback),
    setPushState(db, 'youtube-websub-status-r332', 'pending'),
    setPushState(db, 'youtube-websub-requested-at-r332', requestedAt)
  ]);

  const body = new URLSearchParams();
  body.set('hub.mode', 'subscribe');
  body.set('hub.topic', topic);
  body.set('hub.callback', callback);
  body.set('hub.verify', 'async');
  body.set('hub.lease_seconds', '432000');
  const response = await fetch(YOUTUBE_WEBSUB_HUB_R332, {
    method:'POST',
    headers:{ 'content-type':'application/x-www-form-urlencoded;charset=UTF-8', accept:'text/plain' },
    body:body.toString()
  });
  const responseText = await response.text().catch(() => '');
  await setPushState(db, 'youtube-websub-subscribe-http-r332', JSON.stringify({
    ok:response.ok,
    status:response.status,
    requestedAt,
    body:cleanPlainText(responseText, 300)
  })).catch(() => {});
  if (!response.ok) {
    await setPushState(db, 'youtube-websub-status-r332', 'request-failed').catch(() => {});
    throw new Error(`youtube-websub-subscribe-${response.status}`);
  }
  await recordSystemLog(env, {
    scope:'youtube', level:'info', event:'websub-subscribe-requested',
    message:'YouTube WebSub: запрос мгновенных уведомлений отправлен.',
    details:{ channelId, topic, callback, requestedAt, httpStatus:response.status }
  }).catch(() => {});
  return { ok:true, requested:true, status:'pending', channelId, topic, callback, requestedAt, httpStatus:response.status };
}

async function handleYoutubeWebSubSubscribeR332(request, env) {
  if (!adminAuthorized(request, env) && !cronAuthorized(request, env)) return json({ok:false,error:'unauthorized'},401);
  const db = requireDb(env);
  await Promise.all([ensurePushAutomationSchema(db), ensureControlV1Schema(db)]);
  try {
    const result = await ensureYoutubeWebSubSubscriptionR332(env, db, { force:true });
    return json(result, result.ok ? 200 : 503);
  } catch (error) {
    return json({ok:false,error:cleanPlainText(error?.message || error,400)},503);
  }
}

async function handleYoutubeWebSubStatusR332(request, env) {
  if (!adminAuthorized(request, env)) return json({ok:false,error:'unauthorized'},401);
  const db = requireDb(env);
  await ensurePushAutomationSchema(db);
  const keys = [
    'youtube-websub-status-r332','youtube-websub-channel-id-r332','youtube-websub-topic-r332',
    'youtube-websub-callback-r332','youtube-websub-requested-at-r332','youtube-websub-verified-at-r332',
    'youtube-websub-lease-expires-at-r332','youtube-websub-last-callback-at-r332',
    'youtube-websub-last-video-id-r332','youtube-websub-last-result-r332','youtube-fast-last-check-at-r332'
  ];
  const states = {};
  for (const key of keys) states[key] = (await getPushState(db,key).catch(() => null))?.value || '';
  return json({ok:true,websub:states,fastCronExpression:YOUTUBE_FAST_CRON_R332,engagementCronExpression:YOUTUBE_ENGAGEMENT_CRON_R333,releaseMode:'WebSub + 5m fallback',engagementMode:'comments+likes 2m',subscriberMode:'R331 events <=5m'});
}

async function handleYoutubeWebSubVerifyR332(request, env, ctx) {
  const db = requireDb(env);
  await ensurePushAutomationSchema(db);
  const url = new URL(request.url);
  const mode = cleanPlainText(url.searchParams.get('hub.mode') || '', 30);
  const topic = String(url.searchParams.get('hub.topic') || '');
  const challenge = String(url.searchParams.get('hub.challenge') || '');
  const leaseSeconds = Math.max(0, Math.min(31_536_000, Number(url.searchParams.get('hub.lease_seconds') || 0)));
  if (!challenge || !['subscribe','unsubscribe'].includes(mode)) return new Response('invalid-websub-verification',{status:400});

  const configuredTopic = (await getPushState(db, 'youtube-websub-topic-r332').catch(() => null))?.value || '';
  let expectedTopic = configuredTopic;
  if (!expectedTopic) {
    const channelId = await resolveYoutubeWebSubChannelIdR332(env, db).catch(() => '');
    if (channelId) expectedTopic = youtubeWebSubTopicR332(channelId);
  }
  if (!expectedTopic || topic !== expectedTopic) return new Response('topic-mismatch',{status:403});

  const verifiedAt = new Date().toISOString();
  const leaseExpiresAt = leaseSeconds ? new Date(Date.now() + leaseSeconds * 1000).toISOString() : '';
  const persist = (async () => {
    await setPushState(db, 'youtube-websub-status-r332', mode === 'subscribe' ? 'verified' : 'unsubscribed');
    await setPushState(db, 'youtube-websub-verified-at-r332', verifiedAt);
    if (leaseExpiresAt) await setPushState(db, 'youtube-websub-lease-expires-at-r332', leaseExpiresAt);
    await recordSystemLog(env, {
      scope:'youtube', level:'info', event:'websub-verified',
      message:mode === 'subscribe' ? 'YouTube WebSub подключён.' : 'YouTube WebSub отключён.',
      details:{ mode, topic, verifiedAt, leaseSeconds, leaseExpiresAt }
    }).catch(() => {});
  })();
  if (ctx?.waitUntil) ctx.waitUntil(persist); else await persist;
  return new Response(challenge,{status:200,headers:{'content-type':'text/plain; charset=utf-8','cache-control':'no-store'}});
}

function parseYoutubeWebSubPayloadR332(xml='') {
  const text = String(xml || '').slice(0, 200000);
  const videoId = cleanPlainText(text.match(/<yt:videoId>([^<]+)<\/yt:videoId>/i)?.[1] || '', 80);
  const channelId = cleanPlainText(text.match(/<yt:channelId>([^<]+)<\/yt:channelId>/i)?.[1] || '', 120);
  return { videoId, channelId };
}

async function fetchYoutubeVideoForWebSubR332(env, videoId) {
  const { data, mode } = await youtubeApiJson(env, 'videos', { part:'snippet,status', id:videoId }, { oauth:false });
  const item = Array.isArray(data?.items) ? data.items[0] : null;
  if (!item) return { ok:false, error:'video-not-found', mode };
  const snippet = item.snippet || {};
  const status = item.status || {};
  return {
    ok:true,
    mode,
    item:{
      videoId:cleanPlainText(item.id || videoId,80),
      title:cleanPlainText(snippet.title || '',180),
      publishedAt:cleanPlainText(snippet.publishedAt || '',50),
      thumbnail:snippet?.thumbnails?.maxres?.url || snippet?.thumbnails?.high?.url || snippet?.thumbnails?.medium?.url || '',
      channelId:cleanPlainText(snippet.channelId || '',120),
      privacyStatus:cleanPlainText(status.privacyStatus || '',30),
      source:'YouTube WebSub'
    }
  };
}

async function pushYoutubeReleaseItemR332(env, db, item, origin='websub') {
  const videoId = cleanPlainText(item?.videoId || '',80);
  if (!videoId) return {ok:false,error:'video-id-required'};
  const claim = await claimYoutubeReleaseOnceR332(db, videoId, `${origin}:${new Date().toISOString()}`);
  if (!claim.ok) return {ok:true,skipped:true,reason:claim.reason,videoId};

  const releaseTitle = normalizeReleaseTitle(item.title);
  const releaseUrl = `https://www.youtube.com/watch?v=${encodeURIComponent(videoId)}`;
  const result = await sendOneSignalPush(env, {
    title:`🎵 ${compactYoutubePushTitle(releaseTitle, 'Новый релиз')}`,
    message:'Новый релиз ANDRIK уже доступен на YouTube',
    url:releaseUrl,
    image:item.thumbnail || '',
    webButtons:[{id:'listen-now',text:'▶️ Слушать на YouTube',url:releaseUrl}],
    audience:'all',
    name:`release-${videoId}`,
    history:{type:'auto-release',source:item.source || 'YouTube',videoId,videoTitle:releaseTitle,details:{origin}}
  });
  await upsertReleaseHistory(db, {
    videoId,
    title:releaseTitle,
    url:releaseUrl,
    source:item.source || 'YouTube WebSub',
    pushStatus:result.ok ? 'sent' : (result.skipped ? 'skipped' : 'failed'),
    lyricsStatus:'missing',
    publishedAt:item.publishedAt || '',
    details:{automatic:true,origin,error:result.error || '',oneSignalId:result.oneSignalId || ''}
  }).catch(() => {});
  if (!result.ok) {
    await releasePushOnceClaim(db, claim.key).catch(() => {});
    return {ok:false,error:result.error || 'push-failed',videoId,title:releaseTitle};
  }
  await db.prepare(`
    INSERT OR IGNORE INTO push_playlist_seen (video_id,title,published_at,first_seen_at)
    VALUES (?,?,?,datetime('now'))
  `).bind(videoId,item.title || releaseTitle,item.publishedAt || '').run();
  await cacheLatestYoutubeItem(db, item, {mode:origin}).catch(() => {});
  await recordSystemLog(env, {
    scope:'push',level:'info',event:'auto-release-websub-sent',
    message:`WebSub: уведомление о «${releaseTitle}» отправлено.`,
    details:{videoId,origin,oneSignalId:result.oneSignalId || ''}
  }).catch(() => {});
  return {ok:true,sent:true,videoId,title:releaseTitle,oneSignalId:result.oneSignalId || ''};
}

async function processYoutubeWebSubNotificationR332(env, payload) {
  const db = requireDb(env);
  await Promise.all([ensurePushAutomationSchema(db), ensureLyricsV2Schema(db), ensureControlV1Schema(db)]);
  const startedAt = new Date().toISOString();
  await setPushState(db, 'youtube-websub-last-callback-at-r332', startedAt).catch(() => {});
  await setPushState(db, 'youtube-websub-last-video-id-r332', payload.videoId || '').catch(() => {});
  try {
    const expectedChannelId = await resolveYoutubeWebSubChannelIdR332(env, db);
    if (!payload.videoId || !payload.channelId || payload.channelId !== expectedChannelId) {
      const result={ok:false,skipped:true,error:'channel-or-video-mismatch',payload,expectedChannelId};
      await setPushState(db,'youtube-websub-last-result-r332',JSON.stringify(result)).catch(() => {});
      return result;
    }
    const fetched = await fetchYoutubeVideoForWebSubR332(env, payload.videoId);
    if (!fetched.ok) throw new Error(fetched.error || 'video-fetch-failed');
    const item = fetched.item;
    if (item.channelId !== expectedChannelId) throw new Error('video-channel-mismatch');
    if (item.privacyStatus && item.privacyStatus !== 'public') {
      const result={ok:true,skipped:true,reason:`privacy-${item.privacyStatus}`,videoId:item.videoId};
      await setPushState(db,'youtube-websub-last-result-r332',JSON.stringify(result)).catch(() => {});
      return result;
    }
    const result = await pushYoutubeReleaseItemR332(env, db, item, 'websub-r332');
    try{
      const {data}=await youtubeApiJson(env,'videos',{part:'snippet,statistics',id:item.videoId,maxResults:1});
      const video=data?.items?.[0];
      if(video && !await getYoutubeEventRow(db,`like-count:${item.videoId}`)){
        const baseline={
          videoId:cleanPlainText(video.id || item.videoId,40),
          title:cleanPlainText(video?.snippet?.title || item.title || 'Видео ANDRIK',180),
          publishedAt:cleanPlainText(video?.snippet?.publishedAt || item.publishedAt || '',50),
          thumbnail:video?.snippet?.thumbnails?.high?.url || video?.snippet?.thumbnails?.medium?.url || item.thumbnail || '',
          likes:Number(video?.statistics?.likeCount || 0),comments:Number(video?.statistics?.commentCount || 0),
          url:`https://www.youtube.com/watch?v=${encodeURIComponent(video.id || item.videoId)}`
        };
        await saveYoutubeEventRow(db,{key:`like-count:${baseline.videoId}`,type:'like-count',resourceId:baseline.videoId,videoId:baseline.videoId,title:baseline.title,countValue:baseline.likes,url:baseline.url,payload:baseline});
        await saveYoutubeEventRow(db,{key:`comment-count:${baseline.videoId}`,type:'comment-count',resourceId:baseline.videoId,videoId:baseline.videoId,title:baseline.title,countValue:baseline.comments,url:baseline.url,payload:baseline});
      }
    }catch(_){}
    await setPushState(db,'youtube-websub-last-result-r332',JSON.stringify(result)).catch(() => {});
    return result;
  } catch (error) {
    const result={ok:false,error:cleanPlainText(error?.message || error,400),videoId:payload.videoId || ''};
    await setPushState(db,'youtube-websub-last-result-r332',JSON.stringify(result)).catch(() => {});
    await recordSystemLog(env,{scope:'youtube',level:'error',event:'websub-process-failed',message:`WebSub ошибка: ${result.error}`,details:result}).catch(() => {});
    return result;
  }
}

async function handleYoutubeWebSubNotifyR332(request, env, ctx) {
  const text = await request.text();
  const payload = parseYoutubeWebSubPayloadR332(text);
  if (!payload.videoId || !payload.channelId) return new Response('',{status:204,headers:{'cache-control':'no-store'}});
  const task = processYoutubeWebSubNotificationR332(env, payload);
  if (ctx?.waitUntil) ctx.waitUntil(task); else await task;
  return new Response('',{status:204,headers:{'cache-control':'no-store'}});
}

async function fetchLatestUploadsR332(env, db) {
  const playlistId = await resolveUploadsPlaylistId(env, db);
  if (!playlistId) throw new Error('youtube-uploads-playlist-unavailable');
  const apiKey = String(env.YOUTUBE_API_KEY || '').trim();
  const source = `Канал ${cleanPlainText(env.YOUTUBE_CHANNEL_HANDLE || '@andrikmetal',100)}`;
  if (!apiKey) {
    const items = await fetchYoutubePlaylistFeed(playlistId, source);
    return {items:items.slice(0,3),mode:'youtube-feed-fast',playlistId};
  }
  const url = new URL('https://www.googleapis.com/youtube/v3/playlistItems');
  url.searchParams.set('part','snippet,contentDetails');
  url.searchParams.set('playlistId',playlistId);
  url.searchParams.set('maxResults','3');
  url.searchParams.set('key',apiKey);
  await trackObservabilityUsage(env,'youtube-data-api',observabilityQuotaCost('playlistItems'),1,{endpoint:'playlistItems',playlistId:cleanPlainText(playlistId,80),source:'fast-release-r332'}).catch(() => {});
  const response = await fetch(url.toString(),{headers:{accept:'application/json'}});
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data?.error?.message || 'youtube-fast-playlist-error');
  const items=(data.items || []).map(raw=>{
    const videoId=raw?.contentDetails?.videoId || raw?.snippet?.resourceId?.videoId || '';
    const title=cleanPlainText(raw?.snippet?.title || '',180);
    if(!videoId || !title || /private video|deleted video/i.test(title)) return null;
    return {
      videoId,title,
      publishedAt:cleanPlainText(raw?.contentDetails?.videoPublishedAt || raw?.snippet?.publishedAt || '',50),
      thumbnail:raw?.snippet?.thumbnails?.maxres?.url || raw?.snippet?.thumbnails?.high?.url || raw?.snippet?.thumbnails?.medium?.url || '',
      source,playlistId
    };
  }).filter(Boolean);
  return {items,mode:'youtube-data-api-fast',playlistId};
}

async function handleFastYoutubeReleaseCheckR332(request, env) {
  if (!adminAuthorized(request, env) && !cronAuthorized(request, env)) return json({ok:false,error:'unauthorized'},401);
  const db = requireDb(env);
  await Promise.all([ensurePushAutomationSchema(db),ensureLyricsV2Schema(db),ensureControlV1Schema(db)]);
  const startedAt=new Date().toISOString();
  await setPushState(db,'youtube-fast-last-check-at-r332',startedAt).catch(() => {});
  let websub={ok:true,skipped:true};
  try{websub=await ensureYoutubeWebSubSubscriptionR332(env,db,{force:false});}catch(error){websub={ok:false,error:cleanPlainText(error?.message || error,300)}}
  const seeded=await getPushState(db,'playlist-seeded').catch(() => null);
  if(!seeded?.value){
    const full=await responseData(await handleCheckPlaylist(request,env));
    return json({ok:Boolean(full.httpOk),mode:'seed-via-full',websub,full},full.httpOk?200:502);
  }
  try{
    const fetched=await fetchLatestUploadsR332(env,db);
    const results=[];
    for(const item of fetched.items.slice().reverse()) results.push(await pushYoutubeReleaseItemR332(env,db,item,'fast-cron-r332'));
    const sent=results.filter(x=>x?.sent).length;
    const failed=results.filter(x=>x && x.ok===false).length;
    const finishedAt=new Date().toISOString();
    await setPushState(db,'youtube-fast-last-check-at-r332',finishedAt).catch(() => {});
    await setPushState(db,'youtube-fast-last-result-r332',JSON.stringify({sent,failed,results,mode:fetched.mode})).catch(() => {});
    return json({ok:failed===0,checked:fetched.items.length,sent,failed,results,mode:fetched.mode,websub,checkedAt:finishedAt},failed===0?200:502);
  }catch(error){
    const msg=cleanPlainText(error?.message || error,400);
    await setPushState(db,'youtube-fast-last-result-r332',JSON.stringify({ok:false,error:msg})).catch(() => {});
    return json({ok:false,error:msg,websub},502);
  }
}

async function handleCheckPlaylist(request, env) {
  if (!adminAuthorized(request, env) && !cronAuthorized(request, env)) return json({ ok: false, error: 'unauthorized' }, 401);
  const db = requireDb(env);
  await Promise.all([ensurePushAutomationSchema(db), ensureLyricsV2Schema(db), ensureControlV1Schema(db)]);
  const startedAt = new Date().toISOString();
  await setPushState(db, 'playlist-last-check-at', startedAt);
  await setPushState(db, 'playlist-last-check-status', 'running');
  await recordSystemLog(env, {
    scope: 'youtube', level: 'info', event: 'check-started',
    message: 'Начата боевая проверка YouTube.',
    details: { startedAt, caller: adminAuthorized(request, env) ? 'control' : 'cron' }
  }).catch(() => {});

  try {
    const fetched = await fetchOfficialPlaylist(env, db);
    const items = fetched.items;
    if (items[0]) await cacheLatestYoutubeItem(db, items[0], { mode: fetched.mode }).catch(() => {});
    await recordSystemLog(env, {
      scope: 'youtube', level: fetched.errors.length ? 'warning' : 'info', event: 'playlist-fetched',
      message: `YouTube вернул ${items.length} видео.`,
      details: { mode: fetched.mode, sources: fetched.sources, warnings: fetched.errors, latest: items[0] || null }
    }).catch(() => {});

    const seeded = await db.prepare(`SELECT value FROM push_state WHERE key = 'playlist-seeded' LIMIT 1`).first();
    const [seenResult, sentHistoryResult] = await Promise.all([
      db.prepare('SELECT video_id FROM push_playlist_seen').all(),
      db.prepare(`
        SELECT DISTINCT video_id
        FROM push_history
        WHERE type = 'auto-release' AND status = 'sent'
          AND onesignal_id IS NOT NULL AND onesignal_id != ''
          AND video_id IS NOT NULL AND video_id != ''
      `).all()
    ]);
    const seen = new Set([
      ...(seenResult.results || []).map(row => row.video_id),
      ...(sentHistoryResult.results || []).map(row => row.video_id)
    ].filter(Boolean));
    const newItems = items.filter(item => !seen.has(item.videoId));

    if (!seeded) {
      if (items.length) {
        await db.batch(items.map(item => db.prepare(`
          INSERT OR IGNORE INTO push_playlist_seen (video_id, title, published_at, first_seen_at)
          VALUES (?, ?, ?, datetime('now'))
        `).bind(item.videoId, item.title, item.publishedAt)));
      }
      await setPushState(db, 'playlist-seeded', '1');
      await setPushState(db, 'playlist-seeded-at', startedAt);
      await setPushState(db, 'playlist-last-check-status', 'seeded');
      const summary = {
        checked: items.length,
        newCount: 0,
        notified: 0,
        mode: fetched.mode,
        sources: fetched.sources,
        errors: fetched.errors
      };
      await setPushState(db, 'playlist-last-check-summary', JSON.stringify(summary));
      await recordSystemLog(env, {
        scope: 'youtube', level: 'warning', event: 'playlist-seeded',
        message: `Первый запуск: запомнено ${items.length} существующих видео без рассылки.`,
        details: summary
      }).catch(() => {});
      return json({ ok: true, seeded: true, checked: items.length, notified: 0, mode: fetched.mode, sources: fetched.sources, warnings: fetched.errors, checkedAt: startedAt });
    }

    await recordSystemLog(env, {
      scope: 'youtube', level: newItems.length ? 'info' : 'debug', event: 'new-items-calculated',
      message: newItems.length ? `Обнаружено новых видео: ${newItems.length}.` : 'Новых видео не обнаружено.',
      details: { newItems: newItems.map(item => ({ videoId: item.videoId, title: item.title, publishedAt: item.publishedAt })) }
    }).catch(() => {});

    let notified = 0;
    const sentItems = [];
    const failedItems = [];
    for (const item of newItems.slice().reverse().slice(0, 8)) {
      const releaseClaimR332 = await claimYoutubeReleaseOnceR332(db, item.videoId, `playlist:${startedAt}`);
      if (!releaseClaimR332.ok) continue;
      const releaseTitle = normalizeReleaseTitle(item.title);
      const releaseUrl = `https://www.youtube.com/watch?v=${encodeURIComponent(item.videoId)}`;
      await recordSystemLog(env, {
        scope: 'push', level: 'info', event: 'auto-release-send-started',
        message: `Отправляем уведомление о «${releaseTitle}».`,
        details: { videoId: item.videoId, releaseUrl, source: item.source }
      }).catch(() => {});
      const result = await sendOneSignalPush(env, {
        title: `🎵 ${compactYoutubePushTitle(releaseTitle, 'Новый релиз')}`,
        message: 'Новый релиз ANDRIK уже доступен на YouTube',
        url: releaseUrl,
        image: item.thumbnail,
        webButtons: [{ id: 'listen-now', text: '▶️ Слушать на YouTube', url: releaseUrl }],
        audience: 'all',
        name: `release-${item.videoId}`,
        history: { type: 'auto-release', source: item.source || 'YouTube', videoId: item.videoId, videoTitle: releaseTitle }
      });
      await upsertReleaseHistory(db, {
        videoId: item.videoId,
        title: releaseTitle,
        url: releaseUrl,
        source: item.source || 'YouTube monitor',
        pushStatus: result.ok ? 'sent' : (result.skipped ? 'skipped' : 'failed'),
        lyricsStatus: 'missing',
        publishedAt: item.publishedAt,
        details: { automatic: true, error: result.error || '', oneSignalId: result.oneSignalId || '' }
      }).catch(() => {});
      if (result.ok) {
        notified += 1;
        sentItems.push({ videoId: item.videoId, title: releaseTitle, oneSignalId: result.oneSignalId || '' });
        await db.prepare(`
          INSERT OR IGNORE INTO push_playlist_seen (video_id, title, published_at, first_seen_at)
          VALUES (?, ?, ?, datetime('now'))
        `).bind(item.videoId, item.title, item.publishedAt).run();
        await recordSystemLog(env, {
          scope: 'push', level: 'info', event: 'auto-release-accepted',
          message: `OneSignal принял уведомление о «${releaseTitle}».`,
          details: { videoId: item.videoId, oneSignalId: result.oneSignalId || '', response: result.data || {} }
        }).catch(() => {});
      } else {
        await releasePushOnceClaim(db, releaseClaimR332.key).catch(() => {});
        failedItems.push({ videoId: item.videoId, title: releaseTitle, error: result.error || 'send-failed' });
        await recordSystemLog(env, {
          scope: 'push', level: 'error', event: 'auto-release-failed',
          message: `Уведомление о «${releaseTitle}» не отправлено: ${result.error || 'send-failed'}.`,
          details: { videoId: item.videoId, response: result.data || {}, status: result.status || 0 }
        }).catch(() => {});
      }
    }

    const finishedAt = new Date().toISOString();
    const summary = {
      checked: items.length,
      newCount: newItems.length,
      notified,
      mode: fetched.mode,
      sources: fetched.sources,
      errors: [...fetched.errors, ...failedItems.map(item => `${item.title}: ${item.error}`)]
    };
    await setPushState(db, 'playlist-last-check-at', finishedAt);
    await setPushState(db, 'playlist-last-check-status', failedItems.length ? 'partial' : 'ok');
    await setPushState(db, 'playlist-last-check-summary', JSON.stringify(summary));
    await recordSystemLog(env, {
      scope: 'youtube', level: failedItems.length ? 'warning' : 'info', event: 'check-completed',
      message: `Проверка завершена: новых ${newItems.length}, OneSignal принял ${notified}, ошибок ${failedItems.length}.`,
      details: { ...summary, sentItems, failedItems, finishedAt }
    }).catch(() => {});
    return json({
      ok: true,
      seeded: false,
      checked: items.length,
      newItems: newItems.map(item => ({ videoId: item.videoId, title: normalizeReleaseTitle(item.title) })),
      notified,
      sentItems,
      failedItems,
      mode: fetched.mode,
      sources: fetched.sources,
      warnings: fetched.errors,
      checkedAt: finishedAt
    });
  } catch (error) {
    const failedAt = new Date().toISOString();
    const errorText = String(error?.message || error);
    await setPushState(db, 'playlist-last-check-at', failedAt).catch(() => {});
    await setPushState(db, 'playlist-last-check-status', 'failed').catch(() => {});
    await setPushState(db, 'playlist-last-check-summary', JSON.stringify({ error: errorText })).catch(() => {});
    await recordPushHistory(env, {
      type: 'automation-error', source: 'YouTube monitor', audience: 'system', status: 'failed',
      title: 'Ошибка проверки YouTube', message: errorText, error: errorText
    }).catch(() => {});
    await recordSystemLog(env, {
      scope: 'youtube', level: 'error', event: 'check-failed',
      message: `Проверка YouTube завершилась ошибкой: ${errorText}`,
      details: { failedAt, stack: cleanPlainText(error?.stack || '', 1500) }
    }).catch(() => {});
    throw error;
  }
}

function parsePushSummary(value) {
  try { return JSON.parse(value || '{}'); }
  catch (_) { return {}; }
}

async function handlePushHistory(request, env) {
  if (!adminAuthorized(request, env)) return json({ ok: false, error: 'unauthorized' }, 401);
  const db = requireDb(env);
  await ensurePushAutomationSchema(db);
  const url = new URL(request.url);
  const limit = Math.max(1, Math.min(100, Number(url.searchParams.get('limit') || 40)));
  const result = await db.prepare(`
    SELECT
      id, type, source, audience, status, title, message, url,
      video_id AS videoId, video_title AS videoTitle,
      onesignal_id AS oneSignalId, recipients, error,
      details_json AS detailsJson, created_at AS createdAt
    FROM push_history
    ORDER BY created_at DESC
    LIMIT ?
  `).bind(limit).all();

  const lastCheck = await getPushState(db, 'playlist-last-check-at');
  const lastStatus = await getPushState(db, 'playlist-last-check-status');
  const lastSummary = await getPushState(db, 'playlist-last-check-summary');
  const seeded = await getPushState(db, 'playlist-seeded');
  const uploadsPlaylist = await getPushState(db, 'youtube-uploads-playlist-id');
  const [centralCheck, centralStatus, centralSummary] = await Promise.all([
    getPushState(db, 'automation-last-check-at'),
    getPushState(db, 'automation-last-check-status'),
    getPushState(db, 'automation-last-check-summary')
  ]);
  const effectiveLastCheck = centralCheck?.value || '';
  const effectiveLastStatus = centralStatus?.value || 'never';
  const effectiveLastSummary = centralSummary?.value || '';
  const lastCheckMs = effectiveLastCheck ? Date.parse(effectiveLastCheck) : NaN;
  const ageMinutes = Number.isFinite(lastCheckMs) ? Math.max(0, Math.round((Date.now() - lastCheckMs) / 60000)) : null;
  const health = ageMinutes === null ? 'never' : ageMinutes <= 60 ? 'active' : ageMinutes <= 180 ? 'late' : 'stale';
  const nextExpectedAt = Number.isFinite(lastCheckMs) ? new Date(lastCheckMs + 15 * 60 * 1000).toISOString() : '';

  const history = (result.results || []).map(item => ({
    ...item,
    recipients: Number(item.recipients || 0),
    details: parsePushSummary(item.detailsJson),
    detailsJson: undefined
  }));

  return json({
    ok: true,
    automation: {
      intervalMinutes: 15,
      health,
      lastCheckAt: effectiveLastCheck,
      lastStatus: effectiveLastStatus,
      nextExpectedAt,
      ageMinutes,
      seeded: Boolean(seeded?.value),
      mode: String(env.YOUTUBE_API_KEY || '') ? 'YouTube Data API' : 'YouTube XML feed',
      channelHandle: cleanPlainText(env.YOUTUBE_CHANNEL_HANDLE || '@andrikmetal', 100),
      uploadsPlaylistId: uploadsPlaylist?.value || cleanPlainText(env.YOUTUBE_UPLOADS_PLAYLIST_ID, 100),
      configuredPlaylists: configuredPlaylistIds(env),
      summary: parsePushSummary(effectiveLastSummary)
    },
    history
  });
}


async function inspectYoutubePlaylist(env, db) {
  const fetched = await fetchOfficialPlaylist(env, db);
  if (fetched.items[0]) await cacheLatestYoutubeItem(db, fetched.items[0], { mode: fetched.mode }).catch(() => {});
  const [seenResult, sentHistoryResult, lastSeen, latestPushAttempt] = await Promise.all([
    db.prepare('SELECT video_id FROM push_playlist_seen').all(),
    db.prepare(`
      SELECT DISTINCT video_id
      FROM push_history
      WHERE type = 'auto-release' AND status = 'sent' AND video_id IS NOT NULL AND video_id != ''
    `).all(),
    db.prepare(`
      SELECT video_id AS videoId, title, published_at AS publishedAt, first_seen_at AS firstSeenAt
      FROM push_playlist_seen
      ORDER BY COALESCE(published_at, first_seen_at) DESC, first_seen_at DESC
      LIMIT 1
    `).first(),
    db.prepare(`
      SELECT status, error, onesignal_id AS oneSignalId, recipients, created_at AS createdAt,
             video_id AS videoId, video_title AS videoTitle, details_json AS detailsJson
      FROM push_history
      WHERE type IN ('auto-release', 'auto-release-retry')
      ORDER BY created_at DESC
      LIMIT 1
    `).first()
  ]);
  const seen = new Set([
    ...(seenResult.results || []).map(row => row.video_id),
    ...(sentHistoryResult.results || []).map(row => row.video_id)
  ].filter(Boolean));
  const normalized = fetched.items.map(item => ({
    videoId: item.videoId,
    title: normalizeReleaseTitle(item.title),
    publishedAt: item.publishedAt,
    thumbnail: item.thumbnail || '',
    source: item.source || 'YouTube',
    url: `https://www.youtube.com/watch?v=${encodeURIComponent(item.videoId)}`,
    seen: seen.has(item.videoId)
  }));
  const newItems = normalized.filter(item => !item.seen);
  return {
    ok: true,
    checked: normalized.length,
    mode: fetched.mode,
    sources: fetched.sources,
    warnings: fetched.errors,
    latestItem: normalized[0] || null,
    lastSeenItem: lastSeen || null,
    newItems: newItems.slice(0, 12),
    wouldNotify: newItems.length,
    latestPushAttempt: latestPushAttempt ? {
      ...latestPushAttempt,
      recipients: Number(latestPushAttempt.recipients || 0),
      details: parsePushSummary(latestPushAttempt.detailsJson),
      detailsJson: undefined
    } : null,
    inspectedAt: new Date().toISOString()
  };
}

async function handleInspectPlaylist(request, env) {
  if (!adminAuthorized(request, env)) return json({ ok: false, error: 'unauthorized' }, 401);
  const db = requireDb(env);
  await Promise.all([ensurePushAutomationSchema(db), ensureLyricsV2Schema(db), ensureControlV1Schema(db)]);
  const result = await inspectYoutubePlaylist(env, db);
  await recordSystemLog(env, {
    scope: 'youtube', level: 'info', event: 'safe-inspection',
    message: `Безопасная проверка: новых видео ${Number(result.wouldNotify || 0)}, проверено ${Number(result.checked || 0)}.`,
    details: { latestItem: result.latestItem, lastSeenItem: result.lastSeenItem, latestPushAttempt: result.latestPushAttempt, warnings: result.warnings }
  }).catch(() => {});
  return json(result);
}


async function handleRetryLatestPush(request, env) {
  if (!adminAuthorized(request, env)) return json({ ok: false, error: 'unauthorized' }, 401);
  const db = requireDb(env);
  await Promise.all([ensurePushAutomationSchema(db), ensureControlV1Schema(db)]);
  const fetched = await fetchOfficialPlaylist(env, db);
  const item = fetched.items[0];
  if (!item) return json({ ok: false, error: 'youtube-video-not-found' }, 404);
  await cacheLatestYoutubeItem(db, item, { mode: fetched.mode }).catch(() => {});
  const releaseTitle = normalizeReleaseTitle(item.title);
  const releaseUrl = `https://www.youtube.com/watch?v=${encodeURIComponent(item.videoId)}`;
  await recordSystemLog(env, {
    scope: 'push', level: 'warning', event: 'manual-latest-retry-started',
    message: `Владелец запустил повторный push последнего видео «${releaseTitle}».`,
    details: { videoId: item.videoId, releaseUrl }
  }).catch(() => {});
  const result = await sendOneSignalPush(env, {
    title: `🎵 ${compactYoutubePushTitle(releaseTitle, 'Новый релиз')}`,
    message: 'Новый релиз ANDRIK уже доступен на YouTube',
    url: releaseUrl,
    image: item.thumbnail,
    webButtons: [{ id: 'listen-now', text: '▶️ Слушать на YouTube', url: releaseUrl }],
    audience: 'all',
    name: `retry-release-${item.videoId}-${Date.now()}`,
    history: { type: 'auto-release-retry', source: 'ANDRIK Control', videoId: item.videoId, videoTitle: releaseTitle }
  });
  await upsertReleaseHistory(db, {
    videoId: item.videoId, title: releaseTitle, url: releaseUrl, source: 'ANDRIK Control retry',
    pushStatus: result.ok ? 'sent' : (result.skipped ? 'skipped' : 'failed'), lyricsStatus: 'missing',
    publishedAt: item.publishedAt, details: { retry: true, error: result.error || '', oneSignalId: result.oneSignalId || '' }
  }).catch(() => {});
  if (result.ok) {
    await db.prepare(`
      INSERT INTO push_playlist_seen (video_id, title, published_at, first_seen_at)
      VALUES (?, ?, ?, datetime('now'))
      ON CONFLICT(video_id) DO UPDATE SET title = excluded.title, published_at = excluded.published_at
    `).bind(item.videoId, item.title, item.publishedAt).run();
  }
  return json({
    ok: result.ok,
    skipped: Boolean(result.skipped),
    error: result.error || '',
    oneSignalId: result.oneSignalId || '',
    video: { videoId: item.videoId, title: releaseTitle, url: releaseUrl, publishedAt: item.publishedAt },
    response: result.data || null
  }, result.ok ? 200 : 503);
}

async function handlePublicYoutubeLatest(_request, env) {
  if (!env.COMMENTS_DB) return json({ ok: false, error: 'backend-not-configured' }, 503, PUBLIC_CACHE_HEADERS);
  const db = env.COMMENTS_DB;
  await ensurePushAutomationSchema(db);
  let state = await getPushState(db, 'youtube-latest-public');
  let latest = parsePushSummary(state?.value);
  if (!latest?.videoId) {
    try {
      const fetched = await fetchOfficialPlaylist(env, db);
      if (fetched.items[0]) {
        await cacheLatestYoutubeItem(db, fetched.items[0], { mode: fetched.mode });
        state = await getPushState(db, 'youtube-latest-public');
        latest = parsePushSummary(state?.value);
      }
    } catch (_) {}
  }
  return json({ ok: Boolean(latest?.videoId), latest: latest?.videoId ? latest : null, updatedAt: state?.updatedAt || latest?.updatedAt || '' }, 200, PUBLIC_CACHE_HEADERS);
}

function formatDiagnosticDate(value) {
  if (!value) return '—';
  try { return new Date(value).toISOString(); }
  catch (_) { return String(value); }
}

async function handlePushDiagnosticLog(request, env) {
  if (!adminAuthorized(request, env)) return json({ ok: false, error: 'unauthorized' }, 401);
  const db = requireDb(env);
  await ensurePushAutomationSchema(db);
  const url = new URL(request.url);
  const limit = Math.max(10, Math.min(200, Number(url.searchParams.get('limit') || 100)));
  const [logsResult, historyResult, lastCheck, lastStatus, lastSummary, latestState, ownerDevices] = await Promise.all([
    db.prepare(`
      SELECT id, scope, level, event, message, details_json AS detailsJson, created_at AS createdAt
      FROM system_logs ORDER BY created_at DESC LIMIT ?
    `).bind(limit).all(),
    db.prepare(`
      SELECT id, type, source, audience, status, title, message, url, video_id AS videoId,
             video_title AS videoTitle, onesignal_id AS oneSignalId, recipients, error,
             details_json AS detailsJson, created_at AS createdAt
      FROM push_history ORDER BY created_at DESC LIMIT 40
    `).all(),
    getPushState(db, 'playlist-last-check-at'),
    getPushState(db, 'playlist-last-check-status'),
    getPushState(db, 'playlist-last-check-summary'),
    getPushState(db, 'youtube-latest-public'),
    db.prepare('SELECT COUNT(*) AS total FROM push_admin_devices').first()
  ]);
  const audienceCounts = await getPushAudienceCounts(env);
  const logs = (logsResult.results || []).map(row => ({ ...row, details: parsePushSummary(row.detailsJson), detailsJson: undefined }));
  const history = (historyResult.results || []).map(row => ({ ...row, recipients: Number(row.recipients || 0), details: parsePushSummary(row.detailsJson), detailsJson: undefined }));
  const reports = [];
  for (const row of history.filter(item => item.oneSignalId).slice(0, 5)) {
    const report = await fetchOneSignalMessageReport(env, row.oneSignalId).catch(error => ({ ok: false, error: String(error?.message || error) }));
    reports.push({ historyId: row.id, oneSignalId: row.oneSignalId, title: row.title, createdAt: row.createdAt, ...report });
  }
  const latest = parsePushSummary(latestState?.value);
  const lines = [
    'ANDRIK PUSH / YOUTUBE DIAGNOSTIC LOG v51.79',
    `Generated: ${new Date().toISOString()}`,
    '',
    '[CONFIG]',
    `OneSignal configured: ${oneSignalConfigured(env) ? 'YES' : 'NO'}`,
    `Owner devices registered in D1: ${Number(ownerDevices?.total || 0)}`,
    `Public push subscriptions active in D1: ${audienceCounts.public}`,
    `Total explicit broadcast audience: ${audienceCounts.total}`,
    `YouTube API configured: ${env.YOUTUBE_API_KEY ? 'YES' : 'NO'}`,
    `Channel: ${cleanPlainText(env.YOUTUBE_CHANNEL_HANDLE || '@andrikmetal', 100)}`,
    '',
    '[AUTOMATION]',
    `Last check: ${lastCheck?.value || '—'}`,
    `Last status: ${lastStatus?.value || '—'}`,
    `Summary: ${JSON.stringify(parsePushSummary(lastSummary?.value))}`,
    '',
    '[LATEST YOUTUBE]',
    latest?.videoId ? `${latest.title} | ${latest.publishedAt || '—'} | ${latest.url}` : 'No cached video',
    '',
    '[ONESIGNAL MESSAGE REPORTS]',
    ...(reports.length ? reports.map(item => `${item.createdAt || '—'} | ${item.oneSignalId} | ok=${item.ok} successful=${item.successful ?? '—'} received=${item.received ?? '—'} failed=${item.failed ?? '—'} errored=${item.errored ?? '—'} error=${typeof item.error === 'string' ? item.error : JSON.stringify(item.error || '')}`) : ['No messages with OneSignal id']),
    '',
    '[PUSH HISTORY]',
    ...history.map(item => `${item.createdAt || '—'} | ${item.status} | ${item.type} | ${item.audience} | video=${item.videoId || '—'} | onesignal=${item.oneSignalId || 'EMPTY'} | recipients=${item.recipients} | error=${item.error || '—'} | ${item.title || item.message || '—'}`),
    '',
    '[SYSTEM LOGS]',
    ...logs.map(item => `${item.createdAt || '—'} | ${String(item.level || 'info').toUpperCase()} | ${item.scope}/${item.event} | ${item.message} | ${JSON.stringify(item.details || {})}`)
  ];
  return json({ ok: true, generatedAt: new Date().toISOString(), latest, automation: { lastCheckAt: lastCheck?.value || '', status: lastStatus?.value || '', summary: parsePushSummary(lastSummary?.value) }, reports, history, logs, text: lines.join('\n') });
}


function formatSystemDateLabel(value) {
  if (!value) return '—';
  const parsed = new Date(value);
  if (!Number.isFinite(parsed.getTime())) return cleanPlainText(value, 50);
  return parsed.toISOString().replace('T', ' ').slice(0, 16) + ' UTC';
}

async function handleControlSystem(request, env) {
  if (!adminAuthorized(request, env)) return json({ ok: false, error: 'unauthorized' }, 401);
  const db = requireDb(env);
  const systemReadErrors=[];
  const safeRead=async(label,operation,fallback=null)=>{
    try{return await operation}
    catch(error){
      systemReadErrors.push(`${label}: ${cleanPlainText(error?.message || error,180)}`);
      return fallback;
    }
  };
  await Promise.allSettled([
    ensureCommentsV4Schema(db),
    ensureLyricsV2Schema(db),
    ensurePushAutomationSchema(db),
    ensureControlV1Schema(db),
    ensurePlatformAnalyticsSchema(db),
    ensureSecuritySchema(db),
    ensureSiteMetricsSchema(db)
  ]);
  const [lastCheck, lastStatus, lastSummary, seeded, uploadsPlaylist, ownerDevices, latestBackup, lastSeen, recentEvents, latestPush, dailySummaryAt, dailySummaryAttemptAt, dailySummaryAttemptStatus, dailySummaryAttemptError, latestSubscriberSeen, searchConsoleRow] = await Promise.all([
    safeRead('playlist-last-check-at',getPushState(db, 'playlist-last-check-at')),
    safeRead('playlist-last-check-status',getPushState(db, 'playlist-last-check-status')),
    safeRead('playlist-last-check-summary',getPushState(db, 'playlist-last-check-summary')),
    safeRead('playlist-seeded',getPushState(db, 'playlist-seeded')),
    safeRead('youtube-uploads-playlist-id',getPushState(db, 'youtube-uploads-playlist-id')),
    safeRead('push-admin-devices',db.prepare('SELECT COUNT(*) AS total FROM push_admin_devices').first(),{total:0}),
    safeRead('backup-history',db.prepare(`
      SELECT id, storage, status, row_count AS rowCount, size_bytes AS sizeBytes, created_at AS createdAt
      FROM backup_history ORDER BY created_at DESC LIMIT 1
    `).first()),
    safeRead('push-playlist-seen',db.prepare(`
      SELECT video_id AS videoId, title, published_at AS publishedAt, first_seen_at AS firstSeenAt
      FROM push_playlist_seen
      ORDER BY COALESCE(published_at, first_seen_at) DESC, first_seen_at DESC
      LIMIT 1
    `).first()),
    safeRead('recent-push-events',db.prepare(`
      SELECT type, source, audience, status, title, message, url, video_id AS videoId,
             recipients, error, created_at AS createdAt
      FROM push_history ORDER BY created_at DESC LIMIT 5
    `).all(),{results:[]}),
    safeRead('latest-push',db.prepare(`
      SELECT type, source, audience, status, title, message, url, video_id AS videoId,
             onesignal_id AS oneSignalId, recipients, error, created_at AS createdAt
      FROM push_history
      WHERE type <> 'owner-subscription'
      ORDER BY created_at DESC
      LIMIT 1
    `).first()),
    safeRead('daily-owner-summary-last-at',getPushState(db, 'daily-owner-summary-last-at')),
    safeRead('daily-owner-summary-last-attempt-at',getPushState(db, 'daily-owner-summary-last-attempt-at')),
    safeRead('daily-owner-summary-last-attempt-status',getPushState(db, 'daily-owner-summary-last-attempt-status')),
    safeRead('daily-owner-summary-last-attempt-error',getPushState(db, 'daily-owner-summary-last-attempt-error')),
    safeRead('latest-subscriber',db.prepare(`SELECT MAX(last_seen_at) AS lastSeenAt FROM push_subscribers WHERE status='active'`).first()),
    safeRead('search-console-snapshot',db.prepare(`SELECT metrics_json, created_at FROM platform_snapshots WHERE platform='google-search-console' ORDER BY created_at DESC LIMIT 1`).first())
  ]);
  const [centralCheck, centralStatus, centralSummary] = await Promise.all([
    safeRead('automation-last-check-at',getPushState(db, 'automation-last-check-at')),
    safeRead('automation-last-check-status',getPushState(db, 'automation-last-check-status')),
    safeRead('automation-last-check-summary',getPushState(db, 'automation-last-check-summary'))
  ]);
  const [nativeMonitorLastAt, nativeMonitorLastStatus, nativeMonitorTargetCount, nativeMonitorErrorCount, nativeMonitorWarningCount] = await Promise.all([
    safeRead('native-monitor-last-sync-at',getPushState(db, 'native-monitor-last-sync-at')),
    safeRead('native-monitor-last-status',getPushState(db, 'native-monitor-last-status')),
    safeRead('native-monitor-target-count',getPushState(db, 'native-monitor-target-count')),
    safeRead('native-monitor-error-count',getPushState(db, 'native-monitor-error-count')),
    safeRead('native-monitor-warning-count',getPushState(db, 'native-monitor-warning-count'))
  ]);
  const effectiveLastCheck = centralCheck?.value || '';
  const effectiveLastStatus = centralStatus?.value || 'never';
  const effectiveLastSummary = centralSummary?.value || '';
  const lastCheckMs = effectiveLastCheck ? Date.parse(effectiveLastCheck) : NaN;
  const ageMinutes = Number.isFinite(lastCheckMs) ? Math.max(0, Math.round((Date.now() - lastCheckMs) / 60000)) : null;
  const automationHealth = ageMinutes === null ? 'never' : ageMinutes <= 60 ? 'active' : ageMinutes <= 180 ? 'late' : 'stale';
  const oneSignalConfigured = Boolean(env.ONESIGNAL_APP_ID && (env.ONESIGNAL_REST_API_KEY || env.ONESIGNAL_APP_API_KEY));
  const analyticsConfigured = Boolean(String(env.GOOGLE_ANALYTICS_CREDENTIALS || '').trim());
  const searchConsoleCredentials = parseGoogleSearchConsoleCredentials(env);
  const searchConsoleSnapshot = parseSnapshotMetrics(searchConsoleRow);
  const searchConsoleConfigured = Boolean(searchConsoleCredentials && getGoogleSearchConsoleSiteUrl(env));
  const searchConsoleConnected = Boolean(searchConsoleRow && searchConsoleSnapshot.connected);
  const searchConsoleStatus = searchConsoleConnected ? 'good' : searchConsoleConfigured ? 'warning' : 'error';
  const searchConsoleLabel = searchConsoleConnected
    ? `Search Console подключён · ${Number(searchConsoleSnapshot.clicks || 0)} кликов · обновлено ${formatSystemDateLabel(searchConsoleRow.created_at)}`
    : searchConsoleConfigured
      ? `Ключ найден · выдайте доступ ${cleanPlainText(searchConsoleCredentials?.client_email || '',120)} к ${getGoogleSearchConsoleSiteUrl(env)}`
      : 'Search Console не настроен';
  const youtubeAuth = await safeRead(
    'youtube-auth-status',
    youtubeAutomaticAuthStatus(env),
    {configured:false,clientConfigured:false,refreshTokenConfigured:false,source:'unavailable'}
  );
  const audienceCounts = await safeRead(
    'push-audience',
    getPushAudienceCounts(env),
    {public:0,owners:0,total:0}
  );
  const ownerDeviceCount = Number(ownerDevices?.total || 0);
  const latestPushSent = Boolean(latestPush && latestPush.status === 'sent');
  const latestPushHasError = Boolean(cleanPlainText(latestPush?.error || '', 240));
  const lastPushFailed = Boolean(latestPush && !latestPushSent);
  /* R87: a push marked sent without an error is successful even when a service event
     does not create a OneSignal message ID. Service subscription events are excluded
     from the latest real push query above, so they can never paint the dashboard red. */
  const lastPushAccepted = Boolean(latestPush && latestPushSent && !latestPushHasError);
  const latestSubscriberMs = Date.parse(latestSubscriberSeen?.lastSeenAt || '');
  const latestPushMs = Date.parse(latestPush?.createdAt || '');
  const recoveredAfterFailure = Boolean(lastPushFailed && audienceCounts.total > 0 && Number.isFinite(latestSubscriberMs) && Number.isFinite(latestPushMs) && latestSubscriberMs > latestPushMs);
  const oneSignalStatus = !oneSignalConfigured ? 'warning' : recoveredAfterFailure || lastPushAccepted || audienceCounts.total > 0 ? 'good' : lastPushFailed ? 'error' : 'warning';
  const oneSignalLabel = !oneSignalConfigured
    ? 'OneSignal не настроен'
    : recoveredAfterFailure
      ? `API подключён · подписчики переподключены после старой ошибки · устройств: ${audienceCounts.total}`
      : lastPushFailed
        ? `Последняя отправка с ошибкой: ${cleanPlainText(latestPush.error || 'неизвестная ошибка', 120)}`
        : lastPushAccepted
          ? latestPush.oneSignalId
            ? `OneSignal принял отправку · ID ${cleanPlainText(latestPush.oneSignalId, 36)}`
            : `Отправка выполнена без ошибки · ${formatSystemDateLabel(latestPush.createdAt)}`
          : audienceCounts.total > 0
            ? `API подключён · зарегистрировано устройств: ${audienceCounts.total}`
            : 'API подключён · активные устройства ещё не зарегистрированы';
  const historicalAudienceMiss = Boolean(latestPush?.error === 'no-subscribers-matched' && audienceCounts.total > 0);
  /* R89: an old no-subscriber attempt is considered recovered as soon as an active
     audience exists. It remains available in diagnostics, but must not keep the
     service dashboard at 12/13 or paint a healthy system yellow. */
  const pushRecovered = Boolean(recoveredAfterFailure || historicalAudienceMiss);
  const latestPushStatus = !latestPush ? 'warning' : lastPushAccepted || pushRecovered ? 'good' : 'error';
  const latestPushLabel = !latestPush
    ? 'Отправок пока не было'
    : pushRecovered
      ? `Подписчики актуальны · старая попытка закрыта · ${formatSystemDateLabel(latestPush.createdAt)}`
      : latestPushStatus === 'good'
        ? latestPush.oneSignalId
          ? `${cleanPlainText(latestPush.title || latestPush.type || 'Push', 80)} · принят OneSignal ${formatSystemDateLabel(latestPush.createdAt)}`
          : `${cleanPlainText(latestPush.title || latestPush.type || 'Push', 80)} · выполнен без ошибки ${formatSystemDateLabel(latestPush.createdAt)}`
        : `${cleanPlainText(latestPush.error || 'Push не отправлен', 120)} · ${formatSystemDateLabel(latestPush.createdAt)}`;
  const backupStatus = !getBackupBucket(env) ? 'warning' : latestBackup?.status === 'failed' ? 'error' : latestBackup?.status === 'completed' ? 'good' : 'warning';
  const backupLabel = !getBackupBucket(env)
    ? 'R2 не подключено · используется резерв D1'
    : latestBackup?.status === 'completed'
      ? `R2 работает · последняя копия ${formatSystemDateLabel(latestBackup.createdAt)}`
      : latestBackup?.status === 'failed'
        ? 'Последняя резервная копия завершилась ошибкой'
        : 'R2 подключено · копий пока нет';
  const dailySummaryReady = oneSignalConfigured && ownerDeviceCount > 0 && automationHealth === 'active';
  const dailySummaryLabel = !oneSignalConfigured
    ? 'Сводки 05:00 / 17:00 ожидают настройки OneSignal'
    : ownerDeviceCount < 1
      ? 'Сводки 05:00 / 17:00 ожидают регистрацию устройства владельца'
      : automationHealth !== 'active'
        ? 'Сводки 05:00 / 17:00 ожидают стабильный Центральный Cron'
        : dailySummaryAt?.value
          ? `Каждый день в 05:00 и 17:00 · последняя ${formatSystemDateLabel(dailySummaryAt.value)}`
          : 'Каждый день в 05:00 и 17:00 · ожидает первой сводки';
  return json({
    ok: true,
    version: ANDRIK_CONTROL_RELEASE.full,
    services: {
      site: { configured: true, status: 'good', label: 'Основной сайт и Control открываются' },
      worker: { configured: true, status: 'good', label: 'Cloudflare Worker отвечает · API v54.76' },
      database: {
        configured:true,
        status:systemReadErrors.length?'warning':'good',
        label:systemReadErrors.length
          ? `D1 отвечает частично · недоступно проверок: ${systemReadErrors.length}`
          : 'D1 подключена и отвечает'
      },
      oneSignal: { configured: oneSignalConfigured, status: oneSignalStatus, ownerDevices: ownerDeviceCount, audience: audienceCounts, label: oneSignalLabel, note: 'Массовая рассылка использует явные subscription ID из D1' },
      pushAudience: { configured: audienceCounts.total > 0, status: audienceCounts.total > 0 ? 'good' : 'warning', counts: audienceCounts, label: `Общая аудитория: ${audienceCounts.total} · слушателей: ${audienceCounts.public} · владельцев: ${audienceCounts.owners}` },
      lastPush: { configured: Boolean(latestPush), status: latestPushStatus, latest: latestPush || null, label: latestPushLabel },
      youtube: { configured: Boolean(env.YOUTUBE_API_KEY), studioConfigured:youtubeAuth.configured, status: env.YOUTUBE_API_KEY && youtubeAuth.configured ? 'good' : 'warning', mode: youtubeAuth.configured ? 'YouTube Data API + Studio Worker' : (env.YOUTUBE_API_KEY ? 'YouTube Data API' : 'XML feed'), handle: cleanPlainText(env.YOUTUBE_CHANNEL_HANDLE || '@andrikmetal', 100), uploadsPlaylistId: uploadsPlaylist?.value || cleanPlainText(env.YOUTUBE_UPLOADS_PLAYLIST_ID, 100), label: youtubeAuth.configured ? `YouTube Data API + Studio автоматически · ${youtubeAuth.source}` : (env.YOUTUBE_API_KEY ? 'Data API работает · Studio ждёт серверный refresh token' : 'YouTube работает через резервный feed') },
      cron: { configured: Boolean(env.CRON_SECRET), status: automationHealth === 'active' ? 'good' : automationHealth === 'stale' ? 'error' : 'warning', health: automationHealth, lastCheckAt: effectiveLastCheck, ageMinutes, lastStatus: effectiveLastStatus, summary: parsePushSummary(effectiveLastSummary), label: automationHealth === 'active' ? `Центральный Cron активен · ${ageMinutes} мин. назад` : automationHealth === 'never' ? 'Центральный Cron ещё не запускался' : `Центральный Cron требует проверки · ${ageMinutes ?? '—'} мин. без запуска` },
      dailySummary: {
        configured:dailySummaryReady,
        status:dailySummaryAttemptStatus?.value === 'failed'
          ? 'error'
          : (dailySummaryReady ? 'good' : 'warning'),
        lastSentAt:dailySummaryAt?.value || '',
        lastAttemptAt:dailySummaryAttemptAt?.value || '',
        lastAttemptStatus:dailySummaryAttemptStatus?.value || '',
        lastAttemptError:dailySummaryAttemptError?.value || '',
        schedule:'05:00 / 17:00 Europe/Bratislava · быстрая проверка каждые 5 минут + догон',
        label:dailySummaryAttemptStatus?.value === 'failed'
          ? `Последняя попытка не удалась: ${dailySummaryAttemptError?.value || 'ошибка отправки'}`
          : dailySummaryLabel
      },
      backups: { configured: Boolean(getBackupBucket(env)), status: backupStatus, latest: latestBackup || null, label: backupLabel },
      analytics: { configured: analyticsConfigured, status: analyticsConfigured ? 'good' : 'optional', label: analyticsConfigured ? 'Google Analytics Data API подключён' : 'Аналитика сайта отложена' },
      searchConsole: { configured:searchConsoleConfigured, connected:searchConsoleConnected, status:searchConsoleStatus, serviceAccountEmail:cleanPlainText(searchConsoleCredentials?.client_email || '',180), siteUrl:getGoogleSearchConsoleSiteUrl(env), label:searchConsoleLabel },
      nativeMonitor: {
        configured:true,
        status:nativeMonitorLastStatus?.value==='error'?'error':nativeMonitorLastStatus?.value==='good'?'good':'warning',
        lastSyncAt:nativeMonitorLastAt?.value || '',
        monitorCount:Number(nativeMonitorTargetCount?.value || 0),
        errorCount:Number(nativeMonitorErrorCount?.value || 0),
        warningCount:Number(nativeMonitorWarningCount?.value || 0),
        label:nativeMonitorLastStatus?.value==='good'
          ? `Все точки доступны · ${Number(nativeMonitorTargetCount?.value || 0)} проверки · ${formatSystemDateLabel(nativeMonitorLastAt?.value)}`
          : nativeMonitorLastStatus?.value==='error'
            ? `Недоступных точек: ${Number(nativeMonitorErrorCount?.value || 0)} · ${formatSystemDateLabel(nativeMonitorLastAt?.value)}`
            : nativeMonitorLastAt?.value
              ? `Предупреждений: ${Number(nativeMonitorWarningCount?.value || 0)} · ${formatSystemDateLabel(nativeMonitorLastAt?.value)}`
              : 'Ожидает первой встроенной проверки'
      }
    },
    automation: {
      seeded: Boolean(seeded?.value),
      health: automationHealth,
      lastCheckAt: effectiveLastCheck,
      lastStatus: effectiveLastStatus,
      summary: parsePushSummary(effectiveLastSummary)
    },
    lastSeenVideo: lastSeen || null,
    recentEvents: recentEvents?.results || [],
    partial:Boolean(systemReadErrors.length),
    readErrors:systemReadErrors,
    updatedAt: new Date().toISOString()
  });
}

function getCommentsGoogleClientId(env) {
  return String(env.COMMENTS_GOOGLE_CLIENT_ID || env.YOUTUBE_OAUTH_CLIENT_ID || '').trim();
}

async function verifyGoogleCommentToken(rawToken, env) {
  const clientId = getCommentsGoogleClientId(env);
  const token = cleanPlainText(rawToken, 6000);
  if (!clientId) return { ok: false, error: 'google-auth-not-configured' };
  if (!token) return { ok: false, error: 'google-token-required' };
  const response = await fetch(`https://oauth2.googleapis.com/tokeninfo?id_token=${encodeURIComponent(token)}`, {
    headers: { accept: 'application/json' }
  });
  if (!response.ok) return { ok: false, error: 'google-token-invalid' };
  const data = await response.json().catch(() => ({}));
  const aud = String(data.aud || '').trim();
  const iss = String(data.iss || '').trim();
  const expMs = Number(data.exp || 0) * 1000;
  if (aud !== clientId) return { ok: false, error: 'google-token-audience' };
  if (iss && iss !== 'https://accounts.google.com' && iss !== 'accounts.google.com') return { ok: false, error: 'google-token-issuer' };
  if (expMs && expMs < Date.now() - 30000) return { ok: false, error: 'google-token-expired' };
  const profile = {
    sub: cleanPlainText(data.sub, 128),
    name: cleanPlainText(data.name, 80),
    email: cleanPlainText(data.email, 160),
    picture: cleanPlainText(data.picture, 500),
    emailVerified: String(data.email_verified || '').toLowerCase() === 'true' || String(data.email_verified || '') === '1',
    exp: expMs || Date.now() + 3600000
  };
  if (!profile.sub) return { ok: false, error: 'google-token-sub' };
  return { ok: true, profile };
}

async function handleCommentsGoogleSession(request, env) {
  if (!isSameOrigin(request)) return json({ ok: false, error: 'origin-not-allowed' }, 403);
  let body;
  try { body = await readJsonBody(request); }
  catch (_) { return json({ ok: false, error: 'invalid-json' }, 400); }
  const verified = await verifyGoogleCommentToken(body.credential, env);
  if (!verified.ok) return json({ ok: false, error: verified.error }, 401);
  return json({ ok: true, profile: verified.profile });
}

async function handleCommentsConfig(_request, env) {
  return json({
    moderation: true,
    turnstileSiteKey: String(env.TURNSTILE_SITE_KEY || ''),
    publicComments: Boolean(env.COMMENTS_DB),
    googleClientId: getCommentsGoogleClientId(env),
    googleAuthEnabled: Boolean(getCommentsGoogleClientId(env)),
    subjects: COMMENT_SUBJECTS
  }, 200, PUBLIC_CACHE_HEADERS);
}

async function handlePublicComments(request, env) {
  const db = requireDb(env);
  await ensureCommentsV4Schema(db);
  const url = new URL(request.url);
  const limit = Math.max(1, Math.min(100, Number(url.searchParams.get('limit') || 24)));
  const viewerToken = cleanVisitorToken(url.searchParams.get('viewer'));
  const viewerHash = await hashVisitorToken(viewerToken, env, 'like');
  const reporterHash = await hashVisitorToken(viewerToken, env, 'report');
  const song = cleanPlainText(url.searchParams.get('song'), 80).toLowerCase();
  const query = cleanPlainText(url.searchParams.get('q'), 80);
  const where = [`c.status = 'approved'`];
  const binds = [viewerHash, viewerHash, reporterHash, reporterHash];
  if (song) {
    where.push('c.song_slug = ?');
    binds.push(song);
  }
  if (query) {
    const pattern = `%${query.replace(/[%_]/g, '')}%`;
    where.push('(c.name LIKE ? OR c.message LIKE ? OR c.song_title LIKE ?)');
    binds.push(pattern, pattern, pattern);
  }
  binds.push(limit);

  const topCount = Number(await db.prepare(`
    SELECT MAX(author_total) AS topCount FROM (
      SELECT COUNT(*) AS author_total
      FROM comments
      WHERE status = 'approved' AND author_hash <> ''
      GROUP BY author_hash
    )
  `).first('topCount') || 0);

  const result = await db.prepare(`
    SELECT
      c.id,
      c.name,
      c.message,
      c.locale,
      c.created_at AS createdAt,
      c.is_pinned AS isPinned,
      c.pinned_at AS pinnedAt,
      c.owner_reply AS ownerReply,
      c.owner_reply_at AS ownerReplyAt,
      c.song_slug AS songSlug,
      c.song_title AS songTitle,
      (SELECT COUNT(*) FROM comment_likes l WHERE l.comment_id = c.id) AS likeCount,
      (SELECT COUNT(*) FROM comment_reports r WHERE r.comment_id = c.id) AS reportCount,
      CASE
        WHEN ? <> '' AND EXISTS (
          SELECT 1 FROM comment_likes own_like
          WHERE own_like.comment_id = c.id AND own_like.voter_hash = ?
        ) THEN 1 ELSE 0
      END AS likedByViewer,
      CASE
        WHEN ? <> '' AND EXISTS (
          SELECT 1 FROM comment_reports own_report
          WHERE own_report.comment_id = c.id AND own_report.reporter_hash = ?
        ) THEN 1 ELSE 0
      END AS reportedByViewer,
      CASE
        WHEN c.author_hash <> '' THEN (
          SELECT COUNT(*) FROM comments author_comment
          WHERE author_comment.status = 'approved' AND author_comment.author_hash = c.author_hash
        )
        ELSE 1
      END AS authorCount
    FROM comments c
    WHERE ${where.join(' AND ')}
    ORDER BY c.is_pinned DESC, COALESCE(c.pinned_at, c.created_at) DESC, c.created_at DESC
    LIMIT ?
  `).bind(...binds).all();
  const comments = (result.results || []).map(item => {
    const authorCount = Math.max(1, Number(item.authorCount || 1));
    return {
      ...item,
      isPinned: Boolean(item.isPinned),
      likedByViewer: Boolean(item.likedByViewer),
      reportedByViewer: Boolean(item.reportedByViewer),
      likeCount: Number(item.likeCount || 0),
      reportCount: Number(item.reportCount || 0),
      authorCount,
      isTopCommenter: topCount >= 3 && authorCount === topCount
    };
  });
  return json({ ok: true, comments, subjects: COMMENT_SUBJECTS });
}

async function handleSubmitComment(request, env, ctx) {
  if (!isSameOrigin(request)) return json({ ok: false, error: 'origin-not-allowed' }, 403);
  const db = requireDb(env);
  await ensureCommentsV4Schema(db);
  await ensureSecuritySchema(db);
  const burstLimit = await securityRateLimit(db, request, env, 'comment-submit-10m', 6, 600, 'comment-rate-limit');
  const dayLimit = await securityRateLimit(db, request, env, 'comment-submit-day', 20, 86400, 'comment-rate-limit');
  if (!burstLimit.allowed || !dayLimit.allowed) return json({ ok:false, error:'rate-limit' }, 429);
  let body;
  try { body = await readJsonBody(request); }
  catch (error) { return json({ ok: false, error: error.message === 'payload-too-large' ? 'payload-too-large' : 'invalid-json' }, 400); }

  const honeypot = cleanPlainText(body.website, 160);
  if (honeypot) {
    await recordSecurityEvent(db, request, env, 'honeypot', 'Поле website заполнено.');
    return json({ ok:true, status:'pending' }, 202);
  }

  const locale = cleanPlainText(body.locale, 8) || 'ru';
  const message = cleanPlainText(body.message, 1200);
  const visitorToken = cleanVisitorToken(body.visitorId);
  const subject = getCommentSubject(body.song || 'project');
  const googleToken = cleanPlainText(body.googleIdToken, 6000);
  const googleAuth = googleToken ? await verifyGoogleCommentToken(googleToken, env) : null;
  if (googleAuth && !googleAuth.ok) return json({ ok: false, error: googleAuth.error }, 401);
  const resolvedName = googleAuth?.ok ? (cleanPlainText(googleAuth.profile.name, 48) || cleanPlainText(String(googleAuth.profile.email || '').split('@')[0], 48)) : cleanPlainText(body.name, 48);
  const authorToken = googleAuth?.ok ? `google:${googleAuth.profile.sub}` : visitorToken;
  const authorHash = await hashVisitorToken(authorToken, env, 'author');
  if (resolvedName.length < 2 || message.length < 3) return json({ ok: false, error: 'validation' }, 400);

  if (!googleAuth?.ok) {
    const turnstile = await verifyTurnstile(cleanPlainText(body.turnstileToken, 2200), request, env);
    if (!turnstile.success) {
      await recordSecurityEvent(db, request, env, 'turnstile-failed', turnstile.error);
      return json({ ok:false, error:turnstile.error }, 400);
    }
  }

  const ip = getClientIp(request);
  const salt = String(env.COMMENTS_HASH_SALT || 'andrik-comments');
  const ipHash = await sha256Hex(`${salt}:${ip}`);
  const messageHash = await sha256Hex(`${subject.slug}:${normalizeWhitespace(message)}`);
  const userAgentHash = await sha256Hex(`${salt}:${request.headers.get('user-agent') || ''}`);

  const recent10m = await db.prepare(`SELECT COUNT(*) AS count FROM comments WHERE ip_hash = ? AND created_at >= datetime('now', '-10 minutes')`).bind(ipHash).first('count');
  const recentDay = await db.prepare(`SELECT COUNT(*) AS count FROM comments WHERE ip_hash = ? AND created_at >= datetime('now', '-1 day')`).bind(ipHash).first('count');
  if (Number(recent10m || 0) >= 3 || Number(recentDay || 0) >= 12) {
    await recordSecurityEvent(db, request, env, 'comment-rate-limit', `${recent10m || 0}/10m · ${recentDay || 0}/day`);
    return json({ ok:false, error:'rate-limit' }, 429);
  }

  const duplicate = await db.prepare(`SELECT id FROM comments WHERE ip_hash = ? AND message_hash = ? AND created_at >= datetime('now', '-1 day') LIMIT 1`).bind(ipHash, messageHash).first();
  if (duplicate) return json({ ok: true, status: 'pending', duplicate: true }, 202);

  const spamScore = calculateSpamScore(resolvedName, message, env.COMMENTS_BLOCKLIST);
  const rejectScore = Math.max(8, Number(env.COMMENTS_SPAM_REJECT_SCORE || 12));
  if (!googleAuth?.ok && spamScore >= rejectScore) {
    await recordSecurityEvent(db, request, env, 'spam-block', `score=${spamScore}`);
    return json({ ok:true, status:'pending' }, 202);
  }
  const id = crypto.randomUUID();
  const initialStatus = googleAuth?.ok ? 'approved' : 'pending';
  await db.prepare(`
    INSERT INTO comments (
      id, name, message, locale, status, created_at, updated_at,
      ip_hash, user_agent_hash, message_hash, spam_score, author_hash, song_slug, song_title
    )
    VALUES (?, ?, ?, ?, ?, datetime('now'), datetime('now'), ?, ?, ?, ?, ?, ?, ?)
  `).bind(
    id, resolvedName, message, locale, initialStatus, ipHash, userAgentHash, messageHash, spamScore,
    authorHash, subject.slug, subject.title
  ).run();

  const subjectPrefix = subject.title ? `🎵 ${subject.title} · ` : '';
  const commentAdminUrl = googleAuth?.ok ? 'https://control.andrikmetal.com/comments-admin.html?status=approved' : `https://control.andrikmetal.com/comments-admin.html?status=pending&focus=${encodeURIComponent(id)}`;
  const commentPushOnce = await claimPushOnce(db, `push-once:site-comment:${id}`, new Date().toISOString());
  const ownerNotice = commentPushOnce ? sendOwnerPush(env, {
    title: googleAuth?.ok ? '💬 Новый комментарий на сайте' : '💬 Новое сообщение на сайте',
    message: googleAuth?.ok ? `${subjectPrefix}${resolvedName}: ${message.slice(0, 140)}` : `Разместить или удалить? ${subjectPrefix}${resolvedName}: ${message.slice(0, 115)}`,
    url: commentAdminUrl,
    name: `site-comment-${id}`,
    webButtons: [{ id:'open-comments', text:'💬 Открыть', url:commentAdminUrl }],
    history: {
      type: googleAuth?.ok ? 'comment-live' : 'comment-pending',
      source: subject.title || 'Комментарии ANDRIK',
      audience: 'owner'
    }
  }) : Promise.resolve({ ok:true, skipped:true, duplicate:true });
  if (ctx?.waitUntil) ctx.waitUntil(ownerNotice); else await ownerNotice;

  return json({ ok: true, status: initialStatus, id }, googleAuth?.ok ? 200 : 202);
}

async function handleAdminCommentsGet(request, env) {
  if (!adminAuthorized(request, env)) return json({ ok: false, error: 'unauthorized' }, 401);
  const db = requireDb(env);
  await ensureCommentsV4Schema(db);
  const url = new URL(request.url);
  const status = ['pending', 'approved', 'rejected'].includes(url.searchParams.get('status')) ? url.searchParams.get('status') : 'pending';
  const topCount = Number(await db.prepare(`
    SELECT MAX(author_total) AS topCount FROM (
      SELECT COUNT(*) AS author_total FROM comments
      WHERE status = 'approved' AND author_hash <> '' GROUP BY author_hash
    )
  `).first('topCount') || 0);
  const result = await db.prepare(`
    SELECT
      c.id,
      c.name,
      c.message,
      c.locale,
      c.status,
      c.created_at AS createdAt,
      c.updated_at AS updatedAt,
      c.spam_score AS spamScore,
      c.moderation_note AS moderationNote,
      c.is_pinned AS isPinned,
      c.pinned_at AS pinnedAt,
      c.owner_reply AS ownerReply,
      c.owner_reply_at AS ownerReplyAt,
      c.song_slug AS songSlug,
      c.song_title AS songTitle,
      (SELECT COUNT(*) FROM comment_likes l WHERE l.comment_id = c.id) AS likeCount,
      (SELECT COUNT(*) FROM comment_reports r WHERE r.comment_id = c.id) AS reportCount,
      SUBSTR((SELECT GROUP_CONCAT(NULLIF(r.reason, ''), ' • ') FROM comment_reports r WHERE r.comment_id = c.id), 1, 600) AS reportReasons,
      CASE
        WHEN c.author_hash <> '' THEN (
          SELECT COUNT(*) FROM comments author_comment
          WHERE author_comment.status = 'approved' AND author_comment.author_hash = c.author_hash
        )
        ELSE 1
      END AS authorCount
    FROM comments c
    WHERE c.status = ?
    ORDER BY c.is_pinned DESC, COALESCE(c.pinned_at, c.created_at) DESC, c.created_at DESC
    LIMIT 250
  `).bind(status).all();
  const comments = (result.results || []).map(item => {
    const authorCount = Math.max(1, Number(item.authorCount || 1));
    return {
      ...item,
      isPinned: Boolean(item.isPinned),
      likeCount: Number(item.likeCount || 0),
      reportCount: Number(item.reportCount || 0),
      authorCount,
      isTopCommenter: topCount >= 3 && authorCount === topCount
    };
  });
  const rawStats = await db.prepare(`
    SELECT
      COUNT(*) AS total,
      SUM(CASE WHEN status = 'pending' THEN 1 ELSE 0 END) AS pending,
      SUM(CASE WHEN status = 'approved' THEN 1 ELSE 0 END) AS approved,
      SUM(CASE WHEN status = 'rejected' THEN 1 ELSE 0 END) AS rejected,
      SUM(CASE WHEN is_pinned = 1 THEN 1 ELSE 0 END) AS pinned,
      SUM(CASE WHEN owner_reply <> '' THEN 1 ELSE 0 END) AS replied,
      (SELECT COUNT(*) FROM comment_likes) AS totalLikes,
      (SELECT COUNT(*) FROM comment_reports) AS totalReports
    FROM comments
  `).first() || {};
  const stats = Object.fromEntries(Object.entries(rawStats).map(([key, value]) => [key, Number(value || 0)]));
  return json({ ok: true, comments, stats, subjects: COMMENT_SUBJECTS });
}

async function handleAdminCommentsPost(request, env, ctx) {
  if (!adminAuthorized(request, env)) return json({ ok: false, error: 'unauthorized' }, 401);
  const db = requireDb(env);
  await ensureCommentsV4Schema(db);
  let body;
  try { body = await readJsonBody(request); }
  catch (_) { return json({ ok: false, error: 'invalid-json' }, 400); }
  const id = cleanPlainText(body.id, 64);
  const action = cleanPlainText(body.action, 24);
  const note = cleanPlainText(body.note, 240);
  const reply = cleanPlainText(body.reply, 1200);
  const notify = body.notify === true;
  const allowedActions = ['approve', 'reject', 'delete', 'pin', 'unpin', 'save_reply', 'clear_reply', 'clear_reports'];
  if (!id || !allowedActions.includes(action)) return json({ ok: false, error: 'validation' }, 400);

  const existing = await db.prepare(`
    SELECT id, name, message, status, is_pinned AS isPinned, owner_reply AS ownerReply,
           song_slug AS songSlug, song_title AS songTitle
    FROM comments WHERE id = ? LIMIT 1
  `).bind(id).first();
  if (!existing) return json({ ok: false, error: 'not-found' }, 404);

  if (action === 'delete') {
    await db.prepare('DELETE FROM comment_likes WHERE comment_id = ?').bind(id).run();
    await db.prepare('DELETE FROM comment_reports WHERE comment_id = ?').bind(id).run();
    await db.prepare('DELETE FROM comments WHERE id = ?').bind(id).run();
  } else if (action === 'approve' || action === 'reject') {
    const status = action === 'approve' ? 'approved' : 'rejected';
    await db.prepare(`
      UPDATE comments
      SET status = ?, moderation_note = ?,
          is_pinned = CASE WHEN ? = 'approved' THEN is_pinned ELSE 0 END,
          pinned_at = CASE WHEN ? = 'approved' THEN pinned_at ELSE NULL END,
          updated_at = datetime('now')
      WHERE id = ?
    `).bind(status, note, status, status, id).run();
    if (action === 'approve' && notify) {
      const subjectPrefix = existing.songTitle ? `🎵 ${existing.songTitle} · ` : '';
      const publicNotice = sendOneSignalPush(env, {
        title: 'Новый отзыв на ANDRIK',
        message: `${subjectPrefix}${existing.name}: ${String(existing.message || '').slice(0, 140)}`,
        url: existing.songSlug ? `https://andrikmetal.com/comments.html?song=${encodeURIComponent(existing.songSlug)}` : 'https://andrikmetal.com/comments.html',
        audience: 'all',
        name: `comment-approved-${id}`,
        history: {
          type: 'comment-approved',
          source: existing.songTitle || 'Комментарии ANDRIK'
        }
      });
      if (ctx?.waitUntil) ctx.waitUntil(publicNotice); else await publicNotice;
    }
  } else if (action === 'pin') {
    if (existing.status !== 'approved') return json({ ok: false, error: 'comment-not-approved' }, 409);
    await db.prepare(`UPDATE comments SET is_pinned = 1, pinned_at = datetime('now'), updated_at = datetime('now') WHERE id = ?`).bind(id).run();
  } else if (action === 'unpin') {
    await db.prepare(`UPDATE comments SET is_pinned = 0, pinned_at = NULL, updated_at = datetime('now') WHERE id = ?`).bind(id).run();
  } else if (action === 'save_reply') {
    if (!reply) return json({ ok: false, error: 'reply-required' }, 400);
    await db.prepare(`UPDATE comments SET owner_reply = ?, owner_reply_at = datetime('now'), updated_at = datetime('now') WHERE id = ?`).bind(reply, id).run();
  } else if (action === 'clear_reply') {
    await db.prepare(`UPDATE comments SET owner_reply = '', owner_reply_at = NULL, updated_at = datetime('now') WHERE id = ?`).bind(id).run();
  } else if (action === 'clear_reports') {
    await db.prepare(`DELETE FROM comment_reports WHERE comment_id = ?`).bind(id).run();
  }
  return json({ ok: true, action });
}

async function handleCommentLike(request, env) {
  if (!isSameOrigin(request)) return json({ ok: false, error: 'origin-not-allowed' }, 403);
  const db = requireDb(env);
  await ensureCommentsV4Schema(db);
  await ensureSecuritySchema(db);
  const minuteLimit = await securityRateLimit(db, request, env, 'comment-like-minute', 30, 60, 'comment-like-rate-limit');
  const dayLimit = await securityRateLimit(db, request, env, 'comment-like-day', 300, 86400, 'comment-like-rate-limit');
  if (!minuteLimit.allowed || !dayLimit.allowed) return json({ ok:false, error:'rate-limit' }, 429);
  let body;
  try { body = await readJsonBody(request); }
  catch (_) { return json({ ok: false, error: 'invalid-json' }, 400); }
  const id = cleanPlainText(body.id, 64);
  const viewerToken = cleanVisitorToken(body.viewerId);
  if (!id || !viewerToken) return json({ ok: false, error: 'validation' }, 400);
  const comment = await db.prepare(`SELECT id FROM comments WHERE id = ? AND status = 'approved' LIMIT 1`).bind(id).first();
  if (!comment) return json({ ok: false, error: 'not-found' }, 404);
  const voterHash = await hashVisitorToken(viewerToken, env, 'like');
  const existing = await db.prepare(`SELECT 1 AS found FROM comment_likes WHERE comment_id = ? AND voter_hash = ? LIMIT 1`).bind(id, voterHash).first();
  let liked;
  if (existing) {
    await db.prepare(`DELETE FROM comment_likes WHERE comment_id = ? AND voter_hash = ?`).bind(id, voterHash).run();
    liked = false;
  } else {
    await db.prepare(`INSERT INTO comment_likes (comment_id, voter_hash, created_at) VALUES (?, ?, datetime('now'))`).bind(id, voterHash).run();
    liked = true;
  }
  const count = Number(await db.prepare(`SELECT COUNT(*) AS count FROM comment_likes WHERE comment_id = ?`).bind(id).first('count') || 0);
  return json({ ok: true, liked, likeCount: count });
}


async function handleCommentReport(request, env, ctx) {
  if (!isSameOrigin(request)) return json({ ok: false, error: 'origin-not-allowed' }, 403);
  const db = requireDb(env);
  await ensureCommentsV4Schema(db);
  await ensureSecuritySchema(db);
  const hourLimit = await securityRateLimit(db, request, env, 'comment-report-hour', 6, 3600, 'comment-report-rate-limit');
  const dayLimit = await securityRateLimit(db, request, env, 'comment-report-day', 20, 86400, 'comment-report-rate-limit');
  if (!hourLimit.allowed || !dayLimit.allowed) return json({ ok:false, error:'rate-limit' }, 429);
  let body;
  try { body = await readJsonBody(request); }
  catch (_) { return json({ ok: false, error: 'invalid-json' }, 400); }
  const id = cleanPlainText(body.id, 64);
  const viewerToken = cleanVisitorToken(body.viewerId);
  const reason = cleanPlainText(body.reason, 240);
  if (!id || !viewerToken) return json({ ok: false, error: 'validation' }, 400);
  const comment = await db.prepare(`SELECT id, name, message FROM comments WHERE id = ? AND status = 'approved' LIMIT 1`).bind(id).first();
  if (!comment) return json({ ok: false, error: 'not-found' }, 404);
  const reporterHash = await hashVisitorToken(viewerToken, env, 'report');
  const inserted = await db.prepare(`
    INSERT OR IGNORE INTO comment_reports (comment_id, reporter_hash, reason, created_at)
    VALUES (?, ?, ?, datetime('now'))
  `).bind(id, reporterHash, reason).run();
  const reportCount = Number(await db.prepare(`SELECT COUNT(*) AS count FROM comment_reports WHERE comment_id = ?`).bind(id).first('count') || 0);
  const created = Number(inserted?.meta?.changes || 0) > 0;
  if (created) {
    const ownerNotice = sendOwnerPush(env, {
      title: 'Жалоба на отзыв ANDRIK',
      message: `${comment.name}: ${String(comment.message || '').slice(0, 105)}${reason ? ` · Причина: ${reason.slice(0, 70)}` : ''}`,
      url: 'https://control.andrikmetal.com/',
      name: `comment-report-${id}-${reporterHash.slice(0, 12)}`,
      history: {
        type: 'report-owner',
        source: 'Жалобы сообщества',
        audience: 'owner'
      }
    });
    if (ctx?.waitUntil) ctx.waitUntil(ownerNotice); else await ownerNotice;
  }
  return json({ ok: true, reported: true, reportCount, created });
}



const YOUTUBE_CAPTION_HEADERS = {
  'content-type': 'application/json; charset=utf-8',
  'cache-control': 'public, max-age=900, s-maxage=3600, stale-while-revalidate=86400',
  'x-content-type-options': 'nosniff'
};

function extractJsonArrayAfterKey(source, key) {
  const marker = `"${key}":`;
  const markerIndex = source.indexOf(marker);
  if (markerIndex < 0) return null;
  const start = source.indexOf('[', markerIndex + marker.length);
  if (start < 0) return null;
  let depth = 0;
  let inString = false;
  let escaped = false;
  for (let index = start; index < source.length; index += 1) {
    const char = source[index];
    if (inString) {
      if (escaped) escaped = false;
      else if (char === '\\') escaped = true;
      else if (char === '"') inString = false;
      continue;
    }
    if (char === '"') { inString = true; continue; }
    if (char === '[') depth += 1;
    else if (char === ']') {
      depth -= 1;
      if (depth === 0) return source.slice(start, index + 1);
    }
  }
  return null;
}

function decodeCaptionEntities(value) {
  return String(value || '')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;|&apos;/g, "'")
    .replace(/&#(\d+);/g, (_match, code) => String.fromCodePoint(Number(code) || 32));
}

function cleanCaptionLine(value) {
  return decodeCaptionEntities(value)
    .replace(/<[^>]+>/g, '')
    .replace(/[♪♫]+/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

function parseCaptionJson3(payload) {
  const events = Array.isArray(payload?.events) ? payload.events : [];
  const lines = [];
  let previousText = '';
  for (const event of events) {
    const raw = Array.isArray(event?.segs) ? event.segs.map(segment => segment?.utf8 || '').join('') : '';
    const text = cleanCaptionLine(raw);
    if (!text || /^\[[^\]]+\]$/u.test(text) || text === previousText) continue;
    const startMs = Math.max(0, Math.round(Number(event?.tStartMs || 0)));
    lines.push({ startMs, text });
    previousText = text;
  }
  return lines;
}

function parseCaptionXml(source) {
  const lines = [];
  const expression = /<text\b([^>]*)>([\s\S]*?)<\/text>/gi;
  let match;
  while ((match = expression.exec(source))) {
    const attrs = match[1] || '';
    const startMatch = attrs.match(/\bstart="([\d.]+)"/i);
    const text = cleanCaptionLine(match[2]);
    if (!text || /^\[[^\]]+\]$/u.test(text)) continue;
    lines.push({ startMs: Math.max(0, Math.round(Number(startMatch?.[1] || 0) * 1000)), text });
  }
  return lines;
}

function captionTrackName(track) {
  if (track?.name?.simpleText) return track.name.simpleText;
  if (Array.isArray(track?.name?.runs)) return track.name.runs.map(item => item?.text || '').join('');
  return '';
}

function chooseCaptionTrack(tracks, requestedLanguage) {
  const requested = String(requestedLanguage || 'ru').toLowerCase().split('-')[0];
  const preferred = [requested, 'ru', 'uk', 'en', 'sk'].filter((item, index, list) => item && list.indexOf(item) === index);
  return [...tracks].sort((a, b) => {
    const score = track => {
      const code = String(track?.languageCode || '').toLowerCase();
      const base = code.split('-')[0];
      let value = track?.kind === 'asr' ? 0 : 30;
      const exact = preferred.indexOf(code);
      const loose = preferred.indexOf(base);
      if (exact >= 0) value += 160 - exact * 12;
      else if (loose >= 0) value += 130 - loose * 10;
      if (track?.isTranslatable) value += 2;
      return value;
    };
    return score(b) - score(a);
  })[0] || null;
}

async function fetchCaptionPayload(track) {
  if (!track?.baseUrl) return [];
  const jsonUrl = new URL(track.baseUrl);
  jsonUrl.searchParams.set('fmt', 'json3');
  try {
    const response = await fetch(jsonUrl.toString(), {
      headers: { 'user-agent': 'Mozilla/5.0', accept: 'application/json,text/plain,*/*' },
      redirect: 'follow'
    });
    if (response.ok) {
      const text = await response.text();
      if (text.trim().startsWith('{')) {
        const lines = parseCaptionJson3(JSON.parse(text));
        if (lines.length) return lines;
      }
      const xmlLines = parseCaptionXml(text);
      if (xmlLines.length) return xmlLines;
    }
  } catch (_) {}
  try {
    const response = await fetch(track.baseUrl, { headers: { 'user-agent': 'Mozilla/5.0' }, redirect: 'follow' });
    if (!response.ok) return [];
    return parseCaptionXml(await response.text());
  } catch (_) {
    return [];
  }
}


async function fetchDirectTimedText(videoId, requestedLanguage) {
  const requested = String(requestedLanguage || 'ru').toLowerCase().split('-')[0];
  const codes = [requested, 'ru', 'uk', 'en', 'sk'].filter((item, index, list) => item && list.indexOf(item) === index);
  for (const code of codes) {
    for (const kind of ['', 'asr']) {
      const endpoint = new URL('https://www.youtube.com/api/timedtext');
      endpoint.searchParams.set('fmt', 'json3');
      endpoint.searchParams.set('v', videoId);
      endpoint.searchParams.set('lang', code);
      if (kind) endpoint.searchParams.set('kind', kind);
      try {
        const response = await fetch(endpoint.toString(), {
          headers: { 'user-agent': 'Mozilla/5.0', accept: 'application/json,text/plain,*/*' },
          redirect: 'follow'
        });
        if (!response.ok) continue;
        const text = await response.text();
        if (!text.trim()) continue;
        let lines = [];
        if (text.trim().startsWith('{')) {
          try { lines = parseCaptionJson3(JSON.parse(text)); } catch (_) {}
        }
        if (!lines.length) lines = parseCaptionXml(text);
        if (lines.length) return { lines, languageCode: code, kind: kind || 'manual', trackName: code };
      } catch (_) {}
    }
  }
  return null;
}

async function handleYoutubeCaptions(request, env) {
  const url = new URL(request.url);
  const videoId = cleanPlainText(url.searchParams.get('videoId'), 24);
  const lang = cleanPlainText(url.searchParams.get('lang'), 12) || 'ru';
  if (!/^[A-Za-z0-9_-]{6,20}$/.test(videoId)) return json({ status: 'unavailable', error: 'invalid-video-id' }, 400);
  try {
    const official = await fetchOfficialYoutubeCaptions(env, videoId, lang).catch(() => null);
    if (official?.lines?.length) return json({ status:'available', source:'youtube-oauth', synced:true, videoId, ...official }, 200, YOUTUBE_CAPTION_HEADERS);
    const pageUrls = [
      `https://www.youtube.com/watch?v=${encodeURIComponent(videoId)}&hl=${encodeURIComponent(lang)}&bpctr=9999999999&has_verified=1`,
      `https://www.youtube.com/embed/${encodeURIComponent(videoId)}?hl=${encodeURIComponent(lang)}`
    ];
    let rawTracks = null;
    for (const pageUrl of pageUrls) {
      try {
        const pageResponse = await fetch(pageUrl, {
          headers: {
            'user-agent': 'Mozilla/5.0 (Linux; Android 15) AppleWebKit/537.36 Chrome/131.0.0.0 Mobile Safari/537.36',
            'accept-language': `${lang},ru;q=0.9,en;q=0.8`,
            accept: 'text/html,application/xhtml+xml',
            cookie: 'CONSENT=YES+cb.20210328-17-p0.en+FX; SOCS=CAI'
          },
          redirect: 'follow'
        });
        if (!pageResponse.ok) continue;
        rawTracks = extractJsonArrayAfterKey(await pageResponse.text(), 'captionTracks');
        if (rawTracks) break;
      } catch (_) {}
    }
    if (!rawTracks) {
      const direct = await fetchDirectTimedText(videoId, lang);
      if (direct) return json({ status:'available', source:'youtube', synced:true, videoId, ...direct }, 200, YOUTUBE_CAPTION_HEADERS);
      return json({ status: 'unavailable', error: 'caption-tracks-missing' }, 200);
    }
    let tracks = [];
    try { tracks = JSON.parse(rawTracks); } catch (_) { tracks = []; }
    if (!Array.isArray(tracks) || !tracks.length) return json({ status: 'unavailable', error: 'caption-tracks-empty' }, 200);
    const track = chooseCaptionTrack(tracks, lang);
    const lines = await fetchCaptionPayload(track);
    if (!lines.length) {
      const direct = await fetchDirectTimedText(videoId, lang);
      if (direct) return json({ status:'available', source:'youtube', synced:true, videoId, ...direct }, 200, YOUTUBE_CAPTION_HEADERS);
      return json({ status: 'unavailable', error: 'caption-body-empty' }, 200);
    }
    return json({
      status: 'available',
      source: 'youtube',
      synced: true,
      videoId,
      languageCode: track?.languageCode || '',
      kind: track?.kind || 'manual',
      trackName: captionTrackName(track),
      lines
    }, 200, YOUTUBE_CAPTION_HEADERS);
  } catch (error) {
    console.error('YouTube captions proxy failed', error);
    return json({ status: 'unavailable', error: 'caption-proxy-error' }, 200);
  }
}

function parseLrcTimecode(raw) {
  const match = String(raw || '').match(/^\[(?:(\d+):)?(\d{1,2}):(\d{2})(?:[.,](\d{1,3}))?\]\s*(.*)$/);
  if (!match) return null;
  const hours = Number(match[1] || 0);
  const minutes = Number(match[2] || 0);
  const seconds = Number(match[3] || 0);
  const milliseconds = Number(String(match[4] || '0').padEnd(3, '0').slice(0, 3));
  const text = cleanPlainText(match[5], 500);
  if (!text) return null;
  return { startMs: ((hours * 60 + minutes) * 60 + seconds) * 1000 + milliseconds, text };
}

function parseLrcBody(body) {
  return String(body || '').split(/\r?\n/).map(parseLrcTimecode).filter(Boolean).slice(0, 1200);
}

function cleanMusixmatchTitle(value) {
  return cleanPlainText(value, 180)
    .replace(/^ANDRIK\s*[|–—-]\s*/i, '')
    .replace(/\s*[|–—-]\s*(?:Official\s+(?:Audio|Music Video|Video)|Lyrics?\s*Video|Visualizer|Официальн(?:ое|ый)\s+(?:аудио|клип|видео)).*$/i, '')
    .replace(/\s*\((?:Official\s+(?:Audio|Video)|Lyrics?\s*Video|Visualizer|Официальн(?:ое|ый)\s+(?:аудио|клип|видео))\)\s*$/i, '')
    .trim();
}

async function fetchMusixmatchSubtitle(env, { title, artist, duration = 0 }) {
  const apiKey = cleanPlainText(env.MUSIXMATCH_API_KEY, 300);
  if (!apiKey) return { status: 'unavailable', error: 'musixmatch-not-configured' };
  const trackTitle = cleanMusixmatchTitle(title);
  const candidateArtist = cleanPlainText(artist, 120) || cleanPlainText(env.MUSIXMATCH_ARTIST_NAME, 120) || 'ANDRIK';
  const trackArtist = /\bandrik\b/i.test(candidateArtist) ? 'ANDRIK' : candidateArtist;
  if (!trackTitle) return { status: 'unavailable', error: 'musixmatch-title-missing' };
  const endpoint = new URL('https://api.musixmatch.com/ws/1.1/matcher.subtitle.get');
  endpoint.searchParams.set('apikey', apiKey);
  endpoint.searchParams.set('q_track', trackTitle);
  endpoint.searchParams.set('q_artist', trackArtist);
  endpoint.searchParams.set('subtitle_format', 'lrc');
  const seconds = Math.round(Number(duration) || 0);
  if (seconds >= 20) {
    endpoint.searchParams.set('f_subtitle_length', String(seconds));
    endpoint.searchParams.set('f_subtitle_length_max_deviation', String(Math.max(8, Math.min(30, Math.round(seconds * 0.08)))));
  }
  try {
    const response = await fetch(endpoint.toString(), {
      headers: { accept: 'application/json', 'user-agent': 'ANDRIK/51.79' },
      redirect: 'follow'
    });
    const data = await response.json().catch(() => null);
    const header = data?.message?.header || {};
    const apiStatus = Number(header.status_code || response.status || 0);
    if (!response.ok || (apiStatus && apiStatus !== 200)) {
      return { status: 'unavailable', error: `musixmatch-api-${apiStatus || response.status}`, statusCode: apiStatus || response.status };
    }
    const subtitle = data?.message?.body?.subtitle || null;
    const lines = parseLrcBody(subtitle?.subtitle_body || '');
    if (!lines.length) {
      return { status: 'unavailable', error: 'musixmatch-subtitle-missing', statusCode: apiStatus };
    }
    return {
      status: 'available',
      source: 'musixmatch',
      synced: true,
      title: trackTitle,
      artist: trackArtist,
      languageCode: cleanPlainText(subtitle?.subtitle_language, 16),
      copyright: cleanPlainText(subtitle?.lyrics_copyright, 1200),
      trackingPixelUrl: /^https:\/\//i.test(String(subtitle?.pixel_tracking_url || '')) ? String(subtitle.pixel_tracking_url) : '',
      trackingScriptUrl: /^https:\/\//i.test(String(subtitle?.script_tracking_url || '')) ? String(subtitle.script_tracking_url) : '',
      updatedAt: cleanPlainText(subtitle?.updated_time, 80),
      lines
    };
  } catch (error) {
    console.error('Musixmatch subtitle lookup failed', error);
    return { status: 'unavailable', error: 'musixmatch-request-failed' };
  }
}

function cleanLyricWords(words, lineStartMs = null) {
  if (!Array.isArray(words)) return [];
  return words.slice(0, 240).map(item => ({
    startMs: Number.isFinite(Number(item?.startMs)) ? Math.max(0, Math.round(Number(item.startMs))) : null,
    text: cleanPlainText(item?.text, 120)
  })).filter(item => item.text && Number.isFinite(item.startMs) && (!Number.isFinite(lineStartMs) || item.startMs >= lineStartMs));
}

function parseStoredLyrics(row) {
  if (!row) return null;
  let lines = [];
  let meta = {};
  try { lines = JSON.parse(row.body_json || '[]'); } catch (_) {}
  try { meta = JSON.parse(row.source_meta_json || '{}'); } catch (_) {}
  if (!Array.isArray(lines) || !lines.length) return null;
  const cleanLines = lines
    .map(item => {
      const startMs = Number.isFinite(Number(item.startMs)) ? Number(item.startMs) : null;
      return {
        startMs,
        text: cleanPlainText(item.text, 500),
        words: cleanLyricWords(item.words, startMs)
      };
    })
    .filter(item => item.text);
  if (!cleanLines.length) return null;
  return {
    status: 'available',
    source: cleanPlainText(row.source, 40) || 'manual',
    synced: cleanLines.every(item => Number.isFinite(item.startMs)),
    videoId: row.video_id,
    title: row.title,
    artist: row.artist,
    languageCode: cleanPlainText(meta.languageCode, 16),
    copyright: cleanPlainText(meta.copyright, 1200),
    trackingPixelUrl: /^https:\/\//i.test(String(meta.trackingPixelUrl || '')) ? String(meta.trackingPixelUrl) : '',
    trackingScriptUrl: /^https:\/\//i.test(String(meta.trackingScriptUrl || '')) ? String(meta.trackingScriptUrl) : '',
    lines: cleanLines,
    updatedAt: row.source_refreshed_at || row.updated_at
  };
}

function lyricsRowIsFresh(row, hours = 24) {
  if (!row?.source_refreshed_at) return false;
  const age = Date.now() - Date.parse(`${String(row.source_refreshed_at).replace(' ', 'T')}Z`);
  return Number.isFinite(age) && age >= 0 && age < hours * 60 * 60 * 1000;
}

async function saveMusixmatchLyrics(db, videoId, payload) {
  const metadata = JSON.stringify({
    languageCode: payload.languageCode || '',
    copyright: payload.copyright || '',
    trackingPixelUrl: payload.trackingPixelUrl || '',
    trackingScriptUrl: payload.trackingScriptUrl || ''
  });
  await db.prepare(`
    INSERT INTO lyrics (video_id, normalized_title, title, artist, body_json, enabled, source, source_meta_json, source_refreshed_at, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, 1, 'musixmatch', ?, datetime('now'), datetime('now'), datetime('now'))
    ON CONFLICT(video_id) DO UPDATE SET
      normalized_title = excluded.normalized_title,
      title = excluded.title,
      artist = excluded.artist,
      body_json = CASE WHEN lyrics.source = 'manual' THEN lyrics.body_json ELSE excluded.body_json END,
      enabled = CASE WHEN lyrics.source = 'manual' THEN lyrics.enabled ELSE 1 END,
      source = CASE WHEN lyrics.source = 'manual' THEN lyrics.source ELSE 'musixmatch' END,
      source_meta_json = CASE WHEN lyrics.source = 'manual' THEN lyrics.source_meta_json ELSE excluded.source_meta_json END,
      source_refreshed_at = CASE WHEN lyrics.source = 'manual' THEN lyrics.source_refreshed_at ELSE datetime('now') END,
      updated_at = datetime('now')
  `).bind(videoId, normalizeTitle(payload.title), payload.title, payload.artist, JSON.stringify(payload.lines), metadata).run();
}

async function findLyricsRow(db, videoId, normalizedTitle) {
  let row = null;
  const fields = `video_id, normalized_title, title, artist, body_json, enabled, source, source_meta_json, source_refreshed_at, created_at, updated_at`;
  if (videoId) row = await db.prepare(`SELECT ${fields} FROM lyrics WHERE enabled = 1 AND video_id = ? LIMIT 1`).bind(videoId).first();
  if (!row && normalizedTitle) row = await db.prepare(`SELECT ${fields} FROM lyrics WHERE enabled = 1 AND normalized_title = ? ORDER BY CASE source WHEN 'manual' THEN 0 ELSE 1 END, updated_at DESC LIMIT 1`).bind(normalizedTitle).first();
  return row;
}

async function handlePublicLyrics(request, env) {
  const db = requireDb(env);
  await ensureLyricsV2Schema(db);
  const url = new URL(request.url);
  const videoId = cleanPlainText(url.searchParams.get('videoId'), 32);
  const rawTitle = cleanPlainText(url.searchParams.get('title'), 180);
  const normalizedTitle = normalizeTitle(rawTitle);
  const artist = cleanPlainText(url.searchParams.get('artist'), 120) || 'ANDRIK';
  const duration = Math.max(0, Math.min(7200, Number(url.searchParams.get('duration')) || 0));
  const row = await findLyricsRow(db, videoId, normalizedTitle);
  const stored = parseStoredLyrics(row);
  if (stored) return json(stored, 200, JSON_HEADERS);
  return json({ status: 'unavailable', source: 'andrik', message: 'lyrics-not-added' }, 200, JSON_HEADERS);
}

async function handleAdminLyricsGet(request, env) {
  if (!adminAuthorized(request, env)) return json({ ok: false, error: 'unauthorized' }, 401);
  const db = requireDb(env);
  await ensureLyricsV2Schema(db);
  const url = new URL(request.url);
  const videoId = cleanPlainText(url.searchParams.get('videoId'), 32);
  if (videoId) {
    const row = await db.prepare(`SELECT video_id, title, artist, body_json, enabled, source, source_meta_json, source_refreshed_at, created_at, updated_at FROM lyrics WHERE video_id = ? LIMIT 1`).bind(videoId).first();
    if (!row) return json({ ok: true, lyric: null });
    const payload = parseStoredLyrics(row);
    return json({ ok: true, lyric: { ...payload, videoId: row.video_id, enabled: Boolean(row.enabled), createdAt: row.created_at } });
  }
  const result = await db.prepare(`SELECT video_id AS videoId, title, artist, enabled, source, source_refreshed_at AS sourceRefreshedAt, updated_at AS updatedAt FROM lyrics ORDER BY updated_at DESC LIMIT 100`).all();
  return json({ ok: true, lyrics: result.results || [] });
}


async function handleAdminLyricsCatalog(request, env) {
  if (!adminAuthorized(request, env)) return json({ ok: false, error: 'unauthorized' }, 401);
  const apiKey = String(env.YOUTUBE_API_KEY || '').trim();
  const settled = await Promise.allSettled(COMMENT_PLAYLISTS.map(playlist => (
    apiKey
      ? fetchYoutubePlaylistItems(env, apiKey, playlist.playlistId, playlist.title)
      : fetchYoutubePlaylistFeed(playlist.playlistId, playlist.title)
  )));
  const items = [];
  const errors = [];
  settled.forEach((result, playlistIndex) => {
    const playlist = COMMENT_PLAYLISTS[playlistIndex];
    if (result.status !== 'fulfilled') {
      errors.push(`${playlist.title}: ${cleanPlainText(result.reason?.message || result.reason || 'error', 240)}`);
      return;
    }
    const fetched = result.value || [];
    fetched.forEach((item, index) => {
      const cleanedTitle = cleanMusixmatchTitle(item.title) || item.title;
      const exactCanonical = playlist.tracks.find(([, title]) => normalizeTitle(title) === normalizeTitle(cleanedTitle));
      const canonicalTitle = exactCanonical?.[1] || (fetched.length === playlist.tracks.length ? playlist.tracks[index]?.[1] : '') || cleanedTitle;
      items.push({
        videoId: cleanPlainText(item.videoId, 32),
        title: cleanPlainText(canonicalTitle, 180),
        youtubeTitle: cleanPlainText(item.title, 220),
        playlistId: playlist.playlistId,
        playlistTitle: playlist.title,
        order: index + 1,
        thumbnail: cleanPlainText(item.thumbnail, 600)
      });
    });
  });
  const unique = [...new Map(items.filter(item => item.videoId && item.title).map(item => [item.videoId, item])).values()];
  return json({
    ok: true,
    items: unique,
    count: unique.length,
    expectedCount: COMMENT_PLAYLISTS.reduce((total, playlist) => total + playlist.tracks.length, 0),
    mode: apiKey ? 'youtube-data-api' : 'youtube-feed',
    errors
  });
}

async function handleAdminLyricsPost(request, env) {
  if (!adminAuthorized(request, env)) return json({ ok: false, error: 'unauthorized' }, 401);
  const db = requireDb(env);
  await ensureLyricsV2Schema(db);
  let body;
  try { body = await readJsonBody(request, 120000); }
  catch (error) { return json({ ok: false, error: error.message === 'payload-too-large' ? 'payload-too-large' : 'invalid-json' }, 400); }
  const videoId = cleanPlainText(body.videoId, 32);
  const title = cleanPlainText(body.title, 180);
  const artist = cleanPlainText(body.artist, 120) || 'ANDRIK';
  const enabled = body.enabled === false ? 0 : 1;
  const lines = Array.isArray(body.lines) ? body.lines.slice(0, 1200).map(item => {
    const startMs = Number.isFinite(Number(item?.startMs)) ? Math.max(0, Math.round(Number(item.startMs))) : null;
    return {
      startMs,
      text: cleanPlainText(item?.text, 500),
      words: cleanLyricWords(item?.words, startMs)
    };
  }).filter(item => item.text) : [];
  if (!videoId || !title || !lines.length) return json({ ok: false, error: 'validation' }, 400);
  await db.prepare(`
    INSERT INTO lyrics (video_id, normalized_title, title, artist, body_json, enabled, source, source_meta_json, source_refreshed_at, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, 'manual', '{}', datetime('now'), datetime('now'), datetime('now'))
    ON CONFLICT(video_id) DO UPDATE SET normalized_title = excluded.normalized_title, title = excluded.title, artist = excluded.artist, body_json = excluded.body_json, enabled = excluded.enabled, source = 'manual', source_meta_json = '{}', source_refreshed_at = datetime('now'), updated_at = datetime('now')
  `).bind(videoId, normalizeTitle(title), title, artist, JSON.stringify(lines), enabled).run();
  return json({ ok: true, source: 'manual', synced: lines.every(item => Number.isFinite(item.startMs)) });
}

async function handleAdminMusixmatchImport(request, env) {
  if (!adminAuthorized(request, env)) return json({ ok: false, error: 'unauthorized' }, 401);
  if (!env.MUSIXMATCH_API_KEY) return json({ ok: false, error: 'musixmatch-not-configured' }, 503);
  const db = requireDb(env);
  await ensureLyricsV2Schema(db);
  let body;
  try { body = await readJsonBody(request, 12000); }
  catch (_) { return json({ ok: false, error: 'invalid-json' }, 400); }
  const videoId = cleanPlainText(body.videoId, 32);
  const title = cleanPlainText(body.title, 180);
  const artist = cleanPlainText(body.artist, 120) || 'ANDRIK';
  const duration = Math.max(0, Math.min(7200, Number(body.duration) || 0));
  if (!videoId || !title) return json({ ok: false, error: 'validation' }, 400);
  const result = await fetchMusixmatchSubtitle(env, { title, artist, duration });
  if (result.status !== 'available') return json({ ok: false, error: result.error || 'musixmatch-unavailable' }, 404);
  const existing = await db.prepare(`SELECT source FROM lyrics WHERE video_id = ? LIMIT 1`).bind(videoId).first();
  if (existing?.source === 'manual' && body.overwriteManual !== true) return json({ ok: false, error: 'manual-lyrics-protected' }, 409);
  if (existing?.source === 'manual' && body.overwriteManual === true) await db.prepare(`UPDATE lyrics SET source = 'musixmatch' WHERE video_id = ?`).bind(videoId).run();
  await saveMusixmatchLyrics(db, videoId, result);
  return json({ ok: true, lyric: { ...result, videoId } });
}

async function handleAdminLyricsDelete(request, env) {
  if (!adminAuthorized(request, env)) return json({ ok: false, error: 'unauthorized' }, 401);
  const db = requireDb(env);
  await ensureLyricsV2Schema(db);
  const videoId = cleanPlainText(new URL(request.url).searchParams.get('videoId'), 32);
  if (!videoId) return json({ ok: false, error: 'validation' }, 400);
  await db.prepare('DELETE FROM lyrics WHERE video_id = ?').bind(videoId).run();
  return json({ ok: true });
}


async function handlePublishRelease(request, env) {
  if (!adminAuthorized(request, env)) return json({ ok: false, error: 'unauthorized' }, 401);
  const db = requireDb(env);
  await Promise.all([ensureLyricsV2Schema(db), ensurePushAutomationSchema(db), ensureControlV1Schema(db)]);
  let body;
  try { body = await readJsonBody(request, 120000); }
  catch (error) { return json({ ok: false, error: error.message === 'payload-too-large' ? 'payload-too-large' : 'invalid-json' }, 400); }

  const videoId = cleanPlainText(body.videoId, 32);
  const title = cleanPlainText(body.title, 180);
  const artist = cleanPlainText(body.artist, 120) || 'ANDRIK';
  const lines = Array.isArray(body.lines) ? body.lines.slice(0, 1200).map(item => {
    const startMs = Number.isFinite(Number(item?.startMs)) ? Math.max(0, Math.round(Number(item.startMs))) : null;
    return {
      startMs,
      text: cleanPlainText(item?.text, 500),
      words: cleanLyricWords(item?.words, startMs)
    };
  }).filter(item => item.text) : [];
  if (!/^[A-Za-z0-9_-]{11}$/.test(videoId) || !title || !lines.length) return json({ ok: false, error: 'validation' }, 400);
  if (lines.some(item => !Number.isFinite(item.startMs))) return json({ ok: false, error: 'lyrics-not-fully-synced' }, 400);
  const invalidOrder = lines.findIndex((item, index) => index > 0 && item.startMs < lines[index - 1].startMs);
  if (invalidOrder >= 0) return json({ ok: false, error: 'lyrics-timing-order', line: invalidOrder + 1 }, 400);

  await db.prepare(`
    INSERT INTO lyrics (video_id, normalized_title, title, artist, body_json, enabled, source, source_meta_json, source_refreshed_at, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, 1, 'manual', '{}', datetime('now'), datetime('now'), datetime('now'))
    ON CONFLICT(video_id) DO UPDATE SET normalized_title = excluded.normalized_title, title = excluded.title, artist = excluded.artist, body_json = excluded.body_json, enabled = 1, source = 'manual', source_meta_json = '{}', source_refreshed_at = datetime('now'), updated_at = datetime('now')
  `).bind(videoId, normalizeTitle(title), title, artist, JSON.stringify(lines)).run();

  const previous = await db.prepare(`
    SELECT type, created_at AS createdAt
    FROM push_history
    WHERE video_id = ? AND status = 'sent' AND type IN ('auto-release', 'auto-release-retry', 'release-publish')
      AND (type = 'release-publish' OR (onesignal_id IS NOT NULL AND onesignal_id != ''))
    ORDER BY created_at DESC
    LIMIT 1
  `).bind(videoId).first();
  if (previous && body.forcePush !== true) {
    await db.prepare(`
      INSERT OR IGNORE INTO push_playlist_seen (video_id, title, published_at, first_seen_at)
      VALUES (?, ?, datetime('now'), datetime('now'))
    `).bind(videoId, title).run();
    await upsertReleaseHistory(db, {
      videoId, title,
      source: 'ANDRIK Lyrics Engine',
      pushStatus: 'sent',
      lyricsStatus: 'synced',
      publishedAt: previous.createdAt,
      details: { alreadyPublished: true }
    });
    return json({ ok: true, saved: true, synced: true, alreadyPublished: true, previous, push: { ok: true, skipped: true, reason: 'already-published' } });
  }

  const releaseTitle = normalizeReleaseTitle(title);
  const releaseUrl = `https://www.youtube.com/watch?v=${encodeURIComponent(videoId)}`;
  const push = await sendOneSignalPush(env, {
    title: `🎵 ${compactYoutubePushTitle(releaseTitle, 'Новый релиз')}`,
    message: 'Новый релиз ANDRIK уже доступен на YouTube',
    url: releaseUrl,
    image: `https://i.ytimg.com/vi/${encodeURIComponent(videoId)}/maxresdefault.jpg`,
    webButtons: [{ id: 'listen-now', text: '▶️ Слушать на YouTube', url: releaseUrl }],
    audience: 'all',
    name: `publish-${videoId}`,
    history: {
      type: 'release-publish',
      source: 'ANDRIK Lyrics Engine',
      videoId,
      videoTitle: releaseTitle
    }
  });

  if (push.ok) {
    await db.prepare(`
      INSERT OR IGNORE INTO push_playlist_seen (video_id, title, published_at, first_seen_at)
      VALUES (?, ?, datetime('now'), datetime('now'))
    `).bind(videoId, title).run();
  }
  await upsertReleaseHistory(db, {
    videoId,
    title: releaseTitle,
    url: releaseUrl,
    source: 'ANDRIK Lyrics Engine',
    pushStatus: push.ok ? 'sent' : (push.skipped ? 'skipped' : 'failed'),
    lyricsStatus: 'synced',
    details: { automatic: false, error: push.error || '' }
  });
  return json({ ok: true, saved: true, synced: true, alreadyPublished: false, push });
}


async function handleReleaseHistory(request, env) {
  if (!adminAuthorized(request, env)) return json({ ok: false, error: 'unauthorized' }, 401);
  const db = requireDb(env);
  await backfillReleaseHistory(db);
  const url = new URL(request.url);
  const limit = Math.max(1, Math.min(100, Number(url.searchParams.get('limit') || 30)));
  const result = await db.prepare(`
    SELECT
      r.video_id AS videoId,
      r.title,
      r.url,
      r.source,
      r.push_status AS pushStatus,
      CASE WHEN l.video_id IS NOT NULL THEN
        CASE WHEN json_valid(l.body_json) AND json_array_length(l.body_json) > 0 THEN
          CASE WHEN NOT EXISTS (
            SELECT 1 FROM json_each(l.body_json) line
            WHERE json_extract(line.value, '$.startMs') IS NULL
          ) THEN 'synced' ELSE 'saved' END
        ELSE r.lyrics_status END
        ELSE r.lyrics_status END AS lyricsStatus,
      r.published_at AS publishedAt,
      r.updated_at AS updatedAt,
      r.details_json AS detailsJson
    FROM release_history r
    LEFT JOIN lyrics l ON l.video_id = r.video_id AND l.enabled = 1
    ORDER BY r.published_at DESC, r.updated_at DESC
    LIMIT ?
  `).bind(limit).all();
  return json({
    ok: true,
    releases: (result.results || []).map(row => ({
      ...row,
      details: parsePushSummary(row.detailsJson),
      detailsJson: undefined
    }))
  });
}

function getBackupBucket(env) {
  return env.BACKUP_BUCKET || env.BACKUPS || null;
}


let googleAnalyticsTokenCache = null;
let googleAnalyticsPropertyCache = null;

function analyticsErrorMessage(error, fallback = 'source-error') {
  const message = cleanPlainText(error?.message || error || fallback, 500);
  if (/SERVICE_DISABLED|has not been used|not enabled/i.test(message)) return 'Google Analytics Admin API не включён — включите его или добавьте GOOGLE_ANALYTICS_PROPERTY_ID';
  if (/authentication|unauthorized|invalid_grant|invalid jwt/i.test(message)) return 'ошибка ключа Google — проверьте GOOGLE_ANALYTICS_CREDENTIALS';
  if (/forbidden|permission|does not have access/i.test(message)) return 'нет доступа к ресурсу GA4 — проверьте роль «Читатель»';
  if (/property/i.test(message) && /not found|invalid|missing/i.test(message)) return 'не найден GA4 Property ID';
  if (/quota/i.test(message)) return 'исчерпана квота Google Analytics API';
  return message || fallback;
}

function base64UrlEncodeBytes(bytes) {
  let binary = '';
  const data = bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes);
  for (let i = 0; i < data.length; i += 1) binary += String.fromCharCode(data[i]);
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '');
}

function base64UrlEncodeText(value) {
  return base64UrlEncodeBytes(new TextEncoder().encode(String(value)));
}

function parseGoogleCredentials(env) {
  const raw = String(env.GOOGLE_ANALYTICS_CREDENTIALS || '').trim();
  if (!raw) return null;
  let credentials;
  try { credentials = JSON.parse(raw); }
  catch (_) {
    try { credentials = JSON.parse(JSON.parse(raw)); }
    catch (error) { throw new Error('invalid-google-analytics-credentials-json'); }
  }
  if (!credentials?.client_email || !credentials?.private_key) throw new Error('google-credentials-fields-missing');
  return credentials;
}

function pemPkcs8ToArrayBuffer(pem) {
  const clean = String(pem)
    .replace(/\\n/g, '\n')
    .replace(/-----BEGIN PRIVATE KEY-----/g, '')
    .replace(/-----END PRIVATE KEY-----/g, '')
    .replace(/\s+/g, '');
  const binary = atob(clean);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i += 1) bytes[i] = binary.charCodeAt(i);
  return bytes.buffer;
}

async function getGoogleAnalyticsAccessToken(env) {
  const now = Math.floor(Date.now() / 1000);
  if (googleAnalyticsTokenCache?.token && googleAnalyticsTokenCache.expiresAt > now + 60) return googleAnalyticsTokenCache.token;
  const credentials = parseGoogleCredentials(env);
  if (!credentials) throw new Error('google-analytics-credentials-not-configured');
  const header = { alg: 'RS256', typ: 'JWT' };
  if (credentials.private_key_id) header.kid = credentials.private_key_id;
  const claims = {
    iss: credentials.client_email,
    scope: 'https://www.googleapis.com/auth/analytics.readonly',
    aud: credentials.token_uri || 'https://oauth2.googleapis.com/token',
    iat: now,
    exp: now + 3600
  };
  const unsigned = `${base64UrlEncodeText(JSON.stringify(header))}.${base64UrlEncodeText(JSON.stringify(claims))}`;
  const key = await crypto.subtle.importKey(
    'pkcs8',
    pemPkcs8ToArrayBuffer(credentials.private_key),
    { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' },
    false,
    ['sign']
  );
  const signature = await crypto.subtle.sign('RSASSA-PKCS1-v1_5', key, new TextEncoder().encode(unsigned));
  const assertion = `${unsigned}.${base64UrlEncodeBytes(signature)}`;
  const body = new URLSearchParams();
  body.set('grant_type', 'urn:ietf:params:oauth:grant-type:jwt-bearer');
  body.set('assertion', assertion);
  const response = await fetch(credentials.token_uri || 'https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'content-type': 'application/x-www-form-urlencoded', accept: 'application/json' },
    body
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok || !data.access_token) throw new Error(data?.error_description || data?.error || `google-token-${response.status}`);
  googleAnalyticsTokenCache = { token: data.access_token, expiresAt: now + Number(data.expires_in || 3600) };
  return data.access_token;
}

function cleanGaPropertyId(value) {
  const id = String(value || '').replace(/^properties\//, '').trim();
  return /^\d+$/.test(id) ? id : '';
}

async function resolveGoogleAnalyticsProperty(env, accessToken) {
  const explicit = cleanGaPropertyId(env.GOOGLE_ANALYTICS_PROPERTY_ID || env.GA4_PROPERTY_ID || env.GOOGLE_ANALYTICS_PROPERTY);
  if (explicit) return { id: explicit, name: 'andrikmetal.com', source: 'environment' };
  if (googleAnalyticsPropertyCache?.id) return googleAnalyticsPropertyCache;
  const credentials = parseGoogleCredentials(env);
  const embedded = cleanGaPropertyId(credentials?.property_id || credentials?.ga4_property_id);
  if (embedded) return { id: embedded, name: 'andrikmetal.com', source: 'credentials' };
  const response = await fetch('https://analyticsadmin.googleapis.com/v1beta/accountSummaries?pageSize=200', {
    headers: { authorization: `Bearer ${accessToken}`, accept: 'application/json' }
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data?.error?.message || `analytics-admin-${response.status}`);
  const properties = [];
  for (const account of data.accountSummaries || []) {
    for (const property of account.propertySummaries || []) {
      const id = cleanGaPropertyId(property.property);
      if (id) properties.push({ id, name: cleanPlainText(property.displayName || account.displayName || `Property ${id}`, 160), source: 'auto-discovery' });
    }
  }
  if (!properties.length) throw new Error('ga4-property-not-found');
  googleAnalyticsPropertyCache = properties.find(item => /andrik|andrikmetal/i.test(item.name)) || properties[0];
  return googleAnalyticsPropertyCache;
}

async function googleAnalyticsPost(accessToken, propertyId, method, body) {
  const response = await fetch(`https://analyticsdata.googleapis.com/v1beta/properties/${propertyId}:${method}`, {
    method: 'POST',
    headers: { authorization: `Bearer ${accessToken}`, 'content-type': 'application/json', accept: 'application/json' },
    body: JSON.stringify(body)
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data?.error?.message || `google-analytics-${method}-${response.status}`);
  return data;
}

function gaMetricNumber(row, index = 0) {
  return Number(row?.metricValues?.[index]?.value || 0);
}

function gaSummary(report) {
  const row = report?.rows?.[0];
  return {
    activeUsers: gaMetricNumber(row, 0),
    sessions: gaMetricNumber(row, 1),
    screenPageViews: gaMetricNumber(row, 2),
    eventCount: gaMetricNumber(row, 3)
  };
}

function gaRows(report, dimensionNames = [], metricNames = []) {
  return (report?.rows || []).map(row => {
    const result = {};
    dimensionNames.forEach((name, index) => { result[name] = cleanPlainText(row?.dimensionValues?.[index]?.value || '', 300); });
    metricNames.forEach((name, index) => { result[name] = Number(row?.metricValues?.[index]?.value || 0); });
    return result;
  });
}

async function fetchGoogleSiteAnalytics(env) {
  const credentialsConfigured = Boolean(String(env.GOOGLE_ANALYTICS_CREDENTIALS || '').trim());
  if (!credentialsConfigured) return { configured: false };
  const accessToken = await getGoogleAnalyticsAccessToken(env);
  const property = await resolveGoogleAnalyticsProperty(env, accessToken);
  const summaryBody = (startDate) => ({
    dateRanges: [{ startDate, endDate: 'today' }],
    metrics: [{ name: 'activeUsers' }, { name: 'sessions' }, { name: 'screenPageViews' }, { name: 'eventCount' }],
    limit: '1'
  });
  const [realtimeReport, todayReport, weekReport, monthReport, trendReport, countriesReport, pagesReport, devicesReport] = await Promise.all([
    googleAnalyticsPost(accessToken, property.id, 'runRealtimeReport', { metrics: [{ name: 'activeUsers' }, { name: 'screenPageViews' }, { name: 'eventCount' }], minuteRanges: [{ startMinutesAgo: 29, endMinutesAgo: 0 }], limit: '1' }),
    googleAnalyticsPost(accessToken, property.id, 'runReport', summaryBody('today')),
    googleAnalyticsPost(accessToken, property.id, 'runReport', summaryBody('7daysAgo')),
    googleAnalyticsPost(accessToken, property.id, 'runReport', summaryBody('30daysAgo')),
    googleAnalyticsPost(accessToken, property.id, 'runReport', {
      dateRanges: [{ startDate: '30daysAgo', endDate: 'today' }], dimensions: [{ name: 'date' }], metrics: [{ name: 'activeUsers' }, { name: 'screenPageViews' }], orderBys: [{ dimension: { dimensionName: 'date' } }], limit: '40'
    }),
    googleAnalyticsPost(accessToken, property.id, 'runReport', {
      dateRanges: [{ startDate: '30daysAgo', endDate: 'today' }], dimensions: [{ name: 'country' }], metrics: [{ name: 'activeUsers' }], orderBys: [{ metric: { metricName: 'activeUsers' }, desc: true }], limit: '250'
    }),
    googleAnalyticsPost(accessToken, property.id, 'runReport', {
      dateRanges: [{ startDate: '30daysAgo', endDate: 'today' }], dimensions: [{ name: 'pageTitle' }, { name: 'pagePath' }], metrics: [{ name: 'screenPageViews' }, { name: 'activeUsers' }], orderBys: [{ metric: { metricName: 'screenPageViews' }, desc: true }], limit: '10'
    }),
    googleAnalyticsPost(accessToken, property.id, 'runReport', {
      dateRanges: [{ startDate: '30daysAgo', endDate: 'today' }], dimensions: [{ name: 'deviceCategory' }], metrics: [{ name: 'activeUsers' }], orderBys: [{ metric: { metricName: 'activeUsers' }, desc: true }], limit: '8'
    })
  ]);
  return {
    configured: true,
    propertyId: property.id,
    propertyName: property.name,
    propertySource: property.source,
    realtime: { activeUsers: gaMetricNumber(realtimeReport?.rows?.[0], 0), screenPageViews: gaMetricNumber(realtimeReport?.rows?.[0], 1), eventCount: gaMetricNumber(realtimeReport?.rows?.[0], 2) },
    today: gaSummary(todayReport),
    week: gaSummary(weekReport),
    month: gaSummary(monthReport),
    trend: gaRows(trendReport, ['date'], ['activeUsers', 'screenPageViews']),
    countries: gaRows(countriesReport, ['country'], ['activeUsers']),
    pages: gaRows(pagesReport, ['pageTitle', 'pagePath'], ['screenPageViews', 'activeUsers']),
    devices: gaRows(devicesReport, ['deviceCategory'], ['activeUsers']),
    updatedAt: new Date().toISOString()
  };
}



let youtubeOAuthAccessCache = null;
let youtubeCaptionCache = new Map();

// This URI is registered in Google Cloud and must match byte-for-byte.
// Keeping it canonical prevents an outdated Cloudflare secret, a trailing slash,
// or the Control subdomain from causing redirect_uri_mismatch again.
const YOUTUBE_OAUTH_REDIRECT_URI = 'https://andrikmetal.com/oauth/youtube/callback';

function youtubeOAuthClient(env, request = null) {
  const clientId = String(env.YOUTUBE_OAUTH_CLIENT_ID || '').trim();
  const clientSecret = String(env.YOUTUBE_OAUTH_CLIENT_SECRET || '').trim();
  const redirectUri = YOUTUBE_OAUTH_REDIRECT_URI;
  return { clientId, clientSecret, redirectUri, configured: Boolean(clientId && clientSecret) };
}

function base64UrlDecodeBytes(value) {
  const raw = String(value || '').replace(/-/g, '+').replace(/_/g, '/');
  const padded = raw + '='.repeat((4 - raw.length % 4) % 4);
  const binary = atob(padded);
  return Uint8Array.from(binary, ch => ch.charCodeAt(0));
}

async function youtubeOAuthHmacKey(env) {
  const secret = String(env.COMMENTS_ADMIN_KEY || env.CRON_SECRET || 'ANDRIK').trim();
  return crypto.subtle.importKey('raw', new TextEncoder().encode(secret), { name:'HMAC', hash:'SHA-256' }, false, ['sign','verify']);
}

async function makeYoutubeOAuthState(env) {
  const payload = base64UrlEncodeText(JSON.stringify({ iat:Date.now(), nonce:crypto.randomUUID() }));
  const key = await youtubeOAuthHmacKey(env);
  const signature = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(payload));
  return `${payload}.${base64UrlEncodeBytes(signature)}`;
}

async function verifyYoutubeOAuthState(env, state) {
  const [payload, signature] = String(state || '').split('.');
  if (!payload || !signature) return false;
  const key = await youtubeOAuthHmacKey(env);
  const ok = await crypto.subtle.verify('HMAC', key, base64UrlDecodeBytes(signature), new TextEncoder().encode(payload));
  if (!ok) return false;
  try {
    const data = JSON.parse(new TextDecoder().decode(base64UrlDecodeBytes(payload)));
    return Number(data.iat || 0) > Date.now() - 15 * 60 * 1000;
  } catch (_) { return false; }
}

async function youtubeTokenCryptoKey(env) {
  const raw = `${String(env.COMMENTS_ADMIN_KEY || '')}|${String(env.CRON_SECRET || '')}|ANDRIK-YOUTUBE-OAUTH-v1`;
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(raw));
  return crypto.subtle.importKey('raw', digest, { name:'AES-GCM' }, false, ['encrypt','decrypt']);
}

async function encryptYoutubeRefreshToken(env, token) {
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const key = await youtubeTokenCryptoKey(env);
  const encrypted = await crypto.subtle.encrypt({ name:'AES-GCM', iv }, key, new TextEncoder().encode(String(token)));
  return `${base64UrlEncodeBytes(iv)}.${base64UrlEncodeBytes(encrypted)}`;
}

async function decryptYoutubeRefreshToken(env, value) {
  const [ivRaw, dataRaw] = String(value || '').split('.');
  if (!ivRaw || !dataRaw) return '';
  const key = await youtubeTokenCryptoKey(env);
  const decrypted = await crypto.subtle.decrypt({ name:'AES-GCM', iv:base64UrlDecodeBytes(ivRaw) }, key, base64UrlDecodeBytes(dataRaw));
  return new TextDecoder().decode(decrypted);
}

async function getYoutubeRefreshToken(env) {
  // v54.72: a fresh manual OAuth connection stored in D1 takes priority.
  // This restores the old one-tap Control flow without exposing the token to the browser.
  if (env.COMMENTS_DB) {
    const db = requireDb(env);
    await ensureControlV1Schema(db);
    const row = await db.prepare(`SELECT refresh_token_enc FROM youtube_oauth_tokens WHERE id='primary' LIMIT 1`).first();
    if (row?.refresh_token_enc) {
      try {
        const stored = await decryptYoutubeRefreshToken(env, row.refresh_token_enc);
        if (stored) return stored;
      } catch (_) {}
    }
  }

  // Cloudflare secret remains a fallback for server-only installations.
  return String(env.YOUTUBE_OAUTH_REFRESH_TOKEN || env.YOUTUBE_REFRESH_TOKEN || '').trim();
}

async function youtubeAutomaticAuthStatus(env) {
  const client = youtubeOAuthClient(env);
  const refreshToken = await getYoutubeRefreshToken(env);
  const secretConfigured = Boolean(String(env.YOUTUBE_OAUTH_REFRESH_TOKEN || env.YOUTUBE_REFRESH_TOKEN || '').trim());
  return {
    mode: 'worker',
    configured: Boolean(client.configured && refreshToken),
    clientConfigured: client.configured,
    refreshTokenConfigured: Boolean(refreshToken),
    source: secretConfigured ? 'cloudflare-secret' : (refreshToken ? 'legacy-d1' : 'missing')
  };
}

async function getYoutubeOAuthRuntimeStatus(env, { verify = false } = {}) {
  const base = await youtubeAutomaticAuthStatus(env);
  const status = {
    mode:'manual-oauth',
    clientConfigured:Boolean(base.clientConfigured),
    refreshTokenConfigured:Boolean(base.refreshTokenConfigured),
    source:base.source || 'missing',
    connected:Boolean(base.clientConfigured && base.refreshTokenConfigured),
    verified:false,
    degraded:false,
    error:''
  };
  if (!verify || !status.connected) return status;
  try {
    await Promise.race([
      getYoutubeOAuthAccessToken(env),
      new Promise((_, reject) => setTimeout(() => reject(new Error('youtube-oauth-status-timeout')), 7500))
    ]);
    status.connected = true;
    status.verified = true;
  } catch (error) {
    status.connected = Boolean(status.clientConfigured && status.refreshTokenConfigured);
    status.degraded = status.connected;
    status.error = cleanPlainText(error?.message || error, 300);
  }
  return status;
}

async function handleYoutubeOAuthStatus(request, env) {
  if (!adminAuthorized(request, env)) return json({ ok:false, error:'unauthorized' }, 401);
  const verify = new URL(request.url).searchParams.get('verify') === '1';
  const status = await getYoutubeOAuthRuntimeStatus(env, { verify });
  return json({ ok:true, ...status });
}

async function getYoutubeOAuthAccessToken(env) {
  const now = Math.floor(Date.now()/1000);
  if (youtubeOAuthAccessCache?.token && youtubeOAuthAccessCache.expiresAt > now + 60) return youtubeOAuthAccessCache.token;
  const config = youtubeOAuthClient(env);
  if (!config.configured) throw new Error('youtube-oauth-client-not-configured');
  const refreshToken = await getYoutubeRefreshToken(env);
  if (!refreshToken) throw new Error('youtube-oauth-not-connected');
  const body = new URLSearchParams({
    client_id: config.clientId,
    client_secret: config.clientSecret,
    refresh_token: refreshToken,
    grant_type: 'refresh_token'
  });
  const response = await fetch('https://oauth2.googleapis.com/token', { method:'POST', headers:{'content-type':'application/x-www-form-urlencoded'}, body });
  const data = await response.json().catch(()=>({}));
  if (!response.ok || !data.access_token) throw new Error(data.error_description || data.error || `youtube-oauth-token-${response.status}`);
  youtubeOAuthAccessCache = { token:data.access_token, expiresAt:now+Number(data.expires_in||3600) };
  return data.access_token;
}

async function handleYoutubeOAuthStart(request, env) {
  if (!adminAuthorized(request, env)) return json({ ok:false, error:'unauthorized' },401);
  const config = youtubeOAuthClient(env, request);
  if (!config.configured) return json({ ok:false, error:'youtube-oauth-client-not-configured' },409);
  const state = await makeYoutubeOAuthState(env);
  const url = new URL('https://accounts.google.com/o/oauth2/v2/auth');
  url.searchParams.set('client_id', config.clientId);
  url.searchParams.set('redirect_uri', config.redirectUri);
  url.searchParams.set('response_type','code');
  url.searchParams.set('access_type','offline');
  url.searchParams.set('prompt','consent');
  url.searchParams.set('include_granted_scopes','true');
  url.searchParams.set('scope',[
    'https://www.googleapis.com/auth/yt-analytics.readonly',
    'https://www.googleapis.com/auth/youtube.readonly',
    'https://www.googleapis.com/auth/youtube.force-ssl'
  ].join(' '));
  url.searchParams.set('state',state);
  return json({ ok:true, url:url.toString(), redirectUri:config.redirectUri });
}

async function handleYoutubeOAuthCallback(request, env, ctx) {
  const url = new URL(request.url);
  const config = youtubeOAuthClient(env, request);
  const oauthError = cleanPlainText(url.searchParams.get('error') || '', 120);
  const code = url.searchParams.get('code') || '';
  const state = url.searchParams.get('state') || '';

  if (oauthError) {
    return Response.redirect(`https://control.andrikmetal.com/?youtube=denied&reason=${encodeURIComponent(oauthError)}`, 302);
  }
  if (!config.configured || !code || !await verifyYoutubeOAuthState(env, state)) {
    return new Response('YouTube OAuth verification failed', {
      status: 400,
      headers: { 'content-type': 'text/plain; charset=utf-8', 'cache-control': 'no-store' }
    });
  }

  const body = new URLSearchParams({
    client_id: config.clientId,
    client_secret: config.clientSecret,
    code,
    grant_type: 'authorization_code',
    redirect_uri: config.redirectUri
  });
  const response = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'content-type': 'application/x-www-form-urlencoded' },
    body
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok || !data.refresh_token) {
    return new Response(`YouTube OAuth error: ${cleanPlainText(data.error_description || data.error || 'refresh-token-missing', 300)}`, {
      status: 400,
      headers: { 'content-type': 'text/plain; charset=utf-8', 'cache-control': 'no-store' }
    });
  }

  const db = requireDb(env);
  await ensureControlV1Schema(db);
  const encrypted = await encryptYoutubeRefreshToken(env, data.refresh_token);
  await db.prepare(`INSERT INTO youtube_oauth_tokens(id,refresh_token_enc,scope,updated_at) VALUES('primary',?,?,datetime('now')) ON CONFLICT(id) DO UPDATE SET refresh_token_enc=excluded.refresh_token_enc,scope=excluded.scope,updated_at=datetime('now')`).bind(encrypted, cleanPlainText(data.scope || '', 1000)).run();
  youtubeOAuthAccessCache = null;
  if (ctx?.waitUntil) ctx.waitUntil(refreshControlSnapshots(env,{ force:true }).catch(error => console.error('Studio snapshot refresh after OAuth:', error)));

  // Root is the installed ANDRIK Control start page. Android can hand this
  // navigation directly to the Control PWA after Google closes the consent flow.
  return Response.redirect('https://control.andrikmetal.com/analytics-admin.html?page=youtube&youtube=connected&v=54.76', 302);
}

async function handleYoutubeOAuthDisconnect(request, env) {
  if (!adminAuthorized(request, env)) return json({ok:false,error:'unauthorized'},401);
  const db=requireDb(env); await ensureControlV1Schema(db);
  await db.prepare(`DELETE FROM youtube_oauth_tokens WHERE id='primary'`).run();
  youtubeOAuthAccessCache=null;
  return json({ok:true});
}


async function handleYoutubeAutomaticMode(request, env) {
  if (!adminAuthorized(request, env)) return json({ ok:false, error:'unauthorized' }, 401);
  const status = await youtubeAutomaticAuthStatus(env);
  return json({
    ok: status.configured,
    mode: 'worker',
    managedBy: 'Cloudflare Worker',
    status,
    message: status.configured
      ? 'YouTube Studio подключён на сервере и обновляется Центральным Cron.'
      : 'Добавьте секрет YOUTUBE_OAUTH_REFRESH_TOKEN в Cloudflare Pages. Авторизация в Control отключена.'
  }, status.configured ? 200 : 409);
}

function handleYoutubeAutomaticCallback() {
  return Response.redirect('https://control.andrikmetal.com/youtube-admin.html?youtube=worker', 302);
}

function decodeCaptionText(value) {
  return String(value||'').replace(/<[^>]+>/g,'').replace(/&amp;/g,'&').replace(/&lt;/g,'<').replace(/&gt;/g,'>').replace(/&#39;/g,"'").replace(/&quot;/g,'"').replace(/\s+/g,' ').trim();
}

function parseVttTimestamp(value) {
  const parts=String(value||'').trim().split(':').map(Number);
  if (parts.some(Number.isNaN)) return 0;
  let seconds=0;
  while(parts.length) seconds=seconds*60+parts.shift();
  return Math.max(0,Math.round(seconds*1000));
}

function parseWebVtt(text) {
  const blocks=String(text||'').replace(/^\uFEFF/,'').split(/\r?\n\r?\n+/);
  const lines=[];
  for(const block of blocks){
    const rows=block.split(/\r?\n/).map(x=>x.trim()).filter(Boolean);
    const timeIndex=rows.findIndex(x=>x.includes('-->'));
    if(timeIndex<0) continue;
    const start=parseVttTimestamp(rows[timeIndex].split('-->')[0].trim());
    const caption=decodeCaptionText(rows.slice(timeIndex+1).join(' '));
    if(caption && !/^\[[^\]]+\]$/.test(caption)) lines.push({startMs:start,text:caption});
  }
  return lines;
}

async function fetchOfficialYoutubeCaptions(env, videoId, requestedLanguage='ru') {
  const cacheKey=`${videoId}:${requestedLanguage}`;
  const cached=youtubeCaptionCache.get(cacheKey);
  if(cached && cached.expiresAt>Date.now()) return cached.value;
  const accessToken=await getYoutubeOAuthAccessToken(env);
  const listUrl=new URL('https://www.googleapis.com/youtube/v3/captions');
  listUrl.searchParams.set('part','snippet'); listUrl.searchParams.set('videoId',videoId);
  await trackObservabilityUsage(env, 'youtube-data-api', observabilityQuotaCost('captions-list'), 1, { endpoint:'captions.list' }).catch(() => {});
  const listResponse=await fetch(listUrl,{headers:{authorization:`Bearer ${accessToken}`,accept:'application/json'}});
  const listData=await listResponse.json().catch(()=>({}));
  if(!listResponse.ok) throw new Error(listData?.error?.message||`youtube-captions-list-${listResponse.status}`);
  const preferred=[String(requestedLanguage||'ru').toLowerCase().split('-')[0],'ru','en','uk','sk'];
  const tracks=(listData.items||[]).slice().sort((a,b)=>{
    const score=x=>{const lang=String(x?.snippet?.language||'').toLowerCase().split('-')[0];let v=x?.snippet?.trackKind==='ASR'?5:30;const i=preferred.indexOf(lang);if(i>=0)v+=100-i*10;return v};
    return score(b)-score(a);
  });
  const track=tracks[0];
  if(!track?.id) return null;
  const downloadUrl=new URL(`https://www.googleapis.com/youtube/v3/captions/${encodeURIComponent(track.id)}`);
  downloadUrl.searchParams.set('tfmt','vtt');
  await trackObservabilityUsage(env, 'youtube-data-api', observabilityQuotaCost('captions-download'), 1, { endpoint:'captions.download' }).catch(() => {});
  const captionResponse=await fetch(downloadUrl,{headers:{authorization:`Bearer ${accessToken}`}});
  if(!captionResponse.ok) throw new Error(`youtube-captions-download-${captionResponse.status}`);
  const lines=parseWebVtt(await captionResponse.text());
  if(!lines.length) return null;
  const value={lines,languageCode:track.snippet?.language||'',kind:track.snippet?.trackKind==='ASR'?'asr':'manual',trackName:track.snippet?.name||track.snippet?.language||''};
  youtubeCaptionCache.set(cacheKey,{value,expiresAt:Date.now()+6*60*60*1000});
  return value;
}

function isoDateDaysAgo(days){const d=new Date();d.setUTCDate(d.getUTCDate()-days);return d.toISOString().slice(0,10)}

let platformAnalyticsSchemaPromise = null;

async function ensurePlatformAnalyticsSchema(db) {
  if (platformAnalyticsSchemaPromise) return platformAnalyticsSchemaPromise;
  platformAnalyticsSchemaPromise = (async () => {
    await db.prepare(`
      CREATE TABLE IF NOT EXISTS youtube_event_seen (
        event_key TEXT PRIMARY KEY,
        event_type TEXT NOT NULL DEFAULT '',
        resource_id TEXT NOT NULL DEFAULT '',
        video_id TEXT NOT NULL DEFAULT '',
        title TEXT NOT NULL DEFAULT '',
        author TEXT NOT NULL DEFAULT '',
        count_value INTEGER NOT NULL DEFAULT 0,
        url TEXT NOT NULL DEFAULT '',
        payload_json TEXT NOT NULL DEFAULT '{}',
        first_seen_at TEXT NOT NULL DEFAULT (datetime('now')),
        last_seen_at TEXT NOT NULL DEFAULT (datetime('now'))
      )
    `).run();
    await db.prepare(`CREATE INDEX IF NOT EXISTS idx_youtube_event_type_seen ON youtube_event_seen(event_type, first_seen_at DESC)`).run();
    await db.prepare(`CREATE INDEX IF NOT EXISTS idx_youtube_event_video ON youtube_event_seen(video_id, last_seen_at DESC)`).run();
    await db.prepare(`
      CREATE TABLE IF NOT EXISTS platform_accounts (
        platform TEXT PRIMARY KEY,
        account_id TEXT NOT NULL DEFAULT '',
        display_name TEXT NOT NULL DEFAULT '',
        profile_url TEXT NOT NULL DEFAULT '',
        status TEXT NOT NULL DEFAULT 'foundation',
        config_json TEXT NOT NULL DEFAULT '{}',
        updated_at TEXT NOT NULL DEFAULT (datetime('now'))
      )
    `).run();
    await db.prepare(`
      CREATE TABLE IF NOT EXISTS platform_snapshots (
        id TEXT PRIMARY KEY,
        platform TEXT NOT NULL,
        period_start TEXT NOT NULL DEFAULT '',
        period_end TEXT NOT NULL DEFAULT '',
        metrics_json TEXT NOT NULL DEFAULT '{}',
        source TEXT NOT NULL DEFAULT '',
        created_at TEXT NOT NULL DEFAULT (datetime('now'))
      )
    `).run();
    await db.prepare(`CREATE INDEX IF NOT EXISTS idx_platform_snapshots_platform_created ON platform_snapshots(platform, created_at DESC)`).run();
    const accounts = [
      ['youtube', '', 'ANDRIK', 'https://www.youtube.com/@andrikmetal', 'connected'],
      ['spotify', '', 'ANDRIK', '', 'foundation'],
      ['apple', '', 'ANDRIK', '', 'foundation'],
      ['soundcloud', '', 'ANDRIK', '', 'foundation'],
      ['amazon', '', 'ANDRIK', '', 'foundation']
    ];
    await db.batch(accounts.map(row => db.prepare(`
      INSERT OR IGNORE INTO platform_accounts(platform, account_id, display_name, profile_url, status, updated_at)
      VALUES (?, ?, ?, ?, ?, datetime('now'))
    `).bind(...row)));
  })();
  try { await platformAnalyticsSchemaPromise; }
  catch (error) { platformAnalyticsSchemaPromise = null; throw error; }
}

async function youtubeApiJson(env, endpoint, params = {}, options = {}) {
  const url = new URL(`https://www.googleapis.com/youtube/v3/${endpoint}`);
  Object.entries(params).forEach(([key, value]) => {
    if (value !== undefined && value !== null && value !== '') url.searchParams.set(key, String(value));
  });
  const headers = { accept: 'application/json' };
  let mode = 'key';
  const apiKey = String(env.YOUTUBE_API_KEY || '').trim();
  if (options.oauth) {
    const accessToken = await getYoutubeOAuthAccessToken(env);
    headers.authorization = `Bearer ${accessToken}`;
    mode = 'oauth';
  } else if (apiKey) {
    url.searchParams.set('key', apiKey);
  } else {
    const accessToken = await getYoutubeOAuthAccessToken(env);
    headers.authorization = `Bearer ${accessToken}`;
    mode = 'oauth';
  }
  await trackObservabilityUsage(env, 'youtube-data-api', observabilityQuotaCost(endpoint), 1, { endpoint:cleanPlainText(endpoint,80), mode }).catch(() => {});
  const response = await fetch(url.toString(), { headers });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data?.error?.message || `youtube-${endpoint}-${response.status}`);
  return { data, mode };
}


async function youtubeApiMutation(env, endpoint, params = {}, body = {}) {
  const url = new URL(`https://www.googleapis.com/youtube/v3/${endpoint}`);
  Object.entries(params).forEach(([key, value]) => {
    if (value !== undefined && value !== null && value !== '') url.searchParams.set(key, String(value));
  });
  const accessToken = await getYoutubeOAuthAccessToken(env);
  await trackObservabilityUsage(env, 'youtube-data-api', observabilityQuotaCost(endpoint, 'POST'), 1, { endpoint:cleanPlainText(endpoint,80), mode:'oauth-mutation' }).catch(() => {});
  const response = await fetch(url.toString(), {
    method: 'POST',
    headers: {
      accept: 'application/json',
      'content-type': 'application/json; charset=utf-8',
      authorization: `Bearer ${accessToken}`
    },
    body: JSON.stringify(body)
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data?.error?.message || `youtube-${endpoint}-${response.status}`);
  return data;
}

async function handleYoutubeCommentDetail(request, env) {
  if (!adminAuthorized(request, env)) return json({ ok:false, error:'unauthorized' }, 401);
  const url = new URL(request.url);
  const commentId = cleanPlainText(url.searchParams.get('commentId') || '', 140);
  if (!commentId) return json({ ok:false, error:'comment-id-required' }, 400);
  const { data } = await youtubeApiJson(env, 'comments', {
    part:'snippet',
    id:commentId,
    textFormat:'plainText'
  }, { oauth:true });
  const raw = Array.isArray(data.items) ? data.items[0] : null;
  if (!raw) return json({ ok:false, error:'comment-not-found' }, 404);
  const item = parseYoutubeCommentItem(raw);
  return json({
    ok:true,
    comment:{
      id:item.id,
      parentId:item.parentId || item.id,
      videoId:item.videoId,
      author:item.author,
      text:item.text,
      publishedAt:item.publishedAt,
      url:item.url
    }
  });
}

async function handleYoutubeCommentReply(request, env) {
  if (!adminAuthorized(request, env)) return json({ ok:false, error:'unauthorized' }, 401);
  const body = await readJsonBody(request, 12000).catch(() => ({}));
  const parentId = cleanPlainText(body.parentId || body.commentId || '', 140);
  const text = cleanPlainText(body.text || body.reply || '', 4000);
  const videoId = cleanPlainText(body.videoId || '', 40);
  if (!parentId) return json({ ok:false, error:'comment-id-required' }, 400);
  if (!text) return json({ ok:false, error:'reply-required' }, 400);
  const data = await youtubeApiMutation(env, 'comments', { part:'snippet' }, {
    snippet:{ parentId, textOriginal:text }
  });
  const created = Array.isArray(data.items) ? data.items[0] : data;
  await recordPushHistory(env, {
    type:'youtube-reply',
    source:'YouTube',
    audience:'owner',
    status:'sent',
    title:'Ответ ANDRIK опубликован',
    message:text,
    url:videoId ? `https://www.youtube.com/watch?v=${encodeURIComponent(videoId)}&lc=${encodeURIComponent(parentId)}` : 'https://www.youtube.com/@andrikmetal',
    videoId,
    details:{ parentId, replyId:created?.id || '' }
  }).catch(() => {});
  return json({
    ok:true,
    reply:{ id:cleanPlainText(created?.id || '', 140), text, parentId }
  });
}

async function fetchYoutubeMonitorIdentity(env) {
  const handle = cleanPlainText(env.YOUTUBE_CHANNEL_HANDLE || '@andrikmetal', 100);
  const params = { part: 'snippet,contentDetails,statistics' };
  if (String(env.YOUTUBE_API_KEY || '').trim()) params.forHandle = handle.replace(/^@/, '');
  else params.mine = 'true';
  const { data, mode } = await youtubeApiJson(env, 'channels', params, { oauth: !String(env.YOUTUBE_API_KEY || '').trim() });
  const channel = data?.items?.[0];
  if (!channel) throw new Error('youtube-channel-not-found');
  return {
    mode,
    channelId: cleanPlainText(channel.id, 100),
    title: cleanPlainText(channel?.snippet?.title || 'ANDRIK', 120),
    handle,
    uploadsPlaylistId: cleanPlainText(channel?.contentDetails?.relatedPlaylists?.uploads, 120),
    views: Number(channel?.statistics?.viewCount || 0),
    subscribers: Number(channel?.statistics?.subscriberCount || 0),
    hiddenSubscribers: Boolean(channel?.statistics?.hiddenSubscriberCount),
    videos: Number(channel?.statistics?.videoCount || 0),
    channelUrl: `https://www.youtube.com/channel/${encodeURIComponent(channel.id)}`
  };
}

function parseYoutubeCommentItem(comment = {}, fallbackVideo = {}) {
  const snippet = comment?.snippet || {};
  const id = cleanPlainText(comment?.id || '', 140);
  const videoId = cleanPlainText(snippet.videoId || fallbackVideo.videoId || '', 40);
  const url = videoId
    ? `https://www.youtube.com/watch?v=${encodeURIComponent(videoId)}&lc=${encodeURIComponent(id)}`
    : 'https://www.youtube.com/@andrikmetal';
  return {
    id,
    parentId: cleanPlainText(snippet.parentId || id, 140),
    videoId,
    videoTitle: cleanPlainText(fallbackVideo.title || '', 180),
    thumbnail: cleanPlainText(fallbackVideo.thumbnail || '', 700),
    author: cleanPlainText(snippet.authorDisplayName || 'Зритель YouTube', 120),
    authorChannelId: cleanPlainText(snippet?.authorChannelId?.value || '', 120),
    authorChannelUrl: cleanPlainText(snippet.authorChannelUrl || '', 700),
    text: cleanPlainText(snippet.textDisplay || snippet.textOriginal || '', 500),
    publishedAt: cleanPlainText(snippet.publishedAt || '', 50),
    updatedAt: cleanPlainText(snippet.updatedAt || snippet.publishedAt || '', 50),
    likeCount: Number(snippet.likeCount || 0),
    url
  };
}

function uniqueYoutubeComments(items = []) {
  const seen = new Set();
  return (Array.isArray(items) ? items : [])
    .filter(item => item?.id && !seen.has(item.id) && seen.add(item.id))
    .sort((a, b) => String(b.publishedAt || '').localeCompare(String(a.publishedAt || '')));
}

function normalizeYoutubeIdentityLabel(value) {
  return String(value || '')
    .trim()
    .toLowerCase()
    .replace(/^@+/, '')
    .replace(/\s+/g, ' ');
}

function isYoutubeOwnerComment(item = {}, identity = {}) {
  const ownerChannelId = cleanPlainText(identity.channelId || '', 120);
  const authorChannelId = cleanPlainText(item.authorChannelId || '', 120);
  if (ownerChannelId && authorChannelId && ownerChannelId === authorChannelId) return true;

  const authorUrl = String(item.authorChannelUrl || '').toLowerCase();
  if (ownerChannelId && authorUrl.includes(`/channel/${ownerChannelId.toLowerCase()}`)) return true;

  const author = normalizeYoutubeIdentityLabel(item.author);
  const handle = normalizeYoutubeIdentityLabel(identity.handle || '@andrikmetal');
  if (author && handle && author === handle) return true;

  if (authorUrl.includes('/@andrikmetal') || authorUrl.includes('channel/ucjzjcw_skqz7tdekdswkwqw'.toLowerCase())) return true;
  return false;
}

async function fetchYoutubeThreadReplies(env, parentIds = [], fallbackVideos = new Map()) {
  const targets = [...new Set((Array.isArray(parentIds) ? parentIds : []).filter(Boolean))].slice(0, 14);
  if (!targets.length) return { items:[], warnings:[] };
  const settled = await Promise.allSettled(targets.map(async parentId => {
    const { data } = await youtubeApiJson(env, 'comments', {
      part:'snippet', parentId, maxResults:100, textFormat:'plainText'
    });
    return (data.items || []).map(reply => {
      const videoId = cleanPlainText(reply?.snippet?.videoId || '', 40);
      return parseYoutubeCommentItem(reply, fallbackVideos.get(videoId) || { videoId });
    });
  }));
  const items=[]; const warnings=[];
  settled.forEach(result => {
    if (result.status === 'fulfilled') items.push(...result.value);
    else warnings.push(cleanPlainText(result.reason?.message || result.reason, 240));
  });
  return { items:uniqueYoutubeComments(items), warnings };
}

async function fetchYoutubeRecentComments(env, channelId) {
  const { data } = await youtubeApiJson(env, 'commentThreads', {
    part:'snippet,replies',
    allThreadsRelatedToChannelId:channelId,
    maxResults:100,
    order:'time',
    textFormat:'plainText'
  });
  const comments=[];
  const incompleteParents=[];
  for (const thread of data.items || []) {
    const top=parseYoutubeCommentItem(thread?.snippet?.topLevelComment || {});
    if (top.id && top.authorChannelId !== channelId) comments.push(top);
    const embedded=thread?.replies?.comments || [];
    for (const reply of embedded) {
      const item=parseYoutubeCommentItem(reply,{videoId:top.videoId});
      if (item.id && item.authorChannelId !== channelId) comments.push(item);
    }
    const totalReplies=Math.max(0,Number(thread?.snippet?.totalReplyCount || 0));
    if (top.id && totalReplies > embedded.length) incompleteParents.push(top.id);
  }
  const fullReplies=await fetchYoutubeThreadReplies(env,incompleteParents).catch(()=>({items:[],warnings:[]}));
  comments.push(...(fullReplies.items || []).filter(item=>item.authorChannelId !== channelId));
  return uniqueYoutubeComments(comments);
}

async function fetchYoutubeCommentsForVideos(env, videos = [], ownerChannelId = '') {
  const targets=(Array.isArray(videos)?videos:[]).slice(0,12);
  if(!targets.length)return {items:[],warnings:[]};
  const settled=await Promise.allSettled(targets.map(async video=>{
    const {data}=await youtubeApiJson(env,'commentThreads',{
      part:'snippet,replies', videoId:video.videoId, maxResults:100, order:'time', textFormat:'plainText'
    });
    const rows=[]; const incompleteParents=[];
    for(const thread of data.items||[]){
      const top=parseYoutubeCommentItem(thread?.snippet?.topLevelComment||{},video);
      if(top.id&&top.authorChannelId!==ownerChannelId)rows.push(top);
      const embedded=thread?.replies?.comments||[];
      for(const reply of embedded){
        const item=parseYoutubeCommentItem(reply,video);
        if(item.id&&item.authorChannelId!==ownerChannelId)rows.push(item);
      }
      const totalReplies=Math.max(0,Number(thread?.snippet?.totalReplyCount||0));
      if(top.id&&totalReplies>embedded.length)incompleteParents.push(top.id);
    }
    const fallback=new Map([[video.videoId,video]]);
    const fullReplies=await fetchYoutubeThreadReplies(env,incompleteParents,fallback).catch(()=>({items:[],warnings:[]}));
    rows.push(...(fullReplies.items||[]).filter(item=>item.authorChannelId!==ownerChannelId));
    return rows;
  }));
  const items=[]; const warnings=[];
  settled.forEach((result,index)=>{
    if(result.status==='fulfilled')items.push(...result.value);
    else{
      const message=cleanPlainText(result.reason?.message||result.reason,220);
      if(message&&!/commentsDisabled|disabled comments/i.test(message))warnings.push(`${targets[index]?.title||'Видео'}: ${message}`);
    }
  });
  return {items:uniqueYoutubeComments(items),warnings};
}

async function fetchYoutubeRecentSubscribers(env) {
  try {
    const { data } = await youtubeApiJson(env, 'subscriptions', {
      part: 'snippet,subscriberSnippet',
      myRecentSubscribers: 'true',
      maxResults: 50
    }, { oauth: true });
    return {
      available: true,
      items: (data.items || []).map(item => {
        const sub = item.subscriberSnippet || item.snippet || {};
        const channelId = cleanPlainText(sub.channelId || item?.snippet?.resourceId?.channelId || '', 120);
        return {
          id: cleanPlainText(item.id, 180),
          title: cleanPlainText(sub.title || 'Новый подписчик', 120),
          channelId,
          url: channelId ? `https://www.youtube.com/channel/${encodeURIComponent(channelId)}` : 'https://www.youtube.com/@andrikmetal',
          publishedAt: cleanPlainText(item?.snippet?.publishedAt || '', 50)
        };
      }).filter(item => item.id)
    };
  } catch (error) {
    return { available: false, items: [], error: cleanPlainText(error?.message || error, 260) };
  }
}

async function fetchYoutubeVideoStats(env, db, uploadsPlaylistId = '') {
  const collected = [];
  const apiKey = String(env.YOUTUBE_API_KEY || '').trim();
  if (uploadsPlaylistId && apiKey) {
    try { collected.push(...await fetchYoutubePlaylistItems(env, apiKey, uploadsPlaylistId, 'Канал ANDRIK')); }
    catch (_) {}
  }
  try {
    const fetched = await fetchOfficialPlaylist(env, db);
    collected.push(...(fetched.items || []));
  } catch (_) {}
  const unique = new Map();
  for (const item of collected) {
    if (!item?.videoId) continue;
    const previous = unique.get(item.videoId);
    if (!previous || String(item.publishedAt || '') > String(previous.publishedAt || '')) unique.set(item.videoId, item);
  }
  const recent = [...unique.values()]
    .sort((a, b) => String(b.publishedAt || '').localeCompare(String(a.publishedAt || '')))
    .slice(0, 200);
  const ids = recent.map(item => item.videoId).filter(Boolean);
  if (!ids.length) return [];
  const chunks = [];
  for (let index = 0; index < ids.length; index += 50) chunks.push(ids.slice(index, index + 50));
  const settled = await Promise.allSettled(chunks.map(chunk => youtubeApiJson(env, 'videos', {
    part: 'snippet,statistics',
    id: chunk.join(','),
    maxResults: 50
  })));
  const failedChunk = settled.find(result => result.status === 'rejected');
  if (failedChunk) throw failedChunk.reason;
  const apiItems = settled.flatMap(result => result.value?.data?.items || []);
  const itemMap = new Map(recent.map(item => [item.videoId, item]));
  return apiItems.map(video => ({
    videoId: cleanPlainText(video.id, 40),
    title: cleanPlainText(video?.snippet?.title || itemMap.get(video.id)?.title || 'Видео ANDRIK', 180),
    publishedAt: cleanPlainText(video?.snippet?.publishedAt || itemMap.get(video.id)?.publishedAt || '', 50),
    thumbnail: video?.snippet?.thumbnails?.high?.url || video?.snippet?.thumbnails?.medium?.url || itemMap.get(video.id)?.thumbnail || '',
    views: Number(video?.statistics?.viewCount || 0),
    likes: Number(video?.statistics?.likeCount || 0),
    comments: Number(video?.statistics?.commentCount || 0),
    url: `https://www.youtube.com/watch?v=${encodeURIComponent(video.id)}`
  })).filter(item => item.videoId)
    .sort((a, b) => String(b.publishedAt || '').localeCompare(String(a.publishedAt || '')));
}

async function getYoutubeEventRow(db, key) {
  return db.prepare(`SELECT event_key AS eventKey, count_value AS countValue, payload_json AS payloadJson FROM youtube_event_seen WHERE event_key = ? LIMIT 1`).bind(key).first();
}

async function saveYoutubeEventRow(db, event = {}) {
  const payload = (() => { try { return JSON.stringify(event.payload || {}); } catch (_) { return '{}'; } })();
  await db.prepare(`
    INSERT INTO youtube_event_seen (
      event_key, event_type, resource_id, video_id, title, author, count_value, url,
      payload_json, first_seen_at, last_seen_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now'), datetime('now'))
    ON CONFLICT(event_key) DO UPDATE SET
      resource_id = excluded.resource_id,
      video_id = excluded.video_id,
      title = excluded.title,
      author = excluded.author,
      count_value = CASE
        /* R309: subscriber totals are a CURRENT baseline, not a historical high-water mark.
           If YouTube drops from 150 to 148, we must remember 148 so the next 149 can
           generate a real +1 subscriber notification. Likes/comments remain high-water. */
        WHEN youtube_event_seen.event_type = 'subscriber-count'
          OR excluded.event_type = 'subscriber-count'
        THEN excluded.count_value
        WHEN youtube_event_seen.event_type IN ('like-count','comment-count')
          OR excluded.event_type IN ('like-count','comment-count')
        THEN MAX(youtube_event_seen.count_value, excluded.count_value)
        ELSE excluded.count_value
      END,
      url = excluded.url,
      payload_json = excluded.payload_json,
      last_seen_at = datetime('now')
  `).bind(
    cleanPlainText(event.key, 220),
    cleanPlainText(event.type, 50),
    cleanPlainText(event.resourceId || '', 180),
    cleanPlainText(event.videoId || '', 60),
    cleanPlainText(event.title || '', 220),
    cleanPlainText(event.author || '', 160),
    Math.max(0, Number(event.countValue || 0)),
    cleanPlainText(event.url || '', 700),
    payload
  ).run();
}


async function getYoutubeSubscriberVisibleCreditR331(db) {
  const row = await getPushState(db, 'youtube-subscriber-visible-credit-r331').catch(() => null);
  if (!row?.value) return { count:0, updatedAt:'' };
  try {
    const parsed = JSON.parse(row.value || '{}') || {};
    const updatedAt = cleanPlainText(parsed.updatedAt || row.updatedAt || '', 60);
    const age = Date.now() - Date.parse(updatedAt || '');
    if (!Number.isFinite(age) || age < 0 || age > 12 * 60 * 60 * 1000) return { count:0, updatedAt };
    return { count:Math.max(0, Math.min(50, Number(parsed.count || 0))), updatedAt };
  } catch (_) {
    return { count:0, updatedAt:'' };
  }
}

async function setYoutubeSubscriberVisibleCreditR331(db, count) {
  const safe = Math.max(0, Math.min(50, Number(count || 0)));
  await setPushState(db, 'youtube-subscriber-visible-credit-r331', JSON.stringify({
    count:safe,
    updatedAt:new Date().toISOString()
  })).catch(() => {});
  return safe;
}


async function loadFastYoutubeVideoIdsR333(db,limit=50){
  const rows=await db.prepare(`
    SELECT video_id AS videoId,payload_json AS payloadJson,last_seen_at AS lastSeenAt
    FROM youtube_event_seen
    WHERE event_type='like-count' AND video_id IS NOT NULL AND video_id!=''
    ORDER BY datetime(last_seen_at) DESC LIMIT 120
  `).all();
  const items=[];
  for(const row of rows.results || []){
    let payload={};try{payload=JSON.parse(row.payloadJson || '{}') || {}}catch(_){}
    items.push({videoId:cleanPlainText(row.videoId || '',40),publishedAt:cleanPlainText(payload.publishedAt || '',50)});
  }
  return items.filter(x=>x.videoId)
    .sort((a,b)=>String(b.publishedAt || '').localeCompare(String(a.publishedAt || '')))
    .slice(0,Math.max(1,Math.min(50,Number(limit || 50)))).map(x=>x.videoId);
}

async function fetchFastYoutubeCommentsR333(env,channelId){
  const {data}=await youtubeApiJson(env,'commentThreads',{
    part:'snippet,replies',allThreadsRelatedToChannelId:channelId,maxResults:100,order:'time',textFormat:'plainText'
  });
  const items=[];
  for(const thread of data.items || []){
    const top=parseYoutubeCommentItem(thread?.snippet?.topLevelComment || {});
    if(top.id)items.push(top);
    for(const reply of thread?.replies?.comments || []){
      const item=parseYoutubeCommentItem(reply,{videoId:top.videoId});
      if(item.id)items.push(item);
    }
  }
  return uniqueYoutubeComments(items);
}

async function fetchFastYoutubeLikesR333(env,db){
  const ids=await loadFastYoutubeVideoIdsR333(db,50);
  if(!ids.length)return [];
  const {data}=await youtubeApiJson(env,'videos',{part:'snippet,statistics',id:ids.join(','),maxResults:50});
  return (data.items || []).map(video=>({
    videoId:cleanPlainText(video.id || '',40),
    title:cleanPlainText(video?.snippet?.title || 'Видео ANDRIK',180),
    publishedAt:cleanPlainText(video?.snippet?.publishedAt || '',50),
    thumbnail:video?.snippet?.thumbnails?.high?.url || video?.snippet?.thumbnails?.medium?.url || '',
    likes:Number(video?.statistics?.likeCount || 0),
    comments:Number(video?.statistics?.commentCount || 0),
    url:`https://www.youtube.com/watch?v=${encodeURIComponent(video.id || '')}`
  })).filter(x=>x.videoId);
}

async function handleFastYoutubeEngagementR333(request,env){
  if(!adminAuthorized(request,env) && !cronAuthorized(request,env))return json({ok:false,error:'unauthorized'},401);
  const db=requireDb(env);
  await Promise.all([ensurePushAutomationSchema(db),ensureControlV1Schema(db)]);
  const startedAt=new Date().toISOString();
  await setPushState(db,'youtube-fast-engagement-last-at-r333',startedAt).catch(()=>{});
  await setPushState(db,'youtube-fast-engagement-last-status-r376','running').catch(()=>{});
  try{
    let channelId=(await getPushState(db,'youtube-websub-channel-id-r332').catch(()=>null))?.value || '';
    if(!channelId)channelId=await resolveYoutubeWebSubChannelIdR332(env,db);
    if(!channelId)throw new Error('youtube-channel-id-unavailable');

    const settled=await Promise.allSettled([fetchFastYoutubeCommentsR333(env,channelId),fetchFastYoutubeLikesR333(env,db)]);
    const comments=settled[0].status==='fulfilled'?settled[0].value:[];
    const videos=settled[1].status==='fulfilled'?settled[1].value:[];
    const videoMap=new Map(videos.map(v=>[v.videoId,v]));
    const identity={channelId,handle:cleanPlainText(env.YOUTUBE_CHANNEL_HANDLE || '@andrikmetal',100)};
    const notifications=[];
    let staleLikeClaimsRecovered=0;
    let busyLikeClaims=0;
    const external=comments.map(item=>{
      const v=videoMap.get(item.videoId)||{};
      return {...item,videoTitle:item.videoTitle||v.title||'Новое событие YouTube',thumbnail:item.thumbnail||v.thumbnail||''};
    }).filter(item=>!isYoutubeOwnerComment(item,identity));

    const cutoff=Date.now()-24*60*60*1000;
    for(const item of external.slice().reverse().slice(-30)){
      const key=`comment:${item.id}`;
      if(await getYoutubeEventRow(db,key))continue;
      const published=Date.parse(item.publishedAt || '');
      if(Number.isFinite(published) && published<cutoff){
        await saveYoutubeEventRow(db,{key,type:'comment',resourceId:item.id,videoId:item.videoId,author:item.author,title:item.text,url:item.url,payload:{...item,seededSilently:true,mode:'fast-r333'}});
        continue;
      }
      const onceKey=`push-once:youtube-comment:${item.id}`;
      let claimed=await claimPushOnce(db,onceKey,startedAt);
      if(!claimed){
        const delivered=await db.prepare(`SELECT 1 AS found FROM push_history WHERE type='youtube-comment' AND status='sent' AND details_json LIKE ? ORDER BY created_at DESC LIMIT 1`).bind(`%${item.id}%`).first().catch(()=>null);
        if(delivered?.found){
          await saveYoutubeEventRow(db,{key,type:'comment',resourceId:item.id,videoId:item.videoId,author:item.author,title:item.text,url:item.url,payload:item});
          continue;
        }
        await db.prepare(`DELETE FROM push_state WHERE key=? AND updated_at < datetime('now','-8 minutes')`).bind(onceKey).run().catch(()=>{});
        claimed=await claimPushOnce(db,onceKey,startedAt);
      }
      if(!claimed)continue;
      const result=await sendOwnerPush(env,{
        title:`💬 ${compactYoutubePushTitle(item.videoTitle || 'Новый комментарий','YouTube')}`,
        message:`${item.author}: ${String(item.text || '').slice(0,160)}`,
        url:item.url,image:item.thumbnail || '',name:`youtube-comment-${item.id}`,ttl:86400,
        data:{commentId:item.id,parentId:item.parentId || item.id,videoId:item.videoId || ''},
        webButtons:[
          {id:'reply-comment',text:'↩️ Ответить',url:`https://control.andrikmetal.com/youtube-comment-reply.html?commentId=${encodeURIComponent(item.id)}&videoId=${encodeURIComponent(item.videoId || '')}`},
          {id:'open-youtube',text:'▶️ YouTube',url:item.url}
        ],
        history:{type:'youtube-comment',source:'YouTube',videoId:item.videoId,videoTitle:item.videoTitle || item.text,details:{commentId:item.id,parentId:item.parentId || item.id,author:item.author,publishedAt:item.publishedAt,deliveryMode:'fast-r333'}}
      });
      if(result.ok)await saveYoutubeEventRow(db,{key,type:'comment',resourceId:item.id,videoId:item.videoId,author:item.author,title:item.text,url:item.url,payload:item});
      else await releasePushOnceClaim(db,onceKey);
      notifications.push({type:'comment',id:item.id,ok:Boolean(result.ok),error:result.error || ''});
    }

    for(const item of videos){
      const key=`like-count:${item.videoId}`;
      const previous=await getYoutubeEventRow(db,key);
      if(!previous){
        await saveYoutubeEventRow(db,{key,type:'like-count',resourceId:item.videoId,videoId:item.videoId,title:item.title,countValue:item.likes,url:item.url,payload:item});
        continue;
      }
      const before=Number(previous.countValue || 0);
      if(item.likes<=before)continue;

      const duplicate=await hasSentYoutubeLikeTotalR376(db,item.videoId,item.likes);
      if(duplicate){
        await db.prepare(`UPDATE youtube_event_seen SET count_value=MAX(count_value,?),last_seen_at=datetime('now') WHERE event_key=?`).bind(item.likes,key).run().catch(()=>{});
        continue;
      }

      // R376: never advance the local like baseline before OneSignal confirms
      // delivery. The exact total is protected by a recoverable push-once claim.
      const likeClaim=await claimYoutubeLikePushR376(db,item.videoId,item.likes,startedAt);
      if(likeClaim.recoveredStale)staleLikeClaimsRecovered++;
      if(likeClaim.delivered){
        await db.prepare(`UPDATE youtube_event_seen SET count_value=MAX(count_value,?),last_seen_at=datetime('now') WHERE event_key=?`).bind(item.likes,key).run().catch(()=>{});
        continue;
      }
      if(!likeClaim.claimed){
        if(likeClaim.busy)busyLikeClaims++;
        continue;
      }
      const onceKey=likeClaim.onceKey;

      const delta=item.likes-before;
      const burst=await resolveYoutubeLikeBurst(db,{...item,before,delta},startedAt);
      const cumulativeDelta=burst.cumulativeDelta;
      const glowTheme=youtubeLikeGlowTheme(cumulativeDelta);
      const likeTopic=pushTopicToken(`youtube-like-${item.videoId}`);
      const videoAppUrl=youtubeAppLauncherUrl(item.url);
      const result=await sendOwnerPush(env,{
        title:`👍 ${compactYoutubePushTitle(item.title,'YouTube')}`,
        message:`+${cumulativeDelta} ${russianLikeWord(cumulativeDelta)} на YouTube · всего ${item.likes}`,
        url:videoAppUrl,image:youtubeLikeGlowImageUrl(item.videoId,cumulativeDelta),icon:glowTheme.icon,
        name:`youtube-like-${item.videoId}-${item.likes}`,androidGroup:likeTopic,threadId:likeTopic,collapseId:likeTopic,webPushTopic:likeTopic,ttl:7200,
        data:{videoId:item.videoId,totalLikes:item.likes,cumulativeDelta,burstStartedAt:burst.startedAt,notificationTag:likeTopic,glowLevel:glowTheme.level},
        webButtons:[{id:'open-youtube',text:'▶️ Смотреть видео',url:videoAppUrl}],
        history:{type:'youtube-like',source:'YouTube',videoId:item.videoId,videoTitle:item.title,details:{targetUrl:item.url,launcherUrl:videoAppUrl,delta,cumulativeDelta,before,totalLikes:item.likes,deliveryMode:'fast-r333'}}
      });
      if(result.ok){
        // The like becomes processed only after OneSignal accepted the push.
        await db.prepare(`UPDATE youtube_event_seen SET count_value=MAX(count_value,?),last_seen_at=datetime('now') WHERE event_key=?`).bind(item.likes,key).run().catch(()=>{});
      }else{
        await releasePushOnceClaim(db,onceKey);
        const burstKey=`youtube-like-burst-v54-97:${item.videoId}`;
        if(burst.previousState)await setPushState(db,burstKey,JSON.stringify(burst.previousState)).catch(()=>{});
        else await db.prepare(`DELETE FROM push_state WHERE key=?`).bind(burstKey).run().catch(()=>{});
      }
      notifications.push({type:'like',videoId:item.videoId,ok:Boolean(result.ok),delta,total:item.likes,error:result.error || ''});
    }

    const warnings=settled.map(r=>r.status==='rejected'?cleanPlainText(r.reason?.message || r.reason,240):'').filter(Boolean);
    const failed=notifications.filter(x=>!x.ok).length;
    const summary={
      ok:warnings.length===0 && failed===0,
      commentsSeen:comments.length,
      videosChecked:videos.length,
      sent:notifications.filter(x=>x.ok).length,
      failed,
      busyLikeClaims,
      staleLikeClaimsRecovered,
      warnings,
      checkedAt:new Date().toISOString()
    };
    const fastStatus=failed>0?'failed':warnings.length?'warning':'success';
    await setPushState(db,'youtube-fast-engagement-last-result-r333',JSON.stringify(summary)).catch(()=>{});
    await setPushState(db,'youtube-fast-engagement-last-status-r376',fastStatus).catch(()=>{});
    if(summary.ok)await setPushState(db,'youtube-fast-engagement-last-success-at-r376',startedAt).catch(()=>{});
    await recordSystemLog(env,{
      scope:'youtube-fast-engagement',
      level:summary.ok?'info':failed>0?'error':'warning',
      event:summary.ok?'fast-check-success':'fast-check-warning',
      message:`YouTube fast 2m: отправлено ${summary.sent}, ошибок ${summary.failed}, занятых like-claim ${busyLikeClaims}, восстановлено stale ${staleLikeClaimsRecovered}.`,
      details:summary
    }).catch(()=>{});
    return json(summary,failed>0?502:warnings.length?206:200);
  }catch(error){
    const msg=cleanPlainText(error?.message || error,400);
    const failedSummary={ok:false,error:msg,checkedAt:new Date().toISOString()};
    await setPushState(db,'youtube-fast-engagement-last-result-r333',JSON.stringify(failedSummary)).catch(()=>{});
    await setPushState(db,'youtube-fast-engagement-last-status-r376','failed').catch(()=>{});
    await recordSystemLog(env,{scope:'youtube-fast-engagement',level:'error',event:'fast-check-failed',message:'Быстрая 2-минутная проверка YouTube завершилась ошибкой.',details:{error:msg}}).catch(()=>{});
    return json(failedSummary,502);
  }
}

async function handleCheckYoutubeEvents(request, env) {
  if (!adminAuthorized(request, env) && !cronAuthorized(request, env)) return json({ ok: false, error: 'unauthorized' }, 401);
  const db = requireDb(env);
  await Promise.all([ensurePushAutomationSchema(db), ensureControlV1Schema(db), ensurePlatformAnalyticsSchema(db)]);
  const previousSuccessState = await getPushState(db, 'youtube-events-last-success-at');
  const previousCheckState = await getPushState(db, 'youtube-events-last-check-at');
  const startedAt = new Date().toISOString();
  await setPushState(db, 'youtube-events-last-check-at', startedAt);
  await setPushState(db, 'youtube-events-last-check-status', 'running');
  try {
    const identity = await fetchYoutubeMonitorIdentity(env);
    if (identity.uploadsPlaylistId) await setPushState(db, 'youtube-uploads-playlist-id', identity.uploadsPlaylistId);
    await mergeYoutubeIdentityIntoLatestSnapshot(db, identity, 'youtube-events-live-v55-00d').catch(() => {});
    const settled = await Promise.allSettled([
      fetchYoutubeRecentComments(env, identity.channelId),
      fetchYoutubeRecentSubscribers(env),
      fetchYoutubeVideoStats(env, db, identity.uploadsPlaylistId)
    ]);
    const channelComments = settled[0].status === 'fulfilled' ? settled[0].value : [];
    const subscribersResult = settled[1].status === 'fulfilled' ? settled[1].value : { available:false, items:[], error:cleanPlainText(settled[1].reason?.message || settled[1].reason, 260) };
    const videos = settled[2].status === 'fulfilled' ? settled[2].value : [];

    // R301/R302: detected counters are persisted independently from push delivery.
    // OneSignal may be delayed, the phone may sleep, or a push may fail; the daily
    // counter must still advance automatically on the server. A partial video API
    // response is never saved as zero, so an external timeout cannot erase totals.
    if (settled[2].status === 'fulfilled') {
      const aggregateLikes = videos.reduce((sum, video) => sum + Math.max(0, Number(video?.likes || 0)), 0);
      const aggregateComments = videos.reduce((sum, video) => sum + Math.max(0, Number(video?.comments || 0)), 0);
      await mergeYoutubeIdentityIntoLatestSnapshot(db, {
        ...identity,
        likesTotal:aggregateLikes,
        commentsTotal:aggregateComments,
        trackedVideos:videos.length
      }, 'youtube-events-counted-r302').catch(() => {});
      await setPushState(db, 'youtube-counts-last-at', new Date().toISOString()).catch(() => {});
      await setPushState(db, 'youtube-counts-last-summary', JSON.stringify({
        likesTotal:aggregateLikes,
        commentsTotal:aggregateComments,
        subscribers:identity.subscribers,
        views:identity.views,
        trackedVideos:videos.length
      })).catch(() => {});
    }

    const commentProbeVideos = [];
    for (const video of videos.slice(0, 24)) {
      const previous = await getYoutubeEventRow(db, `comment-count:${video.videoId}`);
      const before = Number(previous?.countValue || 0);
      if ((!previous && video.comments > 0) || (previous && video.comments > before)) commentProbeVideos.push(video);
      if (commentProbeVideos.length >= 12) break;
    }
    const videoCommentResult = await fetchYoutubeCommentsForVideos(env, commentProbeVideos, identity.channelId).catch(error => ({ items:[], warnings:[cleanPlainText(error?.message || error, 260)] }));
    const videoMeta = new Map(videos.map(video => [video.videoId, video]));
    const comments = uniqueYoutubeComments([...channelComments, ...(videoCommentResult.items || [])])
      .map(item => {
        const video = videoMeta.get(item.videoId) || {};
        return {
          ...item,
          videoTitle:item.videoTitle || video.title || 'Новое событие YouTube',
          thumbnail:item.thumbnail || video.thumbnail || ''
        };
      })
      .filter(item => !isYoutubeOwnerComment(item, identity));
    const warnings = settled.map(result => result.status === 'rejected' ? cleanPlainText(result.reason?.message || result.reason, 260) : '').filter(Boolean);
    if (subscribersResult.error) warnings.push(`Подписчики: ${subscribersResult.error}`);
    if (videoCommentResult.warnings?.length) warnings.push(...videoCommentResult.warnings.map(item => `Комментарии: ${item}`));

    const seeded = await getPushState(db, 'youtube-events-seeded');
    // v54.58: silently align the like high-water marks once. This stops an old
    // like notification from being re-sent when YouTube briefly lowers a public
    // counter and later returns it to the same value.
    const likeLoopGuard = await getPushState(db, 'youtube-like-loop-guard-v54-60');
    const suppressLikePushThisRun = Boolean(seeded && !likeLoopGuard);
    if (suppressLikePushThisRun) {
      for (const item of videos) {
        await saveYoutubeEventRow(db, {
          key:`like-count:${item.videoId}`,
          type:'like-count',
          resourceId:item.videoId,
          videoId:item.videoId,
          title:item.title,
          countValue:item.likes,
          url:item.url,
          payload:{ ...item, reseededAt:startedAt, reason:'v54.60-like-loop-guard' }
        });
      }
      await setPushState(db, 'youtube-like-loop-guard-v54-60', startedAt);
    }
    if (seeded && !await getPushState(db, 'youtube-video-comments-v54-20-seeded')) {
      const recentCutoff = Date.now() - 6 * 60 * 60 * 1000;
      for (const item of videoCommentResult.items || []) {
        const published = Date.parse(item.publishedAt || '');
        if (!Number.isFinite(published) || published < recentCutoff) {
          await saveYoutubeEventRow(db, { key:`comment:${item.id}`, type:'comment', resourceId:item.id, videoId:item.videoId, author:item.author, title:item.text, url:item.url, payload:item });
        }
      }
      await setPushState(db, 'youtube-video-comments-v54-20-seeded', '1');
      await setPushState(db, 'youtube-video-comments-v54-20-seeded-at', startedAt);
    }

    if (!seeded) {
      const seedRows = [
        ...comments.map(item => ({ key:`comment:${item.id}`, type:'comment', resourceId:item.id, videoId:item.videoId, author:item.author, title:item.text, url:item.url, payload:item })),
        ...subscribersResult.items.map(item => ({ key:`subscriber:${item.id}`, type:'subscriber', resourceId:item.id, author:item.title, title:item.title, url:item.url, payload:item })),
        ...videos.flatMap(item => ([
          { key:`like-count:${item.videoId}`, type:'like-count', resourceId:item.videoId, videoId:item.videoId, title:item.title, countValue:item.likes, url:item.url, payload:item },
          { key:`comment-count:${item.videoId}`, type:'comment-count', resourceId:item.videoId, videoId:item.videoId, title:item.title, countValue:item.comments, url:item.url, payload:item }
        ])),
        { key:'channel-subscriber-count', type:'subscriber-count', resourceId:identity.channelId, title:identity.title, countValue:identity.subscribers, url:identity.channelUrl, payload:identity }
      ];
      for (const row of seedRows) await saveYoutubeEventRow(db, row);
      await setPushState(db, 'youtube-events-seeded', '1');
      await setPushState(db, 'youtube-events-seeded-at', startedAt);
      await setPushState(db, 'youtube-video-comments-v54-20-seeded', '1');
      await setPushState(db, 'youtube-events-last-check-status', 'seeded');
      await setPushState(db, 'youtube-events-last-success-at', startedAt);
      const summary = { seeded:true, comments:comments.length, visibleSubscribers:subscribersResult.items.length, videos:videos.length, warnings };
      await setPushState(db, 'youtube-events-last-check-summary', JSON.stringify(summary));
      await recordSystemLog(env, { scope:'youtube-events', level:'warning', event:'seeded', message:'YouTube-события запомнены без старых уведомлений.', details:summary }).catch(() => {});
      return json({ ok:true, ...summary, checkedAt:startedAt });
    }

    const newComments = [];
    const silentlySeededComments = [];
    const startedMs = Date.parse(startedAt);
    const previousCheckpointRaw = previousSuccessState?.value || previousCheckState?.value || previousSuccessState?.updatedAt || previousCheckState?.updatedAt || '';
    const previousCheckpointMs = Date.parse(previousCheckpointRaw);
    // R108 queue window: every unseen external comment from the last 24 hours
    // remains eligible until its push is accepted. A temporary OneSignal/API error
    // can no longer turn a real comment into a silent seed on the next cron run.
    const recentFloorMs = startedMs - 24 * 60 * 60 * 1000;
    const notificationCutoffMs = recentFloorMs;

    for (const item of comments) {
      const key = `comment:${item.id}`;
      const seen = await getYoutubeEventRow(db, key);
      if (seen) continue;

      const publishedMs = Date.parse(item.publishedAt || '');
      if (Number.isFinite(publishedMs) && publishedMs >= notificationCutoffMs) {
        newComments.push(item);
      } else {
        silentlySeededComments.push(item);
      }
    }

    for (const item of silentlySeededComments) {
      await saveYoutubeEventRow(db, {
        key:`comment:${item.id}`,
        type:'comment',
        resourceId:item.id,
        videoId:item.videoId,
        author:item.author,
        title:item.text,
        url:item.url,
        payload:{ ...item, seededSilently:true, seededAt:startedAt }
      });
    }
    const newVisibleSubscribers = [];
    for (const item of subscribersResult.items) {
      const key = `subscriber:${item.id}`;
      if (!await getYoutubeEventRow(db, key)) newVisibleSubscribers.push(item);
    }
    const likeClaimBusyVideoIds = new Set();
    let staleFullLikeClaimsRecovered = 0;
    const likeChanges = [];
    if (!suppressLikePushThisRun) {
      for (const item of videos) {
        const key = `like-count:${item.videoId}`;
        const previous = await getYoutubeEventRow(db, key);
        const before = Number(previous?.countValue || 0);
        if (!previous || item.likes <= before) continue;
        // R376: the exact total is protected by a recoverable claim, but the
        // high-water mark stays untouched until delivery is confirmed.
        const likeClaim = await claimYoutubeLikePushR376(db,item.videoId,item.likes,startedAt);
        if(likeClaim.recoveredStale)staleFullLikeClaimsRecovered++;
        if(likeClaim.delivered){
          await db.prepare(`
            UPDATE youtube_event_seen
            SET count_value=MAX(count_value,?),last_seen_at=datetime('now')
            WHERE event_key=?
          `).bind(item.likes,key).run().catch(()=>{});
          continue;
        }
        if(likeClaim.claimed){
          likeChanges.push({ ...item, delta:item.likes-before, before, onceKey:likeClaim.onceKey });
        }else{
          // Another overlapping 2m/5m run owns this exact total. Do not advance
          // the baseline in the final save loop until that owner confirms it.
          likeClaimBusyVideoIds.add(item.videoId);
        }
      }
    }
    const commentCountChanges = [];
    for (const item of videos) {
      const key = `comment-count:${item.videoId}`;
      const previous = await getYoutubeEventRow(db, key);
      const before = Number(previous?.countValue || 0);
      if (previous && item.comments > before) commentCountChanges.push({ ...item, delta:item.comments-before, before });
    }
    const subscriberState = await getYoutubeEventRow(db, 'channel-subscriber-count');
    const previousSubscriberCount = Number(subscriberState?.countValue || 0);
    const subscriberDelta = !identity.hiddenSubscribers && previousSubscriberCount > 0 && identity.subscribers > previousSubscriberCount
      ? identity.subscribers - previousSubscriberCount : 0;
    const subscriberDropped = !identity.hiddenSubscribers && previousSubscriberCount > 0 && identity.subscribers < previousSubscriberCount;
    const visibleCreditStateR331 = subscriberDropped
      ? { count:0, updatedAt:'' }
      : await getYoutubeSubscriberVisibleCreditR331(db);
    let pendingVisibleCreditR331 = Math.max(0, Number(visibleCreditStateR331.count || 0));

    const notifications = [];
    const commentDelivery = new Map();
    const subscriberDelivery = new Map();
    const likeDeferredVideoIds = new Set(likeClaimBusyVideoIds);
    let subscriberCountDeferred = false;
    const commentBatch = newComments.slice().reverse().slice(0, 20);
    for (const item of commentBatch) {
      const onceKey = `push-once:youtube-comment:${item.id}`;
      let claimed = await claimPushOnce(db, onceKey, startedAt);
      if (!claimed) {
        // Recover an old interrupted claim. A successful historical delivery is
        // considered final; a stale claim without a sent push becomes retryable.
        const delivered = await db.prepare(`
          SELECT 1 AS found FROM push_history
          WHERE type='youtube-comment' AND status='sent' AND details_json LIKE ?
          ORDER BY created_at DESC LIMIT 1
        `).bind(`%${item.id}%`).first();
        if (delivered?.found) {
          commentDelivery.set(item.id, { ok:true, recoveredFromHistory:true });
          continue;
        }
        await db.prepare(`DELETE FROM push_state WHERE key=? AND updated_at < datetime('now','-8 minutes')`).bind(onceKey).run().catch(()=>{});
        claimed = await claimPushOnce(db, onceKey, startedAt);
      }
      if (!claimed) continue;
      const result = await sendOwnerPush(env, {
        title: `💬 ${compactYoutubePushTitle(item.videoTitle || 'Новый комментарий', 'YouTube')}`,
        message: `${item.author}: ${item.text.slice(0, 160)}`,
        url: item.url,
        image: item.thumbnail || '',
        name: `youtube-comment-${item.id}`,
        ttl:86400,
        data:{ commentId:item.id, parentId:item.parentId || item.id, videoId:item.videoId || '' },
        webButtons: [
          { id:'reply-comment', text:'↩️ Ответить', url:`https://control.andrikmetal.com/youtube-comment-reply.html?commentId=${encodeURIComponent(item.id)}&videoId=${encodeURIComponent(item.videoId || '')}` },
          { id:'open-youtube', text:'▶️ YouTube', url:item.url }
        ],
        history: { type:'youtube-comment', source:'YouTube', videoId:item.videoId, videoTitle:item.videoTitle || item.text, details:{ commentId:item.id, parentId:item.parentId || item.id, author:item.author, publishedAt:item.publishedAt } }
      });
      if (!result.ok) await releasePushOnceClaim(db, onceKey);
      commentDelivery.set(item.id, result);
      notifications.push({ type:'comment', id:item.id, ok:Boolean(result.ok), url:item.url, error:result.error || '' });
    }
    // Count-only comment notifications are intentionally disabled. YouTube counts
    // include replies written by the channel owner, which caused false admin alerts.
    // Detailed external comments above remain the single source of comment push alerts.
    const visibleSubscriberBatch = newVisibleSubscribers.slice().reverse().slice(0, 6);
    for (const item of visibleSubscriberBatch) {
      const onceKey = `push-once:youtube-subscriber:${item.id}`;
      let claimed = await claimPushOnce(db, onceKey, startedAt);
      if (!claimed) {
        // R331: recover a subscriber claim exactly like comments.
        // A run that died after claiming but before persisting youtube_event_seen
        // must not silence this subscriber forever.
        const delivered = await db.prepare(`
          SELECT 1 AS found FROM push_history
          WHERE type='youtube-subscriber'
            AND status='sent'
            AND details_json LIKE ?
          ORDER BY created_at DESC LIMIT 1
        `).bind(`%${item.id}%`).first().catch(() => null);
        if (delivered?.found) {
          subscriberDelivery.set(item.id, { ok:true, recoveredFromHistory:true });
          continue;
        }
        await db.prepare(`
          DELETE FROM push_state
          WHERE key=? AND updated_at < datetime('now','-10 minutes')
        `).bind(onceKey).run().catch(() => {});
        claimed = await claimPushOnce(db, onceKey, startedAt);
      }
      if (!claimed) continue;

      const subscriberTarget = item.url || identity.channelUrl;
      const subscriberAppUrl = youtubeAppLauncherUrl(subscriberTarget);
      const result = await sendOwnerPush(env, {
        title: '👤 Новый подписчик YouTube',
        message: `${item.title} подписался на ANDRIK`,
        url: subscriberAppUrl,
        name: `youtube-subscriber-${item.id}`,
        webButtons: [{ id:'open-youtube', text:'▶️ Открыть в YouTube', url:subscriberAppUrl }],
        history: {
          type:'youtube-subscriber',
          source:'YouTube',
          videoTitle:item.title,
          details:{ targetUrl:subscriberTarget, subscriberId:item.id, deliveryMode:'visible-r331' }
        }
      });
      if (!result.ok) await releasePushOnceClaim(db, onceKey);
      subscriberDelivery.set(item.id, result);
      notifications.push({ type:'subscriber', id:item.id, ok:Boolean(result.ok), url:item.url, error:result.error || '' });
    }
    /* R309 subscriber baseline logic.
       - Store the latest REAL YouTube total, including decreases.
       - Never suppress a new rise just because the same absolute total was seen days ago.
       - Use compare-and-swap on the baseline so overlapping Cron/Guard runs cannot both send.
       - If OneSignal fails, roll the baseline back so the next background check retries. */
    /* R331 subscriber delivery accounting.
       IMPORTANT: a visible subscriber only counts as "covered" after a push was
       actually delivered (or recovered from sent push_history). R330 subtracted
       every detected visible subscriber before checking delivery, so one failed/
       stale individual claim could suppress the generic +1 fallback. */
    const visibleDeliveredNowR331 = newVisibleSubscribers.filter(item => subscriberDelivery.get(item.id)?.ok).length;
    const availableVisibleCreditR331 = Math.max(0, pendingVisibleCreditR331 + visibleDeliveredNowR331);
    const visibleSubscriberCredit = Math.min(subscriberDelta, availableVisibleCreditR331);
    const unnamedSubscriberDelta = Math.max(0, subscriberDelta - visibleSubscriberCredit);
    let subscriberCountPushOkR331 = false;

    if (unnamedSubscriberDelta > 0) {
      const subscriberMessage = `На канале теперь ${identity.subscribers} подписчиков`;
      const baselineClaim = await db.prepare(`
        UPDATE youtube_event_seen
        SET count_value = ?, last_seen_at = datetime('now')
        WHERE event_key = 'channel-subscriber-count' AND count_value = ?
      `).bind(identity.subscribers, previousSubscriberCount).run();
      const ownsSubscriberRise = Number(baselineClaim?.meta?.changes || 0) > 0;
      if (ownsSubscriberRise) {
        const channelAppUrl = youtubeAppLauncherUrl(identity.channelUrl);
        const result = await sendOwnerPush(env, {
          title: unnamedSubscriberDelta === 1 ? '👤 Новый подписчик YouTube' : `👤 +${unnamedSubscriberDelta} подписчика YouTube`,
          message: subscriberMessage,
          url: channelAppUrl,
          name: `youtube-subscriber-count-${previousSubscriberCount}-to-${identity.subscribers}`,
          webButtons: [{ id:'open-youtube', text:'▶️ Открыть в YouTube', url:channelAppUrl }],
          history: {
            type:'youtube-subscriber-count',
            source:'YouTube',
            videoTitle:identity.title,
            details:{
              targetUrl:identity.channelUrl,
              previousSubscribers:previousSubscriberCount,
              totalSubscribers:identity.subscribers,
              delta:unnamedSubscriberDelta,
              subscriberDelta,
              visibleSubscriberCredit,
              visibleDeliveredNow:visibleDeliveredNowR331,
              pendingVisibleCreditBefore:pendingVisibleCreditR331,
              baselineMode:'current-count-r331'
            }
          }
        });
        subscriberCountPushOkR331 = Boolean(result.ok);
        if (!result.ok) {
          subscriberCountDeferred = true;
          // Keep both baseline and pending visible credit retryable.
          await db.prepare(`
            UPDATE youtube_event_seen
            SET count_value = ?, last_seen_at = datetime('now')
            WHERE event_key = 'channel-subscriber-count' AND count_value = ?
          `).bind(previousSubscriberCount, identity.subscribers).run().catch(() => {});
        } else {
          // If individual subscriber delivery failed but the generic count push
          // covered the same increase, mark those rows as covered so they do not
          // produce a duplicate named push on the next Cron.
          let cover = unnamedSubscriberDelta;
          for (const item of newVisibleSubscribers) {
            if (cover <= 0) break;
            if (subscriberDelivery.get(item.id)?.ok) continue;
            subscriberDelivery.set(item.id, { ok:true, coveredByCountPush:true });
            cover--;
          }
        }
        notifications.push({
          type:'subscriber-count',
          delta:unnamedSubscriberDelta,
          ok:Boolean(result.ok),
          url:identity.channelUrl,
          previous:previousSubscriberCount,
          total:identity.subscribers
        });
      }
    }

    // If the named subscriber appears before the channel total catches up, retain
    // a short-lived credit. When the total rises later, it consumes that credit
    // instead of sending the same subscriber twice.
    if (!subscriberCountDeferred) {
      const remainingVisibleCreditR331 = subscriberDropped
        ? 0
        : Math.max(0, availableVisibleCreditR331 - visibleSubscriberCredit);
      pendingVisibleCreditR331 = await setYoutubeSubscriberVisibleCreditR331(db, remainingVisibleCreditR331);
    }
    const likeBatch = likeChanges.slice(0, 12);
    for (const item of likeChanges.slice(12)) {
      await releasePushOnceClaim(db, item.onceKey || `push-once:youtube-like:${item.videoId}:${item.likes}`);
      likeDeferredVideoIds.add(item.videoId);
    }
    for (const item of likeBatch) {
      const videoAppUrl = youtubeAppLauncherUrl(item.url);
      const burst = await resolveYoutubeLikeBurst(db, item, startedAt);
      const cumulativeDelta = burst.cumulativeDelta;
      const glowTheme = youtubeLikeGlowTheme(cumulativeDelta);
      const likeTopic = pushTopicToken(`youtube-like-${item.videoId}`);
      const result = await sendOwnerPush(env, {
        title: `👍 ${compactYoutubePushTitle(item.title, 'YouTube')}`,
        message: `+${cumulativeDelta} ${russianLikeWord(cumulativeDelta)} на YouTube · всего ${item.likes}`,
        url: videoAppUrl,
        image: youtubeLikeGlowImageUrl(item.videoId, cumulativeDelta),
        icon: glowTheme.icon,
        name: `youtube-like-${item.videoId}-${item.likes}`,
        androidGroup: likeTopic,
        threadId: likeTopic,
        collapseId: likeTopic,
        webPushTopic: likeTopic,
        ttl: 7200,
        data: {
          videoId: item.videoId,
          totalLikes: item.likes,
          cumulativeDelta,
          burstStartedAt: burst.startedAt,
          notificationTag: likeTopic,
          glowLevel: glowTheme.level
        },
        webButtons: [{ id:'open-youtube', text:'▶️ Смотреть видео', url:videoAppUrl }],
        history: {
          type:'youtube-like',
          source:'YouTube',
          videoId:item.videoId,
          videoTitle:item.title,
          details:{
            targetUrl:item.url,
            launcherUrl:videoAppUrl,
            delta:item.delta,
            cumulativeDelta,
            burstBaselineLikes:burst.baselineLikes,
            burstStartedAt:burst.startedAt,
            before:item.before,
            totalLikes:item.likes,
            replacementTopic:likeTopic,
            glowLevel:glowTheme.level,
            glowImage:youtubeLikeGlowImageUrl(item.videoId, cumulativeDelta)
          }
        }
      });
      if (!result.ok) {
        await releasePushOnceClaim(db, item.onceKey || `push-once:youtube-like:${item.videoId}:${item.likes}`);
        const burstKey = `youtube-like-burst-v54-97:${item.videoId}`;
        if (burst.previousState) await setPushState(db, burstKey, JSON.stringify(burst.previousState));
        else await db.prepare(`DELETE FROM push_state WHERE key=?`).bind(burstKey).run().catch(()=>{});
        likeDeferredVideoIds.add(item.videoId);
      }
      notifications.push({ type:'like', videoId:item.videoId, delta:item.delta, cumulativeDelta, glowLevel:glowTheme.level, ok:Boolean(result.ok), url:videoAppUrl, error:result.error || '' });
    }

    for (const item of newComments) {
      const delivery = commentDelivery.get(item.id);
      if (delivery?.ok) await saveYoutubeEventRow(db, { key:`comment:${item.id}`, type:'comment', resourceId:item.id, videoId:item.videoId, author:item.author, title:item.text, url:item.url, payload:item });
    }
    for (const item of newVisibleSubscribers) {
      if (subscriberDelivery.get(item.id)?.ok) await saveYoutubeEventRow(db, { key:`subscriber:${item.id}`, type:'subscriber', resourceId:item.id, author:item.title, title:item.title, url:item.url, payload:item });
    }
    for (const item of videos) {
      if (!likeDeferredVideoIds.has(item.videoId)) await saveYoutubeEventRow(db, { key:`like-count:${item.videoId}`, type:'like-count', resourceId:item.videoId, videoId:item.videoId, title:item.title, countValue:item.likes, url:item.url, payload:item });
      await saveYoutubeEventRow(db, { key:`comment-count:${item.videoId}`, type:'comment-count', resourceId:item.videoId, videoId:item.videoId, title:item.title, countValue:item.comments, url:item.url, payload:item });
    }
    if (!subscriberCountDeferred) await saveYoutubeEventRow(db, { key:'channel-subscriber-count', type:'subscriber-count', resourceId:identity.channelId, title:identity.title, countValue:identity.subscribers, url:identity.channelUrl, payload:identity });

    const summary = {
      seeded:false,
      newComments:newComments.length,
      commentsAttempted:commentBatch.length,
      commentsSent:notifications.filter(item=>item.type==='comment'&&item.ok).length,
      commentsFailed:notifications.filter(item=>item.type==='comment'&&!item.ok).length,
      commentsQueued:Math.max(0,newComments.length-[...commentDelivery.values()].filter(result=>result?.ok).length),
      newVisibleSubscribers:newVisibleSubscribers.length,
      subscribersAttempted:visibleSubscriberBatch.length + (unnamedSubscriberDelta > 0 ? 1 : 0),
      subscribersSent:notifications.filter(item=>['subscriber','subscriber-count'].includes(item.type)&&item.ok).length,
      subscribersFailed:notifications.filter(item=>['subscriber','subscriber-count'].includes(item.type)&&!item.ok).length,
      subscribersQueued:Math.max(0,newVisibleSubscribers.length-[...subscriberDelivery.values()].filter(result=>result?.ok).length) + (subscriberCountDeferred?1:0),
      subscriberDelta,
      subscriberPreviousCount:previousSubscriberCount,
      subscriberCurrentCount:identity.subscribers,
      subscriberBaselineMode:'current-count-r331',
      subscriberVisibleCreditPending:pendingVisibleCreditR331,
      subscriberVisibleDeliveredNow:visibleDeliveredNowR331,
      likeChanges:likeChanges.reduce((sum,item)=>sum+item.delta,0),
      likesAttempted:likeBatch.length,
      likesSent:notifications.filter(item=>item.type==='like'&&item.ok).length,
      likesFailed:notifications.filter(item=>item.type==='like'&&!item.ok).length,
      likesQueued:likeDeferredVideoIds.size,
      likeClaimsBusy:likeClaimBusyVideoIds.size,
      staleLikeClaimsRecovered:staleFullLikeClaimsRecovered,
      likeBaselineMode:'after-confirmed-push-r376',
      likeLoopGuardApplied:suppressLikePushThisRun,
      commentChanges:newComments.length,
      videosChecked:videos.length,
      notifications:notifications.length,
      warnings
    };
    const failedEventDelivery = notifications.some(item => !item.ok);
    await setPushState(db, 'youtube-events-last-check-status', (warnings.length || failedEventDelivery || summary.commentsQueued || summary.subscribersQueued || summary.likesQueued) ? 'warning' : 'success');
    if (!failedEventDelivery) await setPushState(db, 'youtube-events-last-success-at', startedAt);
    await setPushState(db, 'youtube-events-last-check-summary', JSON.stringify({ ...summary, failedEventDelivery }));
    await recordSystemLog(env, { scope:'youtube-events', level:(warnings.length||failedEventDelivery)?'warning':'info', event:'check-completed', message:`YouTube: комментарии ${summary.commentsSent}/${summary.commentsAttempted}, подписчики ${summary.subscribersSent}/${summary.subscribersAttempted}, лайки ${summary.likesSent}/${summary.likesAttempted}, очередь ${summary.commentsQueued+summary.subscribersQueued+summary.likesQueued}.`, details:summary }).catch(() => {});
    return json({ ok:true, ...summary, checkedAt:startedAt });
  } catch (error) {
    const message = cleanPlainText(error?.message || error, 700);
    await setPushState(db, 'youtube-events-last-check-status', 'failed');
    await setPushState(db, 'youtube-events-last-check-summary', JSON.stringify({ error:message }));
    await recordSystemLog(env, { scope:'youtube-events', level:'error', event:'check-failed', message:'Проверка реакций YouTube завершилась ошибкой.', details:{ error:message } }).catch(() => {});
    return json({ ok:false, error:'youtube-events-check-failed', details:message, checkedAt:startedAt }, 502);
  }
}


async function handleYoutubeEventsStatus(request, env) {
  if (!adminAuthorized(request, env)) return json({ ok:false, error:'unauthorized' }, 401);
  const db = requireDb(env);
  await Promise.all([ensurePushAutomationSchema(db), ensureControlV1Schema(db), ensurePlatformAnalyticsSchema(db)]);
  const [lastCheck,lastSuccess,lastStatus,lastSummary,fastLastAt,fastLastSuccess,fastLastStatus,fastLastResult,todayRows,lastFailure,lastLog] = await Promise.all([
    getPushState(db,'youtube-events-last-check-at'),
    getPushState(db,'youtube-events-last-success-at'),
    getPushState(db,'youtube-events-last-check-status'),
    getPushState(db,'youtube-events-last-check-summary'),
    getPushState(db,'youtube-fast-engagement-last-at-r333'),
    getPushState(db,'youtube-fast-engagement-last-success-at-r376'),
    getPushState(db,'youtube-fast-engagement-last-status-r376'),
    getPushState(db,'youtube-fast-engagement-last-result-r333'),
    db.prepare(`
      SELECT type,status,COUNT(*) AS total
      FROM push_history
      WHERE type IN ('youtube-comment','youtube-like','youtube-subscriber','youtube-subscriber-count')
        AND datetime(created_at)>=datetime('now','-24 hours')
      GROUP BY type,status
    `).all(),
    db.prepare(`
      SELECT type,title,message,error,created_at AS createdAt
      FROM push_history
      WHERE type IN ('youtube-comment','youtube-like','youtube-subscriber','youtube-subscriber-count')
        AND status='failed'
      ORDER BY datetime(created_at) DESC LIMIT 1
    `).first(),
    db.prepare(`
      SELECT level,event,message,details_json AS detailsJson,created_at AS createdAt
      FROM system_logs WHERE scope='youtube-events'
      ORDER BY datetime(created_at) DESC LIMIT 1
    `).first()
  ]);
  let summary={};try{summary=JSON.parse(lastSummary?.value||'{}')}catch(_){}
  let fastSummary={};try{fastSummary=JSON.parse(fastLastResult?.value||'{}')}catch(_){}
  const fastLastAtValue=fastLastAt?.value||fastLastAt?.updatedAt||'';
  const fastAgeMinutes=fastLastAtValue?Math.max(0,Math.round((Date.now()-Date.parse(fastLastAtValue))/60000)):null;
  const fastStatusValue=fastLastStatus?.value||(fastSummary?.ok===false?'failed':fastSummary?.ok===true?'success':'never');
  const fastHealthy=fastAgeMinutes===null?null:(fastAgeMinutes<=6 && !['failed'].includes(fastStatusValue));
  const today={commentsSent:0,repliesSent:0,likesSent:0,subscribersSent:0,failed:0};
  for(const row of (todayRows.results||[])){
    const n=Number(row.total||0),sent=row.status==='sent';
    if(!sent){today.failed+=n;continue}
    if(row.type==='youtube-comment')today.commentsSent+=n;
    if(row.type==='youtube-like')today.likesSent+=n;
    if(row.type==='youtube-subscriber'||row.type==='youtube-subscriber-count')today.subscribersSent+=n;
  }
  const replyRow=await db.prepare(`
    SELECT COUNT(*) AS total FROM push_history
    WHERE type='youtube-comment' AND status='sent' AND datetime(created_at)>=datetime('now','-24 hours')
      AND json_valid(details_json)
      AND COALESCE(json_extract(details_json,'$.parentId'),'')<>''
      AND COALESCE(json_extract(details_json,'$.parentId'),'')<>COALESCE(json_extract(details_json,'$.commentId'),'')
  `).first().catch(()=>null);
  today.repliesSent=Number(replyRow?.total||0);
  return json({
    ok:true,version:ANDRIK_CONTROL_RELEASE.full,
    status:lastStatus?.value||'never',lastCheckAt:lastCheck?.value||lastCheck?.updatedAt||'',lastSuccessAt:lastSuccess?.value||lastSuccess?.updatedAt||'',
    fast:{
      status:fastStatusValue,
      healthy:fastHealthy,
      lastCheckAt:fastLastAtValue,
      lastSuccessAt:fastLastSuccess?.value||fastLastSuccess?.updatedAt||'',
      ageMinutes:fastAgeMinutes,
      staleLikeClaims:Number(fastSummary?.staleLikeClaimsRecovered||0),
      summary:fastSummary,
      error:cleanPlainText(fastSummary?.error||'',300)
    },
    summary,today,lastError:cleanPlainText(lastFailure?.error||lastFailure?.message||'',300),lastFailure:lastFailure||null,lastLog:lastLog||null,updatedAt:new Date().toISOString()
  });
}

let googleSearchConsoleTokenCache = null;

function parseGoogleSearchConsoleCredentials(env) {
  const raw = String(env.GOOGLE_SEARCH_CONSOLE_CREDENTIALS || env.GOOGLE_ANALYTICS_CREDENTIALS || '').trim();
  if (raw) {
    let credentials;
    try { credentials = JSON.parse(raw); }
    catch (_) {
      try { credentials = JSON.parse(JSON.parse(raw)); }
      catch (error) { throw new Error('invalid-google-search-console-credentials-json'); }
    }
    if (!credentials?.client_email || !credentials?.private_key) throw new Error('google-search-console-credentials-fields-missing');
    return credentials;
  }
  const clientEmail = String(env.GOOGLE_CLIENT_EMAIL || '').trim();
  const privateKey = String(env.GOOGLE_PRIVATE_KEY || '').trim();
  if (!clientEmail || !privateKey) return null;
  return {
    client_email: clientEmail,
    private_key: privateKey,
    token_uri: 'https://oauth2.googleapis.com/token'
  };
}

function getGoogleSearchConsoleSiteUrl(env) {
  const raw = String(env.SEARCH_CONSOLE_SITE_URL || env.GOOGLE_SEARCH_CONSOLE_SITE_URL || 'sc-domain:andrikmetal.com').trim();
  if (!raw) return 'sc-domain:andrikmetal.com';
  if (/^sc-domain:/i.test(raw)) return raw;
  if (/^https?:\/\//i.test(raw)) return raw;
  return `sc-domain:${raw.replace(/^www\./i, '').replace(/\/+$/, '')}`;
}

function searchConsoleErrorMessage(error, fallback = 'google-search-console-error') {
  const message = cleanPlainText(error?.message || error || fallback, 500);
  if (/SERVICE_DISABLED|has not been used|not enabled/i.test(message)) return 'Search Console API не включён в Google Cloud';
  if (/authentication|unauthorized|invalid_grant|invalid jwt|private key/i.test(message)) return 'ошибка ключа Search Console — проверьте GOOGLE_CLIENT_EMAIL и GOOGLE_PRIVATE_KEY';
  if (/search-console-service-account-no-access|forbidden|permission|does not have access|insufficient/i.test(message)) return 'нет доступа к Search Console — добавьте service account пользователем ресурса';
  if (/site.*not found|not found.*site|invalid site/i.test(message)) return 'ресурс Search Console не найден — проверьте SEARCH_CONSOLE_SITE_URL';
  if (/quota|rate limit/i.test(message)) return 'исчерпана квота Search Console API';
  return message || fallback;
}

async function getGoogleSearchConsoleAccessToken(env) {
  const now = Math.floor(Date.now() / 1000);
  if (googleSearchConsoleTokenCache?.token && googleSearchConsoleTokenCache.expiresAt > now + 60) return googleSearchConsoleTokenCache.token;
  const credentials = parseGoogleSearchConsoleCredentials(env);
  if (!credentials) throw new Error('google-search-console-credentials-not-configured');
  const header = { alg: 'RS256', typ: 'JWT' };
  if (credentials.private_key_id) header.kid = credentials.private_key_id;
  const claims = {
    iss: credentials.client_email,
    scope: 'https://www.googleapis.com/auth/webmasters.readonly',
    aud: credentials.token_uri || 'https://oauth2.googleapis.com/token',
    iat: now,
    exp: now + 3600
  };
  const unsigned = `${base64UrlEncodeText(JSON.stringify(header))}.${base64UrlEncodeText(JSON.stringify(claims))}`;
  const key = await crypto.subtle.importKey(
    'pkcs8',
    pemPkcs8ToArrayBuffer(credentials.private_key),
    { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' },
    false,
    ['sign']
  );
  const signature = await crypto.subtle.sign('RSASSA-PKCS1-v1_5', key, new TextEncoder().encode(unsigned));
  const assertion = `${unsigned}.${base64UrlEncodeBytes(signature)}`;
  const body = new URLSearchParams();
  body.set('grant_type', 'urn:ietf:params:oauth:grant-type:jwt-bearer');
  body.set('assertion', assertion);
  const response = await fetch(credentials.token_uri || 'https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'content-type': 'application/x-www-form-urlencoded', accept: 'application/json' },
    body
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok || !data.access_token) throw new Error(data?.error_description || data?.error || `google-search-console-token-${response.status}`);
  googleSearchConsoleTokenCache = { token: data.access_token, expiresAt: now + Number(data.expires_in || 3600) };
  return data.access_token;
}


async function listGoogleSearchConsoleSites(accessToken) {
  const response = await fetch('https://www.googleapis.com/webmasters/v3/sites', {
    headers: { authorization:`Bearer ${accessToken}`, accept:'application/json' }
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data?.error?.message || `google-search-console-sites-${response.status}`);
  return Array.isArray(data.siteEntry) ? data.siteEntry.map(item => ({
    siteUrl: cleanPlainText(item?.siteUrl || '', 500),
    permissionLevel: cleanPlainText(item?.permissionLevel || '', 80)
  })).filter(item => item.siteUrl) : [];
}

function searchConsoleSiteHost(value) {
  const raw = String(value || '').trim();
  if (/^sc-domain:/i.test(raw)) return raw.replace(/^sc-domain:/i,'').replace(/^www\./i,'').toLowerCase();
  try { return new URL(raw).hostname.replace(/^www\./i,'').toLowerCase(); }
  catch (_) { return raw.replace(/^https?:\/\//i,'').split('/')[0].replace(/^www\./i,'').toLowerCase(); }
}

function resolveGoogleSearchConsoleSite(configuredSite, accessibleSites=[]) {
  const desired = String(configuredSite || '').trim();
  const exact = accessibleSites.find(item => String(item.siteUrl || '').trim() === desired);
  if (exact) return exact.siteUrl;
  const desiredHost = searchConsoleSiteHost(desired);
  const domainMatch = accessibleSites.find(item => searchConsoleSiteHost(item.siteUrl) === desiredHost);
  return domainMatch?.siteUrl || desired;
}

async function googleSearchConsoleQuery(accessToken, siteUrl, body) {
  const endpoint = `https://www.googleapis.com/webmasters/v3/sites/${encodeURIComponent(siteUrl)}/searchAnalytics/query`;
  const response = await fetch(endpoint, {
    method: 'POST',
    headers: {
      authorization: `Bearer ${accessToken}`,
      'content-type': 'application/json; charset=utf-8',
      accept: 'application/json'
    },
    body: JSON.stringify(body)
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data?.error?.message || `google-search-console-${response.status}`);
  return data;
}

async function fetchGoogleSearchConsoleAnalytics(env) {
  const credentials = parseGoogleSearchConsoleCredentials(env);
  const configuredSiteUrl = getGoogleSearchConsoleSiteUrl(env);
  const serviceAccountEmail = cleanPlainText(credentials?.client_email || '', 180);
  if (!credentials || !configuredSiteUrl) return { configured:false, connected:false, siteUrl:configuredSiteUrl, serviceAccountEmail };
  const accessToken = await getGoogleSearchConsoleAccessToken(env);
  let accessibleSites = [];
  try { accessibleSites = await listGoogleSearchConsoleSites(accessToken); } catch (_) {}
  const siteUrl = resolveGoogleSearchConsoleSite(configuredSiteUrl, accessibleSites);
  if (accessibleSites.length && !accessibleSites.some(item => item.siteUrl === siteUrl)) {
    throw new Error(`search-console-service-account-no-access:${serviceAccountEmail || 'unknown'}:${configuredSiteUrl}`);
  }
  const startDate = isoDateDaysAgo(32);
  const endDate = isoDateDaysAgo(2);
  const [summaryReport, queriesReport, pagesReport, trendReport] = await Promise.all([
    googleSearchConsoleQuery(accessToken, siteUrl, { startDate, endDate, rowLimit: 1, dataState:'final' }),
    googleSearchConsoleQuery(accessToken, siteUrl, { startDate, endDate, dimensions: ['query'], rowLimit: 8, dataState: 'final' }),
    googleSearchConsoleQuery(accessToken, siteUrl, { startDate, endDate, dimensions: ['page'], rowLimit: 8, dataState: 'final' }),
    googleSearchConsoleQuery(accessToken, siteUrl, { startDate, endDate, dimensions: ['date'], rowLimit: 1000, dataState: 'final' })
  ]);
  const summary = summaryReport?.rows?.[0] || {};
  const normalizeRows = report => (report?.rows || []).map(row => ({
    key: cleanPlainText(row?.keys?.[0] || '', 500),
    clicks: Number(row?.clicks || 0),
    impressions: Number(row?.impressions || 0),
    ctr: Number(row?.ctr || 0),
    position: Number(row?.position || 0)
  }));
  return {
    configured:true,
    connected:true,
    siteUrl,
    configuredSiteUrl,
    serviceAccountEmail,
    accessibleSites,
    period: { startDate, endDate },
    clicks: Number(summary.clicks || 0),
    impressions: Number(summary.impressions || 0),
    ctr: Number(summary.ctr || 0),
    position: Number(summary.position || 0),
    queries: normalizeRows(queriesReport),
    pages: normalizeRows(pagesReport),
    trend: (trendReport?.rows || []).map(row => ({
      date: cleanPlainText(row?.keys?.[0] || '', 20),
      clicks: Number(row?.clicks || 0),
      impressions: Number(row?.impressions || 0),
      ctr: Number(row?.ctr || 0),
      position: Number(row?.position || 0)
    })).sort((a,b) => String(a.date).localeCompare(String(b.date))),
    updatedAt: new Date().toISOString()
  };
}


async function buildPlatformControlData(env, google = {}, youtube = {}, searchConsole = {}) {
  const db = requireDb(env);
  await Promise.all([ensurePushAutomationSchema(db), ensureCommentsV4Schema(db), ensurePlatformAnalyticsSchema(db), ensureControlV1Schema(db), ensureSiteMetricsSchema(db)]);
  const [siteSubscribers, siteComments, siteLikes, youtubeToday, releaseToday, recentEvents, monitorState, monitorStatus, monitorSummary] = await Promise.all([
    db.prepare(`SELECT COUNT(*) AS total FROM push_subscribers WHERE status='active' AND source <> 'owner' AND created_at >= datetime('now', '-24 hours')`).first(),
    db.prepare(`SELECT COUNT(*) AS total FROM comments WHERE created_at >= datetime('now', '-24 hours')`).first(),
    db.prepare(`SELECT COUNT(*) AS total FROM comment_likes WHERE created_at >= datetime('now', '-24 hours')`).first(),
    db.prepare(`
      SELECT
        SUM(CASE WHEN type IN ('youtube-comment','youtube-comment-count') THEN 1 ELSE 0 END) AS comments,
        SUM(CASE WHEN type IN ('youtube-subscriber','youtube-subscriber-count') THEN 1 ELSE 0 END) AS subscribers,
        SUM(CASE WHEN type='youtube-like' THEN 1 ELSE 0 END) AS likes
      FROM push_history WHERE created_at >= datetime('now', '-24 hours')
    `).first(),
    db.prepare(`SELECT COUNT(*) AS total FROM push_history WHERE type IN ('auto-release','auto-release-retry','release-publish') AND created_at >= datetime('now', '-24 hours')`).first(),
    db.prepare(`
      SELECT id, type, source, audience, title, message, url, video_id AS videoId, video_title AS videoTitle,
             status, created_at AS createdAt
      FROM push_history
      WHERE type IN ('youtube-comment','youtube-comment-count','youtube-subscriber','youtube-subscriber-count','youtube-like','site-subscriber','comment-live','comment-pending','auto-release','auto-release-retry','release-publish')
      ORDER BY created_at DESC LIMIT 24
    `).all(),
    getPushState(db, 'youtube-events-last-check-at'),
    getPushState(db, 'youtube-events-last-check-status'),
    getPushState(db, 'youtube-events-last-check-summary')
  ]);
  let parsedSummary = {};
  try { parsedSummary = JSON.parse(monitorSummary?.value || '{}'); } catch (_) {}
  const spotifyConfigured = Boolean(env.SPOTIFY_CLIENT_ID && env.SPOTIFY_CLIENT_SECRET && env.SPOTIFY_ARTIST_ID);
  const appleConfigured = Boolean(env.APPLE_MUSIC_DEVELOPER_TOKEN && env.APPLE_MUSIC_ARTIST_ID);
  const soundcloudConfigured = Boolean(env.SOUNDCLOUD_CLIENT_ID && (env.SOUNDCLOUD_USER_ID || env.SOUNDCLOUD_PROFILE_URL));
  const amazonConfigured = Boolean(env.AMAZON_MUSIC_API_KEY && env.AMAZON_MUSIC_ARTIST_ID);
  const googleSearchConfigured = Boolean(parseGoogleSearchConsoleCredentials(env) && getGoogleSearchConsoleSiteUrl(env));
  const bingConfigured = Boolean(env.BING_WEBMASTER_API_KEY && env.BING_SITE_URL);
  return {
    today: {
      websiteUsers:Number(google?.today?.activeUsers || 0),
      websiteViews:Number(google?.today?.screenPageViews || 0),
      siteSubscribers:Number(siteSubscribers?.total || 0),
      siteComments:Number(siteComments?.total || 0),
      siteLikes:Number(siteLikes?.total || 0),
      youtubeComments:Number(youtubeToday?.comments || 0),
      youtubeSubscribers:Number(youtubeToday?.subscribers || 0),
      youtubeLikes:latestYouTubeStudioDailyMetric(youtube, 'likes'),
      releases:Number(releaseToday?.total || 0),
      period:'24h'
    },
    platforms: [
      { id:'youtube', name:'YouTube', icon:'▶️', status:youtube?.studio?.connected?'live':'connected', label:youtube?.studio?.connected?'Канал и Studio · OAuth подключён':'Канал подключён · Studio ждёт OAuth', metric:youtube?.subscribers ?? 0, metricLabel:'подписчиков', url:'/youtube-admin.html', internal:true },
      { id:'spotify', name:'Spotify', icon:'🟢', status:spotifyConfigured?'metadata':'foundation', label:spotifyConfigured?'Доступ подготовлен':'Подключим позже', metric:null, metricLabel:'', url:'' },
      { id:'apple', name:'Apple Music', icon:'🍎', status:appleConfigured?'metadata':'foundation', label:appleConfigured?'Доступ подготовлен':'Подключим позже', metric:null, metricLabel:'', url:'' },
      { id:'soundcloud', name:'SoundCloud', icon:'☁️', status:soundcloudConfigured?'metadata':'foundation', label:soundcloudConfigured?'Доступ подготовлен':'Подключим позже', metric:null, metricLabel:'', url:'' },
      { id:'amazon', name:'Amazon Music', icon:'🟠', status:amazonConfigured?'metadata':'foundation', label:amazonConfigured?'Доступ подготовлен':'Подключим позже', metric:null, metricLabel:'', url:'' }
    ],
    searchEngines: [
      { id:'google-search-console', name:'Google Search Console', icon:'🔎', status:searchConsole?.connected?'live':(searchConsole?.error?'error':(googleSearchConfigured?'configured':'foundation')), label:searchConsole?.connected?'Доступ подтверждён · данные Search Console получены':(searchConsole?.error?`Ошибка доступа: ${cleanPlainText(searchConsole.error, 180)}`:(googleSearchConfigured?'Ключи найдены · проверяем доступ':'Не подключено в Cloudflare Pages')), metric:searchConsole?.connected?Number(searchConsole.clicks||0):null, metricLabel:searchConsole?.connected?`кликов · ${Number(searchConsole.impressions||0)} показов · CTR ${(Number(searchConsole.ctr||0)*100).toFixed(1)}%`:'клики · показы · CTR · позиции', url:searchConsole?.connected?'https://search.google.com/search-console?resource_id=sc-domain%3Aandrikmetal.com&authuser=andrikmetal%40gmail.com':'' },
      { id:'bing-webmaster', name:'Bing Webmaster', icon:'🅱️', status:bingConfigured?'configured':'foundation', label:bingConfigured?'Ключ найден · готово к подключению отчётов':'Фундамент готов · позже подключим API', metric:null, metricLabel:'клики · показы · запросы · индекс', url:'' }
    ],
    albums: [
      { title:'Illusion of Life', releaseDate:'20.06.2026', status:'released', tracks:11, youtubeUrl:'https://www.youtube.com/playlist?list=PLf3D55CqULs8' },
      { title:'OCEAN', releaseDate:'20.07.2026', status:'released', tracks:10, youtubeUrl:'https://www.youtube.com/playlist?list=PLOWKqAipKxhk' },
      { title:'Трика', releaseDate:'20.08.2026', status:'planned', tracks:null, youtubeUrl:'' }
    ],
    youtubeMonitor: {
      configured:Boolean(env.YOUTUBE_API_KEY),
      oauthConnected:Boolean(youtube?.studio?.connected),
      workerManaged:true,
      ownerPushConfigured:oneSignalConfigured(env),
      lastCheckAt:monitorState?.value || '',
      status:monitorStatus?.value || 'never',
      summary:parsedSummary,
      limitations:'Комментарии и изменения лайков проверяются каждые 15 минут. Имя подписчика доступно только для публичных подписок. YouTube не отдаёт имя человека, поставившего лайк.'
    },
    recentEvents:recentEvents.results || []
  };
}

async function youtubeAnalyticsQuery(env, accessToken, params={}) {
  const url=new URL('https://youtubeanalytics.googleapis.com/v2/reports');
  Object.entries(params).forEach(([key,value])=>{if(value!==undefined&&value!==null&&value!=='')url.searchParams.set(key,String(value))});
  await trackObservabilityUsage(env, 'youtube-analytics-api', 0, 1, { dimensions:cleanPlainText(params.dimensions || 'summary',120), metrics:cleanPlainText(params.metrics || '',240) }).catch(() => {});
  const response=await fetch(url,{headers:{authorization:`Bearer ${accessToken}`,accept:'application/json'}});
  const data=await response.json().catch(()=>({}));
  if(!response.ok) throw new Error(data?.error?.message||`youtube-analytics-${response.status}`);
  const headers=(data.columnHeaders||[]).map(x=>x.name);
  return (data.rows||[]).map(row=>Object.fromEntries(headers.map((name,index)=>[name,row[index]])));
}

async function fetchYouTubeStudioAnalytics(env) {
  const config=youtubeOAuthClient(env);
  const refreshToken=await getYoutubeRefreshToken(env);
  if(!config.configured || !refreshToken) return {configured:config.configured,connected:false};
  const accessToken=await getYoutubeOAuthAccessToken(env);
  const startDate=isoDateDaysAgo(27), endDate=isoDateDaysAgo(1);
  const dailyDate=isoDateDaysAgo(1);
  const base={ids:'channel==MINE',startDate,endDate};
  const results=await Promise.allSettled([
    youtubeAnalyticsQuery(env, accessToken,{...base,metrics:'views,estimatedMinutesWatched,averageViewDuration,likes,comments,shares,subscribersGained,subscribersLost'}),
    youtubeAnalyticsQuery(env, accessToken,{...base,dimensions:'day',metrics:'views,likes,comments,shares',sort:'day'}),
    youtubeAnalyticsQuery(env, accessToken,{...base,dimensions:'country',metrics:'views,estimatedMinutesWatched',sort:'-views',maxResults:200}),
    youtubeAnalyticsQuery(env, accessToken,{ids:'channel==MINE',startDate:dailyDate,endDate:dailyDate,dimensions:'country',metrics:'views,estimatedMinutesWatched',sort:'-views',maxResults:200}),
    youtubeAnalyticsQuery(env, accessToken,{...base,dimensions:'ageGroup,gender',metrics:'viewerPercentage'}),
    youtubeAnalyticsQuery(env, accessToken,{...base,dimensions:'sharingService',metrics:'shares',sort:'-shares',maxResults:8})
  ]);
  const val=i=>results[i].status==='fulfilled'?results[i].value:[];
  const summary=val(0)[0]||{};
  const demographics=val(4);
  const ageMap={},genderMap={};
  demographics.forEach(row=>{const pct=Number(row.viewerPercentage||0);ageMap[row.ageGroup]=(ageMap[row.ageGroup]||0)+pct;genderMap[row.gender]=(genderMap[row.gender]||0)+pct});
  const cleanCountries=rows=>(rows||[])
    .map(r=>({country:String(r.country||''),views:Number(r.views||0),estimatedMinutesWatched:Number(r.estimatedMinutesWatched||0)}))
    .filter(r=>r.country && r.country!=='ZZ' && r.views>0)
    .sort((a,b)=>b.views-a.views || a.country.localeCompare(b.country));
  const countries=cleanCountries(val(2));
  const dailyCountries=cleanCountries(val(3));
  return {
    configured:true,connected:true,startDate,endDate,dailyDate,
    summary:{
      views:Number(summary.views||0), estimatedMinutesWatched:Number(summary.estimatedMinutesWatched||0), averageViewDuration:Number(summary.averageViewDuration||0), likes:Number(summary.likes||0), comments:Number(summary.comments||0), shares:Number(summary.shares||0), subscribersGained:Number(summary.subscribersGained||0), subscribersLost:Number(summary.subscribersLost||0)
    },
    trend:val(1).map(r=>({day:String(r.day||''),views:Number(r.views||0),likes:Number(r.likes||0),comments:Number(r.comments||0),shares:Number(r.shares||0)})),
    countries,
    dailyCountries,
    countryCount:countries.length,
    age:Object.entries(ageMap).map(([ageGroup,viewerPercentage])=>({ageGroup,viewerPercentage})).sort((a,b)=>b.viewerPercentage-a.viewerPercentage),
    gender:Object.entries(genderMap).map(([gender,viewerPercentage])=>({gender,viewerPercentage})).sort((a,b)=>b.viewerPercentage-a.viewerPercentage),
    sharing:val(5).map(r=>({sharingService:String(r.sharingService||''),shares:Number(r.shares||0)})),
    partialErrors:results.map((r,i)=>r.status==='rejected'?cleanPlainText(r.reason?.message||r.reason,260):'').filter(Boolean),
    updatedAt:new Date().toISOString()
  };
}

async function fetchYouTubeCountryGrowth(env) {
  const config = youtubeOAuthClient(env);
  const refreshToken = await getYoutubeRefreshToken(env);
  if (!config.configured || !refreshToken) return { configured:config.configured, connected:false, weeklyCountries:[], previousWeekCountries:[] };
  const accessToken = await getYoutubeOAuthAccessToken(env);
  const weekStartDate = isoDateDaysAgo(7);
  const weekEndDate = isoDateDaysAgo(1);
  const previousWeekStartDate = isoDateDaysAgo(14);
  const previousWeekEndDate = isoDateDaysAgo(8);
  const timeout = label => new Promise((_, reject) => setTimeout(() => reject(new Error(label)), 12000));
  const results = await Promise.allSettled([
    Promise.race([
      youtubeAnalyticsQuery(env, accessToken,{ids:'channel==MINE',startDate:weekStartDate,endDate:weekEndDate,dimensions:'country',metrics:'views,estimatedMinutesWatched',sort:'-views',maxResults:200}),
      timeout('youtube-weekly-growth-timeout')
    ]),
    Promise.race([
      youtubeAnalyticsQuery(env, accessToken,{ids:'channel==MINE',startDate:previousWeekStartDate,endDate:previousWeekEndDate,dimensions:'country',metrics:'views,estimatedMinutesWatched',sort:'-views',maxResults:200}),
      timeout('youtube-previous-week-growth-timeout')
    ])
  ]);
  const cleanCountries = rows => (rows || [])
    .map(row => ({ country:String(row.country || '').toUpperCase(), views:Number(row.views || 0), estimatedMinutesWatched:Number(row.estimatedMinutesWatched || 0) }))
    .filter(row => row.country && row.country !== 'ZZ' && row.views > 0)
    .sort((a,b) => b.views - a.views || a.country.localeCompare(b.country));
  const weeklyCountries = results[0].status === 'fulfilled' ? cleanCountries(results[0].value) : [];
  const previousWeekCountries = results[1].status === 'fulfilled' ? cleanCountries(results[1].value) : [];
  const errors = results.filter(item => item.status === 'rejected').map(item => cleanPlainText(item.reason?.message || item.reason,260));
  return {
    configured:true,
    connected:true,
    weeklyCountries,
    previousWeekCountries,
    weekStartDate,
    weekEndDate,
    previousWeekStartDate,
    previousWeekEndDate,
    partial:Boolean(errors.length),
    errors,
    updatedAt:new Date().toISOString()
  };
}

async function handleControlCountryGrowth(request, env) {
  if (!adminAuthorized(request, env)) return json({ ok:false, error:'unauthorized' }, 401);
  const db = requireDb(env);
  await ensurePlatformAnalyticsSchema(db);
  const row = await db.prepare(`SELECT metrics_json, created_at FROM platform_snapshots WHERE platform='youtube' ORDER BY created_at DESC LIMIT 1`).first();
  const youtube = parseSnapshotMetrics(row);
  let studio = youtube?.studio || {};
  let mode = 'snapshot';
  let liveError = '';
  const hasWeekly = Array.isArray(studio.weeklyCountries) && studio.weeklyCountries.length;
  if (!hasWeekly) {
    const oauth = await getYoutubeOAuthRuntimeStatus(env,{ verify:false });
    if (oauth.connected) {
      try {
        const growth = await fetchYouTubeCountryGrowth(env);
        studio = { ...studio, ...growth, connected:true };
        mode = 'live';
        if (youtube?.configured) await savePlatformSnapshot(db,'youtube',{ ...youtube, studio },'country-growth-live');
      } catch (error) { liveError = cleanPlainText(error?.message || error, 300); }
    }
  }
  return json({
    ok:true, mode,
    configured:Boolean(youtube?.configured),
    connected:Boolean(studio?.connected),
    weeklyCountries:Array.isArray(studio.weeklyCountries) ? studio.weeklyCountries : [],
    previousWeekCountries:Array.isArray(studio.previousWeekCountries) ? studio.previousWeekCountries : [],
    weekStartDate:studio.weekStartDate || '', weekEndDate:studio.weekEndDate || '',
    previousWeekStartDate:studio.previousWeekStartDate || '', previousWeekEndDate:studio.previousWeekEndDate || '',
    error:liveError,
    updatedAt:studio.updatedAt || row?.created_at || youtube?.updatedAt || ''
  });
}

async function fetchYouTubeChannelAnalytics(env) {
  const apiKey = String(env.YOUTUBE_API_KEY || '').trim();
  const handle = cleanPlainText(env.YOUTUBE_CHANNEL_HANDLE || '@andrikmetal', 100);
  if (!apiKey) return { configured: false, handle };
  const url = new URL('https://www.googleapis.com/youtube/v3/channels');
  url.searchParams.set('part', 'snippet,statistics');
  url.searchParams.set('forHandle', handle);
  url.searchParams.set('key', apiKey);
  await trackObservabilityUsage(env, 'youtube-data-api', observabilityQuotaCost('channels'), 1, { endpoint:'channels', source:'channel-statistics' }).catch(() => {});
  const response = await fetch(url.toString(), { headers: { accept: 'application/json' } });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data?.error?.message || `youtube-statistics-${response.status}`);
  const channel = data?.items?.[0];
  if (!channel) throw new Error('youtube-channel-not-found');
  const statistics = channel.statistics || {};
  const [studioResult, growthResult] = await Promise.allSettled([
    fetchYouTubeStudioAnalytics(env),
    fetchYouTubeCountryGrowth(env)
  ]);
  const studioBase = studioResult.status === 'fulfilled'
    ? studioResult.value
    : { configured:Boolean(env.YOUTUBE_OAUTH_CLIENT_ID && env.YOUTUBE_OAUTH_CLIENT_SECRET && (env.YOUTUBE_OAUTH_REFRESH_TOKEN || env.YOUTUBE_REFRESH_TOKEN)), connected:false, workerManaged:true, error:cleanPlainText(studioResult.reason?.message || studioResult.reason, 300) };
  const growth = growthResult.status === 'fulfilled'
    ? growthResult.value
    : { weeklyCountries:[], previousWeekCountries:[], error:cleanPlainText(growthResult.reason?.message || growthResult.reason, 300) };
  const studio = {
    ...studioBase,
    workerManaged:true,
    weeklyCountries:Array.isArray(growth.weeklyCountries) ? growth.weeklyCountries : [],
    previousWeekCountries:Array.isArray(growth.previousWeekCountries) ? growth.previousWeekCountries : [],
    weekStartDate:growth.weekStartDate || '',
    weekEndDate:growth.weekEndDate || '',
    previousWeekStartDate:growth.previousWeekStartDate || '',
    previousWeekEndDate:growth.previousWeekEndDate || '',
    partialErrors:[...(studioBase.partialErrors || []), ...(growth.error ? [growth.error] : []), ...((growth.errors || []))]
  };
  return {
    configured: true,
    channelId: cleanPlainText(channel.id, 100),
    handle,
    title: cleanPlainText(channel?.snippet?.title || 'ANDRIK', 120),
    views: Number(statistics.viewCount || 0),
    subscribers: Number(statistics.subscriberCount || 0),
    hiddenSubscribers: Boolean(statistics.hiddenSubscriberCount),
    videos: Number(statistics.videoCount || 0),
    studio,
    updatedAt: new Date().toISOString()
  };
}


async function savePlatformSnapshot(db, platform, metrics, source = '') {
  await ensurePlatformAnalyticsSchema(db);
  await db.prepare(`
    INSERT INTO platform_snapshots (id, platform, period_start, period_end, metrics_json, source, created_at)
    VALUES (?, ?, ?, ?, ?, ?, datetime('now'))
  `).bind(
    crypto.randomUUID(), cleanPlainText(platform, 40), '', new Date().toISOString(),
    JSON.stringify(metrics || {}), cleanPlainText(source, 120)
  ).run();
  await db.prepare(`
    DELETE FROM platform_snapshots
    WHERE id IN (
      SELECT id FROM platform_snapshots WHERE platform = ? ORDER BY created_at DESC LIMIT -1 OFFSET 240
    )
  `).bind(platform).run().catch(() => {});
}


async function mergeYoutubeIdentityIntoLatestSnapshot(db, identity = {}, source = 'youtube-identity-live') {
  await ensurePlatformAnalyticsSchema(db);
  const row = await db.prepare(`SELECT metrics_json FROM platform_snapshots WHERE platform='youtube' ORDER BY datetime(created_at) DESC LIMIT 1`).first();
  const previous = parseSnapshotMetrics(row);
  const merged = {
    ...previous,
    configured:true,
    channelId:cleanPlainText(identity.channelId || previous.channelId || '', 100),
    handle:cleanPlainText(identity.handle || previous.handle || '@andrikmetal', 100),
    title:cleanPlainText(identity.title || previous.title || 'ANDRIK', 120),
    views:Math.max(0, Number(identity.views ?? previous.views ?? 0)),
    subscribers:Math.max(0, Number(identity.subscribers ?? previous.subscribers ?? 0)),
    hiddenSubscribers:Boolean(identity.hiddenSubscribers ?? previous.hiddenSubscribers),
    videos:Math.max(0, Number(identity.videos ?? previous.videos ?? 0)),
    likesTotal:Math.max(0, Number(identity.likesTotal ?? previous.likesTotal ?? 0)),
    commentsTotal:Math.max(0, Number(identity.commentsTotal ?? previous.commentsTotal ?? 0)),
    trackedVideos:Math.max(0, Number(identity.trackedVideos ?? previous.trackedVideos ?? 0)),
    channelUrl:cleanPlainText(identity.channelUrl || previous.channelUrl || '', 700),
    studio:previous.studio || {},
    updatedAt:new Date().toISOString()
  };
  await savePlatformSnapshot(db, 'youtube', merged, source);
  return merged;
}

async function refreshControlSnapshots(env, { force = false } = {}) {
  const db = requireDb(env);
  await Promise.all([ensurePlatformAnalyticsSchema(db), ensurePushAutomationSchema(db)]);
  const [last, latestYoutubeSnapshot] = await Promise.all([
    getPushState(db, 'control-snapshots-last-at'),
    db.prepare(`SELECT metrics_json FROM platform_snapshots WHERE platform='youtube' ORDER BY created_at DESC LIMIT 1`).first()
  ]);
  const lastMs = Date.parse(last?.value || '');
  const ageMinutes = Number.isFinite(lastMs) ? Math.max(0, Math.round((Date.now() - lastMs) / 60000)) : null;
  const latestYoutubeMetrics = parseSnapshotMetrics(latestYoutubeSnapshot);
  const hasCompleteYoutubeSnapshot = Boolean(latestYoutubeMetrics?.configured)
    && Array.isArray(latestYoutubeMetrics?.studio?.countries)
    && Array.isArray(latestYoutubeMetrics?.studio?.dailyCountries)
    && Array.isArray(latestYoutubeMetrics?.studio?.weeklyCountries)
    && Array.isArray(latestYoutubeMetrics?.studio?.previousWeekCountries)
    && Array.isArray(latestYoutubeMetrics?.studio?.trend)
    && Array.isArray(latestYoutubeMetrics?.studio?.age)
    && Array.isArray(latestYoutubeMetrics?.studio?.gender)
    && Array.isArray(latestYoutubeMetrics?.studio?.sharing);
  if (!force && ageMinutes !== null && ageMinutes < 55 && hasCompleteYoutubeSnapshot) {
    return { ok:true, skipped:true, reason:'fresh', ageMinutes, updatedAt:last.value };
  }

  const startedAt = new Date().toISOString();
  await setPushState(db, 'control-snapshots-last-status', 'running');
  const results = await Promise.allSettled([
    fetchGoogleSiteAnalytics(env),
    fetchYouTubeChannelAnalytics(env),
    fetchGoogleSearchConsoleAnalytics(env)
  ]);
  const stored = [];
  const errors = [];

  if (results[0].status === 'fulfilled' && results[0].value?.configured) {
    const ga = results[0].value;
    await savePlatformSnapshot(db, 'google-analytics', {
      configured:true,
      propertyId:ga.propertyId || '',
      propertyName:ga.propertyName || 'andrikmetal.com',
      propertySource:ga.propertySource || '',
      realtime:ga.realtime || {}, today:ga.today || {}, week:ga.week || {}, month:ga.month || {},
      trend:ga.trend || [], countries:ga.countries || [], pages:ga.pages || [], devices:ga.devices || [],
      updatedAt:ga.updatedAt || startedAt
    }, 'Google Analytics Data API');
    stored.push('google-analytics');
  } else if (results[0].status === 'rejected') {
    errors.push(`Google Analytics: ${cleanPlainText(results[0].reason?.message || results[0].reason, 260)}`);
  }

  if (results[1].status === 'fulfilled' && results[1].value?.configured) {
    const yt = results[1].value;
    await savePlatformSnapshot(db, 'youtube', {
      configured:true,
      channelId:yt.channelId || '',
      handle:yt.handle || '@andrikmetal',
      title:yt.title || 'ANDRIK',
      views:Number(yt.views || 0),
      subscribers:Number(yt.subscribers || 0),
      hiddenSubscribers:Boolean(yt.hiddenSubscribers),
      videos:Number(yt.videos || 0),
      likesTotal:Math.max(0, Number(latestYoutubeMetrics?.likesTotal || 0)),
      commentsTotal:Math.max(0, Number(latestYoutubeMetrics?.commentsTotal || 0)),
      trackedVideos:Math.max(0, Number(latestYoutubeMetrics?.trackedVideos || 0)),
      studio:yt.studio?.connected ? {
        configured:true,
        connected:true,
        workerManaged:true,
        summary:yt.studio.summary || {},
        trend:yt.studio.trend || [],
        countries:yt.studio.countries || [],
        dailyCountries:yt.studio.dailyCountries || [],
        weeklyCountries:yt.studio.weeklyCountries || [],
        previousWeekCountries:yt.studio.previousWeekCountries || [],
        age:yt.studio.age || [],
        gender:yt.studio.gender || [],
        sharing:yt.studio.sharing || [],
        partialErrors:yt.studio.partialErrors || [],
        countryCount:Number(yt.studio.countryCount || 0),
        startDate:yt.studio.startDate || '',
        endDate:yt.studio.endDate || '',
        dailyDate:yt.studio.dailyDate || '',
        weekStartDate:yt.studio.weekStartDate || '',
        weekEndDate:yt.studio.weekEndDate || '',
        previousWeekStartDate:yt.studio.previousWeekStartDate || '',
        previousWeekEndDate:yt.studio.previousWeekEndDate || '',
        updatedAt:yt.studio.updatedAt || startedAt
      } : {
        configured:Boolean(yt.studio?.configured),
        connected:false,
        workerManaged:true,
        error:yt.studio?.error || 'youtube-worker-refresh-token-missing'
      },
      updatedAt:yt.updatedAt || startedAt
    }, 'YouTube Data API + server refresh token');
    stored.push('youtube');
  } else if (results[1].status === 'rejected') {
    errors.push(`YouTube: ${cleanPlainText(results[1].reason?.message || results[1].reason, 260)}`);
  }

  if (results[2].status === 'fulfilled') {
    const sc = results[2].value || {};
    await savePlatformSnapshot(db, 'google-search-console', {
      ...sc,
      configured:Boolean(sc.configured),
      connected:Boolean(sc.connected),
      updatedAt:sc.updatedAt || startedAt
    }, 'Google Search Console API');
    stored.push('google-search-console');
  } else {
    errors.push(`Search Console: ${cleanPlainText(results[2].reason?.message || results[2].reason, 260)}`);
  }

  const finishedAt = new Date().toISOString();
  await setPushState(db, 'control-snapshots-last-at', finishedAt);
  await setPushState(db, 'control-snapshots-last-status', errors.length ? (stored.length ? 'partial' : 'failed') : 'ok');
  await setPushState(db, 'control-snapshots-last-summary', JSON.stringify({ stored, errors, startedAt, finishedAt }));
  return {
    ok:stored.length > 0,
    stored,
    errors,
    startedAt,
    updatedAt:finishedAt,
    google:results[0].status === 'fulfilled' ? results[0].value : null,
    youtube:results[1].status === 'fulfilled' ? results[1].value : null,
    searchConsole:results[2].status === 'fulfilled' ? results[2].value : null
  };
}

async function maybeCreateDailyBackup(env) {
  const db = requireDb(env);
  await ensureControlV1Schema(db);
  const latest = await db.prepare(`
    SELECT id, created_at AS createdAt FROM backup_history
    WHERE status='completed' ORDER BY created_at DESC LIMIT 1
  `).first();
  const lastMs = Date.parse(latest?.createdAt || '');
  const ageHours = Number.isFinite(lastMs) ? (Date.now() - lastMs) / 3600000 : null;
  if (ageHours !== null && ageHours < 20) return { ok:true, skipped:true, reason:'fresh', lastBackupAt:latest.createdAt };
  try {
    const backup = await createControlBackup(env, 'central-cron');
    return { ok:true, skipped:false, backup };
  } catch (error) {
    return { ok:false, error:cleanPlainText(error?.message || error, 500) };
  }
}

async function responseData(response) {
  const data = await response.json().catch(() => ({}));
  return { httpOk:response.ok, status:response.status, ...data };
}


function getBratislavaClock(date = new Date()) {
  const values = {};
  for (const part of new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Europe/Bratislava',
    year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit', hourCycle: 'h23'
  }).formatToParts(date)) {
    if (part.type !== 'literal') values[part.type] = part.value;
  }
  return {
    date: `${values.year}-${values.month}-${values.day}`,
    hour: Number(values.hour || 0),
    minute: Number(values.minute || 0)
  };
}


function shiftIsoCalendarDate(dateText, days) {
  const match = String(dateText || '').match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!match) return '';
  const date = new Date(Date.UTC(Number(match[1]), Number(match[2]) - 1, Number(match[3]) + Number(days || 0)));
  return date.toISOString().slice(0, 10);
}

function bratislavaLocalDateTimeToIso(dateText, hour = 0, minute = 0) {
  const match = String(dateText || '').match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!match) return new Date().toISOString();
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const targetAsUtc = Date.UTC(year, month - 1, day, Number(hour || 0), Number(minute || 0), 0, 0);
  let guess = targetAsUtc;
  const formatter = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Europe/Bratislava',
    year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit', second: '2-digit', hourCycle: 'h23'
  });
  for (let index = 0; index < 3; index += 1) {
    const parts = {};
    for (const part of formatter.formatToParts(new Date(guess))) {
      if (part.type !== 'literal') parts[part.type] = part.value;
    }
    const representedAsUtc = Date.UTC(
      Number(parts.year || year), Number(parts.month || month) - 1, Number(parts.day || day),
      Number(parts.hour || 0), Number(parts.minute || 0), Number(parts.second || 0), 0
    );
    const correction = targetAsUtc - representedAsUtc;
    guess += correction;
    if (Math.abs(correction) < 1000) break;
  }
  return new Date(guess).toISOString();
}

function getBratislavaSummaryWindow(date = new Date()) {
  const clock = getBratislavaClock(date);
  const afterCutoff = clock.hour > 6 || (clock.hour === 6 && clock.minute >= 5);
  const windowDate = afterCutoff ? clock.date : shiftIsoCalendarDate(clock.date, -1);
  const nextDate = shiftIsoCalendarDate(windowDate, 1);
  return {
    key: windowDate,
    startAt: bratislavaLocalDateTimeToIso(windowDate, 6, 5),
    endAt: bratislavaLocalDateTimeToIso(nextDate, 6, 5),
    currentLocalDate: clock.date,
    crossesMidnight: clock.date !== windowDate,
    midnightAt: bratislavaLocalDateTimeToIso(clock.date, 0, 0),
    cutoffLabel: '06:05 Europe/Bratislava'
  };
}



function latestYoutubeReleaseCountForWindow(stateRow, window) {
  const latest = parsePushSummary(stateRow?.value || '');
  if (!latest?.videoId || !window?.startAt || !window?.endAt) return 0;
  const publishedAt = Date.parse(latest.publishedAt || '');
  const startAt = Date.parse(window.startAt || '');
  const endAt = Date.parse(window.endAt || '');
  if (![publishedAt, startAt, endAt].every(Number.isFinite)) return 0;
  return publishedAt >= startAt && publishedAt < endAt ? 1 : 0;
}

function getBratislavaCompletedSummaryWindow(date = new Date()) {
  const clock = getBratislavaClock(date);
  const windowDate = shiftIsoCalendarDate(clock.date, -1);
  return {
    key: windowDate,
    startAt: bratislavaLocalDateTimeToIso(windowDate, 6, 5),
    endAt: bratislavaLocalDateTimeToIso(clock.date, 6, 5),
    currentLocalDate: clock.date,
    crossesMidnight: true,
    midnightAt: bratislavaLocalDateTimeToIso(clock.date, 0, 0),
    cutoffLabel: '06:05 Europe/Bratislava',
    completed: true
  };
}

function googleSummaryWindowMetric(current, baseline, rollover, window, field) {
  if (!baseline?.__snapshotFound) return 0;
  const nowValue = Number(current?.today?.[field] || 0);
  const baselineValue = Number(baseline?.today?.[field] || 0);
  if (!window?.crossesMidnight) return Math.max(0, nowValue - baselineValue);
  const rolloverValue = Number(rollover?.today?.[field] || baselineValue);
  return Math.max(0, rolloverValue - baselineValue) + Math.max(0, nowValue);
}

async function fetchGoogleAnalyticsYesterday(env) {
  if (!String(env.GOOGLE_ANALYTICS_CREDENTIALS || '').trim()) return { configured:false };
  const accessToken = await getGoogleAnalyticsAccessToken(env);
  const property = await resolveGoogleAnalyticsProperty(env, accessToken);
  const report = await googleAnalyticsPost(accessToken, property.id, 'runReport', {
    dateRanges: [{ startDate:'yesterday', endDate:'yesterday' }],
    metrics: [{ name:'activeUsers' }, { name:'sessions' }, { name:'screenPageViews' }, { name:'eventCount' }],
    limit:'1'
  });
  return { configured:true, ...gaSummary(report) };
}

const DAILY_COUNTRY_META = {
  'UNITED STATES': { name:'США', flag:'🇺🇸' }, 'UNITED STATES OF AMERICA': { name:'США', flag:'🇺🇸' }, 'US': { name:'США', flag:'🇺🇸' },
  'SLOVAKIA': { name:'Словакия', flag:'🇸🇰' }, 'SK': { name:'Словакия', flag:'🇸🇰' },
  'CHINA': { name:'Китай', flag:'🇨🇳' }, 'CN': { name:'Китай', flag:'🇨🇳' },
  'CANADA': { name:'Канада', flag:'🇨🇦' }, 'CA': { name:'Канада', flag:'🇨🇦' },
  'FRANCE': { name:'Франция', flag:'🇫🇷' }, 'FR': { name:'Франция', flag:'🇫🇷' },
  'NETHERLANDS': { name:'Нидерланды', flag:'🇳🇱' }, 'NL': { name:'Нидерланды', flag:'🇳🇱' },
  'UNITED KINGDOM': { name:'Великобритания', flag:'🇬🇧' }, 'UK': { name:'Великобритания', flag:'🇬🇧' }, 'GB': { name:'Великобритания', flag:'🇬🇧' },
  'GERMANY': { name:'Германия', flag:'🇩🇪' }, 'DE': { name:'Германия', flag:'🇩🇪' },
  'UKRAINE': { name:'Украина', flag:'🇺🇦' }, 'UA': { name:'Украина', flag:'🇺🇦' },
  'RUSSIA': { name:'Россия', flag:'🇷🇺' }, 'RUSSIAN FEDERATION': { name:'Россия', flag:'🇷🇺' }, 'RU': { name:'Россия', flag:'🇷🇺' },
  'CZECHIA': { name:'Чехия', flag:'🇨🇿' }, 'CZECH REPUBLIC': { name:'Чехия', flag:'🇨🇿' }, 'CZ': { name:'Чехия', flag:'🇨🇿' },
  'POLAND': { name:'Польша', flag:'🇵🇱' }, 'PL': { name:'Польша', flag:'🇵🇱' },
  'AUSTRIA': { name:'Австрия', flag:'🇦🇹' }, 'AT': { name:'Австрия', flag:'🇦🇹' },
  'SPAIN': { name:'Испания', flag:'🇪🇸' }, 'ES': { name:'Испания', flag:'🇪🇸' },
  'ITALY': { name:'Италия', flag:'🇮🇹' }, 'IT': { name:'Италия', flag:'🇮🇹' },
  'BRAZIL': { name:'Бразилия', flag:'🇧🇷' }, 'BR': { name:'Бразилия', flag:'🇧🇷' },
  'AUSTRALIA': { name:'Австралия', flag:'🇦🇺' }, 'AU': { name:'Австралия', flag:'🇦🇺' },
  'JAPAN': { name:'Япония', flag:'🇯🇵' }, 'JP': { name:'Япония', flag:'🇯🇵' },
  'INDIA': { name:'Индия', flag:'🇮🇳' }, 'IN': { name:'Индия', flag:'🇮🇳' },
  'PORTUGAL': { name:'Португалия', flag:'🇵🇹' }, 'PT': { name:'Португалия', flag:'🇵🇹' },
  'SOUTH KOREA': { name:'Южная Корея', flag:'🇰🇷' }, 'REPUBLIC OF KOREA': { name:'Южная Корея', flag:'🇰🇷' }, 'KOREA': { name:'Южная Корея', flag:'🇰🇷' }, 'KR': { name:'Южная Корея', flag:'🇰🇷' },
  'TAIWAN': { name:'Тайвань', flag:'🇹🇼' }, 'TW': { name:'Тайвань', flag:'🇹🇼' },
  'BULGARIA': { name:'Болгария', flag:'🇧🇬' }, 'BG': { name:'Болгария', flag:'🇧🇬' },
  'IRELAND': { name:'Ирландия', flag:'🇮🇪' }, 'IE': { name:'Ирландия', flag:'🇮🇪' },
  'SWITZERLAND': { name:'Швейцария', flag:'🇨🇭' }, 'CH': { name:'Швейцария', flag:'🇨🇭' },
  'BELGIUM': { name:'Бельгия', flag:'🇧🇪' }, 'BE': { name:'Бельгия', flag:'🇧🇪' },
  'DENMARK': { name:'Дания', flag:'🇩🇰' }, 'DK': { name:'Дания', flag:'🇩🇰' },
  'GREECE': { name:'Греция', flag:'🇬🇷' }, 'GR': { name:'Греция', flag:'🇬🇷' },
  'CROATIA': { name:'Хорватия', flag:'🇭🇷' }, 'HR': { name:'Хорватия', flag:'🇭🇷' },
  'SLOVENIA': { name:'Словения', flag:'🇸🇮' }, 'SI': { name:'Словения', flag:'🇸🇮' },
  'SERBIA': { name:'Сербия', flag:'🇷🇸' }, 'RS': { name:'Сербия', flag:'🇷🇸' },
  'LITHUANIA': { name:'Литва', flag:'🇱🇹' }, 'LT': { name:'Литва', flag:'🇱🇹' },
  'LATVIA': { name:'Латвия', flag:'🇱🇻' }, 'LV': { name:'Латвия', flag:'🇱🇻' },
  'ESTONIA': { name:'Эстония', flag:'🇪🇪' }, 'EE': { name:'Эстония', flag:'🇪🇪' },
  'MOLDOVA': { name:'Молдова', flag:'🇲🇩' }, 'MD': { name:'Молдова', flag:'🇲🇩' },
  'TURKEY': { name:'Турция', flag:'🇹🇷' }, 'TÜRKIYE': { name:'Турция', flag:'🇹🇷' }, 'TR': { name:'Турция', flag:'🇹🇷' },
  'ISRAEL': { name:'Израиль', flag:'🇮🇱' }, 'IL': { name:'Израиль', flag:'🇮🇱' },
  'UNITED ARAB EMIRATES': { name:'ОАЭ', flag:'🇦🇪' }, 'AE': { name:'ОАЭ', flag:'🇦🇪' },
  'KAZAKHSTAN': { name:'Казахстан', flag:'🇰🇿' }, 'KZ': { name:'Казахстан', flag:'🇰🇿' },
  'GEORGIA': { name:'Грузия', flag:'🇬🇪' }, 'GE': { name:'Грузия', flag:'🇬🇪' },
  'ARMENIA': { name:'Армения', flag:'🇦🇲' }, 'AM': { name:'Армения', flag:'🇦🇲' },
  'AZERBAIJAN': { name:'Азербайджан', flag:'🇦🇿' }, 'AZ': { name:'Азербайджан', flag:'🇦🇿' },
  'MEXICO': { name:'Мексика', flag:'🇲🇽' }, 'MX': { name:'Мексика', flag:'🇲🇽' },
  'ARGENTINA': { name:'Аргентина', flag:'🇦🇷' }, 'AR': { name:'Аргентина', flag:'🇦🇷' },
  'CHILE': { name:'Чили', flag:'🇨🇱' }, 'CL': { name:'Чили', flag:'🇨🇱' },
  'COLOMBIA': { name:'Колумбия', flag:'🇨🇴' }, 'CO': { name:'Колумбия', flag:'🇨🇴' },
  'PERU': { name:'Перу', flag:'🇵🇪' }, 'PE': { name:'Перу', flag:'🇵🇪' },
  'SOUTH AFRICA': { name:'ЮАР', flag:'🇿🇦' }, 'ZA': { name:'ЮАР', flag:'🇿🇦' },
  'NEW ZEALAND': { name:'Новая Зеландия', flag:'🇳🇿' }, 'NZ': { name:'Новая Зеландия', flag:'🇳🇿' },
  'INDONESIA': { name:'Индонезия', flag:'🇮🇩' }, 'ID': { name:'Индонезия', flag:'🇮🇩' },
  'THAILAND': { name:'Таиланд', flag:'🇹🇭' }, 'TH': { name:'Таиланд', flag:'🇹🇭' },
  'VIETNAM': { name:'Вьетнам', flag:'🇻🇳' }, 'VN': { name:'Вьетнам', flag:'🇻🇳' },
  'PHILIPPINES': { name:'Филиппины', flag:'🇵🇭' }, 'PH': { name:'Филиппины', flag:'🇵🇭' },
  'MALAYSIA': { name:'Малайзия', flag:'🇲🇾' }, 'MY': { name:'Малайзия', flag:'🇲🇾' },
  'SINGAPORE': { name:'Сингапур', flag:'🇸🇬' }, 'SG': { name:'Сингапур', flag:'🇸🇬' },
  'HONG KONG': { name:'Гонконг', flag:'🇭🇰' }, 'HK': { name:'Гонконг', flag:'🇭🇰' },
  'UZBEKISTAN': { name:'Узбекистан', flag:'🇺🇿' }, 'UZ': { name:'Узбекистан', flag:'🇺🇿' }
};
function dailyCountryMeta(value) {
  const raw = String(value || '').trim();
  if (!raw) return { name:'', flag:'🌍' };
  const upper = raw.toUpperCase();
  if (DAILY_COUNTRY_META[upper] || DAILY_COUNTRY_META[raw]) return DAILY_COUNTRY_META[upper] || DAILY_COUNTRY_META[raw];
  if (/^[A-Z]{2}$/.test(upper)) {
    let name = raw;
    try { name = new Intl.DisplayNames(['ru'], { type:'region' }).of(upper) || raw; } catch (_) {}
    const flag = String.fromCodePoint(...[...upper].map(char => 127397 + char.charCodeAt(0)));
    return { name, flag };
  }
  return { name: raw, flag:'🌍' };
}
function normalizeDailyCountryRows(rows = []) {
  return (Array.isArray(rows) ? rows : [])
    .map(row => {
      const meta = dailyCountryMeta(row?.country || row?.name || '');
      return { country: meta.name, flag: meta.flag, value: Number(row?.activeUsers || row?.users || row?.views || row?.count || 0) };
    })
    .filter(item => item.country && item.country !== '(не задано)')
    .sort((a, b) => b.value - a.value || a.country.localeCompare(b.country, 'ru'));
}
async function maybeSendNewCountryAlerts(env, currentRows = []) {
  const db = requireDb(env);
  await ensurePushAutomationSchema(db);
  const current = normalizeDailyCountryRows(currentRows);
  if (!current.length) return { ok:true, skipped:true, reason:'no-countries' };
  const state = await getPushState(db, 'youtube-audience-known-countries-v54-24');
  let knownList = [];
  try { const parsed = JSON.parse(state?.value || '[]'); knownList = Array.isArray(parsed) ? parsed : []; } catch (_) { knownList = []; }
  if (!knownList.length) {
    await setPushState(db, 'youtube-audience-known-countries-v54-24', JSON.stringify(current.map(item => item.country)));
    return { ok:true, skipped:true, seeded:true, totalCountries:current.length };
  }
  const known = new Set(knownList);
  const fresh = current.filter(item => !known.has(item.country));
  for (const item of fresh.slice(0, 5)) {
    await sendOwnerPush(env, {
      title: '🎉 Новая страна!',
      message: item.flag + ' ' + item.country + ' присоединилась к аудитории ANDRIK\n🌍 Теперь вас слушают уже в ' + current.length + ' странах',
      url: 'https://control.andrikmetal.com/analytics-admin.html',
      name: 'new-country-' + item.country + '-' + current.length,
      history: {
        type:'country-new',
        source:'youtube-studio',
        title:'🎉 Новая страна!',
        message:item.flag + ' ' + item.country + ' присоединилась к аудитории ANDRIK',
        url:'https://control.andrikmetal.com/analytics-admin.html',
        details:{ country:item.country, flag:item.flag, totalCountries:current.length }
      }
    }).catch(() => null);
  }
  await setPushState(db, 'youtube-audience-known-countries-v54-24', JSON.stringify(Array.from(new Set([...knownList, ...current.map(item => item.country)]))));
  return { ok:true, sent:fresh.length, totalCountries:current.length, countries:fresh.map(item => item.country) };
}


function latestYouTubeStudioDailyMetric(youtube = {}, metric = 'likes') {
  const rows = Array.isArray(youtube?.studio?.trend) ? youtube.studio.trend : [];
  if (!rows.length) return 0;
  const preferredDate = cleanPlainText(youtube?.studio?.dailyDate || '', 20);
  const preferred = preferredDate ? rows.find(row => String(row?.day || '') === preferredDate) : null;
  const row = preferred || rows[rows.length - 1] || {};
  return Math.max(0, Number(row?.[metric] || 0));
}

function sumYoutubeLikeHistoryDeltas(rows = []) {
  return (Array.isArray(rows) ? rows : []).reduce((sum, row) => {
    let details = {};
    try { details = JSON.parse(row?.detailsJson || row?.details_json || '{}'); } catch (_) {}
    const stored = Number(details?.delta || details?.likeDelta || 0);
    if (stored > 0) return sum + stored;
    const message = String(row?.message || '');
    const match = message.match(/\+(\d+)\s+лайк/iu);
    return sum + (match ? Math.max(0, Number(match[1] || 0)) : 0);
  }, 0);
}


function sumYoutubeSubscriberHistoryDeltas(rows = []) {
  return (Array.isArray(rows) ? rows : []).reduce((sum, row) => {
    let details = {};
    try { details = JSON.parse(row?.detailsJson || row?.details_json || '{}'); } catch (_) {}
    const stored = Number(details?.delta || details?.subscriberDelta || 0);
    if (stored > 0) return sum + stored;
    const type = cleanPlainText(row?.type || '', 80);
    if (type === 'youtube-subscriber') return sum + 1;
    const title = String(row?.title || '');
    const message = String(row?.message || '');
    const match = `${title} ${message}`.match(/\+(\d+)\s+подпис/iu);
    return sum + (match ? Math.max(0, Number(match[1] || 0)) : 1);
  }, 0);
}

function buildDailyOwnerSummaryLines(metrics = {}) {
  const lines = [];
  const word = (value, one, few, many) => {
    const n = Math.abs(Number(value || 0));
    const n10 = n % 10, n100 = n % 100;
    if (n10 === 1 && n100 !== 11) return one;
    if (n10 >= 2 && n10 <= 4 && (n100 < 12 || n100 > 14)) return few;
    return many;
  };
  const add = (icon, value, labels, plus = false) => {
    const n = Number(value || 0);
    if (n <= 0) return;
    lines.push(`${icon} ${plus ? '+' : ''}${n} ${word(n, ...labels)}`);
  };

  const youtubeCount = [metrics.youtubeSubscribers, metrics.youtubeLikes, metrics.youtubeComments, metrics.youtubeViewDelta]
    .some(value => Number(value || 0) > 0);
  if (youtubeCount) {
    lines.push('  YouTube:');
    add('👤', metrics.youtubeSubscribers, ['подписчик','подписчика','подписчиков'], true);
    add('👍', metrics.youtubeLikes, ['лайк','лайка','лайков'], true);
    add('💬', metrics.youtubeComments, ['комментарий','комментария','комментариев']);
    add('▶️', metrics.youtubeViewDelta, ['просмотр','просмотра','просмотров'], true);
  }

  const siteCount = [metrics.siteUsers, metrics.siteViews, metrics.siteSubscribers, metrics.siteComments]
    .some(value => Number(value || 0) > 0);
  if (siteCount) {
    lines.push('  Официальный сайт:');
    add('🌐', metrics.siteUsers, ['посетитель','посетителя','посетителей']);
    add('👁', metrics.siteViews, ['просмотр','просмотра','просмотров']);
    add('🔔', metrics.siteSubscribers, ['подписчик','подписчика','подписчиков'], true);
    add('✉️', metrics.siteComments, ['сообщение','сообщения','сообщений']);
  }

  if (Number(metrics.pendingComments || 0) > 0) {
    const n = Number(metrics.pendingComments);
    lines.push(`🛡 ${n} ${word(n,'ждёт','ждут','ждут')} проверки`);
  }
  if (Number(metrics.releases || 0) > 0) {
    const n = Number(metrics.releases);
    lines.push(`🚀 ${n} ${word(n,'релиз','релиза','релизов')}`);
  }
  if (!lines.length) lines.push('За сутки новых событий нет');
  if (metrics.partial) lines.push('⚠️ Часть источников временно недоступна');
  return lines;
}

// R305: keep the current 06:05→06:05 summary warm even when Control is closed.
// Both the central Cron and the external Guard health probe may call this helper;
// a D1 lock prevents duplicate Google API work.
async function refreshDailySummaryAccumulatorR305(env, source = 'background') {
  if (!env.COMMENTS_DB) return { ok:false, skipped:true, reason:'database-not-configured' };
  const db = requireDb(env);
  await Promise.all([
    ensurePushAutomationSchema(db),
    ensurePlatformAnalyticsSchema(db),
    ensureControlV1Schema(db),
    ensureSiteMetricsSchema(db),
    ensureCommentsV4Schema(db)
  ]);

  const lockKey = 'control-summary-auto-refresh-lock-r305';
  const lastKey = 'control-summary-auto-refresh-last-at-r305';
  const last = await getPushState(db, lastKey).catch(() => null);
  const lastMs = Date.parse(last?.value || last?.updatedAt || '');
  if (Number.isFinite(lastMs) && Date.now() - lastMs < 8 * 60 * 1000) {
    return { ok:true, skipped:true, reason:'recent-summary-refresh', lastAt:last?.value || last?.updatedAt || '' };
  }

  await db.prepare(`DELETE FROM push_state WHERE key=? AND updated_at < datetime('now','-12 minutes')`).bind(lockKey).run().catch(() => {});
  if (!await claimPushOnce(db, lockKey, new Date().toISOString())) {
    return { ok:true, skipped:true, reason:'summary-refresh-already-running' };
  }

  const startedAt = new Date().toISOString();
  let google = { ok:true, skipped:true, reason:'not-configured' };
  let collectionError = '';
  try {
    if (String(env.GOOGLE_ANALYTICS_CREDENTIALS || '').trim()) {
      try {
        const liveGoogle = await Promise.race([
          fetchGoogleSiteAnalytics(env),
          new Promise((_, reject) => setTimeout(() => reject(new Error('google-summary-refresh-timeout')), 12000))
        ]);
        if (liveGoogle?.configured) {
          await savePlatformSnapshot(db, 'google-analytics', {
            configured:true,
            propertyId:liveGoogle.propertyId || '',
            propertyName:liveGoogle.propertyName || 'andrikmetal.com',
            propertySource:liveGoogle.propertySource || '',
            realtime:liveGoogle.realtime || {},
            today:liveGoogle.today || {},
            week:liveGoogle.week || {},
            month:liveGoogle.month || {},
            trend:liveGoogle.trend || [],
            countries:liveGoogle.countries || [],
            pages:liveGoogle.pages || [],
            devices:liveGoogle.devices || [],
            updatedAt:liveGoogle.updatedAt || startedAt
          }, `Google Analytics auto summary R305 · ${source}`);
          google = { ok:true, updatedAt:liveGoogle.updatedAt || startedAt, views:Number(liveGoogle?.today?.screenPageViews || 0), users:Number(liveGoogle?.today?.activeUsers || 0) };
        }
      } catch (error) {
        google = { ok:false, error:cleanPlainText(error?.message || error, 420) };
      }
    }

    const window = getBratislavaSummaryWindow();
    let metrics;
    try {
      metrics = await collectDailyOwnerSummary(env, { liveExternal:false, windowOverride:window });
    } catch (error) {
      collectionError = cleanPlainText(error?.message || error, 500);
      metrics = await collectDailyOwnerSummaryFallback(env, window, collectionError);
    }

    await persistControlHomeHighWaterFromMetricsR260(db, window.key, metrics).catch(() => {});
    const finishedAt = new Date().toISOString();
    await setPushState(db, lastKey, finishedAt).catch(() => {});
    await setPushState(db, 'control-summary-auto-refresh-last-status-r305', google.ok === false ? 'partial' : 'ok').catch(() => {});
    await recordSystemLog(env, {
      scope:'daily-summary', level:google.ok === false ? 'warning' : 'info', event:'auto-refresh-r305',
      message:`Сводка автоматически обновлена · ${source}.`,
      details:{ source, startedAt, finishedAt, windowKey:window.key, google, metrics, collectionError }
    }).catch(() => {});
    return { ok:true, source, windowKey:window.key, google, metrics, collectionError, updatedAt:finishedAt };
  } finally {
    await releasePushOnceClaim(db, lockKey).catch(() => {});
  }
}

async function collectDailyOwnerSummary(env, { liveExternal = true, windowOverride = null } = {}) {
  const db = requireDb(env);
  const window = windowOverride || getBratislavaSummaryWindow();
  await Promise.all([ensurePushAutomationSchema(db), ensureCommentsV4Schema(db), ensurePlatformAnalyticsSchema(db), ensureControlV1Schema(db), ensureSiteMetricsSchema(db)]);
  const [siteSubscribers, siteComments, pendingComments, youtubeEvents, youtubeLikeRows, youtubeSubscriberRows, releases, latestYoutubeState, ytLatest, ytBaselineBefore, ytBaselineAfter, gaLatest, gaBaselineBefore, gaBaselineAfter, gaRollover, siteLive, siteWindow] = await Promise.all([
    db.prepare(`SELECT COUNT(*) AS total FROM push_history
      WHERE type='site-subscriber'
        AND datetime(created_at) >= datetime(?1)
        AND datetime(created_at) < datetime(?2)`).bind(window.startAt, window.endAt).first(),
    db.prepare(`SELECT COUNT(*) AS total FROM comments
      WHERE datetime(created_at) >= datetime(?1)
        AND datetime(created_at) < datetime(?2)`).bind(window.startAt, window.endAt).first(),
    db.prepare(`SELECT COUNT(*) AS total FROM comments WHERE status='pending'`).first(),
    db.prepare(`SELECT
      SUM(CASE WHEN type IN ('youtube-comment','youtube-comment-count') THEN 1 ELSE 0 END) AS comments,
      SUM(CASE WHEN type IN ('youtube-subscriber','youtube-subscriber-count') THEN 1 ELSE 0 END) AS subscribers,
      SUM(CASE WHEN type='youtube-like' THEN 1 ELSE 0 END) AS likes
      FROM push_history
      WHERE datetime(created_at) >= datetime(?1)
        AND datetime(created_at) < datetime(?2)`).bind(window.startAt, window.endAt).first(),
    db.prepare(`SELECT message, details_json AS detailsJson FROM push_history
      WHERE type='youtube-like' AND status='sent'
        AND datetime(created_at) >= datetime(?1)
        AND datetime(created_at) < datetime(?2)
      ORDER BY created_at ASC`).bind(window.startAt, window.endAt).all(),
    db.prepare(`SELECT type, title, message, details_json AS detailsJson FROM push_history
      WHERE type IN ('youtube-subscriber','youtube-subscriber-count') AND status='sent'
        AND datetime(created_at) >= datetime(?1)
        AND datetime(created_at) < datetime(?2)
      ORDER BY created_at ASC`).bind(window.startAt, window.endAt).all(),
    db.prepare(`SELECT COUNT(*) AS total FROM (
      SELECT COALESCE(NULLIF(video_id,''), id) AS release_key FROM push_history
      WHERE type IN ('auto-release','auto-release-retry','release-publish')
        AND datetime(created_at) >= datetime(?1)
        AND datetime(created_at) < datetime(?2)
      UNION
      SELECT video_id AS release_key FROM release_history
      WHERE datetime(published_at) >= datetime(?1)
        AND datetime(published_at) < datetime(?2)
    )`).bind(window.startAt, window.endAt).first(),
    getPushState(db, 'youtube-latest-public'),
    db.prepare(`SELECT metrics_json, created_at FROM platform_snapshots
      WHERE platform='youtube' AND datetime(created_at) <= datetime(?1)
      ORDER BY datetime(created_at) DESC LIMIT 1`).bind(window.endAt).first(),
    db.prepare(`SELECT metrics_json, created_at FROM platform_snapshots WHERE platform='youtube' AND datetime(created_at) <= datetime(?1) ORDER BY datetime(created_at) DESC LIMIT 1`).bind(window.startAt).first(),
    db.prepare(`SELECT metrics_json, created_at FROM platform_snapshots WHERE platform='youtube' AND datetime(created_at) >= datetime(?1) AND datetime(created_at) < datetime(?2) ORDER BY datetime(created_at) ASC LIMIT 1`).bind(window.startAt, window.endAt).first(),
    db.prepare(`SELECT metrics_json, created_at FROM platform_snapshots
      WHERE platform='google-analytics' AND datetime(created_at) <= datetime(?1)
      ORDER BY datetime(created_at) DESC LIMIT 1`).bind(window.endAt).first(),
    db.prepare(`SELECT metrics_json, created_at FROM platform_snapshots WHERE platform='google-analytics' AND datetime(created_at) <= datetime(?1) ORDER BY datetime(created_at) DESC LIMIT 1`).bind(window.startAt).first(),
    db.prepare(`SELECT metrics_json, created_at FROM platform_snapshots WHERE platform='google-analytics' AND datetime(created_at) >= datetime(?1) AND datetime(created_at) < datetime(?2) ORDER BY datetime(created_at) ASC LIMIT 1`).bind(window.startAt, window.endAt).first(),
    window.crossesMidnight
      ? db.prepare(`SELECT metrics_json, created_at FROM platform_snapshots WHERE platform='google-analytics' AND datetime(created_at) <= datetime(?1) AND datetime(created_at) >= datetime(?2) ORDER BY datetime(created_at) DESC LIMIT 1`).bind(window.midnightAt, window.startAt).first()
      : Promise.resolve(null),
    getSiteLiveMetrics(db),
    getSiteWindowMetrics(db, window.startAt, window.endAt)
  ]);
  const ytBaseline = ytBaselineBefore || ytBaselineAfter;
  const gaBaseline = gaBaselineBefore || gaBaselineAfter;
  const ytNow = parseSnapshotMetrics(ytLatest);
  const ytStart = parseSnapshotMetrics(ytBaseline);
  const gaSnapshot = parseSnapshotMetrics(gaLatest);
  const gaStart = { ...parseSnapshotMetrics(gaBaseline), __snapshotFound:Boolean(gaBaseline) };
  const gaBeforeMidnight = parseSnapshotMetrics(gaRollover);
  const youtubeSubscriberDelta = ytBaseline ? Math.max(0, Number(ytNow.subscribers || 0) - Number(ytStart.subscribers || 0)) : 0;
  const youtubeLikeSnapshotDelta = ytBaseline && Number.isFinite(Number(ytNow.likesTotal)) && Number.isFinite(Number(ytStart.likesTotal))
    ? Math.max(0, Number(ytNow.likesTotal || 0) - Number(ytStart.likesTotal || 0)) : 0;
  const youtubeCommentSnapshotDelta = ytBaseline && Number.isFinite(Number(ytNow.commentsTotal)) && Number.isFinite(Number(ytStart.commentsTotal))
    ? Math.max(0, Number(ytNow.commentsTotal || 0) - Number(ytStart.commentsTotal || 0)) : 0;
  const youtubeCountries = normalizeDailyCountryRows(ytNow?.studio?.countries || []);
  const youtubeDailyCountries = normalizeDailyCountryRows(ytNow?.studio?.dailyCountries || [])
    .map(item => ({ ...item, delta:item.value }));
  let searchConsole = { connected:false, clicks:0, impressions:0 };
  let googleCurrent = window.completed
    ? gaSnapshot
    : mergeGoogleWithSiteLive(gaSnapshot, siteLive);
  if (liveExternal) {
    const [searchResult, googleResult] = await Promise.allSettled([
      fetchGoogleSearchConsoleAnalytics(env),
      fetchGoogleSiteAnalytics(env)
    ]);
    if (searchResult.status === 'fulfilled') searchConsole = searchResult.value || searchConsole;
    if (googleResult.status === 'fulfilled' && googleResult.value?.configured) {
      googleCurrent = mergeGoogleWithSiteLive(googleResult.value, siteLive);
    }
  }
  return {
    windowKey: window.key,
    windowStartAt: window.startAt,
    windowEndAt: window.endAt,
    youtubeSubscribers: Math.max(youtubeSubscriberDelta, sumYoutubeSubscriberHistoryDeltas(youtubeSubscriberRows?.results || [])),
    youtubeLikes: Math.max(youtubeLikeSnapshotDelta, sumYoutubeLikeHistoryDeltas(youtubeLikeRows?.results || [])),
    youtubeComments: Math.max(youtubeCommentSnapshotDelta, Number(youtubeEvents?.comments || 0)),
    youtubeViewDelta: ytBaseline ? Math.max(0, Number(ytNow.views || 0) - Number(ytStart.views || 0)) : 0,
    siteUsers: Math.max(Number(siteWindow?.users || 0), googleSummaryWindowMetric(googleCurrent, gaStart, gaBeforeMidnight, window, 'activeUsers')),
    siteViews: Math.max(Number(siteWindow?.views || 0), googleSummaryWindowMetric(googleCurrent, gaStart, gaBeforeMidnight, window, 'screenPageViews')),
    siteSubscribers: Number(siteSubscribers?.total || 0),
    siteComments: Number(siteComments?.total || 0),
    pendingComments: Number(pendingComments?.total || 0),
    releases: Math.max(Number(releases?.total || 0), latestYoutubeReleaseCountForWindow(latestYoutubeState, window)),
    searchClicks: Number(searchConsole?.clicks || 0),
    searchImpressions: Number(searchConsole?.impressions || 0),
    searchConnected: Boolean(searchConsole?.connected),
    countryDeltas: youtubeDailyCountries.slice(0, 4),
    totalCountries: youtubeCountries.length,
    countryDate: ytNow?.studio?.dailyDate || ''
  };
}


async function collectDailyOwnerSummaryFallback(env, window, reason = '') {
  const db = requireDb(env);
  await Promise.allSettled([
    ensurePushAutomationSchema(db),
    ensureCommentsV4Schema(db),
    ensureControlV1Schema(db)
  ]);

  const safe = async (operation, fallback) => {
    try { return await operation; } catch (_) { return fallback; }
  };

  const [siteSubscribers, siteComments, pendingComments, youtubeEvents, youtubeLikeRows, youtubeSubscriberRows, releases, latestYoutubeState, siteWindow] = await Promise.all([
    safe(db.prepare(`SELECT COUNT(*) AS total FROM push_history
      WHERE type='site-subscriber'
        AND datetime(created_at) >= datetime(?1)
        AND datetime(created_at) < datetime(?2)`).bind(window.startAt, window.endAt).first(), {total:0}),
    safe(db.prepare(`SELECT COUNT(*) AS total FROM comments
      WHERE datetime(created_at) >= datetime(?1)
        AND datetime(created_at) < datetime(?2)`).bind(window.startAt, window.endAt).first(), {total:0}),
    safe(db.prepare(`SELECT COUNT(*) AS total FROM comments WHERE status='pending'`).first(), {total:0}),
    safe(db.prepare(`SELECT
      SUM(CASE WHEN type IN ('youtube-comment','youtube-comment-count') THEN 1 ELSE 0 END) AS comments
      FROM push_history
      WHERE datetime(created_at) >= datetime(?1)
        AND datetime(created_at) < datetime(?2)`).bind(window.startAt, window.endAt).first(), {comments:0}),
    safe(db.prepare(`SELECT message, details_json AS detailsJson FROM push_history
      WHERE type='youtube-like' AND status='sent'
        AND datetime(created_at) >= datetime(?1)
        AND datetime(created_at) < datetime(?2)
      ORDER BY created_at ASC`).bind(window.startAt, window.endAt).all(), {results:[]}),
    safe(db.prepare(`SELECT type, title, message, details_json AS detailsJson FROM push_history
      WHERE type IN ('youtube-subscriber','youtube-subscriber-count') AND status='sent'
        AND datetime(created_at) >= datetime(?1)
        AND datetime(created_at) < datetime(?2)
      ORDER BY created_at ASC`).bind(window.startAt, window.endAt).all(), {results:[]}),
    safe(db.prepare(`SELECT COUNT(*) AS total FROM (
      SELECT COALESCE(NULLIF(video_id,''), id) AS release_key FROM push_history
      WHERE type IN ('auto-release','auto-release-retry','release-publish')
        AND datetime(created_at) >= datetime(?1)
        AND datetime(created_at) < datetime(?2)
      UNION
      SELECT video_id AS release_key FROM release_history
      WHERE datetime(published_at) >= datetime(?1)
        AND datetime(published_at) < datetime(?2)
    )`).bind(window.startAt, window.endAt).first(), {total:0}),
    safe(getPushState(db, 'youtube-latest-public'), null),
    safe(getSiteWindowMetrics(db, window.startAt, window.endAt), {views:0,users:0})
  ]);

  return {
    windowKey:window.key,
    windowStartAt:window.startAt,
    windowEndAt:window.endAt,
    youtubeSubscribers:sumYoutubeSubscriberHistoryDeltas(youtubeSubscriberRows?.results || []),
    youtubeLikes:sumYoutubeLikeHistoryDeltas(youtubeLikeRows?.results || []),
    youtubeComments:Number(youtubeEvents?.comments || 0),
    youtubeViewDelta:0,
    siteUsers:Number(siteWindow?.users || 0),
    siteViews:Number(siteWindow?.views || 0),
    siteSubscribers:Number(siteSubscribers?.total || 0),
    siteComments:Number(siteComments?.total || 0),
    pendingComments:Number(pendingComments?.total || 0),
    releases:Math.max(Number(releases?.total || 0), latestYoutubeReleaseCountForWindow(latestYoutubeState, window)),
    searchClicks:0,
    searchImpressions:0,
    searchConnected:false,
    countryDeltas:[],
    totalCountries:0,
    countryDate:'',
    partial:true,
    partialReason:cleanPlainText(reason || 'summary-fallback', 300)
  };
}

async function hasDailyOwnerSummaryForBratislavaDate(db, localDate) {
  const nextLocalDate = shiftIsoCalendarDate(localDate, 1);
  const startAt = bratislavaLocalDateTimeToIso(localDate, 0, 0);
  const endAt = bratislavaLocalDateTimeToIso(nextLocalDate, 0, 0);
  const row = await db.prepare(`
    SELECT id, created_at AS createdAt
    FROM push_history
    WHERE type = 'daily-summary'
      AND source = 'central-cron'
      AND status = 'sent'
      AND datetime(created_at) >= datetime(?1)
      AND datetime(created_at) < datetime(?2)
    ORDER BY datetime(created_at) DESC
    LIMIT 1
  `).bind(startAt, endAt).first();
  return row || null;
}

async function maybeSendDailyOwnerSummary(env) {
  const clock = getBratislavaClock();
  // R350: two automatic owner summaries in Bratislava local time.
  // Morning slot stays eligible from 05:00 until 16:59; evening from 17:00 onward.
  const slot = clock.hour >= 17 ? '17' : (clock.hour >= 5 ? '05' : '');
  if (!slot) return { ok:true, skipped:true, reason:'before-05-local', localDate:clock.date };

  const db = requireDb(env);
  await ensurePushAutomationSchema(db);
  const slotKey = `${clock.date}:${slot}`;
  const sentStateKey = `daily-owner-summary-auto-slot:${slotKey}`;
  const already = await getPushState(db, sentStateKey).catch(() => null);
  if (already?.value) {
    return { ok:true, skipped:true, reason:'slot-already-sent', localDate:clock.date, slot, sentAt:already.value };
  }

  const claimKey = `push-once:daily-summary-auto:${slotKey}`;
  const previousClaim = await db.prepare(`SELECT value, updated_at AS updatedAt FROM push_state WHERE key=? LIMIT 1`).bind(claimKey).first().catch(() => null);
  if (previousClaim) {
    const age = (Date.now() - Date.parse(previousClaim.updatedAt || '')) / 60000;
    if (Number.isFinite(age) && age < 20) return { ok:true, skipped:true, reason:'send-claimed', localDate:clock.date, slot };
    await releasePushOnceClaim(db, claimKey);
  }
  if (!await claimPushOnce(db, claimKey, new Date().toISOString())) {
    return { ok:true, skipped:true, reason:'send-claimed', localDate:clock.date, slot };
  }

  // 05:00 = almost-completed 06:05-cycle; 17:00 = live current 06:05-cycle.
  // Both are snapshots of the automatic server accumulator; sending a push never resets it.
  const summaryWindow = getBratislavaSummaryWindow();
  await setPushState(db, 'daily-owner-summary-last-attempt-at', new Date().toISOString());
  await setPushState(db, 'daily-owner-summary-last-attempt-status', 'collecting');

  let metrics;
  let collectionError = '';
  try {
    metrics = await collectDailyOwnerSummary(env, { liveExternal:false, windowOverride:summaryWindow });
  } catch (error) {
    collectionError = cleanPlainText(error?.message || error, 500);
    metrics = await collectDailyOwnerSummaryFallback(env, summaryWindow, collectionError);
  }

  const windowKey = summaryWindow?.key || metrics?.windowKey || '';
  const preparedAt = new Date().toISOString();
  const cities = await collectDailyCityActivityR370(db, summaryWindow, preparedAt).catch(() => []);
  const snapshotId = `auto-${clock.date}-${slot}-${Date.now().toString(36)}`;
  const preparedSnapshot = JSON.stringify({ metrics, cities, sentAt:preparedAt, localDate:clock.date, slot, source:'central-cron-prepared', windowKey, snapshotId });
  await setPushState(db, 'daily-owner-summary-last-metrics', preparedSnapshot).catch(() => {});
  if (windowKey) {
    await setPushState(db, `daily-owner-summary-window:${windowKey}`, preparedSnapshot).catch(() => {});
    await persistControlHomeHighWaterFromMetricsR260(db, windowKey, metrics).catch(() => {});
  }
  await setPushState(db, `daily-owner-summary-push-snapshot:${snapshotId}`, preparedSnapshot).catch(() => {});

  const lines = buildDailyOwnerSummaryLines(metrics);
  const slotLabel = slot === '05' ? '05:00 · утро' : '17:00 · вечер';
  const summaryUrl = `https://control.andrikmetal.com/control-home.html?page=summary&source=push&summaryWindow=${encodeURIComponent(summaryWindow.key)}&summarySnapshot=${encodeURIComponent(snapshotId)}`;
  let result;
  try {
    result = await sendOwnerPush(env, {
      title:`📊 Общая сводка ANDRIK · ${slot === '05' ? 'утро' : 'вечер'}`,
      message:lines.join('\n'),
      url:summaryUrl,
      name:`ANDRIK daily summary ${clock.date} ${slot}`,
      history:{
        type:'daily-summary', source:'central-cron',
        title:`Общая сводка ANDRIK · ${slotLabel}`,
        message:lines.join('\n'), url:summaryUrl,
        details:{ localDate:clock.date, localHour:clock.hour, localMinute:clock.minute, summarySlot:slot, collectionError, metrics, cities, windowKey, snapshotId }
      }
    });
  } catch (error) {
    const message = cleanPlainText(error?.message || error, 500);
    await setPushState(db, 'daily-owner-summary-last-attempt-status', 'failed');
    await setPushState(db, 'daily-owner-summary-last-attempt-error', message);
    await releasePushOnceClaim(db, claimKey);
    await recordSystemLog(env, { scope:'daily-summary', level:'error', event:'send-failed', message:`Не удалось отправить сводку ${slotLabel}: ${message}`, details:{localDate:clock.date,slot,summaryWindow,collectionError} }).catch(() => {});
    throw error;
  }

  if (result.ok) {
    const sentAt = new Date().toISOString();
    await setPushState(db, sentStateKey, sentAt);
    await setPushState(db, 'daily-owner-summary-auto-last-date', clock.date);
    await setPushState(db, 'daily-owner-summary-last-at', sentAt);
    await setPushState(db, 'daily-owner-summary-last-attempt-status', metrics.partial ? 'sent-partial' : 'sent');
    await setPushState(db, 'daily-owner-summary-last-attempt-error', collectionError);
    const storedSnapshot = JSON.stringify({ metrics, cities, sentAt, localDate:clock.date, slot, source:'central-cron', windowKey, snapshotId });
    await setPushState(db, 'daily-owner-summary-last-metrics', storedSnapshot);
    if (windowKey) await setPushState(db, `daily-owner-summary-window:${windowKey}`, storedSnapshot);
    await setPushState(db, `daily-owner-summary-push-snapshot:${snapshotId}`, storedSnapshot).catch(() => {});
    await persistControlHomeHighWaterFromMetricsR260(db, windowKey, metrics);
    await recordSystemLog(env, { scope:'daily-summary', level:metrics.partial?'warning':'info', event:metrics.partial?'sent-partial':'sent', message:`Автосводка ${slotLabel} отправлена.`, details:{metrics,slot,collectionError,summaryWindow,oneSignalId:result.oneSignalId||''} }).catch(() => {});
  } else {
    const message=cleanPlainText(result.error||'onesignal-send-failed',500);
    await setPushState(db,'daily-owner-summary-last-attempt-status','failed');
    await setPushState(db,'daily-owner-summary-last-attempt-error',message);
    await releasePushOnceClaim(db,claimKey);
  }
  return { ok:Boolean(result.ok), sent:Boolean(result.ok), slot, localDate:clock.date, summaryWindow, metrics, collectionError, oneSignalId:result.oneSignalId||'', error:result.error||'' };
}

async function handleManualDailyOwnerSummary(request, env) {
  if (!adminAuthorized(request, env)) return json({ ok:false, error:'unauthorized' }, 401);
  const db = requireDb(env);
  await Promise.all([ensurePushAutomationSchema(db), ensureCommentsV4Schema(db), ensurePlatformAnalyticsSchema(db), ensureControlV1Schema(db), ensureSiteMetricsSchema(db)]);
  const clock = getBratislavaClock();
  const window = getBratislavaSummaryWindow();
  const snapshotRefresh = { ok:true, skipped:true, reason:'verified-d1-snapshots' };

  let metrics;
  let collectionError = '';
  try {
    metrics = await collectDailyOwnerSummary(env, { liveExternal:false, windowOverride:window });
  } catch (error) {
    collectionError = cleanPlainText(error?.message || error, 500);
    metrics = await collectDailyOwnerSummaryFallback(env, window, collectionError);
  }

  const preparedAt = new Date().toISOString();
  const windowKey = metrics?.windowKey || window.key;
  const cities = await collectDailyCityActivityR370(db, window, preparedAt).catch(() => []);
  const snapshotId = `manual-${clock.date}-${Date.now().toString(36)}`;
  const preparedSnapshot = JSON.stringify({
    metrics,
    cities,
    sentAt:preparedAt,
    localDate:clock.date,
    source:'manual-control-prepared',
    windowKey,
    snapshotId
  });
  await setPushState(db, 'daily-owner-summary-last-metrics', preparedSnapshot).catch(() => {});
  if (windowKey) {
    await setPushState(db, `daily-owner-summary-window:${windowKey}`, preparedSnapshot).catch(() => {});
    await persistControlHomeHighWaterFromMetricsR260(db, windowKey, metrics).catch(() => {});
  }
  await setPushState(db, `daily-owner-summary-push-snapshot:${snapshotId}`, preparedSnapshot).catch(() => {});

  const lines = buildDailyOwnerSummaryLines(metrics);
  const summaryUrl = `https://control.andrikmetal.com/control-home.html?page=summary&source=push&summaryWindow=${encodeURIComponent(windowKey)}&summarySnapshot=${encodeURIComponent(snapshotId)}`;
  let result;
  try {
    result = await sendOwnerPush(env, {
      title:'📊 Ежедневная сводка ANDRIK',
      message:lines.join('\n'),
      url:summaryUrl,
      name:`ANDRIK manual daily summary ${clock.date} ${Date.now()}`,
      history:{
        type:'daily-summary',
        source:'manual-control',
        title:'Ежедневная сводка ANDRIK',
        message:lines.join('\n'),
        url:summaryUrl,
        details:{ localDate:clock.date, localHour:clock.hour, manual:true, metrics, cities, snapshotRefresh, collectionError, windowKey, snapshotId }
      }
    });
  } catch (error) {
    result = { ok:false, error:cleanPlainText(error?.message || error, 500) };
  }

  const sentAt = new Date().toISOString();
  if (result.ok) {
    const sentSnapshot = JSON.stringify({ metrics, cities, sentAt, localDate:clock.date, source:'manual-control', windowKey, snapshotId });
    await setPushState(db, 'daily-owner-summary-manual-last-date', clock.date);
    await setPushState(db, 'daily-owner-summary-manual-last-at', sentAt);
    await setPushState(db, 'daily-owner-summary-last-metrics', sentSnapshot);
    if (windowKey) await setPushState(db, `daily-owner-summary-window:${windowKey}`, sentSnapshot).catch(() => {});
    await setPushState(db, `daily-owner-summary-push-snapshot:${snapshotId}`, sentSnapshot).catch(() => {});
    await recordSystemLog(env, {
      scope:'daily-summary', level:'info', event:'manual-sent',
      message:`Ежедневная сводка отправлена вручную за ${clock.date}.`,
      details:{ metrics, snapshotRefresh, oneSignalId:result.oneSignalId || '', collectionError }
    }).catch(() => {});
  } else {
    await recordSystemLog(env, {
      scope:'daily-summary', level:'error', event:'manual-send-failed',
      message:`Сводка собрана, но push не отправлен: ${cleanPlainText(result.error || 'push-failed', 300)}`,
      details:{ metrics, snapshotRefresh, collectionError, pushError:result.error || '' }
    }).catch(() => {});
  }

  return json({
    ok:true,
    sent:Boolean(result.ok),
    pushOk:Boolean(result.ok),
    sentAt,
    localDate:clock.date,
    windowKey,
    metrics,
    snapshotRefresh,
    oneSignalId:result.oneSignalId || '',
    error:result.error || '',
    collectionError
  });
}


async function claimCronGatewaySlotR334(db, task, slot) {
  const key=`cron-gateway-r334:${cleanPlainText(task || 'task',80)}`;
  const value=cleanPlainText(slot || '',80);
  const inserted=await db.prepare(`
    INSERT OR IGNORE INTO push_state (key,value,updated_at)
    VALUES (?,?,datetime('now'))
  `).bind(key,value).run();
  if(Number(inserted?.meta?.changes || 0)>0)return true;

  const updated=await db.prepare(`
    UPDATE push_state
    SET value=?,updated_at=datetime('now')
    WHERE key=? AND value<>?
  `).bind(value,key,value).run();
  return Number(updated?.meta?.changes || 0)>0;
}

function cronGatewayClockR334(date=new Date()) {
  const minute=date.getUTCMinutes();
  const hour=date.getUTCHours();
  const day=date.toISOString().slice(0,10);
  const hourKey=`${day}T${String(hour).padStart(2,'0')}`;
  return {
    minute,
    due2:minute % 2 === 0,
    due5:minute % 5 === 0,
    due15:minute % 15 === 0,
    slot2:`${hourKey}:${String(minute - (minute % 2)).padStart(2,'0')}`,
    slot5:`${hourKey}:${String(minute - (minute % 5)).padStart(2,'0')}`,
    slot15:`${hourKey}:${String(minute - (minute % 15)).padStart(2,'0')}`
  };
}

async function handleExternalCronGatewayR334(request, env) {
  if(!adminAuthorized(request,env) && !cronAuthorized(request,env))return json({ok:false,error:'unauthorized'},401);
  const db=requireDb(env);
  await Promise.all([ensurePushAutomationSchema(db),ensureControlV1Schema(db)]);
  const clock=cronGatewayClockR334(new Date());
  const tasks={};
  const errors=[];

  // Every 2 minutes: lightweight comments + likes.
  if(clock.due2 && await claimCronGatewaySlotR334(db,'engagement-2m',clock.slot2)){
    try{
      tasks.engagement=await responseData(await handleFastYoutubeEngagementR333(request,env));
      if(!tasks.engagement.httpOk || tasks.engagement.ok===false)errors.push(`engagement:${tasks.engagement.error || tasks.engagement.status || 'delivery-failed'}`);
    }catch(error){
      tasks.engagement={ok:false,error:cleanPlainText(error?.message || error,400)};
      errors.push(`engagement:${tasks.engagement.error}`);
    }
  }else{
    tasks.engagement={ok:true,skipped:true,reason:clock.due2?'slot-already-claimed':'not-due'};
  }

  // R364 (from R363): every 5 minutes, check owner-summary slot FIRST.
  if(clock.due5 && await claimCronGatewaySlotR334(db,'youtube-5m',clock.slot5)){
    try{
      tasks.dailySummaryFast=await maybeSendDailyOwnerSummary(env);
      if(!tasks.dailySummaryFast.ok && !tasks.dailySummaryFast.skipped)errors.push(`dailySummaryFast:${tasks.dailySummaryFast.error || 'failed'}`);
    }catch(error){
      tasks.dailySummaryFast={ok:false,error:cleanPlainText(error?.message || error,400)};
      errors.push(`dailySummaryFast:${tasks.dailySummaryFast.error}`);
    }
    try{
      tasks.releaseFallback=await responseData(await handleFastYoutubeReleaseCheckR332(request,env));
      if(!tasks.releaseFallback.httpOk)errors.push(`releaseFallback:${tasks.releaseFallback.error || tasks.releaseFallback.status}`);
    }catch(error){
      tasks.releaseFallback={ok:false,error:cleanPlainText(error?.message || error,400)};
      errors.push(`releaseFallback:${tasks.releaseFallback.error}`);
    }
    try{
      tasks.youtubeEvents=await responseData(await handleCheckYoutubeEvents(request,env));
      if(!tasks.youtubeEvents.httpOk)errors.push(`youtubeEvents:${tasks.youtubeEvents.error || tasks.youtubeEvents.status}`);
    }catch(error){
      tasks.youtubeEvents={ok:false,error:cleanPlainText(error?.message || error,400)};
      errors.push(`youtubeEvents:${tasks.youtubeEvents.error}`);
    }
  }else{
    tasks.dailySummaryFast={ok:true,skipped:true,reason:clock.due5?'slot-already-claimed':'not-due'};
    tasks.releaseFallback={ok:true,skipped:true,reason:clock.due5?'slot-already-claimed':'not-due'};
    tasks.youtubeEvents={ok:true,skipped:true,reason:clock.due5?'slot-already-claimed':'not-due'};
  }

  // Every 15 minutes: keep the original full central automation exactly as before.
  if(clock.due15 && await claimCronGatewaySlotR334(db,'main-15m',clock.slot15)){
    try{
      tasks.main=await responseData(await handleAutomationRun(request,env));
      if(!tasks.main.httpOk)errors.push(`main:${tasks.main.error || tasks.main.status}`);
    }catch(error){
      tasks.main={ok:false,error:cleanPlainText(error?.message || error,400)};
      errors.push(`main:${tasks.main.error}`);
    }
  }else{
    tasks.main={ok:true,skipped:true,reason:clock.due15?'slot-already-claimed':'not-due'};
  }

  const result={
    ok:errors.length===0,
    mode:'external-cron-gateway-r334',
    utcMinute:clock.minute,
    due:{every2:clock.due2,every5:clock.due5,every15:clock.due15},
    tasks,
    errors,
    checkedAt:new Date().toISOString()
  };
  await setPushState(db,'cron-gateway-r334-last-result',JSON.stringify(result)).catch(()=>{});
  return json(result,errors.length?502:200);
}

async function handleAutomationRun(request, env) {
  if (!adminAuthorized(request, env) && !cronAuthorized(request, env)) return json({ ok:false, error:'unauthorized' },401);
  const db = requireDb(env);
  await Promise.all([ensurePushAutomationSchema(db), ensurePlatformAnalyticsSchema(db), ensureControlV1Schema(db)]);
  const startedAt = new Date().toISOString();
  await setPushState(db, 'automation-last-check-at', startedAt);
  await setPushState(db, 'automation-last-check-status', 'running');
  const tasks = {};
  const errors = [];
  // R318: push reactions are first priority. The old separate identity probe was
  // redundant because handleCheckYoutubeEvents already refreshes channel identity.
  // Running reactions first prevents comments/likes from waiting behind heavy summary tasks
  // and also removes one duplicate YouTube API request from every Cron cycle.
  try {
    tasks.youtubeEvents = await responseData(await handleCheckYoutubeEvents(request, env));
    if (!tasks.youtubeEvents.httpOk) errors.push(`youtubeEvents: ${tasks.youtubeEvents.details || tasks.youtubeEvents.error || tasks.youtubeEvents.status}`);
  } catch (error) { tasks.youtubeEvents={ok:false,error:cleanPlainText(error?.message || error,500)}; errors.push(`youtubeEvents: ${tasks.youtubeEvents.error}`); }
  try {
    tasks.websub = await ensureYoutubeWebSubSubscriptionR332(env, db, { force:false });
    if (!tasks.websub.ok && !tasks.websub.skipped) errors.push(`websub: ${tasks.websub.error || 'failed'}`);
  } catch (error) { tasks.websub={ok:false,error:cleanPlainText(error?.message || error,500)}; errors.push(`websub: ${tasks.websub.error}`); }
  try {
    tasks.releases = await responseData(await handleCheckPlaylist(request, env));
    if (!tasks.releases.httpOk) errors.push(`releases: ${tasks.releases.details || tasks.releases.error || tasks.releases.status}`);
  } catch (error) { tasks.releases={ok:false,error:cleanPlainText(error?.message || error,500)}; errors.push(`releases: ${tasks.releases.error}`); }
  // R350: refresh Google + current summary accumulator independently of push delivery.
  // This also keeps the live summary current on every normal Cron cycle.
  try {
    tasks.summaryRefresh = await refreshDailySummaryAccumulatorR305(env, 'central-cron');
    if (!tasks.summaryRefresh.ok && !tasks.summaryRefresh.skipped) errors.push(`summaryRefresh: ${tasks.summaryRefresh.error || 'failed'}`);
  } catch (error) { tasks.summaryRefresh={ok:false,error:cleanPlainText(error?.message || error,500)}; errors.push(`summaryRefresh: ${tasks.summaryRefresh.error}`); }
  // R364/R363: central run is catch-up fallback; primary delivery runs in the fast 5-minute cycle.
  try {
    tasks.dailySummary = await maybeSendDailyOwnerSummary(env);
    if (!tasks.dailySummary.ok && !tasks.dailySummary.skipped) errors.push(`dailySummary: ${tasks.dailySummary.error || 'failed'}`);
  } catch (error) { tasks.dailySummary={ok:false,error:cleanPlainText(error?.message || error,500)}; errors.push(`dailySummary: ${tasks.dailySummary.error}`); }
  try {
    tasks.snapshots = await refreshControlSnapshots(env, { force:false });
    if (!tasks.snapshots.ok && !tasks.snapshots.skipped) errors.push(`snapshots: ${(tasks.snapshots.errors || []).join(' · ') || 'failed'}`);
  } catch (error) { tasks.snapshots={ok:false,error:cleanPlainText(error?.message || error,500)}; errors.push(`snapshots: ${tasks.snapshots.error}`); }
  try {
    tasks.newCountries = await maybeSendNewCountryAlerts(env, tasks.snapshots?.youtube?.studio?.countries || []);
    if (!tasks.newCountries.ok && !tasks.newCountries.skipped) errors.push(`newCountries: ${tasks.newCountries.error || 'failed'}`);
  } catch (error) { tasks.newCountries={ok:false,error:cleanPlainText(error?.message || error,500)}; errors.push(`newCountries: ${tasks.newCountries.error}`); }
  try {
    tasks.nativeMonitor = await runNativeMonitor(env, { sendNotifications:true, source:'central-cron' });
    if (!tasks.nativeMonitor.ok && tasks.nativeMonitor.errorCount > 0) errors.push(`nativeMonitor: недоступных точек ${tasks.nativeMonitor.errorCount}`);
  } catch (error) { tasks.nativeMonitor={ok:false,error:cleanPlainText(error?.message || error,500)}; errors.push(`nativeMonitor: ${tasks.nativeMonitor.error}`); }
  tasks.backup = await maybeCreateDailyBackup(env);
  if (!tasks.backup.ok) errors.push(`backup: ${tasks.backup.error}`);
  const finishedAt = new Date().toISOString();
  const successful = Object.values(tasks).filter(item => item?.ok || item?.httpOk || item?.skipped).length;
  const status = errors.length ? (successful ? 'partial' : 'failed') : 'ok';
  const summary = { startedAt, finishedAt, status, successful, total:Object.keys(tasks).length, errors, tasks };
  await setPushState(db, 'automation-last-check-at', finishedAt);
  await setPushState(db, 'automation-last-check-status', status);
  await setPushState(db, 'automation-last-check-summary', JSON.stringify(summary));
  await recordSystemLog(env, { scope:'automation', level:errors.length?'warning':'info', event:'central-run-completed', message:`Центральный Cron: ${successful}/${Object.keys(tasks).length} задач завершено.`, details:summary }).catch(() => {});
  return json({ ok:successful > 0, ...summary }, successful > 0 ? 200 : 502);
}

function parseSnapshotMetrics(row) {
  try { return JSON.parse(row?.metrics_json || '{}'); } catch (_) { return {}; }
}

function parseDailySummaryMetrics(row) {
  let details = {};
  try { details = JSON.parse(row?.detailsJson || row?.details_json || '{}') || {}; }
  catch (_) { details = {}; }
  return details?.metrics && typeof details.metrics === 'object' ? details.metrics : {};
}
function dailyMetric(metrics, key) {
  return Math.max(0, Number(metrics?.[key] || 0));
}

function parseStoredDailySummaryMetrics(row) {
  if (!row?.value) return {};
  const updatedAt = Date.parse(row.updatedAt || '');
  if (Number.isFinite(updatedAt) && Date.now() - updatedAt > 36 * 60 * 60 * 1000) return {};
  try {
    const parsed = JSON.parse(row.value || '{}') || {};
    return parsed?.metrics && typeof parsed.metrics === 'object' ? parsed.metrics : {};
  } catch (_) { return {}; }
}

function parseStoredDailySummaryMetricsForWindow(row, windowKey) {
  if (!row?.value || !windowKey) return {};
  try {
    const parsed = JSON.parse(row.value || '{}') || {};
    const storedKey = cleanPlainText(parsed?.windowKey || parsed?.metrics?.windowKey || '', 40);
    if (storedKey !== windowKey) return {};
    return parsed?.metrics && typeof parsed.metrics === 'object' ? parsed.metrics : {};
  } catch (_) { return {}; }
}

function parseDailySummaryMetricsForWindow(row, windowKey) {
  if (!row || !windowKey) return {};
  let details = {};
  try { details = JSON.parse(row?.detailsJson || row?.details_json || '{}') || {}; }
  catch (_) { details = {}; }
  const metrics = details?.metrics && typeof details.metrics === 'object' ? details.metrics : {};
  const storedKey = cleanPlainText(details?.windowKey || metrics?.windowKey || '', 40);
  return storedKey === windowKey ? metrics : {};
}

async function persistControlHomeHighWaterFromMetricsR260(db, windowKey, metrics = {}) {
  if (!windowKey) return;
  const key = `control-home-high-water-r213:${windowKey}`;
  const previousRow = await getPushState(db, key).catch(() => null);
  const previous = parseControlHomeHighWaterR213(previousRow);
  const incoming = normalizeControlHomeSummaryR213({
    websiteUsers:Number(metrics?.siteUsers || 0),
    websiteViews:Number(metrics?.siteViews || 0),
    siteSubscribers:Number(metrics?.siteSubscribers || 0),
    siteComments:Number(metrics?.siteComments || 0),
    siteLikes:Number(metrics?.siteLikes || 0),
    youtubeComments:Number(metrics?.youtubeComments || 0),
    youtubeSubscribers:Number(metrics?.youtubeSubscribers || 0),
    youtubeLikes:Number(metrics?.youtubeLikes || 0),
    youtubeViews:Number(metrics?.youtubeViewDelta || 0),
    youtubeViewDelta:Number(metrics?.youtubeViewDelta || 0),
    releases:Number(metrics?.releases || 0),
    countryDeltas:Array.isArray(metrics?.countryDeltas) ? metrics.countryDeltas : [],
    totalCountries:Number(metrics?.totalCountries || 0),
    countryDate:metrics?.countryDate || ''
  });
  const merged = mergeControlHomeSummaryR213(previous, incoming);
  await setPushState(db, key, JSON.stringify({
    windowKey,
    summary:merged,
    updatedAt:new Date().toISOString(),
    source:'daily-accumulator-r260'
  })).catch(() => {});
}

function mergeDailyMetrics(...sources) {
  const merged = {};
  for (const source of sources) {
    if (!source || typeof source !== 'object') continue;
    for (const [key, value] of Object.entries(source)) {
      if (Array.isArray(value)) {
        if (!Array.isArray(merged[key]) || value.length > merged[key].length) merged[key] = value;
      } else if (typeof value === 'number' || /^-?\d+(?:\.\d+)?$/.test(String(value ?? ''))) {
        merged[key] = Math.max(Number(merged[key] || 0), Number(value || 0));
      } else if (merged[key] == null || merged[key] === '') {
        merged[key] = value;
      }
    }
  }
  return merged;
}

const CONTROL_HOME_SUMMARY_KEYS_R213 = ['websiteUsers','websiteViews','siteSubscribers','siteComments','siteLikes','youtubeComments','youtubeSubscribers','youtubeLikes','youtubeViews','youtubeViewDelta','releases','totalCountries'];
function normalizeControlHomeSummaryR213(summary = {}) {
  const normalized = { ...summary };
  for (const key of CONTROL_HOME_SUMMARY_KEYS_R213) normalized[key] = Math.max(0, Number(summary?.[key] || 0));
  normalized.countryDeltas = Array.isArray(summary?.countryDeltas) ? summary.countryDeltas : [];
  normalized.countryDate = cleanPlainText(summary?.countryDate || '', 30);
  return normalized;
}
function mergeControlHomeSummaryR213(...sources) {
  const merged = normalizeControlHomeSummaryR213({});
  for (const source of sources) {
    const item = normalizeControlHomeSummaryR213(source || {});
    for (const key of CONTROL_HOME_SUMMARY_KEYS_R213) merged[key] = Math.max(merged[key], item[key]);
    if (item.countryDeltas.length > merged.countryDeltas.length) merged.countryDeltas = item.countryDeltas;
    if (!merged.countryDate && item.countryDate) merged.countryDate = item.countryDate;
  }
  return merged;
}
function parseControlHomeHighWaterR213(row) {
  try {
    const parsed = JSON.parse(row?.value || '{}');
    return parsed?.summary && typeof parsed.summary === 'object' ? parsed.summary : {};
  } catch (_) { return {}; }
}

function parseDailySummaryMessageMetrics(row) {
  const message = String(row?.message || '');
  if (!message) return {};
  const metrics = {};
  let section = '';
  for (const rawLine of message.split(/\n+/)) {
    const line = rawLine.trim();
    if (/YouTube/iu.test(line)) { section = 'youtube'; continue; }
    if (/Официальный сайт/iu.test(line)) { section = 'site'; continue; }
    const match = line.match(/[+]?([0-9]+)\s+(.+)$/u);
    if (!match) continue;
    const value = Math.max(0, Number(match[1] || 0));
    const label = match[2].toLowerCase();
    if (/лайк/iu.test(label)) metrics.youtubeLikes = Math.max(metrics.youtubeLikes || 0, value);
    else if (/посетител/iu.test(label)) metrics.siteUsers = Math.max(metrics.siteUsers || 0, value);
    else if (/просмотр/iu.test(label)) {
      if (section === 'youtube') metrics.youtubeViewDelta = Math.max(metrics.youtubeViewDelta || 0, value);
      else metrics.siteViews = Math.max(metrics.siteViews || 0, value);
    } else if (/подпис/iu.test(label)) {
      if (section === 'youtube') metrics.youtubeSubscribers = Math.max(metrics.youtubeSubscribers || 0, value);
      else metrics.siteSubscribers = Math.max(metrics.siteSubscribers || 0, value);
    } else if (/комментар/iu.test(label)) {
      if (section === 'youtube') metrics.youtubeComments = Math.max(metrics.youtubeComments || 0, value);
      else metrics.siteComments = Math.max(metrics.siteComments || 0, value);
    } else if (/сообщен/iu.test(label)) metrics.siteComments = Math.max(metrics.siteComments || 0, value);
    else if (/релиз/iu.test(label)) metrics.releases = Math.max(metrics.releases || 0, value);
  }
  return metrics;
}



function getBratislavaSummaryWindowByKeyR271(windowKey, date = new Date()) {
  const key = cleanPlainText(windowKey || '', 20);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(key)) return null;
  const startDay = Date.parse(`${key}T00:00:00.000Z`);
  if (!Number.isFinite(startDay)) return null;
  const current = getBratislavaSummaryWindow(date);
  const currentDay = Date.parse(`${current.key}T00:00:00.000Z`);
  const ageDays = Math.round((currentDay - startDay) / 86400000);
  if (!Number.isFinite(ageDays) || ageDays < 0 || ageDays > 45) return null;
  const nextDate = shiftIsoCalendarDate(key, 1);
  const endAt = bratislavaLocalDateTimeToIso(nextDate, 6, 5);
  return {
    key,
    startAt:bratislavaLocalDateTimeToIso(key, 6, 5),
    endAt,
    currentLocalDate:getBratislavaClock(date).date,
    crossesMidnight:true,
    midnightAt:bratislavaLocalDateTimeToIso(nextDate, 0, 0),
    cutoffLabel:'06:05 Europe/Bratislava',
    completed:Date.parse(endAt) <= date.getTime()
  };
}

function controlHomeSummaryFromDailyMetricsR271(metrics = {}) {
  return normalizeControlHomeSummaryR213({
    websiteUsers:Number(metrics?.siteUsers || 0),
    websiteViews:Number(metrics?.siteViews || 0),
    siteSubscribers:Number(metrics?.siteSubscribers || 0),
    siteComments:Number(metrics?.siteComments || 0),
    siteLikes:Number(metrics?.siteLikes || 0),
    youtubeComments:Number(metrics?.youtubeComments || 0),
    youtubeSubscribers:Number(metrics?.youtubeSubscribers || 0),
    youtubeLikes:Number(metrics?.youtubeLikes || 0),
    youtubeViews:Number(metrics?.youtubeViewDelta || 0),
    youtubeViewDelta:Number(metrics?.youtubeViewDelta || 0),
    releases:Number(metrics?.releases || 0),
    countryDeltas:Array.isArray(metrics?.countryDeltas) ? metrics.countryDeltas : [],
    totalCountries:Number(metrics?.totalCountries || 0),
    countryDate:metrics?.countryDate || ''
  });
}


async function collectDailyCityActivityR370(db, window, cutoffAt = '') {
  const windowStart = cleanPlainText(window?.startAt || '', 80);
  const windowEnd = cleanPlainText(window?.endAt || '', 80);
  if (!windowStart || !windowEnd) return [];

  let effectiveEnd = windowEnd;
  const cutoffMs = Date.parse(cutoffAt || '');
  const endMs = Date.parse(windowEnd);
  const startMs = Date.parse(windowStart);
  if (Number.isFinite(cutoffMs) && Number.isFinite(startMs) && Number.isFinite(endMs)) {
    effectiveEnd = new Date(Math.max(startMs, Math.min(endMs, cutoffMs))).toISOString();
  }

  const rows = await db.prepare(`
    SELECT country, region, city,
           COUNT(*) AS opens,
           COUNT(DISTINCT visitor_hash) AS visitors,
           MAX(created_at) AS lastAt
    FROM site_visit_events
    WHERE event_type='visit'
      AND datetime(created_at) >= datetime(?1)
      AND datetime(created_at) < datetime(?2)
      AND (city<>'' OR region<>'')
    GROUP BY country, region, city
    ORDER BY opens DESC, visitors DESC, datetime(lastAt) DESC
    LIMIT 50
  `).bind(windowStart, effectiveEnd).all();

  return (rows?.results || []).map(row => {
    const city = cleanPlainText(row.city || '', 120);
    const region = cleanPlainText(row.region || '', 120);
    const country = cleanPlainText(row.country || '', 8).toUpperCase();
    return {
      city,
      region,
      country,
      label:city || region || 'Город / регион',
      opens:Math.max(0, Number(row.opens || 0)),
      visitors:Math.max(0, Number(row.visitors || 0)),
      lastAt:cleanPlainText(row.lastAt || '', 80)
    };
  }).filter(item => item.label && item.opens > 0);
}

function parseStoredDailySummarySnapshotR271(row, windowKey) {
  if (!row?.value) return null;
  try {
    const parsed = JSON.parse(row.value || '{}') || {};
    const metrics = parsed?.metrics && typeof parsed.metrics === 'object' ? parsed.metrics : {};
    const storedKey = cleanPlainText(parsed?.windowKey || metrics?.windowKey || '', 40);
    if (storedKey !== windowKey) return null;
    return {
      metrics,
      cities:Array.isArray(parsed?.cities) ? parsed.cities.slice(0,50) : [],
      sentAt:cleanPlainText(parsed?.sentAt || row?.updatedAt || '', 80),
      source:cleanPlainText(parsed?.source || 'central-cron', 40)
    };
  } catch (_) { return null; }
}

function normalizeDailySummarySnapshotIdR366(value) {
  const id = cleanPlainText(value || '', 120);
  return /^[a-z0-9][a-z0-9:_-]{5,119}$/i.test(id) ? id : '';
}
async function findExactDailySummarySnapshotR366(db, window, snapshotId) {
  const safeId = normalizeDailySummarySnapshotIdR366(snapshotId);
  if (!safeId) return null;
  const row = await getPushState(db, `daily-owner-summary-push-snapshot:${safeId}`).catch(() => null);
  const parsed = parseStoredDailySummarySnapshotR271(row, window.key);
  return parsed ? { ...parsed, snapshotId:safeId } : null;
}

async function findDailySummarySnapshotR271(db, window) {
  const searchEnd = new Date(Date.parse(window.endAt) + 86400000).toISOString();
  const rows = await db.prepare(`
    SELECT details_json AS detailsJson, message, created_at AS createdAt, source
    FROM push_history
    WHERE type='daily-summary'
      AND status='sent'
      AND datetime(created_at) >= datetime(?1)
      AND datetime(created_at) < datetime(?2)
    ORDER BY datetime(created_at) DESC
    LIMIT 24
  `).bind(window.startAt, searchEnd).all();

  for (const row of rows?.results || []) {
    const fromDetails = parseDailySummaryMetricsForWindow(row, window.key);
    const fromMessage = parseDailySummaryMessageMetrics(row);
    const metrics = mergeDailyMetrics(fromDetails, fromMessage);
    if (Object.keys(metrics).length) {
      return { metrics, sentAt:row.createdAt || '', source:`${cleanPlainText(row.source || 'push-history',40)}-sent-r366` };
    }
  }

  const stored = parseStoredDailySummarySnapshotR271(
    await getPushState(db, `daily-owner-summary-window:${window.key}`).catch(() => null),
    window.key
  );
  if (stored) return stored;

  const latestStored = parseStoredDailySummarySnapshotR271(
    await getPushState(db, 'daily-owner-summary-last-metrics').catch(() => null),
    window.key
  );
  return latestStored || null;
}

async function handleControlHomePushSnapshotR271(db, window) {
  const snapshot = await findDailySummarySnapshotR271(db, window);
  if (!snapshot) {
    return json({
      ok:false,
      error:'push-summary-not-found',
      details:'Сохранённая сводка из push для этого периода не найдена.'
    }, 404);
  }

  const activityResult = await db.prepare(`
    SELECT id, type, source, audience, title, message, url,
           video_id AS videoId, video_title AS videoTitle,
           status, created_at AS createdAt
    FROM push_history
    WHERE type IN ('youtube-comment','youtube-comment-count','youtube-subscriber','youtube-subscriber-count','youtube-like','site-subscriber','comment-live','comment-pending','auto-release','auto-release-retry','release-publish')
      AND datetime(created_at) >= datetime(?1)
      AND datetime(created_at) < datetime(?2)
    ORDER BY datetime(created_at) DESC
    LIMIT 200
  `).bind(window.startAt, window.endAt).all();

  return json({
    ok:true,
    period:'06:05-auto-cycle',
    windowKey:window.key,
    windowStartAt:window.startAt,
    windowEndAt:window.endAt,
    summary:controlHomeSummaryFromDailyMetricsR271(snapshot.metrics),
    cityActivity:(Array.isArray(snapshot.cities) && snapshot.cities.length)
      ? snapshot.cities
      : await collectDailyCityActivityR370(db, window, snapshot.sentAt || window.endAt).catch(() => []),
    activity:activityResult?.results || [],
    summarySource:'push-direct',
    summaryView:'completed-push',
    pushSentAt:snapshot.sentAt || '',
    updatedAt:snapshot.sentAt || new Date().toISOString()
  });
}

async function handleControlHome(request, env) {
  if (!adminAuthorized(request, env)) return json({ ok:false, error:'unauthorized' },401);
  const db = requireDb(env);
  const requestUrl = new URL(request.url);
  const forceRefresh = requestUrl.searchParams.get('refresh') === '1';
  const pushSnapshotRequested = requestUrl.searchParams.get('source') === 'push';
  const requestedPushWindow = pushSnapshotRequested
    ? getBratislavaSummaryWindowByKeyR271(requestUrl.searchParams.get('window'))
    : null;
  const requestedPushSnapshotId = pushSnapshotRequested
    ? normalizeDailySummarySnapshotIdR366(requestUrl.searchParams.get('snapshot'))
    : '';
  const window = getBratislavaSummaryWindow();
  await Promise.all([ensurePushAutomationSchema(db), ensureCommentsV4Schema(db), ensurePlatformAnalyticsSchema(db), ensureControlV1Schema(db), ensureSiteMetricsSchema(db)]);
  if (pushSnapshotRequested && !requestedPushWindow) {
    return json({ ok:false, error:'invalid-push-summary-window' }, 400);
  }
  if (requestedPushWindow) {
    if (requestedPushSnapshotId) {
      const exact = await findExactDailySummarySnapshotR366(db, requestedPushWindow, requestedPushSnapshotId);
      if (exact) {
        const activityResult = await db.prepare(`
          SELECT id, type, source, audience, title, message, url,
                 video_id AS videoId, video_title AS videoTitle,
                 status, created_at AS createdAt
          FROM push_history
          WHERE type IN ('youtube-comment','youtube-comment-count','youtube-subscriber','youtube-subscriber-count','youtube-like','site-subscriber','comment-live','comment-pending','auto-release','auto-release-retry','release-publish')
            AND datetime(created_at) >= datetime(?1)
            AND datetime(created_at) < datetime(?2)
          ORDER BY datetime(created_at) DESC
          LIMIT 200
        `).bind(requestedPushWindow.startAt, requestedPushWindow.endAt).all();
        return json({
          ok:true,
          period:'06:05-auto-cycle',
          windowKey:requestedPushWindow.key,
          windowStartAt:requestedPushWindow.startAt,
          windowEndAt:requestedPushWindow.endAt,
          summary:controlHomeSummaryFromDailyMetricsR271(exact.metrics),
          cityActivity:(Array.isArray(exact.cities) && exact.cities.length)
            ? exact.cities
            : await collectDailyCityActivityR370(db, requestedPushWindow, exact.sentAt || requestedPushWindow.endAt).catch(() => []),
          activity:activityResult?.results || [],
          summarySource:'push-exact-r366',
          summaryView:'completed-push',
          pushSnapshotId:requestedPushSnapshotId,
          pushSentAt:exact.sentAt || '',
          updatedAt:exact.sentAt || new Date().toISOString()
        });
      }
    }
    return await handleControlHomePushSnapshotR271(db, requestedPushWindow);
  }
  // R260 DAILY ACCUMULATOR: the screen uses one Bratislava window, 06:05 → next 06:05.
  // Sending a push only records a checkpoint. It never resets counters; only the window key changes at 06:05.
  const [siteSubscribers, siteComments, siteLikes, youtubeEvents, youtubeLikeRows, youtubeSubscriberRows, releases, latestYoutubeState, activityResult, ytLatest, ytBaselineBefore, ytBaselineAfter, gaLatest, gaBaselineBefore, gaBaselineAfter, gaRollover, automationAt, automationStatus, automationSummary, siteLive, siteWindow, latestDailySummaryState, latestDailySummaryPush, latestDailySummaryLog, cityActivity] = await Promise.all([
    db.prepare(`SELECT COUNT(*) AS total FROM push_history WHERE type='site-subscriber' AND datetime(created_at) >= datetime(?1)`).bind(window.startAt).first(),
    db.prepare(`SELECT COUNT(*) AS total FROM comments WHERE datetime(created_at) >= datetime(?1)`).bind(window.startAt).first(),
    db.prepare(`SELECT COUNT(*) AS total FROM comment_likes WHERE datetime(created_at) >= datetime(?1)`).bind(window.startAt).first(),
    db.prepare(`SELECT
      SUM(CASE WHEN type IN ('youtube-comment','youtube-comment-count') THEN 1 ELSE 0 END) AS comments,
      SUM(CASE WHEN type IN ('youtube-subscriber','youtube-subscriber-count') THEN 1 ELSE 0 END) AS subscribers,
      SUM(CASE WHEN type='youtube-like' THEN 1 ELSE 0 END) AS likes
      FROM push_history WHERE datetime(created_at) >= datetime(?1)`).bind(window.startAt).first(),
    db.prepare(`SELECT message, details_json AS detailsJson FROM push_history WHERE type='youtube-like' AND status='sent' AND datetime(created_at) >= datetime(?1) ORDER BY created_at ASC`).bind(window.startAt).all(),
    db.prepare(`SELECT type, title, message, details_json AS detailsJson FROM push_history WHERE type IN ('youtube-subscriber','youtube-subscriber-count') AND status='sent' AND datetime(created_at) >= datetime(?1) ORDER BY created_at ASC`).bind(window.startAt).all(),
    db.prepare(`SELECT COUNT(*) AS total FROM (
      SELECT COALESCE(NULLIF(video_id,''), id) AS release_key FROM push_history
      WHERE type IN ('auto-release','auto-release-retry','release-publish') AND datetime(created_at) >= datetime(?1)
      UNION
      SELECT video_id AS release_key FROM release_history WHERE datetime(published_at) >= datetime(?1)
    )`).bind(window.startAt).first(),
    getPushState(db, 'youtube-latest-public'),
    db.prepare(`SELECT id, type, source, audience, title, message, url, video_id AS videoId, video_title AS videoTitle, status, created_at AS createdAt
      FROM push_history
      WHERE type IN ('youtube-comment','youtube-comment-count','youtube-subscriber','youtube-subscriber-count','youtube-like','site-subscriber','comment-live','comment-pending','auto-release','auto-release-retry','release-publish')
        AND datetime(created_at) >= datetime(?1)
      ORDER BY datetime(created_at) DESC LIMIT 200`).bind(window.startAt).all(),
    db.prepare(`SELECT metrics_json, created_at FROM platform_snapshots WHERE platform='youtube' ORDER BY datetime(created_at) DESC LIMIT 1`).first(),
    db.prepare(`SELECT metrics_json, created_at FROM platform_snapshots WHERE platform='youtube' AND datetime(created_at) <= datetime(?1) ORDER BY datetime(created_at) DESC LIMIT 1`).bind(window.startAt).first(),
    db.prepare(`SELECT metrics_json, created_at FROM platform_snapshots WHERE platform='youtube' AND datetime(created_at) >= datetime(?1) AND datetime(created_at) < datetime(?2) ORDER BY datetime(created_at) ASC LIMIT 1`).bind(window.startAt, window.endAt).first(),
    db.prepare(`SELECT metrics_json, created_at FROM platform_snapshots WHERE platform='google-analytics' ORDER BY datetime(created_at) DESC LIMIT 1`).first(),
    db.prepare(`SELECT metrics_json, created_at FROM platform_snapshots WHERE platform='google-analytics' AND datetime(created_at) <= datetime(?1) ORDER BY datetime(created_at) DESC LIMIT 1`).bind(window.startAt).first(),
    db.prepare(`SELECT metrics_json, created_at FROM platform_snapshots WHERE platform='google-analytics' AND datetime(created_at) >= datetime(?1) AND datetime(created_at) < datetime(?2) ORDER BY datetime(created_at) ASC LIMIT 1`).bind(window.startAt, window.endAt).first(),
    window.crossesMidnight
      ? db.prepare(`SELECT metrics_json, created_at FROM platform_snapshots WHERE platform='google-analytics' AND datetime(created_at) <= datetime(?1) AND datetime(created_at) >= datetime(?2) ORDER BY datetime(created_at) DESC LIMIT 1`).bind(window.midnightAt, window.startAt).first()
      : Promise.resolve(null),
    getPushState(db, 'automation-last-check-at'),
    getPushState(db, 'automation-last-check-status'),
    getPushState(db, 'automation-last-check-summary'),
    getSiteLiveMetrics(db),
    getSiteWindowMetrics(db, window.startAt),
    getPushState(db, 'daily-owner-summary-last-metrics'),
    db.prepare(`
      SELECT details_json AS detailsJson, message, created_at AS createdAt
      FROM push_history
      WHERE type='daily-summary' AND status='sent'
        AND datetime(created_at) >= datetime('now','-36 hours')
      ORDER BY datetime(created_at) DESC
      LIMIT 1
    `).first(),
    db.prepare(`
      SELECT details_json AS detailsJson, created_at AS createdAt
      FROM system_logs
      WHERE scope='daily-summary'
        AND event IN ('sent','sent-partial','manual-sent')
        AND datetime(created_at) >= datetime('now','-30 hours')
      ORDER BY datetime(created_at) DESC
      LIMIT 1
    `).first(),
    collectDailyCityActivityR370(db, window, new Date().toISOString())
  ]);
  const ytBaseline = ytBaselineBefore || ytBaselineAfter;
  const gaBaseline = gaBaselineBefore || gaBaselineAfter;
  const ytNow = parseSnapshotMetrics(ytLatest);
  const ytStart = parseSnapshotMetrics(ytBaseline);
  const gaStart = { ...parseSnapshotMetrics(gaBaseline), __snapshotFound:Boolean(gaBaseline) };
  const gaBeforeMidnight = parseSnapshotMetrics(gaRollover);
  let gaNow = mergeGoogleWithSiteLive(parseSnapshotMetrics(gaLatest), siteLive);
  // R375: opening the daily summary must never wait on an external Google API.
  // The page is built immediately from D1 visit events, persisted platform snapshots
  // and push/event history. External analytics are refreshed by the server cron.
  // This removes the timeout path that previously left the UI on zero cards until
  // the manual push button was pressed.
  const youtubeCountries = normalizeDailyCountryRows(ytNow?.studio?.countries || []);
  const youtubeDailyCountries = normalizeDailyCountryRows(ytNow?.studio?.dailyCountries || [])
    .map(item => ({ ...item, delta:item.value }));
  const youtubeViewDelta = ytBaseline ? Math.max(0, Number(ytNow.views || 0) - Number(ytStart.views || 0)) : 0;
  const youtubeSubscriberDelta = ytBaseline ? Math.max(0, Number(ytNow.subscribers || 0) - Number(ytStart.subscribers || 0)) : 0;
  const youtubeLikeSnapshotDelta = ytBaseline && Number.isFinite(Number(ytNow.likesTotal)) && Number.isFinite(Number(ytStart.likesTotal))
    ? Math.max(0, Number(ytNow.likesTotal || 0) - Number(ytStart.likesTotal || 0)) : 0;
  const youtubeCommentSnapshotDelta = ytBaseline && Number.isFinite(Number(ytNow.commentsTotal)) && Number.isFinite(Number(ytStart.commentsTotal))
    ? Math.max(0, Number(ytNow.commentsTotal || 0) - Number(ytStart.commentsTotal || 0)) : 0;
  const storedPushMetrics = parseStoredDailySummaryMetricsForWindow(latestDailySummaryState, window.key);
  const historyPushMetrics = parseDailySummaryMetricsForWindow(latestDailySummaryPush, window.key);
  const logPushMetrics = parseDailySummaryMetricsForWindow(latestDailySummaryLog, window.key);
  const pushMetrics = mergeDailyMetrics(
    storedPushMetrics,
    historyPushMetrics,
    logPushMetrics,
    Object.keys(historyPushMetrics).length ? parseDailySummaryMessageMetrics(latestDailySummaryPush) : {}
  );
  const liveCountryDeltas = youtubeDailyCountries.slice(0,4);
  const pushCountryDeltas = Array.isArray(pushMetrics?.countryDeltas) ? pushMetrics.countryDeltas.slice(0,4) : [];
  const summarySource = Object.keys(pushMetrics).length ? 'push-merged' : 'live';
  const liveSummaryR213 = normalizeControlHomeSummaryR213({
    websiteUsers:Math.max(Number(siteWindow?.users || 0),googleSummaryWindowMetric(gaNow, gaStart, gaBeforeMidnight, window, 'activeUsers'),dailyMetric(pushMetrics,'siteUsers')),
    websiteViews:Math.max(Number(siteWindow?.views || 0),googleSummaryWindowMetric(gaNow, gaStart, gaBeforeMidnight, window, 'screenPageViews'),dailyMetric(pushMetrics,'siteViews')),
    siteSubscribers:Math.max(Number(siteSubscribers?.total || 0),dailyMetric(pushMetrics,'siteSubscribers')),
    siteComments:Math.max(Number(siteComments?.total || 0),dailyMetric(pushMetrics,'siteComments')),
    siteLikes:Math.max(Number(siteLikes?.total || 0),dailyMetric(pushMetrics,'siteLikes')),
    youtubeComments:Math.max(youtubeCommentSnapshotDelta,Number(youtubeEvents?.comments || 0),dailyMetric(pushMetrics,'youtubeComments')),
    youtubeSubscribers:Math.max(youtubeSubscriberDelta,sumYoutubeSubscriberHistoryDeltas(youtubeSubscriberRows?.results || []),dailyMetric(pushMetrics,'youtubeSubscribers')),
    youtubeLikes:Math.max(youtubeLikeSnapshotDelta,sumYoutubeLikeHistoryDeltas(youtubeLikeRows?.results || []),dailyMetric(pushMetrics,'youtubeLikes')),
    youtubeViews:Math.max(youtubeViewDelta,dailyMetric(pushMetrics,'youtubeViewDelta')),
    youtubeViewDelta:Math.max(youtubeViewDelta,dailyMetric(pushMetrics,'youtubeViewDelta')),
    releases:Math.max(Number(releases?.total || 0),dailyMetric(pushMetrics,'releases'),latestYoutubeReleaseCountForWindow(latestYoutubeState, window)),
    countryDeltas:liveCountryDeltas.length?liveCountryDeltas:pushCountryDeltas,
    totalCountries:Math.max(youtubeCountries.length,dailyMetric(pushMetrics,'totalCountries')),
    countryDate:ytNow?.studio?.dailyDate || pushMetrics?.countryDate || ''
  });
  const highWaterKeyR213 = `control-home-high-water-r213:${window.key}`;
  const previousHighWaterRowR213 = await getPushState(db, highWaterKeyR213).catch(() => null);
  const previousHighWaterR213 = parseControlHomeHighWaterR213(previousHighWaterRowR213);
  const summaryR213 = mergeControlHomeSummaryR213(previousHighWaterR213, liveSummaryR213);
  const previousSerializedR213 = JSON.stringify(normalizeControlHomeSummaryR213(previousHighWaterR213));
  const nextSerializedR213 = JSON.stringify(summaryR213);
  if (nextSerializedR213 !== previousSerializedR213) {
    await setPushState(db, highWaterKeyR213, JSON.stringify({ windowKey:window.key, summary:summaryR213, updatedAt:new Date().toISOString() })).catch(() => {});
  }
  return json({
    ok:true,
    period:'06:05-auto-cycle',
    windowKey:window.key,
    windowStartAt:window.startAt,
    windowEndAt:window.endAt,
    summary:summaryR213,
    cityActivity:Array.isArray(cityActivity)?cityActivity:[],
    activity:activityResult.results || [],
    automation:{
      lastCheckAt:automationAt?.value || '',
      status:automationStatus?.value || 'never',
      summary:parsePushSummary(automationSummary?.value || '')
    },
    snapshots:{ youtubeAt:ytLatest?.created_at || '', googleAt:gaLatest?.created_at || '' },
    summarySource,
    dailySummaryPushAt:latestDailySummaryLog?.createdAt || '',
    updatedAt:new Date().toISOString()
  });
}

async function handleControlGoogleAnalytics(request, env) {
  if (!adminAuthorized(request, env)) return json({ ok:false, error:'unauthorized' }, 401);

  const db = requireDb(env);
  await Promise.all([
    ensurePlatformAnalyticsSchema(db),
    ensureSiteMetricsSchema(db)
  ]);

  const [snapshotResult, liveResult] = await Promise.allSettled([
    db.prepare(`
      SELECT metrics_json, created_at
      FROM platform_snapshots
      WHERE platform='google-analytics'
      ORDER BY datetime(created_at) DESC
      LIMIT 1
    `).first(),
    getSiteLiveMetrics(db)
  ]);

  const row = snapshotResult.status === 'fulfilled' ? snapshotResult.value : null;
  const snapshot = parseSnapshotMetrics(row);
  const live = liveResult.status === 'fulfilled'
    ? liveResult.value
    : { configured:false, today:{}, realtime:{} };

  const hasSnapshot = Boolean(row);
  const google = mergeGoogleWithSiteLive({
    ...snapshot,
    configured:hasSnapshot ? snapshot.configured !== false : false,
    updatedAt:row?.created_at || snapshot.updatedAt || ''
  }, live);

  if (hasSnapshot || live.configured) {
    return json({
      ok:true,
      partial:!hasSnapshot,
      source:hasSnapshot ? 'snapshot+live-counter' : 'live-counter',
      google,
      website:google,
      snapshotAt:row?.created_at || '',
      updatedAt:new Date().toISOString()
    });
  }

  return json({
    ok:true,
    partial:true,
    source:'not-ready',
    google:{
      configured:false,
      error:'snapshot-not-ready',
      details:'Последний снимок GA4 ещё не создан центральным Cron.',
      trend:[],
      countries:[],
      pages:[],
      devices:[],
      week:{},
      month:{},
      liveCounter:live
    },
    website:{
      configured:false,
      error:'snapshot-not-ready',
      trend:[],
      countries:[],
      pages:[],
      devices:[],
      liveCounter:live
    },
    updatedAt:new Date().toISOString()
  });
}

async function handleControlSnapshotsRefresh(request, env) {
  if (!adminAuthorized(request, env)) return json({ ok:false, error:'unauthorized' }, 401);
  const result = await refreshControlSnapshots(env,{ force:true });
  return json({ ok:true, result, updatedAt:new Date().toISOString() });
}

async function handleControlSearchConsole(request, env) {
  if (!adminAuthorized(request, env)) return json({ ok:false, error:'unauthorized' }, 401);
  const db = requireDb(env);
  await ensurePlatformAnalyticsSchema(db);
  const refresh = new URL(request.url).searchParams.get('refresh') === '1';
  let liveError = '';
  if (refresh) {
    try {
      const live = await Promise.race([
        fetchGoogleSearchConsoleAnalytics(env),
        new Promise((_, reject) => setTimeout(() => reject(new Error('search-console-timeout')), 11500))
      ]);
      if (live?.configured) {
        await savePlatformSnapshot(db,'google-search-console',live,'manual-control-refresh');
        return json({ ok:true, searchConsole:live, updatedAt:new Date().toISOString() });
      }
      liveError = live?.error || 'search-console-not-configured';
    } catch (error) { liveError = searchConsoleErrorMessage(error); }
  }
  const row = await db.prepare(`SELECT metrics_json, created_at FROM platform_snapshots WHERE platform='google-search-console' ORDER BY created_at DESC LIMIT 1`).first();
  const snapshot = parseSnapshotMetrics(row);
  const credentials = parseGoogleSearchConsoleCredentials(env);
  if (row) {
    const error = snapshot.error || liveError || '';
    return json({
      ok:true,
      searchConsole:{
        ...snapshot,
        serviceAccountEmail:cleanPlainText(snapshot.serviceAccountEmail || credentials?.client_email || '',180),
        updatedAt:row.created_at || snapshot.updatedAt || '',
        error,
        friendlyError:error ? searchConsoleErrorMessage(error) : ''
      },
      updatedAt:new Date().toISOString()
    });
  }
  const configured = Boolean(credentials && getGoogleSearchConsoleSiteUrl(env));
  const error = liveError || (configured?'snapshot-not-ready':'search-console-not-configured');
  return json({ ok:true, searchConsole:{ configured, connected:false, siteUrl:getGoogleSearchConsoleSiteUrl(env), serviceAccountEmail:cleanPlainText(credentials?.client_email || '',180), error, friendlyError:searchConsoleErrorMessage(error) }, updatedAt:new Date().toISOString() });
}

async function handleControlAudience(request, env) {
  if (!adminAuthorized(request, env)) return json({ ok:false, error:'unauthorized' }, 401);
  const db = requireDb(env);
  await Promise.all([ensurePlatformAnalyticsSchema(db), ensureSiteMetricsSchema(db)]);
  const [gaRow, ytRow, scRow, siteLive] = await Promise.all([
    db.prepare(`SELECT metrics_json, created_at FROM platform_snapshots WHERE platform='google-analytics' ORDER BY created_at DESC LIMIT 1`).first(),
    db.prepare(`SELECT metrics_json, created_at FROM platform_snapshots WHERE platform='youtube' ORDER BY created_at DESC LIMIT 1`).first(),
    db.prepare(`SELECT metrics_json, created_at FROM platform_snapshots WHERE platform='google-search-console' ORDER BY created_at DESC LIMIT 1`).first(),
    getSiteLiveMetrics(db)
  ]);

  const googleSnapshot = parseSnapshotMetrics(gaRow);
  let youtubeSnapshot = parseSnapshotMetrics(ytRow);
  let youtubeSnapshotAt = ytRow?.created_at || youtubeSnapshot.updatedAt || '';
  const searchSnapshot = parseSnapshotMetrics(scRow);
  const refreshYoutube = new URL(request.url).searchParams.get('refresh') === '1';
  const youtubeSnapshotMs = Date.parse(youtubeSnapshotAt || '');
  const youtubeSnapshotAgeMinutes = Number.isFinite(youtubeSnapshotMs) ? Math.max(0, (Date.now() - youtubeSnapshotMs) / 60000) : Infinity;
  if (refreshYoutube) {
    try {
      const liveIdentity = await Promise.race([
        fetchYoutubeMonitorIdentity(env),
        new Promise((_, reject) => setTimeout(() => reject(new Error('youtube-live-timeout')), 8500))
      ]);
      youtubeSnapshot = await mergeYoutubeIdentityIntoLatestSnapshot(db, liveIdentity, 'control-audience-live-v55-00d');
      youtubeSnapshotAt = youtubeSnapshot.updatedAt || new Date().toISOString();
    } catch (_) {
      // Keep the last verified snapshot when YouTube is temporarily slow.
    }
  }
  const google = mergeGoogleWithSiteLive({
    ...googleSnapshot,
    configured:Boolean(gaRow && googleSnapshot.configured !== false),
    updatedAt:gaRow?.created_at || googleSnapshot.updatedAt || ''
  }, siteLive);
  const oauthRuntime = await getYoutubeOAuthRuntimeStatus(env,{ verify:false });
  const youtube = {
    ...youtubeSnapshot,
    configured:Boolean(ytRow && youtubeSnapshot.configured !== false),
    handle:cleanPlainText(env.YOUTUBE_CHANNEL_HANDLE || youtubeSnapshot.handle || '@andrikmetal', 100),
    studio:{
      ...(youtubeSnapshot.studio || {}),
      connected:Boolean(oauthRuntime.connected),
      configured:Boolean(oauthRuntime.clientConfigured),
      authSource:oauthRuntime.source,
      error:oauthRuntime.connected ? (youtubeSnapshot.studio?.error || '') : (oauthRuntime.clientConfigured ? 'youtube-oauth-not-connected' : 'youtube-oauth-client-not-configured')
    },
    updatedAt:youtubeSnapshotAt || youtubeSnapshot.updatedAt || ''
  };
  let searchConsole;
  if (scRow) {
    searchConsole = {
      ...searchSnapshot,
      configured:Boolean(searchSnapshot.configured),
      connected:Boolean(searchSnapshot.connected),
      updatedAt:scRow.created_at || searchSnapshot.updatedAt || ''
    };
  } else {
    // Never block the map/audience endpoint on a live Search Console request.
    // Search Console is refreshed by the central snapshot Cron; the dashboard
    // returns immediately and shows setup/snapshot status until that happens.
    const credentials = parseGoogleSearchConsoleCredentials(env);
    const configured = Boolean(credentials && getGoogleSearchConsoleSiteUrl(env));
    const error = configured ? 'snapshot-not-ready' : 'search-console-not-configured';
    searchConsole = {
      configured,
      connected:false,
      siteUrl:getGoogleSearchConsoleSiteUrl(env),
      serviceAccountEmail:cleanPlainText(credentials?.client_email || '',180),
      error,
      friendlyError:configured
        ? 'Ключ найден. Ожидается первая серверная проверка Search Console.'
        : 'Добавьте GOOGLE_ANALYTICS_CREDENTIALS или GOOGLE_SEARCH_CONSOLE_CREDENTIALS.'
    };
  }

  let control = { today:{}, platforms:[], searchEngines:[], albums:[], youtubeMonitor:{}, recentEvents:[] };
  try { control = await buildPlatformControlData(env, google, youtube, searchConsole); }
  catch (error) { control.error = cleanPlainText(error?.message || error, 300); }
  return json({
    ok:true,
    mode:'worker-snapshots',
    google,
    website:google,
    youtube,
    searchConsole,
    ...control,
    snapshots:{
      googleAt:gaRow?.created_at || '',
      youtubeAt:youtubeSnapshotAt || '',
      searchConsoleAt:scRow?.created_at || ''
    },
    updatedAt:new Date().toISOString()
  });
}

async function handleControlDashboard(request, env) {
  if (!adminAuthorized(request, env)) return json({ ok: false, error: 'unauthorized' }, 401);
  const db = requireDb(env);
  await Promise.all([
    ensureCommentsV4Schema(db),
    ensureLyricsV2Schema(db),
    ensurePushAutomationSchema(db),
    ensureControlV1Schema(db)
  ]);
  await backfillReleaseHistory(db);

  const [comments, lyrics, releases, pushes, devices, subscribers, latestBackup] = await Promise.all([
    db.prepare(`
      SELECT
        COUNT(*) AS total,
        SUM(CASE WHEN status = 'pending' THEN 1 ELSE 0 END) AS pending,
        SUM(CASE WHEN status = 'approved' THEN 1 ELSE 0 END) AS approved,
        COALESCE((SELECT COUNT(*) FROM comment_likes), 0) AS likes,
        COALESCE((SELECT COUNT(*) FROM comment_reports), 0) AS reports
      FROM comments
    `).first(),
    db.prepare(`
      SELECT
        COUNT(*) AS total,
        SUM(CASE WHEN enabled = 1 THEN 1 ELSE 0 END) AS enabled,
        SUM(CASE WHEN enabled = 1 AND json_valid(body_json) AND json_array_length(body_json) > 0
          AND NOT EXISTS (
            SELECT 1 FROM json_each(lyrics.body_json) line
            WHERE json_extract(line.value, '$.startMs') IS NULL
          ) THEN 1 ELSE 0 END) AS synced
      FROM lyrics
    `).first(),
    db.prepare(`SELECT COUNT(*) AS total FROM release_history`).first(),
    db.prepare(`
      SELECT
        SUM(CASE WHEN status = 'sent' THEN 1 ELSE 0 END) AS sent,
        SUM(CASE WHEN status = 'failed' THEN 1 ELSE 0 END) AS failed,
        SUM(CASE WHEN type IN ('auto-release','auto-release-retry','release-publish') AND status = 'sent' THEN 1 ELSE 0 END) AS releasePushes
      FROM push_history
    `).first(),
    db.prepare(`SELECT COUNT(*) AS total FROM push_admin_devices`).first(),
    db.prepare(`
      SELECT COUNT(*) AS total FROM (
        SELECT subscription_id FROM push_subscribers WHERE status = 'active'
        UNION
        SELECT subscription_id FROM push_admin_devices
      )
    `).first(),
    db.prepare(`
      SELECT id, storage, object_key AS objectKey, status, table_count AS tableCount,
             row_count AS rowCount, size_bytes AS sizeBytes, checksum, reason, error,
             created_at AS createdAt
      FROM backup_history
      ORDER BY created_at DESC
      LIMIT 1
    `).first()
  ]);

  const catalogTrackCount = COMMENT_SUBJECTS.filter(item => item.group && item.group !== 'general').length;
  return json({
    ok: true,
    stats: {
      catalogTracks: catalogTrackCount,
      comments: {
        total: Number(comments?.total || 0),
        pending: Number(comments?.pending || 0),
        approved: Number(comments?.approved || 0),
        likes: Number(comments?.likes || 0),
        reports: Number(comments?.reports || 0)
      },
      lyrics: {
        total: Number(lyrics?.total || 0),
        enabled: Number(lyrics?.enabled || 0),
        synced: Number(lyrics?.synced || 0)
      },
      releases: Number(releases?.total || 0),
      pushes: {
        sent: Number(pushes?.sent || 0),
        failed: Number(pushes?.failed || 0),
        releasePushes: Number(pushes?.releasePushes || 0)
      },
      ownerDevices: Number(devices?.total || 0),
      pushAudience: Number(subscribers?.total || 0)
    },
    backup: {
      latest: latestBackup || null,
      r2Configured: Boolean(getBackupBucket(env)),
      cronSecretConfigured: Boolean(env.CRON_SECRET),
      retention: getBackupBucket(env) ? 12 : 4,
      mode: getBackupBucket(env) ? 'r2' : 'd1-fallback'
    }
  });
}

const BACKUP_TABLES = [
  'comments', 'comment_likes', 'comment_reports', 'lyrics',
  'push_admin_devices', 'push_subscribers', 'push_playlist_seen', 'push_state', 'push_history', 'system_logs', 'observability_usage', 'control_monitor_samples', 'control_monitor_incidents',
  'release_history', 'youtube_event_seen', 'platform_accounts', 'platform_snapshots',
  'security_events', 'security_rate_buckets', 'site_visit_events'
];

async function buildDatabaseBackup(db) {
  await Promise.all([
    ensureCommentsV4Schema(db),
    ensureLyricsV2Schema(db),
    ensurePushAutomationSchema(db),
    ensureObservabilitySchema(db),
    ensureNativeMonitorSchema(db),
    ensureControlV1Schema(db),
    ensurePlatformAnalyticsSchema(db),
    ensureSecuritySchema(db),
    ensureSiteMetricsSchema(db)
  ]);
  await backfillReleaseHistory(db);
  const tables = {};
  const counts = {};
  let rowCount = 0;
  for (const table of BACKUP_TABLES) {
    const result = await db.prepare(`SELECT * FROM ${table}`).all();
    const rows = result.results || [];
    tables[table] = rows;
    counts[table] = rows.length;
    rowCount += rows.length;
  }
  const createdAt = new Date().toISOString();
  const payload = JSON.stringify({
    format: 'ANDRIK-D1-BACKUP',
    version: '53.0',
    createdAt,
    database: 'COMMENTS_DB',
    counts,
    tables
  });
  return { createdAt, payload, counts, rowCount, tableCount: BACKUP_TABLES.length };
}

async function pruneR2Backups(bucket, keep = 12) {
  try {
    const listed = await bucket.list({ prefix: 'andrik-d1-backups/', limit: 1000 });
    const objects = (listed.objects || []).filter(item => item.key !== 'andrik-d1-backups/latest.json').slice().sort((a, b) => new Date(b.uploaded || 0) - new Date(a.uploaded || 0));
    const stale = objects.slice(Math.max(1, keep));
    if (stale.length) await bucket.delete(stale.map(item => item.key));
  } catch (_) {}
}

async function createControlBackup(env, reason = 'manual-control') {
  const db = requireDb(env);
  await ensureControlV1Schema(db);
  const id = crypto.randomUUID();
  try {
    const backup = await buildDatabaseBackup(db);
    const sizeBytes = new TextEncoder().encode(backup.payload).byteLength;
    const checksum = await sha256Hex(backup.payload);
    let storage = 'd1-fallback';
    let objectKey = '';
    const bucket = getBackupBucket(env);

    if (bucket) {
      storage = 'r2';
      const stamp = backup.createdAt.replace(/[:.]/g, '-');
      const date = backup.createdAt.slice(0, 10).replace(/-/g, '/');
      objectKey = `andrik-d1-backups/${date}/andrik-db-${stamp}.json`;
      await bucket.put(objectKey, backup.payload, {
        httpMetadata: { contentType: 'application/json; charset=utf-8' },
        customMetadata: { checksum, version: '53.0', reason }
      });
      await bucket.put('andrik-d1-backups/latest.json', backup.payload, {
        httpMetadata: { contentType: 'application/json; charset=utf-8' },
        customMetadata: { checksum, version: '53.0', reason }
      });
      await pruneR2Backups(bucket, 12);
    } else {
      if (sizeBytes > 6_000_000) throw new Error('backup-bucket-required');
      await db.prepare(`
        INSERT INTO backup_snapshots (id, payload_json, created_at)
        VALUES (?, ?, datetime('now'))
      `).bind(id, backup.payload).run();
      await db.prepare(`
        DELETE FROM backup_snapshots
        WHERE id NOT IN (SELECT id FROM backup_snapshots ORDER BY created_at DESC LIMIT 4)
      `).run();
      objectKey = id;
    }

    await db.prepare(`
      INSERT INTO backup_history (
        id, storage, object_key, status, table_count, row_count, size_bytes,
        checksum, reason, error, created_at
      ) VALUES (?, ?, ?, 'completed', ?, ?, ?, ?, ?, '', datetime('now'))
    `).bind(id, storage, objectKey, backup.tableCount, backup.rowCount, sizeBytes, checksum, reason).run();
    await db.prepare(`
      DELETE FROM backup_history
      WHERE id NOT IN (SELECT id FROM backup_history ORDER BY created_at DESC LIMIT 100)
    `).run();
    return {
      ok: true, id, storage, objectKey, tableCount: backup.tableCount,
      rowCount: backup.rowCount, sizeBytes, checksum, reason,
      warning: storage === 'd1-fallback' ? 'r2-not-configured' : ''
    };
  } catch (error) {
    const message = cleanPlainText(error?.message || error, 700);
    await db.prepare(`
      INSERT INTO backup_history (id, storage, object_key, status, reason, error, created_at)
      VALUES (?, '', '', 'failed', ?, ?, datetime('now'))
    `).bind(id, reason, message).run().catch(() => {});
    throw error;
  }
}

async function handleBackupRun(request, env) {
  if (!adminAuthorized(request, env) && !cronAuthorized(request, env)) return json({ ok: false, error: 'unauthorized' }, 401);
  let reason = cronAuthorized(request, env) ? 'weekly-cron' : 'manual-control';
  try {
    const body = await readJsonBody(request, 4000).catch(() => ({}));
    reason = cleanPlainText(body.reason || reason, 80) || reason;
  } catch (_) {}
  try {
    return json(await createControlBackup(env, reason));
  } catch (error) {
    const message = cleanPlainText(error?.message || error, 700);
    return json({ ok: false, error: message === 'backup-bucket-required' ? message : 'backup-failed', details: message }, 500);
  }
}

async function handleBackupHistory(request, env) {
  if (!adminAuthorized(request, env)) return json({ ok: false, error: 'unauthorized' }, 401);
  const db = requireDb(env);
  await ensureControlV1Schema(db);
  const limit = Math.max(1, Math.min(60, Number(new URL(request.url).searchParams.get('limit') || 12)));
  const result = await db.prepare(`
    SELECT id, storage, object_key AS objectKey, status, table_count AS tableCount,
           row_count AS rowCount, size_bytes AS sizeBytes, checksum, reason, error,
           created_at AS createdAt
    FROM backup_history
    ORDER BY created_at DESC
    LIMIT ?
  `).bind(limit).all();
  return json({ ok: true, backups: result.results || [] });
}

async function handleBackupDownload(request, env) {
  if (!adminAuthorized(request, env)) return json({ ok: false, error: 'unauthorized' }, 401);
  const db = requireDb(env);
  await Promise.all([ensureControlV1Schema(db), ensurePlatformAnalyticsSchema(db)]);
  const id = cleanPlainText(new URL(request.url).searchParams.get('id'), 80);
  if (!id) return json({ ok: false, error: 'validation' }, 400);
  const entry = await db.prepare(`SELECT id, storage, object_key AS objectKey, status FROM backup_history WHERE id = ? LIMIT 1`).bind(id).first();
  if (!entry || entry.status !== 'completed') return json({ ok: false, error: 'backup-not-found' }, 404);
  let body = null;
  if (entry.storage === 'r2') {
    const bucket = getBackupBucket(env);
    if (!bucket) return json({ ok: false, error: 'backup-bucket-not-bound' }, 503);
    const object = await bucket.get(entry.objectKey);
    if (!object) return json({ ok: false, error: 'backup-not-found' }, 404);
    body = object.body;
  } else {
    const snapshot = await db.prepare(`SELECT payload_json AS payload FROM backup_snapshots WHERE id = ? LIMIT 1`).bind(entry.objectKey || id).first();
    if (!snapshot?.payload) return json({ ok: false, error: 'backup-not-found' }, 404);
    body = snapshot.payload;
  }
  return new Response(body, {
    headers: {
      'content-type': 'application/json; charset=utf-8',
      'content-disposition': `attachment; filename="andrik-d1-backup-${id}.json"`,
      'cache-control': 'no-store'
    }
  });
}

async function loadBackupForRestore(request, env) {
  const db = requireDb(env);
  await Promise.all([
    ensureCommentsV4Schema(db),
    ensureLyricsV2Schema(db),
    ensurePushAutomationSchema(db),
    ensureObservabilitySchema(db),
    ensureNativeMonitorSchema(db),
    ensureControlV1Schema(db),
    ensurePlatformAnalyticsSchema(db),
    ensureSecuritySchema(db),
    ensureSiteMetricsSchema(db)
  ]);
  const id = cleanPlainText(new URL(request.url).searchParams.get('id'), 80);
  if (!id) throw new Error('validation');
  const entry = await db.prepare(`
    SELECT id, storage, object_key AS objectKey, status, checksum, created_at AS createdAt
    FROM backup_history WHERE id = ? LIMIT 1
  `).bind(id).first();
  if (!entry || entry.status !== 'completed') throw new Error('backup-not-found');
  let text = '';
  if (entry.storage === 'r2') {
    const bucket = getBackupBucket(env);
    if (!bucket) throw new Error('backup-bucket-not-bound');
    const object = await bucket.get(entry.objectKey);
    if (!object) throw new Error('backup-not-found');
    text = await object.text();
  } else {
    const snapshot = await db.prepare(`SELECT payload_json AS payload FROM backup_snapshots WHERE id = ? LIMIT 1`)
      .bind(entry.objectKey || id).first();
    if (!snapshot?.payload) throw new Error('backup-not-found');
    text = snapshot.payload;
  }
  const payload = JSON.parse(text);
  if (payload?.format !== 'ANDRIK-D1-BACKUP' || !payload.tables || typeof payload.tables !== 'object') {
    throw new Error('invalid-backup-format');
  }
  const checksum = await sha256Hex(text);
  if (entry.checksum && checksum !== entry.checksum) throw new Error('checksum-mismatch');
  return { db, id, entry, text, payload, checksum };
}

async function getTableColumnNames(db, table) {
  const info = await db.prepare(`PRAGMA table_info("${table}")`).all();
  return (info.results || []).map(row => String(row.name || '')).filter(Boolean);
}

async function inspectBackupCompatibility(db, payload) {
  const missingTables = [];
  const unknownColumns = {};
  const counts = {};
  const optionalTables = new Set(['system_logs', 'push_subscribers', 'youtube_event_seen', 'platform_accounts', 'platform_snapshots', 'observability_usage', 'control_monitor_samples', 'control_monitor_incidents', 'security_events', 'security_rate_buckets', 'site_visit_events']);
  let rowCount = 0;
  for (const table of BACKUP_TABLES) {
    const rows = payload.tables?.[table];
    if (!Array.isArray(rows)) {
      if (optionalTables.has(table)) { counts[table] = 0; continue; }
      missingTables.push(table);
      continue;
    }
    counts[table] = rows.length;
    rowCount += rows.length;
    const allowed = new Set(await getTableColumnNames(db, table));
    const unknown = new Set();
    for (const row of rows) {
      for (const key of Object.keys(row || {})) if (!allowed.has(key)) unknown.add(key);
    }
    if (unknown.size) unknownColumns[table] = Array.from(unknown);
  }
  return {
    compatible: missingTables.length === 0 && Object.keys(unknownColumns).length === 0,
    missingTables,
    unknownColumns,
    counts,
    rowCount,
    tableCount: Object.keys(counts).length
  };
}

function chunkRows(rows, columnCount) {
  const maxRows = Math.max(1, Math.floor(850 / Math.max(1, columnCount)));
  const chunks = [];
  for (let index = 0; index < rows.length; index += maxRows) chunks.push(rows.slice(index, index + maxRows));
  return chunks;
}

async function restoreBackupTables(db, payload) {
  const deleteOrder = ['comment_likes', 'comment_reports', 'comments', 'lyrics', 'push_admin_devices', 'push_subscribers', 'push_playlist_seen', 'push_state', 'push_history', 'system_logs', 'observability_usage', 'control_monitor_incidents', 'control_monitor_samples', 'release_history', 'youtube_event_seen', 'platform_snapshots', 'platform_accounts', 'security_events', 'security_rate_buckets', 'site_visit_events'];
  const insertOrder = ['comments', 'comment_likes', 'comment_reports', 'lyrics', 'push_admin_devices', 'push_subscribers', 'push_playlist_seen', 'push_state', 'push_history', 'system_logs', 'observability_usage', 'control_monitor_incidents', 'control_monitor_samples', 'release_history', 'youtube_event_seen', 'platform_accounts', 'platform_snapshots', 'security_events', 'security_rate_buckets', 'site_visit_events'];
  const statements = deleteOrder
    .filter(table => Array.isArray(payload.tables?.[table]))
    .map(table => db.prepare(`DELETE FROM "${table}"`));

  for (const table of insertOrder) {
    const rows = payload.tables[table] || [];
    if (!rows.length) continue;
    const allowedColumns = await getTableColumnNames(db, table);
    const usedColumns = allowedColumns.filter(column => rows.some(row => Object.prototype.hasOwnProperty.call(row || {}, column)));
    if (!usedColumns.length) continue;
    for (const chunk of chunkRows(rows, usedColumns.length)) {
      const placeholders = chunk.map(() => `(${usedColumns.map(() => '?').join(',')})`).join(',');
      const sql = `INSERT INTO "${table}" (${usedColumns.map(column => `"${column}"`).join(',')}) VALUES ${placeholders}`;
      const values = [];
      for (const row of chunk) for (const column of usedColumns) values.push(row?.[column] ?? null);
      statements.push(db.prepare(sql).bind(...values));
    }
  }
  await db.batch(statements);
  return {
    tables: insertOrder.length,
    rows: insertOrder.reduce((sum, table) => sum + (payload.tables[table]?.length || 0), 0)
  };
}

async function handleBackupPreview(request, env) {
  if (!adminAuthorized(request, env)) return json({ ok: false, error: 'unauthorized' }, 401);
  try {
    const loaded = await loadBackupForRestore(request, env);
    const compatibility = await inspectBackupCompatibility(loaded.db, loaded.payload);
    return json({
      ok: true,
      id: loaded.id,
      createdAt: loaded.payload.createdAt || loaded.entry.createdAt || '',
      version: loaded.payload.version || '',
      checksum: loaded.checksum,
      sizeBytes: new TextEncoder().encode(loaded.text).byteLength,
      ...compatibility
    });
  } catch (error) {
    const message = cleanPlainText(error?.message || error, 120);
    const status = message === 'backup-not-found' ? 404 : message === 'validation' ? 400 : 422;
    return json({ ok: false, error: message }, status);
  }
}

async function handleBackupRestore(request, env) {
  if (!adminAuthorized(request, env)) return json({ ok: false, error: 'unauthorized' }, 401);
  const body = await readJsonBody(request, 4000).catch(() => ({}));
  const id = cleanPlainText(body.id, 80);
  const confirmation = cleanPlainText(body.confirmation, 40);
  if (!id || confirmation !== 'ВОССТАНОВИТЬ') return json({ ok: false, error: 'confirmation-required' }, 400);
  const restoreRequest = { url: `${new URL(request.url).origin}/api/backup/preview?id=${encodeURIComponent(id)}` };
  try {
    const loaded = await loadBackupForRestore(restoreRequest, env);
    const compatibility = await inspectBackupCompatibility(loaded.db, loaded.payload);
    if (!compatibility.compatible) return json({ ok: false, error: 'backup-incompatible', compatibility }, 409);
    const safety = await createControlBackup(env, 'pre-restore-safety');
    const restored = await restoreBackupTables(loaded.db, loaded.payload);
    await loaded.db.prepare(`
      INSERT INTO push_history (
        id, type, source, audience, status, title, message, url,
        video_id, video_title, onesignal_id, recipients, error, details_json, created_at
      ) VALUES (?, 'backup-restore', 'andrik-control', 'owner', 'sent', ?, ?, '', '', '', '', 0, '', ?, datetime('now'))
    `).bind(
      crypto.randomUUID(),
      'База восстановлена из резервной копии',
      `Восстановлена копия ${id}`,
      JSON.stringify({ backupId: id, safetyBackupId: safety.id, rows: restored.rows })
    ).run();
    return json({ ok: true, restoredFrom: id, safetyBackup: safety, restored });
  } catch (error) {
    const message = cleanPlainText(error?.message || error, 700);
    return json({ ok: false, error: 'restore-failed', details: message }, 500);
  }
}


async function promiseWithTimeout(promise, timeoutMs, label = 'timeout') {
  let timer;
  try {
    return await Promise.race([
      promise,
      new Promise((_, reject) => { timer = setTimeout(() => reject(new Error(label)), timeoutMs); })
    ]);
  } finally {
    if (timer) clearTimeout(timer);
  }
}

async function buildAndrikHealthSnapshot(env, options = {}) {
  const checkedAt = new Date().toISOString();
  const checks = [];
  checks.push({ id:'worker', label:'Cloudflare Worker', status:'good', detail:'Worker отвечает' });

  if (!env.COMMENTS_DB) {
    checks.push({ id:'database', label:'D1', status:'error', detail:'COMMENTS_DB не подключена' });
  } else {
    try {
      const started = Date.now();
      await promiseWithTimeout(env.COMMENTS_DB.prepare('SELECT 1 AS ok').first(), 3500, 'database-timeout');
      checks.push({ id:'database', label:'D1', status:'good', detail:`Ответ ${Date.now()-started} мс` });
    } catch (error) {
      checks.push({ id:'database', label:'D1', status:'error', detail:cleanPlainText(error?.message || error,160) });
    }
  }

  if (env.COMMENTS_DB) {
    try {
      const row = await env.COMMENTS_DB.prepare(`SELECT value, updated_at AS updatedAt FROM push_state WHERE key='automation-last-check-at' LIMIT 1`).first();
      const lastAt = row?.value || '';
      const parsed = Date.parse(lastAt);
      const ageMinutes = Number.isFinite(parsed) ? Math.max(0, Math.round((Date.now()-parsed)/60000)) : null;
      const status = ageMinutes === null ? 'warning' : ageMinutes <= 60 ? 'good' : ageMinutes <= 180 ? 'warning' : 'error';
      checks.push({ id:'cron', label:'Центральный Cron', status, detail:ageMinutes === null ? 'Ещё не запускался' : `Последний запуск ${ageMinutes} мин назад`, lastCheckAt:lastAt, ageMinutes });
    } catch (error) {
      checks.push({ id:'cron', label:'Центральный Cron', status:'warning', detail:'Состояние недоступно' });
    }
  }

  if (options.checkSite !== false) {
    try {
      const started = Date.now();
      const siteUrl = cleanPlainText(env.PUBLIC_SITE_ORIGIN || 'https://andrikmetal.com/', 300) || 'https://andrikmetal.com/';
      const response = await promiseWithTimeout(fetch(siteUrl, {
        method:'GET', redirect:'follow', headers:{ accept:'text/html', 'user-agent':'ANDRIK-Health/54.95' }
      }), 5000, 'site-timeout');
      const ok = response.ok;
      try { await response.body?.cancel(); } catch (_) {}
      checks.push({ id:'site', label:'Сайт ANDRIK', status:ok?'good':'error', detail:`HTTP ${response.status} · ${Date.now()-started} мс` });
    } catch (error) {
      checks.push({ id:'site', label:'Сайт ANDRIK', status:'error', detail:cleanPlainText(error?.message || error,160) });
    }
  }

  if (env.COMMENTS_DB && options.includeMonitor !== false) {
    try {
      const [lastAtRow, lastStatusRow, errorRow, warningRow] = await Promise.all([
        getPushState(env.COMMENTS_DB, 'native-monitor-last-sync-at'),
        getPushState(env.COMMENTS_DB, 'native-monitor-last-status'),
        getPushState(env.COMMENTS_DB, 'native-monitor-error-count'),
        getPushState(env.COMMENTS_DB, 'native-monitor-warning-count')
      ]);
      const lastAt = lastAtRow?.value || '';
      const ageMinutes = Number.isFinite(Date.parse(lastAt)) ? Math.max(0, Math.round((Date.now()-Date.parse(lastAt))/60000)) : null;
      const lastStatus = lastStatusRow?.value || 'waiting';
      const status = lastStatus === 'error' ? 'error' : lastStatus === 'good' && ageMinutes !== null && ageMinutes <= 60 ? 'good' : 'warning';
      const detail = lastStatus === 'error'
        ? `Недоступных точек: ${Number(errorRow?.value || 0)}`
        : ageMinutes === null
          ? 'Ожидает первой встроенной проверки'
          : lastStatus === 'warning'
            ? `Предупреждений: ${Number(warningRow?.value || 0)} · обновлено ${ageMinutes} мин назад`
            : `Все точки доступны · обновлено ${ageMinutes} мин назад`;
      checks.push({ id:'native-monitor', label:'ANDRIK Monitor', status, detail, lastCheckAt:lastAt, ageMinutes });
    } catch (_) {
      checks.push({ id:'native-monitor', label:'ANDRIK Monitor', status:'warning', detail:'Состояние встроенного мониторинга недоступно' });
    }
  }

  const criticalError = checks.some(item => ['worker','database','site'].includes(item.id) && item.status === 'error');
  const hasWarning = checks.some(item => item.status !== 'good');
  return {
    status:criticalError ? 'down' : hasWarning ? 'degraded' : 'ok',
    checkedAt,
    checks,
    version:ANDRIK_CONTROL_RELEASE.full
  };
}

function isAndrikGuardHealthProbe(request) {
  const userAgent = String(request.headers.get('user-agent') || '');
  const explicit = String(request.headers.get('x-andrik-guard') || '');
  return explicit === '1' || /ANDRIK[\s_-]*Guard/i.test(userAgent);
}

async function runYoutubeEventsFromGuardHealth(env) {
  if (!env.COMMENTS_DB || !String(env.CRON_SECRET || '').trim()) return { ok:false, skipped:true, reason:'bridge-not-configured' };
  const db = requireDb(env);
  await Promise.all([ensurePushAutomationSchema(db), ensureControlV1Schema(db), ensurePlatformAnalyticsSchema(db)]);
  const lockKey = 'youtube-guard-health-bridge-lock-r302';
  const lastCheck = await getPushState(db, 'youtube-events-last-check-at').catch(() => null);
  const lastMs = Date.parse(lastCheck?.value || lastCheck?.updatedAt || '');
  if (Number.isFinite(lastMs) && Date.now() - lastMs < 7 * 60 * 1000) {
    return { ok:true, skipped:true, reason:'recent-youtube-check', lastCheckAt:lastCheck?.value || lastCheck?.updatedAt || '' };
  }
  await db.prepare(`DELETE FROM push_state WHERE key=? AND updated_at < datetime('now','-15 minutes')`).bind(lockKey).run().catch(() => {});
  if (!await claimPushOnce(db, lockKey, new Date().toISOString())) return { ok:true, skipped:true, reason:'bridge-already-running' };
  try {
    await setPushState(db, 'youtube-guard-health-bridge-last-at-r302', new Date().toISOString()).catch(() => {});
    const synthetic = new Request('https://control.andrikmetal.com/api/push/check-youtube-events', {
      method:'POST',
      headers:{
        'x-cron-key':String(env.CRON_SECRET || ''),
        'user-agent':'ANDRIK-Guard-Health-Bridge/R302',
        accept:'application/json'
      }
    });
    const response = await handleCheckYoutubeEvents(synthetic, env);
    const payload = await response.clone().json().catch(() => ({}));
    if (!response.ok || payload?.ok === false) {
      throw new Error(cleanPlainText(payload?.details || payload?.error || `youtube-events-http-${response.status}`, 500));
    }
    await setPushState(db, 'youtube-guard-health-bridge-last-ok-r302', new Date().toISOString()).catch(() => {});
    await recordSystemLog(env, {
      scope:'youtube-events', level:'info', event:'guard-health-bridge-ok',
      message:'Guard health-check запустил фоновую проверку комментариев, лайков и подписчиков YouTube.',
      details:{ checkedAt:payload?.checkedAt || new Date().toISOString(), commentsSent:payload?.commentsSent || 0, likesSent:payload?.likesSent || 0, subscribersSent:payload?.subscribersSent || 0 }
    }).catch(() => {});
    return { ok:true, payload };
  } catch (error) {
    const message = cleanPlainText(error?.message || error, 500);
    await setPushState(db, 'youtube-guard-health-bridge-last-error-r302', message).catch(() => {});
    await recordSystemLog(env, {
      scope:'youtube-events', level:'error', event:'guard-health-bridge-failed',
      message:'Фоновая проверка YouTube от Guard завершилась ошибкой.', details:{ error:message }
    }).catch(() => {});
    return { ok:false, error:message };
  } finally {
    await releasePushOnceClaim(db, lockKey).catch(() => {});
  }
}

async function handlePublicHealth(request, env, ctx) {
  // R302 fail-safe: the external ANDRIK Guard already wakes on its own Cron.
  // Its normal /api/health probe now also starts the YouTube event checker in
  // the background, so comment/like pushes no longer depend on opening Control.
  if (isAndrikGuardHealthProbe(request) && ctx?.waitUntil) {
    ctx.waitUntil(Promise.allSettled([
      runYoutubeEventsFromGuardHealth(env),
      refreshDailySummaryAccumulatorR305(env, 'guard-health')
    ]));
  }
  const health = await buildAndrikHealthSnapshot(env, { checkSite:true });
  const statusCode = health.status === 'down' ? 503 : 200;
  return json({ ok:health.status !== 'down', ...health }, statusCode, {
    ...JSON_HEADERS,
    'cache-control':'no-cache, no-store, must-revalidate'
  });
}

async function handleControlObservability(request, env) {
  if (!adminAuthorized(request, env)) return json({ ok:false, error:'unauthorized' }, 401);
  const db = requireDb(env);
  await Promise.all([ensurePushAutomationSchema(db), ensureObservabilitySchema(db), ensureNativeMonitorSchema(db)]);
  const dateKey = getBratislavaClock().date;
  const [health, counts, recent, usageRows, firstUsage] = await Promise.all([
    buildAndrikHealthSnapshot(env, { checkSite:true }),
    db.prepare(`
      SELECT
        SUM(CASE WHEN level='error' THEN 1 ELSE 0 END) AS errors,
        SUM(CASE WHEN level='warning' THEN 1 ELSE 0 END) AS warnings,
        COUNT(*) AS total
      FROM system_logs
      WHERE datetime(created_at) >= datetime('now','-24 hours')
    `).first(),
    db.prepare(`
      SELECT scope, level, event, message, details_json AS detailsJson, created_at AS createdAt
      FROM system_logs
      WHERE level IN ('error','warning')
      ORDER BY datetime(created_at) DESC
      LIMIT 20
    `).all(),
    db.prepare(`
      SELECT service, units, requests, details_json AS detailsJson, updated_at AS updatedAt
      FROM observability_usage
      WHERE date_key=?
      ORDER BY service
    `).bind(dateKey).all(),
    db.prepare(`SELECT MIN(updated_at) AS trackedSince FROM observability_usage`).first()
  ]);
  const usage = Object.fromEntries((usageRows.results || []).map(row => [row.service, {
    units:Number(row.units || 0), requests:Number(row.requests || 0), updatedAt:row.updatedAt || ''
  }]));
  const dataUnits = Number(usage['youtube-data-api']?.units || 0);
  const dataLimit = Math.max(100, Number(env.YOUTUBE_DAILY_QUOTA_LIMIT || 10000));
  const analyticsRequests = Number(usage['youtube-analytics-api']?.requests || 0);
  const healthUrl = new URL('/api/health', request.url).toString();
  return json({
    ok:true,
    updatedAt:new Date().toISOString(),
    health,
    errors24h:{ errors:Number(counts?.errors || 0), warnings:Number(counts?.warnings || 0), total:Number(counts?.total || 0) },
    recentIssues:(recent.results || []).map(item => ({
      scope:item.scope || 'system', level:item.level || 'warning', event:item.event || '', message:item.message || '', createdAt:item.createdAt || ''
    })),
    youtubeQuota:{
      dateKey,
      dataApi:{ units:dataUnits, limit:dataLimit, remaining:Math.max(0,dataLimit-dataUnits), percent:Math.min(100,Math.round((dataUnits/dataLimit)*1000)/10), requests:Number(usage['youtube-data-api']?.requests || 0) },
      analyticsApi:{ requests:analyticsRequests },
      trackedSince:firstUsage?.trackedSince || '',
      approximate:true
    },
    externalMonitor:{ ready:true, healthUrl, connected:true, note:'Встроенный ANDRIK Monitor использует эту точку для проверки Worker и D1. Дополнительные ключи не требуются.' }
  });
}


const COMMENT_COLLECTION_TIME_ZONE = 'Europe/Bratislava';
let commentCollectionFormatter = null;

function commentCollectionDateParts(value) {
  const raw = String(value || '').trim();
  const normalized = /^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}$/.test(raw) ? `${raw.replace(' ','T')}Z` : raw;
  const date = new Date(normalized || 0);
  if (!Number.isFinite(date.getTime())) return { year:0, month:0, day:0, date:'', time:'', timestamp:'' };
  if (!commentCollectionFormatter) {
    commentCollectionFormatter = new Intl.DateTimeFormat('en-CA', {
      timeZone: COMMENT_COLLECTION_TIME_ZONE,
      year:'numeric', month:'2-digit', day:'2-digit',
      hour:'2-digit', minute:'2-digit', hourCycle:'h23'
    });
  }
  const values = Object.fromEntries(commentCollectionFormatter.formatToParts(date).map(part => [part.type, part.value]));
  const year = Number(values.year || 0);
  const month = Number(values.month || 0);
  const day = Number(values.day || 0);
  return {
    year,
    month,
    day,
    date: year && month && day ? `${String(year).padStart(4,'0')}-${String(month).padStart(2,'0')}-${String(day).padStart(2,'0')}` : '',
    time: `${values.hour || '00'}:${values.minute || '00'}`,
    timestamp: date.toISOString()
  };
}

function parseCommentCollectionJson(value) {
  try { return JSON.parse(value || '{}') || {}; }
  catch (_) { return {}; }
}

async function loadUnifiedCommentCollection(db) {
  await Promise.all([ensureCommentsV4Schema(db), ensureControlV1Schema(db)]);
  const [siteResult, youtubeResult] = await Promise.all([
    db.prepare(`
      SELECT id, name, message, locale, status,
             song_slug AS songSlug, song_title AS songTitle,
             created_at AS createdAt, updated_at AS updatedAt,
             (SELECT COUNT(*) FROM comment_likes l WHERE l.comment_id = comments.id) AS likeCount
      FROM comments
      ORDER BY datetime(created_at) DESC
      LIMIT 5000
    `).all(),
    db.prepare(`
      SELECT resource_id AS id, video_id AS videoId, title, author, url,
             payload_json AS payloadJson,
             first_seen_at AS firstSeenAt, last_seen_at AS lastSeenAt
      FROM youtube_event_seen
      WHERE event_type = 'comment'
      ORDER BY datetime(first_seen_at) DESC
      LIMIT 5000
    `).all()
  ]);

  const unified = [];
  const seen = new Set();
  for (const row of siteResult.results || []) {
    const id = cleanPlainText(row.id || '', 100);
    if (!id || seen.has(`site:${id}`)) continue;
    seen.add(`site:${id}`);
    const date = commentCollectionDateParts(row.createdAt || row.updatedAt);
    if (!date.date) continue;
    const songSlug = cleanPlainText(row.songSlug || '', 100);
    const targetTitle = cleanPlainText(row.songTitle || 'Обсуждение ANDRIK', 220);
    unified.push({
      id:`site:${id}`,
      source:'site',
      sourceLabel:'Сайт',
      author:cleanPlainText(row.name || 'Посетитель сайта', 120),
      message:cleanPlainText(row.message || '', 1600),
      targetId:songSlug,
      targetTitle,
      url:songSlug ? `https://andrikmetal.com/comments.html?song=${encodeURIComponent(songSlug)}` : 'https://andrikmetal.com/comments.html',
      status:cleanPlainText(row.status || 'approved', 24),
      likeCount:Math.max(0, Number(row.likeCount || 0)),
      ...date
    });
  }

  for (const row of youtubeResult.results || []) {
    const payload = parseCommentCollectionJson(row.payloadJson);
    const rawId = cleanPlainText(payload.id || row.id || '', 160);
    if (!rawId || seen.has(`youtube:${rawId}`)) continue;
    seen.add(`youtube:${rawId}`);
    const publishedAt = payload.publishedAt || payload.updatedAt || row.firstSeenAt || row.lastSeenAt;
    const date = commentCollectionDateParts(publishedAt);
    if (!date.date) continue;
    const videoId = cleanPlainText(payload.videoId || row.videoId || '', 60);
    const commentUrl = cleanPlainText(payload.url || row.url || (videoId ? `https://www.youtube.com/watch?v=${encodeURIComponent(videoId)}` : 'https://www.youtube.com/@andrikmetal'), 700);
    unified.push({
      id:`youtube:${rawId}`,
      source:'youtube',
      sourceLabel:'YouTube',
      author:cleanPlainText(payload.author || row.author || 'Зритель YouTube', 160),
      message:cleanPlainText(payload.text || row.title || '', 1600),
      targetId:videoId,
      targetTitle:cleanPlainText(payload.videoTitle || 'Видео YouTube', 240),
      url:commentUrl,
      status:'published',
      likeCount:Math.max(0, Number(payload.likeCount || payload.likes || 0)),
      ...date
    });
  }
  return unified.sort((a,b) => String(b.timestamp).localeCompare(String(a.timestamp)));
}

async function handleControlCommentCollection(request, env) {
  if (!adminAuthorized(request, env)) return json({ ok:false, error:'unauthorized' }, 401);
  const db = requireDb(env);
  const url = new URL(request.url);
  const currentParts = commentCollectionDateParts(new Date().toISOString());
  const requestedYear = Number(url.searchParams.get('year') || currentParts.year || new Date().getUTCFullYear());
  const year = Math.max(2020, Math.min(2100, Number.isFinite(requestedYear) ? Math.trunc(requestedYear) : currentParts.year));
  const requestedDate = cleanPlainText(url.searchParams.get('date') || '', 10);
  const date = /^\d{4}-\d{2}-\d{2}$/.test(requestedDate) ? requestedDate : '';
  const requestedMonth = Number(url.searchParams.get('month') || 0);
  const month = requestedMonth >= 1 && requestedMonth <= 12 ? Math.trunc(requestedMonth) : 0;
  const source = ['site','youtube'].includes(url.searchParams.get('source')) ? url.searchParams.get('source') : 'all';
  const items = (await loadUnifiedCommentCollection(db)).filter(item => {
    const author = String(item?.author || '').trim().toLowerCase().replace(/^@+/, '').replace(/\s+/g, ' ');
    return author !== 'andrikmetal';
  });
  const availableYears = [...new Set([currentParts.year, ...items.map(item => item.year).filter(Boolean)])].sort((a,b)=>b-a);
  const months = Array.from({ length:12 }, (_, index) => ({
    month:index + 1,
    total:0,
    site:0,
    youtube:0,
    likes:0,
    days:[]
  }));
  const dayMaps = Array.from({ length:12 }, () => new Map());
  for (const item of items) {
    if (item.year !== year) continue;
    const month = months[item.month - 1];
    if (!month) continue;
    month.total += 1;
    month[item.source] += 1;
    month.likes += Math.max(0, Number(item.likeCount || 0));
    const map = dayMaps[item.month - 1];
    const entry = map.get(item.date) || { date:item.date, day:item.day, total:0, site:0, youtube:0, likes:0 };
    entry.total += 1;
    entry[item.source] += 1;
    entry.likes += Math.max(0, Number(item.likeCount || 0));
    map.set(item.date, entry);
  }
  months.forEach((month, index) => {
    month.days = [...dayMaps[index].values()].sort((a,b)=>a.day-b.day);
  });
  let comments = [];
  if (date) {
    comments = items.filter(item => item.date === date && (source === 'all' || item.source === source));
  } else if (month) {
    comments = items.filter(item => item.year === year && item.month === month && (source === 'all' || item.source === source));
  }
  const totals = months.reduce((acc, month) => ({
    total:acc.total + month.total,
    site:acc.site + month.site,
    youtube:acc.youtube + month.youtube,
    likes:acc.likes + Number(month.likes || 0)
  }), { total:0, site:0, youtube:0, likes:0 });
  return json({
    ok:true,
    timeZone:COMMENT_COLLECTION_TIME_ZONE,
    year,
    currentDate:currentParts.date,
    availableYears,
    months,
    totals,
    selectedDate:date,
    selectedMonth:month,
    source,
    comments,
    updatedAt:new Date().toISOString()
  });
}



// === ANDRIK Control R115: live security hub + event history + backups + attack map ===
const SITE_UPDATE_VERSION = ANDRIK_CONTROL_RELEASE.siteUpdater;
const SITE_UPDATE_MAX_ZIP_BYTES = 25 * 1024 * 1024;
const SITE_UPDATE_MAX_FILES = 1200;
const SITE_UPDATE_MAX_TOTAL_BYTES = 40 * 1024 * 1024;
const SITE_UPDATE_MAX_FILE_BYTES = 10 * 1024 * 1024;
const SITE_UPDATE_REQUIRED_FILES = ['index.html', '_worker.js', 'service-worker.js'];
const SITE_UPDATE_DEFAULT_PROTECTED = [
  '.github/', '.gitignore', '.gitattributes', 'README.md', 'LICENSE', 'LICENSE.md',
  'CNAME', 'wrangler.toml', 'wrangler.json', 'wrangler.jsonc', 'package.json',
  'package-lock.json', 'pnpm-lock.yaml', 'yarn.lock', 'site-update-state.json'
];

function siteUpdateConfig(env) {
  const owner = cleanPlainText(env.GITHUB_SITE_OWNER || 'ANDRIKMETAL', 80);
  const repo = cleanPlainText(env.GITHUB_SITE_REPO || 'andrik-control-stable', 120);
  const branch = cleanPlainText(env.GITHUB_SITE_BRANCH || 'main', 120);
  const token = String(env.GITHUB_SITE_TOKEN || '').trim();
  const extraProtected = String(env.GITHUB_SITE_PROTECTED_PATHS || '')
    .split(',').map(item => item.trim()).filter(Boolean);
  return {
    owner, repo, branch, token,
    protectedPaths: [...new Set([...SITE_UPDATE_DEFAULT_PROTECTED, ...extraProtected])]
  };
}

function siteUpdateReleaseConfig(env, siteConfig = siteUpdateConfig(env)) {
  return {
    owner: cleanPlainText(env.GITHUB_RELEASE_OWNER || siteConfig.owner || 'ANDRIKMETAL', 80),
    repo: cleanPlainText(env.GITHUB_RELEASE_REPO || 'andrik-control-stable', 120),
    branch: cleanPlainText(env.GITHUB_RELEASE_BRANCH || 'main', 120),
    token: String(env.GITHUB_RELEASE_TOKEN || siteConfig.token || '').trim(),
    enabled: !/^(0|false|off|no)$/i.test(String(env.GITHUB_RELEASE_ENABLED || 'true').trim())
  };
}

function siteUpdateConfigValid(config) {
  return /^[A-Za-z0-9_.-]{1,80}$/.test(config.owner) &&
    /^[A-Za-z0-9_.-]{1,120}$/.test(config.repo) &&
    /^[A-Za-z0-9._\/-]{1,120}$/.test(config.branch);
}

function siteUpdatePathProtected(path, protectedPaths) {
  return protectedPaths.some(rule => rule.endsWith('/') ? path.startsWith(rule) : path === rule);
}

function siteUpdateNormalizePath(rawPath) {
  const path = String(rawPath || '').replace(/\\/g, '/').replace(/^\.\//, '');
  if (!path || path.startsWith('/') || path.includes('\0') || path.length > 260) throw new Error('zip-invalid-path');
  const parts = path.split('/');
  if (parts.some(part => !part || part === '.' || part === '..' || /[\u0000-\u001f\u007f]/.test(part))) throw new Error('zip-invalid-path');
  return parts.join('/');
}

function siteUpdateIgnoredPath(path) {
  return path === '.DS_Store' || path.endsWith('/.DS_Store') || path === 'Thumbs.db' ||
    path.startsWith('__MACOSX/') || path.startsWith('.git/') || path.startsWith('node_modules/');
}

function siteUpdateForbiddenPath(path) {
  const base = path.split('/').pop().toLowerCase();
  return base === '.env' || base.startsWith('.env.') || base === '.dev.vars' ||
    /^(id_rsa|id_ed25519|credentials|secrets|service-account)(\.|$)/i.test(base) ||
    /\.(pem|key|p12|pfx|jks|keystore)$/i.test(base);
}

let siteUpdateCrcTable = null;
function siteUpdateCrc32(bytes) {
  if (!siteUpdateCrcTable) {
    siteUpdateCrcTable = new Uint32Array(256);
    for (let n = 0; n < 256; n++) {
      let c = n;
      for (let k = 0; k < 8; k++) c = (c & 1) ? (0xedb88320 ^ (c >>> 1)) : (c >>> 1);
      siteUpdateCrcTable[n] = c >>> 0;
    }
  }
  let crc = 0xffffffff;
  for (const byte of bytes) crc = siteUpdateCrcTable[(crc ^ byte) & 0xff] ^ (crc >>> 8);
  return (crc ^ 0xffffffff) >>> 0;
}

async function siteUpdateInflateRaw(bytes) {
  const stream = new Blob([bytes]).stream().pipeThrough(new DecompressionStream('deflate-raw'));
  return new Uint8Array(await new Response(stream).arrayBuffer());
}

function siteUpdateDecodeName(bytes) {
  try { return new TextDecoder('utf-8', { fatal:true }).decode(bytes); }
  catch (_) { return [...bytes].map(byte => String.fromCharCode(byte)).join(''); }
}

function siteUpdateFindEocd(bytes) {
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const minimum = Math.max(0, bytes.byteLength - 65557);
  for (let offset = bytes.byteLength - 22; offset >= minimum; offset--) {
    if (view.getUint32(offset, true) === 0x06054b50) return offset;
  }
  return -1;
}

async function siteUpdateReadZip(arrayBuffer) {
  const bytes = new Uint8Array(arrayBuffer);
  if (bytes.byteLength < 22 || bytes.byteLength > SITE_UPDATE_MAX_ZIP_BYTES) throw new Error('zip-size');
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const eocd = siteUpdateFindEocd(bytes);
  if (eocd < 0) throw new Error('zip-eocd');
  if (view.getUint16(eocd + 4, true) !== 0 || view.getUint16(eocd + 6, true) !== 0) throw new Error('zip-multidisk');
  const entryCount = view.getUint16(eocd + 10, true);
  const centralSize = view.getUint32(eocd + 12, true);
  const centralOffset = view.getUint32(eocd + 16, true);
  if (!entryCount || entryCount > SITE_UPDATE_MAX_FILES || centralOffset + centralSize > bytes.byteLength) throw new Error('zip-directory');
  let offset = centralOffset;
  let totalBytes = 0;
  const entries = [];
  const seen = new Set();
  for (let index = 0; index < entryCount; index++) {
    if (offset + 46 > bytes.byteLength || view.getUint32(offset, true) !== 0x02014b50) throw new Error('zip-central-entry');
    const flags = view.getUint16(offset + 8, true);
    const method = view.getUint16(offset + 10, true);
    const crc = view.getUint32(offset + 16, true);
    const compressedSize = view.getUint32(offset + 20, true);
    const uncompressedSize = view.getUint32(offset + 24, true);
    const nameLength = view.getUint16(offset + 28, true);
    const extraLength = view.getUint16(offset + 30, true);
    const commentLength = view.getUint16(offset + 32, true);
    const externalAttributes = view.getUint32(offset + 38, true);
    const localOffset = view.getUint32(offset + 42, true);
    if ([compressedSize, uncompressedSize, localOffset].includes(0xffffffff)) throw new Error('zip64-not-supported');
    const nameStart = offset + 46;
    const nameEnd = nameStart + nameLength;
    if (nameEnd > bytes.byteLength) throw new Error('zip-name');
    const rawName = siteUpdateDecodeName(bytes.subarray(nameStart, nameEnd));
    offset = nameEnd + extraLength + commentLength;
    if (rawName.endsWith('/')) continue;
    const unixMode = (externalAttributes >>> 16) & 0xffff;
    if ((unixMode & 0xf000) === 0xa000) throw new Error('zip-symlink');
    if (flags & 1) throw new Error('zip-encrypted');
    if (method !== 0 && method !== 8) throw new Error('zip-compression');
    const path = siteUpdateNormalizePath(rawName);
    if (siteUpdateIgnoredPath(path)) continue;
    if (siteUpdateForbiddenPath(path)) throw new Error(`forbidden-file:${path}`);
    if (seen.has(path)) throw new Error(`zip-duplicate:${path}`);
    seen.add(path);
    if (uncompressedSize > SITE_UPDATE_MAX_FILE_BYTES) throw new Error(`file-too-large:${path}`);
    totalBytes += uncompressedSize;
    if (totalBytes > SITE_UPDATE_MAX_TOTAL_BYTES) throw new Error('zip-uncompressed-size');
    if (localOffset + 30 > bytes.byteLength || view.getUint32(localOffset, true) !== 0x04034b50) throw new Error('zip-local-entry');
    const localNameLength = view.getUint16(localOffset + 26, true);
    const localExtraLength = view.getUint16(localOffset + 28, true);
    const dataStart = localOffset + 30 + localNameLength + localExtraLength;
    const dataEnd = dataStart + compressedSize;
    if (dataEnd > bytes.byteLength) throw new Error('zip-data');
    const compressed = bytes.subarray(dataStart, dataEnd);
    const content = method === 0 ? new Uint8Array(compressed) : await siteUpdateInflateRaw(compressed);
    if (content.byteLength !== uncompressedSize) throw new Error(`zip-size-mismatch:${path}`);
    if (siteUpdateCrc32(content) !== crc) throw new Error(`zip-crc:${path}`);
    entries.push({ path, bytes:content, size:content.byteLength });
  }
  if (!entries.length) throw new Error('zip-empty');
  const rootNames = entries.map(entry => entry.path);
  if (!rootNames.includes('index.html')) {
    const first = rootNames[0].split('/')[0];
    const prefix = `${first}/`;
    if (rootNames.every(path => path.startsWith(prefix)) && rootNames.includes(`${prefix}index.html`)) {
      const stripped = new Set();
      for (const entry of entries) {
        entry.path = siteUpdateNormalizePath(entry.path.slice(prefix.length));
        if (stripped.has(entry.path)) throw new Error(`zip-duplicate:${entry.path}`);
        stripped.add(entry.path);
      }
    }
  }
  const finalNames = new Set(entries.map(entry => entry.path));
  const missing = SITE_UPDATE_REQUIRED_FILES.filter(path => !finalNames.has(path));
  if (missing.length) throw new Error(`required-files:${missing.join(',')}`);
  return { entries, totalBytes, zipBytes:bytes.byteLength };
}

async function siteUpdateSha1Hex(bytes) {
  const digest = await crypto.subtle.digest('SHA-1', bytes);
  return [...new Uint8Array(digest)].map(byte => byte.toString(16).padStart(2, '0')).join('');
}

async function siteUpdateGitBlobSha(bytes) {
  const header = new TextEncoder().encode(`blob ${bytes.byteLength}\0`);
  const combined = new Uint8Array(header.byteLength + bytes.byteLength);
  combined.set(header, 0); combined.set(bytes, header.byteLength);
  return siteUpdateSha1Hex(combined);
}

function siteUpdateBase64(bytes) {
  let binary = '';
  const chunkSize = 0x8000;
  for (let offset = 0; offset < bytes.byteLength; offset += chunkSize) {
    const chunk = bytes.subarray(offset, Math.min(offset + chunkSize, bytes.byteLength));
    binary += String.fromCharCode(...chunk);
  }
  return btoa(binary);
}

async function siteUpdateGithubRequest(config, route, options = {}) {
  if (!config.token) throw new Error('github-token-missing');
  const method = options.method || 'GET';
  const defaultTimeout = method === 'GET' ? 25000 : 150000;
  const timeoutMs = Math.max(5000, Math.min(180000, Number(options.timeoutMs || defaultTimeout)));
  const retryableRoute = method === 'GET' || method === 'PATCH' ||
    /\/git\/(?:blobs|trees|commits)(?:\/|$)/.test(route);
  const attempts = retryableRoute ? 3 : 1;
  let lastError = null;

  for (let attempt = 1; attempt <= attempts; attempt++) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    try {
      const response = await fetch(`https://api.github.com${route}`, {
        method,
        signal:controller.signal,
        headers: {
          accept:'application/vnd.github+json',
          authorization:`Bearer ${config.token}`,
          'content-type':'application/json',
          'user-agent':'ANDRIK-Control-Site-Updater-R264',
          'x-github-api-version':'2022-11-28'
        },
        body: options.body === undefined ? undefined : JSON.stringify(options.body)
      });
      const raw = await response.text();
      let data = {};
      try { data = raw ? JSON.parse(raw) : {}; } catch (_) { data = { message:raw }; }
      if (response.ok) return data;

      const error = new Error(`github-${response.status}:${cleanPlainText(data.message || raw || 'request-failed', 300)}`);
      error.status = response.status;
      error.details = data;
      lastError = error;
      const transient = [429,500,502,503,504].includes(response.status);
      if (!transient || attempt >= attempts) throw error;
      const retryAfter = Math.max(0, Number(response.headers.get('retry-after') || 0) * 1000);
      await new Promise(resolve => setTimeout(resolve, Math.max(retryAfter, 450 * attempt * attempt)));
    } catch (error) {
      const normalized = error?.name === 'AbortError' ? Object.assign(new Error('github-timeout'), { status:504 }) : error;
      lastError = normalized;
      const networkTransient = normalized?.name === 'TypeError' ||
        String(normalized?.message || '') === 'github-timeout' ||
        [429,500,502,503,504].includes(Number(normalized?.status || 0));
      if (!retryableRoute || !networkTransient || attempt >= attempts) throw normalized;
      await new Promise(resolve => setTimeout(resolve, 450 * attempt * attempt));
    } finally {
      clearTimeout(timer);
    }
  }
  throw lastError || new Error('github-timeout');
}

async function siteUpdateGithubUploadAsset(config, releaseId, fileName, bytes) {
  if (!config.token) throw new Error('github-token-missing');
  const owner = encodeURIComponent(config.owner), repo = encodeURIComponent(config.repo);
  const safeName = String(fileName || 'ANDRIK-Control.zip').split('/').pop().replace(/[^A-Za-z0-9._-]+/g, '-').slice(0, 180) || 'ANDRIK-Control.zip';
  const url = `https://uploads.github.com/repos/${owner}/${repo}/releases/${encodeURIComponent(releaseId)}/assets?name=${encodeURIComponent(safeName)}`;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 120000);
  let response;
  try {
    response = await fetch(url, {
      method:'POST',
      signal:controller.signal,
      headers:{
        accept:'application/vnd.github+json',
        authorization:`Bearer ${config.token}`,
        'content-type':'application/zip',
        'user-agent':'ANDRIK-Control-Site-Updater-R113',
        'x-github-api-version':'2022-11-28'
      },
      body:bytes
    });
  } catch (error) {
    if (error?.name === 'AbortError') throw new Error('github-timeout');
    throw error;
  } finally {
    clearTimeout(timer);
  }
  const text = await response.text();
  let data = {};
  try { data = text ? JSON.parse(text) : {}; } catch (_) { data = { message:text }; }
  if (!response.ok) {
    const error = new Error(`github-${response.status}:${cleanPlainText(data.message || text || 'asset-upload-failed', 300)}`);
    error.status = response.status; error.details = data;
    throw error;
  }
  return data;
}

async function siteUpdateGithubSnapshot(config) {
  const owner = encodeURIComponent(config.owner);
  const repo = encodeURIComponent(config.repo);
  const branchRef = config.branch.split('/').map(encodeURIComponent).join('/');
  const ref = await siteUpdateGithubRequest(config, `/repos/${owner}/${repo}/git/ref/heads/${branchRef}`);
  const headSha = ref?.object?.sha;
  if (!headSha) throw new Error('github-head-missing');
  const commit = await siteUpdateGithubRequest(config, `/repos/${owner}/${repo}/git/commits/${headSha}`);
  const treeSha = commit?.tree?.sha;
  if (!treeSha) throw new Error('github-tree-missing');
  const tree = await siteUpdateGithubRequest(config, `/repos/${owner}/${repo}/git/trees/${treeSha}?recursive=1`);
  if (tree.truncated) throw new Error('github-tree-truncated');
  const files = new Map();
  for (const item of tree.tree || []) if (item.type === 'blob') files.set(item.path, item);
  return { headSha, treeSha, files, commit };
}

async function siteUpdatePrepareArchive(file) {
  const parsed = await siteUpdateReadZip(await file.arrayBuffer());
  await siteUpdateMapLimit(parsed.entries, 12, async entry => {
    entry.gitSha = await siteUpdateGitBlobSha(entry.bytes);
    return entry.gitSha;
  });
  return parsed;
}

function siteUpdateCompare(parsed, snapshot, config) {
  const archive = new Map(parsed.entries.map(entry => [entry.path, entry]));
  const added = [], changed = [], unchanged = [], deleted = [];
  for (const entry of parsed.entries) {
    const current = snapshot.files.get(entry.path);
    if (!current) added.push(entry.path);
    else if (current.sha !== entry.gitSha) changed.push(entry.path);
    else unchanged.push(entry.path);
  }
  for (const [path] of snapshot.files) {
    if (!archive.has(path) && !siteUpdatePathProtected(path, config.protectedPaths)) deleted.push(path);
  }
  return { archive, added, changed, unchanged, deleted };
}

async function siteUpdateMapLimit(items, limit, worker) {
  const results = new Array(items.length);
  let cursor = 0;
  async function run() {
    while (cursor < items.length) {
      const index = cursor++;
      results[index] = await worker(items[index], index);
    }
  }
  await Promise.all(Array.from({ length:Math.min(limit, items.length) }, run));
  return results;
}


function siteUpdateTextLikePath(path) {
  const value = String(path || '').toLowerCase();
  const name = value.split('/').pop();
  if (['_headers', '_redirects', '.gitignore', '.gitattributes', 'cname'].includes(name)) return true;
  return /\.(?:html?|css|js|mjs|cjs|json|jsonc|txt|md|xml|webmanifest|manifest|svg|csv|tsv|map|yml|yaml|toml|ini|conf|properties)$/i.test(value);
}

function siteUpdateInlineText(entry) {
  if (!entry || !siteUpdateTextLikePath(entry.path)) return null;
  if (!entry.bytes || entry.bytes.byteLength > 2 * 1024 * 1024) return null;
  if (entry.bytes.includes(0)) return null;
  try {
    const text = new TextDecoder('utf-8', { fatal:true }).decode(entry.bytes);
    return text;
  } catch (_) {
    return null;
  }
}

function siteUpdateTreeEntrySize(entry) {
  const content = typeof entry?.content === 'string' ? entry.content.length : 0;
  return 240 + String(entry?.path || '').length * 2 + Math.ceil(content * 1.35);
}

function siteUpdateTreeBatches(entries, maxEntries = 70, maxEstimatedBytes = 2200000) {
  const batches = [];
  let current = [];
  let size = 0;
  for (const entry of entries) {
    const entrySize = siteUpdateTreeEntrySize(entry);
    if (current.length && (current.length >= maxEntries || size + entrySize > maxEstimatedBytes)) {
      batches.push(current);
      current = [];
      size = 0;
    }
    current.push(entry);
    size += entrySize;
  }
  if (current.length) batches.push(current);
  return batches;
}

async function siteUpdateCreateTreeBatched(config, owner, repo, baseTreeSha, entries) {
  let treeSha = baseTreeSha;
  const batches = siteUpdateTreeBatches(entries);
  for (const batch of batches) {
    const tree = await siteUpdateGithubRequest(config, `/repos/${owner}/${repo}/git/trees`, {
      method:'POST',
      timeoutMs:60000,
      body:{ base_tree:treeSha, tree:batch }
    });
    if (!tree?.sha) throw new Error('github-tree-missing');
    treeSha = tree.sha;
  }
  return { sha:treeSha, batches:batches.length };
}


let siteUpdateHistoryCache = null;

function siteUpdateNewOperationId(prefix = 'update') {
  return `${prefix}-${Date.now()}-${crypto.randomUUID().replace(/-/g, '').slice(0, 10)}`;
}

function siteUpdateReleaseFromText(value) {
  const match = String(value || '').toUpperCase().match(/\bR\d{1,6}\b/);
  return match ? match[0] : '';
}

function siteUpdateBackupDate(tag) {
  const match = String(tag || '').match(/^control-backup-(\d{4})(\d{2})(\d{2})(\d{2})(\d{2})(\d{2})-/);
  if (!match) return '';
  const [, year, month, day, hour, minute, second] = match;
  return `${year}-${month}-${day}T${hour}:${minute}:${second}Z`;
}

async function siteUpdateCreateStateBlob(config, payload) {
  const owner = encodeURIComponent(config.owner), repo = encodeURIComponent(config.repo);
  const state = {
    schema:1,
    updaterVersion:SITE_UPDATE_VERSION,
    ...payload,
    generatedAt:new Date().toISOString()
  };
  const bytes = new TextEncoder().encode(`${JSON.stringify(state, null, 2)}\n`);
  const blob = await siteUpdateGithubRequest(config, `/repos/${owner}/${repo}/git/blobs`, {
    method:'POST',
    body:{ content:siteUpdateBase64(bytes), encoding:'base64' }
  });
  return { sha:blob.sha, state };
}


function siteUpdateDecodeGithubBase64(value) {
  const clean = String(value || '').replace(/\s+/g, '');
  if (!clean) return '';
  try {
    const binary = atob(clean);
    const bytes = Uint8Array.from(binary, char => char.charCodeAt(0));
    return new TextDecoder('utf-8').decode(bytes);
  } catch (_) { return ''; }
}

async function siteUpdateReadBranchState(config, snapshot = null) {
  const current = snapshot || await siteUpdateGithubSnapshot(config);
  const entry = current.files.get('site-update-state.json');
  if (!entry?.sha) return { snapshot:current, state:null };
  const owner = encodeURIComponent(config.owner), repo = encodeURIComponent(config.repo);
  const blob = await siteUpdateGithubRequest(config, `/repos/${owner}/${repo}/git/blobs/${entry.sha}`);
  const text = siteUpdateDecodeGithubBase64(blob.content || '');
  let state = null;
  try { state = JSON.parse(text); } catch (_) {}
  return { snapshot:current, state };
}

async function siteUpdateReadDeployedState(request) {
  let status = 0, state = null;
  try {
    const stateUrl = new URL('/site-update-state.json', request.url);
    stateUrl.searchParams.set('health_probe', String(Date.now()));
    const response = await fetch(stateUrl.toString(), {
      method:'GET', cache:'no-store',
      headers:{ accept:'application/json', 'cache-control':'no-cache', 'user-agent':'ANDRIK-Control-R108-Health' }
    });
    status = response.status;
    if (response.ok) state = await response.json().catch(() => null);
    else { try { await response.body?.cancel(); } catch (_) {} }
  } catch (_) {}
  return { status, state };
}

async function siteUpdateConfirmedHealth(env) {
  const attempts = [];
  for (let index = 0; index < 3; index++) {
    const health = await buildAndrikHealthSnapshot(env, { checkSite:true, includeMonitor:true });
    attempts.push(health);
    if (health.status !== 'down') return { health, attempts };
    if (index < 2) await new Promise(resolve => setTimeout(resolve, 1100));
  }
  return { health:attempts[attempts.length - 1], attempts };
}


let siteUpdateRecoverySchemaPromise = null;

async function ensureSiteUpdateRecoverySchema(env) {
  if (!env.COMMENTS_DB) return;
  if (siteUpdateRecoverySchemaPromise) return siteUpdateRecoverySchemaPromise;
  siteUpdateRecoverySchemaPromise = (async () => {
    await env.COMMENTS_DB.prepare(`
      CREATE TABLE IF NOT EXISTS site_update_known_good (
        slot TEXT PRIMARY KEY,
        commit_sha TEXT NOT NULL,
        operation_id TEXT NOT NULL DEFAULT '',
        release TEXT NOT NULL DEFAULT '',
        health_json TEXT NOT NULL DEFAULT '{}',
        verified_at TEXT NOT NULL DEFAULT (datetime('now'))
      )
    `).run();
  })().finally(() => { siteUpdateRecoverySchemaPromise = null; });
  return siteUpdateRecoverySchemaPromise;
}

async function siteUpdateGetKnownGood(env) {
  if (!env.COMMENTS_DB) return null;
  await ensureSiteUpdateRecoverySchema(env);
  const row = await env.COMMENTS_DB.prepare(`
    SELECT commit_sha AS commitSha, operation_id AS operationId, release,
           health_json AS healthJson, verified_at AS verifiedAt
    FROM site_update_known_good WHERE slot='production' LIMIT 1
  `).first();
  if (!row || !/^[0-9a-f]{40}$/i.test(String(row.commitSha || ''))) return null;
  let health = {};
  try { health = JSON.parse(row.healthJson || '{}'); } catch (_) {}
  return { ...row, health };
}

async function siteUpdateSaveKnownGood(env, payload = {}) {
  if (!env.COMMENTS_DB) return null;
  const commitSha = cleanPlainText(payload.commitSha || '', 64);
  if (!/^[0-9a-f]{40}$/i.test(commitSha)) return null;
  await ensureSiteUpdateRecoverySchema(env);
  let healthJson = '{}';
  try { healthJson = JSON.stringify(payload.health || {}); } catch (_) {}
  await env.COMMENTS_DB.prepare(`
    INSERT INTO site_update_known_good(
      slot, commit_sha, operation_id, release, health_json, verified_at
    )
    VALUES ('production', ?, ?, ?, ?, datetime('now'))
    ON CONFLICT(slot) DO UPDATE SET
      commit_sha=excluded.commit_sha,
      operation_id=excluded.operation_id,
      release=excluded.release,
      health_json=excluded.health_json,
      verified_at=datetime('now')
  `).bind(
    commitSha,
    cleanPlainText(payload.operationId || '', 120),
    cleanPlainText(payload.release || '', 80),
    healthJson
  ).run();
  return siteUpdateGetKnownGood(env);
}

async function siteUpdateGuardRequest(env, path, payload = {}, timeoutMs = 30000) {
  const base = String(env.GUARD_URL || '').trim().replace(/\/+$/, '');
  const key = String(env.GUARD_KEY || '').trim();
  if (!base || !key) return { configured:false, ok:false, error:'guard-not-configured' };
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetch(`${base}${path}`, {
      method:'POST',
      signal:controller.signal,
      headers:{
        authorization:`Bearer ${key}`,
        'content-type':'application/json',
        accept:'application/json'
      },
      body:JSON.stringify(payload || {})
    });
    const data = await response.json().catch(() => ({}));
    return { configured:true, ok:response.ok && data?.ok !== false, status:response.status, ...data };
  } catch (error) {
    return {
      configured:true, ok:false,
      error:error?.name === 'AbortError' ? 'guard-timeout' : cleanPlainText(error?.message || error, 300)
    };
  } finally {
    clearTimeout(timer);
  }
}

async function siteUpdateRestoreRepositoryToCommit(env, targetSha, details = {}) {
  const cleanSha = cleanPlainText(targetSha || '', 64);
  if (!/^[0-9a-f]{40}$/i.test(cleanSha)) return { ok:false, error:'target-sha-invalid' };
  const config = siteUpdateConfig(env);
  if (!config.token || !siteUpdateConfigValid(config)) return { ok:false, error:'github-token-missing' };
  const snapshot = await siteUpdateGithubSnapshot(config);
  if (snapshot.headSha === cleanSha) return { ok:true, unchanged:true, commitSha:cleanSha };

  const owner = encodeURIComponent(config.owner), repo = encodeURIComponent(config.repo);
  const target = await siteUpdateGithubRequest(config, `/repos/${owner}/${repo}/git/commits/${cleanSha}`);
  const operationId = siteUpdateNewOperationId('guard-source-recovery');
  const marker = await siteUpdateCreateStateBlob(config, {
    operation:'guard-source-recovery',
    operationId,
    release:cleanPlainText(details.release || '', 80),
    targetSha:cleanSha,
    failedHead:snapshot.headSha,
    guardDeployment:cleanPlainText(details.recoveryDeployment || '', 120),
    autoRecovery:false
  });
  const tree = await siteUpdateGithubRequest(config, `/repos/${owner}/${repo}/git/trees`, {
    method:'POST',
    body:{
      base_tree:target.tree.sha,
      tree:[{ path:'site-update-state.json', mode:'100644', type:'blob', sha:marker.sha }]
    }
  });
  const commit = await siteUpdateGithubRequest(config, `/repos/${owner}/${repo}/git/commits`, {
    method:'POST',
    body:{
      message:`Guard recovery: restore verified source ${cleanSha.slice(0,7)}`,
      tree:tree.sha,
      parents:[snapshot.headSha],
      author:{ name:'ANDRIK Guard', email:'andrik-guard@users.noreply.github.com' }
    }
  });
  const branchRef = config.branch.split('/').map(encodeURIComponent).join('/');
  await siteUpdateGithubRequest(config, `/repos/${owner}/${repo}/git/refs/heads/${branchRef}`, {
    method:'PATCH', body:{ sha:commit.sha, force:false }
  });
  siteUpdateHistoryCache = null;
  await recordSystemLog(env, {
    scope:'guard', level:'warning', event:'source-restored',
    message:`GitHub восстановлен из проверенного commit ${cleanSha.slice(0,7)}`,
    details:{ targetSha:cleanSha, recoveryCommit:commit.sha, previousHead:snapshot.headSha, operationId }
  }).catch(() => {});
  return { ok:true, targetSha:cleanSha, commitSha:commit.sha, operationId };
}

function guardEventAuthorized(request, env) {
  const expected = String(env.GUARD_KEY || '');
  const supplied = String(request.headers.get('authorization') || '').replace(/^Bearer\s+/i, '');
  if (!expected || supplied.length !== expected.length) return false;
  let diff = 0;
  for (let i = 0; i < expected.length; i++) diff |= expected.charCodeAt(i) ^ supplied.charCodeAt(i);
  return diff === 0;
}

function classifyGuardEvent(eventValue) {
  const event = cleanPlainText(eventValue || '', 80).toLowerCase();
  const restored = /^(?:public-|project-)?recovery-restored$/.test(event);
  const failed = /^(?:public-|project-)?recovery-failed$/.test(event);
  const area = event.startsWith('public-') ? 'public'
    : event.startsWith('project-') ? 'project'
      : 'control';
  return {
    event,
    restored,
    failed,
    outage:event === 'outage-detected',
    started:event === 'recovery-started',
    area
  };
}

async function handleGuardEvent(request, env) {
  if (!guardEventAuthorized(request, env)) return json({ ok:false, error:'unauthorized' }, 401);
  const body = await readJsonBody(request, 20000).catch(() => ({}));
  const info = classifyGuardEvent(body.event);
  const event = info.event;
  const message = cleanPlainText(body.message || '', 700);
  const targetCommitSha = cleanPlainText(body.targetCommitSha || '', 64);
  const suppliedArea = cleanPlainText(body.area || '', 40).toLowerCase();
  const area = ['control','public','project'].includes(suppliedArea) ? suppliedArea : info.area;
  const details = {
    build:cleanPlainText(body.build || 'ANDRIK Guard 2.1 FULL', 100),
    area,
    badDeployment:cleanPlainText(body.badDeployment || '', 160),
    recoveryDeployment:cleanPlainText(body.recoveryDeployment || '', 160),
    targetCommitSha,
    startedAt:cleanPlainText(body.startedAt || '', 80),
    finishedAt:cleanPlainText(body.finishedAt || '', 80),
    reason:cleanPlainText(body.reason || '', 120)
  };

  const level = info.failed ? 'error' : info.restored ? 'info' : 'warning';
  await recordSystemLog(env, {
    scope:'guard',
    level,
    event:event || 'guard-event',
    message:message || event || 'Guard event',
    details
  }).catch(() => {});

  let sourceRecovery = null;
  let knownGood = null;
  if (info.restored && /^[0-9a-f]{40}$/i.test(targetCommitSha)) {
    sourceRecovery = await siteUpdateRestoreRepositoryToCommit(env, targetCommitSha, details).catch(error => ({
      ok:false, error:cleanPlainText(error?.message || error, 400)
    }));
    knownGood = await siteUpdateSaveKnownGood(env, {
      commitSha:targetCommitSha,
      operationId:`guard:${details.recoveryDeployment || Date.now()}`,
      release:'GUARD 2.1 RECOVERY',
      health:{
        status:'ok',
        source:'ANDRIK Guard 2.1 FULL',
        area,
        restoredAt:details.finishedAt || new Date().toISOString(),
        deployment:details.recoveryDeployment
      }
    }).catch(() => null);
  }

  /* Guard 2.1 сам всегда шлёт outage push. Поэтому callback только журналирует outage,
     иначе владелец получил бы два одинаковых уведомления. Финальный push через Control
     нужен только для control recovery: для public/project Guard 2.1 шлёт его напрямую. */
  if (info.restored && area === 'control') {
    await sendOwnerPush(env, {
      title:'✅ ANDRIK Control восстановлена',
      message:message || `Control восстановлена. Deploy ${details.recoveryDeployment.slice(0,8)}.`,
      url:'https://control.andrikmetal.com/'
    }).catch(() => {});
  } else if (info.failed && area === 'control') {
    await sendOwnerPush(env, {
      title:'🚨 ANDRIK Guard: восстановление не подтверждено',
      message:message || 'Проверь Control и Cloudflare.',
      url:'https://control.andrikmetal.com/protection-admin.html'
    }).catch(() => {});
  }

  return json({
    ok:true,
    accepted:true,
    build:'ANDRIK Guard 2.1 FULL compatible',
    event,
    area,
    restored:info.restored,
    failed:info.failed,
    sourceRecovery,
    knownGood
  });
}

async function siteUpdateStartAutomaticRecovery(config, env, failedState) {
  const targetSha = cleanPlainText(failedState?.backupSha || '', 64);
  if (!/^[0-9a-f]{40}$/i.test(targetSha)) throw new Error('recovery-backup-missing');

  const { snapshot, state:branchState } = await siteUpdateReadBranchState(config);
  if (!branchState || branchState.operationId !== failedState.operationId) throw new Error('deploy-marker-mismatch');
  if (snapshot.headSha === targetSha) {
    return { alreadyRecovered:true, recoveryOperationId:'', targetSha, targetShort:targetSha.slice(0,7) };
  }

  const failedBackup = await siteUpdateCreateBackup(config, snapshot, `failed-${failedState.release || 'deploy'}`);
  const owner = encodeURIComponent(config.owner), repo = encodeURIComponent(config.repo);
  const target = await siteUpdateGithubRequest(config, `/repos/${owner}/${repo}/git/commits/${targetSha}`);
  const recoveryOperationId = siteUpdateNewOperationId('recovery');
  const marker = await siteUpdateCreateStateBlob(config, {
    operation:'auto-recovery',
    operationId:recoveryOperationId,
    release:cleanPlainText(failedState.release || '', 80),
    recoveredFrom:cleanPlainText(failedState.operationId || '', 120),
    targetSha,
    failedHead:snapshot.headSha,
    failedBackup:failedBackup.tag,
    autoRecovery:false
  });
  const recoveryTree = await siteUpdateGithubRequest(config, `/repos/${owner}/${repo}/git/trees`, {
    method:'POST',
    body:{
      base_tree:target.tree.sha,
      tree:[{ path:'site-update-state.json', mode:'100644', type:'blob', sha:marker.sha }]
    }
  });
  const recoveryCommit = await siteUpdateGithubRequest(config, `/repos/${owner}/${repo}/git/commits`, {
    method:'POST',
    body:{
      message:`Automatic recovery via ANDRIK Control to ${targetSha.slice(0,7)}`,
      tree:recoveryTree.sha,
      parents:[snapshot.headSha],
      author:{ name:'ANDRIK Control', email:'andrik-control@users.noreply.github.com' }
    }
  });
  const branchRef = config.branch.split('/').map(encodeURIComponent).join('/');
  await siteUpdateGithubRequest(config, `/repos/${owner}/${repo}/git/refs/heads/${branchRef}`, {
    method:'PATCH', body:{ sha:recoveryCommit.sha, force:false }
  });
  siteUpdateHistoryCache = null;
  await recordSystemLog(env, {
    scope:'site-update', level:'error', event:'auto-recovery-started',
    message:`Автовосстановление к ${targetSha.slice(0,7)}`,
    details:{
      failedOperationId:failedState.operationId,
      recoveryOperationId,
      recoveryCommit:recoveryCommit.sha,
      targetSha,
      backupTag:failedState.backupTag || '',
      failedBackup:failedBackup.tag
    }
  }).catch(() => {});
  await sendOwnerPush(env, {
    title:'ANDRIK Control — автозащита',
    message:`Критическая ошибка после Deploy. Возвращаем последнюю подтверждённую версию ${targetSha.slice(0,7)}.`,
    url:'https://control.andrikmetal.com/site-update-admin.html'
  }).catch(() => {});
  return {
    recoveryOperationId,
    recoveryCommit:recoveryCommit.sha,
    recoveryCommitShort:recoveryCommit.sha.slice(0,7),
    targetSha,
    targetShort:targetSha.slice(0,7),
    failedBackup:failedBackup.tag
  };
}

function siteUpdateHistoryPointLabel(item) {
  if (item.release) return item.release;
  if (item.kind === 'backup') return `Backup ${item.short || ''}`.trim();
  return cleanPlainText(item.message || item.short || 'Версия', 120);
}

function siteUpdateReleaseMeta(raw) {
  const match = cleanPlainText(raw || '', 80).toUpperCase().match(/R\d{1,6}/);
  if (!match) throw new Error('release-invalid');
  const release = match[0];
  return {
    release,
    tag:`v55.00-final-stable-${release.toLowerCase()}`,
    title:`v55.00 FINAL STABLE ${release} — ONE BUTTON UPDATE`
  };
}

function siteUpdateTimestamp() {
  return new Date().toISOString().replace(/[-:TZ.]/g, '').slice(0, 14);
}

async function siteUpdateCreateBackup(config, snapshot, label = '') {
  const owner = encodeURIComponent(config.owner), repo = encodeURIComponent(config.repo);
  const safeLabel = cleanPlainText(label || '', 30).toLowerCase().replace(/[^a-z0-9-]+/g, '-').replace(/^-+|-+$/g, '');
  const random = crypto.randomUUID().replace(/-/g, '').slice(0, 5);
  const tag = `control-backup-${siteUpdateTimestamp()}-${snapshot.headSha.slice(0,7)}${safeLabel ? `-${safeLabel}` : ''}-${random}`;
  await siteUpdateGithubRequest(config, `/repos/${owner}/${repo}/git/refs`, {
    method:'POST', body:{ ref:`refs/tags/${tag}`, sha:snapshot.headSha }
  });
  return { tag, sha:snapshot.headSha, short:snapshot.headSha.slice(0,7), url:`https://github.com/${config.owner}/${config.repo}/tree/${encodeURIComponent(tag)}` };
}

async function siteUpdateGetRelease(config, tag) {
  const owner = encodeURIComponent(config.owner), repo = encodeURIComponent(config.repo);
  try { return await siteUpdateGithubRequest(config, `/repos/${owner}/${repo}/releases/tags/${encodeURIComponent(tag)}`); }
  catch (error) { if (error?.status === 404) return null; throw error; }
}

function siteUpdateFriendlyError(error) {
  const value = String(error?.message || error || 'unknown');
  const map = {
    'github-token-missing':'В Cloudflare не добавлен секрет GITHUB_SITE_TOKEN.',
    'github-timeout':'GitHub не ответил за отведённое время. Повторите проверку через кнопку «Состояние».',
    'zip-size':'ZIP слишком большой или повреждён.',
    'zip-eocd':'Файл не распознан как ZIP.',
    'zip-multidisk':'Многотомные ZIP не поддерживаются.',
    'zip-directory':'Некорректный каталог ZIP.',
    'zip64-not-supported':'ZIP64 не поддерживается. Создайте обычный ZIP.',
    'zip-symlink':'Символические ссылки в архиве запрещены.',
    'zip-encrypted':'Архив с паролем не поддерживается.',
    'zip-compression':'Архив использует неподдерживаемое сжатие.',
    'zip-uncompressed-size':'После распаковки архив слишком большой.',
    'zip-empty':'В архиве нет файлов.',
    'release-invalid':'Название версии должно содержать R и номер, например R104.',
    'branch-changed':'Ветка изменилась после проверки. Обновите состояние и проверьте ZIP повторно.',
    'deploy-marker-mismatch':'На сайте уже опубликована другая операция. Автооткат остановлен безопасно.',
    'recovery-backup-missing':'Для этой операции не найден предшествующий backup. Используйте историю версий.'
  };
  if (map[value]) return map[value];
  if (value.startsWith('required-files:')) return `В архиве отсутствуют обязательные файлы: ${value.split(':').slice(1).join(':')}`;
  if (value.startsWith('forbidden-file:')) return `В архиве найден запрещённый секретный файл: ${value.split(':').slice(1).join(':')}`;
  if (value.startsWith('github-401') || value.startsWith('github-403')) return 'GitHub отклонил токен. Проверьте доступ к обоим репозиториям и право Contents: Read and write.';
  if (value.startsWith('github-404')) return 'GitHub не нашёл репозиторий. Проверьте owner/repo и доступ токена.';
  if (value.startsWith('github-422')) return 'GitHub отклонил операцию: тег уже существует или ветка изменилась. Обновите состояние и повторите.';
  if (value.startsWith('github-429') || value.startsWith('github-500') || value.startsWith('github-502') || value.startsWith('github-503') || value.startsWith('github-504')) return 'GitHub временно недоступен. Установщик выполнил безопасные повторные попытки; повторите установку тем же ZIP.';
  return cleanPlainText(value, 500);
}

async function siteUpdateReadArchiveForm(request) {
  const length = Number(request.headers.get('content-length') || 0);
  if (length > SITE_UPDATE_MAX_ZIP_BYTES + 1024 * 1024) throw new Error('zip-size');
  const form = await request.formData();
  const archive = form.get('archive');
  if (!archive || typeof archive.arrayBuffer !== 'function') throw new Error('archive-required');
  if (Number(archive.size || 0) > SITE_UPDATE_MAX_ZIP_BYTES) throw new Error('zip-size');
  return { archive, form };
}

async function handleSiteUpdateStatus(request, env) {
  if (!adminAuthorized(request, env)) return json({ ok:false, error:'unauthorized' }, 401);
  const config = siteUpdateConfig(env);
  const releaseConfig = siteUpdateReleaseConfig(env, config);
  const base = {
    ok:true, version:SITE_UPDATE_VERSION, configured:Boolean(config.token) && siteUpdateConfigValid(config),
    owner:config.owner, repo:config.repo, branch:config.branch,
    repoUrl:`https://github.com/${config.owner}/${config.repo}`,
    releaseEnabled:releaseConfig.enabled,
    releaseRepository:`${releaseConfig.owner}/${releaseConfig.repo}`,
    releaseRepoUrl:`https://github.com/${releaseConfig.owner}/${releaseConfig.repo}`,
    secretName:'GITHUB_SITE_TOKEN', autoRecoverySupported:true
  };
  if (!base.configured) return json({ ...base, connected:false, message:'Добавьте GITHUB_SITE_TOKEN в Cloudflare.' });
  try {
    const snapshot = await siteUpdateGithubSnapshot(config);
    return json({ ...base, connected:true, headSha:snapshot.headSha, headShort:snapshot.headSha.slice(0,7),
      headMessage:cleanPlainText(snapshot.commit?.message || '', 240) });
  } catch (error) {
    return json({ ...base, connected:false, error:'github', message:siteUpdateFriendlyError(error) }, 502);
  }
}

async function handleSiteUpdatePreview(request, env) {
  if (!adminAuthorized(request, env)) return json({ ok:false, error:'unauthorized' }, 401);
  if (!isSameOrigin(request)) return json({ ok:false, error:'origin' }, 403);
  try {
    const config = siteUpdateConfig(env);
    if (!config.token || !siteUpdateConfigValid(config)) throw new Error('github-token-missing');
    const { archive } = await siteUpdateReadArchiveForm(request);
    const parsed = await siteUpdatePrepareArchive(archive);
    const snapshot = await siteUpdateGithubSnapshot(config);
    const diff = siteUpdateCompare(parsed, snapshot, config);
    return json({
      ok:true, version:SITE_UPDATE_VERSION, archiveName:cleanPlainText(archive.name || 'site.zip', 180),
      zipBytes:parsed.zipBytes, totalBytes:parsed.totalBytes, fileCount:parsed.entries.length,
      added:diff.added.length, changed:diff.changed.length, deleted:diff.deleted.length, unchanged:diff.unchanged.length,
      hasChanges:Boolean(diff.added.length || diff.changed.length || diff.deleted.length),
      sameAsMain:!Boolean(diff.added.length || diff.changed.length || diff.deleted.length),
      canReinstall:true,
      paths:{ added:diff.added.slice(0,100), changed:diff.changed.slice(0,100), deleted:diff.deleted.slice(0,100) },
      headSha:snapshot.headSha, headShort:snapshot.headSha.slice(0,7),
      repository:`${config.owner}/${config.repo}`, branch:config.branch
    });
  } catch (error) {
    return json({ ok:false, error:'preview-failed', message:siteUpdateFriendlyError(error) }, 400);
  }
}

async function handleSiteUpdateBackup(request, env) {
  if (!adminAuthorized(request, env)) return json({ ok:false, error:'unauthorized' }, 401);
  if (!isSameOrigin(request)) return json({ ok:false, error:'origin' }, 403);
  try {
    const config = siteUpdateConfig(env);
    if (!config.token || !siteUpdateConfigValid(config)) throw new Error('github-token-missing');
    const body = await readJsonBody(request, 5000).catch(() => ({}));
    const snapshot = await siteUpdateGithubSnapshot(config);
    const backup = await siteUpdateCreateBackup(config, snapshot, body.label || 'manual');
    await recordSystemLog(env, { scope:'site-update', level:'info', event:'backup-created',
      message:`Backup ${backup.tag}`, details:{ tag:backup.tag, sha:backup.sha, url:backup.url, manual:Boolean(body.manual) }
    }).catch(() => {});
    return json({ ok:true, ...backup, message:`Резервная метка создана: ${backup.tag}` });
  } catch (error) {
    return json({ ok:false, error:'backup-failed', message:siteUpdateFriendlyError(error) }, 400);
  }
}


async function handleSiteUpdateBackupZip(request, env) {
  if (!adminAuthorized(request, env)) return json({ ok:false, error:'unauthorized' }, 401);
  if (!isSameOrigin(request)) return json({ ok:false, error:'origin' }, 403);
  const config = siteUpdateConfig(env);
  if (!config.token || !siteUpdateConfigValid(config)) return json({ ok:false, error:'github-token-missing', message:'GitHub не настроен.' }, 400);
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 120000);
  try {
    let head = null;
    try { head = await siteUpdateGithubHead(config); } catch (_) {}
    const ref = head?.headSha || config.branch || 'main';
    const owner = encodeURIComponent(config.owner), repo = encodeURIComponent(config.repo), encodedRef = encodeURIComponent(ref);
    const headers = {accept:'application/vnd.github+json',authorization:`Bearer ${config.token}`,'user-agent':'ANDRIK-Control-ZIP-Backup-R247','x-github-api-version':'2022-11-28'};
    const attempts = [
      [`https://api.github.com/repos/${owner}/${repo}/zipball/${encodedRef}`, headers],
      [`https://codeload.github.com/${owner}/${repo}/zip/${encodedRef}`, {authorization:`Bearer ${config.token}`,'user-agent':'ANDRIK-Control-ZIP-Backup-R247'}],
      [`https://codeload.github.com/${owner}/${repo}/zip/refs/heads/${encodeURIComponent(config.branch || 'main')}`, {authorization:`Bearer ${config.token}`,'user-agent':'ANDRIK-Control-ZIP-Backup-R247'}]
    ];
    let archiveResponse = null;
    let lastStatus = 0;
    for (const [url, attemptHeaders] of attempts) {
      try {
        const response = await fetch(url,{signal:controller.signal,redirect:'follow',headers:attemptHeaders});
        lastStatus = response.status;
        if (response.ok) { archiveResponse = response; break; }
      } catch (error) {
        if (error?.name === 'AbortError') throw error;
      }
    }
    if (!archiveResponse) throw new Error(`github-${lastStatus || 502}:backup-download-failed`);
    const archiveBytes = await archiveResponse.arrayBuffer();
    if (archiveBytes.byteLength < 1000) throw new Error('backup-archive-empty');
    if (archiveBytes.byteLength > SITE_UPDATE_MAX_ZIP_BYTES) throw new Error('zip-size');
    const sha = head?.headSha || ref;
    const msg = cleanPlainText(head?.commit?.message || '', 240);
    const release = (msg.toUpperCase().match(/R\d{1,6}/) || ['R247'])[0];
    const short = /^[0-9a-f]{7,40}$/i.test(sha) ? sha.slice(0,7) : 'current';
    const filename = `ANDRIK-BACKUP-${release}-${new Date().toISOString().slice(0,10)}-${short}.zip`;
    await recordSystemLog(env,{scope:'site-update',level:'info',event:'backup-zip-created',message:`ZIP backup ${filename}`,details:{commitSha:sha,filename,bytes:archiveBytes.byteLength}}).catch(()=>{});
    return new Response(archiveBytes,{status:200,headers:{'content-type':'application/zip','content-length':String(archiveBytes.byteLength),'content-disposition':`attachment; filename="${filename}"`,'cache-control':'private, no-store, max-age=0','x-content-type-options':'nosniff','x-andrik-backup-commit':sha}});
  } catch(error) {
    if(error?.name==='AbortError'||String(error?.message||'').includes('github-timeout')) return json({ok:false,error:'backup-zip-timeout',message:'GitHub не отдал архив за 120 секунд. Нажмите «Повторить ZIP-бэкап».'},504);
    return json({ok:false,error:'backup-zip-failed',message:siteUpdateFriendlyError(error)},502);
  } finally { clearTimeout(timer); }
}

async function handleSiteUpdatePublish(request, env) {
  if (!adminAuthorized(request, env)) return json({ ok:false, error:'unauthorized' }, 401);
  if (!isSameOrigin(request)) return json({ ok:false, error:'origin' }, 403);
  const startedAt = Date.now();
  try {
    const config = siteUpdateConfig(env);
    if (!config.token || !siteUpdateConfigValid(config)) throw new Error('github-token-missing');
    const { archive, form } = await siteUpdateReadArchiveForm(request);
    if (String(form.get('confirm') || '') !== 'yes') return json({ ok:false, error:'confirmation-required' }, 400);
    const message = cleanPlainText(form.get('message') || `ANDRIK Control site update ${new Date().toISOString()}`, 240);
    const release = cleanPlainText(form.get('release') || '', 80);
    const expectedHead = cleanPlainText(form.get('expectedHead') || '', 64);
    const backupShaRaw = cleanPlainText(form.get('backupSha') || '', 64);
    const backupSha = /^[0-9a-f]{40}$/i.test(backupShaRaw) ? backupShaRaw : '';
    const backupTag = cleanPlainText(form.get('backupTag') || '', 180);
    const autoRecovery = String(form.get('autoRecovery') || '') === 'yes';
    const forceReinstall = String(form.get('forceReinstall') || '') === 'yes';
    const parsed = await siteUpdatePrepareArchive(archive);
    const snapshot = await siteUpdateGithubSnapshot(config);
    if (expectedHead && /^[0-9a-f]{40}$/i.test(expectedHead) && snapshot.headSha !== expectedHead) throw new Error('branch-changed');
    const diff = siteUpdateCompare(parsed, snapshot, config);
    const touched = [...diff.added, ...diff.changed];
    const noFileChanges = !touched.length && !diff.deleted.length;
    if (noFileChanges && !forceReinstall) return json({ ok:true, noChanges:true, headSha:snapshot.headSha, message:'Изменений нет.' });
    const reinstall = noFileChanges && forceReinstall;
    const operationId = siteUpdateNewOperationId(reinstall ? 'reinstall' : 'publish');
    const owner = encodeURIComponent(config.owner), repo = encodeURIComponent(config.repo);

    // R119: текстовые файлы передаются прямо в Git Tree API.
    // Это заменяет десятки отдельных blob-запросов одним или несколькими пакетами
    // и не упирается в лимит внешних запросов Cloudflare Worker.
    const inlineEntries = [];
    const binaryEntries = [];
    for (const path of touched) {
      const entry = diff.archive.get(path);
      const content = siteUpdateInlineText(entry);
      const base = {
        path,
        mode:snapshot.files.get(path)?.mode || '100644',
        type:'blob'
      };
      if (content !== null) inlineEntries.push({ ...base, content });
      else binaryEntries.push({ entry, base });
    }

    const createdBinary = await siteUpdateMapLimit(binaryEntries, 2, async item => {
      const data = await siteUpdateGithubRequest(config, `/repos/${owner}/${repo}/git/blobs`, {
        method:'POST',
        timeoutMs:60000,
        body:{ content:siteUpdateBase64(item.entry.bytes), encoding:'base64' }
      });
      return { ...item.base, sha:data.sha };
    });

    const state = {
      schema:1,
      updaterVersion:SITE_UPDATE_VERSION,
      operation:reinstall ? 'reinstall' : 'publish',
      reinstall,
      operationId,
      release,
      archiveName:cleanPlainText(archive.name || 'site.zip', 180),
      sourceHead:snapshot.headSha,
      backupSha,
      backupTag,
      autoRecovery,
      generatedAt:new Date().toISOString()
    };

    const treeEntries = [...inlineEntries, ...createdBinary];
    for (const path of diff.deleted) {
      treeEntries.push({
        path,
        mode:snapshot.files.get(path)?.mode || '100644',
        type:'blob',
        sha:null
      });
    }
    treeEntries.push({
      path:'site-update-state.json',
      mode:'100644',
      type:'blob',
      content:`${JSON.stringify(state, null, 2)}\n`
    });

    const tree = await siteUpdateCreateTreeBatched(
      config, owner, repo, snapshot.treeSha, treeEntries
    );
    const effectiveMessage = reinstall ? `${message} · повторная установка той же версии` : message;
    const commitMessage = release ? `${effectiveMessage}\n\nRelease: ${release}` : effectiveMessage;
    const commit = await siteUpdateGithubRequest(config, `/repos/${owner}/${repo}/git/commits`, {
      method:'POST', body:{ message:commitMessage, tree:tree.sha, parents:[snapshot.headSha],
        author:{ name:'ANDRIK Control', email:'andrik-control@users.noreply.github.com' } }
    });
    const branchRef = config.branch.split('/').map(encodeURIComponent).join('/');
    await siteUpdateGithubRequest(config, `/repos/${owner}/${repo}/git/refs/heads/${branchRef}`, {
      method:'PATCH', body:{ sha:commit.sha, force:false }
    });
    await recordSystemLog(env, { scope:'site-update', level:'info', event:reinstall ? 'github-reinstall' : 'github-publish',
      message:reinstall ? `Повторная установка ${release || 'версии'}: ${commit.sha.slice(0,7)}` : `Сайт отправлен в GitHub: ${commit.sha.slice(0,7)}`,
      details:{ repository:`${config.owner}/${config.repo}`, branch:config.branch, release, reinstall, commitSha:commit.sha,
        added:diff.added.length, changed:diff.changed.length, deleted:diff.deleted.length,
        archive:archive.name, archiveBytes:Number(archive.size || 0), operationId, backupSha, backupTag, autoRecovery, inlineFiles:inlineEntries.length, binaryFiles:binaryEntries.length, treeBatches:tree.batches, durationMs:Date.now()-startedAt }
    }).catch(() => {});
    await sendOwnerPush(env, { title:'ANDRIK Control', message:reinstall ? `Повторная установка ${release || 'версии'} отправлена: ${commit.sha.slice(0,7)}` : `Обновление сайта отправлено в GitHub: ${commit.sha.slice(0,7)}`, url:'https://control.andrikmetal.com/site-update-admin.html' }).catch(() => {});
    siteUpdateHistoryCache = null;
    return json({ ok:true, operationId, backupSha, backupTag, autoRecovery, reinstall, commitSha:commit.sha, commitShort:commit.sha.slice(0,7),
      commitUrl:`https://github.com/${config.owner}/${config.repo}/commit/${commit.sha}`,
      repository:`${config.owner}/${config.repo}`, branch:config.branch,
      added:diff.added.length, changed:diff.changed.length, deleted:diff.deleted.length,
      durationMs:Date.now()-startedAt, message:reinstall ? 'GitHub принял повторную установку. Проверяем Release и Cloudflare.' : 'GitHub принял обновление. Проверяем Release и Cloudflare.'
    });
  } catch (error) {
    await recordSystemLog(env, { scope:'site-update', level:'error', event:'github-publish-failed',
      message:siteUpdateFriendlyError(error), details:{ raw:cleanPlainText(error?.message || error, 500) }
    }).catch(() => {});
    const transient = [429,500,502,503,504].includes(Number(error?.status || 0)) || String(error?.message || '') === 'github-timeout';
    const status = transient ? 503 : (error?.status === 422 || String(error?.message || '') === 'branch-changed' ? 409 : 400);
    return json({ ok:false, error:'publish-failed', retryable:transient, message:siteUpdateFriendlyError(error) }, status);
  }
}

async function handleSiteUpdateRelease(request, env) {
  if (!adminAuthorized(request, env)) return json({ ok:false, error:'unauthorized' }, 401);
  if (!isSameOrigin(request)) return json({ ok:false, error:'origin' }, 403);
  try {
    const siteConfig = siteUpdateConfig(env);
    const config = siteUpdateReleaseConfig(env, siteConfig);
    if (!config.enabled) return json({ ok:true, skipped:true, message:'Автоматический Release выключен.' });
    if (!config.token || !siteUpdateConfigValid(config)) throw new Error('github-token-missing');
    const { archive, form } = await siteUpdateReadArchiveForm(request);
    const bytes = await archive.arrayBuffer();
    const parsed = await siteUpdateReadZip(bytes);
    const meta = siteUpdateReleaseMeta(form.get('release') || '');
    const commitSha = cleanPlainText(form.get('commitSha') || '', 64);
    const added = Math.max(0, Number(form.get('added') || 0));
    const changed = Math.max(0, Number(form.get('changed') || 0));
    const deleted = Math.max(0, Number(form.get('deleted') || 0));
    const owner = encodeURIComponent(config.owner), repo = encodeURIComponent(config.repo);
    const notes = [
      `Official stable release of ANDRIK Control.`, '',
      `Version: ${meta.release} — AUTO RECOVERY`, '',
      `Changes: +${added} added · ~${changed} changed · −${deleted} deleted`,
      `Files: ${parsed.entries.length} · ZIP: ${Math.round(parsed.zipBytes/1024)} KB`,
      commitSha ? `Site commit: ${commitSha.slice(0,7)}` : '', '',
      `Choose a full ZIP and publish with one button. Includes automatic validation, backup, commit, GitHub Release with ZIP, exact Cloudflare deployment marker, release history, safe rollback, post-deploy health verification and automatic self-recovery.`
    ].filter(Boolean).join('\n');
    let release = await siteUpdateGetRelease(config, meta.tag);
    if (release) {
      release = await siteUpdateGithubRequest(config, `/repos/${owner}/${repo}/releases/${release.id}`, {
        method:'PATCH', body:{ name:meta.title, body:notes, draft:false, prerelease:false, make_latest:'true' }
      });
    } else {
      release = await siteUpdateGithubRequest(config, `/repos/${owner}/${repo}/releases`, {
        method:'POST', body:{ tag_name:meta.tag, target_commitish:config.branch, name:meta.title, body:notes,
          draft:false, prerelease:false, make_latest:'true' }
      });
    }
    const assetName = String(archive.name || `ANDRIK-Control-v55.00-FINAL-STABLE-${meta.release}.zip`).split('/').pop();
    const assets = await siteUpdateGithubRequest(config, `/repos/${owner}/${repo}/releases/${release.id}/assets?per_page=100`);
    for (const item of assets || []) {
      if (String(item.name || '') === assetName) await siteUpdateGithubRequest(config, `/repos/${owner}/${repo}/releases/assets/${item.id}`, { method:'DELETE' });
    }
    const asset = await siteUpdateGithubUploadAsset(config, release.id, assetName, bytes);
    await recordSystemLog(env, { scope:'site-update', level:'info', event:'release-created',
      message:`Release ${meta.release} опубликован`, details:{ release:meta.release, tag:meta.tag, url:release.html_url, asset:asset.name, assetBytes:asset.size, repository:`${config.owner}/${config.repo}` }
    }).catch(() => {});
    return json({ ok:true, release:meta.release, tag:meta.tag, title:meta.title,
      releaseUrl:release.html_url || `https://github.com/${config.owner}/${config.repo}/releases/tag/${meta.tag}`,
      assetUrl:asset.browser_download_url || '', assetName:asset.name || assetName,
      repository:`${config.owner}/${config.repo}`, message:`Release ${meta.release} и ZIP опубликованы.` });
  } catch (error) {
    await recordSystemLog(env, { scope:'site-update', level:'warning', event:'release-failed',
      message:siteUpdateFriendlyError(error), details:{ raw:cleanPlainText(error?.message || error, 500) }
    }).catch(() => {});
    return json({ ok:false, error:'release-failed', message:siteUpdateFriendlyError(error) }, 400);
  }
}

async function handleSiteUpdateDeployment(request, env) {
  if (!adminAuthorized(request, env)) return json({ ok:false, error:'unauthorized' }, 401);
  const url = new URL(request.url);
  const operationId = cleanPlainText(url.searchParams.get('operationId') || '', 120);
  const releaseRaw = cleanPlainText(url.searchParams.get('release') || '', 80);
  let stateStatus = 0, state = null, markerMatched = false;
  try {
    const stateUrl = new URL('/site-update-state.json', request.url);
    stateUrl.searchParams.set('deploy_probe', String(Date.now()));
    const response = await fetch(stateUrl.toString(), {
      method:'GET', cache:'no-store',
      headers:{ accept:'application/json', 'cache-control':'no-cache', 'user-agent':'ANDRIK-Control-R115-Deploy-Check' }
    });
    stateStatus = response.status;
    if (response.ok) state = await response.json().catch(() => null);
    else { try { await response.body?.cancel(); } catch (_) {} }
    markerMatched = Boolean(operationId && state && state.operationId === operationId);
  } catch (_) {}

  if (operationId) {
    return json({
      ok:true, deployed:markerMatched, operationId, stateStatus,
      deployedOperationId:cleanPlainText(state?.operationId || '', 120),
      deployedRelease:cleanPlainText(state?.release || '', 80),
      checkedAt:new Date().toISOString(),
      message:markerMatched
        ? `Cloudflare опубликовал точную операцию ${operationId.split('-').slice(0,2).join('-')}.`
        : `GitHub готов. Cloudflare ещё не опубликовал точный маркер операции.`
    });
  }

  let meta;
  try { meta = siteUpdateReleaseMeta(releaseRaw); }
  catch (error) { return json({ ok:false, error:'release-invalid', message:siteUpdateFriendlyError(error) }, 400); }
  const probePath = `/cache-reset-v55-00-final-${meta.release.toLowerCase()}.html`;
  const probeUrl = new URL(probePath, request.url);
  probeUrl.searchParams.set('deploy_probe', String(Date.now()));
  let controlStatus = 0, controlOk = false;
  try {
    const response = await fetch(probeUrl.toString(), {
      method:'GET', cache:'no-store',
      headers:{ accept:'text/html', 'cache-control':'no-cache', 'user-agent':'ANDRIK-Control-R115-Deploy-Check' }
    });
    controlStatus = response.status; controlOk = response.ok;
    try { await response.body?.cancel(); } catch (_) {}
  } catch (_) {}
  return json({
    ok:true, release:meta.release, deployed:controlOk, controlOk, controlStatus,
    probePath, checkedAt:new Date().toISOString(),
    message:controlOk ? `${meta.release} найдена на Control.` : `${meta.release} ещё не найдена на Control.`
  });
}

async function handleSiteUpdateFinalize(request, env) {
  if (!adminAuthorized(request, env)) return json({ ok:false, error:'unauthorized' }, 401);
  if (!isSameOrigin(request)) return json({ ok:false, error:'origin' }, 403);
  try {
    const body = await readJsonBody(request, 12000).catch(() => ({}));
    const operationId = cleanPlainText(body.operationId || '', 120);
    const autoRecovery = Boolean(body.autoRecovery);
    const manual = Boolean(body.manual);
    const deployed = await siteUpdateReadDeployedState(request);

    if (operationId && deployed.state?.operationId !== operationId) {
      return json({
        ok:false, error:'deploy-marker-mismatch',
        message:'Точная операция ещё не опубликована или уже заменена другой версией.',
        deployedOperationId:cleanPlainText(deployed.state?.operationId || '', 120)
      }, 409);
    }

    const verified = await siteUpdateConfirmedHealth(env);
    const health = verified.health;
    const level = health.status === 'ok' ? 'info' : health.status === 'degraded' ? 'warning' : 'error';
    const event = health.status === 'ok' ? 'health-ok' : health.status === 'degraded' ? 'health-degraded' : 'health-down';
    await recordSystemLog(env, {
      scope:'site-update', level, event,
      message:`Post-deploy health: ${health.status}`,
      details:{
        operationId:operationId || deployed.state?.operationId || '',
        manual, attempts:verified.attempts.length,
        checks:health.checks
      }
    }).catch(() => {});

    if (health.status !== 'down') {
      let knownGood = null;
      let guard = { configured:Boolean(String(env.GUARD_URL || '').trim()), ok:false };
      if (health.status === 'ok') {
        const config = siteUpdateConfig(env);
        if (config.token && siteUpdateConfigValid(config)) {
          const snapshot = await siteUpdateGithubSnapshot(config);
          knownGood = await siteUpdateSaveKnownGood(env, {
            commitSha:snapshot.headSha,
            operationId:operationId || deployed.state?.operationId || '',
            release:cleanPlainText(deployed.state?.release || body.release || '', 80),
            health
          }).catch(() => null);
          await recordSystemLog(env, {
            scope:'site-update', level:'info', event:'last-known-good-confirmed',
            message:`Подтверждена исправная версия ${snapshot.headSha.slice(0,7)}`,
            details:{ commitSha:snapshot.headSha, operationId, release:deployed.state?.release || '' }
          }).catch(() => {});
          guard = await siteUpdateGuardRequest(env, '/mark-good', {
            operationId:operationId || deployed.state?.operationId || '',
            release:deployed.state?.release || body.release || '',
            commitSha:snapshot.headSha,
            reason:'control-post-deploy-health-ok'
          }, 45000).catch(() => guard);
        }
      }
      return json({
        ok:true, healthy:health.status === 'ok', degraded:health.status === 'degraded',
        recoveryStarted:false, health, knownGood, guard,
        operationId:operationId || deployed.state?.operationId || '',
        message:health.status === 'ok'
          ? 'Система исправна. Версия сохранена как последняя подтверждённая.'
          : 'Сайт работает, но есть некритические предупреждения; маркер исправной версии не изменён.'
      });
    }

    const failedState = deployed.state || null;
    if (!autoRecovery || !operationId || !failedState?.autoRecovery) {
      return json({
        ok:true, healthy:false, recoveryStarted:false, health,
        operationId,
        message:autoRecovery
          ? 'Критическая ошибка подтверждена, но операция не разрешила автоматическое восстановление.'
          : 'Критическая ошибка подтверждена. Автовосстановление выключено.'
      });
    }

    // Сначала независимый Guard: он работает даже тогда, когда Control уже не отвечает.
    const guardRecovery = await siteUpdateGuardRequest(env, '/run', {
      reason:'post-deploy-health-down',
      operationId,
      release:failedState.release || ''
    }, 125000).catch(() => ({ configured:false, ok:false }));

    if (guardRecovery.configured && (
      guardRecovery.action === 'rollback-ok' ||
      guardRecovery.action === 'rollback-unconfirmed' ||
      guardRecovery.action === 'cooldown'
    )) {
      return json({
        ok:true, healthy:false, recoveryStarted:true, health,
        operationId, guardRecovery,
        message:guardRecovery.message || 'Независимый Guard запустил восстановление.'
      });
    }

    // Резервный путь: только подтверждённый LAST KNOWN GOOD из D1.
    const knownGood = await siteUpdateGetKnownGood(env);
    if (!knownGood?.commitSha) {
      return json({
        ok:true, healthy:false, recoveryStarted:false, health,
        operationId, guardRecovery,
        message:'Сбой подтверждён, но подтверждённая исправная версия ещё не сохранена.'
      });
    }

    const config = siteUpdateConfig(env);
    if (!config.token || !siteUpdateConfigValid(config)) throw new Error('github-token-missing');
    const recovery = await siteUpdateStartAutomaticRecovery(config, env, {
      ...failedState,
      backupSha:knownGood.commitSha,
      backupTag:`last-known-good:${knownGood.verifiedAt || ''}`
    });
    return json({
      ok:true, healthy:false, recoveryStarted:!recovery.alreadyRecovered,
      health, release:cleanPlainText(failedState.release || '', 80),
      backupTag:`LAST KNOWN GOOD ${knownGood.commitSha.slice(0,7)}`,
      knownGood, guardRecovery, ...recovery,
      message:recovery.alreadyRecovered
        ? 'Последняя подтверждённая версия уже восстановлена.'
        : 'Guard недоступен. Запущен резервный откат к последней подтверждённой версии.'
    });
  } catch (error) {
    return json({ ok:false, error:'finalize-failed', message:siteUpdateFriendlyError(error) }, 400);
  }
}

async function handleSiteUpdateLog(request, env) {
  if (!adminAuthorized(request, env)) return json({ ok:false, error:'unauthorized' }, 401);
  if (!env.COMMENTS_DB) return json({ ok:true, entries:[], message:'D1 недоступна.' });
  try {
    await ensurePushAutomationSchema(env.COMMENTS_DB);
    const rows = await env.COMMENTS_DB.prepare(`
      SELECT level, event, message, details_json AS detailsJson, created_at AS createdAt
      FROM system_logs WHERE scope='site-update'
      ORDER BY datetime(created_at) DESC LIMIT 24
    `).all();
    const entries = (rows.results || []).map(row => {
      let details = {};
      try { details = JSON.parse(row.detailsJson || '{}'); } catch (_) {}
      return { level:row.level || 'info', event:row.event || '', message:row.message || '', details, createdAt:row.createdAt || '' };
    });
    return json({ ok:true, entries });
  } catch (error) {
    return json({ ok:false, error:'log-failed', message:siteUpdateFriendlyError(error) }, 400);
  }
}

async function handleSiteUpdateHistory(request, env) {
  if (!adminAuthorized(request, env)) return json({ ok:false, error:'unauthorized' }, 401);
  try {
    const config = siteUpdateConfig(env);
    const releaseConfig = siteUpdateReleaseConfig(env, config);
    if (!config.token || !siteUpdateConfigValid(config)) throw new Error('github-token-missing');
    const cacheKey = `${config.owner}/${config.repo}/${config.branch}`;
    if (siteUpdateHistoryCache && siteUpdateHistoryCache.key === cacheKey && siteUpdateHistoryCache.expiresAt > Date.now()) {
      return json(siteUpdateHistoryCache.value);
    }

    const owner = encodeURIComponent(config.owner), repo = encodeURIComponent(config.repo);
    const sameReleaseRepo = releaseConfig.owner === config.owner && releaseConfig.repo === config.repo;
    const [commitsRaw, tagsRaw, releasesRaw] = await Promise.all([
      siteUpdateGithubRequest(config, `/repos/${owner}/${repo}/commits?sha=${encodeURIComponent(config.branch)}&per_page=30`),
      siteUpdateGithubRequest(config, `/repos/${owner}/${repo}/tags?per_page=100`),
      sameReleaseRepo
        ? siteUpdateGithubRequest(config, `/repos/${owner}/${repo}/releases?per_page=12`)
        : Promise.resolve([])
    ]);

    const commits = (commitsRaw || []).map(item => ({
      sha:item.sha, short:item.sha.slice(0,7),
      message:cleanPlainText(item.commit?.message?.split('\n')[0] || '', 240),
      fullMessage:cleanPlainText(item.commit?.message || '', 500),
      date:item.commit?.author?.date || item.commit?.committer?.date || '',
      author:cleanPlainText(item.commit?.author?.name || item.author?.login || '', 120),
      url:item.html_url || `https://github.com/${config.owner}/${config.repo}/commit/${item.sha}`
    }));
    const current = commits[0] || null;

    const releaseCandidates = (releasesRaw || []).filter(item => !item.draft).slice(0, 8);
    const releasePoints = await siteUpdateMapLimit(releaseCandidates, 4, async item => {
      try {
        const commit = await siteUpdateGithubRequest(config, `/repos/${owner}/${repo}/commits/${encodeURIComponent(item.tag_name)}`);
        const release = siteUpdateReleaseFromText(item.name || item.tag_name);
        return {
          kind:'release', sha:commit.sha, short:commit.sha.slice(0,7),
          label:release || cleanPlainText(item.name || item.tag_name, 120),
          release, message:cleanPlainText(item.name || item.tag_name, 180),
          date:item.published_at || item.created_at || commit.commit?.author?.date || '',
          url:commit.html_url || `https://github.com/${config.owner}/${config.repo}/commit/${commit.sha}`,
          releaseUrl:item.html_url || ''
        };
      } catch (_) { return null; }
    });

    const backupTags = (tagsRaw || []).filter(item => String(item.name || '').startsWith('control-backup-')).slice(0, 7);
    const backupPoints = await siteUpdateMapLimit(backupTags, 4, async item => {
      try {
        const commit = await siteUpdateGithubRequest(config, `/repos/${owner}/${repo}/commits/${encodeURIComponent(item.commit?.sha || item.name)}`);
        return {
          kind:'backup', sha:commit.sha, short:commit.sha.slice(0,7),
          label:`Backup ${commit.sha.slice(0,7)}`, release:'',
          message:cleanPlainText(item.name, 180),
          date:commit.commit?.author?.date || commit.commit?.committer?.date || siteUpdateBackupDate(item.name),
          url:`https://github.com/${config.owner}/${config.repo}/tree/${encodeURIComponent(item.name)}`,
          releaseUrl:''
        };
      } catch (_) { return null; }
    });

    const stableCommitPoints = commits.filter(item => {
      const text = `${item.message}\n${item.fullMessage}`;
      return /\bR\d{1,6}\b/i.test(text) &&
        /(full release|final stable|update website|release:\s*R\d+)/i.test(text) &&
        !/(assets part|full sync\s*[—-]\s*(admin|en|sk|uk|push))/i.test(text);
    }).slice(0, 10).map(item => {
      const release = siteUpdateReleaseFromText(`${item.message} ${item.fullMessage}`);
      return {
        kind:'stable', ...item,
        label:release || item.message,
        release, releaseUrl:''
      };
    });

    const points = [];
    const seen = new Set();
    const pushPoint = point => {
      if (!point || !point.sha || seen.has(point.sha)) return;
      seen.add(point.sha);
      points.push(point);
    };
    if (current) pushPoint({
      kind:'stable', ...current, current:true,
      label:siteUpdateReleaseFromText(`${current.message} ${current.fullMessage}`) || 'Текущая версия',
      release:siteUpdateReleaseFromText(`${current.message} ${current.fullMessage}`),
      releaseUrl:''
    });
    [...releasePoints.filter(Boolean), ...backupPoints.filter(Boolean), ...stableCommitPoints]
      .sort((a,b) => new Date(b.date || 0) - new Date(a.date || 0))
      .forEach(pushPoint);

    const technicalCommits = commits.slice(0, 15).map(item => ({
      sha:item.sha, short:item.short, message:item.message, date:item.date, author:item.author, url:item.url
    }));

    const value = {
      ok:true, version:SITE_UPDATE_VERSION,
      repository:`${config.owner}/${config.repo}`, branch:config.branch,
      currentSha:current?.sha || '', currentShort:current?.short || '',
      restorePoints:points.slice(0, 18),
      technicalCommits
    };
    siteUpdateHistoryCache = { key:cacheKey, expiresAt:Date.now()+25000, value };
    return json(value);
  } catch (error) {
    return json({ ok:false, error:'history-failed', message:siteUpdateFriendlyError(error) }, 400);
  }
}

async function handleSiteUpdateRollback(request, env) {
  if (!adminAuthorized(request, env)) return json({ ok:false, error:'unauthorized' }, 401);
  if (!isSameOrigin(request)) return json({ ok:false, error:'origin' }, 403);
  try {
    const config = siteUpdateConfig(env);
    if (!config.token || !siteUpdateConfigValid(config)) throw new Error('github-token-missing');
    const body = await readJsonBody(request, 8000);
    const targetSha = cleanPlainText(body.targetSha || '', 64);
    const label = cleanPlainText(body.label || targetSha.slice(0,7), 120);
    const release = siteUpdateReleaseFromText(body.release || label);
    if (!/^[0-9a-f]{40}$/i.test(targetSha)) return json({ ok:false, error:'invalid-target' }, 400);

    const owner = encodeURIComponent(config.owner), repo = encodeURIComponent(config.repo);
    const snapshot = await siteUpdateGithubSnapshot(config);
    if (snapshot.headSha === targetSha) return json({ ok:true, noChanges:true, message:'Эта версия уже активна.' });

    const operationId = siteUpdateNewOperationId('rollback');
    const safetyBackup = await siteUpdateCreateBackup(config, snapshot, `before-${release || targetSha.slice(0,7)}`);
    const target = await siteUpdateGithubRequest(config, `/repos/${owner}/${repo}/git/commits/${targetSha}`);
    const marker = await siteUpdateCreateStateBlob(config, {
      operation:'rollback',
      operationId,
      release,
      targetSha,
      targetLabel:label,
      sourceHead:snapshot.headSha,
      safetyBackup:safetyBackup.tag
    });
    const rollbackTree = await siteUpdateGithubRequest(config, `/repos/${owner}/${repo}/git/trees`, {
      method:'POST',
      body:{
        base_tree:target.tree.sha,
        tree:[{ path:'site-update-state.json', mode:'100644', type:'blob', sha:marker.sha }]
      }
    });
    const rollback = await siteUpdateGithubRequest(config, `/repos/${owner}/${repo}/git/commits`, {
      method:'POST',
      body:{
        message:`Rollback via ANDRIK Control to ${label} (${targetSha.slice(0,7)})`,
        tree:rollbackTree.sha,
        parents:[snapshot.headSha],
        author:{ name:'ANDRIK Control', email:'andrik-control@users.noreply.github.com' }
      }
    });
    const branchRef = config.branch.split('/').map(encodeURIComponent).join('/');
    await siteUpdateGithubRequest(config, `/repos/${owner}/${repo}/git/refs/heads/${branchRef}`, {
      method:'PATCH', body:{ sha:rollback.sha, force:false }
    });
    siteUpdateHistoryCache = null;
    await recordSystemLog(env, {
      scope:'site-update', level:'warning', event:'github-rollback',
      message:`Откат к ${label}`,
      details:{
        operationId, rollbackCommit:rollback.sha, targetSha, targetLabel:label,
        release, backupTag:safetyBackup.tag
      }
    }).catch(() => {});
    await sendOwnerPush(env, {
      title:'ANDRIK Control',
      message:`Сайт откатывается к ${label}`,
      url:'https://control.andrikmetal.com/site-update-admin.html'
    }).catch(() => {});
    return json({
      ok:true, operationId, release, targetSha, targetLabel:label,
      commitSha:rollback.sha, commitShort:rollback.sha.slice(0,7),
      backupTag:safetyBackup.tag,
      commitUrl:`https://github.com/${config.owner}/${config.repo}/commit/${rollback.sha}`,
      message:`Откат записан новым commit. Перед ним создан backup ${safetyBackup.tag}.`
    });
  } catch (error) {
    return json({ ok:false, error:'rollback-failed', message:siteUpdateFriendlyError(error) }, 400);
  }
}
// === End R113 website updater ===



function getMusicBucketR314(env) { return env.MUSIC_BUCKET || env.ANDRIK_MUSIC || null; }
function musicFileNameR314(value) {
  const raw = String(value || '').trim().toLowerCase();
  const safe = raw.replace(/[^a-z0-9._-]+/g, '_').replace(/^_+|_+$/g, '').replace(/_+/g, '_');
  if (!safe || !safe.endsWith('.mp3') || safe.length > 160) return '';
  return safe;
}
function musicFolderR317(value){
  const folder=String(value||'singles').trim().toLowerCase().replace(/^\/+|\/+$/g,'');
  if(folder==='singles')return 'singles';
  if(/^albums\/[a-z0-9][a-z0-9_-]{0,63}$/.test(folder))return folder;
  return '';
}
function musicObjectKeyR317(value){
  const key=String(value||'').trim().replace(/^\/+/, '');
  if(!/^(?:singles|albums\/[a-z0-9][a-z0-9_-]{0,63})\/[a-z0-9._-]+\.mp3$/i.test(key))return '';
  return key;
}
function musicHeaderR317(request,name,max=220){
  let value=String(request.headers.get(name)||'');
  try{value=decodeURIComponent(value)}catch(_){}
  return cleanPlainText(value,max);
}

function musicTranslitR335(value){
  const map={'а':'a','б':'b','в':'v','г':'g','д':'d','е':'e','ё':'yo','ж':'zh','з':'z','и':'i','й':'y','к':'k','л':'l','м':'m','н':'n','о':'o','п':'p','р':'r','с':'s','т':'t','у':'u','ф':'f','х':'h','ц':'ts','ч':'ch','ш':'sh','щ':'sch','ъ':'','ы':'y','ь':'','э':'e','ю':'yu','я':'ya'};
  return [...String(value||'').toLowerCase()].map(ch=>map[ch]??ch).join('');
}
function musicTitleFileNameR335(title){
  const base=musicTranslitR335(title).normalize('NFKD').replace(/[\u0300-\u036f]/g,'')
    .replace(/[^a-z0-9._-]+/g,'_').replace(/^_+|_+$/g,'').replace(/_+/g,'_').slice(0,150);
  return base ? `${base}.mp3` : '';
}
async function handleMusicMp3PatchR335(request, env){
  if(!adminAuthorized(request,env))return json({ok:false,error:'unauthorized'},401);
  const bucket=getMusicBucketR314(env);
  if(!bucket)return json({ok:false,error:'music-bucket-not-configured'},503);
  const url=new URL(request.url);
  const oldKey=musicObjectKeyR317(url.searchParams.get('key'));
  if(!oldKey)return json({ok:false,error:'invalid-key'},400);
  const title=musicHeaderR317(request,'x-andrik-track-title');
  if(!title)return json({ok:false,error:'title-required'},400);

  const object=await bucket.get(oldKey);
  if(!object)return json({ok:false,error:'not-found'},404);

  const folder=oldKey.split('/').slice(0,-1).join('/');
  const generated=/\/track_\d+\.mp3$/i.test(oldKey);
  const desiredName=musicTitleFileNameR335(title);
  let newKey=oldKey;
  if(generated && desiredName){
    const candidate=`${folder}/${desiredName}`;
    if(candidate!==oldKey){
      const exists=await bucket.head(candidate).catch(()=>null);
      if(exists)return json({ok:false,error:'target-exists',message:'Файл с таким названием уже есть в R2.'},409);
      newKey=candidate;
    }
  }

  const oldMeta=object.customMetadata || {};
  const customMetadata={...oldMeta,source:'ANDRIK Control R335',title};
  const httpMetadata={...(object.httpMetadata || {}),contentType:'audio/mpeg',contentDisposition:`attachment; filename="${newKey.split('/').pop()}"`};

  if(newKey===oldKey){
    const bytes=await object.arrayBuffer();
    await bucket.put(oldKey,bytes,{httpMetadata,customMetadata});
  }else{
    await bucket.put(newKey,object.body,{httpMetadata,customMetadata});
    await bucket.delete(oldKey);
  }

  return json({ok:true,oldKey,key:newKey,title,url:`https://music.andrikmetal.com/${newKey}`,renamed:newKey!==oldKey});
}
async function handleMusicMp3PutR314(request, env) {
  if (!adminAuthorized(request, env)) return json({ok:false,error:'unauthorized'},401);
  const bucket=getMusicBucketR314(env); if(!bucket) return json({ok:false,error:'music-bucket-not-configured',message:'Добавьте R2 binding MUSIC_BUCKET → andrik-music'},503);
  const url=new URL(request.url), name=musicFileNameR314(url.searchParams.get('name')), folder=musicFolderR317(url.searchParams.get('folder')||'singles');
  if(!name) return json({ok:false,error:'invalid-mp3-name'},400);
  if(!folder) return json({ok:false,error:'invalid-music-folder'},400);
  const len=Number(request.headers.get('content-length')||0); if(len>40*1024*1024) return json({ok:false,error:'file-too-large'},413);
  const body=await request.arrayBuffer(); if(!body.byteLength||body.byteLength>40*1024*1024) return json({ok:false,error:'file-too-large'},413);
  const key=folder+'/'+name;
  const metadata={
    source:'ANDRIK Control R335',
    title:musicHeaderR317(request,'x-andrik-track-title'),
    artist:musicHeaderR317(request,'x-andrik-track-artist'),
    album:musicHeaderR317(request,'x-andrik-track-album'),
    track:musicHeaderR317(request,'x-andrik-track-number',24),
    year:musicHeaderR317(request,'x-andrik-track-year',12),
    genre:musicHeaderR317(request,'x-andrik-track-genre',80)
  };
  await bucket.put(key,body,{httpMetadata:{contentType:'audio/mpeg',contentDisposition:`attachment; filename="${name}"`},customMetadata:metadata});
  return json({ok:true,key,url:`https://music.andrikmetal.com/${key}`,size:body.byteLength,metadata});
}
async function handleMusicSinglesListR316(request, env) {
  const bucket=getMusicBucketR314(env); if(!bucket) return json({ok:false,error:'music-bucket-not-configured'},503);
  const listed=await bucket.list({prefix:'singles/',limit:1000,include:['customMetadata']});
  const legacyTitles={'singles/ty_uze_dostoin.mp3':'Ты уже достоин','singles/tisina.mp3':'Тишина','singles/track_1786265187225.mp3':'Свобода'};
  const tracks=(listed.objects||[]).filter(o=>/\.mp3$/i.test(o.key)).map(o=>({
    key:o.key,name:o.key.replace(/^singles\//,'').replace(/\.mp3$/i,'').replace(/[_-]+/g,' '),
    title:(o.customMetadata&&o.customMetadata.title)||legacyTitles[o.key]||'',url:'https://music.andrikmetal.com/'+o.key,
    uploaded:o.uploaded||null,size:o.size||0
  })).sort((a,b)=>String(b.uploaded||'').localeCompare(String(a.uploaded||'')));
  return json({ok:true,tracks});
}
async function handleMusicDownloadsR322(request, env){
  const bucket=getMusicBucketR314(env); if(!bucket) return json({ok:false,error:'music-bucket-not-configured'},503);
  const listed=await bucket.list({limit:1000,include:['customMetadata']});
  const legacyTitles={'singles/ty_uze_dostoin.mp3':'Ты уже достоин','singles/tisina.mp3':'Тишина','singles/track_1786265187225.mp3':'Свобода'};
  const tracks=(listed.objects||[]).filter(o=>musicObjectKeyR317(o.key)).map(o=>{
    const m=o.customMetadata||{},folder=o.key.split('/').slice(0,-1).join('/'),base=o.key.split('/').pop().replace(/\.mp3$/i,'').replace(/[_-]+/g,' ');
    return {key:o.key,title:m.title||legacyTitles[o.key]||base,album:m.album||'',track:m.track||'',folder,url:'https://music.andrikmetal.com/'+o.key,uploaded:o.uploaded||null};
  });
  return json({ok:true,tracks});
}
async function handleMusicDownloadR327(request, env){
  const bucket=getMusicBucketR314(env);
  if(!bucket) return json({ok:false,error:'music-bucket-not-configured'},503);
  const key=musicObjectKeyR317(new URL(request.url).searchParams.get('key'));
  if(!key) return json({ok:false,error:'invalid-key'},400);
  const object=await bucket.get(key);
  if(!object) return json({ok:false,error:'not-found'},404);
  const rawName=key.split('/').pop()||'ANDRIK.mp3';
  const asciiName=rawName.replace(/[^a-zA-Z0-9._-]/g,'_');
  const h=new Headers();
  h.set('content-type','audio/mpeg');
  h.set('content-disposition',`attachment; filename="${asciiName}"; filename*=UTF-8''${encodeURIComponent(rawName)}`);
  h.set('cache-control','public, max-age=3600');
  h.set('accept-ranges','bytes');
  if(object.size) h.set('content-length',String(object.size));
  h.set('x-content-type-options','nosniff');
  return new Response(object.body,{status:200,headers:h});
}
async function handleMusicLibraryR317(request, env){
  if (!adminAuthorized(request, env)) return json({ok:false,error:'unauthorized'},401);
  const bucket=getMusicBucketR314(env); if(!bucket) return json({ok:false,error:'music-bucket-not-configured'},503);
  const listed=await bucket.list({limit:1000,include:['customMetadata']});
  const legacyTitles={'singles/ty_uze_dostoin.mp3':'Ты уже достоин','singles/tisina.mp3':'Тишина','singles/track_1786265187225.mp3':'Свобода'};
  const tracks=(listed.objects||[]).filter(o=>musicObjectKeyR317(o.key)).map(o=>{
    const m=o.customMetadata||{},base=o.key.split('/').pop().replace(/\.mp3$/i,'').replace(/[_-]+/g,' ');
    return {key:o.key,name:base,title:m.title||legacyTitles[o.key]||base,artist:m.artist||'',album:m.album||'',track:m.track||'',year:m.year||'',genre:m.genre||'',size:o.size||0,uploaded:o.uploaded||null,url:'https://music.andrikmetal.com/'+o.key};
  }).sort((a,b)=>String(b.uploaded||'').localeCompare(String(a.uploaded||'')));
  return json({ok:true,tracks});
}
async function handleMusicFileR317(request, env){
  if (!adminAuthorized(request, env)) return json({ok:false,error:'unauthorized'},401);
  const bucket=getMusicBucketR314(env); if(!bucket) return json({ok:false,error:'music-bucket-not-configured'},503);
  const key=musicObjectKeyR317(new URL(request.url).searchParams.get('key')); if(!key)return json({ok:false,error:'invalid-key'},400);
  const object=await bucket.get(key); if(!object)return json({ok:false,error:'not-found'},404);
  const h=new Headers(); h.set('content-type','audio/mpeg'); h.set('cache-control','no-store'); h.set('content-disposition',`attachment; filename="${key.split('/').pop()}"`); if(object.size)h.set('content-length',String(object.size));
  return new Response(object.body,{status:200,headers:h});
}
async function handleMusicMp3DeleteR314(request, env) {
  if (!adminAuthorized(request, env)) return json({ok:false,error:'unauthorized'},401);
  const bucket=getMusicBucketR314(env); if(!bucket) return json({ok:false,error:'music-bucket-not-configured',message:'Добавьте R2 binding MUSIC_BUCKET → andrik-music'},503);
  const key=musicObjectKeyR317(new URL(request.url).searchParams.get('key')); if(!key) return json({ok:false,error:'invalid-key'},400);
  await bucket.delete(key); return json({ok:true,key});
}

async function routeApi(request, env, ctx) {
  const url = new URL(request.url);
  const path = url.pathname.replace(/\/+$/, '') || '/';
  try {
    // R197: a verified signed owner session transparently authorizes all
    // Control API calls. HttpOnly cookie is primary; Android PWA may send the
    // same expiring signed token in x-andrik-owner-token. ADMIN_KEY is not stored.
    if (!adminAuthorized(request, env)) {
      const ownerTokens = readOwnerSessionTokens(request);
      let ownerSessionOk = false;
      for (const ownerToken of ownerTokens) {
        if (await verifyOwnerSessionToken(ownerToken, env).catch(() => false)) { ownerSessionOk = true; break; }
      }
      if (ownerSessionOk) {
        const ownerKey = configuredAdminKeys(env)[0] || '';
        if (ownerKey) {
          const headers = new Headers(request.headers);
          headers.set('x-admin-key', ownerKey);
          headers.set('x-andrik-owner-session', '1');
          request = new Request(request, { headers });
        }
      }
    }
    if (path === '/api/health' && request.method === 'GET') return await handlePublicHealth(request, env, ctx);
    if (path === '/api/youtube/websub' && request.method === 'GET') return await handleYoutubeWebSubVerifyR332(request, env, ctx);
    if (path === '/api/youtube/websub' && request.method === 'POST') return await handleYoutubeWebSubNotifyR332(request, env, ctx);
    if (path === '/api/control/protection/status' && request.method === 'GET') return await handleControlProtectionStatus(request, env);
    if (path === '/api/control/protection/guard-status' && request.method === 'GET') return await handleControlProtectionGuardStatus(request, env);
    if (path === '/api/control/guard/event' && request.method === 'POST') return await handleGuardEvent(request, env);
    if (path === '/api/control/protection/dashboard' && request.method === 'GET') return await handleControlProtectionDashboard(request, env);
    if (path === '/api/control/protection/attacks' && request.method === 'GET') return await handleControlProtectionAttacks(request, env);
    if (path === '/api/control/protection/guard-run' && request.method === 'POST') return await handleControlProtectionGuardRun(request, env);
    if (path === '/api/control/observability' && request.method === 'GET') return await handleControlObservability(request, env);
    if (path === '/api/control/monitor' && request.method === 'GET') return await handleControlNativeMonitor(request, env);
    if (path === '/api/control/monitor/check' && request.method === 'POST') return await handleControlNativeMonitorCheck(request, env);
    if (path === '/api/site/visit' && request.method === 'POST') return await handleSiteVisit(request, env);
    if (path === '/api/push/config' && request.method === 'GET') return await handlePushConfig(request, env);
    if (path === '/api/push/subscriber' && request.method === 'POST') return await handlePushSubscriber(request, env, ctx);
    if (path === '/api/push/admin-device' && request.method === 'POST') return await handleAdminPushDevice(request, env);
    if (path === '/api/push/send' && request.method === 'POST') return await handleAdminPushSend(request, env);
    if (path === '/api/push/inspect-playlist' && request.method === 'POST') return await handleInspectPlaylist(request, env);
    if (path === '/api/push/check-playlist' && request.method === 'POST') return await handleCheckPlaylist(request, env);
    if (path === '/api/push/check-youtube-events' && request.method === 'POST') return await handleCheckYoutubeEvents(request, env);
    if (path === '/api/youtube/websub/subscribe' && request.method === 'POST') return await handleYoutubeWebSubSubscribeR332(request, env);
    if (path === '/api/youtube/websub/status' && request.method === 'GET') return await handleYoutubeWebSubStatusR332(request, env);
    if (path === '/api/automation/youtube-fast' && request.method === 'POST') return await handleFastYoutubeReleaseCheckR332(request, env);
    if (path === '/api/automation/youtube-engagement-fast' && request.method === 'POST') return await handleFastYoutubeEngagementR333(request, env);
    if (path === '/api/automation/cron-gateway' && (request.method === 'GET' || request.method === 'POST')) return await handleExternalCronGatewayR334(request, env);
    if (path === '/api/automation/run' && request.method === 'POST') return await handleAutomationRun(request, env);
    if (path === '/api/control/daily-summary/send' && request.method === 'POST') return await handleManualDailyOwnerSummary(request, env);
    if (path === '/api/push/retry-latest' && request.method === 'POST') return await handleRetryLatestPush(request, env);
    if (path === '/api/push/diagnostic-log' && request.method === 'GET') return await handlePushDiagnosticLog(request, env);
    if (path === '/api/push/history' && request.method === 'GET') return await handlePushHistory(request, env);
    if (path === '/api/public/youtube-like-glow' && request.method === 'GET') return await handlePublicYoutubeLikeGlow(request, env);
    if (path === '/api/public/youtube-latest' && request.method === 'GET') return await handlePublicYoutubeLatest(request, env);
    if (path === '/api/comments/config' && request.method === 'GET') return await handleCommentsConfig(request, env);
    if (path === '/api/comments/google-session' && request.method === 'POST') return await handleCommentsGoogleSession(request, env);
    if (path === '/api/comments' && request.method === 'GET') return await handlePublicComments(request, env);
    if (path === '/api/comments' && request.method === 'POST') return await handleSubmitComment(request, env, ctx);
    if (path === '/api/comments/like' && request.method === 'POST') return await handleCommentLike(request, env);
    if (path === '/api/comments/report' && request.method === 'POST') return await handleCommentReport(request, env, ctx);
    if (path === '/api/comments/moderate' && request.method === 'GET') return await handleAdminCommentsGet(request, env);
    if (path === '/api/comments/moderate' && request.method === 'POST') return await handleAdminCommentsPost(request, env, ctx);
    if (path === '/api/youtube-captions' && request.method === 'GET') return await handleYoutubeCaptions(request, env);
    if (path === '/api/music/singles' && request.method === 'GET') return await handleMusicSinglesListR316(request, env);
    if (path === '/api/music/downloads' && request.method === 'GET') return await handleMusicDownloadsR322(request, env);
    if (path === '/api/music/download' && request.method === 'GET') return await handleMusicDownloadR327(request, env);
    if (path === '/api/control/music/library' && request.method === 'GET') return await handleMusicLibraryR317(request, env);
    if (path === '/api/control/music/file' && request.method === 'GET') return await handleMusicFileR317(request, env);
    if (path === '/api/control/music/mp3' && request.method === 'PUT') return await handleMusicMp3PutR314(request, env);
    if (path === '/api/control/music/mp3' && request.method === 'PATCH') return await handleMusicMp3PatchR335(request, env);
    if (path === '/api/control/music/mp3' && request.method === 'DELETE') return await handleMusicMp3DeleteR314(request, env);
    if (path === '/api/lyrics' && request.method === 'GET') return await handlePublicLyrics(request, env);
    if (path === '/api/lyrics/admin' && request.method === 'GET') return await handleAdminLyricsGet(request, env);
    if (path === '/api/lyrics/catalog' && request.method === 'GET') return await handleAdminLyricsCatalog(request, env);
    if (path === '/api/lyrics/admin' && request.method === 'POST') return await handleAdminLyricsPost(request, env);
    if (path === '/api/lyrics/musixmatch' && request.method === 'POST') return await handleAdminMusixmatchImport(request, env);
    if (path === '/api/lyrics/admin' && request.method === 'DELETE') return await handleAdminLyricsDelete(request, env);
    if (path === '/api/releases/publish' && request.method === 'POST') return await handlePublishRelease(request, env);
    if (path === '/api/releases/history' && request.method === 'GET') return await handleReleaseHistory(request, env);
    if (path === '/api/control/site-update/status' && request.method === 'GET') return await handleSiteUpdateStatus(request, env);
    if (path === '/api/control/site-update/preview' && request.method === 'POST') return await handleSiteUpdatePreview(request, env);
    if (path === '/api/control/site-update/backup' && request.method === 'POST') return await handleSiteUpdateBackup(request, env);
    if (path === '/api/control/site-update/backup-zip' && request.method === 'GET') return await handleSiteUpdateBackupZip(request, env);
    if (path === '/api/control/site-update/publish' && request.method === 'POST') return await handleSiteUpdatePublish(request, env);
    if (path === '/api/control/site-update/release' && request.method === 'POST') return await handleSiteUpdateRelease(request, env);
    if (path === '/api/control/site-update/deployment' && request.method === 'GET') return await handleSiteUpdateDeployment(request, env);
    if (path === '/api/control/site-update/finalize' && request.method === 'POST') return await handleSiteUpdateFinalize(request, env);
    if (path === '/api/control/site-update/log' && request.method === 'GET') return await handleSiteUpdateLog(request, env);
    if (path === '/api/control/site-update/history' && request.method === 'GET') return await handleSiteUpdateHistory(request, env);
    if (path === '/api/control/site-update/rollback' && request.method === 'POST') return await handleSiteUpdateRollback(request, env);
    if (path === '/api/control/owner-session' && request.method === 'POST') return await handleOwnerSessionCreate(request, env);
    if (path === '/api/control/owner-session' && request.method === 'DELETE') return await handleOwnerSessionDelete(request);
    if (path === '/api/control/owner-status' && request.method === 'GET') return await handleOwnerStatus(request, env);
    if (path === '/api/control/access' && request.method === 'GET') return await handleControlAccess(request, env);
    if (path === '/api/control/home' && request.method === 'GET') return await handleControlHome(request, env);
    if (path === '/api/control/dashboard' && request.method === 'GET') return await handleControlDashboard(request, env);
    if (path === '/api/control/system' && request.method === 'GET') return await handleControlSystem(request, env);
    if (path === '/api/control/google-analytics' && request.method === 'GET') return await handleControlGoogleAnalytics(request, env);
    if (path === '/api/control/ecosystem-map' && request.method === 'GET') return await handleControlEcosystemMap(request, env);
    if (path === '/api/control/audience' && request.method === 'GET') return await handleControlAudience(request, env);
    if (path === '/api/control/search-console' && request.method === 'GET') return await handleControlSearchConsole(request, env);
    if (path === '/api/control/snapshots/refresh' && request.method === 'POST') return await handleControlSnapshotsRefresh(request, env);
    if (path === '/api/control/country-growth' && request.method === 'GET') return await handleControlCountryGrowth(request, env);
    if (path === '/api/control/youtube-events/status' && request.method === 'GET') return await handleYoutubeEventsStatus(request, env);
    if (path === '/api/control/youtube-oauth/status' && request.method === 'GET') return await handleYoutubeOAuthStatus(request, env);
    if (path === '/api/control/youtube-oauth/start' && request.method === 'GET') return await handleYoutubeOAuthStart(request, env);
    if ((path === '/api/control/youtube-oauth/callback' || path === '/oauth/youtube/callback') && request.method === 'GET') return await handleYoutubeOAuthCallback(request, env, ctx);
    if (path === '/api/control/youtube-oauth/disconnect' && request.method === 'POST') return await handleYoutubeOAuthDisconnect(request, env);
    if (path === '/api/control/comment-collection' && request.method === 'GET') return await handleControlCommentCollection(request, env);
    if (path === '/api/control/youtube-comment' && request.method === 'GET') return await handleYoutubeCommentDetail(request, env);
    if (path === '/api/control/youtube-comment/reply' && request.method === 'POST') return await handleYoutubeCommentReply(request, env);
    if (path === '/api/backup/run' && request.method === 'POST') return await handleBackupRun(request, env);
    if (path === '/api/backup/history' && request.method === 'GET') return await handleBackupHistory(request, env);
    if (path === '/api/backup/download' && request.method === 'GET') return await handleBackupDownload(request, env);
    if (path === '/api/backup/preview' && request.method === 'GET') return await handleBackupPreview(request, env);
    if (path === '/api/backup/restore' && request.method === 'POST') return await handleBackupRestore(request, env);
    return json({ ok: false, error: 'not-found' }, 404);
  } catch (error) {
    console.error('ANDRIK API error', error);
    const missingDb = String(error?.message || '').includes('COMMENTS_DB');
    await recordSystemLog(env, {
      scope:'api', level:'error', event:'unhandled-error',
      message:`${request.method} ${path}: ${cleanPlainText(error?.message || error, 420)}`,
      details:{ path, method:request.method, stack:cleanPlainText(error?.stack || '', 1200) }
    }).catch(() => {});
    const isProtection = path.startsWith('/api/control/protection/');
    return json({
      ok:false,
      error:missingDb ? 'backend-not-configured' : 'server-error',
      ...(isProtection ? { message:cleanPlainText(error?.message || error, 300) } : {})
    }, missingDb ? 503 : 500);
  }
}


function controlRecoveryServiceWorkerSource() {
  return [
    "'use strict';",
    "const VERSION='54.95';",
    "async function clearCaches(){if(!self.caches)return;const keys=await caches.keys();await Promise.all(keys.filter(name=>name.startsWith('andrik-control-')||name.startsWith('andrik-site-')).map(name=>caches.delete(name)));}",
    "self.addEventListener('install',event=>event.waitUntil(self.skipWaiting()));",
    "self.addEventListener('activate',event=>event.waitUntil((async()=>{await clearCaches();await self.clients.claim();})()));",
    "self.addEventListener('message',event=>{if(event.data?.type==='SKIP_WAITING')event.waitUntil(self.skipWaiting());if(event.data?.type==='CLEAR_ALL_CACHES')event.waitUntil(clearCaches());});",
    "// No fetch listener: Control pages always use the network directly."
  ].join('\n');
}

function controlRecoveryPage() {
  return `<!doctype html><html lang="ru"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover"><meta name="theme-color" content="#02060a"><meta name="robots" content="noindex,nofollow"><title>Восстановление Control ANDRIK</title><style>*{box-sizing:border-box}html,body{min-height:100%;margin:0;background:#02060a;color:#eff8ff;font-family:system-ui,-apple-system,Segoe UI,sans-serif}body{display:grid;place-items:center;padding:22px}.c{width:min(100%,520px);padding:30px 22px;border:1px solid #244455;border-radius:28px;background:linear-gradient(#081923,#030c13);text-align:center}.e{font-size:58px}h1{font-size:clamp(30px,8vw,44px);margin:12px 0}.s{color:#abc0cc;line-height:1.55}.b{display:inline-flex;min-height:54px;align-items:center;justify-content:center;margin-top:20px;padding:0 22px;border:1px solid #315b70;border-radius:999px;color:#eff8ff;text-decoration:none;font-weight:800;background:#0a2432}</style></head><body><main class="c"><div class="e">🟢</div><h1>Восстанавливаем Control</h1><p class="s" id="s">Заменяем старый перехват страниц безопасной версией…</p><a class="b" id="b" href="/analytics-admin.html?source=recovery&page=map&v=54.96" hidden>Открыть Control</a></main><script>(async()=>{const s=document.getElementById('s'),b=document.getElementById('b'),go='/analytics-admin.html?source=recovery&page=map&v=54.96&t='+Date.now();b.href=go;try{if('caches'in window){const k=await caches.keys();await Promise.all(k.filter(n=>n.startsWith('andrik-control-')||n.startsWith('andrik-site-')).map(n=>caches.delete(n)))}if('serviceWorker'in navigator){const r=await navigator.serviceWorker.register('/service-worker.js?v=54.96-control-recovery',{scope:'/',updateViaCache:'none'});if(r.installing)r.installing.postMessage({type:'SKIP_WAITING'});if(r.waiting)r.waiting.postMessage({type:'SKIP_WAITING'});await r.update().catch(()=>{});await new Promise(x=>setTimeout(x,1200))}s.textContent='Готово. Открываем карту напрямую…';s.style.color='#bfffd9';b.hidden=false;setTimeout(()=>location.replace(go),650)}catch(e){s.textContent='Нажмите кнопку ниже. '+String(e&&e.message||e);s.style.color='#ffb9b9';b.hidden=false}})();</script></body></html>`;
}


function allowControlPlayerFrame(response, url, isControlHost) {
  if (!isControlHost) return response;

  const path = url.pathname.replace(/\/+$/, '') || '/';
  const contentType = String(response.headers.get('content-type') || '').toLowerCase();
  const isHtml = contentType.includes('text/html');
  const isPlayerShell = url.searchParams.get('player-shell') === '1'
    && path !== '/site-update-admin.html'
    && path !== '/site-update-admin'
    && !path.startsWith('/cache-reset');

  const headers = new Headers(response.headers);

  // R171: security headers are enforced by the Worker itself, so a future
  // replacement of the static _headers file cannot lower the protection score.
  headers.set('strict-transport-security', 'max-age=31536000; includeSubDomains');
  headers.set('x-content-type-options', 'nosniff');
  headers.set('referrer-policy', 'strict-origin-when-cross-origin');
  headers.set('permissions-policy', 'camera=(), microphone=(), geolocation=()');
  headers.set('x-andrik-security-headers', 'R190');

  if (isHtml) {
    if (isPlayerShell) {
      // The player shell is intentionally allowed only inside our own origins.
      headers.delete('x-frame-options');
      headers.set('content-security-policy', "frame-ancestors 'self' https://andrikmetal.com https://control.andrikmetal.com");
      headers.set('cache-control', 'no-store, no-cache, must-revalidate');
      headers.set('x-andrik-player-shell', 'R171');
    } else {
      headers.set('x-frame-options', 'SAMEORIGIN');
      const existingCsp = String(headers.get('content-security-policy') || '').trim();
      if (!/frame-ancestors/i.test(existingCsp)) {
        headers.set('content-security-policy', existingCsp
          ? `${existingCsp}; frame-ancestors 'self'`
          : "frame-ancestors 'self'");
      }
    }
  }

  return new Response(response.body, {
    status:response.status,
    statusText:response.statusText,
    headers
  });
}

function controlAssetFailurePage(error) {
  const safe = String(error?.message || error || 'unknown').replace(/[<>&"']/g, '');
  return `<!doctype html><html lang="ru"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="robots" content="noindex"><title>Control ANDRIK — восстановление</title><style>body{margin:0;min-height:100vh;display:grid;place-items:center;padding:24px;background:#02060a;color:#eef8ff;font:18px/1.5 system-ui}.c{max-width:560px;padding:26px;border:1px solid #294654;border-radius:24px;background:#07131b}a{color:#bcecff}</style></head><body><main class="c"><h1>Control временно не получил файл</h1><p>Откройте встроенное восстановление:</p><p><a href="/cache-reset.html?v=5469">Восстановить Control ANDRIK</a></p><small>${safe}</small></main></body></html>`;
}

export default {
  async scheduled(controller, env, ctx) {
    const cronKey=String(env.CRON_SECRET || '');
    const cron=String(controller?.cron || '');
    const isEngagementR333=cron===YOUTUBE_ENGAGEMENT_CRON_R333;
    const isFiveMinuteR333=cron===YOUTUBE_FAST_CRON_R332;
    const target=isEngagementR333
      ? 'https://control.andrikmetal.com/api/automation/youtube-engagement-fast'
      : isFiveMinuteR333
        ? 'https://control.andrikmetal.com/api/automation/youtube-fast'
        : 'https://control.andrikmetal.com/api/automation/run';
    const request=new Request(target,{method:'POST',headers:cronKey?{'x-cron-key':cronKey}:{}});
    ctx.waitUntil((async()=>{
      if(!cronKey){
        await recordSystemLog(env,{scope:'automation',level:'error',event:'scheduled-secret-missing',message:'Cron Trigger запущен, но CRON_SECRET не настроен.'}).catch(()=>{});
        return;
      }
      let response;
      if(isEngagementR333){
        response=await handleFastYoutubeEngagementR333(request,env);
      }else if(isFiveMinuteR333){
        let dailySummary;
        try{
          dailySummary=await maybeSendDailyOwnerSummary(env);
        }catch(error){
          dailySummary={ok:false,error:cleanPlainText(error?.message || error,500)};
        }
        const release=await responseData(await handleFastYoutubeReleaseCheckR332(request,env));
        const events=await responseData(await handleCheckYoutubeEvents(request,env));
        const summaryOk=Boolean(dailySummary?.ok || dailySummary?.skipped);
        const ok=summaryOk&&Boolean(release.httpOk)&&Boolean(events.httpOk);
        response=json({ok,dailySummary,release,events,mode:'five-minute-r364'},ok?200:502);
      }else{
        response=await handleAutomationRun(request,env);
      }
      if(!response.ok){
        const body=await response.text().catch(()=>'');
        const mode=isEngagementR333?'youtube-engagement-fast':isFiveMinuteR333?'youtube-fast-5m':'automation';
        throw new Error(`scheduled-${mode}-${response.status}: ${body.slice(0,300)}`);
      }
    })().catch(error=>recordSystemLog(env,{scope:'automation',level:'error',event:'scheduled-run-failed',message:cleanPlainText(error?.message || error,500)}).catch(()=>{})));
  },
  async fetch(request, env, ctx) {
    const url = new URL(request.url);
    const normalizedPath = url.pathname.replace(/\/+$/, '') || '/';
    const hostname = url.hostname.toLowerCase();
    const isControlHost = hostname === 'control.andrikmetal.com';

    // Google returns outside /api/. Process this before Pages/static fallback.
    if (url.pathname.startsWith('/api/') || normalizedPath === '/oauth/youtube/callback') {
      return routeApi(request, env, ctx);
    }

    // The recovery worker is generated here, not loaded from static assets.
    // This guarantees that the exact old /service-worker.js URL can always be replaced.
    if (isControlHost && (normalizedPath === '/service-worker.js' || normalizedPath === '/control-service-worker.js')) {
      return new Response(controlRecoveryServiceWorkerSource(), {
        headers: {
          'content-type': 'application/javascript; charset=utf-8',
          'cache-control': 'no-cache, no-store, must-revalidate',
          'service-worker-allowed': '/',
          'x-content-type-options': 'nosniff'
        }
      });
    }

    // Recovery page also comes directly from the Worker so it cannot disappear
    // because of an incomplete static upload.
    if (isControlHost && (normalizedPath === '/cache-reset.html' || normalizedPath.startsWith('/cache-reset-v54-'))) {
      return new Response(controlRecoveryPage(), {
        headers: {
          'content-type': 'text/html; charset=utf-8',
          'cache-control': 'no-cache, no-store, must-revalidate',
          'x-robots-tag': 'noindex, nofollow, noarchive'
        }
      });
    }

    try {
      if (request.method === 'GET' || request.method === 'HEAD') {
        const path = normalizedPath;
        // Dedicated owner subdomain: serve the Control map HTML directly.
        if (isControlHost && (path === '/' || path === '/index.html' || path === '/admin' || path === '/admin/index.html')) {
          const assetUrl = new URL('/analytics-admin.html', url);
          const response = await env.ASSETS.fetch(new Request(assetUrl.toString(), request));
          return allowControlPlayerFrame(response, url, isControlHost);
        }
      }
      const response = await env.ASSETS.fetch(request);
      return allowControlPlayerFrame(response, url, isControlHost);
    } catch (error) {
      console.error('ANDRIK static asset error', error);
      ctx?.waitUntil?.(recordSystemLog(env, { scope:'assets', level:'error', event:'asset-fetch-failed', message:`${request.method} ${normalizedPath}: ${cleanPlainText(error?.message || error,420)}`, details:{ host:hostname, path:normalizedPath } }).catch(() => {}));
      if (isControlHost) {
        return new Response(controlAssetFailurePage(error), {
          status: 503,
          headers: {
            'content-type': 'text/html; charset=utf-8',
            'cache-control': 'no-cache, no-store, must-revalidate'
          }
        });
      }
      return new Response('Temporary asset error', { status: 503 });
    }
  }
};
