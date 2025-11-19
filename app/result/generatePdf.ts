import { PDFDocument, StandardFonts, rgb } from "pdf-lib";
import type { AnalysisResultEnvelope } from "@/app/lib/types/analysis";

export async function generateAnalysisPdf(data: AnalysisResultEnvelope) {
  const { results } = data;

  const pdfDoc = await PDFDocument.create();
  let page = pdfDoc.addPage();
  let { width, height } = page.getSize();

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

  // 제목
  writeLine("디지털 취약계층 UX 분석 리포트", titleSize);
  cursorY -= 20;

  // 기본 정보
  writeLine("📌 1. 기본 정보", sectionTitleSize);
  writeLine(`URL: ${results.analysis_info.url}`);
  writeLine(`분석일시: ${results.analysis_info.analysis_date}`);
  writeLine(`S3 URL: ${results.analysis_info.s3_url}`);
  writeLine(`Screenshot: ${results.analysis_info.screenshot_path}`);
  writeLine("");

  // 스크롤
  writeLine(`수직 스크롤: ${results.scroll_info.vertical_scroll}`);
  writeLine(`수평 스크롤: ${results.scroll_info.horizontal_scroll}`);
  writeLine("");

  // 버튼 분석
  writeLine("📌 2. 버튼 분석", sectionTitleSize);
  const ba = results.button_analysis;
  writeLine(`크롤링 버튼 개수: ${ba.crawled_button_count}`);
  writeLine(`감지된 버튼 개수: ${ba.detected_button_count}`);
  writeLine(`차이: ${ba.button_count_difference}`);
  writeLine("");

  // 상세 분석
  writeLine("📌 3. 상세 분석", sectionTitleSize);
  Object.entries(results.detailed_scores).forEach(([key, item]) => {
    writeLine(`${key}: 점수 ${item.score} / ${item.level}`);
    writeLine(`설명: ${item.description}`);
    writeLine("");
  });

  writeLine("📌 4. 종합 평가", sectionTitleSize);
  writeLine(`최종 점수: ${results.summary.final_score}`);
  writeLine(`접근성 등급: ${results.summary.accessibility_level}`);
  writeLine(`심각도 수준: ${results.summary.severity_level}`);

  // PDF 저장
  const pdfBytes = await pdfDoc.save();

  // 🔥 SharedArrayBuffer → ArrayBuffer 변환
  const buf = new ArrayBuffer(pdfBytes.length);
  const view = new Uint8Array(buf);
  view.set(pdfBytes);

  // Blob 생성
  const blob = new Blob([buf], { type: "application/pdf" });

  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = "ux-report.pdf";
  a.click();
  URL.revokeObjectURL(url);
}
