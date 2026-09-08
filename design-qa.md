# Model meeting visual QA

final result: passed

Source visual truth: `public/assets/model-council.png` (260 × 194 pixels), copied byte-for-byte from the user attachment. The user requested live speech bubbles and a conclusion, not a static screenshot replica. No character artwork was regenerated or edited.

Implementation evidence: `.cache/screenshots/council-desktop.png` (1280 × 1704 browser capture, requested CSS viewport 1280 × 960); `.cache/screenshots/council-mobile.png` (390 × 844 pixels/CSS viewport). The desktop browser capture included more vertical content than the viewport request, so comparison used the illustration region and horizontal layout rather than asserting full-page dimension equivalence. Image aspect ratio remains 260:194 at both widths. Source and implementation were opened together in one comparison call.

State: real failed Actions run 34276337271, third attempt selected. Also inspected first attempt (invalid retrospective draft), second attempt (timeout), and uncalled peer details.

Findings and comparison history:
- Initial desktop artwork occupied 835 pixels horizontally and pushed the conclusion farther down the page. Reduced artwork to 680 pixels maximum and tightened header/intro spacing. Revised capture shows the three characters, three speech bubbles and final bubble together.
- A capture immediately after viewport change had stale raster dimensions. Discarded it, read the settled viewport and recaptured before comparison.
- No remaining P0/P1/P2 issue observed. The 260-pixel original is visibly pixelated at desktop scale, intentionally preserved rather than substituting artwork (P3/source limitation).

Fidelity surfaces:
- Typography: Korean system sans-serif for controls/bubbles, serif English source quote. Model labels are separate from speech and consistently positioned. This replaces only the user-requested editable speech content.
- Layout: original three-character triangular composition and lower conclusion ellipse preserved. Source and attempt selector sit beside the artwork on desktop and above it on mobile.
- Color: warm neutral surround reflects the original taupe background; black/white comic remains intact. Muted brown marks failure and selection without claiming success.
- Image quality: exact original asset, uncropped, correct aspect ratio. No generated approximations. Focused inspection of the mobile bubbles showed no exposed old text or clipped conclusion.
- Copy: only actual model outputs are shown. Invalid outputs carry a warning; uncalled models show no invented opinions. Failed review never implies an actual reset.

Interactions and runtime:
- Changed attempt 3 → 2 → 1 and checked the displayed model/status/evidence.
- Selected the second speech bubble and verified its not-run explanation.
- Mobile DOM overflow check: false at 390 pixels.
- Browser console error log: empty during the exercised local journey.
- Existing schedule/history remain below the meeting; source freshness and source-only notices remain visible.
- Node tests: 78 passed; TypeScript and static build passed. Existing full Playwright suite was not rerun; this turn used the in-app browser for UI verification.

No fabricated successful council fixture was shown as real data. A future successful live council remains an inference-system validation gap, not a visual acceptance claim.
