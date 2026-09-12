"use client";

/**
 * QrActions — client controls for the QR page:
 *  - Generate a QR code for a selected wedding (POST /api/qr/generate)
 *  - Download a Platinum QR design card (POST /api/qr/[id]/card)
 *  - Revoke a QR code (DELETE /api/qr/[id])
 *
 * All authorization happens server-side on the routes; the client just drives
 * fetch + reload.
 */

import { useCallback, useState } from "react";

import { Button } from "@/components/ui/button";
import { Select } from "@/components/ui/select";
import { Label } from "@/components/ui/label";

export interface QrWeddingOption {
  weddingId: string;
  name: string;
}

interface QrActionsProps {
  /** QR rows relevant to page reloads — we only need id + status + friendly name. */
  qrCodes: Array<{
    id: string;
    status: string;
    weddingName: string;
    packageCode: string | null;
  }>;
  weddingOptions: QrWeddingOption[];
  canManage: boolean;
}

interface GenerateResponse {
  qrCodeId?: string;
  error?: string;
}

interface CardResponse {
  cardBase64?: string;
  error?: string;
}

function downloadBase64(base64: string, filename: string) {
  const anchor = document.createElement("a");
  anchor.href = `data:image/png;base64,${base64}`;
  anchor.download = filename;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
}

export function QrActions({
  qrCodes,
  weddingOptions,
  canManage,
}: QrActionsProps) {
  const [selectedWedding, setSelectedWedding] = useState(
    weddingOptions[0]?.weddingId ?? "",
  );
  const [generating, setGenerating] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [message, setMessage] = useState("");

  const generate = useCallback(async () => {
    if (!selectedWedding) return;
    setGenerating(true);
    setMessage("");
    try {
      const res = await fetch("/api/qr/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ weddingId: selectedWedding }),
      });
      const body = (await res.json()) as GenerateResponse;
      if (!res.ok || !body.qrCodeId) {
        setMessage(body.error ?? "Could not generate QR code");
        return;
      }
      window.location.reload();
    } catch {
      setMessage("Network error");
    } finally {
      setGenerating(false);
    }
  }, [selectedWedding]);

  const downloadCard = useCallback(async (qr: { id: string; weddingName: string }) => {
    setBusyId(qr.id);
    setMessage("");
    try {
      const res = await fetch(`/api/qr/${qr.id}/card`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ coupleName: qr.weddingName }),
      });
      const body = (await res.json()) as CardResponse;
      if (!res.ok || !body.cardBase64) {
        setMessage(body.error ?? "Could not generate the card");
        return;
      }
      downloadBase64(
        body.cardBase64,
        `qr-card-${qr.weddingName.replace(/[^a-z0-9]+/gi, "-").toLowerCase()}.png`,
      );
    } catch {
      setMessage("Network error");
    } finally {
      setBusyId(null);
    }
  }, []);

  const revoke = useCallback(
    async (id: string) => {
      if (!window.confirm("Revoke this QR code? Guests will no longer reach the vault through it.")) {
        return;
      }
      setBusyId(id);
      setMessage("");
      try {
        const res = await fetch(`/api/qr/${id}`, { method: "DELETE" });
        if (!res.ok) {
          const body = (await res.json().catch(() => ({}))) as { error?: string };
          setMessage(body.error ?? "Could not revoke QR code");
          return;
        }
        window.location.reload();
      } catch {
        setMessage("Network error");
      } finally {
        setBusyId(null);
      }
    },
    [],
  );

  return (
    <div className="space-y-4">
      {canManage ? (
        <div className="rounded-2xl border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-900">
          <Label htmlFor="qr-wedding">Wedding</Label>
          <div className="mt-1.5 flex flex-wrap items-center gap-3">
            <Select
              id="qr-wedding"
              value={selectedWedding}
              onChange={(event) => setSelectedWedding(event.target.value)}
              className="max-w-xs"
            >
              <option value="">Select a wedding…</option>
              {weddingOptions.map((w) => (
                <option key={w.weddingId} value={w.weddingId}>
                  {w.name}
                </option>
              ))}
            </Select>
            <Button
              onClick={generate}
              loading={generating}
              disabled={!selectedWedding}
            >
              Generate QR code
            </Button>
          </div>
        </div>
      ) : null}

      {message ? (
        <p className="text-sm text-zinc-500 dark:text-zinc-400">{message}</p>
      ) : null}

      {qrCodes.length > 0 ? (
        <ul className="space-y-3">
          {qrCodes.map((qr) => (
            <li
              key={qr.id}
              className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-zinc-200 bg-white px-5 py-4 dark:border-zinc-800 dark:bg-zinc-900"
            >
              <div className="min-w-0">
                <p className="text-sm font-medium text-zinc-900 dark:text-zinc-50">
                  {qr.weddingName}
                </p>
                <p className="mt-0.5 text-xs text-zinc-400">
                  {qr.status} · {qr.id}
                </p>
              </div>
              {canManage ? (
                <div className="flex flex-wrap items-center gap-2">
                  {qr.packageCode === "platinum" ? (
                    <Button
                      variant="outline"
                      size="sm"
                      loading={busyId === qr.id}
                      onClick={() => downloadCard(qr)}
                    >
                      Download card
                    </Button>
                  ) : null}
                  {qr.status === "active" ? (
                    <Button
                      variant="ghost"
                      size="sm"
                      loading={busyId === qr.id}
                      onClick={() => revoke(qr.id)}
                    >
                      Revoke
                    </Button>
                  ) : null}
                </div>
              ) : null}
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}