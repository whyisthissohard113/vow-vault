"use client";

import { useEffect } from "react";

import { ErrorState } from "@/components/ui/error-state";
import { Button } from "@/components/ui/button";

export default function DashboardError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("[Dashboard] unhandled error:", error);
  }, [error]);

  return (
    <ErrorState
      title="This page hit a problem"
      description="Something went wrong while loading the dashboard. Try again, and if it keeps happening contact support."
      action={<Button onClick={reset}>Try again</Button>}
    />
  );
}