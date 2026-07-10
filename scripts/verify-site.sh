#!/usr/bin/env sh

set -eu

repo_root=$(CDPATH= cd -- "$(dirname -- "$0")/.." && pwd)
build_dir="${TMPDIR:-/tmp}/michael-mckenna-site-verify"
cache_dir="${HUGO_CACHEDIR:-${TMPDIR:-/tmp}/hugo_cache}"

printf '%s\n' 'Building Hugo site...'
HUGO_CACHEDIR="$cache_dir" hugo \
  --source "$repo_root/blog" \
  --destination "$build_dir" \
  --cleanDestinationDir \
  --printPathWarnings \
  --printUnusedTemplates

# Hugo creates this source-tree lock even when the destination is elsewhere.
# It is intentionally ignored and should not survive repository verification.
rm -f "$repo_root/blog/.hugo_build.lock"

printf '%s\n' 'Checking generated JavaScript syntax...'
generated_js=$(find "$build_dir/js" -type f -name 'win95.min.*.js' -print -quit)

if [ -z "$generated_js" ]; then
  printf '%s\n' 'Generated JavaScript bundle was not found.' >&2
  exit 1
fi

node --check "$generated_js"

printf '%s\n' 'Checking tracked repository artifacts...'
tracked_artifacts=$(
  git -C "$repo_root" ls-files \
    | grep -E '(^|/)\.DS_Store$|(^|/)__pycache__/|\.pyc$|(^|/)\.hugo_build\.lock$' \
    | while IFS= read -r artifact; do
        if [ -e "$repo_root/$artifact" ]; then
          printf '%s\n' "$artifact"
        fi
      done \
    || true
)

if [ -n "$tracked_artifacts" ]; then
  printf '%s\n' 'Generated artifacts are tracked:' >&2
  printf '%s\n' "$tracked_artifacts" >&2
  exit 1
fi

printf '%s\n' 'Checking generated links and assets...'
node "$repo_root/scripts/check-generated-site.mjs" "$build_dir" "$repo_root/scripts/site-check-allowlist.txt"

printf '%s\n' 'Site verification passed.'
