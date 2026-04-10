#!/usr/bin/env python3
"""Trim completed sections from ROADMAP_ACTIVE.md into ROADMAP_ARCHIVE.md.

Detects ### subsections with ✅ in their heading and no open [ ] items.
Dry-run by default — pass --execute to write files.

Usage:
    python scripts/trim_roadmap.py                          # dry run
    python scripts/trim_roadmap.py --execute                # apply
    python scripts/trim_roadmap.py --execute --roadmap X --archive Y
"""
from __future__ import annotations

import argparse
import re
import sys
from datetime import date
from pathlib import Path

OPEN_ITEM_RE = re.compile(r"^\s*- \[ \]")

# ## sections that are never inspected for trimming
PROTECTED_KEYWORDS = [
    "vision",
    "market context",
    "monetization",
    "daniele",
    "action items",
    "phase 3.5",
    "phase 4",
    "phase 5",
    "phase 6",
    "phase 7",
    "phase 8",
    "backlog",
    "non-negotiable",
]


def _is_protected(header: str) -> bool:
    lower = header.lower()
    return any(kw in lower for kw in PROTECTED_KEYWORDS)


def _heading_level(line: str) -> int | None:
    """Return 2 for ##, 3 for ###, None otherwise."""
    if line.startswith("### "):
        return 3
    if line.startswith("## "):
        return 2
    return None


def parse_sections(lines: list[str]) -> list[dict]:
    """Split lines into a list of ## sections, each with ### subsections.

    Returns list of dicts:
        {
            "header_line": str,           # the ## line
            "header_idx": int,            # index in original lines
            "preamble": [str, ...],       # lines between ## header and first ###
            "subsections": [
                {"header_line": str, "header_idx": int, "body": [str, ...]},
                ...
            ],
        }
    Top-level lines before the first ## are returned as a section with
    header_line="" and header_idx=-1.
    """
    sections: list[dict] = []
    current_section: dict | None = None
    current_sub: dict | None = None

    for i, line in enumerate(lines):
        level = _heading_level(line)

        if level == 2:
            # Close previous subsection / section
            if current_sub and current_section:
                current_section["subsections"].append(current_sub)
                current_sub = None
            if current_section is not None:
                sections.append(current_section)

            current_section = {
                "header_line": line,
                "header_idx": i,
                "preamble": [],
                "subsections": [],
            }

        elif level == 3:
            if current_section is None:
                current_section = {
                    "header_line": "",
                    "header_idx": -1,
                    "preamble": [],
                    "subsections": [],
                }
            if current_sub:
                current_section["subsections"].append(current_sub)
            current_sub = {"header_line": line, "header_idx": i, "body": []}

        else:
            if current_sub:
                current_sub["body"].append(line)
            elif current_section:
                current_section["preamble"].append(line)
            else:
                # Lines before first ## header
                if not sections and current_section is None:
                    current_section = {
                        "header_line": "",
                        "header_idx": -1,
                        "preamble": [line],
                        "subsections": [],
                    }
                elif current_section:
                    current_section["preamble"].append(line)

    # Flush remaining
    if current_sub and current_section:
        current_section["subsections"].append(current_sub)
    if current_section is not None:
        sections.append(current_section)

    return sections


def _sub_is_archivable(sub: dict) -> bool:
    """A ### subsection is archivable if heading has ✅ and no open [ ] items."""
    if "\u2705" not in sub["header_line"]:  # ✅
        return False
    for line in sub["body"]:
        if OPEN_ITEM_RE.match(line):
            return False
    return True


def _section_lines(sub: dict) -> list[str]:
    """Return all lines of a subsection including its header."""
    return [sub["header_line"]] + sub["body"]


