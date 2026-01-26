'use client';

import { ReactNode } from 'react';
import { TwilioProvider } from './twilio-provider';
import { IncomingCallModal } from './incoming-call-modal';

interface CallProviderWrapperProps {
  children: ReactNode;
}

export function CallProviderWrapper({ children }: CallProviderWrapperProps) {
  return (
    <TwilioProvider>
      {children}
      <IncomingCallModal />
    </TwilioProvider>
  );
}
