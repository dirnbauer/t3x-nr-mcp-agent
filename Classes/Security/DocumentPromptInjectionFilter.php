<?php

declare(strict_types=1);

namespace Netresearch\NrMcpAgent\Security;

final class DocumentPromptInjectionFilter
{
    /** @var list<string> */
    private const INJECTION_PATTERNS = [
        '/\b(?:ignore|disregard|forget|override|bypass)\b.{0,120}\b(?:previous|above|system|developer|assistant|instructions?|prompt|rules?|policy|policies)\b/iu',
        '/\b(?:system|developer|assistant)\s*(?:prompt|message|instructions?)\b/iu',
        '/\b(?:reveal|print|show|dump|exfiltrate)\b.{0,120}\b(?:system prompt|developer message|instructions?|api keys?|secrets?|tokens?|passwords?)\b/iu',
        '/\b(?:call|execute|run|invoke|use)\b.{0,120}\b(?:tool|function|command|mcp|shell|bash)\b/iu',
        '/\b(?:do not|don\'t)\b.{0,120}\b(?:tell|mention|disclose|reveal)\b/iu',
        '/<\/?(?:system|developer|assistant|tool|function|instruction|prompt)\b[^>]*>/iu',
        '/^\s*(?:system|developer|assistant|tool|function)\s*:/iu',
    ];

    public function filter(string $text, int $maxLength, bool $enabled): FilteredDocumentText
    {
        $normalised = $this->stripControlCharacters($text);
        $removed = 0;

        if ($enabled) {
            $lines = preg_split('/\R/u', $normalised);
            if (is_array($lines)) {
                $keptLines = [];
                foreach ($lines as $line) {
                    if ($this->looksLikeInstructionInjection($line)) {
                        $removed++;
                        continue;
                    }
                    $keptLines[] = $line;
                }
                $normalised = implode("\n", $keptLines);
            }
        }

        $truncated = false;
        if ($maxLength > 0 && mb_strlen($normalised) > $maxLength) {
            $normalised = mb_substr($normalised, 0, $maxLength);
            $truncated = true;
        }

        return new FilteredDocumentText(trim($normalised), $removed, $truncated);
    }

    private function stripControlCharacters(string $text): string
    {
        return (string) preg_replace('/[^\P{C}\t\n\r]/u', '', $text);
    }

    private function looksLikeInstructionInjection(string $line): bool
    {
        foreach (self::INJECTION_PATTERNS as $pattern) {
            if (preg_match($pattern, $line) === 1) {
                return true;
            }
        }
        return false;
    }
}
