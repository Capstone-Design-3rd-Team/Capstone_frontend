// app/lib/session/sessionStorage.ts
import type { StoredSession, StoredSessionMap } from "./sessionTypes"

const STORAGE_KEY = "uxEvalSessions";

export function loadSessions(): StoredSessionMap {
  if (typeof window === "undefined") return {};
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return {};
    return JSON.parse(raw) as StoredSessionMap;
  } catch (e) {
    console.error("Failed to load sessions from localStorage", e);
    return {};
  }
}

export function saveSessions(map: StoredSessionMap) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(map));
  } catch (e) {
    console.error("Failed to save sessions to localStorage", e);
  }
}

// websiteId 기준으로 세션 추가/업데이트
export function upsertSession(session: StoredSession) {
  const map = loadSessions();
  map[session.websiteId] = session;
  saveSessions(map);
}

export function getSession(websiteId: string): StoredSession | undefined {
  const map = loadSessions();
  return map[websiteId];
}
