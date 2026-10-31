#!/usr/bin/env python3
"""Check artifact text against Jigar's writing rules (the mechanical ones).

Usage: check_writing.py <file.html|file.md|file.txt> [more files]

Reads the visible prose only: <script>, <style>, <code> and <pre> blocks, HTML tags, Markdown code
fences and code spans are skipped, and HTML entities are decoded first (so &mdash; is caught).
Reports a count per file, then each finding as  L<line>  LEVEL  rule: "match"  -- context

  HARD  must be fixed; exit code 1 if any
  CUT   rewrite unless the word is literal
  LOOK  a second look: often a banned shape or a metaphor, sometimes fine

The script cannot judge register, length or layout; the SKILL.md checklist still needs a read by eye.
"""
import html
import re
import sys

# ----------------------------------------------------------------------------- rule tables

BANNED_WORDS = [
    r"leverag(?:e|es|ed|ing)", r"elevat(?:e|es|ed|ing)", r"unlock(?:s|ed|ing)?", r"unleash(?:es|ed|ing)?",
    r"empower(?:s|ed|ing|ment)?", r"robust(?:ly|ness)?", r"seamless(?:ly)?", r"cutting-edge", r"world-class",
    r"rocket fuel", r"synerg(?:y|ies|istic)", r"crucial(?:ly)?", r"vital(?:ly)?", r"pivotal",
    r"delv(?:e|es|ed|ing)", r"div(?:e|es|ing) into", r"deep[- ]dives?", r"foster(?:s|ed|ing)?",
    r"harness(?:es|ed|ing)?", r"streamlin(?:e|es|ed|ing)", r"holistic(?:ally)?", r"game[- ]changers?",
    r"mov(?:e|es|ed|ing) the needle", r"doubl(?:e|es|ed|ing) down",
]

BANNED_OPENERS = [
    r"in today's fast-paced world", r"ultimately", r"fundamentally", r"at the end of the day",
    r"it is worth noting", r"it's worth noting", r"it is important to note", r"it's important to note",
    r"that said",
]

# American spelling -> UK, matched as whole words. Kept to forms whose UK spelling is not in doubt.
US_SPELLINGS = {
    r"(organi|recogni|analy|priori|minimi|maximi|optimi|summari|customi|initiali|normali|authori|finali|"
    r"standardi|utili|categori|emphasi|reali|apologi|synchroni|visuali|locali|memori|characteri|speciali|"
    r"critici|stabili|saniti|capitali|digiti|itemi|personali)z(e|es|ed|ing|ation|ations|er|ers)":
        "use -ise / -isation",
    r"analyz(e|es|ed|ing|er|ers)": "analyse",
    r"(behavior|favor|honor|labor|neighbor|flavor|humor|rumor|harbor|vapor|endeavor|savior)(s|ed|ing|al|ally|able|ite|ites)?":
        "-our",
    r"color(s|ed|ing|ful|less)?": "colour",
    r"(center|theater|fiber|liter|caliber)(s|ed|ing)?": "-re",
    r"(label|cancel|travel|model|level|signal|total|channel|fuel|marvel|tunnel)(ed|ing|er|ers)":
        "double the l (labelled, cancelled)",
    r"(defense|offense|pretense)s?": "-ence",
    r"catalog(s|ed|ing)?": "catalogue",
    r"gray(s|ed|ish)?": "grey",
    r"enrollments?": "enrolment",
    r"fulfill(s|ment)?": "fulfil / fulfilment",
    r"aluminum": "aluminium",
    r"mold(s|ed|ing)?": "mould",
    r"plow(s|ed|ing)?": "plough",
    r"pajamas": "pyjamas",
}

# Spellings that depend on meaning: flag for a look, never as hard.
US_SPELLINGS_LOOK = {
    r"programs?": "UK: programme, except a computer program",
    r"licenses?": "UK noun: licence (verb: license)",
    r"practices?": "UK verb: practise (noun: practice)",
    r"dialogs?": "UK: dialogue, except a dialog box in software",
    r"toward": "UK: towards",
    r"meters?": "UK: metre for length (meter is a measuring device)",
}

CUT_WORDS = [
    (r"quietly", "quietly: cut unless it means actual noise"),
    (r"silent(?:ly)?", "silently: cut unless it means actual noise"),
    (r"deliberate(?:ly)?", "deliberately: give the reason instead"),
    (r"earns? (?:its|their|a) place|earned (?:its|their|a) place", "\"earns its place\": include it and say nothing"),
    (r"reads (?:as|like)|read (?:as|like)", "\"read\" as interpretation: say what it is or how it appears"),
    (r"my read(?: is)?", "\"my read\": say what you think plainly"),
]

