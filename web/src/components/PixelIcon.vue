<script setup lang="ts">
// Les SVG viennent de icons.ts (générés par nous), donc v-html est sans risque ici.
defineProps<{ svg: string }>();
</script>

<template>
  <span class="icon" v-html="svg" />
</template>
