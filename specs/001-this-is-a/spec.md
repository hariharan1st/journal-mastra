# Feature Specification: Multi-role Telegram Journaling Assistant

**Feature Branch**: `[001-this-is-a]`  
**Created**: 2025-10-04  
**Status**: Draft  
**Input**: User description: "This is a Journalling app where the user interacts with a telegram bot and we have to save all the user details into separate tables and we should allow for retrieving the details over a chat using same bot. The various things tracked can be water tracking, medications, workout tracking, health tracking, activity tracking, etc.. It should also go through uploaded documents to answer any user queries. The app should allow doctor to advise the user on certain type of medication routines or a teacher to help track the homework or progress of a child etc. There should be a configuration telegram bot where the doctor or a teacher can provide set of rules(for reminders/alerts to be sent to the user or doctor or teacher) or data to track(eg: water, activities) and a user bot where the real user(student in the teacher case or user in the doctor case) interacts to provide data and ask or answer questions to/from the bot.

Based on medication routines dictated by the doctor, the bot should send reminders to the user to take those medications or to buy medicines if those are out of stock. The medicines also can be tracked based on consumption, the information can be taken from the chat as the user sends text.
Based on homework routines dictated by the teacher persona, the bot should send reminders to the user about homeworks, or todos or to buy stationaries which the user does not have."

## Clarifications

### Session 2025-10-04

- Q: Should the admin caregiver's tracking catalogue be global or scoped per organization/user? → A: One global catalogue shared by all organizations/users
- Q: Who labels weeks as healthy vs unhealthy for analytics comparisons? → A: User defines it
- Q: How should uploaded documents be stored for later reference? → A: Filesystem originals; text & embeddings in Postgres
- Q: Are there specific compliance regimes we must satisfy for stored health/activity data? → A: Both HIPAA and GDPR requirements apply

## User Scenarios & Validation _(mandatory)_

### Primary User Story

The admin caregiver defines which journaling categories the organization will track and the reminder policies that support them, and each user interacts with the Telegram bot to log admin-defined activities, receive prompts, and query their historical records—including time-bound summaries, activity counts, and health pattern insights—directly in chat. Caregiver-facing capabilities are recognized as an expansion area and will be prioritized after the core journaling experience is validated.

### Acceptance Scenarios

1. **Given** the admin caregiver has published the organization-wide tracking catalogue (e.g., water, workouts, medications), **When** a user logs their daily details in the Telegram bot, **Then** the system stores entries against the defined categories and confirms successful capture in chat.
2. **Given** a user has been logging daily activities and health metrics, **When** they ask the user bot for a specific date span or frequency (e.g., “How many times did I work out last week?”), **Then** the system returns the requested counts or summaries sourced from stored entries.
3. **Given** the user reports an unusual health issue for a particular week, **When** they ask the bot to explain potential causes, **Then** the system analyzes differences between healthy and unhealthy weeks, identifies missing or abnormal activities, and presents the findings conversationally with supporting data points.
   - Users explicitly tag weeks as “healthy” or “unhealthy”; analytics operates on those user-provided labels.
4. **Given** a user uploads supporting documents (e.g., prescriptions, assignments), **When** they ask the user bot a related question, **Then** the system references the stored documents to deliver an informed answer and cites the source document title.
5. _(Future caregiver expansion)_ **Given** a caregiver is reviewing an assigned user, **When** the caregiver queries tracked data or stored documents via the configuration bot, **Then** the system returns the requested metrics, summaries, or document excerpts so the caregiver can advise with full context once the caregiver release ships.

### Edge Cases

- What happens when the admin caregiver updates global rules while users are actively journaling? in-progress sessions immediately adopt the new catalogue.
- How should the system respond if a user stops logging entries for required categories? reminders should be sent to the user.
- How should analytics handle missing or incomplete data for requested comparisons (e.g., unhealthy week logs incomplete)? The system should warn the user of incomplete data before presenting conclusions.
- _(Future caregiver expansion)_ How will caregiver overrides interact with admin defaults once caregiver tooling is released? caregiver > admin.

### Manual Validation Evidence

- Capture chat transcripts showing admin caregiver catalogue setup, user logging, reminder delivery, analytics responses, and document-based Q&A for at least one end user.
- Provide screenshots or exports of stored tracking records demonstrating separate tables/entities for each tracked category and role-specific data segregation.
- Record evidence of time-bound queries (e.g., specific dates, activity counts) matching database values and of health-week comparisons explaining differences with cited metrics.
- _(Future caregiver expansion)_ Capture caregiver query transcripts that demonstrate successful retrieval of user metrics and document excerpts from the configuration bot.
- Document a checklist verifying reminder timing accuracy against configured schedules.
- Product manager to sign off on transcripts and evidence before launch readiness review.

## Requirements _(mandatory)_

### Functional Requirements

