ANDRIK R1249 — TikTok Control + Audience fix

1. START TikTok больше не блокируется из-за запаздывающего UI-статуса, если RTMP сохранён/OVH уже configured.
2. AUTO START/STOP по умолчанию OFF и пресеты времени сами галочку не включают.
3. Монитор LIVE больше не показывает ложный 0, если TikTok не вернул viewer count. В таком случае показывает «счётчик пока не отдан».
4. Добавлен дополнительный fallback /api/live/detail/ для user_count/liveRoomStats.userCount.
5. График сохраняет только реальные числовые readings, а не синтетические нули.

VPS/YouTube не перезапускаются установкой сайта.
