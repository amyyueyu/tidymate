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
// Photo section: 500px, green section: 580px
const SPLIT_Y = 500;
const BRAND_START = SPLIT_Y + 20; // wavy edge pushes brand down ~20px

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

async function loadImageSafe(url: string): Promise<HTMLImageElement | null> {
  if (!url) return null;
  return new Promise((resolve) => {
    const img = new Image();
    // Only set crossOrigin for non-data URLs (data URLs don't need it and it causes errors)
    if (!url.startsWith("data:")) {
      img.crossOrigin = "anonymous";
    }
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

function drawImageFallback(
  ctx: CanvasRenderingContext2D,
  label: string,
  dx: number,
  dy: number,
  dw: number,
  dh: number,
  bgColor = "#E8F0EC"
) {
  ctx.fillStyle = bgColor;
  ctx.fillRect(dx, dy, dw, dh);
  ctx.fillStyle = "rgba(255,255,255,0.6)";
  ctx.font = "700 28px Nunito, sans-serif";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText(label, dx + dw / 2, dy + dh / 2);
  ctx.textBaseline = "alphabetic";
}

function drawLogo(ctx: CanvasRenderingContext2D, x: number, y: number, scale = 1) {
  const s = scale;

  ctx.save();
  ctx.translate(x, y);

  // Leaf gradient fill
  const leafGrad = ctx.createLinearGradient(0, 0, 28 * s, 28 * s);
  leafGrad.addColorStop(0, "#7DD87A");
  leafGrad.addColorStop(1, "#0D6B3C");

  ctx.beginPath();
  ctx.moveTo(14 * s, 2 * s);
  ctx.bezierCurveTo(6 * s, 2 * s, 1 * s, 8 * s, 1 * s, 14 * s);
  ctx.bezierCurveTo(1 * s, 21 * s, 6 * s, 27 * s, 14 * s, 27 * s);
  ctx.bezierCurveTo(21 * s, 27 * s, 27 * s, 21 * s, 27 * s, 14 * s);
  ctx.bezierCurveTo(27 * s, 6 * s, 21 * s, 2 * s, 14 * s, 2 * s);
  ctx.closePath();
  ctx.fillStyle = leafGrad;
  ctx.fill();

  // White swoosh inside leaf
  ctx.beginPath();
  ctx.moveTo(9 * s, 22 * s);
  ctx.bezierCurveTo(13 * s, 16 * s, 19 * s, 10 * s, 25 * s, 5 * s);
  ctx.bezierCurveTo(20 * s, 11 * s, 14 * s, 17 * s, 11 * s, 24 * s);
  ctx.closePath();
  ctx.fillStyle = "rgba(255,255,255,0.65)";
  ctx.fill();

  // Sparkle stars (top-right of leaf)
  ctx.fillStyle = "#C5F07A";

  const drawStar = (cx: number, cy: number, r: number) => {
    ctx.beginPath();
    for (let i = 0; i < 4; i++) {
      const angle = (i * Math.PI) / 2;
      const outerX = cx + Math.cos(angle) * r;
      const outerY = cy + Math.sin(angle) * r;
      const innerAngle = angle + Math.PI / 4;
      const innerX = cx + Math.cos(innerAngle) * (r * 0.35);
      const innerY = cy + Math.sin(innerAngle) * (r * 0.35);
      if (i === 0) {
        ctx.moveTo(outerX, outerY);
      } else {
        ctx.lineTo(innerX, innerY);
      }
      ctx.lineTo(outerX, outerY);
    }
    ctx.closePath();
    ctx.fill();
  };

  drawStar(22 * s, 3 * s, 3.5 * s);
  drawStar(26 * s, 7 * s, 2 * s);

  ctx.restore();

  // "TidyMate" wordmark
  ctx.fillStyle = "#ffffff";
  ctx.font = `800 ${22 * s}px 'Nunito', 'Arial Rounded MT Bold', sans-serif`;
  ctx.textBaseline = "middle";
  ctx.textAlign = "left";
  ctx.fillText("TidyMate", x + 34 * s, y + 14 * s);
  ctx.textBaseline = "alphabetic";
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

  // Preload Nunito fonts before drawing
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
        setFontsLoaded(true); // fallback: draw with system fonts
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

      // Load images and QR in parallel
      const [beforeImg, afterImg, qrDataUrl] = await Promise.all([
        loadImageSafe(beforeImageUrl),
        loadImageSafe(wipImageUrl),
        generateQRDataUrl("https://tidymate.app", 120),
      ]);

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
        drawImageFallback(ctx, "Before", 0, 0, CANVAS_W / 2, SPLIT_Y, "#D6E4DC");
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
        drawImageFallback(ctx, "After", CANVAS_W / 2, 0, CANVAS_W / 2, SPLIT_Y, "#B8DFC6");
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
      // White wave at SPLIT_Y, amplitude 20px, 6 segments
      const waveH = 20;
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
      ctx.fillStyle = "#0D9C6B";
      ctx.fillRect(0, BRAND_START, CANVAS_W, CANVAS_H - BRAND_START);

      // ─── Logo (canvas primitives) ─────────────────────────────────────────────
      // Center the logo: leaf ~38px wide at scale 1.4, wordmark ~180px wide → total ~218px
      const logoScale = 1.4;
      const logoTotalW = 34 * logoScale + 130; // leaf width + approx wordmark width
      const logoX = CANVAS_W / 2 - logoTotalW / 2;
      const logoY = BRAND_START + 36;
      drawLogo(ctx, logoX, logoY, logoScale);

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
      const pillY = BRAND_START + 120;

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
      const taglineStartY = BRAND_START + 180;

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

      // Draw tagline (up to 3 lines)
      ctx.fillStyle = "#FFFFFF";
      taglineLines.slice(0, 3).forEach((line, i) => {
        ctx.fillText(line, CANVAS_W / 2, taglineStartY + i * lineH);
      });

      // ─── Sub Line ────────────────────────────────────────────────────────────
      const taglineBottom = taglineStartY + Math.min(taglineLines.length, 3) * lineH;
      const subY = Math.max(taglineBottom + 40, BRAND_START + 360);
      ctx.font = "600 26px Nunito, system-ui, sans-serif";
      ctx.fillStyle = "rgba(255,255,255,0.72)";
      const subLines = wrapText(ctx, shareSub || "Something shifted today.", maxTextW);
      subLines.slice(0, 2).forEach((line, i) => {
        ctx.fillText(line, CANVAS_W / 2, subY + i * 36);
      });

      // ─── Divider line in brand section ───────────────────────────────────────
      const dividerY = BRAND_START + 430;
      ctx.strokeStyle = "rgba(255,255,255,0.2)";
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(60, dividerY);
      ctx.lineTo(CANVAS_W - 60, dividerY);
      ctx.stroke();

      // ─── Bottom row ──────────────────────────────────────────────────────────
      const tryItY = BRAND_START + 460;
      const urlY = BRAND_START + 500;

      // "TRY IT FREE" label
      ctx.font = "600 20px Nunito, system-ui, sans-serif";
      ctx.fillStyle = "rgba(255,255,255,0.55)";
      ctx.textAlign = "center";
      ctx.fillText("TRY IT FREE", CANVAS_W / 2, tryItY);

      // tidymate.app
      ctx.font = "800 32px Nunito, system-ui, sans-serif";
      ctx.fillStyle = "#FFFFFF";
      ctx.fillText("tidymate.app", CANVAS_W / 2, urlY);

      // QR Code (right side)
      if (qrDataUrl) {
        const qrImg = await loadImageSafe(qrDataUrl);
        if (qrImg && !cancelled) {
          const qrSize = 130;
          const qrX = CANVAS_W - 160;
          const qrY = BRAND_START + 430;
          // White rounded background
          ctx.fillStyle = "#FFFFFF";
          ctx.beginPath();
          ctx.roundRect(qrX - 8, qrY - 8, qrSize + 16, qrSize + 16, 12);
          ctx.fill();
          ctx.drawImage(qrImg, qrX, qrY, qrSize, qrSize);
          // "SCAN ME" label
          ctx.font = "600 18px Nunito, system-ui, sans-serif";
          ctx.fillStyle = "rgba(255,255,255,0.55)";
          ctx.textAlign = "center";
          ctx.fillText("SCAN ME", qrX + qrSize / 2, qrY + qrSize + 26);
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
