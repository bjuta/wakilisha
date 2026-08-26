export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "14.17"
  }
  editorial: {
    Tables: {
      article_lifecycle_events: {
        Row: {
          action: string
          actor_id: string | null
          article_id: string
          created_at: string
          id: string
          metadata: Json
          note: string | null
          prior_status: string | null
          resource_id: string
          resulting_status: string | null
          version_id: string | null
        }
        Insert: {
          action: string
          actor_id?: string | null
          article_id: string
          created_at?: string
          id?: string
          metadata?: Json
          note?: string | null
          prior_status?: string | null
          resource_id: string
          resulting_status?: string | null
          version_id?: string | null
        }
        Update: {
          action?: string
          actor_id?: string | null
          article_id?: string
          created_at?: string
          id?: string
          metadata?: Json
          note?: string | null
          prior_status?: string | null
          resource_id?: string
          resulting_status?: string | null
          version_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "article_lifecycle_events_resource_id_fkey"
            columns: ["resource_id"]
            isOneToOne: false
            referencedRelation: "resources"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "article_lifecycle_events_version_id_fkey"
            columns: ["version_id"]
            isOneToOne: false
            referencedRelation: "article_versions"
            referencedColumns: ["id"]
          },
        ]
      }
      article_resources: {
        Row: {
          article_id: string
          resource_id: string
          resource_kind: string
        }
        Insert: {
          article_id: string
          resource_id: string
          resource_kind?: string
        }
        Update: {
          article_id?: string
          resource_id?: string
          resource_kind?: string
        }
        Relationships: [
          {
            foreignKeyName: "article_resources_resource_fkey"
            columns: ["resource_id", "resource_kind"]
            isOneToOne: false
            referencedRelation: "resources"
            referencedColumns: ["id", "resource_kind"]
          },
        ]
      }
      article_review_comments: {
        Row: {
          body_text: string
          created_at: string
          created_by: string | null
          deleted_at: string | null
          edited_at: string | null
          id: string
          thread_id: string
        }
        Insert: {
          body_text: string
          created_at?: string
          created_by?: string | null
          deleted_at?: string | null
          edited_at?: string | null
          id?: string
          thread_id: string
        }
        Update: {
          body_text?: string
          created_at?: string
          created_by?: string | null
          deleted_at?: string | null
          edited_at?: string | null
          id?: string
          thread_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "article_review_comments_thread_id_fkey"
            columns: ["thread_id"]
            isOneToOne: false
            referencedRelation: "article_review_threads"
            referencedColumns: ["id"]
          },
        ]
      }
      article_review_threads: {
        Row: {
          anchor_from: number | null
          anchor_kind: string
          anchor_prefix: string | null
          anchor_quote: string | null
          anchor_suffix: string | null
          anchor_to: number | null
          article_id: string
          created_at: string
          created_by: string | null
          id: string
          resolved_at: string | null
          resolved_by: string | null
          resource_id: string
          status: string
          target_field: string
          target_version_id: string
          thread_kind: string
          updated_at: string
        }
        Insert: {
          anchor_from?: number | null
          anchor_kind?: string
          anchor_prefix?: string | null
          anchor_quote?: string | null
          anchor_suffix?: string | null
          anchor_to?: number | null
          article_id: string
          created_at?: string
          created_by?: string | null
          id?: string
          resolved_at?: string | null
          resolved_by?: string | null
          resource_id: string
          status?: string
          target_field?: string
          target_version_id: string
          thread_kind: string
          updated_at?: string
        }
        Update: {
          anchor_from?: number | null
          anchor_kind?: string
          anchor_prefix?: string | null
          anchor_quote?: string | null
          anchor_suffix?: string | null
          anchor_to?: number | null
          article_id?: string
          created_at?: string
          created_by?: string | null
          id?: string
          resolved_at?: string | null
          resolved_by?: string | null
          resource_id?: string
          status?: string
          target_field?: string
          target_version_id?: string
          thread_kind?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "article_review_threads_resource_id_fkey"
            columns: ["resource_id"]
            isOneToOne: false
            referencedRelation: "resources"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "article_review_threads_target_version_id_fkey"
            columns: ["target_version_id"]
            isOneToOne: false
            referencedRelation: "article_versions"
            referencedColumns: ["id"]
          },
        ]
      }
      article_scheduled_publications: {
        Row: {
          article_id: string
          created_at: string
          created_by: string | null
          id: string
          note: string | null
          resource_id: string
          run_after: string
          status: string
          updated_at: string
          version_id: string
        }
        Insert: {
          article_id: string
          created_at?: string
          created_by?: string | null
          id?: string
          note?: string | null
          resource_id: string
          run_after: string
          status?: string
          updated_at?: string
          version_id: string
        }
        Update: {
          article_id?: string
          created_at?: string
          created_by?: string | null
          id?: string
          note?: string | null
          resource_id?: string
          run_after?: string
          status?: string
          updated_at?: string
          version_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "article_scheduled_publications_resource_id_fkey"
            columns: ["resource_id"]
            isOneToOne: false
            referencedRelation: "resources"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "article_scheduled_publications_version_id_fkey"
            columns: ["version_id"]
            isOneToOne: false
            referencedRelation: "article_versions"
            referencedColumns: ["id"]
          },
        ]
      }
      article_suggestion_events: {
        Row: {
          action: string
          actor_id: string | null
          applied_version_id: string | null
          created_at: string
          id: string
          note: string | null
          suggestion_id: string
        }
        Insert: {
          action: string
          actor_id?: string | null
          applied_version_id?: string | null
          created_at?: string
          id?: string
          note?: string | null
          suggestion_id: string
        }
        Update: {
          action?: string
          actor_id?: string | null
          applied_version_id?: string | null
          created_at?: string
          id?: string
          note?: string | null
          suggestion_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "article_suggestion_events_applied_version_id_fkey"
            columns: ["applied_version_id"]
            isOneToOne: false
            referencedRelation: "article_versions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "article_suggestion_events_suggestion_id_fkey"
            columns: ["suggestion_id"]
            isOneToOne: false
            referencedRelation: "article_suggestions"
            referencedColumns: ["id"]
          },
        ]
      }
      article_suggestions: {
        Row: {
          applied_version_id: string | null
          created_at: string
          decided_at: string | null
          decided_by: string | null
          decision_note: string | null
          id: string
          operation_kind: string
          original_text: string
          proposed_content_html: string
          replacement_text: string
          status: string
          target_version_fingerprint: string
          thread_id: string
          updated_at: string
        }
        Insert: {
          applied_version_id?: string | null
          created_at?: string
          decided_at?: string | null
          decided_by?: string | null
          decision_note?: string | null
          id?: string
          operation_kind: string
          original_text?: string
          proposed_content_html: string
          replacement_text?: string
          status?: string
          target_version_fingerprint: string
          thread_id: string
          updated_at?: string
        }
        Update: {
          applied_version_id?: string | null
          created_at?: string
          decided_at?: string | null
          decided_by?: string | null
          decision_note?: string | null
          id?: string
          operation_kind?: string
          original_text?: string
          proposed_content_html?: string
          replacement_text?: string
          status?: string
          target_version_fingerprint?: string
          thread_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "article_suggestions_applied_version_id_fkey"
            columns: ["applied_version_id"]
            isOneToOne: false
            referencedRelation: "article_versions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "article_suggestions_thread_id_fkey"
            columns: ["thread_id"]
            isOneToOne: true
            referencedRelation: "article_review_threads"
            referencedColumns: ["id"]
          },
        ]
      }
      article_taxonomy_terms: {
        Row: {
          created_at: string
          created_by: string | null
          resource_id: string
          taxonomy: string
          term_id: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          resource_id: string
          taxonomy: string
          term_id: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          resource_id?: string
          taxonomy?: string
          term_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "article_taxonomy_terms_resource_fkey"
            columns: ["resource_id"]
            isOneToOne: false
            referencedRelation: "resources"
            referencedColumns: ["id"]
          },
        ]
      }
      article_version_trust_revisions: {
        Row: {
          article_version_id: string
          citation_revision: number
          credit_revision: number
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          article_version_id: string
          citation_revision?: number
          credit_revision?: number
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          article_version_id?: string
          citation_revision?: number
          credit_revision?: number
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "article_version_trust_revisions_version_fkey"
            columns: ["article_version_id"]
            isOneToOne: true
            referencedRelation: "article_versions"
            referencedColumns: ["id"]
          },
        ]
      }
      article_versions: {
        Row: {
          article_id: string
          author_display: string | null
          category_snapshot: Json
          content_fingerprint: string
          content_html: string | null
          created_at: string
          created_by: string | null
          excerpt: string | null
          hero_image_id: string | null
          hero_image_url: string | null
          id: string
          lifecycle_state: string | null
          owner_id: string | null
          published_at: string | null
          resource_id: string
          seo: Json
          slug: string
          source_draft_version: number
          tag_snapshot: Json
          title: string | null
          version_kind: string
          version_number: number
          wp_status: string | null
        }
        Insert: {
          article_id: string
          author_display?: string | null
          category_snapshot?: Json
          content_fingerprint: string
          content_html?: string | null
          created_at?: string
          created_by?: string | null
          excerpt?: string | null
          hero_image_id?: string | null
          hero_image_url?: string | null
          id?: string
          lifecycle_state?: string | null
          owner_id?: string | null
          published_at?: string | null
          resource_id: string
          seo?: Json
          slug: string
          source_draft_version: number
          tag_snapshot?: Json
          title?: string | null
          version_kind: string
          version_number: number
          wp_status?: string | null
        }
        Update: {
          article_id?: string
          author_display?: string | null
          category_snapshot?: Json
          content_fingerprint?: string
          content_html?: string | null
          created_at?: string
          created_by?: string | null
          excerpt?: string | null
          hero_image_id?: string | null
          hero_image_url?: string | null
          id?: string
          lifecycle_state?: string | null
          owner_id?: string | null
          published_at?: string | null
          resource_id?: string
          seo?: Json
          slug?: string
          source_draft_version?: number
          tag_snapshot?: Json
          title?: string | null
          version_kind?: string
          version_number?: number
          wp_status?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "article_versions_resource_fkey"
            columns: ["resource_id"]
            isOneToOne: false
            referencedRelation: "resources"
            referencedColumns: ["id"]
          },
        ]
      }
      audio_episode_shared_links: {
        Row: {
          audio_publication_id: string
          created_at: string
          show_episode_resource_id: string
        }
        Insert: {
          audio_publication_id: string
          created_at?: string
          show_episode_resource_id: string
        }
        Update: {
          audio_publication_id?: string
          created_at?: string
          show_episode_resource_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "audio_episode_shared_links_show_episode_resource_id_fkey"
            columns: ["show_episode_resource_id"]
            isOneToOne: true
            referencedRelation: "show_episodes"
            referencedColumns: ["resource_id"]
          },
        ]
      }
      audio_publication_resources: {
        Row: {
          current_approved_version_id: string | null
          current_published_version_id: string | null
          current_submitted_version_id: string | null
          current_working_version_id: string | null
          publication_id: string
          resource_id: string
          resource_kind: string
        }
        Insert: {
          current_approved_version_id?: string | null
          current_published_version_id?: string | null
          current_submitted_version_id?: string | null
          current_working_version_id?: string | null
          publication_id: string
          resource_id: string
          resource_kind: string
        }
        Update: {
          current_approved_version_id?: string | null
          current_published_version_id?: string | null
          current_submitted_version_id?: string | null
          current_working_version_id?: string | null
          publication_id?: string
          resource_id?: string
          resource_kind?: string
        }
        Relationships: [
          {
            foreignKeyName: "audio_publication_resources_resource_fkey"
            columns: ["resource_id", "resource_kind"]
            isOneToOne: false
            referencedRelation: "resources"
            referencedColumns: ["id", "resource_kind"]
          },
        ]
      }
      audio_publication_version_trust_revisions: {
        Row: {
          citation_revision: number
          credit_revision: number
          publication_version_id: string
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          citation_revision?: number
          credit_revision?: number
          publication_version_id: string
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          citation_revision?: number
          credit_revision?: number
          publication_version_id?: string
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: []
      }
      audio_season_resources: {
        Row: {
          resource_id: string
          resource_kind: string
          season_id: string
        }
        Insert: {
          resource_id: string
          resource_kind?: string
          season_id: string
        }
        Update: {
          resource_id?: string
          resource_kind?: string
          season_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "audio_season_resources_resource_fkey"
            columns: ["resource_id", "resource_kind"]
            isOneToOne: false
            referencedRelation: "resources"
            referencedColumns: ["id", "resource_kind"]
          },
        ]
      }
      audio_show_resources: {
        Row: {
          resource_id: string
          resource_kind: string
          show_id: string
        }
        Insert: {
          resource_id: string
          resource_kind?: string
          show_id: string
        }
        Update: {
          resource_id?: string
          resource_kind?: string
          show_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "audio_show_resources_resource_fkey"
            columns: ["resource_id", "resource_kind"]
            isOneToOne: false
            referencedRelation: "resources"
            referencedColumns: ["id", "resource_kind"]
          },
        ]
      }
      audio_show_shared_links: {
        Row: {
          audio_show_id: string
          created_at: string
          show_resource_id: string
        }
        Insert: {
          audio_show_id: string
          created_at?: string
          show_resource_id: string
        }
        Update: {
          audio_show_id?: string
          created_at?: string
          show_resource_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "audio_show_shared_links_show_resource_id_fkey"
            columns: ["show_resource_id"]
            isOneToOne: true
            referencedRelation: "shows"
            referencedColumns: ["resource_id"]
          },
        ]
      }
      citation_locator_types: {
        Row: {
          created_at: string
          description: string
          enabled: boolean
          label: string
          locator_type: string
          sort_order: number
        }
        Insert: {
          created_at?: string
          description: string
          enabled?: boolean
          label: string
          locator_type: string
          sort_order?: number
        }
        Update: {
          created_at?: string
          description?: string
          enabled?: boolean
          label?: string
          locator_type?: string
          sort_order?: number
        }
        Relationships: []
      }
      citations: {
        Row: {
          citation_state: string
          created_at: string
          created_by: string | null
          editor_note: string | null
          id: string
          locator_data: Json
          locator_type: string
          public_label: string | null
          public_safe: boolean
          quotation: string | null
          source_id: string
          source_version_id: string
        }
        Insert: {
          citation_state?: string
          created_at?: string
          created_by?: string | null
          editor_note?: string | null
          id?: string
          locator_data?: Json
          locator_type: string
          public_label?: string | null
          public_safe?: boolean
          quotation?: string | null
          source_id: string
          source_version_id: string
        }
        Update: {
          citation_state?: string
          created_at?: string
          created_by?: string | null
          editor_note?: string | null
          id?: string
          locator_data?: Json
          locator_type?: string
          public_label?: string | null
          public_safe?: boolean
          quotation?: string | null
          source_id?: string
          source_version_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "citations_locator_type_fkey"
            columns: ["locator_type"]
            isOneToOne: false
            referencedRelation: "citation_locator_types"
            referencedColumns: ["locator_type"]
          },
          {
            foreignKeyName: "citations_source_fkey"
            columns: ["source_id"]
            isOneToOne: false
            referencedRelation: "sources"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "citations_source_version_fkey"
            columns: ["source_version_id"]
            isOneToOne: false
            referencedRelation: "source_versions"
            referencedColumns: ["id"]
          },
        ]
      }
      correction_applications: {
        Row: {
          adapter_type: string
          application_summary: string
          applied_at: string
          applied_by: string
          case_resource_id: string
          challenged_version_id: string
          command_receipt_id: string
          command_type: string
          correlation_id: string
          decision_id: string
          expected_published_version_id: string
          expected_working_fingerprint: string | null
          expected_working_version_id: string | null
          id: string
          resulting_version_id: string
          target_id: string
          target_resource_id: string
        }
        Insert: {
          adapter_type?: string
          application_summary: string
          applied_at?: string
          applied_by: string
          case_resource_id: string
          challenged_version_id: string
          command_receipt_id: string
          command_type?: string
          correlation_id: string
          decision_id: string
          expected_published_version_id: string
          expected_working_fingerprint?: string | null
          expected_working_version_id?: string | null
          id?: string
          resulting_version_id: string
          target_id: string
          target_resource_id: string
        }
        Update: {
          adapter_type?: string
          application_summary?: string
          applied_at?: string
          applied_by?: string
          case_resource_id?: string
          challenged_version_id?: string
          command_receipt_id?: string
          command_type?: string
          correlation_id?: string
          decision_id?: string
          expected_published_version_id?: string
          expected_working_fingerprint?: string | null
          expected_working_version_id?: string | null
          id?: string
          resulting_version_id?: string
          target_id?: string
          target_resource_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "correction_applications_case_fkey"
            columns: ["case_resource_id"]
            isOneToOne: false
            referencedRelation: "correction_cases"
            referencedColumns: ["resource_id"]
          },
          {
            foreignKeyName: "correction_applications_challenged_version_fkey"
            columns: ["challenged_version_id"]
            isOneToOne: false
            referencedRelation: "article_versions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "correction_applications_decision_fkey"
            columns: ["decision_id"]
            isOneToOne: true
            referencedRelation: "correction_decisions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "correction_applications_expected_published_version_fkey"
            columns: ["expected_published_version_id"]
            isOneToOne: false
            referencedRelation: "article_versions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "correction_applications_expected_working_version_fkey"
            columns: ["expected_working_version_id"]
            isOneToOne: false
            referencedRelation: "article_versions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "correction_applications_resource_fkey"
            columns: ["target_resource_id"]
            isOneToOne: false
            referencedRelation: "resources"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "correction_applications_resulting_version_fkey"
            columns: ["resulting_version_id"]
            isOneToOne: false
            referencedRelation: "article_versions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "correction_applications_target_fkey"
            columns: ["target_id"]
            isOneToOne: false
            referencedRelation: "correction_targets"
            referencedColumns: ["id"]
          },
        ]
      }
      correction_cases: {
        Row: {
          assigned_at: string | null
          assigned_investigator_id: string | null
          assignment_reason: string | null
          case_number: number
          case_state: string
          closed_at: string | null
          closed_by: string | null
          closed_reason: string | null
          contributor_follow_up_disposition: string | null
          contributor_follow_up_job_id: string | null
          contributor_follow_up_reason: string | null
          contributor_follow_up_requested_at: string | null
          correction_kind: string
          created_at: string
          created_by: string | null
          current_application_id: string | null
          current_decision_id: string | null
          current_revision: number
          evidence_ready: boolean
          investigation_summary: string | null
          investigator_recommendation: string | null
          origin_contribution_id: string | null
          origin_submitted_at: string | null
          origin_submitter_user_id: string | null
          origin_summary_snapshot: string
          origin_type: string
          origin_type_snapshot: string | null
          priority: string
          public_note_disposition: string | null
          public_note_no_note_reason: string | null
          resource_id: string
          resource_kind: string
          submitted_for_decision_at: string | null
          submitted_for_decision_by: string | null
          triage_reason: string | null
          triaged_at: string | null
          triaged_by: string | null
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          assigned_at?: string | null
          assigned_investigator_id?: string | null
          assignment_reason?: string | null
          case_number?: never
          case_state?: string
          closed_at?: string | null
          closed_by?: string | null
          closed_reason?: string | null
          contributor_follow_up_disposition?: string | null
          contributor_follow_up_job_id?: string | null
          contributor_follow_up_reason?: string | null
          contributor_follow_up_requested_at?: string | null
          correction_kind: string
          created_at?: string
          created_by?: string | null
          current_application_id?: string | null
          current_decision_id?: string | null
          current_revision?: number
          evidence_ready?: boolean
          investigation_summary?: string | null
          investigator_recommendation?: string | null
          origin_contribution_id?: string | null
          origin_submitted_at?: string | null
          origin_submitter_user_id?: string | null
          origin_summary_snapshot: string
          origin_type: string
          origin_type_snapshot?: string | null
          priority?: string
          public_note_disposition?: string | null
          public_note_no_note_reason?: string | null
          resource_id: string
          resource_kind?: string
          submitted_for_decision_at?: string | null
          submitted_for_decision_by?: string | null
          triage_reason?: string | null
          triaged_at?: string | null
          triaged_by?: string | null
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          assigned_at?: string | null
          assigned_investigator_id?: string | null
          assignment_reason?: string | null
          case_number?: never
          case_state?: string
          closed_at?: string | null
          closed_by?: string | null
          closed_reason?: string | null
          contributor_follow_up_disposition?: string | null
          contributor_follow_up_job_id?: string | null
          contributor_follow_up_reason?: string | null
          contributor_follow_up_requested_at?: string | null
          correction_kind?: string
          created_at?: string
          created_by?: string | null
          current_application_id?: string | null
          current_decision_id?: string | null
          current_revision?: number
          evidence_ready?: boolean
          investigation_summary?: string | null
          investigator_recommendation?: string | null
          origin_contribution_id?: string | null
          origin_submitted_at?: string | null
          origin_submitter_user_id?: string | null
          origin_summary_snapshot?: string
          origin_type?: string
          origin_type_snapshot?: string | null
          priority?: string
          public_note_disposition?: string | null
          public_note_no_note_reason?: string | null
          resource_id?: string
          resource_kind?: string
          submitted_for_decision_at?: string | null
          submitted_for_decision_by?: string | null
          triage_reason?: string | null
          triaged_at?: string | null
          triaged_by?: string | null
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "correction_cases_correction_kind_fkey"
            columns: ["correction_kind"]
            isOneToOne: false
            referencedRelation: "correction_kinds"
            referencedColumns: ["correction_kind"]
          },
          {
            foreignKeyName: "correction_cases_current_application_fkey"
            columns: ["current_application_id"]
            isOneToOne: false
            referencedRelation: "correction_applications"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "correction_cases_current_decision_fkey"
            columns: ["current_decision_id"]
            isOneToOne: false
            referencedRelation: "correction_decisions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "correction_cases_resource_fkey"
            columns: ["resource_id", "resource_kind"]
            isOneToOne: false
            referencedRelation: "resources"
            referencedColumns: ["id", "resource_kind"]
          },
        ]
      }
      correction_decisions: {
        Row: {
          case_resource_id: string
          case_revision_observed: number
          correlation_id: string | null
          created_at: string
          decided_by: string
          decision_number: number
          duplicate_of_case_resource_id: string | null
          id: string
          outcome: string
          private_analysis: string | null
          public_safe_explanation: string | null
          reason: string
          supersedes_decision_id: string | null
          target_state_observed: Json
        }
        Insert: {
          case_resource_id: string
          case_revision_observed: number
          correlation_id?: string | null
          created_at?: string
          decided_by: string
          decision_number: number
          duplicate_of_case_resource_id?: string | null
          id?: string
          outcome: string
          private_analysis?: string | null
          public_safe_explanation?: string | null
          reason: string
          supersedes_decision_id?: string | null
          target_state_observed?: Json
        }
        Update: {
          case_resource_id?: string
          case_revision_observed?: number
          correlation_id?: string | null
          created_at?: string
          decided_by?: string
          decision_number?: number
          duplicate_of_case_resource_id?: string | null
          id?: string
          outcome?: string
          private_analysis?: string | null
          public_safe_explanation?: string | null
          reason?: string
          supersedes_decision_id?: string | null
          target_state_observed?: Json
        }
        Relationships: [
          {
            foreignKeyName: "correction_decisions_case_fkey"
            columns: ["case_resource_id"]
            isOneToOne: false
            referencedRelation: "correction_cases"
            referencedColumns: ["resource_id"]
          },
          {
            foreignKeyName: "correction_decisions_duplicate_case_fkey"
            columns: ["duplicate_of_case_resource_id"]
            isOneToOne: false
            referencedRelation: "correction_cases"
            referencedColumns: ["resource_id"]
          },
          {
            foreignKeyName: "correction_decisions_supersedes_fkey"
            columns: ["supersedes_decision_id"]
            isOneToOne: false
            referencedRelation: "correction_decisions"
            referencedColumns: ["id"]
          },
        ]
      }
      correction_event_types: {
        Row: {
          created_at: string
          description: string
          enabled: boolean
          event_type: string
          label: string
          public_eligible: boolean
          sort_order: number
        }
        Insert: {
          created_at?: string
          description: string
          enabled?: boolean
          event_type: string
          label: string
          public_eligible?: boolean
          sort_order?: number
        }
        Update: {
          created_at?: string
          description?: string
          enabled?: boolean
          event_type?: string
          label?: string
          public_eligible?: boolean
          sort_order?: number
        }
        Relationships: []
      }
      correction_events: {
        Row: {
          actor_id: string | null
          application_id: string | null
          case_resource_id: string
          case_revision_after: number
          case_revision_before: number
          command_receipt_id: string | null
          correlation_id: string | null
          created_at: string
          decision_id: string | null
          event_number: number
          event_type: string
          evidence_link_id: string | null
          id: string
          metadata: Json
          prior_state: string | null
          public_note_id: string | null
          reason: string | null
          related_resource_review_id: string | null
          resulting_state: string | null
          target_id: string | null
        }
        Insert: {
          actor_id?: string | null
          application_id?: string | null
          case_resource_id: string
          case_revision_after: number
          case_revision_before: number
          command_receipt_id?: string | null
          correlation_id?: string | null
          created_at?: string
          decision_id?: string | null
          event_number: number
          event_type: string
          evidence_link_id?: string | null
          id?: string
          metadata?: Json
          prior_state?: string | null
          public_note_id?: string | null
          reason?: string | null
          related_resource_review_id?: string | null
          resulting_state?: string | null
          target_id?: string | null
        }
        Update: {
          actor_id?: string | null
          application_id?: string | null
          case_resource_id?: string
          case_revision_after?: number
          case_revision_before?: number
          command_receipt_id?: string | null
          correlation_id?: string | null
          created_at?: string
          decision_id?: string | null
          event_number?: number
          event_type?: string
          evidence_link_id?: string | null
          id?: string
          metadata?: Json
          prior_state?: string | null
          public_note_id?: string | null
          reason?: string | null
          related_resource_review_id?: string | null
          resulting_state?: string | null
          target_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "correction_events_application_fkey"
            columns: ["application_id"]
            isOneToOne: false
            referencedRelation: "correction_applications"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "correction_events_case_fkey"
            columns: ["case_resource_id"]
            isOneToOne: false
            referencedRelation: "correction_cases"
            referencedColumns: ["resource_id"]
          },
          {
            foreignKeyName: "correction_events_decision_fkey"
            columns: ["decision_id"]
            isOneToOne: false
            referencedRelation: "correction_decisions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "correction_events_event_type_fkey"
            columns: ["event_type"]
            isOneToOne: false
            referencedRelation: "correction_event_types"
            referencedColumns: ["event_type"]
          },
          {
            foreignKeyName: "correction_events_public_note_fkey"
            columns: ["public_note_id"]
            isOneToOne: false
            referencedRelation: "correction_public_notes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "correction_events_related_review_fkey"
            columns: ["related_resource_review_id"]
            isOneToOne: false
            referencedRelation: "correction_related_resource_reviews"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "correction_events_target_fkey"
            columns: ["target_id"]
            isOneToOne: false
            referencedRelation: "correction_targets"
            referencedColumns: ["id"]
          },
        ]
      }
      correction_evidence_links: {
        Row: {
          case_resource_id: string
          citation_id: string | null
          created_at: string
          created_by: string | null
          evidence_role: string
          id: string
          internal_note: string | null
          source_id: string
          source_version_id: string
        }
        Insert: {
          case_resource_id: string
          citation_id?: string | null
          created_at?: string
          created_by?: string | null
          evidence_role: string
          id?: string
          internal_note?: string | null
          source_id: string
          source_version_id: string
        }
        Update: {
          case_resource_id?: string
          citation_id?: string | null
          created_at?: string
          created_by?: string | null
          evidence_role?: string
          id?: string
          internal_note?: string | null
          source_id?: string
          source_version_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "correction_evidence_links_case_fkey"
            columns: ["case_resource_id"]
            isOneToOne: false
            referencedRelation: "correction_cases"
            referencedColumns: ["resource_id"]
          },
          {
            foreignKeyName: "correction_evidence_links_citation_fkey"
            columns: ["citation_id"]
            isOneToOne: false
            referencedRelation: "citations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "correction_evidence_links_role_fkey"
            columns: ["evidence_role"]
            isOneToOne: false
            referencedRelation: "correction_evidence_roles"
            referencedColumns: ["evidence_role"]
          },
          {
            foreignKeyName: "correction_evidence_links_source_fkey"
            columns: ["source_id"]
            isOneToOne: false
            referencedRelation: "sources"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "correction_evidence_links_source_version_fkey"
            columns: ["source_version_id"]
            isOneToOne: false
            referencedRelation: "source_versions"
            referencedColumns: ["id"]
          },
        ]
      }
      correction_evidence_roles: {
        Row: {
          created_at: string
          description: string
          enabled: boolean
          evidence_role: string
          label: string
          sort_order: number
        }
        Insert: {
          created_at?: string
          description: string
          enabled?: boolean
          evidence_role: string
          label: string
          sort_order?: number
        }
        Update: {
          created_at?: string
          description?: string
          enabled?: boolean
          evidence_role?: string
          label?: string
          sort_order?: number
        }
        Relationships: []
      }
      correction_kinds: {
        Row: {
          correction_kind: string
          created_at: string
          description: string
          enabled: boolean
          label: string
          sort_order: number
        }
        Insert: {
          correction_kind: string
          created_at?: string
          description: string
          enabled?: boolean
          label: string
          sort_order?: number
        }
        Update: {
          correction_kind?: string
          created_at?: string
          description?: string
          enabled?: boolean
          label?: string
          sort_order?: number
        }
        Relationships: []
      }
      correction_public_notes: {
        Row: {
          affected_resource_id: string
          affected_resource_kind: string
          application_id: string
          case_resource_id: string
          challenged_version_id: string
          corrected_version_id: string
          id: string
          note_fingerprint: string
          note_text: string
          published_at: string
          published_by: string | null
          supersedes_note_id: string | null
        }
        Insert: {
          affected_resource_id: string
          affected_resource_kind: string
          application_id: string
          case_resource_id: string
          challenged_version_id: string
          corrected_version_id: string
          id?: string
          note_fingerprint: string
          note_text: string
          published_at?: string
          published_by?: string | null
          supersedes_note_id?: string | null
        }
        Update: {
          affected_resource_id?: string
          affected_resource_kind?: string
          application_id?: string
          case_resource_id?: string
          challenged_version_id?: string
          corrected_version_id?: string
          id?: string
          note_fingerprint?: string
          note_text?: string
          published_at?: string
          published_by?: string | null
          supersedes_note_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "correction_public_notes_application_fkey"
            columns: ["application_id"]
            isOneToOne: false
            referencedRelation: "correction_applications"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "correction_public_notes_case_fkey"
            columns: ["case_resource_id"]
            isOneToOne: false
            referencedRelation: "correction_cases"
            referencedColumns: ["resource_id"]
          },
          {
            foreignKeyName: "correction_public_notes_challenged_version_fkey"
            columns: ["challenged_version_id"]
            isOneToOne: false
            referencedRelation: "article_versions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "correction_public_notes_corrected_version_fkey"
            columns: ["corrected_version_id"]
            isOneToOne: false
            referencedRelation: "article_versions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "correction_public_notes_resource_fkey"
            columns: ["affected_resource_id", "affected_resource_kind"]
            isOneToOne: false
            referencedRelation: "resources"
            referencedColumns: ["id", "resource_kind"]
          },
          {
            foreignKeyName: "correction_public_notes_supersedes_fkey"
            columns: ["supersedes_note_id"]
            isOneToOne: true
            referencedRelation: "correction_public_notes"
            referencedColumns: ["id"]
          },
        ]
      }
      correction_related_resource_reviews: {
        Row: {
          case_resource_id: string
          created_at: string
          created_by: string | null
          disposition: string | null
          id: string
          linked_correction_case_resource_id: string | null
          reason: string | null
          related_resource_id: string
          related_resource_kind: string
          resolved_at: string | null
          resolved_by: string | null
          review_revision: number
          review_state: string
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          case_resource_id: string
          created_at?: string
          created_by?: string | null
          disposition?: string | null
          id?: string
          linked_correction_case_resource_id?: string | null
          reason?: string | null
          related_resource_id: string
          related_resource_kind: string
          resolved_at?: string | null
          resolved_by?: string | null
          review_revision?: number
          review_state?: string
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          case_resource_id?: string
          created_at?: string
          created_by?: string | null
          disposition?: string | null
          id?: string
          linked_correction_case_resource_id?: string | null
          reason?: string | null
          related_resource_id?: string
          related_resource_kind?: string
          resolved_at?: string | null
          resolved_by?: string | null
          review_revision?: number
          review_state?: string
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "correction_related_reviews_case_fkey"
            columns: ["case_resource_id"]
            isOneToOne: false
            referencedRelation: "correction_cases"
            referencedColumns: ["resource_id"]
          },
          {
            foreignKeyName: "correction_related_reviews_linked_case_fkey"
            columns: ["linked_correction_case_resource_id"]
            isOneToOne: false
            referencedRelation: "correction_cases"
            referencedColumns: ["resource_id"]
          },
          {
            foreignKeyName: "correction_related_reviews_resource_fkey"
            columns: ["related_resource_id", "related_resource_kind"]
            isOneToOne: false
            referencedRelation: "resources"
            referencedColumns: ["id", "resource_kind"]
          },
        ]
      }
      correction_targets: {
        Row: {
          case_resource_id: string
          created_at: string
          created_by: string | null
          id: string
          observed_content_fingerprint: string | null
          observed_resource_revision: number | null
          target_resource_id: string
          target_resource_kind: string
          target_role: string
          target_summary: string | null
          target_version_id: string
          target_version_type: string
        }
        Insert: {
          case_resource_id: string
          created_at?: string
          created_by?: string | null
          id?: string
          observed_content_fingerprint?: string | null
          observed_resource_revision?: number | null
          target_resource_id: string
          target_resource_kind: string
          target_role?: string
          target_summary?: string | null
          target_version_id: string
          target_version_type: string
        }
        Update: {
          case_resource_id?: string
          created_at?: string
          created_by?: string | null
          id?: string
          observed_content_fingerprint?: string | null
          observed_resource_revision?: number | null
          target_resource_id?: string
          target_resource_kind?: string
          target_role?: string
          target_summary?: string | null
          target_version_id?: string
          target_version_type?: string
        }
        Relationships: [
          {
            foreignKeyName: "correction_targets_case_fkey"
            columns: ["case_resource_id"]
            isOneToOne: false
            referencedRelation: "correction_cases"
            referencedColumns: ["resource_id"]
          },
          {
            foreignKeyName: "correction_targets_resource_fkey"
            columns: ["target_resource_id", "target_resource_kind"]
            isOneToOne: false
            referencedRelation: "resources"
            referencedColumns: ["id", "resource_kind"]
          },
          {
            foreignKeyName: "correction_targets_version_fkey"
            columns: ["target_version_id"]
            isOneToOne: false
            referencedRelation: "article_versions"
            referencedColumns: ["id"]
          },
        ]
      }
      credit_governance: {
        Row: {
          credit_id: string
          credit_state: string
          governance_revision: number
          public_safe: boolean
          reason: string | null
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          credit_id: string
          credit_state?: string
          governance_revision?: number
          public_safe?: boolean
          reason?: string | null
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          credit_id?: string
          credit_state?: string
          governance_revision?: number
          public_safe?: boolean
          reason?: string | null
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "credit_governance_credit_id_fkey"
            columns: ["credit_id"]
            isOneToOne: true
            referencedRelation: "credits"
            referencedColumns: ["id"]
          },
        ]
      }
      credit_roles: {
        Row: {
          created_at: string
          credit_role: string
          description: string
          enabled: boolean
          label: string
          sort_order: number
        }
        Insert: {
          created_at?: string
          credit_role: string
          description: string
          enabled?: boolean
          label: string
          sort_order?: number
        }
        Update: {
          created_at?: string
          credit_role?: string
          description?: string
          enabled?: boolean
          label?: string
          sort_order?: number
        }
        Relationships: []
      }
      credits: {
        Row: {
          created_at: string
          created_by: string | null
          credit_note: string | null
          credit_role: string
          display_name_snapshot: string
          external_contributor_id: string | null
          id: string
          organization_resource_id: string | null
          registry_author_id: string | null
          registry_author_slug_snapshot: string | null
          role_label_snapshot: string | null
          user_id: string | null
          user_username_snapshot: string | null
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          credit_note?: string | null
          credit_role: string
          display_name_snapshot: string
          external_contributor_id?: string | null
          id?: string
          organization_resource_id?: string | null
          registry_author_id?: string | null
          registry_author_slug_snapshot?: string | null
          role_label_snapshot?: string | null
          user_id?: string | null
          user_username_snapshot?: string | null
        }
        Update: {
          created_at?: string
          created_by?: string | null
          credit_note?: string | null
          credit_role?: string
          display_name_snapshot?: string
          external_contributor_id?: string | null
          id?: string
          organization_resource_id?: string | null
          registry_author_id?: string | null
          registry_author_slug_snapshot?: string | null
          role_label_snapshot?: string | null
          user_id?: string | null
          user_username_snapshot?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "credits_credit_role_fkey"
            columns: ["credit_role"]
            isOneToOne: false
            referencedRelation: "credit_roles"
            referencedColumns: ["credit_role"]
          },
          {
            foreignKeyName: "credits_external_contributor_id_fkey"
            columns: ["external_contributor_id"]
            isOneToOne: false
            referencedRelation: "external_contributors"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "credits_organization_resource_id_fkey"
            columns: ["organization_resource_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["resource_id"]
          },
        ]
      }
      external_contributors: {
        Row: {
          consent_status: string
          contact_email: string | null
          contact_phone: string | null
          contributor_state: string
          created_at: string
          created_by: string | null
          display_name: string
          id: string
          internal_notes: string | null
          location_text: string | null
          public_role: string | null
          public_safe: boolean
          public_url: string | null
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          consent_status?: string
          contact_email?: string | null
          contact_phone?: string | null
          contributor_state?: string
          created_at?: string
          created_by?: string | null
          display_name: string
          id?: string
          internal_notes?: string | null
          location_text?: string | null
          public_role?: string | null
          public_safe?: boolean
          public_url?: string | null
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          consent_status?: string
          contact_email?: string | null
          contact_phone?: string | null
          contributor_state?: string
          created_at?: string
          created_by?: string | null
          display_name?: string
          id?: string
          internal_notes?: string | null
          location_text?: string | null
          public_role?: string | null
          public_safe?: boolean
          public_url?: string | null
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: []
      }
      media_asset_resources: {
        Row: {
          asset_id: string
          resource_id: string
          resource_kind: string
        }
        Insert: {
          asset_id: string
          resource_id: string
          resource_kind?: string
        }
        Update: {
          asset_id?: string
          resource_id?: string
          resource_kind?: string
        }
        Relationships: [
          {
            foreignKeyName: "media_asset_resources_resource_fkey"
            columns: ["resource_id", "resource_kind"]
            isOneToOne: false
            referencedRelation: "resources"
            referencedColumns: ["id", "resource_kind"]
          },
        ]
      }
      organization_registry_label_links: {
        Row: {
          created_at: string
          created_by: string | null
          link_reason: string
          link_state: string
          organization_resource_id: string
          registry_label_id: string
          retired_at: string | null
          retired_by: string | null
          retired_reason: string | null
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          link_reason: string
          link_state?: string
          organization_resource_id: string
          registry_label_id: string
          retired_at?: string | null
          retired_by?: string | null
          retired_reason?: string | null
        }
        Update: {
          created_at?: string
          created_by?: string | null
          link_reason?: string
          link_state?: string
          organization_resource_id?: string
          registry_label_id?: string
          retired_at?: string | null
          retired_by?: string | null
          retired_reason?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "organization_registry_label_links_org_fkey"
            columns: ["organization_resource_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["resource_id"]
          },
        ]
      }
      organization_type_assignments: {
        Row: {
          created_at: string
          created_by: string | null
          display_order: number
          is_primary: boolean
          organization_resource_id: string
          organization_type: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          display_order?: number
          is_primary?: boolean
          organization_resource_id: string
          organization_type: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          display_order?: number
          is_primary?: boolean
          organization_resource_id?: string
          organization_type?: string
        }
        Relationships: [
          {
            foreignKeyName: "organization_type_assignments_org_fkey"
            columns: ["organization_resource_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["resource_id"]
          },
          {
            foreignKeyName: "organization_type_assignments_type_fkey"
            columns: ["organization_type"]
            isOneToOne: false
            referencedRelation: "organization_types"
            referencedColumns: ["organization_type"]
          },
        ]
      }
      organization_types: {
        Row: {
          created_at: string
          description: string
          enabled: boolean
          label: string
          organization_type: string
          sort_order: number
        }
        Insert: {
          created_at?: string
          description: string
          enabled?: boolean
          label: string
          organization_type: string
          sort_order?: number
        }
        Update: {
          created_at?: string
          description?: string
          enabled?: boolean
          label?: string
          organization_type?: string
          sort_order?: number
        }
        Relationships: []
      }
      organizations: {
        Row: {
          cover_url: string | null
          created_at: string
          created_by: string | null
          description: string | null
          display_name: string
          location_text: string | null
          logo_url: string | null
          organization_state: string
          resource_id: string
          resource_kind: string
          updated_at: string
          updated_by: string | null
          website_url: string | null
        }
        Insert: {
          cover_url?: string | null
          created_at?: string
          created_by?: string | null
          description?: string | null
          display_name: string
          location_text?: string | null
          logo_url?: string | null
          organization_state?: string
          resource_id: string
          resource_kind?: string
          updated_at?: string
          updated_by?: string | null
          website_url?: string | null
        }
        Update: {
          cover_url?: string | null
          created_at?: string
          created_by?: string | null
          description?: string | null
          display_name?: string
          location_text?: string | null
          logo_url?: string | null
          organization_state?: string
          resource_id?: string
          resource_kind?: string
          updated_at?: string
          updated_by?: string | null
          website_url?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "organizations_resource_fkey"
            columns: ["resource_id", "resource_kind"]
            isOneToOne: false
            referencedRelation: "resources"
            referencedColumns: ["id", "resource_kind"]
          },
        ]
      }
      people: {
        Row: {
          created_at: string
          created_by: string | null
          identity_revision: number
          merged_into_person_resource_id: string | null
          person_state: string
          preferred_identity_link_id: string | null
          resource_id: string
          resource_kind: string
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          identity_revision?: number
          merged_into_person_resource_id?: string | null
          person_state?: string
          preferred_identity_link_id?: string | null
          resource_id: string
          resource_kind?: string
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          created_at?: string
          created_by?: string | null
          identity_revision?: number
          merged_into_person_resource_id?: string | null
          person_state?: string
          preferred_identity_link_id?: string | null
          resource_id?: string
          resource_kind?: string
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "people_merged_into_fkey"
            columns: ["merged_into_person_resource_id"]
            isOneToOne: false
            referencedRelation: "people"
            referencedColumns: ["resource_id"]
          },
          {
            foreignKeyName: "people_preferred_identity_link_fkey"
            columns: ["preferred_identity_link_id", "resource_id"]
            isOneToOne: false
            referencedRelation: "person_identity_links"
            referencedColumns: ["id", "person_resource_id"]
          },
          {
            foreignKeyName: "people_resource_fkey"
            columns: ["resource_id", "resource_kind"]
            isOneToOne: true
            referencedRelation: "resources"
            referencedColumns: ["id", "resource_kind"]
          },
        ]
      }
      person_follow_merge_transfers: {
        Row: {
          created_at: string
          id: string
          merge_event_id: string
          source_follow_created_at: string
          source_follow_id: string
          source_person_resource_id: string
          target_follow_id: string
          target_follow_preexisted: boolean
          target_person_resource_id: string
          transfer_mode: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          merge_event_id: string
          source_follow_created_at: string
          source_follow_id: string
          source_person_resource_id: string
          target_follow_id: string
          target_follow_preexisted: boolean
          target_person_resource_id: string
          transfer_mode: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          merge_event_id?: string
          source_follow_created_at?: string
          source_follow_id?: string
          source_person_resource_id?: string
          target_follow_id?: string
          target_follow_preexisted?: boolean
          target_person_resource_id?: string
          transfer_mode?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "person_follow_merge_transfers_merge_event_fkey"
            columns: ["merge_event_id"]
            isOneToOne: false
            referencedRelation: "person_identity_events"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "person_follow_merge_transfers_source_person_fkey"
            columns: ["source_person_resource_id"]
            isOneToOne: false
            referencedRelation: "people"
            referencedColumns: ["resource_id"]
          },
          {
            foreignKeyName: "person_follow_merge_transfers_target_person_fkey"
            columns: ["target_person_resource_id"]
            isOneToOne: false
            referencedRelation: "people"
            referencedColumns: ["resource_id"]
          },
        ]
      }
      person_identity_events: {
        Row: {
          actor_id: string | null
          correlation_id: string | null
          created_at: string
          event_type: string
          id: string
          identity_link_id: string | null
          person_resource_id: string
          prior_identity_revision: number | null
          reason: string | null
          related_person_resource_id: string | null
          resulting_identity_revision: number
        }
        Insert: {
          actor_id?: string | null
          correlation_id?: string | null
          created_at?: string
          event_type: string
          id?: string
          identity_link_id?: string | null
          person_resource_id: string
          prior_identity_revision?: number | null
          reason?: string | null
          related_person_resource_id?: string | null
          resulting_identity_revision: number
        }
        Update: {
          actor_id?: string | null
          correlation_id?: string | null
          created_at?: string
          event_type?: string
          id?: string
          identity_link_id?: string | null
          person_resource_id?: string
          prior_identity_revision?: number | null
          reason?: string | null
          related_person_resource_id?: string | null
          resulting_identity_revision?: number
        }
        Relationships: [
          {
            foreignKeyName: "person_identity_events_link_fkey"
            columns: ["identity_link_id"]
            isOneToOne: false
            referencedRelation: "person_identity_links"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "person_identity_events_person_fkey"
            columns: ["person_resource_id"]
            isOneToOne: false
            referencedRelation: "people"
            referencedColumns: ["resource_id"]
          },
          {
            foreignKeyName: "person_identity_events_related_person_fkey"
            columns: ["related_person_resource_id"]
            isOneToOne: false
            referencedRelation: "people"
            referencedColumns: ["resource_id"]
          },
        ]
      }
      person_identity_links: {
        Row: {
          created_at: string
          created_by: string | null
          external_contributor_id: string | null
          id: string
          link_method: string
          link_reason: string
          link_state: string
          person_resource_id: string
          person_resource_kind: string
          registry_author_id: string | null
          retired_at: string | null
          retired_by: string | null
          retired_reason: string | null
          retired_user_id_snapshot: string | null
          superseded_by_link_id: string | null
          supersedes_link_id: string | null
          user_id: string | null
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          external_contributor_id?: string | null
          id?: string
          link_method: string
          link_reason: string
          link_state?: string
          person_resource_id: string
          person_resource_kind?: string
          registry_author_id?: string | null
          retired_at?: string | null
          retired_by?: string | null
          retired_reason?: string | null
          retired_user_id_snapshot?: string | null
          superseded_by_link_id?: string | null
          supersedes_link_id?: string | null
          user_id?: string | null
        }
        Update: {
          created_at?: string
          created_by?: string | null
          external_contributor_id?: string | null
          id?: string
          link_method?: string
          link_reason?: string
          link_state?: string
          person_resource_id?: string
          person_resource_kind?: string
          registry_author_id?: string | null
          retired_at?: string | null
          retired_by?: string | null
          retired_reason?: string | null
          retired_user_id_snapshot?: string | null
          superseded_by_link_id?: string | null
          supersedes_link_id?: string | null
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "person_identity_links_external_contributor_fkey"
            columns: ["external_contributor_id"]
            isOneToOne: false
            referencedRelation: "external_contributors"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "person_identity_links_person_fkey"
            columns: ["person_resource_id", "person_resource_kind"]
            isOneToOne: false
            referencedRelation: "people"
            referencedColumns: ["resource_id", "resource_kind"]
          },
          {
            foreignKeyName: "person_identity_links_retired_user_snapshot_fkey"
            columns: ["retired_user_id_snapshot"]
            isOneToOne: false
            referencedRelation: "retired_account_identities"
            referencedColumns: ["user_id"]
          },
          {
            foreignKeyName: "person_identity_links_superseded_by_fkey"
            columns: ["superseded_by_link_id"]
            isOneToOne: false
            referencedRelation: "person_identity_links"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "person_identity_links_supersedes_fkey"
            columns: ["supersedes_link_id"]
            isOneToOne: false
            referencedRelation: "person_identity_links"
            referencedColumns: ["id"]
          },
        ]
      }
      playlist_item_resources: {
        Row: {
          playlist_item_id: string
          resource_id: string
          resource_kind: string
        }
        Insert: {
          playlist_item_id: string
          resource_id: string
          resource_kind?: string
        }
        Update: {
          playlist_item_id?: string
          resource_id?: string
          resource_kind?: string
        }
        Relationships: [
          {
            foreignKeyName: "playlist_item_resources_resource_fkey"
            columns: ["resource_id", "resource_kind"]
            isOneToOne: false
            referencedRelation: "resources"
            referencedColumns: ["id", "resource_kind"]
          },
        ]
      }
      playlist_lifecycle_events: {
        Row: {
          action: string
          actor_id: string | null
          command_receipt_id: string
          created_at: string
          event_number: number
          id: string
          metadata: Json
          note: string | null
          playlist_id: string
          prior_status: string | null
          resource_id: string
          resulting_status: string
          version_id: string | null
        }
        Insert: {
          action: string
          actor_id?: string | null
          command_receipt_id: string
          created_at?: string
          event_number: number
          id?: string
          metadata?: Json
          note?: string | null
          playlist_id: string
          prior_status?: string | null
          resource_id: string
          resulting_status: string
          version_id?: string | null
        }
        Update: {
          action?: string
          actor_id?: string | null
          command_receipt_id?: string
          created_at?: string
          event_number?: number
          id?: string
          metadata?: Json
          note?: string | null
          playlist_id?: string
          prior_status?: string | null
          resource_id?: string
          resulting_status?: string
          version_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "playlist_lifecycle_events_binding_fkey"
            columns: ["resource_id", "playlist_id"]
            isOneToOne: false
            referencedRelation: "playlist_resources"
            referencedColumns: ["resource_id", "playlist_id"]
          },
          {
            foreignKeyName: "playlist_lifecycle_events_version_fkey"
            columns: ["version_id", "resource_id", "playlist_id"]
            isOneToOne: false
            referencedRelation: "playlist_versions"
            referencedColumns: ["id", "resource_id", "playlist_id"]
          },
        ]
      }
      playlist_publication_snapshots: {
        Row: {
          command_receipt_id: string
          content_fingerprint: string
          cover_alt_text: string | null
          cover_caption: string | null
          cover_credit: string | null
          cover_url: string | null
          created_at: string
          curator_label: string | null
          description: string | null
          first_published_at: string
          id: string
          item_count: number
          payload: Json
          playlist_id: string
          published_at: string
          published_by: string | null
          resource_id: string
          slug: string
          title: string
          version_id: string
        }
        Insert: {
          command_receipt_id: string
          content_fingerprint: string
          cover_alt_text?: string | null
          cover_caption?: string | null
          cover_credit?: string | null
          cover_url?: string | null
          created_at?: string
          curator_label?: string | null
          description?: string | null
          first_published_at: string
          id?: string
          item_count: number
          payload: Json
          playlist_id: string
          published_at: string
          published_by?: string | null
          resource_id: string
          slug: string
          title: string
          version_id: string
        }
        Update: {
          command_receipt_id?: string
          content_fingerprint?: string
          cover_alt_text?: string | null
          cover_caption?: string | null
          cover_credit?: string | null
          cover_url?: string | null
          created_at?: string
          curator_label?: string | null
          description?: string | null
          first_published_at?: string
          id?: string
          item_count?: number
          payload?: Json
          playlist_id?: string
          published_at?: string
          published_by?: string | null
          resource_id?: string
          slug?: string
          title?: string
          version_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "playlist_publication_snapshots_binding_fkey"
            columns: ["resource_id", "playlist_id"]
            isOneToOne: false
            referencedRelation: "playlist_resources"
            referencedColumns: ["resource_id", "playlist_id"]
          },
          {
            foreignKeyName: "playlist_publication_snapshots_version_fkey"
            columns: ["version_id", "resource_id", "playlist_id"]
            isOneToOne: false
            referencedRelation: "playlist_versions"
            referencedColumns: ["id", "resource_id", "playlist_id"]
          },
        ]
      }
      playlist_resources: {
        Row: {
          current_approved_version_id: string | null
          current_published_version_id: string | null
          current_submitted_version_id: string | null
          current_working_version_id: string | null
          playlist_id: string
          resource_id: string
          resource_kind: string
        }
        Insert: {
          current_approved_version_id?: string | null
          current_published_version_id?: string | null
          current_submitted_version_id?: string | null
          current_working_version_id?: string | null
          playlist_id: string
          resource_id: string
          resource_kind?: string
        }
        Update: {
          current_approved_version_id?: string | null
          current_published_version_id?: string | null
          current_submitted_version_id?: string | null
          current_working_version_id?: string | null
          playlist_id?: string
          resource_id?: string
          resource_kind?: string
        }
        Relationships: [
          {
            foreignKeyName: "playlist_resources_approved_version_fkey"
            columns: [
              "current_approved_version_id",
              "resource_id",
              "playlist_id",
            ]
            isOneToOne: false
            referencedRelation: "playlist_versions"
            referencedColumns: ["id", "resource_id", "playlist_id"]
          },
          {
            foreignKeyName: "playlist_resources_published_version_fkey"
            columns: [
              "current_published_version_id",
              "resource_id",
              "playlist_id",
            ]
            isOneToOne: false
            referencedRelation: "playlist_versions"
            referencedColumns: ["id", "resource_id", "playlist_id"]
          },
          {
            foreignKeyName: "playlist_resources_resource_fkey"
            columns: ["resource_id", "resource_kind"]
            isOneToOne: false
            referencedRelation: "resources"
            referencedColumns: ["id", "resource_kind"]
          },
          {
            foreignKeyName: "playlist_resources_submitted_version_fkey"
            columns: [
              "current_submitted_version_id",
              "resource_id",
              "playlist_id",
            ]
            isOneToOne: false
            referencedRelation: "playlist_versions"
            referencedColumns: ["id", "resource_id", "playlist_id"]
          },
          {
            foreignKeyName: "playlist_resources_working_version_fkey"
            columns: [
              "current_working_version_id",
              "resource_id",
              "playlist_id",
            ]
            isOneToOne: false
            referencedRelation: "playlist_versions"
            referencedColumns: ["id", "resource_id", "playlist_id"]
          },
        ]
      }
      playlist_review_events: {
        Row: {
          action: string
          actor_id: string | null
          command_receipt_id: string
          correlation_id: string
          created_at: string
          event_number: number
          id: string
          playlist_id: string
          prior_status: string
          reason: string | null
          resource_id: string
          result_version_id: string | null
          resulting_status: string
          target_version_id: string
        }
        Insert: {
          action: string
          actor_id?: string | null
          command_receipt_id: string
          correlation_id: string
          created_at?: string
          event_number: number
          id?: string
          playlist_id: string
          prior_status: string
          reason?: string | null
          resource_id: string
          result_version_id?: string | null
          resulting_status: string
          target_version_id: string
        }
        Update: {
          action?: string
          actor_id?: string | null
          command_receipt_id?: string
          correlation_id?: string
          created_at?: string
          event_number?: number
          id?: string
          playlist_id?: string
          prior_status?: string
          reason?: string | null
          resource_id?: string
          result_version_id?: string | null
          resulting_status?: string
          target_version_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "playlist_review_events_resource_playlist_fkey"
            columns: ["resource_id", "playlist_id"]
            isOneToOne: false
            referencedRelation: "playlist_resources"
            referencedColumns: ["resource_id", "playlist_id"]
          },
          {
            foreignKeyName: "playlist_review_events_result_version_fkey"
            columns: ["result_version_id", "resource_id", "playlist_id"]
            isOneToOne: false
            referencedRelation: "playlist_versions"
            referencedColumns: ["id", "resource_id", "playlist_id"]
          },
          {
            foreignKeyName: "playlist_review_events_target_version_fkey"
            columns: ["target_version_id", "resource_id", "playlist_id"]
            isOneToOne: false
            referencedRelation: "playlist_versions"
            referencedColumns: ["id", "resource_id", "playlist_id"]
          },
        ]
      }
      playlist_scheduled_publications: {
        Row: {
          command_receipt_id: string
          created_at: string
          created_by: string | null
          failure_reason: string | null
          id: string
          note: string | null
          playlist_id: string
          published_at: string | null
          resource_id: string
          run_after: string
          status: string
          updated_at: string
          version_id: string
        }
        Insert: {
          command_receipt_id: string
          created_at?: string
          created_by?: string | null
          failure_reason?: string | null
          id?: string
          note?: string | null
          playlist_id: string
          published_at?: string | null
          resource_id: string
          run_after: string
          status?: string
          updated_at?: string
          version_id: string
        }
        Update: {
          command_receipt_id?: string
          created_at?: string
          created_by?: string | null
          failure_reason?: string | null
          id?: string
          note?: string | null
          playlist_id?: string
          published_at?: string | null
          resource_id?: string
          run_after?: string
          status?: string
          updated_at?: string
          version_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "playlist_scheduled_publications_binding_fkey"
            columns: ["resource_id", "playlist_id"]
            isOneToOne: false
            referencedRelation: "playlist_resources"
            referencedColumns: ["resource_id", "playlist_id"]
          },
          {
            foreignKeyName: "playlist_scheduled_publications_version_fkey"
            columns: ["version_id", "resource_id", "playlist_id"]
            isOneToOne: false
            referencedRelation: "playlist_versions"
            referencedColumns: ["id", "resource_id", "playlist_id"]
          },
        ]
      }
      playlist_version_items: {
        Row: {
          artist_names: string[]
          artwork_url: string | null
          duration_ms: number | null
          isrc: string | null
          match_confidence: number | null
          match_status: string
          normalization_payload: Json
          notes: string | null
          playlist_item_id: string
          playlist_item_resource_id: string
          playlist_version_id: string
          position: number
          preview_url: string | null
          provider_key: string | null
          provider_track_id: string | null
          provider_url: string | null
          registry_release_id: string | null
          registry_track_id: string | null
          release_title: string | null
          title: string | null
        }
        Insert: {
          artist_names?: string[]
          artwork_url?: string | null
          duration_ms?: number | null
          isrc?: string | null
          match_confidence?: number | null
          match_status: string
          normalization_payload?: Json
          notes?: string | null
          playlist_item_id: string
          playlist_item_resource_id: string
          playlist_version_id: string
          position: number
          preview_url?: string | null
          provider_key?: string | null
          provider_track_id?: string | null
          provider_url?: string | null
          registry_release_id?: string | null
          registry_track_id?: string | null
          release_title?: string | null
          title?: string | null
        }
        Update: {
          artist_names?: string[]
          artwork_url?: string | null
          duration_ms?: number | null
          isrc?: string | null
          match_confidence?: number | null
          match_status?: string
          normalization_payload?: Json
          notes?: string | null
          playlist_item_id?: string
          playlist_item_resource_id?: string
          playlist_version_id?: string
          position?: number
          preview_url?: string | null
          provider_key?: string | null
          provider_track_id?: string | null
          provider_url?: string | null
          registry_release_id?: string | null
          registry_track_id?: string | null
          release_title?: string | null
          title?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "playlist_version_items_item_identity_fkey"
            columns: ["playlist_item_resource_id", "playlist_item_id"]
            isOneToOne: false
            referencedRelation: "playlist_item_resources"
            referencedColumns: ["resource_id", "playlist_item_id"]
          },
          {
            foreignKeyName: "playlist_version_items_version_fkey"
            columns: ["playlist_version_id"]
            isOneToOne: false
            referencedRelation: "playlist_versions"
            referencedColumns: ["id"]
          },
        ]
      }
      playlist_version_trust_revisions: {
        Row: {
          citation_revision: number
          credit_revision: number
          playlist_version_id: string
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          citation_revision?: number
          credit_revision?: number
          playlist_version_id: string
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          citation_revision?: number
          credit_revision?: number
          playlist_version_id?: string
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "playlist_version_trust_revisions_playlist_version_id_fkey"
            columns: ["playlist_version_id"]
            isOneToOne: true
            referencedRelation: "playlist_versions"
            referencedColumns: ["id"]
          },
        ]
      }
      playlist_versions: {
        Row: {
          content_fingerprint: string
          cover_alt_text_snapshot: string | null
          cover_asset_id: string | null
          cover_asset_revision_id: string | null
          cover_caption_snapshot: string | null
          cover_credit_snapshot: string | null
          cover_display_order: number
          cover_placement_data: Json
          created_at: string
          created_by: string | null
          curator_label: string | null
          description: string | null
          id: string
          item_count: number
          metadata: Json
          playlist_id: string
          resource_id: string
          slug: string
          source_authority_revision: number
          status: string
          title: string
          version_kind: string
          version_number: number
        }
        Insert: {
          content_fingerprint: string
          cover_alt_text_snapshot?: string | null
          cover_asset_id?: string | null
          cover_asset_revision_id?: string | null
          cover_caption_snapshot?: string | null
          cover_credit_snapshot?: string | null
          cover_display_order?: number
          cover_placement_data?: Json
          created_at?: string
          created_by?: string | null
          curator_label?: string | null
          description?: string | null
          id?: string
          item_count: number
          metadata?: Json
          playlist_id: string
          resource_id: string
          slug: string
          source_authority_revision: number
          status: string
          title: string
          version_kind: string
          version_number: number
        }
        Update: {
          content_fingerprint?: string
          cover_alt_text_snapshot?: string | null
          cover_asset_id?: string | null
          cover_asset_revision_id?: string | null
          cover_caption_snapshot?: string | null
          cover_credit_snapshot?: string | null
          cover_display_order?: number
          cover_placement_data?: Json
          created_at?: string
          created_by?: string | null
          curator_label?: string | null
          description?: string | null
          id?: string
          item_count?: number
          metadata?: Json
          playlist_id?: string
          resource_id?: string
          slug?: string
          source_authority_revision?: number
          status?: string
          title?: string
          version_kind?: string
          version_number?: number
        }
        Relationships: [
          {
            foreignKeyName: "playlist_versions_resource_playlist_fkey"
            columns: ["resource_id", "playlist_id"]
            isOneToOne: false
            referencedRelation: "playlist_resources"
            referencedColumns: ["resource_id", "playlist_id"]
          },
        ]
      }
      publishing_channels: {
        Row: {
          channel_key: string
          created_at: string
          description: string
          enabled: boolean
          label: string
          sort_order: number
          updated_at: string
        }
        Insert: {
          channel_key: string
          created_at?: string
          description: string
          enabled?: boolean
          label: string
          sort_order?: number
          updated_at?: string
        }
        Update: {
          channel_key?: string
          created_at?: string
          description?: string
          enabled?: boolean
          label?: string
          sort_order?: number
          updated_at?: string
        }
        Relationships: []
      }
      publishing_content_kinds: {
        Row: {
          canonical_resource_kind: string | null
          created_at: string
          description: string
          enabled: boolean
          kind: string
          label: string
          sort_order: number
          updated_at: string
        }
        Insert: {
          canonical_resource_kind?: string | null
          created_at?: string
          description: string
          enabled?: boolean
          kind: string
          label: string
          sort_order?: number
          updated_at?: string
        }
        Update: {
          canonical_resource_kind?: string | null
          created_at?: string
          description?: string
          enabled?: boolean
          kind?: string
          label?: string
          sort_order?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "publishing_content_kinds_canonical_resource_kind_fkey"
            columns: ["canonical_resource_kind"]
            isOneToOne: false
            referencedRelation: "resource_kinds"
            referencedColumns: ["kind"]
          },
        ]
      }
      publishing_item_assignees: {
        Row: {
          assigned_by: string | null
          assignment_role: string
          created_at: string
          item_id: string
          user_id: string
        }
        Insert: {
          assigned_by?: string | null
          assignment_role: string
          created_at?: string
          item_id: string
          user_id: string
        }
        Update: {
          assigned_by?: string | null
          assignment_role?: string
          created_at?: string
          item_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "publishing_item_assignees_item_id_fkey"
            columns: ["item_id"]
            isOneToOne: false
            referencedRelation: "publishing_items"
            referencedColumns: ["id"]
          },
        ]
      }
      publishing_item_channels: {
        Row: {
          channel_key: string
          created_at: string
          created_by: string | null
          is_primary: boolean
          item_id: string
        }
        Insert: {
          channel_key: string
          created_at?: string
          created_by?: string | null
          is_primary?: boolean
          item_id: string
        }
        Update: {
          channel_key?: string
          created_at?: string
          created_by?: string | null
          is_primary?: boolean
          item_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "publishing_item_channels_channel_key_fkey"
            columns: ["channel_key"]
            isOneToOne: false
            referencedRelation: "publishing_channels"
            referencedColumns: ["channel_key"]
          },
          {
            foreignKeyName: "publishing_item_channels_item_id_fkey"
            columns: ["item_id"]
            isOneToOne: false
            referencedRelation: "publishing_items"
            referencedColumns: ["id"]
          },
        ]
      }
      publishing_item_events: {
        Row: {
          action: string
          actor_id: string | null
          created_at: string
          id: string
          item_id: string
          metadata: Json
          note: string | null
          prior_record_version: number
          prior_values: Json
          resulting_record_version: number
          resulting_values: Json
        }
        Insert: {
          action: string
          actor_id?: string | null
          created_at?: string
          id?: string
          item_id: string
          metadata?: Json
          note?: string | null
          prior_record_version: number
          prior_values?: Json
          resulting_record_version: number
          resulting_values?: Json
        }
        Update: {
          action?: string
          actor_id?: string | null
          created_at?: string
          id?: string
          item_id?: string
          metadata?: Json
          note?: string | null
          prior_record_version?: number
          prior_values?: Json
          resulting_record_version?: number
          resulting_values?: Json
        }
        Relationships: [
          {
            foreignKeyName: "publishing_item_events_item_id_fkey"
            columns: ["item_id"]
            isOneToOne: false
            referencedRelation: "publishing_items"
            referencedColumns: ["id"]
          },
        ]
      }
      publishing_items: {
        Row: {
          brief: string | null
          content_kind: string
          created_at: string
          created_by: string | null
          id: string
          owner_id: string | null
          planned_publish_at: string | null
          planning_state: string
          priority: string
          production_deadline: string | null
          production_stage: string
          record_version: number
          resource_id: string | null
          title: string
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          brief?: string | null
          content_kind: string
          created_at?: string
          created_by?: string | null
          id?: string
          owner_id?: string | null
          planned_publish_at?: string | null
          planning_state?: string
          priority?: string
          production_deadline?: string | null
          production_stage?: string
          record_version?: number
          resource_id?: string | null
          title: string
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          brief?: string | null
          content_kind?: string
          created_at?: string
          created_by?: string | null
          id?: string
          owner_id?: string | null
          planned_publish_at?: string | null
          planning_state?: string
          priority?: string
          production_deadline?: string | null
          production_stage?: string
          record_version?: number
          resource_id?: string | null
          title?: string
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "publishing_items_content_kind_fkey"
            columns: ["content_kind"]
            isOneToOne: false
            referencedRelation: "publishing_content_kinds"
            referencedColumns: ["kind"]
          },
          {
            foreignKeyName: "publishing_items_resource_id_fkey"
            columns: ["resource_id"]
            isOneToOne: false
            referencedRelation: "resources"
            referencedColumns: ["id"]
          },
        ]
      }
      registry_artist_resources: {
        Row: {
          artist_id: string
          resource_id: string
          resource_kind: string
        }
        Insert: {
          artist_id: string
          resource_id: string
          resource_kind?: string
        }
        Update: {
          artist_id?: string
          resource_id?: string
          resource_kind?: string
        }
        Relationships: [
          {
            foreignKeyName: "registry_artist_resources_resource_fkey"
            columns: ["resource_id", "resource_kind"]
            isOneToOne: false
            referencedRelation: "resources"
            referencedColumns: ["id", "resource_kind"]
          },
        ]
      }
      resource_aliases: {
        Row: {
          created_at: string
          created_by: string | null
          id: string
          is_canonical: boolean
          path: string
          redirect_status: number
          replacement_alias_id: string | null
          resource_id: string
          retired_at: string | null
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          id?: string
          is_canonical?: boolean
          path: string
          redirect_status?: number
          replacement_alias_id?: string | null
          resource_id: string
          retired_at?: string | null
        }
        Update: {
          created_at?: string
          created_by?: string | null
          id?: string
          is_canonical?: boolean
          path?: string
          redirect_status?: number
          replacement_alias_id?: string | null
          resource_id?: string
          retired_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "resource_aliases_replacement_fkey"
            columns: ["replacement_alias_id", "resource_id"]
            isOneToOne: false
            referencedRelation: "resource_aliases"
            referencedColumns: ["id", "resource_id"]
          },
          {
            foreignKeyName: "resource_aliases_resource_fkey"
            columns: ["resource_id"]
            isOneToOne: false
            referencedRelation: "resources"
            referencedColumns: ["id"]
          },
        ]
      }
      resource_citations: {
        Row: {
          citation_id: string
          citation_purpose: string
          created_at: string
          created_by: string | null
          display_order: number
          id: string
          public_safe: boolean
          resource_id: string
          resource_kind: string
          target_anchor_data: Json
          target_anchor_type: string
          target_version_id: string
          target_version_type: string
        }
        Insert: {
          citation_id: string
          citation_purpose?: string
          created_at?: string
          created_by?: string | null
          display_order?: number
          id?: string
          public_safe?: boolean
          resource_id: string
          resource_kind: string
          target_anchor_data?: Json
          target_anchor_type?: string
          target_version_id: string
          target_version_type: string
        }
        Update: {
          citation_id?: string
          citation_purpose?: string
          created_at?: string
          created_by?: string | null
          display_order?: number
          id?: string
          public_safe?: boolean
          resource_id?: string
          resource_kind?: string
          target_anchor_data?: Json
          target_anchor_type?: string
          target_version_id?: string
          target_version_type?: string
        }
        Relationships: [
          {
            foreignKeyName: "resource_citations_citation_fkey"
            columns: ["citation_id"]
            isOneToOne: false
            referencedRelation: "citations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "resource_citations_resource_fkey"
            columns: ["resource_id", "resource_kind"]
            isOneToOne: false
            referencedRelation: "resources"
            referencedColumns: ["id", "resource_kind"]
          },
        ]
      }
      resource_credits: {
        Row: {
          created_at: string
          created_by: string | null
          credit_id: string
          display_order: number
          id: string
          is_primary: boolean
          public_safe: boolean
          resource_id: string
          resource_kind: string
          target_version_id: string
          target_version_type: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          credit_id: string
          display_order?: number
          id?: string
          is_primary?: boolean
          public_safe?: boolean
          resource_id: string
          resource_kind: string
          target_version_id: string
          target_version_type: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          credit_id?: string
          display_order?: number
          id?: string
          is_primary?: boolean
          public_safe?: boolean
          resource_id?: string
          resource_kind?: string
          target_version_id?: string
          target_version_type?: string
        }
        Relationships: [
          {
            foreignKeyName: "resource_credits_credit_fkey"
            columns: ["credit_id"]
            isOneToOne: false
            referencedRelation: "credits"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "resource_credits_resource_fkey"
            columns: ["resource_id", "resource_kind"]
            isOneToOne: false
            referencedRelation: "resources"
            referencedColumns: ["id", "resource_kind"]
          },
        ]
      }
      resource_kinds: {
        Row: {
          created_at: string
          description: string
          enabled: boolean
          kind: string
          label: string
        }
        Insert: {
          created_at?: string
          description: string
          enabled?: boolean
          kind: string
          label: string
        }
        Update: {
          created_at?: string
          description?: string
          enabled?: boolean
          kind?: string
          label?: string
        }
        Relationships: []
      }
      resource_version_editorial_metadata: {
        Row: {
          created_at: string
          focus_keyword: string | null
          metadata_revision: number
          resource_id: string
          resource_kind: string
          seo_description: string | null
          seo_keywords: string[]
          seo_title: string | null
          target_version_id: string
          target_version_type: string
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          created_at?: string
          focus_keyword?: string | null
          metadata_revision?: number
          resource_id: string
          resource_kind: string
          seo_description?: string | null
          seo_keywords?: string[]
          seo_title?: string | null
          target_version_id: string
          target_version_type: string
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          created_at?: string
          focus_keyword?: string | null
          metadata_revision?: number
          resource_id?: string
          resource_kind?: string
          seo_description?: string | null
          seo_keywords?: string[]
          seo_title?: string | null
          target_version_id?: string
          target_version_type?: string
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "resource_version_editorial_metadata_resource_id_fkey"
            columns: ["resource_id"]
            isOneToOne: false
            referencedRelation: "resources"
            referencedColumns: ["id"]
          },
        ]
      }
      resource_version_taxonomy_terms: {
        Row: {
          created_at: string
          created_by: string | null
          display_order: number
          resource_id: string
          resource_kind: string
          target_version_id: string
          target_version_type: string
          taxonomy: string
          taxonomy_term_id: string
          term_name_snapshot: string
          term_slug_snapshot: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          display_order?: number
          resource_id: string
          resource_kind: string
          target_version_id: string
          target_version_type: string
          taxonomy: string
          taxonomy_term_id: string
          term_name_snapshot: string
          term_slug_snapshot: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          display_order?: number
          resource_id?: string
          resource_kind?: string
          target_version_id?: string
          target_version_type?: string
          taxonomy?: string
          taxonomy_term_id?: string
          term_name_snapshot?: string
          term_slug_snapshot?: string
        }
        Relationships: [
          {
            foreignKeyName: "resource_version_taxonomy_terms_resource_id_fkey"
            columns: ["resource_id"]
            isOneToOne: false
            referencedRelation: "resources"
            referencedColumns: ["id"]
          },
        ]
      }
      resource_version_type_kinds: {
        Row: {
          created_at: string
          resource_kind: string
          version_type: string
        }
        Insert: {
          created_at?: string
          resource_kind: string
          version_type: string
        }
        Update: {
          created_at?: string
          resource_kind?: string
          version_type?: string
        }
        Relationships: [
          {
            foreignKeyName: "resource_version_type_kinds_resource_kind_fkey"
            columns: ["resource_kind"]
            isOneToOne: false
            referencedRelation: "resource_kinds"
            referencedColumns: ["kind"]
          },
          {
            foreignKeyName: "resource_version_type_kinds_version_type_fkey"
            columns: ["version_type"]
            isOneToOne: false
            referencedRelation: "resource_version_types"
            referencedColumns: ["version_type"]
          },
        ]
      }
      resource_version_types: {
        Row: {
          created_at: string
          description: string
          enabled: boolean
          label: string
          source_table_name: string
          source_table_schema: string
          version_type: string
        }
        Insert: {
          created_at?: string
          description: string
          enabled?: boolean
          label: string
          source_table_name: string
          source_table_schema: string
          version_type: string
        }
        Update: {
          created_at?: string
          description?: string
          enabled?: boolean
          label?: string
          source_table_name?: string
          source_table_schema?: string
          version_type?: string
        }
        Relationships: []
      }
      resource_versions: {
        Row: {
          content_fingerprint: string
          created_at: string
          created_by: string | null
          id: string
          registered_at: string
          resource_id: string
          resource_kind: string
          version_kind: string
          version_number: number
          version_type: string
        }
        Insert: {
          content_fingerprint: string
          created_at: string
          created_by?: string | null
          id: string
          registered_at?: string
          resource_id: string
          resource_kind: string
          version_kind: string
          version_number: number
          version_type: string
        }
        Update: {
          content_fingerprint?: string
          created_at?: string
          created_by?: string | null
          id?: string
          registered_at?: string
          resource_id?: string
          resource_kind?: string
          version_kind?: string
          version_number?: number
          version_type?: string
        }
        Relationships: [
          {
            foreignKeyName: "resource_versions_resource_fkey"
            columns: ["resource_id", "resource_kind"]
            isOneToOne: false
            referencedRelation: "resources"
            referencedColumns: ["id", "resource_kind"]
          },
          {
            foreignKeyName: "resource_versions_type_kind_fkey"
            columns: ["version_type", "resource_kind"]
            isOneToOne: false
            referencedRelation: "resource_version_type_kinds"
            referencedColumns: ["version_type", "resource_kind"]
          },
        ]
      }
      resources: {
        Row: {
          created_at: string
          created_by: string | null
          current_approved_version_id: string | null
          current_published_version_id: string | null
          current_submitted_version_id: string | null
          current_working_version_id: string | null
          id: string
          lifecycle_state: string
          owner_id: string | null
          resource_kind: string
          updated_at: string
          visibility: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          current_approved_version_id?: string | null
          current_published_version_id?: string | null
          current_submitted_version_id?: string | null
          current_working_version_id?: string | null
          id?: string
          lifecycle_state: string
          owner_id?: string | null
          resource_kind: string
          updated_at?: string
          visibility: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          current_approved_version_id?: string | null
          current_published_version_id?: string | null
          current_submitted_version_id?: string | null
          current_working_version_id?: string | null
          id?: string
          lifecycle_state?: string
          owner_id?: string | null
          resource_kind?: string
          updated_at?: string
          visibility?: string
        }
        Relationships: [
          {
            foreignKeyName: "resources_current_approved_version_id_fkey"
            columns: ["current_approved_version_id"]
            isOneToOne: false
            referencedRelation: "article_versions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "resources_current_published_version_id_fkey"
            columns: ["current_published_version_id"]
            isOneToOne: false
            referencedRelation: "article_versions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "resources_current_submitted_version_fkey"
            columns: ["current_submitted_version_id"]
            isOneToOne: false
            referencedRelation: "article_versions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "resources_current_working_version_fkey"
            columns: ["current_working_version_id"]
            isOneToOne: false
            referencedRelation: "article_versions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "resources_resource_kind_fkey"
            columns: ["resource_kind"]
            isOneToOne: false
            referencedRelation: "resource_kinds"
            referencedColumns: ["kind"]
          },
        ]
      }
      retired_account_identities: {
        Row: {
          command_receipt_id: string
          correlation_id: string | null
          created_at: string
          identity_link_id: string
          person_resource_id: string
          reason: string
          retired_at: string
          retired_by: string | null
          user_id: string
          username_snapshot: string | null
        }
        Insert: {
          command_receipt_id: string
          correlation_id?: string | null
          created_at?: string
          identity_link_id: string
          person_resource_id: string
          reason: string
          retired_at?: string
          retired_by?: string | null
          user_id: string
          username_snapshot?: string | null
        }
        Update: {
          command_receipt_id?: string
          correlation_id?: string | null
          created_at?: string
          identity_link_id?: string
          person_resource_id?: string
          reason?: string
          retired_at?: string
          retired_by?: string | null
          user_id?: string
          username_snapshot?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "retired_account_identities_link_fkey"
            columns: ["identity_link_id"]
            isOneToOne: true
            referencedRelation: "person_identity_links"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "retired_account_identities_person_fkey"
            columns: ["person_resource_id"]
            isOneToOne: false
            referencedRelation: "people"
            referencedColumns: ["resource_id"]
          },
        ]
      }
      show_episodes: {
        Row: {
          authority_revision: number
          created_at: string
          created_by: string | null
          episode_number: number | null
          resource_id: string
          resource_kind: string
          show_resource_id: string
          slug: string
          summary: string | null
          title: string
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          authority_revision?: number
          created_at?: string
          created_by?: string | null
          episode_number?: number | null
          resource_id: string
          resource_kind?: string
          show_resource_id: string
          slug: string
          summary?: string | null
          title: string
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          authority_revision?: number
          created_at?: string
          created_by?: string | null
          episode_number?: number | null
          resource_id?: string
          resource_kind?: string
          show_resource_id?: string
          slug?: string
          summary?: string | null
          title?: string
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "show_episodes_resource_fkey"
            columns: ["resource_id", "resource_kind"]
            isOneToOne: false
            referencedRelation: "resources"
            referencedColumns: ["id", "resource_kind"]
          },
          {
            foreignKeyName: "show_episodes_show_resource_id_fkey"
            columns: ["show_resource_id"]
            isOneToOne: false
            referencedRelation: "shows"
            referencedColumns: ["resource_id"]
          },
        ]
      }
      shows: {
        Row: {
          authority_revision: number
          created_at: string
          created_by: string | null
          description: string | null
          resource_id: string
          resource_kind: string
          slug: string
          title: string
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          authority_revision?: number
          created_at?: string
          created_by?: string | null
          description?: string | null
          resource_id: string
          resource_kind?: string
          slug: string
          title: string
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          authority_revision?: number
          created_at?: string
          created_by?: string | null
          description?: string | null
          resource_id?: string
          resource_kind?: string
          slug?: string
          title?: string
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "shows_resource_fkey"
            columns: ["resource_id", "resource_kind"]
            isOneToOne: false
            referencedRelation: "resources"
            referencedColumns: ["id", "resource_kind"]
          },
        ]
      }
      source_registry_links: {
        Row: {
          created_at: string
          created_by: string | null
          registry_entity_id: string
          registry_entity_type: string
          relationship_role: string
          source_id: string
          source_version_id: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          registry_entity_id: string
          registry_entity_type: string
          relationship_role?: string
          source_id: string
          source_version_id: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          registry_entity_id?: string
          registry_entity_type?: string
          relationship_role?: string
          source_id?: string
          source_version_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "source_registry_links_source_fkey"
            columns: ["source_id"]
            isOneToOne: false
            referencedRelation: "sources"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "source_registry_links_source_version_fkey"
            columns: ["source_version_id"]
            isOneToOne: false
            referencedRelation: "source_versions"
            referencedColumns: ["id"]
          },
        ]
      }
      source_review_events: {
        Row: {
          action: string
          actor_id: string | null
          correlation_id: string | null
          created_at: string
          id: string
          prior_exposure_class: string | null
          prior_review_status: string | null
          prior_source_state: string | null
          reason: string | null
          resulting_exposure_class: string | null
          resulting_review_status: string | null
          resulting_source_state: string | null
          source_id: string
          source_version_id: string | null
        }
        Insert: {
          action: string
          actor_id?: string | null
          correlation_id?: string | null
          created_at?: string
          id?: string
          prior_exposure_class?: string | null
          prior_review_status?: string | null
          prior_source_state?: string | null
          reason?: string | null
          resulting_exposure_class?: string | null
          resulting_review_status?: string | null
          resulting_source_state?: string | null
          source_id: string
          source_version_id?: string | null
        }
        Update: {
          action?: string
          actor_id?: string | null
          correlation_id?: string | null
          created_at?: string
          id?: string
          prior_exposure_class?: string | null
          prior_review_status?: string | null
          prior_source_state?: string | null
          reason?: string | null
          resulting_exposure_class?: string | null
          resulting_review_status?: string | null
          resulting_source_state?: string | null
          source_id?: string
          source_version_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "source_review_events_source_id_fkey"
            columns: ["source_id"]
            isOneToOne: false
            referencedRelation: "sources"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "source_review_events_source_version_id_fkey"
            columns: ["source_version_id"]
            isOneToOne: false
            referencedRelation: "source_versions"
            referencedColumns: ["id"]
          },
        ]
      }
      source_types: {
        Row: {
          created_at: string
          description: string
          enabled: boolean
          label: string
          sort_order: number
          source_type: string
        }
        Insert: {
          created_at?: string
          description: string
          enabled?: boolean
          label: string
          sort_order?: number
          source_type: string
        }
        Update: {
          created_at?: string
          description?: string
          enabled?: boolean
          label?: string
          sort_order?: number
          source_type?: string
        }
        Relationships: []
      }
      source_versions: {
        Row: {
          archive_identifier: string | null
          capture_date: string | null
          consent_status: string
          content_fingerprint: string
          country_code: string | null
          created_at: string
          created_by: string | null
          creator_display: string | null
          credit_line: string | null
          id: string
          internal_notes: string | null
          language_code: string | null
          media_asset_id: string | null
          place_text: string | null
          publication_date: string | null
          publisher_display: string | null
          reliability_note: string | null
          retrieval_date: string | null
          rights_status: string
          sensitivity: string
          source_id: string
          source_type: string
          source_url: string | null
          title: string
          version_number: number
        }
        Insert: {
          archive_identifier?: string | null
          capture_date?: string | null
          consent_status: string
          content_fingerprint: string
          country_code?: string | null
          created_at?: string
          created_by?: string | null
          creator_display?: string | null
          credit_line?: string | null
          id?: string
          internal_notes?: string | null
          language_code?: string | null
          media_asset_id?: string | null
          place_text?: string | null
          publication_date?: string | null
          publisher_display?: string | null
          reliability_note?: string | null
          retrieval_date?: string | null
          rights_status: string
          sensitivity: string
          source_id: string
          source_type: string
          source_url?: string | null
          title: string
          version_number: number
        }
        Update: {
          archive_identifier?: string | null
          capture_date?: string | null
          consent_status?: string
          content_fingerprint?: string
          country_code?: string | null
          created_at?: string
          created_by?: string | null
          creator_display?: string | null
          credit_line?: string | null
          id?: string
          internal_notes?: string | null
          language_code?: string | null
          media_asset_id?: string | null
          place_text?: string | null
          publication_date?: string | null
          publisher_display?: string | null
          reliability_note?: string | null
          retrieval_date?: string | null
          rights_status?: string
          sensitivity?: string
          source_id?: string
          source_type?: string
          source_url?: string | null
          title?: string
          version_number?: number
        }
        Relationships: [
          {
            foreignKeyName: "source_versions_source_id_fkey"
            columns: ["source_id"]
            isOneToOne: false
            referencedRelation: "sources"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "source_versions_source_type_fkey"
            columns: ["source_type"]
            isOneToOne: false
            referencedRelation: "source_types"
            referencedColumns: ["source_type"]
          },
        ]
      }
      sources: {
        Row: {
          archive_identifier: string | null
          capture_date: string | null
          consent_status: string
          country_code: string | null
          created_at: string
          created_by: string | null
          creator_display: string | null
          credit_line: string | null
          current_approved_version_id: string | null
          current_submitted_version_id: string | null
          current_working_version_id: string | null
          exposure_class: string
          id: string
          internal_notes: string | null
          language_code: string | null
          media_asset_id: string | null
          place_text: string | null
          publication_date: string | null
          publisher_display: string | null
          reliability_note: string | null
          retrieval_date: string | null
          review_status: string
          reviewed_at: string | null
          reviewed_by: string | null
          rights_status: string
          sensitivity: string
          source_state: string
          source_type: string
          source_url: string | null
          title: string
          updated_at: string
          updated_by: string | null
          withdrawal_public_mode: string
          withdrawal_reason: string | null
          withdrawn_at: string | null
          withdrawn_by: string | null
          working_revision: number
        }
        Insert: {
          archive_identifier?: string | null
          capture_date?: string | null
          consent_status?: string
          country_code?: string | null
          created_at?: string
          created_by?: string | null
          creator_display?: string | null
          credit_line?: string | null
          current_approved_version_id?: string | null
          current_submitted_version_id?: string | null
          current_working_version_id?: string | null
          exposure_class?: string
          id?: string
          internal_notes?: string | null
          language_code?: string | null
          media_asset_id?: string | null
          place_text?: string | null
          publication_date?: string | null
          publisher_display?: string | null
          reliability_note?: string | null
          retrieval_date?: string | null
          review_status?: string
          reviewed_at?: string | null
          reviewed_by?: string | null
          rights_status?: string
          sensitivity?: string
          source_state?: string
          source_type: string
          source_url?: string | null
          title: string
          updated_at?: string
          updated_by?: string | null
          withdrawal_public_mode?: string
          withdrawal_reason?: string | null
          withdrawn_at?: string | null
          withdrawn_by?: string | null
          working_revision?: number
        }
        Update: {
          archive_identifier?: string | null
          capture_date?: string | null
          consent_status?: string
          country_code?: string | null
          created_at?: string
          created_by?: string | null
          creator_display?: string | null
          credit_line?: string | null
          current_approved_version_id?: string | null
          current_submitted_version_id?: string | null
          current_working_version_id?: string | null
          exposure_class?: string
          id?: string
          internal_notes?: string | null
          language_code?: string | null
          media_asset_id?: string | null
          place_text?: string | null
          publication_date?: string | null
          publisher_display?: string | null
          reliability_note?: string | null
          retrieval_date?: string | null
          review_status?: string
          reviewed_at?: string | null
          reviewed_by?: string | null
          rights_status?: string
          sensitivity?: string
          source_state?: string
          source_type?: string
          source_url?: string | null
          title?: string
          updated_at?: string
          updated_by?: string | null
          withdrawal_public_mode?: string
          withdrawal_reason?: string | null
          withdrawn_at?: string | null
          withdrawn_by?: string | null
          working_revision?: number
        }
        Relationships: [
          {
            foreignKeyName: "sources_current_approved_version_fkey"
            columns: ["current_approved_version_id"]
            isOneToOne: false
            referencedRelation: "source_versions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sources_current_submitted_version_fkey"
            columns: ["current_submitted_version_id"]
            isOneToOne: false
            referencedRelation: "source_versions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sources_current_working_version_fkey"
            columns: ["current_working_version_id"]
            isOneToOne: false
            referencedRelation: "source_versions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sources_source_type_fkey"
            columns: ["source_type"]
            isOneToOne: false
            referencedRelation: "source_types"
            referencedColumns: ["source_type"]
          },
        ]
      }
      track_lyrics_contributions: {
        Row: {
          acceptance_mode: string | null
          accepted_version_id: string | null
          contribution_kind: string
          contributor_id: string | null
          created_at: string
          id: string
          language_code: string
          lines: Json
          plain_text: string
          review_note: string | null
          reviewed_at: string | null
          reviewed_by: string | null
          source_description: string | null
          status: string
          timing_mode: string
          track_id: string
        }
        Insert: {
          acceptance_mode?: string | null
          accepted_version_id?: string | null
          contribution_kind?: string
          contributor_id?: string | null
          created_at?: string
          id?: string
          language_code?: string
          lines: Json
          plain_text: string
          review_note?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          source_description?: string | null
          status?: string
          timing_mode?: string
          track_id: string
        }
        Update: {
          acceptance_mode?: string | null
          accepted_version_id?: string | null
          contribution_kind?: string
          contributor_id?: string | null
          created_at?: string
          id?: string
          language_code?: string
          lines?: Json
          plain_text?: string
          review_note?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          source_description?: string | null
          status?: string
          timing_mode?: string
          track_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "track_lyrics_contributions_accepted_version_id_fkey"
            columns: ["accepted_version_id"]
            isOneToOne: false
            referencedRelation: "track_lyrics_versions"
            referencedColumns: ["id"]
          },
        ]
      }
      track_lyrics_documents: {
        Row: {
          authority_revision: number
          created_at: string
          current_published_version_id: string | null
          current_working_version_id: string | null
          track_id: string
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          authority_revision?: number
          created_at?: string
          current_published_version_id?: string | null
          current_working_version_id?: string | null
          track_id: string
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          authority_revision?: number
          created_at?: string
          current_published_version_id?: string | null
          current_working_version_id?: string | null
          track_id?: string
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "track_lyrics_documents_published_fkey"
            columns: ["current_published_version_id", "track_id"]
            isOneToOne: false
            referencedRelation: "track_lyrics_versions"
            referencedColumns: ["id", "track_id"]
          },
          {
            foreignKeyName: "track_lyrics_documents_working_fkey"
            columns: ["current_working_version_id", "track_id"]
            isOneToOne: false
            referencedRelation: "track_lyrics_versions"
            referencedColumns: ["id", "track_id"]
          },
        ]
      }
      track_lyrics_versions: {
        Row: {
          community_revision_mode: string | null
          created_at: string
          created_by: string | null
          id: string
          language_code: string
          lines: Json
          plain_text: string
          rights_note: string | null
          source_contribution_id: string | null
          source_contributor_id: string | null
          source_contributor_label: string | null
          source_kind: string
          timing_mode: string
          track_id: string
          version_number: number
        }
        Insert: {
          community_revision_mode?: string | null
          created_at?: string
          created_by?: string | null
          id?: string
          language_code?: string
          lines: Json
          plain_text: string
          rights_note?: string | null
          source_contribution_id?: string | null
          source_contributor_id?: string | null
          source_contributor_label?: string | null
          source_kind?: string
          timing_mode?: string
          track_id: string
          version_number: number
        }
        Update: {
          community_revision_mode?: string | null
          created_at?: string
          created_by?: string | null
          id?: string
          language_code?: string
          lines?: Json
          plain_text?: string
          rights_note?: string | null
          source_contribution_id?: string | null
          source_contributor_id?: string | null
          source_contributor_label?: string | null
          source_kind?: string
          timing_mode?: string
          track_id?: string
          version_number?: number
        }
        Relationships: [
          {
            foreignKeyName: "track_lyrics_versions_source_contribution_fkey"
            columns: ["source_contribution_id"]
            isOneToOne: false
            referencedRelation: "track_lyrics_contributions"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      allocate_person_path: {
        Args: { p_person_resource_id: string; p_seed: string }
        Returns: string
      }
      append_playlist_lifecycle_event: {
        Args: {
          p_action: string
          p_actor_id: string
          p_command_receipt_id: string
          p_metadata?: Json
          p_note: string
          p_playlist_id: string
          p_prior_status: string
          p_resource_id: string
          p_resulting_status: string
          p_version_id: string
        }
        Returns: string
      }
      apply_article_review_snapshot: {
        Args: {
          p_article_id: string
          p_content_html: string
          p_expected_draft_version: number
          p_resource_id: string
        }
        Returns: {
          article_id: string
          article_slug: string
          draft_version: number
          version_id: string
          version_number: number
        }[]
      }
      article_snapshot_fingerprint: {
        Args: {
          p_author_display: string
          p_categories: Json
          p_content_html: string
          p_excerpt: string
          p_hero_image_id: string
          p_hero_image_url: string
          p_published_at: string
          p_seo: Json
          p_slug: string
          p_tags: Json
          p_title: string
          p_wp_status: string
        }
        Returns: string
      }
      artist_music_submission_review_due_at: {
        Args: { p_submitted_at: string }
        Returns: string
      }
      artist_representation_defaults: {
        Args: { p_role: string }
        Returns: {
          can_manage_profile: boolean
          can_manage_team: boolean
          can_post_updates: boolean
          can_submit_releases: boolean
        }[]
      }
      assert_citation_command_actor: { Args: never; Returns: string }
      assert_credit_command_actor: { Args: never; Returns: string }
      assert_playlist_curator_credit: {
        Args: { p_credit_id: string }
        Returns: {
          credit_id: string
          display_name: string
          registry_author_slug: string
          user_username: string
        }[]
      }
      assert_source_command_actor: {
        Args: { p_capability: string }
        Returns: string
      }
      copy_article_lifecycle_version: {
        Args: {
          p_lifecycle_state: string
          p_published_at?: string
          p_source_version_id: string
          p_version_kind: string
          p_wp_status: string
        }
        Returns: {
          version_id: string
          version_number: number
        }[]
      }
      copy_audio_version_trust_to_version: {
        Args: { p_source_version_id: string; p_target_version_id: string }
        Returns: undefined
      }
      copy_playlist_lifecycle_version: {
        Args: {
          p_actor_id: string
          p_source_version_id: string
          p_target_version_kind: string
        }
        Returns: {
          content_fingerprint: string
          item_count: number
          version_id: string
          version_number: number
        }[]
      }
      copy_playlist_published_version: {
        Args: { p_actor_id: string; p_source_version_id: string }
        Returns: {
          content_fingerprint: string
          item_count: number
          version_id: string
          version_number: number
        }[]
      }
      copy_playlist_version_snapshot: {
        Args: { p_actor_id: string; p_source_version_id: string }
        Returns: {
          content_fingerprint: string
          item_count: number
          version_id: string
          version_number: number
        }[]
      }
      copy_playlist_working_trust_to_version: {
        Args: {
          p_resource_id: string
          p_source_working_version_id: string
          p_target_version_id: string
        }
        Returns: undefined
      }
      copy_playlist_working_trust_to_working_successor: {
        Args: {
          p_resource_id: string
          p_source_working_version_id: string
          p_target_working_version_id: string
        }
        Returns: undefined
      }
      copy_resource_version_editorial_metadata: {
        Args: {
          p_actor_id: string
          p_source_version_id: string
          p_source_version_type: string
          p_target_version_id: string
          p_target_version_type: string
        }
        Returns: undefined
      }
      correction_article_publication_proof: {
        Args: { p_application_id: string }
        Returns: {
          affected_resource_id: string
          application_id: string
          application_resulting_version_id: string
          article_id: string
          article_slug: string
          case_resource_id: string
          challenged_version_id: string
          content_fingerprint: string
          corrected_version_id: string
        }[]
      }
      correction_public_note_fingerprint: {
        Args: {
          p_affected_resource_id: string
          p_application_id: string
          p_case_resource_id: string
          p_challenged_version_id: string
          p_corrected_version_id: string
          p_note_text: string
        }
        Returns: string
      }
      create_person_for_identity: {
        Args: {
          p_external_contributor_id: string
          p_link_method: string
          p_link_reason: string
          p_registry_author_id: string
          p_user_id: string
        }
        Returns: string
      }
      current_artist_representation: {
        Args: { p_artist_id: string }
        Returns: Database["public"]["Tables"]["artist_representations"]["Row"]
        SetofOptions: {
          from: "*"
          to: "artist_representations"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      current_person_post_actor: { Args: never; Returns: string }
      current_user_can_apply_correction: {
        Args: { p_case_resource_id: string }
        Returns: boolean
      }
      current_user_can_decide_correction: {
        Args: { p_case_resource_id: string }
        Returns: boolean
      }
      current_user_can_edit_article: {
        Args: { p_resource_id: string }
        Returns: boolean
      }
      current_user_can_edit_audio: {
        Args: { p_resource_id: string }
        Returns: boolean
      }
      current_user_can_edit_playlist: {
        Args: { p_resource_id: string }
        Returns: boolean
      }
      current_user_can_investigate_correction: {
        Args: { p_case_resource_id: string }
        Returns: boolean
      }
      current_user_can_manage_personal_playlist: {
        Args: { p_include_archived?: boolean; p_playlist_id: string }
        Returns: boolean
      }
      current_user_can_manage_publishing: { Args: never; Returns: boolean }
      current_user_can_participate_article_review: {
        Args: { p_resource_id: string }
        Returns: boolean
      }
      current_user_can_participate_audio_review: {
        Args: { p_resource_id: string }
        Returns: boolean
      }
      current_user_can_participate_playlist_review: {
        Args: { p_resource_id: string }
        Returns: boolean
      }
      current_user_can_publish_article: { Args: never; Returns: boolean }
      current_user_can_publish_audio: {
        Args: { p_resource_id: string }
        Returns: boolean
      }
      current_user_can_publish_correction_note: {
        Args: { p_case_resource_id: string }
        Returns: boolean
      }
      current_user_can_publish_playlist: {
        Args: { p_resource_id: string }
        Returns: boolean
      }
      current_user_can_review_article: { Args: never; Returns: boolean }
      current_user_can_review_artist_claims: { Args: never; Returns: boolean }
      current_user_can_triage_correction: {
        Args: { p_case_resource_id: string }
        Returns: boolean
      }
      current_user_can_use_credit_identity: { Args: never; Returns: boolean }
      current_user_can_view_audio: {
        Args: { p_resource_id: string }
        Returns: boolean
      }
      current_user_can_view_correction: {
        Args: { p_case_resource_id: string }
        Returns: boolean
      }
      current_user_can_view_playlist: {
        Args: { p_resource_id: string }
        Returns: boolean
      }
      current_user_can_view_playlist_id: {
        Args: { p_playlist_id: string }
        Returns: boolean
      }
      current_user_can_view_publishing_item: {
        Args: { p_item_id: string }
        Returns: boolean
      }
      current_user_owns_personal_playlist: {
        Args: { p_include_archived?: boolean; p_playlist_id: string }
        Returns: boolean
      }
      derive_publishing_editorial_state: {
        Args: { p_resource_id: string }
        Returns: string
      }
      derive_publishing_publication_state: {
        Args: { p_item_id: string }
        Returns: string
      }
      discovery_fingerprint_fragment: {
        Args: { p_discovery: Json }
        Returns: Json
      }
      ensure_article_resource_identity: {
        Args: { p_article_id: string; p_owner_id?: string }
        Returns: string
      }
      ensure_audio_episode_shared_identity: {
        Args: { p_audio_publication_id: string }
        Returns: string
      }
      ensure_audio_show_shared_identity: {
        Args: { p_audio_show_id: string }
        Returns: string
      }
      ensure_person_for_external_contributor: {
        Args: { p_external_contributor_id: string }
        Returns: string
      }
      ensure_person_for_registry_author: {
        Args: { p_registry_author_id: string }
        Returns: string
      }
      ensure_person_for_user: { Args: { p_user_id: string }; Returns: string }
      ensure_playlist_registry_intake_item: {
        Args: { p_suggestion_id: string }
        Returns: string
      }
      insert_article_lifecycle_version_from_article: {
        Args: {
          p_article: Database["public"]["Tables"]["wk_articles"]["Row"]
          p_lifecycle_state: string
          p_resource: Database["editorial"]["Tables"]["resources"]["Row"]
          p_version_kind: string
        }
        Returns: {
          version_id: string
          version_number: number
        }[]
      }
      insert_playlist_current_snapshot: {
        Args: {
          p_actor_id: string
          p_expected_authority_revision: number
          p_playlist_id: string
          p_snapshot_status: string
          p_version_kind: string
        }
        Returns: {
          content_fingerprint: string
          item_count: number
          version_id: string
          version_number: number
        }[]
      }
      insert_source_registry_links: {
        Args: {
          p_actor_id: string
          p_registry_links: Json
          p_source_id: string
          p_source_version_id: string
        }
        Returns: undefined
      }
      list_current_public_person_work: {
        Args: { p_person_resource_id: string }
        Returns: {
          canonical_path: string
          image_url: string
          is_primary: boolean
          published_at: string
          resource_id: string
          resource_kind: string
          roles: Json
          summary: string
          title: string
        }[]
      }
      materialize_playlist_publication_snapshot: {
        Args: {
          p_command_receipt_id: string
          p_published_at: string
          p_published_by: string
          p_version_id: string
        }
        Returns: string
      }
      next_article_version_number: {
        Args: { p_resource_id: string }
        Returns: number
      }
      next_playlist_position_with_registry_intake: {
        Args: { p_exclude_item_id?: string; p_playlist_id: string }
        Returns: number
      }
      normalize_person_slug: { Args: { p_seed: string }; Returns: string }
      normalize_source_metadata: { Args: { p_metadata: Json }; Returns: Json }
      normalize_source_registry_links: {
        Args: { p_registry_links: Json }
        Returns: Json
      }
      normalize_track_lyrics_payload: {
        Args: { p_lines: Json; p_timing_mode: string }
        Returns: Json
      }
      personal_playlist_command_context: {
        Args: { p_include_archived?: boolean; p_playlist_id: string }
        Returns: {
          actor_id: string
          authority_revision: number
          lifecycle_state: string
          owner_id: string
          playlist_status: string
          resource_id: string
          visibility: string
        }[]
      }
      personal_playlist_is_public: {
        Args: { p_playlist_id: string }
        Returns: boolean
      }
      personal_playlist_payload: {
        Args: { p_playlist_id: string; p_public_view?: boolean }
        Returns: Json
      }
      playlist_current_content_fingerprint: {
        Args: { p_playlist_id: string }
        Returns: string
      }
      playlist_duplicate_item_ids: {
        Args: {
          p_artist_names: string[]
          p_exclude_item_id: string
          p_playlist_id: string
          p_provider_key: string
          p_provider_track_id: string
          p_registry_track_id: string
          p_title: string
        }
        Returns: string[]
      }
      playlist_version_content_fingerprint_with_discovery: {
        Args: { p_discovery: Json; p_version_id: string }
        Returns: string
      }
      playlist_version_public_presentation_json: {
        Args: { p_version_id: string }
        Returns: Json
      }
      playlist_version_snapshot_json: {
        Args: { p_version_id: string }
        Returns: Json
      }
      playlist_working_trust_target: {
        Args: { p_playlist_version_id: string; p_target_resource_id: string }
        Returns: {
          playlist_id: string
          root_resource_id: string
          target_resource_kind: string
        }[]
      }
      publish_article_snapshot: {
        Args: {
          p_material_update?: boolean
          p_published_at: string
          p_version_id: string
        }
        Returns: string
      }
      publishing_item_snapshot: {
        Args: {
          p_item: Database["editorial"]["Tables"]["publishing_items"]["Row"]
        }
        Returns: Json
      }
      record_artist_representation_event: {
        Args: {
          p_artist_id: string
          p_claim_id?: string
          p_event_type: string
          p_metadata?: Json
          p_representation_id?: string
          p_subject_user_id?: string
        }
        Returns: string
      }
      refresh_person_visibility: {
        Args: { p_person_resource_id: string }
        Returns: undefined
      }
      refresh_registry_artist_username_reservations: {
        Args: never
        Returns: Json
      }
      register_resource_version: {
        Args: {
          p_content_fingerprint: string
          p_created_at: string
          p_created_by: string
          p_resource_id: string
          p_version_id: string
          p_version_kind: string
          p_version_number: number
          p_version_type: string
        }
        Returns: string
      }
      resequence_playlist_with_registry_intake: {
        Args: { p_playlist_id: string }
        Returns: undefined
      }
      resolve_credit_organization: {
        Args: { p_credit_id: string }
        Returns: string
      }
      resolve_credit_person: { Args: { p_credit_id: string }; Returns: string }
      resolve_person_follow_target: {
        Args: { p_person_resource_id: string }
        Returns: {
          canonical_path: string
          followable: boolean
          person_resource_id: string
        }[]
      }
      resolve_person_presentation: {
        Args: { p_person_resource_id: string }
        Returns: Json
      }
      resolve_playlist_curator_credit: {
        Args: {
          p_actor_id: string
          p_registry_author_id: string
          p_user_id: string
        }
        Returns: {
          credit_id: string
          display_name: string
          registry_author_slug: string
          user_username: string
        }[]
      }
      resolve_resource_version_identity: {
        Args: { p_target_version_id: string; p_target_version_type: string }
        Returns: {
          resource_id: string
          resource_kind: string
          version_kind: string
        }[]
      }
      resource_version_discovery_content_json: {
        Args: { p_target_version_id: string; p_target_version_type: string }
        Returns: Json
      }
      resource_version_editorial_metadata_json: {
        Args: { p_target_version_id: string; p_target_version_type: string }
        Returns: Json
      }
      seed_registry_track_intake_provider_observations: {
        Args: { p_suggestion_id: string }
        Returns: undefined
      }
      source_content_fingerprint: {
        Args: { p_metadata: Json; p_registry_links: Json }
        Returns: string
      }
      source_snapshot_fingerprint: {
        Args: {
          p_archive_identifier: string
          p_capture_date: string
          p_consent_status: string
          p_country_code: string
          p_creator_display: string
          p_credit_line: string
          p_internal_notes: string
          p_language_code: string
          p_media_asset_id: string
          p_place_text: string
          p_publication_date: string
          p_publisher_display: string
          p_reliability_note: string
          p_retrieval_date: string
          p_rights_status: string
          p_sensitivity: string
          p_source_type: string
          p_source_url: string
          p_title: string
        }
        Returns: string
      }
      sync_account_person_handle: {
        Args: { p_user_id: string }
        Returns: string
      }
      sync_artist_portal_roles: {
        Args: { p_user_id: string }
        Returns: undefined
      }
      username_is_registry_artist_reserved: {
        Args: { p_username: string }
        Returns: boolean
      }
      validate_citation_locator: {
        Args: { p_locator_data: Json; p_locator_type: string }
        Returns: undefined
      }
      validate_citation_target_anchor: {
        Args: { p_anchor_data: Json; p_anchor_type: string }
        Returns: undefined
      }
      validate_correction_case_history: {
        Args: { p_case_resource_id: string }
        Returns: undefined
      }
    }
    Enums: {
      [_ in never]: never
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
  public: {
    Tables: {
      admin_account_recovery_events: {
        Row: {
          created_at: string
          delivery_status: string
          id: string
          message: string | null
          metadata: Json
          recovery_type: string
          redirect_to: string | null
          requested_by: string | null
          target_email: string
          target_user_id: string | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          delivery_status?: string
          id?: string
          message?: string | null
          metadata?: Json
          recovery_type?: string
          redirect_to?: string | null
          requested_by?: string | null
          target_email: string
          target_user_id?: string | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          delivery_status?: string
          id?: string
          message?: string | null
          metadata?: Json
          recovery_type?: string
          redirect_to?: string | null
          requested_by?: string | null
          target_email?: string
          target_user_id?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      admin_audit_events: {
        Row: {
          actor_user_id: string | null
          created_at: string
          event_type: string
          id: string
          message: string | null
          metadata: Json
          target_record_id: string | null
          target_table: string | null
          target_user_id: string | null
        }
        Insert: {
          actor_user_id?: string | null
          created_at?: string
          event_type: string
          id?: string
          message?: string | null
          metadata?: Json
          target_record_id?: string | null
          target_table?: string | null
          target_user_id?: string | null
        }
        Update: {
          actor_user_id?: string | null
          created_at?: string
          event_type?: string
          id?: string
          message?: string | null
          metadata?: Json
          target_record_id?: string | null
          target_table?: string | null
          target_user_id?: string | null
        }
        Relationships: []
      }
      admin_settings_secrets: {
        Row: {
          metadata: Json | null
          setting_key: string
          setting_value: string
          updated_at: string | null
          updated_by: string | null
        }
        Insert: {
          metadata?: Json | null
          setting_key: string
          setting_value: string
          updated_at?: string | null
          updated_by?: string | null
        }
        Update: {
          metadata?: Json | null
          setting_key?: string
          setting_value?: string
          updated_at?: string | null
          updated_by?: string | null
        }
        Relationships: []
      }
      admin_user_invites: {
        Row: {
          accepted_at: string | null
          created_at: string
          display_name: string | null
          email: string
          id: string
          invite_redirect_to: string | null
          invite_status: string
          invited_by: string | null
          invited_user_id: string | null
          metadata: Json
          notes: string | null
          role_key: string
          updated_at: string
        }
        Insert: {
          accepted_at?: string | null
          created_at?: string
          display_name?: string | null
          email: string
          id?: string
          invite_redirect_to?: string | null
          invite_status?: string
          invited_by?: string | null
          invited_user_id?: string | null
          metadata?: Json
          notes?: string | null
          role_key: string
          updated_at?: string
        }
        Update: {
          accepted_at?: string | null
          created_at?: string
          display_name?: string | null
          email?: string
          id?: string
          invite_redirect_to?: string | null
          invite_status?: string
          invited_by?: string | null
          invited_user_id?: string | null
          metadata?: Json
          notes?: string | null
          role_key?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "admin_user_invites_role_key_fkey"
            columns: ["role_key"]
            isOneToOne: false
            referencedRelation: "role_definitions"
            referencedColumns: ["role_key"]
          },
        ]
      }
      ai_run_sources: {
        Row: {
          ai_run_id: string
          created_at: string
          excerpt: string | null
          id: string
          metadata: Json
          retrieval_rank: number | null
          similarity_score: number | null
          source_id: string | null
          source_ref: string | null
          source_table: string | null
          source_title: string | null
          source_type: string
          used_in_prompt: boolean
        }
        Insert: {
          ai_run_id: string
          created_at?: string
          excerpt?: string | null
          id?: string
          metadata?: Json
          retrieval_rank?: number | null
          similarity_score?: number | null
          source_id?: string | null
          source_ref?: string | null
          source_table?: string | null
          source_title?: string | null
          source_type: string
          used_in_prompt?: boolean
        }
        Update: {
          ai_run_id?: string
          created_at?: string
          excerpt?: string | null
          id?: string
          metadata?: Json
          retrieval_rank?: number | null
          similarity_score?: number | null
          source_id?: string | null
          source_ref?: string | null
          source_table?: string | null
          source_title?: string | null
          source_type?: string
          used_in_prompt?: boolean
        }
        Relationships: [
          {
            foreignKeyName: "ai_run_sources_ai_run_id_fkey"
            columns: ["ai_run_id"]
            isOneToOne: false
            referencedRelation: "ai_runs"
            referencedColumns: ["id"]
          },
        ]
      }
      ai_runs: {
        Row: {
          completed_at: string | null
          cost_estimate_usd: number | null
          created_at: string
          created_by: string | null
          entity_id: string | null
          error_message: string | null
          id: string
          inference_profile_id: string | null
          input_json: Json
          input_summary: string
          inquiry_id: string | null
          model_id: string
          model_key_snapshot: string
          output_json: Json
          output_text: string | null
          prompt_recipe_id: string | null
          prompt_version_id: string | null
          prompt_version_name_snapshot: string | null
          provider_id: string
          provider_key_snapshot: string
          requires_human_review: boolean
          review_status: string
          run_type: string
          started_at: string | null
          status: string
          token_input_count: number | null
          token_output_count: number | null
        }
        Insert: {
          completed_at?: string | null
          cost_estimate_usd?: number | null
          created_at?: string
          created_by?: string | null
          entity_id?: string | null
          error_message?: string | null
          id?: string
          inference_profile_id?: string | null
          input_json?: Json
          input_summary: string
          inquiry_id?: string | null
          model_id: string
          model_key_snapshot: string
          output_json?: Json
          output_text?: string | null
          prompt_recipe_id?: string | null
          prompt_version_id?: string | null
          prompt_version_name_snapshot?: string | null
          provider_id: string
          provider_key_snapshot: string
          requires_human_review?: boolean
          review_status?: string
          run_type: string
          started_at?: string | null
          status?: string
          token_input_count?: number | null
          token_output_count?: number | null
        }
        Update: {
          completed_at?: string | null
          cost_estimate_usd?: number | null
          created_at?: string
          created_by?: string | null
          entity_id?: string | null
          error_message?: string | null
          id?: string
          inference_profile_id?: string | null
          input_json?: Json
          input_summary?: string
          inquiry_id?: string | null
          model_id?: string
          model_key_snapshot?: string
          output_json?: Json
          output_text?: string | null
          prompt_recipe_id?: string | null
          prompt_version_id?: string | null
          prompt_version_name_snapshot?: string | null
          provider_id?: string
          provider_key_snapshot?: string
          requires_human_review?: boolean
          review_status?: string
          run_type?: string
          started_at?: string | null
          status?: string
          token_input_count?: number | null
          token_output_count?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "ai_runs_entity_id_fkey"
            columns: ["entity_id"]
            isOneToOne: false
            referencedRelation: "cultural_entities"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ai_runs_inference_profile_id_fkey"
            columns: ["inference_profile_id"]
            isOneToOne: false
            referencedRelation: "inference_profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ai_runs_inquiry_id_fkey"
            columns: ["inquiry_id"]
            isOneToOne: false
            referencedRelation: "inquiries"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ai_runs_inquiry_id_fkey"
            columns: ["inquiry_id"]
            isOneToOne: false
            referencedRelation: "institute_admin_inquiry_evidence"
            referencedColumns: ["inquiry_id"]
          },
          {
            foreignKeyName: "ai_runs_model_id_fkey"
            columns: ["model_id"]
            isOneToOne: false
            referencedRelation: "model_registry"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ai_runs_prompt_recipe_id_fkey"
            columns: ["prompt_recipe_id"]
            isOneToOne: false
            referencedRelation: "prompt_recipes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ai_runs_prompt_version_id_fkey"
            columns: ["prompt_version_id"]
            isOneToOne: false
            referencedRelation: "prompt_versions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ai_runs_provider_id_fkey"
            columns: ["provider_id"]
            isOneToOne: false
            referencedRelation: "model_providers"
            referencedColumns: ["id"]
          },
        ]
      }
      airplay_detections: {
        Row: {
          acr_track_id: string | null
          artist: string | null
          canonical_track_id: string | null
          confidence: number | null
          created_at: string
          detected_at: string
          id: string
          normalized_key: string | null
          played_duration_seconds: number
          raw_payload_json: Json
          source_id: string
          title: string | null
        }
        Insert: {
          acr_track_id?: string | null
          artist?: string | null
          canonical_track_id?: string | null
          confidence?: number | null
          created_at?: string
          detected_at: string
          id?: string
          normalized_key?: string | null
          played_duration_seconds?: number
          raw_payload_json?: Json
          source_id: string
          title?: string | null
        }
        Update: {
          acr_track_id?: string | null
          artist?: string | null
          canonical_track_id?: string | null
          confidence?: number | null
          created_at?: string
          detected_at?: string
          id?: string
          normalized_key?: string | null
          played_duration_seconds?: number
          raw_payload_json?: Json
          source_id?: string
          title?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "airplay_detections_source_id_fkey"
            columns: ["source_id"]
            isOneToOne: false
            referencedRelation: "airplay_sources"
            referencedColumns: ["id"]
          },
        ]
      }
      airplay_evidence_weekly: {
        Row: {
          canonical_track_id: string | null
          created_at: string
          detection_count: number
          edition_date: string
          id: string
          last_detected_at: string | null
          normalized_key: string
          source_id: string
          station_weight: number
          total_played_duration_seconds: number
          week_start: string
          weighted_score: number
        }
        Insert: {
          canonical_track_id?: string | null
          created_at?: string
          detection_count?: number
          edition_date: string
          id?: string
          last_detected_at?: string | null
          normalized_key: string
          source_id: string
          station_weight?: number
          total_played_duration_seconds?: number
          week_start: string
          weighted_score?: number
        }
        Update: {
          canonical_track_id?: string | null
          created_at?: string
          detection_count?: number
          edition_date?: string
          id?: string
          last_detected_at?: string | null
          normalized_key?: string
          source_id?: string
          station_weight?: number
          total_played_duration_seconds?: number
          week_start?: string
          weighted_score?: number
        }
        Relationships: [
          {
            foreignKeyName: "airplay_evidence_weekly_source_id_fkey"
            columns: ["source_id"]
            isOneToOne: false
            referencedRelation: "airplay_sources"
            referencedColumns: ["id"]
          },
        ]
      }
      airplay_sources: {
        Row: {
          country_code: string
          created_at: string
          enabled: boolean
          id: string
          market_slug: string | null
          metadata_json: Json
          source_type: string
          station_name: string
          station_slug: string
          station_weight: number
          updated_at: string
        }
        Insert: {
          country_code: string
          created_at?: string
          enabled?: boolean
          id?: string
          market_slug?: string | null
          metadata_json?: Json
          source_type?: string
          station_name: string
          station_slug: string
          station_weight?: number
          updated_at?: string
        }
        Update: {
          country_code?: string
          created_at?: string
          enabled?: boolean
          id?: string
          market_slug?: string | null
          metadata_json?: Json
          source_type?: string
          station_name?: string
          station_slug?: string
          station_weight?: number
          updated_at?: string
        }
        Relationships: []
      }
      analytics_delivery_logs: {
        Row: {
          client_id: string | null
          created_at: string
          delivery_target: string
          error_message: string | null
          event_name: string
          id: string
          ok: boolean
          page_path: string | null
          page_url: string | null
          request_id: string | null
          status_code: number | null
        }
        Insert: {
          client_id?: string | null
          created_at?: string
          delivery_target?: string
          error_message?: string | null
          event_name: string
          id?: string
          ok?: boolean
          page_path?: string | null
          page_url?: string | null
          request_id?: string | null
          status_code?: number | null
        }
        Update: {
          client_id?: string | null
          created_at?: string
          delivery_target?: string
          error_message?: string | null
          event_name?: string
          id?: string
          ok?: boolean
          page_path?: string | null
          page_url?: string | null
          request_id?: string | null
          status_code?: number | null
        }
        Relationships: []
      }
      analytics_events: {
        Row: {
          context: Json | null
          created_at: string | null
          entity_slug: string | null
          entity_type: string | null
          event_name: string
          id: number
          page_type: string | null
          page_url: string
          referrer: string | null
          session_id: string | null
          user_id: string | null
        }
        Insert: {
          context?: Json | null
          created_at?: string | null
          entity_slug?: string | null
          entity_type?: string | null
          event_name: string
          id?: never
          page_type?: string | null
          page_url: string
          referrer?: string | null
          session_id?: string | null
          user_id?: string | null
        }
        Update: {
          context?: Json | null
          created_at?: string | null
          entity_slug?: string | null
          entity_type?: string | null
          event_name?: string
          id?: never
          page_type?: string | null
          page_url?: string
          referrer?: string | null
          session_id?: string | null
          user_id?: string | null
        }
        Relationships: []
      }
      artist_claim_evidence: {
        Row: {
          claim_id: string
          created_at: string
          evidence_type: string
          id: string
          note: string | null
          reference: string | null
        }
        Insert: {
          claim_id: string
          created_at?: string
          evidence_type: string
          id?: string
          note?: string | null
          reference?: string | null
        }
        Update: {
          claim_id?: string
          created_at?: string
          evidence_type?: string
          id?: string
          note?: string | null
          reference?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "artist_claim_evidence_claim_id_fkey"
            columns: ["claim_id"]
            isOneToOne: false
            referencedRelation: "artist_claim_requests"
            referencedColumns: ["id"]
          },
        ]
      }
      artist_claim_requests: {
        Row: {
          artist_id: string
          claimant_role: string
          claimant_user_id: string | null
          created_at: string
          decided_at: string | null
          decided_by: string | null
          decision_reason: string | null
          id: string
          statement: string
          status: string
          submitted_at: string
          updated_at: string
        }
        Insert: {
          artist_id: string
          claimant_role: string
          claimant_user_id?: string | null
          created_at?: string
          decided_at?: string | null
          decided_by?: string | null
          decision_reason?: string | null
          id?: string
          statement: string
          status?: string
          submitted_at?: string
          updated_at?: string
        }
        Update: {
          artist_id?: string
          claimant_role?: string
          claimant_user_id?: string | null
          created_at?: string
          decided_at?: string | null
          decided_by?: string | null
          decision_reason?: string | null
          id?: string
          statement?: string
          status?: string
          submitted_at?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "artist_claim_requests_artist_id_fkey"
            columns: ["artist_id"]
            isOneToOne: false
            referencedRelation: "registry_artists"
            referencedColumns: ["id"]
          },
        ]
      }
      artist_profile_presentations: {
        Row: {
          artist_id: string
          bio: string | null
          created_at: string
          hero_image_url: string | null
          profile_image_url: string | null
          public_email: string | null
          social_links: Json
          updated_at: string
          updated_by: string | null
          website_url: string | null
        }
        Insert: {
          artist_id: string
          bio?: string | null
          created_at?: string
          hero_image_url?: string | null
          profile_image_url?: string | null
          public_email?: string | null
          social_links?: Json
          updated_at?: string
          updated_by?: string | null
          website_url?: string | null
        }
        Update: {
          artist_id?: string
          bio?: string | null
          created_at?: string
          hero_image_url?: string | null
          profile_image_url?: string | null
          public_email?: string | null
          social_links?: Json
          updated_at?: string
          updated_by?: string | null
          website_url?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "artist_profile_presentations_artist_id_fkey"
            columns: ["artist_id"]
            isOneToOne: true
            referencedRelation: "registry_artists"
            referencedColumns: ["id"]
          },
        ]
      }
      artist_representation_events: {
        Row: {
          actor_user_id: string | null
          artist_id: string
          claim_id: string | null
          created_at: string
          event_type: string
          id: string
          metadata: Json
          representation_id: string | null
          subject_user_id: string | null
        }
        Insert: {
          actor_user_id?: string | null
          artist_id: string
          claim_id?: string | null
          created_at?: string
          event_type: string
          id?: string
          metadata?: Json
          representation_id?: string | null
          subject_user_id?: string | null
        }
        Update: {
          actor_user_id?: string | null
          artist_id?: string
          claim_id?: string | null
          created_at?: string
          event_type?: string
          id?: string
          metadata?: Json
          representation_id?: string | null
          subject_user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "artist_representation_events_artist_id_fkey"
            columns: ["artist_id"]
            isOneToOne: false
            referencedRelation: "registry_artists"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "artist_representation_events_claim_id_fkey"
            columns: ["claim_id"]
            isOneToOne: false
            referencedRelation: "artist_claim_requests"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "artist_representation_events_representation_id_fkey"
            columns: ["representation_id"]
            isOneToOne: false
            referencedRelation: "artist_representations"
            referencedColumns: ["id"]
          },
        ]
      }
      artist_representations: {
        Row: {
          accepted_at: string | null
          artist_id: string
          can_manage_profile: boolean
          can_manage_team: boolean
          can_post_updates: boolean
          can_submit_releases: boolean
          created_at: string
          id: string
          invited_at: string | null
          invited_by: string | null
          representation_role: string
          revocation_reason: string | null
          revoked_at: string | null
          revoked_by: string | null
          source_claim_id: string | null
          status: string
          updated_at: string
          user_id: string
          verified_at: string | null
          verified_by: string | null
        }
        Insert: {
          accepted_at?: string | null
          artist_id: string
          can_manage_profile?: boolean
          can_manage_team?: boolean
          can_post_updates?: boolean
          can_submit_releases?: boolean
          created_at?: string
          id?: string
          invited_at?: string | null
          invited_by?: string | null
          representation_role: string
          revocation_reason?: string | null
          revoked_at?: string | null
          revoked_by?: string | null
          source_claim_id?: string | null
          status?: string
          updated_at?: string
          user_id: string
          verified_at?: string | null
          verified_by?: string | null
        }
        Update: {
          accepted_at?: string | null
          artist_id?: string
          can_manage_profile?: boolean
          can_manage_team?: boolean
          can_post_updates?: boolean
          can_submit_releases?: boolean
          created_at?: string
          id?: string
          invited_at?: string | null
          invited_by?: string | null
          representation_role?: string
          revocation_reason?: string | null
          revoked_at?: string | null
          revoked_by?: string | null
          source_claim_id?: string | null
          status?: string
          updated_at?: string
          user_id?: string
          verified_at?: string | null
          verified_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "artist_representations_artist_id_fkey"
            columns: ["artist_id"]
            isOneToOne: false
            referencedRelation: "registry_artists"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "artist_representations_source_claim_id_fkey"
            columns: ["source_claim_id"]
            isOneToOne: false
            referencedRelation: "artist_claim_requests"
            referencedColumns: ["id"]
          },
        ]
      }
      audience_interests: {
        Row: {
          created_at: string
          entity_id: string | null
          entity_name: string | null
          entity_slug: string
          entity_type: string
          first_seen_at: string
          id: string
          interest_kind: string
          interest_strength: number
          last_seen_at: string
          source_context: Json
          source_form: string
          source_page: string | null
          status: string
          subscriber_id: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          entity_id?: string | null
          entity_name?: string | null
          entity_slug: string
          entity_type: string
          first_seen_at?: string
          id?: string
          interest_kind?: string
          interest_strength?: number
          last_seen_at?: string
          source_context?: Json
          source_form?: string
          source_page?: string | null
          status?: string
          subscriber_id: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          entity_id?: string | null
          entity_name?: string | null
          entity_slug?: string
          entity_type?: string
          first_seen_at?: string
          id?: string
          interest_kind?: string
          interest_strength?: number
          last_seen_at?: string
          source_context?: Json
          source_form?: string
          source_page?: string | null
          status?: string
          subscriber_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "audience_interests_subscriber_id_fkey"
            columns: ["subscriber_id"]
            isOneToOne: false
            referencedRelation: "briefing_subscribers"
            referencedColumns: ["id"]
          },
        ]
      }
      briefing_catalog: {
        Row: {
          cadence: string
          created_at: string
          description: string | null
          id: string
          is_active: boolean
          is_manual: boolean
          send_day: string | null
          send_every_days: number | null
          send_time: string | null
          slug: string
          sort_order: number
          template_profile: Json | null
          title: string
          updated_at: string
          visual_config: Json | null
        }
        Insert: {
          cadence: string
          created_at?: string
          description?: string | null
          id?: string
          is_active?: boolean
          is_manual?: boolean
          send_day?: string | null
          send_every_days?: number | null
          send_time?: string | null
          slug: string
          sort_order?: number
          template_profile?: Json | null
          title: string
          updated_at?: string
          visual_config?: Json | null
        }
        Update: {
          cadence?: string
          created_at?: string
          description?: string | null
          id?: string
          is_active?: boolean
          is_manual?: boolean
          send_day?: string | null
          send_every_days?: number | null
          send_time?: string | null
          slug?: string
          sort_order?: number
          template_profile?: Json | null
          title?: string
          updated_at?: string
          visual_config?: Json | null
        }
        Relationships: []
      }
      briefing_issue_recipients: {
        Row: {
          bounced_at: string | null
          clicked_at: string | null
          created_at: string
          delivered_at: string | null
          delivery_status: string
          id: string
          issue_id: string
          opened_at: string | null
          resend_message_id: string | null
          subscriber_id: string
          webhook_events: Json | null
        }
        Insert: {
          bounced_at?: string | null
          clicked_at?: string | null
          created_at?: string
          delivered_at?: string | null
          delivery_status?: string
          id?: string
          issue_id: string
          opened_at?: string | null
          resend_message_id?: string | null
          subscriber_id: string
          webhook_events?: Json | null
        }
        Update: {
          bounced_at?: string | null
          clicked_at?: string | null
          created_at?: string
          delivered_at?: string | null
          delivery_status?: string
          id?: string
          issue_id?: string
          opened_at?: string | null
          resend_message_id?: string | null
          subscriber_id?: string
          webhook_events?: Json | null
        }
        Relationships: [
          {
            foreignKeyName: "briefing_issue_recipients_issue_id_fkey"
            columns: ["issue_id"]
            isOneToOne: false
            referencedRelation: "briefing_issues"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "briefing_issue_recipients_subscriber_id_fkey"
            columns: ["subscriber_id"]
            isOneToOne: false
            referencedRelation: "briefing_subscribers"
            referencedColumns: ["id"]
          },
        ]
      }
      briefing_issues: {
        Row: {
          briefing_id: string
          created_at: string
          curated_content: Json | null
          generated_by: string | null
          html_body: string | null
          id: string
          iso_week: string | null
          issue_date: string | null
          plain_text: string | null
          sent_at: string | null
          sent_by: string | null
          sent_count: number
          slug: string
          status: string
          title: string
          updated_at: string
          utm_campaign: string | null
        }
        Insert: {
          briefing_id: string
          created_at?: string
          curated_content?: Json | null
          generated_by?: string | null
          html_body?: string | null
          id?: string
          iso_week?: string | null
          issue_date?: string | null
          plain_text?: string | null
          sent_at?: string | null
          sent_by?: string | null
          sent_count?: number
          slug: string
          status?: string
          title: string
          updated_at?: string
          utm_campaign?: string | null
        }
        Update: {
          briefing_id?: string
          created_at?: string
          curated_content?: Json | null
          generated_by?: string | null
          html_body?: string | null
          id?: string
          iso_week?: string | null
          issue_date?: string | null
          plain_text?: string | null
          sent_at?: string | null
          sent_by?: string | null
          sent_count?: number
          slug?: string
          status?: string
          title?: string
          updated_at?: string
          utm_campaign?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "briefing_issues_briefing_id_fkey"
            columns: ["briefing_id"]
            isOneToOne: false
            referencedRelation: "briefing_catalog"
            referencedColumns: ["id"]
          },
        ]
      }
      briefing_opt_ins: {
        Row: {
          briefing_id: string
          id: string
          status: string
          subscribed_at: string
          subscriber_id: string
          unsubscribed_at: string | null
        }
        Insert: {
          briefing_id: string
          id?: string
          status?: string
          subscribed_at?: string
          subscriber_id: string
          unsubscribed_at?: string | null
        }
        Update: {
          briefing_id?: string
          id?: string
          status?: string
          subscribed_at?: string
          subscriber_id?: string
          unsubscribed_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "briefing_opt_ins_briefing_id_fkey"
            columns: ["briefing_id"]
            isOneToOne: false
            referencedRelation: "briefing_catalog"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "briefing_opt_ins_subscriber_id_fkey"
            columns: ["subscriber_id"]
            isOneToOne: false
            referencedRelation: "briefing_subscribers"
            referencedColumns: ["id"]
          },
        ]
      }
      briefing_subscribers: {
        Row: {
          confirmed_at: string | null
          created_at: string
          email: string
          id: string
          ip_address: string | null
          status: string
          unsubscribed_at: string | null
          updated_at: string
          user_agent: string | null
        }
        Insert: {
          confirmed_at?: string | null
          created_at?: string
          email: string
          id?: string
          ip_address?: string | null
          status?: string
          unsubscribed_at?: string | null
          updated_at?: string
          user_agent?: string | null
        }
        Update: {
          confirmed_at?: string | null
          created_at?: string
          email?: string
          id?: string
          ip_address?: string | null
          status?: string
          unsubscribed_at?: string | null
          updated_at?: string
          user_agent?: string | null
        }
        Relationships: []
      }
      briefing_tokens: {
        Row: {
          created_at: string
          expires_at: string
          id: string
          purpose: string
          subscriber_id: string
          token: string
          used_at: string | null
        }
        Insert: {
          created_at?: string
          expires_at: string
          id?: string
          purpose: string
          subscriber_id: string
          token?: string
          used_at?: string | null
        }
        Update: {
          created_at?: string
          expires_at?: string
          id?: string
          purpose?: string
          subscriber_id?: string
          token?: string
          used_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "briefing_tokens_subscriber_id_fkey"
            columns: ["subscriber_id"]
            isOneToOne: false
            referencedRelation: "briefing_subscribers"
            referencedColumns: ["id"]
          },
        ]
      }
      capability_definitions: {
        Row: {
          capability_key: string
          created_at: string
          description: string | null
          domain: string
          label: string
          updated_at: string
        }
        Insert: {
          capability_key: string
          created_at?: string
          description?: string | null
          domain?: string
          label: string
          updated_at?: string
        }
        Update: {
          capability_key?: string
          created_at?: string
          description?: string | null
          domain?: string
          label?: string
          updated_at?: string
        }
        Relationships: []
      }
      chart_artist_resolution_decisions: {
        Row: {
          actor_id: string | null
          applied_at: string | null
          apply_result_json: Json | null
          artist_slug: string | null
          canonical_artist_id: string | null
          chart_entry_id: string
          created_at: string
          decision_status: string
          decision_type: string
          edition_date: string | null
          edition_id: string
          id: string
          note: string | null
          parsed_tokens: Json
          program_id: string | null
          rank: number | null
          raw_artist_name: string | null
          selected_artists: Json
          track_title: string | null
          updated_at: string
        }
        Insert: {
          actor_id?: string | null
          applied_at?: string | null
          apply_result_json?: Json | null
          artist_slug?: string | null
          canonical_artist_id?: string | null
          chart_entry_id: string
          created_at?: string
          decision_status?: string
          decision_type: string
          edition_date?: string | null
          edition_id: string
          id?: string
          note?: string | null
          parsed_tokens?: Json
          program_id?: string | null
          rank?: number | null
          raw_artist_name?: string | null
          selected_artists?: Json
          track_title?: string | null
          updated_at?: string
        }
        Update: {
          actor_id?: string | null
          applied_at?: string | null
          apply_result_json?: Json | null
          artist_slug?: string | null
          canonical_artist_id?: string | null
          chart_entry_id?: string
          created_at?: string
          decision_status?: string
          decision_type?: string
          edition_date?: string | null
          edition_id?: string
          id?: string
          note?: string | null
          parsed_tokens?: Json
          program_id?: string | null
          rank?: number | null
          raw_artist_name?: string | null
          selected_artists?: Json
          track_title?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      chart_cleanup_20260625_top100_nonpublished_editions_backup: {
        Row: {
          carry_forward_count: number | null
          chart_size: number | null
          created_at: string | null
          edition_date: string | null
          edition_label: string | null
          edition_slug: string | null
          eligibility_policy_version: string | null
          entry_count: number | null
          exclusion_summary: Json | null
          id: string | null
          ingest_run_id: string | null
          methodology_version: string | null
          new_entries_count: number | null
          override_mode: string | null
          period_end: string | null
          period_start: string | null
          program_id: string | null
          published_at: string | null
          published_by: string | null
          re_entries_count: number | null
          rule_set_snapshot: Json | null
          scoring_policy_version: string | null
          source_policy_version: string | null
          status: string | null
          updated_at: string | null
        }
        Insert: {
          carry_forward_count?: number | null
          chart_size?: number | null
          created_at?: string | null
          edition_date?: string | null
          edition_label?: string | null
          edition_slug?: string | null
          eligibility_policy_version?: string | null
          entry_count?: number | null
          exclusion_summary?: Json | null
          id?: string | null
          ingest_run_id?: string | null
          methodology_version?: string | null
          new_entries_count?: number | null
          override_mode?: string | null
          period_end?: string | null
          period_start?: string | null
          program_id?: string | null
          published_at?: string | null
          published_by?: string | null
          re_entries_count?: number | null
          rule_set_snapshot?: Json | null
          scoring_policy_version?: string | null
          source_policy_version?: string | null
          status?: string | null
          updated_at?: string | null
        }
        Update: {
          carry_forward_count?: number | null
          chart_size?: number | null
          created_at?: string | null
          edition_date?: string | null
          edition_label?: string | null
          edition_slug?: string | null
          eligibility_policy_version?: string | null
          entry_count?: number | null
          exclusion_summary?: Json | null
          id?: string | null
          ingest_run_id?: string | null
          methodology_version?: string | null
          new_entries_count?: number | null
          override_mode?: string | null
          period_end?: string | null
          period_start?: string | null
          program_id?: string | null
          published_at?: string | null
          published_by?: string | null
          re_entries_count?: number | null
          rule_set_snapshot?: Json | null
          scoring_policy_version?: string | null
          source_policy_version?: string | null
          status?: string | null
          updated_at?: string | null
        }
        Relationships: []
      }
      chart_cleanup_20260625_top100_nonpublished_entries_backup: {
        Row: {
          airplay_candidate_only: boolean | null
          airplay_detections: number | null
          airplay_last_detected_at: string | null
          airplay_matched_by: string | null
          airplay_rescue_mode: string | null
          airplay_score: number | null
          airplay_station_count: number | null
          airplay_total_duration: number | null
          airplay_weighted_score: number | null
          anti_gaming_penalty: number | null
          artist_name: string | null
          artist_slug: string | null
          artwork_image_id: string | null
          artwork_url: string | null
          canonical_artist_id: string | null
          canonical_release_id: string | null
          canonical_track_id: string | null
          carry_forward_bonus: number | null
          carry_forward_only: boolean | null
          continuity_locked: boolean | null
          continuity_score: number | null
          created_at: string | null
          cross_source_bonus: number | null
          edition_id: string | null
          eligibility_policy_version: string | null
          eligibility_status: string | null
          eligibility_warnings: Json | null
          id: string | null
          lead_artist_key: string | null
          lead_artist_overflow: boolean | null
          methodology_version: string | null
          movement: string | null
          normalized_key: string | null
          occurrence_count: number | null
          overlap_bonus: number | null
          overlap_bonus_capped: boolean | null
          previous_rank: number | null
          rank: number | null
          recency_score: number | null
          release_date: string | null
          release_recency_days: number | null
          scoring_policy_version: string | null
          source_count: number | null
          source_payload: Json | null
          source_score: number | null
          source_urls_seen: Json | null
          stale_carry_forward_demoted: boolean | null
          total_score: number | null
          track_slug: string | null
          track_title: string | null
          updated_at: string | null
        }
        Insert: {
          airplay_candidate_only?: boolean | null
          airplay_detections?: number | null
          airplay_last_detected_at?: string | null
          airplay_matched_by?: string | null
          airplay_rescue_mode?: string | null
          airplay_score?: number | null
          airplay_station_count?: number | null
          airplay_total_duration?: number | null
          airplay_weighted_score?: number | null
          anti_gaming_penalty?: number | null
          artist_name?: string | null
          artist_slug?: string | null
          artwork_image_id?: string | null
          artwork_url?: string | null
          canonical_artist_id?: string | null
          canonical_release_id?: string | null
          canonical_track_id?: string | null
          carry_forward_bonus?: number | null
          carry_forward_only?: boolean | null
          continuity_locked?: boolean | null
          continuity_score?: number | null
          created_at?: string | null
          cross_source_bonus?: number | null
          edition_id?: string | null
          eligibility_policy_version?: string | null
          eligibility_status?: string | null
          eligibility_warnings?: Json | null
          id?: string | null
          lead_artist_key?: string | null
          lead_artist_overflow?: boolean | null
          methodology_version?: string | null
          movement?: string | null
          normalized_key?: string | null
          occurrence_count?: number | null
          overlap_bonus?: number | null
          overlap_bonus_capped?: boolean | null
          previous_rank?: number | null
          rank?: number | null
          recency_score?: number | null
          release_date?: string | null
          release_recency_days?: number | null
          scoring_policy_version?: string | null
          source_count?: number | null
          source_payload?: Json | null
          source_score?: number | null
          source_urls_seen?: Json | null
          stale_carry_forward_demoted?: boolean | null
          total_score?: number | null
          track_slug?: string | null
          track_title?: string | null
          updated_at?: string | null
        }
        Update: {
          airplay_candidate_only?: boolean | null
          airplay_detections?: number | null
          airplay_last_detected_at?: string | null
          airplay_matched_by?: string | null
          airplay_rescue_mode?: string | null
          airplay_score?: number | null
          airplay_station_count?: number | null
          airplay_total_duration?: number | null
          airplay_weighted_score?: number | null
          anti_gaming_penalty?: number | null
          artist_name?: string | null
          artist_slug?: string | null
          artwork_image_id?: string | null
          artwork_url?: string | null
          canonical_artist_id?: string | null
          canonical_release_id?: string | null
          canonical_track_id?: string | null
          carry_forward_bonus?: number | null
          carry_forward_only?: boolean | null
          continuity_locked?: boolean | null
          continuity_score?: number | null
          created_at?: string | null
          cross_source_bonus?: number | null
          edition_id?: string | null
          eligibility_policy_version?: string | null
          eligibility_status?: string | null
          eligibility_warnings?: Json | null
          id?: string | null
          lead_artist_key?: string | null
          lead_artist_overflow?: boolean | null
          methodology_version?: string | null
          movement?: string | null
          normalized_key?: string | null
          occurrence_count?: number | null
          overlap_bonus?: number | null
          overlap_bonus_capped?: boolean | null
          previous_rank?: number | null
          rank?: number | null
          recency_score?: number | null
          release_date?: string | null
          release_recency_days?: number | null
          scoring_policy_version?: string | null
          source_count?: number | null
          source_payload?: Json | null
          source_score?: number | null
          source_urls_seen?: Json | null
          stale_carry_forward_demoted?: boolean | null
          total_score?: number | null
          track_slug?: string | null
          track_title?: string | null
          updated_at?: string | null
        }
        Relationships: []
      }
      chart_cleanup_20260625_top100_nonpublished_source_coverage_back: {
        Row: {
          coverage_payload: Json | null
          coverage_status: string | null
          edition_id: string | null
          id: string | null
          source_count: number | null
          source_name: string | null
        }
        Insert: {
          coverage_payload?: Json | null
          coverage_status?: string | null
          edition_id?: string | null
          id?: string | null
          source_count?: number | null
          source_name?: string | null
        }
        Update: {
          coverage_payload?: Json | null
          coverage_status?: string | null
          edition_id?: string | null
          id?: string | null
          source_count?: number | null
          source_name?: string | null
        }
        Relationships: []
      }
      chart_cleanup_20260625_wrong_wk_v2_editions_backup: {
        Row: {
          carry_forward_count: number | null
          chart_size: number | null
          created_at: string | null
          edition_date: string | null
          edition_label: string | null
          edition_slug: string | null
          eligibility_policy_version: string | null
          entry_count: number | null
          exclusion_summary: Json | null
          id: string | null
          ingest_run_id: string | null
          methodology_version: string | null
          new_entries_count: number | null
          override_mode: string | null
          period_end: string | null
          period_start: string | null
          program_id: string | null
          published_at: string | null
          published_by: string | null
          re_entries_count: number | null
          rule_set_snapshot: Json | null
          scoring_policy_version: string | null
          source_policy_version: string | null
          status: string | null
          updated_at: string | null
        }
        Insert: {
          carry_forward_count?: number | null
          chart_size?: number | null
          created_at?: string | null
          edition_date?: string | null
          edition_label?: string | null
          edition_slug?: string | null
          eligibility_policy_version?: string | null
          entry_count?: number | null
          exclusion_summary?: Json | null
          id?: string | null
          ingest_run_id?: string | null
          methodology_version?: string | null
          new_entries_count?: number | null
          override_mode?: string | null
          period_end?: string | null
          period_start?: string | null
          program_id?: string | null
          published_at?: string | null
          published_by?: string | null
          re_entries_count?: number | null
          rule_set_snapshot?: Json | null
          scoring_policy_version?: string | null
          source_policy_version?: string | null
          status?: string | null
          updated_at?: string | null
        }
        Update: {
          carry_forward_count?: number | null
          chart_size?: number | null
          created_at?: string | null
          edition_date?: string | null
          edition_label?: string | null
          edition_slug?: string | null
          eligibility_policy_version?: string | null
          entry_count?: number | null
          exclusion_summary?: Json | null
          id?: string | null
          ingest_run_id?: string | null
          methodology_version?: string | null
          new_entries_count?: number | null
          override_mode?: string | null
          period_end?: string | null
          period_start?: string | null
          program_id?: string | null
          published_at?: string | null
          published_by?: string | null
          re_entries_count?: number | null
          rule_set_snapshot?: Json | null
          scoring_policy_version?: string | null
          source_policy_version?: string | null
          status?: string | null
          updated_at?: string | null
        }
        Relationships: []
      }
      chart_cleanup_20260625_wrong_wk_v2_entries_backup: {
        Row: {
          airplay_candidate_only: boolean | null
          airplay_detections: number | null
          airplay_last_detected_at: string | null
          airplay_matched_by: string | null
          airplay_rescue_mode: string | null
          airplay_score: number | null
          airplay_station_count: number | null
          airplay_total_duration: number | null
          airplay_weighted_score: number | null
          anti_gaming_penalty: number | null
          artist_name: string | null
          artist_slug: string | null
          artwork_image_id: string | null
          artwork_url: string | null
          canonical_artist_id: string | null
          canonical_release_id: string | null
          canonical_track_id: string | null
          carry_forward_bonus: number | null
          carry_forward_only: boolean | null
          continuity_locked: boolean | null
          continuity_score: number | null
          created_at: string | null
          cross_source_bonus: number | null
          edition_id: string | null
          eligibility_policy_version: string | null
          eligibility_status: string | null
          eligibility_warnings: Json | null
          id: string | null
          lead_artist_key: string | null
          lead_artist_overflow: boolean | null
          methodology_version: string | null
          movement: string | null
          normalized_key: string | null
          occurrence_count: number | null
          overlap_bonus: number | null
          overlap_bonus_capped: boolean | null
          previous_rank: number | null
          rank: number | null
          recency_score: number | null
          release_date: string | null
          release_recency_days: number | null
          scoring_policy_version: string | null
          source_count: number | null
          source_payload: Json | null
          source_score: number | null
          source_urls_seen: Json | null
          stale_carry_forward_demoted: boolean | null
          total_score: number | null
          track_slug: string | null
          track_title: string | null
          updated_at: string | null
        }
        Insert: {
          airplay_candidate_only?: boolean | null
          airplay_detections?: number | null
          airplay_last_detected_at?: string | null
          airplay_matched_by?: string | null
          airplay_rescue_mode?: string | null
          airplay_score?: number | null
          airplay_station_count?: number | null
          airplay_total_duration?: number | null
          airplay_weighted_score?: number | null
          anti_gaming_penalty?: number | null
          artist_name?: string | null
          artist_slug?: string | null
          artwork_image_id?: string | null
          artwork_url?: string | null
          canonical_artist_id?: string | null
          canonical_release_id?: string | null
          canonical_track_id?: string | null
          carry_forward_bonus?: number | null
          carry_forward_only?: boolean | null
          continuity_locked?: boolean | null
          continuity_score?: number | null
          created_at?: string | null
          cross_source_bonus?: number | null
          edition_id?: string | null
          eligibility_policy_version?: string | null
          eligibility_status?: string | null
          eligibility_warnings?: Json | null
          id?: string | null
          lead_artist_key?: string | null
          lead_artist_overflow?: boolean | null
          methodology_version?: string | null
          movement?: string | null
          normalized_key?: string | null
          occurrence_count?: number | null
          overlap_bonus?: number | null
          overlap_bonus_capped?: boolean | null
          previous_rank?: number | null
          rank?: number | null
          recency_score?: number | null
          release_date?: string | null
          release_recency_days?: number | null
          scoring_policy_version?: string | null
          source_count?: number | null
          source_payload?: Json | null
          source_score?: number | null
          source_urls_seen?: Json | null
          stale_carry_forward_demoted?: boolean | null
          total_score?: number | null
          track_slug?: string | null
          track_title?: string | null
          updated_at?: string | null
        }
        Update: {
          airplay_candidate_only?: boolean | null
          airplay_detections?: number | null
          airplay_last_detected_at?: string | null
          airplay_matched_by?: string | null
          airplay_rescue_mode?: string | null
          airplay_score?: number | null
          airplay_station_count?: number | null
          airplay_total_duration?: number | null
          airplay_weighted_score?: number | null
          anti_gaming_penalty?: number | null
          artist_name?: string | null
          artist_slug?: string | null
          artwork_image_id?: string | null
          artwork_url?: string | null
          canonical_artist_id?: string | null
          canonical_release_id?: string | null
          canonical_track_id?: string | null
          carry_forward_bonus?: number | null
          carry_forward_only?: boolean | null
          continuity_locked?: boolean | null
          continuity_score?: number | null
          created_at?: string | null
          cross_source_bonus?: number | null
          edition_id?: string | null
          eligibility_policy_version?: string | null
          eligibility_status?: string | null
          eligibility_warnings?: Json | null
          id?: string | null
          lead_artist_key?: string | null
          lead_artist_overflow?: boolean | null
          methodology_version?: string | null
          movement?: string | null
          normalized_key?: string | null
          occurrence_count?: number | null
          overlap_bonus?: number | null
          overlap_bonus_capped?: boolean | null
          previous_rank?: number | null
          rank?: number | null
          recency_score?: number | null
          release_date?: string | null
          release_recency_days?: number | null
          scoring_policy_version?: string | null
          source_count?: number | null
          source_payload?: Json | null
          source_score?: number | null
          source_urls_seen?: Json | null
          stale_carry_forward_demoted?: boolean | null
          total_score?: number | null
          track_slug?: string | null
          track_title?: string | null
          updated_at?: string | null
        }
        Relationships: []
      }
      chart_cleanup_20260625_wrong_wk_v2_source_coverage_backup: {
        Row: {
          coverage_payload: Json | null
          coverage_status: string | null
          edition_id: string | null
          id: string | null
          source_count: number | null
          source_name: string | null
        }
        Insert: {
          coverage_payload?: Json | null
          coverage_status?: string | null
          edition_id?: string | null
          id?: string | null
          source_count?: number | null
          source_name?: string | null
        }
        Update: {
          coverage_payload?: Json | null
          coverage_status?: string | null
          edition_id?: string | null
          id?: string | null
          source_count?: number | null
          source_name?: string | null
        }
        Relationships: []
      }
      chart_editions: {
        Row: {
          created_at: string | null
          edition_date: string | null
          edition_label: string | null
          edition_slug: string
          entry_count: number | null
          id: string
          period_end: string | null
          period_start: string | null
          program_id: string | null
          status: string | null
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          edition_date?: string | null
          edition_label?: string | null
          edition_slug: string
          entry_count?: number | null
          id?: string
          period_end?: string | null
          period_start?: string | null
          program_id?: string | null
          status?: string | null
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          edition_date?: string | null
          edition_label?: string | null
          edition_slug?: string
          entry_count?: number | null
          id?: string
          period_end?: string | null
          period_start?: string | null
          program_id?: string | null
          status?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "chart_editions_program_id_fkey"
            columns: ["program_id"]
            isOneToOne: false
            referencedRelation: "chart_programs"
            referencedColumns: ["id"]
          },
        ]
      }
      chart_entries: {
        Row: {
          artist_name: string | null
          artist_slug: string | null
          artwork_image_id: string | null
          artwork_url: string | null
          created_at: string | null
          edition_id: string | null
          id: string
          movement: string | null
          previous_rank: number | null
          rank: number
          score: number | null
          source_entry_id: string | null
          track_slug: string | null
          track_title: string | null
          updated_at: string | null
        }
        Insert: {
          artist_name?: string | null
          artist_slug?: string | null
          artwork_image_id?: string | null
          artwork_url?: string | null
          created_at?: string | null
          edition_id?: string | null
          id?: string
          movement?: string | null
          previous_rank?: number | null
          rank: number
          score?: number | null
          source_entry_id?: string | null
          track_slug?: string | null
          track_title?: string | null
          updated_at?: string | null
        }
        Update: {
          artist_name?: string | null
          artist_slug?: string | null
          artwork_image_id?: string | null
          artwork_url?: string | null
          created_at?: string | null
          edition_id?: string | null
          id?: string
          movement?: string | null
          previous_rank?: number | null
          rank?: number
          score?: number | null
          source_entry_id?: string | null
          track_slug?: string | null
          track_title?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "chart_entries_artwork_image_id_fkey"
            columns: ["artwork_image_id"]
            isOneToOne: false
            referencedRelation: "registry_media_assets"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "chart_entries_edition_id_fkey"
            columns: ["edition_id"]
            isOneToOne: false
            referencedRelation: "chart_editions"
            referencedColumns: ["id"]
          },
        ]
      }
      chart_ingest_audit_events: {
        Row: {
          action: string
          actor: string | null
          actor_email: string | null
          candidate_id: string | null
          created_at: string
          id: string
          new_status: string | null
          note: string | null
          payload_json: Json
          previous_status: string | null
          run_id: string
          target_entity_id: string | null
        }
        Insert: {
          action: string
          actor?: string | null
          actor_email?: string | null
          candidate_id?: string | null
          created_at?: string
          id?: string
          new_status?: string | null
          note?: string | null
          payload_json?: Json
          previous_status?: string | null
          run_id: string
          target_entity_id?: string | null
        }
        Update: {
          action?: string
          actor?: string | null
          actor_email?: string | null
          candidate_id?: string | null
          created_at?: string
          id?: string
          new_status?: string | null
          note?: string | null
          payload_json?: Json
          previous_status?: string | null
          run_id?: string
          target_entity_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "chart_ingest_audit_events_candidate_id_fkey"
            columns: ["candidate_id"]
            isOneToOne: false
            referencedRelation: "chart_ingest_candidates"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "chart_ingest_audit_events_run_id_fkey"
            columns: ["run_id"]
            isOneToOne: false
            referencedRelation: "chart_ingest_runs"
            referencedColumns: ["id"]
          },
        ]
      }
      chart_ingest_candidate_scores: {
        Row: {
          airplay_json: Json
          airplay_score: number
          anti_gaming_json: Json
          anti_gaming_penalty: number
          candidate_id: string
          carry_forward_bonus: number
          continuity_score: number
          created_at: string
          cross_source_bonus: number
          final_score: number
          id: string
          normalized_key: string
          occurrence_count: number
          overlap_bonus: number
          previous_position: number | null
          recency_days: number | null
          recency_score: number
          run_id: string
          score_integrity_delta: number | null
          score_integrity_ok: boolean
          score_payload_json: Json
          source_count: number
          source_score: number
        }
        Insert: {
          airplay_json?: Json
          airplay_score?: number
          anti_gaming_json?: Json
          anti_gaming_penalty?: number
          candidate_id: string
          carry_forward_bonus?: number
          continuity_score?: number
          created_at?: string
          cross_source_bonus?: number
          final_score?: number
          id?: string
          normalized_key: string
          occurrence_count?: number
          overlap_bonus?: number
          previous_position?: number | null
          recency_days?: number | null
          recency_score?: number
          run_id: string
          score_integrity_delta?: number | null
          score_integrity_ok?: boolean
          score_payload_json?: Json
          source_count?: number
          source_score?: number
        }
        Update: {
          airplay_json?: Json
          airplay_score?: number
          anti_gaming_json?: Json
          anti_gaming_penalty?: number
          candidate_id?: string
          carry_forward_bonus?: number
          continuity_score?: number
          created_at?: string
          cross_source_bonus?: number
          final_score?: number
          id?: string
          normalized_key?: string
          occurrence_count?: number
          overlap_bonus?: number
          previous_position?: number | null
          recency_days?: number | null
          recency_score?: number
          run_id?: string
          score_integrity_delta?: number | null
          score_integrity_ok?: boolean
          score_payload_json?: Json
          source_count?: number
          source_score?: number
        }
        Relationships: [
          {
            foreignKeyName: "chart_ingest_candidate_scores_candidate_id_fkey"
            columns: ["candidate_id"]
            isOneToOne: false
            referencedRelation: "chart_ingest_candidates"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "chart_ingest_candidate_scores_run_id_fkey"
            columns: ["run_id"]
            isOneToOne: false
            referencedRelation: "chart_ingest_runs"
            referencedColumns: ["id"]
          },
        ]
      }
      chart_ingest_candidates: {
        Row: {
          airplay_candidate_only: boolean
          artist_display: string | null
          artwork_url: string | null
          candidate_type: string
          carry_forward_only: boolean
          continuity_locked: boolean
          created_at: string
          eligibility_decision_json: Json
          explicit: boolean | null
          external_url: string | null
          id: string
          isrc: string | null
          lead_artist_key: string | null
          normalized_key: string
          occurrence_count: number
          preview_url: string | null
          provider_ids_json: Json
          release_date: string | null
          release_title: string | null
          run_id: string
          source_count: number
          source_urls_seen: Json
          status: string
          streaming_qualified: boolean
          title: string | null
          upc: string | null
          updated_at: string
          version: number
        }
        Insert: {
          airplay_candidate_only?: boolean
          artist_display?: string | null
          artwork_url?: string | null
          candidate_type?: string
          carry_forward_only?: boolean
          continuity_locked?: boolean
          created_at?: string
          eligibility_decision_json?: Json
          explicit?: boolean | null
          external_url?: string | null
          id?: string
          isrc?: string | null
          lead_artist_key?: string | null
          normalized_key: string
          occurrence_count?: number
          preview_url?: string | null
          provider_ids_json?: Json
          release_date?: string | null
          release_title?: string | null
          run_id: string
          source_count?: number
          source_urls_seen?: Json
          status?: string
          streaming_qualified?: boolean
          title?: string | null
          upc?: string | null
          updated_at?: string
          version?: number
        }
        Update: {
          airplay_candidate_only?: boolean
          artist_display?: string | null
          artwork_url?: string | null
          candidate_type?: string
          carry_forward_only?: boolean
          continuity_locked?: boolean
          created_at?: string
          eligibility_decision_json?: Json
          explicit?: boolean | null
          external_url?: string | null
          id?: string
          isrc?: string | null
          lead_artist_key?: string | null
          normalized_key?: string
          occurrence_count?: number
          preview_url?: string | null
          provider_ids_json?: Json
          release_date?: string | null
          release_title?: string | null
          run_id?: string
          source_count?: number
          source_urls_seen?: Json
          status?: string
          streaming_qualified?: boolean
          title?: string | null
          upc?: string | null
          updated_at?: string
          version?: number
        }
        Relationships: [
          {
            foreignKeyName: "chart_ingest_candidates_run_id_fkey"
            columns: ["run_id"]
            isOneToOne: false
            referencedRelation: "chart_ingest_runs"
            referencedColumns: ["id"]
          },
        ]
      }
      chart_ingest_exclusions: {
        Row: {
          candidate_id: string
          created_at: string
          details_json: Json
          id: string
          reason_code: string
          reason_label: string
          run_id: string
          severity: string
          source_stage: string | null
        }
        Insert: {
          candidate_id: string
          created_at?: string
          details_json?: Json
          id?: string
          reason_code: string
          reason_label: string
          run_id: string
          severity?: string
          source_stage?: string | null
        }
        Update: {
          candidate_id?: string
          created_at?: string
          details_json?: Json
          id?: string
          reason_code?: string
          reason_label?: string
          run_id?: string
          severity?: string
          source_stage?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "chart_ingest_exclusions_candidate_id_fkey"
            columns: ["candidate_id"]
            isOneToOne: false
            referencedRelation: "chart_ingest_candidates"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "chart_ingest_exclusions_run_id_fkey"
            columns: ["run_id"]
            isOneToOne: false
            referencedRelation: "chart_ingest_runs"
            referencedColumns: ["id"]
          },
        ]
      }
      chart_ingest_family_presets: {
        Row: {
          config_json: Json
          created_at: string
          created_by: string | null
          family_id: string
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          config_json?: Json
          created_at?: string
          created_by?: string | null
          family_id: string
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          config_json?: Json
          created_at?: string
          created_by?: string | null
          family_id?: string
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: []
      }
      chart_ingest_matches: {
        Row: {
          candidate_id: string
          canonical_entity_id: string | null
          confidence: number | null
          created_at: string
          decided_at: string | null
          decided_by: string | null
          decision_note: string | null
          entity_type: string
          id: string
          match_method: string | null
          reasons_json: Json
          run_id: string
          status: string
          updated_at: string
        }
        Insert: {
          candidate_id: string
          canonical_entity_id?: string | null
          confidence?: number | null
          created_at?: string
          decided_at?: string | null
          decided_by?: string | null
          decision_note?: string | null
          entity_type: string
          id?: string
          match_method?: string | null
          reasons_json?: Json
          run_id: string
          status?: string
          updated_at?: string
        }
        Update: {
          candidate_id?: string
          canonical_entity_id?: string | null
          confidence?: number | null
          created_at?: string
          decided_at?: string | null
          decided_by?: string | null
          decision_note?: string | null
          entity_type?: string
          id?: string
          match_method?: string | null
          reasons_json?: Json
          run_id?: string
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "chart_ingest_matches_candidate_id_fkey"
            columns: ["candidate_id"]
            isOneToOne: false
            referencedRelation: "chart_ingest_candidates"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "chart_ingest_matches_run_id_fkey"
            columns: ["run_id"]
            isOneToOne: false
            referencedRelation: "chart_ingest_runs"
            referencedColumns: ["id"]
          },
        ]
      }
      chart_ingest_normalized_rows: {
        Row: {
          artwork_url: string | null
          created_at: string
          explicit: boolean | null
          external_url: string | null
          id: string
          isrc: string | null
          lead_artist_key: string | null
          metadata_json: Json
          normalization_warnings_json: Json
          normalized_artist: string | null
          normalized_key: string
          normalized_title: string | null
          occurrence_count: number
          preview_url: string | null
          provider_artist_ids: Json
          provider_release_id: string | null
          provider_track_id: string | null
          raw_row_id: string | null
          release_date: string | null
          run_id: string
          source_urls_seen: Json
        }
        Insert: {
          artwork_url?: string | null
          created_at?: string
          explicit?: boolean | null
          external_url?: string | null
          id?: string
          isrc?: string | null
          lead_artist_key?: string | null
          metadata_json?: Json
          normalization_warnings_json?: Json
          normalized_artist?: string | null
          normalized_key: string
          normalized_title?: string | null
          occurrence_count?: number
          preview_url?: string | null
          provider_artist_ids?: Json
          provider_release_id?: string | null
          provider_track_id?: string | null
          raw_row_id?: string | null
          release_date?: string | null
          run_id: string
          source_urls_seen?: Json
        }
        Update: {
          artwork_url?: string | null
          created_at?: string
          explicit?: boolean | null
          external_url?: string | null
          id?: string
          isrc?: string | null
          lead_artist_key?: string | null
          metadata_json?: Json
          normalization_warnings_json?: Json
          normalized_artist?: string | null
          normalized_key?: string
          normalized_title?: string | null
          occurrence_count?: number
          preview_url?: string | null
          provider_artist_ids?: Json
          provider_release_id?: string | null
          provider_track_id?: string | null
          raw_row_id?: string | null
          release_date?: string | null
          run_id?: string
          source_urls_seen?: Json
        }
        Relationships: [
          {
            foreignKeyName: "chart_ingest_normalized_rows_raw_row_id_fkey"
            columns: ["raw_row_id"]
            isOneToOne: false
            referencedRelation: "chart_ingest_raw_rows"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "chart_ingest_normalized_rows_run_id_fkey"
            columns: ["run_id"]
            isOneToOne: false
            referencedRelation: "chart_ingest_runs"
            referencedColumns: ["id"]
          },
        ]
      }
      chart_ingest_raw_rows: {
        Row: {
          artist_raw: string | null
          artwork_url: string | null
          created_at: string
          explicit: boolean | null
          external_url: string | null
          id: string
          isrc: string | null
          preview_url: string | null
          provider: string
          provider_artist_ids: Json
          provider_release_id: string | null
          provider_row_id: string | null
          provider_track_id: string | null
          raw_payload_hash: string | null
          raw_payload_json: Json
          release_date_raw: string | null
          release_raw: string | null
          run_id: string
          source_id: string
          source_position: number | null
          title_raw: string | null
          upc: string | null
        }
        Insert: {
          artist_raw?: string | null
          artwork_url?: string | null
          created_at?: string
          explicit?: boolean | null
          external_url?: string | null
          id?: string
          isrc?: string | null
          preview_url?: string | null
          provider: string
          provider_artist_ids?: Json
          provider_release_id?: string | null
          provider_row_id?: string | null
          provider_track_id?: string | null
          raw_payload_hash?: string | null
          raw_payload_json?: Json
          release_date_raw?: string | null
          release_raw?: string | null
          run_id: string
          source_id: string
          source_position?: number | null
          title_raw?: string | null
          upc?: string | null
        }
        Update: {
          artist_raw?: string | null
          artwork_url?: string | null
          created_at?: string
          explicit?: boolean | null
          external_url?: string | null
          id?: string
          isrc?: string | null
          preview_url?: string | null
          provider?: string
          provider_artist_ids?: Json
          provider_release_id?: string | null
          provider_row_id?: string | null
          provider_track_id?: string | null
          raw_payload_hash?: string | null
          raw_payload_json?: Json
          release_date_raw?: string | null
          release_raw?: string | null
          run_id?: string
          source_id?: string
          source_position?: number | null
          title_raw?: string | null
          upc?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "chart_ingest_raw_rows_run_id_fkey"
            columns: ["run_id"]
            isOneToOne: false
            referencedRelation: "chart_ingest_runs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "chart_ingest_raw_rows_source_id_fkey"
            columns: ["source_id"]
            isOneToOne: false
            referencedRelation: "chart_ingest_run_sources"
            referencedColumns: ["id"]
          },
        ]
      }
      chart_ingest_review_issues: {
        Row: {
          blocking: boolean
          candidate_id: string | null
          created_at: string
          id: string
          issue_type: string
          message: string
          resolution_note: string | null
          resolved_at: string | null
          resolved_by: string | null
          run_id: string
          severity: string
          status: string
          updated_at: string
        }
        Insert: {
          blocking?: boolean
          candidate_id?: string | null
          created_at?: string
          id?: string
          issue_type: string
          message: string
          resolution_note?: string | null
          resolved_at?: string | null
          resolved_by?: string | null
          run_id: string
          severity?: string
          status?: string
          updated_at?: string
        }
        Update: {
          blocking?: boolean
          candidate_id?: string | null
          created_at?: string
          id?: string
          issue_type?: string
          message?: string
          resolution_note?: string | null
          resolved_at?: string | null
          resolved_by?: string | null
          run_id?: string
          severity?: string
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "chart_ingest_review_issues_candidate_id_fkey"
            columns: ["candidate_id"]
            isOneToOne: false
            referencedRelation: "chart_ingest_candidates"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "chart_ingest_review_issues_run_id_fkey"
            columns: ["run_id"]
            isOneToOne: false
            referencedRelation: "chart_ingest_runs"
            referencedColumns: ["id"]
          },
        ]
      }
      chart_ingest_run_sources: {
        Row: {
          created_at: string
          dropped_count: number
          enabled: boolean
          error_code: string | null
          error_message: string | null
          fetch_status: string | null
          fetched_count: number
          finished_at: string | null
          http_status: number | null
          id: string
          normalized_count: number
          priority: number
          provider: string
          provider_source_id: string | null
          rate_limit_bucket: string | null
          raw_payload_ref: string | null
          raw_response_hash: string | null
          retry_after_seconds: number | null
          run_id: string
          source_label: string | null
          source_type: string
          source_url: string | null
          started_at: string | null
          storefront_or_market: string | null
          warnings_json: Json
        }
        Insert: {
          created_at?: string
          dropped_count?: number
          enabled?: boolean
          error_code?: string | null
          error_message?: string | null
          fetch_status?: string | null
          fetched_count?: number
          finished_at?: string | null
          http_status?: number | null
          id?: string
          normalized_count?: number
          priority?: number
          provider: string
          provider_source_id?: string | null
          rate_limit_bucket?: string | null
          raw_payload_ref?: string | null
          raw_response_hash?: string | null
          retry_after_seconds?: number | null
          run_id: string
          source_label?: string | null
          source_type: string
          source_url?: string | null
          started_at?: string | null
          storefront_or_market?: string | null
          warnings_json?: Json
        }
        Update: {
          created_at?: string
          dropped_count?: number
          enabled?: boolean
          error_code?: string | null
          error_message?: string | null
          fetch_status?: string | null
          fetched_count?: number
          finished_at?: string | null
          http_status?: number | null
          id?: string
          normalized_count?: number
          priority?: number
          provider?: string
          provider_source_id?: string | null
          rate_limit_bucket?: string | null
          raw_payload_ref?: string | null
          raw_response_hash?: string | null
          retry_after_seconds?: number | null
          run_id?: string
          source_label?: string | null
          source_type?: string
          source_url?: string | null
          started_at?: string | null
          storefront_or_market?: string | null
          warnings_json?: Json
        }
        Relationships: [
          {
            foreignKeyName: "chart_ingest_run_sources_run_id_fkey"
            columns: ["run_id"]
            isOneToOne: false
            referencedRelation: "chart_ingest_runs"
            referencedColumns: ["id"]
          },
        ]
      }
      chart_ingest_runs: {
        Row: {
          chart_kind: string
          chart_size: number
          commit_edition_id: string | null
          commit_mode: string | null
          committed_at: string | null
          created_at: string
          created_by: string | null
          created_by_email: string | null
          dry_run_completed_at: string | null
          edition_date: string
          eligibility_policy_version: string
          eligibility_profile_id: string | null
          error_code: string | null
          error_message: string | null
          id: string
          market_scope_id: string | null
          market_scope_snapshot_json: Json
          market_slug: string | null
          methodology_version: string
          notes: string | null
          period_end: string
          period_start: string
          program_id: string
          published_at: string | null
          rule_snapshot_json: Json
          scoring_policy_version: string
          series_slug: string | null
          source_policy_version: string
          status: string
          updated_at: string
        }
        Insert: {
          chart_kind: string
          chart_size?: number
          commit_edition_id?: string | null
          commit_mode?: string | null
          committed_at?: string | null
          created_at?: string
          created_by?: string | null
          created_by_email?: string | null
          dry_run_completed_at?: string | null
          edition_date: string
          eligibility_policy_version?: string
          eligibility_profile_id?: string | null
          error_code?: string | null
          error_message?: string | null
          id?: string
          market_scope_id?: string | null
          market_scope_snapshot_json?: Json
          market_slug?: string | null
          methodology_version?: string
          notes?: string | null
          period_end: string
          period_start: string
          program_id: string
          published_at?: string | null
          rule_snapshot_json?: Json
          scoring_policy_version?: string
          series_slug?: string | null
          source_policy_version?: string
          status?: string
          updated_at?: string
        }
        Update: {
          chart_kind?: string
          chart_size?: number
          commit_edition_id?: string | null
          commit_mode?: string | null
          committed_at?: string | null
          created_at?: string
          created_by?: string | null
          created_by_email?: string | null
          dry_run_completed_at?: string | null
          edition_date?: string
          eligibility_policy_version?: string
          eligibility_profile_id?: string | null
          error_code?: string | null
          error_message?: string | null
          id?: string
          market_scope_id?: string | null
          market_scope_snapshot_json?: Json
          market_slug?: string | null
          methodology_version?: string
          notes?: string | null
          period_end?: string
          period_start?: string
          program_id?: string
          published_at?: string | null
          rule_snapshot_json?: Json
          scoring_policy_version?: string
          series_slug?: string | null
          source_policy_version?: string
          status?: string
          updated_at?: string
        }
        Relationships: []
      }
      chart_ingest_stage_events: {
        Row: {
          created_at: string
          duration_ms: number | null
          error_code: string | null
          error_message: string | null
          finished_at: string | null
          id: string
          message: string | null
          metrics_json: Json
          run_id: string
          stage: string
          started_at: string | null
          status: string
        }
        Insert: {
          created_at?: string
          duration_ms?: number | null
          error_code?: string | null
          error_message?: string | null
          finished_at?: string | null
          id?: string
          message?: string | null
          metrics_json?: Json
          run_id: string
          stage: string
          started_at?: string | null
          status?: string
        }
        Update: {
          created_at?: string
          duration_ms?: number | null
          error_code?: string | null
          error_message?: string | null
          finished_at?: string | null
          id?: string
          message?: string | null
          metrics_json?: Json
          run_id?: string
          stage?: string
          started_at?: string | null
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "chart_ingest_stage_events_run_id_fkey"
            columns: ["run_id"]
            isOneToOne: false
            referencedRelation: "chart_ingest_runs"
            referencedColumns: ["id"]
          },
        ]
      }
      chart_markets: {
        Row: {
          label: string | null
          slug: string
          status: string | null
        }
        Insert: {
          label?: string | null
          slug: string
          status?: string | null
        }
        Update: {
          label?: string | null
          slug?: string
          status?: string | null
        }
        Relationships: []
      }
      chart_origin_resolution_audit: {
        Row: {
          action: string
          actor_user_id: string | null
          artist_id: string | null
          candidate_id: string | null
          created_at: string
          id: string
          new_origin_iso2: string | null
          note: string | null
          previous_origin_iso2: string | null
          run_id: string | null
          source_slug: string | null
        }
        Insert: {
          action: string
          actor_user_id?: string | null
          artist_id?: string | null
          candidate_id?: string | null
          created_at?: string
          id?: string
          new_origin_iso2?: string | null
          note?: string | null
          previous_origin_iso2?: string | null
          run_id?: string | null
          source_slug?: string | null
        }
        Update: {
          action?: string
          actor_user_id?: string | null
          artist_id?: string | null
          candidate_id?: string | null
          created_at?: string
          id?: string
          new_origin_iso2?: string | null
          note?: string | null
          previous_origin_iso2?: string | null
          run_id?: string | null
          source_slug?: string | null
        }
        Relationships: []
      }
      chart_playback_provider_exceptions: {
        Row: {
          approved_by: string | null
          candidate_id: string
          created_at: string
          exception_type: string
          id: string
          note: string
          provider_key: string
          registry_track_id: string | null
          run_id: string
          source_url: string | null
        }
        Insert: {
          approved_by?: string | null
          candidate_id: string
          created_at?: string
          exception_type: string
          id?: string
          note: string
          provider_key?: string
          registry_track_id?: string | null
          run_id: string
          source_url?: string | null
        }
        Update: {
          approved_by?: string | null
          candidate_id?: string
          created_at?: string
          exception_type?: string
          id?: string
          note?: string
          provider_key?: string
          registry_track_id?: string | null
          run_id?: string
          source_url?: string | null
        }
        Relationships: []
      }
      chart_programs: {
        Row: {
          created_at: string | null
          default_chart_size: number | null
          default_methodology_version: string | null
          default_period_type: string | null
          id: string
          label: string
          market_slug: string | null
          public_slug: string
          series_slug: string | null
          status: string | null
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          default_chart_size?: number | null
          default_methodology_version?: string | null
          default_period_type?: string | null
          id?: string
          label: string
          market_slug?: string | null
          public_slug: string
          series_slug?: string | null
          status?: string | null
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          default_chart_size?: number | null
          default_methodology_version?: string | null
          default_period_type?: string | null
          id?: string
          label?: string
          market_slug?: string | null
          public_slug?: string
          series_slug?: string | null
          status?: string | null
          updated_at?: string | null
        }
        Relationships: []
      }
      chart_series: {
        Row: {
          label: string | null
          slug: string
          status: string | null
        }
        Insert: {
          label?: string | null
          slug: string
          status?: string | null
        }
        Update: {
          label?: string | null
          slug?: string
          status?: string | null
        }
        Relationships: []
      }
      community_activity: {
        Row: {
          activity_type: string
          comment_id: string | null
          created_at: string
          entity_id: string | null
          entity_slug: string | null
          entity_type: string | null
          id: string
          metadata: Json
          user_id: string
          visibility: string
        }
        Insert: {
          activity_type: string
          comment_id?: string | null
          created_at?: string
          entity_id?: string | null
          entity_slug?: string | null
          entity_type?: string | null
          id?: string
          metadata?: Json
          user_id: string
          visibility?: string
        }
        Update: {
          activity_type?: string
          comment_id?: string | null
          created_at?: string
          entity_id?: string | null
          entity_slug?: string | null
          entity_type?: string | null
          id?: string
          metadata?: Json
          user_id?: string
          visibility?: string
        }
        Relationships: [
          {
            foreignKeyName: "community_activity_comment_id_fkey"
            columns: ["comment_id"]
            isOneToOne: false
            referencedRelation: "community_comments"
            referencedColumns: ["id"]
          },
        ]
      }
      community_artist_username_reservations: {
        Row: {
          artist_id: string
          created_at: string
          source: string
          updated_at: string
          username: string
        }
        Insert: {
          artist_id: string
          created_at?: string
          source: string
          updated_at?: string
          username: string
        }
        Update: {
          artist_id?: string
          created_at?: string
          source?: string
          updated_at?: string
          username?: string
        }
        Relationships: [
          {
            foreignKeyName: "community_artist_username_reservations_artist_id_fkey"
            columns: ["artist_id"]
            isOneToOne: false
            referencedRelation: "registry_artists"
            referencedColumns: ["id"]
          },
        ]
      }
      community_blocks: {
        Row: {
          blocked_at: string
          created_at: string
          id: string
          status: string
          target_id: string
          target_slug: string | null
          target_type: string
          unblocked_at: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          blocked_at?: string
          created_at?: string
          id?: string
          status?: string
          target_id: string
          target_slug?: string | null
          target_type: string
          unblocked_at?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          blocked_at?: string
          created_at?: string
          id?: string
          status?: string
          target_id?: string
          target_slug?: string | null
          target_type?: string
          unblocked_at?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      community_comments: {
        Row: {
          anchor_end_time_ms: number | null
          anchor_label: string | null
          anchor_time_ms: number | null
          anchor_type: string | null
          author_id: string
          body_html: string | null
          body_markdown: string
          body_plain: string | null
          context_entity_id: string | null
          context_entity_slug: string | null
          context_entity_type: string | null
          context_label: string | null
          created_at: string
          deleted_at: string | null
          depth: number
          downvote_count: number
          edited_at: string | null
          id: string
          is_editor_pick: boolean
          is_pinned: boolean
          parent_id: string | null
          path: string | null
          reaction_count: number
          reply_count: number
          report_count: number
          root_id: string | null
          score: number
          status: string
          thread_id: string
          updated_at: string
          upvote_count: number
        }
        Insert: {
          anchor_end_time_ms?: number | null
          anchor_label?: string | null
          anchor_time_ms?: number | null
          anchor_type?: string | null
          author_id: string
          body_html?: string | null
          body_markdown: string
          body_plain?: string | null
          context_entity_id?: string | null
          context_entity_slug?: string | null
          context_entity_type?: string | null
          context_label?: string | null
          created_at?: string
          deleted_at?: string | null
          depth?: number
          downvote_count?: number
          edited_at?: string | null
          id?: string
          is_editor_pick?: boolean
          is_pinned?: boolean
          parent_id?: string | null
          path?: string | null
          reaction_count?: number
          reply_count?: number
          report_count?: number
          root_id?: string | null
          score?: number
          status?: string
          thread_id: string
          updated_at?: string
          upvote_count?: number
        }
        Update: {
          anchor_end_time_ms?: number | null
          anchor_label?: string | null
          anchor_time_ms?: number | null
          anchor_type?: string | null
          author_id?: string
          body_html?: string | null
          body_markdown?: string
          body_plain?: string | null
          context_entity_id?: string | null
          context_entity_slug?: string | null
          context_entity_type?: string | null
          context_label?: string | null
          created_at?: string
          deleted_at?: string | null
          depth?: number
          downvote_count?: number
          edited_at?: string | null
          id?: string
          is_editor_pick?: boolean
          is_pinned?: boolean
          parent_id?: string | null
          path?: string | null
          reaction_count?: number
          reply_count?: number
          report_count?: number
          root_id?: string | null
          score?: number
          status?: string
          thread_id?: string
          updated_at?: string
          upvote_count?: number
        }
        Relationships: [
          {
            foreignKeyName: "community_comments_parent_id_fkey"
            columns: ["parent_id"]
            isOneToOne: false
            referencedRelation: "community_comments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "community_comments_root_id_fkey"
            columns: ["root_id"]
            isOneToOne: false
            referencedRelation: "community_comments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "community_comments_thread_id_fkey"
            columns: ["thread_id"]
            isOneToOne: false
            referencedRelation: "community_threads"
            referencedColumns: ["id"]
          },
        ]
      }
      community_contributions: {
        Row: {
          contribution_type: string
          created_at: string
          entity_id: string | null
          entity_slug: string | null
          entity_type: string
          id: string
          payload: Json
          reviewed_at: string | null
          reviewed_by: string | null
          source_comment_id: string | null
          status: string
          updated_at: string
          user_id: string
        }
        Insert: {
          contribution_type: string
          created_at?: string
          entity_id?: string | null
          entity_slug?: string | null
          entity_type: string
          id?: string
          payload?: Json
          reviewed_at?: string | null
          reviewed_by?: string | null
          source_comment_id?: string | null
          status?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          contribution_type?: string
          created_at?: string
          entity_id?: string | null
          entity_slug?: string | null
          entity_type?: string
          id?: string
          payload?: Json
          reviewed_at?: string | null
          reviewed_by?: string | null
          source_comment_id?: string | null
          status?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "community_contributions_source_comment_id_fkey"
            columns: ["source_comment_id"]
            isOneToOne: false
            referencedRelation: "community_comments"
            referencedColumns: ["id"]
          },
        ]
      }
      community_follows: {
        Row: {
          created_at: string
          id: string
          target_id: string
          target_slug: string | null
          target_type: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          target_id: string
          target_slug?: string | null
          target_type: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          target_id?: string
          target_slug?: string | null
          target_type?: string
          user_id?: string
        }
        Relationships: []
      }
      community_moderation_events: {
        Row: {
          action: string
          created_at: string
          id: string
          metadata: Json
          moderator_id: string
          reason: string | null
          target_id: string
          target_type: string
        }
        Insert: {
          action: string
          created_at?: string
          id?: string
          metadata?: Json
          moderator_id: string
          reason?: string | null
          target_id: string
          target_type: string
        }
        Update: {
          action?: string
          created_at?: string
          id?: string
          metadata?: Json
          moderator_id?: string
          reason?: string | null
          target_id?: string
          target_type?: string
        }
        Relationships: []
      }
      community_notification_preferences: {
        Row: {
          artist_drops: boolean
          chart_alerts: boolean
          contribution_notifications: boolean
          created_at: string
          email_digest: boolean
          follow_notifications: boolean
          marketing_emails: boolean
          mention_notifications: boolean
          reply_notifications: boolean
          updated_at: string
          user_id: string
        }
        Insert: {
          artist_drops?: boolean
          chart_alerts?: boolean
          contribution_notifications?: boolean
          created_at?: string
          email_digest?: boolean
          follow_notifications?: boolean
          marketing_emails?: boolean
          mention_notifications?: boolean
          reply_notifications?: boolean
          updated_at?: string
          user_id: string
        }
        Update: {
          artist_drops?: boolean
          chart_alerts?: boolean
          contribution_notifications?: boolean
          created_at?: string
          email_digest?: boolean
          follow_notifications?: boolean
          marketing_emails?: boolean
          mention_notifications?: boolean
          reply_notifications?: boolean
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "community_notification_preferences_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: true
            referencedRelation: "community_profiles"
            referencedColumns: ["user_id"]
          },
        ]
      }
      community_notifications: {
        Row: {
          actor_id: string | null
          comment_id: string | null
          created_at: string
          entity_id: string | null
          entity_slug: string | null
          entity_type: string | null
          id: string
          metadata: Json
          notification_type: string
          read_at: string | null
          user_id: string
        }
        Insert: {
          actor_id?: string | null
          comment_id?: string | null
          created_at?: string
          entity_id?: string | null
          entity_slug?: string | null
          entity_type?: string | null
          id?: string
          metadata?: Json
          notification_type: string
          read_at?: string | null
          user_id: string
        }
        Update: {
          actor_id?: string | null
          comment_id?: string | null
          created_at?: string
          entity_id?: string | null
          entity_slug?: string | null
          entity_type?: string | null
          id?: string
          metadata?: Json
          notification_type?: string
          read_at?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "community_notifications_comment_id_fkey"
            columns: ["comment_id"]
            isOneToOne: false
            referencedRelation: "community_comments"
            referencedColumns: ["id"]
          },
        ]
      }
      community_post_mentions: {
        Row: {
          created_at: string
          handle_at_mention: string
          id: string
          mentioned_user_id: string | null
          person_resource_id: string
          post_id: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          handle_at_mention: string
          id?: string
          mentioned_user_id?: string | null
          person_resource_id: string
          post_id: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          handle_at_mention?: string
          id?: string
          mentioned_user_id?: string | null
          person_resource_id?: string
          post_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "community_post_mentions_post_fkey"
            columns: ["post_id"]
            isOneToOne: false
            referencedRelation: "artist_updates"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "community_post_mentions_post_fkey"
            columns: ["post_id"]
            isOneToOne: false
            referencedRelation: "community_posts"
            referencedColumns: ["id"]
          },
        ]
      }
      community_post_reposts: {
        Row: {
          actor_type: string
          artist_id: string | null
          author_user_id: string | null
          created_at: string
          id: string
          person_resource_id: string | null
          post_id: string
          representation_id: string | null
          status: string
          updated_at: string
          withdrawn_at: string | null
        }
        Insert: {
          actor_type: string
          artist_id?: string | null
          author_user_id?: string | null
          created_at?: string
          id?: string
          person_resource_id?: string | null
          post_id: string
          representation_id?: string | null
          status?: string
          updated_at?: string
          withdrawn_at?: string | null
        }
        Update: {
          actor_type?: string
          artist_id?: string | null
          author_user_id?: string | null
          created_at?: string
          id?: string
          person_resource_id?: string | null
          post_id?: string
          representation_id?: string | null
          status?: string
          updated_at?: string
          withdrawn_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "community_post_reposts_artist_id_fkey"
            columns: ["artist_id"]
            isOneToOne: false
            referencedRelation: "registry_artists"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "community_post_reposts_post_id_fkey"
            columns: ["post_id"]
            isOneToOne: false
            referencedRelation: "artist_updates"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "community_post_reposts_post_id_fkey"
            columns: ["post_id"]
            isOneToOne: false
            referencedRelation: "community_posts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "community_post_reposts_representation_id_fkey"
            columns: ["representation_id"]
            isOneToOne: false
            referencedRelation: "artist_representations"
            referencedColumns: ["id"]
          },
        ]
      }
      community_post_threads: {
        Row: {
          actor_type: string
          artist_id: string | null
          author_user_id: string
          created_at: string
          id: string
          person_resource_id: string | null
          published_at: string
        }
        Insert: {
          actor_type: string
          artist_id?: string | null
          author_user_id: string
          created_at?: string
          id?: string
          person_resource_id?: string | null
          published_at?: string
        }
        Update: {
          actor_type?: string
          artist_id?: string | null
          author_user_id?: string
          created_at?: string
          id?: string
          person_resource_id?: string | null
          published_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "community_post_threads_artist_fkey"
            columns: ["artist_id"]
            isOneToOne: false
            referencedRelation: "registry_artists"
            referencedColumns: ["id"]
          },
        ]
      }
      community_posts: {
        Row: {
          actor_type: string
          artist_id: string | null
          author_user_id: string | null
          body: string
          created_at: string
          id: string
          image_url: string | null
          link_label: string | null
          link_url: string | null
          person_resource_id: string | null
          published_at: string
          quoted_post_id: string | null
          registry_track_id: string | null
          representation_id: string | null
          status: string
          thread_id: string | null
          thread_position: number | null
          updated_at: string
          withdrawn_at: string | null
        }
        Insert: {
          actor_type?: string
          artist_id?: string | null
          author_user_id?: string | null
          body: string
          created_at?: string
          id?: string
          image_url?: string | null
          link_label?: string | null
          link_url?: string | null
          person_resource_id?: string | null
          published_at?: string
          quoted_post_id?: string | null
          registry_track_id?: string | null
          representation_id?: string | null
          status?: string
          thread_id?: string | null
          thread_position?: number | null
          updated_at?: string
          withdrawn_at?: string | null
        }
        Update: {
          actor_type?: string
          artist_id?: string | null
          author_user_id?: string | null
          body?: string
          created_at?: string
          id?: string
          image_url?: string | null
          link_label?: string | null
          link_url?: string | null
          person_resource_id?: string | null
          published_at?: string
          quoted_post_id?: string | null
          registry_track_id?: string | null
          representation_id?: string | null
          status?: string
          thread_id?: string | null
          thread_position?: number | null
          updated_at?: string
          withdrawn_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "artist_updates_artist_id_fkey"
            columns: ["artist_id"]
            isOneToOne: false
            referencedRelation: "registry_artists"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "artist_updates_representation_id_fkey"
            columns: ["representation_id"]
            isOneToOne: false
            referencedRelation: "artist_representations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "community_posts_quoted_post_id_fkey"
            columns: ["quoted_post_id"]
            isOneToOne: false
            referencedRelation: "artist_updates"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "community_posts_quoted_post_id_fkey"
            columns: ["quoted_post_id"]
            isOneToOne: false
            referencedRelation: "community_posts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "community_posts_registry_track_id_fkey"
            columns: ["registry_track_id"]
            isOneToOne: false
            referencedRelation: "registry_tracks"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "community_posts_thread_id_fkey"
            columns: ["thread_id"]
            isOneToOne: false
            referencedRelation: "community_post_threads"
            referencedColumns: ["id"]
          },
        ]
      }
      community_profiles: {
        Row: {
          avatar_url: string | null
          bio: string | null
          city: string | null
          comment_count: number
          contribution_count: number
          country: string | null
          created_at: string
          display_name: string | null
          is_public: boolean
          reputation_score: number
          role_labels: string[] | null
          trust_level: number
          updated_at: string
          user_id: string
          username: string
        }
        Insert: {
          avatar_url?: string | null
          bio?: string | null
          city?: string | null
          comment_count?: number
          contribution_count?: number
          country?: string | null
          created_at?: string
          display_name?: string | null
          is_public?: boolean
          reputation_score?: number
          role_labels?: string[] | null
          trust_level?: number
          updated_at?: string
          user_id: string
          username: string
        }
        Update: {
          avatar_url?: string | null
          bio?: string | null
          city?: string | null
          comment_count?: number
          contribution_count?: number
          country?: string | null
          created_at?: string
          display_name?: string | null
          is_public?: boolean
          reputation_score?: number
          role_labels?: string[] | null
          trust_level?: number
          updated_at?: string
          user_id?: string
          username?: string
        }
        Relationships: []
      }
      community_reactions: {
        Row: {
          created_at: string
          id: string
          reaction_type: string
          target_id: string
          target_type: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          reaction_type: string
          target_id: string
          target_type: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          reaction_type?: string
          target_id?: string
          target_type?: string
          user_id?: string
        }
        Relationships: []
      }
      community_reports: {
        Row: {
          comment_id: string | null
          created_at: string
          details: string | null
          id: string
          post_id: string | null
          profile_id: string | null
          reason: string
          reporter_id: string
          reviewed_at: string | null
          reviewed_by: string | null
          status: string
        }
        Insert: {
          comment_id?: string | null
          created_at?: string
          details?: string | null
          id?: string
          post_id?: string | null
          profile_id?: string | null
          reason: string
          reporter_id: string
          reviewed_at?: string | null
          reviewed_by?: string | null
          status?: string
        }
        Update: {
          comment_id?: string | null
          created_at?: string
          details?: string | null
          id?: string
          post_id?: string | null
          profile_id?: string | null
          reason?: string
          reporter_id?: string
          reviewed_at?: string | null
          reviewed_by?: string | null
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "community_reports_comment_id_fkey"
            columns: ["comment_id"]
            isOneToOne: false
            referencedRelation: "community_comments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "community_reports_post_id_fkey"
            columns: ["post_id"]
            isOneToOne: false
            referencedRelation: "artist_updates"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "community_reports_post_id_fkey"
            columns: ["post_id"]
            isOneToOne: false
            referencedRelation: "community_posts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "community_reports_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: false
            referencedRelation: "community_profiles"
            referencedColumns: ["user_id"]
          },
        ]
      }
      community_reserved_usernames: {
        Row: {
          created_at: string
          reason: string
          username: string
        }
        Insert: {
          created_at?: string
          reason?: string
          username: string
        }
        Update: {
          created_at?: string
          reason?: string
          username?: string
        }
        Relationships: []
      }
      community_saves: {
        Row: {
          created_at: string
          entity_id: string | null
          entity_slug: string | null
          entity_type: string
          entity_url: string | null
          id: string
          image_url: string | null
          subtitle: string | null
          title: string
          user_id: string
        }
        Insert: {
          created_at?: string
          entity_id?: string | null
          entity_slug?: string | null
          entity_type: string
          entity_url?: string | null
          id?: string
          image_url?: string | null
          subtitle?: string | null
          title: string
          user_id: string
        }
        Update: {
          created_at?: string
          entity_id?: string | null
          entity_slug?: string | null
          entity_type?: string
          entity_url?: string | null
          id?: string
          image_url?: string | null
          subtitle?: string | null
          title?: string
          user_id?: string
        }
        Relationships: []
      }
      community_threads: {
        Row: {
          comment_count: number
          created_at: string
          entity_id: string | null
          entity_slug: string | null
          entity_type: string
          entity_url: string | null
          id: string
          last_comment_at: string | null
          root_comment_count: number
          status: string
          title: string
          updated_at: string
        }
        Insert: {
          comment_count?: number
          created_at?: string
          entity_id?: string | null
          entity_slug?: string | null
          entity_type: string
          entity_url?: string | null
          id?: string
          last_comment_at?: string | null
          root_comment_count?: number
          status?: string
          title: string
          updated_at?: string
        }
        Update: {
          comment_count?: number
          created_at?: string
          entity_id?: string | null
          entity_slug?: string | null
          entity_type?: string
          entity_url?: string | null
          id?: string
          last_comment_at?: string | null
          root_comment_count?: number
          status?: string
          title?: string
          updated_at?: string
        }
        Relationships: []
      }
      community_votes: {
        Row: {
          comment_id: string
          created_at: string
          id: string
          updated_at: string
          user_id: string
          vote_value: number
        }
        Insert: {
          comment_id: string
          created_at?: string
          id?: string
          updated_at?: string
          user_id: string
          vote_value: number
        }
        Update: {
          comment_id?: string
          created_at?: string
          id?: string
          updated_at?: string
          user_id?: string
          vote_value?: number
        }
        Relationships: [
          {
            foreignKeyName: "community_votes_comment_id_fkey"
            columns: ["comment_id"]
            isOneToOne: false
            referencedRelation: "community_comments"
            referencedColumns: ["id"]
          },
        ]
      }
      contributor_submissions: {
        Row: {
          accepted_evidence_id: string | null
          accepted_relationship_id: string | null
          body: string
          consent_status: string
          contributor_id: string
          correction_id: string | null
          created_at: string
          entity_id: string | null
          id: string
          inquiry_id: string | null
          review_note: string | null
          review_status: string
          reviewed_at: string | null
          reviewed_by: string | null
          source_note: string | null
          source_url: string | null
          submission_type: string
          title: string | null
          updated_at: string
        }
        Insert: {
          accepted_evidence_id?: string | null
          accepted_relationship_id?: string | null
          body: string
          consent_status?: string
          contributor_id: string
          correction_id?: string | null
          created_at?: string
          entity_id?: string | null
          id?: string
          inquiry_id?: string | null
          review_note?: string | null
          review_status?: string
          reviewed_at?: string | null
          reviewed_by?: string | null
          source_note?: string | null
          source_url?: string | null
          submission_type: string
          title?: string | null
          updated_at?: string
        }
        Update: {
          accepted_evidence_id?: string | null
          accepted_relationship_id?: string | null
          body?: string
          consent_status?: string
          contributor_id?: string
          correction_id?: string | null
          created_at?: string
          entity_id?: string | null
          id?: string
          inquiry_id?: string | null
          review_note?: string | null
          review_status?: string
          reviewed_at?: string | null
          reviewed_by?: string | null
          source_note?: string | null
          source_url?: string | null
          submission_type?: string
          title?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "contributor_submissions_accepted_evidence_id_fkey"
            columns: ["accepted_evidence_id"]
            isOneToOne: false
            referencedRelation: "evidence_items"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "contributor_submissions_accepted_evidence_id_fkey"
            columns: ["accepted_evidence_id"]
            isOneToOne: false
            referencedRelation: "institute_admin_inquiry_evidence"
            referencedColumns: ["evidence_id"]
          },
          {
            foreignKeyName: "contributor_submissions_accepted_evidence_id_fkey"
            columns: ["accepted_evidence_id"]
            isOneToOne: false
            referencedRelation: "institute_retrieval_ready_evidence"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "contributor_submissions_accepted_evidence_id_fkey"
            columns: ["accepted_evidence_id"]
            isOneToOne: false
            referencedRelation: "institute_review_queue_evidence"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "contributor_submissions_accepted_relationship_id_fkey"
            columns: ["accepted_relationship_id"]
            isOneToOne: false
            referencedRelation: "entity_relationships"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "contributor_submissions_accepted_relationship_id_fkey"
            columns: ["accepted_relationship_id"]
            isOneToOne: false
            referencedRelation: "institute_admin_entity_relationships"
            referencedColumns: ["relationship_id"]
          },
          {
            foreignKeyName: "contributor_submissions_contributor_id_fkey"
            columns: ["contributor_id"]
            isOneToOne: false
            referencedRelation: "contributors"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "contributor_submissions_correction_fk"
            columns: ["correction_id"]
            isOneToOne: false
            referencedRelation: "corrections"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "contributor_submissions_entity_id_fkey"
            columns: ["entity_id"]
            isOneToOne: false
            referencedRelation: "cultural_entities"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "contributor_submissions_inquiry_id_fkey"
            columns: ["inquiry_id"]
            isOneToOne: false
            referencedRelation: "inquiries"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "contributor_submissions_inquiry_id_fkey"
            columns: ["inquiry_id"]
            isOneToOne: false
            referencedRelation: "institute_admin_inquiry_evidence"
            referencedColumns: ["inquiry_id"]
          },
        ]
      }
      contributors: {
        Row: {
          contributor_status: string
          created_at: string
          display_name: string
          id: string
          role_note: string | null
          trust_level: string
          updated_at: string
          user_id: string | null
        }
        Insert: {
          contributor_status?: string
          created_at?: string
          display_name: string
          id?: string
          role_note?: string | null
          trust_level?: string
          updated_at?: string
          user_id?: string | null
        }
        Update: {
          contributor_status?: string
          created_at?: string
          display_name?: string
          id?: string
          role_note?: string | null
          trust_level?: string
          updated_at?: string
          user_id?: string | null
        }
        Relationships: []
      }
      corrections: {
        Row: {
          correction_status: string
          correction_text: string
          created_at: string
          id: string
          review_note: string | null
          reviewed_at: string | null
          reviewed_by: string | null
          subject_id: string
          subject_type: string
          submitted_by: string | null
        }
        Insert: {
          correction_status?: string
          correction_text: string
          created_at?: string
          id?: string
          review_note?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          subject_id: string
          subject_type: string
          submitted_by?: string | null
        }
        Update: {
          correction_status?: string
          correction_text?: string
          created_at?: string
          id?: string
          review_note?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          subject_id?: string
          subject_type?: string
          submitted_by?: string | null
        }
        Relationships: []
      }
      cultural_entities: {
        Row: {
          canonical_source_id: string | null
          canonical_source_table: string | null
          created_at: string
          description: string | null
          entity_type: string
          id: string
          metadata: Json
          name: string
          public_safe: boolean
          review_note: string | null
          review_status: string
          reviewed_at: string | null
          reviewed_by: string | null
          slug: string | null
          source_id: string | null
          source_table: string | null
          status: string
          updated_at: string
        }
        Insert: {
          canonical_source_id?: string | null
          canonical_source_table?: string | null
          created_at?: string
          description?: string | null
          entity_type: string
          id?: string
          metadata?: Json
          name: string
          public_safe?: boolean
          review_note?: string | null
          review_status?: string
          reviewed_at?: string | null
          reviewed_by?: string | null
          slug?: string | null
          source_id?: string | null
          source_table?: string | null
          status?: string
          updated_at?: string
        }
        Update: {
          canonical_source_id?: string | null
          canonical_source_table?: string | null
          created_at?: string
          description?: string | null
          entity_type?: string
          id?: string
          metadata?: Json
          name?: string
          public_safe?: boolean
          review_note?: string | null
          review_status?: string
          reviewed_at?: string | null
          reviewed_by?: string | null
          slug?: string | null
          source_id?: string | null
          source_table?: string | null
          status?: string
          updated_at?: string
        }
        Relationships: []
      }
      entity_relationships: {
        Row: {
          confidence: string
          created_at: string
          created_by: string | null
          id: string
          public_safe: boolean
          reason: string
          relationship_type: string
          review_note: string | null
          review_status: string
          reviewed_at: string | null
          reviewed_by: string | null
          source_entity_id: string
          target_entity_id: string
          updated_at: string
        }
        Insert: {
          confidence?: string
          created_at?: string
          created_by?: string | null
          id?: string
          public_safe?: boolean
          reason: string
          relationship_type: string
          review_note?: string | null
          review_status?: string
          reviewed_at?: string | null
          reviewed_by?: string | null
          source_entity_id: string
          target_entity_id: string
          updated_at?: string
        }
        Update: {
          confidence?: string
          created_at?: string
          created_by?: string | null
          id?: string
          public_safe?: boolean
          reason?: string
          relationship_type?: string
          review_note?: string | null
          review_status?: string
          reviewed_at?: string | null
          reviewed_by?: string | null
          source_entity_id?: string
          target_entity_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "entity_relationships_source_entity_id_fkey"
            columns: ["source_entity_id"]
            isOneToOne: false
            referencedRelation: "cultural_entities"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "entity_relationships_target_entity_id_fkey"
            columns: ["target_entity_id"]
            isOneToOne: false
            referencedRelation: "cultural_entities"
            referencedColumns: ["id"]
          },
        ]
      }
      evidence_items: {
        Row: {
          confidence: string
          created_at: string
          created_by: string | null
          evidence_type: string
          id: string
          main_claim: string | null
          reliability: string
          retrieval_status: string
          review_status: string
          reviewed_at: string | null
          reviewed_by: string | null
          source_file: string | null
          source_note: string | null
          source_url: string | null
          summary: string
          title: string
          updated_at: string
          why_it_matters: string | null
        }
        Insert: {
          confidence?: string
          created_at?: string
          created_by?: string | null
          evidence_type: string
          id?: string
          main_claim?: string | null
          reliability?: string
          retrieval_status?: string
          review_status?: string
          reviewed_at?: string | null
          reviewed_by?: string | null
          source_file?: string | null
          source_note?: string | null
          source_url?: string | null
          summary: string
          title: string
          updated_at?: string
          why_it_matters?: string | null
        }
        Update: {
          confidence?: string
          created_at?: string
          created_by?: string | null
          evidence_type?: string
          id?: string
          main_claim?: string | null
          reliability?: string
          retrieval_status?: string
          review_status?: string
          reviewed_at?: string | null
          reviewed_by?: string | null
          source_file?: string | null
          source_note?: string | null
          source_url?: string | null
          summary?: string
          title?: string
          updated_at?: string
          why_it_matters?: string | null
        }
        Relationships: []
      }
      evidence_review_events: {
        Row: {
          created_at: string
          decided_by: string | null
          decision: string
          decision_note: string | null
          evidence_id: string
          id: string
          next_retrieval_status: string
          next_review_status: string
          previous_retrieval_status: string | null
          previous_review_status: string | null
        }
        Insert: {
          created_at?: string
          decided_by?: string | null
          decision: string
          decision_note?: string | null
          evidence_id: string
          id?: string
          next_retrieval_status: string
          next_review_status: string
          previous_retrieval_status?: string | null
          previous_review_status?: string | null
        }
        Update: {
          created_at?: string
          decided_by?: string | null
          decision?: string
          decision_note?: string | null
          evidence_id?: string
          id?: string
          next_retrieval_status?: string
          next_review_status?: string
          previous_retrieval_status?: string | null
          previous_review_status?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "evidence_review_events_evidence_id_fkey"
            columns: ["evidence_id"]
            isOneToOne: false
            referencedRelation: "evidence_items"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "evidence_review_events_evidence_id_fkey"
            columns: ["evidence_id"]
            isOneToOne: false
            referencedRelation: "institute_admin_inquiry_evidence"
            referencedColumns: ["evidence_id"]
          },
          {
            foreignKeyName: "evidence_review_events_evidence_id_fkey"
            columns: ["evidence_id"]
            isOneToOne: false
            referencedRelation: "institute_retrieval_ready_evidence"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "evidence_review_events_evidence_id_fkey"
            columns: ["evidence_id"]
            isOneToOne: false
            referencedRelation: "institute_review_queue_evidence"
            referencedColumns: ["id"]
          },
        ]
      }
      form_submissions: {
        Row: {
          created_at: string
          data: Json
          form_type: string
          id: string
          submitter_ip: string | null
        }
        Insert: {
          created_at?: string
          data?: Json
          form_type: string
          id?: string
          submitter_ip?: string | null
        }
        Update: {
          created_at?: string
          data?: Json
          form_type?: string
          id?: string
          submitter_ip?: string | null
        }
        Relationships: []
      }
      gsc_connections: {
        Row: {
          access_token: string | null
          connected_at: string | null
          created_at: string | null
          created_by: string | null
          disconnected_at: string | null
          id: string
          last_import_at: string | null
          oauth_state: string | null
          property_type: string | null
          property_url: string
          refresh_token: string | null
          status: string | null
          token_expiry: string | null
          updated_at: string | null
        }
        Insert: {
          access_token?: string | null
          connected_at?: string | null
          created_at?: string | null
          created_by?: string | null
          disconnected_at?: string | null
          id?: string
          last_import_at?: string | null
          oauth_state?: string | null
          property_type?: string | null
          property_url: string
          refresh_token?: string | null
          status?: string | null
          token_expiry?: string | null
          updated_at?: string | null
        }
        Update: {
          access_token?: string | null
          connected_at?: string | null
          created_at?: string | null
          created_by?: string | null
          disconnected_at?: string | null
          id?: string
          last_import_at?: string | null
          oauth_state?: string | null
          property_type?: string | null
          property_url?: string
          refresh_token?: string | null
          status?: string | null
          token_expiry?: string | null
          updated_at?: string | null
        }
        Relationships: []
      }
      gsc_entity_matches: {
        Row: {
          confidence: number | null
          created_at: string | null
          id: string
          match_method: string | null
          matched_entity_id: string | null
          matched_entity_slug: string | null
          matched_entity_type: string | null
          metric_id: string | null
          page: string | null
          query: string | null
          reviewed: boolean | null
          updated_at: string | null
        }
        Insert: {
          confidence?: number | null
          created_at?: string | null
          id?: string
          match_method?: string | null
          matched_entity_id?: string | null
          matched_entity_slug?: string | null
          matched_entity_type?: string | null
          metric_id?: string | null
          page?: string | null
          query?: string | null
          reviewed?: boolean | null
          updated_at?: string | null
        }
        Update: {
          confidence?: number | null
          created_at?: string | null
          id?: string
          match_method?: string | null
          matched_entity_id?: string | null
          matched_entity_slug?: string | null
          matched_entity_type?: string | null
          metric_id?: string | null
          page?: string | null
          query?: string | null
          reviewed?: boolean | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "gsc_entity_matches_metric_id_fkey"
            columns: ["metric_id"]
            isOneToOne: false
            referencedRelation: "gsc_query_page_metrics"
            referencedColumns: ["id"]
          },
        ]
      }
      gsc_import_runs: {
        Row: {
          completed_at: string | null
          connection_id: string | null
          created_at: string | null
          date_range_end: string | null
          date_range_start: string | null
          error_message: string | null
          id: string
          rows_failed: number | null
          rows_imported: number | null
          rows_matched: number | null
          started_at: string | null
          status: string | null
        }
        Insert: {
          completed_at?: string | null
          connection_id?: string | null
          created_at?: string | null
          date_range_end?: string | null
          date_range_start?: string | null
          error_message?: string | null
          id?: string
          rows_failed?: number | null
          rows_imported?: number | null
          rows_matched?: number | null
          started_at?: string | null
          status?: string | null
        }
        Update: {
          completed_at?: string | null
          connection_id?: string | null
          created_at?: string | null
          date_range_end?: string | null
          date_range_start?: string | null
          error_message?: string | null
          id?: string
          rows_failed?: number | null
          rows_imported?: number | null
          rows_matched?: number | null
          started_at?: string | null
          status?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "gsc_import_runs_connection_id_fkey"
            columns: ["connection_id"]
            isOneToOne: false
            referencedRelation: "gsc_connections"
            referencedColumns: ["id"]
          },
        ]
      }
      gsc_query_page_metrics: {
        Row: {
          clicks: number | null
          created_at: string | null
          ctr: number | null
          date_range_end: string | null
          date_range_start: string | null
          id: string
          import_run_id: string | null
          impressions: number | null
          metric_date: string | null
          page: string | null
          position: number | null
          property_url: string | null
          query: string
        }
        Insert: {
          clicks?: number | null
          created_at?: string | null
          ctr?: number | null
          date_range_end?: string | null
          date_range_start?: string | null
          id?: string
          import_run_id?: string | null
          impressions?: number | null
          metric_date?: string | null
          page?: string | null
          position?: number | null
          property_url?: string | null
          query: string
        }
        Update: {
          clicks?: number | null
          created_at?: string | null
          ctr?: number | null
          date_range_end?: string | null
          date_range_start?: string | null
          id?: string
          import_run_id?: string | null
          impressions?: number | null
          metric_date?: string | null
          page?: string | null
          position?: number | null
          property_url?: string | null
          query?: string
        }
        Relationships: [
          {
            foreignKeyName: "gsc_query_page_metrics_import_run_id_fkey"
            columns: ["import_run_id"]
            isOneToOne: false
            referencedRelation: "gsc_import_runs"
            referencedColumns: ["id"]
          },
        ]
      }
      guide_pages: {
        Row: {
          color_var: string | null
          content_html: string | null
          content_text: string | null
          download_label: string | null
          download_url: string | null
          downloadables: Json
          excerpt: string | null
          framing: string | null
          guide_format: string | null
          hero_image_id: string | null
          hero_url: string | null
          icon: string | null
          id: string
          metadata: Json
          pillar: string | null
          published_at: string | null
          sections: Json
          slug: string
          source_wp_post_id: number | null
          status: string
          subtitle: string | null
          title: string
          updated_at: string | null
        }
        Insert: {
          color_var?: string | null
          content_html?: string | null
          content_text?: string | null
          download_label?: string | null
          download_url?: string | null
          downloadables?: Json
          excerpt?: string | null
          framing?: string | null
          guide_format?: string | null
          hero_image_id?: string | null
          hero_url?: string | null
          icon?: string | null
          id?: string
          metadata?: Json
          pillar?: string | null
          published_at?: string | null
          sections?: Json
          slug: string
          source_wp_post_id?: number | null
          status?: string
          subtitle?: string | null
          title: string
          updated_at?: string | null
        }
        Update: {
          color_var?: string | null
          content_html?: string | null
          content_text?: string | null
          download_label?: string | null
          download_url?: string | null
          downloadables?: Json
          excerpt?: string | null
          framing?: string | null
          guide_format?: string | null
          hero_image_id?: string | null
          hero_url?: string | null
          icon?: string | null
          id?: string
          metadata?: Json
          pillar?: string | null
          published_at?: string | null
          sections?: Json
          slug?: string
          source_wp_post_id?: number | null
          status?: string
          subtitle?: string | null
          title?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "guide_pages_hero_image_id_fkey"
            columns: ["hero_image_id"]
            isOneToOne: false
            referencedRelation: "registry_media_assets"
            referencedColumns: ["id"]
          },
        ]
      }
      guides: {
        Row: {
          content: string | null
          created_at: string | null
          dek: string | null
          download_label: string | null
          download_url: string | null
          downloadables: Json
          excerpt: string | null
          hero_image_id: string | null
          hero_url: string | null
          id: string
          metadata: Json
          published_at: string | null
          slug: string | null
          source_wp_post_id: number | null
          status: string
          title: string
          updated_at: string | null
        }
        Insert: {
          content?: string | null
          created_at?: string | null
          dek?: string | null
          download_label?: string | null
          download_url?: string | null
          downloadables?: Json
          excerpt?: string | null
          hero_image_id?: string | null
          hero_url?: string | null
          id?: string
          metadata?: Json
          published_at?: string | null
          slug?: string | null
          source_wp_post_id?: number | null
          status?: string
          title: string
          updated_at?: string | null
        }
        Update: {
          content?: string | null
          created_at?: string | null
          dek?: string | null
          download_label?: string | null
          download_url?: string | null
          downloadables?: Json
          excerpt?: string | null
          hero_image_id?: string | null
          hero_url?: string | null
          id?: string
          metadata?: Json
          published_at?: string | null
          slug?: string | null
          source_wp_post_id?: number | null
          status?: string
          title?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "guides_hero_image_id_fkey"
            columns: ["hero_image_id"]
            isOneToOne: false
            referencedRelation: "registry_media_assets"
            referencedColumns: ["id"]
          },
        ]
      }
      inference_profiles: {
        Row: {
          created_at: string
          created_by: string | null
          display_name: string
          fallback_model_id: string | null
          id: string
          max_output_tokens: number | null
          notes: string | null
          primary_model_id: string | null
          profile_key: string
          requires_human_review: boolean
          requires_source_logging: boolean
          requires_structured_output: boolean
          status: string
          task_type: string
          temperature: number | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          display_name: string
          fallback_model_id?: string | null
          id?: string
          max_output_tokens?: number | null
          notes?: string | null
          primary_model_id?: string | null
          profile_key: string
          requires_human_review?: boolean
          requires_source_logging?: boolean
          requires_structured_output?: boolean
          status?: string
          task_type: string
          temperature?: number | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          display_name?: string
          fallback_model_id?: string | null
          id?: string
          max_output_tokens?: number | null
          notes?: string | null
          primary_model_id?: string | null
          profile_key?: string
          requires_human_review?: boolean
          requires_source_logging?: boolean
          requires_structured_output?: boolean
          status?: string
          task_type?: string
          temperature?: number | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "inference_profiles_fallback_model_id_fkey"
            columns: ["fallback_model_id"]
            isOneToOne: false
            referencedRelation: "model_registry"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "inference_profiles_primary_model_id_fkey"
            columns: ["primary_model_id"]
            isOneToOne: false
            referencedRelation: "model_registry"
            referencedColumns: ["id"]
          },
        ]
      }
      inquiries: {
        Row: {
          closed_at: string | null
          created_at: string
          current_understanding: string | null
          id: string
          inquiry_number: string
          opened_at: string
          owner_id: string | null
          primary_question: string
          short_question: string | null
          slug: string
          status: string
          summary: string | null
          title: string
          updated_at: string
          visibility: string
          why_it_matters: string
        }
        Insert: {
          closed_at?: string | null
          created_at?: string
          current_understanding?: string | null
          id?: string
          inquiry_number: string
          opened_at?: string
          owner_id?: string | null
          primary_question: string
          short_question?: string | null
          slug: string
          status?: string
          summary?: string | null
          title: string
          updated_at?: string
          visibility?: string
          why_it_matters: string
        }
        Update: {
          closed_at?: string | null
          created_at?: string
          current_understanding?: string | null
          id?: string
          inquiry_number?: string
          opened_at?: string
          owner_id?: string | null
          primary_question?: string
          short_question?: string | null
          slug?: string
          status?: string
          summary?: string | null
          title?: string
          updated_at?: string
          visibility?: string
          why_it_matters?: string
        }
        Relationships: []
      }
      inquiry_entities: {
        Row: {
          added_by: string | null
          created_at: string
          entity_id: string
          entity_role: string
          id: string
          inquiry_id: string
          link_note: string | null
        }
        Insert: {
          added_by?: string | null
          created_at?: string
          entity_id: string
          entity_role?: string
          id?: string
          inquiry_id: string
          link_note?: string | null
        }
        Update: {
          added_by?: string | null
          created_at?: string
          entity_id?: string
          entity_role?: string
          id?: string
          inquiry_id?: string
          link_note?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "inquiry_entities_entity_id_fkey"
            columns: ["entity_id"]
            isOneToOne: false
            referencedRelation: "cultural_entities"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "inquiry_entities_inquiry_id_fkey"
            columns: ["inquiry_id"]
            isOneToOne: false
            referencedRelation: "inquiries"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "inquiry_entities_inquiry_id_fkey"
            columns: ["inquiry_id"]
            isOneToOne: false
            referencedRelation: "institute_admin_inquiry_evidence"
            referencedColumns: ["inquiry_id"]
          },
        ]
      }
      inquiry_evidence: {
        Row: {
          added_at: string
          added_by: string | null
          evidence_id: string
          inquiry_id: string
          use_note: string | null
        }
        Insert: {
          added_at?: string
          added_by?: string | null
          evidence_id: string
          inquiry_id: string
          use_note?: string | null
        }
        Update: {
          added_at?: string
          added_by?: string | null
          evidence_id?: string
          inquiry_id?: string
          use_note?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "inquiry_evidence_evidence_id_fkey"
            columns: ["evidence_id"]
            isOneToOne: false
            referencedRelation: "evidence_items"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "inquiry_evidence_evidence_id_fkey"
            columns: ["evidence_id"]
            isOneToOne: false
            referencedRelation: "institute_admin_inquiry_evidence"
            referencedColumns: ["evidence_id"]
          },
          {
            foreignKeyName: "inquiry_evidence_evidence_id_fkey"
            columns: ["evidence_id"]
            isOneToOne: false
            referencedRelation: "institute_retrieval_ready_evidence"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "inquiry_evidence_evidence_id_fkey"
            columns: ["evidence_id"]
            isOneToOne: false
            referencedRelation: "institute_review_queue_evidence"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "inquiry_evidence_inquiry_id_fkey"
            columns: ["inquiry_id"]
            isOneToOne: false
            referencedRelation: "inquiries"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "inquiry_evidence_inquiry_id_fkey"
            columns: ["inquiry_id"]
            isOneToOne: false
            referencedRelation: "institute_admin_inquiry_evidence"
            referencedColumns: ["inquiry_id"]
          },
        ]
      }
      inquiry_notes: {
        Row: {
          body: string
          confidence: string
          created_at: string
          created_by: string | null
          id: string
          inquiry_id: string
          note_type: string
          title: string | null
        }
        Insert: {
          body: string
          confidence?: string
          created_at?: string
          created_by?: string | null
          id?: string
          inquiry_id: string
          note_type: string
          title?: string | null
        }
        Update: {
          body?: string
          confidence?: string
          created_at?: string
          created_by?: string | null
          id?: string
          inquiry_id?: string
          note_type?: string
          title?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "inquiry_notes_inquiry_id_fkey"
            columns: ["inquiry_id"]
            isOneToOne: false
            referencedRelation: "inquiries"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "inquiry_notes_inquiry_id_fkey"
            columns: ["inquiry_id"]
            isOneToOne: false
            referencedRelation: "institute_admin_inquiry_evidence"
            referencedColumns: ["inquiry_id"]
          },
        ]
      }
      institute_anchor_context_snapshots: {
        Row: {
          anchor_entity_type: string
          anchor_label: string
          anchor_slug: string | null
          created_at: string
          created_by: string | null
          evidence_gaps: Json
          id: string
          inquiry_anchor_id: string
          inquiry_id: string
          knowns: Json
          related_entities: Json
          relationship_leads: Json
          snapshot_version: number
          source_context: Json
          source_references: Json
          thin_data_notes: Json
          unknowns: Json
        }
        Insert: {
          anchor_entity_type: string
          anchor_label: string
          anchor_slug?: string | null
          created_at?: string
          created_by?: string | null
          evidence_gaps?: Json
          id?: string
          inquiry_anchor_id: string
          inquiry_id: string
          knowns?: Json
          related_entities?: Json
          relationship_leads?: Json
          snapshot_version?: number
          source_context?: Json
          source_references?: Json
          thin_data_notes?: Json
          unknowns?: Json
        }
        Update: {
          anchor_entity_type?: string
          anchor_label?: string
          anchor_slug?: string | null
          created_at?: string
          created_by?: string | null
          evidence_gaps?: Json
          id?: string
          inquiry_anchor_id?: string
          inquiry_id?: string
          knowns?: Json
          related_entities?: Json
          relationship_leads?: Json
          snapshot_version?: number
          source_context?: Json
          source_references?: Json
          thin_data_notes?: Json
          unknowns?: Json
        }
        Relationships: [
          {
            foreignKeyName: "institute_anchor_context_snapshots_inquiry_anchor_id_fkey"
            columns: ["inquiry_anchor_id"]
            isOneToOne: false
            referencedRelation: "institute_inquiry_anchors"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "institute_anchor_context_snapshots_inquiry_id_fkey"
            columns: ["inquiry_id"]
            isOneToOne: false
            referencedRelation: "institute_inquiries"
            referencedColumns: ["id"]
          },
        ]
      }
      institute_assistant_runs: {
        Row: {
          anchor_context_snapshot_id: string | null
          completed_at: string | null
          cost_estimate: number | null
          created_at: string
          created_by: string | null
          error_message: string | null
          id: string
          input_context: Json
          inquiry_id: string | null
          latency_ms: number | null
          model_name: string | null
          model_provider: string | null
          output_json: Json
          prompt_version: string
          question_version_id: string | null
          review_status: string
          source_references: Json
          status: string
          task: string
        }
        Insert: {
          anchor_context_snapshot_id?: string | null
          completed_at?: string | null
          cost_estimate?: number | null
          created_at?: string
          created_by?: string | null
          error_message?: string | null
          id?: string
          input_context?: Json
          inquiry_id?: string | null
          latency_ms?: number | null
          model_name?: string | null
          model_provider?: string | null
          output_json?: Json
          prompt_version?: string
          question_version_id?: string | null
          review_status?: string
          source_references?: Json
          status?: string
          task: string
        }
        Update: {
          anchor_context_snapshot_id?: string | null
          completed_at?: string | null
          cost_estimate?: number | null
          created_at?: string
          created_by?: string | null
          error_message?: string | null
          id?: string
          input_context?: Json
          inquiry_id?: string | null
          latency_ms?: number | null
          model_name?: string | null
          model_provider?: string | null
          output_json?: Json
          prompt_version?: string
          question_version_id?: string | null
          review_status?: string
          source_references?: Json
          status?: string
          task?: string
        }
        Relationships: [
          {
            foreignKeyName: "institute_assistant_runs_anchor_context_snapshot_id_fkey"
            columns: ["anchor_context_snapshot_id"]
            isOneToOne: false
            referencedRelation: "institute_anchor_context_snapshots"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "institute_assistant_runs_inquiry_id_fkey"
            columns: ["inquiry_id"]
            isOneToOne: false
            referencedRelation: "institute_inquiries"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "institute_assistant_runs_question_version_id_fkey"
            columns: ["question_version_id"]
            isOneToOne: false
            referencedRelation: "institute_question_versions"
            referencedColumns: ["id"]
          },
        ]
      }
      institute_assistant_suggestions: {
        Row: {
          assistant_run_id: string
          body: string
          confidence: number | null
          created_at: string
          id: string
          inquiry_id: string | null
          payload: Json
          reason: string | null
          reviewed_at: string | null
          reviewed_by: string | null
          source_references: Json
          status: string
          suggestion_type: string
          title: string | null
          updated_at: string
        }
        Insert: {
          assistant_run_id: string
          body: string
          confidence?: number | null
          created_at?: string
          id?: string
          inquiry_id?: string | null
          payload?: Json
          reason?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          source_references?: Json
          status?: string
          suggestion_type: string
          title?: string | null
          updated_at?: string
        }
        Update: {
          assistant_run_id?: string
          body?: string
          confidence?: number | null
          created_at?: string
          id?: string
          inquiry_id?: string | null
          payload?: Json
          reason?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          source_references?: Json
          status?: string
          suggestion_type?: string
          title?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "institute_assistant_suggestions_assistant_run_id_fkey"
            columns: ["assistant_run_id"]
            isOneToOne: false
            referencedRelation: "institute_assistant_runs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "institute_assistant_suggestions_inquiry_id_fkey"
            columns: ["inquiry_id"]
            isOneToOne: false
            referencedRelation: "institute_inquiries"
            referencedColumns: ["id"]
          },
        ]
      }
      institute_events: {
        Row: {
          actor_id: string | null
          after_value: Json
          before_value: Json
          created_at: string
          event_label: string | null
          event_type: string
          id: string
          inquiry_id: string | null
          metadata: Json
        }
        Insert: {
          actor_id?: string | null
          after_value?: Json
          before_value?: Json
          created_at?: string
          event_label?: string | null
          event_type: string
          id?: string
          inquiry_id?: string | null
          metadata?: Json
        }
        Update: {
          actor_id?: string | null
          after_value?: Json
          before_value?: Json
          created_at?: string
          event_label?: string | null
          event_type?: string
          id?: string
          inquiry_id?: string | null
          metadata?: Json
        }
        Relationships: [
          {
            foreignKeyName: "institute_events_inquiry_id_fkey"
            columns: ["inquiry_id"]
            isOneToOne: false
            referencedRelation: "institute_inquiries"
            referencedColumns: ["id"]
          },
        ]
      }
      institute_evidence_items: {
        Row: {
          created_at: string
          created_by: string | null
          deleted_at: string | null
          evidence_kind: string
          id: string
          inquiry_id: string
          media_minutes: number
          metadata: Json
          review_state: string
          source: string
          source_url: string | null
          summary: string
          title: string
          updated_at: string
          updated_by: string | null
          why_it_matters: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          deleted_at?: string | null
          evidence_kind: string
          id?: string
          inquiry_id: string
          media_minutes?: number
          metadata?: Json
          review_state?: string
          source: string
          source_url?: string | null
          summary: string
          title: string
          updated_at?: string
          updated_by?: string | null
          why_it_matters: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          deleted_at?: string | null
          evidence_kind?: string
          id?: string
          inquiry_id?: string
          media_minutes?: number
          metadata?: Json
          review_state?: string
          source?: string
          source_url?: string | null
          summary?: string
          title?: string
          updated_at?: string
          updated_by?: string | null
          why_it_matters?: string
        }
        Relationships: [
          {
            foreignKeyName: "institute_evidence_items_inquiry_id_fkey"
            columns: ["inquiry_id"]
            isOneToOne: false
            referencedRelation: "institute_inquiries"
            referencedColumns: ["id"]
          },
        ]
      }
      institute_inquiries: {
        Row: {
          code: string
          created_at: string
          created_by: string | null
          current_question: string
          current_question_version_id: string | null
          deleted_at: string | null
          featured_image_alt: string | null
          featured_image_credit: string | null
          featured_image_source: string | null
          featured_image_url: string | null
          id: string
          inquiry_type: string | null
          maturity: string
          metadata: Json
          raw_question: string
          status: string
          title: string | null
          updated_at: string
          updated_by: string | null
          visibility: string
        }
        Insert: {
          code?: string
          created_at?: string
          created_by?: string | null
          current_question: string
          current_question_version_id?: string | null
          deleted_at?: string | null
          featured_image_alt?: string | null
          featured_image_credit?: string | null
          featured_image_source?: string | null
          featured_image_url?: string | null
          id?: string
          inquiry_type?: string | null
          maturity?: string
          metadata?: Json
          raw_question: string
          status?: string
          title?: string | null
          updated_at?: string
          updated_by?: string | null
          visibility?: string
        }
        Update: {
          code?: string
          created_at?: string
          created_by?: string | null
          current_question?: string
          current_question_version_id?: string | null
          deleted_at?: string | null
          featured_image_alt?: string | null
          featured_image_credit?: string | null
          featured_image_source?: string | null
          featured_image_url?: string | null
          id?: string
          inquiry_type?: string | null
          maturity?: string
          metadata?: Json
          raw_question?: string
          status?: string
          title?: string | null
          updated_at?: string
          updated_by?: string | null
          visibility?: string
        }
        Relationships: [
          {
            foreignKeyName: "institute_inquiries_current_question_version_id_fkey"
            columns: ["current_question_version_id"]
            isOneToOne: false
            referencedRelation: "institute_question_versions"
            referencedColumns: ["id"]
          },
        ]
      }
      institute_inquiry_anchors: {
        Row: {
          anchor_entity_id: string | null
          anchor_entity_type: string
          anchor_image_url: string | null
          anchor_label: string
          anchor_metadata: Json
          anchor_slug: string | null
          anchor_url: string | null
          anchored_at: string
          anchored_by: string | null
          created_at: string
          id: string
          inquiry_id: string
          is_primary: boolean
          source_system: string
          status: string
          updated_at: string
        }
        Insert: {
          anchor_entity_id?: string | null
          anchor_entity_type: string
          anchor_image_url?: string | null
          anchor_label: string
          anchor_metadata?: Json
          anchor_slug?: string | null
          anchor_url?: string | null
          anchored_at?: string
          anchored_by?: string | null
          created_at?: string
          id?: string
          inquiry_id: string
          is_primary?: boolean
          source_system?: string
          status?: string
          updated_at?: string
        }
        Update: {
          anchor_entity_id?: string | null
          anchor_entity_type?: string
          anchor_image_url?: string | null
          anchor_label?: string
          anchor_metadata?: Json
          anchor_slug?: string | null
          anchor_url?: string | null
          anchored_at?: string
          anchored_by?: string | null
          created_at?: string
          id?: string
          inquiry_id?: string
          is_primary?: boolean
          source_system?: string
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "institute_inquiry_anchors_inquiry_id_fkey"
            columns: ["inquiry_id"]
            isOneToOne: false
            referencedRelation: "institute_inquiries"
            referencedColumns: ["id"]
          },
        ]
      }
      institute_question_versions: {
        Row: {
          assessment_state: string | null
          created_at: string
          created_by: string | null
          id: string
          inquiry_id: string
          metadata: Json
          question_text: string
          reason: string | null
          version_number: number
          version_type: string
        }
        Insert: {
          assessment_state?: string | null
          created_at?: string
          created_by?: string | null
          id?: string
          inquiry_id: string
          metadata?: Json
          question_text: string
          reason?: string | null
          version_number: number
          version_type?: string
        }
        Update: {
          assessment_state?: string | null
          created_at?: string
          created_by?: string | null
          id?: string
          inquiry_id?: string
          metadata?: Json
          question_text?: string
          reason?: string | null
          version_number?: number
          version_type?: string
        }
        Relationships: [
          {
            foreignKeyName: "institute_question_versions_inquiry_id_fkey"
            columns: ["inquiry_id"]
            isOneToOne: false
            referencedRelation: "institute_inquiries"
            referencedColumns: ["id"]
          },
        ]
      }
      institute_relationships: {
        Row: {
          confidence_band: string
          created_at: string
          created_by: string | null
          evidence_refs: Json
          id: string
          inquiry_id: string
          plain_reason: string
          relationship_kind: string
          source_entity_label: string
          source_entity_slug: string | null
          source_entity_type: string
          source_suggestion_id: string | null
          status: string
          status_changed_at: string | null
          status_reason: string | null
          superseded_by_relationship_id: string | null
          target_entity_label: string
          target_entity_slug: string | null
          target_entity_type: string
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          confidence_band?: string
          created_at?: string
          created_by?: string | null
          evidence_refs?: Json
          id?: string
          inquiry_id: string
          plain_reason: string
          relationship_kind: string
          source_entity_label: string
          source_entity_slug?: string | null
          source_entity_type: string
          source_suggestion_id?: string | null
          status?: string
          status_changed_at?: string | null
          status_reason?: string | null
          superseded_by_relationship_id?: string | null
          target_entity_label: string
          target_entity_slug?: string | null
          target_entity_type: string
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          confidence_band?: string
          created_at?: string
          created_by?: string | null
          evidence_refs?: Json
          id?: string
          inquiry_id?: string
          plain_reason?: string
          relationship_kind?: string
          source_entity_label?: string
          source_entity_slug?: string | null
          source_entity_type?: string
          source_suggestion_id?: string | null
          status?: string
          status_changed_at?: string | null
          status_reason?: string | null
          superseded_by_relationship_id?: string | null
          target_entity_label?: string
          target_entity_slug?: string | null
          target_entity_type?: string
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "institute_relationships_inquiry_id_fkey"
            columns: ["inquiry_id"]
            isOneToOne: false
            referencedRelation: "institute_inquiries"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "institute_relationships_source_suggestion_id_fkey"
            columns: ["source_suggestion_id"]
            isOneToOne: false
            referencedRelation: "institute_assistant_suggestions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "institute_relationships_superseded_by_relationship_id_fkey"
            columns: ["superseded_by_relationship_id"]
            isOneToOne: false
            referencedRelation: "institute_relationships"
            referencedColumns: ["id"]
          },
        ]
      }
      institute_review_packets: {
        Row: {
          contributor_note: string | null
          created_at: string
          editor_decision: string | null
          editor_notes: string | null
          id: string
          inquiry_id: string
          packet_version: number
          reviewed_at: string | null
          reviewed_by: string | null
          snapshot_json: Json
          status: string
          submitted_at: string
          submitted_by: string | null
          updated_at: string
        }
        Insert: {
          contributor_note?: string | null
          created_at?: string
          editor_decision?: string | null
          editor_notes?: string | null
          id?: string
          inquiry_id: string
          packet_version?: number
          reviewed_at?: string | null
          reviewed_by?: string | null
          snapshot_json?: Json
          status?: string
          submitted_at?: string
          submitted_by?: string | null
          updated_at?: string
        }
        Update: {
          contributor_note?: string | null
          created_at?: string
          editor_decision?: string | null
          editor_notes?: string | null
          id?: string
          inquiry_id?: string
          packet_version?: number
          reviewed_at?: string | null
          reviewed_by?: string | null
          snapshot_json?: Json
          status?: string
          submitted_at?: string
          submitted_by?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "institute_review_packets_inquiry_id_fkey"
            columns: ["inquiry_id"]
            isOneToOne: false
            referencedRelation: "institute_inquiries"
            referencedColumns: ["id"]
          },
        ]
      }
      institute_work_product_links: {
        Row: {
          created_at: string
          created_by: string | null
          format_label: string
          id: string
          inquiry_id: string
          metadata: Json
          product_id: string
          product_slug: string
          product_type: string
          status: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          format_label?: string
          id?: string
          inquiry_id: string
          metadata?: Json
          product_id: string
          product_slug: string
          product_type: string
          status?: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          format_label?: string
          id?: string
          inquiry_id?: string
          metadata?: Json
          product_id?: string
          product_slug?: string
          product_type?: string
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "institute_work_product_links_inquiry_id_fkey"
            columns: ["inquiry_id"]
            isOneToOne: false
            referencedRelation: "institute_inquiries"
            referencedColumns: ["id"]
          },
        ]
      }
      institute_workbench_setup: {
        Row: {
          assistant_seed: Json
          care_defaults: Json
          created_at: string
          created_by: string | null
          estimated_attention: Json
          evidence_formats: Json
          id: string
          inquiry_id: string
          inquiry_type: string | null
          output_surfaces: Json
          scope_edges: Json
          setup_source: string
          tools: Json
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          assistant_seed?: Json
          care_defaults?: Json
          created_at?: string
          created_by?: string | null
          estimated_attention?: Json
          evidence_formats?: Json
          id?: string
          inquiry_id: string
          inquiry_type?: string | null
          output_surfaces?: Json
          scope_edges?: Json
          setup_source?: string
          tools?: Json
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          assistant_seed?: Json
          care_defaults?: Json
          created_at?: string
          created_by?: string | null
          estimated_attention?: Json
          evidence_formats?: Json
          id?: string
          inquiry_id?: string
          inquiry_type?: string | null
          output_surfaces?: Json
          scope_edges?: Json
          setup_source?: string
          tools?: Json
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "institute_workbench_setup_inquiry_id_fkey"
            columns: ["inquiry_id"]
            isOneToOne: true
            referencedRelation: "institute_inquiries"
            referencedColumns: ["id"]
          },
        ]
      }
      legacy_import_records: {
        Row: {
          created_at: string
          error_code: string | null
          error_message: string | null
          id: string
          job_id: string
          legacy_id: string | null
          raw_payload: Json | null
          retry_count: number | null
          source_kind: string | null
          status: string
          suggested_action: string | null
          target_id: string | null
          target_table: string
        }
        Insert: {
          created_at?: string
          error_code?: string | null
          error_message?: string | null
          id?: string
          job_id: string
          legacy_id?: string | null
          raw_payload?: Json | null
          retry_count?: number | null
          source_kind?: string | null
          status?: string
          suggested_action?: string | null
          target_id?: string | null
          target_table: string
        }
        Update: {
          created_at?: string
          error_code?: string | null
          error_message?: string | null
          id?: string
          job_id?: string
          legacy_id?: string | null
          raw_payload?: Json | null
          retry_count?: number | null
          source_kind?: string | null
          status?: string
          suggested_action?: string | null
          target_id?: string | null
          target_table?: string
        }
        Relationships: []
      }
      media_folders: {
        Row: {
          color: string | null
          created_at: string
          created_by: string | null
          description: string | null
          icon: string | null
          id: string
          is_system: boolean
          metadata: Json
          name: string
          parent_id: string | null
          path: string
          purpose: string
          slug: string
          sort_order: number
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          color?: string | null
          created_at?: string
          created_by?: string | null
          description?: string | null
          icon?: string | null
          id?: string
          is_system?: boolean
          metadata?: Json
          name: string
          parent_id?: string | null
          path: string
          purpose?: string
          slug: string
          sort_order?: number
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          color?: string | null
          created_at?: string
          created_by?: string | null
          description?: string | null
          icon?: string | null
          id?: string
          is_system?: boolean
          metadata?: Json
          name?: string
          parent_id?: string | null
          path?: string
          purpose?: string
          slug?: string
          sort_order?: number
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "media_folders_parent_id_fkey"
            columns: ["parent_id"]
            isOneToOne: false
            referencedRelation: "media_folders"
            referencedColumns: ["id"]
          },
        ]
      }
      memory_embeddings: {
        Row: {
          content: string
          created_at: string
          embedding: string | null
          id: string
          metadata: Json
          retrieval_status: string
          source_id: string
          source_type: string
        }
        Insert: {
          content: string
          created_at?: string
          embedding?: string | null
          id?: string
          metadata?: Json
          retrieval_status?: string
          source_id: string
          source_type: string
        }
        Update: {
          content?: string
          created_at?: string
          embedding?: string | null
          id?: string
          metadata?: Json
          retrieval_status?: string
          source_id?: string
          source_type?: string
        }
        Relationships: []
      }
      model_providers: {
        Row: {
          base_url: string | null
          created_at: string
          created_by: string | null
          display_name: string
          docs_url: string | null
          id: string
          license_notes: string | null
          notes: string | null
          provider_key: string
          provider_type: string
          secret_name: string | null
          status: string
          supports_citations: boolean
          supports_embeddings: boolean
          supports_fine_tuning: boolean
          supports_reranking: boolean
          supports_structured_output: boolean
          supports_text_generation: boolean
          supports_tool_use: boolean
          updated_at: string
        }
        Insert: {
          base_url?: string | null
          created_at?: string
          created_by?: string | null
          display_name: string
          docs_url?: string | null
          id?: string
          license_notes?: string | null
          notes?: string | null
          provider_key: string
          provider_type: string
          secret_name?: string | null
          status?: string
          supports_citations?: boolean
          supports_embeddings?: boolean
          supports_fine_tuning?: boolean
          supports_reranking?: boolean
          supports_structured_output?: boolean
          supports_text_generation?: boolean
          supports_tool_use?: boolean
          updated_at?: string
        }
        Update: {
          base_url?: string | null
          created_at?: string
          created_by?: string | null
          display_name?: string
          docs_url?: string | null
          id?: string
          license_notes?: string | null
          notes?: string | null
          provider_key?: string
          provider_type?: string
          secret_name?: string | null
          status?: string
          supports_citations?: boolean
          supports_embeddings?: boolean
          supports_fine_tuning?: boolean
          supports_reranking?: boolean
          supports_structured_output?: boolean
          supports_text_generation?: boolean
          supports_tool_use?: boolean
          updated_at?: string
        }
        Relationships: []
      }
      model_registry: {
        Row: {
          approved_task_types: string[]
          context_window_tokens: number | null
          created_at: string
          created_by: string | null
          display_name: string
          embedding_dimensions: number | null
          hosting_mode: string
          id: string
          license_notes: string | null
          model_family: string | null
          model_key: string
          model_type: string
          operational_notes: string | null
          output_token_limit: number | null
          provider_id: string
          status: string
          supports_citations: boolean
          supports_fine_tuning: boolean
          supports_json_mode: boolean
          supports_streaming: boolean
          supports_structured_output: boolean
          supports_tool_use: boolean
          updated_at: string
          weight_access: string
        }
        Insert: {
          approved_task_types?: string[]
          context_window_tokens?: number | null
          created_at?: string
          created_by?: string | null
          display_name: string
          embedding_dimensions?: number | null
          hosting_mode: string
          id?: string
          license_notes?: string | null
          model_family?: string | null
          model_key: string
          model_type: string
          operational_notes?: string | null
          output_token_limit?: number | null
          provider_id: string
          status?: string
          supports_citations?: boolean
          supports_fine_tuning?: boolean
          supports_json_mode?: boolean
          supports_streaming?: boolean
          supports_structured_output?: boolean
          supports_tool_use?: boolean
          updated_at?: string
          weight_access?: string
        }
        Update: {
          approved_task_types?: string[]
          context_window_tokens?: number | null
          created_at?: string
          created_by?: string | null
          display_name?: string
          embedding_dimensions?: number | null
          hosting_mode?: string
          id?: string
          license_notes?: string | null
          model_family?: string | null
          model_key?: string
          model_type?: string
          operational_notes?: string | null
          output_token_limit?: number | null
          provider_id?: string
          status?: string
          supports_citations?: boolean
          supports_fine_tuning?: boolean
          supports_json_mode?: boolean
          supports_streaming?: boolean
          supports_structured_output?: boolean
          supports_tool_use?: boolean
          updated_at?: string
          weight_access?: string
        }
        Relationships: [
          {
            foreignKeyName: "model_registry_provider_id_fkey"
            columns: ["provider_id"]
            isOneToOne: false
            referencedRelation: "model_providers"
            referencedColumns: ["id"]
          },
        ]
      }
      prompt_recipes: {
        Row: {
          created_at: string
          display_name: string
          id: string
          notes: string | null
          owner_id: string | null
          purpose: string
          recipe_key: string
          status: string
          task_type: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          display_name: string
          id?: string
          notes?: string | null
          owner_id?: string | null
          purpose: string
          recipe_key: string
          status?: string
          task_type: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          display_name?: string
          id?: string
          notes?: string | null
          owner_id?: string | null
          purpose?: string
          recipe_key?: string
          status?: string
          task_type?: string
          updated_at?: string
        }
        Relationships: []
      }
      prompt_versions: {
        Row: {
          approved_at: string | null
          approved_by: string | null
          created_at: string
          created_by: string | null
          developer_prompt: string | null
          evaluation_notes: string | null
          id: string
          output_schema: Json
          recipe_id: string
          retrieval_policy: Json
          safety_notes: string | null
          status: string
          system_prompt: string
          updated_at: string
          user_prompt_template: string
          version_label: string | null
          version_name: string
        }
        Insert: {
          approved_at?: string | null
          approved_by?: string | null
          created_at?: string
          created_by?: string | null
          developer_prompt?: string | null
          evaluation_notes?: string | null
          id?: string
          output_schema?: Json
          recipe_id: string
          retrieval_policy?: Json
          safety_notes?: string | null
          status?: string
          system_prompt: string
          updated_at?: string
          user_prompt_template: string
          version_label?: string | null
          version_name: string
        }
        Update: {
          approved_at?: string | null
          approved_by?: string | null
          created_at?: string
          created_by?: string | null
          developer_prompt?: string | null
          evaluation_notes?: string | null
          id?: string
          output_schema?: Json
          recipe_id?: string
          retrieval_policy?: Json
          safety_notes?: string | null
          status?: string
          system_prompt?: string
          updated_at?: string
          user_prompt_template?: string
          version_label?: string | null
          version_name?: string
        }
        Relationships: [
          {
            foreignKeyName: "prompt_versions_recipe_id_fkey"
            columns: ["recipe_id"]
            isOneToOne: false
            referencedRelation: "prompt_recipes"
            referencedColumns: ["id"]
          },
        ]
      }
      provider_entity_links: {
        Row: {
          confidence_score: number
          created_at: string
          id: string
          match_status: string
          provider: string
          provider_entity_id: string
          provider_url: string | null
          registry_entity_id: string
          registry_entity_type: string
          updated_at: string
        }
        Insert: {
          confidence_score?: number
          created_at?: string
          id?: string
          match_status?: string
          provider: string
          provider_entity_id: string
          provider_url?: string | null
          registry_entity_id: string
          registry_entity_type: string
          updated_at?: string
        }
        Update: {
          confidence_score?: number
          created_at?: string
          id?: string
          match_status?: string
          provider?: string
          provider_entity_id?: string
          provider_url?: string | null
          registry_entity_id?: string
          registry_entity_type?: string
          updated_at?: string
        }
        Relationships: []
      }
      provider_field_observations: {
        Row: {
          confidence_score: number
          created_at: string
          entity_type: string
          field_name: string
          field_value: string | null
          id: string
          provider: string
          provider_item_id: string | null
          raw_payload: Json
          source_path: string
        }
        Insert: {
          confidence_score?: number
          created_at?: string
          entity_type: string
          field_name: string
          field_value?: string | null
          id?: string
          provider: string
          provider_item_id?: string | null
          raw_payload?: Json
          source_path: string
        }
        Update: {
          confidence_score?: number
          created_at?: string
          entity_type?: string
          field_name?: string
          field_value?: string | null
          id?: string
          provider?: string
          provider_item_id?: string | null
          raw_payload?: Json
          source_path?: string
        }
        Relationships: []
      }
      provider_intake_artist_staging: {
        Row: {
          action_taken: string | null
          created_at: string
          id: string
          intake_run_id: string | null
          match_confidence: number | null
          match_reason: string | null
          match_status: string
          matched_registry_artist_id: string | null
          matched_registry_artist_name: string | null
          review_notes: string | null
          review_status: string
          reviewed_at: string | null
          reviewed_by: string | null
          source_artist_name: string
          source_followers: number | null
          source_genres: Json | null
          source_images: Json | null
          source_metadata: Json
          source_normalized_name: string
          source_origin_iso2: string | null
          source_popularity: number | null
          source_spotify_id: string | null
          source_spotify_uri: string | null
          target_registry_artist_id: string | null
          updated_at: string
        }
        Insert: {
          action_taken?: string | null
          created_at?: string
          id?: string
          intake_run_id?: string | null
          match_confidence?: number | null
          match_reason?: string | null
          match_status?: string
          matched_registry_artist_id?: string | null
          matched_registry_artist_name?: string | null
          review_notes?: string | null
          review_status?: string
          reviewed_at?: string | null
          reviewed_by?: string | null
          source_artist_name: string
          source_followers?: number | null
          source_genres?: Json | null
          source_images?: Json | null
          source_metadata?: Json
          source_normalized_name: string
          source_origin_iso2?: string | null
          source_popularity?: number | null
          source_spotify_id?: string | null
          source_spotify_uri?: string | null
          target_registry_artist_id?: string | null
          updated_at?: string
        }
        Update: {
          action_taken?: string | null
          created_at?: string
          id?: string
          intake_run_id?: string | null
          match_confidence?: number | null
          match_reason?: string | null
          match_status?: string
          matched_registry_artist_id?: string | null
          matched_registry_artist_name?: string | null
          review_notes?: string | null
          review_status?: string
          reviewed_at?: string | null
          reviewed_by?: string | null
          source_artist_name?: string
          source_followers?: number | null
          source_genres?: Json | null
          source_images?: Json | null
          source_metadata?: Json
          source_normalized_name?: string
          source_origin_iso2?: string | null
          source_popularity?: number | null
          source_spotify_id?: string | null
          source_spotify_uri?: string | null
          target_registry_artist_id?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "provider_intake_artist_staging_intake_run_id_fkey"
            columns: ["intake_run_id"]
            isOneToOne: false
            referencedRelation: "provider_intake_runs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "provider_intake_artist_staging_matched_registry_artist_id_fkey"
            columns: ["matched_registry_artist_id"]
            isOneToOne: false
            referencedRelation: "registry_artists"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "provider_intake_artist_staging_reviewed_by_fkey"
            columns: ["reviewed_by"]
            isOneToOne: false
            referencedRelation: "user_profiles"
            referencedColumns: ["user_id"]
          },
          {
            foreignKeyName: "provider_intake_artist_staging_target_registry_artist_id_fkey"
            columns: ["target_registry_artist_id"]
            isOneToOne: false
            referencedRelation: "registry_artists"
            referencedColumns: ["id"]
          },
        ]
      }
      provider_intake_runs: {
        Row: {
          actor: string | null
          completed_at: string | null
          created_at: string
          error_message: string | null
          id: string
          idempotency_key: string
          mode: string
          provider: string
          provider_entity_id: string
          provider_entity_type: string
          status: string
          storefront_or_market: string | null
          summary_json: Json | null
          target_registry_entity_id: string | null
        }
        Insert: {
          actor?: string | null
          completed_at?: string | null
          created_at?: string
          error_message?: string | null
          id?: string
          idempotency_key: string
          mode?: string
          provider: string
          provider_entity_id: string
          provider_entity_type: string
          status?: string
          storefront_or_market?: string | null
          summary_json?: Json | null
          target_registry_entity_id?: string | null
        }
        Update: {
          actor?: string | null
          completed_at?: string | null
          created_at?: string
          error_message?: string | null
          id?: string
          idempotency_key?: string
          mode?: string
          provider?: string
          provider_entity_id?: string
          provider_entity_type?: string
          status?: string
          storefront_or_market?: string | null
          summary_json?: Json | null
          target_registry_entity_id?: string | null
        }
        Relationships: []
      }
      provider_match_candidates: {
        Row: {
          confidence_score: number
          created_at: string
          evidence: Json
          id: string
          match_rule: string
          match_status: string
          provider_item_id: string
          registry_entity_id: string | null
          registry_entity_type: string
          updated_at: string
        }
        Insert: {
          confidence_score?: number
          created_at?: string
          evidence?: Json
          id?: string
          match_rule: string
          match_status?: string
          provider_item_id: string
          registry_entity_id?: string | null
          registry_entity_type: string
          updated_at?: string
        }
        Update: {
          confidence_score?: number
          created_at?: string
          evidence?: Json
          id?: string
          match_rule?: string
          match_status?: string
          provider_item_id?: string
          registry_entity_id?: string | null
          registry_entity_type?: string
          updated_at?: string
        }
        Relationships: []
      }
      provider_promotion_decisions: {
        Row: {
          created_at: string
          decision: string
          decision_status: string
          id: string
          match_candidate_id: string | null
          metadata: Json
          notes: string | null
          provider_item_id: string
          registry_entity_id: string | null
          registry_entity_type: string | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          decision: string
          decision_status?: string
          id?: string
          match_candidate_id?: string | null
          metadata?: Json
          notes?: string | null
          provider_item_id: string
          registry_entity_id?: string | null
          registry_entity_type?: string | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          decision?: string
          decision_status?: string
          id?: string
          match_candidate_id?: string | null
          metadata?: Json
          notes?: string | null
          provider_item_id?: string
          registry_entity_id?: string | null
          registry_entity_type?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "provider_promotion_decisions_match_candidate_id_fkey"
            columns: ["match_candidate_id"]
            isOneToOne: false
            referencedRelation: "provider_match_candidates"
            referencedColumns: ["id"]
          },
        ]
      }
      provider_runs: {
        Row: {
          completed_at: string | null
          created_at: string
          errors: Json
          id: string
          provider_source_id: string
          run_key: string
          source_cursor: string | null
          started_at: string | null
          stats: Json
          status: string
          updated_at: string
        }
        Insert: {
          completed_at?: string | null
          created_at?: string
          errors?: Json
          id?: string
          provider_source_id: string
          run_key: string
          source_cursor?: string | null
          started_at?: string | null
          stats?: Json
          status?: string
          updated_at?: string
        }
        Update: {
          completed_at?: string | null
          created_at?: string
          errors?: Json
          id?: string
          provider_source_id?: string
          run_key?: string
          source_cursor?: string | null
          started_at?: string | null
          stats?: Json
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "provider_runs_provider_source_id_fkey"
            columns: ["provider_source_id"]
            isOneToOne: false
            referencedRelation: "provider_sources"
            referencedColumns: ["id"]
          },
        ]
      }
      provider_sources: {
        Row: {
          config: Json
          created_at: string
          description: string | null
          id: string
          is_active: boolean
          name: string
          provider_kind: string
          slug: string
          updated_at: string
        }
        Insert: {
          config?: Json
          created_at?: string
          description?: string | null
          id?: string
          is_active?: boolean
          name: string
          provider_kind: string
          slug: string
          updated_at?: string
        }
        Update: {
          config?: Json
          created_at?: string
          description?: string | null
          id?: string
          is_active?: boolean
          name?: string
          provider_kind?: string
          slug?: string
          updated_at?: string
        }
        Relationships: []
      }
      rate_limit_log: {
        Row: {
          bucket_key: string
          created_at: string
          id: string
        }
        Insert: {
          bucket_key: string
          created_at?: string
          id?: string
        }
        Update: {
          bucket_key?: string
          created_at?: string
          id?: string
        }
        Relationships: []
      }
      registry_artist_aliases: {
        Row: {
          alias_display_name: string | null
          alias_slug: string
          canonical_artist_id: string
          confidence: number | null
          created_at: string | null
          created_by: string | null
          id: string
          notes: string | null
          provider_id: string | null
          provider_type: string | null
          provider_uri: string | null
          source: string | null
          status: string | null
        }
        Insert: {
          alias_display_name?: string | null
          alias_slug: string
          canonical_artist_id: string
          confidence?: number | null
          created_at?: string | null
          created_by?: string | null
          id?: string
          notes?: string | null
          provider_id?: string | null
          provider_type?: string | null
          provider_uri?: string | null
          source?: string | null
          status?: string | null
        }
        Update: {
          alias_display_name?: string | null
          alias_slug?: string
          canonical_artist_id?: string
          confidence?: number | null
          created_at?: string | null
          created_by?: string | null
          id?: string
          notes?: string | null
          provider_id?: string | null
          provider_type?: string | null
          provider_uri?: string | null
          source?: string | null
          status?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "registry_artist_aliases_canonical_artist_id_fkey"
            columns: ["canonical_artist_id"]
            isOneToOne: false
            referencedRelation: "registry_artists"
            referencedColumns: ["id"]
          },
        ]
      }
      registry_artist_decouple_decisions: {
        Row: {
          actor_id: string | null
          applied_at: string | null
          apply_result_json: Json | null
          chart_primary_artist_id: string | null
          created_at: string
          decision_status: string
          decision_type: string
          id: string
          note: string | null
          parsed_tokens: Json
          raw_credit_text: string | null
          selected_artists: Json
          source_artist_id: string | null
          source_id: string | null
          source_key: string
          source_label: string
          source_snapshot: Json
          source_table: string | null
          source_type: string
          updated_at: string
        }
        Insert: {
          actor_id?: string | null
          applied_at?: string | null
          apply_result_json?: Json | null
          chart_primary_artist_id?: string | null
          created_at?: string
          decision_status?: string
          decision_type?: string
          id?: string
          note?: string | null
          parsed_tokens?: Json
          raw_credit_text?: string | null
          selected_artists?: Json
          source_artist_id?: string | null
          source_id?: string | null
          source_key: string
          source_label: string
          source_snapshot?: Json
          source_table?: string | null
          source_type: string
          updated_at?: string
        }
        Update: {
          actor_id?: string | null
          applied_at?: string | null
          apply_result_json?: Json | null
          chart_primary_artist_id?: string | null
          created_at?: string
          decision_status?: string
          decision_type?: string
          id?: string
          note?: string | null
          parsed_tokens?: Json
          raw_credit_text?: string | null
          selected_artists?: Json
          source_artist_id?: string | null
          source_id?: string | null
          source_key?: string
          source_label?: string
          source_snapshot?: Json
          source_table?: string | null
          source_type?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "registry_artist_decouple_decisions_chart_primary_artist_id_fkey"
            columns: ["chart_primary_artist_id"]
            isOneToOne: false
            referencedRelation: "registry_artists"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "registry_artist_decouple_decisions_source_artist_id_fkey"
            columns: ["source_artist_id"]
            isOneToOne: false
            referencedRelation: "registry_artists"
            referencedColumns: ["id"]
          },
        ]
      }
      registry_artist_genres: {
        Row: {
          artist_id: string
          confidence: number
          created_at: string
          created_by: string | null
          editorial_note: string | null
          genre_id: string
          genre_role: string
          id: string
          metadata: Json
          raw_genre_name: string | null
          reviewed_at: string | null
          sort_order: number
          source: string
          source_context: string | null
          status: string
          updated_at: string
        }
        Insert: {
          artist_id: string
          confidence?: number
          created_at?: string
          created_by?: string | null
          editorial_note?: string | null
          genre_id: string
          genre_role?: string
          id?: string
          metadata?: Json
          raw_genre_name?: string | null
          reviewed_at?: string | null
          sort_order?: number
          source?: string
          source_context?: string | null
          status?: string
          updated_at?: string
        }
        Update: {
          artist_id?: string
          confidence?: number
          created_at?: string
          created_by?: string | null
          editorial_note?: string | null
          genre_id?: string
          genre_role?: string
          id?: string
          metadata?: Json
          raw_genre_name?: string | null
          reviewed_at?: string | null
          sort_order?: number
          source?: string
          source_context?: string | null
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "registry_artist_genres_artist_id_fkey"
            columns: ["artist_id"]
            isOneToOne: false
            referencedRelation: "registry_artists"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "registry_artist_genres_genre_id_fkey"
            columns: ["genre_id"]
            isOneToOne: false
            referencedRelation: "registry_genres"
            referencedColumns: ["id"]
          },
        ]
      }
      registry_artist_highlights: {
        Row: {
          artist_slug: string
          artwork_image_id: string | null
          artwork_url: string | null
          canonical_entity_slug: string | null
          canonical_entity_type: string | null
          created_at: string
          data: Json
          duration: string | null
          external_url: string | null
          highlight_type: string
          id: string
          metadata: Json
          position: number
          preview_provider: string | null
          preview_url: string | null
          provider: string | null
          source_entity: string | null
          source_kind: string | null
          source_record_id: string | null
          source_staging_record_id: string | null
          status: string
          subtitle: string | null
          title: string
          updated_at: string
        }
        Insert: {
          artist_slug: string
          artwork_image_id?: string | null
          artwork_url?: string | null
          canonical_entity_slug?: string | null
          canonical_entity_type?: string | null
          created_at?: string
          data?: Json
          duration?: string | null
          external_url?: string | null
          highlight_type: string
          id?: string
          metadata?: Json
          position?: number
          preview_provider?: string | null
          preview_url?: string | null
          provider?: string | null
          source_entity?: string | null
          source_kind?: string | null
          source_record_id?: string | null
          source_staging_record_id?: string | null
          status?: string
          subtitle?: string | null
          title: string
          updated_at?: string
        }
        Update: {
          artist_slug?: string
          artwork_image_id?: string | null
          artwork_url?: string | null
          canonical_entity_slug?: string | null
          canonical_entity_type?: string | null
          created_at?: string
          data?: Json
          duration?: string | null
          external_url?: string | null
          highlight_type?: string
          id?: string
          metadata?: Json
          position?: number
          preview_provider?: string | null
          preview_url?: string | null
          provider?: string | null
          source_entity?: string | null
          source_kind?: string | null
          source_record_id?: string | null
          source_staging_record_id?: string | null
          status?: string
          subtitle?: string | null
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "registry_artist_highlights_artwork_image_id_fkey"
            columns: ["artwork_image_id"]
            isOneToOne: false
            referencedRelation: "registry_media_assets"
            referencedColumns: ["id"]
          },
        ]
      }
      registry_artist_relationships: {
        Row: {
          artist_a_id: string
          artist_a_slug: string | null
          artist_b_id: string
          artist_b_slug: string | null
          confidence: number | null
          created_at: string
          id: string
          metadata: Json
          relationship_status: string
          relationship_type: string
          source_kind: string | null
          source_record_id: string | null
          source_staging_record_id: string | null
          updated_at: string
        }
        Insert: {
          artist_a_id: string
          artist_a_slug?: string | null
          artist_b_id: string
          artist_b_slug?: string | null
          confidence?: number | null
          created_at?: string
          id?: string
          metadata?: Json
          relationship_status?: string
          relationship_type?: string
          source_kind?: string | null
          source_record_id?: string | null
          source_staging_record_id?: string | null
          updated_at?: string
        }
        Update: {
          artist_a_id?: string
          artist_a_slug?: string | null
          artist_b_id?: string
          artist_b_slug?: string | null
          confidence?: number | null
          created_at?: string
          id?: string
          metadata?: Json
          relationship_status?: string
          relationship_type?: string
          source_kind?: string | null
          source_record_id?: string | null
          source_staging_record_id?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "registry_artist_relationships_artist_a_id_fkey"
            columns: ["artist_a_id"]
            isOneToOne: false
            referencedRelation: "registry_artists"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "registry_artist_relationships_artist_b_id_fkey"
            columns: ["artist_b_id"]
            isOneToOne: false
            referencedRelation: "registry_artists"
            referencedColumns: ["id"]
          },
        ]
      }
      registry_artist_resolution_events: {
        Row: {
          action: string
          actor_id: string | null
          actor_label: string | null
          chart_entries: Json
          created_at: string
          error_message: string | null
          id: string
          note: string | null
          release_links: Json
          replacement_artists: Json
          result: Json
          source_artist_id: string | null
          source_artist_name: string | null
          source_artist_slug: string | null
          source_snapshot: Json
          status: string
          track_links: Json
        }
        Insert: {
          action: string
          actor_id?: string | null
          actor_label?: string | null
          chart_entries?: Json
          created_at?: string
          error_message?: string | null
          id?: string
          note?: string | null
          release_links?: Json
          replacement_artists?: Json
          result?: Json
          source_artist_id?: string | null
          source_artist_name?: string | null
          source_artist_slug?: string | null
          source_snapshot?: Json
          status: string
          track_links?: Json
        }
        Update: {
          action?: string
          actor_id?: string | null
          actor_label?: string | null
          chart_entries?: Json
          created_at?: string
          error_message?: string | null
          id?: string
          note?: string | null
          release_links?: Json
          replacement_artists?: Json
          result?: Json
          source_artist_id?: string | null
          source_artist_name?: string | null
          source_artist_slug?: string | null
          source_snapshot?: Json
          status?: string
          track_links?: Json
        }
        Relationships: []
      }
      registry_artists: {
        Row: {
          artist_type: string | null
          bio: string | null
          created_at: string
          display_name: string
          gender: string | null
          id: string
          image_source_provider: string | null
          living_memory_editorial_label: string | null
          living_memory_editorial_opener: string | null
          living_memory_public_prompt: string | null
          living_memory_status: string
          living_memory_updated_at: string | null
          metadata: Json
          normalized_name: string
          origin_confidence: number | null
          origin_iso2: string | null
          public_image_id: string | null
          public_image_url: string | null
          slug: string
          sort_name: string | null
          status: string
          updated_at: string
        }
        Insert: {
          artist_type?: string | null
          bio?: string | null
          created_at?: string
          display_name: string
          gender?: string | null
          id?: string
          image_source_provider?: string | null
          living_memory_editorial_label?: string | null
          living_memory_editorial_opener?: string | null
          living_memory_public_prompt?: string | null
          living_memory_status?: string
          living_memory_updated_at?: string | null
          metadata?: Json
          normalized_name: string
          origin_confidence?: number | null
          origin_iso2?: string | null
          public_image_id?: string | null
          public_image_url?: string | null
          slug: string
          sort_name?: string | null
          status?: string
          updated_at?: string
        }
        Update: {
          artist_type?: string | null
          bio?: string | null
          created_at?: string
          display_name?: string
          gender?: string | null
          id?: string
          image_source_provider?: string | null
          living_memory_editorial_label?: string | null
          living_memory_editorial_opener?: string | null
          living_memory_public_prompt?: string | null
          living_memory_status?: string
          living_memory_updated_at?: string | null
          metadata?: Json
          normalized_name?: string
          origin_confidence?: number | null
          origin_iso2?: string | null
          public_image_id?: string | null
          public_image_url?: string | null
          slug?: string
          sort_name?: string | null
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "registry_artists_public_image_id_fkey"
            columns: ["public_image_id"]
            isOneToOne: false
            referencedRelation: "registry_media_assets"
            referencedColumns: ["id"]
          },
        ]
      }
      registry_audit_log: {
        Row: {
          action: string
          actor_id: string | null
          actor_label: string
          after_value: Json | null
          before_value: Json | null
          created_at: string
          entity_id: string | null
          entity_type: string | null
          id: string
          metadata: Json
        }
        Insert: {
          action: string
          actor_id?: string | null
          actor_label?: string
          after_value?: Json | null
          before_value?: Json | null
          created_at?: string
          entity_id?: string | null
          entity_type?: string | null
          id?: string
          metadata?: Json
        }
        Update: {
          action?: string
          actor_id?: string | null
          actor_label?: string
          after_value?: Json | null
          before_value?: Json | null
          created_at?: string
          entity_id?: string | null
          entity_type?: string | null
          id?: string
          metadata?: Json
        }
        Relationships: []
      }
      registry_authors: {
        Row: {
          avatar_image_id: string | null
          avatar_url: string | null
          bio: string | null
          cover_image_id: string | null
          cover_url: string | null
          created_at: string
          email: string | null
          id: string
          joined_date: string | null
          location: string | null
          mapped_record: Json
          name: string
          raw_record: Json
          role: string | null
          slug: string
          social_links: Json | null
          source_ingestion_run_id: string
          source_kind: string
          source_record_id: string | null
          source_staging_record_id: string
          updated_at: string
          url: string | null
        }
        Insert: {
          avatar_image_id?: string | null
          avatar_url?: string | null
          bio?: string | null
          cover_image_id?: string | null
          cover_url?: string | null
          created_at?: string
          email?: string | null
          id?: string
          joined_date?: string | null
          location?: string | null
          mapped_record?: Json
          name: string
          raw_record?: Json
          role?: string | null
          slug: string
          social_links?: Json | null
          source_ingestion_run_id: string
          source_kind?: string
          source_record_id?: string | null
          source_staging_record_id: string
          updated_at?: string
          url?: string | null
        }
        Update: {
          avatar_image_id?: string | null
          avatar_url?: string | null
          bio?: string | null
          cover_image_id?: string | null
          cover_url?: string | null
          created_at?: string
          email?: string | null
          id?: string
          joined_date?: string | null
          location?: string | null
          mapped_record?: Json
          name?: string
          raw_record?: Json
          role?: string | null
          slug?: string
          social_links?: Json | null
          source_ingestion_run_id?: string
          source_kind?: string
          source_record_id?: string | null
          source_staging_record_id?: string
          updated_at?: string
          url?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "registry_authors_avatar_image_id_fkey"
            columns: ["avatar_image_id"]
            isOneToOne: false
            referencedRelation: "registry_media_assets"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "registry_authors_cover_image_id_fkey"
            columns: ["cover_image_id"]
            isOneToOne: false
            referencedRelation: "registry_media_assets"
            referencedColumns: ["id"]
          },
        ]
      }
      registry_canonical_write_events: {
        Row: {
          action: string
          actor: string
          after_value: Json | null
          before_value: Json | null
          created_at: string
          error_message: string | null
          field_name: string
          id: string
          registry_entity_id: string
          registry_entity_type: string
          source_suggestion_id: string | null
          source_table: string
          status: string
          target_path: string
        }
        Insert: {
          action: string
          actor?: string
          after_value?: Json | null
          before_value?: Json | null
          created_at?: string
          error_message?: string | null
          field_name: string
          id?: string
          registry_entity_id: string
          registry_entity_type: string
          source_suggestion_id?: string | null
          source_table?: string
          status: string
          target_path: string
        }
        Update: {
          action?: string
          actor?: string
          after_value?: Json | null
          before_value?: Json | null
          created_at?: string
          error_message?: string | null
          field_name?: string
          id?: string
          registry_entity_id?: string
          registry_entity_type?: string
          source_suggestion_id?: string | null
          source_table?: string
          status?: string
          target_path?: string
        }
        Relationships: []
      }
      registry_canonicalization_decisions: {
        Row: {
          after_payload: Json
          before_payload: Json
          created_at: string
          decided_by: string | null
          decision_notes: string | null
          decision_type: string
          entity_id: string | null
          entity_type: string
          id: string
          metadata: Json
          review_item_id: string | null
          status: string
        }
        Insert: {
          after_payload?: Json
          before_payload?: Json
          created_at?: string
          decided_by?: string | null
          decision_notes?: string | null
          decision_type: string
          entity_id?: string | null
          entity_type: string
          id?: string
          metadata?: Json
          review_item_id?: string | null
          status?: string
        }
        Update: {
          after_payload?: Json
          before_payload?: Json
          created_at?: string
          decided_by?: string | null
          decision_notes?: string | null
          decision_type?: string
          entity_id?: string | null
          entity_type?: string
          id?: string
          metadata?: Json
          review_item_id?: string | null
          status?: string
        }
        Relationships: []
      }
      registry_enrichment_suggestions: {
        Row: {
          confidence_score: number
          created_at: string
          current_value: string | null
          decision_reason: string | null
          decision_status: string
          field_name: string
          id: string
          provider_item_id: string | null
          registry_entity_id: string
          registry_entity_type: string
          suggested_value: string
          updated_at: string
        }
        Insert: {
          confidence_score?: number
          created_at?: string
          current_value?: string | null
          decision_reason?: string | null
          decision_status?: string
          field_name: string
          id?: string
          provider_item_id?: string | null
          registry_entity_id: string
          registry_entity_type: string
          suggested_value: string
          updated_at?: string
        }
        Update: {
          confidence_score?: number
          created_at?: string
          current_value?: string | null
          decision_reason?: string | null
          decision_status?: string
          field_name?: string
          id?: string
          provider_item_id?: string | null
          registry_entity_id?: string
          registry_entity_type?: string
          suggested_value?: string
          updated_at?: string
        }
        Relationships: []
      }
      registry_entity_metadata: {
        Row: {
          created_at: string
          entity_slug: string
          entity_type: string
          id: string
          meta_class: string
          meta_group: string
          meta_key: string
          meta_value: string | null
          meta_value_json: Json | null
          metadata: Json
          source_entity: string | null
          source_kind: string | null
          source_record_id: string | null
          source_staging_record_id: string | null
          status: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          entity_slug: string
          entity_type: string
          id?: string
          meta_class?: string
          meta_group?: string
          meta_key: string
          meta_value?: string | null
          meta_value_json?: Json | null
          metadata?: Json
          source_entity?: string | null
          source_kind?: string | null
          source_record_id?: string | null
          source_staging_record_id?: string | null
          status?: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          entity_slug?: string
          entity_type?: string
          id?: string
          meta_class?: string
          meta_group?: string
          meta_key?: string
          meta_value?: string | null
          meta_value_json?: Json | null
          metadata?: Json
          source_entity?: string | null
          source_kind?: string | null
          source_record_id?: string | null
          source_staging_record_id?: string | null
          status?: string
          updated_at?: string
        }
        Relationships: []
      }
      registry_entity_relationships: {
        Row: {
          confidence: number | null
          created_at: string
          created_by: string | null
          id: string
          metadata: Json
          plain_reason: string | null
          public_safe: boolean
          relationship_role: string | null
          relationship_status: string
          relationship_type: string
          review_note: string | null
          review_status: string
          reviewed_at: string | null
          reviewed_by: string | null
          sort_order: number | null
          source_entity: string | null
          source_entity_id: string | null
          source_entity_type: string
          source_kind: string | null
          source_record_id: string | null
          source_slug: string
          source_staging_record_id: string | null
          status_reason: string | null
          superseded_by_relationship_id: string | null
          target_entity_id: string | null
          target_entity_type: string
          target_slug: string
          updated_at: string
          updated_by: string | null
          valid_from: string | null
          valid_to: string | null
        }
        Insert: {
          confidence?: number | null
          created_at?: string
          created_by?: string | null
          id?: string
          metadata?: Json
          plain_reason?: string | null
          public_safe?: boolean
          relationship_role?: string | null
          relationship_status?: string
          relationship_type: string
          review_note?: string | null
          review_status?: string
          reviewed_at?: string | null
          reviewed_by?: string | null
          sort_order?: number | null
          source_entity?: string | null
          source_entity_id?: string | null
          source_entity_type: string
          source_kind?: string | null
          source_record_id?: string | null
          source_slug: string
          source_staging_record_id?: string | null
          status_reason?: string | null
          superseded_by_relationship_id?: string | null
          target_entity_id?: string | null
          target_entity_type: string
          target_slug: string
          updated_at?: string
          updated_by?: string | null
          valid_from?: string | null
          valid_to?: string | null
        }
        Update: {
          confidence?: number | null
          created_at?: string
          created_by?: string | null
          id?: string
          metadata?: Json
          plain_reason?: string | null
          public_safe?: boolean
          relationship_role?: string | null
          relationship_status?: string
          relationship_type?: string
          review_note?: string | null
          review_status?: string
          reviewed_at?: string | null
          reviewed_by?: string | null
          sort_order?: number | null
          source_entity?: string | null
          source_entity_id?: string | null
          source_entity_type?: string
          source_kind?: string | null
          source_record_id?: string | null
          source_slug?: string
          source_staging_record_id?: string | null
          status_reason?: string | null
          superseded_by_relationship_id?: string | null
          target_entity_id?: string | null
          target_entity_type?: string
          target_slug?: string
          updated_at?: string
          updated_by?: string | null
          valid_from?: string | null
          valid_to?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "registry_entity_relationships_superseded_by_relationship_i_fkey"
            columns: ["superseded_by_relationship_id"]
            isOneToOne: false
            referencedRelation: "registry_entity_relationships"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "registry_entity_relationships_superseded_by_relationship_i_fkey"
            columns: ["superseded_by_relationship_id"]
            isOneToOne: false
            referencedRelation: "registry_relationship_consolidation_queue"
            referencedColumns: ["relationship_id"]
          },
          {
            foreignKeyName: "registry_entity_relationships_superseded_by_relationship_i_fkey"
            columns: ["superseded_by_relationship_id"]
            isOneToOne: false
            referencedRelation: "registry_relationship_duplicate_keys"
            referencedColumns: ["relationship_id"]
          },
          {
            foreignKeyName: "registry_entity_relationships_superseded_by_relationship_i_fkey"
            columns: ["superseded_by_relationship_id"]
            isOneToOne: false
            referencedRelation: "registry_relationship_endpoint_work_queue"
            referencedColumns: ["relationship_id"]
          },
          {
            foreignKeyName: "registry_entity_relationships_superseded_by_relationship_i_fkey"
            columns: ["superseded_by_relationship_id"]
            isOneToOne: false
            referencedRelation: "registry_relationship_evidence_readiness_queue"
            referencedColumns: ["relationship_id"]
          },
          {
            foreignKeyName: "registry_entity_relationships_superseded_by_relationship_i_fkey"
            columns: ["superseded_by_relationship_id"]
            isOneToOne: false
            referencedRelation: "registry_unresolved_relationship_endpoints"
            referencedColumns: ["relationship_id"]
          },
        ]
      }
      registry_genre_aliases: {
        Row: {
          created_at: string
          genre_id: string | null
          id: string
          metadata: Json
          normalized_key: string
          notes: string | null
          raw_label: string
          source: string
          status: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          genre_id?: string | null
          id?: string
          metadata?: Json
          normalized_key: string
          notes?: string | null
          raw_label: string
          source?: string
          status?: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          genre_id?: string | null
          id?: string
          metadata?: Json
          normalized_key?: string
          notes?: string | null
          raw_label?: string
          source?: string
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "registry_genre_aliases_genre_id_fkey"
            columns: ["genre_id"]
            isOneToOne: false
            referencedRelation: "registry_genres"
            referencedColumns: ["id"]
          },
        ]
      }
      registry_genres: {
        Row: {
          created_at: string
          description: string | null
          id: string
          metadata: Json
          name: string
          parent_genre_id: string | null
          slug: string
          status: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          description?: string | null
          id?: string
          metadata?: Json
          name: string
          parent_genre_id?: string | null
          slug: string
          status?: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          description?: string | null
          id?: string
          metadata?: Json
          name?: string
          parent_genre_id?: string | null
          slug?: string
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "registry_genres_parent_genre_id_fkey"
            columns: ["parent_genre_id"]
            isOneToOne: false
            referencedRelation: "registry_genres"
            referencedColumns: ["id"]
          },
        ]
      }
      registry_labels: {
        Row: {
          country_code: string | null
          created_at: string
          description: string | null
          id: string
          metadata: Json
          name: string
          normalized_name: string
          slug: string
          status: string
          updated_at: string
        }
        Insert: {
          country_code?: string | null
          created_at?: string
          description?: string | null
          id?: string
          metadata?: Json
          name: string
          normalized_name: string
          slug: string
          status?: string
          updated_at?: string
        }
        Update: {
          country_code?: string | null
          created_at?: string
          description?: string | null
          id?: string
          metadata?: Json
          name?: string
          normalized_name?: string
          slug?: string
          status?: string
          updated_at?: string
        }
        Relationships: []
      }
      registry_media_assets: {
        Row: {
          asset_purpose: string | null
          content_date: string | null
          country_code: string | null
          created_at: string
          credit_text: string | null
          display_filename: string | null
          file_extension: string | null
          file_kind: string | null
          file_size_bytes: number | null
          folder_id: string | null
          id: string
          internal_notes: string | null
          language_code: string | null
          media_kind: string
          metadata: Json
          mime_type: string | null
          original_filename: string | null
          rights_status: string
          slug: string
          source_entity: string | null
          source_kind: string | null
          source_record_id: string | null
          source_staging_record_id: string | null
          status: string
          storage_bucket: string | null
          storage_path: string | null
          tags: string[]
          title: string | null
          updated_at: string
          url: string
        }
        Insert: {
          asset_purpose?: string | null
          content_date?: string | null
          country_code?: string | null
          created_at?: string
          credit_text?: string | null
          display_filename?: string | null
          file_extension?: string | null
          file_kind?: string | null
          file_size_bytes?: number | null
          folder_id?: string | null
          id?: string
          internal_notes?: string | null
          language_code?: string | null
          media_kind?: string
          metadata?: Json
          mime_type?: string | null
          original_filename?: string | null
          rights_status?: string
          slug: string
          source_entity?: string | null
          source_kind?: string | null
          source_record_id?: string | null
          source_staging_record_id?: string | null
          status?: string
          storage_bucket?: string | null
          storage_path?: string | null
          tags?: string[]
          title?: string | null
          updated_at?: string
          url: string
        }
        Update: {
          asset_purpose?: string | null
          content_date?: string | null
          country_code?: string | null
          created_at?: string
          credit_text?: string | null
          display_filename?: string | null
          file_extension?: string | null
          file_kind?: string | null
          file_size_bytes?: number | null
          folder_id?: string | null
          id?: string
          internal_notes?: string | null
          language_code?: string | null
          media_kind?: string
          metadata?: Json
          mime_type?: string | null
          original_filename?: string | null
          rights_status?: string
          slug?: string
          source_entity?: string | null
          source_kind?: string | null
          source_record_id?: string | null
          source_staging_record_id?: string | null
          status?: string
          storage_bucket?: string | null
          storage_path?: string | null
          tags?: string[]
          title?: string | null
          updated_at?: string
          url?: string
        }
        Relationships: [
          {
            foreignKeyName: "registry_media_assets_folder_id_fkey"
            columns: ["folder_id"]
            isOneToOne: false
            referencedRelation: "media_folders"
            referencedColumns: ["id"]
          },
        ]
      }
      registry_provenance_links: {
        Row: {
          archived_at: string
          id: string
          metadata: Json
          original_created_at: string
          original_relationship_id: string
          original_updated_at: string
          relationship_role: string | null
          relationship_status: string
          relationship_type: string
          source_entity: string | null
          source_entity_type: string
          source_kind: string | null
          source_record_id: string | null
          source_slug: string
          source_staging_record_id: string | null
          target_entity_type: string
          target_media_asset_id: string | null
          target_slug: string
        }
        Insert: {
          archived_at?: string
          id?: string
          metadata?: Json
          original_created_at: string
          original_relationship_id: string
          original_updated_at: string
          relationship_role?: string | null
          relationship_status: string
          relationship_type: string
          source_entity?: string | null
          source_entity_type: string
          source_kind?: string | null
          source_record_id?: string | null
          source_slug: string
          source_staging_record_id?: string | null
          target_entity_type: string
          target_media_asset_id?: string | null
          target_slug: string
        }
        Update: {
          archived_at?: string
          id?: string
          metadata?: Json
          original_created_at?: string
          original_relationship_id?: string
          original_updated_at?: string
          relationship_role?: string | null
          relationship_status?: string
          relationship_type?: string
          source_entity?: string | null
          source_entity_type?: string
          source_kind?: string | null
          source_record_id?: string | null
          source_slug?: string
          source_staging_record_id?: string | null
          target_entity_type?: string
          target_media_asset_id?: string | null
          target_slug?: string
        }
        Relationships: [
          {
            foreignKeyName: "registry_provenance_links_target_media_asset_id_fkey"
            columns: ["target_media_asset_id"]
            isOneToOne: false
            referencedRelation: "registry_media_assets"
            referencedColumns: ["id"]
          },
        ]
      }
      registry_provider_sources: {
        Row: {
          entity_id: string | null
          entity_type: string
          first_seen_at: string
          id: string
          is_primary_source: boolean
          last_seen_at: string
          metadata: Json
          provider: string
          provider_entity_id: string | null
          provider_entity_type: string | null
          provider_url: string | null
          raw_payload: Json
          status: string
          storefront: string | null
        }
        Insert: {
          entity_id?: string | null
          entity_type: string
          first_seen_at?: string
          id?: string
          is_primary_source?: boolean
          last_seen_at?: string
          metadata?: Json
          provider: string
          provider_entity_id?: string | null
          provider_entity_type?: string | null
          provider_url?: string | null
          raw_payload?: Json
          status?: string
          storefront?: string | null
        }
        Update: {
          entity_id?: string | null
          entity_type?: string
          first_seen_at?: string
          id?: string
          is_primary_source?: boolean
          last_seen_at?: string
          metadata?: Json
          provider?: string
          provider_entity_id?: string | null
          provider_entity_type?: string | null
          provider_url?: string | null
          raw_payload?: Json
          status?: string
          storefront?: string | null
        }
        Relationships: []
      }
      registry_provider_track_suggestion_artists: {
        Row: {
          created_at: string
          credit_order: number
          credit_role: string
          id: string
          observed_name: string
          registry_artist_id: string | null
          resolution_mode: string
          suggestion_id: string
        }
        Insert: {
          created_at?: string
          credit_order: number
          credit_role: string
          id?: string
          observed_name: string
          registry_artist_id?: string | null
          resolution_mode: string
          suggestion_id: string
        }
        Update: {
          created_at?: string
          credit_order?: number
          credit_role?: string
          id?: string
          observed_name?: string
          registry_artist_id?: string | null
          resolution_mode?: string
          suggestion_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "registry_provider_track_suggestion_artists_artist_fkey"
            columns: ["registry_artist_id"]
            isOneToOne: false
            referencedRelation: "registry_artists"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "registry_provider_track_suggestion_artists_suggestion_fkey"
            columns: ["suggestion_id"]
            isOneToOne: false
            referencedRelation: "registry_provider_track_suggestions"
            referencedColumns: ["id"]
          },
        ]
      }
      registry_provider_track_suggestions: {
        Row: {
          artist_resolution_mode: string
          artist_submission_key: string | null
          canonical_track_id: string | null
          canonicalized_track_id: string | null
          created_at: string
          id: string
          intake_origin: string
          playback_kind: string | null
          playlist_note: string | null
          provider_artist_names: string[]
          provider_key: string | null
          provider_object_id: string | null
          provider_release_title: string | null
          provider_title: string | null
          provider_url: string | null
          registry_artist_id: string | null
          requested_by: string | null
          reserved_position: number | null
          review_due_at: string | null
          review_note: string | null
          reviewed_at: string | null
          reviewed_by: string | null
          source_artist_validation_id: string | null
          source_contribution_id: string | null
          source_playlist_id: string | null
          source_playlist_item_id: string | null
          status: string
          submitted_by_representation_id: string | null
          submitted_for_artist_id: string | null
          submitted_track_title: string | null
          updated_at: string
          validation_snapshot: Json
        }
        Insert: {
          artist_resolution_mode?: string
          artist_submission_key?: string | null
          canonical_track_id?: string | null
          canonicalized_track_id?: string | null
          created_at?: string
          id?: string
          intake_origin?: string
          playback_kind?: string | null
          playlist_note?: string | null
          provider_artist_names?: string[]
          provider_key?: string | null
          provider_object_id?: string | null
          provider_release_title?: string | null
          provider_title?: string | null
          provider_url?: string | null
          registry_artist_id?: string | null
          requested_by?: string | null
          reserved_position?: number | null
          review_due_at?: string | null
          review_note?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          source_artist_validation_id?: string | null
          source_contribution_id?: string | null
          source_playlist_id?: string | null
          source_playlist_item_id?: string | null
          status?: string
          submitted_by_representation_id?: string | null
          submitted_for_artist_id?: string | null
          submitted_track_title?: string | null
          updated_at?: string
          validation_snapshot?: Json
        }
        Update: {
          artist_resolution_mode?: string
          artist_submission_key?: string | null
          canonical_track_id?: string | null
          canonicalized_track_id?: string | null
          created_at?: string
          id?: string
          intake_origin?: string
          playback_kind?: string | null
          playlist_note?: string | null
          provider_artist_names?: string[]
          provider_key?: string | null
          provider_object_id?: string | null
          provider_release_title?: string | null
          provider_title?: string | null
          provider_url?: string | null
          registry_artist_id?: string | null
          requested_by?: string | null
          reserved_position?: number | null
          review_due_at?: string | null
          review_note?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          source_artist_validation_id?: string | null
          source_contribution_id?: string | null
          source_playlist_id?: string | null
          source_playlist_item_id?: string | null
          status?: string
          submitted_by_representation_id?: string | null
          submitted_for_artist_id?: string | null
          submitted_track_title?: string | null
          updated_at?: string
          validation_snapshot?: Json
        }
        Relationships: [
          {
            foreignKeyName: "registry_provider_track_sugge_submitted_by_representation__fkey"
            columns: ["submitted_by_representation_id"]
            isOneToOne: false
            referencedRelation: "artist_representations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "registry_provider_track_suggestion_submitted_for_artist_id_fkey"
            columns: ["submitted_for_artist_id"]
            isOneToOne: false
            referencedRelation: "registry_artists"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "registry_provider_track_suggestions_artist_fkey"
            columns: ["registry_artist_id"]
            isOneToOne: false
            referencedRelation: "registry_artists"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "registry_provider_track_suggestions_canonicalized_track_fkey"
            columns: ["canonicalized_track_id"]
            isOneToOne: false
            referencedRelation: "registry_tracks"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "registry_provider_track_suggestions_item_fkey"
            columns: ["source_playlist_item_id"]
            isOneToOne: false
            referencedRelation: "wk_playlist_items"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "registry_provider_track_suggestions_playlist_fkey"
            columns: ["source_playlist_id"]
            isOneToOne: false
            referencedRelation: "wk_playlists"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "registry_provider_track_suggestions_source_contribution_fkey"
            columns: ["source_contribution_id"]
            isOneToOne: false
            referencedRelation: "community_contributions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "registry_provider_track_suggestions_track_fkey"
            columns: ["canonical_track_id"]
            isOneToOne: false
            referencedRelation: "registry_tracks"
            referencedColumns: ["id"]
          },
        ]
      }
      registry_relationship_evidence: {
        Row: {
          created_at: string
          created_by: string | null
          evidence_id: string
          note: string | null
          relationship_id: string
          support_type: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          evidence_id: string
          note?: string | null
          relationship_id: string
          support_type?: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          evidence_id?: string
          note?: string | null
          relationship_id?: string
          support_type?: string
        }
        Relationships: [
          {
            foreignKeyName: "registry_relationship_evidence_evidence_id_fkey"
            columns: ["evidence_id"]
            isOneToOne: false
            referencedRelation: "evidence_items"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "registry_relationship_evidence_evidence_id_fkey"
            columns: ["evidence_id"]
            isOneToOne: false
            referencedRelation: "institute_admin_inquiry_evidence"
            referencedColumns: ["evidence_id"]
          },
          {
            foreignKeyName: "registry_relationship_evidence_evidence_id_fkey"
            columns: ["evidence_id"]
            isOneToOne: false
            referencedRelation: "institute_retrieval_ready_evidence"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "registry_relationship_evidence_evidence_id_fkey"
            columns: ["evidence_id"]
            isOneToOne: false
            referencedRelation: "institute_review_queue_evidence"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "registry_relationship_evidence_relationship_id_fkey"
            columns: ["relationship_id"]
            isOneToOne: false
            referencedRelation: "registry_entity_relationships"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "registry_relationship_evidence_relationship_id_fkey"
            columns: ["relationship_id"]
            isOneToOne: false
            referencedRelation: "registry_relationship_consolidation_queue"
            referencedColumns: ["relationship_id"]
          },
          {
            foreignKeyName: "registry_relationship_evidence_relationship_id_fkey"
            columns: ["relationship_id"]
            isOneToOne: false
            referencedRelation: "registry_relationship_duplicate_keys"
            referencedColumns: ["relationship_id"]
          },
          {
            foreignKeyName: "registry_relationship_evidence_relationship_id_fkey"
            columns: ["relationship_id"]
            isOneToOne: false
            referencedRelation: "registry_relationship_endpoint_work_queue"
            referencedColumns: ["relationship_id"]
          },
          {
            foreignKeyName: "registry_relationship_evidence_relationship_id_fkey"
            columns: ["relationship_id"]
            isOneToOne: false
            referencedRelation: "registry_relationship_evidence_readiness_queue"
            referencedColumns: ["relationship_id"]
          },
          {
            foreignKeyName: "registry_relationship_evidence_relationship_id_fkey"
            columns: ["relationship_id"]
            isOneToOne: false
            referencedRelation: "registry_unresolved_relationship_endpoints"
            referencedColumns: ["relationship_id"]
          },
        ]
      }
      registry_release_artists: {
        Row: {
          artist_id: string | null
          artist_name_text: string | null
          artist_slug: string | null
          confidence: number
          created_at: string
          credit_order: number
          display_credit: string | null
          id: string
          is_featured: boolean
          is_primary: boolean
          metadata: Json
          release_id: string | null
          role: string
          source: string
          status: string
          updated_at: string
        }
        Insert: {
          artist_id?: string | null
          artist_name_text?: string | null
          artist_slug?: string | null
          confidence?: number
          created_at?: string
          credit_order?: number
          display_credit?: string | null
          id?: string
          is_featured?: boolean
          is_primary?: boolean
          metadata?: Json
          release_id?: string | null
          role?: string
          source?: string
          status?: string
          updated_at?: string
        }
        Update: {
          artist_id?: string | null
          artist_name_text?: string | null
          artist_slug?: string | null
          confidence?: number
          created_at?: string
          credit_order?: number
          display_credit?: string | null
          id?: string
          is_featured?: boolean
          is_primary?: boolean
          metadata?: Json
          release_id?: string | null
          role?: string
          source?: string
          status?: string
          updated_at?: string
        }
        Relationships: []
      }
      registry_release_genres: {
        Row: {
          classification_status: string
          confidence: number | null
          created_at: string
          created_by: string | null
          editorial_note: string | null
          genre_id: string | null
          id: string
          is_primary: boolean
          metadata: Json
          normalized_key: string
          provider: string | null
          raw_genre_name: string
          release_id: string
          reviewed_at: string | null
          sort_order: number
          source: string
          source_context: string | null
          updated_at: string
        }
        Insert: {
          classification_status?: string
          confidence?: number | null
          created_at?: string
          created_by?: string | null
          editorial_note?: string | null
          genre_id?: string | null
          id?: string
          is_primary?: boolean
          metadata?: Json
          normalized_key: string
          provider?: string | null
          raw_genre_name: string
          release_id: string
          reviewed_at?: string | null
          sort_order?: number
          source?: string
          source_context?: string | null
          updated_at?: string
        }
        Update: {
          classification_status?: string
          confidence?: number | null
          created_at?: string
          created_by?: string | null
          editorial_note?: string | null
          genre_id?: string | null
          id?: string
          is_primary?: boolean
          metadata?: Json
          normalized_key?: string
          provider?: string | null
          raw_genre_name?: string
          release_id?: string
          reviewed_at?: string | null
          sort_order?: number
          source?: string
          source_context?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "registry_release_genres_genre_id_fkey"
            columns: ["genre_id"]
            isOneToOne: false
            referencedRelation: "registry_genres"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "registry_release_genres_release_id_fkey"
            columns: ["release_id"]
            isOneToOne: false
            referencedRelation: "registry_releases"
            referencedColumns: ["id"]
          },
        ]
      }
      registry_release_tracks: {
        Row: {
          confidence: number
          created_at: string
          disc_number: number
          id: string
          metadata: Json
          release_id: string | null
          source: string
          status: string
          track_id: string | null
          track_number: number | null
          updated_at: string
        }
        Insert: {
          confidence?: number
          created_at?: string
          disc_number?: number
          id?: string
          metadata?: Json
          release_id?: string | null
          source?: string
          status?: string
          track_id?: string | null
          track_number?: number | null
          updated_at?: string
        }
        Update: {
          confidence?: number
          created_at?: string
          disc_number?: number
          id?: string
          metadata?: Json
          release_id?: string | null
          source?: string
          status?: string
          track_id?: string | null
          track_number?: number | null
          updated_at?: string
        }
        Relationships: []
      }
      registry_releases: {
        Row: {
          artwork_image_id: string | null
          artwork_url: string | null
          created_at: string
          description: string | null
          id: string
          label_id: string | null
          living_memory_editorial_label: string | null
          living_memory_editorial_opener: string | null
          living_memory_public_prompt: string | null
          living_memory_status: string
          living_memory_updated_at: string | null
          metadata: Json
          normalized_title: string
          release_date: string | null
          release_date_precision: string | null
          release_type: string | null
          slug: string
          status: string
          title: string
          upc: string | null
          updated_at: string
        }
        Insert: {
          artwork_image_id?: string | null
          artwork_url?: string | null
          created_at?: string
          description?: string | null
          id?: string
          label_id?: string | null
          living_memory_editorial_label?: string | null
          living_memory_editorial_opener?: string | null
          living_memory_public_prompt?: string | null
          living_memory_status?: string
          living_memory_updated_at?: string | null
          metadata?: Json
          normalized_title: string
          release_date?: string | null
          release_date_precision?: string | null
          release_type?: string | null
          slug: string
          status?: string
          title: string
          upc?: string | null
          updated_at?: string
        }
        Update: {
          artwork_image_id?: string | null
          artwork_url?: string | null
          created_at?: string
          description?: string | null
          id?: string
          label_id?: string | null
          living_memory_editorial_label?: string | null
          living_memory_editorial_opener?: string | null
          living_memory_public_prompt?: string | null
          living_memory_status?: string
          living_memory_updated_at?: string | null
          metadata?: Json
          normalized_title?: string
          release_date?: string | null
          release_date_precision?: string | null
          release_type?: string | null
          slug?: string
          status?: string
          title?: string
          upc?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "registry_releases_artwork_image_id_fkey"
            columns: ["artwork_image_id"]
            isOneToOne: false
            referencedRelation: "registry_media_assets"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "registry_releases_label_id_fkey"
            columns: ["label_id"]
            isOneToOne: false
            referencedRelation: "registry_labels"
            referencedColumns: ["id"]
          },
        ]
      }
      registry_review_items: {
        Row: {
          assigned_to: string | null
          candidate_payload: Json
          created_at: string
          entity_id: string | null
          entity_type: string
          id: string
          priority: string
          related_entity_id: string | null
          related_entity_type: string | null
          resolution_payload: Json
          resolved_at: string | null
          review_key: string
          review_type: string
          source_id: string | null
          source_payload: Json
          source_table: string | null
          status: string
          summary: string | null
          title: string
          updated_at: string
        }
        Insert: {
          assigned_to?: string | null
          candidate_payload?: Json
          created_at?: string
          entity_id?: string | null
          entity_type: string
          id?: string
          priority?: string
          related_entity_id?: string | null
          related_entity_type?: string | null
          resolution_payload?: Json
          resolved_at?: string | null
          review_key: string
          review_type: string
          source_id?: string | null
          source_payload?: Json
          source_table?: string | null
          status?: string
          summary?: string | null
          title: string
          updated_at?: string
        }
        Update: {
          assigned_to?: string | null
          candidate_payload?: Json
          created_at?: string
          entity_id?: string | null
          entity_type?: string
          id?: string
          priority?: string
          related_entity_id?: string | null
          related_entity_type?: string | null
          resolution_payload?: Json
          resolved_at?: string | null
          review_key?: string
          review_type?: string
          source_id?: string | null
          source_payload?: Json
          source_table?: string | null
          status?: string
          summary?: string | null
          title?: string
          updated_at?: string
        }
        Relationships: []
      }
      registry_taxonomy_terms: {
        Row: {
          created_at: string
          description: string | null
          id: string
          metadata: Json
          name: string
          slug: string
          source_entity: string | null
          source_kind: string | null
          source_record_id: string | null
          source_staging_record_id: string | null
          status: string
          taxonomy: string
          term_group: string | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          description?: string | null
          id?: string
          metadata?: Json
          name: string
          slug: string
          source_entity?: string | null
          source_kind?: string | null
          source_record_id?: string | null
          source_staging_record_id?: string | null
          status?: string
          taxonomy?: string
          term_group?: string | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          description?: string | null
          id?: string
          metadata?: Json
          name?: string
          slug?: string
          source_entity?: string | null
          source_kind?: string | null
          source_record_id?: string | null
          source_staging_record_id?: string | null
          status?: string
          taxonomy?: string
          term_group?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      registry_track_artists: {
        Row: {
          artist_id: string | null
          artist_name_text: string | null
          artist_slug: string | null
          confidence: number
          created_at: string
          credit_order: number
          display_credit: string | null
          id: string
          is_featured: boolean
          is_primary: boolean
          metadata: Json
          role: string
          source: string
          status: string
          track_id: string | null
          updated_at: string
        }
        Insert: {
          artist_id?: string | null
          artist_name_text?: string | null
          artist_slug?: string | null
          confidence?: number
          created_at?: string
          credit_order?: number
          display_credit?: string | null
          id?: string
          is_featured?: boolean
          is_primary?: boolean
          metadata?: Json
          role?: string
          source?: string
          status?: string
          track_id?: string | null
          updated_at?: string
        }
        Update: {
          artist_id?: string | null
          artist_name_text?: string | null
          artist_slug?: string | null
          confidence?: number
          created_at?: string
          credit_order?: number
          display_credit?: string | null
          id?: string
          is_featured?: boolean
          is_primary?: boolean
          metadata?: Json
          role?: string
          source?: string
          status?: string
          track_id?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      registry_track_genres: {
        Row: {
          classification_status: string
          confidence: number | null
          created_at: string
          created_by: string | null
          editorial_note: string | null
          genre_id: string | null
          id: string
          is_primary: boolean
          metadata: Json
          normalized_key: string
          provider: string | null
          raw_genre_name: string
          reviewed_at: string | null
          sort_order: number
          source: string
          source_context: string | null
          track_id: string
          updated_at: string
        }
        Insert: {
          classification_status?: string
          confidence?: number | null
          created_at?: string
          created_by?: string | null
          editorial_note?: string | null
          genre_id?: string | null
          id?: string
          is_primary?: boolean
          metadata?: Json
          normalized_key: string
          provider?: string | null
          raw_genre_name: string
          reviewed_at?: string | null
          sort_order?: number
          source?: string
          source_context?: string | null
          track_id: string
          updated_at?: string
        }
        Update: {
          classification_status?: string
          confidence?: number | null
          created_at?: string
          created_by?: string | null
          editorial_note?: string | null
          genre_id?: string | null
          id?: string
          is_primary?: boolean
          metadata?: Json
          normalized_key?: string
          provider?: string | null
          raw_genre_name?: string
          reviewed_at?: string | null
          sort_order?: number
          source?: string
          source_context?: string | null
          track_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "registry_track_genres_genre_id_fkey"
            columns: ["genre_id"]
            isOneToOne: false
            referencedRelation: "registry_genres"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "registry_track_genres_track_id_fkey"
            columns: ["track_id"]
            isOneToOne: false
            referencedRelation: "registry_tracks"
            referencedColumns: ["id"]
          },
        ]
      }
      registry_track_provider_links: {
        Row: {
          artwork_url: string | null
          created_at: string
          duration_ms: number | null
          id: string
          isrc: string | null
          last_checked_at: string
          match_confidence: number
          match_method: string
          match_status: string
          preview_url: string | null
          provider_artist_ids: string[]
          provider_key: string
          provider_release_id: string | null
          provider_track_id: string
          raw_payload: Json
          storefront: string | null
          track_id: string
          upc: string | null
          updated_at: string
        }
        Insert: {
          artwork_url?: string | null
          created_at?: string
          duration_ms?: number | null
          id?: string
          isrc?: string | null
          last_checked_at?: string
          match_confidence?: number
          match_method?: string
          match_status?: string
          preview_url?: string | null
          provider_artist_ids?: string[]
          provider_key: string
          provider_release_id?: string | null
          provider_track_id: string
          raw_payload?: Json
          storefront?: string | null
          track_id: string
          upc?: string | null
          updated_at?: string
        }
        Update: {
          artwork_url?: string | null
          created_at?: string
          duration_ms?: number | null
          id?: string
          isrc?: string | null
          last_checked_at?: string
          match_confidence?: number
          match_method?: string
          match_status?: string
          preview_url?: string | null
          provider_artist_ids?: string[]
          provider_key?: string
          provider_release_id?: string | null
          provider_track_id?: string
          raw_payload?: Json
          storefront?: string | null
          track_id?: string
          upc?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "registry_track_provider_links_track_id_fkey"
            columns: ["track_id"]
            isOneToOne: false
            referencedRelation: "registry_tracks"
            referencedColumns: ["id"]
          },
        ]
      }
      registry_track_resolution_events: {
        Row: {
          action: string
          canonical_track_id: string | null
          canonical_track_slug: string | null
          confidence_bucket: string | null
          created_at: string
          duplicate_track_ids: string[]
          duplicate_track_slugs: string[]
          id: string
          note: string | null
          preview: Json
          result: Json
          status: string
        }
        Insert: {
          action: string
          canonical_track_id?: string | null
          canonical_track_slug?: string | null
          confidence_bucket?: string | null
          created_at?: string
          duplicate_track_ids?: string[]
          duplicate_track_slugs?: string[]
          id?: string
          note?: string | null
          preview?: Json
          result?: Json
          status?: string
        }
        Update: {
          action?: string
          canonical_track_id?: string | null
          canonical_track_slug?: string | null
          confidence_bucket?: string | null
          created_at?: string
          duplicate_track_ids?: string[]
          duplicate_track_slugs?: string[]
          id?: string
          note?: string | null
          preview?: Json
          result?: Json
          status?: string
        }
        Relationships: []
      }
      registry_tracks: {
        Row: {
          artwork_image_id: string | null
          artwork_url: string | null
          created_at: string
          disc_number: number | null
          duration_ms: number | null
          explicit: boolean | null
          id: string
          isrc: string | null
          living_memory_editorial_label: string | null
          living_memory_editorial_opener: string | null
          living_memory_public_prompt: string | null
          living_memory_status: string
          living_memory_updated_at: string | null
          metadata: Json
          normalized_title: string
          preview_url: string | null
          release_id: string | null
          slug: string
          status: string
          title: string
          track_number: number | null
          updated_at: string
        }
        Insert: {
          artwork_image_id?: string | null
          artwork_url?: string | null
          created_at?: string
          disc_number?: number | null
          duration_ms?: number | null
          explicit?: boolean | null
          id?: string
          isrc?: string | null
          living_memory_editorial_label?: string | null
          living_memory_editorial_opener?: string | null
          living_memory_public_prompt?: string | null
          living_memory_status?: string
          living_memory_updated_at?: string | null
          metadata?: Json
          normalized_title: string
          preview_url?: string | null
          release_id?: string | null
          slug: string
          status?: string
          title: string
          track_number?: number | null
          updated_at?: string
        }
        Update: {
          artwork_image_id?: string | null
          artwork_url?: string | null
          created_at?: string
          disc_number?: number | null
          duration_ms?: number | null
          explicit?: boolean | null
          id?: string
          isrc?: string | null
          living_memory_editorial_label?: string | null
          living_memory_editorial_opener?: string | null
          living_memory_public_prompt?: string | null
          living_memory_status?: string
          living_memory_updated_at?: string | null
          metadata?: Json
          normalized_title?: string
          preview_url?: string | null
          release_id?: string | null
          slug?: string
          status?: string
          title?: string
          track_number?: number | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "registry_tracks_artwork_image_id_fkey"
            columns: ["artwork_image_id"]
            isOneToOne: false
            referencedRelation: "registry_media_assets"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "registry_tracks_release_id_fkey"
            columns: ["release_id"]
            isOneToOne: false
            referencedRelation: "registry_releases"
            referencedColumns: ["id"]
          },
        ]
      }
      relationship_evidence: {
        Row: {
          evidence_id: string
          note: string | null
          relationship_id: string
          support_type: string
        }
        Insert: {
          evidence_id: string
          note?: string | null
          relationship_id: string
          support_type?: string
        }
        Update: {
          evidence_id?: string
          note?: string | null
          relationship_id?: string
          support_type?: string
        }
        Relationships: [
          {
            foreignKeyName: "relationship_evidence_evidence_id_fkey"
            columns: ["evidence_id"]
            isOneToOne: false
            referencedRelation: "evidence_items"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "relationship_evidence_evidence_id_fkey"
            columns: ["evidence_id"]
            isOneToOne: false
            referencedRelation: "institute_admin_inquiry_evidence"
            referencedColumns: ["evidence_id"]
          },
          {
            foreignKeyName: "relationship_evidence_evidence_id_fkey"
            columns: ["evidence_id"]
            isOneToOne: false
            referencedRelation: "institute_retrieval_ready_evidence"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "relationship_evidence_evidence_id_fkey"
            columns: ["evidence_id"]
            isOneToOne: false
            referencedRelation: "institute_review_queue_evidence"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "relationship_evidence_relationship_id_fkey"
            columns: ["relationship_id"]
            isOneToOne: false
            referencedRelation: "entity_relationships"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "relationship_evidence_relationship_id_fkey"
            columns: ["relationship_id"]
            isOneToOne: false
            referencedRelation: "institute_admin_entity_relationships"
            referencedColumns: ["relationship_id"]
          },
        ]
      }
      retrieval_policies: {
        Row: {
          allow_disputed_evidence: boolean
          allow_unreviewed_evidence: boolean
          allowed_evidence_types: string[]
          created_at: string
          created_by: string | null
          display_name: string
          excluded_evidence_types: string[]
          id: string
          max_items: number
          notes: string | null
          policy_key: string
          purpose: string
          requires_reviewed_evidence: boolean
          status: string
          task_type: string
          updated_at: string
        }
        Insert: {
          allow_disputed_evidence?: boolean
          allow_unreviewed_evidence?: boolean
          allowed_evidence_types?: string[]
          created_at?: string
          created_by?: string | null
          display_name: string
          excluded_evidence_types?: string[]
          id?: string
          max_items?: number
          notes?: string | null
          policy_key: string
          purpose: string
          requires_reviewed_evidence?: boolean
          status?: string
          task_type: string
          updated_at?: string
        }
        Update: {
          allow_disputed_evidence?: boolean
          allow_unreviewed_evidence?: boolean
          allowed_evidence_types?: string[]
          created_at?: string
          created_by?: string | null
          display_name?: string
          excluded_evidence_types?: string[]
          id?: string
          max_items?: number
          notes?: string | null
          policy_key?: string
          purpose?: string
          requires_reviewed_evidence?: boolean
          status?: string
          task_type?: string
          updated_at?: string
        }
        Relationships: []
      }
      retrieval_policy_versions: {
        Row: {
          approved_at: string | null
          approved_by: string | null
          created_at: string
          created_by: string | null
          id: string
          policy_id: string
          policy_json: Json
          status: string
          updated_at: string
          version_name: string
        }
        Insert: {
          approved_at?: string | null
          approved_by?: string | null
          created_at?: string
          created_by?: string | null
          id?: string
          policy_id: string
          policy_json?: Json
          status?: string
          updated_at?: string
          version_name: string
        }
        Update: {
          approved_at?: string | null
          approved_by?: string | null
          created_at?: string
          created_by?: string | null
          id?: string
          policy_id?: string
          policy_json?: Json
          status?: string
          updated_at?: string
          version_name?: string
        }
        Relationships: [
          {
            foreignKeyName: "retrieval_policy_versions_policy_id_fkey"
            columns: ["policy_id"]
            isOneToOne: false
            referencedRelation: "retrieval_policies"
            referencedColumns: ["id"]
          },
        ]
      }
      retrieval_run_items: {
        Row: {
          created_at: string
          evidence_id: string | null
          excerpt: string | null
          exclusion_reason: string | null
          id: string
          included_in_context: boolean
          memory_embedding_id: string | null
          metadata: Json
          retrieval_rank: number | null
          retrieval_run_id: string
          retrieval_status_snapshot: string | null
          review_status_snapshot: string | null
          similarity_score: number | null
          source_id: string | null
          source_ref: string | null
          source_table: string | null
          source_title: string | null
          source_type: string
        }
        Insert: {
          created_at?: string
          evidence_id?: string | null
          excerpt?: string | null
          exclusion_reason?: string | null
          id?: string
          included_in_context?: boolean
          memory_embedding_id?: string | null
          metadata?: Json
          retrieval_rank?: number | null
          retrieval_run_id: string
          retrieval_status_snapshot?: string | null
          review_status_snapshot?: string | null
          similarity_score?: number | null
          source_id?: string | null
          source_ref?: string | null
          source_table?: string | null
          source_title?: string | null
          source_type: string
        }
        Update: {
          created_at?: string
          evidence_id?: string | null
          excerpt?: string | null
          exclusion_reason?: string | null
          id?: string
          included_in_context?: boolean
          memory_embedding_id?: string | null
          metadata?: Json
          retrieval_rank?: number | null
          retrieval_run_id?: string
          retrieval_status_snapshot?: string | null
          review_status_snapshot?: string | null
          similarity_score?: number | null
          source_id?: string | null
          source_ref?: string | null
          source_table?: string | null
          source_title?: string | null
          source_type?: string
        }
        Relationships: [
          {
            foreignKeyName: "retrieval_run_items_evidence_id_fkey"
            columns: ["evidence_id"]
            isOneToOne: false
            referencedRelation: "evidence_items"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "retrieval_run_items_evidence_id_fkey"
            columns: ["evidence_id"]
            isOneToOne: false
            referencedRelation: "institute_admin_inquiry_evidence"
            referencedColumns: ["evidence_id"]
          },
          {
            foreignKeyName: "retrieval_run_items_evidence_id_fkey"
            columns: ["evidence_id"]
            isOneToOne: false
            referencedRelation: "institute_retrieval_ready_evidence"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "retrieval_run_items_evidence_id_fkey"
            columns: ["evidence_id"]
            isOneToOne: false
            referencedRelation: "institute_review_queue_evidence"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "retrieval_run_items_memory_embedding_id_fkey"
            columns: ["memory_embedding_id"]
            isOneToOne: false
            referencedRelation: "memory_embeddings"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "retrieval_run_items_retrieval_run_id_fkey"
            columns: ["retrieval_run_id"]
            isOneToOne: false
            referencedRelation: "retrieval_runs"
            referencedColumns: ["id"]
          },
        ]
      }
      retrieval_runs: {
        Row: {
          completed_at: string | null
          created_at: string
          created_by: string | null
          entity_id: string | null
          error_message: string | null
          filters_json: Json
          id: string
          inquiry_id: string | null
          policy_id: string | null
          policy_version_id: string | null
          query_json: Json
          query_text: string | null
          run_type: string
          started_at: string | null
          status: string
          task_type: string
          top_k: number
        }
        Insert: {
          completed_at?: string | null
          created_at?: string
          created_by?: string | null
          entity_id?: string | null
          error_message?: string | null
          filters_json?: Json
          id?: string
          inquiry_id?: string | null
          policy_id?: string | null
          policy_version_id?: string | null
          query_json?: Json
          query_text?: string | null
          run_type: string
          started_at?: string | null
          status?: string
          task_type: string
          top_k?: number
        }
        Update: {
          completed_at?: string | null
          created_at?: string
          created_by?: string | null
          entity_id?: string | null
          error_message?: string | null
          filters_json?: Json
          id?: string
          inquiry_id?: string | null
          policy_id?: string | null
          policy_version_id?: string | null
          query_json?: Json
          query_text?: string | null
          run_type?: string
          started_at?: string | null
          status?: string
          task_type?: string
          top_k?: number
        }
        Relationships: [
          {
            foreignKeyName: "retrieval_runs_entity_id_fkey"
            columns: ["entity_id"]
            isOneToOne: false
            referencedRelation: "cultural_entities"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "retrieval_runs_inquiry_id_fkey"
            columns: ["inquiry_id"]
            isOneToOne: false
            referencedRelation: "inquiries"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "retrieval_runs_inquiry_id_fkey"
            columns: ["inquiry_id"]
            isOneToOne: false
            referencedRelation: "institute_admin_inquiry_evidence"
            referencedColumns: ["inquiry_id"]
          },
          {
            foreignKeyName: "retrieval_runs_policy_id_fkey"
            columns: ["policy_id"]
            isOneToOne: false
            referencedRelation: "retrieval_policies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "retrieval_runs_policy_version_id_fkey"
            columns: ["policy_version_id"]
            isOneToOne: false
            referencedRelation: "retrieval_policy_versions"
            referencedColumns: ["id"]
          },
        ]
      }
      review_decisions: {
        Row: {
          created_at: string
          decision: string
          id: string
          reason: string
          reviewer_id: string | null
          subject_id: string
          subject_type: string
        }
        Insert: {
          created_at?: string
          decision: string
          id?: string
          reason: string
          reviewer_id?: string | null
          subject_id: string
          subject_type: string
        }
        Update: {
          created_at?: string
          decision?: string
          id?: string
          reason?: string
          reviewer_id?: string | null
          subject_id?: string
          subject_type?: string
        }
        Relationships: []
      }
      role_capabilities: {
        Row: {
          capability_key: string
          created_at: string
          role_key: string
        }
        Insert: {
          capability_key: string
          created_at?: string
          role_key: string
        }
        Update: {
          capability_key?: string
          created_at?: string
          role_key?: string
        }
        Relationships: [
          {
            foreignKeyName: "role_capabilities_capability_key_fkey"
            columns: ["capability_key"]
            isOneToOne: false
            referencedRelation: "capability_definitions"
            referencedColumns: ["capability_key"]
          },
          {
            foreignKeyName: "role_capabilities_role_key_fkey"
            columns: ["role_key"]
            isOneToOne: false
            referencedRelation: "role_definitions"
            referencedColumns: ["role_key"]
          },
        ]
      }
      role_definitions: {
        Row: {
          created_at: string
          description: string | null
          is_system: boolean
          label: string
          priority: number
          role_key: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          description?: string | null
          is_system?: boolean
          label: string
          priority?: number
          role_key: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          description?: string | null
          is_system?: boolean
          label?: string
          priority?: number
          role_key?: string
          updated_at?: string
        }
        Relationships: []
      }
      seo_artist_trend_signals: {
        Row: {
          artist_name: string
          artist_slug: string
          artist_url: string
          average_position: number
          clicks: number
          created_at: string
          ctr: number
          id: string
          impressions: number
          payload: Json
          source_run_id: string | null
          status: string
          top_queries: string[]
          trend_score: number
          updated_at: string
          window_end: string
          window_start: string
        }
        Insert: {
          artist_name: string
          artist_slug: string
          artist_url: string
          average_position?: number
          clicks?: number
          created_at?: string
          ctr?: number
          id?: string
          impressions?: number
          payload?: Json
          source_run_id?: string | null
          status?: string
          top_queries?: string[]
          trend_score?: number
          updated_at?: string
          window_end: string
          window_start: string
        }
        Update: {
          artist_name?: string
          artist_slug?: string
          artist_url?: string
          average_position?: number
          clicks?: number
          created_at?: string
          ctr?: number
          id?: string
          impressions?: number
          payload?: Json
          source_run_id?: string | null
          status?: string
          top_queries?: string[]
          trend_score?: number
          updated_at?: string
          window_end?: string
          window_start?: string
        }
        Relationships: [
          {
            foreignKeyName: "seo_artist_trend_signals_source_run_id_fkey"
            columns: ["source_run_id"]
            isOneToOne: false
            referencedRelation: "seo_search_console_sync_runs"
            referencedColumns: ["id"]
          },
        ]
      }
      seo_content_overrides: {
        Row: {
          applied_at: string
          archived_at: string | null
          created_at: string
          created_by: string | null
          description: string | null
          id: string
          payload: Json
          social_description: string | null
          social_title: string | null
          source_draft_id: string | null
          status: string
          target_url: string
          task_id: string | null
          title: string | null
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          applied_at?: string
          archived_at?: string | null
          created_at?: string
          created_by?: string | null
          description?: string | null
          id?: string
          payload?: Json
          social_description?: string | null
          social_title?: string | null
          source_draft_id?: string | null
          status?: string
          target_url: string
          task_id?: string | null
          title?: string | null
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          applied_at?: string
          archived_at?: string | null
          created_at?: string
          created_by?: string | null
          description?: string | null
          id?: string
          payload?: Json
          social_description?: string | null
          social_title?: string | null
          source_draft_id?: string | null
          status?: string
          target_url?: string
          task_id?: string | null
          title?: string | null
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "seo_content_overrides_source_draft_id_fkey"
            columns: ["source_draft_id"]
            isOneToOne: false
            referencedRelation: "seo_growth_drafts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "seo_content_overrides_task_id_fkey"
            columns: ["task_id"]
            isOneToOne: false
            referencedRelation: "seo_growth_tasks"
            referencedColumns: ["id"]
          },
        ]
      }
      seo_draft_publish_events: {
        Row: {
          actor_id: string | null
          after_payload: Json
          before_payload: Json
          created_at: string
          draft_id: string | null
          event_type: string
          id: string
          override_id: string | null
          target_url: string
          task_id: string | null
        }
        Insert: {
          actor_id?: string | null
          after_payload?: Json
          before_payload?: Json
          created_at?: string
          draft_id?: string | null
          event_type: string
          id?: string
          override_id?: string | null
          target_url: string
          task_id?: string | null
        }
        Update: {
          actor_id?: string | null
          after_payload?: Json
          before_payload?: Json
          created_at?: string
          draft_id?: string | null
          event_type?: string
          id?: string
          override_id?: string | null
          target_url?: string
          task_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "seo_draft_publish_events_draft_id_fkey"
            columns: ["draft_id"]
            isOneToOne: false
            referencedRelation: "seo_growth_drafts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "seo_draft_publish_events_override_id_fkey"
            columns: ["override_id"]
            isOneToOne: false
            referencedRelation: "seo_content_overrides"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "seo_draft_publish_events_task_id_fkey"
            columns: ["task_id"]
            isOneToOne: false
            referencedRelation: "seo_growth_tasks"
            referencedColumns: ["id"]
          },
        ]
      }
      seo_growth_drafts: {
        Row: {
          action: string
          body: string
          content_kind: string
          created_at: string
          generated_by: string | null
          id: string
          payload: Json
          published_at: string | null
          published_by: string | null
          query: string | null
          status: string
          summary: string | null
          target_url: string
          task_id: string | null
          title: string
          updated_at: string
        }
        Insert: {
          action: string
          body: string
          content_kind: string
          created_at?: string
          generated_by?: string | null
          id?: string
          payload?: Json
          published_at?: string | null
          published_by?: string | null
          query?: string | null
          status?: string
          summary?: string | null
          target_url: string
          task_id?: string | null
          title: string
          updated_at?: string
        }
        Update: {
          action?: string
          body?: string
          content_kind?: string
          created_at?: string
          generated_by?: string | null
          id?: string
          payload?: Json
          published_at?: string | null
          published_by?: string | null
          query?: string | null
          status?: string
          summary?: string | null
          target_url?: string
          task_id?: string | null
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "seo_growth_drafts_task_id_fkey"
            columns: ["task_id"]
            isOneToOne: false
            referencedRelation: "seo_growth_tasks"
            referencedColumns: ["id"]
          },
        ]
      }
      seo_growth_tasks: {
        Row: {
          action: string
          completed_at: string | null
          created_at: string
          created_by: string | null
          id: string
          metrics: string | null
          priority: string
          query: string | null
          reason: string | null
          score: number
          source: string
          status: string
          target_url: string
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          action: string
          completed_at?: string | null
          created_at?: string
          created_by?: string | null
          id?: string
          metrics?: string | null
          priority?: string
          query?: string | null
          reason?: string | null
          score?: number
          source?: string
          status?: string
          target_url: string
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          action?: string
          completed_at?: string | null
          created_at?: string
          created_by?: string | null
          id?: string
          metrics?: string | null
          priority?: string
          query?: string | null
          reason?: string | null
          score?: number
          source?: string
          status?: string
          target_url?: string
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: []
      }
      seo_search_console_rows: {
        Row: {
          clicks: number
          country: string | null
          created_at: string
          ctr: number
          date: string | null
          device: string | null
          dimension_set: string
          end_date: string
          id: string
          impressions: number
          page_url: string | null
          position: number
          query: string | null
          raw_row: Json
          run_id: string
          site_url: string
          start_date: string
        }
        Insert: {
          clicks?: number
          country?: string | null
          created_at?: string
          ctr?: number
          date?: string | null
          device?: string | null
          dimension_set?: string
          end_date: string
          id?: string
          impressions?: number
          page_url?: string | null
          position?: number
          query?: string | null
          raw_row?: Json
          run_id: string
          site_url: string
          start_date: string
        }
        Update: {
          clicks?: number
          country?: string | null
          created_at?: string
          ctr?: number
          date?: string | null
          device?: string | null
          dimension_set?: string
          end_date?: string
          id?: string
          impressions?: number
          page_url?: string | null
          position?: number
          query?: string | null
          raw_row?: Json
          run_id?: string
          site_url?: string
          start_date?: string
        }
        Relationships: [
          {
            foreignKeyName: "seo_search_console_rows_run_id_fkey"
            columns: ["run_id"]
            isOneToOne: false
            referencedRelation: "seo_search_console_sync_runs"
            referencedColumns: ["id"]
          },
        ]
      }
      seo_search_console_sync_runs: {
        Row: {
          average_ctr: number
          average_position: number
          completed_at: string | null
          created_by: string | null
          dimensions: string[]
          end_date: string
          error_message: string | null
          id: string
          row_count: number
          site_url: string
          start_date: string
          started_at: string
          status: string
          total_clicks: number
          total_impressions: number
        }
        Insert: {
          average_ctr?: number
          average_position?: number
          completed_at?: string | null
          created_by?: string | null
          dimensions?: string[]
          end_date: string
          error_message?: string | null
          id?: string
          row_count?: number
          site_url: string
          start_date: string
          started_at?: string
          status?: string
          total_clicks?: number
          total_impressions?: number
        }
        Update: {
          average_ctr?: number
          average_position?: number
          completed_at?: string | null
          created_by?: string | null
          dimensions?: string[]
          end_date?: string
          error_message?: string | null
          id?: string
          row_count?: number
          site_url?: string
          start_date?: string
          started_at?: string
          status?: string
          total_clicks?: number
          total_impressions?: number
        }
        Relationships: []
      }
      seo_sitemap_snapshots: {
        Row: {
          base_url: string
          error_message: string | null
          generated_at: string
          generated_by: string | null
          id: string
          pro_sitemaps_result_json: Json
          pro_sitemaps_site_id: string | null
          published_at: string | null
          source: string
          status: string
          url_count: number
          xml_content: string
          xml_sha256: string | null
        }
        Insert: {
          base_url: string
          error_message?: string | null
          generated_at?: string
          generated_by?: string | null
          id?: string
          pro_sitemaps_result_json?: Json
          pro_sitemaps_site_id?: string | null
          published_at?: string | null
          source?: string
          status?: string
          url_count?: number
          xml_content: string
          xml_sha256?: string | null
        }
        Update: {
          base_url?: string
          error_message?: string | null
          generated_at?: string
          generated_by?: string | null
          id?: string
          pro_sitemaps_result_json?: Json
          pro_sitemaps_site_id?: string | null
          published_at?: string | null
          source?: string
          status?: string
          url_count?: number
          xml_content?: string
          xml_sha256?: string | null
        }
        Relationships: []
      }
      seo_sitemap_url_items: {
        Row: {
          created_at: string
          exclusion_reason: string | null
          id: string
          included: boolean
          lastmod: string | null
          loc: string
          priority_hint: number | null
          snapshot_id: string
          source_id: string | null
          source_table: string | null
          url_type: string
        }
        Insert: {
          created_at?: string
          exclusion_reason?: string | null
          id?: string
          included?: boolean
          lastmod?: string | null
          loc: string
          priority_hint?: number | null
          snapshot_id: string
          source_id?: string | null
          source_table?: string | null
          url_type: string
        }
        Update: {
          created_at?: string
          exclusion_reason?: string | null
          id?: string
          included?: boolean
          lastmod?: string | null
          loc?: string
          priority_hint?: number | null
          snapshot_id?: string
          source_id?: string | null
          source_table?: string | null
          url_type?: string
        }
        Relationships: [
          {
            foreignKeyName: "seo_sitemap_url_items_snapshot_id_fkey"
            columns: ["snapshot_id"]
            isOneToOne: false
            referencedRelation: "seo_sitemap_snapshots"
            referencedColumns: ["id"]
          },
        ]
      }
      share_counts: {
        Row: {
          count: number
          created_at: string
          id: number
          page_url: string
          platform: string
          updated_at: string
        }
        Insert: {
          count?: number
          created_at?: string
          id?: never
          page_url: string
          platform: string
          updated_at?: string
        }
        Update: {
          count?: number
          created_at?: string
          id?: never
          page_url?: string
          platform?: string
          updated_at?: string
        }
        Relationships: []
      }
      share_events: {
        Row: {
          article_slug: string | null
          article_title: string | null
          created_at: string
          id: number
          page_url: string
          platform: string
        }
        Insert: {
          article_slug?: string | null
          article_title?: string | null
          created_at?: string
          id?: number
          page_url: string
          platform: string
        }
        Update: {
          article_slug?: string | null
          article_title?: string | null
          created_at?: string
          id?: number
          page_url?: string
          platform?: string
        }
        Relationships: []
      }
      signal_os_content_opportunities: {
        Row: {
          created_at: string
          entity_slug: string | null
          entity_title: string | null
          entity_type: string | null
          evidence: Json
          id: string
          opportunity_date: string
          opportunity_score: number
          opportunity_type: string
          page_path: string | null
          query: string | null
          reason: string | null
          recommended_action: string | null
          status: string
          title: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          entity_slug?: string | null
          entity_title?: string | null
          entity_type?: string | null
          evidence?: Json
          id?: string
          opportunity_date: string
          opportunity_score?: number
          opportunity_type: string
          page_path?: string | null
          query?: string | null
          reason?: string | null
          recommended_action?: string | null
          status?: string
          title: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          entity_slug?: string | null
          entity_title?: string | null
          entity_type?: string | null
          evidence?: Json
          id?: string
          opportunity_date?: string
          opportunity_score?: number
          opportunity_type?: string
          page_path?: string | null
          query?: string | null
          reason?: string | null
          recommended_action?: string | null
          status?: string
          title?: string
          updated_at?: string
        }
        Relationships: []
      }
      signal_os_entity_daily_metrics: {
        Row: {
          entity_slug: string
          entity_title: string | null
          entity_type: string
          first_seen_at: string | null
          last_seen_at: string | null
          metric_date: string
          newsletter_events: number
          page_path: string | null
          page_views: number
          playback_events: number
          referrer_domains: number
          sample_context: Json
          scroll_events: number
          search_mentions: number
          share_click_events: number
          share_copy_events: number
          share_events: number
          unique_sessions: number
          updated_at: string
          video_events: number
        }
        Insert: {
          entity_slug: string
          entity_title?: string | null
          entity_type: string
          first_seen_at?: string | null
          last_seen_at?: string | null
          metric_date: string
          newsletter_events?: number
          page_path?: string | null
          page_views?: number
          playback_events?: number
          referrer_domains?: number
          sample_context?: Json
          scroll_events?: number
          search_mentions?: number
          share_click_events?: number
          share_copy_events?: number
          share_events?: number
          unique_sessions?: number
          updated_at?: string
          video_events?: number
        }
        Update: {
          entity_slug?: string
          entity_title?: string | null
          entity_type?: string
          first_seen_at?: string | null
          last_seen_at?: string | null
          metric_date?: string
          newsletter_events?: number
          page_path?: string | null
          page_views?: number
          playback_events?: number
          referrer_domains?: number
          sample_context?: Json
          scroll_events?: number
          search_mentions?: number
          share_click_events?: number
          share_copy_events?: number
          share_events?: number
          unique_sessions?: number
          updated_at?: string
          video_events?: number
        }
        Relationships: []
      }
      signal_os_entity_signal_scores: {
        Row: {
          entity_slug: string
          entity_title: string | null
          entity_type: string
          evidence: Json
          explanation: string | null
          newsletter_events: number
          page_path: string | null
          page_views: number
          playback_events: number
          recommended_action: string | null
          referrer_domains: number
          score_date: string
          search_mentions: number
          share_events: number
          signal_label: string
          signal_score: number
          unique_sessions: number
          updated_at: string
        }
        Insert: {
          entity_slug: string
          entity_title?: string | null
          entity_type: string
          evidence?: Json
          explanation?: string | null
          newsletter_events?: number
          page_path?: string | null
          page_views?: number
          playback_events?: number
          recommended_action?: string | null
          referrer_domains?: number
          score_date: string
          search_mentions?: number
          share_events?: number
          signal_label?: string
          signal_score?: number
          unique_sessions?: number
          updated_at?: string
        }
        Update: {
          entity_slug?: string
          entity_title?: string | null
          entity_type?: string
          evidence?: Json
          explanation?: string | null
          newsletter_events?: number
          page_path?: string | null
          page_views?: number
          playback_events?: number
          recommended_action?: string | null
          referrer_domains?: number
          score_date?: string
          search_mentions?: number
          share_events?: number
          signal_label?: string
          signal_score?: number
          unique_sessions?: number
          updated_at?: string
        }
        Relationships: []
      }
      signal_os_journey_edges_daily: {
        Row: {
          from_path: string | null
          from_slug: string
          from_title: string | null
          from_type: string
          metric_date: string
          sessions: number
          to_path: string | null
          to_slug: string
          to_title: string | null
          to_type: string
          transitions: number
          updated_at: string
        }
        Insert: {
          from_path?: string | null
          from_slug: string
          from_title?: string | null
          from_type: string
          metric_date: string
          sessions?: number
          to_path?: string | null
          to_slug: string
          to_title?: string | null
          to_type: string
          transitions?: number
          updated_at?: string
        }
        Update: {
          from_path?: string | null
          from_slug?: string
          from_title?: string | null
          from_type?: string
          metric_date?: string
          sessions?: number
          to_path?: string | null
          to_slug?: string
          to_title?: string | null
          to_type?: string
          transitions?: number
          updated_at?: string
        }
        Relationships: []
      }
      signal_os_search_demand_gaps: {
        Row: {
          matched_entity_slug: string | null
          matched_entity_type: string | null
          metric_date: string
          opportunity_score: number
          query: string
          recommended_action: string | null
          sample_context: Json
          searches: number
          unique_sessions: number
          updated_at: string
          zero_result_events: number
        }
        Insert: {
          matched_entity_slug?: string | null
          matched_entity_type?: string | null
          metric_date: string
          opportunity_score?: number
          query: string
          recommended_action?: string | null
          sample_context?: Json
          searches?: number
          unique_sessions?: number
          updated_at?: string
          zero_result_events?: number
        }
        Update: {
          matched_entity_slug?: string | null
          matched_entity_type?: string | null
          metric_date?: string
          opportunity_score?: number
          query?: string
          recommended_action?: string | null
          sample_context?: Json
          searches?: number
          unique_sessions?: number
          updated_at?: string
          zero_result_events?: number
        }
        Relationships: []
      }
      surface_drafts: {
        Row: {
          ai_run_id: string | null
          created_at: string
          created_by: string | null
          draft_body: string
          draft_title: string | null
          entity_id: string | null
          id: string
          inquiry_id: string | null
          public_safe: boolean
          review_status: string
          reviewed_at: string | null
          reviewed_by: string | null
          surface_type: string
          updated_at: string
        }
        Insert: {
          ai_run_id?: string | null
          created_at?: string
          created_by?: string | null
          draft_body: string
          draft_title?: string | null
          entity_id?: string | null
          id?: string
          inquiry_id?: string | null
          public_safe?: boolean
          review_status?: string
          reviewed_at?: string | null
          reviewed_by?: string | null
          surface_type: string
          updated_at?: string
        }
        Update: {
          ai_run_id?: string | null
          created_at?: string
          created_by?: string | null
          draft_body?: string
          draft_title?: string | null
          entity_id?: string | null
          id?: string
          inquiry_id?: string | null
          public_safe?: boolean
          review_status?: string
          reviewed_at?: string | null
          reviewed_by?: string | null
          surface_type?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "surface_drafts_ai_run_fk"
            columns: ["ai_run_id"]
            isOneToOne: false
            referencedRelation: "ai_runs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "surface_drafts_entity_id_fkey"
            columns: ["entity_id"]
            isOneToOne: false
            referencedRelation: "cultural_entities"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "surface_drafts_inquiry_id_fkey"
            columns: ["inquiry_id"]
            isOneToOne: false
            referencedRelation: "inquiries"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "surface_drafts_inquiry_id_fkey"
            columns: ["inquiry_id"]
            isOneToOne: false
            referencedRelation: "institute_admin_inquiry_evidence"
            referencedColumns: ["inquiry_id"]
          },
        ]
      }
      user_access_scopes: {
        Row: {
          assigned_at: string
          assigned_by: string | null
          can_edit: boolean
          can_publish: boolean
          can_view: boolean
          created_at: string
          id: string
          role_key: string | null
          scope_type: string
          scope_value: string
          status: string
          updated_at: string
          user_id: string
        }
        Insert: {
          assigned_at?: string
          assigned_by?: string | null
          can_edit?: boolean
          can_publish?: boolean
          can_view?: boolean
          created_at?: string
          id?: string
          role_key?: string | null
          scope_type: string
          scope_value: string
          status?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          assigned_at?: string
          assigned_by?: string | null
          can_edit?: boolean
          can_publish?: boolean
          can_view?: boolean
          created_at?: string
          id?: string
          role_key?: string | null
          scope_type?: string
          scope_value?: string
          status?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_access_scopes_role_key_fkey"
            columns: ["role_key"]
            isOneToOne: false
            referencedRelation: "role_definitions"
            referencedColumns: ["role_key"]
          },
        ]
      }
      user_profile_username_history: {
        Row: {
          change_reason: string
          changed_by: string | null
          created_at: string
          id: string
          new_username: string
          new_username_normalized: string
          old_username: string | null
          old_username_normalized: string | null
          user_id: string
        }
        Insert: {
          change_reason?: string
          changed_by?: string | null
          created_at?: string
          id?: string
          new_username: string
          new_username_normalized: string
          old_username?: string | null
          old_username_normalized?: string | null
          user_id: string
        }
        Update: {
          change_reason?: string
          changed_by?: string | null
          created_at?: string
          id?: string
          new_username?: string
          new_username_normalized?: string
          old_username?: string | null
          old_username_normalized?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_profile_username_history_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "user_profiles"
            referencedColumns: ["user_id"]
          },
        ]
      }
      user_profiles: {
        Row: {
          avatar_url: string | null
          bio: string | null
          city: string | null
          country: string | null
          cover_url: string | null
          created_at: string
          display_name: string | null
          email: string | null
          is_public: boolean
          metadata: Json
          status: string
          updated_at: string
          user_id: string
          username: string | null
          username_change_count: number
          username_normalized: string | null
          username_updated_at: string | null
        }
        Insert: {
          avatar_url?: string | null
          bio?: string | null
          city?: string | null
          country?: string | null
          cover_url?: string | null
          created_at?: string
          display_name?: string | null
          email?: string | null
          is_public?: boolean
          metadata?: Json
          status?: string
          updated_at?: string
          user_id: string
          username?: string | null
          username_change_count?: number
          username_normalized?: string | null
          username_updated_at?: string | null
        }
        Update: {
          avatar_url?: string | null
          bio?: string | null
          city?: string | null
          country?: string | null
          cover_url?: string | null
          created_at?: string
          display_name?: string | null
          email?: string | null
          is_public?: boolean
          metadata?: Json
          status?: string
          updated_at?: string
          user_id?: string
          username?: string | null
          username_change_count?: number
          username_normalized?: string | null
          username_updated_at?: string | null
        }
        Relationships: []
      }
      user_role_assignments: {
        Row: {
          assigned_at: string
          assigned_by: string | null
          created_at: string
          expires_at: string | null
          id: string
          notes: string | null
          role_key: string
          status: string
          updated_at: string
          user_id: string
        }
        Insert: {
          assigned_at?: string
          assigned_by?: string | null
          created_at?: string
          expires_at?: string | null
          id?: string
          notes?: string | null
          role_key: string
          status?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          assigned_at?: string
          assigned_by?: string | null
          created_at?: string
          expires_at?: string | null
          id?: string
          notes?: string | null
          role_key?: string
          status?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_role_assignments_role_key_fkey"
            columns: ["role_key"]
            isOneToOne: false
            referencedRelation: "role_definitions"
            referencedColumns: ["role_key"]
          },
        ]
      }
      wk_article_preview_links: {
        Row: {
          article_id: string
          created_at: string
          created_by: string | null
          expires_at: string
          id: string
          nonce: string
          revoked_at: string | null
          version_id: string
        }
        Insert: {
          article_id: string
          created_at?: string
          created_by?: string | null
          expires_at: string
          id?: string
          nonce?: string
          revoked_at?: string | null
          version_id: string
        }
        Update: {
          article_id?: string
          created_at?: string
          created_by?: string | null
          expires_at?: string
          id?: string
          nonce?: string
          revoked_at?: string | null
          version_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "wk_article_preview_links_article_id_fkey"
            columns: ["article_id"]
            isOneToOne: false
            referencedRelation: "wk_articles"
            referencedColumns: ["id"]
          },
        ]
      }
      wk_article_publication_snapshots: {
        Row: {
          article_id: string
          author: string | null
          categories: Json
          content_html: string | null
          created_at: string
          excerpt: string | null
          first_published_at: string | null
          hero_image_id: string | null
          hero_image_url: string | null
          id: string
          is_active: boolean
          last_materially_updated_at: string | null
          modified_at: string | null
          published_at: string | null
          published_by: string | null
          raw_meta: Json
          resource_id: string
          seo: Json
          slug: string
          tags: Json
          title: string | null
          updated_at: string
          version_id: string
          wp_status: string
        }
        Insert: {
          article_id: string
          author?: string | null
          categories?: Json
          content_html?: string | null
          created_at?: string
          excerpt?: string | null
          first_published_at?: string | null
          hero_image_id?: string | null
          hero_image_url?: string | null
          id?: string
          is_active?: boolean
          last_materially_updated_at?: string | null
          modified_at?: string | null
          published_at?: string | null
          published_by?: string | null
          raw_meta?: Json
          resource_id: string
          seo?: Json
          slug: string
          tags?: Json
          title?: string | null
          updated_at?: string
          version_id: string
          wp_status?: string
        }
        Update: {
          article_id?: string
          author?: string | null
          categories?: Json
          content_html?: string | null
          created_at?: string
          excerpt?: string | null
          first_published_at?: string | null
          hero_image_id?: string | null
          hero_image_url?: string | null
          id?: string
          is_active?: boolean
          last_materially_updated_at?: string | null
          modified_at?: string | null
          published_at?: string | null
          published_by?: string | null
          raw_meta?: Json
          resource_id?: string
          seo?: Json
          slug?: string
          tags?: Json
          title?: string | null
          updated_at?: string
          version_id?: string
          wp_status?: string
        }
        Relationships: [
          {
            foreignKeyName: "wk_article_publication_snapshots_article_id_fkey"
            columns: ["article_id"]
            isOneToOne: false
            referencedRelation: "wk_articles"
            referencedColumns: ["id"]
          },
        ]
      }
      wk_article_revisions: {
        Row: {
          article_id: string
          author: string | null
          categories: Json | null
          content_html: string | null
          created_at: string | null
          created_by: string | null
          excerpt: string | null
          id: string
          published_at: string | null
          revision_number: number
          seo: Json | null
          tags: Json | null
          title: string | null
          wp_status: string | null
        }
        Insert: {
          article_id: string
          author?: string | null
          categories?: Json | null
          content_html?: string | null
          created_at?: string | null
          created_by?: string | null
          excerpt?: string | null
          id?: string
          published_at?: string | null
          revision_number: number
          seo?: Json | null
          tags?: Json | null
          title?: string | null
          wp_status?: string | null
        }
        Update: {
          article_id?: string
          author?: string | null
          categories?: Json | null
          content_html?: string | null
          created_at?: string | null
          created_by?: string | null
          excerpt?: string | null
          id?: string
          published_at?: string | null
          revision_number?: number
          seo?: Json | null
          tags?: Json | null
          title?: string | null
          wp_status?: string | null
        }
        Relationships: []
      }
      wk_articles: {
        Row: {
          author: string | null
          categories: Json
          content_html: string | null
          created_at: string
          draft_version: number
          excerpt: string | null
          hero_image_id: string | null
          hero_image_url: string | null
          id: string
          modified_at: string | null
          preview_nonce: string | null
          preview_nonce_expires_at: string | null
          published_at: string | null
          raw_meta: Json
          seo: Json
          slug: string
          source_wp_post_id: number | null
          tags: Json
          title: string | null
          updated_at: string
          wp_status: string | null
        }
        Insert: {
          author?: string | null
          categories?: Json
          content_html?: string | null
          created_at?: string
          draft_version?: number
          excerpt?: string | null
          hero_image_id?: string | null
          hero_image_url?: string | null
          id?: string
          modified_at?: string | null
          preview_nonce?: string | null
          preview_nonce_expires_at?: string | null
          published_at?: string | null
          raw_meta?: Json
          seo?: Json
          slug: string
          source_wp_post_id?: number | null
          tags?: Json
          title?: string | null
          updated_at?: string
          wp_status?: string | null
        }
        Update: {
          author?: string | null
          categories?: Json
          content_html?: string | null
          created_at?: string
          draft_version?: number
          excerpt?: string | null
          hero_image_id?: string | null
          hero_image_url?: string | null
          id?: string
          modified_at?: string | null
          preview_nonce?: string | null
          preview_nonce_expires_at?: string | null
          published_at?: string | null
          raw_meta?: Json
          seo?: Json
          slug?: string
          source_wp_post_id?: number | null
          tags?: Json
          title?: string | null
          updated_at?: string
          wp_status?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "wk_articles_hero_image_id_fkey"
            columns: ["hero_image_id"]
            isOneToOne: false
            referencedRelation: "registry_media_assets"
            referencedColumns: ["id"]
          },
        ]
      }
      wk_chart_airplay_evidence: {
        Row: {
          canonical_track_id: string
          created_at: string
          detection_count: number
          id: string
          normalized_key: string | null
          station_id: string
          station_weight: number
          total_played_duration: number
          updated_at: string
          week_start: string
          weighted_score: number
        }
        Insert: {
          canonical_track_id: string
          created_at?: string
          detection_count?: number
          id?: string
          normalized_key?: string | null
          station_id: string
          station_weight?: number
          total_played_duration?: number
          updated_at?: string
          week_start: string
          weighted_score?: number
        }
        Update: {
          canonical_track_id?: string
          created_at?: string
          detection_count?: number
          id?: string
          normalized_key?: string | null
          station_id?: string
          station_weight?: number
          total_played_duration?: number
          updated_at?: string
          week_start?: string
          weighted_score?: number
        }
        Relationships: [
          {
            foreignKeyName: "wk_chart_airplay_evidence_station_id_fkey"
            columns: ["station_id"]
            isOneToOne: false
            referencedRelation: "wk_chart_airplay_stations"
            referencedColumns: ["id"]
          },
        ]
      }
      wk_chart_airplay_stations: {
        Row: {
          country_code: string | null
          created_at: string
          id: string
          is_active: boolean
          notes: string | null
          station_name: string
          station_slug: string
          station_weight: number
          updated_at: string
        }
        Insert: {
          country_code?: string | null
          created_at?: string
          id: string
          is_active?: boolean
          notes?: string | null
          station_name: string
          station_slug: string
          station_weight?: number
          updated_at?: string
        }
        Update: {
          country_code?: string | null
          created_at?: string
          id?: string
          is_active?: boolean
          notes?: string | null
          station_name?: string
          station_slug?: string
          station_weight?: number
          updated_at?: string
        }
        Relationships: []
      }
      wk_chart_editions_v2: {
        Row: {
          carry_forward_count: number
          chart_size: number | null
          created_at: string
          edition_date: string | null
          edition_label: string | null
          edition_slug: string | null
          eligibility_policy_version: string | null
          entry_count: number | null
          exclusion_summary: Json
          id: string | null
          ingest_run_id: string | null
          methodology_version: string | null
          new_entries_count: number
          override_mode: string | null
          period_end: string | null
          period_start: string | null
          program_id: string | null
          published_at: string | null
          published_by: string | null
          re_entries_count: number
          rule_set_snapshot: Json
          scoring_policy_version: string | null
          source_policy_version: string | null
          status: string
          updated_at: string
        }
        Insert: {
          carry_forward_count?: number
          chart_size?: number | null
          created_at?: string
          edition_date?: string | null
          edition_label?: string | null
          edition_slug?: string | null
          eligibility_policy_version?: string | null
          entry_count?: number | null
          exclusion_summary?: Json
          id?: string | null
          ingest_run_id?: string | null
          methodology_version?: string | null
          new_entries_count?: number
          override_mode?: string | null
          period_end?: string | null
          period_start?: string | null
          program_id?: string | null
          published_at?: string | null
          published_by?: string | null
          re_entries_count?: number
          rule_set_snapshot?: Json
          scoring_policy_version?: string | null
          source_policy_version?: string | null
          status?: string
          updated_at?: string
        }
        Update: {
          carry_forward_count?: number
          chart_size?: number | null
          created_at?: string
          edition_date?: string | null
          edition_label?: string | null
          edition_slug?: string | null
          eligibility_policy_version?: string | null
          entry_count?: number | null
          exclusion_summary?: Json
          id?: string | null
          ingest_run_id?: string | null
          methodology_version?: string | null
          new_entries_count?: number
          override_mode?: string | null
          period_end?: string | null
          period_start?: string | null
          program_id?: string | null
          published_at?: string | null
          published_by?: string | null
          re_entries_count?: number
          rule_set_snapshot?: Json
          scoring_policy_version?: string | null
          source_policy_version?: string | null
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "wk_chart_editions_v2_program_id_fkey"
            columns: ["program_id"]
            isOneToOne: false
            referencedRelation: "wk_chart_programs_v2"
            referencedColumns: ["id"]
          },
        ]
      }
      wk_chart_eligibility_rules_v2: {
        Row: {
          created_at: string
          description: string | null
          effective_from: string | null
          eligibility_version: string | null
          label: string | null
          rule_set: Json
        }
        Insert: {
          created_at?: string
          description?: string | null
          effective_from?: string | null
          eligibility_version?: string | null
          label?: string | null
          rule_set?: Json
        }
        Update: {
          created_at?: string
          description?: string | null
          effective_from?: string | null
          eligibility_version?: string | null
          label?: string | null
          rule_set?: Json
        }
        Relationships: []
      }
      wk_chart_entries_v2: {
        Row: {
          airplay_candidate_only: boolean
          airplay_detections: number | null
          airplay_last_detected_at: string | null
          airplay_matched_by: string | null
          airplay_rescue_mode: string | null
          airplay_score: number
          airplay_station_count: number | null
          airplay_total_duration: number | null
          airplay_weighted_score: number | null
          anti_gaming_penalty: number
          artist_name: string | null
          artist_slug: string | null
          artwork_image_id: string | null
          artwork_url: string | null
          canonical_artist_id: string | null
          canonical_release_id: string | null
          canonical_track_id: string | null
          carry_forward_bonus: number
          carry_forward_only: boolean
          continuity_locked: boolean
          continuity_score: number
          created_at: string
          cross_source_bonus: number
          edition_id: string | null
          eligibility_policy_version: string | null
          eligibility_status: string | null
          eligibility_warnings: Json
          id: string | null
          lead_artist_key: string | null
          lead_artist_overflow: boolean
          methodology_version: string | null
          movement: string | null
          normalized_key: string | null
          occurrence_count: number
          overlap_bonus: number
          overlap_bonus_capped: boolean
          previous_rank: number | null
          rank: number | null
          recency_score: number
          release_date: string | null
          release_recency_days: number | null
          scoring_policy_version: string | null
          source_count: number
          source_payload: Json
          source_score: number
          source_urls_seen: Json
          stale_carry_forward_demoted: boolean
          total_score: number
          track_slug: string | null
          track_title: string | null
          updated_at: string
        }
        Insert: {
          airplay_candidate_only?: boolean
          airplay_detections?: number | null
          airplay_last_detected_at?: string | null
          airplay_matched_by?: string | null
          airplay_rescue_mode?: string | null
          airplay_score?: number
          airplay_station_count?: number | null
          airplay_total_duration?: number | null
          airplay_weighted_score?: number | null
          anti_gaming_penalty?: number
          artist_name?: string | null
          artist_slug?: string | null
          artwork_image_id?: string | null
          artwork_url?: string | null
          canonical_artist_id?: string | null
          canonical_release_id?: string | null
          canonical_track_id?: string | null
          carry_forward_bonus?: number
          carry_forward_only?: boolean
          continuity_locked?: boolean
          continuity_score?: number
          created_at?: string
          cross_source_bonus?: number
          edition_id?: string | null
          eligibility_policy_version?: string | null
          eligibility_status?: string | null
          eligibility_warnings?: Json
          id?: string | null
          lead_artist_key?: string | null
          lead_artist_overflow?: boolean
          methodology_version?: string | null
          movement?: string | null
          normalized_key?: string | null
          occurrence_count?: number
          overlap_bonus?: number
          overlap_bonus_capped?: boolean
          previous_rank?: number | null
          rank?: number | null
          recency_score?: number
          release_date?: string | null
          release_recency_days?: number | null
          scoring_policy_version?: string | null
          source_count?: number
          source_payload?: Json
          source_score?: number
          source_urls_seen?: Json
          stale_carry_forward_demoted?: boolean
          total_score?: number
          track_slug?: string | null
          track_title?: string | null
          updated_at?: string
        }
        Update: {
          airplay_candidate_only?: boolean
          airplay_detections?: number | null
          airplay_last_detected_at?: string | null
          airplay_matched_by?: string | null
          airplay_rescue_mode?: string | null
          airplay_score?: number
          airplay_station_count?: number | null
          airplay_total_duration?: number | null
          airplay_weighted_score?: number | null
          anti_gaming_penalty?: number
          artist_name?: string | null
          artist_slug?: string | null
          artwork_image_id?: string | null
          artwork_url?: string | null
          canonical_artist_id?: string | null
          canonical_release_id?: string | null
          canonical_track_id?: string | null
          carry_forward_bonus?: number
          carry_forward_only?: boolean
          continuity_locked?: boolean
          continuity_score?: number
          created_at?: string
          cross_source_bonus?: number
          edition_id?: string | null
          eligibility_policy_version?: string | null
          eligibility_status?: string | null
          eligibility_warnings?: Json
          id?: string | null
          lead_artist_key?: string | null
          lead_artist_overflow?: boolean
          methodology_version?: string | null
          movement?: string | null
          normalized_key?: string | null
          occurrence_count?: number
          overlap_bonus?: number
          overlap_bonus_capped?: boolean
          previous_rank?: number | null
          rank?: number | null
          recency_score?: number
          release_date?: string | null
          release_recency_days?: number | null
          scoring_policy_version?: string | null
          source_count?: number
          source_payload?: Json
          source_score?: number
          source_urls_seen?: Json
          stale_carry_forward_demoted?: boolean
          total_score?: number
          track_slug?: string | null
          track_title?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "wk_chart_entries_v2_artwork_image_id_fkey"
            columns: ["artwork_image_id"]
            isOneToOne: false
            referencedRelation: "registry_media_assets"
            referencedColumns: ["id"]
          },
        ]
      }
      wk_chart_markets_v2: {
        Row: {
          country_code: string | null
          default_language: string | null
          market_label: string | null
          market_slug: string | null
          market_type: string | null
          timezone: string | null
        }
        Insert: {
          country_code?: string | null
          default_language?: string | null
          market_label?: string | null
          market_slug?: string | null
          market_type?: string | null
          timezone?: string | null
        }
        Update: {
          country_code?: string | null
          default_language?: string | null
          market_label?: string | null
          market_slug?: string | null
          market_type?: string | null
          timezone?: string | null
        }
        Relationships: []
      }
      wk_chart_methodologies_v2: {
        Row: {
          changelog: string | null
          created_at: string
          effective_from: string | null
          label: string | null
          methodology_version: string | null
          rule_set: Json
          scoring_policy_version: string | null
        }
        Insert: {
          changelog?: string | null
          created_at?: string
          effective_from?: string | null
          label?: string | null
          methodology_version?: string | null
          rule_set?: Json
          scoring_policy_version?: string | null
        }
        Update: {
          changelog?: string | null
          created_at?: string
          effective_from?: string | null
          label?: string | null
          methodology_version?: string | null
          rule_set?: Json
          scoring_policy_version?: string | null
        }
        Relationships: []
      }
      wk_chart_playback_enrichment_items: {
        Row: {
          artist_name: string | null
          artwork_url: string | null
          auto_accept: boolean
          chart_entry_id: string | null
          confidence: number | null
          created_at: string
          error_message: string | null
          id: string
          isrc: string | null
          match_method: string | null
          metadata: Json
          preview_url: string | null
          provider: string
          provider_track_id: string | null
          provider_url: string | null
          rank: number | null
          raw_match_payload: Json
          registry_track_id: string | null
          run_id: string
          status: string
          storefront: string
          track_title: string
          updated_at: string
        }
        Insert: {
          artist_name?: string | null
          artwork_url?: string | null
          auto_accept?: boolean
          chart_entry_id?: string | null
          confidence?: number | null
          created_at?: string
          error_message?: string | null
          id?: string
          isrc?: string | null
          match_method?: string | null
          metadata?: Json
          preview_url?: string | null
          provider?: string
          provider_track_id?: string | null
          provider_url?: string | null
          rank?: number | null
          raw_match_payload?: Json
          registry_track_id?: string | null
          run_id: string
          status?: string
          storefront?: string
          track_title: string
          updated_at?: string
        }
        Update: {
          artist_name?: string | null
          artwork_url?: string | null
          auto_accept?: boolean
          chart_entry_id?: string | null
          confidence?: number | null
          created_at?: string
          error_message?: string | null
          id?: string
          isrc?: string | null
          match_method?: string | null
          metadata?: Json
          preview_url?: string | null
          provider?: string
          provider_track_id?: string | null
          provider_url?: string | null
          rank?: number | null
          raw_match_payload?: Json
          registry_track_id?: string | null
          run_id?: string
          status?: string
          storefront?: string
          track_title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "wk_chart_playback_enrichment_items_run_id_fkey"
            columns: ["run_id"]
            isOneToOne: false
            referencedRelation: "wk_chart_playback_enrichment_runs"
            referencedColumns: ["id"]
          },
        ]
      }
      wk_chart_playback_enrichment_runs: {
        Row: {
          accepted_count: number
          chart_edition_id: string | null
          chart_program_id: string | null
          created_at: string
          error_message: string | null
          failed_count: number
          finished_at: string | null
          full_coverage_count: number
          id: string
          matched_count: number
          metadata: Json
          min_auto_accept: number
          needs_review_count: number
          processed_count: number
          provider: string
          requested_by: string | null
          source_run_id: string | null
          started_at: string | null
          status: string
          storefront: string
          top_ten_coverage_count: number
          total_candidates: number
          updated_at: string
          write_mode: boolean
        }
        Insert: {
          accepted_count?: number
          chart_edition_id?: string | null
          chart_program_id?: string | null
          created_at?: string
          error_message?: string | null
          failed_count?: number
          finished_at?: string | null
          full_coverage_count?: number
          id?: string
          matched_count?: number
          metadata?: Json
          min_auto_accept?: number
          needs_review_count?: number
          processed_count?: number
          provider?: string
          requested_by?: string | null
          source_run_id?: string | null
          started_at?: string | null
          status?: string
          storefront?: string
          top_ten_coverage_count?: number
          total_candidates?: number
          updated_at?: string
          write_mode?: boolean
        }
        Update: {
          accepted_count?: number
          chart_edition_id?: string | null
          chart_program_id?: string | null
          created_at?: string
          error_message?: string | null
          failed_count?: number
          finished_at?: string | null
          full_coverage_count?: number
          id?: string
          matched_count?: number
          metadata?: Json
          min_auto_accept?: number
          needs_review_count?: number
          processed_count?: number
          provider?: string
          requested_by?: string | null
          source_run_id?: string | null
          started_at?: string | null
          status?: string
          storefront?: string
          top_ten_coverage_count?: number
          total_candidates?: number
          updated_at?: string
          write_mode?: boolean
        }
        Relationships: []
      }
      wk_chart_programs_v2: {
        Row: {
          airplay_enabled: boolean
          airplay_max_score: number
          airplay_min_detections: number
          airplay_min_duration: number
          airplay_min_stations: number
          airplay_rescue_mode: string
          airplay_station_scope: string
          airplay_weight: number
          anti_gaming_artist_overflow_penalty: number
          anti_gaming_demote_carry_forward_without_current: boolean
          anti_gaming_max_tracks_per_lead_artist: number
          anti_gaming_overlap_bonus_cap: number
          carry_forward_weight: number
          chart_size: number
          continuity_weight: number
          created_at: string
          cross_source_mode: string
          cross_source_weight: number
          default_eligibility_rules_version: string | null
          default_methodology_version: string | null
          default_period_type: string | null
          id: string | null
          market_slug: string | null
          missing_policy: string
          override_mode: string
          public_label: string | null
          public_slug: string | null
          series_slug: string | null
          short_label: string | null
          source_family_slug: string | null
          streaming_min_sources: number
          updated_at: string
        }
        Insert: {
          airplay_enabled?: boolean
          airplay_max_score?: number
          airplay_min_detections?: number
          airplay_min_duration?: number
          airplay_min_stations?: number
          airplay_rescue_mode?: string
          airplay_station_scope?: string
          airplay_weight?: number
          anti_gaming_artist_overflow_penalty?: number
          anti_gaming_demote_carry_forward_without_current?: boolean
          anti_gaming_max_tracks_per_lead_artist?: number
          anti_gaming_overlap_bonus_cap?: number
          carry_forward_weight?: number
          chart_size?: number
          continuity_weight?: number
          created_at?: string
          cross_source_mode?: string
          cross_source_weight?: number
          default_eligibility_rules_version?: string | null
          default_methodology_version?: string | null
          default_period_type?: string | null
          id?: string | null
          market_slug?: string | null
          missing_policy?: string
          override_mode?: string
          public_label?: string | null
          public_slug?: string | null
          series_slug?: string | null
          short_label?: string | null
          source_family_slug?: string | null
          streaming_min_sources?: number
          updated_at?: string
        }
        Update: {
          airplay_enabled?: boolean
          airplay_max_score?: number
          airplay_min_detections?: number
          airplay_min_duration?: number
          airplay_min_stations?: number
          airplay_rescue_mode?: string
          airplay_station_scope?: string
          airplay_weight?: number
          anti_gaming_artist_overflow_penalty?: number
          anti_gaming_demote_carry_forward_without_current?: boolean
          anti_gaming_max_tracks_per_lead_artist?: number
          anti_gaming_overlap_bonus_cap?: number
          carry_forward_weight?: number
          chart_size?: number
          continuity_weight?: number
          created_at?: string
          cross_source_mode?: string
          cross_source_weight?: number
          default_eligibility_rules_version?: string | null
          default_methodology_version?: string | null
          default_period_type?: string | null
          id?: string | null
          market_slug?: string | null
          missing_policy?: string
          override_mode?: string
          public_label?: string | null
          public_slug?: string | null
          series_slug?: string | null
          short_label?: string | null
          source_family_slug?: string | null
          streaming_min_sources?: number
          updated_at?: string
        }
        Relationships: []
      }
      wk_chart_scoring_runs: {
        Row: {
          airplay_rescue_rows: number
          carry_forward_rows: number
          completed_at: string | null
          created_at: string
          created_by: string | null
          edition_date: string
          eligibility_policy_version: string | null
          eligible_rows: number
          error_message: string | null
          excluded_rows: number
          exclusion_summary: Json
          id: string
          methodology_version: string | null
          program_id: string
          rule_set_snapshot: Json
          run_notes: string | null
          scoring_policy_version: string
          source_policy_version: string | null
          source_urls: Json
          started_at: string | null
          status: string
          total_rows: number
          updated_at: string
        }
        Insert: {
          airplay_rescue_rows?: number
          carry_forward_rows?: number
          completed_at?: string | null
          created_at?: string
          created_by?: string | null
          edition_date: string
          eligibility_policy_version?: string | null
          eligible_rows?: number
          error_message?: string | null
          excluded_rows?: number
          exclusion_summary?: Json
          id?: string
          methodology_version?: string | null
          program_id: string
          rule_set_snapshot?: Json
          run_notes?: string | null
          scoring_policy_version?: string
          source_policy_version?: string | null
          source_urls?: Json
          started_at?: string | null
          status?: string
          total_rows?: number
          updated_at?: string
        }
        Update: {
          airplay_rescue_rows?: number
          carry_forward_rows?: number
          completed_at?: string | null
          created_at?: string
          created_by?: string | null
          edition_date?: string
          eligibility_policy_version?: string | null
          eligible_rows?: number
          error_message?: string | null
          excluded_rows?: number
          exclusion_summary?: Json
          id?: string
          methodology_version?: string | null
          program_id?: string
          rule_set_snapshot?: Json
          run_notes?: string | null
          scoring_policy_version?: string
          source_policy_version?: string | null
          source_urls?: Json
          started_at?: string | null
          status?: string
          total_rows?: number
          updated_at?: string
        }
        Relationships: []
      }
      wk_chart_series_v2: {
        Row: {
          series_label: string | null
          series_slug: string | null
        }
        Insert: {
          series_label?: string | null
          series_slug?: string | null
        }
        Update: {
          series_label?: string | null
          series_slug?: string | null
        }
        Relationships: []
      }
      wk_chart_slug_aliases_v2: {
        Row: {
          canonical_slug: string | null
          entity_type: string | null
          id: string | null
          legacy_slug: string | null
          redirect_status: string | null
        }
        Insert: {
          canonical_slug?: string | null
          entity_type?: string | null
          id?: string | null
          legacy_slug?: string | null
          redirect_status?: string | null
        }
        Update: {
          canonical_slug?: string | null
          entity_type?: string | null
          id?: string | null
          legacy_slug?: string | null
          redirect_status?: string | null
        }
        Relationships: []
      }
      wk_chart_source_coverage_v2: {
        Row: {
          coverage_payload: Json | null
          coverage_status: string | null
          edition_id: string | null
          id: string | null
          source_count: number | null
          source_name: string | null
        }
        Insert: {
          coverage_payload?: Json | null
          coverage_status?: string | null
          edition_id?: string | null
          id?: string | null
          source_count?: number | null
          source_name?: string | null
        }
        Update: {
          coverage_payload?: Json | null
          coverage_status?: string | null
          edition_id?: string | null
          id?: string | null
          source_count?: number | null
          source_name?: string | null
        }
        Relationships: []
      }
      wk_import_staging_failures: {
        Row: {
          created_at: string | null
          failure_stage: string | null
          id: string
          ingestion_run_id: string
          message: string | null
          raw_record: Json | null
          source_entity: string | null
          source_file: string | null
        }
        Insert: {
          created_at?: string | null
          failure_stage?: string | null
          id?: string
          ingestion_run_id: string
          message?: string | null
          raw_record?: Json | null
          source_entity?: string | null
          source_file?: string | null
        }
        Update: {
          created_at?: string | null
          failure_stage?: string | null
          id?: string
          ingestion_run_id?: string
          message?: string | null
          raw_record?: Json | null
          source_entity?: string | null
          source_file?: string | null
        }
        Relationships: []
      }
      wk_import_staging_records: {
        Row: {
          author_name: string | null
          body: string | null
          created_at: string | null
          errors: Json | null
          excerpt: string | null
          id: string
          ingestion_run_id: string
          mapped_record: Json | null
          mapping_candidate_ids: Json | null
          published_at: string | null
          raw_record: Json | null
          source_entity: string | null
          source_file: string | null
          source_kind: string | null
          source_record_id: string | null
          source_slug: string | null
          source_url: string | null
          target_entity: string | null
          target_slug: string | null
          target_status: string | null
          title: string | null
          updated_at: string | null
          warnings: Json | null
        }
        Insert: {
          author_name?: string | null
          body?: string | null
          created_at?: string | null
          errors?: Json | null
          excerpt?: string | null
          id?: string
          ingestion_run_id: string
          mapped_record?: Json | null
          mapping_candidate_ids?: Json | null
          published_at?: string | null
          raw_record?: Json | null
          source_entity?: string | null
          source_file?: string | null
          source_kind?: string | null
          source_record_id?: string | null
          source_slug?: string | null
          source_url?: string | null
          target_entity?: string | null
          target_slug?: string | null
          target_status?: string | null
          title?: string | null
          updated_at?: string | null
          warnings?: Json | null
        }
        Update: {
          author_name?: string | null
          body?: string | null
          created_at?: string | null
          errors?: Json | null
          excerpt?: string | null
          id?: string
          ingestion_run_id?: string
          mapped_record?: Json | null
          mapping_candidate_ids?: Json | null
          published_at?: string | null
          raw_record?: Json | null
          source_entity?: string | null
          source_file?: string | null
          source_kind?: string | null
          source_record_id?: string | null
          source_slug?: string | null
          source_url?: string | null
          target_entity?: string | null
          target_slug?: string | null
          target_status?: string | null
          title?: string | null
          updated_at?: string | null
          warnings?: Json | null
        }
        Relationships: []
      }
      wk_ingestion_runs: {
        Row: {
          created_at: string
          errors: string[] | null
          finished_at: string | null
          id: string
          imported_counts: Json | null
          source_kind: string
          source_manifest: Json | null
          source_name: string
          started_at: string | null
          status: string
          warnings: string[] | null
        }
        Insert: {
          created_at?: string
          errors?: string[] | null
          finished_at?: string | null
          id?: string
          imported_counts?: Json | null
          source_kind: string
          source_manifest?: Json | null
          source_name: string
          started_at?: string | null
          status?: string
          warnings?: string[] | null
        }
        Update: {
          created_at?: string
          errors?: string[] | null
          finished_at?: string | null
          id?: string
          imported_counts?: Json | null
          source_kind?: string
          source_manifest?: Json | null
          source_name?: string
          started_at?: string | null
          status?: string
          warnings?: string[] | null
        }
        Relationships: []
      }
      wk_magazine_featured_artists: {
        Row: {
          artist_slug: string
          created_at: string | null
          display_order: number
          id: string
          updated_at: string | null
        }
        Insert: {
          artist_slug: string
          created_at?: string | null
          display_order?: number
          id?: string
          updated_at?: string | null
        }
        Update: {
          artist_slug?: string
          created_at?: string | null
          display_order?: number
          id?: string
          updated_at?: string | null
        }
        Relationships: []
      }
      wk_magazine_featured_guides: {
        Row: {
          created_at: string
          display_order: number
          guide_slug: string
          id: string
        }
        Insert: {
          created_at?: string
          display_order?: number
          guide_slug: string
          id?: string
        }
        Update: {
          created_at?: string
          display_order?: number
          guide_slug?: string
          id?: string
        }
        Relationships: []
      }
      wk_magazine_issue_entities: {
        Row: {
          created_at: string
          entity_id: string
          entity_type: string
          id: string
          issue_id: string
          role: string
          section_id: string | null
          selection_state: string
          sort_order: number
          source_reason: string | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          entity_id: string
          entity_type: string
          id: string
          issue_id: string
          role?: string
          section_id?: string | null
          selection_state?: string
          sort_order?: number
          source_reason?: string | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          entity_id?: string
          entity_type?: string
          id?: string
          issue_id?: string
          role?: string
          section_id?: string | null
          selection_state?: string
          sort_order?: number
          source_reason?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "wk_magazine_issue_entities_issue_id_fkey"
            columns: ["issue_id"]
            isOneToOne: false
            referencedRelation: "wk_magazine_issues"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "wk_magazine_issue_entities_section_id_fkey"
            columns: ["section_id"]
            isOneToOne: false
            referencedRelation: "wk_magazine_issue_sections"
            referencedColumns: ["id"]
          },
        ]
      }
      wk_magazine_issue_sections: {
        Row: {
          body: string | null
          created_at: string
          deck: string | null
          id: string
          issue_id: string
          layout: string
          section_type: string
          sort_order: number
          spread_id: string
          status: string
          title: string
          updated_at: string
          visual_asset_id: string | null
        }
        Insert: {
          body?: string | null
          created_at?: string
          deck?: string | null
          id: string
          issue_id: string
          layout?: string
          section_type: string
          sort_order?: number
          spread_id: string
          status?: string
          title: string
          updated_at?: string
          visual_asset_id?: string | null
        }
        Update: {
          body?: string | null
          created_at?: string
          deck?: string | null
          id?: string
          issue_id?: string
          layout?: string
          section_type?: string
          sort_order?: number
          spread_id?: string
          status?: string
          title?: string
          updated_at?: string
          visual_asset_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "wk_magazine_issue_sections_issue_id_fkey"
            columns: ["issue_id"]
            isOneToOne: false
            referencedRelation: "wk_magazine_issues"
            referencedColumns: ["id"]
          },
        ]
      }
      wk_magazine_issues: {
        Row: {
          approved_at: string | null
          approved_by: string | null
          brief_id: string | null
          contrast_mode: string | null
          created_at: string
          created_by: string
          dek: string | null
          generated_at: string | null
          generated_by: string | null
          id: string
          issue_type: string
          locked_at: string | null
          palette: string | null
          published_at: string | null
          published_by: string | null
          slug: string
          status: string
          timeframe_end: string | null
          timeframe_start: string | null
          title: string
          treatment: string | null
          updated_at: string
          visual_family: string | null
        }
        Insert: {
          approved_at?: string | null
          approved_by?: string | null
          brief_id?: string | null
          contrast_mode?: string | null
          created_at?: string
          created_by?: string
          dek?: string | null
          generated_at?: string | null
          generated_by?: string | null
          id: string
          issue_type?: string
          locked_at?: string | null
          palette?: string | null
          published_at?: string | null
          published_by?: string | null
          slug: string
          status?: string
          timeframe_end?: string | null
          timeframe_start?: string | null
          title: string
          treatment?: string | null
          updated_at?: string
          visual_family?: string | null
        }
        Update: {
          approved_at?: string | null
          approved_by?: string | null
          brief_id?: string | null
          contrast_mode?: string | null
          created_at?: string
          created_by?: string
          dek?: string | null
          generated_at?: string | null
          generated_by?: string | null
          id?: string
          issue_type?: string
          locked_at?: string | null
          palette?: string | null
          published_at?: string | null
          published_by?: string | null
          slug?: string
          status?: string
          timeframe_end?: string | null
          timeframe_start?: string | null
          title?: string
          treatment?: string | null
          updated_at?: string
          visual_family?: string | null
        }
        Relationships: []
      }
      wk_magazine_visual_assets: {
        Row: {
          contrast_mode: string | null
          created_at: string | null
          editorial_intent: string | null
          id: string
          palette: string | null
          spread_id: string | null
          status: string | null
          treatment: string | null
          updated_at: string | null
          visual_family: string | null
          visual_type: string | null
        }
        Insert: {
          contrast_mode?: string | null
          created_at?: string | null
          editorial_intent?: string | null
          id?: string
          palette?: string | null
          spread_id?: string | null
          status?: string | null
          treatment?: string | null
          updated_at?: string | null
          visual_family?: string | null
          visual_type?: string | null
        }
        Update: {
          contrast_mode?: string | null
          created_at?: string | null
          editorial_intent?: string | null
          id?: string
          palette?: string | null
          spread_id?: string | null
          status?: string | null
          treatment?: string | null
          updated_at?: string | null
          visual_family?: string | null
          visual_type?: string | null
        }
        Relationships: []
      }
      wk_playlist_items: {
        Row: {
          artist_names: string[]
          artwork_url: string | null
          created_at: string
          created_by: string | null
          duration_ms: number | null
          id: string
          isrc: string | null
          lifecycle_state: string
          match_confidence: number | null
          match_status: string
          normalization_payload: Json
          notes: string | null
          playlist_id: string
          position: number | null
          preview_url: string | null
          provider_key: string | null
          provider_track_id: string | null
          provider_url: string | null
          registry_release_id: string | null
          registry_track_id: string | null
          release_title: string | null
          removed_at: string | null
          removed_by: string | null
          title: string | null
          updated_at: string
        }
        Insert: {
          artist_names?: string[]
          artwork_url?: string | null
          created_at?: string
          created_by?: string | null
          duration_ms?: number | null
          id?: string
          isrc?: string | null
          lifecycle_state?: string
          match_confidence?: number | null
          match_status?: string
          normalization_payload?: Json
          notes?: string | null
          playlist_id: string
          position?: number | null
          preview_url?: string | null
          provider_key?: string | null
          provider_track_id?: string | null
          provider_url?: string | null
          registry_release_id?: string | null
          registry_track_id?: string | null
          release_title?: string | null
          removed_at?: string | null
          removed_by?: string | null
          title?: string | null
          updated_at?: string
        }
        Update: {
          artist_names?: string[]
          artwork_url?: string | null
          created_at?: string
          created_by?: string | null
          duration_ms?: number | null
          id?: string
          isrc?: string | null
          lifecycle_state?: string
          match_confidence?: number | null
          match_status?: string
          normalization_payload?: Json
          notes?: string | null
          playlist_id?: string
          position?: number | null
          preview_url?: string | null
          provider_key?: string | null
          provider_track_id?: string | null
          provider_url?: string | null
          registry_release_id?: string | null
          registry_track_id?: string | null
          release_title?: string | null
          removed_at?: string | null
          removed_by?: string | null
          title?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "wk_playlist_items_playlist_id_fkey"
            columns: ["playlist_id"]
            isOneToOne: false
            referencedRelation: "wk_playlists"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "wk_playlist_items_registry_release_id_fkey"
            columns: ["registry_release_id"]
            isOneToOne: false
            referencedRelation: "registry_releases"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "wk_playlist_items_registry_track_id_fkey"
            columns: ["registry_track_id"]
            isOneToOne: false
            referencedRelation: "registry_tracks"
            referencedColumns: ["id"]
          },
        ]
      }
      wk_playlist_preview_links: {
        Row: {
          created_at: string
          created_by: string | null
          expires_at: string
          id: string
          nonce: string
          playlist_id: string
          revoked_at: string | null
          version_id: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          expires_at: string
          id?: string
          nonce?: string
          playlist_id: string
          revoked_at?: string | null
          version_id: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          expires_at?: string
          id?: string
          nonce?: string
          playlist_id?: string
          revoked_at?: string | null
          version_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "wk_playlist_preview_links_playlist_id_fkey"
            columns: ["playlist_id"]
            isOneToOne: false
            referencedRelation: "wk_playlists"
            referencedColumns: ["id"]
          },
        ]
      }
      wk_playlists: {
        Row: {
          authority_revision: number
          canonical_url: string | null
          cover_image_url: string | null
          created_at: string
          created_by: string | null
          curator_credit_id: string | null
          curator_label: string | null
          description: string | null
          id: string
          metadata: Json
          playlist_kind: string
          published_at: string | null
          slug: string
          source_inquiry_id: string | null
          source_work_product_link_id: string | null
          status: string
          title: string
          updated_at: string
        }
        Insert: {
          authority_revision?: number
          canonical_url?: string | null
          cover_image_url?: string | null
          created_at?: string
          created_by?: string | null
          curator_credit_id?: string | null
          curator_label?: string | null
          description?: string | null
          id?: string
          metadata?: Json
          playlist_kind?: string
          published_at?: string | null
          slug: string
          source_inquiry_id?: string | null
          source_work_product_link_id?: string | null
          status?: string
          title: string
          updated_at?: string
        }
        Update: {
          authority_revision?: number
          canonical_url?: string | null
          cover_image_url?: string | null
          created_at?: string
          created_by?: string | null
          curator_credit_id?: string | null
          curator_label?: string | null
          description?: string | null
          id?: string
          metadata?: Json
          playlist_kind?: string
          published_at?: string | null
          slug?: string
          source_inquiry_id?: string | null
          source_work_product_link_id?: string | null
          status?: string
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "wk_playlists_source_inquiry_id_fkey"
            columns: ["source_inquiry_id"]
            isOneToOne: false
            referencedRelation: "institute_inquiries"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "wk_playlists_source_work_product_link_id_fkey"
            columns: ["source_work_product_link_id"]
            isOneToOne: false
            referencedRelation: "institute_work_product_links"
            referencedColumns: ["id"]
          },
        ]
      }
      wk_slug_redirects: {
        Row: {
          created_at: string
          created_by: string | null
          entity_type: string
          id: string
          new_path: string | null
          new_slug: string
          old_path: string | null
          old_slug: string
          redirect_status: number
          scope_slug: string | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          entity_type?: string
          id?: string
          new_path?: string | null
          new_slug: string
          old_path?: string | null
          old_slug: string
          redirect_status?: number
          scope_slug?: string | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          entity_type?: string
          id?: string
          new_path?: string | null
          new_slug?: string
          old_path?: string | null
          old_slug?: string
          redirect_status?: number
          scope_slug?: string | null
          updated_at?: string
        }
        Relationships: []
      }
    }
    Views: {
      artist_updates: {
        Row: {
          artist_id: string | null
          author_user_id: string | null
          body: string | null
          created_at: string | null
          id: string | null
          image_url: string | null
          link_label: string | null
          link_url: string | null
          published_at: string | null
          representation_id: string | null
          status: string | null
          updated_at: string | null
          withdrawn_at: string | null
        }
        Insert: {
          artist_id?: string | null
          author_user_id?: string | null
          body?: string | null
          created_at?: string | null
          id?: string | null
          image_url?: string | null
          link_label?: string | null
          link_url?: string | null
          published_at?: string | null
          representation_id?: string | null
          status?: string | null
          updated_at?: string | null
          withdrawn_at?: string | null
        }
        Update: {
          artist_id?: string | null
          author_user_id?: string | null
          body?: string | null
          created_at?: string | null
          id?: string | null
          image_url?: string | null
          link_label?: string | null
          link_url?: string | null
          published_at?: string | null
          representation_id?: string | null
          status?: string | null
          updated_at?: string | null
          withdrawn_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "artist_updates_artist_id_fkey"
            columns: ["artist_id"]
            isOneToOne: false
            referencedRelation: "registry_artists"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "artist_updates_representation_id_fkey"
            columns: ["representation_id"]
            isOneToOne: false
            referencedRelation: "artist_representations"
            referencedColumns: ["id"]
          },
        ]
      }
      institute_admin_entity_relationships: {
        Row: {
          confidence: string | null
          created_at: string | null
          created_by: string | null
          public_safe: boolean | null
          reason: string | null
          relationship_id: string | null
          relationship_type: string | null
          review_status: string | null
          reviewed_at: string | null
          reviewed_by: string | null
          source_entity_id: string | null
          source_entity_name: string | null
          source_entity_slug: string | null
          source_entity_type: string | null
          target_entity_id: string | null
          target_entity_name: string | null
          target_entity_slug: string | null
          target_entity_type: string | null
          updated_at: string | null
        }
        Relationships: [
          {
            foreignKeyName: "entity_relationships_source_entity_id_fkey"
            columns: ["source_entity_id"]
            isOneToOne: false
            referencedRelation: "cultural_entities"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "entity_relationships_target_entity_id_fkey"
            columns: ["target_entity_id"]
            isOneToOne: false
            referencedRelation: "cultural_entities"
            referencedColumns: ["id"]
          },
        ]
      }
      institute_admin_inquiry_evidence: {
        Row: {
          added_at: string | null
          added_by: string | null
          evidence_id: string | null
          evidence_title: string | null
          evidence_type: string | null
          inquiry_id: string | null
          inquiry_number: string | null
          inquiry_slug: string | null
          inquiry_title: string | null
          retrieval_status: string | null
          review_status: string | null
          summary: string | null
          use_note: string | null
        }
        Relationships: []
      }
      institute_admin_overview_counts: {
        Row: {
          measured_at: string | null
          metric_key: string | null
          metric_value: number | null
        }
        Relationships: []
      }
      institute_retrieval_ready_evidence: {
        Row: {
          confidence: string | null
          created_at: string | null
          created_by: string | null
          evidence_type: string | null
          id: string | null
          main_claim: string | null
          reliability: string | null
          retrieval_status: string | null
          review_status: string | null
          reviewed_at: string | null
          reviewed_by: string | null
          source_file: string | null
          source_note: string | null
          source_url: string | null
          summary: string | null
          title: string | null
          updated_at: string | null
          why_it_matters: string | null
        }
        Insert: {
          confidence?: string | null
          created_at?: string | null
          created_by?: string | null
          evidence_type?: string | null
          id?: string | null
          main_claim?: string | null
          reliability?: string | null
          retrieval_status?: string | null
          review_status?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          source_file?: string | null
          source_note?: string | null
          source_url?: string | null
          summary?: string | null
          title?: string | null
          updated_at?: string | null
          why_it_matters?: string | null
        }
        Update: {
          confidence?: string | null
          created_at?: string | null
          created_by?: string | null
          evidence_type?: string | null
          id?: string | null
          main_claim?: string | null
          reliability?: string | null
          retrieval_status?: string | null
          review_status?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          source_file?: string | null
          source_note?: string | null
          source_url?: string | null
          summary?: string | null
          title?: string | null
          updated_at?: string | null
          why_it_matters?: string | null
        }
        Relationships: []
      }
      institute_review_queue_evidence: {
        Row: {
          confidence: string | null
          created_at: string | null
          created_by: string | null
          evidence_type: string | null
          id: string | null
          main_claim: string | null
          reliability: string | null
          retrieval_status: string | null
          review_status: string | null
          reviewed_at: string | null
          reviewed_by: string | null
          source_file: string | null
          source_note: string | null
          source_url: string | null
          summary: string | null
          title: string | null
          updated_at: string | null
          why_it_matters: string | null
        }
        Insert: {
          confidence?: string | null
          created_at?: string | null
          created_by?: string | null
          evidence_type?: string | null
          id?: string | null
          main_claim?: string | null
          reliability?: string | null
          retrieval_status?: string | null
          review_status?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          source_file?: string | null
          source_note?: string | null
          source_url?: string | null
          summary?: string | null
          title?: string | null
          updated_at?: string | null
          why_it_matters?: string | null
        }
        Update: {
          confidence?: string | null
          created_at?: string | null
          created_by?: string | null
          evidence_type?: string | null
          id?: string | null
          main_claim?: string | null
          reliability?: string | null
          retrieval_status?: string | null
          review_status?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          source_file?: string | null
          source_note?: string | null
          source_url?: string | null
          summary?: string | null
          title?: string | null
          updated_at?: string | null
          why_it_matters?: string | null
        }
        Relationships: []
      }
      institute_review_queue_items: {
        Row: {
          created_at: string | null
          entity_id: string | null
          inquiry_id: string | null
          metadata: Json | null
          priority_weight: number | null
          review_reason: string | null
          review_status: string | null
          subject_id: string | null
          subject_type: string | null
          submitted_by: string | null
          summary: string | null
          title: string | null
          updated_at: string | null
        }
        Relationships: []
      }
      registry_entity_index: {
        Row: {
          canonical_source_id: string | null
          canonical_source_table: string | null
          description: string | null
          entity_id: string | null
          entity_type: string | null
          name: string | null
          public_safe: boolean | null
          review_status: string | null
          slug: string | null
          status: string | null
        }
        Relationships: []
      }
      registry_missing_artist_intake_queue: {
        Row: {
          affected_relationship_count: number | null
          intake_state: string | null
          legacy_slug: string | null
          missing_source_count: number | null
          missing_target_count: number | null
          relationship_types: string[] | null
          submission_created_at: string | null
          submission_id: string | null
          submission_review_status: string | null
          submission_reviewed_at: string | null
          suggested_display_name: string | null
        }
        Relationships: []
      }
      registry_missing_artist_latest_submission: {
        Row: {
          legacy_slug: string | null
          submission_created_at: string | null
          submission_id: string | null
          submission_review_status: string | null
          submission_reviewed_at: string | null
        }
        Relationships: []
      }
      registry_relationship_consolidation_queue: {
        Row: {
          consolidation_state: string | null
          duplicate_candidate: boolean | null
          duplicate_group_size: number | null
          evidence_count: number | null
          plain_reason: string | null
          public_safe: boolean | null
          relationship_id: string | null
          relationship_role: string | null
          relationship_status: string | null
          relationship_type: string | null
          review_status: string | null
          source_comparison_key: string | null
          source_entity_id: string | null
          source_entity_type: string | null
          source_slug: string | null
          target_comparison_key: string | null
          target_entity_id: string | null
          target_entity_type: string | null
          target_slug: string | null
          vocabulary_supported: boolean | null
        }
        Relationships: []
      }
      registry_relationship_duplicate_keys: {
        Row: {
          evidence_count: number | null
          plain_reason: string | null
          public_safe: boolean | null
          relationship_id: string | null
          relationship_role: string | null
          relationship_status: string | null
          relationship_type: string | null
          review_status: string | null
          source_comparison_key: string | null
          source_entity_id: string | null
          source_entity_type: string | null
          source_slug: string | null
          target_comparison_key: string | null
          target_entity_id: string | null
          target_entity_type: string | null
          target_slug: string | null
        }
        Relationships: []
      }
      registry_relationship_endpoint_resolution_queue: {
        Row: {
          candidate_entity_id: string | null
          candidate_entity_type: string | null
          candidate_slug: string | null
          current_entity_id: string | null
          endpoint_side: string | null
          legacy_entity_type: string | null
          legacy_slug: string | null
          match_count: number | null
          relationship_id: string | null
          resolution_state: string | null
        }
        Relationships: []
      }
      registry_relationship_endpoint_work_queue: {
        Row: {
          alias_candidate_id: string | null
          alias_match_count: number | null
          endpoint_work_state: string | null
          legacy_slug: string | null
          missing_entity_type: string | null
          missing_side: string | null
          relationship_id: string | null
          relationship_role: string | null
          relationship_type: string | null
          source_entity_id: string | null
          target_entity_id: string | null
        }
        Relationships: []
      }
      registry_relationship_evidence_readiness_queue: {
        Row: {
          evidence_count: number | null
          evidence_work_state: string | null
          has_plain_reason: boolean | null
          relationship_id: string | null
          relationship_role: string | null
          relationship_type: string | null
          source_entity_id: string | null
          source_entity_type: string | null
          source_slug: string | null
          target_entity_id: string | null
          target_entity_type: string | null
          target_slug: string | null
        }
        Relationships: []
      }
      registry_release_tracklists: {
        Row: {
          release_slug: string | null
          release_title: string | null
          track_count: number | null
          tracks: Json | null
        }
        Relationships: []
      }
      registry_unresolved_relationship_endpoints: {
        Row: {
          legacy_slug: string | null
          missing_entity_type: string | null
          missing_side: string | null
          relationship_id: string | null
          relationship_role: string | null
          relationship_type: string | null
          source_entity_id: string | null
          target_entity_id: string | null
        }
        Insert: {
          legacy_slug?: never
          missing_entity_type?: never
          missing_side?: never
          relationship_id?: string | null
          relationship_role?: string | null
          relationship_type?: string | null
          source_entity_id?: string | null
          target_entity_id?: string | null
        }
        Update: {
          legacy_slug?: never
          missing_entity_type?: never
          missing_side?: never
          relationship_id?: string | null
          relationship_role?: string | null
          relationship_type?: string | null
          source_entity_id?: string | null
          target_entity_id?: string | null
        }
        Relationships: []
      }
      wk_guides: {
        Row: {
          content: string | null
          created_at: string | null
          download_label: string | null
          download_url: string | null
          downloadables: Json | null
          excerpt: string | null
          hero_url: string | null
          id: string | null
          metadata: Json | null
          slug: string | null
          source_wp_post_id: number | null
          title: string | null
          updated_at: string | null
          wp_status: string | null
        }
        Insert: {
          content?: string | null
          created_at?: never
          download_label?: string | null
          download_url?: string | null
          downloadables?: never
          excerpt?: never
          hero_url?: string | null
          id?: string | null
          metadata?: never
          slug?: string | null
          source_wp_post_id?: number | null
          title?: string | null
          updated_at?: string | null
          wp_status?: never
        }
        Update: {
          content?: string | null
          created_at?: never
          download_label?: string | null
          download_url?: string | null
          downloadables?: never
          excerpt?: never
          hero_url?: string | null
          id?: string | null
          metadata?: never
          slug?: string | null
          source_wp_post_id?: number | null
          title?: string | null
          updated_at?: string | null
          wp_status?: never
        }
        Relationships: []
      }
      wk_publishing_channels: {
        Row: {
          channel_key: string | null
          description: string | null
          enabled: boolean | null
          label: string | null
          sort_order: number | null
        }
        Insert: {
          channel_key?: string | null
          description?: string | null
          enabled?: boolean | null
          label?: string | null
          sort_order?: number | null
        }
        Update: {
          channel_key?: string | null
          description?: string | null
          enabled?: boolean | null
          label?: string | null
          sort_order?: number | null
        }
        Relationships: []
      }
      wk_publishing_content_kinds: {
        Row: {
          canonical_resource_kind: string | null
          description: string | null
          enabled: boolean | null
          kind: string | null
          label: string | null
          sort_order: number | null
        }
        Insert: {
          canonical_resource_kind?: string | null
          description?: string | null
          enabled?: boolean | null
          kind?: string | null
          label?: string | null
          sort_order?: number | null
        }
        Update: {
          canonical_resource_kind?: string | null
          description?: string | null
          enabled?: boolean | null
          kind?: string | null
          label?: string | null
          sort_order?: number | null
        }
        Relationships: []
      }
      wk_publishing_workspace_items: {
        Row: {
          assignees: Json | null
          brief: string | null
          channels: Json | null
          content_kind: string | null
          content_kind_label: string | null
          created_at: string | null
          created_by: string | null
          created_by_label: string | null
          current_approved_version_id: string | null
          current_published_version_id: string | null
          current_submitted_version_id: string | null
          current_working_version_id: string | null
          editorial_state: string | null
          id: string | null
          owner_id: string | null
          owner_label: string | null
          planned_publish_at: string | null
          planning_state: string | null
          priority: string | null
          production_deadline: string | null
          production_stage: string | null
          publication_state: string | null
          record_version: number | null
          resource_id: string | null
          resource_kind: string | null
          title: string | null
          updated_at: string | null
          updated_by: string | null
          updated_by_label: string | null
        }
        Relationships: [
          {
            foreignKeyName: "publishing_items_content_kind_fkey"
            columns: ["content_kind"]
            isOneToOne: false
            referencedRelation: "wk_publishing_content_kinds"
            referencedColumns: ["kind"]
          },
        ]
      }
      wk_resource_index: {
        Row: {
          canonical_path: string | null
          canonical_record_id: string | null
          created_at: string | null
          lifecycle_state: string | null
          resource_id: string | null
          resource_kind: string | null
          updated_at: string | null
          visibility: string | null
        }
        Relationships: []
      }
      wk_resource_owner_index: {
        Row: {
          canonical_record_id: string | null
          owner_id: string | null
          resource_id: string | null
          resource_kind: string | null
        }
        Relationships: []
      }
    }
    Functions: {
      accept_article_suggestion: {
        Args: {
          p_expected_draft_version: number
          p_note?: string
          p_suggestion_id: string
        }
        Returns: {
          applied_version_id: string
          applied_version_number: number
          article_id: string
          article_slug: string
          decision_status: string
          draft_version: number
          suggestion_id: string
        }[]
      }
      accept_registry_missing_artist_intake: {
        Args: { p_review_reason: string; p_submission_id: string }
        Returns: Json
      }
      activate_media_variant: {
        Args: {
          p_asset_revision_id: string
          p_correlation_id?: string
          p_expected_selection_revision: number
          p_reason: string
          p_variant_id: string
          p_variant_role: string
        }
        Returns: {
          correlation_id: string
          selection_revision: number
          variant_id: string
        }[]
      }
      add_article_review_comment: {
        Args: { p_body_text: string; p_thread_id: string }
        Returns: {
          created_at: string
          created_comment_id: string
          thread_id: string
        }[]
      }
      add_audio_review_comment: {
        Args: { p_body_html: string; p_body_text: string; p_thread_id: string }
        Returns: Json
      }
      add_personal_playlist_track: {
        Args: {
          p_allow_duplicate?: boolean
          p_correlation_id?: string
          p_expected_authority_revision: number
          p_idempotency_key?: string
          p_playlist_id: string
          p_registry_track_id: string
        }
        Returns: {
          authority_revision: number
          playlist_id: string
          playlist_item_id: string
          receipt_id: string
          receipt_status: string
          result_payload: Json
        }[]
      }
      add_playlist_item: {
        Args: {
          p_artist_names?: string[]
          p_correlation_id?: string
          p_expected_authority_revision: number
          p_idempotency_key: string
          p_playlist_id: string
          p_provider_key?: string
          p_provider_track_id?: string
          p_provider_url?: string
          p_registry_track_id?: string
          p_release_title?: string
          p_title?: string
        }
        Returns: {
          authority_revision: number
          command_receipt_id: string
          idempotent_replay: boolean
          playlist_id: string
          playlist_item_id: string
          receipt_status: string
          resource_id: string
          result_payload: Json
        }[]
      }
      add_playlist_registry_track_with_intake_slots: {
        Args: {
          p_correlation_id?: string
          p_expected_authority_revision: number
          p_idempotency_key: string
          p_playlist_id: string
          p_registry_track_id: string
        }
        Returns: Json
      }
      add_playlist_validated_provider_track: {
        Args: {
          p_correlation_id?: string
          p_expected_authority_revision: number
          p_idempotency_key: string
          p_playlist_id: string
          p_registry_track_id: string
          p_validation_id: string
        }
        Returns: Json
      }
      add_playlist_validated_provider_track_with_intake_slots: {
        Args: {
          p_correlation_id?: string
          p_expected_authority_revision: number
          p_idempotency_key: string
          p_playlist_id: string
          p_registry_track_id: string
          p_validation_id: string
        }
        Returns: Json
      }
      add_publishing_item_assignee: {
        Args: {
          p_assignment_role: string
          p_expected_record_version: number
          p_item_id: string
          p_note?: string
          p_user_id: string
        }
        Returns: {
          item_id: string
          record_version: number
        }[]
      }
      add_publishing_item_channel: {
        Args: {
          p_channel_key: string
          p_expected_record_version: number
          p_is_primary?: boolean
          p_item_id: string
          p_note?: string
        }
        Returns: {
          item_id: string
          record_version: number
        }[]
      }
      add_related_resource_review: {
        Args: {
          p_case_resource_id: string
          p_correlation_id: string
          p_expected_case_revision: number
          p_idempotency_key: string
          p_reason: string
          p_related_resource_id: string
        }
        Returns: {
          case_resource_id: string
          case_revision: number
          command_receipt_id: string
          idempotent_replay: boolean
          receipt_status: string
          result_payload: Json
        }[]
      }
      admin_apply_artist_decouple_decision: {
        Args: { p_decision_id: string }
        Returns: Json
      }
      admin_apply_chart_artist_resolution_decision: {
        Args: { p_decision_id: string }
        Returns: Json
      }
      admin_apply_registry_track_duplicate_repair: {
        Args: {
          p_allow_medium_confidence?: boolean
          p_canonical_track_id: string
          p_duplicate_track_ids: string[]
          p_note?: string
        }
        Returns: Json
      }
      admin_create_registry_artist_for_decouple: {
        Args: {
          p_display_name: string
          p_note?: string
          p_slug?: string
          p_status?: string
        }
        Returns: Json
      }
      admin_create_registry_track_from_intake_enriched: {
        Args: {
          p_review_note?: string
          p_suggestion_id: string
          p_title: string
        }
        Returns: Json
      }
      admin_decouple_registry_artist: {
        Args: {
          p_archive_source?: boolean
          p_chart_primary_artist_id?: string
          p_note?: string
          p_replacements: Json
          p_source_artist_id: string
        }
        Returns: Json
      }
      admin_get_artist_decouple_decisions: {
        Args: { p_source_type?: string }
        Returns: Json
      }
      admin_get_artist_decouple_preview: {
        Args: { p_source_artist_id: string }
        Returns: Json
      }
      admin_get_artist_resolution_history: {
        Args: { p_limit?: number }
        Returns: Json
      }
      admin_get_chart_artist_resolution_decisions: {
        Args: { p_edition_id: string }
        Returns: Json
      }
      admin_get_registry_artist_merge_preview: {
        Args: { p_canonical_artist_id: string; p_source_artist_id: string }
        Returns: Json
      }
      admin_get_registry_track_duplicate_audit: {
        Args: { p_include_low_confidence?: boolean; p_limit?: number }
        Returns: Json
      }
      admin_get_registry_track_intake_enrichment: {
        Args: { p_suggestion_id: string }
        Returns: Json
      }
      admin_get_registry_track_intake_queue: {
        Args: {
          p_limit?: number
          p_offset?: number
          p_playlist_item_id?: string
          p_status?: string
          p_suggestion_id?: string
        }
        Returns: Json
      }
      admin_log_artist_resolution_event: {
        Args: {
          p_action: string
          p_chart_entries?: Json
          p_error_message?: string
          p_note?: string
          p_release_links?: Json
          p_replacement_artists?: Json
          p_result?: Json
          p_source_artist_id?: string
          p_source_snapshot?: Json
          p_status: string
          p_track_links?: Json
        }
        Returns: Json
      }
      admin_merge_registry_artists: {
        Args: {
          p_archive_source?: boolean
          p_canonical_artist_id: string
          p_note?: string
          p_source_artist_id: string
        }
        Returns: Json
      }
      admin_preview_registry_track_duplicate_repair: {
        Args: { p_canonical_track_id: string; p_duplicate_track_ids: string[] }
        Returns: Json
      }
      admin_record_registry_track_intake_provider_evidence: {
        Args: {
          p_confidence?: number
          p_fields: Json
          p_provider: string
          p_provider_entity_id: string
          p_provider_url: string
          p_raw_payload?: Json
          p_suggestion_id: string
        }
        Returns: Json
      }
      admin_refresh_signal_os_rollups: {
        Args: { p_end_date?: string; p_start_date?: string }
        Returns: Json
      }
      admin_reject_registry_track_intake: {
        Args: { p_review_note: string; p_suggestion_id: string }
        Returns: Json
      }
      admin_resolve_chart_artist_alias: {
        Args: {
          p_alias_display_name?: string
          p_alias_slug: string
          p_apply_to_existing?: boolean
          p_canonical_artist_id: string
        }
        Returns: Json
      }
      admin_resolve_registry_track_intake: {
        Args: {
          p_registry_track_id: string
          p_review_note?: string
          p_suggestion_id: string
        }
        Returns: Json
      }
      admin_resolve_registry_track_intake_enriched: {
        Args: {
          p_allow_overwrite?: boolean
          p_registry_track_id: string
          p_review_note?: string
          p_suggestion_id: string
        }
        Returns: Json
      }
      admin_safe_merge_registry_artists: {
        Args: {
          p_archive_source?: boolean
          p_canonical_artist_id: string
          p_merge_reason?: string
          p_note?: string
          p_source_artist_id: string
        }
        Returns: Json
      }
      admin_save_registry_track_intake_enrichment: {
        Args: { p_fields: Json; p_reason?: string; p_suggestion_id: string }
        Returns: Json
      }
      admin_search_registry_artists: {
        Args: { p_limit?: number; p_query: string }
        Returns: {
          artist_id: string
          artist_slug: string
          display_name: string
          origin_iso2: string
          public_image_url: string
          release_credit_count: number
          status: string
          track_credit_count: number
        }[]
      }
      admin_select_registry_track_intake_provider_evidence: {
        Args: {
          p_provider: string
          p_provider_entity_id: string
          p_reason?: string
          p_suggestion_id: string
        }
        Returns: Json
      }
      admin_update_registry_track_intake_artist_credit: {
        Args: {
          p_credit_order: number
          p_credit_role: string
          p_observed_name?: string
          p_registry_artist_id?: string
          p_resolution_mode: string
          p_suggestion_id: string
        }
        Returns: Json
      }
      admin_upsert_artist_decouple_decision: {
        Args: {
          p_chart_primary_artist_id?: string
          p_decision_status?: string
          p_decision_type?: string
          p_note?: string
          p_parsed_tokens?: Json
          p_raw_credit_text?: string
          p_selected_artists?: Json
          p_source_artist_id?: string
          p_source_id?: string
          p_source_label?: string
          p_source_snapshot?: Json
          p_source_table?: string
          p_source_type: string
        }
        Returns: Json
      }
      admin_upsert_chart_artist_resolution_decision: {
        Args: {
          p_chart_entry_id: string
          p_decision_status?: string
          p_decision_type: string
          p_note?: string
          p_parsed_tokens?: Json
          p_selected_artists?: Json
        }
        Returns: Json
      }
      adopt_verified_media_upload_session_v1: {
        Args: {
          p_asset_purpose?: string
          p_correlation_id?: string
          p_folder_id?: string
          p_session_id: string
          p_title?: string
        }
        Returns: Json
      }
      apply_article_correction: {
        Args: {
          p_application_summary: string
          p_case_resource_id: string
          p_challenged_article_version_id: string
          p_corrected_payload: Json
          p_correlation_id: string
          p_expected_case_revision: number
          p_expected_current_decision_id: string
          p_expected_published_article_version_id: string
          p_expected_working_article_version_id: string
          p_expected_working_fingerprint: string
          p_idempotency_key: string
          p_primary_target_id: string
          p_taxonomy_term_ids: string[]
        }
        Returns: {
          case_resource_id: string
          case_revision: number
          command_receipt_id: string
          idempotent_replay: boolean
          receipt_status: string
          result_payload: Json
        }[]
      }
      approve_article_version: {
        Args: { p_article_id: string; p_note?: string; p_version_id?: string }
        Returns: {
          article_id: string
          article_slug: string
          draft_version: number
          lifecycle_status: string
          version_id: string
          version_number: number
        }[]
      }
      archive_article: {
        Args: { p_article_id: string; p_note?: string }
        Returns: {
          article_id: string
          article_slug: string
          draft_version: number
          lifecycle_status: string
          version_id: string
          version_number: number
        }[]
      }
      archive_audio_publication: {
        Args: {
          p_correlation_id?: string
          p_expected_authority_revision: number
          p_idempotency_key: string
          p_note?: string
          p_publication_id: string
        }
        Returns: {
          authority_revision: number
          command_receipt_id: string
          idempotent_replay: boolean
          lifecycle_status: string
          publication_id: string
          receipt_status: string
          resource_id: string
          result_payload: Json
          version_id: string
          version_number: number
        }[]
      }
      archive_media_asset: {
        Args: {
          p_asset_id: string
          p_correlation_id?: string
          p_expected_authority_revision: number
          p_reason: string
        }
        Returns: {
          asset_id: string
          authority_revision: number
          correlation_id: string
          lifecycle_state: string
        }[]
      }
      archive_media_usage: {
        Args: {
          p_correlation_id?: string
          p_expected_usage_revision: number
          p_reason: string
          p_usage_link_id: string
        }
        Returns: {
          correlation_id: string
          usage_link_id: string
          usage_revision: number
          usage_state: string
        }[]
      }
      archive_personal_playlist: {
        Args: {
          p_correlation_id?: string
          p_expected_authority_revision: number
          p_idempotency_key?: string
          p_note?: string
          p_playlist_id: string
        }
        Returns: {
          authority_revision: number
          playlist_id: string
          receipt_id: string
          receipt_status: string
          resource_id: string
          result_payload: Json
        }[]
      }
      archive_playlist: {
        Args: {
          p_correlation_id?: string
          p_expected_authority_revision: number
          p_idempotency_key: string
          p_note?: string
          p_playlist_id: string
        }
        Returns: {
          authority_revision: number
          command_receipt_id: string
          idempotent_replay: boolean
          lifecycle_status: string
          playlist_id: string
          receipt_status: string
          resource_id: string
          result_payload: Json
          version_id: string
          version_number: number
        }[]
      }
      assign_correction_case: {
        Args: {
          p_case_resource_id: string
          p_correlation_id: string
          p_expected_case_revision: number
          p_idempotency_key: string
          p_investigator_id: string
          p_reason: string
        }
        Returns: {
          case_resource_id: string
          case_revision: number
          command_receipt_id: string
          idempotent_replay: boolean
          receipt_status: string
          result_payload: Json
        }[]
      }
      assign_user_role_admin: {
        Args: {
          assignment_notes?: string
          target_bio?: string
          target_display_name?: string
          target_role_key: string
          target_user_id: string
        }
        Returns: {
          assigned_at: string
          assigned_by: string | null
          created_at: string
          expires_at: string | null
          id: string
          notes: string | null
          role_key: string
          status: string
          updated_at: string
          user_id: string
        }
        SetofOptions: {
          from: "*"
          to: "user_role_assignments"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      attach_article_version_citation: {
        Args: {
          p_article_version_id: string
          p_citation_id: string
          p_citation_purpose: string
          p_display_order: number
          p_expected_citation_revision: number
          p_public_safe: boolean
          p_target_anchor_data: Json
          p_target_anchor_type: string
        }
        Returns: Json
      }
      attach_article_version_credit: {
        Args: {
          p_article_version_id: string
          p_credit_id: string
          p_display_order: number
          p_expected_credit_revision: number
          p_is_primary: boolean
          p_public_safe: boolean
        }
        Returns: Json
      }
      attach_media_usage: {
        Args: {
          p_alt_text_snapshot?: string
          p_asset_id: string
          p_asset_revision_id?: string
          p_caption_snapshot?: string
          p_correlation_id?: string
          p_credit_snapshot?: string
          p_display_order?: number
          p_placement_data?: Json
          p_resolution_mode: string
          p_target_authority: string
          p_target_id: string
          p_target_kind: string
          p_target_version_id?: string
          p_target_version_kind?: string
          p_usage_role: string
        }
        Returns: {
          correlation_id: string
          usage_link_id: string
          usage_revision: number
        }[]
      }
      briefing_cron_generate: { Args: never; Returns: undefined }
      bulk_delete_taxonomy_terms: {
        Args: { p_term_ids: string[] }
        Returns: {
          deleted_count: number
        }[]
      }
      cancel_media_upload_session_v1: {
        Args: { p_reason?: string; p_session_id: string }
        Returns: Json
      }
      chart_assert_committable_run: {
        Args: { p_run_id: string }
        Returns: Json
      }
      chart_assert_publishable_edition: {
        Args: { p_edition_id: string }
        Returns: Json
      }
      chart_assert_rule_clean_run: {
        Args: { p_run_id: string }
        Returns: undefined
      }
      chart_candidate_rule_decision: {
        Args: { p_explicit: boolean; p_release_date: string; p_run_id: string }
        Returns: Json
      }
      chart_create_artist_origin_shell: {
        Args: {
          p_actor_user_id?: string
          p_artist_name: string
          p_candidate_id?: string
          p_origin_iso2: string
          p_run_id?: string
        }
        Returns: Json
      }
      chart_entry_artist_token_slugs: {
        Args: { p_artist_name: string; p_artist_slug: string }
        Returns: {
          token_slug: string
        }[]
      }
      chart_get_edition_integrity_report: {
        Args: { p_edition_id: string }
        Returns: Json
      }
      chart_get_family_ingest_presets: {
        Args: never
        Returns: {
          config_json: Json
          family_id: string
          updated_at: string
          updated_by: string
        }[]
      }
      chart_get_run_candidate_origin_report: {
        Args: { p_run_id: string }
        Returns: {
          artist_display: string
          artists: Json
          candidate_id: string
          final_score: number
          is_country_eligible: boolean
          matching_origin_count: number
          normalized_key: string
          reason_code: string
          reason_label: string
          resolved_artist_count: number
          title: string
          unresolved_artist_count: number
        }[]
      }
      chart_get_run_integrity_report: {
        Args: { p_run_id: string }
        Returns: Json
      }
      chart_get_run_origin_review_queue: {
        Args: { p_run_id: string }
        Returns: {
          canonical_artist_id: string
          canonical_name: string
          canonical_slug: string
          current_origin_iso2: string
          examples: Json
          impacted_candidate_count: number
          issue_type: string
          review_key: string
          source_name: string
          source_slug: string
          target_iso2: string
          top_score: number
        }[]
      }
      chart_get_run_playback_readiness: {
        Args: { p_provider_key?: string; p_run_id: string }
        Returns: Json
      }
      chart_get_weekly_backfill_plan: {
        Args: { p_end_date: string; p_family_id: string; p_start_date: string }
        Returns: {
          edition_date: string
          existing_edition_id: string
          existing_edition_status: string
          existing_entry_count: number
          latest_run_id: string
          latest_run_status: string
          latest_run_updated_at: string
          recommended_action: string
          release_window_end: string
          release_window_start: string
        }[]
      }
      chart_reset_run_after_origin_resolution: {
        Args: { p_run_id: string }
        Returns: Json
      }
      chart_rule_explicit_allowed: {
        Args: { p_snapshot: Json }
        Returns: boolean
      }
      chart_rule_snapshot_text: {
        Args: { p_key: string; p_snapshot: Json }
        Returns: string
      }
      chart_set_artist_origin_for_charts: {
        Args: {
          p_actor_user_id?: string
          p_artist_id: string
          p_candidate_id?: string
          p_note?: string
          p_origin_iso2: string
          p_run_id?: string
        }
        Returns: Json
      }
      chart_upsert_family_ingest_preset: {
        Args: {
          p_actor_user_id?: string
          p_config_json: Json
          p_family_id: string
        }
        Returns: Json
      }
      claim_media_processing_jobs_v1: {
        Args: {
          p_lease_seconds?: number
          p_limit?: number
          p_worker_id: string
        }
        Returns: {
          attempt_count: number
          command_receipt_id: string
          command_type: string
          input_payload: Json
          job_id: string
          job_type: string
          lease_expires_at: string
          max_attempts: number
          resource_id: string
        }[]
      }
      close_correction_case: {
        Args: {
          p_case_resource_id: string
          p_contributor_follow_up_disposition?: string
          p_contributor_follow_up_reason?: string
          p_correlation_id: string
          p_expected_case_revision: number
          p_idempotency_key: string
          p_public_note_disposition?: string
          p_public_note_no_note_reason?: string
          p_reason: string
        }
        Returns: {
          case_resource_id: string
          case_revision: number
          command_receipt_id: string
          idempotent_replay: boolean
          receipt_status: string
          result_payload: Json
        }[]
      }
      community_admin_decide_artist_claim: {
        Args: {
          p_can_manage_profile?: boolean
          p_can_manage_team?: boolean
          p_can_post_updates?: boolean
          p_can_submit_releases?: boolean
          p_claim_id: string
          p_decision: string
          p_reason: string
        }
        Returns: Json
      }
      community_admin_get_artist_claims: {
        Args: { p_limit?: number; p_status?: string }
        Returns: Json
      }
      community_admin_get_registry_onboarding_artists: {
        Args: never
        Returns: Json
      }
      community_admin_revoke_artist_representation: {
        Args: { p_reason: string; p_representation_id: string }
        Returns: Json
      }
      community_admin_set_registry_onboarding_artists: {
        Args: { p_artist_slugs: string[]; p_fallback_enabled?: boolean }
        Returns: Json
      }
      community_artist_accept_representation: {
        Args: { p_representation_id: string }
        Returns: Json
      }
      community_artist_get_team: {
        Args: { p_artist_id: string }
        Returns: Json
      }
      community_artist_invite_representative: {
        Args: {
          p_artist_id: string
          p_can_manage_profile?: boolean
          p_can_manage_team?: boolean
          p_can_post_updates?: boolean
          p_can_submit_releases?: boolean
          p_representation_role: string
          p_username: string
        }
        Returns: Json
      }
      community_artist_revoke_representation: {
        Args: { p_reason: string; p_representation_id: string }
        Returns: Json
      }
      community_artist_update_representative: {
        Args: {
          p_can_manage_profile: boolean
          p_can_manage_team: boolean
          p_can_post_updates: boolean
          p_can_submit_releases: boolean
          p_representation_id: string
          p_representation_role: string
        }
        Returns: Json
      }
      community_claim_guest_follow_intent: {
        Args: { p_intent_token: string }
        Returns: Json
      }
      community_create_comment: {
        Args: {
          p_body_html: string
          p_body_markdown: string
          p_body_plain: string
          p_parent_id: string
          p_status?: string
          p_thread_id: string
        }
        Returns: Json
      }
      community_create_context_anchor_comment: {
        Args: {
          p_anchor_label?: string
          p_anchor_type?: string
          p_body_html?: string
          p_body_markdown: string
          p_body_plain?: string
          p_context_entity_id?: string
          p_context_entity_slug?: string
          p_context_entity_type?: string
          p_context_label?: string
          p_thread_id: string
        }
        Returns: Json
      }
      community_create_contribution: {
        Args: {
          p_contribution_type: string
          p_entity_id: string
          p_entity_slug: string
          p_entity_type: string
          p_payload?: Json
          p_source_comment_id: string
        }
        Returns: Json
      }
      community_create_guest_follow_intent: {
        Args: { p_artist_ids: string[] }
        Returns: Json
      }
      community_create_profile: {
        Args: { p_display_name?: string; p_user_id: string; p_username: string }
        Returns: Json
      }
      community_create_track_moment_comment: {
        Args: {
          p_anchor_end_time_ms?: number
          p_anchor_label?: string
          p_anchor_time_ms?: number
          p_body_html?: string
          p_body_markdown: string
          p_body_plain?: string
          p_thread_id: string
        }
        Returns: Json
      }
      community_delete_post_draft: {
        Args: { p_draft_id: string }
        Returns: Json
      }
      community_distribute_notifications: {
        Args: {
          p_author_id: string
          p_comment_id: string
          p_parent_id?: string
          p_thread_id: string
        }
        Returns: undefined
      }
      community_edit_artist_update: {
        Args: {
          p_body: string
          p_image_url?: string
          p_link_label?: string
          p_link_url?: string
          p_update_id: string
        }
        Returns: Json
      }
      community_edit_post: {
        Args: {
          p_body: string
          p_image_url?: string
          p_link_label?: string
          p_link_url?: string
          p_post_id: string
          p_registry_track_id?: string
        }
        Returns: Json
      }
      community_ensure_user_account: {
        Args: { p_user_id: string }
        Returns: undefined
      }
      community_follow_target: {
        Args: {
          p_target_id: string
          p_target_slug?: string
          p_target_type: string
        }
        Returns: Json
      }
      community_generate_username: {
        Args: { p_display_name?: string; p_email: string; p_user_id: string }
        Returns: string
      }
      community_get_actor_repost_state: {
        Args: { p_actor_id: string; p_actor_type: string; p_post_ids: string[] }
        Returns: Json
      }
      community_get_artist_launch_analytics: {
        Args: { p_artist_id: string; p_days?: number }
        Returns: Json
      }
      community_get_artist_manage_updates: {
        Args: { p_artist_id: string; p_limit?: number }
        Returns: Json
      }
      community_get_artist_music_submissions: {
        Args: { p_artist_id: string; p_limit?: number }
        Returns: Json
      }
      community_get_artist_public_presentation: {
        Args: { p_artist_id: string }
        Returns: Json
      }
      community_get_artist_representation_state: {
        Args: { p_artist_id: string }
        Returns: Json
      }
      community_get_artist_team: {
        Args: { p_artist_id: string }
        Returns: Json
      }
      community_get_artist_update: {
        Args: { p_update_id: string }
        Returns: Json
      }
      community_get_block_state: {
        Args: {
          p_target_id: string
          p_target_slug: string
          p_target_type: string
        }
        Returns: Json
      }
      community_get_comment_replies: {
        Args: { p_limit?: number; p_parent_id: string }
        Returns: Json
      }
      community_get_context_anchor_comments: {
        Args: {
          p_anchor_type: string
          p_context_entity_id?: string
          p_context_entity_slug?: string
          p_context_entity_type?: string
          p_limit?: number
          p_thread_id: string
        }
        Returns: {
          anchor_end_time_ms: number
          anchor_label: string
          anchor_time_ms: number
          anchor_type: string
          author_id: string
          body_html: string
          body_markdown: string
          body_plain: string
          context_entity_id: string
          context_entity_slug: string
          context_entity_type: string
          context_label: string
          created_at: string
          deleted_at: string
          depth: number
          downvote_count: number
          edited_at: string
          id: string
          is_editor_pick: boolean
          is_pinned: boolean
          parent_id: string
          path: string
          reaction_count: number
          reply_count: number
          report_count: number
          root_id: string
          score: number
          status: string
          thread_id: string
          updated_at: string
          upvote_count: number
        }[]
      }
      community_get_context_anchor_summary: {
        Args: { p_anchor_type?: string; p_limit?: number; p_thread_id: string }
        Returns: {
          anchor_label: string
          anchor_type: string
          comment_count: number
          context_entity_id: string
          context_entity_slug: string
          context_entity_type: string
          context_label: string
          latest_comment_at: string
          reaction_count: number
          score: number
        }[]
      }
      community_get_digest: { Args: { p_limit?: number }; Returns: Json }
      community_get_entity_contributions: {
        Args: {
          p_entity_id?: string
          p_entity_slug?: string
          p_entity_type: string
        }
        Returns: Json
      }
      community_get_follow_suggestions: {
        Args: { p_artist_limit?: number; p_people_limit?: number }
        Returns: Json
      }
      community_get_following_feed: {
        Args: {
          p_before_item_key?: string
          p_before_published_at?: string
          p_limit?: number
        }
        Returns: Json
      }
      community_get_most_discussed: {
        Args: { p_limit?: number }
        Returns: Json
      }
      community_get_my_artist_representations: { Args: never; Returns: Json }
      community_get_notification_by_id: {
        Args: { p_notification_id: string }
        Returns: Json
      }
      community_get_notification_prefs: {
        Args: { p_user_id: string }
        Returns: Json
      }
      community_get_or_create_thread: {
        Args: {
          p_entity_id?: string
          p_entity_slug?: string
          p_entity_type: string
          p_entity_url?: string
          p_title?: string
        }
        Returns: Json
      }
      community_get_person_follow_state: {
        Args: { p_person_resource_id: string }
        Returns: Json
      }
      community_get_post: { Args: { p_post_id: string }; Returns: Json }
      community_get_post_drafts: {
        Args: { p_actor_id: string; p_actor_type: string }
        Returns: Json
      }
      community_get_post_legacy_m8c3: {
        Args: { p_post_id: string }
        Returns: Json
      }
      community_get_post_legacy_m8c4: {
        Args: { p_post_id: string }
        Returns: Json
      }
      community_get_post_mentions: {
        Args: { p_post_id: string }
        Returns: Json
      }
      community_get_post_thread_context: {
        Args: { p_post_id: string }
        Returns: Json
      }
      community_get_profile_by_username: {
        Args: { p_username: string }
        Returns: Json
      }
      community_get_profiles_batch: {
        Args: { p_user_ids: string[] }
        Returns: Json
      }
      community_get_reaction_state_for_public_targets: {
        Args: { p_targets: Json }
        Returns: Json
      }
      community_get_registry_onboarding_artists: {
        Args: { p_limit?: number }
        Returns: Json
      }
      community_get_registry_onboarding_state: { Args: never; Returns: Json }
      community_get_social_feed: {
        Args: {
          p_before_item_key?: string
          p_before_published_at?: string
          p_limit?: number
        }
        Returns: Json
      }
      community_get_social_feed_legacy_m8b: {
        Args: {
          p_before_item_key?: string
          p_before_published_at?: string
          p_limit?: number
        }
        Returns: Json
      }
      community_get_social_feed_legacy_m8c2: {
        Args: {
          p_before_item_key?: string
          p_before_published_at?: string
          p_limit?: number
        }
        Returns: Json
      }
      community_get_social_feed_legacy_m8c3: {
        Args: {
          p_before_item_key?: string
          p_before_published_at?: string
          p_limit?: number
        }
        Returns: Json
      }
      community_get_thread: { Args: { p_thread_id: string }; Returns: Json }
      community_get_thread_by_entity: {
        Args: {
          p_entity_id?: string
          p_entity_slug?: string
          p_entity_type: string
        }
        Returns: Json
      }
      community_get_thread_comments: {
        Args: {
          p_limit?: number
          p_offset?: number
          p_sort_by?: string
          p_thread_id: string
        }
        Returns: {
          anchor_end_time_ms: number
          anchor_label: string
          anchor_time_ms: number
          anchor_type: string
          author_id: string
          body_html: string
          body_markdown: string
          body_plain: string
          context_entity_id: string
          context_entity_slug: string
          context_entity_type: string
          context_label: string
          created_at: string
          deleted_at: string
          depth: number
          downvote_count: number
          edited_at: string
          id: string
          is_editor_pick: boolean
          is_pinned: boolean
          parent_id: string
          path: string
          reaction_count: number
          reply_count: number
          report_count: number
          root_id: string
          score: number
          status: string
          thread_id: string
          updated_at: string
          upvote_count: number
        }[]
      }
      community_get_track_moment_comments: {
        Args: {
          p_anchor_time_ms?: number
          p_limit?: number
          p_thread_id: string
          p_window_ms?: number
        }
        Returns: {
          anchor_end_time_ms: number
          anchor_label: string
          anchor_time_ms: number
          anchor_type: string
          author_id: string
          body_html: string
          body_markdown: string
          body_plain: string
          created_at: string
          deleted_at: string
          depth: number
          downvote_count: number
          edited_at: string
          id: string
          is_editor_pick: boolean
          is_pinned: boolean
          parent_id: string
          path: string
          reaction_count: number
          reply_count: number
          report_count: number
          root_id: string
          score: number
          status: string
          thread_id: string
          updated_at: string
          upvote_count: number
        }[]
      }
      community_get_track_moment_summary: {
        Args: { p_limit?: number; p_thread_id: string }
        Returns: {
          anchor_label: string
          anchor_time_ms: number
          comment_count: number
          latest_comment_at: string
          reaction_count: number
          score: number
        }[]
      }
      community_get_unread_count: { Args: never; Returns: Json }
      community_get_user_comments: {
        Args: { p_limit?: number; p_user_id: string }
        Returns: {
          author_id: string
          body_html: string
          body_markdown: string
          body_plain: string
          created_at: string
          deleted_at: string
          depth: number
          downvote_count: number
          edited_at: string
          id: string
          is_editor_pick: boolean
          is_pinned: boolean
          parent_id: string
          path: string
          reaction_count: number
          reply_count: number
          report_count: number
          root_id: string
          score: number
          status: string
          thread_entity_id: string
          thread_entity_slug: string
          thread_entity_type: string
          thread_entity_url: string
          thread_id: string
          thread_title: string
          updated_at: string
          upvote_count: number
        }[]
      }
      community_get_user_follows: { Args: { p_user_id: string }; Returns: Json }
      community_get_user_notifications: {
        Args: { p_limit?: number; p_user_id: string }
        Returns: Json
      }
      community_get_user_profile: { Args: { p_user_id: string }; Returns: Json }
      community_get_user_reactions: {
        Args: { p_target_ids: string[]; p_user_id: string }
        Returns: Json
      }
      community_get_user_reactions_for_comments: {
        Args: { p_target_ids: string[]; p_user_id: string }
        Returns: {
          reaction_type: string
          target_id: string
        }[]
      }
      community_get_user_replies: {
        Args: { p_limit?: number; p_user_id: string }
        Returns: {
          author_id: string
          body_html: string
          body_markdown: string
          body_plain: string
          created_at: string
          deleted_at: string
          depth: number
          downvote_count: number
          edited_at: string
          id: string
          is_editor_pick: boolean
          is_pinned: boolean
          parent_id: string
          path: string
          reaction_count: number
          reply_count: number
          report_count: number
          root_id: string
          score: number
          status: string
          thread_entity_id: string
          thread_entity_slug: string
          thread_entity_type: string
          thread_entity_url: string
          thread_id: string
          thread_title: string
          updated_at: string
          upvote_count: number
        }[]
      }
      community_get_user_saves: { Args: { p_user_id: string }; Returns: Json }
      community_get_user_stats: { Args: { p_user_id: string }; Returns: Json }
      community_get_user_votes: {
        Args: { p_comment_ids: string[]; p_user_id: string }
        Returns: Json
      }
      community_get_user_votes_for_comments: {
        Args: { p_comment_ids: string[]; p_user_id: string }
        Returns: {
          comment_id: string
          vote_value: number
        }[]
      }
      community_increment_reputation: {
        Args: { p_amount: number; p_user_id: string }
        Returns: Json
      }
      community_list_artist_posts: {
        Args: { p_artist_id: string; p_limit?: number }
        Returns: Json
      }
      community_mark_all_read: { Args: never; Returns: Json }
      community_mark_notification_read: {
        Args: { p_notification_id: string }
        Returns: Json
      }
      community_normalize_username: {
        Args: { p_username: string }
        Returns: string
      }
      community_profile_json: {
        Args: {
          p_profile: Database["public"]["Tables"]["user_profiles"]["Row"]
        }
        Returns: Json
      }
      community_publish_artist_update: {
        Args: {
          p_artist_id: string
          p_body: string
          p_image_url?: string
          p_link_label?: string
          p_link_url?: string
        }
        Returns: Json
      }
      community_publish_post: {
        Args: {
          p_actor_id: string
          p_actor_type: string
          p_body: string
          p_image_url?: string
          p_link_label?: string
          p_link_url?: string
          p_registry_track_id?: string
        }
        Returns: Json
      }
      community_publish_post_draft_group: {
        Args: { p_draft_group_id: string }
        Returns: Json
      }
      community_quote_post: {
        Args: {
          p_actor_id: string
          p_actor_type: string
          p_body: string
          p_image_url?: string
          p_link_label?: string
          p_link_url?: string
          p_quoted_post_id: string
          p_registry_track_id?: string
        }
        Returns: Json
      }
      community_react_to_target: {
        Args: {
          p_reaction_type: string
          p_target_id: string
          p_target_type: string
        }
        Returns: Json
      }
      community_reorder_post_draft_group: {
        Args: { p_draft_group_id: string; p_draft_ids: string[] }
        Returns: Json
      }
      community_report_comment: {
        Args: { p_comment_id: string; p_details?: string; p_reason: string }
        Returns: Json
      }
      community_report_post: {
        Args: { p_details?: string; p_post_id: string; p_reason: string }
        Returns: Json
      }
      community_save_artist_profile_presentation: {
        Args: {
          p_artist_id: string
          p_bio?: string
          p_hero_image_url?: string
          p_profile_image_url?: string
          p_public_email?: string
          p_social_links?: Json
          p_website_url?: string
        }
        Returns: Json
      }
      community_save_entity: {
        Args: {
          p_entity_id?: string
          p_entity_slug?: string
          p_entity_type: string
          p_entity_url?: string
          p_image_url?: string
          p_subtitle?: string
          p_title?: string
        }
        Returns: Json
      }
      community_save_post_draft: {
        Args: {
          p_actor_id: string
          p_actor_type: string
          p_body: string
          p_draft_group_id: string
          p_draft_id: string
          p_image_url: string
          p_link_label: string
          p_link_url: string
          p_position: number
          p_quoted_post_id: string
          p_registry_track_id: string
        }
        Returns: Json
      }
      community_search_mention_suggestions: {
        Args: { p_limit?: number; p_query: string }
        Returns: {
          avatar_url: string
          canonical_path: string
          display_name: string
          handle: string
          person_id: string
        }[]
      }
      community_set_block_state: {
        Args: {
          p_blocked: boolean
          p_target_id: string
          p_target_slug: string
          p_target_type: string
        }
        Returns: Json
      }
      community_set_follow_state: {
        Args: {
          p_followed: boolean
          p_target_id: string
          p_target_slug: string
          p_target_type: string
        }
        Returns: Json
      }
      community_set_post_repost_state: {
        Args: {
          p_actor_id: string
          p_actor_type: string
          p_post_id: string
          p_reposted: boolean
        }
        Returns: Json
      }
      community_set_registry_onboarding_state: {
        Args: { p_status: string }
        Returns: Json
      }
      community_set_saved_state: {
        Args: {
          p_entity_id: string
          p_entity_slug: string
          p_entity_type: string
          p_entity_url: string
          p_image_url: string
          p_saved: boolean
          p_subtitle: string
          p_title: string
        }
        Returns: Json
      }
      community_soft_delete_comment: {
        Args: { p_comment_id: string }
        Returns: Json
      }
      community_submit_artist_claim: {
        Args: {
          p_artist_id: string
          p_claimant_role: string
          p_evidence?: Json
          p_statement: string
        }
        Returns: Json
      }
      community_submit_artist_music: {
        Args: {
          p_artist_credits: Json
          p_artist_id: string
          p_submission_key: string
          p_validation_id: string
        }
        Returns: Json
      }
      community_submit_artist_registry_correction: {
        Args: {
          p_artist_id: string
          p_field_key: string
          p_proposed_value: string
          p_reason: string
        }
        Returns: Json
      }
      community_update_comment: {
        Args: {
          p_body_html?: string
          p_body_markdown: string
          p_body_plain?: string
          p_comment_id: string
        }
        Returns: Json
      }
      community_update_notification_prefs: {
        Args: {
          p_artist_drops: boolean
          p_chart_alerts: boolean
          p_contribution_notifications: boolean
          p_email_digest: boolean
          p_follow_notifications: boolean
          p_marketing_emails: boolean
          p_mention_notifications: boolean
          p_reply_notifications: boolean
          p_user_id: string
        }
        Returns: Json
      }
      community_update_profile:
        | {
            Args: {
              p_avatar_url?: string
              p_bio?: string
              p_city?: string
              p_country?: string
              p_display_name?: string
              p_is_public?: boolean
              p_user_id: string
            }
            Returns: Json
          }
        | {
            Args: {
              p_avatar_url?: string
              p_bio?: string
              p_city?: string
              p_clear_avatar?: boolean
              p_clear_cover?: boolean
              p_country?: string
              p_cover_url?: string
              p_display_name?: string
              p_is_public?: boolean
              p_user_id: string
            }
            Returns: Json
          }
      community_update_username: { Args: { p_username: string }; Returns: Json }
      community_username_available: {
        Args: { p_username: string }
        Returns: Json
      }
      community_username_is_reserved: {
        Args: { p_username: string }
        Returns: boolean
      }
      community_username_is_valid: {
        Args: { p_username: string }
        Returns: boolean
      }
      community_username_seed: { Args: { p_seed: string }; Returns: string }
      community_vote_comment: {
        Args: { p_comment_id: string; p_vote_value: number }
        Returns: Json
      }
      community_withdraw_artist_claim: {
        Args: { p_claim_id: string; p_reason?: string }
        Returns: Json
      }
      community_withdraw_artist_update: {
        Args: { p_reason: string; p_update_id: string }
        Returns: Json
      }
      community_withdraw_post: {
        Args: { p_post_id: string; p_reason: string }
        Returns: Json
      }
      complete_media_processing_job_v1: {
        Args: { p_job_id: string; p_result?: Json; p_worker_id: string }
        Returns: Json
      }
      complete_registry_relationship_review: {
        Args: {
          p_confidence: string
          p_evidence_main_claim: string
          p_evidence_summary: string
          p_evidence_title: string
          p_evidence_type: string
          p_next_review_status: string
          p_plain_reason: string
          p_public_safe: boolean
          p_relationship_id: string
          p_reliability: string
          p_review_reason: string
          p_source_url: string
        }
        Returns: {
          confidence: number | null
          created_at: string
          created_by: string | null
          id: string
          metadata: Json
          plain_reason: string | null
          public_safe: boolean
          relationship_role: string | null
          relationship_status: string
          relationship_type: string
          review_note: string | null
          review_status: string
          reviewed_at: string | null
          reviewed_by: string | null
          sort_order: number | null
          source_entity: string | null
          source_entity_id: string | null
          source_entity_type: string
          source_kind: string | null
          source_record_id: string | null
          source_slug: string
          source_staging_record_id: string | null
          status_reason: string | null
          superseded_by_relationship_id: string | null
          target_entity_id: string | null
          target_entity_type: string
          target_slug: string
          updated_at: string
          updated_by: string | null
          valid_from: string | null
          valid_to: string | null
        }
        SetofOptions: {
          from: "*"
          to: "registry_entity_relationships"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      confirm_playlist_playback_validation: {
        Args: {
          p_playlist_id: string
          p_probe_metadata?: Json
          p_requested_by: string
          p_validation_id: string
        }
        Returns: Json
      }
      count_all_import_runs: { Args: never; Returns: number }
      count_import_runs_with_errors: { Args: never; Returns: number }
      create_article: {
        Args: {
          p_author?: string
          p_categories?: Json
          p_content_html?: string
          p_excerpt?: string
          p_hero_image_url?: string
          p_published_at?: string
          p_seo?: Json
          p_slug: string
          p_status?: string
          p_tags?: Json
          p_title: string
        }
        Returns: {
          created_at: string
          id: string
          slug: string
          title: string
          wp_status: string
        }[]
      }
      create_article_autosave: {
        Args: {
          p_article_id: string
          p_expected_draft_version: number
          p_payload: Json
        }
        Returns: {
          created_at: string
          source_draft_version: number
          version_id: string
          version_number: number
        }[]
      }
      create_article_preview_link: {
        Args: {
          p_article_id: string
          p_expires_at?: string
          p_version_id?: string
        }
        Returns: {
          expires_at: string
          nonce: string
          version_id: string
        }[]
      }
      create_article_suggestion: {
        Args: {
          p_anchor_from: number
          p_anchor_prefix: string
          p_anchor_quote: string
          p_anchor_suffix: string
          p_anchor_to: number
          p_article_id: string
          p_comment?: string
          p_operation_kind: string
          p_original_text: string
          p_proposed_content_html: string
          p_replacement_text: string
          p_target_version_fingerprint: string
          p_target_version_id: string
        }
        Returns: {
          created_at: string
          created_suggestion_id: string
          created_thread_id: string
        }[]
      }
      create_audio_publication: {
        Args: {
          p_correlation_id?: string
          p_episode_number?: number
          p_idempotency_key: string
          p_metadata?: Json
          p_publication_kind: string
          p_season_id?: string
          p_show_id?: string
          p_slug: string
          p_summary?: string
          p_title: string
          p_visibility?: string
        }
        Returns: {
          authority_revision: number
          command_receipt_id: string
          idempotent_replay: boolean
          publication_id: string
          receipt_status: string
          resource_id: string
          resource_kind: string
          result_payload: Json
          version_id: string
          version_number: number
        }[]
      }
      create_audio_season: {
        Args: {
          p_correlation_id?: string
          p_description?: string
          p_idempotency_key: string
          p_metadata?: Json
          p_season_number: number
          p_show_id: string
          p_title: string
        }
        Returns: {
          authority_revision: number
          command_receipt_id: string
          idempotent_replay: boolean
          receipt_status: string
          resource_id: string
          result_payload: Json
          season_id: string
        }[]
      }
      create_audio_show: {
        Args: {
          p_correlation_id?: string
          p_description?: string
          p_idempotency_key: string
          p_metadata?: Json
          p_slug: string
          p_title: string
          p_visibility?: string
        }
        Returns: {
          authority_revision: number
          command_receipt_id: string
          idempotent_replay: boolean
          receipt_status: string
          resource_id: string
          result_payload: Json
          show_id: string
        }[]
      }
      create_audio_time_review_thread: {
        Args: {
          p_anchor_end_seconds: number
          p_anchor_kind: string
          p_anchor_start_seconds: number
          p_body_html: string
          p_body_text: string
          p_publication_id: string
          p_target_version_id: string
        }
        Returns: Json
      }
      create_citation: {
        Args: {
          p_editor_note?: string
          p_locator_data: Json
          p_locator_type: string
          p_public_label?: string
          p_public_safe?: boolean
          p_quotation?: string
          p_source_id: string
          p_source_version_id: string
        }
        Returns: Json
      }
      create_correction_case_from_contribution: {
        Args: {
          p_contribution_id: string
          p_correction_kind: string
          p_correlation_id: string
          p_idempotency_key: string
          p_origin_summary: string
        }
        Returns: {
          case_resource_id: string
          case_revision: number
          command_receipt_id: string
          idempotent_replay: boolean
          receipt_status: string
          result_payload: Json
        }[]
      }
      create_credit: {
        Args: {
          p_credit_note?: string
          p_credit_role: string
          p_external_contributor_id?: string
          p_public_safe?: boolean
          p_registry_author_id?: string
          p_role_label_override?: string
          p_user_id?: string
        }
        Returns: Json
      }
      create_external_contributor: {
        Args: {
          p_consent_status?: string
          p_contact_email?: string
          p_contact_phone?: string
          p_display_name: string
          p_internal_notes?: string
          p_location_text?: string
          p_public_role?: string
          p_public_safe?: boolean
          p_public_url?: string
        }
        Returns: Json
      }
      create_import_run: {
        Args: {
          p_errors?: string[]
          p_imported_counts?: Json
          p_source_kind: string
          p_source_manifest: Json
          p_source_name: string
          p_status?: string
          p_warnings?: string[]
        }
        Returns: {
          created_at: string
          errors: string[] | null
          finished_at: string | null
          id: string
          imported_counts: Json | null
          source_kind: string
          source_manifest: Json | null
          source_name: string
          started_at: string | null
          status: string
          warnings: string[] | null
        }[]
        SetofOptions: {
          from: "*"
          to: "wk_ingestion_runs"
          isOneToOne: false
          isSetofReturn: true
        }
      }
      create_ingestion_run:
        | {
            Args: {
              p_errors?: Json
              p_source_kind: string
              p_source_manifest: Json
              p_source_name: string
              p_status?: string
              p_warnings?: Json
            }
            Returns: string
          }
        | {
            Args: {
              p_errors_text?: string
              p_source_kind: string
              p_source_manifest: Json
              p_source_name: string
              p_status?: string
              p_warnings_text?: string
            }
            Returns: string
          }
        | {
            Args: {
              p_errors_text?: string
              p_source_kind: string
              p_source_manifest_text: string
              p_source_name: string
              p_status?: string
              p_warnings_text?: string
            }
            Returns: string
          }
      create_institute_article_draft: {
        Args: {
          p_author?: string
          p_excerpt?: string
          p_metadata?: Json
          p_seo?: Json
          p_slug_base: string
          p_title: string
        }
        Returns: {
          article_id: string
          article_slug: string
        }[]
      }
      create_institute_playlist_draft: {
        Args: {
          p_curator_label?: string
          p_description?: string
          p_inquiry_id: string
          p_items?: Json
          p_title: string
        }
        Returns: {
          playlist_id: string
          playlist_slug: string
          work_product_link_id: string
        }[]
      }
      create_internal_correction_case: {
        Args: {
          p_correction_kind: string
          p_correlation_id: string
          p_idempotency_key: string
          p_origin_summary: string
          p_priority: string
        }
        Returns: {
          case_resource_id: string
          case_revision: number
          command_receipt_id: string
          idempotent_replay: boolean
          receipt_status: string
          result_payload: Json
        }[]
      }
      create_magazine_issue: {
        Args: {
          p_brief_id: string
          p_dek: string
          p_id: string
          p_issue_type: string
          p_slug: string
          p_timeframe_end: string
          p_timeframe_start: string
          p_title: string
        }
        Returns: Json
      }
      create_media_asset: {
        Args: {
          p_asset_kind: string
          p_asset_purpose: string
          p_compatibility_folder_id?: string
          p_correlation_id?: string
          p_title: string
        }
        Returns: {
          asset_id: string
          authority_revision: number
          correlation_id: string
          governance_version_id: string
        }[]
      }
      create_media_asset_revision: {
        Args: {
          p_asset_id: string
          p_correlation_id?: string
          p_expected_authority_revision: number
          p_file_object_id: string
          p_replacement_reason: string
        }
        Returns: {
          asset_revision_id: string
          authority_revision: number
          correlation_id: string
          revision_number: number
        }[]
      }
      create_media_asset_write_v2: {
        Args: {
          p_asset: Json
          p_correlation_id?: string
          p_file: Json
          p_reason?: string
          p_variant?: Json
        }
        Returns: Json
      }
      create_media_governance_version: {
        Args: {
          p_asset_id: string
          p_correlation_id?: string
          p_expected_authority_revision: number
          p_governance: Json
          p_reason: string
        }
        Returns: {
          authority_revision: number
          correlation_id: string
          governance_version_id: string
          version_number: number
        }[]
      }
      create_media_upload_session_v1: {
        Args: {
          p_correlation_id?: string
          p_expected_byte_size: number
          p_expected_sha256: string
          p_idempotency_key: string
          p_mime_type: string
          p_original_filename: string
          p_ttl_seconds?: number
        }
        Returns: Json
      }
      create_media_upload_session_v2: {
        Args: {
          p_correlation_id?: string
          p_expected_byte_size: number
          p_expected_sha256: string
          p_idempotency_key: string
          p_mime_type: string
          p_original_filename: string
          p_ttl_seconds?: number
        }
        Returns: Json
      }
      create_personal_playlist: {
        Args: {
          p_correlation_id?: string
          p_description?: string
          p_idempotency_key?: string
          p_slug: string
          p_title: string
          p_visibility?: string
        }
        Returns: {
          authority_revision: number
          playlist_id: string
          receipt_id: string
          receipt_status: string
          resource_id: string
          result_payload: Json
        }[]
      }
      create_playlist: {
        Args: {
          p_correlation_id?: string
          p_curator_label?: string
          p_description?: string
          p_idempotency_key: string
          p_metadata?: Json
          p_slug: string
          p_title: string
        }
        Returns: {
          authority_revision: number
          command_receipt_id: string
          idempotent_replay: boolean
          playlist_id: string
          receipt_status: string
          resource_id: string
          result_payload: Json
        }[]
      }
      create_playlist_preview_link: {
        Args: {
          p_expires_at?: string
          p_playlist_id: string
          p_version_id?: string
        }
        Returns: {
          expires_at: string
          nonce: string
          version_id: string
        }[]
      }
      create_public_playlist_missing_track_submission: {
        Args: {
          p_artist_names: string[]
          p_details?: string
          p_idempotency_key?: string
          p_playlist_id: string
          p_playlist_slug: string
          p_provider?: Json
          p_track_title: string
          p_user_id: string
        }
        Returns: Json
      }
      create_publishing_item: {
        Args: {
          p_brief?: string
          p_content_kind: string
          p_note?: string
          p_owner_id?: string
          p_planned_publish_at?: string
          p_priority?: string
          p_production_deadline?: string
          p_production_stage?: string
          p_resource_id?: string
          p_title: string
        }
        Returns: {
          item_id: string
          record_version: number
        }[]
      }
      create_registry_cultural_entity: {
        Args: {
          p_canonical_source_id?: string
          p_canonical_source_table?: string
          p_description?: string
          p_entity_type: string
          p_metadata?: Json
          p_name: string
          p_slug?: string
          p_source_id?: string
          p_source_table?: string
        }
        Returns: {
          canonical_source_id: string | null
          canonical_source_table: string | null
          created_at: string
          description: string | null
          entity_type: string
          id: string
          metadata: Json
          name: string
          public_safe: boolean
          review_note: string | null
          review_status: string
          reviewed_at: string | null
          reviewed_by: string | null
          slug: string | null
          source_id: string | null
          source_table: string | null
          status: string
          updated_at: string
        }
        SetofOptions: {
          from: "*"
          to: "cultural_entities"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      create_registry_entity_relationship: {
        Args: {
          p_evidence_id?: string
          p_evidence_note?: string
          p_evidence_support_type?: string
          p_metadata?: Json
          p_plain_reason?: string
          p_relationship_role?: string
          p_relationship_type: string
          p_source_entity_id: string
          p_source_entity_type: string
          p_target_entity_id: string
          p_target_entity_type: string
          p_valid_from?: string
          p_valid_to?: string
        }
        Returns: {
          confidence: number | null
          created_at: string
          created_by: string | null
          id: string
          metadata: Json
          plain_reason: string | null
          public_safe: boolean
          relationship_role: string | null
          relationship_status: string
          relationship_type: string
          review_note: string | null
          review_status: string
          reviewed_at: string | null
          reviewed_by: string | null
          sort_order: number | null
          source_entity: string | null
          source_entity_id: string | null
          source_entity_type: string
          source_kind: string | null
          source_record_id: string | null
          source_slug: string
          source_staging_record_id: string | null
          status_reason: string | null
          superseded_by_relationship_id: string | null
          target_entity_id: string | null
          target_entity_type: string
          target_slug: string
          updated_at: string
          updated_by: string | null
          valid_from: string | null
          valid_to: string | null
        }
        SetofOptions: {
          from: "*"
          to: "registry_entity_relationships"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      create_registry_missing_artist_intake: {
        Args: {
          p_display_name: string
          p_legacy_slug: string
          p_reason: string
          p_source_url?: string
        }
        Returns: {
          accepted_evidence_id: string | null
          accepted_relationship_id: string | null
          body: string
          consent_status: string
          contributor_id: string
          correction_id: string | null
          created_at: string
          entity_id: string | null
          id: string
          inquiry_id: string | null
          review_note: string | null
          review_status: string
          reviewed_at: string | null
          reviewed_by: string | null
          source_note: string | null
          source_url: string | null
          submission_type: string
          title: string | null
          updated_at: string
        }
        SetofOptions: {
          from: "*"
          to: "contributor_submissions"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      create_registry_track_intake_suggestion: {
        Args: {
          p_artist_resolution_mode: string
          p_playlist_id: string
          p_registry_artist_id?: string
          p_validation_id: string
        }
        Returns: Json
      }
      create_source: {
        Args: {
          p_correlation_id?: string
          p_metadata: Json
          p_registry_links?: Json
        }
        Returns: Json
      }
      create_taxonomy_term: {
        Args: {
          p_description?: string
          p_name: string
          p_seo_description?: string
          p_seo_keywords?: string
          p_seo_title?: string
          p_slug: string
          p_taxonomy: string
        }
        Returns: {
          created_at: string
          description: string
          id: string
          name: string
          seo_description: string
          seo_keywords: string
          seo_title: string
          slug: string
          source_kind: string
          updated_at: string
        }[]
      }
      current_user_can_edit_playlist_id: {
        Args: { p_playlist_id: string }
        Returns: boolean
      }
      current_user_has_capability: {
        Args: { required_capability: string }
        Returns: boolean
      }
      current_user_is_administrator: { Args: never; Returns: boolean }
      daitch_mokotoff: { Args: { "": string }; Returns: string[] }
      delete_batch_from_staging: {
        Args: { batch_size: number }
        Returns: number
      }
      delete_taxonomy_term: { Args: { p_term_id: string }; Returns: undefined }
      detach_media_usage: {
        Args: {
          p_correlation_id?: string
          p_expected_usage_revision: number
          p_reason: string
          p_usage_link_id: string
        }
        Returns: {
          correlation_id: string
          usage_link_id: string
          usage_revision: number
          usage_state: string
        }[]
      }
      discover_unknown_artist_slugs: {
        Args: never
        Returns: {
          occurrence_count: number
          sample_display_name: string
          source_table: string
          unknown_slug: string
        }[]
      }
      discover_unknown_artist_slugs_v2: {
        Args: never
        Returns: {
          first_seen: string
          sample_name: string
          slug: string
          source_count: number
          source_type: string
        }[]
      }
      dmetaphone: { Args: { "": string }; Returns: string }
      dmetaphone_alt: { Args: { "": string }; Returns: string }
      exec_sql: { Args: { query: string }; Returns: undefined }
      expire_media_upload_session_v1: {
        Args: { p_reason?: string; p_session_id: string }
        Returns: Json
      }
      fail_media_processing_job_v1: {
        Args: {
          p_error: string
          p_job_id: string
          p_retry_delay_seconds?: number
          p_retryable?: boolean
          p_worker_id: string
        }
        Returns: Json
      }
      fail_media_upload_session_v1: {
        Args: { p_error: string; p_session_id: string }
        Returns: Json
      }
      finalize_step_cf_chunk: {
        Args: { p_limit: number; p_min_id?: string; p_run_id: string }
        Returns: Json
      }
      finalize_step_complete: {
        Args: {
          p_authors: number
          p_content: number
          p_entities: number
          p_errors: Json
          p_media: number
          p_review: number
          p_run_id: string
          p_tax: number
        }
        Returns: Json
      }
      finalize_step_content: { Args: { p_run_id: string }; Returns: Json }
      finalize_step_custom_fields: { Args: { p_run_id: string }; Returns: Json }
      finalize_step_entities: { Args: { p_run_id: string }; Returns: Json }
      finalize_step_entities_chunk: {
        Args: { p_limit: number; p_min_id: string; p_run_id: string }
        Returns: Json
      }
      finalize_step_entity_relationships: {
        Args: { p_run_id: string }
        Returns: Json
      }
      finalize_step_ers_all: { Args: { p_run_id: string }; Returns: Json }
      finalize_step_ers_chunk: {
        Args: { p_limit: number; p_offset: number; p_run_id: string }
        Returns: Json
      }
      finalize_step_ers_chunk_v2:
        | {
            Args: { p_limit: number; p_min_id: number; p_run_id: string }
            Returns: Json
          }
        | {
            Args: { p_limit: number; p_min_id: string; p_run_id: string }
            Returns: Json
          }
        | {
            Args: { p_limit: number; p_min_id: string; p_run_id: string }
            Returns: Json
          }
      finalize_step_ers_chunk_v3:
        | {
            Args: { p_limit: number; p_min_id: string; p_run_id: string }
            Returns: Json
          }
        | {
            Args: { p_limit: number; p_min_id?: string; p_run_id: string }
            Returns: Json
          }
      finalize_step_ers_chunk_v4: {
        Args: { p_limit: number; p_min_id?: string; p_run_id: string }
        Returns: Json
      }
      finalize_step_ers_chunk_v5: {
        Args: { p_limit: number; p_min_id?: string; p_run_id: string }
        Returns: Json
      }
      finalize_step_ers_chunk_v6: {
        Args: { p_limit: number; p_min_id?: string; p_run_id: string }
        Returns: Json
      }
      finalize_step_ers_chunk_v7: {
        Args: { p_limit: number; p_min_id?: string; p_run_id: string }
        Returns: Json
      }
      finalize_step_ers_chunk_v8: {
        Args: { p_limit: number; p_min_id?: string; p_run_id: string }
        Returns: Json
      }
      finalize_step_media: { Args: { p_run_id: string }; Returns: Json }
      finalize_step_review: { Args: { p_run_id: string }; Returns: Json }
      find_similar_artists:
        | {
            Args: {
              max_results?: number
              search_name?: string
              search_slug: string
              similarity_threshold?: number
            }
            Returns: {
              artist_id: string
              artist_slug: string
              display_name: string
              match_reason: string
              similarity_score: number
            }[]
          }
        | {
            Args: {
              max_results?: number
              search_name?: string
              search_slug: string
              similarity_threshold?: number
            }
            Returns: {
              artist_id: string
              artist_slug: string
              display_name: string
              match_reason: string
              similarity_score: number
            }[]
          }
      get_admin_article_resource_identities: {
        Args: { p_article_ids: string[] }
        Returns: {
          canonical_record_id: string
          owner_id: string
          resource_id: string
        }[]
      }
      get_admin_audio_publication_workspace: {
        Args: { p_publication_id: string }
        Returns: Json
      }
      get_admin_import_runs: {
        Args: { p_limit?: number }
        Returns: {
          created_at: string
          errors: string[] | null
          finished_at: string | null
          id: string
          imported_counts: Json | null
          source_kind: string
          source_manifest: Json | null
          source_name: string
          started_at: string | null
          status: string
          warnings: string[] | null
        }[]
        SetofOptions: {
          from: "*"
          to: "wk_ingestion_runs"
          isOneToOne: false
          isSetofReturn: true
        }
      }
      get_admin_track_lyrics_contribution_inbox: {
        Args: {
          p_limit?: number
          p_offset?: number
          p_search?: string
          p_status?: string
        }
        Returns: Json
      }
      get_admin_track_lyrics_contributions: {
        Args: { p_track_id: string }
        Returns: Json
      }
      get_admin_track_lyrics_history: {
        Args: { p_limit?: number; p_track_id?: string }
        Returns: Json
      }
      get_admin_track_lyrics_workspace: {
        Args: { p_track_id: string }
        Returns: Json
      }
      get_article_review_workspace: {
        Args: { p_article_id: string }
        Returns: Json
      }
      get_article_trust_citation_intake_options: { Args: never; Returns: Json }
      get_article_version_trust_workspace: {
        Args: { p_article_version_id: string }
        Returns: Json
      }
      get_article_working_version_identity: {
        Args: { p_article_id: string }
        Returns: Json
      }
      get_audio_editorial_media_context: {
        Args: { p_publication_id: string }
        Returns: Json
      }
      get_audio_editorial_workbench: {
        Args: { p_publication_id: string }
        Returns: Json
      }
      get_chart_programs: {
        Args: never
        Returns: {
          created_at: string | null
          default_chart_size: number | null
          default_methodology_version: string | null
          default_period_type: string | null
          id: string
          label: string
          market_slug: string | null
          public_slug: string
          series_slug: string | null
          status: string | null
          updated_at: string | null
        }[]
        SetofOptions: {
          from: "*"
          to: "chart_programs"
          isOneToOne: false
          isSetofReturn: true
        }
      }
      get_correction_case_workspace: {
        Args: { p_case_resource_id: string }
        Returns: Json
      }
      get_import_run_by_id: {
        Args: { p_id: string }
        Returns: {
          created_at: string
          errors: string[] | null
          finished_at: string | null
          id: string
          imported_counts: Json | null
          source_kind: string
          source_manifest: Json | null
          source_name: string
          started_at: string | null
          status: string
          warnings: string[] | null
        }[]
        SetofOptions: {
          from: "*"
          to: "wk_ingestion_runs"
          isOneToOne: false
          isSetofReturn: true
        }
      }
      get_latest_article_autosave: {
        Args: { p_article_id: string }
        Returns: {
          author_display: string
          category_snapshot: Json
          content_html: string
          created_at: string
          excerpt: string
          seo: Json
          slug: string
          source_draft_version: number
          tag_snapshot: Json
          title: string
          version_id: string
          version_number: number
        }[]
      }
      get_media_asset_v2: { Args: { p_asset_id: string }; Returns: Json }
      get_media_private_delivery_target_v1: {
        Args: { p_file_object_id: string }
        Returns: Json
      }
      get_media_upload_session_v1: {
        Args: { p_session_id: string }
        Returns: Json
      }
      get_my_personal_playlist: {
        Args: { p_playlist_id: string }
        Returns: Json
      }
      get_my_personal_playlist_by_route: {
        Args: { p_slug: string; p_username: string }
        Returns: Json
      }
      get_playlist_cover_source: {
        Args: { p_asset_id: string; p_playlist_id: string }
        Returns: Json
      }
      get_playlist_current_cover: {
        Args: { p_playlist_id: string }
        Returns: Json
      }
      get_playlist_pending_registry_intake: {
        Args: { p_playlist_id: string }
        Returns: Json
      }
      get_playlist_pending_registry_intake_editorial: {
        Args: { p_playlist_id: string }
        Returns: Json
      }
      get_playlist_review_workspace: {
        Args: { p_playlist_id: string }
        Returns: Json
      }
      get_public_artist_relationships: {
        Args: { p_artist_id: string }
        Returns: {
          direction: string
          evidence_count: number
          plain_reason: string
          related_entity_id: string
          related_entity_image_url: string
          related_entity_name: string
          related_entity_slug: string
          related_entity_type: string
          related_entity_url: string
          relationship_id: string
          relationship_role: string
          relationship_type: string
          reviewed_at: string
        }[]
      }
      get_public_artist_structural_proximity: {
        Args: { p_artist_id: string }
        Returns: {
          features_them: number
          proximity_score: number
          related_artist_id: string
          related_artist_image_url: string
          related_artist_name: string
          related_artist_slug: string
          shared_release_count: number
          shared_titles: string[]
          shared_track_count: number
          they_feature: number
        }[]
      }
      get_public_audio_enclosure: {
        Args: { p_publication_id: string }
        Returns: Json
      }
      get_public_audio_index: { Args: { p_limit?: number }; Returns: Json }
      get_public_audio_publication: { Args: { p_slug: string }; Returns: Json }
      get_public_audio_publication_m1: {
        Args: { p_slug: string }
        Returns: Json
      }
      get_public_living_memory: {
        Args: {
          p_entity_id?: string
          p_entity_slug?: string
          p_entity_type: string
        }
        Returns: {
          editorial_label: string
          editorial_opener: string
          entity_id: string
          entity_slug: string
          entity_type: string
          public_prompt: string
          status: string
          updated_at: string
        }[]
      }
      get_public_organization: { Args: { p_slug: string }; Returns: Json }
      get_public_person: { Args: { p_slug: string }; Returns: Json }
      get_public_person_social_summary: {
        Args: { p_person_resource_id: string }
        Returns: Json
      }
      get_public_personal_playlist: {
        Args: { p_slug: string; p_username: string }
        Returns: Json
      }
      get_public_playlist: { Args: { p_slug: string }; Returns: Json }
      get_public_registry_artists_for_search: {
        Args: { p_limit?: number }
        Returns: {
          display_name: string
          id: string
          metadata: Json
          public_image_url: string
          slug: string
        }[]
      }
      get_public_show: { Args: { p_slug: string }; Returns: Json }
      get_public_show_episode: {
        Args: { p_episode_slug: string; p_show_slug: string }
        Returns: Json
      }
      get_public_track_lyrics: { Args: { p_track_id: string }; Returns: Json }
      get_release_artists_for_anon: {
        Args: { p_artist_slug: string }
        Returns: {
          confidence: number
          is_primary: boolean
          release_id: string
          role: string
          source: string
        }[]
      }
      get_release_artists_for_anon_v2: {
        Args: { p_artist_slug: string }
        Returns: {
          confidence: number
          is_primary: boolean
          release_id: string
          role: string
          source: string
        }[]
      }
      get_release_tracks_by_ids: {
        Args: { p_release_ids: string[] }
        Returns: {
          disc_number: number
          release_id: string
          track_id: string
          track_number: number
        }[]
      }
      get_releases_by_ids: {
        Args: { p_release_ids: string[] }
        Returns: {
          artwork_url: string
          id: string
          metadata: Json
          release_date: string
          release_type: string
          slug: string
          status: string
          title: string
        }[]
      }
      get_releases_by_ids_v2: {
        Args: { p_release_ids: string[] }
        Returns: {
          artwork_url: string
          id: string
          metadata: Json
          release_date: string
          release_type: string
          slug: string
          status: string
          title: string
        }[]
      }
      get_resource_version_editorial_metadata: {
        Args: { p_target_version_id: string; p_target_version_type: string }
        Returns: Json
      }
      get_taxonomy_article_counts: {
        Args: { p_taxonomy: string }
        Returns: {
          article_count: number
          term_name: string
        }[]
      }
      get_taxonomy_terms:
        | {
            Args: { p_taxonomy: string }
            Returns: {
              created_at: string
              description: string
              id: string
              name: string
              slug: string
              updated_at: string
            }[]
          }
        | {
            Args: {
              p_page?: number
              p_page_size?: number
              p_search?: string
              p_taxonomy: string
            }
            Returns: {
              created_at: string
              description: string
              id: string
              name: string
              seo_description: string
              seo_keywords: string
              seo_title: string
              slug: string
              source_kind: string
              total_count: number
              updated_at: string
            }[]
          }
      get_tracks_by_ids: {
        Args: { p_track_ids: string[] }
        Returns: {
          artwork_url: string
          disc_number: number
          duration_ms: number
          id: string
          slug: string
          title: string
          track_number: number
        }[]
      }
      grant_select_all_tables: { Args: never; Returns: undefined }
      grant_select_to_anon: { Args: { tablename: string }; Returns: undefined }
      has_capability: { Args: { p_capability: string }; Returns: boolean }
      increment_share_count:
        | { Args: { p_page_url: string; p_platform: string }; Returns: number }
        | {
            Args: {
              p_article_slug?: string
              p_article_title?: string
              p_page_url: string
              p_platform: string
            }
            Returns: number
          }
      institute_accept_submission_as_evidence: {
        Args: {
          p_evidence_title?: string
          p_review_note?: string
          p_submission_id: string
        }
        Returns: {
          accepted_evidence_id: string | null
          accepted_relationship_id: string | null
          body: string
          consent_status: string
          contributor_id: string
          correction_id: string | null
          created_at: string
          entity_id: string | null
          id: string
          inquiry_id: string | null
          review_note: string | null
          review_status: string
          reviewed_at: string | null
          reviewed_by: string | null
          source_note: string | null
          source_url: string | null
          submission_type: string
          title: string | null
          updated_at: string
        }
        SetofOptions: {
          from: "*"
          to: "contributor_submissions"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      institute_accept_submission_as_memory: {
        Args: { p_review_note?: string; p_submission_id: string }
        Returns: {
          accepted_evidence_id: string | null
          accepted_relationship_id: string | null
          body: string
          consent_status: string
          contributor_id: string
          correction_id: string | null
          created_at: string
          entity_id: string | null
          id: string
          inquiry_id: string | null
          review_note: string | null
          review_status: string
          reviewed_at: string | null
          reviewed_by: string | null
          source_note: string | null
          source_url: string | null
          submission_type: string
          title: string | null
          updated_at: string
        }
        SetofOptions: {
          from: "*"
          to: "contributor_submissions"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      institute_can_manage: { Args: never; Returns: boolean }
      institute_can_read: { Args: never; Returns: boolean }
      institute_can_review: { Args: never; Returns: boolean }
      institute_review_contributor_submission: {
        Args: {
          p_decision: string
          p_decision_note?: string
          p_submission_id: string
        }
        Returns: {
          id: string
          review_note: string
          review_status: string
          reviewed_at: string
          reviewed_by: string
          submission_type: string
          updated_at: string
        }[]
      }
      institute_review_entity_relationship: {
        Args: {
          p_decision: string
          p_decision_note?: string
          p_relationship_id: string
        }
        Returns: {
          id: string
          public_safe: boolean
          relationship_type: string
          review_note: string
          review_status: string
          reviewed_at: string
          reviewed_by: string
          updated_at: string
        }[]
      }
      institute_review_evidence_item: {
        Args: {
          p_decision: string
          p_decision_note?: string
          p_evidence_id: string
        }
        Returns: {
          id: string
          retrieval_status: string
          review_status: string
          reviewed_at: string
          reviewed_by: string
          title: string
          updated_at: string
        }[]
      }
      institute_review_surface_draft: {
        Args: {
          p_decision: string
          p_decision_note?: string
          p_draft_id: string
        }
        Returns: {
          id: string
          public_safe: boolean
          review_status: string
          reviewed_at: string
          reviewed_by: string
          surface_type: string
          updated_at: string
        }[]
      }
      is_current_user_administrator: { Args: never; Returns: boolean }
      link_correction_evidence: {
        Args: {
          p_case_resource_id: string
          p_citation_id: string
          p_correlation_id: string
          p_evidence_role: string
          p_expected_case_revision: number
          p_idempotency_key: string
          p_internal_note: string
          p_reason: string
          p_source_id: string
          p_source_version_id: string
        }
        Returns: {
          case_resource_id: string
          case_revision: number
          command_receipt_id: string
          idempotent_replay: boolean
          receipt_status: string
          result_payload: Json
        }[]
      }
      link_orphan_release_artists: {
        Args: never
        Returns: {
          result: Json
        }[]
      }
      link_person_identity: {
        Args: {
          p_correlation_id?: string
          p_expected_identity_revision: number
          p_external_contributor_id: string
          p_idempotency_key: string
          p_link_method: string
          p_person_resource_id: string
          p_reason: string
          p_registry_author_id: string
          p_user_id: string
        }
        Returns: {
          command_receipt_id: string
          idempotent_replay: boolean
          identity_link_id: string
          identity_revision: number
          person_resource_id: string
          receipt_status: string
          result_payload: Json
        }[]
      }
      link_publishing_item_resource: {
        Args: {
          p_expected_record_version: number
          p_item_id: string
          p_note?: string
          p_resource_id: string
        }
        Returns: {
          item_id: string
          record_version: number
        }[]
      }
      list_admin_audio_publications: { Args: never; Returns: Json }
      list_article_lifecycle_events: {
        Args: { p_article_id: string; p_limit?: number }
        Returns: {
          action: string
          actor_id: string
          actor_label: string
          article_id: string
          created_at: string
          id: string
          metadata: Json
          note: string
          prior_status: string
          resulting_status: string
          version_id: string
          version_number: number
        }[]
      }
      list_article_trust_sources: { Args: { p_limit?: number }; Returns: Json }
      list_article_versions: {
        Args: { p_article_id: string; p_limit?: number }
        Returns: {
          author: string
          categories: Json
          content_fingerprint: string
          content_html: string
          created_at: string
          created_by: string
          excerpt: string
          hero_image_url: string
          id: string
          lifecycle_state: string
          published_at: string
          revision_number: number
          seo: Json
          slug: string
          tags: Json
          title: string
          version_kind: string
          wp_status: string
        }[]
      }
      list_audio_trust_attachment_candidates: { Args: never; Returns: Json }
      list_correction_case_events: {
        Args: {
          p_after_event_number?: number
          p_case_resource_id: string
          p_limit?: number
        }
        Returns: {
          actor_id: string
          case_revision_after: number
          case_revision_before: number
          command_receipt_id: string
          correlation_id: string
          created_at: string
          decision_id: string
          event_id: string
          event_number: number
          event_type: string
          evidence_link_id: string
          metadata: Json
          prior_state: string
          reason: string
          related_resource_review_id: string
          resulting_state: string
          target_id: string
        }[]
      }
      list_correction_cases: {
        Args: {
          p_assigned_investigator_id?: string
          p_case_state?: string
          p_limit?: number
          p_offset?: number
        }
        Returns: {
          assigned_investigator_id: string
          case_reference: string
          case_resource_id: string
          case_state: string
          closed_at: string
          correction_kind: string
          created_at: string
          current_decision_outcome: string
          current_revision: number
          origin_type: string
          primary_target_resource_kind: string
          primary_target_summary: string
          priority: string
          updated_at: string
        }[]
      }
      list_editorial_credit_picker_options: {
        Args: { p_limit?: number; p_query?: string }
        Returns: Json
      }
      list_media_assets_v2: {
        Args: {
          p_asset_kind?: string
          p_asset_purpose?: string
          p_lifecycle_state?: string
          p_limit?: number
          p_offset?: number
          p_search?: string
        }
        Returns: {
          active_usage_count: number
          asset_id: string
          asset_kind: string
          asset_purpose: string
          authority_revision: number
          consent_status: string
          created_at: string
          current_file_object_id: string
          current_file_verification_state: string
          current_mime_type: string
          current_revision_id: string
          current_revision_number: number
          governance_version_id: string
          internal_reason: string
          legacy_asset_id: string
          lifecycle_state: string
          public_safety_state: string
          rights_status: string
          sensitivity: string
          title: string
          updated_at: string
        }[]
      }
      list_my_personal_playlists: {
        Args: { p_include_archived?: boolean; p_limit?: number }
        Returns: {
          authority_revision: number
          created_at: string
          description: string
          item_count: number
          lifecycle_status: string
          playlist_id: string
          slug: string
          title: string
          updated_at: string
          visibility: string
        }[]
      }
      list_public_article_author_organization_paths: {
        Args: { p_article_slug?: string }
        Returns: {
          article_id: string
          article_slug: string
          author_organization_id: string
          author_organization_path: string
        }[]
      }
      list_public_article_author_paths: {
        Args: { p_article_slug?: string }
        Returns: {
          article_id: string
          article_slug: string
          author_person_id: string
          author_person_path: string
        }[]
      }
      list_public_organization_work: {
        Args: {
          p_before_published_at?: string
          p_before_resource_id?: string
          p_limit?: number
          p_organization_resource_id: string
        }
        Returns: {
          byline: string
          canonical_path: string
          credit_role: string
          image_url: string
          is_primary: boolean
          published_at: string
          resource_id: string
          resource_kind: string
          role_label: string
          summary: string
          title: string
        }[]
      }
      list_public_person_community_activity: {
        Args: {
          p_activity_kind?: string
          p_limit?: number
          p_person_resource_id: string
        }
        Returns: {
          anchor_end_time_ms: number
          anchor_label: string
          anchor_time_ms: number
          anchor_type: string
          author_id: string
          body_html: string
          body_markdown: string
          body_plain: string
          context_entity_id: string
          context_entity_slug: string
          context_entity_type: string
          context_label: string
          created_at: string
          deleted_at: string
          depth: number
          downvote_count: number
          edited_at: string
          id: string
          is_editor_pick: boolean
          is_pinned: boolean
          parent_id: string
          path: string
          reaction_count: number
          reply_count: number
          report_count: number
          root_id: string
          score: number
          status: string
          thread_entity_id: string
          thread_entity_slug: string
          thread_entity_type: string
          thread_entity_url: string
          thread_id: string
          thread_title: string
          updated_at: string
          upvote_count: number
        }[]
      }
      list_public_person_work: {
        Args: {
          p_before_published_at?: string
          p_before_resource_id?: string
          p_limit?: number
          p_person_resource_id: string
        }
        Returns: {
          canonical_path: string
          image_url: string
          is_primary: boolean
          published_at: string
          resource_id: string
          resource_kind: string
          roles: Json
          summary: string
          title: string
        }[]
      }
      list_public_personal_playlists_for_username: {
        Args: { p_limit?: number; p_username: string }
        Returns: {
          authority_revision: number
          created_at: string
          description: string
          item_count: number
          lifecycle_status: string
          playlist_id: string
          slug: string
          title: string
          updated_at: string
          visibility: string
        }[]
      }
      list_public_playlists: {
        Args: {
          p_before_published_at?: string
          p_before_snapshot_id?: string
          p_limit?: number
        }
        Returns: {
          cover_alt_text: string
          cover_url: string
          curator_label: string
          description: string
          first_published_at: string
          item_count: number
          playlist_id: string
          published_at: string
          resource_id: string
          slug: string
          snapshot_id: string
          title: string
          version_id: string
        }[]
      }
      list_publishing_assignable_users: {
        Args: never
        Returns: {
          email: string
          label: string
          role_labels: string[]
          user_id: string
        }[]
      }
      list_publishing_item_events: {
        Args: {
          p_before_created_at?: string
          p_before_event_id?: string
          p_item_id: string
          p_limit?: number
        }
        Returns: {
          action: string
          actor_id: string
          actor_label: string
          assignment_role: string
          changed_fields: string[]
          channel_is_primary: boolean
          channel_key: string
          channel_label: string
          created_at: string
          event_id: string
          item_id: string
          note: string
          previous_primary_channel_key: string
          previous_primary_channel_label: string
          prior_planning_state: string
          prior_production_stage: string
          prior_record_version: number
          resource_id: string
          resulting_planning_state: string
          resulting_production_stage: string
          resulting_record_version: number
          subject_user_id: string
          subject_user_label: string
        }[]
      }
      mark_article_suggestion_stale: {
        Args: { p_note?: string; p_suggestion_id: string }
        Returns: {
          decided_at: string
          decision_status: string
          suggestion_id: string
        }[]
      }
      merge_people: {
        Args: {
          p_correlation_id?: string
          p_expected_source_identity_revision: number
          p_expected_target_identity_revision: number
          p_idempotency_key: string
          p_reason: string
          p_source_person_resource_id: string
          p_target_person_resource_id: string
        }
        Returns: {
          command_receipt_id: string
          idempotent_replay: boolean
          merge_event_id: string
          receipt_status: string
          result_payload: Json
          source_identity_revision: number
          source_person_resource_id: string
          target_identity_revision: number
          target_person_resource_id: string
        }[]
      }
      merge_registry_relationship_duplicate: {
        Args: {
          p_duplicate_relationship_id: string
          p_reason: string
          p_survivor_relationship_id: string
        }
        Returns: {
          confidence: number | null
          created_at: string
          created_by: string | null
          id: string
          metadata: Json
          plain_reason: string | null
          public_safe: boolean
          relationship_role: string | null
          relationship_status: string
          relationship_type: string
          review_note: string | null
          review_status: string
          reviewed_at: string | null
          reviewed_by: string | null
          sort_order: number | null
          source_entity: string | null
          source_entity_id: string | null
          source_entity_type: string
          source_kind: string | null
          source_record_id: string | null
          source_slug: string
          source_staging_record_id: string | null
          status_reason: string | null
          superseded_by_relationship_id: string | null
          target_entity_id: string | null
          target_entity_type: string
          target_slug: string
          updated_at: string
          updated_by: string | null
          valid_from: string | null
          valid_to: string | null
        }
        SetofOptions: {
          from: "*"
          to: "registry_entity_relationships"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      move_playlist_pending_registry_intake: {
        Args: {
          p_correlation_id?: string
          p_direction: string
          p_expected_authority_revision: number
          p_idempotency_key: string
          p_playlist_id: string
          p_suggestion_id: string
        }
        Returns: Json
      }
      normalize_registry_relationship_vocabulary: {
        Args: {
          p_reason?: string
          p_relationship_id: string
          p_relationship_role?: string
          p_relationship_type: string
        }
        Returns: {
          confidence: number | null
          created_at: string
          created_by: string | null
          id: string
          metadata: Json
          plain_reason: string | null
          public_safe: boolean
          relationship_role: string | null
          relationship_status: string
          relationship_type: string
          review_note: string | null
          review_status: string
          reviewed_at: string | null
          reviewed_by: string | null
          sort_order: number | null
          source_entity: string | null
          source_entity_id: string | null
          source_entity_type: string
          source_kind: string | null
          source_record_id: string | null
          source_slug: string
          source_staging_record_id: string | null
          status_reason: string | null
          superseded_by_relationship_id: string | null
          target_entity_id: string | null
          target_entity_type: string
          target_slug: string
          updated_at: string
          updated_by: string | null
          valid_from: string | null
          valid_to: string | null
        }
        SetofOptions: {
          from: "*"
          to: "registry_entity_relationships"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      promote_artist_split_relationship: {
        Args: { p_staging_record_id: string }
        Returns: Json
      }
      promote_track_lyrics_contribution_to_draft: {
        Args: {
          p_contribution_id: string
          p_expected_authority_revision: number
        }
        Returns: Json
      }
      public_get_article_correction_notes: {
        Args: { p_slug: string }
        Returns: {
          article_id: string
          article_resource_id: string
          case_reference: string
          challenged_version_id: string
          corrected_version_id: string
          correction_note_id: string
          note_published_at: string
          note_text: string
        }[]
      }
      public_get_article_trust: {
        Args: { p_article_slug: string }
        Returns: Json
      }
      public_get_articles_by_term: {
        Args: {
          p_page?: number
          p_page_size?: number
          p_taxonomy: string
          p_term_name: string
        }
        Returns: {
          author: string
          categories: Json
          excerpt: string
          hero_image_url: string
          id: string
          published_at: string
          slug: string
          tags: Json
          title: string
          total_count: number
        }[]
      }
      public_get_taxonomy_index:
        | {
            Args: { p_taxonomy: string }
            Returns: {
              article_count: number
              description: string
              id: string
              name: string
              seo_description: string
              seo_keywords: string
              seo_title: string
              slug: string
            }[]
          }
        | {
            Args: { p_limit?: number; p_offset?: number; p_taxonomy: string }
            Returns: {
              article_count: number
              description: string
              id: string
              name: string
              seo_description: string
              seo_keywords: string
              seo_title: string
              slug: string
            }[]
          }
      public_get_taxonomy_term: {
        Args: { p_slug: string; p_taxonomy: string }
        Returns: {
          article_count: number
          description: string
          id: string
          name: string
          seo_description: string
          seo_keywords: string
          seo_title: string
          slug: string
        }[]
      }
      publish_article_version: {
        Args: {
          p_article_id: string
          p_note?: string
          p_published_at?: string
          p_version_id?: string
        }
        Returns: {
          article_id: string
          article_slug: string
          draft_version: number
          lifecycle_status: string
          version_id: string
          version_number: number
        }[]
      }
      publish_audio_publication_version: {
        Args: {
          p_approved_version_id: string
          p_correlation_id?: string
          p_expected_authority_revision: number
          p_idempotency_key: string
          p_note?: string
          p_publication_id: string
        }
        Returns: {
          authority_revision: number
          command_receipt_id: string
          idempotent_replay: boolean
          lifecycle_status: string
          publication_id: string
          publication_snapshot_id: string
          receipt_status: string
          resource_id: string
          result_payload: Json
          version_id: string
          version_number: number
        }[]
      }
      publish_correction_note: {
        Args: {
          p_case_resource_id: string
          p_contributor_follow_up_disposition: string
          p_contributor_follow_up_reason: string
          p_correlation_id: string
          p_expected_case_revision: number
          p_expected_current_application_id: string
          p_expected_current_published_article_version_id: string
          p_idempotency_key: string
          p_note_text: string
          p_supersedes_note_id: string
        }
        Returns: {
          case_resource_id: string
          case_revision: number
          command_receipt_id: string
          idempotent_replay: boolean
          receipt_status: string
          result_payload: Json
        }[]
      }
      publish_due_article_publications: {
        Args: { p_limit?: number }
        Returns: {
          article_id: string
          article_slug: string
          published_at: string
          schedule_id: string
          status: string
          version_id: string
        }[]
      }
      publish_due_playlist_publications: {
        Args: { p_limit?: number }
        Returns: {
          playlist_id: string
          playlist_slug: string
          published_at: string
          schedule_id: string
          status: string
          version_id: string
        }[]
      }
      publish_playlist_version: {
        Args: {
          p_approved_version_id: string
          p_correlation_id?: string
          p_expected_authority_revision: number
          p_idempotency_key: string
          p_note?: string
          p_playlist_id: string
        }
        Returns: {
          authority_revision: number
          command_receipt_id: string
          idempotent_replay: boolean
          lifecycle_status: string
          playlist_id: string
          receipt_status: string
          resource_id: string
          result_payload: Json
          version_id: string
          version_number: number
        }[]
      }
      publish_track_lyrics_version: {
        Args: {
          p_expected_authority_revision: number
          p_track_id: string
          p_version_id: string
        }
        Returns: Json
      }
      purge_staging_records: {
        Args: { batch_size?: number; max_batches?: number }
        Returns: number
      }
      read_media_assets_admin_v2: { Args: { p_query?: Json }; Returns: Json }
      read_media_maintenance_manifest_v1: { Args: never; Returns: Json }
      rebuild_discography_from_metadata: { Args: never; Returns: string }
      record_admin_audit: {
        Args: {
          event_type: string
          message?: string
          metadata?: Json
          target_record_id?: string
          target_table?: string
          target_user_id?: string
        }
        Returns: string
      }
      record_artist_music_submission_validation: {
        Args: {
          p_artist_id: string
          p_expires_at: string
          p_playback_kind: string
          p_provider_artist_names: string[]
          p_provider_key: string
          p_provider_object_id: string
          p_provider_release_title: string
          p_provider_title: string
          p_provider_url: string
          p_requested_by: string
          p_validation_snapshot: Json
        }
        Returns: string
      }
      record_correction_decision: {
        Args: {
          p_case_resource_id: string
          p_correlation_id: string
          p_duplicate_of_case_resource_id: string
          p_expected_case_revision: number
          p_idempotency_key: string
          p_outcome: string
          p_private_analysis: string
          p_public_safe_explanation: string
          p_reason: string
          p_target_state_observed: Json
        }
        Returns: {
          case_resource_id: string
          case_revision: number
          command_receipt_id: string
          idempotent_replay: boolean
          receipt_status: string
          result_payload: Json
        }[]
      }
      record_password_reset_admin: {
        Args: {
          delivery_status?: string
          message?: string
          redirect_to?: string
          target_email: string
          target_user_id: string
        }
        Returns: string
      }
      record_playlist_playback_probe_candidate: {
        Args: {
          p_artist_names_hint: string[]
          p_artwork_url: string
          p_canonical_url: string
          p_correlation_id: string
          p_embed_url: string
          p_expires_at: string
          p_playback_kind: string
          p_playlist_id: string
          p_provider_key: string
          p_provider_metadata: Json
          p_provider_object_id: string
          p_provider_url: string
          p_requested_by: string
          p_title_hint: string
        }
        Returns: string
      }
      record_playlist_playback_validation: {
        Args: {
          p_artist_names_hint: string[]
          p_artwork_url: string
          p_canonical_url: string
          p_correlation_id: string
          p_embed_url: string
          p_expires_at: string
          p_playback_kind: string
          p_playlist_id: string
          p_preview_url: string
          p_provider_key: string
          p_provider_metadata: Json
          p_provider_object_id: string
          p_provider_url: string
          p_release_title_hint: string
          p_requested_by: string
          p_title_hint: string
        }
        Returns: string
      }
      recover_expired_media_processing_jobs_v1: {
        Args: { p_limit?: number; p_retry_delay_seconds?: number }
        Returns: number
      }
      register_audio_delivery_processing_outputs_v1: {
        Args: { p_job_id: string; p_outputs: Json; p_worker_id: string }
        Returns: Json
      }
      register_media_file_object: {
        Args: {
          p_byte_size?: number
          p_correlation_id?: string
          p_delivery_url: string
          p_mime_type?: string
          p_original_filename: string
          p_storage_namespace: string
          p_storage_path: string
          p_storage_provider: string
          p_technical_metadata?: Json
        }
        Returns: {
          correlation_id: string
          file_object_id: string
          verification_state: string
        }[]
      }
      register_media_processing_outputs_v1: {
        Args: { p_job_id: string; p_outputs: Json; p_worker_id: string }
        Returns: Json
      }
      register_media_variant: {
        Args: {
          p_asset_id: string
          p_asset_revision_id: string
          p_correlation_id?: string
          p_derived_file_object_id: string
          p_generator_name?: string
          p_generator_version?: string
          p_source_file_object_id: string
          p_technical_metadata?: Json
          p_transformation_spec?: Json
          p_variant_role: string
        }
        Returns: {
          correlation_id: string
          variant_id: string
        }[]
      }
      registry_get_public_track_playback_providers: {
        Args: { p_provider_key?: string; p_track_ids: string[] }
        Returns: {
          artwork_url: string
          duration_ms: number
          isrc: string
          last_checked_at: string
          match_confidence: number
          match_method: string
          preview_url: string
          provider_key: string
          provider_release_id: string
          provider_track_id: string
          storefront: string
          track_id: string
          upc: string
        }[]
      }
      registry_get_track_provider_links: {
        Args: {
          p_isrc?: string
          p_limit?: number
          p_provider_key?: string
          p_provider_track_id?: string
          p_track_id?: string
        }
        Returns: {
          artwork_url: string
          created_at: string
          duration_ms: number
          id: string
          isrc: string
          last_checked_at: string
          match_confidence: number
          match_method: string
          match_status: string
          preview_url: string
          provider_artist_ids: string[]
          provider_key: string
          provider_release_id: string
          provider_track_id: string
          raw_payload: Json
          storefront: string
          track_id: string
          upc: string
          updated_at: string
        }[]
      }
      registry_resolve_artist_slug_for_public: {
        Args: { p_slug: string }
        Returns: {
          canonical_artist_id: string
          canonical_display_name: string
          canonical_slug: string
          input_slug: string
          resolved_via: string
        }[]
      }
      registry_upsert_track_provider_link: {
        Args: {
          p_artwork_url?: string
          p_duration_ms?: number
          p_isrc?: string
          p_match_confidence?: number
          p_match_method?: string
          p_match_status?: string
          p_preview_url?: string
          p_provider_artist_ids?: string[]
          p_provider_key: string
          p_provider_release_id?: string
          p_provider_track_id: string
          p_raw_payload?: Json
          p_storefront?: string
          p_track_id: string
          p_upc?: string
        }
        Returns: Json
      }
      reject_article_suggestion: {
        Args: { p_note?: string; p_suggestion_id: string }
        Returns: {
          decided_at: string
          decision_status: string
          suggestion_id: string
        }[]
      }
      reject_track_lyrics_contribution: {
        Args: { p_contribution_id: string; p_review_note?: string }
        Returns: Json
      }
      remove_personal_playlist_item: {
        Args: {
          p_correlation_id?: string
          p_expected_authority_revision: number
          p_idempotency_key?: string
          p_playlist_id: string
          p_playlist_item_id: string
        }
        Returns: {
          authority_revision: number
          playlist_id: string
          playlist_item_id: string
          receipt_id: string
          receipt_status: string
          result_payload: Json
        }[]
      }
      remove_playlist_item: {
        Args: {
          p_correlation_id?: string
          p_expected_authority_revision: number
          p_idempotency_key: string
          p_playlist_id: string
          p_playlist_item_id: string
        }
        Returns: {
          authority_revision: number
          command_receipt_id: string
          idempotent_replay: boolean
          playlist_id: string
          playlist_item_id: string
          receipt_status: string
          resource_id: string
          result_payload: Json
        }[]
      }
      remove_playlist_item_with_intake_slots: {
        Args: {
          p_correlation_id?: string
          p_expected_authority_revision: number
          p_idempotency_key: string
          p_playlist_id: string
          p_playlist_item_id: string
        }
        Returns: Json
      }
      remove_publishing_item_assignee: {
        Args: {
          p_assignment_role: string
          p_expected_record_version: number
          p_item_id: string
          p_note?: string
          p_user_id: string
        }
        Returns: {
          item_id: string
          record_version: number
        }[]
      }
      remove_publishing_item_channel: {
        Args: {
          p_channel_key: string
          p_expected_record_version: number
          p_item_id: string
          p_note?: string
        }
        Returns: {
          item_id: string
          record_version: number
        }[]
      }
      renew_media_processing_lease_v1: {
        Args: {
          p_job_id: string
          p_lease_seconds?: number
          p_worker_id: string
        }
        Returns: string
      }
      reopen_correction_case: {
        Args: {
          p_case_resource_id: string
          p_correlation_id: string
          p_expected_case_revision: number
          p_idempotency_key: string
          p_reason: string
        }
        Returns: {
          case_resource_id: string
          case_revision: number
          command_receipt_id: string
          idempotent_replay: boolean
          receipt_status: string
          result_payload: Json
        }[]
      }
      reorder_personal_playlist_items: {
        Args: {
          p_correlation_id?: string
          p_expected_authority_revision: number
          p_idempotency_key?: string
          p_ordered_item_ids: string[]
          p_playlist_id: string
        }
        Returns: {
          authority_revision: number
          playlist_id: string
          receipt_id: string
          receipt_status: string
          result_payload: Json
        }[]
      }
      reorder_playlist_items: {
        Args: {
          p_correlation_id?: string
          p_expected_authority_revision: number
          p_idempotency_key: string
          p_ordered_item_ids: string[]
          p_playlist_id: string
        }
        Returns: {
          authority_revision: number
          command_receipt_id: string
          idempotent_replay: boolean
          playlist_id: string
          receipt_status: string
          resource_id: string
          result_payload: Json
        }[]
      }
      reorder_playlist_items_with_intake_slots: {
        Args: {
          p_correlation_id?: string
          p_expected_authority_revision: number
          p_idempotency_key: string
          p_ordered_item_ids: string[]
          p_playlist_id: string
        }
        Returns: Json
      }
      replace_article_version_citations: {
        Args: {
          p_article_version_id: string
          p_attachments: Json
          p_correlation_id?: string
          p_expected_citation_revision: number
        }
        Returns: Json
      }
      replace_article_version_credits: {
        Args: {
          p_article_version_id: string
          p_attachments: Json
          p_correlation_id?: string
          p_expected_credit_revision: number
        }
        Returns: Json
      }
      replace_audio_publication_chapters: {
        Args: {
          p_chapters: Json
          p_correlation_id?: string
          p_expected_authority_revision: number
          p_idempotency_key: string
          p_publication_id: string
        }
        Returns: {
          authority_revision: number
          chapter_count: number
          command_receipt_id: string
          idempotent_replay: boolean
          publication_id: string
          receipt_status: string
          resource_id: string
          result_payload: Json
        }[]
      }
      replace_audio_publication_version_citations: {
        Args: {
          p_attachments: Json
          p_correlation_id?: string
          p_expected_citation_revision: number
          p_idempotency_key: string
          p_publication_version_id: string
        }
        Returns: {
          attachment_count: number
          citation_revision: number
          command_receipt_id: string
          idempotent_replay: boolean
          publication_version_id: string
          receipt_status: string
          result_payload: Json
        }[]
      }
      replace_audio_publication_version_credits: {
        Args: {
          p_attachments: Json
          p_correlation_id?: string
          p_expected_credit_revision: number
          p_idempotency_key: string
          p_publication_version_id: string
        }
        Returns: {
          attachment_count: number
          command_receipt_id: string
          credit_revision: number
          idempotent_replay: boolean
          publication_version_id: string
          receipt_status: string
          result_payload: Json
        }[]
      }
      replace_media_asset_file_v2: {
        Args: {
          p_asset_id: string
          p_correlation_id?: string
          p_expected_authority_revision: number
          p_file: Json
          p_reason?: string
          p_variant?: Json
        }
        Returns: Json
      }
      replace_playlist_version_citations: {
        Args: {
          p_attachments: Json
          p_correlation_id?: string
          p_expected_citation_revision: number
          p_playlist_version_id: string
          p_target_resource_id: string
        }
        Returns: Json
      }
      replace_playlist_version_credits: {
        Args: {
          p_attachments: Json
          p_correlation_id?: string
          p_expected_credit_revision: number
          p_playlist_version_id: string
          p_target_resource_id: string
        }
        Returns: Json
      }
      request_article_changes: {
        Args: { p_article_id: string; p_note?: string; p_version_id?: string }
        Returns: {
          article_id: string
          article_slug: string
          draft_version: number
          lifecycle_status: string
          version_id: string
          version_number: number
        }[]
      }
      resolve_article_preview_nonce: {
        Args: { p_nonce: string }
        Returns: {
          author: string
          categories: Json
          content_html: string
          created_at: string
          draft_version: number
          excerpt: string
          hero_image_url: string
          id: string
          preview_expires_at: string
          published_at: string
          raw_meta: Json
          seo: Json
          slug: string
          tags: Json
          title: string
          updated_at: string
          version_id: string
          version_number: number
          wp_status: string
        }[]
      }
      resolve_editorial_credit: {
        Args: {
          p_credit_role: string
          p_party_kind: string
          p_party_resource_id: string
          p_public_safe?: boolean
        }
        Returns: Json
      }
      resolve_legacy_media_asset_lite_batch: {
        Args: { p_asset_ids?: string[]; p_urls?: string[] }
        Returns: {
          id: string
          media_kind: string
          metadata: Json
          mime_type: string
          requested_asset_id: string
          requested_url: string
          resolved_mode: string
          slug: string
          title: string
          url: string
          usage_link_id: string
        }[]
      }
      resolve_media_asset_delivery: {
        Args: {
          p_asset_id: string
          p_exact_asset_revision_id?: string
          p_requested_variant_role?: string
          p_usage_link_id?: string
        }
        Returns: {
          approved_alt_text: string
          approved_caption: string
          approved_credit: string
          duration_seconds: number
          height: number
          logical_asset_id: string
          resolved_asset_revision_id: string
          resolved_file_object_id: string
          resolved_mime_type: string
          resolved_mode: string
          safe_delivery_url: string
          width: number
        }[]
      }
      resolve_playlist_item_match: {
        Args: {
          p_correlation_id?: string
          p_expected_authority_revision: number
          p_idempotency_key: string
          p_match_confidence?: number
          p_match_status: string
          p_playlist_id: string
          p_playlist_item_id: string
          p_registry_track_id?: string
        }
        Returns: {
          authority_revision: number
          command_receipt_id: string
          idempotent_replay: boolean
          playlist_id: string
          playlist_item_id: string
          receipt_status: string
          resource_id: string
          result_payload: Json
        }[]
      }
      resolve_playlist_preview_nonce: {
        Args: { p_nonce: string }
        Returns: Json
      }
      resolve_public_registry_author_person: {
        Args: { p_slug: string }
        Returns: Json
      }
      resolve_registry_relationship_endpoint: {
        Args: {
          p_endpoint_side: string
          p_entity_id: string
          p_entity_type: string
          p_reason: string
          p_relationship_id: string
        }
        Returns: {
          confidence: number | null
          created_at: string
          created_by: string | null
          id: string
          metadata: Json
          plain_reason: string | null
          public_safe: boolean
          relationship_role: string | null
          relationship_status: string
          relationship_type: string
          review_note: string | null
          review_status: string
          reviewed_at: string | null
          reviewed_by: string | null
          sort_order: number | null
          source_entity: string | null
          source_entity_id: string | null
          source_entity_type: string
          source_kind: string | null
          source_record_id: string | null
          source_slug: string
          source_staging_record_id: string | null
          status_reason: string | null
          superseded_by_relationship_id: string | null
          target_entity_id: string | null
          target_entity_type: string
          target_slug: string
          updated_at: string
          updated_by: string | null
          valid_from: string | null
          valid_to: string | null
        }
        SetofOptions: {
          from: "*"
          to: "registry_entity_relationships"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      resolve_registry_relationship_endpoint_from_alias: {
        Args: {
          p_endpoint_side: string
          p_reason: string
          p_relationship_id: string
        }
        Returns: {
          confidence: number | null
          created_at: string
          created_by: string | null
          id: string
          metadata: Json
          plain_reason: string | null
          public_safe: boolean
          relationship_role: string | null
          relationship_status: string
          relationship_type: string
          review_note: string | null
          review_status: string
          reviewed_at: string | null
          reviewed_by: string | null
          sort_order: number | null
          source_entity: string | null
          source_entity_id: string | null
          source_entity_type: string
          source_kind: string | null
          source_record_id: string | null
          source_slug: string
          source_staging_record_id: string | null
          status_reason: string | null
          superseded_by_relationship_id: string | null
          target_entity_id: string | null
          target_entity_type: string
          target_slug: string
          updated_at: string
          updated_by: string | null
          valid_from: string | null
          valid_to: string | null
        }
        SetofOptions: {
          from: "*"
          to: "registry_entity_relationships"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      restore_article_from_archive: {
        Args: { p_article_id: string; p_note?: string }
        Returns: {
          article_id: string
          article_slug: string
          draft_version: number
          lifecycle_status: string
          version_id: string
          version_number: number
        }[]
      }
      restore_audio_publication_from_archive: {
        Args: {
          p_correlation_id?: string
          p_expected_authority_revision: number
          p_idempotency_key: string
          p_note?: string
          p_publication_id: string
        }
        Returns: {
          authority_revision: number
          command_receipt_id: string
          idempotent_replay: boolean
          lifecycle_status: string
          publication_id: string
          receipt_status: string
          resource_id: string
          result_payload: Json
          version_id: string
          version_number: number
        }[]
      }
      restore_media_asset: {
        Args: {
          p_asset_id: string
          p_correlation_id?: string
          p_expected_authority_revision: number
          p_reason: string
        }
        Returns: {
          asset_id: string
          authority_revision: number
          correlation_id: string
          lifecycle_state: string
        }[]
      }
      restore_playlist_from_archive: {
        Args: {
          p_correlation_id?: string
          p_expected_authority_revision: number
          p_idempotency_key: string
          p_note?: string
          p_playlist_id: string
        }
        Returns: {
          authority_revision: number
          command_receipt_id: string
          idempotent_replay: boolean
          lifecycle_status: string
          playlist_id: string
          receipt_status: string
          resource_id: string
          result_payload: Json
          version_id: string
          version_number: number
        }[]
      }
      restore_source: {
        Args: {
          p_correlation_id?: string
          p_reason: string
          p_source_id: string
        }
        Returns: Json
      }
      retire_account_identity: {
        Args: {
          p_correlation_id?: string
          p_expected_identity_revision: number
          p_idempotency_key: string
          p_identity_link_id: string
          p_person_resource_id: string
          p_reason: string
          p_user_id: string
        }
        Returns: {
          account_deleted: boolean
          command_receipt_id: string
          idempotent_replay: boolean
          identity_link_id: string
          identity_revision: number
          person_archived: boolean
          person_resource_id: string
          receipt_status: string
          result_payload: Json
          user_id: string
        }[]
      }
      return_correction_to_investigation: {
        Args: {
          p_case_resource_id: string
          p_correlation_id: string
          p_expected_case_revision: number
          p_idempotency_key: string
          p_reason: string
        }
        Returns: {
          case_resource_id: string
          case_revision: number
          command_receipt_id: string
          idempotent_replay: boolean
          receipt_status: string
          result_payload: Json
        }[]
      }
      review_audio_publication: {
        Args: {
          p_correlation_id?: string
          p_decision: string
          p_expected_authority_revision: number
          p_idempotency_key: string
          p_note?: string
          p_publication_id: string
          p_submitted_version_id: string
        }
        Returns: {
          authority_revision: number
          command_receipt_id: string
          idempotent_replay: boolean
          lifecycle_status: string
          publication_id: string
          receipt_status: string
          resource_id: string
          result_payload: Json
          version_id: string
          version_number: number
        }[]
      }
      review_evidence_item: {
        Args: {
          p_decision: string
          p_decision_note?: string
          p_evidence_id: string
          p_next_retrieval_status: string
          p_next_review_status: string
        }
        Returns: {
          confidence: string
          created_at: string
          created_by: string | null
          evidence_type: string
          id: string
          main_claim: string | null
          reliability: string
          retrieval_status: string
          review_status: string
          reviewed_at: string | null
          reviewed_by: string | null
          source_file: string | null
          source_note: string | null
          source_url: string | null
          summary: string
          title: string
          updated_at: string
          why_it_matters: string | null
        }
        SetofOptions: {
          from: "*"
          to: "evidence_items"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      review_playlist: {
        Args: {
          p_correlation_id?: string
          p_decision: string
          p_expected_authority_revision: number
          p_idempotency_key: string
          p_note?: string
          p_playlist_id: string
          p_submitted_version_id: string
        }
        Returns: {
          authority_revision: number
          command_receipt_id: string
          idempotent_replay: boolean
          lifecycle_status: string
          playlist_id: string
          receipt_status: string
          resource_id: string
          result_payload: Json
          version_id: string
          version_number: number
        }[]
      }
      review_registry_cultural_entity: {
        Args: {
          p_entity_id: string
          p_next_review_status: string
          p_next_status: string
          p_public_safe: boolean
          p_reason: string
        }
        Returns: {
          canonical_source_id: string | null
          canonical_source_table: string | null
          created_at: string
          description: string | null
          entity_type: string
          id: string
          metadata: Json
          name: string
          public_safe: boolean
          review_note: string | null
          review_status: string
          reviewed_at: string | null
          reviewed_by: string | null
          slug: string | null
          source_id: string | null
          source_table: string | null
          status: string
          updated_at: string
        }
        SetofOptions: {
          from: "*"
          to: "cultural_entities"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      review_registry_relationship: {
        Args: {
          p_next_review_status: string
          p_public_safe: boolean
          p_reason: string
          p_relationship_id: string
        }
        Returns: {
          confidence: number | null
          created_at: string
          created_by: string | null
          id: string
          metadata: Json
          plain_reason: string | null
          public_safe: boolean
          relationship_role: string | null
          relationship_status: string
          relationship_type: string
          review_note: string | null
          review_status: string
          reviewed_at: string | null
          reviewed_by: string | null
          sort_order: number | null
          source_entity: string | null
          source_entity_id: string | null
          source_entity_type: string
          source_kind: string | null
          source_record_id: string | null
          source_slug: string
          source_staging_record_id: string | null
          status_reason: string | null
          superseded_by_relationship_id: string | null
          target_entity_id: string | null
          target_entity_type: string
          target_slug: string
          updated_at: string
          updated_by: string | null
          valid_from: string | null
          valid_to: string | null
        }
        SetofOptions: {
          from: "*"
          to: "registry_entity_relationships"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      review_source_version: {
        Args: {
          p_correlation_id?: string
          p_decision: string
          p_exposure_class?: string
          p_reason?: string
          p_source_id: string
          p_source_version_id: string
        }
        Returns: Json
      }
      review_track_lyrics_contribution: {
        Args: {
          p_acceptance_mode: string
          p_contribution_id: string
          p_expected_authority_revision: number
          p_language_code: string
          p_lines: Json
          p_review_note?: string
          p_timing_mode: string
        }
        Returns: Json
      }
      revoke_user_role_admin: {
        Args: { target_role_key: string; target_user_id: string }
        Returns: boolean
      }
      revoke_user_scope_admin: { Args: { scope_id: string }; Returns: boolean }
      rpc_get_chart_programs: { Args: never; Returns: Json }
      rpc_get_ingest_run: { Args: { run_id: string }; Returns: Json }
      rpc_get_ingest_runs: { Args: { limit_count?: number }; Returns: Json }
      run_artist_intake_matching: {
        Args: { p_intake_run_id: string }
        Returns: Json
      }
      save_article_versioned: {
        Args: {
          p_article_id: string
          p_expected_draft_version: number
          p_payload: Json
          p_taxonomy_term_ids?: string[]
          p_version_kind?: string
        }
        Returns: {
          article_id: string
          article_slug: string
          draft_version: number
          version_id: string
          version_number: number
        }[]
      }
      save_playlist_item_note: {
        Args: {
          p_correlation_id?: string
          p_expected_authority_revision: number
          p_idempotency_key: string
          p_note: string
          p_playlist_id: string
          p_playlist_item_id: string
        }
        Returns: {
          authority_revision: number
          command_receipt_id: string
          idempotent_replay: boolean
          playlist_id: string
          playlist_item_id: string
          receipt_status: string
          resource_id: string
          result_payload: Json
        }[]
      }
      save_playlist_pending_registry_note: {
        Args: {
          p_correlation_id?: string
          p_expected_authority_revision: number
          p_idempotency_key: string
          p_note: string
          p_playlist_id: string
          p_suggestion_id: string
        }
        Returns: Json
      }
      save_resource_version_editorial_metadata: {
        Args: {
          p_category_ids: string[]
          p_correlation_id?: string
          p_expected_metadata_revision: number
          p_focus_keyword: string
          p_idempotency_key: string
          p_seo_description: string
          p_seo_keywords: string[]
          p_seo_title: string
          p_tag_ids: string[]
          p_target_version_id: string
          p_target_version_type: string
        }
        Returns: {
          command_receipt_id: string
          error_code: string
          error_message: string
          idempotent_replay: boolean
          metadata_revision: number
          receipt_status: string
          resource_id: string
          result_payload: Json
          target_version_id: string
        }[]
      }
      save_source_version: {
        Args: {
          p_correlation_id?: string
          p_expected_working_revision: number
          p_metadata: Json
          p_reason?: string
          p_registry_links?: Json
          p_source_id: string
        }
        Returns: Json
      }
      save_track_lyrics_draft: {
        Args: {
          p_expected_authority_revision: number
          p_language_code: string
          p_lines: Json
          p_rights_note?: string
          p_source_kind?: string
          p_timing_mode: string
          p_track_id: string
        }
        Returns: Json
      }
      schedule_article_publication: {
        Args: {
          p_article_id: string
          p_note?: string
          p_publish_at?: string
          p_version_id?: string
        }
        Returns: {
          article_id: string
          article_slug: string
          draft_version: number
          lifecycle_status: string
          version_id: string
          version_number: number
        }[]
      }
      schedule_playlist_publication: {
        Args: {
          p_approved_version_id: string
          p_correlation_id?: string
          p_expected_authority_revision: number
          p_idempotency_key: string
          p_note?: string
          p_playlist_id: string
          p_publish_at: string
        }
        Returns: {
          authority_revision: number
          command_receipt_id: string
          idempotent_replay: boolean
          lifecycle_status: string
          playlist_id: string
          receipt_status: string
          resource_id: string
          result_payload: Json
          version_id: string
          version_number: number
        }[]
      }
      search_admin_track_lyrics_tracks: {
        Args: { p_limit?: number; p_query?: string }
        Returns: Json
      }
      seed_taxonomy_terms_from_articles: {
        Args: never
        Returns: {
          article_count: number
          taxonomy: string
          term_name: string
          term_slug: string
        }[]
      }
      set_audio_publication_master: {
        Args: {
          p_asset_id: string
          p_asset_revision_id: string
          p_correlation_id?: string
          p_expected_authority_revision: number
          p_idempotency_key: string
          p_publication_id: string
        }
        Returns: {
          audio_delivery_variant_id: string
          authority_revision: number
          command_receipt_id: string
          idempotent_replay: boolean
          master_media_asset_id: string
          master_media_revision_id: string
          master_usage_link_id: string
          publication_id: string
          receipt_status: string
          resource_id: string
          result_payload: Json
        }[]
      }
      set_audio_publication_transcript: {
        Args: {
          p_asset_id: string
          p_asset_revision_id: string
          p_correlation_id?: string
          p_expected_authority_revision: number
          p_idempotency_key: string
          p_publication_id: string
        }
        Returns: {
          authority_revision: number
          command_receipt_id: string
          idempotent_replay: boolean
          publication_id: string
          receipt_status: string
          resource_id: string
          result_payload: Json
          transcript_media_asset_id: string
          transcript_media_revision_id: string
          transcript_usage_link_id: string
        }[]
      }
      set_audio_review_thread_status: {
        Args: { p_status: string; p_thread_id: string }
        Returns: Json
      }
      set_credit_governance: {
        Args: {
          p_credit_id: string
          p_credit_state: string
          p_expected_governance_revision: number
          p_public_safe: boolean
          p_reason?: string
        }
        Returns: Json
      }
      set_playlist_cover: {
        Args: {
          p_alt_text_snapshot?: string
          p_asset_id: string
          p_caption_snapshot?: string
          p_correlation_id?: string
          p_credit_snapshot?: string
          p_expected_authority_revision: number
          p_idempotency_key: string
          p_placement_data?: Json
          p_playlist_id: string
        }
        Returns: {
          authority_revision: number
          command_receipt_id: string
          cover_asset_id: string
          cover_asset_revision_id: string
          cover_url: string
          cover_usage_link_id: string
          idempotent_replay: boolean
          playlist_id: string
          receipt_status: string
          resource_id: string
          result_payload: Json
        }[]
      }
      set_playlist_curator: {
        Args: {
          p_correlation_id?: string
          p_expected_authority_revision: number
          p_idempotency_key: string
          p_playlist_id: string
          p_registry_author_id: string
          p_user_id: string
        }
        Returns: {
          authority_revision: number
          command_receipt_id: string
          curator_credit_id: string
          curator_label: string
          idempotent_replay: boolean
          lifecycle_status: string
          playlist_id: string
          receipt_status: string
          resource_id: string
          result_payload: Json
        }[]
      }
      set_publishing_item_primary_channel: {
        Args: {
          p_channel_key: string
          p_expected_record_version: number
          p_item_id: string
          p_note?: string
        }
        Returns: {
          item_id: string
          record_version: number
        }[]
      }
      set_related_resource_disposition: {
        Args: {
          p_case_resource_id: string
          p_correlation_id: string
          p_disposition: string
          p_expected_case_revision: number
          p_expected_review_revision: number
          p_idempotency_key: string
          p_linked_correction_case_resource_id: string
          p_reason: string
          p_related_resource_review_id: string
        }
        Returns: {
          case_resource_id: string
          case_revision: number
          command_receipt_id: string
          idempotent_replay: boolean
          receipt_status: string
          result_payload: Json
        }[]
      }
      show_limit: { Args: never; Returns: number }
      show_trgm: { Args: { "": string }; Returns: string[] }
      signal_os_label_for_score: { Args: { p_score: number }; Returns: string }
      signal_os_path_from_url: { Args: { p_page_url: string }; Returns: string }
      signal_os_slug_from_path: {
        Args: { p_page_url: string }
        Returns: string
      }
      snapshot_audio_publication_working_version: {
        Args: {
          p_correlation_id?: string
          p_expected_authority_revision: number
          p_idempotency_key: string
          p_publication_id: string
        }
        Returns: {
          authority_revision: number
          command_receipt_id: string
          idempotent_replay: boolean
          publication_id: string
          receipt_status: string
          resource_id: string
          resource_kind: string
          result_payload: Json
          version_id: string
          version_number: number
        }[]
      }
      snapshot_playlist_working_version: {
        Args: {
          p_correlation_id?: string
          p_expected_authority_revision: number
          p_idempotency_key: string
          p_playlist_id: string
        }
        Returns: {
          authority_revision: number
          command_receipt_id: string
          idempotent_replay: boolean
          lifecycle_status: string
          playlist_id: string
          receipt_status: string
          resource_id: string
          result_payload: Json
          version_id: string
          version_number: number
        }[]
      }
      soundex: { Args: { "": string }; Returns: string }
      split_multi_release_tracks: {
        Args: never
        Returns: {
          result: Json
        }[]
      }
      submit_article_for_review: {
        Args: {
          p_article_id: string
          p_expected_draft_version: number
          p_note?: string
        }
        Returns: {
          article_id: string
          article_slug: string
          draft_version: number
          lifecycle_status: string
          version_id: string
          version_number: number
        }[]
      }
      submit_audio_delivery_processing_v1: {
        Args: {
          p_asset_id: string
          p_asset_revision_id: string
          p_correlation_id?: string
          p_idempotency_key: string
        }
        Returns: {
          accepted_event_id: string
          command_receipt_id: string
          idempotent_replay: boolean
          job_id: string
          receipt_status: string
        }[]
      }
      submit_audio_publication_for_review: {
        Args: {
          p_correlation_id?: string
          p_expected_authority_revision: number
          p_idempotency_key: string
          p_note?: string
          p_publication_id: string
        }
        Returns: {
          authority_revision: number
          command_receipt_id: string
          idempotent_replay: boolean
          lifecycle_status: string
          publication_id: string
          receipt_status: string
          resource_id: string
          result_payload: Json
          version_id: string
          version_number: number
        }[]
      }
      submit_correction_for_decision: {
        Args: {
          p_case_resource_id: string
          p_correlation_id: string
          p_expected_case_revision: number
          p_idempotency_key: string
          p_reason: string
        }
        Returns: {
          case_resource_id: string
          case_revision: number
          command_receipt_id: string
          idempotent_replay: boolean
          receipt_status: string
          result_payload: Json
        }[]
      }
      submit_media_processing_command_v1: {
        Args: {
          p_asset_id: string
          p_asset_revision_id: string
          p_correlation_id?: string
          p_idempotency_key: string
          p_profile_version: string
        }
        Returns: {
          accepted_event_id: string
          command_receipt_id: string
          idempotent_replay: boolean
          job_id: string
          receipt_status: string
        }[]
      }
      submit_playlist_for_review: {
        Args: {
          p_correlation_id?: string
          p_expected_authority_revision: number
          p_idempotency_key: string
          p_note?: string
          p_playlist_id: string
        }
        Returns: {
          authority_revision: number
          command_receipt_id: string
          idempotent_replay: boolean
          lifecycle_status: string
          playlist_id: string
          receipt_status: string
          resource_id: string
          result_payload: Json
          version_id: string
          version_number: number
        }[]
      }
      submit_playlist_registry_intake: {
        Args: {
          p_artist_credits: Json
          p_correlation_id?: string
          p_expected_authority_revision: number
          p_idempotency_key: string
          p_playlist_id: string
          p_validation_id: string
        }
        Returns: Json
      }
      submit_resource_reconciliation_command: {
        Args: {
          p_idempotency_key: string
          p_metadata?: Json
          p_reason?: string
          p_resource_id: string
        }
        Returns: {
          accepted_event_id: string
          command_receipt_id: string
          idempotent_replay: boolean
          job_id: string
          receipt_status: string
        }[]
      }
      submit_source_version_for_review: {
        Args: {
          p_correlation_id?: string
          p_expected_working_revision: number
          p_reason?: string
          p_source_id: string
          p_source_version_id: string
        }
        Returns: Json
      }
      submit_track_lyrics_contribution: {
        Args: {
          p_language_code: string
          p_lines: Json
          p_source_description?: string
          p_timing_mode: string
          p_track_id: string
        }
        Returns: Json
      }
      suspend_user_access_admin: {
        Args: { reason?: string; target_user_id: string }
        Returns: boolean
      }
      sync_registry_track_intake_artist_credits: {
        Args: { p_registry_track_id: string; p_suggestion_id: string }
        Returns: Json
      }
      text_soundex: { Args: { "": string }; Returns: string }
      track_analytics_event: {
        Args: {
          p_context?: Json
          p_entity_slug?: string
          p_entity_type?: string
          p_event_name: string
          p_page_type?: string
          p_page_url: string
          p_referrer?: string
          p_session_id?: string
          p_user_id?: string
        }
        Returns: number
      }
      triage_correction_case: {
        Args: {
          p_case_resource_id: string
          p_correction_kind: string
          p_correlation_id: string
          p_expected_case_revision: number
          p_idempotency_key: string
          p_priority: string
          p_reason: string
          p_target_resource_id: string
          p_target_summary: string
          p_target_version_id: string
        }
        Returns: {
          case_resource_id: string
          case_revision: number
          command_receipt_id: string
          idempotent_replay: boolean
          receipt_status: string
          result_payload: Json
        }[]
      }
      unlink_correction_evidence: {
        Args: {
          p_case_resource_id: string
          p_correlation_id: string
          p_evidence_link_id: string
          p_expected_case_revision: number
          p_idempotency_key: string
          p_reason: string
        }
        Returns: {
          case_resource_id: string
          case_revision: number
          command_receipt_id: string
          idempotent_replay: boolean
          receipt_status: string
          result_payload: Json
        }[]
      }
      unlink_person_identity: {
        Args: {
          p_correlation_id?: string
          p_expected_identity_revision: number
          p_idempotency_key: string
          p_identity_link_id: string
          p_person_resource_id: string
          p_reason: string
        }
        Returns: {
          command_receipt_id: string
          idempotent_replay: boolean
          identity_link_id: string
          identity_revision: number
          person_resource_id: string
          receipt_status: string
          result_payload: Json
        }[]
      }
      unpublish_article: {
        Args: { p_article_id: string; p_note?: string }
        Returns: {
          article_id: string
          article_slug: string
          draft_version: number
          lifecycle_status: string
          version_id: string
          version_number: number
        }[]
      }
      unpublish_playlist: {
        Args: {
          p_correlation_id?: string
          p_expected_authority_revision: number
          p_idempotency_key: string
          p_note?: string
          p_playlist_id: string
        }
        Returns: {
          authority_revision: number
          command_receipt_id: string
          idempotent_replay: boolean
          lifecycle_status: string
          playlist_id: string
          receipt_status: string
          resource_id: string
          result_payload: Json
          version_id: string
          version_number: number
        }[]
      }
      unschedule_playlist_publication: {
        Args: {
          p_correlation_id?: string
          p_expected_authority_revision: number
          p_idempotency_key: string
          p_note?: string
          p_playlist_id: string
        }
        Returns: {
          authority_revision: number
          command_receipt_id: string
          idempotent_replay: boolean
          lifecycle_status: string
          playlist_id: string
          receipt_status: string
          resource_id: string
          result_payload: Json
          version_id: string
          version_number: number
        }[]
      }
      update_article:
        | { Args: { article_id: string; payload: Json }; Returns: undefined }
        | {
            Args: {
              article_id: string
              expected_updated_at?: string
              payload: Json
            }
            Returns: undefined
          }
      update_article_hero_image: {
        Args: { article_id: string; hero_url: string }
        Returns: undefined
      }
      update_audio_publication_metadata: {
        Args: {
          p_correlation_id?: string
          p_expected_authority_revision: number
          p_idempotency_key: string
          p_payload: Json
          p_publication_id: string
        }
        Returns: {
          authority_revision: number
          command_receipt_id: string
          idempotent_replay: boolean
          publication_id: string
          receipt_status: string
          resource_id: string
          resource_kind: string
          result_payload: Json
        }[]
      }
      update_audio_season_metadata: {
        Args: {
          p_correlation_id?: string
          p_expected_authority_revision: number
          p_idempotency_key: string
          p_payload: Json
          p_season_id: string
        }
        Returns: {
          authority_revision: number
          command_receipt_id: string
          idempotent_replay: boolean
          receipt_status: string
          resource_id: string
          result_payload: Json
          season_id: string
        }[]
      }
      update_audio_show_metadata: {
        Args: {
          p_correlation_id?: string
          p_expected_authority_revision: number
          p_idempotency_key: string
          p_payload: Json
          p_show_id: string
        }
        Returns: {
          authority_revision: number
          command_receipt_id: string
          idempotent_replay: boolean
          receipt_status: string
          resource_id: string
          result_payload: Json
          show_id: string
        }[]
      }
      update_correction_investigation: {
        Args: {
          p_case_resource_id: string
          p_correlation_id: string
          p_evidence_ready: boolean
          p_expected_case_revision: number
          p_idempotency_key: string
          p_investigation_summary: string
          p_investigator_recommendation: string
          p_reason: string
        }
        Returns: {
          case_resource_id: string
          case_revision: number
          command_receipt_id: string
          idempotent_replay: boolean
          receipt_status: string
          result_payload: Json
        }[]
      }
      update_external_contributor: {
        Args: {
          p_consent_status?: string
          p_contact_email?: string
          p_contact_phone?: string
          p_contributor_state?: string
          p_display_name: string
          p_external_contributor_id: string
          p_internal_notes?: string
          p_location_text?: string
          p_public_role?: string
          p_public_safe?: boolean
          p_public_url?: string
        }
        Returns: Json
      }
      update_import_run: {
        Args: {
          p_errors?: string[]
          p_finished_at?: string
          p_id: string
          p_imported_counts?: Json
          p_status?: string
          p_warnings?: string[]
        }
        Returns: {
          created_at: string
          errors: string[] | null
          finished_at: string | null
          id: string
          imported_counts: Json | null
          source_kind: string
          source_manifest: Json | null
          source_name: string
          started_at: string | null
          status: string
          warnings: string[] | null
        }[]
        SetofOptions: {
          from: "*"
          to: "wk_ingestion_runs"
          isOneToOne: false
          isSetofReturn: true
        }
      }
      update_media_asset_record_v2: {
        Args: {
          p_asset_id: string
          p_correlation_id?: string
          p_expected_authority_revision: number
          p_patch: Json
          p_reason: string
        }
        Returns: Json
      }
      update_media_asset_status_batch_v2: {
        Args: {
          p_asset_ids: string[]
          p_correlation_id?: string
          p_reason: string
          p_status: string
        }
        Returns: Json
      }
      update_personal_playlist: {
        Args: {
          p_correlation_id?: string
          p_expected_authority_revision: number
          p_idempotency_key?: string
          p_payload: Json
          p_playlist_id: string
        }
        Returns: {
          authority_revision: number
          playlist_id: string
          receipt_id: string
          receipt_status: string
          resource_id: string
          result_payload: Json
        }[]
      }
      update_playlist_item: {
        Args: {
          p_correlation_id?: string
          p_expected_authority_revision: number
          p_idempotency_key: string
          p_payload: Json
          p_playlist_id: string
          p_playlist_item_id: string
        }
        Returns: {
          authority_revision: number
          command_receipt_id: string
          idempotent_replay: boolean
          playlist_id: string
          playlist_item_id: string
          receipt_status: string
          resource_id: string
          result_payload: Json
        }[]
      }
      update_playlist_metadata: {
        Args: {
          p_correlation_id?: string
          p_expected_authority_revision: number
          p_idempotency_key: string
          p_payload: Json
          p_playlist_id: string
        }
        Returns: {
          authority_revision: number
          command_receipt_id: string
          idempotent_replay: boolean
          playlist_id: string
          receipt_status: string
          resource_id: string
          result_payload: Json
        }[]
      }
      update_publishing_item: {
        Args: {
          p_brief: string
          p_content_kind: string
          p_expected_record_version: number
          p_item_id: string
          p_note?: string
          p_owner_id: string
          p_planned_publish_at: string
          p_planning_state: string
          p_priority: string
          p_production_deadline: string
          p_production_stage: string
          p_title: string
        }
        Returns: {
          item_id: string
          record_version: number
        }[]
      }
      update_taxonomy_term:
        | {
            Args: {
              p_description?: string
              p_name?: string
              p_slug?: string
              p_term_id: string
            }
            Returns: undefined
          }
        | {
            Args: {
              p_description?: string
              p_name?: string
              p_seo_description?: string
              p_seo_keywords?: string
              p_seo_title?: string
              p_slug?: string
              p_term_id: string
            }
            Returns: undefined
          }
      upsert_user_scope_admin: {
        Args: {
          target_can_edit?: boolean
          target_can_publish?: boolean
          target_can_view?: boolean
          target_role_key: string
          target_scope_type: string
          target_scope_value: string
          target_user_id: string
        }
        Returns: {
          assigned_at: string
          assigned_by: string | null
          can_edit: boolean
          can_publish: boolean
          can_view: boolean
          created_at: string
          id: string
          role_key: string | null
          scope_type: string
          scope_value: string
          status: string
          updated_at: string
          user_id: string
        }
        SetofOptions: {
          from: "*"
          to: "user_access_scopes"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      verify_media_file_object: {
        Args: {
          p_byte_size?: number
          p_correlation_id?: string
          p_failure_detail?: string
          p_file_object_id: string
          p_mime_type?: string
          p_result_state: string
          p_sha256?: string
          p_technical_metadata?: Json
        }
        Returns: {
          correlation_id: string
          file_object_id: string
          verification_state: string
        }[]
      }
      verify_media_upload_session_v1: {
        Args: {
          p_byte_size: number
          p_correlation_id?: string
          p_session_id: string
          p_sha256: string
          p_storage_path: string
        }
        Returns: Json
      }
      withdraw_article_suggestion: {
        Args: { p_note?: string; p_suggestion_id: string }
        Returns: {
          decided_at: string
          decision_status: string
          suggestion_id: string
        }[]
      }
      withdraw_source: {
        Args: {
          p_correlation_id?: string
          p_reason: string
          p_source_id: string
          p_withdrawal_public_mode?: string
        }
        Returns: Json
      }
      wk_first_jsonb_text: {
        Args: { a: Json; b: Json; keys: string[] }
        Returns: string
      }
      wk_jsonb_text: {
        Args: { keys: string[]; payload: Json }
        Returns: string
      }
      wk_legacy_uuid: {
        Args: { legacy_id: string; scope: string }
        Returns: string
      }
      wk_norm: { Args: { value: string }; Returns: string }
      wk_safe_bigint: { Args: { value: string }; Returns: number }
      wk_safe_bool: { Args: { value: string }; Returns: boolean }
      wk_safe_date: { Args: { value: string }; Returns: string }
      wk_safe_int: { Args: { value: string }; Returns: number }
      wk_safe_timestamptz: { Args: { value: string }; Returns: string }
      wk_slug_fallback: {
        Args: { fallback: string; value: string }
        Returns: string
      }
      wk_slugify: { Args: { value: string }; Returns: string }
      wk_slugify_text: { Args: { p_value: string }; Returns: string }
      wk_stable_uuid: { Args: { value: string }; Returns: string }
    }
    Enums: {
      [_ in never]: never
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  editorial: {
    Enums: {},
  },
  public: {
    Enums: {},
  },
} as const
