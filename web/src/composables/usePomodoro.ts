import { computed, onUnmounted, ref } from 'vue';
import { PomodoroTimer, type TimerConfig, type TimerEvents } from '../timer';

/**
 * Expose le PomodoroTimer de façon réactive.
 * Pendant que le chrono tourne, on rafraîchit à chaque frame pour que la barre avance en continu.
 */
export function usePomodoro(config: TimerConfig, events: Omit<TimerEvents, 'onTick'>) {
  const version = ref(0);
  let frame = 0;

  const loop = () => {
    version.value++;
    frame = timer.running ? requestAnimationFrame(loop) : 0;
  };

  const timer = new PomodoroTimer(config, {
    ...events,
    onTick: () => {
      version.value++;
      if (timer.running && !frame) frame = requestAnimationFrame(loop);
    },
  });

  onUnmounted(() => cancelAnimationFrame(frame));

  // Chaque computed relit le timer quand `version` change.
  const read = <T>(fn: () => T) =>
    computed(() => {
      void version.value;
      return fn();
    });

  return {
    timer,
    phase: read(() => timer.phase),
    index: read(() => Math.min(timer.index, timer.pomodorosPerSet)),
    pomodorosPerSet: read(() => timer.pomodorosPerSet),
    running: read(() => timer.running),
    started: read(() => timer.started),
    remaining: read(() => timer.remaining),
    progress: read(() => timer.progress),
  };
}
