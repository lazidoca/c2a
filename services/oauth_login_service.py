"""Manual OAuth bridge service.

Allows users to run OpenAI's standard OAuth + PKCE authorization code flow in their own browser:
  1. Backend generates code_verifier / code_challenge / state and constructs authorize URL.
  2. User logs in via browser, and browser is redirected by OpenAI to platform.openai.com's
     callback URL; user extracts the code from address bar or devtools, and inputs it to frontend.
  3. Backend takes the stored code_verifier + code to request /api/accounts/oauth/token
     and obtains {access_token, refresh_token, id_token}.

The obtained refresh_token uses the same client_id as the automated token refresh mechanism
(app_2SKx67EdpoN0G6j64rFvigXD), enabling direct keepalive rotation once saved to disk.
"""
from __future__ import annotations

import secrets
import threading
import time
import uuid
from typing import Any
from urllib.parse import parse_qs, urlencode, urlparse

from curl_cffi import requests

from services.proxy_service import proxy_settings
from services.register.openai_register import (
    auth_base,
    common_headers,
    platform_auth0_client,
    platform_base,
    platform_oauth_audience,
    platform_oauth_client_id,
    platform_oauth_redirect_uri,
    sec_ch_ua,
    user_agent,
)


class OAuthLoginError(Exception):
    """Expected error in the OAuth bridge flow, will be translated to 400 by the API layer."""


