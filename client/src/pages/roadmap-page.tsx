import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { TopBar } from "@/components/top-bar";
import { WeekSelector } from "@/components/week-selector";
import { WeekDetail } from "@/components/week-detail";
import { ProgressPanel } from "@/components/progress-panel";
import { WeekModal } from "@/components/modals/week-modal";
import { ObjectiveModal } from "@/components/modals/objective-modal";
import { TaskModal } from "@/components/modals/task-modal";
import { DeliverableModal } from "@/components/modals/deliverable-modal";
import { ResourceModal } from "@/components/modals/resource-modal";
import { Button } from "@/components/ui/button";
import { Plus } from "lucide-react";
import { isMentor, getCurrentUser } from "@/lib/auth";
import { useToast } from "@/hooks/use-toast";
import { queryClient, apiRequest } from "@/lib/queryClient";
import type { WeekWithDetails, Week, Objective, Task, Deliverable, Resource, ObjectiveWithTasks } from "@shared/schema";

type ModalState = {
  week: boolean;
  objective: boolean;
  task: boolean;
  deliverable: boolean;
  resource: boolean;
};

export default function RoadmapPage() {
  const { toast } = useToast();
  const [selectedWeekId, setSelectedWeekId] = useState<number | null>(null);
  const currentUser = getCurrentUser();
  
  // Modal states
  const [modals, setModals] = useState<ModalState>({
    week: false,
    objective: false,
    task: false,
    deliverable: false,
    resource: false,
  });
  
  // Edit states
  const [editingWeek, setEditingWeek] = useState<Week | null>(null);
  const [editingObjective, setEditingObjective] = useState<Objective | null>(null);
  const [editingTask, setEditingTask] = useState<Task | null>(null);
  const [editingDeliverable, setEditingDeliverable] = useState<Deliverable | null>(null);
  const [editingResource, setEditingResource] = useState<Resource | null>(null);
  const [targetObjectiveId, setTargetObjectiveId] = useState<number | null>(null);

  // Fetch all weeks with details
  const { data: weeks = [], isLoading } = useQuery<WeekWithDetails[]>({
    queryKey: ["/api/weeks"],
  });

  // Fetch progress summary
  const { data: progressSummary } = useQuery<any>({
    queryKey: ["/api/progress/summary"],
  });

  const selectedWeek = weeks.find(w => w.id === selectedWeekId) || null;

  // Calculate progress by week
  const progressByWeek = weeks.reduce((acc, week) => {
    const totalTasks = week.objectives.reduce((sum, obj) => sum + obj.tasks.length, 0);
    const completedTasks = week.objectives.reduce((sum, obj) => {
      return sum + obj.tasks.filter(task => {
        const userProgress = task.progress?.find(p => p.learnerId === currentUser?.id);
        return userProgress?.isDone || false;
      }).length;
    }, 0);

    acc[week.id] = {
      completed: completedTasks,
      total: totalTasks,
      percentage: totalTasks > 0 ? Math.round((completedTasks / totalTasks) * 100) : 0,
    };
    return acc;
  }, {} as Record<number, { completed: number; total: number; percentage: number }>);

  // Calculate global progress stats
  const globalStats = {
    globalPercentage: progressSummary?.globalPercentage || 0,
    totalCompleted: progressSummary?.totalCompleted || 0,
    totalTasks: progressSummary?.totalTasks || 0,
    weeklyProgress: weeks.map(week => ({
      weekNumber: week.number,
      weekTitle: week.title,
      ...progressByWeek[week.id],
    })),
  };

  // Auto-select first week if none selected
  if (!selectedWeekId && weeks.length > 0) {
    setSelectedWeekId(weeks[0].id);
  }

  // Helper to open modals
  const openModal = (modal: keyof ModalState) => {
    setModals(prev => ({ ...prev, [modal]: true }));
  };

  const closeModal = (modal: keyof ModalState) => {
    setModals(prev => ({ ...prev, [modal]: false }));
    // Clear editing states
    setEditingWeek(null);
    setEditingObjective(null);
    setEditingTask(null);
    setEditingDeliverable(null);
    setEditingResource(null);
    setTargetObjectiveId(null);
  };

  // Toggle task completion (learner only)
  const toggleTaskMutation = useMutation({
    mutationFn: async (taskId: number) => {
      return await apiRequest("POST", `/api/tasks/${taskId}/toggle-progress`, {});
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/weeks"] });
      queryClient.invalidateQueries({ queryKey: ["/api/progress/summary"] });
    },
  });

  // Add comment (learner only)
  const addCommentMutation = useMutation({
    mutationFn: async ({ weekId, content }: { weekId: number; content: string }) => {
      return await apiRequest("POST", `/api/weeks/${weekId}/comments`, { content });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/weeks"] });
      toast({ title: "Commentaire ajouté", description: "Votre message a été publié." });
    },
  });

  // Week mutations
  const createWeekMutation = useMutation({
    mutationFn: async (data: any) => await apiRequest("POST", "/api/weeks", data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/weeks"] });
      closeModal("week");
      toast({ title: "Semaine créée", description: "La semaine a été ajoutée avec succès." });
    },
  });

  const updateWeekMutation = useMutation({
    mutationFn: async (data: any) => await apiRequest("PUT", `/api/weeks/${editingWeek?.id}`, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/weeks"] });
      closeModal("week");
      toast({ title: "Semaine mise à jour", description: "Les modifications ont été enregistrées." });
    },
  });

  const deleteWeekMutation = useMutation({
    mutationFn: async (weekId: number) => await apiRequest("DELETE", `/api/weeks/${weekId}`, {}),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/weeks"] });
      setSelectedWeekId(null);
      toast({ title: "Semaine supprimée", description: "La semaine a été supprimée." });
    },
  });

  const validateWeekMutation = useMutation({
    mutationFn: async (weekId: number) => await apiRequest("POST", `/api/weeks/${weekId}/validate`, {}),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/weeks"] });
      toast({ title: "Semaine validée", description: "La semaine a été marquée comme validée." });
    },
  });

  // Objective mutations
  const createObjectiveMutation = useMutation({
    mutationFn: async (data: any) => await apiRequest("POST", `/api/weeks/${data.weekId}/objectives`, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/weeks"] });
      closeModal("objective");
      toast({ title: "Objectif créé", description: "L'objectif a été ajouté avec succès." });
    },
  });

  const updateObjectiveMutation = useMutation({
    mutationFn: async (data: any) => await apiRequest("PUT", `/api/objectives/${editingObjective?.id}`, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/weeks"] });
      closeModal("objective");
      toast({ title: "Objectif mis à jour", description: "Les modifications ont été enregistrées." });
    },
  });

  const deleteObjectiveMutation = useMutation({
    mutationFn: async (objectiveId: number) => await apiRequest("DELETE", `/api/objectives/${objectiveId}`, {}),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/weeks"] });
      toast({ title: "Objectif supprimé", description: "L'objectif a été supprimé." });
    },
  });

  // Task mutations
  const createTaskMutation = useMutation({
    mutationFn: async (data: any) => await apiRequest("POST", `/api/objectives/${data.objectiveId}/tasks`, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/weeks"] });
      closeModal("task");
      toast({ title: "Tâche créée", description: "La tâche a été ajoutée avec succès." });
    },
  });

  const updateTaskMutation = useMutation({
    mutationFn: async (data: any) => await apiRequest("PUT", `/api/tasks/${editingTask?.id}`, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/weeks"] });
      closeModal("task");
      toast({ title: "Tâche mise à jour", description: "Les modifications ont été enregistrées." });
    },
  });

  const deleteTaskMutation = useMutation({
    mutationFn: async (taskId: number) => await apiRequest("DELETE", `/api/tasks/${taskId}`, {}),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/weeks"] });
      toast({ title: "Tâche supprimée", description: "La tâche a été supprimée." });
    },
  });

  // Deliverable mutations
  const createDeliverableMutation = useMutation({
    mutationFn: async (data: any) => await apiRequest("POST", `/api/weeks/${data.weekId}/deliverables`, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/weeks"] });
      closeModal("deliverable");
      toast({ title: "Livrable créé", description: "Le livrable a été ajouté avec succès." });
    },
  });

  const updateDeliverableMutation = useMutation({
    mutationFn: async (data: any) => await apiRequest("PUT", `/api/deliverables/${editingDeliverable?.id}`, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/weeks"] });
      closeModal("deliverable");
      toast({ title: "Livrable mis à jour", description: "Les modifications ont été enregistrées." });
    },
  });

  const deleteDeliverableMutation = useMutation({
    mutationFn: async (deliverableId: number) => await apiRequest("DELETE", `/api/deliverables/${deliverableId}`, {}),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/weeks"] });
      toast({ title: "Livrable supprimé", description: "Le livrable a été supprimé." });
    },
  });

  // Resource mutations
  const createResourceMutation = useMutation({
    mutationFn: async (data: any) => await apiRequest("POST", `/api/weeks/${data.weekId}/resources`, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/weeks"] });
      closeModal("resource");
      toast({ title: "Ressource créée", description: "La ressource a été ajoutée avec succès." });
    },
  });

  const updateResourceMutation = useMutation({
    mutationFn: async (data: any) => await apiRequest("PUT", `/api/resources/${editingResource?.id}`, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/weeks"] });
      closeModal("resource");
      toast({ title: "Ressource mise à jour", description: "Les modifications ont été enregistrées." });
    },
  });

  const deleteResourceMutation = useMutation({
    mutationFn: async (resourceId: number) => await apiRequest("DELETE", `/api/resources/${resourceId}`, {}),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/weeks"] });
      toast({ title: "Ressource supprimée", description: "La ressource a été supprimée." });
    },
  });

  if (isLoading) {
    return (
      <div className="min-h-screen w-full bg-gradient-to-br from-[#667eea] via-[#764ba2] to-[#1e3a8a]">
        <TopBar />
        <div className="flex items-center justify-center h-[calc(100vh-4rem)]">
          <div className="text-center">
            <div className="w-16 h-16 border-4 border-white/20 border-t-white rounded-full animate-spin mx-auto mb-4" />
            <p className="text-white text-lg">Chargement de la feuille de route...</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen w-full bg-gradient-to-br from-[#667eea] via-[#764ba2] to-[#1e3a8a] relative overflow-hidden">
      <div
        className="absolute inset-0 opacity-5"
        style={{
          backgroundImage: `url("data:image/svg+xml,%3Csvg width='60' height='60' viewBox='0 0 60 60' xmlns='http://www.w3.org/2000/svg'%3E%3Cg fill='none' fill-rule='evenodd'%3E%3Cg fill='%23ffffff' fill-opacity='1'%3E%3Cpath d='M36 34v-4h-2v4h-4v2h4v4h2v-4h4v-2h-4zm0-30V0h-2v4h-4v2h4v4h2V6h4V4h-4zM6 34v-4H4v4H0v2h4v4h2v-4h4v-2H6zM6 4V0H4v4H0v2h4v4h2V6h4V4H6z'/%3E%3C/g%3E%3C/g%3E%3C/svg%3E")`,
        }}
      />

      <TopBar />

      <main className="relative z-10 container max-w-[1600px] mx-auto px-6 py-8">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          <aside className="lg:col-span-3 lg:sticky lg:top-24 lg:self-start">
            {isMentor() && (
              <Button
                onClick={() => openModal("week")}
                className="w-full mb-4 bg-gradient-to-r from-sky-500 to-indigo-500 hover:from-sky-600 hover:to-indigo-600 text-white shadow-lg hover:shadow-xl hover:scale-105 transition-all"
                data-testid="button-add-week"
              >
                <Plus className="w-4 h-4 mr-2" />
                Nouvelle Semaine
              </Button>
            )}
            <WeekSelector
              weeks={weeks}
              selectedWeekId={selectedWeekId}
              onSelectWeek={setSelectedWeekId}
              progressByWeek={progressByWeek}
            />
          </aside>

          <section className="lg:col-span-6">
            <WeekDetail
              week={selectedWeek}
              onToggleTask={(taskId) => toggleTaskMutation.mutate(taskId)}
              onAddComment={(content) => selectedWeekId && addCommentMutation.mutate({ weekId: selectedWeekId, content })}
              onEditWeek={() => { setEditingWeek(selectedWeek); openModal("week"); }}
              onDeleteWeek={() => selectedWeekId && confirm("Êtes-vous sûr de vouloir supprimer cette semaine ?") && deleteWeekMutation.mutate(selectedWeekId)}
              onValidateWeek={() => selectedWeekId && validateWeekMutation.mutate(selectedWeekId)}
              onAddObjective={() => openModal("objective")}
              onEditObjective={(obj) => { setEditingObjective(obj); openModal("objective"); }}
              onDeleteObjective={(id) => confirm("Supprimer cet objectif ?") && deleteObjectiveMutation.mutate(id)}
              onAddTask={(objId) => { setTargetObjectiveId(objId); openModal("task"); }}
              onEditTask={(taskId) => { const task = selectedWeek?.objectives.flatMap(o => o.tasks).find(t => t.id === taskId); if (task) { setEditingTask(task); openModal("task"); }}}
              onDeleteTask={(id) => confirm("Supprimer cette tâche ?") && deleteTaskMutation.mutate(id)}
              onAddDeliverable={() => openModal("deliverable")}
              onEditDeliverable={(d) => { setEditingDeliverable(d); openModal("deliverable"); }}
              onDeleteDeliverable={(id) => confirm("Supprimer ce livrable ?") && deleteDeliverableMutation.mutate(id)}
              onAddResource={() => openModal("resource")}
              onEditResource={(r) => { setEditingResource(r); openModal("resource"); }}
              onDeleteResource={(id) => confirm("Supprimer cette ressource ?") && deleteResourceMutation.mutate(id)}
              isLoadingComment={addCommentMutation.isPending}
            />
          </section>

          <aside className="lg:col-span-3 lg:sticky lg:top-24 lg:self-start">
            <ProgressPanel stats={globalStats} />
          </aside>
        </div>
      </main>

      {/* Modals */}
      <WeekModal
        isOpen={modals.week}
        onClose={() => closeModal("week")}
        onSubmit={(data) => editingWeek ? updateWeekMutation.mutate(data) : createWeekMutation.mutate(data)}
        week={editingWeek}
        isLoading={createWeekMutation.isPending || updateWeekMutation.isPending}
      />

      <ObjectiveModal
        isOpen={modals.objective}
        onClose={() => closeModal("objective")}
        onSubmit={(data) => editingObjective ? updateObjectiveMutation.mutate(data) : createObjectiveMutation.mutate(data)}
        weekId={selectedWeekId!}
        objective={editingObjective}
        isLoading={createObjectiveMutation.isPending || updateObjectiveMutation.isPending}
      />

      <TaskModal
        isOpen={modals.task}
        onClose={() => closeModal("task")}
        onSubmit={(data) => editingTask ? updateTaskMutation.mutate(data) : createTaskMutation.mutate(data)}
        objectiveId={targetObjectiveId || editingTask?.objectiveId || 0}
        task={editingTask}
        isLoading={createTaskMutation.isPending || updateTaskMutation.isPending}
      />

      <DeliverableModal
        isOpen={modals.deliverable}
        onClose={() => closeModal("deliverable")}
        onSubmit={(data) => editingDeliverable ? updateDeliverableMutation.mutate(data) : createDeliverableMutation.mutate(data)}
        weekId={selectedWeekId!}
        deliverable={editingDeliverable}
        isLoading={createDeliverableMutation.isPending || updateDeliverableMutation.isPending}
      />

      <ResourceModal
        isOpen={modals.resource}
        onClose={() => closeModal("resource")}
        onSubmit={(data) => editingResource ? updateResourceMutation.mutate(data) : createResourceMutation.mutate(data)}
        weekId={selectedWeekId!}
        resource={editingResource}
        isLoading={createResourceMutation.isPending || updateResourceMutation.isPending}
      />
    </div>
  );
}
