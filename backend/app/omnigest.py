"""
OmniGest — Multimodal Ingestion API for Aegis HealthGraph.

Endpoint summary
----------------
POST /api/omnigest/extract/{pid}   — upload PDF/image → Gemini extraction (PII-stripped)
POST /api/omnigest/commit          — commit verified entities to Cognee graph
POST /api/omnigest/batch-commit    — chronological multi-doc batch commit

PII policy: The Gemini prompt explicitly instructs the model to strip all
personally identifiable fields (name, DOB, MRN, SSN, address, insurance IDs,
phone, email, physician names). Only clinical observations/values reach the graph.
"""
from __future__ import annotations

import base64
import json
import os
import re
from typing import Any, Dict, List, Optional

import httpx
from fastapi import APIRouter, File, Form, HTTPException, UploadFile
from pydantic import BaseModel

from . import data_store
from .memory import build_memory

router = APIRouter()
_MEMORY = None


def _mem():
    global _MEMORY
    if _MEMORY is None:
        _MEMORY = build_memory()
    return _MEMORY


# ── Gemini config ────────────────────────────────────────────────────────────
GEMINI_API_KEY = os.getenv("GEMINI_API_KEY", "")
GEMINI_MODEL = os.getenv("GEMINI_MODEL", "gemini-2.5-flash")
GEMINI_BASE = "https://generativelanguage.googleapis.com/v1beta"

# ── Module routing keyword map ───────────────────────────────────────────────
MODULE_KEYWORDS: Dict[str, List[str]] = {
    "curie":      ["diagnosis", "symptom", "finding", "observation", "infiltrate", "inflammation",
                   "HbA1c", "glucose", "CBC", "WBC", "CRP", "ESR", "creatinine", "eGFR", "ALT",
                   "AST", "bilirubin", "hemoglobin", "platelet", "leukocyte", "neutrophil",
                   "lymphocyte", "eosinophil", "iron", "ferritin", "TSH", "T3", "T4"],
    "medsync":    ["prescription", "medication", "drug", "dose", "therapy", "treatment",
                   "antibiotic", "prescribed", "administered", "tablet", "injection", "IV"],
    "rxshield":   ["interaction", "contraindication", "adverse", "allergy", "reaction",
                   "warfarin", "statin", "NSAID", "CYP", "toxicity"],
    "nutrisim":   ["glucose", "insulin", "BMI", "weight", "diet", "sleep", "lifestyle",
                   "HbA1c", "triglyceride", "cholesterol", "LDL", "HDL", "metabolic"],
    "pathos":     ["anxiety", "depression", "mood", "stress", "mental", "psychiatric",
                   "fatigue", "insomnia", "sleep disorder", "PTSD", "GAD"],
    "neurograph": ["cognitive", "memory", "dementia", "Alzheimer", "MCI", "MMSE", "MoCA",
                   "neurological", "brain", "cortex", "MRI", "CT", "neuro"],
}

# ── Pydantic models ──────────────────────────────────────────────────────────


class ClinicalEntity(BaseModel):
    label: str
    type: str                          # Lab Value | Symptom | Diagnosis | Imaging Finding | …
    value: Optional[str] = None
    unit: Optional[str] = None
    reference_range: Optional[str] = None
    # normal | abnormal | critical | borderline
    status: Optional[str] = None
    confidence: int = 70               # 0-100
    module_tags: List[str] = []


class DocumentMetadata(BaseModel):
    document_date: Optional[str] = None
    clinic_name: Optional[str] = None
    document_type: Optional[str] = None
    attending_physician: Optional[str] = None  # always None — PII stripped


class ConflictItem(BaseModel):
    existing_node_id: str
    existing_label: str
    new_entity_label: str
    new_value: Optional[str]
    reason: str
    recommendation: str


class ExtractionResponse(BaseModel):
    ok: bool
    metadata: DocumentMetadata
    entities: List[ClinicalEntity]
    conflicts: List[ConflictItem] = []
    module_tags: List[str] = []
    summary_text: str
    error: Optional[str] = None


