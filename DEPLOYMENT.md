# Deployment Guide

This document covers deploying the Outreach System to production.

## Architecture Overview

```
┌─────────────────────────────────────────────────────┐
│                     SUPABASE                        │
│              (PostgreSQL Database)                  │
│   contacts, calls, ai_queue, users, companies...   │
└─────────────────────────────────────────────────────┘
          ▲                           ▲
          │                           │
          │ reads/writes              │ reads/writes
          │                           │
┌─────────────────┐         ┌─────────────────────────┐
│    RAILWAY      │         │        VERCEL           │
│  Express Server │         │    Next.js App          │
│  (live calls)   │         │  (dashboard, contacts)  │
└─────────────────┘         └─────────────────────────┘
          ▲                           ▲
          │                           │
     Twilio calls              User's browser
```

| Service | What It Hosts | Folder | Cost |
|---------|--------------|--------|------|
| **Vercel** | Next.js app (dashboard, contacts, SMS, etc.) | `web/` | Free tier |
| **Railway** | Express server (Twilio calls, Deepgram, AI coaching) | `twilio-ai-coach/` | ~$5/month |
| **Supabase** | PostgreSQL database + Auth | N/A | Free tier |

---

## Prerequisites

1. GitHub repository with this code
2. Accounts on:
   - [Vercel](https://vercel.com)
   - [Railway](https://railway.app)
   - [Supabase](https://supabase.com) (already set up)
   - [Twilio](https://console.twilio.com)
   - [Deepgram](https://console.deepgram.com)
   - [Anthropic](https://console.anthropic.com)

---

## Step 1: Deploy to Vercel (Next.js App)

### 1.1 Connect Repository

1. Go to [vercel.com/new](https://vercel.com/new)
2. Import your GitHub repository
3. Set **Root Directory** to `web`
4. Framework Preset should auto-detect "Next.js"

### 1.2 Configure Environment Variables

Add these in Vercel Dashboard → Settings → Environment Variables:

| Variable | Description | Required |
|----------|-------------|----------|
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase project URL | Yes |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Supabase anonymous key | Yes |
| `SUPABASE_SERVICE_ROLE_KEY` | Supabase service role key | Yes |
| `TWILIO_ACCOUNT_SID` | Twilio Account SID | Yes |
| `TWILIO_AUTH_TOKEN` | Twilio Auth Token | Yes |
| `TWILIO_PHONE_NUMBER` | Your Twilio phone number | Yes |
| `TWILIO_TWIML_APP_SID` | Twilio TwiML App SID | Yes |
| `TWILIO_API_KEY_SID` | Twilio API Key SID | Yes |
| `TWILIO_API_KEY_SECRET` | Twilio API Key Secret | Yes |
| `DEEPGRAM_API_KEY` | Deepgram API key | Optional |
| `ANTHROPIC_API_KEY` | Anthropic API key | Yes |
| `OPENAI_API_KEY` | OpenAI API key | Optional |

### 1.3 Deploy

1. Click "Deploy"
2. Wait for build to complete
3. Note your URL: `https://your-app.vercel.app`

---

## Step 2: Deploy to Railway (Express Server)

### 2.1 Create New Project

1. Go to [railway.app/new](https://railway.app/new)
2. Select "Deploy from GitHub repo"
3. Choose your repository
4. Set **Root Directory** to `twilio-ai-coach`

### 2.2 Configure Environment Variables

Add these in Railway Dashboard → Variables:

| Variable | Description | Required |
|----------|-------------|----------|
| `SUPABASE_URL` | Supabase project URL | Yes |
| `SUPABASE_SERVICE_KEY` | Supabase service role key | Yes |
| `TWILIO_ACCOUNT_SID` | Twilio Account SID | Yes |
| `TWILIO_AUTH_TOKEN` | Twilio Auth Token | Yes |
| `TWILIO_PHONE_NUMBER` | Your Twilio phone number | Yes |
| `TWILIO_TWIML_APP_SID` | Twilio TwiML App SID | Yes |
| `TWILIO_API_KEY_SID` | Twilio API Key SID | Yes |
| `TWILIO_API_KEY_SECRET` | Twilio API Key Secret | Yes |
| `DEEPGRAM_API_KEY` | Deepgram API key | Yes |
| `ANTHROPIC_API_KEY` | Anthropic API key | Yes |
| `OPENAI_API_KEY` | OpenAI API key | Optional |
| `RETELL_API_KEY` | Retell AI API key | Optional |
| `RETELL_AGENT_ID` | Retell AI Agent ID | Optional |
| `PORT` | Server port (Railway sets this) | Auto |
| `COMPANY_NAME` | Your company name | Optional |
| `PRODUCT_NAME` | Your product name | Optional |
| `REP_NAME` | Default rep name | Optional |

### 2.3 Generate Domain

1. Go to Settings → Networking
2. Click "Generate Domain"
3. Note your URL: `https://your-app.railway.app`

### 2.4 Verify Health Check

Visit `https://your-app.railway.app/health` - should return:
```json
{
  "status": "healthy",
  "timestamp": "2026-01-23T...",
  "supabase": "connected",
  "activeCalls": 0
}
```

---

## Step 3: Configure Twilio Webhooks

### 3.1 Update TwiML App

1. Go to [Twilio Console → TwiML Apps](https://console.twilio.com/develop/voice/manage/twiml-apps)
2. Click your TwiML App
3. Update Voice URLs:
   - **Request URL**: `https://your-app.railway.app/voice-inbound`
   - **Status Callback URL**: `https://your-app.railway.app/voice-status`

### 3.2 Update Phone Number

1. Go to [Twilio Console → Phone Numbers](https://console.twilio.com/phone-numbers)
2. Click your phone number
3. Under "Voice & Fax":
   - **A Call Comes In**: Webhook → `https://your-app.railway.app/voice-inbound`
   - **Call Status Changes**: `https://your-app.railway.app/voice-status`

### 3.3 Configure SMS Webhooks (if using)

Under "Messaging":
- **A Message Comes In**: Webhook → `https://your-app.vercel.app/api/sms/webhook`

---

## Step 4: Verify Supabase Connections

### 4.1 Test from Vercel

1. Visit your Vercel app
2. Log in with Supabase Auth
3. Verify data loads on dashboard

### 4.2 Test from Railway

1. Visit `https://your-app.railway.app/health`
2. Confirm `"supabase": "connected"`
3. Make a test call to verify call logging works

---

## Troubleshooting

### Vercel Build Fails

1. Check build logs for errors
2. Ensure all environment variables are set
3. Verify `web/` folder structure is correct

### Railway Health Check Fails

1. Check deployment logs
2. Verify `PORT` environment variable is set (Railway auto-sets this)
3. Ensure `SUPABASE_URL` and `SUPABASE_SERVICE_KEY` are correct

### Supabase Connection Issues

1. Verify keys are for the correct project
2. Check RLS policies allow the operations
3. Ensure service role key is used for server-side operations

### Twilio Calls Not Working

1. Verify webhook URLs are correct
2. Check Railway logs for incoming webhook requests
3. Ensure Twilio credentials are correct
4. Verify phone number is configured correctly

### WebSocket Issues (Live Transcription)

1. Railway supports WebSockets by default
2. Check Deepgram API key is valid
3. Verify Media Streams are enabled in TwiML

---

## Environment Variable Reference

### Vercel (web/)

```bash
# Required
NEXT_PUBLIC_SUPABASE_URL=https://xxx.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJ...
SUPABASE_SERVICE_ROLE_KEY=eyJ...

# Twilio
TWILIO_ACCOUNT_SID=ACxxx
TWILIO_AUTH_TOKEN=xxx
TWILIO_PHONE_NUMBER=+1xxx
TWILIO_TWIML_APP_SID=APxxx
TWILIO_API_KEY_SID=SKxxx
TWILIO_API_KEY_SECRET=xxx

# AI
ANTHROPIC_API_KEY=sk-ant-xxx
OPENAI_API_KEY=sk-proj-xxx
DEEPGRAM_API_KEY=xxx
```

### Railway (twilio-ai-coach/)

```bash
# Required
SUPABASE_URL=https://xxx.supabase.co
SUPABASE_SERVICE_KEY=eyJ...

# Twilio
TWILIO_ACCOUNT_SID=ACxxx
TWILIO_AUTH_TOKEN=xxx
TWILIO_PHONE_NUMBER=+1xxx
TWILIO_TWIML_APP_SID=APxxx
TWILIO_API_KEY_SID=SKxxx
TWILIO_API_KEY_SECRET=xxx

# AI
DEEPGRAM_API_KEY=xxx
ANTHROPIC_API_KEY=sk-ant-xxx

# Optional
OPENAI_API_KEY=sk-proj-xxx
RETELL_API_KEY=key_xxx
RETELL_AGENT_ID=agent_xxx
COMPANY_NAME=Your Company
PRODUCT_NAME=Your Product
REP_NAME=Sales Rep
```

---

## Post-Deployment Checklist

- [ ] Vercel app loads and displays login
- [ ] Can authenticate with Supabase
- [ ] Dashboard loads data from Supabase
- [ ] Railway health check returns "healthy"
- [ ] Railway shows "supabase": "connected"
- [ ] Twilio webhooks are updated
- [ ] Test inbound call connects
- [ ] Test outbound call connects
- [ ] Live transcription works (if using advanced mode)
- [ ] AI coaching suggestions appear (if using advanced mode)
- [ ] SMS webhooks configured (if using SMS)
