import json
import subprocess
from time import sleep, perf_counter
from config import raw_client, settings, get_agent_limits
from workflow.state import DealState

class BaseAgent:
    name: str = "base"
    system_prompt: str = "You are a helpful assistant."

    def _call_hermes_infer(self, system: str, user_message: str, timeout_sec: int) -> str:
        prompt = (
            f"[SYSTEM]\n{system}\n\n"
            f"[USER]\n{user_message}\n\n"
            "Return only the direct answer content for this request."
        )
        cmd = [
            "hermes",
            "infer",
            "model",
            "run",
            "--local",
            "--model",
            settings.model,
            "--prompt",
            prompt,
            "--json",
        ]

        proc = subprocess.run(
            cmd,
            capture_output=True,
            text=True,
            timeout=max(5, timeout_sec + 15),
            check=False,
        )

        merged = "\n".join(x for x in [proc.stdout, proc.stderr] if x).strip()
        if proc.returncode != 0:
            return f"ERROR: hermes infer failed (exit={proc.returncode}): {merged[:400]}"

        start = merged.find("{")
        end = merged.rfind("}")
        if start < 0 or end <= start:
            return f"ERROR: hermes infer returned non-JSON output: {merged[:400]}"

        try:
            payload = json.loads(merged[start:end + 1])
        except Exception as e:
            return f"ERROR: hermes infer JSON parse failed: {e}"

        if not payload.get("ok"):
            return f"ERROR: hermes infer returned error: {payload.get('error', payload)}"

        outputs = payload.get("outputs") or []
        if not outputs:
            return "ERROR: hermes infer returned no outputs"

        text = str((outputs[0] or {}).get("text", "")).strip()
        return text or "ERROR: hermes infer output text is empty"

    def call_llm(self, user_message: str, system_override: str = None) -> str:
        system = system_override or self.system_prompt
        messages = [{"role":"system","content":system},{"role":"user","content":user_message}]
        timeout_sec, max_tokens = get_agent_limits(self.name)
        for attempt in range(2):
            start = perf_counter()
            try:
                print(
                    f"[{self.name}] LLM call start "
                    f"(attempt={attempt + 1}, timeout={timeout_sec}s, max_tokens={max_tokens})"
                )
                if settings.llm_provider == "hermes":
                    c = self._call_hermes_infer(system, user_message, timeout_sec=timeout_sec)
                else:
                    r = raw_client.chat.completions.create(
                        model=settings.model,
                        messages=messages,
                        max_tokens=max_tokens,
                        temperature=settings.temperature,
                        timeout=timeout_sec,
                    )
                    c = (r.choices[0].message.content or "").strip()
                if str(c).startswith("ERROR:"):
                    raise RuntimeError(c)
                duration = perf_counter() - start
                print(f"[{self.name}] LLM call end (duration={duration:.2f}s)")
                return c
            except Exception as e:
                msg = str(e)
                duration = perf_counter() - start
                print(f"[{self.name}] LLM call failed (duration={duration:.2f}s): {e}")
                if "Model unloaded" in msg and attempt == 0:
                    sleep(1)
                    continue
                return f"ERROR: {e}"
        return "ERROR: unknown"

    def run(self, state: DealState) -> dict:
        raise NotImplementedError
