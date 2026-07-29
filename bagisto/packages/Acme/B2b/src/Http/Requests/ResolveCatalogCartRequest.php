<?php

namespace Acme\B2b\Http\Requests;

use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Validator;

class ResolveCatalogCartRequest extends FormRequest
{
    public function authorize(): bool
    {
        return true;
    }

    /** @return array<string, array<int, mixed>> */
    public function rules(): array
    {
        return [
            'lines' => ['required', 'array', 'min:1', 'max:20'],
            'lines.*.parent_slug' => ['required', 'string', 'max:255'],
            'lines.*.variant_sku' => ['required', 'string', 'max:255'],
            'lines.*.quantity' => ['required', 'integer', 'min:1'],
        ];
    }

    public function withValidator(Validator $validator): void
    {
        $validator->after(function (Validator $validator) {
            $lines = $this->input('lines');
            if (! is_array($lines) || ! collect($lines)->every('is_array')) {
                return;
            }

            $keys = collect($lines)
                ->map(fn (array $line) => ($line['parent_slug'] ?? '')."\0".($line['variant_sku'] ?? ''));

            if ($keys->count() !== $keys->unique()->count()) {
                $validator->errors()->add('lines', 'Mỗi biến thể chỉ được xuất hiện một lần trong giỏ.');
            }
        });
    }
}
