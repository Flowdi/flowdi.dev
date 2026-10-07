# Security policy

## Supported version

Security fixes are applied to the current `main` branch and the production deployment at [flowdi.dev](https://flowdi.dev).

## Reporting a vulnerability

Please do not disclose a suspected vulnerability in a public issue. Report it privately to the repository owner through GitHub, preferably with:

- the affected URL or component
- steps to reproduce the issue
- the expected and observed behavior
- any proof of concept that does not expose third-party data

Reports will be reviewed before details are shared publicly. Never test against data, accounts or infrastructure you do not own or have explicit permission to assess.

## Security controls

The production Worker enforces a restrictive Content Security Policy, anti-framing protections, HTTPS-only transport, limited browser permissions, cross-origin isolation and method restrictions. Automated checks validate these controls before changes are merged or deployed.
