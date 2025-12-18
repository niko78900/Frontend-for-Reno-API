# Homereno Frontend Documentation

## Frontend stack
- Angular 21 (standalone components, Vite dev server)
- RXJS 7, HttpClient for API calls
- Minimalist UI: CSS-only components, global styles in `src/styles.css`
- Entry point: `src/main.ts` bootstraps `App` with `appConfig` (router + HttpClient + zone change detection)

## Backend contract (Spring Boot + MongoDB @ http://localhost:8080)
- **Projects** `GET /api/projects` - list of DTOs with `{ id, name, budget, contractor, contractorName, address, progress, eta, number_of_workers, taskIds }`
  - Detail `GET /api/projects/{id}`
  - Create `POST /api/projects`
  - Partial update `PATCH /api/projects/{id}` (name, address, budget, contractor, progress, eta)
  - Remove contractor `PATCH /api/projects/{id}/contractor/remove`
  - Manage tasks `POST /api/projects/{projectId}/tasks`, `DELETE /api/projects/{projectId}/tasks/{taskId}`
  - Delete project `DELETE /api/projects/{id}`
- **Contractors** `/api/contractors`
  - List/search/filter via query params
  - Detail `GET /api/contractors/{id}`
  - Expertise enum options `GET /api/contractors/expertise`
  - Create/Update/Delete via POST/PUT/DELETE
- **Tasks** `/api/tasks`
  - List all, detail, by-project `GET /api/tasks/project/{projectId}`
  - Status enums `GET /api/tasks/statuses`
  - CRUD via POST/PUT/DELETE
- IDs are Mongo ObjectIds (strings); enums uppercase (`JUNIOR|APPRENTICE|SENIOR`, `NOT_STARTED|WORKING|FINISHED|CANCELED`). All writes expect JSON bodies.

## Frontend modules touched today
- `ProjectService`, `ContractorService`, `TaskService`: strongly typed via `Project`/`Contractor`/`Task` interfaces under `src/app/projects/models/project.model.ts`.
- `ProjectListComponent`: minimalist dashboard list with cards, status states, and router-state handoff to detail page.
- `ProjectDetailsComponent`: fetches project + tasks, shows workforce count, clickable task links, and detail panel with status, IDs, and optional description.
- Global styling adjustments in `src/styles.css` for the minimalist look; project-specific CSS lives with each component.

## Running locally
```
npm install
ng serve
```
Frontend waits on the backend at `http://localhost:8080`; make sure the Spring Boot API is running so data appears.

## Testing tips
Use Postman or curl. Set `baseUrl = http://localhost:8080` in your environment to duplicate requests quickly. Example project payload:
```json
{
  "name": "Kitchen Refresh",
  "budget": 45000,
  "contractor": "64a...",
  "address": "42 Maple Ave",
  "progress": 0,
  "eta": 6,
  "number_of_workers": 12
}
```
Replace ObjectIds/enums as needed.

## Deployment checklist
1. `npm run build` (outputs to `dist/`)
2. Serve `dist/` via static host or proxy behind the Spring Boot API.
3. Update environment variables if the backend URL differs from localhost.

## Repo hygiene tips
- Keep UI changes scoped per component.
- Update `documentation.md` whenever backend contracts change.
- Run `npm run build` before pushing to catch type/template errors early.
