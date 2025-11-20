"use client";

import { useEffect, useState } from "react";
import styles from "./page.module.css";

import type { StoredSession, SessionStatus } from "@/app/lib/session/sessionTypes";
import { getSession, upsertSession } from "@/app/lib/session/sessionStorage";

import type { AnalysisResultEnvelope } from "@/app/lib/types/analysis";
import { generateAnalysisPdf } from "./generatePdf";

// -------------------------------
// LABELS
// -------------------------------
const labelMap = {
  CRAWLING: "URL 수집 중…",
  ANALYZING: "AI 분석 중…",
  COMPLETED: "분석 완료",
  ERROR: "오류 발생",
} as const;

type SseStage = keyof typeof labelMap;

interface SseProgressDto {
  stage: SseStage;
  crawledCount?: number;
  analyzedCount?: number;
  totalCount?: number;
  percentage?: number;
  message?: string;
}

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
  const [sseStarted, setSseStarted] = useState(false); // 🔥 중복 실행 방지 핵심

  // ------------------------------------------------------------------
  // 세션 업데이트
  // ------------------------------------------------------------------
  const updateSession = (patch: Partial<StoredSession>) => {
    if (!session) return;
    const updated = { ...session, ...patch };
    setSession(updated);
    upsertSession(updated);
  };

  // ------------------------------------------------------------------
  // 1) 초기 세션 로드
  // ------------------------------------------------------------------
  useEffect(() => {
    if (!websiteId) {
      setError("URL 파라미터 websiteId 없음");
      return;
    }

    const saved = getSession(websiteId);

    if (saved) {
      setSession(saved);
      setStatusLabel(labelMap[saved.status as SseStage] ?? "진행 중…");
      setLoading(false);
      return;
    }

    const clientId =
      window.localStorage.getItem("uxEvalClientId") || "(unknown-client)";

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

  // ------------------------------------------------------------------
  // 2) 최종 보고서 조회 (도메인 직접)
  // ------------------------------------------------------------------
  const fetchFinalReport = async (websiteId: string) => {
    try {
      console.log("📥 최종 보고서 요청:", websiteId);

      const res = await fetch(`https://www.webaudit.cloud/api/reports/${websiteId}`);

      if (!res.ok) throw new Error("보고서 조회 실패");

      const finalReport: AnalysisResultEnvelope = await res.json();

      updateSession({
        status: "DONE",
        progress: 100,
        resultJson: finalReport,
      });

      setStatusLabel("분석 완료");
      console.log("📘 최종 보고서 로드 완료");
    } catch (err) {
      console.error("❌ 최종 보고서 조회 오류:", err);
      setError("최종 보고서 조회 실패 (재시도 필요)");
    }
  };

  // ------------------------------------------------------------------
  // 3) SSE 연결 (중복 방지 + 안정화)
  // ------------------------------------------------------------------
  useEffect(() => {
    if (!session) return;
    if (session.status === "DONE" && session.resultJson) return;

    // 🔥 이미 SSE 실행한 적 있으면 return → 중복 방지!
    if (sseStarted) return;

    const clientId = session.clientSessionId;
    if (!clientId || clientId === "(unknown-client)") {
      setError("clientId 없음");
      return;
    }

    setSseStarted(true); // SSE는 단 한 번만 실행

    const sseUrl = `https://www.webaudit.cloud/api/sse/connect/${encodeURIComponent(clientId)}`;
    console.log("🔌 SSE 연결 시도:", sseUrl);

    const es = new EventSource(sseUrl);

    es.onopen = () => {
      console.log("🔌 SSE 연결됨");
      setSseConnected(true);
      setLoading(false);
    };

    es.onerror = () => {
      console.warn("⚠️ SSE 오류 발생");
    };

    es.addEventListener("progress", (event) => {
      const dto = JSON.parse((event as MessageEvent).data) as SseProgressDto;

      updateSession({
        status: dto.stage as SessionStatus,
        progress: dto.percentage ?? 0,
      });

      setStatusLabel(dto.message ?? labelMap[dto.stage]);

      if (dto.percentage === 100) {
        console.log("➡️ progress=100 → 보고서 직접 조회 실행");
        fetchFinalReport(session.websiteId);
      }
    });

    es.addEventListener("complete", (event) => {
      const data = JSON.parse((event as MessageEvent).data);
      console.log("🎉 SSE complete 수신:", data);

      fetchFinalReport(data.websiteId);
      es.close();
    });

    return () => es.close();
  }, [session, sseStarted]);

  // ------------------------------------------------------------------
  // PDF 다운로드
  // ------------------------------------------------------------------
  const handleDownloadPdf = async () => {
    if (!session?.resultJson) return;
    await generateAnalysisPdf(session.resultJson);
  };

  // ------------------------------------------------------------------
  // UI 렌더링
  // ------------------------------------------------------------------
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

  const isDone = session.status === "DONE";
  const isError = session.status === "ERROR";

  return (
    <main className={styles.container}>
      <h1 className={styles.title}>웹사이트 UX 분석 결과</h1>
      <p className={styles.subtitle}>URL: {session.mainUrl}</p>

      {/* Progress 영역 */}
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
