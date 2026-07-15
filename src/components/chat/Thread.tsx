"use client";

import { useEffect, useRef } from "react";
import type { ChatStatus } from "ai";
import type { RagfolioUIMessage } from "@/lib/stream-types";
import { Message } from "./Message";

/**
 * The scrollable message thread, above the (fixed) input. Auto-scrolls to the
 * newest content while a response streams. Bottom-anchored (min-h-full +
 * justify-end): a short conversation sits near the input instead of at the
 * top of a mostly-empty column, while a long one still scrolls normally
 * top-to-bottom — flex only overrides alignment when content is shorter than
 * the scroll container, never message order.
 */
export function Thread({
  messages,
  status,
}: {
  messages: RagfolioUIMessage[];
  status: ChatStatus;
}) {
  const endRef = useRef<HTMLDivElement>(null);
  const busy = status === "submitted" || status === "streaming";

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [messages, status]);

  return (
    <div className="flex min-h-full flex-col justify-end gap-6">
      {messages.map((message, i) => (
        <Message
          key={message.id}
          message={message}
          streaming={busy && i === messages.length - 1 && message.role === "assistant"}
        />
      ))}
      <div ref={endRef} />
    </div>
  );
}
