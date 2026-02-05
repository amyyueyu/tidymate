 import { useState } from "react";
 import { useNavigate } from "react-router-dom";
 import { Button } from "@/components/ui/button";
 import { Card, CardContent } from "@/components/ui/card";
 import { Progress } from "@/components/ui/progress";
 import { Badge } from "@/components/ui/badge";
 import { ScrollArea } from "@/components/ui/scroll-area";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import VisionComparison from "@/components/VisionComparison";
 import {
   ArrowLeft,
   CheckCircle2,
   Circle,
   Clock,
   Eye,
   FastForward,
   Pause,
   Play,
   Sparkles,
   Star,
   UserPlus,
 } from "lucide-react";
 import { toast } from "@/components/ui/sonner";
 
 // Demo data - a sample messy desk scenario
 const DEMO_ROOM = {
   name: "Messy Desk Demo",
   intent: "tidy",
   before_image_url: "https://images.unsplash.com/photo-1542435503-956c469947f6?w=800",
   after_image_url: "https://images.unsplash.com/photo-1518455027359-f3f8164ba6bd?w=800",
 };
 
 const DEMO_CHALLENGES = [
   {
     id: "demo-1",
     title: "Clear loose papers",
     description: "Gather all loose papers and put them in one pile to sort later",
     time_estimate_minutes: 3,
     points: 10,
     status: "pending",
   },
   {
     id: "demo-2",
     title: "Put pens in holder",
     description: "Collect all pens, pencils, and markers and place them in a cup or holder",
     time_estimate_minutes: 2,
     points: 5,
     status: "pending",
   },
   {
     id: "demo-3",
     title: "Remove trash & recyclables",
     description: "Throw away any wrappers, empty cups, or items that don't belong",
     time_estimate_minutes: 2,
     points: 5,
     status: "pending",
   },
   {
     id: "demo-4",
     title: "Wipe down surface",
     description: "Use a cloth or wipe to clean the desk surface",
     time_estimate_minutes: 3,
     points: 10,
     status: "pending",
   },
   {
     id: "demo-5",
     title: "Organize remaining items",
     description: "Arrange books, devices, and decorations neatly",
     time_estimate_minutes: 5,
     points: 15,
     status: "pending",
   },
 ];
 
 const Demo = () => {
   const navigate = useNavigate();
   const [challenges, setChallenges] = useState(DEMO_CHALLENGES);
   const [currentChallengeIndex, setCurrentChallengeIndex] = useState(0);
   const [showVision, setShowVision] = useState(false);
   const [timerActive, setTimerActive] = useState(false);
   const [timeRemaining, setTimeRemaining] = useState(
     DEMO_CHALLENGES[0].time_estimate_minutes * 60
   );
   const [demoPoints, setDemoPoints] = useState(0);
 
   const currentChallenge = challenges[currentChallengeIndex];
   const completedCount = challenges.filter((c) => c.status === "completed").length;
   const totalChallenges = challenges.length;
   const progress = (completedCount / totalChallenges) * 100;
 
   const selectChallenge = (index: number) => {
     if (challenges[index].status === "completed") return;
     setCurrentChallengeIndex(index);
     setTimeRemaining(challenges[index].time_estimate_minutes * 60);
     setTimerActive(false);
   };
 
   const completeChallenge = () => {
     const updated = [...challenges];
     updated[currentChallengeIndex] = {
       ...updated[currentChallengeIndex],
       status: "completed",
     };
     setChallenges(updated);
     setDemoPoints((prev) => prev + currentChallenge.points);
     setTimerActive(false);
 
     toast.success(`+${currentChallenge.points} points! 🎉`);
 
     // Find next incomplete challenge
     const nextIndex = updated.findIndex(
       (c, i) => i > currentChallengeIndex && c.status !== "completed"
     );
     if (nextIndex !== -1) {
       setCurrentChallengeIndex(nextIndex);
       setTimeRemaining(updated[nextIndex].time_estimate_minutes * 60);
     } else if (completedCount + 1 === totalChallenges) {
       toast.success("Demo complete! Sign up to save your progress! 🏆");
     }
   };
 
   const skipChallenge = () => {
     const updated = [...challenges];
     updated[currentChallengeIndex] = {
       ...updated[currentChallengeIndex],
       status: "skipped",
     };
     setChallenges(updated);
     setTimerActive(false);
 
     const nextIndex = updated.findIndex(
       (c, i) => i > currentChallengeIndex && c.status === "pending"
     );
     if (nextIndex !== -1) {
       setCurrentChallengeIndex(nextIndex);
       setTimeRemaining(updated[nextIndex].time_estimate_minutes * 60);
     }
   };
 
   const formatTime = (seconds: number) => {
     const mins = Math.floor(seconds / 60);
     const secs = seconds % 60;
     return `${mins}:${secs.toString().padStart(2, "0")}`;
   };
 
   return (
     <div className="min-h-screen bg-background">
       {/* Header */}
       <header className="sticky top-0 z-10 bg-background/80 backdrop-blur-sm border-b border-border">
         <div className="container max-w-2xl mx-auto px-4 py-3">
           <div className="flex items-center justify-between">
             <Button variant="ghost" size="sm" onClick={() => navigate("/auth")}>
               <ArrowLeft className="w-4 h-4 mr-1" />
               Back
             </Button>
             <Badge variant="secondary" className="bg-primary/10 text-primary">
               <Sparkles className="w-3 h-3 mr-1" />
               Demo Mode
             </Badge>
             <div className="flex items-center gap-1 text-points">
               <Star className="w-4 h-4" />
               <span className="font-semibold">{demoPoints}</span>
             </div>
           </div>
         </div>
       </header>
 
       <main className="container max-w-2xl mx-auto px-4 py-6 space-y-6">
         {/* Room Info */}
         <div className="animate-fade-in">
           <div className="flex items-center justify-between mb-2">
             <div>
               <h1 className="text-xl font-bold">{DEMO_ROOM.name}</h1>
               <p className="text-sm text-muted-foreground">
                 {completedCount}/{totalChallenges} challenges completed
               </p>
             </div>
             <Button variant="outline" size="sm" onClick={() => setShowVision(true)}>
               <Eye className="w-4 h-4 mr-1" />
               See Vision
             </Button>
           </div>
           <Progress value={progress} className="h-2" />
         </div>
 
         {/* Task List */}
         <Card className="border-0 shadow-sm animate-fade-in">
           <CardContent className="p-3">
             <p className="text-xs text-muted-foreground mb-2 font-medium">
               Select a task to work on:
             </p>
             <ScrollArea className="h-[180px]">
               <div className="space-y-2 pr-3">
                 {challenges.map((challenge, index) => (
                   <button
                     key={challenge.id}
                     onClick={() => selectChallenge(index)}
                     disabled={challenge.status === "completed"}
                     className={`w-full text-left p-3 rounded-lg border transition-all ${
                       index === currentChallengeIndex && challenge.status !== "completed"
                         ? "border-primary bg-primary/5"
                         : challenge.status === "completed"
                         ? "border-transparent bg-muted/30 opacity-60"
                         : challenge.status === "skipped"
                         ? "border-transparent bg-muted/20 opacity-50"
                         : "border-border hover:border-primary/50 hover:bg-muted/50"
                     }`}
                   >
                     <div className="flex items-center gap-3">
                       {challenge.status === "completed" ? (
                         <CheckCircle2 className="w-5 h-5 text-primary shrink-0" />
                       ) : challenge.status === "skipped" ? (
                         <FastForward className="w-5 h-5 text-muted-foreground shrink-0" />
                       ) : (
                         <Circle className="w-5 h-5 text-muted-foreground shrink-0" />
                       )}
                       <div className="flex-1 min-w-0">
                         <p
                           className={`font-medium text-sm truncate ${
                             challenge.status === "completed" ? "line-through" : ""
                           }`}
                         >
                           {challenge.title}
                         </p>
                         <div className="flex items-center gap-2 text-xs text-muted-foreground">
                           <span className="flex items-center gap-1">
                             <Clock className="w-3 h-3" />
                             {challenge.time_estimate_minutes}m
                           </span>
                           <span className="flex items-center gap-1">
                             <Star className="w-3 h-3" />
                             {challenge.points}pts
                           </span>
                         </div>
                       </div>
                       {index === currentChallengeIndex &&
                         challenge.status !== "completed" && (
                           <Badge variant="secondary" className="shrink-0 text-xs">
                             Active
                           </Badge>
                         )}
                     </div>
                   </button>
                 ))}
               </div>
             </ScrollArea>
           </CardContent>
         </Card>
 
         {/* Current Challenge Detail */}
         {currentChallenge && currentChallenge.status !== "completed" && (
           <Card className="border-0 shadow-lg animate-fade-in">
             <CardContent className="p-6">
               <div className="text-center mb-6">
                 <h2 className="text-xl font-bold mb-2">{currentChallenge.title}</h2>
                 {currentChallenge.description && (
                   <p className="text-muted-foreground">{currentChallenge.description}</p>
                 )}
               </div>
 
               {/* Timer */}
               <div className="text-center mb-6">
                 <div className="text-5xl font-bold font-mono text-primary mb-2">
                   {formatTime(timeRemaining)}
                 </div>
                 <p className="text-sm text-muted-foreground">
                   {timerActive ? "Time remaining" : "Ready when you are"}
                 </p>
               </div>
 
               {/* Controls */}
               <div className="flex gap-3">
                 <Button
                   variant="outline"
                   className="flex-1"
                   onClick={() => setTimerActive(!timerActive)}
                 >
                   {timerActive ? (
                     <>
                       <Pause className="w-4 h-4 mr-2" />
                       Pause
                     </>
                   ) : (
                     <>
                       <Play className="w-4 h-4 mr-2" />
                       Start
                     </>
                   )}
                 </Button>
                 <Button className="flex-1" onClick={completeChallenge}>
                   <CheckCircle2 className="w-4 h-4 mr-2" />
                   Done!
                 </Button>
               </div>
 
               <Button
                 variant="ghost"
                 className="w-full mt-3 text-muted-foreground"
                 onClick={skipChallenge}
               >
                 <FastForward className="w-4 h-4 mr-2" />
                 Skip for now
               </Button>
             </CardContent>
           </Card>
         )}
 
         {/* All Complete */}
         {completedCount === totalChallenges && (
           <Card className="border-0 shadow-lg bg-gradient-to-br from-primary/5 to-primary/10 animate-fade-in">
             <CardContent className="p-6 text-center">
               <div className="w-16 h-16 rounded-full bg-primary/20 flex items-center justify-center mx-auto mb-4">
                 <CheckCircle2 className="w-8 h-8 text-primary" />
               </div>
               <h2 className="text-2xl font-bold mb-2">Demo Complete! 🎉</h2>
               <p className="text-muted-foreground mb-4">
                 You earned {demoPoints} points. Sign up to save your progress and tackle your
                 own spaces!
               </p>
               <Button onClick={() => navigate("/auth")} className="gap-2">
                 <UserPlus className="w-4 h-4" />
                 Create Account
               </Button>
             </CardContent>
           </Card>
         )}
 
         {/* Sign Up CTA */}
         <Card className="border-0 shadow-sm bg-accent/20 animate-fade-in">
           <CardContent className="p-4 text-center">
             <p className="text-sm text-accent-foreground mb-2">
               💡 This is a demo. Sign up to capture your own spaces and save progress!
             </p>
             <Button variant="link" size="sm" onClick={() => navigate("/auth")}>
               <UserPlus className="w-4 h-4 mr-1" />
               Create free account
             </Button>
           </CardContent>
         </Card>
       </main>
 
       {/* Vision Modal */}
      <Dialog open={showVision} onOpenChange={setShowVision}>
        <DialogContent className="max-w-lg p-4">
          <VisionComparison
            beforeImage={DEMO_ROOM.before_image_url}
            afterImage={DEMO_ROOM.after_image_url}
          />
        </DialogContent>
      </Dialog>
     </div>
   );
 };
 
 export default Demo;