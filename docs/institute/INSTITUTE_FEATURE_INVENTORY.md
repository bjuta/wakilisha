# WAKILISHA Institute Feature Inventory

Status: PR0 baseline
Date: 2026-07-11

This inventory records the current Institute architecture and the intended treatment of each part. It is a migration map, not a promise that every existing feature survives.

## Navigation and surfaces

| Current surface | Current route or owner | Decision | Destination |
|---|---|---|---|
| All inquiries | inquiry interface, `screen=home` | Keep | Inquiries |
| Workbench | inquiry interface, `screen=workbench` | Collapse | Inquiry Overview |
| Question Clinic | inquiry interface, `screen=clinic` | Collapse | Question on Overview |
| Anchor Brief | inquiry interface, `screen=anchorBrief` | Collapse | Overview and Material |
| Evidence | inquiry interface, `screen=evidence` | Keep function, rename | Material |
| Evidence Reader | Evidence screen panel | Collapse | Contextual Material action |
| Claims | inquiry interface, `screen=claims` | Replace | Notes and findings |
| Relationships | inquiry interface, `screen=relationships` | Remove as room | Contextual connection actions |
| Review | inquiry interface, `screen=review` | Keep and simplify | Review |
| How This Learned | inquiry interface, `screen=learned` | Collapse | History |
| Inquiry Summary | disabled placeholder | Do not build as room | Inquiry Overview |
| Lineage and Forks | disabled placeholder and open plan | Do not build as planned | Lightweight inquiry links |
| Contributor Memory | disabled placeholder | Do not build as room | Material type and public intake |
| Corrections | disabled placeholder | Do not build as room | Correction cases attached to affected work or record |
| Public Preview | disabled placeholder | Remove at inquiry level | Work-product preview |
| Learning Board | disabled system placeholder | Remove | No direct replacement until proven need |
| AI Readiness | disabled system placeholder | Remove | Internal operational monitoring only if required |

## Core tables and records

| Current object | Decision | Notes |
|---|---|---|
| `institute_inquiries` | Keep | Central record. Visible lifecycle will be simplified later. |
| `institute_question_versions` | Keep | Preserves original and revised questions. |
| `institute_inquiry_anchors` | Keep, simplify use | Optional subject connection, not a required setup stage. |
| `institute_anchor_context_snapshots` | Keep during transition | Stop storing generic procedural advice as apparent knowledge. |
| `institute_workbench_setup` | Deprecate most fields | Stop collecting outputs, formats, tools, timers and preview depth. Keep compatibility until writes are removed. |
| `institute_evidence_items` | Keep during transition | Present as Material. Separate interpretation and findings from capture. |
| `institute_assistant_runs` | Keep | Backend audit and cost trace. Never a primary user surface. |
| `institute_assistant_suggestions` | Keep | Human-reviewed candidates only. |
| `institute_events` | Keep | Becomes the basis of History. |
| `institute_relationships` | Keep | Structured cultural graph. Remove separate mapping room. |
| `institute_review_packets` | Keep temporarily | Replace product-specific snapshots with a universal review manifest later. |
| `institute_work_product_links` | Keep | Becomes the common link between Inquiry and Work. |
| `wk_playlists` and `wk_playlist_items` | Keep | Playlist is a work product, not an evidence-format queue destination. |
| article drafts | Keep | Article is a work product. |

## Services and components

| Current code area | Decision | Migration note |
|---|---|---|
| `NativeInstituteInquiryInterface.tsx` | Replace incrementally | Build the new Inquiry shell first. Do not mechanically split the old monolith before product simplification. |
| `inquiryService.ts` | Keep behind adapters | Stop exposing setup complexity before changing storage. |
| `ClinicScreen.tsx` | Retire | Reuse question version actions inline. |
| `EvidenceReaderPanel.tsx` | Retire as panel | Reuse extraction help contextually per Material item. |
| `InstituteClaimsWorkspace.tsx` | Retire after findings migration | Existing claim-shaped rows require audited backfill. |
| `RelationshipsScreen.tsx` | Retire | Keep relationship service functions behind contextual actions. |
| `HowThisLearnedScreen.tsx` | Retire as route | Reuse timeline logic in History. |
| `InquiryAssistantPanel.tsx` | Retire as general panel | Place help beside the action it assists. |
| `instituteReviewDeskService.ts` | Keep, then centralise transitions | Packet and live-work status changes should become atomic server-side operations. |
| article bridge | Keep | Adapt to universal Work contract. |
| playlist bridge | Keep | Adapt to universal Work contract. |
| record workspace | Keep capability, simplify placement | Record updates are Work. |

## Assistant jobs

| Job | Decision | User-facing replacement |
|---|---|---|
| Question Clinic | Keep capability | Help me sharpen this question |
| Next Step Recommender | Keep capability | What should I check next? |
| Evidence Reader | Keep capability | Summarise or inspect this material |
| Relationship Mapper | Keep capability only where useful | Suggest possible connections from selected material |
| Any planned summary, lineage, corrections or readiness job | Freeze | No new job until the simplified human flow proves a need |

## Open pull requests affected by the contract

| PR | Decision |
|---|---|
| #349 Lineage and Forks schema plan | Close without implementation. Replace later with lightweight inquiry links. |
| #364 Playlist format completion state | Close. It improves a format queue scheduled for removal. |

## Data-loss prohibitions

During the simplification programme:

- do not delete question versions
- do not delete assistant runs or reviewed suggestions
- do not delete evidence or claim-shim rows after backfill
- do not hard-delete relationships because a screen is removed
- do not discard review snapshots before a universal manifest is verified
- do not move evidence between inquiries by deleting originals
- do not drop setup columns until production writes have stopped and data has been exported

## Required baseline samples

Before runtime refactoring begins, identify and preserve sample inquiries covering:

1. a basic question with no anchor
2. a question with multiple versions
3. an inquiry with reviewed material
4. an inquiry with accepted and rejected assistant suggestions
5. an inquiry with relationships
6. an inquiry linked to an article
7. an inquiry linked to a playlist
8. an inquiry with review packets and status changes

These samples become the parity fixtures for the new Inquiry shell.
