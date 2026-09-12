import Link from "next/link";

import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
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
import { Button } from "@/components/ui/button";
import { IconPlus, IconWedding } from "@/components/icons";
import { guardPage } from "@/server/page-guard";
import { listWeddings } from "@/server/services/dashboard-service";
import { hasPermission, Permission } from "@/lib/auth/permissions";
import { formatCalendarDate, formatDate } from "@/lib/format";

export const metadata = { title: "Weddings" };

export default async function WeddingsPage() {
  const tenant = await guardPage(Permission.VIEW_WEDDING);
  const weddings = await listWeddings(tenant.organizationId);
  const canCreate = hasPermission(tenant.role, Permission.CREATE_WEDDING);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Weddings"
        description="Every wedding dossier managed by your company."
        actions={
          canCreate ? (
            <Link href="/dashboard/weddings/new">
              <Button variant="primary" leftIcon={<IconPlus />}>
                New wedding
              </Button>
            </Link>
          ) : null
        }
      />

      {weddings.length === 0 ? (
        <Card>
          <CardContent className="py-12">
            <div className="flex flex-col items-center text-center">
              <IconWedding className="mb-3 h-8 w-8 text-zinc-300 dark:text-zinc-600" />
              <h3 className="text-base font-semibold text-zinc-900 dark:text-zinc-50">
                No weddings yet
              </h3>
              <p className="mt-1 max-w-sm text-sm text-zinc-500 dark:text-zinc-400">
                Create your first wedding vault to start collecting memories.
              </p>
              {canCreate ? (
                <Link href="/dashboard/weddings/new" className="mt-5">
                  <Button leftIcon={<IconPlus />}>Create wedding</Button>
                </Link>
              ) : null}
            </div>
          </CardContent>
        </Card>
      ) : (
        <Card>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Wedding</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Date</TableHead>
                <TableHead>Package</TableHead>
                <TableHead>Customer</TableHead>
                <TableHead>Created</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {weddings.map((wedding) => (
                <TableRow key={wedding.weddingId}>
                  <TableCell>
                    <Link
                      href={`/dashboard/weddings/${wedding.weddingId}`}
                      className="font-medium text-zinc-900 hover:underline dark:text-zinc-50"
                    >
                      {wedding.name}
                    </Link>
                    <span className="ml-2 text-xs text-zinc-400">{wedding.code}</span>
                    {wedding.mediaCount > 0 ? (
                      <p className="mt-0.5 text-xs text-zinc-500 dark:text-zinc-400">
                        {wedding.mediaCount} media · {wedding.guestSessionCount} guest
                        sessions · {wedding.qrCodeCount} QR
                      </p>
                    ) : null}
                  </TableCell>
                  <TableCell>
                    <StatusBadge status={wedding.status} />
                  </TableCell>
                  <TableCell className="whitespace-nowrap text-zinc-500 dark:text-zinc-400">
                    {formatCalendarDate(wedding.weddingDate)}
                  </TableCell>
                  <TableCell>
                    {wedding.packageName ? (
                      <Badge tone="brand">{wedding.packageName}</Badge>
                    ) : (
                      <span className="text-zinc-400">—</span>
                    )}
                  </TableCell>
                  <TableCell>
                    <p className="text-zinc-700 dark:text-zinc-300">
                      {wedding.customerName}
                    </p>
                    <p className="text-xs text-zinc-400">{wedding.customerEmail}</p>
                  </TableCell>
                  <TableCell className="whitespace-nowrap text-zinc-500 dark:text-zinc-400">
                    {formatDate(wedding.createdAt)}
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