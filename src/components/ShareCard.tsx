import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Download, Share2, Loader2, Link } from "lucide-react";
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
  ctx.fillStyle = "#aaaaaa";
  ctx.font = "600 32px Nunito, sans-serif";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText(label, dx + dw / 2, dy + dh / 2);
  ctx.textBaseline = "alphabetic";
}

/** Draw a rounded rectangle path (helper for older canvas impls) */
function roundRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.lineTo(x + w - r, y);
  ctx.quadraticCurveTo(x + w, y, x + w, y + r);
  ctx.lineTo(x + w, y + h - r);
  ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
  ctx.lineTo(x + r, y + h);
  ctx.quadraticCurveTo(x, y + h, x, y + h - r);
  ctx.lineTo(x, y + r);
  ctx.quadraticCurveTo(x, y, x + r, y);
  ctx.closePath();
}

/** Draw a green arrow pointing right */
function drawGreenArrow(ctx: CanvasRenderingContext2D, cx: number, cy: number, size: number) {
  ctx.save();
  ctx.translate(cx, cy);

  // Arrow shadow
  ctx.shadowColor = "rgba(0,0,0,0.25)";
  ctx.shadowBlur = 8;
  ctx.shadowOffsetY = 3;

  // Arrow body gradient
  const grad = ctx.createLinearGradient(-size * 0.5, 0, size * 0.5, 0);
  grad.addColorStop(0, "#6DCF4A");
  grad.addColorStop(1, "#3A9E28");
  ctx.fillStyle = grad;

  // Arrow shape
  const hw = size * 0.55;  // half-width of body
  const ht = size * 0.28;  // half-thickness of shaft
  ctx.beginPath();
  ctx.moveTo(-hw, -ht);
  ctx.lineTo(hw * 0.1, -ht);
  ctx.lineTo(hw * 0.1, -size * 0.48);
  ctx.lineTo(hw, 0);
  ctx.lineTo(hw * 0.1, size * 0.48);
  ctx.lineTo(hw * 0.1, ht);
  ctx.lineTo(-hw, ht);
  ctx.closePath();
  ctx.fill();

  // Dark outline
  ctx.shadowColor = "transparent";
  ctx.strokeStyle = "#2A7A1A";
  ctx.lineWidth = 3;
  ctx.stroke();

  ctx.restore();
}

