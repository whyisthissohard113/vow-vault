import type { Metadata } from "next";

import { SiteHeader } from "@/components/marketing/site-header";
import { SiteFooter } from "@/components/marketing/site-footer";
import { ContactForm } from "./contact-form";
import { SectionHeading } from "@/components/ui/section-heading";
import { SITE_NAME } from "@/content/site";

export const metadata: Metadata = {
  title: `Contact — ${SITE_NAME}`,
  description: "Get in touch with the Vow Vault team about packages, partnerships and wedding company programs.",
  alternates: { canonical: "/contact" },
};

export default function ContactPage() {
  return (
    <div className="flex min-h-screen flex-col bg-background">
      <SiteHeader />

      <section className="container-page pb-20 pt-16 sm:pt-20">
        <div className="mx-auto max-w-2xl">
          <SectionHeading
            as="h1"
            eyebrow="Contact"
            title="We'd love to hear from you"
            lead="Questions about packages, partnerships, white-label programs or anything else — send a message and we'll get back to you within two business days."
          />
          <div className="mt-10">
            <ContactForm />
          </div>
        </div>
      </section>

      <SiteFooter />
    </div>
  );
}