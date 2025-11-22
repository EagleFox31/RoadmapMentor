import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { BookOpen, Code, Wrench, FileText, Pencil, Trash2 } from "lucide-react";
import { TaskList } from "./task-list";
import type { ObjectiveWithTasks } from "@shared/schema";
import { isMentor } from "@/lib/auth";

interface ObjectiveCardProps {
  objective: ObjectiveWithTasks;
  onToggleTask?: (taskId: number) => void;
  onEditObjective?: (objective: ObjectiveWithTasks) => void;
  onDeleteObjective?: (objectiveId: number) => void;
  onAddTask?: (objectiveId: number) => void;
  onEditTask?: (taskId: number) => void;
  onDeleteTask?: (taskId: number) => void;
}

const objectiveIcons = {
  CONCEPT: BookOpen,
  ALGO: Code,
  PROJECT: Wrench,
  OTHER: FileText,
};

const objectiveColorClasses = {
  CONCEPT: "bg-primary",
  ALGO: "bg-accent",
  PROJECT: "bg-destructive",
  OTHER: "bg-muted",
};

const objectiveTypeLabels = {
  CONCEPT: "Concept à Maîtriser",
  ALGO: "Exercices Algo",
  PROJECT: "Projet",
  OTHER: "Autre",
};

export function ObjectiveCard({
  objective,
  onToggleTask,
  onEditObjective,
  onDeleteObjective,
  onAddTask,
  onEditTask,
  onDeleteTask,
}: ObjectiveCardProps) {
  const Icon = objectiveIcons[objective.type as keyof typeof objectiveIcons] || FileText;
  const colorClass = objectiveColorClasses[objective.type as keyof typeof objectiveColorClasses];
  const typeLabel = objectiveTypeLabels[objective.type as keyof typeof objectiveTypeLabels];

  return (
    <Card className="bg-card rounded-xl p-6 shadow-md hover:shadow-lg transition-shadow group">
      <div className="flex items-start justify-between mb-4">
        <div className="flex items-center gap-3">
          <div className={`w-12 h-12 rounded-lg flex items-center justify-center shadow-sm ${colorClass}`}>
            <Icon className="w-6 h-6 text-white" />
          </div>
          <div>
            <Badge className="mb-1 text-xs bg-muted border-0">
              {typeLabel}
            </Badge>
            <h3 className="text-foreground font-bold text-base">{objective.title}</h3>
          </div>
        </div>

        {isMentor() && (
          <div className="flex gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
            <Button
              size="icon"
              variant="ghost"
              onClick={() => onEditObjective?.(objective)}
              className="h-8 w-8"
              data-testid={`button-edit-objective-${objective.id}`}
            >
              <Pencil className="w-4 h-4" />
            </Button>
            <Button
              size="icon"
              variant="ghost"
              onClick={() => onDeleteObjective?.(objective.id)}
              className="bg-destructive/10 text-destructive h-8 w-8"
              data-testid={`button-delete-objective-${objective.id}`}
            >
              <Trash2 className="w-4 h-4" />
            </Button>
          </div>
        )}
      </div>

      {objective.description && (
        <p className="text-muted-foreground text-sm mb-4 leading-relaxed">
          {objective.description}
        </p>
      )}

      <TaskList
        tasks={objective.tasks}
        onToggleTask={onToggleTask}
        onEditTask={onEditTask}
        onDeleteTask={onDeleteTask}
      />

      {isMentor() && (
        <Button
          onClick={() => onAddTask?.(objective.id)}
          variant="outline"
          className="w-full mt-4"
          data-testid={`button-add-task-${objective.id}`}
        >
          + Ajouter une tâche
        </Button>
      )}
    </Card>
  );
}
