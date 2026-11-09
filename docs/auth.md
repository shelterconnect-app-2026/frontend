# 인증 — 로그인/토큰 흐름

> Source: [HANN-Creator/shelter-connect](https://github.com/HANN-Creator/shelter-connect)
> `docs/auth-and-permissions.md` — **이전 버전(FE가 백엔드 `/auth/login`만 호출한다는 가정)은 틀렸음, 대체함.**

## 인증 방식
**FE가 Supabase Auth SDK로 직접 로그인**하고, 그 결과 `access_token`만 백엔드(Spring Boot)에 Bearer로
보낸다. 백엔드는 Supabase의 공개 JWKS로 서명을 검증할 뿐, 비밀번호나 refresh token은 절대 받지 않는다.
클라이언트: [`src/shared/lib/supabase.ts`](../src/shared/lib/supabase.ts) — **Auth 전용**, `supabase.from(...)`
으로 DB 직접 쿼리하지 않는다 (DB는 백엔드가 소유).

## 로그인 흐름
```
1. FE: supabase.auth.signInWithPassword({ email, password }) (또는 다른 Supabase 로그인 방식)
       → session.access_token 확보 (SDK가 저장·자동 갱신까지 처리)
2. FE: POST /v1/me  (Authorization: Bearer <access_token>, 본문 없음)
       → 처음이면 app_users에 등록(이름 "방문자", role "USER"), 이미 있으면 같은 사용자 반환
       → 반복 호출해도 중복 생성 안 됨 — 매 로그인마다 호출해도 안전
3. FE: GET /v1/me → { id, displayName, role }
       GET /v1/me/shelters → 보호소 담당자면 관리 가능 보호소 목록, 일반 유저면 []
```
이후 모든 API 호출은 [`apiClient.ts`](../src/shared/lib/apiClient.ts)가 `supabase.auth.getSession()`으로
현재 토큰을 매번 읽어 자동 첨부한다 (세션은 SDK가 캐싱, 만료 임박 시 자동 갱신 — 별도 저장 로직 불필요).

`data.id`(app_users.id)는 Supabase Auth의 사용자 ID와 **다른 값**이다. 이후 요청의 "로그인 증명"으로
이 ID를 보내면 안 되고, 항상 토큰만 보낸다.

## 권한 레벨 (백엔드 기준)
| 상태 | 조회 | 보호소/강아지 관리 |
|---|---|---|
| 로그인 안 함 / 토큰 없음 | 공개 조회 가능 | 불가 (401) |
| 로그인했지만 `POST /v1/me` 전 | 가능 | 403 `ACCOUNT_NOT_REGISTERED` |
| 등록된 일반 사용자 (보호소 소속 없음) | 가능 | 403 |
| `ACTIVE` 소속 `MANAGER`/`STAFF` + `APPROVED` 보호소 | 가능 | 자기 보호소만 가능 |
| 계정 비활성화 | 403 `ACCOUNT_DISABLED` | 동일 |

이번 버전 FE 범위(방문자 앱)는 보호소 관리 기능을 쓰지 않으므로 대부분 "로그인 안 함 / 등록된 일반 사용자"
경로만 해당. 강아지 대화·입양 메모 저장 등 로그인이 필요한 기능을 붙일 때 위 흐름을 그대로 쓰면 됨.

## 로그인 화면
`src/modules/auth/LoginScreen.tsx` — 이메일/비밀번호 로그인+회원가입 폼 (`supabase.auth.signInWithPassword`
/ `signUp`), 성공 직후 위 2단계(`POST /v1/me`)까지 자동으로 처리. 진입점: `ShelterListScreen`(Home)
우상단 "로그인" 링크, `ChatScreen`이 `401 UNAUTHENTICATED`/`403 ACCOUNT_NOT_REGISTERED`를 받으면
"로그인하기" 버튼 노출. 디자인은 프로토타입(`shelter-mobile.html`)의 앱 셸 톤(크림 배경 `#fff9e9`,
네이비 잉크 `#172b56`, 노랑 포인트 `#ffdc79`, 파랑 primary 버튼 `#4f85f4` + 3px 오프셋 그림자) 그대로.
`SUPABASE_ANON_KEY`가 비어 있으면(`supabase`가 `null`) 폼 대신 "설정 중" 안내만 보여줌 — 크래시 아님.

## 토큰 보관

Supabase SDK의 저장 어댑터는 `secureAuthStorage.ts`다. iOS Keychain과 Android Keystore를 사용하며, 새 토큰을 AsyncStorage에 쓰지 않는다. iOS에서는 최초 잠금 해제 후 자동 갱신이 가능하고 다른 기기로 복원되지 않는 접근 등급을 쓴다.

기존 사용자의 세션은 처음 읽을 때 암호화 저장을 완료한 뒤 AsyncStorage에서 지운다. 로그아웃은 SDK의 `supabase.auth.signOut()`으로 처리한다. 어댑터는 토큰 대신 빈 기록을 남겨, 중간에 앱이 종료되어도 이전 평문 토큰이 복구되지 않게 한다. 보안 저장소가 잠겼거나 저장에 실패하면 평문 저장으로 되돌아가지 않고 오류를 반환한다.

네이티브 의존성이 추가됐으므로 `npm ci`, iOS `pod install`, 앱 재빌드가 필요하다. Metro 새로고침만으로는 적용되지 않는다. 로그인 → 앱 재시작 → 토큰 갱신 → 로그아웃 → 재시작 순서로 두 플랫폼에서 확인한다. iOS Keychain은 앱 삭제 후에도 남을 수 있으므로 계정 변경/테스트 초기화는 로그아웃으로 한다.

## 인증 서버 설정
- `SUPABASE_URL`은 `https://auth.shelterconnect.win`으로 설정한다. SDK가 `/auth/v1` 경로를 붙인다.
- `SUPABASE_ANON_KEY`에는 인증 서버에서 사용하는 공개 키를 설정한다. 값이 없으면 로그인 화면이 폼 대신 안내 문구만 보여준다.
- 소셜 로그인 여부는 여전히 미정(백엔드 문서 "C-02에서 정할 내용") — 이메일/비밀번호만 우선 구현
