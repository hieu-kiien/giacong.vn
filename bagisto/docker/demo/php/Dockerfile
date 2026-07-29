FROM composer:2 AS composer

FROM php:8.3-fpm-bookworm

RUN apt-get update \
    && apt-get install -y --no-install-recommends \
        libfreetype6-dev \
        libgmp-dev \
        libicu-dev \
        libjpeg62-turbo-dev \
        libmagickwand-dev \
        libonig-dev \
        libpng-dev \
        libxml2-dev \
        libzip-dev \
        unzip \
    && docker-php-ext-configure gd --with-freetype --with-jpeg \
    && docker-php-ext-install -j"$(nproc)" bcmath exif gd gmp intl mbstring pdo_mysql soap sockets zip \
    && pecl install imagick redis \
    && docker-php-ext-enable imagick redis opcache \
    && rm -rf /var/lib/apt/lists/*

COPY docker/demo/php/php.ini /usr/local/etc/php/conf.d/99-demo.ini
COPY --from=composer /usr/bin/composer /usr/bin/composer
COPY docker/demo/php/entrypoint.sh /usr/local/bin/demo-php-entrypoint

RUN chmod +x /usr/local/bin/demo-php-entrypoint

WORKDIR /var/www/html

ENTRYPOINT ["/usr/local/bin/demo-php-entrypoint"]
CMD ["php-fpm"]
