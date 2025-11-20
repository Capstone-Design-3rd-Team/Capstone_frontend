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

  // 클라이언트 ID 생성
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
      setError("clientId 생성 실패");
      return;
    }

    try {
      setLoading(true);

      const res = await fetch("/api-proxy/api/websites/crawl", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          clientId,
          mainUrl: url,
        }),
      });

      const raw = await res.text();
      let data: CrawlStartResponse;

      try {
        data = JSON.parse(raw);
      } catch {
        setError("백엔드 응답이 잘못되었습니다.");
        return;
      }

      if (!res.ok || !data.websiteId) {
        setError(data.message || "크롤링 요청 실패");
        return;
      }

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

      router.push(
        `/result?websiteId=${data.websiteId}&mainUrl=${encodeURIComponent(
          data.mainUrl
        )}`
      );
    } catch (err) {
      setError("서버와 연결할 수 없습니다.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <main className={styles.container}>
      <h1 className={styles.title}>웹사이트 UX 평가 시작하기</h1>

      <p className={styles.description}>
        분석하고 싶은 웹사이트 주소(URL)를 입력하면 서버에서 자동으로 크롤링하고,  
        디지털 취약계층 UX 가이드라인 기준으로 평가합니다.
      </p>

      <form onSubmit={handleSubmit} className={styles.form}>
        <label className={styles.label}>
          웹사이트 URL 입력
          <input
            className={styles.input}
            type="url"
            placeholder="https://example.com"
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            required
          />
        </label>

        <div className={styles.buttonRow}>
          <button
            type="submit"
            className={styles.buttonPrimary}
            disabled={loading}
          >
            {loading ? "크롤링 중..." : "분석 시작"}
          </button>

          <Link href="/guideline" className={styles.buttonSecondary}>
            가이드라인 보기
          </Link>
        </div>
      </form>

      {error && <p className={styles.error}>{error}</p>}
      {infoMessage && <p className={styles.info}>{infoMessage}</p>}

      <section className={styles.helpSection}>
        <h2 className={styles.helpTitle}>어떻게 동작하나요?</h2>
        <ul className={styles.ul}>
          <li>웹사이트 URL을 입력합니다.</li>
          <li>“분석 시작” 버튼을 누르면 서버에서 크롤링이 시작됩니다.</li>
          <li>결과 페이지에서 실시간 진행률과 최종 분석 리포트를 확인합니다.</li>
        </ul>

        <h2 className={styles.helpTitle}>분석을 지원하지 않는 사이트</h2>
        <ul className={styles.ul}>
          <li>naver / daum / kakao / google</li>
          <li>youtube / facebook / instagram / twitter</li>
          <li>x.com / tistory / blog.naver / brunch</li>
          <li>해당 사이트들은 정보량이 너무 많아 분석을 지원하지 않습니다.</li>
        </ul>
      </section>
    </main>
  );
}
