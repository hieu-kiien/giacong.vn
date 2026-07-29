#!/bin/sh
set -eu

mkdir -p storage/framework/cache storage/framework/views
chown -R www-data:www-data storage/framework/cache storage/framework/views

exec docker-php-entrypoint "$@"
