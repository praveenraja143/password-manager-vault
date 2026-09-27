# Aegis Vault • Secure Password Manager Web App 🛡️🔐

![Python](https://img.shields.io/badge/Python-3.11+-3776AB?style=for-the-badge&logo=python&logoColor=white)
![Flask](https://img.shields.io/badge/Flask-3.x-black?style=for-the-badge&logo=flask&logoColor=white)
![Cryptography](https://img.shields.io/badge/Encryption-PBKDF2%20%2B%20AES--Fernet-06b6d4?style=for-the-badge)
![License](https://img.shields.io/badge/License-MIT-blue?style=for-the-badge)

A modern, production-grade password manager web application built with Python (Flask) and a state-of-the-art cyberpunk glassmorphic web interface.

Converted from a basic Python CLI exercise into an enterprise-ready, locally encrypted web application with zero telemetry and full privacy.

---

## ✨ Features

- 🔐 **Military-Grade Encryption**: Uses **PBKDF2 (SHA-256 with 200,000 iterations)** for master key derivation and **Fernet (AES-128 in CBC mode with HMAC)** for authenticated data encryption.
- 🩺 **Security Health Audit**: Real-time evaluation of password entropy, flagging weak or reused credentials across all accounts.
- ⚡ **Interactive Glassmorphism UI**: Premium dark cyberpunk aesthetic, smooth micro-animations, and responsive layout.
- 🎲 **Custom Password Generator**: Generate cryptographically secure passwords with customizable length, symbols, digits, and casing.
- 📋 **Zero-Clipboard Leakage**: Instant copy-to-clipboard with visual toast feedback.
- 🗂️ **Category Organization**: Categorize accounts into Personal, Work, Finance, Social, or General.
- 🔍 **Instant Search & Hotkeys**: Real-time search by service, email, or notes with quick `Ctrl+K` hotkey support.
- 🔒 **One-Click Session Locking**: Securely lock the vault at any moment, zeroing decrypted memory.

---

## 🚀 Quick Start

### 1. Prerequisites
- Python 3.10+ installed

### 2. Installation
```bash
# Clone the repository
git clone https://github.com/praveenraja143/password-manager-vault.git
cd password-manager-vault

# Install dependencies
pip install -r requirements.txt
```

### 3. Run the Web Application
```bash
python app.py
```
Open your browser and navigate to:
```
http://localhost:5000
```

---

## 🔒 Security Architecture

```
[Master Password] + [Unique 16-byte Salt]
                    │
                    ▼
     PBKDF2 HMAC-SHA256 (200k iter)
                    │
                    ▼
          Fernet AES Symmetric Key
                    │
       ┌────────────┴────────────┐
       ▼                         ▼
 Decrypt on Unlock        Encrypt on Save
       │                         │
[Plaintext In-Memory]     [vault.json Ciphertext]
```

---

## 🛠️ Tech Stack
- **Backend**: Python 3, Flask, Cryptography (Fernet & PBKDF2 HMAC)
- **Frontend**: Modern Vanilla JavaScript (ES6+), Semantic HTML5, Vanilla CSS3 (Glassmorphism & CSS Grid)
- **Icons**: FontAwesome 6 Pro-free
- **Fonts**: Plus Jakarta Sans & JetBrains Mono

---

## 📄 License
This project is open-source and licensed under the [MIT License](LICENSE).
