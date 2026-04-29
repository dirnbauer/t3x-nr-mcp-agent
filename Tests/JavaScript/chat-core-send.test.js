/**
 * @jest-environment jest-environment-jsdom
 */

import {jest, describe, test, expect} from '@jest/globals';
import {ChatCoreController} from '../../Resources/Public/JavaScript/chat-core.js';

function makeHost() {
    return {
        addController: jest.fn(),
        requestUpdate: jest.fn(),
        addEventListener: jest.fn(),
        removeEventListener: jest.fn(),
        onResetInput: jest.fn(),
        onScrollToBottom: jest.fn(),
        onFocusInput: jest.fn(),
        onResponsePrinted: jest.fn(),
    };
}

describe('ChatCoreController send state', () => {
    test('canSend returns true for a pending file without text input', () => {
        const ctrl = new ChatCoreController(makeHost());
        ctrl.available = true;
        ctrl.hasInput = false;
        ctrl.pendingFile = {fileUid: 42, name: 'report.pdf', mimeType: 'application/pdf'};

        expect(ctrl.canSend()).toBe(true);
    });

    test('handleSend submits attachment-only messages with fileUid', async () => {
        const host = makeHost();
        const ctrl = new ChatCoreController(host);
        ctrl._api = {
            sendMessage: jest.fn().mockResolvedValue({status: 'processing'}),
        };
        ctrl.startPollingIfNeeded = jest.fn();
        ctrl.activeUid = 123;
        ctrl.available = true;
        ctrl.conversations = [{uid: 123, status: 'ready'}];
        ctrl.pendingFile = {fileUid: 42, name: 'report.pdf', mimeType: 'application/pdf'};

        await ctrl.handleSend();

        expect(ctrl._api.sendMessage).toHaveBeenCalledWith(123, '', 42);
        expect(ctrl.pendingFile).toBeNull();
        expect(ctrl.messages).toHaveLength(1);
        expect(ctrl.messages[0]).toMatchObject({
            role: 'user',
            content: 'Please analyze the attached file "report.pdf".',
            fileUid: 42,
            fileName: 'report.pdf',
            fileMimeType: 'application/pdf',
        });
        expect(ctrl.status).toBe('processing');
        expect(host.onResetInput).toHaveBeenCalled();
        expect(host.onScrollToBottom).toHaveBeenCalledWith(true);
    });

    test('pollMessages notifies host when an assistant response finishes', async () => {
        const host = makeHost();
        const ctrl = new ChatCoreController(host);
        ctrl._api = {
            getMessages: jest.fn().mockResolvedValue({
                messages: [{role: 'assistant', content: 'Done.'}],
                status: 'idle',
                errorMessage: '',
                totalCount: 2,
            }),
        };
        ctrl.activeUid = 123;
        ctrl.status = 'processing';
        ctrl._knownMessageCount = 1;
        ctrl.conversations = [{uid: 123, status: 'processing'}];

        await ctrl.pollMessages();

        expect(host.onResponsePrinted).toHaveBeenCalledTimes(1);
        expect(host.onScrollToBottom).toHaveBeenCalled();
    });
});
