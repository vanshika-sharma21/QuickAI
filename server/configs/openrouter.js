import axios from 'axios';

export const OPENROUTER_CHAT_COMPLETIONS_URL =
  'https://openrouter.ai/api/v1/chat/completions';

export function getOpenRouterApiKey() {
  const apiKey = process.env.OPENROUTER_API_KEY;
  if (!apiKey) throw new Error('Missing OPENROUTER_API_KEY in server/.env');
  return apiKey;
}

export async function callOpenRouterImageChatCompletions({ payload }) {
  const apiKey = getOpenRouterApiKey();

  const { data } = await axios.post(OPENROUTER_CHAT_COMPLETIONS_URL, payload, {
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json'
    }
  });

  return data;
}

