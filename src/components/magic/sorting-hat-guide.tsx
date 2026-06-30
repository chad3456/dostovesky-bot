"use client";

import { useEffect, useRef, useState } from "react";
import { pickTip } from "@/lib/marauder";

// A wonky, characterful Sorting Hat.
function HatSvg() {
  return (
    <svg width="76" height="76" viewBox="0 0 76 76" aria-hidden>
      <ellipse cx="38" cy="66" rx="26" ry="5" fill="rgba(60,40,20,0.25)" />
      <path
        d="M38 60c-16 0-24-3-24-5 0-3 7-5 24-5s24 2 24 5c0 2-8 5-24 5Z"
        fill="#5a4424"
      />
      <path
        d="M20 51C24 36 26 26 33 14c4-7 8-9 11 2 3 10 1 19 6 30-6-2-10-2-15-2s-9 0-15 2Z"
        fill="#6f5026"
      />
      <path
        d="M30 18c-2 8-1 14-5 27 3-1 5-1 7-1 0-9-1-18-2-26Z"
        fill="#7d5a2b"
        opacity="0.7"
      />
      {/* face fold */}
      <path d="M27 40c3 3 4 6 3 9" stroke="#3b2f23" strokeWidth="1.4" fill="none" />
      <path d="M40 38c4 2 6 6 6 10" stroke="#3b2f23" strokeWidth="1.4" fill="none" />
      {/* eyes */}
      <ellipse cx="31" cy="44" rx="1.7" ry="2.3" fill="#2b2118" />
      <ellipse cx="41" cy="44" rx="1.7" ry="2.3" fill="#2b2118" />
    </svg>
  );
}

/**
 * A roaming Sorting Hat that drifts around the page (GSAP), bobbing along, and
 * whispers whimsical tips. Click it for the next bit of wisdom.
 */
export function SortingHatGuide() {
  const hatRef = useRef<HTMLDivElement>(null);
  const tipIdx = useRef(0);
  const [tip, setTip] = useState<string | null>(null);

  useEffect(() => {
    let mounted = true;
    let roam: gsap.core.Tween | null = null;
    let bob: gsap.core.Tween | null = null;
    let speakTimer: ReturnType<typeof setInterval> | null = null;

    (async () => {
      const gsap = (await import("gsap")).default;
      const hat = hatRef.current;
      if (!hat || !mounted) return;

      const margin = 90;
      const wander = () => {
        if (!mounted) return;
        const x = margin + Math.random() * (window.innerWidth - margin * 2);
        const y = margin + Math.random() * (window.innerHeight - margin * 2);
        roam = gsap.to(hat, {
          x,
          y,
          duration: 6 + Math.random() * 5,
          ease: "sine.inOut",
          onComplete: wander,
        });
      };
      gsap.set(hat, {
        x: window.innerWidth * 0.8,
        y: window.innerHeight * 0.7,
      });
      wander();
      bob = gsap.to(hat, {
        y: "+=10",
        rotation: 4,
        duration: 1.6,
        ease: "sine.inOut",
        repeat: -1,
        yoyo: true,
      });

      const speak = () => {
        if (!mounted) return;
        setTip(pickTip(tipIdx.current++));
        gsap.delayedCall(5, () => mounted && setTip(null));
      };
      gsap.delayedCall(2.5, speak);
      speakTimer = setInterval(speak, 16000);
    })();

    return () => {
      mounted = false;
      roam?.kill();
      bob?.kill();
      if (speakTimer) clearInterval(speakTimer);
    };
  }, []);

  return (
    <div
      ref={hatRef}
      className="fixed left-0 top-0 z-[58] cursor-pointer select-none"
      onClick={() => {
        setTip(pickTip(tipIdx.current++));
      }}
      role="button"
      aria-label="A wandering Sorting Hat with reading tips"
      title="Ask the Sorting Hat"
    >
      <div className="relative">
        {tip && (
          <div className="absolute bottom-[78px] left-1/2 w-56 -translate-x-1/2 animate-fade-in rounded-2xl border border-parchment-border bg-parchment-light px-4 py-2 text-center text-sm italic text-ink shadow-xl">
            {tip}
            <span className="absolute -bottom-1.5 left-1/2 h-3 w-3 -translate-x-1/2 rotate-45 border-b border-r border-parchment-border bg-parchment-light" />
          </div>
        )}
        <HatSvg />
      </div>
    </div>
  );
}
