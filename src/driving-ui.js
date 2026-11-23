(function () {
  'use strict';
  const C = window.ScheduleCore;
  const D = window.ScheduleDriving;
  const storageKey = 'sched.driving.v1';
  const places = { unknown: 'Место уточняется', city: 'Город', course: 'Площадка' };
  const balances = {
    practice: { label: 'Практическое вождение', icon: 'car' },
    roadExam: { label: 'Экзамен в ГИБДД', icon: 'shield' },
    internalExam: { label: 'Внутренний экзамен', icon: 'check' }
  };
  const profiles = {
    instructor: { label: 'Основной инструктор', icon: 'user' },
    vehicle: { label: 'Учебная машина', icon: 'car' },
    manager: { label: 'Ваш менеджер', icon: 'phone' }
  };
  const hourValue = value => new Intl.NumberFormat('ru-RU', { maximumFractionDigits: 2 }).format(value);
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

    function schoolDashboard(school) {
      if (!school) {
        return `<section class="drive-school-empty glass" aria-label="Автошкола">
          <span class="drive-lesson-icon">${icon('wallet')}</span>
          <div><h2>Автошкола</h2><p>Балансы, учебная машина и контакты.</p></div>
          <button type="button" class="secondary-button" data-driving="school">Настроить</button>
        </section>`;
      }

      const balanceCards = Object.entries(balances).map(([key, meta]) => {
        const value = school.balances[key];
        return `<button type="button" class="school-balance glass school-balance-${key}" data-school-balance="${key}">
          <span class="school-balance-icon">${icon(meta.icon)}</span>
          <strong>${value === null ? '—' : hourValue(value)}${value === null ? '' : '<small>ч</small>'}</strong>
          <span class="school-balance-label">${meta.label}</span>
        </button>`;
      }).join('');

      const contactCards = Object.entries(profiles).map(([key, meta]) => {
        const entry = school[key];
        const value = key === 'vehicle' ? entry.plate : entry.phone;
        return `<button type="button" class="school-profile glass" data-school-profile="${key}">
          <span class="school-profile-icon">${icon(meta.icon)}</span>
          <span class="school-profile-info"><span class="school-profile-role">${meta.label}</span>
            ${entry.name ? `<strong>${escape(entry.name)}</strong>` : ''}
            ${value ? `<span class="school-profile-value${key === 'vehicle' ? ' school-plate' : ''}">${escape(value)}</span>` : '<span class="school-profile-value">Добавить данные</span>'}
          </span>
          <span class="school-profile-open">${icon('chevronRight')}</span>
        </button>`;
      }).join('');

      return `<section class="drive-school" aria-labelledby="drive-school-title">
        <div class="school-heading">
          <div><h2 id="drive-school-title">Автошкола</h2><p>Остатки на балансах и контакты</p></div>
          <button type="button" class="icon-button" data-driving="school" aria-label="Изменить данные автошколы">${icon('edit')}</button>
        </div>
        <div class="school-balances" aria-label="Остатки на балансах">${balanceCards}</div>
        <div class="school-profiles">${contactCards}</div>
      </section>`;
    }

    function editSchool(focusField = '') {
      const school = current().school || D.emptySchool();
      const textField = (label, name, value, max, type = 'text') =>
        `<label>${label}<input type="${type}" name="${name}" maxlength="${max}" value="${escape(value)}"></label>`;
      openDialog('driving-school', `
        <h2 id="dialog-title">Данные автошколы</h2>
        <p class="dialog-description">Введите остатки из кабинета автошколы. Они сохраняются отдельно от прогресса курса.</p>
        <form class="drive-form">
          <fieldset class="school-fields"><legend>Остатки, ч</legend>
            ${Object.entries(balances).map(([key, meta]) => `<label>${meta.label}
              <input type="number" name="${key}" min="0" max="1000" step="any" inputmode="decimal" value="${school.balances[key] ?? ''}"></label>`).join('')}
          </fieldset>
          <fieldset class="school-fields"><legend>Инструктор</legend>
            ${textField('Имя', 'instructor-name', school.instructor.name, 90)}
            ${textField('Телефон', 'instructor-phone', school.instructor.phone, 32, 'tel')}
          </fieldset>
          <fieldset class="school-fields"><legend>Машина</legend>
            ${textField('Марка и модель', 'vehicle-name', school.vehicle.name, 70)}
            ${textField('Госномер', 'vehicle-plate', school.vehicle.plate, 24)}
          </fieldset>
          <fieldset class="school-fields"><legend>Менеджер</legend>
            ${textField('Имя или должность', 'manager-name', school.manager.name, 90)}
            ${textField('Телефон', 'manager-phone', school.manager.phone, 32, 'tel')}
          </fieldset>
          <p class="drive-error" role="alert"></p>
          <button type="submit" class="primary-button">Сохранить данные</button>
        </form>`);
      const form = dialog.querySelector('.drive-form');
      if (focusField) form.elements.namedItem(focusField)?.focus();
      form.addEventListener('submit', event => {
        event.preventDefault();
        const fields = new FormData(form);
        const field = key => fields.get(key).trim();
        const contact = key => ({ name: field(key + '-name'), phone: field(key + '-phone') });
        const details = {
          balances: Object.fromEntries(Object.keys(balances).map(key => [key, field(key) === '' ? null : Number(field(key))])),
          instructor: contact('instructor'),
          vehicle: { name: field('vehicle-name'), plate: field('vehicle-plate') },
          manager: contact('manager')
        };
        if (!D.validSchool(details)) {
          showError('Проверьте номер телефона и значения балансов. Пустые поля можно оставить.');
          return;
        }
        save({ ...current(), school: details }, 'Данные автошколы сохранены');
      });
    }

    function showSchoolProfile(key) {
      const entry = current().school[key];
      const vehicle = key === 'vehicle';
      const value = vehicle ? entry.plate : entry.phone;
      const tel = vehicle ? '' : D.phoneHref(value);
      const itemName = vehicle ? 'Госномер' : 'Телефон';
      openDialog('driving-profile', `
        <div class="school-profile-dialog">
          <span class="school-profile-icon">${icon(profiles[key].icon)}</span>
          <p class="dialog-description">${profiles[key].label}</p>
          <h2 id="dialog-title">${escape(entry.name || profiles[key].label)}</h2>
        </div>
        <div class="drive-form">
          ${value ? `<label>${itemName}<input class="school-copy-value" type="text" readonly value="${escape(value)}"></label>` : ''}
          ${tel ? `<a class="primary-button" href="${tel}">${icon('phone')}Позвонить</a>` : ''}
          ${value ? `<button type="button" class="secondary-button school-copy">Скопировать ${itemName.toLowerCase()}</button>` : ''}
          <button type="button" class="text-button school-edit-profile">Изменить</button>
        </div>`);
      dialog.querySelector('.school-edit-profile').addEventListener('click', () => editSchool(key + '-name'));
      const copyButton = dialog.querySelector('.school-copy');
      if (copyButton) copyButton.addEventListener('click', async () => {
        try {
          await navigator.clipboard.writeText(value);
          if (dialog.open && dialog.contains(copyButton)) copyButton.textContent = 'Скопировано';
        } catch (_) {
          const field = dialog.querySelector('.school-copy-value');
          if (field) { field.focus(); field.select(); }
        }
      });
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
        ${schoolDashboard(data.school)}
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
        ? `Записей в коде: ${imported.lessons.length}. ${imported.school ? 'Балансы и контакты автошколы будут обновлены. ' : ''}${stored ? 'Текущий прогресс и совпадающие записи сохранятся.' : 'Данные сохранятся на этом устройстве.'}`
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
        save(D.merge(stored, incoming), incoming.school ? 'Данные автошколы загружены' : 'Записи загружены');
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

    const actions = { add: () => editLesson(), school: () => editSchool(), progress: editProgress, import: () => showImport(), export: showExport };
    container.addEventListener('click', event => {
      const button = event.target.closest('button');
      if (!button) return;
      if (button.dataset.drivingEdit) {
        const lesson = current().lessons.find(l => l.id === button.dataset.drivingEdit);
        if (lesson) editLesson(lesson);
      } else if (button.dataset.schoolBalance) {
        editSchool(button.dataset.schoolBalance);
      } else if (button.dataset.schoolProfile) {
        showSchoolProfile(button.dataset.schoolProfile);
      } else if (actions[button.dataset.driving]) {
        actions[button.dataset.driving]();
      }
    });
    return { render, showImport };
  }
  window.ScheduleDrivingUI = { mount };
})();
