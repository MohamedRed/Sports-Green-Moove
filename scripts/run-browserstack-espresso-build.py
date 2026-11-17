#!/usr/bin/env python3
"""Upload Android app/test APKs to BrowserStack App Automate and run Espresso tests.

This script is intentionally secret-safe: it reads BrowserStack credentials from
BROWSERSTACK_USERNAME/BROWSERSTACK_ACCESS_KEY and never prints them. The JSON
result includes BrowserStack build/session metadata and API responses with secret
fields omitted.
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
from pathlib import Path
from typing import Any

BASE_URL = "https://api-cloud.browserstack.com/app-automate/espresso/v2"
TERMINAL_STATUSES = {"passed", "failed", "error", "timeout", "stopped", "done", "completed"}
SUCCESS_STATUSES = {"passed", "done", "completed"}


def main() -> int:
    args = parse_args()
    username = require_env("BROWSERSTACK_USERNAME")
    access_key = require_env("BROWSERSTACK_ACCESS_KEY")
    auth = basic_auth(username, access_key)

    result: dict[str, Any] = {
        "ok": False,
        "device": args.device,
        "project": args.project,
        "buildName": args.build,
        "appPath": str(Path(args.app).resolve()),
        "testSuitePath": str(Path(args.test_suite).resolve()),
        "startedAt": iso_now(),
    }

    try:
        app_upload = upload_file(f"{BASE_URL}/app", args.app, auth, "file")
        app_url = pick_first(app_upload, "app_url", "appUrl", "custom_id", "shareable_id")
        if not app_url:
            raise RuntimeError(f"BrowserStack app upload did not return an app_url-like field: {safe_json(app_upload)}")
        result["appUpload"] = redact_upload(app_upload)

        suite_upload = upload_file(f"{BASE_URL}/test-suite", args.test_suite, auth, "file")
        test_suite_url = pick_first(suite_upload, "test_suite_url", "testSuiteUrl", "test_url", "testUrl")
        if not test_suite_url:
            raise RuntimeError(
                f"BrowserStack test-suite upload did not return a test_suite_url-like field: {safe_json(suite_upload)}"
            )
        result["testSuiteUpload"] = redact_upload(suite_upload)

        build_payload = {
            "app": app_url,
            "testSuite": test_suite_url,
            "devices": [args.device],
            "project": args.project,
            "build": args.build,
            "deviceLogs": True,
            "video": True,
        }
        build_start = post_json(f"{BASE_URL}/build", build_payload, auth)
        result["buildStart"] = redact_upload(build_start)
        build_id = pick_first(build_start, "build_id", "buildId", "id")
        if not build_id:
            raise RuntimeError(f"BrowserStack build start did not return build_id: {safe_json(build_start)}")
        result["buildId"] = build_id
        result["dashboardUrl"] = dashboard_url(build_start, build_id)

        final = poll_build(build_id, auth, timeout_seconds=args.timeout_seconds, interval_seconds=args.poll_interval)
        result["final"] = redact_upload(final)
        status = normalize_status(pick_first(final, "status", "state") or pick_nested_status(final))
        result["status"] = status
        result["completedAt"] = iso_now()
        result["ok"] = status in SUCCESS_STATUSES and not has_failed_sessions(final)
        write_result(args.output, result)
        if result["ok"]:
            print(json.dumps(summary(result), indent=2))
            return 0
        print(json.dumps(summary(result), indent=2), file=sys.stderr)
        return 1
    except Exception as error:  # noqa: BLE001 - script should always write evidence on failure
        result["completedAt"] = iso_now()
        result["error"] = str(error)
        write_result(args.output, result)
        print(f"BrowserStack Espresso run failed: {error}", file=sys.stderr)
        return 1


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser()
    parser.add_argument("--app", required=True)
    parser.add_argument("--test-suite", required=True)
    parser.add_argument("--device", required=True)
    parser.add_argument("--project", required=True)
    parser.add_argument("--build", required=True)
    parser.add_argument("--output", default="browserstack-android-ui-result.json")
    parser.add_argument("--timeout-seconds", type=int, default=1800)
    parser.add_argument("--poll-interval", type=int, default=20)
    return parser.parse_args()


def require_env(name: str) -> str:
    value = os.environ.get(name, "").strip()
    if not value:
        raise RuntimeError(f"Missing required environment variable: {name}")
    return value


def basic_auth(username: str, access_key: str) -> str:
    token = base64.b64encode(f"{username}:{access_key}".encode()).decode()
    return f"Basic {token}"


def upload_file(url: str, file_path: str, auth: str, field_name: str) -> dict[str, Any]:
    path = Path(file_path)
    if not path.exists() or path.stat().st_size == 0:
        raise RuntimeError(f"Upload file missing or empty: {file_path}")
    boundary = f"----sgm-browserstack-{int(time.time() * 1000)}"
    body = multipart_body(boundary, field_name, path)
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
        "Content-Type: application/octet-stream\r\n\r\n"
    ).encode()
    tail = f"\r\n--{boundary}--\r\n".encode()
    return head + path.read_bytes() + tail


def post_json(url: str, payload: dict[str, Any], auth: str) -> dict[str, Any]:
    body = json.dumps(payload).encode()
    request = urllib.request.Request(
        url,
        data=body,
        headers={"Authorization": auth, "Content-Type": "application/json"},
        method="POST",
    )
    return request_json(request)


def get_json(url: str, auth: str) -> dict[str, Any]:
    request = urllib.request.Request(url, headers={"Authorization": auth})
    return request_json(request)


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


def poll_build(build_id: str, auth: str, timeout_seconds: int, interval_seconds: int) -> dict[str, Any]:
    deadline = time.time() + timeout_seconds
    last: dict[str, Any] = {}
    while time.time() < deadline:
        last = get_json(f"{BASE_URL}/builds/{build_id}", auth)
        status = normalize_status(pick_first(last, "status", "state") or pick_nested_status(last))
        print(json.dumps({"buildId": build_id, "status": status, "dashboardUrl": dashboard_url(last, build_id)}))
        if status in TERMINAL_STATUSES or all_sessions_terminal(last):
            return last
        time.sleep(interval_seconds)
    raise RuntimeError(f"Timed out waiting for BrowserStack build {build_id}; last response: {safe_json(last)}")


def all_sessions_terminal(data: dict[str, Any]) -> bool:
    sessions = sessions_from(data)
    return bool(sessions) and all(normalize_status(str(session.get("status") or session.get("state") or "")) in TERMINAL_STATUSES for session in sessions)


def has_failed_sessions(data: dict[str, Any]) -> bool:
    for session in sessions_from(data):
        status = normalize_status(str(session.get("status") or session.get("state") or ""))
        if status and status not in SUCCESS_STATUSES:
            return True
    return False


def sessions_from(data: dict[str, Any]) -> list[dict[str, Any]]:
    for key in ("sessions", "devices"):
        value = data.get(key)
        if isinstance(value, list):
            return [item for item in value if isinstance(item, dict)]
    return []


def pick_nested_status(data: dict[str, Any]) -> str | None:
    sessions = sessions_from(data)
    if not sessions:
        return None
    statuses = {normalize_status(str(session.get("status") or session.get("state") or "")) for session in sessions}
    statuses.discard("")
    if statuses <= SUCCESS_STATUSES:
        return "passed"
    if statuses & {"failed", "error", "timeout", "stopped"}:
        return "failed"
    return sorted(statuses)[0] if statuses else None


def pick_first(data: dict[str, Any], *keys: str) -> str | None:
    for key in keys:
        value = data.get(key)
        if isinstance(value, str) and value.strip():
            return value
    return None


def normalize_status(status: str | None) -> str:
    if not status:
        return ""
    normalized = status.strip().lower().replace(" ", "_")
    aliases = {
        "success": "passed",
        "passed": "passed",
        "done": "done",
        "completed": "completed",
        "failed": "failed",
        "failure": "failed",
        "running": "running",
        "queued": "queued",
        "pending": "queued",
        "timed_out": "timeout",
    }
    return aliases.get(normalized, normalized)


def dashboard_url(data: dict[str, Any], build_id: str) -> str | None:
    for key in ("dashboard_url", "dashboardUrl", "build_url", "buildUrl", "public_url"):
        value = data.get(key)
        if isinstance(value, str) and value.startswith("http"):
            return value
    hashed_id = data.get("hashed_id") or data.get("hashedId") or build_id
    if isinstance(hashed_id, str):
        return f"https://app-automate.browserstack.com/dashboard/v2/builds/{hashed_id}"
    return None


def redact_upload(value: Any) -> Any:
    if isinstance(value, dict):
        redacted = {}
        for key, child in value.items():
            lowered = key.lower()
            if "access" in lowered or "token" in lowered or "password" in lowered:
                redacted[key] = "[REDACTED]"
            else:
                redacted[key] = redact_upload(child)
        return redacted
    if isinstance(value, list):
        return [redact_upload(child) for child in value]
    return value


def safe_json(value: Any) -> str:
    return json.dumps(redact_upload(value), sort_keys=True)[:4000]


def write_result(path: str, value: dict[str, Any]) -> None:
    Path(path).write_text(json.dumps(redact_upload(value), indent=2) + "\n")


def summary(result: dict[str, Any]) -> dict[str, Any]:
    return {
        "ok": result.get("ok"),
        "status": result.get("status"),
        "buildId": result.get("buildId"),
        "dashboardUrl": result.get("dashboardUrl"),
        "device": result.get("device"),
        "resultFile": "browserstack-android-ui-result.json",
    }


def iso_now() -> str:
    return time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime())


if __name__ == "__main__":
    raise SystemExit(main())
