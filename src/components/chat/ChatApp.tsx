"use client";

import { useState } from "react";
import { useChat } from "@ai-sdk/react";
import { DefaultChatTransport } from "ai";
import corpusConfig from "@config";
import { copy } from "@/copy";
import type { ForestData } from "@/lib/corpus/server-data";
import { collectRagTurn } from "@/lib/panel/rag-turn";
import type { RagfolioUIMessage } from "@/lib/stream-types";
import { useMediaQuery } from "@/lib/use-media-query";
import { RagPanel } from "@/components/panel/RagPanel";
import { Composer } from "./Composer";
import { Chips } from "./Chips";
import { Thread } from "./Thread";

/**
 * The stateful chat surface. Above corpus.config.ts's minViewportWidth the RAG
 * Panel sits in a left column beside the chat, and the landing→active
 * transition slides the chat column from centered to pinned-right (a spacer's
 * flex-grow collapses) while the panel fades in. Below that width the panel
 * stacks beneath the thread behind a "Show RAG Panel" disclosure. All motion
 * is disabled under prefers-reduced-motion via the global rule.
 */
export function ChatApp({ forest }: { forest: ForestData }) {
  const [input, setInput] = useState("");
  const [panelOpen, setPanelOpen] = useState(false);
  const wide = useMediaQuery(`(min-width: ${corpusConfig.minViewportWidth}px)`);

  const { messages, sendMessage, stop, status } = useChat<RagfolioUIMessage>({
    transport: new DefaultChatTransport({ api: "/api/chat" }),
  });

  const active = messages.length > 0;
  const busy = status === "submitted" || status === "streaming";

  function send(text: string) {
    const trimmed = text.trim();
    if (!trimmed || busy) return;
    sendMessage({ text: trimmed });
    setInput("");
  }

  const lastAssistant = [...messages].reverse().find((m) => m.role === "assistant");
  const turn = collectRagTurn(lastAssistant);

  const composer = (
    <Composer
      value={input}
      onChange={setInput}
      onSubmit={() => send(input)}
      onStop={stop}
      status={status}
    />
  );
  const chips = <Chips onPick={send} disabled={busy} />;
  const errorNote = status === "error" && (
    <p className="text-sm text-danger">{copy.chat.error}</p>
  );

  // ── Narrow, active: single column; panel stacks beneath the thread. ─────────
  if (active && !wide) {
    return (
      <div className="flex min-h-0 flex-1 flex-col">
        <div className="min-h-0 flex-1 overflow-y-auto">
          <div className="mx-auto w-full max-w-2xl px-5 py-6">
            <Thread messages={messages} status={status} />
          </div>
          <div className="mx-auto w-full max-w-2xl px-5">
            <button
              onClick={() => setPanelOpen((open) => !open)}
              className="w-full rounded-[var(--radius-sm)] border border-line py-2 text-sm text-muted hover:text-ink"
              aria-expanded={panelOpen}
            >
              {panelOpen ? copy.responsive.hidePanel : copy.responsive.showPanel}
            </button>
            {panelOpen && (
              <div className="mt-3 rounded-[var(--radius)] border border-line">
                <RagPanel turn={turn} forest={forest} />
              </div>
            )}
          </div>
        </div>
        <div className="mx-auto w-full max-w-2xl space-y-3 px-5 pb-5 pt-2">
          {errorNote}
          {composer}
          {chips}
        </div>
      </div>
    );
  }

  // ── Wide (landing or active): two-column morphing layout. ───────────────────
  // Narrow landing also lands here — the panel region is empty/hidden and the
  // chat column is full width, so it renders as a centered single column.
  return (
    <div className="flex min-h-0 flex-1">
      {/* Left region: RAG Panel, grows into remaining width when active. */}
      <div
        className={`min-w-0 flex-1 overflow-y-auto transition-opacity duration-500 ${
          active && wide ? "opacity-100" : "pointer-events-none opacity-0"
        }`}
      >
        {active && wide && <RagPanel turn={turn} forest={forest} />}
      </div>

      {/* Chat column: fixed width, steps down one notch below 1536px. */}
      <div className="flex min-h-0 w-full flex-col px-5 min-[1280px]:w-[680px] min-[1536px]:w-[760px]">
        {active ? (
          <>
            <div className="min-h-0 flex-1 overflow-y-auto py-6">
              <Thread messages={messages} status={status} />
            </div>
            <div className="space-y-3 pb-5 pt-2">
              {errorNote}
              {composer}
              {chips}
            </div>
          </>
        ) : (
          <div className="m-auto w-full space-y-5 py-16">
            <h1 className="text-center text-2xl font-semibold tracking-tight">
              {copy.greeting}
            </h1>
            {composer}
            {chips}
            <p className="mx-auto max-w-md text-center text-xs text-muted">
              {copy.landing.footnote}
            </p>
          </div>
        )}
      </div>

      {/* Right spacer: grow:1 centers the chat column (landing), grow:0 pins it right (active). */}
      <div
        aria-hidden
        className="hidden shrink basis-0 transition-[flex-grow] duration-500 ease-out min-[1280px]:block"
        style={{ flexGrow: active ? 0 : 1 }}
      />
    </div>
  );
}
