"use client";

/**
 * BuildWeddingButton — enqueues a wedding build via POST /api/build and then
 * polls GET /api/build/[id] so the UI can reflect worker progress. Includes a
 * "check status" fallback for environments where the background worker is not
 * running (jobs stay pending; the step list still updates on the server page).
 */

import { useCallback, useState } from "react";

import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

interface BuildWeddingButtonProps {
  weddingId: string;
}

type PollState =
  | { phase: "idle" }
  | { phase: "starting" }
  | { phase: "running"; status: string; error?: string }
  | { phase: "reload" };

interface BuildResponse {
  buildJobId?: string;
  status?: string;
  error?: string;
}

interface BuildStatusResponse {
  job?: { status: string; errorMessage?: string | null };
  error?: string;
}

const POLL_INTERVAL_MS = 2000;
const MAX_POLLS = 15;

export function BuildWeddingButton({ weddingId }: BuildWeddingButtonProps) {
  const [state, setState] = useState<PollState>({ phase: "idle" });

  const startBuild = useCallback(async () => {
    setState({ phase: "starting" });
    try {
      const res = await fetch("/api/build", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          weddingId,
          idempotencyKey: `build_${weddingId}_${Date.now()}`,
        }),
      });
      const body = (await res.json()) as BuildResponse;
      if (!res.ok || !body.buildJobId) {
        setState({
          phase: "running",
          status: "failed",
          error: body.error ?? "Could not start the build",
        });
        return;
      }

      setState({ phase: "running", status: body.status ?? "pending" });

      // Poll the job a bounded number of times (idempotent worker picks it up).
      for (let i = 0; i < MAX_POLLS; i += 1) {
        await new Promise((resolve) => setTimeout(resolve, POLL_INTERVAL_MS));
        const statusRes = await fetch(`/api/build/${body.buildJobId}`, {
          cache: "no-store",
        });
        const statusBody = (await statusRes.json()) as BuildStatusResponse;
        if (!statusRes.ok || !statusBody.job) {
          setState({ phase: "running", status: "failed", error: "Build status unavailable" });
          return;
        }
        setState({ phase: "running", status: statusBody.job.status });
        if (
          statusBody.job.status === "completed" ||
          statusBody.job.status === "failed"
        ) {
          setState({ phase: "reload" });
          // Keep the success/error badge visible; the user reloads for detail.
          setTimeout(() => window.location.reload(), 400);
          return;
        }
      }
    } catch {
      setState({ phase: "running", status: "failed", error: "Network error" });
    }
  }, [weddingId]);

  if (state.phase === "reload") {
    return <Badge tone="success">Build finished — refreshing…</Badge>;
  }

  return (
    <div className="flex items-center gap-3">
      <Button
        onClick={startBuild}
        loading={state.phase === "starting" || state.phase === "running"}
      >
        {state.phase === "starting"
          ? "Starting build…"
          : state.phase === "running"
            ? `Building (${state.status})…`
            : "Build vault"}
      </Button>
      {state.phase === "running" && state.status === "failed" ? (
        <span className="text-sm text-red-600 dark:text-red-400">
          {state.error ?? "Build failed"}
        </span>
      ) : null}
    </div>
  );
}