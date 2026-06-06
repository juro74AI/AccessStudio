# Access Studio - Access Profile Management Platform

A role-based access profile management platform where managers assemble profiles from existing roles, and role owners validate the assignments.

## Features

- **Profile Management**: Create, edit, and track access profiles composed of multiple roles
- **Validation Workflow**: Role owners approve or reject role assignments within profiles
- **Status Engine**: Automatic profile status calculation based on validation outcomes
- **Dual Persona**: Manager and Role Owner views with dedicated dashboards

## Personas

| Persona | Capabilities |
|---------|-------------|
| **Manager** | Create/edit/delete profiles, submit for approval, track validation progress |
| **Role Owner** | Review validation requests, approve/reject role usage, add comments |

## Profile Status Lifecycle

```
Draft -> Pending Approval -> Partially Approved -> Approved
                              \-> Rejected
```

- **Draft**: Profile being configured, no validations yet
- **Pending Approval**: Submitted, all validations pending
- **Partially Approved**: Some validations approved, some pending
- **Approved**: All role validations approved
- **Rejected**: At least one role validation rejected

## Tech Stack

- Next.js 13 (App Router)
- React 18 + TypeScript
- Tailwind CSS + shadcn/ui
- Supabase (PostgreSQL)
- Lucide React icons
- date-fns

## Getting Started

1. Install dependencies:
   ```bash
   npm install
   ```

2. Start the development server:
   ```bash
   npm run dev
   ```

3. Open [http://localhost:3000](http://localhost:3000)

4. Log in as one of the demo users:

**Managers:**
- Marie Dupont (marie.dupont@company.com)
- Jean Martin (jean.martin@company.com)

**Role Owners:**
- Sophie Bernard (sophie.bernard@company.com)
- Pierre Leroy (pierre.leroy@company.com)
- Claire Moreau (claire.moreau@company.com)

## Demo Data

The platform comes pre-loaded with:

- 5 roles: AWS Read Only, GitLab Developer, Jira Contributor, Confluence Editor, Kubernetes Viewer
- 3 example profiles:
  - **DevOps Engineer** (Approved) - Marie Dupont
  - **Junior Developer** (Partially Approved) - Marie Dupont
  - **Product Analyst** (Pending Approval) - Jean Martin

## Project Structure

```
app/
  page.tsx                    # Login/redirect page
  dashboard/
    page.tsx                  # Manager profile list
    create/page.tsx           # Create new profile
    [id]/
      page.tsx                # Profile detail
      edit/page.tsx           # Edit profile
  validations/
    page.tsx                  # Owner validation dashboard
  roles/
    page.tsx                  # Roles catalog browser
components/
  app-shell.tsx               # App layout with sidebar
  login-page.tsx              # Login page with persona selection
  ui/                         # shadcn/ui components
lib/
  supabase.ts                 # Supabase client
  auth-context.tsx            # Simulated auth context
  types.ts                    # TypeScript type definitions
  status-engine.ts            # Business rules & status computation
  utils.ts                    # Utility functions
```

## Build

```bash
npm run build
```
