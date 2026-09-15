/**
 * POST /api/checkout
 *
 * Opens a checkout for a tenant's wedding: creates the order + order_item +
 * payment rows (pending) and returns the provider redirect URL. Payment
 * activation is server-authoritative through POST /api/webhooks/payments/payfast
 * (or the simulated flow); this route never marks anything paid itself.
 *
 * Guards: authenticated + tenant + MANAGE_PAYMENTS.
 * Response: 201 { checkout: { orderId, paymentId, orderNumber, status,
 *   itemName, itemDescription, totalCents, currency, provider, redirectUrl,
 *   isSimulated } }
 */

import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

import {
  withAuth,
  withTenant,
  withPermission,
  Permission,
} from "@/server/middleware/auth";
import type { TenantContext } from "@/server/middleware/tenant";
import {
  createCheckout,
} from "@/server/services/payments/billing-service";
import { CheckoutError } from "@/server/services/payments/errors";
import { NotFoundError, ForbiddenError } from "@/lib/auth/errors";

const checkoutSchema = z
  .object({
    weddingId: z.string().uuid("weddingId must be a valid UUID"),
    productId: z.string().uuid("productId must be a valid UUID").optional(),
  })
  .strict();

async function handleCheckout(
  request: NextRequest,
  context: { tenant: TenantContext },
): Promise<NextResponse> {
  try {
    const body = await request.json();
    const parsed = checkoutSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: "Validation failed", details: parsed.error.flatten().fieldErrors },
        { status: 400 },
      );
    }

    const { tenant } = context;
    const result = await createCheckout({
      organizationId: tenant.organizationId,
      userId: tenant.userId,
      weddingId: parsed.data.weddingId,
      productId: parsed.data.productId,
    });

    return NextResponse.json(
      { checkout: result.checkout },
      { status: 201 },
    );
  } catch (error) {
    if (error instanceof NotFoundError) {
      return NextResponse.json({ error: error.message }, { status: 404 });
    }
    if (error instanceof ForbiddenError) {
      return NextResponse.json({ error: error.message }, { status: 403 });
    }
    if (error instanceof CheckoutError) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }
    console.error("[API/checkout] Error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

export const POST = withAuth(
  withTenant(withPermission(Permission.MANAGE_PAYMENTS)(handleCheckout)),
);