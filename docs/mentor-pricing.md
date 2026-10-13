# Tarification mentor — plan de livraison

> Rédigé le 2026-10-13. Décision produit : le mentor doit pouvoir modifier **son** prix sans falsifier une facture déjà émise. Reco alignée sur le schéma append-only existant et sur la pratique coaching (prix signé jusqu’à la fin du terme ; nouveau tarif au renouvellement).

**Statut :** PROPOSÉ — tranche 1 à implémenter. Tranches 2–4 hors de la première PR.

**Fiche backlog :** [RM-021](backlog.md#rm-021--permettre-au-mentor-de-corriger-un-forfait-non-facturé)

## Problème

Le mentor n’a pas de tarif. Il n’a qu’un **contrat de période** par apprenant.

- Création seule : `POST /api/mentorships/:id/packages` ([server/routes/packages.ts](../server/routes/packages.ts)). Aucun `PATCH`.
- L’UI affiche une carte en lecture seule puis un formulaire « Nouveau forfait ». Toast : *« Le scope initial est figé dans l’historique. »* ([client/src/pages/mentoring.tsx](../client/src/pages/mentoring.tsx)).
- La facture **copie** `basePriceMinor` dans `billing_periods.baseAmountMinor` à la création. Un `reconcile` ne recalcule pas ce montant ([server/routes/billing.ts](../server/routes/billing.ts), [server/services/billingPeriods.ts](../server/services/billingPeriods.ts)).
- Une facture par forfait (`billing_period_package_unique`). Même `VOID`, on ne peut pas refacturer le même forfait.
- Les charges manuelles sont strictement **positives** (`manualBillingChargeSchema.amountMinor` → `.positive()` dans [shared/schema.ts](../shared/schema.ts)) : une remise n’est pas exprimable.

Jobs réels non couverts :

| Job | Exemple ShopFlow | Couvert aujourd’hui |
| --- | --- | --- |
| Corriger avant facture | 30 000 tapé, accord à 25 000 | Non — recréer un second forfait |
| Nouveau mois à un autre prix | Novembre à 40 000, octobre inchangé | Oui en théorie, formulaire vide |
| Ajuster une facture ouverte | Remise avant paiement | Non (charge > 0 seulement) |
| Tarif réutilisable du mentor | « ShopFlow mois = 30 000 XAF » | N’existe pas |

## Règle métier

> Le tarif du mentor est vivant.  
> Le forfait d’une période est un contrat.  
> La facture est une photo.  
> On ne retouche une photo que par une nouvelle ligne (remise, extra, avoir), jamais au stylo.

Trois couches :

```text
Tarif du mentor (catalogue)     ← hors V1 (tranche 4)
        ↓ clone
Forfait-période (contrat)       ← existe, append-only une fois facturé
        ↓ snapshot
Facture (billing period)        ← existe, montant copié, jamais recalculé depuis le forfait
```

## Reco

Livrer **quatre tranches**. La première PR ne contient **que** la tranche 1.

### Tranche 1 — Corriger un forfait non facturé (S) — **cette PR**

`PATCH` autorisé **si et seulement si** aucune ligne `billing_periods` n’existe pour ce `packageId` (y compris `VOID` : l’unicité actuelle verrouille quand même).

Champs modifiables (même contrat que la création, sans `mentorshipId` / `createdByUserId`) :

- `title`, `basePriceMinor`, `currency`
- `periodStart`, `periodEnd`
- `includedSessionCount`, `includedSessionDurationMinutes`, `sessionSchedule`
- `scopeDescription`, `scopeItems` (remplacement intégral de la liste, minimum 1 item)

Invariants :

- Mentor du mentorat uniquement (`requireMentor` + `canManage`).
- Le `packageId` appartient au `mentorshipId` de l’URL, sinon 404.
- Apprenant, anonyme, mentor étranger : même matrice que le `POST` actuel (401 / 403 / 404 via `expectAccess`).
- Forfait déjà facturé → `409 ConflictError`, message FR catalogué. **Aucun** champ n’est écrit.
- `reconcile` **ne lit pas** le forfait pour mettre à jour `baseAmountMinor`. Inchangé.
- Pas de migration : colonnes déjà là. `npx drizzle-kit generate --name ci_drift_check` doit rester *No schema changes*.

### Tranche 2 — Dupliquer vers la période suivante (S/M)

Hors de cette PR. Bouton « Dupliquer vers le mois suivant » : préremplit le formulaire, dates décalées, **prix éditable**. Respecte l’append-only : nouvelle ligne, pas de PATCH sur le forfait facturé.

### Tranche 3 — Facture ouverte, pas encore payée (M)

Hors de cette PR. Deux préalables à trancher alors :

1. Charges manuelles **négatives** (remise), bornées pour ne pas faire passer le sous-total sous le payé.
2. Unicité `billing_period_package_unique` : aujourd’hui un `VOID` empêche de refacturer le même forfait. Soit unicité partielle (une période **non VOID** par forfait), soit « nouveau forfait, nouvelle facture » obligatoire.

Ne pas PATCH le forfait une fois une période créée.

### Tranche 4 — Catalogue de tarifs du mentor (P2)

Hors de cette PR. Table `mentor_rate_cards` (prix par défaut, séance extra). Modifiable à tout moment. **N’écrase aucun** contrat en cours. Un seul ShopFlow n’en a pas besoin tout de suite.

## Contrat API — tranche 1

```http
PATCH /api/mentorships/:mentorshipId/packages/:packageId
Authorization: Bearer <mentor JWT>
```

Corps : même schéma Zod que `createMentoringPackageSchema` (déjà strict, dates `YYYY-MM-DD`, `periodEnd >= periodStart`, devise 3 lettres). Nouveau export `updateMentoringPackageSchema` = alias de ce schéma, pour ne pas casser le `POST`.

Réponses :

| Statut | Cas |
| --- | --- |
| 200 | Forfait + `scopeItems` à jour |
| 400 | Corps Zod invalide (`formatErrorBody`) |
| 401 | Sans jeton |
| 403 | Apprenant du mentorat |
| 404 | Mentorat / forfait hors périmètre, ou mauvais rôle étranger |
| 409 | Une `billing_periods` existe pour ce forfait |

Erreurs métier via `ConflictError` / `NotFoundError` déjà mappées dans [server/http/errors.ts](../server/http/errors.ts). Ajouter un code catalogue FR, ex. `PACKAGE_ALREADY_BILLED` → « Ce forfait est déjà facturé. Créez la période suivante ou ajoutez un ajustement. »

Idempotence : deux PATCH identiques convergent (même état). Pas d’écriture si le 409 est levé **avant** la transaction.

## UI — tranche 1

Sur `/mentoring`, carte forfait, **mentor seulement** :

- Bouton `data-testid="button-edit-package-{id}"` si le forfait n’a pas de période de facturation.
- Si facturé : pas de bouton, mention discrète « Figé — déjà facturé ».
- Édition : réutiliser le formulaire existant en mode édition (prérempli), bouton `data-testid="button-save-package"`.
- Après succès : invalider `["/api/mentorships", id, "packages"]` et le cache billing (le sélecteur « Forfait à facturer » affiche le nouveau montant).
- Ne pas supprimer les `data-testid` existants.

L’apprenant voit le montant mis à jour sur le même `GET` (pas de champ caché mentor).

## Fichiers touchés — tranche 1

| Fichier | Rôle |
| --- | --- |
| `shared/schema.ts` | `updateMentoringPackageSchema` (pas de table nouvelle) |
| `server/data/mentoringPackages.ts` | `updateMentoringPackageWithScope` en transaction |
| `server/routes/packages.ts` | `PATCH …/packages/:packageId` |
| `server/http/errorCatalog.ts` | Message FR 409 |
| `client/src/pages/mentoring.tsx` | Édition conditionnelle |
| `test/mentoring-scope.test.ts` | Schéma update / dates |
| `test/integration/packages.integration.ts` **ou** suite billing existante | Matrice d’accès + 409 si facturé |
| `docs/engineering/testing.md` | Une ligne si nouvelle garde à `access-mutation` |

Pas de changement `shared/schema.ts` de **table** → pas de fichier `migrations/0009_*.sql`.

## Tests — tranche 1

- Unitaire : schéma update refuse `periodEnd < periodStart` ; accepte un forfait Pavel-style à 25 000 XAF.
- Intégration, base jetable (`TEST_BASE_URL`) :
  - mentor corrige `basePriceMinor` 100 000 → 25 000, `GET` ensuite = 25 000, scope remplacé.
  - après `POST billing-periods`, le PATCH → 409, montant du forfait **et** `baseAmountMinor` inchangés.
  - `expectAccess` : anonyme 401, learner 403, mentor B 404.
  - deux PATCH identiques → 200 et même représentation.
- E2E : **pas obligatoire** pour la tranche 1 si l’intégration couvre le contrat. Si un clic UI est ajouté, un `data-testid` suffit pour une étape ultérieure ; ne pas casser `mentor.e2e.py` / `learner.e2e.py`.
- `npm run check`, `npm test`, `npm run test:integration` (job concerné), `npx drizzle-kit generate --name ci_drift_check` = no-op.

## Hors périmètre (cette PR et les suivantes immédiates)

- Paiement Mobile Money / Stripe.
- Recalcul de `baseAmountMinor` au `reconcile`.
- Application rétroactive d’un prix à tous les mentorats.
- Rôle `ADMIN`, invitations mentors, AWS / Terraform.
- Mot « pédagogie » : interdit. Ici le sujet est **commercial** (forfait, contrat, facture), pas andragogique.

## Pré-requis avant implémentation

1. Commits OTP + UI responsive : **Claude les prend**. Ne pas mélanger cette PR avec l’arbre local non commité (auth OTP, favicon, `auth-page.tsx`).
2. Branche dédiée depuis `main` à jour : `feat/rm-021-package-price-correction`.
3. Ne pas ouvrir la tranche 2 tant que la 1 n’est pas verte en CI.

## Sources

- Schéma local append-only : [shared/schema.ts](../shared/schema.ts) (commentaire forfaits, index unique facture).
- [How to Price Coaching Packages — Luca](https://setluca.com/blog/how-to-price-coaching-packages) (consulté 2026-10-13) : clients en cours au prix signé jusqu’à la fin du terme.
- [Pricing without an audit trail — VentureSEA](https://venturesea.tech/insights/pricing-without-an-audit-trail) (consulté 2026-10-13) : historique de prix en ajout, pas d’UPDATE du passé.
- [Agreement Ledger](https://agreement-ledger.com/) (consulté 2026-10-13, secondaire) : versions de prix datées, factures dérivées.

## Définition de terminé — tranche 1

- Critères d’acceptation RM-021 cochés.
- `npm run check`, `npm test`, intégration packages/billing verts.
- Aucune dérive Drizzle.
- Aucun secret dans le dépôt.
- Walkthrough daté dans `docs/` **après** le code, pas avant.
