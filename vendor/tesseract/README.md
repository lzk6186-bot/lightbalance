# Tesseract.js bundled runtime

This folder contains a local copy of the Tesseract.js browser runtime and the
`chi_sim` fast language model, loaded only when the user chooses to import a
screenshot. The images are processed locally in the browser and are never
uploaded by 轻衡.

## Files

- `tesseract.min.js`, `worker.min.js` — Tesseract.js 6.0.1, Apache-2.0
- `core/tesseract-core-lstm.wasm.js`, `core/tesseract-core-simd-lstm.wasm.js` — tesseract.js-core, Apache-2.0
- `lang/chi_sim.traineddata.gz` — tessdata_fast `chi_sim` model, Apache-2.0
- `LICENSE-tesseract-js.md`, `LICENSE-tesseract-core.txt` — upstream licenses

Upstream projects:
- https://github.com/naptha/tesseract.js
- https://github.com/naptha/tesseract.js-core
- https://github.com/tesseract-ocr/tessdata_fast

The OCR runtime is intentionally excluded from the service-worker precache so
the initial app install stays small. It is fetched on demand and cached by the
browser/service worker after first use.
