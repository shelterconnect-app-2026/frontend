import { useEffect } from 'react';
import ReactTestRenderer from 'react-test-renderer';
import { useDogChat } from './useDogChat';
import { fetchChatMessages, openChatSession, requestChatReply, sendChatMessage } from '../api/chat';
import { ApiError } from '../../../shared/lib/apiClient';

jest.mock('@react-navigation/native', () => ({
  useFocusEffect: (effect: () => void | (() => void)) => require('react').useEffect(effect, [effect]),
}));
jest.mock('../api/chat', () => ({
  openChatSession: jest.fn(),
  fetchChatSession: jest.fn(),
  fetchChatMessages: jest.fn(),
  sendChatMessage: jest.fn(),
  requestChatReply: jest.fn(),
}));

const userMessage = { id: 'm1', role: 'USER', text: '안녕' };

test('a failed send keeps the text and resends it with the same clientMessageId', async () => {
  (openChatSession as jest.Mock).mockResolvedValue({ data: { id: 's1', canSend: true } });
  (fetchChatMessages as jest.Mock).mockResolvedValue({ data: [] });
  (sendChatMessage as jest.Mock)
    .mockRejectedValueOnce(new ApiError('NETWORK_ERROR', '연결이 끊겼어요', ''))
    .mockResolvedValueOnce({ data: userMessage });
  (requestChatReply as jest.Mock).mockResolvedValue({ data: { reply: { id: 'r1', role: 'ASSISTANT', text: '멍' } } });

  let chat!: ReturnType<typeof useDogChat>;
  function Probe() {
    const value = useDogChat('dog-1');
    useEffect(() => { chat = value; });
    return null;
  }
  await ReactTestRenderer.act(async () => { ReactTestRenderer.create(<Probe />); });

  let sent = true;
  await ReactTestRenderer.act(async () => { sent = await chat.send('안녕'); });
  expect(sent).toBe(false);
  expect(chat.state.status === 'ready' && chat.state.failedSend?.text).toBe('안녕');

  await ReactTestRenderer.act(async () => { sent = await chat.send('안녕'); });
  expect(sent).toBe(true);
  const [first, second] = (sendChatMessage as jest.Mock).mock.calls;
  expect(second[1]).toBe(first[1]);
  expect(chat.state.status === 'ready' && chat.state.failedSend).toBeNull();
  expect(chat.state.status === 'ready' && chat.state.messages.map(m => m.id)).toEqual(['m1', 'r1']);
});
