const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const C = require('../src/core.js');
const data = require('../src/schedule.json');
test('МК1: вся неделя 23–28 ноября внесена по фотографиям без повторения на будущие недели', () => {
  assert.deepEqual(['23','24','25','26','27','28'].map(d => C.getDay(data,'МК1',`2026-11-${d}`).lessons.length),[4,3,4,2,3,3]);
  const wed = C.getDay(data,'МК1','2026-11-25').lessons;
  assert.equal(wed[0].time,'10:50-12:20');
  assert.equal(wed[3].room,'СП № 5, 302');
  assert.equal(C.getDay(data,'МК1','2026-12-05').status,'nodata');
  assert.equal(C.getDay(data,'МК1','2026-10-24').lessons.length,3);
});
test('ИБО-24: семь точных дат совпадают со скриншотами, исторические даты сохранены', () => {
  assert.deepEqual(['14','16','17','18','20','21','23'].map(d => C.getDay(data,'ИБО-24',`2026-11-${d}`).lessons.length),[3,4,4,3,3,2,4]);
  assert.equal(C.getDay(data,'ИБО-24','2026-11-23').origin,'dated');
  assert.equal(C.getDay(data,'ИБО-24','2026-11-23').lessons[2].room,'1212');
  assert.equal(C.getDay(data,'ИБО-24','2026-11-16').lessons[2].room,'1204');
  assert.equal(C.getDay(data,'ИБО-24','2026-10-05').lessons.length,4);
});
test('ЦБИ: точные даты не дублируют extra и сохраняют исходные темы и преподавателей', () => {
  assert.equal(Object.keys(data.groups['ИБО-24'].extra).length,26);
  const friday = C.getDay(data,'ИБО-24','2026-11-20');
  assert.equal(friday.lessons.filter(l => l.kind === 'cbi').length,1);
  const cbi = C.getDay(data,'ИБО-24','2026-11-20','cbi').lessons[0];
  assert.match(cbi.topic,/Формирование набора мер/);
  assert.ok(cbi.teacher);
  assert.equal(cbi.time,'10:00-13:00');
  assert.equal(C.getDay(data,'ИБО-24','2026-11-25','cbi').lessons.length,2);
  assert.equal(C.getDay(data,'ИБО-24','2026-12-02','cbi').lessons.length,0);
  assert.equal(C.getDay(data,'ИБО-24','2026-11-20','main').lessons.length,2);
});
test('Существующий двухнедельный цикл остаётся основой, пустой день отличается от неизвестного', () => {
  assert.equal(C.getDay(data,'ИБО-24','2026-11-30').lessons[2].room,'1204');
  assert.equal(C.getDay(data,'ИБО-24','2026-12-07').lessons[2].room,'1212');
  assert.equal(C.getDay(data,'ИБО-24','2026-11-22').status,'free');
  assert.equal(C.getDay(data,'МК1','2026-11-22').status,'nodata');
});
test('Московское время корректно меняет дату независимо от часового пояса устройства', () => {
  assert.deepEqual(C.moscowNow(new Date('2026-11-22T22:05:00Z')),{ key:'2026-11-23',minute:65 });
  assert.deepEqual(C.moscowNow(new Date('2026-11-23T06:00:00Z')),{ key:'2026-11-23',minute:540 });
});
test('Экспорт ICS: московское время конвертируется в UTC, длинные русские строки корректно переносятся', () => {
  const date = '2026-11-17', lesson = C.getDay(data,'ИБО-24',date).lessons[1];
  const text = C.ics([{date,lesson}],'ИБО-24',new Date('2026-11-23T07:00:00Z'));
  assert.match(text,/DTSTART:20261117T111000Z/);
  assert.match(text,/DTEND:20261117T124000Z/);
  for (const line of text.split('\r\n')) assert.ok(Buffer.byteLength(line)<=75);
  assert.match(text.replace(/\r\n /g,''),new RegExp(lesson.subject));
  assert.ok(!text.includes('RRULE'));
});
test('Обнаруживаются реальные пересечения, соседние пары не считаются конфликтом', () => {
  const list = [{time:'09:00-10:30'},{time:'10:30-12:00'},{time:'10:00-11:00'}];
  assert.equal(C.conflicts(list).length,3);
  assert.equal(C.conflicts(list.slice(0,2)).length,0);
});
test('Собранная страница содержит валидный JavaScript и работает без внешних загрузок', () => {
  const html = fs.readFileSync(require.resolve('../index.html'),'utf8');
  for (const match of html.matchAll(/<script(?![^>]*application\/json)[^>]*>([\s\S]*?)<\/script>/g)) new vm.Script(match[1]);
  assert.equal(/<script[^>]+src=/.test(html),false);
  assert.equal(/@import|url\(https?:/.test(html),false);
  assert.equal(html.includes('/* APP */'),false);
  const embedded = JSON.parse(html.match(/id="schedule-data" type="application\/json">([\s\S]*?)<\/script>/)[1]);
  assert.deepEqual(embedded,data);
});
