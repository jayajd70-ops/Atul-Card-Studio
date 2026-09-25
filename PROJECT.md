# Atul Card Studio PWA — Master Project Specification

## 1. Project Identity & Baseline

**Project:** Atul Card Studio PWA  
**Working product name:** Atul Card Studio  
**Status:** Existing application under controlled improvement  
**Version:** 1.3.1  
**Branch:** `main`  
**Baseline commit:** `06f7183`  
**Final branding:** To be decided

Atul Card Studio PWA already exists and was developed with ChatGPT. Improve this application incrementally; do not rebuild it from scratch or replace it with a reference project.

Do not use **WishCraft** as this project's product name. That name is already used elsewhere. Do not rename the application or repository unless a naming change is explicitly approved. Branding decisions are separate from architecture decisions.

The product is a mobile-first, offline-capable greeting-card studio for personalized cards covering personal occasions and festivals. The same PWA should provide an expanded desktop workspace for detailed editing and advance preparation.

The baseline is Atul Card Studio v1.3.1 on `main` at `06f7183`. Before relying on this baseline for implementation, verify the actual repository, branch, commit, working tree, and running application. Later changes may have moved the repository beyond this documented checkpoint.

### Authority and scope

This document records product direction and protected behavior. **It is not blanket authorization to implement any requirement.** An agent may inspect the repository and report gaps, but may modify code only for a specific approved Current Task and only after its impact analysis and smallest safe plan have been approved.

Status meanings:

- **KEEP / MUST PRESERVE:** Protect verified working behavior.
- **IMPROVE:** Inspect first; change only an approved, evidenced gap.
- **ADD:** Desired capability, not permission to build it now.
- **PENDING / OPTIONAL:** Retain in the specification; do not implement without later approval.

## 2. Existing Working Features — DO NOT BREAK

Inspect and verify the current implementation before changing it. Do not assume a feature is missing because a requirement also mentions it. Preserve working behavior unless the Current Task explicitly authorizes a change.

### Card creation and output

- Recipient/receiver information
- Relationship information
- Sender/from information
- Greeting/message creation and manual editing
- Existing greeting styles or tones
- Existing themes and designs
- Card preview
- Export

### Typography and appearance

- Existing font, font-size, letter-spacing, and line-height controls
- Existing text and theme colour controls
- Existing font pairing and typography behavior
- Existing foil palettes and effects, including finish, intensity, texture, and highlight controls where present
- Existing backgrounds, borders, frames, and decorations

Borders and decorations work in v1.3.1. Improve identified gaps without replacing useful behavior unnecessarily.

### Photo workflow

Preserve, where currently supported:

- Photo upload
- Zoom
- Horizontal pan/position
- Vertical pan/position
- Rotation
- Masks and shapes
- Framing and placement controls

Automatic person framing must complement, not replace, manual adjustment.

### No-photo cards

When no photo is selected, preserve the useful decorative-circle or decorative-layout behavior. A no-photo card must look intentionally designed, not like a card with a missing image.

### Editing and state

- Undo and Redo
- Existing editing controls
- Existing card state and user-entered content
- Back navigation that returns to editing without discarding the card, where present

Changing a design should change presentation, not erase the user's work.

### Storage, offline operation, and saved work

- PWA and offline capability
- Service-worker behavior and existing cache strategy
- Locally available and self-hosted assets where present
- Saved-card/Vault behavior
- Reopening saved work where present

Do not change `sw.js`, asset paths, cache versions, or offline behavior for an unrelated visual or editing task.

### Mobile and desktop

The PWA must continue to work on both mobile and desktop. Mobile is the primary routine-use environment; desktop supports detailed editing and advance preparation. An improvement for one layout must not regress the other.

### Protected state during visual changes

Where applicable, preserve:

- Recipient details
- Relationship
- Sender details
- Generated or edited message
- Uploaded/captured photo
- Selected person or focus information
- Manual photo position, zoom, and rotation
- Date
- User adjustments

## 3. Product Requirements

### R1. Expandable Design Library — IMPROVE

Replace the limitation of approximately five or six fixed designs with an expandable greeting-card design library while retaining useful built-in designs.

Required behavior:

- Browse and preview available card designs.
- Add approved designs over time.
- Support visual families appropriate to different occasions.
- Allow preferred designs to be retained and reused.
- Make retained designs available offline where practical.
- Do not automatically download a large design collection without an approved acquisition, storage, and cache strategy.

“New” or “daily” designs means fresh greeting-card designs, not daily inspirational content. Whether new designs are created manually, by AI, or acquired online remains undecided.

### R2. Templates, Backgrounds, Borders, and Decorations — IMPROVE

Improve the visual quality and variety of backgrounds, borders, side decorations, frames, and no-photo layouts.

Required behavior:

- Support photo and no-photo design modes.
- Preserve working border and decoration functions.
- Preserve and improve the existing decorative-circle behavior when no image is selected.
- Make no-photo cards look intentionally composed rather than incomplete.
- Allow occasion-appropriate arrangements and visual styles.
- Avoid replacing working visual functionality without an evidenced reason.

### R3. Coordinated Theme and Typography — IMPROVE

A template should provide coordinated defaults for background, border, side decorations, font family/style, font size, font colour, decorative colours, and effects. Defaults must maintain readable contrast while allowing manual fine-tuning.

Provide independent font-size controls for:

- Recipient/receiver name
- Main greeting/message
- Sender/from name

Changing the recipient font size must not change the sender font size, and changing either must not unintentionally change the message size.

### R4. Expanded Decorations and Emoji Library — IMPROVE

Expand the limited decoration collection without cluttering the routine editor.

Required behavior:

- Retain useful existing decorations.
- Add occasion-appropriate emojis, symbols, and decorative elements.
- Group choices into categories such as Birthday, Anniversary/Love, Festivals, Flowers/Nature, Celebration, and General.
- Allow users to add and remove decorations.
- Allow size and position adjustment where practical.
- Keep advanced choices in an optional or collapsible decoration area.
- Ensure decorations supplement good artwork rather than substitute for it.
- Do not reset recipient, photo, message, or other content when decorations change.

### R5. Occasion-Aware Message Generator — IMPROVE, HIGH PRIORITY

Message generation must follow this context order:

`Occasion → Sub-occasion/Festival → Relationship → Tone/Mood → Generate → Context validation`

#### Indian-Context Message Requirement (Permanent Rule)
All generated messages across current and future occasions must be primarily appropriate for Indian users, family relationships, traditions, and social conventions:
- **Avoid Western card clichés:** Remove expressions such as “another orbit around the sun,” “cake for breakfast,” “handle with confetti,” and casual Western idioms.
- **Natural relationship awareness:** Respect Indian social dynamics across elders, parents, spouse, siblings, children, relatives, teachers, friends, and professional colleagues.
- **Elders & Mentors:** Express respect, good health, peace, longevity, and warm good wishes.
- **Family & Friends:** Warm, personal, sincere, and enduring.
- **Professional:** Dignified, polite, and respectful.
- **Secular & Inclusive by default:** Do not assume religious beliefs (Hindu, Muslim, Christian, Sikh, Jain) on personal occasions. Do not insert token Hindi/Sanskrit expressions into generic messages. (Festival-specific cultural language is reserved strictly for when that specific festival is selected).
- **Condolence & Sympathy:** Dignified, comforting, respectful, and compassionate without casual Western phrases or assumptions about the afterlife.

Required behavior:

- Match the selected occasion or festival.
- Use relationship-aware wording where appropriate.
- Apply tone inside the selected occasion rather than allowing tone to override context.
- Support regeneration without resetting unrelated card content.
- Keep generated text editable and allow a fully manual message.
- Apply stricter guards to sensitive occasions such as condolence and sympathy.
- Prevent celebratory, congratulatory, birthday, or “happy to hear” wording on condolence/sympathy cards.
- Prevent cross-occasion errors such as anniversary text on a Get Well card or Christmas text on a Diwali card.

Semantic correctness is more important than the number of variations.

### R6. Manual Photo Adjustment and Crop — KEEP + IMPROVE

Preserve the existing manual photo editor and integrate it cleanly with R15 Smart Person Focus.

Retain, where supported:

- Upload
- Zoom
- Horizontal positioning
- Vertical positioning
- Rotation
- Crop/framing
- Masks/shapes
- Reset adjustment

Keep the original image and store framing parameters non-destructively where practical. Manual adjustment must remain available after automatic framing.

Brightness, contrast, saturation, filters, sharpening, beauty effects, and a general photo-enhancement suite are not required. This product composes greeting cards; it is not a full photo editor.

### R7. Persistent Card State — MUST PRESERVE

Changing a design, template, theme, or decoration must not destroy the user's work.

Preserve, where applicable:

- Recipient details
- Relationship
- Sender details
- Message
- Photo
- Selected person from a group photo
- Manual photo adjustments
- Date
- Other user-entered card content

A new template may change the background, border, coordinated decorations, theme colours, and template-specific typography defaults or layout. The governing principle is: **change the design, not the user's work.**

### R8. Fine-Tune Card Composition — KEEP + IMPROVE

Provide final composition controls while showing an accurate card preview.

Photo/image controls:

- Size/zoom
- Independent horizontal position (left/right)
- Independent vertical position (up/down)

Message-box controls:

- Independent horizontal position (left/right), where the layout permits
- Independent vertical position (up/down)
- Message font size
- Line spacing where appropriate
- Message-box width/size where technically useful

Name controls:

- Independent recipient-name font size
- Independent sender-name font size

Moving the image must not unintentionally move the message box. Moving the message box must not reposition the image. Apply sensible bounds so important elements cannot become permanently inaccessible outside the card. Preview and export must match.

### R9. Mobile Navigation and Safe Scrolling — IMPROVE, HIGH PRIORITY

Required behavior:

- Provide clear Back/Previous navigation where appropriate.
- Provide a convenient return-to-top control on long editing screens.
- Treat Back/Previous as navigation, not Undo.
- Preserve current card state when moving backward through the workflow.
- Warn before leaving if navigation would discard unsaved work.
- Make sliders and other controls respond to deliberate interaction.
- Ensure ordinary vertical swipes scroll the page without changing photo position, message position, font size, selected design, decorations, colours, or other settings.

### R10. Personal Occasions and Festivals — ADD/EXPAND

Preferred architecture: one modular Atul Card Studio PWA with a shared Card Studio.

Personal greeting categories may include Birthday, Anniversary, Congratulations, New Baby, New Home, Graduation, Retirement, Get Well, Condolence/Sympathy, and Friendship/Thanks.

Festival categories may include Diwali, Holi, Navratri, Raksha Bandhan, Janmashtami, Ganesh Chaturthi, Christmas, Eid, and other approved festivals.

Use this flow:

`Occasion/Festival → Appropriate templates and message rules → Shared Card Studio → Preview → Save/Export/Share`

Do not duplicate the editor for each occasion. Splitting Personal Greetings and Festivals into two applications is a fallback only if repository inspection and testing demonstrate that the unified architecture creates unacceptable complexity or reliability problems.

### R11. Photo Input and Placement — IMPROVE

Provide two photo sources where supported:

- **Upload Photo:** choose an existing image from a phone or computer.
- **Take Photo / Camera:** capture a new image directly on a compatible device/browser.

Camera access is optional and device-dependent. If unavailable or denied, upload must continue to work and the application must remain usable.

Both sources must enter the same photo-processing workflow and retain size/zoom, horizontal position, vertical position, and applicable framing controls. This supports taking a photo when meeting someone and preparing a saved card in advance.

### R12. Remove, Replace, and No-Photo Modes — MUST HAVE

- **Remove Photo:** remove only the current photograph and retain all other card data.
- **Replace Photo:** upload or capture another photograph while retaining recipient, message, theme, date, and other work.
- **No Photo:** deliberately switch to a designed no-photo presentation rather than leaving an empty placeholder.

Photo operations must not reset the rest of the card. Replacing a photo must clear stale detection or framing data that belongs only to the previous image.

### R13. Undo, Redo, and Previous Screen — KEEP + IMPROVE

Undo and Redo operate on card edits; Back/Previous operates on navigation.

Where practical, Undo/Redo should cover text changes, photo size/position, decorations, theme/template changes, and automatic person framing. A compound automatic action such as Auto-Center should behave as one undoable transaction. Back from Preview should return to Edit with the card unchanged.

### R14. Responsive Mobile and Desktop Workspace — IMPROVE, HIGH PRIORITY

Use one responsive PWA and one card-data model, not separate mobile and desktop applications.

- **Mobile-first:** fast, touch-safe routine card creation, potentially staged as Occasion → Recipient → Design → Message → Photo → Fine Tune → Preview → Save/Share.
- **Desktop-enhanced:** larger workspace for comparing templates, adjusting decorations, fine-tuning layouts, and preparing cards in advance.

Both layouts must expose the same essential card data and capabilities, with controls reorganized for available space.

### R15. Smart Person Focus — ADD, ON DEMAND

Smart Person Focus is optional during normal use and should not interrupt a routine single-person photo workflow.

When an individual photo is unavailable:

1. User activates Select Person or Focus Person.
2. The application detects people/faces in a couple or group photo locally where practical.
3. It presents clear, enlarged, recognizable choices in deterministic order.
4. The user selects the intended person; the application must not guess the recipient.
5. Auto-Fit/Auto-Center calculates non-destructive zoom and position suitable for the selected frame shape/layout.
6. Manual zoom, horizontal pan, and vertical pan remain available.

The user may skip detection and frame the photo manually. The feature should preserve the original image, participate in Undo/Redo, persist through save/reopen where appropriate, clear stale detections after replacement, and render consistently in editor, preview, and export. The Birthday Card Maker Premium implementation is a behavioral reference, not code to copy blindly.

### R16. Self-Hosted Fonts and Offline Assets — KEEP; OPTIONAL ENHANCEMENT

Preserve existing self-hosted fonts, local assets, and offline behavior. Do not replace working local fonts with a runtime Google Fonts/CDN dependency.

Further enhancement is optional and must not delay active work. If a later task introduces required fonts, models, or other runtime assets, prefer local packaging where practical and assess service-worker/cache impact explicitly.

### R17. Automatic and Editable Date — IMPROVE

- Calculate the actual current date at runtime for a new card; never use a permanently hard-coded default.
- Allow the user to choose another date for advance preparation.
- Provide a simple Show Date/Hide Date choice.
- Use an appropriate display format.
- Preserve the chosen date when changing designs and when saving/reopening the card.

### R18. Optional Creator Footer — APPROVED 24 September 2026 (Task 028)

An optional footer such as **“Developed and created by [Name]”**. The owner approved implementation on 24 September 2026 (“Continue R5 and R18”).

Requirements:

- Creator name must be configurable, not hard-coded.
- Blank or hidden means no creator attribution in preview/export.
- A Show/Hide option should be available.
- The preferred creator name may be stored locally if approved.
- Creator attribution must remain separate from the card's Sender/From field.

## 4. AI Development Rules

### 4.1 Permission Levels & Authorization Gates