class CommitRequest(BaseModel):
    patient_id: str
    entities: List[Dict[str, Any]]
    summary_text: str
    document_date: Optional[str] = None
    document_type: Optional[str] = None


class CommitResponse(BaseModel):
    ok: bool
    nodes_added: int
    node: Optional[Dict[str, Any]] = None
    edges: List[Dict[str, Any]] = []
    recall_analysis: Optional[Dict[str, Any]] = None
    improve_result: Optional[Dict[str, Any]] = None
    source: str


class BatchItem(BaseModel):
    patient_id: str
    entities: List[Dict[str, Any]]
    summary_text: str
    document_date: Optional[str] = None
    document_type: Optional[str] = None


class BatchCommitRequest(BaseModel):
    items: List[BatchItem]


# ── Gemini helpers ───────────────────────────────────────────────────────────

EXTRACTION_PROMPT = """You are a clinical entity extraction engine for a medical AI platform.

STRICT PII RULES — NEVER include in output:
- Patient name, date of birth, MRN, SSN, insurance ID, account number, phone, email
- Any physician / nurse / staff name or identifier
- Specific clinic or hospital name (use generic type e.g. "tertiary hospital")

Extract ONLY clinically relevant information. Return a single JSON object (no markdown fences):

{
  "metadata": {
    "document_date": "YYYY-MM-DD or null",
    "clinic_name": "generic e.g. 'regional hospital'",
    "document_type": "Blood Report | X-Ray | MRI | CT Scan | Pathology | Other",
    "attending_physician": null
  },
  "entities": [
    {
      "label": "HbA1c",
      "type": "Lab Value",
      "value": "8.2",
      "unit": "%",
      "reference_range": "4.0–5.6",
      "status": "abnormal",
      "confidence": 95,
      "module_tags": ["curie","nutrisim"]
    }
  ],
  "summary_text": "One-paragraph clinical summary with no PII."
}

Entity types: Lab Value | Symptom | Diagnosis | Observation | Medication | Imaging Finding | Vital Sign
Status: normal | abnormal | critical | borderline
Confidence: 0-100 (reflect image/PDF quality; mark blurry/low-quality regions <60)
module_tags: subset of [curie, medsync, rxshield, nutrisim, pathos, neurograph]

Extract ALL clinically significant values. Never omit borderline or mildly abnormal results."""


def _call_gemini(mime: str, b64_data: str) -> str:
    url = f"{GEMINI_BASE}/models/{GEMINI_MODEL}:generateContent?key={GEMINI_API_KEY}"
    payload = {
        "contents": [{
            "parts": [
                {"inline_data": {"mime_type": mime, "data": b64_data}},
                {"text": EXTRACTION_PROMPT},
            ]
        }],
        "generationConfig": {"temperature": 0.1, "responseMimeType": "application/json"},
    }
    r = httpx.post(url, json=payload, timeout=90)
    r.raise_for_status()
    candidates = r.json().get("candidates", [])
    if not candidates:
        raise ValueError("Gemini returned no candidates")
    return candidates[0]["content"]["parts"][0]["text"]


def _parse_gemini(raw: str) -> Dict[str, Any]:
    clean = re.sub(r"^```(?:json)?|```$", "", raw.strip(),
                   flags=re.MULTILINE).strip()
    return json.loads(clean)


def _auto_tag_modules(entity_label: str) -> List[str]:
    label_lower = entity_label.lower()
    tags = []
    for mod, keywords in MODULE_KEYWORDS.items():
        if any(kw.lower() in label_lower for kw in keywords):
            tags.append(mod)
    return tags or ["curie"]


# ── Mock extraction (demo / no Gemini key) ───────────────────────────────────

