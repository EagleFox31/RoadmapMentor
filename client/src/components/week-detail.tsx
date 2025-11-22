import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Calendar, CheckCircle2, Plus, Pencil, Trash2 } from "lucide-react";
import { ObjectiveCard } from "./objective-card";
import { DeliverablesList } from "./deliverables-list";
import { ResourcesList } from "./resources-list";
import { WeekComments } from "./week-comments";
import type { WeekWithDetails, ObjectiveWithTasks, Deliverable, Resource } from "@shared/schema";
import { isMentor } from "@/lib/auth";

interface WeekDetailProps {
  week: WeekWithDetails | null;
  onToggleTask?: (taskId: number) => void;
  onAddComment?: (content: string) => void;
  onEditWeek?: () => void;
  onDeleteWeek?: () => void;
  onCloneWeek?: () => void;
  onValidateWeek?: () => void;
  onAddObjective?: () => void;
  onEditObjective?: (objective: ObjectiveWithTasks) => void;
  onDeleteObjective?: (objectiveId: number) => void;
  onAddTask?: (objectiveId: number) => void;
  onEditTask?: (taskId: number) => void;
  onDeleteTask?: (taskId: number) => void;
  onAddDeliverable?: () => void;
  onEditDeliverable?: (deliverable: Deliverable) => void;
  onDeleteDeliverable?: (deliverableId: number) => void;
  onAddResource?: () => void;
  onEditResource?: (resource: Resource) => void;
  onDeleteResource?: (resourceId: number) => void;
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
  onAddTask,
  onEditTask,
  onDeleteTask,
  onAddDeliverable,
  onEditDeliverable,
  onDeleteDeliverable,
  onAddResource,
  onEditResource,
  onDeleteResource,
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

  return (
    <div className="space-y-4">
      {/* Week Header */}
      <Card className="bg-card rounded-xl p-6 shadow-md">
        <div className="flex items-start justify-between mb-4">
          <div className="flex-1">
            <div className="flex items-center gap-3 mb-2">
              <Badge className="bg-primary text-white border-0">
                Semaine {week.number}
              </Badge>
              {week.isValidatedByMentor && (
                <Badge className="bg-success/10 text-success border-0">
                  <CheckCircle2 className="w-3 h-3 mr-1" />
                  Validée
                </Badge>
              )}
            </div>
            <h2 className="text-2xl font-bold text-foreground mb-2">{week.title}</h2>
            <div className="flex items-center gap-2 text-muted-foreground text-sm">
              <Calendar className="w-4 h-4" />
              <span>{week.startDate} - {week.endDate}</span>
            </div>
            {week.description && (
              <p className="mt-3 text-foreground text-sm leading-relaxed">{week.description}</p>
            )}
          </div>

          {isMentor() && (
            <div className="flex gap-2 ml-4">
              <Button
                onClick={onCloneWeek}
                size="sm"
                variant="outline"
                data-testid="button-clone-week"
              >
                <Plus className="w-4 h-4 mr-1" />
                Dupliquer
              </Button>
              {!week.isValidatedByMentor && (
                <Button
                  onClick={onValidateWeek}
                  className="bg-success text-success-foreground"
                  data-testid="button-validate-week"
                >
                  <CheckCircle2 className="w-4 h-4 mr-2" />
                  Valider
                </Button>
              )}
              <Button
                size="icon"
                variant="outline"
                onClick={onEditWeek}
                data-testid="button-edit-week"
              >
                <Pencil className="w-4 h-4" />
              </Button>
              <Button
                size="icon"
                variant="outline"
                onClick={onDeleteWeek}
                className="bg-destructive/10 border-destructive/30 text-destructive"
                data-testid="button-delete-week"
              >
                <Trash2 className="w-4 h-4" />
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
          <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-4">
            {week.objectives.map((objective) => (
              <ObjectiveCard
                key={objective.id}
                objective={objective}
                onToggleTask={onToggleTask}
                onEditObjective={onEditObjective}
                onDeleteObjective={onDeleteObjective}
                onAddTask={onAddTask}
                onEditTask={onEditTask}
                onDeleteTask={onDeleteTask}
              />
            ))}
          </div>
        )}
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
