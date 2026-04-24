import { useEffect, useState, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import {
  BarChart, Bar, LineChart, Line, PieChart, Pie, Cell,
  XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, Legend,
} from "recharts";
import {
  Leaf, ArrowLeft, RefreshCw, ShieldOff, ArrowDown,
  Users, Target, TrendingUp, Zap, Camera, Trophy,
  AlertTriangle, Info, Sparkles, ThumbsUp, ExternalLink, UserPlus,
  Repeat,
} from "lucide-react";

type RetentionStats = {
  eligible_d1: number;
  eligible_d7: number;
  eligible_d30: number;
  eligible_d90: number;
  retained_d1: number;
  retained_d7: number;
  retained_d30: number;
  retained_d90: number;
  rate_d1: number | null;
  rate_d7: number | null;
  rate_d30: number | null;
  rate_d90: number | null;
  daily_cohorts: { cohort_date: string; cohort_size: number; d1_returned: number; d7_returned: number; d30_returned: number }[] | null;
};

/* ─────────────────────────────────────────────────────────
   TYPES
───────────────────────────────────────────────────────── */
type FullStats = {
  total_signed_up_users: number;
  new_users_7d: number;
  new_users_30d: number;
  total_rooms_created: number;
  rooms_by_intent: { intent: string; count: number }[] | null;
  rooms_completed: number;
  rooms_completion_rate: number;
  total_challenges_generated: number;
  total_challenges_completed: number;
  total_challenges_skipped: number;
  challenge_completion_rate: number;
  avg_challenges_per_room: number;
  funnel_signed_up: number;
  funnel_uploaded_photo: number;
  funnel_completed_at_least_one_challenge: number;
  funnel_uploaded_progress_photo: number;
  funnel_finished_a_room: number;
  rooms_with_vision_image: number;
  vision_image_success_rate: number;
  progress_photos_uploaded: number;
  users_who_uploaded_progress_photo: number;
  users_with_streak_gt_0: number;
  users_with_streak_gte_3: number;
  users_with_streak_gte_7: number;
  avg_current_streak: number;
  max_streak: number;
  avg_points_per_user: number;
  avg_level: number;
  users_above_level_2: number;
  users_above_level_5: number;
  users_with_multiple_rooms: number;
  active_users_7d: number;
  active_users_30d: number;
  rate_limit_hits_7d: number;
};

type PremiumStats = {
  total_sessions: number;
  sessions_7d: number;
  sessions_30d: number;
  unique_users_uploaded: number;
  sessions_by_intent: { intent: string; count: number }[] | null;
  sessions_completed: number;
  sessions_completion_rate: number | null;
  avg_items_per_session: number | null;
  total_items_detected: number;
  items_decided: number;
  items_skipped: number;
  item_decision_rate: number | null;
  ai_accepted_count: number;
  ai_overridden_count: number;
  ai_acceptance_rate: number | null;
  ai_action_distribution: { action: string; count: number }[] | null;
  user_action_distribution: { action: string; count: number }[] | null;
  avg_ai_confidence: number | null;
  users_with_multiple_sessions: number;
  top_overridden_categories: { category: string; overrides: number }[] | null;
};

type DailyRow = {
  date: string;
  rooms_created: number;
  challenges_completed: number;
  new_signups: number;
  progress_photos: number;
};

/* ─────────────────────────────────────────────────────────
   ACCENT HELPERS
───────────────────────────────────────────────────────── */
type Accent = "green" | "amber" | "red" | "gray";

const accentClasses: Record<Accent, { bg: string; text: string; badge: string }> = {
  green: { bg: "bg-green-50 dark:bg-green-950/30", text: "text-green-700 dark:text-green-400", badge: "🟢" },
  amber: { bg: "bg-amber-50 dark:bg-amber-950/30", text: "text-amber-700 dark:text-amber-400", badge: "🟡" },
  red:   { bg: "bg-red-50 dark:bg-red-950/30",     text: "text-red-700 dark:text-red-400",     badge: "🔴" },
  gray:  { bg: "bg-muted/40",                       text: "text-muted-foreground",               badge: "⚪" },
};

function getAccent(value: number, thresholds: [number, number], invert = false): Accent {
  const [warn, bad] = thresholds;
  if (invert) {
    if (value === 0) return "green";
    if (value <= bad) return "amber";
    return "red";
  }
  if (value >= warn) return "green";
  if (value >= bad) return "amber";
  return "red";
}

/* ─────────────────────────────────────────────────────────
   SUB-COMPONENTS
───────────────────────────────────────────────────────── */
const StatCard = ({
  label, value, sub, accent = "gray", icon,
}: {
  label: string; value: string | number; sub?: string; accent?: Accent; icon?: React.ReactNode;
}) => {
  const cls = accentClasses[accent];
  return (
    <Card className={`border-0 shadow-sm ${cls.bg}`}>
      <CardContent className="p-4">
        <div className="flex items-center gap-2 mb-1">
          {icon && <span className={cls.text}>{icon}</span>}
          <span className="text-xs text-muted-foreground">{label}</span>
        </div>
        <p className={`text-2xl font-bold ${cls.text}`}>{value}</p>
        {sub && <p className="text-xs text-muted-foreground mt-0.5">{sub}</p>}
      </CardContent>
    </Card>
  );
};

const StatCardSkeleton = () => (
  <Card className="border-0 shadow-sm bg-muted/40">
    <CardContent className="p-4 space-y-2">
      <Skeleton className="h-3 w-24" />
      <Skeleton className="h-7 w-16" />
      <Skeleton className="h-3 w-32" />
    </CardContent>
  </Card>
);

const FunnelStep = ({
  label, value, total, color, pctLabel,
}: { label: string; value: number; total: number; color: string; pctLabel?: string }) => {
  const pct = total > 0 ? Math.round((value / total) * 100) : 0;
  return (
    <div>
      <div className="flex justify-between text-sm mb-1">
        <span className="text-foreground">{label}</span>
        <span className="text-muted-foreground font-medium">
          {value.toLocaleString()}{" "}
          <span className="text-xs">({pctLabel ?? `${pct}%`})</span>
        </span>
      </div>
      <div className="h-2.5 rounded-full bg-muted overflow-hidden">
        <div className={`h-full rounded-full ${color} transition-all`} style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
};

const DropArrow = ({ dropPct }: { dropPct: number }) => (
  <div className="flex items-center gap-2 py-0.5 pl-1">
    <ArrowDown className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
    {dropPct > 0 && (
      <span className="text-xs text-destructive/80 font-medium">↓ {dropPct}% dropped here</span>
    )}
  </div>
);

const SectionTitle = ({ title, sub }: { title: string; sub?: string }) => (
  <div className="mb-1">
    <h2 className="text-base font-semibold">{title}</h2>
    {sub && <p className="text-xs text-muted-foreground">{sub}</p>}
  </div>
);

/* ─────────────────────────────────────────────────────────
   SCORE CARD TABLE
───────────────────────────────────────────────────────── */
type ScoreRow = { metric: string; current: string; target: string; status: "🟢" | "🟡" | "🔴" };

function scoreStatus(value: number, target: number): "🟢" | "🟡" | "🔴" {
  if (value >= target) return "🟢";
  if (value >= target * 0.5) return "🟡";
  return "🔴";
}

/* ─────────────────────────────────────────────────────────
   INTENT COLORS
───────────────────────────────────────────────────────── */
const INTENT_COLORS: Record<string, string> = {
  tidy: "#0D9C6B",
  declutter: "#F59E0B",
  redesign: "#8B5CF6",
};
const FALLBACK_COLORS = ["#6366f1", "#ec4899", "#14b8a6", "#f97316", "#84cc16"];

const CHART_COLORS = {
  signups:   "#6366f1",
  rooms:     "#0D9C6B",
  tasks:     "#14b8a6",
  photos:    "#F59E0B",
};

/* ─────────────────────────────────────────────────────────
   MAIN PAGE
───────────────────────────────────────────────────────── */
const Stats = () => {
  const { user, loading } = useAuth();
  const navigate = useNavigate();

  const [isAdmin, setIsAdmin] = useState<boolean | null>(null);
  const [stats, setStats] = useState<FullStats | null>(null);
  const [premium, setPremium] = useState<PremiumStats | null>(null);
  const [retention, setRetention] = useState<RetentionStats | null>(null);
  const [daily, setDaily] = useState<DailyRow[]>([]);
  const [dataLoading, setDataLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
  const [daysRange, setDaysRange] = useState<7 | 14 | 30>(30);

  useEffect(() => {
    if (!loading && !user) navigate("/auth");
  }, [user, loading, navigate]);

  useEffect(() => {
    if (!user) return;
    supabase.rpc("is_admin").then(({ data }) => {
      setIsAdmin(!!data);
      if (data) fetchData(daysRange);
    });
  }, [user]);

  const fetchData = useCallback(async (days: 7 | 14 | 30) => {
    setDataLoading(true);
    setError(null);

    // Fetch stats independently so a failure in one doesn't block the other
    let statsErr: string | null = null;

    try {
      const { data, error: statsError } = await supabase.rpc("get_full_platform_stats" as never);
      if (statsError) {
        console.error("get_full_platform_stats failed:", {
          message: statsError.message,
          code: statsError.code,
          details: statsError.details,
          hint: statsError.hint,
        });
        statsErr = `get_full_platform_stats: ${statsError.message || statsError.code || "Unknown"}`;
      } else {
        setStats(data as FullStats);
      }
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : "Unknown error";
      console.error("get_full_platform_stats threw:", e);
      statsErr = `get_full_platform_stats: ${msg}`;
    }

    try {
      const { data, error: dailyError } = await supabase.rpc("get_daily_activity_v2" as never, { p_days: days } as never);
      if (dailyError) {
        console.error("get_daily_activity_v2 failed:", {
          message: dailyError.message,
          code: dailyError.code,
          details: dailyError.details,
          hint: dailyError.hint,
        });
        // Activity failing just shows empty chart, not full page error
      } else {
        setDaily((data as DailyRow[]) ?? []);
      }
    } catch (e: unknown) {
      console.error("get_daily_activity_v2 threw:", e);
    }

    try {
      const { data, error: premiumErr } = await supabase.rpc("get_premium_stats" as never);
      if (premiumErr) {
        console.error("get_premium_stats failed:", premiumErr);
      } else {
        setPremium(data as PremiumStats);
      }
    } catch (e) {
      console.error("get_premium_stats threw:", e);
    }

    try {
      const { data, error: retErr } = await supabase.rpc("get_retention_stats" as never);
      if (retErr) {
        console.error("get_retention_stats failed:", retErr);
      } else {
        setRetention(data as RetentionStats);
      }
    } catch (e) {
      console.error("get_retention_stats threw:", e);
    }

    if (statsErr) setError(statsErr);
    setLastUpdated(new Date());
    setDataLoading(false);
  }, []);

  const handleRangeChange = (days: 7 | 14 | 30) => {
    setDaysRange(days);
    fetchData(days);
  };

  /* ── Guard states ── */
  if (loading || isAdmin === null) return null;

  if (!isAdmin) {
    return (
      <div className="min-h-screen bg-background flex flex-col items-center justify-center gap-4 text-center px-4">
        <ShieldOff className="w-10 h-10 text-muted-foreground" />
        <h1 className="text-xl font-semibold">Access Restricted</h1>
        <p className="text-muted-foreground text-sm max-w-xs">This page is only available to the app owner.</p>
        <Button variant="outline" onClick={() => navigate("/")}>Go home</Button>
      </div>
    );
  }

  /* ── Derived values ── */
  const s = stats;

  const funnelSteps = s
    ? [
        { label: "Signed up",               value: s.funnel_signed_up,                         color: "bg-primary" },
        { label: "Uploaded a room photo",    value: s.funnel_uploaded_photo,                    color: "bg-green-500" },
        { label: "Completed ≥1 challenge",   value: s.funnel_completed_at_least_one_challenge,  color: "bg-yellow-500" },
        { label: "Uploaded progress photo",  value: s.funnel_uploaded_progress_photo,            color: "bg-orange-500" },
        { label: "Finished a full room",     value: s.funnel_finished_a_room,                   color: "bg-red-400" },
      ]
    : [];

  const intentData =
    s?.rooms_by_intent?.map((r, i) => ({
      name: r.intent,
      value: r.count,
      color: INTENT_COLORS[r.intent] ?? FALLBACK_COLORS[i % FALLBACK_COLORS.length],
    })) ?? [];

  const challengeOutcomeData = s
    ? [
        {
          name: "Outcomes",
          Completed: s.total_challenges_completed,
          Skipped: s.total_challenges_skipped,
          Pending: Math.max(0, s.total_challenges_generated - s.total_challenges_completed - s.total_challenges_skipped),
        },
      ]
    : [];

  const streakData = s
    ? [
        { label: "0 days",   value: s.total_signed_up_users - s.users_with_streak_gt_0, color: "bg-muted-foreground/30" },
        { label: "1–2 days", value: s.users_with_streak_gt_0 - s.users_with_streak_gte_3, color: "bg-amber-400" },
        { label: "3–6 days", value: Math.max(0, s.users_with_streak_gte_3 - s.users_with_streak_gte_7), color: "bg-primary/70" },
        { label: "7+ days",  value: s.users_with_streak_gte_7, color: "bg-green-500" },
      ]
    : [];

  const scoreRows: ScoreRow[] = s
    ? [
        {
          metric: "Challenge completion rate",
          current: `${s.challenge_completion_rate ?? 0}%`,
          target: ">40%",
          status: scoreStatus(s.challenge_completion_rate ?? 0, 40),
        },
        {
          metric: "Room completion rate",
          current: `${s.rooms_completion_rate ?? 0}%`,
          target: ">30%",
          status: scoreStatus(s.rooms_completion_rate ?? 0, 30),
        },
        {
          metric: "Vision image success rate",
          current: `${s.vision_image_success_rate ?? 0}%`,
          target: ">80%",
          status: scoreStatus(s.vision_image_success_rate ?? 0, 80),
        },
        {
          metric: "Users with any streak",
          current: `${s.users_with_streak_gt_0} (${s.total_signed_up_users > 0 ? Math.round((s.users_with_streak_gt_0 / s.total_signed_up_users) * 100) : 0}%)`,
          target: ">50% of users",
          status: scoreStatus(
            s.total_signed_up_users > 0 ? Math.round((s.users_with_streak_gt_0 / s.total_signed_up_users) * 100) : 0,
            50
          ),
        },
        {
          metric: "Multi-room users",
          current: `${s.users_with_multiple_rooms} (${s.total_signed_up_users > 0 ? Math.round((s.users_with_multiple_rooms / s.total_signed_up_users) * 100) : 0}%)`,
          target: ">20% of users",
          status: scoreStatus(
            s.total_signed_up_users > 0 ? Math.round((s.users_with_multiple_rooms / s.total_signed_up_users) * 100) : 0,
            20
          ),
        },
        {
          metric: "Active users (7d)",
          current: `${s.active_users_7d} (${s.total_signed_up_users > 0 ? Math.round((s.active_users_7d / s.total_signed_up_users) * 100) : 0}%)`,
          target: ">30% of total",
          status: scoreStatus(
            s.total_signed_up_users > 0 ? Math.round((s.active_users_7d / s.total_signed_up_users) * 100) : 0,
            30
          ),
        },
      ]
    : [];

  const chartDailyFormatted = daily.map((d) => ({
    ...d,
    label: d.date ? d.date.slice(5) : "",
  }));

  /* ── Render ── */
  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="sticky top-0 z-10 bg-background/80 backdrop-blur-sm border-b border-border">
        <div className="container max-w-4xl mx-auto px-4 py-4 flex items-center gap-3">
          <Button variant="ghost" size="icon" onClick={() => navigate("/")}>
            <ArrowLeft className="w-5 h-5" />
          </Button>
          <Leaf className="w-5 h-5 text-primary" />
          <span className="font-semibold text-lg flex-1">Analytics</span>
          {lastUpdated && (
            <span className="text-xs text-muted-foreground hidden sm:block">
              Updated {lastUpdated.toLocaleTimeString()}
            </span>
          )}
          <Button
            variant="outline"
            size="sm"
            className="gap-1.5"
            disabled={dataLoading}
            onClick={() => fetchData(daysRange)}
          >
            <RefreshCw className={`w-3.5 h-3.5 ${dataLoading ? "animate-spin" : ""}`} />
            Refresh
          </Button>
        </div>
      </header>

      <main className="container max-w-4xl mx-auto px-4 py-6 space-y-8">
        {/* Error banner */}
        {error && (
          <div className="flex items-center gap-3 p-4 bg-destructive/10 border border-destructive/30 rounded-lg text-sm text-destructive">
            <AlertTriangle className="w-5 h-5 shrink-0" />
            <span>Failed to load analytics: {error || "Unknown error"}. Check backend RPC logs.</span>
          </div>
        )}

        {/* ── ROW 1: Top-line health ── */}
        <section>
          <SectionTitle title="Top-Line Health" />
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {dataLoading ? (
              Array.from({ length: 4 }).map((_, i) => <StatCardSkeleton key={i} />)
            ) : s ? (
              <>
                <StatCard
                  icon={<Users className="w-4 h-4" />}
                  label="Total Users"
                  value={s.total_signed_up_users}
                  sub={`+${s.new_users_7d} this week`}
                  accent="green"
                />
                <StatCard
                  icon={<Camera className="w-4 h-4" />}
                  label="Rooms Created"
                  value={s.total_rooms_created}
                  sub={`${s.avg_challenges_per_room ?? 0} avg challenges/room`}
                  accent="green"
                />
                <StatCard
                  icon={<Zap className="w-4 h-4" />}
                  label="Active Users (7d)"
                  value={s.active_users_7d}
                  sub={`${s.active_users_30d} in last 30 days`}
                  accent={s.active_users_7d > 0 ? "green" : "amber"}
                />
                <StatCard
                  icon={<AlertTriangle className="w-4 h-4" />}
                  label="Rate Limit Hits (7d)"
                  value={s.rate_limit_hits_7d}
                  sub="API abuse signal"
                  accent={
                    s.rate_limit_hits_7d === 0 ? "green" :
                    s.rate_limit_hits_7d <= 5 ? "amber" : "red"
                  }
                />
              </>
            ) : null}
          </div>
        </section>

        {/* ── PREMIUM MODE: KonMari Decision Coach ── */}
        <section>
          <Card className="border-0 shadow-sm bg-gradient-to-br from-primary/5 to-primary/0 border border-primary/20">
            <CardHeader className="pb-2">
              <div className="flex items-center gap-2">
                <Sparkles className="w-4 h-4 text-primary" />
                <CardTitle className="text-base font-semibold">Premium Mode — Decision Coach</CardTitle>
              </div>
              <p className="text-xs text-muted-foreground">
                Funnel & feedback loop for the KonMari item-decision feature.
                Entry-point clicks live in PostHog (event: <code className="bg-muted px-1 rounded">premium_entry_clicked</code>).
              </p>
            </CardHeader>
            <CardContent className="space-y-5">
              {dataLoading ? (
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                  {Array.from({ length: 4 }).map((_, i) => <StatCardSkeleton key={i} />)}
                </div>
              ) : premium ? (
                <>
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                    <StatCard
                      icon={<Camera className="w-4 h-4" />}
                      label="Photos Uploaded"
                      value={premium.total_sessions}
                      sub={`+${premium.sessions_7d} this week`}
                      accent={premium.total_sessions > 0 ? "green" : "gray"}
                    />
                    <StatCard
                      icon={<Users className="w-4 h-4" />}
                      label="Unique Users"
                      value={premium.unique_users_uploaded}
                      sub={`${premium.users_with_multiple_sessions} repeat users`}
                      accent={premium.unique_users_uploaded > 0 ? "green" : "gray"}
                    />
                    <StatCard
                      icon={<Target className="w-4 h-4" />}
                      label="Items Decided"
                      value={premium.items_decided}
                      sub={`${premium.items_skipped} skipped · ${premium.item_decision_rate ?? 0}% rate`}
                      accent={getAccent(premium.item_decision_rate ?? 0, [60, 30])}
                    />
                    <StatCard
                      icon={<ThumbsUp className="w-4 h-4" />}
                      label="AI Acceptance"
                      value={`${premium.ai_acceptance_rate ?? 0}%`}
                      sub={`${premium.ai_accepted_count} accepted · ${premium.ai_overridden_count} overridden`}
                      accent={getAccent(premium.ai_acceptance_rate ?? 0, [70, 40])}
                    />
                  </div>

                  <div className="bg-card rounded-lg p-4 border border-border space-y-1">
                    <div className="mb-2">
                      <h3 className="text-sm font-semibold">Premium Funnel</h3>
                      <p className="text-xs text-muted-foreground">From photo upload to completed decisions</p>
                    </div>
                    <FunnelStep label="Photo uploaded (session created)" value={premium.total_sessions} total={Math.max(premium.total_sessions, 1)} color="bg-primary" pctLabel="100%" />
                    <DropArrow dropPct={premium.total_sessions > 0 && premium.total_items_detected === 0 ? 100 : 0} />
                    <FunnelStep label="Items detected by AI" value={premium.total_items_detected} total={Math.max(premium.total_sessions, 1)} color="bg-green-500" pctLabel={`avg ${premium.avg_items_per_session ?? 0}/session`} />
                    <DropArrow dropPct={premium.total_items_detected > 0 ? 100 - Math.round(((premium.items_decided + premium.items_skipped) / premium.total_items_detected) * 100) : 0} />
                    <FunnelStep label="Items reviewed (decided or skipped)" value={premium.items_decided + premium.items_skipped} total={Math.max(premium.total_items_detected, 1)} color="bg-yellow-500" />
                    <DropArrow dropPct={premium.total_items_detected > 0 ? 100 - Math.round((premium.items_decided / premium.total_items_detected) * 100) : 0} />
                    <FunnelStep label="Items decided (not skipped)" value={premium.items_decided} total={Math.max(premium.total_items_detected, 1)} color="bg-orange-500" />
                    <DropArrow dropPct={premium.total_sessions > 0 ? 100 - Math.round((premium.sessions_completed / premium.total_sessions) * 100) : 0} />
                    <FunnelStep label="Sessions fully completed" value={premium.sessions_completed} total={Math.max(premium.total_sessions, 1)} color="bg-red-400" pctLabel={`${premium.sessions_completion_rate ?? 0}%`} />
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div className="bg-card rounded-lg p-4 border border-border">
                      <h3 className="text-sm font-semibold mb-2">AI Suggested vs User Chose</h3>
                      <p className="text-xs text-muted-foreground mb-3">
                        Avg AI confidence: <strong>{premium.avg_ai_confidence ?? 0}</strong>
                      </p>
                      {(() => {
                        const actions = ["keep", "donate", "sell", "recycle", "toss"];
                        const aiMap = Object.fromEntries((premium.ai_action_distribution ?? []).map(d => [d.action, d.count]));
                        const userMap = Object.fromEntries((premium.user_action_distribution ?? []).map(d => [d.action, d.count]));
                        const data = actions.map(a => ({ action: a, AI: aiMap[a] ?? 0, User: userMap[a] ?? 0 }));
                        const hasData = data.some(d => d.AI > 0 || d.User > 0);
                        if (!hasData) return <p className="text-xs text-muted-foreground text-center py-6">No decisions yet</p>;
                        return (
                          <ResponsiveContainer width="100%" height={180}>
                            <BarChart data={data}>
                              <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                              <XAxis dataKey="action" tick={{ fontSize: 10, fill: "hsl(var(--muted-foreground))" }} axisLine={false} tickLine={false} />
                              <YAxis allowDecimals={false} tick={{ fontSize: 10, fill: "hsl(var(--muted-foreground))" }} axisLine={false} tickLine={false} />
                              <Tooltip contentStyle={{ background: "hsl(var(--background))", border: "1px solid hsl(var(--border))", borderRadius: 8, fontSize: 12 }} />
                              <Legend wrapperStyle={{ fontSize: 11 }} />
                              <Bar dataKey="AI" fill="#8B5CF6" radius={[4, 4, 0, 0]} />
                              <Bar dataKey="User" fill="#0D9C6B" radius={[4, 4, 0, 0]} />
                            </BarChart>
                          </ResponsiveContainer>
                        );
                      })()}
                    </div>

                    <div className="bg-card rounded-lg p-4 border border-border">
                      <h3 className="text-sm font-semibold mb-2">Top Overridden Categories</h3>
                      <p className="text-xs text-muted-foreground mb-3">
                        Where users disagree with AI most — feedback signal for prompt tuning.
                      </p>
                      {premium.top_overridden_categories && premium.top_overridden_categories.length > 0 ? (
                        <ul className="space-y-2">
                          {premium.top_overridden_categories.map((c) => (
                            <li key={c.category} className="flex items-center justify-between text-sm">
                              <span className="capitalize text-foreground">{c.category}</span>
                              <span className="font-mono font-medium text-amber-700 dark:text-amber-400">
                                {c.overrides} overrides
                              </span>
                            </li>
                          ))}
                        </ul>
                      ) : (
                        <p className="text-xs text-muted-foreground text-center py-6">No overrides yet</p>
                      )}
                    </div>
                  </div>

                  <div className="flex gap-2 p-3 bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800 rounded-lg text-xs text-amber-800 dark:text-amber-300">
                    <Info className="w-4 h-4 shrink-0 mt-0.5" />
                    <span>
                      <strong>Entry-point clicks</strong> on the "Help me decide" home card are tracked in PostHog as{" "}
                      <code className="bg-amber-100 dark:bg-amber-900/50 px-1 rounded">premium_entry_clicked</code>.
                      Per-decision events:{" "}
                      <code className="bg-amber-100 dark:bg-amber-900/50 px-1 rounded">decision_made</code> &{" "}
                      <code className="bg-amber-100 dark:bg-amber-900/50 px-1 rounded">decision_skipped</code>.
                    </span>
                  </div>
                </>
              ) : (
                <p className="text-sm text-muted-foreground text-center py-6">No premium data yet</p>
              )}
            </CardContent>
          </Card>
        </section>

        {/* ── ROW 2: Activation metrics ── */}
        <section>
          <SectionTitle title="Activation Metrics" />
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {dataLoading ? (
              Array.from({ length: 4 }).map((_, i) => <StatCardSkeleton key={i} />)
            ) : s ? (
              <>
                <StatCard
                  icon={<Target className="w-4 h-4" />}
                  label="Challenge Completion"
                  value={`${s.challenge_completion_rate ?? 0}%`}
                  sub={`${s.total_challenges_completed} of ${s.total_challenges_generated} tasks`}
                  accent={getAccent(s.challenge_completion_rate ?? 0, [40, 20])}
                />
                <StatCard
                  icon={<Trophy className="w-4 h-4" />}
                  label="Room Completion"
                  value={`${s.rooms_completion_rate ?? 0}%`}
                  sub={`${s.rooms_completed} rooms fully finished`}
                  accent={getAccent(s.rooms_completion_rate ?? 0, [30, 10])}
                />
                <StatCard
                  icon={<TrendingUp className="w-4 h-4" />}
                  label="Vision Image Success"
                  value={`${s.vision_image_success_rate ?? 0}%`}
                  sub="AI image generated"
                  accent={getAccent(s.vision_image_success_rate ?? 0, [80, 60])}
                />
                <StatCard
                  icon={<Camera className="w-4 h-4" />}
                  label="Progress Photos"
                  value={s.progress_photos_uploaded}
                  sub={`${s.users_who_uploaded_progress_photo} unique users`}
                  accent="green"
                />
              </>
            ) : null}
          </div>
        </section>

        {/* ── ROW 3: Retention & habit signals ── */}
        <section>
          <SectionTitle title="Retention & Habit Signals" />
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {dataLoading ? (
              Array.from({ length: 4 }).map((_, i) => <StatCardSkeleton key={i} />)
            ) : s ? (
              <>
                <StatCard
                  icon={<Zap className="w-4 h-4" />}
                  label="Users with Active Streak"
                  value={s.users_with_streak_gt_0}
                  sub={`${s.users_with_streak_gte_3} with 3+ day streak`}
                  accent="green"
                />
                <StatCard
                  icon={<TrendingUp className="w-4 h-4" />}
                  label="Multi-Room Users"
                  value={s.users_with_multiple_rooms}
                  sub="came back for a 2nd session"
                  accent="green"
                />
                <StatCard
                  icon={<Target className="w-4 h-4" />}
                  label="Avg Points / User"
                  value={s.avg_points_per_user ?? 0}
                  sub={`avg level ${s.avg_level ?? 1}`}
                  accent="gray"
                />
                <StatCard
                  icon={<Trophy className="w-4 h-4" />}
                  label="Power Users (Lv 5+)"
                  value={s.users_above_level_5}
                  sub={`${s.users_above_level_2} at level 2+`}
                  accent="green"
                />
              </>
            ) : null}
          </div>
        </section>

        {/* ── ROW 4: Activation Funnel ── */}
        <section>
          <Card className="border-0 shadow-sm">
            <CardHeader className="pb-2">
              <SectionTitle
                title="Authenticated User Activation Funnel"
                sub="Unique signed-up users at each stage"
              />
            </CardHeader>
            <CardContent className="space-y-1">
              {dataLoading ? (
                <div className="space-y-3">
                  {Array.from({ length: 5 }).map((_, i) => (
                    <div key={i} className="space-y-1.5">
                      <Skeleton className="h-3 w-full" />
                      <Skeleton className="h-2.5 w-full rounded-full" />
                    </div>
                  ))}
                </div>
              ) : s ? (
                <>
                  {funnelSteps.map((step, i) => (
                    <div key={step.label}>
                      <FunnelStep
                        label={step.label}
                        value={step.value}
                        total={s.funnel_signed_up}
                        color={step.color}
                        pctLabel={i === 0 ? "100%" : undefined}
                      />
                      {i < funnelSteps.length - 1 && (
                        <DropArrow
                          dropPct={
                            funnelSteps[i].value > 0
                              ? 100 - Math.round((funnelSteps[i + 1].value / funnelSteps[i].value) * 100)
                              : 0
                          }
                        />
                      )}
                    </div>
                  ))}
                </>
              ) : null}

              {/* Guest mode reference — full Guest Mode dashboard is at the bottom */}
            </CardContent>
          </Card>
        </section>

        {/* ── ROW 5: Intent breakdown + Task outcomes ── */}
        <section className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {/* Intent Distribution */}
          <Card className="border-0 shadow-sm">
            <CardHeader className="pb-2">
              <CardTitle className="text-base font-semibold">Sessions by Intent</CardTitle>
            </CardHeader>
            <CardContent>
              {dataLoading ? (
                <Skeleton className="h-44 w-full rounded-lg" />
              ) : intentData.length > 0 ? (
                <>
                  <ResponsiveContainer width="100%" height={160}>
                    <PieChart>
                      <Pie
                        data={intentData}
                        dataKey="value"
                        nameKey="name"
                        cx="50%"
                        cy="50%"
                        outerRadius={65}
                        label={({ name, percent }) =>
                          `${name} ${(percent * 100).toFixed(0)}%`
                        }
                        labelLine={false}
                      >
                        {intentData.map((entry, i) => (
                          <Cell key={i} fill={entry.color} />
                        ))}
                      </Pie>
                      <Tooltip
                        contentStyle={{
                          background: "hsl(var(--background))",
                          border: "1px solid hsl(var(--border))",
                          borderRadius: 8,
                          fontSize: 12,
                        }}
                      />
                    </PieChart>
                  </ResponsiveContainer>
                  <div className="flex flex-wrap gap-2 justify-center mt-1">
                    {intentData.map((d) => (
                      <span key={d.name} className="flex items-center gap-1 text-xs text-muted-foreground">
                        <span className="w-2.5 h-2.5 rounded-sm inline-block" style={{ background: d.color }} />
                        {d.name} ({d.value})
                      </span>
                    ))}
                  </div>
                </>
              ) : (
                <p className="text-sm text-muted-foreground text-center py-8">No data yet</p>
              )}
            </CardContent>
          </Card>

          {/* Challenge Outcomes */}
          <Card className="border-0 shadow-sm">
            <CardHeader className="pb-2">
              <CardTitle className="text-base font-semibold">Challenge Outcomes</CardTitle>
              <p className="text-xs text-muted-foreground">High skip rate = tasks too hard or poorly scoped</p>
            </CardHeader>
            <CardContent>
              {dataLoading ? (
                <Skeleton className="h-44 w-full rounded-lg" />
              ) : s ? (
                <ResponsiveContainer width="100%" height={160}>
                  <BarChart data={challengeOutcomeData} layout="vertical" barCategoryGap="30%">
                    <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" horizontal={false} />
                    <XAxis type="number" tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }} axisLine={false} tickLine={false} />
                    <YAxis type="category" dataKey="name" tick={false} axisLine={false} tickLine={false} width={0} />
                    <Tooltip
                      contentStyle={{
                        background: "hsl(var(--background))",
                        border: "1px solid hsl(var(--border))",
                        borderRadius: 8,
                        fontSize: 12,
                      }}
                    />
                    <Legend wrapperStyle={{ fontSize: 12 }} />
                    <Bar dataKey="Completed" stackId="a" fill="#0D9C6B" radius={[0, 0, 0, 0]} />
                    <Bar dataKey="Skipped"   stackId="a" fill="#F59E0B" />
                    <Bar dataKey="Pending"   stackId="a" fill="hsl(var(--muted-foreground)/0.3)" radius={[0, 4, 4, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              ) : null}
            </CardContent>
          </Card>
        </section>

        {/* ── ROW 6: Streak distribution ── */}
        <section>
          <Card className="border-0 shadow-sm">
            <CardHeader className="pb-2">
              <CardTitle className="text-base font-semibold">Streak Distribution</CardTitle>
              <p className="text-xs text-muted-foreground">Shows whether the app is building habits or just one-time use</p>
            </CardHeader>
            <CardContent>
              {dataLoading ? (
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                  {Array.from({ length: 4 }).map((_, i) => <StatCardSkeleton key={i} />)}
                </div>
              ) : s ? (
                <>
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                    {streakData.map((item) => (
                      <div key={item.label} className="bg-muted/40 rounded-xl p-3 text-center">
                        <p className="text-2xl font-bold">{Math.max(0, item.value)}</p>
                        <p className="text-xs text-muted-foreground mt-0.5">{item.label}</p>
                        <div className={`h-1.5 rounded-full mt-2 ${item.color}`} />
                      </div>
                    ))}
                  </div>
                  <p className="text-xs text-muted-foreground mt-3 text-center">
                    Longest streak ever: <strong>{s.max_streak} days</strong>
                  </p>
                </>
              ) : null}
            </CardContent>
          </Card>
        </section>

        {/* ── ROW 7: Daily Activity Chart ── */}
        <section>
          <Card className="border-0 shadow-sm">
            <CardHeader className="pb-2">
              <div className="flex items-center justify-between flex-wrap gap-2">
                <div>
                  <CardTitle className="text-base font-semibold">Daily Activity</CardTitle>
                  <p className="text-xs text-muted-foreground">Last {daysRange} days</p>
                </div>
                <div className="flex gap-1">
                  {([7, 14, 30] as const).map((d) => (
                    <Button
                      key={d}
                      size="sm"
                      variant={daysRange === d ? "default" : "outline"}
                      className="h-7 px-3 text-xs"
                      onClick={() => handleRangeChange(d)}
                    >
                      {d}d
                    </Button>
                  ))}
                </div>
              </div>
            </CardHeader>
            <CardContent>
              {dataLoading ? (
                <Skeleton className="h-52 w-full rounded-lg" />
              ) : (
                <ResponsiveContainer width="100%" height={220}>
                  <LineChart data={chartDailyFormatted}>
                    <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                    <XAxis dataKey="label" tick={{ fontSize: 10, fill: "hsl(var(--muted-foreground))" }} axisLine={false} tickLine={false} />
                    <YAxis allowDecimals={false} tick={{ fontSize: 10, fill: "hsl(var(--muted-foreground))" }} axisLine={false} tickLine={false} />
                    <Tooltip
                      contentStyle={{
                        background: "hsl(var(--background))",
                        border: "1px solid hsl(var(--border))",
                        borderRadius: 8,
                        fontSize: 12,
                      }}
                    />
                    <Legend wrapperStyle={{ fontSize: 12 }} />
                    <Line type="monotone" dataKey="new_signups"          name="New Signups"           stroke={CHART_COLORS.signups} strokeWidth={2} dot={false} />
                    <Line type="monotone" dataKey="rooms_created"        name="Rooms Created"         stroke={CHART_COLORS.rooms}   strokeWidth={2} dot={false} />
                    <Line type="monotone" dataKey="challenges_completed" name="Challenges Completed"  stroke={CHART_COLORS.tasks}   strokeWidth={2} dot={false} />
                    <Line type="monotone" dataKey="progress_photos"      name="Progress Photos"       stroke={CHART_COLORS.photos}  strokeWidth={2} dot={false} />
                  </LineChart>
                </ResponsiveContainer>
              )}
            </CardContent>
          </Card>
        </section>

        {/* ── ROW 8: Health scorecard ── */}
        <section>
          <Card className="border-0 shadow-sm">
            <CardHeader className="pb-2">
              <CardTitle className="text-base font-semibold">Health Scorecard</CardTitle>
              <p className="text-xs text-muted-foreground">Single-glance product health read</p>
            </CardHeader>
            <CardContent>
              {dataLoading ? (
                <Skeleton className="h-40 w-full rounded-lg" />
              ) : scoreRows.length > 0 ? (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-border text-xs text-muted-foreground">
                        <th className="text-left py-2 font-medium">Metric</th>
                        <th className="text-right py-2 font-medium">Current</th>
                        <th className="text-right py-2 font-medium">Target</th>
                        <th className="text-center py-2 font-medium">Status</th>
                      </tr>
                    </thead>
                    <tbody>
                      {scoreRows.map((row, i) => (
                        <tr key={i} className="border-b border-border/50 last:border-0">
                          <td className="py-2.5 text-foreground">{row.metric}</td>
                          <td className="py-2.5 text-right font-mono font-medium">{row.current}</td>
                          <td className="py-2.5 text-right text-muted-foreground">{row.target}</td>
                          <td className="py-2.5 text-center text-base">{row.status}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : null}
            </CardContent>
          </Card>
        </section>

        {/* ── GUEST MODE: try-before-signup funnel ── */}
        <section>
          <Card className="border-0 shadow-sm bg-gradient-to-br from-amber-50/60 to-amber-50/0 dark:from-amber-950/20 dark:to-transparent border border-amber-200/60 dark:border-amber-800/40">
            <CardHeader className="pb-2">
              <div className="flex items-center gap-2">
                <UserPlus className="w-4 h-4 text-amber-600 dark:text-amber-400" />
                <CardTitle className="text-base font-semibold">Guest Mode — Try Before Signup</CardTitle>
              </div>
              <p className="text-xs text-muted-foreground">
                Guest sessions live in <code className="bg-muted px-1 rounded">sessionStorage</code> only and are never written to the DB,
                so this funnel lives in PostHog. All events carry{" "}
                <code className="bg-muted px-1 rounded">is_guest: true</code>.
              </p>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* Guest funnel reference */}
              <div className="bg-card rounded-lg p-4 border border-border">
                <h3 className="text-sm font-semibold mb-1">Guest Funnel</h3>
                <p className="text-xs text-muted-foreground mb-3">
                  Filter each PostHog event below by <code className="bg-muted px-1 rounded">is_guest = true</code> to see volume and step-by-step drop-off.
                </p>
                <ol className="space-y-2 text-sm">
                  {[
                    { event: "guest_started", desc: "Tapped “Try as guest” on the landing or auth screen" },
                    { event: "guest_photo_uploaded", desc: "Selected a room photo" },
                    { event: "guest_analysis_completed", desc: "AI returned challenges — value moment" },
                    { event: "task_completed", desc: "Completed at least one challenge (filter is_guest=true)" },
                    { event: "guest_signup_prompt_shown", desc: "Saw the “Save your progress” modal" },
                    { event: "guest_converted_to_signup", desc: "Clicked Continue with Google or Create account" },
                    { event: "signup_completed", desc: "Account created (final conversion)" },
                  ].map((step, i) => (
                    <li key={step.event} className="flex items-start gap-3">
                      <span className="shrink-0 w-5 h-5 rounded-full bg-amber-100 dark:bg-amber-900/40 text-amber-700 dark:text-amber-400 text-[10px] font-bold flex items-center justify-center mt-0.5">
                        {i + 1}
                      </span>
                      <div className="flex-1 min-w-0">
                        <code className="bg-muted px-1.5 py-0.5 rounded text-[11px] font-mono">{step.event}</code>
                        <p className="text-xs text-muted-foreground mt-0.5">{step.desc}</p>
                      </div>
                    </li>
                  ))}
                </ol>
              </div>

              {/* Key questions to answer */}
              <div className="bg-card rounded-lg p-4 border border-border">
                <h3 className="text-sm font-semibold mb-2">What to look for in PostHog</h3>
                <ul className="space-y-2 text-xs text-muted-foreground list-disc pl-4">
                  <li>
                    <strong className="text-foreground">Guest volume:</strong>{" "}
                    unique users firing <code className="bg-muted px-1 rounded">guest_started</code> per day / week.
                  </li>
                  <li>
                    <strong className="text-foreground">Activation rate:</strong>{" "}
                    <code className="bg-muted px-1 rounded">guest_analysis_completed</code> ÷{" "}
                    <code className="bg-muted px-1 rounded">guest_started</code>. Below 50% = capture or AI is broken.
                  </li>
                  <li>
                    <strong className="text-foreground">Conversion rate:</strong>{" "}
                    <code className="bg-muted px-1 rounded">signup_completed</code> ÷{" "}
                    <code className="bg-muted px-1 rounded">guest_started</code>. The headline number for the landing-page strategy.
                  </li>
                  <li>
                    <strong className="text-foreground">Prompt → conversion:</strong>{" "}
                    <code className="bg-muted px-1 rounded">guest_converted_to_signup</code> ÷{" "}
                    <code className="bg-muted px-1 rounded">guest_signup_prompt_shown</code>.
                    Tells you if the modal copy is working.
                  </li>
                  <li>
                    <strong className="text-foreground">Drop-off step:</strong>{" "}
                    build a Funnel insight in PostHog with the 7 events above to see exactly where guests leave.
                  </li>
                </ul>
              </div>

              {/* Cross-reference: signups in DB */}
              {s && (
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                  <StatCard
                    icon={<UserPlus className="w-4 h-4" />}
                    label="New Signups (7d)"
                    value={s.new_users_7d}
                    sub="DB-confirmed conversions"
                    accent="green"
                  />
                  <StatCard
                    icon={<UserPlus className="w-4 h-4" />}
                    label="New Signups (30d)"
                    value={s.new_users_30d}
                    sub="DB-confirmed conversions"
                    accent="green"
                  />
                  <StatCard
                    icon={<Users className="w-4 h-4" />}
                    label="Total Users"
                    value={s.total_signed_up_users}
                    sub="all-time signups"
                    accent="green"
                  />
                </div>
              )}

              {/* Deep links to PostHog */}
              <div className="flex flex-wrap gap-2">
                <a
                  href="https://us.posthog.com/events?properties=%5B%7B%22type%22%3A%22event%22%2C%22key%22%3A%22is_guest%22%2C%22value%22%3A%5Btrue%5D%2C%22operator%22%3A%22exact%22%7D%5D"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1.5 text-xs font-medium px-3 py-1.5 rounded-md bg-primary text-primary-foreground hover:opacity-90 transition-opacity"
                >
                  Open guest events in PostHog
                  <ExternalLink className="w-3 h-3" />
                </a>
                <a
                  href="https://us.posthog.com/insights/new?insight=FUNNELS"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1.5 text-xs font-medium px-3 py-1.5 rounded-md border border-border bg-background hover:bg-muted/60 transition-colors"
                >
                  Build guest funnel insight
                  <ExternalLink className="w-3 h-3" />
                </a>
              </div>

              <p className="text-[11px] text-muted-foreground italic">
                Tip: in PostHog, save the funnel as “Guest → Signup conversion” and pin it to your project dashboard so this number is one click away.
              </p>
            </CardContent>
          </Card>
        </section>

      </main>
    </div>
  );
};

export default Stats;
