<?php

namespace Acme\B2b\Http\Resources;

use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;
use Illuminate\Support\Facades\Storage;

class CatalogCategoryResource extends JsonResource
{
    public function __construct($resource, private readonly string $locale)
    {
        parent::__construct($resource);
    }

    /** @return array<string, mixed> */
    public function toArray(Request $request): array
    {
        $translation = $this->resource->translate($this->locale);
        $name = $translation?->name;
        $image = $this->resource->logo_path;

        return [
            'id' => $this->resource->id,
            'parent_id' => $this->resource->parent_id,
            'slug' => $translation?->slug,
            'name' => $name,
            'description' => $this->plainText($translation?->description),
            'image' => $image && Storage::exists($image) ? [
                'url' => Storage::url($image),
                'alt' => $name,
            ] : null,
        ];
    }

    private function plainText(?string $html): ?string
    {
        if ($html === null || trim($html) === '') {
            return null;
        }

        $text = html_entity_decode(strip_tags($html), ENT_QUOTES | ENT_HTML5, 'UTF-8');
        $text = trim((string) preg_replace('/\s+/u', ' ', $text));

        return $text === '' ? null : $text;
    }
}
