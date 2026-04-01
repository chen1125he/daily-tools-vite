<script setup lang="ts">
import axios from "axios";
import { computed, onMounted, reactive, ref } from "vue";
import { useRouter } from "vue-router";
import {
  NButton,
  NCard,
  NDatePicker,
  NForm,
  NFormItem,
  NInput,
  NInputNumber,
  NModal,
  NPopconfirm,
  NRadio,
  NRadioGroup,
  NSelect,
  NSpace,
  useMessage
} from "naive-ui";
import { listActiveChores } from "../../api/modules/chore";
import type { Chore } from "../../api/modules/chore";
import {
  createChoreRecord,
  deleteChoreRecord,
  updateChoreRecord,
  type ChoreRecordCreateResult,
  type ChoreRecordType
} from "../../api/modules/choreRecord";
import { listUsers } from "../../api/modules/user";
import type { User } from "../../api/modules/user";

const router = useRouter();
const message = useMessage();

const text = ref("");
const submitting = ref(false);
const saveAdjusting = ref(false);
const deletingRecord = ref(false);
const users = ref<User[]>([]);
const chores = ref<Chore[]>([]);
const modalVisible = ref(false);
const createdRecordId = ref<number | null>(null);

function inferChoreRecordType(record: {
  chore_type?: string;
  chore_id: number | null;
}): ChoreRecordType {
  if (record.chore_type === "custom") return "custom";
  if (record.chore_type === "catalog") return "catalog";
  return record.chore_id != null ? "catalog" : "custom";
}

