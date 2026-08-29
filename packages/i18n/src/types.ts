export type UiLocale = 'en' | 'ar'

export type MessagePair = Readonly<{
  en: string
  ar: string
}>

export type MessageCatalog = Readonly<Record<string, MessagePair>>

export type MessageValues = Readonly<Record<string, string | number>>
