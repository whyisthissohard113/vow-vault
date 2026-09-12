import { Card, CardContent } from "@/components/ui/card";
import { PageHeader } from "@/components/ui/page-header";
import { IconSettings } from "@/components/icons";
import { EmptyState } from "@/components/ui/empty-state";
import { guardPage } from "@/server/page-guard";
import { Permission } from "@/lib/auth/permissions";

export const metadata = { title: "Settings" };

export default async function SettingsPage() {
  await guardPage(Permission.MANAGE_ORGANIZATION_SETTINGS);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Organization settings"
        description="Manage your company profile, branding, and preferences."
      />

      <EmptyState
        icon={<IconSettings className="h-8 w-8" />}
        title="Settings editor is coming soon"
        description="Company profile, payment details, feature toggles and notification preferences will live here in a future release. Existing configuration remains protected server-side."
      />

      <Card>
        <CardContent className="text-sm text-zinc-500 dark:text-zinc-400">
          <p>
            Only roles with <code className="rounded bg-zinc-100 px-1.5 py-0.5 text-xs dark:bg-zinc-800">manage_organization_settings</code>{" "}
            can reach this page — the navigation and page guard enforce that
            server-side.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}