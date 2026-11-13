"""
Common Pydantic schemas and error contracts.
"""

from typing import Optional
from pydantic import BaseModel


class ErrorResponse(BaseModel):
    detail: str
    code: str  # VALIDATION_ERROR | NOT_FOUND | UNSUPPORTED_FILE | FILE_TOO_LARGE | ANALYSIS_FAILED | ANALYSIS_REQUIRED
