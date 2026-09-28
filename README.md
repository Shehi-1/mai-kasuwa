# E-RECRUITMENT SYSTEM FOR UNIVERSITY

An e-recruitment platform for university staff hiring. The system provides separate applicant and recruitment-office portals, account authentication, identity verification, vacancy publishing, CV submission, application tracking, and administrative review workflows.

## Project Status

This repository is a working local development system. Applicant registration, login, NIN verification, vacancy browsing, CV upload, application submission, applicant status tracking, admin login, vacancy publishing, application queue loading, status updates, and activity history are implemented.

Local persistence is currently backed by a JSON data store and local CV files. It is suitable for development and demonstrations, but it is not yet a production deployment architecture.

## Technology Stack

### Frontend

- React 19
- TypeScript 6
- Vite 8
- Custom CSS editorial university design system
- React state and effects for workflow state
- Fetch API for frontend-to-backend communication

### Backend

- Node.js
- Express 5
- TypeScript
- CORS middleware
- `tsx` for TypeScript server execution
- Node `crypto.scrypt` for password hashing
- Node filesystem APIs for local persistence and CV storage

### Tooling

- Oxlint for linting
- TypeScript project references with strict compiler settings
- Vite production bundling
- PowerShell-compatible local development on Windows

### Planned production infrastructure

- MongoDB or another managed database
- Durable session or JWT infrastructure
- Protected object storage for CVs
- Approved NIN verification provider
- Transactional email provider
- File scanning and security monitoring

## System Architecture

The frontend is a Vite React application. The backend is an Express API running separately from the frontend.

```text
Applicant browser :5174  --\
                         HTTP/JSON --> API :4000 --> MongoDB
Admin browser     :5173  --/                    \--> CV files
```

Development ports:

- `5173`: recruitment-office admin portal
- `5174`: applicant portal
- `4000`: Express API

## Local Setup

### Requirements

- Node.js 18 or newer
- npm

### Install dependencies

```bash
npm install
```

### Start the API

Open a terminal in the project directory:

```bash
npm run api
```

The API runs at `http://localhost:4000`.

### Start the admin portal

Open a second terminal:

```bash
npm run dev
```

Open `http://localhost:5173/admin`.

### Start the applicant portal

Open a third terminal:

```bash
npm run dev:applicant
```

Open `http://localhost:5174/`.

### Health check

Open `http://localhost:4000/api/health`.

Expected response:

```json
{
  "service": "uniflow-api",
  "status": "ok",
  "database": "mongodb"
}
```

## Local Credentials

Development credentials and NIN fixtures are documented in [LOCAL_CREDENTIALS.md](LOCAL_CREDENTIALS.md).

Local admin account:

```text
Email: admin@university.edu
Password: Admin123!
```

The five fictional NIN fixtures are for local testing only. They must not be treated as real identity records.

## Applicant Workflow

1. Open `http://localhost:5174/`.
2. Create an account or sign in.
3. Verify identity using a documented development fixture or configured NIN provider.
4. Select **Continue to application**.
5. Select an open vacancy.
6. Enter qualification, experience, and cover-letter details.
7. Upload a PDF, DOC, or DOCX CV.
8. Submit the application.
9. Save the generated application reference.
10. View application status and status history from the applicant workspace.

Returning applicants see saved applications after login. Status is loaded from the API and reflects admin changes.

## Admin Workflow

1. Open `http://localhost:5173/admin`.
2. Sign in with the local admin account.
3. Use the overview to see live application and vacancy totals.
4. Open **Application queue** to search and filter persisted applications.
5. Change an application status. The update is saved and appended to status history.
6. Open **Vacancies** to view stored vacancies.
7. Use **Post a vacancy** to publish a new position.
8. Open **Recent activity** to view events derived from application history.

## API Reference

All API routes are served from `http://localhost:4000`.

### Authentication

| Method | Endpoint | Purpose | Auth |
| --- | --- | --- | --- |
| `POST` | `/api/v1/auth/register` | Create an applicant account | No |
| `POST` | `/api/v1/auth/login` | Authenticate an applicant or admin | No |
| `GET` | `/api/v1/admin/session` | Check administrator session | Admin |

Registration body:

```json
{
  "fullName": "Applicant Name",
  "email": "applicant@example.com",
  "password": "Password123!"
}
```

Login returns a user object and an in-memory bearer token. Send it as:

```text
Authorization: Bearer <token>
```

### NIN verification

