# Deploying to Cloudflare Pages

The app runs on Cloudflare Pages through
[next-on-pages](https://github.com/cloudflare/next-on-pages), with every API
route on the edge runtime. Use Cloudflare's Git integration: every push to the
production branch deploys, and every other branch and pull request gets its
own preview URL.

In the Cloudflare dashboard: **Workers & Pages → Create application →
Continue to Pages → Import an existing Git repository**, pick this
repository, then set:

| Setting                | Value                                                   |
| ---------------------- | ------------------------------------------------------- |
| Project name           | `palestine-pfp` (must match `name` in `wrangler.jsonc`) |
| Production branch      | `main`                                                  |
| Framework preset       | Next.js                                                 |
| Build command          | `npx @cloudflare/next-on-pages@1`                       |
| Build output directory | `.vercel/output/static`                                 |
| Root directory         | `/`                                                     |

If the repository is not listed, give the Cloudflare Pages GitHub app access
to it (GitHub → Settings → Applications → Cloudflare Pages → Configure).

Node is pinned to 22 by `.nvmrc`, which the build image reads. `wrangler.jsonc`
is the source of truth for the project's name, output directory,
compatibility date and the `nodejs_compat` flag, so the dashboard shows those
read-only.

Everything except the dashboard Secrets (listed in
[the leaderboard docs](leaderboard.md)) comes from `wrangler.jsonc`. Under
**Settings → Variables and Secrets**, add those as type Secret
(the dashboard only accepts Secrets while `wrangler.jsonc` exists, and
variables typed into the project-creation form are discarded, so add them
after the project exists). Do not add plain values there: they would
conflict with the file.
After changing any variable, retry the latest deployment: a deployment keeps
the values it was built with.

Finally add the site's hostname to the Turnstile widget, and a rate limiting
rule on `/api/*` (Security → WAF → Rate limiting rules).
