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

- **Approved Current Task:** Task 016 — Relationship-aware Birthday message generation (R5)
- **Active Permission Level:** IMPLEMENT / COMMIT / PUSH / DEPLOY under standing owner authorization
- **Status:** Implementation and local verification complete; release in progress
- **Approved scope:** Use the optional Birthday relationship to select suitable Indian-context wording for elders, parents, spouse, siblings, children, teachers, friends, and professional contacts, with generic fallback for blank or unrecognized entries.
- **Authorization boundary:** Preserve the relationship field as entered, stored/manual messages, all five Birthday tones, occasion isolation, rendering, photo and centerpiece behavior, save/reopen, export, and offline operation. Other occasions and Gujarati festival messages remain later tasks.

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
- **Status:** Local implementation verified; commit, push, and live deployment verification pending
- **Release:** Application, manifest, service worker, and cache version `1.18.0`; schema remains v6
- **Behavior:** Recognizes common parent, elder, spouse, sibling, child, teacher/mentor, friend, and professional relationships and selects tone-appropriate Birthday wording. Blank and unrecognized relationships retain the generic Birthday pools; the relationship field itself is never rewritten.
- **Compatibility:** All five Birthday tones, regeneration, edited/manual messages, card data, photos, centerpieces, occasion isolation, festivals, save/reopen, export, and offline behavior remain unchanged.
- **Verification finding, fixed before release:** Local boundary testing at the recipient-name field's own 40-character maximum found 31 of 80 relationship drafts (across `elder`, `parent`, `spouse`, `sibling`, `child`, `teacher`, `friend`, `professional`) exceeded the 220-character editor limit, up to 256 characters, because the `heartfelt`/`professional`/`milestone` templates concatenated two full context sentences. Restructured every relationship template to use exactly one context sentence per line (matching the already-safe `poetic`/`playful` pattern), and added a defensive word-safe/ellipsis cap inside `GreetingGenerator.fill()` (reusing `Utils.truncateProse`) so any future template that reintroduces an overflow degrades safely instead of failing silently. Re-verified worst case (40-character name, all 8 relationships x 5 tones): maximum draft length 216 characters, 0 over limit.
- **Verification:** JavaScript and service-worker syntax, whitespace, 30-draft generic-pool count (unaffected), 26-case relationship classification (all 8 buckets + blank + unrecognized), prohibited-phrase scan (Western clichés and casual slang, 110 unique drafts, 0 hits), 220-character editor limit at worst-case 40-character name (0 over after fix), recipient-name insertion (110/110), manual-message preservation, condolence relationship pools and safety block unaffected, festival (Diwali) and Anniversary generation unaffected, export at exact 1200x1760 with zero overflow/clamp/collision, version alignment (`APP_VERSION`/`SW_VERSION`/manifest all `1.18.0`), and unchanged schema (v6, no migration required) all passed.

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
