import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";

import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { PageHeader } from "@/components/ui/page-header";
import { StatusBadge } from "@/components/ui/status-badge";
import {
  Table,
  TableBody,
  TableCell,
  TableEmpty,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { guardPage } from "@/server/page-guard";
import { getCustomerDetail } from "@/server/services/dashboard-service";
import { Permission } from "@/lib/auth/permissions";
import { formatCalendarDate, formatCurrency, formatDate } from "@/lib/format";

export const metadata: Metadata = { title: "Customer details" };

export default async function CustomerDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const tenant = await guardPage(Permission.VIEW_ORGANIZATION);
  const { id } = await params;

  const detail = await getCustomerDetail(tenant.organizationId, id);
  if (!detail) notFound();

  return (
    <div className="space-y-8">
      <PageHeader
        title={detail.fullName}
        description={
          <span className="flex flex-wrap items-center gap-2">
            {detail.email}
            {detail.phone ? <span>· {detail.phone}</span> : null}
          </span>
        }
      />

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader
            title="Weddings"
            description="Vaults set up for this customer."
          />
          <CardContent>
            {detail.weddings.length === 0 ? (
              <p className="text-sm text-zinc-400">No weddings linked yet.</p>
            ) : (
              <ul className="space-y-3">
                {detail.weddings.map((wedding) => (
                  <li key={wedding.weddingId}>
                    <Link
                      href={`/dashboard/weddings/${wedding.weddingId}`}
                      className="rounded-lg border border-zinc-100 px-4 py-3 transition-colors hover:bg-zinc-50 dark:border-zinc-800 dark:hover:bg-zinc-900/50"
                    >
                      <span className="flex items-center justify-between gap-3">
                        <span className="font-medium text-zinc-900 dark:text-zinc-50">
                          {wedding.name}
                        </span>
                        <StatusBadge status={wedding.status} />
                      </span>
                      <span className="mt-1 block text-xs text-zinc-400">
                        {wedding.code} · {formatCalendarDate(wedding.weddingDate)}
                        {wedding.packageCode ? ` · ${wedding.packageCode}` : ""}
                      </span>
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader title="Orders" description="Purchases made by this customer." />
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Order</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Total</TableHead>
                <TableHead>Placed</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {detail.orders.length === 0 ? (
                <TableEmpty colSpan={4}>No orders yet</TableEmpty>
              ) : (
                detail.orders.map((order) => (
                  <TableRow key={order.orderId}>
                    <TableCell>
                      <p className="font-medium text-zinc-900 dark:text-zinc-50">
                        {order.orderNumber}
                      </p>
                      {order.productName ? (
                        <p className="text-xs text-zinc-400">{order.productName}</p>
                      ) : null}
                    </TableCell>
                    <TableCell>
                      <StatusBadge status={order.status} />
                      {order.status === "paid" ? <Badge tone="success">paid</Badge> : null}
                    </TableCell>
                    <TableCell>{formatCurrency(order.totalCents, order.currency)}</TableCell>
                    <TableCell className="whitespace-nowrap text-zinc-500 dark:text-zinc-400">
                      {formatDate(order.placedAt)}
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </Card>
      </div>
    </div>
  );
}