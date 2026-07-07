import { Suspense } from "react";
import { GateForm } from "./gate-form";

/**
 * The password gate. Deliberately minimal: one form, no nav, no hints about
 * what's behind it. All copy lives in src/copy.ts. (Suspense is required
 * because the form reads ?from= via useSearchParams.)
 */
export default function GatePage() {
  return (
    <main className="flex min-h-screen items-center justify-center p-6">
      <Suspense>
        <GateForm />
      </Suspense>
    </main>
  );
}
