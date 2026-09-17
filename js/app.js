/* =========================================================================
   Atul Birthday Card Studio — js/app.js
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
    uuid, clamp, debounce, clone, sanitizeText, sanitizeFilenamePart,
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
  ];

  function getPreset(id) { return PRESETS.find((p) => p.id === id) || PRESETS[0]; }
  function list() { return PRESETS; }

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
      background: { top: "#f4efe4", bottom: "#e3dac6", texture: "marble", textureTint: "#ffffff", vignette: 0.28, light: true },
      palette: { primary: "#8f6c2c", secondary: "#5b4a30", text: "#2c2416", mutedText: "#6b5f4c", foil: "champagne" },
      centerpiece: { style: "gradient-frame", colors: ["#fffaf0", "#e9ddc2", "#cbb98f"] },
      typographyDefaults: { pairingId: "cormorant-inter", mood: "classic", recipientSize: 76, greetingSize: 28 },
      foilPresetId: "champagne",
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
   SECTION: StateStore
   Owns the canonical CardProject, undo/redo history, autosave scheduling,
   and schema migrations. All mutation flows through `update()`, which
   applies an immutable patch, pushes history, notifies subscribers (which
   trigger a render) and schedules a debounced autosave.
   ========================================================================= */
const CURRENT_SCHEMA_VERSION = 1;

function createDefaultProject(overrides) {
  const now = Date.now();
  const base = {
    id: Utils.uuid(),
    version: CURRENT_SCHEMA_VERSION,
    title: "Untitled Card",
    createdAt: now,
    updatedAt: now,
    recipient: { name: "", relationship: "" },
    sender: { name: "" },
    content: { greeting: "", autoGreetingEnabled: false, emotion: "warm" },
    theme: { id: "midnight-obsidian" },
    photo: null,
    layout: { photoScale: 1, textPosition: 0.62, textMaxWidth: 0.8 },
    typography: {
      pairingId: "cinzel-source-sans",
      mood: "regal",
      recipientSize: 78,
      greetingSize: 28,
      senderSize: 22,
      letterSpacing: 1.4,
      lineHeight: 1.3,
    },
    foil: { presetId: "gold", mode: "foil", intensity: 70, grain: 35, highlight: 60, shadow: 50 },
    stamps: [],
    audio: null,
  };
  return Object.assign(base, overrides || {});
}

