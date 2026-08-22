1. Commit the staged changes to Git. Make sure you draft the commit message according to the guidelines defined below.

2. If the changes are not staged, refuse to make the commit immediately. We want to avoid any unintentional commits, especially if the author has triggered the command by accident.

3. Do not include the message below in the commit message:
```
🤖 Generated with [Claude Code](https://claude.ai/code)
Co-Authored-By: Claude <noreply@anthropic.com>
```

## Here are the commit message convention:

- Use `Conventional Commits` format: `type(scope): description`
- Types: `feat`, `fix`, `test`, `refactor`, `docs`, `style`, `chore`, `perf`, `ci`, `build`, `revert`
- **Scope:** Use the affected module, feature, or package (e.g., `auth`, `api`, `ui`). Scope is optional but recommended.
- **Description:** Use the imperative mood (e.g., "add", "fix", "update").
- **Subject line:** Limit it to 72 characters only. If it exceeds even by one character, Husky will block the commit. So please ensure the limit is followed.
  maximum 72). Let me fix this:
- Optionally, add a body for more detail and a footer for breaking changes or issue references.

So the recommended limits are:
- Subject line: 72 characters (if possible)
- Body lines: 100 characters maximum (enforced by commitlint)
- The commit message must be all lowercase