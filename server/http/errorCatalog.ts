// Catalogue des erreurs HTTP : code stable lisible par la machine + message français pour l'utilisateur.
// Le champ historique `error` (anglais) reste inchangé : c'est un contrat consommé par les clients.

export type ErrorDescriptor = { code: string; message: string };

const BY_MESSAGE: Record<string, ErrorDescriptor> = {
  "No token provided": { code: "AUTH_REQUIRED", message: "Vous devez être connecté pour accéder à cette ressource." },
  "Invalid token": { code: "AUTH_INVALID_TOKEN", message: "Votre session n'est pas valide. Reconnectez-vous." },
  "Session no longer valid": { code: "AUTH_SESSION_EXPIRED", message: "Votre session a expiré. Reconnectez-vous." },
  "Authentication check failed": { code: "AUTH_CHECK_FAILED", message: "Impossible de vérifier votre session pour le moment. Réessayez dans un instant." },
  "Invalid credentials": { code: "AUTH_INVALID_CREDENTIALS", message: "E-mail ou mot de passe incorrect." },
  "User already exists": { code: "AUTH_USER_EXISTS", message: "Un compte existe déjà avec cet e-mail." },
  "Account already exists, please log in": { code: "AUTH_USER_EXISTS", message: "Un compte existe déjà avec cet e-mail. Connectez-vous." },
  "Mentor access required": { code: "MENTOR_ROLE_REQUIRED", message: "Cette action est réservée aux mentors." },
  "Learner access required": { code: "LEARNER_ROLE_REQUIRED", message: "Cette action est réservée aux apprenants." },
  "Too many requests. Please try again later.": { code: "RATE_LIMITED", message: "Trop de tentatives. Patientez quelques instants avant de réessayer." },
  "Validation failed": { code: "VALIDATION_FAILED", message: "Certaines informations sont invalides. Vérifiez le formulaire." },
  "Validation error": { code: "VALIDATION_FAILED", message: "Certaines informations sont invalides. Vérifiez le formulaire." },
  "Invalid mentorship id": { code: "INVALID_ID", message: "L'identifiant du mentorat est invalide." },
  "roadmapId must be a positive integer": { code: "INVALID_ID", message: "L'identifiant de la roadmap est invalide." },
  "A valid learnerId is required": { code: "INVALID_LEARNER", message: "Sélectionnez un apprenant valide." },
  "A valid email is required": { code: "INVALID_EMAIL", message: "Saisissez une adresse e-mail valide." },
  "month must use YYYY-MM": { code: "INVALID_MONTH", message: "Le mois doit être au format AAAA-MM." },
  "topic and numberOfWeeks are required": { code: "AI_INPUT_MISSING", message: "Indiquez un sujet et un nombre de semaines." },
  "numberOfWeeks must be between 1 and 12": { code: "AI_WEEKS_OUT_OF_RANGE", message: "Le nombre de semaines doit être compris entre 1 et 12." },
  "topic (200 characters max) and additionalContext (2000 characters max) must be text": { code: "AI_INPUT_TOO_LONG", message: "Le sujet (200 caractères max) et le contexte (2000 caractères max) doivent être du texte." },
  "newNumber is required and must be a number": { code: "INVALID_WEEK_NUMBER", message: "Indiquez un numéro de semaine valide." },
  "packageId must belong to this mentorship": { code: "PACKAGE_MISMATCH", message: "Ce forfait n'appartient pas à ce mentorat." },
  "weekId must belong to this mentorship roadmap": { code: "WEEK_MISMATCH", message: "Cette semaine n'appartient pas à la roadmap de ce mentorat." },
  "linkedTaskId must belong to the mentorship roadmap": { code: "TASK_MISMATCH", message: "Cette tâche n'appartient pas à la roadmap de ce mentorat." },
  "Invalid email preference update": { code: "INVALID_EMAIL_PREFERENCES", message: "Les préférences d'e-mail envoyées sont invalides." },
  "Image body is required": { code: "UPLOAD_EMPTY", message: "Aucun fichier image n'a été reçu." },
  "Only PNG, JPEG, WebP or GIF images are allowed": { code: "UPLOAD_UNSUPPORTED_TYPE", message: "Seules les images PNG, JPEG, WebP ou GIF sont acceptées." },
  "Billing period is void": { code: "BILLING_PERIOD_VOID", message: "Cette période de facturation est annulée." },
  "Only a submitted lab can be reviewed": { code: "LAB_NOT_SUBMITTED", message: "Seul un lab soumis peut être évalué." },
  "An approved lab cannot be changed": { code: "LAB_ALREADY_APPROVED", message: "Un lab approuvé ne peut plus être modifié." },
  "Invitation already accepted": { code: "INVITATION_ACCEPTED", message: "Cette invitation a déjà été acceptée." },
  "Invitation is no longer pending": { code: "INVITATION_NOT_PENDING", message: "Cette invitation n'est plus en attente." },
  "This email cannot be invited": { code: "INVITATION_EMAIL_REFUSED", message: "Cette adresse e-mail ne peut pas être invitée." },
  "Invitation already used": { code: "INVITATION_USED", message: "Cette invitation a déjà été utilisée. Connectez-vous avec votre compte." },
  "Invitation expired": { code: "INVITATION_EXPIRED", message: "Cette invitation a expiré. Demandez un nouveau lien à votre mentor." },
  "Invitation revoked": { code: "INVITATION_REVOKED", message: "Cette invitation a été annulée par votre mentor." },
  "Invitation not found": { code: "INVITATION_NOT_FOUND", message: "Ce lien d'invitation est invalide." },
  "Route not found": { code: "ROUTE_NOT_FOUND", message: "Cette adresse d'API n'existe pas." },
  "Malformed JSON body": { code: "MALFORMED_JSON", message: "Les données envoyées sont mal formées." },
  "Request body too large": { code: "PAYLOAD_TOO_LARGE", message: "Le contenu envoyé est trop volumineux." },
  "Error streaming file": { code: "FILE_STREAM_FAILED", message: "Le fichier n'a pas pu être lu. Réessayez." },
  "Error downloading file": { code: "FILE_DOWNLOAD_FAILED", message: "Le fichier n'a pas pu être téléchargé. Réessayez." },
};

