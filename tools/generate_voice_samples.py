from __future__ import annotations

import asyncio
from pathlib import Path

import edge_tts


OUT_DIR = Path(__file__).resolve().parents[1] / 'frontend' / 'public' / 'demo-audio' / 'voice-test'
OUT_DIR.mkdir(parents=True, exist_ok=True)

TEXT = 'Nhìn ảnh. Chọn đáp án đúng. Đây là con gì?'

SAMPLES = [
    ('unicode-hoaimy-word.mp3', 'vi-VN-HoaiMyNeural', '-18%', '+0Hz'),
    ('unicode-namminh-word.mp3', 'vi-VN-NamMinhNeural', '-18%', '+0Hz'),
]


async def main() -> None:
    for filename, voice, rate, pitch in SAMPLES:
        path = OUT_DIR / filename
        communicate = edge_tts.Communicate(text=TEXT, voice=voice, rate=rate, pitch=pitch)
        await communicate.save(str(path))
        print(f'{filename}: {path.stat().st_size}')


if __name__ == '__main__':
    asyncio.run(main())
