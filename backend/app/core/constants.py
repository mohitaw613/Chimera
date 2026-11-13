"""
Constants for CHIMERA.
Source of truth: 01_PRODUCT_AND_REASONING_SPEC.md & 02_ARCHITECTURE_DATA_API.md.
All thresholds, aliases, enums, and weights are defined here.
Never hardcode outside this module.
"""

from enum import Enum
from typing import Dict, List, Set, Tuple

# Ingestion & Upload limits
MAX_UPLOAD_MB = 25

# Time windows & thresholds (in seconds)
DELAY_THRESHOLD_SECONDS = 300               # 5 minutes
CLOCK_SKEW_TOLERANCE_SECONDS = 2            # 2 seconds
CORRELATION_WINDOW_SECONDS = 900            # 15 minutes
BUSINESS_HOURS_START = 7                    # 07:00 UTC
BUSINESS_HOURS_END = 19                     # 19:00 UTC
DENSE_N = 4                                 # signals threshold for dense_sequence

# Prefix conventions for entity classification
DEVICE_PREFIXES: Tuple[str, ...] = ("srv-", "ws-", "host-")
SERVICE_ACCOUNT_PREFIXES: Tuple[str, ...] = ("svc_", "svc-", "service_")

# Epistemic statuses
STATUS_OBSERVED = "observed"
STATUS_INFERRED = "inferred"
STATUS_NEEDS_VERIFICATION = "needs_verification"

EPISTEMIC_STATUSES: Set[str] = {
    STATUS_OBSERVED,
    STATUS_INFERRED,
    STATUS_NEEDS_VERIFICATION,
}

# Node types
NODE_USER = "USER"
NODE_DEVICE = "DEVICE"
NODE_SERVICE = "SERVICE"
NODE_IP = "IP"
NODE_EVENT = "EVENT"
NODE_EXTERNAL = "EXTERNAL"

NODE_TYPES: Set[str] = {
    NODE_USER,
    NODE_DEVICE,
    NODE_SERVICE,
    NODE_IP,
    NODE_EVENT,
    NODE_EXTERNAL,
}

# Edge types
EDGE_AUTHENTICATED_TO = "AUTHENTICATED_TO"
EDGE_ACCESSED = "ACCESSED"
EDGE_CONNECTED_TO = "CONNECTED_TO"
EDGE_MODIFIED = "MODIFIED"
EDGE_ASSOCIATED_WITH = "ASSOCIATED_WITH"

EDGE_TYPES: Set[str] = {
    EDGE_AUTHENTICATED_TO,
    EDGE_ACCESSED,
    EDGE_CONNECTED_TO,
    EDGE_MODIFIED,
    EDGE_ASSOCIATED_WITH,
}

# Event types
EVENT_TYPE_AUTHENTICATION = "authentication"
EVENT_TYPE_SERVICE_ACCESS = "service_access"
EVENT_TYPE_PRIVILEGE_CHANGE = "privilege_change"
EVENT_TYPE_EXTERNAL_CONNECTION = "external_connection"
EVENT_TYPE_MAINTENANCE = "maintenance"
EVENT_TYPE_OTHER = "other"

EVENT_TYPES: Set[str] = {
    EVENT_TYPE_AUTHENTICATION,
    EVENT_TYPE_SERVICE_ACCESS,
    EVENT_TYPE_PRIVILEGE_CHANGE,
    EVENT_TYPE_EXTERNAL_CONNECTION,
    EVENT_TYPE_MAINTENANCE,
    EVENT_TYPE_OTHER,
}

# Outcome types
OUTCOME_SUCCESS = "success"
OUTCOME_FAILURE = "failure"
OUTCOME_UNKNOWN = "unknown"

OUTCOMES: Set[str] = {
    OUTCOME_SUCCESS,
    OUTCOME_FAILURE,
    OUTCOME_UNKNOWN,
}

# Timestamp statuses
TIMESTAMP_STATUS_OK = "ok"
TIMESTAMP_STATUS_MISSING = "missing"
TIMESTAMP_STATUS_MALFORMED = "malformed"
TIMESTAMP_STATUS_NAIVE = "naive_assumed_utc"

TIMESTAMP_STATUSES: Set[str] = {
    TIMESTAMP_STATUS_OK,
    TIMESTAMP_STATUS_MISSING,
    TIMESTAMP_STATUS_MALFORMED,
    TIMESTAMP_STATUS_NAIVE,
}

# Arrival flags (primary label priority: timestamp_uncertain > out_of_order > delayed > normal)
FLAG_TIMESTAMP_UNCERTAIN = "timestamp_uncertain"
FLAG_OUT_OF_ORDER = "out_of_order"
FLAG_DELAYED = "delayed"
FLAG_NORMAL = "normal"
FLAG_ORDERING_AMBIGUOUS = "ordering_ambiguous"

FLAG_PRIORITY: List[str] = [
    FLAG_TIMESTAMP_UNCERTAIN,
    FLAG_OUT_OF_ORDER,
    FLAG_DELAYED,
    FLAG_NORMAL,
]

