<?php

namespace App\Console\Commands;

use Illuminate\Console\Attributes\Description;
use Illuminate\Console\Attributes\Signature;
use Illuminate\Console\Command;
use App\Models\Page;
use App\Models\Post;
use Carbon\Carbon;

#[Signature('pages:import-ejs')]
#[Description('Import pages and posts from EJS files based on metadata.json')]
class ImportEjsPages extends Command
{
    /**
     * Execute the console command.
     */
    public function handle()
    {
        $metadataPath = base_path('../metadata.json');
        if (!file_exists($metadataPath)) {
            $metadataPath = 'c:/Users/hieuk/Desktop/Tham khảo giacong.vn/metadata.json';
        }

        if (!file_exists($metadataPath)) {
            $this->error("metadata.json not found at: {$metadataPath}");
            return Command::FAILURE;
        }

        $this->info("Reading metadata from: {$metadataPath}");
        $metadata = json_decode(file_get_contents($metadataPath), true);

        if (!$metadata || !isset($metadata['pages'])) {
            $this->error("Invalid metadata.json format.");
            return Command::FAILURE;
        }

        $scrapedAt = $metadata['scrapedAt'] ?? null;
        $publishedAt = $scrapedAt ? Carbon::parse($scrapedAt) : now();

        $ejsDir = base_path('../frontend/src/data/pages');
        if (!is_dir($ejsDir)) {
            $ejsDir = 'c:/Users/hieuk/Desktop/Tham khảo giacong.vn/frontend/src/data/pages';
        }

        $pagesCount = 0;
        $postsCount = 0;
        $missingCount = 0;

        foreach ($metadata['pages'] as $pageData) {
            $slug = $pageData['slug'] ?? '';
            if (empty($slug)) {
                continue;
            }

            // Determine correct EJS path
            $ejsPath = "{$ejsDir}/{$slug}.ejs";
            if (!file_exists($ejsPath)) {
                $decodedSlug = urldecode($slug);
                $ejsPath = "{$ejsDir}/{$decodedSlug}.ejs";
            }

            if (!file_exists($ejsPath)) {
                $missingCount++;
                continue;
            }

            $html = file_get_contents($ejsPath);

            // Extract body class
            $bodyClass = null;
            if (preg_match('/<body\s+class=["\']([^"\']+)["\']/i', $html, $matches)) {
                $bodyClass = $matches[1];
            }

            // Extract content inside <main id="main"...>...</main>
            $content = '';
            $startPos = stripos($html, '<main id="main"');
            if ($startPos !== false) {
                $tagEndPos = strpos($html, '>', $startPos);
                if ($tagEndPos !== false) {
                    $contentStart = $tagEndPos + 1;
                    $endPos = strripos($html, '</main>');
                    if ($endPos !== false && $endPos > $contentStart) {
                        $content = substr($html, $contentStart, $endPos - $contentStart);
                    }
                }
            }

            if (empty($content)) {
                $content = $html;
            }

            // Strip EJS includes just in case they're present
            $content = preg_replace('/<%-?\s*include\([^)]+\)\s*%>/i', '', $content);
            $content = trim($content);

            // Determine if type is post or news
            $isPostOrNews = false;
            if ($bodyClass) {
                if (strpos($bodyClass, 'single-post') !== false ||
                    strpos($bodyClass, 'post-template-default') !== false ||
                    strpos($bodyClass, 'type-post') !== false) {
                    $isPostOrNews = true;
                }
            }

            if (strpos($slug, 'post') !== false ||
                strpos($slug, 'news') !== false ||
                strpos($slug, 'tin-tuc') !== false) {
                $isPostOrNews = true;
            }

            // Update or Create Page record
            Page::updateOrCreate(
                ['slug' => $slug],
                [
                    'title' => $pageData['title'] ?? '',
                    'content' => $content,
                    'description' => $pageData['description'] ?? '',
                    'body_class' => $bodyClass,
                    'is_active' => true,
                ]
            );
            $pagesCount++;

            // If it is a post or news, import it into the posts table as well
            if ($isPostOrNews) {
                // Find first image src in content
                $image = null;
                if (preg_match('/<img[^>]+src=["\']([^"\']+)["\']/i', $content, $imgMatches)) {
                    $image = $imgMatches[1];
                }

                Post::updateOrCreate(
                    ['slug' => $slug],
                    [
                        'title' => $pageData['title'] ?? '',
                        'content' => $content,
                        'image' => $image,
                        'status' => 'published',
                        'published_at' => $publishedAt,
                    ]
                );
                $postsCount++;
            }
        }

        $this->info("Import completed successfully!");
        $this->info("Imported Pages: {$pagesCount}");
        $this->info("Imported Posts: {$postsCount}");
        $this->warn("Missing EJS files: {$missingCount}");

        return Command::SUCCESS;
    }
}
