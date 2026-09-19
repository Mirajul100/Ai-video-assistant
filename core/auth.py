import os
from datetime import datetime, timedelta

import bcrypt
import jwt
from dotenv import load_dotenv
from fastapi import APIRouter, HTTPException
from google.auth.transport import requests
from google.oauth2 import id_token
from pydantic import BaseModel

from .data_base import get_db_connection

load_dotenv()

SECRET_KEY = os.getenv("SECRET_KEY")

if not SECRET_KEY:
    raise RuntimeError("SECRET_KEY is not configured")

ALGORITHM = "HS256"
GOOGLE_CLIENT_ID = os.getenv("GOOGLE_CLIENT_ID")

auth_router = APIRouter(prefix="/auth")


class AuthRequest(BaseModel):
    email: str
    password: str
    name: str | None = None


class GoogleAuthRequest(BaseModel):
    token: str


def create_access_token(data: dict):
    to_encode = data.copy()
    expire = datetime.utcnow() + timedelta(days=7)
    to_encode.update({"exp": expire})

    return jwt.encode(
        to_encode,
        SECRET_KEY,
        algorithm=ALGORITHM
    )


@auth_router.post("/register")
def register(req: AuthRequest):
    conn = get_db_connection()
    cursor = conn.cursor()

    try:
        salt = bcrypt.gensalt()
        hashed_pw = bcrypt.hashpw(
            req.password.encode("utf-8"),
            salt
        ).decode("utf-8")

        cursor.execute(
            """
            INSERT INTO users
            (email, password_hash, name)
            VALUES (%s, %s, %s)
            RETURNING id
            """,
            (
                req.email,
                hashed_pw,
                req.name
            )
        )

        user_id = cursor.fetchone()[0]

        conn.commit()

        token = create_access_token(
            {
                "sub": str(user_id)
            }
        )

        return {
            "token": token,
            "name": req.name,
            "email": req.email
        }

    except Exception as e:
        conn.rollback()

        if "unique" in str(e).lower():
            raise HTTPException(
                status_code=400,
                detail="Email already registered"
            )

        raise HTTPException(
            status_code=500,
            detail="Registration failed"
        )

    finally:
        cursor.close()
        conn.close()


@auth_router.post("/login")
def login(req: AuthRequest):
    conn = get_db_connection()
    cursor = conn.cursor()

    try:
        cursor.execute(
            """
            SELECT id, password_hash, name
            FROM users
            WHERE email = %s
            """,
            (req.email,)
        )

        user = cursor.fetchone()

    finally:
        cursor.close()
        conn.close()

    if not user:
        raise HTTPException(
            status_code=401,
            detail="Invalid credentials"
        )

    if not user[1]:
        raise HTTPException(
            status_code=401,
            detail="Password login is not available for this account"
        )

    try:
        password_valid = bcrypt.checkpw(
            req.password.encode("utf-8"),
            user[1].encode("utf-8")
        )
    except Exception:
        password_valid = False

    if not password_valid:
        raise HTTPException(
            status_code=401,
            detail="Invalid credentials"
        )

    token = create_access_token(
        {
            "sub": str(user[0])
        }
    )

    return {
        "token": token,
        "name": user[2],
        "email": req.email
    }


@auth_router.post("/google")
def google_auth(req: GoogleAuthRequest):
    if not GOOGLE_CLIENT_ID:
        raise HTTPException(
            status_code=500,
            detail="GOOGLE_CLIENT_ID is not configured"
        )

    try:
        idinfo = id_token.verify_oauth2_token(
            req.token,
            requests.Request(),
            GOOGLE_CLIENT_ID
        )

        email = idinfo.get("email")

        if not email:
            raise HTTPException(
                status_code=401,
                detail="Google account email not found"
            )

        name = idinfo.get("name", "")
        google_id = idinfo.get("sub")

        conn = get_db_connection()
        cursor = conn.cursor()

        try:
            cursor.execute(
                """
                SELECT id
                FROM users
                WHERE email = %s
                """,
                (email,)
            )

            user = cursor.fetchone()

            if not user:
                cursor.execute(
                    """
                    INSERT INTO users
                    (email, name, google_id)
                    VALUES (%s, %s, %s)
                    RETURNING id
                    """,
                    (
                        email,
                        name,
                        google_id
                    )
                )

                user_id = cursor.fetchone()[0]

            else:
                user_id = user[0]

            conn.commit()

        except Exception:
            conn.rollback()
            raise

        finally:
            cursor.close()
            conn.close()

        token = create_access_token(
            {
                "sub": str(user_id)
            }
        )

        return {
            "token": token,
            "name": name,
            "email": email
        }

    except HTTPException:
        raise

    except ValueError:
        raise HTTPException(
            status_code=401,
            detail="Invalid Google Token"
        )

    except Exception:
        raise HTTPException(
            status_code=500,
            detail="Google authentication failed"
        )