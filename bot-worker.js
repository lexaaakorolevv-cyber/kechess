'use strict';
importScripts('chess.js','bot.js');
self.onmessage = event => self.postMessage(findBotMove(event.data.fen,event.data.bot));

