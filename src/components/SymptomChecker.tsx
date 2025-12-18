import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Stethoscope, Send, Loader2, AlertCircle, Sparkles, ThermometerSun, Brain, Frown, Pill, Wind, Moon, RotateCcw } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

const quickSymptoms = [
  { label: "Headache", icon: Brain },
  { label: "Fever", icon: ThermometerSun },
  { label: "Fatigue", icon: Moon },
  { label: "Nausea", icon: Frown },
  { label: "Cough", icon: Wind },
  { label: "Body aches", icon: Pill },
];

const SymptomChecker = () => {
  const [symptoms, setSymptoms] = useState("");
  const [response, setResponse] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const { toast } = useToast();

  const handleReset = () => {
    setSymptoms("");
    setResponse("");
  };

  const analyzeSymptoms = async () => {
    if (!symptoms.trim()) {
      toast({
        title: "Please enter your symptoms",
        description: "Describe what you're experiencing to get helpful information.",
        variant: "destructive",
      });
      return;
    }

    setIsLoading(true);
    setResponse("");

    try {
      const resp = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/analyze-symptoms`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}`,
        },
        body: JSON.stringify({ symptoms }),
      });

      if (!resp.ok || !resp.body) {
        const errorData = await resp.json().catch(() => ({}));
        throw new Error(errorData.error || "Failed to analyze symptoms");
      }

      const reader = resp.body.getReader();
      const decoder = new TextDecoder();
      let textBuffer = "";
      let fullResponse = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        
        textBuffer += decoder.decode(value, { stream: true });

        let newlineIndex: number;
        while ((newlineIndex = textBuffer.indexOf("\n")) !== -1) {
          let line = textBuffer.slice(0, newlineIndex);
          textBuffer = textBuffer.slice(newlineIndex + 1);

          if (line.endsWith("\r")) line = line.slice(0, -1);
          if (line.startsWith(":") || line.trim() === "") continue;
          if (!line.startsWith("data: ")) continue;

          const jsonStr = line.slice(6).trim();
          if (jsonStr === "[DONE]") break;

          try {
            const parsed = JSON.parse(jsonStr);
            const content = parsed.choices?.[0]?.delta?.content as string | undefined;
            if (content) {
              fullResponse += content;
              setResponse(fullResponse);
            }
          } catch {
            textBuffer = line + "\n" + textBuffer;
            break;
          }
        }
      }
    } catch (error) {
      console.error("Error:", error);
      toast({
        title: "Something went wrong",
        description: error instanceof Error ? error.message : "Please try again later.",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="w-full max-w-3xl mx-auto space-y-6">
      <Card className="border-border/50 shadow-card interactive-card group animate-slide-up">
        <CardHeader className="text-center pb-4">
          <div className="mx-auto w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center mb-4 group-hover:bg-primary/20 transition-all duration-300 group-hover:scale-110 animate-glow-pulse cursor-pointer">
            <Stethoscope className="w-8 h-8 text-primary group-hover:rotate-12 transition-transform duration-300" />
          </div>
          <CardTitle className="text-2xl hover:text-primary transition-colors duration-300 cursor-default">Describe Your Symptoms</CardTitle>
          <CardDescription className="text-base">
            Tell us what you're experiencing in detail for better insights
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex flex-wrap gap-2">
            {quickSymptoms.map(({ label, icon: Icon }, index) => (
              <Badge
                key={label}
                variant="secondary"
                className="cursor-pointer px-3 py-1.5 text-sm hover:bg-primary hover:text-primary-foreground transition-all duration-200 hover:scale-110 hover:-translate-y-0.5 active:scale-95 btn-press animate-fade-in hover:shadow-md"
                style={{ animationDelay: `${index * 50}ms` }}
                onClick={() => {
                  if (isLoading) return;
                  const newSymptom = symptoms.trim() 
                    ? `${symptoms}, ${label.toLowerCase()}` 
                    : label;
                  setSymptoms(newSymptom);
                }}
              >
                <Icon className="w-3.5 h-3.5 mr-1.5 transition-transform group-hover:scale-110" />
                {label}
              </Badge>
            ))}
          </div>
          <Textarea
            placeholder="e.g., I've had a headache for 2 days, mild fever, and feeling tired..."
            value={symptoms}
            onChange={(e) => setSymptoms(e.target.value)}
            className="min-h-[140px] resize-none text-base focus-glow transition-all duration-300 hover:border-primary/50"
            disabled={isLoading}
          />
          <Button
            onClick={analyzeSymptoms}
            disabled={isLoading || !symptoms.trim()}
            className="w-full h-12 text-base font-medium btn-press group/btn relative overflow-hidden"
            size="lg"
          >
            <span className="absolute inset-0 bg-gradient-to-r from-transparent via-white/20 to-transparent translate-x-[-200%] group-hover/btn:translate-x-[200%] transition-transform duration-700" />
            {isLoading ? (
              <>
                <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                Analyzing...
              </>
            ) : (
              <>
                <Sparkles className="mr-2 h-5 w-5 group-hover/btn:animate-pulse" />
                Get Gemini Insights
              </>
            )}
          </Button>
        </CardContent>
      </Card>

      {response && (
        <Card className="border-border/50 shadow-card animate-slide-up interactive-card">
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <CardTitle className="text-xl flex items-center gap-2">
                <Sparkles className="w-5 h-5 text-primary animate-pulse" />
                <span className="hover:text-primary transition-colors duration-200">Gemini Health Insights</span>
              </CardTitle>
              {!isLoading && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleReset}
                  className="btn-press hover:bg-primary hover:text-primary-foreground transition-all duration-200 hover:scale-105 group/reset"
                >
                  <RotateCcw className="w-4 h-4 mr-1.5 group-hover/reset:rotate-[-180deg] transition-transform duration-500" />
                  New Check
                </Button>
              )}
            </div>
          </CardHeader>
          <CardContent>
            <div className="prose prose-slate dark:prose-invert max-w-none">
              <div className="whitespace-pre-wrap text-foreground/90 leading-relaxed">
                {response}
                {isLoading && (
                  <span className="inline-block w-2 h-5 ml-1 bg-primary animate-blink rounded-sm" />
                )}
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      <Card className="border-warning/30 bg-warning/5 hover:border-warning/50 transition-all duration-300 hover:bg-warning/10 animate-fade-in group/warning">
        <CardContent className="pt-4">
          <div className="flex gap-3">
            <AlertCircle className="w-5 h-5 text-warning flex-shrink-0 mt-0.5 animate-pulse group-hover/warning:scale-110 transition-transform duration-200" />
            <div className="text-sm text-muted-foreground">
              <p className="font-medium text-warning mb-1 group-hover/warning:text-warning transition-colors">Important Disclaimer</p>
              <p>
                This tool provides general health information only and is not a substitute for professional medical advice. 
                Always consult a qualified healthcare provider for diagnosis and treatment.
              </p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default SymptomChecker;
