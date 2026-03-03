import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import heroBarn from "@/assets/hero-barn.png";

const Auth = () => {
  const [isSignUp, setIsSignUp] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [fullName, setFullName] = useState("");
  const [loading, setLoading] = useState(false);
  const { toast } = useToast();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    if (isSignUp) {
      const { error } = await supabase.auth.signUp({
        email,
        password,
        options: {
          data: { full_name: fullName },
          emailRedirectTo: window.location.origin,
        },
      });
      if (error) {
        toast({ title: "Error", description: error.message, variant: "destructive" });
      } else {
        toast({ title: "Check your email", description: "We sent you a confirmation link." });
      }
    } else {
      const { error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) {
        toast({ title: "Error", description: error.message, variant: "destructive" });
      }
    }
    setLoading(false);
  };

  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-background p-4">
      <div className="w-full max-w-md space-y-6">
        <div className="text-center space-y-2">
          <div className="mx-auto w-full max-w-sm rounded-lg overflow-hidden shadow-lg mb-4">
            <img src={heroBarn} alt="Workshop workbench" className="w-full h-40 object-cover" />
          </div>
          <h1 className="text-3xl font-display font-bold text-foreground">MCR Plumbing Tracker</h1>
          <p className="text-muted-foreground font-body">Time & Work Order Tracker</p>
        </div>

        <Card>
          <CardHeader>
            <CardTitle className="font-display">{isSignUp ? "Create Account" : "Welcome Back"}</CardTitle>
            <CardDescription>{isSignUp ? "Get started tracking your work" : "Sign in to continue"}</CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-4">
              {isSignUp && (
                <div className="space-y-2">
                  <Label htmlFor="fullName">Full Name</Label>
                  <Input id="fullName" value={fullName} onChange={(e) => setFullName(e.target.value)} placeholder="Your name" required />
                </div>
              )}
              <div className="space-y-2">
                <Label htmlFor="email">Email</Label>
                <Input id="email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@example.com" required />
              </div>
              <div className="space-y-2">
                <Label htmlFor="password">Password</Label>
                <Input id="password" type="password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="••••••••" required minLength={6} />
              </div>
              <Button type="submit" className="w-full" disabled={loading}>
                {loading ? "Please wait..." : isSignUp ? "Sign Up" : "Sign In"}
              </Button>
            </form>
            <div className="mt-4 text-center space-y-2">
              <button
                type="button"
                onClick={() => setIsSignUp(!isSignUp)}
                className="text-sm text-accent hover:underline font-body"
              >
                {isSignUp ? "Already have an account? Sign in" : "Need an account? Sign up"}
              </button>
              {!isSignUp && (
                <div>
                  <button
                    type="button"
                    onClick={async () => {
                      if (!email) {
                        toast({ title: "Enter your email first", description: "We need your email to send the reset link.", variant: "destructive" });
                        return;
                      }
                      const { error } = await supabase.auth.resetPasswordForEmail(email, {
                        redirectTo: `${window.location.origin}/reset-password`,
                      });
                      if (error) {
                        toast({ title: "Error", description: error.message, variant: "destructive" });
                      } else {
                        toast({ title: "Check your email", description: "We sent you a password reset link." });
                      }
                    }}
                    className="text-sm text-muted-foreground hover:text-accent hover:underline font-body"
                  >
                    Forgot password?
                  </button>
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default Auth;
