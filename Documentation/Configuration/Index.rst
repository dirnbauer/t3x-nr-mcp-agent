..  include:: /Includes.rst.txt

=============
Configuration
=============

All settings are managed via **Admin Tools > Settings >
Extension Configuration > nr_mcp_agent**.

LLM connection
==============

..  confval:: llmTaskUid
    :type: int
    :default: 0

    UID of an nr-llm Task record. This Task defines which
    LLM provider and model to use (e.g. OpenAI GPT-4,
    Anthropic Claude). **Required** -- the extension will
    not work without a valid Task UID.

    Create the Task record in the nr-llm backend module
    first, then enter its UID here.

Processing
==========

..  confval:: processingStrategy
    :type: string
    :default: exec

    How chat messages are processed in the background:

    ``exec``
        Forks a CLI process per request
        (``ai-chat:process``). Simple, no extra setup.
        Best for development and low-traffic sites.

    ``worker``
        Uses a long-running worker process
        (``ai-chat:worker``) that polls for new messages.
        Better for production -- lower latency, no
        process forking overhead.

Access control
==============

..  confval:: allowedGroups
    :type: string
    :default: *(empty)*

    Comma-separated list of backend user group UIDs that
    are allowed to use the AI Chat module. Leave empty
    to allow all backend users with module access.

MCP integration
===============

..  confval:: enableMcp
    :type: boolean
    :default: false

    Enable MCP (Model Context Protocol) server integration.

    When enabled, the AI assistant can call tools exposed
    by any configured MCP server. When disabled, it works
    as a plain chat without tool access.

    MCP servers are configured as records in the TYPO3
    List module (see *MCP server records* below).

MCP server records
------------------

MCP servers are configured as database records, not via
extension settings. After enabling MCP:

1.  Open the **TYPO3 List module** and navigate to
    **pid = 0** (the root page).
2.  Create a new record of type **MCP Server**.
3.  Fill in the fields:

    ``Name``
        Human-readable label (e.g. *TYPO3 MCP Server*).

    ``Server key``
        Machine identifier used to namespace tools
        (e.g. ``typo3``). Lowercase letters, digits,
        and underscores only. Must be unique.

    ``Transport``
        ``stdio`` (subprocess via stdin/stdout) or
        ``sse`` (HTTP SSE endpoint — not yet implemented).

    For ``stdio`` transport:

    ``Command``
        Path to the MCP server binary. Defaults to
        ``vendor/bin/typo3`` in the project root.

    ``Arguments``
        One argument per line (e.g. ``mcp:server``).

4.  Save the record. The tool cache is flushed
    automatically.

Tool names are prefixed with the server key to avoid
collisions between servers. For example, a tool named
``ReadTable`` on a server with key ``typo3`` becomes
``typo3__ReadTable`` in the LLM context.

The connection status fields (read-only) show the
last known state of each server connection.

Chat panel
==========

When ``llmTaskUid`` is configured, a chat button appears
automatically in the TYPO3 backend toolbar (top right).
Clicking it opens a floating bottom panel that stays visible
across module navigation.

The panel supports four states:

*   **Hidden** -- Default. Only the toolbar button is visible.
*   **Collapsed** -- Minimal header bar showing the active
    conversation title and status.
*   **Expanded** -- Resizable panel with chat messages, input,
    and a compact conversation switcher.
*   **Maximized** -- Full-height panel with a sidebar for
    conversation management (search, pin, archive).

The panel height and state are persisted per user in the
browser's localStorage.

System prompt
=============

The system prompt sent to the LLM is not configured in the
extension configuration itself, but in the **nr-llm records**:

**Configuration record** (``tx_nrllm_configuration.system_prompt``)
    The primary system prompt. Set this to define the AI
    assistant's persona, language, and behavior. Also use
    this field for tool usage instructions when MCP is
    enabled.

    Example for MCP usage::

        Du bist ein TYPO3-Assistent.

        ## Tool-Nutzung
        - Bei WriteTable gehören Record-Felder IMMER in den
          "data" Parameter als Objekt.
        - Beispiel: {"action": "create", "table": "pages",
          "pid": 1, "data": {"title": "Meine Seite"}}

**Task record** (``tx_nrllm_task.prompt_template``)
    Additional instructions appended after the Configuration
    prompt. Use this for task-specific context.

When both fields are set, they are combined (separated by a
blank line). If neither is set, a locale-based default prompt
is used. A per-conversation ``system_prompt`` field can
override everything (set programmatically, not via UI).

User interface
==============

..  confval:: maxConversationsPerUser
    :type: int
    :default: 50

    Maximum number of conversations to keep per user.
    Set to ``0`` for unlimited. When the limit is reached,
    the oldest non-pinned conversations are archived
    automatically.

..  confval:: autoArchiveDays
    :type: int
    :default: 30

    Automatically archive conversations that have been
    inactive for this many days. Set to ``0`` to disable
    auto-archiving.

    Auto-archiving runs via the ``ai-chat:cleanup``
    command.

File attachments
================

File attachments are available when the active provider supports the
format natively or an enabled server-side extractor can process it.
PDF extraction is disabled by default. In that state, PDFs are only
available for providers that expose native document support.

**Server-side text extraction:**

*   PDF: ``application/pdf`` -- requires ``smalot/pdfparser``
    and ``enablePdfTextExtraction = 1``
