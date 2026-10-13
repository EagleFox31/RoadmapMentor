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
import { LabModal } from "@/components/modals/lab-modal";
import { AIRoadmapModal } from "@/components/modals/ai-roadmap-modal";
import { Button } from "@/components/ui/button";
import { Plus, Sparkles, Compass, Target, Code2, MessageSquareQuote, ArrowRight, Bell } from "lucide-react";
import { useLocation } from "wouter";
import { RoadmapSwitcher } from "@/components/roadmap-switcher";
import { useActiveRoadmap } from "@/lib/active-roadmap";
import { isMentor, getCurrentUser } from "@/lib/auth";
import { useToast } from "@/hooks/use-toast";
import { queryClient, apiRequest } from "@/lib/queryClient";
import type { WeekWithDetails, Week, Objective, Task, Deliverable, Resource, ObjectiveWithTasks, Lab } from "@shared/schema";

type ModalState = {
  week: boolean;
  objective: boolean;
  task: boolean;
  deliverable: boolean;
  resource: boolean;
  lab: boolean;
};

export default function RoadmapPage() {
  const { toast } = useToast();
  const [, setLocation] = useLocation();
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
    lab: false,
  });
  
  // AI Roadmap Modal state
  const [aiModalOpen, setAiModalOpen] = useState(false);

  // Edit states
  const [editingWeek, setEditingWeek] = useState<Week | null>(null);
  const [editingObjective, setEditingObjective] = useState<Objective | null>(null);
  const [editingTask, setEditingTask] = useState<Task | null>(null);
  const [editingDeliverable, setEditingDeliverable] = useState<Deliverable | null>(null);
  const [editingResource, setEditingResource] = useState<Resource | null>(null);
  const [editingLab, setEditingLab] = useState<Lab | null>(null);
  const [targetObjectiveId, setTargetObjectiveId] = useState<number | null>(null);

  // Fetch all weeks with details
  const { roadmaps, active, activeId, setActiveId, isLoading: roadmapsLoading, notFound } =
    useActiveRoadmap("/roadmap");
  const weeksKey = ["/api/weeks", activeId ?? "none"];
  const progressKey = ["/api/progress/summary", activeId ?? "none"];

  const { data: weeks = [], isLoading: weeksLoading } = useQuery<WeekWithDetails[]>({
    queryKey: weeksKey,
    enabled: activeId !== null,
    queryFn: () => apiRequest("GET", `/api/weeks?roadmapId=${activeId}`),
  });
  const isLoading = roadmapsLoading || (activeId !== null && weeksLoading);

  // Fetch progress summary
  const { data: progressSummary } = useQuery<any>({
    queryKey: progressKey,
    enabled: activeId !== null,
    queryFn: () => apiRequest("GET", `/api/progress/summary?roadmapId=${activeId}`),
  });

  useEffect(() => {
    setSelectedWeekId(null);
  }, [activeId]);

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
    setEditingLab(null);
    setTargetObjectiveId(null);
  };

  // Toggle task completion (learner only)
  const toggleTaskMutation = useMutation({
    mutationFn: async ({ taskId, screenshotUrl }: { taskId: number; screenshotUrl?: string }) => {
      return await apiRequest("POST", `/api/tasks/${taskId}/toggle-progress`, { screenshotUrl });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: weeksKey });
      queryClient.invalidateQueries({ queryKey: progressKey });
    },
  });

  // Add comment (learner only)
  const addCommentMutation = useMutation({
    mutationFn: async ({ weekId, content }: { weekId: number; content: string }) => {
      return await apiRequest("POST", `/api/weeks/${weekId}/comments`, { content });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: weeksKey });
      toast({ title: "Commentaire ajouté", description: "Votre message a été publié." });
    },
  });

  // Week mutations
  const createWeekMutation = useMutation({
    mutationFn: async (data: any) => await apiRequest("POST", "/api/weeks", { ...data, roadmapId: activeId }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: weeksKey });
      closeModal("week");
      toast({ title: "Semaine créée", description: "La semaine a été ajoutée avec succès." });
    },
  });

  const updateWeekMutation = useMutation({
    mutationFn: async (data: any) => await apiRequest("PUT", `/api/weeks/${editingWeek?.id}`, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: weeksKey });
      closeModal("week");
      toast({ title: "Semaine mise à jour", description: "Les modifications ont été enregistrées." });
    },
  });

  const deleteWeekMutation = useMutation({
    mutationFn: async (weekId: number) => await apiRequest("DELETE", `/api/weeks/${weekId}`, {}),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: weeksKey });
      setSelectedWeekId(null);
      toast({ title: "Semaine supprimée", description: "La semaine a été supprimée." });
    },
  });

  const cloneWeekMutation = useMutation({
    mutationFn: async (weekId: number) => {
      const maxNumber = Math.max(...weeks.map(w => w.number), 0);
      return await apiRequest("POST", `/api/weeks/${weekId}/clone`, { newNumber: maxNumber + 1 });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: weeksKey });
      toast({ title: "Semaine dupliquée", description: "La semaine a été clonée avec succès." });
    },
  });

  const validateWeekMutation = useMutation({
    mutationFn: async (weekId: number) => await apiRequest("POST", `/api/weeks/${weekId}/validate`, {}),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: weeksKey });
      toast({ title: "Semaine validée", description: "La semaine a été marquée comme validée." });
    },
  });

  // Objective mutations
  const createObjectiveMutation = useMutation({
    mutationFn: async (data: any) => await apiRequest("POST", `/api/weeks/${data.weekId}/objectives`, data),
    onSuccess: () => {
      closeModal("objective");
      queryClient.invalidateQueries({ queryKey: weeksKey });
      toast({ title: "Objectif créé", description: "L'objectif a été ajouté avec succès." });
    },
  });

  const updateObjectiveMutation = useMutation({
    mutationFn: async (data: any) => await apiRequest("PUT", `/api/objectives/${editingObjective?.id}`, data),
    onSuccess: () => {
      closeModal("objective");
      queryClient.invalidateQueries({ queryKey: weeksKey });
      toast({ title: "Objectif mis à jour", description: "Les modifications ont été enregistrées." });
    },
  });

  const deleteObjectiveMutation = useMutation({
    mutationFn: async (objectiveId: number) => await apiRequest("DELETE", `/api/objectives/${objectiveId}`, {}),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: weeksKey });
      toast({ title: "Objectif supprimé", description: "L'objectif a été supprimé." });
    },
  });

  const cloneObjectiveMutation = useMutation({
    mutationFn: async (objectiveId: number) => await apiRequest("POST", `/api/objectives/${objectiveId}/clone`, {}),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: weeksKey });
      toast({ title: "Objectif dupliqué", description: "L'objectif a été cloné avec succès." });
    },
  });

  // Task mutations
  const createTaskMutation = useMutation({
    mutationFn: async (data: any) => await apiRequest("POST", `/api/objectives/${data.objectiveId}/tasks`, data),
    onSuccess: () => {
      closeModal("task");
      queryClient.invalidateQueries({ queryKey: weeksKey });
      toast({ title: "Tâche créée", description: "La tâche a été ajoutée avec succès." });
    },
  });

  const updateTaskMutation = useMutation({
    mutationFn: async (data: any) => await apiRequest("PUT", `/api/tasks/${editingTask?.id}`, data),
    onSuccess: () => {
      closeModal("task");
      queryClient.invalidateQueries({ queryKey: weeksKey });
      toast({ title: "Tâche mise à jour", description: "Les modifications ont été enregistrées." });
    },
  });

  const deleteTaskMutation = useMutation({
    mutationFn: async (taskId: number) => await apiRequest("DELETE", `/api/tasks/${taskId}`, {}),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: weeksKey });
      toast({ title: "Tâche supprimée", description: "La tâche a été supprimée." });
    },
  });

  // Deliverable mutations
  const createDeliverableMutation = useMutation({
    mutationFn: async (data: any) => await apiRequest("POST", `/api/weeks/${data.weekId}/deliverables`, data),
    onSuccess: () => {
      closeModal("deliverable");
      queryClient.invalidateQueries({ queryKey: weeksKey });
      toast({ title: "Livrable créé", description: "Le livrable a été ajouté avec succès." });
    },
  });

  const updateDeliverableMutation = useMutation({
    mutationFn: async (data: any) => await apiRequest("PUT", `/api/deliverables/${editingDeliverable?.id}`, data),
    onSuccess: () => {
      closeModal("deliverable");
      queryClient.invalidateQueries({ queryKey: weeksKey });
      toast({ title: "Livrable mis à jour", description: "Les modifications ont été enregistrées." });
    },
  });

  const deleteDeliverableMutation = useMutation({
    mutationFn: async (deliverableId: number) => await apiRequest("DELETE", `/api/deliverables/${deliverableId}`, {}),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: weeksKey });
      toast({ title: "Livrable supprimé", description: "Le livrable a été supprimé." });
    },
  });

  // Resource mutations
  const createResourceMutation = useMutation({
    mutationFn: async (data: any) => await apiRequest("POST", `/api/weeks/${data.weekId}/resources`, data),
    onSuccess: () => {
      closeModal("resource");
      queryClient.invalidateQueries({ queryKey: weeksKey });
      toast({ title: "Ressource créée", description: "La ressource a été ajoutée avec succès." });
    },
  });

  const updateResourceMutation = useMutation({
    mutationFn: async (data: any) => await apiRequest("PUT", `/api/resources/${editingResource?.id}`, data),
    onSuccess: () => {
      closeModal("resource");
      queryClient.invalidateQueries({ queryKey: weeksKey });
      toast({ title: "Ressource mise à jour", description: "Les modifications ont été enregistrées." });
    },
  });

  const deleteResourceMutation = useMutation({
    mutationFn: async (resourceId: number) => await apiRequest("DELETE", `/api/resources/${resourceId}`, {}),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: weeksKey });
      toast({ title: "Ressource supprimée", description: "La ressource a été supprimée." });
    },
  });

  // Guided lab mutations
  const createLabMutation = useMutation({
    mutationFn: async ({ weekId, ...data }: any) => apiRequest("POST", `/api/weeks/${weekId}/labs`, data),
    onSuccess: () => {
      closeModal("lab");
      queryClient.invalidateQueries({ queryKey: ["/api/weeks"] });
      toast({ title: "Lab créé", description: "Le lab a été ajouté à la semaine." });
    },
  });

  const updateLabMutation = useMutation({
    mutationFn: async ({ weekId: _weekId, ...data }: any) => apiRequest("PUT", `/api/labs/${editingLab?.id}`, data),
    onSuccess: () => {
      closeModal("lab");
      queryClient.invalidateQueries({ queryKey: ["/api/weeks"] });
      toast({ title: "Lab mis à jour" });
    },
  });

  const deleteLabMutation = useMutation({
    mutationFn: async (labId: number) => apiRequest("DELETE", `/api/labs/${labId}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/weeks"] });
      toast({ title: "Lab supprimé" });
    },
  });

  // AI Roadmap save function (ATOMIC BULK CREATION WITH TRANSACTION)
  const handleSaveAIRoadmap = async (generatedWeeks: any[]) => {
    // Transform AI-generated weeks to match backend schema
    // AI returns "weekNumber" but backend expects "number"
    // Target roadmap: always the active one, never inferred.
    const targetRoadmapId = activeId ?? undefined;

    const transformedWeeks = generatedWeeks.map((week) => ({
      ...week,
      ...(targetRoadmapId !== undefined && week.roadmapId === undefined
        ? { roadmapId: targetRoadmapId }
        : {}),
      number: week.weekNumber, // Map weekNumber -> number
      objectives: week.objectives.map((obj: any, index: number) => ({
        ...obj,
        orderIndex: obj.orderIndex !== undefined ? obj.orderIndex : index,
        tasks: obj.tasks.map((task: any, taskIndex: number) => ({
          ...task,
          orderIndex: task.orderIndex !== undefined ? task.orderIndex : taskIndex,
        })),
      })),
    }));

    // Single atomic API call that creates all weeks, objectives, tasks, deliverables, and resources
    // in one database transaction. If any part fails, everything is rolled back automatically.
    const result = await apiRequest("POST", "/api/weeks/bulk", transformedWeeks);

    // Invalidate cache only on success (transaction committed)
    queryClient.invalidateQueries({ queryKey: weeksKey });
    queryClient.invalidateQueries({ queryKey: progressKey });
    
    return result;
  };

  if (!isLoading && (notFound || activeId === null)) {
    const isMentorUser = isMentor();
    return (
      <div className="min-h-screen w-full bg-slate-50 text-slate-900 flex flex-col relative overflow-hidden">
        <TopBar />

        {/* Halo lumineux décoratif en arrière-plan */}
        <div
          aria-hidden="true"
          className="absolute -top-32 left-1/2 -translate-x-1/2 w-[800px] lg:w-[1200px] h-[450px] bg-gradient-to-b from-emerald-500/10 via-teal-500/5 to-transparent rounded-full blur-3xl pointer-events-none"
        />

        <div className="flex-1 flex items-center justify-center px-4 sm:px-6 py-12 pt-28 sm:pt-32 relative z-10">
          <div className="w-full max-w-4xl mx-auto">
            {/* Carte Onboarding d'accueil */}
            <div className="bg-white/95 backdrop-blur-xl border border-slate-200/90 rounded-3xl shadow-xl shadow-slate-900/5 p-6 sm:p-10 md:p-12 text-center space-y-8">
              {/* Badge supérieur */}
              <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs sm:text-sm font-semibold shadow-2xs">
                <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                <span>
                  {isMentorUser
                    ? "Espace Mentor • Supervision & Pilotage"
                    : "Espace Apprenant • Mentorat Backend Python"}
                </span>
              </div>

              {/* Boussole & Titre */}
              <div className="space-y-4 max-w-2xl mx-auto">
                <div className="w-16 h-16 sm:w-20 sm:h-20 rounded-3xl bg-gradient-to-br from-emerald-600 via-teal-700 to-slate-900 flex items-center justify-center mx-auto text-white shadow-lg shadow-emerald-950/20 ring-4 ring-emerald-500/10">
                  <Compass className="w-8 h-8 sm:w-10 sm:h-10 animate-[spin_30s_linear_infinite]" />
                </div>

                <h1 className="text-2xl sm:text-3xl md:text-4xl font-extrabold tracking-tight text-slate-900 leading-tight">
                  {notFound
                    ? "Feuille de route introuvable"
                    : isMentorUser
                    ? "Aucune feuille de route sélectionnée"
                    : "Votre parcours d'apprentissage se prépare"}
                </h1>

                {/* Paragraphe obligatoire avec data-testid pour les tests Playwright */}
                <p
                  className="text-base sm:text-lg font-semibold text-slate-800"
                  data-testid="text-no-roadmap"
                >
                  {notFound
                    ? "Roadmap introuvable."
                    : "Aucune roadmap disponible pour le moment."}
                </p>

                <p className="text-sm sm:text-base text-slate-600 leading-relaxed max-w-xl mx-auto">
                  {notFound
                    ? "La feuille de route demandée n'existe pas ou vos identifiants ne vous permettent pas d'y accéder."
                    : isMentorUser
                    ? "Vous n'avez pas encore sélectionné ou assigné de feuille de route active. Rendez-vous dans la gestion des roadmaps pour en créer ou en affecter une à vos apprenants."
                    : "Votre mentor finalise actuellement vos jalons personnalisés sur le projet ShopFlow Backend. Vous serez notifié par email dès qu'une semaine sera débloquée."}
                </p>
              </div>

              {/* Sélecteur de roadmap si d'autres existent */}
              {roadmaps.length > 0 && (
                <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200/80 max-w-md mx-auto text-left space-y-2">
                  <label className="text-xs font-semibold text-slate-600 uppercase tracking-wider block">
                    Basculer vers une autre feuille de route :
                  </label>
                  <RoadmapSwitcher roadmaps={roadmaps} activeId={null} onChange={setActiveId} />
                </div>
              )}

              {/* Les 3 piliers andragogiques de la méthode Roadmap Mentor */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 pt-4 border-t border-slate-100 text-left">
                {/* Pilier 1 */}
                <div className="p-5 rounded-2xl bg-gradient-to-b from-slate-50 to-slate-100/50 border border-slate-200/70 space-y-2.5">
                  <div className="flex items-center gap-2">
                    <div className="p-2 rounded-xl bg-emerald-100 text-emerald-800">
                      <Target className="w-4 h-4" />
                    </div>
                    <span className="text-xs font-bold text-emerald-800 uppercase tracking-wider">
                      Jalons ciblés
                    </span>
                  </div>
                  <h2 className="text-sm font-bold text-slate-900">
                    Objectifs hebdomadaires
                  </h2>
                  <p className="text-xs text-slate-600 leading-relaxed">
                    Un programme progressif : FastAPI, PostgreSQL, architecture modulaire et tests de robustesse.
                  </p>
                </div>

                {/* Pilier 2 */}
                <div className="p-5 rounded-2xl bg-gradient-to-b from-slate-50 to-slate-100/50 border border-slate-200/70 space-y-2.5">
                  <div className="flex items-center gap-2">
                    <div className="p-2 rounded-xl bg-teal-100 text-teal-800">
                      <Code2 className="w-4 h-4" />
                    </div>
                    <span className="text-xs font-bold text-teal-800 uppercase tracking-wider">
                      Projet réel
                    </span>
                  </div>
                  <h2 className="text-sm font-bold text-slate-900">
                    Pratique ShopFlow
                  </h2>
                  <p className="text-xs text-slate-600 leading-relaxed">
                    Développement sur un vrai cas e-commerce et soumission de preuves concrètes (captures, logs, PRs).
                  </p>
                </div>

                {/* Pilier 3 */}
                <div className="p-5 rounded-2xl bg-gradient-to-b from-slate-50 to-slate-100/50 border border-slate-200/70 space-y-2.5">
                  <div className="flex items-center gap-2">
                    <div className="p-2 rounded-xl bg-indigo-100 text-indigo-800">
                      <MessageSquareQuote className="w-4 h-4" />
                    </div>
                    <span className="text-xs font-bold text-indigo-800 uppercase tracking-wider">
                      Accompagnement
                    </span>
                  </div>
                  <h2 className="text-sm font-bold text-slate-900">
                    Feedbacks Mentor
                  </h2>
                  <p className="text-xs text-slate-600 leading-relaxed">
                    Revues de code constructives, validation des livrables et échanges réguliers pour progresser sereinement.
                  </p>
                </div>
              </div>

              {/* Actions de redirection rapides */}
              <div className="flex flex-wrap items-center justify-center gap-3 pt-2">
                {isMentorUser ? (
                  <Button
                    onClick={() => setLocation("/roadmaps")}
                    className="bg-emerald-600 hover:bg-emerald-700 text-white font-semibold rounded-xl px-6 py-2.5 shadow-md shadow-emerald-950/10 flex items-center gap-2"
                  >
                    <span>Gérer les roadmaps & apprenants</span>
                    <ArrowRight className="w-4 h-4" />
                  </Button>
                ) : (
                  <Button
                    onClick={() => setLocation("/mentoring")}
                    className="bg-emerald-600 hover:bg-emerald-700 text-white font-semibold rounded-xl px-6 py-2.5 shadow-md shadow-emerald-950/10 flex items-center gap-2"
                  >
                    <span>Découvrir le programme de Mentorat</span>
                    <ArrowRight className="w-4 h-4" />
                  </Button>
                )}

                <Button
                  variant="outline"
                  onClick={() => setLocation("/preferences")}
                  className="rounded-xl border-slate-200 text-slate-700 hover:bg-slate-100 flex items-center gap-2"
                >
                  <Bell className="w-4 h-4 text-slate-500" />
                  <span>Mes alertes email</span>
                </Button>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="min-h-screen w-full bg-slate-50 text-slate-900 flex flex-col relative overflow-hidden">
        <TopBar />
        <div className="flex-1 flex items-center justify-center px-4 pt-28 sm:pt-32 relative z-10">
          <div className="text-center bg-white/90 backdrop-blur-xl border border-slate-200/90 p-10 sm:p-12 rounded-3xl shadow-xl shadow-slate-900/5 max-w-md w-full">
            <div className="w-14 h-14 border-4 border-emerald-200 border-t-emerald-600 rounded-full animate-spin mx-auto mb-6 shadow-xs" />
            <h2 className="text-lg font-bold text-slate-900">Chargement de la feuille de route...</h2>
            <p className="text-xs text-slate-500 mt-2">Récupération de vos jalons et ressources d'apprentissage</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen w-full bg-background">
      <TopBar />

      <main className="container max-w-[1600px] mx-auto px-4 sm:px-8 py-6 sm:py-12 pt-24 sm:pt-28">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
          <aside className="lg:col-span-3 lg:sticky lg:top-28 lg:self-start space-y-6">
            <RoadmapSwitcher roadmaps={roadmaps} activeId={active?.id ?? null} onChange={setActiveId} />
            {isMentor() && (
              <>
                <Button
                  onClick={() => setAiModalOpen(true)}
                  className="w-full bg-gradient-to-br from-emerald-600 to-teal-600 text-white font-semibold py-4 rounded-2xl shadow-lg hover:shadow-xl hover-elevate transition-all duration-300 glow"
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
            <div className="glass-card rounded-3xl p-4 sm:p-8">
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
                onAddLab={() => openModal("lab")}
                onEditLab={(lab) => { setEditingLab(lab); openModal("lab"); }}
                onDeleteLab={(id) => confirm("Supprimer ce lab ?") && deleteLabMutation.mutate(id)}
                isLoadingComment={addCommentMutation.isPending}
              />
            </div>
          </section>

          <aside className="lg:col-span-3 lg:sticky lg:top-28 lg:self-start">
            <div className="glass-card rounded-3xl p-4 sm:p-6">
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

      <LabModal
        isOpen={modals.lab}
        onClose={() => closeModal("lab")}
        onSubmit={(data) => editingLab ? updateLabMutation.mutate(data) : createLabMutation.mutate(data)}
        weekId={selectedWeekId!}
        lab={editingLab}
        isLoading={createLabMutation.isPending || updateLabMutation.isPending}
      />

      <AIRoadmapModal
        open={aiModalOpen}
        onClose={() => setAiModalOpen(false)}
        onSave={handleSaveAIRoadmap}
        existingWeeks={weeks || []}
      />
    </div>
  );
}
