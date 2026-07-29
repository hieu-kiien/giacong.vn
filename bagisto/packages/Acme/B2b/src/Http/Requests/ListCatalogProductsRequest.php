<?php

namespace Acme\B2b\Http\Requests;

use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

class ListCatalogProductsRequest extends FormRequest
{
    public function authorize(): bool
    {
        return true;
    }

    protected function prepareForValidation(): void
    {
        $this->merge([
            'q' => is_string($this->query('q')) ? trim($this->query('q')) : $this->query('q'),
            'category' => is_string($this->query('category')) ? trim($this->query('category')) : $this->query('category'),
        ]);
    }

    /** @return array<string, array<int, mixed>> */
    public function rules(): array
    {
        return [
            'q' => ['nullable', 'string', 'max:100'],
            'category' => ['nullable', 'string', 'max:255'],
            'page' => ['sometimes', 'integer', 'min:1'],
            'per_page' => ['sometimes', 'integer', 'between:1,48'],
            'sort' => ['sometimes', 'filled', 'string', Rule::in([
                'name',
                'id',
                'starting_price',
                'variant_count',
                'available_variant_count',
            ])],
            'direction' => ['sometimes', 'filled', 'string', Rule::in(['asc', 'desc'])],
        ];
    }
}
