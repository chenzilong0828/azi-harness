<template>
  <div>
    <button v-hasPermi="['system:user:add']">Add</button>
    <DictTag :options="statusOptions" :value="row.status" />
  </div>
</template>

<script>
export default {
  data() {
    return {
      queryParams: { pageNum: 1, pageSize: 10 },
      rows: [],
      total: 0
    };
  },
  methods: {
    notify() {
      this.$message.success("ok");
      this.download("/export");
    }
  }
};
</script>

