import type { Metadata } from "next";

import { guardPage } from "@/server/page-guard";
import { hasPermission, Permission } from "@/lib/auth/permissions";
import { WeddingWizard } from "./wedding-wizard";

export const metadata: Metadata = {
  title: "Create wedding",
  robots: { index: false, follow: false },
};

export default async function NewWeddingPage() {
  const tenant = await guardPage(Permission.CREATE_WEDDING);
  const canManage = hasPermission(tenant.role, Permission.MANAGE_WEDDING);

  return (
    <WeddingWizard
      canManage={canManage}
      organizationName={tenant.isPlatformUser ? "Your organization" : "your company"}
    />
  );
}