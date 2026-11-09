import { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Svg, { Defs, LinearGradient, Rect, Stop } from 'react-native-svg';
import { MessageSquare, MessagesSquare, PawPrint } from 'lucide-react-native';
import { fonts } from '../../shared/lib/fonts';
import { useInquiryRooms } from '../inquiry/hooks/useInquiryRooms';
import { DogConversationsList } from './DogConversationsList';
import { InquiryRoomsList } from './InquiryRoomsList';

type Segment = 'dog' | 'inquiry';

// Figma "04 대화" (pencil xdNoF / pM6TD): title, 강아지 대화 | 이웃 문의 segment, then the list.
export function ConversationsScreen() {
  const insets = useSafeAreaInsets();
  const [segment, setSegment] = useState<Segment>('dog');
  const [inquirySearch, setInquirySearch] = useState('');
  const [inquiryFilter, setInquiryFilter] = useState<'all' | 'unread'>('all');
  const { state: inquiryState, reload: reloadInquiryRooms } = useInquiryRooms({
    q: inquirySearch,
    unreadOnly: inquiryFilter === 'unread',
  });
  const unreadRooms = inquiryState.status === 'ready' ? inquiryState.unreadRoomCount : 0;

  return (
    <View style={styles.root}>
      <Svg style={StyleSheet.absoluteFill}>
        <Defs>
          <LinearGradient id="chatBg" x1="0" y1="0" x2="0" y2="1">
            <Stop offset="0" stopColor="#def1f6" />
            <Stop offset="0.4" stopColor="#fcf9f0" />
            <Stop offset="1" stopColor="#fcf9f0" />
          </LinearGradient>
        </Defs>
        <Rect width="100%" height="100%" fill="url(#chatBg)" />
      </Svg>

      <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={[styles.content, { paddingTop: insets.top + 12 }]}>
        <View style={styles.titleRow}>
          <Text style={styles.title}>대화</Text>
          <MessagesSquare size={25} color="#b3a4c2" strokeWidth={1.6} />
        </View>
        <Text style={styles.subtitle}>친구와 이웃의 이야기를 이어가요.</Text>

        <View style={styles.segment}>
          <SegmentButton
            active={segment === 'dog'}
            onPress={() => setSegment('dog')}
            label="강아지 대화"
            icon={<PawPrint size={17} color={segment === 'dog' ? '#89709d' : '#b2a7b9'} strokeWidth={1.8} />}
          />
          <SegmentButton
            active={segment === 'inquiry'}
            onPress={() => setSegment('inquiry')}
            label="이웃 문의"
            badge={unreadRooms}
            icon={<MessageSquare size={16} color={segment === 'inquiry' ? '#89709d' : '#b2a7b9'} strokeWidth={1.8} />}
          />
        </View>

        <View style={styles.body}>
          {segment === 'dog' ? (
            <DogConversationsList />
          ) : (
            <InquiryRoomsList
              state={inquiryState}
              reload={reloadInquiryRooms}
              search={inquirySearch}
              onSearchChange={setInquirySearch}
              filter={inquiryFilter}
              onFilterChange={setInquiryFilter}
            />
          )}
        </View>
      </ScrollView>
    </View>
  );
}

function SegmentButton({ active, onPress, label, icon, badge }: { active: boolean; onPress: () => void; label: string; icon: React.ReactNode; badge?: number }) {
  return (
    <Pressable style={[styles.segmentButton, active && styles.segmentButtonActive]} onPress={onPress}>
      {icon}
      <Text style={[styles.segmentText, active && styles.segmentTextActive]}>{label}</Text>
      {!!badge && badge > 0 && (
        <View style={styles.segmentBadge}>
          <Text style={styles.segmentBadgeText}>{badge}</Text>
        </View>
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  content: { paddingHorizontal: 24, paddingBottom: 32 },
  titleRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 1 },
  title: { fontFamily: fonts.pixel, fontSize: 29, lineHeight: 41, color: '#576d7e' },
  subtitle: { fontFamily: fonts.body, fontSize: 13, lineHeight: 18, color: '#82959e', marginTop: 9, marginLeft: 1 },
  segment: { flexDirection: 'row', height: 46, marginTop: 28, padding: 4, backgroundColor: '#f7f7f5', borderWidth: 1, borderColor: '#ddd9e1', borderRadius: 14 },
  segmentButton: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 12, borderRadius: 11, borderWidth: 1, borderColor: 'transparent' },
  segmentButtonActive: { backgroundColor: '#e8def1', borderColor: '#c4afd4', shadowColor: '#4a4659', shadowOpacity: 0.05, shadowRadius: 2, shadowOffset: { width: 0, height: 1 } },
  segmentText: { fontFamily: fonts.pixel, fontSize: 13, lineHeight: 18, color: '#a395ae' },
  segmentTextActive: { color: '#89709d' },
  segmentBadge: { minWidth: 20, height: 20, paddingHorizontal: 5, borderRadius: 10, backgroundColor: '#b396c9', alignItems: 'center', justifyContent: 'center' },
  segmentBadgeText: { fontFamily: fonts.pixel, fontSize: 9, lineHeight: 13, color: '#ffffff' },
  body: { marginTop: 4 },
});
