import {LitElement, html, css, nothing} from 'lit';
import {unsafeHTML} from 'lit/directives/unsafe-html.js';
import {ref} from 'lit/directives/ref.js';
import {lll} from '@typo3/core/lit-helper.js';
import {ChatCoreController} from './chat-core.js';
import {markdownStyles} from './markdown-styles.js';
import {AVATAR_ASSISTANT, AVATAR_USER, ICON_PAPERCLIP, ICON_SEND, ICON_COMPOSE, ICON_MINIMIZE, ICON_MAXIMIZE, ICON_RESTORE, ICON_CLOSE, ICON_CHEVRON_DOWN, ICON_UPLOAD, ICON_HISTORY, ICON_PIN, ICON_ARCHIVE, ICON_STATUS_IDLE, ICON_STATUS_PROCESSING, ICON_STATUS_TOOL_LOOP, ICON_STATUS_LOCKED, ICON_STATUS_FAILED} from './icons.js';
import '@typo3/backend/element/spinner-element.js';

const STATES = {HIDDEN: 'hidden', COLLAPSED: 'collapsed', EXPANDED: 'expanded', MAXIMIZED: 'maximized'};
const STATUS_ICONS = {idle: '✓', processing: '⟳', tool_loop: '⚙', locked: '⊘', failed: '✕'};
const STATUS_ICON_RENDERERS = {
    idle: ICON_STATUS_IDLE,
    processing: ICON_STATUS_PROCESSING,
    tool_loop: ICON_STATUS_TOOL_LOOP,
    locked: ICON_STATUS_LOCKED,
    failed: ICON_STATUS_FAILED,
};
const STATUS_BADGE_VARIANTS = {
    idle: 'badge-success',
    processing: 'badge-warning',
    tool_loop: 'badge-warning',
    locked: 'badge-warning',
    failed: 'badge-danger',
};
const DEFAULT_HEIGHT = 390;
const DEFAULT_WIDTH = 480;
const MIN_WIDTH = 320;
const MIN_HEIGHT = 220;
const COLLAPSED_HEIGHT = 40;
const STORAGE_KEY = 'ai-chat-panel';

function statusBadgeClasses(status) {
    return `status-badge badge badge-pill ${STATUS_BADGE_VARIANTS[status] ?? 'badge-default'} status-${status}`;
}

function renderStatusIcon(status, size = 14) {
    const renderer = STATUS_ICON_RENDERERS[status];
    return renderer ? renderer(size) : (STATUS_ICONS[status] ?? status);
}

/**
 * <ai-chat-panel> - Floating draggable panel for AI chat.
 *
 * Panel states: HIDDEN (display:none), COLLAPSED (header only),
 * EXPANDED (chat + compact conversation switcher),
 * MAXIMIZED (full height with sidebar).
 *
 * All chat logic is delegated to ChatCoreController.
 */
export class AiChatPanel extends LitElement {
    static properties = {
        state: {type: String, reflect: true},
        _height: {state: true},
        _width: {state: true},
        _posX: {state: true},
        _posY: {state: true},
        _attachMenuOpen: {type: Boolean, state: true},
        _renamingUid: {state: true},
    };

