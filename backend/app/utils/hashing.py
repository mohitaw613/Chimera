"""
Hashing utilities for evidence integrity and reproducibility.
"""

import hashlib
from typing import BinaryIO


def calculate_sha256(content: bytes) -> str:
    """Compute SHA-256 hex digest of raw bytes."""
    hasher = hashlib.sha256()
    hasher.update(content)
    return hasher.hexdigest()


def calculate_file_sha256(file_obj: BinaryIO, chunk_size: int = 65536) -> str:
    """Compute SHA-256 hex digest of a file stream."""
    hasher = hashlib.sha256()
    file_obj.seek(0)
    while chunk := file_obj.read(chunk_size):
        hasher.update(chunk)
    file_obj.seek(0)
    return hasher.hexdigest()
