export interface AnalysisResultEnvelope {
  task_id: string;
  website_id: string;
  results: {
    issues: any[]; // 나중에 타입 정교하게 바꿀 수 있음
    summary: {
      color: string;
      final_score: number;
      severity_level: string;
      accessibility_level: string;
    };
    scroll_info: {
      vertical_scroll: boolean;
      horizontal_scroll: boolean;
    };
    analysis_info: {
      url: string;
      s3_url: string;
      analysis_date: string; // ISO 문자열
      screenshot_path: string;
    };
    button_analysis: {
      crawled_button_count: number;
      detected_button_count: number;
      button_count_difference: number;
    };
    detailed_scores: {
      [key: string]: {
        color: string;
        level: string;
        score: number;
        weight: string;
        description: string;
      };
    };
    recommendations: any[];
  };
}