class OAuthLoginService:
    """Maintains temporary PKCE sessions and handles code -> token exchanges."""

    _SESSION_TTL_SECONDS = 10 * 60  # Time limit for user to open browser and input code
    _MAX_SESSIONS = 64               # Prevent session accumulation; purge oldest when capacity is exceeded

    def __init__(self) -> None:
        self._lock = threading.Lock()
        self._sessions: dict[str, dict[str, Any]] = {}

    @staticmethod
    def _generate_pkce() -> tuple[str, str]:
        """Generates PKCE code_verifier and corresponding code_challenge (S256)."""
        from utils.pkce import generate_pkce
        return generate_pkce()

    def _purge_expired_locked(self) -> None:
        """Purges expired or capacity-exceeded sessions, must be called while holding lock."""
        now = time.time()
        expired = [sid for sid, item in self._sessions.items() if now - item["created_at"] > self._SESSION_TTL_SECONDS]
        for sid in expired:
            self._sessions.pop(sid, None)
        if len(self._sessions) > self._MAX_SESSIONS:
            ordered = sorted(self._sessions.items(), key=lambda kv: kv[1]["created_at"])
            for sid, _ in ordered[: len(self._sessions) - self._MAX_SESSIONS]:
                self._sessions.pop(sid, None)

    def start(self, email_hint: str = "") -> dict[str, str]:
        """Registers a new PKCE session and returns session_id along with the authorize_url.

        state is shaped as "<session_id>.<nonce>" so the callback URL carries session_id.
        This allows restoring the correct verifier even if the frontend React state is lost.
        """
        verifier, challenge = self._generate_pkce()
        nonce = secrets.token_urlsafe(32)
        device_id = str(uuid.uuid4())
        session_id = uuid.uuid4().hex
        state = f"{session_id}.{secrets.token_urlsafe(16)}"

        params = {
            "issuer": auth_base,
            "client_id": platform_oauth_client_id,
            "audience": platform_oauth_audience,
            "redirect_uri": platform_oauth_redirect_uri,
            "device_id": device_id,
            "screen_hint": "login_or_signup",
            "max_age": "0",
            "scope": "openid profile email offline_access",
            "response_type": "code",
            "response_mode": "query",
            "state": state,
            "nonce": nonce,
            "code_challenge": challenge,
            "code_challenge_method": "S256",
            "auth0Client": platform_auth0_client,
        }
        email_hint = str(email_hint or "").strip()
        if email_hint:
            params["login_hint"] = email_hint

        authorize_url = f"{auth_base}/api/accounts/authorize?{urlencode(params)}"

        with self._lock:
            self._purge_expired_locked()
            self._sessions[session_id] = {
                "code_verifier": verifier,
                "state": state,
                "created_at": time.time(),
                "redirect_uri": platform_oauth_redirect_uri,
            }

        return {
            "session_id": session_id,
            "authorize_url": authorize_url,
            "expires_in": str(self._SESSION_TTL_SECONDS),
            "redirect_uri_prefix": platform_oauth_redirect_uri,
        }

    @staticmethod
    def _extract_code_from_callback(value: str) -> tuple[str, str]:
        """Extracts (code, state) from callback URL or raw code.

        Accepts either a full callback URL or the raw code string itself.
        """
        raw = str(value or "").strip()
        if not raw:
            return "", ""
        if raw.startswith("http://") or raw.startswith("https://"):
            try:
                parsed = parse_qs(urlparse(raw).query)
            except Exception as exc:
                raise OAuthLoginError(f"Failed to parse callback URL: {exc}") from exc
            code = str((parsed.get("code") or [""])[0]).strip()
            state = str((parsed.get("state") or [""])[0]).strip()
            if not code:
                err = str((parsed.get("error_description") or parsed.get("error") or [""])[0]).strip()
                raise OAuthLoginError(err or "No code parameter in callback URL")
            return code, state
        # User might have pasted the raw code directly
        return raw, ""

    def finish(self, session_id: str, callback: str) -> dict[str, str]:
        """Exchanges code in callback for the token triad using matching code_verifier.

        - Prioritizes session_id from state in the callback URL (more reliable).
        - Does not immediately destroy session on failure (code exchange failure usually does not consume code).
          Only pops session on success, allowing retry with same verifier.
        """
        body_sid = str(session_id or "").strip()
        code, state = self._extract_code_from_callback(callback)
        if not code:
            raise OAuthLoginError("Missing code or callback URL")

        # session_id embedded in state has highest priority
        state_sid = state.split(".", 1)[0] if state else ""
        candidate_sids = [sid for sid in (state_sid, body_sid) if sid]
        if not candidate_sids:
            raise OAuthLoginError("Neither session_id was provided nor state carried in callback URL")

        with self._lock:
            self._purge_expired_locked()
            session = None
            picked_sid = ""
            for sid in candidate_sids:
                cur = self._sessions.get(sid)
                if cur is not None:
                    session = cur
                    picked_sid = sid
                    break
        if session is None:
            raise OAuthLoginError(
                "OAuth session has expired or does not exist. Please return to the import dialog and click \"Regenerate\" to try again."
            )

        if state and session.get("state") and state != session["state"]:
            raise OAuthLoginError(
                "state mismatch. Common cause: you clicked \"Open Authorization Page\" twice, but logged in using the previous window. Please click \"Regenerate\" to restart."
            )

        tokens = self._exchange_code(
            code,
            session["code_verifier"],
            session.get("redirect_uri") or platform_oauth_redirect_uri,
        )
        # Only consume session after successful exchange
        with self._lock:
            self._sessions.pop(picked_sid, None)
        return tokens

    @staticmethod
    def _exchange_code(code: str, code_verifier: str, redirect_uri: str) -> dict[str, str]:
        """Calls /api/accounts/oauth/token to exchange code + verifier for the token triad."""
        kwargs = proxy_settings.build_session_kwargs(impersonate="chrome", verify=False)
        session = requests.Session(**kwargs)
        try:
            response = session.post(
                f"{auth_base}/api/accounts/oauth/token",
                headers={
                    **common_headers,
                    "referer": f"{platform_base}/",
                    "origin": platform_base,
                    "auth0-client": platform_auth0_client,
                    "sec-ch-ua": sec_ch_ua,
                    "user-agent": user_agent,
                },
                json={
                    "client_id": platform_oauth_client_id,
                    "code_verifier": code_verifier,
                    "grant_type": "authorization_code",
                    "code": code,
                    "redirect_uri": redirect_uri,
                },
                timeout=60,
            )
        except Exception as exc:
            raise OAuthLoginError(f"Network error during token exchange: {exc}") from exc
        finally:
            session.close()

        try:
            data = response.json() if response.text else {}
        except Exception:
            data = {}

        if response.status_code != 200 or not isinstance(data, dict) or not data.get("access_token"):
            detail = ""
            if isinstance(data, dict):
                detail = str(data.get("error_description") or data.get("error") or data.get("message") or "")
            if not detail:
                try:
                    detail = str(response.text or "")[:300]
                except Exception:
                    detail = ""
            # Print to logs: OAuth token exchange failure details are usually only visible here
            print(
                f"[oauth-login] /api/accounts/oauth/token rejected: "
                f"status={response.status_code} detail={detail!r} "
                f"raw_body={(getattr(response, 'text', '') or '')[:500]!r}",
                flush=True,
            )
            raise OAuthLoginError(
                f"OpenAI rejected token exchange (HTTP {response.status_code}){': ' + detail if detail else ''}"
            )

        access_token = str(data.get("access_token") or "").strip()
        refresh_token = str(data.get("refresh_token") or "").strip()
        id_token = str(data.get("id_token") or "").strip()

        if not access_token:
            raise OAuthLoginError("OpenAI returned empty access_token")
        if not refresh_token:
            # scope offline_access normally issues a refresh_token; prompt user if missing
            raise OAuthLoginError(
                "OpenAI did not return refresh_token (scope might not include offline_access or code has already been used)"
            )

        return {
            "access_token": access_token,
            "refresh_token": refresh_token,
            "id_token": id_token,
        }


oauth_login_service = OAuthLoginService()
