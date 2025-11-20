"use client";

import { useEffect, useState } from "react";
import styles from "./page.module.css";

import type { StoredSession, SessionStatus } from "@/app/lib/session/sessionTypes";
import { getSession, upsertSession } from "@/app/lib/session/sessionStorage";

import type { AnalysisResultEnvelope } from "@/app/lib/types/analysis";
import { generateAnalysisPdf } from "./generatePdf";

// ===== 서버 URL =====
const API_BASE = "/api-proxy";
const MOCK_MODE = false;

// ──────────────────────────────────────────
// 타입 정의
// ──────────────────────────────────────────
type SseStage = "CRAWLING" | "ANALYZING" | "COMPLETED" | "ERROR";

interface SseProgressDto {
  stage: SseStage;
  crawledCount?: number;
  analyzedCount?: number;
  totalCount?: number;
  percentage?: number;
  message?: string;
}

type FinalReportDto = AnalysisResultEnvelope;

// 상태 라벨 변환
function labelFor(status: SessionStatus): string {
  switch (status) {
    case "PENDING":
      return "대기 중";
    case "RUNNING":
      return "분석 진행 중";
    case "DONE":
      return "분석 완료";
    case "ERROR":
      return "오류 발생";
    default:
      return status;
  }
}

function mapStageToProgress(dto: SseProgressDto) {
  console.log("📡 [SSE] Progress DTO:", dto);

  const stage = dto.stage;
  const message = dto.message ?? "";

  if (stage === "CRAWLING") {
    let progress = 20;
    if (dto.totalCount && dto.crawledCount != null) {
      const ratio = dto.crawledCount / dto.totalCount;
      progress = 10 + Math.min(40, Math.round(ratio * 40));
    }
    return { status: "RUNNING" as SessionStatus, progress, label: message || "URL 수집 중…" };
  }

  if (stage === "ANALYZING") {
    const p = dto.percentage ?? 50;
    const progress = Math.max(40, Math.min(99, p));
    return { status: "RUNNING" as SessionStatus, progress, label: message || `분석 중… ${progress}%` };
  }

  if (stage === "COMPLETED") {
    return { status: "DONE" as SessionStatus, progress: 100, label: message || "분석 완료" };
  }

  if (stage === "ERROR") {
    return { status: "ERROR" as SessionStatus, progress: 100, label: message || "오류 발생" };
  }

  return { status: "RUNNING" as SessionStatus, progress: 10, label: message || "진행 중…" };
}

