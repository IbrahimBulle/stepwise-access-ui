import { useState, useEffect } from "react";
import { api } from "@/lib/api";
import { Users, AlertTriangle } from "lucide-react";

export default function Caseload() {
  const [caseload, setCaseload] = useState<any>(null);

  useEffect(() => {
    api.getCHWCaseload().then(setCaseload).catch(console.error);
  }, []);

  const riskColor = (level: string) => {
    switch (level) {
      case "high": return "bg-destructive/10 text-destructive";
      case "medium": return "bg-sun/50 text-foreground";
      default: return "bg-sage/20 text-foreground";
    }
  };

  return (
    <div className="animate-fade-in flex flex-col gap-8">
      <header>
        <h1 className="text-4xl tracking-tight">Your Caseload</h1>
        <p className="text-muted-foreground mt-2">
          {caseload ? `${caseload.total_patients} patients assigned to you` : "Loading..."}
        </p>
      </header>

      <div className="flex flex-col gap-3">
        {caseload?.patients?.map((p: any) => (
          <div key={p.patient_id} className="card-elevated p-6 flex items-center justify-between">
            <div className="flex items-center gap-4">
              <div className="w-10 h-10 rounded-full bg-secondary flex items-center justify-center text-sm font-medium">
                {p.patient_name?.charAt(0)?.toUpperCase()}
              </div>
              <div>
                <div className="font-medium">{p.patient_name}</div>
                <div className="text-sm text-muted-foreground">
                  {p.region} · {p.total_checkins} check-ins
                </div>
              </div>
            </div>
            <div className="flex items-center gap-3">
              {p.last_risk_level === "high" && <AlertTriangle className="h-4 w-4 text-destructive" />}
              <span className={`text-xs px-3 py-1 rounded-full font-medium capitalize ${riskColor(p.last_risk_level)}`}>
                {p.last_risk_level}
              </span>
            </div>
          </div>
        ))}

        {caseload?.patients?.length === 0 && (
          <div className="text-center py-12 text-muted-foreground">
            <Users className="h-12 w-12 mx-auto mb-4 opacity-50" />
            <p>No patients assigned yet.</p>
          </div>
        )}
      </div>
    </div>
  );
}
