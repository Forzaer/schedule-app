(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory(require('./core.js'));
  else root.ScheduleDriving = factory(root.ScheduleCore);
})(typeof window === 'undefined' ? globalThis : window, function (C) {
  'use strict';
  const codePrefix = 'drive1.';
  const places = ['unknown', 'city', 'course'];
  const empty = () => ({
    progress: { sessions: 0, approximate: false, city: 0, minutes: 0, goal: null },
    lessons: []
  });
  const integer = (value, min, max) => Number.isInteger(value) && value >= min && value <= max;
  const timePattern = /^(?:[01]\d|2[0-3]):[0-5]\d$/;
  const duration = lesson => C.minutes(lesson.end) - C.minutes(lesson.start);
  const ordered = lessons => [...lessons].sort((a, b) => (a.date + a.start).localeCompare(b.date + b.start));
  function validProgress(progress) {
    return progress && integer(progress.sessions, 0, 999) && typeof progress.approximate === 'boolean' &&
      integer(progress.city, 0, progress.sessions) && (progress.minutes === null || integer(progress.minutes, 0, 60000)) &&
      (progress.goal === null || integer(progress.goal, 1, 60000));
  }
  function validLesson(lesson) {
    return lesson && typeof lesson.id === 'string' && /^[a-zA-Z0-9_-]{1,72}$/.test(lesson.id) &&
      typeof lesson.date === 'string' && /^20\d\d-\d\d-\d\d$/.test(lesson.date) && C.iso(C.parse(lesson.date)) === lesson.date &&
      typeof lesson.start === 'string' && typeof lesson.end === 'string' &&
      timePattern.test(lesson.start) && timePattern.test(lesson.end) && lesson.start < lesson.end &&
      (lesson.number === null || integer(lesson.number, 1, 9999)) &&
      places.includes(lesson.place) && typeof lesson.done === 'boolean';
  }
  function valid(data) {
    return data && validProgress(data.progress) && Array.isArray(data.lessons) && data.lessons.length <= 500 &&
      data.lessons.every(validLesson) && new Set(data.lessons.map(l => l.id)).size === data.lessons.length &&
      new Set(data.lessons.map(l => l.date + l.start)).size === data.lessons.length;
  }
  function summary(data) {
    const completed = data.lessons.filter(l => l.done);
    const loggedMinutes = completed.reduce((sum, l) => sum + duration(l), 0);
    const minutes = data.progress.minutes === null ? null : data.progress.minutes + loggedMinutes;
    return {
      sessions: data.progress.sessions + completed.length,
      approximate: data.progress.approximate,
      city: data.progress.city + completed.filter(l => l.place === 'city').length,
      loggedMinutes,
      minutes,
      goal: data.progress.goal,
      remaining: minutes === null || data.progress.goal === null ? null : Math.max(data.progress.goal - minutes, 0)
    };
  }
  function sections(data, now) {
    const upcoming = [], pending = [], completed = [];
    for (const lesson of ordered(data.lessons)) {
      if (lesson.done) completed.unshift(lesson);
      else if (lesson.date > now.key || (lesson.date === now.key && C.minutes(lesson.end) > now.minute)) upcoming.push(lesson);
      else pending.unshift(lesson);
    }
    return { upcoming, pending, completed };
  }
  function encode(data) {
    if (!valid(data)) throw new Error('Invalid driving data');
    const p = data.progress;
    const pack = [[p.sessions, p.approximate, p.city, p.minutes, p.goal], ...data.lessons.map(l =>
      [l.id, l.date, l.start, l.end, l.number, l.place, l.done]
    )];
    return codePrefix + btoa(JSON.stringify(pack)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
  }
  function decode(code) {
    if (typeof code !== 'string') return null;
    code = code.trim();
    if (!/^drive1\.[A-Za-z0-9_-]+$/.test(code) || code.length > 65000) return null;
    try {
      const packed = JSON.parse(atob(code.slice(codePrefix.length).replace(/-/g, '+').replace(/_/g, '/')));
      if (!Array.isArray(packed) || !Array.isArray(packed[0]) || packed[0].length !== 5 ||
          !packed.slice(1).every(row => Array.isArray(row) && row.length === 7)) return null;
      const [sessions, approximate, city, minutes, goal] = packed[0];
      const result = { progress: { sessions, approximate, city, minutes, goal }, lessons: packed.slice(1).map(
        ([id, date, start, end, number, place, done]) => ({ id, date, start, end, number, place, done })
      ) };
      return valid(result) ? result : null;
    } catch (_) {
      return null;
    }
  }
  function merge(current, imported) {
    if (!current) return imported;
    const ids = new Set(current.lessons.map(l => l.id));
    const starts = new Set(current.lessons.map(l => l.date + l.start));
    const newLessons = imported.lessons.filter(l => !ids.has(l.id) && !starts.has(l.date + l.start));
    return { progress: current.progress, lessons: [...current.lessons, ...newLessons] };
  }
  return { empty, valid, validLesson, validProgress, duration, summary, sections, encode, decode, merge };
});
