import os
import re
import sqlite3
from datetime import datetime, timedelta, timezone
from pathlib import Path

import bcrypt
import jwt
from dotenv import load_dotenv
from fastapi import APIRouter, HTTPException
from google.auth.transport import requests
from google.oauth2 import id_token
from pydantic import BaseModel, Field
from psycopg2 import IntegrityError as PgIntegrityError

load_dotenv()

from .data_base import USE_POSTGRES, get_db_connection

SECRET_KEY = os.getenv("SECRET_KEY", "").strip() or None
ALGORITHM = "HS256"
GOOGLE_CLIENT_ID = os.getenv("GOOGLE_CLIENT_ID", "").strip() or None

auth_router = APIRouter(prefix="/auth")


class AuthRequest(BaseModel):
    email: str = Field(min_length=3, max_length=320)
    password: str = Field(min_length=1, max_length=72)
    name: str | None = None


class RegisterRequest(AuthRequest):
    password: str = Field(min_length=8, max_length=72)
    name: str = Field(min_length=1, max_length=100)


class GoogleAuthRequest(BaseModel):
    token: str = Field(min_length=1)


def normalize_email(email: str) -> str:
    normalized = email.strip().lower()
    if not re.fullmatch(r"[^@\s]+@[^@\s]+\.[^@\s]+", normalized):
        raise HTTPException(status_code=422, detail="A valid email address is required.")
    return normalized


def create_access_token(data: dict) -> str:
    ensure_auth_configured()
    payload = data.copy()
    payload["exp"] = datetime.now(timezone.utc) + timedelta(days=7)
    return jwt.encode(payload, SECRET_KEY, algorithm=ALGORITHM)


def ensure_auth_configured() -> None:
    if not SECRET_KEY or len(SECRET_KEY.encode("utf-8")) < 32:
        raise HTTPException(
            status_code=503,
            detail="Authentication requires a SECRET_KEY of at least 32 bytes."
        )


def decode_access_token(token: str) -> str | None:
    if not SECRET_KEY or len(SECRET_KEY.encode("utf-8")) < 32:
        return None
    try:
        subject = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM]).get("sub")
    except jwt.PyJWTError:
        return None
    return subject if isinstance(subject, str) and subject else None


@auth_router.post("/register")
def register(req: RegisterRequest):
    ensure_auth_configured()
    email = normalize_email(req.email)
    name = req.name.strip()
    if not name:
        raise HTTPException(status_code=422, detail="Name is required.")
    if len(req.password.encode("utf-8")) > 72:
        raise HTTPException(status_code=422, detail="Password must be at most 72 UTF-8 bytes.")

    conn = get_db_connection()
    cursor = conn.cursor()
    try:
        placeholder = "%s" if USE_POSTGRES else "?"
        cursor.execute(
            f"SELECT 1 FROM users WHERE LOWER(email) = {placeholder}",
            (email,)
        )
        if cursor.fetchone():
            raise HTTPException(status_code=400, detail="Email already registered")

        password_hash = bcrypt.hashpw(
            req.password.encode("utf-8"),
            bcrypt.gensalt()
        ).decode("utf-8")
        if USE_POSTGRES:
            cursor.execute(
                """
                INSERT INTO users (email, password_hash, name)
                VALUES (%s, %s, %s)
                RETURNING id
                """,
                (email, password_hash, name)
            )
            user_id = cursor.fetchone()[0]
        else:
            cursor.execute(
                """
                INSERT INTO users (email, password_hash, name)
                VALUES (?, ?, ?)
                """,
                (email, password_hash, name)
            )
            user_id = cursor.lastrowid
        conn.commit()
        return {
            "token": create_access_token({"sub": str(user_id)}),
            "name": name,
            "email": email
        }
    except HTTPException:
        conn.rollback()
        raise
    except (PgIntegrityError, sqlite3.IntegrityError):
        conn.rollback()
        raise HTTPException(status_code=400, detail="Email already registered")
    finally:
        cursor.close()
        conn.close()


@auth_router.post("/login")
def login(req: AuthRequest):
    ensure_auth_configured()
    email = normalize_email(req.email)
    if len(req.password.encode("utf-8")) > 72:
        raise HTTPException(status_code=401, detail="Invalid credentials")

    conn = get_db_connection()
    cursor = conn.cursor()
    try:
        placeholder = "%s" if USE_POSTGRES else "?"
        cursor.execute(
            f"""
            SELECT id, password_hash, name, email
            FROM users
            WHERE LOWER(email) = {placeholder}
            """,
            (email,)
        )
        user = cursor.fetchone()
    finally:
        cursor.close()
        conn.close()

    if not user:
        raise HTTPException(status_code=401, detail="Invalid credentials")
    if not user[1]:
        raise HTTPException(
            status_code=401,
            detail="This account does not use password login"
        )
    if not bcrypt.checkpw(req.password.encode("utf-8"), user[1].encode("utf-8")):
        raise HTTPException(status_code=401, detail="Invalid credentials")

    return {
        "token": create_access_token({"sub": str(user[0])}),
        "name": user[2],
        "email": user[3]
    }


