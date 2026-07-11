/**
 * Detect a Gemini quota/rate-limit error across both call paths this project
 * uses: LangChain's wrapped chat-model errors and the raw @google/genai SDK's
 * message-only errors from direct embedding calls. Shape observed live
 * (2026-07-xx, this project's own free-tier quota): a LangChain error named
 * `RateLimitQuotaExhaustedError` with a numeric `status: 429` and
 * `rateLimitReason: "quota_message"`; the raw SDK instead only puts
 * "[429 Too Many Requests]" / "RESOURCE_EXHAUSTED" in the message text.
 */
export function isQuotaExceededError(error: unknown): boolean {
  if (!(error instanceof Error)) return false;
  if (error.name === "RateLimitQuotaExhaustedError") return true;
  if ((error as { status?: unknown }).status === 429) return true;
  return /429|RESOURCE_EXHAUSTED|quota/i.test(error.message);
}
