import {ApiClient} from './api-client.js';
import {lll} from '@typo3/core/lit-helper.js';
import {renderMarkdown} from './markdown.js';

export const PROCESSING_STATUSES = new Set(['processing', 'locked', 'tool_loop']);
const ATTACHMENT_ONLY_MESSAGE = 'Please analyze the attached file "%s".';

/**
 * ChatCoreController – Lit ReactiveController that encapsulates all chat
 * business logic. The host component creates an instance via
 * `new ChatCoreController(this)` in its constructor.
 *
 * The host must implement three callback hooks:
 * - onScrollToBottom(force) – scroll the message container
 * - onFocusInput()          – focus the textarea
 * - onResetInput()          – reset textarea height after send
 */
export class ChatCoreController {
    /** @type {import('lit').ReactiveControllerHost} */
    host;

    // ── Public state (host reads these in render) ──────────────────────
    conversations = [];
    activeUid = null;
    messages = [];
    status = '';
    errorMessage = '';
    inputValue = '';
    hasInput = false;
    loading = true;
    sending = false;
    available = false;
    issues = [];
    maxLength = 0;
    /** @type {Set<number>} */
    expandedTools = new Set();
    /** @type {{fileUid: number, name: string, mimeType: string}|null} */
    pendingFile = null;
    visionSupported = false;
    maxFileSize = 0;
    /** @type {string[]} */
    supportedFormats = [];

    // ── Internal state ─────────────────────────────────────────────────
    /** @type {ApiClient} */
    _api;
    /** @type {AbortController} */
    _abortController;
    /** @type {number|null} */
    _pollTimer = null;
    /** @type {number} */
    _knownMessageCount = 0;
    /** @type {number} */
    _pollFailures = 0;
    /** @type {HTMLElement|null} — overlay wrapping the element-browser iframe */
    _falPickerOverlay = null;

    /**
     * @param {import('lit').ReactiveControllerHost} host
     */
    constructor(host) {
        this.host = host;
        host.addController(this);
    }

    // ── Lifecycle ──────────────────────────────────────────────────────

    hostConnected() {
        this._abortController = new AbortController();
        this._api = new ApiClient(this._abortController.signal);
        this.host.addEventListener(
            'nr-mcp-open-fal-picker',
            () => this._openFalPicker(),
            {signal: this._abortController.signal},
        );
        this.init();
    }

    hostDisconnected() {
        this._abortController?.abort();
        this.stopPolling();
        this._cleanupFalPicker();
    }

    /** @param {string} message */
    _setError(message) {
        this.issues = [message];
        this.host.requestUpdate();
    }

    // ── Core logic ─────────────────────────────────────────────────────

    async init() {
        const signal = this._abortController?.signal;
        try {
            const statusData = await this._api.getStatus();
            if (signal?.aborted) return;
            this.available = statusData.available;
            this.issues = statusData.issues || [];
            this.visionSupported = statusData.visionSupported || false;
            this.maxFileSize = statusData.maxFileSize || 0;
            this.supportedFormats = statusData.supportedFormats || [];
            await this.loadConversations();
        } catch (e) {
            if (signal?.aborted) return;
            this.issues = [e.message];
        } finally {
            if (!signal?.aborted) {
                this.loading = false;
                this.host.requestUpdate();
            }
        }
    }

    async loadConversations() {
        const data = await this._api.listConversations();
        this.conversations = data.conversations || [];
        this.host.requestUpdate();
    }

    async selectConversation(uid) {
        this.activeUid = uid;
        this._knownMessageCount = 0;
        this.expandedTools = new Set();
        this.pendingFile = null;
        this.host.requestUpdate();
        await this.loadMessages();
        this.startPollingIfNeeded();
        this.host.onFocusInput();
    }

    async loadMessages() {
        if (!this.activeUid) return;
        try {
            const data = await this._api.getMessages(this.activeUid, 0);
            this.messages = data.messages || [];
            this.status = data.status;
            this.errorMessage = data.errorMessage || '';
            this._knownMessageCount = data.totalCount;
            this.host.requestUpdate();
            this.host.onScrollToBottom(true);
        } catch (e) {
            this.errorMessage = e.message;
            this.host.requestUpdate();
        }
    }

