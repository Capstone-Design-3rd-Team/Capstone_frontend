export interface AnalysisResultEnvelope {
  websiteUrl: string;
  clientId: string;
  totalAnalyzedUrls: number;

  averageScore: number;        // 종합 점수
  overallLevel: string;        // 접근성 수준
  severityLevel: string;       // 심각도

  statistics: {
    averageButtonDetectionScore: number;
    averageButtonSizeScore: number;
    averageButtonContrastScore: number;
    averageButtonFeedbackScore: number;
    averageFontSizeScore: number;
    averageContrastScore: number;
    averageKoreanRatioScore: number;

    totalButtonsDetected: number;
    totalButtonsCrawled: number;

    excellentCount: number;
    goodCount: number;
    fairCount: number;
    poorCount: number;
  };

  urlReports: Array<{
    url: string;
    analysisDate: string;
    screenshotPath: string;
    s3Url: string;
    taskId: string;
    websiteId: string;

    verticalScroll: boolean;
    horizontalScroll: boolean;

    crawledButtonCount: number;
    detectedButtonCount: number;
    buttonCountDifference: number;

    buttonDetection: ScoreItem;
    buttonVisualFeedback: ScoreItem;
    buttonSize: ScoreItem;
    buttonContrast: ScoreItem;
    fontSize: ScoreItem;
    overallContrast: ScoreItem;
    koreanRatio: ScoreItem;

    finalScore: number;
    accessibilityLevel: string;
    severityLevel: string;

    textReport: string;
  }>;

  recommendations: string[];
}

interface ScoreItem {
  score: number;
  level: string;
  weight: number;
  recommendation: string;
}
