# AI Agents

This project contains all AI agent configurations for the Outreach System.

## Structure

```
ai-agents/
├── agents/                    # Individual agent folders
│   ├── sales-coach/          # Real-time coaching for reps
│   │   ├── prompt.md         # Agent prompt/instructions
│   │   └── config.json       # Agent configuration
│   ├── outbound-caller/      # AI voice agent for calls
│   │   ├── prompt.md
│   │   └── config.json
│   └── [new-agent]/          # Add new agents here
├── shared/                    # Shared resources
│   ├── prompts/              # Reusable prompt templates
│   └── evaluation/           # Test cases and evaluation scripts
├── scripts/                   # Deployment and utility scripts
└── docs/                      # Documentation
```

## Adding a New Agent

1. Create a new folder in `agents/` with your agent name
2. Add `prompt.md` with the agent instructions
3. Add `config.json` with the configuration
4. Test locally before deploying to Retell AI

## Agent Types

- **voice_agent**: Retell AI voice agents that make/receive calls
- **assistant**: Text-based assistants (coaching, analysis, etc.)
- **workflow**: Multi-step automation agents

## Deployment

Agents can be deployed to Retell AI using:
- The Retell AI MCP server (recommended)
- Direct API calls via scripts
- Manual copy/paste to Retell dashboard

## Configuration Options

### config.json fields

| Field | Description |
|-------|-------------|
| `name` | Human-readable agent name |
| `version` | Semantic version |
| `type` | Agent type (voice_agent, assistant, workflow) |
| `llm.model` | LLM model to use |
| `llm.temperature` | Creativity (0-1, lower = more focused) |
| `voice` | Voice settings for voice agents |
| `retell_config` | Retell AI specific settings |