def _mock_extraction(filename: str) -> ExtractionResponse:
    name_lower = (filename or "").lower()
    is_xray = any(x in name_lower for x in [
                  "xray", "x-ray", "chest", "scan", "dcm", "dicom"])

    if is_xray:
        entities = [
            ClinicalEntity(label="Bilateral lower lobe infiltrates", type="Imaging Finding",
                           status="abnormal", confidence=82, module_tags=["curie"]),
            ClinicalEntity(label="Mild pleural thickening", type="Imaging Finding",
                           status="abnormal", confidence=71, module_tags=["curie"]),
            ClinicalEntity(label="Borderline cardiomegaly", type="Imaging Finding",
                           status="borderline", confidence=55, module_tags=["curie", "medsync"]),
            ClinicalEntity(label="No pneumothorax detected", type="Imaging Finding",
                           status="normal", confidence=96, module_tags=["curie"]),
        ]
        return ExtractionResponse(
            ok=True,
            metadata=DocumentMetadata(document_date="2024-11-14",
                                      clinic_name="Regional Medical Centre",
                                      document_type="X-Ray"),
            entities=entities,
            module_tags=["curie", "medsync"],
            summary_text=(
                "Chest X-ray demonstrates bilateral lower lobe infiltrates consistent with "
                "early consolidation or infection. Mild pleural thickening noted bilaterally. "
                "Borderline cardiomegaly observed. No pneumothorax or significant pleural "
                "effusion identified. Correlation with inflammatory markers recommended."
            ),
        )
    else:
        entities = [
            ClinicalEntity(label="HbA1c", type="Lab Value", value="8.2", unit="%",
                           reference_range="4.0–5.6", status="abnormal", confidence=97,
                           module_tags=["curie", "nutrisim"]),
            ClinicalEntity(label="Fasting Blood Glucose", type="Lab Value", value="178",
                           unit="mg/dL", reference_range="70–99", status="abnormal",
                           confidence=97, module_tags=["curie", "nutrisim"]),
            ClinicalEntity(label="CRP (C-Reactive Protein)", type="Lab Value", value="18.4",
                           unit="mg/L", reference_range="<5.0", status="abnormal",
                           confidence=95, module_tags=["curie", "medsync"]),
            ClinicalEntity(label="ESR", type="Lab Value", value="52", unit="mm/hr",
                           reference_range="0–20", status="abnormal", confidence=94,
                           module_tags=["curie"]),
            ClinicalEntity(label="eGFR (Kidney Function)", type="Lab Value", value="58",
                           unit="mL/min/1.73m²", reference_range=">60", status="borderline",
                           confidence=96, module_tags=["curie", "rxshield"]),
            ClinicalEntity(label="LDL Cholesterol", type="Lab Value", value="142",
                           unit="mg/dL", reference_range="<100", status="abnormal",
                           confidence=97, module_tags=["curie", "nutrisim"]),
            ClinicalEntity(label="Hemoglobin", type="Lab Value", value="11.2", unit="g/dL",
                           reference_range="12.0–15.5", status="abnormal", confidence=96,
                           module_tags=["curie"]),
            ClinicalEntity(label="WBC Count", type="Lab Value", value="11.8",
                           unit="×10³/µL", reference_range="4.5–11.0", status="borderline",
                           confidence=95, module_tags=["curie"]),
            ClinicalEntity(label="ALT (Liver Enzyme)", type="Lab Value", value="34",
                           unit="U/L", reference_range="7–40", status="normal",
                           confidence=97, module_tags=["curie", "rxshield"]),
            ClinicalEntity(label="TSH (Thyroid Stimulating Hormone)", type="Lab Value",
                           value="3.8", unit="mIU/L", reference_range="0.4–4.0",
                           status="normal", confidence=95, module_tags=["curie"]),
        ]
        return ExtractionResponse(
            ok=True,
            metadata=DocumentMetadata(document_date="2024-12-03",
                                      clinic_name="Outpatient Diagnostics Lab",
                                      document_type="Blood Report"),
            entities=entities,
            module_tags=["curie", "nutrisim", "rxshield", "medsync"],
            summary_text=(
                "Metabolic panel reveals poorly controlled type 2 diabetes (HbA1c 8.2%, "
                "fasting glucose 178 mg/dL). Elevated inflammatory markers — CRP 18.4 mg/L "
                "and ESR 52 mm/hr — suggest active systemic inflammation. Borderline eGFR "
                "of 58 indicates early-stage chronic kidney disease, clinically significant "
                "for medication dosing decisions. LDL cholesterol elevated at 142 mg/dL. "
                "Mild normocytic anaemia noted (Hb 11.2). Borderline leukocytosis may "
                "reflect inflammatory response. Liver enzymes and thyroid function normal."
            ),
        )


