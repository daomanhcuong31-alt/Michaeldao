from tools.calculator import calculate_dscr, calculate_waterfall, run_stress_scenarios


def test_calculate_dscr_with_explicit_ads():
    out = calculate_dscr(
        ebitda=120.0,
        annual_debt_service=80.0,
        total_debt=1000.0,
        facility_amount=1000.0,
        interest_rate=8.0,
        tenor_years=5.0,
        repayment_type="amortising",
    )
    assert out["dscr_base"] == 1.5
    assert "STRONG" in (out.get("assessment") or "")


def test_calculate_dscr_estimates_ads_when_missing():
    out = calculate_dscr(
        ebitda=180.0,
        annual_debt_service=None,
        total_debt=1000.0,
        facility_amount=1000.0,
        interest_rate=10.0,
        tenor_years=5.0,
        repayment_type="amortising",
    )
    # estimated ADS = 100 (interest) + 200 (principal) = 300 -> DSCR 0.6
    assert out["annual_debt_service_used"] == 300.0
    assert out["dscr_base"] == 0.6


def test_calculate_waterfall_and_stress():
    wf = calculate_waterfall(collateral_value=200.0, facility_amount=100.0, ltv_stated=50.0)
    assert wf["ltv_calculated"] == 50.0
    assert wf["coverage_ratio"] == 2.0

    stress = run_stress_scenarios(base_dscr=1.4, base_ltv=50.0)
    assert stress["dscr_stress"]["revenue_down_10pct"] == 1.26
    assert stress["ltv_stress"]["collateral_down_20pct"] == 62.5
