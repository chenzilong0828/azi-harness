<script setup lang="ts">
import HtwTable from "htw-table";
import { ElMessage } from "element-plus";

const { statusOptions } = useDict("sys_normal_disable");
const queryParams = { pageNum: 1, pageSize: 10 };
const rows = [];
const total = 0;

function notify() {
  ElMessage.success("ok");
  download("/export");
}
</script>

<template>
  <HtwTable>
    <button v-hasPermi="['system:role:add']">Add</button>
    <DictTag :options="statusOptions" />
  </HtwTable>
</template>