@auth_router.get("/config")
def auth_config():
    return {"google_client_id": GOOGLE_CLIENT_ID}


@auth_router.post("/google")
def google_auth(req: GoogleAuthRequest):
    if not GOOGLE_CLIENT_ID:
        raise HTTPException(
            status_code=503,
            detail="Google authentication is not configured."
        )
    ensure_auth_configured()

    try:
        idinfo = id_token.verify_oauth2_token(
            req.token,
            requests.Request(),
            GOOGLE_CLIENT_ID
        )
    except ValueError:
        raise HTTPException(status_code=401, detail="Invalid Google token.")

    if idinfo.get("email_verified") is not True:
        raise HTTPException(status_code=401, detail="Google account email is not verified.")
    try:
        email = normalize_email(idinfo.get("email", ""))
    except HTTPException:
        raise HTTPException(status_code=401, detail="Invalid Google token.")
    google_id = idinfo.get("sub")
    if not google_id:
        raise HTTPException(status_code=401, detail="Invalid Google token.")
    name = str(idinfo.get("name") or "").strip()

    conn = get_db_connection()
    cursor = conn.cursor()
    try:
        placeholder = "%s" if USE_POSTGRES else "?"
        cursor.execute(
            f"SELECT id, email, name FROM users WHERE google_id = {placeholder}",
            (google_id,)
        )
        user = cursor.fetchone()

        if user:
            user_id, account_email, account_name = user
        else:
            cursor.execute(
                f"""
                SELECT id, google_id, email, name
                FROM users
                WHERE LOWER(email) = {placeholder}
                """,
                (email,)
            )
            user = cursor.fetchone()

            if user:
                user_id, linked_google_id, account_email, account_name = user
                if linked_google_id and linked_google_id != google_id:
                    raise HTTPException(
                        status_code=409,
                        detail="This email is already linked to another Google account."
                    )
                account_name = account_name or name
                cursor.execute(
                    f"""
                    UPDATE users
                    SET google_id = {placeholder}, name = {placeholder}
                    WHERE id = {placeholder}
                    """,
                    (google_id, account_name, user_id)
                )
            elif USE_POSTGRES:
                cursor.execute(
                    """
                    INSERT INTO users (email, name, google_id)
                    VALUES (%s, %s, %s)
                    RETURNING id, email, name
                    """,
                    (email, name, google_id)
                )
                user_id, account_email, account_name = cursor.fetchone()
            else:
                cursor.execute(
                    """
                    INSERT INTO users (email, name, google_id)
                    VALUES (?, ?, ?)
                    """,
                    (email, name, google_id)
                )
                user_id, account_email, account_name = cursor.lastrowid, email, name

        conn.commit()
    except (PgIntegrityError, sqlite3.IntegrityError):
        conn.rollback()
        raise HTTPException(
            status_code=409,
            detail="This Google account is already linked to another user."
        )
    except HTTPException:
        conn.rollback()
        raise
    finally:
        cursor.close()
        conn.close()

    return {
        "token": create_access_token({"sub": str(user_id)}),
        "name": account_name,
        "email": account_email
    }


def migrate_legacy_auth_users() -> int:
    legacy_path = Path(__file__).resolve().parent.parent / "local_auth.db"
    if not legacy_path.is_file():
        return 0

    legacy_conn = sqlite3.connect(legacy_path)
    try:
        try:
            rows = legacy_conn.execute(
                "SELECT id, email, password_hash, name, google_id FROM users"
            ).fetchall()
        except sqlite3.OperationalError as exc:
            if "no such table" in str(exc).lower():
                return 0
            raise
    finally:
        legacy_conn.close()

    if not rows:
        return 0

    conn = get_db_connection()
    cursor = conn.cursor()
    migrated = 0
    try:
        query = """
            INSERT INTO users (id, email, password_hash, name, google_id)
            VALUES (%s, %s, %s, %s, %s)
            ON CONFLICT DO NOTHING
        """ if USE_POSTGRES else """
            INSERT INTO users (id, email, password_hash, name, google_id)
            VALUES (?, ?, ?, ?, ?)
            ON CONFLICT DO NOTHING
        """
        for user_id, email, password_hash, name, google_id in rows:
            if not email:
                continue
            cursor.execute(
                query,
                (user_id, email.strip().lower(), password_hash, name, google_id)
            )
            migrated += cursor.rowcount
        if USE_POSTGRES:
            cursor.execute("SELECT MAX(id) FROM users")
            max_user_id = cursor.fetchone()[0]
            cursor.execute(
                """
                SELECT setval(
                    pg_get_serial_sequence('users', 'id'),
                    %s,
                    %s
                )
                """,
                (max_user_id or 1, max_user_id is not None)
            )
        conn.commit()
    except Exception:
        conn.rollback()
        raise
    finally:
        cursor.close()
        conn.close()
    return migrated
