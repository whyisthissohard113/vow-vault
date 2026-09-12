"use client";

/**
 * GuestUploadCard — the client-side guest upload flow for the public vault:
 *
 *   1. Start a guest session (POST /api/vault/[slug]/guest-session) and keep
 *      the raw token in localStorage for the vault.
 *   2. Initiate an upload with the token (POST /api/media/guest/upload/init).
 *   3. PUT the file to the returned presigned URL (XHR for progress).
 *   4. Complete the upload by public id (POST /api/media/guest/upload/[publicId]/complete).
 *
 * The card never displays internal ids or storage keys; the server re-validates
 * the token and windows on every call.
 */

import { useCallback, useState } from "react";

interface GuestUploadCardProps {
  slug: string;
  uploadDeadlineDisplay: string;
}

type Phase =
  | "idle"
  | "session"
  | "uploading"
  | "completing"
  | "done"
  | "error";

type InitResult =
  | { publicId: string; uploadUrl: string; expiresAt: string }
  | { duplicate: boolean; message?: string };

const TOKEN_KEY_PREFIX = "wmv:guest:";

function tokenKey(slug: string): string {
  return `${TOKEN_KEY_PREFIX}${slug}`;
}

async function readJson(res: Response): Promise<Record<string, unknown>> {
  try {
    return (await res.json()) as Record<string, unknown>;
  } catch {
    return {};
  }
}

function putWithProgress(
  url: string,
  file: File,
  onProgress: (percent: number) => void,
): Promise<void> {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open("PUT", url);
    xhr.setRequestHeader("Content-Type", file.type || "application/octet-stream");
    xhr.upload.onprogress = (event) => {
      if (event.lengthComputable) {
        onProgress(Math.round((event.loaded / event.total) * 100));
      }
    };
    xhr.onload = () => {
      if (xhr.status >= 200 && xhr.status < 300) {
        resolve();
      } else {
        reject(new Error(`Upload failed with status ${xhr.status}`));
      }
    };
    xhr.onerror = () => reject(new Error("Upload failed"));
    xhr.send(file);
  });
}

