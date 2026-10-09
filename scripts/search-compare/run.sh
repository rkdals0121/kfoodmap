#!/bin/bash
# usage: bash scripts/search-compare/run.sh   (from the repo root; about four minutes)
# Compares the search of the last commit with the search of the working tree.
# Works in node_modules/.cache (ignored by git; modules resolve from there).
set -e
work=node_modules/.cache/search-compare
rm -rf "$work" && mkdir -p "$work/old" "$work/new/scripts"
git archive HEAD src package.json scripts/tests | tar -x -C "$work/old"
cp -r src "$work/new/src" && cp package.json "$work/new/" && cp -r scripts/tests "$work/new/scripts/tests"
cp scripts/search-compare/compare.mjs "$work/compare.mjs"
(cd "$work" && node compare.mjs)
