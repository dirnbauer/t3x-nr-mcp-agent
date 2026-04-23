<?php

declare(strict_types=1);

use TYPO3\CMS\Core\Imaging\IconProvider\SvgIconProvider;

return [
    'module-nr-mcp-agent' => [
        'provider' => SvgIconProvider::class,
        'source' => 'EXT:nr_mcp_agent/Resources/Public/Icons/module-nr-mcp-agent.svg',
    ],
    'record-nr-mcp-agent-conversation' => [
        'provider' => SvgIconProvider::class,
        'source' => 'EXT:nr_mcp_agent/Resources/Public/Icons/record-nr-mcp-agent-conversation.svg',
    ],
    'record-nr-mcp-agent-mcp-server' => [
        'provider' => SvgIconProvider::class,
        'source' => 'EXT:nr_mcp_agent/Resources/Public/Icons/record-nr-mcp-agent-mcp-server.svg',
    ],
];
