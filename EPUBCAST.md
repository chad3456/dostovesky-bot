# EpubCast

Upload an EPUB and get a podcast: two hosts discuss the book **one chapter per
episode**, weaving in how that book and its themes are actually discussed
across the internet. Episodes unlock in order — finish one to open the next.

Open it at **`/epubcast`**.

## How an episode is made

Each episode is generated in **five short steps**, one model turn per HTTP
request, so no single request runs long enough to hit a serverless timeout:

| Step | What happens |
|---|---|
| 1 | **Research** — Claude runs Anthropic's server-side **web search** over how this book/chapter is discussed (criticism, essays, recurring reader debates, context) and writes a briefing. Sources are kept and shown under the episode. |
| 2–5 | **Script** — four dialogue segments (open → close reading → the wider online conversation → themes and close), each continuing from the last. |

The four segments target ~900 spoken words each ≈ **3,600 words ≈ 24 minutes**
at a 150 wpm conversational rate, which lands inside the 20–25 minute goal.
There's a unit test asserting that arithmetic so the target can't silently drift.

**The hosts:** *Nora* (literary analyst — close reading, craft, tradition) and
*Julian* (curious co-host — reacts as a smart first-time reader, pushes back,
brings in what people say online).

## Setup

Generation calls the Claude API, so it needs a key:

```bash
ANTHROPIC_API_KEY=sk-ant-...
```

On Vercel: **Settings → Environment Variables → Production**, then redeploy.
Uploading, browsing and listening all work without a key — only *recording* an
episode needs it. The UI says so explicitly instead of failing mysteriously.

Model: **`claude-opus-5`** with adaptive thinking and `effort: "high"`. Requests
stream (so long generations can't hit an HTTP timeout), resume server-tool
`pause_turn`s, and carry a server-side refusal fallback to `claude-opus-4-8` —
if that beta isn't enabled on the account, the call is retried without it rather
than failing the episode.

## Playback

Audio uses the browser's built-in speech engine, so there's **no audio bill and
no extra key**. Each host gets a contrasting voice (female for Nora, male for
Julian, auto-picked from the device and overridable per host, remembered
locally). The transcript follows along, highlights the live line, and any line
can be clicked to jump there. Reaching the end marks the episode listened and
unlocks the next chapter.

Voice quality is the device's, not ours: excellent on iOS/macOS, good on
Android, more synthetic on some Windows machines.

## Cost

Roughly **$0.50–$1.50 per episode** on Opus 5 pricing ($5/$25 per million input/
output tokens), depending on chapter length and how much the research step
searches. A 30-chapter book generated end to end is therefore tens of dollars —
which is exactly why episodes are generated **on demand, one at a time**, rather
than the whole book at upload.

## Notes and limits

- Front matter, covers and other very short sections are filtered out
  (<220 words), so episodes map to real chapters. Books are capped at 60
  episodes per upload.
- Chapter text is stored with the episode at upload, so generation never
  re-parses the EPUB.
- A failed generation stores its error on the episode and shows a **Retry**
  button; completed segments are kept, so a retry resumes rather than restarts.
- The prompt forbids inventing quotes, facts or sources, and tells the hosts to
  say so plainly when the web turns up little about a specific book.
