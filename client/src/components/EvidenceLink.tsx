import { useState } from "react";
import { Image as ImageIcon } from "lucide-react";
import { getAuthToken } from "@/lib/auth";
import { openAuthorizedFile } from "@/lib/openAuthorizedFile";
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
    if (!getAuthToken()) {
      toast({ title: "Session expirée", description: "Reconnectez-vous pour consulter la preuve.", variant: "destructive" });
      return;
    }

    setLoading(true);
    try {
      await openAuthorizedFile(`/api/tasks/${taskId}/evidence/${learnerId}`, `preuve-${taskId}.png`);
    } catch {
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
      className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 border border-emerald-500/20 hover:bg-emerald-500/20 transition-all disabled:opacity-50 shadow-2xs group"
      data-testid={testId}
    >
      <ImageIcon className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400 group-hover:scale-110 transition-transform" />
      <span>{loading ? "Ouverture..." : "Voir la preuve"}</span>
    </button>
  );
}
