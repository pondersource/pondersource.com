#!/usr/bin/env python3
"""Generate crawlable HTML from the launcher's catalog; no third-party dependencies."""
import argparse
from html import escape
from html.parser import HTMLParser
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
ORIGIN = "https://pondersource.com"

# Editorial context complements the short catalog descriptions in index.html.
DETAILS = {
    "litewrite": ("Distraction-free notes", "Write notes without a busy interface. Litewrite is a lightweight notepad for capturing ideas and working offline.", ["Write and edit text notes", "Keep writing offline", "Use remoteStorage to keep your notes in your own storage"]),
    "inbox-rs": ("A universal inbox", "Collect things you want to keep in one inbox: links to revisit, quick notes, images, emails and audio.", ["Save URLs and notes", "Collect images, emails and audio", "Keep your inbox in remoteStorage"]),
    "hyperdraft": ("Notes that become a website", "Build a connected collection of text notes. Hyperdraft uses double-bracket links to connect ideas and lets you turn notes into a website.", ["Write and organise text notes", "Connect ideas with double-bracket links", "Publish notes as a website"]),
    "sharesome": ("File sharing from your own storage", "Share a file from your remoteStorage account. Sharesome provides a focused interface for making files available to others.", ["Share files from remoteStorage", "Keep shared files in your own account"]),
    "webmarks": ("Your personal bookmark collection", "Keep useful websites together in a bookmark collection stored in your remoteStorage account.", ["Save links you want to revisit", "Organise your bookmarks", "Store your collection in remoteStorage"]),
    "todonna": ("Simple to-do and shopping lists", "Keep track of everyday tasks or your next shopping trip with a small, focused list app.", ["Create to-do lists", "Keep a shopping list", "Use a simple interface without ads"]),
    "inspektor": ("Browse your remoteStorage data", "See what is inside your remoteStorage account. RS Inspektor is a tool for browsing folders, previewing files and working with JSON data.", ["Browse storage folders", "Preview files", "Inspect and edit JSON"]),
    "savr": ("Save articles for offline reading", "Build a reading list for later. Savr keeps saved articles on your device and can sync them with remoteStorage.", ["Save articles to read later", "Read saved articles offline", "Keep articles locally or sync with remoteStorage"]),
    "marco": ("Maps and saved places", "Collect places you want to remember. Explore a map, organise saved locations into lists and sync them with remoteStorage.", ["Explore maps", "Save places to lists", "Sync saved places with remoteStorage"]),
    "umai": ("Your recipe collection", "Bring recipes together in a personal cookbook. Umai helps you collect recipes and plan your cooking, with your cookbook saved to your connected storage.", ["Collect recipes", "Plan your cooking", "Save your cookbook to your chosen storage"]),
    "media-kraken": ("Track movies and what to watch next", "Keep a record of movies you have watched and a collection of films to watch later. Media Kraken saves your collection to your connected storage.", ["Track watched movies", "Keep a watch-later collection", "Save your collection to your chosen storage"]),
    "solid-memo": ("Spaced-repetition flashcards", "Study with flashcards and spaced repetition. You can try Solid Memo as a guest, or connect storage to keep your progress across devices.", ["Study with flashcards", "Review using spaced repetition", "Try guest mode or save progress across devices"]),
}


class CatalogParser(HTMLParser):
    def __init__(self):
        super().__init__()
        self.apps = []
        self.app = None
        self.depth = 0
        self.field = None

    def handle_starttag(self, tag, attrs):
        attrs = dict(attrs)
        if tag == "div":
            if "data-app-id" in attrs:
                self.app = {"id": attrs["data-app-id"], "sources": []}
                self.depth = 0
            if self.app is not None:
                self.depth += 1
        if self.app is None:
            return
        if tag in ("h3", "p"):
            self.field = "name" if tag == "h3" else "description"
            self.app[self.field] = ""
        if tag == "img":
            self.app["icon"] = "/" + attrs["src"].lstrip("/")
        if tag == "button" and "data-base-href" in attrs:
            self.app["url"] = attrs["data-base-href"]
        if tag == "a" and attrs.get("target") == "_blank":
            self.app["sources"].append(attrs["href"])

    def handle_data(self, data):
        if self.app is not None and self.field:
            self.app[self.field] += data

    def handle_endtag(self, tag):
        if tag in ("h3", "p"):
            self.field = None
        if tag == "div" and self.app is not None:
            self.depth -= 1
            if self.depth == 0:
                self.apps.append(self.app)
                self.app = None


