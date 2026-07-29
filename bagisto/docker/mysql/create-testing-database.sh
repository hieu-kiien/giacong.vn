#!/usr/bin/env bash

set -e

mysql --user=root --password="${MYSQL_ROOT_PASSWORD}" <<-EOSQL
    CREATE DATABASE IF NOT EXISTS \`bagisto_testing\`;
    CREATE USER IF NOT EXISTS 'bagisto_test'@'%' IDENTIFIED BY 'bagisto_test';
    GRANT ALL PRIVILEGES ON \`bagisto_testing\`.* TO 'bagisto_test'@'%';
EOSQL
