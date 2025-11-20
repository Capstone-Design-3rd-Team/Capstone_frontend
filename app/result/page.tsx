import ResultClient from "./ResultClient";

export default function ResultPage({
  searchParams,
}: {
  searchParams?: { [key: string]: string | undefined };
}) {
  const websiteId = searchParams?.websiteId;
  const mainUrl = searchParams?.mainUrl || "";

  console.log("🔍 [page.tsx] searchParams =", searchParams);
  console.log("🔍 websiteId =", websiteId, "mainUrl =", mainUrl);

  return <ResultClient websiteId={websiteId} mainUrl={mainUrl} />;
}
