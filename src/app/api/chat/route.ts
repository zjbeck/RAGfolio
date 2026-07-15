import type { AIMessageChunk } from "@langchain/core/messages";
import {
  createUIMessageStream,
  createUIMessageStreamResponse,
} from "ai";
import { copy } from "@/copy";
import { buildGraph } from "@/lib/graph/graph";
import type { PipelineStateType } from "@/lib/graph/state";
import { isQuotaExceededError } from "@/lib/errors";
import { checkRateLimit, requestIp } from "@/lib/ratelimit";
import type {
  RagEvent,
  RagfolioUIMessage,
  RetrievedChunkMeta,
} from "@/lib/stream-types";

/**
 * Streaming responses need more than Vercel's default function window. 60s
 * was too thin a margin: local testing showed the six-node pipeline running
 * ~50–57s already, so a live deployment (added network latency, cold start,
 * potential rate-limit backoff) tipped it into FUNCTION_INVOCATION_TIMEOUT
 * (confirmed against a real deployment, 2026-07-14). 180s keeps real margin
 * while staying well under the Hobby-plan ceiling (300s).
 */
export const maxDuration = 180;

/** The last user message's text is the question; parts is the v7 shape. */
function questionFrom(messages: RagfolioUIMessage[]): string {
  const lastUser = [...messages].reverse().find((m) => m.role === "user");
  if (!lastUser) return "";
  return lastUser.parts
    .filter((part): part is { type: "text"; text: string } => part.type === "text")
    .map((part) => part.text)
    .join("\n")
    .trim();
}

function chunkMeta(chunks: PipelineStateType["chunks"]): RetrievedChunkMeta[] {
  return chunks.map(({ id, collection, docSlug, headingPath, anchorId, score }) => ({
    id,
    collection,
    docSlug,
    headingPath,
    anchorId,
    score,
  }));
}

/** Map a node's state update to the slim event the panel renders. */
function eventFor(
  node: string,
  update: Partial<PipelineStateType>,
  seq: number
): RagEvent | null {
  const base = { seq, ts: Date.now() };
  switch (node) {
    case "Analyze":
      return {
        ...base,
        node,
        intent: update.intent ?? null,
        topicality: update.topicality ?? null,
        filter: update.filter ?? null,
      };
    case "Filter":
      return {
        ...base,
        node,
        filter: update.filter ?? null,
        matchCount: update.filterMatchCount ?? 0,
        relaxed: update.filterRelaxed ?? false,
      };
    case "Retrieve":
      return { ...base, node, chunks: chunkMeta(update.chunks ?? []) };
    case "Grade":
      return { ...base, node, verdict: update.verdict ?? "insufficient" };
    case "Route":
      return { ...base, node, route: update.route ?? "refuse" };
    case "Answer":
      return {
        ...base,
        node,
        citations: update.citations ?? [],
        usage: update.usage?.Answer ?? null,
      };
    case "Refuse":
      return {
        ...base,
        node,
        filter: update.filter ?? null,
        matchCount: update.filterMatchCount ?? 0,
      };
    case "Redirect":
      return {
        ...base,
        node,
        topicality: update.topicality === "adversarial" ? "adversarial" : "off-topic",
      };
    default:
      return null;
  }
}

export async function POST(request: Request): Promise<Response> {
  const limited = await checkRateLimit("chat", requestIp(request));
  if (!limited.success) {
    return Response.json(
      { error: "Rate limit exceeded — try again in a minute." },
      { status: 429 }
    );
  }

  const { messages } = (await request.json()) as {
    messages: RagfolioUIMessage[];
  };
  const question = questionFrom(messages);
  if (!question) {
    return Response.json({ error: "No question provided." }, { status: 400 });
  }

  const graph = buildGraph();

  const stream = createUIMessageStream<RagfolioUIMessage>({
    // The SDK masks stream errors by default (good — no internals leak to the
    // client). Keep the real error visible in server logs — and distinguish
    // an abandoned client from a genuine failure, so logs don't cry wolf on
    // every closed tab. Verified empirically which error this actually is:
    // Next's own request.signal fires with a `ResponseAborted` (name set in
    // next/dist/server/web/spec-extension/adapters/next-request.js), not the
    // DOM AbortError a raw AbortController would produce — check both, since
    // a signal check inside LangChain's own call chain could throw either.
    // Per @google/genai's own docs, aborting is client-side only and doesn't
    // cancel billing for a call already in flight — what it DOES do is stop
    // the graph from starting any *further* node's call once the disconnect
    // is detected (see request.signal below).
    onError: (error) => {
      const isAbort =
        error instanceof Error &&
        (error.name === "AbortError" || error.name === "ResponseAborted");
      if (isAbort) {
        console.log("chat pipeline aborted (client disconnected)");
        return "aborted";
      }
      // Quota exhaustion isn't a bug — the free tier's daily cap is a known,
      // named condition, and "check your billing" (the raw API message) is
      // the wrong thing to show a portfolio visitor. Distinct copy from the
      // generic apology so the two are never conflated on screen.
      if (isQuotaExceededError(error)) {
        console.error("chat pipeline quota exceeded:", error);
        return copy.chat.quotaExceeded;
      }
      console.error("chat pipeline error:", error);
      return copy.chat.error;
    },
    execute: async ({ writer }) => {
      const graphStream = await graph.stream(
        { question },
        { streamMode: ["updates", "messages"] as const, signal: request.signal }
      );

      const TEXT_ID = "answer";
      let textStarted = false;
      let seq = 0;
      const startText = () => {
        if (!textStarted) {
          writer.write({ type: "text-start", id: TEXT_ID });
          textStarted = true;
        }
      };

      for await (const [mode, payload] of graphStream) {
        if (mode === "updates") {
          const updates = payload as Record<string, Partial<PipelineStateType>>;
          for (const [node, update] of Object.entries(updates)) {
            const event = eventFor(node, update, seq++);
            if (event) {
              // Persistent + id-per-node: each node's part updates in place
              // and survives in message history for the panel.
              writer.write({
                type: "data-ragEvent",
                id: `rag-${event.node}`,
                data: event,
              });
            }
            if (node === "Answer" && update.citations) {
              writer.write({
                type: "data-citations",
                id: "citations",
                data: { citations: update.citations },
              });
            }
            if ((node === "Refuse" || node === "Redirect") && update.answer) {
              // Refusal/redirect text is authored copy from state — same text
              // channel the model's tokens would use.
              startText();
              writer.write({ type: "text-delta", id: TEXT_ID, delta: update.answer });
            }
          }
        } else if (mode === "messages") {
          const [chunk, metadata] = payload as [
            AIMessageChunk,
            { langgraph_node?: string },
          ];
          if (
            metadata.langgraph_node === "Answer" &&
            typeof chunk.content === "string" &&
            chunk.content.length > 0
          ) {
            startText();
            writer.write({ type: "text-delta", id: TEXT_ID, delta: chunk.content });
          }
        }
      }

      if (textStarted) writer.write({ type: "text-end", id: TEXT_ID });
    },
  });

  return createUIMessageStreamResponse({ stream });
}
