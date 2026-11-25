// Sarvam powers the voice of every call: speech-to-text for the vendor,
// text-to-speech for Milan, and translation of transcripts for the family.
// TODO: confirm endpoint paths, model names and audio formats in Sarvam's API docs before wiring this up.

const SARVAM_KEY = process.env.SARVAM_API_KEY!;

export interface SarvamClient {
  /** Vendor audio (from the phone line) → text in the call language. */
  speechToText(audio: Buffer, languageCode: string): Promise<string>;
  /** Milan's reply text → speech audio to play on the call. */
  textToSpeech(text: string, languageCode: string): Promise<Buffer>;
  /** Transcript line → English, for the family's view. */
  translateToEnglish(text: string, sourceLanguageCode: string): Promise<string>;
}

export function createSarvamClient(): SarvamClient {
  if (!SARVAM_KEY) throw new Error('SARVAM_API_KEY is missing');
  return {
    async speechToText() { throw new Error('TODO: call Sarvam speech-to-text'); },
    async textToSpeech() { throw new Error('TODO: call Sarvam text-to-speech'); },
    async translateToEnglish() { throw new Error('TODO: call Sarvam translation'); },
  };
}