LOOK_PHRASES = [
    (r"\bnot just\b", "elevation formula (\"not just X, but Y\"): say Y"),
    (r"\b(?:isn't|is not|wasn't|was not|aren't|are not)\b[^.?!]{1,60}, (?:it's|it is|they're|they are)\b",
     "negation then correction: state the positive"),
    (r"\bit's not\b[^.?!]{0,40}[.!] it's not\b", "contrastive triad"),
    (r"\bso what\b[^.?!]*\?", "rhetorical question as a link: state the answer"),
    (r"\b(?:less|more) an? \w+, (?:less|more) an? \w+", "paired metaphor"),
    (r"\band that matters\b|\bwhich is exactly the point\b|\bthat's the point\b", "applauding your own line"),
    (r"\bwhat matters (?:more|most)\b|\bthe thing everyone misses\b", "significance claim"),
    (r"\bworth flagging\b|\bto be clear\b|\blet me be explicit\b|\bworth mentioning\b", "announcing the sentence"),
    (r"\bwon't pretend\b|\bwe won't pretend\b", "candour pat on the back"),
    (r"\bhonest trade-?off\b|\bin the spirit of transparency\b", "corporate honesty label"),
    (r"\bthoughts\?|\bsomething to consider\b", "closing filler: stop when the point is made"),
    (r"\bthought about this properly\b", "validation filler"),
    (r"\b[A-Z][a-z]+\. [A-Z][a-z]+\.(?=\s|$)", "fragments stuck together? (\"Fast. Simple.\")"),
    (r"\bnavigat(?:e|es|ed|ing|ion)\b", "navigate: fine for leaving a page, not as a metaphor"),
    (r"\becosystems?\b|\bjourneys?\b|\brealms?\b|\blandscapes?\b", "metaphor word? fine only when literal"),
]

EMOJI = re.compile(
    "[\U0001F000-\U0001FAFF\U00002600-\U000027BF\U0001F900-\U0001F9FF\U00002B00-\U00002BFF️]"
)

# ----------------------------------------------------------------------------- text extraction


def _blank(match):
    """Replace a skipped region with as many newlines as it held, so line numbers stay right."""
    return "\n" * match.group(0).count("\n")


def visible_lines(raw, is_html):
    text = raw
    if is_html:
        text = re.sub(r"<!--.*?-->", _blank, text, flags=re.S)
        for tag in ("script", "style", "code", "pre"):
            text = re.sub(rf"<{tag}\b.*?</{tag}>", _blank, text, flags=re.S | re.I)
        # Keep the text of title, alt and data-caption attributes: they are prose people read.
        text = re.sub(
            r"<[^>]*>",
            lambda m: " ".join(re.findall(r'(?:alt|title|data-caption|aria-label)="([^"]*)"', m.group(0)))
            + "\n" * m.group(0).count("\n"),
            text,
            flags=re.S,
        )
        text = html.unescape(text)
    else:
        text = re.sub(r"```.*?```", _blank, text, flags=re.S)
        text = re.sub(r"`[^`\n]*`", " ", text)
        text = re.sub(r"\]\([^)]*\)", "]", text)  # Markdown link targets
    return text.split("\n")


# ----------------------------------------------------------------------------- checks


def check_line(line):
    found = []

    def add(level, rule, match):
        found.append((level, rule, match))

    for m in re.finditer("—", line):
        add("HARD", "em-dash: use a colon, comma, semicolon, brackets or two sentences", "—")
    for m in re.finditer("–", line):
        before, after = line[: m.start()].rstrip(), line[m.end():].lstrip()
        if not (before[-1:].isdigit() and after[:1].isdigit()):
            add("HARD", "en-dash outside a number range", "–")
    for m in EMOJI.finditer(line):
        add("HARD", "emoji", m.group(0))
    for pattern in BANNED_WORDS:
        for m in re.finditer(rf"\b{pattern}\b", line, re.I):
            add("HARD", "banned word", m.group(0))
    for pattern in BANNED_OPENERS:
        for m in re.finditer(rf"(?:^|[.!?:]\s+|^\s*[-*]\s+|\(\s*)({pattern})\b", line, re.I):
            add("HARD", "banned opener or transition", m.group(1))
    for pattern, uk in US_SPELLINGS.items():
        for m in re.finditer(rf"\b{pattern}\b", line, re.I):
            add("HARD", f"American spelling ({uk})", m.group(0))
    for m in re.finditer(r"\bthe app\b", line, re.I):
        add("HARD", "\"the app\" on its own: write the mobile app or the web portal", m.group(0))

    for pattern, rule in CUT_WORDS:
        for m in re.finditer(rf"\b(?:{pattern})\b", line, re.I):
            add("CUT", rule, m.group(0))

    for pattern, rule in LOOK_PHRASES:
        flags = 0 if "[A-Z]" in pattern else re.I
        for m in re.finditer(pattern, line, flags):
            add("LOOK", rule, m.group(0))
    for pattern, note in US_SPELLINGS_LOOK.items():
        for m in re.finditer(rf"\b{pattern}\b", line, re.I):
            add("LOOK", f"spelling depends on meaning ({note})", m.group(0))
    return found


def check_file(path):
    with open(path, encoding="utf-8") as f:
        raw = f.read()
    is_html = path.lower().endswith((".html", ".htm")) or raw.lstrip().lower().startswith(("<!doctype", "<html"))
    findings = []
    for number, line in enumerate(visible_lines(raw, is_html), start=1):
        for level, rule, match in check_line(line):
            context = re.sub(r"\s+", " ", line).strip()
            findings.append((number, level, rule, match, context[:110]))
    return findings


def main(paths):
    if not paths:
        print(__doc__)
        return 2
    order = {"HARD": 0, "CUT": 1, "LOOK": 2}
    hard = 0
    for path in paths:
        findings = sorted(check_file(path), key=lambda f: (order[f[1]], f[0]))
        counts = {level: sum(1 for f in findings if f[1] == level) for level in order}
        hard += counts["HARD"]
        print(f"{path}: {counts['HARD']} HARD, {counts['CUT']} CUT, {counts['LOOK']} LOOK")
        for number, level, rule, match, context in findings:
            print(f"  L{number:<5} {level:<4}  {rule}: \"{match}\"  -- {context}")
    return 1 if hard else 0


if __name__ == "__main__":
    sys.exit(main(sys.argv[1:]))