def _collapse_blank_runs(lines: list[str], max_consecutive: int = 2) -> list[str]:
    """Collapse runs of blank lines to at most max_consecutive."""
    result: list[str] = []
    blank_count = 0
    for line in lines:
        if line.strip() == "":
            blank_count += 1
            if blank_count <= max_consecutive:
                result.append(line)
        else:
            blank_count = 0
            result.append(line)
    # Strip trailing blanks
    while result and result[-1].strip() == "":
        result.pop()
    return result


def trim_roadmap(
    roadmap_path: Path,
    archive_path: Path,
    execute: bool = False,
) -> dict:
    """Main entry point. Returns a summary dict."""
    lines = roadmap_path.read_text().splitlines(keepends=True)
    # Normalise: work with lines without trailing newline, re-add on write
    raw_lines = [l.rstrip("\n") for l in roadmap_path.read_text().splitlines()]

    sections = parse_sections(raw_lines)
    original_line_count = len(raw_lines)

    archived_blocks: list[dict] = []  # {"heading": str, "lines": [str], "start": int, "end": int}
    skipped: list[dict] = []
    protected: list[str] = []

    for section in sections:
        header = section["header_line"]

        # Skip pre-header content
        if not header:
            continue

        # Protected sections
        if _is_protected(header):
            protected.append(header.strip())
            continue

        # Special: ## Completed → archive entire section
        if header.strip().startswith("## Completed"):
            all_lines = [header] + section["preamble"]
            for sub in section["subsections"]:
                all_lines.extend(_section_lines(sub))
            archived_blocks.append({
                "heading": header.strip(),
                "lines": all_lines,
                "start": section["header_idx"],
            })
            continue

        # Inspect ### subsections
        for sub in section["subsections"]:
            if "\u2705" not in sub["header_line"]:
                continue  # no checkmark, skip

            if _sub_is_archivable(sub):
                archived_blocks.append({
                    "heading": sub["header_line"].strip(),
                    "lines": _section_lines(sub),
                    "start": sub["header_idx"],
                })
            else:
                # Has ✅ but also has open items
                open_count = sum(
                    1 for l in sub["body"] if OPEN_ITEM_RE.match(l)
                )
                skipped.append({
                    "heading": sub["header_line"].strip(),
                    "open_count": open_count,
                })

    # Count archivable lines
    archived_line_count = sum(len(b["lines"]) for b in archived_blocks)

    # --- DRY RUN OUTPUT ---
    print(f"trim_roadmap.py — {'Executing' if execute else 'Dry Run'}")
    print("=" * 40)
    print()
    print(f"Scanning: {roadmap_path} ({original_line_count} lines)")
    print()

    if not archived_blocks:
        print("No archivable sections found. Roadmap is already trimmed.")
        return {
            "archived_count": 0,
            "archived_lines": 0,
            "original_lines": original_line_count,
            "new_lines": original_line_count,
        }

    print(f"Archivable sections found: {len(archived_blocks)}")
    print()
    for i, block in enumerate(archived_blocks, 1):
        print(f"  {i}. {block['heading']} ({len(block['lines'])} lines)")
    print()
    print(f"Total: ~{archived_line_count} lines to archive "
          f"({archived_line_count * 100 // original_line_count}% of file)")
    print()

    if skipped:
        print(f"Skipped (has ✅ heading but open [ ] items):")
        for s in skipped:
            print(f"  - {s['heading']} — {s['open_count']} open items")
        print()

    if protected:
        print(f"Protected sections (not inspected):")
        for p in protected:
            print(f"  - {p}")
        print()

    if not execute:
        print("Run with --execute to apply.")
        return {
            "archived_count": len(archived_blocks),
            "archived_lines": archived_line_count,
            "original_lines": original_line_count,
            "new_lines": original_line_count - archived_line_count,
        }

    # --- BUILD ARCHIVE ---
    archive_content = ""
    if archive_path.exists():
        archive_content = archive_path.read_text()

    today = date.today().isoformat()
    new_archive = f"\n---\n### Archived {today}\n\n"
    for block in archived_blocks:
        for line in block["lines"]:
            new_archive += line + "\n"
        new_archive += "\n"

    archive_content += new_archive

    # --- BUILD TRIMMED ROADMAP ---
    # Collect line indices to remove
    lines_to_remove: set[int] = set()
    for block in archived_blocks:
        start = block["start"]
        count = len(block["lines"])
        for j in range(start, start + count):
            if j < len(raw_lines):
                lines_to_remove.add(j)

    trimmed = [line for i, line in enumerate(raw_lines) if i not in lines_to_remove]

    # Remove empty ## sections (header + only blank lines / --- remaining)
    trimmed = _remove_empty_sections(trimmed)

    # Collapse blank line runs
    trimmed = _collapse_blank_runs(trimmed)

    # --- VERIFY ---
    original_open = [l for l in raw_lines if OPEN_ITEM_RE.match(l)]
    trimmed_open = [l for l in trimmed if OPEN_ITEM_RE.match(l)]

    if len(original_open) != len(trimmed_open):
        lost = len(original_open) - len(trimmed_open)
        print(f"ABORT: Would lose {lost} open [ ] items! Not writing files.")
        sys.exit(1)

    # Check no archived block has open items (redundant but safe)
    for block in archived_blocks:
        for line in block["lines"]:
            if OPEN_ITEM_RE.match(line):
                print(f"ABORT: Archived block contains open item: {line.strip()}")
                sys.exit(1)

    # --- WRITE ---
    roadmap_path.write_text("\n".join(trimmed) + "\n")
    archive_path.write_text(archive_content)

    new_line_count = len(trimmed)
    print(f"Archived {len(archived_blocks)} sections ({archived_line_count} lines) "
          f"to {archive_path}")
    print(f"Trimmed {roadmap_path}: {original_line_count} → {new_line_count} lines")
    print()
    print("Verification:")
    print(f"  ✅ All {len(archived_blocks)} section headings written to archive")
    print(f"  ✅ No [ ] items lost ({len(original_open)} open items preserved)")
    print(f"  ✅ Protected sections untouched")

    return {
        "archived_count": len(archived_blocks),
        "archived_lines": archived_line_count,
        "original_lines": original_line_count,
        "new_lines": new_line_count,
    }