    async pollMessages() {
        const uid = this.activeUid;
        if (!uid) return;
        try {
            const data = await this._api.getMessages(uid, this._knownMessageCount);
            if (uid !== this.activeUid) return; // stale response, discard
            const newMessages = data.messages || [];
            const statusChanged = data.status !== this.status;

            if (newMessages.length > 0 || statusChanged) {
                if (newMessages.length > 0) {
                    this.messages = [...this.messages, ...newMessages];
                }
                this.status = data.status;
                this.errorMessage = data.errorMessage || '';
                this._knownMessageCount = data.totalCount;
                // Update active conversation status in-place (avoids extra request)
                this.conversations = this.conversations.map(c =>
                    c.uid === this.activeUid
                        ? {...c, status: data.status, errorMessage: data.errorMessage || ''}
                        : c
                );
                this.host.requestUpdate();
                this.host.onScrollToBottom();
            }

            // Reset failure counter on success
            this._pollFailures = 0;
            if (this.errorMessage === lll('chat.connectionLost')) {
                this.errorMessage = '';
                this.host.requestUpdate();
            }

            // Stop polling when no longer processing
            if (!this.isProcessing()) {
                this.stopPolling();
            }
        } catch {
            this._pollFailures++;
            if (this._pollFailures >= 5) {
                this.errorMessage = lll('chat.connectionLost');
                this.host.requestUpdate();
                this.stopPolling();
            }
        }
    }

    startPollingIfNeeded() {
        this.stopPolling();
        if (this.isProcessing()) {
            this.schedulePoll();
        }
    }

    schedulePoll() {
        this._pollTimer = setTimeout(async () => {
            if (!this.host.isConnected) return;
            await this.pollMessages();
            if (this.host.isConnected && this.isProcessing()) {
                this.schedulePoll();
            }
        }, 2000);
    }

    stopPolling() {
        if (this._pollTimer) {
            clearTimeout(this._pollTimer);
            this._pollTimer = null;
        }
    }

    isProcessing() {
        return PROCESSING_STATUSES.has(this.status);
    }

    canSend() {
        return (this.hasInput || this.pendingFile !== null)
            && !this.sending
            && !this.isProcessing()
            && this.available;
    }

    async handleSend() {
        const content = this.inputValue.trim();
        const pendingFile = this.pendingFile;
        const fileUid = pendingFile?.fileUid ?? null;
        if ((!content && fileUid === null) || this.sending || this.isProcessing() || !this.available) return;

        if (this.maxLength > 0 && content.length > this.maxLength) {
            this.errorMessage = lll('chat.messageTooLong', this.maxLength);
            this.host.requestUpdate();
            return;
        }

        const messageContent = content || this._getAttachmentOnlyMessage(pendingFile?.name);

        this.sending = true;
        this.errorMessage = '';
        this.host.requestUpdate();
        try {
            await this._api.sendMessage(this.activeUid, content, fileUid);
            this.inputValue = '';
            this.hasInput = false;
            this.host.onResetInput();
            // Optimistic: add user message locally
            const msg = {role: 'user', content: messageContent, createdAt: new Date().toISOString()};
            if (pendingFile) {
                msg.fileUid = pendingFile.fileUid;
                msg.fileName = pendingFile.name;
                msg.fileMimeType = pendingFile.mimeType;
            }
            this.pendingFile = null;
            this.messages = [...this.messages, msg];
            this.status = 'processing';
            this._knownMessageCount++;
            this.conversations = this.conversations.map(c =>
                c.uid === this.activeUid ? {...c, status: 'processing'} : c
            );
            this.errorMessage = '';
            this.host.requestUpdate();
            this.host.onScrollToBottom(true);
            this.startPollingIfNeeded();
        } catch (e) {
            this.errorMessage = e.message;
            this.host.requestUpdate();
        } finally {
            this.sending = false;
            this.host.requestUpdate();
        }
    }

    async handleNewConversation() {
        try {
            const data = await this._api.createConversation();
            await this.loadConversations();
            await this.selectConversation(data.uid);
        } catch (e) {
            this.errorMessage = e.message;
            this.host.requestUpdate();
        }
    }

    async handleResume() {
        if (!this.activeUid) return;
        try {
            await this._api.resumeConversation(this.activeUid);
            this.status = 'processing';
            this.errorMessage = '';
            this.conversations = this.conversations.map(c =>
                c.uid === this.activeUid ? {...c, status: 'processing'} : c
            );
            this.host.requestUpdate();
            this.startPollingIfNeeded();
        } catch (e) {
            this.errorMessage = e.message;
            this.host.requestUpdate();
        }
    }

    async handleArchive(uid = null) {
        const targetUid = uid ?? this.activeUid;
        if (!targetUid) return;
        if (!confirm(lll('conversations.archiveConfirm'))) return;
        try {
            await this._api.archiveConversation(targetUid);
            if (targetUid === this.activeUid) {
                this.activeUid = null;
                this.messages = [];
                this.status = '';
                this.errorMessage = '';
                this.stopPolling();
            }
            await this.loadConversations();
        } catch (e) {
            this.errorMessage = e.message;
            this.host.requestUpdate();
        }
    }

