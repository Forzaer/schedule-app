(function () {
  'use strict';
  const C = window.ScheduleCore;
  const TG = window.ScheduleTelegram;
  const data = JSON.parse(document.getElementById('schedule-data').textContent);
  const $ = id => document.getElementById(id);
  const esc = value => String(value == null ? '' : value).replace(/[&<>"']/g, s => ({ '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#39;' }[s]));
  const read = (key, fallback) => { try { return localStorage.getItem(key) || fallback; } catch (_) { return fallback; } };
  const write = (key, value) => { try { localStorage.setItem(key, value); } catch (_) {} };
  const dayNames = ['Пн','Вт','Ср','Чт','Пт','Сб','Вс'];
  const format = (key, options) => C.parse(key).toLocaleDateString('ru-RU', options);
  const shortDate = key => format(key, { day:'numeric', month:'long' });
  const fullDate = key => format(key, { weekday:'long', day:'numeric', month:'long' });
  const capital = s => s.charAt(0).toUpperCase() + s.slice(1);
  const duration = n => `${Math.floor(n / 60)} ч${n % 60 ? ` ${n % 60} мин` : ''}`;
  const paths = {
    calendar:'<rect x="3" y="5" width="18" height="16" rx="3"/><path d="M16 3v4M8 3v4M3 11h18M8 15h2M14 15h2"/>',
    groups:'<circle cx="9" cy="8" r="3"/><path d="M3 21v-2a6 6 0 0 1 12 0v2M16 5a3 3 0 0 1 0 6M21 21v-2a6 6 0 0 0-4-5"/>',
    bookmark:'<path d="M6 4a1 1 0 0 1 1-1h10a1 1 0 0 1 1 1v17l-6-4-6 4z"/>',
    layers:'<path d="m12 3 10 5-10 5L2 8zM2 12l10 5 10-5M2 16l10 5 10-5"/>',
    clock:'<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>',
    chevronDown:'<path d="m6 9 6 6 6-6"/>', chevronLeft:'<path d="m15 6-6 6 6 6"/>', chevronRight:'<path d="m9 6 6 6-6 6"/>',
    sun:'<circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M2 12h2M20 12h2M5 5l1 1M18 18l1 1M5 19l1-1M18 6l1-1"/>',
    moon:'<path d="M21 13a9 9 0 1 1-10-10 7 7 0 0 0 10 10z"/>',
    search:'<circle cx="10.5" cy="10.5" r="6.5"/><path d="m16 16 5 5"/>',
    pin:'<path d="M19 10c0 5-7 11-7 11S5 15 5 10a7 7 0 1 1 14 0z"/><circle cx="12" cy="10" r="2"/>',
    user:'<circle cx="12" cy="7" r="3"/><path d="M5 21v-2a7 7 0 0 1 14 0v2"/>',
    download:'<path d="M12 3v12m-5-5 5 5 5-5M4 16v4a1 1 0 0 0 1 1h14a1 1 0 0 0 1-1v-4"/>',
    shield:'<path d="m12 3 8 3v5c0 5-8 10-8 10S4 16 4 11V6zM9 12l2 2 4-4"/>',
    chart:'<path d="M4 20V10M10 20V4M16 20v-8M22 20H2"/>',
    close:'<path d="m6 6 12 12M6 18 18 6"/>', check:'<path d="m5 12 4 4L19 6"/>',
    book:'<path d="M4 4h6l2 2 2-2h6v15h-6l-2 2-2-2H4zM12 6v15"/>',
    spark:'<path d="m12 3 2.5 6.5L21 12l-6.5 2.5L12 21l-2.5-6.5L3 12l6.5-2.5z"/>'
  };
  const icon = name => `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${paths[name] || paths.book}</svg>`;
  const fillIcons = root => root.querySelectorAll('[data-icon]').forEach(el => { el.innerHTML = icon(el.dataset.icon); });
  fillIcons(document);
  let favorites;
  try { const parsed = JSON.parse(read('sched.favorites', '[]')); favorites = Array.isArray(parsed) ? parsed.filter(f => f && typeof f.key === 'string' && typeof f.group === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(f.date)) : []; } catch (_) { favorites = []; }
  const storedGroup = read('sched.group', '');
  const query = new URLSearchParams(location.search);
  const requestedDate = query.get('date');
  const validDate = /^\d{4}-\d{2}-\d{2}$/.test(requestedDate || '') && C.iso(C.parse(requestedDate)) === requestedDate;
  const state = {
    group: data.groups[query.get('group')] ? query.get('group') : data.groups[storedGroup] ? storedGroup : 'ИБО-24',
    date: validDate ? requestedDate : C.moscowNow().key,
    filter: ['all','main','cbi'].includes(read('sched.filter','all')) ? read('sched.filter','all') : 'all',
    view:'schedule', query:'', theme:read('sched.theme', 'dark') === 'light' ? 'light' : 'dark',
    favorites, rendered:[], dialogKind:null, calendarMonth:null, dialogLesson:null
  };
  if (state.group === 'МК1') state.filter = 'all';
  let lastFocus = null, toastTimer;
  const lessonKey = (date, lesson) => `${state.group}|${date}|${lesson.time}|${lesson.subject}`;
  const saved = (date, lesson) => state.favorites.some(f => f.key === lessonKey(date, lesson));
  const pulse = () => { if (TG.available() && TG.atLeast('6.1')) TG.post('web_app_trigger_haptic_feedback', { type:'selection_change' }); };
  function toast(message) { $('toast').textContent = message; $('toast').classList.add('visible'); clearTimeout(toastTimer); toastTimer = setTimeout(() => $('toast').classList.remove('visible'), 3500); }
  function applyTheme() {
    document.documentElement.dataset.theme = state.theme;
    $('theme').innerHTML = icon(state.theme === 'dark' ? 'sun' : 'moon');
    $('theme').setAttribute('aria-label', state.theme === 'dark' ? 'Включить светлую тему' : 'Включить тёмную тему');
    const bg = state.theme === 'dark' ? '#0a1019' : '#eef3f8';
    document.querySelector('meta[name="theme-color"]').content = bg;
    if (TG.available()) {
      if (TG.atLeast('6.9')) TG.post('web_app_set_header_color', { color:bg });
      if (TG.atLeast('6.1')) TG.post('web_app_set_background_color', { color:bg });
      if (TG.atLeast('7.10')) TG.post('web_app_set_bottom_bar_color', { color:bg });
    }
  }
  function get(key, filter = state.filter) { return C.getDay(data, state.group, key, filter); }
  function weekDays() { const mon = C.monday(C.parse(state.date)); return Array.from({ length:7 }, (_,i) => C.iso(C.addDays(mon,i))); }
  function renderWeek() {
    const days = weekDays(), today = C.moscowNow().key;
    $('month-label').textContent = capital(format(state.date, { month:'long',year:'numeric' }).replace(' г.',''));
    $('week-strip').innerHTML = days.map((key,i) => {
      const day = get(key);
      return `<button class="day-button${key === state.date ? ' selected' : ''}${key === today ? ' is-today' : ''}" data-date="${key}" aria-label="${esc(fullDate(key))}" aria-pressed="${key === state.date}"${key === today ? ' aria-current="date"' : ''}><span class="day-name">${dayNames[i]}</span><span class="day-number">${C.parse(key).getDate()}</span><span class="day-pips">${day.lessons.slice(0,5).map(l => `<i class="${l.kind}"></i>`).join('')}</span></button>`;
    }).join('');
    const counts = days.map(key => get(key).lessons.length), total = counts.reduce((a,b) => a+b,0), max = Math.max(1,...counts);
    $('week-range').textContent = `${shortDate(days[0])} — ${shortDate(days[6])}`;
    $('week-total').textContent = total;
    $('week-chart').innerHTML = days.map((key,i) => `<button class="chart-column${key === state.date ? ' selected' : ''}" data-date="${key}" aria-label="${esc(fullDate(key))}, ${counts[i]} ${C.plural(counts[i])}"><i class="chart-bar" style="height:${Math.max(3,counts[i]/max*70)}px"></i><span>${dayNames[i]}</span></button>`).join('');
    $('week-duration').textContent = `${duration(days.reduce((n,key) => n + C.duration(get(key).lessons),0))} занятий за неделю`;
  }
  function renderHero() {
    const now = C.moscowNow(), day = get(state.date), isToday = state.date === now.key;
    let lesson = day.lessons.find(l => isToday && C.minutes(C.times(l)[0]) <= now.minute && C.minutes(C.times(l)[1]) > now.minute);
    const running = Boolean(lesson);
    if (!lesson) lesson = day.lessons.find(l => !isToday || C.minutes(C.times(l)[0]) > now.minute);
    let heading, status, meta = '', bottom = '';
    if (lesson) {
      status = running ? 'СЕЙЧАС НА ПАРЕ' : isToday ? 'СЛЕДУЮЩАЯ ПАРА' : state.date < now.key ? 'ИЗ АРХИВА · ' + shortDate(state.date).toUpperCase() : 'ПЛАН НА ' + shortDate(state.date).toUpperCase();
      heading = lesson.subject;
      meta = `<span>${icon('clock')}${esc(lesson.time.replace('-', ' — '))}</span><span>${icon('pin')}${esc(lesson.room || 'Аудитория не указана')}</span>`;
      bottom = running ? `До конца <b>${C.minutes(C.times(lesson)[1]) - now.minute} мин</b>` : isToday ? `До начала <b>${duration(C.minutes(C.times(lesson)[0]) - now.minute)}</b>` : `${esc(lesson.type)} · ${lesson.kind === 'cbi' ? 'ЦБИ' : esc(state.group)}`;
      $('hero').onclick = () => showLesson(state.date, lesson);
    } else {
      const done = isToday && day.lessons.length;
      status = done ? 'НА СЕГОДНЯ ВСЁ' : day.status === 'free' ? 'МОЖНО ВЫДОХНУТЬ' : 'ТВОЙ УЧЕБНЫЙ РИТМ';
      heading = done ? 'День завершён. Ты молодец.' : day.status === 'free' ? 'Время для своих планов.' : 'Новый день — новые планы.';
      meta = `<span>${icon('calendar')}${shortDate(state.date)}</span><span>${esc(state.group)}</span>`;
      bottom = done ? 'Все занятия на выбранный день закончились.' : day.status === 'free' ? 'В расписании на этот день пар нет.' : 'На выбранную дату пока нет занятий в этом разделе.';
      $('hero').onclick = null;
    }
    $('hero').innerHTML = `<div class="hero-content"><div class="hero-status">${running ? '<i class="live-dot"></i>' : icon('spark')}${status}</div><h2>${esc(heading)}</h2><div class="hero-meta">${meta}</div><div class="hero-bottom">${bottom}</div></div><div class="hero-orbit" aria-hidden="true"><div class="orbit-ring"></div><div class="orbit-ring"></div><div class="orbit-ring"></div><div class="orbit-core"></div><div class="orbit-satellite"></div></div>${lesson ? '<button class="hero-open" aria-label="Открыть ближайшее занятие"></button>' : ''}`;
  }
  function lessonHTML(date, lesson) {
    const index = state.rendered.push({ date, lesson }) - 1;
    const [start,end] = C.times(lesson), now = C.moscowNow();
    const live = date === now.key && now.minute >= C.minutes(start) && now.minute < C.minutes(end);
    const color = lesson.type === 'лекция' ? 'var(--mint)' : lesson.type === 'лабораторная' ? 'var(--violet)' : '#e4bd83';
    const isSaved = saved(date, lesson);
    return `<div class="lesson-layout"><div class="lesson-time"><strong>${start}</strong><span>${end}</span></div><article class="lesson-card${live ? ' live' : ''}" style="--lesson-color:${color}"><button class="lesson-main" data-lesson="${index}" aria-label="${esc(lesson.subject)}, ${esc(lesson.time)}, подробнее"><div class="lesson-top"><span class="type-tag">${esc(lesson.type || 'занятие')}</span><span>${esc(lesson.num)} пара</span>${lesson.kind === 'cbi' ? '<span class="source-tag">ЦБИ</span>' : ''}${live ? '<span class="live-label"><i class="live-dot"></i>Сейчас</span>' : ''}</div><h3>${esc(lesson.subject)}</h3><div class="lesson-meta">${lesson.room ? `<span>${icon('pin')}${esc(lesson.room)}</span>` : ''}${lesson.teacher ? `<span>${icon('user')}${esc(lesson.teacher)}</span>` : ''}</div>${live ? `<div class="progress-track"><i style="width:${Math.max(0,Math.min(100,(now.minute-C.minutes(start))/(C.minutes(end)-C.minutes(start))*100))}%"></i></div>` : ''}</button><button class="lesson-save${isSaved ? ' saved' : ''}" data-save="${index}" aria-pressed="${isSaved}" aria-label="${isSaved ? 'Убрать из избранного' : 'Добавить в избранное'}">${icon('bookmark')}</button></article></div>`;
  }
  function empty(title, message, action = '') { return `<div class="empty-state">${icon('calendar')}<h3>${title}</h3><p>${message}</p>${action}</div>`; }
  function matches(lesson) { return [lesson.subject,lesson.room,lesson.teacher,lesson.topic].join(' ').toLocaleLowerCase('ru').includes(state.query.trim().toLocaleLowerCase('ru')); }
  function renderLessons() {
    state.rendered = [];
    const day = get(state.date);
    $('day-title').textContent = state.view === 'saved' ? 'Сохранённые занятия' : capital(fullDate(state.date));
    let notices = '';
    if (state.view === 'saved') {
      const entries = [];
      state.favorites.filter(f => f.group === state.group).sort((a,b) => a.date.localeCompare(b.date)).forEach(f => {
        const lesson = C.getDay(data, f.group, f.date).lessons.find(l => lessonKey(f.date,l) === f.key);
        if (lesson && (state.filter === 'all' || lesson.kind === state.filter) && matches(lesson)) entries.push({date:f.date,lesson});
      });
      $('day-count').textContent = `${entries.length} ${C.plural(entries.length)}`;
      let previous = '';
      $('lessons').innerHTML = entries.map(({date,lesson}) => { const header = previous !== date ? `<div class="saved-date">${capital(fullDate(date))}</div>` : ''; previous = date; return header + lessonHTML(date,lesson); }).join('') || empty('Важное — всегда под рукой', state.query ? 'По этому запросу сохранённых занятий нет.' : 'Нажми на закладку у пары, чтобы сохранить её здесь.');
    } else {
      $('day-count').textContent = `${day.lessons.length} ${C.plural(day.lessons.length)}`;
      if (day.origin === 'cycle' && state.filter !== 'cbi') notices += '<div class="notice">Основа — <b>двухнедельный цикл</b> из предыдущего расписания. Изменения на эту дату не присланы.</div>';
      if (C.conflicts(day.lessons).length) notices += '<div class="notice conflict">Есть пересечение по времени. Открой детали и сверь основные пары с занятиями ЦБИ.</div>';
      const visible = day.lessons.filter(matches);
      if (!visible.length) {
        const known = Object.keys(data.groups[state.group].dates || {}).sort().reverse()[0];
        const title = state.query ? 'Ничего не нашлось' : day.status === 'free' ? 'Сегодня без пар' : day.status === 'filtered' ? 'В этом разделе пар нет' : 'Расписание ещё не добавлено';
        const message = state.query ? 'Попробуй другое название, преподавателя или номер аудитории.' : day.status === 'free' ? 'На выбранную дату в расписании нет занятий.' : state.filter === 'cbi' ? 'Занятия ЦБИ добавлены только на даты из исходной таблицы. Это не означает отмену.' : 'У нас пока нет подтверждённых данных на эту дату.';
        const emptyAction = !state.query && state.filter === 'cbi' ? '<button class="secondary-button" data-action="next-cbi">Ближайшее занятие ЦБИ</button>' : !state.query && day.status === 'nodata' && known ? `<button class="secondary-button" data-date="${known}">Последняя добавленная дата</button>` : '';
        $('lessons').innerHTML = empty(title,message,emptyAction);
      } else {
        let lastEnd = null;
        $('lessons').innerHTML = visible.map(lesson => {
          const [start,end] = C.times(lesson), gap = lastEnd === null ? 0 : C.minutes(start) - lastEnd;
          lastEnd = Math.max(lastEnd || 0,C.minutes(end));
          return `${gap >= 40 && !state.query ? `<div class="gap-label">Окно · ${duration(gap)}</div>` : ''}${lessonHTML(state.date,lesson)}`;
        }).join('');
      }
    }
    $('notice').innerHTML = notices;
  }
  function render() {
    $('group-name').textContent = state.group;
    $('group-avatar').textContent = state.group === 'МК1' ? 'МК' : 'ИБ';
    $('breadcrumb').textContent = state.view === 'saved' ? 'Избранное' : 'Расписание';
    $('page-title').innerHTML = state.view === 'saved' ? 'Важное — рядом<span>.</span>' : 'Всё по расписанию<span>.</span>';
    $('page-subtitle').textContent = state.view === 'saved' ? `Сохранённые занятия группы ${state.group}.` : 'Выбирай день. Остальное уже здесь.';
    $('current-date').textContent = shortDate(C.moscowNow().key);
    $('hero').hidden = state.view === 'saved';
    $('cbi-card').hidden = state.group !== 'ИБО-24';
    document.querySelectorAll('[data-view]').forEach(b => b.classList.toggle('active', b.dataset.view === state.view));
    document.querySelectorAll('[data-filter]').forEach(b => { b.classList.toggle('active', b.dataset.filter === state.filter); b.setAttribute('aria-pressed', b.dataset.filter === state.filter); b.hidden = state.group === 'МК1' && b.dataset.filter === 'cbi'; });
    $('week-strip').hidden = state.view === 'saved';
    document.querySelector('.week-heading').hidden = state.view === 'saved';
    $('search').placeholder = state.view === 'saved' ? 'Найти в избранном' : 'Найти предмет или аудиторию';
    renderWeek(); renderHero(); renderLessons();
  }
  function goTo(key) { state.date = key; state.view = 'schedule'; state.query = ''; $('search').value = ''; pulse(); render(); }
  function toggleSave(date,lesson) {
    const key = lessonKey(date,lesson), existed = saved(date,lesson);
    state.favorites = existed ? state.favorites.filter(f => f.key !== key) : [...state.favorites,{ key,date,group:state.group }];
    write('sched.favorites',JSON.stringify(state.favorites));
    pulse(); renderLessons(); toast(existed ? 'Убрано из избранного' : 'Добавлено в избранное');
    if (state.dialogKind === 'lesson') showLesson(date,lesson);
  }
  const dialog = $('dialog');
  function openDialog(kind,html) {
    state.dialogKind = kind;
    $('dialog-content').innerHTML = html;
    if (!dialog.open) { lastFocus = document.activeElement; dialog.showModal(); document.body.classList.add('modal-open'); }
    if (TG.available() && TG.atLeast('6.1')) TG.post('web_app_setup_back_button', { is_visible:true });
  }
  function closeDialog() {
    dialog.close(); state.dialogKind = null; document.body.classList.remove('modal-open');
    if (TG.available() && TG.atLeast('6.1')) TG.post('web_app_setup_back_button', { is_visible:false });
    if (lastFocus && document.contains(lastFocus)) lastFocus.focus();
  }
  function showGroups() {
    openDialog('groups',`<h2 id="dialog-title">Твоя группа. Твой ритм.</h2><p class="dialog-description">Выбери группу, и расписание будет под рукой.</p>${['ИБО-24','МК1'].map(name => `<button class="group-option${state.group === name ? ' current' : ''}" data-group="${name}"><span class="group-avatar">${name === 'МК1' ? 'МК' : 'ИБ'}</span><span><b>${name}</b><span>${esc(data.groups[name].subtitle)}</span></span>${state.group === name ? icon('check') : ''}</button>`).join('')}<p class="dialog-footnote">Выбор сохранится на этом устройстве. Группу можно сменить в любой момент.</p>`);
  }
  function showSources() {
    const keys = state.group === 'МК1' ? ['mk-nov','legacy'] : ['ibo-nov','cbi','legacy'];
    openDialog('sources',`<h2 id="dialog-title">Откуда расписание</h2><p class="dialog-description">${esc(state.group)} · обновлено 23 ноября 2026</p>${keys.map(key => `<section class="source-item"><h3>${esc(data.sources[key].title)}</h3><p>${esc(data.sources[key].description)}</p></section>`).join('')}<p class="dialog-footnote">Точные даты имеют приоритет над циклом. «Нет данных» и «Пар нет» — разные состояния. Время всех занятий — московское.</p>`);
  }
  function showLesson(date,lesson) {
    state.dialogLesson = {date,lesson};
    const row = (symbol,label,value) => `<div class="detail-row">${icon(symbol)}<div><small>${label}</small><p>${esc(value)}</p></div></div>`;
    openDialog('lesson',`<h2 id="dialog-title">${esc(lesson.subject)}</h2><div class="detail-tags"><span>${esc(lesson.type)}</span><span>${lesson.kind === 'cbi' ? 'ЦБИ' : esc(state.group)}</span></div>${row('calendar','Дата',capital(fullDate(date)) + ' ' + C.parse(date).getFullYear())}${row('clock','Время',lesson.time.replace('-',' — ') + ' · МСК')}${row('pin','Аудитория',lesson.room || 'Не указана в источнике')}${row('user','Преподаватель',lesson.teacher || 'Не указан в источнике')}${lesson.topic ? row('book','Тема занятия',lesson.topic) : ''}${row('layers','Источник',data.sources[lesson.source]?.title || 'Предыдущее расписание')}<button class="primary-button" data-action="save-detail">${icon('bookmark')}${saved(date,lesson) ? 'Убрать из избранного' : 'Сохранить занятие'}</button>`);
  }
  function showCalendar(month) {
    state.calendarMonth = month || C.parse(state.date);
    const first = new Date(state.calendarMonth.getFullYear(),state.calendarMonth.getMonth(),1,12), days = new Date(first.getFullYear(),first.getMonth()+1,0).getDate();
    openDialog('calendar',`<h2 id="dialog-title">Выбери день</h2><div class="calendar-header"><button class="icon-button" data-action="prev-month" aria-label="Предыдущий месяц">${icon('chevronLeft')}</button><b>${format(C.iso(first),{month:'long',year:'numeric'})}</b><button class="icon-button" data-action="next-month" aria-label="Следующий месяц">${icon('chevronRight')}</button></div><div class="calendar-grid">${dayNames.map(s => `<span class="cal-label">${s}</span>`).join('')}${'<span></span>'.repeat(C.dayIndex(first))}${Array.from({length:days},(_,i) => { const key = C.iso(C.addDays(first,i)), known = get(key).lessons.length; return `<button data-calendar-date="${key}" class="${key === state.date ? 'selected' : ''}${!known ? ' cal-missing' : ''}" aria-label="${esc(fullDate(key))}${known ? ', есть занятия' : ''}">${i+1}<i class="${known ? 'cal-dot' : ''}"></i></button>`; }).join('')}</div><p class="calendar-legend">Точкой отмечены дни с занятиями в выбранном разделе.</p>`);
  }
  function nextCbi() {
    const today = C.moscowNow().key;
    const key = Object.keys(data.groups['ИБО-24'].extra).sort().find(key => key >= today);
    if (!key) { toast('Новых дат ЦБИ пока нет в расписании'); return; }
    state.filter = 'cbi'; write('sched.filter',state.filter); goTo(key);
  }
  function exportWeek() {
    const events = weekDays().flatMap(date => get(date).lessons.map(lesson => ({date,lesson})));
    if (!events.length) { toast('На этой неделе нет занятий для экспорта'); return; }
    const url = URL.createObjectURL(new Blob([C.ics(events,state.group)],{type:'text/calendar;charset=utf-8'}));
    const a = document.createElement('a'); a.href = url; a.download = `${state.group}-${weekDays()[0]}.ics`; document.body.appendChild(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(url),60000);
    toast('Файл календаря подготовлен');
  }
  const actions = { groups:showGroups, sources:showSources, close:closeDialog, calendar:() => showCalendar(), today:() => goTo(C.moscowNow().key), 'prev-week':() => goTo(C.iso(C.addDays(C.parse(state.date),-7))), 'next-week':() => goTo(C.iso(C.addDays(C.parse(state.date),7))), 'next-cbi':nextCbi, export:exportWeek, 'prev-month':() => showCalendar(new Date(state.calendarMonth.getFullYear(),state.calendarMonth.getMonth()-1,1,12)), 'next-month':() => showCalendar(new Date(state.calendarMonth.getFullYear(),state.calendarMonth.getMonth()+1,1,12)), 'save-detail':() => toggleSave(state.dialogLesson.date,state.dialogLesson.lesson) };
  document.addEventListener('click', e => {
    const b = e.target.closest('button');
    if (!b) return;
    if (b.dataset.action && actions[b.dataset.action]) { actions[b.dataset.action](); return; }
    if (b.dataset.group) { state.group=b.dataset.group; state.filter='all'; state.view='schedule'; state.query=''; $('search').value=''; write('sched.group',state.group); write('sched.filter',state.filter); closeDialog(); pulse(); render(); return; }
    if (b.dataset.calendarDate) { closeDialog(); goTo(b.dataset.calendarDate); return; }
    if (b.dataset.date) { goTo(b.dataset.date); return; }
    if (b.dataset.filter) { state.filter=b.dataset.filter; write('sched.filter',state.filter); pulse(); render(); return; }
    if (b.dataset.view) { state.view=b.dataset.view; state.query=''; $('search').value=''; render(); return; }
    if (b.dataset.lesson !== undefined) { const item=state.rendered[Number(b.dataset.lesson)]; if(item) showLesson(item.date,item.lesson); return; }
    if (b.dataset.save !== undefined) { const item=state.rendered[Number(b.dataset.save)]; if(item) toggleSave(item.date,item.lesson); }
  });
  $('theme').addEventListener('click', () => { state.theme=state.theme === 'dark' ? 'light' : 'dark'; write('sched.theme',state.theme); applyTheme(); });
  $('search').addEventListener('input', e => { state.query=e.target.value; renderLessons(); });
  document.querySelector('.brand').addEventListener('click', e => { e.preventDefault(); state.view='schedule'; render(); });
  dialog.addEventListener('cancel', e => { e.preventDefault(); closeDialog(); });
  dialog.addEventListener('click', e => { if (e.target === dialog) { const r=dialog.getBoundingClientRect(); if (e.clientX<r.left || e.clientX>r.right || e.clientY<r.top || e.clientY>r.bottom) closeDialog(); } });
  document.addEventListener('keydown', e => { if(e.key==='/' && !dialog.open && !['INPUT','TEXTAREA'].includes(document.activeElement.tagName)) { e.preventDefault(); $('search').focus(); } });
  let touchStart = null;
  $('lessons').addEventListener('touchstart', e => { if(e.touches.length===1) touchStart={x:e.touches[0].clientX,y:e.touches[0].clientY}; },{passive:true});
  $('lessons').addEventListener('touchend', e => { if(!touchStart || state.view!=='schedule' || dialog.open) return; const dx=e.changedTouches[0].clientX-touchStart.x,dy=e.changedTouches[0].clientY-touchStart.y; touchStart=null; if(Math.abs(dx)>75 && Math.abs(dx)>Math.abs(dy)*1.7) goTo(C.iso(C.addDays(C.parse(state.date),dx<0?1:-1))); },{passive:true});
  TG.on('back_button_pressed',closeDialog);
  const insets = { hardware:{},content:{} };
  function safeArea(kind,d) { if(!d)return; insets[kind]=d; for(const edge of ['top','bottom']) document.documentElement.style.setProperty(`--safe-${edge}`,`${Math.max(0,Number(insets.hardware[edge])||0,Number(insets.content[edge])||0)}px`); }
  TG.on('content_safe_area_changed',d => safeArea('content',d));
  TG.on('safe_area_changed',d => safeArea('hardware',d));
  TG.on('theme_changed', d => { if(!read('sched.theme','') && d?.theme_params?.bg_color) { const hex=d.theme_params.bg_color.replace('#',''); state.theme=parseInt(hex.slice(0,2),16)>150?'light':'dark'; applyTheme(); } });
  if(TG.available()) { TG.post('web_app_ready'); TG.post('web_app_expand'); if(TG.atLeast('8.0')) { TG.post('web_app_request_safe_area'); TG.post('web_app_request_content_safe_area'); } }
  applyTheme(); render();
  if(!storedGroup && !query.get('group')) showGroups();
  let lastToday = C.moscowNow().key;
  function tick() { const now=C.moscowNow(); if(now.key!==lastToday){ if(state.date===lastToday) state.date=now.key;lastToday=now.key; if(!dialog.open && !document.hidden) { render(); return; } } if(!dialog.open && !document.hidden) { renderHero(); renderLessons(); $('current-date').textContent=shortDate(now.key); } }
  setInterval(tick,30000);
  document.addEventListener('visibilitychange', () => { document.documentElement.classList.toggle('paused',document.hidden); if(!document.hidden) tick(); });
})();
