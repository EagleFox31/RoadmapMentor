import { useQuery, useMutation } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { useToast } from "@/hooks/use-toast";
import { Loader2 } from "lucide-react";
import { TopBar } from "@/components/top-bar";
import type { EmailNotificationPreferences } from "@shared/schema";

export default function PreferencesPage() {
  const { toast } = useToast();

  const { data: preferences, isLoading } = useQuery<EmailNotificationPreferences>({
    queryKey: ["/api/email-preferences"],
  });

  const updateMutation = useMutation({
    mutationFn: async (updates: Partial<EmailNotificationPreferences>) => {
      return await apiRequest("PUT", "/api/email-preferences", updates);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/email-preferences"] });
      toast({
        title: "Préférences sauvegardées",
        description: "Vos préférences de notification ont été mises à jour.",
      });
    },
    onError: () => {
      toast({
        title: "Erreur",
        description: "Impossible de sauvegarder vos préférences.",
        variant: "destructive",
      });
    },
  });

  const handleToggle = (key: keyof EmailNotificationPreferences, value: boolean) => {
    updateMutation.mutate({ [key]: value });
  };

  if (isLoading) {
    return (
      <>
        <TopBar />
        <div className="flex items-center justify-center min-h-screen">
          <Loader2 className="h-8 w-8 animate-spin text-primary" data-testid="spinner-loading" />
        </div>
      </>
    );
  }

  if (!preferences) {
    return (
      <>
        <TopBar />
        <div className="flex items-center justify-center min-h-screen">
          <Card>
            <CardHeader>
              <CardTitle>Erreur</CardTitle>
              <CardDescription>Impossible de charger vos préférences.</CardDescription>
            </CardHeader>
          </Card>
        </div>
      </>
    );
  }

  return (
    <>
      <TopBar />
      <div className="container max-w-4xl py-8">
        <div className="space-y-6">
          <div>
            <h1 className="text-3xl font-bold tracking-tight">Préférences de notification</h1>
            <p className="text-muted-foreground mt-2">
              Gérez les notifications par email que vous souhaitez recevoir.
            </p>
          </div>

          {/* Notifications de base */}
          <Card>
            <CardHeader>
              <CardTitle>📬 Notifications de base</CardTitle>
              <CardDescription>
                Notifications essentielles pour votre activité quotidienne
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <Label htmlFor="taskReminders" className="text-base font-medium">
                    Rappels de tâches
                  </Label>
                  <p className="text-sm text-muted-foreground">
                    Recevez des rappels pour les tâches en attente (Apprenants uniquement).
                  </p>
                </div>
                <Switch
                  id="taskReminders"
                  data-testid="switch-task-reminders"
                  checked={preferences.taskReminders}
                  onCheckedChange={(checked) => handleToggle("taskReminders", checked)}
                  disabled={updateMutation.isPending}
                />
              </div>

              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <Label htmlFor="weekPreparation" className="text-base font-medium">
                    Rappels de préparation de semaine
                  </Label>
                  <p className="text-sm text-muted-foreground">
                    Recevez des rappels pour préparer les semaines à venir (Mentors uniquement).
                  </p>
                </div>
                <Switch
                  id="weekPreparation"
                  data-testid="switch-week-preparation"
                  checked={preferences.weekPreparation}
                  onCheckedChange={(checked) => handleToggle("weekPreparation", checked)}
                  disabled={updateMutation.isPending}
                />
              </div>

              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <Label htmlFor="progressUpdates" className="text-base font-medium">
                    Mises à jour de progression
                  </Label>
                  <p className="text-sm text-muted-foreground">
                    Recevez des notifications quand un apprenant complète une tâche (Mentors uniquement).
                  </p>
                </div>
                <Switch
                  id="progressUpdates"
                  data-testid="switch-progress-updates"
                  checked={preferences.progressUpdates}
                  onCheckedChange={(checked) => handleToggle("progressUpdates", checked)}
                  disabled={updateMutation.isPending}
                />
              </div>

              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <Label htmlFor="commentNotifications" className="text-base font-medium">
                    Notifications de commentaires
                  </Label>
                  <p className="text-sm text-muted-foreground">
                    Recevez des notifications quand quelqu'un commente une semaine.
                  </p>
                </div>
                <Switch
                  id="commentNotifications"
                  data-testid="switch-comment-notifications"
                  checked={preferences.commentNotifications}
                  onCheckedChange={(checked) => handleToggle("commentNotifications", checked)}
                  disabled={updateMutation.isPending}
                />
              </div>
            </CardContent>
          </Card>

          {/* Notifications IA/Système */}
          <Card>
            <CardHeader>
              <CardTitle>✨ Notifications IA & Système</CardTitle>
              <CardDescription>
                Alertes sur la génération automatique de roadmaps et validations
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <Label htmlFor="aiGenerationNotifications" className="text-base font-medium">
                    Notifications de génération IA
                  </Label>
                  <p className="text-sm text-muted-foreground">
                    Succès ou échec de la génération automatique de roadmaps par l'IA.
                  </p>
                </div>
                <Switch
                  id="aiGenerationNotifications"
                  data-testid="switch-ai-generation"
                  checked={preferences.aiGenerationNotifications}
                  onCheckedChange={(checked) => handleToggle("aiGenerationNotifications", checked)}
                  disabled={updateMutation.isPending}
                />
              </div>

              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <Label htmlFor="weekValidationNotifications" className="text-base font-medium">
                    Validation de semaine
                  </Label>
                  <p className="text-sm text-muted-foreground">
                    Recevez une notification quand le mentor valide une semaine (Apprenants uniquement).
                  </p>
                </div>
                <Switch
                  id="weekValidationNotifications"
                  data-testid="switch-week-validation"
                  checked={preferences.weekValidationNotifications}
                  onCheckedChange={(checked) => handleToggle("weekValidationNotifications", checked)}
                  disabled={updateMutation.isPending}
                />
              </div>
            </CardContent>
          </Card>

          {/* Notifications Collaboration */}
          <Card>
            <CardHeader>
              <CardTitle>👥 Notifications Collaboration</CardTitle>
              <CardDescription>
                Restez informé des activités collaboratives sur votre roadmap
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <Label htmlFor="newTaskNotifications" className="text-base font-medium">
                    Nouvelles tâches assignées
                  </Label>
                  <p className="text-sm text-muted-foreground">
                    Recevez une notification quand le mentor ajoute de nouvelles tâches (Apprenants uniquement).
                  </p>
                </div>
                <Switch
                  id="newTaskNotifications"
                  data-testid="switch-new-task"
                  checked={preferences.newTaskNotifications}
                  onCheckedChange={(checked) => handleToggle("newTaskNotifications", checked)}
                  disabled={updateMutation.isPending}
                />
              </div>

              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <Label htmlFor="screenshotNotifications" className="text-base font-medium">
                    Screenshots uploadés
                  </Label>
                  <p className="text-sm text-muted-foreground">
                    Recevez une notification quand un apprenant upload un screenshot (Mentors uniquement).
                  </p>
                </div>
                <Switch
                  id="screenshotNotifications"
                  data-testid="switch-screenshot"
                  checked={preferences.screenshotNotifications}
                  onCheckedChange={(checked) => handleToggle("screenshotNotifications", checked)}
                  disabled={updateMutation.isPending}
                />
              </div>

              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <Label htmlFor="weekModifiedNotifications" className="text-base font-medium">
                    Modifications de semaine
                  </Label>
                  <p className="text-sm text-muted-foreground">
                    Recevez une notification quand le mentor modifie une semaine (Apprenants uniquement).
                  </p>
                </div>
                <Switch
                  id="weekModifiedNotifications"
                  data-testid="switch-week-modified"
                  checked={preferences.weekModifiedNotifications}
                  onCheckedChange={(checked) => handleToggle("weekModifiedNotifications", checked)}
                  disabled={updateMutation.isPending}
                />
              </div>
            </CardContent>
          </Card>

          {/* Rappels Intelligents */}
          <Card>
            <CardHeader>
              <CardTitle>⏰ Rappels Intelligents</CardTitle>
              <CardDescription>
                Notifications pour maintenir votre rythme d'apprentissage
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <Label htmlFor="deadlineReminders" className="text-base font-medium">
                    Deadline proche
                  </Label>
                  <p className="text-sm text-muted-foreground">
                    Recevez un rappel quand une deadline approche (2 jours restants).
                  </p>
                </div>
                <Switch
                  id="deadlineReminders"
                  data-testid="switch-deadline"
                  checked={preferences.deadlineReminders}
                  onCheckedChange={(checked) => handleToggle("deadlineReminders", checked)}
                  disabled={updateMutation.isPending}
                />
              </div>

              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <Label htmlFor="streakWarnings" className="text-base font-medium">
                    Streak en danger
                  </Label>
                  <p className="text-sm text-muted-foreground">
                    Recevez un rappel si vous n'avez pas travaillé aujourd'hui.
                  </p>
                </div>
                <Switch
                  id="streakWarnings"
                  data-testid="switch-streak"
                  checked={preferences.streakWarnings}
                  onCheckedChange={(checked) => handleToggle("streakWarnings", checked)}
                  disabled={updateMutation.isPending}
                />
              </div>
            </CardContent>
          </Card>

          {/* Gamification */}
          <Card>
            <CardHeader>
              <CardTitle>🏆 Gamification & Progrès</CardTitle>
              <CardDescription>
                Célébrez vos accomplissements et suivez votre progression
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <Label htmlFor="milestoneNotifications" className="text-base font-medium">
                    Milestones atteints
                  </Label>
                  <p className="text-sm text-muted-foreground">
                    Recevez une notification à 25%, 50%, 75% et 100% de votre roadmap.
                  </p>
                </div>
                <Switch
                  id="milestoneNotifications"
                  data-testid="switch-milestone"
                  checked={preferences.milestoneNotifications}
                  onCheckedChange={(checked) => handleToggle("milestoneNotifications", checked)}
                  disabled={updateMutation.isPending}
                />
              </div>

              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <Label htmlFor="badgeNotifications" className="text-base font-medium">
                    Badges débloqués
                  </Label>
                  <p className="text-sm text-muted-foreground">
                    Recevez une notification quand vous déverrouillez un nouveau badge.
                  </p>
                </div>
                <Switch
                  id="badgeNotifications"
                  data-testid="switch-badge"
                  checked={preferences.badgeNotifications}
                  onCheckedChange={(checked) => handleToggle("badgeNotifications", checked)}
                  disabled={updateMutation.isPending}
                />
              </div>

              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <Label htmlFor="weeklyReports" className="text-base font-medium">
                    Rapports hebdomadaires
                  </Label>
                  <p className="text-sm text-muted-foreground">
                    Recevez un résumé de votre progression chaque semaine.
                  </p>
                </div>
                <Switch
                  id="weeklyReports"
                  data-testid="switch-weekly-report"
                  checked={preferences.weeklyReports}
                  onCheckedChange={(checked) => handleToggle("weeklyReports", checked)}
                  disabled={updateMutation.isPending}
                />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>À propos des notifications</CardTitle>
            </CardHeader>
            <CardContent>
              <ul className="list-disc list-inside space-y-2 text-sm text-muted-foreground">
                <li>Les notifications sont envoyées à l'adresse email de votre compte.</li>
                <li>Certaines notifications sont spécifiques à votre rôle (Mentor ou Apprenant).</li>
                <li>Vous pouvez modifier ces préférences à tout moment.</li>
                <li>Les modifications prennent effet immédiatement.</li>
              </ul>
            </CardContent>
          </Card>
        </div>
      </div>
    </>
  );
}
