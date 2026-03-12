import { useState, useRef } from "react";
 import { useNavigate } from "react-router-dom";
 import { Button } from "@/components/ui/button";
 import { Card, CardContent } from "@/components/ui/card";
 import { Progress } from "@/components/ui/progress";
 import { Badge } from "@/components/ui/badge";
 import { ScrollArea } from "@/components/ui/scroll-area";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import VisionComparison from "@/components/VisionComparison";
import { supabase } from "@/integrations/supabase/client";
import {
  ArrowLeft,
  Camera,
  CheckCircle2,
  Circle,
  Clock,
  Eye,
  FastForward,
  ImagePlus,
  Pause,
  Play,
  Sparkles,
  Star,
  UserPlus,
} from "lucide-react";
import logoIcon from "@/assets/logo-icon.png";
import logoFull from "@/assets/logo-full.png";
 import { toast } from "@/components/ui/sonner";
 
interface Challenge {
  id: string;
  title: string;
  description: string;
  time_estimate_minutes: number;
  points: number;
  status: "pending" | "completed" | "skipped";
}

type DemoStep = "capture" | "analyzing" | "challenges" | "complete";
 
 const Demo = () => {
   const navigate = useNavigate();
  const fileInputRef = useRef<HTMLInputElement>(null);
  
  const [step, setStep] = useState<DemoStep>("capture");
  const [capturedImage, setCapturedImage] = useState<string | null>(null);
  const [visionImage, setVisionImage] = useState<string | null>(null);
  const [roomName, setRoomName] = useState("My Space");
  const [challenges, setChallenges] = useState<Challenge[]>([]);
   const [currentChallengeIndex, setCurrentChallengeIndex] = useState(0);
   const [showVision, setShowVision] = useState(false);
   const [timerActive, setTimerActive] = useState(false);
  const [timeRemaining, setTimeRemaining] = useState(0);
   const [demoPoints, setDemoPoints] = useState(0);
  const [isGeneratingVision, setIsGeneratingVision] = useState(false);
 
  const currentChallenge = challenges[currentChallengeIndex] || null;
  const completedCount = challenges.filter((c) => c.status === "completed").length;
  const totalChallenges = challenges.length;
   const progress = (completedCount / totalChallenges) * 100;
 
  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = async (event) => {
      const base64 = event.target?.result as string;
      setCapturedImage(base64);
      await analyzeRoom(base64);
    };
    reader.readAsDataURL(file);
  };

  const analyzeRoom = async (imageBase64: string) => {
    setStep("analyzing");
    
    try {
      // Call analyze-room edge function
      const { data: analysisData, error: analysisError } = await supabase.functions.invoke(
        "analyze-room",
        {
          body: { image: imageBase64, intent: "tidy" },
        }
      );

      if (analysisError) throw analysisError;

      // Set room name and challenges
      setRoomName(analysisData.room_name || "My Space");
      const parsedChallenges: Challenge[] = (analysisData.challenges || []).map(
        (c: any, i: number) => ({
          id: `demo-${i}`,
          title: c.title,
          description: c.description || "",
          time_estimate_minutes: c.time_estimate_minutes || 5,
          points: c.points || 10,
          status: "pending" as const,
        })
      );
      setChallenges(parsedChallenges);
      if (parsedChallenges.length > 0) {
        setTimeRemaining(parsedChallenges[0].time_estimate_minutes * 60);
      }

      // Generate vision in background
      setIsGeneratingVision(true);
      generateVision(imageBase64);

      setStep("challenges");
      toast.success("Your personalized challenges are ready! 🎉");
    } catch (error: any) {
      console.error("Analysis error:", error);
      toast.error("Failed to analyze image. Please try again.");
      setStep("capture");
    }
  };

  const generateVision = async (imageBase64: string) => {
    try {
      const { data, error } = await supabase.functions.invoke("generate-vision", {
        body: { image: imageBase64, intent: "tidy" },
      });

      if (!error && data?.image_url) {
        setVisionImage(data.image_url);
      }
    } catch (error) {
      console.error("Vision generation error:", error);
    } finally {
      setIsGeneratingVision(false);
    }
  };

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
    } else {
      const allDone = updated.every((c) => c.status !== "pending");
      if (allDone) {
        setStep("complete");
        toast.success("Amazing work! Sign up to save your progress! 🏆");
      }
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
    } else {
      setStep("complete");
     }
   };
 
   const formatTime = (seconds: number) => {
     const mins = Math.floor(seconds / 60);
     const secs = seconds % 60;
     return `${mins}:${secs.toString().padStart(2, "0")}`;
   };
 
  // Capture Step
  if (step === "capture") {
    return (
      <div className="min-h-screen bg-background">
        <header className="sticky top-0 z-10 bg-background/80 backdrop-blur-sm border-b border-border">
          <div className="container max-w-2xl mx-auto px-4 py-3">
            <div className="flex items-center justify-between">
              <Button variant="ghost" size="sm" onClick={() => navigate("/auth")}>
                <ArrowLeft className="w-4 h-4 mr-1" />
                Back
              </Button>
              <Badge variant="secondary" className="bg-primary/10 text-primary">
                <Sparkles className="w-3 h-3 mr-1" />
                Free Trial
              </Badge>
            </div>
          </div>
        </header>

        <main className="container max-w-2xl mx-auto px-4 py-8">
          <div className="text-center mb-8 animate-fade-in">
            <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-primary/10 mb-4">
              <Leaf className="w-8 h-8 text-primary" />
            </div>
            <h1 className="text-2xl font-bold mb-2">Try TidyMind Free</h1>
            <p className="text-muted-foreground">
              Capture one space and see how AI creates personalized challenges for you
            </p>
          </div>

          <Card className="border-0 shadow-lg animate-fade-in" style={{ animationDelay: "0.1s" }}>
            <CardContent className="p-6">
              <div
                className="aspect-[4/3] rounded-xl bg-muted flex flex-col items-center justify-center cursor-pointer hover:bg-muted/80 transition-colors border-2 border-dashed border-border"
                onClick={() => fileInputRef.current?.click()}
              >
                {capturedImage ? (
                  <img
                    src={capturedImage}
                    alt="Captured"
                    className="w-full h-full object-cover rounded-xl"
                  />
                ) : (
                  <>
                    <Camera className="w-12 h-12 text-muted-foreground mb-3" />
                    <p className="font-medium text-foreground">Tap to capture your space</p>
                    <p className="text-sm text-muted-foreground mt-1">
                      Take a photo of a messy area
                    </p>
                  </>
                )}
              </div>

              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                capture="environment"
                onChange={handleFileSelect}
                className="hidden"
              />

              <div className="flex gap-3 mt-4">
                <Button
                  variant="outline"
                  className="flex-1"
                  onClick={() => fileInputRef.current?.click()}
                >
                  <ImagePlus className="w-4 h-4 mr-2" />
                  Upload Photo
                </Button>
                <Button
                  variant="outline"
                  className="flex-1"
                  onClick={() => {
                    const input = fileInputRef.current;
                    if (input) {
                      input.removeAttribute("capture");
                      input.click();
                      input.setAttribute("capture", "environment");
                    }
                  }}
                >
                  <Camera className="w-4 h-4 mr-2" />
                  Take Photo
                </Button>
              </div>
            </CardContent>
          </Card>

          <Card className="border-0 shadow-sm bg-accent/20 mt-6 animate-fade-in" style={{ animationDelay: "0.2s" }}>
            <CardContent className="p-4 text-center">
              <p className="text-sm text-accent-foreground">
                🎁 Try one room free! Sign up to save progress and unlock unlimited rooms.
              </p>
            </CardContent>
          </Card>
        </main>
      </div>
    );
  }

  // Analyzing Step
  if (step === "analyzing") {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center animate-fade-in">
          <Sparkles className="w-12 h-12 text-primary mx-auto animate-pulse" />
          <h2 className="text-xl font-bold mt-4">Analyzing your space...</h2>
          <p className="text-muted-foreground mt-2">
            AI is creating personalized challenges just for you
          </p>
        </div>
      </div>
    );
  }

  // Complete Step
  if (step === "complete") {
    return (
      <div className="min-h-screen bg-background">
        <header className="sticky top-0 z-10 bg-background/80 backdrop-blur-sm border-b border-border">
          <div className="container max-w-2xl mx-auto px-4 py-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Leaf className="w-5 h-5 text-primary" />
                <span className="font-semibold">TidyMind</span>
              </div>
              <div className="flex items-center gap-1 text-points">
                <Star className="w-4 h-4" />
                <span className="font-semibold">{demoPoints}</span>
              </div>
            </div>
          </div>
        </header>

        <main className="container max-w-2xl mx-auto px-4 py-8">
          <Card className="border-0 shadow-lg bg-gradient-to-br from-primary/5 to-primary/10 animate-fade-in">
            <CardContent className="p-8 text-center">
              <div className="w-20 h-20 rounded-full bg-primary/20 flex items-center justify-center mx-auto mb-6">
                <CheckCircle2 className="w-10 h-10 text-primary" />
              </div>
              <h1 className="text-3xl font-bold mb-3">Amazing Work! 🎉</h1>
              <p className="text-lg text-muted-foreground mb-2">
                You earned <span className="font-bold text-points">{demoPoints} points</span> in your first room!
              </p>
              <p className="text-muted-foreground mb-6">
                Sign up now to save your progress and tackle more spaces.
              </p>
              
              <Button size="lg" onClick={() => navigate("/auth")} className="gap-2 mb-4">
                <UserPlus className="w-5 h-5" />
                Create Free Account
              </Button>
              
              <p className="text-xs text-muted-foreground">
                Keep your points, unlock streaks, badges, and unlimited rooms
              </p>
            </CardContent>
          </Card>

          {capturedImage && visionImage && (
            <Card className="border-0 shadow-sm mt-6 animate-fade-in" style={{ animationDelay: "0.1s" }}>
              <CardContent className="p-4">
                <p className="text-sm font-medium text-center mb-3">Your Transformation</p>
                <VisionComparison
                  beforeImage={capturedImage}
                  afterImage={visionImage}
                />
              </CardContent>
            </Card>
          )}
        </main>
      </div>
    );
  }

  // Challenges Step
   return (
     <div className="min-h-screen bg-background">
       {/* Header */}
       <header className="sticky top-0 z-10 bg-background/80 backdrop-blur-sm border-b border-border">
         <div className="container max-w-2xl mx-auto px-4 py-3">
           <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Leaf className="w-5 h-5 text-primary" />
              <span className="font-semibold">TidyMind</span>
            </div>
             <Badge variant="secondary" className="bg-primary/10 text-primary">
               <Sparkles className="w-3 h-3 mr-1" />
              Free Trial
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
              <h1 className="text-xl font-bold">{roomName}</h1>
               <p className="text-sm text-muted-foreground">
                 {completedCount}/{totalChallenges} challenges completed
               </p>
             </div>
            <Button 
              variant="outline" 
              size="sm" 
              onClick={() => setShowVision(true)}
              disabled={!visionImage && !isGeneratingVision}
            >
               <Eye className="w-4 h-4 mr-1" />
              {isGeneratingVision ? "Creating..." : "See Vision"}
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
 
         {/* Sign Up CTA */}
         <Card className="border-0 shadow-sm bg-accent/20 animate-fade-in">
           <CardContent className="p-4 text-center">
             <p className="text-sm text-accent-foreground mb-2">
              💡 This is your free trial room. Sign up to save progress and unlock more!
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
          {capturedImage && (
            <VisionComparison
              beforeImage={capturedImage}
              afterImage={visionImage}
              isGenerating={isGeneratingVision}
            />
          )}
        </DialogContent>
      </Dialog>
     </div>
   );
 };
 
 export default Demo;