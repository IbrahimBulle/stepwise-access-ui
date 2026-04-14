import { useCallback, useEffect, useRef, useState, type FormEvent, type KeyboardEvent } from "react";
import CareVideoCallDialog from "@/components/CareVideoCallDialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { api, type CHWLinkStatus } from "@/lib/api";
import { cn } from "@/lib/utils";
import {
  AlertTriangle,
  Loader2,
  MapPin,
  MessageSquare,
  Send,
  ShieldCheck,
  User,
  Video,
} from "lucide-react";

type CareRole = "mental_health_user" | "community_health_worker";
type CallPhase = "idle" | "incoming" | "calling" | "connecting" | "connected" | "ended" | "declined";

type ConversationTarget = {
  id: number;
  name: string;
  role: CareRole;
  roomId: string;
  subtitle: string;
  detail?: string;
  riskLevel?: string;
};

type CareMessage = {
  id: string;
  roomId: string;
  senderId: number;
  senderName: string;
  senderRole: CareRole;
  body: string;
  createdAt: string;
};

type RoomPresence = {
  userId: number;
  name: string;
  role: CareRole;
  roomId: string;
  onlineAt: string;
};

type IncomingCall = {
  roomId: string;
  callerName: string;
  callerRole: CareRole;
  from: number;
};

type OfferPayload = {
  from: number;
  callerName: string;
  callerRole: CareRole;
  sdp: RTCSessionDescriptionInit;
};

type AnswerPayload = {
  from: number;
  sdp: RTCSessionDescriptionInit;
};

type IcePayload = {
  from: number;
  candidate: RTCIceCandidateInit;
};

type CallEndPayload = {
  from: number;
  reason?: string;
};

const STORED_MESSAGE_LIMIT = 150;
const ICE_SERVERS: RTCIceServer[] = [
  { urls: "stun:stun.l.google.com:19302" },
  { urls: "stun:stun1.l.google.com:19302" },
];

