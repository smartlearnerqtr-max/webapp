from __future__ import annotations

import asyncio


class EdgeTTSServiceError(Exception):
    def __init__(self, message: str, status_code: int = 502):
        super().__init__(message)
        self.message = message
        self.status_code = status_code


async def _synthesize_mp3_async(*, text: str, voice_name: str, rate: str, pitch: str) -> bytes:
    try:
        import edge_tts
    except ImportError as exc:
        raise EdgeTTSServiceError('Chưa cài edge-tts trên backend', 500) from exc

    audio_chunks: list[bytes] = []
    communicate = edge_tts.Communicate(text=text, voice=voice_name, rate=rate, pitch=pitch)
    async for chunk in communicate.stream():
        if chunk.get('type') == 'audio' and chunk.get('data'):
            audio_chunks.append(chunk['data'])

    if not audio_chunks:
        raise EdgeTTSServiceError('Không tạo được audio tiếng Việt', 502)

    return b''.join(audio_chunks)


def synthesize_vietnamese_mp3(*, text: str, voice_name: str, rate: str = '-12%', pitch: str = '+0Hz') -> bytes:
    clean_text = ' '.join(text.strip().split())
    if not clean_text:
        raise EdgeTTSServiceError('Nội dung đọc không được để trống', 422)
    if len(clean_text) > 1200:
        clean_text = clean_text[:1200].rsplit(' ', 1)[0].strip() or clean_text[:1200]

    try:
        return asyncio.run(
            _synthesize_mp3_async(
                text=clean_text,
                voice_name=voice_name.strip() or 'vi-VN-HoaiMyNeural',
                rate=rate.strip() or '-12%',
                pitch=pitch.strip() or '+0Hz',
            )
        )
    except EdgeTTSServiceError:
        raise
    except Exception as exc:
        raise EdgeTTSServiceError('Tạo audio tiếng Việt thất bại', 502) from exc
