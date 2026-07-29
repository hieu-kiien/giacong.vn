<?php

namespace Acme\B2b\Services;

use Webkul\CMS\Repositories\PageRepository;
use Webkul\Core\Models\Channel;

class CmsService
{
    private ?Channel $channel = null;

    public function __construct(private readonly PageRepository $pageRepository) {}

    /** @return array{slug: string, name: string, summary: string, description: string, meta_title: string}|null */
    public function findService(string $slug): ?array
    {
        $page = $this->pageRepository->getModel()->newQuery()
            ->whereHas('channels', fn ($query) => $query->where('channels.id', $this->channel()->id))
            ->whereHas('translations', fn ($query) => $query
                ->where('locale', $this->locale())
                ->where('url_key', $slug))
            ->with('translations')
            ->first();

        $translation = $page?->translate($this->locale());

        if (! $translation) {
            return null;
        }

        return [
            'slug' => $translation->url_key,
            'name' => $translation->page_title,
            'summary' => $translation->meta_description ?? '',
            'description' => trim(html_entity_decode(strip_tags($translation->html_content))),
            'meta_title' => $translation->meta_title ?: $translation->page_title,
        ];
    }

    public function channelCode(): string
    {
        return $this->channel()->code;
    }

    public function locale(): string
    {
        return $this->channel()->default_locale->code;
    }

    private function channel(): Channel
    {
        return $this->channel ??= core()->getCurrentChannel() ?? core()->getDefaultChannel();
    }
}