    static styles = [markdownStyles, css`
        :host {
            position: fixed;
            z-index: calc(var(--typo3-zindex-modal-backdrop, 1050) - 10);
            box-shadow: var(--typo3-component-box-shadow-flyout);
            border: 1px solid var(--typo3-component-border-color);
            border-radius: var(--typo3-component-border-radius);
            font-family: var(--typo3-font-family, sans-serif);
            background: var(--typo3-component-bg);
            color: var(--typo3-component-color);
            display: flex;
            flex-direction: column;
            font-size: var(--typo3-component-font-size, 13px);
            outline: 1px solid color-mix(in srgb, var(--typo3-component-border-color), currentColor 18%);
        }
        :host([state="hidden"]) {
            display: none;
        }
        :host([state="maximized"]) {
            border-radius: 0;
        }

        /* Corner resize grip - bottom-right, generous hit area */
        .resize-grip {
            position: absolute;
            bottom: 0;
            right: 0;
            width: 28px;
            height: 28px;
            cursor: nwse-resize;
            touch-action: none;
            z-index: 10;
            display: flex;
            align-items: flex-end;
            justify-content: flex-end;
            padding: 4px;
            border-radius: 0 0 var(--typo3-component-border-radius) 0;
        }
        .resize-grip::before {
            content: '';
            position: absolute;
            bottom: -4px;
            right: -4px;
            width: 36px;
            height: 36px;
        }
        .resize-grip svg {
            width: 14px;
            height: 14px;
            opacity: 0.3;
            transition: opacity 0.15s;
        }
        .resize-grip:hover svg,
        .resize-grip:active svg {
            opacity: 0.6;
        }
        .resize-grip:focus-visible {
            outline: 2px solid var(--typo3-input-focus-border-color);
            outline-offset: -2px;
        }
        .resize-grip:focus-visible svg {
            opacity: 0.8;
        }

        /* Panel header - drag handle */
        .panel-header {
            height: 46px;
            min-height: 46px;
            display: flex;
            align-items: center;
            gap: 10px;
            padding: 0 10px 0 12px;
            background:
                linear-gradient(90deg, color-mix(in srgb, var(--typo3-state-primary-bg), transparent 82%), transparent 46%),
                var(--typo3-surface-container-low);
            border-bottom: 1px solid var(--typo3-component-border-color);
            cursor: grab;
            flex-shrink: 0;
            user-select: none;
            -webkit-user-select: none;
            touch-action: none;
            border-radius: var(--typo3-component-border-radius) var(--typo3-component-border-radius) 0 0;
        }
        :host([state="maximized"]) .panel-header {
            border-radius: 0;
        }
        .panel-header:active {
            cursor: grabbing;
        }
        .panel-title-group {
            flex: 1;
            min-width: 0;
            display: flex;
            align-items: center;
            gap: 8px;
        }
        .panel-mark {
            width: 28px;
            height: 28px;
            flex: 0 0 28px;
            display: inline-flex;
            align-items: center;
            justify-content: center;
            border: 1px solid color-mix(in srgb, var(--typo3-state-primary-border-color), transparent 28%);
            border-radius: var(--typo3-component-border-radius);
            color: var(--typo3-surface-container-primary-text, var(--typo3-state-primary-color));
            background: var(--typo3-surface-container-primary, var(--typo3-state-primary-bg));
            box-shadow: inset 0 1px 0 color-mix(in srgb, #fff, transparent 76%);
        }
        .panel-header .title {
            min-width: 0;
            overflow: hidden;
            text-overflow: ellipsis;
            white-space: nowrap;
            font-size: 13px;
            font-weight: 700;
            letter-spacing: 0;
        }
        .panel-title-group .status-badge {
            flex-shrink: 0;
        }
        .panel-title-group .panel-status-icon {
            width: 26px;
            min-width: 26px;
            height: 24px;
            padding: 0;
            border-radius: 999px;
        }
        .panel-status-icon svg {
            display: block;
            width: 14px;
            height: 14px;
        }
        .panel-actions {
            display: flex;
            align-items: center;
            gap: 2px;
            flex-shrink: 0;
        }

        /* Panel body */
        .panel-body {
            flex: 1;
            display: flex;
            min-height: 0;
            overflow: hidden;
        }

        /* Sidebar (maximized only) */
        .panel-sidebar {
            width: 260px;
            min-width: 260px;
            border-right: 1px solid var(--typo3-component-border-color);
            display: flex;
            flex-direction: column;
            background: var(--typo3-surface-container-low);
            overflow: hidden;
        }
        .panel-sidebar-header {
            display: flex;
            align-items: center;
            justify-content: space-between;
            gap: 8px;
            padding: 8px 10px 8px 12px;
            border-bottom: 1px solid var(--typo3-component-border-color);
            background: var(--typo3-surface-container-base);
        }
        .panel-sidebar-header h3 {
            margin: 0;
            font-size: 13px;
            font-weight: 700;
            letter-spacing: 0;
        }
        .sidebar-list {
            flex: 1;
            overflow-y: auto;
            padding: 6px;
        }
        .sidebar-item {
            display: grid;
            grid-template-columns: minmax(0, 1fr) auto;
            grid-template-rows: auto auto;
            align-items: center;
            column-gap: 8px;
            row-gap: 4px;
            min-height: 48px;
            padding: 7px 8px;
            margin-block-end: 2px;
            cursor: pointer;
            border: 1px solid transparent;
            border-radius: var(--typo3-component-border-radius);
            transition: background 0.15s;
            font-size: 13px;
        }
        .sidebar-item:hover,
        .sidebar-item:focus-visible {
            background: var(--typo3-component-hover-bg);
        }
        .sidebar-item:focus-visible {
            outline: 2px solid var(--typo3-input-focus-border-color);
            outline-offset: -2px;
        }
        .sidebar-item.active {
            background: var(--typo3-component-active-bg);
        }
        .sidebar-item .item-title {
            grid-column: 1 / -1;
            grid-row: 1;
            display: inline-flex;
            align-items: center;
            gap: 4px;
            min-width: 0;
            overflow: hidden;
        }
        .sidebar-item .item-label {
            min-width: 0;
            overflow: hidden;
            text-overflow: ellipsis;
            white-space: nowrap;
        }
        .sidebar-item > .status-badge {
            grid-column: 2;
            grid-row: 2;
            justify-self: end;
        }
        .pinned-icon {
            display: inline-flex;
            flex-shrink: 0;
            color: var(--typo3-text-color-warning);
        }
        .sidebar-item-actions {
            grid-column: 1;
            grid-row: 2;
            display: flex;
            gap: 2px;
            justify-self: start;
            min-width: 0;
        }
        .sidebar-item:not(.active) .sidebar-item-actions {
            display: none;
        }

        /* Content area */
        .panel-content {
            flex: 1;
            display: flex;
            flex-direction: column;
            min-width: 0;
        }

        /* Compact conversation switcher (expanded state) */
        .compact-switcher {
            display: flex;
            align-items: center;
            gap: 8px;
            padding: 8px 10px;
            border-bottom: 1px solid var(--typo3-component-border-color);
            background: var(--typo3-surface-container-low);
            flex-shrink: 0;
        }
        .compact-switcher-label {
            display: inline-flex;
            align-items: center;
            justify-content: center;
            color: var(--typo3-text-color-variant);
            min-width: 24px;
        }
        .select-wrap {
            flex: 1;
            position: relative;
            min-width: 0;
            display: flex;
            align-items: center;
        }
        .select-wrap select {
            appearance: none;
            -webkit-appearance: none;
            width: 100%;
            padding: var(--typo3-input-padding-y) 32px var(--typo3-input-padding-y) var(--typo3-input-padding-x);
            border: 1px solid var(--typo3-input-border-color);
            border-radius: var(--typo3-input-border-radius);
            font-size: 13px;
            background: var(--typo3-surface-container-lowest);
            color: var(--typo3-input-color, var(--typo3-text-color-base));
            cursor: pointer;
            min-width: 0;
            transition: border-color 0.15s;
        }
        .select-wrap select:focus {
            outline: none;
            border-color: var(--typo3-input-focus-border-color);
            box-shadow: 0 0 0 1px var(--typo3-input-focus-border-color);
        }
        .select-wrap .chevron {
            position: absolute;
            right: 8px;
            pointer-events: none;
            color: var(--typo3-text-color-variant);
            display: flex;
            align-items: center;
        }

        /* Conversation tab bar (second row in expanded state) */
        .conv-tabs {
            display: flex;
            flex-wrap: wrap;
            gap: 2px;
            padding: 4px 8px 0;
            border-bottom: 1px solid var(--typo3-component-border-color);
            background: var(--typo3-surface-container-low);
            flex-shrink: 0;
        }
        .conv-tab {
            display: flex;
            align-items: center;
            gap: 4px;
            padding: 4px 8px;
            border-radius: 6px 6px 0 0;
            border: 1px solid transparent;
            border-bottom: none;
            font-size: 12px;
            cursor: pointer;
            white-space: nowrap;
            max-width: 140px;
            background: transparent;
            color: var(--typo3-text-color-variant);
            transition: background 0.1s, color 0.1s;
            line-height: 1.3;
        }
        .conv-tab:hover {
            background: var(--typo3-surface-container-base);
            color: var(--typo3-text-color-base);
        }
        .conv-tab.active {
            background: var(--typo3-surface-container-lowest);
            color: var(--typo3-text-color-base);
            border-color: var(--typo3-component-border-color);
            font-weight: 500;
        }
        .conv-tab .tab-title {
            overflow: hidden;
            text-overflow: ellipsis;
            min-width: 20px;
        }
        .conv-tab .tab-icon {
            flex-shrink: 0;
            font-size: 11px;
        }
        .conv-tab .tab-icon.status-processing,
        .conv-tab .tab-icon.status-tool_loop,
        .conv-tab .tab-icon.status-locked { color: var(--typo3-text-color-warning); }
        .conv-tab .tab-icon.status-failed  { color: var(--typo3-text-color-danger); }
        .conv-tab .tab-icon.status-idle    { color: var(--typo3-text-color-success); }
        .conv-tab .tab-close {
            flex-shrink: 0;
            display: none;
            align-items: center;
            justify-content: center;
            width: 14px;
            height: 14px;
            border-radius: 3px;
            font-size: 11px;
            line-height: 1;
            color: var(--typo3-text-color-variant);
        }
        .conv-tab:hover .tab-close,
        .conv-tab.active .tab-close { display: flex; }
        .conv-tab .tab-close:hover {
            background: var(--typo3-surface-container-danger);
            color: var(--typo3-surface-container-danger-text);
        }
        .conv-tab-new {
            flex-shrink: 0;
            margin-left: auto;
            padding: 4px 6px;
            border-radius: 6px;
            color: var(--typo3-text-color-variant);
        }
        .conv-tab-new:hover { color: var(--typo3-text-color-base); }
        .conv-tab .tab-rename-input {
            width: 90px;
            padding: 1px 4px;
            font-size: 12px;
            border: 1px solid var(--typo3-input-focus-border-color);
            border-radius: 3px;
            outline: none;
            background: var(--typo3-surface-container-lowest);
            color: var(--typo3-text-color-base);
        }

        /* Messages */
        .panel-messages {
            flex: 1;
            overflow-y: auto;
            padding: 10px;
            display: flex;
            flex-direction: column;
            gap: 6px;
            --tool-output-expanded-max-height: clamp(220px, 68dvh, 640px);
        }
        /* Message row layout (avatar/time column + text column) */
        .message-row {
            display: flex;
            align-items: flex-start;
            gap: 7px;
        }
        .message-row.user { flex-direction: row-reverse; }
        .message-meta {
            width: 42px;
            flex: 0 0 42px;
            display: flex;
            flex-direction: column;
            align-items: center;
            gap: 3px;
        }
        .message-bubble {
            display: flex;
            flex-direction: column;
            max-width: 78%;
        }
        .message-row.user .message-bubble { align-items: flex-end; }
        .avatar {
            width: 28px;
            height: 28px;
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
            color: var(--typo3-text-color-base);
        }
        .message-time {
            font-size: 10px;
            color: var(--typo3-text-color-variant);
            padding: 0 2px;
            line-height: 1.1;
            text-align: center;
            white-space: nowrap;
        }
        .message {
            padding: 7px 10px;
            border-radius: var(--typo3-component-border-radius);
            font-size: 13.5px;
            line-height: 1.5;
            word-break: break-word;
        }
        .message.user {
            background: var(--typo3-state-primary-bg);
            color: var(--typo3-state-primary-color);
            border-bottom-right-radius: 3px;
        }
        .message.assistant {
            background: var(--typo3-surface-container-base);
            color: var(--typo3-text-color-base);
            border-bottom-left-radius: 3px;
        }
        .message.tool {
            align-self: flex-start;
            box-sizing: border-box;
            max-width: 100%;
            background: var(--typo3-surface-container-base);
            font-size: 12px;
            font-family: var(--typo3-font-family-code, monospace);
            color: var(--typo3-text-color-variant);
            border: 1px solid var(--typo3-component-border-color);
            max-height: 52px;
            overflow: hidden;
            overflow-wrap: anywhere;
            white-space: pre-wrap;
            cursor: pointer;
            position: relative;
            padding: 6px 9px;
        }
        .message.tool.expanded {
            align-self: stretch;
            width: 100%;
            max-height: var(--tool-output-expanded-max-height);
            overflow-y: auto;
        }
        .message.tool:not(.expanded)::after {
            content: '...';
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

        /* Typing indicator - animated dots */
        .typing-indicator {
            display: flex;
            gap: 3px;
            align-items: center;
            padding: 7px 10px;
            background: var(--typo3-surface-container-high);
            border-radius: 10px;
            border-bottom-left-radius: 3px;
            width: fit-content;
        }
        .typing-indicator span {
            width: 5px;
            height: 5px;
            border-radius: 50%;
            background: var(--typo3-text-color-variant);
            animation: typing-bounce 1.2s infinite ease-in-out;
        }
        .typing-indicator span:nth-child(2) { animation-delay: 0.2s; }
        .typing-indicator span:nth-child(3) { animation-delay: 0.4s; }
        @keyframes typing-bounce {
            0%, 60%, 100% { transform: translateY(0); opacity: 0.4; }
            30% { transform: translateY(-4px); opacity: 1; }
        }

        /* Attachment and file badge */
        .file-badge {
            display: flex; align-items: center; gap: 6px;
            padding: 4px 8px; margin: 4px 12px 0;
            background: var(--typo3-surface-container-low);
            border: 1px solid var(--typo3-component-border-color);
            border-radius: 6px; font-size: 12px;
        }
        .file-badge .file-badge-name { flex: 1; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
        .file-badge .remove { cursor: pointer; opacity: 0.5; font-size: 16px; line-height: 1; }
        .file-badge .remove:hover { opacity: 1; }
        .message-file-badge {
            display: flex; align-items: center; gap: 4px;
            font-size: 11px; margin-bottom: 3px; opacity: 0.85;
        }

        /* Input area */
        .panel-input {
            display: flex;
            align-items: center;
            gap: 6px;
            padding: 10px;
            border-top: 1px solid var(--typo3-component-border-color);
            background: var(--typo3-surface-container-low);
            flex-shrink: 0;
        }
        .input-wrap {
            flex: 1;
            display: flex;
            align-items: center;
            gap: 2px;
            border: 1px solid var(--typo3-input-border-color);
            border-radius: var(--typo3-input-border-radius);
            padding: 4px 4px 4px 10px;
            background: var(--typo3-surface-container-lowest);
            transition: border-color 0.15s, box-shadow 0.15s;
        }
        .input-wrap:focus-within {
            border-color: var(--typo3-input-focus-border-color);
            box-shadow: 0 0 0 1px var(--typo3-input-focus-border-color);
        }
        .input-wrap textarea {
            flex: 1;
            resize: none;
            border: none;
            outline: none;
            padding: 4px 0;
            font-family: inherit;
            font-size: 13.5px;
            line-height: 1.5;
            min-height: 40px;
            max-height: 120px;
            overflow-y: auto;
            background: transparent;
        }
        .btn-send {
            appearance: none;
            -webkit-appearance: none;
            flex-shrink: 0;
            width: 32px;
            height: 32px;
            border-radius: 50%;
            border: 1px solid var(--typo3-state-primary-border-color);
            background: var(--typo3-state-primary-bg);
            background-image: none;
            color: var(--typo3-state-primary-color);
            display: flex;
            align-items: center;
            justify-content: center;
            cursor: pointer;
            transition: background 0.15s, opacity 0.15s;
            margin: 0 1px 0 0;
        }
        .btn-send:hover:not(:disabled) { background: var(--typo3-state-primary-hover-bg); background-image: none; }
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
            transition: background 0.15s;
            min-height: 32px;
        }
        .btn:hover {
            background: var(--typo3-component-hover-bg);
        }
        .btn:disabled {
            opacity: 0.5;
            cursor: not-allowed;
        }
        .btn-primary {
            background: var(--typo3-state-primary-bg);
            color: var(--typo3-state-primary-color);
            border-color: var(--typo3-state-primary-border-color);
            border-radius: var(--typo3-input-border-radius);
        }
        .btn-primary:hover:not(:disabled) {
            background: var(--typo3-state-primary-hover-bg);
        }
        .btn-sm {
            padding: 4px 8px;
            font-size: 12.5px;
        }
        .btn-icon {
            display: inline-flex;
            align-items: center;
            justify-content: center;
            min-width: 32px;
            min-height: 32px;
            padding: 6px;
            border: none;
            background: transparent;
            color: var(--typo3-state-default-color);
            border-radius: var(--typo3-input-border-radius);
        }
        .btn-icon:hover {
            background: var(--typo3-component-hover-bg);
        }
        .btn-icon:focus-visible {
            outline: 2px solid var(--typo3-input-focus-border-color);
            outline-offset: -2px;
        }

        .attach-menu-wrap { position: relative; }
        .attach-menu {
            position: absolute;
            bottom: calc(100% + 4px);
            left: 0;
            background: var(--typo3-component-bg);
            border: 1px solid var(--typo3-component-border-color);
            border-radius: var(--typo3-component-border-radius);
            padding: 4px 0;
            margin: 0;
            list-style: none;
            white-space: nowrap;
            z-index: 100;
            box-shadow: var(--typo3-component-box-shadow-flyout);
        }
        .attach-menu li {
            display: flex;
            align-items: center;
            gap: 6px;
            padding: 6px 12px;
            cursor: pointer;
            font-size: 13px;
        }
        .attach-menu li:hover {
            background: var(--typo3-component-hover-bg);
        }

        /* Status */
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
            gap: 8px;
            color: var(--typo3-text-color-variant);
            font-size: 13px;
            text-align: center;
            padding: 16px;
        }
        .empty-state-action {
            margin-top: 2px;
        }

        .issues-banner {
            padding: 6px 12px;
            background: var(--typo3-surface-container-warning);
            border-bottom: 1px solid color-mix(in srgb, var(--typo3-surface-container-warning), var(--typo3-surface-container-warning-text) var(--typo3-border-mix));
            font-size: 12px;
            color: var(--typo3-surface-container-warning-text);
            flex-shrink: 0;
        }

        .chat-spinner {
            display: inline-flex;
            color: var(--typo3-text-color-primary, var(--typo3-state-primary-color));
            line-height: 1;
        }
        .btn-send .chat-spinner {
            color: var(--typo3-state-primary-color);
        }
    `];

