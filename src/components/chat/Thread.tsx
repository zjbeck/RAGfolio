"use client";

import { useEffect, useRef } from "react";
import type { ChatStatus } from "ai";
import type { RagfolioUIMessage } from "@/lib/stream-types";
import { Message } from "./Message";

/**
 * The scrollable message thread, above the (fixed) input. Auto-scrolls to the
 * newest content while a response streams.
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
    <div className="flex flex-col gap-6">
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
