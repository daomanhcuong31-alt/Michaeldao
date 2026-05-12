"""
main.py - SF Agentic AI System entry point
"""

import argparse
import json
import os
import sys
from datetime import datetime
from pathlib import Path
from rich.console import Console
from rich.panel import Panel
from rich.table import Table
from workflow.intent_router import route_intent, get_output_family
from prompts.audience_profiles import AUDIENCE_PROFILES
from tools.healthcheck import preflight_lm_studio

console = Console()

OUTPUT_PROFILES = {
    "credit_memo": {"label": "credit memo", "title": "DRAFT CREDIT COMMITTEE MEMORANDUM", "prefix": "CreditMemo"},
    "analysis_brief": {"label": "analysis brief", "title": "ANALYSIS BRIEF", "prefix": "AnalysisBrief"},
    "ops_sop": {"label": "operations SOP", "title": "STANDARD OPERATING PROCEDURE", "prefix": "SOP"},
    "meeting_minutes": {"label": "meeting minutes", "title": "MEETING MINUTES", "prefix": "MeetingMinutes"},
    "pipeline_report": {"label": "pipeline report", "title": "PIPELINE REPORT", "prefix": "PipelineReport"},
    "data_analysis": {"label": "data analysis report", "title": "DATA ANALYSIS REPORT", "prefix": "DataAnalysis"},
    "market_intel": {"label": "market intelligence brief", "title": "MARKET INTELLIGENCE BRIEF", "prefix": "MarketIntel"},
}

SAMPLE_TERM_SHEET = """
TERM SHEET - INDICATIVE (NOT BINDING)
Date: April 2026

Borrower: Viet Nam Industrial Development Corporation (VIDC)
Borrower Type: State-Owned Enterprise (100% Government Owned)
Facility Type: Syndicated Term Loan
Amount: USD 25,000,000 (Twenty-Five Million US Dollars)
Currency: USD
Tenor: 5 years from first drawdown
Pricing: SOFR + 3.50% per annum
Pricing Basis: Floating rate, reset quarterly
Purpose: Acquisition of industrial machinery and equipment for expansion
Repayment: Semi-annual equal principal instalments
Security: First-ranking mortgage over industrial land use rights
Covenants:
  - DSCR minimum 1.20x
  - Leverage ratio maximum 3.5x Net Debt / EBITDA
Conditions Precedent:
  - Legal opinions from Vietnamese and international counsel
Governing Law: Vietnamese Law
Accounting Standard: IFRS
"""


def _short_json(value, limit: int = 1800) -> str:
    try:
        text = json.dumps(value or {}, indent=2, ensure_ascii=False)
    except Exception:
        text = str(value or "")
    return text[:limit].rstrip()


def _output_profile(final_state):
    family = get_output_family(final_state)
    return family, OUTPUT_PROFILES.get(family, OUTPUT_PROFILES["analysis_brief"])


def _build_partial_worker_report(final_state) -> str:
    family, profile = _output_profile(final_state)
    parsed = final_state.parsed_terms or {}
    completed = ", ".join(final_state.completed_steps or []) or "none"
    missing = parsed.get("missing_or_unclear") if isinstance(parsed, dict) else []
    missing_text = ", ".join(missing) if isinstance(missing, list) and missing else "none identified"
    title = f"PARTIAL {profile['title']}" if family != "credit_memo" else "PARTIAL STRUCTURED FINANCE WORKER OUTPUT"
    return f"""# {title}

## Output Status
- This run completed without final output from `memo_architect`.
- Completed workers: {completed}.
- Requested output family: {family}.
- This is a structured partial output, not a final stakeholder-ready {profile['label']}.
- To produce a final output, rerun with `memo_architect` or the appropriate output profile enabled.

## Extracted Deal Terms
- Borrower: {parsed.get('borrower', '[NOT PROVIDED]')}
- Borrower type: {parsed.get('borrower_type', '[NOT PROVIDED]')}
- Facility type: {parsed.get('facility_type', '[NOT PROVIDED]')}
- Amount: {parsed.get('amount', '[NOT PROVIDED]')} {parsed.get('currency', '')}
- Tenor: {parsed.get('tenor', '[NOT PROVIDED]')}
- Pricing: {parsed.get('pricing', '[NOT PROVIDED]')}
- Purpose: {parsed.get('purpose', '[NOT PROVIDED]')}
- Security: {parsed.get('security', '[NOT PROVIDED]')}
- Governing law: {parsed.get('governing_law', '[NOT PROVIDED]')}

## Covenants
{chr(10).join(f"- {item}" for item in parsed.get('covenants', []) if item) or "- No covenants extracted."}

## Conditions Precedent
{chr(10).join(f"- {item}" for item in parsed.get('conditions_precedent', []) if item) or "- No conditions precedent extracted."}

## Missing Or Unclear Fields
- {missing_text}

## Raw Parsed Terms
```json
{_short_json(parsed)}
```
"""


