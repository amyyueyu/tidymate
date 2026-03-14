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
  Star,
  Clock,
  Trophy,
  Sparkles,
  Eye,
  CheckCircle2,
  Circle,
  FastForward,
  UserPlus,
  Camera,
  Download,
  Share2,
} from "lucide-react";
import VisionComparison from "@/components/VisionComparison";
import ProgressPhotoUpload from "@/components/ProgressPhotoUpload";
import PraiseCard from "@/components/PraiseCard";
import ShareCard from "@/components/ShareCard";
import { ScrollArea } from "@/components/ui/scroll-area";
import { cn } from "@/lib/utils";
import { analytics } from "@/lib/analytics";

interface Challenge {
  id: string;
  title: string;
  description: string | null;
  time_estimate_minutes: number;
  points: number;
  status: string;
  sort_order: number;
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
  const { addPoints } = useProfile();
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
  const [timeRemaining, setTimeRemaining] = useState(0);
  const intervalRef = useRef<NodeJS.Timeout | null>(null);
  const [loading, setLoading] = useState(true);
  const [showVision, setShowVision] = useState(false);
  const [sessionComplete, setSessionComplete] = useState(false);

  // Refs to avoid stale closures in timer and to gate guest hydration
  const challengesRef = useRef<Challenge[]>([]);
  const challengeIndexRef = useRef(0);
  const guestHydratedRoomIdRef = useRef<string | null>(null);

  // Keep refs in sync with state on every render
  challengesRef.current = challenges;
  challengeIndexRef.current = currentChallengeIndex;

  // Auth guard
  useEffect(() => {
    if (!authLoading && !user && !isGuest) {
      navigate("/auth");
    }
  }, [user, authLoading, isGuest, navigate]);

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

