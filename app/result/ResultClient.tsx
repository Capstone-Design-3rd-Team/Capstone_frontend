"use client";

import { useEffect, useRef, useState } from "react";
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
  percentage?: number;
  message?: string;
}

export default function ResultClient({ websiteId, mainUrl }: { websiteId?: string; mainUrl?: string }) {
  const [session, setSession] = useState<StoredSession | null>(null);
  const [statusLabel, setStatusLabel] = useState("초기화 중…");
  const [loading, setLoading] = useState(true);
  const [sseConnected, setSseConnected] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // SSE 객체 저장
  const sseRef = useRef<EventSource | null>(null);

  // 보고서 중복 요청 방지
  const fetchingReportRef = useRef(false);

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
  // 초기 세션 로드
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

  // ------------------------------------------------------------------
  // 보고서 조회
  // ------------------------------------------------------------------
  const fetchFinalReport = async (websiteId: string, retry = 0) => {
    if (fetchingReportRef.current) return;
    fetchingReportRef.current = true;

    try {
      console.log(`📥 보고서 요청(${retry}) : ${websiteId}`);

      const res = await fetch(`https://www.webaudit.cloud/api/reports/${websiteId}`);

      if (res.status === 404) {
        if (retry < 20) {
          console.log("⏳ 보고서 없음 → 재시도");
          fetchingReportRef.current = false;
          setTimeout(() => fetchFinalReport(websiteId, retry + 1), 1500);
          return;
        }
        throw new Error("보고서가 존재하지 않습니다.");
      }

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
      console.error("❌ 보고서 조회 오류:", err);
      setError("최종 보고서 조회 실패");
    }
  };

  // ------------------------------------------------------------------
  // SSE 연결
  // ------------------------------------------------------------------
  useEffect(() => {
    if (!websiteId) return;
    if (session?.status === "DONE") return;
    if (sseRef.current) return;

    const clientId = session?.clientSessionId;
    if (!clientId || clientId === "(unknown-client)") return;

    const url = `https://www.webaudit.cloud/api/sse/connect/${encodeURIComponent(clientId)}`;
    console.log("🔌 SSE 연결:", url);

    const es = new EventSource(url);
    sseRef.current = es;

    es.onopen = () => {
      console.log("🔌 SSE 연결됨");
      setSseConnected(true);
      setLoading(false);
    };

  es.addEventListener("progress", (event) => {
    const dto = JSON.parse(event.data) as SseProgressDto;

    updateSession({
      status: dto.stage as SessionStatus,
      progress: dto.percentage ?? 0,
    });

    setStatusLabel(dto.message ?? labelMap[dto.stage as SseStage]);

    if (dto.percentage === 100) {
      fetchingReportRef.current = false;
      fetchFinalReport(websiteId, 0);
    }
  });


    es.addEventListener("complete", (event) => {
      const data = JSON.parse(event.data);

      console.log("🎉 SSE complete:", data);

      fetchingReportRef.current = false;
      fetchFinalReport(data.websiteId, 0);

      es.close();
      sseRef.current = null;
    });

    es.onerror = () => console.warn("⚠ SSE error");

    return () => {
      es.close();
      sseRef.current = null;
    };
  }, [websiteId, session?.clientSessionId]);

  // ------------------------------------------------------------------
  // PDF 다운로드
  // ------------------------------------------------------------------
  const handleDownloadPdf = async () => {
    if (!session?.resultJson) return;
    await generateAnalysisPdf(session.resultJson);
  };

  // ------------------------------------------------------------------
  // UI
  // ------------------------------------------------------------------
  if (!session)
    return (
      <main className={styles.container}>
        <p>세션 로딩 중…</p>
      </main>
    );

  const isDone = session.status === "DONE";

  return (
    <main className={styles.container}>
      <h1 className={styles.title}>웹사이트 UX 분석 결과</h1>
      <p className={styles.subtitle}>URL: {session.mainUrl}</p>

      {/* 상태 표시 */}
      <section className={styles.section}>
        <div className={styles.statusRow}>
          <span className={styles.statusLabel}>상태</span>
          <span className={styles.statusBadge}>{statusLabel}</span>
        </div>

        <div className={styles.progressWrapper}>
          <div className={styles.progressBarOuter}>
            <div className={styles.progressBarInner} style={{ width: `${session.progress}%` }} />
          </div>
          <span className={styles.progressText}>{session.progress}%</span>
        </div>
      </section>

      {/* 최종 결과 */}
      {isDone && session.resultJson && (
        <section className={styles.section}>
          <h2 className={styles.sectionTitle}>요약 결과</h2>

          <div className={styles.summaryBox}>
            <div className={styles.summaryRow}>
              <span>평균 점수</span>
              <span>{session.resultJson.averageScore?.toFixed(1) ?? "-"}</span>
            </div>

            <div className={styles.summaryRow}>
              <span>전체 수준</span>
              <span>{session.resultJson.overallLevel}</span>
            </div>

            <div className={styles.summaryRow}>
              <span>심각도</span>
              <span>{session.resultJson.severityLevel}</span>
            </div>

            <div className={styles.summaryRow}>
              <span>분석된 URL 수</span>
              <span>{session.resultJson.totalAnalyzedUrls}</span>
            </div>
          </div>

          <button className={styles.button} onClick={handleDownloadPdf}>
            PDF 다운로드
          </button>
        </section>
      )}
    </main>
  );
}
