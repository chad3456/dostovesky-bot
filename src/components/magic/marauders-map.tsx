"use client";

import { useEffect, useRef } from "react";

// Shared coordinate space (everything lives in one slice-scaled SVG so the
// walkers stay aligned to the corridors).
const VW = 1200;
const VH = 800;

// Key locations.
const LOC = {
  gryffindor: { x: 180, y: 150 },
  astronomy: { x: 1010, y: 140 },
  greatHall: { x: 600, y: 330 },
  library: { x: 300, y: 370 },
  courtyard: { x: 600, y: 530 },
  dungeons: { x: 980, y: 640 },
  hut: { x: 240, y: 650 },
};

// Corridors drawn between locations (also where people walk).
const CORRIDORS: [keyof typeof LOC, keyof typeof LOC][] = [
  ["gryffindor", "library"],
  ["library", "greatHall"],
  ["gryffindor", "greatHall"],
  ["greatHall", "astronomy"],
  ["greatHall", "courtyard"],
  ["courtyard", "hut"],
  ["courtyard", "dungeons"],
];

interface Walker {
  name: string;
  scale: number;
  variant: "plain" | "beard" | "cape" | "giant";
  path: (keyof typeof LOC)[];
  duration: number;
}

const WALKERS: Walker[] = [
  { name: "Harry", scale: 1, variant: "plain", path: ["gryffindor", "greatHall", "courtyard"], duration: 26 },
  { name: "Hermione", scale: 1, variant: "plain", path: ["library", "greatHall", "astronomy"], duration: 30 },
  { name: "Ron", scale: 1, variant: "plain", path: ["gryffindor", "library", "greatHall"], duration: 28 },
  { name: "Dumbledore", scale: 1.08, variant: "beard", path: ["astronomy", "greatHall", "courtyard"], duration: 34 },
  { name: "Snape", scale: 1.05, variant: "cape", path: ["dungeons", "courtyard", "greatHall"], duration: 32 },
  { name: "Hagrid", scale: 1.5, variant: "giant", path: ["hut", "courtyard"], duration: 24 },
];

// A small line-art walking figure, drawn around the origin (feet at y≈0).
function Figure({ scale, variant }: { scale: number; variant: Walker["variant"] }) {
  return (
    <g
      transform={`scale(${scale})`}
      stroke="#3b2f23"
      strokeWidth={1.4}
      fill="none"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <circle cx="0" cy="-23" r="4" />
      <line x1="0" y1="-19" x2="0" y2="-8" />
      <line x1="0" y1="-16" x2="-6" y2="-10" />
      <line x1="0" y1="-16" x2="6" y2="-12" />
      <line x1="0" y1="-8" x2="-5" y2="0" />
      <line x1="0" y1="-8" x2="6" y2="-1" />
      {variant === "beard" && (
        <>
          <path d="M-4 -20l4 10 4-10" />
          <path d="M-5 -27l5 -6 5 6z" />
        </>
      )}
      {variant === "cape" && <path d="M-5 -19l-3 14h16l-3-14" />}
      {variant === "giant" && <path d="M-7 -19l-2 16h18l-2-16" />}
    </g>
  );
}

function Tower({ x, y, h = 90, label }: { x: number; y: number; h?: number; label: string }) {
  return (
    <g stroke="#3b2f23" strokeWidth={1.3} fill="none">
      <rect x={x - 16} y={y - h} width={32} height={h} />
      <path d={`M${x - 20} ${y - h} h40`} />
      <path d={`M${x - 16} ${y - h} l16 -22 l16 22`} />
      <path d={`M${x - 14} ${y - h} v-6 h6 v6 M${x - 2} ${y - h} v-6 h6 v6 M${x + 10} ${y - h} v-6 h6 v6`} />
      <text x={x} y={y + 16} textAnchor="middle" fontSize="15" fill="#3b2f23" style={{ fontFamily: "var(--font-old)" }}>
        {label}
      </text>
    </g>
  );
}

