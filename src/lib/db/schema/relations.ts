import { relations } from 'drizzle-orm';
import { users } from './auth';
import { auditLogs } from './audit';
import { buildJobs, buildJobSteps } from './build';
import { customers } from './customers';
import { emailEvents, emailJobs } from './email';
import { expiryRules, lifecycleEvents } from './expiry';
import { flipbookPages, flipbooks } from './flipbooks';
import { media, mediaProcessingJobs, mediaVariants, memories } from './media';
import { notifications } from './notifications';
import { orderItems, orders } from './orders';
import { organizationMembers, organizations } from './organizations';
import { paymentEvents, payments } from './payments';
import { productFeatureValues, productFeatures, products } from './products';
import { qrCodes, qrDesigns } from './qr';
import { slideshowItems, slideshows } from './slideshows';
import { templateFields, templateVersions, templates } from './templates';
import { guestSessions, vaultAccess, vaults } from './vaults';
import { weddingSettings } from './weddings-settings';
import { weddings } from './weddings';

/**
 * Drizzle relations metadata. Relations mirror the database foreign keys
 * (plus application-enforced reverse links such as `wedding_settings.banner_media_id`
 * and `wedding_settings.intro_media_id`, which intentionally have no DB FK).
 */

export const usersRelations = relations(users, ({ many }) => ({
  memberships: many(organizationMembers),
  auditLogs: many(auditLogs),
  notifications: many(notifications),
}));

export const organizationsRelations = relations(organizations, ({ many }) => ({
  members: many(organizationMembers),
  customers: many(customers),
  products: many(products),
  orders: many(orders),
  payments: many(payments),
  paymentEvents: many(paymentEvents),
  weddings: many(weddings),
  vaults: many(vaults),
  guestSessions: many(guestSessions),
  buildJobs: many(buildJobs),
  media: many(media),
  memories: many(memories),
  mediaProcessingJobs: many(mediaProcessingJobs),
  templates: many(templates),
  qrDesigns: many(qrDesigns),
  qrCodes: many(qrCodes),
  slideshows: many(slideshows),
  flipbooks: many(flipbooks),
  expiryRules: many(expiryRules),
  lifecycleEvents: many(lifecycleEvents),
  emailJobs: many(emailJobs),
  notifications: many(notifications),
  auditLogs: many(auditLogs),
}));

export const organizationMembersRelations = relations(organizationMembers, ({ one }) => ({
  organization: one(organizations, {
    fields: [organizationMembers.organizationId],
    references: [organizations.id],
  }),
  user: one(users, {
    fields: [organizationMembers.userId],
    references: [users.id],
  }),
}));

export const customersRelations = relations(customers, ({ one, many }) => ({
  organization: one(organizations, {
    fields: [customers.organizationId],
    references: [organizations.id],
  }),
  user: one(users, {
    fields: [customers.userId],
    references: [users.id],
  }),
  orders: many(orders),
  weddings: many(weddings),
}));

export const productsRelations = relations(products, ({ one, many }) => ({
  organization: one(organizations, {
    fields: [products.organizationId],
    references: [organizations.id],
  }),
  featureValues: many(productFeatureValues),
  orders: many(orders),
  orderItems: many(orderItems),
  weddings: many(weddings),
}));

export const productFeaturesRelations = relations(productFeatures, ({ many }) => ({
  values: many(productFeatureValues),
}));

export const productFeatureValuesRelations = relations(productFeatureValues, ({ one }) => ({
  product: one(products, {
    fields: [productFeatureValues.productId],
    references: [products.id],
  }),
  feature: one(productFeatures, {
    fields: [productFeatureValues.featureId],
    references: [productFeatures.id],
  }),
}));

export const ordersRelations = relations(orders, ({ one, many }) => ({
  organization: one(organizations, {
    fields: [orders.organizationId],
    references: [organizations.id],
  }),
  customer: one(customers, {
    fields: [orders.customerId],
    references: [customers.id],
  }),
  product: one(products, {
    fields: [orders.productId],
    references: [products.id],
  }),
  items: many(orderItems),
  payments: many(payments),
}));

export const orderItemsRelations = relations(orderItems, ({ one }) => ({
  order: one(orders, {
    fields: [orderItems.orderId],
    references: [orders.id],
  }),
  product: one(products, {
    fields: [orderItems.productId],
    references: [products.id],
  }),
}));

export const paymentsRelations = relations(payments, ({ one, many }) => ({
  organization: one(organizations, {
    fields: [payments.organizationId],
    references: [organizations.id],
  }),
  order: one(orders, {
    fields: [payments.orderId],
    references: [orders.id],
  }),
  events: many(paymentEvents),
}));

export const paymentEventsRelations = relations(paymentEvents, ({ one }) => ({
  organization: one(organizations, {
    fields: [paymentEvents.organizationId],
    references: [organizations.id],
  }),
  payment: one(payments, {
    fields: [paymentEvents.paymentId],
    references: [payments.id],
  }),
}));

