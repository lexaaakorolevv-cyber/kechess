'use strict';

const languageKey = 'kechess.language';
let interfaceLanguage = 'en';
try {
  if (localStorage.getItem(languageKey) === 'ru') interfaceLanguage = 'ru';
} catch {}
document.documentElement.lang = interfaceLanguage;

function text(english, russian) {
  return interfaceLanguage === 'ru' ? russian : english;
}

function setInterfaceLanguage(language) {
  if (!['en', 'ru'].includes(language) || language === interfaceLanguage) return false;
  try { localStorage.setItem(languageKey, language); } catch {}
  interfaceLanguage = language;
  document.documentElement.lang = language;
  return true;
}

// The original online protocol sends these results in Russian.
const resultTranslations = [
  ['Connection lost', 'Связь прервана'],
  ['Draw by agreement', 'Ничья по соглашению'],
  ['Draw · Stalemate', 'Ничья · Пат'],
  ['Draw', 'Ничья'],
  ['White wins on time', 'Белые победили по времени'],
  ['Black wins on time', 'Чёрные победили по времени'],
  ['White wins · Checkmate', 'Белые победили · Мат'],
  ['Black wins · Checkmate', 'Чёрные победили · Мат'],
  ['White wins · Resignation', 'Белые победили · Сдача'],
  ['Black wins · Resignation', 'Чёрные победили · Сдача'],
  ['Checkmate! Puzzle solved', 'Мат! Задача решена'],
];

function translateResult(result, language = interfaceLanguage) {
  const pair = resultTranslations.find(variants => variants.includes(result));
  return pair ? pair[language === 'ru' ? 1 : 0] : result;
}
