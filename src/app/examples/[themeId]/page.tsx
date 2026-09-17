import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { ExampleVault } from "@/components/examples/example-vault";
import { EXAMPLES, getExampleById } from "@/content/examples";
import { SITE_NAME } from "@/content/site";

interface PageProps {
  params: Promise<{ themeId: string }>;
}

export function generateStaticParams() {
  return EXAMPLES.map((example) => ({ themeId: example.id }));
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { themeId } = await params;
  const wedding = getExampleById(themeId);
  if (!wedding) return { title: `Not found — ${SITE_NAME}` };
  return {
    title: `${wedding.coupleNames} — ${wedding.title} Example Vault — ${SITE_NAME}`,
    description: `${wedding.story} Explore this ${wedding.packageTier} demo vault: gallery, guest uploads, guestbook and more.`,
    alternates: { canonical: `/examples/${wedding.id}` },
  };
}

export default async function ThemeExamplePage({ params }: PageProps) {
  const { themeId } = await params;
  const wedding = getExampleById(themeId);
  if (!wedding) notFound();

  return (
    <ExampleVault wedding={wedding} tier={wedding.packageTier} mode="theme" />
  );
}