import {readFile} from 'node:fs/promises';

const componentFiles = [
    '../../Resources/Public/JavaScript/ai-chat-panel.js',
    '../../Resources/Public/JavaScript/chat-app.js',
];

function cssBlock(source, selector) {
    const escaped = selector.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const match = source.match(new RegExp(`${escaped}\\s*\\{([\\s\\S]*?)\\}`, 'm'));
    return match?.[1] ?? '';
}

test.each(componentFiles)('%s preserves readable expanded tool output', async (file) => {
    const source = await readFile(new URL(file, import.meta.url), 'utf8');
    const toolBlock = cssBlock(source, '.message.tool');
    const expandedBlock = cssBlock(source, '.message.tool.expanded');

    expect(toolBlock).toContain('white-space: pre-wrap');
    expect(toolBlock).toContain('overflow-wrap: anywhere');
    expect(toolBlock).toContain('max-width: 100%');
    expect(expandedBlock).toContain('overflow-y: auto');
    expect(expandedBlock).toContain('max-height: min(');
});
