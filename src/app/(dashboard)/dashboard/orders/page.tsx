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
import { IconOrder } from "@/components/icons";
import { EmptyState } from "@/components/ui/empty-state";
import { guardPage } from "@/server/page-guard";
import { listOrders } from "@/server/services/dashboard-service";
import { Permission } from "@/lib/auth/permissions";
import { formatCurrency, formatDateTime } from "@/lib/format";

export const metadata = { title: "Orders" };

export default async function OrdersPage() {
  const tenant = await guardPage(Permission.VIEW_PAYMENTS);
  const orders = await listOrders(tenant.organizationId);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Orders"
        description="Package purchases recorded for your company. Only owners can view revenue data."
      />

      {orders.length === 0 ? (
        <EmptyState
          icon={<IconOrder className="h-8 w-8" />}
          title="No orders yet"
          description="Orders appear after a couple completes payment for a package."
        />
      ) : (
        <Card>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Order</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Payment</TableHead>
                <TableHead>Product</TableHead>
                <TableHead>Customer</TableHead>
                <TableHead>Total</TableHead>
                <TableHead>Placed</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {orders.map((order) => (
                <TableRow key={order.orderId}>
                  <TableCell className="font-medium text-zinc-900 dark:text-zinc-50">
                    {order.orderNumber}
                  </TableCell>
                  <TableCell>
                    <StatusBadge status={order.status} />
                  </TableCell>
                  <TableCell>
                    <StatusBadge status={order.paymentStatus} />
                  </TableCell>
                  <TableCell>
                    {order.productName ?? <span className="text-zinc-400">—</span>}
                  </TableCell>
                  <TableCell>
                    <p className="text-zinc-700 dark:text-zinc-300">
                      {order.customerName}
                    </p>
                    <p className="text-xs text-zinc-400">{order.customerEmail}</p>
                  </TableCell>
                  <TableCell className="font-medium">
                    {formatCurrency(order.totalCents, order.currency)}
                  </TableCell>
                  <TableCell className="whitespace-nowrap text-zinc-500 dark:text-zinc-400">
                    {formatDateTime(order.placedAt)}
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