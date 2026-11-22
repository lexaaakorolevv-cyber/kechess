'use strict';

const weights = {p:100,n:320,b:335,r:500,q:900,k:0};
function evaluation(chess, side) {
  if (chess.isCheckmate()) return chess.turn() === side ? -100000 : 100000;
  if (chess.isDraw()) return 0;
  let score = 0;
  for (const rank of chess.board()) {
    for (const piece of rank) {
      if (!piece) continue;
      const center = 7 - Math.abs(piece.square.charCodeAt(0) - 100.5) -
        Math.abs(Number(piece.square[1]) - 4.5);
      const position = piece.type === 'k' ? 0 : center * (piece.type === 'n' ? 8 : 3);
      score += (piece.color === side ? 1 : -1) * (weights[piece.type] + position);
    }
  }
  return score;
}
function findBotMove(fen, bot = {}) {
  const chess = new Chess(fen);
  const side = chess.turn();
  const moves = chess.moves();
  if (moves.length && Math.random() < (bot.error || 0)) return moves[Math.floor(Math.random() * moves.length)];
  let best, bestValue = -Infinity;
  for (const move of moves) {
    chess.move(move);
    let value = evaluation(chess, side);
    const replies = bot.depth === 1 || chess.isGameOver() ? [] : chess.moves();
    if (replies.length) {
      value = Infinity;
      for (const reply of replies) {
        chess.move(reply);
        value = Math.min(value, evaluation(chess, side));
        chess.undo();
        if (value < bestValue - 2) break;
      }
    }
    chess.undo();
    value += Math.random() * 2;
    if (value > bestValue) { best = move; bestValue = value; }
  }
  return best;
}

