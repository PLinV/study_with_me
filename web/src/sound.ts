let ctx: AudioContext | null = null;

/** À appeler sur un geste utilisateur : les navigateurs bloquent l'audio sinon. */
export function unlockAudio(): void {
  ctx ??= new AudioContext();
  if (ctx.state === 'suspended') void ctx.resume();
}

const NOTES = {
  // arpège montant : la pause commence
  break: [523.25, 659.25, 783.99, 1046.5],
  // arpège descendant : retour au travail
  focus: [1046.5, 783.99, 659.25, 523.25],
};

export function playChime(kind: keyof typeof NOTES, volume: number): void {
  if (!ctx || volume <= 0) return;
  const t0 = ctx.currentTime + 0.05;
  NOTES[kind].forEach((freq, i) => {
    const osc = ctx!.createOscillator();
    const gain = ctx!.createGain();
    osc.type = 'triangle';
    osc.frequency.value = freq;
    const t = t0 + i * 0.16;
    gain.gain.setValueAtTime(0, t);
    gain.gain.linearRampToValueAtTime(0.25 * volume, t + 0.02);
    gain.gain.exponentialRampToValueAtTime(0.0001, t + 0.6);
    osc.connect(gain).connect(ctx!.destination);
    osc.start(t);
    osc.stop(t + 0.65);
  });
}

export function requestNotifications(): void {
  if ('Notification' in window && Notification.permission === 'default') {
    void Notification.requestPermission();
  }
}

export function notify(title: string, body: string): void {
  if ('Notification' in window && Notification.permission === 'granted') {
    new Notification(title, { body, icon: '/favicon.svg', silent: true });
  }
}