    async handleRename(uid, title) {
        const trimmed = title.trim();
        if (!trimmed) return;
        try {
            await this._api.renameConversation(uid, trimmed);
            this.conversations = this.conversations.map(c =>
                c.uid === uid ? {...c, title: trimmed} : c,
            );
            this.host.requestUpdate();
        } catch (e) {
            this.errorMessage = e.message;
            this.host.requestUpdate();
        }
    }

    async handleTogglePin() {
        if (!this.activeUid) return;
        try {
            await this._api.togglePin(this.activeUid);
            this.errorMessage = '';
            await this.loadConversations();
        } catch (e) {
            this.errorMessage = e.message;
            this.host.requestUpdate();
        }
    }

    handleToolMessageClick(idx) {
        if (this.expandedTools.has(idx)) {
            this.expandedTools.delete(idx);
        } else {
            this.expandedTools.add(idx);
        }
        this.host.requestUpdate();
    }

    getActiveConversation() {
        return this.conversations.find(c => c.uid === this.activeUid);
    }

    canAttachFile() {
        if (!this.visionSupported) return false;
        const fileCount = this.messages.filter(m => m.fileUid).length;
        return fileCount < 5 && !this.pendingFile;
    }

    async handleFileUpload(file) {
        if (file.size > this.maxFileSize) {
            this.errorMessage = lll('attachment.tooLarge', Math.round(this.maxFileSize / 1024 / 1024));
            this.host.requestUpdate();
            return;
        }
        try {
            const result = await this._api.uploadFile(file);
            this.pendingFile = result;
            this.host.requestUpdate();
        } catch (e) {
            this.errorMessage = e.message;
            this.host.requestUpdate();
        }
    }

    // TYPO3 Element Browser (FAL picker) flow.
    handleFileSelect(fileUid, name, mimeType) {
        this.pendingFile = {fileUid, name, mimeType};
        this.host.requestUpdate();
    }

    _getAttachmentOnlyMessage(fileName = '') {
        const label = lll('attachment.defaultMessage', fileName);
        if (label && label !== 'attachment.defaultMessage') {
            return label;
        }
        return ATTACHMENT_ONLY_MESSAGE.replace('%s', fileName || lll('attachment.file') || 'file');
    }

    _openFalPicker() {
        // Guard: picker already open (message listener active)
        if (this._falPickerListener) {
            return;
        }

        // TYPO3 registers the element browser URL in settings.Wizards.elementBrowserUrl
        // (set by BackendController via addInlineSetting for route 'wizard_element_browser')
        const browserUrl = top.TYPO3?.settings?.Wizards?.elementBrowserUrl
            || globalThis.TYPO3?.settings?.Wizards?.elementBrowserUrl;
        if (!browserUrl) {
            this._setError(lll('fal_picker_unavailable'));
            return;
        }

        // A unique fieldName lets us identify our Element Browser response.
        const fieldName = 'nr_mcp_agent_fal_picker';
        const extensions = this.supportedFormats.join(',');
        const url = new URL(browserUrl, window.location.origin);
        url.searchParams.set('mode', 'file');
        url.searchParams.set('fieldReference', fieldName);
        url.searchParams.set('allowedTypes', extensions);
        url.searchParams.set('useEvents', '1');

        // We embed the element browser in an <iframe class="t3js-modal-iframe"> instead of a popup window.
        //
        // Root cause of popup approach: TYPO3's element-browser.js#getParent() opens with:
        //   const e = ... && window.frames.frameElement.classList.contains("t3js-modal-iframe")
        // In a popup window window.frameElement is null (not undefined), so null.classList throws before
        // the postMessage is ever sent.
        //
        // With an iframe, window.frameElement is the <iframe> element itself (non-null).  TYPO3's
        // getParent() then hits the branch:
        //   this.opener = window.frames.frameElement.contentWindow.parent   (= our window)
        // and MessageUtility.send() delivers the postMessage to us correctly.
        const iframe = document.createElement('iframe');
        iframe.src = url.toString();
        iframe.className = 't3js-modal-iframe'; // required for TYPO3 getParent() to resolve our window
        iframe.setAttribute('aria-label', lll('fal_picker_label') || 'Select file');
        Object.assign(iframe.style, {
            width: '100%', height: '100%', border: 'none', display: 'block',
        });

        this._falPickerOverlay = document.createElement('div');
        this._falPickerOverlay.setAttribute('aria-modal', 'true');
        this._falPickerOverlay.setAttribute('role', 'dialog');
        Object.assign(this._falPickerOverlay.style, {
            position: 'fixed', inset: '0', zIndex: '9999',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            padding: '1rem',
            background: 'color-mix(in srgb, var(--typo3-overlay-bg, #000), transparent 25%)',
        });

        const box = document.createElement('div');
        Object.assign(box.style, {
            width: 'min(780px, calc(100vw - 2rem))',
            height: 'min(540px, calc(100vh - 2rem))',
            background: 'var(--typo3-component-bg)',
            color: 'var(--typo3-component-color)',
            border: '1px solid var(--typo3-component-border-color)',
            borderRadius: 'var(--typo3-component-border-radius)',
            boxShadow: 'var(--typo3-component-box-shadow-dialog, var(--typo3-component-box-shadow-flyout))',
            overflow: 'hidden',
            display: 'flex', flexDirection: 'column',
        });

        box.appendChild(iframe);
        this._falPickerOverlay.appendChild(box);
        document.body.appendChild(this._falPickerOverlay);

        // Click outside the box to dismiss
        this._falPickerOverlay.addEventListener('click', (e) => {
            if (e.target === this._falPickerOverlay) {
                this._cleanupFalPicker();
            }
        });

        // TYPO3 v14 Element Browser sends {actionName:'typo3:elementBrowser:elementAdded', fieldName, value, label}
        // as a bubbling `typo3:element-browser:message` CustomEvent when useEvents=1. Keep the
        // postMessage listeners as a fallback for older/embedded backend contexts.
        // value = sys_file UID as a plain string ("42") or in table_uid format ("sys_file_42").
        this._falPickerListener = (event) => {
            const data = event.detail || event.data || {};
            if (data.actionName !== 'typo3:elementBrowser:elementAdded') return;
            if (data.fieldName !== fieldName) return;
            if (!this._falPickerOverlay) return; // guard against duplicate invocations
            this._cleanupFalPicker();
            // Extract the trailing integer — handles both "42" and "sys_file_42"
            const match = String(data.value ?? '').match(/(\d+)$/);
            const uid = match ? parseInt(match[1], 10) : 0;
            if (uid > 0) {
                this._onFalFileSelected(uid);
            }
        };
        iframe.addEventListener('typo3:element-browser:message', this._falPickerListener);
        this._falPickerEventTarget = iframe;
        this._addFalPickerMessageListeners();
    }

