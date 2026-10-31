#!/usr/bin/env python3
"""Build a development progress page (one panel per ticket) from a JSON description.

    render.py page.json > page.html        the whole page
    render.py --panel item.json             one panel, to paste into an existing page
    render.py --chips page.html             every panel's status chips, for the check after a merge

Text fields are HTML fragments: <code>, <b>, <a> are allowed, and a literal &, < or > must be written
as &amp;, &lt; or &gt;. See SKILL.md for the data contract.
"""
import html
import json
import os
import re
import sys

HERE = os.path.dirname(os.path.abspath(__file__))
ASSETS = os.path.join(HERE, "assets")

STATUS_LABEL = {"pass": "Passed", "partly": "Partly tested", "not": "Not tested", "fail": "Failed"}
CHIP_CLASS = {"pass": "chip pass", "warn": "chip warn", "plain": "chip"}
CELL_STATES = ("done", "part", "wait", "todo")
SHOT_LAYOUT = {"wide": "shots wide", "phone": "shots", "strip": "shots strip"}


def fail(message):
    sys.exit(f"render.py: {message}")


def attr(text):
    return html.escape(text, quote=True)


def chip(c):
    kind = c.get("kind", "plain")
    if kind not in CHIP_CLASS:
        fail(f"chip kind must be one of {sorted(CHIP_CLASS)}, got {kind!r}")
    return f'        <span class="{CHIP_CLASS[kind]}"><i class="dot"></i>{c["text"]}</span>'


def case(prefix, i, c):
    status = c.get("status", "not")
    if status not in STATUS_LABEL:
        fail(f"case status must be one of {sorted(STATUS_LABEL)}, got {status!r}")
    return (
        f'            <li><span class="case-id">{prefix}.{i}</span><span>{c["step"]}'
        f'<span class="case-exp">{c["expect"]}</span></span><span class="case-status">'
        f'<span class="status {status}">{STATUS_LABEL[status]}</span>'
        f'<span class="how">{c.get("how", "")}</span></span></li>'
    )


def shots(item):
    block = item.get("shots") or {}
    files = block.get("items") or []
    if not files:
        return ""
    layout = block.get("layout", "wide")
    if layout not in SHOT_LAYOUT:
        fail(f"shots layout must be one of {sorted(SHOT_LAYOUT)}, got {layout!r}")
    buttons = "\n".join(
        f'''        <button class="shot" type="button" data-src="shots/{attr(s["file"])}" data-caption="{attr(s["caption"])}">
          <img src="shots/{attr(s["file"])}" alt="{attr(s["alt"])}" loading="lazy">
          <span>{s["label"]}</span>
        </button>'''
        for s in files
    )
    return f'''        <div class="{SHOT_LAYOUT[layout]}" data-group="t-{attr(item["id"])}">
{buttons}
        </div>
'''


def panel(item, ticket_url):
    for key in ("id", "label", "title", "chips", "changed", "cases", "tickets"):
        if key not in item:
            fail(f"item {item.get('id', '?')} has no {key!r}")
    changed = "\n".join(f"            <li>{c}</li>" for c in item["changed"])
    prefix = item.get("case_prefix", "1")
    cases = "\n".join(case(prefix, i + 1, c) for i, c in enumerate(item["cases"]))
    extra = item.get("extra_html", "")
    tickets = "\n".join(
        f'        <li><a class="ticket" href="{attr(ticket_url.format(no=t["no"]))}" target="_blank" '
        f'rel="noopener"><span class="no">#{t["no"]}</span><span class="t">{t["title"]}</span></a></li>'
        for t in item["tickets"]
    )
    chips = "\n".join(chip(c) for c in item["chips"])
    return f'''  <!-- ===================================================== {item["id"]} -->
  <article class="item" id="t-{attr(item["id"])}">
    <details class="panel">
    <summary class="item-head">
      <div class="item-no">{item["label"]}</div>
      <h2>{item["title"]}</h2>
      <div class="chips">
{chips}
      </div>
    </summary>

    <div class="cols">
      <div class="text">
        <div>
          <h3>What changed</h3>
          <ul>
{changed}
          </ul>
        </div>
{extra}        <details class="howto">
          <summary><h3>How to test</h3></summary>
          <ol class="cases">
{cases}
          </ol>
        </details>
      </div>

      <div>
{shots(item)}      </div>
    </div>

    <div class="tickets">
      <h3>Tickets</h3>
      <ul>
{tickets}
      </ul>
    </div>
    </details>
  </article>

'''


