/**
 * Chat Client - Server-side proxy for AI chat interactions.
 *
 * SECURITY: OpenAI client must NEVER be used directly in the browser.
 * All AI chat requests should be proxied through the NestJS backend API
 * (e.g., POST /ai/chat) which holds the API key server-side.
 *
 * This module is intended for server-side use only (API routes / server actions).
 */

interface ChatMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

const AI_CHAT_ENDPOINT = '/ai/chat';

export async function sendChatMessage(
  messages: ChatMessage[],
  onChunk?: (text: string) => void,
): Promise<string> {
  const baseUrl =
    process.env.NEXT_PUBLIC_SERVER_BASE_URL || 'http://localhost:13100';

  if (onChunk) {
    const response = await fetch(`${baseUrl}${AI_CHAT_ENDPOINT}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ messages, stream: true }),
    });

    if (!response.ok || !response.body) {
      throw new Error(`AI chat request failed: ${response.status}`);
    }

    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let fullText = '';

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      const chunk = decoder.decode(value, { stream: true });
      const lines = chunk.split('\n').filter((l) => l.startsWith('data: '));

      for (const line of lines) {
        const data = line.slice(6);
        if (data === '[DONE]') break;
        try {
          const parsed = JSON.parse(data);
          const content = parsed.choices?.[0]?.delta?.content || '';
          if (content) {
            fullText += content;
            onChunk(content);
          }
        } catch {
          // Skip malformed chunks
        }
      }
    }
    return fullText;
  }

  const response = await fetch(`${baseUrl}${AI_CHAT_ENDPOINT}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ messages, stream: false }),
  });

  if (!response.ok) {
    throw new Error(`AI chat request failed: ${response.status}`);
  }

  const result = await response.json();
  return result.choices?.[0]?.message?.content || '';
}
