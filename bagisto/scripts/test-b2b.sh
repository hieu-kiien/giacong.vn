#!/usr/bin/env bash

set -e

script_dir="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

# shellcheck source=lib/b2b-test-harness.sh
source "${script_dir}/lib/b2b-test-harness.sh"

bash "${script_dir}/../tests/Scripts/B2bHarnessTest.sh"

compose_project="${1:-${TEST_COMPOSE_PROJECT:-bagisto-b2b-test}}"
mysql_service="mysql"
test_database="bagisto_testing"
test_username="bagisto_test"
test_password="bagisto_test"

# An empty FORWARD_DB_PORT from .env must never fall through to local port 3306.
export TEST_DB_PORT="$(b2b_resolve_test_db_port)"
export FORWARD_DB_PORT="${TEST_DB_PORT}"

docker_cli=(docker)

if ! docker info >/dev/null 2>&1; then
    if command -v docker.exe >/dev/null 2>&1; then
        docker_cli=(docker.exe)
    else
        echo "Docker CLI is unavailable." >&2
        exit 1
    fi
fi

docker_environment=()

if [[ "${docker_cli[0]}" == *.exe ]]; then
    docker_environment=(
        env
        WSLENV="$(b2b_docker_wslenv)"
        FORWARD_DB_PORT="${FORWARD_DB_PORT}"
        TEST_DB_PORT="${TEST_DB_PORT}"
    )
fi

docker_command() {
    "${docker_environment[@]}" "${docker_cli[@]}" "$@"
}

php_cli=(php)

if ! command -v php >/dev/null 2>&1 && command -v php.exe >/dev/null 2>&1; then
    php_cli=(php.exe)
fi

interop_environment=()

if [[ "${php_cli[0]}" == *.exe ]]; then
    test_wslenv="APP_ENV:DB_CONNECTION:DB_HOST:DB_PORT:DB_DATABASE:DB_USERNAME:DB_PASSWORD:DB_URL"

    if [[ -n "${WSLENV:-}" ]]; then
        test_wslenv="${WSLENV}:${test_wslenv}"
    fi

    interop_environment=(WSLENV="${test_wslenv}")
fi

docker_command compose -p "${compose_project}" up -d "${mysql_service}"

mysql_container="$(docker_command compose -p "${compose_project}" ps -q "${mysql_service}" | tr -d '\r')"

if [[ -z "${mysql_container}" ]]; then
    echo "MySQL test container was not created." >&2
    exit 1
fi

mysql_healthy=false

for _ in $(seq 1 30); do
    mysql_health="$(docker_command inspect --format '{{if .State.Health}}{{.State.Health.Status}}{{else}}{{.State.Status}}{{end}}' "${mysql_container}" | tr -d '\r')"

    if [[ "${mysql_health}" == "healthy" ]]; then
        mysql_healthy=true
        break
    fi

    if [[ "${mysql_health}" == "exited" || "${mysql_health}" == "dead" ]]; then
        break
    fi

    sleep 2
done

if [[ "${mysql_healthy}" != "true" ]]; then
    echo "MySQL test container did not become healthy." >&2
    docker_command compose -p "${compose_project}" ps "${mysql_service}" >&2
    exit 1
fi

docker_command compose -p "${compose_project}" exec -T "${mysql_service}" \
    sh -c 'mysql --user=root --password="$MYSQL_ROOT_PASSWORD"' <<'SQL'
CREATE DATABASE IF NOT EXISTS `bagisto_testing`;
CREATE USER IF NOT EXISTS 'bagisto_test'@'%' IDENTIFIED BY 'bagisto_test';
ALTER USER 'bagisto_test'@'%' IDENTIFIED BY 'bagisto_test';
GRANT ALL PRIVILEGES ON `bagisto_testing`.* TO 'bagisto_test'@'%';
FLUSH PRIVILEGES;
SQL

published_mysql="$(docker_command compose -p "${compose_project}" port "${mysql_service}" 3306 | tr -d '\r')"
test_db_port="$(b2b_extract_published_port "${published_mysql}")"
container_db_port="$(docker_command inspect \
    --format '{{(index (index .NetworkSettings.Ports "3306/tcp") 0).HostPort}}' \
    "${mysql_container}" | tr -d '\r')"

b2b_assert_exact_binding "${TEST_DB_PORT}" "${test_db_port}" "${container_db_port}"

run_test_command() {
    env "${interop_environment[@]}" \
        APP_ENV=testing \
        DB_CONNECTION=mysql \
        DB_HOST=127.0.0.1 \
        DB_PORT="${test_db_port}" \
        DB_DATABASE="${test_database}" \
        DB_USERNAME="${test_username}" \
        DB_PASSWORD="${test_password}" \
        DB_URL= \
        "$@"
}

run_test_command "${php_cli[@]}" -r '
    $dsn = sprintf(
        "mysql:host=%s;port=%s;dbname=%s",
        getenv("DB_HOST"),
        getenv("DB_PORT"),
        getenv("DB_DATABASE"),
    );
    $pdo = new PDO($dsn, getenv("DB_USERNAME"), getenv("DB_PASSWORD"));
    if ($pdo->query("SELECT DATABASE()")?->fetchColumn() !== "bagisto_testing") {
        fwrite(STDERR, "Refusing to migrate a non-test database.\n");
        exit(1);
    }
'
run_test_command "${php_cli[@]}" artisan migrate --force
run_test_command "${php_cli[@]}" vendor/bin/pest \
    tests/Feature/B2bCatalogApiTest.php \
    tests/Feature/B2bDemoCatalogCommandTest.php \
    tests/Feature/B2bProductConfigTest.php \
    tests/Feature/EnvironmentBaselineTest.php \
    tests/Unit/B2bCatalogListRequestTest.php \
    --do-not-cache-result
