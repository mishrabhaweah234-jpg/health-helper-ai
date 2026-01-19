import { useState, useEffect, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Input } from "@/components/ui/input";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import { Stethoscope, LogOut, MessageSquare, User, Clock, AlertCircle, Trash2, Edit2, Check, X, Circle, Camera, Loader2, Video, Phone, Bot } from "lucide-react";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { doctorSupabase } from "@/integrations/supabase/doctorClient";
import { useDoctorAuth } from "@/hooks/useDoctorAuth";
import { ChatWindow } from "@/components/ChatWindow";
import { ThemeToggle } from "@/components/ThemeToggle";
import { VideoCallModal } from "@/components/VideoCallModal";
import { IncomingCallModal } from "@/components/IncomingCallModal";
import { AIVoiceAssistant } from "@/components/AIVoiceAssistant";
import { useCallManager } from "@/hooks/useCallManager";

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
  const [specialization, setSpecialization] = useState("");
  const [editingSpecialization, setEditingSpecialization] = useState(false);
  const [tempSpecialization, setTempSpecialization] = useState("");
  const [isOnline, setIsOnline] = useState(false);
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);
  const [uploadingAvatar, setUploadingAvatar] = useState(false);
  const [showAIAssistant, setShowAIAssistant] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { user, signOut } = useDoctorAuth();
  const { toast } = useToast();
  const { incomingCall, activeCall, initiateCall, acceptCall, declineCall, endCall } = useCallManager(doctorSupabase, user);

  useEffect(() => {
    if (user) {
      fetchDoctorProfile();
    }
  }, [user]);

  const fetchDoctorProfile = async () => {
    if (!user) return;
    const { data } = await doctorSupabase
      .from('profiles')
      .select('specialization, is_online, avatar_url')
      .eq('user_id', user.id)
      .maybeSingle();
    if (data) {
      if (data.specialization) setSpecialization(data.specialization);
      setIsOnline(data.is_online ?? false);
      setAvatarUrl(data.avatar_url);
    }
  };

  const handleAvatarUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file || !user) return;

    // Validate file type
    if (!file.type.startsWith('image/')) {
      toast({ variant: "destructive", title: "Invalid file", description: "Please upload an image file" });
      return;
    }

    // Validate file size (max 5MB)
    if (file.size > 5 * 1024 * 1024) {
      toast({ variant: "destructive", title: "File too large", description: "Maximum file size is 5MB" });
      return;
    }

    setUploadingAvatar(true);

    try {
      const fileExt = file.name.split('.').pop();
      const filePath = `${user.id}/avatar.${fileExt}`;

      // Upload to storage
      const { error: uploadError } = await doctorSupabase.storage
        .from('avatars')
        .upload(filePath, file, { upsert: true });

      if (uploadError) throw uploadError;

      // Get public URL
      const { data: { publicUrl } } = doctorSupabase.storage
        .from('avatars')
        .getPublicUrl(filePath);

      // Update profile
      const { error: updateError } = await doctorSupabase
        .from('profiles')
        .update({ avatar_url: publicUrl })
        .eq('user_id', user.id);

      if (updateError) throw updateError;

      setAvatarUrl(publicUrl);
      toast({ title: "Profile photo updated" });
    } catch (error) {
      console.error('Avatar upload error:', error);
      toast({ variant: "destructive", title: "Upload failed", description: "Could not upload photo" });
    } finally {
      setUploadingAvatar(false);
    }
  };

  const toggleOnlineStatus = async (checked: boolean) => {
    if (!user) return;
    setIsOnline(checked);
    const { error } = await doctorSupabase
      .from('profiles')
      .update({ is_online: checked })
      .eq('user_id', user.id);
    if (error) {
      setIsOnline(!checked);
      toast({ variant: "destructive", title: "Error", description: "Failed to update status" });
    } else {
      toast({ title: checked ? "You are now online" : "You are now offline" });
    }
  };

  const saveSpecialization = async () => {
    if (!user) return;
    const { error } = await doctorSupabase
      .from('profiles')
      .update({ specialization: tempSpecialization })
      .eq('user_id', user.id);
    if (error) {
      toast({ variant: "destructive", title: "Error", description: "Failed to save specialization" });
    } else {
      setSpecialization(tempSpecialization);
      setEditingSpecialization(false);
      toast({ title: "Specialization updated" });
    }
  };

  useEffect(() => {
    fetchConversations();
    
    const channel = doctorSupabase
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
      doctorSupabase.removeChannel(channel);
    };
  }, []);

  const fetchConversations = async () => {
    const { data: convos, error } = await doctorSupabase
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
    const { data: profiles } = await doctorSupabase
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
      await doctorSupabase
        .from('conversations')
        .update({ doctor_id: user.id, status: 'active' })
        .eq('id', conversation.id);
    }
  };

  const handleDeleteConversation = async (e: React.MouseEvent, conversationId: string) => {
    e.stopPropagation();
    
    const { error } = await doctorSupabase
      .from('conversations')
      .delete()
      .eq('id', conversationId);

    if (error) {
      toast({
        variant: "destructive",
        title: "Error",
        description: "Failed to delete conversation",
      });
      return;
    }

    toast({ title: "Conversation deleted" });
    if (selectedConversation?.id === conversationId) {
      setSelectedConversation(null);
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
            {/* Avatar Upload */}
            <div className="relative group">
              <Avatar className="w-12 h-12 cursor-pointer border-2 border-primary/20" onClick={() => fileInputRef.current?.click()}>
                <AvatarImage src={avatarUrl || undefined} alt="Doctor avatar" />
                <AvatarFallback className="bg-gradient-to-br from-primary to-primary/80">
                  <Stethoscope className="w-5 h-5 text-primary-foreground" />
                </AvatarFallback>
              </Avatar>
              <div 
                className="absolute inset-0 bg-black/50 rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity cursor-pointer"
                onClick={() => fileInputRef.current?.click()}
              >
                {uploadingAvatar ? (
                  <Loader2 className="w-4 h-4 text-white animate-spin" />
                ) : (
                  <Camera className="w-4 h-4 text-white" />
                )}
              </div>
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                onChange={handleAvatarUpload}
                className="hidden"
              />
            </div>
            <div>
              <h1 className="font-bold text-lg">Doctor Dashboard</h1>
              <div className="flex items-center gap-2">
                {editingSpecialization ? (
                  <>
                    <Input
                      value={tempSpecialization}
                      onChange={(e) => setTempSpecialization(e.target.value)}
                      placeholder="Enter specialization..."
                      className="h-6 text-xs w-40"
                    />
                    <button onClick={saveSpecialization} className="text-green-600 hover:text-green-700">
                      <Check className="w-4 h-4" />
                    </button>
                    <button onClick={() => setEditingSpecialization(false)} className="text-muted-foreground hover:text-foreground">
                      <X className="w-4 h-4" />
                    </button>
                  </>
                ) : (
                  <>
                    <p className="text-xs text-muted-foreground">
                      {specialization || "No specialization set"}
                    </p>
                    <button
                      onClick={() => {
                        setTempSpecialization(specialization);
                        setEditingSpecialization(true);
                      }}
                      className="text-muted-foreground hover:text-foreground"
                    >
                      <Edit2 className="w-3 h-3" />
                    </button>
                  </>
                )}
              </div>
            </div>
          </div>
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2">
              <Switch
                id="online-status"
                checked={isOnline}
                onCheckedChange={toggleOnlineStatus}
              />
              <Label htmlFor="online-status" className="flex items-center gap-1.5 text-sm cursor-pointer">
                <Circle className={`w-2.5 h-2.5 ${isOnline ? 'fill-green-500 text-green-500' : 'fill-muted-foreground text-muted-foreground'}`} />
                {isOnline ? 'Online' : 'Offline'}
              </Label>
            </div>
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
                          <div className="flex items-center gap-2">
                            <Badge variant="outline" className={getStatusColor(conv.status)}>
                              {conv.status}
                            </Badge>
                            <button
                              onClick={(e) => handleDeleteConversation(e, conv.id)}
                              className="p-1 rounded hover:bg-destructive/10 text-muted-foreground hover:text-destructive transition-colors"
                              title="Delete conversation"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </div>
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
                    <div className="flex items-center justify-between mb-3">
                      <h3 className="font-semibold">Initial Symptoms</h3>
                      <div className="flex items-center gap-2">
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => {
                            initiateCall(
                              selectedConversation.patient_id,
                              selectedConversation.patient_name || 'Patient',
                              undefined,
                              'voice',
                              selectedConversation.id
                            );
                          }}
                        >
                          <Phone className="w-4 h-4 mr-1" />
                          Call
                        </Button>
                        <Button
                          size="sm"
                          onClick={() => {
                            initiateCall(
                              selectedConversation.patient_id,
                              selectedConversation.patient_name || 'Patient',
                              undefined,
                              'video',
                              selectedConversation.id
                            );
                          }}
                        >
                          <Video className="w-4 h-4 mr-1" />
                          Video
                        </Button>
                      </div>
                    </div>
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
                    supabaseClient={doctorSupabase}
                    user={user}
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
          remoteUserId={activeCall.remoteUserId}
          supabaseClient={doctorSupabase}
          user={user}
        />
      )}
    </div>
  );
}
