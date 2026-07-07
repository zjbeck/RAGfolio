"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useState } from "react";
import { copy } from "@/copy";

export function GateForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setSubmitting(true);
    setError(null);
    const response = await fetch("/api/auth", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ password }),
    });
    if (response.ok) {
      // Return to wherever the proxy intercepted, defaulting to home.
      router.push(searchParams.get("from") ?? "/");
      router.refresh();
      return;
    }
    setSubmitting(false);
    if (response.status === 401) setError(copy.gate.errorIncorrect);
    else if (response.status === 429) setError(copy.gate.errorRateLimited);
    else setError(copy.gate.errorGeneric);
  }

  return (
    <form onSubmit={submit} className="w-full max-w-sm space-y-4">
      <h1 className="text-lg font-semibold">{copy.gate.title}</h1>
      <p className="text-sm opacity-80">{copy.gate.prompt}</p>
      <label className="block space-y-1">
        <span className="text-sm">{copy.gate.passwordLabel}</span>
        <input
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          autoFocus
          className="w-full rounded border border-current/30 bg-transparent px-3 py-2"
        />
      </label>
      {error && (
        <p role="alert" className="text-sm text-red-600 dark:text-red-400">
          {error}
        </p>
      )}
      <button
        type="submit"
        disabled={submitting || password.length === 0}
        className="rounded border border-current px-4 py-2 text-sm disabled:opacity-50"
      >
        {copy.gate.submitLabel}
      </button>
    </form>
  );
}