def _ensure_non_empty_output(final_state):
    if (final_state.draft_memo or "").strip():
        return final_state
    md = final_state.output_metadata or {}
    md["fallback_output_generated"] = True
    md["fallback_reason"] = "Pipeline completed without draft_memo; generated partial worker report to prevent empty artifact."
    md["completed_steps"] = list(final_state.completed_steps or [])
    final_state.output_metadata = md
    final_state.draft_memo = _build_partial_worker_report(final_state)
    return final_state


def _env_bool(name: str, default: str = "false") -> bool:
    return str(os.getenv(name, default)).strip().lower() in {"1", "true", "yes", "on"}



def _mirror_output_to_desktop(file_path: Path):
    mirror_dir_raw = os.getenv(
        "OUTPUT_MIRROR_DIR",
        str(Path.home() / "Desktop" / "sf-agentic-output"),
    )
    mirror_dir = Path(mirror_dir_raw).expanduser()
    try:
        mirror_dir.mkdir(parents=True, exist_ok=True)
        mirror_file = mirror_dir / file_path.name
        mirror_file.write_bytes(file_path.read_bytes())
        console.print(f"[green]OK Desktop copy saved: {mirror_file}[/green]")
    except Exception as e:
        console.print(f"[yellow]Warning: could not mirror output to Desktop: {e}[/yellow]")


def _resolve_output_family(raw: str) -> str:
    return get_output_family(raw)


