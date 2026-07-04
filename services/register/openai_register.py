from __future__ import annotations

import os
import re
import base64
import hashlib
import json
import random
import secrets
import string
import threading
import time
import uuid
from datetime import datetime, timezone
from itertools import cycle
from pathlib import Path
from typing import Any
from urllib.parse import parse_qs, urlencode, urlparse

from curl_cffi import requests
import httpx

from services.account_service import account_service
from services.proxy_service import ClearanceBundle, proxy_settings
from services.register import mail_provider
from utils.pkce import generate_pkce as _generate_pkce
from utils.sentinel import SentinelTokenGenerator, build_sentinel_token as _build_sentinel_token_tuple


base_dir = Path(__file__).resolve().parent
config = {
    "mail": {
        "request_timeout": 30,
        "wait_timeout": 30,
        "wait_interval": 2,
        "providers": [],
    },
    "proxy": "",
    "proxy_rotating_enabled": False,
    "proxy_rotating_keys": [],
    "total": 10,
    "threads": 3,
}
register_config_file = base_dir.parents[1] / "data" / "register.json"
try:
    saved_config = json.loads(register_config_file.read_text(encoding="utf-8"))
    config.update({key: saved_config[key] for key in ("mail", "proxy", "proxy_rotating_enabled", "proxy_rotating_keys", "total", "threads") if key in saved_config})
except Exception:
    pass


class RotatingProxyManager:
    """Thread-safe manager to dynamically query and cycle rotating proxies."""
    def __init__(self) -> None:
        self.lock = threading.Lock()
        self.api_keys_list: list[str] = []
        self.key2proxies: dict[str, list[Any]] = {}  # key -> [proxy_str, timestamp_ms]
        self.api_keys_cycle: Any = None
        self.nhamangs_cycle = cycle(["fpt", "viettel", "vnpt"])
        self.client = httpx.Client(verify=False, timeout=30.0)

    def update_keys(self, keys: list[str]) -> None:
        with self.lock:
            cleaned_keys = [k.strip() for k in keys if k.strip()]
            if cleaned_keys == self.api_keys_list:
                return
            self.api_keys_list = cleaned_keys
            self.api_keys_cycle = cycle(self.api_keys_list) if self.api_keys_list else None
            now_ms = time.time() * 1000
            # Initialize or keep existing keys' proxy cache
            new_key2proxies = {}
            for key in self.api_keys_list:
                if key in self.key2proxies:
                    new_key2proxies[key] = self.key2proxies[key]
                else:
                    new_key2proxies[key] = ["", now_ms]
            self.key2proxies = new_key2proxies

    def get_proxy(self, tries: int = 1) -> str | None:
        if tries > 3:
            return None

        with self.lock:
            if not self.api_keys_list or not self.api_keys_cycle:
                return None
            key = next(self.api_keys_cycle)
            nhamang = next(self.nhamangs_cycle)
            now_ms = time.time() * 1000
            
            proxy_info = self.key2proxies.get(key)
            if not proxy_info:
                proxy_info = ["", now_ms]
                self.key2proxies[key] = proxy_info

        # Cache check: if proxy exists and is within cooldown (60 - 80 seconds)
        cooldown = random.uniform(60000, 80000)
        if proxy_info[0] and proxy_info[1] + cooldown > now_ms:
            return proxy_info[0]

        # Call rotating proxy API
        if len(key) < 22:
            api_url = f"https://api.proxyxoay.org/api/key_xoay.php?key={key}&nhamang={nhamang}"
        else:
            api_url = f"https://proxyxoay.shop/api/get.php?key={key}&nhamang={nhamang}"

        # Synchronous request via httpx
        try:
            headers = {"User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36"}
            response = self.client.get(api_url, headers=headers)
            js = response.json()
        except Exception as exc:
            # Logger or print output
            print(f"[RotatingProxy] Request failed for key {key[:8]}...: {exc}")
            time.sleep(random.uniform(5, 10))
            return self.get_proxy(tries + 1)

        is_success = False
        next_allowed = js.get("next_allowed_in_seconds", 0)
        try:
            next_allowed = int(next_allowed)
        except (TypeError, ValueError):
            next_allowed = 0

        status = js.get("status")
        try:
            status = int(status)
        except (TypeError, ValueError):
            status = None

        if len(key) < 22:
            if not js.get("error") and next_allowed > 50:
                is_success = True
        else:
            if status == 100:
                is_success = True

        if is_success:
            proxy_raw = js.get("proxyhttp")
            if not proxy_raw:
                return None
            parts = proxy_raw.split(":")
            if len(parts) >= 2:
                ip = parts[0]
                port = parts[1]
                user = parts[2] if len(parts) > 2 else ""
                password = parts[3] if len(parts) > 3 else ""
                if user and password:
                    proxy_str = f"http://{user}:{password}@{ip}:{port}"
                else:
                    proxy_str = f"http://{ip}:{port}"
                
                with self.lock:
                    self.key2proxies[key] = [proxy_str, time.time() * 1000]
                return proxy_str
            return None

        # Rate limited or invalid state response, wait and try next key
        time.sleep(random.uniform(5, 10))
        return self.get_proxy(tries + 1)



