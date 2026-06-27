"""
Aegis HealthGraph - mock data generator (single source of truth).

Runs on plain Python 3.9+ with no dependencies. It emits the JSON the backend
serves in *replay mode* and the frontend can fall back to. The data is
hand-authored around ONE coherent multi-year patient story so that every module
(Curie, MedSync, RxShield, NutriSim, Pathos, NeuroGraph) is describing the same
person from a different angle -- which is what makes the cross-module insight land.

Output (written to ../data):
    patients.json        list of patient summaries
    events.json          {patientId: [event, ...]}  longitudinal records
    graph/<id>.json      {nodes, edges} per patient (the Cognee-style graph)
    insights.json        {patientId: [insight, ...]} pre-generated AI insights
    recall_cache.json    {patientId: [{q, a, confidence, evidence}]}  replay recall
    cross_insights.json  the headline cross-module "aha" findings
"""
from __future__ import annotations

import json
import os
from typing import Dict, List

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
DATA = os.path.join(ROOT, "data")

MODULES = ["curie", "medsync", "rxshield", "nutrisim", "pathos", "neurograph"]

# Event type -> the module that "owns"/surfaces it (for color coding in the UI)
TYPE_MODULE = {
    "symptom": "curie",
    "diagnosis": "curie",
    "lab": "curie",
    "visit": "medsync",
    "medication": "rxshield",
    "lifestyle": "nutrisim",
    "metric": "nutrisim",
    "mental": "pathos",
    "cognitive": "neurograph",
}


def node(nid, label, ntype, date=None, detail="", weight=1.0, module=None):
    return {
        "id": nid,
        "label": label,
        "type": ntype,
        "module": module or TYPE_MODULE.get(ntype, "curie"),
        "date": date,
        "detail": detail,
        "weight": weight,
    }


def edge(src, dst, relation, weight=0.7, rationale=""):
    return {
        "id": f"{src}->{dst}",
        "source": src,
        "target": dst,
        "relation": relation,
        "weight": weight,
        "rationale": rationale,
    }