def process_deal(
    input_text: str = None,
    file_paths=None,
    audience: str = "credit_committee",
    intent: str = "memo_only",
    route_mode: str = "auto",
    target_workers=None,
    manager_instruction: str = "",
    run_preflight: bool = True,
    report_format: str = "credit_memo",
    sop_format: str = "",
    output_template_id: str = "autonomous",
    structured_output_instruction: str = "",
    report_length_words: int = 0,
    credit_decision_mode: str = "analysis_only",
):
    file_paths = file_paths or []
    target_workers = target_workers or []

    if run_preflight:
        console.print("\n[bold]Step 1/6:[/bold] Checking LLM endpoint connection...")
        from config import settings
        health = preflight_lm_studio(settings.base_url, settings.model, provider=settings.llm_provider)
        if not health.get("ok"):
            console.print(f"[red]x {health.get('error', 'LLM preflight failed.')}[/red]")
            sys.exit(1)
        console.print(f"[green]OK LLM endpoint connected ({settings.model})[/green]")
        if health.get("warning"):
            console.print(f"[yellow]Warning: {health['warning']}[/yellow]")
    else:
        console.print("\n[bold]Step 1/6:[/bold] Preflight skipped by flag")

    if file_paths and not input_text:
        from tools.ocr import extract_text_from_files
        console.print(f"\n[bold]Step 2/6:[/bold] Extracting text from {len(file_paths)} file(s)...")
        ext = extract_text_from_files(file_paths)
        input_text = ext["text"]
        for w in ext.get("warnings", []):
            console.print(f"  [yellow]Warning: {w}[/yellow]")
        if not input_text.strip():
            console.print("[red]x Could not extract text from provided files.[/red]")
            sys.exit(1)
        console.print(f"[green]OK Extracted {len(input_text)} characters from {ext['count']} file(s)[/green]")
    else:
        input_text = input_text or ""
        console.print(f"\n[bold]Step 2/6:[/bold] Using provided text ({len(input_text)} chars) OK")

    console.print("\n[bold]Step 3/6:[/bold] Running agent pipeline...")
    from workflow.graph import run_pipeline
    try:
        desired_output = _resolve_output_family(report_format or output_template_id or intent)
        final_state = run_pipeline(
            input_text=input_text,
            file_path=";".join(file_paths) if file_paths else None,
            audience=audience,
            intent=intent,
            route_mode=route_mode,
            target_workers=target_workers,
            manager_instruction=manager_instruction,
            desired_output=desired_output,
            report_format=report_format or desired_output,
            sop_format=sop_format,
            output_template_id=output_template_id,
            structured_output_instruction=structured_output_instruction,
            report_length_words=report_length_words,
            credit_decision_mode=credit_decision_mode,
        )
    except Exception as e:
        console.print(f"[red]x Pipeline execution failed: {e}[/red]")
        sys.exit(1)

    console.print("\n[bold]Step 4/6:[/bold] Pipeline complete. Summary:")
    table = Table(show_header=True, header_style="bold")
    table.add_column("Agent", style="cyan")
    table.add_column("Status")
    table.add_column("Notes")

    agents = ["ingestion", "market_intel", "analysis_parallel", "financial_modeler", "compliance", "memo_architect", "senior_advisor"]
    labels = {
        "ingestion": "Ingestion",
        "market_intel": "Market Intelligence",
        "analysis_parallel": "Parallel Analysis",
        "financial_modeler": "Financial Modeler",
        "compliance": "Compliance and Risk",
        "memo_architect": "Memo Architect",
        "senior_advisor": "Senior Advisor",
    }

    for a in agents:
        done = a in final_state.completed_steps
        errs = [e for e in final_state.errors if e.get("agent") == a]
        note = errs[0]["error"][:80] if errs else "-"
        table.add_row(labels[a], "[green]OK Complete[/green]" if done else "[red]x Incomplete[/red]", note)

    console.print(table)
    console.print(
        f"\n[bold]Senior Advisor Decision:[/bold] "
        f"{getattr(final_state, 'quality_gate_decision', 'N/A')} "
        f"(score: {getattr(final_state, 'quality_score', 'N/A')})"
    )

    final_state = _ensure_non_empty_output(final_state)
    family, profile = _output_profile(final_state)
    console.print(f"\n[bold]Step 5/6:[/bold] Saving {profile['label']}...")
    output_dir = Path("./data/output")
    output_dir.mkdir(parents=True, exist_ok=True)
    timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
    borrower = (final_state.parsed_terms or {}).get("borrower", "unknown")
    safe_name = "".join(c for c in borrower if c.isalnum() or c in " _-")[:30].strip() or "unknown"
    output_file = output_dir / f"{profile['prefix']}_{safe_name}_{timestamp}.txt"

    with open(output_file, "w", encoding="utf-8") as f:
        f.write(final_state.draft_memo or "")
    final_state.output_metadata = final_state.output_metadata or {}
    final_state.output_metadata.update(
        {
            "output_family": family,
            "output_label": profile["label"],
            "output_title": profile["title"],
            "report_format": getattr(final_state, "report_format", report_format),
            "output_template_id": getattr(final_state, "output_template_id", output_template_id),
        }
    )
    meta_file = output_dir / f"{profile['prefix']}_{safe_name}_{timestamp}.metadata.json"
    with open(meta_file, "w", encoding="utf-8") as f:
        json.dump(final_state.output_metadata or {}, f, indent=2, ensure_ascii=False)

    console.print(f"[green]OK Output saved: {output_file}[/green]")
    console.print(f"[green]OK Metadata saved: {meta_file}[/green]")
    _mirror_output_to_desktop(output_file)
    _mirror_output_to_desktop(meta_file)

    console.print(f"\n[bold]Step 6/6:[/bold] {profile['label'].title()}:\n")
    console.print(
        Panel(
            final_state.draft_memo or "[EMPTY OUTPUT]",
            title=f"[bold cyan]{profile['title']}[/bold cyan]",
            border_style="cyan",
            expand=False,
        )
    )
    return final_state


def _prompt_post_credit_mode() -> str:
    console.print("\n[bold]Post-Credit Stage:[/bold] choose next action")
    console.print("  [bold]1.[/bold] Stop after memo (human review only)")
    console.print("  [bold]2.[/bold] Holdbook execution plan only")
    console.print("  [bold]3.[/bold] Distribution advisory + operations plan")
    console.print("  [bold]4.[/bold] Hybrid (partial distribution + holdbook)")
    choice = input("Choose (1/2/3/4): ").strip()
    return {"1": "stop", "2": "holdbook", "3": "distribution", "4": "hybrid"}.get(choice, "stop")