rotating_proxy_manager = RotatingProxyManager()

auth_base = "https://auth.openai.com"
platform_base = "https://platform.openai.com"
platform_oauth_client_id = "app_2SKx67EdpoN0G6j64rFvigXD"
platform_oauth_redirect_uri = f"{platform_base}/auth/callback"
platform_oauth_audience = "https://api.openai.com/v1"
platform_auth0_client = "eyJuYW1lIjoiYXV0aDAtc3BhLWpzIiwidmVyc2lvbiI6IjEuMjEuMCJ9"
user_agent = (
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) "
    "AppleWebKit/537.36 (KHTML, like Gecko) "
    "Chrome/145.0.0.0 Safari/537.36"
)
sec_ch_ua = '"Google Chrome";v="145", "Not?A_Brand";v="8", "Chromium";v="145"'
sec_ch_ua_full_version_list = '"Chromium";v="145.0.0.0", "Not:A-Brand";v="99.0.0.0", "Google Chrome";v="145.0.0.0"'
default_timeout = 30
print_lock = threading.Lock()
stats_lock = threading.Lock()
stats = {"done": 0, "success": 0, "fail": 0, "start_time": 0.0}
register_log_sink = None

common_headers = {
    "accept": "application/json",
    "accept-encoding": "gzip, deflate, br",
    "accept-language": "en-US,en;q=0.9",
    "cache-control": "no-cache",
    "connection": "keep-alive",
    "content-type": "application/json",
    "dnt": "1",
    "origin": auth_base,
    "priority": "u=1, i",
    "sec-gpc": "1",
    "sec-ch-ua": sec_ch_ua,
    "sec-ch-ua-arch": '"x86_64"',
    "sec-ch-ua-bitness": '"64"',
    "sec-ch-ua-full-version-list": sec_ch_ua_full_version_list,
    "sec-ch-ua-mobile": "?0",
    "sec-ch-ua-model": '""',
    "sec-ch-ua-platform": '"Windows"',
    "sec-ch-ua-platform-version": '"10.0.0"',
    "sec-fetch-dest": "empty",
    "sec-fetch-mode": "cors",
    "sec-fetch-site": "same-origin",
    "user-agent": user_agent,
}

navigate_headers = {
    "accept": "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8",
    "accept-encoding": "gzip, deflate, br",
    "accept-language": "en-US,en;q=0.9",
    "cache-control": "max-age=0",
    "connection": "keep-alive",
    "dnt": "1",
    "sec-gpc": "1",
    "sec-ch-ua": sec_ch_ua,
    "sec-ch-ua-arch": '"x86_64"',
    "sec-ch-ua-bitness": '"64"',
    "sec-ch-ua-full-version-list": sec_ch_ua_full_version_list,
    "sec-ch-ua-mobile": "?0",
    "sec-ch-ua-model": '""',
    "sec-ch-ua-platform": '"Windows"',
    "sec-ch-ua-platform-version": '"10.0.0"',
    "sec-fetch-dest": "document",
    "sec-fetch-mode": "navigate",
    "sec-fetch-site": "same-origin",
    "sec-fetch-user": "?1",
    "upgrade-insecure-requests": "1",
    "user-agent": user_agent,
}


def log(text: str, color: str = "") -> None:
    colors = {"red": "\033[31m", "green": "\033[32m", "yellow": "\033[33m"}
    if register_log_sink:
        try:
            register_log_sink(text, color)
        except Exception:
            pass
    with print_lock:
        prefix = colors.get(color, "")
        suffix = "\033[0m" if prefix else ""
        print(f"{prefix}{datetime.now().strftime('%H:%M:%S')} {text}{suffix}")


