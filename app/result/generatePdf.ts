import { PDFDocument, rgb } from "pdf-lib";
import type { AnalysisResultEnvelope } from "@/app/lib/types/analysis";

export async function generateAnalysisPdf(data: AnalysisResultEnvelope) {
  const pdfDoc = await PDFDocument.create();

  // -------------------------------
  // 🔤 Fontkit 등록
  // -------------------------------
  const fontkit = await import("@pdf-lib/fontkit").then((m) => m.default);
  pdfDoc.registerFontkit(fontkit);

  // 한글 Noto Sans KR 폰트 로드
  const fontBytes = await fetch("/fonts/NotoSansKR-Regular.ttf").then((res) =>
    res.arrayBuffer()
  );
  const font = await pdfDoc.embedFont(fontBytes);

  // -------------------------------
  // 🎨 강조색 정의 (#747CED)
  // -------------------------------
  const accent = rgb(116 / 255, 124 / 255, 237 / 255);

  // -------------------------------
  // PDF 기본 설정
  // -------------------------------
  let page = pdfDoc.addPage();
  let { height } = page.getSize();
  let cursorY = height - 50;
  const lineHeight = 16;

  const titleSize = 18;
  const textSize = 11;
  const sectionTitleSize = 14;

  // 기본 라인 출력 함수
  const writeLine = (text: string, size = textSize, color = rgb(0, 0, 0)) => {
    if (cursorY < 60) {
      page = pdfDoc.addPage();
      cursorY = height - 50;
    }
    page.drawText(text, {
      x: 50,
      y: cursorY,
      size,
      font,
      color,
    });
    cursorY -= lineHeight;
  };

  // 섹션 제목 출력 함수 (강조색 적용)
  const writeSectionTitle = (text: string) => {
    writeLine(text, sectionTitleSize, accent);
  };

  // -------------------------------
  // 📄 1. 문서 제목
  // -------------------------------
  writeLine("디지털 취약계층 UX 분석 리포트", titleSize, accent);
  cursorY -= 20;

  // -------------------------------
  // 📄 2. 기본 정보
  // -------------------------------
  writeSectionTitle("1. 기본 정보");
  writeLine(`웹사이트 URL: ${data.websiteUrl}`);
  writeLine(`분석된 URL 수: ${data.totalAnalyzedUrls}`);
  writeLine("");

  // -------------------------------
  // 📄 3. 종합 평가
  // -------------------------------
  writeSectionTitle("2. 종합 평가");
  writeLine(`평균 점수: ${data.averageScore}`);
  writeLine(`전체 수준: ${data.overallLevel}`);
  writeLine(`심각도 수준: ${data.severityLevel}`);
  writeLine("");

  // -------------------------------
  // 📄 4. 통계 요약
  // -------------------------------
  const s = data.statistics;
  writeSectionTitle("3. 통계 요약");
  writeLine(`평균 버튼 탐지 점수: ${s.averageButtonDetectionScore}`);
  writeLine(`평균 버튼 크기 점수: ${s.averageButtonSizeScore}`);
  writeLine(`평균 버튼 대비 점수: ${s.averageButtonContrastScore}`);
  writeLine(`평균 피드백 점수: ${s.averageButtonFeedbackScore}`);
  writeLine(`평균 글자 크기 점수: ${s.averageFontSizeScore}`);
  writeLine(`평균 전체 대비 점수: ${s.averageContrastScore}`);
  writeLine(`평균 한국어 비율 점수: ${s.averageKoreanRatioScore}`);
  writeLine("");

  // -------------------------------
  // 📄 5. URL별 분석 결과
  // -------------------------------
  writeSectionTitle("4. URL별 분석 결과");

  data.urlReports.forEach((r, idx) => {
    writeLine(`--- URL #${idx + 1}: ${r.url} ---`, sectionTitleSize, accent);

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
  // 📄 6. 개선 권장사항
  // -------------------------------
  writeSectionTitle("5. 개선 권장사항");
  data.recommendations.forEach((rec) => writeLine(`- ${rec}`));

  // -------------------------------
  // 💾 PDF 저장 및 다운로드
  // -------------------------------
  const pdfBytes: any = await pdfDoc.save();
  const uint8 = pdfBytes instanceof Uint8Array ? pdfBytes : new Uint8Array(pdfBytes);
  const arrayBuffer = uint8.buffer.slice(0);

  const blob = new Blob([arrayBuffer], { type: "application/pdf" });

  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = "ux-analysis-report.pdf";
  a.click();
  URL.revokeObjectURL(url);
}
