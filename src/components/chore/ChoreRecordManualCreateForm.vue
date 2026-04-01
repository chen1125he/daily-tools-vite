<script setup lang="ts">
import axios from "axios";
import { computed, onMounted, reactive, ref } from "vue";
import {
  NButton,
  NDatePicker,
  NForm,
  NFormItem,
  NInput,
  NInputNumber,
  NRadio,
  NRadioGroup,
  NSelect,
  NSpace,
  useMessage
} from "naive-ui";
import { listActiveChores } from "../../api/modules/chore";
import type { Chore } from "../../api/modules/chore";
import { createChoreRecordManual } from "../../api/modules/choreRecord";
import type { ChoreRecordType } from "../../api/modules/choreRecord";
import { listUsers } from "../../api/modules/user";
import type { User } from "../../api/modules/user";

const emit = defineEmits<{
  created: [];
}>();

const message = useMessage();
const creating = ref(false);
const users = ref<User[]>([]);
const chores = ref<Chore[]>([]);

const formValue = reactive({
  performer_id: null as number | null,
  chore_type: "catalog" as ChoreRecordType,
  chore_id: null as number | null,
  custom_chore_name: "",
  description: "",
  points: null as number | null,
  performed_at: Date.now() as number | null
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

const handleSubmit = async () => {
  if (!formValue.performer_id) {
    message.warning("请选择执行人");
    return;
  }
  if (formValue.chore_type === "catalog") {
    if (!formValue.chore_id) {
      message.warning("请选择常用家务");
      return;
    }
  } else if (!formValue.custom_chore_name.trim()) {
    message.warning("请输入自定义家务名");
    return;
  }
  if (formValue.points === null || !Number.isFinite(formValue.points)) {
    message.warning("请输入有效的贡献分");
    return;
  }
  if (!formValue.performed_at) {
    message.warning("请选择完成时间");
    return;
  }

  creating.value = true;
  try {
    const desc = formValue.description.trim();
    await createChoreRecordManual({
      performer_id: formValue.performer_id,
      points: Number(formValue.points),
      performed_at: new Date(formValue.performed_at).toISOString(),
      chore_type: formValue.chore_type,
      ...(formValue.chore_type === "catalog"
        ? { chore_id: formValue.chore_id!, custom_chore_name: null }
        : { chore_id: null, custom_chore_name: formValue.custom_chore_name.trim() }),
      description: desc.length > 0 ? desc : null
    });
    message.success("家务记录已创建");
    emit("created");
  } catch (error) {
    if (axios.isAxiosError(error)) {
      message.error(error.response?.data?.message || "创建家务记录失败");
    } else {
      message.error("创建家务记录失败");
    }
  } finally {
    creating.value = false;
  }
};

onMounted(() => {
  void loadSelectOptions();
});
</script>

<template>
  <n-form label-placement="top" :show-require-mark="false" @submit.prevent="handleSubmit">
    <n-space vertical size="medium">
      <n-form-item label="执行人">
        <n-select v-model:value="formValue.performer_id" :options="userOptions" placeholder="请选择执行人" />
      </n-form-item>
      <n-form-item label="家务类型">
        <n-radio-group v-model:value="formValue.chore_type">
          <n-space>
            <n-radio value="catalog">常用家务</n-radio>
            <n-radio value="custom">自定义家务</n-radio>
          </n-space>
        </n-radio-group>
      </n-form-item>
      <n-form-item v-if="formValue.chore_type === 'catalog'" label="常用家务">
        <n-select
          v-model:value="formValue.chore_id"
          :options="choreOptions"
          placeholder="请选择家务"
          filterable
        />
      </n-form-item>
      <n-form-item v-else label="自定义家务名">
        <n-input v-model:value="formValue.custom_chore_name" placeholder="输入自定义家务名称" />
      </n-form-item>
      <n-form-item label="家务描述">
        <n-input
          v-model:value="formValue.description"
          type="textarea"
          placeholder="可选，补充这条记录的说明"
          :autosize="{ minRows: 2, maxRows: 6 }"
        />
      </n-form-item>
      <n-form-item label="贡献分">
        <n-input-number
          v-model:value="formValue.points"
          :min="0"
          :precision="2"
          :step="1"
          style="width: 100%"
        />
      </n-form-item>
      <n-form-item label="完成时间">
        <n-date-picker v-model:value="formValue.performed_at" type="datetime" clearable style="width: 100%" />
      </n-form-item>
      <n-button type="primary" attr-type="submit" :loading="creating">创建家务记录</n-button>
    </n-space>
  </n-form>
</template>
