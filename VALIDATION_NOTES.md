# CogniPulse README Redesign: Validation Notes

## Source of facts

The uploaded `README__3_.md` contained the master prompt, not the old README. The new README was therefore written from the verified facts in that prompt. No application source files, Docker setup or live API were inspected, and nothing was run.

## Duplicate content removed

- Overview, Problem and Solution merged into one **Overview**.
- Key Features and Frontend Experience merged into one **Core Features** section.
- Architecture, Request Lifecycle and Async Processing merged into one **Architecture** section (two short vertical diagrams plus one responsibilities table).
- Web Scraping and Structured AI Extraction merged into **Technical Implementation**.
- Technology Stack and Technical Skills merged into one eight-row matrix.
- LangGraph, Celery and Redis are each explained once; API behaviour is documented only in **API Reference**.
- Result: 482 lines, inside the 450-550 target.

## API corrections applied

- Endpoint table limited to `GET /`, `POST /api/v1/run-agent` and `GET /api/v1/task-status/{task_id}`.
- POST response documented as **HTTP 202** with `status`, `message`, `task_id` and `check_status_endpoint` (no invented `status_url`).
- Status response documented as the wrapper `task_id`, `state`, `ready`, `successful`, `result`, with the inner result fields.
- Celery `state` and application `result.status` explained as two separate levels.
- All example values are labelled illustrative.

## Docker and setup corrections applied

- `env_file: - .env` documented for **both** the backend and the worker service.
- Container Redis URL kept as `redis://redis:6379/0`, with a warning not to use `localhost` in containers.
- Backend Dockerfile default `api_main:app` documented as outdated; Compose overrides it with `uvicorn agent_graphs:app --host 0.0.0.0 --port 8800`.
- Frontend `output: 'standalone'` documented as consistent with its Dockerfile.
- Dashboard API URL documented as a hardcoded default (`http://127.0.0.1:8800/`) plus manual configuration; `NEXT_PUBLIC_API_BASE_URL` is explicitly **not** claimed to be read by the active page.
- Local commands use the exact Uvicorn, Celery (`-P solo`) and `npm` commands from the brief.
- The Compose change is shown only as a labelled fragment; `docker-compose.yml` itself was not modified.

## Files created

- `README.md`
- `assets/cognipulse-hero.svg` (1200 x 340, native SMIL animation)
- `assets/cognipulse-footer.svg` (1000 x 180, native SMIL animation)
- `VALIDATION_NOTES.md` (this file; delete it before committing if you do not want it in the repository)

The SVGs contain no JavaScript, no external CSS and no external resources. The animated pipeline headline (Search, Retrieve, Analyze, Structure, Intelligence) lives inside the hero SVG, so no third-party typing-animation service is used.

## Checks performed

All checks were static or local-render checks only:

- Both SVGs parsed as well-formed XML and were rendered in headless Chromium for a visual check.
- All three Mermaid diagrams rendered successfully with the Mermaid library in headless Chromium (no syntax errors).
- Code fences are balanced, all in-page anchors match a heading, and both asset paths exist.
- No standalone React badge or React skill entry; React appears only in package names and one factual footnote.

**Not performed:** Docker build or run, backend or Celery execution, frontend build, API calls, tests. Shields.io badges and logos were not verified offline.

## Items to confirm before publishing

1. Replace `<your-repo-url>` and `[Your Name]` (no name, URL or profile was invented).
2. The `.env` example assumes `TAVILY_API_KEYS` and `OPENROUTER_API_KEYS` accept comma-separated lists. Confirm the format in your backend code.
3. The Compose fragment names the worker service `worker`; use your actual service name.
4. The agent diagram sends both conditional error paths to a failed END state. Confirm the exact edge targets in `agent_graphs.py`.
5. File-role comments in the project tree, and the `backend/requirements.txt` location, are inferred from file names and the Dockerfile description.
6. The Redis URL variable name was not provided, so it is not named in the README.

## Limitations that remain (documented in the README)

Best-effort retrieval, no persistent database, no authentication, no source citations, no per-node telemetry, HTTP polling instead of WebSockets, unverified LLM output, required Docker `env_file` fix, CORS hardening, and no tests, CI/CD or production observability.