# ── Conflict detection ───────────────────────────────────────────────────────

_CONTRADICTION_PAIRS = [
    ("reduced kidney function", "egfr",
     "New eGFR reading may contradict existing Reduced Kidney Function node"),
    ("hyperglycaemia", "fasting blood glucose",
     "New glucose reading may contradict existing Hyperglycaemia classification"),
    ("normal renal function", "egfr",
     "New eGFR may contradict existing Normal Renal Function node"),
    ("hypertension", "blood pressure",
     "New BP reading may update existing Hypertension classification"),
]


def _detect_conflicts(pid: str, entities: List[ClinicalEntity]) -> List[ConflictItem]:
    g = data_store.graph(pid)
    existing: Dict[str, Dict] = {
        n["label"].lower(): n for n in g.get("nodes", [])}
    conflicts: List[ConflictItem] = []
    for ent in entities:
        e_lower = ent.label.lower()
        for exist_key, new_key, reason in _CONTRADICTION_PAIRS:
            if exist_key in existing and new_key in e_lower:
                node = existing[exist_key]
                conflicts.append(ConflictItem(
                    existing_node_id=node["id"],
                    existing_label=node["label"],
                    new_entity_label=ent.label,
                    new_value=ent.value,
                    reason=reason,
                    recommendation="Accept → triggers improve() to reweight existing edges",
                ))
    return conflicts


# ── Routes ───────────────────────────────────────────────────────────────────

@router.post("/api/omnigest/extract/{pid}", response_model=ExtractionResponse)
async def extract(
    pid: str,
    file: UploadFile = File(...),
):
    """Upload PDF or image → Gemini extracts clinical entities (PII-stripped)."""
    if not data_store.patient(pid):
        raise HTTPException(404, "patient not found")

    content = await file.read()
    fname = (file.filename or "").lower()
    mime = file.content_type or "application/octet-stream"
    if fname.endswith(".pdf"):
        mime = "application/pdf"
    elif fname.endswith((".jpg", ".jpeg")):
        mime = "image/jpeg"
    elif fname.endswith(".png"):
        mime = "image/png"

    if not GEMINI_API_KEY:
        result = _mock_extraction(file.filename or "report.pdf")
        result.conflicts = _detect_conflicts(pid, result.entities)
        return result

    try:
        b64 = base64.b64encode(content).decode()
        raw = _call_gemini(mime, b64)
        data = _parse_gemini(raw)

        meta = data.get("metadata", {})
        entities = []
        for e in data.get("entities", []):
            if not e.get("label"):
                continue
            tags = e.get("module_tags") or _auto_tag_modules(
                e.get("label", ""))
            entities.append(ClinicalEntity(
                label=e.get("label", ""),
                type=e.get("type", "Observation"),
                value=e.get("value"),
                unit=e.get("unit"),
                reference_range=e.get("reference_range"),
                status=e.get("status", "normal"),
                confidence=int(e.get("confidence", 70)),
                module_tags=tags,
            ))

        all_tags: List[str] = []
        for ent in entities:
            for t in ent.module_tags:
                if t not in all_tags:
                    all_tags.append(t)

        return ExtractionResponse(
            ok=True,
            metadata=DocumentMetadata(
                document_date=meta.get("document_date"),
                clinic_name=meta.get("clinic_name"),
                document_type=meta.get("document_type"),
                attending_physician=None,
            ),
            entities=entities,
            conflicts=_detect_conflicts(pid, entities),
            module_tags=all_tags,
            summary_text=data.get("summary_text", ""),
        )

    except httpx.HTTPStatusError as exc:
        # Surface Gemini's actual error body instead of a bare status code —
        # this is almost always an invalid API key, wrong model name, or quota issue.
        try:
            detail = exc.response.json()
            msg = detail.get("error", {}).get("message", exc.response.text)
        except Exception:
            msg = exc.response.text
        raise HTTPException(
            502, f"Gemini API error {exc.response.status_code}: {msg}")
    except json.JSONDecodeError as exc:
        raise HTTPException(500, f"Gemini returned non-JSON output: {exc}")
    except Exception as exc:
        raise HTTPException(
            500, f"Extraction failed: {type(exc).__name__}: {exc}")