# ---------------------------------------------------------------------------
# HERO PATIENT -- Elena Voss, 47F. Carries the 5-module story.
# A slow-burn autoimmune + metabolic trajectory that no single specialist saw.
# ---------------------------------------------------------------------------
def hero_elena():
    pid = "patient_001"
    events = [
        # 2021-2022 cardiology entry point
        dict(id="e1", date="2021-11-04", type="symptom", title="Chest tightness on exertion",
             detail="Reported during a brisk walk; resolved with rest.", module="curie", severity=2),
        dict(id="e2", date="2021-11-12", type="visit", title="Cardiology consult",
             detail="ECG normal. Started on a beta-blocker for suspected exertional angina.", module="medsync"),
        dict(id="e3", date="2021-11-12", type="medication", title="Metoprolol 25mg started",
             detail="Beta-blocker. Metabolized in part via CYP2D6.", module="rxshield"),
        dict(id="e4", date="2022-02-20", type="medication", title="Metoprolol increased to 50mg",
             detail="Dosage increase after follow-up.", module="rxshield"),
        dict(id="e5", date="2022-02-23", type="symptom", title="New persistent fatigue",
             detail="Began ~3 days after the dosage increase.", module="curie", severity=2),
        # 2022-2023 lifestyle + metabolic drift
        dict(id="e6", date="2022-06-10", type="lifestyle", title="Late-night dinners become routine",
             detail="Work stress; dinner regularly after 10pm.", module="nutrisim"),
        dict(id="e7", date="2022-09-01", type="metric", title="Poor sleep (avg 5.2h, low REM)",
             detail="Wearable shows fragmented sleep, REM < 45 min on bad nights.", module="nutrisim"),
        dict(id="e8", date="2022-09-15", type="metric", title="Morning glucose spikes",
             detail="CGM: fasting spikes to 140-160 on mornings after poor sleep.", module="nutrisim"),
        # 2023 the first autoimmune whisper
        dict(id="e9", date="2023-03-18", type="symptom", title="Unexplained skin rash",
             detail="Malar-pattern rash across cheeks; attributed to sun.", module="curie", severity=2),
        dict(id="e10", date="2023-05-02", type="mental", title="Sunday-evening anxiety pattern",
             detail="Recurring dread before Monday; tied to performance reviews.", module="pathos"),
        dict(id="e11", date="2023-08-22", type="metric", title="Weight gain +6kg over 9 months",
             detail="Despite no diet change.", module="nutrisim"),
        # 2024 the picture thickens
        dict(id="e12", date="2024-01-14", type="symptom", title="Intermittent joint pain",
             detail="Wrists and knuckles, worse in the morning.", module="curie", severity=3),
        dict(id="e13", date="2024-04-09", type="lab", title="Elevated ANA titer 1:320",
             detail="Ordered for fatigue workup; flagged but not followed up.", module="curie"),
        dict(id="e14", date="2024-04-09", type="mental", title="Therapy: work rumination + insomnia",
             detail="CBT homework started. Anxiety clusters before quarterly reviews.", module="pathos"),
        dict(id="e15", date="2024-10-30", type="metric", title="HbA1c 6.1% (prediabetic)",
             detail="Crossed into prediabetic range.", module="nutrisim"),
        # 2025 the trigger event + new med
        dict(id="e16", date="2025-05-21", type="symptom", title="Sudden kidney inflammation",
             detail="Presented with edema + proteinuria. Trigger for full workup.", module="curie", severity=4),
        dict(id="e17", date="2025-05-22", type="medication", title="Clarithromycin started (infection)",
             detail="Strong CYP3A4 inhibitor.", module="rxshield"),
        dict(id="e18", date="2025-05-22", type="medication", title="On atorvastatin (prior)",
             detail="Statin; cleared via CYP3A4.", module="rxshield"),
        dict(id="e19", date="2025-05-25", type="lab", title="Reduced kidney function (eGFR 58)",
             detail="Lowers clearance of accumulating drugs.", module="curie"),
        dict(id="e20", date="2025-05-26", type="diagnosis", title="Curie flag: early-onset lupus pattern",
             detail="Rash + joint pain + ANA + nephritis cluster.", module="curie", severity=4),
    ]

    # --- Knowledge graph: nodes from events + a few concept nodes, then relations
    nodes = [node(e["id"], e["title"], e["type"], e["date"], e["detail"],
                  weight=0.6 + 0.1 * e.get("severity", 1)) for e in events]
    # concept / ontology nodes Cognee would extract (assigned to the most
    # relevant module lane so the swimlanes stay balanced and meaningful)
    nodes += [
        node("c_lupus", "Early-Onset Lupus (SLE)", "diagnosis", detail="Autoimmune pattern", weight=1.4, module="curie"),
        node("c_cyp3a4", "CYP3A4 metabolic pathway", "lab", detail="Drug-metabolizing enzyme", weight=1.1, module="rxshield"),
        node("c_cyp2d6", "CYP2D6 metabolic pathway", "lab", detail="Drug-metabolizing enzyme", weight=0.9, module="rxshield"),
        node("c_metabolic", "Metabolic syndrome risk", "diagnosis", detail="Sleep-glucose-weight loop", weight=1.2, module="nutrisim"),
    ]

    edges = [
        edge("e1", "e2", "led to consult", 0.9, "Chest tightness prompted cardiology referral."),
        edge("e2", "e3", "prescribed", 0.95, "Beta-blocker started at the cardiology visit."),
        edge("e3", "e4", "dose adjusted", 0.9, "Same drug, increased dose."),
        edge("e4", "e5", "temporally precedes", 0.82, "Fatigue began 3 days after the increase."),
        edge("e4", "c_cyp2d6", "metabolized by", 0.6, "Metoprolol clears via CYP2D6."),
        edge("e6", "e7", "contributes to", 0.78, "Late dinners fragment sleep."),
        edge("e7", "e8", "drives", 0.85, "Poor/low-REM sleep precedes morning glucose spikes."),
        edge("e8", "e11", "contributes to", 0.7, "Repeated spikes track with weight gain."),
        edge("e11", "e15", "progresses to", 0.8, "Weight gain precedes prediabetic HbA1c."),
        edge("e8", "c_metabolic", "evidence for", 0.75, ""),
        edge("e7", "c_metabolic", "evidence for", 0.7, ""),
        edge("e11", "c_metabolic", "evidence for", 0.7, ""),
        # autoimmune chain (the Curie spine)
        edge("e9", "e12", "co-occurs with", 0.72, "Rash and later joint pain share an autoimmune signature."),
        edge("e12", "e13", "explained by", 0.8, "Joint pain workup surfaced elevated ANA."),
        edge("e13", "e16", "structurally precedes", 0.86, "ANA positivity precedes lupus nephritis."),
        edge("e9", "c_lupus", "feature of", 0.83, "Malar rash is a classic SLE feature."),
        edge("e12", "c_lupus", "feature of", 0.8, "Inflammatory arthralgia is an SLE feature."),
        edge("e13", "c_lupus", "feature of", 0.88, "ANA positivity is an SLE criterion."),
        edge("e16", "c_lupus", "feature of", 0.9, "Nephritis is an SLE organ involvement."),
        edge("c_lupus", "e20", "diagnosed as", 0.87, "Combined criteria -> early-onset lupus flag."),
        # RxShield interaction chain (the money explanation)
        edge("e17", "c_cyp3a4", "inhibits", 0.92, "Clarithromycin strongly inhibits CYP3A4."),
        edge("e18", "c_cyp3a4", "metabolized by", 0.9, "Atorvastatin is cleared by CYP3A4."),
        edge("c_cyp3a4", "e18", "accumulation of", 0.85, "Inhibition raises statin concentration."),
        edge("e19", "e18", "amplifies risk of", 0.8, "Reduced eGFR slows clearance further."),
        # cross-module bridges (these light up the 'aha')
        edge("e10", "e7", "worsens", 0.6, "Anxiety nights worsen sleep."),
        edge("e14", "e10", "same pattern as", 0.75, "Therapy notes confirm the Sunday pattern."),
        edge("e4", "e8", "may contribute to", 0.45, "Beta-blockers can blunt glucose signaling."),
    ]

    insights = [
        dict(id="i1", module="curie", confidence=87, crossModule=False,
             title="Early-onset lupus pattern across 4 years",
             body=("The sudden kidney inflammation is structurally similar to autoimmune "
                   "progressions. This patient had a malar rash (2023), intermittent joint "
                   "pain (2024), and an elevated ANA titer (1:320) that was never followed up. "
                   "Combined similarity to early-onset lupus: 87%."),
             evidence=["e9", "e12", "e13", "e16", "c_lupus"]),
        dict(id="i2", module="medsync", confidence=78, crossModule=False,
             title="Fatigue is iatrogenic, not idiopathic",
             body=("Persistent fatigue began within 3 days of the Metoprolol increase to 50mg. "
                   "A similar timeline appears in many beta-blocker dose changes. The fatigue "
                   "was worked up as unexplained for 2 years."),
             evidence=["e4", "e5"]),
        dict(id="i3", module="rxshield", confidence=62, crossModule=False,
             title="Hidden statin toxicity risk via CYP3A4",
             body=("Clarithromycin inhibits CYP3A4; atorvastatin is cleared by CYP3A4. With "
                   "reduced kidney function (eGFR 58), estimated statin exposure rises sharply. "
                   "Estimated toxicity risk increases by 62%."),
             evidence=["e17", "e18", "e19", "c_cyp3a4"]),
        dict(id="i4", module="nutrisim", confidence=81, crossModule=False,
             title="A self-reinforcing sleep-glucose loop",
             body=("Morning glucose spikes occur almost exclusively after nights with REM "
                   "under 45 minutes. Late dinners feed poor sleep; poor sleep feeds spikes; "
                   "spikes track with +6kg and a prediabetic HbA1c of 6.1%."),
             evidence=["e6", "e7", "e8", "e11", "e15", "c_metabolic"]),
        dict(id="i5", module="pathos", confidence=74, crossModule=False,
             title="Sunday-evening anxiety is periodic, not random",
             body=("Anxiety spikes cluster on Sunday evenings and in the week before quarterly "
                   "reviews. This is the same pattern the patient's therapy notes flagged a "
                   "year later."),
             evidence=["e10", "e14"]),
    ]

    recall = [
        dict(q="Has this patient had similar symptoms before?",
             a=("Yes. The current kidney inflammation connects to a malar rash (Mar 2023), "
                "intermittent joint pain (Jan 2024), and an elevated ANA titer (Apr 2024) -- "
                "an autoimmune cluster spanning two years."),
             confidence=87, evidence=["e9", "e12", "e13", "e16"]),
        dict(q="Why is this patient fatigued?",
             a=("Fatigue began 3 days after the Metoprolol dose increase to 50mg in Feb 2022. "
                "It is most consistent with a medication effect rather than an unexplained cause."),
             confidence=78, evidence=["e4", "e5"]),
        dict(q="Are there any dangerous drug interactions right now?",
             a=("Yes. Clarithromycin inhibits CYP3A4, which clears atorvastatin. Combined with "
                "reduced kidney function (eGFR 58), statin exposure and toxicity risk rise ~62%."),
             confidence=62, evidence=["e17", "e18", "e19"]),
        dict(q="What explains the morning glucose spikes?",
             a=("They follow nights with REM sleep under 45 minutes, which follow late dinners. "
                "It is a self-reinforcing loop now tracking with weight gain and prediabetes."),
             confidence=81, evidence=["e7", "e8", "e11", "e15"]),
        dict(q="What is the patient's mental-health pattern?",
             a=("Anxiety is periodic: Sunday evenings and the week before quarterly performance "
                "reviews. Therapy notes a year later independently confirmed the same pattern."),
             confidence=74, evidence=["e10", "e14"]),
    ]

    return pid, events, {"nodes": nodes, "edges": edges}, insights, recall


