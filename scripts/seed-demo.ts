/**
 * Demo environment seed — creates a full, buildable demo account for human
 * testing of the dashboard, guest uploads and downloads.
 *
 *   Email:    demo@weddingmemoryvault.app
 *   Password: DemoPass123!
 *
 * Seeds: organization → owner user → membership → platform products
 * (silver/gold/platinum) → customer → template + published version →
 * gold wedding + settings → paid order + completed payment, then enqueues a
 * vault build via the same `enqueueBuild` path the API uses, so the running
 * build worker finishes it end-to-end.
 *
 * Run: npm run seed:demo   (uses tsx + dotenv from scripts/)
 */
import "dotenv/config";

import { randomBytes } from "node:crypto";
import bcrypt from "bcryptjs";
import { eq, and, isNull } from "drizzle-orm";

import { db } from "../src/lib/db";
import {
  users,
  organizations,
  organizationMembers,
  customers,
  products,
  templates,
  templateVersions,
  weddings,
  weddingSettings,
  orders,
  orderItems,
  payments,
  buildJobs,
  vaults,
} from "../src/lib/db/schema";
import { enqueueBuild } from "../src/server/services/build-engine";
import { PASSWORD_POLICY } from "../src/lib/auth/constants";

// ── Demo constants ────────────────────────────────────────────────────────────

const DEMO_EMAIL = "demo@weddingmemoryvault.app";
const DEMO_PASSWORD = "DemoPass123!";
const DEMO_NAME = "Demo User";
const ORG_SLUG = "demo-weddings";
const ORG_NAME = "Demo Weddings Co.";
const COUPLE_ONE = "Thandi";
const COUPLE_TWO = "Daniel";
const TEMPLATE_CODE = "classic-elegance";

/** Wedding date ~60 days in the future so all windows are open. */
function futureDate(days: number): Date {
  const d = new Date();
  d.setUTCDate(d.getUTCDate() + days);
  d.setUTCHours(0, 0, 0, 0);
  return d;
}

const weddingDate = futureDate(60);

function randomHex(bytes: number): string {
  return randomBytes(bytes).toString("hex");
}

function log(step: string, detail = ""): void {
  console.log(`[seed-demo] ${step}${detail ? ` — ${detail}` : ""}`);
}

// ── Helpers to look up existing rows (idempotency) ───────────────────────────

async function findPlatformProduct(code: string) {
  return db
    .select()
    .from(products)
    .where(
      and(
        eq(products.code, code),
        isNull(products.organizationId),
        isNull(products.deletedAt),
      ),
    )
    .limit(1);
}

// ── Main ──────────────────────────────────────────────────────────────────────

