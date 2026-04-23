import { useState, useEffect, useCallback, useRef } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { useProfile } from "@/hooks/useProfile";
import { useGuestMode } from "@/contexts/GuestModeContext";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { toast } from "@/components/ui/sonner";
import {
  ArrowLeft,
  Leaf,
  Play,
  Pause,
  Check,
  SkipForward,
  RotateCcw,
  Star,
  Trophy,
  Sparkles,
  Eye,
  CheckCircle2,
  Circle,
  FastForward,
  UserPlus,
  Camera,
  Share2,
  Music2,
} from "lucide-react";

// Circumference for r=70 SVG ring
const CIRCUMFERENCE = 2 * Math.PI * 70;

import VisionComparison from "@/components/VisionComparison";
import SaveProgressModal from "@/components/SaveProgressModal";
import ProgressPhotoUpload from "@/components/ProgressPhotoUpload";
import PraiseCard from "@/components/PraiseCard";
import ShareCard from "@/components/ShareCard";
import LevelUpShareCard from "@/components/LevelUpShareCard";
import { getBadgeForLevel, LEVEL_BADGES } from "@/lib/levelBadges";
import { ScrollArea } from "@/components/ui/scroll-area";
import { cn } from "@/lib/utils";
import { analytics } from "@/lib/analytics";
import { useConfetti } from "@/hooks/useConfetti";
import { LangToggle } from "@/components/LangToggle";
import { useLang } from "@/contexts/LanguageContext";

// ─── Audio helpers ─────────────────────────────────────────────────────────────
function playTone(
  type: OscillatorType,
  frequency: number,
  duration: number,
  gain = 0.15
) {
  try {
    const ctx = new AudioContext();
    const osc = ctx.createOscillator();
    const gainNode = ctx.createGain();
    osc.connect(gainNode);
    gainNode.connect(ctx.destination);
    osc.type = type;
    osc.frequency.value = frequency;
    gainNode.gain.setValueAtTime(gain, ctx.currentTime);
    gainNode.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + duration);
    osc.start();
    osc.stop(ctx.currentTime + duration);
  } catch {
    // Audio not available — fail silently
  }
}

function playDoneSound() {
  playTone("sine", 523, 0.15); // C5
  setTimeout(() => playTone("sine", 659, 0.25), 120); // E5
}

function playEarlyFinishSound() {
  playTone("sine", 523, 0.1);
  setTimeout(() => playTone("sine", 659, 0.1), 80);
  setTimeout(() => playTone("sine", 784, 0.2), 160); // G5
}

// ─── YouTube BGM vibes ──────────────────────────────────────────────────────────
const MUSIC_PLAYLISTS: Record<string, string> = {
  "lofi focus":  "jfKfPfyJRdk",  // Lofi Girl — live stream, embeddable ✓
  "chill waves": "Na0w3Mz46GA",  // Lofi Girl — live stream, embeddable ✓
  "upbeat":      "7NOSDKb0HlU",  // Chillhop Music — embeddable ✓
  "night calm":  "4xDzrJKXOOY",  // Lofi Girl — embeddable ✓
  "indie pop":   "n61ULEU7CO0",  // Lofi Girl — embeddable ✓
};

const VIBE_LABELS: Record<string, string> = {
  "lofi focus":  "🎵 lofi focus",
  "chill waves": "🌊 chill waves",
  "upbeat":      "⚡ upbeat",
  "night calm":  "🌙 night calm",
  "indie pop":   "🎸 indie pop",
};

interface Challenge {
  id: string;
  title: string;
  description: string | null;
  time_estimate_minutes: number;
  points: number;
  status: string;
  sort_order: number;
  actual_seconds?: number | null;
}

interface Room {
  id: string;
  name: string;
  before_image_url?: string;
  after_image_url: string | null;
  intent: string;
  total_challenges: number;
  completed_challenges: number;
  status: string;
}

