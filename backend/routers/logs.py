import asyncio
import json

from fastapi import APIRouter, Query, HTTPException
from fastapi.responses import StreamingResponse
from jose import JWTError, jwt

from auth import ALGORITHM, _get_secret
from database import SessionLocal, User
from log_buffer import snapshot, lines_from

router = APIRouter(prefix="/admin/logs", tags=["logs"])


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


@router.get("/stream")
async def stream_logs(token: str = Query(...)):
    if not _verify_admin(token):
        raise HTTPException(status_code=403, detail="Admin access required")

    async def generate():
        lines, pos = snapshot()
        for line in lines:
            yield f"data: {json.dumps(line)}\n\n"
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
