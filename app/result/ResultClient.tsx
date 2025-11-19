"use client";

import { useEffect, useState } from "react";
import styles from "./page.module.css";

import type { StoredSession, SessionStatus } from "@/app/lib/session/sessionTypes";
import { getSession, upsertSession } from "@/app/lib/session/sessionStorage";

import type { AnalysisResultEnvelope } from "@/app/lib/types/analysis";
import { generateAnalysisPdf } from "./generatePdf";

// ===== 프록시 기반 서버 주소 =====
// Vercel 배포 시 /api-proxy 로 자동 대체됨.
const API_BASE = process.env.NEXT_PUBLIC_API_BASE_URL || "/api-proxy";
const MOCK_MODE = false;


// ─────────────────────────────────────────────────────────────
// Swagger 기반 타입
// ─────────────────────────────────────────────────────────────
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


// ─────────────────────────────────────────────────────────────
// 상태 변환 함수
// ─────────────────────────────────────────────────────────────
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

function mapStageToProgress(dto: SseProgressDto): {
  status: SessionStatus;
  progress: number;
  label: string;
} {
  const stage = dto.stage;
  const baseMessage = dto.message ?? "";

  if (stage === "CRAWLING") {
    let progress = 20;
    if (dto.totalCount && dto.crawledCount != null) {
      const ratio = dto.crawledCount / dto.totalCount;
      progress = 10 + Math.min(40, Math.round(ratio * 40));
    }
    return {
      status: "RUNNING",
      progress,
      label: baseMessage || "URL 수집 중…",
    };
  }

  if (stage === "ANALYZING") {
    const p = dto.percentage ?? 50;
    const progress = Math.max(40, Math.min(99, p));
    return {
      status: "RUNNING",
      progress,
      label: baseMessage || `분석 중… ${progress}%`,
    };
  }

  if (stage === "COMPLETED") {
    return {
      status: "DONE",
      progress: 100,
      label: baseMessage || "분석 완료",
    };
  }

  if (stage === "ERROR") {
    return {
      status: "ERROR",
      progress: 100,
      label: baseMessage || "오류 발생",
    };
  }

  // 🔥 stage 값이 잘못 와도 status는 고정값만
  return {
    status: "RUNNING",
    progress: 10,
    label: baseMessage || "진행 중…",
  };
}



// ─────────────────────────────────────────────────────────────
// ResultClient 컴포넌트
// ─────────────────────────────────────────────────────────────
export default function ResultClient({ websiteId, mainUrl }: { websiteId?: string; mainUrl?: string; }) {
  const [session, setSession] = useState<StoredSession | null>(null);
  const [statusLabel, setStatusLabel] = useState("초기화 중…");
  const [loading, setLoading] = useState(true);
  const [sseConnected, setSseConnected] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // ---------------------------
  // 1) 세션 초기화
  // ---------------------------
  useEffect(() => {
    if (!websiteId) return;

    const saved = getSession(websiteId);
    if (saved) {
      setSession(saved);
      setStatusLabel(labelFor(saved.status));
      setLoading(false);
      return;
    }

    const clientId = window.localStorage.getItem("uxEvalClientId") || "(unknown-client)";

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


  const updateSession = (patch: Partial<StoredSession>) => {
    if (!session) return;
    const obj = { ...session, ...patch };
    setSession(obj);
    upsertSession(obj);
  };


  // ---------------------------
  // 2) SSE 연결
  // ---------------------------
  useEffect(() => {
    if (!session) return;

    // 이미 완료되었다면 연결 불필요
    if (session.status === "DONE" && session.resultJson) return;

    const clientId = session.clientSessionId;
    if (!clientId || clientId === "(unknown-client)") {
      setError("clientId를 찾을 수 없습니다.");
      return;
    }

    setError(null);
    setLoading(true);

    // 🔥 SSE 주소도 /api-proxy 경유
    const sseUrl = `${API_BASE}/api/sse/connect/${encodeURIComponent(clientId)}`;

    const es = new EventSource(sseUrl);

    es.onopen = () => {
      setSseConnected(true);
      setLoading(false);
    };

    es.onerror = (e) => {
      console.error("SSE Error:", e);
      setError("SSE 연결 오류가 발생했습니다.");
      es.close();
    };

    // progress 이벤트
    es.addEventListener("progress", (event) => {
      try {
        const dto = JSON.parse((event as MessageEvent).data) as SseProgressDto;
        const mapped = mapStageToProgress(dto);

        updateSession({ status: mapped.status, progress: mapped.progress });
        setStatusLabel(mapped.label);
      } catch (err) {
        console.error("parse error", err);
      }
    });

    // complete 이벤트 = 최종 분석 결과
    es.addEventListener("complete", (event) => {
      try {
        const report = JSON.parse((event as MessageEvent).data) as FinalReportDto;

        updateSession({
          status: "DONE",
          progress: 100,
          resultJson: report,
        });

        setStatusLabel("분석 완료");
        es.close();
      } catch (err) {
        console.error("complete parse error", err);
      }
    });

    return () => es.close();
  }, [session]);


  // ---------------------------
  // 3) PDF 다운로드
  // ---------------------------
  const handleDownloadPdf = async () => {
    if (!session?.resultJson) return;
    try {
      await generateAnalysisPdf(session.resultJson as AnalysisResultEnvelope);
    } catch {
      setError("PDF 생성 중 오류가 발생했습니다.");
    }
  };


  // ---------------------------
  // 4) UI 렌더링
  // ---------------------------
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
          <span className={[
            styles.statusBadge,
            done ? styles.statusDone : "",
            err ? styles.statusError : ""
          ].join(" ")}>
            {statusLabel}
          </span>
        </div>

        <div className={styles.progressWrapper}>
          <div className={styles.progressBarOuter}>
            <div className={styles.progressBarInner} style={{ width: `${session.progress}%` }} />
          </div>
          <span className={styles.progressText}>
            {session.progress.toFixed(0)}%
          </span>
        </div>

        {loading && <p className={styles.info}>서버와 동기화 중…</p>}
        {sseConnected && !done && !err && (
          <p className={styles.info}>실시간 분석 진행 중…</p>
        )}
        {error && <p className={styles.error}>{error}</p>}
      </section>


      {/* 결과 표시 */}
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