function drawLogo(ctx: CanvasRenderingContext2D, x: number, y: number, scale = 1, textColor = "#1A4D2E") {
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

  // Sparkle stars
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
      if (i === 0) ctx.moveTo(outerX, outerY);
      else ctx.lineTo(innerX, innerY);
      ctx.lineTo(outerX, outerY);
    }
    ctx.closePath();
    ctx.fill();
  };
  drawStar(22 * s, 3 * s, 3.5 * s);
  drawStar(26 * s, 7 * s, 2 * s);

  ctx.restore();

  // "TidyMate" wordmark
  ctx.fillStyle = textColor;
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
  const [showShareModal, setShowShareModal] = useState(false);
  const [linkCopied, setLinkCopied] = useState(false);

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
      .catch(() => setFontsLoaded(true));
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

      const [beforeImg, afterImg, qrDataUrl] = await Promise.all([
        loadImageSafe(beforeImageUrl),
        loadImageSafe(wipImageUrl),
        generateQRDataUrl("https://tidymate.app", 130),
      ]);

      if (cancelled) return;

      // ─── 1. Cream background ─────────────────────────────────────────────────
      ctx.fillStyle = "#F2EDE4";
      ctx.fillRect(0, 0, CANVAS_W, CANVAS_H);

      // ─── 2. Green watercolor card (rounded) ──────────────────────────────────
      const cardPad = 50;
      const cardX = cardPad;
      const cardY = cardPad;
      const cardW = CANVAS_W - cardPad * 2;
      const cardH = CANVAS_H - cardPad * 2;
      const cardR = 60;

      // Multi-layer watercolor effect
      const bgGrad = ctx.createRadialGradient(
        CANVAS_W / 2, CANVAS_H * 0.35, 80,
        CANVAS_W / 2, CANVAS_H * 0.45, cardW * 0.75
      );
      bgGrad.addColorStop(0, "#C8E8B0");
      bgGrad.addColorStop(0.45, "#A8D888");
      bgGrad.addColorStop(0.75, "#7DC868");
      bgGrad.addColorStop(1, "#5BA848");

      ctx.save();
      roundRect(ctx, cardX, cardY, cardW, cardH, cardR);
      ctx.fillStyle = bgGrad;
      ctx.fill();

      // Soft inner watercolor blobs for texture
      const blobs = [
        { x: cardX + 80, y: cardY + 60, rx: 180, ry: 120, color: "rgba(255,255,255,0.18)" },
        { x: cardX + cardW - 100, y: cardY + 80, rx: 150, ry: 100, color: "rgba(255,255,255,0.12)" },
        { x: cardX + cardW * 0.5, y: cardY + cardH * 0.6, rx: 220, ry: 160, color: "rgba(180,240,120,0.25)" },
        { x: cardX + 60, y: cardY + cardH - 120, rx: 160, ry: 100, color: "rgba(255,255,255,0.15)" },
        { x: cardX + cardW - 60, y: cardY + cardH - 100, rx: 140, ry: 90, color: "rgba(255,255,255,0.1)" },
      ];
      for (const b of blobs) {
        ctx.beginPath();
        ctx.ellipse(b.x, b.y, b.rx, b.ry, 0, 0, Math.PI * 2);
        ctx.fillStyle = b.color;
        ctx.fill();
      }

      // Sparkle dots scattered across card
      ctx.fillStyle = "rgba(255,255,255,0.55)";
      const sparkles = [
        [120, 130, 4], [cardW - 80, 160, 3], [200, cardH * 0.55 + cardY, 5],
        [cardW - 150, cardH * 0.7 + cardY, 3], [cardW * 0.3, cardH * 0.85 + cardY, 4],
        [cardW * 0.75, cardH * 0.2 + cardY, 3], [300, 90, 3], [cardW - 200, cardH - 140, 4],
      ];
      for (const [sx, sy, sr] of sparkles) {
        // 4-point star
        ctx.save();
        ctx.translate(sx + cardX * 0.1, sy);
        for (let i = 0; i < 4; i++) {
          const a = (i * Math.PI) / 2;
          ctx.beginPath();
          ctx.moveTo(0, 0);
          ctx.lineTo(Math.cos(a) * sr * 2, Math.sin(a) * sr * 2);
          ctx.lineTo(Math.cos(a + Math.PI / 4) * sr * 0.4, Math.sin(a + Math.PI / 4) * sr * 0.4);
          ctx.closePath();
          ctx.fill();
        }
        ctx.restore();
      }

      ctx.restore();

      // ─── 3. BEFORE / AFTER labels ────────────────────────────────────────────
      const labelY = cardY + 70;
      ctx.font = "800 52px Nunito, system-ui, sans-serif";
      ctx.textAlign = "center";
      ctx.fillStyle = "#1A4D2E";
      ctx.fillText("BEFORE", cardX + cardW * 0.27, labelY);
      ctx.fillText("AFTER", cardX + cardW * 0.73, labelY);

      // ─── 4. Polaroid frames ───────────────────────────────────────────────────
      const polaroidTop = labelY + 24;
      const polaroidW = 390;
      const polaroidH = 440;
      const polaroidR = 14;
      const polaroidBorder = 16;
      const polaroidBottomPad = 50; // extra white space at bottom like a real polaroid
      const leftPolaroidX = cardX + cardW * 0.27 - polaroidW / 2;
      const rightPolaroidX = cardX + cardW * 0.73 - polaroidW / 2;

      const drawPolaroid = (px: number, py: number, img: HTMLImageElement | null, fallbackLabel: string) => {
        // Drop shadow
        ctx.save();
        ctx.shadowColor = "rgba(0,0,0,0.22)";
        ctx.shadowBlur = 24;
        ctx.shadowOffsetX = 4;
        ctx.shadowOffsetY = 8;
        roundRect(ctx, px, py, polaroidW, polaroidH + polaroidBottomPad, polaroidR);
        ctx.fillStyle = "#FFFFFF";
        ctx.fill();
        ctx.restore();

        // Photo area
        const photoX = px + polaroidBorder;
        const photoY = py + polaroidBorder;
        const photoW = polaroidW - polaroidBorder * 2;
        const photoH = polaroidH - polaroidBorder;

        ctx.save();
        roundRect(ctx, photoX, photoY, photoW, photoH, 6);
        ctx.clip();
        if (img) {
          drawCoverImage(ctx, img, photoX, photoY, photoW, photoH);
        } else {
          drawImageFallback(ctx, fallbackLabel, photoX, photoY, photoW, photoH, "#D8ECD4");
        }
        ctx.restore();
      };

      drawPolaroid(leftPolaroidX, polaroidTop, beforeImg, "Before");
      drawPolaroid(rightPolaroidX, polaroidTop, afterImg, "After");

      // ─── 5. Green arrow between polaroids ────────────────────────────────────
      const arrowCX = cardX + cardW / 2;
      const arrowCY = polaroidTop + (polaroidH + polaroidBottomPad) / 2;
      drawGreenArrow(ctx, arrowCX, arrowCY, 90);

      // ─── 6. Tagline text area ─────────────────────────────────────────────────
      const textAreaY = polaroidTop + polaroidH + polaroidBottomPad + 36;
      const textMaxW = cardW - 120;

      ctx.font = "800 48px Nunito, system-ui, sans-serif";
      ctx.textAlign = "center";
      ctx.fillStyle = "#1A4D2E";
      const taglineLines = wrapText(ctx, shareTagline || "I tidied my space with TidyMate!", textMaxW);
      taglineLines.slice(0, 2).forEach((line, i) => {
        ctx.fillText(line, CANVAS_W / 2, textAreaY + i * 60);
      });

      // ─── 7. Bottom row: logo + URL + QR ──────────────────────────────────────
      const bottomRowY = cardY + cardH - 100;

      // Logo (left-aligned)
      const logoX = cardX + 48;
      const logoY = bottomRowY - 16;
      drawLogo(ctx, logoX, logoY, 1.5, "#1A4D2E");

      // tidymate.app (next to logo)
      const logoTextW = ctx.measureText("TidyMate").width; // approximate
      ctx.font = "600 28px Nunito, system-ui, sans-serif";
      ctx.fillStyle = "#2A6B3E";
      ctx.textAlign = "left";
      ctx.fillText("tidymate.app", logoX + 34 * 1.5 + logoTextW + 14, bottomRowY + 5);

      // QR Code (right-aligned)
      if (qrDataUrl) {
        const qrImg = await loadImageSafe(qrDataUrl);
        if (qrImg && !cancelled) {
          const qrSize = 100;
          const qrX = cardX + cardW - qrSize - 40;
          const qrY = bottomRowY - qrSize / 2 - 8;
          ctx.fillStyle = "#FFFFFF";
          ctx.beginPath();
          ctx.roundRect(qrX - 8, qrY - 8, qrSize + 16, qrSize + 16, 10);
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

  const handleDownloadAndShare = () => {
    handleDownload();
    setShowShareModal(false);
  };

  const handleCopyLink = async () => {
    await navigator.clipboard.writeText("https://tidymate.app");
    setLinkCopied(true);
    setTimeout(() => setLinkCopied(false), 2000);
  };

  const handleShare = async () => {
    const shareUrl = "https://tidymate.app";
    const shareText = shareTagline || "I tidied my space with TidyMate!";

    if (navigator.share) {
      try {
        const canvas = canvasRef.current;
        if (canvas) {
          const blob = await new Promise<Blob>((resolve) =>
            canvas.toBlob((b) => resolve(b!), "image/png")
          );
          const file = new File([blob], "tidymate-progress.png", { type: "image/png" });
          await navigator.share({ files: [file], title: shareText, text: shareText, url: shareUrl });
          track("share_card_shared", { room_id: roomId });
          return;
        }
      } catch {
        try {
          await navigator.share({ title: shareText, text: shareText, url: shareUrl });
          track("share_card_shared", { room_id: roomId });
          return;
        } catch {
          // fall through to modal
        }
      }
    }

    setShowShareModal(true);
  };

  const shareUrl = "https://tidymate.app";
  const shareText = shareTagline || "I tidied my space with TidyMate!";

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

        {/* Share modal — bottom sheet */}
        {showShareModal && (
          <div
            style={{
              position: "absolute", inset: 0,
              background: "rgba(0,0,0,0.5)",
              display: "flex", alignItems: "flex-end", justifyContent: "center",
              zIndex: 50,
            }}
            onClick={() => setShowShareModal(false)}
          >
            <div
              style={{
                background: "hsl(var(--card))",
                borderRadius: "20px 20px 0 0",
                padding: "24px",
                width: "100%",
              }}
              onClick={(e) => e.stopPropagation()}
            >
              <p style={{ fontWeight: 600, fontSize: 15, marginBottom: 16, color: "hsl(var(--foreground))" }}>
                Share your progress
              </p>
              <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                {/* Copy link */}
                <button
                  onClick={handleCopyLink}
                  style={{
                    display: "flex", alignItems: "center", gap: 12,
                    padding: "12px 16px", borderRadius: 12,
                    border: "1px solid hsl(var(--border))",
                    background: "hsl(var(--muted))", cursor: "pointer",
                    fontSize: 14, color: "hsl(var(--foreground))",
                  }}
                >
                  <Link className="w-4 h-4" />
                  {linkCopied ? "Link copied!" : "Copy link"}
                </button>

                {/* X / Twitter */}
                <a
                  href={`https://twitter.com/intent/tweet?text=${encodeURIComponent(shareText + " " + shareUrl)}`}
                  target="_blank" rel="noopener noreferrer"
                  style={{
                    display: "flex", alignItems: "center", gap: 12,
                    padding: "12px 16px", borderRadius: 12,
                    border: "1px solid hsl(var(--border))",
                    background: "hsl(var(--muted))", cursor: "pointer",
                    fontSize: 14, color: "hsl(var(--foreground))", textDecoration: "none",
                  }}
                >
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
                    <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-4.714-6.231-5.401 6.231H2.744l7.737-8.835L1.254 2.25H8.08l4.253 5.622 5.911-5.622Zm-1.161 17.52h1.833L7.084 4.126H5.117z"/>
                  </svg>
                  Share on X (Twitter)
                </a>

                {/* Reddit */}
                <a
                  href={`https://www.reddit.com/submit?url=${encodeURIComponent(shareUrl)}&title=${encodeURIComponent(shareText)}`}
                  target="_blank" rel="noopener noreferrer"
                  style={{
                    display: "flex", alignItems: "center", gap: 12,
                    padding: "12px 16px", borderRadius: 12,
                    border: "1px solid hsl(var(--border))",
                    background: "hsl(var(--muted))", cursor: "pointer",
                    fontSize: 14, color: "hsl(var(--foreground))", textDecoration: "none",
                  }}
                >
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="#FF4500">
                    <path d="M12 0A12 12 0 0 0 0 12a12 12 0 0 0 12 12 12 12 0 0 0 12-12A12 12 0 0 0 12 0zm5.01 4.744c.688 0 1.25.561 1.25 1.249a1.25 1.25 0 0 1-2.498.056l-2.597-.547-.8 3.747c1.824.07 3.48.632 4.674 1.488.308-.309.73-.491 1.207-.491.968 0 1.754.786 1.754 1.754 0 .716-.435 1.333-1.01 1.614a3.111 3.111 0 0 1 .042.52c0 2.694-3.13 4.87-7.004 4.87-3.874 0-7.004-2.176-7.004-4.87 0-.183.015-.366.043-.534A1.748 1.748 0 0 1 4.028 12c0-.968.786-1.754 1.754-1.754.463 0 .898.196 1.207.49 1.207-.883 2.878-1.43 4.744-1.487l.885-4.182a.342.342 0 0 1 .14-.197.35.35 0 0 1 .238-.042l2.906.617a1.214 1.214 0 0 1 1.108-.701zM9.25 12C8.561 12 8 12.562 8 13.25c0 .687.561 1.248 1.25 1.248.687 0 1.248-.561 1.248-1.249 0-.688-.561-1.249-1.249-1.249zm5.5 0c-.687 0-1.248.561-1.248 1.25 0 .687.561 1.248 1.249 1.248.688 0 1.249-.561 1.249-1.249 0-.687-.562-1.249-1.25-1.249zm-5.466 3.99a.327.327 0 0 0-.231.094.33.33 0 0 0 0 .463c.842.842 2.484.913 2.961.913.477 0 2.105-.056 2.961-.913a.361.361 0 0 0 .029-.463.33.33 0 0 0-.464 0c-.547.533-1.684.73-2.512.73-.828 0-1.979-.196-2.512-.73a.326.326 0 0 0-.232-.095z"/>
                  </svg>
                  Share on Reddit (r/ADHD)
                </a>

                {/* Save image */}
                <button
                  onClick={handleDownloadAndShare}
                  style={{
                    display: "flex", alignItems: "center", gap: 12,
                    padding: "12px 16px", borderRadius: 12,
                    border: "1px solid hsl(var(--border))",
                    background: "hsl(var(--muted))", cursor: "pointer",
                    fontSize: 14, color: "hsl(var(--foreground))",
                  }}
                >
                  <Download className="w-4 h-4" />
                  Save image to share manually
                </button>
              </div>

              <button
                onClick={() => setShowShareModal(false)}
                style={{
                  width: "100%", marginTop: 16, padding: "12px",
                  borderRadius: 12, border: "none",
                  background: "transparent",
                  fontSize: 14, color: "hsl(var(--muted-foreground))", cursor: "pointer",
                }}
              >
                Cancel
              </button>
            </div>
          </div>
        )}
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
        <Button className="flex-1 gap-2" onClick={handleShare} disabled={drawing}>
          <Share2 className="w-4 h-4" />
          Share
        </Button>
      </div>
    </div>
  );
};

export default ShareCard;
