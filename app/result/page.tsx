"use client";

import { useSearchParams } from "next/navigation";
import { useEffect, useState } from "react";
import styles from "./page.module.css";

import type { StoredSession, SessionStatus } from "./sessionTypes";
import { getSession, upsertSession } from "./sessionStorage";
import { generateClientSessionId } from "./generateClientSessionId";
import type { AnalysisResultEnvelope } from "./types";
import { generateAnalysisPdf } from "./generatePdf";

const API_BASE = process.env.NEXT_PUBLIC_API_BASE_URL;

// WebsiteStatusResponse 형태 (백엔드 DTO 기준)
interface WebsiteStatusResponse {
  websiteId: string;
  mainUrl: string;
  status: string;          // 예: PENDING, EXTRACTING, ANALYZING, DONE 등
  maxDepth: number;
  maxTotalUrls: number;
  createdAt: string;
}

// status 문자열을 세션용 Status + 대략적인 progress로 매핑
function mapStatusToProgress(status: string): { status: SessionStatus; progress: number; label: string } {
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

  // 알 수 없는 상태
  return { status: "RUNNING", progress: 10, label: status };
}

export default function ResultPage() {
  const searchParams = useSearchParams();
  const websiteId = searchParams.get("websiteId");
  const mainUrlParam = searchParams.get("mainUrl") || "";

  const [session, setSession] = useState<StoredSession | null>(null);
  const [statusLabel, setStatusLabel] = useState<string>("초기화 중…");
  const [loadingStatus, setLoadingStatus] = useState<boolean>(true);
  const [loadingResult, setLoadingResult] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  // 세션 초기화: localStorage에서 불러오거나 새로 생성
  useEffect(() => {
    if (!websiteId) return;

    const existing = getSession(websiteId);
    if (existing) {
      setSession(existing);
      setStatusLabel(labelFor(existing.status));
      setLoadingStatus(false);
      return;
    }

    const newSession: StoredSession = {
      websiteId,
      mainUrl: mainUrlParam,
      clientSessionId: generateClientSessionId(),
      status: "PENDING",
      progress: 0,
      createdAt: new Date().toISOString(),
    };

    upsertSession(newSession);
    setSession(newSession);
    setStatusLabel(labelFor("PENDING"));
    setLoadingStatus(false);
  }, [websiteId, mainUrlParam]);

  // 세션 업데이트 helper
  const updateSession = (patch: Partial<StoredSession>) => {
    if (!session) return;
    const updated: StoredSession = { ...session, ...patch };
    setSession(updated);
    upsertSession(updated);
  };

  // WebsiteStatusResponse.status를 사람이 읽을 수 있는 라벨로
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

  // 현재는 폴링 방식으로 상태 + 결과 요청
  // 나중에 SSE 도입 시, 이 부분을 대체하거나 병렬로 두면 됨.
  useEffect(() => {
    if (!session || !API_BASE) return;
    if (session.status === "DONE" || session.status === "ERROR") {
      // 이미 끝난 세션이면 폴링 불필요
      return;
    }

    let cancelled = false;

    async function fetchStatusAndResult() {
      if (!session) return;
      setLoadingStatus(true);
      setError(null);

      try {
        // 1) 상태 조회
        const statusRes = await fetch(`${API_BASE}/api/websites/${session.websiteId}`);
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
          // 404 등인 경우: 백엔드에서 아직 Website가 없거나 삭제된 상황일 수 있음
          if (!cancelled) {
            setError("웹사이트 상태를 불러오지 못했습니다.");
          }
        }

        // 2) 결과 조회 (있다면)
        setLoadingResult(true);
        const resultRes = await fetch(`${API_BASE}/api/websites/${session.websiteId}/result`);
        if (resultRes.ok) {
          const resultJson: AnalysisResultEnvelope = await resultRes.json();
          if (!cancelled) {
            updateSession({
              resultJson: resultJson,
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

    // 처음 한 번 호출
    fetchStatusAndResult();

    // 이후 주기적으로 폴링 (예: 3초 간격)
    const intervalId = setInterval(fetchStatusAndResult, 3000);

    return () => {
      cancelled = true;
      clearInterval(intervalId);
    };
  }, [session]);

  // TODO: 나중에 SSE 붙일 자리
  // useEffect(() => {
  //   if (!session || !API_BASE) return;
  //   if (session.status === "DONE" || session.status === "ERROR") return;
  //
  //   const es = new EventSource(`${API_BASE}/api/websites/${session.websiteId}/events`);
  //
  //   es.onmessage = (event) => {
  //     const data = JSON.parse(event.data);
  //     // data.progress, data.stage, data.done, data.results 등 구조에 맞게 updateSession 호출
  //   };
  //
  //   es.onerror = (err) => {
  //     console.error("SSE error", err);
  //     es.close();
  //   };
  //
  //   return () => es.close();
  // }, [session]);

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

          <button
            className={styles.button}
            onClick={handleDownloadPdf}
          >
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
