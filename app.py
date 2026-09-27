import os
import json
import base64
import secrets
import string
from flask import Flask, render_template, request, jsonify, session, send_file
from cryptography.fernet import Fernet
from hashlib import pbkdf2_hmac

app = Flask(__name__)
app.secret_key = secrets.token_hex(32)

VAULT_FILE = "vault.json"

def key_from_password(password: str, salt: bytes) -> bytes:
    raw = pbkdf2_hmac("sha256", password.encode(), salt, 200_000, 32)
    return base64.urlsafe_b64encode(raw)

def read_vault_file():
    if not os.path.exists(VAULT_FILE):
        return None
    with open(VAULT_FILE, "r", encoding="utf-8") as f:
        return json.load(f)

def write_vault_file(salt: bytes, blob: str):
    with open(VAULT_FILE, "w", encoding="utf-8") as f:
        json.dump({"salt": base64.b64encode(salt).decode(), "blob": blob}, f, indent=2)

def calculate_strength(pwd: str) -> dict:
    if not pwd:
        return {"score": 0, "label": "None", "color": "#64748b"}
    score = 0
    if len(pwd) >= 8: score += 1
    if len(pwd) >= 14: score += 1
    if any(c.isupper() for c in pwd): score += 1
    if any(c.islower() for c in pwd): score += 1
    if any(c.isdigit() for c in pwd): score += 1
    if any(c in string.punctuation for c in pwd): score += 1

    if score <= 2:
        return {"score": 1, "label": "Weak", "color": "#ef4444"}
    elif score <= 4:
        return {"score": 2, "label": "Medium", "color": "#f59e0b"}
    elif score <= 5:
        return {"score": 3, "label": "Strong", "color": "#10b981"}
    else:
        return {"score": 4, "label": "Very Strong", "color": "#06b6d4"}

@app.route("/")
def index():
    return render_template("index.html")

@app.route("/api/status", methods=["GET"])
def vault_status():
    exists = os.path.exists(VAULT_FILE)
    unlocked = "vault_key" in session
    return jsonify({
        "initialized": exists,
        "unlocked": unlocked
    })

@app.route("/api/setup", methods=["POST"])
def setup_vault():
    data = request.json or {}
    master = data.get("master_password", "").strip()
    if len(master) < 6:
        return jsonify({"error": "Master password must be at least 6 characters long."}), 400
    
    salt = os.urandom(16)
    key = key_from_password(master, salt)
    f = Fernet(key)
    empty_records = {}
    blob = f.encrypt(json.dumps(empty_records).encode()).decode()
    write_vault_file(salt, blob)

    session["vault_key"] = key.decode()
    return jsonify({"success": True, "message": "Vault successfully created and unlocked."})

@app.route("/api/unlock", methods=["POST"])
def unlock_vault():
    data = request.json or {}
    master = data.get("master_password", "").strip()
    vault_data = read_vault_file()
    if not vault_data:
        return jsonify({"error": "Vault is not initialized. Please set up a master password."}), 400

    try:
        salt = base64.b64decode(vault_data["salt"])
        key = key_from_password(master, salt)
        f = Fernet(key)
        # Test decryption
        f.decrypt(vault_data["blob"].encode())
        session["vault_key"] = key.decode()
        return jsonify({"success": True, "message": "Vault unlocked."})
    except Exception:
        return jsonify({"error": "Invalid master password or corrupted vault."}), 401

@app.route("/api/lock", methods=["POST"])
def lock_vault():
    session.pop("vault_key", None)
    return jsonify({"success": True, "message": "Vault locked."})

def get_current_vault():
    if "vault_key" not in session:
        return None, "Vault is locked"
    vault_data = read_vault_file()
    if not vault_data:
        return None, "Vault file not found"
    try:
        f = Fernet(session["vault_key"].encode())
        records = json.loads(f.decrypt(vault_data["blob"].encode()).decode())
        return records, None
    except Exception as e:
        return None, str(e)

def save_current_vault(records):
    if "vault_key" not in session:
        return False, "Vault is locked"
    vault_data = read_vault_file()
    if not vault_data:
        return False, "Vault file not found"
    salt = base64.b64decode(vault_data["salt"])
    f = Fernet(session["vault_key"].encode())
    blob = f.encrypt(json.dumps(records).encode()).decode()
    write_vault_file(salt, blob)
    return True, None

