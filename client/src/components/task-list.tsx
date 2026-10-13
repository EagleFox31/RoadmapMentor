import { useState } from "react";
import { Checkbox } from "@/components/ui/checkbox";
import { Button } from "@/components/ui/button";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { Badge } from "@/components/ui/badge";
import { Pencil, Trash2, Users, CheckCircle2 } from "lucide-react";
import type { Task, TaskProgressWithLearner } from "@shared/schema";
import { isMentor, isLearner, getCurrentUser } from "@/lib/auth";
import { ScreenshotUploader } from "./ScreenshotUploader";
import { EvidenceLink } from "./EvidenceLink";

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
    <ul className="space-y-2">
      {tasks.map((task) => {
        const isCompleted = isTaskCompleted(task);

        return (
          <li
            key={task.id}
            className={`
              flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-3 rounded-2xl
              border transition-all duration-200 group/task
              ${isCompleted 
                ? "bg-muted/20 border-border/40 text-muted-foreground" 
                : "bg-background/60 hover:bg-card border-border/60 hover:border-border hover:shadow-xs"
              }
            `}
            data-testid={`task-item-${task.id}`}
          >
            <div className="flex items-start sm:items-center gap-3 min-w-0 flex-1">
              {isLearner() ? (
                <Tooltip>
                  <TooltipTrigger asChild>
                    <div className="pt-0.5 sm:pt-0">
                      <Checkbox
                        checked={isCompleted}
                        disabled={!isCompleted}
                        onCheckedChange={() => {
                          if (isCompleted) {
                            // Allow unchecking a completed task
                            onToggleTask?.(task.id);
                          }
                        }}
                        className="h-5 w-5 rounded-md border-border/80 data-[state=checked]:bg-emerald-500 data-[state=checked]:border-emerald-500 shadow-2xs transition-colors"
                        data-testid={`checkbox-task-${task.id}`}
                      />
                    </div>
                  </TooltipTrigger>
                  {!isCompleted && (
                    <TooltipContent>
                      <p>Joignez la preuve d'exercice pour valider</p>
                    </TooltipContent>
                  )}
                </Tooltip>
              ) : (
                <div className={`w-5 h-5 rounded-md border flex items-center justify-center shrink-0 ${
                  isCompleted 
                    ? "bg-emerald-500 border-emerald-500 text-white" 
                    : "border-border/80 bg-muted/40"
                }`}>
                  {isCompleted && <CheckCircle2 className="w-3.5 h-3.5" />}
                </div>
              )}

              <div className="flex items-center gap-2 flex-wrap min-w-0 flex-1">
                <span
                  className={`
                    text-sm font-medium leading-relaxed transition-all
                    ${isCompleted 
                      ? "line-through text-muted-foreground/60" 
                      : "text-foreground"
                    }
                  `}
                >
                  {task.label}
                </span>
                {task.isOptional && (
                  <span className="text-[11px] font-medium text-muted-foreground/70 bg-muted/60 px-2 py-0.5 rounded-full">
                    Optionnel
                  </span>
                )}
              </div>
            </div>

            {/* Evidence action or Mentor actions */}
            <div className="flex items-center gap-2 self-end sm:self-center shrink-0 pl-8 sm:pl-0">
              {isLearner() && (
                <>
                  {isCompleted && getTaskProgress(task)?.screenshotUrl && (
                    <EvidenceLink taskId={task.id} learnerId={currentUser!.id} testId={`link-screenshot-${task.id}`} />
                  )}
                  {!isCompleted && (
                    <ScreenshotUploader
                      taskId={task.id}
                      onUploadComplete={(url) => handleScreenshotUpload(task.id, url)}
                      currentUrl={pendingScreenshots[task.id] || getTaskProgress(task)?.screenshotUrl}
                    />
                  )}
                </>
              )}

              {isMentor() && (
                <div className="flex items-center gap-2">
                  {getCompletedLearners(task).length > 0 && (
                    <Badge variant="secondary" className="text-xs h-6 px-2 rounded-full font-medium">
                      <Users className="w-3 h-3 mr-1" />
                      {getCompletedLearners(task).length}
                    </Badge>
                  )}
                  {getCompletedLearners(task).map((progress) => (
                    progress.screenshotUrl && (
                      <EvidenceLink
                        key={progress.id}
                        taskId={task.id}
                        learnerId={progress.learnerId}
                        testId={`link-screenshot-${task.id}-${progress.learnerId}`}
                      />
                    )
                  ))}
                  <div className="flex gap-1 opacity-0 group-hover/task:opacity-100 transition-opacity">
                    <Button
                      size="icon"
                      variant="ghost"
                      onClick={() => onEditTask?.(task.id)}
                      className="h-7 w-7 rounded-lg hover:bg-muted text-muted-foreground hover:text-foreground"
                      data-testid={`button-edit-task-${task.id}`}
                      aria-label="Modifier la tâche"
                    >
                      <Pencil className="w-3.5 h-3.5" />
                    </Button>
                    <Button
                      size="icon"
                      variant="ghost"
                      onClick={() => onDeleteTask?.(task.id)}
                      className="h-7 w-7 rounded-lg text-destructive hover:bg-destructive/10"
                      data-testid={`button-delete-task-${task.id}`}
                      aria-label="Supprimer la tâche"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </Button>
                  </div>
                </div>
              )}
            </div>
          </li>
        );
      })}
    </ul>
  );
}
