import { Card } from "@/components/ui/card";
import { PageHeader } from "@/components/ui/page-header";
import { StatusBadge } from "@/components/ui/status-badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { IconMedia } from "@/components/icons";
import { EmptyState } from "@/components/ui/empty-state";
import { guardPage } from "@/server/page-guard";
import { listMedia } from "@/server/services/dashboard-service";
import { Permission } from "@/lib/auth/permissions";
import { formatBytes, formatDateTime } from "@/lib/format";

export const metadata = { title: "Media" };

export default async function MediaPage() {
  const tenant = await guardPage(Permission.VIEW_VAULT);
  const mediaItems = await listMedia(tenant.organizationId);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Media"
        description="Photos and videos uploaded to your vaults. Files are served to guests through signed, expiring URLs."
      />

      {mediaItems.length === 0 ? (
        <EmptyState
          icon={<IconMedia className="h-8 w-8" />}
          title="No media yet"
          description="Media appears here once guests or staff upload photos and videos to a vault."
        />
      ) : (
        <Card>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>File</TableHead>
                <TableHead>Type</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Size</TableHead>
                <TableHead>Uploaded</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {mediaItems.map((item) => (
                <TableRow key={item.publicId}>
                  <TableCell className="max-w-[280px]">
                    <p className="truncate font-medium text-zinc-900 dark:text-zinc-50">
                      {item.filename}
                    </p>
                    <p className="truncate text-xs text-zinc-400">{item.publicId}</p>
                  </TableCell>
                  <TableCell className="capitalize">{item.kind}</TableCell>
                  <TableCell>
                    <StatusBadge status={item.status} />
                  </TableCell>
                  <TableCell>{formatBytes(item.sizeBytes)}</TableCell>
                  <TableCell className="whitespace-nowrap text-zinc-500 dark:text-zinc-400">
                    {formatDateTime(item.createdAt)}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </Card>
      )}
    </div>
  );
}