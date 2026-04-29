<?php

declare(strict_types=1);

namespace Netresearch\NrMcpAgent\Document\Extractor;

use Netresearch\NrMcpAgent\Configuration\ExtensionConfiguration;
use Netresearch\NrMcpAgent\Document\DocumentExtractorInterface;
use RuntimeException;
use Smalot\PdfParser\Parser;
use Throwable;

final class PdfExtractor implements DocumentExtractorInterface
{
    /** @var list<string> */
    private const ACTIVE_CONTENT_MARKERS = [
        '/JavaScript',
        '/JS',
        '/OpenAction',
        '/AA',
        '/Launch',
        '/EmbeddedFile',
        '/RichMedia',
        '/XFA',
    ];

    public function __construct(
        private readonly ?ExtensionConfiguration $config = null,
    ) {}

    public function getSupportedMimeTypes(): array
    {
        return ['application/pdf'];
    }

    public function getSupportedFileExtensions(): array
    {
        return ['pdf'];
    }

    public function isAvailable(): bool
    {
        return class_exists(Parser::class);
    }

    public function validate(string $path): void
    {
        try {
            $this->validatePdfHeader($path);
            $this->validateActiveContent($path);
            $this->withSafeProcessingCopy($path, function (string $safePath): void {
                $parser = new Parser();
                $pdf = $parser->parseFile($safePath);
                $details = $pdf->getDetails();
                if (isset($details['Encrypt'])) {
                    throw new RuntimeException('PDF is encrypted and cannot be processed', 1743000031);
                }
            });
        } catch (RuntimeException $e) {
            throw $e;
        } catch (Throwable $e) {
            throw new RuntimeException('PDF validation failed: ' . $e->getMessage(), 1743000030, $e);
        }
    }

    public function extract(string $path): string
    {
        try {
            $this->validatePdfHeader($path);
            $this->validateActiveContent($path);
            return $this->withSafeProcessingCopy($path, static function (string $safePath): string {
                $parser = new Parser();
                return $parser->parseFile($safePath)->getText();
            });
        } catch (Throwable $e) {
            throw new RuntimeException('PDF extraction failed: ' . $e->getMessage(), 1743000032, $e);
        }
    }

    private function validatePdfHeader(string $path): void
    {
        $handle = @fopen($path, 'rb');
        if (!is_resource($handle)) {
            throw new RuntimeException('PDF is not readable', 1743000033);
        }

        try {
            $header = fread($handle, 5);
        } finally {
            fclose($handle);
        }

        if ($header !== '%PDF-') {
            throw new RuntimeException('PDF header is invalid', 1743000034);
        }
    }

    private function validateActiveContent(string $path): void
    {
        if ($this->config !== null && !$this->config->shouldRejectActivePdfContent()) {
            return;
        }

        $content = @file_get_contents($path);
        if ($content === false) {
            throw new RuntimeException('PDF is not readable', 1743000033);
        }

        foreach (self::ACTIVE_CONTENT_MARKERS as $marker) {
            if (str_contains($content, $marker)) {
                throw new RuntimeException('PDF contains active content marker: ' . $marker, 1743000035);
            }
        }
    }

    /**
     * @template T
     * @param callable(string): T $callback
     * @return T
     */
    private function withSafeProcessingCopy(string $path, callable $callback): mixed
    {
        $safePath = $this->createSafeProcessingCopy($path);
        try {
            return $callback($safePath);
        } finally {
            @unlink($safePath);
        }
    }

    private function createSafeProcessingCopy(string $path): string
    {
        $directory = $this->getSafeProcessingDirectory();
        if (!is_dir($directory) && !mkdir($directory, 0700, true) && !is_dir($directory)) {
            throw new RuntimeException('Could not create isolated PDF processing directory', 1743000037);
        }
        @chmod($directory, 0700);

        $safePath = $directory . '/' . bin2hex(random_bytes(16)) . '.pdf';
        if (!@copy($path, $safePath)) {
            throw new RuntimeException('Could not create isolated PDF processing copy', 1743000036);
        }
        @chmod($safePath, 0600);

        return $safePath;
    }

    private function getSafeProcessingDirectory(): string
    {
        return sys_get_temp_dir() . '/nr_mcp_agent_pdf';
    }
}