@router.post("/api/omnigest/commit", response_model=CommitResponse)
def commit(req: CommitRequest):
    """
    Commit verified entities to the patient's graph.

    Design note: rather than collapsing the whole document into one blob
    node (which only ever lands in a single lane), we call remember() once
    PER ENTITY, routed to that entity's primary module and dated to the
    document's extracted date. This is what makes the ingestion actually
    show up across multiple module lanes (Curie, RxShield, NutriSim, etc.)
    instead of invisibly stacking everything under one generic "curie" node.

    A short, human-readable summary node is also added (tagged to the
    document's primary module) so the document-level "So what?" narrative
    has a home in the graph too.
    """
    if not data_store.patient(req.patient_id):
        raise HTTPException(404, "patient not found")

    pid = req.patient_id
    doc_type = req.document_type or "document"
    mem_type = "lab" if any(x in doc_type.lower()
                            for x in ["blood", "report", "panel"]) else "imaging"
    doc_date = req.document_date  # may be None — remember() handles that fine

    created_nodes: List[Dict[str, Any]] = []
    created_edges: List[Dict[str, Any]] = []

    # ── one remember() call per entity, routed to its primary module ───────
    for ent in req.entities:
        tags = ent.get("module_tags") or _auto_tag_modules(
            ent.get("label", ""))
        primary_module = tags[0] if tags else "curie"

        label = ent["label"]
        if ent.get("value"):
            label += f": {ent['value']}{(' ' + ent['unit']) if ent.get('unit') else ''}"
        status = ent.get("status")
        if status and status != "normal":
            label += f" ({status})"

        detail_parts = [f"{ent['label']}"]
        if ent.get("value"):
            detail_parts.append(
                f"= {ent['value']} {ent.get('unit') or ''}".strip())
        if ent.get("reference_range"):
            detail_parts.append(f"(ref {ent['reference_range']})")
        detail_parts.append(
            f"— extracted from {doc_type} via OmniGest/Gemini.")
        detail = " ".join(detail_parts)

        result = _mem().remember(
            pid, detail, mem_type,
            module=primary_module, date=doc_date, label=label[:80],
        )
        created_nodes.append(result["node"])
        created_edges.extend(result["edges"])

        # Note: secondary module_tags (beyond the primary lane) are
        # surfaced to the user via toast notifications in the frontend
        # rather than as duplicate graph nodes, to avoid graph clutter.

    # ── one summary node for the document as a whole ───────────────────────
    all_tags: List[str] = []
    for ent in req.entities:
        for t in (ent.get("module_tags") or []):
            if t not in all_tags:
                all_tags.append(t)
    doc_primary_module = all_tags[0] if all_tags else "curie"

    summary_result = _mem().remember(
        pid,
        req.summary_text or f"{doc_type} ingested via OmniGest.",
        mem_type,
        module=doc_primary_module,
        date=doc_date,
        label=f"📂 {doc_type} — {len(req.entities)} findings"[:80],
    )
    created_nodes.append(summary_result["node"])
    created_edges.extend(summary_result["edges"])

    # link the summary node to each entity node it produced
    for ent_node in created_nodes[:-1]:
        link_id = f"{summary_result['node']['id']}->{ent_node['id']}"
        link_edge = {
            "id": link_id, "source": summary_result["node"]["id"], "target": ent_node["id"],
            "relation": "documents", "weight": 0.7,
            "rationale": f"Extracted from the same {doc_type}.",
        }
        data_store.mutate_graph(pid, node=None, edges=[link_edge])
        created_edges.append(link_edge)

    # ── recall() "So What?" analysis, now that all entities are persisted ──
    recall_query = (
        f"How does this newly ingested {doc_type} change this patient's overall risk profile? "
        "Identify any cross-module connections to existing findings."
    )
    recall_result = _mem().recall(pid, recall_query)

    # ── persist insights so EVERY tagged module visibly reflects this commit ─
    # module_payload() in modules.py reads data_store.insights() filtered by
    # module — without this, OmniGest's findings would only ever be visible
    # in the raw graph, never in a module's "Insights" panel. We push one
    # insight per tagged module (not just the primary one) so e.g. a blood
    # panel tagged [curie, nutrisim, rxshield] visibly updates all three
    # module pages, not just Curie.
    abnormal_entities = [e for e in req.entities if e.get(
        "status") in ("abnormal", "critical")]
    flagged = ", ".join(
        e["label"] for e in abnormal_entities[:3]) if abnormal_entities else None
    base_confidence = (
        min(95, max(e.get("confidence", 70) for e in abnormal_entities))
        if abnormal_entities else
        (max((e.get("confidence", 70) for e in req.entities), default=70))
    )
    target_modules = all_tags or [doc_primary_module]

    for mod in target_modules:
        if flagged:
            body = (
                f"OmniGest ingested a {doc_type} via Gemini 2.5 Flash. "
                f"{len(abnormal_entities)} abnormal finding(s) relevant to this module: {flagged}. "
                f"{recall_result.get('answer', '')}"
            )
            title = f"New {doc_type} findings flagged"
        else:
            body = (
                f"OmniGest ingested a {doc_type} via Gemini 2.5 Flash — all extracted values "
                f"relevant to this module were within normal range. {recall_result.get('answer', '')}"
            )
            title = f"New {doc_type} reviewed — no concerning findings"

        insight_id = f"omnigest_{pid}_{mod}_{summary_result['node']['id']}"
        data_store.mutate_insights(pid, {
            "id": insight_id,
            "module": mod,
            "title": title,
            "body": body,
            "confidence": base_confidence,
            "crossModule": len(target_modules) > 1,
            "evidence": [n["id"] for n in created_nodes],
            "sourceTag": "omnigest",
        })

    # ── improve() — reweight edges now that new data has landed ────────────
    improve_result = _mem().improve(pid)

    return CommitResponse(
        ok=True,
        nodes_added=len(created_nodes),
        # headline node for any caller expecting a single node
        node=summary_result["node"],
        edges=created_edges,
        recall_analysis=recall_result,
        improve_result=improve_result,
        source=summary_result.get("source", "replay"),
    )


@router.post("/api/omnigest/batch-commit")
def batch_commit(req: BatchCommitRequest):
    """Chronological batch commit — sort by date then remember() each doc in order."""
    sorted_items = sorted(
        req.items,
        key=lambda x: x.document_date or "9999-99-99"
    )
    results = []
    for item in sorted_items:
        r = commit(CommitRequest(
            patient_id=item.patient_id,
            entities=item.entities,
            summary_text=item.summary_text,
            document_date=item.document_date,
            document_type=item.document_type,
        ))
        results.append({"document_date": item.document_date, **r.dict()})
    return {"ok": True, "processed": len(results), "results": results}
