import { useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useGuestMode } from "@/contexts/GuestModeContext";
import { Button } from "@/components/ui/button";
import { toast } from "@/components/ui/sonner";
import { Camera, Loader2 } from "lucide-react";
import { track } from "@/lib/analytics";

interface ProgressPhotoUploadProps {
  roomId: string;
  roomName: string;
  intent: string;
  beforeImageUrl: string;
  completedChallenges: number;
  totalChallenges: number;
  isGuest: boolean;
  onPraiseReceived: (
    praise: string,
    bonusPoints: number,
    progressLabel: string,
    shareTagline: string,
    shareReactionPill: string,
    shareSub: string,
    wipImageUrl: string
  ) => void;
}

const ProgressPhotoUpload = ({
  roomId,
  roomName,
  intent,
  beforeImageUrl,
  completedChallenges,
  totalChallenges,
  isGuest,
  onPraiseReceived,
}: ProgressPhotoUploadProps) => {
  const { user } = useAuth();
  const { updateGuestRoom } = useGuestMode();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [analyzing, setAnalyzing] = useState(false);

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Reset input so same file can be re-selected
    e.target.value = "";

    const reader = new FileReader();
    reader.onload = async (ev) => {
      const base64 = ev.target?.result as string;
      let storageUrl = base64;

      // Upload to storage for authenticated users
      if (!isGuest && user) {
        setUploading(true);
        try {
          const mimeType = base64.split(";")[0].split(":")[1] || "image/jpeg";
          const ext = mimeType.split("/")[1] || "jpg";
          const fileName = `${user.id}/${roomId}-wip-${Date.now()}.${ext}`;
          const b64data = base64.split(",")[1];
          const byteChars = atob(b64data);
          const byteArray = new Uint8Array(byteChars.length);
          for (let i = 0; i < byteChars.length; i++) {
            byteArray[i] = byteChars.charCodeAt(i);
          }
          const blob = new Blob([byteArray], { type: mimeType });

          const { error: uploadError } = await supabase.storage
            .from("room-images")
            .upload(fileName, blob, { contentType: mimeType, upsert: false });

          if (!uploadError) {
            const { data: { publicUrl } } = supabase.storage
              .from("room-images")
              .getPublicUrl(fileName);
            storageUrl = publicUrl;
          } else {
            console.warn("Storage upload failed, using base64:", uploadError);
          }
        } catch (err) {
          console.warn("Storage upload error, falling back to base64:", err);
        } finally {
          setUploading(false);
        }
      }

      // Call analyze-progress edge function
      setAnalyzing(true);
      try {
        const { data: result, error } = await supabase.functions.invoke("analyze-progress", {
          body: {
            imageUrl: storageUrl,
            beforeImageUrl,
            intent,
            completedChallenges,
            totalChallenges,
            roomName,
          },
        });

        if (error) throw error;

        // Save wip_image_url to DB for authenticated users
        if (!isGuest && user) {
          const { error: wipErr } = await supabase
            .from("rooms")
            .update({ wip_image_url: storageUrl })
            .eq("id", roomId);
          if (wipErr) console.error("Failed to save wip_image_url:", wipErr);
        }

        // For guests: persist wip_image_url in context so navigating away & back restores the state
        if (isGuest) {
          updateGuestRoom({ wip_image_url: storageUrl });
        }

        track("progress_photo_uploaded", {
          room_id: roomId,
          is_guest: isGuest,
          bonus_points: result.bonusPoints,
          completed_challenges: completedChallenges,
          total_challenges: totalChallenges,
          intent,
        });

        onPraiseReceived(
          result.praise,
          result.bonusPoints,
          result.progressLabel,
          result.shareTagline,
          result.shareReactionPill ?? "ADHD win unlocked",
          result.shareSub ?? "Something shifted today. Might clean again next year.",
          storageUrl
        );
      } catch (err) {
        console.error("analyze-progress error:", err);
        toast.error("Couldn't analyze photo, but keep going!");
      } finally {
        setAnalyzing(false);
      }
    };

    reader.readAsDataURL(file);
  };

  return (
    <div className="space-y-2">
      <Button
        variant="outline"
        className="w-full gap-2"
        onClick={() => fileInputRef.current?.click()}
        disabled={uploading || analyzing}
      >
        {uploading || analyzing ? (
          <Loader2 className="w-4 h-4 animate-spin" />
        ) : (
          <Camera className="w-4 h-4" />
        )}
        {uploading ? "Uploading..." : analyzing ? "AI is looking..." : "Upload progress photo"}
      </Button>

      {analyzing && (
        <p className="text-xs text-muted-foreground text-center animate-pulse">
          Noticing what changed...
        </p>
      )}

      {isGuest && (
        <p className="text-xs text-muted-foreground text-center">
          Sign up to save your progress photos permanently.
        </p>
      )}

      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        capture="environment"
        className="hidden"
        onChange={handleFileChange}
      />
    </div>
  );
};

export default ProgressPhotoUpload;
