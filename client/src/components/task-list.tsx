import { useState } from "react";
import { Checkbox } from "@/components/ui/checkbox";
import { Button } from "@/components/ui/button";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { Badge } from "@/components/ui/badge";
import { Pencil, Trash2, Image as ImageIcon, Users } from "lucide-react";
import type { Task, TaskProgressWithLearner } from "@shared/schema";
import { isMentor, isLearner, getCurrentUser } from "@/lib/auth";
import { ScreenshotUploader } from "./ScreenshotUploader";

interface TaskWithProgress extends Task {
  progress?: TaskProgressWithLearner[];
}

interface TaskListProps {
  tasks: TaskWithProgress[];
  onToggleTask?: (taskId: number, screenshotUrl?: string) => void;
  onEditTask?: (taskId: number) => void;
  onDeleteTask?: (taskId: number) => void;
}

export function TaskList({ tasks, onToggleTask, onEditTask, onDeleteTask }: TaskListProps) {
  const currentUser = getCurrentUser();
  const [pendingScreenshots, setPendingScreenshots] = useState<Record<number, string>>({});

  const isTaskCompleted = (task: TaskWithProgress): boolean => {
    if (!task.progress || task.progress.length === 0) return false;
    
    if (isMentor()) {
      // For mentors, show as completed if ANY learner has completed it
      return task.progress.some(p => p.isDone);
    } else {
      // For learners, check their own progress
      const userProgress = task.progress.find(p => p.learnerId === currentUser?.id);
      return userProgress?.isDone || false;
    }
  };

  const getTaskProgress = (task: TaskWithProgress): TaskProgressWithLearner | undefined => {
    if (!task.progress || task.progress.length === 0) return undefined;
    return task.progress.find(p => p.learnerId === currentUser?.id);
  };

  const getCompletedLearners = (task: TaskWithProgress): TaskProgressWithLearner[] => {
    if (!task.progress) return [];
    return task.progress.filter(p => p.isDone);
  };

  const handleScreenshotUpload = (taskId: number, url: string) => {
    setPendingScreenshots(prev => ({ ...prev, [taskId]: url }));
    // Auto-complete the task after screenshot upload
    onToggleTask?.(taskId, url);
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
              <Tooltip>
                <TooltipTrigger asChild>
                  <div>
                    <Checkbox
                      checked={isCompleted}
                      disabled={!isCompleted}
                      onCheckedChange={() => {
                        if (isCompleted) {
                          // Allow unchecking a completed task
                          onToggleTask?.(task.id);
                        }
                      }}
                      className="mt-0.5 data-[state=checked]:bg-gradient-to-br data-[state=checked]:from-success data-[state=checked]:to-cyan-500 data-[state=checked]:border-success shadow-md disabled:opacity-50 disabled:cursor-not-allowed"
                      data-testid={`checkbox-task-${task.id}`}
                    />
                  </div>
                </TooltipTrigger>
                {!isCompleted && (
                  <TooltipContent>
                    <p>Joignez la capture d'écran de réussite de l'exercice</p>
                  </TooltipContent>
                )}
              </Tooltip>
            ) : (
              <div className={`w-5 h-5 rounded-lg border-2 mt-0.5 flex-shrink-0 shadow-md ${
                isCompleted 
                  ? "bg-gradient-to-br from-success to-cyan-500 border-success" 
                  : "border-white/20 glass"
              }`} />
            )}

            <div className="flex-1 flex flex-col gap-2">
              <span
                className={`
                  text-sm leading-relaxed transition-all font-medium
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

              {isLearner() && (
                <div className="flex items-center gap-2 flex-wrap">
                  {isCompleted && getTaskProgress(task)?.screenshotUrl && (
                    <a 
                      href={getTaskProgress(task)!.screenshotUrl!} 
                      target="_blank" 
                      rel="noopener noreferrer"
                      className="flex items-center gap-1 text-xs text-primary hover:underline"
                      data-testid={`link-screenshot-${task.id}`}
                    >
                      <ImageIcon className="w-3 h-3" />
                      Voir la capture
                    </a>
                  )}
                  {!isCompleted && (
                    <ScreenshotUploader
                      onUploadComplete={(url) => handleScreenshotUpload(task.id, url)}
                      currentUrl={pendingScreenshots[task.id] || getTaskProgress(task)?.screenshotUrl}
                    />
                  )}
                </div>
              )}

              {isMentor() && (
                <div className="flex flex-col gap-2">
                  {getCompletedLearners(task).length > 0 && (
                    <div className="flex items-center gap-2">
                      <Badge variant="secondary" className="text-xs">
                        <Users className="w-3 h-3 mr-1" />
                        {getCompletedLearners(task).length} complété{getCompletedLearners(task).length > 1 ? 's' : ''}
                      </Badge>
                    </div>
                  )}
                  {getCompletedLearners(task).map((progress) => (
                    <div key={progress.id} className="flex items-center gap-2 text-xs">
                      <span className="text-muted-foreground font-medium">
                        {progress.learner?.fullName || `Apprenant #${progress.learnerId}`}:
                      </span>
                      {progress.screenshotUrl && (
                        <a 
                          href={progress.screenshotUrl} 
                          target="_blank" 
                          rel="noopener noreferrer"
                          className="flex items-center gap-1 text-primary hover:underline"
                          data-testid={`link-screenshot-${task.id}-${progress.learnerId}`}
                        >
                          <ImageIcon className="w-3 h-3" />
                          Voir la capture
                        </a>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>

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
