"use client";

import { useEffect, useRef } from "react";
import { generateWalkPath, type Footstep } from "@/lib/marauder";

const STEPS = 16;

// A single inky footprint shape.
function Foot({ flip }: { flip: boolean }) {
  return (
    <svg
      width="18"
      height="26"
      viewBox="0 0 18 26"
      style={{ transform: flip ? "scaleX(-1)" : undefined }}
    >
      <path
        d="M9 0C5.5 0 3.5 3 3.5 7c0 3 1.5 5 1.5 8 0 2-1.5 3-1.5 5 0 2 1.7 3.5 4 3.5s4-1.5 4-3.5c0-2-1.5-3-1.5-5 0-3 1.5-5 1.5-8 0-4-2-7-5.5-7Z"
        fill="#3b2f23"
      />
      <ellipse cx="5" cy="3.5" rx="1.3" ry="1.8" fill="#3b2f23" />
      <ellipse cx="13" cy="3.5" rx="1.3" ry="1.8" fill="#3b2f23" />
    </svg>
  );
}

/**
 * Inky footprints that appear one-by-one as if someone unseen is walking across
 * the page, then fade away — the signature Marauder's Map effect.
 */
export function Footprints() {
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let mounted = true;
    let tl: gsap.core.Timeline | null = null;

    (async () => {
      const gsap = (await import("gsap")).default;
      const container = containerRef.current;
      if (!container || !mounted) return;
      const feet = Array.from(
        container.querySelectorAll<HTMLElement>("[data-foot]"),
      );

      const walk = () => {
        if (!mounted) return;
        const w = window.innerWidth;
        const h = window.innerHeight;
        const path: Footstep[] = generateWalkPath(w, h, STEPS);

        gsap.killTweensOf(feet);
        tl = gsap.timeline({
          onComplete: () => {
            // Pause, then walk a fresh path.
            gsap.delayedCall(1.2 + Math.random() * 2, walk);
          },
        });

        feet.forEach((foot, i) => {
          const step = path[i];
          gsap.set(foot, {
            x: step.x,
            y: step.y,
            rotation: step.angle,
            opacity: 0,
            scale: 0.9,
          });
          tl!.to(
            foot,
            { opacity: 0.55, scale: 1, duration: 0.18, ease: "power1.out" },
            i * 0.16,
          ).to(
            foot,
            { opacity: 0, duration: 1.1, ease: "power1.in" },
            i * 0.16 + 0.9,
          );
        });
      };

      walk();
    })();

    return () => {
      mounted = false;
      tl?.kill();
    };
  }, []);

  return (
    <div
      ref={containerRef}
      className="pointer-events-none fixed inset-0 z-[55]"
      aria-hidden
    >
      {Array.from({ length: STEPS }).map((_, i) => (
        <div key={i} data-foot className="absolute left-0 top-0 will-change-transform">
          <Foot flip={i % 2 === 1} />
        </div>
      ))}
    </div>
  );
}
