from __future__ import annotations

import base64
import json
import os
from dataclasses import dataclass
from pathlib import Path
from typing import Any
from urllib.error import HTTPError, URLError
from urllib.parse import quote
from urllib.request import Request, urlopen

from json_snapshot import DEFAULT_SNAPSHOT_PATH, build_snapshot, snapshot_to_json


class JsonSnapshotPersistError(RuntimeError):
    def __init__(self, message: str, details: dict[str, Any] | None = None):
        super().__init__(message)
        self.details = details or {}


@dataclass(frozen=True)
class JsonSnapshotPersistResult:
    enabled: bool
    committed: bool
    row_count: int = 0
    commit_sha: str | None = None
    html_url: str | None = None


def _bool_env(name: str, default: bool = False) -> bool:
    raw_value = os.getenv(name)
    if raw_value is None:
        return default
    return raw_value.strip().lower() in {"1", "true", "yes", "on"}


def _snapshot_path() -> Path:
    raw_path = os.getenv("JSON_SNAPSHOT_PATH") or str(DEFAULT_SNAPSHOT_PATH)
    snapshot_path = Path(raw_path)
    if not snapshot_path.is_absolute():
        snapshot_path = DEFAULT_SNAPSHOT_PATH.parent.parent / snapshot_path
    return snapshot_path


def _github_request(method: str, url: str, token: str, payload: dict[str, Any] | None = None) -> dict[str, Any]:
    body = None
    if payload is not None:
        body = json.dumps(payload).encode("utf-8")
    request = Request(
        url,
        data=body,
        method=method,
        headers={
            "Accept": "application/vnd.github+json",
            "Authorization": f"Bearer {token}",
            "Content-Type": "application/json",
            "User-Agent": "ban-hoc-json-snapshot-sync",
            "X-GitHub-Api-Version": "2022-11-28",
        },
    )
    try:
        with urlopen(request, timeout=20) as response:
            raw_response = response.read().decode("utf-8")
            return json.loads(raw_response) if raw_response else {}
    except HTTPError as error:
        raw_error = error.read().decode("utf-8", errors="replace")
        if error.code == 404 and method == "GET":
            return {}
        raise JsonSnapshotPersistError(
            "Không lưu được JSON lên GitHub.",
            {"status": error.code, "response": raw_error[:1000]},
        ) from error
    except URLError as error:
        raise JsonSnapshotPersistError(
            "Không kết nối được GitHub để lưu JSON.",
            {"reason": str(error.reason)},
        ) from error
    except TimeoutError as error:
        raise JsonSnapshotPersistError("GitHub phản hồi quá lâu khi lưu JSON.") from error


def persist_json_snapshot(action_name: str) -> JsonSnapshotPersistResult:
    if not _bool_env("PERSIST_JSON_TO_GITHUB", False):
        return JsonSnapshotPersistResult(enabled=False, committed=False)

    token = (os.getenv("GITHUB_TOKEN") or "").strip()
    repo = (os.getenv("GITHUB_REPO") or "").strip()
    branch = (os.getenv("GITHUB_BRANCH") or "main").strip()
    github_path = (os.getenv("GITHUB_SNAPSHOT_PATH") or "backend/data/demo_snapshot.json").strip()
    if not token or not repo or not branch or not github_path:
        raise JsonSnapshotPersistError(
            "Chưa cấu hình đủ biến môi trường để lưu JSON lên GitHub.",
            {
                "required_env": [
                    "PERSIST_JSON_TO_GITHUB=true",
                    "GITHUB_TOKEN",
                    "GITHUB_REPO",
                    "GITHUB_BRANCH",
                    "GITHUB_SNAPSHOT_PATH",
                ],
            },
        )

    snapshot, row_counts = build_snapshot()
    snapshot_text = snapshot_to_json(snapshot)
    encoded_path = quote(github_path, safe="/")
    url = f"https://api.github.com/repos/{repo}/contents/{encoded_path}"
    current_file = _github_request("GET", f"{url}?ref={quote(branch)}", token)
    payload: dict[str, Any] = {
        "message": f"Persist JSON snapshot after {action_name}",
        "content": base64.b64encode(snapshot_text.encode("utf-8")).decode("ascii"),
        "branch": branch,
    }
    if current_file.get("sha"):
        payload["sha"] = current_file["sha"]
    if os.getenv("GITHUB_COMMIT_AUTHOR_NAME") or os.getenv("GITHUB_COMMIT_AUTHOR_EMAIL"):
        payload["committer"] = {
            "name": os.getenv("GITHUB_COMMIT_AUTHOR_NAME") or "Render JSON Sync",
            "email": os.getenv("GITHUB_COMMIT_AUTHOR_EMAIL") or "render-json-sync@example.com",
        }

    response = _github_request("PUT", url, token, payload)
    _snapshot_path().write_text(snapshot_text, encoding="utf-8")
    commit = response.get("commit") if isinstance(response, dict) else None
    content = response.get("content") if isinstance(response, dict) else None
    return JsonSnapshotPersistResult(
        enabled=True,
        committed=True,
        row_count=sum(row_counts.values()),
        commit_sha=commit.get("sha") if isinstance(commit, dict) else None,
        html_url=content.get("html_url") if isinstance(content, dict) else None,
    )
