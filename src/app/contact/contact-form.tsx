"use client";

/**
 * ContactForm — demo contact form. Submitting shows a success state; nothing
 * is transmitted (no marketing contact endpoint exists yet).
 */

import { useState, type FormEvent } from "react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { IconCheck } from "@/components/icons";

const TOPICS = [
  "Question about packages",
  "Wedding company partnership",
  "White-label program",
  "Help with an existing vault",
  "Something else",
];

export function ContactForm() {
  const [submitted, setSubmitted] = useState(false);

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSubmitted(true);
  }

  if (submitted) {
    return (
      <div className="card-soft flex flex-col items-center p-10 text-center">
        <span className="flex h-14 w-14 items-center justify-center rounded-full bg-emerald-50 text-emerald-600">
          <IconCheck className="h-7 w-7" />
        </span>
        <h2 className="mt-5 font-display text-2xl font-semibold tracking-tight text-ink">
          Thanks for reaching out!
        </h2>
        <p className="mt-2 max-w-sm text-sm leading-relaxed text-muted">
          This is a demo form, so no message was actually sent — but on the real
          site, our team would reply within two business days.
        </p>
        <button
          type="button"
          onClick={() => setSubmitted(false)}
          className="mt-6 rounded-full border border-line px-5 py-2.5 text-sm font-semibold text-ink transition-colors hover:bg-blush"
        >
          Send another message
        </button>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="card-soft space-y-5 p-8">
      <div className="grid gap-5 sm:grid-cols-2">
        <div>
          <Label htmlFor="contact-name">Name</Label>
          <Input id="contact-name" name="name" placeholder="Your name" required autoComplete="name" />
        </div>
        <div>
          <Label htmlFor="contact-email">Email</Label>
          <Input id="contact-email" name="email" type="email" placeholder="you@email.com" required autoComplete="email" />
        </div>
      </div>

      <div>
        <Label htmlFor="contact-topic">What&apos;s this about?</Label>
        <Select id="contact-topic" name="topic" defaultValue={TOPICS[0]}>
          {TOPICS.map((topic) => (
            <option key={topic} value={topic}>
              {topic}
            </option>
          ))}
        </Select>
      </div>

      <div>
        <Label htmlFor="contact-message">Message</Label>
        <Textarea id="contact-message" name="message" rows={5} placeholder="Your message…" required />
      </div>

      <button
        type="submit"
        className="inline-flex h-12 w-full items-center justify-center rounded-full bg-brand px-7 text-sm font-semibold text-ivory transition-colors hover:bg-brand-soft"
      >
        Send message
      </button>
      <p className="text-center text-xs text-faint">Demo form — no message is actually sent.</p>
    </form>
  );
}