    constructor() {
        super();
        this.chat = new ChatCoreController(this);
        this.state = STATES.HIDDEN;
        this._height = DEFAULT_HEIGHT;
        this._width = DEFAULT_WIDTH;
        this._posX = null;
        this._posY = null;
        this._attachMenuOpen = false;
        this._lastVisibleState = STATES.EXPANDED;
        this._resizing = false;
        this._dragging = false;
        this._restoreState();
    }

    connectedCallback() {
        super.connectedCallback();
        this.setAttribute('role', 'complementary');
        this.setAttribute('aria-label', lll('panel.title') || 'AI Chat');
        this.setAttribute('tabindex', '-1'); // focusable programmatically but not in tab order
        this._keydownHandler = (e) => this._onKeydown(e);
        document.addEventListener('keydown', this._keydownHandler);
        this._closeAttachMenu = (e) => {
            if (!e.composedPath().includes(this)) {
                this._attachMenuOpen = false;
            }
        };
        document.addEventListener('click', this._closeAttachMenu);
    }

    disconnectedCallback() {
        super.disconnectedCallback();
        document.removeEventListener('keydown', this._keydownHandler);
        document.removeEventListener('click', this._closeAttachMenu);
    }

    updated(changed) {
        if (changed.has('state') || changed.has('_height') || changed.has('_width') || changed.has('_posX') || changed.has('_posY')) {
            this._applySize();
        }
        if (changed.has('state')) {
            this.setAttribute('aria-expanded', String(this.state !== STATES.HIDDEN));
        }
    }

