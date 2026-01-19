import { useEffect, useRef, useState, useCallback } from 'react';
import { SupabaseClient } from '@supabase/supabase-js';

interface UseWebRTCProps {
  supabaseClient: SupabaseClient;
  callSessionId: string;
  userId: string;
  remoteUserId: string;
  isInitiator: boolean;
  onRemoteStream: (stream: MediaStream) => void;
  onCallEnded: () => void;
}

const ICE_SERVERS = [
  { urls: 'stun:stun.l.google.com:19302' },
  { urls: 'stun:stun1.l.google.com:19302' },
];

export function useWebRTC({
  supabaseClient,
  callSessionId,
  userId,
  remoteUserId,
  isInitiator,
  onRemoteStream,
  onCallEnded,
}: UseWebRTCProps) {
  const peerConnectionRef = useRef<RTCPeerConnection | null>(null);
  const localStreamRef = useRef<MediaStream | null>(null);
  const [isConnecting, setIsConnecting] = useState(true);
  const [connectionState, setConnectionState] = useState<RTCPeerConnectionState>('new');

  // Helper to work with dynamic tables not in types
  const callSignalsTable = () => (supabaseClient as any).from('call_signals');
  const callSessionsTable = () => (supabaseClient as any).from('call_sessions');

  const sendSignal = useCallback(async (type: string, data: unknown) => {
    await callSignalsTable().insert({
      call_session_id: callSessionId,
      from_user_id: userId,
      to_user_id: remoteUserId,
      signal_type: type,
      signal_data: data,
    });
  }, [callSessionId, userId, remoteUserId, supabaseClient]);

  const createPeerConnection = useCallback(() => {
    const pc = new RTCPeerConnection({ iceServers: ICE_SERVERS });

    pc.onicecandidate = (event) => {
      if (event.candidate) {
        sendSignal('ice-candidate', event.candidate.toJSON());
      }
    };

    pc.ontrack = (event) => {
      if (event.streams[0]) {
        onRemoteStream(event.streams[0]);
      }
    };

    pc.onconnectionstatechange = () => {
      setConnectionState(pc.connectionState);
      if (pc.connectionState === 'connected') {
        setIsConnecting(false);
      }
      if (pc.connectionState === 'disconnected' || pc.connectionState === 'failed') {
        onCallEnded();
      }
    };

    peerConnectionRef.current = pc;
    return pc;
  }, [sendSignal, onRemoteStream, onCallEnded]);

  const startCall = useCallback(async (videoEnabled: boolean = true) => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: videoEnabled,
        audio: true,
      });
      localStreamRef.current = stream;

      const pc = createPeerConnection();
      stream.getTracks().forEach((track) => {
        pc.addTrack(track, stream);
      });

      if (isInitiator) {
        const offer = await pc.createOffer();
        await pc.setLocalDescription(offer);
        await sendSignal('offer', offer);
      }

      return stream;
    } catch (error) {
      console.error('Error starting call:', error);
      throw error;
    }
  }, [createPeerConnection, isInitiator, sendSignal]);

  const handleSignal = useCallback(async (signal: { signal_type: string; signal_data: unknown; from_user_id: string }) => {
    if (signal.from_user_id === userId) return;

    const pc = peerConnectionRef.current;
    if (!pc) return;

    try {
      if (signal.signal_type === 'offer') {
        await pc.setRemoteDescription(new RTCSessionDescription(signal.signal_data as RTCSessionDescriptionInit));
        const answer = await pc.createAnswer();
        await pc.setLocalDescription(answer);
        await sendSignal('answer', answer);
      } else if (signal.signal_type === 'answer') {
        await pc.setRemoteDescription(new RTCSessionDescription(signal.signal_data as RTCSessionDescriptionInit));
      } else if (signal.signal_type === 'ice-candidate') {
        await pc.addIceCandidate(new RTCIceCandidate(signal.signal_data as RTCIceCandidateInit));
      } else if (signal.signal_type === 'hangup') {
        onCallEnded();
      }
    } catch (error) {
      console.error('Error handling signal:', error);
    }
  }, [userId, sendSignal, onCallEnded]);

  const endCall = useCallback(async () => {
    await sendSignal('hangup', {});
    
    localStreamRef.current?.getTracks().forEach((track) => track.stop());
    peerConnectionRef.current?.close();
    
    localStreamRef.current = null;
    peerConnectionRef.current = null;
    
    await callSessionsTable()
      .update({ status: 'ended', ended_at: new Date().toISOString() })
      .eq('id', callSessionId);
    
    onCallEnded();
  }, [callSessionId, sendSignal, onCallEnded, supabaseClient]);

  const toggleVideo = useCallback((enabled: boolean) => {
    localStreamRef.current?.getVideoTracks().forEach((track) => {
      track.enabled = enabled;
    });
  }, []);

  const toggleAudio = useCallback((enabled: boolean) => {
    localStreamRef.current?.getAudioTracks().forEach((track) => {
      track.enabled = enabled;
    });
  }, []);

  useEffect(() => {
    const channel = supabaseClient
      .channel(`call-signals-${callSessionId}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'call_signals',
          filter: `call_session_id=eq.${callSessionId}`,
        },
        (payload) => {
          handleSignal(payload.new as { signal_type: string; signal_data: unknown; from_user_id: string });
        }
      )
      .subscribe();

    return () => {
      supabaseClient.removeChannel(channel);
    };
  }, [callSessionId, handleSignal, supabaseClient]);

  return {
    startCall,
    endCall,
    toggleVideo,
    toggleAudio,
    localStream: localStreamRef.current,
    isConnecting,
    connectionState,
  };
}