export default function CareChat() {
  const { user, isUser, isCHW } = useAuth();
  const { toast } = useToast();

  const [targets, setTargets] = useState<ConversationTarget[]>([]);
  const [selectedTargetId, setSelectedTargetId] = useState<number | null>(null);
  const [linkedCHW, setLinkedCHW] = useState<CHWLinkStatus | null>(null);
  const [availabilityMessage, setAvailabilityMessage] = useState<string | null>(null);
  const [loadingTargets, setLoadingTargets] = useState(true);
  const [messages, setMessages] = useState<CareMessage[]>([]);
  const [draft, setDraft] = useState("");
  const [onlineByTargetId, setOnlineByTargetId] = useState<Record<number, boolean>>({});
  const [connectedRooms, setConnectedRooms] = useState<Record<string, boolean>>({});
  const [unreadByRoom, setUnreadByRoom] = useState<Record<string, number>>({});
  const [callPhase, setCallPhase] = useState<CallPhase>("idle");
  const [incomingCall, setIncomingCall] = useState<IncomingCall | null>(null);
  const [localMedia, setLocalMedia] = useState<MediaStream | null>(null);
  const [remoteMedia, setRemoteMedia] = useState<MediaStream | null>(null);
  const [isMicMuted, setIsMicMuted] = useState(false);
  const [isCameraOff, setIsCameraOff] = useState(false);
  const [callDuration, setCallDuration] = useState(0);

  const roomChannelsRef = useRef<Map<string, ReturnType<typeof supabase.channel>>>(new Map());
  const selectedRoomRef = useRef<string | null>(null);
  const activeCallRoomRef = useRef<string | null>(null);
  const incomingOfferRef = useRef<RTCSessionDescriptionInit | null>(null);
  const pendingIceCandidatesRef = useRef<RTCIceCandidateInit[]>([]);
  const peerConnectionRef = useRef<RTCPeerConnection | null>(null);
  const localStreamRef = useRef<MediaStream | null>(null);
  const remoteStreamRef = useRef<MediaStream | null>(null);
  const callTimerRef = useRef<number | null>(null);
  const callPhaseRef = useRef<CallPhase>("idle");
  const localVideoRef = useRef<HTMLVideoElement | null>(null);
  const remoteVideoRef = useRef<HTMLVideoElement | null>(null);
  const messageEndRef = useRef<HTMLDivElement | null>(null);

  const selectedTarget = targets.find((target) => target.id === selectedTargetId) ?? null;
  const selectedRoomId = selectedTarget?.roomId ?? null;
  const callIsActive =
    callPhase === "incoming" ||
    callPhase === "calling" ||
    callPhase === "connecting" ||
    callPhase === "connected";
  const isSelectedTargetOnline = selectedTarget ? onlineByTargetId[selectedTarget.id] : false;
  const isRoomConnected = selectedRoomId ? connectedRooms[selectedRoomId] : false;
  const canSendRealtime = Boolean(selectedTarget && isSelectedTargetOnline && isRoomConnected);

  useEffect(() => {
    callPhaseRef.current = callPhase;
  }, [callPhase]);

  useEffect(() => {
    if (selectedRoomId) {
      selectedRoomRef.current = selectedRoomId;
      setMessages(readRoomMessages(selectedRoomId));
      setUnreadByRoom((current) => ({ ...current, [selectedRoomId]: 0 }));
      return;
    }

    selectedRoomRef.current = null;
    setMessages([]);
  }, [selectedRoomId]);

  useEffect(() => {
    if (!localVideoRef.current) return;
    localVideoRef.current.srcObject = localMedia;
  }, [localMedia]);

  useEffect(() => {
    if (!remoteVideoRef.current) return;
    remoteVideoRef.current.srcObject = remoteMedia;
  }, [remoteMedia]);

  useEffect(() => {
    messageEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  useEffect(() => {
    let isCancelled = false;

    const loadTargets = async () => {
      if (!user) return;

      setLoadingTargets(true);
      setAvailabilityMessage(null);

      try {
        if (isUser) {
          const link = await api.getCHWLink();
          if (isCancelled) return;

          setLinkedCHW(link);

          if (!link.linked) {
            setTargets([]);
            setSelectedTargetId(null);
            setAvailabilityMessage("Link a registered health worker in CHW Support to unlock realtime chat and video.");
            return;
          }

          if (!link.chw_user_id) {
            setTargets([]);
            setSelectedTargetId(null);
            setAvailabilityMessage("Your linked health worker does not have a registered AfyaMind account yet, so live chat and video are unavailable for this link.");
            return;
          }

          const target: ConversationTarget = {
            id: link.chw_user_id,
            name: link.chw_name || "Health Worker",
            role: "community_health_worker",
            roomId: buildRoomId(user.id, link.chw_user_id),
            subtitle: link.region ? `${link.region} support` : "Community health support",
            detail: link.phone || undefined,
          };

          setTargets([target]);
          setSelectedTargetId(target.id);
          return;
        }

        if (isCHW) {
          const caseload = await api.getCHWCaseload();
          if (isCancelled) return;

          const mappedTargets = caseload.patients.map((patient) => ({
            id: patient.patient_id,
            name: patient.patient_name,
            role: "mental_health_user" as const,
            roomId: buildRoomId(user.id, patient.patient_id),
            subtitle: `${patient.region} · ${patient.total_checkins} check-ins`,
            detail: patient.last_checkin_at ? `Last check-in ${formatDateTime(patient.last_checkin_at)}` : "No recent check-in",
            riskLevel: patient.last_risk_level,
          }));

          setTargets(mappedTargets);
          setSelectedTargetId((current) => {
            if (current && mappedTargets.some((target) => target.id === current)) return current;
            return mappedTargets[0]?.id ?? null;
          });
          setAvailabilityMessage(
            mappedTargets.length === 0
              ? "Patients will appear here once they are linked to your caseload."
              : null,
          );
          return;
        }

        setTargets([]);
        setSelectedTargetId(null);
        setAvailabilityMessage("This account role cannot open the care chat workspace.");
      } catch (error) {
        if (isCancelled) return;

        const message = error instanceof Error ? error.message : "Unable to load the care chat workspace.";
        setTargets([]);
        setSelectedTargetId(null);
        setAvailabilityMessage(message);
        toast({ title: "Unable to load care chat", description: message, variant: "destructive" });
      } finally {
        if (!isCancelled) setLoadingTargets(false);
      }
    };

    void loadTargets();

    return () => {
      isCancelled = true;
    };
  }, [isCHW, isUser, toast, user]);

  const stopCallTimer = useCallback(() => {
    if (callTimerRef.current !== null) {
      window.clearInterval(callTimerRef.current);
      callTimerRef.current = null;
    }
  }, []);

  const startCallTimer = useCallback(() => {
    stopCallTimer();
    setCallDuration(0);
    callTimerRef.current = window.setInterval(() => {
      setCallDuration((current) => current + 1);
    }, 1000);
  }, [stopCallTimer]);

  const cleanupCallSession = useCallback(
    (nextPhase: CallPhase = "idle") => {
      stopCallTimer();

      peerConnectionRef.current?.close();
      peerConnectionRef.current = null;
      pendingIceCandidatesRef.current = [];
      incomingOfferRef.current = null;
      activeCallRoomRef.current = null;

      localStreamRef.current?.getTracks().forEach((track) => track.stop());
      localStreamRef.current = null;
      remoteStreamRef.current = null;

      setLocalMedia(null);
      setRemoteMedia(null);
      setIsMicMuted(false);
      setIsCameraOff(false);
      setIncomingCall(null);
      setCallDuration(0);
      setCallPhase(nextPhase);
    },
    [stopCallTimer],
  );

  useEffect(() => {
    return () => {
      cleanupCallSession();
      roomChannelsRef.current.forEach((channel) => {
        void supabase.removeChannel(channel);
      });
      roomChannelsRef.current.clear();
    };
  }, [cleanupCallSession]);

  const sendRoomBroadcast = useCallback(async (roomId: string, event: string, payload: Record<string, unknown>) => {
    const channel = roomChannelsRef.current.get(roomId);
    if (!channel) return;

    try {
      await channel.send({ type: "broadcast", event, payload });
    } catch (error) {
      console.error(`Failed to send ${event}`, error);
    }
  }, []);

  const appendMessageToRoom = useCallback(
    (roomId: string, message: CareMessage) => {
      const result = appendStoredMessage(roomId, message);
      if (!result.added) return;

      if (selectedRoomRef.current === roomId) {
        setMessages(result.messages);
        return;
      }

      setUnreadByRoom((current) => ({
        ...current,
        [roomId]: (current[roomId] ?? 0) + 1,
      }));
      toast({
        title: `New message from ${message.senderName}`,
        description: message.body.length > 84 ? `${message.body.slice(0, 84)}...` : message.body,
      });
    },
    [toast],
  );

  const flushPendingIceCandidates = useCallback(async (peerConnection: RTCPeerConnection) => {
    const queuedCandidates = [...pendingIceCandidatesRef.current];
    pendingIceCandidatesRef.current = [];

    for (const candidate of queuedCandidates) {
      try {
        await peerConnection.addIceCandidate(candidate);
      } catch (error) {
        console.error("Unable to add queued ICE candidate", error);
      }
    }
  }, []);

  const createPeerConnection = useCallback(
    (roomId: string) => {
      const peerConnection = new RTCPeerConnection({ iceServers: ICE_SERVERS });

      peerConnection.onicecandidate = (event) => {
        if (!event.candidate || !user) return;

        void sendRoomBroadcast(roomId, "ice-candidate", {
          from: user.id,
          candidate: event.candidate.toJSON(),
        });
      };

      peerConnection.ontrack = (event) => {
        const [incomingStream] = event.streams;
        if (incomingStream) {
          remoteStreamRef.current = incomingStream;
          setRemoteMedia(incomingStream);
          return;
        }

        if (!remoteStreamRef.current) {
          remoteStreamRef.current = new MediaStream();
        }

        remoteStreamRef.current.addTrack(event.track);
        setRemoteMedia(new MediaStream(remoteStreamRef.current.getTracks()));
      };

      peerConnection.onconnectionstatechange = () => {
        if (peerConnection.connectionState === "connected") {
          setCallPhase("connected");
          startCallTimer();
          return;
        }

        if (
          peerConnection.connectionState === "failed" ||
          peerConnection.connectionState === "disconnected" ||
          peerConnection.connectionState === "closed"
        ) {
          if (callPhaseRef.current === "idle") return;
          cleanupCallSession("ended");
        }
      };

      peerConnectionRef.current = peerConnection;
      return peerConnection;
    },
    [cleanupCallSession, sendRoomBroadcast, startCallTimer, user],
  );

  const ensureLocalMedia = useCallback(async () => {
    if (!navigator.mediaDevices?.getUserMedia) {
      throw new Error("This browser does not support camera and microphone access.");
    }

    if (localStreamRef.current) return localStreamRef.current;

    const stream = await navigator.mediaDevices.getUserMedia({ audio: true, video: true });
    localStreamRef.current = stream;
    setLocalMedia(stream);
    setIsMicMuted(false);
    setIsCameraOff(false);
    return stream;
  }, []);

  const handleIncomingOffer = useCallback(
    async (roomId: string, payload: OfferPayload, target: ConversationTarget) => {
      if (!user || payload.from === user.id) return;

      if (
        callPhaseRef.current === "incoming" ||
        callPhaseRef.current === "calling" ||
        callPhaseRef.current === "connecting" ||
        callPhaseRef.current === "connected"
      ) {
        await sendRoomBroadcast(roomId, "call-declined", {
          from: user.id,
          reason: "busy",
        });
        return;
      }

      pendingIceCandidatesRef.current = [];
      incomingOfferRef.current = payload.sdp;
      activeCallRoomRef.current = roomId;
      setSelectedTargetId(target.id);
      setIncomingCall({
        roomId,
        callerName: payload.callerName,
        callerRole: payload.callerRole,
        from: payload.from,
      });
      setCallPhase("incoming");
    },
    [sendRoomBroadcast, user],
  );

  const handleIncomingAnswer = useCallback(
    async (payload: AnswerPayload) => {
      if (!user || payload.from === user.id || !peerConnectionRef.current) return;

      try {
        await peerConnectionRef.current.setRemoteDescription(payload.sdp);
        await flushPendingIceCandidates(peerConnectionRef.current);
      } catch (error) {
        console.error("Unable to set remote answer", error);
        cleanupCallSession("ended");
      }
    },
    [cleanupCallSession, flushPendingIceCandidates, user],
  );

  const handleIncomingIceCandidate = useCallback(async (payload: IcePayload) => {
    if (!payload.candidate) return;

    if (!peerConnectionRef.current || !peerConnectionRef.current.remoteDescription) {
      pendingIceCandidatesRef.current.push(payload.candidate);
      return;
    }

    try {
      await peerConnectionRef.current.addIceCandidate(payload.candidate);
    } catch (error) {
      console.error("Unable to add ICE candidate", error);
    }
  }, []);

  useEffect(() => {
    roomChannelsRef.current.forEach((channel) => {
      void supabase.removeChannel(channel);
    });
    roomChannelsRef.current.clear();
    setConnectedRooms({});
    setOnlineByTargetId({});

    if (!user || targets.length === 0) return;

    const channels = new Map<string, ReturnType<typeof supabase.channel>>();

    targets.forEach((target) => {
      const channel = supabase.channel(target.roomId, {
        config: {
          presence: { key: String(user.id) },
        },
      });

      channel
        .on("broadcast", { event: "chat-message" }, ({ payload }) => {
          const message = payload as CareMessage;
          if (message.senderId === user.id) return;
          appendMessageToRoom(target.roomId, message);
        })
        .on("broadcast", { event: "video-offer" }, ({ payload }) => {
          void handleIncomingOffer(target.roomId, payload as OfferPayload, target);
        })
        .on("broadcast", { event: "video-answer" }, ({ payload }) => {
          void handleIncomingAnswer(payload as AnswerPayload);
        })
        .on("broadcast", { event: "ice-candidate" }, ({ payload }) => {
          const icePayload = payload as IcePayload;
          if (icePayload.from === user.id) return;
          void handleIncomingIceCandidate(icePayload);
        })
        .on("broadcast", { event: "call-hangup" }, ({ payload }) => {
          const endPayload = payload as CallEndPayload;
          if (!user || endPayload.from === user.id) return;

          cleanupCallSession("ended");
        })
        .on("broadcast", { event: "call-declined" }, ({ payload }) => {
          const declinePayload = payload as CallEndPayload;
          if (!user || declinePayload.from === user.id) return;

          cleanupCallSession("declined");
        })
        .on("presence", { event: "sync" }, () => {
          const presenceState = channel.presenceState<RoomPresence>();
          const activeUsers = Object.values(presenceState).flat();
          const isCounterpartOnline = activeUsers.some((presence) => Number(presence.userId) === target.id);

          setOnlineByTargetId((current) => ({
            ...current,
            [target.id]: isCounterpartOnline,
          }));
        })
        .subscribe((status) => {
          if (status !== "SUBSCRIBED") return;

          setConnectedRooms((current) => ({ ...current, [target.roomId]: true }));
          void channel.track({
            userId: user.id,
            name: user.name,
            role: user.role as CareRole,
            roomId: target.roomId,
            onlineAt: new Date().toISOString(),
          });
        });

      channels.set(target.roomId, channel);
    });

    roomChannelsRef.current = channels;

    return () => {
      channels.forEach((channel) => {
        void supabase.removeChannel(channel);
      });
      roomChannelsRef.current = new Map();
    };
  }, [
    appendMessageToRoom,
    cleanupCallSession,
    handleIncomingAnswer,
    handleIncomingIceCandidate,
    handleIncomingOffer,
    targets,
    user,
  ]);

  const handleSendMessage = async (event?: FormEvent) => {
    event?.preventDefault();
    if (!user || !selectedTarget || !selectedRoomId) return;

    const body = draft.trim();
    if (!body) return;

    if (!canSendRealtime) {
      toast({
        title: "Realtime chat is offline",
        description: `${selectedTarget.name} needs to be active in Care Chat to receive live messages.`,
        variant: "destructive",
      });
      return;
    }

    const message: CareMessage = {
      id: crypto.randomUUID(),
      roomId: selectedRoomId,
      senderId: user.id,
      senderName: user.name,
      senderRole: user.role as CareRole,
      body,
      createdAt: new Date().toISOString(),
    };

    appendMessageToRoom(selectedRoomId, message);
    setDraft("");

    await sendRoomBroadcast(selectedRoomId, "chat-message", message);
  };

  const handleDraftKeyDown = (event: KeyboardEvent<HTMLTextAreaElement>) => {
    if (event.key !== "Enter" || event.shiftKey) return;

    event.preventDefault();
    void handleSendMessage();
  };

  const startVideoCall = useCallback(async () => {
    if (!user || !selectedTarget || !selectedRoomId) return;

    if (!canSendRealtime) {
      toast({
        title: "Video call unavailable",
        description: `${selectedTarget.name} needs to be online in Care Chat before a live call can start.`,
        variant: "destructive",
      });
      return;
    }

    try {
      setCallPhase("connecting");
      activeCallRoomRef.current = selectedRoomId;
      pendingIceCandidatesRef.current = [];

      const stream = await ensureLocalMedia();
      const peerConnection = createPeerConnection(selectedRoomId);
      stream.getTracks().forEach((track) => peerConnection.addTrack(track, stream));

      const offer = await peerConnection.createOffer();
      await peerConnection.setLocalDescription(offer);
      setCallPhase("calling");

      await sendRoomBroadcast(selectedRoomId, "video-offer", {
        from: user.id,
        callerName: user.name,
        callerRole: user.role as CareRole,
        sdp: offer,
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unable to start the video call.";
      cleanupCallSession();
      toast({ title: "Video call failed", description: message, variant: "destructive" });
    }
  }, [
    canSendRealtime,
    cleanupCallSession,
    createPeerConnection,
    ensureLocalMedia,
    selectedRoomId,
    selectedTarget,
    sendRoomBroadcast,
    toast,
    user,
  ]);

  const acceptIncomingCall = useCallback(async () => {
    if (!user || !incomingCall || !incomingOfferRef.current) return;

    try {
      setCallPhase("connecting");
      const stream = await ensureLocalMedia();
      const peerConnection = createPeerConnection(incomingCall.roomId);
      activeCallRoomRef.current = incomingCall.roomId;
      stream.getTracks().forEach((track) => peerConnection.addTrack(track, stream));

      await peerConnection.setRemoteDescription(incomingOfferRef.current);
      await flushPendingIceCandidates(peerConnection);

      const answer = await peerConnection.createAnswer();
      await peerConnection.setLocalDescription(answer);
      setIncomingCall(null);

      await sendRoomBroadcast(incomingCall.roomId, "video-answer", {
        from: user.id,
        sdp: answer,
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unable to accept the incoming call.";
      cleanupCallSession();
      toast({ title: "Unable to join call", description: message, variant: "destructive" });
    }
  }, [
    cleanupCallSession,
    createPeerConnection,
    ensureLocalMedia,
    flushPendingIceCandidates,
    incomingCall,
    sendRoomBroadcast,
    toast,
    user,
  ]);

  const declineIncomingCall = useCallback(async () => {
    if (!user || !incomingCall) {
      cleanupCallSession();
      return;
    }

    await sendRoomBroadcast(incomingCall.roomId, "call-declined", {
      from: user.id,
      reason: "declined",
    });
    cleanupCallSession();
  }, [cleanupCallSession, incomingCall, sendRoomBroadcast, user]);

  const hangupCall = useCallback(async () => {
    if (!user) {
      cleanupCallSession();
      return;
    }

    const roomId = activeCallRoomRef.current ?? selectedRoomRef.current;
    if (roomId) {
      await sendRoomBroadcast(roomId, "call-hangup", {
        from: user.id,
      });
    }

    cleanupCallSession("ended");
  }, [cleanupCallSession, sendRoomBroadcast, user]);

  const closeCallDialog = useCallback(() => {
    cleanupCallSession();
  }, [cleanupCallSession]);

  const toggleMicrophone = () => {
    if (!localStreamRef.current) return;

    const shouldMute = !isMicMuted;
    localStreamRef.current.getAudioTracks().forEach((track) => {
      track.enabled = !shouldMute;
    });
    setIsMicMuted(shouldMute);
  };

  const toggleCamera = () => {
    if (!localStreamRef.current) return;

    const shouldDisableCamera = !isCameraOff;
    localStreamRef.current.getVideoTracks().forEach((track) => {
      track.enabled = !shouldDisableCamera;
    });
    setIsCameraOff(shouldDisableCamera);
  };

  return (
    <>
      <div className="animate-fade-in flex flex-col gap-8">
        <header className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <h1 className="text-4xl tracking-tight">Care Chat</h1>
            <p className="mt-2 text-muted-foreground">
              Realtime care coordination between patients and health workers, with live video when both sides are ready.
            </p>
          </div>

          <div className="rounded-2xl border border-border/70 bg-card px-4 py-3 text-sm text-muted-foreground">
            Live sync works while both people are active in Care Chat. Recent messages are cached on this device for quick context.
          </div>
        </header>

        <div className="grid gap-6 xl:grid-cols-[320px,minmax(0,1fr)]">
          <aside className="card-elevated flex flex-col gap-4 p-5">
            <div className="flex items-center gap-3">
              <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-primary/10">
                <MessageSquare className="h-5 w-5 text-primary" />
              </div>
              <div>
                <h2 className="text-lg font-medium">
                  {isUser ? "Linked Health Worker" : "Patient Threads"}
                </h2>
                <p className="text-sm text-muted-foreground">
                  {isUser ? "Open your direct care channel." : "Stay reachable for live patient support."}
                </p>
              </div>
            </div>

            {loadingTargets && (
              <div className="flex items-center gap-3 rounded-2xl border border-border/70 px-4 py-5 text-sm text-muted-foreground">
                <Loader2 className="h-4 w-4 animate-spin" />
                Connecting your care rooms...
              </div>
            )}

            {!loadingTargets && targets.length === 0 && (
              <div className="rounded-2xl border border-dashed border-border/70 px-4 py-5 text-sm text-muted-foreground">
                {availabilityMessage || "No care threads are available yet."}
              </div>
            )}

            {!loadingTargets && targets.length > 0 && (
              <div className="flex flex-col gap-3">
                {targets.map((target) => {
                  const isSelected = target.id === selectedTargetId;
                  const unreadCount = unreadByRoom[target.roomId] ?? 0;
                  const isOnline = onlineByTargetId[target.id];
                  const disableSwitch = callIsActive && !isSelected;

                  return (
                    <button
                      key={target.roomId}
                      type="button"
                      disabled={disableSwitch}
                      onClick={() => setSelectedTargetId(target.id)}
                      className={cn(
                        "rounded-3xl border px-4 py-4 text-left transition-all",
                        isSelected
                          ? "border-primary/40 bg-primary/5 shadow-sm"
                          : "border-border/70 bg-background hover:border-primary/20",
                        disableSwitch && "cursor-not-allowed opacity-60",
                      )}
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <div className="flex items-center gap-2">
                            <span className="truncate font-medium">{target.name}</span>
                            <Badge variant={target.role === "community_health_worker" ? "default" : "secondary"}>
                              {roleLabel(target.role)}
                            </Badge>
                          </div>
                          <p className="mt-1 text-sm text-muted-foreground">{target.subtitle}</p>
                          {target.detail && (
                            <p className="mt-1 text-xs text-muted-foreground">{target.detail}</p>
                          )}
                          {target.riskLevel && (
                            <div className="mt-3">
                              <Badge className={riskBadgeClasses(target.riskLevel)}>
                                {target.riskLevel} risk
                              </Badge>
                            </div>
                          )}
                        </div>

                        <div className="flex flex-col items-end gap-2">
                          <span className="flex items-center gap-2 text-xs text-muted-foreground">
                            <span
                              className={cn(
                                "h-2.5 w-2.5 rounded-full",
                                isOnline ? "bg-green-500" : "bg-muted-foreground/30",
                              )}
                            />
                            {isOnline ? "online" : "offline"}
                          </span>
                          {unreadCount > 0 && (
                            <span className="rounded-full bg-primary px-2 py-0.5 text-xs font-medium text-primary-foreground">
                              {unreadCount}
                            </span>
                          )}
                        </div>
                      </div>
                    </button>
                  );
                })}
              </div>
            )}

            {isUser && linkedCHW?.linked && !linkedCHW.chw_user_id && (
              <div className="rounded-2xl border border-dashed border-amber-500/40 bg-amber-500/5 px-4 py-4 text-sm text-muted-foreground">
                Your current CHW link is not tied to a registered AfyaMind account yet. Re-link to a registered health worker to enable live chat and video.
              </div>
            )}
          </aside>

          <section className="card-elevated flex min-h-[680px] flex-col overflow-hidden p-0">
            {selectedTarget ? (
              <>
                <div className="flex flex-col gap-4 border-b border-border/60 px-6 py-5 md:flex-row md:items-center md:justify-between">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <h2 className="text-2xl font-medium">{selectedTarget.name}</h2>
                      <Badge variant={selectedTarget.role === "community_health_worker" ? "default" : "secondary"}>
                        {roleLabel(selectedTarget.role)}
                      </Badge>
                      <span className="flex items-center gap-2 text-sm text-muted-foreground">
                        <span
                          className={cn(
                            "h-2.5 w-2.5 rounded-full",
                            isSelectedTargetOnline ? "bg-green-500" : "bg-muted-foreground/30",
                          )}
                        />
                        {isSelectedTargetOnline ? "Active in Care Chat" : "Not currently active"}
                      </span>
                    </div>
                    <div className="mt-2 flex flex-wrap items-center gap-3 text-sm text-muted-foreground">
                      {selectedTarget.detail && (
                        <span className="flex items-center gap-2">
                          <MapPin className="h-4 w-4" />
                          {selectedTarget.detail}
                        </span>
                      )}
                      <span>{selectedTarget.subtitle}</span>
                    </div>
                  </div>

                  <div className="flex flex-wrap items-center gap-3">
                    <Button
                      variant="outline"
                      className="rounded-full gap-2"
                      disabled={!canSendRealtime || callIsActive}
                      onClick={() => void startVideoCall()}
                    >
                      <Video className="h-4 w-4" />
                      Start Video Call
                    </Button>
                  </div>
                </div>

                <div className="flex-1 overflow-y-auto px-6 py-5">
                  {messages.length === 0 ? (
                    <div className="flex h-full flex-col items-center justify-center rounded-3xl border border-dashed border-border/70 px-6 py-10 text-center text-muted-foreground">
                      <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-primary/10">
                        {selectedTarget.role === "community_health_worker" ? (
                          <ShieldCheck className="h-7 w-7 text-primary" />
                        ) : (
                          <User className="h-7 w-7 text-primary" />
                        )}
                      </div>
                      <h3 className="text-lg font-medium text-foreground">Ready for live care support</h3>
                      <p className="mt-2 max-w-xl">
                        Messages here are labeled by role so it is always clear when the health worker is replying. Start the conversation once both sides are online.
                      </p>
                    </div>
                  ) : (
                    <div className="flex flex-col gap-4">
                      {messages.map((message) => {
                        const isOwn = user?.id === message.senderId;

                        return (
                          <div
                            key={message.id}
                            className={cn(
                              "flex flex-col gap-2",
                              isOwn ? "items-end" : "items-start",
                            )}
                          >
                            <div
                              className={cn(
                                "max-w-[85%] rounded-3xl px-4 py-3 shadow-sm",
                                isOwn
                                  ? "bg-primary text-primary-foreground"
                                  : "border border-border/70 bg-background",
                              )}
                            >
                              <div
                                className={cn(
                                  "mb-2 flex flex-wrap items-center gap-2 text-xs",
                                  isOwn ? "text-primary-foreground/85" : "text-muted-foreground",
                                )}
                              >
                                <Badge
                                  variant={message.senderRole === "community_health_worker" ? "default" : "secondary"}
                                  className="shadow-none"
                                >
                                  {roleLabel(message.senderRole)}
                                </Badge>
                                <span className="font-medium">{message.senderName}</span>
                                <span>{formatMessageTime(message.createdAt)}</span>
                              </div>
                              <p className="whitespace-pre-wrap text-sm leading-6">{message.body}</p>
                            </div>
                          </div>
                        );
                      })}
                      <div ref={messageEndRef} />
                    </div>
                  )}
                </div>

                <div className="border-t border-border/60 px-6 py-5">
                  {!canSendRealtime && (
                    <div className="mb-3 flex items-start gap-3 rounded-2xl border border-amber-500/40 bg-amber-500/5 px-4 py-3 text-sm text-muted-foreground">
                      <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-amber-600" />
                      <span>
                        {selectedTarget.name} needs to be active in Care Chat for live messaging and video to work.
                      </span>
                    </div>
                  )}

                  <form className="flex flex-col gap-3" onSubmit={(event) => void handleSendMessage(event)}>
                    <Textarea
                      value={draft}
                      onChange={(event) => setDraft(event.target.value)}
                      onKeyDown={handleDraftKeyDown}
                      disabled={!selectedTarget}
                      placeholder={
                        canSendRealtime
                          ? `Message ${selectedTarget.name}...`
                          : "Waiting for the other person to come online in Care Chat..."
                      }
                      className="min-h-[120px] rounded-3xl border-border/80 px-4 py-3"
                    />

                    <div className="flex flex-wrap items-center justify-between gap-3">
                      <p className="text-sm text-muted-foreground">
                        {isRoomConnected
                          ? "Realtime room connected."
                          : "Connecting to the realtime room..."}
                      </p>

                      <Button
                        type="submit"
                        className="rounded-full gap-2 px-5"
                        disabled={!draft.trim() || !canSendRealtime}
                      >
                        <Send className="h-4 w-4" />
                        Send Live Message
                      </Button>
                    </div>
                  </form>
                </div>
              </>
            ) : (
              <div className="flex h-full flex-col items-center justify-center px-6 py-10 text-center text-muted-foreground">
                <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-primary/10">
                  <MessageSquare className="h-7 w-7 text-primary" />
                </div>
                <h2 className="text-2xl font-medium text-foreground">No active care thread yet</h2>
                <p className="mt-2 max-w-2xl">
                  {availabilityMessage || "Select a linked health worker or patient to open the direct realtime care workspace."}
                </p>
              </div>
            )}
          </section>
        </div>
      </div>

      <CareVideoCallDialog
        open={callPhase !== "idle"}
        phase={callPhase}
        participantName={incomingCall?.callerName || selectedTarget?.name || "Care contact"}
        participantRoleLabel={roleLabel(incomingCall?.callerRole || selectedTarget?.role || "community_health_worker")}
        localVideoRef={localVideoRef}
        remoteVideoRef={remoteVideoRef}
        durationSeconds={callDuration}
        isMicMuted={isMicMuted}
        isCameraOff={isCameraOff}
        onAccept={() => void acceptIncomingCall()}
        onDecline={() => void declineIncomingCall()}
        onHangup={() => void hangupCall()}
        onClose={closeCallDialog}
        onToggleMic={toggleMicrophone}
        onToggleCamera={toggleCamera}
      />
    </>
  );
}

function buildRoomId(firstUserId: number, secondUserId: number) {
  const [smallestId, largestId] = [firstUserId, secondUserId].sort((left, right) => left - right);
  return `care-room-${smallestId}-${largestId}`;
}

function roleLabel(role: CareRole) {
  return role === "community_health_worker" ? "Health Worker" : "Patient";
}

function formatMessageTime(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;

  return date.toLocaleTimeString("en-US", {
    hour: "numeric",
    minute: "2-digit",
  });
}

function formatDateTime(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;

  return date.toLocaleString("en-US", {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

function readRoomMessages(roomId: string) {
  if (typeof window === "undefined") return [];

  try {
    const raw = window.localStorage.getItem(storageKey(roomId));
    if (!raw) return [];

    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];

    return parsed.filter(isCareMessage).slice(-STORED_MESSAGE_LIMIT);
  } catch {
    return [];
  }
}

function appendStoredMessage(roomId: string, message: CareMessage) {
  const currentMessages = readRoomMessages(roomId);
  if (currentMessages.some((entry) => entry.id === message.id)) {
    return { messages: currentMessages, added: false };
  }

  const nextMessages = writeRoomMessages(roomId, [...currentMessages, message]);
  return { messages: nextMessages, added: true };
}

function writeRoomMessages(roomId: string, messages: CareMessage[]) {
  const trimmedMessages = messages.slice(-STORED_MESSAGE_LIMIT);
  if (typeof window !== "undefined") {
    window.localStorage.setItem(storageKey(roomId), JSON.stringify(trimmedMessages));
  }
  return trimmedMessages;
}

function storageKey(roomId: string) {
  return `afyamind-care-chat:${roomId}`;
}

function isCareMessage(value: unknown): value is CareMessage {
  if (!value || typeof value !== "object") return false;

  const candidate = value as Record<string, unknown>;
  return (
    typeof candidate.id === "string" &&
    typeof candidate.roomId === "string" &&
    typeof candidate.senderId === "number" &&
    typeof candidate.senderName === "string" &&
    typeof candidate.senderRole === "string" &&
    typeof candidate.body === "string" &&
    typeof candidate.createdAt === "string"
  );
}

function riskBadgeClasses(level: string) {
  switch (level) {
    case "high":
      return "bg-destructive/10 text-destructive border-destructive/20";
    case "medium":
      return "bg-amber-500/10 text-amber-700 border-amber-500/20";
    default:
      return "bg-sage/20 text-foreground border-border";
  }
}
