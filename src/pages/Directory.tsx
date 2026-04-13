import { useState, useEffect } from "react";
import { api } from "@/lib/api";
import { Users } from "lucide-react";

export default function Directory() {
  const [directory, setDirectory] = useState<any[]>([]);

  useEffect(() => {
    api.getCHWDirectory().then(setDirectory).catch(console.error);
  }, []);

  return (
    <div className="animate-fade-in flex flex-col gap-8">
      <header>
        <h1 className="text-4xl tracking-tight">CHW Directory</h1>
        <p className="text-muted-foreground mt-2">All community health workers.</p>
      </header>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {directory.map((chw: any, i: number) => (
          <div key={i} className="card-elevated p-6 flex items-start gap-4">
            <div className="w-10 h-10 rounded-full bg-sage/20 flex items-center justify-center text-sm font-medium shrink-0">
              {chw.name?.charAt(0)?.toUpperCase()}
            </div>
            <div className="min-w-0">
              <div className="font-medium">{chw.name}</div>
              <div className="text-sm text-muted-foreground">{chw.region}</div>
              <div className="text-xs text-muted-foreground mt-1">
                {chw.caseload_count} patients · {chw.is_registered ? "Registered" : "Manual"}
              </div>
            </div>
          </div>
        ))}
      </div>

      {directory.length === 0 && (
        <div className="text-center py-12 text-muted-foreground">
          <Users className="h-12 w-12 mx-auto mb-4 opacity-50" />
          <p>No CHWs found.</p>
        </div>
      )}
    </div>
  );
}
