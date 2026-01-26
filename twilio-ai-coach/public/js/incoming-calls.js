// Incoming Calls Handler - Shared across all pages
// This file handles Twilio Device registration and incoming call UI

(function() {
  let twilioDevice = null;
  let pendingIncomingCall = null;
  let ringtoneAudio = null;
  const repIdentity = 'sales-rep';

  // Create and inject the incoming call modal if it doesn't exist
  function createIncomingCallModal() {
    if (document.getElementById('incomingCallModal')) return;

    const modalHTML = `
      <div class="incoming-call-overlay" id="incomingCallModal">
        <div class="incoming-call-modal">
          <div class="incoming-call-icon">
            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" />
            </svg>
          </div>
          <div class="incoming-call-label">Incoming Call</div>
          <div class="incoming-call-number" id="incomingCallNumber">Unknown</div>
          <div class="incoming-call-actions">
            <div class="incoming-call-btn-wrapper">
              <button class="incoming-call-btn decline" id="declineCallBtn" title="Decline">
                <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
              <span class="incoming-call-btn-label">Decline</span>
            </div>
            <div class="incoming-call-btn-wrapper">
              <button class="incoming-call-btn answer" id="answerCallBtn" title="Answer">
                <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" />
                </svg>
              </button>
              <span class="incoming-call-btn-label">Answer</span>
            </div>
          </div>
        </div>
      </div>
    `;

    // Inject styles if not already present
    if (!document.getElementById('incomingCallStyles')) {
      const styles = document.createElement('style');
      styles.id = 'incomingCallStyles';
      styles.textContent = `
        .incoming-call-overlay{position:fixed;top:0;left:0;right:0;bottom:0;background:rgba(0,0,0,0.7);display:flex;align-items:center;justify-content:center;z-index:10000;opacity:0;visibility:hidden;transition:all 0.3s ease;}
        .incoming-call-overlay.active{opacity:1;visibility:visible;}
        .incoming-call-modal{background:white;border-radius:16px;padding:24px;text-align:center;max-width:320px;width:90%;box-shadow:0 20px 60px rgba(0,0,0,0.3);transform:scale(0.9);transition:transform 0.3s ease;}
        .incoming-call-overlay.active .incoming-call-modal{transform:scale(1);}
        .incoming-call-icon{width:80px;height:80px;background:linear-gradient(135deg,#10b981 0%,#059669 100%);border-radius:50%;display:flex;align-items:center;justify-content:center;margin:0 auto 16px;animation:ring-pulse 1.5s ease-in-out infinite;}
        .incoming-call-icon svg{width:40px;height:40px;color:white;animation:ring-shake 0.5s ease-in-out infinite;}
        @keyframes ring-pulse{0%,100%{box-shadow:0 0 0 0 rgba(16,185,129,0.4);}50%{box-shadow:0 0 0 20px rgba(16,185,129,0);}}
        @keyframes ring-shake{0%,100%{transform:rotate(-10deg);}50%{transform:rotate(10deg);}}
        .incoming-call-label{font-size:0.875rem;color:#6b7280;text-transform:uppercase;letter-spacing:1px;margin-bottom:4px;}
        .incoming-call-number{font-size:1.5rem;font-weight:600;color:#111827;margin-bottom:16px;}
        .incoming-call-actions{display:flex;gap:16px;justify-content:center;}
        .incoming-call-btn{width:70px;height:70px;border-radius:50%;border:none;cursor:pointer;display:flex;align-items:center;justify-content:center;transition:all 0.2s ease;}
        .incoming-call-btn svg{width:28px;height:28px;color:white;}
        .incoming-call-btn.answer{background:linear-gradient(135deg,#10b981 0%,#059669 100%);}
        .incoming-call-btn.answer:hover{transform:scale(1.1);box-shadow:0 8px 20px rgba(16,185,129,0.4);}
        .incoming-call-btn.decline{background:linear-gradient(135deg,#ef4444 0%,#dc2626 100%);}
        .incoming-call-btn.decline:hover{transform:scale(1.1);box-shadow:0 8px 20px rgba(239,68,68,0.4);}
        .incoming-call-btn-label{font-size:0.75rem;color:#4b5563;margin-top:4px;}
        .incoming-call-btn-wrapper{display:flex;flex-direction:column;align-items:center;}
      `;
      document.head.appendChild(styles);
    }

    // Add modal to body
    const div = document.createElement('div');
    div.innerHTML = modalHTML;
    document.body.appendChild(div.firstElementChild);

    // Add event listeners
    document.getElementById('answerCallBtn').addEventListener('click', answerIncomingCall);
    document.getElementById('declineCallBtn').addEventListener('click', declineIncomingCall);
  }

  function playRingtone() {
    if (ringtoneAudio) return;
    try {
      const audioContext = new (window.AudioContext || window.webkitAudioContext)();
      const oscillator = audioContext.createOscillator();
      const gainNode = audioContext.createGain();
      oscillator.connect(gainNode);
      gainNode.connect(audioContext.destination);
      oscillator.frequency.value = 440;
      oscillator.type = 'sine';
      gainNode.gain.value = 0.3;
      oscillator.start();
      let ringOn = true;
      const ringInterval = setInterval(() => {
        gainNode.gain.value = ringOn ? 0.3 : 0;
        ringOn = !ringOn;
      }, 500);
      ringtoneAudio = { oscillator, gainNode, audioContext, ringInterval };
    } catch (e) {
      console.error('Error playing ringtone:', e);
    }
  }

  function stopRingtone() {
    if (ringtoneAudio) {
      try {
        clearInterval(ringtoneAudio.ringInterval);
        ringtoneAudio.oscillator.stop();
        ringtoneAudio.audioContext.close();
      } catch (e) {}
      ringtoneAudio = null;
    }
  }

  function showIncomingCallModal(from) {
    createIncomingCallModal();
    const modal = document.getElementById('incomingCallModal');
    const callerDisplay = document.getElementById('incomingCallNumber');
    if (modal && callerDisplay) {
      callerDisplay.textContent = from || 'Unknown Caller';
      modal.classList.add('active');
      playRingtone();
    }
  }

  function hideIncomingCallModal() {
    const modal = document.getElementById('incomingCallModal');
    if (modal) modal.classList.remove('active');
    stopRingtone();
  }

  function showActiveCallIndicator() {
    let indicator = document.getElementById('activeCallIndicator');
    if (!indicator) {
      indicator = document.createElement('div');
      indicator.id = 'activeCallIndicator';
      indicator.style.cssText = 'position:fixed;top:20px;right:20px;background:#10b981;color:white;padding:12px 20px;border-radius:8px;z-index:10001;display:flex;align-items:center;gap:10px;box-shadow:0 4px 12px rgba(0,0,0,0.2);';
      indicator.innerHTML = '<span style="width:10px;height:10px;background:white;border-radius:50%;animation:pulse 1s infinite;"></span> Call Active <button onclick="window.endActiveCall()" style="margin-left:10px;background:#ef4444;border:none;color:white;padding:6px 12px;border-radius:4px;cursor:pointer;">End Call</button>';
      document.body.appendChild(indicator);
    }
    indicator.style.display = 'flex';
  }

  function endActiveCall() {
    if (pendingIncomingCall) {
      pendingIncomingCall.disconnect();
      pendingIncomingCall = null;
    }
    const indicator = document.getElementById('activeCallIndicator');
    if (indicator) indicator.style.display = 'none';
  }

  function answerIncomingCall() {
    if (pendingIncomingCall) {
      console.log('Answering incoming call...');
      pendingIncomingCall.accept();
      hideIncomingCallModal();
      showActiveCallIndicator();
    }
  }

  function declineIncomingCall() {
    if (pendingIncomingCall) {
      pendingIncomingCall.reject();
      pendingIncomingCall = null;
      hideIncomingCallModal();
    }
  }

  function handleIncomingCall(call) {
    console.log('Incoming call received:', call.parameters.From);
    pendingIncomingCall = call;

    call.on('cancel', () => {
      console.log('Call cancelled');
      hideIncomingCallModal();
      endActiveCall();
    });

    call.on('disconnect', () => {
      console.log('Call disconnected');
      hideIncomingCallModal();
      endActiveCall();
    });

    showIncomingCallModal(call.parameters.From);
  }

  async function initTwilioDevice() {
    // Check if Twilio SDK is loaded
    if (typeof Twilio === 'undefined') {
      console.log('Twilio SDK not loaded, skipping incoming call setup');
      return;
    }

    try {
      console.log('Initializing Twilio device for incoming calls...');
      const response = await fetch(`/token?identity=${repIdentity}`);
      const data = await response.json();

      if (!data.token) {
        console.error('No token received');
        return;
      }

      twilioDevice = new Twilio.Device(data.token, {
        codecPreferences: ['opus', 'pcmu'],
        logLevel: 1
      });

      twilioDevice.on('registered', () => {
        console.log('Twilio Device registered for incoming calls');
      });

      twilioDevice.on('unregistered', () => {
        console.log('Twilio Device unregistered');
      });

      twilioDevice.on('error', (error) => {
        console.error('Twilio Device error:', error.message || error);
      });

      twilioDevice.on('incoming', handleIncomingCall);

      console.log('Registering Twilio device...');
      await twilioDevice.register();
      console.log('Twilio Device registration complete');

    } catch (error) {
      console.error('Error initializing Twilio Device:', error);
    }
  }

  // Expose functions globally
  window.endActiveCall = endActiveCall;
  window.declineIncomingCall = declineIncomingCall;

  // Handle Escape key
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && pendingIncomingCall) {
      declineIncomingCall();
    }
  });

  // Initialize on DOM ready
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initTwilioDevice);
  } else {
    initTwilioDevice();
  }
})();