def _prompt_human_gate_decision() -> str:
    console.print("\n[bold]Mandatory Human Gate:[/bold] choose decision")
    console.print("  [bold]1.[/bold] approve")
    console.print("  [bold]2.[/bold] revise (one controlled pass)")
    console.print("  [bold]3.[/bold] stop")
    choice = input("Choose (1/2/3): ").strip()
    return {"1": "approve", "2": "revise", "3": "stop"}.get(choice, "stop")


def _run_controlled_revision_pass(final_state):
    from agents.memo_architect import run_memo_architect_agent
    from workflow.senior_advisor import run_senior_advisor_agent
    updated = run_memo_architect_agent(final_state)
    final_state = type(final_state)(**updated)
    updated = run_senior_advisor_agent(final_state)
    return type(final_state)(**updated)


def run_post_credit_stage(
    final_state,
    requested_mode: str = "ask",
    no_web_research: bool = False,
    gate_decision: str = "ask",
    autonomous: bool = False,
):
    decision = (gate_decision or "ask").strip().lower()
    if decision == "ask":
        decision = "approve" if autonomous else _prompt_human_gate_decision()

    if decision == "revise":
        console.print("\n[bold]Human Gate:[/bold] Running one controlled revision pass...")
        final_state = _run_controlled_revision_pass(final_state)
        decision = "approve" if final_state.quality_gate_decision == "APPROVE" else "stop"

    if decision == "stop":
        console.print("\n[dim]Workflow terminated by human gate decision. Artifacts already saved.[/dim]")
        return

    mode = (requested_mode or "ask").strip().lower()
    if mode == "ask":
        mode = "distribution" if autonomous else _prompt_post_credit_mode()

    if mode == "stop":
        console.print("\n[dim]Post-credit stage skipped by user.[/dim]")
        return

    if getattr(final_state, "quality_gate_decision", "") == "ESCALATE_TO_HUMAN":
        if autonomous:
            console.print("[yellow]Warning: autonomous mode continuing despite ESCALATE_TO_HUMAN decision.[/yellow]")
            md = final_state.output_metadata or {}
            md["autonomous_override_escalation"] = True
            final_state.output_metadata = md
        else:
            confirm = input("Memo is escalated for human review. Continue to post-credit planning anyway? (y/N): ").strip().lower()
            if confirm not in {"y", "yes"}:
                console.print("[dim]Post-credit stage cancelled.[/dim]")
                return

    from workflow.post_credit import run_post_credit_workflow, render_post_credit_report

    console.print("\n[bold]Step 7:[/bold] Running post-credit execution stage...")
    bundle = run_post_credit_workflow(
        final_state,
        mode=mode.upper(),
        run_web_research=(not no_web_research),
    )

    output_dir = Path("./data/output")
    output_dir.mkdir(parents=True, exist_ok=True)
    timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
    borrower = (final_state.parsed_terms or {}).get("borrower", "unknown")
    safe_name = "".join(c for c in borrower if c.isalnum() or c in " _-")[:30].strip() or "unknown"

    json_file = output_dir / f"PostCredit_{safe_name}_{timestamp}.json"
    md_file = output_dir / f"PostCredit_{safe_name}_{timestamp}.md"

    with open(json_file, "w", encoding="utf-8") as f:
        json.dump(bundle, f, indent=2, ensure_ascii=False)

    report = render_post_credit_report(bundle)
    with open(md_file, "w", encoding="utf-8") as f:
        f.write(report)

    console.print(f"[green]OK Post-credit JSON saved: {json_file}[/green]")
    console.print(f"[green]OK Post-credit report saved: {md_file}[/green]")
    _mirror_output_to_desktop(json_file)
    _mirror_output_to_desktop(md_file)

    advice = bundle.get("distribution_advice", {}) if isinstance(bundle, dict) else {}
    rec = advice.get("distribution_recommendation", "N/A")
    conf = advice.get("confidence", "N/A")
    console.print(f"[bold]Distribution recommendation:[/bold] {rec} (confidence: {conf})")


