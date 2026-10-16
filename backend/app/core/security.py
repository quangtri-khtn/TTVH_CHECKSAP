from cryptography.fernet import Fernet
from .config import get_settings
import base64
import os

_fernet: Fernet | None = None


def _get_fernet() -> Fernet:
    global _fernet
    if _fernet is None:
        settings = get_settings()
        key = settings.encryption_key
        if not key:
            key = base64.urlsafe_b64encode(settings.secret_key.encode().ljust(32)[:32]).decode()
        _fernet = Fernet(key.encode() if isinstance(key, str) else key)
    return _fernet


def encrypt(plain: str) -> str:
    return _get_fernet().encrypt(plain.encode()).decode()


def decrypt(token: str) -> str:
    return _get_fernet().decrypt(token.encode()).decode()