# ---------------------------------------------------------------------------
# NEUROGRAPH PATIENT -- Arthur Reyes, 72M. Cognitive decline over time.
# ---------------------------------------------------------------------------
def hero_arthur():
    pid = "patient_002"
    # cognitive metrics that gradually decline (used by NeuroGraph charts)
    months = [
        ("2025-12", 100, 100, 100), ("2026-01", 98, 96, 99), ("2026-02", 95, 92, 96),
        ("2026-03", 90, 86, 92), ("2026-04", 84, 79, 88), ("2026-05", 78, 71, 83),
        ("2026-06", 71, 64, 79),
    ]
    events = []
    for i, (m, vocab, recall_s, lang) in enumerate(months):
        events.append(dict(id=f"n{i}", date=f"{m}-15", type="cognitive",
                           title=f"Cognitive check {m}",
                           detail=f"Vocabulary richness {vocab}, memory recall {recall_s}, language complexity {lang}.",
                           module="neurograph",
                           metrics={"vocab": vocab, "recall": recall_s, "language": lang}))
    # personal knowledge graph that weakens (entities the patient recalls)
    entities = ["Margaret (wife)", "Sister Jean", "The 1979 wedding", "Lake vacations", "Grandchildren"]
    nodes = [node(f"n{i}", events[i]["title"], "cognitive", events[i]["date"], events[i]["detail"])
             for i in range(len(events))]
    for j, ent in enumerate(entities):
        # weight encodes how reliably the entity is recalled now (declining)
        nodes.append(node(f"ent{j}", ent, "cognitive", detail="Personal memory entity",
                          weight=round(1.3 - 0.18 * j, 2)))
    edges = []
    for j in range(len(entities) - 1):
        edges.append(edge(f"ent{j}", f"ent{j+1}", "recalled-with",
                          weight=round(0.8 - 0.12 * j, 2),
                          rationale="Co-recall strength is weakening month over month."))
    insights = [
        dict(id="ni1", module="neurograph", confidence=83, crossModule=False,
             title="Family relationship recall down 32% in 60 days",
             body=("Across conversations, correct recall of family relationships fell from 96 "
                   "to 64. Pronoun substitution ('she', 'that person') increased, and semantic "
                   "retrieval latency roughly doubled. The personal knowledge graph itself is "
                   "thinning -- not just test scores."),
             evidence=["n3", "n6", "ent0", "ent4"]),
    ]
    recall = [
        dict(q="Is this patient's memory declining?",
             a=("Yes. Over 60 days, family-relationship recall dropped ~32% and language "
                "complexity fell from 100 to 79. The decline is steady, not episodic."),
             confidence=83, evidence=["n3", "n6"]),
    ]
    return pid, events, {"nodes": nodes, "edges": edges}, insights, recall


