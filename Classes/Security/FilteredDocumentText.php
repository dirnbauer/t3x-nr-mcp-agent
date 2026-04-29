<?php

declare(strict_types=1);

namespace Netresearch\NrMcpAgent\Security;

final readonly class FilteredDocumentText
{
    public function __construct(
        public string $text,
        public int $removedDirectiveCount = 0,
        public bool $truncated = false,
    ) {}
}
