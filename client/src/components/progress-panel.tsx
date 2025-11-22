import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { TrendingUp, CheckCircle2, Circle, Target } from "lucide-react";

interface ProgressStats {
  globalPercentage: number;
  totalCompleted: number;
  totalTasks: number;
  weeklyProgress: {
    weekNumber: number;
    weekTitle: string;
    completed: number;
    total: number;
    percentage: number;
  }[];
}

interface ProgressPanelProps {
  stats: ProgressStats;
}

export function ProgressPanel({ stats }: ProgressPanelProps) {
  return (
    <div className="space-y-4">
      {/* Global Progress */}
      <Card className="bg-card rounded-xl p-6 shadow-md">
        <div className="flex items-center gap-3 mb-4">
          <div className="w-12 h-12 rounded-lg bg-success flex items-center justify-center shadow-sm">
            <TrendingUp className="w-6 h-6 text-white" />
          </div>
          <div>
            <h3 className="text-foreground font-bold text-base">Progression Globale</h3>
            <p className="text-muted-foreground text-xs">Toutes semaines confondues</p>
          </div>
        </div>

        <div className="space-y-3">
          <div className="flex items-baseline justify-between">
            <span className="text-muted-foreground text-sm">Tâches complétées</span>
            <span className="text-foreground font-bold text-2xl" data-testid="text-global-percentage">
              {stats.globalPercentage}%
            </span>
          </div>

          <div className="h-3 bg-muted rounded-full overflow-hidden">
            <div
              className="h-full bg-success transition-all duration-500 rounded-full"
              style={{ width: `${stats.globalPercentage}%` }}
            />
          </div>

          <div className="flex items-center justify-between text-xs">
            <span className="text-muted-foreground">
              {stats.totalCompleted} / {stats.totalTasks} tâches
            </span>
            <Badge className="bg-success/10 text-success border-0">
              {stats.totalTasks - stats.totalCompleted} restantes
            </Badge>
          </div>
        </div>
      </Card>

      {/* Weekly Breakdown */}
      <Card className="bg-card rounded-xl p-6 shadow-md">
        <div className="flex items-center gap-2 mb-4">
          <Target className="w-5 h-5 text-foreground" />
          <h3 className="text-foreground font-bold text-base">Par Semaine</h3>
        </div>

        <div className="space-y-3">
          {stats.weeklyProgress.length === 0 ? (
            <p className="text-muted-foreground text-sm text-center py-4">
              Aucune donnée de progression
            </p>
          ) : (
            stats.weeklyProgress.map((week) => (
              <div key={week.weekNumber} className="space-y-2" data-testid={`progress-week-${week.weekNumber}`}>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div className="w-8 h-8 rounded-lg bg-primary flex items-center justify-center text-white text-xs font-bold shadow-sm">
                      S{week.weekNumber}
                    </div>
                    <span className="text-foreground text-sm font-medium truncate max-w-[150px]">
                      {week.weekTitle}
                    </span>
                  </div>
                  <span className="text-foreground font-semibold text-sm">
                    {week.percentage}%
                  </span>
                </div>

                <div className="h-2 bg-muted rounded-full overflow-hidden">
                  <div
                    className="h-full bg-primary transition-all duration-300 rounded-full"
                    style={{ width: `${week.percentage}%` }}
                  />
                </div>

                <div className="flex items-center justify-between text-xs text-muted-foreground">
                  <span>{week.completed}/{week.total}</span>
                  {week.percentage === 100 && (
                    <CheckCircle2 className="w-4 h-4 text-[#34A853]" />
                  )}
                </div>
              </div>
            ))
          )}
        </div>
      </Card>

      {/* Motivation Badge */}
      <Card className="bg-card rounded-xl p-6 shadow-md text-center border-2 border-primary/20">
        <div className="mb-3">
          {stats.globalPercentage === 100 ? (
            <CheckCircle2 className="w-12 h-12 text-success mx-auto" />
          ) : stats.globalPercentage >= 75 ? (
            <TrendingUp className="w-12 h-12 text-primary mx-auto" />
          ) : stats.globalPercentage >= 50 ? (
            <Target className="w-12 h-12 text-warning mx-auto" />
          ) : stats.globalPercentage >= 25 ? (
            <Circle className="w-12 h-12 text-destructive mx-auto" />
          ) : (
            <Circle className="w-12 h-12 text-muted-foreground mx-auto" />
          )}
        </div>
        <p className="text-foreground font-semibold text-sm">
          {stats.globalPercentage === 100
            ? "Bravo ! Toutes les tâches sont complétées !"
            : stats.globalPercentage >= 75
            ? "Excellent travail ! Continue !"
            : stats.globalPercentage >= 50
            ? "À mi-chemin ! Tu assures !"
            : stats.globalPercentage >= 25
            ? "Bon départ ! Continue sur cette lancée !"
            : "C'est parti ! Chaque tâche compte !"}
        </p>
      </Card>
    </div>
  );
}
