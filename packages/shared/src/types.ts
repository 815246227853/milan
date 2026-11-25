export type FunctionName = 'engagement' | 'haldi' | 'mehendi' | 'sangeet' | 'wedding' | 'reception';
export type VendorStatus = 'not_contacted' | 'quoted' | 'confirmed' | 'needs_follow_up';
export type JobStatus = 'planning' | 'calling' | 'comparing' | 'needs_you' | 'done';
export type CallStatus = 'queued' | 'ringing' | 'live' | 'done' | 'no_answer' | 'stopped';

export interface Vendor { id: string; name: string; category: string; phone: string; area?: string; language: string; status: VendorStatus; }
export interface TranscriptLine { speaker: 'milan' | 'vendor'; text: string; english?: string; }
export interface Call { id: string; jobId: string; vendorId: string; language: string; status: CallStatus; transcript: TranscriptLine[]; }
export interface Quote { vendorId: string; pricePerUnit?: number; unit?: string; dateAvailable?: boolean; includes?: string; advance?: string; notes?: string; }
export interface Decision { id: string; jobId: string; title: string; whatChanged: string; costBefore?: number; costAfter?: number; budget?: number; rule?: string; status: 'open' | 'approved' | 'declined'; }
