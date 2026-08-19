#!/usr/bin/env python3
"""Dev-time WhisperX wrapper; never imported by the runtime or renderer.

Forced-aligns a known transcript, then normalises WhisperX's version-specific
segment result into {words, chars}. The output is a cacheable build artifact;
the Python environment and models are not render dependencies.
"""

from __future__ import annotations

import argparse
import json
import os
from pathlib import Path
import sys
from typing import Any


def _timed(
    entries: Any, text_keys: tuple[str, ...]
) -> list[dict[str, Any]]:
    if not isinstance(entries, list):
        raise ValueError(f"WhisperX {text_keys[0]} entries are not an array")
    result: list[dict[str, Any]] = []
    for entry in entries:
        if not isinstance(entry, dict):
            continue
        if "start" not in entry or "end" not in entry:
            continue
        text = next(
            (
                entry[key]
                for key in text_keys
                if isinstance(entry.get(key), str)
            ),
            None,
        )
        if text is None:
            continue
        result.append(
            {
                text_keys[0]: text,
                "start": entry["start"],
                "end": entry["end"],
            }
        )
    return result


def normalise(raw: dict[str, Any]) -> dict[str, Any]:
    segments = raw.get("segments")
    if not isinstance(segments, list):
        raise ValueError("WhisperX JSON has no segments array")
    words: list[dict[str, Any]] = []
    chars: list[dict[str, Any]] = []
    for segment in segments:
        if not isinstance(segment, dict):
            continue
        words.extend(_timed(segment.get("words", []), ("text", "word")))
        chars.extend(_timed(segment.get("chars", []), ("char",)))
    if not chars:
        raise ValueError("WhisperX JSON has no timed character alignments")
    return {"words": words, "chars": chars}


def main() -> int:
    parser = argparse.ArgumentParser(
        description="Force-align a transcript with WhisperX"
    )
    parser.add_argument("audio", type=Path)
    parser.add_argument("--transcript", required=True, type=Path)
    parser.add_argument("--language", required=True)
    parser.add_argument("--out", type=Path)
    parser.add_argument("--device", default=os.environ.get("WHISPERX_DEVICE", "cpu"))
    parser.add_argument("--align-model", default=os.environ.get("WHISPERX_ALIGN_MODEL"))
    parser.add_argument("--model-dir", default=os.environ.get("WHISPERX_MODEL_DIR"))
    args = parser.parse_args()

    audio = args.audio.resolve()
    transcript = args.transcript.read_text(encoding="utf-8").strip()
    if not transcript:
        raise ValueError("Transcript is empty")

    try:
        import whisperx
        from whisperx.audio import SAMPLE_RATE
    except ModuleNotFoundError as error:
        if error.name != "whisperx":
            raise
        print(
            "WhisperX not found — see packages/e2e/lipsync/README.md; "
            "alignment is dev-time only and never needed to render",
            file=sys.stderr,
        )
        return 127

    waveform = whisperx.load_audio(str(audio))
    duration = len(waveform) / SAMPLE_RATE
    language = args.language.split("-", maxsplit=1)[0].lower()
    model, metadata = whisperx.load_align_model(
        language_code=language,
        device=args.device,
        model_name=args.align_model,
        model_dir=args.model_dir,
    )
    raw = whisperx.align(
        [{"text": transcript, "start": 0.0, "end": duration}],
        model,
        metadata,
        waveform,
        args.device,
        return_char_alignments=True,
        print_progress=False,
    )
    normalised = normalise(raw)

    payload = json.dumps(normalised, ensure_ascii=False, indent=2) + "\n"
    if args.out is None:
        sys.stdout.write(payload)
    else:
        args.out.parent.mkdir(parents=True, exist_ok=True)
        args.out.write_text(payload, encoding="utf-8")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
