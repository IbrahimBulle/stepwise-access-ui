import { useState, useEffect } from "react";
import { api } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/contexts/AuthContext";

const rooms = ["general", "anxiety", "depression", "wellness", "caregivers"];

export default function Community() {
  const { toast } = useToast();
  const { user } = useAuth();
  const [room, setRoom] = useState("general");
  const [messages, setMessages] = useState<any[]>([]);
  const [newMessage, setNewMessage] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    api.getCommunityMessages(room).then(setMessages).catch(console.error);
  }, [room]);

  const handleSend = async () => {
    if (!newMessage.trim()) return;
    setLoading(true);
    try {
      await api.createCommunityMessage({ room, message: newMessage });
      setNewMessage("");
      const updated = await api.getCommunityMessages(room);
      setMessages(updated);
    } catch (err: any) {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="animate-fade-in flex flex-col gap-6 h-[calc(100vh-7rem)]">
      <header>
        <h1 className="text-4xl tracking-tight">Community</h1>
        <p className="text-muted-foreground mt-2">Connect with others on similar journeys.</p>
      </header>

      {/* Room tabs */}
      <div className="flex gap-2 flex-wrap">
        {rooms.map((r) => (
          <button
            key={r}
            onClick={() => setRoom(r)}
            className={`px-4 py-2 rounded-2xl text-sm font-medium transition-all capitalize ${
              room === r ? "bg-primary text-primary-foreground" : "bg-secondary text-muted-foreground hover:bg-secondary/80"
            }`}
          >
            {r}
          </button>
        ))}
      </div>

      {/* Messages */}
      <div className="card-elevated flex-1 overflow-y-auto p-6 flex flex-col gap-3">
        {messages.length === 0 && (
          <p className="text-center text-muted-foreground py-8">No messages yet. Start the conversation!</p>
        )}
        {messages.map((m: any) => (
          <div key={m.id} className={`flex flex-col gap-1 ${m.user_id === user?.id ? "items-end" : "items-start"}`}>
            <div className={`px-4 py-3 rounded-2xl max-w-[80%] ${
              m.user_id === user?.id ? "bg-primary/10 text-foreground" : "bg-secondary text-foreground"
            }`}>
              <p className="text-xs font-medium text-muted-foreground mb-1">{m.user_name || "User"}</p>
              <p className="text-sm">{m.message}</p>
            </div>
          </div>
        ))}
      </div>

      {/* Input */}
      <div className="flex gap-3">
        <Input
          value={newMessage}
          onChange={(e) => setNewMessage(e.target.value)}
          placeholder="Type a message..."
          className="rounded-2xl h-12 flex-1"
          onKeyDown={(e) => e.key === "Enter" && handleSend()}
        />
        <Button onClick={handleSend} disabled={loading || !newMessage.trim()} className="rounded-2xl h-12 px-6">
          Send
        </Button>
      </div>
    </div>
  );
}
