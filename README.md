# da-skills

Personal, agent-neutral skills. Workflows use available capabilities rather than provider-specific tool names or installation paths. Service-specific requirements (such as Chrome, Figma or Cloudflare) remain part of each skill's purpose.

Recently added reusable workflows:

- [chrome-ui-verification](skills/chrome-ui-verification/SKILL.md): manual checks in the user's Chrome.
- [jigar-artifact-writing](skills/jigar-artifact-writing/SKILL.md): personal writing rules and checker.
- [dev-progress-page](skills/dev-progress-page/SKILL.md): HTML progress pages; also install `jigar-artifact-writing`.
- [slack-digest](skills/slack-digest/SKILL.md): read channel history with an existing token; private user maps stay outside the repo.
- [handoff-new-session](skills/handoff-new-session/SKILL.md): explicitly requested handoffs through available session tools, with a file fallback.
- [git-commit-on-new-branch](skills/git-commit-on-new-branch/SKILL.md): branch and commit only already-staged changes.
- [git-create-pr](skills/git-create-pr/SKILL.md): GitHub or Azure DevOps PRs from the current or a named source branch.
- [manual-qa-checklist](skills/manual-qa-checklist/SKILL.md): short manual checks with expected visible results.
- [embedded-browser-verification](skills/embedded-browser-verification/SKILL.md): checks in the selected browser pane and its existing session.
- [ado-work-items](skills/ado-work-items/SKILL.md): Azure DevOps ticket reads, progress drafts and explicitly requested updates.
- [app-insights-kql](skills/app-insights-kql/SKILL.md): read-only Azure telemetry diagnostics with discovered resources and schemas.
- [onesignal-email-templates](skills/onesignal-email-templates/SKILL.md): template backups, dry-run diffs and verified live updates with project-specific configuration.

## Install

Install all skills globally for your chosen agent. Set `AGENT` to its installer ID first:

```sh
npx skills add jogi47/da-skills --skill '*' --agent "$AGENT" --global --yes
```

Install into the current project instead:

```sh
npx skills add jogi47/da-skills --skill '*' --agent "$AGENT" --yes
```

Restart your agent after installing.

## Update

Update one global skill by name:

```sh
npx skills update video-context-transcriber --global --yes
```

Update one project skill by name:

```sh
npx skills update video-context-transcriber --project --yes
```

Update all global skills from this repo:

```sh
npx skills update --global --yes \
  task-group-planner \
  git-commit-no-verify \
  design-spec-advocate \
  search-markdown-qmd \
  call-rest-apis-restish \
  self-contained-execution-plans \
  figma-implementation-contract \
  video-context-transcriber \
  task-group-executor \
  query-data-sq \
  git-commit \
  chief-engineer-delegator \
  client-page
```

Update all project skills from this repo:

```sh
npx skills update --project --yes \
  task-group-planner \
  git-commit-no-verify \
  design-spec-advocate \
  search-markdown-qmd \
  call-rest-apis-restish \
  self-contained-execution-plans \
  figma-implementation-contract \
  video-context-transcriber \
  task-group-executor \
  query-data-sq \
  git-commit \
  chief-engineer-delegator \
  client-page
```

Restart your agent after updating.

## Install One Skill

Install `video-context-transcriber` globally:

```sh
npx skills add jogi47/da-skills --skill video-context-transcriber --agent "$AGENT" --global --yes
```

Install `video-context-transcriber` into the current project:

```sh
npx skills add jogi47/da-skills --skill video-context-transcriber --agent "$AGENT" --yes
```

Example with another skill:

```sh
npx skills add jogi47/da-skills --skill git-commit --agent "$AGENT" --global --yes
```

## List Available Skills

```sh
npx skills add jogi47/da-skills --list
```

## Verify

List installed skills:

```sh
npx skills list
```

## Remove

Remove one skill:

```sh
npx skills remove git-commit --agent "$AGENT" --global --yes
```
