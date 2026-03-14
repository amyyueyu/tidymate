import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Download, Share2, Loader2 } from "lucide-react";
import { track } from "@/lib/analytics";

interface ShareCardProps {
  beforeImageUrl: string;
  wipImageUrl: string;
  shareTagline: string;
  sessionMinutes: number;
  roomName: string;
  roomId?: string;
}

const CANVAS_W = 1080;
const CANVAS_H = 1080;
const DISPLAY_SCALE = 0.5;
const SPLIT_Y = 480;
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

function drawLeaf(ctx: CanvasRenderingContext2D, cx: number, cy: number, size: number) {
  ctx.save();
  ctx.fillStyle = "rgba(255,255,255,0.9)";
  ctx.beginPath();
  ctx.moveTo(cx, cy - size);
  ctx.bezierCurveTo(cx + size * 0.8, cy - size * 0.4, cx + size * 0.8, cy + size * 0.4, cx, cy + size);
  ctx.bezierCurveTo(cx - size * 0.8, cy + size * 0.4, cx - size * 0.8, cy - size * 0.4, cx, cy - size);
  ctx.closePath();
  ctx.fill();
  ctx.restore();
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
    // Dynamically import qrcode via CDN
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
  sessionMinutes,
  roomName,
  roomId,
}: ShareCardProps) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [drawing, setDrawing] = useState(true);

  useEffect(() => {
    let cancelled = false;
    setDrawing(true);

    const draw = async () => {
      const canvas = canvasRef.current;
      if (!canvas) return;
      const ctx = canvas.getContext("2d");
      if (!ctx) return;

      const [beforeImg, afterImg, qrDataUrl] = await Promise.all([
        loadImageCors(beforeImageUrl),
        loadImageCors(wipImageUrl),
        generateQRDataUrl("https://tidymate.app", 120),
      ]);

      if (cancelled) return;

      // Background
      ctx.fillStyle = "#FFFFFF";
      ctx.fillRect(0, 0, CANVAS_W, CANVAS_H);

      // Left image — before
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

      // Right image — after/in progress
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

      // Divider line
      ctx.strokeStyle = "#E5E7EB";
      ctx.lineWidth = 4;
      ctx.beginPath();
      ctx.moveTo(CANVAS_W / 2, 0);
      ctx.lineTo(CANVAS_W / 2, SPLIT_Y);
      ctx.stroke();

      // BEFORE label
      const labelPadX = 14;
      const labelPadY = 8;
      const labelY = SPLIT_Y - 44;
      ctx.font = "bold 22px system-ui, sans-serif";
      const beforeW = ctx.measureText("BEFORE").width;
      ctx.fillStyle = "rgba(0,0,0,0.55)";
      ctx.beginPath();
      ctx.roundRect(16, labelY, beforeW + labelPadX * 2, 34, 8);
      ctx.fill();
      ctx.fillStyle = "#FFFFFF";
      ctx.fillText("BEFORE", 16 + labelPadX, labelY + 24);

      // AFTER label
      const afterLabel = "AFTER";
      const afterW = ctx.measureText(afterLabel).width;
      ctx.fillStyle = "rgba(0,0,0,0.55)";
      ctx.beginPath();
      ctx.roundRect(CANVAS_W / 2 + 16, labelY, afterW + labelPadX * 2, 34, 8);
      ctx.fill();
      ctx.fillStyle = "#FFFFFF";
      ctx.fillText(afterLabel, CANVAS_W / 2 + 16 + labelPadX, labelY + 24);

      // Brand section background
      ctx.fillStyle = BRAND_COLOR;
      ctx.fillRect(0, SPLIT_Y, CANVAS_W, CANVAS_H - SPLIT_Y);

      // Leaf icon
      drawLeaf(ctx, CANVAS_W / 2, SPLIT_Y + 70, 28);

      // Tagline
      ctx.font = "bold 52px system-ui, sans-serif";
      ctx.fillStyle = "#FFFFFF";
      ctx.textAlign = "center";
      const lines = wrapText(ctx, shareTagline, CANVAS_W - 120);
      const lineHeight = 66;
      const taglineStartY = SPLIT_Y + 140;
      lines.slice(0, 2).forEach((line, i) => {
        ctx.fillText(line, CANVAS_W / 2, taglineStartY + i * lineHeight);
      });

      // tidymate.app text
      ctx.font = "28px system-ui, sans-serif";
      ctx.fillStyle = "rgba(255,255,255,0.75)";
      ctx.fillText("tidymate.app", CANVAS_W / 2, taglineStartY + Math.min(lines.length, 2) * lineHeight + 52);

      // QR Code
      if (qrDataUrl) {
        const qrImg = await loadImageCors(qrDataUrl);
        if (qrImg && !cancelled) {
          const qrSize = 130;
          const qrX = CANVAS_W / 2 - qrSize / 2;
          const qrY = CANVAS_H - qrSize - 40;
          // White background for QR
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
    return () => { cancelled = true; };
  }, [beforeImageUrl, wipImageUrl, shareTagline]);

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
      <div className="relative rounded-xl overflow-hidden shadow-lg" style={{ width: CANVAS_W * DISPLAY_SCALE, maxWidth: "100%" }}>
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
          <Button
            className="flex-1 gap-2"
            onClick={handleShare}
            disabled={drawing}
          >
            <Share2 className="w-4 h-4" />
            Share
          </Button>
        )}
      </div>
    </div>
  );
};

export default ShareCard;
