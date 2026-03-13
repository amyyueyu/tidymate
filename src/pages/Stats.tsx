import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  CartesianGrid,
} from "recharts";
import {
  Leaf,
  ArrowLeft,
  Upload,
  CheckCircle2,
  Users,
  TrendingUp,
  Layers,
  Trophy,
  ArrowDown,
} from "lucide-react";

type DailyRow = { day: string; uploads: number; completions: number };

type PlatformStats = {
  total_users: number;
  users_uploaded: number;
  users_completed_task: number;
  users_finished_room: number;
  total_uploads: number;
  total_challenges: number;
  total_completed_challenges: number;
  total_completed_rooms: number;
  uploads_last_7d: number;
  completions_last_7d: number;
};

const Stats = () => {
  const { user, loading } = useAuth();
  const navigate = useNavigate();

  const [stats, setStats] = useState<PlatformStats>({
    total_users: 0,
    users_uploaded: 0,
    users_completed_task: 0,
    users_finished_room: 0,
    total_uploads: 0,
    total_challenges: 0,
    total_completed_challenges: 0,
    total_completed_rooms: 0,
    uploads_last_7d: 0,
    completions_last_7d: 0,
  });

  const [daily, setDaily] = useState<DailyRow[]>([]);
  const [dataLoading, setDataLoading] = useState(true);

  useEffect(() => {
    if (!loading && !user) navigate("/auth");
  }, [user, loading, navigate]);

  useEffect(() => {
    if (!user) return;
    fetchStats();
  }, [user]);

  const fetchStats = async () => {
    setDataLoading(true);

    const [statsRes, dailyRes] = await Promise.all([
      supabase.rpc("get_platform_stats"),
      supabase.rpc("get_daily_activity", { p_days: 14 }),
    ]);

    if (statsRes.data) {
      setStats(statsRes.data as PlatformStats);
    }

    // Build last-14-day daily chart data
    const buckets: Record<string, DailyRow> = {};
    for (let i = 13; i >= 0; i--) {
      const d = new Date();
      d.setDate(d.getDate() - i);
      const key = d.toISOString().slice(0, 10);
      buckets[key] = { day: key.slice(5), uploads: 0, completions: 0 };
    }

    const dailyData = dailyRes.data as { uploads: { created_at: string }[] | null; completions: { completed_at: string }[] | null } | null;
    (dailyData?.uploads ?? []).forEach((r) => {
      const key = r.created_at.slice(0, 10);
      if (buckets[key]) buckets[key].uploads++;
    });
    (dailyData?.completions ?? []).forEach((c) => {
      const key = c.completed_at.slice(0, 10);
      if (buckets[key]) buckets[key].completions++;
    });

    setDaily(Object.values(buckets));
    setDataLoading(false);
  };

  const challengeCompletion =
    stats.total_challenges > 0
      ? Math.round((stats.total_completed_challenges / stats.total_challenges) * 100)
      : 0;

  const conversionRate =
    stats.total_uploads > 0
      ? Math.round((stats.total_completed_challenges / stats.total_uploads) * 10) / 10
      : 0;

  if (loading) return null;

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="sticky top-0 z-10 bg-background/80 backdrop-blur-sm border-b border-border">
        <div className="container max-w-3xl mx-auto px-4 py-4 flex items-center gap-3">
          <Button variant="ghost" size="icon" onClick={() => navigate("/")}>
            <ArrowLeft className="w-5 h-5" />
          </Button>
          <Leaf className="w-5 h-5 text-primary" />
          <span className="font-semibold text-lg">Analytics</span>
        </div>
      </header>

      <main className="container max-w-3xl mx-auto px-4 py-6 space-y-6">
        {/* KPI Grid */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <StatCard
            icon={<Users className="w-5 h-5 text-primary" />}
            label="Total Users"
            value={stats.total_users}
            bg="bg-primary/10"
          />
          <StatCard
            icon={<Upload className="w-5 h-5 text-streak" />}
            label="Images Uploaded"
            value={stats.total_uploads}
            sub={`+${stats.uploads_last_7d} this week`}
            bg="bg-streak/10"
          />
          <StatCard
            icon={<CheckCircle2 className="w-5 h-5 text-points" />}
            label="Tasks Completed"
            value={stats.total_completed_challenges}
            sub={`+${stats.completions_last_7d} this week`}
            bg="bg-points/10"
          />
          <StatCard
            icon={<Trophy className="w-5 h-5 text-primary" />}
            label="Rooms Finished"
            value={stats.total_completed_rooms}
            bg="bg-primary/10"
          />
        </div>

        {/* Secondary KPIs */}
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
          <StatCard
            icon={<Layers className="w-5 h-5 text-muted-foreground" />}
            label="Total Challenges"
            value={stats.total_challenges}
            bg="bg-muted/40"
          />
          <StatCard
            icon={<TrendingUp className="w-5 h-5 text-primary" />}
            label="Challenge Completion"
            value={`${challengeCompletion}%`}
            bg="bg-primary/10"
          />
          <StatCard
            icon={<CheckCircle2 className="w-5 h-5 text-points" />}
            label="Tasks / Upload"
            value={conversionRate}
            bg="bg-points/10"
          />
        </div>

        {/* Conversion Funnel — Unique Users */}
        <Card className="border-0 shadow-sm">
          <CardHeader className="pb-2">
            <CardTitle className="text-base font-semibold">User Conversion Funnel</CardTitle>
            <p className="text-xs text-muted-foreground">Unique users at each step</p>
          </CardHeader>
          <CardContent className="space-y-1">
            <FunnelStep
              label="Signed up"
              value={stats.total_users}
              max={stats.total_users}
              color="bg-primary"
              pctLabel="100%"
            />
            <StepArrow
              dropPct={
                stats.total_users > 0
                  ? 100 - Math.round((stats.users_uploaded / stats.total_users) * 100)
                  : 0
              }
            />
            <FunnelStep
              label="Uploaded a photo"
              value={stats.users_uploaded}
              max={stats.total_users}
              color="bg-streak"
            />
            <StepArrow
              dropPct={
                stats.users_uploaded > 0
                  ? 100 - Math.round((stats.users_completed_task / stats.users_uploaded) * 100)
                  : 0
              }
            />
            <FunnelStep
              label="Completed a task"
              value={stats.users_completed_task}
              max={stats.total_users}
              color="bg-points"
            />
            <StepArrow
              dropPct={
                stats.users_completed_task > 0
                  ? 100 - Math.round((stats.users_finished_room / stats.users_completed_task) * 100)
                  : 0
              }
            />
            <FunnelStep
              label="Finished a room"
              value={stats.users_finished_room}
              max={stats.total_users}
              color="bg-primary/60"
            />
          </CardContent>
        </Card>

        {/* Daily Activity Chart */}
        <Card className="border-0 shadow-sm">
          <CardHeader className="pb-2">
            <CardTitle className="text-base font-semibold">Activity — last 14 days</CardTitle>
          </CardHeader>
          <CardContent>
            {dataLoading ? (
              <div className="h-48 flex items-center justify-center text-muted-foreground text-sm">
                Loading…
              </div>
            ) : (
              <ResponsiveContainer width="100%" height={200}>
                <BarChart data={daily} barCategoryGap="30%">
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                  <XAxis
                    dataKey="day"
                    tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }}
                    axisLine={false}
                    tickLine={false}
                  />
                  <YAxis
                    allowDecimals={false}
                    tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }}
                    axisLine={false}
                    tickLine={false}
                  />
                  <Tooltip
                    contentStyle={{
                      background: "hsl(var(--background))",
                      border: "1px solid hsl(var(--border))",
                      borderRadius: 8,
                      fontSize: 12,
                    }}
                  />
                  <Bar dataKey="uploads" name="Uploads" fill="hsl(var(--streak))" radius={[4, 4, 0, 0]} />
                  <Bar dataKey="completions" name="Completions" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            )}
            <div className="flex gap-4 mt-2 justify-center text-xs text-muted-foreground">
              <span className="flex items-center gap-1">
                <span className="w-3 h-3 rounded-sm inline-block bg-streak" /> Uploads
              </span>
              <span className="flex items-center gap-1">
                <span className="w-3 h-3 rounded-sm inline-block bg-primary" /> Completions
              </span>
            </div>
          </CardContent>
        </Card>
      </main>
    </div>
  );
};