  const stopInterval = useCallback(() => {
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
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
        toast("⏰ Time's up! How did it go?");
      } else {
        setTimeRemaining(remaining);
      }
    }, 1000);
  }, [stopInterval]);

  const pauseTimer = useCallback(() => {
    stopInterval();
    setTimerActive(false);
  }, [stopInterval]);

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

    const newCompletedCount = completedCount + 1;
    const isLast = currentChallengeIndex === challenges.length - 1;

    // Track task completion
    analytics.taskCompleted({
      room_type: room.intent,
      tasks_completed: newCompletedCount,
    });

    if (isGuest) {
      // Guest: update context only
      updateGuestChallenge(currentChallenge.id, { status: "completed" });
      setChallenges((prev) =>
        prev.map((c, i) => (i === currentChallengeIndex ? { ...c, status: "completed" } : c))
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
      toast(`✓ Nice work! (${currentChallenge.points} pts — save your progress to keep them)`);
    } else {
      await supabase
        .from("challenges")
        .update({ status: "completed", completed_at: new Date().toISOString() })
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
      toast.success(`+${currentChallenge.points} points! 🎉`);
      setChallenges((prev) =>
        prev.map((c, i) => (i === currentChallengeIndex ? { ...c, status: "completed" } : c))
      );
    }

    if (isLast) {
      analytics.roomFinished({ room_type: room.intent, tasks_completed: newCompletedCount });
      toast.success("🏆 Amazing! You've completed all challenges!");
      setSessionComplete(true);
    } else {
      const nextIndex = currentChallengeIndex + 1;
      setCurrentChallengeIndex(nextIndex);
      setTimeRemaining(challenges[nextIndex].time_estimate_minutes * 60);
    }
  };

  const skipChallenge = async () => {
    if (!currentChallenge) return;
    stopInterval();
    setTimerActive(false);

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
    setCurrentChallengeIndex(index);
    setTimeRemaining(challenge.time_estimate_minutes * 60);
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
    return (
      <div className="min-h-screen flex items-center justify-center bg-background px-4">
        <div className="text-center max-w-sm w-full space-y-6">
          <div className="animate-fade-in">
            <Trophy className="w-16 h-16 text-primary mx-auto mb-4" />
            <h2 className="text-2xl font-bold mb-2">
              {isGuest ? "You crushed it! 🎉" : "All Done! 🎉"}
            </h2>
            <p className="text-muted-foreground">
              {isGuest
                ? "You just completed a full declutter session. Imagine what you could do with streaks, points, and your progress saved."
                : "You've completed all challenges for this space!"}
            </p>
          </div>

          {isGuest ? (
            <Card className="border-0 shadow-lg bg-gradient-to-br from-primary/5 to-primary/10 animate-fade-in">
              <CardContent className="p-6 space-y-4">
                <div className="space-y-1">
                  <p className="font-semibold text-lg">Save your progress</p>
                  <p className="text-sm text-muted-foreground">
                    Create a free account to track your streaks, earn points, and keep your transformation history.
                  </p>
                </div>
                <Button
                  className="w-full h-12 text-base font-medium gap-2"
                  onClick={() => navigate("/auth?signup=1")}
                >
                  <UserPlus className="w-5 h-5" />
                  Create free account
                </Button>
                <button
                  className="w-full text-sm text-muted-foreground hover:text-foreground transition-colors"
                  onClick={() => navigate("/auth")}
                >
                  Sign in instead
                </button>
              </CardContent>
            </Card>
          ) : (
            <Button onClick={() => navigate("/")}>Back to Home</Button>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background flex flex-col">
      {/* Header */}
      <header className="sticky top-0 z-10 bg-background/80 backdrop-blur-sm border-b border-border">
        <div className="container max-w-2xl mx-auto px-4 py-4">
          <div className="flex items-center gap-3 mb-3">
            <Button variant="ghost" size="icon" onClick={() => navigate(isGuest ? "/auth" : "/")}>
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
                onClick={() => navigate("/auth?signup=1")}
              >
                <UserPlus className="w-3 h-3 mr-1" />
                Save progress
              </Badge>
            ) : (
              <Badge variant="secondary" className="shrink-0">
                <Star className="w-3 h-3 mr-1" />
                {currentChallenge?.points} pts
              </Badge>
            )}
          </div>
          <Progress value={progressPercent} className="h-2" />
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1 container max-w-2xl mx-auto px-4 py-6 flex flex-col">
        {/* Vision Toggle — before_image_url is lazily loaded on demand */}
        {room.after_image_url && (
          <Button
            variant="outline"
            className="mb-4 gap-2 animate-fade-in"
            onClick={async () => {
              if (!showVision && !room.before_image_url && roomId) {
                // Lazy-load the (potentially large) before image only when needed
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
                        ? "bg-primary/10 border border-primary/20"
                        : "hover:bg-muted/50",
                      challenge.status === "completed" && "opacity-60 cursor-not-allowed"
                    )}
                  >
                    {getStatusIcon(challenge.status)}
                    <div className="flex-1 min-w-0">
                      <p
                        className={cn(
                          "text-sm font-medium truncate",
                          challenge.status === "completed" && "line-through"
                        )}
                      >
                        {challenge.title}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        ~{challenge.time_estimate_minutes} min · {challenge.points} pts
                      </p>
                    </div>
                    {index === currentChallengeIndex && challenge.status !== "completed" && (
                      <Badge variant="secondary" className="shrink-0 text-xs">
                        Active
                      </Badge>
                    )}
                  </button>
                ))}
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Selected Challenge Details + Timer */}
        {currentChallenge && currentChallenge.status !== "completed" && (
          <>
            <Card className="border-0 shadow-lg mb-4 animate-scale-in">
              <CardContent className="p-6">
                <div className="flex items-start justify-between gap-4 mb-4">
                  <div className="flex-1">
                    <h2 className="text-xl font-bold mb-2">{currentChallenge.title}</h2>
                    {currentChallenge.description && (
                      <p className="text-sm text-muted-foreground">{currentChallenge.description}</p>
                    )}
                  </div>
                  {!isGuest && (
                    <Badge variant="secondary" className="shrink-0">
                      <Star className="w-3 h-3 mr-1" />
                      {currentChallenge.points} pts
                    </Badge>
                  )}
                </div>

                {/* Timer */}
                <div className="text-center pt-4 border-t border-border">
                  <div
                    className={cn(
                      "text-5xl font-bold mb-3",
                      timerActive ? "text-primary" : "text-muted-foreground"
                    )}
                  >
                    {formatTime(timeRemaining)}
                  </div>
                  <div className="flex justify-center gap-3">
                    {!timerActive ? (
                      <Button type="button" onClick={startTimer} size="lg" className="gap-2">
                        <Play className="w-5 h-5" />
                        Start Timer
                      </Button>
                    ) : (
                      <Button
                        type="button"
                        onClick={pauseTimer}
                        variant="outline"
                        size="lg"
                        className="gap-2"
                      >
                        <Pause className="w-5 h-5" />
                        Pause
                      </Button>
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Encouragement */}
            <Card className="border-0 shadow-sm bg-accent/20 mb-4 animate-fade-in">
              <CardContent className="p-4 flex items-center gap-3">
                <Sparkles className="w-5 h-5 text-accent-foreground shrink-0" />
                <p className="text-sm text-accent-foreground">
                  Focus on this one thing. You've got this! 💪
                </p>
              </CardContent>
            </Card>

            {/* Action Buttons */}
            <div className="flex gap-3 animate-fade-in">
              <Button variant="outline" className="flex-1 h-14" onClick={skipChallenge}>
                <SkipForward className="w-5 h-5 mr-2" />
                Skip
              </Button>
              <Button className="flex-[2] h-14 text-base" onClick={completeChallenge}>
                <Check className="w-5 h-5 mr-2" />
                Done!
              </Button>
            </div>
          </>
        )}
      </main>
    </div>
  );
};

export default ChallengePage;
