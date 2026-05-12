"""
test_connection.py — Phase 0 verification script

Run this FIRST before anything else:
    python test_connection.py

What it checks:
  1. Can Python find your .env file and read the settings?
  2. Is LM Studio server running on your Mac?
  3. Does the model respond to a basic prompt?
  4. Is the model fast enough? (prints response time)

If this passes, you're ready for Phase 1.
"""

import time
import sys
from rich.console import Console
from rich.panel import Panel
from rich.table import Table

console = Console()


def run_checks():
    console.print(Panel.fit(
        "[bold cyan]SF Agentic AI — Phase 0 Connection Test[/bold cyan]",
        border_style="cyan"
    ))

    # ── Check 1: Settings loaded ─────────────────────────────────────────────
    console.print("\n[bold]Check 1:[/bold] Loading settings from .env...")
    try:
        from config import settings
        table = Table(show_header=False, box=None)
        table.add_row("[dim]LM Studio URL[/dim]", f"[green]{settings.base_url}[/green]")
        table.add_row("[dim]Model[/dim]", f"[green]{settings.model}[/green]")
        table.add_row("[dim]Temperature[/dim]", f"[green]{settings.temperature}[/green]")
        table.add_row("[dim]Max tokens[/dim]", f"[green]{settings.max_tokens}[/green]")
        console.print(table)
        console.print("[green]✓ Settings loaded[/green]")
    except Exception as e:
        console.print(f"[red]✗ Could not load settings: {e}[/red]")
        console.print("\n[yellow]Fix:[/yellow] Copy .env.example to .env and fill in your model name")
        console.print("  Run: [bold]cp .env.example .env[/bold]")
        sys.exit(1)

    # ── Check 2: LM Studio server reachable ──────────────────────────────────
    console.print("\n[bold]Check 2:[/bold] Connecting to LM Studio server...")
    try:
        import httpx
        response = httpx.get(f"{settings.base_url.replace('/v1', '')}/v1/models", timeout=5)
        if response.status_code == 200:
            models = response.json().get("data", [])
            if models:
                console.print(f"[green]✓ LM Studio is running. Models available:[/green]")
                for m in models:
                    console.print(f"   • {m.get('id', 'unknown')}")
            else:
                console.print("[yellow]⚠ LM Studio is running but no model is loaded.[/yellow]")
                console.print("  Open LM Studio → load your model → click Start Server")
        else:
            raise Exception(f"HTTP {response.status_code}")
    except httpx.ConnectError:
        console.print("[red]✗ Cannot reach LM Studio server[/red]")
        console.print("\n[yellow]Fix:[/yellow] Open LM Studio and click [bold]'Start Server'[/bold] (green button)")
        console.print("  Default address: http://localhost:1234")
        sys.exit(1)
    except Exception as e:
        console.print(f"[red]✗ LM Studio check failed: {e}[/red]")
        sys.exit(1)

    # ── Check 3: Model responds ───────────────────────────────────────────────
    console.print("\n[bold]Check 3:[/bold] Sending test prompt to model...")
    try:
        from config import raw_client
        start = time.time()
        response = raw_client.chat.completions.create(
            model=settings.model,
            messages=[
                {
                    "role": "system",
                    "content": "You are a structured finance AI assistant for Techcombank."
                },
                {
                    "role": "user",
                    "content": "In one sentence, what is a DSCR covenant?"
                }
            ],
            max_tokens=100,
            temperature=0,
        )
        elapsed = time.time() - start
        reply = response.choices[0].message.content.strip()
        tokens_used = response.usage.total_tokens if response.usage else "unknown"

        console.print(f"[green]✓ Model responded in {elapsed:.1f}s ({tokens_used} tokens)[/green]")
        console.print(f"\n[dim]Model said:[/dim]")
        console.print(Panel(reply, border_style="dim"))
    except Exception as e:
        console.print(f"[red]✗ Model did not respond: {e}[/red]")
        console.print("\n[yellow]Fix:[/yellow] Check that the model name in .env matches exactly")
        console.print("  what appears in LM Studio → My Models")
        sys.exit(1)

    # ── Check 4: Response speed estimate ─────────────────────────────────────
    console.print("\n[bold]Check 4:[/bold] Speed check...")
    if elapsed < 3:
        console.print(f"[green]✓ Fast ({elapsed:.1f}s) — good for agent pipelines[/green]")
    elif elapsed < 10:
        console.print(f"[yellow]⚠ Moderate ({elapsed:.1f}s) — usable, will be slower on long memos[/yellow]")
    else:
        console.print(f"[red]⚠ Slow ({elapsed:.1f}s) — consider a smaller model (e.g. 4B vs 8B)[/red]")

    # ── All clear ─────────────────────────────────────────────────────────────
    console.print(Panel.fit(
        "[bold green]All checks passed. You're ready for Phase 1.[/bold green]\n"
        "[dim]Next: Run [bold]python main.py[/bold] once Phase 1 is built[/dim]",
        border_style="green"
    ))


if __name__ == "__main__":
    run_checks()
