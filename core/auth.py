import jwt
import bcrypt
from datetime import datetime, timedelta
from fastapi import APIRouter, HTTPException, Depends
from pydantic import BaseModel
import sqlite3
from .data_base import DB_PATH
from google.oauth2 import id_token
from google.auth.transport import requests
import os
from dotenv import load_dotenv

load_dotenv()

# Use a 32+ character string to satisfy HS256 requirements
SECRET_KEY = os.getenv("SECRET_KEY")
ALGORITHM = "HS256"
GOOGLE_CLIENT_ID = os.getenv("GOOGLE_CLIENT_ID")

auth_router = APIRouter(prefix="/auth")

class AuthRequest(BaseModel):
    email: str
    password: str
    name: str = None

class GoogleAuthRequest(BaseModel):
    token: str

def create_access_token(data: dict):
    to_encode = data.copy()
    expire = datetime.utcnow() + timedelta(days=7)
    to_encode.update({"exp": expire})
    return jwt.encode(to_encode, SECRET_KEY, algorithm=ALGORITHM)

@auth_router.post("/register")
def register(req: AuthRequest):
    conn = sqlite3.connect(DB_PATH)
    cursor = conn.cursor()
    try:
        salt = bcrypt.gensalt()
        hashed_pw = bcrypt.hashpw(req.password.encode('utf-8'), salt).decode('utf-8')
        
        cursor.execute("INSERT INTO users (email, password_hash, name) VALUES (?, ?, ?)", 
                       (req.email, hashed_pw, req.name))
        conn.commit()
        user_id = cursor.lastrowid
        token = create_access_token({"sub": str(user_id)})
        return {"token": token, "name": req.name, "email": req.email}
    except sqlite3.IntegrityError:
        raise HTTPException(status_code=400, detail="Email already registered")
    finally:
        conn.close()

@auth_router.post("/login")
def login(req: AuthRequest):
    conn = sqlite3.connect(DB_PATH)
    cursor = conn.cursor()
    cursor.execute("SELECT id, password_hash, name FROM users WHERE email = ?", (req.email,))
    user = cursor.fetchone()
    conn.close()

    if not user or not bcrypt.checkpw(req.password.encode('utf-8'), user[1].encode('utf-8')):
        raise HTTPException(status_code=401, detail="Invalid credentials")
    
    token = create_access_token({"sub": str(user[0])})
    return {"token": token, "name": user[2], "email": req.email}

@auth_router.post("/google")
def google_auth(req: GoogleAuthRequest):
    try:
        idinfo = id_token.verify_oauth2_token(req.token, requests.Request(), GOOGLE_CLIENT_ID)
        email = idinfo['email']
        name = idinfo.get('name', '')
        google_id = idinfo['sub']

        conn = sqlite3.connect(DB_PATH)
        cursor = conn.cursor()
        
        cursor.execute("SELECT id FROM users WHERE email = ?", (email,))
        user = cursor.fetchone()
        
        if not user:
            cursor.execute("INSERT INTO users (email, name, google_id) VALUES (?, ?, ?)", (email, name, google_id))
            conn.commit()
            user_id = cursor.lastrowid
        else:
            user_id = user[0]
            
        conn.close()
        token = create_access_token({"sub": str(user_id)})
        return {"token": token, "name": name, "email": email}
    except ValueError:
        raise HTTPException(status_code=401, detail="Invalid Google Token")