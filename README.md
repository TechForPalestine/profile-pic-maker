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

If you want to run the app locally, follow these steps:

1. Clone the repository: `git clone https://github.com/TechForPalestine/profile-pic-maker.git`
2. Open the project directory: `cd profile-pic-maker`
3. Install dependencies: `npm ci`
4. Run the project: `npm run dev`

## Testing

| Command | What it runs |
|---|---|
| `npm test` | Integration tests (API route, upstream mocked) — fast & deterministic |
| `npm run test:e2e` | Browser e2e (upload → fetch → generate → download), upstream mocked |
| `npm run test:e2e:live` | Full-stack e2e against the **real** tech4palestine pic (needs network) |
| `npm run test:live` | Live integration smoke against the real `api.fxtwitter.com` |

Playwright needs a browser. Normally `npx playwright install chromium` handles
it; in sandboxes where that download is blocked, run `./scripts/run-e2e-local.sh`,
which installs an npm-hosted Chromium and points Playwright at it via
`PLAYWRIGHT_CHROMIUM_PATH`.

## License

This project is open source and available under the [MIT License](LICENSE).

## Disclaimer

This app is created for the purpose of expressing support for the Palestinian cause. Please use it responsibly and respect the rights and privacy of others.
