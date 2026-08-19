#!/usr/bin/env node
// Собирает раздел subtitles монтажного листа из пословного JSON whisper.cpp.
//
// Запуск: node tools/субтитры-из-whisper.mjs <слова.json> [edit-plan.json]
//
// Whisper зовётся с флагами -ml 1 -sow: одна запись на СЛОВО, а не на кусок BPE.
// Без -sow русские слова приезжают рублеными («тел ег рам м»), и субтитры из них
// не собрать — только таймкоды для надписей.
import { readFileSync, writeFileSync } from 'node:fs';

const [, , путьJson, путьПлана = 'edit-plan.json'] = process.argv;
if (!путьJson) {
  console.error('Укажите json от whisper-cli: node tools/субтитры-из-whisper.mjs слова.json');
  process.exit(1);
}

const МАКС_СИМВОЛОВ = 26; // длиннее строка не читается за время показа
const МАКС_СЛОВ = 4;
const КОНЕЦ_ФРАЗЫ = /[.!?…]$/;
const ПАУЗА_РАЗРЫВА = 0.6; // с — заметная пауза в речи рвёт строку

const данные = JSON.parse(readFileSync(путьJson, 'utf8'));
const слова = данные.transcription
  .map((з) => ({
    т: з.offsets.from / 1000,
    до: з.offsets.to / 1000,
    текст: з.text.trim(),
  }))
  .filter((с) => с.текст.length > 0);

const куски = [];
let текущий = null;

for (let i = 0; i < слова.length; i++) {
  const с = слова[i];
  const пауза = текущий ? с.т - слова[i - 1].до : 0;
  const длина = текущий ? текущий.строка.length + 1 + с.текст.length : с.текст.length;

  const надоРвать =
    текущий &&
    (длина > МАКС_СИМВОЛОВ || текущий.words.length >= МАКС_СЛОВ || пауза > ПАУЗА_РАЗРЫВА);

  if (!текущий || надоРвать) {
    if (текущий) куски.push(текущий);
    текущий = { at: с.т, until: с.до, строка: с.текст, words: [] };
  } else {
    текущий.строка += ' ' + с.текст;
    текущий.until = с.до;
  }
  текущий.words.push({ t: с.т, w: с.текст.toUpperCase() });
  текущий.until = с.до;

  // Точка, восклицательный или вопросительный знак закрывают строку принудительно.
  if (КОНЕЦ_ФРАЗЫ.test(с.текст)) {
    куски.push(текущий);
    текущий = null;
  }
}
if (текущий) куски.push(текущий);

// Строка-помощник в листе не нужна: её собирает компонент из words.
const субтитры = куски.map(({ at, until, words }) => ({
  at: Number(at.toFixed(2)),
  until: Number(until.toFixed(2)),
  words: words.map(({ t, w }) => ({ t: Number(t.toFixed(2)), w })),
}));

const план = JSON.parse(readFileSync(путьПлана, 'utf8'));
план.subtitles = субтитры;
writeFileSync(путьПлана, JSON.stringify(план, null, 2) + '\n', 'utf8');

const самая = субтитры.reduce((м, с) => Math.max(м, с.words.map((x) => x.w).join(' ').length), 0);
console.log(`Строк субтитров: ${субтитры.length}`);
console.log(`Слов: ${субтитры.reduce((н, с) => н + с.words.length, 0)}`);
console.log(`Самая длинная строка: ${самая} символов`);
console.log(`Записано в ${путьПлана}`);
