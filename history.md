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
