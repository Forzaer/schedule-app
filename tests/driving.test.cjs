const { test } = require('node:test');
const assert = require('node:assert/strict');
const D = require('../src/driving.js');

function example() {
  return {
    progress: { sessions: 4, approximate: true, city: 2, minutes: null, goal: 1200 },
    lessons: [
      { id: 'book-a', date: '2027-01-12', start: '10:00', end: '11:30', number: 5, place: 'unknown', done: false },
      { id: 'book-b', date: '2027-01-15', start: '14:00', end: '15:00', number: 9, place: 'city', done: false }
    ]
  };
}

test('bookings do not count toward progress until marked as completed', () => {
  const data = example();
  const now = { key: '2027-01-12', minute: 11 * 60 + 30 };
  assert.equal(D.sections(data, now).pending[0].id, 'book-a');
  assert.equal(D.sections(data, now).upcoming[0].id, 'book-b');
  assert.equal(D.summary(data).sessions, 4);
  assert.equal(D.summary(data).remaining, null);

  data.lessons[1].done = true;
  assert.equal(D.summary(data).sessions, 5);
  assert.equal(D.summary(data).city, 3);
  assert.equal(D.summary(data).loggedMinutes, 60);
  assert.equal(D.summary(data).remaining, null);
  data.progress.minutes = 300;
  assert.equal(D.summary(data).remaining, 840);
});

test('personal transfer round-trips and repeated import keeps local progress and edits', () => {
  const incoming = example();
  assert.deepEqual(D.decode(D.encode(incoming)), incoming);
  const local = D.decode(D.encode(incoming));
  local.progress.sessions = 5;
  local.lessons[0].start = '10:15';
  local.lessons[0].done = true;
  assert.deepEqual(D.merge(local, incoming), local);
  assert.equal(D.decode('drive1.abcd'), null);
  assert.equal(D.validLesson({ ...incoming.lessons[0], date: '2027-02-30' }), false);
  assert.equal(D.validLesson({ ...incoming.lessons[0], end: '09:59' }), false);
});

test('school transfer adds Cyrillic contacts and balances without replacing existing progress or lessons', () => {
  const previous = example();
  const olderCode = D.encode(previous);
  assert.match(olderCode, /^drive1\./);
  const school = {
    balances: { practice: 12.5, roadExam: 1, internalExam: null },
    instructor: { name: 'Анна Ивановна', phone: '+7 (900) 000-00-00' },
    vehicle: { name: 'Учебная машина', plate: 'А123БВ 77' },
    manager: { name: 'Менеджер', phone: '' }
  };
  const update = { ...example(), school };
  const code = D.encode(update);
  assert.match(code, /^drive2\./);
  assert.deepEqual(D.decode(code), update);
  previous.progress.sessions = 6;
  previous.lessons[0].done = true;
  const merged = D.merge(previous, D.decode(code));
  assert.deepEqual(merged.progress, previous.progress);
  assert.deepEqual(merged.lessons, previous.lessons);
  assert.deepEqual(merged.school, school);
  assert.deepEqual(D.merge(merged, D.decode(olderCode)).school, school);
  assert.equal(D.phoneHref(school.instructor.phone), 'tel:+79000000000');
  assert.equal(D.phoneHref('javascript:123456789'), '');
  assert.equal(D.validSchool({ ...school, balances: { ...school.balances, practice: -1 } }), false);
});
