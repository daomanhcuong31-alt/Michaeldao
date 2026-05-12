import json, re
from agents.base import BaseAgent
from workflow.state import DealState

REQ = {
  "borrower":"[NOT PROVIDED]","borrower_type":"[NOT PROVIDED]","facility_type":"[NOT PROVIDED]",
  "amount":"[NOT PROVIDED]","currency":"[NOT PROVIDED]","tenor":"[NOT PROVIDED]",
  "pricing":"[NOT PROVIDED]","pricing_basis":"[NOT PROVIDED]","security":"[NOT PROVIDED]",
  "security_value":"[NOT PROVIDED]","purpose":"[NOT PROVIDED]","repayment_schedule":"[NOT PROVIDED]",
  "covenants":[],"conditions_precedent":[],"governing_law":"[NOT PROVIDED]","accounting_standard":"[NOT PROVIDED]",
  "deal_parties":{"mandated_lead_arranger":"[NOT PROVIDED]","facility_agent":"[NOT PROVIDED]","security_agent":"[NOT PROVIDED]"},
  "key_dates":{"signing_date":"[NOT PROVIDED]","availability_period":"[NOT PROVIDED]","maturity_date":"[NOT PROVIDED]"},
  "missing_or_unclear":[]
}

class IngestionAgent(BaseAgent):
    name = "ingestion"
    system_prompt = "Extract strict JSON only. Never add prose."

    def _json(self, t):
        t = re.sub(r"```(?:json)?\n?", "", t).replace("```","").strip()
        m = re.findall(r"\{[\s\S]*\}", t)
        if m: t = sorted(m,key=len,reverse=True)[0]
        try: return json.loads(t)
        except: return None

    def _heur(self, s):
        def g(p, d="[NOT PROVIDED]"):
            m = re.search(p, s, re.I)
            return m.group(1).strip() if m else d
        o = json.loads(json.dumps(REQ))
        o["borrower"] = g(r"Borrower:\s*(.+?)(?:\n|$)")
        o["borrower_type"] = g(r"Borrower Type:\s*(.+?)(?:\n|$)")
        o["facility_type"] = g(r"Facility Type:\s*(.+?)(?:\n|$)")
        o["amount"] = g(r"Amount:\s*(.+?)(?:\n|$)")
        o["currency"] = g(r"Currency:\s*([A-Z]{3})")
        o["tenor"] = g(r"Tenor:\s*(.+?)(?:\n|$)")
        o["pricing"] = g(r"Pricing:\s*(.+?)(?:\n|$)")
        o["pricing_basis"] = g(r"Pricing Basis:\s*(.+?)(?:\n|$)")
        o["purpose"] = g(r"Purpose:\s*(.+?)(?:\n|$)")
        o["repayment_schedule"] = g(r"Repayment:\s*(.+?)(?:\n|$)")
        o["governing_law"] = g(r"Governing Law:\s*(.+?)(?:\n|$)")
        o["accounting_standard"] = g(r"Accounting Standard:\s*(.+?)(?:\n|$)")
        sec = re.search(r"Security:\s*([\s\S]+?)(?:Covenants:|Conditions Precedent:|Governing Law:|$)", s, re.I)
        if sec: o["security"] = sec.group(1).strip()
        cov = re.search(r"Covenants:\s*([\s\S]+?)(?:Conditions Precedent:|Governing Law:|$)", s, re.I)
        if cov: o["covenants"] = re.findall(r"-\s*(.+)", cov.group(1))
        cp = re.search(r"Conditions Precedent:\s*([\s\S]+?)(?:Governing Law:|$)", s, re.I)
        if cp: o["conditions_precedent"] = re.findall(r"-\s*(.+)", cp.group(1))
        miss=[]
        for k,v in o.items():
            if isinstance(v,str) and v=="[NOT PROVIDED]": miss.append(k)
        o["missing_or_unclear"]=miss
        return o

    def _merge_fill(self, llm_obj, heur_obj):
        o = json.loads(json.dumps(REQ))
        if isinstance(llm_obj, dict):
            o.update({k:v for k,v in llm_obj.items() if k in o and k not in ["deal_parties","key_dates"]})
            if isinstance(llm_obj.get("deal_parties"),dict): o["deal_parties"].update(llm_obj["deal_parties"])
            if isinstance(llm_obj.get("key_dates"),dict): o["key_dates"].update(llm_obj["key_dates"])
        for k,v in heur_obj.items():
            if k in ["deal_parties","key_dates"]: continue
            if (isinstance(o.get(k),str) and o[k]=="[NOT PROVIDED]" and isinstance(v,str) and v!="[NOT PROVIDED]"):
                o[k]=v
            if (isinstance(o.get(k),list) and not o[k] and isinstance(v,list) and v):
                o[k]=v
        return o

    def extract_terms(self, raw):
        prompt = f"Return strict JSON using this schema keys only:\n{json.dumps(REQ)}\n\nDocument:\n{raw}"
        r = self.call_llm(prompt)
        j = self._json(r)
        h = self._heur(raw)
        return self._merge_fill(j, h)

    def run(self, state: DealState) -> dict:
        print(f"[Ingestion] Processing document ({len(state.input_text)} chars)...")
        if not state.input_text.strip():
            state.add_error("ingestion","No input text provided"); state.mark_complete("ingestion"); return state.dict()
        parsed = self.extract_terms(state.input_text.strip())
        print(f"[Ingestion] Extracted {len(parsed)} top-level fields")
        state.raw_text = state.input_text.strip()
        state.parsed_terms = parsed
        state.mark_complete("ingestion")
        return state.dict()

_agent = IngestionAgent()
def run_ingestion_agent(state: DealState) -> dict:
    return _agent.run(state)
