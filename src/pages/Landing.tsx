import { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { useGuestMode } from "@/contexts/GuestModeContext";
import { Camera, Leaf, Sparkles, ArrowRight } from "lucide-react";
import { LangToggle } from "@/components/LangToggle";
import { useLang } from "@/contexts/LanguageContext";
import { analytics } from "@/lib/analytics";

const Landing = () => {
  const navigate = useNavigate();
  const { user, loading: authLoading } = useAuth();
  const { startGuestMode } = useGuestMode();
  const { t } = useLang();

  // If logged in, jump to dashboard
  useEffect(() => {
    if (!authLoading && user) navigate("/", { replace: true });
  }, [user, authLoading, navigate]);

  useEffect(() => {
    analytics.landingView();
  }, []);

  const handleStart = () => {
    startGuestMode();
    navigate("/capture");
  };

  return (
    <div className="min-h-screen bg-[#f5f4f0] flex flex-col">
      {/* Top bar */}
      <header className="px-5 pt-5 pb-3 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Leaf className="w-5 h-5 text-primary" />
          <span className="font-bold text-foreground text-lg">TidyMate</span>
          <span className="ml-2 text-[10px] font-semibold uppercase tracking-wide bg-primary/10 text-primary px-2 py-0.5 rounded-full">
            {t('landing.guest.badge')}
          </span>
        </div>
        <div className="flex items-center gap-1.5">
          <LangToggle />
          <button
            onClick={() => navigate("/auth")}
            className="text-xs font-semibold text-muted-foreground hover:text-foreground px-3 py-1.5 rounded-full hover:bg-foreground/5 transition-colors"
          >
            {t('landing.signin.link')}
          </button>
        </div>
      </header>

      {/* Hero */}
      <main className="flex-1 flex flex-col px-6 pt-8 pb-10">
        <div className="flex-1 flex flex-col justify-center max-w-md mx-auto w-full">
          <div className="w-16 h-16 rounded-3xl bg-primary flex items-center justify-center mb-6 shadow-lg shadow-primary/20">
            <Sparkles className="w-8 h-8 text-primary-foreground" />
          </div>

          <h1 className="font-black text-foreground text-[2.4rem] leading-[1.05] mb-4 tracking-tight">
            {t('landing.hero.title')}
          </h1>
          <p className="text-muted-foreground text-base leading-relaxed mb-10">
            {t('landing.hero.sub')}
          </p>

          {/* Primary CTA */}
          <button
            onClick={handleStart}
            className="w-full bg-primary text-primary-foreground rounded-2xl px-5 py-5 flex items-center gap-4 active:scale-[0.98] transition-transform shadow-xl shadow-primary/25 mb-4"
          >
            <div className="w-12 h-12 rounded-2xl bg-white/20 flex items-center justify-center flex-shrink-0">
              <Camera className="w-6 h-6 text-white" />
            </div>
            <div className="flex-1 text-left">
              <p className="font-extrabold text-base leading-tight">
                {t('landing.cta.title')}
              </p>
              <p className="text-white/75 text-xs mt-0.5">
                {t('landing.cta.sub')}
              </p>
            </div>
            <ArrowRight className="w-5 h-5 text-white/90 flex-shrink-0" />
          </button>

          <p className="text-center text-xs text-muted-foreground">
            {t('landing.no.signup')}
          </p>

          {/* Mini value props */}
          <div className="grid grid-cols-3 gap-2 mt-10">
            <div className="text-center">
              <p className="text-2xl mb-1">📸</p>
              <p className="text-[11px] text-muted-foreground leading-tight">{t('landing.prop1')}</p>
            </div>
            <div className="text-center">
              <p className="text-2xl mb-1">🧠</p>
              <p className="text-[11px] text-muted-foreground leading-tight">{t('landing.prop2')}</p>
            </div>
            <div className="text-center">
              <p className="text-2xl mb-1">⏱️</p>
              <p className="text-[11px] text-muted-foreground leading-tight">{t('landing.prop3')}</p>
            </div>
          </div>
        </div>

        {/* Footer */}
        <p className="text-center text-[11px] text-muted-foreground/70 mt-8">
          {t('landing.footer.account')}{' '}
          <button
            onClick={() => navigate("/auth")}
            className="underline hover:text-foreground"
          >
            {t('landing.signin.link')}
          </button>
        </p>
      </main>
    </div>
  );
};

export default Landing;