const AUTO_GREETINGS = {
  warm: "Wishing you a birthday as warm and wonderful as you are.",
  joyful: "Here's to a year ahead bursting with joy and celebration!",
  elegant: "On this beautiful day, may every moment be as graceful as you.",
  playful: "Cake first, resolutions later. Happy birthday!",
  romantic: "Every year with you is a gift. Happy birthday, my love.",
};

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
    // No migrations yet beyond v1 (initial schema). Future steps append here,
    // each one bumping `record.version` and recorded in schema-migrations.
    if (v < CURRENT_SCHEMA_VERSION) {
      record.version = CURRENT_SCHEMA_VERSION;
    }
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
    return { ...best, overflow: true };
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

  return {
    CANVAS_W, CANVAS_H, SAFE_MARGIN, NATIVE_LETTER_SPACING,
    measureTextWidth, wrapText, measureWrappedText, fitText, drawLines,
    getSafeZone, boxesOverlap, detectCollisions, isOutsideSafeZone, autoArrange,
  };
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

  const PHOTO_BOX = { x: 150, y: 128, width: 900, height: 760 };

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

  function generateMarbleTile(ctx, size, tint) {
    ctx.fillStyle = tint;
    ctx.fillRect(0, 0, size, size);
    const rand = mulberry32(7);
    for (let i = 0; i < 6; i++) {
      ctx.save();
      ctx.globalAlpha = 0.08 + rand() * 0.08;
      ctx.strokeStyle = "#ffffff";
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
      tile = getCachedTile("marble-" + theme.id, size, (c) => generateMarbleTile(c, size, theme.background.textureTint));
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

  /* ---------------- 1-4: Background, texture, vignette ---------------- */
  function renderBackground(ctx, theme, quality) {
    const grad = ctx.createLinearGradient(0, 0, 0, H);
    grad.addColorStop(0, theme.background.top);
    grad.addColorStop(1, theme.background.bottom);
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, W, H);

    drawTexture(ctx, theme, quality);

    // Vignette / edge shading
    const vg = ctx.createRadialGradient(W / 2, H * 0.42, H * 0.25, W / 2, H * 0.5, H * 0.75);
    const vigColor = theme.background.light ? "0,0,0" : "0,0,0";
    vg.addColorStop(0, "rgba(" + vigColor + ",0)");
    vg.addColorStop(1, "rgba(" + vigColor + "," + theme.background.vignette + ")");
    ctx.fillStyle = vg;
    ctx.fillRect(0, 0, W, H);
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

  function renderCenterpieceFallback(ctx, theme, monogram) {
    const { x, y, width, height } = PHOTO_BOX;
    ctx.save();
    roundRectPath(ctx, x, y, width, height, 18);
    ctx.clip();
    const grad = ctx.createRadialGradient(
      x + width * 0.5, y + height * 0.4, 20,
      x + width * 0.5, y + height * 0.5, width * 0.75
    );
    theme.centerpiece.colors.forEach((c, i) => grad.addColorStop(i / (theme.centerpiece.colors.length - 1), c));
    ctx.fillStyle = grad;
    ctx.fillRect(x, y, width, height);
    // Soft bokeh dots
    const rand = mulberry32(theme.id.length * 13 + 3);
    for (let i = 0; i < 14; i++) {
      ctx.beginPath();
      const bx = x + rand() * width, by = y + rand() * height, br = 14 + rand() * 46;
      ctx.globalAlpha = 0.05 + rand() * 0.08;
      ctx.fillStyle = theme.palette.primary;
      ctx.arc(bx, by, br, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.globalAlpha = 1;
    if (monogram) {
      ctx.font = "500 " + Math.round(width * 0.32) + "px 'Cormorant Garamond', serif";
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.globalAlpha = 0.22;
      ctx.fillStyle = theme.palette.primary;
      ctx.fillText(monogram.toUpperCase(), x + width / 2, y + height / 2);
      ctx.globalAlpha = 1;
    }
    ctx.restore();
  }

  async function renderPhoto(ctx, project, theme, photoImage, monogram) {
    const { x, y, width, height } = PHOTO_BOX;
    ctx.save();
    // Cast shadow behind the frame
    ctx.save();
    ctx.shadowColor = "rgba(0,0,0,0.5)";
    ctx.shadowBlur = 40;
    ctx.shadowOffsetY = 18;
    roundRectPath(ctx, x, y, width, height, 18);
    ctx.fillStyle = "rgba(0,0,0,0.001)";
    ctx.fill();
    ctx.restore();

    roundRectPath(ctx, x, y, width, height, 18);
    ctx.save();
    ctx.clip();

    if (photoImage) {
      const p = project.photo || { zoom: 1, panX: 0, panY: 0, rotation: 0 };
      ctx.translate(x + width / 2, y + height / 2);
      ctx.rotate(((p.rotation || 0) * Math.PI) / 180);
      const coverScale = Math.max(width / photoImage.width, height / photoImage.height);
      const zoom = Utils.clamp(p.zoom || 1, 1, 3) * (project.layout.photoScale || 1);
      const scale = coverScale * zoom;
      const drawW = photoImage.width * scale;
      const drawH = photoImage.height * scale;
      const panX = (p.panX || 0) * width * 0.5;
      const panY = (p.panY || 0) * height * 0.5;
      ctx.drawImage(photoImage, -drawW / 2 + panX, -drawH / 2 + panY, drawW, drawH);
    } else {
      ctx.restore();
      renderCenterpieceFallback(ctx, theme, monogram);
      ctx.save();
      roundRectPath(ctx, x, y, width, height, 18);
      ctx.clip();
    }
    ctx.restore();

    // Frame: bevel highlight (top-left) + shadow (bottom-right) + gold hairline
    roundRectPath(ctx, x, y, width, height, 18);
    ctx.lineWidth = 6;
    const frameGrad = ctx.createLinearGradient(x, y, x + width, y + height);
    frameGrad.addColorStop(0, "rgba(255,255,255,0.55)");
    frameGrad.addColorStop(0.5, theme.palette.secondary);
    frameGrad.addColorStop(1, "rgba(0,0,0,0.4)");
    ctx.strokeStyle = frameGrad;
    ctx.stroke();

    roundRectPath(ctx, x + 3, y + 3, width - 6, height - 6, 15);
    ctx.lineWidth = 1.5;
    ctx.strokeStyle = "rgba(232,199,119,0.55)";
    ctx.stroke();

    ctx.restore();
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
    const margin = LayoutEngine.SAFE_MARGIN.x;
    const maxWidth = (W - margin * 2) * (project.layout.textMaxWidth || pairing.maxTextWidthRatio || 0.8);
    const cx = W / 2;
    const blockTop = 960 + (project.layout.textPosition - 0.62) * 400;

    const measureCtx = document.createElement("canvas").getContext("2d");

    let cursorY = blockTop;
    const boxes = [];

    // Recipient name (highest text priority)
    const recipientText = Utils.sanitizeText(project.recipient.name || "Dear Friend", 40);
    const recipientFit = LayoutEngine.fitText(measureCtx, {
      text: recipientText,
      fontFamily: pairing.recipientFont,
      weight: pairing.recipientWeight,
      maxSize: project.typography.recipientSize,
      minSize: 28,
      maxWidth,
      maxLines: 2,
      letterSpacingStart: project.typography.letterSpacing,
    });
    if (recipientFit.overflow) diagnostics.textOverflow = true;

    const recipientMask = createWorkCanvas(W, H);
    const rmCtx = recipientMask.getContext("2d");
    rmCtx.fillStyle = "#fff";
    const recipientLineHeight = recipientFit.size * (project.typography.lineHeight || pairing.lineHeight);
    LayoutEngine.drawLines(rmCtx, recipientFit.lines, {
      fontFamily: pairing.recipientFont, weight: pairing.recipientWeight,
      size: recipientFit.size, letterSpacing: recipientFit.letterSpacing,
      lineHeight: (project.typography.lineHeight || pairing.lineHeight),
      cx, startY: cursorY + recipientFit.size * 0.85,
    });
    const recipientHeight = recipientFit.lines.length * recipientLineHeight;
    boxes.push(textBoxToLayoutBox("recipient-name", cx, cursorY, recipientFit.maxLineWidth, recipientHeight, 100));
    compositeFoil(ctx, W, H, (mctx) => mctx.drawImage(recipientMask, 0, 0), {
      presetId: project.foil.presetId, mode: project.foil.mode, intensity: project.foil.intensity,
      grain: project.foil.grain, highlight: project.foil.highlight, shadow: project.foil.shadow, quality,
    });
    cursorY += recipientHeight + 26;

    // Greeting
    const greetingSource = project.content.autoGreetingEnabled
      ? (AUTO_GREETINGS[project.content.emotion] || AUTO_GREETINGS.warm)
      : project.content.greeting;
    const greetingText = Utils.sanitizeText(greetingSource || "", 220);
    if (greetingText) {
      const greetingFit = LayoutEngine.fitText(measureCtx, {
        text: greetingText,
        fontFamily: pairing.greetingFont,
        weight: pairing.greetingWeight,
        maxSize: project.typography.greetingSize,
        minSize: 15,
        maxWidth: maxWidth * 0.92,
        maxLines: 4,
        letterSpacingStart: 0,
      });
      if (greetingFit.overflow) diagnostics.textOverflow = true;
      ctx.save();
      ctx.fillStyle = theme.palette.text;
      const greetingLineHeight = greetingFit.size * 1.5;
      LayoutEngine.drawLines(ctx, greetingFit.lines, {
        fontFamily: pairing.greetingFont, weight: pairing.greetingWeight,
        size: greetingFit.size, letterSpacing: 0, lineHeight: 1.5,
        cx, startY: cursorY + greetingFit.size * 0.85,
      });
      ctx.restore();
      const greetingHeight = greetingFit.lines.length * greetingLineHeight;
      boxes.push(textBoxToLayoutBox("greeting", cx, cursorY, greetingFit.maxLineWidth, greetingHeight, 90));
      cursorY += greetingHeight + 20;
    }

    // Supporting copy (relationship line) — small, quiet, optional
    const relationship = Utils.sanitizeText(project.recipient.relationship || "", 40);
    if (relationship) {
      ctx.save();
      ctx.fillStyle = theme.palette.mutedText;
      ctx.font = "500 20px " + pairing.supportFont;
      ctx.textAlign = "center";
      ctx.globalAlpha = 0.85;
      ctx.fillText(relationship.toUpperCase(), cx, cursorY + 16);
      ctx.restore();
      boxes.push(textBoxToLayoutBox("support-copy", cx, cursorY - 6, 300, 30, 70));
      cursorY += 46;
    }

    // Sender signature — pinned near the bottom, never overlapping name/greeting
    const senderText = Utils.sanitizeText(project.sender.name || "", 40);
    if (senderText) {
      const signY = Math.max(cursorY + 30, H - 150);
      const senderFit = LayoutEngine.fitText(measureCtx, {
        text: "— " + senderText,
        fontFamily: pairing.signatureFont,
        weight: "500",
        maxSize: project.typography.senderSize,
        minSize: 14,
        maxWidth: maxWidth * 0.7,
        maxLines: 1,
        letterSpacingStart: 0.4,
      });
      if (senderFit.overflow) diagnostics.textOverflow = true;
      const senderMask = createWorkCanvas(W, H);
      const smCtx = senderMask.getContext("2d");
      smCtx.fillStyle = "#fff";
      LayoutEngine.drawLines(smCtx, senderFit.lines, {
        fontFamily: pairing.signatureFont, weight: "500",
        size: senderFit.size, letterSpacing: senderFit.letterSpacing, lineHeight: 1.3,
        cx, startY: signY,
      });
      boxes.push(textBoxToLayoutBox("sender-signature", cx, signY - senderFit.size, senderFit.maxLineWidth, senderFit.size * 1.3, 95));
      compositeFoil(ctx, W, H, (mctx) => mctx.drawImage(senderMask, 0, 0), {
        presetId: project.foil.presetId, mode: project.foil.mode, intensity: project.foil.intensity * 0.85,
        grain: project.foil.grain, highlight: project.foil.highlight, shadow: project.foil.shadow, quality,
      });
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

    const diagnostics = { textOverflow: false, collisions: [], missingAssets: [], safeZoneViolations: [] };

    ctx.clearRect(0, 0, W, H);
    renderBackground(ctx, theme, quality);

    renderStampsForLayer(ctx, project, theme, "background", getInitials(project));

    let photoImage = null;
    if (project.photo && project.photo.assetId) {
      try {
        photoImage = await assets.resolvePhoto(project.photo.assetId, quality);
      } catch (err) {
        diagnostics.missingAssets.push(project.photo.assetId);
      }
    }
    await renderPhoto(ctx, project, theme, photoImage, getInitials(project));

    const textBoxes = await renderTextLayers(ctx, project, theme, pairing, diagnostics, quality);

    renderStampsForLayer(ctx, project, theme, "foreground", getInitials(project));
    renderStampsForLayer(ctx, project, theme, "top", getInitials(project));

    renderFinalGrade(ctx, theme, quality);

    // Collision + safe-zone diagnostics (non-blocking): compare stamp boxes
    // against text boxes and the safe zone; never mutates layout here.
    const stampBoxes = project.stamps.map(stampToLayoutBox);
    diagnostics.collisions = LayoutEngine.detectCollisions(textBoxes.concat(stampBoxes), 6);
    const safeZone = LayoutEngine.getSafeZone();
    stampBoxes.forEach((b) => { if (LayoutEngine.isOutsideSafeZone(b, safeZone)) diagnostics.safeZoneViolations.push(b.id); });

    return diagnostics;
  }

  return {
    W, H, PHOTO_BOX, renderCard, compositeFoil, createWorkCanvas,
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
    copy.stamps = (copy.stamps || []).map((s) => ({ ...s, id: Utils.uuid() }));

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
    if (backup.format !== BACKUP_FORMAT_ID) throw new Error("This file was not created by Atul Birthday Card Studio.");
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
    return "atul-birthday-card-" + recipient + "-" + themeSlug + ".png";
  }

  async function renderExportCanvas(project) {
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

  function canShareFiles(file) {
    return !!(navigator.canShare && navigator.share && navigator.canShare({ files: [file] }));
  }

  async function sharePng(blob, filename) {
    const file = new File([blob], filename, { type: "image/png" });
    if (!canShareFiles(file)) throw new Error("Sharing is not supported on this browser.");
    await navigator.share({ files: [file], title: "A birthday card for you" });
  }

  async function exportDigitalCardPackage(projectId) {
    const backup = await ProjectVault.exportBackup(projectId);
    const json = JSON.stringify(backup);
    const blob = new Blob([json], { type: "application/json" });
    const filename = "atul-digital-card-" + Utils.sanitizeFilenamePart(backup.project.recipient.name || "card") + ".json";
    return { blob, filename };
  }

  return { exportPng, exportDigitalCardPackage, downloadBlob, canShareFiles, sharePng, renderExportCanvas, buildFilename };
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
      // Snapshot whether a controller already existed *before* this
      // registration call. This is what correctly distinguishes "a real
      // update to an already-installed app" from "the very first install":
      // checking navigator.serviceWorker.controller inside the later
      // 'installed' statechange handler is unreliable, because
      // skipWaiting()+clients.claim() in sw.js can race ahead and set the
      // controller before that handler runs, even on a first-ever install.
      const hadControllerBeforeRegister = !!navigator.serviceWorker.controller;
      registration = await navigator.serviceWorker.register("sw.js");
      if (registration.active) setState({ offlineReady: true });

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
    tabs.forEach((tab) => {
      tab.addEventListener("click", () => selectTab(tab));
      tab.addEventListener("keydown", (e) => {
        const idx = tabs.indexOf(tab);
        if (e.key === "ArrowRight") { e.preventDefault(); tabs[(idx + 1) % tabs.length].focus(); selectTab(tabs[(idx + 1) % tabs.length]); }
        if (e.key === "ArrowLeft") { e.preventDefault(); tabs[(idx - 1 + tabs.length) % tabs.length].focus(); selectTab(tabs[(idx - 1 + tabs.length) % tabs.length]); }
      });
    });
  }

  function selectTab(tab) {
    document.querySelectorAll(".tab").forEach((t) => {
      const selected = t === tab;
      t.setAttribute("aria-selected", String(selected));
      t.tabIndex = selected ? 0 : -1;
    });
    document.querySelectorAll(".tabpanel").forEach((p) => {
      p.hidden = p.id !== tab.getAttribute("aria-controls");
    });
  }

  /* ---------------- Populate registries into DOM ---------------- */
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
      btn.appendChild(preview);
      btn.appendChild(name);
      btn.addEventListener("click", () => {
        StateStore.applyTheme(theme.id);
        toast("Theme set to " + theme.name);
      });
      grid.appendChild(btn);
    });
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
    StampCollections.list().forEach((def) => {
      const btn = document.createElement("button");
      btn.type = "button";
      btn.className = "stamp-gallery-item";
      btn.setAttribute("role", "listitem");
      const project = StateStore.getProject();
      const theme = ThemeRegistry.getTheme(project.theme.id);
      const preset = FoilPresets.getPreset(theme.foilPresetId);
      const thumb = StampCollections.renderToCanvas(def.id, 92, { preset, monogram: Renderer.getInitials(project) || "A" });
      thumb.setAttribute("aria-hidden", "true");
      const label = document.createElement("span");
      label.textContent = def.name;
      btn.appendChild(thumb);
      btn.appendChild(label);
      btn.setAttribute("aria-label", "Add " + def.name + " stamp");
      btn.addEventListener("click", () => addStamp(def));
      gallery.appendChild(btn);
    });
  }

  function addStamp(def) {
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
    if (diagnostics.textOverflow) messages.push("Some text may be tight for its space — consider shortening it.");
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
    const greeting = project.content.autoGreetingEnabled
      ? (AUTO_GREETINGS[project.content.emotion] || AUTO_GREETINGS.warm)
      : project.content.greeting;
    panel.innerHTML = "";
    const dl = document.createElement("dl");
    const rows = [
      ["Recipient", project.recipient.name || "(not set)"],
      ["Relationship", project.recipient.relationship || "(not set)"],
      ["Greeting", greeting || "(not set)"],
      ["From", project.sender.name || "(not set)"],
      ["Theme", theme.name],
      ["Photo", project.photo ? "Uploaded photo" : "No photo (fallback centerpiece shown)"],
      ["Stamps", project.stamps.length ? project.stamps.length + " placed" : "None"],
      ["Audio greeting", project.audio ? (project.audio.title || "Attached") : "None"],
    ];
    rows.forEach(([term, desc]) => {
      const dt = document.createElement("dt"); dt.textContent = term;
      const dd = document.createElement("dd"); dd.textContent = desc;
      dl.appendChild(dt); dl.appendChild(dd);
    });
    panel.appendChild(dl);
  }

  /* ---------------- Field binding: Content tab ---------------- */
  function bindContentTab() {
    dom.recipientName.addEventListener("input", (e) => {
      StateStore.update((p) => { p.recipient.name = Utils.sanitizeText(e.target.value, 40); }, { skipHistory: true });
    });
    dom.recipientName.addEventListener("change", () => StateStore.update(() => {}, { skipAutosave: false }));
    dom.recipientRelationship.addEventListener("input", (e) => {
      StateStore.update((p) => { p.recipient.relationship = Utils.sanitizeText(e.target.value, 40); }, { skipHistory: true });
    });
    dom.senderName.addEventListener("input", (e) => {
      StateStore.update((p) => { p.sender.name = Utils.sanitizeText(e.target.value, 40); }, { skipHistory: true });
    });
    dom.autoGreetingToggle.addEventListener("change", (e) => {
      StateStore.update((p) => { p.content.autoGreetingEnabled = e.target.checked; }, { reason: "auto-greeting" });
    });
    dom.emotionSelect.addEventListener("change", (e) => {
      StateStore.update((p) => { p.content.emotion = e.target.value; }, { reason: "emotion" });
    });
    dom.greetingText.addEventListener("input", (e) => {
      const val = Utils.sanitizeText(e.target.value, 220);
      dom.greetingCount.textContent = val.length + " / 220";
      StateStore.update((p) => { p.content.greeting = val; }, { skipHistory: true });
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
    dom.photoInput.addEventListener("change", async (e) => {
      const file = e.target.files[0];
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
        toast("Photo added.");
      } catch (err) {
        toast(err.message || "Could not add that photo.", true);
      }
      e.target.value = "";
    });

    dom.photoZoom.addEventListener("input", (e) => {
      const v = parseFloat(e.target.value);
      dom.photoZoomOut.textContent = v.toFixed(2);
      StateStore.update((p) => { if (p.photo) p.photo.zoom = v; }, { skipHistory: true });
    });
    dom.photoZoom.addEventListener("change", () => StateStore.update(() => {}));

    dom.photoRotation.addEventListener("input", (e) => {
      const v = parseFloat(e.target.value);
      dom.photoRotationOut.textContent = v;
      StateStore.update((p) => { if (p.photo) p.photo.rotation = v; }, { reason: "photo-rotate" });
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
        pinchStartDist = Math.hypot(pts[0].clientX - pts[1].clientX, pts[0].clientY - pts[1].clientY);
        const project = StateStore.getProject();
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
        if (project.photo) {
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
          p.photo.panX = Utils.clamp(dragStart.panX + dxFrac * 2.2, -1.5, 1.5);
          p.photo.panY = Utils.clamp(dragStart.panY + dyFrac * 2.2, -1.5, 1.5);
        }, { skipHistory: true });
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
    dom.openExportBtn.addEventListener("click", () => {
      dom.exportStatus.textContent = "";
      dom.sharePngBtn.hidden = !ExportModule.canShareFiles(new File([""], "x.png", { type: "image/png" }));
      openDialog(dom.exportDialog);
    });

    let lastPngBlob = null, lastPngFilename = null;

    dom.exportPngBtn.addEventListener("click", async () => {
      dom.exportStatus.textContent = "Rendering high-resolution PNG…";
      try {
        StateStore.flushAutosave();
        const { blob, filename, diagnostics } = await ExportModule.exportPng(StateStore.getProject());
        lastPngBlob = blob; lastPngFilename = filename;
        ExportModule.downloadBlob(blob, filename);
        dom.exportStatus.textContent = diagnostics.textOverflow
          ? "Downloaded. Note: some text was tight for its space in this export."
          : "Downloaded " + filename;
        dom.sharePngBtn.hidden = !ExportModule.canShareFiles(new File([blob], filename, { type: "image/png" }));
      } catch (err) {
        dom.exportStatus.textContent = "Export failed: " + (err.message || "unknown error.");
        toast("PNG export failed.", true);
      }
    });

    dom.sharePngBtn.addEventListener("click", async () => {
      try {
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
  function syncControlsFromState(project) {
    dom.recipientName.value = project.recipient.name || "";
    dom.recipientRelationship.value = project.recipient.relationship || "";
    dom.senderName.value = project.sender.name || "";
    dom.autoGreetingToggle.checked = !!project.content.autoGreetingEnabled;
    dom.emotionSelect.value = project.content.emotion;
    dom.greetingText.value = project.content.greeting || "";
    dom.greetingCount.textContent = (project.content.greeting || "").length + " / 220";

    document.querySelectorAll("#theme-grid .swatch").forEach((el) => {
      el.setAttribute("aria-checked", String(el.dataset.themeId === project.theme.id));
    });
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
    dom.letterSpacing.value = project.typography.letterSpacing;
    dom.letterSpacingOut.textContent = project.typography.letterSpacing;
    dom.lineHeight.value = project.typography.lineHeight;
    dom.lineHeightOut.textContent = project.typography.lineHeight;

    dom.foilMode.value = project.foil.mode;
    dom.foilIntensity.value = project.foil.intensity; dom.foilIntensityOut.textContent = Math.round(project.foil.intensity);
    dom.foilGrain.value = project.foil.grain; dom.foilGrainOut.textContent = Math.round(project.foil.grain);
    dom.foilHighlight.value = project.foil.highlight; dom.foilHighlightOut.textContent = Math.round(project.foil.highlight);
    dom.foilShadow.value = project.foil.shadow; dom.foilShadowOut.textContent = Math.round(project.foil.shadow);

    if (project.photo) {
      dom.photoZoom.value = project.photo.zoom; dom.photoZoomOut.textContent = project.photo.zoom.toFixed(2);
      dom.photoRotation.value = project.photo.rotation; dom.photoRotationOut.textContent = project.photo.rotation;
    } else {
      dom.photoZoom.value = 1; dom.photoZoomOut.textContent = "1.00";
      dom.photoRotation.value = 0; dom.photoRotationOut.textContent = "0";
    }

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
      projectTitle: $("#project-title"),

      canvas: $("#card-canvas"), canvasFrame: $("#canvas-frame"),
      diagnosticsBanner: $("#diagnostics-banner"),
      selectedStampToolbar: $("#selected-stamp-toolbar"),
      toggleTextPreview: $("#toggle-text-preview"), textPreviewPanel: $("#text-preview-panel"),

      recipientName: $("#recipient-name"), recipientRelationship: $("#recipient-relationship"),
      senderName: $("#sender-name"), autoGreetingToggle: $("#auto-greeting-toggle"),
      emotionSelect: $("#emotion-select"), greetingText: $("#greeting-text"), greetingCount: $("#greeting-count"),

      themeGrid: $("#theme-grid"),

      moodSelect: $("#mood-select"), pairingList: $("#pairing-list"),
      recipientSize: $("#recipient-size"), recipientSizeOut: $("#recipient-size-out"),
      greetingSize: $("#greeting-size"), greetingSizeOut: $("#greeting-size-out"),
      letterSpacing: $("#letter-spacing"), letterSpacingOut: $("#letter-spacing-out"),
      lineHeight: $("#line-height"), lineHeightOut: $("#line-height-out"),

      foilGrid: $("#foil-grid"), foilMode: $("#foil-mode"),
      foilIntensity: $("#foil-intensity"), foilIntensityOut: $("#foil-intensity-out"),
      foilGrain: $("#foil-grain"), foilGrainOut: $("#foil-grain-out"),
      foilHighlight: $("#foil-highlight"), foilHighlightOut: $("#foil-highlight-out"),
      foilShadow: $("#foil-shadow"), foilShadowOut: $("#foil-shadow-out"),

      photoInput: $("#photo-input"), photoZoom: $("#photo-zoom"), photoZoomOut: $("#photo-zoom-out"),
      photoRotation: $("#photo-rotation"), photoRotationOut: $("#photo-rotation-out"), removePhotoBtn: $("#remove-photo-btn"),

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
    initTabs();
    populateThemeGrid();
    populateFoilGrid();
    populatePairingList();
    // populateStampGallery() is intentionally NOT called here: it reads
    // StateStore.getProject() (for the current theme's foil preset and the
    // recipient's monogram initials), but no project exists yet this early
    // in bootstrap. It runs once StateStore.init() fires below, picked up
    // by the "init" reason in the subscribe callback via
    // populateStampGalleryThumbsIfThemeChanged().

    bindContentTab();
    bindTypographyTab();
    bindFoilTab();
    bindPhotoTab();
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
      if (reason !== "silent") scheduleRender(reason === "photo-rotate" || reason === "theme-change" ? "preview" : "preview");
      populateStampGalleryThumbsIfThemeChanged(reason);
      if (reason === "theme-change" || reason === "init" || reason === "undo" || reason === "redo") {
        syncControlsFromState(project);
      }
    });

    let lastThemeForGallery = null;
    function populateStampGalleryThumbsIfThemeChanged(reason) {
      if (reason === "theme-change" || reason === "init") {
        const themeId = StateStore.getProject().theme.id;
        if (themeId !== lastThemeForGallery) {
          lastThemeForGallery = themeId;
          populateStampGallery();
        }
      }
    }

    window.addEventListener("beforeunload", () => StateStore.flushAutosave());
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
