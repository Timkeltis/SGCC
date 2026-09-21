"""Public SGCC data API backed by the 网上国网 Android App protocol.

Credentials stay on the NAS. Clients receive only normalized electricity data.
"""

from __future__ import annotations

import asyncio
import hmac
import json
import os
import time
from datetime import datetime
from pathlib import Path
from typing import Any

from aiohttp import ClientSession, web

from sgcc_client.api import (
    StateGridApiError,
    StateGridAppApi,
    StateGridAuthenticationError,
    StateGridDeviceVerificationRequired,
    StateGridError,
    StateGridInteractiveChallengeRequired,
    StateGridNetworkError,
)
from sgcc_client.models import AccountUsage, LoginSession
from sgcc_client.synthetic_device import build_device_profile, create_device_state

DATA_DIR = Path(os.getenv("SGCC_DATA_DIR", "/data"))
STATE_FILE = DATA_DIR / "state.json"
API_TOKEN = os.getenv("SGCC_API_TOKEN", "").strip()
USERNAME = os.getenv("SGCC_USERNAME", "").strip()
PASSWORD = os.getenv("SGCC_PASSWORD", "")
HISTORY_MONTHS = max(1, min(3, int(os.getenv("SGCC_HISTORY_MONTHS", "2"))))
PORT = int(os.getenv("PORT", "8080"))
STATE_LOCK = asyncio.Lock()


def _load_state() -> dict[str, Any]:
    if not STATE_FILE.exists():
        return {"device": create_device_state()}
    try:
        value = json.loads(STATE_FILE.read_text(encoding="utf-8"))
        return value if isinstance(value, dict) else {"device": create_device_state()}
    except (OSError, json.JSONDecodeError, TypeError):
        return {"device": create_device_state()}


def _save_state(state: dict[str, Any]) -> None:
    DATA_DIR.mkdir(parents=True, exist_ok=True)
    temporary = STATE_FILE.with_suffix(".tmp")
    temporary.write_text(json.dumps(state, ensure_ascii=False, indent=2), encoding="utf-8")
    temporary.replace(STATE_FILE)


def _authorized(request: web.Request) -> bool:
    if not API_TOKEN:
        return False
    value = request.headers.get("Authorization", "")
    scheme, _, token = value.partition(" ")
    return scheme.lower() == "bearer" and hmac.compare_digest(token, API_TOKEN)


def _account(value: Any) -> dict[str, Any]:
    return {
        "id": value.account_id,
        "name": value.name,
        "cons_no": value.cons_no,
        "masked_number": value.masked_number,
        "province": value.pro_no,
        "address": value.address,
    }


def _usage(value: AccountUsage) -> dict[str, Any]:
    balance = value.billing_account
    latest = value.latest.as_dict() if value.latest else None
    return {
        "account": _account(value.account),
        "daily": [item.as_dict() for item in value.readings],
        "latest": latest,
        "current_month_total": value.current_month_total,
        "current_year_usage": value.current_year_usage,
        "current_year_charge": value.current_year_charge,
        "monthly_bills": [item.as_dict() for item in value.monthly_bills],
        "balance": {
            "balance": balance.balance,
            "amount_due": balance.amount_due,
            "history_owe": balance.history_owe,
            "date": balance.date,
        }
        if balance
        else None,
        "meter": {
            "day": value.latest_month_meter.day.isoformat(),
            "reading": value.latest_month_meter.reading,
            "transformer_ratio": value.latest_month_meter.transformer_ratio,
        }
        if value.latest_month_meter
        else None,
    }


async def _client() -> tuple[StateGridAppApi, dict[str, Any]]:
    if not USERNAME or not PASSWORD:
        raise StateGridAuthenticationError("missing_credentials", "NAS credentials are not configured")
    state = _load_state()
    device_state = state.get("device")
    if not isinstance(device_state, dict):
        device_state = create_device_state()
    saved = LoginSession.from_dict(state.get("session"))
    user_info = saved.user_info if saved else {}
    profile, updated_device = build_device_profile(
        device_state,
        province=str(user_info.get("addressProvince", "")),
        city=str(user_info.get("addressCity", "")),
        region=str(user_info.get("addressRegion", "")),
    )
    state["device"] = updated_device
    http = ClientSession()
    return StateGridAppApi(
        http,
        username=USERNAME,
        password=PASSWORD,
        profile=profile,
        login_session=saved,
    ), state


async def _run_query() -> dict[str, Any]:
    async with STATE_LOCK:
        client, state = await _client()
        try:
            result = await client.async_query_history(months=HISTORY_MONTHS)
            state["session"] = client.login_session.as_dict() if client.login_session else None
            state["last_success"] = int(time.time())
            _save_state(state)
            data = {key: _usage(value) for key, value in result.items()}
            return {
                "ok": True,
                "source": "csc-service.sgcc.com.cn",
                "refresh_time": datetime.now().astimezone().isoformat(),
                "accounts": list(data.values()),
                "data": data,
            }
        finally:
            await client.http.close()


def _error_response(error: Exception) -> web.Response:
    if isinstance(error, StateGridDeviceVerificationRequired):
        status = 409
    elif isinstance(error, (StateGridAuthenticationError, StateGridInteractiveChallengeRequired)):
        status = 401
    elif isinstance(error, StateGridNetworkError):
        status = 503
    elif isinstance(error, StateGridApiError):
        status = 502
    else:
        status = 500
    return web.json_response({"ok": False, "error": str(error)}, status=status)


async def health(_request: web.Request) -> web.Response:
    return web.json_response({"ok": True, "service": "sgcc-api"})


async def bill_all(request: web.Request) -> web.Response:
    if not _authorized(request):
        return web.json_response({"ok": False, "error": "unauthorized"}, status=401)
    try:
        return web.json_response(await _run_query())
    except Exception as error:  # API boundary: convert protocol errors to JSON.
        return _error_response(error)


async def login(request: web.Request) -> web.Response:
    if not _authorized(request):
        return web.json_response({"ok": False, "error": "unauthorized"}, status=401)
    try:
        data = await _run_query()
        return web.json_response({"ok": True, "accounts": data["accounts"]})
    except Exception as error:
        return _error_response(error)


def create_app() -> web.Application:
    app = web.Application(client_max_size=1024 * 1024)
    app.router.add_get("/health", health)
    app.router.add_post("/v1/auth/login", login)
    app.router.add_post("/v1/electricity/bill/all", bill_all)
    return app


if __name__ == "__main__":
    if not API_TOKEN:
        raise SystemExit("SGCC_API_TOKEN is required")
    web.run_app(create_app(), host="0.0.0.0", port=PORT)
