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

const objectiveGradientClasses = {
  CONCEPT: "bg-gradient-to-br from-primary to-accent",
  ALGO: "bg-gradient-to-br from-accent to-pink-500",
  PROJECT: "bg-gradient-to-br from-destructive to-orange-500",
  OTHER: "bg-gradient-to-br from-muted-foreground to-gray-500",
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
  const gradientClass = objectiveGradientClasses[objective.type as keyof typeof objectiveGradientClasses];
  const typeLabel = objectiveTypeLabels[objective.type as keyof typeof objectiveTypeLabels];

  return (
    <Card className="glass-card rounded-2xl p-7 hover:shadow-2xl hover-elevate transition-all duration-400 group gradient-border">
      <div className="flex items-start justify-between mb-5">
        <div className="flex items-center gap-4">
          <div className={`w-14 h-14 rounded-2xl flex items-center justify-center shadow-xl glow ${gradientClass}`}>
            <Icon className="w-7 h-7 text-white" />
          </div>
          <div>
            <Badge className="mb-2 text-xs glass border-white/20 font-semibold shadow-md">
              {typeLabel}
            </Badge>
            <h3 className="text-foreground font-bold text-lg leading-tight">{objective.title}</h3>
          </div>
        </div>

        {isMentor() && (
          <div className="flex gap-2 opacity-0 group-hover:opacity-100 transition-all duration-300">
            <Button
              size="icon"
              variant="ghost"
              onClick={() => onEditObjective?.(objective)}
              className="glass border-white/20 hover:border-white/30 shadow-lg"
              data-testid={`button-edit-objective-${objective.id}`}
            >
              <Pencil className="w-4 h-4" />
            </Button>
            <Button
              size="icon"
              variant="ghost"
              onClick={() => onDeleteObjective?.(objective.id)}
              className="glass border-destructive/30 text-destructive hover:border-destructive/50 shadow-lg"
              data-testid={`button-delete-objective-${objective.id}`}
            >
              <Trash2 className="w-4 h-4" />
            </Button>
          </div>
        )}
      </div>

      {objective.description && (
        <p className="text-muted-foreground text-sm mb-5 leading-relaxed font-medium">
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
