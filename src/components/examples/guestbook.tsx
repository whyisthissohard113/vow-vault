"use client";

/**
 * Guestbook — interactive demo guestbook.
 *
 * Shows the existing fictional messages and lets the visitor add a new one
 * (name / message / moment). The new entry appears immediately from local
 * state only — nothing is sent to a server.
 */

import { useState } from "react";

import type { DemoGuestbookEntry } from "@/content/examples";
import { DemoInitials } from "@/components/wedding/demo-artwork";
import { IconHeart } from "@/components/icons";
import { DemoNotice } from "./demo-notice";

const MOMENTS = ["Just now", "Ceremony", "Reception", "First dance", "Toasts", "Send-off"] as const;

let messageSequence = 0;

export function Guestbook({
  entries,
  onAdd,
  coupleNames,
}: {
  entries: DemoGuestbookEntry[];
  onAdd: (entry: DemoGuestbookEntry) => void;
  coupleNames: string;
}) {
  const [name, setName] = useState("");
  const [message, setMessage] = useState("");
  const [moment, setMoment] = useState<string>("Just now");
  const [notice, setNotice] = useState(false);

  const canSubmit = name.trim().length > 0 && message.trim().length > 0;

  function submit() {
    if (!canSubmit) return;
    messageSequence += 1;
    onAdd({
      id: `demo-msg-${Date.now()}-${messageSequence}`,
      name: name.trim(),
      message: message.trim(),
      moment,
    });
    setMessage("");
    setNotice(true);
  }

  return (
    <section aria-labelledby="vault-guestbook-heading">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h2 id="vault-guestbook-heading" className="font-display text-2xl font-semibold tracking-tight vault-ink sm:text-3xl">
            Guestbook
          </h2>
          <p className="mt-1 text-sm vault-muted">
            Messages the couple&apos;s guests left in the {coupleNames} vault.
          </p>
        </div>
        <span className="inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-[11px] font-bold uppercase tracking-widest vault-accent-soft vault-accent">
          <IconHeart className="h-3 w-3" />
          {entries.length} messages
        </span>
      </div>

      <div className="mt-6 grid gap-6 lg:grid-cols-[minmax(0,1.2fr)_minmax(0,1fr)]">
        {/* Messages */}
        <ul className="space-y-3">
          {entries.map((entry) => (
            <li
              key={entry.id}
              className="flex items-start gap-3 border p-4 vault-radius vault-line vault-surface"
            >
              <DemoInitials
                initials={entry.name
                  .split(" ")
                  .slice(0, 2)
                  .map((part) => part.charAt(0))
                  .join("")}
                className="h-10 w-10 text-xs"
                palette={["var(--vault-accent)", "#8f6f3f"]}
              />
              <div className="min-w-0">
                <div className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5">
                  <p className="text-sm font-semibold vault-ink">{entry.name}</p>
                  <p className="text-[11px] vault-muted">{entry.moment}</p>
                </div>
                <p className="mt-1 text-sm leading-relaxed vault-muted">{entry.message}</p>
              </div>
            </li>
          ))}
        </ul>

        {/* Form */}
        <div className="border p-5 vault-radius vault-line vault-surface">
          <h3 className="font-display text-lg font-semibold vault-ink">Leave a message</h3>
          <p className="mt-1 text-xs vault-muted">
            Guests can write a note that lives alongside the couple&apos;s memories.
          </p>

          <form
            className="mt-4 space-y-3"
            onSubmit={(event) => {
              event.preventDefault();
              submit();
            }}
          >
            <div>
              <label htmlFor="guestbook-name" className="text-xs font-semibold vault-muted">
                Your name
              </label>
              <input
                id="guestbook-name"
                value={name}
                onChange={(event) => setName(event.target.value)}
                maxLength={60}
                placeholder="e.g. Priya"
                className="mt-1 h-10 w-full border px-3 text-sm outline-none transition-colors vault-radius vault-line vault-surface vault-ink focus:border-[var(--vault-accent)]"
              />
            </div>

            <div>
              <label htmlFor="guestbook-moment" className="text-xs font-semibold vault-muted">
                Moment
              </label>
              <select
                id="guestbook-moment"
                value={moment}
                onChange={(event) => setMoment(event.target.value)}
                className="mt-1 h-10 w-full border px-3 text-sm outline-none transition-colors vault-radius vault-line vault-surface vault-ink focus:border-[var(--vault-accent)]"
              >
                {MOMENTS.map((option) => (
                  <option key={option} value={option}>
                    {option}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label htmlFor="guestbook-message" className="text-xs font-semibold vault-muted">
                Message
              </label>
              <textarea
                id="guestbook-message"
                value={message}
                onChange={(event) => setMessage(event.target.value)}
                rows={3}
                maxLength={280}
                placeholder="Write a message to the couple…"
                className="mt-1 w-full resize-none border px-3 py-2 text-sm outline-none transition-colors vault-radius vault-line vault-surface vault-ink focus:border-[var(--vault-accent)]"
              />
            </div>

            <button
              type="submit"
              disabled={!canSubmit}
              className="inline-flex h-11 w-full items-center justify-center rounded-full vault-accent-bg text-sm font-bold transition-transform hover:scale-[1.01] disabled:cursor-not-allowed disabled:opacity-40"
            >
              Add to guestbook
            </button>
          </form>

          {notice ? (
            <div className="mt-4" role="status" aria-live="polite">
              <DemoNotice className="vault-muted">
                Demo message — your note has been added to this example vault for this browser
                session only. Nothing was sent to a server.
              </DemoNotice>
            </div>
          ) : null}
        </div>
      </div>
    </section>
  );
}
