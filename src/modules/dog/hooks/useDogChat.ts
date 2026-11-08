import { useCallback, useRef, useState } from 'react';
import { useFocusEffect } from '@react-navigation/native';
import { fetchChatMessages, openChatSession, requestChatReply, sendChatMessage } from '../api/chat';
import { generateClientMessageId } from '../../../shared/lib/clientId';
import { ApiError } from '../../../shared/lib/apiClient';
import type { ChatMessage, ChatSession } from '../types';

export type DogChatState =
  | { status: 'loading' }
  | { status: 'error'; message: string; code: string | null }
  | {
      status: 'ready';
      session: ChatSession;
      messages: ChatMessage[];
      sending: boolean;
      sendError: string | null;
      /** The USER message whose reply failed with retryable=true, if any. */
      retryableMessageId: string | null;
    };

/** Opens (or resumes) a dog's chat session and sends messages through it (docs/chat-storage-api.md, docs/grounded-chat-api.md). */
export function useDogChat(dogId: string) {
  const [state, setState] = useState<DogChatState>({ status: 'loading' });
  const loadedDogId = useRef<string | null>(null);
  const attemptedDogId = useRef<string | null>(null);
  const retryAfterFocus = useRef(false);

  const load = useCallback(() => {
    let cancelled = false;
    attemptedDogId.current = dogId;
    loadedDogId.current = null;
    setState({ status: 'loading' });

    (async () => {
      try {
        const { data: session } = await openChatSession(dogId);
        const { data: messages } = await fetchChatMessages(session.id, { limit: 50 });
        if (!cancelled) {
          loadedDogId.current = dogId;
          setState({ status: 'ready', session, messages, sending: false, sendError: null, retryableMessageId: null });
        }
      } catch (err) {
        if (!cancelled) {
          setState({
            status: 'error',
            message: err instanceof ApiError ? err.message : String(err),
            code: err instanceof ApiError ? err.code : null,
          });
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [dogId]);

  // Load on first entry, or retry a previous failure after returning from sign-in.
  // Keep the ready session and messages when returning from profile/menu screens so
  // the chat does not flash a loader or re-fetch its history on every focus.
  useFocusEffect(useCallback(() => {
    if (loadedDogId.current === dogId) return undefined;
    if (attemptedDogId.current === dogId && !retryAfterFocus.current) return undefined;
    retryAfterFocus.current = false;
    return load();
  }, [dogId, load]));

  const retryOnNextFocus = useCallback(() => {
    retryAfterFocus.current = true;
  }, []);

  const requestReply = useCallback(async (sessionId: string, userMessage: ChatMessage, retry: boolean) => {
    try {
      const { data: result } = await requestChatReply(sessionId, userMessage.id, retry);
      setState(prev => {
        if (prev.status !== 'ready') {
          return prev;
        }
        const messages = result.reply ? [...prev.messages, result.reply] : prev.messages;
        return {
          ...prev,
          messages,
          sending: false,
          sendError: result.reply ? null : result.failureCode ?? '답변을 받지 못했어요',
          retryableMessageId: !result.reply && result.retryable ? userMessage.id : null,
        };
      });
    } catch (err) {
      const message = err instanceof ApiError ? err.message : String(err);
      setState(prev =>
        prev.status === 'ready'
          ? { ...prev, sending: false, sendError: message, retryableMessageId: userMessage.id }
          : prev,
      );
    }
  }, []);

  const send = useCallback(
    async (text: string) => {
      if (state.status !== 'ready' || state.sending || !state.session.canSend) {
        return;
      }
      const sessionId = state.session.id;
      setState(prev => (prev.status === 'ready' ? { ...prev, sending: true, sendError: null } : prev));

      try {
        const clientMessageId = generateClientMessageId();
        const { data: userMessage } = await sendChatMessage(sessionId, clientMessageId, text);
        setState(prev => (prev.status === 'ready' ? { ...prev, messages: [...prev.messages, userMessage] } : prev));
        // Blocks until the AI call finishes (or fails) server-side — no polling.
        await requestReply(sessionId, userMessage, false);
      } catch (err) {
        const message = err instanceof ApiError ? err.message : String(err);
        setState(prev => (prev.status === 'ready' ? { ...prev, sending: false, sendError: message } : prev));
      }
    },
    [state, requestReply],
  );

  const retrySend = useCallback(() => {
    if (state.status !== 'ready' || state.sending || !state.retryableMessageId) {
      return;
    }
    const userMessage = state.messages.find(m => m.id === state.retryableMessageId);
    if (!userMessage) {
      return;
    }
    setState(prev => (prev.status === 'ready' ? { ...prev, sending: true, sendError: null } : prev));
    requestReply(state.session.id, userMessage, true);
  }, [state, requestReply]);

  return { state, send, retrySend, retryOnNextFocus };
}
