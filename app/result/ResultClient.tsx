"use client";

import { useEffect, useState } from "react";
import styles from "./page.module.css";

import type { StoredSession, SessionStatus } from "./sessionTypes";
import { getSession, upsertSession } from "./sessionStorage";
import { generateClientSessionId } from "./generateClientSessionId";
import type { AnalysisResultEnvelope } from "./types";
import { generateAnalysisPdf } from "./generatePdf";

// 백엔드 주소 (없으면 mock 모드)
const API_BASE = process.env.NEXT_PUBLIC_API_BASE_URL;
const MOCK_MODE = !API_BASE;

// WebsiteStatusResponse DTO 형태
interface WebsiteStatusResponse {
  websiteId: string;
  mainUrl: string;
  status: string;
  maxDepth: number;
  maxTotalUrls: number;
  createdAt: string;
}

function mapStatusToProgress(status: string): {
  status: SessionStatus;
  progress: number;
  label: string;
} {
  const normalized = status.toUpperCase();

  if (normalized === "PENDING" || normalized === "REQUESTED") {
    return { status: "PENDING", progress: 5, label: "대기 중" };
  }
  if (normalized === "EXTRACTING" || normalized === "CRAWLING") {
    return { status: "RUNNING", progress: 30, label: "페이지 크롤링 중" };
  }
  if (normalized === "ANALYZING") {
    return { status: "RUNNING", progress: 70, label: "가이드라인 기준 분석 중" };
  }
  if (normalized === "DONE" || normalized === "COMPLETED") {
    return { status: "DONE", progress: 100, label: "분석 완료" };
  }
  if (normalized === "ERROR" || normalized === "FAILED") {
    return { status: "ERROR", progress: 100, label: "오류 발생" };
  }

  return { status: "RUNNING", progress: 10, label: status };
}

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

interface ResultClientProps {
  websiteId?: string;
  mainUrl?: string;
}

export default function ResultClient({ websiteId, mainUrl }: ResultClientProps) {
  const [session, setSession] = useState<StoredSession | null>(null);
  const [statusLabel, setStatusLabel] = useState<string>("초기화 중…");
  const [loadingStatus, setLoadingStatus] = useState<boolean>(true);
  const [loadingResult, setLoadingResult] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  // 세션 초기화
  useEffect(() => {
    if (!websiteId) return;

    const existing = getSession(websiteId);
    if (existing) {
      setSession(existing);
      setStatusLabel(labelFor(existing.status));
      setLoadingStatus(false);
      return;
    }

    // MOCK 모드면 바로 완료 세션 생성해도 됨 (원하면 추가)
    const newSession: StoredSession = {
      websiteId,
      mainUrl: mainUrl ?? "",
      clientSessionId: generateClientSessionId(),
      status: "PENDING",
      progress: 0,
      createdAt: new Date().toISOString(),
    };

    upsertSession(newSession);
    setSession(newSession);
    setStatusLabel(labelFor("PENDING"));
    setLoadingStatus(false);
  }, [websiteId, mainUrl]);

  const updateSession = (patch: Partial<StoredSession>) => {
    if (!session) return;
    const updated: StoredSession = { ...session, ...patch };
    setSession(updated);
    upsertSession(updated);
  };

  // 상태 + 결과 폴링 (나중에 SSE로 대체 예정)
  useEffect(() => {
    if (MOCK_MODE) return;
    if (!session || !API_BASE) return;
    if (session.status === "DONE" || session.status === "ERROR") return;

    let cancelled = false;

    async function fetchStatusAndResult() {
      if (!session) return;
      setLoadingStatus(true);
      setError(null);

      try {
        const statusRes = await fetch(
          `${API_BASE}/api/websites/${session.websiteId}`
        );
        if (statusRes.ok) {
          const statusJson: WebsiteStatusResponse = await statusRes.json();
          const mapped = mapStatusToProgress(statusJson.status);

          if (!cancelled) {
            updateSession({
              status: mapped.status,
              progress: mapped.progress,
              mainUrl: statusJson.mainUrl || session.mainUrl,
            });
            setStatusLabel(mapped.label);
          }
        } else {
          if (!cancelled) {
            setError("웹사이트 상태를 불러오지 못했습니다.");
          }
        }

        setLoadingResult(true);
        const resultRes = await fetch(
          `${API_BASE}/api/websites/${session.websiteId}/result`
        );
        if (resultRes.ok) {
          const resultJson: AnalysisResultEnvelope = await resultRes.json();
          if (!cancelled) {
            updateSession({
              resultJson,
              status: "DONE",
              progress: 100,
            });
            setStatusLabel("분석 완료");
          }
        }
      } catch (e) {
        console.error(e);
        if (!cancelled) {
          setError("서버와 통신 중 오류가 발생했습니다.");
        }
      } finally {
        if (!cancelled) {
          setLoadingStatus(false);
          setLoadingResult(false);
        }
      }
    }

    fetchStatusAndResult();
    const intervalId = setInterval(fetchStatusAndResult, 3000);

    return () => {
      cancelled = true;
      clearInterval(intervalId);
    };
  }, [session]);

  // TODO: 나중에 SSE 연결은 여기서 EventSource 써서 updateSession 호출

  const handleDownloadPdf = async () => {
    if (!session || !session.resultJson) return;
    try {
      await generateAnalysisPdf(session.resultJson as AnalysisResultEnvelope);
    } catch (e) {
      console.error(e);
      setError("PDF 생성 중 오류가 발생했습니다.");
    }
  };

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
      <p className={styles.subtitle}>세션 ID: {session.clientSessionId}</p>

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

        {(loadingStatus || loadingResult) && (
          <p className={styles.info}>서버와 동기화 중…</p>
        )}
        {error && <p className={styles.error}>{error}</p>}
      </section>

      {session.resultJson && (
        <section className={styles.section}>
          <h2 className={styles.sectionTitle}>요약 결과</h2>
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
