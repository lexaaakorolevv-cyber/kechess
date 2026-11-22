'use strict';

const formats = {
  '1+0': {get group() { return text("Bullet", "Пуля"); }, minutes:1, increment:0},
  '2+1': {get group() { return text("Bullet", "Пуля"); }, minutes:2, increment:1},
  '3+0': {get group() { return text("Blitz", "Блиц"); }, minutes:3, increment:0},
  '3+2': {get group() { return text("Blitz", "Блиц"); }, minutes:3, increment:2},
  '5+0': {get group() { return text("Blitz", "Блиц"); }, minutes:5, increment:0},
  '5+3': {get group() { return text("Blitz", "Блиц"); }, minutes:5, increment:3},
  '10+0': {get group() { return text("Rapid", "Рапид"); }, minutes:10, increment:0},
  '15+10': {get group() { return text("Rapid", "Рапид"); }, minutes:15, increment:10},
};
const defaultFormat = '5+0';
const bots = [
  {id:'sparrow', names:["Sasha Volkov", "Саша Волков"],
    get name() { return text(...this.names); },
    get rank() { return text("Novice", "Новичок"); }, piece:'wP',
    get note() { return text("Learning the board and often leaves pieces unprotected.", "Осваивает доску и часто оставляет фигуры под боем."); }, error:.88, depth:1},
  {id:'mira', names:["Mira Sokolova", "Мира Соколова"],
    get name() { return text(...this.names); },
    get rank() { return text("Beginner", "Начинающая"); }, piece:'wN',
    get note() { return text("Looks for captures and occasionally misses simple tactics.", "Ищет взятия и иногда пропускает простую тактику."); }, error:.34, depth:1},
  {id:'atlas', names:["Anton Lebedev", "Антон Лебедев"],
    get name() { return text(...this.names); },
    get rank() { return text("Amateur", "Любитель"); }, piece:'wB',
    get note() { return text("Fights for the center and spots one-move threats.", "Борется за центр и видит угрозы на один ход вперёд."); }, error:.10, depth:2},
  {id:'rook', names:["Roman Kim", "Роман Ким"],
    get name() { return text(...this.names); },
    get rank() { return text("Club player", "Клубный игрок"); }, piece:'bR',
    get note() { return text("Punishes material losses and spots forks.", "Наказывает за потерю материала и замечает вилки."); }, skill:3, limit:260},
  {id:'vega', names:["Victoria Orlova", "Виктория Орлова"],
    get name() { return text(...this.names); },
    get rank() { return text("Expert", "Эксперт"); }, piece:'wQ',
    get note() { return text("Spots tactical weaknesses and calculates exchanges.", "Подмечает тактические слабости и просчитывает размены."); }, skill:8, limit:430},
  {id:'orin', names:["Judit Polgár", "Юдит Полгар"],
    get name() { return text(...this.names); },
    get rank() { return text("Master", "Мастер"); }, piece:'bB',
    get note() { return text("A bot set to master difficulty.", "Игровой бот на уровне мастера."); }, skill:13, limit:650},
  {id:'selene', names:["Hikaru Nakamura", "Хикару Накамура"],
    get name() { return text(...this.names); },
    get rank() { return text("Grandmaster", "Гроссмейстер"); }, piece:'bQ',
    get note() { return text("A bot set to grandmaster difficulty.", "Игровой бот на гроссмейстерском уровне."); }, skill:17, limit:920},
  {id:'crown', names:["Magnus Carlsen", "Магнус Карлсен"],
    get name() { return text(...this.names); },
    get rank() { return text("World class", "Мировая звезда"); }, piece:'bK',
    get note() { return text("A bot using the engine at full strength.", "Игровой бот с максимальной силой движка."); }, skill:20, limit:1400},
];
const botById = id => bots.find(bot => bot.id === id) || bots[2];
const formatById = id => Object.prototype.hasOwnProperty.call(formats,id) ? id : defaultFormat;
const formatLabel = id => formats[id].group + ' ' + id;

