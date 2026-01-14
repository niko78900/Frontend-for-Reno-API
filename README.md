# HomerenoFrontend

Homereno is a frontend for planning and tracking home renovation projects with budgets, contractors, tasks, and map-based locations.

## Project Goal

Deliver a clean, responsive dashboard that lets users create renovation projects, assign contractors, manage tasks, track progress/ETA, and visualize project locations on a map.

## Project Structure

- `src/app/app.*`: root shell and router outlet
- `src/app/app.routes.ts`: client-side routes
- `src/app/auth/`: login, register, and pending approval pages
- `src/app/admin/`: admin approval screen
- `src/app/home/`: landing page and projects overview map
- `src/app/projects/`: project list, details, create flow, and map components
- `src/app/projects/location-map/`: interactive Leaflet map with draggable marker
- `src/app/services/`: API services for projects, tasks, contractors, and geocoding
- `src/app/guards/`: auth and admin route guards
- `src/app/interceptors/`: API key + JWT interceptor
- `src/app/projects/models/`: TypeScript domain models
- `src/app/projects/utils/`: shared utilities (ETA calculations)
- `src/styles.css`: global theme tokens and base styles
- `public/`: static assets
- `Documentation/`: requirements and planning notes

## Running the app

```bash
ng serve
```

Then open `http://localhost:4200/`.

## API key config

The app loads API settings from `public/config.json` at startup. The default dev key is
`dev-local-key` and the base URL is `http://localhost:8080`.

To use a different key locally, create `public/config.local.json` (gitignored) with:

```json
{
  "apiBaseUrl": "http://localhost:8080",
  "apiKey": "dev-local-key"
}
```

## Auth and roles

- Login and register at `/login` and `/register`.
- New accounts are pending admin approval; the app routes to `/pending` after register.
- Login returns 403 for pending users; the UI shows a friendly status message.
- Protected routes require a JWT; `/admin/users` requires `ADMIN`.
- Session data (`token`, `username`, `role`) is stored in `localStorage`.
- The interceptor adds `X-API-KEY` to same-origin requests and adds `Authorization`
  for `/api/**` except `/api/auth/**` and `/uploads/**`. 401 redirects to `/login`.

## Project images

Open a project detail page and use **Manage images** to view the gallery, upload new images,
or delete existing ones. Uploads accept a file plus optional description; the server sets
the uploader.

Uploads are capped at 50 images per project (the UI blocks uploads at the limit). The UI
accepts `image/*` files and warns if the file type is unknown, but the backend validates
image contents by file bytes and returns 400 for invalid images or limit violations.

Images are served by the backend under `/uploads/**`; the app uses the returned `url` directly
and skips the `Authorization` header for `/uploads/**`.

## Backend

The backend is provided separately in the Spring Boot repo: https://github.com/niko78900/RenoAPI
