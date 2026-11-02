export interface Wk100ResearchIntakeAck {
  readonly weekStartEat: string;
  readonly observedDepth: number;
  readonly verified: true;
  readonly status: "research_only";
  readonly canScore: false;
  readonly canPublish: false;
}
export interface Wk100ResearchFiles {
  originalCsv: File | null;
  receiptFile: File | null;
  weekStartEat: string;
}
export declare function prepareWk100ResearchForm(files: Wk100ResearchFiles):
  Promise<{form: FormData; observedDepth: number}>;
export declare function submitWk100ResearchEvidence(files: Wk100ResearchFiles & {
  invoke: (name: string, options: {body: FormData}) => Promise<{
    data: unknown; error: unknown;
  }>;
}): Promise<Wk100ResearchIntakeAck>;
