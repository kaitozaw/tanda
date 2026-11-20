import Anthropic from "@anthropic-ai/sdk";

/**
 * Anthropic client. With OPENROUTER_API_KEY set (and no ANTHROPIC_API_KEY), requests go through
 * OpenRouter's Anthropic-compatible endpoint instead. Meant for local dev; production uses the
 * Anthropic key.
 */
export function createClient(opts: { maxRetries?: number } = {}): Anthropic {
  if (!process.env.ANTHROPIC_API_KEY && process.env.OPENROUTER_API_KEY) {
    return new Anthropic({
      ...opts,
      apiKey: null,
      authToken: process.env.OPENROUTER_API_KEY,
      baseURL: process.env.OPENROUTER_BASE_URL ?? "https://openrouter.ai/api",
    });
  }
  return new Anthropic(opts);
}

export const usingOpenRouter = () => !process.env.ANTHROPIC_API_KEY && !!process.env.OPENROUTER_API_KEY;
export const hasLlmKey = () => !!process.env.ANTHROPIC_API_KEY || !!process.env.OPENROUTER_API_KEY;
