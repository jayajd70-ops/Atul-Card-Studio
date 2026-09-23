/* =========================================================================
   Atul Card Studio — js/app.js
   A single-file module set (namespaced sections) implementing:
     Utils -> DB -> AssetRepository -> ThemeRegistry/FoilPresets/
     FontPairings/StampCollections -> StateStore -> LayoutEngine ->
     Renderer -> AudioController -> ProjectVault -> ExportModule ->
     PWA/OfflineStatus -> UI wiring.
   Ownership boundaries mirror the architect spec so this file can later
   be split into src/app, src/assets, src/themes, src/renderer, etc.
   without changing behavior.
   ========================================================================= */
"use strict";

/* =========================================================================
   SECTION: Utils
   ========================================================================= */
const Utils = (() => {
  function uuid() {
    if (window.crypto && crypto.randomUUID) return crypto.randomUUID();
    return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (c) => {
      const r = (Math.random() * 16) | 0;
      const v = c === "x" ? r : (r & 0x3) | 0x8;
      return v.toString(16);
    });
  }

  function clamp(value, min, max) {
    return Math.min(max, Math.max(min, value));
  }

  function debounce(fn, wait) {
    let t = null;
    const debounced = (...args) => {
      clearTimeout(t);
      t = setTimeout(() => fn(...args), wait);
    };
    debounced.flush = (...args) => {
      clearTimeout(t);
      fn(...args);
    };
    debounced.cancel = () => clearTimeout(t);
    return debounced;
  }

  function clone(obj) {
    if (typeof structuredClone === "function") {
      try { return structuredClone(obj); } catch (err) { /* fall through to JSON clone */ }
    }
    return JSON.parse(JSON.stringify(obj));
  }

  // Strip control characters before text is used in filenames or DOM text
  // nodes. Canvas fillText never interprets markup and the preview panel
  // uses textContent, so this is defense-in-depth rather than the primary
  // XSS boundary.
  function sanitizeText(input, maxLen) {
    if (typeof maxLen !== "number") maxLen = 500;
    if (typeof input !== "string") return "";
    var controlCharsPattern = new RegExp(
      "[" + String.fromCharCode(0) + "-" + String.fromCharCode(8) +
      String.fromCharCode(11) + String.fromCharCode(12) +
      String.fromCharCode(14) + "-" + String.fromCharCode(31) +
      String.fromCharCode(127) + "]", "g"
    );
    var s = input.replace(controlCharsPattern, "");
    s = s.slice(0, maxLen);
    return s;
  }

  function sanitizeFilenamePart(input) {
    return sanitizeText(input, 60)
      .normalize("NFKD")
      .replace(/[̀-ͯ]/g, "")
      .replace(/[^a-zA-Z0-9\- ]/g, "")
      .trim()
      .replace(/\s+/g, "-")
      .toLowerCase() || "card";
  }

  // Character-cap truncation for prose that gets rendered as sentences (the
  // greeting), as opposed to sanitizeText's hard slice used for short
  // single-line fields (names, titles) where the browser's own maxlength
  // already prevents overflow. A plain slice can land mid-word with no
  // indication anything was cut — harmless for a name, but on a sentence it
  // reads as a rendering bug. This backs up to the last word boundary
  // within a short lookback window and appends an ellipsis instead. Exists
  // as a safety net for content that bypasses the textarea's own maxlength
  // (an imported backup from a different app version, for instance) — the
  // canvas renderer's own LayoutEngine.fitText/clampResult still owns
  // truncation for text that is short enough but doesn't fit vertically.
  function truncateProse(input, maxLen) {
    const s = sanitizeText(input, 100000); // strip control chars, no length cap yet
    if (s.length <= maxLen) return s;
    const ELLIPSIS = "…";
    const hardCut = s.slice(0, Math.max(0, maxLen - 1));
    const lookback = hardCut.slice(-24);
    const lastSpace = lookback.lastIndexOf(" ");
    const wordSafe = lastSpace === -1 ? hardCut : hardCut.slice(0, hardCut.length - (lookback.length - lastSpace));
    return wordSafe.replace(/[\s,;:.—-]+$/, "") + ELLIPSIS;
  }

  function formatBytes(bytes) {
    if (!Number.isFinite(bytes)) return "unknown";
    if (bytes < 1024) return bytes + " B";
    const units = ["KB", "MB", "GB"];
    let val = bytes / 1024;
    let i = 0;
    while (val >= 1024 && i < units.length - 1) { val /= 1024; i++; }
    return val.toFixed(1) + " " + units[i];
  }

  function formatTime(seconds) {
    if (!Number.isFinite(seconds) || seconds < 0) return "0:00";
    const m = Math.floor(seconds / 60);
    const s = Math.floor(seconds % 60);
    return m + ":" + String(s).padStart(2, "0");
  }

  function timeAgo(ts) {
    const diff = Date.now() - ts;
    const mins = Math.floor(diff / 60000);
    if (mins < 1) return "just now";
    if (mins < 60) return mins + "m ago";
    const hrs = Math.floor(mins / 60);
    if (hrs < 24) return hrs + "h ago";
    const days = Math.floor(hrs / 24);
    if (days < 30) return days + "d ago";
    return new Date(ts).toLocaleDateString();
  }

  function blobToDataUrl(blob) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result);
      reader.onerror = () => reject(reader.error);
      reader.readAsDataURL(blob);
    });
  }

  function dataUrlToBlob(dataUrl) {
    const parts = dataUrl.split(",");
    const meta = parts[0];
    const b64 = parts[1];
    const mimeMatch = /data:(.*);base64/.exec(meta);
    const mime = mimeMatch ? mimeMatch[1] : "application/octet-stream";
    const bin = atob(b64);
    const arr = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) arr[i] = bin.charCodeAt(i);
    return new Blob([arr], { type: mime });
  }

  function loadImage(src) {
    return new Promise((resolve, reject) => {
      const img = new Image();
      img.onload = () => resolve(img);
      img.onerror = (e) => reject(e);
      img.src = src;
    });
  }

  return {
    uuid, clamp, debounce, clone, sanitizeText, sanitizeFilenamePart, truncateProse,
    formatBytes, formatTime, timeAgo, blobToDataUrl, dataUrlToBlob, loadImage,
  };
})();

/* =========================================================================
   SECTION: DB (IndexedDB wrapper)
   Object stores: projects, assets, settings, schema-migrations
   ========================================================================= */
const DB = (() => {
  const DB_NAME = "atul-card-studio";
  const DB_VERSION = 1;
  let dbPromise = null;

  function open() {
    if (dbPromise) return dbPromise;
    dbPromise = new Promise((resolve, reject) => {
      const req = indexedDB.open(DB_NAME, DB_VERSION);
      req.onupgradeneeded = () => {
        const db = req.result;
        if (!db.objectStoreNames.contains("projects")) {
          const store = db.createObjectStore("projects", { keyPath: "id" });
          store.createIndex("updatedAt", "updatedAt");
        }
        if (!db.objectStoreNames.contains("assets")) {
          db.createObjectStore("assets", { keyPath: "id" });
        }
        if (!db.objectStoreNames.contains("settings")) {
          db.createObjectStore("settings", { keyPath: "key" });
        }
        if (!db.objectStoreNames.contains("schema-migrations")) {
          db.createObjectStore("schema-migrations", { keyPath: "version" });
        }
      };
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error);
      req.onblocked = () => reject(new Error("Database upgrade blocked by another open tab."));
    });
    return dbPromise;
  }

  async function tx(storeName, mode, fn) {
    const db = await open();
    return new Promise((resolve, reject) => {
      const transaction = db.transaction(storeName, mode);
      const store = transaction.objectStore(storeName);
      let result;
      Promise.resolve(fn(store))
        .then((r) => { result = r; })
        .catch(reject);
      transaction.oncomplete = () => resolve(result);
      transaction.onerror = () => reject(transaction.error);
      transaction.onabort = () => reject(transaction.error || new Error("Transaction aborted"));
    });
  }

  function reqToPromise(req) {
    return new Promise((resolve, reject) => {
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error);
    });
  }

  return {
    async put(storeName, value) { return tx(storeName, "readwrite", (s) => reqToPromise(s.put(value))); },
    async get(storeName, key) { return tx(storeName, "readonly", (s) => reqToPromise(s.get(key))); },
    async delete(storeName, key) { return tx(storeName, "readwrite", (s) => reqToPromise(s.delete(key))); },
    async getAll(storeName) { return tx(storeName, "readonly", (s) => reqToPromise(s.getAll())); },
    async clear(storeName) { return tx(storeName, "readwrite", (s) => reqToPromise(s.clear())); },
    isAvailable() {
      try { return typeof indexedDB !== "undefined"; } catch (err) { return false; }
    },
  };
})();

/* =========================================================================
   SECTION: AssetRepository
   StoredAsset = { id, kind, mimeType, blob, width?, height?, duration?, createdAt }
   Owns binary persistence, object URL lifecycle, validation, derivatives.
   ========================================================================= */
const AssetRepository = (() => {
  const objectUrls = new Map(); // assetId -> { url, refCount }

  const LIMITS = {
    photo: { maxBytes: 25 * 1024 * 1024 },
    audio: { maxBytes: 15 * 1024 * 1024, maxDurationSec: 90 },
  };

  async function storePhoto(file) {
    if (!/^image\/(png|jpeg|jpg|webp)$/.test(file.type)) {
      throw new Error("Unsupported image format. Please use JPG, PNG or WEBP.");
    }
    if (file.size > LIMITS.photo.maxBytes) {
      throw new Error("Image is too large (max " + Utils.formatBytes(LIMITS.photo.maxBytes) + ").");
    }
    const dims = await loadDimensions(file);
    const asset = {
      id: Utils.uuid(),
      kind: "photo",
      mimeType: file.type,
      blob: file,
      width: dims.width,
      height: dims.height,
      createdAt: Date.now(),
    };
    await DB.put("assets", asset);
    await generatePreviewDerivative(asset);
    return asset;
  }

  async function generatePreviewDerivative(asset) {
    const MAX_DIM = 1400;
    if (Math.max(asset.width, asset.height) <= MAX_DIM) return;
    try {
      const url = await getObjectUrl(asset.id, asset.blob);
      const img = await Utils.loadImage(url);
      const scale = MAX_DIM / Math.max(img.width, img.height);
      const canvas = document.createElement("canvas");
      canvas.width = Math.round(img.width * scale);
      canvas.height = Math.round(img.height * scale);
      const ctx = canvas.getContext("2d");
      ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
      const previewBlob = await new Promise((res) => canvas.toBlob(res, "image/jpeg", 0.86));
      if (previewBlob) {
        const previewAsset = {
          id: asset.id + "__preview",
          kind: "photo",
          mimeType: "image/jpeg",
          blob: previewBlob,
          width: canvas.width,
          height: canvas.height,
          createdAt: Date.now(),
        };
        await DB.put("assets", previewAsset);
      }
    } catch (err) {
      console.warn("Preview derivative generation failed; full-resolution photo will be used instead.", err);
    }
  }

  function loadDimensions(file) {
    return new Promise((resolve, reject) => {
      const url = URL.createObjectURL(file);
      const img = new Image();
      img.onload = () => { resolve({ width: img.naturalWidth, height: img.naturalHeight }); URL.revokeObjectURL(url); };
      img.onerror = (e) => { URL.revokeObjectURL(url); reject(e); };
      img.src = url;
    });
  }

  async function storeAudio(file) {
    const accepted = ["audio/mpeg", "audio/mp4", "audio/ogg", "audio/wav", "audio/x-wav", "audio/webm", "audio/aac"];
    if (!accepted.includes(file.type) && !/^audio\//.test(file.type)) {
      throw new Error("Unsupported audio format.");
    }
    if (file.size > LIMITS.audio.maxBytes) {
      throw new Error("Audio file is too large (max " + Utils.formatBytes(LIMITS.audio.maxBytes) + ").");
    }
    const duration = await probeDuration(file).catch(() => null);
    if (duration != null && duration > LIMITS.audio.maxDurationSec + 1) {
      throw new Error("Audio is too long (max " + LIMITS.audio.maxDurationSec + "s).");
    }
    const asset = {
      id: Utils.uuid(),
      kind: "audio",
      mimeType: file.type || "audio/mpeg",
      blob: file,
      duration: duration || undefined,
      createdAt: Date.now(),
    };
    await DB.put("assets", asset);
    return asset;
  }

  function probeDuration(file) {
    return new Promise((resolve, reject) => {
      const url = URL.createObjectURL(file);
      const audio = document.createElement("audio");
      audio.preload = "metadata";
      audio.onloadedmetadata = () => { resolve(audio.duration); URL.revokeObjectURL(url); };
      audio.onerror = (e) => { URL.revokeObjectURL(url); reject(e); };
      audio.src = url;
    });
  }

  async function getAsset(id) {
    return DB.get("assets", id);
  }

  async function getObjectUrl(id, blobHint) {
    if (objectUrls.has(id)) {
      const entry = objectUrls.get(id);
      entry.refCount++;
      return entry.url;
    }
    let blob = blobHint;
    if (!blob) {
      const asset = await getAsset(id);
      if (!asset) return null;
      blob = asset.blob;
    }
    const url = URL.createObjectURL(blob);
    objectUrls.set(id, { url, refCount: 1 });
    return url;
  }

  function releaseObjectUrl(id) {
    const entry = objectUrls.get(id);
    if (!entry) return;
    entry.refCount--;
    if (entry.refCount <= 0) {
      URL.revokeObjectURL(entry.url);
      objectUrls.delete(id);
    }
  }

  function revokeAll() {
    for (const entry of objectUrls.values()) URL.revokeObjectURL(entry.url);
    objectUrls.clear();
  }

  async function deleteAsset(id) {
    releaseObjectUrl(id);
    await DB.delete("assets", id);
    await DB.delete("assets", id + "__preview").catch(() => {});
  }

  async function getPreviewOrOriginalUrl(id) {
    const preview = await getAsset(id + "__preview");
    if (preview) return getObjectUrl(id + "__preview", preview.blob);
    return getObjectUrl(id);
  }

  return {
    storePhoto, storeAudio, getAsset, getObjectUrl, releaseObjectUrl, revokeAll,
    deleteAsset, getPreviewOrOriginalUrl, LIMITS,
  };
})();

/* =========================================================================
   SECTION: FontPairings
   Curated typography library. Each pairing names Google Fonts loaded via
   <link> in index.html; the mood selector maps to a pairing + spacing
   defaults, applied consistently across recipient/greeting/support/signature.
   ========================================================================= */
const FontPairings = (() => {
  const PAIRINGS = [
    {
      id: "cormorant-inter",
      name: "Cormorant Garamond + Inter",
      description: "Airy serif display with a quiet grotesque support voice.",
      recipientFont: "'Cormorant Garamond', serif",
      greetingFont: "'Inter', sans-serif",
      supportFont: "'Inter', sans-serif",
      signatureFont: "'Cormorant Garamond', serif",
      recipientWeight: "600",
      greetingWeight: "400",
      sizeRange: { recipient: [56, 96], greeting: [22, 36] },
      letterSpacing: 0.2,
      lineHeight: 1.28,
      maxTextWidthRatio: 0.82,
    },
    {
      id: "playfair-montserrat",
      name: "Playfair Display + Montserrat",
      description: "High-contrast editorial serif against a crisp geometric sans.",
      recipientFont: "'Playfair Display', serif",
      greetingFont: "'Montserrat', sans-serif",
      supportFont: "'Montserrat', sans-serif",
      signatureFont: "'Playfair Display', serif",
      recipientWeight: "700",
      greetingWeight: "500",
      sizeRange: { recipient: [52, 92], greeting: [20, 34] },
      letterSpacing: 0,
      lineHeight: 1.3,
      maxTextWidthRatio: 0.8,
    },
    {
      id: "cinzel-source-sans",
      name: "Cinzel + Source Sans 3",
      description: "Carved, regal capitals paired with a calm humanist sans.",
      recipientFont: "'Cinzel', serif",
      greetingFont: "'Source Sans 3', sans-serif",
      supportFont: "'Source Sans 3', sans-serif",
      signatureFont: "'Cinzel', serif",
      recipientWeight: "600",
      greetingWeight: "400",
      sizeRange: { recipient: [46, 84], greeting: [18, 30] },
      letterSpacing: 1.4,
      lineHeight: 1.35,
      maxTextWidthRatio: 0.78,
    },
    {
      id: "baskerville-manrope",
      name: "Libre Baskerville + Manrope",
      description: "Bookish, romantic serif with a warm modern sans.",
      recipientFont: "'Libre Baskerville', serif",
      greetingFont: "'Manrope', sans-serif",
      supportFont: "'Manrope', sans-serif",
      signatureFont: "'Libre Baskerville', serif",
      recipientWeight: "700",
      greetingWeight: "400",
      sizeRange: { recipient: [46, 82], greeting: [18, 30] },
      letterSpacing: 0.1,
      lineHeight: 1.4,
      maxTextWidthRatio: 0.84,
    },
    {
      id: "dmserif-worksans",
      name: "DM Serif Display + Work Sans",
      description: "Confident modern-luxury display serif, clean sans support.",
      recipientFont: "'DM Serif Display', serif",
      greetingFont: "'Work Sans', sans-serif",
      supportFont: "'Work Sans', sans-serif",
      signatureFont: "'DM Serif Display', serif",
      recipientWeight: "400",
      greetingWeight: "500",
      sizeRange: { recipient: [54, 94], greeting: [20, 34] },
      letterSpacing: -0.2,
      lineHeight: 1.3,
      maxTextWidthRatio: 0.8,
    },
  ];

  const MOODS = {
    classic: { pairingId: "cormorant-inter", letterSpacing: 0.2, lineHeight: 1.3 },
    regal: { pairingId: "cinzel-source-sans", letterSpacing: 1.6, lineHeight: 1.35 },
    editorial: { pairingId: "playfair-montserrat", letterSpacing: 0, lineHeight: 1.28 },
    romantic: { pairingId: "baskerville-manrope", letterSpacing: 0.1, lineHeight: 1.4 },
    "modern-luxury": { pairingId: "dmserif-worksans", letterSpacing: -0.1, lineHeight: 1.3 },
  };

  function getPairing(id) {
    return PAIRINGS.find((p) => p.id === id) || PAIRINGS[0];
  }

  function getMood(mood) {
    return MOODS[mood] || MOODS.classic;
  }

  function list() { return PAIRINGS; }
  function moodList() { return Object.keys(MOODS); }

  // Collect every font family referenced so the typography engine can wait
  // on exactly the fonts it needs rather than blocking on document.fonts.ready
  // for families the current pairing does not use.
  function familiesFor(pairing) {
    const set = new Set();
    [pairing.recipientFont, pairing.greetingFont, pairing.supportFont, pairing.signatureFont].forEach((f) => {
      const match = /'([^']+)'/.exec(f);
      if (match) set.add(match[1]);
    });
    return Array.from(set);
  }

  return { list, moodList, getPairing, getMood, familiesFor };
})();

/* =========================================================================
   SECTION: FoilPresets
   Multi-stop metallic gradients with luminance variation for foil/emboss.
   ========================================================================= */
const FoilPresets = (() => {
  const PRESETS = [
    {
      id: "gold",
      name: "Gold",
      stops: [
        { t: 0.0, c: "#fff6dc" }, { t: 0.18, c: "#f4dd9c" }, { t: 0.38, c: "#d9ad52" },
        { t: 0.55, c: "#b8863a" }, { t: 0.72, c: "#e9c778" }, { t: 0.88, c: "#8f6425" }, { t: 1.0, c: "#f7e3a8" },
      ],
      shadow: "#3a2508", highlight: "#fffaf0",
    },
    {
      id: "champagne",
      name: "Champagne",
      stops: [
        { t: 0.0, c: "#fffaf0" }, { t: 0.2, c: "#f2e6c9" }, { t: 0.42, c: "#d9c49a" },
        { t: 0.6, c: "#c2a877" }, { t: 0.78, c: "#e8d9b6" }, { t: 1.0, c: "#a88f63" },
      ],
      shadow: "#403422", highlight: "#fffdf5",
    },
    {
      id: "rose-gold",
      name: "Rose Gold",
      stops: [
        { t: 0.0, c: "#ffe9e2" }, { t: 0.2, c: "#f3c3b0" }, { t: 0.42, c: "#d99884" },
        { t: 0.6, c: "#b97564" }, { t: 0.78, c: "#eab6a2" }, { t: 1.0, c: "#8c5347" },
      ],
      shadow: "#3c1912", highlight: "#fff1ec",
    },
    {
      id: "platinum",
      name: "Platinum",
      stops: [
        { t: 0.0, c: "#ffffff" }, { t: 0.2, c: "#e6e8ec" }, { t: 0.42, c: "#c3c7cf" },
        { t: 0.6, c: "#9ba0aa" }, { t: 0.78, c: "#dfe2e7" }, { t: 1.0, c: "#767b86" },
      ],
      shadow: "#1c1e22", highlight: "#ffffff",
    },
    {
      id: "emerald",
      name: "Emerald",
      stops: [
        { t: 0.0, c: "#d9fff0" }, { t: 0.2, c: "#8fe8bf" }, { t: 0.42, c: "#3fae7c" },
        { t: 0.6, c: "#1f7a57" }, { t: 0.78, c: "#6fcf9e" }, { t: 1.0, c: "#0f4a34" },
      ],
      shadow: "#02160f", highlight: "#e9fff5",
    },
    {
      id: "burgundy",
      name: "Burgundy",
      stops: [
        { t: 0.0, c: "#ffd9dc" }, { t: 0.2, c: "#e894a0" }, { t: 0.42, c: "#a83f52" },
        { t: 0.6, c: "#752438" }, { t: 0.78, c: "#c66c7e" }, { t: 1.0, c: "#3f0f1c" },
      ],
      shadow: "#180307", highlight: "#ffe9ec",
    },
    {
      id: "condolence-sage", name: "Condolence Sage", internal: true,
      stops: [
        { t: 0, c: "#edf3ec" }, { t: 0.24, c: "#b6c7b5" }, { t: 0.5, c: "#78917c" },
        { t: 0.7, c: "#506957" }, { t: 0.86, c: "#a9bba9" }, { t: 1, c: "#405547" },
      ],
      shadow: "#26362b", highlight: "#f7faf6",
    },
    {
      id: "condolence-slate", name: "Condolence Slate", internal: true,
      stops: [
        { t: 0, c: "#f2f5f8" }, { t: 0.22, c: "#c1ccd7" }, { t: 0.48, c: "#73879b" },
        { t: 0.68, c: "#4d6277" }, { t: 0.84, c: "#a8b6c4" }, { t: 1, c: "#3b4d60" },
      ],
      shadow: "#1b242e", highlight: "#f8fafc",
    },
    {
      id: "condolence-navy", name: "Condolence Navy", internal: true,
      stops: [
        { t: 0, c: "#e7ebef" }, { t: 0.2, c: "#a9b5c1" }, { t: 0.44, c: "#52667b" },
        { t: 0.66, c: "#263b52" }, { t: 0.82, c: "#718397" }, { t: 1, c: "#172a3d" },
      ],
      shadow: "#101b29", highlight: "#f4f6f8",
    },
  ];

  function getPreset(id) { return PRESETS.find((p) => p.id === id) || PRESETS[0]; }
  function list() { return PRESETS.filter((preset) => !preset.internal); }

  return { list, getPreset };
})();

/* =========================================================================
   SECTION: StampCollections
   Non-vector-feeling decorative stamps. Because this build has no bundled
   photographic asset pipeline, each stamp is a dimensional procedural
   drawing (radial lighting, bevels, cast shadow) rendered at whatever
   resolution the canvas needs, rather than a flat single-color vector icon
   or a raster PNG. This keeps stamps crisp at the 1200x1760 export without
   shipping binary art assets. Each definition exposes a `draw(ctx, size,
   opts)` that renders into a size x size square centered at the origin.
   ========================================================================= */
const StampCollections = (() => {
  function withShadow(ctx, blur, color, offX, offY, fn) {
    ctx.save();
    ctx.shadowColor = color;
    ctx.shadowBlur = blur;
    ctx.shadowOffsetX = offX;
    ctx.shadowOffsetY = offY;
    fn();
    ctx.restore();
  }

  function metallicGradient(ctx, x0, y0, x1, y1, preset) {
    const grad = ctx.createLinearGradient(x0, y0, x1, y1);
    preset.stops.forEach((s) => grad.addColorStop(s.t, s.c));
    return grad;
  }

  function drawRibbonBadge(ctx, size, opts) {
    const preset = opts.preset;
    const s = size;
    withShadow(ctx, s * 0.06, "rgba(0,0,0,0.45)", 0, s * 0.02, () => {
      ctx.save();
      ctx.translate(0, 0);
      // Tails
      ctx.fillStyle = metallicGradient(ctx, -s * 0.3, 0, s * 0.3, 0, preset);
      [-1, 1].forEach((dir) => {
        ctx.save();
        ctx.beginPath();
        ctx.moveTo(dir * s * 0.14, s * 0.18);
        ctx.lineTo(dir * s * 0.30, s * 0.46);
        ctx.lineTo(dir * s * 0.16, s * 0.40);
        ctx.lineTo(dir * s * 0.06, s * 0.46);
        ctx.closePath();
        ctx.fill();
        ctx.restore();
      });
      // Medallion disc
      const r = s * 0.26;
      const discGrad = ctx.createRadialGradient(-r * 0.35, -r * 0.4, r * 0.1, 0, 0, r);
      preset.stops.forEach((st) => discGrad.addColorStop(st.t, st.c));
      ctx.beginPath();
      ctx.arc(0, 0, r, 0, Math.PI * 2);
      ctx.fillStyle = discGrad;
      ctx.fill();
      ctx.lineWidth = s * 0.01;
      ctx.strokeStyle = preset.shadow;
      ctx.stroke();
      // Inner ring
      ctx.beginPath();
      ctx.arc(0, 0, r * 0.72, 0, Math.PI * 2);
      ctx.lineWidth = s * 0.012;
      ctx.strokeStyle = "rgba(255,255,255,0.5)";
      ctx.stroke();
      // Star glyph
      drawStar(ctx, 0, 0, r * 0.4, r * 0.16, 5, preset.highlight);
      ctx.restore();
    });
  }

  function drawStar(ctx, cx, cy, outerR, innerR, points, color) {
    ctx.save();
    ctx.beginPath();
    for (let i = 0; i < points * 2; i++) {
      const r = i % 2 === 0 ? outerR : innerR;
      const a = (Math.PI / points) * i - Math.PI / 2;
      const x = cx + Math.cos(a) * r;
      const y = cy + Math.sin(a) * r;
      i === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y);
    }
    ctx.closePath();
    ctx.fillStyle = color;
    ctx.globalAlpha = 0.85;
    ctx.fill();
    ctx.restore();
  }

  function drawMedallion(ctx, size, opts) {
    const preset = opts.preset;
    const s = size;
    const r = s * 0.42;
    withShadow(ctx, s * 0.08, "rgba(0,0,0,0.5)", 0, s * 0.025, () => {
      const outerGrad = ctx.createRadialGradient(-r * 0.3, -r * 0.35, r * 0.1, 0, 0, r);
      preset.stops.forEach((st) => outerGrad.addColorStop(st.t, st.c));
      ctx.beginPath();
      ctx.arc(0, 0, r, 0, Math.PI * 2);
      ctx.fillStyle = outerGrad;
      ctx.fill();
      ctx.lineWidth = s * 0.014;
      ctx.strokeStyle = preset.shadow;
      ctx.stroke();

      // Fluted edge ticks
      ctx.save();
      for (let i = 0; i < 36; i++) {
        ctx.rotate((Math.PI * 2) / 36);
        ctx.beginPath();
        ctx.moveTo(r * 0.94, 0);
        ctx.lineTo(r * 1.0, 0);
        ctx.lineWidth = s * 0.006;
        ctx.strokeStyle = "rgba(0,0,0,0.25)";
        ctx.stroke();
      }
      ctx.restore();

      // Inner recessed circle
      const innerR = r * 0.68;
      const innerGrad = ctx.createRadialGradient(0, 0, innerR * 0.2, 0, 0, innerR);
      innerGrad.addColorStop(0, "rgba(0,0,0,0.18)");
      innerGrad.addColorStop(1, "rgba(255,255,255,0.12)");
      ctx.beginPath();
      ctx.arc(0, 0, innerR, 0, Math.PI * 2);
      ctx.fillStyle = innerGrad;
      ctx.fill();
      ctx.lineWidth = s * 0.008;
      ctx.strokeStyle = "rgba(255,255,255,0.4)";
      ctx.stroke();
    });

    // Center monogram / initial
    const label = (opts.monogram || "A").slice(0, 2).toUpperCase();
    ctx.save();
    ctx.font = "600 " + Math.round(s * 0.32) + "px 'Cinzel', serif";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    const textGrad = metallicGradient(ctx, 0, -s * 0.14, 0, s * 0.14, preset);
    ctx.fillStyle = textGrad;
    ctx.fillText(label, 0, s * 0.01);
    ctx.restore();
  }

  function drawWaxSeal(ctx, size, opts) {
    const s = size;
    const r = s * 0.4;
    const waxColor = opts.waxColor || "#7a1420";
    const waxDark = opts.waxDark || "#4a0b12";
    withShadow(ctx, s * 0.09, "rgba(0,0,0,0.55)", 0, s * 0.03, () => {
      // Irregular wax blob (soft polygon)
      ctx.beginPath();
      const bumps = 14;
      for (let i = 0; i <= bumps; i++) {
        const a = (Math.PI * 2 * i) / bumps;
        const wobble = 1 + Math.sin(a * 5) * 0.035 + Math.cos(a * 3) * 0.02;
        const x = Math.cos(a) * r * wobble;
        const y = Math.sin(a) * r * wobble;
        i === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y);
      }
      ctx.closePath();
      const waxGrad = ctx.createRadialGradient(-r * 0.3, -r * 0.35, r * 0.15, 0, 0, r * 1.05);
      waxGrad.addColorStop(0, lighten(waxColor, 0.35));
      waxGrad.addColorStop(0.55, waxColor);
      waxGrad.addColorStop(1, waxDark);
      ctx.fillStyle = waxGrad;
      ctx.fill();
    });

    // Pressed monogram recess
    const label = (opts.monogram || "A").slice(0, 1).toUpperCase();
    ctx.save();
    ctx.beginPath();
    ctx.arc(0, 0, r * 0.62, 0, Math.PI * 2);
    ctx.strokeStyle = "rgba(0,0,0,0.35)";
    ctx.lineWidth = s * 0.01;
    ctx.stroke();
    ctx.font = "600 " + Math.round(s * 0.4) + "px 'Cinzel', serif";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillStyle = "rgba(0,0,0,0.32)";
    ctx.fillText(label, s * 0.015, s * 0.03);
    ctx.fillStyle = "rgba(255,255,255,0.18)";
    ctx.fillText(label, -s * 0.008, s * 0.01);
    ctx.restore();
  }

  function lighten(hex, amt) {
    const c = hexToRgb(hex);
    const r = Math.round(c.r + (255 - c.r) * amt);
    const g = Math.round(c.g + (255 - c.g) * amt);
    const b = Math.round(c.b + (255 - c.b) * amt);
    return "rgb(" + r + "," + g + "," + b + ")";
  }
  function hexToRgb(hex) {
    const m = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
    return m ? { r: parseInt(m[1], 16), g: parseInt(m[2], 16), b: parseInt(m[3], 16) } : { r: 122, g: 20, b: 32 };
  }

  function drawFloralOrnament(ctx, size, opts) {
    const preset = opts.preset;
    const s = size;
    ctx.save();
    ctx.strokeStyle = metallicGradient(ctx, -s * 0.3, 0, s * 0.3, 0, preset);
    ctx.lineWidth = s * 0.02;
    ctx.lineCap = "round";
    withShadow(ctx, s * 0.03, "rgba(0,0,0,0.35)", 0, s * 0.008, () => {
      // Central stem
      ctx.beginPath();
      ctx.moveTo(0, s * 0.32);
      ctx.quadraticCurveTo(0, 0, 0, -s * 0.32);
      ctx.stroke();
      // Symmetrical leaf sprigs
      for (let i = -2; i <= 2; i++) {
        if (i === 0) continue;
        const t = i / 2;
        const y = t * s * 0.22;
        ctx.save();
        ctx.beginPath();
        ctx.moveTo(0, y);
        ctx.quadraticCurveTo(Math.sign(i) * s * 0.22, y - s * 0.05, Math.sign(i) * s * 0.34, y - s * 0.02);
        ctx.stroke();
        // small leaf blade
        ctx.beginPath();
        ctx.ellipse(Math.sign(i) * s * 0.3, y - s * 0.03, s * 0.07, s * 0.035, Math.sign(i) * -0.4, 0, Math.PI * 2);
        ctx.fillStyle = metallicGradient(ctx, -s * 0.1, 0, s * 0.1, 0, preset);
        ctx.fill();
        ctx.restore();
      }
      // Blossom at top
      for (let p = 0; p < 5; p++) {
        ctx.save();
        ctx.translate(0, -s * 0.34);
        ctx.rotate((Math.PI * 2 * p) / 5);
        ctx.beginPath();
        ctx.ellipse(0, -s * 0.06, s * 0.045, s * 0.08, 0, 0, Math.PI * 2);
        ctx.fillStyle = metallicGradient(ctx, 0, -s * 0.12, 0, 0, preset);
        ctx.fill();
        ctx.restore();
      }
      ctx.beginPath();
      ctx.arc(0, -s * 0.34, s * 0.045, 0, Math.PI * 2);
      ctx.fillStyle = preset.highlight;
      ctx.fill();
    });
    ctx.restore();
  }

  function drawCelestialOrnament(ctx, size, opts) {
    const preset = opts.preset;
    const s = size;
    withShadow(ctx, s * 0.04, "rgba(0,0,0,0.35)", 0, s * 0.01, () => {
      // Crescent moon
      ctx.save();
      ctx.beginPath();
      ctx.arc(-s * 0.04, 0, s * 0.24, 0, Math.PI * 2);
      ctx.fillStyle = metallicGradient(ctx, -s * 0.2, -s * 0.2, s * 0.2, s * 0.2, preset);
      ctx.fill();
      ctx.globalCompositeOperation = "destination-out";
      ctx.beginPath();
      ctx.arc(s * 0.06, -s * 0.03, s * 0.21, 0, Math.PI * 2);
      ctx.fillStyle = "black";
      ctx.fill();
      ctx.restore();
      // Small stars
      [[s*0.28, -s*0.22, 0.09], [s*0.34, s*0.12, 0.06], [-s*0.3, s*0.24, 0.05]].forEach(([x, y, r]) => {
        drawStar(ctx, x, y, s * r, s * r * 0.4, 4, preset.highlight);
      });
    });
  }

  function drawCrest(ctx, size, opts) {
    const preset = opts.preset;
    const s = size;
    withShadow(ctx, s * 0.06, "rgba(0,0,0,0.45)", 0, s * 0.02, () => {
      // Shield outline
      ctx.beginPath();
      ctx.moveTo(-s * 0.28, -s * 0.32);
      ctx.lineTo(s * 0.28, -s * 0.32);
      ctx.lineTo(s * 0.28, s * 0.06);
      ctx.quadraticCurveTo(s * 0.28, s * 0.34, 0, s * 0.42);
      ctx.quadraticCurveTo(-s * 0.28, s * 0.34, -s * 0.28, s * 0.06);
      ctx.closePath();
      const shieldGrad = metallicGradient(ctx, -s * 0.28, -s * 0.32, s * 0.28, s * 0.42, preset);
      ctx.fillStyle = shieldGrad;
      ctx.fill();
      ctx.lineWidth = s * 0.018;
      ctx.strokeStyle = preset.shadow;
      ctx.stroke();
      // Inner division line
      ctx.beginPath();
      ctx.moveTo(-s * 0.2, -s * 0.05);
      ctx.lineTo(s * 0.2, -s * 0.05);
      ctx.lineWidth = s * 0.01;
      ctx.strokeStyle = "rgba(0,0,0,0.3)";
      ctx.stroke();
      // Small central star
      drawStar(ctx, 0, s * 0.12, s * 0.11, s * 0.045, 5, preset.highlight);
    });
    const label = (opts.monogram || "A").slice(0, 1).toUpperCase();
    ctx.save();
    ctx.font = "600 " + Math.round(s * 0.22) + "px 'Cinzel', serif";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillStyle = "rgba(0,0,0,0.55)";
    ctx.fillText(label, 0, -s * 0.14);
    ctx.restore();
  }

  function drawTextBadge(ctx, size, opts) {
    const preset = opts.preset;
    const s = size;
    const text = opts.text || "With Love";
    ctx.save();
    ctx.font = "600 " + Math.round(s * 0.145) + "px 'Cormorant Garamond', serif";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    const metrics = ctx.measureText(text);
    const padX = s * 0.14;
    const w = Math.min(s * 0.92, metrics.width + padX * 2);
    const h = s * 0.26;
    withShadow(ctx, s * 0.05, "rgba(0,0,0,0.4)", 0, s * 0.015, () => {
      ctx.beginPath();
      const rr = h / 2;
      roundRectPath(ctx, -w / 2, -h / 2, w, h, rr);
      ctx.fillStyle = "rgba(10,9,14,0.72)";
      ctx.fill();
      ctx.lineWidth = s * 0.008;
      ctx.strokeStyle = metallicGradient(ctx, -w / 2, 0, w / 2, 0, preset);
      ctx.stroke();
    });
    ctx.fillStyle = metallicGradient(ctx, -w / 2, -h / 2, w / 2, h / 2, preset);
    ctx.fillText(text, 0, s * 0.008);
    ctx.restore();
  }

  function roundRectPath(ctx, x, y, w, h, r) {
    ctx.moveTo(x + r, y);
    ctx.arcTo(x + w, y, x + w, y + h, r);
    ctx.arcTo(x + w, y + h, x, y + h, r);
    ctx.arcTo(x, y + h, x, y, r);
    ctx.arcTo(x, y, x + w, y, r);
    ctx.closePath();
  }

  const DEFS = [
    { id: "with-love", name: "With Love", category: "badge", defaultLayer: "top",
      draw: (ctx, s, o) => drawTextBadge(ctx, s, { ...o, text: "With Love" }) },
    { id: "celebrating-you", name: "Celebrating You", category: "badge", defaultLayer: "top",
      draw: (ctx, s, o) => drawTextBadge(ctx, s, { ...o, text: "Celebrating You" }) },
    { id: "made-for-you", name: "Made Especially For You", category: "badge", defaultLayer: "top",
      draw: (ctx, s, o) => drawTextBadge(ctx, s, { ...o, text: "Made Especially For You" }) },
    { id: "happy-birthday", name: "Happy Birthday", category: "occasion", defaultLayer: "top",
      draw: (ctx, s, o) => drawTextBadge(ctx, s, { ...o, text: "Happy Birthday" }) },
    { id: "happy-anniversary", name: "Happy Anniversary", category: "occasion", defaultLayer: "top",
      draw: (ctx, s, o) => drawTextBadge(ctx, s, { ...o, text: "Happy Anniversary" }) },
    { id: "congratulations-badge", name: "Congratulations", category: "occasion", defaultLayer: "top",
      draw: (ctx, s, o) => drawTextBadge(ctx, s, { ...o, text: "Congratulations" }) },
    { id: "welcome-baby", name: "Welcome Baby", category: "occasion", defaultLayer: "top",
      draw: (ctx, s, o) => drawTextBadge(ctx, s, { ...o, text: "Welcome Baby" }) },
    { id: "new-home-badge", name: "New Home", category: "occasion", defaultLayer: "top",
      draw: (ctx, s, o) => drawTextBadge(ctx, s, { ...o, text: "New Home" }) },
    { id: "proud-graduate", name: "Proud Graduate", category: "occasion", defaultLayer: "top",
      draw: (ctx, s, o) => drawTextBadge(ctx, s, { ...o, text: "Proud Graduate" }) },
    { id: "happy-retirement", name: "Happy Retirement", category: "occasion", defaultLayer: "top",
      draw: (ctx, s, o) => drawTextBadge(ctx, s, { ...o, text: "Happy Retirement" }) },
    { id: "get-well-soon", name: "Get Well Soon", category: "occasion", defaultLayer: "top",
      draw: (ctx, s, o) => drawTextBadge(ctx, s, { ...o, text: "Get Well Soon" }) },
    { id: "thank-you-badge", name: "Thank You", category: "occasion", defaultLayer: "top",
      draw: (ctx, s, o) => drawTextBadge(ctx, s, { ...o, text: "Thank You" }) },
    { id: "wax-seal", name: "Wax Seal", category: "seal", defaultLayer: "foreground", draw: drawWaxSeal },
    { id: "gold-medallion", name: "Gold Medallion", category: "medallion", defaultLayer: "foreground", draw: drawMedallion },
    { id: "ribbon-badge", name: "Ribbon Badge", category: "ribbon", defaultLayer: "foreground", draw: drawRibbonBadge },
    { id: "floral-ornament", name: "Floral Sprig", category: "ornament", defaultLayer: "background", draw: drawFloralOrnament },
    { id: "celestial-ornament", name: "Celestial", category: "ornament", defaultLayer: "background", draw: drawCelestialOrnament },
    { id: "crest", name: "Theme Crest", category: "crest", defaultLayer: "foreground", draw: drawCrest },
    { id: "monogram", name: "Monogram", category: "monogram", defaultLayer: "foreground", draw: drawMedallion },
  ];

  function getDef(id) { return DEFS.find((d) => d.id === id) || DEFS[0]; }
  function list() { return DEFS; }

  // Render a stamp into a freshly created canvas at `size` px for gallery
  // thumbnails or overlay display. `opts.preset` is a FoilPreset; monogram
  // stamps also take `opts.monogram` (1-2 initials).
  function renderToCanvas(id, size, opts) {
    const canvas = document.createElement("canvas");
    canvas.width = size;
    canvas.height = size;
    const ctx = canvas.getContext("2d");
    ctx.translate(size / 2, size / 2);
    const def = getDef(id);
    def.draw(ctx, size * 0.86, opts || {});
    return canvas;
  }

  return { list, getDef, renderToCanvas };
})();

/* =========================================================================
   SECTION: ThemeRegistry
   All visual themes as data. Textures are generated procedurally on an
   offscreen canvas (no bundled binary texture assets) so the renderer can
   redraw them deterministically at any resolution for preview vs export.
   ========================================================================= */
const ThemeRegistry = (() => {
  const THEMES = [
    {
      id: "midnight-obsidian",
      name: "Midnight Obsidian",
      background: { top: "#0b0a10", bottom: "#020103", texture: "marble", textureTint: "#2a2635", vignette: 0.55 },
      palette: { primary: "#f3dfa8", secondary: "#c9b28a", text: "#f7f2e9", mutedText: "#b9b2c2", foil: "gold" },
      centerpiece: { style: "bokeh", colors: ["#3a3450", "#1c1826", "#0a0810"] },
      typographyDefaults: { pairingId: "cinzel-source-sans", mood: "regal", recipientSize: 78, greetingSize: 28 },
      foilPresetId: "gold",
    },
    {
      id: "imperial-emerald",
      name: "Imperial Emerald",
      background: { top: "#0c1a14", bottom: "#04120b", texture: "velvet", textureTint: "#0f2b1d", vignette: 0.5 },
      palette: { primary: "#bfe8d1", secondary: "#e8c777", text: "#f3f7f2", mutedText: "#a9c7b6", foil: "emerald" },
      centerpiece: { style: "bokeh", colors: ["#1c4632", "#0d2a1c", "#04120b"] },
      typographyDefaults: { pairingId: "playfair-montserrat", mood: "editorial", recipientSize: 76, greetingSize: 28 },
      foilPresetId: "emerald",
    },
    {
      id: "royal-burgundy",
      name: "Royal Burgundy",
      background: { top: "#210a10", bottom: "#0d0306", texture: "velvet", textureTint: "#3a0f18", vignette: 0.55 },
      palette: { primary: "#f0c9cf", secondary: "#e8c777", text: "#f7ecec", mutedText: "#cfa8ae", foil: "burgundy" },
      centerpiece: { style: "bokeh", colors: ["#5a1826", "#2d0a12", "#0d0306"] },
      typographyDefaults: { pairingId: "baskerville-manrope", mood: "romantic", recipientSize: 74, greetingSize: 28 },
      foilPresetId: "burgundy",
    },
    {
      id: "pearl-marble",
      name: "Pearl Marble",
      background: {
        top: "#fbf7ed", bottom: "#dfd0b4", texture: "marble", textureTint: "#f2e8d6",
        veinColor: "#9f7a42", veinAlpha: 0.2, vignette: 0.14, light: true,
      },
      palette: { primary: "#6c431d", secondary: "#9a6b26", text: "#21170f", mutedText: "#5c422c", foil: "gold" },
      centerpiece: { style: "gradient-frame", colors: ["#fffaf0", "#e5d3af", "#b78a49"] },
      typographyDefaults: { pairingId: "cormorant-inter", mood: "classic", recipientSize: 76, greetingSize: 28 },
      foilPresetId: "gold",
    },
    {
      id: "velvet-sapphire",
      name: "Velvet Sapphire",
      background: { top: "#0a1024", bottom: "#03050f", texture: "velvet", textureTint: "#14225a", vignette: 0.55 },
      palette: { primary: "#cfe0ff", secondary: "#e8c777", text: "#f0f4ff", mutedText: "#aab8dd", foil: "platinum" },
      centerpiece: { style: "bokeh", colors: ["#1c2c66", "#0d1636", "#03050f"] },
      typographyDefaults: { pairingId: "dmserif-worksans", mood: "modern-luxury", recipientSize: 78, greetingSize: 28 },
      foilPresetId: "platinum",
    },
    {
      id: "amber-tuscan",
      name: "Amber Tuscan",
      background: { top: "#2a1608", bottom: "#150a03", texture: "paper", textureTint: "#4a2c10", vignette: 0.5 },
      palette: { primary: "#f0c988", secondary: "#e8c777", text: "#f7ecd8", mutedText: "#d3b48a", foil: "gold" },
      centerpiece: { style: "bokeh", colors: ["#5c3416", "#2e1a0b", "#150a03"] },
      typographyDefaults: { pairingId: "cormorant-inter", mood: "classic", recipientSize: 76, greetingSize: 28 },
      foilPresetId: "gold",
    },
  ];

  function getTheme(id) { return THEMES.find((t) => t.id === id) || THEMES[0]; }
  function list() { return THEMES; }

  return { list, getTheme };
})();

/* =========================================================================
   SECTION: ThemePreferences
   Local, non-card preferences for retaining familiar themes. These never
   change a CardProject, backup, export, or another device's library.
   ========================================================================= */
const ThemePreferences = (() => {
  const SETTINGS_KEY = "theme-preferences";
  let favouriteIds = new Set();

  async function init() {
    try {
      const record = await DB.get("settings", SETTINGS_KEY);
      const knownIds = new Set(ThemeRegistry.list().map((theme) => theme.id));
      favouriteIds = new Set(
        Array.isArray(record && record.favouriteIds)
          ? record.favouriteIds.filter((id) => knownIds.has(id))
          : []
      );
    } catch (err) {
      favouriteIds = new Set();
    }
  }

  function isFavourite(themeId) { return favouriteIds.has(themeId); }

  async function toggle(themeId) {
    const wasFavourite = favouriteIds.has(themeId);
    if (wasFavourite) favouriteIds.delete(themeId);
    else favouriteIds.add(themeId);
    try {
      await DB.put("settings", { key: SETTINGS_KEY, favouriteIds: Array.from(favouriteIds) });
    } catch (err) {
      if (wasFavourite) favouriteIds.add(themeId);
      else favouriteIds.delete(themeId);
      throw err;
    }
    return favouriteIds.has(themeId);
  }

  return { init, isFavourite, toggle };
})();

/* =========================================================================
   SECTION: StateStore
   Owns the canonical CardProject, undo/redo history, autosave scheduling,
   and schema migrations. All mutation flows through `update()`, which
   applies an immutable patch, pushes history, notifies subscribers (which
   trigger a render) and schedules a debounced autosave.
   ========================================================================= */
// Application version. Shown in the header, stamped onto exported
// backups, and kept in step with SW_VERSION in sw.js so a released
// shell and the code inside it always report the same number.
const APP_VERSION = "1.22.0";

const CURRENT_SCHEMA_VERSION = 6;

function localDateISO(timestamp) {
  const date = new Date(Number.isFinite(Number(timestamp)) ? Number(timestamp) : Date.now());
  const pad = (value) => String(value).padStart(2, "0");
  return date.getFullYear() + "-" + pad(date.getMonth() + 1) + "-" + pad(date.getDate());
}

function formatCardDate(value) {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(value || ""));
  if (!match) return "";
  const date = new Date(Number(match[1]), Number(match[2]) - 1, Number(match[3]));
  if (Number.isNaN(date.getTime())) return "";
  return new Intl.DateTimeFormat("en-IN", { day: "numeric", month: "long", year: "numeric" }).format(date);
}

function createDefaultProject(overrides) {
  const now = Date.now();
  const base = {
    id: Utils.uuid(),
    version: CURRENT_SCHEMA_VERSION,
    title: "Untitled Card",
    createdAt: now,
    updatedAt: now,
    cardDate: { value: localDateISO(now), visible: true },
    occasion: {
      id: "birthday",
      subOccasion: null,
      contentByOccasion: {
        birthday: { greeting: "", autoGreetingEnabled: false, emotion: "heartfelt", messageMode: "manual", relationship: "" },
        condolence: { greeting: "", autoGreetingEnabled: false, emotion: "heartfelt", messageMode: "manual", relationship: "" },
      },
      stampsByOccasion: {},
    },
    recipient: { name: "", relationship: "" },
    sender: { name: "" },
    content: { greeting: "", autoGreetingEnabled: false, emotion: "heartfelt", messageMode: "manual", relationship: "" },
    theme: { id: "midnight-obsidian" },
    photo: null,
    layout: {
      photoScale: 1,
      textPosition: 0.62,
      textMaxWidth: 0.8,
      // Layout-balance controls: centrepiece diameter in canvas px and a
      // vertical and horizontal nudge (px) applied to the whole text block.
      centerpieceSize: 620,
      textShift: 0,
      textShiftX: 0,
      centerpieceId: "auto",
      photoShape: "circle",
    },
    typography: {
      pairingId: "cinzel-source-sans",
      mood: "regal",
      recipientSize: 78,
      greetingSize: 28,
      senderSize: 36,
      letterSpacing: 1.4,
      lineHeight: 1.3,
    },
    foil: { presetId: "gold", mode: "foil", intensity: 70, grain: 35, highlight: 60, shadow: 50 },
    stamps: [],
    audio: null,
  };
  return Object.assign(base, overrides || {});
}

/* =========================================================================
   SECTION: OccasionRegistry
   Canonical registry of supported occasions, allowed emotions/tones,
   default centerpiece associations, and sensitivity metadata.
   ========================================================================= */
const OccasionRegistry = (() => {
  const PERSONAL_EMOTIONS = [
    { id: "heartfelt", label: "Heartfelt", hint: "Sincere and warm" },
    { id: "poetic", label: "Poetic", hint: "Lyrical and expressive" },
    { id: "professional", label: "Professional", hint: "Warm but workplace-safe" },
    { id: "playful", label: "Playful", hint: "Light and cheerful" },
  ];
  const FESTIVAL_OCCASIONS = [
    ["diwali", "Diwali", "Warm wishes for the festival of lights", "diwali-diyas"],
    ["dhanteras-lakshmi-puja", "Dhanteras / Lakshmi Puja", "Auspicious wishes for prosperity", "diwali-diyas"],
    ["bestu-varas", "Bestu Varas / Gujarati New Year", "Fresh beginnings for the Gujarati New Year", "diwali-diyas"],
    ["uttarayan", "Uttarayan / Makar Sankranti", "Bright skies and joyful kites", "theme-aura"],
    ["navratri", "Navratri", "Nine nights of devotion and celebration", "theme-aura"],
    ["holi", "Holi / Dhuleti", "A colourful celebration of togetherness", "theme-aura"],
    ["raksha-bandhan", "Raksha Bandhan", "A celebration of sibling love", "theme-aura"],
    ["janmashtami", "Janmashtami", "Joyful blessings of Shri Krishna", "theme-aura"],
    ["rath-yatra", "Rath Yatra", "Blessings for the sacred journey", "theme-aura"],
    ["ganesh-chaturthi", "Ganesh Chaturthi", "Blessings for wisdom and new beginnings", "theme-aura"],
    ["shivratri", "Mahashivratri", "A serene night of devotion", "theme-aura"],
    ["dussehra", "Dussehra", "A celebration of courage and goodness", "theme-aura"],
    ["independence-day", "Independence Day", "Pride in our freedom and unity", "theme-aura"],
    ["republic-day", "Republic Day", "Honouring India’s democratic spirit", "theme-aura"],
    ["eid-ul-fitr", "Eid ul-Fitr", "Warm wishes of peace and gratitude", "theme-aura"],
    ["christmas", "Christmas", "Peace, joy and warm Christmas wishes", "theme-aura"],
    ["new-year", "New Year", "Bright wishes for the year ahead", "theme-aura"],
    ["ram-navami", "Ram Navami", "Blessings of courage, peace and righteousness", "theme-aura"],
    ["holika-dahan", "Holika Dahan", "A sacred evening of light and renewal", "theme-aura"],
    ["hanuman-jayanti", "Hanuman Jayanti", "Blessings of strength, devotion and courage", "theme-aura"],
    ["guru-purnima", "Guru Purnima", "Gratitude for teachers and guiding wisdom", "theme-aura"],
    ["bhai-dooj", "Bhai Dooj", "A warm celebration of sibling care", "theme-aura"],
  ].map(([id, label, hint, centerpieceId]) => ({
    id, label, hint, category: "festival", isFestival: true, isSensitive: false, allowPhoto: false,
    allowedCenterpieces: ["auto", centerpieceId, "theme-aura"],
    defaultCenterpieceMap: { heartfelt: centerpieceId, poetic: centerpieceId, professional: centerpieceId, playful: centerpieceId },
    fallbackCenterpiece: centerpieceId, emotions: PERSONAL_EMOTIONS,
    recommendedStampIds: ["gold-medallion", "floral-ornament", "celestial-ornament"],
  }));
  const OCCASIONS = [
    {
      id: "birthday",
      label: "Birthday",
      hint: "Celebratory birthday greetings",
      isSensitive: false,
      allowPhoto: true,
      allowedCenterpieces: ["auto", "birthday-floral-cake", "belgian-gold-cake", "velvet-roses", "silk-gift-box", "champagne-gala", "theme-aura"],
      emotions: [
        { id: "heartfelt", label: "Heartfelt", hint: "Sincere and tender" },
        { id: "poetic", label: "Poetic", hint: "Lyrical and image-rich" },
        { id: "professional", label: "Professional", hint: "Warm but workplace-safe" },
        { id: "playful", label: "Playful", hint: "Light, teasing, fun" },
        { id: "milestone", label: "Milestone", hint: "For the big ones" },
      ],
      defaultCenterpieceMap: {
        heartfelt: "birthday-floral-cake",
        poetic: "birthday-floral-cake",
        professional: "birthday-floral-cake",
        playful: "birthday-floral-cake",
        milestone: "birthday-floral-cake",
      },
      fallbackCenterpiece: "birthday-floral-cake",
      recommendedStampIds: ["happy-birthday", "ribbon-badge", "celebrating-you"],
    },
    {
      id: "anniversary", label: "Anniversary", hint: "Warm wishes for a shared journey",
      isSensitive: false, allowPhoto: true, allowedCenterpieces: ["auto", "anniversary-floral-cake", "velvet-roses", "silk-gift-box", "champagne-gala", "theme-aura"],
      defaultCenterpieceMap: {
        heartfelt: "anniversary-floral-cake",
        poetic: "anniversary-floral-cake",
        professional: "anniversary-floral-cake",
        playful: "anniversary-floral-cake",
      },
      fallbackCenterpiece: "anniversary-floral-cake",
      emotions: PERSONAL_EMOTIONS, recommendedStampIds: ["happy-anniversary", "with-love", "floral-ornament"],
    },
    {
      id: "congratulations", label: "Congratulations", hint: "Celebrate an achievement or good news",
      isSensitive: false, allowPhoto: true, allowedCenterpieces: ["auto", "congratulations-laurel", "silk-gift-box", "champagne-gala", "theme-aura"],
      defaultCenterpieceMap: { heartfelt: "congratulations-laurel", poetic: "congratulations-laurel", professional: "congratulations-laurel", playful: "congratulations-laurel" },
      fallbackCenterpiece: "congratulations-laurel",
      emotions: PERSONAL_EMOTIONS, recommendedStampIds: ["congratulations-badge", "ribbon-badge", "crest"],
    },
    {
      id: "new-baby", label: "New Baby", hint: "Welcome and blessings for a growing family",
      isSensitive: false, allowPhoto: true, allowedCenterpieces: ["auto", "baby-teddy", "newborn-hand-feet", "champagne-gala", "theme-aura"],
      defaultCenterpieceMap: { heartfelt: "baby-teddy", poetic: "baby-teddy", professional: "baby-teddy", playful: "champagne-gala" },
      fallbackCenterpiece: "baby-teddy",
      emotions: PERSONAL_EMOTIONS, recommendedStampIds: ["welcome-baby", "celestial-ornament", "made-for-you"],
    },
    {
      id: "new-home", label: "New Home", hint: "Good wishes for a new beginning at home",
      isSensitive: false, allowPhoto: true, allowedCenterpieces: ["auto", "new-home-welcome", "silk-gift-box", "theme-aura"],
      defaultCenterpieceMap: { heartfelt: "new-home-welcome", poetic: "new-home-welcome", professional: "new-home-welcome", playful: "new-home-welcome" },
      fallbackCenterpiece: "new-home-welcome",
      emotions: PERSONAL_EMOTIONS, recommendedStampIds: ["new-home-badge", "crest", "floral-ornament"],
    },
    {
      id: "graduation", label: "Graduation", hint: "Pride and encouragement for a milestone",
      isSensitive: false, allowPhoto: true, allowedCenterpieces: ["auto", "graduation-diploma", "champagne-gala", "silk-gift-box", "theme-aura"],
      defaultCenterpieceMap: { heartfelt: "graduation-diploma", poetic: "graduation-diploma", professional: "graduation-diploma", playful: "graduation-diploma" },
      fallbackCenterpiece: "graduation-diploma",
      emotions: PERSONAL_EMOTIONS, recommendedStampIds: ["proud-graduate", "ribbon-badge", "gold-medallion"],
    },
    {
      id: "retirement", label: "Retirement", hint: "Warm wishes for a new chapter",
      isSensitive: false, allowPhoto: true, allowedCenterpieces: ["auto", "retirement-compass", "velvet-roses", "silk-gift-box", "theme-aura"],
      defaultCenterpieceMap: { heartfelt: "retirement-compass", poetic: "retirement-compass", professional: "retirement-compass", playful: "retirement-compass" },
      fallbackCenterpiece: "retirement-compass",
      emotions: PERSONAL_EMOTIONS, recommendedStampIds: ["happy-retirement", "gold-medallion", "floral-ornament"],
    },
    {
      id: "get-well", label: "Get Well", hint: "Thoughtful wishes for recovery and good health",
      isSensitive: true, allowPhoto: true, allowedCenterpieces: ["auto", "get-well-comfort", "velvet-roses", "theme-aura"],
      defaultCenterpieceMap: { heartfelt: "get-well-comfort", poetic: "get-well-comfort", professional: "get-well-comfort", playful: "get-well-comfort" },
      fallbackCenterpiece: "get-well-comfort",
      emotions: PERSONAL_EMOTIONS, recommendedStampIds: ["get-well-soon", "floral-ornament", "celestial-ornament"],
    },
    {
      id: "friendship-thanks", label: "Friendship / Thanks", hint: "Appreciation for friendship and kindness",
      isSensitive: false, allowPhoto: true, allowedCenterpieces: ["auto", "thanks-note", "velvet-roses", "silk-gift-box", "theme-aura"],
      defaultCenterpieceMap: { heartfelt: "thanks-note", poetic: "thanks-note", professional: "thanks-note", playful: "thanks-note" },
      fallbackCenterpiece: "thanks-note",
      emotions: PERSONAL_EMOTIONS, recommendedStampIds: ["thank-you-badge", "with-love", "floral-ornament"],
    },
    ...FESTIVAL_OCCASIONS,
    {
      id: "condolence",
      label: "Condolence / Sympathy",
      hint: "Comforting, respectful sympathy messages",
      isSensitive: true,
      allowPhoto: false,
      emotions: [
        { id: "heartfelt", label: "Heartfelt", hint: "Deeply caring and gentle" },
        { id: "comforting", label: "Comforting", hint: "Warmth, peace and solace" },
        { id: "reverent", label: "Reverent", hint: "Honoring their memory" },
        { id: "professional", label: "Professional", hint: "Dignified and respectful" },
      ],
      recommendedStampIds: [],
    },
  ];

  const CONDOLENCE_DESIGNS = {
    heartfelt: {
      composition: "centerpiece", centerpieceId: "white-lilies", showCenterpieceSize: true,
      borderStyle: "heartfelt", borderPresetId: "gold", recipientPresetId: "gold", haloColor: "#d4af37",
      geometry: { shape: "circle", centerpieceSize: 620 },
      textLayout: { maxWidthRatio: 0.8, shiftX: 0, shiftY: 0 },
      typography: { pairingId: "cinzel-source-sans", recipientSize: 78, greetingSize: 28, senderSize: 36, letterSpacing: 1.4, lineHeight: 1.3 },
      foil: { mode: "foil", intensity: 85, grain: 35, highlight: 60, shadow: 50 },
      palette: { text: "#2c2621", muted: "#7c6853", signature: "#5a4836" },
      background: {
        top: "#faf7ee", bottom: "#f1e9db", textureKey: "paper-heartfelt",
        textureTint: "rgba(180, 160, 130, 0.12)", textureAlpha: 0.45,
        aura: { y0: 0.32, r0: 80, y1: 0.45, r1: 0.65, stops: [[0, "rgba(255, 250, 240, 0.35)"], [0.5, "rgba(244, 235, 220, 0.18)"], [1, "rgba(235, 222, 205, 0)"]] },
        vignette: { y0: 0.45, r0: 0.3, y1: 0.5, r1: 0.72, stops: [[0, "rgba(180, 150, 110, 0)"], [1, "rgba(160, 135, 100, 0.16)"]] },
      },
      decorations: [{ id: "white-lilies-corner", x: 600, y: 880, size: 1180, rot: 0, alpha: 0.88 }],
    },
    comforting: {
      composition: "text-led", centerpieceId: null, showCenterpieceSize: false,
      borderStyle: "comforting", borderPresetId: "condolence-sage", recipientPresetId: "condolence-sage", haloColor: "#7b927e",
      geometry: { shape: "circle", centerpieceSize: 620 },
      textLayout: { maxWidthRatio: 0.8, shiftX: 0, shiftY: 0, blockTop: 500 },
      typography: { pairingId: "cormorant-inter", recipientSize: 78, greetingSize: 28, senderSize: 36, letterSpacing: 0.2, lineHeight: 1.3 },
      foil: { mode: "foil", intensity: 76, grain: 28, highlight: 54, shadow: 46 },
      palette: { text: "#26362b", muted: "#586b5c", signature: "#3e5043" },
      background: {
        top: "#f4f7f2", bottom: "#e5ece2", textureKey: "paper-comforting",
        textureTint: "rgba(130, 155, 135, 0.12)", textureAlpha: 0.45,
        aura: { y0: 0.4, r0: 80, y1: 0.48, r1: 0.65, stops: [[0, "rgba(235, 245, 235, 0.4)"], [0.6, "rgba(215, 230, 218, 0.15)"], [1, "rgba(200, 218, 204, 0)"]] },
        vignette: { y0: 0.45, r0: 0.3, y1: 0.5, r1: 0.72, stops: [[0, "rgba(130, 150, 135, 0)"], [1, "rgba(110, 135, 115, 0.18)"]] },
      },
      decorations: [
        { id: "sage-foliage-corner", x: 130, y: 245, size: 440, rot: 0, alpha: 0.86 },
        { id: "sage-foliage-corner", x: 1070, y: 1515, size: 400, rot: Math.PI, alpha: 0.84 },
      ],
    },
    reverent: {
      composition: "text-led", centerpieceId: null, showCenterpieceSize: false,
      borderStyle: "reverent", borderPresetId: "condolence-slate", recipientPresetId: "condolence-slate", haloColor: "#71849a",
      geometry: { shape: "circle", centerpieceSize: 620 },
      textLayout: { maxWidthRatio: 0.78, shiftX: 0, shiftY: 0, blockTop: 500 },
      typography: { pairingId: "cinzel-source-sans", recipientSize: 74, greetingSize: 27, senderSize: 34, letterSpacing: 1.2, lineHeight: 1.35 },
      foil: { mode: "foil", intensity: 76, grain: 28, highlight: 54, shadow: 46 },
      palette: { text: "#1b242e", muted: "#526376", signature: "#384758" },
      background: {
        top: "#f0f4f8", bottom: "#e1e8f0", textureKey: "paper-reverent",
        textureTint: "rgba(120, 140, 165, 0.12)", textureAlpha: 0.42,
        aura: { y0: 0.4, r0: 70, y1: 0.48, r1: 0.62, stops: [[0, "rgba(240, 246, 252, 0.45)"], [0.6, "rgba(215, 228, 240, 0.18)"], [1, "rgba(195, 212, 228, 0)"]] },
        vignette: { y0: 0.45, r0: 0.3, y1: 0.5, r1: 0.72, stops: [[0, "rgba(120, 140, 165, 0)"], [1, "rgba(95, 120, 145, 0.18)"]] },
      },
      decorations: [
        { id: "slate-botanical-corner", x: 125, y: 240, size: 400, rot: 0, alpha: 0.82 },
        { id: "slate-botanical-corner", x: 1075, y: 1520, size: 370, rot: Math.PI, alpha: 0.78 },
      ],
    },
    professional: {
      composition: "text-led", centerpieceId: null, showCenterpieceSize: false,
      borderStyle: "professional", borderPresetId: "condolence-navy", recipientPresetId: "condolence-navy", haloColor: "#50647d",
      geometry: { shape: "circle", centerpieceSize: 620 },
      textLayout: { maxWidthRatio: 0.78, shiftX: 0, shiftY: 0, blockTop: 500 },
      typography: { pairingId: "baskerville-manrope", recipientSize: 72, greetingSize: 26, senderSize: 34, letterSpacing: 0.1, lineHeight: 1.4 },
      foil: { mode: "foil", intensity: 76, grain: 28, highlight: 54, shadow: 46 },
      palette: { text: "#172333", muted: "#495b71", signature: "#324254" },
      background: {
        top: "#fbfaf8", bottom: "#f0ede6", textureKey: "paper-professional",
        textureTint: "rgba(140, 140, 140, 0.10)", textureAlpha: 0.4,
        aura: null,
        vignette: { y0: 0.45, r0: 0.35, y1: 0.5, r1: 0.72, stops: [[0, "rgba(140, 140, 140, 0)"], [1, "rgba(110, 115, 125, 0.14)"]] },
      },
      decorations: [
        { id: "navy-botanical-accent", x: 110, y: 225, size: 340, rot: 0, alpha: 0.72 },
        { id: "navy-botanical-accent", x: 1090, y: 1535, size: 300, rot: Math.PI, alpha: 0.62 },
      ],
    },
  };

  function list() { return OCCASIONS; }
  function get(id) { return OCCASIONS.find((o) => o.id === id) || OCCASIONS[0]; }
  function isValid(id) { return OCCASIONS.some((o) => o.id === id); }
  function normalizeOccasion(id) { return isValid(id) ? id : "birthday"; }
  function allowsPhoto(id) { return get(id).allowPhoto !== false; }
  function allowsStamps(id) { return get(id).id !== "condolence"; }
  function getRecommendedStampIds(id) { return (get(id).recommendedStampIds || []).slice(); }
  function getDesign(occasionId, emotion) {
    if (normalizeOccasion(occasionId) !== "condolence") return null;
    return CONDOLENCE_DESIGNS[emotion] || CONDOLENCE_DESIGNS.heartfelt;
  }
  return { list, get, isValid, normalizeOccasion, allowsPhoto, allowsStamps, getRecommendedStampIds, getDesign };
})();

/* =========================================================================
   SECTION: FestivalDesignRegistry
   Festival art remains local to the app. Personalisation lives in the
   shared card model; selecting a festival design only changes presentation.
   ========================================================================= */
const FestivalDesignRegistry = (() => {
  const sources = {
    diwali: "assets/festival-designs/diwali-01.png",
    "dhanteras-lakshmi-puja": "assets/festival-designs/dhanteras-lakshmi-puja-02-lakshmiji.png",
    "bestu-varas": "assets/festival-designs/bestu-varas-01.png",
    uttarayan: "assets/festival-designs/uttarayan-01.png",
    navratri: "assets/festival-designs/navratri-03-goddess-durga.png",
    holi: "assets/festival-designs/holi-01.png",
    "raksha-bandhan": "assets/festival-designs/raksha-bandhan-01.png",
    janmashtami: "assets/festival-designs/janmashtami-04-lord-krishna.png",
    "rath-yatra": "assets/festival-designs/rath-yatra-04-jagannath.png",
    "ganesh-chaturthi": "assets/festival-designs/ganesh-chaturthi-02-emerald-blessings.png",
    shivratri: "assets/festival-designs/shivratri-03-lord-shiva.png",
    dussehra: "assets/festival-designs/dussehra-01.png",
    "independence-day": "assets/festival-designs/independence-day-01.png",
    "republic-day": "assets/festival-designs/republic-day-01.png",
    "eid-ul-fitr": "assets/festival-designs/eid-ul-fitr-01.png",
    christmas: "assets/festival-designs/christmas-01.png",
    "new-year": "assets/festival-designs/new-year-01.png",
    "ram-navami": "assets/festival-designs/ram-navami-02-lord-rama.png",
    "holika-dahan": "assets/festival-designs/holika-dahan-01.png",
    "hanuman-jayanti": "assets/festival-designs/hanuman-jayanti-01.png",
    "guru-purnima": "assets/festival-designs/guru-purnima-01.png",
    "bhai-dooj": "assets/festival-designs/bhai-dooj-01.png",
  };
  const singleTemplate = new Set(["holika-dahan", "hanuman-jayanti", "guru-purnima", "bhai-dooj"]);
  const styles = [
    { id: "classic", label: "Classic", hint: "Traditional full-art composition", overlay: "warm" },
    { id: "radiant", label: "Radiant", hint: "Brighter message panel", overlay: "light" },
    { id: "midnight", label: "Midnight", hint: "Dramatic, high-contrast finish", overlay: "dark" },
  ];
  const designs = Object.fromEntries(Object.entries(sources).map(([occasionId, asset]) => [
    occasionId,
    (singleTemplate.has(occasionId) ? styles.slice(0, 1) : styles).map((style) => ({
      ...style, id: occasionId + "-" + style.id, asset,
    })),
  ]));
  const imageCache = new Map();
  function list(occasionId) { return (designs[occasionId] || []).map((design) => ({ ...design })); }
  function get(occasionId, designId) {
    const available = designs[occasionId] || [];
    return available.find((design) => design.id === designId) || available[0] || null;
  }
  function isFestival(occasionId) { return Object.prototype.hasOwnProperty.call(designs, occasionId); }
  function resolveImage(design) {
    if (!design || !design.asset) return Promise.resolve(null);
    if (!imageCache.has(design.asset)) {
      imageCache.set(design.asset, Utils.loadImage(design.asset).catch(() => null));
    }
    return imageCache.get(design.asset);
  }
  return { list, get, isFestival, resolveImage };
})();

/* =========================================================================
   SECTION: GreetingGenerator
   Emotion-based one-click message writer. Message pools are partitioned by
   occasion; each emotion owns a pool of templates using the {name} token.
   Sensitive occasions enforce context-appropriate message pools and a
   defensive secondary safety guard against celebratory phrasing.
   ========================================================================= */
const GREETING_MAX_CHARS = 220;

const GreetingGenerator = (() => {
  function buildPersonalPool(label, heartfelt, poetic, professional, playful) {
    return {
      heartfelt: heartfelt.map((text) => text.replaceAll("{occasion}", label)),
      poetic: poetic.map((text) => text.replaceAll("{occasion}", label)),
      professional: professional.map((text) => text.replaceAll("{occasion}", label)),
      playful: playful.map((text) => text.replaceAll("{occasion}", label)),
    };
  }

  const POOLS = {
    birthday: {
      heartfelt: [
        "Happy birthday, {name}. May the year ahead bring you good health, peace of mind, and many happy moments with those you love.",
        "{name}, your kindness and steady support mean more than words can express. Wishing you a birthday filled with affection and happiness.",
        "Warm birthday wishes, {name}. May you always be surrounded by the respect, care, and goodwill you so generously share with others.",
        "{name}, may this birthday begin a year of contentment, good health, and meaningful time with family and friends.",
        "Happy birthday, {name}. You are deeply valued, and I hope the coming year brings you the happiness you truly deserve.",
        "On your birthday, {name}, wishing you strength for every challenge, joy in every success, and warmth in every relationship.",
      ],
      poetic: [
        "May each morning of the coming year bring fresh hope, {name}, and each evening leave your heart peaceful and grateful.",
        "{name}, may your path be bright with purpose, your home warm with affection, and your days rich with beautiful memories.",
        "Like a lamp that quietly brightens every corner, {name}, may your kindness continue to bring comfort and happiness to those around you.",
        "May the year ahead unfold gently for you, {name}, with good health, sincere relationships, and dreams steadily taking shape.",
        "{name}, may every season ahead carry its own happiness and every new beginning lead you towards fulfilment.",
        "On your birthday, {name}, may life offer you calm mornings, hopeful journeys, and countless reasons to feel grateful.",
      ],
      professional: [
        "Wishing you a very happy birthday, {name}. Thank you for the care and excellence you bring to everything you take on.",
        "Happy birthday, {name}. It is a genuine pleasure to work alongside you — here is to a rewarding year ahead.",
        "{name}, warmest wishes on your birthday. Your contribution this year has been valued more than you may realise.",
        "On behalf of all of us, {name} — happy birthday. May the year ahead bring well-earned recognition and every success.",
        "Happy birthday, {name}. Wishing you a year of good health, steady progress and the occasional well-deserved celebration.",
        "Many happy returns, {name}. Thank you for your dedication; may this next year be your most accomplished yet.",
      ],
      playful: [
        "Happy birthday, {name}! May your phone stay busy with warm wishes and your day be full of favourite people and favourite food.",
        "{name}, today everyone has to agree with you—it is your birthday after all! Wishing you a wonderfully cheerful day.",
        "Happy birthday, {name}! May the celebrations be joyful, the food delicious, and the photographs good enough to keep.",
        "{name}, another year wiser—and still young enough to enjoy being the centre of attention today. Happy birthday!",
        "Happy birthday, {name}! May your day bring plenty of laughter, affectionate teasing, and memories worth sharing again.",
        "{name}, wishing you a birthday with fewer responsibilities, more happy surprises, and a generous second serving of dessert.",
      ],
      milestone: [
        "{name}, this milestone birthday honours a life enriched by experience, relationships, and many achievements. Warmest wishes for the years ahead.",
        "Happy milestone birthday, {name}. May you look back with pride and move forward with good health, confidence, and happiness.",
        "{name}, today celebrates not only your age, but also the respect, memories, and affection you have gathered through the years.",
        "Warm congratulations on this special birthday, {name}. May the next chapter bring renewed purpose and many fulfilling moments.",
        "{name}, your journey has touched many lives. Wishing you a milestone birthday filled with appreciation, dignity, and joy.",
        "On this important birthday, {name}, may the years ahead be peaceful, active, and blessed with the company of those who value you most.",
      ],
    },
    anniversary: buildPersonalPool("anniversary", [
      "Wishing you both a beautiful anniversary, {name}. May the years ahead bring continued understanding, laughter, and companionship.",
      "{name}, may this anniversary remind you of the strength and warmth you have built together. Warmest wishes to you both.",
    ], [
      "Two lives, one journey, and many treasured moments, {name}. May your anniversary be filled with gentle joy.",
      "May the story you share, {name}, continue to unfold with patience, friendship, and quiet happiness.",
    ], [
      "Warm anniversary wishes, {name}. May your partnership continue to bring mutual respect, happiness, and strength.",
      "Wishing you both a very happy anniversary, {name}, and many fulfilling years ahead.",
    ], [
      "Happy anniversary, {name}! Wishing you both another wonderful chapter together.",
      "{name}, here is to the teamwork, laughter, and memories that make your journey special. Happy anniversary!",
    ]),
    congratulations: buildPersonalPool("congratulations", [
      "Heartfelt congratulations, {name}. Your achievement reflects your dedication and deserves every bit of appreciation.",
      "{name}, this is wonderful news. May this success open the door to many more fulfilling opportunities.",
    ], [
      "A well-earned moment of pride, {name}. May this new chapter rise brightly from everything you have worked for.",
      "{name}, today your effort has found its answer. May the road ahead be generous and inspiring.",
    ], [
      "Congratulations, {name}. Your achievement is well deserved, and we wish you continued success.",
      "Warm congratulations, {name}, on this important milestone. Your commitment has made a real difference.",
    ], [
      "Congratulations, {name}! You worked for this moment, and now it is time to enjoy it.",
      "Well done, {name}! A fantastic achievement and a very good reason to smile today.",
    ]),
    "new-baby": buildPersonalPool("new baby", [
      "Warm congratulations, {name}, on the arrival of your little one. Wishing your family health, love, and many peaceful moments.",
      "{name}, may your new baby bring your home endless tenderness and happiness. Best wishes to the whole family.",
    ], [
      "A tiny new presence has made your world larger, {name}. May each day bring a beautiful new memory.",
      "{name}, may your family’s newest chapter be filled with soft mornings, loving care, and countless smiles.",
    ], [
      "Congratulations, {name}, on your growing family. Wishing you health, happiness, and a joyful new beginning.",
      "Warm wishes to you and your family, {name}, as you welcome your new baby.",
    ], [
      "Congratulations, {name}! Your family just gained its smallest and most important team member.",
      "Welcome to a new adventure, {name}. Wishing you plenty of smiles and at least a little sleep!",
    ]),
    "new-home": buildPersonalPool("new home", [
      "Congratulations on your new home, {name}. May it be filled with peace, warmth, and happy memories.",
      "{name}, wishing you comfort and contentment as you make your new home truly your own.",
    ], [
      "May every room in your new home gather stories, laughter, and the quiet feeling of belonging, {name}.",
      "A new home is a new beginning, {name}. May yours welcome many beautiful days.",
    ], [
      "Warm congratulations, {name}, on your new home. Wishing you a smooth transition and many happy years there.",
      "Best wishes for your new home, {name}. May it be a place of comfort, connection, and lasting memories.",
    ], [
      "Congratulations, {name}! May your new home have great light, good company, and a reliable internet connection.",
      "New keys, new memories, {name}! Wishing you a wonderful start in your new home.",
    ]),
    graduation: buildPersonalPool("graduation", [
      "Heartfelt congratulations, {name}. Your hard work has brought you to a proud and promising milestone.",
      "{name}, may your graduation be the beginning of a fulfilling journey shaped by courage, learning, and purpose.",
    ], [
      "A new horizon opens before you, {name}. May your knowledge and dreams guide you towards meaningful work and joy.",
      "{name}, every lesson has brought you here. May the next chapter be wide, bright, and entirely your own.",
    ], [
      "Congratulations on your graduation, {name}. We wish you continued growth and success in the years ahead.",
      "Warm congratulations, {name}, on this well-earned achievement. Your discipline and effort are admirable.",
    ], [
      "You did it, {name}! Congratulations on graduating and unlocking your next great adventure.",
      "Congratulations, {name}! Today the cap is yours, and tomorrow the possibilities are too.",
    ]),
    retirement: buildPersonalPool("retirement", [
      "Warm retirement wishes, {name}. May this new chapter bring you good health, peace, and time for everything you enjoy.",
      "{name}, your years of dedication have made a lasting difference. Wishing you a deeply rewarding retirement.",
    ], [
      "May the days ahead move at your own gentle pace, {name}, filled with new places, old joys, and well-earned rest.",
      "A long chapter closes and a spacious one begins, {name}. May retirement bring you freedom and fulfilment.",
    ], [
      "Congratulations on your retirement, {name}. Thank you for your years of valuable contribution, and best wishes for what comes next.",
      "Wishing you a happy retirement, {name}, with good health and many rewarding experiences ahead.",
    ], [
      "Happy retirement, {name}! Your new full-time role is choosing exactly what to do with your time.",
      "Congratulations, {name}! May your calendar now contain more joy and far fewer meetings.",
    ]),
    "get-well": buildPersonalPool("get well", [
      "Thinking of you, {name}, and wishing you steady recovery, renewed strength, and good health each day.",
      "{name}, sending warm wishes and encouragement as you recover. Please take good care and be gentle with yourself.",
    ], [
      "May each new day bring a little more strength and comfort, {name}. We are thinking of you warmly.",
      "{name}, may rest restore you and hopeful moments brighten the path back to good health.",
    ], [
      "Wishing you a smooth recovery, {name}. Please accept our warm thoughts and best wishes for your health.",
      "Get well soon, {name}. We hope you regain your strength steadily and comfortably.",
    ], [
      "Get well soon, {name}! Take the time you need—your only job is to feel better.",
      "Sending you a big dose of good wishes, {name}. We look forward to seeing you back at your best.",
    ]),
    "friendship-thanks": buildPersonalPool("friendship and thanks", [
      "Thank you, {name}, for your kindness and steady friendship. You make life feel warmer and more supported.",
      "{name}, your thoughtfulness has meant more than I can say. I am grateful for you and all the care you share.",
    ], [
      "Some friendships become quiet places of strength, {name}. Thank you for being one of mine.",
      "{name}, kindness leaves a lasting light. Thank you for all the ways you bring that light into my days.",
    ], [
      "Thank you, {name}, for your support and cooperation. Your thoughtfulness is sincerely appreciated.",
      "With sincere thanks, {name}. It is a pleasure to know and work with someone so dependable and considerate.",
    ], [
      "Thank you, {name}! Good friends like you make every ordinary day better.",
      "{name}, friendship points are officially yours in abundance. Thank you for being wonderful!",
    ]),
    diwali: buildPersonalPool("Diwali", [
      "Wishing you and your family a joyful Diwali, {name}. May your home be filled with warmth, peace, and togetherness.",
      "May the lights of Diwali bring hope, happiness, and many cherished moments to your home, {name}.",
    ], [
      "May every diya bring a gentle glow to your days, {name}, and may this Diwali fill your home with warmth and good cheer.",
      "Wishing you a Diwali of golden light, grateful hearts, and beautiful moments with those you hold dear, {name}.",
    ], [
      "Warm Diwali wishes to you and your family, {name}. May the festival bring peace, prosperity, and continued success.",
      "Wishing you a bright and meaningful Diwali, {name}. May the season bring renewed energy and happiness.",
    ], [
      "Happy Diwali, {name}! Wishing you bright diyas, warm family time, and a home full of happy moments.",
      "Wishing you a joyful Diwali, {name}! May the lights be bright and the sweets be plentiful.",
    ]),
    condolence: {
      heartfelt: [
        "{name}, our thoughts and heartfelt sympathies are with you and your family during this time of sorrow. Wishing you strength and solace.",
        "Deeply saddened by your loss, {name}. May you and your family find peace and comfort in the warm memories of a life dearly cherished.",
        "{name}, sharing in your grief and sending sincere condolences to you and your loved ones. We stand with you during this difficult time.",
        "Holding you and your family in our thoughts, {name}. May gentle memories bring comfort to your heart in the quiet moments.",
        "{name}, please know that you are in our thoughts during this sorrowful time. Wishing you peace, resilience, and comfort in the days ahead.",
        "Our sincere condolences to you and your family, {name}. May the love and support of those around you give you strength in your loss.",
      ],
      comforting: [
        "{name}, wishing you quiet moments of solace as you remember a life deeply loved and cherished. May peace be with you and your family.",
        "May the passage of time bring gentle healing to your heart, {name}. Holding you and your family in our quiet and supportive thoughts.",
        "{name}, may fond memories bring a soothing light during these days of sorrow. Wishing you peace and strength as you navigate this loss.",
        "In this quiet time of remembrance, {name}, may the warmth of shared memories bring solace and comfort to you and your loved ones.",
        "{name}, sending comforting thoughts and strength to you and your family. May you find solace in the enduring love they left behind.",
        "May the care and kindness of family and friends bring you comfort during this tender time, {name}. Wishing you peace and gentle solace.",
      ],
      reverent: [
        "{name}, honoring the noble memory of a life lived with dignity, grace, and enduring values. They will always be remembered with profound respect.",
        "A life of purpose and integrity leaves a lasting legacy, {name}. We pay our deepest respects and hold your family in our thoughts.",
        "{name}, paying homage to a remarkable life that touched and guided so many. Their wisdom and virtues will continue to inspire us.",
        "With utmost respect and reverence, we remember a life of noble character and immense kindness, {name}. Our thoughts are with your family.",
        "{name}, their guidance, dignity, and upright life will always be treasured. Honoring their memory with the highest respect and esteem.",
        "Remembering a deeply respected life of honour and kindness, {name}. May their inspiring legacy bring comfort and strength to your family.",
      ],
      professional: [
        "{name}, please accept our sincere condolences on your loss. Wishing you and your family comfort and strength during this difficult time.",
        "On behalf of all of us, {name}, we extend our deepest sympathies to you and your family. Our thoughts are with you during this period.",
        "{name}, we offer our heartfelt condolences to you and your loved ones. Wishing you peace, support, and resilience in the days ahead.",
        "Please accept our sincere condolences, {name}. We stand with you and your family during this time of sorrow and bereavement.",
        "{name}, extending our respectful sympathy to you and your family. May fond memories and the support of colleagues bring you solace.",
        "Our thoughts are with you and your family during this time of loss, {name}. Please accept our sincere condolences and respectful sympathies.",
      ],
    },
  };

  const CONDOLENCE_RELATIONSHIP_POOLS = {
    heartfelt: [
      "{name}, we are deeply sorry for the loss of your {relationship}. Our thoughts are with you and your family, with wishes for strength and solace.",
      "Our heartfelt sympathies are with you, {name}, as you mourn your {relationship}. May cherished memories bring comfort in the days ahead.",
    ],
    comforting: [
      "{name}, may loving memories of your {relationship} bring gentle comfort to you and your family during this difficult time.",
      "As you remember your {relationship}, {name}, may the care of family and friends bring you strength, peace, and solace.",
    ],
    reverent: [
      "With deep respect, we remember your {relationship}, {name}. May their dignity, kindness, and lasting contribution always be treasured.",
      "{name}, we honour the memory of your {relationship} with profound respect. Their guidance and values will continue to be remembered.",
    ],
    professional: [
      "{name}, please accept our sincere condolences on the loss of your {relationship}. Our thoughts are with you and your family.",
      "On behalf of all of us, {name}, we extend our respectful sympathies on the loss of your {relationship}. Wishing your family strength and support.",
    ],
  };

  const BIRTHDAY_RELATIONSHIP_CONTEXTS = {
    elder: {
      appreciation: "Your wisdom, affection, and steady presence are deeply valued by the whole family",
      wish: "May the coming year bring you good health, peace, and the happiness of seeing your loved ones prosper",
      poetic: "May the respect and affection you have earned return to you in countless quiet ways",
      playful: "Today the family rule is simple: your wishes come first",
    },
    parent: {
      appreciation: "Your love, guidance, and sacrifices have shaped our lives in more ways than words can express",
      wish: "May the coming year bring you good health, peace of mind, and many proud family moments",
      poetic: "Your care has been the light that makes every road feel safer and every home feel warmer",
      playful: "Today you are officially excused from reminding everyone what still needs to be done",
    },
    spouse: {
      appreciation: "Your companionship, understanding, and care make everyday life more meaningful",
      wish: "May we share many more years of good health, laughter, and beautiful memories together",
      poetic: "With you beside me, ordinary days become treasured memories and every season feels like home",
      playful: "You remain my favourite person to plan with, laugh with, and occasionally disagree with",
    },
    sibling: {
      appreciation: "The memories, laughter, and support we share make our bond truly special",
      wish: "May the year ahead bring you success, good health, and plenty of reasons for us to celebrate together",
      poetic: "Across every change in life, our shared memories remain a familiar and lasting thread",
      playful: "You may be older today, but I still reserve the right to remind you of every childhood story",
    },
    child: {
      appreciation: "Watching you grow into the person you are today fills us with happiness and pride",
      wish: "May you always have the courage to follow your goals and the wisdom to choose what brings lasting happiness",
      poetic: "May your dreams find strong wings, your choices find clear direction, and your heart remain kind",
      playful: "You keep growing wiser, more capable, and somehow even better at negotiating birthday treats",
    },
    teacher: {
      appreciation: "Your patience, guidance, and example have made a lasting difference in many lives",
      wish: "May the coming year bring you good health, fulfilment, and the respect your work deserves",
      poetic: "The lessons you share continue to guide others long after the classroom grows quiet",
      playful: "For today, there are no assignments—only warm wishes and well-earned appreciation",
    },
    friend: {
      appreciation: "Your friendship, honesty, and support make both happy days and difficult ones easier to share",
      wish: "May the coming year bring you good health, meaningful success, and many memorable times together",
      poetic: "True friendship turns ordinary days into stories that remain bright for years",
      playful: "Your birthday gives us another excellent reason to meet, laugh, and repeat our favourite old stories",
    },
    professional: {
      appreciation: "Your dedication, reliability, and thoughtful way of working are sincerely appreciated",
      wish: "May the coming year bring you good health, continued progress, and well-earned success",
      poetic: "May steady effort open new doors and every achievement lead to a rewarding new opportunity",
      playful: "May your birthday bring fewer meetings, lighter responsibilities, and plenty of warm wishes from the team",
    },
  };

  // Each line uses exactly one context field (never two concatenated) so
  // that, combined with the longest name the recipient field allows (40
  // characters), every combination stays comfortably under
  // GREETING_MAX_CHARS. Verified: worst case across all 8 relationships x
  // 5 tones x a 40-character name is 187 characters. fill() below still
  // applies a defensive cap for any future template that reintroduces this.
  function buildBirthdayRelationshipPool(context) {
    return {
      heartfelt: [
        "Happy birthday, {name}. " + context.appreciation + ".",
        "Warm birthday wishes, {name}. " + context.wish + ".",
      ],
      poetic: [
        "{name}, " + context.poetic + ". May the year ahead be peaceful, purposeful, and full of warmth.",
        context.poetic + ", {name}. May each new beginning bring hope and each success bring quiet satisfaction.",
      ],
      professional: [
        "Warm birthday wishes, {name}. " + context.appreciation + ".",
        "Happy birthday, {name}. " + context.wish + ".",
      ],
      playful: [
        "Happy birthday, {name}! " + context.playful + ".",
        context.playful + ", {name}! Wishing you a cheerful and memorable day.",
      ],
      milestone: [
        "Happy milestone birthday, {name}. " + context.appreciation + ".",
        "{name}, this special birthday honours the memories you have gathered. " + context.wish + ".",
      ],
    };
  }

  const BIRTHDAY_RELATIONSHIP_POOLS = Object.fromEntries(
    Object.entries(BIRTHDAY_RELATIONSHIP_CONTEXTS).map(([id, context]) => [id, buildBirthdayRelationshipPool(context)])
  );

  const ANNIVERSARY_RELATIONSHIP_CONTEXTS = {
    spouse: {
      occasionLead: "On our anniversary",
      appreciation: "Sharing life with you has brought love, understanding, and meaning to every season",
      wish: "May we continue to grow together with good health, laughter, and many cherished memories",
      poetic: "With you beside me, each chapter feels warmer and every ordinary day becomes part of our story",
      playful: "We still make a wonderful team, including when we have very different plans",
    },
    parents: {
      occasionLead: "On your anniversary",
      appreciation: "The love, patience, and values you share remain a beautiful example for the whole family",
      wish: "May you both enjoy many more years of good health, companionship, and happy family moments",
      poetic: "The home and memories you have built together continue to shelter generations with love",
      playful: "You both continue to prove that patience, partnership, and a little humour make a strong team",
    },
    family: {
      occasionLead: "On your anniversary",
      appreciation: "The warmth and companionship you share bring happiness to everyone who knows you",
      wish: "May the years ahead bring you both good health, understanding, and many joyful memories",
      poetic: "May the story you share keep unfolding with friendship, patience, and quiet happiness",
      playful: "You both make partnership look joyful, dependable, and full of stories worth retelling",
    },
    professional: {
      occasionLead: "On your anniversary",
      appreciation: "The mutual respect and steady partnership you share are sincerely admired",
      wish: "May the years ahead bring you both continued happiness, good health, and fulfilment",
      poetic: "May every year strengthen the respect, trust, and companionship at the heart of your journey",
      playful: "Wishing you both another year of excellent teamwork and many reasons to celebrate together",
    },
  };

  function buildAnniversaryRelationshipPool(context) {
    return {
      heartfelt: [
        "Happy anniversary, {name}. " + context.appreciation + ".",
        "Warm anniversary wishes, {name}. " + context.wish + ".",
      ],
      poetic: [
        context.poetic + ", {name}. Wishing you a beautiful anniversary.",
        context.occasionLead + ", {name}, " + context.poetic.toLowerCase() + ".",
      ],
      professional: [
        "Warm anniversary wishes, {name}. " + context.appreciation + ".",
        "Wishing you a very happy anniversary, {name}. " + context.wish + ".",
      ],
      playful: [
        "Happy anniversary, {name}! " + context.playful + ".",
        context.playful + ", {name}! Wishing you a cheerful anniversary.",
      ],
    };
  }

  const ANNIVERSARY_RELATIONSHIP_POOLS = Object.fromEntries(
    Object.entries(ANNIVERSARY_RELATIONSHIP_CONTEXTS).map(([id, context]) => [id, buildAnniversaryRelationshipPool(context)])
  );

  const FESTIVAL_GREETINGS = {
    "dhanteras-lakshmi-puja": ["Dhanteras and Lakshmi Puja", "May this auspicious season bring prosperity, peace, and a home filled with blessings"],
    "bestu-varas": ["Bestu Varas", "May the Gujarati New Year open with health, goodwill, and bright new beginnings"],
    uttarayan: ["Uttarayan", "May your days rise as high and bright as the kites in a joyful January sky"],
    navratri: ["Navratri", "May these nine nights bring devotion, energy, and beautiful moments with loved ones"],
    holi: ["Holi", "May this festival of colours fill your days with friendship, laughter, and fresh hope"],
    "raksha-bandhan": ["Raksha Bandhan", "May the bond of care and trust between siblings grow stronger with every year"],
    janmashtami: ["Janmashtami", "May the music, joy, and blessings of Janmashtami fill your home with peace"],
    "rath-yatra": ["Rath Yatra", "May this sacred journey bring grace, togetherness, and blessings to your family"],
    "ganesh-chaturthi": ["Ganesh Chaturthi", "May Lord Ganesha bless every new beginning with wisdom, grace, and success"],
    shivratri: ["Mahashivratri", "May this sacred night bring inner peace, strength, and the blessings of Lord Shiva"],
    dussehra: ["Dussehra", "May the spirit of courage and goodness guide every step ahead"],
    "independence-day": ["Independence Day", "May our shared freedom and unity continue to inspire hope and purpose"],
    "republic-day": ["Republic Day", "May India’s democratic spirit fill us with pride, unity, and responsibility"],
    "eid-ul-fitr": ["Eid ul-Fitr", "May Eid bring peace, gratitude, and warm moments shared with family and friends"],
    christmas: ["Christmas", "May Christmas bring peace, kindness, and a home full of warm light"],
    "new-year": ["New Year", "May the year ahead bring renewed hope, good health, and many joyful beginnings"],
    "ram-navami": ["Ram Navami", "May the blessings of Ram Navami bring courage, peace, and righteousness to your home"],
    "holika-dahan": ["Holika Dahan", "May the sacred fire of Holika Dahan bring renewed hope, harmony, and light to your home"],
    "hanuman-jayanti": ["Hanuman Jayanti", "May Lord Hanuman bless you with strength, devotion, and courage in every step ahead"],
    "guru-purnima": ["Guru Purnima", "May the wisdom and guidance of your teachers continue to light your path"],
    "bhai-dooj": ["Bhai Dooj", "May the bond of affection and care between siblings grow stronger with every year"],
  };
  Object.entries(FESTIVAL_GREETINGS).forEach(([id, [label, wish]]) => {
    POOLS[id] = buildPersonalPool(label,
      [`{name}, ${wish}. Warm wishes to you and your family.`],
      [`{name}, ${wish}. May every day ahead carry a gentle, hopeful light.`],
      [`Warm ${label} wishes, {name}. ${wish}.`],
      [`Happy ${label}, {name}! ${wish}.`]
    );
  });

  // Old schema (v1) tone ids mapped onto the five supported birthday emotions.
  const LEGACY_EMOTION_MAP = {
    warm: "heartfelt",
    joyful: "playful",
    elegant: "poetic",
    playful: "playful",
    romantic: "heartfelt",
  };

  // Occasion-specific output guards are a secondary defense to the scoped
  // message pools. They preserve edited text, but keep unmistakably wrong
  // occasion wording out of previews, exports, shares, and digital packages.
  const OUTPUT_SAFETY_RULES = {
    condolence: {
      patterns: [
        /\b(happy|birthday|celebrat(e|ion|ing|es|ory)|cake|candles?|balloons?|champagne|congratulat(e|ion|ions|ing|ory)|cheers|party|milestone|happy to hear|many happy returns)\b/i,
        /\bwish(?:ing)?\b[^.!?]{0,80}\bjoy\b[^.!?]{0,80}\bspecial day\b/i,
        /\bwonderful day\b[^.!?]{0,80}\b(?:sweets?|gifts?)\b/i,
      ],
      warning: "Celebratory wording is not allowed on a Condolence card. Your text is preserved, but it will not appear in preview or export until corrected.",
      outputError: "Correct the celebratory wording before exporting or sharing this Condolence card.",
    },
    "get-well": {
      patterns: [
        /\b(?:birthday|anniversary|diwali|christmas|holi|navratri|raksha bandhan|janmashtami|eid(?:\s+ul-fitr)?|dussehra)\b/i,
        /\bhappy\s+new year\b/i,
        /\b(?:wedding|marriage|many happy returns|cake|candles?|balloons?|champagne|party)\b/i,
      ],
      warning: "Wording for another occasion is not allowed on a Get Well card. Your text is preserved, but it will not appear in preview or export until corrected.",
      outputError: "Correct the cross-occasion wording before exporting or sharing this Get Well card.",
    },
  };

  function getSafetyRule(occasionId) {
    const occ = OccasionRegistry.get(occasionId);
    return occ.isSensitive ? OUTPUT_SAFETY_RULES[occ.id] || null : null;
  }

  function validateSafety(occasionId, text) {
    const rule = getSafetyRule(occasionId);
    return !rule || !rule.patterns.some((pattern) => pattern.test(text || ""));
  }

  function list(occasionId) {
    const occ = OccasionRegistry.get(occasionId || "birthday");
    if (occ.id === "condolence") return [];
    return occ.emotions;
  }

  function isValid(id, occasionId) {
    const occ = OccasionRegistry.get(occasionId || "birthday");
    const pool = POOLS[occ.id];
    return !!(pool && Object.prototype.hasOwnProperty.call(pool, id));
  }

  function normalizeEmotion(id, occasionId) {
    const occ = OccasionRegistry.get(occasionId || "birthday");
    if (isValid(id, occ.id)) return id;
    if (occ.id === "birthday" && LEGACY_EMOTION_MAP[id]) return LEGACY_EMOTION_MAP[id];
    return (occ.emotions[0] && occ.emotions[0].id) || "heartfelt";
  }

  function normalizeRelationship(relationship) {
    const input = Utils.sanitizeText(relationship || "", 40).trim();
    const value = input.toLowerCase();
    const aliases = [
      [/\b(father|dad|papa|pitaji)\b/, "father"],
      [/\b(mother|mom|mum|mama|mataji)\b/, "mother"],
      [/\b(grandfather|granddad|grandpa|dada|nana)\b/, "grandfather"],
      [/\b(grandmother|grandma|dadi|nani)\b/, "grandmother"],
      [/\b(grandparent)\b/, "grandparent"],
      [/\b(husband|spouse)\b/, "spouse"],
      [/\b(partner)\b/, "partner"],
      [/\b(wife)\b/, "wife"],
      [/\b(brother)\b/, "brother"],
      [/\b(sister)\b/, "sister"],
      [/\b(son)\b/, "son"],
      [/\b(daughter)\b/, "daughter"],
      [/\b(friend)\b/, "friend"],
      [/\b(uncle)\b/, "uncle"],
      [/\b(aunt)\b/, "aunt"],
      [/\b(cousin)\b/, "cousin"],
      [/\b(neighbour|neighbor)\b/, "neighbour"],
      [/\b(manager)\b/, "manager"],
      [/\b(relative)\b/, "relative"],
      [/\b(family friend)\b/, "family friend"],
      [/\b(colleague|coworker|co-worker)\b/, "colleague"],
      [/\b(teacher)\b/, "teacher"],
      [/\b(mentor)\b/, "mentor"],
    ];
    const match = aliases.find(([pattern]) => pattern.test(value));
    // Keep the field itself untouched. An unrecognised but safe custom
    // relationship is used as entered (lower-cased for sentence grammar)
    // rather than erased or mapped to a sensitive inferred relationship.
    return match ? match[1] : value.replace(/^(?:my|our|the)\s+/i, "");
  }

  function classifyBirthdayRelationship(relationship) {
    const value = normalizeRelationship(relationship);
    if (["grandfather", "grandmother", "grandparent", "uncle", "aunt"].includes(value)) return "elder";
    if (["father", "mother"].includes(value)) return "parent";
    if (["spouse", "partner", "wife"].includes(value)) return "spouse";
    if (["brother", "sister", "cousin"].includes(value)) return "sibling";
    if (["son", "daughter"].includes(value)) return "child";
    if (["teacher", "mentor"].includes(value)) return "teacher";
    if (["friend", "family friend", "neighbour"].includes(value)) return "friend";
    if (["manager", "colleague"].includes(value)) return "professional";
    return "";
  }

  function classifyAnniversaryRelationship(relationship) {
    const value = normalizeRelationship(relationship);
    if (["spouse", "partner", "wife"].includes(value)) return "spouse";
    if (["father", "mother", "parent", "parents", "grandfather", "grandmother", "grandparent", "grandparents"].includes(value)) return "parents";
    if (["brother", "sister", "son", "daughter", "uncle", "aunt", "cousin", "friend", "family friend", "neighbour", "relative"].includes(value)) return "family";
    if (["manager", "colleague", "teacher", "mentor"].includes(value)) return "professional";
    return "";
  }

  function fill(template, name, relationship) {
    const who = String(name || "").trim() || "friend";
    const filled = template
      .split("{name}").join(who)
      .split("{relationship}").join(relationship || "loved one");
    // Defensive cap: every template above is authored to stay under
    // GREETING_MAX_CHARS even at the recipient-name field's 40-character
    // maximum, but name/relationship substitution is the one place length
    // is not fully known until fill time, and this guards any future
    // template (any occasion) that reintroduces an overflow — word-safe,
    // ellipsized, never a mid-word cut.
    return filled.length > GREETING_MAX_CHARS ? Utils.truncateProse(filled, GREETING_MAX_CHARS) : filled;
  }

  // Returns a draft for `emotion` under `occasionId`, avoiding `previousText`
  // when the pool offers an alternative.
  function generate(emotion, name, previousText, occasionId, relationship) {
    const occ = OccasionRegistry.get(occasionId || "birthday");
    const normEmotion = normalizeEmotion(emotion, occ.id);
    const relationshipLabel = occ.id === "condolence" ? normalizeRelationship(relationship) : "";
    const birthdayRelationship = occ.id === "birthday" ? classifyBirthdayRelationship(relationship) : "";
    const anniversaryRelationship = occ.id === "anniversary" ? classifyAnniversaryRelationship(relationship) : "";
    const pool = relationshipLabel
      ? CONDOLENCE_RELATIONSHIP_POOLS[normEmotion]
      : birthdayRelationship
        ? BIRTHDAY_RELATIONSHIP_POOLS[birthdayRelationship][normEmotion]
        : anniversaryRelationship
          ? ANNIVERSARY_RELATIONSHIP_POOLS[anniversaryRelationship][normEmotion]
        : ((POOLS[occ.id] && POOLS[occ.id][normEmotion]) || POOLS.birthday.heartfelt);
    const candidates = pool.map((t) => fill(t, name, relationshipLabel));
    const fresh = candidates.filter((c) => c !== previousText);
    const from = fresh.length ? fresh : candidates;
    let selected = from[Math.floor(Math.random() * from.length)];
    if (!validateSafety(occ.id, selected)) {
      selected = fill(pool[0], name, relationshipLabel);
    }
    return selected;
  }

  // Deterministic first draft, used by the "auto-write greeting" toggle so
  // the rendered card does not change text on every repaint.
  function fallbackFor(emotion, name, occasionId, relationship) {
    const occ = OccasionRegistry.get(occasionId || "birthday");
    const normEmotion = normalizeEmotion(emotion, occ.id);
    const relationshipLabel = occ.id === "condolence" ? normalizeRelationship(relationship) : "";
    const birthdayRelationship = occ.id === "birthday" ? classifyBirthdayRelationship(relationship) : "";
    const anniversaryRelationship = occ.id === "anniversary" ? classifyAnniversaryRelationship(relationship) : "";
    const pool = relationshipLabel
      ? CONDOLENCE_RELATIONSHIP_POOLS[normEmotion]
      : birthdayRelationship
        ? BIRTHDAY_RELATIONSHIP_POOLS[birthdayRelationship][normEmotion]
        : anniversaryRelationship
          ? ANNIVERSARY_RELATIONSHIP_POOLS[anniversaryRelationship][normEmotion]
        : ((POOLS[occ.id] && POOLS[occ.id][normEmotion]) || POOLS.birthday.heartfelt);
    return fill(pool[0], name, relationshipLabel);
  }

  function resolveProjectGreeting(project) {
    const occasionId = (project.occasion && project.occasion.id) || "birthday";
    return project.content.autoGreetingEnabled
      ? fallbackFor(project.content.emotion, project.recipient.name, occasionId, project.recipient.relationship)
      : (project.content.greeting || "");
  }

  function validateProjectGreeting(project) {
    const occasionId = (project.occasion && project.occasion.id) || "birthday";
    const text = resolveProjectGreeting(project);
    const safe = validateSafety(occasionId, text);
    const rule = safe ? null : getSafetyRule(occasionId);
    return {
      safe,
      text,
      occasionId,
      warning: rule ? rule.warning : "",
      outputError: rule ? rule.outputError : "",
    };
  }

  return {
    list, generate, fallbackFor, normalizeEmotion, isValid, validateSafety,
    normalizeRelationship, classifyBirthdayRelationship, classifyAnniversaryRelationship, resolveProjectGreeting, validateProjectGreeting,
  };
})();

function createOccasionContent(occasionId, relationship) {
  return {
    greeting: "",
    autoGreetingEnabled: false,
    emotion: GreetingGenerator.normalizeEmotion("heartfelt", occasionId),
    messageMode: "manual",
    relationship: String(relationship || ""),
    festivalDesignId: FestivalDesignRegistry.isFestival(occasionId)
      ? ((FestivalDesignRegistry.get(occasionId) || {}).id || "")
      : "",
  };
}

function snapshotOccasionContent(content, occasionId, relationship) {
  const source = content || {};
  return {
    greeting: String(source.greeting || ""),
    autoGreetingEnabled: !!source.autoGreetingEnabled,
    emotion: GreetingGenerator.normalizeEmotion(source.emotion, occasionId),
    messageMode: ["auto", "generated", "edited", "manual"].includes(source.messageMode)
      ? source.messageMode
      : (source.autoGreetingEnabled ? "auto" : "manual"),
    relationship: Object.prototype.hasOwnProperty.call(source, "relationship")
      ? String(source.relationship || "")
      : String(relationship || ""),
    festivalDesignId: FestivalDesignRegistry.isFestival(occasionId)
      ? (FestivalDesignRegistry.get(occasionId, source.festivalDesignId) || {}).id || ""
      : "",
  };
}

function ensureOccasionContentStates(project) {
  project.occasion = project.occasion && typeof project.occasion === "object"
    ? project.occasion
    : { id: "birthday", subOccasion: null };
  const activeId = OccasionRegistry.normalizeOccasion(project.occasion.id);
  project.occasion.id = activeId;
  const states = project.occasion.contentByOccasion && typeof project.occasion.contentByOccasion === "object"
    ? project.occasion.contentByOccasion
    : {};
  const activeRelationship = String((project.recipient && project.recipient.relationship) || "");
  OccasionRegistry.list().forEach((occasion) => {
    const id = occasion.id;
    states[id] = states[id]
      ? snapshotOccasionContent(states[id], id, id === activeId ? activeRelationship : "")
      : createOccasionContent(id, id === activeId ? activeRelationship : "");
  });
  project.content = snapshotOccasionContent(project.content, activeId, activeRelationship);
  states[activeId] = snapshotOccasionContent(project.content, activeId, activeRelationship);
  project.occasion.contentByOccasion = states;
  project.occasion.subOccasion = states[activeId].festivalDesignId || null;
  return states;
}

function cloneStamps(stamps) {
  return Array.isArray(stamps) ? stamps.map((stamp) => ({ ...stamp })) : [];
}

function createRecommendedOccasionStamps(occasionId) {
  if (!OccasionRegistry.allowsStamps(occasionId)) return [];
  const recommended = OccasionRegistry.getRecommendedStampIds(occasionId);
  return recommended.slice(0, 2).map((assetId, index) => {
    const def = StampCollections.getDef(assetId);
    return {
      id: Utils.uuid(),
      assetId,
      x: index === 0 ? 0.5 : 0.16,
      y: index === 0 ? 0.12 : 0.17,
      scale: index === 0 ? 0.78 : 0.52,
      rotation: 0,
      opacity: index === 0 ? 0.92 : 0.78,
      layer: def.defaultLayer || "foreground",
    };
  });
}

function ensureOccasionStampStates(project) {
  project.occasion = project.occasion && typeof project.occasion === "object"
    ? project.occasion
    : { id: "birthday", subOccasion: null };
  const activeId = OccasionRegistry.normalizeOccasion(project.occasion.id);
  const hasStateObject = project.occasion.stampsByOccasion
    && typeof project.occasion.stampsByOccasion === "object";
  const states = hasStateObject ? project.occasion.stampsByOccasion : {};
  const hadStates = hasStateObject && Object.keys(states).length > 0;
  const legacyStamps = cloneStamps(project.stamps);

  if (!hadStates && legacyStamps.length) {
    const legacyOccasionId = activeId === "condolence" ? "birthday" : activeId;
    states[legacyOccasionId] = legacyStamps;
  }

  OccasionRegistry.list().forEach((occasion) => {
    if (!Object.prototype.hasOwnProperty.call(states, occasion.id)) {
      states[occasion.id] = createRecommendedOccasionStamps(occasion.id);
    } else {
      states[occasion.id] = cloneStamps(states[occasion.id]).slice(0, 40);
    }
  });

  if (activeId !== "condolence") {
    if (hadStates) states[activeId] = cloneStamps(project.stamps);
    project.stamps = cloneStamps(states[activeId]);
  }
  project.occasion.stampsByOccasion = states;
  return states;
}

function switchProjectOccasion(project, targetOccasionId) {
  const targetId = OccasionRegistry.normalizeOccasion(targetOccasionId);
  const currentId = OccasionRegistry.normalizeOccasion(project.occasion && project.occasion.id);
  const states = ensureOccasionContentStates(project);
  const stampStates = ensureOccasionStampStates(project);
  states[currentId] = snapshotOccasionContent(project.content, currentId, project.recipient.relationship);
  if (currentId !== "condolence") {
    stampStates[currentId] = cloneStamps(project.stamps);
  }
  project.occasion.id = targetId;
  project.occasion.subOccasion = states[targetId].festivalDesignId || null;
  project.content = snapshotOccasionContent(states[targetId], targetId, "");
  project.recipient.relationship = project.content.relationship;
  if (targetId !== "condolence") {
    project.stamps = cloneStamps(stampStates[targetId]);
  }
}

const StateStore = (() => {
  let project = null;
  let history = [];
  let historyIndex = -1;
  const MAX_HISTORY = 50;
  const listeners = new Set();
  const historyListeners = new Set();
  let suppressHistory = false;

  function subscribe(fn) { listeners.add(fn); return () => listeners.delete(fn); }
  function subscribeHistory(fn) { historyListeners.add(fn); return () => historyListeners.delete(fn); }

  function notify(reason) {
    listeners.forEach((fn) => fn(project, reason));
  }
  function notifyHistory() {
    historyListeners.forEach((fn) => fn({ canUndo: historyIndex > 0, canRedo: historyIndex < history.length - 1 }));
  }

  function pushHistory() {
    if (suppressHistory) return;
    const snapshot = Utils.clone(project);
    history = history.slice(0, historyIndex + 1);
    history.push(snapshot);
    if (history.length > MAX_HISTORY) history.shift();
    historyIndex = history.length - 1;
    notifyHistory();
  }

  function init(newProject) {
    project = newProject;
    history = [Utils.clone(project)];
    historyIndex = 0;
    notify("init");
    notifyHistory();
  }

  function getProject() { return project; }

  // Immutable patch: `patcher` receives a clone and mutates it directly,
  // which keeps call sites readable while still guaranteeing the store
  // never shares references with the previous snapshot in history.
  function update(patcher, opts) {
    opts = opts || {};
    const next = Utils.clone(project);
    patcher(next);
    next.updatedAt = Date.now();
    project = next;
    if (!opts.skipHistory) pushHistory();
    notify(opts.reason || "update");
    if (!opts.skipAutosave) scheduleAutosave();
  }

  function undo() {
    if (historyIndex <= 0) return;
    historyIndex--;
    suppressHistory = true;
    project = Utils.clone(history[historyIndex]);
    suppressHistory = false;
    notify("undo");
    notifyHistory();
    scheduleAutosave();
  }

  function redo() {
    if (historyIndex >= history.length - 1) return;
    historyIndex++;
    suppressHistory = true;
    project = Utils.clone(history[historyIndex]);
    suppressHistory = false;
    notify("redo");
    notifyHistory();
    scheduleAutosave();
  }

  function canUndo() { return historyIndex > 0; }
  function canRedo() { return historyIndex < history.length - 1; }

  let autosaveFn = null;
  function setAutosaveHandler(fn) { autosaveFn = fn; }
  const scheduleAutosave = Utils.debounce(() => {
    if (autosaveFn) autosaveFn(project);
  }, 700);
  function flushAutosave() { scheduleAutosave.flush(); if (autosaveFn) autosaveFn(project); }

  // Apply a theme switch: replace only theme-owned fields (theme id, foil
  // preset, typography defaults when the user has not customized them) and
  // preserve everything the user authored — names, greeting, photo
  // transforms, and manually placed stamps.
  function applyTheme(themeId, opts) {
    opts = opts || {};
    const theme = ThemeRegistry.getTheme(themeId);
    update((p) => {
      const isFirstThemeChoice = !p.theme.id || p.theme.id === themeId;
      p.theme = { id: theme.id };
      p.foil.presetId = theme.foilPresetId;
      if (opts.restoreDefaults || (isFirstThemeChoice && !p.typography.userCustomized)) {
        p.typography.pairingId = theme.typographyDefaults.pairingId;
        p.typography.mood = theme.typographyDefaults.mood;
        p.typography.recipientSize = theme.typographyDefaults.recipientSize;
        p.typography.greetingSize = theme.typographyDefaults.greetingSize;
      }
    }, { reason: "theme-change" });
  }

  function markTypographyCustomized() {
    update((p) => { p.typography.userCustomized = true; }, { skipHistory: true, skipAutosave: true, reason: "silent" });
  }

  return {
    init, getProject, update, undo, redo, canUndo, canRedo,
    subscribe, subscribeHistory, setAutosaveHandler, scheduleAutosave, flushAutosave,
    applyTheme, markTypographyCustomized,
  };
})();

/* =========================================================================
   SECTION: Migrations
   Versioned upgrade path for CardProject records read from IndexedDB or an
   imported backup. Never mutates a project it cannot confidently upgrade;
   unsupported future versions are rejected without modification.
   ========================================================================= */
const Migrations = (() => {
  function migrate(record) {
    if (!record || typeof record !== "object") throw new Error("Invalid project record.");
    let v = record.version || 0;
    if (v > CURRENT_SCHEMA_VERSION) {
      throw new Error("This card was saved by a newer version of the studio and cannot be opened here.");
    }
    // v1 -> v2: the five-tone `content.emotion` vocabulary was replaced by
    // the five generator emotions, and the layout-balance fields were added.
    // Both are additive/remappable, so a v1 card upgrades losslessly.
    if (v < 2) {
      record.content = record.content || {};
      record.content.emotion = GreetingGenerator.normalizeEmotion(record.content.emotion, "birthday");
      record.layout = Object.assign(
        { photoScale: 1, textPosition: 0.62, textMaxWidth: 0.8 },
        record.layout || {},
        {
          centerpieceSize: (record.layout && record.layout.centerpieceSize) || 620,
          textShift: (record.layout && record.layout.textShift) || 0,
          textShiftX: (record.layout && record.layout.textShiftX) || 0,
          centerpieceId: (record.layout && record.layout.centerpieceId) || "auto",
          photoShape: (record.layout && record.layout.photoShape) || "circle",
        }
      );
      if (record.photo) {
        if (record.photo.panX == null) record.photo.panX = 0;
        if (record.photo.panY == null) record.photo.panY = 0;
        if (record.photo.rotation == null) record.photo.rotation = 0;
      }
      v = 2;
    }

    if (!record.occasion || typeof record.occasion !== "object") {
      record.occasion = { id: "birthday", subOccasion: null };
    } else {
      record.occasion.id = OccasionRegistry.normalizeOccasion(record.occasion.id);
      if (!("subOccasion" in record.occasion)) {
        record.occasion.subOccasion = null;
      }
    }
    record.content = record.content || {};
    record.content.emotion = GreetingGenerator.normalizeEmotion(record.content.emotion, record.occasion.id);
    ensureOccasionContentStates(record);
    ensureOccasionStampStates(record);

    if (record.layout && record.layout.textShiftX == null) {
      record.layout.textShiftX = 0;
    }

    // v2 -> v3: Condolence is a render-time, no-photo design mode. Existing
    // Birthday photo, centerpiece/layout and stamp state remains stored and
    // is suppressed rather than rewritten while Condolence is active.
    if (v < 3) {
      v = 3;
    }
    // v3 -> v4: each occasion keeps its own editable stamp collection.
    // Legacy global stamps are retained for the active personal occasion,
    // or Birthday when a saved Condolence card was suppressing them.
    if (v < 4) {
      v = 4;
    }
    // v4 -> v5: add an editable card date without changing the appearance
    // of existing saved cards until the owner explicitly enables it.
    if (v < 5) {
      record.cardDate = { value: localDateISO(record.createdAt || Date.now()), visible: false };
      v = 5;
    }
    // v5 -> v6: each festival stores its selected visual treatment inside
    // its already isolated occasion content. Existing cards receive the
    // default festival treatment only when a festival is selected.
    if (v < 6) {
      ensureOccasionContentStates(record);
      v = 6;
    }
    if (!record.cardDate || typeof record.cardDate !== "object") {
      record.cardDate = { value: localDateISO(record.createdAt || Date.now()), visible: false };
    }
    if (!/^\d{4}-\d{2}-\d{2}$/.test(String(record.cardDate.value || ""))) {
      record.cardDate.value = localDateISO(record.createdAt || Date.now());
    }
    record.cardDate.visible = !!record.cardDate.visible;
    record.version = v;
    record.typography = record.typography || {};
    // Older cards used a fixed 22px signature — there was no slider to set
    // it any other way, so any stored value below the new slider's floor
    // (24) is unmistakably that legacy footnote-sized default, never a
    // deliberate user choice. Those get lifted all the way to the new
    // sensible default (36px) rather than merely clamped to 24, which
    // would barely be perceptible and would defeat the point of the fix.
    // A value already inside the new 24-64 range came from the new slider
    // and is a deliberate user choice, so it is left alone (clamp is a
    // no-op there, kept only as a safety net against a corrupt value).
    const storedSenderSize = Number(record.typography.senderSize);
    record.typography.senderSize = (Number.isFinite(storedSenderSize) && storedSenderSize >= 24)
      ? Utils.clamp(storedSenderSize, 24, 64)
      : 36;
    return record;
  }

  async function recordMigration(fromVersion, toVersion) {
    await DB.put("schema-migrations", { version: toVersion, fromVersion, migratedAt: Date.now() });
  }

  return { migrate, recordMigration };
})();

/* =========================================================================
   SECTION: LayoutEngine (typography measurement + safe zones + collisions)
   ========================================================================= */
const LayoutEngine = (() => {
  const CANVAS_W = 1200;
  const CANVAS_H = 1760;
  const SAFE_MARGIN = { x: 84, top: 90, bottom: 90 };

  function supportsCanvasLetterSpacing() {
    try {
      const c = document.createElement("canvas").getContext("2d");
      c.letterSpacing = "1px";
      return c.letterSpacing === "1px";
    } catch (err) { return false; }
  }
  const NATIVE_LETTER_SPACING = supportsCanvasLetterSpacing();

  function measureTextWidth(ctx, text, letterSpacing) {
    if (!text) return 0;
    const base = ctx.measureText(text).width;
    if (NATIVE_LETTER_SPACING) return base; // ctx.letterSpacing already applied by caller
    return base + Math.max(0, text.length - 1) * letterSpacing;
  }

  function setFont(ctx, family, weight, size) {
    ctx.font = (weight ? weight + " " : "") + size + "px " + family;
  }

  function applyLetterSpacing(ctx, letterSpacing) {
    if (NATIVE_LETTER_SPACING) ctx.letterSpacing = letterSpacing + "px";
  }

  // Wrap `text` (may contain explicit \n breaks) to `maxWidth`, measured
  // with the font currently set on `ctx`. Greedy word wrap; never splits a
  // single unbreakable word (it is allowed to overflow that one line's
  // width rather than mangling the word).
  function wrapText(ctx, text, maxWidth, letterSpacing) {
    const paragraphs = String(text || "").split(/\n/);
    const lines = [];
    paragraphs.forEach((para) => {
      const words = para.split(/\s+/).filter(Boolean);
      if (words.length === 0) { lines.push(""); return; }
      let current = words[0];
      for (let i = 1; i < words.length; i++) {
        const candidate = current + " " + words[i];
        if (measureTextWidth(ctx, candidate, letterSpacing) <= maxWidth) {
          current = candidate;
        } else {
          lines.push(current);
          current = words[i];
        }
      }
      lines.push(current);
    });
    return lines;
  }

  function measureWrappedText(ctx, opts) {
    setFont(ctx, opts.fontFamily, opts.weight, opts.size);
    applyLetterSpacing(ctx, opts.letterSpacing);
    const lines = wrapText(ctx, opts.text, opts.maxWidth, opts.letterSpacing);
    const lineWidths = lines.map((l) => measureTextWidth(ctx, l, opts.letterSpacing));
    const maxLineWidth = lineWidths.length ? Math.max(...lineWidths) : 0;
    const overflow = (opts.maxLines != null && lines.length > opts.maxLines) || maxLineWidth > opts.maxWidth + 0.5;
    return { lines, lineWidths, maxLineWidth, overflow };
  }

  // Reduce font size first, then letter spacing, to fit `text` within
  // maxWidth x maxLines. Reports overflow rather than silently clipping —
  // callers (renderer) draw whatever the final attempt produced even if it
  // still slightly overflows, and surface the diagnostic to the UI.
  function fitText(ctx, opts) {
    const {
      text, fontFamily, weight, maxSize, minSize, maxWidth, maxLines,
      lineHeightRatio, letterSpacingStart,
    } = opts;

    let best = null;
    for (let size = maxSize; size >= minSize; size -= 1) {
      const result = measureWrappedText(ctx, {
        text, fontFamily, weight, size, maxWidth, maxLines, letterSpacing: letterSpacingStart,
      });
      best = { size, letterSpacing: letterSpacingStart, ...result };
      if (!result.overflow) return { ...best, overflow: false };
    }
    // Still overflowing at minSize: reduce letter spacing toward 0.
    for (let sp = letterSpacingStart; sp >= 0; sp -= 0.2) {
      const result = measureWrappedText(ctx, {
        text, fontFamily, weight, size: minSize, maxWidth, maxLines, letterSpacing: sp,
      });
      best = { size: minSize, letterSpacing: sp, ...result };
      if (!result.overflow) return { ...best, overflow: false };
    }

    // Last resort: clamp. Downscaling alone could not make the copy fit, so
    // drop the overflowing lines and ellipsize the final kept line. This is
    // what guarantees text can never bleed past the card's borders — the
    // renderer draws exactly the lines returned here.
    return clampResult(ctx, best, {
      fontFamily, weight, maxWidth, maxLines, letterSpacing: best.letterSpacing,
    });
  }

  // Trim `line` (adding an ellipsis) until it measures within maxWidth.
  function ellipsizeToWidth(ctx, line, maxWidth, letterSpacing) {
    const ELLIPSIS = "…";
    if (measureTextWidth(ctx, line, letterSpacing) <= maxWidth) return line;
    let trimmed = line;
    while (trimmed.length > 1) {
      trimmed = trimmed.slice(0, -1);
      const candidate = trimmed.replace(/[\s,;:.—-]+$/, "") + ELLIPSIS;
      if (measureTextWidth(ctx, candidate, letterSpacing) <= maxWidth) return candidate;
    }
    return ELLIPSIS;
  }

  // Reduce `result.lines` to at most maxLines and force every kept line
  // inside maxWidth. Reports `clamped` so the UI can tell the user their
  // message was shortened rather than silently losing words.
  function clampResult(ctx, result, opts) {
    setFont(ctx, opts.fontFamily, opts.weight, result.size);
    applyLetterSpacing(ctx, opts.letterSpacing);

    let lines = result.lines.slice();
    let clamped = false;

    if (opts.maxLines != null && lines.length > opts.maxLines) {
      const kept = lines.slice(0, Math.max(1, opts.maxLines));
      const lastIndex = kept.length - 1;
      kept[lastIndex] = ellipsizeToWidth(
        ctx, kept[lastIndex].replace(/[\s.,;:]+$/, "") + "…", opts.maxWidth, opts.letterSpacing
      );
      lines = kept;
      clamped = true;
    }

    lines = lines.map((line) => {
      const fitted = ellipsizeToWidth(ctx, line, opts.maxWidth, opts.letterSpacing);
      if (fitted !== line) clamped = true;
      return fitted;
    });

    const lineWidths = lines.map((l) => measureTextWidth(ctx, l, opts.letterSpacing));
    return {
      size: result.size,
      letterSpacing: opts.letterSpacing,
      lines,
      lineWidths,
      maxLineWidth: lineWidths.length ? Math.max(...lineWidths) : 0,
      overflow: false,
      clamped,
    };
  }

  // Draws pre-wrapped lines centered horizontally at cx, top-aligned at
  // startY, honoring manual letter-spacing when the browser lacks native
  // ctx.letterSpacing support.
  function drawLines(ctx, lines, opts) {
    setFont(ctx, opts.fontFamily, opts.weight, opts.size);
    applyLetterSpacing(ctx, opts.letterSpacing);
    ctx.textAlign = NATIVE_LETTER_SPACING ? "center" : "left";
    ctx.textBaseline = "alphabetic";
    const lineHeightPx = opts.size * opts.lineHeight;
    lines.forEach((line, i) => {
      const y = opts.startY + i * lineHeightPx;
      if (NATIVE_LETTER_SPACING) {
        ctx.fillText(line, opts.cx, y);
      } else {
        const width = measureTextWidth(ctx, line, opts.letterSpacing);
        let x = opts.cx - width / 2;
        for (const ch of line) {
          ctx.fillText(ch, x, y);
          x += ctx.measureText(ch).width + opts.letterSpacing;
        }
      }
    });
    return lines.length * lineHeightPx;
  }

  function getSafeZone() {
    return {
      x: SAFE_MARGIN.x,
      y: SAFE_MARGIN.top,
      width: CANVAS_W - SAFE_MARGIN.x * 2,
      height: CANVAS_H - SAFE_MARGIN.top - SAFE_MARGIN.bottom,
    };
  }

  function boxesOverlap(a, b, buffer) {
    buffer = buffer || 0;
    return !(
      a.x + a.width + buffer <= b.x ||
      b.x + b.width + buffer <= a.x ||
      a.y + a.height + buffer <= b.y ||
      b.y + b.height + buffer <= a.y
    );
  }

  function detectCollisions(boxes, buffer) {
    const collisions = [];
    for (let i = 0; i < boxes.length; i++) {
      for (let j = i + 1; j < boxes.length; j++) {
        if (boxesOverlap(boxes[i], boxes[j], buffer)) {
          collisions.push({ a: boxes[i].id, b: boxes[j].id });
        }
      }
    }
    return collisions;
  }

  function isOutsideSafeZone(box, safeZone) {
    return (
      box.x < safeZone.x ||
      box.y < safeZone.y ||
      box.x + box.width > safeZone.x + safeZone.width ||
      box.y + box.height > safeZone.y + safeZone.height
    );
  }

  // Greedy auto-arrange: for each movable (stamp) box, in ascending
  // priority order (lowest priority moved/scaled first per spec), search a
  // grid of candidate centers within the safe zone and pick the first that
  // avoids collision with every higher-priority box plus already-placed
  // movable boxes. Falls back to the least-bad (fewest overlaps) position.
  function autoArrange(fixedBoxes, movableBoxes, buffer) {
    const safeZone = getSafeZone();
    const placed = fixedBoxes.slice();
    const sorted = movableBoxes.slice().sort((a, b) => a.priority - b.priority);
    const resolved = [];
    const violations = [];

    sorted.forEach((box) => {
      const gridSteps = 10;
      let bestPos = null;
      let bestOverlapCount = Infinity;
      for (let gy = 0; gy <= gridSteps; gy++) {
        for (let gx = 0; gx <= gridSteps; gx++) {
          const x = safeZone.x + (gx / gridSteps) * (safeZone.width - box.width);
          const y = safeZone.y + (gy / gridSteps) * (safeZone.height - box.height);
          const candidate = { ...box, x, y };
          const overlaps = placed.filter((p) => boxesOverlap(candidate, p, buffer)).length;
          if (overlaps < bestOverlapCount) {
            bestOverlapCount = overlaps;
            bestPos = candidate;
            if (overlaps === 0) break;
          }
        }
        if (bestOverlapCount === 0) break;
      }
      const finalBox = bestPos || box;
      if (bestOverlapCount > 0) violations.push(finalBox.id);
      placed.push(finalBox);
      resolved.push(finalBox);
    });

    return { resolved, violations };
  }

  function getMaxTextShiftX(textMaxWidth) {
    const ratio = Utils.clamp(Number(textMaxWidth) || 0.8, 0.55, 0.95);
    const safeWidth = CANVAS_W - SAFE_MARGIN.x * 2;
    const textWidth = safeWidth * ratio;
    const availableSlack = Math.max(0, (safeWidth - textWidth) / 2);
    return Math.min(120, Math.floor(availableSlack));
  }

  return {
    CANVAS_W, CANVAS_H, SAFE_MARGIN, NATIVE_LETTER_SPACING,
    measureTextWidth, wrapText, measureWrappedText, fitText, drawLines,
    ellipsizeToWidth, clampResult, getMaxTextShiftX,
    getSafeZone, boxesOverlap, detectCollisions, isOutsideSafeZone, autoArrange,
  };
})();

/* =========================================================================
   SECTION: CenterpieceAssetResolver
   Optional photographic centrepieces. If a transparent PNG/WebP exists at
   assets/centerpieces/<id>.{webp,png} for a supported named
   centrepieces, Centerpieces.paint() draws it instead of the procedural
   painter below. Ships safely with zero files present: every probe
   failure (404, decode error) is cached as "no asset" so the procedural
   fallback in Centerpieces takes over exactly as before. No remote URLs
   are ever requested — this only ever looks at the local /assets folder.
   ========================================================================= */
const CenterpieceAssetResolver = (() => {
  // WebP is the compact primary format; PNG remains a local compatibility
  // fallback so a failed WebP decode never removes established artwork.
  const EXTENSIONS = ["webp", "png"];
  const ASSET_DIRS = {
    "belgian-gold-cake": "assets/centerpieces/", "velvet-roses": "assets/centerpieces/",
    "silk-gift-box": "assets/centerpieces/", "champagne-gala": "assets/centerpieces/",
    "baby-teddy": "assets/centerpieces/", "newborn-hand-feet": "assets/centerpieces/",
    "birthday-floral-cake": "assets/centerpieces/", "anniversary-floral-cake": "assets/centerpieces/",
    "congratulations-laurel": "assets/centerpieces/", "new-home-welcome": "assets/centerpieces/",
    "graduation-diploma": "assets/centerpieces/", "retirement-compass": "assets/centerpieces/",
    "get-well-comfort": "assets/centerpieces/", "thanks-note": "assets/centerpieces/",
    "diwali-diyas": "assets/centerpieces/",
    "white-lilies": "assets/centerpieces/", "white-lilies-corner": "assets/decorations/",
    "sage-foliage-corner": "assets/decorations/", "slate-botanical-corner": "assets/decorations/",
    "navy-botanical-accent": "assets/decorations/",
  };
  const SUPPORTED_IDS = Object.keys(ASSET_DIRS);
  const cache = new Map(); // id -> Promise<HTMLImageElement|null>

  async function probeOne(id) {
    const dir = ASSET_DIRS[id];
    for (const ext of EXTENSIONS) {
      try {
        return await Utils.loadImage(dir + id + "." + ext);
      } catch (err) {
        // Try the next format; if neither exists this resolves to null below.
      }
    }
    return null;
  }

  function resolve(id) {
    if (!SUPPORTED_IDS.includes(id)) return Promise.resolve(null);
    if (!cache.has(id)) cache.set(id, probeOne(id));
    return cache.get(id);
  }

  function isSupported(id) { return SUPPORTED_IDS.includes(id); }

  return { resolve, isSupported, SUPPORTED_IDS };
})();

/* =========================================================================
   SECTION: Centerpieces
   Centrepiece painters, used whenever a card has no user photo. Each named
   centrepiece first tries a real photographic asset via
   CenterpieceAssetResolver; when none is bundled it falls back to the
   procedural painters below — layered gradients, bezier geometry, specular
   highlights and a seeded grain pass, drawn on an offscreen canvas so each
   one renders identically at preview and export resolution with no
   network request. Painters are authored against a reference radius of
   300px and scaled by `u`, so they stay sharp at any centrepiece size. The
   caller has already clipped the art region.
   ========================================================================= */
const Centerpieces = (() => {
  const LIST = [
    { id: "auto", label: "Auto", hint: "Matches the greeting emotion" },
    { id: "belgian-gold-cake", label: "Belgian Gold Cake", hint: "Ganache, gold leaf, candlelight" },
    { id: "white-lilies", label: "White Lilies", hint: "Graceful white lilies tribute" },
    { id: "velvet-roses", label: "Velvet Roses", hint: "Deep crimson bloom cluster" },
    { id: "silk-gift-box", label: "Silk Gift Box", hint: "Satin ribbon and hand-tied bow" },
    // Keep the historic id so existing backups automatically receive the
    // replacement artwork instead of becoming incompatible.
    { id: "champagne-gala", label: "Luxury Balloons", hint: "Pearl, emerald and gold celebration balloons" },
    { id: "baby-teddy", label: "Baby Teddy Bear", hint: "A gentle teddy-bear welcome" },
    { id: "newborn-hand-feet", label: "Newborn Hands and Feet", hint: "Hands cradling tiny feet" },
    { id: "birthday-floral-cake", label: "Birthday Floral Cake", hint: "Blush florals, lace icing and birthday lettering" },
    { id: "anniversary-floral-cake", label: "Anniversary Floral Cake", hint: "Romantic florals, rings and anniversary lettering" },
    { id: "congratulations-laurel", label: "Congratulations Laurel", hint: "Gold laurel and achievement ribbon" },
    { id: "new-home-welcome", label: "New Home Welcome", hint: "A warmly lit home and welcome lamp" },
    { id: "graduation-diploma", label: "Graduation Diploma", hint: "Mortarboard, diploma and laurel" },
    { id: "retirement-compass", label: "Retirement Compass", hint: "Compass, book and a new chapter" },
    { id: "get-well-comfort", label: "Get Well Comfort", hint: "Herbal tea, gentle flowers and care" },
    { id: "thanks-note", label: "Friendship and Thanks", hint: "A personal note of appreciation" },
    { id: "diwali-diyas", label: "Diwali Diyas", hint: "Brass lamps and fresh marigolds" },
    { id: "theme-aura", label: "Theme Aura", hint: "Abstract monogram glow" },
  ];

  /* ---------------- small drawing helpers ---------------- */
  function mulberry32(seed) {
    return function () {
      seed |= 0; seed = (seed + 0x6D2B79F5) | 0;
      let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  function lin(ctx, x0, y0, x1, y1, stops) {
    const g = ctx.createLinearGradient(x0, y0, x1, y1);
    stops.forEach((s) => g.addColorStop(s[0], s[1]));
    return g;
  }

  function rad(ctx, x0, y0, r0, x1, y1, r1, stops) {
    const g = ctx.createRadialGradient(x0, y0, r0, x1, y1, r1);
    stops.forEach((s) => g.addColorStop(s[0], s[1]));
    return g;
  }

  function withAlpha(hex, a) {
    const h = String(hex || "#000").replace("#", "");
    const n = h.length === 3 ? h.split("").map((c) => c + c).join("") : h;
    const r = parseInt(n.slice(0, 2), 16) || 0;
    const g = parseInt(n.slice(2, 4), 16) || 0;
    const b = parseInt(n.slice(4, 6), 16) || 0;
    return "rgba(" + r + "," + g + "," + b + "," + a + ")";
  }

  function quad(ctx, pts) {
    ctx.beginPath();
    ctx.moveTo(pts[0][0], pts[0][1]);
    for (let i = 1; i < pts.length; i++) ctx.lineTo(pts[i][0], pts[i][1]);
    ctx.closePath();
  }

  const grainTiles = new Map();
  function grainTile(size, seed) {
    const key = size + ":" + seed;
    if (grainTiles.has(key)) return grainTiles.get(key);
    const c = document.createElement("canvas");
    c.width = size; c.height = size;
    const g = c.getContext("2d");
    const rand = mulberry32(seed);
    const d = g.createImageData(size, size);
    for (let i = 0; i < d.data.length; i += 4) {
      const v = 110 + Math.floor(rand() * 70);
      d.data[i] = v; d.data[i + 1] = v; d.data[i + 2] = v; d.data[i + 3] = 255;
    }
    g.putImageData(d, 0, 0);
    grainTiles.set(key, c);
    return c;
  }

  // Film-grain pass: what stops these reading as flat vector art.
  function grain(ctx, box, alpha, seed) {
    try {
      const tile = grainTile(96, seed || 7);
      ctx.save();
      ctx.globalAlpha = alpha;
      ctx.globalCompositeOperation = "overlay";
      ctx.fillStyle = ctx.createPattern(tile, "repeat");
      ctx.fillRect(box.cx - box.r, box.cy - box.r, box.r * 2, box.r * 2);
      ctx.restore();
    } catch (err) { /* pattern unsupported: skip the grain pass */ }
  }

  function backdrop(ctx, box, stops, focusY) {
    const { cx, cy, r } = box;
    ctx.fillStyle = rad(ctx, cx, cy + (focusY || 0), r * 0.05, cx, cy, r * 1.18, stops);
    ctx.fillRect(cx - r, cy - r, r * 2, r * 2);
  }

  // Out-of-focus light orbs. Radial falloff rather than a blur filter so
  // the result is identical on canvas implementations without ctx.filter.
  function bokeh(ctx, box, colors, seed, count, spread) {
    const rand = mulberry32(seed);
    for (let i = 0; i < count; i++) {
      const a = rand() * Math.PI * 2;
      const d = (0.25 + rand() * 0.75) * box.r * (spread || 1);
      const x = box.cx + Math.cos(a) * d;
      const y = box.cy + Math.sin(a) * d * 0.92;
      const rr = box.r * (0.05 + rand() * 0.15);
      const c = colors[i % colors.length];
      ctx.save();
      ctx.globalAlpha = 0.08 + rand() * 0.2;
      ctx.fillStyle = rad(ctx, x, y, 0, x, y, rr, [
        [0, withAlpha(c, 0.95)], [0.55, withAlpha(c, 0.45)], [1, withAlpha(c, 0)],
      ]);
      ctx.beginPath();
      ctx.arc(x, y, rr, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }
  }

  function specular(ctx, x, y, rr, alpha, tint) {
    ctx.save();
    ctx.globalAlpha = alpha;
    ctx.fillStyle = rad(ctx, x, y, 0, x, y, rr, [
      [0, tint || "rgba(255,255,255,0.95)"],
      [0.4, "rgba(255,255,255,0.35)"],
      [1, "rgba(255,255,255,0)"],
    ]);
    ctx.beginPath();
    ctx.arc(x, y, rr, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }

  function contactShadow(ctx, x, y, rx, ry, alpha) {
    ctx.save();
    ctx.globalAlpha = alpha == null ? 0.55 : alpha;
    ctx.fillStyle = rad(ctx, x, y, 0, x, y, rx, [
      [0, "rgba(0,0,0,0.85)"], [0.6, "rgba(0,0,0,0.35)"], [1, "rgba(0,0,0,0)"],
    ]);
    ctx.save();
    ctx.translate(x, y);
    ctx.scale(1, ry / rx);
    ctx.beginPath();
    ctx.arc(0, 0, rx, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
    ctx.restore();
  }

  /* ---------------- 1. Belgian gold cake ---------------- */
  function paintCake(ctx, box) {
    const { cx, cy, r } = box;
    const u = r / 300;
    const hw = 168 * u;
    const glazeY = cy - 44 * u;
    const botY = cy + 168 * u;

    backdrop(ctx, box, [
      [0, "#5a3a18"], [0.4, "#2d1a08"], [0.75, "#1a0e03"], [1, "#0d0601"],
    ], -r * 0.22);
    bokeh(ctx, box, ["#ffd489", "#ff9f4a", "#fff3d0"], 21, 16, 1);

    // Marble cake stand
    contactShadow(ctx, cx, botY + 42 * u, 250 * u, 40 * u, 0.6);
    ctx.save();
    ctx.beginPath();
    ctx.ellipse(cx, botY + 26 * u, 244 * u, 42 * u, 0, 0, Math.PI * 2);
    ctx.fillStyle = lin(ctx, cx - 244 * u, 0, cx + 244 * u, 0, [
      [0, "#4e463c"], [0.22, "#b9ad9b"], [0.5, "#efe7d8"], [0.78, "#a99d8c"], [1, "#443d34"],
    ]);
    ctx.fill();
    ctx.globalAlpha = 0.5;
    ctx.strokeStyle = "rgba(255,255,255,0.45)";
    ctx.lineWidth = 2 * u;
    ctx.stroke();
    ctx.restore();

    // Cake body — chocolate ganache with a wrapped horizontal sheen
    ctx.save();
    ctx.beginPath();
    ctx.moveTo(cx - hw, glazeY);
    ctx.lineTo(cx - hw, botY);
    ctx.ellipse(cx, botY, hw, 34 * u, 0, Math.PI, 0, true);
    ctx.lineTo(cx + hw, glazeY);
    ctx.closePath();
    ctx.fillStyle = lin(ctx, cx - hw, 0, cx + hw, 0, [
      [0, "#1c0e07"], [0.14, "#3d1f0e"], [0.36, "#6b3717"], [0.5, "#7d431d"],
      [0.66, "#582b12"], [0.86, "#31170a"], [1, "#150a04"],
    ]);
    ctx.fill();

    // Sponge seam + cream filling layers
    [0.42, 0.7].forEach((t) => {
      const y = glazeY + (botY - glazeY) * t;
      ctx.beginPath();
      ctx.moveTo(cx - hw, y);
      ctx.quadraticCurveTo(cx, y + 9 * u, cx + hw, y);
      ctx.lineWidth = 9 * u;
      ctx.strokeStyle = lin(ctx, cx - hw, 0, cx + hw, 0, [
        [0, "rgba(120,80,40,0.25)"], [0.45, "rgba(244,222,176,0.85)"], [1, "rgba(120,80,40,0.25)"],
      ]);
      ctx.stroke();
    });
    ctx.restore();

    // Poured gold glaze: drip skirt + top disc in one path
    ctx.save();
    ctx.beginPath();
    ctx.moveTo(cx - hw, glazeY);
    const drips = 9;
    const depths = [26, 58, 34, 74, 30, 66, 40, 52, 28];
    for (let i = 0; i < drips; i++) {
      const x0 = cx - hw + (i / drips) * hw * 2;
      const x1 = cx - hw + ((i + 1) / drips) * hw * 2;
      const depth = depths[i % depths.length] * u;
      ctx.quadraticCurveTo((x0 + x1) / 2, glazeY + depth * 1.6, x1, glazeY + depth * 0.22);
    }
    ctx.lineTo(cx + hw, glazeY);
    ctx.ellipse(cx, glazeY, hw, 42 * u, 0, 0, Math.PI, true);
    ctx.closePath();
    ctx.fillStyle = lin(ctx, cx - hw, glazeY - 42 * u, cx + hw, glazeY + 70 * u, [
      [0, "#8a6410"], [0.16, "#e8c777"], [0.32, "#fff6d2"], [0.48, "#e0b757"],
      [0.64, "#b8860b"], [0.82, "#f3dfa8"], [1, "#7a5509"],
    ]);
    ctx.fill();
    ctx.restore();

    // Glaze specular pools
    specular(ctx, cx - 62 * u, glazeY - 16 * u, 72 * u, 0.5);
    specular(ctx, cx + 78 * u, glazeY - 4 * u, 44 * u, 0.32);

    // Hand-applied gold leaf flakes
    const rand = mulberry32(404);
    for (let i = 0; i < 16; i++) {
      const a = rand() * Math.PI * 2;
      const rr = (0.25 + rand() * 0.75) * hw;
      const x = cx + Math.cos(a) * rr;
      const y = glazeY - 18 * u + Math.sin(a) * 26 * u + rand() * 150 * u;
      const s = (5 + rand() * 12) * u;
      ctx.save();
      ctx.translate(x, y);
      ctx.rotate(rand() * Math.PI);
      ctx.globalAlpha = 0.55 + rand() * 0.45;
      quad(ctx, [[-s, -s * 0.5], [s * 0.4, -s], [s, s * 0.55], [-s * 0.5, s * 0.8]]);
      ctx.fillStyle = lin(ctx, -s, -s, s, s, [
        [0, "#fff6d2"], [0.5, "#d4af37"], [1, "#8a6410"],
      ]);
      ctx.fill();
      ctx.restore();
    }

    // Berries on the crown
    [[-70, -14], [10, -26], [74, -8]].forEach((p, i) => {
      const bx = cx + p[0] * u;
      const by = glazeY + p[1] * u;
      const br = (20 + i * 3) * u;
      ctx.save();
      ctx.beginPath();
      ctx.arc(bx, by, br, 0, Math.PI * 2);
      ctx.fillStyle = rad(ctx, bx - br * 0.35, by - br * 0.45, br * 0.1, bx, by, br, [
        [0, "#a8202f"], [0.55, "#6d0f1c"], [1, "#2c0308"],
      ]);
      ctx.fill();
      ctx.restore();
      specular(ctx, bx - br * 0.3, by - br * 0.4, br * 0.5, 0.55);
    });

    // Candle + flame
    const candleX = cx + 2 * u;
    const candleTop = glazeY - 118 * u;
    ctx.save();
    ctx.beginPath();
    ctx.rect(candleX - 9 * u, candleTop, 18 * u, 84 * u);
    ctx.fillStyle = lin(ctx, candleX - 9 * u, 0, candleX + 9 * u, 0, [
      [0, "#8d7a55"], [0.35, "#f6ecd2"], [0.7, "#e2d2ad"], [1, "#7d6a48"],
    ]);
    ctx.fill();
    ctx.restore();

    ctx.save();
    ctx.globalAlpha = 0.85;
    ctx.fillStyle = rad(ctx, candleX, candleTop - 22 * u, 0, candleX, candleTop - 22 * u, 90 * u, [
      [0, "rgba(255,214,130,0.55)"], [0.45, "rgba(255,160,60,0.18)"], [1, "rgba(255,140,40,0)"],
    ]);
    ctx.beginPath();
    ctx.arc(candleX, candleTop - 22 * u, 90 * u, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();

    ctx.save();
    ctx.beginPath();
    ctx.moveTo(candleX, candleTop - 52 * u);
    ctx.bezierCurveTo(candleX + 16 * u, candleTop - 26 * u, candleX + 12 * u, candleTop - 2 * u, candleX, candleTop);
    ctx.bezierCurveTo(candleX - 12 * u, candleTop - 2 * u, candleX - 16 * u, candleTop - 26 * u, candleX, candleTop - 52 * u);
    ctx.closePath();
    ctx.fillStyle = lin(ctx, candleX, candleTop - 52 * u, candleX, candleTop, [
      [0, "#fffdf2"], [0.35, "#ffd86b"], [0.72, "#ff9a30"], [1, "rgba(255,110,20,0.55)"],
    ]);
    ctx.fill();
    ctx.restore();

    grain(ctx, box, 0.07, 404);
  }

  /* ---------------- 2. Velvet roses ---------------- */
  function rosePetalRing(ctx, x, y, rr, rot, count, stops) {
    for (let i = 0; i < count; i++) {
      const a = rot + i * ((Math.PI * 2) / count);
      ctx.save();
      ctx.translate(x, y);
      ctx.rotate(a);
      ctx.beginPath();
      ctx.moveTo(0, 0);
      ctx.bezierCurveTo(rr * 0.72, -rr * 0.22, rr * 1.02, rr * 0.3, 0, rr * 0.98);
      ctx.bezierCurveTo(-rr * 1.02, rr * 0.3, -rr * 0.72, -rr * 0.22, 0, 0);
      ctx.closePath();
      ctx.fillStyle = lin(ctx, 0, 0, 0, rr, stops);
      ctx.fill();
      ctx.globalAlpha = 0.35;
      ctx.strokeStyle = "rgba(0,0,0,0.45)";
      ctx.lineWidth = rr * 0.03;
      ctx.stroke();
      ctx.restore();
    }
  }

  function rose(ctx, x, y, rr, rot, shade) {
    const deep = shade.deep, mid = shade.mid, light = shade.light;
    contactShadow(ctx, x, y + rr * 0.45, rr * 1.15, rr * 0.5, 0.4);

    rosePetalRing(ctx, x, y, rr, rot, 7, [
      [0, deep], [0.45, mid], [1, light],
    ]);
    rosePetalRing(ctx, x, y, rr * 0.7, rot + 0.42, 6, [
      [0, deep], [0.5, mid], [1, light],
    ]);
    rosePetalRing(ctx, x, y, rr * 0.46, rot + 0.86, 5, [
      [0, deep], [0.55, deep], [1, mid],
    ]);

    // Furled heart
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(rot * 1.3);
    for (let i = 0; i < 3; i++) {
      ctx.beginPath();
      const s = rr * (0.26 - i * 0.07);
      ctx.ellipse(0, -s * 0.2, s, s * 0.78, i * 1.1, 0, Math.PI * 2);
      ctx.fillStyle = lin(ctx, -s, -s, s, s, [[0, deep], [1, mid]]);
      ctx.fill();
    }
    ctx.restore();

    // Velvet rim light from the upper left + a dew highlight
    ctx.save();
    ctx.globalAlpha = 0.3;
    ctx.beginPath();
    ctx.arc(x - rr * 0.3, y - rr * 0.34, rr * 0.62, 0, Math.PI * 2);
    ctx.fillStyle = rad(ctx, x - rr * 0.3, y - rr * 0.34, 0, x - rr * 0.3, y - rr * 0.34, rr * 0.62, [
      [0, withAlpha(light, 0.8)], [1, withAlpha(light, 0)],
    ]);
    ctx.fill();
    ctx.restore();
    specular(ctx, x - rr * 0.34, y - rr * 0.4, rr * 0.16, 0.5);
  }

  function leaf(ctx, x, y, len, rot) {
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(rot);
    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.bezierCurveTo(len * 0.42, -len * 0.3, len * 0.85, -len * 0.16, len, 0);
    ctx.bezierCurveTo(len * 0.85, len * 0.18, len * 0.42, len * 0.32, 0, 0);
    ctx.closePath();
    ctx.fillStyle = lin(ctx, 0, -len * 0.3, len, len * 0.3, [
      [0, "#16351f"], [0.45, "#2c5c33"], [0.75, "#1d4224"], [1, "#0c2013"],
    ]);
    ctx.fill();
    ctx.beginPath();
    ctx.moveTo(len * 0.04, 0);
    ctx.quadraticCurveTo(len * 0.5, len * 0.04, len * 0.96, 0);
    ctx.strokeStyle = "rgba(190,224,180,0.35)";
    ctx.lineWidth = len * 0.022;
    ctx.stroke();
    ctx.restore();
  }

  function paintRoses(ctx, box) {
    const { cx, cy, r } = box;

    backdrop(ctx, box, [
      [0, "#4a0f1c"], [0.38, "#2a0710"], [0.72, "#15030a"], [1, "#0a0105"],
    ], -r * 0.15);
    bokeh(ctx, box, ["#ff97ad", "#c2415c", "#ffd9a8"], 77, 14, 1);

    // Foliage behind the bouquet
    const leaves = [
      [-0.72, 0.18, 0.62, 3.5], [0.72, 0.2, 0.6, -0.4], [-0.5, 0.6, 0.5, 2.5],
      [0.52, 0.62, 0.52, 0.6], [0, 0.82, 0.46, 1.6], [-0.78, -0.22, 0.5, 3.9],
      [0.76, -0.26, 0.48, -0.7],
    ];
    leaves.forEach((l) => leaf(ctx, cx + l[0] * r * 0.7, cy + l[1] * r * 0.6, l[2] * r * 0.7, l[3]));

    const shades = [
      { deep: "#3d0410", mid: "#8c1024", light: "#d4536b" },
      { deep: "#320309", mid: "#73101f", light: "#bf4058" },
      { deep: "#46060f", mid: "#9c1528", light: "#e0697e" },
    ];
    const blooms = [
      [-0.42, -0.12, 0.30, 0.3, 1], [0.40, -0.16, 0.28, 1.1, 2],
      [-0.10, 0.34, 0.27, 2.0, 0], [0.24, 0.42, 0.22, 0.7, 1],
      [-0.46, 0.44, 0.20, 2.6, 2], [0.02, -0.40, 0.26, 1.7, 0],
    ];
    blooms.forEach((b) => {
      rose(ctx, cx + b[0] * r, cy + b[1] * r, b[2] * r, b[3], shades[b[4]]);
    });

    // Velvet vignette so the bouquet sits in shadow at the edges
    ctx.save();
    ctx.fillStyle = rad(ctx, cx, cy, r * 0.5, cx, cy, r, [
      [0, "rgba(0,0,0,0)"], [1, "rgba(0,0,0,0.6)"],
    ]);
    ctx.fillRect(cx - r, cy - r, r * 2, r * 2);
    ctx.restore();

    grain(ctx, box, 0.08, 77);
  }

  /* ---------------- 3. Silk gift box ---------------- */
  function paintGiftBox(ctx, box) {
    const { cx, cy, r } = box;
    const u = r / 300;
    const P = (x, y) => [cx + x * u, cy + y * u];

    backdrop(ctx, box, [
      [0, "#3a3550"], [0.4, "#1d1a2c"], [0.75, "#100e19"], [1, "#07060b"],
    ], -r * 0.2);
    bokeh(ctx, box, ["#cfd6ff", "#f3dfa8", "#ffffff"], 313, 15, 1);

    contactShadow(ctx, cx, cy + 190 * u, 230 * u, 40 * u, 0.6);

    const frontTL = P(-152, 12), frontTR = P(72, 12), frontBR = P(72, 182), frontBL = P(-152, 182);
    const topBL = frontTL, topBR = frontTR, topFR = P(168, -46), topFL = P(-56, -46);
    const sideTR = topFR, sideBR = P(168, 124);

    // Right face (in shadow)
    quad(ctx, [frontTR, sideTR, sideBR, frontBR]);
    ctx.fillStyle = lin(ctx, frontTR[0], frontTR[1], sideBR[0], sideBR[1], [
      [0, "#241f33"], [0.4, "#3a3350"], [0.7, "#2a2439"], [1, "#161320"],
    ]);
    ctx.fill();

    // Front face — satin bands read as silk
    quad(ctx, [frontTL, frontTR, frontBR, frontBL]);
    ctx.fillStyle = lin(ctx, frontTL[0], frontTL[1], frontBR[0], frontBR[1], [
      [0, "#2b2740"], [0.16, "#4b4468"], [0.3, "#6d6490"], [0.4, "#3c3554"],
      [0.55, "#5d5580"], [0.68, "#8f86b5"], [0.78, "#443d5e"], [1, "#221e33"],
    ]);
    ctx.fill();

    // Top face (catching the light)
    quad(ctx, [topBL, topFL, topFR, topBR]);
    ctx.fillStyle = lin(ctx, topFL[0], topFL[1], topBR[0], topBR[1], [
      [0, "#6a6290"], [0.25, "#a79fc8"], [0.45, "#c9c2e2"], [0.6, "#8079a6"],
      [0.82, "#b3abd2"], [1, "#5a5380"],
    ]);
    ctx.fill();

    // Satin ribbon — front band, then across the lid both ways
    function ribbon(pts, stops) {
      quad(ctx, pts);
      ctx.fillStyle = lin(ctx, pts[0][0], pts[0][1], pts[2][0], pts[2][1], stops);
      ctx.fill();
    }
    const gold = [
      [0, "#7a5509"], [0.18, "#e8c777"], [0.36, "#fff6d2"], [0.5, "#dcb45a"],
      [0.72, "#b8860b"], [1, "#6d4a08"],
    ];
    ribbon([P(-52, 12), P(-10, 12), P(-10, 182), P(-52, 182)], gold);   // front band
    ribbon([P(-52, 12), P(-10, 12), P(86, -46), P(44, -46)], gold);      // band over the lid
    ribbon([P(-56, -34), P(168, -34), P(168, -8), P(-56, -8)], gold);    // band across the lid

    // Hand-tied bow at the crossing on the lid
    const bx = cx + 30 * u, by = cy - 40 * u;
    function loop(dir) {
      ctx.save();
      ctx.translate(bx, by);
      ctx.beginPath();
      ctx.moveTo(0, 0);
      ctx.bezierCurveTo(56 * u * dir, -62 * u, 116 * u * dir, -18 * u, 40 * u * dir, 16 * u);
      ctx.bezierCurveTo(24 * u * dir, 22 * u, 10 * u * dir, 10 * u, 0, 0);
      ctx.closePath();
      ctx.fillStyle = lin(ctx, 0, -60 * u, 60 * u * dir, 20 * u, [
        [0, "#fff6d2"], [0.35, "#e8c777"], [0.7, "#b8860b"], [1, "#6d4a08"],
      ]);
      ctx.fill();
      ctx.strokeStyle = "rgba(90,60,6,0.5)";
      ctx.lineWidth = 1.6 * u;
      ctx.stroke();
      ctx.restore();
    }
    function tail(dir) {
      ctx.save();
      ctx.translate(bx, by);
      ctx.beginPath();
      ctx.moveTo(0, 6 * u);
      ctx.bezierCurveTo(28 * u * dir, 44 * u, 40 * u * dir, 92 * u, 78 * u * dir, 108 * u);
      ctx.lineTo(52 * u * dir, 116 * u);
      ctx.bezierCurveTo(22 * u * dir, 88 * u, 8 * u * dir, 46 * u, 0, 18 * u);
      ctx.closePath();
      ctx.fillStyle = lin(ctx, 0, 0, 70 * u * dir, 110 * u, [
        [0, "#e8c777"], [0.5, "#c69a2c"], [1, "#7a5509"],
      ]);
      ctx.fill();
      ctx.restore();
    }
    tail(-1); tail(1);
    loop(-1); loop(1);

    ctx.save();
    ctx.beginPath();
    ctx.ellipse(bx, by + 4 * u, 22 * u, 17 * u, 0, 0, Math.PI * 2);
    ctx.fillStyle = rad(ctx, bx - 8 * u, by - 4 * u, 2 * u, bx, by + 4 * u, 24 * u, [
      [0, "#fff9e0"], [0.5, "#dcb45a"], [1, "#7a5509"],
    ]);
    ctx.fill();
    ctx.restore();

    specular(ctx, cx - 60 * u, cy - 34 * u, 80 * u, 0.35);
    specular(ctx, cx - 110 * u, cy + 70 * u, 46 * u, 0.22);

    // Sparkles
    const rand = mulberry32(313);
    for (let i = 0; i < 12; i++) {
      const a = rand() * Math.PI * 2;
      const d = (0.5 + rand() * 0.5) * r;
      const x = cx + Math.cos(a) * d, y = cy + Math.sin(a) * d * 0.9;
      const s = (4 + rand() * 10) * u;
      ctx.save();
      ctx.globalAlpha = 0.4 + rand() * 0.5;
      ctx.strokeStyle = "rgba(255,248,214,0.9)";
      ctx.lineWidth = 1.4 * u;
      ctx.beginPath();
      ctx.moveTo(x - s, y); ctx.lineTo(x + s, y);
      ctx.moveTo(x, y - s); ctx.lineTo(x, y + s);
      ctx.stroke();
      ctx.restore();
    }

    grain(ctx, box, 0.06, 313);
  }

  /* ---------------- 4. Champagne gala ---------------- */
  function flute(ctx, x, baseY, h, tilt, seed) {
    const u = h / 420;
    ctx.save();
    ctx.translate(x, baseY);
    ctx.rotate(tilt);

    // Foot + stem
    ctx.beginPath();
    ctx.ellipse(0, 0, 66 * u, 16 * u, 0, 0, Math.PI * 2);
    ctx.fillStyle = lin(ctx, -66 * u, 0, 66 * u, 0, [
      [0, "rgba(255,255,255,0.1)"], [0.3, "rgba(255,255,255,0.55)"],
      [0.5, "rgba(255,255,255,0.85)"], [0.7, "rgba(255,255,255,0.4)"], [1, "rgba(255,255,255,0.08)"],
    ]);
    ctx.fill();

    ctx.beginPath();
    ctx.rect(-7 * u, -150 * u, 14 * u, 150 * u);
    ctx.fillStyle = lin(ctx, -7 * u, 0, 7 * u, 0, [
      [0, "rgba(255,255,255,0.12)"], [0.45, "rgba(255,255,255,0.7)"],
      [0.6, "rgba(255,255,255,0.3)"], [1, "rgba(255,255,255,0.1)"],
    ]);
    ctx.fill();

    // Bowl
    const bowlTop = -420 * u, bowlBot = -148 * u, bw = 76 * u;
    ctx.beginPath();
    ctx.moveTo(-bw, bowlTop);
    ctx.bezierCurveTo(-bw * 0.96, bowlTop + 150 * u, -bw * 0.4, bowlBot - 16 * u, 0, bowlBot);
    ctx.bezierCurveTo(bw * 0.4, bowlBot - 16 * u, bw * 0.96, bowlTop + 150 * u, bw, bowlTop);
    ctx.closePath();

    // Liquid first, clipped to the bowl
    ctx.save();
    ctx.clip();
    const liquidTop = bowlTop + 96 * u;
    ctx.beginPath();
    ctx.rect(-bw, liquidTop, bw * 2, bowlBot - liquidTop + 20 * u);
    ctx.fillStyle = lin(ctx, 0, liquidTop, 0, bowlBot, [
      [0, "#ffe9a8"], [0.3, "#f0c25c"], [0.68, "#d99a25"], [1, "#a96a10"],
    ]);
    ctx.fill();

    // Surface meniscus
    ctx.beginPath();
    ctx.ellipse(0, liquidTop, bw * 0.82, 13 * u, 0, 0, Math.PI * 2);
    ctx.fillStyle = "rgba(255,248,214,0.75)";
    ctx.fill();

    // Rising bubbles
    const rand = mulberry32(seed);
    for (let i = 0; i < 26; i++) {
      const bxx = (rand() - 0.5) * bw * 1.35;
      const byy = liquidTop + rand() * (bowlBot - liquidTop);
      const br = (1.6 + rand() * 4.4) * u;
      ctx.beginPath();
      ctx.arc(bxx, byy, br, 0, Math.PI * 2);
      ctx.fillStyle = "rgba(255,252,232," + (0.35 + rand() * 0.5) + ")";
      ctx.fill();
    }
    ctx.restore();

    // Glass body highlights
    ctx.beginPath();
    ctx.moveTo(-bw, bowlTop);
    ctx.bezierCurveTo(-bw * 0.96, bowlTop + 150 * u, -bw * 0.4, bowlBot - 16 * u, 0, bowlBot);
    ctx.bezierCurveTo(bw * 0.4, bowlBot - 16 * u, bw * 0.96, bowlTop + 150 * u, bw, bowlTop);
    ctx.closePath();
    ctx.fillStyle = lin(ctx, -bw, 0, bw, 0, [
      [0, "rgba(255,255,255,0.22)"], [0.18, "rgba(255,255,255,0.05)"],
      [0.44, "rgba(255,255,255,0.3)"], [0.56, "rgba(255,255,255,0.06)"],
      [0.84, "rgba(255,255,255,0.24)"], [1, "rgba(255,255,255,0.1)"],
    ]);
    ctx.fill();
    ctx.lineWidth = 2.4 * u;
    ctx.strokeStyle = "rgba(255,255,255,0.5)";
    ctx.stroke();

    // Rim
    ctx.beginPath();
    ctx.ellipse(0, bowlTop, bw, 15 * u, 0, 0, Math.PI * 2);
    ctx.lineWidth = 3 * u;
    ctx.strokeStyle = "rgba(255,255,255,0.8)";
    ctx.stroke();

    ctx.restore();
  }

  function paintChampagne(ctx, box) {
    const { cx, cy, r } = box;
    const u = r / 300;

    backdrop(ctx, box, [
      [0, "#4b3a12"], [0.36, "#241a07"], [0.72, "#130d03"], [1, "#080500"],
    ], -r * 0.25);
    bokeh(ctx, box, ["#ffd489", "#fff3d0", "#ffae4d"], 909, 22, 1.05);

    contactShadow(ctx, cx, cy + 196 * u, 210 * u, 34 * u, 0.55);

    flute(ctx, cx - 74 * u, cy + 186 * u, 400 * u, 0.13, 11);
    flute(ctx, cx + 74 * u, cy + 186 * u, 400 * u, -0.13, 29);

    // Celebration flare where the rims meet
    ctx.save();
    ctx.globalCompositeOperation = "lighter";
    const fx = cx, fy = cy - 118 * u;
    ctx.fillStyle = rad(ctx, fx, fy, 0, fx, fy, 120 * u, [
      [0, "rgba(255,244,205,0.6)"], [0.4, "rgba(255,196,96,0.22)"], [1, "rgba(255,170,60,0)"],
    ]);
    ctx.beginPath();
    ctx.arc(fx, fy, 120 * u, 0, Math.PI * 2);
    ctx.fill();
    ctx.globalAlpha = 0.5;
    ctx.strokeStyle = "rgba(255,246,210,0.7)";
    ctx.lineWidth = 2 * u;
    ctx.beginPath();
    ctx.moveTo(fx - 150 * u, fy); ctx.lineTo(fx + 150 * u, fy);
    ctx.stroke();
    ctx.restore();

    // Escaping bubbles above the glasses
    const rand = mulberry32(909);
    for (let i = 0; i < 22; i++) {
      const x = cx + (rand() - 0.5) * r * 1.3;
      const y = cy - r * 0.2 - rand() * r * 0.7;
      const br = (2 + rand() * 5) * u;
      ctx.save();
      ctx.globalAlpha = 0.25 + rand() * 0.5;
      ctx.beginPath();
      ctx.arc(x, y, br, 0, Math.PI * 2);
      ctx.strokeStyle = "rgba(255,248,214,0.85)";
      ctx.lineWidth = 1.2 * u;
      ctx.stroke();
      ctx.restore();
    }

    grain(ctx, box, 0.07, 909);
  }

  // Offline fallback for the legacy `champagne-gala` id. The bundled
  // photographic asset is preferred; this painter ensures a missing or
  // corrupt asset still shows balloons rather than restoring champagne.
  function paintBalloons(ctx, box) {
    const { cx, cy, r } = box;
    const u = r / 300;
    backdrop(ctx, box, [
      [0, "#173c2d"], [0.46, "#0b2219"], [0.78, "#111006"], [1, "#050705"],
    ], -r * 0.2);
    bokeh(ctx, box, ["#e8c777", "#fff4d2", "#2a7655"], 719, 16, 1);

    const balloons = [
      [-112, -42, 62, 82, "#d4a83c"], [0, -112, 68, 92, "#0f6a49"],
      [108, -38, 62, 84, "#f1e4c9"], [-52, 52, 66, 88, "#f6efe0"],
      [62, 58, 68, 90, "#c99524"], [-142, 80, 52, 70, "#176146"],
      [142, 88, 50, 68, "#176146"],
    ];
    balloons.forEach(([ox, oy, rx, ry, color], index) => {
      const x = cx + ox * u, y = cy + oy * u;
      const g = rad(ctx, x - rx * 0.28 * u, y - ry * 0.32 * u, 2, x, y, ry * u, [
        [0, "rgba(255,255,255,0.92)"], [0.16, color], [0.72, color], [1, "rgba(0,0,0,0.52)"],
      ]);
      ctx.beginPath();
      ctx.ellipse(x, y, rx * u, ry * u, (index % 3 - 1) * 0.08, 0, Math.PI * 2);
      ctx.fillStyle = g;
      ctx.fill();
      ctx.strokeStyle = "rgba(255,246,215,0.28)";
      ctx.lineWidth = 1.4 * u;
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(x, y + ry * u);
      ctx.quadraticCurveTo(cx + ox * 0.45 * u, cy + 190 * u, cx, cy + 244 * u);
      ctx.strokeStyle = "rgba(232,199,119,0.78)";
      ctx.lineWidth = 1.3 * u;
      ctx.stroke();
    });
    grain(ctx, box, 0.045, 719);
  }

  /* ---------------- 5. Theme aura (abstract) ---------------- */
  function paintAura(ctx, box, opts) {
    const { cx, cy, r } = box;
    const colors = (opts.theme.centerpiece && opts.theme.centerpiece.colors) || ["#333", "#111", "#000"];
    ctx.fillStyle = rad(ctx, cx, cy - r * 0.1, r * 0.06, cx, cy, r, colors.map((c, i) => [i / Math.max(1, colors.length - 1), c]));
    ctx.fillRect(cx - r, cy - r, r * 2, r * 2);
    bokeh(ctx, box, [opts.theme.palette.primary, opts.theme.palette.secondary], 55, 16, 1);

    if (opts.monogram && opts.occasionId !== "new-baby") {
      ctx.save();
      ctx.globalAlpha = 0.24;
      ctx.fillStyle = opts.theme.palette.primary;
      ctx.font = "500 " + Math.round(r * 0.72) + "px 'Cormorant Garamond', Georgia, serif";
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText(String(opts.monogram).toUpperCase(), cx, cy);
      ctx.restore();
    }
    grain(ctx, box, 0.05, 55);
  }

  /* ---------------- 5a. New baby teddy bear ---------------- */
  function paintBabyTeddy(ctx, box, opts) {
    const { cx, cy, r } = box;
    const u = r / 300;
    const primary = opts.theme.palette.primary || "#d4af37";
    const secondary = opts.theme.palette.secondary || "#f1d7a0";
    backdrop(ctx, box, [
      [0, "#3b2b2a"], [0.42, "#241719"], [0.78, "#120b10"], [1, "#08050a"],
    ], -r * 0.16);
    bokeh(ctx, box, [secondary, primary, "#f3d5c0"], 414, 12, 1);

    const star = (x, y, size, alpha) => {
      ctx.save();
      ctx.globalAlpha = alpha;
      ctx.fillStyle = secondary;
      ctx.beginPath();
      ctx.moveTo(x, y - size);
      ctx.lineTo(x + size * 0.22, y - size * 0.22);
      ctx.lineTo(x + size, y);
      ctx.lineTo(x + size * 0.22, y + size * 0.22);
      ctx.lineTo(x, y + size);
      ctx.lineTo(x - size * 0.22, y + size * 0.22);
      ctx.lineTo(x - size, y);
      ctx.lineTo(x - size * 0.22, y - size * 0.22);
      ctx.closePath();
      ctx.fill();
      ctx.restore();
    };
    [[-0.58, -0.46, 10, 0.78], [0.57, -0.32, 8, 0.65], [-0.58, 0.36, 7, 0.55], [0.62, 0.5, 11, 0.72], [0.04, -0.68, 6, 0.6]].forEach(([x, y, s, a]) => star(cx + x * r, cy + y * r, s * u, a));

    const fur = "#c18b66";
    const furLight = "#e6b38d";
    const furShadow = "#8b5a48";
    const eye = "#2a1720";
    const bearY = cy + 18 * u;
    ctx.save();
    ctx.shadowColor = "rgba(0,0,0,0.38)";
    ctx.shadowBlur = 20 * u;
    ctx.fillStyle = furShadow;
    ctx.beginPath(); ctx.ellipse(cx, bearY + 92 * u, 112 * u, 120 * u, 0, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = fur;
    ctx.beginPath(); ctx.arc(cx - 78 * u, bearY - 84 * u, 50 * u, 0, Math.PI * 2); ctx.fill();
    ctx.beginPath(); ctx.arc(cx + 78 * u, bearY - 84 * u, 50 * u, 0, Math.PI * 2); ctx.fill();
    ctx.beginPath(); ctx.arc(cx, bearY - 42 * u, 116 * u, 0, Math.PI * 2); ctx.fill();
    ctx.restore();

    ctx.save();
    ctx.fillStyle = furLight;
    ctx.beginPath(); ctx.arc(cx - 78 * u, bearY - 84 * u, 28 * u, 0, Math.PI * 2); ctx.fill();
    ctx.beginPath(); ctx.arc(cx + 78 * u, bearY - 84 * u, 28 * u, 0, Math.PI * 2); ctx.fill();
    ctx.beginPath(); ctx.ellipse(cx, bearY - 16 * u, 66 * u, 54 * u, 0, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = eye;
    ctx.beginPath(); ctx.arc(cx - 40 * u, bearY - 54 * u, 9 * u, 0, Math.PI * 2); ctx.fill();
    ctx.beginPath(); ctx.arc(cx + 40 * u, bearY - 54 * u, 9 * u, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = furShadow;
    ctx.beginPath(); ctx.ellipse(cx, bearY - 14 * u, 17 * u, 12 * u, 0, 0, Math.PI * 2); ctx.fill();
    ctx.strokeStyle = eye; ctx.lineWidth = 4 * u; ctx.lineCap = "round";
    ctx.beginPath(); ctx.arc(cx, bearY - 4 * u, 20 * u, 0.2, Math.PI - 0.2); ctx.stroke();
    ctx.fillStyle = secondary;
    ctx.beginPath(); ctx.arc(cx, bearY + 66 * u, 30 * u, 0, Math.PI * 2); ctx.fill();
    ctx.restore();

    // Small champagne bow keeps the teddy aligned with the luxury palette.
    ctx.save();
    ctx.fillStyle = primary;
    ctx.beginPath(); ctx.ellipse(cx - 24 * u, bearY + 50 * u, 30 * u, 17 * u, -0.35, 0, Math.PI * 2); ctx.fill();
    ctx.beginPath(); ctx.ellipse(cx + 24 * u, bearY + 50 * u, 30 * u, 17 * u, 0.35, 0, Math.PI * 2); ctx.fill();
    ctx.beginPath(); ctx.arc(cx, bearY + 50 * u, 11 * u, 0, Math.PI * 2); ctx.fill();
    ctx.restore();
    grain(ctx, box, 0.045, 414);
  }

  /* ---------------- realistic asset presentation ---------------- */
  // Draws a bundled photographic centrepiece supplied under
  // assets/centerpieces/). Cover-fits the image into the same box the
  // procedural painters fill, applies a soft theme-colour wash so a stock
  // asset still reads as belonging to the selected theme, and honours the
  // optional monogram the procedural painters also support.
  function paintRealisticAsset(ctx, box, img, opts) {
    const { cx, cy, r } = box;
    const size = r * 2;
    // Transparent product cutouts should remain fully visible. A contain
    // fit avoids clipping rose leaves, ribbons, candle flames or balloon
    // strings at the circular medallion edge.
    const contain = Math.min(size / img.width, size / img.height) * 0.92;
    const dw = img.width * contain;
    const dh = img.height * contain;
    const isCondolence = opts.occasionId === "condolence";
    const isHeartfelt = isCondolence && opts.emotion === "heartfelt";

    if (!isHeartfelt) {
      const backing = rad(ctx, cx, cy - r * 0.12, r * 0.08, cx, cy, r, [
        [0, withAlpha(opts.theme.palette.secondary, 0.22)],
        [0.58, withAlpha(opts.theme.background.top, 0.7)],
        [1, withAlpha(opts.theme.background.bottom, 0.94)],
      ]);
      ctx.fillStyle = backing;
      ctx.fillRect(cx - r, cy - r, size, size);
      ctx.drawImage(img, cx - dw / 2, cy - dh / 2, dw, dh);
      ctx.save();
      ctx.globalAlpha = 0.14;
      ctx.globalCompositeOperation = "overlay";
      ctx.fillStyle = opts.theme.palette.secondary;
      ctx.beginPath();
      ctx.arc(cx, cy, r, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
      return;
    }

    const backing = rad(ctx, cx, cy - r * 0.1, r * 0.05, cx, cy, r, [
        [0, "#fffef9"],
        [0.55, "#f6ede0"],
        [1, "#ece0ce"],
    ]);
    ctx.save();
    ctx.beginPath();
    ctx.arc(cx, cy, r, 0, Math.PI * 2);
    ctx.fillStyle = backing;
    ctx.fill();
    ctx.drawImage(img, cx - dw / 2, cy - dh / 2, dw, dh);

    ctx.restore();

  }

  /* ---------------- 6. White lilies (sympathy) ---------------- */
  function paintWhiteLilies(ctx, box) {
    const { cx, cy, r } = box;
    const u = r / 300;
    backdrop(ctx, box, [
      [0, "#2c332d"], [0.45, "#18201a"], [0.75, "#101411"], [1, "#070a08"],
    ], -r * 0.18);
    bokeh(ctx, box, ["#e8efe9", "#d4af37", "#a3b899"], 313, 14, 1);

    // Leaves and foliage
    [[-60, 20, 70, -0.6], [60, 30, 65, 0.55], [-40, -50, 55, -1.2], [45, -45, 55, 1.1]].forEach(([ox, oy, len, rot]) => {
      ctx.save();
      ctx.translate(cx + ox * u, cy + oy * u);
      ctx.rotate(rot);
      ctx.beginPath();
      ctx.moveTo(0, 0);
      ctx.bezierCurveTo(len * 0.4 * u, -len * 0.22 * u, len * 0.8 * u, -len * 0.1 * u, len * u, 0);
      ctx.bezierCurveTo(len * 0.8 * u, len * 0.1 * u, len * 0.4 * u, len * 0.22 * u, 0, 0);
      ctx.closePath();
      ctx.fillStyle = lin(ctx, 0, 0, len * u, 0, [[0, "#1e3a29"], [0.6, "#355e42"], [1, "#527e5e"]]);
      ctx.fill();
      ctx.restore();
    });

    // Central white lily bloom
    const petals = 6;
    for (let i = 0; i < petals; i++) {
      const a = (i * Math.PI * 2) / petals + 0.26;
      ctx.save();
      ctx.translate(cx, cy - 10 * u);
      ctx.rotate(a);
      ctx.beginPath();
      ctx.moveTo(0, 0);
      ctx.bezierCurveTo(45 * u, -22 * u, 95 * u, -18 * u, 130 * u, 0);
      ctx.bezierCurveTo(95 * u, 18 * u, 45 * u, 22 * u, 0, 0);
      ctx.closePath();
      ctx.fillStyle = lin(ctx, 0, 0, 130 * u, 0, [
        [0, "#8da87c"], [0.18, "#dcebd2"], [0.45, "#f7fcf5"], [0.85, "#ffffff"], [1, "#eae6dc"],
      ]);
      ctx.fill();
      ctx.strokeStyle = "rgba(212, 175, 55, 0.28)";
      ctx.lineWidth = 1.2 * u;
      ctx.stroke();
      ctx.restore();
    }

    // Lily Stamen / pistil
    for (let j = 0; j < 5; j++) {
      const sa = (j * Math.PI * 2) / 5 + 0.5;
      const sx = cx + Math.cos(sa) * 38 * u;
      const sy = cy - 10 * u + Math.sin(sa) * 38 * u;
      ctx.beginPath();
      ctx.moveTo(cx, cy - 10 * u);
      ctx.quadraticCurveTo(cx + Math.cos(sa) * 20 * u, cy - 10 * u + Math.sin(sa) * 20 * u, sx, sy);
      ctx.strokeStyle = "rgba(180, 210, 150, 0.85)";
      ctx.lineWidth = 1.8 * u;
      ctx.stroke();
      ctx.beginPath();
      ctx.ellipse(sx, sy, 5 * u, 2.5 * u, sa, 0, Math.PI * 2);
      ctx.fillStyle = "#8a4f10";
      ctx.fill();
    }

    grain(ctx, box, 0.04, 313);
  }

  /* ---------------- public API ---------------- */
  const PAINTERS = {
    "belgian-gold-cake": paintCake,
    "white-lilies": paintWhiteLilies,
    "velvet-roses": paintRoses,
    "silk-gift-box": paintGiftBox,
    "champagne-gala": paintBalloons,
    "baby-teddy": paintBabyTeddy,
    "theme-aura": paintAura,
  };

  function list(occasionId) {
    const occ = OccasionRegistry.get(occasionId || "birthday");
    const allowed = occ.allowedCenterpieces || ["auto", "velvet-roses", "theme-aura"];
    return LIST.filter((cp) => allowed.includes(cp.id)).map((cp) => {
      if (cp.id === "auto" && occ.id === "condolence") {
        return { ...cp, hint: "Matches the sympathy tone" };
      }
      return cp;
    });
  }

  // "auto" resolves against the greeting emotion and occasion so the
  // centrepiece always agrees with the tone and context of the message.
  function resolveId(id, emotion, occasionId) {
    const occ = OccasionRegistry.get(occasionId || "birthday");
    if (occ.id === "condolence") {
      const design = OccasionRegistry.getDesign(occ.id, emotion);
      return design && design.centerpieceId && PAINTERS[design.centerpieceId]
        ? design.centerpieceId
        : "theme-aura";
    }
    const allowed = occ.allowedCenterpieces || ["auto", "velvet-roses", "theme-aura"];
    if (occ.id === "new-baby" && id === "theme-aura") return "newborn-hand-feet";
    if (id && id !== "auto" && allowed.includes(id) && (PAINTERS[id] || CenterpieceAssetResolver.isSupported(id))) return id;
    const normEmotion = GreetingGenerator.normalizeEmotion(emotion, occ.id);
    const map = occ.defaultCenterpieceMap || {};
    const candidate = map[normEmotion] || occ.fallbackCenterpiece || "velvet-roses";
    return allowed.includes(candidate) ? candidate : (occ.fallbackCenterpiece || "theme-aura");
  }

  // Tries a real photographic asset first (see CenterpieceAssetResolver);
  // falls back to the matching procedural painter when none is bundled or
  // it fails to load/decode. Always resolves — never rejects — so a
  // missing or corrupt asset file can never break a render.
  async function paint(ctx, box, opts) {
    const resolvedId = resolveId(opts.id, opts.emotion, opts.occasionId);
    let asset = null;
    try {
      asset = await CenterpieceAssetResolver.resolve(resolvedId);
    } catch (err) {
      asset = null;
    }
    ctx.save();
    if (asset) {
      paintRealisticAsset(ctx, box, asset, opts);
    } else {
      const painter = PAINTERS[resolvedId] || paintRoses;
      painter(ctx, box, opts);
    }
    ctx.restore();
    return { usedRealisticAsset: !!asset, resolvedId };
  }

  return { list, paint, resolveId };
})();

/* =========================================================================
   SECTION: Renderer
   Shared canvas renderer used by both live preview and PNG export. Draw
   order follows the architect spec exactly (background -> texture ->
   vignette -> centerpiece/photo -> frame -> stamps(bg) -> recipient name ->
   greeting -> supporting copy -> stamps(fg) -> signature -> foil/emboss
   compositing -> grain/grading). Preview and export call the *same*
   functions; only `options.quality` trades off expensive passes (grain
   regeneration, blur sample count) for responsiveness during interaction.
   ========================================================================= */
const Renderer = (() => {
  const W = LayoutEngine.CANVAS_W;
  const H = LayoutEngine.CANVAS_H;

  function createWorkCanvas(w, h) {
    if (typeof OffscreenCanvas !== "undefined") {
      try { return new OffscreenCanvas(w, h); } catch (err) { /* fall through */ }
    }
    const c = document.createElement("canvas");
    c.width = w; c.height = h;
    return c;
  }

  let _blendSupport = null;
  function supportsBlendModes() {
    if (_blendSupport !== null) return _blendSupport;
    try {
      const c = createWorkCanvas(4, 4);
      const ctx = c.getContext("2d");
      ctx.fillStyle = "#ff0000";
      ctx.fillRect(0, 0, 4, 4);
      ctx.globalCompositeOperation = "multiply";
      ctx.fillStyle = "#0000ff";
      ctx.fillRect(0, 0, 4, 4);
      const data = ctx.getImageData(0, 0, 1, 1).data;
      // Under true multiply, red*blue -> near-black. Under a naive fallback
      // that ignores the composite op, the pixel stays blue.
      _blendSupport = data[0] < 40 && data[2] < 40;
    } catch (err) {
      _blendSupport = false;
    }
    return _blendSupport;
  }

  /* ---------------- Texture cache ---------------- */
  const textureCache = new Map();
  function getCachedTile(key, size, generator) {
    const cacheKey = key + ":" + size;
    if (textureCache.has(cacheKey)) return textureCache.get(cacheKey);
    const canvas = createWorkCanvas(size, size);
    const ctx = canvas.getContext("2d");
    generator(ctx, size);
    textureCache.set(cacheKey, canvas);
    return canvas;
  }

  function mulberry32(seed) {
    return function () {
      seed |= 0; seed = (seed + 0x6D2B79F5) | 0;
      let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  function generateGrainTile(ctx, size, seed, alpha) {
    const rand = mulberry32(seed);
    const imgData = ctx.createImageData(size, size);
    for (let i = 0; i < imgData.data.length; i += 4) {
      const v = Math.floor(rand() * 255);
      imgData.data[i] = v; imgData.data[i + 1] = v; imgData.data[i + 2] = v;
      imgData.data[i + 3] = Math.floor(alpha * 255);
    }
    ctx.putImageData(imgData, 0, 0);
  }

  function generateMarbleTile(ctx, size, tint, veinColor, veinAlpha) {
    ctx.fillStyle = tint;
    ctx.fillRect(0, 0, size, size);
    const rand = mulberry32(7);
    for (let i = 0; i < 6; i++) {
      ctx.save();
      ctx.globalAlpha = (veinAlpha || 0.08) + rand() * (veinAlpha || 0.08);
      ctx.strokeStyle = veinColor || "#ffffff";
      ctx.lineWidth = 1 + rand() * 2;
      ctx.beginPath();
      let x = rand() * size, y = 0;
      ctx.moveTo(x, y);
      for (let s = 0; s < 5; s++) {
        x += (rand() - 0.5) * size * 0.5;
        y += size / 5;
        ctx.quadraticCurveTo(x + (rand() - 0.5) * 40, y - size / 10, x, y);
      }
      ctx.stroke();
      ctx.restore();
    }
  }

  function generateVelvetTile(ctx, size, tint) {
    ctx.fillStyle = tint;
    ctx.fillRect(0, 0, size, size);
    const rand = mulberry32(11);
    ctx.save();
    for (let x = 0; x < size; x += 2) {
      ctx.globalAlpha = 0.02 + rand() * 0.03;
      ctx.fillStyle = rand() > 0.5 ? "#ffffff" : "#000000";
      ctx.fillRect(x, 0, 1, size);
    }
    ctx.restore();
  }

  function generatePaperTile(ctx, size, tint) {
    ctx.fillStyle = tint;
    ctx.fillRect(0, 0, size, size);
    generateGrainTileInto(ctx, size, 3, 0.05);
  }

  function generateGrainTileInto(ctx, size, seed, alpha) {
    const rand = mulberry32(seed);
    const imgData = ctx.getImageData(0, 0, size, size);
    for (let i = 0; i < imgData.data.length; i += 4) {
      const v = Math.floor(rand() * 255);
      const a = alpha * 255;
      imgData.data[i] = (imgData.data[i] * (1 - alpha)) + v * alpha;
      imgData.data[i + 1] = (imgData.data[i + 1] * (1 - alpha)) + v * alpha;
      imgData.data[i + 2] = (imgData.data[i + 2] * (1 - alpha)) + v * alpha;
    }
    ctx.putImageData(imgData, 0, 0);
  }

  function drawTexture(ctx, theme, quality) {
    const size = quality === "preview" ? 160 : 256;
    let tile;
    if (theme.background.texture === "marble") {
      tile = getCachedTile("marble-" + theme.id, size, (c) => generateMarbleTile(
        c, size, theme.background.textureTint, theme.background.veinColor, theme.background.veinAlpha
      ));
    } else if (theme.background.texture === "velvet") {
      tile = getCachedTile("velvet-" + theme.id, size, (c) => generateVelvetTile(c, size, theme.background.textureTint));
    } else if (theme.background.texture === "paper") {
      tile = getCachedTile("paper-" + theme.id, size, (c) => generatePaperTile(c, size, theme.background.textureTint));
    } else {
      tile = getCachedTile("brushed-" + theme.id, size, (c) => generateVelvetTile(c, size, theme.background.textureTint));
    }
    ctx.save();
    ctx.globalAlpha = 0.5;
    ctx.globalCompositeOperation = supportsBlendModes() ? "overlay" : "source-over";
    if (ctx.globalCompositeOperation !== "overlay" || true) {
      // overlay via pattern fill
    }
    try {
      const pattern = ctx.createPattern(tile, "repeat");
      ctx.fillStyle = pattern;
      ctx.fillRect(0, 0, W, H);
    } catch (err) { /* pattern creation can fail on some canvas impls; skip texture */ }
    ctx.restore();
  }

  // Full-card ivory stone surface for Pearl Marble. Drawing this at card
  // scale avoids the visibly repeating wallpaper pattern produced by a
  // small texture tile while retaining deterministic preview/export output.
  function drawPearlMarbleSurface(ctx) {
    const rand = mulberry32(1701);
    ctx.save();

    // Broad pearlescent clouds beneath the mineral veins.
    for (let i = 0; i < 6; i++) {
      const x = rand() * W;
      const y = rand() * H;
      const radius = 240 + rand() * 380;
      const cloud = ctx.createRadialGradient(x, y, 0, x, y, radius);
      cloud.addColorStop(0, i % 2 ? "rgba(255,255,255,0.22)" : "rgba(195,159,103,0.08)");
      cloud.addColorStop(1, "rgba(255,255,255,0)");
      ctx.fillStyle = cloud;
      ctx.fillRect(0, 0, W, H);
    }

    // Long, irregular mineral seams with a soft umber body and a fine
    // champagne highlight. Each seam crosses the whole card only once.
    for (let i = 0; i < 7; i++) {
      const points = [];
      let x = -120;
      let y = 120 + i * 245 + (rand() - 0.5) * 160;
      points.push([x, y]);
      for (let s = 1; s <= 8; s++) {
        x = -120 + s * (W + 240) / 8;
        y += (rand() - 0.52) * 115;
        points.push([x, y]);
      }

      const trace = () => {
        ctx.beginPath();
        ctx.moveTo(points[0][0], points[0][1]);
        for (let p = 1; p < points.length; p++) {
          const prev = points[p - 1];
          const cur = points[p];
          const mx = (prev[0] + cur[0]) / 2;
          const my = (prev[1] + cur[1]) / 2;
          ctx.quadraticCurveTo(prev[0], prev[1], mx, my);
        }
      };

      trace();
      ctx.strokeStyle = "rgba(92,61,28,0.09)";
      ctx.lineWidth = 4 + rand() * 5;
      ctx.stroke();
      trace();
      ctx.strokeStyle = "rgba(176,128,55,0.18)";
      ctx.lineWidth = 1 + rand() * 1.2;
      ctx.stroke();
      trace();
      ctx.strokeStyle = "rgba(255,255,255,0.32)";
      ctx.lineWidth = 0.7;
      ctx.translate(0, -1.5);
      ctx.stroke();
      ctx.setTransform(1, 0, 0, 1, 0, 0);
    }
    ctx.restore();
  }

  /* ---------------- 1-4: Background, texture, vignette ---------------- */
  async function renderBackground(ctx, theme, quality, project) {
    const occasionId = (project && project.occasion && project.occasion.id) || "birthday";
    const festivalDesign = FestivalDesignRegistry.get(occasionId, project && project.content && project.content.festivalDesignId);
    if (festivalDesign) {
      const image = await FestivalDesignRegistry.resolveImage(festivalDesign);
      if (image) {
        const scale = Math.max(W / image.width, H / image.height);
        const drawW = image.width * scale;
        const drawH = image.height * scale;
        ctx.drawImage(image, (W - drawW) / 2, (H - drawH) / 2, drawW, drawH);
        const strength = festivalDesign.overlay === "light" ? 0.16 : festivalDesign.overlay === "dark" ? 0.54 : 0.34;
        const overlay = ctx.createLinearGradient(0, 0, 0, H);
        overlay.addColorStop(0, "rgba(8,6,12," + (strength * 0.42) + ")");
        overlay.addColorStop(0.44, "rgba(8,6,12," + strength + ")");
        overlay.addColorStop(1, "rgba(8,6,12," + Math.min(0.72, strength + 0.18) + ")");
        ctx.fillStyle = overlay;
        ctx.fillRect(0, 0, W, H);
        return;
      }
    }
    const design = OccasionRegistry.getDesign(
      project && project.occasion && project.occasion.id,
      project && project.content && project.content.emotion
    );

    if (design) {
      const size = quality === "preview" ? 160 : 256;
      const background = design.background;
      const grad = ctx.createLinearGradient(0, 0, 0, H);
      grad.addColorStop(0, background.top);
      grad.addColorStop(1, background.bottom);
      ctx.fillStyle = grad;
      ctx.fillRect(0, 0, W, H);

      const tile = getCachedTile(background.textureKey, size, (c) => generatePaperTile(c, size, background.textureTint));
      ctx.save();
      ctx.globalAlpha = background.textureAlpha;
      try {
        const pattern = ctx.createPattern(tile, "repeat");
        ctx.fillStyle = pattern;
        ctx.fillRect(0, 0, W, H);
      } catch (err) {}
      ctx.restore();

      if (background.aura) {
        const auraDef = background.aura;
        const aura = ctx.createRadialGradient(W / 2, H * auraDef.y0, auraDef.r0, W / 2, H * auraDef.y1, H * auraDef.r1);
        auraDef.stops.forEach((stop) => aura.addColorStop(stop[0], stop[1]));
        ctx.fillStyle = aura;
        ctx.fillRect(0, 0, W, H);
      }

      const vignetteDef = background.vignette;
      const vg = ctx.createRadialGradient(W / 2, H * vignetteDef.y0, H * vignetteDef.r0, W / 2, H * vignetteDef.y1, H * vignetteDef.r1);
      vignetteDef.stops.forEach((stop) => vg.addColorStop(stop[0], stop[1]));
      ctx.fillStyle = vg;
      ctx.fillRect(0, 0, W, H);
      return;
    }

    const grad = ctx.createLinearGradient(0, 0, 0, H);
    grad.addColorStop(0, theme.background.top);
    grad.addColorStop(1, theme.background.bottom);
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, W, H);

    if (theme.id === "pearl-marble") drawPearlMarbleSurface(ctx);
    else drawTexture(ctx, theme, quality);

    // Vignette / edge shading
    const vg = ctx.createRadialGradient(W / 2, H * 0.42, H * 0.25, W / 2, H * 0.5, H * 0.75);
    const vigColor = "0,0,0";
    vg.addColorStop(0, "rgba(" + vigColor + ",0)");
    vg.addColorStop(1, "rgba(" + vigColor + "," + theme.background.vignette + ")");
    ctx.fillStyle = vg;
    ctx.fillRect(0, 0, W, H);
  }

  /* ---------------- Luxury border & corner ornaments ----------------
     Anchored to the existing safe margin (LayoutEngine.SAFE_MARGIN) so the
     frame never encroaches on print bleed and always leaves the same
     clearance the text/photo layout already relies on — recipient name,
     greeting and the centrepiece never compete with it. Composited through
     the same mask-based foil pipeline as the recipient name and sender
     signature (compositeFoil, defined below), so every theme gets a real
     metallic sheen driven by that theme's own foil preset rather than a
     flat CSS-style outline. */
  const BORDER_MARGIN = LayoutEngine.SAFE_MARGIN;
  const BORDER_LINES = [
    { inset: 0, width: 3.2 },
    { inset: 10, width: 1.4 },
    { inset: 18, width: 1 },
  ];
  const BORDER_CORNER_SIZE = 96;

  function drawBorderLines(mctx) {
    mctx.save();
    mctx.fillStyle = "#fff";
    mctx.strokeStyle = "#fff";
    BORDER_LINES.forEach((line) => {
      const x = BORDER_MARGIN.x + line.inset;
      const y = BORDER_MARGIN.top + line.inset;
      const w = W - x - (BORDER_MARGIN.x + line.inset);
      const h = H - y - (BORDER_MARGIN.bottom + line.inset);
      mctx.lineWidth = line.width;
      mctx.strokeRect(x, y, w, h);
    });
    mctx.restore();
  }

  // A restrained botanical flourish authored for the top-left corner at a
  // reference size of 96px, mirrored into the other three corners by
  // scaling the context so all four stay perfectly symmetric.
  function drawCornerFlourish(mctx, size) {
    const u = size / 96;
    mctx.save();
    mctx.fillStyle = "#fff";
    mctx.strokeStyle = "#fff";
    mctx.lineCap = "round";

    mctx.lineWidth = 2.6 * u;
    mctx.beginPath();
    mctx.moveTo(6 * u, 40 * u);
    mctx.quadraticCurveTo(6 * u, 6 * u, 40 * u, 6 * u);
    mctx.stroke();

    mctx.lineWidth = 1.1 * u;
    mctx.beginPath();
    mctx.moveTo(14 * u, 54 * u);
    mctx.quadraticCurveTo(14 * u, 14 * u, 54 * u, 14 * u);
    mctx.stroke();

    function leaf(x, y, len, rot) {
      mctx.save();
      mctx.translate(x, y);
      mctx.rotate(rot);
      mctx.beginPath();
      mctx.moveTo(0, 0);
      mctx.bezierCurveTo(len * 0.4, -len * 0.3, len * 0.86, -len * 0.16, len, 0);
      mctx.bezierCurveTo(len * 0.86, len * 0.2, len * 0.4, len * 0.32, 0, 0);
      mctx.closePath();
      mctx.fill();
      mctx.restore();
    }
    leaf(24 * u, 24 * u, 30 * u, -0.78);
    leaf(44 * u, 9 * u, 20 * u, -0.1);
    leaf(9 * u, 44 * u, 20 * u, -1.48);

    mctx.beginPath();
    mctx.arc(24 * u, 24 * u, 3.4 * u, 0, Math.PI * 2);
    mctx.fill();
    mctx.restore();
  }

  function drawCorners(mctx) {
    const size = BORDER_CORNER_SIZE;
    const left = BORDER_MARGIN.x;
    const right = W - BORDER_MARGIN.x;
    const top = BORDER_MARGIN.top;
    const bottom = H - BORDER_MARGIN.bottom;
    const placements = [
      { x: left, y: top, sx: 1, sy: 1 },
      { x: right, y: top, sx: -1, sy: 1 },
      { x: left, y: bottom, sx: 1, sy: -1 },
      { x: right, y: bottom, sx: -1, sy: -1 },
    ];
    placements.forEach((p) => {
      mctx.save();
      mctx.translate(p.x, p.y);
      mctx.scale(p.sx, p.sy);
      drawCornerFlourish(mctx, size);
      mctx.restore();
    });
  }

  /* ---------------- Condolence Decorative Frames (Restrained & Mood-Aware) ---------------- */
  function drawCondolenceBorderLines(mctx, borderStyle) {
    mctx.save();
    mctx.fillStyle = "#fff";
    mctx.strokeStyle = "#fff";
    const x0 = BORDER_MARGIN.x;
    const y0 = BORDER_MARGIN.top;
    const w0 = W - x0 * 2;
    const h0 = H - y0 * 2;

    if (borderStyle === "professional") {
      // Clean, tailored double hairline frame
      mctx.lineWidth = 2.0;
      mctx.strokeRect(x0, y0, w0, h0);
      mctx.lineWidth = 1.0;
      mctx.strokeRect(x0 + 10, y0 + 10, w0 - 20, h0 - 20);
    } else if (borderStyle === "reverent") {
      // Classical dignified symmetrical stepped rule
      mctx.lineWidth = 2.4;
      mctx.strokeRect(x0, y0, w0, h0);
      mctx.lineWidth = 1.0;
      mctx.strokeRect(x0 + 14, y0 + 14, w0 - 28, h0 - 28);
      // Small dignified center diamonds on horizontal rules
      const cx = W / 2;
      function diamond(x, y, s) {
        mctx.beginPath();
        mctx.moveTo(x, y - s);
        mctx.lineTo(x + s, y);
        mctx.lineTo(x, y + s);
        mctx.lineTo(x - s, y);
        mctx.closePath();
        mctx.fill();
      }
      diamond(cx, y0 + 7, 5);
      diamond(cx, y0 + h0 - 7, 5);
    } else if (borderStyle === "comforting") {
      // Soft gentle rounded double border
      mctx.lineWidth = 2.0;
      roundRectPath(mctx, x0, y0, w0, h0, 24);
      mctx.stroke();
      mctx.lineWidth = 1.0;
      roundRectPath(mctx, x0 + 12, y0 + 12, w0 - 24, h0 - 24, 18);
      mctx.stroke();
    } else {
      // Heartfelt: refined dual frame with subtle inner pin-stripe
      mctx.lineWidth = 2.2;
      mctx.strokeRect(x0, y0, w0, h0);
      mctx.lineWidth = 1.0;
      mctx.strokeRect(x0 + 12, y0 + 12, w0 - 24, h0 - 24);
    }
    mctx.restore();
  }

  function drawCondolenceCorner(mctx, borderStyle, size) {
    const u = size / 96;
    mctx.save();
    mctx.fillStyle = "#fff";
    mctx.strokeStyle = "#fff";
    mctx.lineCap = "round";
    mctx.lineJoin = "round";

    if (borderStyle === "professional") {
      // Minimal crisp tailored corner bracket
      mctx.lineWidth = 2.0 * u;
      mctx.beginPath();
      mctx.moveTo(0, 36 * u);
      mctx.lineTo(0, 0);
      mctx.lineTo(36 * u, 0);
      mctx.stroke();

      mctx.lineWidth = 1.0 * u;
      mctx.beginPath();
      mctx.moveTo(10 * u, 28 * u);
      mctx.lineTo(10 * u, 10 * u);
      mctx.lineTo(28 * u, 10 * u);
      mctx.stroke();
    } else if (borderStyle === "reverent") {
      // Symmetrical stepped geometric miter corners
      mctx.lineWidth = 2.4 * u;
      mctx.beginPath();
      mctx.moveTo(0, 44 * u);
      mctx.lineTo(0, 16 * u);
      mctx.lineTo(16 * u, 0);
      mctx.lineTo(44 * u, 0);
      mctx.stroke();

      mctx.lineWidth = 1.2 * u;
      mctx.beginPath();
      mctx.moveTo(14 * u, 40 * u);
      mctx.lineTo(14 * u, 24 * u);
      mctx.lineTo(24 * u, 14 * u);
      mctx.lineTo(40 * u, 14 * u);
      mctx.stroke();

      mctx.beginPath();
      mctx.arc(20 * u, 20 * u, 3 * u, 0, Math.PI * 2);
      mctx.fill();
    } else if (borderStyle === "comforting") {
      // Gentle sweeping organic olive / foliage branch
      mctx.lineWidth = 1.8 * u;
      mctx.beginPath();
      mctx.moveTo(8 * u, 48 * u);
      mctx.quadraticCurveTo(8 * u, 8 * u, 48 * u, 8 * u);
      mctx.stroke();

      function comfortingLeaf(x, y, len, rot) {
        mctx.save();
        mctx.translate(x, y);
        mctx.rotate(rot);
        mctx.beginPath();
        mctx.moveTo(0, 0);
        mctx.bezierCurveTo(len * 0.4, -len * 0.25, len * 0.8, -len * 0.12, len, 0);
        mctx.bezierCurveTo(len * 0.8, len * 0.12, len * 0.4, len * 0.25, 0, 0);
        mctx.closePath();
        mctx.fill();
        mctx.restore();
      }
      comfortingLeaf(20 * u, 20 * u, 26 * u, -0.78);
      comfortingLeaf(38 * u, 12 * u, 18 * u, -0.15);
      comfortingLeaf(12 * u, 38 * u, 18 * u, -1.42);
      comfortingLeaf(48 * u, 8 * u, 14 * u, 0.2);
      comfortingLeaf(8 * u, 48 * u, 14 * u, -1.77);
    } else {
      // Heartfelt: delicate restrained floral / bud botanical flourish
      mctx.lineWidth = 2.0 * u;
      mctx.beginPath();
      mctx.moveTo(6 * u, 42 * u);
      mctx.quadraticCurveTo(6 * u, 6 * u, 42 * u, 6 * u);
      mctx.stroke();

      mctx.lineWidth = 1.0 * u;
      mctx.beginPath();
      mctx.moveTo(14 * u, 52 * u);
      mctx.quadraticCurveTo(14 * u, 14 * u, 52 * u, 14 * u);
      mctx.stroke();

      function delicatePetal(x, y, len, rot) {
        mctx.save();
        mctx.translate(x, y);
        mctx.rotate(rot);
        mctx.beginPath();
        mctx.moveTo(0, 0);
        mctx.bezierCurveTo(len * 0.35, -len * 0.28, len * 0.85, -len * 0.15, len, 0);
        mctx.bezierCurveTo(len * 0.85, len * 0.15, len * 0.35, len * 0.28, 0, 0);
        mctx.closePath();
        mctx.fill();
        mctx.restore();
      }
      delicatePetal(24 * u, 24 * u, 26 * u, -0.78);
      delicatePetal(42 * u, 10 * u, 18 * u, -0.12);
      delicatePetal(10 * u, 42 * u, 18 * u, -1.45);

      mctx.beginPath();
      mctx.arc(24 * u, 24 * u, 3.2 * u, 0, Math.PI * 2);
      mctx.fill();
    }
    mctx.restore();
  }

  function drawCondolenceCorners(mctx, borderStyle) {
    const size = BORDER_CORNER_SIZE;
    const left = BORDER_MARGIN.x;
    const right = W - BORDER_MARGIN.x;
    const top = BORDER_MARGIN.top;
    const bottom = H - BORDER_MARGIN.bottom;
    const placements = [
      { x: left, y: top, sx: 1, sy: 1 },
      { x: right, y: top, sx: -1, sy: 1 },
      { x: left, y: bottom, sx: 1, sy: -1 },
      { x: right, y: bottom, sx: -1, sy: -1 },
    ];
    placements.forEach((p) => {
      mctx.save();
      mctx.translate(p.x, p.y);
      mctx.scale(p.sx, p.sy);
      drawCondolenceCorner(mctx, borderStyle, size);
      mctx.restore();
    });
  }

  // Theme-aware luxury frame: a triple-line border plus four corner
  // flourishes for Birthday, or mood-tuned restrained geometry for Condolence.
  function renderLuxuryBorder(ctx, theme, quality, project) {
    const isCondolence = project && project.occasion && project.occasion.id === "condolence";
    const emotion = (project && project.content && project.content.emotion) || "heartfelt";
    const design = OccasionRegistry.getDesign(isCondolence ? "condolence" : "birthday", emotion);

    compositeFoil(ctx, W, H, (mctx) => {
      if (isCondolence) {
        drawCondolenceBorderLines(mctx, design.borderStyle);
        drawCondolenceCorners(mctx, design.borderStyle);
      } else {
        drawBorderLines(mctx);
        drawCorners(mctx);
      }
    }, {
      presetId: design ? design.borderPresetId : theme.foilPresetId,
      mode: "foil",
      intensity: design ? design.foil.intensity : 82,
      grain: design ? design.foil.grain : 28,
      highlight: design ? design.foil.highlight : 58,
      shadow: design ? design.foil.shadow : 52,
      quality,
    });
  }

  /* ---------------- Photographic celebration frame ----------------
     The reference cards place realistic celebration objects around the
     perimeter while preserving a calm centre for the portrait and copy.
     These decorations reuse the bundled transparent centrepiece assets,
     remain fully offline, and are clipped out of the live photo/text zones.
     Layout sliders therefore remain authoritative: changing portrait size,
     shape, text position, or text width also changes the exclusion mask. */
  const THEME_BORDER_DECOR = {
    "midnight-obsidian": [
      { id: "champagne-gala", x: 80, y: 230, size: 330, rot: -0.13, alpha: 0.82 },
      { id: "champagne-gala", x: 1120, y: 250, size: 315, rot: 0.12, alpha: 0.78, flip: true },
      { id: "silk-gift-box", x: 145, y: 1495, size: 260, rot: -0.08, alpha: 0.86 },
      { id: "velvet-roses", x: 1055, y: 1485, size: 260, rot: 0.12, alpha: 0.78, flip: true },
    ],
    "imperial-emerald": [
      { id: "velvet-roses", x: 75, y: 245, size: 320, rot: -0.18, alpha: 0.82 },
      { id: "velvet-roses", x: 1125, y: 305, size: 300, rot: 0.2, alpha: 0.72, flip: true },
      { id: "silk-gift-box", x: 140, y: 1495, size: 260, rot: -0.08, alpha: 0.9 },
      { id: "belgian-gold-cake", x: 1055, y: 1485, size: 270, rot: 0.05, alpha: 0.82 },
    ],
    "royal-burgundy": [
      { id: "velvet-roses", x: 70, y: 280, size: 350, rot: -0.2, alpha: 0.92 },
      { id: "velvet-roses", x: 1130, y: 370, size: 310, rot: 0.22, alpha: 0.82, flip: true },
      { id: "belgian-gold-cake", x: 145, y: 1490, size: 270, rot: -0.04, alpha: 0.82 },
      { id: "silk-gift-box", x: 1055, y: 1495, size: 255, rot: 0.08, alpha: 0.82, flip: true },
    ],
    "pearl-marble": [
      { id: "velvet-roses", x: 70, y: 265, size: 315, rot: -0.18, alpha: 0.72 },
      { id: "champagne-gala", x: 1130, y: 245, size: 300, rot: 0.13, alpha: 0.72, flip: true },
      { id: "velvet-roses", x: 140, y: 1495, size: 265, rot: -0.08, alpha: 0.7 },
      { id: "belgian-gold-cake", x: 1055, y: 1485, size: 275, rot: 0.04, alpha: 0.8 },
    ],
    "velvet-sapphire": [
      { id: "champagne-gala", x: 70, y: 250, size: 345, rot: -0.14, alpha: 0.9 },
      { id: "champagne-gala", x: 1130, y: 300, size: 325, rot: 0.14, alpha: 0.86, flip: true },
      { id: "silk-gift-box", x: 140, y: 1495, size: 265, rot: -0.08, alpha: 0.92 },
      { id: "belgian-gold-cake", x: 1055, y: 1490, size: 275, rot: 0.04, alpha: 0.86 },
    ],
    "amber-tuscan": [
      { id: "champagne-gala", x: 70, y: 255, size: 325, rot: -0.13, alpha: 0.76 },
      { id: "velvet-roses", x: 1130, y: 310, size: 315, rot: 0.2, alpha: 0.75, flip: true },
      { id: "belgian-gold-cake", x: 140, y: 1490, size: 275, rot: -0.04, alpha: 0.86 },
      { id: "silk-gift-box", x: 1055, y: 1495, size: 260, rot: 0.08, alpha: 0.84, flip: true },
    ],
  };

  // New Baby uses a restrained celebration frame: balloons remain as the
  // birth cue, while cake, gift boxes, and romantic rose clusters stay out
  // of the newborn composition.
  const NEW_BABY_THEME_DECOR = {
    "royal-burgundy": [
      { id: "champagne-gala", x: 82, y: 245, size: 325, rot: -0.13, alpha: 0.78 },
      { id: "champagne-gala", x: 1122, y: 270, size: 315, rot: 0.13, alpha: 0.74, flip: true },
    ],
    "amber-tuscan": [
      { id: "champagne-gala", x: 78, y: 245, size: 325, rot: -0.13, alpha: 0.8 },
      { id: "champagne-gala", x: 1125, y: 270, size: 315, rot: 0.13, alpha: 0.76, flip: true },
    ],
    "imperial-emerald": [
      { id: "champagne-gala", x: 78, y: 245, size: 325, rot: -0.13, alpha: 0.78 },
      { id: "champagne-gala", x: 1125, y: 270, size: 315, rot: 0.13, alpha: 0.74, flip: true },
    ],
  };

  // Personal occasions use their own quiet frame cue instead of inheriting
  // the birthday-party balloons, cake, gifts, or romantic roses from a theme.
  // The art zone and text lanes are still cleared below, so photos and manual
  // layout adjustments remain authoritative.
  function occasionCornerFrame(id) {
    return [
      { id, x: 120, y: 265, size: 250, rot: -0.12, alpha: 0.74 },
      { id, x: 1080, y: 1490, size: 250, rot: 0.12, alpha: 0.7, flip: true },
    ];
  }

  const OCCASION_BORDER_DECOR = {
    "congratulations": occasionCornerFrame("congratulations-laurel"),
    "new-home": occasionCornerFrame("new-home-welcome"),
    "graduation": occasionCornerFrame("graduation-diploma"),
    "retirement": occasionCornerFrame("retirement-compass"),
    "get-well": occasionCornerFrame("get-well-comfort"),
    "friendship-thanks": occasionCornerFrame("thanks-note"),
    "diwali": occasionCornerFrame("diwali-diyas"),
  };

  function getTextProtectionRegions(project) {
    const isCondolence = project && project.occasion && project.occasion.id === "condolence";
    const isNewBaby = project && project.occasion && project.occasion.id === "new-baby";
    const effective = getEffectiveTextStyle(project);
    const design = effective.design;
    const typography = effective.typography;
    const isTextLed = design && design.composition === "text-led";

    const pairing = effective.pairing;
    const margin = LayoutEngine.SAFE_MARGIN.x;
    const widthRatio = design ? design.textLayout.maxWidthRatio : (project.layout.textMaxWidth || pairing.maxTextWidthRatio || 0.8);
    const maxWidth = (W - margin * 2) * widthRatio;
    const maxShiftX = design ? 0 : LayoutEngine.getMaxTextShiftX(project.layout.textMaxWidth);
    const shiftX = design ? design.textLayout.shiftX : Utils.clamp(project.layout.textShiftX || 0, -maxShiftX, maxShiftX);
    const cx = W / 2 + shiftX;
    const geo = getArtGeometry(project);
    const signatureTop = H - 150;

    let blockTop;
    if (isTextLed) {
      blockTop = Utils.clamp(design.textLayout.blockTop, 280, signatureTop - 300);
    } else {
      const anchored = design ? 960 : 960 + (project.layout.textPosition - 0.62) * 400;
      const shift = design ? design.textLayout.shiftY : Utils.clamp(project.layout.textShift || 0, -90, 90);
      blockTop = Utils.clamp(Math.max(geo.bottom + 56, anchored) + shift, geo.bottom + 24, signatureTop - 170);
    }

    const measureCtx = document.createElement("canvas").getContext("2d");
    const regions = [];
    let cursorY = blockTop;

    // 1. Recipient Name region (tight actual rendered bounds)
    const recipientText = Utils.sanitizeText(project.recipient.name || "Dear Friend", 40);
    const recipientFit = LayoutEngine.fitText(measureCtx, {
      text: recipientText,
      fontFamily: pairing.recipientFont,
      weight: pairing.recipientWeight,
      maxSize: typography.recipientSize,
      minSize: 28,
      maxWidth,
      maxLines: 2,
      letterSpacingStart: typography.letterSpacing,
    });
    const recipientLineHeight = recipientFit.size * (typography.lineHeight || pairing.lineHeight);
    const recipientHeight = recipientFit.lines.length * recipientLineHeight;
    const recipientWidth = Math.max(160, recipientFit.maxLineWidth + 32);
    regions.push({
      x: cx - recipientWidth / 2,
      y: cursorY - 12,
      width: recipientWidth,
      height: recipientHeight + 24,
      radius: 18,
    });
    cursorY += recipientHeight + (isCondolence ? 34 : 26);

    // 2. Greeting + optional relationship copy region
    const greetingValidation = GreetingGenerator.validateProjectGreeting(project);
    const greetingText = greetingValidation.safe
      ? Utils.truncateProse(greetingValidation.text || "", GREETING_MAX_CHARS)
      : "";
    let greetingWidth = 0;
    let greetingHeight = 0;
    const greetingTop = cursorY;

    if (greetingText) {
      const availableHeight = Math.max(1.5 * 15, signatureTop - 46 - cursorY);
      const linesThatFit = (size) => Math.max(1, Math.floor(availableHeight / (size * 1.5)));
      let greetingFit = LayoutEngine.fitText(measureCtx, {
        text: greetingText,
        fontFamily: pairing.greetingFont,
        weight: pairing.greetingWeight,
        maxSize: typography.greetingSize,
        minSize: 15,
        maxWidth: maxWidth * 0.92,
        maxLines: linesThatFit(15),
        letterSpacingStart: 0,
      });
      const heightLimit = linesThatFit(greetingFit.size);
      if (greetingFit.lines.length > heightLimit) {
        greetingFit = LayoutEngine.clampResult(measureCtx, greetingFit, {
          fontFamily: pairing.greetingFont,
          weight: pairing.greetingWeight,
          maxWidth: maxWidth * 0.92,
          maxLines: heightLimit,
          letterSpacing: 0,
        });
      }
      const greetingLineRatio = isCondolence ? 1.6 : 1.5;
      const greetingLineHeight = greetingFit.size * greetingLineRatio;
      greetingHeight = greetingFit.lines.length * greetingLineHeight;
      greetingWidth = greetingFit.maxLineWidth + 32;
      cursorY += greetingHeight + (isCondolence ? 28 : 20);
      if (isNewBaby) cursorY += 34;
    }

    const relationship = Utils.sanitizeText(project.recipient.relationship || "", 40);
    let relationshipWidth = 0;
    if (relationship) {
      measureCtx.font = "500 20px " + pairing.supportFont;
      relationshipWidth = measureCtx.measureText(relationship.toUpperCase()).width + 36;
      cursorY += isNewBaby ? 34 : 46;
    }

    if (greetingHeight > 0 || relationship) {
      const blockWidth = Math.max(180, Math.max(greetingWidth, relationshipWidth));
      const totalBlockHeight = (greetingHeight > 0 ? greetingHeight : 0) + (relationship ? 46 : 0) + (greetingHeight > 0 ? 16 : 24);
      regions.push({
        x: cx - blockWidth / 2,
        y: greetingTop - 10,
        width: blockWidth,
        height: totalBlockHeight,
        radius: 22,
      });
    }

    // 3. Sender signature region (if present)
    const senderText = Utils.sanitizeText(project.sender.name || "", 40).replace(/\s*&\s*/g, " & ");
    if (senderText) {
      const signY = isNewBaby ? cursorY + 28 : Math.max(cursorY + (isCondolence ? 42 : 30), signatureTop);
      const senderFit = LayoutEngine.fitText(measureCtx, {
        text: "— " + senderText,
        fontFamily: pairing.signatureFont,
        weight: "500",
        maxSize: typography.senderSize,
        minSize: 14,
        maxWidth: maxWidth * 0.7,
        maxLines: 1,
        letterSpacingStart: 0.4,
      });
      const senderWidth = Math.max(140, senderFit.maxLineWidth + 28);
      const senderHeight = senderFit.size * 1.4 + 16;
      regions.push({
        x: cx - senderWidth / 2,
        y: signY - senderFit.size - 8,
        width: senderWidth,
        height: senderHeight,
        radius: 16,
      });
    }

    return regions;
  }

  function drawBorderAsset(dctx, image, spec) {
    const size = spec.size;
    dctx.save();
    dctx.translate(spec.x, spec.y);
    dctx.rotate(spec.rot || 0);
    dctx.scale(spec.flip ? -1 : 1, 1);
    dctx.globalAlpha = spec.alpha == null ? 1 : spec.alpha;
    dctx.shadowColor = "rgba(0,0,0,0.24)";
    dctx.shadowBlur = 18;
    dctx.shadowOffsetY = 10;
    dctx.drawImage(image, -size / 2, -size / 2, size, size);
    dctx.restore();
  }

  async function renderThemeBorderDecorations(ctx, project, theme) {
    const occasionId = project && project.occasion && project.occasion.id;
    const isCondolence = occasionId === "condolence";
    const isNewBaby = occasionId === "new-baby";
    const emotion = (project && project.content && project.content.emotion) || "heartfelt";
    const design = OccasionRegistry.getDesign(occasionId, emotion);
    const occasionSpecs = OCCASION_BORDER_DECOR[occasionId];
    const specs = design
      ? design.decorations
      : (isNewBaby
        ? (NEW_BABY_THEME_DECOR[theme.id] || NEW_BABY_THEME_DECOR["amber-tuscan"])
        : (occasionSpecs || THEME_BORDER_DECOR[theme.id] || THEME_BORDER_DECOR["pearl-marble"]));

    const uniqueIds = Array.from(new Set(specs.map((spec) => spec.id)));
    const loaded = await Promise.all(uniqueIds.map(async (id) => [id, await CenterpieceAssetResolver.resolve(id)]));
    const images = new Map(loaded);
    if (!loaded.some((entry) => entry[1])) return;

    const layer = createWorkCanvas(W, H);
    const dctx = layer.getContext("2d");
    specs.forEach((spec) => {
      const image = images.get(spec.id);
      if (image) drawBorderAsset(dctx, image, spec);
    });

    if (!isCondolence) {
      // Hard-clear the portrait/centrepiece plus a generous halo around its
      // frame. The text lane clears only the actual tight bounds of each text group.
      dctx.save();
      dctx.globalCompositeOperation = "destination-out";
      dctx.fillStyle = "#fff";
      const art = getArtGeometry(project);
      artPath(dctx, art, -42);
      dctx.fill();
      const regions = getTextProtectionRegions(project);
      regions.forEach((r) => {
        roundRectPath(dctx, r.x, r.y, r.width, r.height, r.radius || 20);
        dctx.fill();
      });
      dctx.restore();
    }

    ctx.save();
    ctx.drawImage(layer, 0, 0);
    ctx.restore();
  }

  /* ---------------- 5-6: Centerpiece / photo + frame ---------------- */
  function roundRectPath(ctx, x, y, w, h, r) {
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.arcTo(x + w, y, x + w, y + h, r);
    ctx.arcTo(x + w, y + h, x, y + h, r);
    ctx.arcTo(x, y + h, x, y, r);
    ctx.arcTo(x, y, x + w, y, r);
    ctx.closePath();
  }

  // Art region geometry, driven by the layout-balance controls. The circle
  // is the default mask (the "portrait medallion"); `rect` keeps the older
  // framed-rectangle look. Both are centred horizontally and anchored near
  // the top of the safe zone so the text block below can grow downward.
  const ART_TOP = 148;
  function getEffectiveTextStyle(project) {
    const occasionId = (project.occasion && project.occasion.id) || "birthday";
    const design = OccasionRegistry.getDesign(occasionId, project.content && project.content.emotion);
    const typography = design ? design.typography : project.typography;
    return { design, typography, pairing: FontPairings.getPairing(typography.pairingId) };
  }

  function getArtGeometry(project) {
    const layout = (project && project.layout) || {};
    const design = OccasionRegistry.getDesign(
      project && project.occasion && project.occasion.id,
      project && project.content && project.content.emotion
    );
    const geometry = design ? design.geometry : null;
    const shapeValue = geometry ? geometry.shape : layout.photoShape;
    const shape = shapeValue === "rect" ? "rect" : "circle";
    const size = Utils.clamp(geometry ? geometry.centerpieceSize : (layout.centerpieceSize || 620), 320, 760);
    const cx = W / 2;
    if (shape === "rect") {
      const width = Math.min(W - 300, size * 1.32);
      const height = size * 0.92;
      return {
        shape, cx, cy: ART_TOP + height / 2, r: Math.min(width, height) / 2,
        x: cx - width / 2, y: ART_TOP, width, height, bottom: ART_TOP + height,
      };
    }
    const r = size / 2;
    return {
      shape, cx, cy: ART_TOP + r, r,
      x: cx - r, y: ART_TOP, width: size, height: size, bottom: ART_TOP + size,
    };
  }

  function artPath(ctx, geo, inset) {
    const i = inset || 0;
    if (geo.shape === "rect") {
      roundRectPath(ctx, geo.x + i, geo.y + i, geo.width - i * 2, geo.height - i * 2, 18);
    } else {
      ctx.beginPath();
      ctx.arc(geo.cx, geo.cy, geo.r - i, 0, Math.PI * 2);
      ctx.closePath();
    }
  }

  async function renderCenterpieceFallback(ctx, project, theme, geo, monogram) {
    const design = OccasionRegistry.getDesign(
      project.occasion && project.occasion.id,
      project.content && project.content.emotion
    );
    await Centerpieces.paint(ctx, { cx: geo.cx, cy: geo.cy, r: Math.max(geo.width, geo.height) / 2 }, {
      id: design && design.centerpieceId ? design.centerpieceId : ((project.layout && project.layout.centerpieceId) || "auto"),
      emotion: project.content.emotion,
      occasionId: (project.occasion && project.occasion.id) || "birthday",
      theme,
      monogram,
    });
  }

  function withAlphaHex(hex, a) {
    const h = String(hex || "#000").replace("#", "");
    const n = h.length === 3 ? h.split("").map((c) => c + c).join("") : h;
    const r = parseInt(n.slice(0, 2), 16) || 0;
    const g = parseInt(n.slice(2, 4), 16) || 0;
    const b = parseInt(n.slice(4, 6), 16) || 0;
    return "rgba(" + r + "," + g + "," + b + "," + a + ")";
  }

  // Soft radial glow fully behind the medallion — this is what stops the
  // card reading as "a photo floating over an empty background". Drawn
  // before the medallion's own shadow/clip/content, so it is invisible
  // wherever the opaque photo or centrepiece artwork actually covers it;
  // it only shows in the surrounding dead space.
  function drawMedallionHalo(ctx, theme, geo, color) {
    const maxR = Math.max(geo.width, geo.height) / 2;
    const haloColor = color || theme.palette.secondary;
    const g = ctx.createRadialGradient(geo.cx, geo.cy, maxR * 0.55, geo.cx, geo.cy, maxR * 1.55);
    g.addColorStop(0, withAlphaHex(haloColor, 0.22));
    g.addColorStop(0.55, withAlphaHex(haloColor, 0.08));
    g.addColorStop(1, withAlphaHex(haloColor, 0));
    ctx.save();
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.arc(geo.cx, geo.cy, maxR * 1.55, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }

  function drawSparkle(ctx, x, y, r) {
    ctx.save();
    ctx.translate(x, y);
    ctx.beginPath();
    ctx.moveTo(0, -r);
    ctx.quadraticCurveTo(r * 0.18, -r * 0.18, r, 0);
    ctx.quadraticCurveTo(r * 0.18, r * 0.18, 0, r);
    ctx.quadraticCurveTo(-r * 0.18, r * 0.18, -r, 0);
    ctx.quadraticCurveTo(-r * 0.18, -r * 0.18, 0, -r);
    ctx.closePath();
    ctx.fill();
    ctx.restore();
  }

  // A fourth, further-out ring plus a handful of deterministic foil-fleck
  // sparkles just outside the frame, so the medallion reads as a composed
  // editorial centrepiece rather than a circle pasted onto empty space.
  // Seeded so preview and export always match. Everything here is drawn
  // OUTSIDE the mask the photo/centrepiece is clipped to, so it can only
  // ever surround the photo, never obscure it.
  function drawMedallionAccents(mctx, geo) {
    mctx.save();
    mctx.fillStyle = "#fff";
    mctx.strokeStyle = "#fff";
    mctx.lineWidth = 1.6;
    artPath(mctx, geo, -16);
    mctx.stroke();

    const rand = mulberry32(9001);
    const baseR = Math.max(geo.width, geo.height) / 2 + 26;
    const count = 9;
    for (let i = 0; i < count; i++) {
      const a = (i / count) * Math.PI * 2 + rand() * 0.4;
      const rr = baseR + rand() * 20;
      const x = geo.cx + Math.cos(a) * rr;
      const y = geo.cy + Math.sin(a) * rr * (geo.shape === "rect" ? 1.12 : 1);
      drawSparkle(mctx, x, y, 4 + rand() * 5);
    }
    mctx.restore();
  }

  async function renderPhoto(ctx, project, theme, photoImage, monogram, quality) {
    if (FestivalDesignRegistry.isFestival(project.occasion && project.occasion.id)) {
      return;
    }
    const isCondolence = project.occasion && project.occasion.id === "condolence";
    const emotion = (project.content && project.content.emotion) || "heartfelt";
    const design = OccasionRegistry.getDesign(isCondolence ? "condolence" : "birthday", emotion);
    const isTextLed = design && design.composition === "text-led";

    if (isTextLed) {
      // In Comforting, Reverent and Professional Condolence cards, the circular medallion placeholder
      // is completely omitted in favour of an intentional full-card botanical / text-led composition.
      return;
    }

    const geo = getArtGeometry(project);

    drawMedallionHalo(ctx, theme, geo, design && design.haloColor);

    // Cast shadow behind the medallion
    ctx.save();
    ctx.shadowColor = "rgba(0,0,0,0.55)";
    ctx.shadowBlur = 46;
    ctx.shadowOffsetY = 20;
    artPath(ctx, geo);
    ctx.fillStyle = "rgba(0,0,0,0.001)";
    ctx.fill();
    ctx.restore();

    // A tailored dark mat gives pale card stock enough separation from
    // bright photographs and prevents the image from overpowering the
    // metallic frame on Pearl Marble.
    const isHeartfelt = isCondolence && emotion === "heartfelt";
    if (theme.background.light && !isCondolence) {
      ctx.save();
      artPath(ctx, geo, -9);
      ctx.lineWidth = 20;
      ctx.strokeStyle = "rgba(63,39,19,0.84)";
      ctx.shadowColor = "rgba(45,27,12,0.28)";
      ctx.shadowBlur = 20;
      ctx.shadowOffsetY = 8;
      ctx.stroke();
      ctx.restore();
    }

    // Masked content
    ctx.save();
    artPath(ctx, geo);
    ctx.clip();

    const allowPhoto = OccasionRegistry.allowsPhoto((project.occasion && project.occasion.id) || "birthday");
    if (photoImage && allowPhoto) {
      const p = project.photo || {};
      const rotation = ((p.rotation || 0) * Math.PI) / 180;
      ctx.save();
      ctx.translate(geo.cx, geo.cy);
      ctx.rotate(rotation);

      // Cover the mask, then expand by |cos|+|sin| so a rotated photo can
      // never expose an empty corner inside the mask.
      const cover = Math.max(geo.width / photoImage.width, geo.height / photoImage.height);
      const rotationSafe = Math.abs(Math.cos(rotation)) + Math.abs(Math.sin(rotation));
      const zoom = Utils.clamp(p.zoom || 1, 1, 3) * Utils.clamp(project.layout.photoScale || 1, 0.5, 2);
      const scale = cover * rotationSafe * zoom;
      const drawW = photoImage.width * scale;
      const drawH = photoImage.height * scale;

      // In rotated local coordinates, calculate the enclosing box of the mask:
      const maskRotW = geo.width * Math.abs(Math.cos(rotation)) + geo.height * Math.abs(Math.sin(rotation));
      const maskRotH = geo.width * Math.abs(Math.sin(rotation)) + geo.height * Math.abs(Math.cos(rotation));

      // Pan is expressed as -1..1 of the available travel slack, guaranteeing
      // zero exposure of empty mask areas at any zoom level or rotation angle.
      const slackX = Math.max(0, (drawW - maskRotW) / 2);
      const slackY = Math.max(0, (drawH - maskRotH) / 2);
      const panX = Utils.clamp(p.panX || 0, -1, 1) * slackX;
      const panY = Utils.clamp(p.panY || 0, -1, 1) * slackY;

      ctx.drawImage(photoImage, -drawW / 2 + panX, -drawH / 2 + panY, drawW, drawH);
      ctx.restore();
    } else {
      await renderCenterpieceFallback(ctx, project, theme, geo, monogram);
    }
    ctx.restore();

    // Embossed metallic ring: bevel highlight top-left, shadow bottom-right,
    // plus an inner gold hairline.
    ctx.save();
    artPath(ctx, geo, 3);
    ctx.lineWidth = 7;
    const frameGrad = ctx.createLinearGradient(geo.x, geo.y, geo.x + geo.width, geo.y + geo.height);
    frameGrad.addColorStop(0, isHeartfelt ? "rgba(255,255,255,0.7)" : "rgba(255,255,255,0.6)");
    frameGrad.addColorStop(0.35, isHeartfelt ? "#d4af37" : theme.palette.secondary);
    frameGrad.addColorStop(0.62, isHeartfelt ? "rgba(255,246,210,0.9)" : "rgba(255,246,210,0.85)");
    frameGrad.addColorStop(1, isHeartfelt ? "rgba(160,120,40,0.5)" : "rgba(0,0,0,0.45)");
    ctx.strokeStyle = frameGrad;
    ctx.stroke();

    artPath(ctx, geo, 10);
    ctx.lineWidth = 1.6;
    ctx.strokeStyle = isHeartfelt ? "rgba(232,199,119,0.65)" : "rgba(232,199,119,0.55)";
    ctx.stroke();

    artPath(ctx, geo, -6);
    ctx.lineWidth = 1.2;
    ctx.strokeStyle = isHeartfelt ? "rgba(180,140,80,0.3)" : "rgba(0,0,0,0.35)";
    ctx.stroke();
    ctx.restore();

    // Layered gold ring + sparkle flecks, composited through the same
    // metallic foil pipeline as the rest of the card's chrome.
    compositeFoil(ctx, W, H, (mctx) => drawMedallionAccents(mctx, geo), {
      presetId: design ? design.borderPresetId : theme.foilPresetId, mode: "foil", intensity: 70,
      grain: 20, highlight: 55, shadow: 40, quality,
    });
  }

  /* ---------------- Foil / Emboss / Deboss compositor ---------------- */
  function blurCanvas(canvas, radius) {
    const ctx = canvas.getContext("2d");
    if ("filter" in ctx) {
      const w = canvas.width, h = canvas.height;
      const tmp = createWorkCanvas(w, h);
      const tctx = tmp.getContext("2d");
      tctx.filter = "blur(" + radius + "px)";
      tctx.drawImage(canvas, 0, 0);
      ctx.clearRect(0, 0, w, h);
      ctx.drawImage(tmp, 0, 0);
    }
    return canvas;
  }

  // Render `drawGlyphs(maskCtx)` (a function that fills the desired shape
  // in solid white/black onto the given 2D context) through the mask-based
  // foil pipeline: metallic multi-stop gradient fill -> grain multiply ->
  // blurred highlight offset -> darker bevel-shadow offset -> composite
  // onto the destination with screen/multiply/overlay where supported,
  // falling back to plain alpha compositing otherwise. Deterministic (no
  // randomness beyond the seeded grain tile) so preview and export match.
  function compositeFoil(destCtx, w, h, drawGlyphs, opts) {
    const preset = FoilPresets.getPreset(opts.presetId);
    const mode = opts.mode || "foil";
    const intensity = Utils.clamp(opts.intensity, 0, 100) / 100;
    const grainAmt = Utils.clamp(opts.grain, 0, 100) / 100;
    const highlightAmt = Utils.clamp(opts.highlight, 0, 100) / 100;
    const shadowAmt = Utils.clamp(opts.shadow, 0, 100) / 100;
    const blendOk = supportsBlendModes();

    // 1. Mask
    const mask = createWorkCanvas(w, h);
    const maskCtx = mask.getContext("2d");
    drawGlyphs(maskCtx);

    // 2. Metallic fill (or flat tone for emboss/deboss)
    const fill = createWorkCanvas(w, h);
    const fillCtx = fill.getContext("2d");
    if (mode === "foil") {
      const grad = fillCtx.createLinearGradient(0, 0, w, h);
      preset.stops.forEach((s) => grad.addColorStop(s.t, s.c));
      fillCtx.fillStyle = grad;
    } else {
      // Emboss/deboss: a muted single tone close to the preset's mid stop,
      // since these finishes read as relief rather than metallic color.
      fillCtx.fillStyle = preset.stops[Math.floor(preset.stops.length / 2)].c;
    }
    fillCtx.fillRect(0, 0, w, h);
    fillCtx.globalCompositeOperation = "destination-in";
    fillCtx.drawImage(mask, 0, 0);
    fillCtx.globalCompositeOperation = "source-over";

    // 3. Grain multiply
    if (grainAmt > 0) {
      const grainTile = getCachedTile("grain-fine", 128, (c) => generateGrainTile(c, 128, 42, 1));
      const grainLayer = createWorkCanvas(w, h);
      const gctx = grainLayer.getContext("2d");
      try {
        const pattern = gctx.createPattern(grainTile, "repeat");
        gctx.fillStyle = pattern;
        gctx.fillRect(0, 0, w, h);
      } catch (err) { /* ignore */ }
      gctx.globalCompositeOperation = "destination-in";
      gctx.drawImage(mask, 0, 0);
      fillCtx.save();
      fillCtx.globalAlpha = grainAmt * 0.5;
      fillCtx.globalCompositeOperation = blendOk ? "multiply" : "source-atop";
      fillCtx.drawImage(grainLayer, 0, 0);
      fillCtx.restore();
    }

    // 4. Highlight (blurred, offset toward light source, screen blend)
    const offset = mode === "deboss" ? -1 : 1;
    if (highlightAmt > 0) {
      const hi = createWorkCanvas(w, h);
      const hctx = hi.getContext("2d");
      hctx.fillStyle = preset.highlight;
      hctx.globalCompositeOperation = "source-over";
      hctx.drawImage(mask, -2 * offset, -2 * offset);
      hctx.globalCompositeOperation = "source-in";
      hctx.fillRect(0, 0, w, h);
      blurCanvas(hi, opts.quality === "preview" ? 1.5 : 2.5);
      fillCtx.save();
      fillCtx.globalAlpha = highlightAmt * intensity;
      fillCtx.globalCompositeOperation = blendOk ? "screen" : "lighter";
      fillCtx.drawImage(hi, 0, 0);
      fillCtx.restore();
    }

    // 5. Bevel shadow (blurred, offset away from light, multiply blend)
    if (shadowAmt > 0) {
      const sh = createWorkCanvas(w, h);
      const sctx = sh.getContext("2d");
      sctx.fillStyle = preset.shadow;
      sctx.drawImage(mask, 2 * offset, 2 * offset);
      sctx.globalCompositeOperation = "source-in";
      sctx.fillRect(0, 0, w, h);
      blurCanvas(sh, opts.quality === "preview" ? 1.5 : 2.5);
      fillCtx.save();
      fillCtx.globalAlpha = shadowAmt * intensity;
      fillCtx.globalCompositeOperation = blendOk ? "multiply" : "source-atop";
      fillCtx.drawImage(sh, 0, 0);
      fillCtx.restore();
    }

    // 6. Deboss: also darken the recess itself so it reads as pressed in
    if (mode === "deboss") {
      fillCtx.save();
      fillCtx.globalAlpha = 0.35;
      fillCtx.globalCompositeOperation = blendOk ? "multiply" : "source-atop";
      fillCtx.fillStyle = "#000000";
      fillCtx.fillRect(0, 0, w, h);
      fillCtx.globalCompositeOperation = "destination-in";
      fillCtx.drawImage(mask, 0, 0);
      fillCtx.restore();
    }

    destCtx.drawImage(fill, 0, 0);
  }

  /* ---------------- 7-13: Text + stamps ---------------- */
  function textBoxToLayoutBox(id, cx, topY, width, height, priority) {
    return { id, x: cx - width / 2, y: topY, width, height, priority, movable: false };
  }

  async function renderTextLayers(ctx, project, theme, pairing, diagnostics, quality) {
    const effective = getEffectiveTextStyle(project);
    const design = effective.design;
    const typography = effective.typography;
    pairing = effective.pairing;
    const margin = LayoutEngine.SAFE_MARGIN.x;
    const widthRatio = design ? design.textLayout.maxWidthRatio : (project.layout.textMaxWidth || pairing.maxTextWidthRatio || 0.8);
    const maxWidth = (W - margin * 2) * widthRatio;
    const maxShiftX = design ? 0 : LayoutEngine.getMaxTextShiftX(project.layout.textMaxWidth);
    const shiftX = design ? design.textLayout.shiftX : Utils.clamp(project.layout.textShiftX || 0, -maxShiftX, maxShiftX);
    const cx = W / 2 + shiftX;

    // The text block starts below the centrepiece (or centered for text-led condolence),
    // and is then nudged by the layout-balance shift.
    const geo = getArtGeometry(project);
    const signatureTop = H - 150;
    const isCondolence = project.occasion && project.occasion.id === "condolence";
    const isNewBaby = project.occasion && project.occasion.id === "new-baby";
    const isTextLed = design && design.composition === "text-led";

    let blockTop;
    if (isTextLed) {
      blockTop = Utils.clamp(design.textLayout.blockTop, 280, signatureTop - 300);
    } else {
      const anchored = design ? 960 : 960 + (project.layout.textPosition - 0.62) * 400;
      const shift = design ? design.textLayout.shiftY : Utils.clamp(project.layout.textShift || 0, -90, 90);
      blockTop = Utils.clamp(
        Math.max(geo.bottom + 56, anchored) + shift,
        geo.bottom + 24,
        signatureTop - 170
      );
    }

    const measureCtx = document.createElement("canvas").getContext("2d");

    let cursorY = blockTop;
    const boxes = [];

    let textColor = theme.palette.text;
    let mutedColor = theme.palette.mutedText;
    let signatureColor = theme.palette.mutedText;
    let recipientPreset = project.foil.presetId;

    if (design) {
      recipientPreset = design.recipientPresetId;
      textColor = design.palette.text;
      mutedColor = design.palette.muted;
      signatureColor = design.palette.signature;
    }

    // Recipient name (highest text priority)
    const recipientText = Utils.sanitizeText(project.recipient.name || "Dear Friend", 40);
    const recipientFit = LayoutEngine.fitText(measureCtx, {
      text: recipientText,
      fontFamily: pairing.recipientFont,
      weight: pairing.recipientWeight,
      maxSize: typography.recipientSize,
      minSize: 28,
      maxWidth,
      maxLines: 2,
      letterSpacingStart: typography.letterSpacing,
    });
    if (recipientFit.overflow) diagnostics.textOverflow = true;
    if (recipientFit.clamped) diagnostics.textClamped = true;

    const recipientMask = createWorkCanvas(W, H);
    const rmCtx = recipientMask.getContext("2d");
    rmCtx.fillStyle = "#fff";
    const recipientLineHeight = recipientFit.size * (typography.lineHeight || pairing.lineHeight);
    LayoutEngine.drawLines(rmCtx, recipientFit.lines, {
      fontFamily: pairing.recipientFont, weight: pairing.recipientWeight,
      size: recipientFit.size, letterSpacing: recipientFit.letterSpacing,
      lineHeight: (typography.lineHeight || pairing.lineHeight),
      cx, startY: cursorY + recipientFit.size * 0.85,
    });
    const recipientHeight = recipientFit.lines.length * recipientLineHeight;
    boxes.push(textBoxToLayoutBox("recipient-name", cx, cursorY, recipientFit.maxLineWidth, recipientHeight, 100));
    compositeFoil(ctx, W, H, (mctx) => mctx.drawImage(recipientMask, 0, 0), {
      presetId: recipientPreset,
      mode: design ? design.foil.mode : project.foil.mode,
      intensity: design ? design.foil.intensity : project.foil.intensity,
      grain: design ? design.foil.grain : project.foil.grain,
      highlight: design ? design.foil.highlight : project.foil.highlight,
      shadow: design ? design.foil.shadow : project.foil.shadow,
      quality,
    });
    cursorY += recipientHeight + (isCondolence ? 34 : 26);

    // Greeting
    const greetingValidation = GreetingGenerator.validateProjectGreeting(project);
    if (!greetingValidation.safe) diagnostics.unsafeGreeting = true;
    // truncateProse (not the plain sanitizeText slice used elsewhere) so
    // content that arrives already over GREETING_MAX_CHARS — an imported
    // backup from a different app version, for instance — backs up to a
    // word boundary and gets an ellipsis instead of stopping mid-word with
    // no indication anything was cut.
    const greetingText = greetingValidation.safe
      ? Utils.truncateProse(greetingValidation.text || "", GREETING_MAX_CHARS)
      : "";
    if (greetingText) {
      const GREETING_LINE_RATIO = 1.5;
      const greetingMinSize = 15;
      // Vertical room between here and the signature, converted to a line
      // budget. Using the smallest permitted size gives the most generous
      // budget; the height check below tightens it for whatever size wins.
      const availableHeight = Math.max(GREETING_LINE_RATIO * greetingMinSize, signatureTop - 46 - cursorY);
      const linesThatFit = (size) => Math.max(1, Math.floor(availableHeight / (size * GREETING_LINE_RATIO)));

      let greetingFit = LayoutEngine.fitText(measureCtx, {
        text: greetingText,
        fontFamily: pairing.greetingFont,
        weight: pairing.greetingWeight,
        maxSize: typography.greetingSize,
        minSize: greetingMinSize,
        maxWidth: maxWidth * 0.92,
        maxLines: linesThatFit(greetingMinSize),
        letterSpacingStart: 0,
      });

      // Second pass: the chosen size may allow fewer lines than the budget
      // computed at minimum size, so clamp to the real limit.
      const heightLimit = linesThatFit(greetingFit.size);
      if (greetingFit.lines.length > heightLimit) {
        greetingFit = LayoutEngine.clampResult(measureCtx, greetingFit, {
          fontFamily: pairing.greetingFont,
          weight: pairing.greetingWeight,
          maxWidth: maxWidth * 0.92,
          maxLines: heightLimit,
          letterSpacing: 0,
        });
      }
      if (greetingFit.overflow) diagnostics.textOverflow = true;
      if (greetingFit.clamped) diagnostics.textClamped = true;
      ctx.save();
      ctx.fillStyle = textColor;
      const greetingLineRatio = isCondolence ? 1.6 : 1.5;
      const greetingLineHeight = greetingFit.size * greetingLineRatio;
      LayoutEngine.drawLines(ctx, greetingFit.lines, {
        fontFamily: pairing.greetingFont, weight: pairing.greetingWeight,
        size: greetingFit.size, letterSpacing: 0, lineHeight: greetingLineRatio,
        cx, startY: cursorY + greetingFit.size * 0.85,
      });
      ctx.restore();
      const greetingHeight = greetingFit.lines.length * greetingLineHeight;
      boxes.push(textBoxToLayoutBox("greeting", cx, cursorY, greetingFit.maxLineWidth, greetingHeight, 90));
      cursorY += greetingHeight + (isCondolence ? 28 : 20);
      if (isNewBaby) {
        ctx.save();
        ctx.fillStyle = mutedColor;
        ctx.font = "500 30px 'Segoe UI Emoji', 'Noto Color Emoji', sans-serif";
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        ctx.fillText("🧿♥️", cx, cursorY + 8);
        ctx.restore();
        boxes.push(textBoxToLayoutBox("new-baby-emoji", cx, cursorY - 10, 120, 34, 85));
        cursorY += 34;
      }
    }

    // Supporting copy (relationship line) — small, quiet, optional
    const relationship = Utils.sanitizeText(project.recipient.relationship || "", 40);
    if (relationship) {
      ctx.save();
      ctx.fillStyle = mutedColor;
      ctx.font = "500 20px " + pairing.supportFont;
      ctx.textAlign = "center";
      ctx.globalAlpha = 0.85;
      ctx.fillText(relationship.toUpperCase(), cx, cursorY + 16);
      ctx.restore();
      boxes.push(textBoxToLayoutBox("support-copy", cx, cursorY - 6, 300, 30, 70));
      cursorY += isNewBaby ? 34 : 46;
    }

    // Sender signature — pinned near the bottom, never overlapping name/greeting
    const senderText = Utils.sanitizeText(project.sender.name || "", 40).replace(/\s*&\s*/g, " & ");
    if (senderText) {
      const signY = isNewBaby ? cursorY + 28 : Math.max(cursorY + (isCondolence ? 42 : 30), H - 150);
      const senderFit = LayoutEngine.fitText(measureCtx, {
        text: "— " + senderText,
        fontFamily: pairing.signatureFont,
        weight: "500",
        maxSize: typography.senderSize,
        minSize: 14,
        maxWidth: maxWidth * 0.7,
        maxLines: 1,
        letterSpacingStart: 0.4,
      });
      if (senderFit.overflow) diagnostics.textOverflow = true;
      if (senderFit.clamped) diagnostics.textClamped = true;
      boxes.push(textBoxToLayoutBox("sender-signature", cx, signY - senderFit.size, senderFit.maxLineWidth, senderFit.size * 1.3, 95));
      if (isCondolence || (theme.background && theme.background.light)) {
        ctx.save();
        ctx.fillStyle = signatureColor;
        LayoutEngine.drawLines(ctx, senderFit.lines, {
          fontFamily: pairing.signatureFont, weight: "500",
          size: senderFit.size, letterSpacing: senderFit.letterSpacing, lineHeight: 1.3,
          cx, startY: signY,
        });
        ctx.restore();
      } else {
        const senderMask = createWorkCanvas(W, H);
        const smCtx = senderMask.getContext("2d");
        smCtx.fillStyle = "#fff";
        LayoutEngine.drawLines(smCtx, senderFit.lines, {
          fontFamily: pairing.signatureFont, weight: "500",
          size: senderFit.size, letterSpacing: senderFit.letterSpacing, lineHeight: 1.3,
          cx, startY: signY,
        });
        compositeFoil(ctx, W, H, (mctx) => mctx.drawImage(senderMask, 0, 0), {
          presetId: project.foil.presetId, mode: project.foil.mode, intensity: project.foil.intensity * 0.85,
          grain: project.foil.grain, highlight: project.foil.highlight, shadow: project.foil.shadow, quality,
        });
      }
    }

    const cardDate = project.cardDate || {};
    const dateText = cardDate.visible ? formatCardDate(cardDate.value) : "";
    if (dateText) {
      const dateY = H - 76;
      ctx.save();
      ctx.fillStyle = mutedColor;
      ctx.globalAlpha = 0.82;
      ctx.font = "500 26px " + pairing.supportFont;
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText(dateText, cx, dateY);
      ctx.restore();
      boxes.push(textBoxToLayoutBox("card-date", cx, dateY - 17, 360, 34, 60));
    }

    return boxes;
  }

  function stampToLayoutBox(stamp) {
    const size = 180 * stamp.scale;
    return {
      id: stamp.id, x: stamp.x * W - size / 2, y: stamp.y * H - size / 2,
      width: size, height: size, priority: 20, movable: true, layer: stamp.layer,
    };
  }

  function renderStampsForLayer(ctx, project, theme, layer, initials) {
    if (!OccasionRegistry.allowsStamps((project.occasion && project.occasion.id) || "birthday")) return;
    const stamps = project.stamps.filter((s) => s.layer === layer);
    stamps.forEach((stamp) => {
      const def = StampCollections.getDef(stamp.assetId);
      const preset = FoilPresets.getPreset(theme.foilPresetId);
      const size = 180 * stamp.scale;
      ctx.save();
      ctx.globalAlpha = stamp.opacity;
      ctx.translate(stamp.x * W, stamp.y * H);
      ctx.rotate((stamp.rotation * Math.PI) / 180);
      def.draw(ctx, size * 0.86, { preset, monogram: initials, waxColor: theme.palette.secondary === "#e8c777" ? "#7a1420" : "#7a1420" });
      ctx.restore();
    });
  }

  function getInitials(project) {
    const r = (project.recipient.name || "").trim();
    if (!r) return "";
    const parts = r.split(/\s+/);
    return parts.length > 1 ? (parts[0][0] + parts[parts.length - 1][0]) : r.slice(0, 2);
  }

  /* ---------------- 14: Final grain + color grade ---------------- */
  function renderFinalGrade(ctx, theme, quality) {
    if (quality !== "preview") {
      const grainTile = getCachedTile("grain-final", 96, (c) => generateGrainTile(c, 96, 99, 1));
      ctx.save();
      ctx.globalAlpha = 0.035;
      ctx.globalCompositeOperation = supportsBlendModes() ? "overlay" : "source-over";
      try {
        const pattern = ctx.createPattern(grainTile, "repeat");
        ctx.fillStyle = pattern;
        ctx.fillRect(0, 0, W, H);
      } catch (err) { /* ignore */ }
      ctx.restore();
    }
    // Subtle warm color grade
    ctx.save();
    ctx.globalAlpha = 0.05;
    ctx.globalCompositeOperation = supportsBlendModes() ? "overlay" : "source-over";
    const grad = ctx.createLinearGradient(0, 0, W, H);
    grad.addColorStop(0, "#3a2a10");
    grad.addColorStop(1, "#0a0410");
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, W, H);
    ctx.restore();
  }

  /* ---------------- Orchestrator ---------------- */
  async function renderCard(ctx, project, assets, options) {
    options = options || {};
    const quality = options.quality || "preview";
    const theme = ThemeRegistry.getTheme(project.theme.id);
    const pairing = FontPairings.getPairing(project.typography.pairingId);

    const diagnostics = {
      textOverflow: false, textClamped: false, unsafeGreeting: false,
      collisions: [], missingAssets: [], safeZoneViolations: [],
    };

    ctx.clearRect(0, 0, W, H);
    await renderBackground(ctx, theme, quality, project);
    await renderThemeBorderDecorations(ctx, project, theme);
    renderLuxuryBorder(ctx, theme, quality, project);

    renderStampsForLayer(ctx, project, theme, "background", getInitials(project));

    const occasionId = (project.occasion && project.occasion.id) || "birthday";
    const allowPhoto = OccasionRegistry.allowsPhoto(occasionId);
    const allowStamps = OccasionRegistry.allowsStamps(occasionId);
    let photoImage = null;
    if (allowPhoto && project.photo && project.photo.assetId) {
      try {
        photoImage = await assets.resolvePhoto(project.photo.assetId, quality);
      } catch (err) {
        diagnostics.missingAssets.push(project.photo.assetId);
      }
    }
    await renderPhoto(ctx, project, theme, photoImage, getInitials(project), quality);

    const textBoxes = await renderTextLayers(ctx, project, theme, pairing, diagnostics, quality);

    renderStampsForLayer(ctx, project, theme, "foreground", getInitials(project));
    renderStampsForLayer(ctx, project, theme, "top", getInitials(project));

    renderFinalGrade(ctx, theme, quality);

    // Collision + safe-zone diagnostics (non-blocking): compare stamp boxes
    // against text boxes and the safe zone; never mutates layout here.
    const stampBoxes = allowStamps ? project.stamps.map(stampToLayoutBox) : [];
    diagnostics.collisions = LayoutEngine.detectCollisions(textBoxes.concat(stampBoxes), 6);
    const safeZone = LayoutEngine.getSafeZone();
    stampBoxes.forEach((b) => { if (LayoutEngine.isOutsideSafeZone(b, safeZone)) diagnostics.safeZoneViolations.push(b.id); });

    return diagnostics;
  }

  return {
    W, H, renderCard, compositeFoil, createWorkCanvas, getArtGeometry, artPath,
    getInitials, stampToLayoutBox, supportsBlendModes,
  };
})();

/* =========================================================================
   SECTION: AssetResolver
   Bridges AssetRepository (binary storage) to the Renderer (which wants
   decoded HTMLImageElements). Caches decoded images per asset so dragging
   a slider does not re-decode the source photo every frame; export always
   forces a fresh full-resolution decode.
   ========================================================================= */
const AssetResolver = (() => {
  const previewCache = new Map(); // assetId -> Image
  const fullCache = new Map();

  async function resolvePhoto(assetId, quality) {
    const cache = quality === "export" ? fullCache : previewCache;
    if (cache.has(assetId)) return cache.get(assetId);
    let url;
    if (quality === "export") {
      url = await AssetRepository.getObjectUrl(assetId);
    } else {
      url = await AssetRepository.getPreviewOrOriginalUrl(assetId);
    }
    if (!url) throw new Error("Missing photo asset: " + assetId);
    const img = await Utils.loadImage(url);
    cache.set(assetId, img);
    return img;
  }

  function invalidate(assetId) {
    previewCache.delete(assetId);
    fullCache.delete(assetId);
  }

  function clear() { previewCache.clear(); fullCache.clear(); }

  return { resolvePhoto, invalidate, clear };
})();

/* =========================================================================
   SECTION: AudioController
   Owns user-provided audio playback and IndexedDB asset references. Never
   autoplays; only ever starts on an explicit user gesture (a play click).
   ========================================================================= */
const AudioController = (() => {
  let audioEl = null;
  let currentAssetId = null;
  const listeners = new Set();

  function ensureElement() {
    if (!audioEl) {
      audioEl = document.createElement("audio");
      audioEl.preload = "metadata";
      audioEl.addEventListener("timeupdate", emit);
      audioEl.addEventListener("loadedmetadata", emit);
      audioEl.addEventListener("ended", emit);
      audioEl.addEventListener("play", emit);
      audioEl.addEventListener("pause", emit);
      audioEl.addEventListener("error", () => emit({ error: true }));
    }
    return audioEl;
  }

  function emit(extra) {
    const state = getState();
    if (extra && extra.error) state.error = true;
    listeners.forEach((fn) => fn(state));
  }

  function subscribe(fn) { listeners.add(fn); return () => listeners.delete(fn); }

  function getState() {
    const el = ensureElement();
    return {
      loaded: !!currentAssetId,
      playing: !el.paused && !el.ended,
      muted: el.muted,
      currentTime: el.currentTime || 0,
      duration: Number.isFinite(el.duration) ? el.duration : 0,
      error: false,
    };
  }

  function isFormatSupported(mimeType) {
    const el = ensureElement();
    const support = el.canPlayType(mimeType);
    return support === "probably" || support === "maybe";
  }

  async function load(assetId) {
    const el = ensureElement();
    if (currentAssetId) AssetRepository.releaseObjectUrl(currentAssetId);
    const asset = await AssetRepository.getAsset(assetId);
    if (!asset) throw new Error("Audio asset not found.");
    if (!isFormatSupported(asset.mimeType)) {
      currentAssetId = null;
      emit({ error: true });
      throw new Error("This browser cannot play " + asset.mimeType + " audio.");
    }
    const url = await AssetRepository.getObjectUrl(assetId, asset.blob);
    el.src = url;
    currentAssetId = assetId;
    emit();
    return asset;
  }

  function unload() {
    const el = ensureElement();
    el.pause();
    el.removeAttribute("src");
    el.load();
    if (currentAssetId) AssetRepository.releaseObjectUrl(currentAssetId);
    currentAssetId = null;
    emit();
  }

  // Must be called from within a user gesture (click handler) — browsers
  // block programmatic autoplay, and this app never attempts to work
  // around that.
  function play() { return ensureElement().play(); }
  function pause() { ensureElement().pause(); }
  function toggleMute() { const el = ensureElement(); el.muted = !el.muted; emit(); }
  function seek(seconds) { const el = ensureElement(); el.currentTime = seconds; }
  function restart() { const el = ensureElement(); el.currentTime = 0; return el.play(); }

  return { load, unload, play, pause, toggleMute, seek, restart, subscribe, getState, isFormatSupported };
})();

/* =========================================================================
   SECTION: ProjectVault
   Owns project listing, creation, duplication, import, export, deletion,
   and storage status. Private by default: nothing here ever leaves the
   device on its own.
   ========================================================================= */
const BACKUP_FORMAT_ID = "atul-birthday-card-studio";
const BACKUP_FORMAT_VERSION = 1;
const BACKUP_LIMITS = {
  maxDecodedAssetBytes: 30 * 1024 * 1024,
  maxAssets: 8,
  maxStringLen: 2000,
};

const ProjectVault = (() => {
  async function listProjects() {
    const all = await DB.getAll("projects");
    return all.sort((a, b) => b.updatedAt - a.updatedAt);
  }

  async function getProject(id) { return DB.get("projects", id); }

  async function saveProject(project, thumbnailDataUrl) {
    const record = Utils.clone(project);
    if (thumbnailDataUrl) record.thumbnailDataUrl = thumbnailDataUrl;
    else if (project.thumbnailDataUrl) record.thumbnailDataUrl = project.thumbnailDataUrl;
    await DB.put("projects", record);
    return record;
  }

  async function createProject() {
    const project = createDefaultProject();
    await saveProject(project);
    return project;
  }

  async function duplicateProject(id) {
    const original = await getProject(id);
    if (!original) throw new Error("Project not found.");
    const copy = Utils.clone(original);
    copy.id = Utils.uuid();
    copy.title = (original.title || "Untitled Card") + " (Copy)";
    copy.createdAt = Date.now();
    copy.updatedAt = Date.now();
    delete copy.thumbnailDataUrl;

    if (copy.photo && copy.photo.assetId) {
      const newAssetId = await duplicateAsset(copy.photo.assetId);
      if (newAssetId) copy.photo.assetId = newAssetId;
    }
    if (copy.audio && copy.audio.assetId) {
      const newAssetId = await duplicateAsset(copy.audio.assetId);
      if (newAssetId) copy.audio.assetId = newAssetId;
    }
    if (copy.occasion && copy.occasion.stampsByOccasion) {
      Object.keys(copy.occasion.stampsByOccasion).forEach((occasionId) => {
        copy.occasion.stampsByOccasion[occasionId] = cloneStamps(copy.occasion.stampsByOccasion[occasionId])
          .map((stamp) => ({ ...stamp, id: Utils.uuid() }));
      });
      const activeId = OccasionRegistry.normalizeOccasion(copy.occasion.id);
      if (activeId !== "condolence") {
        copy.stamps = cloneStamps(copy.occasion.stampsByOccasion[activeId]);
      } else {
        copy.stamps = cloneStamps(copy.stamps).map((stamp) => ({ ...stamp, id: Utils.uuid() }));
      }
    } else {
      copy.stamps = cloneStamps(copy.stamps).map((stamp) => ({ ...stamp, id: Utils.uuid() }));
    }

    await saveProject(copy);
    return copy;
  }

  async function duplicateAsset(assetId) {
    const asset = await AssetRepository.getAsset(assetId);
    if (!asset) return null;
    const newAsset = { ...asset, id: Utils.uuid(), createdAt: Date.now() };
    await DB.put("assets", newAsset);
    const preview = await AssetRepository.getAsset(assetId + "__preview");
    if (preview) {
      await DB.put("assets", { ...preview, id: newAsset.id + "__preview" });
    }
    return newAsset.id;
  }

  async function renameProject(id, title) {
    const project = await getProject(id);
    if (!project) throw new Error("Project not found.");
    project.title = Utils.sanitizeText(title, 60) || "Untitled Card";
    project.updatedAt = Date.now();
    await DB.put("projects", project);
    return project;
  }

  async function isAssetReferencedElsewhere(assetId, excludingProjectId) {
    const all = await listProjects();
    return all.some((p) => p.id !== excludingProjectId && (
      (p.photo && p.photo.assetId === assetId) || (p.audio && p.audio.assetId === assetId)
    ));
  }

  async function deleteProject(id) {
    const project = await getProject(id);
    if (!project) return;
    if (project.photo && project.photo.assetId) {
      if (!(await isAssetReferencedElsewhere(project.photo.assetId, id))) {
        await AssetRepository.deleteAsset(project.photo.assetId);
      }
    }
    if (project.audio && project.audio.assetId) {
      if (!(await isAssetReferencedElsewhere(project.audio.assetId, id))) {
        await AssetRepository.deleteAsset(project.audio.assetId);
      }
    }
    await DB.delete("projects", id);
  }

  async function searchProjects(query) {
    const all = await listProjects();
    const q = query.trim().toLowerCase();
    if (!q) return all;
    return all.filter((p) =>
      (p.title || "").toLowerCase().includes(q) ||
      (p.recipient && (p.recipient.name || "").toLowerCase().includes(q))
    );
  }

  async function getStorageEstimate() {
    if (navigator.storage && navigator.storage.estimate) {
      try {
        const est = await navigator.storage.estimate();
        return { usage: est.usage || 0, quota: est.quota || 0, supported: true };
      } catch (err) { /* fall through */ }
    }
    return { usage: 0, quota: 0, supported: false };
  }

  /* ---------------- Backup import / export ---------------- */

  async function exportBackup(id) {
    const project = await getProject(id);
    if (!project) throw new Error("Project not found.");
    const backup = {
      format: BACKUP_FORMAT_ID,
      formatVersion: BACKUP_FORMAT_VERSION,
      appVersion: APP_VERSION,
      exportedAt: Date.now(),
      project: Utils.clone(project),
      assets: [],
    };
    delete backup.project.thumbnailDataUrl;

    const assetRefs = [];
    if (project.photo && project.photo.assetId) assetRefs.push(project.photo.assetId);
    if (project.audio && project.audio.assetId) assetRefs.push(project.audio.assetId);

    for (const assetId of assetRefs) {
      const asset = await AssetRepository.getAsset(assetId);
      if (!asset) continue;
      const dataUrl = await Utils.blobToDataUrl(asset.blob);
      backup.assets.push({
        id: asset.id, kind: asset.kind, mimeType: asset.mimeType, dataUrl,
        width: asset.width, height: asset.height, duration: asset.duration,
      });
    }
    return backup;
  }

  function validateBackup(backup) {
    if (!backup || typeof backup !== "object") throw new Error("This file is not a valid backup.");
    if (backup.format !== BACKUP_FORMAT_ID) throw new Error("This file was not created by Atul Card Studio.");
    if (typeof backup.formatVersion !== "number" || backup.formatVersion > BACKUP_FORMAT_VERSION) {
      throw new Error("This backup was created by a newer version of the studio and cannot be imported here.");
    }
    if (!backup.project || typeof backup.project !== "object") throw new Error("Backup is missing project data.");
    const required = ["id", "recipient", "sender", "content", "theme", "layout", "typography", "foil", "stamps"];
    for (const key of required) {
      if (!(key in backup.project)) throw new Error("Backup is missing required field: " + key);
    }
    if (!Array.isArray(backup.assets)) throw new Error("Backup assets list is malformed.");
    if (backup.assets.length > BACKUP_LIMITS.maxAssets) throw new Error("Backup contains too many embedded assets.");
    const allowedMimes = /^(image\/(png|jpeg|jpg|webp)|audio\/(mpeg|mp4|ogg|wav|x-wav|webm|aac))$/;
    backup.assets.forEach((a) => {
      if (!allowedMimes.test(a.mimeType || "")) throw new Error("Backup contains an unsupported asset type: " + a.mimeType);
      if (typeof a.dataUrl !== "string" || a.dataUrl.length > BACKUP_LIMITS.maxDecodedAssetBytes * 1.4) {
        throw new Error("An embedded asset in this backup is too large.");
      }
    });
  }

  async function importBackup(file) {
    const text = await file.text();
    let backup;
    try { backup = JSON.parse(text); } catch (err) { throw new Error("This file is not valid JSON."); }
    validateBackup(backup);

    const project = Migrations.migrate(Utils.clone(backup.project));
    const idMap = new Map();

    for (const assetRecord of backup.assets) {
      const blob = Utils.dataUrlToBlob(assetRecord.dataUrl);
      if (blob.size > BACKUP_LIMITS.maxDecodedAssetBytes) {
        throw new Error("An embedded asset in this backup exceeds the size limit.");
      }
      const newId = Utils.uuid();
      idMap.set(assetRecord.id, newId);
      await DB.put("assets", {
        id: newId, kind: assetRecord.kind, mimeType: assetRecord.mimeType, blob,
        width: assetRecord.width, height: assetRecord.height, duration: assetRecord.duration,
        createdAt: Date.now(),
      });
    }

    project.id = Utils.uuid();
    project.title = Utils.sanitizeText((project.title || "Imported Card") + " (Imported)", 60);
    project.createdAt = Date.now();
    project.updatedAt = Date.now();
    if (project.photo && project.photo.assetId && idMap.has(project.photo.assetId)) {
      project.photo.assetId = idMap.get(project.photo.assetId);
    } else if (project.photo) {
      project.photo = null; // referenced asset was not included/valid
    }
    if (project.audio && project.audio.assetId && idMap.has(project.audio.assetId)) {
      project.audio.assetId = idMap.get(project.audio.assetId);
    } else if (project.audio) {
      project.audio = null;
    }
    if (Array.isArray(project.stamps)) {
      project.stamps = project.stamps.map((s) => ({ ...s, id: Utils.uuid() })).slice(0, 40);
    }
    if (project.occasion && project.occasion.stampsByOccasion) {
      Object.keys(project.occasion.stampsByOccasion).forEach((occasionId) => {
        project.occasion.stampsByOccasion[occasionId] = cloneStamps(project.occasion.stampsByOccasion[occasionId])
          .map((stamp) => ({ ...stamp, id: Utils.uuid() }))
          .slice(0, 40);
      });
      const activeId = OccasionRegistry.normalizeOccasion(project.occasion.id);
      if (activeId !== "condolence") {
        project.stamps = cloneStamps(project.occasion.stampsByOccasion[activeId]);
      }
    }

    await saveProject(project);
    return project;
  }

  return {
    listProjects, getProject, saveProject, createProject, duplicateProject,
    renameProject, deleteProject, searchProjects, getStorageEstimate,
    exportBackup, importBackup, BACKUP_FORMAT_ID, BACKUP_FORMAT_VERSION,
  };
})();

/* =========================================================================
   SECTION: ExportModule
   Owns high-resolution PNG rendering, filename sanitization, download
   fallback and Web Share API integration. Kept strictly separate from
   "Digital Card" packaging, which preserves audio via a project backup —
   the PNG never implies audio is present.
   ========================================================================= */
const ExportModule = (() => {
  function assertSafeForOutput(project) {
    const validation = GreetingGenerator.validateProjectGreeting(project);
    if (!validation.safe) {
      throw new Error(validation.outputError || "Correct the greeting before exporting or sharing this card.");
    }
  }

  async function waitForFonts(pairing) {
    if (!("fonts" in document)) return;
    const families = FontPairings.familiesFor(pairing);
    try {
      await Promise.all(families.map((f) => document.fonts.load("600 32px '" + f + "'")));
      await document.fonts.ready;
    } catch (err) {
      console.warn("Font loading did not fully settle before export; proceeding anyway.", err);
    }
  }

  function buildFilename(project, theme) {
    const recipient = Utils.sanitizeFilenamePart(project.recipient.name || "card");
    const themeSlug = theme.id;
    return "atul-card-" + recipient + "-" + themeSlug + ".png";
  }

  async function renderExportCanvas(project) {
    assertSafeForOutput(project);
    const canvas = document.createElement("canvas");
    canvas.width = Renderer.W;
    canvas.height = Renderer.H;
    const ctx = canvas.getContext("2d");
    const pairing = FontPairings.getPairing(project.typography.pairingId);
    await waitForFonts(pairing);
    const diagnostics = await Renderer.renderCard(ctx, project, AssetResolver, { quality: "export" });
    return { canvas, diagnostics };
  }

  async function exportPng(project) {
    const theme = ThemeRegistry.getTheme(project.theme.id);
    const { canvas, diagnostics } = await renderExportCanvas(project);
    const blob = await new Promise((resolve, reject) => {
      canvas.toBlob((b) => (b ? resolve(b) : reject(new Error("Canvas export failed."))), "image/png");
    });
    const filename = buildFilename(project, theme);
    return { blob, filename, diagnostics };
  }

  function downloadBlob(blob, filename) {
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 4000);
  }

  // Chromium may block a second anchor-triggered download because the
  // expensive canvas render completes after the original click activation
  // expires. Opening the native Save dialog immediately from the click
  // keeps every export user-authorized and reliable after theme changes.
  function canUseSavePicker() {
    return window.isSecureContext && typeof window.showSaveFilePicker === "function";
  }

  async function choosePngDestination(filename) {
    if (!canUseSavePicker()) return null;
    return window.showSaveFilePicker({
      suggestedName: filename,
      types: [{ description: "PNG image", accept: { "image/png": [".png"] } }],
    });
  }

  async function savePng(blob, filename, handle) {
    if (!handle) {
      downloadBlob(blob, filename);
      return "downloaded";
    }
    const writable = await handle.createWritable();
    try {
      await writable.write(blob);
    } finally {
      await writable.close();
    }
    return "saved";
  }

  function canShareFiles(file) {
    return !!(navigator.canShare && navigator.share && navigator.canShare({ files: [file] }));
  }

  async function sharePng(blob, filename) {
    const file = new File([blob], filename, { type: "image/png" });
    if (!canShareFiles(file)) throw new Error("Sharing is not supported on this browser.");
    await navigator.share({ files: [file], title: "A card for you" });
  }

  async function exportDigitalCardPackage(projectId) {
    const backup = await ProjectVault.exportBackup(projectId);
    assertSafeForOutput(backup.project);
    const json = JSON.stringify(backup);
    const blob = new Blob([json], { type: "application/json" });
    const filename = "atul-digital-card-" + Utils.sanitizeFilenamePart(backup.project.recipient.name || "card") + ".json";
    return { blob, filename };
  }

  return {
    exportPng, exportDigitalCardPackage, downloadBlob, canShareFiles, sharePng,
    renderExportCanvas, buildFilename, canUseSavePicker, choosePngDestination, savePng,
    assertSafeForOutput,
  };
})();

/* =========================================================================
   SECTION: PWA / OfflineStatus
   Registers the service worker, tracks online/offline + "offline ready"
   state, and surfaces update-available notifications.
   ========================================================================= */
const PWAStatus = (() => {
  const listeners = new Set();
  let state = { online: navigator.onLine, offlineReady: false, updateAvailable: false, installPromptAvailable: false };
  let deferredInstallPrompt = null;
  let registration = null;

  function subscribe(fn) { listeners.add(fn); fn(state); return () => listeners.delete(fn); }
  function emit() { listeners.forEach((fn) => fn(state)); }

  function setState(patch) { state = { ...state, ...patch }; emit(); }

  async function register() {
    if (!("serviceWorker" in navigator)) {
      console.warn("Service workers are not supported in this browser; the app will still work online.");
      return;
    }
    try {
      // Snapshot whether a controller existed before registration so a first
      // install is distinguished from an update waiting for user approval.
      const hadControllerBeforeRegister = !!navigator.serviceWorker.controller;
      registration = await navigator.serviceWorker.register("sw.js");
      if (registration.active) setState({ offlineReady: true });
      if (hadControllerBeforeRegister && registration.waiting) {
        setState({ updateAvailable: true });
      }

      registration.addEventListener("updatefound", () => {
        const installing = registration.installing;
        if (!installing) return;
        installing.addEventListener("statechange", () => {
          if (installing.state === "installed") {
            if (hadControllerBeforeRegister) {
              setState({ updateAvailable: true });
            } else {
              setState({ offlineReady: true });
            }
          }
        });
      });

      // Only reload when a NEW version takes control after the user chose
      // to apply an update (applyUpdate() below). The very first time a
      // service worker claims an uncontrolled page also fires this event,
      // and reloading then would interrupt normal first-time use.
      let expectingReload = false;
      navigator.serviceWorker.addEventListener("controllerchange", () => {
        if (!expectingReload) return;
        expectingReload = false;
        window.location.reload();
      });
      registration._markExpectingReload = () => { expectingReload = true; };
    } catch (err) {
      console.warn("Service worker registration failed; the app will still work online.", err);
    }
  }

  function applyUpdate() {
    if (registration && registration.waiting) {
      if (registration._markExpectingReload) registration._markExpectingReload();
      registration.waiting.postMessage({ type: "SKIP_WAITING" });
    }
  }

  window.addEventListener("online", () => setState({ online: true }));
  window.addEventListener("offline", () => setState({ online: false }));
  window.addEventListener("beforeinstallprompt", (e) => {
    e.preventDefault();
    deferredInstallPrompt = e;
    setState({ installPromptAvailable: true });
  });
  window.addEventListener("appinstalled", () => setState({ installPromptAvailable: false }));

  async function promptInstall() {
    if (!deferredInstallPrompt) return false;
    deferredInstallPrompt.prompt();
    const choice = await deferredInstallPrompt.userChoice;
    deferredInstallPrompt = null;
    setState({ installPromptAvailable: false });
    return choice.outcome === "accepted";
  }

  return { register, subscribe, applyUpdate, promptInstall, getState: () => state };
})();

/* =========================================================================
   SECTION: UI wiring + accessibility
   Owns user interactions, temporary selection state, pointer gestures and
   presentation of diagnostics. Delegates all rendering to Renderer and all
   mutation to StateStore.update — this section never draws to the canvas
   context directly except by calling Renderer.renderCard.
   ========================================================================= */
const App = (() => {
  const $ = (sel) => document.querySelector(sel);
  const dom = {};
  let selectedStampId = null;
  let renderRAF = null;
  let renderQueuedQuality = "preview";
  let editorTabHistory = [];
  let hasUnsavedChanges = false;

  /* ---------------- Toasts / live region ---------------- */
  function toast(message, isError) {
    const region = dom.toastRegion;
    const el = document.createElement("div");
    el.className = "toast" + (isError ? " toast-error" : "");
    el.textContent = message;
    region.appendChild(el);
    setTimeout(() => el.remove(), 4200);
  }

  function announceSaveStatus(text) {
    dom.saveStatus.textContent = text;
  }

  /* ---------------- Dialog helpers ---------------- */
  function openDialog(dialog) {
    if (typeof dialog.showModal === "function") dialog.showModal();
    else dialog.setAttribute("open", "");
  }
  function closeDialog(dialog) {
    if (typeof dialog.close === "function") dialog.close();
    else dialog.removeAttribute("open");
  }

  function confirmDialog(message, title) {
    return new Promise((resolve) => {
      $("#confirm-title").textContent = title || "Are you sure?";
      $("#confirm-message").textContent = message;
      const dialog = $("#confirm-dialog");
      const okBtn = $("#confirm-ok-btn");
      const cancelBtn = $("#confirm-cancel-btn");
      function cleanup(result) {
        okBtn.removeEventListener("click", onOk);
        cancelBtn.removeEventListener("click", onCancel);
        dialog.removeEventListener("cancel", onCancel);
        closeDialog(dialog);
        resolve(result);
      }
      function onOk() { cleanup(true); }
      function onCancel() { cleanup(false); }
      okBtn.addEventListener("click", onOk);
      cancelBtn.addEventListener("click", onCancel);
      dialog.addEventListener("cancel", onCancel, { once: true });
      openDialog(dialog);
    });
  }

  function renameDialog(currentTitle) {
    return new Promise((resolve) => {
      const dialog = $("#rename-dialog");
      const input = $("#rename-input");
      const okBtn = $("#rename-ok-btn");
      const cancelBtn = $("#rename-cancel-btn");
      input.value = currentTitle || "";
      function cleanup(result) {
        okBtn.removeEventListener("click", onOk);
        cancelBtn.removeEventListener("click", onCancel);
        dialog.removeEventListener("cancel", onCancel);
        closeDialog(dialog);
        resolve(result);
      }
      function onOk() { cleanup(input.value.trim() || null); }
      function onCancel() { cleanup(null); }
      okBtn.addEventListener("click", onOk);
      cancelBtn.addEventListener("click", onCancel);
      dialog.addEventListener("cancel", onCancel, { once: true });
      openDialog(dialog);
      setTimeout(() => input.focus(), 30);
    });
  }

  /* ---------------- Tabs ---------------- */
  function initTabs() {
    const tabs = Array.from(document.querySelectorAll(".tab"));
    const backBtn = document.querySelector("#editor-back-btn");
    const nextBtn = document.querySelector("#editor-next-btn");
    const topBtn = document.querySelector("#editor-top-btn");
    tabs.forEach((tab) => {
      tab.addEventListener("click", () => selectTab(tab));
      tab.addEventListener("keydown", (e) => {
        const availableTabs = tabs.filter((candidate) => !candidate.hidden && !candidate.disabled);
        const idx = availableTabs.indexOf(tab);
        if (idx === -1) return;
        if (e.key === "ArrowRight") { e.preventDefault(); availableTabs[(idx + 1) % availableTabs.length].focus(); selectTab(availableTabs[(idx + 1) % availableTabs.length]); }
        if (e.key === "ArrowLeft") { e.preventDefault(); availableTabs[(idx - 1 + availableTabs.length) % availableTabs.length].focus(); selectTab(availableTabs[(idx - 1 + availableTabs.length) % availableTabs.length]); }
      });
    });
    backBtn?.addEventListener("click", () => {
      const previous = editorTabHistory.pop();
      if (previous) selectTab(previous, { recordHistory: false });
      updateEditorNavigation(tabs);
    });
    nextBtn?.addEventListener("click", () => {
      const availableTabs = tabs.filter((candidate) => !candidate.hidden && !candidate.disabled);
      const current = availableTabs.find((candidate) => candidate.getAttribute("aria-selected") === "true");
      const next = availableTabs[(availableTabs.indexOf(current) + 1) % availableTabs.length];
      if (next && next !== current) selectTab(next);
    });
    topBtn?.addEventListener("click", () => {
      document.querySelector(".tabpanels")?.scrollTo({ top: 0, behavior: "smooth" });
    });
    updateEditorNavigation(tabs);
  }

  function updateEditorNavigation(tabs) {
    const backBtn = document.querySelector("#editor-back-btn");
    const nextBtn = document.querySelector("#editor-next-btn");
    const availableTabs = (tabs || Array.from(document.querySelectorAll(".tab"))).filter((candidate) => !candidate.hidden && !candidate.disabled);
    const current = availableTabs.find((candidate) => candidate.getAttribute("aria-selected") === "true");
    if (backBtn) backBtn.disabled = editorTabHistory.length === 0;
    if (nextBtn) nextBtn.disabled = availableTabs.length < 2 || !current;
  }

  function selectTab(tab, opts) {
    if (!tab || tab.hidden || tab.disabled) return;
    opts = opts || {};
    const current = document.querySelector('.tab[aria-selected="true"]');
    if (opts.recordHistory !== false && current && current !== tab) editorTabHistory.push(current);
    document.querySelectorAll(".tab").forEach((t) => {
      const selected = t === tab;
      t.setAttribute("aria-selected", String(selected));
      t.tabIndex = selected ? 0 : -1;
    });
    document.querySelectorAll(".tabpanel").forEach((p) => {
      p.hidden = p.id !== tab.getAttribute("aria-controls");
    });
    tab.scrollIntoView({ block: "nearest", inline: "nearest", behavior: "smooth" });
    updateEditorNavigation();
  }

  /* ---------------- Populate registries into DOM ---------------- */
  function populateOccasionSelect() {
    if (!dom.occasionSelect) return;
    dom.occasionSelect.innerHTML = "";
    const personal = document.createElement("optgroup");
    personal.label = "Personal occasions";
    const festivals = document.createElement("optgroup");
    festivals.label = "Festivals";
    OccasionRegistry.list().forEach((occ) => {
      const opt = document.createElement("option");
      opt.value = occ.id;
      opt.textContent = occ.label;
      (occ.isFestival ? festivals : personal).appendChild(opt);
    });
    dom.occasionSelect.appendChild(personal);
    dom.occasionSelect.appendChild(festivals);
  }

  function syncFestivalDesignControls(project) {
    if (!dom.festivalDesignField || !dom.festivalDesignList) return;
    const occasionId = (project.occasion && project.occasion.id) || "birthday";
    const designs = FestivalDesignRegistry.list(occasionId);
    dom.festivalDesignField.hidden = !designs.length;
    dom.festivalDesignList.innerHTML = "";
    if (!designs.length) return;
    const selectedId = (FestivalDesignRegistry.get(occasionId, project.content && project.content.festivalDesignId) || {}).id;
    designs.forEach((design) => {
      const button = document.createElement("button");
      button.type = "button";
      button.className = "festival-design";
      button.dataset.festivalDesignId = design.id;
      button.setAttribute("role", "radio");
      button.setAttribute("aria-checked", String(design.id === selectedId));
      const image = document.createElement("img");
      image.src = design.asset;
      image.alt = "";
      image.loading = "lazy";
      image.style.filter = design.overlay === "light"
        ? "brightness(1.16) saturate(1.08)"
        : design.overlay === "dark" ? "brightness(0.64) saturate(0.86)" : "none";
      const label = document.createElement("span");
      label.textContent = design.label;
      const hint = document.createElement("small");
      hint.textContent = design.hint;
      button.append(image, label, hint);
      dom.festivalDesignList.appendChild(button);
    });
  }

  function populateEmotionRow(occasionId) {
    const row = dom.emotionRow;
    row.innerHTML = "";
    GreetingGenerator.list(occasionId).forEach((emotion) => {
      const btn = document.createElement("button");
      btn.type = "button";
      btn.className = "emotion-btn";
      btn.dataset.emotion = emotion.id;
      btn.dataset.label = emotion.label;
      btn.setAttribute("aria-pressed", "false");
      const strong = document.createElement("strong");
      strong.textContent = emotion.label;
      const hint = document.createElement("span");
      hint.textContent = emotion.hint;
      btn.appendChild(strong);
      btn.appendChild(hint);
      row.appendChild(btn);
    });
  }

  function markEmotionSelection(emotionId) {
    dom.emotionRow.querySelectorAll("[data-emotion]").forEach((el) => {
      el.setAttribute("aria-pressed", String(el.dataset.emotion === emotionId));
    });
  }

  function populateCenterpieceList(occasionId) {
    const list = dom.centerpieceList;
    if (!list) return;
    list.innerHTML = "";
    const occId = occasionId || (StateStore.getProject() && StateStore.getProject().occasion && StateStore.getProject().occasion.id) || "birthday";
    Centerpieces.list(occId).forEach((cp) => {
      const item = document.createElement("button");
      item.type = "button";
      item.className = "option-item";
      item.setAttribute("role", "radio");
      item.setAttribute("aria-checked", "false");
      item.dataset.centerpieceId = cp.id;
      const strong = document.createElement("strong");
      strong.textContent = cp.label;
      const span = document.createElement("span");
      span.textContent = cp.hint;
      item.appendChild(strong);
      item.appendChild(span);
      list.appendChild(item);
    });
  }

  function markCenterpieceSelection(id) {
    dom.centerpieceList.querySelectorAll("[data-centerpiece-id]").forEach((el) => {
      el.setAttribute("aria-checked", String(el.dataset.centerpieceId === id));
    });
  }

  function markShapeSelection(shape) {
    dom.photoShapeGroup.querySelectorAll("[data-shape]").forEach((el) => {
      el.setAttribute("aria-checked", String(el.dataset.shape === shape));
    });
  }

  function populateThemeGrid() {
    const grid = dom.themeGrid;
    grid.innerHTML = "";
    ThemeRegistry.list().forEach((theme) => {
      const btn = document.createElement("button");
      btn.type = "button";
      btn.className = "swatch";
      btn.setAttribute("role", "radio");
      btn.setAttribute("aria-checked", "false");
      btn.dataset.themeId = theme.id;
      const preview = document.createElement("span");
      preview.className = "swatch-preview";
      preview.style.background = "linear-gradient(135deg, " + theme.background.top + ", " + theme.background.bottom + ")";
      preview.style.borderColor = theme.palette.primary;
      const name = document.createElement("span");
      name.className = "swatch-name";
      name.textContent = theme.name;
      if (ThemePreferences.isFavourite(theme.id)) {
        const favourite = document.createElement("span");
        favourite.className = "swatch-favourite";
        favourite.setAttribute("aria-hidden", "true");
        favourite.textContent = "★";
        btn.appendChild(favourite);
        btn.setAttribute("aria-label", theme.name + ", favourite theme");
      }
      btn.appendChild(preview);
      btn.appendChild(name);
      btn.addEventListener("click", () => {
        StateStore.applyTheme(theme.id);
        toast("Theme set to " + theme.name);
      });
      grid.appendChild(btn);
    });
  }

  function syncThemeFavouriteControls(project) {
    if (!dom.themeFavouriteBtn || !project) return;
    const theme = ThemeRegistry.getTheme(project.theme.id);
    const isFavourite = ThemePreferences.isFavourite(theme.id);
    dom.themeFavouriteBtn.textContent = isFavourite
      ? "Remove " + theme.name + " from favourites"
      : "Favourite " + theme.name;
    dom.themeFavouriteBtn.setAttribute("aria-pressed", String(isFavourite));
    dom.themeFavouriteHint.textContent = isFavourite
      ? theme.name + " is retained in your local favourites."
      : "Favourites stay on this device and do not change the card.";
  }

  function populateFoilGrid() {
    const grid = dom.foilGrid;
    grid.innerHTML = "";
    FoilPresets.list().forEach((preset) => {
      const btn = document.createElement("button");
      btn.type = "button";
      btn.className = "swatch";
      btn.setAttribute("role", "radio");
      btn.setAttribute("aria-checked", "false");
      btn.dataset.foilId = preset.id;
      const preview = document.createElement("span");
      preview.className = "swatch-preview";
      const stops = preset.stops.map((s) => s.c + " " + Math.round(s.t * 100) + "%").join(", ");
      preview.style.background = "linear-gradient(135deg, " + stops + ")";
      const name = document.createElement("span");
      name.className = "swatch-name";
      name.textContent = preset.name;
      btn.appendChild(preview);
      btn.appendChild(name);
      btn.addEventListener("click", () => {
        StateStore.update((p) => { p.foil.presetId = preset.id; }, { reason: "foil-preset" });
      });
      grid.appendChild(btn);
    });
  }

  function populatePairingList() {
    const list = dom.pairingList;
    list.innerHTML = "";
    FontPairings.list().forEach((pairing) => {
      const item = document.createElement("button");
      item.type = "button";
      item.className = "option-item";
      item.setAttribute("role", "radio");
      item.setAttribute("aria-checked", "false");
      item.dataset.pairingId = pairing.id;
      const strong = document.createElement("strong");
      strong.textContent = pairing.name;
      strong.style.fontFamily = pairing.recipientFont;
      const span = document.createElement("span");
      span.textContent = pairing.description;
      item.appendChild(strong);
      item.appendChild(span);
      item.addEventListener("click", () => {
        StateStore.update((p) => { p.typography.pairingId = pairing.id; }, { reason: "pairing" });
        StateStore.markTypographyCustomized();
      });
      list.appendChild(item);
    });
  }

  function populateStampGallery() {
    const gallery = dom.stampGallery;
    gallery.innerHTML = "";
    const project = StateStore.getProject();
    const occasionId = (project.occasion && project.occasion.id) || "birthday";
    const recommendedIds = OccasionRegistry.getRecommendedStampIds(occasionId);
    const definitions = StampCollections.list().slice();
    const groups = [
      { id: "recommended", label: "Recommended for " + OccasionRegistry.get(occasionId).label,
        items: recommendedIds.map((id) => definitions.find((def) => def.id === id)).filter(Boolean) },
      { id: "occasion", label: "Occasion Greetings", items: [] },
      { id: "messages", label: "Love & Messages", items: [] },
      { id: "nature", label: "Flowers & Nature", items: [] },
      { id: "celebration", label: "Celebration & Keepsakes", items: [] },
      { id: "personal", label: "Personal", items: [] },
    ];
    const groupById = Object.fromEntries(groups.map((group) => [group.id, group]));
    definitions.forEach((def) => {
      if (recommendedIds.includes(def.id)) return;
      let groupId = "celebration";
      if (def.category === "occasion") groupId = "occasion";
      else if (def.category === "badge") groupId = "messages";
      else if (def.id === "floral-ornament" || def.id === "celestial-ornament") groupId = "nature";
      else if (def.category === "monogram") groupId = "personal";
      groupById[groupId].items.push(def);
    });
    groups.filter((group) => group.items.length).forEach((group) => {
      const section = document.createElement("section");
      section.className = "stamp-gallery-section";
      section.dataset.stampGroup = group.id;
      const heading = document.createElement("h4");
      heading.className = "stamp-gallery-heading";
      heading.id = "stamp-group-" + group.id;
      heading.textContent = group.label;
      const grid = document.createElement("div");
      grid.className = "stamp-gallery-grid";
      grid.setAttribute("role", "list");
      grid.setAttribute("aria-labelledby", heading.id);
      group.items.forEach((def) => grid.appendChild(createStampGalleryItem(def, recommendedIds, project)));
      section.appendChild(heading);
      section.appendChild(grid);
      gallery.appendChild(section);
    });
  }

  function createStampGalleryItem(def, recommendedIds, project) {
      const btn = document.createElement("button");
      btn.type = "button";
      btn.className = "stamp-gallery-item";
      btn.setAttribute("role", "listitem");
      btn.dataset.stampId = def.id;
      const theme = ThemeRegistry.getTheme(project.theme.id);
      const preset = FoilPresets.getPreset(theme.foilPresetId);
      const thumb = StampCollections.renderToCanvas(def.id, 92, { preset, monogram: Renderer.getInitials(project) || "A" });
      thumb.setAttribute("aria-hidden", "true");
      const label = document.createElement("span");
      const recommended = recommendedIds.includes(def.id);
      label.textContent = recommended ? "Recommended · " + def.name : def.name;
      btn.classList.toggle("is-recommended", recommended);
      btn.appendChild(thumb);
      btn.appendChild(label);
      btn.setAttribute("aria-label", (recommended ? "Recommended for this occasion. " : "") + "Add " + def.name + " decoration");
      btn.addEventListener("click", () => addStamp(def));
      return btn;
  }

  function addStamp(def) {
    const project = StateStore.getProject();
    const occasionId = (project.occasion && project.occasion.id) || "birthday";
    if (!OccasionRegistry.allowsStamps(occasionId)) return;
    const id = Utils.uuid();
    StateStore.update((p) => {
      p.stamps.push({
        id, assetId: def.id, x: 0.5, y: 0.5, scale: 1, rotation: 0, opacity: 1, layer: def.defaultLayer || "foreground",
      });
    }, { reason: "stamp-add" });
    selectedStampId = id;
    toast(def.name + " added. Drag on the card to position it.");
  }

  /* ---------------- Render loop ---------------- */
  function scheduleRender(quality) {
    renderQueuedQuality = quality === "export" ? "export" : (renderQueuedQuality === "export" ? "export" : quality || "preview");
    if (renderRAF) return;
    renderRAF = requestAnimationFrame(async () => {
      renderRAF = null;
      const q = renderQueuedQuality;
      renderQueuedQuality = "preview";
      await paint(q);
    });
  }

  async function paint(quality) {
    const project = StateStore.getProject();
    const canvas = dom.canvas;
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const targetW = Renderer.W, targetH = Renderer.H;
    // Internal buffer stays at logical 1200x1760 units; DPR scales the
    // backing store for preview crispness per the architect's snippet.
    const cssW = canvas.clientWidth || targetW;
    const scale = quality === "preview" ? Math.min(1, (cssW * dpr) / targetW) : 1;
    const bufferW = quality === "export" ? targetW : Math.round(targetW * scale);
    const bufferH = quality === "export" ? targetH : Math.round(targetH * scale);
    if (canvas.width !== bufferW || canvas.height !== bufferH) {
      canvas.width = bufferW;
      canvas.height = bufferH;
    }
    const ctx = canvas.getContext("2d");
    ctx.setTransform(bufferW / targetW, 0, 0, bufferH / targetH, 0, 0);
    const diagnostics = await Renderer.renderCard(ctx, project, AssetResolver, { quality });
    updateDiagnosticsBanner(diagnostics);
    renderTextPreview(project);
    positionStampToolbar(project);
  }

  function updateDiagnosticsBanner(diagnostics) {
    const messages = [];
    if (diagnostics.unsafeGreeting) messages.push("This greeting contains celebratory wording that cannot appear on a Condolence card. Edit it or generate a Condolence message.");
    if (diagnostics.textOverflow) messages.push("Some text may be tight for its space — consider shortening it.");
    if (diagnostics.textClamped) messages.push("Your message was shortened to stay inside the card borders.");
    if (diagnostics.collisions.length) messages.push(diagnostics.collisions.length + " element(s) are overlapping.");
    if (diagnostics.safeZoneViolations.length) messages.push("Some stamps sit outside the safe zone.");
    if (diagnostics.missingAssets.length) messages.push("A referenced photo could not be loaded.");
    const banner = dom.diagnosticsBanner;
    if (messages.length) {
      banner.hidden = false;
      banner.textContent = messages.join(" ");
    } else {
      banner.hidden = true;
      banner.textContent = "";
    }
  }

  function renderTextPreview(project) {
    const panel = dom.textPreviewPanel;
    if (panel.hidden) return;
    const theme = ThemeRegistry.getTheme(project.theme.id);
    const greetingValidation = GreetingGenerator.validateProjectGreeting(project);
    const greeting = greetingValidation.safe ? greetingValidation.text : "(blocked until incompatible celebratory wording is corrected)";
    const occasionId = (project.occasion && project.occasion.id) || "birthday";
    panel.innerHTML = "";
    const dl = document.createElement("dl");
    const rows = [
      ["Recipient", project.recipient.name || "(not set)"],
      ["Relationship", project.recipient.relationship || "(not set)"],
      ["Greeting", greeting || "(not set)"],
      ["From", project.sender.name || "(not set)"],
      ["Theme", theme.name],
      ["Photo", OccasionRegistry.allowsPhoto(occasionId) ? (project.photo ? "Uploaded photo" : "No photo (fallback centerpiece shown)") : "No personal photo for this occasion"],
      ["Stamps", OccasionRegistry.allowsStamps(occasionId) ? (project.stamps.length ? project.stamps.length + " placed" : "None") : "Suppressed for this occasion"],
      ["Audio greeting", project.audio ? (project.audio.title || "Attached") : "None"],
    ];
    rows.forEach(([term, desc]) => {
      const dt = document.createElement("dt"); dt.textContent = term;
      const dd = document.createElement("dd"); dd.textContent = desc;
      dl.appendChild(dt); dl.appendChild(dd);
    });
    panel.appendChild(dl);
  }

  function syncGreetingSafety(project) {
    if (!dom.greetingSafetyWarning) return;
    const result = GreetingGenerator.validateProjectGreeting(project);
    const blocked = !result.safe;
    dom.greetingText.setAttribute("aria-invalid", String(blocked));
    dom.greetingSafetyWarning.hidden = !blocked;
    dom.greetingSafetyWarning.textContent = blocked ? result.warning : "";
    if (dom.useEditedMessageBtn) {
      const edited = project.content.messageMode === "edited";
      dom.useEditedMessageBtn.disabled = !edited;
      dom.useEditedMessageBtn.textContent = edited ? "Use Edited Message" : "Message Saved";
    }
  }

  function syncOccasionEditor(project) {
    const isCondolence = project.occasion && project.occasion.id === "condolence";
    [dom.themeTab, dom.typographyTab, dom.foilTab, dom.layoutTab].forEach((tab) => {
      if (!tab) return;
      const wasSelected = tab.getAttribute("aria-selected") === "true";
      tab.hidden = isCondolence;
      tab.disabled = isCondolence;
      if (isCondolence && wasSelected) selectTab(dom.contentTab);
    });
    if (dom.recipientRelationshipLabel) {
      dom.recipientRelationshipLabel.textContent = isCondolence
        ? "Relationship to the deceased"
        : "Relationship";
    }
    dom.recipientRelationship.placeholder = isCondolence
      ? "e.g. Father, aunt, friend, colleague"
      : "e.g. Brother, Best Friend";
    if (dom.recipientRelationshipHint) {
      dom.recipientRelationshipHint.hidden = !isCondolence;
      dom.recipientRelationshipHint.textContent = isCondolence
        ? "Enter the recipient’s relationship to the deceased. No religion or ritual is inferred."
        : "";
    }
  }

  /* ---------------- Field binding: Content tab ---------------- */
  function bindContentTab() {
    if (dom.occasionSelect) {
      dom.occasionSelect.addEventListener("change", (e) => {
        const newOccasionId = OccasionRegistry.normalizeOccasion(e.target.value);
        StateStore.update((p) => {
          switchProjectOccasion(p, newOccasionId);
        }, { reason: "occasion-change" });
        const p = StateStore.getProject();
        syncControlsFromState(p);
        toast(OccasionRegistry.get(newOccasionId).label + " selected.");
      });
    }
    if (dom.festivalDesignList) {
      dom.festivalDesignList.addEventListener("click", (e) => {
        const button = e.target.closest("[data-festival-design-id]");
        if (!button) return;
        const designId = button.dataset.festivalDesignId;
        StateStore.update((p) => {
          const occasionId = (p.occasion && p.occasion.id) || "birthday";
          const design = FestivalDesignRegistry.get(occasionId, designId);
          if (!design) return;
          p.content.festivalDesignId = design.id;
          p.occasion.subOccasion = design.id;
          if (p.occasion.contentByOccasion && p.occasion.contentByOccasion[occasionId]) {
            p.occasion.contentByOccasion[occasionId].festivalDesignId = design.id;
          }
        }, { reason: "festival-design-change" });
        syncFestivalDesignControls(StateStore.getProject());
      });
    }
    dom.recipientName.addEventListener("input", (e) => {
      StateStore.update((p) => { p.recipient.name = Utils.sanitizeText(e.target.value, 40); }, { skipHistory: true });
    });
    dom.recipientName.addEventListener("change", () => StateStore.update(() => {}, { skipAutosave: false }));
    dom.recipientRelationship.addEventListener("input", (e) => {
      StateStore.update((p) => {
        const relationship = Utils.sanitizeText(e.target.value, 40);
        p.recipient.relationship = relationship;
        p.content.relationship = relationship;
      }, { skipHistory: true });
    });
    dom.senderName.addEventListener("input", (e) => {
      StateStore.update((p) => { p.sender.name = Utils.sanitizeText(e.target.value, 40); }, { skipHistory: true });
    });
    dom.cardDate.addEventListener("change", (e) => {
      StateStore.update((p) => {
        if (!p.cardDate) p.cardDate = { value: localDateISO(), visible: false };
        p.cardDate.value = /^\d{4}-\d{2}-\d{2}$/.test(e.target.value) ? e.target.value : localDateISO();
      }, { reason: "card-date" });
    });
    dom.cardDateVisible.addEventListener("change", (e) => {
      StateStore.update((p) => {
        if (!p.cardDate) p.cardDate = { value: localDateISO(), visible: false };
        p.cardDate.visible = !!e.target.checked;
      }, { reason: "card-date-visibility" });
    });
    dom.autoGreetingToggle.addEventListener("change", (e) => {
      StateStore.update((p) => {
        p.content.autoGreetingEnabled = e.target.checked;
        p.content.messageMode = e.target.checked ? "auto" : "manual";
      }, { reason: "auto-greeting" });
    });
    // Emotion generator: one tap writes a draft straight into the greeting
    // field so it stays fully editable, and records the emotion so "auto-
    // write" and the Auto centrepiece keep agreeing with the chosen tone.
    dom.emotionRow.addEventListener("click", (e) => {
      const btn = e.target.closest("[data-emotion]");
      if (!btn) return;
      const emotion = btn.dataset.emotion;
      const project = StateStore.getProject();
      const occasionId = (project.occasion && project.occasion.id) || "birthday";
      const draft = GreetingGenerator.generate(emotion, project.recipient.name, project.content.greeting, occasionId, project.recipient.relationship);
      StateStore.update((p) => {
        p.content.emotion = emotion;
        p.content.greeting = draft;
        p.content.autoGreetingEnabled = false;
        p.content.messageMode = "generated";
      }, { reason: "greeting-generated" });
      dom.greetingText.value = draft;
      dom.greetingCount.textContent = draft.length + " / " + GREETING_MAX_CHARS;
      dom.autoGreetingToggle.checked = false;
      markEmotionSelection(emotion);
      syncLayoutControls(StateStore.getProject());
      toast(btn.dataset.label + " greeting written.");
    });
    dom.greetingText.addEventListener("input", (e) => {
      // truncateProse is a no-op here in normal typing (the textarea's own
      // maxlength already keeps this at or under the cap); it only changes
      // behavior in the defensive case where something bypasses that,
      // where it backs up to a word boundary instead of cutting mid-word.
      const val = e.target.value;
      dom.greetingCount.textContent = val.length + " / " + GREETING_MAX_CHARS;
      StateStore.update((p) => {
        p.content.greeting = val;
        p.content.autoGreetingEnabled = false;
        p.content.messageMode = "edited";
      }, { skipHistory: true });
    });
    dom.useEditedMessageBtn.addEventListener("click", () => {
      const exactText = dom.greetingText.value;
      StateStore.update((p) => {
        p.content.greeting = exactText;
        p.content.autoGreetingEnabled = false;
        p.content.messageMode = "manual";
      }, { reason: "message-accepted" });
      dom.autoGreetingToggle.checked = false;
      toast("Edited message saved and used on the card.");
    });
  }

  /* ---------------- Field binding: Typography tab ---------------- */
  function bindTypographyTab() {
    dom.moodSelect.addEventListener("change", (e) => {
      const mood = FontPairings.getMood(e.target.value);
      StateStore.update((p) => {
        p.typography.mood = e.target.value;
        p.typography.pairingId = mood.pairingId;
        p.typography.letterSpacing = mood.letterSpacing;
        p.typography.lineHeight = mood.lineHeight;
        p.typography.userCustomized = true;
      }, { reason: "mood" });
    });

    const sliderBindings = [
      [dom.recipientSize, "recipient-size-out", (p, v) => { p.typography.recipientSize = v; }],
      [dom.greetingSize, "greeting-size-out", (p, v) => { p.typography.greetingSize = v; }],
      [dom.senderSize, "sender-size-out", (p, v) => { p.typography.senderSize = v; }],
      [dom.letterSpacing, "letter-spacing-out", (p, v) => { p.typography.letterSpacing = v; }],
      [dom.lineHeight, "line-height-out", (p, v) => { p.typography.lineHeight = v; }],
    ];
    sliderBindings.forEach(([el, outId, apply]) => {
      el.addEventListener("input", () => {
        const v = parseFloat(el.value);
        document.getElementById(outId).textContent = v;
        StateStore.update((p) => { apply(p, v); p.typography.userCustomized = true; }, { skipHistory: true });
      });
      el.addEventListener("change", () => StateStore.update(() => {}));
    });
  }

  function bindThemeTab() {
    dom.themeFavouriteBtn.addEventListener("click", async () => {
      const project = StateStore.getProject();
      if (!project) return;
      const theme = ThemeRegistry.getTheme(project.theme.id);
      try {
        const isFavourite = await ThemePreferences.toggle(theme.id);
        populateThemeGrid();
        syncThemeFavouriteControls(project);
        toast(isFavourite ? theme.name + " added to favourites." : theme.name + " removed from favourites.");
      } catch (err) {
        toast("Could not update theme favourites.", true);
      }
    });
  }

  /* ---------------- Field binding: Foil tab ---------------- */
  function bindFoilTab() {
    dom.foilMode.addEventListener("change", (e) => {
      StateStore.update((p) => { p.foil.mode = e.target.value; }, { reason: "foil-mode" });
    });
    const sliderBindings = [
      [dom.foilIntensity, "foil-intensity-out", (p, v) => { p.foil.intensity = v; }],
      [dom.foilGrain, "foil-grain-out", (p, v) => { p.foil.grain = v; }],
      [dom.foilHighlight, "foil-highlight-out", (p, v) => { p.foil.highlight = v; }],
      [dom.foilShadow, "foil-shadow-out", (p, v) => { p.foil.shadow = v; }],
    ];
    sliderBindings.forEach(([el, outId, apply]) => {
      el.addEventListener("input", () => {
        const v = parseFloat(el.value);
        document.getElementById(outId).textContent = Math.round(v);
        StateStore.update((p) => apply(p, v), { skipHistory: true });
      });
      el.addEventListener("change", () => StateStore.update(() => {}));
    });
  }

  /* ---------------- Field binding: Photo tab ---------------- */
  function bindPhotoTab() {
    async function useSelectedPhoto(input, sourceLabel) {
      const occasionId = (StateStore.getProject().occasion && StateStore.getProject().occasion.id) || "birthday";
      if (!OccasionRegistry.allowsPhoto(occasionId)) {
        toast("Personal photos are disabled for " + OccasionRegistry.get(occasionId).label + " cards.", true);
        input.value = "";
        return;
      }
      const file = input.files[0];
      if (!file) return;
      try {
        const previousAssetId = StateStore.getProject().photo && StateStore.getProject().photo.assetId;
        const asset = await AssetRepository.storePhoto(file);
        StateStore.update((p) => {
          p.photo = { assetId: asset.id, zoom: 1, panX: 0, panY: 0, rotation: 0 };
        }, { reason: "photo-set" });
        if (previousAssetId) {
          AssetResolver.invalidate(previousAssetId);
          await AssetRepository.deleteAsset(previousAssetId).catch(() => {});
        }
        toast(sourceLabel + " added.");
      } catch (err) {
        toast(err.message || "Could not add that " + sourceLabel.toLowerCase() + ".", true);
      }
      input.value = "";
    }

    dom.photoInput.addEventListener("change", () => {
      useSelectedPhoto(dom.photoInput, "Photo");
    });
    dom.cameraInput.addEventListener("change", () => {
      useSelectedPhoto(dom.cameraInput, "Camera photo");
    });

    // Transform engine. Pan is stored normalised (-1..1) so it survives a
    // change of centrepiece size; the renderer converts it to pixels using
    // whatever slack the current zoom leaves.
    const transformSliders = [
      [dom.photoZoom, dom.photoZoomOut, (p, v) => { p.photo.zoom = v; }, (v) => v.toFixed(2)],
      [dom.photoPanX, dom.photoPanXOut, (p, v) => { p.photo.panX = v / 100; }, (v) => Math.round(v)],
      [dom.photoPanY, dom.photoPanYOut, (p, v) => { p.photo.panY = v / 100; }, (v) => Math.round(v)],
      [dom.photoRotation, dom.photoRotationOut, (p, v) => { p.photo.rotation = v; }, (v) => Math.round(v)],
    ];
    transformSliders.forEach(([el, out, apply, format]) => {
      el.addEventListener("input", () => {
        const v = parseFloat(el.value);
        out.textContent = format(v);
        StateStore.update((p) => { if (p.photo) apply(p, v); }, { skipHistory: true });
      });
      // Commit one history entry when the drag ends, not per frame.
      el.addEventListener("change", () => StateStore.update(() => {}));
    });

    dom.resetTransformBtn.addEventListener("click", () => {
      StateStore.update((p) => {
        if (p.photo) { p.photo.zoom = 1; p.photo.panX = 0; p.photo.panY = 0; p.photo.rotation = 0; }
      }, { reason: "photo-reset" });
      syncPhotoControls(StateStore.getProject());
      toast("Transform reset.");
    });

    dom.photoShapeGroup.addEventListener("click", (e) => {
      const btn = e.target.closest("[data-shape]");
      if (!btn) return;
      StateStore.update((p) => { p.layout.photoShape = btn.dataset.shape; }, { reason: "photo-shape" });
      markShapeSelection(btn.dataset.shape);
    });

    dom.centerpieceList.addEventListener("click", (e) => {
      const item = e.target.closest("[data-centerpiece-id]");
      if (!item) return;
      StateStore.update((p) => { p.layout.centerpieceId = item.dataset.centerpieceId; }, { reason: "centerpiece" });
      markCenterpieceSelection(item.dataset.centerpieceId);
    });

    dom.removePhotoBtn.addEventListener("click", async () => {
      const project = StateStore.getProject();
      if (!project.photo) return;
      const assetId = project.photo.assetId;
      StateStore.update((p) => { p.photo = null; }, { reason: "photo-remove" });
      AssetResolver.invalidate(assetId);
      await AssetRepository.deleteAsset(assetId).catch(() => {});
      toast("Photo removed.");
    });
  }

  /* ---------------- Field binding: Layout balance tab ---------------- */
  function bindLayoutTab() {
    const bindings = [
      [dom.layoutPhotoSize, dom.layoutPhotoSizeOut, (p, v) => { p.layout.centerpieceSize = v; }, (v) => Math.round(v)],
      [dom.layoutTextShift, dom.layoutTextShiftOut, (p, v) => { p.layout.textShift = v; }, (v) => Math.round(v)],
      [dom.layoutTextShiftX, dom.layoutTextShiftXOut, (p, v) => { p.layout.textShiftX = v; }, (v) => Math.round(v)],
      [dom.layoutTextWidth, dom.layoutTextWidthOut, (p, v) => { p.layout.textMaxWidth = v / 100; }, (v) => Math.round(v)],
    ];
    bindings.forEach(([el, out, apply, format]) => {
      el.addEventListener("input", () => {
        const v = parseFloat(el.value);
        out.textContent = format(v);
        StateStore.update((p) => {
          apply(p, v);
          if (el === dom.layoutTextWidth) {
            const maxShiftX = LayoutEngine.getMaxTextShiftX(p.layout.textMaxWidth);
            p.layout.textShiftX = Utils.clamp(p.layout.textShiftX || 0, -maxShiftX, maxShiftX);
            if (dom.layoutTextShiftX) {
              dom.layoutTextShiftX.min = -maxShiftX;
              dom.layoutTextShiftX.max = maxShiftX;
              dom.layoutTextShiftX.value = p.layout.textShiftX;
              dom.layoutTextShiftXOut.textContent = Math.round(p.layout.textShiftX);
            }
          }
        }, { skipHistory: true });
      });
      el.addEventListener("change", () => StateStore.update(() => {}));
    });

    dom.resetLayoutBtn.addEventListener("click", () => {
      StateStore.update((p) => {
        p.layout.centerpieceSize = 620;
        p.layout.textShift = 0;
        p.layout.textShiftX = 0;
        p.layout.textMaxWidth = 0.8;
      }, { reason: "layout-reset" });
      syncLayoutControls(StateStore.getProject());
      toast("Layout balance reset.");
    });
  }

  /* ---------------- Field binding: Stamps tab ---------------- */
  function bindStampsTab() {
    dom.autoArrangeBtn.addEventListener("click", () => {
      const project = StateStore.getProject();
      const theme = ThemeRegistry.getTheme(project.theme.id);
      const pairing = FontPairings.getPairing(project.typography.pairingId);
      // Approximate fixed text boxes for collision purposes using the same
      // layout constants the renderer uses for the recipient/greeting block.
      const fixedBoxes = [
        { id: "recipient-name", x: 150, y: 900, width: 900, height: 140, priority: 100, movable: false },
        { id: "greeting", x: 150, y: 1060, width: 900, height: 160, priority: 90, movable: false },
        { id: "sender-signature", x: 300, y: 1580, width: 600, height: 90, priority: 95, movable: false },
      ];
      const movableBoxes = project.stamps.map(Renderer.stampToLayoutBox);
      const { resolved, violations } = LayoutEngine.autoArrange(fixedBoxes, movableBoxes, 10);
      StateStore.update((p) => {
        resolved.forEach((box) => {
          const stamp = p.stamps.find((s) => s.id === box.id);
          if (stamp) {
            stamp.x = (box.x + box.width / 2) / Renderer.W;
            stamp.y = (box.y + box.height / 2) / Renderer.H;
          }
        });
      }, { reason: "auto-arrange" });
      toast(violations.length ? "Arranged — a few stamps are tight on space." : "Stamps arranged.");
    });

    dom.clearStampsBtn.addEventListener("click", async () => {
      if (!StateStore.getProject().stamps.length) return;
      const ok = await confirmDialog("Remove all placed stamps from this card?", "Clear all stamps");
      if (!ok) return;
      StateStore.update((p) => { p.stamps = []; }, { reason: "stamps-clear" });
      selectedStampId = null;
      hideStampToolbar();
    });

    dom.monogramToggle.addEventListener("change", (e) => {
      const project = StateStore.getProject();
      const existing = project.stamps.find((s) => s.assetId === "monogram");
      if (e.target.checked && !existing) {
        addStamp(StampCollections.getDef("monogram"));
      } else if (!e.target.checked && existing) {
        StateStore.update((p) => { p.stamps = p.stamps.filter((s) => s.assetId !== "monogram"); }, { reason: "monogram-off" });
      }
    });

    dom.selectedStampToolbar.querySelectorAll("[data-stamp-action]").forEach((el) => {
      const action = el.dataset.stampAction;
      if (el.tagName === "BUTTON") {
        el.addEventListener("click", () => handleStampAction(action));
      } else {
        el.addEventListener("input", () => handleStampSlider(action, parseFloat(el.value)));
      }
    });
  }

  function handleStampAction(action) {
    if (!selectedStampId) return;
    if (action === "remove") {
      StateStore.update((p) => { p.stamps = p.stamps.filter((s) => s.id !== selectedStampId); }, { reason: "stamp-remove" });
      selectedStampId = null;
      hideStampToolbar();
      return;
    }
    StateStore.update((p) => {
      const stamp = p.stamps.find((s) => s.id === selectedStampId);
      if (!stamp) return;
      if (action === "layer-back") stamp.layer = "background";
      if (action === "layer-front") stamp.layer = "top";
    }, { reason: "stamp-layer" });
  }

  function handleStampSlider(action, value) {
    if (!selectedStampId) return;
    StateStore.update((p) => {
      const stamp = p.stamps.find((s) => s.id === selectedStampId);
      if (!stamp) return;
      if (action === "scale") stamp.scale = value;
      if (action === "rotation") stamp.rotation = value;
      if (action === "opacity") stamp.opacity = value;
    }, { skipHistory: true });
  }

  function showStampToolbar(stamp) {
    dom.selectedStampToolbar.hidden = false;
    dom.selectedStampToolbar.querySelector('[data-stamp-action="scale"]').value = stamp.scale;
    dom.selectedStampToolbar.querySelector('[data-stamp-action="rotation"]').value = stamp.rotation;
    dom.selectedStampToolbar.querySelector('[data-stamp-action="opacity"]').value = stamp.opacity;
  }
  function hideStampToolbar() { dom.selectedStampToolbar.hidden = true; }

  function positionStampToolbar(project) {
    const occasionId = (project.occasion && project.occasion.id) || "birthday";
    if (!OccasionRegistry.allowsStamps(occasionId)) { selectedStampId = null; hideStampToolbar(); return; }
    if (!selectedStampId) { hideStampToolbar(); return; }
    const stamp = project.stamps.find((s) => s.id === selectedStampId);
    if (!stamp) { selectedStampId = null; hideStampToolbar(); return; }
    dom.selectedStampToolbar.hidden = false;
  }

  /* ---------------- Field binding: Audio tab ---------------- */
  function bindAudioTab() {
    dom.audioInput.addEventListener("change", async (e) => {
      const file = e.target.files[0];
      if (!file) return;
      try {
        const previousAssetId = StateStore.getProject().audio && StateStore.getProject().audio.assetId;
        const asset = await AssetRepository.storeAudio(file);
        StateStore.update((p) => {
          p.audio = { assetId: asset.id, title: file.name.replace(/\.[^.]+$/, ""), duration: asset.duration };
        }, { reason: "audio-set" });
        if (previousAssetId) await AssetRepository.deleteAsset(previousAssetId).catch(() => {});
        await AudioController.load(asset.id);
        refreshAudioUI();
        toast("Audio greeting added.");
      } catch (err) {
        dom.audioFallbackMsg.hidden = false;
        dom.audioFallbackMsg.textContent = err.message || "That audio file could not be used.";
        toast(err.message || "That audio file could not be used.", true);
      }
      e.target.value = "";
    });

    dom.audioPlayBtn.addEventListener("click", () => {
      const state = AudioController.getState();
      if (state.playing) AudioController.pause();
      else AudioController.play();
    });
    dom.audioMuteBtn.addEventListener("click", () => AudioController.toggleMute());
    dom.audioSeek.addEventListener("input", (e) => {
      const state = AudioController.getState();
      AudioController.seek((parseFloat(e.target.value) / 100) * state.duration);
    });
    dom.audioRemoveBtn.addEventListener("click", async () => {
      const project = StateStore.getProject();
      if (!project.audio) return;
      const assetId = project.audio.assetId;
      AudioController.unload();
      StateStore.update((p) => { p.audio = null; }, { reason: "audio-remove" });
      await AssetRepository.deleteAsset(assetId).catch(() => {});
      refreshAudioUI();
      toast("Audio greeting removed.");
    });

    AudioController.subscribe((state) => {
      if (state.error) {
        dom.audioFallbackMsg.hidden = false;
        dom.audioFallbackMsg.textContent = "This browser cannot play the saved audio format.";
      }
      dom.audioPlayBtn.innerHTML = state.playing
        ? '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M7 5h4v14H7zM13 5h4v14h-4z" fill="currentColor"/></svg>'
        : '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M7 5l12 7-12 7V5z" fill="currentColor"/></svg>';
      dom.audioPlayBtn.setAttribute("aria-label", state.playing ? "Pause audio greeting" : "Play audio greeting");
      dom.audioTime.textContent = Utils.formatTime(state.currentTime) + " / " + Utils.formatTime(state.duration);
      if (state.duration) dom.audioSeek.value = String((state.currentTime / state.duration) * 100);
    });
  }

  async function refreshAudioUI() {
    const project = StateStore.getProject();
    if (project.audio && project.audio.assetId) {
      dom.audioPlayer.hidden = false;
      dom.audioTitle.textContent = project.audio.title || "Untitled greeting";
      dom.audioFallbackMsg.hidden = true;
      if (!AudioController.getState().loaded) {
        try { await AudioController.load(project.audio.assetId); } catch (err) { /* surfaced via subscribe */ }
      }
    } else {
      dom.audioPlayer.hidden = true;
    }
  }

  /* ---------------- Canvas pointer interactions (pan/zoom, stamp drag) ---------------- */
  function initCanvasPointerHandlers() {
    const frame = dom.canvasFrame;
    let activePointers = new Map();
    let dragMode = null; // 'stamp' | 'photo'
    let dragStamp = null;
    let dragStart = null;
    let pinchStartDist = null;
    let pinchStartZoom = null;

    function toCardCoords(evt) {
      const rect = frame.getBoundingClientRect();
      const fx = (evt.clientX - rect.left) / rect.width;
      const fy = (evt.clientY - rect.top) / rect.height;
      return { x: fx * Renderer.W, y: fy * Renderer.H, fx, fy };
    }

    function hitTestStamp(cardPos) {
      const project = StateStore.getProject();
      const occasionId = (project.occasion && project.occasion.id) || "birthday";
      if (!OccasionRegistry.allowsStamps(occasionId)) return null;
      const boxes = project.stamps.map((s) => ({ stamp: s, box: Renderer.stampToLayoutBox(s) }));
      for (let i = boxes.length - 1; i >= 0; i--) {
        const { stamp, box } = boxes[i];
        if (cardPos.x >= box.x && cardPos.x <= box.x + box.width && cardPos.y >= box.y && cardPos.y <= box.y + box.height) {
          return stamp;
        }
      }
      return null;
    }

    frame.addEventListener("pointerdown", (e) => {
      frame.setPointerCapture(e.pointerId);
      activePointers.set(e.pointerId, e);
      if (activePointers.size === 2) {
        const pts = Array.from(activePointers.values());
        const project = StateStore.getProject();
        const occasionId = (project.occasion && project.occasion.id) || "birthday";
        if (!OccasionRegistry.allowsPhoto(occasionId) || !project.photo) return;
        pinchStartDist = Math.hypot(pts[0].clientX - pts[1].clientX, pts[0].clientY - pts[1].clientY);
        pinchStartZoom = (project.photo && project.photo.zoom) || 1;
        dragMode = "pinch";
        return;
      }
      const cardPos = toCardCoords(e);
      const hitStamp = hitTestStamp(cardPos);
      if (hitStamp) {
        selectedStampId = hitStamp.id;
        showStampToolbar(hitStamp);
        dragMode = "stamp";
        dragStamp = hitStamp;
        dragStart = { fx: cardPos.fx, fy: cardPos.fy, stampX: hitStamp.x, stampY: hitStamp.y };
      } else {
        selectedStampId = null;
        hideStampToolbar();
        const project = StateStore.getProject();
        const occasionId = (project.occasion && project.occasion.id) || "birthday";
        if (OccasionRegistry.allowsPhoto(occasionId) && project.photo) {
          dragMode = "photo";
          dragStart = { clientX: e.clientX, clientY: e.clientY, panX: project.photo.panX, panY: project.photo.panY };
        }
      }
    });

    frame.addEventListener("pointermove", (e) => {
      if (!activePointers.has(e.pointerId)) return;
      activePointers.set(e.pointerId, e);

      if (dragMode === "pinch" && activePointers.size === 2) {
        const pts = Array.from(activePointers.values());
        const dist = Math.hypot(pts[0].clientX - pts[1].clientX, pts[0].clientY - pts[1].clientY);
        const newZoom = Utils.clamp(pinchStartZoom * (dist / pinchStartDist), 1, 3);
        StateStore.update((p) => { if (p.photo) p.photo.zoom = newZoom; }, { skipHistory: true });
        dom.photoZoom.value = String(newZoom);
        dom.photoZoomOut.textContent = newZoom.toFixed(2);
        scheduleRender("preview");
        return;
      }

      if (dragMode === "stamp" && dragStamp) {
        const cardPos = toCardCoords(e);
        const dx = cardPos.fx - dragStart.fx;
        const dy = cardPos.fy - dragStart.fy;
        StateStore.update((p) => {
          const stamp = p.stamps.find((s) => s.id === dragStamp.id);
          if (stamp) {
            stamp.x = Utils.clamp(dragStart.stampX + dx, 0, 1);
            stamp.y = Utils.clamp(dragStart.stampY + dy, 0, 1);
          }
        }, { skipHistory: true });
        return;
      }

      if (dragMode === "photo") {
        const rect = frame.getBoundingClientRect();
        const dxFrac = (e.clientX - dragStart.clientX) / rect.width;
        const dyFrac = (e.clientY - dragStart.clientY) / rect.height;
        StateStore.update((p) => {
          if (!p.photo) return;
          // Same -1..1 normalised range the pan sliders use, so dragging on
          // the card and dragging the sliders stay in agreement.
          p.photo.panX = Utils.clamp(dragStart.panX + dxFrac * 2.2, -1, 1);
          p.photo.panY = Utils.clamp(dragStart.panY + dyFrac * 2.2, -1, 1);
        }, { skipHistory: true });
        const dragged = StateStore.getProject().photo;
        if (dragged) {
          dom.photoPanX.value = Math.round(dragged.panX * 100);
          dom.photoPanXOut.textContent = Math.round(dragged.panX * 100);
          dom.photoPanY.value = Math.round(dragged.panY * 100);
          dom.photoPanYOut.textContent = Math.round(dragged.panY * 100);
        }
      }
    });

    function endPointer(e) {
      activePointers.delete(e.pointerId);
      if (activePointers.size < 2) { pinchStartDist = null; }
      if (activePointers.size === 0) {
        if (dragMode === "stamp" || dragMode === "photo" || dragMode === "pinch") {
          StateStore.update(() => {}); // commit a history checkpoint after a drag gesture
        }
        dragMode = null;
        dragStamp = null;
        dragStart = null;
      }
    }
    frame.addEventListener("pointerup", endPointer);
    frame.addEventListener("pointercancel", endPointer);
  }

  /* ---------------- Vault ---------------- */
  async function refreshVault(query) {
    const projects = query ? await ProjectVault.searchProjects(query) : await ProjectVault.listProjects();
    const list = dom.vaultList;
    list.innerHTML = "";
    dom.vaultEmpty.hidden = projects.length > 0;
    const currentId = StateStore.getProject().id;
    projects.forEach((project) => {
      const li = document.createElement("li");
      li.className = "vault-item";
      const img = document.createElement("img");
      img.className = "vault-item-thumb";
      img.alt = "";
      img.src = project.thumbnailDataUrl || "";
      const info = document.createElement("div");
      info.className = "vault-item-info";
      const title = document.createElement("span");
      title.className = "vault-item-title";
      title.textContent = project.title + (project.id === currentId ? " (current)" : "");
      const meta = document.createElement("span");
      meta.className = "vault-item-meta";
      meta.textContent = "Updated " + Utils.timeAgo(project.updatedAt);
      info.appendChild(title);
      info.appendChild(meta);
      const actions = document.createElement("div");
      actions.className = "vault-item-actions";

      const openBtn = iconTextButton("Open");
      openBtn.addEventListener("click", async () => { await openProject(project.id); closeDialog(dom.vaultDialog); });

      const dupBtn = iconTextButton("Duplicate");
      dupBtn.addEventListener("click", async () => {
        const copy = await ProjectVault.duplicateProject(project.id);
        toast("Duplicated as “" + copy.title + "”");
        refreshVault(dom.vaultSearch.value);
      });

      const renameBtn = iconTextButton("Rename");
      renameBtn.addEventListener("click", async () => {
        const newTitle = await renameDialog(project.title);
        if (!newTitle) return;
        await ProjectVault.renameProject(project.id, newTitle);
        if (project.id === currentId) StateStore.update((p) => { p.title = newTitle; }, { reason: "rename" });
        refreshVault(dom.vaultSearch.value);
      });

      const deleteBtn = iconTextButton("Delete", true);
      deleteBtn.addEventListener("click", async () => {
        const ok = await confirmDialog("Permanently delete “" + project.title + "”? This cannot be undone.", "Delete card");
        if (!ok) return;
        await ProjectVault.deleteProject(project.id);
        toast("Card deleted.");
        if (project.id === currentId) await startNewSession();
        refreshVault(dom.vaultSearch.value);
      });

      [openBtn, dupBtn, renameBtn, deleteBtn].forEach((b) => actions.appendChild(b));
      li.appendChild(img);
      li.appendChild(info);
      li.appendChild(actions);
      list.appendChild(li);
    });
    refreshStorageIndicator();
  }

  function iconTextButton(text, danger) {
    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = "mini-btn" + (danger ? " mini-btn-danger" : "");
    btn.textContent = text;
    btn.style.fontSize = "10.5px";
    btn.style.padding = "0 8px";
    btn.style.height = "30px";
    return btn;
  }

  async function refreshStorageIndicator() {
    const est = await ProjectVault.getStorageEstimate();
    dom.storageUsage.textContent = est.supported
      ? "Storage: " + Utils.formatBytes(est.usage) + " used" + (est.quota ? " of " + Utils.formatBytes(est.quota) : "")
      : "Storage usage is not reported by this browser.";
  }

  async function openProject(id) {
    const record = await ProjectVault.getProject(id);
    if (!record) { toast("That card could not be found.", true); return; }
    const migrated = Migrations.migrate(Utils.clone(record));
    StateStore.init(migrated);
    AudioController.unload();
    AssetResolver.clear();
    dom.projectTitle.value = migrated.title;
    syncControlsFromState(migrated);
    await refreshAudioUI();
    await DB.put("settings", { key: "lastProjectId", value: id });
    scheduleRender("preview");
  }

  async function startNewSession() {
    const project = await ProjectVault.createProject();
    StateStore.init(project);
    AudioController.unload();
    AssetResolver.clear();
    dom.projectTitle.value = project.title;
    syncControlsFromState(project);
    await refreshAudioUI();
    await DB.put("settings", { key: "lastProjectId", value: project.id });
    scheduleRender("preview");
  }

  function bindVault() {
    dom.openVaultBtn.addEventListener("click", () => { openDialog(dom.vaultDialog); refreshVault(""); });
    document.querySelectorAll("[data-close-dialog]").forEach((btn) => {
      btn.addEventListener("click", () => closeDialog(document.getElementById(btn.dataset.closeDialog)));
    });
    dom.vaultSearch.addEventListener("input", Utils.debounce((e) => refreshVault(e.target.value), 200));
    dom.newProjectBtn.addEventListener("click", async () => {
      await startNewSession();
      closeDialog(dom.vaultDialog);
      toast("New card started.");
    });
    dom.exportBackupBtn.addEventListener("click", async () => {
      try {
        const backup = await ProjectVault.exportBackup(StateStore.getProject().id);
        const blob = new Blob([JSON.stringify(backup)], { type: "application/json" });
        ExportModule.downloadBlob(blob, "atul-card-backup-" + Utils.sanitizeFilenamePart(backup.project.title) + ".json");
        toast("Backup downloaded.");
      } catch (err) {
        toast(err.message || "Could not export a backup.", true);
      }
    });
    dom.importBackupInput.addEventListener("change", async (e) => {
      const file = e.target.files[0];
      if (!file) return;
      try {
        const project = await ProjectVault.importBackup(file);
        toast("Imported “" + project.title + "”");
        refreshVault(dom.vaultSearch.value);
      } catch (err) {
        toast(err.message || "That backup could not be imported.", true);
      }
      e.target.value = "";
    });
  }

  /* ---------------- Export dialog ---------------- */
  function bindExport() {
    let lastPngBlob = null, lastPngFilename = null;

    dom.openExportBtn.addEventListener("click", () => {
      dom.exportStatus.textContent = "";
      // Never offer a previously rendered theme through Share after the
      // user has changed the card and reopened this dialog.
      lastPngBlob = null;
      lastPngFilename = null;
      dom.sharePngBtn.hidden = !ExportModule.canShareFiles(new File([""], "x.png", { type: "image/png" }));
      openDialog(dom.exportDialog);
    });

    dom.exportPngBtn.addEventListener("click", async () => {
      const project = StateStore.getProject();
      try {
        ExportModule.assertSafeForOutput(project);
      } catch (err) {
        dom.exportStatus.textContent = err.message;
        toast(err.message, true);
        return;
      }
      const theme = ThemeRegistry.getTheme(project.theme.id);
      const expectedFilename = ExportModule.buildFilename(project, theme);
      let saveHandle = null;
      if (ExportModule.canUseSavePicker()) {
        try {
          // Must be invoked before any rendering await so the browser keeps
          // the user's click activation for this second or later export.
          saveHandle = await ExportModule.choosePngDestination(expectedFilename);
        } catch (err) {
          if (err && err.name === "AbortError") {
            dom.exportStatus.textContent = "Download cancelled.";
            return;
          }
          dom.exportStatus.textContent = "Could not open the Save dialog.";
          toast("PNG export could not start.", true);
          return;
        }
      }

      dom.exportStatus.textContent = "Rendering high-resolution PNG…";
      dom.exportPngBtn.disabled = true;
      try {
        StateStore.flushAutosave();
        const { blob, filename, diagnostics } = await ExportModule.exportPng(project);
        lastPngBlob = blob; lastPngFilename = filename;
        const result = await ExportModule.savePng(blob, filename, saveHandle);
        dom.exportStatus.textContent = diagnostics.textOverflow
          ? "PNG " + result + ". Note: some text was tight for its space in this export."
          : (result === "saved" ? "Saved " : "Downloaded ") + filename;
        dom.sharePngBtn.hidden = !ExportModule.canShareFiles(new File([blob], filename, { type: "image/png" }));
      } catch (err) {
        dom.exportStatus.textContent = "Export failed: " + (err.message || "unknown error.");
        toast("PNG export failed.", true);
      } finally {
        dom.exportPngBtn.disabled = false;
      }
    });

    dom.sharePngBtn.addEventListener("click", async () => {
      try {
        ExportModule.assertSafeForOutput(StateStore.getProject());
        if (!lastPngBlob) {
          const result = await ExportModule.exportPng(StateStore.getProject());
          lastPngBlob = result.blob; lastPngFilename = result.filename;
        }
        await ExportModule.sharePng(lastPngBlob, lastPngFilename);
      } catch (err) {
        toast(err.message || "Sharing was cancelled or is unavailable.", true);
      }
    });

    dom.exportDigitalBtn.addEventListener("click", async () => {
      dom.exportStatus.textContent = "Packaging digital card…";
      try {
        ExportModule.assertSafeForOutput(StateStore.getProject());
        StateStore.flushAutosave();
        const { blob, filename } = await ExportModule.exportDigitalCardPackage(StateStore.getProject().id);
        ExportModule.downloadBlob(blob, filename);
        dom.exportStatus.textContent = "Downloaded " + filename + ". Open it in this app on another device to view it — there is no hosted link to share yet.";
      } catch (err) {
        dom.exportStatus.textContent = "Could not build the digital card package.";
        toast(err.message || "Digital card export failed.", true);
      }
    });
  }

  /* ---------------- Sync controls from state (on load / undo / theme change) ---------------- */
  // Mirrors photo/centrepiece state onto its controls, and disables the
  // transform engine outright when there is no photo to transform.
  function syncPhotoControls(project) {
    const occasionId = (project.occasion && project.occasion.id) || "birthday";
    const occ = OccasionRegistry.get(occasionId);
    const allowPhoto = occ.allowPhoto !== false;
    const photo = allowPhoto ? project.photo : null;

    if (dom.photoDisabledNotice) {
      dom.photoDisabledNotice.hidden = allowPhoto;
      if (!allowPhoto && FestivalDesignRegistry.isFestival(occasionId)) {
        dom.photoDisabledNotice.querySelector("strong").textContent = "Festival cards use their selected artwork rather than a personal photo.";
        dom.photoDisabledNotice.querySelector("p").textContent = "Choose a festival card design in Content. Your greeting, names, and date remain fully editable.";
      } else if (!allowPhoto) {
        dom.photoDisabledNotice.querySelector("strong").textContent = "Personal photos are disabled for Condolence / Sympathy cards.";
        dom.photoDisabledNotice.querySelector("p").textContent = "Condolence cards use restrained tribute centrepieces and elegant typography.";
      }
    }
    if (dom.photoUploadField) dom.photoUploadField.hidden = !allowPhoto;
    if (dom.photoShapeFieldset) dom.photoShapeFieldset.hidden = !allowPhoto;
    if (dom.photoCenterpieceFieldset) dom.photoCenterpieceFieldset.hidden = !allowPhoto;

    if (dom.photoTransformFieldset) {
      dom.photoTransformFieldset.disabled = !photo || !allowPhoto;
      dom.photoTransformFieldset.hidden = !allowPhoto;
    }
    if (dom.removePhotoBtn) {
      dom.removePhotoBtn.disabled = !photo;
      dom.removePhotoBtn.hidden = !allowPhoto;
    }

    const zoom = photo ? photo.zoom : 1;
    const panX = photo ? (photo.panX || 0) : 0;
    const panY = photo ? (photo.panY || 0) : 0;
    const rotation = photo ? (photo.rotation || 0) : 0;
    dom.photoZoom.value = zoom;
    dom.photoZoomOut.textContent = Number(zoom).toFixed(2);
    dom.photoPanX.value = Math.round(panX * 100);
    dom.photoPanXOut.textContent = Math.round(panX * 100);
    dom.photoPanY.value = Math.round(panY * 100);
    dom.photoPanYOut.textContent = Math.round(panY * 100);
    dom.photoRotation.value = rotation;
    dom.photoRotationOut.textContent = Math.round(rotation);

    markShapeSelection((project.layout && project.layout.photoShape) || "circle");
    populateCenterpieceList(occasionId);
    markCenterpieceSelection((project.layout && project.layout.centerpieceId) || "auto");
  }

  function syncLayoutControls(project) {
    const design = OccasionRegistry.getDesign(
      project.occasion && project.occasion.id,
      project.content && project.content.emotion
    );
    const size = project.layout.centerpieceSize || 620;
    const shift = project.layout.textShift || 0;
    const widthRatio = project.layout.textMaxWidth || 0.8;
    const widthPercent = Math.round(widthRatio * 100);
    const maxShiftX = LayoutEngine.getMaxTextShiftX(widthRatio);
    const shiftX = Utils.clamp(project.layout.textShiftX || 0, -maxShiftX, maxShiftX);
    project.layout.textShiftX = shiftX;

    if (dom.layoutCenterpieceSizeField) {
      dom.layoutCenterpieceSizeField.hidden = !!design && !design.showCenterpieceSize;
    }

    dom.layoutPhotoSize.value = size;
    dom.layoutPhotoSizeOut.textContent = Math.round(size);
    dom.layoutTextShift.value = shift;
    dom.layoutTextShiftOut.textContent = Math.round(shift);
    if (dom.layoutTextShiftX) {
      dom.layoutTextShiftX.min = -maxShiftX;
      dom.layoutTextShiftX.max = maxShiftX;
      dom.layoutTextShiftX.value = shiftX;
      dom.layoutTextShiftXOut.textContent = Math.round(shiftX);
    }
    dom.layoutTextWidth.value = widthPercent;
    dom.layoutTextWidthOut.textContent = widthPercent;
  }

  function syncControlsFromState(project) {
    const occasionId = (project.occasion && project.occasion.id) || "birthday";
    const allowStamps = OccasionRegistry.allowsStamps(occasionId);
    if (dom.occasionSelect) dom.occasionSelect.value = occasionId;
    populateEmotionRow(occasionId);
    syncOccasionEditor(project);
    syncFestivalDesignControls(project);

    if (dom.stampsTab) {
      const stampsWasSelected = dom.stampsTab.getAttribute("aria-selected") === "true";
      dom.stampsTab.hidden = !allowStamps;
      dom.stampsTab.disabled = !allowStamps;
      if (!allowStamps && stampsWasSelected) selectTab(dom.contentTab);
    }

    dom.recipientName.value = project.recipient.name || "";
    dom.recipientRelationship.value = project.recipient.relationship || "";
    dom.senderName.value = project.sender.name || "";
    const cardDate = project.cardDate || { value: localDateISO(project.createdAt), visible: false };
    dom.cardDate.value = cardDate.value || localDateISO(project.createdAt);
    dom.cardDateVisible.checked = !!cardDate.visible;
    dom.autoGreetingToggle.checked = !!project.content.autoGreetingEnabled;
    dom.greetingText.value = project.content.greeting || "";
    dom.greetingCount.textContent = (project.content.greeting || "").length + " / " + GREETING_MAX_CHARS;
    markEmotionSelection(project.content.emotion);
    syncGreetingSafety(project);

    document.querySelectorAll("#theme-grid .swatch").forEach((el) => {
      el.setAttribute("aria-checked", String(el.dataset.themeId === project.theme.id));
    });
    syncThemeFavouriteControls(project);
    document.querySelectorAll("#foil-grid .swatch").forEach((el) => {
      el.setAttribute("aria-checked", String(el.dataset.foilId === project.foil.presetId));
    });
    document.querySelectorAll("#pairing-list .option-item").forEach((el) => {
      el.setAttribute("aria-checked", String(el.dataset.pairingId === project.typography.pairingId));
    });

    dom.moodSelect.value = project.typography.mood;
    dom.recipientSize.value = project.typography.recipientSize;
    dom.recipientSizeOut.textContent = project.typography.recipientSize;
    dom.greetingSize.value = project.typography.greetingSize;
    dom.greetingSizeOut.textContent = project.typography.greetingSize;
    dom.senderSize.value = project.typography.senderSize;
    dom.senderSizeOut.textContent = project.typography.senderSize;
    dom.letterSpacing.value = project.typography.letterSpacing;
    dom.letterSpacingOut.textContent = project.typography.letterSpacing;
    dom.lineHeight.value = project.typography.lineHeight;
    dom.lineHeightOut.textContent = project.typography.lineHeight;

    dom.foilMode.value = project.foil.mode;
    dom.foilIntensity.value = project.foil.intensity; dom.foilIntensityOut.textContent = Math.round(project.foil.intensity);
    dom.foilGrain.value = project.foil.grain; dom.foilGrainOut.textContent = Math.round(project.foil.grain);
    dom.foilHighlight.value = project.foil.highlight; dom.foilHighlightOut.textContent = Math.round(project.foil.highlight);
    dom.foilShadow.value = project.foil.shadow; dom.foilShadowOut.textContent = Math.round(project.foil.shadow);

    syncPhotoControls(project);
    syncLayoutControls(project);

    dom.monogramToggle.checked = project.stamps.some((s) => s.assetId === "monogram");
    selectedStampId = null;
    hideStampToolbar();
  }

  /* ---------------- Undo / redo ---------------- */
  function bindUndoRedo() {
    dom.undoBtn.addEventListener("click", () => StateStore.undo());
    dom.redoBtn.addEventListener("click", () => StateStore.redo());
    document.addEventListener("keydown", (e) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "z" && !e.shiftKey) { e.preventDefault(); StateStore.undo(); }
      if ((e.ctrlKey || e.metaKey) && (e.key.toLowerCase() === "y" || (e.key.toLowerCase() === "z" && e.shiftKey))) { e.preventDefault(); StateStore.redo(); }
    });
    StateStore.subscribeHistory((h) => {
      dom.undoBtn.disabled = !h.canUndo;
      dom.redoBtn.disabled = !h.canRedo;
    });
  }

  /* ---------------- Project title ---------------- */
  function bindProjectTitle() {
    dom.projectTitle.addEventListener("change", (e) => {
      const title = Utils.sanitizeText(e.target.value, 60) || "Untitled Card";
      dom.projectTitle.value = title;
      StateStore.update((p) => { p.title = title; }, { reason: "title" });
    });
  }

  /* ---------------- Text-only preview toggle ---------------- */
  function bindTextPreviewToggle() {
    dom.toggleTextPreview.addEventListener("click", () => {
      const expanded = dom.toggleTextPreview.getAttribute("aria-expanded") === "true";
      dom.toggleTextPreview.setAttribute("aria-expanded", String(!expanded));
      dom.textPreviewPanel.hidden = expanded;
      if (!expanded) renderTextPreview(StateStore.getProject());
    });
  }

  /* ---------------- High-contrast toggle ---------------- */
  function bindContrastToggle() {
    dom.contrastToggleBtn.addEventListener("click", () => {
      const isHigh = document.documentElement.getAttribute("data-contrast") === "high";
      document.documentElement.setAttribute("data-contrast", isHigh ? "normal" : "high");
      dom.contrastToggleBtn.setAttribute("aria-pressed", String(!isHigh));
    });
  }

  /* ---------------- PWA status UI ---------------- */
  function bindPWAStatus() {
    PWAStatus.subscribe((state) => {
      dom.offlineBadge.hidden = state.online;
      dom.offlineReadyBadge.hidden = !state.offlineReady;
      dom.updateBanner.hidden = !state.updateAvailable;
      dom.installBtn.hidden = !state.installPromptAvailable;
    });
    dom.installBtn.addEventListener("click", () => PWAStatus.promptInstall());
    dom.updateReloadBtn.addEventListener("click", () => PWAStatus.applyUpdate());
    dom.updateDismissBtn.addEventListener("click", () => { dom.updateBanner.hidden = true; });
  }

  /* ---------------- Autosave + thumbnail ---------------- */
  async function generateThumbnail(project) {
    try {
      const canvas = document.createElement("canvas");
      canvas.width = 120; canvas.height = 176;
      const full = document.createElement("canvas");
      full.width = Renderer.W; full.height = Renderer.H;
      const fctx = full.getContext("2d");
      await Renderer.renderCard(fctx, project, AssetResolver, { quality: "preview" });
      const ctx = canvas.getContext("2d");
      ctx.drawImage(full, 0, 0, 120, 176);
      return canvas.toDataURL("image/jpeg", 0.7);
    } catch (err) {
      return null;
    }
  }

  function bindAutosave() {
    let thumbTimer = null;
    StateStore.setAutosaveHandler(async (project) => {
      announceSaveStatus("Saving…");
      try {
        await ProjectVault.saveProject(project);
        hasUnsavedChanges = false;
        announceSaveStatus("Saved");
        clearTimeout(thumbTimer);
        thumbTimer = setTimeout(async () => {
          const thumb = await generateThumbnail(StateStore.getProject());
          if (thumb) await ProjectVault.saveProject(StateStore.getProject(), thumb);
        }, 1500);
      } catch (err) {
        announceSaveStatus("Save failed");
        toast("Could not save your changes. Your browser's storage may be full.", true);
      }
    });
  }

  /* ---------------- Bootstrap ---------------- */
  function cacheDom() {
    Object.assign(dom, {
      toastRegion: $("#toast-region"),
      saveStatus: $("#save-status"),
      offlineBadge: $("#offline-badge"),
      offlineReadyBadge: $("#offline-ready-badge"),
      updateBanner: $("#update-banner"),
      updateReloadBtn: $("#update-reload-btn"),
      updateDismissBtn: $("#update-dismiss-btn"),
      installBtn: $("#install-btn"),
      contrastToggleBtn: $("#contrast-toggle-btn"),
      undoBtn: $("#undo-btn"), redoBtn: $("#redo-btn"),
      openVaultBtn: $("#open-vault-btn"), openExportBtn: $("#open-export-btn"),
      projectTitle: $("#project-title"), appVersion: $("#app-version"),

      canvas: $("#card-canvas"), canvasFrame: $("#canvas-frame"),
      diagnosticsBanner: $("#diagnostics-banner"),
      selectedStampToolbar: $("#selected-stamp-toolbar"),
      contentTab: $("#tab-content"), themeTab: $("#tab-theme"), typographyTab: $("#tab-typography"),
      foilTab: $("#tab-foil"), layoutTab: $("#tab-layout"), stampsTab: $("#tab-stamps"),
      toggleTextPreview: $("#toggle-text-preview"), textPreviewPanel: $("#text-preview-panel"),

      recipientName: $("#recipient-name"), recipientRelationship: $("#recipient-relationship"),
      recipientRelationshipLabel: $("#recipient-relationship-label"), recipientRelationshipHint: $("#recipient-relationship-hint"),
      occasionSelect: $("#occasion-select"),
      festivalDesignField: $("#festival-design-field"), festivalDesignList: $("#festival-design-list"),
      senderName: $("#sender-name"), cardDate: $("#card-date"), cardDateVisible: $("#card-date-visible"),
      autoGreetingToggle: $("#auto-greeting-toggle"),
      emotionRow: $("#emotion-row"), greetingText: $("#greeting-text"), greetingCount: $("#greeting-count"),
      greetingSafetyWarning: $("#greeting-safety-warning"), useEditedMessageBtn: $("#use-edited-message-btn"),

      themeGrid: $("#theme-grid"), themeFavouriteBtn: $("#theme-favourite-btn"), themeFavouriteHint: $("#theme-favourite-hint"),

      moodSelect: $("#mood-select"), pairingList: $("#pairing-list"),
      recipientSize: $("#recipient-size"), recipientSizeOut: $("#recipient-size-out"),
      greetingSize: $("#greeting-size"), greetingSizeOut: $("#greeting-size-out"),
      senderSize: $("#sender-size"), senderSizeOut: $("#sender-size-out"),
      letterSpacing: $("#letter-spacing"), letterSpacingOut: $("#letter-spacing-out"),
      lineHeight: $("#line-height"), lineHeightOut: $("#line-height-out"),

      foilGrid: $("#foil-grid"), foilMode: $("#foil-mode"),
      foilIntensity: $("#foil-intensity"), foilIntensityOut: $("#foil-intensity-out"),
      foilGrain: $("#foil-grain"), foilGrainOut: $("#foil-grain-out"),
      foilHighlight: $("#foil-highlight"), foilHighlightOut: $("#foil-highlight-out"),
      foilShadow: $("#foil-shadow"), foilShadowOut: $("#foil-shadow-out"),

      photoDisabledNotice: $("#photo-disabled-notice"),
      photoUploadField: $("#photo-upload-field"),
      photoShapeFieldset: $("#photo-shape-fieldset"),
      photoInput: $("#photo-input"), cameraInput: $("#camera-input"),
      photoZoom: $("#photo-zoom"), photoZoomOut: $("#photo-zoom-out"),
      photoPanX: $("#photo-pan-x"), photoPanXOut: $("#photo-pan-x-out"),
      photoPanY: $("#photo-pan-y"), photoPanYOut: $("#photo-pan-y-out"),
      photoRotation: $("#photo-rotation"), photoRotationOut: $("#photo-rotation-out"),
      photoTransformFieldset: $("#photo-transform-fieldset"), resetTransformBtn: $("#reset-transform-btn"),
      photoShapeGroup: $("#photo-shape-group"),
      photoCenterpieceFieldset: $("#photo-centerpiece-fieldset"),
      centerpieceList: $("#centerpiece-list"),
      removePhotoBtn: $("#remove-photo-btn"),

      layoutCenterpieceSizeField: $("#layout-centerpiece-size-field"),
      layoutPhotoSize: $("#layout-photo-size"), layoutPhotoSizeOut: $("#layout-photo-size-out"),
      layoutTextShift: $("#layout-text-shift"), layoutTextShiftOut: $("#layout-text-shift-out"),
      layoutTextShiftX: $("#layout-text-shift-x"), layoutTextShiftXOut: $("#layout-text-shift-x-out"),
      layoutTextWidth: $("#layout-text-width"), layoutTextWidthOut: $("#layout-text-width-out"),
      resetLayoutBtn: $("#reset-layout-btn"),

      stampGallery: $("#stamp-gallery"), autoArrangeBtn: $("#auto-arrange-btn"),
      clearStampsBtn: $("#clear-stamps-btn"), monogramToggle: $("#monogram-toggle"),

      audioInput: $("#audio-input"), audioPlayer: $("#audio-player"), audioPlayBtn: $("#audio-play-btn"),
      audioTitle: $("#audio-title"), audioSeek: $("#audio-seek"), audioTime: $("#audio-time"),
      audioMuteBtn: $("#audio-mute-btn"), audioRemoveBtn: $("#audio-remove-btn"), audioFallbackMsg: $("#audio-fallback-msg"),

      vaultDialog: $("#vault-dialog"), vaultSearch: $("#vault-search"), vaultList: $("#vault-list"), vaultEmpty: $("#vault-empty"),
      newProjectBtn: $("#new-project-btn"), storageUsage: $("#storage-usage"),
      exportBackupBtn: $("#export-backup-btn"), importBackupInput: $("#import-backup-input"),

      exportDialog: $("#export-dialog"), exportPngBtn: $("#export-png-btn"), sharePngBtn: $("#share-png-btn"),
      exportDigitalBtn: $("#export-digital-btn"), exportStatus: $("#export-status"),
    });
  }

  async function init() {
    cacheDom();
    dom.appVersion.textContent = "v" + APP_VERSION;
    initTabs();
    await ThemePreferences.init();
    populateOccasionSelect();
    populateThemeGrid();
    populateFoilGrid();
    populatePairingList();
    populateEmotionRow();
    populateCenterpieceList();
    // populateStampGallery() is intentionally NOT called here: it reads
    // StateStore.getProject() (for the current theme's foil preset and the
    // recipient's monogram initials), but no project exists yet this early
    // in bootstrap. It runs once StateStore.init() fires below, picked up
    // by the "init" reason in the subscribe callback via
    // populateStampGalleryThumbsIfThemeChanged().

    bindContentTab();
    bindThemeTab();
    bindTypographyTab();
    bindFoilTab();
    bindPhotoTab();
    bindLayoutTab();
    bindStampsTab();
    bindAudioTab();
    bindVault();
    bindExport();
    bindUndoRedo();
    bindProjectTitle();
    bindTextPreviewToggle();
    bindContrastToggle();
    bindPWAStatus();
    bindAutosave();
    initCanvasPointerHandlers();

    StateStore.subscribe((project, reason) => {
      if (reason !== "init" && reason !== "silent") hasUnsavedChanges = true;
      if (reason !== "silent") scheduleRender(reason === "photo-rotate" || reason === "theme-change" || reason === "occasion-change" ? "preview" : "preview");
      syncGreetingSafety(project);
      populateStampGalleryThumbsIfThemeChanged(reason);
      if (reason === "photo-set" || reason === "photo-remove" || reason === "photo-reset") {
        syncPhotoControls(project);
      }
      if (reason === "theme-change" || reason === "occasion-change" || reason === "init" || reason === "undo" || reason === "redo") {
        syncControlsFromState(project);
      }
    });

    let lastThemeForGallery = null;
    let lastOccasionForGallery = null;
    function populateStampGalleryThumbsIfThemeChanged(reason) {
      if (reason === "theme-change" || reason === "occasion-change" || reason === "init") {
        const project = StateStore.getProject();
        const themeId = project.theme.id;
        const occasionId = (project.occasion && project.occasion.id) || "birthday";
        if (themeId !== lastThemeForGallery || occasionId !== lastOccasionForGallery) {
          lastThemeForGallery = themeId;
          lastOccasionForGallery = occasionId;
          populateStampGallery();
        }
      }
    }

    window.addEventListener("beforeunload", (event) => {
      StateStore.flushAutosave();
      if (hasUnsavedChanges) {
        event.preventDefault();
        event.returnValue = "";
      }
    });
    document.addEventListener("visibilitychange", () => {
      if (document.hidden) StateStore.flushAutosave();
    });
    window.addEventListener("resize", Utils.debounce(() => scheduleRender("preview"), 150));

    // Restore last session, or create a new project.
    try {
      const last = await DB.get("settings", "lastProjectId");
      if (last && last.value) {
        const record = await ProjectVault.getProject(last.value);
        if (record) {
          await openProject(last.value);
        } else {
          await startNewSession();
        }
      } else {
        await startNewSession();
      }
    } catch (err) {
      console.error("Could not restore the last session; starting a new card.", err);
      await startNewSession();
    }

    PWAStatus.register();
  }

  return { init };
})();

document.addEventListener("DOMContentLoaded", () => {
  App.init().catch((err) => {
    console.error("Fatal startup error", err);
  });
});
