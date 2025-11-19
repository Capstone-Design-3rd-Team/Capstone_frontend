"use client";

import { useEffect, useState } from "react";
import styles from "./page.module.css";

import type {
  StoredSession,
  SessionStatus,
} from "../lib/session/sessionTypes";
import {
  getSession,
  upsertSession,
} from "../lib/session/sessionStorage";
import type { AnalysisResultEnvelope } from "../lib/types/analysis";
import { generateAnalysisPdf } from "./generatePdf";

// ==== 환경 설정 ====

const API_BASE = process.env.NEXT_PUBLIC_API_BASE_URL;
const MOCK_MODE = !API_BASE;

// ==== Swagger 기반 타입들 ====

type SseStage = "CRAWLING" | "ANALYZING" | "COMPLETED" | "ERROR";

interface SseProgressDto {
  stage: SseStage;
  crawledCount?: number;
  analyzedCount?: number;
  totalCount?: number;
  percentage?: number;
  message?: string;
}

// 여기서는 최종 결과를 기존 AnalysisResultEnvelope 형태라고 가정하고 사용
// (백엔드에서 complete 이벤트에 이 JSON을 넘겨준다고 가정)
type FinalReportDto = AnalysisResultEnvelope;

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

function mapStageToProgress(
  dto: SseProgressDto
): { status: SessionStatus; progress: number; label: string } {
  const stage = dto.stage;

  // 기본 메시지
  const baseMessage = dto.message ?? "";

  if (stage === "CRAWLING") {
    // URL 수집 단계 – 전체의 0~40% 정도
    let progress = 20;
    if (dto.totalCount && dto.crawledCount != null) {
      const ratio = dto.totalCount
        ? dto.crawledCount / dto.totalCount
        : 0;
      progress = 10 + Math.min(40, Math.round(ratio * 40));
    }
    return {
      status: "RUNNING",
      progress,
      label: baseMessage || "URL 수집 중…",
    };
  }

  if (stage === "ANALYZING") {
    // 분석 단계 – 퍼센트 그대로 쓰되, 최소 40% 이상
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
      label: baseMessage || "분석 중 오류 발생",
    };
  }

  // 알 수 없는 값
  return {
    status: "RUNNING",
    progress: 10,
    label: baseMessage || stage,
  };
}

interface ResultClientProps {
  websiteId?: string;
  mainUrl?: string;
}

