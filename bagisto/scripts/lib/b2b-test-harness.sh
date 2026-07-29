#!/usr/bin/env bash

b2b_valid_port() {
    local port="${1:-}"

    [[ "${port}" =~ ^[1-9][0-9]*$ ]] && ((port <= 65535))
}

b2b_resolve_test_db_port() {
    local port="${TEST_DB_PORT:-${FORWARD_DB_PORT:-13306}}"

    if ! b2b_valid_port "${port}"; then
        echo "Invalid isolated MySQL test port: ${port:-<empty>}." >&2
        return 1
    fi

    echo "${port}"
}

b2b_extract_published_port() {
    local binding="${1:-}"
    local port="${binding##*:}"

    if ! b2b_valid_port "${port}"; then
        echo "Unable to determine a non-zero published MySQL test port from '${binding}'." >&2
        return 1
    fi

    echo "${port}"
}

b2b_docker_wslenv() {
    local wslenv="${1:-${WSLENV:-}}"
    local variable

    for variable in FORWARD_DB_PORT TEST_DB_PORT; do
        case ":${wslenv}:" in
            *":${variable}:"*|*":${variable}/"*) ;;
            *) wslenv="${wslenv:+${wslenv}:}${variable}" ;;
        esac
    done

    echo "${wslenv}"
}

b2b_assert_exact_binding() {
    local expected_port="${1:-}"
    local compose_port="${2:-}"
    local container_port="${3:-}"

    b2b_valid_port "${expected_port}" || return 1
    b2b_valid_port "${compose_port}" || return 1
    b2b_valid_port "${container_port}" || return 1

    if [[ "${expected_port}" != "${compose_port}" || "${compose_port}" != "${container_port}" ]]; then
        echo "Configured MySQL port ${expected_port}, Compose port ${compose_port}, and resolved container binding ${container_port} do not match." >&2
        return 1
    fi
}
