"use client";

import { useEffect, useRef } from "react";

/**
 * End-of-book scene: a hand-sketched young girl picks a book off a little
 * stack and settles in to read, among bushes and a curious bird — wobbly
 * single-ink line art in the spirit of hand-drawn portfolio illustration.
 *
 * Choreography (GSAP): the sketch draws itself in stroke by stroke, then the
 * book pops from the stack into her hands, then a gentle idle loop (head
 * tilts, bushes sway, sparkles twinkle, the bird hops). Honors
 * prefers-reduced-motion by skipping straight to the finished drawing.
 */
export function EndScene({
  onClose,
  onRestart,
}: {
  onClose: () => void;
  onRestart: () => void;
}) {
  const svgRef = useRef<SVGSVGElement>(null);

  useEffect(() => {
    let mounted = true;
    const tweens: gsap.core.Animation[] = [];

    (async () => {
      const gsap = (await import("gsap")).default;
      const svg = svgRef.current;
      if (!svg || !mounted) return;

      const reduced = window.matchMedia?.(
        "(prefers-reduced-motion: reduce)",
      ).matches;
      const book = svg.querySelector<SVGGElement>("#end-book");

      if (reduced) {
        if (book) gsap.set(book, { x: 0, y: 0, scale: 1, rotation: 0 });
        return;
      }

      // Prepare the "ink draws itself" effect.
      const drawEls = Array.from(
        svg.querySelectorAll<SVGGeometryElement>("[data-draw]"),
      ).filter((el) => {
        try {
          const len = el.getTotalLength();
          el.style.strokeDasharray = `${len}`;
          el.style.strokeDashoffset = `${len}`;
          return true;
        } catch {
          return false;
        }
      });

      // The book starts on the stack, then flies into her hands.
      if (book) {
        gsap.set(book, {
          x: -86,
          y: 16,
          scale: 0.5,
          rotation: -24,
          transformOrigin: "50% 50%",
        });
      }

      const tl = gsap.timeline();
      tl.to(drawEls, {
        strokeDashoffset: 0,
        duration: 1.7,
        ease: "power1.inOut",
        stagger: 0.05,
      });
      if (book) {
        tl.to(
          book,
          { x: 0, y: 0, scale: 1, rotation: 0, duration: 0.9, ease: "back.out(1.5)" },
          "-=0.3",
        );
      }
      tweens.push(tl);

      // Idle life.
      const head = svg.querySelector("[data-head]");
      if (head) {
        tweens.push(
          gsap.to(head, {
            rotation: 3,
            transformOrigin: "50% 100%",
            duration: 2.2,
            ease: "sine.inOut",
            repeat: -1,
            yoyo: true,
            delay: 2.6,
          }),
        );
      }
      svg.querySelectorAll("[data-sway]").forEach((el, i) => {
        tweens.push(
          gsap.to(el, {
            rotation: i % 2 ? 2 : -2,
            transformOrigin: "50% 100%",
            duration: 2.8 + i * 0.5,
            ease: "sine.inOut",
            repeat: -1,
            yoyo: true,
          }),
        );
      });
      svg.querySelectorAll("[data-spark]").forEach((el, i) => {
        tweens.push(
          gsap.fromTo(
            el,
            { opacity: 0.15 },
            {
              opacity: 1,
              duration: 1 + (i % 3) * 0.35,
              repeat: -1,
              yoyo: true,
              delay: 2 + i * 0.3,
            },
          ),
        );
      });
      const bird = svg.querySelector("[data-bird]");
      if (bird) {
        tweens.push(
          gsap.to(bird, {
            y: -5,
            duration: 0.32,
            ease: "power1.out",
            repeat: -1,
            yoyo: true,
            repeatDelay: 2.4,
            delay: 3,
          }),
        );
      }
    })();

    return () => {
      mounted = false;
      tweens.forEach((t) => t.kill());
    };
  }, []);

  return (
    <div
      className="absolute inset-0 z-30 flex items-center justify-center bg-black/30 p-4 backdrop-blur-[2px]"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-label="The end of the book"
    >
      <div
        className="vintage-card relative w-full max-w-sm animate-fade-in rounded-2xl p-6 text-center"
        onClick={(e) => e.stopPropagation()}
      >
        <button
          type="button"
          onClick={onClose}
          aria-label="Close"
          className="absolute right-3 top-3 rounded-full px-2 py-0.5 text-ink-soft hover:bg-parchment-dark"
        >
          ✕
        </button>

        <svg
          ref={svgRef}
          viewBox="0 0 340 230"
          className="mx-auto block w-full max-w-[300px]"
          role="img"
          aria-label="A girl sitting cross-legged, reading a book among bushes"
        >
          <g
            stroke="#3b2f23"
            strokeWidth="2.2"
            fill="none"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            {/* ground */}
            <path data-draw d="M18 205 q30 6 60 0 t60 0 t60 0 t60 0 t60 0" opacity="0.9" />

            {/* left bush */}
            <g data-sway>
              <path data-draw d="M26 205 q-3 -19 15 -21 q5 -14 20 -10 q13 -8 21 3 q13 2 9 15 q6 11 -9 13" />
              <path data-draw d="M42 186 q2 -8 8 -10" />
              <path data-draw d="M50 190 q6 -2 9 -8" />
            </g>

            {/* right bush */}
            <g data-sway>
              <path data-draw d="M254 205 q-3 -19 15 -21 q5 -14 20 -10 q13 -8 21 3 q13 2 9 15 q6 11 -9 13" />
              <path data-draw d="M270 186 q2 -8 8 -10" />
            </g>

            {/* bird perched on the right bush */}
            <g data-bird transform="translate(288,166)">
              <path data-draw d="M0 4 q3 -9 11 -5 q8 3 3 10 q-9 4 -14 -5" />
              <path data-draw d="M13 -2 l6 2 -6 2" />
              <circle data-draw cx="7" cy="0" r="0.9" />
              <path data-draw d="M4 10 v5 M9 10 v5" strokeWidth="1.6" />
            </g>

            {/* little stack of books she picks from */}
            <path data-draw d="M82 205 v-9 h46 v9" />
            <path data-draw d="M86 196 v-8 h38 v8" />
            <path data-draw d="M105 191.5 v4" strokeWidth="1.4" />

            {/* the girl — head (tilts gently) */}
            <g data-head>
              <circle data-draw cx="200" cy="134" r="17" />
              <path data-draw d="M182 136 q-4 -25 18 -25 q22 0 18 25" />
              <path data-draw d="M182 136 q-2 8 2 13" />
              <path data-draw d="M218 136 q2 8 -2 13" />
              <path data-draw d="M188 122 q6 -7 13 -6" strokeWidth="1.6" />
              {/* innocent closed eyes + smile */}
              <path data-draw d="M191 138 q3 4 7 0" strokeWidth="1.8" />
              <path data-draw d="M202 138 q3 4 7 0" strokeWidth="1.8" />
              <path data-draw d="M196 147 q4 3 8 0" strokeWidth="1.8" />
            </g>

            {/* dress */}
            <path data-draw d="M193 154 q-9 8 -11 24 l-5 14 h46 l-5 -14 q-2 -16 -11 -24" />
            {/* crossed legs + shoes */}
            <path data-draw d="M177 192 q11 11 25 5" />
            <path data-draw d="M223 192 q-11 11 -25 5" />
            <circle data-draw cx="181" cy="199" r="3.5" />
            <circle data-draw cx="219" cy="199" r="3.5" />
            {/* arms reaching to the book */}
            <path data-draw d="M188 160 q-9 9 -3 17" />
            <path data-draw d="M212 160 q9 9 3 17" />

            {/* the open book (starts on the stack, pops into her hands) */}
            <g id="end-book">
              <path data-draw d="M184 176 q8 -7 16 -3 q8 -4 16 3 l-2 13 q-7 -5 -14 -1 q-7 -4 -14 1 z" />
              <path data-draw d="M200 174 v14" strokeWidth="1.6" />
            </g>

            {/* sparkles of wonder */}
            <g data-spark>
              <path data-draw d="M168 104 v10 M163 109 h10" strokeWidth="1.6" />
            </g>
            <g data-spark>
              <path data-draw d="M236 98 v10 M231 103 h10" strokeWidth="1.6" />
            </g>
            <g data-spark>
              <path data-draw d="M156 146 v8 M152 150 h8" strokeWidth="1.6" />
            </g>
          </g>
        </svg>

        <p className="font-display mt-2 text-5xl text-ink">The End</p>
        <p className="mt-1 text-sm italic text-ink-soft">
          …she picked up the book, and wandered off into it.
        </p>

        <div className="mt-5 flex items-center justify-center gap-3">
          <button
            type="button"
            onClick={onRestart}
            className="rounded-full bg-brand-700 px-5 py-2 text-sm font-semibold text-parchment-light transition hover:bg-brand-800"
          >
            Read again
          </button>
          <button
            type="button"
            onClick={onClose}
            className="rounded-full border border-parchment-border px-5 py-2 text-sm font-semibold text-ink transition hover:bg-parchment-dark"
          >
            Stay on this page
          </button>
        </div>
      </div>
    </div>
  );
}
