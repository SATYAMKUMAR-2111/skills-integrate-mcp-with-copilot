"""
High School Management System API

A simple FastAPI application that allows students to view and sign up
for extracurricular activities at Mergington High School, with basic
user authentication and profile management.
"""

import hashlib
import hmac
import json
import secrets
import uuid
from datetime import datetime
from pathlib import Path
from typing import Any, Dict, List, Optional

from fastapi import Depends, FastAPI, Header, HTTPException
from fastapi.responses import RedirectResponse
from fastapi.staticfiles import StaticFiles

app = FastAPI(
    title="Mergington High School API",
    description="API for viewing and signing up for extracurricular activities",
)

# Mount the static files directory
current_dir = Path(__file__).parent
app.mount(
    "/static",
    StaticFiles(directory=current_dir / "static"),
    name="static",
)

# Data storage for registered users
DATA_DIR = current_dir / "data"
DATA_DIR.mkdir(exist_ok=True)
USERS_FILE = DATA_DIR / "users.json"


def ensure_json_file(path: Path, default: Any) -> None:
    if not path.exists():
        path.write_text(json.dumps(default, indent=2), encoding="utf-8")


ensure_json_file(USERS_FILE, [])


def load_users() -> List[Dict[str, Any]]:
    with USERS_FILE.open("r", encoding="utf-8") as file:
        return json.load(file)


def save_users(users: List[Dict[str, Any]]) -> None:
    with USERS_FILE.open("w", encoding="utf-8") as file:
        json.dump(users, file, indent=2)


def hash_password(password: str) -> str:
    salt = secrets.token_hex(16)
    digest = hashlib.pbkdf2_hmac(
        "sha256",
        password.encode("utf-8"),
        salt.encode("utf-8"),
        100_000,
    )
    return f"{salt}${digest.hex()}"


def verify_password(password: str, stored_password: str) -> bool:
    try:
        salt, digest = stored_password.split("$", 1)
    except ValueError:
        return False

    computed = hashlib.pbkdf2_hmac(
        "sha256",
        password.encode("utf-8"),
        salt.encode("utf-8"),
        100_000,
    )
    return hmac.compare_digest(computed.hex(), digest)


def find_user(email: str) -> Optional[Dict[str, Any]]:
    normalized = email.strip().lower()
    return next(
        (user for user in load_users() if user["email"].lower() == normalized),
        None,
    )


def find_user_index(email: str) -> Optional[int]:
    normalized = email.strip().lower()
    users = load_users()
    for index, user in enumerate(users):
        if user["email"].lower() == normalized:
            return index
    return None


def public_user_data(user: Dict[str, Any]) -> Dict[str, Any]:
    return {
        "email": user["email"],
        "name": user.get("name", ""),
        "role": user.get("role", "student"),
        "verified": user.get("verified", False),
        "created_at": user.get("created_at"),
    }


session_tokens: Dict[str, str] = {}


def get_current_user(authorization: str = Header(default=None)) -> Dict[str, Any]:
    if not authorization:
        raise HTTPException(status_code=401, detail="Missing Authorization header")

    parts = authorization.split()
    if len(parts) != 2 or parts[0].lower() != "bearer":
        raise HTTPException(status_code=401, detail="Invalid Authorization header")

    token = parts[1]
    email = session_tokens.get(token)
    if not email:
        raise HTTPException(status_code=401, detail="Invalid or expired token")

    user = find_user(email)
    if not user:
        raise HTTPException(status_code=401, detail="User not found")

    return user


def resolve_email(email: Optional[str], authorization: str = Header(default=None)) -> str:
    if authorization:
        user = get_current_user(authorization)
        return user["email"]

    if not email:
        raise HTTPException(status_code=400, detail="Email is required")

    return email.strip().lower()


# In-memory activity database
activities = {
    "Chess Club": {
        "description": "Learn strategies and compete in chess tournaments",
        "schedule": "Fridays, 3:30 PM - 5:00 PM",
        "max_participants": 12,
        "participants": ["michael@mergington.edu", "daniel@mergington.edu"],
    },
    "Programming Class": {
        "description": "Learn programming fundamentals and build software projects",
        "schedule": "Tuesdays and Thursdays, 3:30 PM - 4:30 PM",
        "max_participants": 20,
        "participants": ["emma@mergington.edu", "sophia@mergington.edu"],
    },
    "Gym Class": {
        "description": "Physical education and sports activities",
        "schedule": "Mondays, Wednesdays, Fridays, 2:00 PM - 3:00 PM",
        "max_participants": 30,
        "participants": ["john@mergington.edu", "olivia@mergington.edu"],
    },
    "Soccer Team": {
        "description": "Join the school soccer team and compete in matches",
        "schedule": "Tuesdays and Thursdays, 4:00 PM - 5:30 PM",
        "max_participants": 22,
        "participants": ["liam@mergington.edu", "noah@mergington.edu"],
    },
    "Basketball Team": {
        "description": "Practice and play basketball with the school team",
        "schedule": "Wednesdays and Fridays, 3:30 PM - 5:00 PM",
        "max_participants": 15,
        "participants": ["ava@mergington.edu", "mia@mergington.edu"],
    },
    "Art Club": {
        "description": "Explore your creativity through painting and drawing",
        "schedule": "Thursdays, 3:30 PM - 5:00 PM",
        "max_participants": 15,
        "participants": ["amelia@mergington.edu", "harper@mergington.edu"],
    },
    "Drama Club": {
        "description": "Act, direct, and produce plays and performances",
        "schedule": "Mondays and Wednesdays, 4:00 PM - 5:30 PM",
        "max_participants": 20,
        "participants": ["ella@mergington.edu", "scarlett@mergington.edu"],
    },
    "Math Club": {
        "description": "Solve challenging problems and participate in math competitions",
        "schedule": "Tuesdays, 3:30 PM - 4:30 PM",
        "max_participants": 10,
        "participants": ["james@mergington.edu", "benjamin@mergington.edu"],
    },
    "Debate Team": {
        "description": "Develop public speaking and argumentation skills",
        "schedule": "Fridays, 4:00 PM - 5:30 PM",
        "max_participants": 12,
        "participants": ["charlotte@mergington.edu", "henry@mergington.edu"],
    },
}


