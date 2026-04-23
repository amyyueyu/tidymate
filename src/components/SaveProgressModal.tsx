import { useNavigate } from "react-router-dom";
import { lovable } from "@/integrations/lovable/index";
import { toast } from "@/components/ui/sonner";
import { Sparkles, X } from "lucide-react";
import { useEffect, useState } from "react";
import { analytics } from "@/lib/analytics";

interface SaveProgressModalProps {
  open: boolean;
  onClose: () => void;
  /** Optional override copy (e.g. "Save your challenge", "Save your photo") */
  title?: string;
  subtitle?: string;
}

const SaveProgressModal = ({
  open,
  onClose,
  title = "Save your progress ✨",
  subtitle,
}: SaveProgressModalProps) => {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (open) analytics.guestSignupPromptShown({ trigger: "other" });
  }, [open]);

  if (!open) return null;

  const handleGoogle = async () => {
    setLoading(true);
    analytics.guestConvertedToSignup({ method: "google" });
    const { error } = await lovable.auth.signInWithOAuth("google", {
      redirect_uri: window.location.origin,
    });
    if (error) {
      toast.error("Google sign-in failed. Please try again.");
      setLoading(false);
    }
  };

  const handleCreateAccount = () => {
    analytics.guestConvertedToSignup({ method: "email" });
    navigate("/auth?signup=1");
  };

  const sub =
    subtitle ??
    "You've already started — let's keep your wins going. Create a free account to save your progress and come back anytime.";

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center sm:items-center">
      <div
        className="absolute inset-0 bg-foreground/40 backdrop-blur-sm"
        onClick={onClose}
      />
      <div className="relative z-10 w-full max-w-sm mx-4 mb-6 sm:mb-0 bg-card rounded-3xl shadow-2xl p-7 animate-fade-in overflow-hidden">
        <button
          onClick={onClose}
          className="absolute top-3 right-3 w-8 h-8 rounded-full hover:bg-muted/60 flex items-center justify-center text-muted-foreground"
          aria-label="Close"
        >
          <X className="w-4 h-4" />
        </button>

        <div className="w-14 h-14 rounded-2xl bg-primary/10 flex items-center justify-center mb-5">
          <Sparkles className="w-7 h-7 text-primary" />
        </div>

        <h2 className="text-xl font-bold text-foreground leading-snug mb-2">
          {title}
        </h2>
        <p className="text-muted-foreground text-sm leading-relaxed mb-6">
          {sub}
        </p>

        <button
          onClick={handleGoogle}
          disabled={loading}
          className="w-full h-12 flex items-center justify-center gap-2 rounded-xl bg-foreground text-background font-semibold text-sm hover:opacity-90 transition-opacity mb-2.5 disabled:opacity-60"
        >
          <svg className="w-4 h-4" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
            <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
            <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
            <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/>
            <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
          </svg>
          Continue with Google
        </button>

        <button
          onClick={handleCreateAccount}
          className="w-full h-12 flex items-center justify-center rounded-xl border border-primary/40 text-primary font-semibold text-sm hover:bg-primary/5 transition-colors mb-2.5"
        >
          Create account
        </button>

        <button
          onClick={onClose}
          className="w-full text-center text-sm text-muted-foreground hover:text-foreground transition-colors py-2"
        >
          Not now
        </button>
      </div>
    </div>
  );
};

export default SaveProgressModal;
