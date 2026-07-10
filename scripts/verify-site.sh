#!/usr/bin/env sh

set -eu

repo_root=$(CDPATH= cd -- "$(dirname -- "$0")/.." && pwd)
build_dir="${1:-${TMPDIR:-/tmp}/michael-mckenna-site-verify}"
cache_dir="${HUGO_CACHEDIR:-${TMPDIR:-/tmp}/hugo_cache}"

printf '%s\n' 'Checking tracked repository artifacts...'
tracked_artifacts=$(
  git -C "$repo_root" ls-files -ci --exclude-standard \
    | while IFS= read -r artifact; do
        if [ -e "$repo_root/$artifact" ]; then
          printf '%s\n' "$artifact"
        fi
      done \
    || true
)

if [ -n "$tracked_artifacts" ]; then
  printf '%s\n' 'Generated or ignored artifacts are tracked:' >&2
  printf '%s\n' "$tracked_artifacts" >&2
  exit 1
fi

tracked_before=$(git -C "$repo_root" status --short --untracked-files=no)

printf '%s\n' 'Running JavaScript unit tests...'
node --test "$repo_root"/scripts/tests/*.test.mjs

printf '%s\n' 'Building Hugo site...'
HUGO_CACHEDIR="$cache_dir" hugo \
  --source "$repo_root/blog" \
  --destination "$build_dir" \
  --cleanDestinationDir \
  --printPathWarnings \
  --printUnusedTemplates

printf '%s\n' 'Checking generated JavaScript syntax...'
generated_js=$(find "$build_dir/js" -type f -name 'win95.*.js' -print -quit)

if [ -z "$generated_js" ]; then
  printf '%s\n' 'Generated JavaScript bundle was not found.' >&2
  exit 1
fi

node --check "$generated_js"

tracked_after=$(git -C "$repo_root" status --short --untracked-files=no)

if [ "$tracked_before" != "$tracked_after" ]; then
  printf '%s\n' 'Verification changed tracked repository files:' >&2
  git -C "$repo_root" status --short --untracked-files=no >&2
  exit 1
fi

printf '%s\n' 'Checking generated links and assets...'
node "$repo_root/scripts/check-generated-site.mjs" "$build_dir" "$repo_root/scripts/site-check-allowlist.txt"

printf '%s\n' 'Site verification passed.'
