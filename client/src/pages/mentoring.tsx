import { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import {
  ArrowLeft,
  ArrowRight,
  BriefcaseBusiness,
  Calendar,
  CheckCircle2,
  CircleDollarSign,
  Compass,
  CreditCard,
  Loader2,
  PackageCheck,
  ReceiptText,
  Send,
  XCircle,
} from "lucide-react";
import { useLocation } from "wouter";
import { TopBar } from "@/components/top-bar";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { isLearner, isMentor } from "@/lib/auth";
import { useToast } from "@/hooks/use-toast";
import { MentoringSessions } from "@/components/mentoring-sessions";
import { MentoringBilling } from "@/components/mentoring-billing";
import type { ChangeRequest, MentoringPackageWithScope, WeekWithDetails } from "@shared/schema";

type MentorshipView = {
  id: number;
  roadmapId: number;
  mentorId: number;
  learnerId: number;
  status: "ACTIVE" | "PAUSED" | "COMPLETED" | "CANCELLED";
  roadmap: { id: number; title: string; description: string | null };
  mentor: { id: number; fullName: string; email: string } | null;
  learner: { id: number; fullName: string; email: string } | null;
};

const formatMoney = (amount: number | null, currency: string) =>
  amount === null
    ? "À chiffrer"
    : new Intl.NumberFormat("fr-FR", {
        style: "currency",
        currency,
        maximumFractionDigits: currency === "XAF" ? 0 : 2,
      }).format(amount);

export default function MentoringPage() {
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [packageForm, setPackageForm] = useState({
    title: "", price: "", currency: "XAF", periodStart: "", periodEnd: "",
    sessions: "", duration: "", schedule: "", description: "", scopeItems: "",
  });
  const [requestForm, setRequestForm] = useState({ packageId: "", title: "", description: "" });
  const [quoteDrafts, setQuoteDrafts] = useState<Record<number, { price: string; taskId: string }>>({});

  const { data: mentorships = [], isLoading } = useQuery<MentorshipView[]>({
    queryKey: ["/api/mentorships"],
  });

  useEffect(() => {
    if (!selectedId && mentorships.length) setSelectedId(mentorships[0].id);
  }, [selectedId, mentorships]);

  const selected = mentorships.find((item) => item.id === selectedId) || null;
  const packagesKey = ["/api/mentorships", selectedId || "none", "packages"];
  const changesKey = ["/api/mentorships", selectedId || "none", "change-requests"];

  const { data: packages = [] } = useQuery<MentoringPackageWithScope[]>({
    queryKey: packagesKey,
    enabled: Boolean(selectedId),
    queryFn: () => apiRequest("GET", "/api/mentorships/" + selectedId + "/packages"),
  });

  const { data: changes = [] } = useQuery<ChangeRequest[]>({
    queryKey: changesKey,
    enabled: Boolean(selectedId),
    queryFn: () => apiRequest("GET", "/api/mentorships/" + selectedId + "/change-requests"),
  });

  const { data: weeks = [] } = useQuery<WeekWithDetails[]>({
    queryKey: ["/api/weeks", selected?.roadmap.id || "none"],
    enabled: Boolean(selected && isMentor()),
    queryFn: () => apiRequest("GET", "/api/weeks?roadmapId=" + selected?.roadmap.id),
  });

  const tasks = useMemo(() =>
    weeks.flatMap((week) =>
      week.objectives.flatMap((objective) =>
        objective.tasks.map((task) => ({ id: task.id, label: "S" + week.number + " · " + task.label })),
      ),
    ), [weeks]);

  const createPackage = useMutation({
    mutationFn: () => apiRequest("POST", "/api/mentorships/" + selectedId + "/packages", {
      title: packageForm.title,
      basePriceMinor: Number(packageForm.price),
      currency: packageForm.currency,
      periodStart: packageForm.periodStart,
      periodEnd: packageForm.periodEnd,
      includedSessionCount: Number(packageForm.sessions),
      includedSessionDurationMinutes: packageForm.duration ? Number(packageForm.duration) : null,
      sessionSchedule: packageForm.schedule || null,
      scopeDescription: packageForm.description,
      scopeItems: packageForm.scopeItems.split("\n").map((x) => x.trim()).filter(Boolean).map((title) => ({ title })),
    }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: packagesKey });
      setPackageForm({ title: "", price: "", currency: "XAF", periodStart: "", periodEnd: "", sessions: "", duration: "", schedule: "", description: "", scopeItems: "" });
      toast({ title: "Forfait enregistré", description: "Le scope initial est figé dans l’historique." });
    },
  });

  const createRequest = useMutation({
    mutationFn: () => apiRequest("POST", "/api/mentorships/" + selectedId + "/change-requests", {
      packageId: Number(requestForm.packageId), title: requestForm.title, description: requestForm.description,
    }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: changesKey });
      setRequestForm({ packageId: "", title: "", description: "" });
      toast({ title: "Demande envoyée", description: "Elle reste hors scope tant que le supplément n’est pas accepté." });
    },
  });

  const quoteRequest = useMutation({
    mutationFn: (id: number) => {
      const draft = quoteDrafts[id];
      if (!draft?.price || !draft?.taskId) throw new Error("Prix et tâche liée requis.");
      const request = changes.find((item) => item.id === id);
      const packageItem = packages.find((item) => item.id === request?.packageId);
      return apiRequest("POST", "/api/change-requests/" + id + "/quote", {
        quotedPriceMinor: Number(draft.price),
        currency: packageItem?.currency || "XAF",
        linkedTaskId: Number(draft.taskId),
      });
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: changesKey }),
  });

  const decide = useMutation({
    mutationFn: ({ id, decision }: { id: number; decision: "ACCEPT" | "REJECT" }) =>
      apiRequest("POST", "/api/change-requests/" + id + "/decision", { decision }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: changesKey }),
  });

  const deliver = useMutation({
    mutationFn: (id: number) => apiRequest("POST", "/api/change-requests/" + id + "/deliver", {}),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: changesKey }),
  });

  return (
    <div className="min-h-screen w-full bg-slate-50 text-slate-900 flex flex-col relative overflow-hidden">
      <TopBar />

      <main className="mx-auto w-full max-w-7xl px-4 sm:px-6 lg:px-8 pb-16 pt-24 sm:pt-28 relative z-10 flex-1">
        {/* Carte En-tête Unifiée */}
        <Card className="mb-6 rounded-3xl border-slate-200/80 bg-white/95 backdrop-blur-xl p-6 sm:p-8 shadow-xs">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="space-y-3">
              <div className="flex flex-wrap items-center gap-3">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setLocation("/roadmap")}
                  className="text-slate-600 hover:text-slate-900 hover:bg-slate-100 rounded-xl text-xs font-semibold px-3 py-1.5 h-auto transition-colors"
                  data-testid="button-back-roadmap"
                >
                  <ArrowLeft className="mr-1.5 h-3.5 w-3.5" /> Retour à la feuille de route
                </Button>
                <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs font-semibold">
                  <BriefcaseBusiness className="w-3.5 h-3.5" />
                  <span>{isMentor() ? "Espace Mentor • Forfaits & Suivi" : "Espace Apprenant • Accompagnement"}</span>
                </div>
              </div>
              <div>
                <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-slate-900">
                  Mentorat & forfaits d'accompagnement
                </h1>
                <p className="text-sm text-slate-600 mt-1">
                  Inclus au forfait, séances de mentorat, demandes additionnelles et facturation.
                </p>
              </div>
            </div>
          </div>
        </Card>

        <div className="grid gap-6 lg:grid-cols-[280px_1fr]">
          {/* 1. Sidebar des accompagnements */}
          <Card className="h-fit rounded-3xl border-slate-200/80 bg-white/95 backdrop-blur-xl p-5 shadow-xs space-y-4">
            <h2 className="text-sm font-bold text-slate-900 uppercase tracking-wider">
              Accompagnements
            </h2>
            {isLoading ? (
              <div className="flex items-center gap-2 text-slate-500 text-sm py-4">
                <Loader2 className="h-4 w-4 animate-spin" />
                <span>Chargement…</span>
              </div>
            ) : mentorships.length === 0 ? (
              <p className="text-xs text-slate-500 p-3 rounded-2xl bg-slate-50 border border-slate-200/60">
                Aucun accompagnement rattaché.
              </p>
            ) : (
              mentorships.map((m) => (
                <button
                  key={m.id}
                  onClick={() => setSelectedId(m.id)}
                  className={`w-full rounded-2xl border p-4 text-left transition-all ${
                    selectedId === m.id
                      ? "border-emerald-500/60 bg-emerald-50/80 text-emerald-950 shadow-xs ring-2 ring-emerald-500/10"
                      : "border-slate-200/70 bg-white hover:border-slate-300 hover:bg-slate-50 text-slate-700"
                  }`}
                >
                  <p className="font-semibold text-sm leading-snug">{m.roadmap.title}</p>
                  <p className="mt-1 text-xs text-slate-500 font-medium">
                    {isMentor() ? m.learner?.fullName : m.mentor?.fullName}
                  </p>
                </button>
              ))
            )}
          </Card>

          {/* 2. Zone principale */}
          <section className="space-y-6">
            {!selected ? (
              <Card className="rounded-3xl border-slate-200/80 bg-white/95 backdrop-blur-xl p-8 sm:p-10 shadow-xs text-center space-y-8">
                <div className="max-w-2xl mx-auto space-y-3">
                  <div className="w-16 h-16 rounded-3xl bg-gradient-to-br from-emerald-500/20 to-teal-500/20 border border-emerald-300/40 text-emerald-700 flex items-center justify-center mx-auto shadow-sm">
                    <BriefcaseBusiness className="w-8 h-8 text-emerald-700" />
                  </div>
                  <h2 className="text-xl sm:text-2xl font-extrabold text-slate-900">
                    Accompagnement & Mentorat Andragogique
                  </h2>
                  <p className="text-xs sm:text-sm text-slate-600 max-w-lg mx-auto leading-relaxed">
                    Un suivi individuel structuré pour consolider vos compétences techniques sur ShopFlow, valider vos jalons et préparer votre autonomie professionnelle.
                  </p>
                </div>

                {/* 3 piliers du mentorat */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-left">
                  <div className="p-5 rounded-2xl bg-gradient-to-b from-slate-50 to-slate-100/50 border border-slate-200/70 space-y-2">
                    <div className="flex items-center gap-2">
                      <div className="p-2 rounded-xl bg-emerald-100 text-emerald-800">
                        <PackageCheck className="w-4 h-4" />
                      </div>
                      <span className="text-xs font-bold text-emerald-800 uppercase tracking-wider">
                        Scope maîtrisé
                      </span>
                    </div>
                    <h3 className="text-sm font-bold text-slate-900">Forfaits clairs</h3>
                    <p className="text-xs text-slate-600 leading-relaxed">
                      Séances incluses, calendrier prévisionnel et périmètre technique transparent.
                    </p>
                  </div>

                  <div className="p-5 rounded-2xl bg-gradient-to-b from-slate-50 to-slate-100/50 border border-slate-200/70 space-y-2">
                    <div className="flex items-center gap-2">
                      <div className="p-2 rounded-xl bg-teal-100 text-teal-800">
                        <Calendar className="w-4 h-4" />
                      </div>
                      <span className="text-xs font-bold text-teal-800 uppercase tracking-wider">
                        Séances 1:1
                      </span>
                    </div>
                    <h3 className="text-sm font-bold text-slate-900">Revues de code</h3>
                    <p className="text-xs text-slate-600 leading-relaxed">
                      Sessions de déblocage en direct, retours constructifs et préparation aux entretiens.
                    </p>
                  </div>

                  <div className="p-5 rounded-2xl bg-gradient-to-b from-slate-50 to-slate-100/50 border border-slate-200/70 space-y-2">
                    <div className="flex items-center gap-2">
                      <div className="p-2 rounded-xl bg-amber-100 text-amber-800">
                        <CreditCard className="w-4 h-4" />
                      </div>
                      <span className="text-xs font-bold text-amber-800 uppercase tracking-wider">
                        Transparence
                      </span>
                    </div>
                    <h3 className="text-sm font-bold text-slate-900">Facturation & Devis</h3>
                    <p className="text-xs text-slate-600 leading-relaxed">
                      Validation explicite de tout travail additionnel avant engagement.
                    </p>
                  </div>
                </div>

                <div className="flex flex-wrap items-center justify-center gap-3 pt-2">
                  <Button
                    onClick={() => setLocation("/roadmaps")}
                    className="bg-emerald-600 hover:bg-emerald-700 text-white font-semibold rounded-xl px-5 py-2.5 shadow-md shadow-emerald-950/10 flex items-center gap-2 text-xs sm:text-sm"
                  >
                    <span>{isMentor() ? "Gérer mes apprenants" : "Voir mes roadmaps"}</span>
                    <ArrowRight className="w-4 h-4" />
                  </Button>
                  <Button
                    variant="outline"
                    onClick={() => setLocation("/roadmap")}
                    className="rounded-xl border-slate-200 text-slate-700 hover:bg-slate-100 flex items-center gap-2 text-xs sm:text-sm"
                  >
                    <Compass className="w-4 h-4 text-slate-500" />
                    <span>Feuille de route</span>
                  </Button>
                </div>
              </Card>
            ) : (
              <>
                {/* Bandeau d'en-tête du mentorat sélectionné */}
                <Card className="rounded-3xl border-emerald-200/80 bg-gradient-to-r from-emerald-500/10 via-teal-500/5 to-white/90 backdrop-blur-xl p-6 shadow-xs">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                    <div>
                      <span className="text-[11px] font-bold uppercase tracking-wider text-emerald-800">
                        {selected.roadmap.title}
                      </span>
                      <h2 className="mt-1 text-2xl font-extrabold text-slate-900">
                        {isMentor() ? selected.learner?.fullName : selected.mentor?.fullName}
                      </h2>
                      <p className="text-xs text-slate-500 mt-0.5">
                        {isMentor() ? `Apprenant : ${selected.learner?.email}` : `Mentor : ${selected.mentor?.email}`}
                      </p>
                    </div>
                    <Badge className="w-fit bg-emerald-100 text-emerald-800 border-emerald-200 px-3 py-1 text-xs font-semibold">
                      {selected.status === "ACTIVE" ? "Accompagnement actif" : selected.status}
                    </Badge>
                  </div>
                </Card>

                <div className="grid gap-6 xl:grid-cols-2">
                  {/* Colonne Scope Inclus sous forme de Card structurée */}
                  <Card className="rounded-3xl border-slate-200/80 bg-white/95 backdrop-blur-xl shadow-xs overflow-hidden">
                    <CardHeader className="p-6 pb-4 border-b border-slate-100 flex flex-row items-center justify-between">
                      <div className="flex items-center gap-2.5">
                        <div className="p-2 rounded-xl bg-emerald-50 text-emerald-700 border border-emerald-200/60">
                          <PackageCheck className="w-4 h-4" />
                        </div>
                        <div>
                          <CardTitle className="text-base font-bold text-slate-900">
                            Scope inclus au forfait
                          </CardTitle>
                          <CardDescription className="text-xs text-slate-500 mt-0.5">
                            Prestations, séances et périmètre inclus dans le forfait.
                          </CardDescription>
                        </div>
                      </div>
                      <Badge variant="outline" className="text-xs font-semibold bg-slate-50 border-slate-200 text-slate-600">
                        {packages.length}
                      </Badge>
                    </CardHeader>
                    <CardContent className="p-6 space-y-4">
                      {packages.length === 0 ? (
                        <div className="rounded-2xl border border-dashed border-slate-200 bg-slate-50/60 p-6 text-center space-y-1">
                          <PackageCheck className="w-6 h-6 text-slate-400 mx-auto mb-1" />
                          <p className="text-xs text-slate-600 font-medium">Aucun forfait configuré pour le moment.</p>
                        </div>
                      ) : (
                        packages.map((p) => (
                          <article key={p.id} className="rounded-2xl border border-slate-200/80 bg-slate-50/50 p-5 shadow-2xs space-y-3">
                            <div className="flex items-start justify-between gap-4">
                              <div>
                                <h3 className="font-bold text-slate-900">{p.title}</h3>
                                <p className="mt-1 text-2xl font-extrabold text-emerald-700">
                                  {formatMoney(p.basePriceMinor, p.currency)}
                                </p>
                              </div>
                              <Badge className="bg-emerald-50 text-emerald-800 border-emerald-200 font-semibold text-xs">
                                Inclus
                              </Badge>
                            </div>
                            <p className="text-xs text-slate-600 font-medium">
                              {p.periodStart} → {p.periodEnd} · {p.includedSessionCount} séance(s)
                            </p>
                            {p.sessionSchedule && <p className="text-xs text-slate-500">{p.sessionSchedule}</p>}
                            <p className="text-xs text-slate-600 leading-relaxed">{p.scopeDescription}</p>
                            <div className="space-y-1.5 pt-1">
                              {p.scopeItems.map((item) => (
                                <div key={item.id} className="flex gap-2 rounded-xl bg-white border border-emerald-100 px-3 py-2 text-xs text-slate-800 shadow-2xs">
                                  <CheckCircle2 className="mt-0.5 h-3.5 w-3.5 text-emerald-600 shrink-0" />
                                  <span>{item.title}</span>
                                </div>
                              ))}
                            </div>
                          </article>
                        ))
                      )}

                      {/* Formulaire nouveau forfait (mentor) */}
                      {isMentor() && (
                        <div className="rounded-2xl border border-slate-200/80 bg-slate-50/40 p-5 shadow-2xs space-y-3">
                          <h4 className="text-sm font-bold text-slate-900">Ajouter un nouveau forfait</h4>
                          <div className="grid gap-2.5 sm:grid-cols-2">
                            <Input
                              placeholder="Nom du forfait"
                              value={packageForm.title}
                              onChange={(e) => setPackageForm({ ...packageForm, title: e.target.value })}
                              className="bg-white border-slate-200 rounded-xl text-xs"
                            />
                            <div className="grid grid-cols-[1fr_80px] gap-2">
                              <Input
                                type="number"
                                placeholder="Prix"
                                value={packageForm.price}
                                onChange={(e) => setPackageForm({ ...packageForm, price: e.target.value })}
                                className="bg-white border-slate-200 rounded-xl text-xs"
                              />
                              <Input
                                maxLength={3}
                                value={packageForm.currency}
                                onChange={(e) => setPackageForm({ ...packageForm, currency: e.target.value.toUpperCase() })}
                                className="bg-white border-slate-200 rounded-xl uppercase text-xs"
                              />
                            </div>
                            <Input
                              type="date"
                              value={packageForm.periodStart}
                              onChange={(e) => setPackageForm({ ...packageForm, periodStart: e.target.value })}
                              className="bg-white border-slate-200 rounded-xl text-xs"
                            />
                            <Input
                              type="date"
                              value={packageForm.periodEnd}
                              onChange={(e) => setPackageForm({ ...packageForm, periodEnd: e.target.value })}
                              className="bg-white border-slate-200 rounded-xl text-xs"
                            />
                            <Input
                              type="number"
                              placeholder="Séances incluses"
                              value={packageForm.sessions}
                              onChange={(e) => setPackageForm({ ...packageForm, sessions: e.target.value })}
                              className="bg-white border-slate-200 rounded-xl text-xs"
                            />
                            <Input
                              type="number"
                              placeholder="Durée en minutes"
                              value={packageForm.duration}
                              onChange={(e) => setPackageForm({ ...packageForm, duration: e.target.value })}
                              className="bg-white border-slate-200 rounded-xl text-xs"
                            />
                          </div>
                          <Input
                            placeholder="Planning inclus (ex: Samedi 10h)"
                            value={packageForm.schedule}
                            onChange={(e) => setPackageForm({ ...packageForm, schedule: e.target.value })}
                            className="bg-white border-slate-200 rounded-xl text-xs"
                          />
                          <Textarea
                            placeholder="Description du scope inclus…"
                            value={packageForm.description}
                            onChange={(e) => setPackageForm({ ...packageForm, description: e.target.value })}
                            className="bg-white border-slate-200 rounded-xl text-xs resize-none"
                          />
                          <Textarea
                            placeholder="Éléments inclus — un par ligne"
                            value={packageForm.scopeItems}
                            onChange={(e) => setPackageForm({ ...packageForm, scopeItems: e.target.value })}
                            className="bg-white border-slate-200 rounded-xl text-xs resize-none"
                          />
                          <Button
                            className="w-full bg-emerald-600 hover:bg-emerald-700 text-white font-semibold rounded-xl text-xs shadow-xs"
                            onClick={() => createPackage.mutate()}
                            disabled={createPackage.isPending}
                          >
                            {createPackage.isPending && <Loader2 className="mr-2 h-3.5 w-3.5 animate-spin" />}
                            <span>Enregistrer le forfait</span>
                          </Button>
                        </div>
                      )}
                    </CardContent>
                  </Card>

                  {/* Colonne Hors Scope sous forme de Card structurée */}
                  <Card className="rounded-3xl border-slate-200/80 bg-white/95 backdrop-blur-xl shadow-xs overflow-hidden">
                    <CardHeader className="p-6 pb-4 border-b border-slate-100 flex flex-row items-center justify-between">
                      <div className="flex items-center gap-2.5">
                        <div className="p-2 rounded-xl bg-amber-50 text-amber-700 border border-amber-200/60">
                          <ReceiptText className="w-4 h-4" />
                        </div>
                        <div>
                          <CardTitle className="text-base font-bold text-slate-900">
                            Demandes additionnelles (Hors scope)
                          </CardTitle>
                          <CardDescription className="text-xs text-slate-500 mt-0.5">
                            Prestations et besoins chiffrés en supplément du forfait.
                          </CardDescription>
                        </div>
                      </div>
                      <Badge variant="outline" className="text-xs font-semibold bg-slate-50 border-slate-200 text-slate-600">
                        {changes.length}
                      </Badge>
                    </CardHeader>
                    <CardContent className="p-6 space-y-4">
                      {isLearner() && packages.length > 0 && (
                        <div className="rounded-2xl border border-amber-200 bg-amber-50/60 p-5 space-y-3">
                          <p className="text-xs text-amber-800 font-medium">
                            Toute demande formulée ici fait l'objet d'un chiffrage additionnel au forfait initial.
                          </p>
                          <select
                            value={requestForm.packageId}
                            onChange={(e) => setRequestForm({ ...requestForm, packageId: e.target.value })}
                            className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs text-slate-800 shadow-2xs"
                          >
                            <option value="">Sélectionner le forfait concerné</option>
                            {packages.map((p) => (
                              <option key={p.id} value={p.id}>{p.title}</option>
                            ))}
                          </select>
                          <Input
                            placeholder="Sujet de la demande"
                            value={requestForm.title}
                            onChange={(e) => setRequestForm({ ...requestForm, title: e.target.value })}
                            className="bg-white border-slate-200 rounded-xl text-xs"
                          />
                          <Textarea
                            placeholder="Détail du besoin additionnel…"
                            value={requestForm.description}
                            onChange={(e) => setRequestForm({ ...requestForm, description: e.target.value })}
                            className="bg-white border-slate-200 rounded-xl text-xs resize-none"
                          />
                          <Button
                            className="w-full bg-amber-600 hover:bg-amber-700 text-white font-semibold rounded-xl text-xs shadow-xs"
                            onClick={() => createRequest.mutate()}
                            disabled={createRequest.isPending}
                          >
                            <Send className="mr-2 h-3.5 w-3.5" />
                            <span>Envoyer la demande hors scope</span>
                          </Button>
                        </div>
                      )}

                      {changes.length === 0 ? (
                        <div className="rounded-2xl border border-dashed border-slate-200 bg-slate-50/60 p-6 text-center space-y-1">
                          <ReceiptText className="w-6 h-6 text-slate-400 mx-auto mb-1" />
                          <p className="text-xs text-slate-600 font-medium">Aucune demande hors scope en cours.</p>
                        </div>
                      ) : (
                        changes.map((r) => {
                          const draft = quoteDrafts[r.id] || { price: "", taskId: "" };
                          return (
                            <article key={r.id} className="rounded-2xl border border-slate-200/80 bg-slate-50/50 p-5 shadow-2xs space-y-3">
                              <div className="flex items-start justify-between gap-4">
                                <div>
                                  <p className="text-[10px] font-bold text-amber-700 uppercase tracking-wider">Hors scope</p>
                                  <h3 className="mt-0.5 font-bold text-sm text-slate-900">{r.title}</h3>
                                </div>
                                <Badge className="bg-amber-50 text-amber-800 border-amber-200 font-semibold text-xs">
                                  {r.status}
                                </Badge>
                              </div>
                              <p className="text-xs text-slate-600 leading-relaxed">{r.description}</p>
                              {r.quotedPriceMinor !== null && (
                                <div className="flex items-center gap-2 rounded-xl bg-amber-50/80 border border-amber-200/60 px-3 py-2 text-xs font-semibold text-amber-900">
                                  <CircleDollarSign className="h-4 w-4 text-amber-600" />
                                  <span>Supplément chiffré : {formatMoney(r.quotedPriceMinor, r.currency)}</span>
                                </div>
                              )}

                              {isMentor() && r.status === "PROPOSED" && (
                                <div className="grid gap-2 sm:grid-cols-[120px_1fr_auto] pt-1">
                                  <Input
                                    type="number"
                                    placeholder="Prix XAF"
                                    value={draft.price}
                                    onChange={(e) => setQuoteDrafts({ ...quoteDrafts, [r.id]: { ...draft, price: e.target.value } })}
                                    className="bg-white border-slate-200 rounded-xl text-xs"
                                  />
                                  <select
                                    value={draft.taskId}
                                    onChange={(e) => setQuoteDrafts({ ...quoteDrafts, [r.id]: { ...draft, taskId: e.target.value } })}
                                    className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs text-slate-800 shadow-2xs"
                                  >
                                    <option value="">Tâche de roadmap liée</option>
                                    {tasks.map((t) => (
                                      <option key={t.id} value={t.id}>{t.label}</option>
                                    ))}
                                  </select>
                                  <Button
                                    className="bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl font-semibold text-xs"
                                    onClick={() => quoteRequest.mutate(r.id)}
                                  >
                                    Chiffrer
                                  </Button>
                                </div>
                              )}

                              {isLearner() && r.status === "QUOTED" && (
                                <div className="flex gap-2 pt-1">
                                  <Button
                                    className="flex-1 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl font-semibold text-xs"
                                    onClick={() => decide.mutate({ id: r.id, decision: "ACCEPT" })}
                                  >
                                    <CheckCircle2 className="mr-1.5 h-3.5 w-3.5" />
                                    Accepter le devis
                                  </Button>
                                  <Button
                                    variant="outline"
                                    className="flex-1 rounded-xl border-slate-200 text-slate-700 hover:bg-rose-50 hover:text-rose-600 text-xs"
                                    onClick={() => decide.mutate({ id: r.id, decision: "REJECT" })}
                                  >
                                    <XCircle className="mr-1.5 h-3.5 w-3.5" />
                                    Refuser
                                  </Button>
                                </div>
                              )}

                              {isMentor() && r.status === "ACCEPTED" && (
                                <Button
                                  className="w-full bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl font-semibold text-xs mt-1"
                                  onClick={() => deliver.mutate(r.id)}
                                >
                                  Marquer comme livré
                                </Button>
                              )}
                            </article>
                          );
                        })
                      )}
                    </CardContent>
                  </Card>
                </div>

                <MentoringSessions
                  mentorshipId={selected.id}
                  packages={packages}
                  weeks={weeks}
                />

                <MentoringBilling
                  mentorshipId={selected.id}
                  packages={packages}
                />
              </>
            )}
          </section>
        </div>
      </main>
    </div>
  );
}
