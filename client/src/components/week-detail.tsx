import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Calendar, CheckCircle2, Plus, Pencil, Trash2 } from "lucide-react";
import { ObjectiveCard } from "./objective-card";
import { DeliverablesList } from "./deliverables-list";
import { ResourcesList } from "./resources-list";
import { LabsList } from "./labs-list";
import { WeekComments } from "./week-comments";
import type { WeekWithDetails, ObjectiveWithTasks, Deliverable, Resource, Lab } from "@shared/schema";
import { isMentor } from "@/lib/auth";

interface WeekDetailProps {
  week: WeekWithDetails | null;
  onToggleTask?: (taskId: number, screenshotUrl?: string) => void;
  onAddComment?: (content: string) => void;
  onEditWeek?: () => void;
  onDeleteWeek?: () => void;
  onCloneWeek?: () => void;
  onValidateWeek?: () => void;
  onAddObjective?: () => void;
  onEditObjective?: (objective: ObjectiveWithTasks) => void;
  onDeleteObjective?: (objectiveId: number) => void;
  onCloneObjective?: (objectiveId: number) => void;
  onAddTask?: (objectiveId: number) => void;
  onEditTask?: (taskId: number) => void;
  onDeleteTask?: (taskId: number) => void;
  onAddDeliverable?: () => void;
  onEditDeliverable?: (deliverable: Deliverable) => void;
  onDeleteDeliverable?: (deliverableId: number) => void;
  onAddResource?: () => void;
  onEditResource?: (resource: Resource) => void;
  onDeleteResource?: (resourceId: number) => void;
  onAddLab?: () => void;
  onEditLab?: (lab: Lab) => void;
  onDeleteLab?: (labId: number) => void;
  isLoadingComment?: boolean;
}

