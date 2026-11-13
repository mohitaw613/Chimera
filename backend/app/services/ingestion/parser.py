"""
Evidence file parsers for CSV, JSON, and JSONL.
Spec reference: 01_PRODUCT_AND_REASONING_SPEC.md §2, 02_ARCHITECTURE_DATA_API.md §5.2.
"""

import csv
import io
import json
from typing import Any, Dict, List, Tuple


class ParseError:
    def __init__(self, row: int, reason: str):
        self.row = row
        self.reason = reason

    def to_dict(self) -> Dict[str, Any]:
        return {"row": self.row, "reason": self.reason}


class BaseParser:
    def parse(self, content: bytes) -> Tuple[List[Tuple[int, Dict[str, Any]]], List[ParseError]]:
        raise NotImplementedError


class CSVParser(BaseParser):
    def parse(self, content: bytes) -> Tuple[List[Tuple[int, Dict[str, Any]]], List[ParseError]]:
        records: List[Tuple[int, Dict[str, Any]]] = []
        errors: List[ParseError] = []

        try:
            text = content.decode("utf-8-sig", errors="replace")
            reader = csv.DictReader(io.StringIO(text))
            if not reader.fieldnames:
                errors.append(ParseError(row=1, reason="CSV header missing or empty"))
                return records, errors

            for row_idx, row in enumerate(reader, start=2):
                try:
                    clean_row = {k.strip(): v.strip() if isinstance(v, str) else v for k, v in row.items() if k}
                    records.append((row_idx, clean_row))
                except Exception as ex:
                    errors.append(ParseError(row=row_idx, reason=f"Failed to parse CSV row: {str(ex)}"))
        except Exception as ex:
            errors.append(ParseError(row=1, reason=f"Failed to decode CSV: {str(ex)}"))

        return records, errors


class JSONParser(BaseParser):
    def parse(self, content: bytes) -> Tuple[List[Tuple[int, Dict[str, Any]]], List[ParseError]]:
        records: List[Tuple[int, Dict[str, Any]]] = []
        errors: List[ParseError] = []

        try:
            data = json.loads(content.decode("utf-8", errors="replace"))
            items: List[Any] = []
            if isinstance(data, list):
                items = data
            elif isinstance(data, dict):
                if "events" in data and isinstance(data["events"], list):
                    items = data["events"]
                elif "records" in data and isinstance(data["records"], list):
                    items = data["records"]
                else:
                    items = [data]
            else:
                errors.append(ParseError(row=1, reason="Top-level JSON must be array or object with 'events'/'records' key"))
                return records, errors

            for idx, item in enumerate(items, start=1):
                if isinstance(item, dict):
                    records.append((idx, item))
                else:
                    errors.append(ParseError(row=idx, reason="JSON array element must be an object"))
        except Exception as ex:
            errors.append(ParseError(row=1, reason=f"Invalid JSON syntax: {str(ex)}"))

        return records, errors


class JSONLParser(BaseParser):
    def parse(self, content: bytes) -> Tuple[List[Tuple[int, Dict[str, Any]]], List[ParseError]]:
        records: List[Tuple[int, Dict[str, Any]]] = []
        errors: List[ParseError] = []

        lines = content.decode("utf-8", errors="replace").splitlines()
        for row_idx, line in enumerate(lines, start=1):
            line_str = line.strip()
            if not line_str:
                continue
            try:
                item = json.loads(line_str)
                if isinstance(item, dict):
                    records.append((row_idx, item))
                else:
                    errors.append(ParseError(row=row_idx, reason="Line is valid JSON but not an object"))
            except Exception as ex:
                errors.append(ParseError(row=row_idx, reason=f"Invalid JSONL line: {str(ex)}"))

        return records, errors


def get_parser_for_filename(filename: str) -> BaseParser:
    lower = filename.lower()
    if lower.endswith(".csv"):
        return CSVParser()
    if lower.endswith(".jsonl"):
        return JSONLParser()
    if lower.endswith(".json"):
        return JSONParser()
    raise ValueError(f"Unsupported file extension for '{filename}'. Allowed: .csv, .json, .jsonl")
