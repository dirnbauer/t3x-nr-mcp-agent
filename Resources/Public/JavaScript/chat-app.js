import {LitElement, html, css, nothing} from 'lit';
import {unsafeHTML} from 'lit/directives/unsafe-html.js';
import {lll} from '@typo3/core/lit-helper.js';
import {ChatCoreController} from './chat-core.js';
import {markdownStyles} from './markdown-styles.js';
import {AVATAR_ASSISTANT, AVATAR_USER, ICON_PAPERCLIP, ICON_SEND, ICON_COMPOSE, ICON_CHEVRON_DOWN, ICON_UPLOAD, ICON_MENU, ICON_PANEL_LEFT_CLOSE, ICON_PIN} from './icons.js';

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
            height: min(760px, calc(100dvh - var(--module-docheader-height, 7rem) - 3rem));
            min-height: 28rem;
            border: 1px solid var(--typo3-component-border-color);
            border-radius: var(--typo3-component-border-radius);
            overflow: hidden;
            font-family: var(--typo3-font-family, sans-serif);
            background: var(--typo3-component-bg);
            color: var(--typo3-component-color);
            box-shadow: var(--typo3-component-box-shadow);
            font-size: var(--typo3-component-font-size, 13px);
        }

        .chat-body {
            display: flex;
            flex: 1;
            min-height: 0;
        }

        /* Sidebar */
        .sidebar {
            width: 280px;
            min-width: 280px;
            border-right: 1px solid var(--typo3-component-border-color);
            display: flex;
            flex-direction: column;
            background: var(--typo3-surface-container-low);
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
            padding: 12px;
            border-bottom: 1px solid var(--typo3-component-border-color);
        }
        .sidebar-header h3 {
            margin: 0;
            font-size: 14px;
        }
        .conversation-list {
            flex: 1;
            overflow-y: auto;
            padding: 4px 0;
        }
        .conversation-item {
            display: flex;
            align-items: center;
            gap: 8px;
            padding: 10px 12px;
            cursor: pointer;
            border-bottom: 1px solid var(--typo3-component-border-color);
            transition: background 0.15s;
        }
        .conversation-item:hover,
        .conversation-item:focus-visible {
            background: var(--typo3-component-hover-bg);
        }
        .conversation-item:focus-visible {
            outline: 2px solid var(--typo3-input-focus-border-color);
            outline-offset: -2px;
        }
        .conversation-item.active {
            background: var(--typo3-component-active-bg);
        }
        .conversation-item .title {
            flex: 1;
            display: inline-flex;
            align-items: center;
            gap: 4px;
            overflow: hidden;
            text-overflow: ellipsis;
            white-space: nowrap;
            font-size: 13px;
        }
        .pinned-icon {
            display: inline-flex;
            flex-shrink: 0;
            color: var(--typo3-text-color-warning);
        }
        .conversation-item .meta {
            font-size: 11px;
            color: var(--typo3-text-color-variant);
        }

        /* Main area */
        .main {
            flex: 1;
            display: flex;
            flex-direction: column;
            min-width: 0;
        }
        .main-header {
            display: flex;
            align-items: center;
            gap: 8px;
            padding: 8px 12px;
            border-bottom: 1px solid var(--typo3-component-border-color);
            min-height: 44px;
        }
        .messages {
            flex: 1;
            overflow-y: auto;
            padding: var(--typo3-spacing);
            display: flex;
            flex-direction: column;
            gap: calc(var(--typo3-spacing) * .75);
        }
        /* Message row layout (avatar + bubble + timestamp) */
        .message-row {
            display: flex;
            align-items: flex-end;
            gap: 8px;
        }
        .message-row.user { flex-direction: row-reverse; }
        .message-bubble {
            display: flex;
            flex-direction: column;
            max-width: 78%;
        }
        .message-row.user .message-bubble { align-items: flex-end; }
        .avatar {
            width: 30px;
            height: 30px;
            border-radius: 50%;
            flex-shrink: 0;
            display: flex;
            align-items: center;
            justify-content: center;
        }
        .avatar-assistant { background: var(--typo3-state-primary-bg); color: var(--typo3-state-primary-color); }
        .avatar-user { background: var(--typo3-state-default-bg); color: var(--typo3-state-default-color); }
        .message-time {
            font-size: 11px;
            color: var(--typo3-text-color-variant);
            margin-top: 3px;
            padding: 0 2px;
        }
        .message {
            padding: 10px 14px;
            border-radius: 8px;
            font-size: 13.5px;
            line-height: 1.5;
            word-break: break-word;
        }
        .message.user {
            background: var(--typo3-state-primary-bg);
            color: var(--typo3-state-primary-color);
            border-bottom-right-radius: 2px;
        }
        .message.assistant {
            background: var(--typo3-surface-container-base);
            color: var(--typo3-text-color-base);
            border-bottom-left-radius: 2px;
        }
        .message.tool {
            align-self: flex-start;
            background: var(--typo3-surface-container-base);
            font-size: 12px;
            font-family: monospace;
            opacity: 0.7;
            max-height: 100px;
            overflow: hidden;
            cursor: pointer;
            position: relative;
        }
        .message.tool.expanded {
            max-height: none;
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

        /* Attach menu */
        .attach-menu-wrap { position: relative; }
        .attach-menu {
            position: absolute;
            bottom: calc(100% + 4px);
            left: 0;
            background: var(--typo3-surface-container-lowest);
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
        .attach-menu li:hover { background: var(--typo3-surface-container-base); }

        /* Input area */
        .input-area {
            display: flex;
            align-items: center;
            gap: 8px;
            padding: var(--typo3-component-padding-y) var(--typo3-component-padding-x);
            border-top: 1px solid var(--typo3-component-border-color);
            background: var(--typo3-surface-container-low);
        }
        .input-wrap {
            flex: 1;
            display: flex;
            align-items: center;
            gap: 4px;
            border: 1px solid var(--typo3-input-border-color);
            border-radius: var(--typo3-input-border-radius);
            padding: 4px 4px 4px 12px;
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
            padding: 5px 0;
            font-family: inherit;
            font-size: 13px;
            line-height: 1.4;
            min-height: 44px;
            max-height: 120px;
            overflow-y: auto;
            background: transparent;
        }
        .btn-send {
            appearance: none;
            -webkit-appearance: none;
            flex-shrink: 0;
            width: 34px;
            height: 34px;
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
            margin: 0 2px 0 0;
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
        }
        .btn-primary:hover:not(:disabled) {
            background: var(--typo3-state-primary-hover-bg);
        }
        .btn-sm {
            padding: 4px 8px;
            font-size: var(--typo3-font-size-small, 12px);
        }
        .btn-icon {
            min-width: 34px;
            min-height: 34px;
            padding: 6px;
            border: none;
            background: transparent;
        }
        .btn-icon:hover {
            background: var(--typo3-component-hover-bg);
        }
        .btn-icon:focus-visible {
            outline: 2px solid var(--typo3-input-focus-border-color);
            outline-offset: -2px;
        }

        /* Status indicators */
        .status-badge {
            display: inline-block;
            padding: 2px 6px;
            border-radius: 3px;
            font-size: 11px;
            font-weight: 600;
            text-transform: uppercase;
        }
        .status-idle { background: var(--typo3-surface-container-success); color: var(--typo3-surface-container-success-text); }
        .status-processing, .status-locked, .status-tool_loop {
            background: var(--typo3-surface-container-warning); color: var(--typo3-surface-container-warning-text);
        }
        .status-failed { background: var(--typo3-surface-container-danger); color: var(--typo3-surface-container-danger-text); }

        .empty-state {
            flex: 1;
            display: flex;
            align-items: center;
            justify-content: center;
            color: var(--typo3-text-color-variant);
            font-size: 14px;
            text-align: center;
            padding: 24px;
        }

        .issues-banner {
            padding: 8px 12px;
            background: var(--typo3-surface-container-warning);
            border-bottom: 1px solid color-mix(in srgb, var(--typo3-surface-container-warning), var(--typo3-surface-container-warning-text) var(--typo3-border-mix));
            font-size: 12px;
            color: var(--typo3-surface-container-warning-text);
        }

        .spinner {
            display: inline-block;
            width: 14px;
            height: 14px;
            border: 2px solid color-mix(in srgb, currentColor, transparent 85%);
            border-top-color: var(--typo3-state-primary-bg);
            border-radius: 50%;
            animation: spin 0.8s linear infinite;
        }
        @keyframes spin { to { transform: rotate(360deg); } }

        /* Typing indicator — animated dots */
        .typing-indicator {
            display: flex;
            gap: 4px;
            align-items: center;
            padding: 10px 14px;
            background: var(--typo3-surface-container-high);
            border-radius: 8px;
            border-bottom-left-radius: 2px;
            width: fit-content;
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

    onResetInput() {
        const ta = this.renderRoot?.querySelector('.input-area textarea');
        if (ta) ta.style.height = 'auto';
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
            return html`<div class="empty-state"><span class="spinner"></span></div>`;
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
                <h3>${lll('conversations.title')}</h3>
                <button class="btn btn-icon"
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
                    <span>${c.title || lll('conversations.newConversation')}</span>
                </div>
                <div class="meta">
                    <span class="status-badge status-${c.status}">${c.status}</span>
                </div>
            </div>
        `;
    }

    _renderToggleButton() {
        return html`
            <button class="btn btn-icon"
                @click=${() => this._sidebarCollapsed = !this._sidebarCollapsed}
                title="${this._sidebarCollapsed ? lll('sidebar.show') : lll('sidebar.hide')}"
                aria-label="${this._sidebarCollapsed ? lll('sidebar.show') : lll('sidebar.hide')}">
                ${this._sidebarCollapsed ? ICON_MENU(18) : ICON_PANEL_LEFT_CLOSE(18)}
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
                    ${this.chat.available
                        ? lll('chat.selectOrCreate')
                        : lll('chat.notAvailable')
                    }
                </div>
            `;
        }

        const conv = this.chat.getActiveConversation();
        const isResumable = conv?.resumable || false;

        return html`
            <div class="main-header">
                ${this._renderToggleButton()}
                <strong style="flex:1;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">
                    ${conv?.title || lll('conversations.newConversation')}
                </strong>
                <button class="btn btn-sm" @click=${() => this.chat.handleTogglePin()}
                    title="${conv?.pinned ? lll('conversations.unpin') : lll('conversations.pin')}"
                    aria-label="${conv?.pinned ? lll('conversations.unpin') : lll('conversations.pin')}">
                    ${ICON_PIN(16)}
                </button>
                <button class="btn btn-sm" @click=${() => this.chat.handleArchive()}>${lll('conversations.archive')}</button>
            </div>

            <div class="messages" aria-live="polite" aria-relevant="additions">
                ${this.chat.messages.map((msg, idx) => this._renderMessage(msg, idx))}
                ${this.chat.isProcessing() ? html`
                    <div class="message-row assistant" aria-label="${lll('chat.processing')}">
                        <div class="avatar avatar-assistant">${AVATAR_ASSISTANT(16)}</div>
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
                        ${this.chat.sending ? html`<span class="spinner" style="width:14px;height:14px;border-width:2px;"></span>` : ICON_SEND(16)}
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
                ${isUser ? nothing : html`<div class="avatar avatar-assistant">${AVATAR_ASSISTANT(16)}</div>`}
                <div class="message-bubble">
                    <div class="message ${role}">${bubbleContent}</div>
                    ${time ? html`<div class="message-time">${time}</div>` : nothing}
                </div>
                ${isUser ? html`<div class="avatar avatar-user">${AVATAR_USER(16)}</div>` : nothing}
            </div>
        `;
    }
}

customElements.define('nr-chat-app', ChatApp);
