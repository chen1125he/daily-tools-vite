<script setup lang="ts">
import axios from "axios";
import { computed, h, onMounted, reactive, ref } from "vue";
import { useRouter } from "vue-router";
import {
  NButton,
  NCard,
  NDataTable,
  NDatePicker,
  NForm,
  NFormItem,
  NInputNumber,
  NModal,
  NPopconfirm,
  NSelect,
  NSpace,
  useMessage
} from "naive-ui";
import type { DataTableColumns } from "naive-ui";
import { listChores } from "../../api/modules/chore";
import type { Chore } from "../../api/modules/chore";
import { deleteChoreRecord, listChoreRecords, updateChoreRecord } from "../../api/modules/choreRecord";
import type { ChoreRecordListItem } from "../../api/modules/choreRecord";
import { listUsers } from "../../api/modules/user";
import type { User } from "../../api/modules/user";

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
const users = ref<User[]>([]);
const chores = ref<Chore[]>([]);
const modalVisible = ref(false);
const savingEdit = ref(false);
const deletingRecordId = ref<number | null>(null);
const editingRecordId = ref<number | null>(null);
const editForm = reactive({
  performer_id: null as number | null,
  chore_id: null as number | null,
  points: null as number | null,
  performed_at: null as number | null
});

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

const userOptions = computed(() =>
  users.value.map((item) => ({
    label: item.name || item.phone || `用户 #${item.id}`,
    value: item.id
  }))
);

const choreOptions = computed(() =>
  chores.value.map((item) => ({
    label: item.name,
    value: item.id
  }))
);

const openEditModal = (record: ChoreRecordListItem) => {
  editingRecordId.value = record.id;
  editForm.performer_id = record.performer_id;
  editForm.chore_id = record.chore_id;
  editForm.points = Number(record.points);
  const parsedTime = new Date(record.performed_at).getTime();
  editForm.performed_at = Number.isNaN(parsedTime) ? Date.now() : parsedTime;
  modalVisible.value = true;
};

const closeEditModal = () => {
  modalVisible.value = false;
};

const handleSaveEdit = async () => {
  if (!editingRecordId.value) {
    message.error("缺少记录 ID，无法保存");
    return;
  }
  if (!editForm.performer_id) {
    message.warning("请选择执行人");
    return;
  }
  if (!editForm.chore_id) {
    message.warning("请选择家务");
    return;
  }
  if (editForm.points === null || !Number.isFinite(editForm.points)) {
    message.warning("请输入有效的分数");
    return;
  }
  if (!editForm.performed_at) {
    message.warning("请选择执行时间");
    return;
  }

  savingEdit.value = true;
  try {
    const result = await updateChoreRecord(editingRecordId.value, {
      performer_id: editForm.performer_id,
      chore_id: editForm.chore_id,
      points: Number(editForm.points),
      performed_at: new Date(editForm.performed_at).toISOString()
    });
    message.success(result.message || "家务记录已更新");
    modalVisible.value = false;
    await fetchRecords();
  } catch (error) {
    if (axios.isAxiosError(error)) {
      message.error(error.response?.data?.message || "更新家务记录失败");
    } else {
      message.error("更新家务记录失败");
    }
  } finally {
    savingEdit.value = false;
  }
};

const handleDeleteRecord = async (recordId: number) => {
  deletingRecordId.value = recordId;
  try {
    const result = await deleteChoreRecord(recordId);
    message.success(result.message || "家务记录已删除");
    await fetchRecords();
  } catch (error) {
    if (axios.isAxiosError(error)) {
      message.error(error.response?.data?.message || "删除家务记录失败");
    } else {
      message.error("删除家务记录失败");
    }
  } finally {
    deletingRecordId.value = null;
  }
};

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
  },
  {
    title: "操作",
    key: "actions",
    width: 180,
    render: (row) =>
      h(
        NSpace,
        { size: "small" },
        {
          default: () => [
            h(
              NButton,
              {
                size: "small",
                onClick: () => openEditModal(row)
              },
              { default: () => "编辑" }
            ),
            h(
              NPopconfirm,
              {
                onPositiveClick: () => handleDeleteRecord(row.id)
              },
              {
                default: () => "确定删除这条记录吗？",
                trigger: () =>
                  h(
                    NButton,
                    {
                      size: "small",
                      type: "error",
                      ghost: true,
                      loading: deletingRecordId.value === row.id
                    },
                    { default: () => "删除" }
                  )
              }
            )
          ]
        }
      )
  }
];

const loadSelectOptions = async () => {
  try {
    const [userList, choreList] = await Promise.all([listUsers(), listChores()]);
    users.value = userList;
    chores.value = choreList;
  } catch (error) {
    if (axios.isAxiosError(error)) {
      message.error(error.response?.data?.message || "加载用户或家务数据失败");
    } else {
      message.error("加载用户或家务数据失败");
    }
  }
};

const fetchRecords = async () => {
  listLoading.value = true;
  try {
    const res = await listChoreRecords({
      page: pagination.page,
      limit: pagination.pageSize
    });
    records.value = res.items;

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
  void loadSelectOptions();
  void fetchRecords();
});
</script>

<template>
  <main class="page">
    <div class="page-inner">
      <n-card title="家务记录列表" style="width: 100%">
        <n-space vertical size="medium" class="content-stack">
          <n-space>
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
    <n-modal v-model:show="modalVisible" preset="card" title="编辑家务记录" style="width: 560px">
      <n-form label-placement="top">
        <n-space vertical size="medium">
          <n-form-item label="执行人">
            <n-select v-model:value="editForm.performer_id" :options="userOptions" placeholder="请选择执行人" />
          </n-form-item>
          <n-form-item label="家务">
            <n-select v-model:value="editForm.chore_id" :options="choreOptions" placeholder="请选择家务" />
          </n-form-item>
          <n-form-item label="分数">
            <n-input-number
              v-model:value="editForm.points"
              :min="0"
              :precision="2"
              :step="1"
              style="width: 100%"
            />
          </n-form-item>
          <n-form-item label="执行时间">
            <n-date-picker
              v-model:value="editForm.performed_at"
              type="datetime"
              clearable
              style="width: 100%"
            />
          </n-form-item>
        </n-space>
      </n-form>
      <template #footer>
        <n-space justify="end">
          <n-button @click="closeEditModal">取消</n-button>
          <n-button type="primary" :loading="savingEdit" @click="handleSaveEdit">保存</n-button>
        </n-space>
      </template>
    </n-modal>
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
