import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Download, Share2, Loader2 } from "lucide-react";
import { track } from "@/lib/analytics";

interface ShareCardProps {
  beforeImageUrl: string;
  wipImageUrl: string;
  shareTagline: string;
  shareReactionPill: string;
  shareSub: string;
  sessionMinutes: number;
  roomName: string;
  roomId?: string;
}

const CANVAS_W = 1080;
const CANVAS_H = 1080;
const DISPLAY_SCALE = 0.5;
const SPLIT_Y = 480;
const BRAND_START = SPLIT_Y + 20;
const BRAND_COLOR = "#0D9C6B";

function wrapText(ctx: CanvasRenderingContext2D, text: string, maxWidth: number): string[] {
  const words = text.split(" ");
  const lines: string[] = [];
  let current = "";
  for (const word of words) {
    const test = current ? `${current} ${word}` : word;
    if (ctx.measureText(test).width > maxWidth && current) {
      lines.push(current);
      current = word;
    } else {
      current = test;
    }
  }
  if (current) lines.push(current);
  return lines;
}

async function loadImageCors(url: string): Promise<HTMLImageElement | null> {
  return new Promise((resolve) => {
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => resolve(img);
    img.onerror = () => resolve(null);
    img.src = url;
  });
}

function drawCoverImage(
  ctx: CanvasRenderingContext2D,
  img: HTMLImageElement,
  dx: number,
  dy: number,
  dw: number,
  dh: number
) {
  const scale = Math.max(dw / img.naturalWidth, dh / img.naturalHeight);
  const sw = dw / scale;
  const sh = dh / scale;
  const sx = (img.naturalWidth - sw) / 2;
  const sy = (img.naturalHeight - sh) / 2;
  ctx.drawImage(img, sx, sy, sw, sh, dx, dy, dw, dh);
}

async function generateQRDataUrl(text: string, size: number): Promise<string | null> {
  try {
    const QRCode = await import("https://cdn.jsdelivr.net/npm/qrcode@1.5.3/+esm" as any);
    const dataUrl: string = await QRCode.toDataURL(text, {
      width: size,
      margin: 1,
      color: { dark: "#000000", light: "#FFFFFF" },
    });
    return dataUrl;
  } catch (e) {
    console.warn("QR code generation failed:", e);
    return null;
  }
}