# ---------------------------------------------------------------------------
# Filler patients -- enough volume to make the selector feel like a real product.
# ---------------------------------------------------------------------------
FILLER = [
    ("patient_003", "Marcus Bell", 58, "M", "Type 2 diabetes, hypertension"),
    ("patient_004", "Priya Nair", 34, "F", "Migraine, anxiety"),
    ("patient_005", "Liam O'Connor", 63, "M", "Atrial fibrillation, polypharmacy"),
    ("patient_006", "Sofia Ramos", 41, "F", "Hypothyroidism, vitamin D deficiency"),
    ("patient_007", "Daniel Kim", 29, "M", "Asthma, seasonal allergies"),
    ("patient_008", "Amara Okafor", 52, "F", "Rheumatoid arthritis"),
    ("patient_009", "Noah Schmidt", 47, "M", "GERD, high cholesterol"),
    ("patient_010", "Yuki Tanaka", 38, "F", "PCOS, insulin resistance"),
    ("patient_011", "Grace Bennett", 67, "F", "Osteoporosis, mild cognitive complaints"),
    ("patient_012", "Omar Haddad", 55, "M", "Chronic kidney disease stage 2"),
]


def filler_patient(pid, name, age, sex, conditions):
    events = [
        dict(id=f"{pid}_e1", date="2024-02-10", type="visit", title="Primary care visit",
             detail=f"Routine review of {conditions.lower()}.", module="medsync"),
        dict(id=f"{pid}_e2", date="2024-07-19", type="lab", title="Routine labs",
             detail="Mostly within range; one borderline marker.", module="curie"),
        dict(id=f"{pid}_e3", date="2025-01-08", type="medication", title="Maintenance medication",
             detail="Ongoing therapy.", module="rxshield"),
        dict(id=f"{pid}_e4", date="2025-09-22", type="lifestyle", title="Lifestyle log",
             detail="Sleep and activity tracked via wearable.", module="nutrisim"),
    ]
    nodes = [node(e["id"], e["title"], e["type"], e["date"], e["detail"]) for e in events]
    edges = [edge(f"{pid}_e1", f"{pid}_e2", "ordered", 0.6),
             edge(f"{pid}_e2", f"{pid}_e3", "informed", 0.6)]
    insights = [dict(id=f"{pid}_i1", module="curie", confidence=55, crossModule=False,
                     title="No urgent cross-references found",
                     body=f"History is consistent with {conditions.lower()}; no hidden multi-year pattern detected yet.",
                     evidence=[f"{pid}_e2"])]
    recall = [dict(q="Any hidden patterns?",
                   a=f"Nothing high-confidence yet. Known issues: {conditions.lower()}.",
                   confidence=55, evidence=[f"{pid}_e2"])]
    return pid, events, {"nodes": nodes, "edges": edges}, insights, recall


