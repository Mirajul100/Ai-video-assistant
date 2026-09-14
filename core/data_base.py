import os
import json
import sqlite3
import logging

try:
    import psycopg2
    from psycopg2.extras import RealDictCursor
    HAS_POSTGRES = True
except ImportError:
    HAS_POSTGRES = False

logger = logging.getLogger("Lumen.ai")

DB_URL = os.getenv("DATABASE_URL")
USE_POSTGRES = bool(DB_URL and HAS_POSTGRES)

def get_db_connection():
    if USE_POSTGRES:
        return psycopg2.connect(DB_URL)
    else:
        conn = sqlite3.connect("lessons.db")
        conn.row_factory = sqlite3.Row
        return conn

def init_db():
    conn = get_db_connection()
    cursor = conn.cursor()
    
    if USE_POSTGRES:
        cursor.execute('''
            CREATE TABLE IF NOT EXISTS lessons (
                session_id TEXT PRIMARY KEY,
                user_id TEXT,
                title TEXT,
                summary TEXT,
                key_points TEXT,
                questions TEXT,
                transcript TEXT,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
        ''')
    else:
        cursor.execute('''
            CREATE TABLE IF NOT EXISTS lessons (
                session_id TEXT PRIMARY KEY,
                user_id TEXT,
                title TEXT,
                summary TEXT,
                key_points TEXT,
                questions TEXT,
                transcript TEXT,
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP
            )
        ''')
        
    conn.commit()
    cursor.close()
    conn.close()
    
    db_name = "Postgres" if USE_POSTGRES else "SQLite"
    logger.info(f"{db_name} DB Initialized Successfully")

def save_lesson(session_id, user_id, title, summary, key_points, questions, transcript):
    conn = get_db_connection()
    cursor = conn.cursor()
    
    kp_str = json.dumps(key_points) if isinstance(key_points, list) else key_points
    q_str = json.dumps(questions) if isinstance(questions, list) else questions
    
    if USE_POSTGRES:
        query = '''
            INSERT INTO lessons (session_id, user_id, title, summary, key_points, questions, transcript)
            VALUES (%s, %s, %s, %s, %s, %s, %s)
        '''
    else:
        query = '''
            INSERT INTO lessons (session_id, user_id, title, summary, key_points, questions, transcript)
            VALUES (?, ?, ?, ?, ?, ?, ?)
        '''
        
    cursor.execute(query, (session_id, user_id, title, summary, kp_str, q_str, transcript))
    conn.commit()
    cursor.close()
    conn.close()

def get_user_history(user_id):
    conn = get_db_connection()
    
    if USE_POSTGRES:
        cursor = conn.cursor(cursor_factory=RealDictCursor)
        query = '''
            SELECT session_id, title, created_at 
            FROM lessons 
            WHERE user_id = %s 
            ORDER BY created_at DESC
        '''
    else:
        cursor = conn.cursor()
        query = '''
            SELECT session_id, title, created_at 
            FROM lessons 
            WHERE user_id = ? 
            ORDER BY created_at DESC
        '''
        
    cursor.execute(query, (user_id,))
    rows = cursor.fetchall()
    cursor.close()
    conn.close()
    
    result = []
    for row in rows:
        r = dict(row)
        if USE_POSTGRES and 'created_at' in r and r['created_at']:
            r['created_at'] = r['created_at'].isoformat()
        result.append(r)
        
    return result

def get_lesson_by_id(session_id, user_id):
    conn = get_db_connection()
    
    if USE_POSTGRES:
        cursor = conn.cursor(cursor_factory=RealDictCursor)
        query = '''
            SELECT session_id, title, summary, key_points, questions, transcript 
            FROM lessons 
            WHERE session_id = %s AND user_id = %s
        '''
    else:
        cursor = conn.cursor()
        query = '''
            SELECT session_id, title, summary, key_points, questions, transcript 
            FROM lessons 
            WHERE session_id = ? AND user_id = ?
        '''
        
    cursor.execute(query, (session_id, user_id))
    row = cursor.fetchone()
    cursor.close()
    conn.close()
    
    return dict(row) if row else None