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
    <div className="space-y-6">
      {/* Global Progress */}
      <Card className="bg-white/10 backdrop-blur-xl border border-white/20 rounded-2xl p-6 shadow-xl">
        <div className="flex items-center gap-3 mb-4">
          <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-green-500 to-emerald-600 flex items-center justify-center shadow-lg">
            <TrendingUp className="w-6 h-6 text-white" />
          </div>
          <div>
            <h3 className="text-white font-bold text-lg">Progression Globale</h3>
            <p className="text-white/60 text-xs">Toutes semaines confondues</p>
          </div>
        </div>

        <div className="space-y-3">
          <div className="flex items-baseline justify-between">
            <span className="text-white/70 text-sm">Tâches complétées</span>
            <span className="text-white font-bold text-2xl" data-testid="text-global-percentage">
              {stats.globalPercentage}%
            </span>
          </div>

          <div className="h-4 bg-white/10 rounded-full overflow-hidden shadow-inner">
            <div
              className="h-full bg-gradient-to-r from-green-500 to-emerald-600 transition-all duration-500 rounded-full shadow-lg"
              style={{ width: `${stats.globalPercentage}%` }}
            />
          </div>

          <div className="flex items-center justify-between text-xs">
            <span className="text-white/60">
              {stats.totalCompleted} / {stats.totalTasks} tâches
            </span>
            <Badge
              variant="secondary"
              className="bg-gradient-to-r from-green-500/20 to-emerald-600/20 text-green-200 border-green-400/30"
            >
              {stats.totalTasks - stats.totalCompleted} restantes
            </Badge>
          </div>
        </div>
      </Card>

      {/* Weekly Breakdown */}
      <Card className="bg-white/10 backdrop-blur-xl border border-white/20 rounded-2xl p-6 shadow-xl">
        <div className="flex items-center gap-2 mb-4">
          <Target className="w-5 h-5 text-white" />
          <h3 className="text-white font-bold text-base">Par Semaine</h3>
        </div>

        <div className="space-y-4">
          {stats.weeklyProgress.length === 0 ? (
            <p className="text-white/50 text-sm text-center py-4">
              Aucune donnée de progression
            </p>
          ) : (
            stats.weeklyProgress.map((week) => (
              <div key={week.weekNumber} className="space-y-2" data-testid={`progress-week-${week.weekNumber}`}>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-sky-500 to-indigo-600 flex items-center justify-center text-white text-xs font-bold shadow-md">
                      S{week.weekNumber}
                    </div>
                    <span className="text-white text-sm font-medium truncate max-w-[150px]">
                      {week.weekTitle}
                    </span>
                  </div>
                  <span className="text-white font-semibold text-sm">
                    {week.percentage}%
                  </span>
                </div>

                <div className="h-2 bg-white/10 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-gradient-to-r from-sky-500 to-indigo-600 transition-all duration-300 rounded-full"
                    style={{ width: `${week.percentage}%` }}
                  />
                </div>

                <div className="flex items-center justify-between text-xs text-white/60">
                  <span>{week.completed}/{week.total}</span>
                  {week.percentage === 100 && (
                    <CheckCircle2 className="w-4 h-4 text-green-400" />
                  )}
                </div>
              </div>
            ))
          )}
        </div>
      </Card>

      {/* Motivation Badge */}
      <Card className="bg-gradient-to-br from-violet-500/20 to-purple-600/20 backdrop-blur-xl border border-violet-400/30 rounded-2xl p-6 shadow-xl text-center">
        <div className="text-4xl mb-3">
          {stats.globalPercentage === 100 ? "🎉" : stats.globalPercentage >= 75 ? "🔥" : stats.globalPercentage >= 50 ? "💪" : stats.globalPercentage >= 25 ? "🚀" : "💡"}
        </div>
        <p className="text-white font-semibold text-sm">
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
