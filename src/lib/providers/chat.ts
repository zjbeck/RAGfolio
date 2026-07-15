import { ChatGoogleGenerativeAI } from "@langchain/google-genai";
import { ChatGroq } from "@langchain/groq";
import type { BaseChatModel } from "@langchain/core/language_models/chat_models";

export type LlmProvider = "gemini" | "groq";

function resolveProvider(): LlmProvider {
  const value = process.env.LLM_PROVIDER;
  if (value === undefined) {
    throw new Error(
      `LLM_PROVIDER is not set. Set it to "gemini" or "groq" — see .env.example.`
    );
  }
  if (value !== "gemini" && value !== "groq") {
    throw new Error(
      `LLM_PROVIDER="${value}" is not a supported provider. Allowed values: "gemini", "groq".`
    );
  }
  return value;
}

// Resolved once at module load — fails fast at boot (same pattern as the
// partial-Upstash-config throw in ratelimit.ts) rather than surfacing on the
// first chat call deep inside a request.
export const LLM_PROVIDER: LlmProvider = resolveProvider();

const GEMINI_CHAT_MODEL = "gemini-3.5-flash";

// Verified against live Groq + LangChain docs 2026-07-14: a current
// production, tool-calling-capable Groq model, and the model LangChain's own
// integration docs use as their canonical ChatGroq example. (A web search
// summary claimed llama-3.3-70b-versatile is deprecated; Groq's own docs page
// still lists it under "Production Models" with no deprecation notice, so
// that specific claim is unconfirmed — gpt-oss-120b sidesteps the ambiguity
// rather than resolving it.)
const GROQ_CHAT_MODEL = "openai/gpt-oss-120b";

function requireEnv(name: string, why: string): string {
  const value = process.env[name];
  if (!value) throw new Error(`${name} is not set. ${why}`);
  return value;
}

function geminiChatModel(thinkingBudget: number): BaseChatModel {
  return new ChatGoogleGenerativeAI({
    model: GEMINI_CHAT_MODEL,
    apiKey: requireEnv(
      "GEMINI_CHAT_API_KEY",
      "Required when LLM_PROVIDER=gemini — see .env.example."
    ),
    temperature: 0,
    thinkingConfig: { thinkingBudget },
    // Without this, streamed chunks carry no usage_metadata and the
    // thinking-off assertion would have nothing to check for Answer.
    streamUsage: true,
    // Default is 6: on a sustained 429, LangChain's AsyncCaller treats a
    // short retry-delay as "just wait" and silently backs off across all
    // 3 chat calls in the graph, hanging well past the function timeout.
    // 1 allows a single quick retry for a genuine transient blip only.
    maxRetries: 1,
  });
}

function groqChatModel(): BaseChatModel {
  return new ChatGroq({
    model: GROQ_CHAT_MODEL,
    apiKey: requireEnv(
      "GROQ_API_KEY",
      "Required when LLM_PROVIDER=groq — see .env.example."
    ),
    temperature: 0,
    maxRetries: 1,
  });
}

/**
 * Returns a chat model for whichever provider LLM_PROVIDER selects.
 * ChatGoogleGenerativeAI and ChatGroq both extend LangChain's BaseChatModel,
 * so every graph node already depends only on that shape (withStructuredOutput,
 * stream, invoke) — nothing downstream needs to know which SDK is live.
 *
 * thinkingBudget is a Gemini-specific dial (see corpus.config.ts
 * answerThinkingBudget); Groq has no equivalent concept and ignores it.
 */
export function chatModel(thinkingBudget: number): BaseChatModel {
  return LLM_PROVIDER === "groq" ? groqChatModel() : geminiChatModel(thinkingBudget);
}
