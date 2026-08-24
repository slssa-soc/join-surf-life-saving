#!/usr/bin/env python3
"""
Rename _clubs Markdown files to match their current front-matter slug.

Dry run:
    py scripts/rename_club_files_to_slsc.py

Apply:
    py scripts/rename_club_files_to_slsc.py --apply

This script only renames Markdown files. It does not rename club images.
"""

from __future__ import annotations

import argparse
import re
from pathlib import Path

SLUG_RE = re.compile(r"(?m)^slug:\s*['\"]?([^'\"\n]+)['\"]?\s*$")


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--apply", action="store_true")
    parser.add_argument("--club-dir", default="_clubs")
    args = parser.parse_args()

    club_dir = Path.cwd() / args.club_dir
    if not club_dir.is_dir():
        raise SystemExit(f"{club_dir} does not exist. Run from the repository root.")

    changes = 0
    errors = 0

    for path in sorted(club_dir.glob("*.md")):
        text = path.read_text(encoding="utf-8")
        match = SLUG_RE.search(text)
        if not match:
            print(f"[SKIP] No slug: {path.name}")
            continue

        slug = match.group(1).strip()
        target = path.with_name(f"{slug}.md")

        if target == path:
            continue

        if target.exists():
            print(f"[ERROR] Target already exists: {target.name}")
            errors += 1
            continue

        if args.apply:
            path.rename(target)
            print(f"[RENAMED] {path.name} -> {target.name}")
        else:
            print(f"[WOULD RENAME] {path.name} -> {target.name}")
        changes += 1

    print()
    print(f"{'Would rename' if not args.apply else 'Renamed'}: {changes} file(s)")
    if errors:
        print(f"Conflicts/errors: {errors}")
    if not args.apply:
        print("Dry run only. To apply:")
        print("  py scripts/rename_club_files_to_slsc.py --apply")

    return 1 if errors else 0


if __name__ == "__main__":
    raise SystemExit(main())
