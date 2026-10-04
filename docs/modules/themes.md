# Organization themes (theme builder)

Each organization keeps a library of themes and marks one active. The active theme is applied to every member's app on sign-in: brand colour scale, status colours, font, base font size, spacing, corner radius, light/dark default, logo and favicon.

## Code

| Layer      | Path                                                                                                                                                                                      |
| ---------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Backend    | `apps/backend/src/modules/themes/` (`theme.routes.ts`, `theme.service.ts`, `theme.repository.ts`, `theme.mapper.ts`, `theme.dto.ts`)                                                      |
| Builder UI | `apps/zcc-frontend/src/app/features/theme-builder/` (`theme-builder.component`, `theme-draft.ts`, `color-field`, `theme-preview`)                                                         |
| Runtime    | `core/theme/theme-runtime.service.ts` (applies the theme), `shared/utils/brand-palette.ts` (shade generation and WCAG contrast), `core/services/theme.service.ts` (light/dark preference) |
| API client | `core/api/themes.api.ts`                                                                                                                                                                  |

## API

Base path `/api/v1/themes`; the router requires sign-in.

| Method               | Path             | Permission      | Purpose                                                   |
| -------------------- | ---------------- | --------------- | --------------------------------------------------------- |
| GET                  | `/active`        | signed in       | The organization's active theme (every member loads this) |
| PUT                  | `/active`        | `themes:manage` | Save directly into the active theme                       |
| GET                  | `/`              | `themes:read`   | Theme library                                             |
| POST                 | `/`              | `themes:manage` | Create                                                    |
| GET / PATCH / DELETE | `/:id`           | read / manage   | Read, update, soft delete                                 |
| POST                 | `/:id/activate`  | `themes:manage` | Make active (at most one per organization)                |
| POST                 | `/:id/duplicate` | `themes:manage` | Copy under a new name                                     |

## How a theme is applied

`ThemeRuntimeService` reloads whenever the signed-in organization changes and clears on sign-out. For a theme with a valid `primaryColor` it:

1. Generates the 11-step brand scale (`brandPalette()`: fixed mixes towards white or black) and sets `--brand-50` … `--brand-950` on `<html>`. Tailwind's `indigo-*` utilities read these variables, so every indigo class follows the tenant colour.
2. Sets `--app-font` / `--zv-font` (loading the Google font if needed), `--app-radius` / `--zv-radius-control`, `--zv-accent`, root `font-size` (rem scaling), `--app-spacing`, `--zv-control-height` (28 px + 4 × spacing), and `--color-success|warning|error|info`.
3. Swaps the favicon and applies the organization's default light/dark mode unless the user chose one.

Failure to load is ignored: the app keeps its built-in indigo look.

## Data model

`Theme`: name, description, primary/secondary/accent/background/text/surface colours, success/warning/error/info colours, font family, font size, spacing, border radius, logo URL, favicon URL, mode, `isDefault`, version, soft-delete fields.

## Frontend

`/theme-builder` (`themes:read`): theme list, editor with colour fields and contrast hints, live preview, activate and duplicate actions (`themes:manage`).

## Tests

`themes/theme.service.spec.ts`, `shared/utils/brand-palette.spec.ts`. No specs for the builder UI.

## Review notes

- The builder shows the contrast of white text on the primary colour (`theme-builder.component.ts:131`), but the API accepts any colour. A light tenant colour makes white button text unreadable across the app; consider refusing (or requiring confirmation for) a primary colour below 4.5:1 against white.
- The built-in defaults these variables override (indigo `#6366f1`, 10 px radius, Outfit) are documented in the ZCC design system extracted from `src/styles/`.
