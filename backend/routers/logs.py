import asyncio
import glob
import json
import os

from fastapi import APIRouter, Query, HTTPException, Depends
from fastapi.responses import StreamingResponse
from jose import JWTError, jwt

from auth import ALGORITHM, _get_secret, require_admin, User
from database import SessionLocal
from log_buffer import snapshot, lines_from

router = APIRouter(prefix="/admin/logs", tags=["logs"])

_LOG_FILE = "/data/tightarse.log"


def _verify_admin(token: str) -> bool:
    db = SessionLocal()
    try:
        secret = _get_secret(db)
        payload = jwt.decode(token, secret, algorithms=[ALGORITHM])
        username = payload.get("sub")
        user = db.query(User).filter(User.username == username, User.is_active == True).first()
        return bool(user and user.role == "admin")
    except (JWTError, Exception):
        return False
    finally:
        db.close()


@router.get("/history")
async def log_history(_admin: User = Depends(require_admin), limit: int = Query(2000)):
    lines: list[str] = []
    try:
        all_files = glob.glob(_LOG_FILE + "*")
        backups = sorted([f for f in all_files if f != _LOG_FILE])
        ordered = backups + ([_LOG_FILE] if os.path.exists(_LOG_FILE) else [])
        for path in ordered:
            with open(path, "r", encoding="utf-8", errors="replace") as f:
                for line in f:
                    lines.append(line.rstrip("\n"))
    except Exception:
        pass
    return {"lines": lines[-limit:]}


@router.get("/stream")
async def stream_logs(token: str = Query(...)):
    if not _verify_admin(token):
        raise HTTPException(status_code=403, detail="Admin access required")

    async def generate():
        _, pos = snapshot()
        while True:
            await asyncio.sleep(0.5)
            new_lines, pos = lines_from(pos)
            for line in new_lines:
                yield f"data: {json.dumps(line)}\n\n"

    return StreamingResponse(
        generate(),
        media_type="text/event-stream",
        headers={"Cache-Control": "no-cache", "X-Accel-Buffering": "no"},
    )
