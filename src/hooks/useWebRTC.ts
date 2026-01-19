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

interface SignalData {
  signal_type: string;
  signal_data: unknown;
  from_user_id: string;
}

const ICE_SERVERS = [
  { urls: 'stun:stun.l.google.com:19302' },
  { urls: 'stun:stun1.l.google.com:19302' },
  { urls: 'stun:stun2.l.google.com:19302' },
  { urls: 'stun:stun3.l.google.com:19302' },
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
  const processedSignalsRef = useRef<Set<string>>(new Set());

  // Helper to work with dynamic tables not in types
  const callSignalsTable = useCallback(() => (supabaseClient as any).from('call_signals'), [supabaseClient]);
  const callSessionsTable = useCallback(() => (supabaseClient as any).from('call_sessions'), [supabaseClient]);

  const sendSignal = useCallback(async (type: string, data: unknown) => {
    console.log(`[WebRTC] Sending signal: ${type}`, { callSessionId, userId, remoteUserId });
    const { error } = await callSignalsTable().insert({
      call_session_id: callSessionId,
      from_user_id: userId,
      to_user_id: remoteUserId,
      signal_type: type,
      signal_data: data,
    });
    if (error) {
      console.error('[WebRTC] Error sending signal:', error);
    }
  }, [callSessionId, userId, remoteUserId, callSignalsTable]);

  // Internal signal handler that takes a peer connection directly
  const handleSignalInternal = useCallback(async (
    pc: RTCPeerConnection,
    signal: SignalData,
    signalId?: string
  ) => {
    // Skip if we've already processed this signal
    if (signalId && processedSignalsRef.current.has(signalId)) {
      console.log(`[WebRTC] Signal already processed: ${signalId}`);
      return;
    }
    if (signalId) {
      processedSignalsRef.current.add(signalId);
    }

    // Skip signals from ourselves
    if (signal.from_user_id === userId) {
      console.log('[WebRTC] Ignoring own signal');
      return;
    }

    console.log(`[WebRTC] Handling signal: ${signal.signal_type}`, signal.signal_data);

    try {
      if (signal.signal_type === 'offer') {
        console.log('[WebRTC] Setting remote description (offer)');
        await pc.setRemoteDescription(new RTCSessionDescription(signal.signal_data as RTCSessionDescriptionInit));
        console.log('[WebRTC] Creating answer');
        const answer = await pc.createAnswer();
        await pc.setLocalDescription(answer);
        console.log('[WebRTC] Sending answer');
        await sendSignal('answer', answer);
      } else if (signal.signal_type === 'answer') {
        console.log('[WebRTC] Setting remote description (answer)');
        await pc.setRemoteDescription(new RTCSessionDescription(signal.signal_data as RTCSessionDescriptionInit));
      } else if (signal.signal_type === 'ice-candidate') {
        console.log('[WebRTC] Adding ICE candidate');
        if (signal.signal_data) {
          await pc.addIceCandidate(new RTCIceCandidate(signal.signal_data as RTCIceCandidateInit));
        }
      } else if (signal.signal_type === 'hangup') {
        console.log('[WebRTC] Received hangup signal');
        onCallEnded();
      }
    } catch (error) {
      console.error('[WebRTC] Error handling signal:', error);
    }
  }, [userId, sendSignal, onCallEnded]);

  const createPeerConnection = useCallback(() => {
    console.log('[WebRTC] Creating peer connection');
    const pc = new RTCPeerConnection({ iceServers: ICE_SERVERS });

    pc.onicecandidate = (event) => {
      if (event.candidate) {
        console.log('[WebRTC] ICE candidate generated');
        sendSignal('ice-candidate', event.candidate.toJSON());
      }
    };

    pc.ontrack = (event) => {
      console.log('[WebRTC] Remote track received', event.streams);
      if (event.streams[0]) {
        onRemoteStream(event.streams[0]);
        setIsConnecting(false);
      }
    };

    pc.onconnectionstatechange = () => {
      console.log('[WebRTC] Connection state:', pc.connectionState);
      setConnectionState(pc.connectionState);
      if (pc.connectionState === 'connected') {
        setIsConnecting(false);
      }
      if (pc.connectionState === 'disconnected' || pc.connectionState === 'failed') {
        onCallEnded();
      }
    };

    pc.oniceconnectionstatechange = () => {
      console.log('[WebRTC] ICE connection state:', pc.iceConnectionState);
    };

    peerConnectionRef.current = pc;
    return pc;
  }, [sendSignal, onRemoteStream, onCallEnded]);

  const startCall = useCallback(async (videoEnabled: boolean = true) => {
    try {
      console.log(`[WebRTC] Starting call. Initiator: ${isInitiator}, Video: ${videoEnabled}`);
      
      const stream = await navigator.mediaDevices.getUserMedia({
        video: videoEnabled,
        audio: true,
      });
      console.log('[WebRTC] Got local media stream', stream.getTracks().map(t => t.kind));
      localStreamRef.current = stream;

      // Create peer connection and add tracks immediately for both initiator and receiver
      const pc = createPeerConnection();
      stream.getTracks().forEach((track) => {
        console.log(`[WebRTC] Adding track: ${track.kind}`);
        pc.addTrack(track, stream);
      });

      if (isInitiator) {
        console.log('[WebRTC] Creating offer as initiator');
        const offer = await pc.createOffer();
        await pc.setLocalDescription(offer);
        await sendSignal('offer', offer);
      } else {
        // Non-initiator: fetch any pending signals that were sent before we subscribed
        console.log('[WebRTC] Fetching pending signals as receiver');
        const { data: pendingSignals, error } = await callSignalsTable()
          .select('*')
          .eq('call_session_id', callSessionId)
          .eq('to_user_id', userId)
          .order('created_at', { ascending: true });

        if (error) {
          console.error('[WebRTC] Error fetching pending signals:', error);
        } else if (pendingSignals && pendingSignals.length > 0) {
          console.log(`[WebRTC] Processing ${pendingSignals.length} pending signals`);
          for (const signal of pendingSignals) {
            await handleSignalInternal(pc, signal, signal.id);
          }
        } else {
          console.log('[WebRTC] No pending signals found');
        }
      }

      return stream;
    } catch (error) {
      console.error('[WebRTC] Error starting call:', error);
      throw error;
    }
  }, [createPeerConnection, isInitiator, sendSignal, callSessionId, userId, callSignalsTable, handleSignalInternal]);

  // External signal handler used by realtime subscription
  const handleSignal = useCallback(async (signal: SignalData & { id?: string }) => {
    const pc = peerConnectionRef.current;
    if (!pc) {
      console.log('[WebRTC] No peer connection, ignoring signal');
      return;
    }
    await handleSignalInternal(pc, signal, signal.id);
  }, [handleSignalInternal]);

  const endCall = useCallback(async () => {
    console.log('[WebRTC] Ending call');
    await sendSignal('hangup', {});
    
    localStreamRef.current?.getTracks().forEach((track) => track.stop());
    peerConnectionRef.current?.close();
    
    localStreamRef.current = null;
    peerConnectionRef.current = null;
    
    await callSessionsTable()
      .update({ status: 'ended', ended_at: new Date().toISOString() })
      .eq('id', callSessionId);
    
    onCallEnded();
  }, [callSessionId, sendSignal, onCallEnded, callSessionsTable]);

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
    console.log(`[WebRTC] Setting up realtime subscription for session: ${callSessionId}`);
    const channel = supabaseClient
      .channel(`call-signals-${callSessionId}-${userId}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'call_signals',
          filter: `call_session_id=eq.${callSessionId}`,
        },
        (payload) => {
          console.log('[WebRTC] Received realtime signal:', payload.new);
          handleSignal(payload.new as SignalData & { id?: string });
        }
      )
      .subscribe((status) => {
        console.log('[WebRTC] Realtime subscription status:', status);
      });

    return () => {
      console.log('[WebRTC] Cleaning up realtime subscription');
      supabaseClient.removeChannel(channel);
    };
  }, [callSessionId, userId, handleSignal, supabaseClient]);

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
