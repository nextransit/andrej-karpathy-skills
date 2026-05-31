# Changelog

All notable changes to AI Skill Installer are documented here.

## 1.1.5 - 2026-05-31

- Renamed the VS Code display name to AI Skill Installer to match the current product behavior.
- Updated Marketplace command titles and README copy around skill discovery, skill installation, and Karpathy fallback behavior.
- Added this changelog to the packaged VSIX.

## 1.1.4 - 2026-05-31

- Added popular GitHub AI skill discovery for repositories updated in the last 30 days.
- Kept Karpathy Guidelines as the built-in default and fallback when GitHub is unavailable or slow.
- Added a refresh action for popular GitHub skills.
- Added a skill picker with aligned names, source labels, star counts, and 5-level yellow popularity badges.
- Updated the install dialog title, description, and detail panel when switching skills.
- Installed selected skills as real `SKILL.md` files under `skills/<skill-slug>/SKILL.md` instead of writing them into `CLAUDE.md` or `AGENTS.md`.

## 1.1.3 - 2026-05-31

- Added OpenCode support to the supported AI coding tool list.
- Improved cross-tool config generation around shared skill content.
