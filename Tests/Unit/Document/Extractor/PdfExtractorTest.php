<?php

declare(strict_types=1);

namespace Netresearch\NrMcpAgent\Tests\Unit\Document\Extractor;

use Netresearch\NrMcpAgent\Document\Extractor\PdfExtractor;
use PHPUnit\Framework\Attributes\Test;
use PHPUnit\Framework\TestCase;
use RuntimeException;

class PdfExtractorTest extends TestCase
{
    private PdfExtractor $subject;
    private string $fixtures;

    protected function setUp(): void
    {
        $this->subject = new PdfExtractor();
        $this->fixtures = __DIR__ . '/../../../Fixtures/Documents';
    }

    #[Test]
    public function supportsPdfMimeType(): void
    {
        self::assertContains('application/pdf', $this->subject->getSupportedMimeTypes());
    }

    #[Test]
    public function returnsPdfExtension(): void
    {
        self::assertContains('pdf', $this->subject->getSupportedFileExtensions());
    }

    #[Test]
    public function isAvailableWhenLibraryInstalled(): void
    {
        // smalot/pdfparser is a hard dep — always true
        self::assertTrue($this->subject->isAvailable());
    }

    #[Test]
    public function validateThrowsForCorruptFile(): void
    {
        $this->expectException(RuntimeException::class);
        $this->expectExceptionCode(1743000034);
        $this->expectExceptionMessage('PDF header is invalid');
        $this->subject->validate($this->fixtures . '/corrupt.pdf');
    }

    #[Test]
    public function validateThrowsForEncryptedFile(): void
    {
        $this->expectException(RuntimeException::class);
        $this->subject->validate($this->fixtures . '/encrypted.pdf');
    }

    #[Test]
    public function extractReturnsTextFromPdf(): void
    {
        $text = $this->subject->extract($this->fixtures . '/sample.pdf');
        self::assertStringContainsString('Hello PDF', $text);
    }

    #[Test]
    public function validateRejectsActivePdfContentMarkers(): void
    {
        $tmpPath = tempnam(sys_get_temp_dir(), 'nr_pdf_');
        file_put_contents($tmpPath, "%PDF-1.4\n1 0 obj\n<< /OpenAction 2 0 R >>\nendobj\n");

        try {
            $this->expectException(RuntimeException::class);
            $this->expectExceptionCode(1743000035);
            $this->subject->validate($tmpPath);
        } finally {
            @unlink($tmpPath);
        }
    }
}
