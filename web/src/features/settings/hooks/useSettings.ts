'use client'

import { useState, useCallback } from 'react'
import { updateProfile } from '../actions/updateProfile'
import { updateCompany } from '../actions/updateCompany'
import { updateNotifications } from '../actions/updateNotifications'
import type {
  SettingsData,
  UpdateProfileInput,
  UpdateCompanyInput,
  UpdateNotificationsInput,
} from '../types'

interface UseSettingsReturn {
  settings: SettingsData
  isLoading: boolean
  error: string | null
  updateProfileData: (input: UpdateProfileInput) => Promise<boolean>
  updateCompanyData: (input: UpdateCompanyInput) => Promise<boolean>
  updateNotificationSettings: (input: UpdateNotificationsInput) => Promise<boolean>
}

export function useSettings(initialSettings: SettingsData): UseSettingsReturn {
  const [settings, setSettings] = useState(initialSettings)
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const updateProfileData = useCallback(async (input: UpdateProfileInput): Promise<boolean> => {
    setIsLoading(true)
    setError(null)

    const result = await updateProfile(input)

    if (result.error) {
      setError(result.error)
      setIsLoading(false)
      return false
    }

    // Optimistically update local state
    setSettings((prev) => ({
      ...prev,
      profile: {
        ...prev.profile,
        fullName: input.fullName ?? prev.profile.fullName,
        phoneNumber: input.phoneNumber ?? prev.profile.phoneNumber,
        avatarUrl: input.avatarUrl ?? prev.profile.avatarUrl,
      },
    }))

    setIsLoading(false)
    return true
  }, [])

  const updateCompanyData = useCallback(async (input: UpdateCompanyInput): Promise<boolean> => {
    setIsLoading(true)
    setError(null)

    const result = await updateCompany(input)

    if (result.error) {
      setError(result.error)
      setIsLoading(false)
      return false
    }

    // Optimistically update local state
    setSettings((prev) => ({
      ...prev,
      company: {
        ...prev.company,
        name: input.name ?? prev.company.name,
        settings: {
          ...prev.company.settings,
          timezone: input.timezone ?? prev.company.settings.timezone,
        },
      },
    }))

    setIsLoading(false)
    return true
  }, [])

  const updateNotificationSettings = useCallback(
    async (input: UpdateNotificationsInput): Promise<boolean> => {
      setIsLoading(true)
      setError(null)

      const result = await updateNotifications(input)

      if (result.error) {
        setError(result.error)
        setIsLoading(false)
        return false
      }

      // Optimistically update local state
      setSettings((prev) => ({
        ...prev,
        company: {
          ...prev.company,
          settings: {
            ...prev.company.settings,
            notifications: {
              emailEnabled:
                input.emailEnabled ??
                prev.company.settings.notifications?.emailEnabled ??
                true,
              smsEnabled:
                input.smsEnabled ??
                prev.company.settings.notifications?.smsEnabled ??
                true,
              callReminders:
                input.callReminders ??
                prev.company.settings.notifications?.callReminders ??
                true,
              dailyDigest:
                input.dailyDigest ??
                prev.company.settings.notifications?.dailyDigest ??
                false,
            },
          },
        },
      }))

      setIsLoading(false)
      return true
    },
    []
  )

  return {
    settings,
    isLoading,
    error,
    updateProfileData,
    updateCompanyData,
    updateNotificationSettings,
  }
}
