import os
import jwt
import bcrypt
import psycopg2
from datetime import datetime, timedelta
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from .data_base import get_db_connection
from google.oauth2 import id_token
from google.auth.transport import requests
from dotenv import load_dotenv

load_dotenv()

SECRET_KEY = os.getenv("SECRET_KEY")
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
    return jwt.encode(to_encode, SECRET_KEY, algorithm=ALGORITHM)


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
            INSERT INTO users (email, password_hash, name)
            VALUES (%s, %s, %s)
            RETURNING id
            """,
            (req.email, hashed_pw, req.name)
        )

        user_id = cursor.fetchone()[0]
        conn.commit()

        token = create_access_token({"sub": str(user_id)})

        return {
            "token": token,
            "name": req.name,
            "email": req.email
        }

    except psycopg2.IntegrityError:
        conn.rollback()
        raise HTTPException(
            status_code=400,
            detail="Email already registered"
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
            detail="This account does not use password login"
        )

    if not bcrypt.checkpw(
        req.password.encode("utf-8"),
        user[1].encode("utf-8")
    ):
        raise HTTPException(
            status_code=401,
            detail="Invalid credentials"
        )

    token = create_access_token({"sub": str(user[0])})

    return {
        "token": token,
        "name": user[2],
        "email": req.email
    }


@auth_router.post("/google")
def google_auth(req: GoogleAuthRequest):
    try:
        idinfo = id_token.verify_oauth2_token(
            req.token,
            requests.Request(),
            GOOGLE_CLIENT_ID
        )

        email = idinfo["email"]
        name = idinfo.get("name", "")
        google_id = idinfo["sub"]

        conn = get_db_connection()
        cursor = conn.cursor()

        try:
            cursor.execute(
                "SELECT id FROM users WHERE email = %s",
                (email,)
            )

            user = cursor.fetchone()

            if not user:
                cursor.execute(
                    """
                    INSERT INTO users (email, name, google_id)
                    VALUES (%s, %s, %s)
                    RETURNING id
                    """,
                    (email, name, google_id)
                )

                user_id = cursor.fetchone()[0]
                conn.commit()

            else:
                user_id = user[0]

        finally:
            cursor.close()
            conn.close()

        token = create_access_token({"sub": str(user_id)})

        return {
            "token": token,
            "name": name,
            "email": email
        }

    except ValueError:
        raise HTTPException(
            status_code=401,
            detail="Invalid Google Token"
        )