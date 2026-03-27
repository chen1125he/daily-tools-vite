<script setup lang="ts">
import { h } from "vue";
import { NButton, NDataTable, NPopconfirm, NSpace, NTag } from "naive-ui";
import type { DataTableColumns } from "naive-ui";
import type { Chore } from "../../api/modules/chore";

const props = defineProps<{
  chores: Chore[];
  loading: boolean;
  deletingId?: number | null;
}>();

const emit = defineEmits<{
  edit: [chore: Chore];
  delete: [chore: Chore];
}>();

const columns: DataTableColumns<Chore> = [
  {
    title: "ID",
    key: "id",
    width: 80
  },
  {
    title: "家务名",
    key: "name"
  },
  {
    title: "描述",
    key: "description",
    ellipsis: {
      tooltip: true
    }
  },
  {
    title: "默认积分",
    key: "default_contribution_points",
    width: 120
  },
  {
    title: "状态",
    key: "active",
    width: 100,
    render: (row) =>
      h(
        NTag,
        {
          type: row.active ? "success" : "default"
        },
        {
          default: () => (row.active ? "启用" : "停用")
        }
      )
  },
  {
    title: "操作",
    key: "actions",
    width: 170,
    render: (row) =>
      h(
        NSpace,
        {
          size: 8
        },
        {
          default: () => [
            h(
              NButton,
              {
                size: "small",
                onClick: () => emit("edit", row)
              },
              { default: () => "编辑" }
            ),
            h(
              NPopconfirm,
              {
                onPositiveClick: () => emit("delete", row)
              },
              {
                trigger: () =>
                  h(
                    NButton,
                    {
                      size: "small",
                      type: "error",
                      ghost: true,
                      loading: props.deletingId === row.id,
                      disabled: props.deletingId !== null && props.deletingId !== row.id
                    },
                    { default: () => "删除" }
                  ),
                default: () => `确定删除「${row.name}」吗？`
              }
            )
          ]
        }
      )
  }
];
</script>

<template>
  <n-data-table :columns="columns" :data="props.chores" :loading="props.loading" :bordered="false" />
</template>