# ---------------------------------------------------------------------------
# The headline cross-module insight -- the demo's money shot.
# ---------------------------------------------------------------------------
def cross_insights():
    return {
        "patient_001": [
            dict(id="x1", confidence=84,
                 modules=["nutrisim", "rxshield", "pathos", "curie"],
                 title="One pattern, four specialists, nobody connected it",
                 body=("Elena's morning glucose spikes (NutriSim) began within days of her "
                       "Metoprolol dose increase (RxShield / MedSync) and recur in weeks "
                       "following her Sunday-night anxiety peaks (Pathos). Layered on top of "
                       "her rash -> joint-pain -> ANA -> nephritis trajectory (Curie), the "
                       "shared graph reveals a combined autoimmune + metabolic syndrome that "
                       "no single specialist could see from their own records."),
                 evidence=["e4", "e8", "e10", "e13", "e16", "c_lupus", "c_metabolic"]),
            dict(id="x2", confidence=71,
                 modules=["rxshield", "curie"],
                 title="Her kidney decline makes a routine drug risky",
                 body=("The same reduced kidney function driving the lupus-nephritis flag also "
                       "slows clearance of atorvastatin -- which Clarithromycin is now blocking "
                       "via CYP3A4. The autoimmune story and the drug-safety story are the same "
                       "organ failing in two graphs."),
                 evidence=["e16", "e17", "e18", "e19"]),
        ]
    }


