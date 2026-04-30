import {readFile} from 'node:fs/promises';

test('pin icon has a visible needle and inherits theme color', async () => {
    const source = await readFile(
        new URL('../../Resources/Public/JavaScript/icons.js', import.meta.url),
        'utf8',
    );

    const match = source.match(/export const ICON_PIN[\s\S]*?<\/svg>`;/);
    const icon = match?.[0] ?? '';

    expect(icon).toContain('stroke="currentColor"');
    expect(icon).toContain('fill="none"');
    expect(icon).toContain('M12 17v5');
    expect(icon).toContain('M5 17h14');
});
