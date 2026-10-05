import { useEffect, useMemo, useState } from "react";
import { PythonProvider, usePython } from "react-py";
import { useMutation } from "@tanstack/react-query";
import { Play, Save, Send, Square } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import type { Lab, LabSubmission } from "@shared/schema";

interface PythonLabRunnerProps {
  lab: Lab;
  submission?: LabSubmission;
}

function Runner({ lab, submission }: PythonLabRunnerProps) {
  const [code, setCode] = useState(submission?.code || lab.starterCode || "");
  const [hasRun, setHasRun] = useState(false);
  const { runPython, stdout, stderr, isLoading, isReady, isRunning, interruptExecution } = usePython();
  const { toast } = useToast();

  useEffect(() => {
    setCode(submission?.code || lab.starterCode || "");
    setHasRun(false);
  }, [lab.id, lab.starterCode, submission?.code]);

  const executableCode = useMemo(
    () => [code, lab.testCode].filter(Boolean).join("\n\n# Tests du lab\n"),
    [code, lab.testCode],
  );
  const output = [stdout, stderr].filter(Boolean).join("\n").slice(0, 20000);

  const saveMutation = useMutation({
    mutationFn: async (submit: boolean) => apiRequest("PUT", `/api/labs/${lab.id}/submission`, {
      code,
      output: output || null,
      submit,
    }),
    onSuccess: (_data, submit) => {
      queryClient.invalidateQueries({ queryKey: ["/api/weeks"] });
      toast({
        title: submit ? "Lab envoyé" : "Brouillon enregistré",
        description: submit ? "Le mentor peut maintenant examiner votre solution." : "Vous pourrez reprendre ce lab plus tard.",
      });
    },
  });

  const execute = async () => {
    setHasRun(false);
    await runPython(executableCode);
    setHasRun(true);
  };

  return (
    <div className="space-y-4">
      <div className="rounded-lg border bg-muted/30 p-3 text-sm whitespace-pre-wrap">{lab.instructions}</div>
      <div className="space-y-2">
        <label htmlFor={`lab-code-${lab.id}`} className="text-sm font-medium">Votre code Python</label>
        <Textarea id={`lab-code-${lab.id}`} className="min-h-64 font-mono text-sm" spellCheck={false} value={code} onChange={(event) => setCode(event.target.value)} />
      </div>

      <div className="flex flex-wrap gap-2">
        {isRunning ? (
          <Button type="button" variant="destructive" onClick={interruptExecution}><Square className="mr-2 h-4 w-4" />Arrêter</Button>
        ) : (
          <Button type="button" onClick={execute} disabled={!isReady || isLoading || !code.trim()}>
            <Play className="mr-2 h-4 w-4" />
            {isLoading ? "Chargement de Python..." : "Exécuter les tests"}
          </Button>
        )}
        <Button type="button" variant="outline" onClick={() => saveMutation.mutate(false)} disabled={saveMutation.isPending}>
          <Save className="mr-2 h-4 w-4" />Enregistrer
        </Button>
        <Button type="button" variant="secondary" onClick={() => saveMutation.mutate(true)} disabled={saveMutation.isPending || !hasRun || Boolean(stderr)}>
          <Send className="mr-2 h-4 w-4" />Envoyer au mentor
        </Button>
      </div>

      {(hasRun || stdout || stderr) && (
        <div className={`rounded-lg border p-3 font-mono text-sm whitespace-pre-wrap ${stderr ? "border-destructive/40 bg-destructive/5" : "border-green-500/40 bg-green-500/5"}`}>
          <p className="mb-2 font-sans font-semibold">{stderr ? "Tests à corriger" : "Tests réussis"}</p>
          {output || "Le programme s’est terminé sans sortie."}
        </div>
      )}
      {submission?.mentorFeedback && (
        <div className="rounded-lg border border-amber-500/40 bg-amber-500/5 p-3 text-sm">
          <strong>Retour du mentor :</strong> {submission.mentorFeedback}
        </div>
      )}
    </div>
  );
}

export default function PythonLabRunner(props: PythonLabRunnerProps) {
  return <PythonProvider lazy timeout={30_000}><Runner {...props} /></PythonProvider>;
}
