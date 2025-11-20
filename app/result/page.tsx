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
      <ResultClient websiteId={websiteId} mainUrl={mainUrl} />
  );
}
