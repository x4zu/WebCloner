# Security Policy

## Supported versions

Security fixes are applied to the latest release of the `webclone` plugin on
the `main` branch.

Projects created by `/webclone` do not receive fixes automatically. Their
maintainers are responsible for reviewing relevant changes and updating their
own copies.

## Reporting a vulnerability

Please do not disclose vulnerability details in a public issue, pull request,
discussion, or Discord message.

Use GitHub's private
[Report a vulnerability](https://github.com/x4zu/WebCloner/security/advisories/new)
form instead. Include, when available:

- A clear description of the vulnerability and its potential impact
- The affected files, dependencies, configuration, or commit
- Steps to reproduce the issue or a minimal proof of concept
- Any suggested mitigation or fix

We will acknowledge the report as soon as practical, investigate it, and
coordinate with you before any public disclosure.

## Scope

Security reports may cover:

- Code and dependencies shipped on the `main` branch
- The scaffold and capture scripts under `skills/webclone/scripts/`
- Plugin configuration or template defaults that could make generated projects
  insecure
- AI-agent instructions that introduce a concrete security vulnerability

Generated website code, third-party services, vulnerabilities in unrelated
websites, and automated audit output without a demonstrated impact on this
plugin are outside this project's security scope.

## Responsible use

This plugin is intended for authorized development, migration, recovery, and
learning. See [Responsible use](README.md#responsible-use) for prohibited
uses. Reports about abuse or copied content should not include sensitive
security details in public channels.
