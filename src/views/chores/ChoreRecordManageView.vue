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
  NSelect,
  NSpace,
  useMessage
} from "naive-ui";
import { listActiveChores } from "../../api/modules/chore";
import type { Chore } from "../../api/modules/chore";
import { createChoreRecord, updateChoreRecord } from "../../api/modules/choreRecord";
import { listUsers } from "../../api/modules/user";
import type { User } from "../../api/modules/user";

const router = useRouter();
const message = useMessage();

const text = ref("");
const submitting = ref(false);
const saveAdjusting = ref(false);
const users = ref<User[]>([]);
const chores = ref<Chore[]>([]);
const modalVisible = ref(false);
const createdRecordId = ref<number | null>(null);
const adjustForm = reactive({
  performer_id: null as number | null,
  chore_id: null as number | null,
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

const openAdjustModal = (record: {
  id: number;
  performer_id: number;
  chore_id: number | null;
  points: string | number;
  performed_at: string;
}) => {
  createdRecordId.value = record.id;
  adjustForm.performer_id = record.performer_id;
  adjustForm.chore_id = record.chore_id;
  adjustForm.points = Number(record.points);
  const parsedTime = new Date(record.performed_at).getTime();
  adjustForm.performed_at = Number.isNaN(parsedTime) ? Date.now() : parsedTime;
  modalVisible.value = true;
};

const closeAdjustModal = () => {
  modalVisible.value = false;
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
  if (!adjustForm.chore_id) {
    message.warning("请选择家务");
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
    const result = await updateChoreRecord(createdRecordId.value, {
      performer_id: adjustForm.performer_id,
      chore_id: adjustForm.chore_id,
      points: Number(adjustForm.points),
      performed_at: new Date(adjustForm.performed_at).toISOString()
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
    <n-modal v-model:show="modalVisible" preset="card" title="调整家务记录" style="width: 560px">
      <n-form label-placement="top">
        <n-space vertical size="medium">
          <n-form-item label="执行人">
            <n-select
              v-model:value="adjustForm.performer_id"
              :options="userOptions"
              placeholder="请选择执行人"
            />
          </n-form-item>
          <n-form-item label="家务">
            <n-select v-model:value="adjustForm.chore_id" :options="choreOptions" placeholder="请选择家务" />
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
        <n-space justify="end">
          <n-button @click="closeAdjustModal">取消</n-button>
          <n-button type="primary" :loading="saveAdjusting" @click="handleSaveAdjustments">
            保存修改
          </n-button>
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