const adjustForm = reactive({
  performer_id: null as number | null,
  chore_type: "catalog" as ChoreRecordType,
  chore_id: null as number | null,
  custom_chore_name: "",
  description: "",
  points: null as number | null,
  performed_at: null as number | null
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

const loadSelectOptions = async () => {
  try {
    const [userList, choreList] = await Promise.all([listUsers(), listActiveChores()]);
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

const openAdjustModal = (record: ChoreRecordCreateResult) => {
  createdRecordId.value = record.id;
  adjustForm.performer_id = record.performer_id;
  adjustForm.chore_type = inferChoreRecordType(record);
  adjustForm.chore_id = record.chore_id;
  adjustForm.custom_chore_name = record.custom_chore_name ?? "";
  adjustForm.description = record.description ?? "";
  adjustForm.points = Number(record.points);
  const parsedTime = new Date(record.performed_at).getTime();
  adjustForm.performed_at = Number.isNaN(parsedTime) ? Date.now() : parsedTime;
  modalVisible.value = true;
};

const closeAdjustModal = () => {
  modalVisible.value = false;
};

const handleDeleteCreatedRecord = async (): Promise<boolean> => {
  if (!createdRecordId.value) {
    return false;
  }
  deletingRecord.value = true;
  try {
    const result = await deleteChoreRecord(createdRecordId.value);
    message.success(result.message || "家务记录已删除");
    createdRecordId.value = null;
    modalVisible.value = false;
    return true;
  } catch (error) {
    if (axios.isAxiosError(error)) {
      message.error(error.response?.data?.message || "删除家务记录失败");
    } else {
      message.error("删除家务记录失败");
    }
    return false;
  } finally {
    deletingRecord.value = false;
  }
};

const handleSubmit = async () => {
  const trimmedText = text.value.trim();
  if (!trimmedText) {
    message.warning("请输入家务记录内容");
    return;
  }

  submitting.value = true;
  try {
    const result = await createChoreRecord({ text: trimmedText });
    message.success(result.message || "家务记录已提交");
    text.value = "";
    openAdjustModal(result);
  } catch (error) {
    if (axios.isAxiosError(error)) {
      message.error(error.response?.data?.message || "提交家务记录失败");
    } else {
      message.error("提交家务记录失败");
    }
  } finally {
    submitting.value = false;
  }
};

const handleSaveAdjustments = async () => {
  if (!createdRecordId.value) {
    message.error("缺少记录 ID，无法保存");
    return;
  }
  if (!adjustForm.performer_id) {
    message.warning("请选择执行人");
    return;
  }
  if (adjustForm.chore_type === "catalog") {
    if (!adjustForm.chore_id) {
      message.warning("请选择常用家务");
      return;
    }
  } else if (!adjustForm.custom_chore_name.trim()) {
    message.warning("请输入自定义家务名");
    return;
  }
  if (adjustForm.points === null || !Number.isFinite(adjustForm.points)) {
    message.warning("请输入有效的贡献分");
    return;
  }
  if (!adjustForm.performed_at) {
    message.warning("请选择完成时间");
    return;
  }

  saveAdjusting.value = true;
  try {
    const desc = adjustForm.description.trim();
    const result = await updateChoreRecord(createdRecordId.value, {
      performer_id: adjustForm.performer_id,
      points: Number(adjustForm.points),
      performed_at: new Date(adjustForm.performed_at).toISOString(),
      chore_type: adjustForm.chore_type,
      ...(adjustForm.chore_type === "catalog"
        ? { chore_id: adjustForm.chore_id!, custom_chore_name: null }
        : { chore_id: null, custom_chore_name: adjustForm.custom_chore_name.trim() }),
      description: desc.length > 0 ? desc : null
    });
    message.success(result.message || "家务记录已更新");
    modalVisible.value = false;
  } catch (error) {
    if (axios.isAxiosError(error)) {
      message.error(error.response?.data?.message || "更新家务记录失败");
    } else {
      message.error("更新家务记录失败");
    }
  } finally {
    saveAdjusting.value = false;
  }
};

onMounted(() => {
  void loadSelectOptions();
});
</script>

<template>
  <main class="page">
    <div class="page-inner">
      <n-card title="家务记录管理" style="width: 100%">
        <n-space vertical size="medium" class="content-stack">
          <n-space>
            <n-button type="default" @click="router.push('/chores/list')">家务类型列表</n-button>
            <n-button type="default" @click="router.push('/chores/records/list')">家务记录列表</n-button>
            <n-button type="default" @click="router.push('/chores/records/create')">手动创建</n-button>
          </n-space>
          <n-input
            v-model:value="text"
            type="textarea"
            clearable
            :autosize="{ minRows: 3, maxRows: 8 }"
            placeholder="例如：我今天带娃了，获得两个点"
          />
          <n-button type="primary" :loading="submitting" @click="handleSubmit">直接提交</n-button>
        </n-space>
      </n-card>
    </div>
    <n-modal v-model:show="modalVisible" preset="card" title="调整家务记录" style="width: 600px">
      <n-form label-placement="top">
        <n-space vertical size="medium">
          <n-form-item label="执行人">
            <n-select
              v-model:value="adjustForm.performer_id"
              :options="userOptions"
              placeholder="请选择执行人"
            />
          </n-form-item>
          <n-form-item label="家务类型">
            <n-radio-group v-model:value="adjustForm.chore_type">
              <n-space>
                <n-radio value="catalog">常用家务</n-radio>
                <n-radio value="custom">自定义家务</n-radio>
              </n-space>
            </n-radio-group>
          </n-form-item>
          <n-form-item v-if="adjustForm.chore_type === 'catalog'" label="常用家务">
            <n-select
              v-model:value="adjustForm.chore_id"
              :options="choreOptions"
              placeholder="请选择家务"
              filterable
            />
          </n-form-item>
          <n-form-item v-else label="自定义家务名">
            <n-input v-model:value="adjustForm.custom_chore_name" placeholder="输入自定义家务名称" />
          </n-form-item>
          <n-form-item label="家务描述">
            <n-input
              v-model:value="adjustForm.description"
              type="textarea"
              placeholder="可选，补充这条记录的说明"
              :autosize="{ minRows: 2, maxRows: 6 }"
            />
          </n-form-item>
          <n-form-item label="贡献分">
            <n-input-number
              v-model:value="adjustForm.points"
              :min="0"
              :precision="2"
              :step="1"
              style="width: 100%"
            />
          </n-form-item>
          <n-form-item label="完成时间">
            <n-date-picker
              v-model:value="adjustForm.performed_at"
              type="datetime"
              clearable
              style="width: 100%"
            />
          </n-form-item>
        </n-space>
      </n-form>
      <template #footer>
        <n-space justify="space-between" style="width: 100%">
          <n-popconfirm @positive-click="handleDeleteCreatedRecord">
            <template #trigger>
              <n-button
                type="error"
                ghost
                :loading="deletingRecord"
                :disabled="saveAdjusting"
              >
                删除
              </n-button>
            </template>
            确定删除这条家务记录吗？
          </n-popconfirm>
          <n-space>
            <n-button @click="closeAdjustModal">取消</n-button>
            <n-button
              type="primary"
              :loading="saveAdjusting"
              :disabled="deletingRecord"
              @click="handleSaveAdjustments"
            >
              保存修改
            </n-button>
          </n-space>
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
