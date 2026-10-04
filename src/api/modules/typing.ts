import http from "../http";

export interface PaginationMeta {
  total_pages: number;
  current_page: number;
  total_count: number;
  next_page: number | null;
}

export interface PaginatedList<T> {
  items: T[];
  meta: PaginationMeta;
}

export interface TypingArticle {
  id: number;
  title: string;
  body: string;
  created_at: string;
  updated_at: string;
}

export interface TypingArticlePayload {
  title: string;
  body: string;
}

export interface TypingWord {
  id: number;
  character: string;
  wubi_code: string | null;
  wubi_roots?: string[] | null;
  created_at: string;
  updated_at: string;
}

export const formatWubiRoots = (roots: string[] | null | undefined): string => {
  if (!roots?.length) return "";
  return roots.filter((item) => item.trim()).join(" ");
};

export interface TypingErrorMark {
  id: number;
  typing_practice_id: number;
  typing_word_id: number;
  mistake_count: number;
  typing_word: TypingWord;
  created_at: string;
  updated_at: string;
}

export type TypingPracticeStatus = "pending" | "in_progress" | "completed";

export interface TypingPractice {
  id: number;
  user_id: number;
  typing_article_id: number;
  typed_body: string | null;
  started_at: string | null;
  finished_at: string | null;
  duration_ms: number | null;
  correct_count: number;
  error_count: number;
  accuracy: number | string | null;
  cpm: number | string | null;
  status: TypingPracticeStatus;
  typing_article?: TypingArticle;
  typing_error_marks?: TypingErrorMark[];
  created_at: string;
  updated_at: string;
}

export interface ListTypingParams {
  page?: number;
  limit?: number;
}

export interface ListTypingPracticesParams extends ListTypingParams {
  typing_article_id?: number;
}

export const listTypingArticles = async (
  params?: ListTypingParams
): Promise<PaginatedList<TypingArticle>> => {
  return await http.get<PaginatedList<TypingArticle>, PaginatedList<TypingArticle>>(
    "/v1/typing_articles",
    { params }
  );
};

export const getTypingArticle = async (id: number): Promise<TypingArticle> => {
  return await http.get<TypingArticle, TypingArticle>(`/v1/typing_articles/${id}`);
};

export const createTypingArticle = async (payload: TypingArticlePayload): Promise<TypingArticle> => {
  return await http.post<TypingArticle, TypingArticle>("/v1/typing_articles", {
    typing_article: payload
  });
};

export const updateTypingArticle = async (
  id: number,
  payload: TypingArticlePayload
): Promise<TypingArticle> => {
  return await http.put<TypingArticle, TypingArticle>(`/v1/typing_articles/${id}`, {
    typing_article: payload
  });
};

export const deleteTypingArticle = async (id: number): Promise<TypingArticle> => {
  return await http.delete<TypingArticle, TypingArticle>(`/v1/typing_articles/${id}`);
};

export const listTypingPractices = async (
  params?: ListTypingPracticesParams
): Promise<PaginatedList<TypingPractice>> => {
  return await http.get<PaginatedList<TypingPractice>, PaginatedList<TypingPractice>>(
    "/v1/typing_practices",
    { params }
  );
};

export const getTypingPractice = async (id: number): Promise<TypingPractice> => {
  return await http.get<TypingPractice, TypingPractice>(`/v1/typing_practices/${id}`);
};

export const createTypingPractice = async (typingArticleId: number): Promise<TypingPractice> => {
  return await http.post<TypingPractice, TypingPractice>("/v1/typing_practices", {
    typing_practice: { typing_article_id: typingArticleId }
  });
};

export const startTypingPractice = async (id: number): Promise<TypingPractice> => {
  return await http.post<TypingPractice, TypingPractice>(`/v1/typing_practices/${id}/start`);
};

export const completeTypingPractice = async (id: number, typedBody: string): Promise<TypingPractice> => {
  return await http.post<TypingPractice, TypingPractice>(`/v1/typing_practices/${id}/complete`, {
    typing_practice: { typed_body: typedBody }
  });
};

export const updateTypingPractice = async (
  id: number,
  payload: { typed_body: string }
): Promise<TypingPractice> => {
  return await http.put<TypingPractice, TypingPractice>(`/v1/typing_practices/${id}`, {
    typing_practice: payload
  });
};

export interface CreateTypingErrorMarkPayload {
  character: string;
  wubi_code?: string;
}

export const createTypingErrorMark = async (
  practiceId: number,
  payload: CreateTypingErrorMarkPayload
): Promise<TypingErrorMark> => {
  return await http.post<TypingErrorMark, TypingErrorMark>(
    `/v1/typing_practices/${practiceId}/error_marks`,
    { typing_error_mark: payload }
  );
};

/** 实时查 86 版五笔全码；未落库时后端会同步调 AI，可能较慢。 */
export const lookupTypingWord = async (character: string): Promise<TypingWord> => {
  return await http.get<TypingWord, TypingWord>("/v1/typing_words/lookup", {
    params: { character },
    timeout: 30_000
  });
};
