#!/usr/bin/env python3
"""
Synthetic scenario generator for CHIMERA.
Derived directly from 04_DATASET_TESTING_ROADMAP.md §2.
Generates:
  - auth_log.csv
  - service_log.jsonl
  - network_log.json
  - change_log.csv
  - Shuffled and delayed variants (*_shuffled.*)
  - ground_truth/scenario.json
Deterministic: random.Random(1337).
"""

import argparse
import csv
import json
import os
import random
from datetime import datetime, timedelta, timezone
from typing import Any, Dict, List, Tuple


def generate_scenario(output_dir: str, ground_truth_dir: str, with_approval: bool = False):
    os.makedirs(output_dir, exist_ok=True)
    os.makedirs(ground_truth_dir, exist_ok=True)

    rng = random.Random(1337)
    base_date = datetime(2026, 11, 12, 0, 0, 0, tzinfo=timezone.utc)

    # Cast definition
    users = ["user_jdoe", "user_asmith", "user_rpatel", "user_bwhite", "user_ckent",
             "user_dprince", "user_ewong", "user_fgarcia", "user_gmurphy", "user_hlee",
             "user_iturner", "user_jkim"]
    workstations = [f"WS-1{i:02d}" for i in range(1, 21)]  # WS-101 .. WS-120
    servers = ["SRV-FILE01", "SRV-DB02", "SRV-BACKUP01"]
    
    # User to familiar workstation mapping
    user_devices = {u: workstations[i % len(workstations)] for i, u in enumerate(users)}
    # jdoe normal workstation is WS-114
    user_devices["user_jdoe"] = "WS-114"

    events_auth: List[Dict[str, Any]] = []
    events_service: List[Dict[str, Any]] = []
    events_network: List[Dict[str, Any]] = []
    events_change: List[Dict[str, Any]] = []

    # 1. Background events (~200 events)
    # Generate background authentication & service activity during business hours (08:00 - 17:00)
    bg_counter = 1

    for u in users:
        # 8-15 normal auth and service access events per user during the day
        num_sessions = rng.randint(8, 12)
        dev = user_devices[u]
        for _ in range(num_sessions):
            hour = rng.randint(8, 16)
            minute = rng.randint(0, 59)
            second = rng.randint(0, 59)
            t_event = base_date.replace(hour=hour, minute=minute, second=second)
            t_ingest = t_event + timedelta(seconds=rng.randint(2, 30))

            # Auth log row
            auth_row = {
                "scenario_key": f"BG_AUTH_{bg_counter:04d}",
                "timestamp": t_event.isoformat(),
                "arrival_time": t_ingest.isoformat(),
                "actor": u,
                "src_host": dev,
                "target": dev,
                "src_ip": f"10.0.1.{rng.randint(10, 250)}",
                "action": "login",
                "status": "success",
                "source": "auth_log.csv",
            }
            events_auth.append(auth_row)

            # Service log row (FileShare or internal web)
            t_service = t_event + timedelta(seconds=rng.randint(10, 120))
            t_service_ingest = t_service + timedelta(seconds=rng.randint(2, 30))
            service_row = {
                "scenario_key": f"BG_SRV_{bg_counter:04d}",
                "event_time": t_service.isoformat(),
                "ingested_at": t_service_ingest.isoformat(),
                "user": u,
                "device": dev,
                "resource": "FileShare",
                "action": "access",
                "result": "success",
                "source": "service_log.jsonl",
            }
            events_service.append(service_row)

            # Network connection row (benign internal/external)
            if rng.random() < 0.4:
                t_net = t_service + timedelta(seconds=rng.randint(5, 60))
                net_row = {
                    "scenario_key": f"BG_NET_{bg_counter:04d}",
                    "ts": t_net.isoformat(),
                    "received_at": (t_net + timedelta(seconds=rng.randint(2, 20))).isoformat(),
                    "host": dev,
                    "dest_ip": f"192.168.1.{rng.randint(2, 50)}",
                    "action": "connect",
                    "status": "success",
                    "source": "network_log.json",
                }
                events_network.append(net_row)

            bg_counter += 1

    # Add Decoy 1: Legitimate approved change by admin_ops on SRV-BACKUP01 at 01:50 UTC
    t_chg_decoy = base_date.replace(hour=1, minute=50, second=0)
    events_change.append({
        "scenario_key": "DECOY_CHG_1042",
        "timestamp": t_chg_decoy.isoformat(),
        "arrival_time": (t_chg_decoy + timedelta(seconds=5)).isoformat(),
        "ticket_id": "CHG-1042",
        "actor": "user_admin_ops",
        "target": "SRV-BACKUP01",
        "action": "maintenance",
        "status": "approved",
        "details": "Scheduled kernel patch on backup server",
        "source": "change_log.csv",
    })

    # Add Decoy 2: Normal night-shift login by rpatel at 01:55 UTC (so unusual hour is not unique to jdoe)
    t_rpatel = base_date.replace(hour=1, minute=55, second=20)
    events_auth.append({
        "scenario_key": "DECOY_AUTH_RPATEL",
        "timestamp": t_rpatel.isoformat(),
        "arrival_time": (t_rpatel + timedelta(seconds=8)).isoformat(),
        "actor": "user_rpatel",
        "src_host": user_devices["user_rpatel"],
        "target": user_devices["user_rpatel"],
        "src_ip": "10.0.1.42",
        "action": "login",
        "status": "success",
        "source": "auth_log.csv",
    })

    # Add Decoy 3: Delayed benign backup job at 02:30 UTC (svc_backup -> SRV-BACKUP01)
    t_backup = base_date.replace(hour=2, minute=30, second=0)
    t_backup_ingest = t_backup + timedelta(minutes=18)  # Arrives with delay
    events_service.append({
        "scenario_key": "DECOY_SRV_BACKUP",
        "event_time": t_backup.isoformat(),
        "ingested_at": t_backup_ingest.isoformat(),
        "user": "user_svc_backup",
        "device": "SRV-BACKUP01",
        "resource": "BackupSvc",
        "action": "access",
        "result": "success",
        "source": "service_log.jsonl",
    })

    # 2. Incident Storyline Events (doc 04 §2.2)
    # I1: 02:05-02:09: 4x failed auth jdoe -> WS-207 from 198.51.100.23, then success at 02:09
    incident_keys = {}
    
    for i, minute in enumerate([5, 6, 7, 8]):
        t_fail = base_date.replace(hour=2, minute=minute, second=rng.randint(10, 50))
        key = f"I1_fail_{i+1}"
        events_auth.append({
            "scenario_key": key,
            "timestamp": t_fail.isoformat(),
            "arrival_time": (t_fail + timedelta(seconds=12)).isoformat(),
            "actor": "user_jdoe",
            "src_host": "WS-207",
            "target": "WS-207",
            "src_ip": "198.51.100.23",
            "action": "login",
            "status": "failure",
            "source": "auth_log.csv",
        })

    t_i1 = base_date.replace(hour=2, minute=9, second=15)
    incident_keys["I1"] = "I1_success"
    events_auth.append({
        "scenario_key": "I1_success",
        "timestamp": t_i1.isoformat(),
        "arrival_time": (t_i1 + timedelta(seconds=10)).isoformat(),
        "actor": "user_jdoe",
        "src_host": "WS-207",
        "target": "WS-207",
        "src_ip": "198.51.100.23",
        "action": "login",
        "status": "success",
        "source": "auth_log.csv",
    })

    # I2: 02:14: jdoe authenticates to SRV-FILE01 from WS-207 (lateral hop)
    t_i2 = base_date.replace(hour=2, minute=14, second=0)
    # Arrives out-of-order after I4
    t_i2_ingest = base_date.replace(hour=2, minute=28, second=0)
    incident_keys["I2"] = "I2"
    events_auth.append({
        "scenario_key": "I2",
        "timestamp": t_i2.isoformat(),
        "arrival_time": t_i2_ingest.isoformat(),
        "actor": "user_jdoe",
        "src_host": "WS-207",
        "target": "SRV-FILE01",
        "src_ip": "10.0.2.14",
        "action": "login",
        "status": "success",
        "source": "auth_log.csv",
    })

    # I3: 02:21: WS-207/jdoe accesses FileShare. Arrives +17 min delayed (at 02:38)
    t_i3 = base_date.replace(hour=2, minute=21, second=30)
    t_i3_ingest = t_i3 + timedelta(minutes=17)
    incident_keys["I3"] = "I3"
    events_service.append({
        "scenario_key": "I3",
        "event_time": t_i3.isoformat(),
        "ingested_at": t_i3_ingest.isoformat(),
        "user": "user_jdoe",
        "device": "WS-207",
        "resource": "FileShare",
        "action": "access",
        "result": "success",
        "source": "service_log.jsonl",
    })

    # I4: 02:26: privilege change on FileShare (svc_backup gains admin role), NO ACTOR FIELD
    t_i4 = base_date.replace(hour=2, minute=26, second=45)
    t_i4_ingest = t_i4 + timedelta(seconds=15)
    incident_keys["I4"] = "I4"
    events_service.append({
        "scenario_key": "I4",
        "event_time": t_i4.isoformat(),
        "ingested_at": t_i4_ingest.isoformat(),
        "device": "SRV-FILE01",
        "resource": "FileShare",
        "action": "privilege_change",
        "target_account": "user_svc_backup",
        "role_granted": "DomainAdmin",
        "result": "success",
        "source": "service_log.jsonl",
    })

    # Optional flag --with-approval: adds an approved change covering I4
    if with_approval:
        events_change.append({
            "scenario_key": "CHG_APPROVAL_I4",
            "timestamp": (t_i4 - timedelta(minutes=5)).isoformat(),
            "arrival_time": (t_i4 - timedelta(minutes=4)).isoformat(),
            "ticket_id": "CHG-2099",
            "actor": "user_admin_ops",
            "target": "FileShare",
            "action": "maintenance",
            "status": "approved",
            "details": "Emergency privilege sync for FileShare service account",
            "source": "change_log.csv",
        })

    # I5: 02:31: svc_backup interactive login to SRV-DB02
    t_i5 = base_date.replace(hour=2, minute=31, second=10)
    t_i5_ingest = t_i5 + timedelta(seconds=20)
    incident_keys["I5"] = "I5"
    events_auth.append({
        "scenario_key": "I5",
        "timestamp": t_i5.isoformat(),
        "arrival_time": t_i5_ingest.isoformat(),
        "actor": "user_svc_backup",
        "src_host": "SRV-FILE01",
        "target": "SRV-DB02",
        "src_ip": "10.0.0.25",
        "action": "login",
        "status": "success",
        "source": "auth_log.csv",
    })

    # I6: 02:38: SRV-DB02 accesses PayrollDB. Arrives +25 min delayed (at 03:03)
    t_i6 = base_date.replace(hour=2, minute=38, second=5)
    t_i6_ingest = t_i6 + timedelta(minutes=25)
    incident_keys["I6"] = "I6"
    events_service.append({
        "scenario_key": "I6",
        "event_time": t_i6.isoformat(),
        "ingested_at": t_i6_ingest.isoformat(),
        "device": "SRV-DB02",
        "resource": "PayrollDB",
        "action": "access",
        "result": "success",
        "source": "service_log.jsonl",
    })

    # I7: 02:44: SRV-DB02 connects to external 203.0.113.45
    t_i7 = base_date.replace(hour=2, minute=44, second=50)
    t_i7_ingest = t_i7 + timedelta(seconds=30)
    incident_keys["I7"] = "I7"
    events_network.append({
        "scenario_key": "I7",
        "ts": t_i7.isoformat(),
        "received_at": t_i7_ingest.isoformat(),
        "host": "SRV-DB02",
        "dest_ip": "203.0.113.45",
        "action": "connect",
        "status": "success",
        "source": "network_log.json",
    })

    # Sort ordered files by event time
    events_auth.sort(key=lambda r: r["timestamp"])
    events_service.sort(key=lambda r: r["event_time"])
    events_network.sort(key=lambda r: r["ts"])
    events_change.sort(key=lambda r: r["timestamp"])

    # Write ordered files
    # 1. auth_log.csv
    auth_csv_path = os.path.join(output_dir, "auth_log.csv")
    with open(auth_csv_path, "w", newline="", encoding="utf-8") as f:
        writer = csv.DictWriter(f, fieldnames=["scenario_key", "timestamp", "arrival_time", "actor", "src_host", "target", "src_ip", "action", "status", "source"])
        writer.writeheader()
        writer.writerows(events_auth)

    # 2. service_log.jsonl
    service_jsonl_path = os.path.join(output_dir, "service_log.jsonl")
    with open(service_jsonl_path, "w", encoding="utf-8") as f:
        for row in events_service:
            f.write(json.dumps(row) + "\n")

    # 3. network_log.json
    network_json_path = os.path.join(output_dir, "network_log.json")
    with open(network_json_path, "w", encoding="utf-8") as f:
        json.dump(events_network, f, indent=2)

    # 4. change_log.csv
    change_csv_path = os.path.join(output_dir, "change_log.csv")
    with open(change_csv_path, "w", newline="", encoding="utf-8") as f:
        writer = csv.DictWriter(f, fieldnames=["scenario_key", "timestamp", "arrival_time", "ticket_id", "actor", "target", "action", "status", "details", "source"])
        writer.writeheader()
        writer.writerows(events_change)

    # Create shuffled variants
    # Rows shuffled, with arrival_time reassigned to simulate jitter and delays
    def make_shuffled(rows: List[Dict[str, Any]], time_key: str, ingest_key: str) -> List[Dict[str, Any]]:
        shuffled = list(rows)
        rng.shuffle(shuffled)
        return shuffled

    shuffled_auth = make_shuffled(events_auth, "timestamp", "arrival_time")
    shuffled_service = make_shuffled(events_service, "event_time", "ingested_at")
    shuffled_network = make_shuffled(events_network, "ts", "received_at")
    shuffled_change = make_shuffled(events_change, "timestamp", "arrival_time")

    # Write shuffled variants
    with open(os.path.join(output_dir, "auth_log_shuffled.csv"), "w", newline="", encoding="utf-8") as f:
        writer = csv.DictWriter(f, fieldnames=["scenario_key", "timestamp", "arrival_time", "actor", "src_host", "target", "src_ip", "action", "status", "source"])
        writer.writeheader()
        writer.writerows(shuffled_auth)

    with open(os.path.join(output_dir, "service_log_shuffled.jsonl"), "w", encoding="utf-8") as f:
        for row in shuffled_service:
            f.write(json.dumps(row) + "\n")

    with open(os.path.join(output_dir, "network_log_shuffled.json"), "w", encoding="utf-8") as f:
        json.dump(shuffled_network, f, indent=2)

    with open(os.path.join(output_dir, "change_log_shuffled.csv"), "w", newline="", encoding="utf-8") as f:
        writer = csv.DictWriter(f, fieldnames=["scenario_key", "timestamp", "arrival_time", "ticket_id", "actor", "target", "action", "status", "details", "source"])
        writer.writeheader()
        writer.writerows(shuffled_change)

    # 3. Compile ground truth file (doc 04 §2.3)
    all_rows = []
    for r in events_auth:
        all_rows.append((r["timestamp"], r["scenario_key"]))
    for r in events_service:
        all_rows.append((r["event_time"], r["scenario_key"]))
    for r in events_network:
        all_rows.append((r["ts"], r["scenario_key"]))
    for r in events_change:
        all_rows.append((r["timestamp"], r["scenario_key"]))
    
    all_rows.sort(key=lambda x: x[0])
    correct_chronology = [key for _, key in all_rows]

    ground_truth = {
        "synthetic": True,
        "entities": [
            "user:user_jdoe",
            "device:ws-207",
            "device:srv-file01",
            "service:fileshare",
            "user:user_svc_backup",
            "device:srv-db02",
            "service:payrolldb",
            "external:203.0.113.45",
        ],
        "incident_event_keys": incident_keys,
        "true_relationships": [
            {"source": "user:user_jdoe", "target": "device:ws-207", "type": "AUTHENTICATED_TO", "status": "observed"},
            {"source": "device:ws-207", "target": "device:srv-file01", "type": "CONNECTED_TO", "status": "observed"},
            {"source": "device:ws-207", "target": "service:fileshare", "type": "ACCESSED", "status": "observed"},
            {"source": "service:fileshare", "target": "event:I4", "type": "MODIFIED", "status": "observed"},
            {"source": "device:srv-db02", "target": "external:203.0.113.45", "type": "CONNECTED_TO", "status": "observed"},
        ],
        "needs_verification_relationships": [
            {"source": "device:ws-207", "target": "event:I4", "type": "ASSOCIATED_WITH"}
        ],
        "correct_chronology": correct_chronology,
        "delayed_event_keys": ["I3", "I6", "DECOY_SRV_BACKUP"],
        "initial_access_candidate_key": "I1",
        "blast_radius_from_user_jdoe": {
            "directly_associated": ["device:ws-207"],
            "indirectly_associated": ["device:srv-file01", "service:fileshare"],
            "unverified": [
                "user:user_svc_backup",
                "device:srv-db02",
                "service:payrolldb",
                "external:203.0.113.45",
            ],
        },
        "expected_leading_hypothesis": "H2" if with_approval else "H1",
        "expected_gaps_min": 4,
    }

    gt_filename = "scenario_with_approval.json" if with_approval else "scenario.json"
    gt_path = os.path.join(ground_truth_dir, gt_filename)
    with open(gt_path, "w", encoding="utf-8") as f:
        json.dump(ground_truth, f, indent=2)

    total_events = len(all_rows)
    print(f"Generated scenario ({'with-approval' if with_approval else 'standard'}):")
    print(f"  Auth events: {len(events_auth)}")
    print(f"  Service events: {len(events_service)}")
    print(f"  Network events: {len(events_network)}")
    print(f"  Change events: {len(events_change)}")
    print(f"  Total events: {total_events}")
    print(f"  Samples written to: {output_dir}")
    print(f"  Ground truth written to: {gt_path}")


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Generate synthetic security incident scenario")
    parser.add_argument("--output-dir", default="backend/data/samples", help="Directory for log samples")
    parser.add_argument("--ground-truth-dir", default="backend/data/ground_truth", help="Directory for ground truth")
    parser.add_argument("--with-approval", action="store_true", help="Include approved change covering privileged event")
    args = parser.parse_args()

    generate_scenario(args.output_dir, args.ground_truth_dir, with_approval=args.with_approval)
