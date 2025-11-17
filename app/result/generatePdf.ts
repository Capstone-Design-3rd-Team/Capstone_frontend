// app/result/generatePdf.ts
import { PDFDocument, StandardFonts, rgb } from "pdf-lib";
import type { AnalysisResultEnvelope } from "./types";

export async function generateAnalysisPdf(data: AnalysisResultEnvelope) {
  const { results, task_id, website_id } = data;
  const pdfDoc = await PDFDocument.create();
  const page = pdfDoc.addPage();
  const { width, height } = page.getSize();

  const font = await pdfDoc.embedFont(StandardFonts.Helvetica);
  const titleSize = 18;
  const normalSize = 11;

  let cursorY = height - 50;

  // 제목
  page.drawText("디지털 취약계층 UX 평가 결과 리포트", {
    x: 50,
    y: cursorY,
    size: titleSize,
    font,
    color: rgb(0, 0, 0),
  });

  cursorY -= 30;

  // 기본 정보
  const summary = results.summary;
  const analysisInfo = results.analysis_info;

  const lines: string[] = [
    `Task ID: ${task_id}`,
    `Website ID: ${website_id}`,
    `URL: ${analysisInfo.url}`,
    `분석일시: ${analysisInfo.analysis_date}`,
    "",
    `최종 점수: ${summary.final_score.toFixed(1)}점`,
    `중요도 수준: ${summary.severity_level}`,
    `접근성 등급: ${summary.accessibility_level}`,
    "",
    `스크롤 정보: 세로=${results.scroll_info.vertical_scroll ? "가능" : "불가"}, 가로=${results.scroll_info.horizontal_scroll ? "가능" : "불가"}`,
    "",
    `버튼 분석:`,
    `  크롤링된 버튼 개수: ${results.button_analysis.crawled_button_count}`,
    `  감지된 버튼 개수: ${results.button_analysis.detected_button_count}`,
    `  차이: ${results.button_analysis.button_count_difference}`,
  ];

  const lineHeight = 14;

  for (const line of lines) {
    if (cursorY < 60) {
      // 페이지가 부족하면 새 페이지 추가
      cursorY = height - 50;
      const newPage = pdfDoc.addPage();
      page.drawText("", { x: 0, y: 0 }); // 기존 page를 덮어쓰지 않기 위한 더미
    }

    page.drawText(line, {
      x: 50,
      y: cursorY,
      size: normalSize,
      font,
    });

    cursorY -= lineHeight;
  }

  // 상세 점수 섹션
  cursorY -= 10;
  page.drawText("상세 점수", {
    x: 50,
    y: cursorY,
    size: 14,
    font,
  });

  cursorY -= lineHeight;

  for (const [key, detail] of Object.entries(results.detailed_scores)) {
    const title = `- ${key} (${detail.level})`;
    const desc = `  점수: ${detail.score.toFixed(1)} / 가중치: ${detail.weight}`;
    const description = `  설명: ${detail.description}`;

    for (const line of [title, desc, description]) {
      if (cursorY < 60) {
        cursorY = height - 50;
        pdfDoc.addPage(); // 새 페이지
      }

      page.drawText(line, {
        x: 50,
        y: cursorY,
        size: normalSize,
        font,
      });

      cursorY -= lineHeight;
    }

    cursorY -= 4;
  }

  // 추천 항목 (현재 recommendations가 빈 배열이지만, 형식 만들어두기)
  cursorY -= 6;
  page.drawText("개선 권장 사항", {
    x: 50,
    y: cursorY,
    size: 14,
    font,
  });

  cursorY -= lineHeight;

  if (!results.recommendations || results.recommendations.length === 0) {
    page.drawText("  자동 분석 기준 위반 항목이 없거나, 추가 개선 권고가 없습니다.", {
      x: 50,
      y: cursorY,
      size: normalSize,
      font,
    });
  } else {
    // 나중에 recommendations 구조가 정해지면 여기서 loop
    results.recommendations.forEach((rec: any) => {
      // 예: rec.title, rec.description 등
    });
  }

  const pdfBytes = await pdfDoc.save();
  const uint8 = pdfBytes as unknown as Uint8Array;
  const arrayBuffer = uint8.buffer as ArrayBuffer;
  // 브라우저에서 다운로드
  const blob = new Blob([arrayBuffer], { type: "application/pdf" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = "ux-evaluation-report.pdf";
  a.click();
  URL.revokeObjectURL(url);
}
