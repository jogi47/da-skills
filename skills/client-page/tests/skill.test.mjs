// Run with: node --test tests/
// The skill's SKILL.md header must stay valid YAML, or neither the installer nor Claude Code can read it.
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const here = dirname(fileURLToPath(import.meta.url));
const text = readFileSync(join(here, "..", "SKILL.md"), "utf8");

test("SKILL.md starts with a name and a plain one-line description that YAML can read", () => {
  const m = text.match(/^---\n([\s\S]*?)\n---\n/);
  assert.ok(m, "front matter between --- lines");
  const lines = m[1].split("\n");
  const fields = Object.fromEntries(lines.map(l => [l.slice(0, l.indexOf(":")), l.slice(l.indexOf(":") + 1).trim()]));
  assert.equal(fields.name, "client-page");
  const d = fields.description;
  assert.ok(d && d.length > 50 && d.length < 1024, "description present and under 1024 characters");
  // In a plain YAML scalar, ": " starts a mapping and " #" starts a comment; both break the header.
  assert.ok(!/: /.test(d), 'description must not contain ": "');
  assert.ok(!/ #/.test(d), 'description must not contain " #"');
  assert.ok(!/^["'&*!|>%@`{[]/.test(d), "description must not start with a YAML indicator");
});
