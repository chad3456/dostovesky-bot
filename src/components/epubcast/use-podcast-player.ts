"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { pickHostVoices } from "@/lib/voices";
import type { DialogueTurn } from "@/lib/epubcast/script";

const VOICE_A_KEY = "epubcast:voiceA";
const VOICE_B_KEY = "epubcast:voiceB";

export interface PodcastPlayer {
  supported: boolean;
  playing: boolean;
  paused: boolean;
  /** Index of the turn currently being spoken, or -1. */
  index: number;
  rate: number;
  voices: SpeechSynthesisVoice[];
  voiceA: string | null;
  voiceB: string | null;
  play: (from?: number) => void;
  pause: () => void;
  resume: () => void;
  stop: () => void;
  next: () => void;
  previous: () => void;
  setRate: (r: number) => void;
  setVoice: (host: "A" | "B", uri: string) => void;
}

/**
 * Speaks a two-host dialogue with a distinct voice per host, tracking which
 * turn is live so the transcript can follow along. Built on the Web Speech API
 * (no server audio, no API key).
 */
export function usePodcastPlayer(
  turns: DialogueTurn[],
  onFinished?: () => void,
): PodcastPlayer {
  const supported =
    typeof window !== "undefined" && "speechSynthesis" in window;

  const [playing, setPlaying] = useState(false);
  const [paused, setPaused] = useState(false);
  const [index, setIndex] = useState(-1);
  const [rate, setRateState] = useState(1);
  const [voices, setVoices] = useState<SpeechSynthesisVoice[]>([]);
  const [voiceA, setVoiceA] = useState<string | null>(null);
  const [voiceB, setVoiceB] = useState<string | null>(null);

  const turnsRef = useRef(turns);
  turnsRef.current = turns;
  const rateRef = useRef(1);
  const idxRef = useRef(0);
  const genRef = useRef(0);
  const voiceARef = useRef<SpeechSynthesisVoice | null>(null);
  const voiceBRef = useRef<SpeechSynthesisVoice | null>(null);
  const finishedRef = useRef(onFinished);
  finishedRef.current = onFinished;

  const synth = useCallback(
    () => (supported ? window.speechSynthesis : null),
    [supported],
  );

  // Load voices (they arrive asynchronously) and pick a contrasting pair.
  useEffect(() => {
    const s = supported ? window.speechSynthesis : null;
    if (!s) return;
    const lang =
      (typeof navigator !== "undefined" && navigator.language) || "en";

    const load = () => {
      const list = s.getVoices();
      if (!list.length) return;
      setVoices(list);

      let savedA: string | null = null;
      let savedB: string | null = null;
      try {
        savedA = localStorage.getItem(VOICE_A_KEY);
        savedB = localStorage.getItem(VOICE_B_KEY);
      } catch {}

      const picked = pickHostVoices(list, lang);
      const aUri =
        (savedA && list.some((v) => v.voiceURI === savedA) && savedA) ||
        picked.a;
      const bUri =
        (savedB && list.some((v) => v.voiceURI === savedB) && savedB) ||
        picked.b;

      setVoiceA(aUri);
      setVoiceB(bUri);
      voiceARef.current = list.find((v) => v.voiceURI === aUri) ?? null;
      voiceBRef.current = list.find((v) => v.voiceURI === bUri) ?? null;
    };

    load();
    s.addEventListener?.("voiceschanged", load);
    return () => s.removeEventListener?.("voiceschanged", load);
  }, [supported]);

  const speakFrom = useCallback(
    (gen: number, start: number) => {
      const s = synth();
      if (!s) return;
      const list = turnsRef.current;

      const speakOne = (i: number) => {
        if (gen !== genRef.current) return;
        if (i >= list.length) {
          setPlaying(false);
          setIndex(-1);
          finishedRef.current?.();
          return;
        }
        idxRef.current = i;
        setIndex(i);

        const turn = list[i];
        const utter = new SpeechSynthesisUtterance(turn.text);
        utter.rate = rateRef.current;
        const voice = turn.speaker === "A" ? voiceARef.current : voiceBRef.current;
        if (voice) {
          utter.voice = voice;
          utter.lang = voice.lang;
        }
        // A small gap between turns makes the exchange feel like conversation.
        utter.onend = () => {
          if (gen !== genRef.current) return;
          setTimeout(() => speakOne(i + 1), 180);
        };
        utter.onerror = () => {
          if (gen !== genRef.current) return;
          speakOne(i + 1);
        };
        s.speak(utter);
      };

      speakOne(start);
    },
    [synth],
  );

  const play = useCallback(
    (from?: number) => {
      const s = synth();
      if (!s || !turnsRef.current.length) return;
      s.cancel();
      s.resume(); // some engines get stuck paused
      const gen = ++genRef.current;
      setPlaying(true);
      setPaused(false);
      speakFrom(gen, Math.max(0, from ?? idxRef.current ?? 0));
    },
    [speakFrom, synth],
  );

  const pause = useCallback(() => {
    const s = synth();
    if (!s) return;
    s.pause();
    setPaused(true);
  }, [synth]);

  const resume = useCallback(() => {
    const s = synth();
    if (!s) return;
    s.resume();
    setPaused(false);
  }, [synth]);

  const stop = useCallback(() => {
    genRef.current += 1;
    synth()?.cancel();
    setPlaying(false);
    setPaused(false);
    setIndex(-1);
    idxRef.current = 0;
  }, [synth]);

  const jump = useCallback(
    (delta: number) => {
      const target = Math.min(
        Math.max(0, idxRef.current + delta),
        Math.max(0, turnsRef.current.length - 1),
      );
      play(target);
    },
    [play],
  );

  const next = useCallback(() => jump(1), [jump]);
  const previous = useCallback(() => jump(-1), [jump]);

  const setRate = useCallback(
    (r: number) => {
      const clamped = Math.min(2.5, Math.max(0.5, r));
      rateRef.current = clamped;
      setRateState(clamped);
      // Rate can't change mid-utterance; restart the current turn.
      if (playing && !paused) play(idxRef.current);
    },
    [play, playing, paused],
  );

  const setVoice = useCallback(
    (host: "A" | "B", uri: string) => {
      const v = voices.find((x) => x.voiceURI === uri) ?? null;
      if (host === "A") {
        voiceARef.current = v;
        setVoiceA(uri);
        try {
          localStorage.setItem(VOICE_A_KEY, uri);
        } catch {}
      } else {
        voiceBRef.current = v;
        setVoiceB(uri);
        try {
          localStorage.setItem(VOICE_B_KEY, uri);
        } catch {}
      }
      if (playing && !paused) play(idxRef.current);
    },
    [voices, play, playing, paused],
  );

  // Stop speaking when leaving the page.
  useEffect(() => {
    return () => {
      genRef.current += 1;
      if (typeof window !== "undefined" && "speechSynthesis" in window) {
        window.speechSynthesis.cancel();
      }
    };
  }, []);

  return {
    supported,
    playing,
    paused,
    index,
    rate,
    voices,
    voiceA,
    voiceB,
    play,
    pause,
    resume,
    stop,
    next,
    previous,
    setRate,
    setVoice,
  };
}