def step(index: int, text: str, color: str = "") -> None:
    log(f"[Task {index}] {text}", color)


def _make_trace_headers() -> dict[str, str]:
    trace_id = str(random.getrandbits(64))
    parent_id = str(random.getrandbits(64))
    return {
        "traceparent": f"00-{uuid.uuid4().hex}-{format(int(parent_id), '016x')}-01",
        "tracestate": "dd=s:1;o:rum",
        "x-datadog-origin": "rum",
        "x-datadog-parent-id": parent_id,
        "x-datadog-sampling-priority": "1",
        "x-datadog-trace-id": trace_id,
    }



def _random_password(length: int = 16) -> str:
    chars = string.ascii_letters + string.digits + "!@#$%"
    value = list(
        secrets.choice(string.ascii_uppercase)
        + secrets.choice(string.ascii_lowercase)
        + secrets.choice(string.digits)
        + secrets.choice("!@#$%")
        + "".join(secrets.choice(chars) for _ in range(max(0, length - 4)))
    )
    random.shuffle(value)
    return "".join(value)


def _random_name() -> tuple[str, str]:
    return random.choice(["James", "Robert", "John", "Michael", "David", "Mary", "Emma", "Olivia"]), random.choice(
        ["Smith", "Johnson", "Williams", "Brown", "Jones", "Garcia", "Miller"]
    )


def _random_birthdate() -> str:
    return f"{random.randint(1996, 2006):04d}-{random.randint(1, 12):02d}-{random.randint(1, 28):02d}"


def _slugify(text: str) -> str:
    text = text.lower().strip()
    text = re.sub(r'[^a-z0-9]', '', text)
    # text = re.sub(r'-+', '-', text)
    return text.strip('-')


def _build_register_proxy(email: str | None = None) -> str | None:
    env_ip = os.environ.get("CHATGPT2API_REGISTER_PROXY_IP") or os.environ.get("REGISTER_PROXY_IP")
    env_port = os.environ.get("CHATGPT2API_REGISTER_PROXY_PORT") or os.environ.get("REGISTER_PROXY_PORT")
    env_user = os.environ.get("CHATGPT2API_REGISTER_PROXY_USERNAME") or os.environ.get("REGISTER_PROXY_USERNAME")
    env_pass = os.environ.get("CHATGPT2API_REGISTER_PROXY_PASSWORD") or os.environ.get("REGISTER_PROXY_PASSWORD")

    if not (env_ip and env_port):
        return None

    env_ip = env_ip.strip()
    env_port = env_port.strip()
    if "://" in env_ip:
        scheme, _, host = env_ip.partition("://")
        env_ip = host
    else:
        scheme = "http"

    if env_user:
        username = env_user.strip()
        if email:
            email_prefix = email.partition("@")[0]
            slugified = _slugify(email_prefix)
            username = f"{username}-session-{slugified}"
        
        if env_pass:
            return f"{scheme}://{username}:{env_pass.strip()}@{env_ip}:{env_port}"
        return f"{scheme}://{username}@{env_ip}:{env_port}"
        
    return f"{scheme}://{env_ip}:{env_port}"


def _response_json(resp) -> dict:
    try:
        data = resp.json()
        return data if isinstance(data, dict) else {}
    except Exception:
        return {}


def _response_debug_detail(resp, limit: int = 800) -> str:
    if resp is None:
        return ""
    data = _response_json(resp)
    parts = [
        f"url={str(getattr(resp, 'url', '') or '')[:300]}",
        f"content_type={str(getattr(resp, 'headers', {}).get('content-type') or '')}",
    ]
    for key in ("cf-ray", "x-request-id", "openai-processing-ms"):
        value = str(getattr(resp, "headers", {}).get(key) or "").strip()
        if value:
            parts.append(f"{key}={value}")
    if data:
        parts.append(f"json={json.dumps(data, ensure_ascii=False)[:limit]}")
    else:
        parts.append(f"body={str(getattr(resp, 'text', '') or '')[:limit]}")
    return ", ".join(parts)


