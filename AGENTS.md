# Repository Guidelines

## Project Structure & Module Organization

- `app/`: Next.js App Router pages/layouts and global styles (`app/globals.css`).
- `components/`: shared React components (client or server as needed).
- `lib/`: utilities and integrations; Supabase clients and generated types in `lib/supabase/`.
- `public/`: static assets served from `/`.
- `scripts/`: maintenance scripts, including `scripts/gen-supabase-types.mjs`.
- Root configs: `next.config.ts`, `tsconfig.json`, `eslint.config.mjs`, `proxy.ts`.
- Build outputs: `.next/` and `node_modules/` are generated; do not edit or commit.
- `src/` exists but is currently unused; only move code if you adopt a full `src/` layout.

## Build, Test, and Development Commands

Use npm because `package-lock.json` is committed.

- `npm install`: install dependencies.
- `npm run dev`: start the dev server at `http://localhost:3000`.
- `npm run lint`: run ESLint with Next core-web-vitals and TypeScript rules.
- `npm run build`: create a production build (run before PRs).
- `npm start`: serve the production build locally.
- `npm run gen:types`: refresh Supabase types in `lib/supabase/database.types.ts` (requires env vars in `.env.local`).

## Coding Style & Naming Conventions

- TypeScript with `strict` enabled; keep props and shared shapes typed.
- Match existing formatting: 2-space indentation, double quotes, semicolons.
- Components use `PascalCase.tsx` (example: `components/QuoteForm.tsx`); utilities use `camelCase.ts`.
- Prefer the `@/*` alias from `tsconfig.json` for imports.

## Testing Guidelines

- No automated test runner is configured yet.
- If adding tests, keep them near the feature (example: `components/__tests__/QuoteForm.test.tsx`) and add scripts to `package.json`.

## Commit & Pull Request Guidelines

- Git history only shows the initial scaffold commit, so no established convention.
- Recommended: Conventional Commits (examples: `feat: add quote export`, `fix: handle empty price`).
- PRs should include a brief summary, verification steps (at least `npm run lint` and `npm run build`), and screenshots for UI changes.

## Security & Configuration Tips

- Store secrets in `.env.local` and never commit credentials.
- Supabase setup details live in `SUPABASE.md`; update docs if you change schema or env requirements.
