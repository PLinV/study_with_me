// Petites icônes pixel art dessinées en grille : un caractère = un pixel.
// 'X' prend la couleur du texte (currentColor), les autres lettres une couleur fixe.

type Palette = Record<string, string>;

function pixelIcon(grid: string[], palette: Palette = {}): string {
  const colors: Palette = { X: 'currentColor', ...palette };
  const width = Math.max(...grid.map((row) => row.length));
  let rects = '';
  grid.forEach((row, y) => {
    [...row].forEach((c, x) => {
      const fill = colors[c];
      if (fill) rects += `<rect x="${x}" y="${y}" width="1.02" height="1.02" fill="${fill}"/>`;
    });
  });
  return `<svg viewBox="0 0 ${width} ${grid.length}" shape-rendering="crispEdges" aria-hidden="true">${rects}</svg>`;
}

export const tomato = pixelIcon(
  [
    '.....g.g....',
    '...gGGGGg...',
    '..RRgGGgRR..',
    '.RRRRgGRRRR.',
    'RRWWRRRRRRRR',
    'RWWRRRRRRRRD',
    'RWRRRRRRRRRD',
    'RRRRRRRRRRRD',
    'RRRRRRRRRRDD',
    '.RRRRRRRRDD.',
    '..DRRRRRDD..',
    '....DDDD....',
  ],
  { g: '#2f7d2a', G: '#4fbf3a', R: '#d93a32', D: '#9b1f24', W: '#ff9e8c' },
);

export const cup = pixelIcon(
  [
    '...s..s.....',
    '....s..s....',
    '...s..s.....',
    '............',
    'WWWWWWWWW...',
    'WBBBBBBBWWW.',
    'WBBBBBBBW.W.',
    'WBBBBBBBW.W.',
    'WBBBBBBBWWW.',
    '.WBBBBBW....',
    '..WWWWW.....',
    'PPPPPPPPPP..',
  ],
  { s: '#d9d9d9', W: '#f2f2f2', B: '#7a4a2a', P: '#b0b0b0' },
);

export const noteBlock = pixelIcon(
  [
    'LLLLLLLLLLLL',
    'LDDDDDDDDDDL',
    'LDKKKKKKKKDL',
    'LDKDDDDDDKDL',
    'LDKKKKKKKKDL',
    'LDDDDDDDDDDL',
    'LMDMDMDMDMDL',
    'LDMDMDMDMDML',
    'LMDMDMDMDMDL',
    'LDMDMDMDMDML',
    'LDDDDDDDDDDL',
    'LLLLLLLLLLLL',
  ],
  { L: '#5a2e1a', D: '#8a4a2a', K: '#2a160c', M: '#6e3a20' },
);

export const play = pixelIcon(['X......', 'XXX....', 'XXXXX..', 'XXXXXXX', 'XXXXX..', 'XXX....', 'X......']);

export const pause = pixelIcon(['XX.XX', 'XX.XX', 'XX.XX', 'XX.XX', 'XX.XX', 'XX.XX', 'XX.XX']);

export const next = pixelIcon(['X..X...X', 'XX.XX..X', 'XXXXXX.X', 'XX.XX..X', 'X..X...X']);

export const prev = pixelIcon(['X...X..X', 'X..XX.XX', 'X.XXXXXX', 'X..XX.XX', 'X...X..X']);

export const restart = pixelIcon([
  '..XXX.X',
  '.X...XX',
  'X...XXX',
  'X......',
  'X.....X',
  '.X...X.',
  '..XXX..',
]);

export const gear = pixelIcon([
  '..X.X..',
  '.XXXXX.',
  'XXX.XXX',
  '.X...X.',
  'XXX.XXX',
  '.XXXXX.',
  '..X.X..',
]);

export const fullscreen = pixelIcon([
  'XXX.XXX',
  'X.....X',
  'X.....X',
  '.......',
  'X.....X',
  'X.....X',
  'XXX.XXX',
]);

export const speaker = pixelIcon(['...X...', '..XX.X.', 'XXXX..X', 'XXXX..X', 'XXXX..X', '..XX.X.', '...X...']);

export const search = pixelIcon([
  '.XXX...',
  'X...X..',
  'X...X..',
  'X...X..',
  '.XXXX..',
  '....XX.',
  '.....XX',
]);
