import { PageHeader } from "@/components/ui/page-header";
import { EmptyState } from "@/components/ui/empty-state";
import { IconQr } from "@/components/icons";
import { guardPage } from "@/server/page-guard";
import { listQrCodes, listWeddings } from "@/server/services/dashboard-service";
import { hasPermission, Permission } from "@/lib/auth/permissions";
import { QrActions } from "./qr-actions";

export const metadata = { title: "QR codes" };

export default async function QrCodesPage() {
  const tenant = await guardPage(Permission.VIEW_VAULT);
  const [qrCodes, weddings] = await Promise.all([
    listQrCodes(tenant.organizationId),
    listWeddings(tenant.organizationId),
  ]);
  const canManage = hasPermission(tenant.role, Permission.MANAGE_WEDDING);

  const weddingOptions = weddings.map((w) => ({
    weddingId: w.weddingId,
    name: w.name,
  }));

  return (
    <div className="space-y-6">
      <PageHeader
        title="QR codes"
        description="QR codes point guests to the public vault. Platinum packages can generate printable design cards."
      />

      {qrCodes.length === 0 && weddingOptions.length === 0 ? (
        <EmptyState
          icon={<IconQr className="h-8 w-8" />}
          title="No weddings to generate QR codes for"
          description="Create a wedding first — its QR code is generated during the build or here."
        />
      ) : (
        <QrActions
          qrCodes={qrCodes.map((qr) => ({
            id: qr.id,
            status: qr.status,
            weddingName: qr.weddingName,
            packageCode: qr.packageCode,
          }))}
          weddingOptions={weddingOptions}
          canManage={canManage}
        />
      )}
    </div>
  );
}