import { useAuth } from "@/hooks/useAuth";
import { useProfile } from "@/hooks/useProfile";
import { useNavigate } from "react-router-dom";
import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { analytics } from "@/lib/analytics";
import {
  Camera,
  Leaf,
  ArrowRight,
  LogOut,
  Sparkles,
} from "lucide-react";
import { getBadgeForLevel } from "@/lib/levelBadges";
import { LangToggle } from "@/components/LangToggle";
import { useLang } from "@/contexts/LanguageContext";

const GREETINGS = [
  "No pressure. Even 10 minutes counts.",
  "Your space, your pace.",
  "Let's just make it a tiny bit better.",
  "You showed up. That's the hard part.",
  "Small wins are still wins.",
];

function getRoomEmoji(name: string): string {
  const n = name.toLowerCase();
  if (n.includes("bedroom") || n.includes("bed")) return "🛏️";
  if (n.includes("desk") || n.includes("office")) return "🖥️";
  if (n.includes("kitchen")) return "🍳";
  if (n.includes("bathroom") || n.includes("bath")) return "🚿";
  if (n.includes("living") || n.includes("lounge")) return "🛋️";
  if (n.includes("storage") || n.includes("closet")) return "📦";
  return "✨";
}

const Index = () => {
  const { user, loading: authLoading, signOut } = useAuth();
  const { profile, loading: profileLoading } = useProfile();
  const navigate = useNavigate();
  const { t } = useLang();
  const [activeRooms, setActiveRooms] = useState<any[]>([]);
  const [roomsLoaded, setRoomsLoaded] = useState(false);
  const [tasksCompleted, setTasksCompleted] = useState(0);
  const [showOnboarding, setShowOnboarding] = useState(false);
  const greeting = useMemo(() => GREETINGS[Math.floor(Math.random() * GREETINGS.length)], []);

  const isFirstTimeUser = useMemo(() => {
    if (profileLoading || authLoading || !roomsLoaded) return false;
    if (!profile) return false;
    if (activeRooms.length > 0) return false;
    if (profile.total_points > 0) return false;
    return true;
  }, [profile, activeRooms, profileLoading, authLoading, roomsLoaded]);

  useEffect(() => {
    analytics.landingView();
    analytics.testEvent();
  }, []);

  useEffect(() => {
    if (!authLoading && !user) {
      navigate("/landing", { replace: true });
    }
  }, [user, authLoading, navigate]);

  useEffect(() => {
    if (user) {
      fetchActiveRooms();
      fetchTasksCompleted();
    }
  }, [user]);

  const fetchActiveRooms = async () => {
    const { data } = await supabase
      .from("rooms")
      .select("*")
      .eq("user_id", user?.id)
      .eq("status", "active")
      .order("created_at", { ascending: false })
      .limit(3);

    if (data) setActiveRooms(data);
    setRoomsLoaded(true);
  };

  const fetchTasksCompleted = async () => {
    const { count } = await supabase
      .from("challenges")
      .select("*", { count: "exact", head: true })
      .eq("user_id", user?.id)
      .eq("status", "completed");
    setTasksCompleted(count ?? 0);
  };

  useEffect(() => {
    if (!profileLoading && !authLoading && roomsLoaded && profile && activeRooms.length === 0) {
      const hasSeenOnboarding = localStorage.getItem(
        `tidymate_onboarded_${user?.id}`
      );
      if (!hasSeenOnboarding && profile.total_points === 0) {
        const timer = setTimeout(() => setShowOnboarding(true), 400);
        return () => clearTimeout(timer);
      }
    }
  }, [profile, profileLoading, authLoading, activeRooms, roomsLoaded, user]);

  const handleOnboardingDismiss = (goToCapture: boolean) => {
    localStorage.setItem(`tidymate_onboarded_${user?.id}`, "true");
    setShowOnboarding(false);
    if (goToCapture) {
      navigate("/capture");
    }
  };

  if (authLoading || profileLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="text-center">
          <Leaf className="w-12 h-12 text-primary mx-auto animate-gentle-bounce" />
          <p className="mt-4 text-muted-foreground">Loading your space...</p>
        </div>
      </div>
    );
  }

  if (!user || !profile) return null;

  const levelProgress = profile.total_points % 100;
  const pointsToNextLevel = 100 - levelProgress;
  const displayName = profile.display_name || "friend";
  const badge = getBadgeForLevel(profile.current_level);

  return (
    <div className="min-h-screen bg-[#f5f4f0]">
      {/* ── Hero Header ─────────────────────────────────────────────── */}
      <div className="bg-primary px-6 pt-14 pb-10 relative overflow-hidden">
        <div className="absolute -top-20 -right-16 w-64 h-64 rounded-full bg-white/5 pointer-events-none" />
        <div className="absolute -bottom-10 -left-8 w-40 h-40 rounded-full bg-white/[0.04] pointer-events-none" />

        {/* Nav row */}
        <div className="flex justify-between items-center mb-6 relative z-10">
          <div className="flex items-center gap-2">
            <Leaf className="w-5 h-5 text-white" />
            <span className="font-bold text-white text-lg">TidyMate</span>
          </div>
          <div className="flex items-center gap-2">
            <LangToggle />
            <button
              onClick={signOut}
              className="w-9 h-9 rounded-xl bg-white/15 flex items-center justify-center"
            >
              <LogOut className="w-4 h-4 text-white/80" />
            </button>
          </div>
        </div>

        {/* Greeting */}
        <h1 className="font-black text-white text-3xl leading-tight mb-1 relative z-10">
          Hey, {displayName}! 👋
        </h1>
        <p className="text-white/70 text-sm relative z-10">{t('dash.greeting.sub')}</p>
      </div>

      {/* ── Floating Stat Cards ──────────────────────────────────────── */}
      <div className="grid grid-cols-3 gap-2 mx-5 -mt-6 relative z-10">
        <div className="bg-white rounded-2xl p-3 text-center" style={{ boxShadow: "0 4px 16px rgba(0,0,0,0.08)" }}>
          <span className="text-xl block mb-0.5">✅</span>
          <p className="font-black text-xl text-amber-500 leading-none">{tasksCompleted}</p>
          <p className="text-[10px] text-gray-400 mt-0.5">{t('dash.tasks.done')}</p>
        </div>
        <div className="bg-white rounded-2xl p-3 text-center" style={{ boxShadow: "0 4px 16px rgba(0,0,0,0.08)" }}>
          <span className="text-xl block mb-0.5">⭐</span>
          <p className="font-black text-xl text-violet-600 leading-none">{profile.total_points}</p>
          <p className="text-[10px] text-gray-400 mt-0.5">{t('dash.points')}</p>
        </div>
        <div className="bg-white rounded-2xl p-3 text-center" style={{ boxShadow: "0 4px 16px rgba(0,0,0,0.08)" }}>
          <span className="text-xl block mb-0.5">🏆</span>
          <p className="font-black text-xl text-primary leading-none">Lv.{profile.current_level}</p>
          <p className="text-[10px] text-gray-400 mt-0.5 truncate">{badge.title}</p>
        </div>
      </div>

      {/* ── Body ────────────────────────────────────────────────────── */}
      <div className="px-5 pt-3 pb-24">

        {/* Level progress bar */}
        <div className="bg-white rounded-2xl px-4 py-3 mb-3.5 mt-3" style={{ boxShadow: "0 2px 8px rgba(0,0,0,0.05)" }}>
          <div className="flex justify-between items-center mb-2">
            <span className="font-bold text-sm text-gray-900">
              {badge.title} · Level {profile.current_level}
            </span>
            <span className="text-[11px] text-gray-400">
              {pointsToNextLevel} {t('dash.pts.next')} {profile.current_level + 1}
            </span>
          </div>
          <div className="h-1.5 bg-gray-100 rounded-full overflow-hidden">
            <div
              className="h-full bg-primary rounded-full transition-all duration-500"
              style={{ width: `${levelProgress}%` }}
            />
          </div>
        </div>

        {/* Primary CTA card */}
        <div
          className="bg-primary rounded-2xl p-5 mb-5 flex items-center gap-4 relative overflow-hidden cursor-pointer active:scale-95 transition-transform"
          onClick={() => navigate("/capture")}
          style={{ boxShadow: "0 4px 20px rgba(13,156,107,0.3)" }}
        >
          <div className="absolute -top-10 -right-5 w-28 h-28 rounded-full bg-white/[0.08] pointer-events-none" />
          <div className="w-12 h-12 rounded-2xl bg-white/20 flex items-center justify-center flex-shrink-0">
            <Camera className="w-6 h-6 text-white" />
          </div>
          <div className="flex-1 relative z-10">
            <p className="font-extrabold text-white text-base leading-tight">
              {t('dash.capture.title')}
            </p>
            <p className="text-white/70 text-xs mt-0.5">
              {t('dash.capture.sub')}
            </p>
          </div>
          <div className="w-8 h-8 rounded-xl bg-white/20 flex items-center justify-center relative z-10">
            <ArrowRight className="w-4 h-4 text-white" />
          </div>
        </div>

        {/* Active challenges */}
        {activeRooms.length > 0 && (
          <>
            <div className="flex justify-between items-center mb-3">
              <h2 className="font-black text-base text-gray-900">{t('dash.active.title')}</h2>
              <span className="text-xs font-semibold bg-gray-900 text-white px-2.5 py-1 rounded-full">
                {activeRooms.length} {t('dash.rooms')}
              </span>
            </div>

            {activeRooms.map((room) => {
              const pct = room.total_challenges > 0
                ? Math.round((room.completed_challenges / room.total_challenges) * 100)
                : 0;
              return (
                <div
                  key={room.id}
                  className="bg-white rounded-2xl p-4 mb-2.5 flex items-center gap-3 cursor-pointer active:scale-95 transition-transform relative overflow-hidden"
                  style={{ boxShadow: "0 2px 8px rgba(0,0,0,0.05)" }}
                  onClick={() => {
                    analytics.challengeStarted({ room_type: room.intent, tasks_completed: room.completed_challenges });
                    navigate(`/challenge/${room.id}`);
                  }}
                >
                  {/* Left accent bar */}
                  <div className={`absolute left-0 top-0 bottom-0 w-[3px] rounded-r-full ${room.completed_challenges > 0 ? "bg-primary" : "bg-gray-200"}`} />

                  {/* Room emoji */}
                  <div className={`w-11 h-11 rounded-xl flex items-center justify-center text-xl flex-shrink-0 ${room.completed_challenges > 0 ? "bg-primary/[0.08]" : "bg-gray-50"}`}>
                    {getRoomEmoji(room.name)}
                  </div>

                  {/* Room info */}
                  <div className="flex-1 min-w-0">
                    <p className="font-bold text-sm text-gray-900 truncate">{room.name}</p>
                    <p className="text-[11px] text-gray-400 mt-0.5">
                      {room.completed_challenges} of {room.total_challenges} {t('dash.challenges.done')}
                    </p>
                  </div>

                  {/* Progress */}
                  <div className="text-right flex-shrink-0">
                    <p className={`font-black text-sm leading-none ${pct > 0 ? "text-primary" : "text-gray-300"}`}>
                      {pct}%
                    </p>
                    <div className="w-11 h-1 bg-gray-100 rounded-full mt-1.5 overflow-hidden">
                      <div
                        className="h-full bg-primary rounded-full"
                        style={{ width: `${pct}%` }}
                      />
                    </div>
                  </div>
                </div>
              );
            })}
          </>
        )}
      </div>

      {/* ── First-session onboarding overlay ──────────────────────── */}
      {showOnboarding && (
        <div className="fixed inset-0 z-50 flex items-end justify-center sm:items-center">
          <div
            className="absolute inset-0 bg-foreground/40 backdrop-blur-sm"
            onClick={() => handleOnboardingDismiss(false)}
          />
          <div className="relative z-10 w-full max-w-sm mx-4 mb-6 sm:mb-0 bg-card rounded-3xl shadow-2xl p-8 animate-fade-in overflow-hidden">
            <div className="absolute -top-6 -right-6 w-24 h-24 rounded-full bg-primary/10 flex items-end justify-start pl-6 pb-4">
              <Leaf className="w-8 h-8 text-primary opacity-60" />
            </div>
            <div className="w-16 h-16 rounded-2xl bg-primary flex items-center justify-center mb-6">
              <Camera className="w-8 h-8 text-primary-foreground" />
            </div>
            <h2 className="text-2xl font-bold text-foreground leading-snug mb-3">
              {t('onboard.title')}
            </h2>
            <p className="text-muted-foreground text-sm leading-relaxed mb-6">
              {t('onboard.sub')}
            </p>
            <p className="text-xs text-muted-foreground mb-6 flex items-center gap-1.5">
              <Sparkles className="w-3.5 h-3.5 text-primary" />
              {t('onboard.micro')}
            </p>
            <button
              onClick={() => handleOnboardingDismiss(true)}
              className="w-full flex items-center justify-center gap-2 rounded-xl bg-primary text-primary-foreground font-semibold py-3.5 text-base hover:bg-primary/90 transition-colors mb-3"
            >
              <Camera className="w-5 h-5" />
              {t('onboard.cta')}
            </button>
            <button
              onClick={() => handleOnboardingDismiss(false)}
              className="w-full text-center text-sm text-muted-foreground hover:text-foreground transition-colors py-1"
            >
              {t('onboard.skip')}
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default Index;
