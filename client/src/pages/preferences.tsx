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

          <Card>
            <CardHeader>
              <CardTitle>Notifications par email</CardTitle>
              <CardDescription>
                Choisissez les types de notifications que vous souhaitez recevoir.
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
