"use client";

/**
 * WeddingWizard — guided creation of a wedding vault from dossier to QR code.
 *
 * Flow: intro → couple → wedding details (creates the dossier via
 * POST /api/weddings) → package → customize → payment (demo) → build →
 * preview → share.
 *
 * Notes:
 *  - Authorization stays server-side: the wizard calls the guarded API routes
 *    and the server page gates it behind CREATE_WEDDING. Roles without
 *    MANAGE_WEDDING (staff) can create the draft but building/managing is
 *    deferred to an admin/owner, so the wizard stops after creation for them.
 *  - The payment step is a UI-only simulation (no order/payment is created);
 *    a real build without a paid order will fail at `verify_payment` with a
 *    clear message, which this wizard surfaces.
 *  - A minimal draft is persisted to sessionStorage so the wizard can resume
 *    after an accidental refresh.
 */

import { useCallback, useEffect, useMemo, useState } from "react";
import QRCode from "qrcode";
import Link from "next/link";
import { useRouter } from "next/navigation";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  IconArrowRight,
  IconCard,
  IconCheck,
  IconHeart,
  IconLink,
  IconQr,
  IconSparkle,
  IconWedding,
} from "@/components/icons";
import { PACKAGE_METADATA } from "@/lib/entitlements/packages";
import { formatCurrency } from "@/lib/format";
import { cn } from "@/lib/utils";

// ── Types ────────────────────────────────────────────────────────────────────

type StepName =
  | "intro"
  | "couple"
  | "details"
  | "package"
  | "customize"
  | "payment"
  | "build"
  | "preview"
  | "share";

interface WizardData {
  partnerOneName: string;
  partnerTwoName: string;
  weddingDate: string;
  venue: string;
  customerName: string;
  customerEmail: string;
  packageCode: "silver" | "gold" | "platinum";
  themeColor: string;
  accentColor: string;
  coupleStory: string;
  customMessage: string;
  allowGuestUploads: boolean;
  requireApproval: boolean;
}

const DEFAULT_DATA: WizardData = {
  partnerOneName: "",
  partnerTwoName: "",
  weddingDate: "",
  venue: "",
  customerName: "",
  customerEmail: "",
  packageCode: "silver",
  themeColor: "#8B5E3C",
  accentColor: "#D4AF37",
  coupleStory: "",
  customMessage: "",
  allowGuestUploads: true,
  requireApproval: false,
};

const STEPS: Array<{ name: StepName; label: string; icon: React.ReactNode }> = [
  { name: "intro", label: "Start", icon: <IconSparkle /> },
  { name: "couple", label: "Couple", icon: <IconHeart /> },
  { name: "details", label: "Details", icon: <IconWedding /> },
  { name: "package", label: "Package", icon: <IconCard /> },
  { name: "customize", label: "Customize", icon: <IconSparkle /> },
  { name: "payment", label: "Payment", icon: <IconCard /> },
  { name: "build", label: "Build", icon: <IconSparkle /> },
  { name: "preview", label: "Preview", icon: <IconHeart /> },
  { name: "share", label: "Share", icon: <IconLink /> },
];

const RESUME_KEY = "wmv:wizard:draft";

interface WeddingsApiResponse {
  wedding?: { id: string; code?: string; name?: string; status?: string; slug?: string };
  error?: string;
  details?: Record<string, unknown>;
}

interface BuildResponse {
  buildJobId?: string;
  status?: string;
  error?: string;
}

interface BuildStatusResponse {
  job?: { status: string; errorMessage?: string | null };
  steps?: Array<{ stepKey: string; status: string }>;
  error?: string;
}

interface QrGenerateResponse {
  qrCodeId?: string;
  publicId?: string;
  targetUrl?: string;
  error?: string;
}

// ── Component ────────────────────────────────────────────────────────────────

