/**
 * Navigation and footer content for the marketing site.
 */

export interface NavLink {
  label: string;
  href: string;
}

export interface FooterColumn {
  title: string;
  links: NavLink[];
}

export interface SocialLink {
  label: string;
  href: string;
}

/** Top-level navigation shown in the header (desktop + mobile). */
export const PRIMARY_NAV: readonly NavLink[] = [
  { label: "How It Works", href: "/how-it-works" },
  { label: "Features", href: "/features" },
  { label: "Packages", href: "/packages" },
  { label: "Examples", href: "/examples" },
  { label: "FAQ", href: "/faq" },
] as const;

export const AUTH_LINKS = {
  login: { label: "Log In", href: "/login" },
  register: { label: "Create Your Vault", href: "/register" },
} as const;

/** Footer column structure. */
export const FOOTER_COLUMNS: readonly FooterColumn[] = [
  {
    title: "Product",
    links: [
      { label: "How It Works", href: "/how-it-works" },
      { label: "Features", href: "/features" },
      { label: "Packages", href: "/packages" },
      { label: "Examples", href: "/examples" },
    ],
  },
  {
    title: "Company",
    links: [
      { label: "About", href: "/about" },
      { label: "Contact", href: "/contact" },
      { label: "FAQ", href: "/faq" },
    ],
  },
  {
    title: "Business",
    links: [
      { label: "For Wedding Companies", href: "/for-wedding-companies" },
      { label: "Partners", href: "/for-wedding-companies#partners" },
      { label: "White Label", href: "/for-wedding-companies#white-label" },
    ],
  },
  {
    title: "Legal",
    links: [
      { label: "Privacy", href: "/privacy" },
      { label: "Terms", href: "/terms" },
      { label: "Cookies", href: "/cookies" },
    ],
  },
] as const;

/** External social profiles (demo destinations with rel="noopener"). */
export const SOCIAL_LINKS: readonly SocialLink[] = [
  { label: "Instagram", href: "https://www.instagram.com/" },
  { label: "Facebook", href: "https://www.facebook.com/" },
  { label: "TikTok", href: "https://www.tiktok.com/" },
] as const;