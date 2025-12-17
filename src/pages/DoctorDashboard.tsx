import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Stethoscope, LogOut, MessageSquare, User, Clock, AlertCircle } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { ChatWindow } from "@/components/ChatWindow";
import { ThemeToggle } from "@/components/ThemeToggle";

interface Conversation {
  id: string;
  patient_id: string;
  initial_symptoms: string;
  ai_response: string | null;
  status: string;
  created_at: string;
  patient_name?: string;
}

export default function DoctorDashboard() {
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [selectedConversation, setSelectedConversation] = useState<Conversation | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const { user, signOut } = useAuth();

  useEffect(() => {
    fetchConversations();
    
    const channel = supabase
      .channel('conversations-updates')
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
      supabase.removeChannel(channel);
    };
  }, []);

  const fetchConversations = async () => {
    const { data: convos, error } = await supabase
      .from('conversations')
      .select('*')
      .order('created_at', { ascending: false });

    if (error) {
      console.error('Error fetching conversations:', error);
      setIsLoading(false);
      return;
    }

    // Fetch patient names
    const patientIds = [...new Set(convos?.map(c => c.patient_id) || [])];
    const { data: profiles } = await supabase
      .from('profiles')
      .select('user_id, full_name')
      .in('user_id', patientIds);

    const profileMap = new Map(profiles?.map(p => [p.user_id, p.full_name]) || []);

    const convosWithNames = convos?.map(c => ({
      ...c,
      patient_name: profileMap.get(c.patient_id) || 'Unknown Patient',
    })) || [];

    setConversations(convosWithNames);
    setIsLoading(false);
  };

  const handleSelectConversation = async (conversation: Conversation) => {
    setSelectedConversation(conversation);
    
    // Claim conversation if pending
    if (conversation.status === 'pending' && user) {
      await supabase
        .from('conversations')
        .update({ doctor_id: user.id, status: 'active' })
        .eq('id', conversation.id);
    }
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
              <h1 className="font-bold text-lg">Doctor Dashboard</h1>
              <p className="text-xs text-muted-foreground">Manage patient consultations</p>
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
          {/* Conversations List */}
          <Card className="border-border/50 shadow-lg">
            <CardHeader className="pb-3">
              <CardTitle className="text-lg flex items-center gap-2">
                <MessageSquare className="w-5 h-5" />
                Patient Consultations
              </CardTitle>
              <CardDescription>
                {conversations.filter(c => c.status === 'pending').length} pending
              </CardDescription>
            </CardHeader>
            <CardContent className="p-0">
              <ScrollArea className="h-[calc(100vh-280px)]">
                {isLoading ? (
                  <div className="p-4 text-center text-muted-foreground">Loading...</div>
                ) : conversations.length === 0 ? (
                  <div className="p-4 text-center text-muted-foreground">
                    <AlertCircle className="w-8 h-8 mx-auto mb-2 opacity-50" />
                    No consultations yet
                  </div>
                ) : (
                  <div className="divide-y">
                    {conversations.map((conv) => (
                      <button
                        key={conv.id}
                        onClick={() => handleSelectConversation(conv)}
                        className={`w-full p-4 text-left hover:bg-muted/50 transition-colors ${
                          selectedConversation?.id === conv.id ? 'bg-muted' : ''
                        }`}
                      >
                        <div className="flex items-start justify-between mb-2">
                          <div className="flex items-center gap-2">
                            <User className="w-4 h-4 text-muted-foreground" />
                            <span className="font-medium text-sm">{conv.patient_name}</span>
                          </div>
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

          {/* Chat Area */}
          <div className="lg:col-span-2">
            {selectedConversation ? (
              <div className="h-full flex flex-col gap-4">
                {/* Patient Info */}
                <Card className="border-border/50">
                  <CardContent className="p-4">
                    <h3 className="font-semibold mb-2">Initial Symptoms</h3>
                    <p className="text-sm text-muted-foreground mb-3">{selectedConversation.initial_symptoms}</p>
                    {selectedConversation.ai_response && (
                      <>
                        <h3 className="font-semibold mb-2">AI Assessment</h3>
                        <p className="text-sm text-muted-foreground">{selectedConversation.ai_response}</p>
                      </>
                    )}
                  </CardContent>
                </Card>
                
                <div className="flex-1">
                  <ChatWindow 
                    conversationId={selectedConversation.id} 
                    patientName={selectedConversation.patient_name}
                  />
                </div>
              </div>
            ) : (
              <Card className="h-full border-border/50 flex items-center justify-center">
                <div className="text-center text-muted-foreground">
                  <MessageSquare className="w-12 h-12 mx-auto mb-3 opacity-50" />
                  <p>Select a consultation to start chatting</p>
                </div>
              </Card>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
