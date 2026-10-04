import { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { ArrowLeft, CheckCircle2, CircleDollarSign, Loader2, PackageCheck, ReceiptText, Send, XCircle } from "lucide-react";
import { useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { isLearner, isMentor } from "@/lib/auth";
import { useToast } from "@/hooks/use-toast";
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
    <div className="min-h-screen bg-slate-950 text-white">
      <header className="sticky top-0 z-50 border-b border-white/10 bg-slate-950/90 backdrop-blur-xl">
        <div className="mx-auto flex max-w-[1450px] items-center gap-4 px-6 py-5">
          <Button variant="outline" size="icon" onClick={() => setLocation("/roadmap")} className="border-white/15 bg-white/5">
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <div>
            <h1 className="text-2xl font-bold">Mentorat & scope</h1>
            <p className="text-sm text-slate-400">Inclus au forfait, demandes additionnelles et validation du supplément.</p>
          </div>
        </div>
      </header>

      <main className="mx-auto grid max-w-[1450px] gap-6 px-6 py-8 lg:grid-cols-[270px_1fr]">
        <aside className="h-fit rounded-3xl border border-white/10 bg-white/5 p-4">
          <h2 className="mb-3 font-semibold">Accompagnements</h2>
          {isLoading ? <Loader2 className="h-5 w-5 animate-spin" /> : mentorships.map((m) => (
            <button key={m.id} onClick={() => setSelectedId(m.id)}
              className={"mb-2 w-full rounded-2xl border p-4 text-left " + (selectedId === m.id ? "border-sky-400/40 bg-sky-400/10" : "border-white/10 bg-black/10")}>
              <p className="font-medium">{m.roadmap.title}</p>
              <p className="mt-1 text-xs text-slate-400">{isMentor() ? m.learner?.fullName : m.mentor?.fullName}</p>
            </button>
          ))}
        </aside>

        <section className="space-y-6">
          {!selected ? <div className="rounded-3xl border border-white/10 bg-white/5 p-8 text-slate-400">Aucun mentorat sélectionné.</div> : <>
            <div className="rounded-3xl border border-white/10 bg-gradient-to-br from-sky-500/10 to-indigo-500/10 p-6">
              <p className="text-xs uppercase tracking-[0.18em] text-sky-300">{selected.roadmap.title}</p>
              <h2 className="mt-2 text-2xl font-bold">{isMentor() ? selected.learner?.fullName : selected.mentor?.fullName}</h2>
            </div>

            <div className="grid gap-6 xl:grid-cols-2">
              <div className="space-y-4">
                <div className="flex items-center gap-2"><PackageCheck className="h-5 w-5 text-emerald-300" /><h2 className="font-semibold">Scope inclus</h2></div>
                {packages.map((p) => (
                  <article key={p.id} className="rounded-3xl border border-white/10 bg-white/5 p-6">
                    <div className="flex items-start justify-between gap-4">
                      <div><h3 className="font-semibold">{p.title}</h3><p className="mt-1 text-2xl font-bold text-emerald-300">{formatMoney(p.basePriceMinor, p.currency)}</p></div>
                      <Badge className="bg-emerald-400/10 text-emerald-200">Inclus</Badge>
                    </div>
                    <p className="mt-3 text-sm text-slate-300">{p.periodStart} → {p.periodEnd} · {p.includedSessionCount} séance(s)</p>
                    {p.sessionSchedule && <p className="mt-2 text-sm text-slate-400">{p.sessionSchedule}</p>}
                    <p className="mt-4 text-sm text-slate-300">{p.scopeDescription}</p>
                    <div className="mt-4 space-y-2">{p.scopeItems.map((item) => (
                      <div key={item.id} className="flex gap-2 rounded-xl bg-emerald-400/5 px-3 py-2 text-sm"><CheckCircle2 className="mt-0.5 h-4 w-4 text-emerald-300" />{item.title}</div>
                    ))}</div>
                  </article>
                ))}

                {isMentor() && <div className="rounded-3xl border border-white/10 bg-white/5 p-6">
                  <h3 className="mb-4 font-semibold">Nouveau forfait</h3>
                  <div className="grid gap-3 sm:grid-cols-2">
                    <Input placeholder="Nom du forfait" value={packageForm.title} onChange={(e) => setPackageForm({ ...packageForm, title: e.target.value })} className="border-white/10 bg-black/20" />
                    <div className="grid grid-cols-[1fr_90px] gap-2">
                      <Input type="number" placeholder="Prix" value={packageForm.price} onChange={(e) => setPackageForm({ ...packageForm, price: e.target.value })} className="border-white/10 bg-black/20" />
                      <Input maxLength={3} value={packageForm.currency} onChange={(e) => setPackageForm({ ...packageForm, currency: e.target.value.toUpperCase() })} className="border-white/10 bg-black/20" />
                    </div>
                    <Input type="date" value={packageForm.periodStart} onChange={(e) => setPackageForm({ ...packageForm, periodStart: e.target.value })} className="border-white/10 bg-black/20" />
                    <Input type="date" value={packageForm.periodEnd} onChange={(e) => setPackageForm({ ...packageForm, periodEnd: e.target.value })} className="border-white/10 bg-black/20" />
                    <Input type="number" placeholder="Séances incluses" value={packageForm.sessions} onChange={(e) => setPackageForm({ ...packageForm, sessions: e.target.value })} className="border-white/10 bg-black/20" />
                    <Input type="number" placeholder="Durée en minutes" value={packageForm.duration} onChange={(e) => setPackageForm({ ...packageForm, duration: e.target.value })} className="border-white/10 bg-black/20" />
                  </div>
                  <Input placeholder="Planning inclus" value={packageForm.schedule} onChange={(e) => setPackageForm({ ...packageForm, schedule: e.target.value })} className="mt-3 border-white/10 bg-black/20" />
                  <Textarea placeholder="Description du scope" value={packageForm.description} onChange={(e) => setPackageForm({ ...packageForm, description: e.target.value })} className="mt-3 border-white/10 bg-black/20" />
                  <Textarea placeholder={"Éléments inclus — un par ligne"} value={packageForm.scopeItems} onChange={(e) => setPackageForm({ ...packageForm, scopeItems: e.target.value })} className="mt-3 border-white/10 bg-black/20" />
                  <Button className="mt-4 w-full" onClick={() => createPackage.mutate()} disabled={createPackage.isPending}>Enregistrer le forfait</Button>
                </div>}
              </div>

              <div className="space-y-4">
                <div className="flex items-center gap-2"><ReceiptText className="h-5 w-5 text-amber-300" /><h2 className="font-semibold">Hors scope</h2></div>
                {isLearner() && packages.length > 0 && <div className="rounded-3xl border border-amber-400/20 bg-amber-400/5 p-6">
                  <p className="text-sm text-slate-300">Toute demande ici est additionnelle au forfait initial.</p>
                  <select value={requestForm.packageId} onChange={(e) => setRequestForm({ ...requestForm, packageId: e.target.value })} className="mt-3 w-full rounded-md border border-white/10 bg-slate-900 px-3 py-2">
                    <option value="">Forfait concerné</option>{packages.map((p) => <option key={p.id} value={p.id}>{p.title}</option>)}
                  </select>
                  <Input placeholder="Sujet" value={requestForm.title} onChange={(e) => setRequestForm({ ...requestForm, title: e.target.value })} className="mt-3 border-white/10 bg-black/20" />
                  <Textarea placeholder="Détail de la demande" value={requestForm.description} onChange={(e) => setRequestForm({ ...requestForm, description: e.target.value })} className="mt-3 border-white/10 bg-black/20" />
                  <Button className="mt-4 w-full" onClick={() => createRequest.mutate()} disabled={createRequest.isPending}><Send className="mr-2 h-4 w-4" />Envoyer hors scope</Button>
                </div>}

                {changes.map((r) => {
                  const draft = quoteDrafts[r.id] || { price: "", taskId: "" };
                  return <article key={r.id} className="rounded-3xl border border-white/10 bg-white/5 p-6">
                    <div className="flex items-start justify-between gap-4"><div><p className="text-xs text-amber-300">Hors scope</p><h3 className="mt-1 font-semibold">{r.title}</h3></div><Badge className="bg-amber-300/10 text-amber-100">{r.status}</Badge></div>
                    <p className="mt-3 text-sm text-slate-300">{r.description}</p>
                    {r.quotedPriceMinor !== null && <div className="mt-4 flex items-center gap-2 rounded-xl bg-white/5 px-3 py-2"><CircleDollarSign className="h-4 w-4 text-amber-300" />Supplément : {formatMoney(r.quotedPriceMinor, r.currency)}</div>}

                    {isMentor() && r.status === "PROPOSED" && <div className="mt-4 grid gap-2 sm:grid-cols-[140px_1fr_auto]">
                      <Input type="number" placeholder="Prix XAF" value={draft.price} onChange={(e) => setQuoteDrafts({ ...quoteDrafts, [r.id]: { ...draft, price: e.target.value } })} className="border-white/10 bg-black/20" />
                      <select value={draft.taskId} onChange={(e) => setQuoteDrafts({ ...quoteDrafts, [r.id]: { ...draft, taskId: e.target.value } })} className="rounded-md border border-white/10 bg-slate-900 px-3 py-2">
                        <option value="">Tâche de roadmap liée</option>{tasks.map((t) => <option key={t.id} value={t.id}>{t.label}</option>)}
                      </select>
                      <Button onClick={() => quoteRequest.mutate(r.id)}>Chiffrer</Button>
                    </div>}

                    {isLearner() && r.status === "QUOTED" && <div className="mt-4 flex gap-2">
                      <Button className="flex-1" onClick={() => decide.mutate({ id: r.id, decision: "ACCEPT" })}><CheckCircle2 className="mr-2 h-4 w-4" />Accepter</Button>
                      <Button variant="outline" className="flex-1 border-white/15" onClick={() => decide.mutate({ id: r.id, decision: "REJECT" })}><XCircle className="mr-2 h-4 w-4" />Refuser</Button>
                    </div>}
                    {isMentor() && r.status === "ACCEPTED" && <Button className="mt-4 w-full" onClick={() => deliver.mutate(r.id)}>Marquer comme livré</Button>}
                  </article>;
                })}
              </div>
            </div>
          </>}
        </section>
      </main>
    </div>
  );
}
