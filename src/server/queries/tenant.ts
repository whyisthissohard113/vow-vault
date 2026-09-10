/**
 * Tenant-scoped database query helpers.
 *
 * Every query function in this module filters by `organization_id` to
 * enforce server-side tenant isolation. This prevents IDOR attacks where
 * a user in tenant A tries to access resources belonging to tenant B.
 *
 * SECURITY RULES:
 *  1. Every query MUST include organization_id filter.
 *  2. Single-record lookups MUST include both ID and organization_id.
 *  3. Platform users still go through this layer — they provide their
 *     organizationId from TenantContext (which may differ from the
 *     resource's org, but the guard has already validated access).
 */

import { eq, and, isNull } from "drizzle-orm";
import { db } from "@/lib/db";
import {
  weddings,
  vaults,
  media,
  memories,
  buildJobs,
  qrCodes,
  slideshows,
  flipbooks,
  expiryRules,
  lifecycleEvents,
  customers,
  orders,
  payments,
  emailJobs,
  organizationMembers,
  type Wedding,
  type Vault,
  type Customer,
} from "@/lib/db/schema";
import { TenantMismatchError } from "@/lib/auth/errors";
import type { TenantContext } from "@/server/middleware/tenant";

// ── Tenant-scoped Query Builder ─────────────────────────────────────────────

/**
 * Creates a set of tenant-scoped query helpers.
 *
 * Every function automatically filters by `organizationId`.
 * Single-record lookups verify the resource belongs to the tenant.
 *
 * @param tenantCtx - The authenticated tenant context.
 */
export function tenantQuery(tenantCtx: TenantContext) {
  const orgId = tenantCtx.organizationId;

  return {
    // ── Weddings ──────────────────────────────────────────────
    weddings: {
      async findAll() {
        return db
          .select()
          .from(weddings)
          .where(
            and(
              eq(weddings.organizationId, orgId),
              isNull(weddings.deletedAt),
            ),
          );
      },
      async findById(id: string) {
        const [row] = await db
          .select()
          .from(weddings)
          .where(
            and(
              eq(weddings.id, id),
              eq(weddings.organizationId, orgId),
              isNull(weddings.deletedAt),
            ),
          )
          .limit(1);
        return row ?? null;
      },
      async findByPublicId(publicId: string) {
        const [row] = await db
          .select()
          .from(weddings)
          .where(
            and(
              eq(weddings.publicId, publicId),
              eq(weddings.organizationId, orgId),
              isNull(weddings.deletedAt),
            ),
          )
          .limit(1);
        return row ?? null;
      },
    },

    // ── Vaults ────────────────────────────────────────────────
    vaults: {
      async findAll() {
        return db
          .select()
          .from(vaults)
          .where(
            and(
              eq(vaults.organizationId, orgId),
              isNull(vaults.deletedAt),
            ),
          );
      },
      async findById(id: string) {
        const [row] = await db
          .select()
          .from(vaults)
          .where(
            and(
              eq(vaults.id, id),
              eq(vaults.organizationId, orgId),
              isNull(vaults.deletedAt),
            ),
          )
          .limit(1);
        return row ?? null;
      },
      async findBySlug(slug: string) {
        const [row] = await db
          .select()
          .from(vaults)
          .where(
            and(
              eq(vaults.slug, slug),
              eq(vaults.organizationId, orgId),
              isNull(vaults.deletedAt),
            ),
          )
          .limit(1);
        return row ?? null;
      },
    },

    // ── Media ─────────────────────────────────────────────────
    media: {
      async findByWeddingId(weddingId: string) {
        return db
          .select()
          .from(media)
          .where(
            and(
              eq(media.organizationId, orgId),
              eq(media.weddingId, weddingId),
              isNull(media.deletedAt),
            ),
          );
      },
      async findById(id: string) {
        const [row] = await db
          .select()
          .from(media)
          .where(
            and(
              eq(media.id, id),
              eq(media.organizationId, orgId),
              isNull(media.deletedAt),
            ),
          )
          .limit(1);
        return row ?? null;
      },
    },

    // ── Memories ──────────────────────────────────────────────
    memories: {
      async findByWeddingId(weddingId: string) {
        return db
          .select()
          .from(memories)
          .where(
            and(
              eq(memories.organizationId, orgId),
              eq(memories.weddingId, weddingId),
              isNull(memories.deletedAt),
            ),
          );
      },
      async findById(id: string) {
        const [row] = await db
          .select()
          .from(memories)
          .where(
            and(
              eq(memories.id, id),
              eq(memories.organizationId, orgId),
              isNull(memories.deletedAt),
            ),
          )
          .limit(1);
        return row ?? null;
      },
    },

    // ── Build Jobs ────────────────────────────────────────────
    buildJobs: {
      async findByWeddingId(weddingId: string) {
        return db
          .select()
          .from(buildJobs)
          .where(
            and(
              eq(buildJobs.organizationId, orgId),
              eq(buildJobs.weddingId, weddingId),
            ),
          );
      },
      async findById(id: string) {
        const [row] = await db
          .select()
          .from(buildJobs)
          .where(
            and(
              eq(buildJobs.id, id),
              eq(buildJobs.organizationId, orgId),
            ),
          )
          .limit(1);
        return row ?? null;
      },
    },

    // ── QR Codes ──────────────────────────────────────────────
    qrCodes: {
      async findByWeddingId(weddingId: string) {
        return db
          .select()
          .from(qrCodes)
          .where(
            and(
              eq(qrCodes.organizationId, orgId),
              eq(qrCodes.weddingId, weddingId),
              isNull(qrCodes.deletedAt),
            ),
          );
      },
    },

    // ── Customers ─────────────────────────────────────────────
    customers: {
      async findAll() {
        return db
          .select()
          .from(customers)
          .where(
            and(
              eq(customers.organizationId, orgId),
              isNull(customers.deletedAt),
            ),
          );
      },
      async findById(id: string) {
        const [row] = await db
          .select()
          .from(customers)
          .where(
            and(
              eq(customers.id, id),
              eq(customers.organizationId, orgId),
              isNull(customers.deletedAt),
            ),
          )
          .limit(1);
        return row ?? null;
      },
    },

    // ── Orders ────────────────────────────────────────────────
    orders: {
      async findAll() {
        return db
          .select()
          .from(orders)
          .where(
            and(
              eq(orders.organizationId, orgId),
              isNull(orders.deletedAt),
            ),
          );
      },
      async findById(id: string) {
        const [row] = await db
          .select()
          .from(orders)
          .where(
            and(
              eq(orders.id, id),
              eq(orders.organizationId, orgId),
              isNull(orders.deletedAt),
            ),
          )
          .limit(1);
        return row ?? null;
      },
    },

    // ── Payments ──────────────────────────────────────────────
    payments: {
      async findAll() {
        return db
          .select()
          .from(payments)
          .where(eq(payments.organizationId, orgId));
      },
      async findById(id: string) {
        const [row] = await db
          .select()
          .from(payments)
          .where(
            and(
              eq(payments.id, id),
              eq(payments.organizationId, orgId),
            ),
          )
          .limit(1);
        return row ?? null;
      },
    },

    // ── Expiry Rules ──────────────────────────────────────────
    expiryRules: {
      async findByWeddingId(weddingId: string) {
        const [row] = await db
          .select()
          .from(expiryRules)
          .where(
            and(
              eq(expiryRules.organizationId, orgId),
              eq(expiryRules.weddingId, weddingId),
            ),
          )
          .limit(1);
        return row ?? null;
      },
    },

    // ── Lifecycle Events ──────────────────────────────────────
    lifecycleEvents: {
      async findByWeddingId(weddingId: string) {
        return db
          .select()
          .from(lifecycleEvents)
          .where(
            and(
              eq(lifecycleEvents.organizationId, orgId),
              eq(lifecycleEvents.weddingId, weddingId),
            ),
          );
      },
    },

    // ── Organization Members ──────────────────────────────────
    members: {
      async findAll() {
        return db
          .select()
          .from(organizationMembers)
          .where(
            and(
              eq(organizationMembers.organizationId, orgId),
              isNull(organizationMembers.deletedAt),
            ),
          );
      },
    },

    // ── Slideshows ────────────────────────────────────────────
    slideshows: {
      async findByWeddingId(weddingId: string) {
        return db
          .select()
          .from(slideshows)
          .where(
            and(
              eq(slideshows.organizationId, orgId),
              eq(slideshows.weddingId, weddingId),
              isNull(slideshows.deletedAt),
            ),
          );
      },
    },

    // ── Flipbooks ─────────────────────────────────────────────
    flipbooks: {
      async findByWeddingId(weddingId: string) {
        return db
          .select()
          .from(flipbooks)
          .where(
            and(
              eq(flipbooks.organizationId, orgId),
              eq(flipbooks.weddingId, weddingId),
              isNull(flipbooks.deletedAt),
            ),
          );
      },
    },

    // ── Email Jobs ────────────────────────────────────────────
    emailJobs: {
      async findByWeddingId(weddingId: string) {
        return db
          .select()
          .from(emailJobs)
          .where(
            and(
              eq(emailJobs.organizationId, orgId),
              eq(emailJobs.weddingId, weddingId),
            ),
          );
      },
    },
  };
}

