# Rejected: a cutout that silently kept its whole background

`SHI_KAGE_VOID-CROWN-KAGE` shipped as a 1024x1024 image with **no transparency at all** — alpha was
opaque across every pixel, so the card drew a cream rectangle with a figure painted on it instead of a
cut-out figure. The model had painted the ground with visible brush strokes and a vignette, and the
border flood fill in `scripts/cutout.py` stops at the first pixel outside its tolerance; a brushed
ground defeats it on the first step and it clears nothing.

Nothing caught it. The asset registry counts a file as present if it exists, and this one existed. The
card had been on the deck screen for several passes with a pale slab where its art should be.

Two lessons, both now in `STYLE_GUIDE.md`:

- Prompts must forbid background texture explicitly — *absolutely no visible brush strokes or paint
  texture in the background, no vignette, no cream tone* — not just ask for white.
- A cutout whose opaque share is 1.0 has not been cut out. That is a one-line check worth running over
  the whole sample directory rather than trusting the eye on a contact sheet, where a pale card at
  thumbnail size reads as a light costume.
