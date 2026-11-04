#!/usr/bin/env python3
"""Fetch SAM 3D Body checkpoints from Hugging Face and stage them for Modal.

Source: gated repo `facebookresearch/sam-3d-body`.
  1. Request access at https://huggingface.co/facebookresearch/sam-3d-body
  2. Create a read token at https://huggingface.co/settings/tokens
  3. Run:  HF_TOKEN=hf_... python modal/fetch_ckpts.py [--upload]

What it does:
  - snapshot_downloads the repo into ./ckpts/sam-3d-body-vith/
  - verifies (or reconstructs) the layout Modal expects:
        ckpts/sam-3d-body-vith/model.ckpt
        ckpts/sam-3d-body-vith/assets/mhr_model.pt
  - prints the `modal volume put` commands; with --upload it runs them.

Requires: pip install huggingface_hub   (modal CLI only needed for --upload)
"""

from __future__ import annotations

import argparse
import os
import shutil
import subprocess
import sys

REPO = "facebookresearch/sam-3d-body"
DEST = os.path.join("ckpts", "sam-3d-body-vith")
NEEDED = {
    "model.ckpt": os.path.join(DEST, "model.ckpt"),
    "mhr_model.pt": os.path.join(DEST, "assets", "mhr_model.pt"),
}


def find_by_name(root: str, name: str) -> str | None:
    for dirpath, _dirnames, filenames in os.walk(root):
        if name in filenames:
            return os.path.join(dirpath, name)
    return None


def main() -> int:
    ap = argparse.ArgumentParser(description="Fetch SAM 3D Body checkpoints from Hugging Face.")
    ap.add_argument("--upload", action="store_true", help="Also run `modal volume put` for both files.")
    ap.add_argument("--repo", default=REPO, help="HF repo id (override for forks/mirrors).")
    ap.add_argument("--dest", default=DEST, help="Local checkout dir (mirrors the Modal volume layout).")
    args = ap.parse_args()

    token = os.environ.get("HF_TOKEN") or os.environ.get("HUGGING_FACE_HUB_TOKEN")
    if not token:
        print("error: set HF_TOKEN (read token with access to the gated repo).", file=sys.stderr)
        print(f"Request access: https://huggingface.co/{args.repo}", file=sys.stderr)
        return 1

    try:
        from huggingface_hub import snapshot_download
    except ImportError:
        print("error: pip install huggingface_hub", file=sys.stderr)
        return 1

    print(f"downloading {args.repo} -> {args.dest} ...")
    snapshot_download(repo_id=args.repo, local_dir=args.dest, token=token)

    ok = True
    for name, want in NEEDED.items():
        want = want if want.startswith(args.dest) else os.path.join(args.dest, os.path.relpath(want, DEST))
        if os.path.exists(want):
            print(f"ok: {want} ({os.path.getsize(want) / 1e6:.0f} MB)")
            continue
        found = find_by_name(args.dest, name)
        if not found:
            print(f"MISSING: {name} not found anywhere under {args.dest}", file=sys.stderr)
            ok = False
            continue
        os.makedirs(os.path.dirname(want), exist_ok=True)
        shutil.copy2(found, want)
        print(f"ok: copied {found} -> {want} ({os.path.getsize(want) / 1e6:.0f} MB)")

    if not ok:
        return 1

    put_cmds = [
        ["modal", "volume", "put", "sam3db-ckpts", os.path.join(args.dest, "model.ckpt"), "/sam-3d-body-vith/model.ckpt"],
        ["modal", "volume", "put", "sam3db-ckpts", os.path.join(args.dest, "assets", "mhr_model.pt"), "/sam-3d-body-vith/assets/mhr_model.pt"],
    ]
    if args.upload:
        for cmd in put_cmds:
            print("+", " ".join(cmd))
            subprocess.run(cmd, check=True)
        subprocess.run(["modal", "volume", "ls", "sam3db-ckpts"], check=True)
    else:
        print("\nNext — upload to the Modal volume (or re-run with --upload):")
        for cmd in put_cmds:
            print(" ", " ".join(cmd))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
