// app/result/sessionTypes.ts

export type SessionStatus = "PENDING" | "RUNNING" | "DONE" | "ERROR";

export interface StoredSession {
  websiteId: string;
  mainUrl: string;
  clientSessionId: string; // 프론트에서 만드는 uuid
  status: SessionStatus;
  progress: number;        // 0 ~ 100
  resultJson?: any;        // 최종 결과(JSON 그대로), 나중에 타입 좁혀도 됨
  createdAt: string;       // ISO 문자열
}

// websiteId를 key로 쓰는 맵 형태
export type StoredSessionMap = Record<string, StoredSession>;
