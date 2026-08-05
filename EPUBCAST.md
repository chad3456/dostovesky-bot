# EpubCast

Upload an EPUB and get a podcast: two hosts discuss the book **one chapter per
episode**. Episodes unlock in order — finish one to open the next.

Open it at **`/epubcast`**.

## Free by default — nothing to pay, nothing to sign up for

The default engine costs **£0 / $0**. There is no API key, no account, and no
per-episode billing anywhere in the default path:

- **The script** is composed on your own server from the chapter's own text —
  its quotable passages, recurring names and themes — plus background from
  **keyless public APIs**: Wikipedia, Wikiquote, Open Library and Project
  Gutenberg. All four are free and need no registration.
- **The audio** is your browser's built-in speech engine, with a contrasting
  voice per host. No TTS service, no audio bill.

A full 25-minute episode generates in about a second.

**The honest trade-off:** the free engine writes a *structured, well-informed
discussion*, not a spontaneous one. It quotes the chapter accurately, follows
its themes, and cites real sources — but its connective phrasing comes from a
library of craft observations rather than being written fresh, so across a
25-minute episode a stock line may recur a few times. It is genuinely
listenable; it is not a human podcast, and it isn't pretending to be.

## Optional: the hosted Claude engine

Better prose, at a real cost — so it is **strictly opt-in and cannot switch on
by accident**. It requires *both*:

```bash
EPUBCAST_ENGINE=claude
ANTHROPIC_API_KEY=sk-ant-...
```

Setting only the key changes nothing; the free engine keeps running. Rough cost
when enabled: **$0.50–$1.50 per episode** on `claude-opus-5` pricing. That path
uses adaptive thinking, `effort: "high"`, Anthropic's server-side web search,
streaming, and a refusal fallback to `claude-opus-4-8` (skipped gracefully if
the beta isn't enabled on the account).

The UI always states which engine is active, so you can see at a glance whether
anything is being billed.

## How an episode is built

Both engines run the same five steps, **one step per HTTP request**, so no
single request runs long enough to hit a serverless timeout:

| Step | What happens |
|---|---|
| 1 | **Research** — background on the book and its themes; sources are stored and shown under the episode. |
| 2–5 | **Script** — four segments: open → close reading → the wider conversation → themes and close. |

Four segments of ~900 spoken words ≈ **3,600 words ≈ 24 minutes** at 150 wpm,
landing the 20–25 minute goal. A unit test asserts that arithmetic, and the free
composer keeps producing beats until the budget is met — so it hits the target
rather than hoping to.

**The hosts:** *Nora* (literary analyst — close reading, craft, tradition) and
*Julian* (curious co-host — reacts as a smart first-time reader and pushes back).

## Playback

Each host gets a contrasting voice, auto-picked from the device (female for
Nora, male for Julian), overridable per host and remembered locally. The
transcript follows along, highlights the live line, and any line can be clicked
to jump there. Reaching the end marks the episode listened and unlocks the next
chapter.

Voice quality is the device's: excellent on iOS/macOS, good on Android, more
synthetic on some Windows machines.

## Notes and limits

- Front matter and covers are filtered out (<220 words), so episodes map to real
  chapters. Books cap at 60 episodes per upload.
- Chapter text is stored with the episode at upload, so generation never
  re-parses the EPUB.
- A failed generation stores its error and offers **Retry**; finished segments
  are kept, so a retry resumes rather than restarts.
- Research is best-effort: if the network is unavailable, every source is
  skipped and the episode still generates, with the hosts saying plainly that
  they found little published commentary rather than inventing any.
- Locked episodes are refused **server-side** (403) for both reading and
  generating — not merely hidden in the UI.
