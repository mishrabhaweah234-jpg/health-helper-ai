import { Dialog, DialogContent } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarImage, AvatarFallback } from '@/components/ui/avatar';
import { Phone, PhoneOff, Video, User } from 'lucide-react';

interface IncomingCallModalProps {
  isOpen: boolean;
  callerName: string;
  callerAvatar?: string;
  callType: 'video' | 'voice';
  onAccept: () => void;
  onDecline: () => void;
}

export function IncomingCallModal({
  isOpen,
  callerName,
  callerAvatar,
  callType,
  onAccept,
  onDecline,
}: IncomingCallModalProps) {
  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onDecline()}>
      <DialogContent className="max-w-sm">
        <div className="flex flex-col items-center py-6">
          <div className="relative mb-4">
            <Avatar className="w-24 h-24 border-4 border-primary/20">
              <AvatarImage src={callerAvatar} alt={callerName} />
              <AvatarFallback className="bg-gradient-to-br from-primary to-primary/80">
                <User className="w-10 h-10 text-primary-foreground" />
              </AvatarFallback>
            </Avatar>
            <div className="absolute -bottom-2 -right-2 w-10 h-10 rounded-full bg-primary flex items-center justify-center animate-pulse">
              {callType === 'video' ? (
                <Video className="w-5 h-5 text-primary-foreground" />
              ) : (
                <Phone className="w-5 h-5 text-primary-foreground" />
              )}
            </div>
          </div>

          <h3 className="text-xl font-semibold mb-1">{callerName}</h3>
          <p className="text-muted-foreground mb-6">
            Incoming {callType} call...
          </p>

          <div className="flex items-center gap-4">
            <Button
              variant="destructive"
              size="lg"
              className="rounded-full w-16 h-16"
              onClick={onDecline}
            >
              <PhoneOff className="w-7 h-7" />
            </Button>

            <Button
              size="lg"
              className="rounded-full w-16 h-16 bg-green-500 hover:bg-green-600"
              onClick={onAccept}
            >
              <Phone className="w-7 h-7" />
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