    /** Calculate default bottom-right position */
    _defaultPosition() {
        const vw = window.innerWidth;
        const vh = window.innerHeight;
        return {
            x: vw - this._width - 16,
            y: vh - this._height - 16,
        };
    }

    _applySize() {
        if (this.state === STATES.HIDDEN) return;
        // Don't override styles during active drag or resize — we write directly to this.style
        if (this._dragging || this._resizing) return;

        if (this.state === STATES.MAXIMIZED) {
            this.style.top = '0';
            this.style.left = '0';
            this.style.width = '100vw';
            this.style.height = '100vh';
            this.style.right = '';
            this.style.bottom = '';
            return;
        }

        if (this.state === STATES.COLLAPSED) {
            const pos = this._constrainPosition(this._getPosition().x, this._getPosition().y);
            this.style.top = pos.y + 'px';
            this.style.left = pos.x + 'px';
            this.style.width = this._width + 'px';
            this.style.height = COLLAPSED_HEIGHT + 'px';
            this.style.right = '';
            this.style.bottom = '';
            return;
        }

        // EXPANDED
        const pos = this._constrainPosition(this._getPosition().x, this._getPosition().y);
        this.style.top = pos.y + 'px';
        this.style.left = pos.x + 'px';
        this.style.width = this._width + 'px';
        this.style.height = this._height + 'px';
        this.style.right = '';
        this.style.bottom = '';
    }

