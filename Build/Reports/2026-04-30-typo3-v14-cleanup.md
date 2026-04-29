# TYPO3 v14 Cleanup Report

Date: 2026-04-30
Extension: nr_mcp_agent

## Rule Source

The requested Cursor rule files were not present in this checkout:

- .cursor/rules/typo3-extension-upgrade.mdc
- .cursor/rules/typo3-conformance.mdc
- .cursor/rules/typo3-security.mdc
- .cursor/rules/security-audit.mdc
- .cursor/rules/typo3-testing.mdc
- .cursor/rules/typo3-docs.mdc

Applied fallback rules from the installed TYPO3 and security skills:

- typo3-extension-upgrade
- typo3-conformance
- typo3-security
- security-audit
- typo3-testing
- typo3-docs

External references checked:

- TYPO3 Core API: PHPStan config should live below Build/phpstan/phpstan.neon and be run with `vendor/bin/phpstan --configuration=Build/phpstan/phpstan.neon`.
- Packagist: `saschaegerer/phpstan-typo3` 3.0.1 targets TYPO3 `^14.0` and PHPStan `^2.1.33`.
- PHPStan docs: `level: max` is the alias for the highest available rule level.
- TYPO3 Core API: TYPO3 v14 supports XLIFF 2.x and prefers it for new projects.
- TYPO3 changelog: TYPO3 14.2 supports ICU MessageFormat for named translation arguments.

## Findings

- Composer still allows TYPO3 13 via `^13.4 || ^14.0`.
- ext_emconf still allows TYPO3 `13.4.0-14.99.99`.
- PHPStan config uses numeric level 10 and direct phpstan-typo3 3.x includes.
- PHPUnit currently allows 10.x and TYPO3 testing-framework 8.x, both no longer needed for TYPO3 14-only support.
- Composer platform pins PHP 8.2.0, which blocks checking current PHP 8.5 compatibility assumptions.
- Language resources are still XLIFF 1.2.
- Chat Fluid template and backend UI text need a localization pass for remaining hardcoded labels.
- README and Documentation need explicit TYPO3 14-only requirements and updated QA commands.

## Planned Changes

- Restrict Composer dependencies to TYPO3 `^14.3` and PHP `^8.2`.
- Set ext_emconf TYPO3 constraint to `14.3.0-14.99.99`.
- Use PHPStan `level: max`, PHPStan 2.x, phpstan-typo3 3.x, PHPUnit 11.x, and TYPO3 testing-framework 9.x.
- Remove the Composer PHP platform pin unless it is required by CI.
- Convert all XLIFF files to XLIFF 2.0 with complete English/German labels.
- Replace remaining hardcoded Fluid labels with `f:translate`.
- Update README and Documentation for TYPO3 14.

## Verification Target

- `composer validate --strict`
- `composer ci:phpstan`
- `composer ci:tests`
