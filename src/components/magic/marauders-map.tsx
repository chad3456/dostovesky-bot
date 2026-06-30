"use client";

import { useEffect, useRef } from "react";

const VW = 1200;
const VH = 800;

const LOC = {
  gryffindor: { x: 180, y: 190 },
  astronomy: { x: 1010, y: 200 },
  greatHall: { x: 600, y: 380 },
  library: { x: 300, y: 410 },
  courtyard: { x: 600, y: 560 },
  dungeons: { x: 980, y: 650 },
  hut: { x: 240, y: 660 },
};

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

const STARS = Array.from({ length: 16 }, (_, i) => ({
  x: (i * 137.5) % VW,
  y: (i * 223.1) % VH,
  r: 3 + ((i * 7) % 4),
}));

function Star({ x, y, r }: { x: number; y: number; r: number }) {
  return (
    <path
      data-star
      d={`M${x} ${y - r} L${x + r * 0.28} ${y - r * 0.28} L${x + r} ${y} L${x + r * 0.28} ${y + r * 0.28} L${x} ${y + r} L${x - r * 0.28} ${y + r * 0.28} L${x - r} ${y} L${x - r * 0.28} ${y - r * 0.28} Z`}
      fill="#3b2f23"
    />
  );
}

function Figure({ scale, variant }: { scale: number; variant: Walker["variant"] }) {
  return (
    <g transform={`scale(${scale})`} stroke="#3b2f23" strokeWidth={1.4} fill="none" strokeLinecap="round" strokeLinejoin="round">
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

// A ribbon banner with notched ends.
function Banner({ cx, cy, w, children, size = 26 }: { cx: number; cy: number; w: number; children: React.ReactNode; size?: number }) {
  const h = size * 1.7;
  const x = cx - w / 2;
  const y = cy - h / 2;
  const notch = 16;
  return (
    <g data-banner stroke="#3b2f23" strokeWidth={1.3} fill="none">
      <path
        d={`M${x} ${y} H${x + w} L${x + w - notch} ${cy} L${x + w} ${y + h} H${x} L${x + notch} ${cy} Z`}
      />
      <text x={cx} y={cy + size * 0.34} textAnchor="middle" fontSize={size} fill="#3b2f23" stroke="none" style={{ fontFamily: "var(--font-display)" }}>
        {children}
      </text>
    </g>
  );
}

export function MaraudersMap() {
  const svgRef = useRef<SVGSVGElement>(null);

  useEffect(() => {
    let mounted = true;
    const tweens: gsap.core.Animation[] = [];

    (async () => {
      const gsap = (await import("gsap")).default;
      const svg = svgRef.current;
      if (!svg || !mounted) return;

      // Walkers pace the corridors.
      WALKERS.forEach((w, i) => {
        const group = svg.querySelector<SVGGElement>(`[data-walker="${i}"]`);
        const bob = svg.querySelector<SVGGElement>(`[data-bob="${i}"]`);
        if (!group) return;
        const pts = w.path.map((k) => LOC[k]);
        gsap.set(group, { x: pts[0].x, y: pts[0].y });
        const tl = gsap.timeline({ repeat: -1, yoyo: true });
        const seg = w.duration / (pts.length - 1 || 1);
        pts.slice(1).forEach((p) => tl.to(group, { x: p.x, y: p.y, duration: seg, ease: "none" }));
        tweens.push(tl);
        if (bob) tweens.push(gsap.to(bob, { y: -3, duration: 0.42, ease: "sine.inOut", repeat: -1, yoyo: true }));
      });

      // Flowing ink along the corridors.
      svg.querySelectorAll<SVGLineElement>("[data-flow]").forEach((line) => {
        tweens.push(gsap.to(line, { strokeDashoffset: -14, duration: 1, ease: "none", repeat: -1 }));
      });

      // Twinkling stars.
      svg.querySelectorAll<SVGPathElement>("[data-star]").forEach((star, i) => {
        gsap.set(star, { transformOrigin: "center", opacity: 0.3 });
        tweens.push(
          gsap.to(star, {
            opacity: 0.95,
            scale: 1.3,
            duration: 1.2 + (i % 5) * 0.3,
            ease: "sine.inOut",
            repeat: -1,
            yoyo: true,
            delay: (i % 7) * 0.4,
          }),
        );
      });

      // Banners unfurl on first paint.
      svg.querySelectorAll<SVGGElement>("[data-banner]").forEach((b, i) => {
        gsap.set(b, { transformOrigin: "center", scaleX: 0, opacity: 0 });
        tweens.push(
          gsap.to(b, { scaleX: 1, opacity: 1, duration: 1.1, ease: "back.out(1.6)", delay: 0.3 + i * 0.25 }),
        );
      });
    })();

    return () => {
      mounted = false;
      tweens.forEach((t) => t.kill());
    };
  }, []);

  return (
    <div className="pointer-events-none fixed inset-0 -z-10 opacity-[0.22]" aria-hidden>
      <svg ref={svgRef} viewBox={`0 0 ${VW} ${VH}`} preserveAspectRatio="xMidYMid slice" className="h-full w-full">
        <defs>
          <path id="curveProwl" d="M120 150 q220 -60 430 -6" fill="none" />
          <path id="curveMischief" d="M110 700 q160 44 340 8" fill="none" />
          <path id="curveHall" d="M70 470 q120 -34 230 0" fill="none" />
        </defs>

        {/* double border */}
        <rect x="14" y="14" width={VW - 28} height={VH - 28} fill="none" stroke="#3b2f23" strokeWidth="2" />
        <rect x="22" y="22" width={VW - 44} height={VH - 44} fill="none" stroke="#3b2f23" strokeWidth="0.8" />

        {STARS.map((s, i) => (
          <Star key={i} {...s} />
        ))}

        {/* corridors with flowing ink */}
        <g stroke="#3b2f23" strokeWidth="1" opacity="0.85">
          {CORRIDORS.map(([a, b], i) => (
            <line
              key={i}
              data-flow
              x1={LOC[a].x}
              y1={LOC[a].y}
              x2={LOC[b].x}
              y2={LOC[b].y}
              strokeDasharray="2 6"
            />
          ))}
        </g>

        {/* curved calligraphic labels */}
        <g fill="#3b2f23" style={{ fontFamily: "var(--font-display)" }} opacity="0.9">
          <text fontSize="30">
            <textPath href="#curveProwl" startOffset="50%" textAnchor="middle">
              Prowling Passage
            </textPath>
          </text>
          <text fontSize="30">
            <textPath href="#curveMischief" startOffset="50%" textAnchor="middle">
              Mischief Managed
            </textPath>
          </text>
          <text fontSize="24">
            <textPath href="#curveHall" startOffset="50%" textAnchor="middle">
              Hesperius Hall
            </textPath>
          </text>
        </g>

        {/* locations */}
        <Tower x={LOC.gryffindor.x} y={LOC.gryffindor.y} label="Gryffindor Tower" />
        <Tower x={LOC.astronomy.x} y={LOC.astronomy.y} h={110} label="Astronomy Tower" />

        <g stroke="#3b2f23" strokeWidth="1.3" fill="none">
          <rect x={LOC.greatHall.x - 70} y={LOC.greatHall.y - 38} width={140} height={70} />
          <path d={`M${LOC.greatHall.x - 70} ${LOC.greatHall.y - 38} l70 -26 l70 26`} />
          <path d={`M${LOC.greatHall.x - 50} ${LOC.greatHall.y + 32} v-30 a8 8 0 0116 0 v30 M${LOC.greatHall.x + 34} ${LOC.greatHall.y + 32} v-30 a8 8 0 0116 0 v30`} />
          <text x={LOC.greatHall.x} y={LOC.greatHall.y + 50} textAnchor="middle" fontSize="16" fill="#3b2f23" style={{ fontFamily: "var(--font-old)" }}>
            The Great Hall
          </text>
        </g>

        <g stroke="#3b2f23" strokeWidth="1.3" fill="none">
          <rect x={LOC.library.x - 40} y={LOC.library.y - 30} width={80} height={56} />
          <path d={`M${LOC.library.x - 24} ${LOC.library.y - 30} v56 M${LOC.library.x} ${LOC.library.y - 30} v56 M${LOC.library.x + 22} ${LOC.library.y - 30} v56`} />
          <text x={LOC.library.x} y={LOC.library.y + 44} textAnchor="middle" fontSize="14" fill="#3b2f23" style={{ fontFamily: "var(--font-old)" }}>
            Library
          </text>
        </g>

        <g stroke="#3b2f23" strokeWidth="1.3" fill="none">
          <rect x={LOC.hut.x - 22} y={LOC.hut.y - 18} width={44} height={34} />
          <path d={`M${LOC.hut.x - 26} ${LOC.hut.y - 18} l26 -16 l26 16`} />
          <text x={LOC.hut.x} y={LOC.hut.y + 34} textAnchor="middle" fontSize="13" fill="#3b2f23" style={{ fontFamily: "var(--font-old)" }}>
            Hagrid&apos;s Hut
          </text>
        </g>

        <g stroke="#3b2f23" strokeWidth="1.3" fill="none">
          <path d={`M${LOC.dungeons.x - 40} ${LOC.dungeons.y} a40 26 0 0180 0`} />
          <path d={`M${LOC.dungeons.x - 26} ${LOC.dungeons.y} v-18 M${LOC.dungeons.x} ${LOC.dungeons.y} v-24 M${LOC.dungeons.x + 26} ${LOC.dungeons.y} v-18`} />
          <text x={LOC.dungeons.x} y={LOC.dungeons.y + 22} textAnchor="middle" fontSize="13" fill="#3b2f23" style={{ fontFamily: "var(--font-old)" }}>
            Dungeons
          </text>
        </g>

        <g stroke="#3b2f23" strokeWidth="1" fill="none" opacity="0.8">
          <path d="M70 740 q60 -26 140 0 t140 0" />
          <text x="210" y="722" textAnchor="middle" fontSize="14" fill="#3b2f23" fontStyle="italic" style={{ fontFamily: "var(--font-old)" }}>
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

        {/* ornate banners */}
        <Banner cx={600} cy={70} w={460} size={34}>
          The Marauder&apos;s Map
        </Banner>
        <Banner cx={600} cy={754} w={620} size={26}>
          Messrs Moony · Wormtail · Padfoot &amp; Prongs
        </Banner>

        {/* walking characters */}
        {WALKERS.map((w, i) => (
          <g key={w.name} data-walker={i}>
            <g data-bob={i}>
              <Figure scale={w.scale} variant={w.variant} />
              <text x="0" y="12" textAnchor="middle" fontSize="12" fill="#3b2f23" style={{ fontFamily: "var(--font-old)" }}>
                {w.name}
              </text>
            </g>
          </g>
        ))}
      </svg>
    </div>
  );
}
