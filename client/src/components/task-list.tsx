import { Checkbox } from "@/components/ui/checkbox";
import { Button } from "@/components/ui/button";
import { Pencil, Trash2 } from "lucide-react";
import type { Task, TaskProgress } from "@shared/schema";
import { isMentor, isLearner, getCurrentUser } from "@/lib/auth";

interface TaskWithProgress extends Task {
  progress?: TaskProgress[];
}

interface TaskListProps {
  tasks: TaskWithProgress[];
  onToggleTask?: (taskId: number) => void;
  onEditTask?: (taskId: number) => void;
  onDeleteTask?: (taskId: number) => void;
}

export function TaskList({ tasks, onToggleTask, onEditTask, onDeleteTask }: TaskListProps) {
  const currentUser = getCurrentUser();

  const isTaskCompleted = (task: TaskWithProgress): boolean => {
    if (!task.progress || task.progress.length === 0) return false;
    const userProgress = task.progress.find(p => p.learnerId === currentUser?.id);
    return userProgress?.isDone || false;
  };

  if (tasks.length === 0) {
    return (
      <div className="text-center py-6">
        <p className="text-muted-foreground text-sm font-medium">Aucune tâche pour le moment</p>
      </div>
    );
  }

  return (
    <ul className="space-y-0">
      {tasks.map((task, index) => {
        const isCompleted = isTaskCompleted(task);

        return (
          <li
            key={task.id}
            className={`
              flex items-start gap-4 py-4 group glass rounded-xl px-3 my-2
              hover:shadow-md transition-all duration-300
            `}
            data-testid={`task-item-${task.id}`}
          >
            {isLearner() ? (
              <Checkbox
                checked={isCompleted}
                onCheckedChange={() => onToggleTask?.(task.id)}
                className="mt-0.5 data-[state=checked]:bg-gradient-to-br data-[state=checked]:from-success data-[state=checked]:to-cyan-500 data-[state=checked]:border-success shadow-md"
                data-testid={`checkbox-task-${task.id}`}
              />
            ) : (
              <div className={`w-5 h-5 rounded-lg border-2 mt-0.5 flex-shrink-0 shadow-md ${
                isCompleted 
                  ? "bg-gradient-to-br from-success to-cyan-500 border-success" 
                  : "border-white/20 glass"
              }`} />
            )}

            <span
              className={`
                flex-1 text-sm leading-relaxed transition-all font-medium
                ${isCompleted 
                  ? "text-muted-foreground line-through opacity-60" 
                  : "text-foreground"
                }
              `}
            >
              {task.label}
              {task.isOptional && (
                <span className="ml-2 text-xs text-muted-foreground italic font-semibold">(optionnel)</span>
              )}
            </span>

            {isMentor() && (
              <div className="flex gap-2 opacity-0 group-hover:opacity-100 transition-all duration-300">
                <Button
                  size="icon"
                  variant="ghost"
                  onClick={() => onEditTask?.(task.id)}
                  className="glass border-white/20 hover:border-white/30 shadow-lg"
                  data-testid={`button-edit-task-${task.id}`}
                >
                  <Pencil className="w-3.5 h-3.5" />
                </Button>
                <Button
                  size="icon"
                  variant="ghost"
                  onClick={() => onDeleteTask?.(task.id)}
                  className="glass border-destructive/30 text-destructive hover:border-destructive/50 shadow-lg"
                  data-testid={`button-delete-task-${task.id}`}
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </Button>
              </div>
            )}
          </li>
        );
      })}
    </ul>
  );
}
