import { useAuth } from "@/hooks/useAuth";
import { useProfile } from "@/hooks/useProfile";
import { useNavigate } from "react-router-dom";
import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { 
  Camera, 
  Flame, 
  Star, 
  Trophy, 
  LogOut,
  Leaf,
  ArrowRight,
  Sparkles
} from "lucide-react";

const Index = () => {
  const { user, loading: authLoading, signOut } = useAuth();
  const { profile, loading: profileLoading } = useProfile();
  const navigate = useNavigate();
  const [activeRooms, setActiveRooms] = useState<any[]>([]);

  useEffect(() => {
    if (!authLoading && !user) {
      navigate("/auth");
    }
  }, [user, authLoading, navigate]);

  useEffect(() => {
    if (user) {
      fetchActiveRooms();
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

  const levelProgress = (profile.total_points % 100);
  const pointsToNextLevel = 100 - levelProgress;

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="sticky top-0 z-10 bg-background/80 backdrop-blur-sm border-b border-border">
        <div className="container max-w-2xl mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Leaf className="w-6 h-6 text-primary" />
            <span className="font-semibold text-lg">TidyMate</span>
          </div>
          <Button variant="ghost" size="icon" onClick={signOut}>
            <LogOut className="w-5 h-5" />
          </Button>
        </div>
      </header>

      <main className="container max-w-2xl mx-auto px-4 py-6 space-y-6">
        {/* Welcome Section */}
        <div className="animate-fade-in">
          <h1 className="text-2xl font-bold text-foreground">
            Hey, {profile.display_name || "friend"}! 👋
          </h1>
          <p className="text-muted-foreground mt-1">
            Ready to transform a space today?
          </p>
        </div>

        {/* Stats Cards */}
        <div className="grid grid-cols-3 gap-3 animate-fade-in" style={{ animationDelay: "0.1s" }}>
          <Card className="border-0 shadow-sm bg-streak/10">
            <CardContent className="p-4 text-center">
              <Flame className="w-6 h-6 text-streak mx-auto" />
              <p className="text-2xl font-bold mt-1">{profile.current_streak}</p>
              <p className="text-xs text-muted-foreground">Day Streak</p>
            </CardContent>
          </Card>
          <Card className="border-0 shadow-sm bg-points/10">
            <CardContent className="p-4 text-center">
              <Star className="w-6 h-6 text-points mx-auto" />
              <p className="text-2xl font-bold mt-1">{profile.total_points}</p>
              <p className="text-xs text-muted-foreground">Points</p>
            </CardContent>
          </Card>
          <Card className="border-0 shadow-sm bg-primary/10">
            <CardContent className="p-4 text-center">
              <Trophy className="w-6 h-6 text-primary mx-auto" />
              <p className="text-2xl font-bold mt-1">Lv.{profile.current_level}</p>
              <p className="text-xs text-muted-foreground">Level</p>
            </CardContent>
          </Card>
        </div>

        {/* Level Progress */}
        <Card className="border-0 shadow-sm animate-fade-in" style={{ animationDelay: "0.2s" }}>
          <CardContent className="p-4">
            <div className="flex justify-between items-center mb-2">
              <span className="text-sm font-medium">Level {profile.current_level}</span>
              <span className="text-xs text-muted-foreground">
                {pointsToNextLevel} pts to next level
              </span>
            </div>
            <Progress value={levelProgress} className="h-2" />
          </CardContent>
        </Card>

        {/* Quick Action - Capture */}
        <Card 
          className="border-0 shadow-lg bg-gradient-to-br from-primary/5 to-primary/10 cursor-pointer hover:shadow-xl transition-all animate-fade-in"
          style={{ animationDelay: "0.3s" }}
          onClick={() => navigate("/capture")}
        >
          <CardContent className="p-6">
            <div className="flex items-center gap-4">
              <div className="w-14 h-14 rounded-2xl bg-primary flex items-center justify-center shrink-0">
                <Camera className="w-7 h-7 text-primary-foreground" />
              </div>
              <div className="flex-1">
                <h3 className="font-semibold text-lg">Capture a space</h3>
                <p className="text-sm text-muted-foreground">
                  Take a photo and let AI create your personalized challenges
                </p>
              </div>
              <ArrowRight className="w-5 h-5 text-muted-foreground" />
            </div>
          </CardContent>
        </Card>

        {/* Active Challenges */}
        {activeRooms.length > 0 && (
          <div className="space-y-3 animate-fade-in" style={{ animationDelay: "0.4s" }}>
            <div className="flex items-center justify-between">
              <h2 className="font-semibold text-lg">Active Challenges</h2>
              <Badge variant="secondary" className="font-normal">
                {activeRooms.length} rooms
              </Badge>
            </div>
            {activeRooms.map((room) => (
              <Card 
                key={room.id} 
                className="border-0 shadow-sm cursor-pointer hover:shadow-md transition-all"
                onClick={() => navigate(`/challenge/${room.id}`)}
              >
                <CardContent className="p-4">
                  <div className="flex items-center gap-3">
                    <div className="w-12 h-12 rounded-xl bg-secondary flex items-center justify-center">
                      <Sparkles className="w-5 h-5 text-primary" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-medium truncate">{room.name}</p>
                      <p className="text-sm text-muted-foreground">
                        {room.completed_challenges}/{room.total_challenges} challenges done
                      </p>
                    </div>
                    <Progress 
                      value={(room.completed_challenges / room.total_challenges) * 100} 
                      className="w-16 h-2"
                    />
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}

        {/* Encouragement */}
        <Card className="border-0 shadow-sm bg-accent/20 animate-fade-in" style={{ animationDelay: "0.5s" }}>
          <CardContent className="p-4 text-center">
            <p className="text-sm text-accent-foreground">
              💪 Small steps lead to big transformations. You've got this!
            </p>
          </CardContent>
        </Card>
      </main>
    </div>
  );
};

export default Index;
