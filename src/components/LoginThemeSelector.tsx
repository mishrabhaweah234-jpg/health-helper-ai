import { Check, Sparkles } from "lucide-react";
import { useEffect, useState } from "react";

const loginThemes = [
  { id: "classic", name: "Classic", color: "hsl(210 80% 50%)", accent: "hsl(210 60% 40%)" },
  { id: "obsidian", name: "Obsidian", color: "hsl(260 70% 50%)", accent: "hsl(280 60% 45%)" },
  { id: "verdant", name: "Verdant", color: "hsl(150 60% 40%)", accent: "hsl(130 50% 35%)" },
];

export function LoginThemeSelector() {
  const [loginTheme, setLoginTheme] = useState("classic");
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
    const savedTheme = localStorage.getItem("login-theme") || "classic";
    setLoginTheme(savedTheme);
    applyLoginTheme(savedTheme);
  }, []);

  const applyLoginTheme = (themeId: string) => {
    document.documentElement.classList.remove(
      "login-classic",
      "login-obsidian",
      "login-verdant"
    );
    document.documentElement.classList.add(`login-${themeId}`);
  };

  const handleThemeChange = (themeId: string) => {
    setLoginTheme(themeId);
    localStorage.setItem("login-theme", themeId);
    applyLoginTheme(themeId);
  };

  if (!mounted) return null;

  return (
    <div className="fixed bottom-4 left-1/2 -translate-x-1/2 z-50">
      <div className="flex items-center gap-2 px-4 py-2 rounded-full bg-card/90 backdrop-blur-md border border-border/50 shadow-lg">
        <Sparkles className="w-4 h-4 text-muted-foreground" />
        <span className="text-xs text-muted-foreground font-medium mr-2">Theme</span>
        {loginThemes.map((theme) => (
          <button
            key={theme.id}
            onClick={() => handleThemeChange(theme.id)}
            className={`relative flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium transition-all duration-300 ${
              loginTheme === theme.id
                ? "bg-primary text-primary-foreground shadow-md scale-105"
                : "hover:bg-muted text-muted-foreground hover:text-foreground"
            }`}
          >
            <div
              className="w-3 h-3 rounded-full border border-white/30"
              style={{
                background: `linear-gradient(135deg, ${theme.color}, ${theme.accent})`,
              }}
            />
            {theme.name}
            {loginTheme === theme.id && (
              <Check className="w-3 h-3 animate-fade-in" />
            )}
          </button>
        ))}
      </div>
    </div>
  );
}
