"use client";

import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import styles from "./page.module.css";

interface CrawlStartResponse {
  websiteId: string | null;
  mainUrl: string;
  message: string;
}

export default function MainPage() {
  const [url, setUrl] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [infoMessage, setInfoMessage] = useState<string | null>(null);

  const router = useRouter();

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();

    setError(null);
    setInfoMessage(null);

    if (!url) {
      setError("URL을 입력해 주세요.");
      return;
    }

    try {
      setLoading(true);

      // .env.local 에 NEXT_PUBLIC_API_BASE_URL 설정해두기:
      // NEXT_PUBLIC_API_BASE_URL=http://localhost:8080
      const baseUrl = process.env.NEXT_PUBLIC_API_BASE_URL;
      if (!baseUrl) {
        setError("백엔드 주소(NEXT_PUBLIC_API_BASE_URL)가 설정되어 있지 않습니다.");
        return;
      }

      const res = await fetch(`${baseUrl}/api/websites/crawl`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ mainUrl: url }),
      });

      if (!res.ok) {
        const text = await res.text();
        console.error("crawl 실패:", text);
        setError("크롤링 시작 요청에 실패했습니다.");
        return;
      }

      const data: CrawlStartResponse = await res.json();

      if (!data.websiteId) {
        setError(data.message || "websiteId를 받지 못했습니다.");
        return;
      }

      // 메시지는 잠깐 보여주고
      setInfoMessage(data.message || "크롤링이 시작되었습니다.");

      // result 페이지로 이동 (쿼리로 전달)
      router.push(
        `/result?websiteId=${data.websiteId}&mainUrl=${encodeURIComponent(
          data.mainUrl
        )}`
      );
    } catch (err) {
      console.error(err);
      setError("서버와 통신 중 오류가 발생했습니다.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <main className={styles.container}>
      <h1 className={styles.title}>웹사이트 UX 평가 시작하기</h1>

      <p className={styles.description}>
        평가하고 싶은 웹사이트의 주소(URL)를 입력하면,
        백엔드에서 자동으로 페이지를 크롤링하고
        디지털 취약계층을 위한 가이드라인 기준으로 분석합니다.
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
          />
        </label>

        <div className={styles.buttonRow}>
          <button
            type="submit"
            className={styles.buttonPrimary}
            disabled={loading}
          >
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
          <li>위 입력창에 평가할 웹사이트의 메인 URL을 입력합니다.</li>
          <li>“분석 시작” 버튼을 누르면 백엔드에서 크롤링이 시작됩니다.</li>
          <li>결과 페이지에서 크롤링 진행 상황과 분석 결과 PDF를 확인할 수 있습니다.</li>
        </ol>
      </section>
    </main>
  );
}
