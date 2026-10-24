#!/usr/bin/env python3
"""Upload an Android APK to BrowserStack App Live for manual real-device testing.

This supports BrowserStack App Live subscriptions, which do not include the
App Automate Espresso API. Credentials are read from BROWSERSTACK_USERNAME and
BROWSERSTACK_ACCESS_KEY and are never printed.
"""

from __future__ import annotations

import argparse
import base64
import json
import os
import sys
import time
import urllib.error
import urllib.request
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

APP_LIVE_UPLOAD_URL = "https://api-cloud.browserstack.com/app-live/upload"


def main() -> int:
    args = parse_args()
    result: dict[str, Any] = {
        "ok": False,
        "source": "browserstack-app-live",
        "project": args.project,
        "buildName": args.build,
        "appPath": str(Path(args.app).resolve()),
        "manualTesting": True,
        "startedAt": iso_now(),
    }
    try:
        auth = basic_auth(require_env("BROWSERSTACK_USERNAME"), require_env("BROWSERSTACK_ACCESS_KEY"))
        upload = upload_file(APP_LIVE_UPLOAD_URL, args.app, auth)
        result["upload"] = redact_upload(upload)
        app_url = pick_first(upload, "app_url", "appUrl", "custom_id", "shareable_id", "app_id", "id")
        if not app_url:
            raise RuntimeError(f"BrowserStack App Live upload did not return an app identifier: {safe_json(upload)}")
        result["appUrl"] = app_url
        result["dashboardUrl"] = pick_first(upload, "shareable_id", "shareable_url", "public_url", "url")
        result["completedAt"] = iso_now()
        result["ok"] = True
        write_result(args.output, result)
        print(json.dumps(summary(result), indent=2))
        return 0
    except Exception as error:  # noqa: BLE001 - always write evidence on failure
        result["completedAt"] = iso_now()
        result["error"] = str(error)
        write_result(args.output, result)
        print(f"BrowserStack App Live upload failed: {error}", file=sys.stderr)
        return 1


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser()
    parser.add_argument("--app", required=True, help="Path to the Android APK to upload")
    parser.add_argument("--project", required=True)
    parser.add_argument("--build", required=True)
    parser.add_argument("--output", default="browserstack-app-live-upload.json")
    return parser.parse_args()


def require_env(name: str) -> str:
    value = os.environ.get(name, "").strip()
    if not value:
        raise RuntimeError(f"Missing required environment variable: {name}")
    return value


def basic_auth(username: str, access_key: str) -> str:
    token = base64.b64encode(f"{username}:{access_key}".encode()).decode()
    return f"Basic {token}"


def upload_file(url: str, file_path: str, auth: str) -> dict[str, Any]:
    path = Path(file_path)
    if not path.exists() or path.stat().st_size == 0:
        raise RuntimeError(f"Upload file missing or empty: {file_path}")
    boundary = f"----sgm-browserstack-app-live-{int(time.time() * 1000)}"
    body = multipart_body(boundary, "file", path)
    request = urllib.request.Request(
        url,
        data=body,
        headers={
            "Authorization": auth,
            "Content-Type": f"multipart/form-data; boundary={boundary}",
            "Content-Length": str(len(body)),
        },
        method="POST",
    )
    return request_json(request)


def multipart_body(boundary: str, field_name: str, path: Path) -> bytes:
    head = (
        f"--{boundary}\r\n"
        f'Content-Disposition: form-data; name="{field_name}"; filename="{path.name}"\r\n'
        "Content-Type: application/vnd.android.package-archive\r\n\r\n"
    ).encode()
    tail = f"\r\n--{boundary}--\r\n".encode()
    return head + path.read_bytes() + tail


def request_json(request: urllib.request.Request) -> dict[str, Any]:
    try:
        with urllib.request.urlopen(request, timeout=60) as response:  # noqa: S310 - fixed trusted endpoint
            text = response.read().decode()
    except urllib.error.HTTPError as error:
        text = error.read().decode(errors="replace")
        raise RuntimeError(f"HTTP {error.code} from {request.full_url}: {text[:1000]}") from error
    if not text.strip():
        return {}
    try:
        return json.loads(text)
    except json.JSONDecodeError as error:
        raise RuntimeError(f"Non-JSON response from {request.full_url}: {text[:1000]}") from error


def pick_first(data: dict[str, Any], *keys: str) -> str | None:
    for key in keys:
        value = data.get(key)
        if isinstance(value, str) and value.strip():
            return value
    return None


def redact_upload(data: dict[str, Any]) -> dict[str, Any]:
    redacted: dict[str, Any] = {}
    for key, value in data.items():
        lower = key.lower()
        if "key" in lower or "token" in lower or "secret" in lower or "password" in lower:
            continue
        redacted[key] = value
    return redacted


def write_result(path: str, result: dict[str, Any]) -> None:
    Path(path).write_text(json.dumps(result, indent=2, sort_keys=True) + "\n", encoding="utf-8")


def summary(result: dict[str, Any]) -> dict[str, Any]:
    return {
        "ok": result.get("ok"),
        "source": result.get("source"),
        "project": result.get("project"),
        "buildName": result.get("buildName"),
        "appUrl": result.get("appUrl"),
        "dashboardUrl": result.get("dashboardUrl"),
        "manualTesting": result.get("manualTesting"),
        "error": result.get("error"),
    }


def safe_json(data: Any) -> str:
    try:
        return json.dumps(data, ensure_ascii=False)[:1000]
    except TypeError:
        return str(data)[:1000]


def iso_now() -> str:
    return datetime.now(timezone.utc).replace(microsecond=0).isoformat().replace("+00:00", "Z")


if __name__ == "__main__":
    sys.exit(main())
