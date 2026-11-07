import { computed, ref } from 'vue';
import { NEXT_STATUS, tasksApi, type Task, type TaskStatus } from '../tasks';

export function useTasks(toast: (message: string) => void) {
  const tasks = ref<Task[]>([]);

  const inProgress = computed(() => tasks.value.filter((t) => t.status === 'in_progress'));
  const doneCount = computed(() => tasks.value.filter((t) => t.status === 'done').length);

  async function run(action: () => Promise<unknown>): Promise<void> {
    try {
      await action();
    } catch (err) {
      toast((err as Error).message);
      await refresh();
    }
  }

  async function refresh(): Promise<void> {
    try {
      tasks.value = await tasksApi.list();
    } catch {
      // la base est peut-être coupée : on garde ce qu'on a
    }
  }

  function add(title: string): Promise<void> {
    return run(async () => {
      const task = await tasksApi.create(title);
      if (task) tasks.value.push(task);
    });
  }

  function setStatus(task: Task, status: TaskStatus): Promise<void> {
    // Mise à jour immédiate à l'écran, confirmée ensuite par le serveur.
    task.status = status;
    return run(async () => {
      const saved = await tasksApi.update(task.id, { status });
      if (saved) Object.assign(task, saved);
    });
  }

  function cycle(task: Task): Promise<void> {
    return setStatus(task, NEXT_STATUS[task.status]);
  }

  function rename(task: Task, title: string): Promise<void> {
    task.title = title;
    return run(() => tasksApi.update(task.id, { title }));
  }

  function remove(task: Task): Promise<void> {
    tasks.value = tasks.value.filter((t) => t.id !== task.id);
    return run(() => tasksApi.remove(task.id));
  }

  function clearDone(): Promise<void> {
    tasks.value = tasks.value.filter((t) => t.status !== 'done');
    return run(() => tasksApi.clearDone());
  }

  return { tasks, inProgress, doneCount, refresh, add, setStatus, cycle, rename, remove, clearDone };
}