export function MaraudersMap() {
  const svgRef = useRef<SVGSVGElement>(null);

  useEffect(() => {
    let mounted = true;
    const tweens: gsap.core.Timeline[] = [];

    (async () => {
      const gsap = (await import("gsap")).default;
      const svg = svgRef.current;
      if (!svg || !mounted) return;

      WALKERS.forEach((w, i) => {
        const group = svg.querySelector<SVGGElement>(`[data-walker="${i}"]`);
        const bob = svg.querySelector<SVGGElement>(`[data-bob="${i}"]`);
        if (!group) return;
        const pts = w.path.map((k) => LOC[k]);
        gsap.set(group, { x: pts[0].x, y: pts[0].y });

        const tl = gsap.timeline({ repeat: -1, yoyo: true });
        const seg = w.duration / (pts.length - 1 || 1);
        pts.slice(1).forEach((p) => {
          tl.to(group, { x: p.x, y: p.y, duration: seg, ease: "none" });
        });
        tweens.push(tl);

        if (bob) {
          tweens.push(
            gsap.timeline({ repeat: -1, yoyo: true }).to(bob, {
              y: -3,
              duration: 0.42,
              ease: "sine.inOut",
            }),
          );
        }
      });
    })();

    return () => {
      mounted = false;
      tweens.forEach((t) => t.kill());
    };
  }, []);

  return (
    <div className="pointer-events-none fixed inset-0 -z-10 opacity-[0.22]" aria-hidden>
      <svg
        ref={svgRef}
        viewBox={`0 0 ${VW} ${VH}`}
        preserveAspectRatio="xMidYMid slice"
        className="h-full w-full"
      >
        {/* decorative double border */}
        <rect x="14" y="14" width={VW - 28} height={VH - 28} fill="none" stroke="#3b2f23" strokeWidth="2" />
        <rect x="22" y="22" width={VW - 44} height={VH - 44} fill="none" stroke="#3b2f23" strokeWidth="0.8" />

        {/* corridors */}
        <g stroke="#3b2f23" strokeWidth="1" strokeDasharray="2 5" opacity="0.8">
          {CORRIDORS.map(([a, b], i) => (
            <line key={i} x1={LOC[a].x} y1={LOC[a].y} x2={LOC[b].x} y2={LOC[b].y} />
          ))}
        </g>

        {/* locations */}
        <Tower x={LOC.gryffindor.x} y={LOC.gryffindor.y} label="Gryffindor Tower" />
        <Tower x={LOC.astronomy.x} y={LOC.astronomy.y} h={110} label="Astronomy Tower" />

        {/* Great Hall */}
        <g stroke="#3b2f23" strokeWidth="1.3" fill="none">
          <rect x={LOC.greatHall.x - 70} y={LOC.greatHall.y - 38} width={140} height={70} />
          <path d={`M${LOC.greatHall.x - 70} ${LOC.greatHall.y - 38} l70 -26 l70 26`} />
          <path d={`M${LOC.greatHall.x - 50} ${LOC.greatHall.y + 32} v-30 a8 8 0 0116 0 v30 M${LOC.greatHall.x + 34} ${LOC.greatHall.y + 32} v-30 a8 8 0 0116 0 v30`} />
          <text x={LOC.greatHall.x} y={LOC.greatHall.y + 50} textAnchor="middle" fontSize="16" fill="#3b2f23" style={{ fontFamily: "var(--font-old)" }}>
            The Great Hall
          </text>
        </g>

        {/* Library */}
        <g stroke="#3b2f23" strokeWidth="1.3" fill="none">
          <rect x={LOC.library.x - 40} y={LOC.library.y - 30} width={80} height={56} />
          <path d={`M${LOC.library.x - 24} ${LOC.library.y - 30} v56 M${LOC.library.x} ${LOC.library.y - 30} v56 M${LOC.library.x + 22} ${LOC.library.y - 30} v56`} />
          <text x={LOC.library.x} y={LOC.library.y + 44} textAnchor="middle" fontSize="14" fill="#3b2f23" style={{ fontFamily: "var(--font-old)" }}>
            Library
          </text>
        </g>

        {/* Hagrid's hut */}
        <g stroke="#3b2f23" strokeWidth="1.3" fill="none">
          <rect x={LOC.hut.x - 22} y={LOC.hut.y - 18} width={44} height={34} />
          <path d={`M${LOC.hut.x - 26} ${LOC.hut.y - 18} l26 -16 l26 16`} />
          <text x={LOC.hut.x} y={LOC.hut.y + 34} textAnchor="middle" fontSize="13" fill="#3b2f23" style={{ fontFamily: "var(--font-old)" }}>
            Hagrid&apos;s Hut
          </text>
        </g>

        {/* Dungeons */}
        <g stroke="#3b2f23" strokeWidth="1.3" fill="none">
          <path d={`M${LOC.dungeons.x - 40} ${LOC.dungeons.y} a40 26 0 0180 0`} />
          <path d={`M${LOC.dungeons.x - 26} ${LOC.dungeons.y} v-18 M${LOC.dungeons.x} ${LOC.dungeons.y} v-24 M${LOC.dungeons.x + 26} ${LOC.dungeons.y} v-18`} />
          <text x={LOC.dungeons.x} y={LOC.dungeons.y + 22} textAnchor="middle" fontSize="13" fill="#3b2f23" style={{ fontFamily: "var(--font-old)" }}>
            Dungeons
          </text>
        </g>

        {/* The Great Lake */}
        <g stroke="#3b2f23" strokeWidth="1" fill="none" opacity="0.8">
          <path d="M70 720 q60 -26 140 0 t140 0" />
          <path d="M70 740 q60 -26 140 0 t140 0" />
          <text x="210" y="700" textAnchor="middle" fontSize="14" fill="#3b2f23" fontStyle="italic" style={{ fontFamily: "var(--font-old)" }}>
            The Black Lake
          </text>
        </g>

        {/* compass rose */}
        <g stroke="#3b2f23" strokeWidth="1" fill="none" transform={`translate(${VW - 90}, ${VH - 90})`}>
          <circle r="26" />
          <path d="M0 -26 L6 0 L0 26 L-6 0 Z" />
          <path d="M-26 0 L0 6 L26 0 L0 -6 Z" />
          <text x="0" y="-32" textAnchor="middle" fontSize="11" fill="#3b2f23">N</text>
        </g>

        {/* walking characters */}
        {WALKERS.map((w, i) => (
          <g key={w.name} data-walker={i}>
            <g data-bob={i}>
              <Figure scale={w.scale} variant={w.variant} />
              <text
                x="0"
                y="12"
                textAnchor="middle"
                fontSize="12"
                fill="#3b2f23"
                style={{ fontFamily: "var(--font-old)" }}
              >
                {w.name}
              </text>
            </g>
          </g>
        ))}
      </svg>
    </div>
  );
}