def section(sec, ticket_url):
    intro = "".join(f'      <p class="lede">{p}</p>\n' for p in sec.get("intro", []))
    items = "".join(panel(i, ticket_url) for i in sec.get("items", []))
    return f'''  <details class="section-toggle" id="{attr(sec["id"])}">
    <summary class="scope-head"><h2>{sec["title"]}</h2></summary>
    <div class="section-body">
      <p class="lede section-count">{sec["count"]}</p>
{intro}    </div>
  </details>

{items}'''


def strip(page, ticket_url):
    cells = []
    for sec in page["sections"]:
        for item in sec.get("items", []):
            state = item.get("state", "done")
            if state not in CELL_STATES:
                fail(f"item {item['id']} state must be one of {CELL_STATES}, got {state!r}")
            cells.append((item["id"], state, f'#t-{item["id"]}', item.get("strip_title", item["title"]), False))
        # Tickets with no panel of their own (done on the board, or waiting): they link to the ticket.
        for extra in sec.get("strip_only", []):
            cells.append((extra["no"], extra.get("state", "wait"), ticket_url.format(no=extra["no"]), extra["title"], True))
    done = sum(1 for c in cells if c[1] == "done")
    wait = sum(1 for c in cells if c[1] == "wait")
    count = page.get("strip_count") or f"{done} of {len(cells)} done" + (f" · {wait} waiting on a decision" if wait else "")
    lines = []
    for no, state, href, title, external in cells:
        target = ' target="_blank" rel="noopener"' if external else ""
        tip = re.sub(r"<[^>]+>", "", title)
        lines.append(f'      <a class="cell {state}" href="{attr(href)}"{target} title="{attr(no)} · {attr(html.unescape(tip))}">{no}</a>')
    cells_html = "\n".join(lines)
    return f'''  <section class="scope" aria-label="Tickets">
    <div class="scope-head">
      <h2>{page.get("strip_heading", "Tickets")}</h2>
      <span class="scope-count">{count}</span>
    </div>
    <nav class="strip" aria-label="Tickets">
{cells_html}
    </nav>
    <div class="legend"><span><i class="swatch done"></i>Done</span><span><i class="swatch part"></i>In progress</span><span><i class="swatch"></i>To do</span><span><i class="swatch wait"></i>Waiting on an answer</span></div>
  </section>

'''


def page_html(page):
    for key in ("title", "eyebrow", "sections", "ticket_url"):
        if key not in page:
            fail(f"page has no {key!r}")
    ticket_url = page["ticket_url"]
    css = open(os.path.join(ASSETS, "page.css")).read()
    js = open(os.path.join(ASSETS, "page.js")).read()
    viewer = open(os.path.join(ASSETS, "viewer.html")).read()
    about = page.get("about", {})
    about_paras = "\n".join(f'        <p class="lede">{p}</p>' for p in about.get("paragraphs", []))
    footer = ""
    if about_paras:
        footer = f'''  <footer>
    <details class="howto about">
      <summary><h3>{about.get("title", "About this page and earlier deploys")}</h3></summary>
      <div class="about-body">
{about_paras}
      </div>
    </details>
  </footer>
'''
    body = "".join(section(s, ticket_url) for s in page["sections"])
    return f'''<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
<title>{html.escape(page["title"])}</title>
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Bricolage+Grotesque:opsz,wght@12..96,600;12..96,700&family=Figtree:wght@400;500;600;700&family=JetBrains+Mono:wght@500&display=swap">
<style>
{css}</style>
</head>
<body>

<div class="wrap">
  <header>
    <div class="eyebrow">{page["eyebrow"]}</div>
    <h1>{page["title"]}</h1>
  </header>

{strip(page, ticket_url)}{body}{footer}</div>

{viewer}
<script>
{js}</script>
</body>
</html>
'''


def list_chips(path):
    text = open(path).read()
    for m in re.finditer(r'<article class="item" id="([^"]+)">.*?<div class="chips">(.*?)</div>', text, re.S):
        chips = [re.sub(r"<[^>]+>", "", c) for c in re.findall(r'<span class="chip[^"]*"><i class="dot"></i>(.*?)</span>', m.group(2))]
        print(f"{m.group(1)}: " + " / ".join(chips))


def main(argv):
    if len(argv) == 3 and argv[1] == "--panel":
        data = json.load(open(argv[2]))
        sys.stdout.write(panel(data, data.get("ticket_url", "{no}")))
    elif len(argv) == 3 and argv[1] == "--chips":
        list_chips(argv[2])
    elif len(argv) == 2 and not argv[1].startswith("-"):
        sys.stdout.write(page_html(json.load(open(argv[1]))))
    else:
        sys.exit(__doc__)


if __name__ == "__main__":
    main(sys.argv)
