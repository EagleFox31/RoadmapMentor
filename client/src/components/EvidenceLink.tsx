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
      className="flex items-center gap-1 text-xs text-primary hover:underline disabled:opacity-50"
      data-testid={testId}
    >
      <ImageIcon className="w-3 h-3" />
      {loading ? "Ouverture..." : "Voir la capture"}
    </button>
  );
}
