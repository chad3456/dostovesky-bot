// Build a shareable "quote card" image from a passage and open the device's
// native share sheet (Instagram Stories, Messages, etc.). Falls back to a PNG
// download where Web Share with files isn't supported (most desktops).

export interface QuoteCardInput {
  quote: string;
  title?: string | null;
  author?: string | null;
}

/**
 * Greedy word-wrap. `measure` returns the rendered width of a string; injected
 * so this stays pure and unit-testable without a canvas.
 */
export function wrapText(
  measure: (s: string) => number,
  text: string,
  maxWidth: number,
): string[] {
  const words = text.split(/\s+/).filter(Boolean);
  const lines: string[] = [];
  let line = "";
  for (const word of words) {
    const candidate = line ? `${line} ${word}` : word;
    if (measure(candidate) > maxWidth && line) {
      lines.push(line);
      line = word;
    } else {
      line = candidate;
    }
  }
  if (line) lines.push(line);
  return lines;
}

const W = 1080;
const H = 1920;

/** Render a story-sized (1080×1920) quote card to a PNG blob. */
export async function buildQuoteCard({
  quote,
  title,
  author,
}: QuoteCardInput): Promise<Blob> {
  const canvas = document.createElement("canvas");
  canvas.width = W;
  canvas.height = H;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Canvas not supported");

  // Background gradient (brand indigo).
  const grad = ctx.createLinearGradient(0, 0, W, H);
  grad.addColorStop(0, "#4f46e5");
  grad.addColorStop(1, "#312e81");
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, W, H);

  // Quote text
  const trimmed = quote.length > 360 ? `${quote.slice(0, 357)}…` : quote;
  const fontSize = trimmed.length > 200 ? 54 : trimmed.length > 110 ? 66 : 80;
  ctx.fillStyle = "#ffffff";
  ctx.textAlign = "left";
  ctx.font = `600 ${fontSize}px Georgia, "Times New Roman", serif`;

  const margin = 120;
  const maxWidth = W - margin * 2;
  const lines = wrapText((s) => ctx.measureText(s).width, `“${trimmed}”`, maxWidth);
  const lineHeight = fontSize * 1.32;
  const blockHeight = lines.length * lineHeight;
  let y = Math.max(margin + fontSize, (H - blockHeight) / 2);
  for (const line of lines) {
    ctx.fillText(line, margin, y);
    y += lineHeight;
  }

  // Attribution
  if (author || title) {
    ctx.font = `400 40px Georgia, serif`;
    ctx.fillStyle = "rgba(255,255,255,0.85)";
    const attr = [author, title].filter(Boolean).join(" · ");
    ctx.fillText(`— ${attr}`, margin, y + 40);
  }

  // Footer brand
  ctx.font = `700 44px system-ui, sans-serif`;
  ctx.fillStyle = "rgba(255,255,255,0.9)";
  ctx.fillText("📖 Lumen", margin, H - 120);

  return new Promise<Blob>((resolve, reject) => {
    canvas.toBlob(
      (blob) => (blob ? resolve(blob) : reject(new Error("toBlob failed"))),
      "image/png",
    );
  });
}

export type ShareResult = "shared" | "downloaded" | "unsupported";

/** Build the card and share it (or download it as a fallback). */
export async function shareQuoteImage(input: QuoteCardInput): Promise<ShareResult> {
  const blob = await buildQuoteCard(input);
  const file = new File([blob], "lumen-quote.png", { type: "image/png" });
  const nav = navigator as Navigator & {
    canShare?: (data?: ShareData) => boolean;
  };

  try {
    if (nav.canShare && nav.canShare({ files: [file] }) && nav.share) {
      await nav.share({
        files: [file],
        title: input.title || "From my reading",
        text: input.quote.slice(0, 200),
      });
      return "shared";
    }
  } catch (err) {
    // User cancelled the share sheet, or it failed — fall through to download.
    if ((err as Error)?.name === "AbortError") return "shared";
  }

  // Fallback: download the PNG so it can be posted manually.
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = "lumen-quote.png";
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
  return "downloaded";
}