def _is_cloudflare_challenge(resp) -> bool:
    if resp is None:
        return False
    try:
        status_code = int(getattr(resp, "status_code", 0) or 0)
    except (TypeError, ValueError):
        status_code = 0
    if status_code not in (403, 503):
        return False
    text = str(getattr(resp, "text", "") or "").lower()
    return (
        "<title>just a moment" in text
        or "<title>attention required! | cloudflare" in text
        or "cf-chl-" in text
        or "__cf_chl_" in text
        or "cf-browser-verification" in text
    )


def _truthy(value: object, fallback: bool = True) -> bool:
    if isinstance(value, bool):
        return value
    if value is None:
        return fallback
    text = str(value).strip().lower()
    if text in {"1", "true", "yes", "on"}:
        return True
    if text in {"0", "false", "no", "off"}:
        return False
    return fallback


def _mail_config(register_proxy: str = "") -> dict:
    mail = config["mail"] if isinstance(config.get("mail"), dict) else {}
    use_register_proxy = _truthy(mail.get("api_use_register_proxy"), True)
    proxy = str(register_proxy or "").strip() if use_register_proxy else ""
    return {**mail, "api_use_register_proxy": use_register_proxy, "proxy": proxy}


def _authorize_landed_page(resp) -> str:
    """For diagnosis: roughly determine which page we landed on after authorize. Returns signup / login / "" for logging only.

    Note: email-verification / email_otp_verification can appear in both registration and login flows,
    so we cannot reliably distinguish them here. This is only used for logging and never interrupts the registration flow.
    """
    if resp is None:
        return ""
    final_url = str(getattr(resp, "url", "") or "").lower()
    data = _response_json(resp)
    page_type = ""
    page = data.get("page") if isinstance(data, dict) else None
    if isinstance(page, dict):
        page_type = str(page.get("type") or "").lower()
    if "create-account" in final_url or "signup" in final_url or "create_account" in page_type:
        return "signup"
    if "/log-in" in final_url or "/login" in final_url or page_type in {"login", "password_verification"}:
        return "login"
    return ""


def create_mailbox(username: str | None = None, register_proxy: str = "") -> dict:
    return mail_provider.create_mailbox(_mail_config(register_proxy), username)


def wait_for_code(mailbox: dict, register_proxy: str = "") -> str | None:
    return mail_provider.wait_for_code(_mail_config(register_proxy), mailbox)



def build_sentinel_token(session: requests.Session, device_id: str, flow: str) -> str:
    """Request sentinel token, returning sentinel header string (compatible with old interface)."""
    sentinel_val, _oai_sc_val = _build_sentinel_token_tuple(session, device_id, flow, user_agent=user_agent, sec_ch_ua=sec_ch_ua)
    return sentinel_val


def create_session(proxy: str = "") -> Any:
    kwargs = proxy_settings.build_session_kwargs(
        proxy=proxy,
        upstream=True,
        impersonate="chrome",
        verify=False,
    )
    return requests.Session(**kwargs)


def _apply_clearance_to_session(session: requests.Session, bundle: ClearanceBundle | None) -> None:
    if bundle is None:
        return
    if bundle.user_agent:
        session.headers["User-Agent"] = bundle.user_agent
        session.headers["user-agent"] = bundle.user_agent
    for name, value in bundle.cookies.items():
        try:
            session.cookies.set(name, value, domain=f".{bundle.target_host or 'openai.com'}")
            session.cookies.set(name, value, domain=bundle.target_host or "auth.openai.com")
        except Exception:
            continue


def _headers_with_clearance(
    headers: dict[str, str],
    target_url: str,
    proxy: str = "",
    user_agent_override: str = "",
) -> dict[str, str]:
    merged = proxy_settings.build_headers(
        headers=headers,
        target_url=target_url,
        proxy=proxy,
        upstream=True,
    )
    normalized = {str(key): str(value) for key, value in merged.items()}
    if user_agent_override:
        ua_key = next((key for key in normalized if key.lower() == "user-agent"), "user-agent")
        normalized[ua_key] = user_agent_override
    return normalized


def _cloudflare_block_message(resp, prefix: str = "Blocked by Cloudflare", reason: str = "") -> str:
    status = getattr(resp, "status_code", "unknown")
    debug = _response_debug_detail(resp)
    reason = reason or "clearance refresh failed or retry failed, please change IP/proxy and try again"
    return f"{prefix}，{reason}: status={status}, {debug}"


