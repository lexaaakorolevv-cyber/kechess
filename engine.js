'use strict';

const stockfishWasm = 'stockfish-17.1-lite-single-03e3232.js';
const stockfishAsm = 'stockfish-17.1-asm-341ff22.js';
let engine = null;
let engineRequest = null;
let engineKind = 'wasm';
const supportsWasm = typeof WebAssembly === 'object' && typeof WebAssembly.instantiate === 'function';

function resetEngine() {
  if (engine) engine.terminate();
  engine = null;
  engineRequest = null;
}
function searchStockfish(chess, bot, callback) {
  if (!supportsWasm) engineKind = 'asm';
  const fen = chess.fen();
  const sanMoves = chess.history({verbose:true});
  const notation = sanMoves.map(move => move.from + move.to + (move.promotion || ''));
  const position = notation.length ? 'position startpos moves ' + notation.join(' ') : 'position fen ' + fen;
  let finished = false;
  let timeout;
  let type = engineKind;
  function complete(move) {
    if (finished) return;
    finished = true;
    clearTimeout(timeout);
    engineRequest = null;
    callback(move);
  }
  function fallback() {
    if (finished) return;
    resetEngine();
    clearTimeout(timeout);
    if (type === 'wasm') {
      type = engineKind = 'asm';
      begin();
    } else complete(null);
  }
  function begin() {
    timeout = setTimeout(fallback, Math.max(5500,bot.limit + 3700));
    try {
      if (!engine) {
        engine = new Worker(type === 'wasm' ? stockfishWasm : stockfishAsm);
        engine.onmessage = event => {
          if (engineRequest) engineRequest.message(String(event.data).trim());
        };
        engine.onerror = event => {
          event.preventDefault();
          if (engineRequest) engineRequest.error();
        };
      }
      engineRequest = {
        error:fallback,
        message(line) {
          if (line === 'uciok') {
            engine.postMessage('setoption name Hash value 16');
            engine.postMessage('setoption name Skill Level value ' + bot.skill);
            engine.postMessage('isready');
          } else if (line === 'readyok') {
            engine.postMessage(position);
            engine.postMessage('go movetime ' + bot.limit);
          } else if (line.indexOf('bestmove ') === 0) {
            const match = /^bestmove ([a-h][1-8])([a-h][1-8])([qrbn])?/.exec(line);
            complete(match ? {from:match[1],to:match[2],promotion:match[3]} : null);
          }
        },
      };
      engine.postMessage('uci');
    } catch { fallback(); }
  }
  begin();
  return () => {
    if (finished) return;
    finished = true;
    clearTimeout(timeout);
    resetEngine();
  };
}

