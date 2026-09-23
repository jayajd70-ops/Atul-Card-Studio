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

### R18. Optional Creator Footer — PENDING

Retain the concept of an optional footer such as **“Developed and created by [Name]”**, but do not implement it without later explicit approval.

If approved later:

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

- **R18 Creator Footer:** pending; retain the specification but do not implement.
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

- **Approved Current Task:** Task 023 — R15 Smart Person Focus
- **Active Permission Level:** IMPLEMENT / COMMIT / PUSH / DEPLOY, explicitly authorized by the owner on 23 September 2026
- **Status:** Complete, committed, pushed, deployed, and verified
- **Approved scope:** Optional, explicitly user-triggered local face detection on the current personal photo; deterministic enlarged face choices; explicit user selection (never automatic, even for one face); non-destructive Auto-Fit/Auto-Center that writes only the existing zoom/pan values as one Undo/Redo transaction; manual correction afterward; persistence of the selected person; stale-detection cleanup after photo replacement/removal; preview/export parity; offline support after first use.
- **Smallest safe plan:** Bundle MediaPipe Tasks Vision 1.0.1 (Apache-2.0, Google, actively maintained) with the BlazeFace short-range model under `vendor/mediapipe/tasks-vision-1.0.1/`. The previously considered `@vladmandic/face-api` was rejected because its repository is archived (last push 5 February 2025). The detector is loaded by dynamic `import()` only when the user taps Find people in photo, then stored in its own runtime cache (`atul-detector-mediapipe-1.0.1-blazeface-short-1`) that survives app releases. Detection scans the full-resolution photo in fixed tile passes, merges by consensus, orders faces left-to-right then top-to-bottom, and shows numbered enlarged crops as buttons. Selecting one applies the inverse of `renderPhoto` math in one `StateStore.update()`. Only the chosen normalized face box is stored as optional `photo.focus`; no schema change. Release as 1.23.0.
- **Authorization boundary:** Do not change the renderer transform math, existing sliders/gestures, card schema version, occasion isolation, uploaded-photo priority, manual centerpiece choices, festival or Condolence no-photo behavior, or mandatory precache contents. No CDN or cloud calls, no browser-only `FaceDetector`, no face recognition/identity, background extraction, or photo enhancement. R18 Creator Footer remains pending.

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
