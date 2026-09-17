import { redirect } from "next/navigation";

/**
 * Legacy route — the marketing pricing page moved to /packages.
 * Keep this route alive for any old links and bookmarks.
 */
export default function PricingRedirect() {
  redirect("/packages");
}