# Field aliases for ingestion normalization (spec 01 §2.2)
FIELD_ALIASES: Dict[str, List[str]] = {
    "event_time": ["timestamp", "event_time", "time", "@timestamp", "eventtime", "ts"],
    "ingested_at": ["ingested_at", "ingest_time", "received_at", "arrival_time"],
    "event_type": ["event_type", "type", "category", "action"],
    "actor": ["actor", "user", "account", "username", "src_user"],
    "source_device": ["source_device", "host", "device", "src_host", "computer", "workstation"],
    "target": ["target", "service", "dest_host", "dst_host", "resource", "destination"],
    "source_ip": ["source_ip", "src_ip", "ip", "client_ip"],
    "dest_ip": ["dest_ip", "dst_ip", "remote_ip"],
    "outcome": ["outcome", "result", "status", "success"],
    "source": ["source", "log_source", "sourcetype"],
}

# Keywords for mapping raw action/type strings to canonical event_type
EVENT_TYPE_KEYWORD_MAPPINGS: Dict[str, str] = {
    "login": EVENT_TYPE_AUTHENTICATION,
    "logon": EVENT_TYPE_AUTHENTICATION,
    "auth": EVENT_TYPE_AUTHENTICATION,
    "access": EVENT_TYPE_SERVICE_ACCESS,
    "read": EVENT_TYPE_SERVICE_ACCESS,
    "open": EVENT_TYPE_SERVICE_ACCESS,
    "privilege": EVENT_TYPE_PRIVILEGE_CHANGE,
    "role": EVENT_TYPE_PRIVILEGE_CHANGE,
    "elevat": EVENT_TYPE_PRIVILEGE_CHANGE,
    "sudo": EVENT_TYPE_PRIVILEGE_CHANGE,
    "connect": EVENT_TYPE_EXTERNAL_CONNECTION,
    "outbound": EVENT_TYPE_EXTERNAL_CONNECTION,
    "egress": EVENT_TYPE_EXTERNAL_CONNECTION,
    "maintenance": EVENT_TYPE_MAINTENANCE,
    "change_ticket": EVENT_TYPE_MAINTENANCE,
    "approved": EVENT_TYPE_MAINTENANCE,
}

# Outcome value mappings
OUTCOME_KEYWORD_MAPPINGS: Dict[str, str] = {
    "true": OUTCOME_SUCCESS,
    "success": OUTCOME_SUCCESS,
    "successful": OUTCOME_SUCCESS,
    "ok": OUTCOME_SUCCESS,
    "0": OUTCOME_SUCCESS,
    "false": OUTCOME_FAILURE,
    "failure": OUTCOME_FAILURE,
    "failed": OUTCOME_FAILURE,
    "denied": OUTCOME_FAILURE,
    "error": OUTCOME_FAILURE,
    "1": OUTCOME_FAILURE,
}

# Hypotheses definitions
HYPOTHESIS_H1_KEY = "H1"
HYPOTHESIS_H1_NAME = "Potential unauthorized account activity"

HYPOTHESIS_H2_KEY = "H2"
HYPOTHESIS_H2_NAME = "Legitimate administrative / maintenance activity"

HYPOTHESIS_H3_KEY = "H3"
HYPOTHESIS_H3_NAME = "Insufficient evidence to determine the cause"

# Evidence rules table for H1 (spec 01 §6.1)
# Each entry: rule_id, label, e (+1 or -1 for H1), weight w
H1_EVIDENCE_RULES: List[Dict] = [
    {"id": "E1", "label": "Unusual login hour", "e": 1, "w": 2},
    {"id": "E2", "label": "New device association", "e": 1, "w": 2},
    {"id": "E3", "label": "Service account interactive login", "e": 1, "w": 3},
    {"id": "E4", "label": "Privilege change within window after auth/access chain", "e": 1, "w": 3},
    {"id": "E5", "label": "External connection after privilege change", "e": 1, "w": 3},
    {"id": "E6", "label": "Multiple failed logins then success", "e": 1, "w": 2},
    {"id": "E7", "label": "Approved maintenance record covering same target+window", "e": -1, "w": 4},
    {"id": "E8", "label": "Account used same device historically (familiar device)", "e": -1, "w": 2},
    {"id": "E9", "label": "Privilege change record has explicit known admin actor", "e": -1, "w": 2},
]

# Static MITRE ATT&CK technique mapping for initial access / lateral movement
MITRE_MAPPINGS: Dict[str, Dict[str, str]] = {
    "initial_access": {
        "id": "T1078",
        "name": "Valid Accounts",
        "tactic": "Initial Access",
        "caveat": "Contextual, unverified",
    },
    "lateral_movement": {
        "id": "TA0008",
        "name": "Lateral Movement",
        "tactic": "Lateral Movement",
        "caveat": "Contextual, unverified",
    },
    "privilege_escalation": {
        "id": "TA0004",
        "name": "Privilege Escalation",
        "tactic": "Privilege Escalation",
        "caveat": "Contextual, unverified",
    },
    "command_and_control": {
        "id": "TA0011",
        "name": "Command and Control / Exfiltration",
        "tactic": "Command and Control",
        "caveat": "Contextual, unverified",
    },
}

# Blast radius classification tiers
BLAST_DIRECTLY_ASSOCIATED = "directly_associated"
BLAST_INDIRECTLY_ASSOCIATED = "indirectly_associated"
BLAST_UNVERIFIED = "unverified"

# Required UI wording guardrails
HEURISTIC_SCORE_LABEL = "Heuristic investigation score — not attack probability"
BLAST_RADIUS_LABEL = "Potential exposure — not confirmed compromise"
SYNTHETIC_DATA_BADGE = "Synthetic data — for evaluation and demonstration only"
