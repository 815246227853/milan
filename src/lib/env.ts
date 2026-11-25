/** Server config. Every integration is optional so the app runs end to end with no keys. */

const list = (v: string | undefined): string[] =>
  (v ?? '')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean)

export const env = {
  bolnaApiKey: process.env.BOLNA_API_KEY ?? '',
  bolnaAgentVendor: process.env.BOLNA_AGENT_VENDOR ?? '',
  bolnaFromNumber: process.env.BOLNA_FROM_NUMBER ?? '',
  demoPhoneNumbers: list(process.env.DEMO_PHONE_NUMBERS),
  placesApiKey: process.env.GOOGLE_PLACES_API_KEY ?? '',
  openaiApiKey: process.env.OPENAI_API_KEY ?? '',
  openaiModel: process.env.OPENAI_MODEL || 'gpt-4.1-mini',
  flagsmithKey: process.env.FLAGSMITH_ENVIRONMENT_KEY ?? '',
}

/** Real phone calls need both a Bolna key and the vendor agent id; otherwise calls are simulated. */
export const callsAreSimulated = (): boolean => !env.bolnaApiKey || !env.bolnaAgentVendor
