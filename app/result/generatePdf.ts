import { PDFDocument, rgb } from "pdf-lib";
import type { AnalysisResultEnvelope } from "@/app/lib/types/analysis";

export async function generateAnalysisPdf(data: AnalysisResultEnvelope) {
  const pdfDoc = await PDFDocument.create();

  // fontkit 로드
  const fontkit = await import("@pdf-lib/fontkit").then((m) => m.default);
  pdfDoc.registerFontkit(fontkit);

  // 웹폰트 로드
  const fontBytes = await fetch("/fonts/NotoSansKR-Regular.ttf").then((res) =>
    res.arrayBuffer()
  );
  const font = await pdfDoc.embedFont(fontBytes);

  let page = pdfDoc.addPage();
  let { height } = page.getSize();
  let cursorY = height - 50;
  const lineHeight = 16;

  const titleSize = 18;
  const textSize = 11;
  const sectionTitleSize = 14;

  const writeLine = (text: string, size = textSize) => {
    if (cursorY < 60) {
      page = pdfDoc.addPage();
      cursorY = height - 50;
    }
    page.drawText(text, {
      x: 50,
      y: cursorY,
      size,
      font,
      color: rgb(0, 0, 0),
    });
    cursorY -= lineHeight;
  };

  // -------------------------------
  // PDF 내용 작성
  // -------------------------------
  writeLine("디지털 취약계층 UX 분석 리포트", titleSize);
  cursorY -= 20;

  writeLine("📌 1. 기본 정보", sectionTitleSize);
  writeLine(`웹사이트 URL: ${data.websiteUrl}`);
  writeLine(`분석된 URL 수: ${data.totalAnalyzedUrls}`);
  writeLine("");

  writeLine("📌 2. 종합 평가", sectionTitleSize);
  writeLine(`평균 점수: ${data.averageScore}`);
  writeLine(`전체 수준: ${data.overallLevel}`);
  writeLine(`심각도 수준: ${data.severityLevel}`);
  writeLine("");

  const s = data.statistics;
  writeLine("📌 3. 통계 요약", sectionTitleSize);
  writeLine(`평균 버튼 탐지 점수: ${s.averageButtonDetectionScore}`);
  writeLine(`평균 버튼 크기 점수: ${s.averageButtonSizeScore}`);
  writeLine(`평균 버튼 대비 점수: ${s.averageButtonContrastScore}`);
  writeLine(`평균 피드백 점수: ${s.averageButtonFeedbackScore}`);
  writeLine(`평균 글자 크기 점수: ${s.averageFontSizeScore}`);
  writeLine(`평균 전체 대비 점수: ${s.averageContrastScore}`);
  writeLine(`평균 한국어 비율 점수: ${s.averageKoreanRatioScore}`);
  writeLine("");

  // -------------------------------
  // 🚀 URL 리포트 출력 (이 부분 변경됨)
  // -------------------------------
  writeLine("📌 4. URL별 분석 결과", sectionTitleSize);

  data.urlReports.forEach((r, idx) => {
    // URL 제목을 실제 URL 포함한 형태로 출력
    writeLine(`--- URL #${idx + 1}: ${r.url} ---`, sectionTitleSize);

    writeLine(`버튼 탐지 점수: ${r.buttonDetection.score}`);
    writeLine(`버튼 크기 점수: ${r.buttonSize.score}`);
    writeLine(`버튼 대비 점수: ${r.buttonContrast.score}`);
    writeLine(`폰트 크기 점수: ${r.fontSize.score}`);
    writeLine(`전체 대비 점수: ${r.overallContrast.score}`);
    writeLine(`한국어 비율 점수: ${r.koreanRatio.score}`);
    writeLine(`최종 점수: ${r.finalScore}`);
    writeLine("");
  });

  // -------------------------------
  // 개선 권장사항
  // -------------------------------
  writeLine("📌 5. 개선 권장사항", sectionTitleSize);
  data.recommendations.forEach((rec) => writeLine(`- ${rec}`));

  // -------------------------------
  // PDF 저장
  // -------------------------------
  const pdfBytes: any = await pdfDoc.save();
  const uint8 = pdfBytes instanceof Uint8Array ? pdfBytes : new Uint8Array(pdfBytes);
  const arrayBuffer = uint8.buffer.slice(0);

  const blob = new Blob([arrayBuffer], { type: "application/pdf" });

  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = "ux-report.pdf";
  a.click();
  URL.revokeObjectURL(url);
}