// Nom anglais → [préfixe de code, libellé français avec article, féminin ?]
const NOUNS: Record<string, [string, string, boolean]> = {
  week: ["WEEK", "La semaine", true],
  "target week": ["TARGET_WEEK", "La semaine cible", true],
  mentorship: ["MENTORSHIP", "Le mentorat", false],
  roadmap: ["ROADMAP", "La roadmap", true],
  "change request": ["CHANGE_REQUEST", "La demande de modification", true],
  session: ["SESSION", "La session", true],
  objective: ["OBJECTIVE", "L'objectif", false],
  task: ["TASK", "La tâche", true],
  lab: ["LAB", "Le lab", false],
  "lab submission": ["LAB_SUBMISSION", "Le rendu du lab", false],
  "billing period": ["BILLING_PERIOD", "La période de facturation", true],
  deliverable: ["DELIVERABLE", "Le livrable", false],
  user: ["USER", "L'utilisateur", false],
  learner: ["LEARNER", "L'apprenant", false],
  resource: ["RESOURCE", "La ressource", true],
  file: ["FILE", "Le fichier", false],
  object: ["OBJECT", "Le fichier", false],
};

const BY_STATUS: Record<number, ErrorDescriptor> = {
  400: { code: "BAD_REQUEST", message: "La requête est invalide. Vérifiez les informations saisies." },
  401: { code: "AUTH_REQUIRED", message: "Vous devez être connecté pour accéder à cette ressource." },
  403: { code: "FORBIDDEN", message: "Vous n'avez pas les droits nécessaires pour cette action." },
  404: { code: "NOT_FOUND", message: "La ressource demandée est introuvable." },
  405: { code: "METHOD_NOT_ALLOWED", message: "Cette méthode n'est pas autorisée sur cette ressource." },
  409: { code: "CONFLICT", message: "Cette action entre en conflit avec l'état actuel des données." },
  410: { code: "GONE", message: "Cette ressource n'est plus disponible." },
  413: { code: "PAYLOAD_TOO_LARGE", message: "Le contenu envoyé est trop volumineux." },
  415: { code: "UNSUPPORTED_MEDIA_TYPE", message: "Ce type de contenu n'est pas pris en charge." },
  422: { code: "UNPROCESSABLE", message: "Les données envoyées ne peuvent pas être traitées." },
  429: { code: "RATE_LIMITED", message: "Trop de tentatives. Patientez quelques instants avant de réessayer." },
  500: { code: "INTERNAL_ERROR", message: "Une erreur est survenue de notre côté. Réessayez dans un instant." },
  502: { code: "UPSTREAM_ERROR", message: "Un service externe ne répond pas. Réessayez dans un instant." },
  503: { code: "UNAVAILABLE", message: "Le service est momentanément indisponible. Réessayez dans un instant." },
  504: { code: "UPSTREAM_TIMEOUT", message: "Le service externe a mis trop de temps à répondre. Réessayez." },
};

export function describeError(status: number, englishMessage?: unknown): ErrorDescriptor {
  if (typeof englishMessage === "string") {
    const exact = BY_MESSAGE[englishMessage];
    if (exact) return exact;
    const notFound = /^(.+) not found$/i.exec(englishMessage);
    const noun = notFound && NOUNS[notFound[1].toLowerCase()];
    if (noun) {
      return { code: `${noun[0]}_NOT_FOUND`, message: `${noun[1]} demandé${noun[2] ? "e" : ""} est introuvable.` };
    }
    if (englishMessage.startsWith("Invalid change request transition")) {
      return { code: "CHANGE_REQUEST_INVALID_TRANSITION", message: "Ce changement de statut n'est pas autorisé pour cette demande." };
    }
  }
  return BY_STATUS[status] ?? (status >= 500 ? BY_STATUS[500] : BY_STATUS[400]);
}
