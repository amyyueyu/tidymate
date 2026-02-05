 import { useState } from "react";
 import { useNavigate } from "react-router-dom";
 import { supabase } from "@/integrations/supabase/client";
 import { Button } from "@/components/ui/button";
 import { Input } from "@/components/ui/input";
 import { Label } from "@/components/ui/label";
 import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
 import { toast } from "@/components/ui/sonner";
import { Sparkles, Leaf, Play, ArrowRight } from "lucide-react";
import beforeRoom from "@/assets/before-room.jpg";
import afterRoom from "@/assets/after-room.jpg";
 
 const Auth = () => {
   const navigate = useNavigate();
   const [isLogin, setIsLogin] = useState(true);
   const [email, setEmail] = useState("");
   const [password, setPassword] = useState("");
   const [displayName, setDisplayName] = useState("");
   const [loading, setLoading] = useState(false);
 
   const handleSubmit = async (e: React.FormEvent) => {
     e.preventDefault();
     setLoading(true);
 
     try {
       if (isLogin) {
         const { error } = await supabase.auth.signInWithPassword({
           email,
           password,
         });
         if (error) throw error;
         toast.success("Welcome back! 🎉");
         navigate("/");
       } else {
         const { error } = await supabase.auth.signUp({
           email,
           password,
           options: {
             data: { display_name: displayName },
             emailRedirectTo: window.location.origin,
           },
         });
         if (error) throw error;
         toast.success("Check your email to confirm your account!");
       }
     } catch (error: any) {
       toast.error(error.message || "Something went wrong");
     } finally {
       setLoading(false);
     }
   };
 
   return (
    <div className="min-h-screen flex flex-col lg:flex-row bg-background">
      {/* Left Side - Showcase */}
      <div className="hidden lg:flex lg:w-1/2 bg-gradient-to-br from-primary/5 via-primary/10 to-accent/10 p-8 items-center justify-center relative overflow-hidden">
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top_right,_var(--tw-gradient-stops))] from-primary/20 via-transparent to-transparent" />
        
        <div className="relative z-10 max-w-lg w-full space-y-8">
          {/* Header */}
          <div className="text-center space-y-2">
            <h2 className="text-2xl font-bold text-foreground">See the Transformation</h2>
            <p className="text-muted-foreground">From overwhelm to calm, one micro-challenge at a time</p>
           </div>
          
          {/* Before/After Showcase */}
          <div className="relative">
            {/* Before Image */}
            <div className="relative rounded-2xl overflow-hidden shadow-2xl border border-border/50">
              <img 
                src={beforeRoom} 
                alt="Cluttered room before TidyMind" 
                className="w-full aspect-[4/3] object-cover"
              />
              <div className="absolute bottom-3 left-3 bg-destructive/90 text-destructive-foreground text-xs font-medium px-3 py-1.5 rounded-full">
                Before
              </div>
            </div>
            
            {/* Arrow */}
            <div className="flex justify-center my-4">
              <div className="w-10 h-10 rounded-full bg-primary flex items-center justify-center shadow-lg">
                <ArrowRight className="w-5 h-5 text-primary-foreground rotate-90" />
              </div>
            </div>
            
            {/* After Image */}
            <div className="relative rounded-2xl overflow-hidden shadow-2xl border border-primary/30">
              <img 
                src={afterRoom} 
                alt="Organized room after TidyMind" 
                className="w-full aspect-[4/3] object-cover"
              />
              <div className="absolute bottom-3 right-3 bg-primary text-primary-foreground text-xs font-medium px-3 py-1.5 rounded-full flex items-center gap-1">
                <Sparkles className="w-3 h-3" />
                After
              </div>
            </div>
          </div>
          
          {/* Stats */}
          <div className="grid grid-cols-3 gap-4 pt-4">
            <div className="text-center p-3 rounded-xl bg-background/50 backdrop-blur-sm">
              <div className="text-2xl font-bold text-primary">5 min</div>
              <div className="text-xs text-muted-foreground">Micro-tasks</div>
            </div>
            <div className="text-center p-3 rounded-xl bg-background/50 backdrop-blur-sm">
              <div className="text-2xl font-bold text-primary">AI</div>
              <div className="text-xs text-muted-foreground">Powered</div>
            </div>
            <div className="text-center p-3 rounded-xl bg-background/50 backdrop-blur-sm">
              <div className="text-2xl font-bold text-primary">ADHD</div>
              <div className="text-xs text-muted-foreground">Friendly</div>
            </div>
          </div>
         </div>
      </div>
 
      {/* Right Side - Auth Form */}
      <div className="flex-1 flex items-center justify-center p-4 lg:p-8">
        <div className="w-full max-w-md animate-fade-in">
          {/* Mobile Header with mini showcase */}
          <div className="lg:hidden mb-6">
            <div className="flex items-center justify-center gap-2 mb-4">
              <div className="w-12 h-12 rounded-xl overflow-hidden border border-destructive/30">
                <img src={beforeRoom} alt="Before" className="w-full h-full object-cover" />
              </div>
              <ArrowRight className="w-4 h-4 text-primary" />
              <div className="w-12 h-12 rounded-xl overflow-hidden border border-primary/30">
                <img src={afterRoom} alt="After" className="w-full h-full object-cover" />
              </div>
            </div>
          </div>
 
          <div className="text-center mb-8">
            <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-primary/10 mb-4">
              <Leaf className="w-8 h-8 text-primary" />
            </div>
            <h1 className="text-3xl font-bold text-foreground">TidyMind</h1>
            <p className="text-muted-foreground mt-2">
              Transform chaos into calm, one challenge at a time
            </p>
          </div>

          <Card className="border-0 shadow-lg">
            <CardHeader className="space-y-1 pb-4">
              <CardTitle className="text-2xl text-center">
                {isLogin ? "Welcome back" : "Get started"}
              </CardTitle>
              <CardDescription className="text-center">
                {isLogin
                  ? "Sign in to continue your journey"
                  : "Create an account to start decluttering"}
              </CardDescription>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleSubmit} className="space-y-4">
                {!isLogin && (
                  <div className="space-y-2">
                    <Label htmlFor="displayName">Display Name</Label>
                    <Input
                      id="displayName"
                      type="text"
                      placeholder="What should we call you?"
                      value={displayName}
                      onChange={(e) => setDisplayName(e.target.value)}
                      className="h-12"
                    />
                  </div>
                )}
                <div className="space-y-2">
                  <Label htmlFor="email">Email</Label>
                  <Input
                    id="email"
                    type="email"
                    placeholder="you@example.com"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    required
                    className="h-12"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="password">Password</Label>
                  <Input
                    id="password"
                    type="password"
                    placeholder="••••••••"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required
                    minLength={6}
                    className="h-12"
                  />
                </div>
                <Button
                  type="submit"
                  className="w-full h-12 text-base font-medium"
                  disabled={loading}
                >
                  {loading ? (
                    <span className="flex items-center gap-2">
                      <div className="w-4 h-4 border-2 border-primary-foreground/30 border-t-primary-foreground rounded-full animate-spin" />
                      {isLogin ? "Signing in..." : "Creating account..."}
                    </span>
                  ) : (
                    <span className="flex items-center gap-2">
                      <Sparkles className="w-4 h-4" />
                      {isLogin ? "Sign in" : "Create account"}
                    </span>
                  )}
                </Button>
              </form>

              <div className="mt-6 text-center">
                <button
                  type="button"
                  onClick={() => setIsLogin(!isLogin)}
                  className="text-sm text-muted-foreground hover:text-primary transition-colors"
                >
                  {isLogin
                    ? "Don't have an account? Sign up"
                    : "Already have an account? Sign in"}
                </button>
              </div>
 
              <div className="relative my-4">
                <div className="absolute inset-0 flex items-center">
                  <span className="w-full border-t border-border" />
                </div>
                <div className="relative flex justify-center text-xs uppercase">
                  <span className="bg-card px-2 text-muted-foreground">or</span>
                </div>
              </div>

              <Button
                type="button"
                variant="outline"
                className="w-full h-12"
                onClick={() => navigate("/demo")}
              >
                <Play className="w-4 h-4 mr-2" />
                Try One Room as a Guest
              </Button>
            </CardContent>
          </Card>

          <p className="text-center text-xs text-muted-foreground mt-6">
            By continuing, you agree to our Terms of Service and Privacy Policy
          </p>
        </div>
       </div>
     </div>
   );
 };
 
 export default Auth;