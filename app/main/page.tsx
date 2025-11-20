"use client";

import { FormEvent, useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import styles from "./page.module.css";

import { generateClientSessionId } from "@/app/lib/session/generateClientSessionId";
import { upsertSession } from "@/app/lib/session/sessionStorage";
import type { StoredSession } from "@/app/lib/session/sessionTypes";

interface CrawlStartResponse {
  websiteId: string | null;
  mainUrl: string;
  message: string;
}

export default function MainPage() {
  const router = useRouter();

  const [url, setUrl] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [infoMessage, setInfoMessage] = useState<string | null>(null);

  const [clientId, setClientId] = useState<string>("");

  // 🔥 1) 클라이언트ID 생성 / 로드
  useEffect(() => {
    let storedId = window.localStorage.getItem("uxEvalClientId");
    if (!storedId) {
      storedId = generateClientSessionId();
      window.localStorage.setItem("uxEvalClientId", storedId);
    }
    setClientId(storedId);
  }, []);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);
    setInfoMessage(null);

    if (!url) {
      setError("URL을 입력해 주세요.");
      return;
    }

    if (!clientId) {
      setError("clientId를 생성하지 못했습니다.");
      return;
    }

    try {
      setLoading(true);

      const baseUrl = "/api-proxy";

      console.log("📡 [POST] start crawl");
      console.log("➡️ Request:", { clientId, mainUrl: url });

      const res = await fetch(`${baseUrl}/api/websites/crawl`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          clientId,
          mainUrl: url,
        }),
      });

      console.log("📡 Response status:", res.status);

      // ------- 백엔드 응답 원문 로깅 -------
      const rawText = await res.text();
      console.log("📡 rawText:", rawText);

      let data: CrawlStartResponse;

      // ------- JSON 안전 파싱 -------
      try {
        data = JSON.parse(rawText);
        console.log("📡 parsed JSON:", data);
      } catch (err) {
        console.error("❌ JSON parse error:", err);
        setError("백엔드가 올바른 JSON을 반환하지 않았습니다.");
        return;
      }

      // ------- 상태 검사 -------
      if (!res.ok) {
        setError(data.message || "크롤링 시작 요청 실패");
        return;
      }

      if (!data.websiteId) {
        setError(data.message || "websiteId를 받지 못했습니다.");
        return;
      }

      setInfoMessage(data.message || "크롤링이 시작되었습니다.");

      // 🔥 3) 세션 저장
      const newSession: StoredSession = {
        websiteId: data.websiteId,
        mainUrl: data.mainUrl,
        clientSessionId: clientId,
        status: "PENDING",
        progress: 0,
        createdAt: new Date().toISOString(),
        resultJson: undefined,
      };
      upsertSession(newSession);

      // 🔥 4) 결과 페이지 이동
      router.push(
        `/result?websiteId=${data.websiteId}&mainUrl=${encodeURIComponent(
          data.mainUrl
        )}`
      );

    } catch (err) {
      console.error("❌ Fetch Error:", err);
      setError("서버와 통신 중 오류가 발생했습니다.");
      return;
    } finally {
      setLoading(false);
    }
  };

  return (
    <main className={styles.container}>
      <h1 className={styles.title}>웹사이트 UX 평가 시작하기</h1>

      <p className={styles.description}>
        평가하고 싶은 웹사이트 주소(URL)를 입력하면,
        서버에서 크롤링을 시작하고 디지털 취약계층 UX 기준으로 분석합니다.
      </p>

      <form onSubmit={handleSubmit} className={styles.form}>
        <label className={styles.label}>
          웹사이트 주소
          <input
            className={styles.input}
            type="url"
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            placeholder="https://example.com"
            required
          />
        </label>

        {/* 버튼 2개 */}
        <div className={styles.buttonRow}>
          <button type="submit" className={styles.buttonPrimary} disabled={loading}>
            {loading ? "크롤링 시작 중..." : "분석 시작"}
          </button>

          <Link href="/guideline" className={styles.buttonSecondary}>
            가이드라인 보러가기
          </Link>
        </div>
      </form>

      {error && <p className={styles.error}>{error}</p>}
      {infoMessage && <p className={styles.info}>{infoMessage}</p>}

      <section className={styles.helpSection}>
        <h2 className={styles.helpTitle}>어떻게 동작하나요?</h2>
        <ol className={styles.ol}>
          <li>웹사이트 URL을 입력합니다.</li>
          <li>분석 시작 버튼을 누르면 백엔드 크롤러가 실행됩니다.</li>
          <li>결과 페이지에서 실시간 진행상황(SSE)과 PDF 보고서를 확인합니다.</li>
        </ol>
      </section>
    </main>
  );
}
