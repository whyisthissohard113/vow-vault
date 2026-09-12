import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";

import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { PageHeader } from "@/components/ui/page-header";
import { StatusBadge } from "@/components/ui/status-badge";
import { Button } from "@/components/ui/button";
import { IconEye, IconLink, IconQr } from "@/components/icons";
import { serverUrl } from "@/server/public-url";
import { guardPage } from "@/server/page-guard";
import {
  formatDeadline,
  getWeddingDetail,
} from "@/server/services/dashboard-service";
import { hasPermission, Permission } from "@/lib/auth/permissions";
import {
  formatCurrency,
  formatCalendarDate,
  formatDateTime,
  formatBytes,
} from "@/lib/format";
import { BuildWeddingButton } from "./build-button";

export const metadata: Metadata = {
  title: "Wedding details",
};

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <dt className="text-xs font-medium uppercase tracking-wider text-zinc-400">
        {label}
      </dt>
      <dd className="mt-1 text-sm text-zinc-800 dark:text-zinc-200">{children}</dd>
    </div>
  );
}

export default async function WeddingDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const tenant = await guardPage(Permission.VIEW_WEDDING);
  const { id } = await params;

  const detail = await getWeddingDetail(tenant.organizationId, id);
  if (!detail) notFound();

  const canManage = hasPermission(tenant.role, Permission.MANAGE_WEDDING);
  const vaultUrl = detail.vault?.slug
    ? `${serverUrl()}/w/${detail.vault.slug}`
    : null;

  const coupleName =
    detail.partnerOneName && detail.partnerTwoName
      ? `${detail.partnerOneName} & ${detail.partnerTwoName}`
      : detail.name;

  return (
    <div className="space-y-8">
      <PageHeader
        title={coupleName}
        description={
          <span className="flex flex-wrap items-center gap-2">
            {detail.code}
            <StatusBadge status={detail.status} />
            {detail.weddingDate ? (
              <span>· {formatCalendarDate(detail.weddingDate)}</span>
            ) : null}
          </span>
        }
        actions={
          <div className="flex flex-wrap items-center gap-3">
            {vaultUrl ? (
              <Link href={vaultUrl} target="_blank" rel="noopener noreferrer">
                <Button variant="outline" leftIcon={<IconEye />}>
                  View vault
                </Button>
              </Link>
            ) : null}
            {canManage ? <BuildWeddingButton weddingId={detail.weddingId} /> : null}
          </div>
        }
      />

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader title="Wedding details" />
          <CardContent>
            <dl className="grid gap-4 sm:grid-cols-2">
              <Field label="Couple">{(detail.partnerOneName ?? "—") + " & " + (detail.partnerTwoName ?? "—")}</Field>
              <Field label="Wedding date">{formatCalendarDate(detail.weddingDate)}</Field>
              <Field label="Timezone">{detail.timezone}</Field>
              <Field label="Package">
                {detail.package ? (
                  <span className="flex items-center gap-2">
                    <Badge tone="brand">{detail.package.name}</Badge>
                    <span className="text-xs text-zinc-400">
                      {formatCurrency(detail.package.priceCents, detail.package.currency)}
                    </span>
                  </span>
                ) : (
                  <span className="text-zinc-400">Not assigned yet</span>
                )}
              </Field>
            </dl>
          </CardContent>
        </Card>

        <Card>
          <CardHeader title="Customer" />
          <CardContent>
            {detail.customer ? (
              <dl className="grid gap-4 sm:grid-cols-2">
                <Field label="Name">
                  <Link
                    href={`/dashboard/customers/${detail.customer.id}`}
                    className="font-medium text-zinc-900 hover:underline dark:text-zinc-50"
                  >
                    {detail.customer.fullName}
                  </Link>
                </Field>
                <Field label="Email">{detail.customer.email}</Field>
                <Field label="Phone">{detail.customer.phone ?? "—"}</Field>
              </dl>
            ) : (
              <p className="text-sm text-zinc-400">No customer linked.</p>
            )}
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader
            title="Vault & expiry"
            description="Deadlines are calculated in Africa/Johannesburg from the wedding date."
          />
          <CardContent>
            <dl className="grid gap-4 sm:grid-cols-2">
              <Field label="Vault">
                {detail.vault ? (
                  <span className="flex flex-wrap items-center gap-2">
                    <Badge tone={detail.vault.status === "published" ? "success" : "neutral"}>
                      {detail.vault.status}
                    </Badge>
                    <span className="text-xs text-zinc-500 dark:text-zinc-400">
                      /w/{detail.vault.slug}
                    </span>
                  </span>
                ) : (
                  <span className="text-zinc-400">Not built yet</span>
                )}
              </Field>
              <Field label="Guest uploads">
                {detail.settings ? (
                  detail.settings.allowGuestUploads ? "Allowed" : "Disabled"
                ) : (
                  "—"
                )}
              </Field>
              <Field label="Upload deadline">
                {detail.expiry ? formatDeadline(detail.expiry.uploadDeadline) : "—"}
              </Field>
              <Field label="Download deadline">
                {detail.expiry ? formatDeadline(detail.expiry.downloadDeadline) : "—"}
              </Field>
            </dl>
          </CardContent>
        </Card>

        <Card>
          <CardHeader title="QR codes" action={<IconQr className="h-5 w-5 text-zinc-300" />} />
          <CardContent>
            {detail.qrCodes.length === 0 ? (
              <p className="text-sm text-zinc-400">
                No QR code yet — it is generated automatically during a Platinum
                build, or via the QR page.
              </p>
            ) : (
              <ul className="space-y-3">
                {detail.qrCodes.map((qr) => (
                  <li
                    key={qr.id}
                    className="flex items-center justify-between gap-3 rounded-lg border border-zinc-100 px-4 py-3 dark:border-zinc-800"
                  >
                    <div className="min-w-0">
                      <p className="flex items-center gap-2 text-sm font-medium text-zinc-900 dark:text-zinc-50">
                        <IconLink className="h-4 w-4 text-zinc-400" />
                        <span className="truncate">{qr.targetUrl ?? qr.publicId}</span>
                      </p>
                      <p className="mt-0.5 text-xs text-zinc-400">
                        Generated {formatDateTime(qr.generatedAt)}
                        {qr.expiresAt ? ` · expires ${formatDateTime(qr.expiresAt)}` : ""}
                      </p>
                    </div>
                    <StatusBadge status={qr.status} />
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader
          title="Build jobs"
          description="Background pipeline that creates the gallery, slideshow, flipbook, QR and expiry rules."
        />
        <CardContent>
          {detail.buildJobs.length === 0 ? (
            <p className="text-sm text-zinc-400">
              No builds yet. Click “Build vault” to start the pipeline.
            </p>
          ) : (
            <ul className="space-y-4">
              {detail.buildJobs.map((job) => (
                <li
                  key={job.id}
                  className="rounded-lg border border-zinc-100 p-4 dark:border-zinc-800"
                >
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <p className="flex items-center gap-2 text-sm font-medium text-zinc-900 dark:text-zinc-50">
                      Build v{job.version}
                      <span className="text-xs text-zinc-400">
                        attempts {job.attempts}/{job.maxAttempts}
                      </span>
                    </p>
                    <StatusBadge status={job.status} />
                  </div>
                  {job.steps.length > 0 ? (
                    <ol className="mt-3 space-y-1.5">
                      {job.steps.map((step) => (
                        <li
                          key={step.stepKey}
                          className="flex items-center justify-between gap-3 text-xs"
                        >
                          <span className="flex items-center gap-2 text-zinc-600 dark:text-zinc-400">
                            <span className="text-zinc-400">{step.stepOrder}.</span>
                            {step.stepKey.replaceAll("_", " ")}
                          </span>
                          <StatusBadge status={step.status} />
                        </li>
                      ))}
                    </ol>
                  ) : null}
                  {job.errorMessage ? (
                    <p className="mt-2 rounded-lg bg-red-50 px-3 py-2 text-xs text-red-700 dark:bg-red-950/40 dark:text-red-300">
                      {job.errorMessage}
                    </p>
                  ) : null}
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader
          title="Media"
          description="Files uploaded for this wedding (previews are available to guests on the vault)."
        />
        <CardContent>
          {detail.media.length === 0 ? (
            <p className="text-sm text-zinc-400">No media uploaded yet.</p>
          ) : (
            <ul className="divide-y divide-zinc-100 dark:divide-zinc-800">
              {detail.media.map((item) => (
                <li
                  key={item.publicId}
                  className="flex items-center justify-between gap-3 py-3"
                >
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium text-zinc-800 dark:text-zinc-200">
                      {item.filename}
                    </p>
                    <p className="text-xs text-zinc-400">
                      {item.kind} · {formatBytes(item.sizeBytes)} ·{" "}
                      {formatDateTime(item.createdAt)}
                    </p>
                  </div>
                  <StatusBadge status={item.status} />
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>
    </div>
  );
}