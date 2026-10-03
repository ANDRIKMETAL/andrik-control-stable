ANDRIK CONTROL R1233 — D1 ROWS_READ SHIELD

Причина:
Cloudflare прислал предупреждение о 77% дневного лимита D1 rows_read (5,000,000).

Найден реальный дорогой участок в контрольке / графике радио:
1) При каждом открытом графике каждые 2 минуты выполнялся:
   SELECT ... FROM radio_audience_samples
   ORDER BY datetime(sampled_at) DESC LIMIT 1

   Из-за datetime(sampled_at) существующий индекс не использовался нормально,
   поэтому запрос мог перечитывать большую часть всей истории samples.

2) Очистка radio_audience_samples выполнялась в 00 и 30 минут каждого часа
   (~48 раз в сутки):
   DELETE ... WHERE datetime(sampled_at)<datetime('now','-35 days')

   Это тоже могло сканировать всю 35-дневную таблицу снова и снова.

R1233:
- latest sample ищется только за TODAY через существующий индекс:
  (local_date, sampled_at);
- ORDER BY datetime(sampled_at) заменён на ORDER BY sampled_at;
  sampled_at хранится в ISO UTC, поэтому строковая сортировка корректна;
- retention запускается один раз в сутки, а не ~48 раз;
- retention удаляет по indexed local_date;
- график, 2-минутный сбор, точность данных и внешний вид НЕ меняются;
- RTMPS / радио-сервер / VPS не затрагиваются.

Дополнительно проверено:
Primary/Backup RTMPS relay с -c copy могут честно показывать 0.0% CPU —
их работу проверяем по RTMPS 2/2 и ACK, а не по проценту CPU.

Если после нескольких суток с R1233 D1 всё ещё будет подходить к 75%,
следующим шагом надо измерить вклад ежедневного полного D1 backup и
городской карты, но сначала этот full-scan hot path нужно убрать.