def page(title, description, path, body):
    return f'''<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>{escape(title)}</title>
  <meta name="description" content="{escape(description, quote=True)}">
  <link rel="canonical" href="{ORIGIN}{path}">
  <meta property="og:title" content="{escape(title, quote=True)}">
  <meta property="og:description" content="{escape(description, quote=True)}">
  <meta property="og:url" content="{ORIGIN}{path}">
  <meta property="og:type" content="website">
  <link rel="stylesheet" href="/assets/css/app-pages.css">
</head>
<body>
  <nav class="site-nav" aria-label="Main navigation"><a href="/">Ponder Source</a><a href="/apps/">All apps</a></nav>
  <main>
{body}
  </main>
  <footer><p>Ponder Source maintains forks of open source projects, keeping them available for everyone to use and build on.</p><p><a href="/">App launcher</a> · <a href="https://org.pondersource.com/">Stichting Ponder Source</a></p></footer>
</body>
</html>
'''


def build():
    parser = CatalogParser()
    parser.feed((ROOT / "index.html").read_text())
    apps = parser.apps
    assert {a["id"] for a in apps} == set(DETAILS), "Update editorial details when the catalog changes"
    assert len(apps) == len(DETAILS), "Duplicate catalog app ID"
    outputs = {}
    cards = []
    for app in apps:
        app_id = app["id"]
        name = escape(app["name"])
        description = escape(app["description"])
        subtitle, intro, features = DETAILS[app_id]
        path = f"/apps/{app_id}/"
        assert len(app["sources"]) == 2, f"Missing source links: {app_id}"
        assert (ROOT / app["icon"].lstrip("/")).is_file(), f"Missing icon: {app_id}"
        feature_list = "\n".join(f"        <li>{escape(item)}</li>" for item in features)
        outputs[f"apps/{app_id}/index.html"] = page(
            f'{app["name"]} — {subtitle} | Ponder Source', app["description"], path,
            f'''    <img class="app-icon" src="{app['icon']}" alt="" width="88" height="88">
    <h1>{name}</h1>
    <p class="intro">{description}</p>
    <div class="actions"><a class="button" href="{app['url']}/">Open {name}</a><a href="/">Go to your app launcher</a></div>
    <div class="details">
      <h2>{escape(subtitle)}</h2>
      <p>{escape(intro)}</p>
      <ul>
{feature_list}
      </ul>
      <h2>Get started</h2>
      <p>Open {name} to use the app on its own website. To keep a shortcut, visit the Ponder Source launcher, choose App store, and install {name}.</p>
      <p>Installing adds a shortcut to your launcher. Removing it does not delete your data in the app.</p>
      <h2>Open source, maintained by Ponder Source</h2>
      <p>This is Ponder Source’s hosted fork of {name}. Explore our version or the upstream project:</p>
      <ul><li><a href="{escape(app['sources'][0], quote=True)}">{name}: Ponder Source fork</a></li><li><a href="{escape(app['sources'][1], quote=True)}">{name}: upstream source</a></li></ul>
    </div>''')
        cards.append(f'''      <article class="app-card">
        <img class="app-icon" src="{app['icon']}" alt="" width="88" height="88" loading="lazy">
        <h2><a href="{path}">{name}</a></h2>
        <p>{description}</p>
        <a href="{path}">Explore {name}</a>
      </article>''')
    outputs["apps/index.html"] = page(
        "Independent Open Source Apps | Ponder Source",
        "Browse open source apps for notes, bookmarks, tasks, recipes, movies and more. Find an app and open it directly from Ponder Source.",
        "/apps/", '    <h1>Independent apps for everyday life</h1>\n    <p class="intro">Find an open source app for writing, organising, reading or learning. Explore what each app does, then open it directly. Ponder Source maintains these community projects as hosted forks.</p>\n    <div class="app-grid">\n' + "\n".join(cards) + "\n    </div>")
    paths = ["/", "/apps/"] + [f"/apps/{a['id']}/" for a in apps] + ["/2020-2025/index.html"]
    outputs["sitemap.xml"] = '<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n' + "".join(f"  <url><loc>{ORIGIN}{path}</loc></url>\n" for path in paths) + "</urlset>\n"
    outputs["robots.txt"] = f"User-agent: *\nAllow: /\n\nSitemap: {ORIGIN}/sitemap.xml\n"
    return outputs


if __name__ == "__main__":
    cli = argparse.ArgumentParser(description=__doc__)
    cli.add_argument("--check", action="store_true", help="Fail if committed pages need regeneration")
    args = cli.parse_args()
    stale = []
    for name, content in build().items():
        target = ROOT / name
        if args.check:
            if not target.exists() or target.read_text() != content:
                stale.append(name)
        else:
            target.parent.mkdir(parents=True, exist_ok=True)
            target.write_text(content)
    if stale:
        raise SystemExit("Regenerate app pages with python3 scripts/build-app-pages.py: " + ", ".join(stale))
    print("App pages, sitemap and robots.txt are up to date." if args.check else "Generated app pages, sitemap and robots.txt.")
