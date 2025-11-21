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
      <div className="text-center py-4">
        <p className="text-white/50 text-sm">Aucune tâche pour le moment</p>
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
              flex items-start gap-3 py-3 group
              ${index !== tasks.length - 1 ? "border-b border-white/10" : ""}
            `}
            data-testid={`task-item-${task.id}`}
          >
            {isLearner() ? (
              <Checkbox
                checked={isCompleted}
                onCheckedChange={() => onToggleTask?.(task.id)}
                className="mt-0.5 border-white/40 data-[state=checked]:bg-gradient-to-br data-[state=checked]:from-green-500 data-[state=checked]:to-emerald-600 data-[state=checked]:border-green-400"
                data-testid={`checkbox-task-${task.id}`}
              />
            ) : (
              <div className={`w-5 h-5 rounded border-2 mt-0.5 flex-shrink-0 ${
                isCompleted 
                  ? "bg-gradient-to-br from-green-500 to-emerald-600 border-green-400" 
                  : "border-white/40 bg-white/5"
              }`} />
            )}

            <span
              className={`
                flex-1 text-sm leading-relaxed transition-all
                ${isCompleted 
                  ? "text-white/50 line-through" 
                  : "text-white"
                }
              `}
            >
              {task.label}
              {task.isOptional && (
                <span className="ml-2 text-xs text-white/40 italic">(optionnel)</span>
              )}
            </span>

            {isMentor() && (
              <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                <Button
                  size="icon"
                  variant="ghost"
                  onClick={() => onEditTask?.(task.id)}
                  className="bg-white/10 hover:bg-white/20 text-white h-7 w-7"
                  data-testid={`button-edit-task-${task.id}`}
                >
                  <Pencil className="w-3 h-3" />
                </Button>
                <Button
                  size="icon"
                  variant="ghost"
                  onClick={() => onDeleteTask?.(task.id)}
                  className="bg-red-500/20 hover:bg-red-500/30 text-red-200 h-7 w-7"
                  data-testid={`button-delete-task-${task.id}`}
                >
                  <Trash2 className="w-3 h-3" />
                </Button>
              </div>
            )}
          </li>
        );
      })}
    </ul>
  );
}