export function WeekDetail({
  week,
  onToggleTask,
  onAddComment,
  onEditWeek,
  onDeleteWeek,
  onCloneWeek,
  onValidateWeek,
  onAddObjective,
  onEditObjective,
  onDeleteObjective,
  onCloneObjective,
  onAddTask,
  onEditTask,
  onDeleteTask,
  onAddDeliverable,
  onEditDeliverable,
  onDeleteDeliverable,
  onAddResource,
  onEditResource,
  onDeleteResource,
  onAddLab,
  onEditLab,
  onDeleteLab,
  isLoadingComment,
}: WeekDetailProps) {
  if (!week) {
    return (
      <Card className="bg-card rounded-xl p-12 shadow-md text-center">
        <Calendar className="w-16 h-16 text-muted-foreground mx-auto mb-4" />
        <h3 className="text-foreground text-xl font-bold mb-2">Sélectionnez une semaine</h3>
        <p className="text-muted-foreground">
          Choisissez une semaine dans la liste de gauche pour voir les détails
        </p>
      </Card>
    );
  }

  const objectivesByType = {
    CONCEPT: week.objectives.filter(obj => obj.type === "CONCEPT"),
    ALGO: week.objectives.filter(obj => obj.type === "ALGO"),
    PROJECT: week.objectives.filter(obj => obj.type === "PROJECT"),
    OTHER: week.objectives.filter(obj => obj.type === "OTHER"),
  };

  const formatHumanDates = (start?: string, end?: string) => {
    if (!start || !end) return "";
    try {
      const s = new Date(start);
      const e = new Date(end);
      if (isNaN(s.getTime()) || isNaN(e.getTime())) return `${start} — ${end}`;
      const sFmt = new Intl.DateTimeFormat("fr-FR", { day: "numeric", month: "long" });
      const eFmt = new Intl.DateTimeFormat("fr-FR", { day: "numeric", month: "long", year: "numeric" });
      return `Du ${sFmt.format(s)} au ${eFmt.format(e)}`;
    } catch {
      return `${start} — ${end}`;
    }
  };

  return (
    <div className="space-y-6">
      {/* Week Hero Header */}
      <Card className="glass-card rounded-3xl p-6 sm:p-8 border border-border/70 shadow-sm relative overflow-hidden group">
        {/* Subtle decorative glowing background */}
        <div className="absolute top-0 right-0 w-80 h-80 bg-gradient-to-bl from-emerald-500/10 via-teal-500/5 to-transparent rounded-full blur-3xl pointer-events-none" />

        <div className="relative z-10 flex flex-col md:flex-row md:items-start md:justify-between gap-4">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2.5 flex-wrap mb-2.5">
              <span className="inline-flex items-center text-xs font-bold px-3 py-1 rounded-full bg-primary text-primary-foreground shadow-sm">
                Semaine {week.number}
              </span>
              {week.isValidatedByMentor && (
                <span className="inline-flex items-center gap-1.5 text-xs font-semibold px-2.5 py-1 rounded-full bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 border border-emerald-500/20">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                  Validée par le mentor
                </span>
              )}
              {week.startDate && week.endDate && (
                <span className="inline-flex items-center gap-1.5 text-xs text-muted-foreground font-medium bg-muted/60 px-2.5 py-1 rounded-full">
                  <Calendar className="w-3.5 h-3.5 text-muted-foreground/70" />
                  {formatHumanDates(week.startDate, week.endDate)}
                </span>
              )}
            </div>

            <h2 className="text-2xl sm:text-3xl font-extrabold text-foreground tracking-tight leading-tight mb-2.5">
              {week.title}
            </h2>

            {week.description && (
              <p className="text-foreground/80 text-sm sm:text-base leading-relaxed max-w-3xl">
                {week.description}
              </p>
            )}
          </div>

          {isMentor() && (
            <div className="flex items-center gap-2 flex-wrap flex-shrink-0 self-start pt-1">
              <Button
                onClick={onCloneWeek}
                size="sm"
                variant="outline"
                className="rounded-xl border-border/70 hover:bg-muted font-medium text-xs h-9 px-3 gap-1.5"
                data-testid="button-clone-week"
              >
                <Plus className="w-3.5 h-3.5" />
                Dupliquer
              </Button>
              {!week.isValidatedByMentor && (
                <Button
                  onClick={onValidateWeek}
                  size="sm"
                  className="bg-emerald-600 hover:bg-emerald-700 text-white font-medium rounded-xl text-xs h-9 px-3 gap-1.5 shadow-sm"
                  data-testid="button-validate-week"
                >
                  <CheckCircle2 className="w-3.5 h-3.5" />
                  Valider
                </Button>
              )}
              <Button
                size="icon"
                variant="outline"
                onClick={onEditWeek}
                className="rounded-xl border-border/70 text-muted-foreground hover:text-foreground h-9 w-9"
                data-testid="button-edit-week"
                aria-label="Modifier la semaine"
              >
                <Pencil className="w-3.5 h-3.5" />
              </Button>
              <Button
                size="icon"
                variant="outline"
                onClick={onDeleteWeek}
                className="rounded-xl bg-destructive/10 border-destructive/20 text-destructive hover:bg-destructive/20 h-9 w-9"
                data-testid="button-delete-week"
                aria-label="Supprimer la semaine"
              >
                <Trash2 className="w-3.5 h-3.5" />
              </Button>
            </div>
          )}
        </div>
      </Card>

      {/* Objectives */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <h3 className="text-xl font-bold text-foreground">Objectifs</h3>
          {isMentor() && (
            <Button
              onClick={onAddObjective}
              className="bg-primary text-white"
              data-testid="button-add-objective"
            >
              <Plus className="w-4 h-4 mr-2" />
              Ajouter un objectif
            </Button>
          )}
        </div>

        {week.objectives.length === 0 ? (
          <Card className="bg-card rounded-xl p-8 shadow-sm text-center">
            <p className="text-muted-foreground">Aucun objectif défini pour cette semaine</p>
          </Card>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-[repeat(auto-fit,minmax(22rem,1fr))] gap-6">
            {week.objectives.map((objective) => (
              <ObjectiveCard
                key={objective.id}
                objective={objective}
                onToggleTask={onToggleTask}
                onEditObjective={onEditObjective}
                onDeleteObjective={onDeleteObjective}
                onCloneObjective={onCloneObjective}
                onAddTask={onAddTask}
                onEditTask={onEditTask}
                onDeleteTask={onDeleteTask}
              />
            ))}
          </div>
        )}
      </div>

      {/* Guided labs */}
      <div className="space-y-3">
        <div className="flex items-center justify-between gap-3">
          <div>
            <h3 className="text-xl font-bold text-foreground">Labs pratiques</h3>
            <p className="text-sm text-muted-foreground">Testez les nouvelles notions dans un exercice court et guidé.</p>
          </div>
          {isMentor() && (
            <Button onClick={onAddLab} className="bg-teal-600 text-white" data-testid="button-add-lab">
              <Plus className="w-4 h-4 mr-2" />Ajouter un lab
            </Button>
          )}
        </div>
        <LabsList labs={week.labs || []} onEdit={onEditLab} onDelete={onDeleteLab} />
      </div>

      {/* Deliverables */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <h3 className="text-xl font-bold text-foreground">Livrables Attendus</h3>
          {isMentor() && (
            <Button
              onClick={onAddDeliverable}
              className="bg-success text-success-foreground"
              data-testid="button-add-deliverable"
            >
              <Plus className="w-4 h-4 mr-2" />
              Ajouter un livrable
            </Button>
          )}
        </div>
        <DeliverablesList
          deliverables={week.deliverables}
          onEdit={onEditDeliverable}
          onDelete={onDeleteDeliverable}
        />
      </div>

      {/* Resources */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <h3 className="text-xl font-bold text-foreground">Ressources Recommandées</h3>
          {isMentor() && (
            <Button
              onClick={onAddResource}
              className="bg-warning text-warning-foreground"
              data-testid="button-add-resource"
            >
              <Plus className="w-4 h-4 mr-2" />
              Ajouter une ressource
            </Button>
          )}
        </div>
        <ResourcesList
          weekId={week.id}
          resources={week.resources}
          onEdit={onEditResource}
          onDelete={onDeleteResource}
        />
      </div>

      {/* Comments */}
      <WeekComments
        comments={week.comments}
        onAddComment={onAddComment}
        isLoading={isLoadingComment}
      />
    </div>
  );
}
