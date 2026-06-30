"use client";

import { useEffect, useRef, useState } from "react";
import { PHRASE, phraseBeats, noteFreq } from "@/lib/spell-song";

// Optional: drop in your own licensed track via this env var and it plays
// instead of the synthesized theme.
const EXTERNAL_URL = process.env.NEXT_PUBLIC_THEME_MUSIC_URL || "";
const BPM = 60; // slow, dreamy

export function MusicToggle() {
  const [playing, setPlaying] = useState(false);
  const ctxRef = useRef<AudioContext | null>(null);
  const masterRef = useRef<GainNode | null>(null);
  const audioElRef = useRef<HTMLAudioElement | null>(null);
  const schedulerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const stateRef = useRef({ nextNoteTime: 0, index: 0, base: 0 });

  // Synthesize one bell-like note.
  function playNote(
    ctx: AudioContext,
    master: GainNode,
    freq: number,
    time: number,
    dur: number,
    gain: number,
  ) {
    const env = ctx.createGain();
    env.connect(master);
    env.gain.setValueAtTime(0.0001, time);
    env.gain.exponentialRampToValueAtTime(gain, time + 0.02);
    env.gain.exponentialRampToValueAtTime(0.0001, time + dur);

    const osc = ctx.createOscillator();
    osc.type = "triangle";
    osc.frequency.value = freq;
    osc.connect(env);

    const shimmer = ctx.createOscillator();
    shimmer.type = "sine";
    shimmer.frequency.value = freq * 2;
    const shimmerGain = ctx.createGain();
    shimmerGain.gain.value = 0.25;
    shimmer.connect(shimmerGain);
    shimmerGain.connect(env);

    osc.start(time);
    shimmer.start(time);
    osc.stop(time + dur + 0.05);
    shimmer.stop(time + dur + 0.05);
  }

  function startSynth() {
    const Ctx =
      window.AudioContext ||
      (window as unknown as { webkitAudioContext: typeof AudioContext })
        .webkitAudioContext;
    const ctx = new Ctx();
    const master = ctx.createGain();
    master.gain.value = 0.0001;
    master.gain.exponentialRampToValueAtTime(0.16, ctx.currentTime + 1.5);
    master.connect(ctx.destination);
    ctxRef.current = ctx;
    masterRef.current = master;

    const spb = 60 / BPM; // seconds per beat
    const loopBeats = phraseBeats();
    stateRef.current = { nextNoteTime: ctx.currentTime + 0.1, index: 0, base: ctx.currentTime + 0.1 };

    schedulerRef.current = setInterval(() => {
      const s = stateRef.current;
      // Schedule a little ahead of the playhead.
      while (s.base + PHRASE[s.index].beat * spb < ctx.currentTime + 0.2) {
        const n = PHRASE[s.index];
        playNote(ctx, master, noteFreq(n.semis), s.base + n.beat * spb, n.dur * spb, n.gain);
        s.index += 1;
        if (s.index >= PHRASE.length) {
          s.index = 0;
          s.base += loopBeats * spb;
        }
      }
    }, 60);
  }

  function stopSynth() {
    if (schedulerRef.current) clearInterval(schedulerRef.current);
    schedulerRef.current = null;
    const ctx = ctxRef.current;
    const master = masterRef.current;
    if (ctx && master) {
      try {
        master.gain.cancelScheduledValues(ctx.currentTime);
        master.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + 0.4);
      } catch {}
      setTimeout(() => ctx.close().catch(() => {}), 600);
    }
    ctxRef.current = null;
    masterRef.current = null;
  }

  function toggle() {
    if (playing) {
      if (EXTERNAL_URL) audioElRef.current?.pause();
      else stopSynth();
      setPlaying(false);
      return;
    }
    // Must run inside the click gesture to satisfy autoplay policies.
    if (EXTERNAL_URL) {
      const el = audioElRef.current;
      if (el) {
        el.volume = 0.4;
        el.loop = true;
        el.play().catch(() => {});
      }
    } else {
      try {
        startSynth();
      } catch {
        return;
      }
    }
    setPlaying(true);
  }

  useEffect(() => {
    const scheduler = schedulerRef;
    const ctx = ctxRef;
    const audioEl = audioElRef;
    return () => {
      if (scheduler.current) clearInterval(scheduler.current);
      ctx.current?.close().catch(() => {});
      audioEl.current?.pause();
    };
  }, []);

  return (
    <>
      {EXTERNAL_URL && (
        // eslint-disable-next-line jsx-a11y/media-has-caption
        <audio ref={audioElRef} src={EXTERNAL_URL} preload="none" />
      )}
      <button
        type="button"
        onClick={toggle}
        aria-pressed={playing}
        className={`fixed bottom-16 left-4 z-[59] rounded-full border border-parchment-border bg-parchment-light/90 px-4 py-2 text-xs font-semibold text-brand-800 shadow-lg backdrop-blur transition hover:-translate-y-0.5 ${
          playing ? "" : "animate-pulse"
        }`}
        title={playing ? "Silence the enchantment" : "Play the enchantment theme"}
      >
        {playing ? "🎵 Theme playing" : "🔈 Play theme"}
      </button>
    </>
  );
}
