'use strict';

const boardPalettes = {
  pearl:{get name() { return text("Pearl", "Жемчуг"); },light:'#e6e1df',dark:'#a5a3a1'},
  wood:{get name() { return text("Wood", "Дерево"); },light:'#f2dcba',dark:'#a4744c'},
  olive:{get name() { return text("Olive", "Олива"); },light:'#e7ebcd',dark:'#799169'},
  blue:{get name() { return text("Azure", "Лазурь"); },light:'#e0edf7',dark:'#6f8eac'},
  graphite:{get name() { return text("Graphite", "Графит"); },light:'#dedee3',dark:'#777982'},
};
const defaultBoardSettings = {
  theme:'pearl', style:'classic', light:'#e6e1df', dark:'#a5a3a1',
  coordinates:true, hints:true, lastMove:true, motion:true,
};
const boardToggles = {
  get coordinates() { return text("Coordinates", "Координаты"); },
  get hints() { return text("Legal moves", "Доступные ходы"); },
  get lastMove() { return text("Last move", "Последний ход"); },
  get motion() { return text("Piece animations", "Анимация фигур"); },
};
const isBoardColor = value => typeof value === 'string' && /^#[\da-f]{6}$/i.test(value);
const isBoardPalette = value => Object.prototype.hasOwnProperty.call(boardPalettes,value);
const boardColors = settings => settings.theme === 'custom' ? settings : boardPalettes[settings.theme];
function boardPiecePath(piece,style) {
  return 'piece-' + (style === 'metal' ? 'metal-' : '') + piece.color + piece.type.toUpperCase() + '.svg';
}

