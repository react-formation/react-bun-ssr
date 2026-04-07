# Reference

## Normative basis

- Official source of truth: https://accessibilite.numerique.gouv.fr/methode/criteres-et-tests/
- The official RGAA site identifies the current technical method as RGAA 4.1.2.
- The introduction states that the technical method applies to web page content, meaning HTML content, and that the method covers 106 RGAA criteria.
- Use the official criteria and tests page for exact normative wording when a fix depends on edge cases.

## What this skill can enforce well

- Static semantics and document structure.
- Accessible names for images, links, buttons, and form controls.
- Focus visibility, contrast, text resize, reflow, and text spacing concerns caused by CSS.
- Skip links, coherent tab order warnings, and common keyboard-access issues.
- Cases where HTML or CSS choices clearly create or remove an RGAA issue.

## What still needs manual audit

- Site-wide legal conformance claims or accessibility declarations.
- Assistive-technology behavior across browsers and operating systems.
- Complex JavaScript widgets, live regions, drag and drop, or custom focus management.
- Multimedia, documents, or organizational obligations that are outside plain HTML/CSS review.

## Practical checklist for HTML/CSS work

### 1. Images and non-text content

- `1.1`: Informative images need a text alternative.
- `1.1`: Informative SVGs need `role="img"` plus an accessible name.
- Decorative images should not expose useless names to assistive technology.

### 2. Color and contrast

- `3.1`: Information must not rely on color alone.
- `3.2`: Text contrast should meet 4.5:1 for normal text and 3:1 for large or bold text.
- `3.3`: Interface components and meaningful graphics should reach 3:1 against adjacent colors.

### 3. Links and controls

- `6.1` and `6.2`: Links need an understandable label and must not be empty.
- Keep icon-only controls explicitly named.
- Keep visible wording aligned with the accessible name of links, buttons, and fields.

### 4. Required document structure

- `8.1`: Full HTML pages need `<!DOCTYPE html>`.
- `8.2`: Generated code needs valid nesting, unique `id` values, and no broken structure.
- `8.3`: Set the main page language on `<html>` and mark language changes when relevant.
- `8.5` and `8.6`: Full pages need a present and meaningful `<title>`.
- `8.9`: Do not use semantic elements only for presentation.

### 5. Information structure

- `9.1`: Use meaningful headings when content structure requires them.
- `9.3`: Use real list markup for visual lists.
- `9.4`: Use quotation markup for quotations.
- Prefer explicit page structure over div-only layout when native HTML exists.

### 6. Presentation through CSS

- `10.1`: Use CSS for presentation and avoid presentational HTML.
- `10.4`: Users must be able to enlarge text to 200 percent.
- `10.7`: Focus indicators must stay visible.
- `10.11`: At 320 CSS px width, content and functionality should remain available without avoidable horizontal scrolling.
- `10.12`: Text must remain readable when users increase line, paragraph, letter, and word spacing.
- `10.13`: Content shown on hover or focus must remain usable and dismissible.
- `10.14`: Hover-only additional content must also be available from keyboard interaction.

### 7. Forms

- `11.1`: Every form control needs a label or accessible name.
- Match `label[for]` and `id` pairs correctly.
- `11.10`: Required state and format expectations should be visible before validation.
- `11.11`: Error messages should explain the expected type, format, or examples when needed.

### 8. Navigation and keyboard use

- `12.7`: Repeated layouts should expose a skip link or quick access to the main content.
- `12.8`: Tab order should stay coherent.
- `12.9`: Do not create keyboard traps.
- Avoid positive `tabindex` and CSS or DOM reordering that makes focus travel confusing.

### 9. Responsive and pointer behavior

- `13.9`: Content should work in both portrait and landscape unless orientation is essential.
- If a CSS or HTML change introduces pointer-only behavior, verify that keyboard and touch users are not blocked.

## Suggested local checks

1. Keyboard only: `Tab`, `Shift+Tab`, `Enter`, `Space`, and `Escape`.
2. Browser zoom or text resize to 200 percent.
3. Reflow near 320 CSS px width and in both orientations when relevant.
4. Contrast checks for every changed color pair.
5. HTML validation for nesting and duplicate `id` values.
6. Manual review of any hover, tooltip, dropdown, modal, or disclosure behavior affected by CSS.

## Escalate when

- The task touches ARIA-heavy custom widgets.
- Focus management depends on JavaScript timing or portals.
- The user asks for a formal RGAA conformance statement.
- The issue cannot be verified from HTML and CSS alone.
