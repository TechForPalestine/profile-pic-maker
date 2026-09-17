[![Ceasefire Now](https://badge.techforpalestine.org/default)](https://techforpalestine.org/learn-more)

# Palestine Profile Pic Maker

## Overview

This is a simple browser-only web app that allows users to upload their profile picture and adds the Palestine border to show support for the Palestinian cause. The app provides an easy way for individuals to express solidarity and raise awareness.

## How to Use

1. Visit the [Palestine Profile Pic Maker](https://ppm.techforpalestine.org/).
2. Click on the "Upload" button to select your profile picture.
3. Wait for the app to process the image and apply the Palestine border.
4. Optionally tick "Add ppm.t4p.al to the frame" to curve the short URL along the bottom of the border, so anyone who sees your picture knows where to make theirs. Left unticked, the border stays plain.
5. Once processed, click on the "Download" button to save your modified profile picture.

## Contribution

Feel free to contribute to the project by submitting issues or pull requests. Your contributions are highly appreciated.

## Development

This project uses [devbox](https://www.jetify.com/devbox) to provide a
reproducible development environment (Node.js 22, git, and npm) without relying
on a globally installed toolchain.

### With devbox (recommended)

1. Clone the repository: `git clone https://github.com/TechForPalestine/profile-pic-maker.git`
2. Open the project directory: `cd profile-pic-maker`
3. Install dependencies: `devbox run npm install`
4. Run the project: `devbox run npm run dev`

Run the full required test suite with:

```bash
devbox run test
```

Run the live upstream tests with:

```bash
devbox run test:live
```

### Without devbox

If you already have Node.js 22 and git installed:

> Requires Node.js 22+ (see `.nvmrc`).

1. Clone the repository: `git clone https://github.com/TechForPalestine/profile-pic-maker.git`
2. Open the project directory: `cd profile-pic-maker`
3. Install dependencies: `npm ci`
4. Run the project: `npm run dev`

## Post-download survey

Once a picture is downloaded, a one-tap survey appears below the share and
download buttons, asking the things Plausible can't answer: where the framed
picture is actually going, where that person's attention lives, whether anyone
else in their circle has framed a picture, and what nearly stopped them.

Each visitor is asked exactly one question, drawn at random from the current
wave in `src/lib/survey.ts`. Answers are fixed choices sent to Plausible as
`Survey: …` custom events, so nothing personal or free-form ever reaches
analytics. The survey is asked once per browser.

Keep a wave to three or four questions: every visitor answers one, so a larger
wave splits the same downloads more thinly and each question takes
proportionally longer to reach a readable sample. To start the next wave, swap
the set (there are spares in `PARKED_QUESTIONS`) and bump `SURVEY_VERSION`,
which re-asks everyone.

### Optional: written feedback via Tally

Set `NEXT_PUBLIC_TALLY_FORM_ID` to a [Tally](https://tally.so) form ID and a
"Tell us more" link appears on the thank-you step, carrying the tapped answer
across as a hidden field (the question's id — `destination`, `attention`,
`network` or `friction` — plus `from=ppm`) so a written comment can be read
next to it. Leave it unset and the link is simply hidden.
Tally's free plan covers unlimited responses; no third-party script is loaded on
the page either way.

## Referral links and the promoter leaderboard

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
  Workers KV namespace (accessed over the REST API, so no build-time binding),
  and an approver publishes or rejects them on `/admin/promoters`, which talks
  to a bearer-token admin API. Only approved entries are ever served publicly.
  Without Cloudflare credentials an in-memory store is used, so the whole flow
  works in `npm run dev`.
- **Counts.** `/api/leaderboard` queries the Plausible Stats API (v2) for
  downloads grouped by `referrer` and by visit source, joins them onto the
  approved registry, and caches for five minutes. Without a Plausible key it
  answers 503 and the page shows a "warming up" state. Counts for codes that
  are not approved travel as `pendingCounts`, keyed by a SHA-256 fingerprint
  of the code, so the browser that created a code can show its owner their
  own row (marked pending) while nobody else learns the code.

Environment variables (Cloudflare Pages → Settings → Environment variables):

| Variable                                                                      | Purpose                                                                                  |
| ----------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------- |
| `PLAUSIBLE_API_KEY`                                                           | Stats API key (Business plan feature). Without it the board shows the unavailable state. |
| `PLAUSIBLE_SITE_ID`, `PLAUSIBLE_API_HOST`                                     | Optional overrides (default `ppm.techforpalestine.org`, `https://plausible.io`).         |
| `CLOUDFLARE_ACCOUNT_ID`, `CLOUDFLARE_KV_NAMESPACE_ID`, `CLOUDFLARE_API_TOKEN` | KV namespace for the registry. Token scope: Workers KV Storage, Edit.                    |
| `ADMIN_TOKEN`                                                                 | Shared secret for `/admin/promoters` (32+ random characters).                            |
| `TURNSTILE_SECRET`, `NEXT_PUBLIC_TURNSTILE_SITE_KEY`                          | Cloudflare Turnstile on the listing form. Unset: no bot check, no widget.                |
| `LEADERBOARD_JOIN_ENABLED`                                                    | Set to `false` to pause new listing requests (kill switch).                              |

One-time Plausible step: add `referrer` under the site's allowed custom
properties so the prop is queryable.

Moderation: approve only names that are not impersonating anyone and links
that go to real public profiles with nothing abusive on them. The pages
promise a review within a few hours and at most a day, so keep two approvers
on rota. "Take down" removes an approved entry immediately; the board
refreshes within five minutes.

## Testing

| Command                 | What it runs                                                                                        |
| ----------------------- | --------------------------------------------------------------------------------------------------- |
| `npm test`              | Integration tests (API route, upstream mocked) — fast & deterministic                               |
| `npm run test:e2e`      | Browser e2e (upload → fetch → generate → download) on Chromium, Firefox and WebKit, upstream mocked |
| `npm run test:e2e:live` | Full-stack e2e against the **real** tech4palestine pic (needs network)                              |
| `npm run test:live`     | Live integration smoke against the real `api.fxtwitter.com`                                         |

Or use the devbox shortcuts: `devbox run test` and `devbox run test:live`.

### Browsers

The e2e suite runs on Chromium, Firefox and WebKit — the app rasterises a DOM
node client-side (`html-to-image` → canvas → download), which is where the
engines disagree. CI runs one job per engine; locally `npm run test:e2e` runs
all three and `npm run test:e2e -- --project=webkit` narrows to one.

Install them with `npx playwright install chromium firefox webkit`. In
sandboxes where that download is blocked, `./scripts/run-e2e-local.sh` installs
an npm-hosted Chromium and points Playwright at it via
`PLAYWRIGHT_CHROMIUM_PATH` (Chromium only).

## License

This project is open source and available under the [MIT License](LICENSE).

## Disclaimer

This app is created for the purpose of expressing support for the Palestinian cause. Please use it responsibly and respect the rights and privacy of others.
