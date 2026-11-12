import { useCallback, useRef, useState } from 'react';
import { useFocusEffect } from '@react-navigation/native';
import { fetchChatMessages, fetchChatSession, openChatSession, requestChatReply, sendChatMessage } from '../api/chat';
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
      /** A message the server never confirmed — resent with the same clientMessageId so it can't duplicate. */
      failedSend: { text: string; clientMessageId: string } | null;
    };

/** Opens (or resumes) a dog's chat session and sends messages through it (docs/chat-storage-api.md, docs/grounded-chat-api.md). */
export function useDogChat(dogId: string, existingSessionId?: string) {
  const [state, setState] = useState<DogChatState>({ status: 'loading' });
  const loadedChatKey = useRef<string | null>(null);
  const attemptedChatKey = useRef<string | null>(null);
  const retryAfterFocus = useRef(false);
  const chatKey = `${dogId}:${existingSessionId ?? 'new'}`;

  const load = useCallback(() => {
    let cancelled = false;
    attemptedChatKey.current = chatKey;
    loadedChatKey.current = null;
    setState({ status: 'loading' });

    (async () => {
      try {
        const { data: session } = existingSessionId
          ? await fetchChatSession(existingSessionId)
          : await openChatSession(dogId);
        const { data: messages } = await fetchChatMessages(session.id, { limit: 50 });
        if (!cancelled) {
          loadedChatKey.current = chatKey;
          setState({ status: 'ready', session, messages, sending: false, sendError: null, retryableMessageId: null, failedSend: null });
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
  }, [chatKey, dogId, existingSessionId]);

  // Load on first entry, or retry a previous failure after returning from sign-in.
  // Keep the ready session and messages when returning from profile/menu screens so
  // the chat does not flash a loader or re-fetch its history on every focus.
  useFocusEffect(useCallback(() => {
    if (loadedChatKey.current === chatKey) return undefined;
    if (attemptedChatKey.current === chatKey && !retryAfterFocus.current) return undefined;
    retryAfterFocus.current = false;
    return load();
  }, [chatKey, load]));

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

  /** Resolves true once the server has stored the message (the reply may still fail separately). */
  const send = useCallback(
    async (text: string): Promise<boolean> => {
      if (state.status !== 'ready' || state.sending || !state.session.canSend) {
        return false;
      }
      const sessionId = state.session.id;
      const clientMessageId =
        state.failedSend?.text === text ? state.failedSend.clientMessageId : generateClientMessageId();
      setState(prev => (prev.status === 'ready' ? { ...prev, sending: true, sendError: null, failedSend: null } : prev));

      let userMessage: ChatMessage;
      try {
        ({ data: userMessage } = await sendChatMessage(sessionId, clientMessageId, text));
      } catch (err) {
        const message = err instanceof ApiError ? err.message : String(err);
        setState(prev =>
          prev.status === 'ready'
            ? { ...prev, sending: false, sendError: message, failedSend: { text, clientMessageId } }
            : prev,
        );
        return false;
      }
      setState(prev =>
        prev.status === 'ready' && !prev.messages.some(m => m.id === userMessage.id)
          ? { ...prev, messages: [...prev.messages, userMessage] }
          : prev,
      );
      // Blocks until the AI call finishes (or fails) server-side — no polling.
      await requestReply(sessionId, userMessage, false);
      return true;
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
