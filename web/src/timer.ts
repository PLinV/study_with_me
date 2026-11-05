export type Phase = 'focus' | 'short_break' | 'long_break';

export interface TimerConfig {
  focusMin: number;
  shortBreakMin: number;
  longBreakMin: number;
  pomodorosPerSet: number;
  autoStart: boolean;
}

export interface SessionRecord {
  id: string;
  kind: Phase;
  startedAt: string;
  endedAt: string;
  plannedSeconds: number;
  actualSeconds: number;
  completed: boolean;
}

export interface TimerEvents {
  onTick(): void;
  onSessionEnd(record: SessionRecord): void;
  /** Appelé quand le timer passe à la phase suivante (fin naturelle ou "passer"). */
  onPhaseChange(next: Phase, finished: Phase, completed: boolean): void;
}

const TICK_MS = 250;

/**
 * crypto.randomUUID() n'existe qu'en contexte sécurisé (https ou 127.0.0.1).
 * Sur un homelab ouvert en http://192.168.x.x, on fabrique l'UUID v4 nous-mêmes.
 */
function uuid(): string {
  if (typeof crypto.randomUUID === 'function') return crypto.randomUUID();
  const bytes = crypto.getRandomValues(new Uint8Array(16));
  bytes[6] = (bytes[6] & 0x0f) | 0x40;
  bytes[8] = (bytes[8] & 0x3f) | 0x80;
  const hex = Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('');
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}

/**
 * Le temps restant est toujours recalculé depuis une heure de fin absolue,
 * pour ne pas dériver quand le navigateur ralentit les onglets en arrière-plan.
 */
export class PomodoroTimer {
  phase: Phase = 'focus';
  /** Numéro du pomodoro dans la série en cours (1..pomodorosPerSet). */
  index = 1;
  running = false;

  private config: TimerConfig;
  private events: TimerEvents;
  private durationMs = 0;
  private remainingMs = 0;
  private endAt = 0;
  private activeMs = 0;
  private segmentStart = 0;
  private phaseStartedAt: number | null = null;
  private interval: number | undefined;

  constructor(config: TimerConfig, events: TimerEvents) {
    this.config = config;
    this.events = events;
    this.loadPhase();
  }

  get remaining(): number {
    return this.running ? Math.max(0, this.endAt - Date.now()) : this.remainingMs;
  }

  get progress(): number {
    return 1 - this.remaining / this.durationMs;
  }

  get pomodorosPerSet(): number {
    return this.config.pomodorosPerSet;
  }

  get started(): boolean {
    return this.phaseStartedAt !== null;
  }

  start(): void {
    if (this.running) return;
    const now = Date.now();
    this.phaseStartedAt ??= now;
    this.segmentStart = now;
    this.endAt = now + this.remainingMs;
    this.running = true;
    this.interval = window.setInterval(() => this.tick(), TICK_MS);
    this.events.onTick();
  }

  pause(): void {
    if (!this.running) return;
    const now = Date.now();
    this.remainingMs = Math.max(0, this.endAt - now);
    this.activeMs += now - this.segmentStart;
    this.stop();
    this.events.onTick();
  }

  toggle(): void {
    if (this.running) this.pause();
    else this.start();
  }

  /** Termine la phase en cours sans attendre la fin et passe à la suivante. */
  skip(): void {
    this.finish(false);
  }

  /** Recommence la phase en cours depuis le début (le temps déjà fait est gardé dans les stats). */
  restartPhase(): void {
    this.recordPartial();
    this.loadPhase();
    this.events.onTick();
  }

  /** Recommence une série complète au pomodoro 1. */
  newSet(): void {
    this.recordPartial();
    this.phase = 'focus';
    this.index = 1;
    this.loadPhase();
    this.events.onTick();
  }

  setConfig(config: TimerConfig): void {
    this.config = config;
    // On n'écrase pas une phase déjà commencée ; les nouvelles durées s'appliquent à la suivante.
    if (!this.started) this.loadPhase();
    this.events.onTick();
  }

  private tick(): void {
    if (Date.now() >= this.endAt) this.finish(true);
    else this.events.onTick();
  }

  private finish(completed: boolean): void {
    const endMs = completed ? this.endAt : Date.now();
    this.emitRecord(completed, endMs);

    const finished = this.phase;
    if (finished === 'focus') {
      this.phase = this.index >= this.config.pomodorosPerSet ? 'long_break' : 'short_break';
    } else {
      this.index = finished === 'long_break' ? 1 : this.index + 1;
      this.phase = 'focus';
    }
    this.loadPhase();
    this.events.onPhaseChange(this.phase, finished, completed);
    if (this.config.autoStart) this.start();
    else this.events.onTick();
  }

  private recordPartial(): void {
    if (this.started) this.emitRecord(false, Date.now());
  }

  private emitRecord(completed: boolean, endMs: number): void {
    const actualMs = this.activeMs + (this.running ? endMs - this.segmentStart : 0);
    const startedAt = this.phaseStartedAt;
    this.stop();
    if (startedAt === null || (!completed && actualMs < 1000)) return;
    this.events.onSessionEnd({
      id: uuid(),
      kind: this.phase,
      startedAt: new Date(startedAt).toISOString(),
      endedAt: new Date(endMs).toISOString(),
      plannedSeconds: Math.round(this.durationMs / 1000),
      actualSeconds: Math.min(Math.round(actualMs / 1000), Math.round(this.durationMs / 1000)),
      completed,
    });
  }

  private stop(): void {
    this.running = false;
    window.clearInterval(this.interval);
    this.interval = undefined;
  }

  private loadPhase(): void {
    this.stop();
    const minutes =
      this.phase === 'focus'
        ? this.config.focusMin
        : this.phase === 'short_break'
          ? this.config.shortBreakMin
          : this.config.longBreakMin;
    this.durationMs = minutes * 60_000;
    this.remainingMs = this.durationMs;
    this.activeMs = 0;
    this.phaseStartedAt = null;
  }
}
