'use strict';

const boardPalettes = {
  frost:{get name() { return text('Frost', 'Иней'); },light:'#cbd8e6',dark:'#587495'},
  pearl:{get name() { return text("Pearl", "Жемчуг"); },light:'#e6e1df',dark:'#a5a3a1'},
  wood:{get name() { return text("Wood", "Дерево"); },light:'#f2dcba',dark:'#a4744c'},
  olive:{get name() { return text("Olive", "Олива"); },light:'#e7ebcd',dark:'#799169'},
  blue:{get name() { return text("Azure", "Лазурь"); },light:'#e0edf7',dark:'#6f8eac'},
  graphite:{get name() { return text("Graphite", "Графит"); },light:'#dedee3',dark:'#777982'},
  midnight:{get name() { return text('Midnight', 'Полночь'); },light:'#d7dedc',dark:'#697b80'},
  cognac:{get name() { return text('Cognac', 'Коньяк'); },light:'#eedbc2',dark:'#9e725d'},
};
const defaultBoardSettings = {
  theme:'frost', style:'classic', light:'#cbd8e6', dark:'#587495',
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
const pieceStyles = {
  get classic() { return text('Classic','Классика'); },
  get metal() { return text('Metal','Металл'); },
  get onyx() { return text('Onyx & Ivory','Оникс и слоновая кость'); },
};
const isPieceStyle = value => Object.prototype.hasOwnProperty.call(pieceStyles,value);
function boardPiecePath(piece,style) {
  return 'piece-' + (style === 'metal' || style === 'onyx' ? 'metal-' : '') + piece.color + piece.type.toUpperCase() + '.svg';
}