def request_with_local_retry(session: requests.Session, method: str, url: str, retry_attempts: int = 3, **kwargs):
    last_error = ""
    for _ in range(max(1, retry_attempts)):
        try:
            return session.request(method.upper(), url, timeout=default_timeout, **kwargs), ""
        except Exception as error:
            last_error = str(error)
            time.sleep(1)
    return None, last_error


def validate_otp(session: requests.Session, device_id: str, code: str):
    headers = dict(common_headers)
    headers["referer"] = f"{auth_base}/email-verification"
    headers["oai-device-id"] = device_id
    headers.update(_make_trace_headers())
    resp, error = request_with_local_retry(session, "post", f"{auth_base}/api/accounts/email-otp/validate", json={"code": code}, headers=headers, verify=False)
    if resp is not None and resp.status_code == 200:
        return resp, ""
    headers["openai-sentinel-token"] = build_sentinel_token(session, device_id, "authorize_continue")
    resp, error = request_with_local_retry(session, "post", f"{auth_base}/api/accounts/email-otp/validate", json={"code": code}, headers=headers, verify=False)
    return resp, error


def extract_oauth_callback_params_from_url(url: str) -> dict[str, str] | None:
    if not url:
        return None
    try:
        params = parse_qs(urlparse(url).query)
    except Exception:
        return None
    code = str((params.get("code") or [""])[0]).strip()
    if not code:
        return None
    return {"code": code, "state": str((params.get("state") or [""])[0]).strip(), "scope": str((params.get("scope") or [""])[0]).strip()}


def request_platform_oauth_token(session: requests.Session, code: str, code_verifier: str) -> dict | None:
    headers = {
        "accept": "*/*",
        "accept-language": "en-US,en;q=0.9,en-GB;q=0.8",
        "auth0-client": platform_auth0_client,
        "cache-control": "no-cache",
        "content-type": "application/json",
        "origin": platform_base,
        "pragma": "no-cache",
        "priority": "u=1, i",
        "referer": f"{platform_base}/",
        "sec-ch-ua": sec_ch_ua,
        "sec-ch-ua-mobile": "?0",
        "sec-ch-ua-platform": '"Windows"',
        "sec-fetch-dest": "empty",
        "sec-fetch-mode": "cors",
        "sec-fetch-site": "same-site",
        "user-agent": user_agent,
    }
    resp = session.post(
        f"{auth_base}/api/accounts/oauth/token",
        headers=headers,
        json={
            "client_id": platform_oauth_client_id,
            "code_verifier": code_verifier,
            "grant_type": "authorization_code",
            "code": code,
            "redirect_uri": platform_oauth_redirect_uri,
        },
        verify=False,
        timeout=60,
    )
    if resp.status_code != 200:
        print(resp.text)
        return None
    return _response_json(resp)


