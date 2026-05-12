#!/usr/bin/env python3
import argparse
import os
import subprocess
import time
from pathlib import Path
from datetime import datetime

UAT_CASES = [
    {
        "name": "SOP_Test",
        "intent": "ops_sop",
        "text": "Procedure for onboarding new corporate clients.\n1. Collect KYC documents.\n2. Verify against watchlists.\n3. Open account.\nRole: Compliance Officer.",
    },
    {
        "name": "Meeting_Minutes_Test",
        "intent": "meeting_minutes",
        "text": "Quarterly review meeting.\nDate: April 15, 2026.\nAttendees: Alice, Bob, Charlie.\nWe decided to launch the new transit trade product.\nAction: Bob to draft the risk policy by next week.",
    },
    {
        "name": "Pipeline_Report_Test",
        "intent": "pipeline_report",
        "text": "Pipeline Report Q2.\nTotal Value: $50M.\nDeals in progress: Alpha Corp ($20M, Stage: DD), Beta LLC ($30M, Stage: Term Sheet).\nRisk: Beta LLC financials are delayed.",
    },
    {
        "name": "Market_Intel_Test",
        "intent": "market_intel",
        "text": "Market Intel: Vietnam Renewable Energy.\nSummary: Solar power investments are slowing down due to grid capacity limits, while offshore wind is seeing new regulatory frameworks.\nTrends: Shift from solar to wind.",
    },
    {
        "name": "Data_Analysis_Test",
        "intent": "data_analysis",
        "text": "Trade Finance Data Analysis.\nData Source: Q1 LC Issuance.\nMetrics: 50 LCs issued, total volume $120M. Default rate 0%.\nTrends: 20% increase in volume compared to Q4.\nRecommendation: Expand limits for top 10 clients.",
    },
]


def parse_args():
    p = argparse.ArgumentParser(description='Run autonomous UAT cases for agent workflow')
    p.add_argument('--provider', default=os.getenv('LLM_PROVIDER', 'hermes'), help='Provider to force (default: env LLM_PROVIDER or hermes)')
    p.add_argument('--max-cases', type=int, default=0, help='Run only first N cases (0=all)')
    p.add_argument('--mode', default='stop', choices=['stop', 'distribution', 'holdbook', 'hybrid'], help='post-credit mode')
    p.add_argument('--no-fast', action='store_true', help='Disable --fast flag when calling main.py')
    p.add_argument('--checkpoint-dir', default='data/checkpoints', help='Directory to write checkpoints')
    return p.parse_args()


def run_uat():
    args = parse_args()
    checkpoint_dir = Path(args.checkpoint_dir)
    checkpoint_dir.mkdir(parents=True, exist_ok=True)

    timestamp = datetime.now().strftime('%Y%m%d_%H%M%S')
    checkpoint_file = checkpoint_dir / f'UAT_CHECKPOINT_{timestamp}.md'

    with open(checkpoint_file, 'w', encoding='utf-8') as f:
        f.write('# Autonomous UAT Checkpoint\n\n')
        f.write(f'Date: {datetime.now().isoformat()}\n')
        f.write(f'Provider: `{args.provider}`\n')
        f.write(f'Post-credit mode: `{args.mode}`\n\n')

    cases = UAT_CASES[:args.max_cases] if args.max_cases and args.max_cases > 0 else UAT_CASES
    print(f'Starting Autonomous UAT. Cases to run: {len(cases)}')

    success_count = 0

    for case in cases:
        print(f"[{datetime.now().strftime('%H:%M:%S')}] Running {case['name']} (intent={case['intent']})")

        input_file = Path(f"tmp_input_{case['name']}.txt")
        input_file.write_text(case['text'], encoding='utf-8')

        start_time = time.time()

        cmd = [
            './.venv/bin/python3', 'main.py',
            '--file', str(input_file),
            '--intent', case['intent'],
            '--post-credit', args.mode,
            '--human-gate', 'approve',
            '--autonomous',
        ]
        if not args.no_fast:
            cmd.append('--fast')

        env = os.environ.copy()
        env['LLM_PROVIDER'] = args.provider

        proc = subprocess.run(cmd, capture_output=True, text=True, env=env)
        duration = time.time() - start_time

        input_file.unlink(missing_ok=True)
        success = proc.returncode == 0
        if success:
            success_count += 1

        output_dir = Path('data/output')
        generated_files = []
        if output_dir.exists():
            for p in output_dir.iterdir():
                if p.is_file() and p.stat().st_mtime >= start_time:
                    generated_files.append(p.name)

        with open(checkpoint_file, 'a', encoding='utf-8') as f:
            f.write(f"### Case: {case['name']}\n")
            f.write(f"- Intent: `{case['intent']}`\n")
            f.write(f"- Status: {'SUCCESS' if success else 'FAILED'}\n")
            f.write(f"- Duration: {duration:.2f}s\n")
            f.write('- Generated Files:\n')
            for gf in generated_files:
                f.write(f'  - `{gf}`\n')
            f.write('\n```text\n')
            f.write((proc.stdout or '')[-1500:])
            f.write('\n```\n\n')
            if not success:
                f.write('```text\n')
                f.write((proc.stderr or '')[-1500:])
                f.write('\n```\n\n')

    summary = f'UAT summary: {success_count}/{len(cases)} passed.'
    with open(checkpoint_file, 'a', encoding='utf-8') as f:
        f.write('## Summary\n')
        f.write(summary + '\n')

    latest_link = checkpoint_dir / 'LATEST_CHECKPOINT.md'
    if latest_link.exists() or latest_link.is_symlink():
        latest_link.unlink()
    latest_link.symlink_to(checkpoint_file.name)

    print(summary)
    print(f'UAT completed. Results: {checkpoint_file}')
    raise SystemExit(0 if success_count == len(cases) else 1)


if __name__ == '__main__':
    run_uat()
