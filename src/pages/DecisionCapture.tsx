import { useState, useRef, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { toast } from "@/components/ui/sonner";
import { Camera, ArrowLeft, Sparkles, Leaf, Package, Box } from "lucide-react";
import { LangToggle } from "@/components/LangToggle";
import { useLang } from "@/contexts/LanguageContext";
import { analytics } from "@/lib/analytics";

type DecisionIntent = "single" | "pile";

const DecisionCapture = () => {
  const navigate = useNavigate();
  const { user, loading: authLoading } = useAuth();
  const { t } = useLang();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [intent, setIntent] = useState<DecisionIntent>("pile");
  const [analyzing, setAnalyzing] = useState(false);

  // Auth guard — Decision Coach requires login (Premium feature, soft-launched free)
  useEffect(() => {
    if (authLoading) return;
    if (!user) navigate("/auth");
  }, [user, authLoading, navigate]);

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
      img.onerror = () => resolve(dataUrl);
      img.src = dataUrl;
    });
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = async (ev) => {
      const raw = ev.target?.result as string;
      const compressed = await compressImage(raw);
      setImagePreview(compressed);
      analytics.decisionPhotoUploaded({ intent });
    };
    reader.readAsDataURL(file);
  };

  const uploadImageToStorage = async (dataUrl: string): Promise<string> => {
    const base64 = dataUrl.split(",")[1];
    const mimeType = dataUrl.split(";")[0].split(":")[1] || "image/jpeg";
    const ext = mimeType.split("/")[1] || "jpg";
    const fileName = `${user!.id}/decisions/${Date.now()}.${ext}`;
    const byteChars = atob(base64);
    const byteArray = new Uint8Array(byteChars.length);
    for (let i = 0; i < byteChars.length; i++) byteArray[i] = byteChars.charCodeAt(i);
    const blob = new Blob([byteArray], { type: mimeType });
    const { error } = await supabase.storage
      .from("room-images")
      .upload(fileName, blob, { contentType: mimeType, upsert: false });
    if (error) throw error;
    const { data: { publicUrl } } = supabase.storage.from("room-images").getPublicUrl(fileName);
    return publicUrl;
  };

  const handleAnalyze = async () => {
    if (!imagePreview) {
      toast.error("Add a photo first");
      return;
    }
    setAnalyzing(true);
    try {
      // Upload image to storage so we can persist it on the session row
      let storedUrl = imagePreview;
      try {
        storedUrl = await uploadImageToStorage(imagePreview);
      } catch (e) {
        console.warn("Image upload failed, using base64 inline", e);
      }

      const response = await supabase.functions.invoke("analyze-items", {
        body: { imageUrl: storedUrl, intent },
      });
      if (response.error) {
        throw new Error(response.error.message || "Failed to analyze items");
      }
      const items = response.data?.items as any[] | undefined;
      if (!items?.length) {
        toast.error("Couldn't identify items in this photo. Try a clearer shot.");
        setAnalyzing(false);
        return;
      }

      // Create session
      const { data: session, error: sessionErr } = await supabase
        .from("decision_sessions")
        .insert({
          user_id: user!.id,
          image_url: storedUrl,
          intent,
          item_count: items.length,
        })
        .select()
        .single();
      if (sessionErr) throw sessionErr;

      // Insert items
      const rows = items.map((it, i) => ({
        session_id: session.id,
        user_id: user!.id,
        name: it.name,
        visual_description: it.visual_description,
        category: it.category,
        ai_suggested_action: it.suggested_action,
        ai_rationale: it.rationale,
        confidence: it.confidence,
        sort_order: i,
      }));
      const { error: itemsErr } = await supabase.from("decision_items").insert(rows);
      if (itemsErr) throw itemsErr;

      analytics.decisionSessionStarted({ intent, item_count: items.length });
      toast.success(`Found ${items.length} item${items.length > 1 ? "s" : ""} to review!`);
      navigate(`/decide/${session.id}`);
    } catch (err: any) {
      console.error("Decision analyze error:", err);
      toast.error(err.message || "Something went wrong. Try again.");
    } finally {
      setAnalyzing(false);
    }
  };

  if (authLoading || !user) return null;

  return (
    <div className="min-h-screen bg-background">
      <header className="sticky top-0 z-10 bg-background/80 backdrop-blur-sm border-b border-border">
        <div className="container max-w-2xl mx-auto px-4 py-4 flex items-center gap-3">
          <Button variant="ghost" size="icon" onClick={() => navigate("/")}>
            <ArrowLeft className="w-5 h-5" />
          </Button>
          <div className="flex items-center gap-2">
            <Leaf className="w-5 h-5 text-primary" />
            <span className="font-semibold">{t("decide.title")}</span>
          </div>
          <span className="ml-auto"><LangToggle /></span>
        </div>
      </header>

      <main className="container max-w-2xl mx-auto px-4 py-6 space-y-6">
        <div className="space-y-2">
          <h1 className="text-2xl font-black text-foreground leading-tight">
            {t("decide.heading")}
          </h1>
          <p className="text-sm text-muted-foreground">
            {t("decide.subheading")}
          </p>
        </div>

        <Card className="border-0 shadow-sm overflow-hidden">
          <CardContent className="p-0">
            {imagePreview ? (
              <div className="relative">
                <img src={imagePreview} alt="Items preview" className="w-full aspect-[4/3] object-cover" />
                <Button
                  variant="secondary"
                  size="sm"
                  className="absolute bottom-4 right-4"
                  onClick={() => {
                    setImagePreview(null);
                    if (fileInputRef.current) fileInputRef.current.value = "";
                  }}
                >
                  {t("decide.retake")}
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
                <div className="text-center px-4">
                  <p className="font-medium">{t("decide.upload.title")}</p>
                  <p className="text-sm text-muted-foreground">{t("decide.upload.sub")}</p>
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

        <div className="space-y-3">
          <h2 className="font-semibold">{t("decide.intent.label")}</h2>
          <div className="grid grid-cols-2 gap-3">
            <Card
              className={`border-2 cursor-pointer transition-all ${
                intent === "single" ? "border-primary bg-primary/5" : "border-transparent hover:border-border"
              }`}
              onClick={() => setIntent("single")}
            >
              <CardContent className="p-4 text-center">
                <Box className="w-6 h-6 text-primary mx-auto mb-2" />
                <p className="font-semibold text-sm">{t("decide.intent.single")}</p>
                <p className="text-xs text-muted-foreground mt-1">{t("decide.intent.single.sub")}</p>
              </CardContent>
            </Card>
            <Card
              className={`border-2 cursor-pointer transition-all ${
                intent === "pile" ? "border-primary bg-primary/5" : "border-transparent hover:border-border"
              }`}
              onClick={() => setIntent("pile")}
            >
              <CardContent className="p-4 text-center">
                <Package className="w-6 h-6 text-primary mx-auto mb-2" />
                <p className="font-semibold text-sm">{t("decide.intent.pile")}</p>
                <p className="text-xs text-muted-foreground mt-1">{t("decide.intent.pile.sub")}</p>
              </CardContent>
            </Card>
          </div>
        </div>

        <Button
          size="lg"
          className="w-full h-14 text-base font-semibold"
          disabled={!imagePreview || analyzing}
          onClick={handleAnalyze}
        >
          {analyzing ? (
            <>
              <Sparkles className="w-5 h-5 animate-pulse" />
              {t("decide.analyzing")}
            </>
          ) : (
            <>
              <Sparkles className="w-5 h-5" />
              {t("decide.analyze.btn")}
            </>
          )}
        </Button>

        <p className="text-xs text-muted-foreground text-center">
          {t("decide.philosophy")}
        </p>
      </main>
    </div>
  );
};

export default DecisionCapture;
