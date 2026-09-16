# Wave — Role & User Management Platform

Wave is a FastAPI + PostgreSQL + React TypeScript application for secure user onboarding and role-based access control (RBAC).

## Access model

- **Super Admin:** exactly one account; created from the backend CLI; no public signup. Manages administrator accounts and can onboard normal users and assign business roles.
- **Admin:** created only by the Super Admin. Manages normal users, creates/maintains business roles, and assigns roles.
- **User:** can self-register from the login experience. New self-registered users start with **no role**; the `UserRole` table remains empty until an Admin or Super Admin assigns a business role.

The backend enforces these boundaries; hiding a button in React is not treated as security.

## Authentication

JWT is used for authenticated API requests. The React client validates the existing session on startup. A 401 response clears the session centrally and returns to login instead of rendering repeated "Invalid or expired token" messages across the dashboard.

## Main data model

`users` → `user_roles` → `roles`

`user_roles` also records `assigned_by`, so role assignments have an audit reference.

## Features

- Separate Super Admin / Admin / User login modes
- Secure password hashing and JWT authentication
- User CRUD with Admin-controlled editing/deletion
- Administrator CRUD controlled only by Super Admin
- Business role CRUD controlled by Admin and Super Admin
- Role assignment by Admin or Super Admin
- Searchable user and role selectors
- Duplicate email/username/mobile validation
- Duplicate role and duplicate assignment validation
- Dedicated full-width Users List, Add User, Assign Role, and Role Management viewports
- Merged searchable User/Role dropdown controls with live data refresh
- Smooth viewport transitions with no user table rendered underneath Add User or Assign Role
- Compact post-login dashboard with role-specific navigation
- Collapsible desktop sidebar and mobile drawer
- Super Admin/Admin profile and logout anchored at the bottom of the sidebar
- Central top-center success/error toast notifications
- PostgreSQL persistence
- No Docker required

## Backend setup

From `backend`:

```powershell
python -m venv .venv
.venv\Scripts\Activate.ps1
python -m pip install --upgrade pip
pip install -r requirements.txt
```

Create `.env` from `.env.example` and set your local PostgreSQL password/database.

Start the API:

```powershell
uvicorn app.main:app --reload
```

Create the one Super Admin in a second terminal:

```powershell
.venv\Scripts\Activate.ps1
python -m app.cli.create_super_admin
```

## Frontend setup

From `frontend`:

```powershell
npm install
npm run dev
```

Open `http://localhost:5173`.

## PostgreSQL

Create a database named `wave` and configure:

```env
DATABASE_URL=postgresql+psycopg://postgres:YOUR_POSTGRES_PASSWORD@localhost:5432/wave
SECRET_KEY=use-a-long-random-secret
ACCESS_TOKEN_EXPIRE_MINUTES=60
CORS_ORIGINS=http://localhost:5173,http://127.0.0.1:5173
```

Do not commit `.env` or real credentials.

## Suggested test flow

1. Start PostgreSQL.
2. Start FastAPI and confirm `/health` returns `{"status":"ok","service":"wave-api"}`.
3. Create the single Super Admin from the CLI.
4. Sign in as Super Admin and create an Admin.
5. Sign in as Admin and create a User.
6. Confirm the new User appears immediately in the Users table.
7. Use Assign Role, search for the User and Role, and assign a business role.
8. Try the same user/username/email again and confirm the red duplicate warning.
9. Sign out and sign in as the User; confirm the User cannot access management navigation.
10. Expire/remove the JWT and confirm the application returns cleanly to login rather than showing repeated API errors.
