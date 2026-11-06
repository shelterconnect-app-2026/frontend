# 작업 로그

백엔드 레포([HANN-Creator/shelter-connect](https://github.com/HANN-Creator/shelter-connect))가 PR·커밋에
`[B-14]`, `[Q-02]`처럼 작업 ID를 붙이는 방식을 이 레포에도 적용한 것. `F-XX`(Frontend) 접두사, 순서대로
번호를 매긴다. 새 작업을 시작할 때 이 표에 다음 번호로 한 줄 추가하고 커밋·PR 제목에 그 ID를 붙인다
([CLAUDE.md](../CLAUDE.md) 참고).

| ID | 내용 | PR | 상태 |
|---|---|---|---|
| F-01 | 초기 프로젝트 세팅 (RN + iOS 빌드, CLAUDE.md/docs 뼈대) | - | ✅ |
| F-02 | 실제 배포 백엔드 연동 (강아지·행동 fetch) + 보호소 선택 화면 | [#1](https://github.com/kingluminance/shelter-connect-fe/pull/1) | ✅ |
| F-03 | 강아지 스프라이트(placeholder 원 → 도트) + 깊이 정렬 버그 수정 + 행동별 애니메이션 | [#2](https://github.com/kingluminance/shelter-connect-fe/pull/2) | ✅ |
| F-04 | 공놀이(ballPlay) 미니게임 | [#7](https://github.com/kingluminance/shelter-connect-fe/pull/7) | ✅ |
| F-05 | 강아지 채팅 — "PUPPY CONNECT" 게임기 UI, 실제 백엔드 대화 API 연동 | [#3](https://github.com/kingluminance/shelter-connect-fe/pull/3) | ✅ |
| F-06 | 로그인 화면 (이메일/비밀번호, Supabase Auth SDK 직접 호출) | [#4](https://github.com/kingluminance/shelter-connect-fe/pull/4) | ✅ |
| F-07 | 강아지 소개서 화면 (사진 언락, 클립보드 디자인) | [#5](https://github.com/kingluminance/shelter-connect-fe/pull/5) | ✅ |
| F-09 | 코드 리뷰 발견 버그 수정 (BACK_OFF 타겟/쿨다운, 채팅 로그인 복귀) | [#6](https://github.com/kingluminance/shelter-connect-fe/pull/6) | ✅ |
| F-10 | 강아지 행동 에셋 8종 v1 원본 자료 추가 (아직 미연동) | [#9](https://github.com/kingluminance/shelter-connect-fe/pull/9) | ✅ |
| F-11 | 채팅 화면을 프로토타입 HTML(pet-chat-section.html)과 픽셀 단위로 맞춤 (lucide 아이콘, real-v1 정원 배경 에셋, 반응형 compact 브레이크포인트) | [#10](https://github.com/kingluminance/shelter-connect-fe/pull/10) | ✅ |
| F-12 | 매니페스트 기반 강아지 행동 재생 엔진 (`/v1/dogs/{dogId}/assets` 대응, SIT/LIE_DOWN 역재생, DogSprite 컴포넌트) — Phase 1, 로컬 real-v1 번들로 실기 검증 완료. 네트워크 연동(Phase 2)·공놀이 리워크(Phase 3)는 후속 | [#11](https://github.com/kingluminance/shelter-connect-fe/pull/11) | ✅ |
| F-13 | 플레이테스트 피드백 반영 (강아지 충돌 박스, 말 걸기 버튼 크기, 채팅 화면 safe-area, 게임 카메라/캐릭터 크기, 강아지 상태 라벨) + 맵 이동용 방향별(앞/뒤/좌/우) 스프라이트 지원 (`real-map-v1` 에셋, `mapDirections`, `movementFacing`/`selectDirectionalClip`) | [#14](https://github.com/kingluminance/shelter-connect-fe/pull/14) | ✅ |
| F-13 | 로그인 토큰을 Keychain/Keystore에 저장하고 기존 평문 세션 이전 (노션 작업 보드 F-13, 위 플레이테스트 F-13과 별개) | [#12](https://github.com/kingluminance/shelter-connect-fe/pull/12) | 🔎 리뷰 대기 |
| F-14 | Android 배포 서명을 개발용 공개 키와 분리하고 잘못된 배포 차단 | [#13](https://github.com/kingluminance/shelter-connect-fe/pull/13) | 🔎 리뷰 대기 |
| F-15 | Figma 리디자인 — 5탭 바텀 네비게이션 셸 + 홈 화면(보호소 입장 카드/마음에 담은 친구/동네 커뮤니티 미리보기), 실제 API 연동(`/v1/me/preferences`, `/v1/me/saved-dogs`, `/community/posts`) | [#15](https://github.com/kingluminance/shelter-connect-fe/pull/15) | ✅ |
| F-16 | 홈/보호소 탭 로그인 진입 수정 (보호소 탭 로그인 링크 상태바 가림, 홈 프로필 버튼 로그인/로그아웃) | - | 🔎 리뷰 대기 |
| F-17 | 보호소 탭(주변 보호소·기준 위치·검색·선택/변경) + 저장한 친구 탭(검색·필터·저장 해제) Figma 적용, 채팅 화면 저장 하트, `@react-native-community/geolocation` 추가 (`/v1/shelter-discovery`, `/v1/me/saved-dogs`, `/v1/me/preferences`) | - | 🔎 리뷰 대기 |
| F-18 | 인증 + 내 정보·설정 Figma 적용 (로그인·회원가입(닉네임·약관 동의)·로그인 안내·내 정보/설정·로그인 만료·연결 오류, `/v1/registration-policy`·`/v1/me/profile`·`/v1/me/consents`) | - | 🔎 리뷰 대기 |
| F-19 | 대화 탭(강아지 대화 + 이웃 문의) + 이웃 문의방 Figma 적용 (`/v1/me/dog-conversations`, `/v1/inquiry-rooms`), F-18 후속(로그인 만료·연결 오류 디자인 맞춤) | - | 🔎 리뷰 대기 |
| F-20 | 커뮤니티 읽기 Figma 적용 (목록·검색·필터·내 동네, 상세, 댓글·제보, 위치 보기[주소 복사·지도 앱으로 보기]) — `/v1/community/posts`·`/comments`·`/media`·`/me/community-region` | - | 🔎 리뷰 대기 |
| F-21 | 커뮤니티 쓰기 Figma 적용 (글쓰기 3종·임시저장·사진, 목격 제보·댓글·답글, 글 상태 변경·신고·수정·삭제, 작성자에게 문의 + 문의방 사진·위치 보내기, 위치/사진 권한 안내) | - | 🔎 리뷰 대기 |
| F-22 | 커뮤니티 쓰기 화면 pencil 디자인 맞춤(08 글쓰기·10 목격 제보·13 상태 변경·14 신고·21/22 권한 시트) + `App.test.tsx` 복구(jest 네이티브 모듈·reanimated 목킹). 푸시 알림은 백엔드 계약상 범위 밖(`docs/inquiry-api.md`: 푸시·WebSocket 제외)이라 보류 | - | 🔎 리뷰 대기 |
| F-23 | 정렬 버튼 동작 연결 — 우리 동네 소식(최신순/제보·댓글 많은 순), 보호소(기본/가까운/이름 순), 대화 탭 두 목록(최근 대화순/안 읽은 순·이름순). 서버에 정렬 파라미터가 없어 불러온 목록 기준 클라이언트 정렬 | - | 🔎 리뷰 대기 |
| F-24 | 네이버 지도 적용 — `@mj-studio/react-native-naver-map`(NMapsMap 3.23.2), 12 목격 위치를 피그마대로 지도+마커(마지막 목격·제보)+범례+확대/축소+선택 카드로, 글쓰기·제보 장소를 지도에서 선택(핀 고정 방식), 저장한 친구 정렬 메뉴(F-23 후속). 키는 네이버 클라우드 Maps Client ID(`Info.plist` `NMFNcpKeyId`, `AndroidManifest` `NCP_KEY_ID`, 번들 ID·패키지명에 묶인 공개 값), 새 네이티브 모듈이라 pod install + 재빌드 필요 | - | 🔎 리뷰 대기 |
| F-25 | 강아지 대화 화면을 새 "PUPPY CONNECT" 게임기 디자인(puppy-profile.html)으로 교체 — 케이스 이미지 위 D-pad/A/B/SELECT/START 버튼, LCD(정원·주제 선택), 레트로 대화창. 대화 로직(`useDogChat`)은 그대로. 프로필(종이 보드)은 후속 | - | 🔎 리뷰 대기 |
| F-26 | 강아지 행동을 백엔드 값 그대로 반영 — `interactions.PERSON_GREETING`(다가가 인사: 걷기→꼬리→냄새→대기) 구현, `BALL_CHASE`를 공놀이에 반영, 임시 로컬 가중치 하한(`withLocalTestWeights`) 제거. 배포 강아지 4마리가 모두 DEFAULT라 강아지별 차이는 보호소의 행동 확정이 있어야 보임 | - | 🔎 리뷰 대기 |
| F-27 | 공 물어오기(공놀이) 눈에 보이게 — 이미 구현돼 있었지만 서버 강아지가 전부 DEFAULT라 버튼이 안 떴음. 데모 플래그로 DEFAULT 강아지도 공놀이를 켜고, 쫓을 땐 달리기·가져올 땐 걷기 자세, 물어온 공은 입 높이로 표시 | - | 🔎 리뷰 대기 |
| F-28 | 공놀이를 프로토타입 흐름으로 — 강아지가 공을 가져와 건네고(OFFER) → 공 받기(pull) → 손에 들고 → 공 던지기(push, 포물선) → 쫓아가 줍고(고개 숙임) → 입에 물고 돌아와 다시 건넴. 도트 공+그림자, 버튼 라벨 상태별. F-26/F-27 위에 쌓음 | - | 🔎 리뷰 대기 |
| F-29 | 강아지 프로필(소개서)을 "친구의 프로필" 클립보드 디자인으로 교체 — 폴라로이드 초상·점선 사실표·성향 태그(traitLabels)·메모, 하트 저장. 성향 막대는 API 없어 숨김 | - | 🔎 리뷰 대기 |
| F-30 | 게임 튜너 — 브라우저에서 드래그로 스프라이트 크기·충돌 구역(obstacles)·공놀이 거리를 맞추고 코드/layout.json에 붙일 값으로 뽑는 단독 HTML(`tools/game-tuner`, `npm run tuner`). 걸어서 충돌 테스트 포함 | - | ✅ 완료 |
| F-31 | 튜너로 맞춘 값 적용 — 강아지 충돌 높이 비율 0.85→0.22, 플레이어 그림 오프셋 `PLAYER_SPRITE_OFFSET {0.5,-19}`(충돌 원이 발 쪽으로), 맵 장애물 2개 위치 보정(layout.json). 공 잡는 손 위치는 그림 기준으로. 튜너에 스프라이트 위치·크기 손잡이 추가(`DOG_SPRITE_OFFSET`, 값은 {0,0}=변화 없음) | - | ✅ 완료 |
| F-32 | 튜너에서 소품(표지판·나무·집 등) 이동·크기 조절·추가·삭제 — 안쪽 충돌 구역 동반 이동/확대, depth 자동 재계산, layout.json(objects+obstacles) 내려받기 | - | ✅ 완료 |
| F-33 | 튜너로 맞춘 2차 값 적용 — 강아지 44→27·플레이어 64→54 크기, 플레이어 충돌 반지름 11.5·그림 오프셋 {1,-17}, 맵 장애물 3개 이동/추가. 공을 문 위치·손 위치를 그려지는 크기에 비례하도록(`BASE_DOG_SIZE`, `HAND_OFFSET` 스케일) 보정, 소품 3개(나무 1·표지판 2) 위치·크기 반영 | - | ✅ 완료 |
| F-34 | 강아지별 실제 도트 그림 연동 — `GET /v1/dogs/{id}/assets` 매니페스트로 게임 맵 강아지 렌더(4방향×행동 시트 전부 로드), 404인 강아지(데모 4마리)는 번들 real-v1 그림으로 대체. 서명 URL ~60초 만료라 목록 로드 때 행동값과 함께 받아 바로 로드 | - | 🔎 리뷰 대기 |
| F-35 | 둘만의 정원 진입 연출 — 기존 플레이어 걷기 스프라이트 크기를 키우고 강아지는 줄임. 게임에서 미리 읽은 선택 강아지의 IDLE/걷기 시트를 캐시해 로딩 화면부터 표시하고, 도착 후 대화 UI 노출 | - | 🔎 리뷰 대기 |

> ⚠️ 이 표의 `F-XX`는 이 레포(프론트) 안에서만 순서대로 매긴 번호다. 노션의 작업 보드가 별도로 쓰는
> `F-XX` 번호(예: 노션 F-06 = 사진/프로필, F-07 = 로그인)와 **우연히 겹치지만 다른 체계**다 — 팀 리뷰
> (2026.09.25)에서 확인. 기존 항목은 히스토리를 다시 쓰지 않고 그대로 두고, 제목·PR 링크로 구분한다.
> 앞으로 새 작업은 노션 쪽과 번호를 맞추는 방향으로 조율 필요 (F-08은 노션 쪽 입양 준비 화면 번호와
> 충돌 가능성이 있어 건너뜀).