    /** Get current position, falling back to default bottom-right */
    _getPosition() {
        if (this._posX !== null && this._posY !== null) {
            return {x: this._posX, y: this._posY};
        }
        return this._defaultPosition();
    }

    /** Constrain position so the panel stays within the viewport */
    _constrainPosition(x, y) {
        const vw = window.innerWidth;
        const vh = window.innerHeight;
        const w = this._width;
        const h = this.state === STATES.COLLAPSED ? COLLAPSED_HEIGHT : this._height;
        x = Math.max(0, Math.min(x, vw - w));
        y = Math.max(0, Math.min(y, vh - h));
        return {x, y};
    }

    // ── Public API ──────────────────────────────────────────────────────

    toggle() {
        if (this.state === STATES.HIDDEN || this.state === STATES.COLLAPSED) {
            this.state = STATES.EXPANDED;
            this.chat.startPollingIfNeeded();
            this.updateComplete.then(() => this.onFocusInput());
        } else {
            this.state = STATES.HIDDEN;
            this.chat.stopPolling();
        }
        this._saveState();
    }

    collapse() {
        this.state = STATES.COLLAPSED;
        this._saveState();
    }

    hide() {
        this._lastVisibleState = this.state !== STATES.HIDDEN ? this.state : STATES.EXPANDED;
        this.state = STATES.HIDDEN;
        this.chat.stopPolling();
        this._saveState();
    }

    maximize() {
        this.state = this.state === STATES.MAXIMIZED ? STATES.EXPANDED : STATES.MAXIMIZED;
        this._saveState();
    }

    // ── ChatCoreController callback hooks ───────────────────────────────

    onScrollToBottom(force = false) {
        // Wait for Lit to finish rendering, then scroll
        this.updateComplete.then(() => {
            requestAnimationFrame(() => {
                const el = this.renderRoot?.querySelector('.panel-messages');
                if (!el) return;
                if (force) {
                    el.scrollTop = el.scrollHeight;
                    return;
                }
                // Auto-scroll if user is in the lower half of the scrollable area
                const distanceFromBottom = el.scrollHeight - el.scrollTop - el.clientHeight;
                if (distanceFromBottom < el.clientHeight * 0.5) {
                    el.scrollTop = el.scrollHeight;
                }
            });
        });
    }

    onFocusInput() {
        if (this._renamingUid) return;
        this.updateComplete.then(() => {
            this.renderRoot?.querySelector('.panel-input textarea')?.focus();
        });
    }

    onResetInput() {
        const ta = this.renderRoot?.querySelector('.panel-input textarea');
        if (ta) ta.style.height = 'auto';
    }

    // ── Drag (move) ─────────────────────────────────────────────────────

    _onHeaderClick(e) {
        // Clicking the header in collapsed state expands the panel
        if (this.state === STATES.COLLAPSED) {
            // Don't expand if a button was clicked (collapse/maximize/close)
            const path = e.composedPath();
            const clickedButton = path.some(el => el.tagName === 'BUTTON');
            if (!clickedButton) {
                this.state = STATES.EXPANDED;
                this._saveState();
            }
        }
    }

    _onHeaderDblClick(e) {
        // Double-click header toggles between expanded and maximized
        if (!e.target.closest('button, .btn-icon')) {
            this.maximize();
        }
    }

