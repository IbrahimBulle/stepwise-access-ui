import { useState, useEffect } from "react";
import { api } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { Phone, Calendar, User, Clock } from "lucide-react";
import VoiceCall from "@/components/VoiceCall";

export default function Appointments() {
  const { toast } = useToast();
  const [appointments, setAppointments] = useState<any[]>([]);
  const [therapist, setTherapist] = useState("");
  const [sessionMode, setSessionMode] = useState("in_person");
  const [appointmentTime, setAppointmentTime] = useState("");
  const [loading, setLoading] = useState(false);
  const [activeCall, setActiveCall] = useState<{ id: number; therapist: string } | null>(null);

  useEffect(() => {
    api.getAppointments().then(setAppointments).catch(console.error);
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      await api.createAppointment({ therapist, session_mode: sessionMode, appointment_time: appointmentTime });
      toast({ title: "Appointment booked!" });
      setTherapist("");
      setAppointmentTime("");
      const updated = await api.getAppointments();
      setAppointments(updated);
    } catch (err: any) {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  const handleCall = (appointment: any) => {
    setActiveCall({ id: appointment.id, therapist: appointment.therapist });
  };

  return (
    <div className="animate-fade-in flex flex-col gap-8">
      <header>
        <h1 className="text-4xl tracking-tight">Appointments</h1>
        <p className="text-muted-foreground mt-2">Book and manage your therapy sessions.</p>
      </header>

      <div className="card-elevated p-8">
        <form onSubmit={handleSubmit} className="flex flex-col gap-5">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            <div className="space-y-2">
              <Label>Therapist Name</Label>
              <Input value={therapist} onChange={(e) => setTherapist(e.target.value)} placeholder="Dr. Smith" required className="rounded-2xl h-12" />
            </div>
            <div className="space-y-2">
              <Label>Date & Time</Label>
              <Input type="datetime-local" value={appointmentTime} onChange={(e) => setAppointmentTime(e.target.value)} required className="rounded-2xl h-12" />
            </div>
          </div>
          <div className="space-y-2">
            <Label>Session Mode</Label>
            <div className="flex gap-3">
              {["in_person", "video", "phone"].map((mode) => (
                <button
                  key={mode}
                  type="button"
                  onClick={() => setSessionMode(mode)}
                  className={`px-5 py-2.5 rounded-2xl border text-sm font-medium transition-all capitalize ${
                    sessionMode === mode ? "border-primary bg-primary/5 text-foreground" : "border-border text-muted-foreground hover:border-primary/30"
                  }`}
                >
                  {mode.replace("_", " ")}
                </button>
              ))}
            </div>
          </div>
          <Button type="submit" disabled={loading} className="rounded-2xl h-11 self-end px-8">
            {loading ? "Booking..." : "Book Appointment"}
          </Button>
        </form>
      </div>

      <div className="flex flex-col gap-3">
        {appointments.map((a: any) => (
          <div key={a.id} className="card-elevated p-6 flex items-center justify-between">
            <div className="flex items-center gap-4">
              <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                <User className="h-5 w-5 text-primary" />
              </div>
              <div>
                <div className="font-medium">{a.therapist}</div>
                <div className="text-sm text-muted-foreground flex items-center gap-2">
                  <Calendar className="h-3.5 w-3.5" />
                  {a.appointment_time}
                  <span className="capitalize">· {a.session_mode?.replace("_", " ")}</span>
                </div>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <Button
                variant="outline"
                size="sm"
                className="rounded-full gap-2 border-primary/30 text-primary hover:bg-primary/5"
                onClick={() => handleCall(a)}
              >
                <Phone className="h-3.5 w-3.5" />
                Call
              </Button>
              <span className={`text-xs px-3 py-1 rounded-full font-medium ${
                a.status === "booked" ? "bg-primary/10 text-primary" : "bg-secondary text-secondary-foreground"
              }`}>
                {a.status}
              </span>
            </div>
          </div>
        ))}
      </div>

      {/* Voice Call Modal */}
      {activeCall && (
        <VoiceCall
          appointmentId={activeCall.id}
          therapistName={activeCall.therapist}
          onClose={() => setActiveCall(null)}
        />
      )}
    </div>
  );
}
