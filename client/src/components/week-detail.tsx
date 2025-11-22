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
      <Card className="bg-white/10 backdrop-blur-xl border border-white/20 rounded-2xl p-12 shadow-xl text-center">
        <div className="text-6xl mb-4">📅</div>
        <h3 className="text-white text-xl font-bold mb-2">Sélectionnez une semaine</h3>
        <p className="text-white/60">
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
    <div className="space-y-6">
      {/* Week Header */}
      <Card className="bg-white/10 backdrop-blur-xl border border-white/20 rounded-2xl p-6 shadow-xl">
        <div className="flex items-start justify-between mb-4">
          <div className="flex-1">
            <div className="flex items-center gap-3 mb-2">
              <Badge className="bg-gradient-to-r from-sky-500 to-indigo-600 text-white border-0 shadow-md">
                Semaine {week.number}
              </Badge>
              {week.isValidatedByMentor && (
                <Badge variant="secondary" className="bg-gradient-to-r from-green-500/20 to-emerald-600/20 text-green-200 border-green-400/30">
                  <CheckCircle2 className="w-3 h-3 mr-1" />
                  Validée
                </Badge>
              )}
            </div>
            <h2 className="text-2xl font-bold text-white mb-2">{week.title}</h2>
            <div className="flex items-center gap-2 text-white/70 text-sm">
              <Calendar className="w-4 h-4" />
              <span>{week.startDate} - {week.endDate}</span>
            </div>
            {week.description && (
              <p className="mt-3 text-white/80 text-sm leading-relaxed">{week.description}</p>
            )}
          </div>

          {isMentor() && (
            <div className="flex gap-2 ml-4">
              <Button
                onClick={onCloneWeek}
                size="sm"
                variant="outline"
                className="bg-white/10 border-white/20 text-white hover:bg-white/20"
                data-testid="button-clone-week"
              >
                <Plus className="w-4 h-4 mr-1" />
                Dupliquer
              </Button>
              {!week.isValidatedByMentor && (
                <Button
                  onClick={onValidateWeek}
                  className="bg-gradient-to-r from-green-500 to-emerald-600 hover:from-green-600 hover:to-emerald-700 text-white shadow-lg hover:shadow-xl hover:scale-105 transition-all"
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
                className="bg-white/10 border-white/20 text-white hover:bg-white/20"
                data-testid="button-edit-week"
              >
                <Pencil className="w-4 h-4" />
              </Button>
              <Button
                size="icon"
                variant="outline"
                onClick={onDeleteWeek}
                className="bg-red-500/20 border-red-400/20 text-red-200 hover:bg-red-500/30"
                data-testid="button-delete-week"
              >
                <Trash2 className="w-4 h-4" />
              </Button>
            </div>
          )}
        </div>
      </Card>

      {/* Objectives */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="text-xl font-bold text-white">Objectifs</h3>
          {isMentor() && (
            <Button
              onClick={onAddObjective}
              className="bg-gradient-to-r from-sky-500 to-indigo-500 hover:from-sky-600 hover:to-indigo-600 text-white shadow-lg hover:shadow-xl hover:scale-105 transition-all"
              data-testid="button-add-objective"
            >
              <Plus className="w-4 h-4 mr-2" />
              Ajouter un objectif
            </Button>
          )}
        </div>

        {week.objectives.length === 0 ? (
          <Card className="bg-white/5 backdrop-blur-xl border border-white/20 rounded-2xl p-8 text-center">
            <p className="text-white/50">Aucun objectif défini pour cette semaine</p>
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
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="text-xl font-bold text-white">Livrables Attendus</h3>
          {isMentor() && (
            <Button
              onClick={onAddDeliverable}
              className="bg-gradient-to-r from-green-500 to-emerald-600 hover:from-green-600 hover:to-emerald-700 text-white shadow-lg hover:shadow-xl hover:scale-105 transition-all"
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
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="text-xl font-bold text-white">Ressources Recommandées</h3>
          {isMentor() && (
            <Button
              onClick={onAddResource}
              className="bg-gradient-to-r from-amber-500 to-orange-600 hover:from-amber-600 hover:to-orange-700 text-white shadow-lg hover:shadow-xl hover:scale-105 transition-all"
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
