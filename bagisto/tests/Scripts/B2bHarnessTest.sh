#!/usr/bin/env bash

set -euo pipefail

repo_root="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"

# shellcheck source=../../scripts/lib/b2b-test-harness.sh
source "${repo_root}/scripts/lib/b2b-test-harness.sh"

fail() {
    echo "$1" >&2
    exit 1
}

default_port="$(FORWARD_DB_PORT= TEST_DB_PORT= b2b_resolve_test_db_port)"
[[ "${default_port}" == "13306" ]] || fail "Empty .env port must resolve to isolated port 13306."
[[ "${default_port}" != "3306" ]] || fail "Harness must never fall back to live MySQL port 3306."

if FORWARD_DB_PORT= TEST_DB_PORT=0 b2b_resolve_test_db_port >/dev/null 2>&1; then
    fail "Port zero must be rejected."
fi

[[ "$(b2b_extract_published_port '127.0.0.1:15432')" == "15432" ]] \
    || fail "Published port parser returned the wrong port."

if b2b_extract_published_port '127.0.0.1:0' >/dev/null 2>&1; then
    fail "Published binding port zero must be rejected."
fi

wslenv="$(b2b_docker_wslenv 'EXISTING/u')"
[[ ":${wslenv}:" == *':FORWARD_DB_PORT:'* ]] || fail "FORWARD_DB_PORT is missing from WSLENV."
[[ ":${wslenv}:" == *':TEST_DB_PORT:'* ]] || fail "TEST_DB_PORT is missing from WSLENV."
[[ ":${wslenv}:" == *':EXISTING/u:'* ]] || fail "Existing WSLENV entries were not preserved."

b2b_assert_exact_binding '15432' '15432' '15432'

if b2b_assert_exact_binding '15432' '15433' '15433' >/dev/null 2>&1; then
    fail "A published binding that ignores the configured port must be rejected."
fi

if b2b_assert_exact_binding '15432' '15432' '15433' >/dev/null 2>&1; then
    fail "A binding from another container/port must be rejected."
fi

echo "B2B harness port tests passed (isolated default ${default_port}; no 3306 fallback)."
