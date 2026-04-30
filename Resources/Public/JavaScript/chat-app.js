import {LitElement, html, css, nothing} from 'lit';
import {unsafeHTML} from 'lit/directives/unsafe-html.js';
import {lll} from '@typo3/core/lit-helper.js';
import {ChatCoreController} from './chat-core.js';
import {markdownStyles} from './markdown-styles.js';
import {AVATAR_ASSISTANT, AVATAR_USER, ICON_PAPERCLIP, ICON_SEND, ICON_COMPOSE, ICON_CHEVRON_DOWN, ICON_UPLOAD, ICON_HISTORY, ICON_PANEL_LEFT_OPEN, ICON_PANEL_LEFT_CLOSE, ICON_PIN, ICON_ARCHIVE} from './icons.js';
import '@typo3/backend/element/spinner-element.js';

const STATUS_BADGE_VARIANTS = {
    idle: 'badge-success',
    processing: 'badge-warning',
    tool_loop: 'badge-warning',
    locked: 'badge-warning',
    failed: 'badge-danger',
};

function statusBadgeClasses(status) {
    return `status-badge badge badge-pill ${STATUS_BADGE_VARIANTS[status] ?? 'badge-default'} status-${status}`;
}

/**
 * <nr-chat-app> – Main chat application component.
 *
 * Renders a sidebar with conversation list and a main area with messages.
 * All chat business logic is delegated to ChatCoreController.
 */
export class ChatApp extends LitElement {
    static properties = {
        maxLength: {type: Number, attribute: 'data-max-length'},
        _sidebarCollapsed: {state: true},
        _attachMenuOpen: {type: Boolean, state: true},
    };

