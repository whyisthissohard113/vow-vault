import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { PageHeader } from "@/components/ui/page-header";
import { StatusBadge } from "@/components/ui/status-badge";
import { guardPage } from "@/server/page-guard";
import { getProfile } from "@/server/services/dashboard-service";
import { formatDate } from "@/lib/format";

export const metadata = { title: "Account" };

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

export default async function AccountPage() {
  const tenant = await guardPage();
  const profile = await getProfile(tenant.userId);

  if (!profile) {
    return (
      <PageHeader
        title="Account"
        description="Your profile could not be loaded. Sign out and back in to refresh."
      />
    );
  }

  return (
    <div className="space-y-8">
      <PageHeader title="Account" description="Your profile and organization memberships." />

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader title="Profile" />
          <CardContent>
            <dl className="grid gap-4 sm:grid-cols-2">
              <Field label="Name">{profile.fullName ?? "—"}</Field>
              <Field label="Email">{profile.email}</Field>
              <Field label="Member since">{formatDate(profile.createdAt)}</Field>
            </dl>
          </CardContent>
        </Card>

        <Card>
          <CardHeader title="Memberships" description="Companies you belong to." />
          <CardContent>
            <ul className="space-y-3">
              {profile.memberships.map((membership) => (
                <li
                  key={membership.organizationId}
                  className="flex items-center justify-between gap-3 rounded-lg border border-zinc-100 px-4 py-3 dark:border-zinc-800"
                >
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium text-zinc-900 dark:text-zinc-50">
                      {membership.organizationName}
                    </p>
                    <p className="truncate text-xs text-zinc-400">
                      {membership.organizationSlug}
                    </p>
                  </div>
                  <StatusBadge status={membership.role} />
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}