    _onDragStart(e) {
        if (e.button !== 0) return; // left button only
        if (e.target.closest('button, .btn-icon')) return;
        if (this.state === STATES.COLLAPSED) return;
        e.preventDefault();

        // setPointerCapture ensures pointerup is always received — even when the
        // mouse moves over TYPO3's content iframes or leaves the browser window.
        const handle = e.currentTarget;
        handle.setPointerCapture(e.pointerId);
        this._dragging = true;

        const rect = this.getBoundingClientRect();
        this._dragOffsetX = e.clientX - rect.left;
        this._dragOffsetY = e.clientY - rect.top;

        document.body.style.cursor = 'grabbing';

        const onMove = (ev) => {
            if (!ev.isPrimary) return;
            const constrained = this._constrainPosition(ev.clientX - this._dragOffsetX, ev.clientY - this._dragOffsetY);
            this.style.left = constrained.x + 'px';
            this.style.top = constrained.y + 'px';
        };

        const onEnd = () => {
            this._dragging = false;
            document.body.style.cursor = '';
            handle.removeEventListener('pointermove', onMove);
            handle.removeEventListener('pointerup', onEnd);
            handle.removeEventListener('pointercancel', onEnd);
            this._posX = parseFloat(this.style.left) || 0;
            this._posY = parseFloat(this.style.top) || 0;
            this._saveState();
        };

        handle.addEventListener('pointermove', onMove);
        handle.addEventListener('pointerup', onEnd);
        handle.addEventListener('pointercancel', onEnd);
    }

    // ── Resize (corner grip) ────────────────────────────────────────────

    _onResizeStart(e) {
        if (e.button !== 0) return; // left button only
        e.preventDefault();
        e.stopPropagation();

        const grip = e.currentTarget;
        grip.setPointerCapture(e.pointerId);
        this._resizing = true;

        this._startX = e.clientX;
        this._startY = e.clientY;
        // Use getBoundingClientRect() for actual rendered dimensions and position
        const rect = this.getBoundingClientRect();
        this._startWidth = rect.width;
        this._startHeight = rect.height;
        this._startLeft = rect.left;

        document.body.style.cursor = 'nwse-resize';

        const onMove = (ev) => {
            if (!ev.isPrimary) return;
            // Constrain right edge to viewport, not just a percentage of viewport width
            const maxW = window.innerWidth - this._startLeft;
            const newW = Math.max(MIN_WIDTH, Math.min(this._startWidth + (ev.clientX - this._startX), maxW));
            const newH = Math.max(MIN_HEIGHT, Math.min(this._startHeight + (ev.clientY - this._startY), window.innerHeight));
            this.style.width = newW + 'px';
            this.style.height = newH + 'px';
        };

        const onEnd = () => {
            this._resizing = false;
            document.body.style.cursor = '';
            grip.removeEventListener('pointermove', onMove);
            grip.removeEventListener('pointerup', onEnd);
            grip.removeEventListener('pointercancel', onEnd);

            const w = parseFloat(this.style.width) || this._width;
            const h = parseFloat(this.style.height) || this._height;
            this._width = w;
            if (h < 50) {
                this._height = COLLAPSED_HEIGHT;
                this.state = STATES.COLLAPSED;
            } else if (h > window.innerHeight * 0.9) {
                this._height = window.innerHeight;
                this.state = STATES.MAXIMIZED;
            } else {
                this._height = h;
                this.state = STATES.EXPANDED;
            }
            this._pendingWidth = null;
            this._pendingHeight = null;
            this._saveState();
        };

        grip.addEventListener('pointermove', onMove);
        grip.addEventListener('pointerup', onEnd);
        grip.addEventListener('pointercancel', onEnd);
    }

    _onResizeKeydown(e) {
        if (e.key === 'ArrowUp') {
            e.preventDefault();
            this._height = Math.min(this._height + 50, window.innerHeight);
            if (this._height > window.innerHeight * 0.9) this.state = STATES.MAXIMIZED;
            else this.state = STATES.EXPANDED;
            this._saveState();
        } else if (e.key === 'ArrowDown') {
            e.preventDefault();
            this._height = Math.max(this._height - 50, COLLAPSED_HEIGHT);
            if (this._height < 50) { this._height = COLLAPSED_HEIGHT; this.state = STATES.COLLAPSED; }
            else this.state = STATES.EXPANDED;
            this._saveState();
        } else if (e.key === 'ArrowRight') {
            e.preventDefault();
            const maxW = window.innerWidth * 0.9;
            this._width = Math.min(this._width + 50, maxW);
            this._saveState();
        } else if (e.key === 'ArrowLeft') {
            e.preventDefault();
            this._width = Math.max(this._width - 50, MIN_WIDTH);
            this._saveState();
        }
    }

    // ── Persistence ─────────────────────────────────────────────────────

    _saveState() {
        try {
            localStorage.setItem(STORAGE_KEY, JSON.stringify({
                state: this.state,
                height: this._height,
                width: this._width,
                x: this._posX,
                y: this._posY,
                activeUid: this.chat.activeUid,
            }));
        } catch { /* ignore */ }
    }

    _restoreState() {
        try {
            const raw = localStorage.getItem(STORAGE_KEY);
            if (!raw) return;
            const data = JSON.parse(raw);
            if (data.state && data.state !== STATES.HIDDEN) {
                this._lastVisibleState = data.state;
            }
            if (typeof data.height === 'number' && data.height >= COLLAPSED_HEIGHT) {
                this._height = data.height;
            }
            if (typeof data.width === 'number' && data.width >= MIN_WIDTH) {
                this._width = data.width;
            }
            if (typeof data.x === 'number' && typeof data.y === 'number') {
                this._posX = data.x;
                this._posY = data.y;
            }
        } catch { /* ignore corrupted data */ }
    }

    // ── Keyboard ────────────────────────────────────────────────────────

    _onKeydown(e) {
        if (e.key === 'Escape' && this.state !== STATES.HIDDEN) {
            // Only collapse if focus is within the panel or no modal is open
            const active = document.activeElement;
            const inPanel = active === this || this.contains(active) || this.shadowRoot?.contains(active);
            const modalOpen = !!document.querySelector('.modal.show, typo3-backend-modal[open]');
            if (inPanel || (!modalOpen && !active?.closest('.dropdown-menu'))) {
                this.collapse();
            }
        }
    }

