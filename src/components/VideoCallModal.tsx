import { useState, useEffect, useRef } from 'react';
import { Dialog, DialogContent } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Video, VideoOff, Mic, MicOff, PhoneOff, Loader2 } from 'lucide-react';
import { useWebRTC } from '@/hooks/useWebRTC';
import { SupabaseClient, User } from '@supabase/supabase-js';

interface VideoCallModalProps {
  isOpen: boolean;
  onClose: () => void;
  callSessionId: string;
  isInitiator: boolean;
  remoteName?: string;
  remoteUserId: string;
  supabaseClient: SupabaseClient;
  user: User | null;
}

export function VideoCallModal({
  isOpen,
  onClose,
  callSessionId,
  isInitiator,
  remoteName = 'User',
  remoteUserId,
  supabaseClient,
  user,
}: VideoCallModalProps) {
  const localVideoRef = useRef<HTMLVideoElement>(null);
  const remoteVideoRef = useRef<HTMLVideoElement>(null);
  const [localStream, setLocalStream] = useState<MediaStream | null>(null);
  const [videoEnabled, setVideoEnabled] = useState(true);
  const [audioEnabled, setAudioEnabled] = useState(true);

  const handleRemoteStream = (stream: MediaStream) => {
    if (remoteVideoRef.current) {
      remoteVideoRef.current.srcObject = stream;
    }
  };

  const handleCallEnded = () => {
    localStream?.getTracks().forEach((track) => track.stop());
    setLocalStream(null);
    onClose();
  };

  const { startCall, endCall, toggleVideo, toggleAudio, isConnecting, connectionState } = useWebRTC({
    supabaseClient,
    callSessionId,
    userId: user?.id || '',
    remoteUserId,
    isInitiator,
    onRemoteStream: handleRemoteStream,
    onCallEnded: handleCallEnded,
  });

  useEffect(() => {
    if (!isOpen || !user) return;

    const initCall = async () => {
      // If initiator, wait for the call to be accepted (status = 'active') before starting WebRTC
      if (isInitiator) {
        // Subscribe to call session updates to know when callee accepts
        const channel = supabaseClient
          .channel(`call-session-${callSessionId}`)
          .on(
            'postgres_changes',
            {
              event: 'UPDATE',
              schema: 'public',
              table: 'call_sessions',
              filter: `id=eq.${callSessionId}`,
            },
            async (payload) => {
              const updatedCall = payload.new as { status: string };
              if (updatedCall.status === 'active') {
                console.log('[VideoCallModal] Call accepted, starting WebRTC');
                try {
                  const stream = await startCall(true);
                  setLocalStream(stream);
                  if (localVideoRef.current) {
                    localVideoRef.current.srcObject = stream;
                  }
                } catch (error) {
                  console.error('Failed to start call:', error);
                  onClose();
                }
              } else if (['ended', 'declined', 'missed'].includes(updatedCall.status)) {
                console.log('[VideoCallModal] Call ended/declined');
                onClose();
              }
            }
          )
          .subscribe();

        // Check if already active (in case the update happened before subscription)
        const { data: currentSession } = await (supabaseClient as any)
          .from('call_sessions')
          .select('status')
          .eq('id', callSessionId)
          .single();

        if (currentSession?.status === 'active') {
          console.log('[VideoCallModal] Call already active, starting WebRTC');
          try {
            const stream = await startCall(true);
            setLocalStream(stream);
            if (localVideoRef.current) {
              localVideoRef.current.srcObject = stream;
            }
          } catch (error) {
            console.error('Failed to start call:', error);
            onClose();
          }
        }

        return () => {
          supabaseClient.removeChannel(channel);
        };
      } else {
        // Receiver: start immediately since they just accepted the call
        console.log('[VideoCallModal] Receiver starting WebRTC');
        try {
          const stream = await startCall(true);
          setLocalStream(stream);
          if (localVideoRef.current) {
            localVideoRef.current.srcObject = stream;
          }
        } catch (error) {
          console.error('Failed to start call:', error);
          onClose();
        }
      }
    };

    initCall();

    return () => {
      localStream?.getTracks().forEach((track) => track.stop());
    };
  }, [isOpen, user, isInitiator, callSessionId, supabaseClient]);

  const handleToggleVideo = () => {
    const newState = !videoEnabled;
    setVideoEnabled(newState);
    toggleVideo(newState);
  };

  const handleToggleAudio = () => {
    const newState = !audioEnabled;
    setAudioEnabled(newState);
    toggleAudio(newState);
  };

  const handleEndCall = async () => {
    await endCall();
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && handleEndCall()}>
      <DialogContent className="max-w-4xl h-[80vh] p-0 overflow-hidden">
        <div className="relative w-full h-full bg-background">
          {/* Remote Video (large) */}
          <div className="absolute inset-0 bg-muted flex items-center justify-center">
            {isConnecting ? (
              <div className="flex flex-col items-center gap-3 text-muted-foreground">
                <Loader2 className="w-12 h-12 animate-spin" />
                <p>Connecting to {remoteName}...</p>
                <p className="text-sm">{connectionState}</p>
              </div>
            ) : (
              <video
                ref={remoteVideoRef}
                autoPlay
                playsInline
                className="w-full h-full object-cover"
              />
            )}
          </div>

          {/* Local Video (small, bottom-right) */}
          <div className="absolute bottom-20 right-4 w-48 h-36 rounded-lg overflow-hidden shadow-lg border-2 border-background">
            <video
              ref={localVideoRef}
              autoPlay
              playsInline
              muted
              className="w-full h-full object-cover"
            />
            {!videoEnabled && (
              <div className="absolute inset-0 bg-muted flex items-center justify-center">
                <VideoOff className="w-8 h-8 text-muted-foreground" />
              </div>
            )}
          </div>

          {/* Controls */}
          <div className="absolute bottom-4 left-1/2 transform -translate-x-1/2 flex items-center gap-3">
            <Button
              variant={videoEnabled ? 'secondary' : 'destructive'}
              size="icon"
              className="rounded-full w-12 h-12"
              onClick={handleToggleVideo}
            >
              {videoEnabled ? <Video className="w-5 h-5" /> : <VideoOff className="w-5 h-5" />}
            </Button>

            <Button
              variant={audioEnabled ? 'secondary' : 'destructive'}
              size="icon"
              className="rounded-full w-12 h-12"
              onClick={handleToggleAudio}
            >
              {audioEnabled ? <Mic className="w-5 h-5" /> : <MicOff className="w-5 h-5" />}
            </Button>

            <Button
              variant="destructive"
              size="icon"
              className="rounded-full w-14 h-14"
              onClick={handleEndCall}
            >
              <PhoneOff className="w-6 h-6" />
            </Button>
          </div>

          {/* Remote name */}
          <div className="absolute top-4 left-4 bg-background/80 backdrop-blur-sm px-3 py-1.5 rounded-lg">
            <p className="font-medium text-sm">{remoteName}</p>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
