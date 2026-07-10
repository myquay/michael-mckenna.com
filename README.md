# michael-mckenna.com

This repository contains the Hugo source for [michael-mckenna.com](https://michael-mckenna.com). The current theme presents the site as a Windows 95-style desktop, with navigable Explorer and document windows backed by normal Hugo pages.

## Repository structure

- `blog/config/` contains Hugo configuration.
- `blog/content/` contains posts, notes, activity entries, projects, and standalone pages.
- `blog/themes/win95/` contains the active theme, including its templates, JavaScript, and CSS.
- `blog/static/` contains files copied directly into the generated site.
- `design/` contains source material and generators used to create runtime assets. Files here are not published by Hugo.
- `scripts/` contains repository verification tooling.

Generated output under `blog/public/`, Hugo caches, editor metadata, and generated Python bytecode are intentionally not tracked.

## Local development

Hugo 0.120.0 or newer is required by the Win95 theme.

Serve the site locally:

```sh
HUGO_CACHEDIR=/private/tmp/hugo_cache hugo server --source blog --bind 127.0.0.1 --port 1313 --disableFastRender
```

Then open `http://127.0.0.1:1313/`.

Create a clean production-style build:

```sh
HUGO_CACHEDIR=/private/tmp/hugo_cache hugo --source blog --destination /private/tmp/michael-mckenna-hugo-check --cleanDestinationDir
```

## Window architecture

Every route has two related Hugo outputs:

- The normal `HTML` output renders a complete page, including the desktop shell and taskbar.
- The custom `WINDOW` output renders a `window.html` fragment that the desktop can fetch and mount without a full page reload.

The contract between Hugo and the Win95 JavaScript bundle is carried by `data-window-*` attributes rendered by the theme. Content-specific names, icons, application identifiers, and window kinds should be defined through content front matter and `file-metadata.html` wherever possible. Desktop shortcuts point to that rendered metadata instead of duplicating an application catalogue in JavaScript.

The home `WINDOW` output is assembled by `desktop-context.html`. It supplies desktop shortcuts, shell-owned Explorer windows, RSS Setup, and About for on-demand hydration; the full-page layouts remain responsible for rendering the single taskbar.

Window layout, taskbar ordering, Explorer view preferences, and desktop shortcut positions are persisted in local storage under `michael95.osState`. Changes to that state shape should include a migration in `assets/js/win95/10-state.js`.

## Assets

Only files required by the published site belong under `blog/static/`. Reusable source assets, contact sheets, and generation scripts belong under `design/`. The complete Windows 95 icon catalogue is retained under `design/win95-icons/`; selected runtime icons are copied into `blog/static/images/win95-icons/`.

The theme's JavaScript and CSS are split into responsibility-focused files under `assets/js/win95/` and `assets/css/win95/`. Hugo concatenates, minifies, and fingerprints each group into one production JavaScript bundle and one production stylesheet.

The RSS generators write their complete, ignored design output to `design/rss-icons-95/generated/` and copy only the assets used by the theme into `blog/static/images/rss-icons-95/`:

```sh
python3 design/rss-icons-95/generate_icons.py
python3 design/rss-icons-95/generate_wizard_panel.py
```

## Verification

Run the complete repository check from the repository root:

```sh
./scripts/verify-site.sh
```

The command performs a clean Hugo build, validates the generated JavaScript bundle, checks generated local links and assets, and fails if generated operating-system or cache files are tracked.

The build currently reports known Goldmark warnings for raw HTML in several historical posts. These warnings do not fail verification, but they remain content cleanup work.

## Deployment

Pushes to `main` run repository verification, build the production artifact, and deploy that exact artifact to Azure Blob Storage before purging the Cloudflare cache. The workflow can also be started manually.

Legacy routes are owned by Hugo `aliases` in content front matter. This keeps redirects beside their canonical content and makes the generated alias pages independent of any particular hosting provider.
