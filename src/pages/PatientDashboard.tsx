import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import { 
  Stethoscope, Send, Loader2, AlertCircle, Sparkles, ThermometerSun, Brain, 
  Frown, Pill, Wind, Moon, RotateCcw, LogOut, Plus, MessageSquare, Clock, Circle, Video, Phone, Bot 
} from "lucide-react";
import { patientSupabase } from "@/integrations/supabase/patientClient";
import { usePatientAuth } from "@/hooks/usePatientAuth";
import { ChatWindow } from "@/components/ChatWindow";
import { ThemeToggle } from "@/components/ThemeToggle";
import { useToast } from "@/hooks/use-toast";
import { VideoCallModal } from "@/components/VideoCallModal";
import { IncomingCallModal } from "@/components/IncomingCallModal";
import { AIVoiceAssistant } from "@/components/AIVoiceAssistant";
import { useCallManager } from "@/hooks/useCallManager";

const quickSymptoms = [
  { label: "Headache", icon: Brain },
  { label: "Fever", icon: ThermometerSun },
  { label: "Fatigue", icon: Moon },
  { label: "Nausea", icon: Frown },
  { label: "Cough", icon: Wind },
  { label: "Body aches", icon: Pill },
];

interface Conversation {
  id: string;
  initial_symptoms: string;
  ai_response: string | null;
  status: string;
  created_at: string;
  doctor_id?: string;
  doctor_name?: string;
  doctor_specialization?: string;
  doctor_is_online?: boolean;
  doctor_avatar_url?: string;
}