def main():
    os.makedirs(os.path.join(DATA, "graph"), exist_ok=True)
    patients = []
    events_all: Dict[str, List] = {}
    insights_all: Dict[str, List] = {}
    recall_all: Dict[str, List] = {}

    def register(pid, name, age, sex, conditions, story, events, graph, insights, recall, hero=False):
        patients.append(dict(id=pid, name=name, age=age, sex=sex, conditions=conditions,
                             story=story, hero=hero, eventCount=len(events),
                             hue=(hash(pid) % 360)))
        events_all[pid] = events
        insights_all[pid] = insights
        recall_all[pid] = recall
        with open(os.path.join(DATA, "graph", f"{pid}.json"), "w") as f:
            json.dump(graph, f, indent=2)

    pid, ev, g, ins, rc = hero_elena()
    register(pid, "Elena Voss", 47, "F", ["Suspected lupus", "Prediabetes", "Anxiety"],
             "A 4-year autoimmune + metabolic story hidden across six specialists.",
             ev, g, ins, rc, hero=True)

    pid, ev, g, ins, rc = hero_arthur()
    register(pid, "Arthur Reyes", 72, "M", ["Mild cognitive impairment"],
             "Cognitive decline tracked as the patient's own knowledge graph thins.",
             ev, g, ins, rc, hero=True)

    for pid, name, age, sex, cond in FILLER:
        pid_, ev, g, ins, rc = filler_patient(pid, name, age, sex, cond)
        register(pid_, name, age, sex, [c.strip() for c in cond.split(",")],
                 f"Routine record: {cond.lower()}.", ev, g, ins, rc)

    with open(os.path.join(DATA, "patients.json"), "w") as f:
        json.dump(patients, f, indent=2)
    with open(os.path.join(DATA, "events.json"), "w") as f:
        json.dump(events_all, f, indent=2)
    with open(os.path.join(DATA, "insights.json"), "w") as f:
        json.dump(insights_all, f, indent=2)
    with open(os.path.join(DATA, "recall_cache.json"), "w") as f:
        json.dump(recall_all, f, indent=2)
    with open(os.path.join(DATA, "cross_insights.json"), "w") as f:
        json.dump(cross_insights(), f, indent=2)

    total_nodes = sum(len(json.load(open(os.path.join(DATA, "graph", f"{p['id']}.json")))["nodes"])
                      for p in patients)
    print(f"Generated {len(patients)} patients, {total_nodes} graph nodes.")
    print(f"Data written to {DATA}")


if __name__ == "__main__":
    main()
