"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { cleanText, splitIntoSentences } from "@/lib/tts";

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

  const queueRef = useRef<string[]>([]);
  const idxRef = useRef(0);
  const rateRef = useRef(1);
  // Bumped on every stop/restart so stale utterance callbacks are ignored.
  const genRef = useRef(0);

  const synth = useCallback(
    () => (supported ? window.speechSynthesis : null),
    [supported],
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
      // Use a sensible default language/voice so engines that need one speak.
      utter.lang =
        (typeof navigator !== "undefined" && navigator.language) || "en-US";
      const voices = s.getVoices();
      const voice =
        voices.find((v) => v.lang === utter.lang) ||
        voices.find((v) => v.lang?.startsWith(utter.lang.slice(0, 2)));
      if (voice) utter.voice = voice;
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

  // Stop speaking if the component unmounts (e.g. leaving the reader).
  useEffect(() => {
    return () => {
      genRef.current += 1;
      if (typeof window !== "undefined" && "speechSynthesis" in window) {
        window.speechSynthesis.cancel();
      }
    };
  }, []);

  return { supported, listening, paused, rate, start, togglePause, stop, setRate };
}
