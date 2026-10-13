import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { BookOpen, Code, Wrench, FileText, Pencil, Trash2, Copy, Plus } from "lucide-react";
import { TaskList } from "./task-list";
import type { ObjectiveWithTasks } from "@shared/schema";
import { isMentor } from "@/lib/auth";

interface ObjectiveCardProps {
  objective: ObjectiveWithTasks;
  onToggleTask?: (taskId: number, screenshotUrl?: string) => void;
  onEditObjective?: (objective: ObjectiveWithTasks) => void;
  onDeleteObjective?: (objectiveId: number) => void;
  onCloneObjective?: (objectiveId: number) => void;
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

const objectiveTheme = {
  CONCEPT: {
    iconBox: "bg-blue-500/10 text-blue-600 dark:text-blue-400 border-blue-500/20",
    badge: "border-blue-500/20 bg-blue-500/10 text-blue-700 dark:text-blue-300",
  },
  ALGO: {
    iconBox: "bg-purple-500/10 text-purple-600 dark:text-purple-400 border-purple-500/20",
    badge: "border-purple-500/20 bg-purple-500/10 text-purple-700 dark:text-purple-300",
  },
  PROJECT: {
    iconBox: "bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/20",
    badge: "border-amber-500/20 bg-amber-500/10 text-amber-700 dark:text-amber-300",
  },
  OTHER: {
    iconBox: "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20",
    badge: "border-emerald-500/20 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300",
  },
};

const objectiveTypeLabels = {
  CONCEPT: "Concept clé",
  ALGO: "Exercice Algo",
  PROJECT: "Projet concret",
  OTHER: "Autre",
};

export function ObjectiveCard({
  objective,
  onToggleTask,
  onEditObjective,
  onDeleteObjective,
  onCloneObjective,
  onAddTask,
  onEditTask,
  onDeleteTask,
}: ObjectiveCardProps) {
  const Icon = objectiveIcons[objective.type as keyof typeof objectiveIcons] || FileText;
  const theme = objectiveTheme[objective.type as keyof typeof objectiveTheme] || objectiveTheme.OTHER;
  const typeLabel = objectiveTypeLabels[objective.type as keyof typeof objectiveTypeLabels] || objective.type;

  return (
    <Card 
      className="glass-card rounded-3xl border border-border/70 hover:border-border transition-all duration-300 group shadow-sm hover:shadow-md relative overflow-hidden"
    >
      <div className="p-6">
        <div className="flex items-start justify-between gap-3 mb-4">
          <div className="flex items-center gap-3.5 min-w-0 flex-1">
            <div className={`w-11 h-11 rounded-2xl flex items-center justify-center border shadow-2xs shrink-0 ${theme.iconBox}`}>
              <Icon className="w-5 h-5" />
            </div>
            <div className="min-w-0 flex-1">
              <span className={`inline-block mb-1 text-[11px] font-bold px-2.5 py-0.5 rounded-full border ${theme.badge}`}>
                {typeLabel}
              </span>
              <h3 className="text-foreground font-bold text-base sm:text-lg leading-snug tracking-tight">
                {objective.title}
              </h3>
            </div>
          </div>

          {isMentor() && (
            <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity shrink-0">
              <Button
                size="icon"
                variant="ghost"
                onClick={() => onCloneObjective?.(objective.id)}
                className="h-8 w-8 rounded-lg hover:bg-muted text-muted-foreground hover:text-foreground"
                data-testid={`button-clone-objective-${objective.id}`}
                aria-label="Dupliquer l'objectif"
              >
                <Copy className="w-3.5 h-3.5" />
              </Button>
              <Button
                size="icon"
                variant="ghost"
                onClick={() => onEditObjective?.(objective)}
                className="h-8 w-8 rounded-lg hover:bg-muted text-muted-foreground hover:text-foreground"
                data-testid={`button-edit-objective-${objective.id}`}
                aria-label="Modifier l'objectif"
              >
                <Pencil className="w-3.5 h-3.5" />
              </Button>
              <Button
                size="icon"
                variant="ghost"
                onClick={() => onDeleteObjective?.(objective.id)}
                className="h-8 w-8 rounded-lg text-destructive hover:bg-destructive/10"
                data-testid={`button-delete-objective-${objective.id}`}
                aria-label="Supprimer l'objectif"
              >
                <Trash2 className="w-3.5 h-3.5" />
              </Button>
            </div>
          )}
        </div>

        {objective.description && (
          <p className="text-muted-foreground text-xs sm:text-sm mb-4 leading-relaxed font-normal">
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
            className="w-full mt-3 h-8 text-xs font-semibold rounded-xl border-dashed border-border/80 hover:border-primary/60 hover:text-primary transition-all gap-1.5"
            data-testid={`button-add-task-${objective.id}`}
          >
            <Plus className="w-3.5 h-3.5" />
            Ajouter une tâche
          </Button>
        )}
      </div>
    </Card>
  );
}
