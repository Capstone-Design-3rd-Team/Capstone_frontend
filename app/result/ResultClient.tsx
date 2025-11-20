"use client";

import { useEffect, useState } from "react";
import styles from "./page.module.css";

import type { StoredSession, SessionStatus } from "@/app/lib/session/sessionTypes";
import { getSession, upsertSession } from "@/app/lib/session/sessionStorage";

import type { AnalysisResultEnvelope } from "@/app/lib/types/analysis";
import { generateAnalysisPdf } from "./generatePdf";

const API_BASE = "/api-proxy";

type SseStage = "CRAWLING" | "ANALYZING" | "COMPLETED" | "ERROR";

interface SseProgressDto {
  stage: SseStage;
  crawledCount?: number;
  analyzedCount?: number;
  totalCount?: number;
  percentage?: number;
  message?: string;
}

const labelMap: Record<SseStage, string> = {
  CRAWLING: "URL 수집 중…",
  ANALYZING: "AI 분석 중…",
  COMPLETED: "분석 완료",
  ERROR: "오류 발생",
};

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

  // ================================
  // 세션 업데이트 유틸
  // ================================
  const updateSession = (patch: Partial<StoredSession>) => {
    if (!session) return;
    const updated = { ...session, ...patch };
    setSession(updated);
    upsertSession(updated);
  };

  // ================================
  // 1) 초기 세션 로드
  // ================================
  useEffect(() => {
    if (!websiteId) {
      setError("URL 파라미터 websiteId 없음");
      return;
    }

    const saved = getSession(websiteId);

    if (saved) {
      setSession(saved);
      setStatusLabel(labelMap[saved.status as SseStage]);
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

  // ================================
  // 2) 최종 보고서 조회 함수
  // ================================
  const fetchFinalReport = async (websiteId: string) => {
    try {
      const res = await fetch(`/api-proxy/api/reports/${websiteId}`);

      if (!res.ok) throw new Error("보고서 조회 실패");

      const finalReport: AnalysisResultEnvelope = await res.json();

      updateSession({
        status: "DONE",
        progress: 100,
        resultJson: finalReport,
      });

      setStatusLabel("분석 완료");
    } catch (err) {
      console.error("최종 보고서 조회 중 오류:", err);
      setError("최종 보고서 조회 실패 (재시도 필요)");
    }
  };

  // ================================
  // 3) SSE 연결
  // ================================
  useEffect(() => {
    if (!session) return;
    if (session.status === "DONE" && session.resultJson) return;

    const clientId = session.clientSessionId;
    if (!clientId || clientId === "(unknown-client)") {
      setError("clientId 없음");
      return;
    }

    const sseUrl = `https://www.webaudit.cloud/api/sse/connect/${encodeURIComponent(clientId)}`;
    const es = new EventSource(sseUrl);

    es.onopen = () => {
      setSseConnected(true);
      setLoading(false);
    };

    es.onerror = () => {
      console.warn("SSE 오류");
    };

    // progress 이벤트
    es.addEventListener("progress", (event) => {
      const dto = JSON.parse((event as MessageEvent).data) as SseProgressDto;

      updateSession({
        status: dto.stage as SessionStatus,
        progress: dto.percentage ?? 0,
      });

      setStatusLabel(dto.message ?? labelMap[dto.stage]);

      // SSE complete가 유실될 대비
      if (dto.percentage === 100) {
        fetchFinalReport(session.websiteId);
      }
    });

    // complete 이벤트 (신호만 받음)
    es.addEventListener("complete", (event) => {
      const data = JSON.parse((event as MessageEvent).data);

      console.log("완료 신호 수신:", data);

      fetchFinalReport(data.websiteId);
      es.close();
    });

    return () => es.close();
  }, [session]);

  // ================================
  // PDF 다운로드
  // ================================
  const handleDownloadPdf = async () => {
    if (!session?.resultJson) return;
    await generateAnalysisPdf(session.resultJson);
  };

  // ================================
  // UI 렌더링
  // ================================
  if (!websiteId) {
    return (
      <main className={styles.container}>
        <h1>분석 결과</h1>
        <p className={styles.error}>websiteId가 없습니다.</p>
      </main>
    );
  }

  if (!session)
    return (
      <main className={styles.container}>
        <h1>분석 결과</h1>
        <p>세션 로딩 중…</p>
      </main>
    );

  const isDone = session.status === "DONE";
  const isError = session.status === "ERROR";

  return (
    <main className={styles.container}>
      <h1 className={styles.title}>웹사이트 UX 분석 결과</h1>
      <p className={styles.subtitle}>URL: {session.mainUrl}</p>

      {/* 상태 표시 */}
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
              style={{ width: `${session.progress}%` }}
            />
          </div>
          <span className={styles.progressText}>{session.progress}%</span>
        </div>

        {loading && <p className={styles.info}>서버와 동기화 중…</p>}
        {sseConnected && !isDone && !isError && (
          <p className={styles.info}>실시간 분석 진행 중…</p>
        )}
        {error && <p className={styles.error}>{error}</p>}
      </section>

      {/* 최종 결과 */}
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

      {!session.resultJson && !isError && (
        <section className={styles.section}>
          <h2>분석 중…</h2>
          <p>URL 수집 및 콘텐츠 분석이 진행 중입니다.</p>
        </section>
      )}

      {isError && (
        <section className={styles.section}>
          <h2>오류 발생</h2>
          <p>분석 과정에서 오류가 발생했습니다.</p>
        </section>
      )}
    </main>
  );
}