| Method | Endpoint | Purpose | Auth |
| --- | --- | --- | --- |
| `POST` | `/api/v1/auth/verify-nin` | Verify an applicant identity | Applicant session recommended |

Body:

```json
{
  "nin": "12345678901"
}
```

When `NIN_PROVIDER_URL` is not configured, the API uses the five fictional development fixtures. When configured, it sends the NIN to that provider instead.

### Vacancies

| Method | Endpoint | Purpose | Auth |
| --- | --- | --- | --- |
| `GET` | `/api/v1/vacancies` | List open vacancies for applicants | No |
| `GET` | `/api/v1/admin/vacancies` | List all vacancies for administrators | Admin |
| `POST` | `/api/v1/admin/vacancies` | Publish a vacancy | Admin |
| `DELETE` | `/api/v1/admin/vacancies/:id` | Delete a vacancy without applications | Admin |

Vacancy body:

```json
{
  "title": "Senior Lecturer, Biology",
  "faculty": "Faculty of Science",
  "description": "Teaching and research position.",
  "closingDate": "2026-12-31"
}
```

### Applications

| Method | Endpoint | Purpose | Auth |
| --- | --- | --- | --- |
| `POST` | `/api/v1/applications` | Submit an application and store CV | Applicant |
| `GET` | `/api/v1/applications/me` | List current applicant applications | Applicant |
| `GET` | `/api/v1/admin/applications` | List all applications | Admin |
| `PATCH` | `/api/v1/admin/applications/:id/status` | Change application status | Admin |
| `GET` | `/api/v1/admin/activity` | List application/status events | Admin |

The current CV upload implementation sends the file as base64 JSON and stores it under `server/uploads/`.

## Data Storage

The API stores application state in the MongoDB database configured by `MONGODB_URI`, using separate `users`, `vacancies`, `applications`, and `supportRequests` collections. The existing JSON file, or an older aggregate MongoDB document, is used only as a one-time migration source when these collections are empty.

The local API also creates this path at runtime:

- `server/uploads/`: uploaded CV files

The uploads path is ignored by Git. Do not place production credentials or personal data in source-controlled files.

## Environment Variables

Copy `.env.example` to `.env` when configuring the API.

| Variable | Purpose | Default |
| --- | --- | --- |
| `PORT` | Express API port | `4000` |
| `MONGODB_URI` | MongoDB connection URI | `mongodb://127.0.0.1:27017/uniflow` |
| `VITE_API_URL` | Frontend API base URL | `http://localhost:4000/api` |
| `NIN_PROVIDER_URL` | Approved NIN provider endpoint | Empty, uses local fixtures |
| `NIN_PROVIDER_KEY` | NIN provider credential | Empty |

## Available npm Scripts

| Script | Purpose |
| --- | --- |
| `npm run dev` | Start the admin/default frontend on port 5173 |
| `npm run dev:applicant` | Start the applicant frontend on port 5174 |
| `npm run api` | Start the Express API on port 4000 |
| `npm run build` | Type-check and build the frontend |
| `npm run lint` | Run Oxlint |
| `npm run preview` | Preview the production frontend build |

## Validation

Run the standard checks:

```bash
npm run build
npm run lint
npx tsc -p server/tsconfig.json --noEmit
```

For an end-to-end local check, keep the API and both frontend servers running, then verify registration, login, NIN verification, vacancy loading, CV upload, submission, status tracking, admin queue loading, vacancy publishing, activity, and status updates in the browser.

## Security and Production Notes

The local implementation is not production-ready in its current session configuration. Before deployment:

- Replace in-memory sessions with secure durable sessions or short-lived JWTs.
- Store secrets in managed environment configuration.
- Restrict CORS to approved frontend origins.
- Add rate limiting and account lockout protections.
- Validate CV size, extension, MIME type, and file content.
- Scan uploads for malware.
- Use protected object storage instead of a local uploads directory.
- Use an approved NIN provider with consent, audit logging, and privacy controls.
- Add email delivery through an approved provider.
- Add CSRF protection where cookie-based sessions are used.
- Add audit trails for administrative actions.
- Add automated unit, integration, and browser tests.

## Known Limitations

- Sessions are held in memory and are lost when the API restarts.
- Reports and settings are currently presentation-only areas.
- Vacancy editing and closing workflows are not yet implemented.
- Export and email notification actions are not yet implemented.
- The local NIN fixtures are fictional and must not be used outside development.
