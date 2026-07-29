<?php

use Webkul\Category\Models\Category;
use Webkul\CMS\Repositories\PageRepository;
use Webkul\Core\Models\Channel;
use Webkul\Core\Models\Currency;
use Webkul\Core\Models\Locale;

beforeEach(function () {
    $locale = Locale::factory()->create([
        'code' => 'vi',
        'name' => 'Vietnamese',
    ]);
    $currency = Currency::factory()->create([
        'code' => 'VND',
        'name' => 'Vietnamese Dong',
        'decimal' => 0,
    ]);
    $rootCategory = Category::factory()
        ->hasTranslations(1, [
            'locale' => $locale->code,
            'locale_id' => $locale->id,
            'name' => 'Root',
            'slug' => 'root',
        ])
        ->create([
            'parent_id' => null,
            'status' => 1,
        ]);
    $channel = Channel::factory()->create([
        'code' => 'default',
        'hostname' => 'localhost',
        'default_locale_id' => $locale->id,
        'base_currency_id' => $currency->id,
        'root_category_id' => $rootCategory->id,
    ]);

    $channel->locales()->sync([$locale->id]);
    $channel->currencies()->sync([$currency->id]);
    core()->setCurrentChannel($channel);
    core()->setDefaultChannel($channel);
    app()->setLocale('vi');
});

function createB2bServicePage(array $overrides = []): object
{
    $channel = core()->getDefaultChannel();

    return app(PageRepository::class)->create(array_merge([
        'url_key' => 'say-thuc-pham-say',
        'page_title' => 'Sấy & thực phẩm sấy',
        'html_content' => '<p>Nội dung dịch vụ do Bagisto quản lý.</p>',
        'meta_title' => 'Sấy & thực phẩm sấy',
        'meta_description' => 'Mô tả ngắn do Bagisto quản lý.',
        'meta_keywords' => 'sấy thực phẩm',
        'channels' => [$channel->id],
    ], $overrides));
}

it('returns native Bagisto CMS service content for the current channel', function () {
    createB2bServicePage();

    $this->getJson('/api/b2b/services/say-thuc-pham-say')
        ->assertOk()
        ->assertExactJson([
            'data' => [
                'slug' => 'say-thuc-pham-say',
                'name' => 'Sấy & thực phẩm sấy',
                'summary' => 'Mô tả ngắn do Bagisto quản lý.',
                'description' => 'Nội dung dịch vụ do Bagisto quản lý.',
                'meta_title' => 'Sấy & thực phẩm sấy',
            ],
            'meta' => [
                'channel' => core()->getDefaultChannel()->code,
                'locale' => core()->getDefaultChannel()->default_locale->code,
                'contract_version' => 1,
            ],
        ]);
});

it('does not expose CMS pages from another channel', function () {
    $page = createB2bServicePage();
    $page->channels()->detach();

    $this->getJson('/api/b2b/services/say-thuc-pham-say')
        ->assertNotFound()
        ->assertExactJson(['message' => 'Service not found.']);
});

it('returns not found for a missing service page', function () {
    $this->getJson('/api/b2b/services/khong-ton-tai')
        ->assertNotFound()
        ->assertExactJson(['message' => 'Service not found.']);
});