@app.get("/")
def root():
    return RedirectResponse(url="/static/index.html")


@app.get("/activities")
def get_activities():
    return activities


@app.post("/activities/{activity_name}/signup")
def signup_for_activity(
    activity_name: str,
    email: Optional[str] = None,
    authorization: str = Header(default=None),
):
    actual_email = resolve_email(email, authorization)

    if activity_name not in activities:
        raise HTTPException(status_code=404, detail="Activity not found")

    activity = activities[activity_name]
    if actual_email in activity["participants"]:
        raise HTTPException(status_code=400, detail="Student is already signed up")

    activity["participants"].append(actual_email)
    return {"message": f"Signed up {actual_email} for {activity_name}"}


@app.delete("/activities/{activity_name}/unregister")
def unregister_from_activity(
    activity_name: str,
    email: Optional[str] = None,
    authorization: str = Header(default=None),
):
    actual_email = resolve_email(email, authorization)

    if activity_name not in activities:
        raise HTTPException(status_code=404, detail="Activity not found")

    activity = activities[activity_name]
    if actual_email not in activity["participants"]:
        raise HTTPException(
            status_code=400,
            detail="Student is not signed up for this activity",
        )

    activity["participants"].remove(actual_email)
    return {"message": f"Unregistered {actual_email} from {activity_name}"}


@app.post("/auth/register")
def register_user(email: str, password: str, name: str = "", role: str = "student"):
    normalized_email = email.strip().lower()
    if find_user(normalized_email):
        raise HTTPException(status_code=400, detail="A user with that email already exists")

    if role not in {"student", "teacher"}:
        raise HTTPException(status_code=400, detail="Role must be either 'student' or 'teacher'")

    user = {
        "email": normalized_email,
        "name": name.strip(),
        "role": role,
        "password": hash_password(password),
        "verified": False,
        "verification_code": secrets.token_urlsafe(16),
        "created_at": datetime.utcnow().isoformat() + "Z",
    }

    users = load_users()
    users.append(user)
    save_users(users)

    return {
        "message": "User registered successfully",
        "email": normalized_email,
        "verification_code": user["verification_code"],
        "next_step": "Verify your email by calling POST /auth/verify-email",
    }


@app.post("/auth/login")
def login_user(email: str, password: str):
    user = find_user(email)
    if not user or not verify_password(password, user["password"]):
        raise HTTPException(status_code=401, detail="Invalid email or password")

    token = uuid.uuid4().hex
    session_tokens[token] = user["email"]

    return {"token": token, "user": public_user_data(user)}


@app.get("/auth/me")
def get_profile(current_user: Dict[str, Any] = Depends(get_current_user)):
    return public_user_data(current_user)


@app.put("/auth/me")
def update_profile(
    name: Optional[str] = None,
    current_user: Dict[str, Any] = Depends(get_current_user),
):
    if not name:
        raise HTTPException(status_code=400, detail="Name is required")

    users = load_users()
    index = find_user_index(current_user["email"])
    if index is None:
        raise HTTPException(status_code=404, detail="User not found")

    users[index]["name"] = name.strip()
    save_users(users)
    return public_user_data(users[index])


@app.post("/auth/me/password")
def change_password(
    old_password: str,
    new_password: str,
    current_user: Dict[str, Any] = Depends(get_current_user),
):
    if not verify_password(old_password, current_user["password"]):
        raise HTTPException(status_code=401, detail="Old password is incorrect")

    users = load_users()
    index = find_user_index(current_user["email"])
    if index is None:
        raise HTTPException(status_code=404, detail="User not found")

    users[index]["password"] = hash_password(new_password)
    save_users(users)

    return {"message": "Password updated successfully"}


@app.post("/auth/verify-email")
def verify_email(email: str, code: str):
    user = find_user(email)
    if not user:
        raise HTTPException(status_code=404, detail="User not found")

    if user.get("verified"):
        return {"message": "Email already verified"}

    if user.get("verification_code") != code:
        raise HTTPException(status_code=400, detail="Verification code is invalid")

    users = load_users()
    index = find_user_index(email)
    users[index]["verified"] = True
    save_users(users)

    return {"message": "Email verified successfully"}
