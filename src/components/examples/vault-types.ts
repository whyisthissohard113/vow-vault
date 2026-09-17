/**
 * Shared types for the interactive example vault components.
 */

export type VaultSection = "memories" | "videos" | "guestbook" | "upload" | "about";

export const VAULT_SECTION_LABEL: Record<VaultSection, string> = {
  memories: "Memories",
  videos: "Videos",
  guestbook: "Guestbook",
  upload: "Upload",
  about: "About",
};
