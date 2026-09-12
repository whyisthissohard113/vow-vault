/**
 * Asset Generation Service — Stub implementations for slideshow/flipbook generation.
 *
 * These are placeholder stubs. Real generation requires media processing
 * infrastructure (video transcoding, image composition) which is a separate
 * worker domain. These stubs mark the assets as published for the build pipeline.
 */

import { eq, and, isNull } from "drizzle-orm";
import { db } from "@/lib/db";
import { slideshows, flipbooks } from "@/lib/db/schema";

/**
 * Generate slideshow assets (stub).
 * In production, this would:
 *  1. Fetch slideshow_items ordered by sort_order
 *  2. Compose transitions between media items
 *  3. Render to video (MP4) or image sequence
 *  4. Store result and update status to 'published'
 *
 * Currently marks the slideshow as published immediately.
 */
export async function generateSlideshowAssets(slideshowId: string): Promise<void> {
  const [existing] = await db
    .select()
    .from(slideshows)
    .where(
      and(
        eq(slideshows.id, slideshowId),
        isNull(slideshows.deletedAt),
      ),
    )
    .limit(1);

  if (!existing) {
    throw new Error(`Slideshow ${slideshowId} not found`);
  }

  // Mark as published (stub — real generation needs media)
  await db
    .update(slideshows)
    .set({
      status: "published",
      updatedAt: new Date(),
    })
    .where(eq(slideshows.id, slideshowId));
}

/**
 * Generate flipbook assets (stub).
 * In production, this would:
 *  1. Fetch flipbook_pages ordered by page_number
 *  2. Render each page with content + media
 *  3. Compose into a PDF or interactive HTML flipbook
 *  4. Store result and update status to 'published'
 *
 * Currently marks the flipbook as published immediately.
 */
export async function generateFlipbookAssets(flipbookId: string): Promise<void> {
  const [existing] = await db
    .select()
    .from(flipbooks)
    .where(
      and(
        eq(flipbooks.id, flipbookId),
        isNull(flipbooks.deletedAt),
      ),
    )
    .limit(1);

  if (!existing) {
    throw new Error(`Flipbook ${flipbookId} not found`);
  }

  // Mark as published (stub — real generation needs media)
  await db
    .update(flipbooks)
    .set({
      status: "published",
      updatedAt: new Date(),
    })
    .where(eq(flipbooks.id, flipbookId));
}
