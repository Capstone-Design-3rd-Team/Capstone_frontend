"use client";

import ResultClient from "./ResultClient";

interface ResultPageProps {
  searchParams: Promise<{
    websiteId?: string;
    mainUrl?: string;
  }>;
}

export default async function ResultPage({ searchParams }: ResultPageProps) {
  // 🔥 searchParams는 Promise이므로 await로 풀어야 한다.
  const params = await searchParams;

  console.log("🟦 [page.tsx] searchParams =", params);

  const websiteId = params.websiteId;
  const mainUrl = params.mainUrl || "";

  console.log("🟦 websiteId =", websiteId, "mainUrl =", mainUrl);

  return <ResultClient websiteId={websiteId} mainUrl={mainUrl} />;
}
