 import { useState } from "react";
 import { useNavigate } from "react-router-dom";
 import { supabase } from "@/integrations/supabase/client";
 import { Button } from "@/components/ui/button";
 import { Input } from "@/components/ui/input";
 import { Label } from "@/components/ui/label";
 import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
 import { toast } from "@/components/ui/sonner";
import { Sparkles, Leaf, Play } from "lucide-react";
 
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
     <div className="min-h-screen flex items-center justify-center bg-background p-4">
       <div className="w-full max-w-md animate-fade-in">
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
                Try One Room Free
              </Button>
           </CardContent>
         </Card>
 
         <p className="text-center text-xs text-muted-foreground mt-6">
           By continuing, you agree to our Terms of Service and Privacy Policy
         </p>
       </div>
     </div>
   );
 };
 
 export default Auth;