# MediaPipe Tasks Vision 1.0.1 — local Face Detector for Smart Person Focus (R15)

Bundled so Smart Person Focus runs entirely on-device and offline. Nothing in
this folder is part of the mandatory service-worker precache; it is fetched
only after the user taps **Find people in photo**, then kept in the dedicated
`atul-detector-…` runtime cache for later offline use (see `sw.js`).

## Provenance

| File | Source | Bytes | SHA-256 |
|---|---|---|---|
| `vision_bundle.mjs` | npm `@mediapipe/tasks-vision@1.0.1` (`sourceMappingURL` comment removed) | 155,394 | `016e12a8…c64681` |
| `wasm/vision_wasm_internal.js` | same package | 323,377 | `e170ee67…454d73` |
| `wasm/vision_wasm_internal.wasm` | same package (WebAssembly SIMD build) | 11,756,954 | `8da277a7…f886` |
| `wasm/vision_wasm_nosimd_internal.js` | same package | 323,180 | `e81d715a…9658` |
| `wasm/vision_wasm_nosimd_internal.wasm` | same package (fallback for browsers without WebAssembly SIMD) | 10,960,242 | `a28483cd…3192` |
| `models/blaze_face_short_range.tflite` | `storage.googleapis.com/mediapipe-models/face_detector/blaze_face_short_range/float16/1/` | 229,746 | `b4578f35…152f` |

npm tarball integrity: `sha512-rvRE2FmAZ6ZxKSw7wq+e+jQDpN3t1B/tD2mJz9SmAzb1msoDkd4dMoE4wAh8Z30Um0PQwLiHr9QtomhmXk3aUQ==`

## License

MediaPipe and the BlazeFace short-range model are released by Google under the
Apache License 2.0 (`LICENSE`, copied from `google-ai-edge/mediapipe`). The
package itself ships no separate license file; its `package.json` declares
`Apache-2.0`.

## First-use download

- WebAssembly SIMD browsers (Chrome/Edge 91+, Firefox 89+, Safari 16.4+):
  bundle + SIMD loader + SIMD wasm + model = 12,465,471 bytes (11.89 MiB).
- Older browsers without SIMD: 11,668,562 bytes (11.13 MiB). Only one of the
  two wasm builds is ever downloaded; `FilesetResolver` probes SIMD support.

## Telemetry is blocked

The upstream README states that MediaPipe Tasks APIs send performance/usage
metrics (not images) to Google at `https://odml.pa.googleapis.com/v1/log`, and
the bundle starts that logger unconditionally with no opt-out. Atul Card Studio
does not allow cloud calls, so `index.html` sets
`Content-Security-Policy: connect-src 'self' blob: data:`. The browser refuses
the metrics request; detection is unaffected. One refused-connection notice may
appear in the browser console after detection is used — that is the block
working, not an error in the app.