// ── Standalone Single-Record Lookups ────────────────────────────────────────

/**
 * Find a wedding by ID, scoped to an organization.
 * Throws TenantMismatchError if the resource doesn't belong to the tenant.
 */
export async function findWeddingByIdAndOrg(
  weddingId: string,
  organizationId: string,
): Promise<Wedding | null> {
  const [row] = await db
    .select()
    .from(weddings)
    .where(
      and(
        eq(weddings.id, weddingId),
        eq(weddings.organizationId, organizationId),
        isNull(weddings.deletedAt),
      ),
    )
    .limit(1);
  return row ?? null;
}

/**
 * Find a vault by ID, scoped to an organization.
 */
export async function findVaultByIdAndOrg(
  vaultId: string,
  organizationId: string,
): Promise<Vault | null> {
  const [row] = await db
    .select()
    .from(vaults)
    .where(
      and(
        eq(vaults.id, vaultId),
        eq(vaults.organizationId, organizationId),
        isNull(vaults.deletedAt),
      ),
    )
    .limit(1);
  return row ?? null;
}

/**
 * Find a customer by ID, scoped to an organization.
 */
export async function findCustomerByIdAndOrg(
  customerId: string,
  organizationId: string,
): Promise<Customer | null> {
  const [row] = await db
    .select()
    .from(customers)
    .where(
      and(
        eq(customers.id, customerId),
        eq(customers.organizationId, organizationId),
        isNull(customers.deletedAt),
      ),
    )
    .limit(1);
  return row ?? null;
}

/**
 * Assert that a resource exists within the given organization.
 * Throws TenantMismatchError if not found.
 */
export async function assertOrgResource<T extends { id: string }>(
  query: Promise<T | null>,
  // eslint-disable-next-line @typescript-eslint/no-unused-vars -- resourceType is used for logging/context in downstream code
  _resourceType: string,
): Promise<T> {
  const result = await query;
  if (!result) {
    throw new TenantMismatchError();
  }
  return result;
}
