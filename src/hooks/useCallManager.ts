import { useState, useEffect, useCallback } from 'react';
import { SupabaseClient, User } from '@supabase/supabase-js';
import { useToast } from '@/hooks/use-toast';

interface IncomingCall {
  id: string;
  callerId: string;
  callerName: string;
  callerAvatar?: string;
  callType: 'video' | 'voice';
}

interface CallSession {
  id: string;
  isInitiator: boolean;
  remoteName: string;
  remoteAvatar?: string;
  remoteUserId: string;
}

export function useCallManager(supabaseClient: SupabaseClient, user: User | null) {
  const { toast } = useToast();
  const [incomingCall, setIncomingCall] = useState<IncomingCall | null>(null);
  const [activeCall, setActiveCall] = useState<CallSession | null>(null);

  // Helper to work with dynamic tables not in types
  const callSessionsTable = () => (supabaseClient as any).from('call_sessions');

  useEffect(() => {
    if (!user) return;

    const channel = supabaseClient
      .channel('incoming-calls')
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'call_sessions',
          filter: `callee_id=eq.${user.id}`,
        },
        async (payload) => {
          const call = payload.new as {
            id: string;
            caller_id: string;
            call_type: string;
            status: string;
          };

          if (call.status === 'ringing') {
            // Fetch caller info
            const { data: callerProfile } = await supabaseClient
              .from('profiles')
              .select('full_name, avatar_url')
              .eq('user_id', call.caller_id)
              .maybeSingle();

            setIncomingCall({
              id: call.id,
              callerId: call.caller_id,
              callerName: callerProfile?.full_name || 'Unknown',
              callerAvatar: callerProfile?.avatar_url || undefined,
              callType: call.call_type as 'video' | 'voice',
            });
          }
        }
      )
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'call_sessions',
        },
        (payload) => {
          const call = payload.new as { id: string; status: string };
          
          // Clear incoming call if it was declined, ended, or missed
          if (incomingCall?.id === call.id && ['ended', 'declined', 'missed'].includes(call.status)) {
            setIncomingCall(null);
          }
          
          // Clear active call if ended
          if (activeCall?.id === call.id && call.status === 'ended') {
            setActiveCall(null);
          }
        }
      )
      .subscribe();

    return () => {
      supabaseClient.removeChannel(channel);
    };
  }, [user, incomingCall?.id, activeCall?.id, supabaseClient]);

  const initiateCall = useCallback(async (
    calleeId: string,
    calleeName: string,
    calleeAvatar: string | undefined,
    callType: 'video' | 'voice',
    conversationId?: string
  ) => {
    if (!user) return null;

    try {
      const { data, error } = await callSessionsTable()
        .insert({
          conversation_id: conversationId || null,
          caller_id: user.id,
          callee_id: calleeId,
          call_type: callType,
          status: 'ringing',
        })
        .select()
        .single();

      if (error) throw error;

      setActiveCall({
        id: data.id,
        isInitiator: true,
        remoteName: calleeName,
        remoteAvatar: calleeAvatar,
        remoteUserId: calleeId,
      });

      return data.id;
    } catch (error) {
      console.error('Failed to initiate call:', error);
      toast({
        variant: 'destructive',
        title: 'Call Failed',
        description: 'Could not start the call. Please try again.',
      });
      return null;
    }
  }, [user, toast, supabaseClient]);

  const acceptCall = useCallback(async () => {
    if (!incomingCall) return;

    try {
      await callSessionsTable()
        .update({ status: 'active', started_at: new Date().toISOString() })
        .eq('id', incomingCall.id);

      setActiveCall({
        id: incomingCall.id,
        isInitiator: false,
        remoteName: incomingCall.callerName,
        remoteAvatar: incomingCall.callerAvatar,
        remoteUserId: incomingCall.callerId,
      });
      setIncomingCall(null);
    } catch (error) {
      console.error('Failed to accept call:', error);
      toast({
        variant: 'destructive',
        title: 'Error',
        description: 'Could not accept the call.',
      });
    }
  }, [incomingCall, toast, supabaseClient]);

  const declineCall = useCallback(async () => {
    if (!incomingCall) return;

    try {
      await callSessionsTable()
        .update({ status: 'declined', ended_at: new Date().toISOString() })
        .eq('id', incomingCall.id);

      setIncomingCall(null);
    } catch (error) {
      console.error('Failed to decline call:', error);
    }
  }, [incomingCall, supabaseClient]);

  const endCall = useCallback(() => {
    setActiveCall(null);
  }, []);

  return {
    incomingCall,
    activeCall,
    initiateCall,
    acceptCall,
    declineCall,
    endCall,
  };
}
