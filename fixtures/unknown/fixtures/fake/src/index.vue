<script setup>
import HtwTable from "htw-table";

const values = useDict("fake");
const pageNum = 1;
const pageSize = 10;
const rows = [];
const total = 0;
</script>

<template>
  <button v-hasPermi="['fake']">
    <DictTag />
  </button>
</template>