/* ── Sub-components ── */

const StatCard = ({
  icon,
  label,
  value,
  sub,
  bg,
}: {
  icon: React.ReactNode;
  label: string;
  value: string | number;
  sub?: string;
  bg: string;
}) => (
  <Card className={`border-0 shadow-sm ${bg}`}>
    <CardContent className="p-4">
      <div className="flex items-center gap-2 mb-1">{icon}<span className="text-xs text-muted-foreground">{label}</span></div>
      <p className="text-2xl font-bold">{value}</p>
      {sub && <p className="text-xs text-muted-foreground mt-0.5">{sub}</p>}
    </CardContent>
  </Card>
);

const FunnelStep = ({
  label,
  value,
  max,
  color,
  pctLabel,
}: {
  label: string;
  value: number;
  max: number;
  color: string;
  pctLabel?: string;
}) => {
  const pct = max > 0 ? Math.round((value / max) * 100) : 0;
  return (
    <div>
      <div className="flex justify-between text-sm mb-1">
        <span className="text-foreground">{label}</span>
        <span className="text-muted-foreground font-medium">
          {value} <span className="text-xs">({pctLabel ?? `${pct}%`})</span>
        </span>
      </div>
      <div className="h-2.5 rounded-full bg-muted overflow-hidden">
        <div className={`h-full rounded-full ${color} transition-all`} style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
};

const StepArrow = ({ dropPct }: { dropPct: number }) => (
  <div className="flex items-center gap-2 py-0.5 pl-1">
    <ArrowDown className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
    {dropPct > 0 && (
      <span className="text-xs text-muted-foreground">
        {dropPct}% dropped off here
      </span>
    )}
  </div>
);

export default Stats;