export function WeddingWizard({
  canManage,
  organizationName,
}: {
  canManage: boolean;
  organizationName: string;
}) {
  const router = useRouter();
  const [stepIndex, setStepIndex] = useState(0);
  const [data, setData] = useState<WizardData>(DEFAULT_DATA);
  const [weddingId, setWeddingId] = useState<string | null>(null);
  const [weddingCode, setWeddingCode] = useState<string>("");
  const [busyMessage, setBusyMessage] = useState("");
  const [error, setError] = useState("");
  const [buildJobId, setBuildJobId] = useState<string | null>(null);
  const [buildSteps, setBuildSteps] = useState<Array<{ stepKey: string; status: string }>>([]);
  const [qrDataUrl, setQrDataUrl] = useState("");
  const [qrTargetUrl, setQrTargetUrl] = useState("");

  const step = STEPS[stepIndex]?.name ?? "intro";

  // Resume a draft from a previous refresh.
  useEffect(() => {
    try {
      const raw = sessionStorage.getItem(RESUME_KEY);
      if (!raw) return;
      const saved = JSON.parse(raw) as { weddingId?: string; data?: Partial<WizardData> };
      if (saved?.weddingId) {
        // Load a saved draft from sessionStorage. This intentionally runs in
        // an effect: reading localStorage during SSR would cause hydration
        // mismatches, so the saved values are applied after first render.
        // eslint-disable-next-line react-hooks/set-state-in-effect
        setWeddingId(saved.weddingId);
        if (saved.data) setData((prev) => ({ ...prev, ...saved.data }));
      }
    } catch {
      // Corrupt draft → start fresh.
    }
  }, []);

  const persist = useCallback((id: string, nextData: WizardData) => {
    setWeddingId(id);
    try {
      sessionStorage.setItem(RESUME_KEY, JSON.stringify({ weddingId: id, data: nextData }));
    } catch {
      // Storage unavailable → in-memory only.
    }
  }, []);

  const update = useCallback((patch: Partial<WizardData>) => {
    setData((prev) => {
      const next = { ...prev, ...patch };
      return next;
    });
  }, []);

  const goTo = useCallback((index: number) => {
    setError("");
    setStepIndex(Math.min(Math.max(index, 0), STEPS.length - 1));
    window.scrollTo({ top: 0, behavior: "smooth" });
  }, []);

  const coupleLabel = useMemo(() => {
    if (data.partnerOneName && data.partnerTwoName) {
      return `${data.partnerOneName} & ${data.partnerTwoName}`;
    }
    return "the happy couple";
  }, [data.partnerOneName, data.partnerTwoName]);

  // ── Step helpers ───────────────────────────────────────────────────────────

  const validateCouple = useCallback((): string => {
    if (!data.partnerOneName.trim()) return "Add the first partner's name.";
    if (!data.partnerTwoName.trim()) return "Add the second partner's name.";
    return "";
  }, [data.partnerOneName, data.partnerTwoName]);

  const createWedding = useCallback(async () => {
    const missing = validateCouple();
    if (missing) {
      setError(missing);
      return null;
    }
    if (!data.weddingDate) {
      setError("Choose the wedding date.");
      return null;
    }

    setBusyMessage("Creating the wedding dossier…");
    setError("");
    try {
      const res = await fetch("/api/weddings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: coupleLabel,
          partnerOneName: data.partnerOneName.trim(),
          partnerTwoName: data.partnerTwoName.trim(),
          weddingDate: data.weddingDate,
          packageCode: data.packageCode,
          customerName: data.customerName.trim() || undefined,
          customerEmail: data.customerEmail.trim() || undefined,
        }),
      });
      const body = (await res.json()) as WeddingsApiResponse;
      if (!res.ok) {
        setError(body.error ?? "Could not create the wedding");
        return null;
      }
      const id = body.wedding?.id;
      if (!id) {
        setError("No wedding id returned");
        return null;
      }
      setWeddingCode(body.wedding?.code ?? "");
      persist(id, data);
      return id;
    } catch {
      setError("Network error while creating the wedding");
      return null;
    } finally {
      setBusyMessage("");
    }
  }, [coupleLabel, data, persist, validateCouple]);

  const patchWedding = useCallback(
    async (patch: Record<string, unknown>): Promise<boolean> => {
      if (!weddingId) return false;
      setBusyMessage("Saving…");
      setError("");
      try {
        const res = await fetch(`/api/weddings/${weddingId}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(patch),
        });
        if (!res.ok) {
          const body = (await res.json().catch(() => ({}))) as { error?: string };
          setError(body.error ?? "Could not save your changes");
          return false;
        }
        return true;
      } catch {
        setError("Network error while saving");
        return false;
      } finally {
        setBusyMessage("");
      }
    },
    [weddingId],
  );

  const startBuild = useCallback(async () => {
    if (!weddingId) return;
    setError("");
    setBusyMessage("Enqueuing the build…");
    setBuildSteps([]);
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
        setError(body.error ?? "Could not start the build");
        return;
      }
      setBuildJobId(body.buildJobId);
    } catch {
      setError("Network error while starting the build");
    } finally {
      setBusyMessage("");
    }
  }, [weddingId]);

  const pollBuild = useCallback(async () => {
    if (!buildJobId) return "failed";
    try {
      const res = await fetch(`/api/build/${buildJobId}`, { cache: "no-store" });
      const body = (await res.json()) as BuildStatusResponse;
      if (!res.ok) return "failed";
      setBuildSteps(body.steps ?? []);
      return body.job?.status ?? "pending";
    } catch {
      return "failed";
    }
  }, [buildJobId]);

  const generateQr = useCallback(async () => {
    if (!weddingId) return;
    setError("");
    setBusyMessage("Generating your QR code…");
    try {
      const res = await fetch("/api/qr/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ weddingId }),
      });
      const body = (await res.json()) as QrGenerateResponse;
      if (!res.ok || !body.targetUrl) {
        setError(body.error ?? "Could not generate the QR code");
        return;
      }
      setQrTargetUrl(body.targetUrl);
      const dataUrl = await QRCode.toDataURL(body.targetUrl, { margin: 1 });
      setQrDataUrl(dataUrl);
    } catch {
      setError("Could not render the QR code");
    } finally {
      setBusyMessage("");
    }
  }, [weddingId]);

  // ── Step transitions ───────────────────────────────────────────────────────

  async function handleNext() {
    setError("");
    switch (step) {
      case "intro":
        goTo(stepIndex + 1);
        return;
      case "couple": {
        const missing = validateCouple();
        if (missing) {
          setError(missing);
          return;
        }
        goTo(stepIndex + 1);
        return;
      }
      case "details": {
        if (!data.weddingDate) {
          setError("Choose the wedding date.");
          return;
        }
        const id = await createWedding();
        if (id) {
          if (!canManage) {
            // Staff can create drafts but cannot build/manage them.
            router.push(`/dashboard/weddings/${id}`);
            return;
          }
          goTo(stepIndex + 1);
        }
        return;
      }
      case "package": {
        const ok = await patchWedding({ packageCode: data.packageCode });
        if (ok) goTo(stepIndex + 1);
        return;
      }
      case "customize": {
        const ok = await patchWedding({
          settings: {
            themeColor: data.themeColor,
            accentColor: data.accentColor,
            coupleStory: data.coupleStory.trim() || null,
            customMessage: data.customMessage.trim() || null,
            allowGuestUploads: data.allowGuestUploads,
            requireApproval: data.requireApproval,
          },
        });
        if (ok) goTo(stepIndex + 1);
        return;
      }
      case "payment":
        goTo(stepIndex + 1);
        return;
      case "build":
        await handleBuildStep();
        return;
      case "preview":
        goTo(stepIndex + 1);
        return;
      default:
        return;
    }
  }

  async function handleBuildStep() {
    if (!buildJobId) {
      await startBuild();
      return;
    }
    const status = await pollBuild();
    if (status === "completed") goTo(stepIndex + 1);
  }

  const packageMeta = PACKAGE_METADATA.find((p) => p.code === data.packageCode);

  // ── Render ─────────────────────────────────────────────────────────────────

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      {/* Step indicator */}
      <nav
        className="flex flex-wrap items-center gap-2"
        aria-label="Wedding creation steps"
      >
        {STEPS.map((s, index) => {
          const active = index === stepIndex;
          const done = index < stepIndex;
          return (
            <button
              key={s.name}
              type="button"
              onClick={() => canManage || index < 3 ? goTo(index) : undefined}
              className={cn(
                "inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-medium transition-colors",
                active
                  ? "bg-zinc-900 text-white dark:bg-zinc-50 dark:text-zinc-900"
                  : done
                    ? "bg-zinc-100 text-zinc-700 dark:bg-zinc-800 dark:text-zinc-300"
                    : "bg-zinc-100 text-zinc-400 dark:bg-zinc-800 dark:text-zinc-500",
              )}
              aria-current={active ? "step" : undefined}
            >
              <span className="h-3.5 w-3.5">{s.icon}</span>
              <span className="hidden sm:inline">{s.label}</span>
              <span className="sm:hidden">{index + 1}</span>
            </button>
          );
        })}
      </nav>

      <Card>
        <CardContent className="py-8">
          {step === "intro" ? (
            <div className="space-y-6 text-center">
              <IconHeart className="mx-auto h-12 w-12 text-rose-400" />
              <div>
                <h1 className="text-2xl font-semibold text-zinc-900 dark:text-zinc-50">
                  Build a wedding memory vault
                </h1>
                <p className="mx-auto mt-2 max-w-md text-sm text-zinc-500 dark:text-zinc-400">
                  We&apos;ll collect the couple&apos;s details, choose a package,
                  customize the look, and publish a guest vault with a QR code —
                  all in a few minutes.
                </p>
              </div>
              <div className="grid gap-3 text-left sm:grid-cols-3">
                {[
                  { title: "Personal vault", text: "A private gallery for photos and videos." },
                  { title: "Guest moments", text: "Guests upload straight from the celebration." },
                  { title: "QR cards", text: "Platinum cards guests scan to join." },
                ].map((feature) => (
                  <div
                    key={feature.title}
                    className="rounded-xl border border-zinc-100 p-4 dark:border-zinc-800"
                  >
                    <p className="text-sm font-medium text-zinc-900 dark:text-zinc-50">
                      {feature.title}
                    </p>
                    <p className="mt-1 text-xs text-zinc-500 dark:text-zinc-400">
                      {feature.text}
                    </p>
                  </div>
                ))}
              </div>
            </div>
          ) : null}

          {step === "couple" ? (
            <div className="space-y-5">
              <div>
                <h2 className="text-lg font-semibold text-zinc-900 dark:text-zinc-50">
                  The happy couple
                </h2>
                <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">
                  These names appear throughout the vault.
                </p>
              </div>
              <div className="grid gap-4 sm:grid-cols-2">
                <div>
                  <Label htmlFor="partner-one">Partner one</Label>
                  <Input
                    id="partner-one"
                    value={data.partnerOneName}
                    onChange={(e) => update({ partnerOneName: e.target.value })}
                    maxLength={120}
                    placeholder="e.g. Thandi"
                  />
                </div>
                <div>
                  <Label htmlFor="partner-two">Partner two</Label>
                  <Input
                    id="partner-two"
                    value={data.partnerTwoName}
                    onChange={(e) => update({ partnerTwoName: e.target.value })}
                    maxLength={120}
                    placeholder="e.g. Sipho"
                  />
                </div>
              </div>
            </div>
          ) : null}

          {step === "details" ? (
            <div className="space-y-5">
              <div>
                <h2 className="text-lg font-semibold text-zinc-900 dark:text-zinc-50">
                  Wedding details
                </h2>
                <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">
                  The date drives upload and download deadlines.
                </p>
              </div>
              <div className="grid gap-4 sm:grid-cols-2">
                <div>
                  <Label htmlFor="wedding-date">Wedding date</Label>
                  <Input
                    id="wedding-date"
                    type="date"
                    value={data.weddingDate}
                    onChange={(e) => update({ weddingDate: e.target.value })}
                    required
                  />
                </div>
                <div>
                  <Label htmlFor="venue">Venue (optional)</Label>
                  <Input
                    id="venue"
                    value={data.venue}
                    onChange={(e) => update({ venue: e.target.value })}
                    maxLength={200}
                    placeholder="e.g. KwaZulu-Natal coast"
                  />
                </div>
                <div>
                  <Label htmlFor="customer-name">Customer name (optional)</Label>
                  <Input
                    id="customer-name"
                    value={data.customerName}
                    onChange={(e) => update({ customerName: e.target.value })}
                    maxLength={200}
                    placeholder="e.g. Thandi's mom"
                  />
                </div>
                <div>
                  <Label htmlFor="customer-email">Customer email (optional)</Label>
                  <Input
                    id="customer-email"
                    type="email"
                    value={data.customerEmail}
                    onChange={(e) => update({ customerEmail: e.target.value })}
                    maxLength={320}
                    placeholder="purchaser@example.com"
                  />
                </div>
              </div>
            </div>
          ) : null}

          {step === "package" ? (
            <div className="space-y-5">
              <div>
                <h2 className="text-lg font-semibold text-zinc-900 dark:text-zinc-50">
                  Choose a package
                </h2>
                <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">
                  Entitlements are enforced server-side by the build engine.
                </p>
              </div>
              <div className="grid gap-4 sm:grid-cols-3">
                {PACKAGE_METADATA.map((pkg) => {
                  const selected = data.packageCode === pkg.code;
                  return (
                    <button
                      key={pkg.code}
                      type="button"
                      onClick={() => update({ packageCode: pkg.code })}
                      className={cn(
                        "rounded-2xl border p-5 text-left transition-colors",
                        selected
                          ? "border-zinc-900 bg-zinc-50 dark:border-zinc-50 dark:bg-zinc-800"
                          : "border-zinc-200 hover:border-zinc-400 dark:border-zinc-700",
                      )}
                      aria-pressed={selected}
                    >
                      <div className="flex items-center justify-between">
                        <span className="text-base font-semibold text-zinc-900 dark:text-zinc-50">
                          {pkg.name}
                        </span>
                        {selected ? (
                          <IconCheck className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
                        ) : null}
                      </div>
                      <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">
                        {formatCurrency(pkg.priceCents, pkg.currency)}
                      </p>
                      <p className="mt-2 text-xs text-zinc-500 dark:text-zinc-400">
                        {pkg.description}
                      </p>
                    </button>
                  );
                })}
              </div>
            </div>
          ) : null}

          {step === "customize" ? (
            <div className="space-y-5">
              <div>
                <h2 className="text-lg font-semibold text-zinc-900 dark:text-zinc-50">
                  Make it yours
                </h2>
                <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">
                  Colours and story appear on the guest vault.
                </p>
              </div>
              <div className="grid gap-4 sm:grid-cols-2">
                <div>
                  <Label htmlFor="theme-color">Theme colour</Label>
                  <Input
                    id="theme-color"
                    type="color"
                    value={data.themeColor}
                    onChange={(e) => update({ themeColor: e.target.value })}
                  />
                </div>
                <div>
                  <Label htmlFor="accent-color">Accent colour</Label>
                  <Input
                    id="accent-color"
                    type="color"
                    value={data.accentColor}
                    onChange={(e) => update({ accentColor: e.target.value })}
                  />
                </div>
              </div>
              <div>
                <Label htmlFor="story">Couple&apos;s story</Label>
                <Textarea
                  id="story"
                  rows={3}
                  maxLength={5000}
                  value={data.coupleStory}
                  onChange={(e) => update({ coupleStory: e.target.value })}
                  placeholder="How did you meet? What makes your day special?"
                />
              </div>
              <div>
                <Label htmlFor="message">Welcome message to guests</Label>
                <Textarea
                  id="message"
                  rows={2}
                  maxLength={5000}
                  value={data.customMessage}
                  onChange={(e) => update({ customMessage: e.target.value })}
                  placeholder="We can't wait to celebrate with you."
                />
              </div>
              <label className="flex items-start gap-3">
                <input
                  type="checkbox"
                  checked={data.allowGuestUploads}
                  onChange={(e) => update({ allowGuestUploads: e.target.checked })}
                  className="mt-1 h-4 w-4"
                />
                <span className="text-sm text-zinc-700 dark:text-zinc-300">
                  Allow guests to upload photos and videos before the upload
                  deadline.
                </span>
              </label>
            </div>
          ) : null}

          {step === "payment" ? (
            <div className="space-y-5">
              <div>
                <h2 className="text-lg font-semibold text-zinc-900 dark:text-zinc-50">
                  Payment
                </h2>
                <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">
                  This wizard is a demonstration — the payment provider
                  integration lives with the billing service.
                </p>
              </div>
              <div className="rounded-2xl border border-zinc-200 p-6 dark:border-zinc-800">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <p className="text-sm text-zinc-500 dark:text-zinc-400">
                      {coupleLabel} · {packageMeta?.name ?? data.packageCode} package
                    </p>
                    <p className="mt-1 text-2xl font-semibold text-zinc-900 dark:text-zinc-50">
                      {formatCurrency(packageMeta?.priceCents ?? 0, "ZAR")}
                    </p>
                  </div>
                  <Badge tone="warning">Demo</Badge>
                </div>
                <p className="mt-4 text-xs text-zinc-400">
                  In production this step redirects to a PayFast/Peach payment,
                  and the build only proceeds after a completed payment is
                  verified server-side.
                </p>
              </div>
            </div>
          ) : null}

          {step === "build" ? (
            <BuildStepPanel
              buildJobId={buildJobId}
              buildSteps={buildSteps}
              busyMessage={busyMessage}
              onStart={startBuild}
              onPoll={pollBuild}
              onCompleted={() => goTo(stepIndex + 1)}
            />
          ) : null}

          {step === "preview" ? (
            <PreviewPanel data={data} coupleLabel={coupleLabel} />
          ) : null}

          {step === "share" ? (
            <SharePanel
              weddingId={weddingId}
              weddingCode={weddingCode}
              qrDataUrl={qrDataUrl}
              qrTargetUrl={qrTargetUrl}
              onGenerateQr={generateQr}
              busyMessage={busyMessage}
              coupleLabel={coupleLabel}
            />
          ) : null}

          {error ? (
            <p
              className="mt-5 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700 dark:bg-red-950/40 dark:text-red-300"
              role="alert"
            >
              {error}
            </p>
          ) : null}
        </CardContent>
      </Card>

      <div className="flex items-center justify-between gap-3">
        <Button
          variant="ghost"
          onClick={() => goTo(stepIndex - 1)}
          disabled={stepIndex === 0 || busyMessage.length > 0}
        >
          Back
        </Button>
        {step !== "share" ? (
          <Button onClick={handleNext} loading={busyMessage.length > 0} rightIcon={<IconArrowRight />}>
            {busyMessage || "Continue"}
          </Button>
        ) : null}
      </div>

      {!canManage ? (
        <p className="rounded-lg bg-amber-50 px-3 py-2 text-sm text-amber-800 dark:bg-amber-950/40 dark:text-amber-200">
          Your role can create wedding dossiers ({organizationName}). Building
          and publishing requires an admin or owner — hand the draft to them to
          continue past the details step.
        </p>
      ) : null}
    </div>
  );
}

// ── Build step panel ─────────────────────────────────────────────────────────

function BuildStepPanel({
  buildJobId,
  buildSteps,
  busyMessage,
  onStart,
  onPoll,
  onCompleted,
}: {
  buildJobId: string | null;
  buildSteps: Array<{ stepKey: string; status: string }>;
  busyMessage: string;
  onStart: () => void;
  onPoll: () => Promise<string>;
  onCompleted: () => void;
}) {
  const [status, setStatus] = useState<string>("idle");
  const [polling, setPolling] = useState(false);

  const begin = useCallback(async () => {
    await onStart();
    setStatus("pending");
    setPolling(true);
  }, [onStart]);

  useEffect(() => {
    if (!polling) return;
    let cancelled = false;
    let polls = 0;

    const tick = async () => {
      if (cancelled) return;
      polls += 1;
      const next = await onPoll();
      if (cancelled) return;
      setStatus(next);
      if (next === "completed") {
        setPolling(false);
        onCompleted();
        return;
      }
      if (next === "failed") {
        setPolling(false);
        return;
      }
      if (polls >= 20) {
        // Worker may not be running; let the user decide.
        setPolling(false);
        return;
      }
      setTimeout(tick, 2000);
    };

    const timer = setTimeout(tick, 2000);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [polling, onPoll, onCompleted]);

  const failed = status === "failed";

  return (
    <div className="space-y-5">
      <div>
        <h2 className="text-lg font-semibold text-zinc-900 dark:text-zinc-50">
          Building your vault
        </h2>
        <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">
          The build engine validates, creates the vault, expiry rules, gallery,
          slideshow/flipbook when entitled, QR, and emails.
        </p>
      </div>

      {!buildJobId ? (
        <Button onClick={begin} loading={busyMessage.length > 0}>
          {busyMessage || "Start the build"}
        </Button>
      ) : (
        <div className="space-y-2">
          {buildSteps.map((s) => (
            <div
              key={s.stepKey}
              className="flex items-center justify-between rounded-lg border border-zinc-100 px-4 py-2.5 text-sm dark:border-zinc-800"
            >
              <span className="text-zinc-700 dark:text-zinc-300">
                {s.stepKey.replaceAll("_", " ")}
              </span>
              <Badge
                tone={
                  s.status === "completed"
                    ? "success"
                    : s.status === "failed"
                      ? "danger"
                      : "neutral"
                }
              >
                {s.status}
              </Badge>
            </div>
          ))}
        </div>
      )}

      {failed ? (
        <div className="rounded-xl bg-red-50 p-4 text-sm text-red-700 dark:bg-red-950/40 dark:text-red-300">
          <p className="font-medium">Build failed</p>
          <p className="mt-1">
            A build requires an order with a completed payment. This wizard does
            not create real orders — verify that a paid order exists for this
            wedding (and that names, date, and template are set) before
            retrying.
          </p>
          <Button variant="outline" size="sm" className="mt-3" onClick={begin}>
            Retry build
          </Button>
        </div>
      ) : null}

      {!failed && buildJobId && status === "pending" && !polling ? (
        <div className="rounded-xl bg-amber-50 p-4 text-sm text-amber-800 dark:bg-amber-950/40 dark:text-amber-200">
          The background worker hasn&apos;t finished yet. You can check the
          build&apos;s progress on the wedding page.
        </div>
      ) : null}
    </div>
  );
}

// ── Preview panel ────────────────────────────────────────────────────────────

function PreviewPanel({ data, coupleLabel }: { data: WizardData; coupleLabel: string }) {
  return (
    <div className="space-y-5">
      <div>
        <h2 className="text-lg font-semibold text-zinc-900 dark:text-zinc-50">
          Preview
        </h2>
        <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">
          A taste of how the guest vault will look.
        </p>
      </div>
      <div
        className="overflow-hidden rounded-2xl border border-zinc-200 dark:border-zinc-800"
        style={{
          borderColor: data.accentColor,
        }}
      >
        <div
          className="px-6 pb-6 pt-12 text-center"
          style={{ backgroundColor: data.themeColor }}
        >
          <p className="text-sm text-white/80">
            {data.weddingDate
              ? new Date(`${data.weddingDate}T12:00:00`).toLocaleDateString("en-ZA", {
                  day: "numeric",
                  month: "long",
                  year: "numeric",
                })
              : ""}
          </p>
          <h3 className="mt-2 text-2xl font-semibold text-white">{coupleLabel}</h3>
          {data.customMessage ? (
            <p className="mx-auto mt-3 max-w-md text-sm text-white/90">
              {data.customMessage}
            </p>
          ) : null}
        </div>
        {data.coupleStory ? (
          <div className="px-6 py-6">
            <p className="text-sm leading-relaxed text-zinc-600 dark:text-zinc-300">
              {data.coupleStory}
            </p>
          </div>
        ) : null}
      </div>
    </div>
  );
}

// ── Share panel ──────────────────────────────────────────────────────────────

function SharePanel({
  weddingId,
  weddingCode,
  qrDataUrl,
  qrTargetUrl,
  onGenerateQr,
  busyMessage,
  coupleLabel,
}: {
  weddingId: string | null;
  weddingCode: string;
  qrDataUrl: string;
  qrTargetUrl: string;
  onGenerateQr: () => void;
  busyMessage: string;
  coupleLabel: string;
}) {
  return (
    <div className="space-y-5">
      <div>
        <h2 className="text-lg font-semibold text-zinc-900 dark:text-zinc-50">
          All set{weddingId ? " — go share it" : ""}
        </h2>
        <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">
          The vault is ready for guests (it becomes fully public once the build
          is completed and the vault is published).
        </p>
      </div>

      <div className="flex flex-col items-center gap-5 sm:flex-row">
        <div
          className="flex h-40 w-40 items-center justify-center rounded-2xl border border-zinc-200 bg-white p-2 dark:border-zinc-800"
          aria-label="QR code preview"
        >
          {qrDataUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={qrDataUrl} alt={`QR code for ${coupleLabel}`} className="h-full w-full" />
          ) : (
            <IconQr className="h-8 w-8 text-zinc-300" />
          )}
        </div>
        <div className="min-w-0 flex-1 space-y-3">
          {!qrDataUrl ? (
            <Button onClick={onGenerateQr} loading={busyMessage.length > 0} leftIcon={<IconQr />}>
              {busyMessage || "Generate the QR code"}
            </Button>
          ) : (
            <>
              <p className="truncate text-sm text-zinc-500 dark:text-zinc-400">
                {qrTargetUrl}
              </p>
              <div className="flex flex-wrap gap-3">
                <Link href={weddingId ? `/dashboard/weddings/${weddingId}` : "/dashboard/weddings"}>
                  <Button variant="outline" leftIcon={<IconArrowRight />}>
                    Wedding dashboard
                  </Button>
                </Link>
                <Button
                  variant="ghost"
                  onClick={() => {
                    if (qrDataUrl) {
                      const link = document.createElement("a");
                      link.href = qrDataUrl;
                      link.download = `qr-${coupleLabel.replace(/[^a-z0-9]+/gi, "-").toLowerCase()}.png`;
                      document.body.appendChild(link);
                      link.click();
                      link.remove();
                    }
                  }}
                >
                  Download QR
                </Button>
              </div>
            </>
          )}
          {weddingCode ? (
            <p className="text-xs text-zinc-400">Reference: {weddingCode}</p>
          ) : null}
          <p className="text-xs text-zinc-400">
            Tip: Platinum packages can generate printable design cards from the
            QR codes page.
          </p>
        </div>
      </div>
    </div>
  );
}