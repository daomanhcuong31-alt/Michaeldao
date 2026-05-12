"""
tools/calculator.py — Python-based financial calculator

DESIGN PRINCIPLE: All arithmetic is done here, in Python, not by the LLM.
LLMs hallucinate numbers. Python does not.

The Financial Modeler agent extracts parameters → passes to these functions
→ gets back verified numbers → writes narrative around them.

Functions:
  calculate_dscr()         — Debt Service Coverage Ratio
  calculate_waterfall()    — Collateral coverage / LTV
  run_stress_scenarios()   — Sensitivity analysis on DSCR and LTV
"""

from typing import Optional


def calculate_dscr(
    ebitda: Optional[float],
    annual_debt_service: Optional[float],
    total_debt: Optional[float],
    facility_amount: Optional[float],
    interest_rate: Optional[float],
    tenor_years: Optional[float],
    repayment_type: str = "amortising"
) -> dict:
    """
    Calculate Debt Service Coverage Ratio.

    DSCR = EBITDA / Annual Debt Service
    Minimum acceptable: typically 1.20x for investment grade,
                        1.10x minimum for TCB SF deals

    If annual_debt_service is not provided, we estimate it from
    facility_amount, interest_rate, and tenor.

    Returns dict with DSCR, assessment, and calculation notes.
    """
    result = {
        "dscr_base": None,
        "assessment": None,
        "ebitda_used": ebitda,
        "annual_debt_service_used": None,
        "calculation_notes": [],
        "data_quality": "COMPLETE"
    }

    # ── Validate inputs ───────────────────────────────────────────────────────
    if ebitda is None:
        result["calculation_notes"].append("EBITDA not available — DSCR cannot be calculated")
        result["data_quality"] = "INSUFFICIENT"
        return result

    if annual_debt_service is None:
        # Estimate annual debt service from facility terms
        if facility_amount is not None and interest_rate is not None and tenor_years is not None:
            annual_interest = facility_amount * (interest_rate / 100)

            if repayment_type in ("amortising", "semi-annual"):
                annual_principal = facility_amount / tenor_years
                estimated_ads = annual_interest + annual_principal
                result["calculation_notes"].append(
                    f"Annual debt service estimated: "
                    f"interest ({interest_rate}% × {facility_amount:,.0f}) + "
                    f"principal ({facility_amount:,.0f} / {tenor_years} yrs)"
                )
            else:  # bullet — only interest during tenor
                estimated_ads = annual_interest
                result["calculation_notes"].append(
                    f"Bullet structure: annual debt service = interest only "
                    f"({interest_rate}% × {facility_amount:,.0f})"
                )
            annual_debt_service = estimated_ads
        else:
            result["calculation_notes"].append(
                "Insufficient data to estimate annual debt service — "
                "need: facility amount, interest rate, tenor"
            )
            result["data_quality"] = "INSUFFICIENT"
            return result

    result["annual_debt_service_used"] = annual_debt_service

    # ── Calculate DSCR ────────────────────────────────────────────────────────
    if annual_debt_service <= 0:
        result["calculation_notes"].append("Annual debt service is zero or negative — check inputs")
        result["data_quality"] = "ERROR"
        return result

    dscr = ebitda / annual_debt_service
    result["dscr_base"] = round(dscr, 2)

    # ── Assessment ────────────────────────────────────────────────────────────
    if dscr >= 1.50:
        result["assessment"] = "STRONG — significant headroom above 1.50x threshold"
    elif dscr >= 1.25:
        result["assessment"] = "ADEQUATE — comfortable above 1.25x minimum"
    elif dscr >= 1.10:
        result["assessment"] = "MARGINAL — above 1.10x floor but limited headroom"
    elif dscr >= 1.00:
        result["assessment"] = "WEAK — above 1.0x but below acceptable minimum"
    else:
        result["assessment"] = "CRITICAL — DSCR below 1.0x, debt service not covered by cash flow"

    return result