export default function PatientDashboard() {
  const [symptoms, setSymptoms] = useState("");
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [selectedConversation, setSelectedConversation] = useState<Conversation | null>(null);
  const [showNewConsultation, setShowNewConsultation] = useState(false);
  const [showAIAssistant, setShowAIAssistant] = useState(false);
  const { user, signOut } = usePatientAuth();
  const { toast } = useToast();
  const { incomingCall, activeCall, initiateCall, acceptCall, declineCall, endCall } = useCallManager(patientSupabase, user);

  useEffect(() => {
    fetchConversations();
    
    const channel = patientSupabase
      .channel('patient-conversations')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'conversations',
        },
        () => {
          fetchConversations();
        }
      )
      .subscribe();

    return () => {
      patientSupabase.removeChannel(channel);
    };
  }, []);

  const fetchConversations = async () => {
    if (!user) return;
    
    const { data, error } = await patientSupabase
      .from('conversations')
      .select('*')
      .eq('patient_id', user.id)
      .order('created_at', { ascending: false });

    if (!error && data) {
      // Fetch doctor info for conversations with assigned doctors
      const doctorIds = [...new Set(data.filter(c => c.doctor_id).map(c => c.doctor_id))];
      let doctorMap = new Map<string, { name: string; specialization: string | null; is_online: boolean; avatar_url: string | null }>();
      
      if (doctorIds.length > 0) {
        const { data: profiles } = await patientSupabase
          .from('profiles')
          .select('user_id, full_name, specialization, is_online, avatar_url')
          .in('user_id', doctorIds);
        
        profiles?.forEach(p => {
          doctorMap.set(p.user_id, { 
            name: p.full_name || 'Doctor', 
            specialization: p.specialization,
            is_online: p.is_online ?? false,
            avatar_url: p.avatar_url
          });
        });
      }

      const convosWithDoctor = data.map(c => ({
        ...c,
        doctor_name: c.doctor_id ? doctorMap.get(c.doctor_id)?.name : undefined,
        doctor_specialization: c.doctor_id ? doctorMap.get(c.doctor_id)?.specialization : undefined,
        doctor_is_online: c.doctor_id ? doctorMap.get(c.doctor_id)?.is_online : undefined,
        doctor_avatar_url: c.doctor_id ? doctorMap.get(c.doctor_id)?.avatar_url : undefined,
      }));

      setConversations(convosWithDoctor);
      if (convosWithDoctor.length > 0 && !selectedConversation) {
        setSelectedConversation(convosWithDoctor[0]);
      }
    }
  };

  const addQuickSymptom = (symptom: string) => {
    setSymptoms((prev) => (prev ? `${prev}, ${symptom.toLowerCase()}` : symptom.toLowerCase()));
  };

  const submitSymptoms = async () => {
    if (!symptoms.trim() || !user) return;

    setIsAnalyzing(true);
    
    // Call AI for initial analysis
    let aiResponse = "";
    try {
      const response = await patientSupabase.functions.invoke("analyze-symptoms", {
        body: { symptoms: symptoms.trim() },
      });
      
      if (response.data?.analysis) {
        aiResponse = response.data.analysis;
      }
    } catch (error) {
      console.error("AI analysis error:", error);
    }

    // Create conversation
    const { data, error } = await patientSupabase
      .from('conversations')
      .insert({
        patient_id: user.id,
        initial_symptoms: symptoms.trim(),
        ai_response: aiResponse || null,
        status: 'pending',
      })
      .select()
      .single();

    if (error) {
      toast({
        variant: "destructive",
        title: "Error",
        description: "Failed to create consultation",
      });
    } else if (data) {
      setSelectedConversation(data);
      setShowNewConsultation(false);
      setSymptoms("");
      toast({
        title: "Consultation submitted",
        description: "A doctor will review your symptoms soon",
      });
    }

    setIsAnalyzing(false);
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'pending': return 'bg-yellow-500/10 text-yellow-600 border-yellow-500/20';
      case 'active': return 'bg-green-500/10 text-green-600 border-green-500/20';
      case 'closed': return 'bg-muted text-muted-foreground';
      default: return '';
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-background to-primary/5">
      {/* Header */}
      <header className="border-b bg-background/80 backdrop-blur-sm sticky top-0 z-10">
        <div className="container mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-gradient-to-br from-primary to-primary/80 rounded-xl flex items-center justify-center">
              <Stethoscope className="w-5 h-5 text-primary-foreground" />
            </div>
            <div>
              <h1 className="font-bold text-lg">Digital Healthcare Assistant</h1>
              <p className="text-xs text-muted-foreground">Your health, our priority</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <ThemeToggle />
            <Button variant="outline" onClick={signOut}>
              <LogOut className="w-4 h-4 mr-2" />
              Sign Out
            </Button>
          </div>
        </div>
      </header>

      <div className="container mx-auto px-4 py-6">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 h-[calc(100vh-140px)]">
          {/* Consultations List */}
          <Card className="border-border/50 shadow-lg">
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <CardTitle className="text-lg flex items-center gap-2">
                  <MessageSquare className="w-5 h-5" />
                  My Consultations
                </CardTitle>
                <Button size="sm" onClick={() => setShowNewConsultation(true)}>
                  <Plus className="w-4 h-4 mr-1" />
                  New
                </Button>
              </div>
            </CardHeader>
            <CardContent className="p-0">
              <ScrollArea className="h-[calc(100vh-280px)]">
                {conversations.length === 0 ? (
                  <div className="p-4 text-center text-muted-foreground">
                    <AlertCircle className="w-8 h-8 mx-auto mb-2 opacity-50" />
                    <p>No consultations yet</p>
                    <p className="text-xs mt-1">Start by describing your symptoms</p>
                  </div>
                ) : (
                  <div className="divide-y">
                    {conversations.map((conv) => (
                      <button
                        key={conv.id}
                        onClick={() => {
                          setSelectedConversation(conv);
                          setShowNewConsultation(false);
                        }}
                        className={`w-full p-4 text-left hover:bg-muted/50 transition-colors ${
                          selectedConversation?.id === conv.id && !showNewConsultation ? 'bg-muted' : ''
                        }`}
                      >
                        <div className="flex items-start justify-between mb-2">
                          <Badge variant="outline" className={getStatusColor(conv.status)}>
                            {conv.status}
                          </Badge>
                        </div>
                        <p className="text-sm text-muted-foreground line-clamp-2 mb-2">
                          {conv.initial_symptoms}
                        </p>
                        <div className="flex items-center gap-1 text-xs text-muted-foreground">
                          <Clock className="w-3 h-3" />
                          {new Date(conv.created_at).toLocaleDateString()}
                        </div>
                      </button>
                    ))}
                  </div>
                )}
              </ScrollArea>
            </CardContent>
          </Card>

          {/* Main Content Area */}
          <div className="lg:col-span-2">
            {showNewConsultation || conversations.length === 0 ? (
              <Card className="border-border/50 shadow-lg">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Sparkles className="w-5 h-5 text-primary" />
                    New Consultation
                  </CardTitle>
                  <CardDescription>Describe your symptoms to get started</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  {/* Quick Symptoms */}
                  <div>
                    <p className="text-sm text-muted-foreground mb-3">Quick select:</p>
                    <div className="flex flex-wrap gap-2">
                      {quickSymptoms.map(({ label, icon: Icon }) => (
                        <Button
                          key={label}
                          variant="outline"
                          size="sm"
                          onClick={() => addQuickSymptom(label)}
                          className="hover:bg-primary hover:text-primary-foreground transition-all duration-200"
                        >
                          <Icon className="w-4 h-4 mr-1.5" />
                          {label}
                        </Button>
                      ))}
                    </div>
                  </div>

                  {/* Symptoms Input */}
                  <Textarea
                    placeholder="Describe your symptoms in detail..."
                    value={symptoms}
                    onChange={(e) => setSymptoms(e.target.value)}
                    className="min-h-[150px] resize-none"
                  />

                  <div className="flex gap-2">
                    <Button
                      onClick={submitSymptoms}
                      disabled={!symptoms.trim() || isAnalyzing}
                      className="flex-1"
                    >
                      {isAnalyzing ? (
                        <>
                          <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                          Analyzing...
                        </>
                      ) : (
                        <>
                          <Send className="w-4 h-4 mr-2" />
                          Submit for Review
                        </>
                      )}
                    </Button>
                    {symptoms && (
                      <Button variant="outline" onClick={() => setSymptoms("")}>
                        <RotateCcw className="w-4 h-4" />
                      </Button>
                    )}
                  </div>

                  {/* Disclaimer */}
                  <div className="flex items-start gap-2 p-3 rounded-lg bg-muted/50 text-xs text-muted-foreground">
                    <AlertCircle className="w-4 h-4 mt-0.5 flex-shrink-0" />
                    <p>This is not a substitute for professional medical advice. In case of emergency, call your local emergency services.</p>
                  </div>
                </CardContent>
              </Card>
            ) : selectedConversation ? (
              <div className="h-full flex flex-col gap-4">
                {/* Consultation Info */}
                <Card className="border-border/50">
                  <CardContent className="p-4">
                    <div className="flex items-start justify-between mb-2">
                      <h3 className="font-semibold">Your Symptoms</h3>
                      <Badge variant="outline" className={getStatusColor(selectedConversation.status)}>
                        {selectedConversation.status}
                      </Badge>
                    </div>
                    <p className="text-sm text-muted-foreground mb-3">{selectedConversation.initial_symptoms}</p>
                    
                    {/* Doctor Info */}
                    {selectedConversation.doctor_name && (
                      <div className="mb-3 p-3 rounded-lg bg-primary/5 border border-primary/10">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-3">
                            <Avatar className="w-10 h-10 border-2 border-primary/20">
                              <AvatarImage src={selectedConversation.doctor_avatar_url || undefined} alt="Doctor" />
                              <AvatarFallback className="bg-gradient-to-br from-primary to-primary/80">
                                <Stethoscope className="w-4 h-4 text-primary-foreground" />
                              </AvatarFallback>
                            </Avatar>
                            <div>
                              <span className="font-medium text-sm">{selectedConversation.doctor_name}</span>
                              {selectedConversation.doctor_specialization && (
                                <p className="text-xs text-muted-foreground">
                                  {selectedConversation.doctor_specialization}
                                </p>
                              )}
                            </div>
                          </div>
                          <div className="flex items-center gap-1.5">
                            <Circle className={`w-2.5 h-2.5 ${selectedConversation.doctor_is_online ? 'fill-green-500 text-green-500' : 'fill-muted-foreground text-muted-foreground'}`} />
                            <span className={`text-xs ${selectedConversation.doctor_is_online ? 'text-green-600' : 'text-muted-foreground'}`}>
                              {selectedConversation.doctor_is_online ? 'Online' : 'Offline'}
                            </span>
                          </div>
                          <div className="flex items-center gap-1 ml-2">
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={() => initiateCall(selectedConversation.doctor_id!, selectedConversation.doctor_name!, selectedConversation.doctor_avatar_url, 'voice', selectedConversation.id)}
                              disabled={!selectedConversation.doctor_id}
                            >
                              <Phone className="w-4 h-4" />
                            </Button>
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={() => initiateCall(selectedConversation.doctor_id!, selectedConversation.doctor_name!, selectedConversation.doctor_avatar_url, 'video', selectedConversation.id)}
                              disabled={!selectedConversation.doctor_id}
                            >
                              <Video className="w-4 h-4" />
                            </Button>
                          </div>
                        </div>
                      </div>
                    )}
                    
                    {selectedConversation.ai_response && (
                      <>
                        <h3 className="font-semibold mb-2 flex items-center gap-2">
                          <Sparkles className="w-4 h-4 text-primary" />
                          AI Assessment
                        </h3>
                        <p className="text-sm text-muted-foreground">{selectedConversation.ai_response}</p>
                      </>
                    )}
                  </CardContent>
                </Card>
                
                <div className="flex-1">
                  <ChatWindow conversationId={selectedConversation.id} supabaseClient={patientSupabase} user={user} />
                </div>
              </div>
            ) : null}
          </div>
        </div>
      </div>

      {/* AI Voice Assistant Button */}
      <Button
        className="fixed bottom-6 right-6 rounded-full w-14 h-14 shadow-lg"
        onClick={() => setShowAIAssistant(true)}
      >
        <Bot className="w-6 h-6" />
      </Button>

      {/* Modals */}
      <AIVoiceAssistant isOpen={showAIAssistant} onClose={() => setShowAIAssistant(false)} />

      {incomingCall && (
        <IncomingCallModal
          isOpen={true}
          callerName={incomingCall.callerName}
          callerAvatar={incomingCall.callerAvatar}
          callType={incomingCall.callType}
          onAccept={acceptCall}
          onDecline={declineCall}
        />
      )}

      {activeCall && (
        <VideoCallModal
          isOpen={true}
          onClose={endCall}
          callSessionId={activeCall.id}
          isInitiator={activeCall.isInitiator}
          remoteName={activeCall.remoteName}
        />
      )}
    </div>
  );
}
