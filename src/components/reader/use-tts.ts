"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { cleanText, splitIntoSentences } from "@/lib/tts";
import { pickDefaultVoice, sortVoicesForPicker } from "@/lib/voices";

const VOICE_KEY = "lumen:voice";

export interface TtsEngine {
  // Text of the currently displayed section.
  getText: () => string;
  // Advance the rendition to the next section; resolves true if it moved.
  advance: () => Promise<boolean>;
}

export interface TtsController {
  supported: boolean;
  listening: boolean;
  paused: boolean;
  rate: number;
  start: () => void;
  togglePause: () => void;
  stop: () => void;
  setRate: (r: number) => void;
  // Voice selection
  voices: SpeechSynthesisVoice[];
  voiceURI: string | null;
  setVoice: (uri: string) => void;
}

/**
 * Read-aloud controller built on the Web Speech API. Speaks the current
 * section sentence-by-sentence, then auto-advances to the next section —
 * a hands-free, podcast-like listening experience.
 */
export function useTts(engine: TtsEngine): TtsController {
  const supported =
    typeof window !== "undefined" && "speechSynthesis" in window;

  const [listening, setListening] = useState(false);
  const [paused, setPaused] = useState(false);
  const [rate, setRateState] = useState(1);
  const [voices, setVoices] = useState<SpeechSynthesisVoice[]>([]);
  const [voiceURI, setVoiceURI] = useState<string | null>(null);

  const queueRef = useRef<string[]>([]);
  const idxRef = useRef(0);
  const rateRef = useRef(1);
  const voiceRef = useRef<SpeechSynthesisVoice | null>(null);
  const speakCurrentRef = useRef<((gen: number) => void) | null>(null);
  // Bumped on every stop/restart so stale utterance callbacks are ignored.
  const genRef = useRef(0);

  const synth = useCallback(
    () => (supported ? window.speechSynthesis : null),
    [supported],
  );

  // Load available voices (they arrive asynchronously) and choose a pleasant
  // female default, honoring any previously saved choice.
  useEffect(() => {
    const s = supported ? window.speechSynthesis : null;
    if (!s) return;
    const lang =
      (typeof navigator !== "undefined" && navigator.language) || "en";

    const load = () => {
      const list = s.getVoices();
      if (!list.length) return;
      setVoices(list);

      let saved: string | null = null;
      try {
        saved = localStorage.getItem(VOICE_KEY);
      } catch {}
      const chosenUri =
        (saved && list.some((v) => v.voiceURI === saved) && saved) ||
        pickDefaultVoice(list, lang);
      setVoiceURI(chosenUri);
      voiceRef.current = list.find((v) => v.voiceURI === chosenUri) ?? null;
    };

    load();
    s.addEventListener?.("voiceschanged", load);
    return () => s.removeEventListener?.("voiceschanged", load);
  }, [supported]);

  const setVoice = useCallback(
    (uri: string) => {
      const s = synth();
      const v = voices.find((x) => x.voiceURI === uri) ?? null;
      voiceRef.current = v;
      setVoiceURI(uri);
      try {
        localStorage.setItem(VOICE_KEY, uri);
      } catch {}
      // Apply immediately mid-listen by re-speaking the current sentence.
      if (s && listening && !paused) {
        s.cancel();
        const gen = ++genRef.current;
        speakCurrentRef.current?.(gen);
      }
    },
    // speakCurrent referenced via ref to avoid ordering issues.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [voices, listening, paused, synth],
  );

  const speakCurrent = useCallback(
    (gen: number) => {
      if (gen !== genRef.current) return;
      const s = synth();
      if (!s) return;

      if (idxRef.current >= queueRef.current.length) {
        // Section finished — try to advance to the next one.
        engine
          .advance()
          .then((moved) => {
            if (gen !== genRef.current) return;
            if (!moved) {
              setListening(false);
              return;
            }
            // Give the new section a moment to render, then continue.
            setTimeout(() => {
              if (gen !== genRef.current) return;
              queueRef.current = splitIntoSentences(cleanText(engine.getText()));
              idxRef.current = 0;
              speakCurrent(gen);
            }, 400);
          })
          .catch(() => {
            if (gen === genRef.current) setListening(false);
          });
        return;
      }

      const utter = new SpeechSynthesisUtterance(queueRef.current[idxRef.current]);
      utter.rate = rateRef.current;
      // Prefer the chosen voice (defaults to a natural female voice); fall back
      // to a language match so engines that need a voice still speak.
      const chosen = voiceRef.current;
      if (chosen) {
        utter.voice = chosen;
        utter.lang = chosen.lang;
      } else {
        utter.lang =
          (typeof navigator !== "undefined" && navigator.language) || "en-US";
        const all = s.getVoices();
        const voice =
          all.find((v) => v.lang === utter.lang) ||
          all.find((v) => v.lang?.startsWith(utter.lang.slice(0, 2)));
        if (voice) utter.voice = voice;
      }
      utter.onend = () => {
        if (gen !== genRef.current) return;
        idxRef.current += 1;
        speakCurrent(gen);
      };
      utter.onerror = () => {
        if (gen !== genRef.current) return;
        idxRef.current += 1;
        speakCurrent(gen);
      };
      s.speak(utter);
    },
    [engine, synth],
  );

  const start = useCallback(() => {
    const s = synth();
    if (!s) return;
    s.cancel();
    // Some engines get stuck in a paused state, or only populate voices after a
    // first call — nudge both so the first utterance reliably speaks.
    s.resume();
    s.getVoices();
    const gen = ++genRef.current;
    queueRef.current = splitIntoSentences(cleanText(engine.getText()));
    idxRef.current = 0;
    setPaused(false);
    setListening(true);
    if (queueRef.current.length === 0) {
      // Nothing on this section — jump ahead.
      engine.advance().then((moved) => {
        if (!moved) setListening(false);
        else
          setTimeout(() => {
            queueRef.current = splitIntoSentences(cleanText(engine.getText()));
            idxRef.current = 0;
            speakCurrent(gen);
          }, 400);
      });
      return;
    }
    speakCurrent(gen);
  }, [engine, speakCurrent, synth]);

  const stop = useCallback(() => {
    genRef.current += 1;
    synth()?.cancel();
    setListening(false);
    setPaused(false);
  }, [synth]);

  const togglePause = useCallback(() => {
    const s = synth();
    if (!s) return;
    if (paused) {
      s.resume();
      setPaused(false);
    } else {
      s.pause();
      setPaused(true);
    }
  }, [paused, synth]);

  const setRate = useCallback(
    (r: number) => {
      const clamped = Math.min(2.5, Math.max(0.5, r));
      rateRef.current = clamped;
      setRateState(clamped);
      // Rate can't change mid-utterance; restart the current sentence.
      const s = synth();
      if (s && listening && !paused) {
        s.cancel();
        const gen = ++genRef.current;
        speakCurrent(gen);
      }
    },
    [listening, paused, speakCurrent, synth],
  );

  // Keep a ref to the latest speakCurrent so setVoice (declared earlier) can
  // restart playback after a voice change.
  useEffect(() => {
    speakCurrentRef.current = speakCurrent;
  }, [speakCurrent]);

  // Stop speaking if the component unmounts (e.g. leaving the reader).
  useEffect(() => {
    return () => {
      genRef.current += 1;
      if (typeof window !== "undefined" && "speechSynthesis" in window) {
        window.speechSynthesis.cancel();
      }
    };
  }, []);

  const lang =
    (typeof navigator !== "undefined" && navigator.language) || "en";

  return {
    supported,
    listening,
    paused,
    rate,
    start,
    togglePause,
    stop,
    setRate,
    voices: sortVoicesForPicker(voices, lang),
    voiceURI,
    setVoice,
  };
}
