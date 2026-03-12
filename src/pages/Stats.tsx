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
  ArrowLeft,
  Upload,
  CheckCircle2,
  Users,
  TrendingUp,
  Layers,
  Trophy,
} from "lucide-react";
import logoIcon from "@/assets/logo-icon.png";

type DailyRow = { day: string; uploads: number; completions: number };

const Stats = () => {
  const { user, loading } = useAuth();
  const navigate = useNavigate();

  const [totals, setTotals] = useState({
    totalUsers: 0,
    totalUploads: 0,
    activeRooms: 0,
    completedRooms: 0,
    totalChallenges: 0,
    completedChallenges: 0,
    uploadsLast7d: 0,
    completionsLast7d: 0,
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

    // Totals via RPC-style raw query using Supabase functions
    const [roomsRes, challengesRes, profilesRes, dailyRoomsRes, dailyChallengesRes] =
      await Promise.all([
        supabase.from("rooms").select("status, created_at"),
        supabase.from("challenges").select("status, completed_at, created_at"),
        supabase.from("profiles").select("user_id"),
        supabase
          .from("rooms")
          .select("created_at")
          .gte("created_at", new Date(Date.now() - 14 * 86400000).toISOString()),
        supabase
          .from("challenges")
          .select("completed_at")
          .eq("status", "completed")
          .gte("completed_at", new Date(Date.now() - 14 * 86400000).toISOString()),
      ]);

    const rooms = roomsRes.data ?? [];
    const challenges = challengesRes.data ?? [];
    const profiles = profilesRes.data ?? [];

    setTotals({
      totalUsers: profiles.length,
      totalUploads: rooms.length,
      activeRooms: rooms.filter((r) => r.status === "active").length,
      completedRooms: rooms.filter((r) => r.status === "completed").length,
      totalChallenges: challenges.length,
      completedChallenges: challenges.filter((c) => c.status === "completed").length,
      uploadsLast7d: (dailyRoomsRes.data ?? []).filter(
        (r) => new Date(r.created_at) >= new Date(Date.now() - 7 * 86400000)
      ).length,
      completionsLast7d: (dailyChallengesRes.data ?? []).filter(
        (c) => c.completed_at && new Date(c.completed_at) >= new Date(Date.now() - 7 * 86400000)
      ).length,
    });

    // Build last-14-day daily chart data
    const buckets: Record<string, DailyRow> = {};
    for (let i = 13; i >= 0; i--) {
      const d = new Date();
      d.setDate(d.getDate() - i);
      const key = d.toISOString().slice(0, 10);
      buckets[key] = { day: key.slice(5), uploads: 0, completions: 0 };
    }

    (dailyRoomsRes.data ?? []).forEach((r) => {
      const key = r.created_at.slice(0, 10);
      if (buckets[key]) buckets[key].uploads++;
    });

    (dailyChallengesRes.data ?? []).forEach((c) => {
      if (!c.completed_at) return;
      const key = c.completed_at.slice(0, 10);
      if (buckets[key]) buckets[key].completions++;
    });

    setDaily(Object.values(buckets));
    setDataLoading(false);
  };

  const conversionRate =
    totals.totalUploads > 0
      ? Math.round((totals.completedChallenges / totals.totalUploads) * 10) / 10
      : 0;

  const challengeCompletion =
    totals.totalChallenges > 0
      ? Math.round((totals.completedChallenges / totals.totalChallenges) * 100)
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
            value={totals.totalUsers}
            bg="bg-primary/10"
          />
          <StatCard
            icon={<Upload className="w-5 h-5 text-streak" />}
            label="Images Uploaded"
            value={totals.totalUploads}
            sub={`+${totals.uploadsLast7d} this week`}
            bg="bg-streak/10"
          />
          <StatCard
            icon={<CheckCircle2 className="w-5 h-5 text-points" />}
            label="Tasks Completed"
            value={totals.completedChallenges}
            sub={`+${totals.completionsLast7d} this week`}
            bg="bg-points/10"
          />
          <StatCard
            icon={<Trophy className="w-5 h-5 text-primary" />}
            label="Rooms Finished"
            value={totals.completedRooms}
            bg="bg-primary/10"
          />
        </div>

        {/* Secondary KPIs */}
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
          <StatCard
            icon={<Layers className="w-5 h-5 text-muted-foreground" />}
            label="Total Challenges"
            value={totals.totalChallenges}
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

        {/* Funnel */}
        <Card className="border-0 shadow-sm">
          <CardHeader className="pb-2">
            <CardTitle className="text-base font-semibold">Conversion Funnel</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <FunnelBar label="Signed up" value={totals.totalUsers} max={totals.totalUsers} color="bg-primary" />
            <FunnelBar label="Uploaded a photo" value={totals.totalUploads} max={totals.totalUsers} color="bg-streak" />
            <FunnelBar label="Completed a task" value={totals.completedChallenges} max={totals.totalUsers} color="bg-points" />
            <FunnelBar label="Finished a room" value={totals.completedRooms} max={totals.totalUsers} color="bg-primary/60" />
          </CardContent>
        </Card>
      </main>
    </div>
  );
};

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

const FunnelBar = ({
  label,
  value,
  max,
  color,
}: {
  label: string;
  value: number;
  max: number;
  color: string;
}) => {
  const pct = max > 0 ? Math.round((value / max) * 100) : 0;
  return (
    <div>
      <div className="flex justify-between text-sm mb-1">
        <span className="text-foreground">{label}</span>
        <span className="text-muted-foreground font-medium">{value} <span className="text-xs">({pct}%)</span></span>
      </div>
      <div className="h-2 rounded-full bg-muted overflow-hidden">
        <div className={`h-full rounded-full ${color} transition-all`} style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
};

export default Stats;