const ShareCard = ({
  beforeImageUrl,
  wipImageUrl,
  shareTagline,
  shareReactionPill,
  shareSub,
  sessionMinutes,
  roomName,
  roomId,
}: ShareCardProps) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [drawing, setDrawing] = useState(true);
  const [fontsLoaded, setFontsLoaded] = useState(false);

  // Preload Nunito fonts
  useEffect(() => {
    const font900 = new FontFace(
      "Nunito",
      "url(https://fonts.gstatic.com/s/nunito/v25/XRXI3I6Li01BKofiOc5wtlZ2di8HDDqhSOQ.woff2)",
      { weight: "900" }
    );
    const font700 = new FontFace(
      "Nunito",
      "url(https://fonts.gstatic.com/s/nunito/v25/XRXI3I6Li01BKofiOc5wtlZ2di8HFjqhSOQ.woff2)",
      { weight: "700" }
    );
    Promise.all([font900.load(), font700.load()])
      .then((fonts) => {
        fonts.forEach((f) => document.fonts.add(f));
        setFontsLoaded(true);
      })
      .catch(() => {
        // Fallback — draw with system fonts
        setFontsLoaded(true);
      });
  }, []);

  useEffect(() => {
    if (!fontsLoaded) return;

    let cancelled = false;
    setDrawing(true);

    const draw = async () => {
      const canvas = canvasRef.current;
      if (!canvas) return;
      const ctx = canvas.getContext("2d");
      if (!ctx) return;

      // Build logo SVG data URL via Blob
      const logoSVG = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 200 56">
  <defs>
    <linearGradient id="lg" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0%" stop-color="#7DD87A"/>
      <stop offset="100%" stop-color="#0D6B3C"/>
    </linearGradient>
  </defs>
  <path d="M28 4 C17 4, 4 12, 4 26 C4 39, 14 50, 28 50 C42 50, 52 40, 52 26 C52 12, 39 4, 28 4 Z" fill="url(#lg)"/>
  <path d="M18 40 C22 32, 30 22, 46 12 C38 22, 28 34, 24 46 Z" fill="rgba(255,255,255,0.68)"/>
  <path d="M44 8 L46 4 L48 8 L52 10 L48 12 L46 16 L44 12 L40 10 Z" fill="#C5F07A"/>
  <path d="M50 14 L51 12 L52 14 L54 15 L52 16 L51 18 L50 16 L48 15 Z" fill="#C5F07A"/>
  <text x="64" y="37" font-family="Nunito, Arial Rounded MT Bold, sans-serif" font-weight="800" font-size="32" fill="#ffffff" letter-spacing="-0.5">TidyMate</text>
</svg>`;
      const svgBlob = new Blob([logoSVG], { type: "image/svg+xml" });
      const logoUrl = URL.createObjectURL(svgBlob);

      const [beforeImg, afterImg, logoImg, qrDataUrl] = await Promise.all([
        loadImageCors(beforeImageUrl),
        loadImageCors(wipImageUrl),
        loadImageCors(logoUrl),
        generateQRDataUrl("https://tidymate.app", 120),
      ]);

      URL.revokeObjectURL(logoUrl);
      if (cancelled) return;

      // ─── Background ──────────────────────────────────────────────────────────
      ctx.fillStyle = "#FFFFFF";
      ctx.fillRect(0, 0, CANVAS_W, CANVAS_H);

      // ─── Photos (clipped halves) ─────────────────────────────────────────────
      // Left (before)
      ctx.save();
      ctx.beginPath();
      ctx.rect(0, 0, CANVAS_W / 2, SPLIT_Y);
      ctx.clip();
      if (beforeImg) {
        drawCoverImage(ctx, beforeImg, 0, 0, CANVAS_W / 2, SPLIT_Y);
      } else {
        ctx.fillStyle = "#E5E7EB";
        ctx.fillRect(0, 0, CANVAS_W / 2, SPLIT_Y);
      }
      ctx.restore();

      // Right (after/wip)
      ctx.save();
      ctx.beginPath();
      ctx.rect(CANVAS_W / 2, 0, CANVAS_W / 2, SPLIT_Y);
      ctx.clip();
      if (afterImg) {
        drawCoverImage(ctx, afterImg, CANVAS_W / 2, 0, CANVAS_W / 2, SPLIT_Y);
      } else {
        ctx.fillStyle = "#D1FAE5";
        ctx.fillRect(CANVAS_W / 2, 0, CANVAS_W / 2, SPLIT_Y);
      }
      ctx.restore();

      // ─── Divider line ────────────────────────────────────────────────────────
      ctx.strokeStyle = "#FFFFFF";
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.moveTo(CANVAS_W / 2, 0);
      ctx.lineTo(CANVAS_W / 2, SPLIT_Y);
      ctx.stroke();

      // ─── BEFORE / AFTER labels ──────────────────────────────────────────────
      const labelFont = "bold 26px Nunito, system-ui, sans-serif";
      ctx.font = labelFont;
      const labelPadX = 18;
      const labelPadY = 9;
      const labelH = 34;
      const labelBottomY = SPLIT_Y - 18;

      // BEFORE
      const beforeLabelW = ctx.measureText("BEFORE").width;
      ctx.fillStyle = "#1A1A1A";
      ctx.beginPath();
      ctx.roundRect(14, labelBottomY - labelH, beforeLabelW + labelPadX * 2, labelH, 6);
      ctx.fill();
      ctx.fillStyle = "#FFFFFF";
      ctx.fillText("BEFORE", 14 + labelPadX, labelBottomY - labelPadY);

      // AFTER
      const afterLabelW = ctx.measureText("AFTER").width;
      ctx.fillStyle = "#0D9C6B";
      ctx.beginPath();
      ctx.roundRect(CANVAS_W / 2 + 14, labelBottomY - labelH, afterLabelW + labelPadX * 2, labelH, 6);
      ctx.fill();
      ctx.fillStyle = "#FFFFFF";
      ctx.fillText("AFTER", CANVAS_W / 2 + 14 + labelPadX, labelBottomY - labelPadY);

      // ─── Wavy edge overlay ──────────────────────────────────────────────────
      const waveH = 16;
      const segs = 6;
      const segW = CANVAS_W / segs;
      ctx.beginPath();
      ctx.moveTo(0, SPLIT_Y);
      for (let i = 1; i <= segs; i++) {
        const x = i * segW;
        const y = SPLIT_Y + (i % 2 === 0 ? 0 : waveH);
        ctx.quadraticCurveTo(
          x - segW / 2,
          SPLIT_Y + (i % 2 !== 0 ? 0 : waveH),
          x,
          y
        );
      }
      ctx.lineTo(CANVAS_W, SPLIT_Y + waveH + 20);
      ctx.lineTo(0, SPLIT_Y + waveH + 20);
      ctx.closePath();
      ctx.fillStyle = "#FFFFFF";
      ctx.fill();

      // ─── Brand section background ────────────────────────────────────────────
      ctx.fillStyle = BRAND_COLOR;
      ctx.fillRect(0, BRAND_START, CANVAS_W, CANVAS_H - BRAND_START);

      // ─── Logo ────────────────────────────────────────────────────────────────
      if (logoImg) {
        ctx.drawImage(logoImg, CANVAS_W / 2 - 110, BRAND_START + 28, 220, 44);
      } else {
        // Fallback text logo
        ctx.font = "900 38px Nunito, system-ui, sans-serif";
        ctx.fillStyle = "#FFFFFF";
        ctx.textAlign = "center";
        ctx.fillText("TidyMate", CANVAS_W / 2, BRAND_START + 68);
      }

      // ─── Reaction Pill ───────────────────────────────────────────────────────
      ctx.font = "700 24px Nunito, system-ui, sans-serif";
      const pillText = (shareReactionPill || "ADHD win unlocked").toUpperCase();
      const pillTextW = ctx.measureText(pillText).width;
      const pillDotSize = 8;
      const pillDotGap = 14;
      const pillPadX = 20;
      const pillH = 42;
      const pillW = pillDotSize + pillDotGap + pillTextW + pillPadX * 2;
      const pillX = CANVAS_W / 2 - pillW / 2;
      const pillY = BRAND_START + 96;

      ctx.fillStyle = "rgba(255,255,255,0.18)";
      ctx.beginPath();
      ctx.roundRect(pillX, pillY, pillW, pillH, pillH / 2);
      ctx.fill();

      // Dot
      ctx.fillStyle = "#B5F5D8";
      ctx.beginPath();
      ctx.arc(pillX + pillPadX + pillDotSize / 2, pillY + pillH / 2, pillDotSize / 2, 0, Math.PI * 2);
      ctx.fill();

      // Pill text
      ctx.fillStyle = "#FFFFFF";
      ctx.textAlign = "left";
      ctx.fillText(pillText, pillX + pillPadX + pillDotSize + pillDotGap, pillY + pillH / 2 + 9);

      // ─── Main Tagline ────────────────────────────────────────────────────────
      ctx.font = "900 42px Nunito, system-ui, sans-serif";
      ctx.textAlign = "center";
      const maxTextW = CANVAS_W - 120;
      const taglineLines = wrapText(ctx, shareTagline || "I tidied my space with TidyMate", maxTextW);
      const lineH = 54;
      const taglineStartY = pillY + pillH + 56;

      // Highlight words 3–5 of first line (or quoted phrase)
      const firstLine = taglineLines[0] ?? "";
      let highlightText = "";
      const quotedMatch = firstLine.match(/"([^"]+)"|'([^']+)'|\(([^)]+)\)/);
      if (quotedMatch) {
        highlightText = quotedMatch[0];
      } else {
        const words = firstLine.split(" ");
        if (words.length >= 3) {
          highlightText = words.slice(2, Math.min(5, words.length)).join(" ");
        }
      }

      // Draw highlight box for first line
      if (highlightText) {
        const beforeHighlight = firstLine.substring(0, firstLine.indexOf(highlightText));
        const beforeW = ctx.measureText(beforeHighlight).width;
        const hlW = ctx.measureText(highlightText).width;
        const fullLineW = ctx.measureText(firstLine).width;
        const lineStartX = CANVAS_W / 2 - fullLineW / 2;
        ctx.fillStyle = "rgba(255,255,255,0.2)";
        ctx.beginPath();
        ctx.roundRect(lineStartX + beforeW - 6, taglineStartY - 40, hlW + 12, 52, 8);
        ctx.fill();
      }

      // Draw tagline text
      ctx.fillStyle = "#FFFFFF";
      taglineLines.slice(0, 2).forEach((line, i) => {
        ctx.fillText(line, CANVAS_W / 2, taglineStartY + i * lineH);
      });

      // ─── Sub Line ────────────────────────────────────────────────────────────
      const subY = taglineStartY + Math.min(taglineLines.length, 2) * lineH + 28;
      ctx.font = "600 26px Nunito, system-ui, sans-serif";
      ctx.fillStyle = "rgba(255,255,255,0.72)";
      const subLines = wrapText(ctx, shareSub || "Something shifted today.", maxTextW);
      subLines.slice(0, 2).forEach((line, i) => {
        ctx.fillText(line, CANVAS_W / 2, subY + i * 36);
      });

      // ─── Bottom row ──────────────────────────────────────────────────────────
      const bottomY = CANVAS_H - 72;

      // "TRY IT FREE" label
      ctx.font = "600 20px Nunito, system-ui, sans-serif";
      ctx.fillStyle = "rgba(255,255,255,0.55)";
      ctx.textAlign = "center";
      ctx.fillText("TRY IT FREE", CANVAS_W / 2, bottomY - 38);

      // tidymate.app
      ctx.font = "800 32px Nunito, system-ui, sans-serif";
      ctx.fillStyle = "#FFFFFF";
      ctx.fillText("tidymate.app", CANVAS_W / 2, bottomY);

      // QR Code (right side)
      if (qrDataUrl) {
        const qrImg = await loadImageCors(qrDataUrl);
        if (qrImg && !cancelled) {
          const qrSize = 130;
          const qrX = CANVAS_W - 170;
          const qrY = CANVAS_H - qrSize - 36;
          ctx.fillStyle = "#FFFFFF";
          ctx.beginPath();
          ctx.roundRect(qrX - 8, qrY - 8, qrSize + 16, qrSize + 16, 12);
          ctx.fill();
          ctx.drawImage(qrImg, qrX, qrY, qrSize, qrSize);
        }
      }

      ctx.textAlign = "left";
      if (!cancelled) setDrawing(false);
    };

    draw().catch(console.error);
    return () => {
      cancelled = true;
    };
  }, [beforeImageUrl, wipImageUrl, shareTagline, shareReactionPill, shareSub, fontsLoaded]);

  const handleDownload = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    canvas.toBlob((blob) => {
      if (!blob) return;
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = "tidymate-progress.png";
      a.click();
      URL.revokeObjectURL(url);
      track("share_card_downloaded", { room_id: roomId });
    }, "image/png");
  };

  const handleShare = async () => {
    const canvas = canvasRef.current;
    if (!canvas || !navigator.share) return;
    canvas.toBlob(async (blob) => {
      if (!blob) return;
      const file = new File([blob], "tidymate-progress.png", { type: "image/png" });
      try {
        await navigator.share({
          files: [file],
          title: shareTagline,
          text: "I used TidyMate to tidy my space! tidymate.app",
        });
        track("share_card_shared", { room_id: roomId });
      } catch (err) {
        if ((err as Error).name !== "AbortError") {
          console.error("Share failed:", err);
        }
      }
    }, "image/png");
  };

  return (
    <div className="space-y-3">
      <div
        className="relative rounded-xl overflow-hidden shadow-lg"
        style={{ width: CANVAS_W * DISPLAY_SCALE, maxWidth: "100%" }}
      >
        {drawing && (
          <div
            className="absolute inset-0 flex items-center justify-center bg-muted/80 z-10"
            style={{ height: CANVAS_H * DISPLAY_SCALE }}
          >
            <Loader2 className="w-8 h-8 text-primary animate-spin" />
          </div>
        )}
        <canvas
          ref={canvasRef}
          width={CANVAS_W}
          height={CANVAS_H}
          style={{ width: "100%", height: "auto", display: "block" }}
        />
      </div>

      <div className="flex gap-2">
        <Button
          variant="outline"
          className="flex-1 gap-2"
          onClick={handleDownload}
          disabled={drawing}
        >
          <Download className="w-4 h-4" />
          Save image
        </Button>
        {typeof navigator !== "undefined" && navigator.share && (
          <Button className="flex-1 gap-2" onClick={handleShare} disabled={drawing}>
            <Share2 className="w-4 h-4" />
            Share
          </Button>
        )}
      </div>
    </div>
  );
};

export default ShareCard;
