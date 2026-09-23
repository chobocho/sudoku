### [2026-09-23 06:43] 의미 없이 통과하던 인게임 테스트 강화
- **기획:** 항상 참인 단언·조건식 재계산·페이지 전체 문자열 검색으로 버그가 있어도 통과하던 테스트를 실제 동작 검증으로 교체
- **TC:** pick 정확히 1 감소, import 1개 추가, 해시 차이, 실제 난이도 버튼 클릭, CSS 규칙 단위 검사, DB 왕복 개수 일치 / 이름이 내용과 다른 테스트 3개 개명
- **개발:** sudoku.html (TestRunner 테스트만 변경)
- **검증:** 119 passed, 0 failed / 변이 검사 8건 모두 검출

### [2026-09-23 05:40] 맵 풀 보충 초과 및 "보충 완료" 메시지 시점 수정
- **기획:** 겹친 보충 호출이 각자 채워 목표치를 넘고, 완료 메시지가 실제 완료와 무관하게 2.5초 뒤 표시되던 문제 수정
- **TC:** 경계 — 자동·수동 보충 중복 호출 시 목표치 유지 / 정상 — 완료 메시지는 풀이 찬 직후에만 표시, 표시 개수 일치
- **개발:** sudoku.html (난이도별 단일 보충 작업·매 단계 크기 확인·시도 상한, refillAllAsync 완료 콜백), tests/run.mjs
- **검증:** 119 passed, 0 failed (node tests/run.mjs, 20회 반복 모두 통과)
- **비고:** refillAllAsync(onDone) 선택 인자 추가 — 기존 호출과 호환

### [2026-09-23 05:40] 난이도 변경 시 "저장 안 함"이 기존 저장을 남기던 문제 수정
- **기획:** 자동 저장된 현재 게임이 "저장 안 함" 선택 후에도 슬롯에 남아 이어하기에 다시 나타나던 문제 수정
- **TC:** 정상 — 자동 저장 후 다른 난이도로 "저장 안 함" 선택 시 현재 난이도 슬롯 삭제, 새 난이도로 전환
- **개발:** sudoku.html (btn-save-no에서 현재 난이도 슬롯 삭제), tests/run.mjs
- **검증:** 117 passed, 0 failed (node tests/run.mjs)

### [2026-09-23 05:40] localStorage 차단 환경에서 초기화 중단 수정
- **기획:** ThemeManager만 localStorage 접근을 예외 처리하지 않아 저장소 차단 환경에서 스크립트가 멈추고 맵 풀 초기화가 누락되던 문제 수정
- **TC:** 경계 — localStorage 접근 자체가 예외인 환경에서 초기화 완료, 기본 테마 적용, 맵 풀 목표치 보충, 테마 전환 동작
- **개발:** sudoku.html (ThemeManager apply/init 저장소 접근 try 처리), tests/run.mjs (저장소 차단 환경 옵션)
- **검증:** 116 passed, 0 failed (node tests/run.mjs)

### [2026-09-23 04:17] 손상 데이터로 전체 저장이 삭제되던 복구 로직 수정
- **기획:** 저장 검증이 약해 손상 데이터가 렌더링 예외를 내고, 복구 코드가 세 난이도 저장을 모두 지우던 문제 수정
- **TC:** 정상 — 정상 저장은 강화 검증 통과 / 경계 — solution·board·given·notes 모양·범위 오류, given 불일치, 음수·문자열 카운트는 거부, 복구·모달 오류·전역 error 시 다른 저장 유지
- **개발:** sudoku.html (Storage._validate 강화, startGame 복구는 실패 슬롯만 삭제, 모달·전역 오류 핸들러 삭제 제거), tests/run.mjs
- **검증:** 115 passed, 0 failed (node tests/run.mjs, 20회 반복 모두 통과)

### [2026-09-23 04:17] 되돌리기 동작 보완 (메모 복원·일시정지/완료 차단·힌트 칸 고정)
- **기획:** 입력으로 지워진 주변 메모 미복원, 일시정지·완료 후 undo 허용, 힌트 칸 undo, 변화 없는 입력의 기록 누적 수정 (실수 횟수는 유지 정책)
- **TC:** 정상 — 주변 메모 복원, 힌트 뒤 다른 칸 undo / 경계 — 일시정지·완료 중 undo 무시, 힌트 칸(이전 오답 기록 포함) undo 불가, 같은 숫자·빈 칸 지우기 미기록
- **개발:** sudoku.html (placeNumber·clearRelatedNotes·undo·useHint)
- **검증:** 103 passed, 0 failed (node tests/run.mjs)
- **비고:** 검토 6번(변화 없는 입력 기록) 포함

### [2026-09-23 04:06] 유일해 퍼즐만 출제하도록 생성기·맵 풀 수정
- **기획:** 단서를 무작위로 지워 해가 여러 개인 퍼즐이 출제되고 다른 정답이 오답 처리되던 문제 수정, 고급 단서 20→24, 내장 맵 제거
- **TC:** 정상 — 난이도별 생성 퍼즐의 해가 1개이며 solution과 일치, 단서 수 일치 / 경계 — 해 다수·정답 불일치 맵은 add·DB 로드·업로드에서 거부
- **개발:** sudoku.html (countSolutions 추가, generate 유일해 유지·재시도, _isValidMap 검증, BUILTIN_MAPS 제거)
- **검증:** 95 passed, 0 failed (node tests/run.mjs, 20회 반복 모두 통과)
- **비고:** 기존 사용자 DB의 해 다수 맵은 로드 시 버려짐. 고급 퍼즐 생성 평균 약 9ms(재시도 포함)

### [2026-09-23 04:06] TDD 패널 실행 시 진행 중 게임·저장 데이터 손상 수정
- **기획:** 로고×3 테스트가 실제 GameState·맵 풀·localStorage를 덮어써 게임과 전체 저장이 사라지던 문제를 백업/복원으로 격리
- **TC:** 정상 — runAll 전후 게임 상태·타이머·맵 풀·sudoku_* 저장 키·난이도 버튼 동일 / 경계 — 복원 후 지연 저장·풀 보충이 끝나도 동일, 타이머 계속 진행
- **개발:** sudoku.html (GameState/PuzzlePool _snapshot·_restore, 테스트 중 풀 보충 중단, runAll try/finally), tests/run.mjs
- **검증:** 89 passed, 0 failed (node tests/run.mjs)

### [2026-09-23 03:58] 완료 모달 경과 시간 0초 표시 버그 수정
- **기획:** Timer.stop()이 초를 0으로 초기화한 뒤 showComplete가 시간을 읽어 항상 0분 0초로 표시되던 문제 수정
- **TC:** 정상 — 숫자 입력으로 완료 시 2분 5초 표시 / 경계 — 마지막 칸을 힌트로 완료 시 1분 1초 표시
- **개발:** sudoku.html (finishGame 추가, 경과 시간을 정지 전에 읽어 전달), tests/run.mjs (무의존성 Node 테스트 러너 신규)
- **검증:** 88 passed, 0 failed (node tests/run.mjs)
- **비고:** 브라우저가 없는 환경이라 최소 DOM 스텁으로 실행하며 실제 브라우저 렌더링은 검증하지 않음
