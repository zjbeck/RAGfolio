import type { AIMessageChunk } from "@langchain/core/messages";
import {
  createUIMessageStream,
  createUIMessageStreamResponse,
} from "ai";
import { buildGraph } from "@/lib/graph/graph";
import type { PipelineStateType } from "@/lib/graph/state";
import { checkRateLimit, requestIp } from "@/lib/ratelimit";
import type {
  RagEvent,
  RagfolioUIMessage,
  RetrievedChunkMeta,
} from "@/lib/stream-types";

/** Streaming responses need more than Vercel's default function window. */
export const maxDuration = 60;

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
    // client). Keep the real error visible in server logs.
    onError: (error) => {
      console.error("chat pipeline error:", error);
      return "The pipeline hit an error. Try again; if it persists, check the server logs.";
    },
    execute: async ({ writer }) => {
      const graphStream = await graph.stream(
        { question },
        { streamMode: ["updates", "messages"] as const }
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
            if (node === "Refuse" && update.answer) {
              // Refusal text is authored copy from state — same text channel
              // the model's tokens would use.
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
