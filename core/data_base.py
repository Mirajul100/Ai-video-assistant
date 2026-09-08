import sqlite3
import json
import json
from pathlib import Path

DB_PATH = "lumen.db"

def init_db():
    conn = sqlite3.connect(DB_PATH)
    cursor = conn.cursor()
    
    cursor.execute('''
        CREATE TABLE IF NOT EXISTS users (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            name TEXT,
            email TEXT UNIQUE NOT NULL,
            password_hash TEXT,
            google_id TEXT,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
    ''')
    
    cursor.execute('''
        CREATE TABLE IF NOT EXISTS lessons (
            session_id TEXT PRIMARY KEY,
            user_id INTEGER,
            title TEXT,
            summary TEXT,
            key_points TEXT,
            questions TEXT,
            transcript TEXT,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY(user_id) REFERENCES users(id)
        )
    ''')
    conn.commit()
    conn.close()

def save_lesson(session_id, user_id, title, summary, key_points, questions, transcript):
    conn = sqlite3.connect(DB_PATH)
    cursor = conn.cursor()
    cursor.execute('''
        INSERT INTO lessons (session_id, user_id, title, summary, key_points, questions, transcript)
        VALUES (?, ?, ?, ?, ?, ?, ?)
    ''', (session_id, user_id, title, summary, json.dumps(key_points), json.dumps(questions), transcript))
    conn.commit()
    conn.close()

def get_user_history(user_id):
    conn = sqlite3.connect(DB_PATH)
    cursor = conn.cursor()
    cursor.execute('SELECT session_id, title, created_at FROM lessons WHERE user_id = ? ORDER BY created_at DESC', (user_id,))
    rows = cursor.fetchall()
    conn.close()
    return [{"session_id": row[0], "title": row[1], "date": row[2]} for row in rows]
    
def get_lesson(session_id):
    conn = sqlite3.connect(DB_PATH)
    cursor = conn.cursor()
    cursor.execute('SELECT * FROM lessons WHERE session_id = ?', (session_id,))
    row = cursor.fetchone()
    conn.close()
    
    if row:
        return {
            "session_id": row[0],
            "user_id": row[1],
            "title": row[2],
            "summary": row[3],
            "key_points": json.loads(row[4]),
            "questions": json.loads(row[5]),
            "transcript": row[6],
            "created_at": row[7]
        }
    return None

def get_lesson_by_id(session_id: str, user_id: str):
    conn = sqlite3.connect(DB_PATH)
    cursor = conn.cursor()
    cursor.execute("""
        SELECT title, summary, key_points, questions, transcript 
        FROM lessons 
        WHERE session_id = ? AND user_id = ?
    """, (session_id, user_id))
    row = cursor.fetchone()
    conn.close()
    
    if row:
        return {
            "success": True,
            "session_id": session_id,
            "title": row[0],
            "summary": row[1],
            "key_points": json.loads(row[2]) if row[2] else [],
            "questions": json.loads(row[3]) if row[3] else [],
            "transcript": row[4]
        }
    return None