class PlatformRegistrar:
    def __init__(self, proxy: str = "") -> None:
        self.proxy = str(proxy or "").strip()
        self.session = create_session(self.proxy)
        self.clearance_user_agent = ""
        self.clearance_failure_reason = ""
        self.device_id = str(uuid.uuid4())
        self.code_verifier = ""
        self.platform_auth_code = ""

    def close(self) -> None:
        self.session.close()

    def _navigate_headers(self, referer: str = "") -> dict[str, str]:
        headers = dict(navigate_headers)
        if referer:
            headers["referer"] = referer
        return headers

    def _json_headers(self, referer: str) -> dict[str, str]:
        headers = dict(common_headers)
        headers["referer"] = referer
        headers["oai-device-id"] = self.device_id
        headers.update(_make_trace_headers())
        return headers

    def _refresh_cloudflare_clearance(self, target_url: str, index: int) -> ClearanceBundle | None:
        self.clearance_failure_reason = ""
        profile = proxy_settings.get_profile(proxy=self.proxy, upstream=True)
        if not profile.clearance_enabled:
            self.clearance_failure_reason = (
                "You can try using FlareSolverr bypass mode. Note that you need to deploy flaresolverr, privoxy, warp-proxy, and other related containers using Docker"
            )
            step(index, f"Cloudflare interception detected: {self.clearance_failure_reason}", "yellow")
            return None
        step(index, "Cloudflare interception detected, attempting to refresh clearance", "yellow")
        bundle = proxy_settings.refresh_clearance(
            target_url=target_url,
            proxy=self.proxy,
            force=True,
            upstream=True,
        )
        if bundle is not None:
            _apply_clearance_to_session(self.session, bundle)
            self.clearance_user_agent = bundle.user_agent or self.clearance_user_agent
            step(index, "Cloudflare clearance refresh completed, retrying current request", "yellow")
        else:
            self.clearance_failure_reason = "clearance refresh did not return valid Cookies, please check FlareSolverr URL, proxy, and egress IP"
            step(index, f"Cloudflare clearance refresh failed: {self.clearance_failure_reason}", "yellow")
        return bundle

    def _platform_authorize(self, email: str, index: int) -> None:
        step(index, "Starting platform authorize")
        self.session.cookies.set("oai-did", self.device_id, domain=".auth.openai.com")
        self.session.cookies.set("oai-did", self.device_id, domain="auth.openai.com")
        self.code_verifier, code_challenge = _generate_pkce()
        params = {
            "issuer": auth_base,
            "client_id": platform_oauth_client_id,
            "audience": platform_oauth_audience,
            "redirect_uri": platform_oauth_redirect_uri,
            "device_id": self.device_id,
            # Explicitly declare screen_hint="signup" for the registration flow.
            # While throwaway domains are automatically registered as new accounts by OpenAI,
            # real personal domains like @outlook.com / @hotmail.com might be routed to the login branch via login_or_signup,
            # leading to a failure at user/register with an incorrect auth step (invalid_auth_step).
            "screen_hint": "signup",
            "max_age": "0",
            "login_hint": email,
            "scope": "openid profile email offline_access",
            "response_type": "code",
            "response_mode": "query",
            "state": secrets.token_urlsafe(32),
            "nonce": secrets.token_urlsafe(32),
            "code_challenge": code_challenge,
            "code_challenge_method": "S256",
            "auth0Client": platform_auth0_client,
        }
        target_url = f"{auth_base}/api/accounts/authorize?{urlencode(params)}"
        headers = self._navigate_headers(f"{platform_base}/")
        headers = _headers_with_clearance(headers, target_url, self.proxy, self.clearance_user_agent)
        resp, error = request_with_local_retry(self.session, "get", target_url, headers=headers, allow_redirects=True, verify=False)
        if _is_cloudflare_challenge(resp):
            bundle = self._refresh_cloudflare_clearance(auth_base, index)
            if bundle is None:
                raise RuntimeError(_cloudflare_block_message(resp, reason=self.clearance_failure_reason))
            retry_headers = _headers_with_clearance(self._navigate_headers(f"{platform_base}/"), target_url, self.proxy, self.clearance_user_agent)
            resp, error = request_with_local_retry(self.session, "get", target_url, headers=retry_headers, allow_redirects=True, verify=False)
            if _is_cloudflare_challenge(resp):
                raise RuntimeError(_cloudflare_block_message(resp, "Cloudflare clearance retry still blocked"))
        if resp is None or resp.status_code != 200:
            err = _response_json(resp).get("error", {}) if resp is not None else {}
            detail = f": {err.get('code', '')} - {err.get('message', '')}".strip(" -") if err else ""
            debug = _response_debug_detail(resp)
            status = getattr(resp, "status_code", "unknown")
            raise RuntimeError(error or f"platform_authorize_http_{status}{detail}, {debug}")
        landed = _authorize_landed_page(resp)
        # For logging only, do not interrupt execution based on this: the landed authorize page
        # cannot reliably distinguish between registration and login; the actual validation is performed by user/register (failures will dump the full response).
        step(index, f"platform authorize completed [{landed or '?'}] url={str(getattr(resp, 'url', '') or '')[:160]}")

    def _register_user(self, email: str, password: str, index: int) -> None:
        step(index, "Starting to submit registration password")
        url = f"{auth_base}/api/accounts/user/register"
        headers = self._json_headers(f"{auth_base}/create-account/password")
        headers["openai-sentinel-token"] = build_sentinel_token(self.session, self.device_id, "username_password_create")
        headers = _headers_with_clearance(headers, url, self.proxy, self.clearance_user_agent)
        resp, error = request_with_local_retry(self.session, "post", url, json={"username": email, "password": password}, headers=headers, verify=False)
        if _is_cloudflare_challenge(resp):
            bundle = self._refresh_cloudflare_clearance(auth_base, index)
            if bundle is None:
                raise RuntimeError(_cloudflare_block_message(resp, reason=self.clearance_failure_reason))
            headers = self._json_headers(f"{auth_base}/create-account/password")
            headers["openai-sentinel-token"] = build_sentinel_token(self.session, self.device_id, "username_password_create")
            headers = _headers_with_clearance(headers, url, self.proxy, self.clearance_user_agent)
            resp, error = request_with_local_retry(self.session, "post", url, json={"username": email, "password": password}, headers=headers, verify=False)
            if _is_cloudflare_challenge(resp):
                raise RuntimeError(_cloudflare_block_message(resp, "Cloudflare clearance retry still blocked"))
        if resp is None or resp.status_code != 200:
            data = _response_json(resp) if resp is not None else {}
            if data.get("message") == "Failed to create account. Please try again.":
                step(index, "Registration failed: The email domain is likely blocked due to abuse, please change the email domain", "yellow")
            detail = f", detail={json.dumps(data, ensure_ascii=False)}" if data else ""
            raise RuntimeError(error or f"user_register_http_{getattr(resp, 'status_code', 'unknown')}{detail}")
        step(index, "Registration password submitted successfully")

    def _send_otp(self, index: int) -> None:
        step(index, "Starting to send verification code")
        url = f"{auth_base}/api/accounts/email-otp/send"
        headers = _headers_with_clearance(self._navigate_headers(f"{auth_base}/create-account/password"), url, self.proxy, self.clearance_user_agent)
        resp, error = request_with_local_retry(self.session, "get", url, headers=headers, allow_redirects=True, verify=False)
        if _is_cloudflare_challenge(resp):
            bundle = self._refresh_cloudflare_clearance(auth_base, index)
            if bundle is None:
                raise RuntimeError(_cloudflare_block_message(resp, reason=self.clearance_failure_reason))
            headers = _headers_with_clearance(self._navigate_headers(f"{auth_base}/create-account/password"), url, self.proxy, self.clearance_user_agent)
            resp, error = request_with_local_retry(self.session, "get", url, headers=headers, allow_redirects=True, verify=False)
            if _is_cloudflare_challenge(resp):
                raise RuntimeError(_cloudflare_block_message(resp, "Cloudflare clearance retry still blocked"))
        if resp is None or resp.status_code not in (200, 302):
            raise RuntimeError(error or f"send_otp_http_{getattr(resp, 'status_code', 'unknown')}")
        step(index, "Verification code sent successfully")

    def _validate_otp(self, code: str, index: int) -> None:
        step(index, f"Starting to verify code {code}")
        resp, error = validate_otp(self.session, self.device_id, code)
        if resp is None or resp.status_code != 200:
            body = ""
            try:
                body = (resp.text or "")[:500] if resp is not None else ""
            except Exception:
                pass
            raise RuntimeError(error or f"validate_otp_http_{getattr(resp, 'status_code', 'unknown')}_body={body}")
        step(index, "Verification code verified successfully")

    def _create_account(self, name: str, birthdate: str, index: int) -> None:
        step(index, "Starting to create account profile")
        url = f"{auth_base}/api/accounts/create_account"
        headers = self._json_headers(f"{auth_base}/about-you")
        headers["openai-sentinel-token"] = build_sentinel_token(self.session, self.device_id, "oauth_create_account")
        headers = _headers_with_clearance(headers, url, self.proxy, self.clearance_user_agent)
        resp, error = request_with_local_retry(self.session, "post", url, json={"name": name, "birthdate": birthdate}, headers=headers, verify=False)
        if _is_cloudflare_challenge(resp):
            bundle = self._refresh_cloudflare_clearance(auth_base, index)
            if bundle is None:
                raise RuntimeError(_cloudflare_block_message(resp, reason=self.clearance_failure_reason))
            headers = self._json_headers(f"{auth_base}/about-you")
            headers["openai-sentinel-token"] = build_sentinel_token(self.session, self.device_id, "oauth_create_account")
            headers = _headers_with_clearance(headers, url, self.proxy, self.clearance_user_agent)
            resp, error = request_with_local_retry(self.session, "post", url, json={"name": name, "birthdate": birthdate}, headers=headers, verify=False)
            if _is_cloudflare_challenge(resp):
                raise RuntimeError(_cloudflare_block_message(resp, "Cloudflare clearance retry still blocked"))
        if resp is None or resp.status_code not in (200, 302):
            data = _response_json(resp) if resp is not None else {}
            if data.get("message") == "Failed to create account. Please try again.":
                step(index, "Registration failed: The email domain is likely blocked due to abuse, please change the email domain", "yellow")
            detail = f", detail={json.dumps(data, ensure_ascii=False)}" if data else ""
            raise RuntimeError(error or f"create_account_http_{getattr(resp, 'status_code', 'unknown')}{detail}")
        data = _response_json(resp)
        callback_params = extract_oauth_callback_params_from_url(str(data.get("continue_url") or "").strip())
        self.platform_auth_code = str((callback_params or {}).get("code") or "").strip()
        step(index, "Account profile created successfully")

    def _exchange_registered_tokens(self, index: int) -> dict:
        step(index, "Starting to exchange token")
        tokens = request_platform_oauth_token(self.session, self.platform_auth_code, self.code_verifier)
        if not tokens:
            raise RuntimeError("Token exchange failed")
        step(index, "Token exchange completed")
        return tokens

    def register(self, mailbox: dict, email: str, index: int) -> dict:
        try:
            password = _random_password()
            first_name, last_name = _random_name()
            self._platform_authorize(email, index)
            self._register_user(email, password, index)
            self._send_otp(index)
            step(index, "Starting to wait for verification code")
            code = wait_for_code(mailbox, register_proxy=self.proxy)
            if not code:
                raise RuntimeError("Waiting for verification code timed out")
            step(index, f"Verification code received: {code}")
            self._validate_otp(code, index)
            self._create_account(f"{first_name} {last_name}", _random_birthdate(), index)
            tokens = self._exchange_registered_tokens(index)
        except Exception as error:
            mail_provider.mark_mailbox_result(mailbox, success=False, error=error)
            raise
        mail_provider.mark_mailbox_result(mailbox, success=True)
        return {
            "email": email,
            "password": password,
            "access_token": str(tokens.get("access_token") or "").strip(),
            "refresh_token": str(tokens.get("refresh_token") or "").strip(),
            "id_token": str(tokens.get("id_token") or "").strip(),
            "source_type": "web",
            "created_at": datetime.now(timezone.utc).isoformat(),
        }


