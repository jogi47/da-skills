#!/usr/bin/env python3
"""Fetch a Slack channel's recent history (plus threads) as readable text.

Token comes from SLACK_TOKEN or the macOS Keychain, never from a file or an argument.
"""

import argparse
import json
import os
import subprocess
import sys
import time
import urllib.error
import urllib.parse
import urllib.request
from datetime import datetime, timedelta

API = "https://slack.com/api/"
KEYCHAIN_SERVICE = os.environ.get("SLACK_KEYCHAIN_SERVICE", "slack-bot")


def token():
    env = os.environ.get("SLACK_TOKEN")
    if env:
        return env
    try:
        out = subprocess.run(
            ["security", "find-generic-password", "-a", os.environ.get("USER", ""),
             "-s", KEYCHAIN_SERVICE, "-w"],
            capture_output=True, text=True, check=True,
        )
        return out.stdout.strip()
    except (subprocess.CalledProcessError, FileNotFoundError):
        sys.exit(
            f"No token. Store one with:\n"
            f"  security add-generic-password -a \"$USER\" -s {KEYCHAIN_SERVICE} -w\n"
            f"(or export SLACK_TOKEN)"
        )


def call(method, tok, **params):
    """One Web API call, retrying on rate limit."""
    url = API + method + "?" + urllib.parse.urlencode(
        {k: v for k, v in params.items() if v is not None}
    )
    req = urllib.request.Request(url, method="POST",
                                 headers={"Authorization": "Bearer " + tok})
    for attempt in range(5):
        try:
            with urllib.request.urlopen(req) as r:
                body = json.load(r)
        except urllib.error.HTTPError as e:
            if e.code == 429:
                time.sleep(int(e.headers.get("Retry-After", 5)))
                continue
            raise
        if body.get("ok"):
            return body
        if body.get("error") == "ratelimited":
            time.sleep(5)
            continue
        sys.exit(f"{method} failed: {body.get('error')}")
    sys.exit(f"{method}: gave up after rate limiting")


def paged(method, tok, key, **params):
    cursor = None
    while True:
        body = call(method, tok, cursor=cursor, **params)
        yield from body.get(key, [])
        cursor = body.get("response_metadata", {}).get("next_cursor")
        if not cursor:
            return


def resolve(name, tok):
    """Accept a channel id, a #name or a name."""
    name = name.lstrip("#")
    if name.startswith("C") and name.isupper() and len(name) > 8:
        return name, name
    for c in paged("conversations.list", tok, "channels", limit=1000,
                   types="public_channel,private_channel", exclude_archived="true"):
        if c["name"] == name:
            return c["id"], c["name"]
    sys.exit(f"No channel named '{name}' visible to this token.")


def names(path):
    if path and os.path.exists(path):
        with open(path) as f:
            return json.load(f)
    return {}


def fetch_files(m, tok, dest):
    """Download a message's attachments into dest; return display lines."""
    lines = []
    for f in m.get("files", []):
        url = f.get("url_private_download") or f.get("url_private")
        name = f"{m['ts'].replace('.', '_')}_{f.get('id')}_{f.get('name', 'file')}"
        if not url or not dest:
            lines.append(f"[file {f.get('id')} {f.get('mimetype')}: not downloaded]")
            continue
        os.makedirs(dest, exist_ok=True)
        path = os.path.join(dest, os.path.basename(name))
        req = urllib.request.Request(url, headers={"Authorization": "Bearer " + tok})
        try:
            with urllib.request.urlopen(req) as r:
                ctype = r.headers.get("Content-Type", "")
                data = r.read()
        except urllib.error.HTTPError as e:
            lines.append(f"[file {f.get('id')}: download failed HTTP {e.code}]")
            continue
        if ctype.startswith("text/html"):
            lines.append(f"[file {f.get('id')}: got HTML not a file, token likely lacks files:read]")
            continue
        with open(path, "wb") as out_f:
            out_f.write(data)
        lines.append(f"[file saved: {path}]")
    return lines


def render(msgs, users, tok, channel_id, threads, files_dir=None, want_files=False):
    out = []
    for m in reversed(msgs):
        ts = datetime.fromtimestamp(float(m["ts"])).strftime("%Y-%m-%d %H:%M")
        who = users.get(m.get("user", ""), m.get("user") or m.get("bot_id") or "?")
        text = m.get("text", "")
        out.append(f"[{ts}] {who}: {text}")
        if want_files:
            out.extend("    " + l for l in fetch_files(m, tok, files_dir))
        if threads and m.get("reply_count"):
            replies = call("conversations.replies", tok,
                           channel=channel_id, ts=m["ts"], limit=200)["messages"]
            for r in replies[1:]:
                rts = datetime.fromtimestamp(float(r["ts"])).strftime("%H:%M")
                rwho = users.get(r.get("user", ""),
                                 r.get("user") or r.get("bot_id") or "?")
                body = r.get("text", "").replace("\n", "\n        ")
                out.append(f"    └ [{rts}] {rwho}: {body}")
                if want_files:
                    out.extend("        " + l for l in fetch_files(r, tok, files_dir))
    return "\n".join(out)


def main():
    p = argparse.ArgumentParser(description=__doc__)
    p.add_argument("channel", help="channel id, #name or name")
    p.add_argument("--days", type=float, default=3, help="how far back (default 3)")
    p.add_argument("--limit", type=int, default=500, help="max messages (default 500)")
    p.add_argument("--no-threads", action="store_true", help="skip thread replies")
    p.add_argument("--users", help="optional local JSON map of user id -> display name")
    p.add_argument("--files", metavar="DIR",
                   help="download attached files (screenshots) into DIR and list the paths; "
                        "then Read the image paths to view them")
    p.add_argument("--json", action="store_true", help="raw JSON instead of text")
    a = p.parse_args()

    tok = token()
    cid, cname = resolve(a.channel, tok)
    oldest = (datetime.now() - timedelta(days=a.days)).timestamp()

    msgs = []
    for m in paged("conversations.history", tok, "messages",
                   channel=cid, limit=200, oldest=f"{oldest:.6f}"):
        msgs.append(m)
        if len(msgs) >= a.limit:
            break

    if a.json:
        json.dump(msgs, sys.stdout, indent=2)
        return

    print(f"# #{cname} ({cid}) — {len(msgs)} messages, last {a.days} days\n")
    print(render(msgs, names(a.users), tok, cid, not a.no_threads,
                 a.files, a.files is not None))


if __name__ == "__main__":
    main()
