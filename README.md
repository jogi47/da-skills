# da-skills

Personal Codex skills.

## Install

Install all skills for Codex globally:

```sh
npx skills add jogi47/da-skills --skill '*' --agent codex --global --yes
```

Install into the current project instead:

```sh
npx skills add jogi47/da-skills --skill '*' --agent codex --yes
```

Restart Codex after installing.

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
  chief-engineer-delegator
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
  chief-engineer-delegator
```

Restart Codex after updating.

## Install One Skill

Install `video-context-transcriber` globally:

```sh
npx skills add jogi47/da-skills --skill video-context-transcriber --agent codex --global --yes
```

Install `video-context-transcriber` into the current project:

```sh
npx skills add jogi47/da-skills --skill video-context-transcriber --agent codex --yes
```

Example with another skill:

```sh
npx skills add jogi47/da-skills --skill git-commit --agent codex --global --yes
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
npx skills remove git-commit --agent codex --global --yes
```
