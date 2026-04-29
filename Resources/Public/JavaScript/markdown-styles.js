import {css} from 'lit';

/**
 * Scoped CSS for Markdown-rendered assistant messages.
 * Shared between ai-chat-panel.js and chat-app.js.
 */
export const markdownStyles = css`
    .message.assistant p { margin: 0 0 6px; }
    .message.assistant p:last-child { margin-bottom: 0; }
    .message.assistant ul, .message.assistant ol { margin: 4px 0 6px; padding-left: 20px; }
    .message.assistant li { margin-bottom: 2px; }
    .message.assistant h1, .message.assistant h2, .message.assistant h3,
    .message.assistant h4, .message.assistant h5, .message.assistant h6 {
        margin: 8px 0 4px; font-weight: 600; line-height: 1.3;
    }
    .message.assistant h1 { font-size: 1.2em; }
    .message.assistant h2 { font-size: 1.1em; }
    .message.assistant h3 { font-size: 1em; }
    .message.assistant code {
        background: var(--typo3-surface-container-high);
        color: var(--typo3-text-color-code);
        border: 1px solid var(--typo3-component-border-color);
        border-radius: calc(var(--typo3-component-border-radius) * .5);
        padding: 1px 4px; font-family: var(--typo3-font-family-code, monospace); font-size: 0.9em;
    }
    .message.assistant pre {
        background: var(--typo3-surface-container-high);
        color: var(--typo3-text-color-base);
        border: 1px solid var(--typo3-component-border-color);
        border-radius: var(--typo3-component-border-radius);
        padding: 8px 10px; overflow-x: auto; margin: 4px 0 6px;
    }
    .message.assistant pre code { background: none; border: none; padding: 0; color: inherit; }
    .message.assistant blockquote {
        border-left: 3px solid var(--typo3-component-border-color); margin: 4px 0;
        padding: 2px 10px; color: inherit; opacity: 0.8;
    }
    .message.assistant hr { border: none; border-top: 1px solid var(--typo3-component-border-color); margin: 8px 0; }
    .message.assistant table { border-collapse: collapse; margin: 6px 0; font-size: 0.9em; }
    .message.assistant th, .message.assistant td {
        border: 1px solid var(--typo3-component-border-color); padding: 3px 8px; text-align: left;
    }
    .message.assistant th { background: var(--typo3-surface-container-low); font-weight: 600; }
    .message.assistant a { color: var(--typo3-text-color-link); text-decoration: underline; text-underline-offset: .15em; }
`;
