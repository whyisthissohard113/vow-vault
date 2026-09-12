import { Card, CardContent } from "@/components/ui/card";
import { PageHeader } from "@/components/ui/page-header";
import { IconSupport } from "@/components/icons";
import { EmptyState } from "@/components/ui/empty-state";
import { guardPage } from "@/server/page-guard";
import { listSupportTickets } from "@/server/services/dashboard-service";

export const metadata = { title: "Support" };

export default async function SupportPage() {
  await guardPage();
  const tickets = await listSupportTickets();

  return (
    <div className="space-y-6">
      <PageHeader
        title="Support"
        description="Tickets filed for your company and its weddings."
      />

      {tickets.length === 0 ? (
        <EmptyState
          icon={<IconSupport className="h-8 w-8" />}
          title="No support tickets"
          description="When a ticket is filed, it will appear here. Reach out to support@weddingmemoryvault.app any time."
        />
      ) : (
        <Card>
          <CardContent>
            <p className="text-sm text-zinc-500 dark:text-zinc-400">
              Ticket list will render here when the support module ships.
            </p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}