import type { InquiryLabState } from "./types";

export const seedInquiry: InquiryLabState = {
  inquiryId: "Inquiry 0005",
  title: "What makes a good cultural inquiry interface for WAKILISHA?",
  question: "What makes a good cultural inquiry interface for WAKILISHA?",
  maturityState: "Ready for Inquiry",
  lifecycleState: "Framing",
  linkedEntity: {
    type: "Artist",
    name: "Mejja",
    slug: "mejja",
  },
  questionVersions: [
    {
      id: "qv-1",
      label: "Starting Question",
      question: "What makes a good cultural inquiry interface for WAKILISHA?",
      reason: "The first lab should test whether the method helps people make better judgments.",
    },
  ],
  evidence: [
    {
      id: "ev-1",
      title: "WK docs reading order",
      format: "Text",
      summary: "The Books place the question before evidence, memory, relationships, review, and Current Understanding.",
      source: "WK docs",
      investmentTime: "Fifteen minutes",
      strengthensUnderstanding: true,
      publicSafe: false,
    },
    {
      id: "ev-2",
      title: "V8 workflow prototype",
      format: "Text",
      summary: "V8 is useful as workflow reference, but production should copy the system before copying the UI.",
      source: "WAKILISHA Institute V8",
      investmentTime: "Five minutes",
      strengthensUnderstanding: true,
      publicSafe: false,
    },
  ],
  claims: [
    {
      id: "claim-1",
      text: "A useful Institute surface should show the state of the question before asking for fields.",
      evidenceId: "ev-1",
      confidence: 82,
      uncertainty: "We still need to test whether this helps a reviewer think faster without flattening judgment.",
    },
  ],
  relationships: [
    {
      id: "rel-1",
      from: "Inquiry 0005",
      to: "Mejja artist profile",
      reason: "Artist pages are where public context may later appear. The lab must prove attachment before public display.",
      evidenceId: "ev-2",
      confidence: 74,
    },
  ],
  memories: [
    {
      id: "mem-1",
      format: "Text",
      about: "Contributor entry point",
      memory: "A contributor should be able to add a memory or correction in plain language.",
      howTheyKnow: "This is a direct rule from the Institute product contract.",
      consent: "Internal",
    },
  ],
  corrections: [
    {
      id: "cor-1",
      correction: "Do not start PR1 from public routes or automated suggestions.",
      whyItMatters: "That would skip the human workflow we are trying to prove.",
      proposedBy: "Institute product contract",
      status: "Open",
    },
  ],
  currentUnderstanding: {
    safeToSay: "The Institute should begin as a protected lab that proves the human inquiry workflow.",
    cannotSayYet: "We cannot say the permanent model is right until the working surface is tested.",
    openDoubt: "Does this interface help people think more clearly, or does it only organize fields neatly?",
    confidence: 78,
  },
  reviews: [
    {
      id: "review-1",
      decision: "Needs More Work",
      reason: "The method is clear enough to prototype, but permanent schema and public release are not approved yet.",
    },
  ],
  events: [
    { id: "event-1", text: "Inquiry 0005 opened as the first self-testing lab Inquiry." },
    { id: "event-2", text: "V8 accepted as workflow reference, not production UI." },
  ],
};