export function GuestUploadCard({ slug, uploadDeadlineDisplay }: GuestUploadCardProps) {
  const [name, setName] = useState("");
  const [token, setToken] = useState<string | null>(() => {
    // Client-only lazy initializer: restore the vault's guest token, if any.
    try {
      return localStorage.getItem(tokenKey(slug));
    } catch {
      return null;
    }
  });
  const [phase, setPhase] = useState<Phase>("idle");
  const [progress, setProgress] = useState(0);
  const [fileName, setFileName] = useState("");
  const [message, setMessage] = useState("");
  const [sessionLimit, setSessionLimit] = useState("");

  const startSession = useCallback(async () => {
    setPhase("session");
    setMessage("");
    try {
      const res = await fetch(`/api/vault/${slug}/guest-session`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ displayName: name.trim() || undefined }),
      });
      const body = await readJson(res);
      if (!res.ok) {
        throw new Error((body.error as string) ?? "Could not start sharing");
      }
      localStorage.setItem(tokenKey(slug), body.token as string);
      setToken(body.token as string);
      setSessionLimit(
        typeof body.maxUploads === "number" ? `${body.maxUploads} uploads` : "",
      );
      setPhase("idle");
    } catch (error) {
      setPhase("error");
      setMessage(
        error instanceof Error ? error.message : "Could not start sharing",
      );
    }
  }, [slug, name]);

  const handleFiles = useCallback(
    async (fileList: FileList | null) => {
      if (!fileList || fileList.length === 0 || !token) return;
      const file = fileList[0];
      setFileName(file.name);
      setMessage("");
      setProgress(0);
      setPhase("uploading");
      try {
        const initRes = await fetch(`/api/media/guest/upload/init`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "x-guest-token": token,
          },
          body: JSON.stringify({
            filename: file.name,
            contentType: file.type || "application/octet-stream",
            sizeBytes: file.size,
          }),
        });
        const body = await readJson(initRes);
        if (!initRes.ok) {
          throw new Error((body.error as string) ?? "Upload could not be started");
        }
        const init = body as InitResult;

        if ("duplicate" in init) {
          setMessage(init.message ?? "This photo was already shared");
          setPhase("done");
          return;
        }

        await putWithProgress(init.uploadUrl, file, setProgress);

        setPhase("completing");
        const completeRes = await fetch(
          `/api/media/guest/upload/${init.publicId}/complete`,
          {
            method: "POST",
            headers: { "x-guest-token": token },
          },
        );
        const completeBody = await readJson(completeRes);
        if (!completeRes.ok) {
          throw new Error(
            (completeBody.error as string) ?? "Could not confirm your upload",
          );
        }

        setPhase("done");
        setMessage(
          "Thank you! Your memory has been received and will appear here once approved.",
        );
      } catch (error) {
        setPhase("error");
        setMessage(
          error instanceof Error ? error.message : "Something went wrong",
        );
      }
    },
    [token],
  );

  return (
    <div className="rounded-2xl border border-zinc-200 p-8 dark:border-zinc-800">
      <h2 className="text-lg font-semibold text-zinc-900 dark:text-zinc-50">
        Share your memories
      </h2>
      <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">
        Guest uploads close on {uploadDeadlineDisplay}
      </p>

      {!token ? (
        <div className="mt-6">
          <label
            htmlFor="guest-name"
            className="text-sm font-medium text-zinc-700 dark:text-zinc-300"
          >
            Your name (optional)
          </label>
          <input
            id="guest-name"
            type="text"
            value={name}
            onChange={(event) => setName(event.target.value)}
            maxLength={120}
            placeholder="e.g. The Smith family"
            className="mt-2 w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-900 outline-none focus:border-zinc-500 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-50"
          />
          <button
            type="button"
            onClick={startSession}
            disabled={phase === "session"}
            className="mt-4 w-full rounded-lg bg-zinc-900 px-4 py-2.5 text-sm font-medium text-white transition-opacity hover:opacity-90 disabled:opacity-50 dark:bg-zinc-50 dark:text-zinc-900"
          >
            {phase === "session" ? "Starting…" : "Start sharing"}
          </button>
          {sessionLimit ? (
            <p className="mt-2 text-center text-xs text-zinc-500 dark:text-zinc-400">
              {sessionLimit} per session
            </p>
          ) : null}
        </div>
      ) : (
        <div className="mt-6">
          <label
            htmlFor="guest-file"
            className="flex w-full cursor-pointer flex-col items-center justify-center rounded-xl border-2 border-dashed border-zinc-300 px-4 py-8 text-center text-sm text-zinc-600 hover:border-zinc-400 dark:border-zinc-700 dark:text-zinc-400"
          >
            <span className="text-base font-medium text-zinc-800 dark:text-zinc-200">
              {phase === "uploading" && progress > 0 && progress < 100
                ? `Uploading ${fileName}… ${progress}%`
                : phase === "completing"
                  ? "Confirming upload…"
                  : phase === "done"
                    ? "Upload another"
                    : "Choose a photo or video"}
            </span>
            <span className="mt-1 text-xs">
              Photos up to 25 MB; videos up to 200 MB
            </span>
            <input
              id="guest-file"
              type="file"
              accept="image/*,video/*"
              className="sr-only"
              disabled={phase === "uploading" || phase === "completing"}
              onChange={(event) => handleFiles(event.target.files)}
            />
          </label>

          {phase === "uploading" && progress > 0 && progress < 100 ? (
            <div className="mt-4 h-2 w-full overflow-hidden rounded-full bg-zinc-200 dark:bg-zinc-800">
              <div
                className="h-full rounded-full bg-zinc-900 transition-[width] duration-200 dark:bg-zinc-50"
                style={{ width: `${progress}%` }}
              />
            </div>
          ) : null}

          {message ? (
            <p
              className={`mt-4 text-center text-sm ${
                phase === "error"
                  ? "text-red-600 dark:text-red-400"
                  : "text-zinc-600 dark:text-zinc-400"
              }`}
            >
              {message}
            </p>
          ) : null}
        </div>
      )}
    </div>
  );
}