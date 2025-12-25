# TimeSheet Manager

Application de gestion de feuilles de temps professionnelle avec validation et reporting.

## Stack Technologique

- **Frontend**: Next.js 14 (App Router), TypeScript, Tailwind CSS, shadcn/ui
- **Backend**: Next.js API Routes + Prisma ORM
- **Database**: Azure PostgreSQL Flexible Server
- **Auth**: NextAuth.js avec Azure AD (Microsoft SSO, MFA obligatoire)
- **Infra**: Azure (Terraform), GitHub Actions CI/CD
- **Monitoring**: Application Insights

## Fonctionnalités

- Authentification SSO Microsoft Azure AD avec MFA
- CRUD Projets / Sous-projets
- Saisie du temps: horaires manuels + chronomètre
- Calendrier récapitulatif
- Dashboard temps global
- Workflow de validation (approuver/refuser/relancer)
- Verrouillage des feuilles validées/refusées
- Rapports avec filtres
- Budget heures par projet avec suivi
- Taux de facturation et rapports financiers
- Exports: CSV, Excel, PDF
- Mode sombre
- Journalisation complète des actions (audit trail)

## Prérequis

- Node.js 20+
- PostgreSQL 16+
- Azure AD App Registration (pour l'authentification)

## Installation

```bash
# Cloner le repository
git clone https://github.com/your-org/timesheet-manager.git
cd timesheet-manager

# Installer les dépendances
npm install

# Copier le fichier d'environnement
cp .env.example .env

# Configurer les variables d'environnement
# Éditer .env avec vos valeurs

# Générer le client Prisma
npx prisma generate

# Appliquer les migrations
npx prisma migrate dev

# Charger les données de test
npx prisma db seed

# Lancer en développement
npm run dev
```

## Configuration Azure AD

1. Créer une App Registration dans Azure AD
2. Configurer les URLs de redirection:
   - `http://localhost:3000/api/auth/callback/azure-ad` (dev)
   - `https://your-domain.com/api/auth/callback/azure-ad` (prod)
3. Générer un Client Secret
4. Configurer les permissions:
   - `openid`
   - `profile`
   - `email`
   - `User.Read`
5. Activer MFA dans les Conditional Access Policies

## Variables d'Environnement

```env
# Database
DATABASE_URL="postgresql://user:password@localhost:5432/timesheet"

# NextAuth
NEXTAUTH_URL="http://localhost:3000"
NEXTAUTH_SECRET="your-secret"

# Azure AD
AZURE_AD_CLIENT_ID="your-client-id"
AZURE_AD_CLIENT_SECRET="your-client-secret"
AZURE_AD_TENANT_ID="your-tenant-id"
```

## Scripts

```bash
npm run dev          # Développement
npm run build        # Build production
npm run start        # Production
npm run lint         # Linter
npm run test         # Tests unitaires
npm run test:e2e     # Tests E2E
npm run db:migrate   # Migrations DB
npm run db:seed      # Seed DB
npm run db:studio    # Prisma Studio
```

## Infrastructure Azure (Terraform)

```bash
cd infra

# Initialiser Terraform
terraform init

# Planifier les changements
terraform plan -out=tfplan

# Appliquer les changements
terraform apply tfplan
```

## Profils Utilisateurs

| Rôle | Permissions |
|------|------------|
| **Admin** | Accès total: gestion utilisateurs, projets, paramètres |
| **Validateur** | Approuver/refuser les feuilles de temps assignées |
| **Utilisateur** | Saisir son temps, voir son récapitulatif |

## API

L'API REST est disponible sous `/api/`:

- `GET/POST /api/users` - Gestion des utilisateurs
- `GET/POST /api/projects` - Gestion des projets
- `GET/POST /api/time-entries` - Entrées de temps
- `GET/POST /api/timesheets` - Feuilles de temps
- `POST /api/timesheets/:id/submit` - Soumettre une feuille
- `POST /api/approvals` - Approuver/Refuser
- `GET /api/health` - Health check

## Sécurité

- MFA obligatoire via Azure AD
- Chiffrement TLS 1.3 en transit
- Secrets dans Azure Key Vault
- Rate limiting sur les API
- Headers de sécurité (CSP, HSTS, etc.)
- Journalisation de toutes les actions
- Signature des actions critiques

## Tests

```bash
# Tests unitaires
npm run test

# Tests avec couverture
npm run test:coverage

# Tests E2E
npm run test:e2e

# Tests E2E avec UI
npm run test:e2e:ui
```

## Déploiement

Le déploiement est automatisé via GitHub Actions:

1. Push sur `main` -> déploiement sur staging
2. Workflow manuel pour production

## Licence

Propriétaire - Tous droits réservés