def worker(index: int) -> dict:
    start = time.time()
    
    # 1. Create mailbox directly without proxy
    step(index, "Starting to create mailbox")
    mailbox = create_mailbox(register_proxy="")
    email = str(mailbox.get("address") or "").strip()
    if not email:
        mail_provider.release_mailbox(mailbox)
        raise RuntimeError("Mailbox service did not return address")
    label = str(mailbox.get("label") or "")
    step(index, f"Mailbox creation completed [{label}]: {email}")
    
    # 2. Determine proxy for registration
    env_proxy = _build_register_proxy(email)
    if config.get("proxy_rotating_enabled"):
        rotating_proxy_manager.update_keys(config.get("proxy_rotating_keys") or [])
        final_proxy = rotating_proxy_manager.get_proxy() or ""
        if final_proxy:
            step(index, f"Using rotating proxy: {final_proxy}")
    else:
        if env_proxy:
            final_proxy = env_proxy
            step(index, f"Using registration proxy from environment: {final_proxy}")
        else:
            final_proxy = config.get("proxy") or ""
        
    registrar = PlatformRegistrar(final_proxy)
    try:
        step(index, "Task started")
        result = registrar.register(mailbox, email, index)
        if env_proxy:
            result["proxy"] = env_proxy
            step(index, f"Saving registration proxy with the created account: {env_proxy}")
        cost = time.time() - start
        access_token = str(result["access_token"])
        account_service.add_account_items([result])
        refresh_result = account_service.refresh_accounts([access_token])
        if refresh_result.get("errors"):
            step(index, f"Account saved, status refresh not yet successful, you can retry later: {refresh_result['errors']}", "yellow")
        with stats_lock:
            stats["done"] += 1
            stats["success"] += 1
            avg = (time.time() - stats["start_time"]) / stats["success"]
        log(f'{result["email"]} registered successfully, elapsed={cost:.1f}s, global average per account registration={avg:.1f}s', "green")
        return {"ok": True, "index": index, "result": result}
    except Exception as e:
        cost = time.time() - start
        with stats_lock:
            stats["done"] += 1
            stats["fail"] += 1
        log(f"Task {index} registration failed, elapsed={cost:.1f}s, reason: {e}", "red")
        return {"ok": False, "index": index, "error": str(e)}
    finally:
        registrar.close()
