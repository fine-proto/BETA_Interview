# FINE Alaseo 베타 사전 인터뷰 사이트 — 작업 규칙

FINE Alaseo 베타테스트 전 진행한 1:1 사전 인터뷰(프로토타입 사용 + 인터뷰)의 요약·분석을 보여주는 정적 사이트입니다.
GitHub Pages(main 브랜치 루트)로 배포됩니다. 빌드 과정은 없습니다.

## 구조
```
index.html                 화면 뼈대 (수정할 일 거의 없음)
assets/style.css           스타일
assets/app.js              렌더링·라우팅 (#/ 전체요약, #/i/<id> 요약, #/i/<id>/transcript 원문, #/search?q= 검색), Word 내려받기 내용 구성
assets/docx.js             의존성 없는 .docx 생성기 (인터뷰별 '내려받기' 버튼에서 사용)
data/overview.js           메인 '전체 요약 분석' 내용 + FEATURES(기능 목록) + BASELINE_KEYS(기준선 항목)
data/interviews.js         인터뷰별 요약 데이터 (배열, 1명 = 객체 1개)
data/transcripts/<id>.js   비식별 처리된 원문 (tools/build_transcripts.py 로 생성)
tools/build_transcripts.py 원문 txt → 비식별 JS 변환 스크립트
```

## 인터뷰 추가 절차 (사용자가 새 인터뷰를 올리고 요약·분석을 요청할 때마다)
1. 원문 확보: docx는 `pandoc 파일.docx -t plain --wrap=none -o raw.txt`, txt는 그대로. **원본 파일은 저장소에 커밋하지 않습니다.**
   한 줄 안에 화자 표기가 붙어 있으면(예: `…문콕 홍길동 차장 21:42`) 줄을 나눠 둡니다.
2. 원문 변환(비식별): 다음 id는 기존 마지막 id + 1 (i05, i06 …).
   ```
   python3 tools/build_transcripts.py raw.txt i05 data/transcripts/i05.js \
     --map "<진행자 실명>=진행자" [--map "홍길동=홍OO" ...]
   ```
   - 실행 후 `grep` 으로 실명이 남았는지 확인합니다.
3. `data/interviews.js` 배열 끝에 요약 객체 추가. 필드는 기존 항목과 같게 채웁니다.
   - `date`(YYYY-MM-DD), `time`(HH:MM, 모르면 ""), `duration`, `type`("본 인터뷰" | "리허설"), `persona`(잠정 유형)
   - `profile`, `features`(FEATURES의 key 사용, sentiment: pos/mix/neu/neg/na), `verdict`, `insights`, `quotes`, `baseline`(BASELINE_KEYS의 key)
   - `quotes`는 `{ topic, text, find }` 형식. topic = 무엇에 대한 발언인지('기능 · 맥락'), find = 원문(data/transcripts)에 그대로 있는 고유 문구.
     요약 화면에서 커서를 올리면 find로 원문을 찾아 진행자 질문 + 해당 발화를 보여주므로, 추가 후 find가 원문에서 찾아지는지 확인합니다.
4. `data/overview.js` 의 `OVERVIEW` 갱신: `updated`, `scope`, `summary`, `findings`(근거 수치 포함), `userTypes.members`, `opportunities`, `betaChecks`.
   기능별 반응 매트릭스·통계·기준선 표는 interviews.js에서 자동 계산되므로 손댈 필요 없습니다.
5. 로컬 확인 후 커밋·푸시 (main).

## 인터뷰 요약 화면 구성 (순서 유지)
한눈에 보기(헤드라인·좋았던/쓰지 않을 기능·기능별 반응 띠) → 핵심 인사이트(insights) → 인상적인 발언 → 기능별 반응 → 종합 평가 → 프로필(앞 4개만, 더 보기) → 기준선(접힘).
'내려받기'는 같은 순서로 Word(.docx)를 만들며, '요약 + 원문'은 원문을 부록으로 붙입니다. 데이터만 추가하면 자동 반영됩니다.

## 검색
- 상단 검색은 요약·분석 데이터와 전체 원문을 함께 찾습니다. 질문 문장에서 기능명·의도(아이디어/불편/긍정/부정/발언)·키워드를 뽑아 점수화합니다(assets/app.js).
- 기능 인식은 `FEATURES[].core`(기능 이름, 녹취 오인식 표기 포함)와 `aliases`(관련어)로 합니다. 새 오인식 표기나 관련어가 나오면 여기에 추가합니다.
- 기능 명칭: '가치봄'(같이 봄 아님). 원문은 녹취 그대로 두고, 요약·분석·화면 문구에서만 '가치봄'으로 씁니다.

## 반드시 지킬 것
- **실명 표기:** 진행자(인터뷰를 진행한 팀원)는 "진행자"로, 그 외 실명은 성만 남기고 이름은 OO (예: 홍길동 부장 → 홍OO 부장). 닉네임(도라에몽 등)과 이미 성만 있는 호칭(수원 이과장)은 그대로.
- **진행 방식에 대한 코멘트(진행자 평가, 질문 순서·유도 질문 지적 등)는 사이트에 넣지 않습니다.** 요약과 분석은 테스터의 경험·반응·인사이트만.
- 사용자가 '비교는 나중에'라고 하면 개별 요약에는 다른 인터뷰이와의 비교를 넣지 않습니다. 비교·종합은 overview.js 에서만.
- 저장소는 공개(public) 상태입니다. 실명 치환표는 저장소에 두지 않습니다(이 파일에도 실명을 쓰지 않습니다). 차량번호·전화번호 같은 개인정보가 원문에 있으면 마스킹합니다.
- 요약 문체: 한국어, 간결한 서술형. 테스터 발언 인용은 원문 그대로 짧게.