// ──────────────────────────────────────────
// ResultClient
// ──────────────────────────────────────────
export default function ResultClient({
  websiteId,
  mainUrl,
}: {
  websiteId?: string;
  mainUrl?: string;
}) {
  const [session, setSession] = useState<StoredSession | null>(null);
  const [statusLabel, setStatusLabel] = useState("초기화 중…");
  const [loading, setLoading] = useState(true);
  const [sseConnected, setSseConnected] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // -----------------------------
  // 1) 세션 초기화
  // -----------------------------
  useEffect(() => {
    console.log("🔍 [ResultPage] websiteId =", websiteId, "mainUrl =", mainUrl);

    if (!websiteId) {
      console.warn("⚠️ websiteId가 없음 → result 페이지가 제대로 호출되지 않았습니다.");
      setError("URL 파라미터에 websiteId가 없습니다.");
      return;
    }

    const saved = getSession(websiteId);
    console.log("🔍 [localStorage] Loaded session =", saved);

    if (saved) {
      setSession(saved);
      setStatusLabel(labelFor(saved.status));
      setLoading(false);
      return;
    }

    // 메인에서 넘어온 세션이 없을 때
    const clientId = window.localStorage.getItem("uxEvalClientId") || "(unknown-client)";
    console.log("🆕 Creating new session — clientId =", clientId);

    const newSession: StoredSession = {
      websiteId,
      mainUrl: mainUrl ?? "",
      clientSessionId: clientId,
      status: "PENDING",
      progress: 0,
      createdAt: new Date().toISOString(),
    };

    upsertSession(newSession);
    setSession(newSession);

    setStatusLabel("대기 중");
    setLoading(false);
  }, [websiteId, mainUrl]);

  // 세션 업데이트
  const updateSession = (patch: Partial<StoredSession>) => {
    if (!session) return;
    const updated = { ...session, ...patch };
    console.log("📝 [Session Update]", updated);

    setSession(updated);
    upsertSession(updated);
  };

  // -----------------------------
  // 2) SSE 연결
  // -----------------------------
  useEffect(() => {
    if (!session) return;

    console.log("📡 [SSE INIT] Session =", session);

    if (session.status === "DONE" && session.resultJson) {
      console.log("📡 Already completed result exists → SSE 연결 안 함");
      return;
    }

    const clientId = session.clientSessionId;
    if (!clientId || clientId === "(unknown-client)") {
      console.error("❌ clientId가 없어 SSE 연결 불가");
      setError("clientId를 찾을 수 없습니다.");
      return;
    }

    const sseUrl = `${API_BASE}/api/sse/connect/${encodeURIComponent(clientId)}`;
    console.log("📡 [SSE CONNECT] URL =", sseUrl);

    setLoading(true);

    const es = new EventSource(sseUrl);

    es.onopen = () => {
      console.log("📡 [SSE OPEN] 연결됨");
      setSseConnected(true);
      setLoading(false);
    };

    es.onerror = (e) => {
      console.error("❌ [SSE ERROR]", e);
      setError("SSE 연결 오류가 발생했습니다.");
      es.close();
    };

    // progress 이벤트
    es.addEventListener("progress", (event) => {
      console.log("📡 [SSE EVENT: progress]", event);

      try {
        const dto = JSON.parse((event as MessageEvent).data) as SseProgressDto;
        const mapped = mapStageToProgress(dto);

        console.log("📡 [PROGRESS UPDATE]", mapped);

        updateSession({ status: mapped.status, progress: mapped.progress });
        setStatusLabel(mapped.label);
      } catch (err) {
        console.error("❌ [Progress JSON Parse Error]", err);
      }
    });

    // complete 이벤트
    es.addEventListener("complete", (event) => {
      console.log("📡 [SSE EVENT: complete]", event);

      try {
        const report = JSON.parse((event as MessageEvent).data) as FinalReportDto;
        console.log("📘 [FINAL REPORT RECEIVED]", report);

        updateSession({
          status: "DONE",
          progress: 100,
          resultJson: report,
        });

        setStatusLabel("분석 완료");
        es.close();
      } catch (err) {
        console.error("❌ [Complete JSON Parse Error]", err);
      }
    });

    return () => {
      console.log("📡 [SSE CLOSED]");
      es.close();
    };
  }, [session]);

  // -----------------------------
  // 3) PDF 다운로드
  // -----------------------------
  const handleDownloadPdf = async () => {
    if (!session?.resultJson) return;
    console.log("📄 [PDF] Generating PDF…", session.resultJson);

    try {
      await generateAnalysisPdf(session.resultJson);
    } catch (e) {
      console.error("❌ PDF Error:", e);
      setError("PDF 생성 중 오류가 발생했습니다.");
    }
  };

  // -----------------------------
  // 4) UI 렌더링
  // -----------------------------
  if (!websiteId)
    return (
      <main className={styles.container}>
        <h1>분석 결과</h1>
        <p className={styles.error}>websiteId가 없습니다.</p>
      </main>
    );

  if (!session)
    return (
      <main className={styles.container}>
        <h1>분석 결과</h1>
        <p>세션 로딩 중…</p>
      </main>
    );

  const done = session.status === "DONE";
  const err = session.status === "ERROR";

  return (
    <main className={styles.container}>
      <h1 className={styles.title}>웹사이트 UX 분석 결과</h1>
      <p className={styles.subtitle}>URL: {session.mainUrl}</p>
      <p className={styles.subtitle}>Client ID: {session.clientSessionId}</p>

      {/* 상태 표시 */}
      <section className={styles.section}>
        <div className={styles.statusRow}>
          <span className={styles.statusLabel}>상태</span>
          <span
            className={[
              styles.statusBadge,
              done ? styles.statusDone : "",
              err ? styles.statusError : "",
            ].join(" ")}
          >
            {statusLabel}
          </span>
        </div>

        <div className={styles.progressWrapper}>
          <div className={styles.progressBarOuter}>
            <div className={styles.progressBarInner} style={{ width: `${session.progress}%` }} />
          </div>
          <span className={styles.progressText}>{session.progress.toFixed(0)}%</span>
        </div>

        {loading && <p className={styles.info}>서버와 동기화 중…</p>}
        {sseConnected && !done && !err && <p className={styles.info}>실시간 분석 진행 중…</p>}
        {error && <p className={styles.error}>{error}</p>}
      </section>

      {/* 요약 결과 */}
      {session.resultJson && (
        <section className={styles.section}>
          <h2 className={styles.sectionTitle}>요약 결과</h2>

          <div className={styles.summaryBox}>
            <div className={styles.summaryRow}>
              <span>최종 점수</span>
              <span>{session.resultJson.results.summary.final_score.toFixed(1)} 점</span>
            </div>
            <div className={styles.summaryRow}>
              <span>중요도</span>
              <span>{session.resultJson.results.summary.severity_level}</span>
            </div>
            <div className={styles.summaryRow}>
              <span>접근성 등급</span>
              <span>{session.resultJson.results.summary.accessibility_level}</span>
            </div>
          </div>

          <button className={styles.button} onClick={handleDownloadPdf}>
            PDF 다운로드
          </button>
        </section>
      )}

      {/* 진행 중 안내 */}
      {!session.resultJson && !err && (
        <section className={styles.section}>
          <h2>분석 중…</h2>
          <p>
            URL 수집 및 콘텐츠 분석이 진행 중입니다.
            페이지를 닫아도 진행 상황은 유지됩니다.
          </p>
        </section>
      )}

      {/* 오류 안내 */}
      {err && (
        <section className={styles.section}>
          <h2>오류 발생</h2>
          <p>분석 과정에서 오류가 발생했습니다.</p>
        </section>
      )}
    </main>
  );
}