Every AI assistant interaction operates under one of four explicit permission levels:

1. **READ-ONLY:** Inspection, diagnosis, gap analysis, impact analysis, smallest safe plan formulation, test reporting, and verification. **No modifying application files, dependencies, or git state.** Planning and impact analysis belong under this level.
2. **IMPLEMENT:** Modifying code or documentation strictly to execute an approved smallest safe plan, followed by local verification (running syntax/regression checks and testing on the local dev server). **No staging, commits, pushes, or deployments.**
3. **COMMIT:** Staging only the specific authorized files and creating a local git commit with an approved commit message. **No pushing or deploying.**
4. **PUSH / DEPLOY:** Pushing verified local commits to `origin/main` and monitoring/verifying production deployment (e.g., GitHub Pages release).

**Standing owner authorization — 20 September 2026:** The agent may start the next specific task selected from the approved requirements and, after its required checks pass, commit, push to `origin/main`, deploy, and verify production without asking for separate session-start or release permission. The agent must still document the task, impact, smallest safe plan, changes, and verification. This standing authorization does not permit destructive Git/filesystem actions, unrelated scope expansion, bypassing failed checks, or implementing an ambiguous product decision.

### 4.2 Mandatory Stop-and-Report Conditions

An AI assistant must immediately **STOP** and report to the user without making changes, committing, or proceeding if any of the following occur:
- **Scope expansion:** The requested task or implementation reveals additional work beyond the approved plan.
- **Unexpected modified files:** Git status shows unexpected modified, untracked, or deleted files outside the authorized scope.
- **Failed checks or tests:** Any syntax check, test suite, regression check, build, or deployment step fails.
- **New product or design decision:** Ambiguity, trade-offs, or contradictory requirements arise that require a product/design decision.

### 4.3 Task Execution Sequence

For every proposed implementation task, follow this sequence:

1. **Inspect:** Confirm the exact repository, branch, commit, working-tree state, relevant files, running behavior, and tests. Read this document and the Current Task.
2. **Report existing:** State what already exists, what was verified working, what is partial, and what is missing. Distinguish evidence from assumptions.
3. **Impact check:** Identify affected state, rendering, preview/export, mobile/desktop UI, saved data, offline/cache behavior, and related requirements. Note regression and migration risks.
4. **Smallest safe plan:** Propose the narrowest change that satisfies the approved task while preserving the baseline. Do not perform unrelated cleanup, redesign, dependency replacement, repository restructuring, or branding changes.
5. **Authorization check:** For work covered by the standing owner authorization, record the specific task and smallest safe plan, then proceed without another permission prompt. Otherwise, wait for approval of the specific plan before modifying code.
6. **Implement:** Make only approved changes. Preserve user data, existing functionality, and established project identity. Do not rebuild from scratch.
7. **Test:** Test the changed behavior with normal, boundary, error, and unsupported-device/fallback cases relevant to the task.
8. **Regression test:** Re-test protected related behavior, state preservation, mobile and desktop behavior, preview/export consistency, save/reopen, and offline operation where affected.
9. **Report:** Provide changed files, behavior before/after, tests and exact results, unresolved risks, and anything not tested. Never call untested behavior successful.
10. **Git and release:** Use a concise commit message. Under the standing owner authorization, commit, push to `origin/main`, deploy, and verify production after all required checks pass. Do not merge unrelated branches or alter Git history.

When requirements conflict or inspection contradicts this document, stop after reporting the evidence and request a decision. Never silently reinterpret the specification.

## 5. Testing & Regression Rules

An approved change is complete only when its feature tests and relevant regression tests pass.

### Required checks for every change

- Verify the requested behavior against explicit acceptance criteria.
- Re-test previously working features that share state, controls, rendering, storage, or navigation with the change.
- Verify user-entered content is preserved through affected actions.
- Test representative mobile and desktop layouts.
- Confirm preview and exported output match for affected visual behavior.
- Record PASS, FAIL, or NOT TESTED with evidence; do not infer a result from build success alone.

### Core regression scenarios

1. Create a card with recipient, relationship, sender, edited message, date, photo, and manual adjustments; switch designs repeatedly; verify the content remains intact.
2. Move image X/Y and message-box X/Y independently; verify one does not move the other and neither becomes irretrievable.
3. Change recipient, message, and sender font sizes independently; verify no unintended coupling.
4. Scroll repeatedly on a touch device through the editor; verify no setting changes without deliberate control interaction.
5. Navigate Edit → Preview → Back; verify the complete card state is preserved. Verify Undo/Redo changes edits, not screens.
6. Remove, replace, and restore a photo; verify other content persists, no-photo mode looks intentional, and stale person detections are cleared.
7. For a group photo, select different people; verify distinct, bounded framing; then verify manual adjustment, Undo/Redo, save/reopen, and replacement behavior.
8. Test message contexts including Condolence, Get Well, Birthday, Anniversary, Diwali, and Christmas; reject cross-occasion or celebratory wording in sensitive contexts.
9. Verify current-date initialization, date editing, Show/Hide, design switching, and save/reopen.
10. Test online and offline startup when an approved change affects assets, service worker, caching, saved data, fonts, or local models.

### Visual and device coverage

- Test narrow mobile, wider mobile/tablet where available, and desktop viewport behavior.
- Check touch targets, scrolling, clipping, overflow, readable contrast, and safe control boundaries.
- Compare editor, preview, reopened card, and export for affected layouts.
- Verify unsupported camera access and denied permission fall back cleanly to upload.

### Release boundary

A clean build or source review is not release proof. If deployment is later authorized, verify the actual deployment result, public application version/assets, production subpath behavior, and PWA cache refresh before reporting release success.

## 6. Reference Projects and What to Learn From Each

Reference projects provide behavioral evidence only. Inspect licenses, architecture, compatibility, and current code before reusing any implementation.

### `birthday-card-maker`

Use as a reference for the straightforward Birthday-card workflow, template behavior, direct photo sizing/placement, and useful card-composition patterns. Do not replace Atul Card Studio's more capable editor or copy an older interface wholesale.

### `birthday-card-maker-premium`

Use as the primary behavioral reference for Smart Person Focus: local MediaPipe/BlazeFace face detection, enlarged selectable people, deterministic ordering, non-destructive framing calculations, multiple frame shapes/layouts, manual correction, Undo/Redo as one transaction, save/reopen, photo-replacement cleanup, offline assets, and editor/preview/export consistency.

### `Personal-Greeting`

Use as a related greeting-card implementation for comparing occasion, template, message, personalization, and workflow ideas. It is not the primary application and does not authorize use of the WishCraft name for this project.

### Explicit exclusion: India Inspiration Studio

India Inspiration Studio is a separate 365-day inspirational-message and related-image publishing product. It is not part of Atul Card Studio, must not be merged into it, and must not be used to reinterpret “new designs” as daily inspirational content.

## 7. Pending / Parked Ideas

Parked ideas remain outside implementation scope until explicitly reviewed and promoted into an approved Current Task:

- **R18 Creator Footer:** approved by the owner on 24 September 2026 and implemented in Task 028.
- **R16 further font/offline-asset enhancement:** optional; preserve current behavior, with no proactive expansion required.
- Birthday/anniversary calendar and reminders.
- People & Events database.
- Automatic online design acquisition or daily downloads.
- AI generation strategy for new designs.
- Daily Inspiration integration; current decision is to keep that product concept separate.
- Separate Personal Greetings and Festivals apps; fallback only under the evidence threshold in R10.
- Person/background extraction beyond non-destructive Smart Person Focus.
- AI upscaling or photo enhancement.
- Final product branding and any repository/application rename.

Use the decision flow: `Idea → Park → Review → Approve as a specific task → Build`.

## 8. Task 002A Completion Record

- **Completed Task:** Task 002A — Condolence / Sympathy occasion correction and completion
- **Baseline:** `main` at historical commit `06f7183`
- **Completed commit:** `580a87e` — `fix: isolate condolence state and preserve birthday card data`
- **Release:** Application, manifest, service worker, and cache version `1.4.0`; schema v3
- **Published site:** https://jayajd70-ops.github.io/Atul-Card-Studio/
- **Working-tree result:** Clean after commit
- **Verification:** Local syntax/static checks passed; local browser acceptance checks passed; public HTTPS browser acceptance checks passed; no page or console errors; service worker installed, controlled the app, and supported offline startup.
- **Acceptance result:** Birthday state round-trip, Condolence isolation and safety blocking, deterministic designs, relationship matrix, Vault/reload persistence, release metadata, and offline/PWA behavior all passed.

Task 002A is complete. Its implementation, commit, push, deployment, and available regression verification were reported and authorized.

### Task 003 Completion Record

- **Completed Task:** Task 003 — Add eight personal greeting occasions
- **Baseline:** `main` at commit `bb96e99`
- **Release:** Application, manifest, service worker, and cache version `1.5.0`; schema remains v3
- **Added occasions:** Anniversary, Congratulations, New Baby, New Home, Graduation, Retirement, Get Well, and Friendship / Thanks
- **Behavior:** Each occasion has Heartfelt, Poetic, Professional, and Playful message pools and retains independent message, tone, mode, and relationship state through occasion changes.
- **Compatibility:** Birthday and Condolence behavior, photo/layout data, saved projects, exports, and the existing backup format remain preserved.
- **Verification:** Syntax/static checks and focused local browser checks passed for all 10 occasion options, message generation for all eight new occasions, Birthday state round-trip, and Condolence isolation.

Task 003 implementation and release were explicitly authorized. The Current Task returns to report-only after publication verification.

### Task 004 Implementation Record

- **Approved Task:** Task 004 — Occasion-specific decorations for all 10 greeting types
- **Baseline:** `main` at commit `93a74e8`
- **Status:** Complete, committed, pushed, deployed, and verified
- **Completed commit:** `e71183e` — `feat: add occasion-specific decorations`
- **Release:** Application, manifest, service worker, and cache version `1.6.0`; schema v4
- **Schema:** Advanced from v3 to v4 for independent per-occasion decoration state
- **Behavior:** Every personal occasion receives an appropriate recommended badge/accent set and restores its own editable decorations. Condolence retains its existing restrained built-in designs, suppresses stamp editing, and preserves the prior personal-occasion decorations.
- **Compatibility:** Existing global stamps migrate to the active personal occasion, or Birthday when Condolence was suppressing them. Birthday, Condolence, Task 003 messages, photo/layout state, Vault, backup/import, duplicate, preview, and export behavior remain preserved.
- **Verification:** Syntax/static checks, Task 002A regression, Task 003 occasion/message regression, focused Task 004 decoration-state checks, public HTTPS assets/behavior, and offline PWA startup passed.

### Task 005 Implementation Record

- **Approved Task:** Task 005 — Automatic and editable card date (R17)
- **Baseline:** `main` at commit `6ccff0e`
- **Status:** Complete, committed, pushed, deployed, and verified
- **Completed commit:** `b69a9b2` — `feat: add editable card date`
- **Release:** Application, manifest, service worker, and cache version `1.7.0`; schema v5
- **Behavior:** New cards initialize with the user’s actual local date, support another selected date, provide Show/Hide control, render an `en-IN` long-form date consistently in preview/export, and preserve the value through occasion/design changes and save/reopen.
- **Compatibility:** Existing saved cards migrate with their creation date stored but hidden, preserving their previous appearance.
- **Verification:** Current-date initialization, editing, Show/Hide, occasion round-trip, rendering, save/reopen, public HTTPS behavior, Task 002A regression, Task 003 occasion/message regression, Task 004 decoration-state regression, and offline PWA startup passed.

### Task 006 Implementation Record

- **Approved Task:** Task 006 — Mobile editor navigation and safe scrolling (R9)
- **Baseline:** `main` at commit `1bc5eb8`
- **Status:** Complete, committed, pushed, deployed, and verified
- **Completed commit:** `ef6c30b` — `feat: improve mobile editor navigation`
- **Release:** Application, manifest, service worker, and cache version `1.8.0`; schema remains v5
- **Behavior:** Adds mobile-friendly Back, Next, and return-to-top controls; Back uses independent tab navigation history and never invokes Undo; editor state remains unchanged while moving between sections; pending edits trigger the browser leave warning; the card canvas keeps its deliberate gesture surface while ordinary editor scrolling remains available.
- **Compatibility:** Existing tab keyboard navigation, Undo/Redo history, photo/stamp pointer gestures, saved card data, and all existing greeting, decoration, date, export, and offline behavior remain preserved.
- **Verification:** Syntax/static checks, focused Task 006 browser checks, gesture-surface preservation, unsaved-change warning, and the existing Task 002A, Task 003, Task 004, and Task 005 regression suite passed.

### Task 007 Implementation Record

- **Approved Task:** Task 007 — New Baby visual refinement
- **Baseline:** `main` at commit `205c5d2`
- **Status:** Complete, committed, pushed, deployed, and verified
- **Completed commit:** `35c4c4d` — `feat: refine newborn card visuals`
- **Release:** Application, manifest, service worker, and cache version `1.9.0`; schema remains v5
- **Behavior:** Adds a realistic teddy-bear centerpiece, adds a reference-style newborn hands-and-feet centerpiece for Theme Aura, removes the New Baby `MY` monogram, adds `🧿♥️` after the New Baby message, tightens the Grandparents-to-sender spacing, normalizes sender-name ampersand spacing, and increases footer date readability.
- **Compatibility:** Birthday and other occasion state isolation, existing centerpieces, saved projects, exports, offline caching, and all prior navigation behavior remain preserved.
- **Verification:** Syntax/static checks, New Baby visual previews for Royal Burgundy, Amber Tuscan, and Imperial Emerald, Theme Aura hands-and-feet preview, and the Task 003 occasion/state regression passed.

### Task 008 Implementation Record

- **Approved Task:** Task 008 — Occasion cake fallbacks for Birthday and Anniversary
- **Baseline:** `main` at commit `8837508`
- **Status:** Complete, committed, pushed, deployed, and verified
- **Completed commit:** `c62688f` — `feat: add occasion cake centerpieces`
- **Release:** Application, manifest, service worker, and cache version `1.10.0`; schema remains v5
- **Behavior:** When no user photo is uploaded, Auto uses a realistic ivory floral cake marked `Happy Birthday` for Birthday cards and a coordinated cake marked `Happy Anniversary` for Anniversary cards. Burgundy lettering with champagne-gold highlights remains legible across light and dark themes. Uploaded photos and explicitly selected alternative centerpieces retain priority.
- **Compatibility:** Existing photos, manual centerpiece choices, occasion state isolation, saved projects, exports, and offline behavior remain preserved.
- **Verification:** Syntax/static checks, automatic-centerpiece resolution, Royal Burgundy, Imperial Emerald, and Pearl Marble visual checks, occasion/decorations/date/mobile-navigation regressions, service-worker precaching, live asset delivery, live rendering, and live occasion-state regression passed.

### Task 009 Implementation Record

