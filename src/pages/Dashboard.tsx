import { useAuth } from "@/contexts/AuthContext";
import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { api, type DashboardSummary } from "@/lib/api";
import { Heart, Brain, Calendar, MessageCircle, Gift, AlertTriangle, Users } from "lucide-react";

export default function Dashboard() {
  const { user, isUser } = useAuth();
  const [summary, setSummary] = useState<DashboardSummary | null>(null);

  useEffect(() => {
    api.getDashboardSummary().then(setSummary).catch(console.error);
  }, []);

  const statCards = summary ? (
    isUser
      ? [
          {
            icon: <Heart className="h-5 w-5" />,
            label: "Check-ins",
            value: summary.total_checkins || 0,
            color: "bg-clay/20 text-clay-foreground",
          },
          {
            icon: <Calendar className="h-5 w-5" />,
            label: "Appointments",
            value: summary.total_appointments || 0,
            color: "bg-sage/20 text-sage-foreground",
          },
          {
            icon: <MessageCircle className="h-5 w-5" />,
            label: "Community",
            value: summary.total_community_messages || 0,
            color: "bg-sun/40 text-sun-foreground",
          },
          {
            icon: <Gift className="h-5 w-5" />,
            label: "Points",
            value: summary.points || 0,
            color: "bg-primary/10 text-foreground",
          },
        ]
      : [
          {
            icon: <Users className="h-5 w-5" />,
            label: "Patients",
            value: summary.total_checkins || 0,
            color: "bg-clay/20 text-clay-foreground",
          },
          {
            icon: <AlertTriangle className="h-5 w-5" />,
            label: "High Risk",
            value: summary.total_risk_events || 0,
            color: "bg-destructive/10 text-destructive",
          },
          {
            icon: <Calendar className="h-5 w-5" />,
            label: "Appointments",
            value: summary.total_appointments || 0,
            color: "bg-sage/20 text-sage-foreground",
          },
          {
            icon: <MessageCircle className="h-5 w-5" />,
            label: "Community",
            value: summary.total_community_messages || 0,
            color: "bg-sun/40 text-sun-foreground",
          },
        ]
  ) : [];

  const today = new Date().toLocaleDateString("en-US", {
    weekday: "long",
    month: "long",
    day: "numeric",
  });

  return (
    <div className="flex flex-col gap-12 animate-fade-in">
      {/* Greeting */}
      <header>
        <span className="text-sm font-medium text-muted-foreground tracking-wide uppercase">
          {today}
        </span>
        <h1 className="text-4xl lg:text-5xl tracking-tight mt-3">
          Good {getTimeOfDay()}, {user?.name?.split(" ")[0]}.
          <br />
          <span className="text-muted-foreground">
            {isUser ? "How are you feeling today?" : "Your patients need you."}
          </span>
        </h1>
      </header>

      {/* Stats Grid */}
      {summary && (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {statCards.map((card) => (
            <StatCard key={card.label} icon={card.icon} label={card.label} value={card.value} color={card.color} />
          ))}
        </div>
      )}

      {/* Risk Level Banner */}
      {summary?.last_risk_level && summary.last_risk_level !== "low" && isUser && (
        <div className={`card-elevated p-6 flex items-center gap-4 ${
          summary.last_risk_level === "high" ? "border-destructive/30 bg-destructive/5" : "border-accent bg-accent/30"
        }`}>
          <Brain className="h-6 w-6 text-foreground" />
          <div>
            <p className="font-medium">
              Your last risk level: <span className="capitalize">{summary.last_risk_level}</span>
            </p>
            <p className="text-sm text-muted-foreground">
              {summary.last_risk_level === "high"
                ? "Please consider reaching out to your care provider or using the helpline."
                : "Keep monitoring your wellness. You're doing great!"}
            </p>
          </div>
        </div>
      )}

      {isUser && summary && !summary.chw_linked && (
        <div className="card-elevated p-6 flex flex-col gap-4 md:flex-row md:items-center md:justify-between border-primary/20 bg-primary/5">
          <div>
            <p className="font-medium">You have not linked a Community Health Worker yet.</p>
            <p className="text-sm text-muted-foreground mt-1">
              Browse available CHWs and add one to your care team for follow-up support.
            </p>
          </div>
          <Link
            to="/directory"
            className="inline-flex h-11 items-center justify-center rounded-2xl bg-primary px-5 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
          >
            Find CHW Support
          </Link>
        </div>
      )}

      {/* Quick Actions */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {isUser ? (
          <>
            <QuickAction
              title="Daily Check-in"
              description="Log your mood, stress, and sleep to track your wellness journey."
              href="/checkin"
              gradient="from-sun/40 to-card"
            />
            <QuickAction
              title="Write in Journal"
              description="Express your thoughts and feelings in a safe, private space."
              href="/journal"
              gradient="from-sage/20 to-card"
            />
          </>
        ) : (
          <>
            <QuickAction
              title="View Caseload"
              description="Monitor your assigned patients and their wellness status."
              href="/caseload"
              gradient="from-sage/20 to-card"
            />
            <QuickAction
              title="CHW Directory"
              description="Browse all community health workers and their assignments."
              href="/directory"
              gradient="from-sun/40 to-card"
            />
          </>
        )}
      </div>
    </div>
  );
}

function StatCard({ icon, label, value, color }: { icon: React.ReactNode; label: string; value: number; color: string }) {
  return (
    <div className="card-elevated p-6 flex flex-col gap-3">
      <div className={`w-10 h-10 rounded-2xl flex items-center justify-center ${color}`}>
        {icon}
      </div>
      <div>
        <div className="text-3xl font-serif tracking-tight">{value}</div>
        <div className="text-sm text-muted-foreground">{label}</div>
      </div>
    </div>
  );
}

function QuickAction({ title, description, href, gradient }: { title: string; description: string; href: string; gradient: string }) {
  return (
    <a
      href={href}
      className={`card-elevated p-8 bg-gradient-to-b ${gradient} hover:shadow-[0_12px_40px_rgba(66,61,56,0.06)] transition-all group`}
    >
      <h3 className="text-xl mb-2 group-hover:text-primary transition-colors">{title}</h3>
      <p className="text-muted-foreground text-sm">{description}</p>
    </a>
  );
}

function getTimeOfDay() {
  const h = new Date().getHours();
  if (h < 12) return "morning";
  if (h < 17) return "afternoon";
  return "evening";
}
