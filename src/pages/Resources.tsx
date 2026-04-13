import { useState, useEffect } from "react";
import { api } from "@/lib/api";
import { BookHeart } from "lucide-react";

export default function Resources() {
  const [resources, setResources] = useState<any[]>([]);

  useEffect(() => {
    api.getResources().then(setResources).catch(console.error);
  }, []);

  const categories = [...new Set(resources.map((r: any) => r.category))];

  return (
    <div className="animate-fade-in flex flex-col gap-8">
      <header>
        <h1 className="text-4xl tracking-tight">Resources</h1>
        <p className="text-muted-foreground mt-2">Helpful articles and guides for your wellness journey.</p>
      </header>

      {categories.map((cat) => (
        <div key={cat}>
          <h2 className="text-xl mb-4 capitalize">{cat}</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {resources.filter((r: any) => r.category === cat).map((r: any, i: number) => (
              <div key={i} className="card-elevated p-6 flex gap-4">
                <div className="w-10 h-10 rounded-2xl bg-sage/20 flex items-center justify-center shrink-0">
                  <BookHeart className="h-5 w-5 text-foreground" />
                </div>
                <div>
                  <h3 className="font-medium text-sm">{r.title}</h3>
                  <p className="text-xs text-muted-foreground mt-1">{r.summary}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      ))}

      {resources.length === 0 && (
        <p className="text-muted-foreground text-center py-8">Loading resources...</p>
      )}
    </div>
  );
}
