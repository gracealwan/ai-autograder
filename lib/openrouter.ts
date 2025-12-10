import { OpenRouter } from '@openrouter/sdk';

const openRouter = new OpenRouter({
  apiKey: process.env.OPENROUTER_API_KEY!,
  // defaultHeaders: {
  //   'HTTP-Referer': process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000", // replace as appropriate
  //   'X-Title': process.env.NEXT_PUBLIC_SITE_NAME || "AI Autograder", // replace as appropriate
  // },
});

/**
 * Call OpenRouter chat completion using the official SDK.
 * @param model - Model string (e.g. "anthropic/claude-3.5-sonnet-20240620")
 * @param messages - Array of {role, content}
 * @param stream - Boolean, defaults to false
 */
export async function callOpenRouter(model: string, messages: any[], stream: boolean = false) {
  const res = await openRouter.chat.send({
    model,
    messages,
    stream,
  });
  return res;
}