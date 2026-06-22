#!/usr/bin/env python3
"""Reset the admin password from the command line.

Usage (inside the container):
    python reset_password.py <username> <new_password>

Usage via docker compose:
    docker compose exec backend python reset_password.py admin newpassword123
"""
import sys
from database import SessionLocal, User
from auth import hash_password

def main():
    if len(sys.argv) != 3:
        print("Usage: python reset_password.py <username> <new_password>")
        sys.exit(1)

    username, new_password = sys.argv[1], sys.argv[2]
    if len(new_password) < 8:
        print("Error: password must be at least 8 characters")
        sys.exit(1)

    db = SessionLocal()
    try:
        user = db.query(User).filter(User.username == username).first()
        if not user:
            print(f"Error: user '{username}' not found")
            users = db.query(User).all()
            if users:
                print(f"Existing users: {', '.join(u.username for u in users)}")
            sys.exit(1)
        user.hashed_password = hash_password(new_password)
        db.commit()
        print(f"Password for '{username}' updated successfully.")
    finally:
        db.close()

if __name__ == "__main__":
    main()
