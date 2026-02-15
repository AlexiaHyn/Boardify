# Modal Setup Guide for Boardify Backend

> **Windows Users:** Use `python -m modal` instead of `modal` for all commands throughout this guide.

## Overview

This backend uses [Modal](https://modal.com) for serverless AI-powered card game generation. Modal provides:

- **Serverless Python functions** - Run expensive AI operations on-demand without managing infrastructure
- **GPU/CPU scaling** - Automatically scales based on load
- **Sandboxed execution** - Validate generated games safely
- **Secret management** - Secure API key handling

## What Modal Does in Boardify

The backend includes a Modal app (`app/services/modal_app.py`) that:

1. **Research game rules** - Uses Perplexity Sonar API to fetch comprehensive card game rules
2. **Generate game JSON** - Uses Claude to create game definition files from rules
3. **Generate plugins** - Uses Claude to create Python plugin files for game-specific logic
4. **Validate games** - Runs sandboxed validation to ensure JSON is correct and playable

---

## Prerequisites

- Python 3.11+ installed
- Modal account (free tier available)
- Anthropic API key (for Claude)
- Perplexity API key (for Sonar research)

---

## Setup Instructions

### 1. Install Modal

**If using a virtual environment (recommended):**

```bash
# Navigate to your project root
cd game-engine

# Activate your virtual environment first
source .venv/Scripts/activate  # Windows Git Bash
# OR
.venv\Scripts\activate  # Windows CMD
# OR
source .venv/bin/activate  # Unix/Mac

# Install Modal in the venv
pip install modal

# Or install all backend dependencies at once
cd backend
pip install -r requirements.txt
```

**If NOT using a virtual environment:**

```bash
pip install modal

# Or install all dependencies:
cd game-engine/backend
pip install -r requirements.txt
```

**Windows Note:** On Windows, Modal commands need to be run with `python -m modal` instead of just `modal`.

**Important:** Modal must be installed in the same Python environment you use to run the backend. If you get "No module named modal" errors, make sure your virtual environment is activated.

### 2. Authenticate with Modal

Run the Modal setup command to authenticate:

**Unix/Mac:**
```bash
modal setup
```

**Windows:**
```bash
python -m modal setup
```

This will:
- Open a browser window to log in to Modal
- Create a Modal token on your machine (~/.modal.toml or %USERPROFILE%\.modal.toml on Windows)
- Connect your local environment to Modal's infrastructure

### 3. Configure Environment Variables

Create a `.env` file in the backend directory:

```bash
cd game-engine/backend
cp .env.example .env
```

Edit `.env` and add your API keys:

```env
ANTHROPIC_API_KEY=sk-ant-xxxxx
PERPLEXITY_API_KEY=pplx-xxxxx
```

**Get API Keys:**
- **Anthropic API**: https://console.anthropic.com/
- **Perplexity API**: https://www.perplexity.ai/settings/api

### 4. Deploy the Modal App

Deploy the Modal functions to Modal's cloud:

**Unix/Mac:**
```bash
modal deploy app/services/modal_app.py
```

**Windows:**
```bash
python -m modal deploy app/services/modal_app.py
```

This will:
- Package your Modal functions
- Upload them to Modal's infrastructure
- Return deployment URLs for each function
- Make the functions callable from your local FastAPI server

**Expected output:**
```
✓ Created objects.
├── 🔨 Created mount PythonPackage:...
├── 🔨 Created modal.Image: ...
└── 🔨 Created function boardify-game-generator.research_game_rules
    Created function boardify-game-generator.generate_game_json
    Created function boardify-game-generator.generate_game_plugin
    Created function boardify-game-generator.validate_in_sandbox

✓ App deployed! 🎉
```

---

## Using Modal Functions

### From Python Code

The Modal functions are exposed as regular Python functions that you can call from your FastAPI app:

```python
from app.services.modal_app import (
    research_game_rules,
    generate_game_json,
    generate_game_plugin,
    validate_in_sandbox,
)

# Research game rules
rules = research_game_rules.remote(game_name="Crazy Eights")

# Generate game JSON
game_json = generate_game_json.remote(
    game_name="Crazy Eights",
    rules_text=rules,
    error_feedback="",
)

# Validate the JSON
validation = validate_in_sandbox.remote(game_json)

# Generate plugin
plugin_code = generate_game_plugin.remote(
    game_name="Crazy Eights",
    game_id="crazy_eights",
    game_json_str=game_json,
    rules_text=rules,
)
```

The `.remote()` suffix tells Modal to run the function on Modal's infrastructure instead of locally.

### From the API

The backend includes a game generator service that uses these Modal functions. Check `app/services/game_generator.py` for the integration.

---

## Running Locally vs Modal

### Local Development (FastAPI)

Run the FastAPI server locally:

```bash
# From the backend directory
uvicorn app.main:app --reload --port 8000
```

This runs the game engine API on `http://localhost:8000`.

The FastAPI server can call Modal functions remotely - you don't need to run Modal locally.

### Modal Functions

Modal functions run on Modal's infrastructure when you call `.remote()`:

- **Automatic scaling** - Modal spins up containers on-demand
- **No server management** - Modal handles infrastructure
- **Pay per use** - Only charged when functions run

### Testing Modal Functions

Test a Modal function directly:

```bash
# Run a function in the Modal cloud
modal run app/services/modal_app.py::research_game_rules --game-name "UNO"
```

---

## Architecture Diagram

```
┌─────────────────────────────────────────────────────────────┐
│                         Frontend                            │
│                   (Next.js + WebSocket)                     │
└───────────────────────────┬─────────────────────────────────┘
                            │
                            │ HTTP/WebSocket
                            │
┌───────────────────────────▼─────────────────────────────────┐
│                    FastAPI Backend                          │
│                   (Local or Deployed)                       │
│                                                             │
│  ┌─────────────────┐         ┌────────────────────┐       │
│  │  Game Engine    │         │  Room Manager      │       │
│  │  (Universal)    │◄───────►│  (WebSockets)      │       │
│  └─────────────────┘         └────────────────────┘       │
│           │                                                 │
│           │ Calls Modal functions via .remote()            │
│           ▼                                                 │
│  ┌─────────────────┐                                       │
│  │ Game Generator  │                                       │
│  └────────┬────────┘                                       │
└───────────┼──────────────────────────────────────────────────┘
            │
            │ .remote() calls
            │
┌───────────▼──────────────────────────────────────────────────┐
│                    Modal Cloud                               │
│  ┌─────────────────────────────────────────────────────┐   │
│  │  research_game_rules()                              │   │
│  │    ├─ Perplexity Sonar API                          │   │
│  │    └─ Returns comprehensive rules                   │   │
│  └─────────────────────────────────────────────────────┘   │
│  ┌─────────────────────────────────────────────────────┐   │
│  │  generate_game_json()                               │   │
│  │    ├─ Claude API (Sonnet 4)                         │   │
│  │    └─ Returns game JSON definition                  │   │
│  └─────────────────────────────────────────────────────┘   │
│  ┌─────────────────────────────────────────────────────┐   │
│  │  generate_game_plugin()                             │   │
│  │    ├─ Claude API (Sonnet 4)                         │   │
│  │    └─ Returns Python plugin code                    │   │
│  └─────────────────────────────────────────────────────┘   │
│  ┌─────────────────────────────────────────────────────┐   │
│  │  validate_in_sandbox()                              │   │
│  │    ├─ JSON schema validation                        │   │
│  │    └─ Safe game simulation                          │   │
│  └─────────────────────────────────────────────────────┘   │
└──────────────────────────────────────────────────────────────┘
```

---

## Modal App Structure

### `modal_app.py` Functions

| Function | Purpose | API Used | Timeout |
|----------|---------|----------|---------|
| `research_game_rules()` | Fetch game rules from web | Perplexity Sonar | 60s |
| `generate_game_json()` | Create game JSON definition | Claude Sonnet 4 | 180s |
| `generate_game_plugin()` | Create Python plugin file | Claude Sonnet 4 | 180s |
| `validate_in_sandbox()` | Validate JSON structure | Pure Python | 120s |

### Environment Variables

Modal functions access environment variables via the `.env` file:

```python
@app.function(
    secrets=[modal.Secret.from_dotenv(path=str(_backend_root / ".env"))],
)
def my_function():
    import os
    api_key = os.environ["ANTHROPIC_API_KEY"]  # ✅ Loaded from .env
```

---

## Troubleshooting

### "No module named 'modal'"

**Solution:** Install Modal:
```bash
pip install modal
```

### "Not authenticated with Modal"

**Solution:** Run authentication:
```bash
modal setup
```

### "Secret not found" errors

**Solution:** Ensure `.env` file exists and contains required keys:
```bash
ls -la .env  # Should exist
cat .env     # Should contain ANTHROPIC_API_KEY and PERPLEXITY_API_KEY
```

### "Function not found" when calling `.remote()`

**Solution:** Deploy the Modal app:
```bash
modal deploy app/services/modal_app.py
```

### API rate limits

Both Anthropic and Perplexity have rate limits:
- **Anthropic**: Depends on tier (free tier is limited)
- **Perplexity**: Check your plan limits

**Solution:** Implement exponential backoff or upgrade API tier.

---

## Cost Considerations

### Modal Pricing

- **Free tier**: $30/month in credits (enough for development)
- **Pro tier**: Pay per compute time
- **Enterprise**: Custom pricing

**Typical costs for this app:**
- Game generation: ~5-10 seconds of compute time
- Validation: ~1-2 seconds of compute time
- Modal free tier should cover hundreds of game generations per month

### API Costs

- **Anthropic Claude Sonnet 4**: ~$3 per million input tokens, ~$15 per million output tokens
- **Perplexity Sonar**: ~$5 per 1000 searches (on paid plans)

**Cost per game generation**: ~$0.05-0.15 depending on complexity

---

## Advanced Usage

### Running Modal Functions Locally (for debugging)

You can run Modal functions locally without deploying:

```bash
# Run locally (not on Modal infrastructure)
modal run app/services/modal_app.py::research_game_rules --game-name "UNO"
```

### Viewing Modal Logs

Check logs in the Modal dashboard:
```bash
modal app logs boardify-game-generator
```

Or view in browser: https://modal.com/apps

### Custom Modal Configuration

Modify the Modal image to add dependencies:

```python
image = (
    modal.Image.debian_slim(python_version="3.11")
    .pip_install("anthropic", "httpx", "pydantic>=2.0.0")
    .pip_install("your-custom-package")  # Add custom packages
)
```

---

## Next Steps

1. ✅ **Setup Modal** - `modal setup`
2. ✅ **Configure `.env`** - Add API keys
3. ✅ **Deploy Modal app** - `modal deploy app/services/modal_app.py`
4. ✅ **Run FastAPI** - `uvicorn app.main:app --reload`
5. 🎮 **Generate games** - Use the game generator API

---

## Resources

- **Modal Documentation**: https://modal.com/docs
- **Anthropic API**: https://docs.anthropic.com
- **Perplexity API**: https://docs.perplexity.ai
- **FastAPI**: https://fastapi.tiangolo.com

---

## Support

For issues specific to:
- **Modal setup**: Check Modal docs or contact Modal support
- **Game generation**: Check Claude API status and logs
- **Backend API**: Check FastAPI logs and error messages

**Game generation workflow is optional** - the backend works fine without Modal if you only use pre-defined games (UNO, Exploding Kittens, etc.). Modal is only needed if you want AI-powered game generation.
