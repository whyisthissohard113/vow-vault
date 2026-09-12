import Link from "next/link";

import { Card } from "@/components/ui/card";
import { PageHeader } from "@/components/ui/page-header";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { IconUsers } from "@/components/icons";
import { EmptyState } from "@/components/ui/empty-state";
import { guardPage } from "@/server/page-guard";
import { listCustomers } from "@/server/services/dashboard-service";
import { Permission } from "@/lib/auth/permissions";
import { formatDate } from "@/lib/format";

export const metadata = { title: "Customers" };

export default async function CustomersPage() {
  const tenant = await guardPage(Permission.VIEW_ORGANIZATION);
  const customers = await listCustomers(tenant.organizationId);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Customers"
        description="Couples and purchasers buying wedding vaults from your company."
      />

      {customers.length === 0 ? (
        <EmptyState
          icon={<IconUsers className="h-8 w-8" />}
          title="No customers yet"
          description="Customers are created the first time a wedding is set up for a couple."
        />
      ) : (
        <Card>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Customer</TableHead>
                <TableHead>Phone</TableHead>
                <TableHead>Orders</TableHead>
                <TableHead>Weddings</TableHead>
                <TableHead>Created</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {customers.map((customer) => (
                <TableRow key={customer.customerId}>
                  <TableCell>
                    <Link
                      href={`/dashboard/customers/${customer.customerId}`}
                      className="font-medium text-zinc-900 hover:underline dark:text-zinc-50"
                    >
                      {customer.fullName}
                    </Link>
                    <p className="text-xs text-zinc-400">{customer.email}</p>
                  </TableCell>
                  <TableCell className="text-zinc-500 dark:text-zinc-400">
                    {customer.phone ?? "—"}
                  </TableCell>
                  <TableCell>{customer.orderCount}</TableCell>
                  <TableCell>{customer.weddingCount}</TableCell>
                  <TableCell className="whitespace-nowrap text-zinc-500 dark:text-zinc-400">
                    {formatDate(customer.createdAt)}
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