[![Ceasefire Now](https://badge.techforpalestine.org/default)](https://techforpalestine.org/learn-more)

# Palestine Profile Pic Maker

## Overview

This is a simple browser-only web app that allows users to upload their profile picture and adds the Palestine border to show support for the Palestinian cause. The app provides an easy way for individuals to express solidarity and raise awareness.

## How to Use

1. Visit the [Palestine Profile Pic Maker](https://ppm.techforpalestine.org/).
2. Click on the "Upload" button to select your profile picture.
3. Wait for the app to process the image and apply the Palestine border.
4. Once processed, click on the "Download" button to save your modified profile picture.

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

Once a picture is downloaded, a two-tap survey appears below the share and
download buttons. It closes a gap analytics can't: the app spreads mostly
through WhatsApp and Telegram groups, which all reach Plausible as "Direct",
and referrers can never show the organic loop — people who arrived because they
saw someone else's framed picture.

Everyone is asked how they found the site, plus one rotating second question
(what's making them hesitate to post it / what would improve the app). Answers
are fixed choices sent to Plausible as `Survey: …` custom events, so nothing
personal or free-form ever reaches analytics. The survey is asked once per
browser — bump `SURVEY_VERSION` in `src/lib/survey.ts` to run a fresh wave.

Questions and answer options live in `src/lib/survey.ts`; edit them there.

### Optional: written feedback via Tally

Set `NEXT_PUBLIC_TALLY_FORM_ID` to a [Tally](https://tally.so) form ID and a
"Tell us more" link appears on the thank-you step, carrying the tapped answers
across as hidden fields (`source`, `blocker`/`improve`, `from=ppm`) so a written
comment can be read next to them. Leave it unset and the link is simply hidden.
Tally's free plan covers unlimited responses; no third-party script is loaded on
the page either way.

## Testing

| Command                 | What it runs                                                           |
| ----------------------- | ---------------------------------------------------------------------- |
| `npm test`              | Integration tests (API route, upstream mocked) — fast & deterministic  |
| `npm run test:e2e`      | Browser e2e (upload → fetch → generate → download), upstream mocked    |
| `npm run test:e2e:live` | Full-stack e2e against the **real** tech4palestine pic (needs network) |
| `npm run test:live`     | Live integration smoke against the real `api.fxtwitter.com`            |

Or use the devbox shortcuts: `devbox run test` and `devbox run test:live`.

Playwright needs a browser. Normally `npx playwright install chromium` handles
it; in sandboxes where that download is blocked, run `./scripts/run-e2e-local.sh`,
which installs an npm-hosted Chromium and points Playwright at it via
`PLAYWRIGHT_CHROMIUM_PATH`.

## License

This project is open source and available under the [MIT License](LICENSE).

## Disclaimer

This app is created for the purpose of expressing support for the Palestinian cause. Please use it responsibly and respect the rights and privacy of others.