    static styles = [markdownStyles, css`
        :host {
            display: flex;
            flex-direction: column;
            height: calc(100dvh - (var(--typo3-spacing, 1rem) * 2));
            min-height: min(28rem, calc(100dvh - (var(--typo3-spacing, 1rem) * 2)));
            border: 1px solid var(--typo3-component-border-color);
            border-radius: var(--typo3-component-border-radius);
            overflow: hidden;
            font-family: var(--typo3-font-family, sans-serif);
            background: var(--typo3-surface-container-lowest);
            color: var(--typo3-component-color);
            box-shadow: var(--typo3-component-box-shadow-window, var(--typo3-component-box-shadow));
            font-size: var(--typo3-component-font-size, 13px);
            --nr-chat-control-size: 34px;
            --nr-chat-header-height: 64px;
            --nr-chat-focus-ring: 0 0 0 var(--typo3-outline-width, .25rem) color-mix(in srgb, var(--typo3-input-focus-border-color), transparent var(--typo3-outline-transparent-mix, 25%));
        }

        .chat-body {
            display: flex;
            flex: 1;
            min-height: 0;
        }

        /* Sidebar */
        .sidebar {
            width: 300px;
            min-width: 300px;
            border-right: 1px solid var(--typo3-component-border-color);
            display: flex;
            flex-direction: column;
            background: var(--typo3-surface-container-low);
            transition: width .18s ease, min-width .18s ease;
        }
        .sidebar.collapsed {
            width: 0;
            min-width: 0;
            overflow: hidden;
            border-right: none;
        }
        .sidebar-header {
            display: flex;
            align-items: center;
            justify-content: space-between;
            gap: calc(var(--typo3-spacing) * .5);
            height: var(--nr-chat-header-height);
            min-height: var(--nr-chat-header-height);
            box-sizing: border-box;
            padding: calc(var(--typo3-spacing) * .625) calc(var(--typo3-spacing) * .75);
            border-bottom: 1px solid var(--typo3-component-border-color);
            background: var(--typo3-surface-container-base);
        }
        .sidebar-title {
            min-width: 0;
            display: flex;
            align-items: center;
            gap: calc(var(--typo3-spacing) * .5);
        }
        .sidebar-title-icon {
            width: var(--nr-chat-control-size);
            height: var(--nr-chat-control-size);
            border: 1px solid var(--typo3-component-border-color);
            border-radius: var(--typo3-component-border-radius);
            display: inline-flex;
            align-items: center;
            justify-content: center;
            color: var(--typo3-text-color-primary);
            background: var(--typo3-surface-container-lowest);
            box-shadow: var(--typo3-component-box-shadow);
        }
        .sidebar-title h3 {
            margin: 0;
            font-size: 14px;
            font-weight: 600;
            line-height: 1.2;
        }
        .conversation-list {
            flex: 1;
            overflow-y: auto;
            padding: calc(var(--typo3-spacing) * .35);
            scrollbar-gutter: stable;
        }
        .conversation-item {
            display: grid;
            grid-template-columns: minmax(0, 1fr) 74px;
            align-items: center;
            gap: calc(var(--typo3-spacing) * .375);
            min-height: 32px;
            padding: calc(var(--typo3-spacing) * .3125) calc(var(--typo3-spacing) * .5);
            margin-block-end: 1px;
            cursor: pointer;
            border: 1px solid transparent;
            border-radius: var(--typo3-component-border-radius);
            transition: var(--typo3-transition-color, background-color .15s ease-in-out, border-color .15s ease-in-out, box-shadow .15s ease-in-out);
        }
        .conversation-item:hover,
        .conversation-item:focus-visible {
            background: var(--typo3-component-hover-bg);
            border-color: var(--typo3-component-border-color);
        }
        .conversation-item:focus-visible {
            outline: none;
            box-shadow: var(--nr-chat-focus-ring);
        }
        .conversation-item.active {
            --nr-chat-active-item-color: var(--typo3-component-active-color, #fff);
            background: var(--typo3-component-active-bg);
            color: var(--nr-chat-active-item-color);
            border-color: color-mix(in srgb, var(--nr-chat-active-item-color), transparent 55%);
            box-shadow: inset 3px 0 0 color-mix(in srgb, var(--nr-chat-active-item-color), transparent 10%);
        }
        .conversation-item.active:hover,
        .conversation-item.active:focus-visible {
            background: var(--typo3-component-active-bg);
            color: var(--nr-chat-active-item-color);
        }
        .conversation-item .title {
            display: inline-flex;
            align-items: center;
            gap: calc(var(--typo3-spacing) * .25);
            min-width: 0;
            overflow: hidden;
            font-size: 13px;
            font-weight: 500;
        }
        .conversation-item > .status-badge {
            justify-self: end;
        }
        .conversation-item .conversation-label {
            min-width: 0;
            overflow: hidden;
            text-overflow: ellipsis;
            white-space: nowrap;
        }
        .conversation-item.active .title,
        .conversation-item.active .conversation-label,
        .conversation-item.active .pinned-icon {
            color: var(--nr-chat-active-item-color);
        }
        .pinned-icon {
            display: inline-flex;
            flex-shrink: 0;
            color: var(--typo3-text-color-warning);
        }
        /* Main area */
        .main {
            flex: 1;
            display: flex;
            flex-direction: column;
            min-width: 0;
            background: var(--typo3-surface-container-lowest);
        }
        .main-header {
            display: flex;
            align-items: center;
            gap: calc(var(--typo3-spacing) * .5);
            height: var(--nr-chat-header-height);
            min-height: var(--nr-chat-header-height);
            box-sizing: border-box;
            padding: calc(var(--typo3-spacing) * .625) calc(var(--typo3-spacing) * .75);
            border-bottom: 1px solid var(--typo3-component-border-color);
            background: var(--typo3-surface-container-base);
        }
        .main-title {
            flex: 1;
            min-width: 0;
            display: flex;
            align-items: center;
            gap: calc(var(--typo3-spacing) * .625);
        }
        .main-title-icon {
            width: var(--nr-chat-control-size);
            height: var(--nr-chat-control-size);
            flex: 0 0 var(--nr-chat-control-size);
            border: 1px solid var(--typo3-state-primary-border-color);
            border-radius: var(--typo3-component-border-radius);
            display: inline-flex;
            align-items: center;
            justify-content: center;
            color: var(--typo3-surface-container-primary-text, var(--typo3-text-color-primary));
            background: var(--typo3-surface-container-primary, var(--typo3-surface-container-low));
        }
        .main-title-copy {
            min-width: 0;
            display: flex;
            flex-direction: column;
            gap: 2px;
        }
        .main-title-name {
            overflow: hidden;
            text-overflow: ellipsis;
            white-space: nowrap;
            font-size: 14px;
            font-weight: 600;
            line-height: 1.25;
        }
        .main-title-meta {
            display: flex;
            align-items: center;
            gap: calc(var(--typo3-spacing) * .375);
            min-height: 18px;
        }
        .main-actions {
            display: inline-flex;
            align-items: center;
            gap: calc(var(--typo3-spacing) * .35);
        }
        .messages {
            flex: 1;
            overflow-y: auto;
            padding: calc(var(--typo3-spacing) * 1.25);
            display: flex;
            flex-direction: column;
            gap: var(--typo3-spacing);
            background: var(--typo3-surface-container-lowest);
            scrollbar-gutter: stable;
            --tool-output-expanded-max-height: clamp(280px, 72dvh, 760px);
        }
        /* Message row layout (avatar/time column + text column) */
        .message-row {
            display: flex;
            align-items: flex-start;
            gap: calc(var(--typo3-spacing) * .625);
        }
        .message-row.user { flex-direction: row-reverse; }
        .message-meta {
            width: 48px;
            flex: 0 0 48px;
            display: flex;
            flex-direction: column;
            align-items: center;
            gap: calc(var(--typo3-spacing) * .25);
        }
        .message-bubble {
            display: flex;
            flex-direction: column;
            max-width: min(76%, 58rem);
        }
        .message-row.user .message-bubble { align-items: flex-end; }
        .avatar {
            width: 32px;
            height: 32px;
            border-radius: var(--typo3-component-border-radius);
            flex-shrink: 0;
            display: flex;
            align-items: center;
            justify-content: center;
            border: 1px solid var(--typo3-component-border-color);
            box-shadow: var(--typo3-component-box-shadow);
        }
        .avatar-assistant {
            background: var(--typo3-surface-container-primary, var(--typo3-state-primary-bg));
            color: var(--typo3-surface-container-primary-text, var(--typo3-state-primary-color));
            border-color: var(--typo3-state-primary-border-color);
        }
        .avatar-user {
            background: var(--typo3-surface-container-high);
            color: var(--typo3-state-default-color);
        }
        .message-time {
            font-size: 11px;
            color: var(--typo3-text-color-variant);
            padding: 0 2px;
            line-height: 1.1;
            text-align: center;
            white-space: nowrap;
        }
        .message {
            padding: calc(var(--typo3-spacing) * .7) calc(var(--typo3-spacing) * .85);
            border: 1px solid transparent;
            border-radius: var(--typo3-component-border-radius);
            font-size: 13.5px;
            line-height: 1.5;
            word-break: break-word;
            box-shadow: var(--typo3-component-box-shadow);
        }
        .message.user {
            background: var(--typo3-state-primary-bg);
            color: var(--typo3-state-primary-color);
            border-color: var(--typo3-state-primary-border-color);
            border-bottom-right-radius: 2px;
        }
        .message.assistant {
            background: var(--typo3-component-bg);
            color: var(--typo3-text-color-base);
            border-color: var(--typo3-component-border-color);
            border-bottom-left-radius: 2px;
        }
        .message.tool {
            align-self: flex-start;
            box-sizing: border-box;
            max-width: 100%;
            background: var(--typo3-surface-container-base);
            border: 1px solid var(--typo3-component-border-color);
            font-size: 12px;
            font-family: monospace;
            opacity: 0.7;
            max-height: 100px;
            overflow: hidden;
            overflow-wrap: anywhere;
            white-space: pre-wrap;
            cursor: pointer;
            position: relative;
        }
        .message.tool.expanded {
            align-self: stretch;
            width: 100%;
            max-height: var(--tool-output-expanded-max-height);
            overflow-y: auto;
        }
        .message.tool:not(.expanded)::after {
            content: '... click to expand';
            position: absolute;
            bottom: 0;
            left: 0;
            right: 0;
            height: 24px;
            background: linear-gradient(transparent, var(--typo3-surface-container-base));
            display: flex;
            align-items: flex-end;
            justify-content: center;
            font-size: 11px;
            font-family: sans-serif;
        }
        .message.system {
            align-self: center;
            background: transparent;
            border-color: transparent;
            box-shadow: none;
            font-size: 12px;
            color: var(--typo3-text-color-variant);
            font-style: italic;
        }
        .message.system.error {
            color: var(--typo3-text-color-danger);
        }
        .message .inline-action {
            margin-left: calc(var(--typo3-spacing) * .5);
        }

        /* Attachment area */
        .file-badge {
            display: flex; align-items: center; gap: 6px;
            padding: 6px 10px; margin: 0 calc(var(--typo3-spacing) * .75) calc(var(--typo3-spacing) * .5);
            background: var(--typo3-surface-container-info);
            color: var(--typo3-surface-container-info-text);
            border: 1px solid var(--typo3-component-border-color);
            border-radius: var(--typo3-component-border-radius); font-size: 12px;
        }
        .file-badge .file-badge-name { flex: 1; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
        .file-badge .remove { cursor: pointer; opacity: 0.5; font-size: 16px; line-height: 1; }
        .file-badge .remove:hover { opacity: 1; }
        .message-file-badge {
            display: flex; align-items: center; gap: 4px;
            font-size: 11px; margin-bottom: 3px; opacity: 0.85;
        }

        /* Attach menu */
        .attach-menu-wrap { position: relative; }
        .attach-menu {
            position: absolute;
            bottom: calc(100% + 6px);
            left: 0;
            background: var(--typo3-component-bg);
            border: 1px solid var(--typo3-component-border-color);
            border-radius: var(--typo3-component-border-radius);
            box-shadow: var(--typo3-component-box-shadow-flyout);
            list-style: none;
            margin: 0;
            padding: 4px 0;
            min-width: 160px;
            z-index: 100;
        }
        .attach-menu li {
            display: flex;
            align-items: center;
            gap: 8px;
            padding: 8px 14px;
            cursor: pointer;
            font-size: 13px;
            white-space: nowrap;
        }
        .attach-menu li:hover { background: var(--typo3-component-hover-bg); }

        /* Input area */
        .input-area {
            display: flex;
            align-items: flex-end;
            gap: calc(var(--typo3-spacing) * .5);
            padding: calc(var(--typo3-spacing) * .75);
            border-top: 1px solid var(--typo3-component-border-color);
            background: var(--typo3-surface-container-base);
        }
        .input-wrap {
            flex: 1;
            display: flex;
            align-items: flex-end;
            gap: calc(var(--typo3-spacing) * .5);
            border: 1px solid var(--typo3-input-border-color);
            border-radius: var(--typo3-input-border-radius);
            padding: calc(var(--typo3-spacing) * .375);
            padding-inline-start: calc(var(--typo3-spacing) * .75);
            background: var(--typo3-input-bg, var(--typo3-surface-container-lowest));
            box-shadow: var(--typo3-component-box-shadow);
            transition: var(--typo3-transition-color, border-color .15s ease-in-out, box-shadow .15s ease-in-out);
        }
        .input-wrap:focus-within {
            border-color: var(--typo3-input-focus-border-color);
            box-shadow: var(--nr-chat-focus-ring);
        }
        .input-wrap textarea {
            flex: 1;
            resize: none;
            border: none;
            outline: none;
            padding: calc(var(--typo3-spacing) * .35) 0;
            font-family: inherit;
            font-size: 13px;
            line-height: 1.4;
            min-height: 40px;
            max-height: 120px;
            overflow-y: auto;
            background: transparent;
            color: var(--typo3-input-color, var(--typo3-text-color-base));
        }
        .input-wrap textarea::placeholder {
            color: var(--typo3-input-placeholder-color, var(--typo3-text-color-variant));
        }
        .btn-send {
            appearance: none;
            -webkit-appearance: none;
            flex-shrink: 0;
            width: var(--nr-chat-control-size);
            height: var(--nr-chat-control-size);
            border-radius: var(--typo3-input-border-radius);
            border: 1px solid var(--typo3-state-primary-border-color);
            background: var(--typo3-state-primary-bg);
            background-image: none;
            color: var(--typo3-state-primary-color);
            display: flex;
            align-items: center;
            justify-content: center;
            cursor: pointer;
            transition: var(--typo3-transition-color, background-color .15s ease-in-out, opacity .15s ease-in-out);
            margin: 0;
        }
        .btn-send:hover:not(:disabled) { background: var(--typo3-state-primary-hover-bg); background-image: none; }
        .btn-send:focus-visible {
            outline: none;
            box-shadow: var(--nr-chat-focus-ring);
        }
        .btn-send:disabled { opacity: 0.35; cursor: not-allowed; }

        /* Buttons */
        .btn {
            display: inline-flex;
            align-items: center;
            justify-content: center;
            gap: 4px;
            padding: var(--typo3-input-padding-y) var(--typo3-input-padding-x);
            border: var(--typo3-input-border-width) solid var(--typo3-state-default-border-color);
            border-radius: var(--typo3-input-border-radius);
            background: var(--typo3-state-default-bg);
            color: var(--typo3-state-default-color);
            cursor: pointer;
            font-size: 13px;
            white-space: nowrap;
            transition: var(--typo3-transition-color, background-color .15s ease-in-out, border-color .15s ease-in-out, box-shadow .15s ease-in-out);
        }
        .btn:hover {
            background: var(--typo3-state-default-hover-bg, var(--typo3-component-hover-bg));
            border-color: var(--typo3-state-default-hover-border-color, var(--typo3-component-border-color));
        }
        .btn:focus-visible {
            outline: none;
            box-shadow: var(--nr-chat-focus-ring);
        }
        .btn:disabled {
            opacity: 0.5;
            cursor: not-allowed;
        }
        .btn-primary {
            background: var(--typo3-state-primary-bg);
            color: var(--typo3-state-primary-color);
            border-color: var(--typo3-state-primary-border-color);
        }
        .btn-primary:hover:not(:disabled) {
            background: var(--typo3-state-primary-hover-bg);
        }
        .btn-sm {
            padding: 4px 8px;
            font-size: var(--typo3-font-size-small, 12px);
        }
        .btn-icon {
            min-width: var(--nr-chat-control-size);
            min-height: var(--nr-chat-control-size);
            padding: 6px;
            border: 1px solid transparent;
            background: transparent;
        }
        .btn-icon.btn-primary {
            border-color: var(--typo3-state-primary-border-color);
            background: var(--typo3-state-primary-bg);
            color: var(--typo3-state-primary-color);
        }
        .btn-icon:hover {
            background: var(--typo3-component-hover-bg);
            border-color: var(--typo3-component-border-color);
        }
        .btn-icon.btn-primary:hover:not(:disabled) {
            background: var(--typo3-state-primary-hover-bg);
            border-color: var(--typo3-state-primary-hover-border-color);
            color: var(--typo3-state-primary-hover-color);
        }
        .btn-icon:focus-visible {
            outline: none;
            box-shadow: var(--nr-chat-focus-ring);
        }
        .btn-quiet {
            color: var(--typo3-text-color-variant);
        }
        .btn-quiet:hover {
            color: var(--typo3-text-color-base);
        }

        /* Status indicators */
        .status-badge {
            --typo3-badge-color: var(--typo3-badge-default-color);
            --typo3-badge-bg: var(--typo3-badge-default-bg);
            --typo3-badge-border-color: var(--typo3-badge-default-border-color);
            display: inline-flex;
            align-items: center;
            justify-content: center;
            flex-shrink: 0;
            min-width: 3.5em;
            padding: calc(0.25em - 1px) .5em;
            border: 1px solid var(--typo3-badge-border-color);
            border-radius: 1em;
            background-color: var(--typo3-badge-bg);
            color: var(--typo3-badge-color);
            font-size: .78em;
            font-weight: 600;
            line-height: 1;
            letter-spacing: 0;
            white-space: nowrap;
            vertical-align: middle;
        }
        .status-badge.badge-success {
            --typo3-badge-color: var(--typo3-badge-success-color, var(--typo3-state-success-color));
            --typo3-badge-bg: var(--typo3-badge-success-bg, var(--typo3-state-success-bg));
            --typo3-badge-border-color: var(--typo3-badge-success-border-color, var(--typo3-state-success-border-color));
        }
        .status-badge.badge-warning {
            --typo3-badge-color: var(--typo3-badge-warning-color, var(--typo3-state-warning-color));
            --typo3-badge-bg: var(--typo3-badge-warning-bg, var(--typo3-state-warning-bg));
            --typo3-badge-border-color: var(--typo3-badge-warning-border-color, var(--typo3-state-warning-border-color));
        }
        .status-badge.badge-danger {
            --typo3-badge-color: var(--typo3-badge-danger-color, var(--typo3-state-danger-color));
            --typo3-badge-bg: var(--typo3-badge-danger-bg, var(--typo3-state-danger-bg));
            --typo3-badge-border-color: var(--typo3-badge-danger-border-color, var(--typo3-state-danger-border-color));
        }

        .empty-state {
            flex: 1;
            display: flex;
            align-items: center;
            justify-content: center;
            flex-direction: column;
            gap: calc(var(--typo3-spacing) * .75);
            color: var(--typo3-text-color-variant);
            font-size: 14px;
            text-align: center;
            padding: 24px;
            background: var(--typo3-surface-container-lowest);
        }
        .empty-state-icon {
            width: 44px;
            height: 44px;
            display: inline-flex;
            align-items: center;
            justify-content: center;
            border-radius: var(--typo3-component-border-radius);
            border: 1px solid var(--typo3-component-border-color);
            color: var(--typo3-text-color-primary);
            background: var(--typo3-surface-container-base);
            box-shadow: var(--typo3-component-box-shadow);
        }
        .empty-state-action {
            margin-top: calc(var(--typo3-spacing) * .25);
        }

        .issues-banner {
            padding: 8px 12px;
            background: var(--typo3-surface-container-warning);
            border-bottom: 1px solid color-mix(in srgb, var(--typo3-surface-container-warning), var(--typo3-surface-container-warning-text) var(--typo3-border-mix));
            font-size: 12px;
            color: var(--typo3-surface-container-warning-text);
        }

        .chat-spinner {
            display: inline-flex;
            color: var(--typo3-text-color-primary, var(--typo3-state-primary-color));
            line-height: 1;
        }
        .btn-send .chat-spinner {
            color: var(--typo3-state-primary-color);
        }

        /* Typing indicator — animated dots */
        .typing-indicator {
            display: flex;
            gap: 4px;
            align-items: center;
            padding: 10px 14px;
            background: var(--typo3-component-bg);
            border-radius: 8px;
            border: 1px solid var(--typo3-component-border-color);
            border-bottom-left-radius: 2px;
            width: fit-content;
            box-shadow: var(--typo3-component-box-shadow);
        }
        .typing-indicator span {
            width: 7px;
            height: 7px;
            border-radius: 50%;
            background: var(--typo3-text-color-variant);
            animation: typing-bounce 1.2s infinite ease-in-out;
        }
        .typing-indicator span:nth-child(2) { animation-delay: 0.2s; }
        .typing-indicator span:nth-child(3) { animation-delay: 0.4s; }
        @keyframes typing-bounce {
            0%, 60%, 100% { transform: translateY(0); opacity: 0.4; }
            30% { transform: translateY(-5px); opacity: 1; }
        }
    `];

