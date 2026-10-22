# AGENTS.md

בתיאבון (Beteavon) — Hebrew meal-diary PWA. React 18 + Vite. Data lives only in
`localStorage` (no backend, no DB). No test framework.

## Commands
- `npm install` — deps
- `npm run dev` — dev server (http://localhost:5173)
- `npm run build` — verify changes (the only check; there are no tests)
- `npm run deploy` — build + push `dist/` to `gh-pages`

## Layout
- `src/App.jsx` — nearly the whole app (screens, flows, calendar); large file, ~2k lines
- `src/storage.js` — the **only** data layer (`loadData`/`saveData`, localStorage)
- `src/ai.js` — builds the prompt pasted into an external AI (no API key)
- `src/styles.css` — global styles
- `vite.config.js` — `base: "./"` so it works under any GitHub Pages repo path

## Conventions
- UI is Hebrew + RTL; all user-facing copy is in Hebrew. Heebo font. Light/dark mode.
- **Version bump on every change**: bump `version` in `package.json` (minor +1,
  patch stays 0), e.g. `2.42.0` -> `2.43.0`.
- Commit messages: concise Hebrew describing the change, ending with `+ גרסה X.YZ`
  (e.g. `... + גרסה 2.43`).
- **After every change, always**: commit, `git push origin main`, and `npm run deploy`
  — no need to ask each time.
- React + Vite idioms; keep new UI inside `App.jsx` unless a new module is clearly warranted.
- No comments unless necessary.
