<script setup lang="ts">
import { formatDuration, type Stats } from '../stats';

defineProps<{ stats: Stats | null }>();

const ROWS = [
  { key: 'today', label: "Aujourd'hui" },
  { key: 'week', label: 'Semaine' },
  { key: 'total', label: 'Total' },
] as const;
</script>

<template>
  <aside class="hud bottom-left chrome stats">
    <table>
      <tbody>
        <tr v-for="row in ROWS" :key="row.key">
          <th>{{ row.label }}</th>
          <td class="cycles">{{ stats ? stats[row.key].cycles : '–' }}</td>
          <td>{{ stats ? formatDuration(stats[row.key].focusSeconds) : '–' }}</td>
        </tr>
      </tbody>
    </table>
    <div v-if="!stats" class="subtitle">Base de données injoignable</div>
  </aside>
</template>
