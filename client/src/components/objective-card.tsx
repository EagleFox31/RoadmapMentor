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

const objectiveColors = {
  CONCEPT: "from-blue-500 to-indigo-500",
  ALGO: "from-purple-500 to-pink-500",
  PROJECT: "from-orange-500 to-red-500",
  OTHER: "from-gray-500 to-slate-500",
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
  const gradientClass = objectiveColors[objective.type as keyof typeof objectiveColors];
  const typeLabel = objectiveTypeLabels[objective.type as keyof typeof objectiveTypeLabels];

  return (
    <Card className="bg-white/10 backdrop-blur-xl border border-white/20 rounded-2xl p-6 shadow-xl hover:-translate-y-1 hover:shadow-2xl transition-all duration-200 group">
      <div className="flex items-start justify-between mb-4">
        <div className="flex items-center gap-3">
          <div className={`w-12 h-12 rounded-xl bg-gradient-to-br ${gradientClass} flex items-center justify-center shadow-lg group-hover:scale-110 transition-transform`}>
            <Icon className="w-6 h-6 text-white" />
          </div>
          <div>
            <Badge variant="secondary" className="mb-1 bg-white/10 text-white border-white/20 text-xs">
              {typeLabel}
            </Badge>
            <h3 className="text-white font-bold text-lg">{objective.title}</h3>
          </div>
        </div>

        {isMentor() && (
          <div className="flex gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
            <Button
              size="icon"
              variant="ghost"
              onClick={() => onEditObjective?.(objective)}
              className="bg-white/10 hover:bg-white/20 text-white border border-white/20 h-8 w-8"
              data-testid={`button-edit-objective-${objective.id}`}
            >
              <Pencil className="w-4 h-4" />
            </Button>
            <Button
              size="icon"
              variant="ghost"
              onClick={() => onDeleteObjective?.(objective.id)}
              className="bg-red-500/20 hover:bg-red-500/30 text-red-200 border border-red-400/20 h-8 w-8"
              data-testid={`button-delete-objective-${objective.id}`}
            >
              <Trash2 className="w-4 h-4" />
            </Button>
          </div>
        )}
      </div>

      {objective.description && (
        <p className="text-white/80 text-sm mb-4 leading-relaxed">
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
          className="w-full mt-4 bg-white/5 border-white/20 text-white hover:bg-white/10 transition-all"
          data-testid={`button-add-task-${objective.id}`}
        >
          + Ajouter une tâche
        </Button>
      )}
    </Card>
  );
}
