import styles from "./page.module.css";
import { Noto_Sans } from "next/font/google";

const notoSans = Noto_Sans({
  subsets: ["latin"],
  weight: ["400", "500", "700"],
});

export default function GuidelinePage() {
  return (
    <div className={`${styles.container} ${notoSans.className}`}>
      
      {/* =====================
          1. 시각적 가독성 및 UI 구성
      ====================== */}
      <h2 className={styles.title}>1. 시각적 가독성 및 UI 구성</h2>

      <div className={styles.section}>
        <table className={styles.table}>
          <tbody>
            <tr className={`${styles.row} ${styles.headRow}`}>
              <td className={`${styles.col} ${styles.head}`}>항목</td>
              <td className={`${styles.col} ${styles.head}`}>설명</td>
              <td className={`${styles.col} ${styles.head}`}>점검 방법</td>
              <td className={`${styles.col} ${styles.head}`}>점검 방식</td>
            </tr>

            <tr className={styles.row}>
              <td className={styles.col}>글씨 크기</td>
              <td className={styles.col}>최소 16px 이상 유지</td>
              <td className={styles.col}>OCR + 컴포넌트 크기 측정</td>
              <td className={styles.col}>자동</td>
            </tr>

            <tr className={styles.row}>
              <td className={styles.col}>버튼 크기</td>
              <td className={styles.col}>44x44px 이상, 경계 명확</td>
              <td className={styles.col}>OCR + 요소 위치 추출</td>
              <td className={styles.col}>자동</td>
            </tr>

            <tr className={styles.row}>
              <td className={styles.col}>명암 대비</td>
              <td className={styles.col}>4.5:1 이상, 실외는 7:1 이상</td>
              <td className={styles.col}>색상 대비 계산</td>
              <td className={styles.col}>자동</td>
            </tr>

            <tr className={styles.row}>
              <td className={styles.col}>시니어 모드 지원</td>
              <td className={styles.col}>시니어 전용 모드 존재 여부</td>
              <td className={styles.col}>DOM 요소/설정 확인</td>
              <td className={styles.col}>자동</td>
            </tr>

            <tr className={styles.row}>
              <td className={styles.col}>아이콘+텍스트 병행</td>
              <td className={styles.col}>아이콘만으로 표현 금지, 텍스트 필수</td>
              <td className={styles.col}>버튼 텍스트 포함 여부 확인</td>
              <td className={styles.col}>자동</td>
            </tr>

            <tr className={styles.row}>
              <td className={styles.col}>단순 레이아웃 구성</td>
              <td className={styles.col}>한 화면에 주요 작업 하나만 제공</td>
              <td className={styles.col}>화면 요소 수/구조 확인</td>
              <td className={styles.col}>수동</td>
            </tr>

            <tr className={styles.row}>
              <td className={styles.col}>UI 일관성 유지</td>
              <td className={styles.col}>동일 위치에 기능 제공</td>
              <td className={styles.col}>페이지 간 UI 비교</td>
              <td className={styles.col}>수동</td>
            </tr>

            <tr className={styles.row}>
              <td className={styles.col}>초기 힌트 제공</td>
              <td className={styles.col}>스크롤 가능 힌트(노출/애니메이션)</td>
              <td className={styles.col}>하단 노출 콘텐츠 감지</td>
              <td className={styles.col}>혼합</td>
            </tr>
          </tbody>
        </table>
      </div>

      {/* Checklist */}
      <div className={styles.sectionTitle}>수동/혼합 방식 체크리스트</div>
      <div className={styles.checklist}>
        <div className={styles.checkItem}><span className={styles.bullet}>•</span>화면당 핵심작업이 하나만 제시되는가?</div>
        <div className={styles.checkItem}><span className={styles.bullet}>•</span>불필요한 메뉴/아이콘/버튼이 과도하게 많지 않은가?</div>
        <div className={styles.checkItem}><span className={styles.bullet}>•</span>주요 콘텐츠 이외 4개 이하 UI 요소인가?</div>
        <div className={styles.checkItem}><span className={styles.bullet}>•</span>동일한 기능이 동일한 위치에 존재하는가?</div>
        <div className={styles.checkItem}><span className={styles.bullet}>•</span>중복 기능이 다른 표현으로 중복되어 있지 않은가?</div>
        <div className={styles.checkItem}><span className={styles.bullet}>•</span>스크롤 안내가 명확한가?</div>
      </div>

      {/* =====================
          2. 언어 및 텍스트 이해도
      ====================== */}
      <h2 className={styles.title}>2. 언어 및 텍스트 이해도</h2>

      <div className={styles.section}>
        <table className={styles.table}>
          <tbody>
            <tr className={`${styles.row} ${styles.headRow}`}>
              <td className={`${styles.col} ${styles.head}`}>항목</td>
              <td className={`${styles.col} ${styles.head}`}>설명</td>
              <td className={`${styles.col} ${styles.head}`}>점검 방법</td>
              <td className={`${styles.col} ${styles.head}`}>점검 방식</td>
            </tr>

            <tr className={styles.row}>
              <td className={styles.col}>외국어 사용 제한</td>
              <td className={styles.col}>영어 등 외국어 사용 최소화</td>
              <td className={styles.col}>영어 단어 추출</td>
              <td className={styles.col}>자동</td>
            </tr>

            <tr className={styles.row}>
              <td className={styles.col}>쉬운 문장 구성</td>
              <td className={styles.col}>명령/질문 등 문맥 구분</td>
              <td className={styles.col}>문맥 분석</td>
              <td className={styles.col}>수동/보조자동</td>
            </tr>

            <tr className={styles.row}>
              <td className={styles.col}>오해 소지 문구</td>
              <td className={styles.col}>혼동 표현 방지</td>
              <td className={styles.col}>예시 패턴 매칭</td>
              <td className={styles.col}>수동</td>
            </tr>
          </tbody>
        </table>
      </div>

      <div className={styles.sectionTitle}>언어 체크리스트</div>
      <div className={styles.checklist}>
        <div className={styles.checkItem}><span className={styles.bullet}>•</span>문장이 하나의 메시지만 전달하는가?</div>
        <div className={styles.checkItem}><span className={styles.bullet}>•</span>명령/질문이 명확히 구분되는가?</div>
        <div className={styles.checkItem}><span className={styles.bullet}>•</span>모호한 표현이 포함되어 있지 않은가?</div>
        <div className={styles.checkItem}><span className={styles.bullet}>•</span>전문 용어가 과도하지 않은가?</div>
      </div>

      {/* =====================
          3. 조작 편의성 및 물리적 접근성
      ====================== */}
      <h2 className={styles.title}>3. 조작 편의성 및 물리적 접근성</h2>

      <div className={styles.section}>
        <table className={styles.table}>
          <tbody>
            <tr className={`${styles.row} ${styles.headRow}`}>
              <td className={`${styles.col} ${styles.head}`}>항목</td>
              <td className={`${styles.col} ${styles.head}`}>설명</td>
              <td className={`${styles.col} ${styles.head}`}>점검 방법</td>
              <td className={`${styles.col} ${styles.head}`}>점검 방식</td>
            </tr>

            <tr className={styles.row}>
              <td className={styles.col}>정밀 조작 피하기</td>
              <td className={styles.col}>스와이프/드래그 대신 클릭 제공</td>
              <td className={styles.col}>이벤트 분석</td>
              <td className={styles.col}>수동</td>
            </tr>

            <tr className={styles.row}>
              <td className={styles.col}>피드백 제공</td>
              <td className={styles.col}>클릭 후 반응 제공</td>
              <td className={styles.col}>DOM 변화 감지</td>
              <td className={styles.col}>혼합</td>
            </tr>

            <tr className={styles.row}>
              <td className={styles.col}>오류 복구 가능</td>
              <td className={styles.col}>취소/되돌리기 기능</td>
              <td className={styles.col}>버튼 여부</td>
              <td className={styles.col}>수동</td>
            </tr>

            <tr className={styles.row}>
              <td className={styles.col}>시간 제한 연장</td>
              <td className={styles.col}>세션 만료 전 경고</td>
              <td className={styles.col}>타이머 분석</td>
              <td className={styles.col}>혼합</td>
            </tr>
          </tbody>
        </table>
      </div>

      <div className={styles.sectionTitle}>조작 편의성 체크리스트</div>
      <div className={styles.checklist}>
        <div className={styles.checkItem}><span className={styles.bullet}>•</span>드래그/스와이프 없이 조작 가능한가?</div>
        <div className={styles.checkItem}><span className={styles.bullet}>•</span>사용자 실수 복구 기능이 존재하는가?</div>
        <div className={styles.checkItem}><span className={styles.bullet}>•</span>세션 만료 전에 알림이 제공되는가?</div>
        <div className={styles.checkItem}><span className={styles.bullet}>•</span>세션 연장 기능이 있는가?</div>
      </div>

      {/* =====================
          4. 인지적 접근성
      ====================== */}
      <h2 className={styles.title}>4. 인지적 접근성</h2>

      <div className={styles.section}>
        <table className={styles.table}>
          <tbody>
            <tr className={`${styles.row} ${styles.headRow}`}>
              <td className={`${styles.col} ${styles.head}`}>항목</td>
              <td className={`${styles.col} ${styles.head}`}>설명</td>
              <td className={`${styles.col} ${styles.head}`}>점검 방법</td>
              <td className={`${styles.col} ${styles.head}`}>점검 방식</td>
            </tr>

            <tr className={styles.row}>
              <td className={styles.col}>스크롤 안내 요소</td>
              <td className={styles.col}>스크롤 힌트 제공</td>
              <td className={styles.col}>콘텐츠 클립 감지</td>
              <td className={styles.col}>혼합</td>
            </tr>

            <tr className={styles.row}>
              <td className={styles.col}>단계별 안내 제공</td>
              <td className={styles.col}>절차적 흐름 제공</td>
              <td className={styles.col}>진행 표시 여부</td>
              <td className={styles.col}>자동</td>
            </tr>
          </tbody>
        </table>
      </div>

      {/* =====================
          5. 보조 기능 및 접근성 기능
      ====================== */}
      <h2 className={styles.title}>5. 보조 기능 및 접근성 기능</h2>

      <div className={styles.section}>
        <table className={styles.table}>
          <tbody>
            <tr className={`${styles.row} ${styles.headRow}`}>
              <td className={`${styles.col} ${styles.head}`}>항목</td>
              <td className={`${styles.col} ${styles.head}`}>설명</td>
              <td className={`${styles.col} ${styles.head}`}>점검 방법</td>
              <td className={`${styles.col} ${styles.head}`}>점검 방식</td>
            </tr>

            <tr className={styles.row}>
              <td className={styles.col}>모드 선택 기능</td>
              <td className={styles.col}>시니어/일반 모드 여부</td>
              <td className={styles.col}>초기 화면 UI 분석</td>
              <td className={styles.col}>자동</td>
            </tr>

            <tr className={styles.row}>
              <td className={styles.col}>스크린 리더 대응</td>
              <td className={styles.col}>aria/role/tabindex 지원</td>
              <td className={styles.col}>HTML 속성 분석</td>
              <td className={styles.col}>자동</td>
            </tr>

          </tbody>
        </table>
      </div>
    </div>
  );
}
