import { cn } from "@/lib/utils";
import { Sparkles, Star } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";

interface PraiseCardProps {
  praise: string;
  bonusPoints: number;
  progressLabel: string;
  isVisible: boolean;
}

const PraiseCard = ({ praise, bonusPoints, progressLabel, isVisible }: PraiseCardProps) => {
  return (
    <Card
      className={cn(
        "border-0 shadow-lg bg-gradient-to-br from-primary/10 to-primary/5 transition-all duration-300",
        isVisible ? "animate-fade-in animate-scale-in opacity-100" : "opacity-0 pointer-events-none"
      )}
    >
      <CardContent className="p-5 space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Sparkles className="w-4 h-4 text-primary shrink-0" />
            <span className="font-semibold text-sm text-primary">{progressLabel}</span>
          </div>
          <div className="flex items-center gap-1 bg-primary/20 text-primary px-2 py-1 rounded-full text-xs font-bold">
            <Star className="w-3 h-3" />
            +{bonusPoints} pts
          </div>
        </div>
        <p className="text-sm text-foreground leading-relaxed">{praise}</p>
      </CardContent>
    </Card>
  );
};

export default PraiseCard;