export default function ResultClient({
  websiteId,
  mainUrl,
}: ResultClientProps) {
  const [session, setSession] = useState<StoredSession | null>(null);
  const [statusLabel, setStatusLabel] = useState("초기화 중…");
  const [loading, setLoading] = useState(true);
  const [sseConnected, setSseConnected] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // ===== 1. 세션 초기화 (localStorage 기반) =====
  useEffect(() => {
    if (!websiteId) return;

    const existing = getSession(websiteId);
    if (existing) {
      // 이미 저장된 세션이 있으면 그대로 사용
      setSession(existing);
      setStatusLabel(labelFor(existing.status));
      setLoading(false);
      return;
    }

    // 메인에서 세션을 못 저장한 경우 (URL 직접 접근 등)
    // -> clientId는 공용 키에서 다시 읽음
    let clientId = window.localStorage.getItem("uxEvalClientId") || "";
    if (!clientId) {
      // 정말 없으면 SSE는 연결이 안 될 수 있지만, 일단 빈 값으로 둠
      clientId = "(unknown-client)";
    }

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
    setStatusLabel(labelFor("PENDING"));
    setLoading(false);
  }, [websiteId, mainUrl]);

  const updateSession = (patch: Partial<StoredSession>) => {
    if (!session) return;
    const updated: StoredSession = { ...session, ...patch };
    setSession(updated);
    upsertSession(updated);
  };

  // ===== 2. SSE 연결 (진행 상황 + 최종 결과) =====
  useEffect(() => {
    if (MOCK_MODE) return;
    if (!API_BASE) return;
    if (!session) return;

    // 이미 완료 + 결과까지 있으면 SSE 안 붙여도 됨
    if (session.status === "DONE" && session.resultJson) return;

    const clientId = session.clientSessionId;
    if (!clientId || clientId === "(unknown-client)") {
      setError("clientId 정보를 찾을 수 없어 진행 상황을 구독할 수 없습니다.");
      return;
    }

    setError(null);
    setLoading(true);

    const url = `${API_BASE}/api/sse/connect/${encodeURIComponent(
      clientId
    )}`;

    const es = new EventSource(url);

    es.onopen = () => {
      setSseConnected(true);
      setLoading(false);
    };

    es.onerror = (event) => {
      console.error("SSE error", event);
      setError("서버와의 SSE 연결 중 오류가 발생했습니다.");
      setSseConnected(false);
      // 연결 실패 시 닫기
      es.close();
    };

    // connect 이벤트 (옵션)
    es.addEventListener("connect", (event) => {
      console.log("SSE connected event:", event);
    });

    // progress 이벤트
    es.addEventListener("progress", (event) => {
      try {
        const data: SseProgressDto = JSON.parse(
          (event as MessageEvent).data
        );
        const mapped = mapStageToProgress(data);

        updateSession({
          status: mapped.status,
          progress: mapped.progress,
        });
        setStatusLabel(mapped.label);
      } catch (e) {
        console.error("Failed to parse progress event", e);
      }
    });

    // complete 이벤트 (최종 결과)
    es.addEventListener("complete", (event) => {
      try {
        const data: FinalReportDto = JSON.parse(
          (event as MessageEvent).data
        );

        updateSession({
          status: "DONE",
          progress: 100,
          resultJson: data,
        });
        setStatusLabel("분석 완료");
        setSseConnected(false);
        es.close();
      } catch (e) {
        console.error("Failed to parse complete event", e);
        setError("최종 결과를 처리하는 중 오류가 발생했습니다.");
      }
    });

    return () => {
      es.close();
    };
    // session.clientSessionId가 바뀌면 다시 연결
  }, [session]);

  // ===== 3. PDF 다운로드 =====
  const handleDownloadPdf = async () => {
    if (!session || !session.resultJson) return;
    try {
      await generateAnalysisPdf(
        session.resultJson as AnalysisResultEnvelope
      );
    } catch (e) {
      console.error(e);
      setError("PDF 생성 중 오류가 발생했습니다.");
    }
  };

  // ===== 4. 렌더링 =====

  if (!websiteId) {
    return (
      <main className={styles.container}>
        <h1 className={styles.title}>분석 결과</h1>
        <p className={styles.error}>URL 파라미터에 websiteId가 없습니다.</p>
      </main>
    );
  }

  if (!session) {
    return (
      <main className={styles.container}>
        <h1 className={styles.title}>분석 결과</h1>
        <p>세션을 불러오는 중입니다…</p>
      </main>
    );
  }

  const isDone = session.status === "DONE";
  const isError = session.status === "ERROR";

  return (
    <main className={styles.container}>
      <h1 className={styles.title}>웹사이트 UX 분석 결과</h1>
      <p className={styles.subtitle}>URL: {session.mainUrl}</p>
      <p className={styles.subtitle}>클라이언트 ID: {session.clientSessionId}</p>

      <section className={styles.section}>
        <div className={styles.statusRow}>
          <span className={styles.statusLabel}>상태</span>
          <span
            className={[
              styles.statusBadge,
              isDone ? styles.statusDone : "",
              isError ? styles.statusError : "",
            ].join(" ")}
          >
            {statusLabel}
          </span>
        </div>

        <div className={styles.progressWrapper}>
          <div className={styles.progressBarOuter}>
            <div
              className={styles.progressBarInner}
              style={{ width: `${session.progress ?? 0}%` }}
            />
          </div>
          <span className={styles.progressText}>
            {session.progress ? `${session.progress.toFixed(0)}%` : "0%"}
          </span>
        </div>

        {loading && <p className={styles.info}>서버와 동기화 중…</p>}
        {sseConnected && !isDone && !isError && (
          <p className={styles.info}>실시간 진행 상황을 수신 중입니다…</p>
        )}
        {error && <p className={styles.error}>{error}</p>}
      </section>

      {session.resultJson && (
        <section className={styles.section}>
          <h2 className={styles.sectionTitle}>요약 결과</h2>

          {/* 여기서는 기존 AnalysisResultEnvelope 구조에 맞춰 표시 */}
          <div className={styles.summaryBox}>
            <div className={styles.summaryRow}>
              <span className={styles.summaryLabel}>최종 점수</span>
              <span className={styles.summaryValue}>
                {session.resultJson.results.summary.final_score.toFixed(1)} 점
              </span>
            </div>
            <div className={styles.summaryRow}>
              <span className={styles.summaryLabel}>중요도 수준</span>
              <span className={styles.summaryValue}>
                {session.resultJson.results.summary.severity_level}
              </span>
            </div>
            <div className={styles.summaryRow}>
              <span className={styles.summaryLabel}>접근성 등급</span>
              <span className={styles.summaryValue}>
                {session.resultJson.results.summary.accessibility_level}
              </span>
            </div>
          </div>

          <button className={styles.button} onClick={handleDownloadPdf}>
            PDF 다운로드
          </button>
        </section>
      )}

      {!session.resultJson && !isError && (
        <section className={styles.section}>
          <h2 className={styles.sectionTitle}>분석 중 안내</h2>
          <p className={styles.text}>
            현재 웹사이트를 크롤링하고, 디지털 취약계층 가이드라인에 따라 분석을 진행하고 있습니다.
            이 페이지를 유지하거나, 나중에 동일한 컴퓨터에서 다시 접속해도
            진행 상태와 결과를 계속 확인할 수 있습니다.
          </p>
        </section>
      )}

      {isError && (
        <section className={styles.section}>
          <h2 className={styles.sectionTitle}>오류 안내</h2>
          <p className={styles.text}>
            분석 과정에서 오류가 발생했습니다. 잠시 후 다시 시도하거나,
            URL이 올바른지 확인해 주세요.
          </p>
        </section>
      )}
    </main>
  );
}
