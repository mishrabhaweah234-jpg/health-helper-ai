import SymptomChecker from "@/components/SymptomChecker";
import { ThemeToggle } from "@/components/ThemeToggle";
import { Heart, Activity } from "lucide-react";

const Index = () => {
  return (
    <div className="min-h-screen bg-gradient-to-b from-background via-background to-primary/5">
      <ThemeToggle />
      <header className="pt-12 pb-8 px-4">
        <div className="max-w-3xl mx-auto text-center">
          <div className="inline-flex items-center justify-center w-20 h-20 rounded-full bg-gradient-to-br from-primary to-primary/70 shadow-glow mb-6 animate-pulse hover:scale-110 transition-transform duration-300 cursor-pointer group">
            <Heart className="w-10 h-10 text-primary-foreground group-hover:animate-bounce" />
          </div>
          <h1 className="text-4xl md:text-5xl font-bold text-foreground mb-4 tracking-tight hover:text-primary transition-colors duration-300">
            Digital Healthcare Assistant
          </h1>
          <p className="text-lg text-muted-foreground max-w-xl mx-auto">
            Your intelligent health companion. Describe your symptoms and receive 
            Gemini-powered insights to help understand your health better.
          </p>
          <div className="flex items-center justify-center gap-2 mt-4 text-primary/70">
            <Activity className="w-4 h-4 animate-pulse" />
            <span className="text-sm font-medium">AI-Powered Analysis</span>
          </div>
        </div>
      </header>

      <main className="px-4 pb-16">
        <SymptomChecker />
      </main>

      <footer className="py-6 text-center text-sm text-muted-foreground border-t border-border/50">
        <p className="hover:text-foreground transition-colors duration-200">Powered by Gemini • For informational purposes only</p>
      </footer>
    </div>
  );
};

export default Index;
