import { useState } from "react";
import { Image as ImageIcon } from "lucide-react";
import { getAuthToken } from "@/lib/auth";
import { useToast } from "@/hooks/use-toast";

interface EvidenceLinkProps {
  taskId: number;
  learnerId: number;
  testId: string;
}

/** Fetches evidence with Authorization; never exposes session tokens in URLs. */
export function EvidenceLink({ taskId, learnerId, testId }: EvidenceLinkProps) {
  const [loading, setLoading] = useState(false);
  const { toast } = useToast();

  const open = async () => {
    if (loading) return;
    const token = getAuthToken();
    if (!token) {
      toast({ title: "Session expirée", description: "Reconnectez-vous pour consulter la preuve.", variant: "destructive" });
      return;
    }

    // Opening synchronously prevents popup blocking after the authenticated fetch.
    const tab = window.open("about:blank", "_blank");
    if (tab) tab.opener = null;
    setLoading(true);
    try {
      const response = await fetch(`/api/tasks/${taskId}/evidence/${learnerId}`, {
        headers: { Authorization: `Bearer ${token}` },
        cache: "no-store",
      });
      if (!response.ok) throw new Error("Evidence request failed");
      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      if (tab && !tab.closed) {
        tab.location.replace(url);
      } else {
        // Fallback if the browser blocks new tabs: save the authorized image.
        const a = document.createElement("a");
        a.href = url;
        a.download = `preuve-${taskId}.png`;
        a.click();
      }
      window.setTimeout(() => URL.revokeObjectURL(url), 60_000);
    } catch {
      tab?.close();
      toast({ title: "Capture indisponible", description: "Accès refusé ou image introuvable.", variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  return (
    <button
      type="button"
      disabled={loading}
      onClick={open}
      className="flex items-center gap-1 text-xs text-primary hover:underline disabled:opacity-50"
      data-testid={testId}
    >
      <ImageIcon className="w-3 h-3" />
      {loading ? "Ouverture..." : "Voir la capture"}
    </button>
  );
}