const ChallengePage = () => {
  const { roomId } = useParams<{ roomId: string }>();
  const navigate = useNavigate();
  const { user, loading: authLoading } = useAuth();
  const { t } = useLang();
  const { addPoints } = useProfile();
  const { popChallenge, showerComplete, starBurst } = useConfetti();
  const {
    isGuest,
    guestRoom,
    guestChallenges,
    updateGuestChallenge,
    updateGuestRoom,
  } = useGuestMode();

  const [room, setRoom] = useState<Room | null>(null);
  const [challenges, setChallenges] = useState<Challenge[]>([]);
  const [currentChallengeIndex, setCurrentChallengeIndex] = useState(0);
  const [timerActive, setTimerActive] = useState(false);
  const [timerStarted, setTimerStarted] = useState(false);
  const [timeRemaining, setTimeRemaining] = useState(0);
  const [challengeStartTime, setChallengeStartTime] = useState<number | null>(null);
  const intervalRef = useRef<NodeJS.Timeout | null>(null);
  const [loading, setLoading] = useState(true);
  const [showVision, setShowVision] = useState(false);
  const [sessionComplete, setSessionComplete] = useState(false);

  // Music state
  const [musicOn, setMusicOn] = useState(false);
  const [musicVibe, setMusicVibe] = useState("lofi focus");
  const [musicKey, setMusicKey] = useState(0);
  const musicIframeRef = useRef<HTMLIFrameElement>(null);

  // Progress photo & sharing state
  const [showProgressUpload, setShowProgressUpload] = useState(false);
  const [praiseData, setPraiseData] = useState<{
    praise: string;
    bonusPoints: number;
    progressLabel: string;
    shareTagline: string;
    shareReactionPill: string;
    shareSub: string;
    wipImageUrl: string;
  } | null>(null);
  const [showShareCard, setShowShareCard] = useState(false);
  const [sessionStartTime] = useState(() => Date.now());

  // Level-up modal + share card state
  const [showLevelUpModal, setShowLevelUpModal] = useState(false);
  const [levelUpData, setLevelUpData] = useState<{
    newLevel: number;
    badge: typeof LEVEL_BADGES[1];
  } | null>(null);
  const [showLevelUpShareCard, setShowLevelUpShareCard] = useState(false);

  // Save-progress modal for guests at high-intent moments
  const [saveModalOpen, setSaveModalOpen] = useState(false);
  const [saveModalCopy, setSaveModalCopy] = useState<{ title?: string; subtitle?: string }>({});
  const openSaveModal = (copy?: { title?: string; subtitle?: string }) => {
    setSaveModalCopy(copy ?? {});
    setSaveModalOpen(true);
  };

  // Refs to avoid stale closures in timer and to gate guest hydration
  const challengesRef = useRef<Challenge[]>([]);
  const challengeIndexRef = useRef(0);
  const guestHydratedRoomIdRef = useRef<string | null>(null);
  const timeRemainingRef = useRef(0);

  // Wake lock ref
  const wakeLockRef = useRef<WakeLockSentinel | null>(null);

  const acquireWakeLock = async () => {
    if ("wakeLock" in navigator) {
      try {
        wakeLockRef.current = await (navigator as any).wakeLock.request("screen");
      } catch {
        // Wake lock not available — fail silently
      }
    }
  };

  const releaseWakeLock = () => {
    if (wakeLockRef.current) {
      wakeLockRef.current.release();
      wakeLockRef.current = null;
    }
  };

  // Keep refs in sync with state on every render
  challengesRef.current = challenges;
  challengeIndexRef.current = currentChallengeIndex;
  timeRemainingRef.current = timeRemaining;

  // Auth guard
  useEffect(() => {
    if (!authLoading && !user && !isGuest) {
      navigate("/auth");
    }
  }, [user, authLoading, isGuest, navigate]);

  // Level-up event listener
  useEffect(() => {
    const handleLevelUp = (e: CustomEvent) => {
      setLevelUpData({
        newLevel: e.detail.newLevel,
        badge: getBadgeForLevel(e.detail.newLevel),
      });
      setShowLevelUpModal(true);
    };
    window.addEventListener("tidymate:levelup", handleLevelUp as EventListener);
    return () => window.removeEventListener("tidymate:levelup", handleLevelUp as EventListener);
  }, []);

  // Load room data — guest branch only runs ONCE per roomId via ref gate
  useEffect(() => {
    if (isGuest && guestRoom && roomId === guestRoom.id) {
      // Only hydrate initial index once; subsequent renders must not reset selection
      if (guestHydratedRoomIdRef.current !== roomId) {
        guestHydratedRoomIdRef.current = roomId;
        const mappedChallenges: Challenge[] = guestChallenges.map((c) => ({ ...c }));
        setChallenges(mappedChallenges);
        setRoom(guestRoom);
        const firstIncomplete = mappedChallenges.findIndex((c) => c.status !== "completed");
        const initialIndex = firstIncomplete >= 0 ? firstIncomplete : 0;
        setCurrentChallengeIndex(initialIndex);
        if (mappedChallenges[initialIndex]) {
          setTimeRemaining(mappedChallenges[initialIndex].time_estimate_minutes * 60);
        }
      }
      setLoading(false);
    } else if (!isGuest && roomId && user) {
      fetchRoomData();
    }
  }, [roomId, user, isGuest, guestRoom]);

  // NOTE: removed the useEffect that called updateGuestRoom(room) on every room change —
  // guest room is already updated inside completeChallenge / skipChallenge directly.

  // Cleanup interval on unmount
  useEffect(() => () => { if (intervalRef.current) clearInterval(intervalRef.current); }, []);

  // Release wake lock on unmount; reacquire after page becomes visible again
  useEffect(() => {
    const handleVisibilityChange = async () => {
      if (document.visibilityState === "visible" && timerActive) {
        await acquireWakeLock();
      }
    };
    document.addEventListener("visibilitychange", handleVisibilityChange);
    return () => {
      document.removeEventListener("visibilitychange", handleVisibilityChange);
      releaseWakeLock();
    };
  }, [timerActive]);

  const stopInterval = useCallback(() => {
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
  }, []);

  // Send play/pause commands to the YouTube iframe via postMessage
  // (works after the iframe is unlocked by the initial user-gesture mount)
  const sendYouTubeCommand = useCallback((func: "playVideo" | "pauseVideo") => {
    try {
      musicIframeRef.current?.contentWindow?.postMessage(
        JSON.stringify({ event: "command", func, args: [] }),
        "*"
      );
    } catch {
      // cross-origin errors are safe to ignore
    }
  }, []);

  const startTimer = useCallback(() => {
    stopInterval();
    const idx = challengeIndexRef.current;
    const ch = challengesRef.current[idx];
    if (!ch) return;
    const startTime = ch.time_estimate_minutes * 60;
    setTimeRemaining(startTime);
    setTimerActive(true);
    setTimerStarted(true);
    setChallengeStartTime(Date.now());
    acquireWakeLock();
    sendYouTubeCommand("playVideo");
    let remaining = startTime;
    intervalRef.current = setInterval(() => {
      remaining -= 1;
      if (remaining <= 0) {
        if (intervalRef.current) {
          clearInterval(intervalRef.current);
          intervalRef.current = null;
        }
        setTimerActive(false);
        setTimeRemaining(0);
        releaseWakeLock();
        sendYouTubeCommand("pauseVideo");
        toast("⏰ Time's up! How did it go?");
      } else {
        setTimeRemaining(remaining);
      }
    }, 1000);
  }, [stopInterval, sendYouTubeCommand]);

  const resumeTimer = useCallback(() => {
    stopInterval();
    setTimerActive(true);
    acquireWakeLock();
    sendYouTubeCommand("playVideo");
    let remaining = timeRemainingRef.current;
    intervalRef.current = setInterval(() => {
      remaining -= 1;
      if (remaining <= 0) {
        if (intervalRef.current) {
          clearInterval(intervalRef.current);
          intervalRef.current = null;
        }
        setTimerActive(false);
        setTimeRemaining(0);
        releaseWakeLock();
        sendYouTubeCommand("pauseVideo");
        toast("⏰ Time's up! How did it go?");
      } else {
        setTimeRemaining(remaining);
      }
    }, 1000);
  }, [stopInterval, sendYouTubeCommand]);

  const pauseTimer = useCallback(() => {
    stopInterval();
    setTimerActive(false);
    releaseWakeLock();
    sendYouTubeCommand("pauseVideo");
  }, [stopInterval, sendYouTubeCommand]);

  const fetchRoomData = async () => {
    setLoading(true);
    // Exclude before_image_url from the initial fetch — it can be a large base64 blob
    // for legacy rooms and is only needed when viewing the VisionComparison component.
    const { data: roomData, error: roomError } = await supabase
      .from("rooms")
      .select("id, name, intent, total_challenges, completed_challenges, status, after_image_url")
      .eq("id", roomId)
      .single();

    if (roomError) {
      toast.error("Room not found");
      navigate("/");
      return;
    }
    setRoom(roomData);

    const { data: challengeData } = await supabase
      .from("challenges")
      .select("*")
      .eq("room_id", roomId)
      .order("sort_order", { ascending: true });

    if (challengeData) {
      setChallenges(challengeData);
      const firstIncomplete = challengeData.findIndex((c) => c.status !== "completed");
      const initialIndex = firstIncomplete >= 0 ? firstIncomplete : 0;
      setCurrentChallengeIndex(initialIndex);
      if (challengeData[initialIndex]) {
        setTimeRemaining(challengeData[initialIndex].time_estimate_minutes * 60);
      }
    }
    setLoading(false);
  };

  const currentChallenge = challenges[currentChallengeIndex];
  const completedCount = challenges.filter((c) => c.status === "completed").length;
  const progressPercent = challenges.length > 0 ? (completedCount / challenges.length) * 100 : 0;
  const allDone = challenges.length > 0 && completedCount === challenges.length;

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, "0")}`;
  };

  const completeChallenge = async () => {
    if (!currentChallenge || !room) return;
    stopInterval();
    setTimerActive(false);
    setTimerStarted(false);
    releaseWakeLock();

    // Calculate actual time spent
    const actualSecs = challengeStartTime
      ? Math.round((Date.now() - challengeStartTime) / 1000)
      : 0;
    setChallengeStartTime(null);

    // Detect "finished early" (< 60% of estimated time, and timer was actually started)
    const estimatedSecs = currentChallenge.time_estimate_minutes * 60;
    const finishedEarly = actualSecs > 0 && actualSecs < estimatedSecs * 0.6;

    // Play sound effect
    if (finishedEarly) {
      playEarlyFinishSound();
    } else {
      playDoneSound();
    }

    const newCompletedCount = completedCount + 1;
    const isLast = currentChallengeIndex === challenges.length - 1;

    // Track task completion
    analytics.taskCompleted({
      room_type: room.intent,
      tasks_completed: newCompletedCount,
    });

    if (isGuest) {
      // Guest: update context only
      updateGuestChallenge(currentChallenge.id, { status: "completed", actual_seconds: actualSecs || undefined });
      setChallenges((prev) =>
        prev.map((c, i) => (i === currentChallengeIndex ? { ...c, status: "completed", actual_seconds: actualSecs || null } : c))
      );
      updateGuestRoom({
        completed_challenges: newCompletedCount,
        ...(newCompletedCount === challenges.length ? { status: "completed" } : {}),
      });
      setRoom((prev) =>
        prev
          ? {
              ...prev,
              completed_challenges: newCompletedCount,
              ...(newCompletedCount === challenges.length ? { status: "completed" } : {}),
            }
          : prev
      );
      if (finishedEarly) {
        const saved = estimatedSecs - actualSecs;
        const savedMins = Math.floor(saved / 60);
        const savedSecs = saved % 60;
        const savedStr = savedMins > 0 ? `${savedMins}m ${savedSecs}s` : `${saved}s`;
        toast(`⚡ You did that in ${savedStr} less than expected! (${currentChallenge.points} pts — save your progress to keep them)`);
      } else {
        toast(`✓ Nice work! (${currentChallenge.points} pts — save your progress to keep them)`);
      }
    } else {
      await supabase
        .from("challenges")
        .update({ status: "completed", completed_at: new Date().toISOString(), actual_seconds: actualSecs || null })
        .eq("id", currentChallenge.id);
      await addPoints(currentChallenge.points, currentChallenge.id);
      await supabase
        .from("rooms")
        .update({
          completed_challenges: newCompletedCount,
          ...(newCompletedCount === challenges.length
            ? { status: "completed", completed_at: new Date().toISOString() }
            : {}),
        })
        .eq("id", room.id);

      if (finishedEarly) {
        const saved = estimatedSecs - actualSecs;
        const savedMins = Math.floor(saved / 60);
        const savedSecs = saved % 60;
        const savedStr = savedMins > 0 ? `${savedMins}m ${savedSecs}s` : `${saved}s`;
        toast.success(`⚡ You did that in ${savedStr} less than expected!`, { duration: 4000 });
      } else {
        toast.success(`+${currentChallenge.points} points! 🎉`);
      }

      setChallenges((prev) =>
        prev.map((c, i) => (i === currentChallengeIndex ? { ...c, status: "completed", actual_seconds: actualSecs || null } : c))
      );
    }

    if (isLast) {
      analytics.roomFinished({ room_type: room.intent, tasks_completed: newCompletedCount });
      toast.success("🏆 Amazing! You've completed all challenges!");
      showerComplete();
      setSessionComplete(true);
    } else {
      popChallenge();
      const nextIndex = currentChallengeIndex + 1;
      setCurrentChallengeIndex(nextIndex);
      setTimeRemaining(challenges[nextIndex].time_estimate_minutes * 60);
    }
  };

  const skipChallenge = async () => {
    if (!currentChallenge) return;
    stopInterval();
    setTimerActive(false);
    setTimerStarted(false);
    releaseWakeLock();

    if (isGuest) {
      updateGuestChallenge(currentChallenge.id, { status: "skipped" });
    } else {
      await supabase
        .from("challenges")
        .update({ status: "skipped" })
        .eq("id", currentChallenge.id);
    }

    setChallenges((prev) =>
      prev.map((c, i) => (i === currentChallengeIndex ? { ...c, status: "skipped" } : c))
    );

    if (currentChallengeIndex < challenges.length - 1) {
      const nextIndex = currentChallengeIndex + 1;
      setCurrentChallengeIndex(nextIndex);
      setTimeRemaining(challenges[nextIndex].time_estimate_minutes * 60);
    }

    toast("Challenge skipped. No worries, you can come back to it!");
  };

  const selectChallenge = (index: number) => {
    const challenge = challenges[index];
    if (challenge.status === "completed") return;
    stopInterval();
    setTimerActive(false);
    setTimerStarted(false);
    setCurrentChallengeIndex(index);
    setTimeRemaining(challenge.time_estimate_minutes * 60);
  };

  const handlePraiseReceived = async (
    praise: string,
    bonusPoints: number,
    progressLabel: string,
    shareTagline: string,
    shareReactionPill: string,
    shareSub: string,
    wipImageUrl: string
  ) => {
    setPraiseData({ praise, bonusPoints, progressLabel, shareTagline, shareReactionPill, shareSub, wipImageUrl });
    setShowProgressUpload(false);
    starBurst();

    if (!isGuest && user && roomId) {
      try {
        await supabase.rpc("add_progress_photo_points" as any, {
          p_room_id: roomId,
          p_points: bonusPoints,
        });
      } catch (err) {
        console.error("Bonus points RPC error:", err);
      }
    }

    toast.success(`+${bonusPoints} bonus points! 🌟`);
  };

  // Ensure before_image_url is fetched before showing the share card
  const handleShowShareCard = async () => {
    if (!isGuest && roomId && room && !room.before_image_url) {
      const { data } = await supabase
        .from("rooms")
        .select("before_image_url")
        .eq("id", roomId)
        .single();
      if (data?.before_image_url) {
        setRoom((prev) => prev ? { ...prev, before_image_url: data.before_image_url } : prev);
      }
    }
    setShowShareCard(true);
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case "completed":
        return <CheckCircle2 className="w-5 h-5 text-primary" />;
      case "skipped":
        return <FastForward className="w-5 h-5 text-muted-foreground" />;
      default:
        return <Circle className="w-5 h-5 text-muted-foreground" />;
    }
  };

  if (loading || authLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="text-center">
          <Leaf className="w-12 h-12 text-primary mx-auto animate-gentle-bounce" />
          <p className="mt-4 text-muted-foreground">Loading challenges...</p>
        </div>
      </div>
    );
  }

  // Session complete screen
  if (!room || allDone || sessionComplete) {
    // Compute fastest challenge that was finished early
    const fastestChallenge = challenges
      .filter((c) => c.status === "completed" && c.actual_seconds != null && c.actual_seconds > 0)
      .sort((a, b) => (a.actual_seconds ?? 999999) - (b.actual_seconds ?? 999999))[0];
    const fastestWasEarly =
      fastestChallenge &&
      fastestChallenge.actual_seconds != null &&
      fastestChallenge.actual_seconds < fastestChallenge.time_estimate_minutes * 60 * 0.6;

    return (
      <div className="min-h-screen flex items-center justify-center bg-background px-4">
        <div className="text-center max-w-sm w-full space-y-6">
          <div className="animate-fade-in">
            <Trophy className="w-16 h-16 text-primary mx-auto mb-4" />
            <h2 className="text-2xl font-bold mb-2">
              {isGuest ? t('challenge.guest.title') : t('challenge.complete.title')}
            </h2>
            <p className="text-muted-foreground">
              {isGuest
                ? t('challenge.guest.sub')
                : t('challenge.complete.sub')}
            </p>
            {fastestWasEarly && fastestChallenge && (
              <div className="flex items-center gap-2 text-sm text-muted-foreground bg-primary/5 rounded-lg p-3 mt-3 text-left">
                <span className="text-lg">⚡</span>
                <span>
                  Fastest task: <strong>{fastestChallenge.title}</strong>
                  {" "}in {fastestChallenge.actual_seconds}s
                  {" "}(estimated {fastestChallenge.time_estimate_minutes} min)
                </span>
              </div>
            )}
          </div>

          {isGuest ? (
            <Card className="border-0 shadow-lg bg-gradient-to-br from-primary/5 to-primary/10 animate-fade-in">
              <CardContent className="p-6 space-y-4">
                <div className="space-y-1">
                  <p className="font-semibold text-lg">{t('challenge.save.title')}</p>
                  <p className="text-sm text-muted-foreground">
                    {t('challenge.save.sub')}
                  </p>
                </div>
                <Button
                  className="w-full h-12 text-base font-medium gap-2"
                  onClick={() => openSaveModal({
                    title: "Save your progress ✨",
                    subtitle: "You just finished a full session — let's keep your wins going. Create a free account to save your progress and come back anytime.",
                  })}
                >
                  <UserPlus className="w-5 h-5" />
                  {t('challenge.create.btn')}
                </Button>
                <button
                  className="w-full text-sm text-muted-foreground hover:text-foreground transition-colors"
                  onClick={() => navigate("/auth")}
                >
                  {t('challenge.signin.link')}
                </button>
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-4 w-full animate-fade-in">
              {!praiseData ? (
                <Card className="border-0 shadow-sm">
                  <CardContent className="p-4 space-y-3">
                    <p className="text-sm text-muted-foreground text-center">
                      Capture your transformation — optional but satisfying!
                    </p>
                    {showProgressUpload ? (
                      <ProgressPhotoUpload
                        roomId={roomId!}
                        roomName={room?.name ?? "My Space"}
                        intent={room?.intent ?? "tidy"}
                        beforeImageUrl={room?.before_image_url ?? ""}
                        completedChallenges={completedCount}
                        totalChallenges={challenges.length}
                        isGuest={false}
                        onPraiseReceived={handlePraiseReceived}
                      />
                    ) : (
                      <Button
                        variant="outline"
                        className="w-full gap-2"
                        onClick={() => setShowProgressUpload(true)}
                      >
                        <Camera className="w-4 h-4" />
                        Upload your after photo
                      </Button>
                    )}
                  </CardContent>
                </Card>
              ) : (
                <div className="space-y-3">
                  <PraiseCard
                    praise={praiseData.praise}
                    bonusPoints={praiseData.bonusPoints}
                    progressLabel={praiseData.progressLabel}
                    isVisible={true}
                  />
                  {!showShareCard ? (
                    <Button
                      variant="outline"
                      className="w-full gap-2"
                      onClick={handleShowShareCard}
                    >
                      <Share2 className="w-4 h-4" />
                      Create shareable card
                    </Button>
                  ) : (
                    <ShareCard
                      beforeImageUrl={room?.before_image_url ?? ""}
                      wipImageUrl={praiseData.wipImageUrl}
                      shareTagline={praiseData.shareTagline}
                      shareReactionPill={praiseData.shareReactionPill}
                      shareSub={praiseData.shareSub}
                      sessionMinutes={Math.round((Date.now() - sessionStartTime) / 60000)}
                      roomName={room?.name ?? "My Space"}
                      roomId={roomId}
                      fastestTaskSecs={fastestWasEarly && fastestChallenge?.actual_seconds ? fastestChallenge.actual_seconds : undefined}
                      fastestTaskTitle={fastestWasEarly ? fastestChallenge?.title : undefined}
                      estimatedTaskMins={fastestWasEarly ? fastestChallenge?.time_estimate_minutes : undefined}
                    />
                  )}
                </div>
              )}
              <Button onClick={() => navigate("/")}>{t('challenge.back.home')}</Button>
            </div>
          )}
        </div>
      </div>
    );
  }

  // Circular ring progress values
  const totalSecs = currentChallenge ? currentChallenge.time_estimate_minutes * 60 : 1;
  const progressRatio = totalSecs > 0 ? Math.max(0, timeRemaining / totalSecs) : 0;
  const strokeOffset = CIRCUMFERENCE * (1 - progressRatio);
  const isEnding = timeRemaining > 0 && timeRemaining <= 30;

  return (
    <div className="min-h-screen bg-[#f5f4f0] flex flex-col">
      {/* Header */}
      <header className="sticky top-0 z-10 bg-[#f5f4f0]/90 backdrop-blur-sm border-b border-border">
        <div className="container max-w-2xl mx-auto px-4 py-4">
          <div className="flex items-center gap-3 mb-3">
            <Button variant="ghost" size="icon" onClick={() => {
              if (isGuest) {
                openSaveModal({
                  title: "Continue later? ✨",
                  subtitle: "Create a free account to save this session and pick up exactly where you left off.",
                });
              } else {
                navigate("/");
              }
            }}>
              <ArrowLeft className="w-5 h-5" />
            </Button>
            <div className="flex-1">
              <p className="font-semibold truncate">{room.name}</p>
              <p className="text-xs text-muted-foreground">
                Challenge {currentChallengeIndex + 1} of {challenges.length}
              </p>
            </div>
            {isGuest ? (
              <Badge
                variant="outline"
                className="shrink-0 cursor-pointer border-primary/40 text-primary"
                onClick={() => openSaveModal()}
              >
                <UserPlus className="w-3 h-3 mr-1" />
                Save progress
              </Badge>
            ) : (
              <Badge variant="secondary" className="shrink-0 flex items-center gap-1">
                <Star className="w-3 h-3 mr-1" />
                {currentChallenge?.points} pts
                <span className="ml-1"><LangToggle /></span>
              </Badge>
            )}
          </div>
          <Progress value={progressPercent} className="h-2" />
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1 container max-w-2xl mx-auto px-4 py-6 flex flex-col">
        {/* Vision Toggle */}
        {room.after_image_url && (
          <Button
            variant="outline"
            className="mb-4 gap-2 animate-fade-in"
            onClick={async () => {
              if (!showVision && !room.before_image_url && roomId) {
                const { data } = await supabase
                  .from("rooms")
                  .select("before_image_url")
                  .eq("id", roomId)
                  .single();
                if (data?.before_image_url) {
                  setRoom((prev) => prev ? { ...prev, before_image_url: data.before_image_url } : prev);
                }
              }
              setShowVision(!showVision);
            }}
          >
            <Eye className="w-4 h-4" />
            {showVision ? "Hide Vision" : "See Your Vision"}
          </Button>
        )}

        {showVision && room.after_image_url && (
          <div className="mb-6 animate-scale-in">
            <VisionComparison
              beforeImage={room.before_image_url || ""}
              afterImage={room.after_image_url}
            />
          </div>
        )}

        {/* Challenge List */}
        <Card className="border-0 shadow-sm mb-4 animate-fade-in">
          <CardContent className="p-3">
            <p className="text-xs text-muted-foreground mb-2 px-1">Select a task to work on:</p>
            <div className="max-h-48 overflow-y-auto">
              <div className="space-y-1">
                {challenges.map((challenge, index) => (
                  <button
                    key={challenge.id}
                    type="button"
                    onClick={() => selectChallenge(index)}
                    disabled={challenge.status === "completed"}
                    className={cn(
                      "w-full flex items-center gap-3 p-3 rounded-lg text-left transition-colors",
                      index === currentChallengeIndex && challenge.status !== "completed"
                        ? "bg-primary/5 border-l-2 border-primary"
                        : "hover:bg-muted/50",
                      challenge.status === "completed" && "opacity-60 cursor-not-allowed"
                    )}
                  >
                    {getStatusIcon(challenge.status)}
                    <div className="flex-1 min-w-0">
                      <p
                        className={cn(
                          "text-sm truncate",
                          challenge.status === "completed"
                            ? "line-through text-muted-foreground/50"
                            : index === currentChallengeIndex
                            ? "font-bold text-primary"
                            : "font-medium"
                        )}
                      >
                        {challenge.title}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        ~{challenge.time_estimate_minutes} min · {challenge.points} pts
                      </p>
                    </div>
                    {index === currentChallengeIndex && challenge.status !== "completed" && (
                      <span className="shrink-0 text-xs font-semibold text-primary">
                        current
                      </span>
                    )}
                  </button>
                ))}
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Active Challenge Card */}
        {currentChallenge && currentChallenge.status !== "completed" && (
          <>
            <Card className="border-0 shadow-sm overflow-hidden rounded-3xl mb-4 animate-scale-in">
              {/* Green header */}
              <div className="bg-primary px-5 py-5 relative overflow-hidden">
                <div className="absolute -top-12 -right-8 w-36 h-36 rounded-full bg-white/[0.06] pointer-events-none" />
                <p className="text-xs font-semibold text-white/60 uppercase tracking-widest mb-1.5">
                  {t('challenge.now.doing')}
                </p>
                <h2 className="font-black text-white text-xl leading-tight mb-2">
                  {currentChallenge.title}
                </h2>
                {currentChallenge.description && (
                  <p className="text-sm text-white/75 leading-relaxed">
                    {currentChallenge.description}
                  </p>
                )}
              </div>

              <CardContent className="px-5 pt-6 pb-5">
                {/* Circular ring timer */}
                <div className="flex justify-center my-2">
                  <div className="relative w-40 h-40">
                    <svg className="w-full h-full -rotate-90" viewBox="0 0 160 160">
                      {/* Track */}
                      <circle
                        cx="80" cy="80" r="70"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="6"
                        className="text-muted/20"
                      />
                      {/* Progress */}
                      <circle
                        cx="80" cy="80" r="70"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="6"
                        strokeLinecap="round"
                        strokeDasharray={CIRCUMFERENCE}
                        strokeDashoffset={strokeOffset}
                        className={isEnding ? "text-amber-400" : "text-primary"}
                        style={{ transition: "stroke-dashoffset 1s linear" }}
                      />
                    </svg>
                    <div className="absolute inset-0 flex flex-col items-center justify-center">
                      <span className={cn(
                        "font-black text-4xl leading-none tracking-tight",
                        isEnding ? "text-amber-500" : "text-foreground"
                      )}>
                        {formatTime(timeRemaining)}
                      </span>
                      <span className="text-xs text-muted-foreground mt-1 font-medium">
                        {t('challenge.remaining')}
                      </span>
                    </div>
                  </div>
                </div>
                {timerActive && wakeLockRef.current && (
                  <p className="text-xs text-muted-foreground text-center -mt-2 mb-1">
                    Screen will stay on during session
                  </p>
                )}

                {/* Start / Continue / Pause + Restart */}
                <div className="grid grid-cols-2 gap-2 mt-3 mb-4">
                  <Button
                    variant="outline"
                    className={cn(
                      "h-11 gap-2 rounded-xl font-semibold text-sm",
                      timerActive
                        ? "border-primary/40 text-primary bg-primary/5"
                        : "border-border text-foreground"
                    )}
                    onClick={timerActive ? pauseTimer : (timerStarted ? resumeTimer : startTimer)}
                  >
                    {timerActive ? (
                      <><Pause className="w-3.5 h-3.5" /> {t('challenge.pause.btn')}</>
                    ) : timerStarted ? (
                      <><Play className="w-3.5 h-3.5" /> {t('challenge.continue.btn')}</>
                    ) : (
                      <><Play className="w-3.5 h-3.5" /> Start</>
                    )}
                  </Button>
                  <Button
                    variant="outline"
                    className="h-11 gap-2 rounded-xl font-semibold text-sm border-border text-muted-foreground"
                    onClick={startTimer}
                  >
                    <RotateCcw className="w-3.5 h-3.5" />
                    {t('challenge.restart.btn')}
                  </Button>
                </div>

                {/* Music section */}
                <div className="rounded-2xl bg-muted/50 border border-border/50 p-4 mb-5 text-left">
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center gap-2">
                      <Music2 className="w-4 h-4 text-muted-foreground" />
                      <span className="text-sm font-semibold text-foreground">{t('challenge.music.title')}</span>
                    </div>
                    <button
                      role="switch"
                      aria-checked={musicOn}
                      onClick={() => setMusicOn((v) => !v)}
                      className={cn(
                        "relative inline-flex h-7 w-12 items-center rounded-full transition-colors duration-200 flex-shrink-0 focus-visible:outline-none",
                        musicOn ? "bg-primary" : "bg-input"
                      )}
                    >
                      <span
                        className={cn(
                          "inline-block h-5 w-5 rounded-full bg-white shadow-sm transform transition-transform duration-200",
                          musicOn ? "translate-x-6" : "translate-x-1"
                        )}
                      />
                    </button>
                  </div>
                  <div className="flex flex-wrap gap-1.5">
                    {Object.keys(MUSIC_PLAYLISTS).map((vibe) => (
                      <button
                        key={vibe}
                        onClick={() => {
                          setMusicVibe(vibe);
                          setMusicKey((k) => k + 1);
                          if (!musicOn) setMusicOn(true);
                        }}
                        className={cn(
                          "px-3 py-1.5 rounded-full text-xs font-medium transition-all duration-150 border",
                          musicVibe === vibe && musicOn
                            ? "bg-primary text-primary-foreground border-primary"
                            : "bg-background text-muted-foreground border-border hover:border-primary/50"
                        )}
                      >
                        {VIBE_LABELS[vibe]}
                      </button>
                    ))}
                  </div>
                  {musicOn && (
                    <p className="text-xs text-primary mt-2.5 flex items-center gap-1.5">
                      <span className="w-1.5 h-1.5 rounded-full bg-primary animate-pulse inline-block flex-shrink-0" />
                      {timerActive
                        ? `${musicVibe} · ${t('challenge.music.playing')}`
                        : `${musicVibe} · ${t('challenge.music.waiting')}`}
                    </p>
                  )}
                  {!musicOn && (
                    <p className="text-xs text-muted-foreground mt-2.5">{t('challenge.music.sub')}</p>
                  )}
                </div>

                {/* Done + Skip row */}
                <div className="flex gap-2">
                  <button
                    className="flex-1 h-14 flex items-center justify-center gap-1.5 text-sm text-muted-foreground/50 hover:text-muted-foreground transition-colors border border-border/50 rounded-2xl"
                    onClick={skipChallenge}
                  >
                    <SkipForward className="w-3.5 h-3.5" />
                    {t('challenge.skip.btn')}
                  </button>
                  <Button
                    className="flex-[2] h-14 text-base font-bold gap-2 rounded-2xl"
                    style={{ boxShadow: "0 4px 20px rgba(13,156,107,0.25)" }}
                    onClick={completeChallenge}
                  >
                    <Check className="w-5 h-5" />
                    {t('challenge.done.btn')}
                  </Button>
                </div>
              </CardContent>
            </Card>

            {/* Progress photo — outside the task card */}
            {!praiseData ? (
              showProgressUpload ? (
                <ProgressPhotoUpload
                  roomId={roomId!}
                  roomName={room.name}
                  intent={room.intent}
                  beforeImageUrl={room.before_image_url ?? ""}
                  completedChallenges={completedCount}
                  totalChallenges={challenges.length}
                  isGuest={isGuest}
                  onPraiseReceived={handlePraiseReceived}
                />
              ) : (
                <button
                  onClick={() => {
                    if (isGuest) {
                      openSaveModal({
                        title: "Save your photo ✨",
                        subtitle: "Progress photos and bonus points are saved with a free account. Create one to keep this — and every future win.",
                      });
                      return;
                    }
                    setShowProgressUpload(true);
                  }}
                  className="w-full h-12 flex items-center justify-center gap-2 rounded-2xl font-semibold text-sm bg-primary/10 text-primary border border-primary/25 hover:bg-primary/15 hover:border-primary/40 active:scale-95 transition-all duration-150 mt-1"
                >
                  <Camera className="w-4 h-4" />
                  {t('challenge.progress.btn')}
                  <span className="ml-1 text-xs font-normal text-primary/60">{t('challenge.progress.earn')}</span>
                </button>
              )
            ) : (
              <div className="space-y-3 mt-1">
                <PraiseCard
                  praise={praiseData.praise}
                  bonusPoints={praiseData.bonusPoints}
                  progressLabel={praiseData.progressLabel}
                  isVisible={true}
                />
                {!showShareCard ? (
                  <Button
                    variant="outline"
                    size="sm"
                    className="w-full gap-2"
                    onClick={handleShowShareCard}
                  >
                    <Share2 className="w-4 h-4" />
                    Create shareable card
                  </Button>
                ) : (
                  <ShareCard
                    beforeImageUrl={room.before_image_url ?? ""}
                    wipImageUrl={praiseData.wipImageUrl}
                    shareTagline={praiseData.shareTagline}
                    shareReactionPill={praiseData.shareReactionPill}
                    shareSub={praiseData.shareSub}
                    sessionMinutes={Math.round((Date.now() - sessionStartTime) / 60000)}
                    roomName={room.name}
                    roomId={roomId}
                  />
                )}
              </div>
            )}

            {/* Hidden YouTube BGM iframe
                Mount as soon as musicOn=true (during the user's gesture) so iOS Safari
                grants autoplay permission. Play/pause is then controlled via postMessage. */}
            {musicOn && (
              <iframe
                key={`music-${musicVibe}-${musicKey}`}
                ref={musicIframeRef}
                src={`https://www.youtube.com/embed/${MUSIC_PLAYLISTS[musicVibe]}?autoplay=1&mute=0&controls=0&loop=1&playlist=${MUSIC_PLAYLISTS[musicVibe]}&enablejsapi=1`}
                allow="autoplay; encrypted-media"
                allowFullScreen={false}
                style={{ display: "none", position: "absolute", width: 0, height: 0, border: "none" }}
                title="background music"
              />
            )}
          </>
        )}
      </main>

      {/* ── Level-up modal ─────────────────────────────────────────────────── */}
      {showLevelUpModal && levelUpData && (
        <div
          className="fixed inset-0 bg-background/80 backdrop-blur-sm z-50 flex items-center justify-center p-4"
          onClick={() => setShowLevelUpModal(false)}
        >
          <Card
            className="max-w-sm w-full border-0 shadow-xl animate-scale-in"
            onClick={(e) => e.stopPropagation()}
          >
            <CardContent className="p-6 text-center space-y-4">
              <div className="text-5xl">{levelUpData.badge.emoji}</div>
              <div>
                <p className="text-xs text-muted-foreground uppercase tracking-wide mb-1">
                  Level {levelUpData.newLevel} unlocked
                </p>
                <h2 className="text-2xl font-bold">{levelUpData.badge.title}</h2>
                <p className="text-sm text-muted-foreground mt-1">
                  {levelUpData.badge.subtitle}
                </p>
              </div>
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  className="flex-1"
                  onClick={() => setShowLevelUpModal(false)}
                >
                  Keep going
                </Button>
                <Button
                  className="flex-1 gap-2"
                  onClick={() => {
                    setShowLevelUpModal(false);
                    setShowLevelUpShareCard(true);
                  }}
                >
                  <Share2 className="w-4 h-4" />
                  Share
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* ── Level-up share card overlay ────────────────────────────────────── */}
      {showLevelUpShareCard && levelUpData && (
        <div
          className="fixed inset-0 bg-background/90 backdrop-blur-sm z-50 flex items-center justify-center p-4 overflow-y-auto"
          onClick={() => setShowLevelUpShareCard(false)}
        >
          <div
            className="w-full max-w-sm animate-scale-in"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between mb-4">
              <p className="font-semibold text-foreground">Your badge card</p>
              <Button
                variant="ghost"
                size="sm"
                className="text-muted-foreground"
                onClick={() => setShowLevelUpShareCard(false)}
              >
                Close
              </Button>
            </div>
            <LevelUpShareCard level={levelUpData.newLevel} badge={levelUpData.badge} />
          </div>
        </div>
      )}

      <SaveProgressModal
        open={saveModalOpen}
        onClose={() => setSaveModalOpen(false)}
        title={saveModalCopy.title}
        subtitle={saveModalCopy.subtitle}
      />
    </div>
  );
};

export default ChallengePage;
