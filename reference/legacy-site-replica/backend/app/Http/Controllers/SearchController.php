<?php

namespace App\Http\Controllers;

use App\Models\Product;
use App\Models\Service;
use Illuminate\Http\Request;

class SearchController extends Controller
{
    public function search(Request $request)
    {
        $request->validate([
            's' => ['nullable', 'string', 'max:255'],
        ]);

        $query = $request->query('s', '');

        if (trim($query) === '') {
            return response()->json([]);
        }

        $normalizedQuery = $this->removeVietnameseTones(mb_strtolower($query, 'UTF-8'));

        // Search products case-insensitively with Unicode support and Vietnamese tone folding
        $products = Product::all()->filter(function ($product) use ($normalizedQuery) {
            $normalizedName = $this->removeVietnameseTones(mb_strtolower($product->name ?? '', 'UTF-8'));
            return str_contains($normalizedName, $normalizedQuery);
        });

        // Search services case-insensitively with Unicode support and Vietnamese tone folding
        $services = Service::all()->filter(function ($service) use ($normalizedQuery) {
            $normalizedText = $this->removeVietnameseTones(mb_strtolower($service->text ?? '', 'UTF-8'));
            return str_contains($normalizedText, $normalizedQuery);
        });

        // Map products
        $mappedProducts = $products->map(function ($product) {
            return [
                'type' => 'product',
                'name' => $product->name ?? '',
                'image' => $product->image ? $this->convertUrlToRelative($product->image) : null,
                'price' => $product->price ?? null,
                'href' => $this->convertUrlToRelative($product->href ?? ''),
            ];
        });

        // Map services
        $mappedServices = $services->map(function ($service) {
            return [
                'type' => 'service',
                'name' => $service->text ?? '',
                'image' => null,
                'price' => 'Liên hệ',
                'href' => $this->convertUrlToRelative($service->href ?? ''),
            ];
        });

        // Combine
        $results = $mappedProducts->concat($mappedServices)->values();

        return response()->json($results);
    }

    /**
     * Convert absolute internal URLs matching the configured app URL host to local relative paths.
     */
    private function convertUrlToRelative(?string $url): string
    {
        if (empty($url)) {
            return '';
        }

        $appUrl = config('app.url');
        $host = parse_url($appUrl, PHP_URL_HOST);

        $hostPattern = 'giacong\.vn';
        if (!empty($host)) {
            $hostWithoutWww = preg_replace('/^www\./i', '', $host);
            $hostPattern .= '|' . preg_quote($hostWithoutWww, '/');
        }
        $pattern = '/^https?:\/\/(www\.)?(' . $hostPattern . ')/i';

        if (preg_match($pattern, $url)) {
            $relative = preg_replace($pattern, '', $url);
            if ($relative === '') {
                return '/';
            }

            return $relative;
        }

        return $url;
    }

    /**
     * Remove Vietnamese tones/accents from a string.
     */
    private function removeVietnameseTones(string $str): string
    {
        $unicode = [
            'a' => 'á|à|ả|ã|ạ|ă|ắ|ằ|ẳ|ẵ|ặ|â|ấ|ầ|ẩ|ẫ|ậ|Á|À|Ả|Ã|Ạ|Ă|Ắ|Ằ|Ẳ|Ẵ|Ặ|Â|Ấ|Ầ|Ẩ|Ẫ|Ậ',
            'd' => 'đ|Đ',
            'e' => 'é|è|ẻ|ẽ|ẹ|ê|ế|ề|ể|ễ|ệ|É|È|Ẻ|Ẽ|Ẹ|Ê|Ế|Ề|Ể|Ễ|Ệ',
            'i' => 'í|ì|ỉ|ĩ|ị|Í|Ì|Ỉ|Ĩ|Ị',
            'o' => 'ó|ò|ỏ|õ|ọ|ô|ố|ồ|ổ|ỗ|ộ|ơ|ớ|ờ|ở|ỡ|ợ|Ó|Ò|Ỏ|Õ|Ọ|Ô|Ố|Ồ|Ổ|Ỗ|Ộ|Ơ|Ớ|Ờ|Ở|Ỡ|Ợ',
            'u' => 'ú|ù|ủ|ũ|ụ|ư|ứ|ừ|ử|ữ|ự|Ú|Ù|Ủ|Ũ|Ụ|Ư|Ứ|Ừ|Ử|Ữ|Ự',
            'y' => 'ý|ỳ|ỷ|ỹ|ỵ|Ý|Ỳ|Ỷ|Ỹ|Ỵ',
        ];

        foreach ($unicode as $nonAccent => $accent) {
            $str = preg_replace("/($accent)/iu", $nonAccent, $str);
        }
        return $str;
    }
}
