import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { PageHeader } from "@/components/ui/page-header";
import { IconCheck, IconPlus } from "@/components/icons";
import {
  getPackageExpiryWindows,
  getPackageFeatures,
  PACKAGE_METADATA,
} from "@/lib/entitlements/packages";
import { formatCurrency } from "@/lib/format";
import { guardPage } from "@/server/page-guard";
import { Permission } from "@/lib/auth/permissions";

export const metadata = { title: "Packages" };

const FEATURE_LABELS: Record<string, string> = {
  photos: "Photo gallery",
  guest_uploads: "Guest uploads",
  video: "Video gallery",
  banner: "Banner design",
  intro: "Intro video",
  slideshow: "Slideshow",
  flipbook: "Flipbook",
  custom_qr: "Custom QR code",
  qr_design_card: "QR design cards",
  optional_colours: "Optional colours",
  names_date: "Couple names & date",
};

function featureRows(packageCode: "silver" | "gold" | "platinum"): Array<{
  label: string;
  value: string;
}> {
  const features = getPackageFeatures(packageCode);
  const rows: Array<{ label: string; value: string }> = [];

  for (const key of Object.keys(FEATURE_LABELS)) {
    const value = features[key];
    if (value !== true) continue;
    rows.push({ label: FEATURE_LABELS[key] ?? key, value: "Included" });
  }

  const maxPhotos = features.max_photos;
  rows.push({
    label: "Photo limit",
    value:
      typeof maxPhotos === "number" && maxPhotos > 0
        ? `${maxPhotos} fair-use photos`
        : "Unlimited fair-use photos",
  });

  const maxVideos = features.max_videos;
  rows.push({
    label: "Video limit",
    value:
      typeof maxVideos === "number" && maxVideos === -1
        ? "Unlimited fair-use videos"
        : `${maxVideos} videos`,
  });

  const expiry = getPackageExpiryWindows(packageCode);
  rows.push({
    label: "Guest upload window",
    value: `Closes ${expiry.uploadDays} days after the wedding`,
  });
  rows.push({
    label: "Download window",
    value: `Open for ${expiry.downloadDays} days after the wedding`,
  });

  return rows;
}

export default async function PackagesPage() {
  await guardPage(Permission.VIEW_ORGANIZATION);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Packages"
        description="Package tiers available for new weddings. Entitlements are enforced server-side by the build engine and expiry service."
      />

      <div className="grid gap-6 lg:grid-cols-3">
        {PACKAGE_METADATA.map((pkg) => {
          const code = pkg.code as "silver" | "gold" | "platinum";
          return (
            <Card key={pkg.code} className="flex flex-col">
              <CardContent className="flex-1">
                <div className="flex items-center justify-between">
                  <h2 className="text-lg font-semibold text-zinc-900 dark:text-zinc-50">
                    {pkg.name}
                  </h2>
                  {pkg.code === "platinum" ? <Badge tone="brand">Most popular</Badge> : null}
                </div>
                <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">
                  {pkg.description}
                </p>
                <p className="mt-4 text-2xl font-semibold text-zinc-900 dark:text-zinc-50">
                  {formatCurrency(pkg.priceCents, pkg.currency)}
                  <span className="text-sm font-normal text-zinc-400"> / wedding</span>
                </p>

                <ul className="mt-6 space-y-2.5">
                  {featureRows(code).map((row) => (
                    <li key={row.label} className="flex items-start gap-2 text-sm">
                      <IconCheck className="mt-0.5 h-4 w-4 shrink-0 text-emerald-600 dark:text-emerald-400" />
                      <span className="text-zinc-700 dark:text-zinc-300">
                        <span className="font-medium">{row.label}:</span>{" "}
                        <span className="text-zinc-500 dark:text-zinc-400">{row.value}</span>
                      </span>
                    </li>
                  ))}
                </ul>
              </CardContent>
            </Card>
          );
        })}
      </div>

      <p className="flex items-center gap-2 text-sm text-zinc-500 dark:text-zinc-400">
        <IconPlus className="h-4 w-4" />
        Pricing is configured in the catalog; this page reflects the platform
        defaults.
      </p>
    </div>
  );
}