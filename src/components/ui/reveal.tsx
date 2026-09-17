"use client";

/**
 * Reveal — IntersectionObserver-driven entrance animation.
 *
 * Fades and slides content in as it enters the viewport. The `.reveal` /
 * `.is-visible` classes are defined in globals.css; the reduced-motion media
 * query there also forces content visible without animation, and this
 * component skips the observer entirely for reduced-motion users.
 */

import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { useReducedMotion } from "@/components/ui/use-reduced-motion";
import { cn } from "@/lib/utils";

interface RevealProps {
  children: ReactNode;
  className?: string;
  /** Delay in ms before the reveal transition starts. */
  delay?: number;
  as?: "div" | "section" | "li" | "figure" | "span";
}

export function Reveal({
  children,
  className,
  delay = 0,
  as: Tag = "div",
}: RevealProps) {
  const nodeRef = useRef<HTMLElement | null>(null);
  const reduced = useReducedMotion();
  const [visible, setVisible] = useState(false);

  const setNodeRef = useCallback((node: HTMLElement | null) => {
    nodeRef.current = node;
  }, []);

  useEffect(() => {
    if (reduced) return;
    const node = nodeRef.current;
    if (!node) return;

    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) {
            setVisible(true);
            observer.disconnect();
          }
        }
      },
      { threshold: 0.12, rootMargin: "0px 0px -40px 0px" },
    );

    observer.observe(node);
    return () => observer.disconnect();
  }, [reduced]);

  const animate = !reduced;

  return (
    <Tag
      ref={setNodeRef}
      className={cn(animate && "reveal", visible && "is-visible", className)}
      style={delay > 0 && animate ? { transitionDelay: `${delay}ms` } : undefined}
    >
      {children}
    </Tag>
  );
}