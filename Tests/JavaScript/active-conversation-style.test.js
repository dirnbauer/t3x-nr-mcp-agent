import {readFile} from 'node:fs/promises';

const activeSelectors = [
    {
        file: '../../Resources/Public/JavaScript/ai-chat-panel.js',
        selector: '.sidebar-item.active',
        childSelector: '.sidebar-item.active .item-label',
    },
    {
        file: '../../Resources/Public/JavaScript/chat-app.js',
        selector: '.conversation-item.active',
        childSelector: '.conversation-item.active .conversation-label',
    },
];

function cssBlock(source, selector) {
    const escaped = selector.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const match = source.match(new RegExp(`${escaped}\\s*\\{([\\s\\S]*?)\\}`, 'm'));
    return match?.[1] ?? '';
}

function cssBlockContainingSelector(source, selector) {
    const escaped = selector.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const match = source.match(new RegExp(`(?:^|\\n)[^{]*${escaped}[^{]*\\{([\\s\\S]*?)\\}`, 'm'));
    return match?.[1] ?? '';
}

test.each(activeSelectors)('$file gives active conversations readable contrast', async ({file, selector, childSelector}) => {
    const source = await readFile(new URL(file, import.meta.url), 'utf8');
    const activeBlock = cssBlock(source, selector);
    const childBlock = cssBlockContainingSelector(source, childSelector);

    expect(activeBlock).toContain('--nr-chat-active-item-color: var(--typo3-component-active-color, #fff)');
    expect(activeBlock).toContain('background: var(--typo3-component-active-bg)');
    expect(activeBlock).toContain('color: var(--nr-chat-active-item-color)');
    expect(activeBlock).not.toContain('color: var(--typo3-state-primary-color)');
    expect(childBlock).toContain('color: var(--nr-chat-active-item-color)');
});
