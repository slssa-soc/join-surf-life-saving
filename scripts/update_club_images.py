#!/usr/bin/env python3
"""
Install the extracted club profile images into the Jekyll site and update each
club page's `image:` front-matter value.

Expected setup:
    repository-root/
      _clubs/
      assets/img/clubs/
      club-profile-images/       <- unzip the supplied image pack here
      scripts/update_club_images.py

Dry run:
    py scripts/update_club_images.py

Apply:
    py scripts/update_club_images.py --apply

Custom source folder:
    py scripts/update_club_images.py --source-dir "C:/path/to/club-profile-images" --apply

The script:
- finds club pages by front-matter title;
- copies the supplied extracted image into assets/img/clubs/;
- changes only the `image` front-matter field;
- creates backups before overwriting;
- leaves old image files in place for safe manual cleanup later.
"""

from __future__ import annotations

import argparse
import re
import shutil
import sys
from datetime import datetime
from pathlib import Path

try:
    import yaml
except ImportError:
    raise SystemExit(
        "PyYAML is required. Install it with:\n"
        "  py -m pip install pyyaml"
    )

IMAGE_MAP = {'Aldinga Bay Surf Life Saving Club': 'aldinga-bay-slsc.jpg', 'Beachport Surf Life Saving Club': 'beachport-slsc.jpg', 'Brighton Surf Life Saving Club': 'brighton-slsc.jpg', 'Chiton Rocks Surf Life Saving Club': 'chiton-rocks-slsc.jpg', 'Christies Beach Surf Life Saving Club': 'christies-beach-slsc.jpg', 'Elizabeth Life Saving Club': 'elizabeth-lsc.png', 'Glenelg Surf Life Saving Club': 'glenelg-slsc.jpg', 'Goolwa Surf Life Saving Club': 'goolwa-slsc.jpg', 'Grange Surf Life Saving Club': 'grange-slsc.png', 'Henley Surf Life Saving Club': 'henley-slsc.jpg', 'Moana Surf Life Saving Club': 'moana-slsc.jpg', 'Murray Bridge Life Saving Club': 'murray-bridge-lsc.jpg', 'Normanville Surf Life Saving Club': 'normanville-slsc.jpg', 'Port Elliot Surf Life Saving Club': 'port-elliot-slsc.jpg', 'Port Noarlunga Surf Life Saving Club': 'port-noarlunga-slsc.jpg', 'Robe Surf Life Saving Club': 'robe-slsc.png', 'Seacliff Surf Life Saving Club': 'seacliff-slsc.png', 'Semaphore Surf Life Saving Club': 'semaphore-slsc.jpg', 'South Port Surf Life Saving Club': 'south-port-slsc.jpg', 'West Beach Surf Life Saving Club': 'west-beach-slsc.png', 'Whyalla Surf Life Saving Club': 'whyalla-slsc.jpg', 'Somerton Surf Life Saving Club': 'somerton-slsc.jpg'}

FRONT_MATTER_RE = re.compile(r"\A---\s*\n(.*?)\n---\s*\n?", re.DOTALL)


def normalise(value: str | None) -> str:
    return re.sub(r"[^a-z0-9]+", "", (value or "").lower())


def split_page(text: str) -> tuple[dict, str]:
    match = FRONT_MATTER_RE.match(text)
    if not match:
        raise ValueError("No YAML front matter found")
    meta = yaml.safe_load(match.group(1)) or {}
    return meta, text[match.end():]


def dump_page(meta: dict, body: str) -> str:
    yaml_text = yaml.safe_dump(
        meta,
        sort_keys=False,
        allow_unicode=True,
        width=120,
        default_flow_style=False,
    ).rstrip()
    return f"---\n{yaml_text}\n---\n\n{body.lstrip()}"


def find_page(club_dir: Path, title: str) -> Path | None:
    target = normalise(title)
    for path in sorted(club_dir.glob("*.md")):
        try:
            meta, _ = split_page(path.read_text(encoding="utf-8"))
        except Exception:
            continue
        if normalise(str(meta.get("title", ""))) == target:
            return path
    return None


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--apply", action="store_true", help="Copy images and update pages. Default is dry run.")
    parser.add_argument("--source-dir", default="club-profile-images")
    parser.add_argument("--club-dir", default="_clubs")
    parser.add_argument("--image-dir", default="assets/img/clubs")
    args = parser.parse_args()

    root = Path.cwd()
    source_dir = Path(args.source_dir)
    if not source_dir.is_absolute():
        source_dir = root / source_dir

    club_dir = root / args.club_dir
    destination_dir = root / args.image_dir

    if not source_dir.is_dir():
        print(f"ERROR: image source folder not found: {source_dir}", file=sys.stderr)
        return 2
    if not club_dir.is_dir():
        print(f"ERROR: club folder not found: {club_dir}", file=sys.stderr)
        return 2

    backup_root = None
    if args.apply:
        stamp = datetime.now().strftime("%Y%m%d-%H%M%S")
        backup_root = root / "_club_image_backups" / stamp
        (backup_root / "pages").mkdir(parents=True, exist_ok=True)
        (backup_root / "images").mkdir(parents=True, exist_ok=True)
        destination_dir.mkdir(parents=True, exist_ok=True)

    changes = 0
    errors = 0

    for title, filename in IMAGE_MAP.items():
        source = source_dir / filename
        if not source.exists():
            print(f"[ERROR] Missing source image: {source}")
            errors += 1
            continue

        page = find_page(club_dir, title)
        if page is None:
            print(f"[ERROR] Club page not found: {title}")
            errors += 1
            continue

        original = page.read_text(encoding="utf-8")
        meta, body = split_page(original)
        destination = destination_dir / filename
        new_web_path = "/" + destination.relative_to(root).as_posix()
        old_web_path = meta.get("image")

        print(f"[{'APPLY' if args.apply else 'DRY RUN'}] {title}")
        print(f"  image: {old_web_path} -> {new_web_path}")
        print(f"  copy:  {source} -> {destination}")

        if args.apply:
            assert backup_root is not None
            shutil.copy2(page, backup_root / "pages" / page.name)

            if destination.exists():
                shutil.copy2(destination, backup_root / "images" / destination.name)

            shutil.copy2(source, destination)
            meta["image"] = new_web_path
            page.write_text(dump_page(meta, body), encoding="utf-8")

        changes += 1

    print()
    print(f"{'Applied' if args.apply else 'Would apply'} image updates: {changes}")
    if errors:
        print(f"Errors: {errors}")
    if backup_root:
        print(f"Backups: {backup_root}")
    if not args.apply:
        print()
        print("Dry run only. Apply with:")
        print("  py scripts/update_club_images.py --apply")

    return 1 if errors else 0


if __name__ == "__main__":
    raise SystemExit(main())
