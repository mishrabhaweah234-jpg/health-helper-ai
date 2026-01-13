import { Moon, Sun, Palette, Check } from "lucide-react";
import { useTheme } from "next-themes";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useEffect, useState } from "react";

const colorThemes = [
  { id: "teal", name: "Teal Healthcare", color: "hsl(174 62% 40%)" },
  { id: "ocean", name: "Ocean Blue", color: "hsl(210 80% 50%)" },
  { id: "purple", name: "Purple Wellness", color: "hsl(270 60% 55%)" },
  { id: "coral", name: "Warm Coral", color: "hsl(15 75% 55%)" },
  { id: "forest", name: "Forest Green", color: "hsl(150 55% 40%)" },
];

export function ThemeToggle() {
  const { theme, setTheme, resolvedTheme } = useTheme();
  const [colorTheme, setColorTheme] = useState("teal");
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
    // Get saved color theme from localStorage
    const savedColorTheme = localStorage.getItem("color-theme") || "teal";
    setColorTheme(savedColorTheme);
    applyColorTheme(savedColorTheme);
  }, []);

  const applyColorTheme = (themeId: string) => {
    // Remove all theme classes
    document.documentElement.classList.remove(
      "theme-teal",
      "theme-ocean",
      "theme-purple",
      "theme-coral",
      "theme-forest"
    );
    // Add the new theme class
    document.documentElement.classList.add(`theme-${themeId}`);
  };

  const handleColorThemeChange = (themeId: string) => {
    setColorTheme(themeId);
    localStorage.setItem("color-theme", themeId);
    applyColorTheme(themeId);
  };

  const toggleDarkMode = () => {
    setTheme(resolvedTheme === "dark" ? "light" : "dark");
  };

  if (!mounted) return null;

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="outline"
          size="icon"
          className="fixed top-4 right-4 rounded-full bg-card/80 backdrop-blur-sm border-border/50 hover:bg-accent hover:scale-110 transition-all duration-300 shadow-card z-50"
        >
          <Palette className="h-5 w-5" />
          <span className="sr-only">Choose theme</span>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-48">
        <DropdownMenuItem onClick={toggleDarkMode} className="cursor-pointer">
          {resolvedTheme === "dark" ? (
            <>
              <Sun className="mr-2 h-4 w-4" />
              Light Mode
            </>
          ) : (
            <>
              <Moon className="mr-2 h-4 w-4" />
              Dark Mode
            </>
          )}
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        {colorThemes.map((ct) => (
          <DropdownMenuItem
            key={ct.id}
            onClick={() => handleColorThemeChange(ct.id)}
            className="cursor-pointer flex items-center justify-between"
          >
            <div className="flex items-center">
              <div
                className="w-4 h-4 rounded-full mr-2 border border-border"
                style={{ backgroundColor: ct.color }}
              />
              {ct.name}
            </div>
            {colorTheme === ct.id && <Check className="h-4 w-4" />}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
