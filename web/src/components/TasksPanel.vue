<script setup lang="ts">
import { computed, nextTick, onMounted, onUnmounted, ref } from 'vue';
import * as icons from '../icons';
import { NEXT_STATUS, STATUS_LABELS, type Task, type TaskStatus } from '../tasks';
import PixelIcon from './PixelIcon.vue';

const props = defineProps<{ tasks: Task[]; inProgress: Task[]; doneCount: number }>();
const emit = defineEmits<{
  add: [title: string];
  cycle: [task: Task];
  rename: [task: Task, title: string];
  remove: [task: Task];
  clearDone: [];
}>();
const open = defineModel<boolean>('open', { required: true });

const STATUS_ICONS: Record<TaskStatus, string> = {
  todo: icons.taskTodo,
  in_progress: icons.taskInProgress,
  done: icons.taskDone,
};

// Sous le compteur, on affiche quelques tâches en cours, puis "+N".
const MAX_SHOWN = 3;
const shownInProgress = computed(() => props.inProgress.slice(0, MAX_SHOWN));
const hiddenInProgress = computed(() => Math.max(0, props.inProgress.length - MAX_SHOWN));

const root = ref<HTMLElement>();
const newTitle = ref('');
const editingId = ref<string | null>(null);
const editTitle = ref('');

function submit(): void {
  const title = newTitle.value.trim();
  if (title) emit('add', title);
  newTitle.value = '';
}

async function startEdit(task: Task): Promise<void> {
  editingId.value = task.id;
  editTitle.value = task.title;
  await nextTick();
  root.value?.querySelector<HTMLInputElement>('.task-edit')?.select();
}

function finishEdit(task: Task): void {
  const title = editTitle.value.trim();
  if (editingId.value === task.id && title && title !== task.title) emit('rename', task, title);
  editingId.value = null;
}

// Ferme le menu quand on clique ailleurs ou qu'on appuie sur Échap.
function onPointerDown(e: PointerEvent): void {
  if (open.value && !root.value?.contains(e.target as Node)) open.value = false;
}
function onKeydown(e: KeyboardEvent): void {
  if (e.key === 'Escape' && open.value && editingId.value === null) open.value = false;
}

onMounted(() => {
  document.addEventListener('pointerdown', onPointerDown);
  document.addEventListener('keydown', onKeydown);
});
onUnmounted(() => {
  document.removeEventListener('pointerdown', onPointerDown);
  document.removeEventListener('keydown', onKeydown);
});
</script>

<template>
  <section ref="root" class="hud tasks">
    <ul v-if="inProgress.length" class="current-tasks">
      <li v-for="task in shownInProgress" :key="task.id" class="current-task ellipsis" :title="task.title">
        ▸ {{ task.title }}
      </li>
      <li v-if="hiddenInProgress" class="current-task subtitle">+{{ hiddenInProgress }} en cours</li>
    </ul>

    <button
      class="btn chrome tasks-toggle"
      :aria-expanded="open"
      title="Tâches (T)"
      @click="open = !open"
    >
      <PixelIcon :svg="icons.list" />
      Tâches
      <span v-if="tasks.length" class="count">{{ doneCount }}/{{ tasks.length }}</span>
    </button>

    <div v-if="open" class="tasks-dropdown" role="dialog" aria-label="Tâches">
      <form class="row" @submit.prevent="submit">
        <input v-model="newTitle" class="field" maxlength="200" placeholder="Nouvelle tâche…" autofocus />
        <button class="btn" type="submit">Ajouter</button>
      </form>

      <ul class="task-list">
        <li v-for="task in tasks" :key="task.id" class="task" :class="task.status">
          <button
            class="task-status"
            :title="`${STATUS_LABELS[task.status]} → ${STATUS_LABELS[NEXT_STATUS[task.status]]}`"
            :aria-label="`${task.title} : ${STATUS_LABELS[task.status]}`"
            @click="emit('cycle', task)"
          >
            <PixelIcon :svg="STATUS_ICONS[task.status]" />
          </button>
          <input
            v-if="editingId === task.id"
            v-model="editTitle"
            class="field task-edit"
            maxlength="200"
            @keydown.enter.prevent="finishEdit(task)"
            @keydown.escape.stop="editingId = null"
            @blur="finishEdit(task)"
          />
          <span v-else class="task-title" title="Double-clic pour renommer" @dblclick="startEdit(task)">
            {{ task.title }}
          </span>
          <button class="task-remove" title="Supprimer" @click="emit('remove', task)">
            <PixelIcon :svg="icons.close" />
          </button>
        </li>
      </ul>

      <p v-if="!tasks.length" class="hint">Aucune tâche. Ajoute ce que tu veux accomplir pendant la session.</p>
      <p v-else class="hint">Clique sur la case : à faire → en cours → terminée.</p>

      <div v-if="doneCount" class="row">
        <span class="spacer" />
        <button class="btn" @click="emit('clearDone')">Effacer les terminées</button>
      </div>
    </div>
  </section>
</template>
