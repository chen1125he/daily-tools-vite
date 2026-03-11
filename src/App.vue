<script setup>
import { ref } from "vue";

const count = ref(0);
</script>

<template>
  <main class="app">
    <h1>Vite + Vue</h1>
    <button type="button" @click="count++">count is {{ count }}</button>
    <p>Edit <code>src/App.vue</code> to test HMR</p>
  </main>
</template>

<style scoped>
.app {
  max-width: 1280px;
  margin: 0 auto;
  padding: 2rem;
  text-align: center;
}
</style>
