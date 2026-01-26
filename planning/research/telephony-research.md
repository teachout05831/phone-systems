# Telephony & Call Transcription Research

## Overview
Research on VoIP providers with APIs for call recording, transcription, and live features for the rep accountability system.

---

## Top Recommendations

### 1. Dialpad - Best for Live Transcription
Real-time transcription built into ALL plans (no add-on). WebSocket support for live frontend updates. $15/user/month. Best path to seeing transcripts appear live in your dashboard.

### 2. RingCentral - Enterprise-Grade with Extension Filtering
Strong API for pulling calls by extension/line. Can filter cold calling lines separately from other business lines. RingSense API for post-call AI insights. Better for larger teams with complex needs.

### 3. Twilio - Maximum Flexibility (Developer-Heavy)
Build exactly what you want with Media Streams (WebSocket audio). Real-time transcription via `<Transcription>` TwiML. Pay-as-you-go pricing. Best if you want live audio playback in your app.

---

## Detailed Provider Breakdown

### Dialpad - RECOMMENDED
**Type:** AI-Native Business Phone System

**Features:**
- Real-time transcription built into ALL plans
- Sentiment analysis & suggested actions
- WebSocket API for live frontend updates
- Call summaries, action items, key moments
- Webhook events for call lifecycle

**Limitations:**
- No raw audio streaming to your app

**Pricing:** $15-25/user/month

**Links:**
- [Developer Portal](https://www.dialpad.com/developers/)
- [Call Events](https://developers.dialpad.com/docs/call-events)
- [Transcript API](https://developers.dialpad.com/reference/transcriptsget)

---

### RingCentral
**Type:** Enterprise Communications Platform

**Features:**
- Audio Streaming API for live audio
- RingSense API for post-call AI insights
- Filter calls by extension/line number
- Comprehensive call log API
- CRM integrations built-in

**Limitations:**
- Live transcription requires manual setup
- Higher tier plans needed for full features

**Pricing:** $20-45/user/month (varies by tier)

**Links:**
- [API Products](https://developers.ringcentral.com/api-products)
- [RingSense API](https://developers.ringcentral.com/ringsense-api)
- [Speech-to-Text](https://developers.ringcentral.com/guide/ai/speech-to-text)

**Multi-Line / Extension Filtering:**
You CAN filter calls by extension/line. If you have different lines for cold calling vs support:
- `/account/~/extension/{extensionId}/call-log` - Get calls for a specific extension
- `?extensionNumber=104` - Filter account-level logs by extension number
- `view=Detailed` - See which extension handled each call leg

**Example:** If cold calling is on extension 101 and support is on 102, you can pull only extension 101 calls for rep tracking.

---

### Twilio
**Type:** Programmable Communications API

**Features:**
- Media Streams for real-time WebSocket audio
- Bidirectional audio (listen AND play)
- `<Transcription>` TwiML for live transcription
- Full control - build exactly what you need
- Pay-as-you-go pricing

**Limitations:**
- Requires significant development work
- Need external transcription service for best results

**Pricing:** ~$0.014/min outbound, $0.0085/min inbound + extras

**Links:**
- [Media Streams](https://www.twilio.com/docs/voice/media-streams)
- [Transcription TwiML](https://www.twilio.com/docs/voice/twiml/transcription)
- [Real-Time API](https://www.twilio.com/docs/voice/api/realtime-transcription-resource)

---

### Aircall
**Type:** Call Center Phone System

**Features:**
- 200+ native CRM integrations
- Good webhook events for call lifecycle
- 6+ months call recording storage
- Multi-language transcription (6 languages)

**Limitations:**
- Transcription requires AI add-on ($$$)
- Post-call only - no real-time
- 3-user minimum, $30+/user

**Pricing:** $30+/user/month (3-user minimum)

**Links:**
- [Developer Portal](https://developer.aircall.io/)
- [Webhooks Guide](https://developer.aircall.io/tutorials/webhooks-guide/)

---

## Feature Comparison Matrix

| Feature | Dialpad | RingCentral | Twilio | Aircall |
|---------|---------|-------------|--------|---------|
| Real-Time Transcription | Built-in | Manual setup | Build your own | Post-call only |
| Live Audio Streaming | Via webhooks | Audio Streaming API | Media Streams | Not available |
| Filter by Line/Extension | Yes | Excellent | Build your own | Via tags/users |
| AI Sentiment Analysis | Included | RingSense | Add external | Paid add-on |
| API Quality | Good | Excellent | Excellent | Good |
| Ease of Integration | Easy | Medium | Complex | Easy |
| Starting Price | $15/user/mo | $20/user/mo | Pay-per-use | $30/user/mo |

---

## Live Listening + Transcript Vision

For seeing transcripts appear in real-time AND potentially hearing the call live:

### Option 1: Dialpad (Easiest)
Subscribe to real-time events, transcripts stream in as call happens. No raw audio, but live text appears.

### Option 2: Twilio Custom (Most Powerful)
Use `<Stream>` for bidirectional WebSocket audio. Pipe to your app for playback AND to transcription service for live text.

### Option 3: RingCentral
Stream live audio to your server via Audio Streaming API, then forward to Google/Watson for live transcription.

---

## Standalone Transcription Services

If you need to add transcription to any audio source:

| Service | Type | Best For | Notes |
|---------|------|----------|-------|
| **Deepgram** | Real-Time Speech API | Real-time | Fast, accurate, WebSocket streaming, pay-per-minute |
| **AssemblyAI** | AI Transcription + Analysis | AI Features | Transcription plus sentiment, topics, entity detection |
| **OpenAI Whisper** | Open Source / API | Self-host | Very accurate, multi-language, better for batch than real-time |
| **Google Speech-to-Text** | Enterprise Grade | Enterprise | 125+ languages, speaker diarization, integrates with RingCentral |

---

## Conversation Intelligence Platforms

All-in-one platforms for call recording, transcription, and AI coaching:

| Platform | Type | Pricing | Notes |
|----------|------|---------|-------|
| **Gong** | Revenue Intelligence | ~$5,000/year base + $1,400/user/year | Market leader, enterprise pricing |
| **Chorus (ZoomInfo)** | Conversation Intelligence | Mid-market | 50-60% cheaper than Gong |
| **Fireflies.ai** | Meeting Transcription | Free tier available | Budget friendly, basic features |
| **Avoma** | Meeting Lifecycle | Contact | End-to-end meeting automation |

---

## Research Notes & Next Steps

1. **Dialpad** offers the fastest path to live transcription with minimal development
2. **RingCentral** is best if you need robust extension/line filtering for multiple business purposes
3. **Twilio** gives maximum flexibility but requires significant development work
4. Consider starting with **Dialpad for MVP**, then evaluate Twilio for custom features later
5. For conversation intelligence (AI coaching), evaluate Gong/Chorus only if budget allows ($5K+/year)
6. **Deepgram** or **AssemblyAI** can add transcription to any audio source if needed

---

*Last Updated: January 2026*