export const weddingsRelations = relations(weddings, ({ one, many }) => ({
  organization: one(organizations, {
    fields: [weddings.organizationId],
    references: [organizations.id],
  }),
  customer: one(customers, {
    fields: [weddings.customerId],
    references: [customers.id],
  }),
  product: one(products, {
    fields: [weddings.productId],
    references: [products.id],
  }),
  template: one(templates, {
    fields: [weddings.templateId],
    references: [templates.id],
  }),
  settings: one(weddingSettings),
  vault: one(vaults),
  memories: many(memories),
  media: many(media),
  qrCodes: many(qrCodes),
  slideshows: many(slideshows),
  flipbooks: many(flipbooks),
  buildJobs: many(buildJobs),
  expiryRule: one(expiryRules),
  lifecycleEvents: many(lifecycleEvents),
  emailJobs: many(emailJobs),
}));

export const weddingSettingsRelations = relations(weddingSettings, ({ one }) => ({
  wedding: one(weddings, {
    fields: [weddingSettings.weddingId],
    references: [weddings.id],
  }),
  updatedByUser: one(users, {
    fields: [weddingSettings.updatedBy],
    references: [users.id],
  }),
}));

export const vaultsRelations = relations(vaults, ({ one, many }) => ({
  wedding: one(weddings, {
    fields: [vaults.weddingId],
    references: [weddings.id],
  }),
  organization: one(organizations, {
    fields: [vaults.organizationId],
    references: [organizations.id],
  }),
  access: many(vaultAccess),
  guestSessions: many(guestSessions),
  qrCodes: many(qrCodes),
}));

export const guestSessionsRelations = relations(guestSessions, ({ one, many }) => ({
  vault: one(vaults, {
    fields: [guestSessions.vaultId],
    references: [vaults.id],
  }),
  organization: one(organizations, {
    fields: [guestSessions.organizationId],
    references: [organizations.id],
  }),
  memories: many(memories),
  media: many(media),
  accessGrants: many(vaultAccess),
}));

export const vaultAccessRelations = relations(vaultAccess, ({ one }) => ({
  vault: one(vaults, {
    fields: [vaultAccess.vaultId],
    references: [vaults.id],
  }),
  user: one(users, {
    fields: [vaultAccess.userId],
    references: [users.id],
  }),
  guestSession: one(guestSessions, {
    fields: [vaultAccess.guestSessionId],
    references: [guestSessions.id],
  }),
}));

export const memoriesRelations = relations(memories, ({ one, many }) => ({
  wedding: one(weddings, {
    fields: [memories.weddingId],
    references: [weddings.id],
  }),
  organization: one(organizations, {
    fields: [memories.organizationId],
    references: [organizations.id],
  }),
  uploadedByUser: one(users, {
    fields: [memories.uploadedBy],
    references: [users.id],
  }),
  guestSession: one(guestSessions, {
    fields: [memories.guestSessionId],
    references: [guestSessions.id],
  }),
  media: many(media),
}));

export const mediaRelations = relations(media, ({ one, many }) => ({
  wedding: one(weddings, {
    fields: [media.weddingId],
    references: [weddings.id],
  }),
  organization: one(organizations, {
    fields: [media.organizationId],
    references: [organizations.id],
  }),
  memory: one(memories, {
    fields: [media.memoryId],
    references: [memories.id],
  }),
  uploadedByUser: one(users, {
    fields: [media.uploadedBy],
    references: [users.id],
  }),
  guestSession: one(guestSessions, {
    fields: [media.guestSessionId],
    references: [guestSessions.id],
  }),
  variants: many(mediaVariants),
  processingJobs: many(mediaProcessingJobs),
}));

export const mediaVariantsRelations = relations(mediaVariants, ({ one }) => ({
  media: one(media, {
    fields: [mediaVariants.mediaId],
    references: [media.id],
  }),
}));

export const mediaProcessingJobsRelations = relations(mediaProcessingJobs, ({ one }) => ({
  media: one(media, {
    fields: [mediaProcessingJobs.mediaId],
    references: [media.id],
  }),
  organization: one(organizations, {
    fields: [mediaProcessingJobs.organizationId],
    references: [organizations.id],
  }),
}));

export const templatesRelations = relations(templates, ({ one, many }) => ({
  organization: one(organizations, {
    fields: [templates.organizationId],
    references: [organizations.id],
  }),
  fields: many(templateFields),
  versions: many(templateVersions),
  weddings: many(weddings),
  slideshows: many(slideshows),
  flipbooks: many(flipbooks),
}));

export const templateFieldsRelations = relations(templateFields, ({ one }) => ({
  template: one(templates, {
    fields: [templateFields.templateId],
    references: [templates.id],
  }),
}));

export const templateVersionsRelations = relations(templateVersions, ({ one }) => ({
  template: one(templates, {
    fields: [templateVersions.templateId],
    references: [templates.id],
  }),
}));

export const qrDesignsRelations = relations(qrDesigns, ({ one, many }) => ({
  organization: one(organizations, {
    fields: [qrDesigns.organizationId],
    references: [organizations.id],
  }),
  qrCodes: many(qrCodes),
}));

