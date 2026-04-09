import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { Plus, Trash2, FileSpreadsheet, LogOut, Loader2, Zap } from "lucide-react";
import { formatDistanceToNow } from "date-fns";

interface SpreadsheetRow {
  id: string;
  name: string;
  updated_at: string;
}

export default function Dashboard() {
  const { user, loading, signInWithGoogle, signOut } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();
  const [sheets, setSheets] = useState<SpreadsheetRow[]>([]);
  const [fetching, setFetching] = useState(false);

  useEffect(() => {
    if (user) fetchSheets();
  }, [user]);

  const fetchSheets = async () => {
    setFetching(true);
    const { data, error } = await supabase
      .from("spreadsheets")
      .select("id, name, updated_at")
      .order("updated_at", { ascending: false });
    if (error) toast({ title: "Error", description: error.message, variant: "destructive" });
    else setSheets(data ?? []);
    setFetching(false);
  };

  const createNew = async () => {
    const { data, error } = await supabase
      .from("spreadsheets")
      .insert({ user_id: user!.id, name: "Untitled Spreadsheet", data: [] })
      .select("id")
      .single();
    if (error) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
      return;
    }
    navigate(`/editor?id=${data.id}`);
  };

  const deleteSheet = async (id: string) => {
    await supabase.from("spreadsheets").delete().eq("id", id);
    setSheets((s) => s.filter((x) => x.id !== id));
    toast({ title: "Deleted" });
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-screen bg-background">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  // Sample cards for the blurred background
  const sampleCards = Array.from({ length: 6 }, (_, i) => (
    <div key={i} className="bg-card rounded-xl border border-border p-6 space-y-3">
      <div className="flex items-center gap-3">
        <FileSpreadsheet className="h-8 w-8 text-primary/60" />
        <div>
          <div className="h-4 w-32 bg-muted rounded" />
          <div className="h-3 w-20 bg-muted rounded mt-2" />
        </div>
      </div>
    </div>
  ));

  return (
    <div className="min-h-screen bg-background relative">
      {/* Header */}
      <header className="border-b border-border bg-card shadow-sm">
        <div className="max-w-5xl mx-auto px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="bg-primary/10 p-1.5 rounded-lg">
              <Zap className="h-5 w-5 text-primary" />
            </div>
            <span className="text-sm font-bold tracking-tight text-foreground uppercase">GridMind AI</span>
          </div>
          {user && (
            <div className="flex items-center gap-3">
              <span className="text-xs text-muted-foreground">{user.email}</span>
              <Button variant="ghost" size="sm" onClick={signOut} className="gap-2 text-xs">
                <LogOut className="h-3.5 w-3.5" /> Sign Out
              </Button>
            </div>
          )}
        </div>
      </header>

      {/* Content */}
      <main className="max-w-5xl mx-auto px-6 py-10">
        {user ? (
          <>
            <div className="flex items-center justify-between mb-8">
              <h1 className="text-2xl font-bold text-foreground">My Spreadsheets</h1>
              <Button onClick={createNew} className="gap-2">
                <Plus className="h-4 w-4" /> New Spreadsheet
              </Button>
            </div>

            {fetching ? (
              <div className="flex justify-center py-20">
                <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
              </div>
            ) : sheets.length === 0 ? (
              <div className="text-center py-20 text-muted-foreground">
                <FileSpreadsheet className="h-12 w-12 mx-auto mb-4 opacity-40" />
                <p>No spreadsheets yet. Create your first one!</p>
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                {sheets.map((s) => (
                  <div
                    key={s.id}
                    className="bg-card rounded-xl border border-border p-5 hover:shadow-md transition-shadow cursor-pointer group"
                    onClick={() => navigate(`/editor?id=${s.id}`)}
                  >
                    <div className="flex items-start justify-between">
                      <div className="flex items-center gap-3">
                        <FileSpreadsheet className="h-8 w-8 text-primary/70" />
                        <div>
                          <p className="font-medium text-sm text-foreground">{s.name}</p>
                          <p className="text-xs text-muted-foreground mt-1">
                            {formatDistanceToNow(new Date(s.updated_at), { addSuffix: true })}
                          </p>
                        </div>
                      </div>
                      <Button
                        variant="ghost"
                        size="icon-sm"
                        className="opacity-0 group-hover:opacity-100 transition-opacity"
                        onClick={(e) => { e.stopPropagation(); deleteSheet(s.id); }}
                      >
                        <Trash2 className="h-3.5 w-3.5 text-destructive" />
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </>
        ) : (
          /* Not logged in — blurred dashboard with overlay */
          <>
            <div className="mb-8">
              <h1 className="text-2xl font-bold text-foreground">My Spreadsheets</h1>
            </div>
            <div className="relative">
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 blur-md pointer-events-none select-none">
                {sampleCards}
              </div>

              {/* Overlay */}
              <div className="absolute inset-0 flex items-center justify-center">
                <div className="bg-card/95 backdrop-blur-sm border border-border rounded-2xl p-10 shadow-2xl text-center max-w-sm">
                  <div className="bg-primary/10 p-3 rounded-full w-fit mx-auto mb-5">
                    <Zap className="h-8 w-8 text-primary" />
                  </div>
                  <h2 className="text-lg font-bold text-foreground mb-2">Welcome to GridMind AI</h2>
                  <p className="text-sm text-muted-foreground mb-6">
                    Sign in to save and access your spreadsheets from anywhere.
                  </p>
                  <div className="space-y-3">
                    <Button className="w-full gap-2" onClick={signInWithGoogle}>
                      <svg className="h-4 w-4" viewBox="0 0 24 24"><path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z" fill="#4285F4"/><path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/><path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/><path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/></svg>
                      Sign in with Google
                    </Button>
                    <Button
                      variant="outline"
                      className="w-full"
                      onClick={() => navigate("/editor?guest=true")}
                    >
                      Use Without Account
                    </Button>
                  </div>
                </div>
              </div>
            </div>
          </>
        )}
      </main>
    </div>
  );
}
