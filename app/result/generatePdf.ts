// app/result/generatePdf.ts

import { PDFDocument, StandardFonts, rgb } from "pdf-lib";
import type { AnalysisResultEnvelope } from "../lib/types/analysis";

export async function generateAnalysisPdf(data: AnalysisResultEnvelope) {
  const { results } = data;

  const pdfDoc = await PDFDocument.create();
  let page = pdfDoc.addPage();
  const { width, height } = page.getSize();

  const font = await pdfDoc.embedFont(StandardFonts.Helvetica);
  const titleSize = 18;
  const textSize = 11;
  const sectionTitleSize = 14;

  const lineHeight = 16;
  let cursorY = height - 50;

  /** Util: 줄추가 + 페이지 자동전환 */
  const writeLine = (text: string, options: any = {}) => {
    if (cursorY < 60) {
      page = pdfDoc.addPage();
      cursorY = height - 50;
    }
    page.drawText(text, {
      x: 50,
      y: cursorY,
      size: options.size || textSize,
      font,
      color: rgb(0, 0, 0),
    });
    cursorY -= lineHeight;
  };

  /** 제목 */
  page.drawText("디지털 취약계층 대상 웹사이트 UX 분석 리포트", {
    x: 50,
    y: cursorY,
    size: titleSize,
    font,
  });
  cursorY -= 40;

  // --------------------------------------------------------------------
  // 1. 기본 분석 정보
  // --------------------------------------------------------------------
  writeLine("📌 1. 기본 정보", { size: sectionTitleSize });
  writeLine(`대상 URL: ${results.analysis_info.url}`);
  writeLine(`분석 일시: ${results.analysis_info.analysis_date}`);
  writeLine(`스크린샷 로컬 경로: ${results.analysis_info.screenshot_path}`);
  writeLine(`S3 업로드 URL: ${results.analysis_info.s3_url}`);
  writeLine("");

  writeLine(`수직 스크롤 여부: ${results.scroll_info.vertical_scroll ? "가능" : "불가"}`);
  writeLine(`수평 스크롤 여부: ${results.scroll_info.horizontal_scroll ? "가능" : "불가"}`);
  writeLine("");

  // --------------------------------------------------------------------
  // 2. 버튼 분석 결과
  // --------------------------------------------------------------------
  writeLine("📌 2. 버튼 분석 결과", { size: sectionTitleSize });

  const ba = results.button_analysis;

  writeLine(`크롤링된 버튼 개수: ${ba.crawled_button_count}개`);
  writeLine(`AI 탐지된 버튼 개수: ${ba.detected_button_count}개`);
  writeLine(`버튼 개수 차이: ${ba.button_count_difference}개`);
  writeLine("");

  /** 버튼 탐지 수준 설명 */
  const bd = results.detailed_scores["button_detection"];
  writeLine(`버튼 탐지 점수: ${bd.score}점 (${bd.level})`);

  if (bd.level === "High") {
    writeLine("→ 버튼 탐지 수준이 우수하여 추가 개선 사항은 필요하지 않습니다.");
  } else if (bd.level === "Medium") {
    writeLine("→ 일부 버튼이 정확히 인식되지 않을 수 있으며, OCR 학습 데이터 혹은 알고리즘 보강이 권장됩니다.");
  } else {
    writeLine("→ 버튼 탐지 정확도가 낮습니다. 모델 개선과 페이지 레이아웃 분석 재검토가 필요합니다.");
  }

  writeLine("");

  /** 버튼 시각적 피드백 */
  const bf = results.detailed_scores["button_visual_feedback"];
  writeLine(`버튼 시각적 피드백 점수: ${bf.score}점 (${bf.level})`);

  if (bf.level === "High") {
    writeLine("→ 버튼 피드백이 충분히 제공되고 있습니다.");
  } else if (bf.level === "Medium") {
    writeLine("→ 일부 버튼의 클릭 피드백이 부족하여 UI 효과 개선이 필요합니다.");
  } else {
    writeLine("→ 피드백이 거의 없어 사용자가 혼동할 수 있습니다. 전반적인 인터랙션 강화가 필요합니다.");
  }

  writeLine("");

  /** 버튼 크기 + 대비 */
  const bs = results.detailed_scores["button_size"];
  const bc = results.detailed_scores["button_contrast"];

  writeLine(`버튼 크기 점수: ${bs.score}점 (${bs.level})`);
  writeLine(`버튼 대비 점수: ${bc.score}점 (${bc.level})`);

  if (bs.level === "High") {
    writeLine("→ 버튼 크기가 적절합니다.");
  } else if (bs.level === "Medium") {
    writeLine("→ 일부 버튼 크기 조정이 필요합니다.");
  } else {
    writeLine("→ 버튼 크기가 너무 작습니다. 고령층 사용자가 클릭하기 어려울 수 있습니다.");
  }
  writeLine("");

  // --------------------------------------------------------------------
  // 3. 텍스트 / 가독성 항목
  // --------------------------------------------------------------------
  writeLine("📌 3. 텍스트 및 가독성 분석", { size: sectionTitleSize });

  const fs = results.detailed_scores["font_size"];
  const oc = results.detailed_scores["overall_contrast"];

  writeLine(`폰트 크기 점수: ${fs.score}점 (${fs.level})`);
  if (fs.level === "High") {
    writeLine("→ 글자 크기가 적절하여 가독성이 우수합니다.");
  } else if (fs.level === "Medium") {
    writeLine("→ 일부 텍스트가 작아 가독성이 떨어집니다. 폰트 크기 조정 권장.");
  } else {
    writeLine("→ 폰트 크기가 너무 작아 읽기 어려움 발생. 전체 폰트 상향 조정이 필요합니다.");
  }

  writeLine("");

  writeLine(`전체 대비 점수: ${oc.score}점 (${oc.level})`);
  writeLine("");

  // --------------------------------------------------------------------
  // 4. 한국어 비율 분석
  // --------------------------------------------------------------------
  writeLine("📌 4. 한국어 텍스트 비율", { size: sectionTitleSize });

  const kr = results.detailed_scores["korean_ratio"];

  writeLine(`한국어 텍스트 점수: ${kr.score}점 (${kr.level}), 가중치=${kr.weight}`);

  if (kr.level === "High") {
    writeLine("→ 한국어 텍스트 비율이 충분합니다.");
  } else if (kr.level === "Medium") {
    writeLine("→ 일부 외국어/기호 사용으로 이해도가 낮을 수 있어 개선 권장.");
  } else {
    writeLine("→ 한국어 텍스트 비율이 낮아 이해에 어려움이 발생합니다. 페이지 내 한국어 텍스트 확대 필요.");
  }

  writeLine("");

  // --------------------------------------------------------------------
  // 5. 종합 요약
  // --------------------------------------------------------------------
  writeLine("📌 5. 종합 평가", { size: sectionTitleSize });

  writeLine(`최종 종합 점수: ${results.summary.final_score}점`);
  writeLine(`접근성 수준: ${results.summary.accessibility_level}`);
  writeLine(`심각도 수준: ${results.summary.severity_level}`);

  writeLine("");

  writeLine("본 평가는 디지털 취약계층의 사용 편의성을 기준으로 자동 분석되었습니다.");
  writeLine("세부 점수는 페이지 레이아웃, 버튼 UI 구성, 텍스트 가독성, 한국어 비율 등 다양한 항목을 반영합니다.");

  // --------------------------------------------------------------------
  // PDF 저장 및 다운로드
  // --------------------------------------------------------------------
  const pdfBytes = await pdfDoc.save();

  const blob = new Blob([pdfBytes], { type: "application/pdf" });
  const url = URL.createObjectURL(blob);

  const a = document.createElement("a");
  a.href = url;
  a.download = "ux-evaluation-report.pdf";
  a.click();

  URL.revokeObjectURL(url);
}