    // ── Input handling ──────────────────────────────────────────────────

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

    // ── Render ──────────────────────────────────────────────────────────

    render() {
        if (this.state === STATES.HIDDEN) return nothing;

        return html`
            ${this._renderHeader()}
            ${this.state === STATES.COLLAPSED ? nothing : this._renderBody()}
            ${this.state !== STATES.COLLAPSED && this.state !== STATES.MAXIMIZED ? html`
                <div class="resize-grip"
                     role="separator"
                     aria-orientation="horizontal"
                     aria-label="${lll('panel.resize')}"
                     tabindex="0"
                     @pointerdown=${(e) => this._onResizeStart(e)}
                     @keydown=${(e) => this._onResizeKeydown(e)}>
                    <svg viewBox="0 0 12 12" fill="currentColor">
                        <circle cx="9" cy="9" r="1.2"/>
                        <circle cx="5" cy="9" r="1.2"/>
                        <circle cx="9" cy="5" r="1.2"/>
                    </svg>
                </div>
            ` : nothing}
        `;
    }

    _renderHeader() {
        const conv = this.chat.getActiveConversation();
        const title = conv?.title || lll('panel.title');

        return html`
            <div class="panel-header"
                 @pointerdown=${(e) => this._onDragStart(e)}
                 @click=${(e) => this._onHeaderClick(e)}
                 @dblclick=${(e) => this._onHeaderDblClick(e)}>
                <div class="panel-title-group">
                    <span class="panel-mark" aria-hidden="true">${AVATAR_ASSISTANT(16)}</span>
                    <span class="title">${title}</span>
                    ${this.chat.status ? html`
                        <span class="${statusBadgeClasses(this.chat.status)} panel-status-icon" title="${this.chat.status}" role="img" aria-label="${this.chat.status}">
                            ${renderStatusIcon(this.chat.status, 14)}
                        </span>
                    ` : nothing}
                </div>
                <div class="panel-actions" role="group" aria-label="${lll('panel.windowActions') || 'Window actions'}">
                    <button class="btn-icon" @click=${() => this.collapse()}
                            title="${lll('panel.collapse')}" aria-label="${lll('panel.collapse')}">${ICON_MINIMIZE(16)}</button>
                    <button class="btn-icon" @click=${() => this.maximize()}
                            title="${this.state === STATES.MAXIMIZED ? lll('panel.restore') : lll('panel.maximize')}"
                            aria-label="${this.state === STATES.MAXIMIZED ? lll('panel.restore') : lll('panel.maximize')}">
                        ${this.state === STATES.MAXIMIZED ? ICON_RESTORE(16) : ICON_MAXIMIZE(16)}
                    </button>
                    <button class="btn-icon" @click=${() => this.hide()}
                            title="${lll('panel.close')}" aria-label="${lll('panel.close')}">${ICON_CLOSE(16)}</button>
                </div>
            </div>
        `;
    }

    _renderBody() {
        if (this.chat.loading) {
            return html`<div class="panel-body"><div class="empty-state"><typo3-backend-spinner class="chat-spinner" size="small"></typo3-backend-spinner></div></div>`;
        }

        return html`
            ${this.chat.issues.length > 0 ? html`
                <div class="issues-banner">
                    ${this.chat.issues.map(i => html`<div>${i}</div>`)}
                </div>
            ` : nothing}
            <div class="panel-body">
                ${this.state === STATES.MAXIMIZED ? this._renderSidebar() : nothing}
                <div class="panel-content">
                    ${this.state === STATES.EXPANDED ? this._renderCompactSwitcher() : nothing}
                    ${this._renderChat()}
                </div>
            </div>
        `;
    }

    _renderSidebar() {
        return html`
            <div class="panel-sidebar">
                <div class="panel-sidebar-header">
                    <h3>${lll('conversations.title')}</h3>
                    <button class="btn-icon"
                            @click=${() => this.chat.handleNewConversation()}
                            ?disabled=${!this.chat.available}
                            title="${lll('conversations.new')}"
                            aria-label="${lll('conversations.new')}">${ICON_COMPOSE(18)}</button>
                </div>
                <div class="sidebar-list" role="listbox" aria-label="${lll('conversations.title')}">
                    ${this.chat.conversations.length === 0
                        ? html`<div class="empty-state" style="font-size:12px;">${lll('conversations.empty')}</div>`
                        : this.chat.conversations.map(c => this._renderSidebarItem(c))
                    }
                </div>
            </div>
        `;
    }

    _renderSidebarItem(c) {
        const isActive = c.uid === this.chat.activeUid;
        return html`
            <div class="sidebar-item ${isActive ? 'active' : ''}"
                 role="option"
                 tabindex="0"
                 aria-selected="${isActive}"
                 @click=${() => this.chat.selectConversation(c.uid)}
                 @keydown=${(e) => {
                     if (e.key === 'Enter' || e.key === ' ') {
                         e.preventDefault();
                         this.chat.selectConversation(c.uid);
                     }
                }}>
                <span class="item-title">
                    ${c.pinned ? html`<span class="pinned-icon" aria-hidden="true">${ICON_PIN(12)}</span>` : nothing}
                    <span class="item-label">${c.title || lll('conversations.newConversation')}</span>
                </span>
                <span class=${statusBadgeClasses(c.status)} title="${c.status}">${c.status}</span>
                ${isActive ? html`
                    <span class="sidebar-item-actions">
                        <button class="btn-icon btn-sm" @click=${(e) => { e.stopPropagation(); this.chat.handleTogglePin(); }}
                                title="${c.pinned ? lll('conversations.unpin') : lll('conversations.pin')}"
                                aria-label="${c.pinned ? lll('conversations.unpin') : lll('conversations.pin')}">
                            ${ICON_PIN(16)}
                        </button>
                        <button class="btn-icon btn-sm" @click=${(e) => { e.stopPropagation(); this.chat.handleArchive(); }}
                                title="${lll('conversations.archive')}" aria-label="${lll('conversations.archive')}">
                            ${ICON_ARCHIVE(16)}
                        </button>
                    </span>
                ` : html`<span class="sidebar-item-actions" aria-hidden="true"></span>`}
            </div>
        `;
    }