async function main(): Promise<void> {
  // 1. Organization (tenant)
  let [org] = await db
    .select()
    .from(organizations)
    .where(and(eq(organizations.slug, ORG_SLUG), isNull(organizations.deletedAt)))
    .limit(1);

  if (!org) {
    [org] = await db
      .insert(organizations)
      .values({
        publicId: randomHex(16),
        name: ORG_NAME,
        slug: ORG_SLUG,
        type: "wedding_company",
        status: "active",
        timezone: "Africa/Johannesburg",
      })
      .returning();
    log("organization", `${ORG_NAME} (${org.id})`);
  } else {
    log("organization (existing)", org.id);
  }

  // 2. Demo user + owner membership
  let [demoUser] = await db
    .select()
    .from(users)
    .where(and(eq(users.email, DEMO_EMAIL), isNull(users.deletedAt)))
    .limit(1);

  if (!demoUser) {
    [demoUser] = await db
      .insert(users)
      .values({
        email: DEMO_EMAIL,
        passwordHash: await bcrypt.hash(DEMO_PASSWORD, PASSWORD_POLICY.BCRYPT_ROUNDS),
        fullName: DEMO_NAME,
        status: "active",
      })
      .returning();
    log("user", `${DEMO_EMAIL} (password: ${DEMO_PASSWORD})`);
  } else {
    log("user (existing)", DEMO_EMAIL);
  }

  const [existingMembership] = await db
    .select()
    .from(organizationMembers)
    .where(
      and(
        eq(organizationMembers.organizationId, org.id),
        eq(organizationMembers.userId, demoUser.id),
        isNull(organizationMembers.deletedAt),
      ),
    )
    .limit(1);

  if (existingMembership) {
    log("membership (existing)", existingMembership.role);
  } else {
    const [membership] = await db
      .insert(organizationMembers)
      .values({
        organizationId: org.id,
        userId: demoUser.id,
        role: "wedding_company_owner",
        status: "active",
        sortOrder: 0,
        joinedAt: new Date(),
      })
      .returning();
    log("membership", `owner (${membership.id})`);
  }

  // 3. Platform-wide products (Silver / Gold / Platinum)
  const packages = [
    { code: "silver", name: "Silver", priceCents: 59900, sortOrder: 1, description: "Basic setup with photo gallery and guest uploads" },
    { code: "gold", name: "Gold", priceCents: 79900, sortOrder: 2, description: "Silver + video, slideshow, banner, unlimited photos" },
    { code: "platinum", name: "Platinum", priceCents: 109900, sortOrder: 3, description: "Gold + intro, flipbook, QR design cards, extended download" },
  ] as const;

  const productIds: Record<string, string> = {};
  for (const pkg of packages) {
    const [existingProduct] = await findPlatformProduct(pkg.code);
    if (existingProduct) {
      productIds[pkg.code] = existingProduct.id;
      log("product (existing)", pkg.code);
      continue;
    }
    const [createdProduct] = await db
      .insert(products)
      .values({
        code: pkg.code,
        name: pkg.name,
        description: pkg.description,
        type: "one_time",
        priceCents: pkg.priceCents,
        currency: "ZAR",
        status: "active",
        sortOrder: pkg.sortOrder,
      })
      .returning();
    productIds[pkg.code] = createdProduct.id;
    log("product", `${pkg.code} (${createdProduct.id})`);
  }

  const goldProductId = productIds["gold"];

  // 4. Customer
  const [existingCustomer] = await db
    .select()
    .from(customers)
    .where(
      and(
        eq(customers.organizationId, org.id),
        eq(customers.email, "wedding-couple@example.com"),
        isNull(customers.deletedAt),
      ),
    )
    .limit(1);

  let customer = existingCustomer;
  if (!customer) {
    [customer] = await db
      .insert(customers)
      .values({
        organizationId: org.id,
        publicId: randomHex(16),
        fullName: "Wedding Couple",
        email: "wedding-couple@example.com",
        phone: "+27 82 000 0000",
      })
      .returning();
    log("customer", `${customer.email} (${customer.id})`);
  } else {
    log("customer (existing)", customer.id);
  }

  // 5. Template + published version (needed by build validation)
  const [existingTemplate] = await db
    .select()
    .from(templates)
    .where(
      and(
        eq(templates.code, TEMPLATE_CODE),
        isNull(templates.organizationId),
        isNull(templates.deletedAt),
      ),
    )
    .limit(1);

  let template = existingTemplate;
  if (!template) {
    [template] = await db
      .insert(templates)
      .values({
        code: TEMPLATE_CODE,
        name: "Classic Elegance",
        description: "Timeless editorial layout with a hero banner and gallery.",
        isPlatform: true,
        status: "active",
      })
      .returning();

    await db.insert(templateVersions).values({
      templateId: template.id,
      version: 1,
      content: {
        name: "Classic Elegance",
        hero: "banner",
        sections: ["hero", "intro", "story", "gallery"],
      },
      isLatest: true,
      publishedAt: new Date(),
    });
    log("template", `${TEMPLATE_CODE} + version 1`);
  } else {
    const [version] = await db
      .select()
      .from(templateVersions)
      .where(
        and(
          eq(templateVersions.templateId, template.id),
          eq(templateVersions.isLatest, true),
        ),
      )
      .limit(1);
    log("template (existing)", `${TEMPLATE_CODE}${version ? " (latest version verified)" : " — MISSING LATEST VERSION!"}`);
  }

  // 6. Wedding (gold)
  const weddingName = `${COUPLE_ONE} & ${COUPLE_TWO}`;
  const [existingWedding] = await db
    .select()
    .from(weddings)
    .where(
      and(
        eq(weddings.organizationId, org.id),
        eq(weddings.name, weddingName),
        isNull(weddings.deletedAt),
      ),
    )
    .limit(1);

  let wedding = existingWedding;
  if (!wedding) {
    [wedding] = await db
      .insert(weddings)
      .values({
        organizationId: org.id,
        customerId: customer.id,
        productId: goldProductId,
        publicId: randomHex(16),
        code: `WED-${new Date().getFullYear()}-0001`,
        name: weddingName,
        partnerOneName: COUPLE_ONE,
        partnerTwoName: COUPLE_TWO,
        status: "draft",
        weddingDate,
        timezone: "Africa/Johannesburg",
        templateId: template.id,
      })
      .returning();

    await db.insert(weddingSettings).values({
      weddingId: wedding.id,
      themeColor: "#8B5E3C",
      accentColor: "#D4AF37",
      coupleStory: "Thandi and Daniel met over a shared love of travel. They said yes in Cape Town and can't wait to celebrate with everyone they love.",
      customMessage: "Help us remember our day — please share every candid shot and special moment you capture.",
      allowGuestUploads: true,
      requireApproval: false,
      updatedBy: demoUser.id,
    });
    log("wedding", `${weddingName} (${wedding.id})`);
  } else {
    log("wedding (existing)", wedding.id);
  }

  // 7. Paid order + completed payment (server-authoritative payment proof)
  const [existingOrder] = await db
    .select()
    .from(orders)
    .where(and(eq(orders.orderNumber, "ORD-DEMO-0001"), isNull(orders.deletedAt)))
    .limit(1);

  let order = existingOrder;
  if (!order) {
    [order] = await db
      .insert(orders)
      .values({
        organizationId: org.id,
        customerId: customer.id,
        productId: goldProductId,
        orderNumber: "ORD-DEMO-0001",
        status: "paid",
        subtotalCents: 79900,
        discountCents: 0,
        totalCents: 79900,
        currency: "ZAR",
        placedAt: new Date(),
        paidAt: new Date(),
      })
      .returning();

    await db.insert(orderItems).values({
      orderId: order.id,
      productId: goldProductId,
      productName: "Gold",
      unitPriceCents: 79900,
      quantity: 1,
      lineTotalCents: 79900,
    });

    await db.insert(payments).values({
      organizationId: org.id,
      orderId: order.id,
      provider: "payfast",
      providerReference: `payfast-demo-${order.id.slice(0, 12)}`,
      status: "completed",
      amountCents: 79900,
      currency: "ZAR",
      paidAt: new Date(),
    });
    log("order+payment", "ORD-DEMO-0001 paid via simulated payfast payment");
  } else {
    log("order+payment (existing)", order.id);
  }

  // 8. Enqueue build job (idempotent) so the running build worker completes it
  const idempotencyKey = `seed-demo-build-${wedding.id}`;
  const [existingBuild] = await db
    .select()
    .from(buildJobs)
    .where(eq(buildJobs.idempotencyKey, idempotencyKey))
    .limit(1);

  let buildJobId: string;
  if (existingBuild) {
    buildJobId = existingBuild.id;
    log("build (existing)", `${existingBuild.id} status=${existingBuild.status}`);
  } else {
    const result = await enqueueBuild({
      weddingId: wedding.id,
      organizationId: org.id,
      customerId: customer.id,
      productId: goldProductId,
      idempotencyKey,
      version: 1,
      templateId: template.id,
      actorUserId: demoUser.id,
    });
    buildJobId = result.buildJobId;
    log("build enqueued", `${buildJobId} status=${result.status}`);
  }

  // 9. Wait for the build worker to finish (up to ~60s) and report the vault URL
  const deadlineMs = Date.now() + 60_000;
  let finalStatus = "pending";
  let slug: string | undefined;

  while (Date.now() < deadlineMs) {
    const [job] = await db
      .select()
      .from(buildJobs)
      .where(eq(buildJobs.id, buildJobId))
      .limit(1);

    if (!job) break;
    finalStatus = job.status;

    if (job.status === "completed" || job.status === "failed") {
      const [vaultRow] = await db
        .select()
        .from(vaults)
        .where(and(eq(vaults.weddingId, wedding.id), isNull(vaults.deletedAt)))
        .limit(1);
      slug = vaultRow?.slug;
      if (job.status === "failed") {
        console.error(`[seed-demo] Build failed: ${job.errorMessage ?? "unknown error"}`);
      }
      break;
    }

    await new Promise((resolve) => setTimeout(resolve, 2000));
  }

  // ── Summary ──────────────────────────────────────────────────────────────────
  console.log("");
  console.log("═".repeat(60));
  console.log("  DEMO ACCOUNT READY");
  console.log("═".repeat(60));
  console.log("  Dashboard login:");
  console.log(`    URL:      http://localhost:3000/login`);
  console.log(`    Email:    ${DEMO_EMAIL}`);
  console.log(`    Password: ${DEMO_PASSWORD}`);
  console.log(`    Role:     wedding_company_owner (Demo Weddings Co.)`);
  console.log("");
  console.log("  Wedding:");
  console.log(`    ${weddingName} (Gold, R799.00, paid)`);
  console.log(`    Wedding date: ${weddingDate.toISOString().slice(0, 10)} (JNB)`);
  if (slug) {
    console.log(`    Public vault: http://localhost:3000/w/${slug}`);
  } else {
    console.log(`    Public vault: not published yet (build status=${finalStatus})`);
  }
  console.log("═".repeat(60));
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error("[seed-demo] Fatal error:", error);
    process.exit(1);
  });