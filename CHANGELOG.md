# Changelog

All notable changes to `react-bun-ssr` are documented in this file.

## [Unreleased]

## [0.3.1] - 2026-03-03

### Fixed

- `rbssr init` now scaffolds a usable starter app out of the box.

### Changed

- Follow-up framework/docs separation cleanup after the `0.3.0` split.

## [0.3.0] - 2026-03-03

### Added

- `onNavigate` callback support in client navigation flow.
- Better deployment/docs surfaces, including `llms.txt` and docs domain updates.

### Changed

- Repository split refined: framework package and docs app concerns are more explicitly isolated.
- Metadata/head rendering behavior tightened (deduplication and title handling improvements).

### Fixed

- Production build path now consistently forces production `NODE_ENV` semantics.
- Response header config now supports dropping default `cache-control` per route.

## [0.2.0] - 2026-03-02

### Changed

- Internal runtime and build optimizations landed as the main theme of this release.
- CI and release plumbing were hardened for trusted npm publishing.

## [0.1.2] - 2026-03-01

### Changed

- CI pipeline refresh and workflow refinements.

## [0.1.1] - 2026-03-01

### Added

- First tagged public release line for `0.1.x`.

> Note: there is no separate `v0.1.0` tag in this repository. `0.1.x` history begins at `v0.1.1`.

[Unreleased]: https://github.com/react-formation/react-bun-ssr/compare/v0.3.1...HEAD
[0.3.1]: https://github.com/react-formation/react-bun-ssr/compare/v0.3.0...v0.3.1
[0.3.0]: https://github.com/react-formation/react-bun-ssr/compare/v0.2.0...v0.3.0
[0.2.0]: https://github.com/react-formation/react-bun-ssr/compare/v0.1.2...v0.2.0
[0.1.2]: https://github.com/react-formation/react-bun-ssr/compare/v0.1.1...v0.1.2
[0.1.1]: https://github.com/react-formation/react-bun-ssr/releases/tag/v0.1.1
