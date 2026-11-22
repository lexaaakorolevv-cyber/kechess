'use strict';

const app = document.querySelector('#app');
const dialog = document.querySelector('#dialog');
const overlay = document.querySelector('#overlay');
const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)');
let dialogVisible = false;
let hideDialogTimer;
let priorFocus;
let renderedScreen = '';
let pendingLanding = null;
let suppressBoardClick = false;
let drag = null;
const toast = document.querySelector('#toast');
const files = 'abcdefgh';
const pieces = { get p() { return text("pawn", "пешка"); }, get n() { return text("knight", "конь"); }, get b() { return text("bishop", "слон"); }, get r() { return text("rook", "ладья"); }, get q() { return text("queen", "ферзь"); }, get k() { return text("king", "король"); } };
const colorName = { get w() { return text("White", "Белые"); }, get b() { return text("Black", "Чёрные"); } };
const opposite = color => color === 'w' ? 'b' : 'w';
const read = (key, fallback) => {
  try {
    const value = JSON.parse(localStorage.getItem('kechess.' + key));
    return value === null ? fallback : value;
  }
  catch { return fallback; }
};
function save(key, value) {
  try { localStorage.setItem('kechess.' + key, JSON.stringify(value)); } catch {}
}
const escape = value => String(value).replace(/[&<>"']/g, char =>
  ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'})[char]);

const paths = {
  home:'<path d="m3 10 9-7 9 7M5.5 9v12h5v-6h3v6h5V9"/>',
  history:'<path d="M8 5h13M8 12h13M8 19h13M3 5h.1M3 12h.1M3 19h.1"/>',
  user:'<circle cx="12" cy="7" r="4"/><path d="M3 21c0-4.5 4-7 9-7s9 2.5 9 7Z"/>',
  target:'<circle cx="12" cy="12" r="8"/><circle cx="12" cy="12" r="2"/><path d="M12 2v4m0 12v4M2 12h4m12 0h4"/>',
  bot:'<rect x="2" y="3" width="20" height="14" rx="2"/><path d="M12 17v4m-5 0h10"/>',
  chart:'<path stroke-width="3" d="M5 20v-5m7 5V9m7 11V4"/>',
  next:'<path d="m9 5 7 7-7 7"/>',
  back:'<path d="m15 5-7 7 7 7"/>',
  play:'<path fill="currentColor" d="M5 3.5v17L20 12Z"/>',
  flag:'<path d="M4 22V4c6-5 11 5 16 0v11c-5 5-10-5-16 0"/>',
  equal:'<path d="M4 9h16M4 15h16"/>',
  more:'<circle cx="12" cy="5" r="1"/><circle cx="12" cy="12" r="1"/><circle cx="12" cy="19" r="1"/>',
  flip:'<path d="m4 8 4-4 4 4M8 4v15m12-3-4 4-4-4m4 4V5"/>',
  undo:'<path d="m8 4-5 5 5 5M3 9h11a6 6 0 0 1 0 12"/>',
  close:'<path d="m6 6 12 12M18 6 6 18"/>',
  gear:'<circle cx="12" cy="12" r="3.4"/><path d="m9.5 3-.7 2.1-2 .9-2.1-.8-2 3.4 1.6 1.5v2.4L2.7 14l2 3.4 2.1-.8 2 .9.7 2.1h4l.7-2.1 2-.9 2.1.8 2-3.4-1.6-1.5v-2.4l1.6-1.5-2-3.4-2.1.8-2-.9-.7-2.1Z"/>',
  download:'<path d="M12 3v12m-4-4 4 4 4-4M4 16v4h16v-4"/>',

};
const icon = name => '<svg class="icon" aria-hidden="true" viewBox="0 0 24 24">' + paths[name] + '</svg>';
const control = (act, label, glyph, compact = false) =>
  '<button class="glass control' + (compact ? ' compact' : '') + '" data-act="' + act +
  '" aria-label="' + label + '">' + (glyph ? icon(glyph) : '') + (compact ? '' : label) + '</button>';
const row = (act, label, glyph) => '<button class="glass row" data-act="' + act + '">' +
  icon(glyph) + '<span>' + label + '</span>' + icon('next').replace('icon"', 'icon tail"') + '</button>';

let page = 'home';
let game = null;
let chosen = null;
let net = null;
let toastTimer;
let botTimer;
const settings = Object.assign({},defaultBoardSettings,
  {hints:read('profile',{hints:true}).hints !== false},read('settings',{}));
if (settings.theme !== 'custom' && !isBoardPalette(settings.theme)) settings.theme = defaultBoardSettings.theme;
['light','dark'].forEach(name => { if (!isBoardColor(settings[name])) settings[name] = defaultBoardSettings[name]; });
let puzzleTimer;
let history = read('history', []);
let solved = read('solved', []);



let settingsReturn = 'home';

function boardTint() {
  const {light,dark} = boardColors(settings);
  return '--square-light:' + light + ';--square-dark:' + dark;
}
function settingsPreview() {
  const example = {1:'bk',2:'bn',4:'bp',5:'bp',10:'wp',12:'wr',13:'wk',15:'wn'};
  let html = '<div class="board-preview' + (settings.coordinates ? '' : ' no-coordinates') + '">';
  if (settings.coordinates) html += '<div class="preview-ranks" aria-hidden="true"><span>8</span><span>7</span><span>6</span><span>5</span></div>';
  html += '<div class="preview-squares" style="' + boardTint() + '" aria-hidden="true">';
  for (let i = 0; i < 16; i++) {
    const flags = (i + Math.floor(i/4)) % 2 ? ' dark' : '';
    const last = settings.lastMove && (i === 6 || i === 10) ? ' last' : '';
    const hint = settings.hints && i === 9 ? ' hint' : '';
    const piece = example[i];
    html += '<div class="square' + flags + last + hint + '">' +
      (piece ? pieceImage({color:piece[0],type:piece[1]}) : '') + '</div>';
  }
  html += '</div>';
  if (settings.coordinates) html += '<div class="preview-files" aria-hidden="true"><span>a</span><span>b</span><span>c</span><span>d</span></div>';
  return html + '</div>';
}
function renderSettings() {
  const languages = [['en', 'English'], ['ru', 'Русский']].map(([code, name]) =>
    '<button class="glass theme-option" data-act="language" data-id="' + code + '" lang="' + code +
    '" aria-pressed="' + (interfaceLanguage === code) + '">' + name + '</button>').join('');
  const palettes = Object.keys(boardPalettes).map(id => {
    const p = boardPalettes[id];
    return '<button class="glass theme-option" data-act="theme" data-id="' + id + '" aria-pressed="' + (settings.theme === id) +
      '"><span class="palette-swatch" style="--swatch-light:' + p.light + ';--swatch-dark:' + p.dark + '"></span>' + p.name + '</button>';
  }).join('');
  const styles = [['classic',text("Classic", "Классика")],['metal',text("Metal", "Металл")]].map(([id,name]) =>
    '<button class="glass piece-option" data-act="piece-style" data-id="' + id + '" aria-pressed="' +
    (settings.style === id) + '"><img alt="" src="' + boardPiecePath({color:'w',type:'n'},id) + '"><span>' + name + '</span></button>').join('');
  const toggles = Object.keys(boardToggles).map(id =>
    '<button class="setting-toggle" data-act="board-toggle" data-id="' + id +
    '" role="switch" aria-checked="' + settings[id] + '"><span>' + boardToggles[id] + '</span><span class="setting-switch" aria-hidden="true"></span></button>'
  ).join('');
  const colors = boardColors(settings);
  return ('<main class="page settings-page"><div class="settings-header"><button class="glass circle" data-act="settings-back" aria-label="' + text('Back', 'Назад') + '">') +
    icon('back') + '</button><h1>' + text('Settings', 'Настройки') + '</h1></div>' +
    '<section class="glass panel board-options"><h2 id="language-heading">' + text('Language', 'Язык') +
    '</h2><div class="language-options" role="group" aria-labelledby="language-heading">' + languages + '</div></section>' +
    '<section class="glass panel board-options">' +
    ('<h2>' + text('Board</h2><div id="board-preview" aria-label="Board preview', 'Доска</h2><div id="board-preview" aria-label="Предпросмотр доски') + '">') + settingsPreview() + '</div>' +
    ('<div class="board-themes" aria-label="' + text('Board theme', 'Цветовая тема') + '">') + palettes + '</div>' +
    ('<div class="custom-colors"><label>' + text('Light squares', 'Светлые клетки') + '<input type="color" data-board-color="light" value="') + colors.light + '"></label>' +
    ('<label>' + text('Dark squares', 'Тёмные клетки') + '<input type="color" data-board-color="dark" value="') + colors.dark + '"></label></div></section>' +
    ('<section class="glass panel board-options"><h2>' + text('Pieces', 'Фигуры') + '</h2><div class="piece-options">') + styles + '</div></section>' +
    ('<section class="glass panel board-options"><h2>' + text('Display', 'Отображение') + '</h2>') + toggles + '</section>' +
    '<button class="glass row settings-reset" data-act="reset-board">' + icon('undo') + ('<span>' + text('Reset board settings', 'Сбросить настройки доски') + '</span></button></main>');
}
function applyBoardSettings() {
  save('settings',settings);
  const container = app.querySelector('#board-preview');
  if (!container) return;
  container.innerHTML = settingsPreview();
  const colors = boardColors(settings);
  app.querySelectorAll('[data-board-color]').forEach(input => { input.value = colors[input.dataset.boardColor]; });
  app.querySelectorAll('[data-act="theme"]').forEach(button =>
    button.setAttribute('aria-pressed',String(button.dataset.id === settings.theme)));
  app.querySelectorAll('[data-act="piece-style"]').forEach(button =>
    button.setAttribute('aria-pressed',String(button.dataset.id === settings.style)));
  app.querySelectorAll('[data-act="board-toggle"]').forEach(button =>
    button.setAttribute('aria-checked',String(settings[button.dataset.id])));
}
function settingsBack() {
  page = settingsReturn;
  render();
}
document.addEventListener('input', event => {
  const channel = event.target.dataset.boardColor;
  if (!channel || !isBoardColor(event.target.value)) return;
  const colors = boardColors(settings);
  settings.light = colors.light;
  settings.dark = colors.dark;
  settings[channel] = event.target.value;
  settings.theme = 'custom';
  applyBoardSettings();
});


function pop(title, content) {
  if (!dialogVisible) priorFocus = document.activeElement;
  const opening = !dialogVisible;
  clearTimeout(hideDialogTimer);
  dialogVisible = true;
  overlay.hidden = false;
  dialog.removeAttribute('aria-hidden');
  app.setAttribute('aria-hidden','true');
  dialog.innerHTML = '<h2 id="dialog-title">' + title + '</h2>' + content;
  dialog.focus();
  if (opening) overlay.getBoundingClientRect();
  overlay.classList.add('shown');
}
function closeDialog() {
  if (!dialogVisible) return;
  dialogVisible = false;
  overlay.classList.remove('shown');
  dialog.setAttribute('aria-hidden','true');
  app.removeAttribute('aria-hidden');
  if (priorFocus && priorFocus.isConnected) priorFocus.focus({preventScroll:true});
  hideDialogTimer = setTimeout(() => { overlay.hidden = true; }, reducedMotion.matches ? 0 : 850);
}
function dismissDialog() {
  if (!dialogVisible) return;
  if (net && !net.bound) cleanupNetwork();
  closeDialog();
}
function keepTabBar(previous, incoming) {
  const nav = previous && previous.querySelector('.nav');
  const next = incoming.querySelector('.nav');
  if (!nav || !next || nav.lang !== next.lang) return null;
  const focus = nav.contains(document.activeElement) ? document.activeElement : null;
  const active = next.querySelector('[aria-current="page"]');
  nav.querySelectorAll('[data-act]').forEach(button => {
    if (active && active.dataset.act === button.dataset.act) button.setAttribute('aria-current','page');
    else button.removeAttribute('aria-current');
  });
  if (active) nav.dataset.selection = active.dataset.act;
  nav.classList.toggle('has-selection',!!active);
  next.parentNode.replaceChild(nav,next);
  return focus;
}
function keepMovingPieces(previous, incoming) {
  if (!previous) return;
  previous.querySelectorAll('.square.moving > .piece').forEach(piece => {
    const square = incoming.querySelector('[data-square="' + piece.parentElement.dataset.square + '"]');
    const next = square && square.querySelector('.piece');
    if (next && next.getAttribute('src') === piece.getAttribute('src')) {
      square.classList.add('moving');
      square.replaceChild(piece,next);
    }
  });
}
let tabMotion = null;
let keyboardNavigation = false;
document.addEventListener('keydown',event => {
  if (['Tab','Enter',' ','ArrowLeft','ArrowRight','ArrowUp','ArrowDown'].includes(event.key)) keyboardNavigation = true;
});
document.addEventListener('pointerdown',() => { keyboardNavigation = false; });
function animateTabSelection(indicator, from) {
  if (tabMotion) tabMotion.cancel();
  tabMotion = null;
  if (!indicator || !indicator.animate || reducedMotion.matches) return;
  const destination = getComputedStyle(indicator).transform;
  const offset = from - indicator.getBoundingClientRect().left;
  if (Math.abs(offset) < 1) return;
  tabMotion = indicator.animate([
    {transform:'translate3d(' + offset + 'px,0,0) ' + destination},
    {transform:destination}
  ],{duration:1030,easing:'cubic-bezier(.18,.74,.23,1.025)'});
}
function displayScreen(html) {
  const screen = page === 'game' ? page + ':' + game.id + ':' + game.mode : page;
  const changed = screen !== renderedScreen;
  const previous = app.firstElementChild;
  const launch = !renderedScreen;
  if (changed && previous && !reducedMotion.matches) fadePreviousScreen(previous);
  const match = !changed && previous && previous.querySelector('.match');
  const scroll = match ? match.scrollTop : 0;
  const template = document.createElement('template');
  template.innerHTML = html;
  const incoming = template.content.firstElementChild;
  const indicator = changed && previous && previous.querySelector('.nav-selection');
  const selectionStart = indicator ? indicator.getBoundingClientRect().left : 0;
  const focus = keepTabBar(previous,incoming);
  if (!changed) keepMovingPieces(previous,incoming);
  if (previous) app.replaceChild(incoming,previous);
  else app.appendChild(incoming);
  if (indicator && incoming.contains(indicator)) animateTabSelection(indicator,selectionStart);
  if (focus && keyboardNavigation) focus.focus({preventScroll:true});
  if (scroll) incoming.querySelector('.match').scrollTop = scroll;
  if (changed) {
    incoming.classList.add(launch ? 'launch-arrival' : 'screen-arrival');
    renderedScreen = screen;
  }
}
function alertBox(title, message) {
  pop(title, '<p class="muted">' + message + '</p><div class="dialog-actions">' + control('close', text("OK", "Понятно")) + '</div>');
}
function toastMessage(message) {
  toast.textContent = message;
  toast.classList.add('visible');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => toast.classList.remove('visible'), 2200);
}
async function share(value, copy = false) {
  try {
    if (window.KechessAndroid) {
      if (copy) window.KechessAndroid.copy(value);
      else window.KechessAndroid.share(value, interfaceLanguage);
    }
    else if (!copy && navigator.share) await navigator.share({text:value});
    else await navigator.clipboard.writeText(value);
    if (copy) toastMessage(text("Copied", "Скопировано"));
  } catch { toastMessage(text("Could not share", "Не удалось поделиться")); }
}


let setup = null;
function clockPicker(selected) {
  const clockGroups = [...new Set(Object.values(formats).map(format => format.group))];
  return ('<div class="clock-picker" aria-label="' + text('Time control', 'Контроль времени') + '">') + clockGroups.map(group =>
    '<div><span>' + group + '</span><div class="clock-options">' +
    Object.keys(formats).filter(id => formats[id].group === group).map(id =>
      '<button class="glass time-chip" data-act="time-format" data-id="' + id +
      '" aria-pressed="' + (id === selected) + '" aria-label="' + group + ' ' + id + '">' + id + '</button>'
    ).join('') + '</div></div>'
  ).join('') + '</div>';
}
function selectClock(button) {
  setup.format = formatById(button.dataset.id);
  dialog.querySelectorAll('[data-act="time-format"]').forEach(item =>
    item.setAttribute('aria-pressed',String(item === button)));
}
function openMatchSetup(mode, id) {
  const bot = botById(id);
  setup = {mode,bot:bot.id,side:'w',format:formatById(read('time-format',defaultFormat))};
  if (mode === 'online') { showOnline(); return; }
  const color = mode === 'cpu' ?
    ('<div class="color-choice" aria-label="' + text('Side', 'Цвет фигур') + '">') +
    [['w',text("White", "Белыми")],['random',text("Random", "Случайно")],['b',text("Black", "Чёрными")]].map(([side,label]) =>
      '<button class="glass time-chip" data-act="side-option" data-id="' + side + '" aria-pressed="' +
      (side === setup.side) + '">' + label + '</button>').join('') + '</div>' : '';
  pop(mode === 'cpu' ? bot.name : text("On one device", "На одном устройстве"),
    (mode === 'cpu' ? '<p class="muted">' + bot.rank + '</p>' : '') + clockPicker(setup.format) + color +
    '<div class="dialog-actions">' + control('close',text("Cancel", "Отмена")) + control('start-match',text("Play", "Играть"),'play') + '</div>');
}
function moveList() {
  const moves = game.chess.history();
  const rows = [];
  for (let i = 0; i < moves.length; i += 2) {
    rows.push('<div><span>' + (i/2+1) + '.</span><strong>' + escape(moves[i]) +
      '</strong><strong>' + escape(moves[i+1] || '') + '</strong></div>');
  }
  return rows.length ? '<div class="move-list">' + rows.join('') + '</div>' :
    '<p class="muted">' + text('Moves will appear as the game progresses.', 'Ходы появятся после начала партии.') + '</p>';
}
function showMoves() {
  pop(text('Moves', 'Ходы'), moveList());
  dialog.insertAdjacentHTML('beforeend','<div class="dialog-actions">' +
    control('close',text("Back to board", "К доске")) + control('game-menu',text("Actions", "Действия"),'more') + '</div>');
  const list = dialog.querySelector('.move-list');
  if (list) list.scrollTop = list.scrollHeight;
}
function undoMove() {
  if (!game.ply || game.result || game.review || game.mode === 'online') return;
  let count = 1;
  if (game.mode === 'cpu') {
    count = activeSide() ? 2 : 1;
    if (game.ply <= (game.side === 'b' ? 1 : 0) || count > game.ply) return;
    stopBot();
  }
  const oldClock = timed() ? times() : null;
  while (count--) { game.chess.undo(); game.ply--; }
  const restoredClock = game.timeHistory[game.ply];
  game.timeHistory.length = Math.min(game.ply,game.timeHistory.length);
  if (oldClock) {
    game.clock = restoredClock || oldClock;
    game.stamp = Date.now();
    game.draw = null;
  }
  game.lastMove = game.chess.history({verbose:true})[game.ply-1];
  chosen = null;
  persistGame();
  render();
  scheduleBot();
}

function desktopRail() {
  const items = [
    ['home', 'nav-home', 'home', text('Home', 'Главная')],
    ['bots', 'computer', 'bot', text('Play a bot', 'Игра с ботом')],
    ['puzzles', 'puzzles', 'target', text('Puzzles', 'Задачи')],
    ['history', 'nav-history', 'history', text('Games', 'Партии')],
    ['settings', 'settings', 'gear', text('Settings', 'Настройки')],
  ];
  const button = ([id, action, glyph, label]) =>
    '<button class="rail-item" data-act="' + action + '"' + (page === id ? ' aria-current="page"' : '') + '>' +
    icon(glyph) + '<span>' + label + '</span></button>';
  return '<aside class="desktop-rail"><button class="desktop-brand" data-act="nav-home" aria-label="kechess">' +
    '<img src="icon.png" width="44" height="44" alt=""><span>kechess</span></button>' +
    '<nav aria-label="' + text('Navigation', 'Разделы') + '">' + items.map(button).join('') + '</nav>' +
    '<div class="rail-footer"><a class="rail-item" href="kechess-1.5.apk" download>' + icon('download') +
    '<span>' + text('Download for Android','Скачать для Android') + '</span></a>' +
    button(['profile', 'nav-profile', 'user', text('Profile', 'Профиль')]) + '</div></aside>';
}

function previewSquares(position, accent = '') {
  return position.map((rank,y) =>
    Array.from(rank, (piece,x) => {
      const type = piece.toLowerCase();
      const model = pieces[type] && {type,color:piece === type ? 'b' : 'w'};
      const highlighted = accent === files[x] + (8-y);
      return '<div class="showcase-cell' + ((x+y)%2 ? ' dark' : '') + (highlighted ? ' lit' : '') + '">' +
        (model ? '<img src="' + boardPiecePath(model,'classic') + '" alt="">' : '') + '</div>';
    }).join('')).join('');
}

function showcaseBoard() {
  const position = ['r.bqkbnr','.ppp.ppp','p.n.....','.B..p...','....P...','.....N..','PPPP.PPP','RNBQK..R'];
  return '<div class="showcase" aria-hidden="true"><div class="showcase-board">' +
    previewSquares(position,'e4') + '</div></div>';
}

function dailyPuzzleCard() {
  const now = new Date();
  const date = Date.UTC(now.getFullYear(), now.getMonth(), now.getDate());
  const id = Math.floor(date / 86400000) % puzzles.length;
  const puzzle = puzzles[id];
  const [fen, side] = puzzle.fen.split(' ');
  const position = fen.split('/').map(rank => rank.replace(/[1-8]/g, count => '.'.repeat(Number(count))));
  if (side === 'b') {
    position.reverse();
    position.forEach((rank,index) => { position[index] = [...rank].reverse().join(''); });
  }
  const completed = solved.includes(id);
  const turn = side === 'w' ? text('White to move','Ход белых') : text('Black to move','Ход чёрных');
  return '<section class="daily-puzzle" aria-labelledby="daily-title"><div class="daily-board" aria-hidden="true">' +
    previewSquares(position) + '</div><div class="daily-copy"><h2 id="daily-title">' + text('Daily puzzle','Задача дня') +
    '</h2><p>' + puzzleTitle(puzzle.count) + ' · ' + (completed ? text('Solved','Решено') : turn) +
    '</p></div><button class="daily-play" data-act="puzzle" data-id="' + id + '">' +
    (completed ? text('Play again','Решить снова') : text('Solve puzzle','Решить задачу')) + '</button></section>';
}

function desktopHome(canResume) {
  const modes = [
    ['computer', 'bot', text('Play a bot', 'Игра с ботом'), text('Choose a difficulty and play at your pace.', 'Выбери уровень и играй в своём темпе.')],
    ['online', 'user', text('Play a friend', 'Игра с другом'), text('Start a timed game with an invite link.', 'Пригласи друга по ссылке и выбери время партии.')],
    ['puzzles', 'target', text('Chess puzzles', 'Шахматные задачи'), text('Find checkmate in one or two moves.', 'Найди мат в один или два хода.')],
  ];
  return '<main class="desktop-home"><section class="desktop-hero" aria-labelledby="desktop-title"><div class="desktop-hero-copy">' +
    '<h1 id="desktop-title">' + text('Your next move.', 'Твой следующий ход.') + '</h1>' +
    '<p>' + text('Play chess in your browser. Start with a bot, or invite a friend to the board.', 'Играй в шахматы прямо в браузере. Начни с бота или пригласи друга за доску.') + '</p>' +
    '<div class="desktop-hero-actions"><button class="desktop-play" data-act="' + (canResume ? 'resume' : 'quick-play') + '">' + icon('play') +
    (canResume ? text('Resume game', 'Продолжить партию') : text('Play now', 'Играть сейчас')) + '</button>' +
    '<button class="desktop-mode-menu" data-act="play-menu">' + text('Game modes', 'Режимы игры') + '</button>' +
    '</div></div>' + showcaseBoard() + '</section><div class="desktop-modes">' +
    modes.map(([action, glyph, title, description]) =>
      '<button type="button" class="desktop-mode" data-act="' + action + '"><span class="mode-icon">' + icon(glyph) +
      '</span><span><strong>' + title + '</strong><small>' + description + '</small></span></button>').join('') + '</div>' +
    dailyPuzzleCard() + '</main>';
}

function render() {
  if (page === 'game') { renderGame(); return; }
  const selected = ['home','history','profile'].includes(page);
  const nav = '<nav lang="' + interfaceLanguage + '" class="glass nav' + (selected ? ' has-selection" data-selection="nav-' + page : '') +
    ('" aria-label="' + text('Navigation', 'Разделы') + '"><span class="nav-selection" aria-hidden="true"></span>') +
    [['home',text("Home", "Главная"),'home'],['history',text("Games", "Партии"),'history'],['profile',text("Profile", "Профиль"),'user']].map(([id,label,glyph]) =>
      '<button data-act="nav-' + id + '"' + (page === id ? ' aria-current="page"' : '') + '>' +
      '<span class="tab-content">' + icon(glyph) + '<span>' + label + '</span></span></button>').join('') + '</nav>';
  let content;
  if (page === 'home') {
    const canResume = Boolean(read('active', null));
    content = desktopHome(canResume) + '<header><h1>kechess</h1><div class="header-actions">' +
      ('<button class="glass circle" data-act="settings" aria-label="' + text('Settings', 'Настройки') + '">') + icon('gear') + '</button>' +
      ('<button class="glass circle" data-act="nav-profile" aria-label="' + text('Profile', 'Профиль') + '">') + icon('user') + '</button></div></header>' +
      '<div class="hero" aria-hidden="true"><div class="sculpture"></div></div>' +
      ('<button class="primary" data-act="play-menu">' + text('Play', 'Играть') + '</button>') +
      '<div class="actions">' +
      ('<button class="glass tile" data-act="computer">' + text('Vs. bot</button><button class="glass tile" data-act="puzzles">Puzzles', 'С ботом</button><button class="glass tile" data-act="puzzles">Задачи') + '</button></div>') +
      (canResume ? '<button class="glass resume-row" data-act="resume">' + icon('play') + ('<span>' + text('Resume game', 'Продолжить партию') + '</span></button>') : '');
  } else if (page === 'history') {
    content = ('<main class="page"><h1>' + text('Games', 'Партии') + '</h1>') + row('local',text("Two players on one device", "Вдвоём на одном устройстве"),'user') + row('analysis',text("Game analysis", "Анализ партии"),'chart') +
      (history.length ? history.map(item =>
        '<button class="glass row" data-act="record" data-id="' + item.id + '"><span class="record"><span><strong>' +
        escape(historyLabel(item.label)) + '</strong><small>' + escape(translateResult(item.result)) + ' · ' + item.moves +
        (text(' half-moves', ' полуходов') + '</small></span><small>') + new Date(item.time).toLocaleDateString(text("en-US", "ru-RU")) +
        '</small></span></button>').join('') : ('<p class="muted panel glass">' + text('Completed games will appear here.', 'Здесь появятся завершённые партии.') + '</p>')) + '</main>';
  } else if (page === 'profile') {
    content = ('<main class="page"><h1>' + text('Profile</h1><div class="panel glass"><h2>Guest mode', 'Профиль</h1><div class="panel glass"><h2>Гостевой режим') + '</h2>') +
      ('<p class="muted">' + text('Settings and game history are stored on this device.', 'Настройки и история хранятся на этом устройстве.') + '</p></div>') +
      row('settings',text("Settings", "Настройки"),'gear') +
      '<a class="glass row android-link" href="kechess-1.5.apk" download>' + icon('download') +
      '<span>' + text('Download for Android', 'Скачать для Android') + '</span></a>' +
      ('<div class="glass panel"><p class="muted">' + text('Games played · ', 'Сыграно партий · ')) + history.length + ('<br>' + text('Puzzles solved · ', 'Решено задач · ')) +
      solved.length + text(" of ", " из ") + puzzles.length + '</p></div></main>';
  } else if (page === 'settings') {
    content = renderSettings();
  } else if (page === 'bots') {
    content = ('<main class="page bot-page"><h1>' + text('Play a bot', 'Играть с ботом') + '</h1><div class="bot-list">') + bots.map((bot,i) =>
      '<button class="glass bot-card" data-act="choose-bot" data-id="' + bot.id + '"><span class="bot-emblem bot-' + i + '">' +
      '<img alt="" src="piece-' + bot.piece + '.svg"></span><span class="bot-text"><small>' + bot.rank + '</small><strong>' + bot.name +
      '</strong><span>' + bot.note + '</span></span>' + icon('next') + '</button>'
    ).join('') + '</div></main>';
  } else {
    content = ('<main class="page puzzles-page"><h1>' + text('Puzzles', 'Задачи') + '</h1>') + [1,2].map(count =>
      '<section class="puzzle-group"><h2>' + puzzleTitle(count) + '</h2>' + puzzles.map((puzzle,i) => {
        if (puzzle.count !== count) return '';
        const side = puzzle.fen.split(' ')[1];
        return '<button class="glass row" data-act="puzzle" data-id="' + i + '">' + icon('target') +
          '<span>' + puzzle.name + '<br><small class="muted">' + (solved.includes(i) ? text("Solved", "Решено") : colorName[side] + text(" to move", " ходят")) +
          '</small></span>' + icon('next').replace('icon"', 'icon tail"') + '</button>';
      }).join('') + '</section>').join('') + '</main>';
  }
  displayScreen('<div class="shell tab-shell' + (page === 'home' ? ' home-shell' + (read('active',null) ? ' has-resume' : '') : '') +
    '" data-page="' + page + '">' + desktopRail() + content + nav + '</div>');
  if (page === 'home') sizeSculpture();
}

function newGame(mode, options = {}) {
  clearTimeout(puzzleTimer);
  stopBot();
  chosen = null;
  pendingLanding = null;
  const format = formatById(options.format);
  const time = formats[format].minutes * 60000;
  game = {
    id: options.id || String(Date.now()),
    chess: new Chess(options.fen),
    mode, format, bot:botById(options.bot), label: options.label || formatLabel(format), orientation: options.side || 'w',
    fen: options.fen, side: options.side || 'w', guest: !!options.guest,
    clock:[time,time], timeHistory:[], stamp: Date.now(), result: '',
    opponent: options.opponent || text("Opponent", "Соперник"), puzzle: options.puzzle, review: null, cursor: 0,
    draw: null, ply: 0,
  };
  return game;
}
function start(mode, options) {
  if (typeof Chess !== 'function') {
    alertBox(text("Could not load the board", "Не удалось открыть доску"),text("Restart the app. If the issue persists, update Android System WebView.", "Перезапустите приложение. Если ошибка повторится, обновите Android System WebView."));
    return;
  }
  cleanupNetwork();
  if (dialogVisible) closeDialog();
  newGame(mode, options);
  page = 'game';
  persistGame();
  render();
  scheduleBot();
}
function persistGame() {
  if (!game || !['cpu','local'].includes(game.mode)) return;
  const {id,mode,format,bot,side,orientation,clock,timeHistory,stamp,result,chess} = game;
  save('active', result ? null : {id,mode,format,bot:bot.id,side,orientation,clock,timeHistory,stamp,moves:chess.history()});
}
function restoreGame() {
  const offline = read('active', null);
  if (!offline || !['cpu','local'].includes(offline.mode)) return;
  try {
    newGame(offline.mode, {...offline, label: undefined});
    offline.moves.forEach(move => game.chess.move(move));
    game.ply = offline.moves.length;
    game.lastMove = game.chess.history({verbose:true})[game.ply - 1];
    game.orientation = offline.orientation || 'w';
    game.clock = offline.clock;
    game.timeHistory = Array.from({length:game.ply},(_,index) => offline.timeHistory && offline.timeHistory[index] || null);
    game.stamp = offline.stamp;
    tick();
    scheduleBot();
  } catch { game = null; save('active', null); }
}
function timed() { return game && ['cpu','local','online'].includes(game.mode); }
function activeSide() { return game.mode === 'local' || game.mode === 'analysis' || game.chess.turn() === game.side; }
function times(now = Date.now()) {
  const values = [...game.clock];
  if (timed() && !game.result) {
    const index = game.chess.turn() === 'w' ? 0 : 1;
    values[index] = Math.max(0, values[index] - Math.max(0, now - game.stamp));
  }
  return values;
}
function clockText(value) {
  const seconds = Math.ceil(value / 1000);
  return String(Math.floor(seconds / 60)).padStart(2,'0') + ':' + String(seconds % 60).padStart(2,'0');
}
function opponentName(name) {
  if (name === 'Guest' || name === 'Гость') return text('Guest', 'Гость');
  return name || text('Opponent', 'Соперник');
}
function historyLabel(label) {
  if (label === 'On one device' || label === 'На одном устройстве') {
    return text('On one device', 'На одном устройстве');
  }
  const separator = ' · ';
  const boundary = label.indexOf(separator);
  if (boundary < 0) return label;
  const mode = label.slice(0, boundary);
  const name = label.slice(boundary + separator.length);
  if (mode === 'Vs. bot' || mode === 'С ботом') {
    const bot = bots.find(candidate => candidate.names.includes(name));
    return text('Vs. bot', 'С ботом') + separator + (bot ? bot.name : name);
  }
  if (mode === 'Online' || mode === 'Онлайн') {
    return text('Online', 'Онлайн') + separator + opponentName(name);
  }
  return label;
}
function outcome(result, publish = true) {
  if (game.result) return;
  game.clock = times();
  game.result = result;
  if (game.mode === 'cpu') stopBot();
  chosen = null;
  if (timed()) {
    const entry = { id:game.id, label: game.mode === 'cpu' ? text("Vs. bot · ", "С ботом · ") + game.bot.name :
      game.mode === 'local' ? text("On one device", "На одном устройстве") : text("Online · ", "Онлайн · ") + game.opponent,
      time:Date.now(), result, moves:game.ply, pgn:game.chess.pgn() };
    if (!history.some(item => item.id === entry.id)) {
      history = [entry, ...history].slice(0,100);
      save('history', history);
    }
    persistGame();
  }
  if (publish && game.mode === 'online' && !game.guest) sendState();
  if (page === 'game' || page === 'home') render();
}
function tick() {
  if (!timed() || game.result) return;
  const values = times();
  const turn = game.chess.turn();
  if (values[turn === 'w' ? 0 : 1] === 0 && !game.guest) {
    outcome(colorName[opposite(turn)] + text(" wins on time", " победили по времени"));
    return;
  }
  ['w','b'].forEach((color,i) => {
    const clock = document.getElementById('clock-' + color);
    if (clock) {
      clock.textContent = clockText(values[i]);
      clock.classList.toggle('low', values[i] <= 20000);
    }
  });
}
setInterval(tick, 180);

function player(color, position) {
  const p = game;
  const name = p.mode === 'local' ? colorName[color] : p.mode === 'analysis' || p.mode === 'puzzle' ? colorName[color] :
    color === p.side ? text("You", "Вы") : p.mode === 'cpu' ? p.bot.name : opponentName(p.opponent);
  const current = !p.result && p.chess.turn() === color;
  const time = clockText(times()[color === 'w' ? 0 : 1]);
  return '<div class="glass player player-' + position + (current ? ' player-turn' : '') + '"><div class="badge">' + icon(p.mode === 'cpu' && color !== p.side ? 'bot':'user') +
    '</div><div class="name"><strong>' + escape(name) + '</strong><small>' +
    (p.mode === 'local' || p.mode === 'analysis' || p.mode === 'puzzle' ? (current ? text("To move", "Ход") : ' ') : colorName[color]) +
    '</small></div>' + (timed() ? '<div id="clock-' + color + '" class="glass clock' + (current ? ' live' : '') + '">' + time + '</div>' : '') + '</div>';
}
function pieceImage(piece) {
  return '<img alt="" class="piece ' + (piece.color === 'w' ? 'white' : 'black') + '" draggable="false" src="' +
    boardPiecePath(piece,settings.style) + '">';
}
function board() {
  const reversed = game.orientation === 'b';
  const columns = reversed ? [...files].reverse() : [...files];
  const ranks = reversed ? [1,2,3,4,5,6,7,8] : [8,7,6,5,4,3,2,1];
  const targets = chosen && settings.hints ? game.chess.moves({square:chosen,verbose:true}).map(move => move.to) : [];
  const last = settings.lastMove && game.lastMove;
  const checked = game.chess.isCheck();
  const coords = list => list.map(coord => '<span class="coord">' + coord + '</span>').join('');
  return '<div class="board-frame' + (settings.coordinates ? '' : ' without-coordinates') + '">' +
    (settings.coordinates ? '<div class="ranks" aria-hidden="true">' + coords(ranks) + '</div>' : '') +
    '<div class="board" style="' + boardTint() + ('" aria-label="' + text('Chessboard', 'Шахматная доска') + '">') + ranks.map((rank,y) => columns.map((file,x) => {
      const square = file + rank;
      const onSquare = game.chess.get(square);
      const flags = [(x+y)%2 && 'dark', last && [last.from,last.to].includes(square) && 'last',
        targets.includes(square) && (onSquare ? 'hint capture' : 'hint'), chosen === square && 'selected',
        checked && onSquare && onSquare.type === 'k' && onSquare.color === game.chess.turn() && 'check'].filter(Boolean);
      return '<button class="square ' + flags.join(' ') + '" style="--file:' + x + ';--rank:' + y + '" data-square="' + square + '" aria-label="' +
        square + (onSquare ? ', ' + pieces[onSquare.type] + ' (' + colorName[onSquare.color].toLowerCase() + ')' : '') +
        '">' + (onSquare ? pieceImage(onSquare) : '') + '</button>';
    }).join('')).join('') + '</div>' +
    (settings.coordinates ? '<div class="files" aria-hidden="true">' + coords(columns) + '</div>' : '') + '</div>';
}
function refreshBoard() {
  const targets = chosen && settings.hints ? game.chess.moves({square:chosen,verbose:true}).map(move => move.to) : [];
  app.querySelectorAll('[data-square]').forEach(cell => {
    const target = targets.includes(cell.dataset.square);
    cell.classList.toggle('selected',cell.dataset.square === chosen);
    cell.classList.toggle('hint',target);
    cell.classList.toggle('capture',target && !!cell.firstElementChild);
  });
}
function renderGame() {
  const p = game;
  const turn = colorName[p.chess.turn()];
  const status = translateResult(p.result) || (p.mode === 'puzzle' ? (p.ply === 1 ? text("Opponent is replying…", "Ответ соперника…") :
    puzzleTitle(p.ply === 2 ? 1 : puzzles[p.puzzle].count)) :
    p.review ? text("Position ", "Позиция ") + p.cursor + text(" of ", " из ") + p.review.length :
    p.draw ? (p.draw === p.side && p.mode === 'online' ? text("Draw offer sent", "Предложение ничьей отправлено") : text("Draw offered", "Предложена ничья")) :
    p.mode === 'cpu' && !activeSide() ? p.bot.name + text(" is thinking…", " думает…") :
    text(turn + ' to move', 'Ходят ' + turn.toLowerCase()) + (p.chess.isCheck() ? text(" · Check", " · Шах") : ''));
  let controls;
  if (p.mode === 'analysis') {
    controls = p.review ?
      control('previous',text("Back", "Назад"),'back') + control('forward',text("Forward", "Вперёд"),'next') + control('game-menu',text("Menu", "Меню"),'more',true) :
      control('undo',text("Undo move", "Отменить ход"),'undo') + control('flip',text("Flip", "Повернуть"),'flip') + control('game-menu',text("Menu", "Меню"),'more',true);
  } else if (p.mode === 'puzzle') {
    controls = control('hint',text("Hint", "Подсказка"),'target') +
      (p.result ? control('puzzle-next',text("Next", "Дальше"),'next') : control('retry',text("Restart", "Сначала"),'undo'));
  } else if (p.result) {
    controls = control('review',text("Review game", "Разобрать партию"),'chart') + control('game-back',text("Exit", "Выйти"),'back',true);
  } else {
    controls = control('moves',text("Moves", "Ходы"),'history') +
      (p.mode === 'online' ? control('draw',text("Draw", "Ничья"),'equal',true) : control('undo',text("Undo move", "Отменить ход"),'undo',true)) +
      control('resign',text("Resign", "Сдаться"),'flag',true) +
      '<span class="desktop-match-action">' + control('flip',text('Flip board','Повернуть доску'),'flip',true) + '</span>';
  }
  const recent = p.mode === 'analysis' && p.ply ? '<div class="glass moves"><span>' +
    p.chess.history().slice(-8).map(escape).join(' · ') + '</span><span>' + p.ply + '</span></div>' : '';
  const movesPanel = '<section class="desktop-moves"><h2>' + text('Moves', 'Ходы') +
    '</h2><div class="desktop-move-scroll">' + moveList() + '</div></section>';
  displayScreen(('<div class="shell game"><header><button class="glass circle" data-act="game-back" aria-label="' + text('Back', 'Назад') + '">') +
    icon('back') + '</button><h1 class="screen-title">' + escape(timed() ? formatLabel(p.format) : p.label) +
    '</h1><div class="spacer"></div></header><main class="match">' + player(opposite(p.orientation),'top') + board() +
    player(p.orientation,'bottom') + '<p class="match-status" role="status">' + escape(status) + '</p>' + recent +
    movesPanel + '<div class="match-controls">' + controls + '</div></main></div>');
  const desktopMoveScroll = app.querySelector('.desktop-move-scroll');
  desktopMoveScroll.scrollTop = desktopMoveScroll.scrollHeight;
  tick();
}
function selectSquare(square, landing) {
  if (!game || game.result || game.review || !activeSide()) return;
  if (chosen) {
    if (square === chosen) { chosen = null; refreshBoard(); return; }
    const moves = game.chess.moves({square:chosen,verbose:true}).filter(move => move.to === square);
    if (moves.length) {
      const {from,to,promotion} = moves[0];
      if (promotion) {
        pop(text("Pawn promotion", "Превращение пешки"),'<div class="promotion">' + moves.map(move =>
          '<button class="glass" data-act="promote" data-from="' + from + '" data-to="' + to +
          '" data-id="' + move.promotion + '" aria-label="' + pieces[move.promotion] + '">' +
          pieceImage({type:move.promotion,color:move.color}) + '</button>').join('') + '</div>');
        return;
      }
      play({from,to},false,landing);
      return true;
    }
  }
  const piece = game.chess.get(square);
  chosen = piece && piece.color === game.chess.turn() ? square : null;
  refreshBoard();
}
function play(move, remote = false, landing = null) {
  if (!game || game.result || game.review) return;
  tick();
  if (game.result) return;
  if (game.guest && !remote) {
    if (landing) pendingLanding = Object.assign({from:move.from,to:move.to,stamp:Date.now()},landing);
    chosen = null;
    refreshBoard();
    send({kind:'move', move, ply:game.ply});
    return;
  }
  const before = times();
  const movingColor = game.chess.turn();
  if (timed()) before[movingColor === 'w' ? 0 : 1] += formats[game.format].increment * 1000;
  const origins = squarePositions();
  let played;
  try { played = game.chess.move(move); } catch { return; }
  if (!played) return;
  chosen = null;
  if (game.mode === 'puzzle') {
    advancePuzzle(played,origins,landing);
    return;
  }
  game.timeHistory.push(game.clock.slice());
  game.ply++;
  game.lastMove = played;
  game.draw = null;
  game.clock = before;
  game.stamp = Date.now();
  if (timed() && game.chess.isCheckmate()) {
    outcome(colorName[opposite(game.chess.turn())] + text(" wins · Checkmate", " победили · Мат"));
    animateMove(played,origins,landing);
    return;
  }
  if (timed() && game.chess.isDraw()) {
    outcome(game.chess.isStalemate() ? text("Draw · Stalemate", "Ничья · Пат") : text("Draw", "Ничья"));
    animateMove(played,origins,landing);
    return;
  }
  persistGame();
  if (game.mode === 'online') sendState();
  if (page === 'game') {
    render();
    animateMove(played,origins,landing);
  }
  scheduleBot();
}


let botWorker = null;
let cancelStockfish = null;

function stopBot() {
  clearTimeout(botTimer);
  if (cancelStockfish) { cancelStockfish(); cancelStockfish = null; }
  if (botWorker) {
    botWorker.terminate();
    botWorker = null;
  }
}
function scheduleBot() {
  stopBot();
  const match = game;
  if (!match || match.mode !== 'cpu' || match.result || activeSide()) return;
  botTimer = setTimeout(() => {
    if (match !== game || match.result) return;
    const fen = match.chess.fen();
    const finish = move => {
      if (match !== game || match.result || match.chess.fen() !== fen) return;
      stopBot();
      if (move) play(move);
    };
    const fallback = () => {
      const run = () => finish(findBotMove(fen,match.bot));
      try {
        botWorker = new Worker('bot-worker.js');
        botWorker.onmessage = event => finish(event.data);
        botWorker.onerror = run;
        botWorker.postMessage({fen,bot:match.bot});
        botTimer = setTimeout(run,4500);
      } catch { run(); }
    };
    if (typeof match.bot.skill === 'number') {
      const remaining = times()[match.chess.turn() === 'w' ? 0 : 1];
      const bot = Object.assign({},match.bot,{limit:Math.min(match.bot.limit,Math.max(35,remaining-160))});
      cancelStockfish = searchStockfish(match.chess,bot,move => move ? finish(move) : fallback());
    } else fallback();
  }, 210);
}


function fadePreviousScreen(previous) {
  const oldLayer = document.querySelector('.screen-departure');
  if (oldLayer) oldLayer.remove();
  if (!previous.animate) return;
  const box = previous.getBoundingClientRect();
  const departure = previous.cloneNode(true);
  if (page !== 'game' && previous.classList.contains('tab-shell')) {
    const nav = departure.querySelector('.nav');
    if (nav) nav.style.visibility = 'hidden';
  }
  departure.removeAttribute('id');
  departure.setAttribute('aria-hidden','true');
  departure.setAttribute('inert','');
  departure.querySelectorAll('[id],[data-act],[data-square],button,input,textarea,select').forEach(element => {
    element.removeAttribute('id');
    element.removeAttribute('data-act');
    element.removeAttribute('data-square');
    element.setAttribute('tabindex','-1');
  });
  departure.classList.remove('launch-arrival','screen-arrival');
  departure.classList.add('screen-departure');
  Object.assign(departure.style,{left:box.left+'px',top:box.top+'px',width:box.width+'px',height:box.height+'px'});
  document.body.appendChild(departure);
  const fade = departure.animate([
    {opacity:.58,transform:'translate3d(0,0,0) scale(1)'},
    {opacity:.12,transform:'translate3d(0,-5px,0) scale(.995)',offset:.38},
    {opacity:0,transform:'translate3d(0,-12px,0) scale(.985)'}
  ],{duration:780,easing:'cubic-bezier(.28,.63,.22,1)',fill:'both'});
  fade.onfinish = () => departure.remove();
}

function springFrames(x, y, vx, vy, scale, duration, toX = 0, toY = 0) {
  const naturalFrequency = 9.6;
  const decay = naturalFrequency * .82;
  const frequency = Math.sqrt(naturalFrequency * naturalFrequency - decay * decay);
  const axis = (distance, velocity, t) => Math.exp(-decay*t) *
    (distance*Math.cos(frequency*t)+(velocity+decay*distance)*Math.sin(frequency*t)/frequency);
  const frames = [];
  for (let i = 0; i <= 32; i++) {
    const t = i * duration / 32000;
    const px = i === 32 ? toX : toX + axis(x,vx,t);
    const py = i === 32 ? toY : toY + axis(y,vy,t);
    const size = i === 32 ? 1 : 1 + axis(scale-1,0,t);
    frames.push({transform:'translate3d('+px.toFixed(2)+'px,'+py.toFixed(2)+'px,0) scale('+size.toFixed(4)+')'});
  }
  return frames;
}
function squarePositions() {
  if (!settings.motion || reducedMotion.matches) return null;
  const positions = {};
  app.querySelectorAll('.square > img').forEach(img => {
    const rect = img.getBoundingClientRect();
    positions[img.parentElement.dataset.square] = {x:rect.left,y:rect.top};
  });
  return positions;
}
function animateMove(move, origins, landing) {
  if (!move || !origins || reducedMotion.matches) return;
  const slide = (from, to, release) => {
    const square = app.querySelector('[data-square="' + to + '"]');
    const img = square && square.querySelector('img');
    const origin = release || origins[from];
    if (!img || !img.animate || !origin) return;
    const destination = img.getBoundingClientRect();
    const duration = release ? 740 : 870;
    square.classList.add('moving');
    const animation = img.animate(springFrames(origin.x-destination.left,origin.y-destination.top,
      origin.vx || 0,origin.vy || 0,release ? 1.07 : 1.035,duration),{duration,easing:'linear'});
    const rest = () => {
      const current = img.parentElement;
      if (current) current.classList.remove('moving');
    };
    animation.onfinish = rest;
    animation.oncancel = rest;
  };
  slide(move.from,move.to,landing);
  if (move.flags.indexOf('k') !== -1) slide('h'+move.from[1], 'f'+move.from[1]);
  if (move.flags.indexOf('q') !== -1) slide('a'+move.from[1], 'd'+move.from[1]);
}

const glassControl = '.primary,.tile,.resume-row,.nav button,.header-actions .circle,#dialog button.glass';
let litControl = null;
let lightPointer = null;

function aimLight(event) {
  const bounds = litControl.getBoundingClientRect();
  const at = (value,start,size) => Math.max(0,Math.min(100,(value-start)*100/Math.max(1,size)));
  litControl.style.setProperty('--light-x',at(event.clientX,bounds.left,bounds.width)+'%');
  litControl.style.setProperty('--light-y',at(event.clientY,bounds.top,bounds.height)+'%');
}
function releaseLight() {
  if (!litControl) return;
  litControl.classList.remove('touch-light');
  litControl = null;
  lightPointer = null;
}
document.addEventListener('pointerdown',event => {
  if (reducedMotion.matches || event.button !== 0) return;
  const control = event.target.closest(glassControl);
  if (!control) return;
  releaseLight();
  litControl = control;
  lightPointer = event.pointerId;
  aimLight(event);
  control.classList.add('touch-light');
});
document.addEventListener('pointermove',event => {
  if (litControl && event.pointerId === lightPointer) aimLight(event);
});
document.addEventListener('pointerup',event => { if (event.pointerId === lightPointer) releaseLight(); });
document.addEventListener('pointercancel',event => { if (event.pointerId === lightPointer) releaseLight(); });
window.addEventListener('blur',releaseLight);

document.addEventListener('pointerdown', event => {
  const cell = event.target.closest('[data-square]');
  if (!cell || event.button !== 0 || !game || game.result || game.review || dialogVisible || !activeSide()) return;
  const from = cell.dataset.square;
  const piece = game.chess.get(from);
  if (!piece || piece.color !== game.chess.turn()) return;
  drag = {cell, from, id:event.pointerId, x:event.clientX, y:event.clientY};
});
document.addEventListener('pointermove', event => {
  if (!drag || drag.id !== event.pointerId) return;
  if (!drag.ghost) {
    if (Math.hypot(event.clientX-drag.x,event.clientY-drag.y) < 6) return;
    const img = drag.cell.querySelector('img');
    if (!img || !drag.cell.isConnected) return;
    const bounds = img.getBoundingClientRect();
    drag.ghost = img.cloneNode();
    drag.ghost.classList.add('drag-piece');
    drag.ghost.style.width = bounds.width + 'px';
    drag.ghost.style.height = bounds.height + 'px';
    drag.offsetX = drag.x - bounds.left;
    drag.offsetY = drag.y - bounds.top;
    drag.originX = bounds.left;
    drag.originY = bounds.top;
    drag.cell.classList.add('drag-start');
    document.body.appendChild(drag.ghost);
    drag.cell.setPointerCapture(event.pointerId);
  }
  const x = event.clientX - drag.offsetX;
  const y = event.clientY - drag.offsetY;
  const t = event.timeStamp;
  if (drag.position && t > drag.position.t) {
    const dt = Math.max(12,t-drag.position.t);
    drag.vx = .5*(drag.vx || 0) + .5*(x-drag.position.x)*1000/dt;
    drag.vy = .5*(drag.vy || 0) + .5*(y-drag.position.y)*1000/dt;
  }
  drag.position = {x,y,t};
  drag.ghost.style.transform = 'translate3d(' + x + 'px,' + y + 'px,0) scale(1.07)';
});
function endDrag(event, cancelled) {
  if (!drag || drag.id !== event.pointerId) return;
  const source = drag;
  drag = null;
  if (!source.ghost) return;
  suppressBoardClick = true;
  setTimeout(() => { suppressBoardClick = false; }, 90);
  const settle = () => {
    source.ghost.remove();
    source.cell.classList.remove('drag-start');
  };
  if (!source.cell.isConnected) { settle(); return; }

  const hit = document.elementFromPoint(event.clientX, event.clientY);
  const destination = hit && hit.closest('[data-square]');
  const speed = value => Math.max(-650,Math.min(650,value || 0));
  const recent = source.position && event.timeStamp - source.position.t < 100;
  const landing = {x:source.position.x,y:source.position.y,vx:recent ? speed(source.vx) : 0,vy:recent ? speed(source.vy) : 0};

  if (!cancelled && destination && destination.dataset.square !== source.from) {
    chosen = source.from;
    if (selectSquare(destination.dataset.square,landing)) { settle(); return; }
  }
  if (!settings.motion || reducedMotion.matches || !source.ghost.animate) { settle(); return; }
  const duration = 690;
  const animation = source.ghost.animate(springFrames(landing.x-source.originX,landing.y-source.originY,
    landing.vx,landing.vy,1.07,duration,source.originX,source.originY),{duration,easing:'linear',fill:'both'});
  animation.onfinish = settle;
  animation.oncancel = settle;
}
document.addEventListener('pointerup', event => endDrag(event,false));
document.addEventListener('pointercancel', event => endDrag(event,true));


function showOnline() {
  if ((net && net.bound) && game && game.mode === 'online' && !game.result) {
    if (dialogVisible) closeDialog();
    page = 'game'; render(); return;
  }
  pop(text("Play online", "Играть онлайн"),('<p class="muted">' + text('Create a room with your chosen time control or enter a friend\'s invite code.', 'Создайте комнату со своим контролем времени или введите код друга.') + '</p>') +
    clockPicker(setup.format) + '<div class="dialog-actions">' + control('create-room',text("Create room", "Создать комнату"),'play') + '</div>' +
    ('<label>' + text('Invite code<input id="room" inputmode="numeric" maxlength="8" placeholder="8 digits', 'Код приглашения<input id="room" inputmode="numeric" maxlength="8" placeholder="8 цифр') + '" autocomplete="off"></label>') +
    '<div class="dialog-actions">' + control('close',text("Close", "Закрыть")) + control('join-room',text("Join with code", "Войти по коду"),'next') + '</div>' +
    '<div class="dialog-actions">' + control('computer',text("Play a bot", "С компьютером"),'bot') + '</div>');
}
function invitationUrl(code) {
  const url = new URL(window.location.href);
  url.search = '';
  url.hash = '';
  url.searchParams.set('room', code);
  return url.href;
}
function cleanupNetwork() {
  if (!net) return;
  const previous = net;
  net = null;
  clearTimeout(previous.timer);
  previous.peer.destroy();
}
function channelProblem(session, message) {
  if (net !== session) return;
  const playing = session.bound && game && game.mode === 'online' && !game.result;
  cleanupNetwork();
  if (playing) {
    if (dialogVisible) closeDialog();
    outcome(text("Connection lost", "Связь прервана"), false);
  } else if (dialogVisible && !session.bound) alertBox(text("Connection", "Подключение"), message);
}
function setupNetwork(code, guest, format = defaultFormat) {
  if (typeof Peer !== 'function' || !window.RTCPeerConnection) {
    alertBox(text("Connection", "Подключение"),text("WebRTC is unavailable on this device.", "На этом устройстве WebRTC недоступен."));
    return;
  }
  cleanupNetwork();
  const tag = 'kechess-v2-' + code;
  const peer = guest ? new Peer() : new Peer(tag);
  const session = net = {peer, code, guest, format, connection:null, bound:false, timer:null};
  const failed = () => channelProblem(session,text("Could not connect. Check your connection and room code.", "Не удалось подключиться. Проверьте интернет и код комнаты."));
  pop(text("Connection", "Подключение"),('<p class="muted">' + text('Connecting…', 'Устанавливаем связь…') + '</p><div class="dialog-actions">') + control('cancel-room',text("Cancel", "Отмена")) + '</div>');
  session.timer = setTimeout(failed, 24000);
  peer.on('error', () => { if (!session.bound || !(session.connection && session.connection.open)) failed(); });
  peer.on('open', () => {
    if (net !== session) return;
    if (guest) {
      attachConnection(session,peer.connect(tag,{reliable:true,serialization:'json',label:'kechess-v2'}));
    } else {
      clearTimeout(session.timer);
      pop(text("Room created", "Комната создана"),'<p class="muted">' + formatLabel(session.format) + (text(' · Send the code to a friend.', ' · Отправьте код другу.') + '</p>') +
        '<div class="glass invite">' + code + '</div><div class="dialog-actions">' +
        control('copy-room',text('Copy code', 'Копировать код')) +
        control('copy-room-link',text('Copy link', 'Копировать ссылку')) + '</div>' +
        '<div class="dialog-actions">' + control('cancel-room',text("Close room", "Закрыть комнату")) + '</div>');
    }
  });
  if (!guest) peer.on('connection', connection => {
    if (net !== session || session.connection || connection.label !== 'kechess-v2') {
      connection.on('open', () => connection.close());
      return;
    }
    attachConnection(session,connection);
  });
}
function attachConnection(session, connection) {
  session.connection = connection;
  clearTimeout(session.timer);
  session.timer = setTimeout(() => channelProblem(session,text("The player is unavailable. Check the room code and try again.", "Игрок недоступен. Проверьте код комнаты и попробуйте снова.")), 24000);
  connection.on('open', () => {
    if (net !== session) return;
    send({kind:'hello',name:'Гость'});
  });
  connection.on('data', event => {
    if (net !== session || !event || typeof event !== 'object') return;
    if (event.kind === 'hello' && typeof event.name === 'string') {
      session.opponent = opponentName(event.name.slice(0,28));
      if (!session.guest && !session.bound) {
        bindGame(session);
        sendState();
      }
      return;
    }
    if (session.guest && event.kind === 'state') {
      receiveState(session,event);
      return;
    }
    if (!session.bound || session.guest || game.result) return;
    if (event.kind === 'move' && event.move && game.chess.turn() === 'b' && event.ply === game.ply &&
        /^[a-h][1-8]$/.test(event.move.from) && /^[a-h][1-8]$/.test(event.move.to)) {
      play(event.move,true);
      return;
    }
    if (event.kind === 'resign') outcome(text("White wins · Resignation", "Белые победили · Сдача"));
    if (event.kind === 'draw') { tick(); if (!game.result) requestDraw('b'); }
  });
  connection.on('close', () => channelProblem(session,text("The connection to the player was closed.", "Соединение с игроком закрыто.")));
  connection.on('error', () => channelProblem(session,text("Connection error.", "Ошибка соединения.")));
}
function bindGame(session, id) {
  session.bound = true;
  clearTimeout(session.timer);
  newGame('online',{id,format:session.format,side:session.guest?'b':'w',guest:session.guest,opponent:session.opponent});
  page = 'game';
  if (dialogVisible) closeDialog();
  render();
}
function send(event) {
  if (!(net && net.connection && net.connection.open)) return;
  const session = net;
  try {
    Promise.resolve(session.connection.send(event)).catch(() => {
      channelProblem(session,text("Could not send the message.", "Не удалось отправить сообщение."));
    });
  } catch { channelProblem(session,text("Could not send the message.", "Не удалось отправить сообщение.")); }
}
function sendState() {
  if (!(net && net.bound) || net.guest) return;
  send({kind:'state', id:game.id, format:game.format, moves:game.chess.history(), clock:times(),
    result:translateResult(game.result, 'ru'), draw:game.draw});
}
function receiveState(session,state) {
  if (formatById(state.format) !== state.format) return;
  const controlTime = formats[state.format];
  const maxTime = controlTime.minutes * 60000 + (Array.isArray(state.moves) ? state.moves.length : 0) * controlTime.increment * 1000;
  if (typeof state.id !== 'string' || !/^\d{1,16}$/.test(state.id) || !Array.isArray(state.moves) || state.moves.length > 2500 ||
      !Array.isArray(state.clock) || state.clock.length !== 2 ||
      !state.clock.every(value => Number.isFinite(value) && value >= 0 && value <= maxTime) ||
      typeof state.result !== 'string' || state.result.length > 100 ||
      ![null,'w','b'].includes(state.draw)) return;
  if (session.bound && (game.result || state.format !== game.format || state.id !== game.id || state.moves.length < game.ply)) return;
  const chess = new Chess();
  try {
    for (const move of state.moves) { if (!chess.move(move)) return; }
  } catch { return; }
  if (!session.bound) { session.format = state.format; bindGame(session,state.id); }
  const changed = game.ply !== state.moves.length;
  const origins = changed ? squarePositions() : null;
  game.chess = chess;
  game.ply = state.moves.length;
  game.lastMove = chess.history({verbose:true})[game.ply - 1];
  game.clock = state.clock;
  game.stamp = Date.now();
  game.draw = state.draw;
  if (changed) chosen = null;
  if (state.result) {
    if (dialogVisible) closeDialog();
    outcome(state.result,false);
  } else if (page === 'game') render();
  if (changed && page === 'game') {
    const landing = pendingLanding;
    pendingLanding = null;
    animateMove(game.lastMove,origins,landing && game.lastMove &&
      landing.from === game.lastMove.from && landing.to === game.lastMove.to && Date.now() - landing.stamp < 800 ? landing : null);
  }
}
function requestDraw(color) {
  tick();
  if (game.result) return;
  if (game.guest) { send({kind:'draw'}); return; }
  if (game.draw && game.draw !== color) {
    outcome(text("Draw by agreement", "Ничья по соглашению"));
  } else {
    game.draw = color;
    if (game.mode === 'online') sendState();
    render();
  }
}
function review(pgn, label = text("Game analysis", "Анализ партии")) {
  let model = new Chess();
  try { model.loadPgn(pgn); }
  catch { alertBox(text("Invalid PGN", "Ошибка PGN"),text("Check the game notation and try again.", "Проверьте запись партии и попробуйте ещё раз.")); return; }
  const sequence = model.history();
  const initial = model.getHeaders().FEN;
  start('analysis',{label,fen:initial});
  if (sequence.length) {
    game.review = sequence;
    seek(sequence.length);
  }
}
function seek(index) {
  game.cursor = Math.max(0, Math.min(game.review.length,index));
  game.chess = new Chess(game.fen);
  game.review.slice(0,game.cursor).forEach(move => game.chess.move(move));
  game.ply = game.cursor;
  game.lastMove = game.chess.history({verbose:true})[game.ply - 1];
  chosen = null;
  render();
}
const puzzleOrder = [1,2].reduce((order,count) => {
  puzzles.forEach((puzzle,index) => { if (puzzle.count === count) order.push(index); });
  return order;
},[]);
function puzzleTitle(count) { return count === 1 ? text("Mate in one", "Мат в один ход") : text("Mate in two", "Мат в два хода"); }
function startPuzzle(index) {
  const puzzle = puzzles[index];
  start('puzzle',{fen:puzzle.fen,side:puzzle.fen.split(' ')[1],puzzle:index,label:text("Puzzle ", "Задача ") + (puzzleOrder.indexOf(index) + 1)});
}
function advancePuzzle(played,origins,landing) {
  const match = game;
  const puzzle = puzzles[match.puzzle];
  const notation = played.from + played.to + (played.promotion || '');
  const opening = !!puzzle.reply && match.ply === 0;
  const correct = opening ? notation === puzzle.first : match.chess.isCheckmate();
  if (!correct) {
    match.chess.undo();
    toastMessage(text("Try a different move", "Попробуйте другой ход"));
    render();
    return;
  }
  match.ply++;
  match.lastMove = played;
  if (!opening) {
    if (!solved.includes(match.puzzle)) { solved.push(match.puzzle); save('solved',solved); }
    outcome(text("Checkmate! Puzzle solved", "Мат! Задача решена"));
    animateMove(played,origins,landing);
    return;
  }
  render();
  animateMove(played,origins,landing);
  puzzleTimer = setTimeout(() => {
    if (game !== match || page !== 'game') return;
    const reply = puzzle.reply;
    const before = squarePositions();
    match.lastMove = match.chess.move({from:reply.slice(0,2),to:reply.slice(2,4),promotion:reply[4]});
    match.ply++;
    render();
    animateMove(match.lastMove,before);
  }, settings.motion && !reducedMotion.matches ? 780 : 0);
}
function homeFromGame() {
  const mode = game.mode;
  if (mode === 'online' && !game.result) {
    pop(text("Leave the game?", "Покинуть партию?"),('<p class="muted">' + text('Leaving the room gives your opponent the win.', 'Вы покинете комнату и уступите победу сопернику.') + '</p>') +
      '<div class="dialog-actions">' + control('close',text("Continue", "Продолжить")) + control('leave',text("Leave", "Покинуть"),'flag') + '</div>');
    return;
  }
  page = mode === 'puzzle' ? 'puzzles' : 'home';
  if (mode === 'online') cleanupNetwork();
  render();
}
function drawDialog() {
  if (game.mode === 'cpu') {
    const value = Math.abs(evaluation(game.chess,'w'));
    pop(text("Offer a draw?", "Предложить ничью?"),('<p class="muted">' + text('The bot accepts a draw in an even position after 10 moves.', 'Компьютер принимает ничью в равной позиции после 10 ходов.') + '</p>') +
      '<div class="dialog-actions">' + control('close',text("Cancel", "Отмена")) +
      (value < 75 && game.ply >= 20 ? control('cpu-draw',text("Offer", "Предложить")) : control('draw-decline',text("Offer", "Предложить"))) + '</div>');
  } else if (game.mode === 'online') {
    const label = game.draw === opposite(game.side) ? text("Accept draw", "Принять ничью") : text("Offer a draw", "Предложить ничью");
    pop(label,'<div class="dialog-actions">' + control('close',text("Cancel", "Отмена")) + control('send-draw',label) + '</div>');
  } else {
    pop(text("Agree to a draw?", "Ничья по соглашению?"),'<div class="dialog-actions">' +
      control('close',text("Cancel", "Отмена")) + control('cpu-draw',text("Accept", "Согласиться")) + '</div>');
  }
}
function resign(leave = false) {
  if (!game.result) {
    const loser = game.mode === 'local' ? game.chess.turn() : game.side;
    if (game.guest) send({kind:'resign'});
    outcome(colorName[opposite(loser)] + text(" wins · Resignation", " победили · Сдача"));
  }
  if (leave) {
    page = 'home';
    setTimeout(() => { if (game && game.mode === 'online' && game.result) cleanupNetwork(); }, 350);
    render();
  }
}
function handle(button) {
  const act = button.dataset.act;
  if (act.startsWith('nav-')) { page = act.slice(4); render(); return; }
  switch (act) {
    case 'close': closeDialog(); break;
    case 'quick-play': start('cpu',{bot:'mira',format:defaultFormat,side:'w'}); break;
    case 'play-menu':
      pop(text("Play", "Играть"),'<div class="play-options">' + row('online',text("Online with a friend", "Онлайн с другом"),'play') +
        row('local',text("Two players on one device", "Вдвоём на одном устройстве"),'user') + row('computer',text("Vs. bot", "С ботом"),'bot') + '</div>');
      break;
    case 'settings':
      if (page === 'settings') break;
      settingsReturn = page;
      page = 'settings'; render(); break;
    case 'settings-back': settingsBack(); break;
    case 'language':
      if (setInterfaceLanguage(button.dataset.id)) {
        render();
        app.querySelector('[data-act="language"][aria-pressed="true"]').focus({preventScroll:true});
      }
      break;
    case 'theme':
      if (isBoardPalette(button.dataset.id)) {
        settings.theme = button.dataset.id;
        applyBoardSettings();
      }
      break;
    case 'piece-style':
      settings.style = button.dataset.id === 'metal' ? 'metal' : 'classic';
      applyBoardSettings();
      break;
    case 'board-toggle':
      settings[button.dataset.id] = !settings[button.dataset.id];
      applyBoardSettings();
      break;
    case 'reset-board':
      Object.assign(settings,defaultBoardSettings);
      applyBoardSettings();
      break;
    case 'online': openMatchSetup('online'); break;
    case 'computer':
      if (dialogVisible) closeDialog();
      page = 'bots'; render(); break;
    case 'choose-bot': openMatchSetup('cpu',button.dataset.id); break;
    case 'local': openMatchSetup('local'); break;
    case 'time-format': selectClock(button); break;
    case 'side-option':
      setup.side = button.dataset.id;
      dialog.querySelectorAll('[data-act="side-option"]').forEach(item =>
        item.setAttribute('aria-pressed',String(item === button)));
      break;
    case 'start-match':
      save('time-format',setup.format);
      start(setup.mode,{bot:setup.bot,format:setup.format,side:setup.side === 'random' ? (Math.random()<.5?'w':'b') : setup.side});
      break;
    case 'resume':
      if (!game || game.result || !['cpu','local'].includes(game.mode)) restoreGame();
      if (game && !game.result) page = 'game';
      render();
      break;
    case 'new-cpu':
      pop(text("New game", "Новая партия"),('<p class="muted">' + text('Starting a new game replaces the current one.', 'Текущую партию заменит новая.') + '</p>') +
        '<div class="dialog-actions">' + control('close',text("Cancel", "Отмена")) + control('computer',text("Choose a bot", "Выбрать бота"),'bot') + '</div>');
      break;
    case 'moves': showMoves(); break;
    case 'puzzles': page = 'puzzles'; render(); break;
    case 'puzzle': startPuzzle(Number(button.dataset.id)); break;
    case 'puzzle-next': {
      const next = (puzzleOrder.indexOf(game.puzzle) + 1) % puzzleOrder.length;
      startPuzzle(puzzleOrder[next]);
      break;
    }
    case 'retry': startPuzzle(game.puzzle); break;
    case 'hint': {
      const puzzle = puzzles[game.puzzle];
      alertBox(text("Hint", "Подсказка"),game.ply >= 2 && puzzle.finishHint ? puzzle.finishHint : puzzle.hint);
      break;
    }
    case 'analysis':
      pop(text("Analysis", "Анализ"),('<p class="muted">' + text('Load a PGN to review a game, or start from the initial position.', 'Разберите партию из PGN или начните со стартовой позиции.') + '</p>') +
        ('<label>' + text('Game notation (PGN)', 'Запись партии (PGN)') + '<textarea id="pgn" spellcheck="false" placeholder="1. e4 e5 2. Nf3"></textarea></label>') +
        '<div class="dialog-actions">' + control('close',text("Cancel", "Отмена")) + control('load-analysis',text("Open", "Открыть"),'chart') + '</div>');
      break;
    case 'load-analysis': {
      const pgn = document.querySelector('#pgn').value.trim();
      if (pgn) review(pgn); else start('analysis',{label:text("Analysis", "Анализ")});
      break;
    }
    case 'review': review(game.chess.pgn()); break;
    case 'record': review(history.find(item => item.id === button.dataset.id).pgn); break;
    case 'previous': seek(game.cursor-1); break;
    case 'forward': seek(game.cursor+1); break;
    case 'undo': undoMove(); break;
    case 'create-room': {
      const number = crypto.getRandomValues(new Uint32Array(1))[0] % 90000000 + 10000000;
      save('time-format',setup.format);
      setupNetwork(String(number),false,setup.format); break;
    }
    case 'join-room': {
      const code = document.querySelector('#room').value.trim();
      if (!/^\d{8}$/.test(code)) { toastMessage(text("Enter an 8-digit code", "Введите код из 8 цифр")); break; }
      setupNetwork(code,true); break;
    }
    case 'cancel-room': cleanupNetwork(); closeDialog(); break;
    case 'copy-room': if (net) share(net.code,true); break;
    case 'copy-room-link': if (net) share(invitationUrl(net.code),true); break;
    case 'game-menu':
      pop(text("Game menu", "Меню партии"),'<div class="dialog-actions">' +
        control('flip',text("Flip board", "Повернуть доску"),'flip') + control('share-pgn',text("Share PGN", "Поделиться PGN")) + '</div>' +
        (timed() && !game.result ? '<div class="dialog-actions">' + control('draw',text("Offer a draw", "Предложить ничью"),'equal') + '</div>' : '') +
        (game.mode === 'cpu' ? '<div class="dialog-actions">' + control('new-cpu',text("New game", "Новая партия"),'play') + '</div>' : '') +
        '<div class="dialog-actions">' + control('close',text("Close", "Закрыть")) + '</div>');
      break;
    case 'flip':
      if (dialogVisible) closeDialog();
      game.orientation = opposite(game.orientation); chosen = null; persistGame(); render(); break;
    case 'share-pgn': share(game.chess.pgn()); break;
    case 'game-back': homeFromGame(); break;
    case 'resign':
      pop(text("Resign?", "Сдаться?"),'<div class="dialog-actions">' + control('close',text("Continue", "Продолжить")) + control('confirm-resign',text("Resign", "Сдаться"),'flag') + '</div>');
      break;
    case 'confirm-resign': closeDialog(); resign(); break;
    case 'leave': closeDialog(); resign(true); break;
    case 'draw': drawDialog(); break;
    case 'cpu-draw': closeDialog(); outcome(text("Draw by agreement", "Ничья по соглашению")); break;
    case 'draw-decline': closeDialog(); toastMessage(text("The bot declined the draw", "Компьютер отклонил ничью")); break;
    case 'send-draw': closeDialog(); requestDraw(game.side); break;
    case 'promote':
      closeDialog();
      play({from:button.dataset.from,to:button.dataset.to,promotion:button.dataset.id}); break;
  }
}

document.addEventListener('click', event => {
  const button = event.target.closest('button');
  if (!button) return;
  if (dialogVisible && !dialog.contains(button)) return;
  if (button.dataset.act) handle(button);
  else if (button.dataset.square && !suppressBoardClick) selectSquare(button.dataset.square);
});
overlay.addEventListener('click', event => { if (event.target === overlay) dismissDialog(); });
document.addEventListener('keydown', event => {
  if (!dialogVisible) return;
  if (event.key === 'Escape') { event.preventDefault(); dismissDialog(); }
  if (event.key !== 'Tab') return;
  const items = Array.from(dialog.querySelectorAll('button:not([disabled]),input,textarea,select'));
  if (!items.length) { event.preventDefault(); return; }
  const boundary = event.shiftKey ? items[0] : items[items.length - 1];
  if (document.activeElement === boundary || document.activeElement === dialog) {
    event.preventDefault();
    (event.shiftKey ? items[items.length - 1] : items[0]).focus();
  }
});
window.kechessBack = () => {
  if (dialogVisible) {
    if (net && !net.bound) cleanupNetwork();
    closeDialog();
    return true;
  }
  if (page === 'game') { homeFromGame(); return true; }
  if (page === 'settings') { settingsBack(); return true; }
  if (page !== 'home') { page = 'home'; render(); return true; }
  return false;
};
function revealApp() {
  const splash = document.querySelector('#boot');
  restoreGame();
  render();
  const code = new URLSearchParams(window.location.search).get('room');
  if (/^\d{8}$/.test(code || '')) {
    openMatchSetup('online');
    dialog.querySelector('#room').value = code;
  }
  splash.classList.add('boot-ready');
  setTimeout(() => splash.remove(),reducedMotion.matches ? 0 : 720);
}
function startApp() {
  let revealed = false;
  const ready = () => {
    if (revealed) return;
    revealed = true;
    requestAnimationFrame(revealApp);
  };
  if (matchMedia('(min-width: 900px)').matches) ready();
  else {
    const image = new Image();
    image.onload = () => {
      if (typeof image.decode === 'function') image.decode().then(ready,ready);
      else ready();
    };
    image.onerror = ready;
    image.src = 'pearl-reference.png';
    setTimeout(ready,1500);
  }
  ['w','b'].forEach(color => {
    Object.keys(pieces).forEach(type => {
      const piece = new Image();
      piece.src = boardPiecePath({color,type},settings.style);
    });
  });
}

function sizeSculpture() {
  const hero = app.querySelector('.hero');
  if (!hero) return;
  const {clientWidth, clientHeight} = hero;
  hero.firstElementChild.style.width = Math.floor(Math.min(clientWidth, clientHeight * 545 / 346, 550)) + 'px';
}

window.addEventListener('resize', sizeSculpture);

startApp();