def _remove_empty_sections(lines: list[str]) -> list[str]:
    """Remove ## headers that have no content (only blanks/--- until next ## or EOF)."""
    result: list[str] = []
    i = 0
    while i < len(lines):
        if _heading_level(lines[i]) == 2:
            # Look ahead: is there any real content before next ##?
            j = i + 1
            has_content = False
            while j < len(lines):
                if _heading_level(lines[j]) == 2:
                    break
                if lines[j].strip() and lines[j].strip() != "---":
                    has_content = True
                    break
                j += 1
            if has_content:
                result.append(lines[i])
            # else: skip this ## header (empty section)
            i += 1
        else:
            result.append(lines[i])
            i += 1
    return result


def main():
    parser = argparse.ArgumentParser(
        description="Trim completed sections from the roadmap into an archive."
    )
    parser.add_argument(
        "--execute",
        action="store_true",
        help="Actually write files (default is dry-run)",
    )
    parser.add_argument(
        "--roadmap",
        default="ROADMAP_ACTIVE.md",
        help="Path to roadmap file (default: ROADMAP_ACTIVE.md)",
    )
    parser.add_argument(
        "--archive",
        default="ROADMAP_ARCHIVE.md",
        help="Path to archive file (default: ROADMAP_ARCHIVE.md)",
    )
    args = parser.parse_args()

    roadmap_path = Path(args.roadmap)
    archive_path = Path(args.archive)

    if not roadmap_path.exists():
        print(f"Error: {roadmap_path} not found", file=sys.stderr)
        sys.exit(1)

    trim_roadmap(roadmap_path, archive_path, execute=args.execute)


if __name__ == "__main__":
    main()
