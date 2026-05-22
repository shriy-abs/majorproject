"""
In-memory metrics store for the analytics dashboard.
Extension syncs session data via POST /api/metrics.
"""
from __future__ import annotations

import time
from copy import deepcopy
from threading import Lock
from typing import Any, Dict, List

_lock = Lock()

_DEFAULTS: Dict[str, Any] = {
    "fieldsExplained": 0,
    "validationErrorsPrevented": 0,
    "voiceAssistsTriggered": 0,
    "pagesSummarized": 0,
    "totalLatency": 0.0,
    "responseCount": 0,
    "fieldTypesProcessed": {},
    "languageBreakdown": {"EN": 0, "HI": 0, "KN": 0},
    "simplifySourceBreakdown": {"llm": 0, "rules": 0, "local": 0},
    "events": [],
    "lastUpdated": None,
}

_metrics: Dict[str, Any] = deepcopy(_DEFAULTS)


def _now() -> float:
    return time.time()


def reset_metrics() -> Dict[str, Any]:
    global _metrics
    with _lock:
        _metrics = deepcopy(_DEFAULTS)
        _metrics["lastUpdated"] = _now()
        return deepcopy(_metrics)


def get_metrics() -> Dict[str, Any]:
    with _lock:
        return deepcopy(_metrics)


def _append_event(event_type: str, detail: str = "") -> None:
    events: List[Dict[str, Any]] = _metrics.setdefault("events", [])
    events.append({"t": _now(), "type": event_type, "detail": detail[:120]})
    if len(events) > 300:
        del events[: len(events) - 300]


def merge_metrics(payload: Dict[str, Any]) -> Dict[str, Any]:
    """Replace counters with latest snapshot from extension; append events if sent."""
    global _metrics
    with _lock:
        for key in (
            "fieldsExplained",
            "validationErrorsPrevented",
            "voiceAssistsTriggered",
            "pagesSummarized",
            "totalLatency",
            "responseCount",
        ):
            if key in payload:
                _metrics[key] = payload[key]

        if "fieldTypesProcessed" in payload and isinstance(payload["fieldTypesProcessed"], dict):
            _metrics["fieldTypesProcessed"] = dict(payload["fieldTypesProcessed"])

        if "languageBreakdown" in payload and isinstance(payload["languageBreakdown"], dict):
            _metrics["languageBreakdown"] = dict(payload["languageBreakdown"])

        if "simplifySourceBreakdown" in payload and isinstance(payload["simplifySourceBreakdown"], dict):
            _metrics["simplifySourceBreakdown"] = dict(payload["simplifySourceBreakdown"])

        new_events = payload.get("events")
        if isinstance(new_events, list):
            for ev in new_events[-50:]:
                if isinstance(ev, dict) and ev.get("type"):
                    _append_event(str(ev["type"]), str(ev.get("detail", "")))

        _metrics["lastUpdated"] = _now()
        return deepcopy(_metrics)
