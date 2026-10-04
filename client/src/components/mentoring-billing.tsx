import { useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { Banknote, CircleDollarSign, Loader2, RefreshCw, Receipt, WalletCards } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { isMentor } from "@/lib/auth";
import { useToast } from "@/hooks/use-toast";
import type { BillingPeriodWithDetails, MentoringPackageWithScope } from "@shared/schema";

type Props = {
  mentorshipId: number;
  packages: MentoringPackageWithScope[];
};

function money(amount: number, currency: string) {
  return new Intl.NumberFormat("fr-FR", {
    style: "currency",
    currency,
    maximumFractionDigits: currency === "XAF" ? 0 : 2,
  }).format(amount);
}

const statusText: Record<BillingPeriodWithDetails["status"], string> = {
  DUE: "À payer",
  PARTIALLY_PAID: "Partiellement payé",
  PAID: "Payé",
  VOID: "Annulé",
};

export function MentoringBilling({ mentorshipId, packages }: Props) {
  const { toast } = useToast();
  const [createForm, setCreateForm] = useState({ packageId: "", dueDate: "" });
  const [paymentDrafts, setPaymentDrafts] = useState<Record<number, { amount: string; method: string; reference: string; note: string }>>({});
  const [chargeDrafts, setChargeDrafts] = useState<Record<number, { description: string; amount: string }>>({});

  const queryKey = ["/api/mentorships", mentorshipId, "billing"];
  const { data: periods = [], isLoading } = useQuery<BillingPeriodWithDetails[]>({
    queryKey,
    queryFn: () => apiRequest("GET", "/api/mentorships/" + mentorshipId + "/billing"),
  });

  const createPeriod = useMutation({
    mutationFn: () => apiRequest("POST", "/api/mentorships/" + mentorshipId + "/billing-periods", {
      packageId: Number(createForm.packageId),
      dueDate: createForm.dueDate,
    }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey });
      setCreateForm({ packageId: "", dueDate: "" });
      toast({ title: "Facturation créée", description: "Le forfait et les extras déjà acceptés sont pris en compte." });
    },
    onError: (error: Error) => toast({ title: "Facturation impossible", description: error.message, variant: "destructive" }),
  });

  const reconcile = useMutation({
    mutationFn: (id: number) => apiRequest("POST", "/api/billing-periods/" + id + "/reconcile", {}),
    onSuccess: () => queryClient.invalidateQueries({ queryKey }),
  });

  const recordPayment = useMutation({
    mutationFn: (id: number) => {
      const draft = paymentDrafts[id];
      if (!draft?.amount) throw new Error("Montant requis.");
      return apiRequest("POST", "/api/billing-periods/" + id + "/payments", {
        amountMinor: Number(draft.amount),
        method: draft.method || null,
        providerReference: draft.reference || null,
        note: draft.note || null,
      });
    },
    onSuccess: (_data, id) => {
      queryClient.invalidateQueries({ queryKey });
      setPaymentDrafts((prev) => ({ ...prev, [id]: { amount: "", method: "", reference: "", note: "" } }));
      toast({ title: "Paiement enregistré", description: "Le solde a été recalculé." });
    },
    onError: (error: Error) => toast({ title: "Paiement refusé", description: error.message, variant: "destructive" }),
  });

  const addCharge = useMutation({
    mutationFn: (id: number) => {
      const draft = chargeDrafts[id];
      if (!draft?.description || !draft?.amount) throw new Error("Libellé et montant requis.");
      return apiRequest("POST", "/api/billing-periods/" + id + "/charges", {
        description: draft.description,
        amountMinor: Number(draft.amount),
      });
    },
    onSuccess: (_data, id) => {
      queryClient.invalidateQueries({ queryKey });
      setChargeDrafts((prev) => ({ ...prev, [id]: { description: "", amount: "" } }));
    },
  });

  const unbilledPackages = packages.filter((item) => !periods.some((period) => period.packageId === item.id));

  return (
    <section className="rounded-3xl border border-white/10 bg-white/5 p-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-2">
          <WalletCards className="h-5 w-5 text-violet-300" />
          <div>
            <h2 className="font-semibold">Facturation & paiements</h2>
            <p className="text-xs text-slate-400">Forfait, suppléments acceptés, montant dû et paiements enregistrés.</p>
          </div>
        </div>
      </div>

      {isMentor() && unbilledPackages.length > 0 && (
        <div className="mt-5 grid gap-3 rounded-2xl border border-violet-300/15 bg-violet-300/5 p-5 md:grid-cols-[1fr_180px_auto]">
          <select value={createForm.packageId} onChange={(e) => setCreateForm({ ...createForm, packageId: e.target.value })} className="rounded-md border border-white/10 bg-slate-900 px-3 py-2 text-sm">
            <option value="">Forfait à facturer</option>
            {unbilledPackages.map((item) => <option key={item.id} value={item.id}>{item.title} · {money(item.basePriceMinor, item.currency)}</option>)}
          </select>
          <Input type="date" value={createForm.dueDate} onChange={(e) => setCreateForm({ ...createForm, dueDate: e.target.value })} className="border-white/10 bg-black/20" />
          <Button onClick={() => createPeriod.mutate()} disabled={createPeriod.isPending || !createForm.packageId || !createForm.dueDate}>
            {createPeriod.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}Créer
          </Button>
        </div>
      )}

      <div className="mt-6 space-y-4">
        {isLoading ? <Loader2 className="h-5 w-5 animate-spin" /> : periods.length === 0 ? (
          <p className="rounded-2xl border border-dashed border-white/10 p-5 text-sm text-slate-400">Aucune période de facturation pour ce mentorat.</p>
        ) : periods.map((period) => {
          const payment = paymentDrafts[period.id] || { amount: "", method: "", reference: "", note: "" };
          const charge = chargeDrafts[period.id] || { description: "", amount: "" };
          return (
            <article key={period.id} className="rounded-3xl border border-white/10 bg-black/10 p-6">
              <div className="flex flex-wrap items-start justify-between gap-4">
                <div>
                  <h3 className="text-lg font-semibold">{period.title}</h3>
                  <p className="mt-1 text-sm text-slate-400">{period.periodStart} → {period.periodEnd} · échéance {period.dueDate}</p>
                </div>
                <Badge className="bg-violet-300/10 text-violet-100">{statusText[period.status]}</Badge>
              </div>

              <div className="mt-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
                <div className="rounded-2xl bg-white/5 p-4"><p className="text-xs text-slate-400">Forfait</p><p className="mt-1 text-xl font-bold">{money(period.baseAmountMinor, period.currency)}</p></div>
                <div className="rounded-2xl bg-white/5 p-4"><p className="text-xs text-slate-400">Extras</p><p className="mt-1 text-xl font-bold text-amber-200">{money(period.extrasMinor, period.currency)}</p></div>
                <div className="rounded-2xl bg-white/5 p-4"><p className="text-xs text-slate-400">Payé</p><p className="mt-1 text-xl font-bold text-emerald-200">{money(period.paidMinor, period.currency)}</p></div>
                <div className="rounded-2xl bg-white/5 p-4"><p className="text-xs text-slate-400">Reste dû</p><p className="mt-1 text-xl font-bold text-rose-200">{money(period.outstandingMinor, period.currency)}</p></div>
              </div>

              {period.charges.length > 0 && (
                <div className="mt-5">
                  <p className="mb-2 text-sm font-medium">Suppléments</p>
                  <div className="space-y-2">{period.charges.map((item) => (
                    <div key={item.id} className="flex items-center justify-between gap-4 rounded-xl bg-white/5 px-3 py-2 text-sm">
                      <span>{item.description}</span><span className="font-semibold">{money(item.amountMinor, period.currency)}</span>
                    </div>
                  ))}</div>
                </div>
              )}

              {period.payments.length > 0 && (
                <div className="mt-5">
                  <p className="mb-2 text-sm font-medium">Paiements</p>
                  <div className="space-y-2">{period.payments.map((item) => (
                    <div key={item.id} className="flex flex-wrap items-center justify-between gap-3 rounded-xl bg-emerald-400/5 px-3 py-2 text-sm">
                      <span>{new Date(item.paidAt).toLocaleString("fr-FR")} · {item.method || "Manuel"}{item.providerReference ? " · " + item.providerReference : ""}</span>
                      <span className="font-semibold text-emerald-200">{money(item.amountMinor, item.currency)}</span>
                    </div>
                  ))}</div>
                </div>
              )}

              {isMentor() && period.status !== "VOID" && (
                <div className="mt-5 space-y-3">
                  <Button variant="outline" onClick={() => reconcile.mutate(period.id)} disabled={reconcile.isPending} className="border-white/15">
                    <RefreshCw className="mr-2 h-4 w-4" />Synchroniser les extras
                  </Button>

                  <div className="grid gap-2 md:grid-cols-[1fr_140px_auto]">
                    <Input placeholder="Ajustement manuel" value={charge.description} onChange={(e) => setChargeDrafts({ ...chargeDrafts, [period.id]: { ...charge, description: e.target.value } })} className="border-white/10 bg-black/20" />
                    <Input type="number" min="1" placeholder="Montant" value={charge.amount} onChange={(e) => setChargeDrafts({ ...chargeDrafts, [period.id]: { ...charge, amount: e.target.value } })} className="border-white/10 bg-black/20" />
                    <Button variant="outline" onClick={() => addCharge.mutate(period.id)} disabled={addCharge.isPending}><Receipt className="mr-2 h-4 w-4" />Ajouter</Button>
                  </div>

                  {period.outstandingMinor > 0 && (
                    <div className="rounded-2xl border border-emerald-400/15 bg-emerald-400/5 p-4">
                      <div className="flex items-center gap-2"><Banknote className="h-4 w-4 text-emerald-300" /><p className="text-sm font-medium">Enregistrer un paiement manuel</p></div>
                      <div className="mt-3 grid gap-2 md:grid-cols-2 xl:grid-cols-4">
                        <Input type="number" min="1" max={period.outstandingMinor} placeholder="Montant" value={payment.amount} onChange={(e) => setPaymentDrafts({ ...paymentDrafts, [period.id]: { ...payment, amount: e.target.value } })} className="border-white/10 bg-black/20" />
                        <Input placeholder="Méthode (MoMo, OM, espèces…)" value={payment.method} onChange={(e) => setPaymentDrafts({ ...paymentDrafts, [period.id]: { ...payment, method: e.target.value } })} className="border-white/10 bg-black/20" />
                        <Input placeholder="Référence" value={payment.reference} onChange={(e) => setPaymentDrafts({ ...paymentDrafts, [period.id]: { ...payment, reference: e.target.value } })} className="border-white/10 bg-black/20" />
                        <Button onClick={() => recordPayment.mutate(period.id)} disabled={recordPayment.isPending || !payment.amount}><CircleDollarSign className="mr-2 h-4 w-4" />Enregistrer</Button>
                      </div>
                      <Textarea placeholder="Note (optionnel)" value={payment.note} onChange={(e) => setPaymentDrafts({ ...paymentDrafts, [period.id]: { ...payment, note: e.target.value } })} className="mt-2 border-white/10 bg-black/20" />
                    </div>
                  )}
                </div>
              )}
            </article>
          );
        })}
      </div>
    </section>
  );
}
