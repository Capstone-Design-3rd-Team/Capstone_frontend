import { PDFDocument, StandardFonts, rgb } from "pdf-lib";
import type { AnalysisResultEnvelope } from "@/app/lib/types/analysis";

export async function generateAnalysisPdf(data: AnalysisResultEnvelope) {
  const pdfDoc = await PDFDocument.create();
  let page = pdfDoc.addPage();
  let { height } = page.getSize();

  const font = await pdfDoc.embedFont(StandardFonts.Helvetica);
  const titleSize = 18;
  const textSize = 11;
  const sectionTitleSize = 14;

  let cursorY = height - 50;
  const lineHeight = 16;

  const writeLine = (text: string, size = textSize) => {
    if (cursorY < 60) {
      page = pdfDoc.addPage();
      cursorY = height - 50;
    }
    page.drawText(text, { x: 50, y: cursorY, size, font, color: rgb(0, 0, 0) });
    cursorY -= lineHeight;
  };

  // ------------------------------------------------
  // 제목
  // ------------------------------------------------
  writeLine("디지털 취약계층 UX 분석 리포트", titleSize);
  cursorY -= 20;

  // ------------------------------------------------
  // 기본 정보
  // ------------------------------------------------
  writeLine("📌 1. 기본 정보", sectionTitleSize);
  writeLine(`URL: ${data.websiteUrl}`);
  writeLine(`분석된 URL 수: ${data.totalAnalyzedUrls}`);
  writeLine("");

  // ------------------------------------------------
  // 종합 평가
  // ------------------------------------------------
  writeLine("📌 2. 종합 평가", sectionTitleSize);
  writeLine(`평균 점수: ${data.averageScore}`);
  writeLine(`전체 수준: ${data.overallLevel}`);
  writeLine(`심각도 수준: ${data.severityLevel}`);
  writeLine("");

  // ------------------------------------------------
  // 통계 요약
  // ------------------------------------------------
  const s = data.statistics;
  writeLine("📌 3. 통계 요약", sectionTitleSize);
  writeLine(`평균 버튼 탐지 점수: ${s.averageButtonDetectionScore}`);
  writeLine(`평균 버튼 크기 점수: ${s.averageButtonSizeScore}`);
  writeLine(`평균 버튼 대비 점수: ${s.averageButtonContrastScore}`);
  writeLine(`평균 버튼 피드백 점수: ${s.averageButtonFeedbackScore}`);
  writeLine(`평균 글자 크기 점수: ${s.averageFontSizeScore}`);
  writeLine(`평균 전체 대비 점수: ${s.averageContrastScore}`);
  writeLine(`평균 한국어 비율 점수: ${s.averageKoreanRatioScore}`);
  writeLine("");

  // ------------------------------------------------
  // URL 상세 분석
  // ------------------------------------------------
  writeLine("📌 4. URL별 분석 결과", sectionTitleSize);

  data.urlReports.forEach((r, idx) => {
    writeLine(`--- URL #${idx + 1} ---`);
    writeLine(`버튼 탐지 점수: ${r.buttonDetection.score}`);
    writeLine(`버튼 크기 점수: ${r.buttonSize.score}`);
    writeLine(`버튼 대비 점수: ${r.buttonContrast.score}`);
    writeLine(`폰트 크기 점수: ${r.fontSize.score}`);
    writeLine(`전체 대비 점수: ${r.overallContrast.score}`);
    writeLine(`한국어 비율 점수: ${r.koreanRatio.score}`);
    writeLine(`최종 점수: ${r.finalScore}`);
    writeLine("");
  });

  // ------------------------------------------------
  // 개선 권장사항
  // ------------------------------------------------
  writeLine("📌 5. 개선 권장사항", sectionTitleSize);
  data.recommendations.forEach((rec) => {
    writeLine(`- ${rec}`);
  });

  // ------------------------------------------------
  // PDF 저장 — 오류 완전 제거
  // ------------------------------------------------
  const pdfBytes: any = await pdfDoc.save();

  // SharedArrayBuffer / ArrayBuffer / Uint8Array 모두 안전 처리
  const uint8 = pdfBytes instanceof Uint8Array ? pdfBytes : new Uint8Array(pdfBytes);

  // 항상 ArrayBuffer로 변환됨 (SharedArrayBuffer 문제 해결)
  const arrayBuffer = uint8.buffer.slice(0);

  const blob = new Blob([arrayBuffer], { type: "application/pdf" });

  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = "ux-report.pdf";
  a.click();
  URL.revokeObjectURL(url);
}
