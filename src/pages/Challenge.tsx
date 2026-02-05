 import { useState, useEffect, useCallback } from "react";
 import { useNavigate, useParams } from "react-router-dom";
 import { useAuth } from "@/hooks/useAuth";
 import { useProfile } from "@/hooks/useProfile";
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
   Eye
 } from "lucide-react";
 import VisionComparison from "@/components/VisionComparison";
 
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
   before_image_url: string;
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
   
   const [room, setRoom] = useState<Room | null>(null);
   const [challenges, setChallenges] = useState<Challenge[]>([]);
   const [currentChallengeIndex, setCurrentChallengeIndex] = useState(0);
   const [timerActive, setTimerActive] = useState(false);
   const [timeRemaining, setTimeRemaining] = useState(0);
   const [loading, setLoading] = useState(true);
   const [showVision, setShowVision] = useState(false);
 
   useEffect(() => {
     if (!authLoading && !user) {
       navigate("/auth");
     }
   }, [user, authLoading, navigate]);
 
   useEffect(() => {
     if (roomId && user) {
       fetchRoomData();
     }
   }, [roomId, user]);
 
   // Timer effect
   useEffect(() => {
     let interval: NodeJS.Timeout;
     if (timerActive && timeRemaining > 0) {
       interval = setInterval(() => {
         setTimeRemaining((prev) => prev - 1);
       }, 1000);
     } else if (timeRemaining === 0 && timerActive) {
       setTimerActive(false);
       toast("⏰ Time's up! How did it go?");
     }
     return () => clearInterval(interval);
   }, [timerActive, timeRemaining]);
 
   const fetchRoomData = async () => {
     setLoading(true);
     
     const { data: roomData, error: roomError } = await supabase
       .from("rooms")
       .select("*")
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
       // Find first incomplete challenge
       const firstIncomplete = challengeData.findIndex(c => c.status !== "completed");
       setCurrentChallengeIndex(firstIncomplete >= 0 ? firstIncomplete : 0);
       
       // Set timer for current challenge
       if (challengeData[firstIncomplete]) {
         setTimeRemaining(challengeData[firstIncomplete].time_estimate_minutes * 60);
       }
     }
 
     setLoading(false);
   };
 
   const currentChallenge = challenges[currentChallengeIndex];
   const completedCount = challenges.filter(c => c.status === "completed").length;
   const progressPercent = (completedCount / challenges.length) * 100;
 
   const formatTime = (seconds: number) => {
     const mins = Math.floor(seconds / 60);
     const secs = seconds % 60;
     return `${mins}:${secs.toString().padStart(2, "0")}`;
   };
 
   const startTimer = () => {
     if (currentChallenge) {
       setTimeRemaining(currentChallenge.time_estimate_minutes * 60);
       setTimerActive(true);
     }
   };
 
   const completeChallenge = async () => {
     if (!currentChallenge || !room) return;
 
     setTimerActive(false);
 
     // Update challenge status
     await supabase
       .from("challenges")
       .update({ status: "completed", completed_at: new Date().toISOString() })
       .eq("id", currentChallenge.id);
 
     // Add points
     await addPoints(currentChallenge.points);
 
     // Update room completed count
     const newCompletedCount = completedCount + 1;
     await supabase
       .from("rooms")
       .update({ 
         completed_challenges: newCompletedCount,
         ...(newCompletedCount === challenges.length ? { 
           status: "completed",
           completed_at: new Date().toISOString()
         } : {})
       })
       .eq("id", room.id);
 
     toast.success(`+${currentChallenge.points} points! 🎉`);
 
     // Move to next challenge or show completion
     if (currentChallengeIndex < challenges.length - 1) {
       const nextIndex = currentChallengeIndex + 1;
       setCurrentChallengeIndex(nextIndex);
       setTimeRemaining(challenges[nextIndex].time_estimate_minutes * 60);
       
       setChallenges(prev => 
         prev.map((c, i) => i === currentChallengeIndex ? { ...c, status: "completed" } : c)
       );
     } else {
       // All challenges complete!
       toast.success("🏆 Amazing! You've completed all challenges!");
       setChallenges(prev => 
         prev.map((c, i) => i === currentChallengeIndex ? { ...c, status: "completed" } : c)
       );
     }
   };
 
   const skipChallenge = async () => {
     if (!currentChallenge) return;
 
     setTimerActive(false);
 
     await supabase
       .from("challenges")
       .update({ status: "skipped" })
       .eq("id", currentChallenge.id);
 
     if (currentChallengeIndex < challenges.length - 1) {
       const nextIndex = currentChallengeIndex + 1;
       setCurrentChallengeIndex(nextIndex);
       setTimeRemaining(challenges[nextIndex].time_estimate_minutes * 60);
       
       setChallenges(prev => 
         prev.map((c, i) => i === currentChallengeIndex ? { ...c, status: "skipped" } : c)
       );
     }
 
     toast("Challenge skipped. No worries, you can come back to it!");
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
 
   if (!room || !currentChallenge) {
     return (
       <div className="min-h-screen flex items-center justify-center bg-background">
         <div className="text-center">
           <Trophy className="w-16 h-16 text-accent mx-auto mb-4" />
           <h2 className="text-2xl font-bold mb-2">All Done! 🎉</h2>
           <p className="text-muted-foreground mb-6">You've completed all challenges for this space!</p>
           <Button onClick={() => navigate("/")}>Back to Home</Button>
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
             <Button variant="ghost" size="icon" onClick={() => navigate("/")}>
               <ArrowLeft className="w-5 h-5" />
             </Button>
             <div className="flex-1">
               <p className="font-semibold truncate">{room.name}</p>
               <p className="text-xs text-muted-foreground">
                 Challenge {currentChallengeIndex + 1} of {challenges.length}
               </p>
             </div>
             <Badge variant="secondary" className="shrink-0">
               <Star className="w-3 h-3 mr-1" />
               {currentChallenge.points} pts
             </Badge>
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
             onClick={() => setShowVision(!showVision)}
           >
             <Eye className="w-4 h-4" />
             {showVision ? "Hide Vision" : "See Your Vision"}
           </Button>
         )}
 
         {/* Vision Comparison */}
         {showVision && room.after_image_url && (
           <div className="mb-6 animate-scale-in">
             <VisionComparison
               beforeImage={room.before_image_url}
               afterImage={room.after_image_url}
             />
           </div>
         )}
 
         {/* Timer */}
         <Card className="border-0 shadow-lg mb-6 animate-scale-in">
           <CardContent className="p-6 text-center">
             <div className={`text-6xl font-bold mb-2 ${timerActive ? "text-primary" : "text-muted-foreground"}`}>
               {formatTime(timeRemaining)}
             </div>
             <div className="flex justify-center gap-3">
               {!timerActive ? (
                 <Button onClick={startTimer} size="lg" className="gap-2">
                   <Play className="w-5 h-5" />
                   Start Timer
                 </Button>
               ) : (
                 <Button onClick={() => setTimerActive(false)} variant="outline" size="lg" className="gap-2">
                   <Pause className="w-5 h-5" />
                   Pause
                 </Button>
               )}
             </div>
           </CardContent>
         </Card>
 
         {/* Current Challenge */}
         <Card className="border-0 shadow-sm flex-1 mb-6 animate-fade-in" style={{ animationDelay: "0.1s" }}>
           <CardContent className="p-6">
             <div className="flex items-center gap-2 mb-4">
               <Clock className="w-4 h-4 text-muted-foreground" />
               <span className="text-sm text-muted-foreground">
                 ~{currentChallenge.time_estimate_minutes} minutes
               </span>
             </div>
             <h2 className="text-2xl font-bold mb-3">{currentChallenge.title}</h2>
             {currentChallenge.description && (
               <p className="text-muted-foreground">{currentChallenge.description}</p>
             )}
           </CardContent>
         </Card>
 
         {/* Encouragement */}
         <Card className="border-0 shadow-sm bg-accent/20 mb-6 animate-fade-in" style={{ animationDelay: "0.2s" }}>
           <CardContent className="p-4 flex items-center gap-3">
             <Sparkles className="w-5 h-5 text-accent-foreground shrink-0" />
             <p className="text-sm text-accent-foreground">
               Focus on this one thing. You've got this! 💪
             </p>
           </CardContent>
         </Card>
 
         {/* Action Buttons */}
         <div className="flex gap-3 animate-fade-in" style={{ animationDelay: "0.3s" }}>
           <Button 
             variant="outline" 
             className="flex-1 h-14"
             onClick={skipChallenge}
           >
             <SkipForward className="w-5 h-5 mr-2" />
             Skip
           </Button>
           <Button 
             className="flex-[2] h-14 text-base"
             onClick={completeChallenge}
           >
             <Check className="w-5 h-5 mr-2" />
             Done!
           </Button>
         </div>
       </main>
     </div>
   );
 };
 
 export default ChallengePage;