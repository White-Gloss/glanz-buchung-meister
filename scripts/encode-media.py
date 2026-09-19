#!/usr/bin/env python3
"""Encode atelier masters to AVIF/WebP/JPEG srcsets (parallel)."""
from __future__ import annotations

import subprocess
from concurrent.futures import ThreadPoolExecutor, as_completed
from pathlib import Path

from PIL import Image

ROOT = Path("/workspace")
OUT = ROOT / "public" / "media"
SRC = ROOT / "artifacts" / "masters"

MASTERS = {
    "hero": SRC / "hero-master.jpg",
    "private": SRC / "private-master.jpg",
    "lack": SRC / "lack-master.jpg",
    "felgen": SRC / "felgen-master.jpg",
    "atelier": SRC / "atelier-master.jpg",
    "finish": SRC / "finish-master.jpg",
    "leder": SRC / "leder-master.jpg",
    "keramik": SRC / "keramik-master.jpg",
}


def rgb(im: Image.Image) -> Image.Image:
    return im.convert("RGB") if im.mode != "RGB" else im


def fit_width(im: Image.Image, width: int) -> Image.Image:
    im = rgb(im)
    w, h = im.size
    if w == width:
        return im
    return im.resize((width, max(1, round(h * (width / w)))), Image.Resampling.LANCZOS)


def save_jpg(im: Image.Image, path: Path, quality: int = 82) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    im.save(path, "JPEG", quality=quality, optimize=True, progressive=True)


def ffmpeg_still(src: Path, dest: Path, kind: str) -> None:
    if kind == "webp":
        extra = ["-c:v", "libwebp", "-quality", "78"]
    else:
        extra = [
            "-c:v",
            "libaom-av1",
            "-crf",
            "34",
            "-cpu-used",
            "8",
            "-still-picture",
            "1",
            "-usage",
            "allintra",
        ]
    subprocess.run(
        ["ffmpeg", "-y", "-i", str(src), "-an", "-frames:v", "1", *extra, str(dest)],
        check=True,
        stdout=subprocess.DEVNULL,
        stderr=subprocess.DEVNULL,
    )


def job(name: str, width: int, outputs: dict[str, Path]) -> str:
    im = Image.open(MASTERS[name])
    resized = fit_width(im, width)
    tmp = OUT / f"_{name}-{width}.jpg"
    save_jpg(resized, tmp, 86)
    if "jpg" in outputs:
        save_jpg(resized, outputs["jpg"], 82)
    ffmpeg_still(tmp, outputs["webp"], "webp")
    ffmpeg_still(tmp, outputs["avif"], "avif")
    tmp.unlink(missing_ok=True)
    return f"{name}@{width}"


def main() -> None:
    OUT.mkdir(parents=True, exist_ok=True)
    tasks: list[tuple[str, int, dict[str, Path]]] = [
        ("hero", 720, {"webp": OUT / "hero-720.webp", "avif": OUT / "hero-720.avif"}),
        ("hero", 1080, {"webp": OUT / "hero-1080.webp", "avif": OUT / "hero-1080.avif"}),
        (
            "hero",
            1600,
            {
                "jpg": OUT / "hero.jpg",
                "webp": OUT / "hero-1600.webp",
                "avif": OUT / "hero-1600.avif",
            },
        ),
    ]
    for name in ("private", "lack", "felgen", "atelier", "finish", "leder", "keramik"):
        tasks.append(
            (
                name,
                800,
                {"webp": OUT / f"{name}-800.webp", "avif": OUT / f"{name}-800.avif"},
            )
        )
        tasks.append(
            (
                name,
                1200,
                {
                    "jpg": OUT / f"{name}.jpg",
                    "webp": OUT / f"{name}.webp",
                    "avif": OUT / f"{name}.avif",
                },
            )
        )

    with ThreadPoolExecutor(max_workers=4) as pool:
        futs = [pool.submit(job, n, w, o) for n, w, o in tasks]
        for fut in as_completed(futs):
            print("done", fut.result(), flush=True)

    (OUT / "hero.webp").write_bytes((OUT / "hero-1600.webp").read_bytes())
    (OUT / "hero.avif").write_bytes((OUT / "hero-1600.avif").read_bytes())
    for name in ("private", "lack", "felgen", "atelier", "finish", "leder", "keramik"):
        (OUT / f"{name}-1200.webp").write_bytes((OUT / f"{name}.webp").read_bytes())
        (OUT / f"{name}-1200.avif").write_bytes((OUT / f"{name}.avif").read_bytes())

    im = Image.open(MASTERS["hero"])
    wim = fit_width(im, 1200)
    oh = 630
    if wim.height >= oh:
        top = (wim.height - oh) // 2
        og = wim.crop((0, top, 1200, top + oh))
    else:
        og = wim.resize((1200, 630), Image.Resampling.LANCZOS)
    save_jpg(og, ROOT / "public" / "og.jpg", 80)
    print("og.jpg written", flush=True)


if __name__ == "__main__":
    main()
