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
    <div className="space-y-5">
      {/* Global Progress */}
      <Card className="glass-card rounded-2xl p-7 gradient-border">
        <div className="flex items-center gap-4 mb-5">
          <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-success to-cyan-500 flex items-center justify-center shadow-xl glow">
            <TrendingUp className="w-7 h-7 text-white" />
          </div>
          <div>
            <h3 className="text-foreground font-bold text-lg gradient-text">Progression Globale</h3>
            <p className="text-muted-foreground text-xs font-medium">Toutes semaines confondues</p>
          </div>
        </div>

        <div className="space-y-4">
          <div className="flex items-baseline justify-between">
            <span className="text-muted-foreground text-sm font-semibold">Tâches complétées</span>
            <span className="text-foreground font-bold text-3xl gradient-text" data-testid="text-global-percentage">
              {stats.globalPercentage}%
            </span>
          </div>

          <div className="h-4 glass rounded-full overflow-hidden">
            <div
              className="h-full bg-gradient-to-r from-success to-cyan-500 transition-all duration-700 rounded-full shadow-lg pulse-glow"
              style={{ width: `${stats.globalPercentage}%` }}
            />
          </div>

          <div className="flex items-center justify-between text-xs">
            <span className="text-muted-foreground font-semibold">
              {stats.totalCompleted} / {stats.totalTasks} tâches
            </span>
            <Badge className="glass border-success/30 text-success font-bold shadow-md">
              {stats.totalTasks - stats.totalCompleted} restantes
            </Badge>
          </div>
        </div>
      </Card>

      {/* Weekly Breakdown */}
      <Card className="glass-card rounded-2xl p-7">
        <div className="flex items-center gap-3 mb-5">
          <Target className="w-6 h-6 text-primary" />
          <h3 className="text-foreground font-bold text-lg">Par Semaine</h3>
        </div>

        <div className="space-y-4">
          {stats.weeklyProgress.length === 0 ? (
            <p className="text-muted-foreground text-sm text-center py-6 font-medium">
              Aucune donnée de progression
            </p>
          ) : (
            stats.weeklyProgress.map((week) => (
              <div key={week.weekNumber} className="space-y-2 glass p-4 rounded-xl" data-testid={`progress-week-${week.weekNumber}`}>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-primary to-accent flex items-center justify-center text-white text-xs font-bold shadow-lg">
                      S{week.weekNumber}
                    </div>
                    <span className="text-foreground text-sm font-semibold truncate max-w-[140px]">
                      {week.weekTitle}
                    </span>
                  </div>
                  <span className="text-foreground font-bold text-sm gradient-text">
                    {week.percentage}%
                  </span>
                </div>

                <div className="h-2.5 glass rounded-full overflow-hidden">
                  <div
                    className="h-full bg-gradient-to-r from-primary to-accent transition-all duration-500 rounded-full shadow-md"
                    style={{ width: `${week.percentage}%` }}
                  />
                </div>

                <div className="flex items-center justify-between text-xs text-muted-foreground font-medium">
                  <span>{week.completed}/{week.total}</span>
                  {week.percentage === 100 && (
                    <CheckCircle2 className="w-5 h-5 text-success drop-shadow-lg" />
                  )}
                </div>
              </div>
            ))
          )}
        </div>
      </Card>

      {/* Motivation Badge */}
      <Card className="glass-card rounded-2xl p-7 text-center gradient-border">
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