    /**
     * Register the FAL picker message listener on all windows that TYPO3's getParent() may resolve to.
     *
     * In TYPO3 v14 the backend loads the active module in an iframe named "list_frame".  getParent()
     * detects this via document.list_frame and — because our overlay contains a .t3js-modal-iframe —
     * routes the postMessage to that module iframe instead of top.  We therefore register on
     * globalThis AND on every same-origin frame currently in top.frames.
     */
    _addFalPickerMessageListeners() {
        const fn = this._falPickerListener;
        globalThis.addEventListener('message', fn);
        // Register on all same-origin child frames so we catch the message regardless of which
        // window getParent() resolves to (top, list_frame, or another t3js-modal-iframe frame).
        this._falPickerExtraWindows = [];
        try {
            Array.from(top.frames || []).forEach(frame => {
                try {
                    if (frame !== globalThis) {
                        frame.addEventListener('message', fn);
                        this._falPickerExtraWindows.push(frame);
                    }
                } catch { /* cross-origin frame — skip */ }
            });
        } catch { /* cross-origin access to top.frames — skip */ }
    }

    _cleanupFalPicker() {
        if (this._falPickerListener) {
            const fn = this._falPickerListener;
            this._falPickerEventTarget?.removeEventListener('typo3:element-browser:message', fn);
            globalThis.removeEventListener('message', fn);
            (this._falPickerExtraWindows || []).forEach(w => {
                try { w.removeEventListener('message', fn); } catch { /* cross-origin */ }
            });
            this._falPickerEventTarget = null;
            this._falPickerExtraWindows = null;
            this._falPickerListener = null;
        }
        if (this._falPickerOverlay) {
            this._falPickerOverlay.remove();
            this._falPickerOverlay = null;
        }
        this.host.requestUpdate();
    }

    /** @param {number} fileUid */
    async _onFalFileSelected(fileUid) {
        try {
            const result = await this._api.getFileInfo(fileUid);
            this.handleFileSelect(result.fileUid, result.name, result.mimeType);
        } catch (e) {
            this._setError(e.message);
        }
    }

    clearPendingFile() {
        this.pendingFile = null;
        this.host.requestUpdate();
    }

    formatTime(ts) {
        if (!ts) return '';
        try {
            return new Intl.DateTimeFormat(undefined, {hour: '2-digit', minute: '2-digit'}).format(new Date(ts));
        } catch {
            return '';
        }
    }

    renderMessageContent(msg) {
        const text = this._extractText(msg);
        return msg.role === 'assistant' ? renderMarkdown(text) : text;
    }

    _extractText(msg) {
        if (typeof msg.content === 'string') return msg.content;
        if (Array.isArray(msg.content)) {
            return msg.content.map(p => p.text || '').join('\n');
        }
        return JSON.stringify(msg.content);
    }
}
