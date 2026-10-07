import { capabilityMessages } from './capability'
import { commonMessages } from './common'
import { adminMessages } from './admin'
import { desktopMessages } from './desktop'
import { extractionMessages } from './extraction'
import { coverageMessages } from './coverage'
import { landingDetailMessages } from './landingDetails'
import { landingExperienceMessages } from './landingExperience'
import { legalMessages } from './legal'
import { radioMessages } from './radio'
import { websiteMessages } from './website'
import { workspaceMessages } from './workspace'
import { parityMessages } from './parity'
import { delightMessages } from './delight'
import { quietMessages } from './quiet'
import { productHomeMessages } from './productHome'
import { productDetailsMessages } from './productDetails'
import type { MessageCatalog } from '../types'

export const messages = {
  ...productHomeMessages,
  ...productDetailsMessages,
  ...capabilityMessages,
  ...commonMessages,
  ...adminMessages,
  ...desktopMessages,
  ...extractionMessages,
  ...coverageMessages,
  ...landingDetailMessages,
  ...landingExperienceMessages,
  ...legalMessages,
  ...websiteMessages,
  ...workspaceMessages,
  ...parityMessages,
  ...delightMessages,
  ...quietMessages,
  ...radioMessages,
} satisfies MessageCatalog

export type MessageKey = keyof typeof messages
