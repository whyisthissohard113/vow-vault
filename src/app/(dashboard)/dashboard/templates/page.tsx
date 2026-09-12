import { Card, CardContent } from "@/components/ui/card";
import { PageHeader } from "@/components/ui/page-header";
import { IconTemplate } from "@/components/icons";
import { EmptyState } from "@/components/ui/empty-state";
import { guardPage } from "@/server/page-guard";
import { Permission } from "@/lib/auth/permissions";

export const metadata = { title: "Templates" };

export default async function TemplatesPage() {
  await guardPage(Permission.VIEW_WEDDING);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Templates"
        description="Visual templates applied to vaults during the build."
      />

      <EmptyState
        icon={<IconTemplate className="h-8 w-8" />}
        title="Template gallery is coming soon"
        description="The build engine records the template reference on each vault. A full template gallery and editor are planned for a future release."
      />

      <Card>
        <CardContent className="text-sm text-zinc-500 dark:text-zinc-400">
          <p>
            During a build, the engine applies the latest published version of
            the wedding&apos;s template. Rendering happens at guest-page load
            time; the dashboard records which template and version were used.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}