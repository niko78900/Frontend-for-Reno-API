# HomerenoFrontend

Homereno is a frontend for planning and tracking home renovation projects with budgets, contractors, tasks, and map-based locations.

## Project Goal

Deliver a clean, responsive dashboard that lets users create renovation projects, assign contractors, manage tasks, track progress/ETA, and visualize project locations on a map.

## Project Structure

- `src/app/app.*`: root shell and router outlet
- `src/app/app.routes.ts`: client-side routes
- `src/app/home/`: landing page and projects overview map
- `src/app/projects/`: project list, details, create flow, and map components
- `src/app/projects/location-map/`: interactive Leaflet map with draggable marker
- `src/app/services/`: API services for projects, tasks, contractors, and geocoding
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

## Backend

The backend is provided separately in the Spring Boot repo: https://github.com/niko78900/RenoAPI
