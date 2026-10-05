import { lazy, Suspense, useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { Beaker, Clock3, ExternalLink, Github, Pencil, Play, Trash2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { isMentor } from "@/lib/auth";
import { useToast } from "@/hooks/use-toast";
import type { Lab, LabSubmission, LabWithSubmissions } from "@shared/schema";

const PythonLabRunner = lazy(() => import("./python-lab-runner"));

interface LabsListProps {
  labs: LabWithSubmissions[];
  onEdit?: (lab: Lab) => void;
  onDelete?: (labId: number) => void;
}

const difficultyLabels = {
  BEGINNER: "Débutant",
  INTERMEDIATE: "Intermédiaire",
  ADVANCED: "Avancé",
};

const statusLabels: Record<LabSubmission["status"], string> = {
  IN_PROGRESS: "En cours",
  SUBMITTED: "À valider",
  APPROVED: "Validé",
  CHANGES_REQUESTED: "À corriger",
};

export function LabsList({ labs, onEdit, onDelete }: LabsListProps) {
  const [activeLab, setActiveLab] = useState<LabWithSubmissions | null>(null);
  const [feedbacks, setFeedbacks] = useState<Record<number, string>>({});
  const { toast } = useToast();

  const reviewMutation = useMutation({
    mutationFn: ({ id, decision, feedback }: { id: number; decision: "APPROVE" | "REQUEST_CHANGES"; feedback: string | null }) =>
      apiRequest("POST", `/api/lab-submissions/${id}/review`, { decision, feedback }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/weeks"] });
      toast({ title: "Évaluation enregistrée" });
    },
  });

  if (labs.length === 0) {
    return <Card className="p-6 text-center text-sm text-muted-foreground"><Beaker className="mx-auto mb-2 h-10 w-10" />Aucun lab pour cette semaine</Card>;
  }

  return (
    <>
      <div className="grid gap-3 md:grid-cols-2">
        {labs.map((lab) => {
          const submission = lab.submissions[0];
          return (
            <Card key={lab.id} className="p-4" data-testid={`card-lab-${lab.id}`}>
              <div className="flex items-start justify-between gap-3">
                <div>
                  <div className="mb-2 flex flex-wrap gap-2">
                    <Badge variant="secondary">{difficultyLabels[lab.difficulty]}</Badge>
                    <Badge variant="outline"><Clock3 className="mr-1 h-3 w-3" />{lab.estimatedMinutes} min</Badge>
                    {!lab.isPublished && <Badge variant="outline">Brouillon</Badge>}
                    {submission && <Badge>{statusLabels[submission.status]}</Badge>}
                  </div>
                  <h4 className="font-semibold">{lab.title}</h4>
                  {lab.description && <p className="mt-1 text-sm text-muted-foreground">{lab.description}</p>}
                </div>
                {isMentor() && (
                  <div className="flex gap-1">
                    <Button size="icon" variant="ghost" onClick={() => onEdit?.(lab)} aria-label={`Modifier ${lab.title}`}><Pencil className="h-4 w-4" /></Button>
                    <Button size="icon" variant="ghost" className="text-destructive" onClick={() => onDelete?.(lab.id)} aria-label={`Supprimer ${lab.title}`}><Trash2 className="h-4 w-4" /></Button>
                  </div>
                )}
              </div>

              <div className="mt-4 flex flex-wrap gap-2">
                {!isMentor() && <Button size="sm" onClick={() => setActiveLab(lab)}><Play className="mr-2 h-4 w-4" />Ouvrir le lab</Button>}
                {lab.repositoryUrl && <Button size="sm" variant="outline" asChild><a href={lab.repositoryUrl} target="_blank" rel="noreferrer"><Github className="mr-2 h-4 w-4" />Dépôt</a></Button>}
                {lab.launchUrl && <Button size="sm" variant="outline" asChild><a href={lab.launchUrl} target="_blank" rel="noreferrer"><ExternalLink className="mr-2 h-4 w-4" />Environnement</a></Button>}
              </div>

              {isMentor() && lab.submissions.length > 0 && (
                <div className="mt-4 space-y-2 border-t pt-3">
                  <p className="text-sm font-medium">Soumissions ({lab.submissions.length})</p>
                  {lab.submissions.map((item) => (
                    <div key={item.id} className="space-y-2 rounded-md bg-muted/40 p-3 text-sm">
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <span>Apprenant #{item.learnerId} · {statusLabels[item.status]}</span>
                        <details>
                          <summary className="cursor-pointer text-primary">Voir la solution</summary>
                          <pre className="mt-2 max-h-48 overflow-auto whitespace-pre-wrap rounded bg-background p-2 text-xs">{item.code}</pre>
                          {item.output && <pre className="mt-2 max-h-32 overflow-auto whitespace-pre-wrap rounded bg-background p-2 text-xs">{item.output}</pre>}
                        </details>
                      </div>
                      {item.status === "SUBMITTED" && (
                        <div className="space-y-2">
                          <Textarea
                            className="min-h-20 bg-background"
                            placeholder="Retour au sujet de cette solution (optionnel)"
                            value={feedbacks[item.id] || ""}
                            onChange={(event) => setFeedbacks((current) => ({ ...current, [item.id]: event.target.value }))}
                          />
                          <div className="flex gap-2">
                            <Button size="sm" variant="outline" onClick={() => reviewMutation.mutate({ id: item.id, decision: "REQUEST_CHANGES", feedback: feedbacks[item.id]?.trim() || null })}>À corriger</Button>
                            <Button size="sm" onClick={() => reviewMutation.mutate({ id: item.id, decision: "APPROVE", feedback: feedbacks[item.id]?.trim() || null })}>Valider</Button>
                          </div>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </Card>
          );
        })}
      </div>

      <Dialog open={Boolean(activeLab)} onOpenChange={(open) => !open && setActiveLab(null)}>
        <DialogContent className="max-h-[92vh] max-w-4xl overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{activeLab?.title}</DialogTitle>
            <DialogDescription>{activeLab?.description || "Mettez la notion en pratique et passez les tests."}</DialogDescription>
          </DialogHeader>
          {activeLab && (
            <Suspense fallback={<div className="p-8 text-center text-sm text-muted-foreground">Chargement de la sandbox Python…</div>}>
              <PythonLabRunner lab={activeLab} submission={activeLab.submissions[0]} />
            </Suspense>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}