    constructor() {
        super();
        this.maxLength = 0;
        this._sidebarCollapsed = false;
        this._attachMenuOpen = false;
        this.chat = new ChatCoreController(this);
    }

    connectedCallback() {
        super.connectedCallback();
        this.chat.maxLength = this.maxLength || 0;
        this._closeAttachMenu = (e) => {
            if (!e.composedPath().includes(this)) {
                this._attachMenuOpen = false;
            }
        };
        document.addEventListener('click', this._closeAttachMenu);
    }

    disconnectedCallback() {
        super.disconnectedCallback();
        document.removeEventListener('click', this._closeAttachMenu);
    }

    // ── Callback hooks for ChatCoreController ──────────────────────────

    onScrollToBottom(force = false) {
        const doScroll = () => {
            const container = this.renderRoot?.querySelector('.messages');
            if (!container) return;
            if (force) {
                container.scrollTop = container.scrollHeight;
                return;
            }
            const distanceFromBottom = container.scrollHeight - container.scrollTop - container.clientHeight;
            if (distanceFromBottom < container.clientHeight * 0.5) {
                container.scrollTop = container.scrollHeight;
            }
        };
        // Ensure DOM is updated before scrolling
        this.updateComplete.then(() => doScroll());
    }

    onFocusInput() {
        this.updateComplete.then(() => {
            this.renderRoot?.querySelector('.input-area textarea')?.focus();
        });
    }

