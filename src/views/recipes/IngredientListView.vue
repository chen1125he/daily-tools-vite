<script setup lang="ts">
import axios from "axios";
import {
  NButton,
  NCard,
  NDataTable,
  NForm,
  NFormItem,
  NInput,
  NModal,
  NPopconfirm,
  NSpace,
  useMessage,
  type DataTableColumns,
  type FormRules
} from "naive-ui";
import { h, onMounted, reactive, ref } from "vue";
import { useRouter } from "vue-router";
import {
  createIngredient,
  deleteIngredient,
  listIngredients,
  updateIngredient
} from "../../api/modules/ingredients";
import type { Ingredient } from "../../api/modules/ingredients";

const router = useRouter();
const message = useMessage();

function apiErrorMessage(error: unknown, fallback: string): string {
  if (axios.isAxiosError(error)) {
    const d = error.response?.data as { message?: string; error?: { message?: string } } | undefined;
    return d?.error?.message ?? d?.message ?? fallback;
  }
  return fallback;
}

function formatTime(iso: string): string {
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? iso : d.toLocaleString("zh-CN", { hour12: false });
}

const loading = ref(false);
const items = ref<Ingredient[]>([]);
const deletingId = ref<number | null>(null);
const modalVisible = ref(false);
const saving = ref(false);
const editingId = ref<number | null>(null);
const formRef = ref<InstanceType<typeof NForm> | null>(null);
const formModel = reactive({ name: "" });

const formRules: FormRules = {
  name: [
    {
      required: true,
      trigger: ["blur", "input"],
      validator: (_rule, value: string) => {
        if (!value || !String(value).trim()) {
          return new Error("请输入食材名称");
        }
        return true;
      }
    }
  ]
};

const pagination = reactive({
  page: 1,
  pageSize: 20,
  itemCount: 0,
  showSizePicker: true,
  pageSizes: [10, 20, 50, 100],
  onChange: (page: number) => {
    pagination.page = page;
    void fetchList();
  },
  onUpdatePageSize: (pageSize: number) => {
    pagination.pageSize = pageSize;
    pagination.page = 1;
    void fetchList();
  }
});

const columns: DataTableColumns<Ingredient> = [
  {
    title: "名称",
    key: "name",
    ellipsis: { tooltip: true }
  },
  {
    title: "创建时间",
    key: "created_at",
    width: 180,
    render: (row) => formatTime(row.created_at)
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
                onClick: () => openEdit(row)
              },
              { default: () => "编辑" }
            ),
            h(
              NPopconfirm,
              {
                onPositiveClick: () => handleDelete(row)
              },
              {
                default: () => `确定删除「${row.name}」吗？`,
                trigger: () =>
                  h(
                    NButton,
                    {
                      size: "small",
                      type: "error",
                      ghost: true,
                      loading: deletingId.value === row.id
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

const fetchList = async () => {
  loading.value = true;
  try {
    const res = await listIngredients({
      page: pagination.page,
      limit: pagination.pageSize
    });
    items.value = res.items;
    pagination.itemCount = res.meta.total_count;
    pagination.page = res.meta.current_page;
  } catch (error) {
    message.error(apiErrorMessage(error, "加载食材列表失败"));
  } finally {
    loading.value = false;
  }
};

const openCreate = () => {
  editingId.value = null;
  formModel.name = "";
  modalVisible.value = true;
};

const openEdit = (row: Ingredient) => {
  editingId.value = row.id;
  formModel.name = row.name;
  modalVisible.value = true;
};

const closeModal = () => {
  modalVisible.value = false;
};

const handleSave = async () => {
  try {
    await formRef.value?.validate();
  } catch {
    return;
  }
  saving.value = true;
  const name = formModel.name.trim();
  try {
    if (editingId.value == null) {
      await createIngredient({ name });
      message.success("食材已创建");
    } else {
      await updateIngredient(editingId.value, { name });
      message.success("食材已更新");
    }
    modalVisible.value = false;
    await fetchList();
  } catch (error) {
    message.error(apiErrorMessage(error, editingId.value == null ? "创建食材失败" : "更新食材失败"));
  } finally {
    saving.value = false;
  }
};

const handleDelete = async (row: Ingredient) => {
  deletingId.value = row.id;
  try {
    await deleteIngredient(row.id);
    message.success(`已删除「${row.name}」`);
    await fetchList();
  } catch (error) {
    message.error(apiErrorMessage(error, "删除食材失败"));
  } finally {
    deletingId.value = null;
  }
};

onMounted(() => {
  void fetchList();
});
</script>

<template>
  <main class="page">
    <div class="page-inner">
      <n-card title="食材管理">
        <n-space vertical size="medium" class="content-stack">
          <n-space justify="space-between" wrap>
            <n-space>
              <n-button type="default" @click="router.push('/recipes')">返回食谱管理</n-button>
              <n-button type="primary" @click="openCreate">新建食材</n-button>
            </n-space>
          </n-space>
          <n-data-table
            remote
            :columns="columns"
            :data="items"
            :loading="loading"
            :pagination="pagination"
            :bordered="false"
            :scroll-x="560"
          />
        </n-space>
      </n-card>
    </div>

    <n-modal
      v-model:show="modalVisible"
      preset="card"
      :title="editingId == null ? '新建食材' : '编辑食材'"
      style="width: 420px"
    >
      <n-form ref="formRef" :model="formModel" :rules="formRules" label-placement="top">
        <n-form-item path="name" label="名称">
          <n-input v-model:value="formModel.name" placeholder="例如：番茄" maxlength="120" show-count />
        </n-form-item>
        <n-space justify="end">
          <n-button @click="closeModal">取消</n-button>
          <n-button type="primary" :loading="saving" @click="handleSave">保存</n-button>
        </n-space>
      </n-form>
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
