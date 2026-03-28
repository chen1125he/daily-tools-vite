import http from "../http";

export interface ChoreRecordCreatePayload {
  text: string;
}

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
