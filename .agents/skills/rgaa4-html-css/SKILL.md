---
name: rgaa4-html-css
description: Reviews and edits HTML, CSS, JSX, and TSX markup or styles against the official RGAA 4.1.2 accessibility criteria, with practical code-level fixes and clear limits around manual audit. Use when creating or modifying HTML/CSS, templates, React markup, forms, navigation, focus styles, color systems, responsive layouts, or when the user mentions RGAA, accessibility, keyboard access, contrast, semantics, or screen reader support.
---

# RGAA 4 HTML/CSS

## Quick start

1. Identify the files that affect rendered markup or styles.
2. Map the change to the relevant checklist in [REFERENCE.md](REFERENCE.md).
3. Fix issues in code, not only in prose.
4. Validate keyboard, focus, contrast, and responsive behavior.
5. Report what is fixed, what still needs manual audit, and which RGAA criteria shaped the work.

## Workflow

### 1. Scope the review

- Include `*.html`, `*.css`, `*.scss`, `*.jsx`, `*.tsx`, templates, layout components, and CSS-in-JS that affects rendered HTML.
- Prioritize changed files first, then shared wrappers, layouts, and components they rely on.
- Treat the official RGAA 4.1.2 criteria as the source of truth.

### 2. Check the core RGAA buckets

- Semantics: valid structure, language, titles, headings, lists, quotations, and form labels.
- Perception: text alternatives, contrast, focus visibility, zoom, reflow, text spacing, and orientation.
- Interaction: keyboard reachability, skip links, coherent tab order, and no keyboard traps.
- CSS-only behavior: hover/focus reveals, hidden content, pseudo-content, and visual-only instructions.

### 3. Prefer safe implementation choices

- Prefer native HTML semantics before ARIA.
- Preserve browser focus styles unless a clearly visible replacement exists.
- Keep DOM order meaningful; avoid positive `tabindex` unless there is no safer option.
- Do not rely on `::before` or `::after` for meaningful text or control labels.
- Ensure hover-triggered content is also available on focus and pointer activation.
- Keep visible labels aligned with accessible names for links, buttons, and form fields.

### 4. Validate before closing

- Tab through the changed experience forward and backward.
- Check focus visibility on every interactive element touched by the change.
- Check changed color pairs for contrast.
- Check text resize to 200 percent, text spacing overrides, and reflow near 320 CSS px width.
- If a page or flow changed, verify skip-link or main-content access and form error handling.

## Output rules

- Cite RGAA criterion numbers when they materially shaped a fix.
- Separate results into `fixed`, `manual follow-up`, and `not verifiable from code alone`.
- Never claim full RGAA conformance from a local patch unless the audited scope is explicitly stated.

## Advanced features

See [REFERENCE.md](REFERENCE.md).
