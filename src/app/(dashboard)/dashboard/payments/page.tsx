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
import { IconCard } from "@/components/icons";
import { EmptyState } from "@/components/ui/empty-state";
import { guardPage } from "@/server/page-guard";
import { listPayments } from "@/server/services/dashboard-service";
import { Permission } from "@/lib/auth/permissions";
import { formatCurrency, formatDateTime } from "@/lib/format";

export const metadata = { title: "Payments" };

export default async function PaymentsPage() {
  const tenant = await guardPage(Permission.VIEW_PAYMENTS);
  const payments = await listPayments(tenant.organizationId);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Payments"
        description="Payment attempts across all of your orders."
      />

      {payments.length === 0 ? (
        <EmptyState
          icon={<IconCard className="h-8 w-8" />}
          title="No payments yet"
          description="Payments appear once orders go through the payment provider."
        />
      ) : (
        <Card>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Order</TableHead>
                <TableHead>Provider</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Amount</TableHead>
                <TableHead>Customer</TableHead>
                <TableHead>Paid</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {payments.map((payment) => (
                <TableRow key={payment.paymentId}>
                  <TableCell className="font-medium text-zinc-900 dark:text-zinc-50">
                    {payment.orderNumber}
                  </TableCell>
                  <TableCell className="capitalize">{payment.provider}</TableCell>
                  <TableCell>
                    <StatusBadge status={payment.status} />
                    {payment.failureReason ? (
                      <p className="mt-1 max-w-[220px] truncate text-xs text-red-600 dark:text-red-400">
                        {payment.failureReason}
                      </p>
                    ) : null}
                  </TableCell>
                  <TableCell className="font-medium">
                    {formatCurrency(payment.amountCents, payment.currency)}
                  </TableCell>
                  <TableCell className="text-zinc-700 dark:text-zinc-300">
                    {payment.customerName}
                  </TableCell>
                  <TableCell className="whitespace-nowrap text-zinc-500 dark:text-zinc-400">
                    {formatDateTime(payment.paidAt ?? payment.createdAt)}
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