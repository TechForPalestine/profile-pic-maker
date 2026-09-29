# Referral links and the promoter leaderboard

Anyone can share a personal link, `https://ppm.techforpalestine.org/?ref=<code>`,
and every person who arrives through it and downloads a framed picture counts
for that code. `/leaderboard` ranks the approved promoters by unique downloads
(today, last 7 days, all time) and shows where downloads come from;
`/leaderboard/join` creates a link instantly (the code is generated from the
name, nothing is stored server-side) and lets people ask to be listed;
`/leaderboard/how-it-works` explains the rules.

How it fits together (`src/lib/referral.ts`, `promoters.ts`, `leaderboard.ts`):

- **Attribution.** Plausible reads `ref` as the visit source, so hand-made
  channel links (`?ref=ch-newsletter`) attribute with no code at all. The code
  is also remembered per browser for 30 days (first touch wins) and sent as the
  `referrer` custom prop on the `Landed` and `Downloaded` events, which is what
  the ranking counts. `share-*` refs belong to the share buttons and are never
  ranked; `ch-*` codes are channels, reported but not ranked as a person.
- **Registry.** Listing is moderated: join requests land as `pending` in a
  Workers KV namespace bound as `PROMOTERS` in `wrangler.jsonc`, and an
  approver publishes or rejects them on `/admin/promoters`, which talks
  to a bearer-token admin API. Only approved entries are ever served publicly.
  Without the binding (outside Cloudflare) an in-memory store is used, so the whole flow
  works in `npm run dev`.
- **Counts.** `/api/leaderboard` queries the Plausible Stats API (v2) for
  unique downloaders and unique landings grouped by `referrer`, and downloads
  by visit source, joins them onto the approved registry, and computes each
  window at most once every ten minutes and shares the result through KV
  (`src/lib/board-cache.ts`), so visitors never reach the Stats API directly. Rows rank by
  unique downloads; visits are shown for context. Without a Plausible key it
  answers 503 and the page shows a "warming up" state. Counts for codes that
  are not approved travel as `pendingCounts`, keyed by a SHA-256 fingerprint
  of the code, so the browser that created a code can show its owner their
  own row (marked pending) while nobody else learns the code.

Configuration lives in `wrangler.jsonc`: the `PROMOTERS` KV binding and the
plain variables, with a separate block under `env.preview` for preview
deploys (Pages does not inherit top-level values there). Previews have no KV
binding, so they never touch production listings. These are set in the
dashboard (Settings → Variables and Secrets, type Secret, then retry the
latest deployment) or with `wrangler pages secret put`:

| Secret                           | Purpose                                                                                  |
| -------------------------------- | ---------------------------------------------------------------------------------------- |
| `ADMIN_TOKEN`                    | Shared secret for `/admin/promoters` (32+ random characters).                            |
| `TURNSTILE_SECRET`               | Cloudflare Turnstile on the listing form. Unset: no bot check.                           |
| `PLAUSIBLE_API_KEY`              | Stats API key (Business plan feature). Without it the board shows the unavailable state. |
| `NEXT_PUBLIC_LEADERBOARD`        | `on` shows the leaderboard (see below).                                                  |
| `NEXT_PUBLIC_TURNSTILE_SITE_KEY` | Turnstile site key, public but set here so launching needs no code change.               |

Variables in `wrangler.jsonc` (`vars`):

| Variable                                  | Purpose                                                                                                                                                                                                                                   |
| ----------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `NEXT_PUBLIC_LEADERBOARD`                 | Dashboard Secret. On Cloudflare the leaderboard is shown only when this is `on`; otherwise its pages and APIs answer 404 and nothing links to them. Local and CI builds show it unless it is `off`. Referral attribution runs either way. |
| `NEXT_PUBLIC_TURNSTILE_SITE_KEY`          | Dashboard Secret. Turnstile site key. Unset: no widget.                                                                                                                                                                                   |
| `PLAUSIBLE_SITE_ID`, `PLAUSIBLE_API_HOST` | Optional overrides (default `ppm.techforpalestine.org`, `https://plausible.io`).                                                                                                                                                          |
| `LEADERBOARD_JOIN_ENABLED`                | Set to `false` to pause new listing requests (kill switch).                                                                                                                                                                               |
| `NEXT_PUBLIC_APP_URL`                     | Preview deploys only: this deploy's origin, so generated links stay on it. Filled from `CF_PAGES_URL` when `PAGES_PREVIEW=1`. Unset in production.                                                                                        |
| `NEXT_PUBLIC_PLAUSIBLE_SCRIPT_SRC`        | Preview deploys only: a staging Plausible script URL, or `off` to send no analytics. Unset in production.                                                                                                                                 |

The `NEXT_PUBLIC_*` values are inlined at build time, so set them before
the build. A preview whose `NEXT_PUBLIC_APP_URL` is not production also serves
a robots.txt that blocks crawling.

To launch the leaderboard in production (the `PROMOTERS` KV namespace is
already bound): create a Turnstile widget, add the Secrets `ADMIN_TOKEN`,
`TURNSTILE_SECRET`, `PLAUSIBLE_API_KEY` and `NEXT_PUBLIC_TURNSTILE_SITE_KEY`,
then add the Secret `NEXT_PUBLIC_LEADERBOARD` = `on` and retry the latest
deployment. To hide it again, set it to `off` (or delete it) and retry the
deployment. No code change either way.

Plausible: the site's allowed custom properties must include `referrer`,
`window`, `outcome` and `platform`. The leaderboard events are
`Leaderboard: 1 CTA Clicked`, `2 Link Created`, `3 Link Copied`
(`format`), `4 Listing Requested` (`outcome`), plus `Leaderboard: Board
Viewed` (`window`) and `Leaderboard: Profile Clicked` (`platform`); add them
as goals to see them in the dashboard.

Listing status: a listing request returns a private owner key that the
browser keeps; the server stores only its SHA-256. The join page and the
board send it to `POST /api/promoters/status` to learn whether the request is
pending, approved, rejected or unknown to the server, so nobody sees "pending
review" for a request that was declined or lost. Anyone without the key gets
`none`, so the endpoint reveals nothing about other people's listings.

The API routes are rate limited per client IP (`src/lib/rate-limit.ts`). In
production, also add a Cloudflare rate limiting rule on `/api/*`.

Moderation: approve only names that are not impersonating anyone and a link
(optional, one per entry) that goes to real public profiles with nothing abusive on them. Each entry on
the approvals page shows its last-7-day downloads and visits, and flags
numbers worth a second look. The pages promise a review within a few hours and at most a day, so keep two approvers
on rota. Every entry, approved ones included, can be edited in place (name
and link) from `/admin/promoters`; "Back to review" pulls an approved entry
into the queue without losing it, and "Take down" rejects it. The board
refreshes within ten minutes either way.
