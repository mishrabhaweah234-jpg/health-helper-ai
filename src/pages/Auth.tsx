import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Stethoscope, User, UserCog, Loader2 } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";
import { z } from "zod";

const emailSchema = z.string().email("Please enter a valid email address");
const passwordSchema = z.string().min(6, "Password must be at least 6 characters");

export default function Auth() {
  const [isLogin, setIsLogin] = useState(true);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [fullName, setFullName] = useState("");
  const [role, setRole] = useState<"patient" | "doctor">("patient");
  const [isLoading, setIsLoading] = useState(false);
  const { signIn, signUp } = useAuth();
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
        navigate("/");
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
      
      const { error } = await signUp(email, password, fullName, role);
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
        navigate("/");
      }
    }

    setIsLoading(false);
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-background to-primary/5 flex items-center justify-center p-4">
      <Card className="w-full max-w-md border-border/50 shadow-xl">
        <CardHeader className="text-center pb-2">
          <div className="mx-auto w-16 h-16 bg-gradient-to-br from-primary to-primary/80 rounded-2xl flex items-center justify-center mb-4 shadow-lg">
            <Stethoscope className="w-8 h-8 text-primary-foreground" />
          </div>
          <CardTitle className="text-2xl font-bold">Digital Healthcare Assistant</CardTitle>
          <CardDescription>
            {isLogin ? "Sign in to continue" : "Create your account"}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            {!isLogin && (
              <div className="space-y-2">
                <Label htmlFor="fullName">Full Name</Label>
                <Input
                  id="fullName"
                  type="text"
                  placeholder="Dr. John Smith"
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
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
              />
            </div>

            {!isLogin && (
              <div className="space-y-3">
                <Label>I am a</Label>
                <RadioGroup value={role} onValueChange={(v) => setRole(v as "patient" | "doctor")}>
                  <div className="flex gap-4">
                    <div className="flex items-center space-x-2 flex-1">
                      <RadioGroupItem value="patient" id="patient" />
                      <Label htmlFor="patient" className="flex items-center gap-2 cursor-pointer">
                        <User className="w-4 h-4" />
                        Patient
                      </Label>
                    </div>
                    <div className="flex items-center space-x-2 flex-1">
                      <RadioGroupItem value="doctor" id="doctor" />
                      <Label htmlFor="doctor" className="flex items-center gap-2 cursor-pointer">
                        <UserCog className="w-4 h-4" />
                        Doctor
                      </Label>
                    </div>
                  </div>
                </RadioGroup>
              </div>
            )}

            <Button type="submit" className="w-full" disabled={isLoading}>
              {isLoading && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
              {isLogin ? "Sign In" : "Create Account"}
            </Button>
          </form>

          <div className="mt-4 text-center">
            <button
              type="button"
              onClick={() => setIsLogin(!isLogin)}
              className="text-sm text-muted-foreground hover:text-primary transition-colors"
            >
              {isLogin ? "Don't have an account? Sign up" : "Already have an account? Sign in"}
            </button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
