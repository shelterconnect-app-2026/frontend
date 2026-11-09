import type { CompositeNavigationProp } from '@react-navigation/native';
import type { BottomTabNavigationProp } from '@react-navigation/bottom-tabs';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';

export type MainTabParamList = {
  홈: undefined;
  보호소: undefined;
  커뮤니티: undefined;
  '저장한 친구': undefined;
  대화: undefined;
  // 하단 탭 바에는 안 보이는 라우트 — Figma 18이 5탭 바를 그대로 보여주는 화면이라 탭 안에 둔다.
  '내 정보': undefined;
};

export type RootStackParamList = {
  Home: undefined;
  Game: { shelterId: string; shelterName: string };
  Chat: { dogId: string; dogName: string; identityIndex: number; shelterName: string; sessionId?: string };
  Login: undefined;
  SignUp: undefined;
  // Figma 17(로그인 안내)·19(로그인 만료) — 같은 시트, 문구만 다름.
  InquiryRoom: { roomId: string };
  CommunityPost: { postId: string };
  CommunityComments: { postId: string };
  CommunityLocations: { postId: string };
  // 글쓰기·수정(postId 있으면 수정/임시저장 이어쓰기), 목격 제보 작성 (F-21)
  CommunityCompose: { postId?: string; category?: 'LOST' | 'FOUND' | 'NEIGHBOR_NEWS' } | undefined;
  SightingCompose: { postId: string };
  LoginGuide: { reason?: 'expired' } | undefined;
  Profile: {
    dogId: string;
    dogName: string;
    identityIndex: number;
    shelterName: string;
    knownFacts: string[];
    pendingQuestions: string[];
  };
};

/** For screens that live inside MainTabs but still need to push a root-stack route
 * (Game/Login/...) or switch to a sibling tab — e.g. HomeScreen, ShelterTabScreen. */
export type HomeTabScreenNavigationProp = CompositeNavigationProp<
  BottomTabNavigationProp<MainTabParamList>,
  NativeStackNavigationProp<RootStackParamList>
>;
