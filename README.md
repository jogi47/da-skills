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

Update these global skills:

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

Update these project skills:

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

Replace `git-commit` with the skill folder name:

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
