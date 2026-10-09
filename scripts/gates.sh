#!/bin/bash
# usage: gates.sh  (from the repo root) — every gate, one final line: "GATES: ok" or "GATES: FAIL …" (non-zero exit).
fail=""
out=$(npm run check-data 2>&1); echo "$out" | grep -q "No violations" || fail="$fail check-data"
out=$(npm test 2>&1)
bad=$(echo "$out" | grep -E "^✖|^not ok" | head -5 | tr '\n' ';')
echo "$out" | grep -E "^ℹ fail [1-9]" >/dev/null && fail="$fail tests[$bad]"
[ "$(echo "$out" | grep -c '^ℹ fail 0')" = 2 ] || fail="$fail tests-incomplete[$bad]"
lint=$(npx oxlint 2>&1); echo "$lint" | grep -qE "warning|error" && fail="$fail lint"
out=$(npm run build 2>&1); echo "$out" | grep -q "Prerendered" || fail="$fail build"
# A regex that looks behind ("(?<=", "(?<!") does not parse on Safari before 16.4:
# one in a shipped file stops the whole file loading on an iPhone on iOS 15.
# (The build targets safari15, but a regex is not rewritten for the target.)
old=$(grep -lE '\(\?<[=!]' dist/assets/*.js dist/*.js dist/index.html 2>/dev/null | tr '\n' ' '); [ -z "$old" ] || fail="$fail lookbehind-regex[$old]"
if [ -n "$fail" ]; then echo "GATES: FAIL$fail"; exit 1; fi
echo "GATES: ok ($(echo "$out" | grep -o 'Prerendered [0-9]* place' ))"
