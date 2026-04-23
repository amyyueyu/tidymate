import { useEffect, useState, useMemo } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { toast } from "@/components/ui/sonner";
import {
  ArrowLeft,
  Leaf,
  Heart,
  Gift,
  DollarSign,
  Recycle,
  Trash2,
  SkipForward,
  Check,
  Edit3,
} from "lucide-react";
import { LangToggle } from "@/components/LangToggle";
import { useLang } from "@/contexts/LanguageContext";

type Action = "keep" | "donate" | "sell" | "recycle" | "toss";

interface DecisionItem {
  id: string;
  session_id: string;
  name: string;
  visual_description: string | null;
  category: string | null;
  ai_suggested_action: string;
  ai_rationale: string | null;
  confidence: number | null;
  user_action: string | null;
  status: string;
  sort_order: number;
}

const ACTION_META: Record<Action, { icon: any; label: string; tone: string }> = {
  keep:    { icon: Heart,      label: "Keep",    tone: "bg-rose-500"    },
  donate:  { icon: Gift,       label: "Donate",  tone: "bg-emerald-500" },
  sell:    { icon: DollarSign, label: "Sell",    tone: "bg-amber-500"   },
  recycle: { icon: Recycle,    label: "Recycle", tone: "bg-sky-500"     },
  toss:    { icon: Trash2,     label: "Toss",    tone: "bg-zinc-500"    },
};

const DecisionSession = () => {
  const { sessionId } = useParams<{ sessionId: string }>();
  const navigate = useNavigate();
  const { user, loading: authLoading } = useAuth();
  const { t } = useLang();

  const [session, setSession] = useState<any>(null);
  const [items, setItems] = useState<DecisionItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [showOverride, setShowOverride] = useState(false);

  useEffect(() => {
    if (authLoading) return;
    if (!user) {
      navigate("/auth");
      return;
    }
    if (!sessionId) return;
    loadSession();
  }, [sessionId, user, authLoading]);

  const loadSession = async () => {
    setLoading(true);
    const { data: sess } = await supabase
      .from("decision_sessions")
      .select("*")
      .eq("id", sessionId!)
      .single();
    const { data: itms } = await supabase
      .from("decision_items")
      .select("*")
      .eq("session_id", sessionId!)
      .order("sort_order", { ascending: true });
    setSession(sess);
    setItems(itms || []);
    setLoading(false);
  };

  const pendingItems = useMemo(() => items.filter((i) => i.status === "pending"), [items]);
  const currentItem = pendingItems[0];
  const completedCount = items.length - pendingItems.length;

  const recordDecision = async (action: Action | "skip") => {
    if (!currentItem || submitting) return;
    setSubmitting(true);
    try {
      if (action === "skip") {
        await supabase
          .from("decision_items")
          .update({ status: "skipped", user_action_at: new Date().toISOString() })
          .eq("id", currentItem.id);
      } else {
        const acceptedAi = action === currentItem.ai_suggested_action;
        const { error } = await supabase.rpc("complete_decision_add_points", {
          p_item_id: currentItem.id,
          p_user_action: action,
          p_accepted_ai: acceptedAi,
        });
        if (error) throw error;
        if (acceptedAi) {
          toast.success(`+7 pts · ${ACTION_META[action].label}`);
        } else {
          toast.success(`+5 pts · ${ACTION_META[action].label}`);
        }
      }
      // Refresh items locally to advance
      setItems((prev) =>
        prev.map((it) =>
          it.id === currentItem.id
            ? { ...it, status: action === "skip" ? "skipped" : "done", user_action: action === "skip" ? null : action }
            : it
        )
      );
      setShowOverride(false);
    } catch (err: any) {
      console.error("Record decision error:", err);
      toast.error(err.message || "Couldn't save decision");
    } finally {
      setSubmitting(false);
    }
  };

  const finishSession = async () => {
    if (!session) return;
    await supabase
      .from("decision_sessions")
      .update({ status: "completed", completed_at: new Date().toISOString() })
      .eq("id", session.id);
    navigate("/");
  };

  if (authLoading || loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Leaf className="w-8 h-8 text-primary animate-pulse" />
      </div>
    );
  }

  if (!session) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background p-6 text-center">
        <div>
          <p className="text-muted-foreground mb-4">Session not found.</p>
          <Button onClick={() => navigate("/")}>Back home</Button>
        </div>
      </div>
    );
  }

  const allDone = pendingItems.length === 0;

  return (
    <div className="min-h-screen bg-[#f5f4f0]">
      {/* Header */}
      <header className="sticky top-0 z-10 bg-background/85 backdrop-blur-sm border-b border-border">
        <div className="container max-w-2xl mx-auto px-4 py-4 flex items-center gap-3">
          <Button variant="ghost" size="icon" onClick={() => navigate("/")}>
            <ArrowLeft className="w-5 h-5" />
          </Button>
          <div className="flex items-center gap-2">
            <Leaf className="w-5 h-5 text-primary" />
            <span className="font-semibold">{t("decide.title")}</span>
          </div>
          <span className="ml-auto text-xs font-semibold text-muted-foreground">
            {completedCount} / {items.length}
          </span>
          <LangToggle />
        </div>
        <div className="h-1 bg-muted">
          <div
            className="h-full bg-primary transition-all"
            style={{ width: `${items.length ? (completedCount / items.length) * 100 : 0}%` }}
          />
        </div>
      </header>

      <main className="container max-w-md mx-auto px-4 py-6">
        {allDone ? (
          <Card className="border-0 shadow-sm">
            <CardContent className="p-8 text-center space-y-4">
              <div className="w-16 h-16 mx-auto rounded-2xl bg-primary/10 flex items-center justify-center">
                <Check className="w-8 h-8 text-primary" />
              </div>
              <h2 className="text-2xl font-black">{t("decide.done.title")}</h2>
              <p className="text-muted-foreground">
                {t("decide.done.sub").replace("{count}", String(completedCount))}
              </p>
              <Button size="lg" className="w-full" onClick={finishSession}>
                {t("decide.done.cta")}
              </Button>
            </CardContent>
          </Card>
        ) : currentItem ? (
          <ItemCard
            key={currentItem.id}
            item={currentItem}
            sessionImage={session.image_url}
            showOverride={showOverride}
            onShowOverride={() => setShowOverride(true)}
            onCancelOverride={() => setShowOverride(false)}
            onAccept={() => recordDecision(currentItem.ai_suggested_action as Action)}
            onOverride={(a) => recordDecision(a)}
            onSkip={() => recordDecision("skip")}
            submitting={submitting}
            t={t}
          />
        ) : null}
      </main>
    </div>
  );
};

