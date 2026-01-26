'use client'

import { ReactNode } from 'react'
import { QAOverlay } from '@/features/qa/components/QAOverlay'

interface QAProviderWrapperProps {
  children?: ReactNode
}

export function QAProviderWrapper({ children }: QAProviderWrapperProps) {
  const isQAEnabled =
    process.env.NEXT_PUBLIC_QA_ENABLED === 'true' ||
    process.env.NODE_ENV === 'development'

  return (
    <>
      {children}
      {isQAEnabled && <QAOverlay />}
    </>
  )
}
