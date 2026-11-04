// Scène pixel art "feu de camp de nuit avec un renard", dessinée dans un petit canvas
// (320x180) agrandi en CSS avec image-rendering: pixelated. 100 % maison, donc libre de droit.

export const WIDTH = 320;
export const HEIGHT = 180;

type Ctx = CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D;

// L'animation suit la fréquence de l'écran (60, 120, 144 Hz…), plafonnée à 144 images/s.
const MAX_FPS = 144;
// Le feu garde un scintillement "rétro" : son tirage aléatoire ne change que 12 fois par seconde.
const FLICKER_HZ = 12;
const BLOCK = 4;

// Générateur pseudo-aléatoire déterministe : le paysage est le même à chaque chargement.
function mulberry32(seed: number): () => number {
  return () => {
    seed |= 0;
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const FIRE = { x: 280, y: 122 };
const FOX = { x: 230, y: 113 };
const MOON = { x: 112, y: 20, size: 16 };

// ---------- Couche fixe : ciel ----------

const SKY = ['#070b1a', '#0a1024', '#0d142d', '#111a37', '#162040', '#1c2546', '#252a4b', '#30304e', '#3b324f'];

function drawSky(ctx: Ctx): void {
  const horizon = 125;
  for (let y = 0; y < HEIGHT; y++) {
    const t = Math.min(1, y / horizon);
    const band = t * (SKY.length - 1);
    const lower = Math.floor(band);
    const frac = band - lower;
    for (let x = 0; x < WIDTH; x += 2) {
      // tramage en damier entre deux bandes, comme les vieux jeux
      const dither = frac > 0.5 && (x / 2 + y) % 2 === 0;
      ctx.fillStyle = SKY[Math.min(SKY.length - 1, lower + (dither ? 1 : 0))];
      ctx.fillRect(x, y, 2, 1);
    }
  }
}

// ---------- Couche fixe : paysage ----------

function ridge(rand: () => number, base: number, amplitude: number, step: number): number[] {
  const heights: number[] = [];
  let h = base;
  for (let x = 0; x < WIDTH; x += step) {
    h += Math.round((rand() - 0.5) * amplitude) * BLOCK;
    h = Math.max(base - 6 * BLOCK, Math.min(base + 4 * BLOCK, h));
    heights.push(h);
  }
  return heights;
}

function drawPine(ctx: Ctx, x: number, baseY: number, height: number, color: string): void {
  ctx.fillStyle = color;
  ctx.fillRect(x - 1, baseY - 3, 2, 3);
  for (let i = 0; i < height; i += 2) {
    const half = Math.max(1, Math.round(((height - i) / height) * (height / 3)) - ((i / 2) % 2));
    ctx.fillRect(x - half, baseY - 3 - i, half * 2, 2);
  }
}

function drawLandscape(ctx: Ctx): void {
  const rand = mulberry32(418);

  // montagnes lointaines avec un peu de neige au sommet
  const far = ridge(rand, 88, 3, BLOCK * 2);
  far.forEach((top, i) => {
    const x = i * BLOCK * 2;
    ctx.fillStyle = '#1f2742';
    ctx.fillRect(x, top, BLOCK * 2, HEIGHT - top);
    ctx.fillStyle = '#39456a';
    ctx.fillRect(x, top, BLOCK * 2, BLOCK);
  });

  // collines de sapins
  const mid = ridge(rand, 110, 2, BLOCK * 2);
  mid.forEach((top, i) => {
    ctx.fillStyle = '#141b2e';
    ctx.fillRect(i * BLOCK * 2, top, BLOCK * 2, HEIGHT - top);
  });
  for (let x = 2; x < WIDTH; x += 5 + Math.floor(rand() * 6)) {
    const top = mid[Math.min(mid.length - 1, Math.floor(x / (BLOCK * 2)))];
    drawPine(ctx, x, top + 2, 10 + Math.floor(rand() * 14), rand() > 0.5 ? '#10172a' : '#0d1323');
  }

  // falaise enneigée au premier plan (en escalier, blocs de 4 px)
  const ledges = [
    { x0: 72, x1: 152, top: 148 },
    { x0: 140, x1: WIDTH, top: 112 },
  ];
  for (const { x0, x1, top } of ledges) {
    for (let x = x0; x < x1; x += BLOCK) {
      for (let y = top; y < HEIGHT; y += BLOCK) {
        const depth = (y - top) / BLOCK;
        const noise = rand();
        let color: string;
        if (depth < 4) color = noise > 0.85 ? '#b9c0cc' : noise > 0.5 ? '#c9cfd8' : '#d3d8e0';
        else if (depth === 4) color = '#9aa2b0';
        else color = noise > 0.7 ? '#4e5563' : noise > 0.35 ? '#5a6271' : '#636b7a';
        ctx.fillStyle = color;
        ctx.fillRect(x, y, BLOCK, BLOCK);
      }
    }
  }

  // tapis de podzol autour du feu
  for (let x = FIRE.x - 84; x < WIDTH; x += BLOCK) {
    for (let y = 112; y < 128; y += BLOCK) {
      const dx = (x - (FIRE.x - 20)) / 62;
      const dy = (y - 120) / 9;
      if (dx * dx + dy * dy > 1 || rand() < 0.08) continue;
      const noise = rand();
      ctx.fillStyle = noise > 0.66 ? '#5a3720' : noise > 0.33 ? '#6b4428' : '#7a5130';
      ctx.fillRect(x, y, BLOCK, BLOCK);
      if (rand() > 0.7) {
        ctx.fillStyle = '#8f6a3a';
        ctx.fillRect(x + 1, y + 1, 1, 1);
      }
    }
  }

  // bûches du feu de camp
  ctx.fillStyle = '#4a2f1a';
  ctx.fillRect(FIRE.x - 10, FIRE.y - 2, 20, 4);
  ctx.fillStyle = '#6e4a2a';
  ctx.fillRect(FIRE.x - 10, FIRE.y - 2, 20, 1);
  ctx.fillRect(FIRE.x - 8, FIRE.y - 5, 16, 3);
  ctx.fillStyle = '#2b2b2b';
  ctx.fillRect(FIRE.x - 6, FIRE.y - 3, 12, 1);
}

// ---------- Sprites ----------

const FOX_SPRITE = [
  '...o....o..............',
  '..oO...oO..............',
  '..OOOOOOO...oooooo.....',
  '.OOOOOOOOOoOOOOOOOOo...',
  'OOOKKOOOOOOOOOOOOOOOOO.',
  'WOOOOOOOOOOOOOOOOOOOOOO',
  'WWWOOOOOOOOOOOOOOOOOWWW',
  '.WWWWWOOOOOOOOOOOOWWWWW',
  '..WWWWWWWWWWWWWWWWWWWW.',
  '...KK..........KK......',
];

const FOX_COLORS: Record<string, string> = {
  O: '#d9762b',
  o: '#a4511c',
  W: '#f1e6d8',
  K: '#2a1a12',
};

function drawFox(ctx: CanvasRenderingContext2D, t: number): void {
  // respiration : le dos se soulève d'un pixel
  const inhale = Math.sin((t * Math.PI * 2) / 3.6) > 0.2;
  FOX_SPRITE.forEach((row, y) => {
    [...row].forEach((c, x) => {
      const color = FOX_COLORS[c];
      if (!color) return;
      ctx.fillStyle = color;
      ctx.fillRect(FOX.x + x, FOX.y + y, 1, 1);
    });
  });
  if (inhale) {
    ctx.fillStyle = FOX_COLORS.o;
    ctx.fillRect(FOX.x + 12, FOX.y + 1, 6, 1);
    ctx.fillStyle = FOX_COLORS.O;
    ctx.fillRect(FOX.x + 12, FOX.y + 2, 6, 1);
  }
}

function drawMoon(ctx: CanvasRenderingContext2D): void {
  const { x, y, size } = MOON;
  ctx.fillStyle = 'rgba(160, 210, 255, 0.08)';
  ctx.fillRect(x - 6, y - 6, size + 12, size + 12);
  ctx.fillStyle = 'rgba(160, 210, 255, 0.12)';
  ctx.fillRect(x - 3, y - 3, size + 6, size + 6);
  ctx.fillStyle = '#d4ecff';
  ctx.fillRect(x, y, size, size);
  ctx.fillStyle = '#a9cbe8';
  for (const [dx, dy, s] of [[3, 3, 4], [9, 6, 3], [5, 10, 3], [11, 11, 2]]) ctx.fillRect(x + dx, y + dy, s, s);
}

// ---------- Particules ----------

interface Star {
  x: number;
  y: number;
  phase: number;
  speed: number;
}

interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  size: number;
  life: number;
  maxLife: number;
}

const FLAME = ['#fff6b0', '#ffd23f', '#ff9a1f', '#f0601a', '#b8340f'];

function drawFlames(ctx: CanvasRenderingContext2D, rand: () => number): void {
  for (let x = -8; x < 8; x += 2) {
    const center = 1 - Math.abs(x + 1) / 9;
    const height = Math.round(center * (10 + rand() * 9));
    for (let h = 0; h < height; h += 2) {
      const ratio = h / Math.max(1, height);
      const color = FLAME[Math.min(FLAME.length - 1, Math.floor(ratio * FLAME.length + rand() * 0.8))];
      ctx.fillStyle = color;
      ctx.fillRect(FIRE.x + x, FIRE.y - 5 - h, 2, 2);
    }
  }
  // étincelles
  if (rand() > 0.6) {
    ctx.fillStyle = '#ffd23f';
    ctx.fillRect(FIRE.x - 6 + Math.floor(rand() * 12), FIRE.y - 20 - Math.floor(rand() * 10), 1, 1);
  }
}

function drawGlow(ctx: CanvasRenderingContext2D, t: number, rand: () => number): void {
  const radius = 64 + Math.sin(t * 7) * 3 + rand() * 4;
  const gradient = ctx.createRadialGradient(FIRE.x, FIRE.y - 8, 2, FIRE.x, FIRE.y - 8, radius);
  gradient.addColorStop(0, 'rgba(255, 170, 70, 0.45)');
  gradient.addColorStop(0.4, 'rgba(255, 120, 40, 0.16)');
  gradient.addColorStop(1, 'rgba(255, 100, 30, 0)');
  ctx.save();
  ctx.globalCompositeOperation = 'lighter';
  ctx.fillStyle = gradient;
  ctx.fillRect(FIRE.x - radius, FIRE.y - 8 - radius, radius * 2, radius * 2);
  ctx.restore();
}

/** Lance l'animation dans le canvas. Renvoie une fonction pour l'arrêter. */
export function startCampfireScene(canvas: HTMLCanvasElement): () => void {
  canvas.width = WIDTH;
  canvas.height = HEIGHT;
  const ctx = canvas.getContext('2d')!;
  ctx.imageSmoothingEnabled = false;

  const sky = new OffscreenCanvas(WIDTH, HEIGHT);
  drawSky(sky.getContext('2d')!);
  const land = new OffscreenCanvas(WIDTH, HEIGHT);
  drawLandscape(land.getContext('2d')!);

  const rand = mulberry32(Date.now());
  const starRand = mulberry32(7);
  const stars: Star[] = Array.from({ length: 80 }, () => ({
    x: Math.floor(starRand() * WIDTH),
    y: Math.floor(starRand() * 100),
    phase: starRand() * Math.PI * 2,
    speed: 0.5 + starRand() * 2,
  }));
  const snow: Particle[] = Array.from({ length: 70 }, () => ({
    x: rand() * WIDTH,
    y: rand() * HEIGHT,
    vx: 0,
    vy: 6 + rand() * 8,
    size: rand() > 0.85 ? 2 : 1,
    life: 0,
    maxLife: 0,
  }));
  let smoke: Particle[] = [];
  const zzz: Particle[] = [];

  let frame = 0;
  let last = 0;
  let smokeTimer = 0;
  let zTimer = 0;

  const render = (now: number) => {
    frame = requestAnimationFrame(render);
    // petite marge pour ne pas sauter une image sur un écran à exactement 144 Hz
    if (now - last < 1000 / MAX_FPS - 1) return;
    const dt = last ? Math.min(0.25, (now - last) / 1000) : 0;
    last = now;
    const t = now / 1000;

    ctx.drawImage(sky, 0, 0);
    for (const s of stars) {
      const b = 0.45 + 0.55 * Math.abs(Math.sin(t * s.speed + s.phase));
      ctx.fillStyle = `rgba(230, 240, 255, ${b.toFixed(2)})`;
      ctx.fillRect(s.x, s.y, 1, 1);
    }
    drawMoon(ctx);
    ctx.drawImage(land, 0, 0);

    const flicker = mulberry32(Math.floor(t * FLICKER_HZ));
    drawGlow(ctx, t, flicker);
    drawFox(ctx, t);
    drawFlames(ctx, flicker);

    // fumée qui monte en dérivant
    smokeTimer -= dt;
    if (smokeTimer <= 0) {
      smokeTimer = 0.35 + rand() * 0.3;
      smoke.push({ x: FIRE.x - 3 + rand() * 6, y: FIRE.y - 22, vx: 0, vy: -(7 + rand() * 5), size: 3 + Math.floor(rand() * 3), life: 0, maxLife: 6 + rand() * 4 });
    }
    smoke = smoke.filter((p) => (p.life += dt) < p.maxLife);
    for (const p of smoke) {
      p.y += p.vy * dt;
      p.x += Math.sin(p.life * 1.3 + p.maxLife) * 3 * dt + 2 * dt;
      const alpha = 0.5 * (1 - p.life / p.maxLife);
      const size = p.size + Math.floor(p.life);
      ctx.fillStyle = `rgba(150, 138, 125, ${alpha.toFixed(2)})`;
      ctx.fillRect(Math.round(p.x), Math.round(p.y), size, size);
    }

    // "z" qui s'envolent au-dessus du renard
    zTimer -= dt;
    if (zTimer <= 0) {
      zTimer = 2.5 + rand() * 2;
      zzz.push({ x: FOX.x + 4, y: FOX.y - 3, vx: 2, vy: -4, size: 3, life: 0, maxLife: 3 });
    }
    for (let i = zzz.length - 1; i >= 0; i--) {
      const z = zzz[i];
      z.life += dt;
      if (z.life > z.maxLife) {
        zzz.splice(i, 1);
        continue;
      }
      z.x += z.vx * dt;
      z.y += z.vy * dt;
      ctx.fillStyle = `rgba(255, 255, 255, ${(0.8 * (1 - z.life / z.maxLife)).toFixed(2)})`;
      const x = Math.round(z.x);
      const y = Math.round(z.y);
      ctx.fillRect(x, y, 3, 1);
      ctx.fillRect(x + 1, y + 1, 1, 1);
      ctx.fillRect(x, y + 2, 3, 1);
    }

    // neige
    ctx.fillStyle = 'rgba(255, 255, 255, 0.75)';
    for (const f of snow) {
      f.y += f.vy * dt;
      f.x += Math.sin(t + f.vy) * 4 * dt + 3 * dt;
      if (f.y > HEIGHT) {
        f.y = -2;
        f.x = rand() * WIDTH;
      }
      if (f.x > WIDTH) f.x -= WIDTH;
      ctx.fillRect(Math.round(f.x), Math.round(f.y), f.size, f.size);
    }
  };

  frame = requestAnimationFrame(render);
  return () => cancelAnimationFrame(frame);
}