@app.route("/api/passwords", methods=["GET"])
def list_passwords():
    records, err = get_current_vault()
    if err:
        return jsonify({"error": err}), 403
    
    items = []
    weak_count = 0
    reused_map = {}

    for site_id, item in records.items():
        pwd = item.get("password", "")
        strength = calculate_strength(pwd)
        if strength["score"] <= 2:
            weak_count += 1
        reused_map[pwd] = reused_map.get(pwd, 0) + 1

        items.append({
            "id": site_id,
            "site": item.get("site", site_id),
            "username": item.get("username", ""),
            "password": pwd,
            "category": item.get("category", "General"),
            "url": item.get("url", ""),
            "notes": item.get("notes", ""),
            "updated_at": item.get("updated_at", ""),
            "strength": strength
        })

    reused_count = sum(1 for pwd, count in reused_map.items() if count > 1)
    health_score = max(0, 100 - (weak_count * 20) - (reused_count * 15)) if items else 100

    return jsonify({
        "passwords": sorted(items, key=lambda x: x["site"].lower()),
        "audit": {
            "total": len(items),
            "weak_count": weak_count,
            "reused_count": reused_count,
            "health_score": health_score
        }
    })

@app.route("/api/passwords", methods=["POST"])
def save_password():
    records, err = get_current_vault()
    if err:
        return jsonify({"error": err}), 403

    data = request.json or {}
    site = data.get("site", "").strip()
    username = data.get("username", "").strip()
    password = data.get("password", "").strip()
    category = data.get("category", "General").strip()
    url = data.get("url", "").strip()
    notes = data.get("notes", "").strip()
    entry_id = data.get("id") or secrets.token_hex(6)

    if not site or not password:
        return jsonify({"error": "Service/Site name and Password are required."}), 400

    records[entry_id] = {
        "id": entry_id,
        "site": site,
        "username": username,
        "password": password,
        "category": category,
        "url": url,
        "notes": notes,
        "updated_at": secrets.token_hex(3)
    }

    ok, save_err = save_current_vault(records)
    if not ok:
        return jsonify({"error": save_err}), 500

    return jsonify({"success": True, "id": entry_id})

@app.route("/api/passwords/<entry_id>", methods=["DELETE"])
def delete_password(entry_id):
    records, err = get_current_vault()
    if err:
        return jsonify({"error": err}), 403

    if entry_id in records:
        del records[entry_id]
        save_current_vault(records)
        return jsonify({"success": True})
    return jsonify({"error": "Record not found."}), 404

@app.route("/api/generate", methods=["POST"])
def generate_password():
    data = request.json or {}
    length = max(8, min(64, int(data.get("length", 16))))
    use_upper = data.get("uppercase", True)
    use_lower = data.get("lowercase", True)
    use_digits = data.get("digits", True)
    use_symbols = data.get("symbols", True)

    char_pool = ""
    guaranteed = []

    if use_upper:
        char_pool += string.ascii_uppercase
        guaranteed.append(secrets.choice(string.ascii_uppercase))
    if use_lower:
        char_pool += string.ascii_lowercase
        guaranteed.append(secrets.choice(string.ascii_lowercase))
    if use_digits:
        char_pool += string.digits
        guaranteed.append(secrets.choice(string.digits))
    if use_symbols:
        symbols = "!@#$%^&*()-_=+[]{}|;:,.<>?"
        char_pool += symbols
        guaranteed.append(secrets.choice(symbols))

    if not char_pool:
        char_pool = string.ascii_letters + string.digits

    remaining_len = length - len(guaranteed)
    pwd_chars = guaranteed + [secrets.choice(char_pool) for _ in range(remaining_len)]
    # Shuffle cryptographically
    shuffled = "".join(secrets.SystemRandom().sample(pwd_chars, len(pwd_chars)))

    return jsonify({
        "password": shuffled,
        "strength": calculate_strength(shuffled)
    })

if __name__ == "__main__":
    app.run(debug=True, port=5000)
