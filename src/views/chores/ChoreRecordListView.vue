<script setup lang="ts">
import axios from "axios";
import { onMounted, reactive, ref } from "vue";
import { useRouter } from "vue-router";
import { NButton, NCard, NDataTable, NSpace, useMessage } from "naive-ui";
import type { DataTableColumns } from "naive-ui";
import { listChoreRecords } from "../../api/modules/choreRecord";
import type { ChoreRecordListItem } from "../../api/modules/choreRecord";

const router = useRouter();
const message = useMessage();

function formatPerformedAt(iso: string): string {
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? iso : d.toLocaleString("zh-CN", { hour12: false });
}

function choreDisplayName(row: ChoreRecordListItem): string {
  return row.chore?.name ?? row.chore_name ?? "—";
}

function performerDisplayName(row: ChoreRecordListItem): string {
  return row.performer?.name ?? row.performer?.phone ?? `用户 #${row.performer_id}`;
}

const listLoading = ref(false);
const records = ref<ChoreRecordListItem[]>([]);

const pagination = reactive({
  page: 1,
  pageSize: 20,
  itemCount: 0,
  showSizePicker: true,
  pageSizes: [10, 20, 50, 100],
  onChange: (page: number) => {
    pagination.page = page;
    void fetchRecords();
  },
  onUpdatePageSize: (pageSize: number) => {
    pagination.pageSize = pageSize;
    pagination.page = 1;
    void fetchRecords();
  }
});

const recordColumns: DataTableColumns<ChoreRecordListItem> = [
  {
    title: "执行人",
    key: "performer",
    ellipsis: { tooltip: true },
    render: (row) => performerDisplayName(row)
  },
  {
    title: "家务名",
    key: "chore",
    ellipsis: { tooltip: true },
    render: (row) => choreDisplayName(row)
  },
  {
    title: "分数",
    key: "points",
    width: 100,
    render: (row) => String(row.points)
  },
  {
    title: "执行时间",
    key: "performed_at",
    width: 200,
    render: (row) => formatPerformedAt(row.performed_at)
  }
];

const fetchRecords = async () => {
  listLoading.value = true;
  try {
    const res = await listChoreRecords({
      page: pagination.page,
      limit: pagination.pageSize
    });
    records.value = res.data;
    
    pagination.itemCount = res.meta.total_count;
    pagination.page = res.meta.current_page;
  } catch (error) {
    if (axios.isAxiosError(error)) {
      message.error(error.response?.data?.message || "加载家务记录列表失败");
    } else {
      message.error("加载家务记录列表失败");
    }
  } finally {
    listLoading.value = false;
  }
};

onMounted(() => {
  void fetchRecords();
});
</script>

<template>
  <main class="page">
    <div class="page-inner">
      <n-card title="家务记录列表" style="width: 100%">
        <n-space vertical size="medium" class="content-stack">
          <n-space>
            <n-button quaternary @click="router.push('/chores')">返回家务类型列表</n-button>
            <n-button type="primary" @click="router.push('/chores/records')">新建记录</n-button>
          </n-space>
          <n-data-table
            remote
            :columns="recordColumns"
            :data="records"
            :loading="listLoading"
            :pagination="pagination"
            :bordered="false"
            :scroll-x="720"
          />
        </n-space>
      </n-card>
    </div>
  </main>
</template>

<style scoped>
.page {
  display: flex;
  justify-content: center;
}

.page-inner {
  width: 100%;
  max-width: 960px;
}

.content-stack {
  width: 100%;
}
</style>
