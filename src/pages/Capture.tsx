import { useState, useRef, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { useGuestMode, GuestRoom, GuestChallenge } from "@/contexts/GuestModeContext";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Label } from "@/components/ui/label";
import { toast } from "@/components/ui/sonner";
import {
  Camera,
  ArrowLeft,
  Sparkles,
  Leaf,
  Clock,
  Trash2,
  Palette,
} from "lucide-react";
import { analytics } from "@/lib/analytics";
import { LangToggle } from "@/components/LangToggle";
import { useLang } from "@/contexts/LanguageContext";

type Intent = "tidy" | "declutter" | "redesign";

const Capture = () => {
  const navigate = useNavigate();
  const { user, loading: authLoading } = useAuth();
  const { t } = useLang();
  const { isGuest: isGuestRaw, setGuestSession, sessionUsed, markSessionUsed, clearGuestSession } = useGuestMode();
  // If the user is authenticated, never treat them as a guest (clears stale sessionStorage)
  const isGuest = isGuestRaw && !user;
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [intent, setIntent] = useState<Intent>("tidy");
  const [analyzing, setAnalyzing] = useState(false);
  const [generatingVision, setGeneratingVision] = useState(false);
  const [visionLoadingTooLong, setVisionLoadingTooLong] = useState(false);
  const [visionImage, setVisionImage] = useState<string | null>(null);
  const [showVision, setShowVision] = useState(false);
  const [analysisComplete, setAnalysisComplete] = useState(false);
  const [roomId, setRoomId] = useState<string | null>(null);

  // Auth guard — use sessionStorage as the authoritative source for guest status
  // to avoid React state race conditions on initial mount
  useEffect(() => {
    if (authLoading) return;
    const guestActive = sessionStorage.getItem("guestMode") === "true";
    if (!user && !guestActive) {
      navigate("/auth");
    }
  }, [user, authLoading, navigate]);

  // Show escape hatch after 15s of vision loading
  useEffect(() => {
    let timer: ReturnType<typeof setTimeout> | null = null;
    if (generatingVision) {
      timer = setTimeout(() => setVisionLoadingTooLong(true), 25000);
    } else {
      setVisionLoadingTooLong(false);
    }
    return () => { if (timer) clearTimeout(timer); };
  }, [generatingVision]);

  // If guest tries to start a second session (sessionUsed was set before this page loaded),
  // redirect them to sign up — but ONLY for actual guests (not authenticated users)
  useEffect(() => {
    if (authLoading) return;
    const guestActive = sessionStorage.getItem("guestMode") === "true";
    if (!user && guestActive && sessionUsed && !analysisComplete) {
      analytics.guestSignupPromptShown({ trigger: "session_used" });
      navigate("/auth?signup=1");
    }
  }, [user, authLoading, sessionUsed, analysisComplete, navigate]);

  // Compress image to max 1024px wide and quality 0.8 before storing
  const compressImage = (dataUrl: string): Promise<string> => {
    return new Promise((resolve) => {
      const img = new Image();
      img.onload = () => {
        const MAX = 1024;
        const scale = img.width > MAX ? MAX / img.width : 1;
        const canvas = document.createElement("canvas");
        canvas.width = Math.round(img.width * scale);
        canvas.height = Math.round(img.height * scale);
        const ctx = canvas.getContext("2d");
        ctx?.drawImage(img, 0, 0, canvas.width, canvas.height);
        resolve(canvas.toDataURL("image/jpeg", 0.82));
      };
      img.onerror = () => resolve(dataUrl); // fallback: use original
      img.src = dataUrl;
    });
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = async (ev) => {
        const raw = ev.target?.result as string;
        const compressed = await compressImage(raw);
        setImagePreview(compressed);
        analytics.photoUploaded({ room_type: intent });
        if (isGuest) analytics.guestPhotoUploaded({ intent });
      };
      reader.readAsDataURL(file);
    }
  };


  // Upload a base64 data URL to storage and return the public URL
  const uploadImageToStorage = async (dataUrl: string): Promise<string> => {
    const base64 = dataUrl.split(",")[1];
    const mimeType = dataUrl.split(";")[0].split(":")[1] || "image/jpeg";
    const ext = mimeType.split("/")[1] || "jpg";
    const fileName = `${user!.id}/${Date.now()}.${ext}`;

    const byteChars = atob(base64);
    const byteArray = new Uint8Array(byteChars.length);
    for (let i = 0; i < byteChars.length; i++) {
      byteArray[i] = byteChars.charCodeAt(i);
    }
    const blob = new Blob([byteArray], { type: mimeType });

    const { error: uploadError } = await supabase.storage
      .from("room-images")
      .upload(fileName, blob, { contentType: mimeType, upsert: false });

    if (uploadError) throw uploadError;

    const { data: { publicUrl } } = supabase.storage
      .from("room-images")
      .getPublicUrl(fileName);

    return publicUrl;
  };

  const handleAnalyze = async () => {
    if (!imagePreview) {
      toast.error("Please capture or upload an image first");
      return;
    }

    setAnalyzing(true);
    setAnalysisComplete(false);
    setVisionImage(null);
    setShowVision(false);

    try {
      const response = await supabase.functions.invoke("analyze-room", {
        body: { imageUrl: imagePreview, intent },
      });

      if (response.error) throw new Error(response.error.message || "Failed to analyze room");

      const analysisResult = response.data;

      if (isGuest) {
        // Guest mode: store everything in context only (keep base64 for in-memory use)
        const guestId = `guest-${Date.now()}`;
        const room: GuestRoom = {
          id: guestId,
          name: analysisResult.roomName || "My Space",
          before_image_url: imagePreview,
          after_image_url: null,
          intent,
          total_challenges: analysisResult.challenges?.length || 0,
          completed_challenges: 0,
          status: "active",
        };

        const challenges: GuestChallenge[] = (analysisResult.challenges || []).map(
          (c: any, index: number) => ({
            id: `guest-challenge-${index}`,
            title: c.title,
            description: c.description ?? null,
            time_estimate_minutes: c.timeEstimate || 5,
            points: c.points || 10,
            status: "pending" as const,
            sort_order: index,
          })
        );

        setGuestSession(room, challenges);
        markSessionUsed();
        setRoomId(guestId);
        setAnalysisComplete(true);
        analytics.guestAnalysisCompleted({ intent, tasks_generated: challenges.length });

        // Generate vision in background for guest too
        generateVisionGuest(imagePreview, intent);
      } else {
        // Authenticated mode: upload image to storage first, then write to DB
        let beforeImageUrl = imagePreview;
        try {
          beforeImageUrl = await uploadImageToStorage(imagePreview);
        } catch (uploadErr) {
          console.warn("Image upload failed, falling back to base64:", uploadErr);
        }

        const { data: room, error: roomError } = await supabase
          .from("rooms")
          .insert({
            user_id: user!.id,
            name: analysisResult.roomName || "My Space",
            before_image_url: beforeImageUrl,
            intent,
            total_challenges: analysisResult.challenges?.length || 0,
          })
          .select()
          .single();

        if (roomError) throw roomError;

        setRoomId(room.id);

        if (analysisResult.challenges?.length > 0) {
          const challenges = analysisResult.challenges.map((c: any, index: number) => ({
            room_id: room.id,
            user_id: user!.id,
            title: c.title,
            description: c.description,
            time_estimate_minutes: c.timeEstimate || 5,
            points: c.points || 10,
            sort_order: index,
          }));
          const { error: challengesError } = await supabase.from("challenges").insert(challenges);
          if (challengesError) throw challengesError;
        }

        setAnalysisComplete(true);
        generateVision(imagePreview, intent, room.id);
      }

      toast.success("Room analyzed! Let's start your challenges!");
    } catch (error: any) {
      console.error("Analysis error:", error);
      toast.error(error.message || "Failed to analyze room. Please try again.");
    } finally {
      setAnalyzing(false);
    }
  };

  const VISION_TIMEOUT_MS = 45000;

  // Authenticated vision generation (saves to DB)
  const generateVision = async (image: string, selectedIntent: string, currentRoomId: string) => {
    setGeneratingVision(true);
    setShowVision(true);
    analytics.visionGenerationStarted({ room_type: selectedIntent });
    try {
      type InvokeResult = Awaited<ReturnType<typeof supabase.functions.invoke>>;
      const invokePromise = supabase.functions.invoke("generate-vision", {
        body: { imageUrl: image, intent: selectedIntent },
      });
      const timeoutPromise = new Promise<InvokeResult>((_, reject) =>
        setTimeout(() => reject(new Error("Vision generation timed out")), VISION_TIMEOUT_MS)
      );
      const response: InvokeResult = await Promise.race([invokePromise, timeoutPromise]);

      // 429 or other soft errors: don't crash, just skip vision
      if (response.error || (response.data as any)?.error) {
        const msg = (response.data as any)?.error || response.error?.message || "";
        if (msg.toLowerCase().includes("rate limit") || msg.toLowerCase().includes("busy")) {
          toast("Vision generation is busy right now — your challenges are ready! 🎉 Try viewing the vision later.");
        } else {
          toast("Couldn't generate vision, but your challenges are ready!");
        }
        return;
      }
      const generated = (response.data as any)?.imageUrl;
      if (generated) {
        setVisionImage(generated);
        await supabase.from("rooms").update({ after_image_url: generated }).eq("id", currentRoomId);
        analytics.visionGenerated({ room_type: selectedIntent });
        toast.success("Your vision is ready! ✨");
      }
    } catch (error: any) {
      if (error?.message === "Vision generation timed out") {
        console.warn("Vision generation timed out after 30s — falling back gracefully");
        toast("Vision is taking too long — your challenges are ready! Try vision again later.");
      } else {
        console.error("Vision generation error:", error);
        toast("Couldn't generate vision, but your challenges are ready!");
      }
    } finally {
      setGeneratingVision(false);
    }
  };

  // Guest vision generation (stores in context only)
  const generateVisionGuest = async (image: string, selectedIntent: string) => {
    setGeneratingVision(true);
    setShowVision(true);
    analytics.visionGenerationStarted({ room_type: selectedIntent });
    try {
      type InvokeResult = Awaited<ReturnType<typeof supabase.functions.invoke>>;
      const invokePromise = supabase.functions.invoke("generate-vision", {
        body: { imageUrl: image, intent: selectedIntent },
      });
      const timeoutPromise = new Promise<InvokeResult>((_, reject) =>
        setTimeout(() => reject(new Error("Vision generation timed out")), VISION_TIMEOUT_MS)
      );
      const response: InvokeResult = await Promise.race([invokePromise, timeoutPromise]);

      if (response.error || (response.data as any)?.error) {
        const msg = (response.data as any)?.error || response.error?.message || "";
        if (msg.toLowerCase().includes("rate limit") || msg.toLowerCase().includes("busy")) {
          toast("Vision generation is busy — your challenges are ready! Try again in a moment.");
        } else {
          toast("Couldn't generate vision, but your challenges are ready!");
        }
        return;
      }
      const generated = (response.data as any)?.imageUrl;
      if (generated) {
        setVisionImage(generated);
        analytics.visionGenerated({ room_type: selectedIntent });
        toast.success("Your vision is ready! ✨");
      }
    } catch (error: any) {
      if (error?.message === "Vision generation timed out") {
        console.warn("Vision generation timed out after 30s — falling back gracefully");
        toast("Vision is taking too long — your challenges are ready! Try vision again later.");
      } else {
        console.error("Vision generation error:", error);
        toast("Couldn't generate vision, but your challenges are ready!");
      }
    } finally {
      setGeneratingVision(false);
    }
  };

  const proceedToChallenges = () => {
    if (roomId) {
      navigate(`/challenge/${roomId}`);
    }
  };

  const intentOptions = [
    { value: "tidy" as Intent, label: t('capture.tidy'), description: t('capture.tidy.sub'), icon: Sparkles },
    { value: "declutter" as Intent, label: t('capture.declutter'), description: t('capture.declutter.sub'), icon: Trash2 },
    { value: "redesign" as Intent, label: t('capture.redesign'), description: t('capture.redesign.sub'), icon: Palette },
  ];

  if (authLoading) return null;

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="sticky top-0 z-10 bg-background/80 backdrop-blur-sm border-b border-border">
        <div className="container max-w-2xl mx-auto px-4 py-4 flex items-center gap-3">
          <Button variant="ghost" size="icon" onClick={() => navigate("/")}>
            <ArrowLeft className="w-5 h-5" />
          </Button>
          <div className="flex items-center gap-2">
            <Leaf className="w-5 h-5 text-primary" />
            <span className="font-semibold">{t('capture.title')}</span>
          </div>
          {isGuest && (
            <span className="ml-auto text-xs bg-primary/10 text-primary px-2 py-1 rounded-full">
              {t('capture.guest.badge')}
            </span>
          )}
          {!isGuest && <span className="ml-auto"><LangToggle /></span>}
          {isGuest && <LangToggle />}
        </div>
      </header>

      <main className="container max-w-2xl mx-auto px-4 py-6 space-y-6">
        {/* Image Capture */}
        <Card className="border-0 shadow-sm overflow-hidden animate-fade-in">
          <CardContent className="p-0">
            {imagePreview ? (
              <div className="relative">
                <img
                  src={imagePreview}
                  alt="Room preview"
                  className="w-full aspect-[4/3] object-cover"
                />
                <Button
                  variant="secondary"
                  size="sm"
                  className="absolute bottom-4 right-4"
                  onClick={() => {
                    setImagePreview(null);
                    if (fileInputRef.current) fileInputRef.current.value = "";
                  }}
                >
                  Retake
                </Button>
              </div>
            ) : (
              <div
                className="w-full aspect-[4/3] bg-muted flex flex-col items-center justify-center gap-4 cursor-pointer hover:bg-muted/80 transition-colors"
                onClick={() => fileInputRef.current?.click()}
              >
                <div className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center">
                  <Camera className="w-8 h-8 text-primary" />
                </div>
                <div className="text-center">
                  <p className="font-medium">Tap to capture</p>
                  <p className="text-sm text-muted-foreground">or upload a photo</p>
                </div>
              </div>
            )}
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={handleFileChange}
            />
          </CardContent>
        </Card>

        {/* Intent Selection */}
        <div className="space-y-3 animate-fade-in" style={{ animationDelay: "0.1s" }}>
          <h2 className="font-semibold">{t('capture.intent.label')}</h2>
          <RadioGroup value={intent} onValueChange={(v) => setIntent(v as Intent)}>
            <div className="grid gap-3">
              {intentOptions.map((option) => (
                <Card
                  key={option.value}
                  className={`border-2 cursor-pointer transition-all ${
                    intent === option.value
                      ? "border-primary bg-primary/5"
                      : "border-transparent hover:border-border"
                  }`}
                  onClick={() => setIntent(option.value)}
                >
                  <CardContent className="p-4 flex items-center gap-4">
                    <RadioGroupItem value={option.value} id={option.value} />
                    <div className="w-10 h-10 rounded-xl bg-secondary flex items-center justify-center shrink-0">
                      <option.icon className="w-5 h-5 text-primary" />
                    </div>
                    <Label htmlFor={option.value} className="flex-1 cursor-pointer">
                      <p className="font-medium">{option.label}</p>
                      <p className="text-sm text-muted-foreground">{option.description}</p>
                    </Label>
                  </CardContent>
                </Card>
              ))}
            </div>
          </RadioGroup>
        </div>

        {/* Analyze / Proceed */}
        {!analysisComplete ? (
          <Button
            className="w-full h-14 text-base font-medium animate-fade-in"
            style={{ animationDelay: "0.2s" }}
            disabled={!imagePreview || analyzing}
            onClick={handleAnalyze}
          >
            {analyzing ? (
              <span className="flex items-center gap-2">
                <div className="w-5 h-5 border-2 border-primary-foreground/30 border-t-primary-foreground rounded-full animate-spin" />
                {t('capture.analyzing')}
              </span>
            ) : (
              <span className="flex items-center gap-2">
                <Sparkles className="w-5 h-5" />
                {t('capture.analyze.btn')}
              </span>
            )}
          </Button>
        ) : (
          <div className="space-y-4 animate-fade-in">
            {/* Vision Preview */}
            {showVision && (
              <Card className="border-0 shadow-lg overflow-hidden">
                <CardContent className="p-0">
                  {generatingVision ? (
                    <div className="aspect-[4/3] bg-muted flex items-center justify-center">
                      <div className="text-center">
                        <Sparkles className="w-12 h-12 text-primary mx-auto mb-3 animate-pulse" />
                        <p className="font-medium">{t('capture.vision.loading')}</p>
                        <p className="text-sm text-muted-foreground mt-1">
                          {t('capture.vision.sub')}
                        </p>
                        {visionLoadingTooLong && (
                          <div className="mt-4 space-y-2">
                            <p className="text-sm text-muted-foreground text-center">
                              This is taking longer than usual...
                            </p>
                            <Button
                              variant="ghost"
                              size="sm"
                              className="w-full text-muted-foreground"
                              onClick={() => {
                                setGeneratingVision(false);
                                setShowVision(false);
                                setVisionLoadingTooLong(false);
                                toast("Vision skipped — your challenges are ready!");
                              }}
                            >
                              {t('capture.skip.vision')}
                            </Button>
                          </div>
                        )}
                      </div>
                    </div>
                  ) : visionImage ? (
                    <div className="relative">
                      <img
                        src={visionImage}
                        alt="Your vision"
                        className="w-full aspect-[4/3] object-cover"
                      />
                      <div className="absolute bottom-3 right-3 bg-primary text-primary-foreground text-xs px-2 py-1 rounded flex items-center gap-1">
                        <Sparkles className="w-3 h-3" />
                        Your Vision
                      </div>
                    </div>
                  ) : null}
                </CardContent>
              </Card>
            )}

            {/* Retry card when vision failed silently */}
            {showVision && !generatingVision && !visionImage && (
              <Card className="border-0 shadow-sm">
                <CardContent className="p-4 text-center space-y-3">
                  <p className="text-sm text-muted-foreground">
                    Vision generation didn't complete.
                  </p>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      if (imagePreview && roomId) {
                        setVisionImage(null);
                        setShowVision(true);
                        if (isGuest) {
                          generateVisionGuest(imagePreview, intent);
                        } else {
                          generateVision(imagePreview, intent, roomId);
                        }
                      }
                    }}
                  >
                    Try again
                  </Button>
                </CardContent>
              </Card>
            )}


            <Card className="border-0 shadow-sm bg-accent/30">
              <CardContent className="p-4 text-center">
                <div className="w-12 h-12 mx-auto mb-3 rounded-full bg-primary/20 flex items-center justify-center">
                  <Sparkles className="w-6 h-6 text-primary" />
                </div>
                <h3 className="font-semibold text-lg mb-1">{t('capture.ready.title')}</h3>
                <p className="text-sm text-muted-foreground">
                  {generatingVision
                    ? t('capture.ready.sub')
                    : visionImage
                    ? "Your vision is ready! Start your challenges to transform your space."
                    : "Let's start transforming your space!"}
                </p>
              </CardContent>
            </Card>

            <Button
              className="w-full h-14 text-base font-medium"
              onClick={proceedToChallenges}
            >
              <Sparkles className="w-5 h-5 mr-2" />
              {generatingVision ? t('capture.start.loading') : t('capture.start.btn')}
            </Button>
          </div>
        )}

        {/* Tip */}
        <Card className="border-0 shadow-sm bg-accent/20 animate-fade-in" style={{ animationDelay: "0.3s" }}>
          <CardContent className="p-4 flex items-center gap-3">
            <Clock className="w-5 h-5 text-accent-foreground shrink-0" />
            <p className="text-sm text-accent-foreground">
              <strong>Tip:</strong> Capture the whole space for better challenge suggestions!
            </p>
          </CardContent>
        </Card>
      </main>
    </div>
  );
};

export default Capture;
