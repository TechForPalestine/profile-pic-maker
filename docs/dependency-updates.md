# Dependency update policy

How we keep dependencies current without drowning in review or getting burned by
a bad release. This is the written contract behind
[`.github/dependabot.yml`](../.github/dependabot.yml).

## Goals

- **Stay current** on security and routine fixes.
- **Few, themed PRs** — routine bumps batch together; a human reviews and merges
  every one (no auto-merge).
- **Supply-chain safety** — a soak period before adopting a new release, so a
  malicious or broken version that gets yanked within days never reaches us.
- **Fast lane for real CVEs** — critical/high advisories are not made to wait.
- **Deliberate majors** — breaking changes and deprecations are handled as
  scheduled migration work, never rubber-stamped.

## The three tiers

| Tier | What | Cadence | Grouping | Cooldown | Who merges |
|---|---|---|---|---|---|
| **Routine** | patch + minor bumps | Monthly | One `routine` PR (plus `react` / `eslint-stack` when those are involved) | 7 days (3 for patch) | Human, after a skim + green CI |
| **Security** | Dependabot security updates for published advisories | **Immediate** | Ungrouped — one PR per fix | **None** (bypasses soak) | Human, prioritised by CVSS; criticals same-day |
| **Major** | major version bumps / deprecations needing code changes | As released | Coordinated toolchains grouped (`react`, `eslint-stack`); framework/standalone majors individual | 14 days | Human, as a migration PR |

### Why cooldown *and* immediate security updates coexist

Dependabot has two independent channels:

- **Version updates** (driven by this config) — subject to the `cooldown`. This is
  the supply-chain soak: if `some-lib@2.3.4` is compromised and yanked within a
  week, the cooldown means we never opened a PR for it.
- **Security updates** — triggered by a GitHub advisory, **ignore the schedule and
  the cooldown** and open as soon as the advisory publishes. This is the CVSS 9/10
  fast lane. They're left ungrouped so a critical fix is never blocked behind a
  co-grouped low-severity one.

> One-time enablement (GitHub Settings, not this file): turn on **Dependabot
> alerts** and **Dependabot security updates** under
> *Settings → Advanced Security* (or org policy). The security fast lane does not
> exist until these are on.

## Grouping (how the pile-up shrinks)

Groups are matched top-to-bottom; a dependency joins the **first** group it
matches, so specific groups are declared before the catch-all `routine`:

- **`react`** — `react`, `react-dom`, `@types/react`, `@types/react-dom` move as
  one PR (all update types). They must never be split — a react/react-dom version
  skew breaks the build.
- **`eslint-stack`** — `eslint`, `eslint-config-next`, `@typescript-eslint/*`,
  and the prettier eslint plugins. The ESLint 9 / typescript-eslint 8 flat-config
  migration is one coordinated PR, not five.
- **`routine`** — every remaining **patch/minor** bump, in a single monthly PR.
- **Ungrouped** — a **major** of anything not in `react`/`eslint-stack`
  (`next`, `tailwindcss`, `@types/node`, `dayjs`, …) opens as its own PR, because
  each is a focused migration.

Worked example — the 10 stale upstream PRs collapse to ~6 themed ones:

| Today (individual) | Becomes |
|---|---|
| react-icons minor, dev-patch-minor group | **`routine`** (1 PR) |
| `react` + `react-dom` + their types (2 PRs) | **`react`** (1 PR) |
| ts-eslint parser + plugin + eslint-config-next (3 PRs) | **`eslint-stack`** (1 PR) |
| `next` 14→16 | individual major (1 PR) |
| `tailwindcss` 3→4 | individual major (1 PR) |
| `@types/node` 24→25 | individual major (1 PR) |

## Handling the existing stale Dependabot PRs (run on the upstream repo)

Do this **after** the new `.github/dependabot.yml` lands on upstream:

1. **Merge or close the trivial routine ones first** (e.g. the react-icons minor
   and the dev-patch-minor group). The new `routine` group regenerates anything
   still outstanding cleanly on the next run.
2. **Close the split majors** so Dependabot recreates them grouped:
   - the two React PRs → reopen as one **`react`** PR;
   - the three ESLint/ts-eslint PRs → reopen as one **`eslint-stack`** PR.
   Either wait for the next scheduled run or comment `@dependabot recreate`.
3. **Keep the framework/standalone majors as deliberate migrations:**
   - `next` **14 → 16** is *two* majors — do 14→15, then 15→16, not one jump.
   - `tailwindcss` **3 → 4** is a config-format rewrite — own PR, own testing.
   - `@types/node` major — small, but verify build/types.
4. From then on the steady state is: one monthly `routine` PR, immediate security
   PRs, and the occasional grouped/individual major.

## Future flow (steady state)

- **Monthly:** a `routine` PR appears → glance at the changelog links → CI green →
  merge.
- **On advisory:** a security PR appears immediately → check CVSS → criticals
  merged same-day, others within the sprint.
- **On a major:** a grouped (`react` / `eslint-stack`) or individual PR appears →
  scheduled as migration work → read release notes for deprecations/breaking
  changes → apply required code changes in the same PR → merge when green.

## Known caveats for reviewers

- **`.npmrc` has `legacy-peer-deps=true`.** Installs succeed even when peer ranges
  conflict, so a major bump (e.g. React 19, Next 15+) can install cleanly yet be
  subtly incompatible. During **major** reviews, check peer ranges by hand — don't
  rely on `npm ci` to surface the mismatch.
- **TypeScript is on v7 but the lint stack still runs on v6.** `typescript@7` (the
  Go-native rewrite) exposes no programmatic compiler API, which
  `@typescript-eslint` and `ts-api-utils` need — pointing them at TS 7 crashes
  ESLint on load. As a bridge, TS 6 is installed under the `typescript-lint` alias
  and `scripts/link-ts6-for-eslint.mjs` (a `postinstall` hook) symlinks it into
  every copy of those packages in `node_modules`, so ESLint type-checks against
  TS 6 while `tsc`, `next build` (via `experimental.useTypeScriptCli`), and editors
  use TS 7. **Future work:** once typescript-eslint releases TS 7 support, delete
  the script, the `postinstall` hook, and the `typescript-lint` devDependency, and
  drop `experimental.useTypeScriptCli` from `next.config.js` if Next.js no longer
  requires it.
- **CI runs live third-party tests (`api.fxtwitter.com`, Twitter CDN) on the
  required path.** A dependency PR can go red from an upstream outage, not the
  bump. Two retries are configured; if it's clearly a transient network failure,
  re-run the job or comment `@dependabot recreate`.
- **Test coverage is Twitter-only.** The GitHub/GitLab/Bluesky/`gaza-status`/
  upload paths are not exercised, so the safety net is thinner for changes that
  touch those areas — review such bumps more carefully. Widening coverage is the
  highest-leverage way to make future updates safer to merge.
