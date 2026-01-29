# RBsoft SMS Gateway - Potential Tool Research

**Status:** Under Consideration
**Cost:** $79 one-time purchase
**Purchase Link:** [CodeCanyon - RBsoft SMS Gateway](https://codecanyon.net/item/sms-gateway/21419519)

---

## What Is It?

RBsoft SMS Gateway turns an Android phone into an SMS/MMS gateway for your applications. Instead of paying per-message fees through Twilio, messages are sent through the phone's SIM card at your carrier's rate (often unlimited).

---

## How It Works

```
Your System                          RBsoft Server                    Phone
───────────                          ──────────────                   ─────

[server.js] ───HTTP POST──→ [RBsoft Web Panel] ←── persistent ──→ [Android App]
                            (self-hosted)          connection          │
                                                                       ↓
                                                                  [SIM Card]
                                                                       │
                                                                       ↓
                                                                  [Recipient]
```

1. Your server sends SMS request to RBsoft API (hosted on your server)
2. RBsoft queues the message
3. Android app (on phone) picks up the message
4. Phone sends SMS through its SIM card
5. Status updates flow back via webhooks

**No VPN required** - phone just needs internet access (WiFi or cellular data).

---

## Key Benefits

| Benefit | Description |
|---------|-------------|
| **Cost Savings** | One-time $79 vs Twilio's ~$0.0079/SMS. With unlimited carrier plan, SMS becomes essentially free |
| **No A2P Registration** | Skip the lengthy A2P 10DLC registration process |
| **No Per-Message Fees** | Only pay your carrier's rate |
| **Self-Hosted** | Full control of your data |
| **Full API** | REST API for all operations |
| **White-Label** | Customize the Android app with your branding |

---

## Complete Feature List

### Core Messaging
- Bulk SMS/MMS sending
- CSV/Excel import with personalization (merge fields)
- Scheduled messages
- Delivery reports/tracking
- Auto-retry failed messages
- MMS with image attachments

### Auto-Responder
- Keyword-triggered auto-replies
- Multiple responses per keyword
- Webhook scripts for dynamic responses

### Contacts Management
- Contact lists/groups
- Unsubscribe handling ("STOP" keyword)
- Blacklist management
- API for contact management

### Multi-Device Support
- Connect multiple Android phones
- Load balancing across devices
- Per-SIM quotas (rate limiting)
- Shared devices between users

### Call Log (View Only)
- View incoming/outgoing call history in web panel
- Per-SIM filtering
- **Note:** Does NOT support making/receiving calls through browser

### USSD Support
- Send USSD codes (check balances, activate plans)
- Scheduled USSD requests
- Webhook for USSD responses

### SaaS Features (If Reselling)
- Multi-tenant user accounts
- Subscription plans with limits
- Payment gateways (Stripe, PayPal, Razorpay, Crypto)
- White-label Android app

### Integrations
- REST API (full documentation)
- Webhooks for events
- Email-to-SMS forwarding
- Third-party gateway fallback (Twilio, etc.)

---

## Implementation Requirements

### Server Requirements
- PHP web hosting (shared hosting/cPanel works)
- MySQL database
- Domain/subdomain for web panel

### Phone Requirements
- Android 8.0+
- Active SIM card with SMS capability
- Internet connection (WiFi or data)
- Phone must stay powered and connected

### Integration Effort
- **Estimated code changes:** ~100-150 lines in `server.js`
- **What changes:** Replace Twilio API calls with RBsoft API calls
- **Frontend:** No changes needed (already calls backend API)

---

## Comparison: RBsoft vs Current Twilio Setup

| Factor | Twilio (Current) | RBsoft |
|--------|------------------|--------|
| **Cost Model** | Per-message (~$0.0079) | One-time $79 + carrier rate |
| **Reliability** | 99.9%+ SLA | Depends on phone uptime |
| **Speed** | Instant | 1-5 second delay |
| **Scale** | Unlimited | Limited by carrier throttling |
| **A2P Registration** | Required | Not required |
| **Setup** | Already done | New setup needed |
| **Voice Calls** | Supported | Not supported |

---

## Potential Use Cases for Our Platform

1. **Bulk Marketing SMS** - Send promotional messages at lower cost
2. **Follow-up Sequences** - Automated follow-ups without per-message fees
3. **Appointment Reminders** - High-volume reminders
4. **Hybrid Approach** - RBsoft for bulk, Twilio for time-critical

---

## Considerations & Risks

| Risk | Mitigation |
|------|------------|
| Phone goes offline | Keep phone plugged in, use multiple devices |
| Carrier throttling | Use multiple SIMs, respect rate limits |
| Message delays | Use Twilio fallback for urgent messages |
| No voice support | Keep Twilio for voice calls |

---

## Similar Services (For Reference)

- **myCRMSIM** - Same concept, pre-built for GoHighLevel ($97/mo subscription)
- **SMS-SERVER** - Open-source DIY option on GitHub

---

## Next Steps (If Proceeding)

1. Purchase from CodeCanyon ($79)
2. Set up web panel on hosting
3. Download/configure Android app
4. Add RBsoft service to `server.js` (~100-150 lines)
5. Test with low volume
6. Consider hybrid approach (RBsoft + Twilio fallback)

---

## Resources

- [Official Site](https://rbsoft.org/downloads/sms-gateway/)
- [API Documentation](https://smsgateway.rbsoft.org/docs/api)
- [Installation Guide](https://smsgateway.rbsoft.org/docs/installation.htm)
- [Android App Setup](https://smsgateway.rbsoft.org/docs/setting_up_the_android_application.htm)
- [Support Hub](https://rbsoft.support-hub.io/)

---

*Research Date: January 2026*
