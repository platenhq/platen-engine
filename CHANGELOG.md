# Changelog

## [0.3.0](https://github.com/platenhq/platen-engine/compare/v0.2.1...v0.3.0) (2026-10-14)


### Features

* **page-flow:** warn when an unbreakable block is squeezed to zero width ([fdd9dd0](https://github.com/platenhq/platen-engine/commit/fdd9dd006862d53e0dbae690ece81297e3aeae52))
* **print:** print each sheet as a page that matches the screen ([8278394](https://github.com/platenhq/platen-engine/commit/827839465b7199b6cc454da039fbdf0dad2bdf14))
* **print:** print each sheet as a page that matches the screen ([9682819](https://github.com/platenhq/platen-engine/commit/9682819f9d6e94d1d53d5d387d280e8a02f4fc09))
* **print:** print each sheet as a page that matches the screen ([1166cfd](https://github.com/platenhq/platen-engine/commit/1166cfd7bec791bf0b086705f8215d3e2739fa80))


### Bug Fixes

* **page-flow:** stop runaway page growth from oversized nested content ([9a3aeb7](https://github.com/platenhq/platen-engine/commit/9a3aeb7867dfbb5d6c2c7504472c40191e57b9bb))
* **page-flow:** stop runaway page growth from oversized nested content ([2bc84d2](https://github.com/platenhq/platen-engine/commit/2bc84d279e84a597004e73123ee2477ed8602a8c))

## [0.2.1](https://github.com/platenhq/platen-engine/compare/v0.2.0...v0.2.1) (2026-10-13)


### Bug Fixes

* **package:** require react as a peer dependency ([ddb0f62](https://github.com/platenhq/platen-engine/commit/ddb0f62bf52d52dfd7585eae9ee8d8d96ef0ff97))
* **package:** require react as a peer dependency ([3674f87](https://github.com/platenhq/platen-engine/commit/3674f879a718be81afb1bb853d1857105e2afa77))

## [0.2.0](https://github.com/platenhq/platen-engine/compare/v0.1.3...v0.2.0) (2026-10-13)


### ⚠ BREAKING CHANGES

* **engine:** the canvas renderer, proxies, editor adapters, engine bridge and track based sheet rendering are no longer exported. Use the paged document wrapper.

### Features

* **engine:** add table and image blocks and block level pagination experiments ([e349a72](https://github.com/platenhq/platen-engine/commit/e349a722de0199570bb0dc3e800df757f995c99a))
* **page-flow:** paginate native editable content with a float rail ([ddd3af3](https://github.com/platenhq/platen-engine/commit/ddd3af372e189cc099ec7afc9f4f2eba2873f19b))
* **page-flow:** paginate native editable content with a float rail ([d80f3f0](https://github.com/platenhq/platen-engine/commit/d80f3f073bb0fefea6831c832a195cff85c86ea9))


### Bug Fixes

* **deps:** patch high severity source map advisory in build tooling ([1d4e464](https://github.com/platenhq/platen-engine/commit/1d4e46449acd43d2a5f7609781d97bb22fbad58d))
* **release:** upgrade to node 24 and configure npm registry for oidc publish ([48d4708](https://github.com/platenhq/platen-engine/commit/48d4708746f3e69e57a9858d3d8c1ef5b696884f))


### Code Refactoring

* **engine:** remove the canvas pipeline and block margin pagination ([f567e7d](https://github.com/platenhq/platen-engine/commit/f567e7de7c7a47ceeeb8a4d610fa4ba9d1e0c616))

## [0.1.3](https://github.com/platenhq/platen-engine/compare/v0.1.2...v0.1.3) (2026-09-13)


### Bug Fixes

* **release:** remove registry url to enable tokenless oidc publish ([216dbea](https://github.com/platenhq/platen-engine/commit/216dbea9d3edc5a67ab947ac032359b1203c968c))
* **release:** remove registry url to enable tokenless oidc publish ([92c8980](https://github.com/platenhq/platen-engine/commit/92c898080d81910d5a720542fb85ffebc7941806))

## [0.1.2](https://github.com/platenhq/platen-engine/compare/0.1.1...v0.1.2) (2026-09-13)


### Bug Fixes

* **adapter:** resolve editor extraction failure and add nested node support ([f0de2d5](https://github.com/platenhq/platen-engine/commit/f0de2d523f3bec2b7641fda13a3f4b3b3c35ed49))
* **bridge:** implement reactive editor attachment and listener lifecycle ([de6e42e](https://github.com/platenhq/platen-engine/commit/de6e42e8abd195039041f890353d56bb60f41e57))
* **engine:** resolve editor extraction, bridge attachment, and accessibility issues ([b52696c](https://github.com/platenhq/platen-engine/commit/b52696cdd2923f07f80cc9f1b5365aa78751dfbf))
* **proxy:** resolve accessibility compliance violation on focused input ([0fed16c](https://github.com/platenhq/platen-engine/commit/0fed16c8a99ca11d6dbd9e2e32a057e96f0fee82))
