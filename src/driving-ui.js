(function () {
  'use strict';
  const C = window.ScheduleCore;
  const D = window.ScheduleDriving;
  const storageKey = 'sched.driving.v1';
  const places = { unknown: 'Место уточняется', city: 'Город', course: 'Площадка' };
  const formatDate = key => {
    const formatted = C.parse(key).toLocaleDateString('ru-RU', { weekday: 'long', day: 'numeric', month: 'long' });
    return formatted.charAt(0).toUpperCase() + formatted.slice(1);
  };
  const formatDuration = minutes => {
    const hours = Math.floor(minutes / 60);
    const remainder = minutes % 60;
    return [hours ? hours + ' ч' : '', remainder || !hours ? remainder + ' мин' : ''].filter(Boolean).join(' ');
  };

  function mount({ container, dialog, openDialog, closeDialog, toast, icon, escape }) {
    let stored = null;
    try {
      const parsed = JSON.parse(localStorage.getItem(storageKey));
      if (D.valid(parsed)) stored = parsed;
    } catch (_) {}
    const current = () => stored || D.empty();

    function showError(message) {
      const target = dialog.querySelector('.drive-error');
      if (target) target.textContent = message;
    }

    function save(next, message) {
      if (!D.valid(next)) {
        showError('Проверьте значения полей и время занятия. На одно время можно сохранить одну запись.');
        return;
      }
      try {
        localStorage.setItem(storageKey, JSON.stringify(next));
      } catch (_) {
        showError('Не удалось сохранить данные. Проверьте, разрешено ли хранение данных в браузере.');
        return;
      }
      stored = next;
      closeDialog();
      render();
      toast(message);
    }

    function lessonTitle(lesson) {
      return lesson.number === null ? 'Занятие по вождению' : 'Запись №' + lesson.number;
    }

    function lessonCard(lesson, featured = false) {
      const feature = featured ? ' drive-next' : '';
      return `<button type="button" class="drive-lesson glass${feature}" data-driving-edit="${escape(lesson.id)}">
        <span class="drive-lesson-icon">${icon(featured ? 'car' : 'calendar')}</span>
        <span class="drive-lesson-content">
          <strong>${formatDate(lesson.date)}</strong>
          <span class="drive-time">${lesson.start}–${lesson.end} · ${formatDuration(D.duration(lesson))}</span>
          <span class="drive-booking">${lessonTitle(lesson)} · ${places[lesson.place]}</span>
        </span>
        <span class="drive-more">${icon('chevronRight')}</span>
      </button>`;
    }

    function historySection(title, lessons) {
      if (!lessons.length) return '';
      return `<section class="drive-history"><h2>${title}</h2><div class="drive-list">${lessons.map(l => lessonCard(l)).join('')}</div></section>`;
    }

    function clockProgress(p) {
      if (p.minutes === null) {
        const logged = p.loggedMinutes ? ` · по новым записям ${formatDuration(p.loggedMinutes)}` : '';
        return `<p class="drive-meter-note">Пройденные часы пока не указаны${logged}.</p>`;
      }
      if (p.goal === null) return '';
      const note = p.remaining ? 'Осталось ' + formatDuration(p.remaining) : 'Норма выполнена';
      return `<progress class="drive-meter" max="${p.goal}" value="${Math.min(p.minutes, p.goal)}" aria-label="Прогресс часов"></progress><p class="drive-meter-note">${note}</p>`;
    }

    function render() {
      const data = current();
      const { upcoming, pending, completed } = D.sections(data, C.moscowNow());
      const p = D.summary(data);
      const hourTotal = p.minutes === null ? '—' : formatDuration(p.minutes);
      const goal = p.goal === null ? 'Учтено часов' : 'Норма ' + formatDuration(p.goal);
      const emptyText = stored ? 'Добавьте запись, когда инструктор подтвердит время.' : 'Добавьте первое занятие или загрузите готовые записи по коду.';
      container.innerHTML = `
        <div class="page-heading drive-heading">
          <div><h1 id="driving-title">Вождение<span>.</span></h1><p>Занятия по записи · время по Москве</p></div>
          <button type="button" class="primary-button drive-add" data-driving="add">${icon('plus')}<span>Добавить занятие</span></button>
        </div>
        <div class="drive-grid">
          <div class="drive-sessions">
            <section>
              <h2>Ближайшее занятие</h2>
              ${upcoming.length ? lessonCard(upcoming[0], true) : `<div class="drive-empty glass"><strong>Нет запланированных занятий</strong><p>${emptyText}</p></div>`}
            </section>
            ${historySection('Другие записи', upcoming.slice(1))}
            ${historySection('Нужно отметить', pending)}
            ${historySection('Пройденные занятия', completed)}
          </div>
          <div class="drive-side">
            <section class="drive-progress glass">
              <div class="drive-panel-header"><h2>Прогресс курса</h2><button type="button" class="icon-button" data-driving="progress" aria-label="Изменить прогресс">${icon('edit')}</button></div>
              <dl class="drive-metrics">
                <div><dt>Пройдено занятий</dt><dd>${p.approximate ? '≈' : ''}${p.sessions}</dd></div>
                <div><dt>Выезды в город</dt><dd>${p.city}</dd></div>
                <div><dt>${goal}</dt><dd>${hourTotal}</dd></div>
              </dl>
              ${clockProgress(p)}
            </section>
            <div class="drive-transfer">
              <p>Записи сохраняются на этом устройстве.</p>
              <button type="button" class="secondary-button" data-driving="import">Ввести код</button>
              ${stored ? '<button type="button" class="secondary-button" data-driving="export">Код для переноса</button>' : ''}
            </div>
          </div>
        </div>`;
    }

    function editLesson(lesson) {
      const l = lesson || {
        id: 'lesson_' + Date.now().toString(36),
        date: C.moscowNow().key, start: '', end: '', number: null, place: 'unknown', done: false
      };
      openDialog('driving-lesson', `
        <h2 id="dialog-title">${lesson ? lessonTitle(l) : 'Добавить занятие'}</h2>
        <form class="drive-form">
          <label>Дата<input type="date" name="date" min="2000-01-01" max="2099-12-31" required value="${l.date}"></label>
          <div class="drive-form-pair">
            <label>Начало<input type="time" name="start" required value="${l.start}"></label>
            <label>Окончание<input type="time" name="end" required value="${l.end}"></label>
          </div>
          <div class="drive-form-pair">
            <label>Номер записи<input type="number" name="number" min="1" max="9999" value="${l.number ?? ''}"></label>
            <label>Место<select name="place">${Object.entries(places).map(([key, label]) =>
              `<option value="${key}"${l.place === key ? ' selected' : ''}>${label}</option>`).join('')}</select></label>
          </div>
          <label class="drive-check"><input type="checkbox" name="done"${l.done ? ' checked' : ''}>Занятие пройдено</label>
          <p class="drive-error" role="alert"></p>
          <button type="submit" class="primary-button">Сохранить занятие</button>
          ${lesson ? '<button type="button" class="text-button drive-remove">Удалить запись</button>' : ''}
        </form>`);
      const form = dialog.querySelector('.drive-form');
      form.addEventListener('submit', event => {
        event.preventDefault();
        const fields = new FormData(form);
        const updated = {
          id: l.id, date: fields.get('date'), start: fields.get('start'), end: fields.get('end'),
          number: fields.get('number') === '' ? null : Number(fields.get('number')),
          place: fields.get('place'), done: fields.has('done')
        };
        if (!D.validLesson(updated)) { showError('Укажите дату и время. Окончание должно быть позже начала.'); return; }
        const data = current();
        save({ ...data, lessons: [...data.lessons.filter(item => item.id !== l.id), updated] }, 'Занятие сохранено');
      });
      const remove = form.querySelector('.drive-remove');
      if (remove) remove.addEventListener('click', () => {
        openDialog('driving-remove', `<h2 id="dialog-title">Удалить запись?</h2>
          <p class="dialog-description">${lessonTitle(l)} · ${formatDate(l.date)} · ${l.start}–${l.end}</p>
          <p class="drive-error" role="alert"></p>
          <button type="button" class="primary-button drive-confirm-remove">Удалить</button>
          <button type="button" class="secondary-button" data-action="close">Отмена</button>`);
        dialog.querySelector('.drive-confirm-remove').addEventListener('click', () => {
          const data = current();
          save({ ...data, lessons: data.lessons.filter(item => item.id !== l.id) }, 'Запись удалена');
        });
      });
    }

    function editProgress() {
      const p = current().progress;
      openDialog('driving-progress', `<h2 id="dialog-title">Прогресс курса</h2>
        <p class="dialog-description">Укажите прогресс за занятия до начала этого журнала. Записи, отмеченные пройденными здесь, прибавятся автоматически.</p>
        <form class="drive-form">
          <div class="drive-form-pair">
            <label>Пройдено занятий<input type="number" name="sessions" min="0" max="999" required value="${p.sessions}"></label>
            <label>Из них в городе<input type="number" name="city" min="0" max="999" required value="${p.city}"></label>
          </div>
          <label class="drive-check"><input type="checkbox" name="approximate"${p.approximate ? ' checked' : ''}>Количество занятий приблизительное</label>
          <div class="drive-form-pair">
            <label>Ранее пройдено, ч<input type="number" name="hours" min="0" max="1000" value="${p.minutes === null ? '' : Math.floor(p.minutes / 60)}"></label>
            <label>Дополнительно, мин<input type="number" name="minutes" min="0" max="59" value="${p.minutes === null ? '' : p.minutes % 60}"></label>
          </div>
          <label>Норма курса, ч<input type="number" name="goal" min="0.1" max="1000" step="0.1" value="${p.goal === null ? '' : p.goal / 60}"></label>
          <p class="drive-error" role="alert"></p>
          <button type="submit" class="primary-button">Сохранить прогресс</button>
        </form>`);
      const form = dialog.querySelector('.drive-form');
      form.addEventListener('submit', event => {
        event.preventDefault();
        const fields = new FormData(form);
        const sessions = Number(fields.get('sessions'));
        const city = Number(fields.get('city'));
        if (city > sessions) { showError('Выездов в город должно быть не больше, чем пройденных занятий.'); return; }
        const hours = fields.get('hours');
        const minutes = fields.get('minutes');
        const goal = fields.get('goal');
        const progress = {
          sessions, city, approximate: fields.has('approximate'),
          minutes: hours === '' && minutes === '' ? null : Number(hours) * 60 + Number(minutes),
          goal: goal === '' ? null : Math.round(Number(goal) * 60)
        };
        save({ ...current(), progress }, 'Прогресс сохранён');
      });
    }

    function showImport(code = '') {
      const imported = D.decode(code);
      const explanation = imported
        ? `Записей в коде: ${imported.lessons.length}. ${stored ? 'Текущий прогресс и совпадающие записи сохранятся.' : 'Записи и прогресс сохранятся на этом устройстве.'}`
        : 'Вставьте код с другого устройства или из сообщения с вашим расписанием.';
      openDialog('driving-import', `<h2 id="dialog-title">Загрузить записи</h2>
        <p class="dialog-description">${explanation}</p>
        <form class="drive-form">
          <label>Код расписания<textarea name="code" required maxlength="65000" rows="3" spellcheck="false" autocapitalize="off">${imported ? escape(code.trim()) : ''}</textarea></label>
          <p class="drive-error" role="alert"></p>
          <button type="submit" class="primary-button">Загрузить</button>
        </form>`);
      const form = dialog.querySelector('.drive-form');
      form.addEventListener('submit', event => {
        event.preventDefault();
        const incoming = D.decode(new FormData(form).get('code'));
        if (!incoming) { showError('Код не распознан. Скопируйте его целиком.'); return; }
        save(D.merge(stored, incoming), 'Записи загружены');
      });
    }

    function showExport() {
      const code = D.encode(current());
      openDialog('driving-export', `<h2 id="dialog-title">Код для переноса</h2>
        <p class="dialog-description">Скопируйте код и вставьте его в разделе «Вождение» на другом устройстве.</p>
        <div class="drive-form"><label>Код расписания<textarea readonly rows="4" spellcheck="false">${escape(code)}</textarea></label>
        <button type="button" class="primary-button drive-copy">Скопировать код</button></div>`);
      dialog.querySelector('.drive-copy').addEventListener('click', async () => {
        try {
          await navigator.clipboard.writeText(code);
          closeDialog();
          toast('Код скопирован');
        } catch (_) {
          const field = dialog.querySelector('textarea');
          field.focus();
          field.select();
        }
      });
    }

    const actions = { add: () => editLesson(), progress: editProgress, import: () => showImport(), export: showExport };
    container.addEventListener('click', event => {
      const button = event.target.closest('button');
      if (!button) return;
      if (button.dataset.drivingEdit) {
        const lesson = current().lessons.find(l => l.id === button.dataset.drivingEdit);
        if (lesson) editLesson(lesson);
      } else if (actions[button.dataset.driving]) {
        actions[button.dataset.driving]();
      }
    });
    return { render, showImport };
  }
  window.ScheduleDrivingUI = { mount };
})();