- **Approved Task:** Task 009 — Camera photo input through the shared photo workflow (R11)
- **Baseline:** `main` at commit `d6a6e27`
- **Status:** Complete, committed, pushed, deployed, and verified
- **Completed commit:** `32bb5f9` — `feat: add camera photo input`
- **Release:** Application, manifest, service worker, and cache version `1.11.0`; schema remains v5
- **Behavior:** Adds a separate Take Photo / Camera source on compatible devices while preserving Upload Photo. Both sources use the same validation, private IndexedDB storage, replacement cleanup, transform, preview, save/reopen, and export workflow.
- **Compatibility:** Existing card data, occasion isolation, uploaded-photo priority, manual centerpiece choices, Condolence no-photo behavior, saved projects, exports, and offline behavior remain preserved.
- **Verification:** Syntax/static checks and focused mobile/desktop browser checks passed for camera/upload intake, transform persistence, Birthday–Condolence isolation, replacement cleanup, manual-centerpiece restoration, content preservation, PNG export, save/reload, and offline startup. GitHub Pages run `35650144683` succeeded; live HTTPS version/assets, camera intake, occasion isolation, manual-centerpiece restoration, service-worker control, and offline restart passed.

### Task 010 Implementation Record

- **Approved Task:** Task 010 — Categorized decoration gallery (R4)
- **Baseline:** `main` at commit `40eceba`
- **Status:** Complete, committed, pushed, deployed, and verified
- **Completed commit:** `fa0fe2f` — `feat: categorize decoration gallery`
- **Release:** Application, manifest, service worker, and cache version `1.12.0`; schema remains v5
- **Behavior:** Groups the existing decoration library into Recommended, Occasion Greetings, Love & Messages, Flowers & Nature, Celebration & Keepsakes, and Personal sections. Occasion recommendations remain first and every available decoration appears exactly once.
- **Compatibility:** Decoration selection and placement, per-occasion stamp state, card content, uploaded-photo priority, manual centerpiece choices, saved projects, preview/export, and offline behavior remain unchanged.
- **Verification:** Syntax/static checks and focused mobile/desktop browser checks passed for category order, all 19 unique decorations, Birthday/Anniversary recommendation updates, occasion-state round-trip, responsive layout, PNG export, and offline startup. Rendered mobile and desktop gallery layouts were visually reviewed. GitHub Pages run `35651734461` succeeded; live HTTPS version/assets, unique categorized items, recommendation switching, decoration placement, service-worker control, and offline restart passed.

### Task 011 Implementation Record

- **Approved Task:** Task 011 — Persisted theme favourites (R1)
- **Baseline:** `main` at commit `08b599b`
- **Status:** Complete, committed, pushed, deployed, and verified
- **Completed commit:** `c54ebb4` — `feat: retain favourite themes`
- **Release:** Application, manifest, service worker, and cache version `1.13.0`; schema remains v5
- **Behavior:** Lets people retain preferred built-in themes locally. A visible star marks each favourite, and the selected theme can be added or removed without changing card data.
- **Compatibility:** Theme rendering, card state, save/reopen, backup/import, previews, exports, occasion isolation, photo priority, manual centerpiece choices, and offline behavior remain unchanged.
- **Verification:** Local syntax/static checks and focused mobile/desktop browser checks passed for favourite add/remove, persisted markers, theme switching, recipient/sender/edited-message preservation, responsive layout, PNG export, and offline startup. GitHub Pages run `35657587977` succeeded; live HTTPS version/assets, favourite persistence, service-worker control, and offline restart passed.

## 9. Current Task

- **Approved Current Task:** Task 044 — extend upward layout positioning after a smaller centerpiece and place Greeting size alongside the related layout controls.
- **Current release:** v1.42.0 (application, manifest, service worker and shell cache), schema v7, backup format `atul-birthday-card-studio` version 1.
- **Owner decision recorded:** no R5 personal sub-occasion selector; R5 is complete at the approved relationship-aware scope.

### Task 044 Impact Record and Implementation Record — Flexible message balance

- **Baseline:** `main` at `2dc3f8a`, Task 043 release v1.41.0, clean and equal to `origin/main`.
- **Reported evidence:** After reducing a Birthday centerpiece to 352px, the Message vertical position control stopped at -90px despite substantial free space below the image. Greeting size was separated from the other controls used to balance that same block.
- **Change:** Message vertical position now ranges from -320px to +140px. The renderer and stamp-protection geometry share those bounds and still clamp the message below the current photo or centerpiece, so the extra upward travel cannot overlap it. Greeting size has moved from Type to Layout without changing its saved value or behavior.
- **Compatibility:** No schema, content, photo, occasion, manual centerpiece selection, export, backup, or offline change. Existing saved layout values retain their appearance; the only new behaviour is additional upward range when the owner chooses it.
- **Verification (local, PASS):** JavaScript and service-worker syntax, manifest parsing, and whitespace checks passed. Fresh Chrome verified a 352px centerpiece with Message vertical position at -320px: the heading and recipient moved into the released space below the image, the image remained clear, and all eight editor tabs remained available. It also confirmed Greeting size is present in Layout and absent from Type.
- **Live verification:** Pending deployment of v1.42.0.

### Task 043 Impact Record and Implementation Record — Editable occasion heading

- **Baseline:** `main` at `8a6080e`, Task 042 release v1.40.0, clean and equal to `origin/main`.
- **Reported evidence:** A Birthday card can show decorative birthday artwork while a poetic generated greeting does not itself say Happy Birthday. The owner requested a large occasion title below the photo or centerpiece, editable because festival wording can require a precise local choice.
- **Change:** Every occasion now has an editable, per-occasion heading displayed below the photo/centerpiece and above the recipient name. Defaults include Happy Birthday, Happy Diwali, Saal Mubarak, Eid Mubarak, and a restrained With Deepest Sympathy for Condolence. Clearing the field hides the heading. Birthday Poetic and Milestone automatic drafts now explicitly use Birthday wording.
- **Data and compatibility:** Schema v7 adds `content.occasionHeading`; migration gives existing cards their selected occasion’s default and preserves an intentionally blank user edit. The heading is isolated per occasion, is included in normal saved-card and backup data, and never changes existing names, greeting text, date, uploaded photo, manual crop, centrepiece selection, or offline behavior.
- **Verification (local, PASS):** JavaScript and service-worker syntax, manifest parsing, and whitespace checks passed. A fresh Chrome profile confirmed the default Birthday heading, edited it to `Happy Birthday, Jayeshbhai`, switched to Diwali to receive its own `Happy Diwali` default, and switched back to confirm the Birthday edit was preserved. The editor retained all eight tabs and its content. A separate Birthday test generated each of the five emotion choices and confirmed each message contains Birthday wording.
- **Live verification (PASS):** GitHub Pages workflow `36190359495` deployed commit `43fff2f`; a fresh Chrome profile opened the live app at v1.41.0 with the default `Happy Birthday` heading and all eight editor tabs present.

### Task 042 Impact Record and Implementation Record — Stable editor compositor layer

- **Baseline:** `main` at `9b66b51`, Task 041 release v1.39.0, clean and equal to `origin/main`.
- **Reported evidence:** After Auto-write Greeting, Show date on card, or Show footer, the owner’s desktop app showed an empty editor-panel surface while the card itself still redrew. The three controls use different logic but each schedules the same canvas redraw.
- **Finding:** The common visual layer was the translucent `backdrop-filter` editor panel beside a large, redrawing canvas. The handlers and their state mutations are independent; clean profile runs retained the DOM, but the owner’s repeated screenshots are consistent with a Chromium/GPU compositing failure that renders the panel’s surface but drops its child layer.
- **Change:** The editor is now an isolated, nearly opaque panel with no `backdrop-filter`. It preserves the visual hierarchy but prevents its controls from sharing the canvas backdrop-compositor path. The Birthday signature-plate correction from Task 041 is retained.
- **Compatibility:** No state/schema/backup/rendering-data change. All occasions, card values, photo behavior, manual selections, and offline behaviour are unchanged.
- **Verification (local, PASS):** JavaScript and service-worker syntax, manifest parsing, and whitespace checks passed. In a fresh service-worker-blocked browser profile, Date, Footer, and Auto-write Greeting were enabled in one sequence: all eight tabs, all three editor sections, and panel content remained present; no backdrop filter was computed on the editor.
- **Live verification (PASS):** GitHub Pages workflow `36187096483` deployed commit `7c09972`; the live application script reports v1.40.0.
- **Owner verification requested:** Fully close and reopen the installed app (or hard-refresh the browser) before checking Auto-write Greeting, Show date on card, and Show footer. This ensures the v1.40.0 service-worker shell replaces the previous v1.39.0 shell.

### Task 041 Impact Record and Implementation Record — Birthday signature legibility

- **Baseline:** `main` at `8c27548`, Task 040 release v1.38.0, clean and equal to `origin/main`.
- **Reported evidence:** The owner’s Romantic Pink Birthday card carried a sender value but its footer was visually lost against detailed flowers and cake. The same device still reported the editor panel blanking after Show footer or Show date on card.
- **Finding:** The sender is pinned to the richly detailed lower portion of full-card artwork, so even correct dark ink can blend into local image detail. Fresh service-worker-blocked browser runs with recipient, sender, greeting, Romantic Pink artwork, and Show date enabled retain all eight tabs and three editor sections without an error; the shared date/footer state handlers do not clear the editor DOM. A new shell remains the safe recovery for a device holding mismatched cached assets.
- **Change:** Birthday artwork now draws a restrained tonal footer veil plus a compact rounded signature plate behind a sender. It adapts to dark or light artwork ink, does not move the sender/date, and applies only when an artwork setting is selected. v1.39.0 forces a new shell cache.
- **Compatibility:** No content, saved-date, sender, photo, centrepiece, occasion, backup, or schema mutation. Plain theme backgrounds and all non-Birthday cards remain unchanged.
- **Verification (local, PASS):** JavaScript and service-worker syntax plus whitespace checks passed. A fresh browser profile with Romantic Pink, Mahesh, Atul Dhuvad, greeting, and date enabled shows a clear sender signature plate; the editor retains eight tabs and all three sections, with no browser errors.
- **Live verification (PASS):** GitHub Pages workflow `36184424181` deployed commit `94267f8`; a fresh live page reports v1.39.0. Owner-device verification remains needed for the reported blank-panel path because it is not reproducible in clean local or live profiles.

### Task 040 Impact Record and Implementation Record — Birthday contrast and fresh shell

- **Baseline:** `main` at `89fcfb2`, Task 039 release v1.37.0, clean and equal to `origin/main`.
- **Reported evidence:** On the owner’s saved Birthday card, using a light full-card Birthday design left recipient, greeting, and sender text in the white/light artwork treatment; the recipient was especially faint. The owner also observed a blank editor panel after enabling Show date on card.
- **Finding:** The new Birthday artwork path treated every design as dark, so all nine inherited the light festival-artwork text treatment. The date-toggle path was reproduced in a fresh local profile and against live v1.37.0: the checkbox enabled correctly, the editor retained its eight tabs and three child sections, and no browser error occurred. This points to a stale mixed application shell rather than a data or date-handler failure.
- **Change:** Each Birthday design now declares the required ink treatment. The seven light settings use solid dark plum ink for recipient, message, and sender; Candlelit Elegance and Midnight Silver retain light ink. v1.38.0 creates a fresh application cache so an updated shell cannot mix with the previous implementation. Existing card values and date visibility are not altered.
- **Compatibility:** No schema/backup change. Saved cards, photo/manual framing, centrepieces, occasions, and offline runtime caching remain intact. New-card recipient/sender/date defaults are deliberately unchanged pending exact owner-provided values; stored cards are never overwritten.
- **Verification (local, PASS):** JavaScript syntax, service-worker syntax, manifest parsing, and whitespace checks passed. A fresh service-worker-blocked browser profile visually confirmed dark recipient/sender ink on Bright Celebration. With recipient, sender, greeting, and date enabled, the date switch retained all eight editor tabs and the panel’s content with no browser errors.
- **Not yet verified:** Live v1.38.0 after deployment, plus the exact recipient, sender, and date to use for new-card defaults.

### Task 039 Impact Record and Implementation Record — Birthday background library

- **Baseline:** `main` at `74e62a3`, Task 038 release v1.36.0, clean and equal to `origin/main`.
- **Source and scope:** Nine owner-supplied Birthday assets from the internal Birthday Card Maker and WishCraft/Greeting Card & Poster Studio libraries are bundled under `assets/birthday-designs/`. No WishCraft product name or branding is presented in Atul Card Studio. The library is visible only while Birthday is selected.
- **Change:** Content now offers the original selected-theme background plus nine named full-card Birthday settings. Selecting a setting changes only `content.birthdayDesignId`; recipient, sender, message, uploaded photo, manual framing/focus, centrepiece, typography, foil, border, decorations, and all other occasion state remain unchanged. The default remains the existing theme background. Full-card artwork suppresses theme corner decorations to prevent visual clashes, while photo/manual centerpiece and the card border remain available.
- **Offline and compatibility:** Artwork is not added to the mandatory shell cache. It is bundled on the same origin and cached after first online use by the existing runtime strategy. The optional Birthday field is safely ignored by old saved cards and persisted inside Birthday's already isolated content state; no schema or backup-format change is required.
- **Verification (local, PASS):** JavaScript syntax and whitespace checks passed. All ten choices (theme background plus nine artworks) render without browser errors. A visual review of Candlelit Elegance confirms artwork, readable text, border, and manual centerpiece compose correctly. Switching Birthday → Anniversary hides the Birthday library; switching back restores the selected Birthday setting. The library holds 1,680,983 bytes and is absent from `SHELL_ASSETS`.
- **Live verification (PASS):** GitHub Pages workflow `36179848194` deployed commit `9bad140`. The live mobile page reports v1.37.0, shows all ten Birthday choices, keeps the Birthday-only field visible for Birthday, and has no horizontal page overflow at 390px.

### Task 038 Impact Record and Implementation Record — Mobile editor and canvas gestures

- **Baseline:** `main` at commit `574e986`, clean and equal to `origin/main`; v1.35.0.
- **Reported evidence:** On a phone, the card preview appeared before the editor, forcing the maker to scroll past a large movable image to reach the Content/Photo/Theme/Layout controls. The horizontally arranged controls were difficult to reach; a one-finger scroll on an uploaded image could instead move the photo. Native image capture itself works and should not be replaced with a browser permission flow.
- **Change:** On portrait viewports below 980px, the workspace becomes a fixed vertical split: a compact live card preview remains at the top while the editor controls scroll independently below. In landscape, preview and editor are side by side. The eight editor tabs wrap visibly rather than requiring horizontal side-scrolling. The header is allowed to scroll away on phones so it cannot cover the workspace. The card canvas now permits one-finger vertical page scrolling; touch photo panning starts only after a deliberate horizontal movement, while mouse panning and two-finger pinch framing remain available. Native `capture` remains unchanged: the phone camera flow is responsible for its own permission/consent handling.
- **Compatibility:** Desktop layout is unchanged. No state/schema/backup/rendering data changes: saved cards, photo transforms, focused-person selection, stamps, manual choices, occasions, preview/export parity, and offline behaviour remain intact.
- **Verification (local, PASS):** JavaScript syntax and whitespace checks passed. At 390x844 in a touch-enabled browser, the compact preview occupies the upper split while the editor occupies the lower split; all eight tabs fit without horizontal overflow; scrolling the editor panel leaves the card preview and editor frame fixed; `touch-action: pan-y` is computed on the card. At 844x390 landscape, the preview and editor are side by side with no horizontal overflow. No browser errors occurred during those checks.
- **Not yet verified:** A physical phone should confirm the native camera capture flow and one-finger vertical scrolling over a real uploaded image; these depend on the device browser.

