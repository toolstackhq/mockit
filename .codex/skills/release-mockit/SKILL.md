---
name: release-mockit
description: Prepare and publish the next MockIt release. Use when the user asks to release, cut a version, bump npm/package version, create a tag, or push a GitHub/npm release for this repository.
---

# Release Mockit

Release MockIt from this repo in a fixed sequence:

1. Check `package.json`, `package-lock.json`, and recent tags to determine the next version.
2. Update both version fields together.
3. Run `npm run build`.
4. Commit only the release version bump with message `chore: prepare v<version> release`.
5. Create annotated tag `v<version>`.
6. Push `main` and then push the tag to `origin`.
7. Report the commit hash, tag, and build result.

## Rules

- Keep the release change minimal. Do not bundle unrelated edits into the release commit.
- Use `apply_patch` for manual file edits.
- If the user says "next version", infer the next patch version unless they specify otherwise.
- If `git push origin main` hangs without output, re-run it directly once.
- The release workflow in `.github/workflows/release-publish.yml` already uses a generic body. Do not add detailed bug-fix release notes unless the user explicitly asks.
- Verify the worktree is clean after the push.

## Version Bump

Update both files:

- `package.json`
- `package-lock.json`

Set all top-level occurrences to the same version.

## Verification

Run:

```bash
npm run build
```

Do not tag or push before the build succeeds.

## Git Commands

Use this sequence:

```bash
git add package.json package-lock.json
git commit -m "chore: prepare v<version> release"
git tag -a v<version> -m "v<version>"
git push origin main
git push origin v<version>
```

## Final Response

Keep it short and include:

- release commit hash
- version/tag pushed
- whether `npm run build` passed
- whether the working tree is clean
