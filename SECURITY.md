# Security Policy

AgentScore is an MCP package security trust layer. This document describes how to report security issues with AgentScore itself, and how to report detection-accuracy problems with the scanner.

## Supported Versions

The current published version on npm is `@agentscore-xyz/mcp-server` v2.2.x. Older versions are not patched.

## Reporting a Vulnerability

**For genuine security issues** (live credentials in our infrastructure, RCE, auth bypass, secrets exposed in our code, etc.):

- Email: `security@agentscores.xyz`
- Same address is published in https://agentscores.xyz/.well-known/security.txt per RFC 9116
- Do not include secret values in the first message; we will coordinate a secure channel for those
- Acknowledged within 72 hours

We follow standard responsible-disclosure practice. Public disclosure timelines depend on severity and remediation availability.

## Reporting a Scanner Detection Issue

**For detection-accuracy problems** (false positives, missed findings, mis-categorised severity, mitigator gaps):

- Open a public issue on this repository with a `scanner:` prefix in the title
- Include: package name + version, the finding type (e.g. `command_injection`, `unsafe_eval`, `hardcoded_secret`), what you believe the correct categorisation is, and a minimal reproduction (the source pattern that's matching, ideally with a file:line reference)
- Example: `scanner: command_injection false positive on db.exec() in package X`

Detection-accuracy reports do not need confidentiality. They make the scanner better for everyone and are tracked publicly.

A recent example of how this works: [HomenShum/nodebench-ai#8](https://github.com/HomenShum/nodebench-ai/issues/8) led to two scanner mitigators shipping the same day in [Thezenmonster/agentscores@4ee2659](https://github.com/Thezenmonster/agentscores/commit/4ee2659).

## What Counts as What

| Class | Channel | Example |
|---|---|---|
| Security disclosure | `security@agentscores.xyz` | "Your scanner exposed an internal API key in /api/scan responses" |
| Scanner false positive | Public issue, `scanner:` prefix | "Your scanner flags `db.exec(\`SQL\`)` as command_injection. better-sqlite3 is not shell." |
| Scanner false negative | Public issue, `scanner:` prefix | "Package X ships malware in postinstall and your scanner missed it" |
| Privacy concern | `security@agentscores.xyz` | "Your fingerprinting telemetry collects more than you say it does" |
| Operational issue | Issue on the main repo | "/api/health returns stale data after 1h" |
| Feature request | Issue on the main repo | "Add support for capability X" |

If a report falls in a grey area, send to `security@agentscores.xyz` and we will route it.

## Acknowledgments

Public security advisories are at https://agentscores.xyz/security/advisories.

Detection-accuracy contributors are credited in commit messages on https://github.com/Thezenmonster/agentscores when their report leads to a scanner improvement.