export const qrCodesRelations = relations(qrCodes, ({ one }) => ({
  wedding: one(weddings, {
    fields: [qrCodes.weddingId],
    references: [weddings.id],
  }),
  vault: one(vaults, {
    fields: [qrCodes.vaultId],
    references: [vaults.id],
  }),
  organization: one(organizations, {
    fields: [qrCodes.organizationId],
    references: [organizations.id],
  }),
  design: one(qrDesigns, {
    fields: [qrCodes.designId],
    references: [qrDesigns.id],
  }),
}));

export const slideshowsRelations = relations(slideshows, ({ one, many }) => ({
  wedding: one(weddings, {
    fields: [slideshows.weddingId],
    references: [weddings.id],
  }),
  organization: one(organizations, {
    fields: [slideshows.organizationId],
    references: [organizations.id],
  }),
  template: one(templates, {
    fields: [slideshows.templateId],
    references: [templates.id],
  }),
  buildJob: one(buildJobs, {
    fields: [slideshows.buildJobId],
    references: [buildJobs.id],
  }),
  items: many(slideshowItems),
}));

export const slideshowItemsRelations = relations(slideshowItems, ({ one }) => ({
  slideshow: one(slideshows, {
    fields: [slideshowItems.slideshowId],
    references: [slideshows.id],
  }),
  media: one(media, {
    fields: [slideshowItems.mediaId],
    references: [media.id],
  }),
}));

export const flipbooksRelations = relations(flipbooks, ({ one, many }) => ({
  wedding: one(weddings, {
    fields: [flipbooks.weddingId],
    references: [weddings.id],
  }),
  organization: one(organizations, {
    fields: [flipbooks.organizationId],
    references: [organizations.id],
  }),
  template: one(templates, {
    fields: [flipbooks.templateId],
    references: [templates.id],
  }),
  buildJob: one(buildJobs, {
    fields: [flipbooks.buildJobId],
    references: [buildJobs.id],
  }),
  pages: many(flipbookPages),
}));

export const flipbookPagesRelations = relations(flipbookPages, ({ one }) => ({
  flipbook: one(flipbooks, {
    fields: [flipbookPages.flipbookId],
    references: [flipbooks.id],
  }),
  media: one(media, {
    fields: [flipbookPages.mediaId],
    references: [media.id],
  }),
}));

export const buildJobsRelations = relations(buildJobs, ({ one, many }) => ({
  wedding: one(weddings, {
    fields: [buildJobs.weddingId],
    references: [weddings.id],
  }),
  organization: one(organizations, {
    fields: [buildJobs.organizationId],
    references: [organizations.id],
  }),
  template: one(templates, {
    fields: [buildJobs.templateId],
    references: [templates.id],
  }),
  steps: many(buildJobSteps),
  slideshows: many(slideshows),
  flipbooks: many(flipbooks),
}));

export const buildJobStepsRelations = relations(buildJobSteps, ({ one }) => ({
  buildJob: one(buildJobs, {
    fields: [buildJobSteps.buildJobId],
    references: [buildJobs.id],
  }),
}));

export const expiryRulesRelations = relations(expiryRules, ({ one }) => ({
  wedding: one(weddings, {
    fields: [expiryRules.weddingId],
    references: [weddings.id],
  }),
  organization: one(organizations, {
    fields: [expiryRules.organizationId],
    references: [organizations.id],
  }),
}));

export const lifecycleEventsRelations = relations(lifecycleEvents, ({ one }) => ({
  wedding: one(weddings, {
    fields: [lifecycleEvents.weddingId],
    references: [weddings.id],
  }),
  organization: one(organizations, {
    fields: [lifecycleEvents.organizationId],
    references: [organizations.id],
  }),
  actor: one(users, {
    fields: [lifecycleEvents.actorUserId],
    references: [users.id],
  }),
}));

export const emailJobsRelations = relations(emailJobs, ({ one, many }) => ({
  organization: one(organizations, {
    fields: [emailJobs.organizationId],
    references: [organizations.id],
  }),
  wedding: one(weddings, {
    fields: [emailJobs.weddingId],
    references: [weddings.id],
  }),
  events: many(emailEvents),
}));

export const emailEventsRelations = relations(emailEvents, ({ one }) => ({
  emailJob: one(emailJobs, {
    fields: [emailEvents.emailJobId],
    references: [emailJobs.id],
  }),
}));

export const notificationsRelations = relations(notifications, ({ one }) => ({
  user: one(users, {
    fields: [notifications.userId],
    references: [users.id],
  }),
  organization: one(organizations, {
    fields: [notifications.organizationId],
    references: [organizations.id],
  }),
}));

export const auditLogsRelations = relations(auditLogs, ({ one }) => ({
  organization: one(organizations, {
    fields: [auditLogs.organizationId],
    references: [organizations.id],
  }),
  actor: one(users, {
    fields: [auditLogs.actorUserId],
    references: [users.id],
  }),
}));