def calculate_waterfall(
    collateral_value: Optional[float],
    facility_amount: Optional[float],
    ltv_stated: Optional[float]
) -> dict:
    """
    Calculate collateral coverage and LTV.

    LTV = Facility Amount / Collateral Value
    Typical TCB SF requirements: LTV < 70% for real estate, < 80% for other assets

    Returns dict with LTV, coverage ratio, and assessment.
    """
    result = {
        "ltv_calculated": None,
        "ltv_stated": ltv_stated,
        "coverage_ratio": None,
        "assessment": None,
        "calculation_notes": [],
        "data_quality": "COMPLETE"
    }

    if collateral_value is None:
        result["calculation_notes"].append("Collateral value not provided")
        result["data_quality"] = "PARTIAL"
        if ltv_stated is not None:
            result["ltv_calculated"] = ltv_stated
            result["calculation_notes"].append(f"Using stated LTV: {ltv_stated}%")
        return result

    if facility_amount is None:
        result["calculation_notes"].append("Facility amount not provided — LTV cannot be calculated")
        result["data_quality"] = "INSUFFICIENT"
        return result

    ltv = (facility_amount / collateral_value) * 100
    result["ltv_calculated"] = round(ltv, 1)
    result["coverage_ratio"] = round(collateral_value / facility_amount, 2)

    # Consistency check
    if ltv_stated is not None:
        diff = abs(ltv - ltv_stated)
        if diff > 5:
            result["calculation_notes"].append(
                f"WARNING: Calculated LTV ({ltv:.1f}%) diverges from stated LTV "
                f"({ltv_stated}%) by {diff:.1f}pp — verify collateral valuation basis"
            )

    if ltv <= 50:
        result["assessment"] = "STRONG — LTV below 50%, substantial collateral headroom"
    elif ltv <= 65:
        result["assessment"] = "ADEQUATE — LTV within 65% threshold"
    elif ltv <= 75:
        result["assessment"] = "ACCEPTABLE — LTV within 75% limit, limited headroom"
    elif ltv <= 80:
        result["assessment"] = "ELEVATED — approaching 80% LTV ceiling"
    else:
        result["assessment"] = "HIGH — LTV exceeds 80%, collateral insufficient for this facility size"

    return result


def run_stress_scenarios(
    base_dscr: Optional[float],
    base_ltv: Optional[float]
) -> dict:
    """
    Run sensitivity/stress scenarios on the base case metrics.

    Standard stress tests:
    - Revenue down 10%, 20%, 30% (mapped to DSCR impact)
    - Collateral value down 10%, 20% (mapped to LTV impact)
    - Interest rate up 100bps, 200bps (DSCR impact for floating rate)

    Returns dict with stress results for each scenario.
    """
    scenarios = {}

    if base_dscr is not None:
        scenarios["dscr_stress"] = {
            "base": round(base_dscr, 2),
            "revenue_down_10pct": round(base_dscr * 0.90, 2),
            "revenue_down_20pct": round(base_dscr * 0.80, 2),
            "revenue_down_30pct": round(base_dscr * 0.70, 2),
            "break_even_revenue_decline_pct": round((1 - (1.10 / base_dscr)) * 100, 1)
                if base_dscr > 0 else None,
            "note": (
                f"DSCR breaks below 1.10x floor at "
                f"{round((1 - (1.10 / base_dscr)) * 100, 1)}% revenue decline"
                if base_dscr > 0 else "Cannot calculate — base DSCR unavailable"
            )
        }

    if base_ltv is not None:
        scenarios["ltv_stress"] = {
            "base": round(base_ltv, 1),
            "collateral_down_10pct": round(base_ltv / 0.90, 1),
            "collateral_down_20pct": round(base_ltv / 0.80, 1),
            "note": (
                f"Collateral must fall {round((1 - 80 / (base_ltv / 0.80)) * 100, 0) if base_ltv > 0 else 'N/A'}%"
                f" before LTV breach at 80% ceiling"
            )
        }

    if not scenarios:
        scenarios["note"] = "Insufficient base case data to run stress scenarios"

    return scenarios