### Task 037 Impact Record and Implementation Record — Birthday usability corrections

- **Baseline:** `main` at commit `c13d75b`, clean and equal to `origin/main`; v1.34.0.
- **Reported evidence:** Desktop Birthday-card use showed a saved Mahesh/Atul card reopening with its historic 21 September date, a group-photo focus that needed a tighter framed crop, slow/flickering design changes, a low-contrast Soft Care recipient name, and later tabs hidden behind horizontal scrolling. The Windows camera-labelled control opened photo selection.
- **Finding:** Recipient and Sender defaults were already blank in `createDefaultProject`; the observed names and 21 September date belong to the saved card and must remain intact. New cards did print their date by default. The 3x photo-zoom ceiling was too restrictive for a wide framed crop. Each design application changed `layout.frameStyle`, which unnecessarily invalidated ten live design thumbnails even though every preset supplies its own frame. Soft Care rendered foil-styled recipient text too faintly on light stock. The desktop tab row scrolled horizontally, concealing Foil, Finishing, and Audio. Windows browsers correctly treat the HTML `capture` hint as file selection; no direct desktop-camera permission flow existed.
- **Change:** New cards retain today's device-local date in the editable field but leave date printing off until its switch is enabled; saved dates remain untouched. The unified photo zoom bound is 5x for renderer, slider, pinch, and Smart Person Focus auto-fit so framed photos can isolate a selected person. Design thumbnails now ignore the current frame in their cache signature, removing the redundant re-render caused by applying a preset. Light themes render the recipient in the theme's dark ink while preserving foil on dark cards; the sender already uses the light-theme signature ink. Desktop tabs wrap into two visible rows. The camera control now says `Take photo (mobile)` and explains that Windows opens photo selection.
- **Compatibility:** No migration or schema change. Existing names, sender, card date, photo data, focused person, manual framing, centrepiece choices, messages, occasions, backups, and offline operation remain preserved. Existing cards keep their date visibility and their stored date; only newly created cards default to hidden date printing.
- **Verification (local, PASS):** `node --check` for app and service worker; manifest JSON parse; and whitespace check. Headless Chrome on a fresh local profile verified blank new-card recipient/sender fields, local current-date field, date switch off, 5x framed zoom, Circle selection, all eight desktop tab labels without horizontal overflow, and direct Foil/Finishing/Audio panels without Next. Soft Care was visually inspected with a recipient and sender: both are readable on the light background. No page errors occurred.
- **Not yet verified:** Physical mobile camera invocation (browser/device controlled), live GitHub Pages, and real-device touch pinch. These require the released build.

### Task 035 Impact Record and Implementation Record — R5 message-pool review

- **Baseline:** `main` at commit `39946cb`; live site v1.33.0 (Task 034).
- **Scope:** Reviewed every relationship-aware message template for Birthday, Anniversary, Congratulations, New Baby, New Home, Graduation, Retirement, Get Well, Friendship / Thanks, and Condolence (`GreetingGenerator`, `js/app.js:1954–2819`; 478 templates across all occasions, relationship groups, and tones) for awkward, ambiguous, Western-cliché, duplicated, or relationship-inappropriate wording. Did not implement the personal sub-occasion selector (owner decision required, out of scope by instruction).
- **Method:** Full manual read of the module plus three automated checks run under Node: (1) every template's worst-case filled length (40-character name, longest relationship word) against the 220-character cap; (2) a regex scan of Condolence and Get Well templates against their own output-safety patterns, to catch any built-in message that would trip its own guard; (3) exact-string duplicate detection across every relationship+tone combination that `occasionRelationshipPool()` can actually return to a user in the same Regenerate pool.
- **Finding:** `friendship-thanks.friend` (`js/app.js:2690–2693`) returned a "friend"-specific line that was word-for-word identical to the generic pool's line for `heartfelt` and `poetic`, and one word different for `playful` ("Friends like you" vs "Good friends like you"). Because the `friend` relationship group offers the generic pool as Regenerate alternatives by design, this meant a user thanking a friend had roughly a two-in-three chance of Regenerate showing the same text twice instead of genuine variety. No other exact or near-duplicate was found within any single selectable pool; no template exceeded the character cap; no built-in Get Well/Condolence message tripped its own safety guard; no Western clichés were found; all other reviewed wording read as warm, Indian-context appropriate, and respectful of elders and teachers.
- **Change (approved by owner before applying):** Reworded the three `friendship-thanks.friend` lines to be genuinely distinct from the generic pool while keeping the same meaning and register. No other template, no logic, no schema, and no other occasion's wording changed.
- **Release:** Application, manifest, service worker, and cache version `1.34.0`.
- **Verified locally (Node, PASS):** Re-ran the length and duplicate-detection checks against the edited file — 478/478 templates still within the 220-character cap, 0 duplicate entries remain in any selectable pool (down from 2 before the fix); `node -c js/app.js`, `node -c sw.js`, and `manifest.json` JSON-parse all clean.
- **Verified locally (headless Chromium via Playwright, PASS, 14/14):** message generation for the edited pool (friendship-thanks/friend/heartfelt renders the new wording); relationship change alters generated wording (elder vs. friend); manual edit is retained and not overwritten by regeneration; occasion switching preserves each occasion's own content in isolation (Birthday vs. Friendship & Thanks); Get Well cross-occasion wording triggers the safety warning and blocks PNG export with the correct message; the warning clears once corrected; Undo reverts and Redo re-applies a manual edit; save/reopen survives a full page reload; backup export downloads a file and importing it creates a new project with the original recipient and message intact; no horizontal overflow at 360px mobile width; offline reload (service worker `activated`, network forced offline) still serves the app shell.
- **Deployment evidence:** This session runs in a sandboxed container whose network egress to `jayajd70-ops.github.io` is blocked by policy (confirmed: proxy returns 403 on CONNECT). Live rendered-page verification could not be performed from this session. The only deployment evidence available here is the GitHub Actions "pages build and deployment" run for the pushed commit reporting `conclusion: success` via the GitHub API — record the run URL once available and confirm the live version banner reads v1.34.0 from a normal browser before considering this task's deployment fully verified.
- **Later owner decision:** no personal sub-occasion selector is wanted; R5 is closed at the relationship-aware scope.

### Task 034 Impact Record and Implementation Record — Design Library active state (audit P2)

- **Baseline:** `main` at commit `ec0512e`; live site v1.32.0; independent audit of 24 September 2026 found no other functional issue.
- **Finding (independent audit, P2, non-blocking):** After choosing a design, changing its typography mood or foil intensity left the design marked as selected (`aria-checked="true"`), although both fields are part of the preset. `DesignLibrary.isActive` compared theme, foil palette, foil finish, pairing and border but not mood or foil intensity. While verifying, a second cause was found: the design radios were only re-marked on theme, occasion, Undo/Redo and initial load, so edits made in other tabs did not refresh the mark at all.
- **Change:** `isActive` also compares `typography.mood` and `foil.intensity`; a new `markActiveDesign()` re-marks the design radios on every state change (cheap: ten attribute updates, no re-render of thumbnails). No state, schema, backup, rendering or layout change.
- **Release:** Application, manifest, service worker, and cache version `1.33.0`.
- **Verified locally (headless Chrome, PASS):** Emerald Elegance applied → marked; mood changed to Romantic → no design marked (recipient untouched); Undo → marked again; foil intensity 40 → unmarked; back to 72 (the preset value) → marked; two Undos → marked; choosing another font pairing → unmarked; Royal Gold applied → marked, and still marked after a browser restart.

### Current R1–R18 Status (Task 031, 24 September 2026)

This replaces nothing above: the matrix recorded after Task 024 and every task record remain as historical evidence of what was true at the time.

| Req | Status | Basis / remaining gap |
|---|---|---|
| R1 Design library | Complete for the approved scope | Ten curated design presets with live previews, suitability and local favourites (Task 025). Acquisition, daily or AI designs are parked decisions. |
| R2 Templates, borders, no-photo | Complete for the approved scope | Five border families (Task 026); existing photo/no-photo compositions and medallion kept. Broader visual expansion parked. |
| R3 Coordinated theme/typography | Complete | Unchanged since earlier tasks. |
| R4 Decorations and emoji | Complete, with a device limit | Optional grouped library, 5 artworks and 52 emoji, keyboard move/delete, On-this-card list (Task 027). Emoji look depends on the device’s emoji font. |
| R5 Message generator | Complete | Relationship-aware for every personal occasion; Indian-context wording rule applied; all 478 templates reviewed line-by-line and one duplicate-wording defect fixed (Task 035). The owner declined a personal sub-occasion selector. |
| R6 Photo adjustment | Complete | |
| R7 Persistent state | Complete | Task 032 closed a data-loss path (Undo after photo replacement). |
| R8 Composition fine-tune | Complete | |
| R9 Mobile navigation | Complete | |
| R10 Occasions and festivals | Complete | Task 033 fixed unreadable text on festival artwork with a light theme. |
| R11 Photo input | Complete | |
| R12 Remove/replace/no-photo | Complete | Task 032. |
| R13 Undo/Redo | Complete | Tasks 024 and 032. |
| R14 Responsive workspace | Complete | |
| R15 Smart Person Focus | Complete | Verified live online and after a real offline browser restart (Task 031). |
| R16 Self-hosted fonts/offline | Complete | Real offline restart verified; Task 030 stale-precache fix reproduced and confirmed. |
| R17 Date | Complete | |
| R18 Creator footer | Complete | Approved 24 September 2026; device-local, excluded from backups (Task 028). |

### Task 031 Record — Final Verification and Audit Handover

- **Baseline:** `main` at commit `44ac34f`, clean, equal to `origin/main`; application, manifest and service worker v1.30.0 locally and on GitHub Pages.
- **Method:** Installed Google Chrome driven through the DevTools protocol in headless mode with clean temporary profiles (outside the repository); a real browser restart with all traffic sent to a dead proxy for the offline run; licensed fixtures outside the repository (Apollo 11 crew portrait, NASA, public domain; MediaPipe sample portrait, Apache-2.0). No fixture, profile, export or backup was committed. In-page instrumentation only stubbed the file-save picker so exports could be inspected.
- **Final results on live v1.32.0 (PASS unless stated):**
  1. **Real offline restart:** after the service worker installed (53 shell entries) the browser was closed and restarted with the network unreachable (an uncontrolled request failed); the page, `js/app.js` and CSS were served by the service worker and the editor opened with the saved card (name, manual message, Smart Person Focus box, border, decorations, device creator-footer setting) identical to the saved state.
  2. **Smart Person Focus on the live HTTPS app:** fixture chosen through the normal photo input; 3 people detected; nothing selected until chosen; choosing person 2 auto-fitted the photo and saved only the focus box; Undo and Redo worked; replacing the photo cleared the focus and the choices; save/reopen kept the focus; PNG export 1200 x 1760; the first use downloaded and cached exactly 4 detector files (12,465,471 bytes); after the offline restart detection ran again from the cache (3 people), a different person could be chosen and Undo restored the saved one.
  3. **Backup round trip:** a card with a design preset, the Regal border, a library artwork, a library emoji, a manual message and a focused photo was backed up and imported offline into a new card: new id, every card field equal (name, relationship, sender, message and mode, theme, foil, pairing, border, decoration ids and positions, focus box, zoom), photo renders; the backup contains no creator-footer data and opening the imported card did not change the device creator setting.
  4. **Creator footer:** a 40-character name across all 5 font pairings on light, dark and festival cards: the line always sits below the date (rows 1712–1731 of 1760), no collisions with the date or sender, readable in every case (visually inspected); hidden and blank settings change no pixels. One first-pass measurement (dark theme, Playfair pairing) showed changed pixels from row 1672; a repeat with identical renders confirmed to be deterministic gave row 1713, so the first value came from web fonts still loading during the harness’s direct renders (the app’s own Export path waits for fonts).
  5. **Borders:** 5 borders x 6 cards (photo, no-photo, Get Well, Condolence, Diwali dark and light theme): 30 exports of 1200 x 1760, none blank, no text overflow, clamping or missing assets, no collisions; Condolence output is pixel-identical for every border choice; choosing a border in the UI changes only `layout.frameStyle`. Three full-size exports through the real Export button inspected.
  6. **Decoration library:** 17 items covering every group (two per general group, one per occasion-specific group): each added, moved by real keyboard events (arrow and Shift+arrow), one Undo step per key press, Redo restores; Delete key removes and Undo restores; decorations for each occasion survive a browser restart; Condolence has none; PNG export with decorations 1200 x 1760.
  7. **Task 030 stale-cache fix, exact reproduction:** a local copy served with `Cache-Control: max-age=600` (as GitHub Pages does), version A installed and loaded, the server switched to version B, the service worker updated: with the pre-Task-030 worker the new `vB` shell stored **A’s** `js/app.js`; with the current worker it stored **B’s**. The revalidation request was checked separately: the old `fetch(request)` returned the stale copy while `cache: "no-cache"` returned the new file.
- **Defects found and fixed during Task 031:** Task 032 (Undo after replacing or removing a photo/audio could lose it after a restart) and Task 033 (festival cards unreadable with a light theme). Both are recorded below with evidence.
- **Observations, not changed:** A newly added decoration is always placed at the card centre, over the recipient name, until moved or Auto-arranged (existing behaviour; the overlap warning shows). In headless test runs, holding many full-size canvases at once produced blank canvases; the evidence above was regenerated by rendering one canvas at a time, and this is a test-harness effect, not seen in the app.

### Final Evidence and Limitations (for the independent audit)

- **Verified on the live site:** installation, real offline restart, detector caching and offline reuse, backup export/import, export dimensions, border and footer rendering, decoration keyboard controls, per-occasion persistence, service-worker cache contents (53 shell entries plus a separate detector cache).
- **NOT TESTED:** a physical phone or tablet (touch dragging, pinch, camera capture); iOS Safari and Firefox (all runtime checks used Chromium); Windows airplane mode itself (the offline run cut the network at browser level, which the service worker cannot tell apart); emoji appearance on other operating systems; two tabs open at once (see the Task 032 known limit); a family read-through of the relationship message lines.
- **Privacy/release gate for this series:** no real private data, secrets, fixtures, exports, backups or browser profiles were committed; the application still makes no third-party network requests at runtime (Content-Security-Policy `connect-src 'self' blob: data:`).
- **Owner decisions still open:** personal sub-occasion selector (R5); whether new decorations should be placed away from the text automatically; design acquisition/AI generation, calendar/reminders, People & Events, renaming, a separate festival app, background extraction and photo enhancement remain parked.

