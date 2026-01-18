import { useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Stethoscope, User, Loader2 } from "lucide-react";
import { usePatientAuth } from "@/hooks/usePatientAuth";
import { useToast } from "@/hooks/use-toast";
import { z } from "zod";
import { LoginDarkModeToggle } from "@/components/LoginDarkModeToggle";

const emailSchema = z.string().email("Please enter a valid email address");
const passwordSchema = z.string().min(6, "Password must be at least 6 characters");

export default function PatientAuth() {
  const [isLogin, setIsLogin] = useState(true);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [fullName, setFullName] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const { signIn, signUp } = usePatientAuth();
  const { toast } = useToast();
  const navigate = useNavigate();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);

    try {
      emailSchema.parse(email);
      passwordSchema.parse(password);
    } catch (err) {
      if (err instanceof z.ZodError) {
        toast({
          variant: "destructive",
          title: "Validation Error",
          description: err.errors[0].message,
        });
        setIsLoading(false);
        return;
      }
    }

    if (isLogin) {
      const { error } = await signIn(email, password);
      if (error) {
        toast({
          variant: "destructive",
          title: "Login Failed",
          description: error.message === "Invalid login credentials" 
            ? "Invalid email or password. Please try again." 
            : error.message,
        });
      } else {
        toast({ title: "Welcome back!" });
        navigate("/patient");
      }
    } else {
      if (!fullName.trim()) {
        toast({
          variant: "destructive",
          title: "Validation Error",
          description: "Please enter your full name",
        });
        setIsLoading(false);
        return;
      }
      
      const { error } = await signUp(email, password, fullName);
      if (error) {
        toast({
          variant: "destructive",
          title: "Signup Failed",
          description: error.message.includes("already registered")
            ? "This email is already registered. Please login instead."
            : error.message,
        });
      } else {
        toast({ title: "Account created successfully!" });
        navigate("/patient");
      }
    }

    setIsLoading(false);
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-background to-muted flex items-center justify-center p-4 overflow-hidden">
      {/* Animated background elements */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-20 left-10 w-72 h-72 bg-primary/10 rounded-full blur-3xl animate-float" />
        <div className="absolute bottom-20 right-10 w-96 h-96 bg-primary/5 rounded-full blur-3xl animate-float" style={{ animationDelay: '1s' }} />
      </div>
      
      <Card className="w-full max-w-md border-border/50 shadow-xl interactive-card animate-slide-up relative z-10 backdrop-blur-sm bg-card/95">
        <CardHeader className="text-center pb-2">
          <div className="mx-auto w-16 h-16 bg-gradient-to-br from-primary to-primary/80 rounded-2xl flex items-center justify-center mb-4 shadow-lg animate-glow-pulse hover:scale-110 transition-transform duration-300 cursor-pointer group">
            <User className="w-8 h-8 text-primary-foreground group-hover:scale-110 transition-transform" />
          </div>
          <CardTitle className="text-2xl font-bold hover:text-primary transition-colors duration-300">Patient Portal</CardTitle>
          <CardDescription className="animate-fade-in">
            {isLogin ? "Sign in to continue" : "Create your patient account"}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            {!isLogin && (
              <div className="space-y-2 animate-slide-up">
                <Label htmlFor="fullName" className="transition-colors hover:text-primary">Full Name</Label>
                <Input
                  id="fullName"
                  type="text"
                  placeholder="John Smith"
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  className="focus-glow transition-all duration-300 hover:border-primary/50"
                />
              </div>
            )}
            
            <div className="space-y-2">
              <Label htmlFor="email" className="transition-colors hover:text-primary">Email</Label>
              <Input
                id="email"
                type="email"
                placeholder="you@example.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                className="focus-glow transition-all duration-300 hover:border-primary/50"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="password" className="transition-colors hover:text-primary">Password</Label>
              <Input
                id="password"
                type="password"
                placeholder="••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                className="focus-glow transition-all duration-300 hover:border-primary/50"
              />
            </div>

            <Button type="submit" className="w-full btn-press group relative overflow-hidden" disabled={isLoading}>
              <span className="absolute inset-0 bg-gradient-to-r from-transparent via-white/10 to-transparent translate-x-[-200%] group-hover:translate-x-[200%] transition-transform duration-700" />
              {isLoading && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
              {isLogin ? "Sign In" : "Create Account"}
            </Button>
          </form>

          <div className="mt-4 text-center space-y-2">
            <button
              type="button"
              onClick={() => setIsLogin(!isLogin)}
              className="text-sm text-muted-foreground hover:text-primary transition-all duration-300 hover:scale-105"
            >
              {isLogin ? "Don't have an account? Sign up" : "Already have an account? Sign in"}
            </button>
            <div className="pt-2 border-t border-border/50">
              <Link 
                to="/auth/doctor" 
                className="text-sm text-muted-foreground hover:text-primary transition-all duration-300 flex items-center justify-center gap-1 group"
              >
                <Stethoscope className="w-3 h-3 group-hover:rotate-12 transition-transform duration-300" />
                <span className="group-hover:translate-x-1 transition-transform duration-300">Doctor Login</span>
              </Link>
            </div>
          </div>
        </CardContent>
      </Card>
      
      <LoginDarkModeToggle />
    </div>
  );
}
