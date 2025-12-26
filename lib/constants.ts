// Role labels for UI display
// Database values: USER, VALIDATOR, ADMIN
// Display labels: Employé, Manager, Admin
export const ROLE_LABELS = {
  USER: 'Employé',
  VALIDATOR: 'Manager',
  ADMIN: 'Admin',
} as const;

export const ROLE_LABELS_FULL = {
  USER: { label: 'Employé', description: 'Peut saisir son temps et soumettre des feuilles' },
  VALIDATOR: { label: 'Manager', description: 'Peut valider les feuilles de son équipe' },
  ADMIN: { label: 'Admin', description: 'Accès complet à toutes les fonctionnalités' },
} as const;

// Status labels
export const TIMESHEET_STATUS_LABELS = {
  DRAFT: { label: 'Brouillon', color: 'secondary' },
  SUBMITTED: { label: 'Soumise', color: 'warning' },
  APPROVED: { label: 'Approuvée', color: 'success' },
  REJECTED: { label: 'Refusée', color: 'destructive' },
  REOPENED: { label: 'Réouverte', color: 'secondary' },
} as const;

export const APPROVAL_STATUS_LABELS = {
  PENDING: { label: 'En attente', color: 'warning' },
  APPROVED: { label: 'Approuvée', color: 'success' },
  REJECTED: { label: 'Refusée', color: 'destructive' },
} as const;
