(function (root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.ScheduleCore = api;
})(typeof window === 'undefined' ? globalThis : window, function () {
  'use strict';
  const weekdays = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'];
  const pad = n => String(n).padStart(2, '0');
  const iso = date => `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
  const parse = key => { const [y, m, d] = key.split('-').map(Number); return new Date(y, m - 1, d, 12); };
  const addDays = (date, n) => new Date(date.getFullYear(), date.getMonth(), date.getDate() + n, 12);
  const dayIndex = date => (date.getDay() + 6) % 7;
  const monday = date => addDays(date, -dayIndex(date));
  const minutes = time => { const [h, m] = time.split(':').map(Number); return h * 60 + m; };
  const times = lesson => lesson.time.split(/[-–—]/).map(s => s.trim());
  const has = (object, key) => Object.prototype.hasOwnProperty.call(object || {}, key);
  function moscowNow(now = new Date()) {
    const parts = new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Moscow', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }).formatToParts(now);
    const p = Object.fromEntries(parts.map(v => [v.type, v.value]));
    return { key: `${p.year}-${p.month}-${p.day}`, minute: Number(p.hour) * 60 + Number(p.minute) };
  }
  function cycleFor(group, key) {
    return [...(group.cycle || [])].filter(c => c.start <= key).sort((a, b) => b.start.localeCompare(a.start))[0];
  }
  function classify(lesson) { return lesson.kind || (/ЦБИ/i.test(lesson.room || '') ? 'cbi' : 'main'); }
  function getDay(data, name, key, filter = 'all') {
    const group = data.groups[name] || {};
    const date = parse(key);
    let list = null, origin = 'none';
    if (has(group.dates, key)) { list = group.dates[key]; origin = 'dated'; }
    else {
      const cycle = cycleFor(group, key);
      const index = cycle ? Math.round((monday(date) - monday(parse(cycle.start))) / 604800000) % cycle.weeks.length : 0;
      const week = cycle ? cycle.weeks[index] : group.weekly;
      const wd = weekdays[dayIndex(date)];
      if (has(week, wd)) { list = week[wd]; origin = cycle ? 'cycle' : 'weekly'; }
      if (has(group.extra, key)) { list = [...(list || []), ...group.extra[key].map(l => ({ ...l, kind: 'cbi', source: 'cbi' }))]; }
    }
    // Exact day lists already contain their CBI session. Never append it twice.
    let lessons = (list || []).map(l => ({ ...l, kind: classify(l), source: l.source || (classify(l) === 'cbi' ? 'cbi' : 'legacy') }));
    if (filter !== 'all') lessons = lessons.filter(l => l.kind === filter);
    lessons.sort((a, b) => minutes(times(a)[0]) - minutes(times(b)[0]));
    const cbiKnown = has(group.extra, key) || lessons.some(l => l.kind === 'cbi');
    return { lessons, origin, status: lessons.length ? 'ok' : (filter === 'cbi' ? (cbiKnown ? 'free' : 'nodata') : list === null ? 'nodata' : list.length === 0 ? 'free' : 'filtered') };
  }
  function conflicts(lessons) {
    return lessons.filter((a, i) => lessons.some((b, j) => i !== j && minutes(times(a)[0]) < minutes(times(b)[1]) && minutes(times(b)[0]) < minutes(times(a)[1])));
  }
  function duration(lessons) { return lessons.reduce((sum, l) => { const [a, b] = times(l); return sum + minutes(b) - minutes(a); }, 0); }
  function plural(n, one = 'пара', few = 'пары', many = 'пар') { return n % 10 === 1 && n % 100 !== 11 ? one : n % 10 >= 2 && n % 10 <= 4 && (n % 100 < 12 || n % 100 > 14) ? few : many; }
  function ics(events, group, stamp = new Date()) {
    const escape = s => String(s || '').replace(/\\/g, '\\\\').replace(/\n/g, '\\n').replace(/,/g, '\\,').replace(/;/g, '\\;');
    const lines = ['BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//Schedule App//RU', 'CALSCALE:GREGORIAN'];
    for (const { date, lesson } of events) {
      const [start, end] = times(lesson);
      const utc = time => new Date(`${date}T${time}:00+03:00`).toISOString().replace(/[-:]/g, '').replace(/\.\d{3}Z$/, 'Z');
      const uid = [...`${group}-${date}-${lesson.time}-${lesson.subject}`].reduce((h, c) => Math.imul(h ^ c.charCodeAt(0), 16777619) >>> 0, 2166136261);
      lines.push('BEGIN:VEVENT', `UID:${uid}@schedule-app`, `DTSTAMP:${stamp.toISOString().replace(/[-:]/g, '').replace(/\.\d{3}Z$/, 'Z')}`, `DTSTART:${utc(start)}`, `DTEND:${utc(end)}`, `SUMMARY:${escape(lesson.subject)}`, `LOCATION:${escape(lesson.room)}`, `DESCRIPTION:${escape([group, lesson.type, lesson.teacher, lesson.topic].filter(Boolean).join('\n'))}`, 'END:VEVENT');
    }
    lines.push('END:VCALENDAR');
    // RFC 5545: fold at UTF-8 byte boundaries, up to 75 octets per line.
    return lines.map(line => {
      let folded = '', length = 0;
      for (const char of line) { const size = new TextEncoder().encode(char).length; if (length + size > 75) { folded += '\r\n '; length = 1; } folded += char; length += size; }
      return folded;
    }).join('\r\n') + '\r\n';
  }
  return { iso, parse, addDays, dayIndex, monday, minutes, times, moscowNow, cycleFor, classify, getDay, conflicts, duration, plural, ics };
});
