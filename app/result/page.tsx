import { Suspense } from "react";
import ResultClient from "./ResultClient";

interface ResultPageProps {
  searchParams?: {
    websiteId?: string;
    mainUrl?: string;
  };
}

export default function ResultPage({ searchParams }: ResultPageProps) {
  const websiteId =
    typeof searchParams?.websiteId === "string"
      ? searchParams.websiteId
      : undefined;

  const mainUrl =
    typeof searchParams?.mainUrl === "string"
      ? searchParams.mainUrl
      : "";

  return (
    <Suspense fallback={<main style={{ padding: 20 }}>결과 페이지를 불러오는 중입니다…</main>}>
      <ResultClient websiteId={websiteId} mainUrl={mainUrl} />
    </Suspense>
  );
}
