import { useState, useEffect } from "react";
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
import { AIRoadmapModal } from "@/components/modals/ai-roadmap-modal";
import { Button } from "@/components/ui/button";
import { Plus, Sparkles } from "lucide-react";
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
  const [scrollY, setScrollY] = useState(0);

  // Parallax effect
  useEffect(() => {
    const handleScroll = () => {
      setScrollY(window.scrollY);
    };
    window.addEventListener("scroll", handleScroll);
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  // Modal states
  const [modals, setModals] = useState<ModalState>({
    week: false,
    objective: false,
    task: false,
    deliverable: false,
    resource: false,
  });
  
  // AI Roadmap Modal state
  const [aiModalOpen, setAiModalOpen] = useState(false);

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
        if (!task.progress || task.progress.length === 0) return false;
        
        if (isMentor()) {
          // For mentors, count tasks completed by ANY learner
          return task.progress.some(p => p.isDone);
        } else {
          // For learners, check their own progress
          const userProgress = task.progress.find(p => p.learnerId === currentUser?.id);
          return userProgress?.isDone || false;
        }
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
  useEffect(() => {
    if (!selectedWeekId && weeks.length > 0) {
      setSelectedWeekId(weeks[0].id);
    }
  }, [selectedWeekId, weeks]);

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
    mutationFn: async ({ taskId, screenshotUrl }: { taskId: number; screenshotUrl?: string }) => {
      return await apiRequest("POST", `/api/tasks/${taskId}/toggle-progress`, { screenshotUrl });
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

  const cloneWeekMutation = useMutation({
    mutationFn: async (weekId: number) => {
      const weeks = await apiRequest("GET", "/api/weeks", {}) as WeekWithDetails[];
      const maxNumber = Math.max(...weeks.map(w => w.number), 0);
      return await apiRequest("POST", `/api/weeks/${weekId}/clone`, { newNumber: maxNumber + 1 });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/weeks"] });
      toast({ title: "Semaine dupliquée", description: "La semaine a été clonée avec succès." });
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
      closeModal("objective");
      queryClient.invalidateQueries({ queryKey: ["/api/weeks"] });
      toast({ title: "Objectif créé", description: "L'objectif a été ajouté avec succès." });
    },
  });

  const updateObjectiveMutation = useMutation({
    mutationFn: async (data: any) => await apiRequest("PUT", `/api/objectives/${editingObjective?.id}`, data),
    onSuccess: () => {
      closeModal("objective");
      queryClient.invalidateQueries({ queryKey: ["/api/weeks"] });
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

  const cloneObjectiveMutation = useMutation({
    mutationFn: async (objectiveId: number) => await apiRequest("POST", `/api/objectives/${objectiveId}/clone`, {}),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/weeks"] });
      toast({ title: "Objectif dupliqué", description: "L'objectif a été cloné avec succès." });
    },
  });

  // Task mutations
  const createTaskMutation = useMutation({
    mutationFn: async (data: any) => await apiRequest("POST", `/api/objectives/${data.objectiveId}/tasks`, data),
    onSuccess: () => {
      closeModal("task");
      queryClient.invalidateQueries({ queryKey: ["/api/weeks"] });
      toast({ title: "Tâche créée", description: "La tâche a été ajoutée avec succès." });
    },
  });

  const updateTaskMutation = useMutation({
    mutationFn: async (data: any) => await apiRequest("PUT", `/api/tasks/${editingTask?.id}`, data),
    onSuccess: () => {
      closeModal("task");
      queryClient.invalidateQueries({ queryKey: ["/api/weeks"] });
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
      closeModal("deliverable");
      queryClient.invalidateQueries({ queryKey: ["/api/weeks"] });
      toast({ title: "Livrable créé", description: "Le livrable a été ajouté avec succès." });
    },
  });

  const updateDeliverableMutation = useMutation({
    mutationFn: async (data: any) => await apiRequest("PUT", `/api/deliverables/${editingDeliverable?.id}`, data),
    onSuccess: () => {
      closeModal("deliverable");
      queryClient.invalidateQueries({ queryKey: ["/api/weeks"] });
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
      closeModal("resource");
      queryClient.invalidateQueries({ queryKey: ["/api/weeks"] });
      toast({ title: "Ressource créée", description: "La ressource a été ajoutée avec succès." });
    },
  });

  const updateResourceMutation = useMutation({
    mutationFn: async (data: any) => await apiRequest("PUT", `/api/resources/${editingResource?.id}`, data),
    onSuccess: () => {
      closeModal("resource");
      queryClient.invalidateQueries({ queryKey: ["/api/weeks"] });
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

  // AI Roadmap save function
  const handleSaveAIRoadmap = async (generatedWeeks: any[]) => {
    // Basic validation before saving
    if (!Array.isArray(generatedWeeks) || generatedWeeks.length === 0) {
      throw new Error("Aucune semaine à sauvegarder");
    }

    for (const genWeek of generatedWeeks) {
      // Validate required fields
      if (!genWeek.weekNumber || !genWeek.title || !genWeek.startDate || !genWeek.endDate) {
        throw new Error(`Semaine invalide : champs obligatoires manquants`);
      }

      if (!Array.isArray(genWeek.objectives) || genWeek.objectives.length === 0) {
        throw new Error(`Semaine ${genWeek.weekNumber} : au moins un objectif est requis`);
      }

      // Create week
      const week: any = await apiRequest("POST", "/api/weeks", {
        number: genWeek.weekNumber,
        title: genWeek.title,
        startDate: genWeek.startDate,
        endDate: genWeek.endDate,
        description: genWeek.description,
      });

      // Create objectives for this week
      for (const genObj of genWeek.objectives) {
        if (!genObj.title || !genObj.type || !Array.isArray(genObj.tasks) || genObj.tasks.length === 0) {
          throw new Error(`Objectif invalide dans la semaine ${genWeek.weekNumber}`);
        }

        const objective: any = await apiRequest("POST", `/api/weeks/${week.id}/objectives`, {
          weekId: week.id,
          type: genObj.type,
          title: genObj.title,
          description: genObj.description,
          orderIndex: 0,
        });

        // Create tasks for this objective
        for (const genTask of genObj.tasks) {
          if (!genTask.label) {
            throw new Error(`Tâche invalide dans l'objectif "${genObj.title}"`);
          }

          await apiRequest("POST", `/api/objectives/${objective.id}/tasks`, {
            objectiveId: objective.id,
            label: genTask.label,
            isOptional: genTask.isOptional || false,
            orderIndex: 0,
          });
        }
      }

      // Create deliverables for this week
      if (Array.isArray(genWeek.deliverables)) {
        for (const genDeliv of genWeek.deliverables) {
          if (genDeliv.title) {
            await apiRequest("POST", `/api/weeks/${week.id}/deliverables`, {
              weekId: week.id,
              title: genDeliv.title,
              description: genDeliv.description || "",
              instructions: genDeliv.instructions || "",
            });
          }
        }
      }

      // Create resources for this week
      if (Array.isArray(genWeek.resources)) {
        for (const genRes of genWeek.resources) {
          if (genRes.label && genRes.url) {
            await apiRequest("POST", `/api/weeks/${week.id}/resources`, {
              weekId: week.id,
              label: genRes.label,
              url: genRes.url,
              resourceType: genRes.resourceType || "OTHER",
            });
          }
        }
      }
    }

    queryClient.invalidateQueries({ queryKey: ["/api/weeks"] });
    queryClient.invalidateQueries({ queryKey: ["/api/progress/summary"] });
  };

  if (isLoading) {
    return (
      <div className="min-h-screen w-full bg-background">
        <TopBar />
        <div className="flex items-center justify-center h-[calc(100vh-4rem)] pt-20">
          <div className="text-center glass-card p-12 rounded-3xl">
            <div className="w-16 h-16 border-4 border-primary/30 border-t-primary rounded-full animate-spin mx-auto mb-6 glow" />
            <p className="text-foreground text-lg font-semibold gradient-text">Chargement de la feuille de route...</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen w-full bg-background">
      <TopBar />

      <main className="container max-w-[1600px] mx-auto px-8 py-12 pt-28">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
          <aside className="lg:col-span-3 lg:sticky lg:top-28 lg:self-start space-y-6">
            {isMentor() && (
              <>
                <Button
                  onClick={() => setAiModalOpen(true)}
                  className="w-full bg-gradient-to-br from-purple-600 to-pink-600 text-white font-semibold py-4 rounded-2xl shadow-lg hover:shadow-xl hover-elevate transition-all duration-300 glow"
                  data-testid="button-ai-generate"
                >
                  <Sparkles className="w-5 h-5 mr-2" />
                  Générer avec l'IA
                </Button>
                <Button
                  onClick={() => openModal("week")}
                  className="w-full bg-gradient-to-br from-primary to-accent text-white font-semibold py-4 rounded-2xl shadow-lg hover:shadow-xl hover-elevate transition-all duration-300 glow"
                  data-testid="button-add-week"
                >
                  <Plus className="w-5 h-5 mr-2" />
                  Nouvelle Semaine
                </Button>
              </>
            )}
            <div className="glass-card rounded-3xl overflow-hidden">
              <WeekSelector
                weeks={weeks}
                selectedWeekId={selectedWeekId}
                onSelectWeek={setSelectedWeekId}
                progressByWeek={progressByWeek}
              />
            </div>
          </aside>

          <section className="lg:col-span-6">
            <div className="glass-card rounded-3xl p-8">
              <WeekDetail
                week={selectedWeek}
                onToggleTask={(taskId, screenshotUrl) => toggleTaskMutation.mutate({ taskId, screenshotUrl })}
                onAddComment={(content) => selectedWeekId && addCommentMutation.mutate({ weekId: selectedWeekId, content })}
                onEditWeek={() => { setEditingWeek(selectedWeek); openModal("week"); }}
                onDeleteWeek={() => selectedWeekId && confirm("Êtes-vous sûr de vouloir supprimer cette semaine ?") && deleteWeekMutation.mutate(selectedWeekId)}
                onCloneWeek={() => selectedWeekId && cloneWeekMutation.mutate(selectedWeekId)}
                onValidateWeek={() => selectedWeekId && validateWeekMutation.mutate(selectedWeekId)}
                onAddObjective={() => openModal("objective")}
                onEditObjective={(obj) => { setEditingObjective(obj); openModal("objective"); }}
                onDeleteObjective={(id) => confirm("Supprimer cet objectif ?") && deleteObjectiveMutation.mutate(id)}
                onCloneObjective={(id) => cloneObjectiveMutation.mutate(id)}
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
            </div>
          </section>

          <aside className="lg:col-span-3 lg:sticky lg:top-28 lg:self-start">
            <div className="glass-card rounded-3xl p-6">
              <ProgressPanel stats={globalStats} />
            </div>
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

      <AIRoadmapModal
        open={aiModalOpen}
        onClose={() => setAiModalOpen(false)}
        onSave={handleSaveAIRoadmap}
      />
    </div>
  );
}