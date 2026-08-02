/* Live Web AI R187 — one-eye notification stack.
   Every new ANDRIK push replaces the previous visible notification. Android
   therefore keeps one eye in the status bar; the notification title can show
   the accumulated +N counter. */
const ANDRIK_GENERIC_WELCOME = /thanks\s+for\s+subscribing|спасибо\s+за\s+подписку|дякуємо\s+за\s+підписку|ďakujeme\s+za\s+odber/i;
const ANDRIK_STACK_TITLE = /^👁\s*ANDRIK\s*·\s*\+(\d+)/iu;

function deepAndrikValue(value, key, depth = 0) {
  if (!value || depth > 5) return undefined;
  if (typeof value === 'object') {
    if (Object.prototype.hasOwnProperty.call(value, key)) return value[key];
    for (const nested of Object.values(value)) {
      const found = deepAndrikValue(nested, key, depth + 1);
      if (found !== undefined) return found;
    }
  }
  return undefined;
}

function stackWord(count) {
  const n = Math.max(1, Number(count || 1));
  const n10 = n % 10, n100 = n % 100;
  if (n10 === 1 && n100 !== 11) return 'событие';
  if (n10 >= 2 && n10 <= 4 && (n100 < 12 || n100 > 14)) return 'события';
  return 'событий';
}

self.addEventListener('push', event => {
  try {
    const text = event.data ? event.data.text() : '';
    if (ANDRIK_GENERIC_WELCOME.test(text)) {
      event.stopImmediatePropagation();
      return;
    }
  } catch (_) {}
});

self.addEventListener('activate', event => {
  event.waitUntil((async () => {
    try {
      const visible = await self.registration.getNotifications();
      visible.forEach(notification => notification.close());
    } catch (_) {}
  })());
});

try {
  const originalShowNotification = self.registration.showNotification.bind(self.registration);
  self.registration.showNotification = async (title, options = {}) => {
    const text = `${title || ''} ${options?.body || ''}`;
    if (ANDRIK_GENERIC_WELCOME.test(text)) return;

    const embeddedCount = Number(deepAndrikValue(options, 'andrikGroupCount') || 0);
    const titleCount = Number(String(title || '').match(ANDRIK_STACK_TITLE)?.[1] || 0);
    const count = Math.max(embeddedCount, titleCount);
    const groupKey = String(deepAndrikValue(options, 'andrikGroupKey') || (count > 0 ? 'andrik-owner-stack' : '')).trim();

    const originalTitle = String(deepAndrikValue(options, 'andrikOriginalTitle') || title || 'Событие ANDRIK');
    const originalMessage = String(deepAndrikValue(options, 'andrikOriginalMessage') || options?.body || '');
    const singleTag = 'andrik-single-eye';

    /* Close every older notification created by this worker before showing the
       latest event. A constant tag alone is not reliable on every Android skin. */
    try {
      const visible = await self.registration.getNotifications();
      visible.forEach(notification => notification.close());
    } catch (_) {}

    options = {
      ...options,
      tag: singleTag,
      renotify: true,
      badge: '/assets/andrik-eye-notification-badge-192.png',
      icon: options?.icon || '/assets/andrik-eye-v22-192.png',
      data: {
        ...(options?.data || {}),
        andrikGroupKey: groupKey || singleTag,
        andrikGroupCount: Math.max(1, count || 1),
        andrikSingleEye: true
      }
    };
    if (count > 1) {
      title = `👁 ANDRIK · +${count} ${stackWord(count)}`;
      options.body = `Последнее: ${originalTitle}${originalMessage ? `\n${originalMessage}` : ''}`.slice(0, 360);
    }

    return originalShowNotification(title, options);
  };
} catch (_) {}

importScripts('https://cdn.onesignal.com/sdks/web/v16/OneSignalSDK.sw.js');