*   DOCX: ``application/vnd.openxmlformats-officedocument.wordprocessingml.document``
    -- requires ``phpoffice/phpword`` (hard dependency)
*   TXT: ``text/plain`` -- no dependencies
*   XLSX: ``application/vnd.openxmlformats-officedocument.spreadsheetml.sheet``
    -- requires ``phpoffice/phpspreadsheet`` (optional; install via
    ``composer require phpoffice/phpspreadsheet:^3.0``)

**Additionally available for vision-capable providers** (Claude 3+, Gemini,
GPT-4o, etc.):

*   Images: ``image/png``, ``image/jpeg``, ``image/webp``

When the provider natively handles a document format (e.g. Claude
natively processes PDFs via ``DocumentCapableInterface``), the file is
sent as binary instead of being extracted. The file picker automatically
restricts to formats the active provider can process.

**Storage:** Uploaded files are stored in TYPO3 FAL under
``fileadmin/ai-chat/<be_user_uid>/`` using sanitized randomized file
names. They are read at LLM call time and sent as Base64-encoded
multimodal content or extracted text. Each file is stored in a
user-specific subfolder; the API enforces that users can only attach
their own files (cross-user access attempts return 404).

**Limits:**

*   Maximum 5 files per conversation.
*   Maximum file size: configured by ``maxUploadFileSize``
    (20 MB by default).
*   File count is enforced both in the frontend (before upload) and in the
    backend API.

**Validation and hardening:**

*   The backend validates the detected MIME type via ``finfo``; the
    browser-provided ``Content-Type`` is not trusted.
*   The original filename extension must match the detected MIME type.
*   Uploaded files are stored with sanitized randomized names to avoid
    reusing attacker-controlled filenames.
*   PDF extraction uses an isolated temporary processing copy.
*   When ``rejectActivePdfContent`` is enabled, PDF extraction rejects
    common active-content markers such as JavaScript, launch actions,
    embedded files, RichMedia, and XFA.
*   Extracted text is wrapped as untrusted document data before it is sent
    to the model.
*   When ``enablePromptInjectionFilter`` is enabled, lines that look like
    prompt-injection directives are removed from extracted document text.

The ``fileadmin/ai-chat/`` directory should be protected from direct HTTP
access. Add the following to your web server configuration or deploy a
``.htaccess`` file to ``fileadmin/ai-chat/``:

..  code-block:: apache

    # fileadmin/ai-chat/.htaccess
    Require all denied

..  confval:: enablePdfTextExtraction
    :type: boolean
    :default: false

    Enables server-side PDF text extraction as a fallback for providers
    without native document support. Keep this disabled when PDFs should
    be sent only to providers that can process PDF input natively.

..  confval:: maxUploadFileSize
    :type: int
    :default: 20971520

    Maximum accepted upload size in bytes. The default is 20 MB. Values
    less than or equal to ``0`` fall back to the default 20 MB limit.

..  confval:: maxExtractedTextLength
    :type: int
    :default: 20000

    Maximum number of characters kept from extracted document text before
    it is sent to the LLM. Set to ``0`` to disable truncation.

..  confval:: enablePromptInjectionFilter
    :type: boolean
    :default: true

    Removes common prompt-injection-like instructions from extracted
    document text before the text is wrapped and sent to the LLM. This
    applies to extractor fallback content, not to files sent natively to
    a document-capable provider.

..  confval:: rejectActivePdfContent
    :type: boolean
    :default: true

    Rejects PDFs that contain active-content markers during PDF
    validation and extraction. The default blocks markers for JavaScript,
    launch actions, embedded files, RichMedia, and XFA.

Security
========

..  confval:: maxMessageLength
    :type: int
    :default: 10000

    Maximum length of a single user message in characters.
    Set to ``0`` for unlimited (not recommended).

    Messages exceeding this limit are rejected with an
    error.

..  confval:: maxActiveConversationsPerUser
    :type: int
    :default: 3

    Maximum number of simultaneously active (processing)
    conversations per user. Prevents a single user from
    overloading the system. Set to ``0`` for unlimited.

Worker mode production setup
============================

For production use with ``processingStrategy = worker``,
set up a systemd service to keep the worker running:

..  code-block:: ini

    # /etc/systemd/system/typo3-ai-chat-worker.service
    [Unit]
    Description=TYPO3 AI Chat Worker
    After=mysql.service

    [Service]
    Type=simple
    User=www-data
    Group=www-data
    WorkingDirectory=/var/www/html
    ExecStart=/var/www/html/vendor/bin/typo3 \
        ai-chat:worker --poll-interval=200
    Restart=always
    RestartSec=5

    [Install]
    WantedBy=multi-user.target

Enable and start the service:

..  code-block:: bash

    sudo systemctl daemon-reload
    sudo systemctl enable typo3-ai-chat-worker
    sudo systemctl start typo3-ai-chat-worker

Scheduled cleanup
=================

Add the cleanup command to your cron or TYPO3 scheduler
to handle stuck conversations, auto-archiving, and
deletion of old data:

..  code-block:: bash

    # Run cleanup daily at 3:00 AM
    0 3 * * * /var/www/html/vendor/bin/typo3 \
        ai-chat:cleanup --delete-after-days=90
