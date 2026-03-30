import http from "../http";

export interface ChoreRecordCreatePayload {
  text: string;
}

/** 列表接口嵌套的用户结构 */
export interface ChoreRecordUser {
  id: number;
  phone?: string | null;
  name?: string | null;
  status?: string;
  created_at?: string;
  updated_at?: string;
}

/** 列表接口嵌套的家务项 */
export interface ChoreRecordNestedChore {
  id: number;
  name: string;
  active?: boolean;
  description?: string | null;
  created_at?: string;
  updated_at?: string;
  default_points?: number | string | null;
}

export interface ChoreRecordListItem {
  id: number;
  chore_type?: string;
  chore_id: number | null;
  custom_chore_name?: string | null;
  chore_name?: string | null;
  performer_id: number;
  creator_id?: number;
  source_text?: string | null;
  points: string | number;
  performed_at: string;
  chore: ChoreRecordNestedChore | null;
  performer: ChoreRecordUser;
  creator?: ChoreRecordUser;
}

export interface ChoreRecordsListMeta {
  total_pages: number;
  current_page: number;
  total_count: number;
  next_page: number | null;
}

export interface ChoreRecordsListResponse {
  items: ChoreRecordListItem[];
  meta: ChoreRecordsListMeta;
  /** 筛选条件下的统计等，字段以后端为准 */
  summary?: Record<string, unknown>;
}

export interface ListChoreRecordsParams {
  page?: number;
  limit?: number;
  performer_id?: number;
  chore_id?: number;
  performed_at_from?: string;
  performed_at_to?: string;
}

export const listChoreRecords = async (
  params?: ListChoreRecordsParams
): Promise<ChoreRecordsListResponse> => {
  return await http.get<ChoreRecordsListResponse, ChoreRecordsListResponse>("/v1/chore_records", {
    params
  });
};

export interface ChoreRecord {
  id: number;
  chore_id: number | null;
  performer_id: number;
  points: string | number;
  performed_at: string;
  chore_name?: string;
  source_text?: string;
  message?: string;
}

export interface ChoreRecordCreateResult extends ChoreRecord {
  message?: string;
}

export const createChoreRecord = async (
  payload: ChoreRecordCreatePayload
): Promise<ChoreRecordCreateResult> => {
  return await http.post<ChoreRecordCreateResult, ChoreRecordCreateResult>("/v1/chore_records/parse_from_text", payload);
};

export interface UpdateChoreRecordPayload {
  performer_id: number;
  chore_id: number;
  points: number;
  performed_at: string;
}

export const updateChoreRecord = async (
  id: number,
  payload: UpdateChoreRecordPayload
): Promise<ChoreRecord> => {
  return await http.patch<ChoreRecord, ChoreRecord>(`/v1/chore_records/${id}`, payload);
};

export const deleteChoreRecord = async (id: number): Promise<{ message?: string }> => {
  return await http.delete<{ message?: string }, { message?: string }>(`/v1/chore_records/${id}`);
};
