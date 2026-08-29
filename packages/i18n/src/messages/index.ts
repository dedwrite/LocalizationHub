import { commonMessages } from './common'
import { adminMessages } from './admin'
import { desktopMessages } from './desktop'
import { extractionMessages } from './extraction'
import { coverageMessages } from './coverage'
import { landingDetailMessages } from './landingDetails'
import { legalMessages } from './legal'
import { radioMessages } from './radio'
import { websiteMessages } from './website'
import { workspaceMessages } from './workspace'
import type { MessageCatalog } from '../types'

export const messages = {
  ...commonMessages,
  ...adminMessages,
  ...desktopMessages,
  ...extractionMessages,
  ...coverageMessages,
  ...landingDetailMessages,
  ...legalMessages,
  ...websiteMessages,
  ...workspaceMessages,
  ...radioMessages,
} satisfies MessageCatalog

export type MessageKey = keyof typeof messages