interface ItemCardProps {
  item: DecisionItem;
  sessionImage: string;
  showOverride: boolean;
  onShowOverride: () => void;
  onCancelOverride: () => void;
  onAccept: () => void;
  onOverride: (a: Action) => void;
  onSkip: () => void;
  submitting: boolean;
  t: (k: string) => string;
}

function ItemCard({
  item,
  sessionImage,
  showOverride,
  onShowOverride,
  onCancelOverride,
  onAccept,
  onOverride,
  onSkip,
  submitting,
  t,
}: ItemCardProps) {
  const aiAction = (item.ai_suggested_action as Action) ?? "keep";
  const meta = ACTION_META[aiAction] ?? ACTION_META.keep;
  const Icon = meta.icon;

  return (
    <div className="space-y-4 animate-fade-in">
      {/* Photo (small reference) */}
      <div className="rounded-2xl overflow-hidden aspect-video bg-muted">
        <img src={sessionImage} alt="Items" className="w-full h-full object-cover" />
      </div>

      {/* AI suggestion card */}
      <Card className="border-0 shadow-md overflow-hidden">
        <div className={`${meta.tone} px-5 py-3 flex items-center gap-2 text-white`}>
          <Icon className="w-5 h-5" />
          <span className="font-bold uppercase tracking-wide text-sm">
            {t(`decide.action.${aiAction}`)}
          </span>
          {item.confidence !== null && (
            <span className="ml-auto text-xs opacity-80">
              {Math.round((item.confidence || 0) * 100)}%
            </span>
          )}
        </div>
        <CardContent className="p-5 space-y-3">
          <div>
            <h3 className="font-black text-lg leading-tight">{item.name}</h3>
            {item.visual_description && (
              <p className="text-xs text-muted-foreground mt-1">{item.visual_description}</p>
            )}
          </div>
          {item.ai_rationale && (
            <p className="text-sm text-foreground/80 leading-relaxed">
              "{item.ai_rationale}"
            </p>
          )}
        </CardContent>
      </Card>

      {!showOverride ? (
        <div className="space-y-2">
          <Button
            size="lg"
            className="w-full h-14 font-bold"
            onClick={onAccept}
            disabled={submitting}
          >
            <Check className="w-5 h-5" />
            {t("decide.accept")} · {t(`decide.action.${aiAction}`)}
          </Button>
          <div className="grid grid-cols-2 gap-2">
            <Button
              variant="outline"
              size="lg"
              className="h-12"
              onClick={onShowOverride}
              disabled={submitting}
            >
              <Edit3 className="w-4 h-4" />
              {t("decide.override")}
            </Button>
            <Button
              variant="ghost"
              size="lg"
              className="h-12"
              onClick={onSkip}
              disabled={submitting}
            >
              <SkipForward className="w-4 h-4" />
              {t("decide.skip")}
            </Button>
          </div>
        </div>
      ) : (
        <div className="space-y-2">
          <p className="text-sm font-semibold text-center text-muted-foreground">
            {t("decide.choose.action")}
          </p>
          <div className="grid grid-cols-2 gap-2">
            {(Object.keys(ACTION_META) as Action[]).map((a) => {
              const m = ACTION_META[a];
              const AIcon = m.icon;
              return (
                <Button
                  key={a}
                  variant="outline"
                  size="lg"
                  className="h-14 justify-start"
                  disabled={submitting}
                  onClick={() => onOverride(a)}
                >
                  <span className={`w-7 h-7 rounded-lg ${m.tone} flex items-center justify-center text-white`}>
                    <AIcon className="w-4 h-4" />
                  </span>
                  <span className="font-semibold">{t(`decide.action.${a}`)}</span>
                </Button>
              );
            })}
          </div>
          <Button variant="ghost" size="sm" className="w-full" onClick={onCancelOverride}>
            {t("decide.cancel")}
          </Button>
        </div>
      )}
    </div>
  );
}

export default DecisionSession;