    onResponsePrinted() {
        if (!this._shouldFocusAfterResponse()) {
            return;
        }
        this.onFocusInput();
    }

    onResetInput() {
        const ta = this.renderRoot?.querySelector('.input-area textarea');
        if (ta) ta.style.height = 'auto';
    }

    _shouldFocusAfterResponse() {
        if (!this.isConnected || document.visibilityState !== 'visible') {
            return false;
        }
        if (typeof document.hasFocus === 'function' && !document.hasFocus()) {
            return false;
        }
        try {
            if (top?.document?.visibilityState && top.document.visibilityState !== 'visible') {
                return false;
            }
        } catch {
            // Cross-frame access can fail in unusual embedding contexts.
        }

        const activeElement = document.activeElement;
        if (activeElement && activeElement !== document.body && activeElement !== this && !this.contains(activeElement)) {
            return false;
        }

        const shadowActiveElement = this.renderRoot?.activeElement;
        if (shadowActiveElement?.matches?.('button, select, input, textarea, [contenteditable="true"]')
            && !shadowActiveElement.matches('.input-area textarea, .btn-send')) {
            return false;
        }

        return true;
    }

    // ── DOM-specific event handlers ────────────────────────────────────

    _handleInput(e) {
        this.chat.inputValue = e.target.value;
        const newHasInput = e.target.value.trim().length > 0;
        if (newHasInput !== this.chat.hasInput) {
            this.chat.hasInput = newHasInput;
            this.requestUpdate();
        }
        e.target.style.height = 'auto';
        e.target.style.height = Math.min(e.target.scrollHeight, 120) + 'px';
    }

