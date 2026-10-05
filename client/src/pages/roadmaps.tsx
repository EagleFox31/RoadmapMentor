import { useEffect, useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { ArrowLeft, Loader2, Plus, Search, UserPlus } from "lucide-react";
import { useLocation } from "wouter";
import { TopBar } from "@/components/top-bar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { isMentor } from "@/lib/auth";
import { useToast } from "@/hooks/use-toast";

type RoadmapSummary = { id: number; title: string; description: string | null };

type Person = { id: number; fullName: string; email: string };

type MentorshipEntry = {
  id: number;
  roadmapId: number;
  mentorId: number;
  learnerId: number;
  status: "ACTIVE" | "PAUSED" | "COMPLETED" | "CANCELLED";
  mentor: Person | null;
  learner: Person | null;
};

const STATUS_LABEL: Record<MentorshipEntry["status"], string> = {
  ACTIVE: "Actif",
  PAUSED: "En pause",
  COMPLETED: "Terminé",
  CANCELLED: "Annulé",
};

const errorMessage = (error: unknown) =>
  error instanceof Error ? error.message.replace(/^\d{3}:\s*/, "") : "Une erreur est survenue.";

export default function RoadmapsPage() {
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const mentor = isMentor();

  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [roadmapForm, setRoadmapForm] = useState({ title: "", description: "" });
  const [email, setEmail] = useState("");
  const [found, setFound] = useState<Person | null>(null);
  const [lookupError, setLookupError] = useState<string | null>(null);

  const roadmaps = useQuery<RoadmapSummary[]>({ queryKey: ["/api/roadmaps"] });
  const mentorships = useQuery<MentorshipEntry[]>({ queryKey: ["/api/mentorships"] });

  const roadmapList = roadmaps.data ?? [];
  useEffect(() => {
    if (selectedId === null && roadmapList.length) setSelectedId(roadmapList[0].id);
  }, [selectedId, roadmapList]);

  const selected = roadmapList.find((roadmap) => roadmap.id === selectedId) ?? null;
  const selectedMentorships = (mentorships.data ?? []).filter((entry) => entry.roadmapId === selectedId);

  const createRoadmap = useMutation({
    mutationFn: () =>
      apiRequest("POST", "/api/roadmaps", {
        title: roadmapForm.title.trim(),
        description: roadmapForm.description.trim() || null,
      }) as Promise<RoadmapSummary>,
    onSuccess: (roadmap) => {
      queryClient.invalidateQueries({ queryKey: ["/api/roadmaps"] });
      setRoadmapForm({ title: "", description: "" });
      setSelectedId(roadmap.id);
      toast({ title: "Roadmap créée", description: roadmap.title });
    },
    onError: (error) =>
      toast({ variant: "destructive", title: "Création impossible", description: errorMessage(error) }),
  });

  const lookup = useMutation({
    mutationFn: () =>
      apiRequest("GET", "/api/learners/lookup?email=" + encodeURIComponent(email.trim())) as Promise<Person>,
    onMutate: () => {
      setFound(null);
      setLookupError(null);
    },
    onSuccess: setFound,
    onError: (error) =>
      setLookupError(
        /^404/.test(error instanceof Error ? error.message : "")
          ? "Aucun apprenant avec cet e-mail. Il doit d’abord créer son compte."
          : errorMessage(error),
      ),
  });

  const attach = useMutation({
    mutationFn: (learnerId: number) =>
      apiRequest("POST", `/api/roadmaps/${selectedId}/mentorships`, { learnerId }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/mentorships"] });
      toast({ title: "Apprenant rattaché", description: `${found?.fullName} voit désormais cette roadmap.` });
      setFound(null);
      setEmail("");
    },
    onError: (error) =>
      toast({ variant: "destructive", title: "Rattachement impossible", description: errorMessage(error) }),
  });

  const alreadyAttached = found
    ? selectedMentorships.some((entry) => entry.learnerId === found.id)
    : false;

  const loading = roadmaps.isLoading || mentorships.isLoading;
  const failed = roadmaps.error || mentorships.error;

  return (
    <div className="min-h-screen w-full bg-background">
      <TopBar />
      <main className="mx-auto max-w-6xl px-4 pb-16 pt-28">
        <Button variant="ghost" onClick={() => setLocation("/roadmap")} className="mb-4 text-slate-300">
          <ArrowLeft className="mr-2 h-4 w-4" /> Retour à la roadmap
        </Button>
        <h1 className="mb-2 text-3xl font-bold text-foreground">
          {mentor ? "Roadmaps et apprenants" : "Mes roadmaps"}
        </h1>
        <p className="mb-8 text-slate-400">
          {mentor
            ? "Créez une roadmap, puis rattachez-y un apprenant déjà inscrit."
            : "Les roadmaps auxquelles votre mentor vous a rattaché."}
        </p>

        {loading && (
          <div className="flex items-center gap-3 text-slate-300" role="status">
            <Loader2 className="h-5 w-5 animate-spin" /> Chargement…
          </div>
        )}

        {failed && !loading && (
          <div className="rounded-2xl border border-red-400/30 bg-red-500/10 p-6 text-red-200" role="alert">
            Impossible de charger vos roadmaps. {errorMessage(failed)}
            <Button
              variant="outline"
              className="ml-4"
              onClick={() => {
                roadmaps.refetch();
                mentorships.refetch();
              }}
            >
              Réessayer
            </Button>
          </div>
        )}

        {!loading && !failed && (
          <div className="grid gap-8 lg:grid-cols-[320px_1fr]">
            <section className="space-y-4" aria-label="Roadmaps">
              {roadmapList.length === 0 && (
                <div
                  className="rounded-2xl border border-white/10 bg-white/5 p-6 text-slate-400"
                  data-testid="roadmaps-empty"
                >
                  {mentor
                    ? "Vous n’avez pas encore de roadmap. Créez la première ci-dessous."
                    : "Aucune roadmap ne vous est rattachée pour le moment. Demandez à votre mentor de vous inviter avec votre e-mail d’inscription."}
                </div>
              )}
              {roadmapList.map((roadmap) => (
                <button
                  key={roadmap.id}
                  type="button"
                  onClick={() => {
                    setSelectedId(roadmap.id);
                    setFound(null);
                    setLookupError(null);
                  }}
                  className={`w-full rounded-2xl border p-4 text-left transition ${
                    roadmap.id === selectedId
                      ? "border-primary/60 bg-primary/10"
                      : "border-white/10 bg-white/5 hover:border-white/20"
                  }`}
                  data-testid={`roadmap-item-${roadmap.id}`}
                >
                  <div className="font-semibold text-foreground">{roadmap.title}</div>
                  {roadmap.description && (
                    <div className="mt-1 line-clamp-2 text-sm text-slate-400">{roadmap.description}</div>
                  )}
                </button>
              ))}

              {mentor && (
                <form
                  className="space-y-3 rounded-2xl border border-white/10 bg-white/5 p-4"
                  onSubmit={(event) => {
                    event.preventDefault();
                    if (roadmapForm.title.trim()) createRoadmap.mutate();
                  }}
                >
                  <h2 className="font-semibold text-foreground">Nouvelle roadmap</h2>
                  <Input
                    placeholder="Titre"
                    value={roadmapForm.title}
                    onChange={(event) => setRoadmapForm({ ...roadmapForm, title: event.target.value })}
                    data-testid="input-roadmap-title"
                  />
                  <Textarea
                    placeholder="Description (optionnelle)"
                    value={roadmapForm.description}
                    onChange={(event) => setRoadmapForm({ ...roadmapForm, description: event.target.value })}
                  />
                  <Button
                    type="submit"
                    disabled={!roadmapForm.title.trim() || createRoadmap.isPending}
                    data-testid="button-create-roadmap"
                  >
                    {createRoadmap.isPending ? (
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    ) : (
                      <Plus className="mr-2 h-4 w-4" />
                    )}
                    Créer
                  </Button>
                </form>
              )}
            </section>

            <section className="space-y-6" aria-label="Mentorats">
              {!selected ? (
                <div className="rounded-2xl border border-white/10 bg-white/5 p-8 text-slate-400">
                  Sélectionnez une roadmap.
                </div>
              ) : (
                <>
                  <div className="flex flex-wrap items-center gap-3">
                    <h2 className="text-xl font-semibold text-foreground">{selected.title}</h2>
                    <Button variant="outline" size="sm" onClick={() => setLocation("/mentoring")}>
                      Mentorat et scope
                    </Button>
                  </div>

                  <div className="space-y-3">
                    {selectedMentorships.length === 0 ? (
                      <div
                        className="rounded-2xl border border-white/10 bg-white/5 p-6 text-slate-400"
                        data-testid="mentorships-empty"
                      >
                        {mentor
                          ? "Aucun apprenant rattaché à cette roadmap."
                          : "Aucun mentorat actif sur cette roadmap."}
                      </div>
                    ) : (
                      selectedMentorships.map((entry) => (
                        <div
                          key={entry.id}
                          className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-white/10 bg-white/5 p-4"
                        >
                          <div>
                            <div className="font-medium text-foreground">
                              {entry.learner?.fullName ?? "Apprenant"}
                            </div>
                            <div className="text-sm text-slate-400">
                              {entry.learner?.email} · mentor : {entry.mentor?.fullName ?? "—"}
                            </div>
                          </div>
                          <Badge variant="outline">{STATUS_LABEL[entry.status]}</Badge>
                        </div>
                      ))
                    )}
                  </div>

                  {mentor && (
                    <form
                      className="space-y-3 rounded-2xl border border-white/10 bg-white/5 p-4"
                      onSubmit={(event) => {
                        event.preventDefault();
                        if (email.trim()) lookup.mutate();
                      }}
                    >
                      <h3 className="font-semibold text-foreground">Rattacher un apprenant</h3>
                      <div className="flex gap-2">
                        <Input
                          type="email"
                          placeholder="E-mail d’inscription de l’apprenant"
                          value={email}
                          onChange={(event) => {
                            setEmail(event.target.value);
                            setFound(null);
                            setLookupError(null);
                          }}
                          data-testid="input-learner-email"
                        />
                        <Button
                          type="submit"
                          variant="outline"
                          disabled={!email.trim() || lookup.isPending}
                          data-testid="button-lookup-learner"
                        >
                          {lookup.isPending ? (
                            <Loader2 className="h-4 w-4 animate-spin" />
                          ) : (
                            <Search className="h-4 w-4" />
                          )}
                          <span className="ml-2">Rechercher</span>
                        </Button>
                      </div>
                      {lookupError && (
                        <p className="text-sm text-red-300" role="alert">
                          {lookupError}
                        </p>
                      )}
                      {found && (
                        <div
                          className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-white/10 p-3"
                          data-testid="learner-found"
                        >
                          <div>
                            <div className="font-medium text-foreground">{found.fullName}</div>
                            <div className="text-sm text-slate-400">{found.email}</div>
                          </div>
                          {alreadyAttached ? (
                            <Badge variant="outline">Déjà rattaché à cette roadmap</Badge>
                          ) : (
                            <Button
                              type="button"
                              disabled={attach.isPending}
                              onClick={() => attach.mutate(found.id)}
                              data-testid="button-attach-learner"
                            >
                              {attach.isPending ? (
                                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                              ) : (
                                <UserPlus className="mr-2 h-4 w-4" />
                              )}
                              Rattacher
                            </Button>
                          )}
                        </div>
                      )}
                    </form>
                  )}
                </>
              )}
            </section>
          </div>
        )}
      </main>
    </div>
  );
}
