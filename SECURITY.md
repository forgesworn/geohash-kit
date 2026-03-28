# Security Policy

## Supported Versions

| Version | Supported |
|---------|-----------|
| 1.x     | Yes       |

## Reporting a Vulnerability

If you discover a security vulnerability in geohash-kit, please report it responsibly:

1. **Do not** open a public GitHub issue.
2. Email **thecryptodonkey@proton.me** with a description of the vulnerability, steps to reproduce, and any relevant proof-of-concept code.
3. You will receive an acknowledgement within 48 hours.
4. A fix will be developed privately and released as a patch version. You will be credited in the release notes unless you prefer otherwise.

## Scope

geohash-kit is a pure computation library with zero runtime dependencies and no network or filesystem access. The primary attack surface is:

- **Input validation bypass** — malformed coordinates, geohash strings, or polygon data causing unexpected behaviour.
- **Denial of service** — crafted inputs that trigger excessive memory allocation or CPU usage (e.g. polygon coverage with extreme parameters).
- **Prototype pollution** — manipulated inputs that could pollute `Object.prototype` (mitigated since v1.5.1).

## Security Hardening

- All public APIs validate inputs and throw `RangeError` or `TypeError` on invalid parameters.
- Ring expansion is capped at 10 rings to prevent runaway memory allocation.
- `polygonToGeohashes` enforces a `maxCells` budget and throws `RangeError` if the polygon cannot be covered within budget.
- Base32 decoding uses a frozen lookup object to prevent prototype pollution.
