 import { useState } from "react";
 import { Card, CardContent } from "@/components/ui/card";
 import { Button } from "@/components/ui/button";
 import { Sparkles, ArrowLeftRight, Eye, EyeOff } from "lucide-react";
 
 interface VisionComparisonProps {
   beforeImage: string;
   afterImage: string | null;
   isGenerating?: boolean;
 }
 
 const VisionComparison = ({ beforeImage, afterImage, isGenerating }: VisionComparisonProps) => {
   const [showAfter, setShowAfter] = useState(true);
   const [sliderPosition, setSliderPosition] = useState(50);
   const [viewMode, setViewMode] = useState<"slider" | "toggle">("slider");
 
   if (isGenerating) {
     return (
       <Card className="border-0 shadow-lg overflow-hidden">
         <CardContent className="p-0">
           <div className="relative aspect-[4/3] bg-muted flex items-center justify-center">
             <div className="text-center">
               <div className="w-12 h-12 mx-auto mb-3 relative">
                 <Sparkles className="w-12 h-12 text-primary animate-pulse" />
               </div>
               <p className="font-medium text-foreground">Creating your vision...</p>
               <p className="text-sm text-muted-foreground mt-1">
                 AI is imagining your transformed space
               </p>
             </div>
           </div>
         </CardContent>
       </Card>
     );
   }
 
   if (!afterImage) {
     return (
       <Card className="border-0 shadow-sm overflow-hidden">
         <CardContent className="p-0">
           <img 
             src={beforeImage} 
             alt="Your space" 
             className="w-full aspect-[4/3] object-cover"
           />
         </CardContent>
       </Card>
     );
   }
 
   return (
     <div className="space-y-3">
       {/* View Mode Toggle */}
       <div className="flex justify-center gap-2">
         <Button
           variant={viewMode === "slider" ? "default" : "outline"}
           size="sm"
           onClick={() => setViewMode("slider")}
           className="gap-2"
         >
           <ArrowLeftRight className="w-4 h-4" />
           Slider
         </Button>
         <Button
           variant={viewMode === "toggle" ? "default" : "outline"}
           size="sm"
           onClick={() => setViewMode("toggle")}
           className="gap-2"
         >
           {showAfter ? <Eye className="w-4 h-4" /> : <EyeOff className="w-4 h-4" />}
           Toggle
         </Button>
       </div>
 
       <Card className="border-0 shadow-lg overflow-hidden">
         <CardContent className="p-0">
           {viewMode === "slider" ? (
             /* Slider Comparison */
             <div className="relative aspect-[4/3] select-none overflow-hidden">
               {/* After Image (full) */}
               <img 
                 src={afterImage} 
                 alt="Your vision" 
                 className="absolute inset-0 w-full h-full object-cover"
               />
               
               {/* Before Image (clipped) */}
               <div 
                 className="absolute inset-0 overflow-hidden"
                 style={{ width: `${sliderPosition}%` }}
               >
                 <img 
                   src={beforeImage} 
                   alt="Before" 
                   className="absolute inset-0 w-full h-full object-cover"
                   style={{ 
                     width: `${100 / (sliderPosition / 100)}%`,
                     maxWidth: "none"
                   }}
                 />
               </div>
 
               {/* Slider Handle */}
               <div 
                 className="absolute top-0 bottom-0 w-1 bg-white shadow-lg cursor-ew-resize"
                 style={{ left: `${sliderPosition}%`, transform: "translateX(-50%)" }}
               >
                 <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-8 h-8 bg-white rounded-full shadow-lg flex items-center justify-center">
                   <ArrowLeftRight className="w-4 h-4 text-primary" />
                 </div>
               </div>
 
               {/* Slider Input (invisible, for interaction) */}
               <input
                 type="range"
                 min="0"
                 max="100"
                 value={sliderPosition}
                 onChange={(e) => setSliderPosition(Number(e.target.value))}
                 className="absolute inset-0 w-full h-full opacity-0 cursor-ew-resize"
               />
 
               {/* Labels */}
               <div className="absolute bottom-3 left-3 bg-black/60 text-white text-xs px-2 py-1 rounded">
                 Before
               </div>
               <div className="absolute bottom-3 right-3 bg-primary text-primary-foreground text-xs px-2 py-1 rounded flex items-center gap-1">
                 <Sparkles className="w-3 h-3" />
                 Your Vision
               </div>
             </div>
           ) : (
             /* Toggle Comparison */
             <div 
               className="relative aspect-[4/3] cursor-pointer"
               onClick={() => setShowAfter(!showAfter)}
             >
               <img 
                 src={showAfter ? afterImage : beforeImage} 
                 alt={showAfter ? "Your vision" : "Before"} 
                 className="w-full h-full object-cover transition-opacity duration-300"
               />
               <div className={`absolute bottom-3 ${showAfter ? 'right-3' : 'left-3'} ${showAfter ? 'bg-primary text-primary-foreground' : 'bg-black/60 text-white'} text-xs px-2 py-1 rounded flex items-center gap-1`}>
                 {showAfter && <Sparkles className="w-3 h-3" />}
                 {showAfter ? "Your Vision" : "Before"}
               </div>
               <div className="absolute top-3 right-3 bg-black/60 text-white text-xs px-2 py-1 rounded">
                 Tap to {showAfter ? "see before" : "see vision"}
               </div>
             </div>
           )}
         </CardContent>
       </Card>
 
       {/* Motivation Text */}
       <p className="text-center text-sm text-muted-foreground">
         ✨ This is what your space could look like!
       </p>
     </div>
   );
 };
 
 export default VisionComparison;