    _renderCompactSwitcher() {
        return html`
            <div class="compact-switcher">
                <span class="compact-switcher-label" aria-hidden="true">${ICON_HISTORY(16)}</span>
                <div class="select-wrap">
                    <select
                        aria-label="${lll('conversations.title')}"
                        .value=${String(this.chat.activeUid ?? '')}
                        @change=${(e) => {
                            const uid = Number(e.target.value);
                            if (uid > 0) this.chat.selectConversation(uid);
                        }}>
                        <option value="" ?selected=${!this.chat.activeUid}>
                            ${this.chat.available ? lll('chat.selectOrCreate') : lll('chat.notAvailable')}
                        </option>
                        ${this.chat.conversations.map(c => html`
                            <option value="${c.uid}" ?selected=${c.uid === this.chat.activeUid}>
                                ${c.title || lll('conversations.newConversation')} (${c.status})
                            </option>
                        `)}
                    </select>
                    <span class="chevron">${ICON_CHEVRON_DOWN(14)}</span>
                </div>
                <button class="btn-icon"
                        @click=${() => this.chat.handleNewConversation()}
                        ?disabled=${!this.chat.available}
                        title="${lll('conversations.new')}"
                        aria-label="${lll('conversations.new')}">${ICON_COMPOSE(20)}</button>
            </div>
        `;
    }

    _renderConvTabs() {
        return html`
            <div class="conv-tabs" role="tablist" aria-label="${lll('conversations.title')}">
                ${this.chat.conversations.map(c => {
                    const isActive = c.uid === this.chat.activeUid;
                    const isRenaming = this._renamingUid === c.uid;
                    const icon = STATUS_ICONS[c.status] ?? '';
                    const title = c.title || lll('conversations.newConversation');
                    return html`
                        <button class="conv-tab ${isActive ? 'active' : ''}"
                                role="tab"
                                aria-selected="${isActive}"
                                title="${title} (${c.status})"
                                @click=${() => this.chat.selectConversation(c.uid)}>
                            <span class="tab-icon status-${c.status}">${icon}</span>
                            ${isRenaming ? html`
                                <input class="tab-rename-input"
                                       .value=${title}
                                       @click=${(e) => e.stopPropagation()}
                                       @keydown=${(e) => {
                                           e.stopPropagation();
                                           if (e.key === 'Enter') { e.preventDefault(); this._commitRename(c.uid, e.target.value); }
                                           if (e.key === 'Escape') { this._renamingUid = null; }
                                       }}
                                       @blur=${(e) => this._commitRename(c.uid, e.target.value)}
                                       ${ref(this._renameInputRef)}
                                />
                            ` : html`
                                <span class="tab-title"
                                      @dblclick=${(e) => { e.stopPropagation(); this._renamingUid = c.uid; }}>
                                    ${title}
                                </span>
                            `}
                            <span class="tab-close"
                                  title="${lll('conversations.archive')}"
                                  @click=${(e) => { e.stopPropagation(); this.chat.handleArchive(c.uid); }}>✕</span>
                        </button>
                    `;
                })}
                <button class="btn-icon conv-tab-new"
                        @click=${() => this.chat.handleNewConversation()}
                        ?disabled=${!this.chat.available}
                        title="${lll('conversations.new')}"
                        aria-label="${lll('conversations.new')}">${ICON_COMPOSE(14)}</button>
            </div>
        `;
    }

    // Stable function reference so Lit's ref directive only fires on mount/unmount,
    // not on every re-render (an inline arrow would be a new reference each render).
    _renameInputRef(el) {
        if (el) requestAnimationFrame(() => { el.focus(); el.select(); });
    }

    _commitRename(uid, value) {
        // Guard against double-fire: Enter sets _renamingUid = null → Lit removes the input
        // from the DOM → blur fires on the detached input → this method is called again.
        if (this._renamingUid !== uid) return;
        this._renamingUid = null;
        this.chat.handleRename(uid, value);
    }

    _renderChat() {
        if (!this.chat.activeUid) {
            return html`
                <div class="empty-state">
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

        return html`
            <div class="panel-messages" aria-live="polite" aria-relevant="additions">
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
            ${this._renderInput()}
        `;
    }

    _renderMessage(msg, idx) {
        const role = msg.role || 'system';
        if (role === 'assistant' && msg.tool_calls && !msg.content) return nothing;

        // Tool messages — no avatar, collapsible
        if (role === 'tool') {
            const isExpanded = this.chat.expandedTools.has(idx);
            return html`
                <div class="message tool ${isExpanded ? 'expanded' : ''}"
                     role="button"
                     tabindex="0"
                     aria-label="${lll('tool.output')}"
                     aria-expanded="${isExpanded}"
                     @click=${() => this.chat.handleToolMessageClick(idx)}
                     @keydown=${(e) => {
                         if (e.key === 'Enter' || e.key === ' ') {
                             e.preventDefault();
                             this.chat.handleToolMessageClick(idx);
                         }
                     }}>
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
                <button class="btn-icon"
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
                            ${ICON_UPLOAD(16)}
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

    _renderInput() {
        return html`
            ${this._renderFileBadge()}
            <div class="panel-input">
                ${this._renderAttachmentMenu()}
                <div class="input-wrap">
                    <textarea
                        .value=${this.chat.inputValue}
                        @input=${this._handleInput}
                        @keydown=${this._handleKeydown}
                        placeholder="${lll('chat.placeholder')}"
                        aria-label="${lll('chat.placeholder')}"
                        ?disabled=${!this.chat.available || this.chat.isProcessing()}
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
}

customElements.define('ai-chat-panel', AiChatPanel);