def main():
    parser = argparse.ArgumentParser(description="SF Agentic AI - Automated Credit Memo + Post-Credit Planning")
    parser.add_argument("--text", type=str, help="Term sheet text")
    parser.add_argument("--file", type=str, help="Single file path")
    parser.add_argument("--files", nargs="+", help="Multiple file paths")
    parser.add_argument("--sample", action="store_true", help="Run with sample deal")
    parser.add_argument(
        "--intent",
        choices=[
            "memo_only",
            "memo_plus_distribution",
            "memo_plus_holdbook",
            "full_e2e",
            "custom",
            "analysis_brief",
            "ops_sop",
            "meeting_minutes",
            "pipeline_report",
            "market_intel",
            "data_analysis",
        ],
        default="memo_only",
    )
    parser.add_argument("--audience", choices=sorted(AUDIENCE_PROFILES.keys()), default="credit_committee")
    parser.add_argument("--route-mode", choices=["auto", "full", "targeted"], default="auto")
    parser.add_argument("--workers", type=str, default="", help="Comma-separated worker names for route-mode=targeted")
    parser.add_argument("--manager-note", type=str, default="", help="Manager instruction for routing inference in route-mode=auto")
    parser.add_argument("--report-format", type=str, default="", help="Output family/report format, e.g. credit_memo, ops_sop, meeting_minutes, pipeline_report")
    parser.add_argument("--sop-format", type=str, default="", help="SOP/profile subformat hint")
    parser.add_argument("--output-template", type=str, default="autonomous", help="Structured output template id")
    parser.add_argument("--structured-output", type=str, default="", help="Structured output instruction")
    parser.add_argument("--report-length-words", type=int, default=0, help="Target output length")
    parser.add_argument("--credit-decision-mode", choices=["analysis_only", "decision_recommendation"], default="analysis_only")
    parser.add_argument("--post-credit", choices=["ask", "stop", "holdbook", "distribution", "hybrid"], default="ask")
    parser.add_argument("--human-gate", choices=["ask", "approve", "revise", "stop"], default="ask")
    parser.add_argument("--autonomous", action="store_true", help="Run non-interactive autonomous flow (no input prompts; auto-continue on escalation)")
    parser.add_argument("--no-web-research", action="store_true", help="Disable Perplexity web research in post-credit stage")
    parser.add_argument("--skip-preflight", action="store_true", help="Skip provider preflight checks before pipeline execution")
    parser.add_argument("--fast", action="store_true", help="Fast mode: shorter LLM timeouts, lower token budgets, concise outputs")
    args = parser.parse_args()
    from config import settings

    autonomous = bool(args.autonomous or _env_bool("SF_AUTONOMOUS_MODE", "false"))
    if args.fast:
        os.environ["SF_FAST_MODE"] = "true"
    route = route_intent(args.intent, explicit_post_credit=args.post_credit if args.post_credit != "ask" else "")
    selected_workers = [w.strip() for w in (args.workers or "").split(",") if w.strip()]
    output_kwargs = {
        "report_format": args.report_format or route.intent,
        "sop_format": args.sop_format,
        "output_template_id": args.output_template,
        "structured_output_instruction": args.structured_output,
        "report_length_words": args.report_length_words,
        "credit_decision_mode": args.credit_decision_mode,
    }
    chosen_post_credit = args.post_credit if args.post_credit != "ask" else route.post_credit_mode.lower()
    chosen_gate = args.human_gate
    if autonomous and chosen_gate == "ask":
        chosen_gate = "approve"
    elif chosen_gate == "ask" and chosen_post_credit in {"distribution", "holdbook", "hybrid"}:
        chosen_gate = "approve"
    elif chosen_gate == "ask" and chosen_post_credit == "stop":
        chosen_gate = "stop"

    provider_label = "Hermes gateway" if settings.llm_provider in {"hermes", "hermes"} else "LM Studio"
    console.print(
        Panel.fit(
            "[bold cyan]SF Agentic AI System[/bold cyan]\n"
            f"[dim]Structured Finance - Local LLM via {provider_label}[/dim]",
            border_style="cyan",
        )
    )
    if not args.skip_preflight:
        preflight = preflight_lm_studio(settings.base_url, settings.model, provider=settings.llm_provider)
        if not preflight.get("ok"):
            console.print(f"[red]Preflight failed: {preflight.get('error', 'unknown error')}[/red]")
            sys.exit(1)
        console.print(
            f"[green]Preflight OK:[/green] {preflight.get('models_url')} "
            f"(models={preflight.get('model_count', 0)})"
        )
        if preflight.get("warning"):
            console.print(f"[yellow]Warning: {preflight['warning']}[/yellow]")

    final_state = None

    if args.sample:
        final_state = process_deal(
            input_text=SAMPLE_TERM_SHEET,
            audience=args.audience,
            intent=route.intent,
            route_mode=args.route_mode,
            target_workers=selected_workers,
            manager_instruction=args.manager_note,
            run_preflight=False,
            **output_kwargs,
        )
    elif args.text:
        final_state = process_deal(
            input_text=args.text,
            audience=args.audience,
            intent=route.intent,
            route_mode=args.route_mode,
            target_workers=selected_workers,
            manager_instruction=args.manager_note,
            run_preflight=False,
            **output_kwargs,
        )
    elif args.files:
        bad = [f for f in args.files if not os.path.exists(f)]
        if bad:
            console.print(f"[red]Missing file(s): {bad}[/red]")
            sys.exit(1)
        final_state = process_deal(
            file_paths=args.files,
            audience=args.audience,
            intent=route.intent,
            route_mode=args.route_mode,
            target_workers=selected_workers,
            manager_instruction=args.manager_note,
            run_preflight=False,
            **output_kwargs,
        )
    elif args.file:
        if not os.path.exists(args.file):
            console.print(f"[red]File not found: {args.file}[/red]")
            sys.exit(1)
        final_state = process_deal(
            file_paths=[args.file],
            audience=args.audience,
            intent=route.intent,
            route_mode=args.route_mode,
            target_workers=selected_workers,
            manager_instruction=args.manager_note,
            run_preflight=False,
            **output_kwargs,
        )
    else:
        if autonomous:
            final_state = process_deal(
                input_text=SAMPLE_TERM_SHEET,
                audience=args.audience,
                intent=route.intent,
                route_mode=args.route_mode,
                target_workers=selected_workers,
                manager_instruction=args.manager_note,
                run_preflight=False,
                **output_kwargs,
            )
        else:
            console.print("\nNo input provided. Options:\n")
            console.print("  [bold]1.[/bold] Run sample")
            console.print("  [bold]2.[/bold] Paste text")
            console.print("  [bold]3.[/bold] Provide file path(s)")
            console.print("  [bold]4.[/bold] Exit\n")
            choice = input("Choose (1/2/3/4): ").strip()

            if choice == "1":
                final_state = process_deal(
                    input_text=SAMPLE_TERM_SHEET,
                    audience=args.audience,
                    intent=route.intent,
                    route_mode=args.route_mode,
                    target_workers=selected_workers,
                    manager_instruction=args.manager_note,
                    run_preflight=False,
                    **output_kwargs,
                )
            elif choice == "2":
                console.print("\nPaste text then type END on a new line:\n")
                lines = []
                while True:
                    line = input()
                    if line.strip() == "END":
                        break
                    lines.append(line)
                final_state = process_deal(
                    input_text="\n".join(lines),
                    audience=args.audience,
                    intent=route.intent,
                    route_mode=args.route_mode,
                    target_workers=selected_workers,
                    manager_instruction=args.manager_note,
                    run_preflight=False,
                    **output_kwargs,
                )
            elif choice == "3":
                raw = input("Enter one or more file paths separated by comma: ").strip()
                paths = [p.strip() for p in raw.split(",") if p.strip()]
                bad = [f for f in paths if not os.path.exists(f)]
                if bad:
                    console.print(f"[red]Missing file(s): {bad}[/red]")
                    sys.exit(1)
                final_state = process_deal(
                    file_paths=paths,
                    audience=args.audience,
                    intent=route.intent,
                    route_mode=args.route_mode,
                    target_workers=selected_workers,
                    manager_instruction=args.manager_note,
                    run_preflight=False,
                    **output_kwargs,
                )
            else:
                sys.exit(0)

    if final_state is not None:
        final_state.output_metadata = final_state.output_metadata or {}
        final_state.output_metadata["autonomous_mode"] = autonomous
        final_state.output_metadata["route_mode"] = args.route_mode
        if selected_workers:
            final_state.output_metadata["target_workers"] = selected_workers
        if args.manager_note:
            final_state.output_metadata["manager_instruction"] = args.manager_note
        final_state.output_metadata.update(output_kwargs)
        if args.fast:
            final_state.output_metadata["fast_mode"] = True
        run_post_credit_stage(
            final_state,
            requested_mode=chosen_post_credit,
            no_web_research=args.no_web_research,
            gate_decision=chosen_gate,
            autonomous=autonomous,
        )


if __name__ == "__main__":
    main()