### Task 033 Impact Record and Implementation Record — Festival cards unreadable with a light theme

- **Baseline:** `main` at commit `8fe862e`; live site serves v1.31.0.
- **Evidence (Task 031, item 4/5 renders of the live app):** With the Pearl Marble theme (the only theme marked `light`) on a festival card, the greeting, relationship line, sender and date were drawn in the theme’s dark ink over the darkened festival artwork and were close to invisible; the sender also skipped the foil treatment. Reachable in normal use: the Pearl Heirloom, Blush Rose Gold and Soft Care designs use Pearl Marble, and the theme is kept when the occasion is switched to a festival. Pre-existing since festival artwork was introduced; not caused by Tasks 025–032. The creator footer (Task 028) already handled this case.
- **Change (renderer only):** `renderBackground` reports when festival artwork was actually drawn; in that case a light theme’s text uses light ink (`#f7f2e9` text, `#e6dccb` muted/signature) and the sender uses the same foil path as dark themes. If the artwork fails to load, the theme background is drawn and the theme’s own ink is kept. Dark themes, non-festival cards and Condolence are unaffected. No state, schema, backup or UI change.
- **Release:** Application, manifest, service worker, and cache version `1.32.0`; schema remains v6.
- **Verified locally (headless Chrome, export renderer, PASS):** Diwali with Midnight Obsidian and with Pearl Marble side by side: greeting, relationship line, sender and date are clearly legible on both (visually inspected at full resolution).
- **Status:** Complete, committed, pushed, deployed, and verified. Commit `762f694` (`fix: use light ink for card text on festival artwork with a light theme`), GitHub Pages run [`36047138209`](https://github.com/jayajd70-ops/Atul-Card-Studio/actions/runs/36047138209). Live proof: the 30-card border montage on v1.32.0 shows the Pearl Marble Diwali row as legible as the dark-theme row.

### Task 032 Impact Record and Implementation Record — Undo after replacing a photo must not lose it

- **Baseline:** `main` at commit `44ac34f`; live site serves v1.30.0.
- **Evidence (Task 031, real headless Chrome, clean profile, live v1.30.0):** A photo was uploaded, replaced with another, and the replacement was undone. The editor showed the original photo again (from memory), but replacing had already deleted the original file from IndexedDB. After a browser restart the card referred to a missing photo (`missingAssets` contained its id) and the photo was gone from preview and export. The same pattern applied to Remove photo, audio replacement and Remove audio, which all deleted the file immediately while Undo could restore the reference.
- **Requirement:** R7 (never lose the user’s work), R12 (remove/replace), R13 (Undo/Redo).
- **Change:** Replacing or removing a photo or audio no longer deletes the stored file at that moment. `ProjectVault.pruneUnreferencedAssets()` runs once at startup, before the last card is opened and while no Undo history exists, and deletes stored assets (and their `__preview` copies) that no saved card references. Deleting a card is unchanged. No schema, backup-format or UI change.
- **Privacy note:** A replaced private photo now stays in this device’s IndexedDB until the next app start instead of being deleted immediately; it never leaves the device.
- **Known limit:** With two tabs open at once, starting the app in the second tab can tidy a file that the first tab’s Undo history still refers to (the same outcome as before this fix, not a regression).
- **Release:** Application, manifest, service worker, and cache version `1.31.0`; schema remains v6.
- **Verified locally (real headless Chrome, three restarts, PASS):** replace → Undo → restart keeps the original photo (renders, no missing asset) and the unused replacement is tidied (3 stored records → 2); remove → Undo → restart keeps the photo; replace without Undo → restart removes the old file and its preview and keeps the new one (3 → 1).
- **Status:** Complete, committed, pushed, deployed, and verified. Commit `8fe862e` (`fix: keep replaced photos and audio until startup so Undo cannot lose them`), GitHub Pages run [`36043896616`](https://github.com/jayajd70-ops/Atul-Card-Studio/actions/runs/36043896616). Live proof: on v1.31.0 and again on v1.32.0, replace → Undo → offline browser restart kept the photo (no missing asset) with its Smart Person Focus box.

### Task 030 Impact Record and Implementation Record

- **Baseline:** `main` at commit `e1c1726`; live site serves v1.29.0.
- **Evidence:** During the Task 029 live check, the v1.29.0 service worker installed while the browser still held the 1.28.0 `js/app.js` in its HTTP cache (GitHub Pages sends `Cache-Control: max-age=600`). `cache.add()` and the stale-while-revalidate refresh both go through that HTTP cache, so the `atul-shell-v1.29.0` cache stored 1.28.0 code and kept serving it until the HTTP copy expired. Any user who opened the app within 10 minutes before a release could run mixed versions for a while.
- **Change (`sw.js` only):** Install precaches each shell file with `cache: "reload"`; the background refresh uses `cache: "no-cache"` (a conditional request, normally a 304) and, for page navigations, re-fetches by URL because a navigation request cannot be re-initialised. Cache names, the precache list (53 entries), the detector cache, the offline fallback and the private-media guard are unchanged.
- **Release:** Application, manifest, service worker, and cache version `1.30.0`; schema remains v6.
- **Completed commit:** `dddc963` — `fix: bypass HTTP cache when the service worker precaches and revalidates`
- **Live verification (PASS):** GitHub Pages run [`36038690218`](https://github.com/jayajd70-ops/Atul-Card-Studio/actions/runs/36038690218) succeeded. In the same browser profile that had just run 1.29.0, the new worker installed `atul-shell-v1.30.0` whose `js/app.js` and `manifest.json` were already 1.30.0 while it was still installing; after activation the only shell cache is v1.30.0 with 53 entries; the reloaded page reports v1.30.0 under service-worker control with the page and `js/app.js` served from the cache (0 bytes transferred) and all ten design tiles present.
- **Limit:** This was not a strictly controlled reproduction (the exact age of the old HTTP-cached copy at install time was not measured); the fix follows the documented `cache: "reload"` behaviour. Real airplane-mode restart NOT TESTED.

### Task 029 Impact Record

- **Baseline:** `main` at commit `13620c6`; clean; aligned with `origin/main`; live site serves v1.28.0.
- **Existing behavior found:** Relationship-aware generation existed only for Birthday, Anniversary and Condolence. Congratulations, New Baby, New Home, Graduation, Retirement, Get Well and Friendship / Thanks ignored the Relationship field, so a card to a spouse or a grandparent read the same as one to a colleague. Four generic lines used casual Western idioms (“smallest and most important team member”, “at least a little sleep”, “a reliable internet connection”, “friendship points”).
- **Requirement:** R5 (relationship-aware wording; tone applied inside the occasion; Indian-context rule: respect for elders and teachers, warm family voice, dignified professional voice, no Western clichés; semantic correctness over variety).
- **Design:** Relationships are grouped as elder (grandparents, parents, uncle, aunt, teacher, mentor), spouse (spouse, partner, wife, husband), family (sibling, child, cousin, relative), friend (friend, family friend, neighbour) and professional (manager, colleague), reusing the existing alias normaliser. Each of the seven occasions has one authored line per group and tone (140 lines). Friend and professional groups also keep the reviewed generic lines as Regenerate alternatives; elder, spouse and family use only their dedicated line, because generic lines can be wrong for them (for example “your family” to a spouse). An unrecognised or blank relationship behaves exactly as before. Elder lines avoid “the whole family” so they remain correct for teachers and mentors.
- **State/data impact:** None; only generator text. Manual and edited messages, message modes, occasion isolation and the 220-character limit are unchanged.
- **UI/layout/preview/export impact:** None.
- **Smallest safe plan:** Add the relationship lines and one classifier, route `generate` and `fallbackFor` through them before the generic pools, replace the four idioms, release 1.29.0.

### Task 029 Implementation Record

- **Baseline:** `main` at commit `13620c6`
- **Status:** Complete, committed, pushed, deployed, and verified
- **Completed commit:** `890639f` — `feat: add relationship-aware messages for remaining personal occasions (R5)`
- **Live verification:** GitHub Pages run [`36038188446`](https://github.com/jayajd70-ops/Atul-Card-Studio/actions/runs/36038188446) succeeded; live manifest, service worker and app serve 1.29.0; cache `atul-shell-v1.29.0` has 53 entries; on the live page Retirement with “Grandmother” (Heartfelt) gives the elder line and repeats it on Regenerate, as designed. **Defect found during this check (fixed in Task 030):** the new service worker installed while the browser still held the 1.28.0 `js/app.js` in its HTTP cache (GitHub Pages `max-age=600`), so the v1.29.0 shell briefly contained 1.28.0 code until a later reload refreshed it.
- **Release:** Application, manifest, service worker, and cache version `1.29.0`; schema remains v6; no new assets
- **Verified (Node, real generator code, PASS):** 3,192 generated messages across the 7 occasions, 23 relationship inputs (including aliases such as “Nani”, “my father”, “Best Friend”, blank and an unrecognised “Landlord”), 4 tones and a 40-character name: longest 179 characters (limit 220), no unfilled placeholders, every Get Well line passes the Get Well output guard, no cross-occasion wording (for example no “congratulations” on Get Well or Thanks, no “recover” outside Get Well), no listed Western idioms; the auto-write first draft is deterministic; Birthday, Anniversary, Condolence and Diwali output is unchanged.
- **Verified in the app (Chrome, PASS):** New Baby with “Wife” gives the “our little one” lines per tone; Get Well with “Colleague” gives a workplace-appropriate draft; a manual Get Well message survives switching to New Baby and back, each occasion keeps its own message and relationship, recipient and sender are untouched; PNG export is exactly 1200 x 1760.
- **NOT TESTED:** Review of all 140 new lines by a native-speaker family reader (authored and machine-checked only); a personal sub-occasion selector (still not present, needs a product decision); real offline restart and live service-worker behavior until the live check below.

### Task 028 Impact Record

- **Baseline:** `main` at commit `0669232`; clean; aligned with `origin/main`; live site serves v1.27.0.
- **Requirement:** R18 (configurable creator name, nothing shown when blank or hidden, Show/Hide option, name may be stored locally, separate from Sender).
- **Decision taken within the spec:** The footer is a device preference (`creator-footer` in the IndexedDB `settings` store), not card data. It is never written into a card or a backup, so a shared or imported card never carries someone else’s attribution, and schema v6 and the backup format are unchanged. Consequence: the footer appears on every card made on that device while it is switched on, including reopened older cards.
- **UI/layout impact:** A collapsed “Creator footer (optional)” section in the Content tab, under the date: name field (40 characters) and a Show switch, off by default.
- **Preview/export impact:** One small centred line at the very bottom of the card (below the date, outside the border), in the card’s muted colour with a contrast halo; on festival artwork it is always light. Shrinks to fit rather than wrapping. Preview and export share the renderer.
- **Regression risks:** Overlap with the date or border, legibility on festival art, confusion with Sender, backup contamination.
- **Smallest safe plan:** `CreatorFooter` preference module, one draw call at the end of the text layer, the UI above; release 1.28.0 with no new assets.

### Task 028 Implementation Record

- **Baseline:** `main` at commit `0669232`
- **Status:** Complete, committed, pushed, deployed, and verified
- **Completed commit:** `b7ba242` — `feat: add optional creator footer stored on the device (R18)`
- **Live verification:** GitHub Pages run [`36037568169`](https://github.com/jayajd70-ops/Atul-Card-Studio/actions/runs/36037568169) succeeded; live manifest, service worker and app serve 1.28.0; in a fresh browser profile the service worker installed `atul-shell-v1.28.0` with 53 entries and controlled the page; the footer is off by default, a live PNG export (1200 x 1760) has no footer when off and shows it when switched on with a name, and `js/app.js` is served from the cache. Real airplane-mode restart NOT TESTED.
- **Release:** Application, manifest, service worker, and cache version `1.28.0`; schema remains v6; no new assets (53-entry shell precache unchanged)
- **Verified locally (Chrome, PASS):** Off by default; switching on with a name draws “Developed and created by [Name]” in the PNG export and switching off or blanking the name draws nothing (pixel check of the footer area); extra spaces in the name are collapsed; the Sender field is unchanged and Undo history is unaffected; name and switch persist across reload; a backup contains neither the name nor any creator field; visually checked on a light (Pearl Marble), dark (Midnight Obsidian), Condolence, Diwali and Holi card: the line sits below the date without touching the border, and a first attempt that was nearly invisible on festival artwork was fixed with a light colour and halo there; PNG export is exactly 1200 x 1760; at 375 px the section has 44 px targets and no horizontal overflow.
- **Observation (not changed, out of scope):** The existing card date uses the theme’s muted colour, so it can be hard to read on festival artwork when a light theme is selected.
- **NOT TESTED:** Very long names in every font pairing (fit-to-width shrink was exercised on one pairing only); real offline restart and live service-worker behavior until the live check below.

### Task 027 Impact Record

- **Baseline:** `main` at commit `f232cb6`; clean; aligned with `origin/main`; live site serves v1.26.0.
- **Existing behavior found:** 19 decorations ("stamps": text badges, seal, medallion, ribbon, ornaments, crest, monogram) grouped in the Finishing tab, added by tap and repositioned by pointer drag, with scale, rotation, opacity, layer and remove controls in a toolbar over the card. No emoji or symbols, no keyboard repositioning, no list of what is on the card, and Condolence already has decorations disabled entirely.
- **Requirement:** R4 (optional/collapsible library with clear groups, emoji/symbols alongside proper artwork, add/select/move/resize/rotate/remove, touch and keyboard usable, no content reset, restricted-context suppression).
- **State/data impact:** None new. Library items are ordinary stamps with new definition ids (`lib-*`, `g-*`); the persisted stamp shape and schema v6 are unchanged. Existing decorations, categories and defaults are untouched and library items are kept out of the main gallery.
- **UI/layout impact:** A collapsed "More decorations (optional)" section in the Finishing tab, built only when opened; an "On this card" list to select and remove placed decorations; four move buttons in the stamp toolbar (44 px on touch devices) and arrow-key/Delete shortcuts; the toolbar now wraps instead of scrolling sideways.
- **Preview/export impact:** Library items draw through the existing stamp path, so preview and PNG export share them. Emoji use the device's own emoji font, so their look differs between devices but matches between preview and export on one device.
- **Regression risks:** Keyboard shortcuts stealing keys from fields or radios, Undo grouping, occasion isolation, restricted contexts, toolbar layout on narrow screens.
- **Smallest safe plan:** Add five code-drawn foil artworks (Sparkle Burst, Laurel Wreath, Heart Flourish, Foil Rosette, Diya Lamp) and 52 emoji across Birthday, Anniversary & Love, Festivals, Flowers & Nature, Celebration, General and five occasion-specific groups shown only for that occasion; hide festive items on Get Well; release 1.27.0 with no new asset files.

### Task 027 Implementation Record

- **Baseline:** `main` at commit `f232cb6`
- **Status:** Complete, committed, pushed, deployed, and verified
- **Completed commit:** `e932bb7` — `feat: add optional decoration library and keyboard-accessible decorations (R4)`
- **Live verification:** GitHub Pages run [`35930293948`](https://github.com/jayajd70-ops/Atul-Card-Studio/actions/runs/35930293948) succeeded; live manifest, service worker and app serve 1.27.0. After the waiting worker was activated the caches were exactly the detector cache plus `atul-shell-v1.27.0` with 53 entries (unchanged first-install size, no new asset files). On the live HTTPS page under service-worker control the library opens with 43 items (main gallery still 19), a library artwork and an emoji were added and listed under On this card, an arrow-key move was undone, and `js/app.js` was served from the cache. Real airplane-mode restart NOT TESTED (embedded browser cannot toggle offline).
- **Release:** Application, manifest, service worker, and cache version `1.27.0`; schema remains v6; no new asset files, so the 53-entry shell precache is unchanged
- **Verified locally (Chrome, PASS):** Library is collapsed by default and shows 43 items in six groups on a birthday card (main gallery still 19); all 43 thumbnails render; art was inspected and two drawings (Heart Flourish, Laurel Wreath) were redrawn after inspection; adding a library artwork and an emoji works and both appear on the card; the On this card list selects and removes; move buttons move by 1% as one Undo step; arrow keys move by 1% (Shift 4%) grouped into one Undo step; arrow keys typed in a text field do not move anything; Delete removes and Undo restores; Get Well hides the party/festive emoji and adds a Get Well & Thanks group; New Baby adds its group; Condolence hides the Finishing tab and lists nothing; each occasion keeps its own decorations; recipient, greeting and other content are untouched; decorations survive reload and appear in a backup; PNG export with decorations is exactly 1200 x 1760; at 375 px there is no horizontal overflow and the toolbar wraps with 44 px buttons.
- **NOT TESTED:** Emoji on a phone or another operating system (glyph shapes differ by device; only this Windows browser was checked); a physical touch drag of a library item; resize and rotate of every one of the 57 new items individually (the shared sliders were exercised on existing items and library items draw through the same path); backup re-import of a card with library decorations; real offline restart and live service-worker behavior until the live check below.

### Task 026 Impact Record

- **Baseline:** `main` at commit `7a771f8`; clean; aligned with `origin/main`; live site serves v1.25.0.
- **Existing behavior found:** Personal-occasion and festival cards always drew one border (triple foil rule with botanical corners). Only Condolence had alternative frames. No-photo cards already show a centred fallback centrepiece in the halo/medallion with occasion-specific corner artwork, so their composition is intact and is not replaced.
- **Requirement:** R2 (more intentional variety in borders/frames for photo and no-photo cards, without replacing working rendering).
- **State/data impact:** One optional additive field, `layout.frameStyle` (`classic` default). Missing or unknown values load as `classic` (verified through the migration path), so older cards and backups open unchanged and schema stays v6; the backup format id is unchanged. Choosing a Design Library preset now also sets its border.
- **UI/layout impact:** New "Border style" group in the Theme tab (five options with names and hints), disabled for Condolence, which keeps its own border.
- **Preview/export impact:** Renderer change is confined to `renderLuxuryBorder`, which now selects between the original drawing and the already-reviewed restrained-frame drawing; both stay inside the existing safe margins, and preview and export use the same code.
- **Regression risks:** Frames colliding with corner artwork or text, Condolence frame, Undo/Redo, old projects, backups.
- **Smallest safe plan:** `FrameStyles` registry (Classic Foil, Refined Double, Tailored, Regal Rule, Soft Round) reusing existing frame drawing; assign a frame to each design preset; release 1.26.0 with no new assets.

### Task 026 Implementation Record

- **Baseline:** `main` at commit `7a771f8`
- **Status:** Complete, committed, pushed, deployed, and verified
- **Completed commit:** `1b5b83e` — `feat: add border style families with design-preset frames (R2)`
- **Live verification:** GitHub Pages run [`35929348958`](https://github.com/jayajd70-ops/Atul-Card-Studio/actions/runs/35929348958) succeeded; live manifest, service worker and app serve 1.26.0. After the waiting worker was activated the caches were exactly the detector cache plus `atul-shell-v1.26.0` with 53 entries. On the live HTTPS page under service-worker control, the Border style group lists 5 options, choosing Regal Rule is applied, choosing the Soft Care design switches the border to Soft Round, all ten design tiles render, and `js/app.js` is served from the cache. Real airplane-mode restart NOT TESTED (embedded browser cannot toggle offline).
- **Release:** Application, manifest, service worker, and cache version `1.26.0`; schema remains v6; no new assets (53-entry shell precache unchanged)
- **Verified locally (Chrome, PASS):** All five frames render distinctly on a birthday card without touching text or centrepiece (visually inspected); frame choice is one Undo step; choosing a design preset applies its frame and Undo restores the earlier one; Condolence disables the group and keeps its own border; Diwali keeps the chosen frame; a photo card also renders with the Tailored frame; migration maps a missing, null or unknown frame to Classic and keeps a valid one (Node run of the real migration code); backup export contains `frameStyle` and re-opening the imported backup restores the frame; PNG export is exactly 1200 x 1760.
- **NOT TESTED:** Frames on every festival artwork and with a photo card in each frame (only birthday without photo, one photo card with the Tailored frame, and a festival switch were exercised); narrow-phone visual of the new group after this change; real offline restart and live service-worker behavior until the live check below.

### Task 025 Impact Record

- **Baseline:** `main` at commit `1ed2339`; clean; aligned with `origin/main`; live site serves v1.24.0.
- **Existing behavior found:** Six colour themes with local favourites (`ThemePreferences`), separate foil, font-pairing and mood controls, one border/corner style for personal occasions, and fully separate designs for Condolence and festivals. No coordinated "design" concept and no previews of the finished card.
- **Requirement:** R1 (browse and preview designs, occasion suitability, retain preferred designs locally and offline, small curated set, no downloads).
- **State/data impact:** None persisted on the card. A preset writes only existing fields: theme id, foil palette/finish/intensity, font pairing and mood. The active preset is recognised by matching those fields, so schema stays v6 and backups are unchanged. Favourites are a local preference (`design-preferences` in the `settings` store), like theme favourites.
- **UI/layout impact:** New "Design library" group at the top of the Theme tab with previews, names, suitability text, a "Suits this occasion" mark, a per-design favourite star (44 px target) and a favourites-only filter. Unavailable for Condolence, which keeps its reviewed design.
- **Preview/export impact:** Thumbnails are real renders of the current card using the existing renderer at a small size; the renderer itself is unchanged.
- **Regression risks:** Overwriting user content (checked), Undo/Redo, occasion isolation, thumbnail render cost, tab layout on narrow screens.
- **Smallest safe plan:** Data-only `DesignLibrary` of ten presets built from existing themes, foils and pairings; a shared `createFavouriteStore` (theme favourites now use it, behavior identical); UI as above; release 1.25.0 with no new assets.

### Task 025 Implementation Record

- **Baseline:** `main` at commit `1ed2339`
- **Status:** Complete, committed, pushed, deployed, and verified
- **Completed commit:** `bac00d7` — `feat: add curated Design Library with local favourites (R1)`
- **Live verification:** GitHub Pages run [`35928482271`](https://github.com/jayajd70-ops/Atul-Card-Studio/actions/runs/35928482271) succeeded; live manifest, service worker and app serve 1.25.0 and the Design library markup is present. After the waiting service worker was activated, the cache set was exactly the detector cache plus `atul-shell-v1.25.0` with 53 entries (old shell caches removed, unchanged first-install size). On the live HTTPS page all ten thumbnails rendered, a favourite was set and a design applied, and `js/app.js` was served from the service-worker cache. Real airplane-mode restart NOT TESTED (embedded browser cannot toggle offline).
- **Release:** Application, manifest, service worker, and cache version `1.25.0`; schema remains v6; no new assets, so the 53-entry shell precache is unchanged
- **Behavior:** Ten curated designs (Royal Gold, Pearl Heirloom, Emerald Elegance, Burgundy Romance, Sapphire Modern, Tuscan Warmth, Blush Rose Gold, Midnight Platinum, Festive Ember, Soft Care), each with a live thumbnail of the current card, a name, suitability text, and a local favourite star. Designs that suit the current occasion sort first and carry a "Suits this occasion" mark. Selecting one is a single Undo step.
- **Verified locally (Chrome, PASS):** All ten thumbnails render (about 6 s total in the hidden pane, sequential, cancelled when the card changes); applying a design leaves recipient, sender, message, photo zoom/pan, photo shape and centrepiece choice unchanged; Undo restores the previous design; favourite persists across reload and the favourites-only filter works; Condolence disables the library with an explanation and shows no active design; festival (Diwali) and Get Well reorder by suitability; the chosen design survives reload; no horizontal page overflow at 375 px; favourite target 44 x 44 px; PNG export is exactly 1200 x 1760.
- **NOT TESTED:** Backup round-trip run separately (no persisted field or format changed; existing theme/foil/typography fields only); real offline restart and live service-worker behavior until the live check below; touch gestures on a physical phone.

### Task 024 Implementation Record

- **Baseline:** `main` at commit `ec5a8b1`
- **Status:** Complete, committed, pushed, deployed, and verified
- **Completed commit:** `3e01a6f` — `feat: add Undo/Redo checkpoints for typed text and keep Person Focus failure message`
- **Live verification:** GitHub Pages run [`35926218754`](https://github.com/jayajd70-ops/Atul-Card-Studio/actions/runs/35926218754) succeeded; live manifest, service worker, and app serve 1.24.0. On the live page the new shell cache holds 53 entries, the detector cache was retained, and typing Sender then Greeting followed by one Undo reverted only the Greeting. An existing installation keeps the previous service worker until its tabs close (normal waiting-worker update flow).
- **Release:** Application, manifest, service worker, and cache version `1.24.0`; schema remains v6
- **Change:** Relationship, Recipient, Sender, and Greeting fields, and the selected-decoration sliders, now commit one Undo/Redo checkpoint on `change` (`StateStore.update(() => {})`). Nothing they store changed.
- **Also fixed (Task 023 defect found in testing):** When Smart Person Focus could not start (for example WebAssembly unavailable, or offline before the first detector download), its explanation was erased immediately by the status refresh. It is now kept in a `focusNotice` until the photo changes or a new search starts, with separate online and offline wording.
- **Verified locally (Chrome):** Undo/Redo per edit for each field; cross-field independence (Undo no longer clears unrelated typed text); real-keyboard flow; occasion switch, save/reopen, backup round-trip, and export unchanged; stamp slider checkpoints; Find people failure message stays visible with the button re-enabled and the photo/transform intact (WebAssembly forced undefined).
- **Not tested:** Real airplane-mode offline restart (the embedded browser cannot register service workers on localhost or toggle offline); real-person detection on the live HTTPS page.

### R1–R18 Status Matrix (as of Task 024)

| Req | Status | Evidence / exact remaining gap |
|---|---|---|
| R1 Design library | Partial | Registry-driven templates/themes/festival art exist; broad visual expansion and design acquisition are parked. |
| R2 Templates/borders/decorations | Partial | Working set shipped; further expansion parked. |
| R3 Coordinated theme/typography | Complete | Font pairings and foil presets coordinated per theme. |
| R4 Decorations and emoji | Partial | Stamp collections shipped; emoji picker needs a product decision. |
| R5 Occasion-aware messages | Partial | Relationship-aware anniversary messages, tone, 220-char cap and sensitive-occasion guards exist; relationship-aware pools for other occasions and idiom wording remain. |
| R6 Photo adjustment/crop | Complete | Zoom/pan/reset, preview/export parity. |
| R7 Persistent state | Complete | Autosave, save/reopen, backup/import (Task 024 closes the Undo text gap). |
| R8 Composition fine-tune | Complete | Layout sliders with history. |
| R9 Mobile navigation | Complete | Bottom tabs, safe scrolling. |
| R10 Occasions/festivals | Complete | Occasion isolation; festival cards no-photo. |
| R11 Photo input/placement | Complete | Upload, adjust, placement. |
| R12 Remove/replace/no-photo | Complete | Verified in prior tasks. |
| R13 Undo/Redo | Complete | Text and slider checkpoints as of Task 024. |
| R14 Responsive workspace | Complete | Desktop and mobile layouts verified. |
| R15 Smart Person Focus | Complete, with untested limits | Local MediaPipe BlazeFace, on-demand, cached; real airplane-mode restart not tested. |
| R16 Self-hosted fonts/assets | Complete | Fonts and assets precached; no CDNs. |
| R17 Automatic/editable date | Complete | Verified in prior tasks. |
| R18 Creator footer | Pending | Deliberately not implemented. |

### Task 023 Impact Record

- **Baseline:** `main` at commit `d22607c`; working tree clean; local `main` aligned with `origin/main`; live site served v1.22.0.
- **Reference:** `birthday-card-maker-premium` is unavailable; implementation follows the R15 specification directly.
- **Existing implementation:** No face detection existed. `project.photo = {assetId, zoom, panX, panY, rotation}` drives a single renderer shared by preview and export. `StateStore.update()` records one history entry per call. Photo replacement builds a fresh `photo` object and removal sets it to `null`. Backups clone `project.photo` unchanged.
- **Dependency and licensing:** MediaPipe Tasks Vision 1.0.1 and the BlazeFace short-range model are Apache-2.0 (license text kept in `vendor/`). Per-file SHA-256 hashes and the npm integrity value are recorded in `vendor/mediapipe/tasks-vision-1.0.1/README.md`.
- **Privacy finding:** MediaPipe's own privacy notice and bundle show it sends performance/usage metrics (not images) to `https://odml.pa.googleapis.com/v1/log` with no opt-out. A `Content-Security-Policy: connect-src 'self' blob: data:` meta tag now blocks it. The app previously made no `fetch`/XHR/beacon calls at all, so nothing else is affected. A `securitypolicyviolation` event was observed for that URL and a direct probe failed, confirming the block.
- **Size and cache impact:** First-use download 12,465,471 bytes (11.89 MiB) on WebAssembly-SIMD browsers, 11,668,562 bytes (11.13 MiB) otherwise; only one wasm build is ever fetched. Not in the mandatory precache. The detector cache is named after the vendored version, so app releases do not force a re-download.
- **State/data impact:** Optional `photo.focus = {box:[x,y,w,h]}` normalized to the photo. Absent means no selection. Cleared when a photo is replaced, removed, or reset. No migration; schema stays v6.
- **UI/layout impact:** Photo tab gains a Smart Person Focus section, hidden where photos are not allowed and disabled with no photo.
- **Preview/export impact:** No renderer change; Auto-Fit writes only existing transform values.
- **Regression risks:** Bundle/model load failure (handled with messages; manual framing unaffected), false face candidates, mask edge exposure (existing clamps), stale detections, extra history entries, service-worker/offline changes.

### Task 023 Implementation Record

- **Approved Task:** Task 023 — R15 Smart Person Focus
- **Baseline:** `main` at commit `d22607c`
- **Status:** Complete, committed, pushed, deployed, and verified
- **Completed commit:** `6a6c4f5` — `feat: add Smart Person Focus for group photos`
- **Release:** Application, manifest, service worker, and cache version `1.23.0`; schema remains v6
- **Behavior:** The Photo tab has an optional Smart Person Focus section. Find people in photo runs the vendored detector on-device on the full-resolution photo, shows numbered enlarged face crops in left-to-right, top-to-bottom order, and applies nothing until the user chooses one (even when only one face is found). Choosing a person sets zoom, pan X and pan Y in a single Undo/Redo step, targets the face at 34% of the mask, respects current rotation and mask shape, and stores only `photo.focus.box`. Sliders, drag and pinch remain fully manual afterwards. Re-running detection highlights the saved person.
- **Detection design:** Whole photo plus overlapping tile grids (1, 2, 3, 4, 6, 8 per side; finer grids only while a tile stays at least 160 px) at a long side of up to 3000 px. Overlapping hits are merged; a candidate needs confidence of at least 0.7 and either at least 0.75 alone or three tile hits, plus a relative face-size sanity check. Measured on real photos, genuine faces scored 0.77 or higher while suit fittings scored 0.5 to 0.66.
- **Compatibility:** Card data, occasion isolation, uploaded-photo priority, manual centerpiece choices, existing photo transforms, festival and Condolence no-photo behavior, exports, backups, and the offline editor shell are unchanged.
- **Measured mandatory shell:** 7.530 MiB to 7.549 MiB (+19.3 KiB of application code and markup only); no detector file is in `SHELL_ASSETS`.
- **Verification (local):** Syntax, whitespace, manifest, aligned 1.23.0 versions. Licensed test fixtures kept outside the repository (public-domain Apollo 11 crew and Solvay 1927 conference photographs, an Apache-2.0 MediaPipe portrait, and a synthetic no-face image): portrait 1 face, crew 3 faces, 29-person conference 20 faces at confidence 0.77 or higher (some distant faces not offered), synthetic image 0 faces; repeated runs identical and correctly ordered. Auto-Fit landed the chosen face at the mask centre at 34% size (rendered-versus-source difference 3.7 against 35.8 for a different face); edge faces clamp within pan +/-1; 30 degree rotation and framed masks pass; manual zoom after focus keeps the saved person. Undo and Redo restored the exact photo state in one step; save and reload restored the identical photo and `focus`; backup export and import kept `focus` with a new asset ID; replacing or removing the photo cleared choices and focus, and Undo restored the saved person without stale choices. Birthday, Condolence, Diwali, Birthday preserved the photo and focus and hid the feature where photos are not allowed. Export is exactly 1200x1760 and the preview render matches export (mean difference 2.2 of 255). Desktop and 390x844 mobile layouts pass (no overflow; choices at least 103 px). Service-worker simulation: install fetched no detector file (53 entries), first online use filled the detector cache, offline reuse served it, an unfetched file returned a clean 503, and activation kept the detector cache while removing stale shells. The CSP block of the telemetry endpoint was observed.
- **Live verification:** GitHub Pages run [`35922321375`](https://github.com/jayajd70-ops/Atul-Card-Studio/actions/runs/35922321375) succeeded. The live manifest and service worker serve 1.23.0, and all seven vendored files are byte-identical to the local copies (SHA-256 match) with `application/wasm` for both WebAssembly files. The live service worker activated and controlled the page with exactly 53 mandatory entries and no detector file. The first Find people run on the live site downloaded and cached exactly 4 files, 12,465,471 bytes (11.89 MiB), in the dedicated detector cache, and finished with the correct no-face message on a synthetic photo. After a reload, all four detector files were served with zero bytes transferred (two directly by the service worker), the photo persisted, and the detector ran again from cache; the cached files were byte-exact against the network. The CSP meta tag is live.
- **Not tested on the live site:** Face detection on real people was verified locally only (the embedded preview cannot load local fixtures on an HTTPS page, and the CSP now blocks fetching third-party images), using hash-identical bytes. A true airplane-mode reload could not be toggled in the embedded browser; offline availability is supported by the zero-transfer cache reuse, the byte-exact cache probe, and the service-worker simulation.
- **Known limitations:** BlazeFace short-range targets faces from roughly 2 m away and works best on frontal faces; profile, heavily occluded, or very small faces in large groups may be missed, and the user can always frame manually. First use needs about 12 MB of connectivity once; a browser that evicts the cache needs it again. Only WebAssembly-capable browsers are supported for this optional feature; others see a clear message and manual framing. One console notice about a blocked connection to Google's metrics endpoint is expected.

### Task 022 Impact Record

- **Baseline:** `main` at commit `a2a94d0`; working tree clean; local `main` aligned with `origin/main`
- **Existing implementation:** Birthday and Condolence use relationship-aware pools. Anniversary retains its relationship independently but generation currently ignores it.
- **State/data impact:** No schema or migration change. Existing saved and manually edited messages remain untouched.
- **UI/layout impact:** None. The existing Relationship field and Generate action are reused.
- **Preview/export impact:** Only newly generated Anniversary wording changes; existing rendering and output paths are unchanged.
- **Regression risks:** Incorrect relationship classification, text longer than the 220-character editor limit, accidental changes to generic or other-occasion messages, and loss of occasion-isolated content.

### Task 022 Implementation Record

- **Completed commit:** `4cb0230` — `feat: add relationship-aware anniversary messages`
- **Release:** Application, manifest, service worker, and cache version `1.22.0`; schema remains v6
- **Behavior:** Recognizes spouse/partner, parent/elder, family/friend, and professional relationships and selects relationship-appropriate Anniversary wording across Heartfelt, Poetic, Professional, and Playful tones. Blank and unrecognized relationships retain the original generic Anniversary pools; the relationship field and existing/manual messages are never rewritten.
- **Compatibility:** Birthday and Condolence relationship behavior, all other message pools, occasion isolation, card data, uploaded-photo priority, manual centerpiece choices, rendering, exports, saved projects, and offline behavior remain unchanged.
- **Verification:** JavaScript/service-worker syntax, whitespace, aligned v1.22.0 versions, unchanged schema v6, and all precache paths passed. Focused checks passed 26 classification cases and 32 generated drafts covering four relationship groups and four tones; all drafts included the maximum 40-character recipient name and the longest was 174/220 characters. Unknown/blank relationships produced the same generic fallback; Birthday and Condolence regression samples remained correctly scoped. Desktop and 390×844 browser checks passed generation, manual-message preservation, and Anniversary → Birthday → Anniversary relationship/message isolation. Exact 1200×1760 PNG export, online reload, local offline restart, and console checks passed. GitHub Pages run [`35897514072`](https://github.com/jayajd70-ops/Atul-Card-Studio/actions/runs/35897514072) succeeded; live application/manifest/service-worker versions align at 1.22.0, spouse-aware wording is live, and a fresh service-worker-controlled profile reopened v1.22.0 offline.

### Claude Code Handover After Task 022

- **Authoritative checkout:** `D:\Atul-Card-Studio`, branch `main`, remote `origin` (`https://github.com/jayajd70-ops/Atul-Card-Studio.git`). Do not work from similarly named folders or the Codex worktree.
- **Released baseline:** Feature commit `4cb0230`, app/cache/manifest 1.22.0, schema v6, public site `https://jayajd70-ops.github.io/Atul-Card-Studio/`. Read the latest Git log because the documentation closeout commit follows the feature commit.
- **Protected behavior:** Preserve card data and per-occasion message/relationship/design state; uploaded photos outrank automatic centerpieces; manual centerpiece choices remain authoritative; festival cards remain no-photo; preview/export must agree; local assets and offline startup must keep working.
- **R1–R18 status:** R1 has an expandable local theme/festival library and persisted theme favourites, while automatic design acquisition/daily downloads remain undecided and parked. R2–R4 have photo/no-photo layouts, coordinated themes/typography, and categorized editable decorations; treat further visual expansion as incremental improvement. R5 has occasion/festival pools, editable/manual text, Condolence and Get Well output guards, and relationship-aware Condolence, Birthday, and Anniversary generation; other occasions still use generic relationship-neutral pools and no personal sub-occasion selector exists. R6–R14 are implemented for the current non-detection workflow, including manual photo transforms, persistent state, independent layout/type controls, mobile navigation, personal/festival categories, camera/upload, remove/replace/no-photo, Undo/Redo, and responsive layouts. R15 Smart Person Focus is not implemented. R16 self-hosted fonts/offline assets and R17 editable date are implemented. R18 Creator Footer is explicitly pending and must not be implemented without new approval.
- **Primary remaining product task:** R15 Smart Person Focus. The approved behavioral reference named `birthday-card-maker-premium` was not present in the inspected `D:\` folders on 23 September 2026. Locate/inspect the actual reference and license first; then plan bundled local detection assets, enlarged deterministic face choices, explicit user selection, bounded non-destructive auto-fit, manual correction, one-step Undo/Redo, persistence, stale-detection cleanup after photo replacement, preview/export parity, and offline operation. Do not ship a browser-only `FaceDetector` dependency as if it satisfied R15.
- **Secondary R5 work:** Review relationship awareness only where it materially improves wording. Congratulations is the clearest candidate but needs a defined achievement/sub-occasion model before relationship wording, so do not infer that product decision. Keep blank/unrecognized relationships on the existing generic pools and maintain the 220-character boundary.
- **Parked decisions:** R18 footer, new-design acquisition/AI strategy, calendar/reminders, People & Events database, application rename, separate festival app, person/background extraction, and photo enhancement remain outside scope until explicitly promoted.
- **Release workflow:** Inspect `PROJECT.md`, branch/status/origin/HEAD and the live deployment; record one narrow Current Task and impact; implement; run focused plus protected regressions; bump app/manifest/service-worker together only for an application release; keep schema v6 unless data shape truly changes; commit, push `origin/main`, wait for GitHub Pages, and verify live HTTPS plus service-worker/offline behavior. Never report browser behavior as passed from source checks alone.

### Task 021 Implementation Record

- **Approved Task:** Task 021 — Centrepiece asset documentation alignment
- **Baseline:** `main` at commit `e63af0d`
- **Status:** Complete, committed, pushed, deployed, and verified
- **Completed commit:** `d63cc26` — `docs: align centerpiece asset guidance`
- **Release:** No application release change; application, manifest, service worker, and cache remain at 1.21.0; schema remains v6
- **Behavior:** The asset README documents the current 16 centrepieces plus four decorations, WebP-first/PNG-fallback resolver order, registry-based path convention, legacy Luxury Balloons ID, and WebP-only mandatory precache.
- **Compatibility:** Documentation only; application assets, behavior, data, exports, and offline operation remain unchanged.
- **Verification:** Documentation-to-code checks confirmed resolver order `webp, png`; 16 registered centrepieces plus four decorations; 20 WebP and zero PNG artwork entries in the mandatory cache; explicit README coverage of WebP-first loading, PNG fallback, and PNG exclusion from mandatory precaching; and removal of all stale four-PNG/PNG-first wording. Application, manifest, service worker, and cache remain aligned at 1.21.0. Only `PROJECT.md` and the asset README changed. GitHub Pages run [`35885539106`](https://github.com/jayajd70-ops/Atul-Card-Studio/actions/runs/35885539106) succeeded; the deployed README contains the corrected resolver/count/cache statements, the stale four-PNG statement is absent, and the live app/service worker remain at 1.21.0.

### Task 020 Implementation Record

- **Approved Task:** Task 020 — WebP application-shell artwork optimization
- **Baseline:** `main` at commit `6d5a50e`
- **Status:** Complete, committed, pushed, deployed, and verified
- **Completed commit:** `ca72a08` — `perf: optimize cached artwork as WebP`
- **Release:** Application, manifest, service worker, and cache version `1.21.0`; schema remains v6
- **Behavior:** Twenty quality-90 WebP centerpiece/decoration assets become the runtime and offline-cache primary formats. Original PNG files remain bundled as decode fallbacks, while only the smaller WebP variants are mandatory on first installation.
- **Compatibility:** Asset IDs, dimensions, alpha transparency, automatic occasion choices, manual centerpiece choices, uploaded-photo priority, card data, occasion isolation, festival runtime caching, rendering, exports, and offline behavior are preserved.
- **Measured impact:** The twenty mandatory artwork files fall from 32,216,140 bytes (30.72 MiB) as PNG to 6,556,682 bytes (6.25 MiB) as WebP, a 79.6% reduction. The complete mandatory shell falls from 33,550,328 bytes (32.00 MiB) to 7,892,082 bytes (7.53 MiB), saving 25,658,246 bytes (24.47 MiB) per fresh installation.
- **Verification:** All 20 PNG/WebP pairs retain identical dimensions and exact alpha values; worst visible-pixel PSNR is 34.42 dB, and visual inspection of the worst measured centerpiece plus a detailed corner decoration found no material regression. JavaScript/service-worker syntax, whitespace, aligned v1.21.0 versions, unchanged schema v6, 53 existing precache paths, 20 WebP entries, zero centerpiece/decoration PNG entries, zero eager festival entries, and zero missing paths passed. Chrome decoded and selected WebP for all 20 resolver IDs. Exact 1200×1760 exports passed for automatic Birthday, Get Well, and Condolence cards plus a manual Velvet Roses choice. The manual choice, WebP source, export dimensions, service-worker control, and card state remained correct after offline reload. GitHub Pages run [`35884348847`](https://github.com/jayajd70-ops/Atul-Card-Studio/actions/runs/35884348847) succeeded; live application, manifest, and service worker serve v1.21.0, every WebP returns HTTP 200 with exact deployed bytes and `image/webp`, and live Chrome confirmed all 20 assets decode from the WebP-only mandatory cache.

### Task 019 Implementation Record

- **Approved Task:** Task 019 — Local export and test-artifact Git guardrails
- **Baseline:** `main` at commit `a9a8a64`
- **Status:** Complete, committed, pushed, deployed, and verified
- **Completed commit:** `69cda9e` — `chore: ignore local card artifacts`
- **Release:** No application release change; application, manifest, service worker, and cache remain at 1.20.0; schema remains v6
- **Behavior:** Root-level files matching the app's actual generated export names (`atul-card-*.png`, `atul-card-backup-*.json`, and `atul-digital-card-*.json`) and root-level `test-results`, `playwright-report`, and `screenshots` folders are excluded from future Git additions.
- **Compatibility:** Bundled images under `assets/`, icons, source files, manifest, service worker, project documentation, tracked files, application data, card behavior, exports, and offline operation are unchanged.
- **Verification:** All six intended positive cases resolved to their exact new ignore rules: generated card PNG, backup JSON, Digital Card JSON, nested test result, Playwright report, and screenshot. Seven protected negative cases remained trackable: festival artwork, centerpiece artwork, icon, application JavaScript, manifest, service worker, and project documentation. No existing tracked file is ignored. JavaScript/service-worker syntax, whitespace, and unchanged aligned version 1.20.0 checks passed. GitHub Pages run [`35792923794`](https://github.com/jayajd70-ops/Atul-Card-Studio/actions/runs/35792923794) succeeded; live application, manifest, and service worker remain aligned at 1.20.0, the Get Well safety guard remains live, and festival artwork remains absent from eager precaching.

### Task 018 Implementation Record

- **Approved Task:** Task 018 — Get Well cross-occasion output safety
- **Baseline:** `main` at commit `17ceda3`
- **Status:** Complete, committed, pushed, deployed, and verified
- **Completed commit:** `5fc958d` — `fix: guard Get Well output context`
- **Release:** Application, manifest, service worker, and cache version `1.20.0`; schema remains v6
- **Behavior:** Get Well now has an occasion-specific safety rule that rejects unmistakable Birthday, Anniversary, named-festival, wedding/marriage, and party wording. Incompatible text remains stored and editable, but is omitted from preview and blocked from PNG, share, and Digital Card output until corrected. The warning and output error identify Get Well rather than Condolence.
- **Compatibility:** All eight built-in Get Well drafts remain valid. Ordinary recovery wording using phrases such as `new year`, `congratulations on progress`, or `celebrate your recovery` remains allowed. Existing Condolence rules/messages, other occasion messages, card data, occasion isolation, photos, centerpieces, save/reopen, export dimensions, and schema v6 remain unchanged.
- **Verification:** JavaScript and service-worker syntax and whitespace passed. Focused safety tests passed five valid Get Well phrases, six incompatible cross-occasion phrases, all eight built-in Get Well drafts, existing valid/invalid Condolence cases, an unaffected Birthday case, and occasion-specific warning/output errors. Chrome passed invalid Anniversary wording preservation, visible warning and ARIA invalid state, output blocking, Birthday → Get Well state round-trip, correction flow, exact 1200×1760 safe export rendering, v1.20.0 service-worker control, and offline Get Well reopen with its corrected message preserved. GitHub Pages run [`35790130660`](https://github.com/jayajd70-ops/Atul-Card-Studio/actions/runs/35790130660) succeeded; the live application, manifest, and service worker serve v1.20.0. Live Chrome confirmed service-worker control, preserved incompatible Get Well text, the Get Well-specific warning, and output blocking.

### Task 017 Implementation Record

- **Approved Task:** Task 017 — On-demand festival artwork caching
- **Baseline:** `main` at commit `bfab873`
- **Status:** Complete, committed, pushed, deployed, and verified
- **Completed commit:** `bc47402` — `perf: cache festival artwork on demand`
- **Release:** Application, manifest, service worker, and cache version `1.19.0`; schema remains v6
- **Behavior:** The twenty-two festival artworks are no longer part of the mandatory application-shell download. Opening a festival online loads its selected local artwork and stores it through the existing same-origin runtime cache, making that artwork available on later offline visits.
- **Measured impact:** Mandatory precaching falls from 75 entries / 93,787,171 bytes (89.45 MiB) to 53 entries / 33,550,328 bytes (32.00 MiB), saving 60,236,843 bytes (57.45 MiB) on a fresh installation.
- **Compatibility:** All twenty-two festival assets and design selectors remain unchanged. Card schema/data, occasion isolation, uploaded-photo priority, manual centerpiece choices, festival messages, rendering, export, and the core offline editor shell remain unchanged.
- **Verification:** JavaScript and service-worker syntax, whitespace, aligned release versions, unchanged schema v6, all 53 precache paths present, zero festival artwork paths in the eager list, and all 22 registry artwork paths present passed. A service-worker simulation passed for 53-entry installation, zero eager festival downloads, first online artwork fetch, and repeat offline cache use. Chrome passed v1.19.0 startup, three-design Navratri selection, online artwork load, confirmed runtime-cache storage, and offline reload retaining Navratri with all three design choices. GitHub Pages run [`35786680283`](https://github.com/jayajd70-ops/Atul-Card-Studio/actions/runs/35786680283) succeeded; live application, manifest, and service worker versions align at 1.19.0, the eager festival list is empty, the awaited runtime-cache write is live, and the tested Navratri artwork returns HTTP 200.

### Task 013 Implementation Record

- **Approved Task:** Task 013 — Prioritize Photo and Layout editor tabs
- **Baseline:** `main` at commit `c787410`
- **Status:** Complete, committed, pushed, deployed, and verified
- **Completed commit:** `65732e7` — `feat: prioritize photo and layout tabs`
- **Release:** Application, manifest, service worker, and cache version `1.15.0`; schema remains v5
- **Behavior:** The primary editor workflow is now Content → Photo → Theme → Layout. The selected tab scrolls fully into view, so Layout is no longer partially obscured by the horizontally scrollable menu. Type, Foil, Finishing, and Audio remain available after the primary tabs.
- **Compatibility:** No card data, occasion state, uploaded-photo handling, centerpiece selection, rendering, export, or offline storage changed.
- **Verification:** Syntax and whitespace checks passed. Desktop and narrow-mobile browser checks passed for tab order, Next from Content opening Photo, Layout selection, and full Layout visibility. Offline startup passed with the v1.15.0 shell, expected primary-tab order, and service-worker control. GitHub Pages run `35663114218` succeeded; live application and service-worker sources serve v1.15.0.

### Task 014 Implementation Record

- **Approved Task:** Task 014 — Festival Card section and expanded Indian festival library
- **Baseline:** `main` at commit `597466d`
- **Status:** Complete, committed, pushed, deployed, and verified
- **Completed commit:** `51a6237` — `feat: add festival card library`
- **Release:** Application, manifest, service worker, and cache version `1.16.0`; schema v6
- **Behavior:** Adds a Festival optgroup and shared Festival Card section for Diwali, Dhanteras / Lakshmi Puja, Bestu Varas, Uttarayan, Navratri, Holi, Raksha Bandhan, Janmashtami, Rath Yatra, Ganesh Chaturthi, Mahashivratri, Dussehra, Independence Day, Republic Day, Eid ul-Fitr, Christmas, New Year, Ram Navami, Holika Dahan, Hanuman Jayanti, Guru Purnima, and Bhai Dooj. The original 18 festival categories provide three visual treatments; Holika Dahan, Hanuman Jayanti, Guru Purnima, and Bhai Dooj use one approved template each. Festival cards use local full-card art, retain editable English messages, and do not accept personal photos.
- **Compatibility:** Each festival retains its own selected design and message. Existing saved cards migrate from schema v5 without changing their personal content. Birthday photo data, manual centerpiece choices, occasion state isolation, save/reopen, export, and offline behavior remain within the shared studio workflow.
- **Assets:** Twenty-two selected festival artworks are bundled and precached for first-use offline operation; unused source alternatives remain available outside the release folder.
- **Verification:** JavaScript syntax and whitespace checks, registry/message/no-photo checks, v5 migration, selected-asset existence, and Birthday → Holika Dahan → Birthday → Holika Dahan state regression passed. Desktop shell rendering was visually reviewed. GitHub Pages run `35767074368` succeeded; the public application, manifest, and service worker serve v1.16.0, and all 22 selected festival assets were verified over HTTPS. Browser interaction, PNG export, save/reopen, and offline startup remain untested in this release.

### Task 015 Implementation Record

- **Approved Task:** Task 015 — Indian-context Birthday message correction
- **Baseline:** `main` at commit `de8380a`
- **Status:** Complete, committed, pushed, deployed, and verified
- **Completed commit:** `b0263fe` — `fix: localize birthday message drafts`
- **Release:** Application, manifest, service worker, and cache version `1.17.0`; schema remains v6
- **Behavior:** Replaces prohibited Western Birthday clichés with warm, secular wording appropriate for Indian family, friendship, elder, and professional contexts. Heartfelt, Poetic, Professional, Playful, and Milestone tones remain available; generated text remains editable.
- **Compatibility:** Stored or manually edited messages are not rewritten. Birthday card data, photos, manual centerpiece choices, occasion isolation, save/reopen, export, festival cards, and offline operation remain unchanged.
- **Verification:** JavaScript and service-worker syntax, whitespace, 30-draft count, editor-length limit, prohibited-phrase scan, all five tone generation, recipient-name insertion, manual-message preservation, version alignment, and unchanged schema checks passed. GitHub Pages run `35773033633` succeeded; the public application, manifest, and service worker serve v1.17.0, the revised Birthday wording is live, and the prohibited orbit/confetti drafts are absent.

### Task 016 Implementation Record

- **Approved Task:** Task 016 — Relationship-aware Birthday message generation
- **Baseline:** `main` at commit `a8759dc`
- **Status:** Complete, committed, pushed, deployed, and verified
- **Completed commit:** `48f7c6e` — `feat: add relationship-aware birthday message generation`
- **Release:** Application, manifest, service worker, and cache version `1.18.0`; schema remains v6
- **Behavior:** Recognizes common parent, elder, spouse, sibling, child, teacher/mentor, friend, and professional relationships and selects tone-appropriate Birthday wording. Blank and unrecognized relationships retain the generic Birthday pools; the relationship field itself is never rewritten.
- **Compatibility:** All five Birthday tones, regeneration, edited/manual messages, card data, photos, centerpieces, occasion isolation, festivals, save/reopen, export, and offline behavior remain unchanged.
- **Verification finding, fixed before release:** Local boundary testing at the recipient-name field's own 40-character maximum found 31 of 80 relationship drafts (across `elder`, `parent`, `spouse`, `sibling`, `child`, `teacher`, `friend`, `professional`) exceeded the 220-character editor limit, up to 256 characters, because the `heartfelt`/`professional`/`milestone` templates concatenated two full context sentences. Restructured every relationship template to use exactly one context sentence per line (matching the already-safe `poetic`/`playful` pattern), and added a defensive word-safe/ellipsis cap inside `GreetingGenerator.fill()` (reusing `Utils.truncateProse`) so any future template that reintroduces an overflow degrades safely instead of failing silently. Re-verified worst case (40-character name, all 8 relationships x 5 tones): maximum draft length 216 characters, 0 over limit.
- **Verification:** JavaScript and service-worker syntax, whitespace, 30-draft generic-pool count (unaffected), 26-case relationship classification (all 8 buckets + blank + unrecognized), prohibited-phrase scan (Western clichés and casual slang, 110 unique drafts, 0 hits), 220-character editor limit at worst-case 40-character name (0 over after fix), recipient-name insertion (110/110), manual-message preservation, condolence relationship pools and safety block unaffected, festival (Diwali) and Anniversary generation unaffected, export at exact 1200x1760 with zero overflow/clamp/collision, version alignment (`APP_VERSION`/`SW_VERSION`/manifest all `1.18.0`), and unchanged schema (v6, no migration required) all passed. GitHub Pages run [`35783390277`](https://github.com/jayajd70-ops/Atul-Card-Studio/actions/runs/35783390277) succeeded; the public application, manifest, and service worker serve v1.18.0, the relationship-aware wording is live (verified `grandmother` → elder pool on the live site), and console logging is clean.

### Task 012 Implementation Record

- **Approved Task:** Task 012 — Correct automatic occasion designs and frames
- **Baseline:** `main` at commit `c3ac622`
- **Status:** Complete, committed, pushed, deployed, and verified
- **Completed commit:** `8f51298` — `feat: correct automatic occasion designs`
- **Release:** Application, manifest, service worker, and cache version `1.14.0`; schema remains v5
- **Behavior:** Congratulations, New Home, Graduation, Retirement, Get Well, and Friendship / Thanks each use a dedicated automatic centerpiece and an occasion-aware two-corner frame. These occasions no longer inherit generic birthday-party balloons, cake, gifts, or romantic roses. Birthday, Anniversary, New Baby, and Condolence retain their established designs.
- **Compatibility:** Existing cards and schema remain unchanged. Uploaded photos retain visual priority; previously allowed manual centerpiece choices remain available; occasion isolation, saved projects, exports, and offline behavior remain preserved.
- **Assets:** Six transparent local PNGs — laurel, home welcome, graduation diploma, retirement compass, get-well comfort, and thanks note — are bundled and precached for offline use.
- **Verification:** Syntax and whitespace checks passed; every affected automatic resolver returned the correct asset and loaded it locally; Get Well and Graduation were visually reviewed; all six assets were confirmed in the v1.14.0 offline cache and offline startup passed. GitHub Pages run `35662322138` succeeded; public HTTPS version, six live assets, six automatic selections, service-worker control, zero page errors, and live Get Well rendering passed.

### Historical Task 002A Acceptance Criteria

Task 002A acceptance criteria:

- Birthday photo state, including the IndexedDB asset reference, zoom, pan, rotation, mask, and layout values, survives Birthday → Condolence → Birthday unchanged.
- Stored Birthday stamps and Birthday centerpiece/layout choices are preserved but suppressed while Condolence is active, then restored unchanged on return to Birthday.
- Condolence remains No-Photo and exposes no stamp customization.
- Incompatible manual Condolence text remains editable in the field, is clearly warned, is omitted from rendering, and blocks PNG, share, and Digital Card output until corrected.
- Condolence generation follows occasion → recipient relationship to the deceased → tone, remains Indian-context appropriate and religion-neutral, and does not alter Birthday relationship behavior or Birthday message pools.
- The four deterministic designs are Heartfelt white lilies/warm ivory/gold; Comforting sage/soft ivory-pale sage/text-led; Reverent slate-blue/pale blue-grey-ivory/text-led; Professional navy-slate/ivory formal border/text-led.
- The project schema advances to v3 and application, manifest, service-worker, and cache release versions advance together to 1.4.0.
- All five approved Condolence PNG assets are included in rendering and offline precaching without optimization or recompression in this task.
- Existing Birthday behavior remains unchanged except for occasion-neutral output metadata required to support Condolence.

These criteria were satisfied and verified before Task 002A was closed.

## 10. Change / Handover Report Format

Use this format after every investigation or approved change:

```markdown
# Atul Card Studio — Change / Handover Report

## Task
- Approved Current Task:
- Authorization received:
- Baseline branch and commit:
- Working-tree state before work:

## Existing Implementation
- Verified working:
- Partial behavior:
- Confirmed gap:
- Evidence inspected:

## Impact Check
- State/data affected:
- UI/layout affected:
- Preview/export affected:
- Save/reopen affected:
- Mobile/desktop affected:
- Offline/service worker/assets affected:
- Regression risks:

## Approved Plan
- Approved scope:
- Explicitly out of scope:

## Changes Made
- Files changed:
- Behavior before:
- Behavior after:
- Data or compatibility notes:

## Verification
- Feature tests and results:
- Regression tests and results:
- Mobile result:
- Desktop result:
- Preview/export result:
- Save/reopen result:
- Offline/PWA result:
- Not tested:

## Remaining Issues
- Known limitations:
- Follow-up decisions required:

## Git / Release
- Working-tree state after work:
- Commit/push/deploy performed: No, unless separately authorized
- Suggested Git commit message:
```

Handover instruction:

> Read `PROJECT.md`, verify the repository and baseline, and work only on the approved Current Task. First report the existing implementation, impact, and smallest safe plan. Wait for approval before making changes.