    _handleKeydown(e) {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            this.chat.handleSend().catch(() => {});
        }
    }

    // ── Render ─────────────────────────────────────────────────────────

    render() {
        if (this.chat.loading) {
            return html`<div class="empty-state"><typo3-backend-spinner class="chat-spinner" size="small"></typo3-backend-spinner></div>`;
        }

        return html`
            ${this.chat.issues.length > 0 ? html`
                <div class="issues-banner">
                    ${this.chat.issues.map(i => html`<div>${i}</div>`)}
                </div>
            ` : nothing}
            <div class="chat-body">
                <div class="sidebar ${this._sidebarCollapsed ? 'collapsed' : ''}">
                    ${this._renderSidebar()}
                </div>
                <div class="main">
                    ${this._renderMain()}
                </div>
            </div>
        `;
    }

    _renderSidebar() {
        return html`
            <div class="sidebar-header">
                <div class="sidebar-title">
                    <span class="sidebar-title-icon" aria-hidden="true">${ICON_HISTORY(16)}</span>
                    <h3>${lll('conversations.title')}</h3>
                </div>
                <button class="btn btn-icon btn-primary"
                    @click=${() => this.chat.handleNewConversation()}
                    ?disabled=${!this.chat.available}
                    title="${lll('conversations.new')}"
                    aria-label="${lll('conversations.new')}">
                    ${ICON_COMPOSE(20)}
                </button>
            </div>
            <div class="conversation-list" role="listbox" aria-label="${lll('conversations.title')}">
                ${this.chat.conversations.length === 0
                    ? html`<div class="empty-state" style="font-size:12px;">${lll('conversations.empty')}</div>`
                    : this.chat.conversations.map(c => this._renderConversationItem(c))
                }
            </div>
        `;
    }

    _renderConversationItem(c) {
        const isActive = c.uid === this.chat.activeUid;
        return html`
            <div class="conversation-item ${isActive ? 'active' : ''}"
                 role="option"
                 tabindex="0"
                aria-selected="${isActive}"
                 @click=${() => this.chat.selectConversation(c.uid)}
                 @keydown=${(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); this.chat.selectConversation(c.uid); } }}>
                <div class="title">
                    ${c.pinned ? html`<span class="pinned-icon" aria-hidden="true">${ICON_PIN(12)}</span>` : nothing}
                    <span class="conversation-label">${c.title || lll('conversations.newConversation')}</span>
                </div>
                <span class=${statusBadgeClasses(c.status)}>${c.status}</span>
            </div>
        `;
    }

    _renderToggleButton() {
        return html`
            <button class="btn btn-icon"
                @click=${() => this._sidebarCollapsed = !this._sidebarCollapsed}
                title="${this._sidebarCollapsed ? lll('sidebar.show') : lll('sidebar.hide')}"
                aria-label="${this._sidebarCollapsed ? lll('sidebar.show') : lll('sidebar.hide')}">
                ${this._sidebarCollapsed ? ICON_PANEL_LEFT_OPEN(18) : ICON_PANEL_LEFT_CLOSE(18)}
            </button>
        `;
    }

    _renderMain() {
        if (!this.chat.activeUid) {
            return html`
                <div class="main-header">
                    ${this._renderToggleButton()}
                </div>
                <div class="empty-state">
                    <span class="empty-state-icon" aria-hidden="true">${AVATAR_ASSISTANT(24)}</span>
                    ${this.chat.available
                        ? lll('chat.selectOrCreate')
                        : lll('chat.notAvailable')
                    }
                    ${this.chat.available ? html`
                        <button class="btn btn-primary btn-sm empty-state-action"
                            @click=${() => this.chat.handleNewConversation()}
                            title="${lll('chat.start')}"
                            aria-label="${lll('chat.start')}">
                            ${ICON_COMPOSE(14)}
                            ${lll('chat.start')}
                        </button>
                    ` : nothing}
                </div>
            `;
        }

        const conv = this.chat.getActiveConversation();
        const isResumable = conv?.resumable || false;
        const status = conv?.status || 'idle';

        return html`
            <div class="main-header">
                ${this._renderToggleButton()}
                <div class="main-title">
                    <span class="main-title-icon" aria-hidden="true">${AVATAR_ASSISTANT(16)}</span>
                    <div class="main-title-copy">
                        <strong class="main-title-name">${conv?.title || lll('conversations.newConversation')}</strong>
                        <span class="main-title-meta">
                            <span class=${statusBadgeClasses(status)}>${status}</span>
                        </span>
                    </div>
                </div>
                <div class="main-actions">
                    <button class="btn btn-sm btn-quiet" @click=${() => this.chat.handleTogglePin()}
                        title="${conv?.pinned ? lll('conversations.unpin') : lll('conversations.pin')}"
                        aria-label="${conv?.pinned ? lll('conversations.unpin') : lll('conversations.pin')}">
                        ${ICON_PIN(14)}
                        ${conv?.pinned ? lll('conversations.unpin') : lll('conversations.pin')}
                    </button>
                    <button class="btn btn-sm"
                        @click=${() => this.chat.handleArchive()}
                        title="${lll('conversations.archive')}"
                        aria-label="${lll('conversations.archive')}">
                        ${ICON_ARCHIVE(14)}
                        ${lll('conversations.archive')}
                    </button>
                </div>
            </div>

            <div class="messages" aria-live="polite" aria-relevant="additions">
                ${this.chat.messages.map((msg, idx) => this._renderMessage(msg, idx))}
                ${this.chat.isProcessing() ? html`
                    <div class="message-row assistant" aria-label="${lll('chat.processing')}">
                        <div class="message-meta">
                            <div class="avatar avatar-assistant">${AVATAR_ASSISTANT(16)}</div>
                        </div>
                        <div class="typing-indicator" aria-hidden="true"><span></span><span></span><span></span></div>
                    </div>
                ` : nothing}
                ${this.chat.errorMessage ? html`
                    <div class="message system error">
                        Error: ${this.chat.errorMessage}
                        ${isResumable ? html`
                            <button class="btn btn-sm inline-action" @click=${() => this.chat.handleResume()}>${lll('chat.retry')}</button>
                        ` : nothing}
                        <button class="btn btn-sm btn-icon" @click=${() => { this.chat.errorMessage = ''; this.requestUpdate(); }}
                            title="${lll('chat.dismiss')}" aria-label="${lll('chat.dismiss')}">&times;</button>
                    </div>
                ` : nothing}
            </div>

            ${this._renderFileBadge()}
            <div class="input-area">
                ${this._renderAttachmentMenu()}
                <div class="input-wrap">
                    <textarea
                        .value=${this.chat.inputValue}
                        @input=${this._handleInput}
                        @keydown=${this._handleKeydown}
                        placeholder="${lll('chat.placeholder')}"
                        aria-label="${lll('chat.placeholder')}"
                        ?disabled=${!this.chat.available || this.chat.isProcessing()}
                        maxlength=${this.maxLength > 0 ? this.maxLength : nothing}
                        rows="2"
                    ></textarea>
                    <button class="btn-send"
                        @click=${() => this.chat.handleSend()}
                        aria-label="${lll('chat.send')}"
                        title="${lll('chat.send')}"
                        ?disabled=${!this.chat.canSend()}>
                        ${this.chat.sending ? html`<typo3-backend-spinner class="chat-spinner" size="small"></typo3-backend-spinner>` : ICON_SEND(16)}
                    </button>
                </div>
            </div>
        `;
    }

    _renderFileBadge() {
        if (!this.chat.pendingFile) return nothing;
        const icon = this.chat.pendingFile.mimeType?.startsWith('image/') ? '\u{1F5BC}\uFE0F' : '\u{1F4C4}';
        return html`
            <div class="file-badge">
                <span>${icon}</span>
                <span class="file-badge-name">${this.chat.pendingFile.name}</span>
                <span class="remove"
                      role="button"
                      tabindex="0"
                      title="${lll('attachment.remove')}"
                      @click=${() => this.chat.clearPendingFile()}
                      @keydown=${(e) => { if (e.key === 'Enter' || e.key === ' ') this.chat.clearPendingFile(); }}
                >&times;</span>
            </div>
        `;
    }

    _renderAttachmentMenu() {
        if (!this.chat.visionSupported) return nothing;
        const canAttach = this.chat.canAttachFile();
        return html`
            <div class="attach-menu-wrap">
                <button class="btn btn-icon"
                        ?disabled=${!canAttach}
                        title="${!canAttach ? lll('attachment.limitReached') : lll('attachment.attach')}"
                        aria-label="${lll('attachment.attach')}"
                        aria-expanded="${String(this._attachMenuOpen)}"
                        aria-haspopup="menu"
                        @click=${(e) => { e.stopPropagation(); this._attachMenuOpen = !this._attachMenuOpen; }}>
                    ${ICON_PAPERCLIP(16)}${ICON_CHEVRON_DOWN(10)}
                </button>

                ${this._attachMenuOpen ? html`
                    <ul class="attach-menu"
                        role="menu"
                        @click=${(e) => e.stopPropagation()}>
                        <li role="menuitem"
                            tabindex="0"
                            @click=${() => { this._attachMenuOpen = false; this.renderRoot.querySelector('input[type="file"]')?.click(); }}
                            @keydown=${(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); this._attachMenuOpen = false; this.renderRoot.querySelector('input[type="file"]')?.click(); } }}>
                            ${ICON_UPLOAD(14)}
                            ${lll('attachment.upload')}
                        </li>
                        <li role="menuitem"
                            tabindex="0"
                            @click=${() => { this._attachMenuOpen = false; this.dispatchEvent(new CustomEvent('nr-mcp-open-fal-picker', {bubbles: true, composed: true})); }}
                            @keydown=${(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); this._attachMenuOpen = false; this.dispatchEvent(new CustomEvent('nr-mcp-open-fal-picker', {bubbles: true, composed: true})); } }}>
                            <typo3-icon identifier="apps-filetree-folder-opened" size="small"></typo3-icon>
                            ${lll('attachment.fromFal')}
                        </li>
                    </ul>
                ` : nothing}
            </div>

            <input type="file"
                   accept="${(this.chat.supportedFormats || []).map(f => '.' + f).join(',') || '*'}"
                   style="display:none"
                   @change=${this._handleFileSelected}>
        `;
    }

    async _handleFileSelected(e) {
        const file = e.target.files?.[0];
        if (!file) return;
        e.target.value = '';
        await this.chat.handleFileUpload(file);
    }

    _renderMessage(msg, idx) {
        const role = msg.role || 'system';
        if (role === 'assistant' && msg.tool_calls && !msg.content) return nothing;

        // Tool messages — no avatar, collapsible
        if (role === 'tool') {
            const isExpanded = this.chat.expandedTools.has(idx);
            return html`
                <div class="message tool ${isExpanded ? 'expanded' : ''}"
                     role="button" tabindex="0"
                     aria-label="${lll('tool.output')}" aria-expanded="${isExpanded}"
                     @click=${() => this.chat.handleToolMessageClick(idx)}
                     @keydown=${(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); this.chat.handleToolMessageClick(idx); } }}>
                    ${this.chat.renderMessageContent(msg)}
                </div>
            `;
        }

        // System messages — centered, no avatar
        if (role === 'system') {
            return html`<div class="message system">${this.chat.renderMessageContent(msg)}</div>`;
        }

        // User + assistant — avatar row with timestamp
        const isUser = role === 'user';
        const time = this.chat.formatTime(msg.createdAt);
        const bubbleContent = isUser
            ? html`${msg.fileUid ? html`<div class="message-file-badge">${msg.fileMimeType?.startsWith('image/') ? '\u{1F5BC}\uFE0F' : '\u{1F4C4}'} ${msg.fileName || lll('attachment.file')}</div>` : nothing}${this.chat.renderMessageContent(msg)}`
            : unsafeHTML(this.chat.renderMessageContent(msg));

        return html`
            <div class="message-row ${role}">
                <div class="message-meta">
                    <div class="avatar ${isUser ? 'avatar-user' : 'avatar-assistant'}">
                        ${isUser ? AVATAR_USER(16) : AVATAR_ASSISTANT(16)}
                    </div>
                    ${time ? html`<div class="message-time">${time}</div>` : nothing}
                </div>
                <div class="message-bubble">
                    <div class="message ${role}">${bubbleContent}</div>
                </div>
            </div>
        `;
    }
}

customElements.define('nr-chat-app', ChatApp);