- **FR-001**: System MUST enable the admin caregiver to define and update the global tracking catalogue, default reminder policies, and analytics parameters that apply to all users.
- **FR-001a**: Admin catalogue updates are published globally; all organizations and users share the same tracking catalogue definition.
- **FR-002**: System MUST provide a user-facing Telegram interface for journaling, allowing individuals to submit admin-defined activity entries, receive reminders, and retrieve stored information.
- **FR-003**: System MUST persist each user’s submitted details (e.g., water intake, medication adherence, workouts, homework status) in distinct, queryable data structures in accordance with the global tracking catalogue to support retrieval and auditing.
- **FR-004**: System MUST generate reminder messages to users based on admin-defined routines and track acknowledged vs. missed reminders.
- **FR-005**: System MUST ingest admin- or user-uploaded documents and make their contents searchable for subsequent question answering.
- **FR-005a**: Document ingestion stores originals in managed filesystem storage while persisting extracted text and vector embeddings in Postgres; retrieval operates on these representations and references the stored file path.
- **FR-006**: System MUST allow users to request historical summaries (daily, weekly, custom range) of tracked metrics through chat and respond with consolidated results including activity counts.
- **FR-007**: System MUST analyze health-related logs to explain differences between healthy and unhealthy periods and present insights conversationally, referencing contributing or missing activities and noting data gaps when present.
- **FR-007a**: Users manually designate week health labels that drive comparative analytics; the system prompts for a label if missing before generating explanations.
- **FR-008**: System MUST comply with HIPAA and GDPR obligations regarding user data protection, including role-based access, audit logging, retention rules, and breach notification workflows.

### Non-Functional Requirements

- **Security & Privacy**: Encrypt data at rest and in transit, enforce least-privilege access, maintain audit trails for admin and agent actions, and support secure key rotation.
- **Compliance**: Implement HIPAA and GDPR controls: document consent capture, support subject access and deletion requests, track data lineage, and ensure breach notifications meet regulatory timelines.
- **Reliability**: Target 99.5% uptime for journaling and reminder delivery services with automated recovery for failed jobs.

#### Future Functional Requirements — Caregiver Expansion

- **FR-F01**: System SHOULD provide caregivers with an overview of each assigned user’s progress, including latest entries, unanswered reminders, analytics flags, and document insights accessible via a caregiver interface once caregiver tooling is prioritized.
- **FR-F02**: System SHOULD enforce role-based access so admin caregivers manage global rules, individual caregivers manage assigned users, and data logging/retrieval is limited to the appropriate user when caregiver tooling launches.
- **FR-F03**: System SHOULD allow caregivers to query user-specific tracked data and uploaded documents on demand, returning actionable summaries or excerpts suitable for personalized guidance.

### Key Entities _(include if feature involves data)_

- **User Profile**: Represents an individual using the user bot (patient/student); stores identity details, caregiver assignment, and communication preferences.
- **Caregiver Profile**: _(Future expansion)_ Represents a doctor, teacher, or other caregiver configuring tracking rules; includes authority scope, managed users, and notification preferences.
- **Admin Rule Set**: Captures organization-wide tracking categories and their datatypes, default reminder policies, analytics baselines, and publishing history managed by the admin caregiver.
- **Global Tracking Catalogue**: Single source of truth for all organizations/users derived from the Admin Rule Set; any update applies platform-wide immediately.
- **Tracking Category**: Defines a specific metric to monitor (e.g., water intake, medication name, homework subject in accordance with organization-wide tracking categories) along with expected logging frequency and reminder templates.
- **Reminder Rule**: Captures scheduling parameters, trigger conditions, escalation paths, and associated tracking categories for automated prompts.
- **Journal Entry**: Records user-submitted data points (text, numeric values, confirmations) tied to a tracking category and timestamp.
- **Document Repository Item**: Represents an uploaded document with metadata, extracted content summaries, and linkage to relevant users/caregivers. Persist normalized text and embedding vectors in Postgres and retain the original file within managed filesystem storage referenced by stored paths.
- **Interaction Log**: Stores conversation exchanges, reminder deliveries, acknowledgements, and system-generated alerts for compliance tracking.

---

## Review & Acceptance Checklist

_GATE: Automated checks run during main() execution_

### Content Quality

- [x] No implementation details (languages, frameworks, APIs)
- [x] Focused on user value and business needs
- [x] Written for non-technical stakeholders
- [x] All mandatory sections completed

### Requirement Completeness

- [x] No [NEEDS CLARIFICATION] markers remain
- [x] Requirements are testable and unambiguous
- [x] Success criteria are measurable
- [x] Scope is clearly bounded
- [x] Dependencies and assumptions identified

---

## Execution Status

_Updated by main() during processing_

- [x] User description parsed
- [x] Key concepts extracted
- [x] Ambiguities marked
- [x] User scenarios defined
- [x] Manual validation evidence described
- [x] Requirements generated
- [x] Entities identified
- [ ] Review checklist passed

---
