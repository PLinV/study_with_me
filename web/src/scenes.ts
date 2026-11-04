export interface Scene {
  label: string;
  url: string;
  private: boolean;
}

interface AutoindexEntry {
  name: string;
  type: 'file' | 'directory';
}

const VIDEO_RE = /\.(mp4|webm)$/i;

/** Scènes dessinées dans le code (voir pixelScenes/), toujours disponibles. */
export const BUILTIN_PREFIX = 'builtin:';
const BUILTIN: Scene[] = [{ label: 'Feu de camp pixel (renard)', url: `${BUILTIN_PREFIX}campfire`, private: false }];

async function listDir(path: string, isPrivate: boolean): Promise<Scene[]> {
  try {
    const res = await fetch(path);
    if (!res.ok) return [];
    const entries: AutoindexEntry[] = await res.json();
    return entries
      .filter((e) => e.type === 'file' && VIDEO_RE.test(e.name))
      .map((e) => ({
        label: e.name.replace(VIDEO_RE, '').replace(/[-_]+/g, ' '),
        url: path + encodeURIComponent(e.name),
        private: isPrivate,
      }));
  } catch {
    return [];
  }
}

/** Lit le listing JSON de nginx pour /scenes/ et /scenes/private/. */
export async function listScenes(): Promise<Scene[]> {
  const [pub, priv] = await Promise.all([listDir('/scenes/', false), listDir('/scenes/private/', true)]);
  return [...BUILTIN, ...pub, ...priv];
}

export function pickScene(scenes: Scene[], wanted: string): Scene | null {
  if (wanted === 'none' || scenes.length === 0) return null;
  return scenes.find((s) => s.url === wanted) ?? scenes[Math.floor(Math.random() * scenes.length)];
}
