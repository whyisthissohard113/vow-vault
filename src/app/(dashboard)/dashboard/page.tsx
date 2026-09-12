import Link from "next/link";

import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { PageHeader } from "@/components/ui/page-header";
import { StatCard } from "@/components/ui/stat-card";
import { guardPage } from "@/server/page-guard";
import { getDashboardOverview } from "@/server/services/dashboard-service";
import { formatDate } from "@/lib/format";

export const metadata = { title: "Overview" };

export default async function DashboardPage() {
  const tenant = await guardPage();
  const overview = await getDashboardOverview(tenant.organizationId);

  return (
    <div className="space-y-8">
      <PageHeader
        title="Overview"
        description="A snapshot of your wedding vaults and guest activity."
      />

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard label="Weddings" value={overview.weddings} />
        <StatCard
          label="Active vaults"
          value={overview.active}
          hint={`${overview.building} building`}
        />
        <StatCard label="Draft weddings" value={overview.draft} />
        <StatCard
          label="Guest uploads"
          value={overview.guestUploads}
          hint={`${overview.totalGuests} guest sessions`}
        />
      </div>

      <Card>
        <CardContent className="flex items-center justify-between gap-3">
          <p className="text-sm font-medium text-zinc-900 dark:text-zinc-50">
            Media uploaded this month
          </p>
          <p className="text-sm text-zinc-500 dark:text-zinc-400">
            {overview.mediaCountThisMonth} items
          </p>
        </CardContent>
      </Card>

      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold text-zinc-900 dark:text-zinc-50">
            Expiring soon
          </h2>
          <Link
            href="/dashboard/weddings"
            className="text-sm font-medium text-zinc-500 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-100"
          >
            View all →
          </Link>
        </div>

        {overview.expiringSoon.length === 0 ? (
          <Card>
            <CardContent>
              <p className="text-sm text-zinc-500 dark:text-zinc-400">
                No vaults are within 30 days of their download deadline.
              </p>
            </CardContent>
          </Card>
        ) : (
          <Card>
            <div className="divide-y divide-zinc-100 dark:divide-zinc-800">
              {overview.expiringSoon.map((wedding) => (
                <Link
                  key={wedding.weddingId}
                  href={`/dashboard/weddings/${wedding.weddingId}`}
                  className="flex flex-wrap items-center justify-between gap-3 px-6 py-4 transition-colors hover:bg-zinc-50 dark:hover:bg-zinc-900/50"
                >
                  <div>
                    <p className="text-sm font-medium text-zinc-900 dark:text-zinc-50">
                      {wedding.partnerOne && wedding.partnerTwo
                        ? `${wedding.partnerOne} & ${wedding.partnerTwo}`
                        : "Unnamed wedding"}
                    </p>
                    <p className="text-xs text-zinc-500 dark:text-zinc-400">
                      {wedding.packageCode} · download closes{" "}
                      {formatDate(wedding.downloadDeadline)}
                    </p>
                  </div>
                  <Badge tone={wedding.daysLeft <= 7 ? "danger" : "warning"}>
                    {wedding.daysLeft} days left
                  </Badge>
                </Link>
              ))}
            </div>
          </Card>
        )}
      </div>
    </div>
  );
}