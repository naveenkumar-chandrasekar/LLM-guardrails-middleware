<template>
  <div class="app">
    <PolicyEditor />
  </div>
</template>

<script setup lang="ts">
import PolicyEditor from "./views/PolicyEditor.vue";
</script>

<style>
.app { min-height: 100vh; background: var(--bg); }
</style>
