from __future__ import annotations

import asyncio
from pathlib import Path

import edge_tts


OUT_DIR = Path(__file__).resolve().parents[1] / 'frontend' / 'public' / 'demo-audio'
OUT_DIR.mkdir(parents=True, exist_ok=True)

VOICE = 'vi-VN-HoaiMyNeural'
RATE = '-18%'
PITCH = '+0Hz'

ITEMS = [
    ('animal-demo-01-vi-v3.mp3', 'Nhìn ảnh. Chọn đáp án đúng. Đây là con gì?'),
    ('animal-demo-02-vi-v3.mp3', 'Quan sát ảnh. Chọn đúng tên con vật.'),
    ('animal-demo-03-vi-v3.mp3', 'Ghép các mảnh ảnh. Tạo thành hình con gấu.'),
    ('animal-demo-04-vi-v3.mp3', 'Con vật nào thường kêu meo meo?'),
    ('animal-demo-05-vi-v3.mp3', 'Xem video. Nói video nói về gì?'),
    ('animal-demo-06-vi-v3.mp3', 'Mở các ô. Đoán con vật trong ảnh.'),
    ('animal-demo-07-vi-v3.mp3', 'Chọn một thẻ. Em muốn nói gì khi thấy con mèo dễ thương?'),
]


async def main() -> None:
    for filename, text in ITEMS:
        path = OUT_DIR / filename
        communicate = edge_tts.Communicate(text=text, voice=VOICE, rate=RATE, pitch=PITCH)
        await communicate.save(str(path))
        print(f'{filename}: {path.stat().st_size}')


if __name__ == '__main__':
    asyncio.run(main())
