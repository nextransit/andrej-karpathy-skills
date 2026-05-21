#!/usr/bin/env bash
# sync-check.sh — Verify content synchronization between three core files.
# 
# The following files must be kept in sync with the same four principles content:
#   - CLAUDE.md
#   - .cursor/rules/karpathy-guidelines.mdc
#   - skills/karpathy-guidelines/SKILL.md
#
# This script extracts the core content from each file (strips frontmatter and
# heading markers) and reports drift between them.

set -euo pipefail

CLAUDE="CLAUDE.md"
CURSOR_RULE=".cursor/rules/karpathy-guidelines.mdc"
SKILL="skills/karpathy-guidelines/SKILL.md"

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Check all files exist
for f in "$CLAUDE" "$CURSOR_RULE" "$SKILL"; do
    if [[ ! -f "$f" ]]; then
        echo -e "${RED}ERROR: $f not found${NC}"
        exit 1
    fi
done

# Extract content from each file (strip frontmatter, normalize whitespace)
extract() {
    local file="$1"
    # Strip YAML frontmatter (--- ... ---) if present
    # Strip first heading line (# ...)
    # Normalize: collapse multiple blank lines, strip leading/trailing whitespace
    sed -e '/^---$/,/^---$/d' \
        -e 's/^# .*//' \
        -e 's/\r$//' \
        -e '/^$/N;/^\n$/D' \
        -e 's/[[:space:]]\+$//' \
        "$file"
}

echo "Extracting content from core files..."
extract "$CLAUDE" > /tmp/sync_check_claude.txt
extract "$CURSOR_RULE" > /tmp/sync_check_cursor.txt
extract "$SKILL" > /tmp/sync_check_skill.txt

DRIFT=0

# Compare CLAUDE.md vs .cursor/rules/karpathy-guidelines.mdc
echo ""
echo "Comparing CLAUDE.md vs .cursor/rules/karpathy-guidelines.mdc..."
if diff -u /tmp/sync_check_claude.txt /tmp/sync_check_cursor.txt > /tmp/sync_diff_c.txt; then
    echo -e "${GREEN}✓ CLAUDE.md and .cursor/rules/karpathy-guidelines.mdc are in sync${NC}"
else
    echo -e "${RED}✗ Content drift detected between CLAUDE.md and .cursor/rules/karpathy-guidelines.mdc${NC}"
    cat /tmp/sync_diff_c.txt
    DRIFT=1
fi

# Compare CLAUDE.md vs skills/karpathy-guidelines/SKILL.md
echo ""
echo "Comparing CLAUDE.md vs skills/karpathy-guidelines/SKILL.md..."
if diff -u /tmp/sync_check_claude.txt /tmp/sync_check_skill.txt > /tmp/sync_diff_s.txt; then
    echo -e "${GREEN}✓ CLAUDE.md and skills/karpathy-guidelines/SKILL.md are in sync${NC}"
else
    echo -e "${RED}✗ Content drift detected between CLAUDE.md and skills/karpathy-guidelines/SKILL.md${NC}"
    cat /tmp/sync_diff_s.txt
    DRIFT=1
fi

echo ""
if [[ $DRIFT -eq 1 ]]; then
    echo -e "${YELLOW}WARNING: Content synchronization issues found.${NC}"
    echo "Run 'git diff' to see the specific differences."
    echo "After fixing, run this script again to verify."
    exit 1
else
    echo -e "${GREEN}All three core files are in sync.${NC}"
    exit 0
fi