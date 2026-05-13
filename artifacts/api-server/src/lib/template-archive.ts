import path from "path";
import fs from "fs/promises";
import { existsSync } from "fs";
import { spawn } from "child_process";
import StreamZip from "node-stream-zip";
import { logger } from "./logger";

// pdf-to-png-converter is loaded lazily — it pulls in @napi-rs/canvas + pdfjs-dist
// which together weigh tens of MB. Importing on demand keeps cold start fast and
// lets the server boot even if the native canvas binary failed to install.
type PdfToPngFn = (
  pdfPathOrBuffer: string | Buffer | Uint8Array,
  options?: {
    pagesToProcess?: number[];
    viewportScale?: number;
    outputFolder?: string;
    outputFileMaskFunc?: (pageNumber: number) => string;
    strictPagesToProcess?: boolean;
    verbosityLevel?: number;
  },
) => Promise<Array<{ name: string; content: Buffer; path: string; pageNumber: number }>>;

let _pdfToPng: PdfToPngFn | null | undefined;

/**
 * pdf-to-png-converter v4 has two issues that bite on Windows + pnpm:
 *   1. Its internal `normalizePath` uses `path.sep`, producing paths that end
 *      with `\` on Windows. pdfjs's `getFactoryUrlProp` rejects anything that
 *      doesn't end with `/`.
 *   2. It hardcodes `./node_modules/pdfjs-dist/cmaps/` resolved against `cwd`.
 *      api-server depends on pdf-to-png-converter (not pdfjs-dist directly),
 *      so under pnpm pdfjs-dist lives in `node_modules/.pnpm/pdfjs-dist@.../`
 *      and isn't reachable from api-server's cwd.
 *
 * Fixes applied at first use:
 *   - Resolve the real pdfjs-dist install dir via pdf-to-png-converter's own
 *     require context (where pdfjs-dist is a sibling under .pnpm).
 *   - Rewrite `CMAP_RELATIVE_URL`, `STANDARD_FONTS_RELATIVE_URL`, AND
 *     `DOCUMENT_INIT_PARAMS_DEFAULTS` (the spread inside
 *     `propsToPdfDocInitParams` captures those values at module load).
 *   - Force forward-slash, trailing-slash strings so pdfjs's check passes
 *     even if a future `normalizePath` change bypasses our replacement.
 *   - Replace `normalizePath` with a forward-slash version.
 *
 * `_patched` is only flipped on success — a transient failure (e.g. before
 * the converter package is fully installed) won't permanently disable it.
 */
let _patched = false;

function toFactoryUrl(absDir: string): string {
  // Forward-slash absolute path with a mandatory trailing `/`. pdfjs builds
  // file URLs via `${baseUrl}${filename}` and then `fs.readFile`s the result,
  // which accepts forward-slash Windows paths just fine.
  const forward = absDir.replace(/\\/g, "/");
  return forward.endsWith("/") ? forward : `${forward}/`;
}

async function patchPdfToPngOnce(): Promise<void> {
  if (_patched) return;
  let stage = "init";
  try {
    const { createRequire } = await import("node:module");
    const req = createRequire(import.meta.url);

    // pdf-to-png-converter v4 ships an `exports` map that only exposes the
    // main entry, so `require.resolve("pdf-to-png-converter/package.json")`
    // and any `out/*.js` subpath throw ERR_PACKAGE_PATH_NOT_EXPORTED. Resolve
    // the main entry instead and walk up to the package root.
    stage = "resolve pdf-to-png-converter";
    const converterMain = req.resolve("pdf-to-png-converter");
    const converterDir = path.dirname(path.dirname(converterMain));

    stage = "resolve pdfjs-dist";
    const innerReq = createRequire(converterMain);
    const pdfjsMain = innerReq.resolve("pdfjs-dist");
    const pdfjsDir = path.dirname(path.dirname(pdfjsMain));

    const cMapUrl = toFactoryUrl(path.join(pdfjsDir, "cmaps"));
    const standardFontDataUrl = toFactoryUrl(path.join(pdfjsDir, "standard_fonts"));

    stage = "patch const";
    // Absolute-path require bypasses the `exports` gate.
    const constPath = path.join(converterDir, "out", "const.js");
    const constMod = req(constPath) as {
      CMAP_RELATIVE_URL: string;
      STANDARD_FONTS_RELATIVE_URL: string;
      DOCUMENT_INIT_PARAMS_DEFAULTS: {
        cMapUrl: string;
        cMapPacked?: boolean;
        standardFontDataUrl: string;
      };
    };
    constMod.CMAP_RELATIVE_URL = cMapUrl;
    constMod.STANDARD_FONTS_RELATIVE_URL = standardFontDataUrl;
    constMod.DOCUMENT_INIT_PARAMS_DEFAULTS = {
      ...constMod.DOCUMENT_INIT_PARAMS_DEFAULTS,
      cMapUrl,
      standardFontDataUrl,
    };

    stage = "patch normalizePath";
    const npPath = path.join(converterDir, "out", "normalizePath.js");
    const npMod = req(npPath) as { normalizePath: (p: string) => string };
    npMod.normalizePath = (p: string): string => {
      if (!p) throw new Error("Path cannot be empty");
      const resolved = path.resolve(p).replace(/\\/g, "/");
      return resolved.endsWith("/") ? resolved : `${resolved}/`;
    };

    _patched = true;
    logger.info({ pdfjsDir, cMapUrl }, "pdf-to-png-converter patched for Windows+pnpm");
  } catch (err) {
    logger.warn(
      { err, stage },
      "Failed to patch pdf-to-png-converter — per-slide previews may break",
    );
  }
}

async function loadPdfToPng(): Promise<PdfToPngFn | null> {
  if (_pdfToPng !== undefined) return _pdfToPng;
  await patchPdfToPngOnce();
  try {
    const mod = await import("pdf-to-png-converter");
    _pdfToPng = mod.pdfToPng as PdfToPngFn;
    return _pdfToPng;
  } catch (err) {
    logger.warn({ err }, "pdf-to-png-converter unavailable — per-slide previews disabled");
    _pdfToPng = null;
    return null;
  }
}

export interface ExtractedPptx {
  /** Original filename inside the archive (no path). */
  name: string;
  /** Suggested Vietnamese title — derived from filename, humanized. */
  suggestedTitle: string;
  /** Public URL (served from /api/uploads/) of the saved .pptx file. */
  pptxUrl: string;
  /** Absolute filesystem path to the saved .pptx (for further processing). */
  pptxPath: string;
  /** Public URL of the rendered first-slide thumbnail (PNG). null if render failed. */
  thumbnailUrl: string | null;
  /** Public URLs of each slide rendered as PNG, in slide order. */
  previewImages: string[];
  /** Public URL of generated PDF (all slides rendered). null if render failed. */
  pdfUrl: string | null;
  /** Number of slides detected (from the PPTX itself, not LibreOffice). */
  slideCount: number | null;
}

export interface ProcessArchiveResult {
  archiveName: string;
  files: ExtractedPptx[];
  warnings: string[];
}

const ASCII_FOLD: Record<string, string> = {
  à: "a", á: "a", ạ: "a", ả: "a", ã: "a", â: "a", ầ: "a", ấ: "a", ậ: "a", ẩ: "a", ẫ: "a", ă: "a", ằ: "a", ắ: "a", ặ: "a", ẳ: "a", ẵ: "a",
  è: "e", é: "e", ẹ: "e", ẻ: "e", ẽ: "e", ê: "e", ề: "e", ế: "e", ệ: "e", ể: "e", ễ: "e",
  ì: "i", í: "i", ị: "i", ỉ: "i", ĩ: "i",
  ò: "o", ó: "o", ọ: "o", ỏ: "o", õ: "o", ô: "o", ồ: "o", ố: "o", ộ: "o", ổ: "o", ỗ: "o", ơ: "o", ờ: "o", ớ: "o", ợ: "o", ở: "o", ỡ: "o",
  ù: "u", ú: "u", ụ: "u", ủ: "u", ũ: "u", ư: "u", ừ: "u", ứ: "u", ự: "u", ử: "u", ữ: "u",
  ỳ: "y", ý: "y", ỵ: "y", ỷ: "y", ỹ: "y",
  đ: "d",
};

function asciiFold(s: string): string {
  return s.toLowerCase().replace(/[À-ỹ]/g, (ch) => ASCII_FOLD[ch.toLowerCase()] ?? ch);
}

function slugify(s: string): string {
  return asciiFold(s)
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60) || "template";
}

function humanizeTitle(filename: string): string {
  const noExt = filename.replace(/\.[^.]+$/, "");
  return noExt
    .replace(/[_\-]+/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .split(" ")
    .map((w) => (w.length > 0 ? w[0].toUpperCase() + w.slice(1) : w))
    .join(" ");
}

const COMMON_SOFFICE_PATHS = [
  process.env.SOFFICE_PATH,
  "soffice",
  "soffice.exe",
  "C:\\Program Files\\LibreOffice\\program\\soffice.exe",
  "C:\\Program Files (x86)\\LibreOffice\\program\\soffice.exe",
  process.env.LOCALAPPDATA
    ? `${process.env.LOCALAPPDATA}\\Programs\\LibreOffice\\program\\soffice.exe`
    : null,
  "/usr/bin/soffice",
  "/usr/bin/libreoffice",
  "/usr/local/bin/soffice",
  "/opt/libreoffice/program/soffice",
  "/Applications/LibreOffice.app/Contents/MacOS/soffice",
].filter(Boolean) as string[];

let _resolvedSoffice: string | null | undefined;

async function resolveSoffice(): Promise<string | null> {
  if (_resolvedSoffice !== undefined) return _resolvedSoffice;
  for (const candidate of COMMON_SOFFICE_PATHS) {
    if (path.isAbsolute(candidate)) {
      if (existsSync(candidate)) {
        _resolvedSoffice = candidate;
        return candidate;
      }
    } else {
      const ok = await new Promise<boolean>((resolve) => {
        const p = spawn(candidate, ["--version"], { stdio: "ignore" });
        p.on("error", () => resolve(false));
        p.on("exit", (code) => resolve(code === 0));
      });
      if (ok) {
        _resolvedSoffice = candidate;
        return candidate;
      }
    }
  }
  _resolvedSoffice = null;
  logger.warn(
    { searched: COMMON_SOFFICE_PATHS },
    "LibreOffice not found — install from https://www.libreoffice.org/download/ or set SOFFICE_PATH",
  );
  return null;
}

/** Force re-detection on next call (useful after installing LibreOffice). */
export function resetSofficeCache(): void {
  _resolvedSoffice = undefined;
}

async function runSoffice(args: string[], timeoutMs = 60000): Promise<{ ok: boolean; stderr: string }> {
  const soffice = await resolveSoffice();
  if (!soffice) return { ok: false, stderr: "LibreOffice not installed" };
  return new Promise((resolve) => {
    const p = spawn(soffice, args, { stdio: ["ignore", "pipe", "pipe"] });
    let stderr = "";
    p.stderr.on("data", (d) => (stderr += d.toString()));
    const timer = setTimeout(() => {
      p.kill();
      resolve({ ok: false, stderr: `Timeout after ${timeoutMs}ms\n${stderr}` });
    }, timeoutMs);
    p.on("error", (err) => {
      clearTimeout(timer);
      resolve({ ok: false, stderr: err.message });
    });
    p.on("exit", (code) => {
      clearTimeout(timer);
      resolve({ ok: code === 0, stderr });
    });
  });
}

export interface RenderResult {
  thumbnailUrl: string | null;
  previewImages: string[];
  pdfUrl: string | null;
  slideCount: number | null;
  warnings: string[];
}

/**
 * Render a PPTX into a thumbnail (slide 1 PNG), a per-slide PNG array,
 * and an all-slides PDF. The output filenames are derived from the .pptx
 * basename so callers can locate them later. Safe to call without
 * LibreOffice installed — the result will just have null URLs and warnings.
 */
export async function renderPptxAssets(args: {
  pptxPath: string;
  uploadsDir: string;
  publicPrefix?: string;
  /** Optional cap on how many slides to render as preview PNGs. */
  maxSlides?: number;
}): Promise<RenderResult> {
  const publicPrefix = (args.publicPrefix ?? "/api/uploads").replace(/\/$/, "");
  const warnings: string[] = [];
  const pptxBase = path.basename(args.pptxPath, path.extname(args.pptxPath));

  const slideCount = await countSlidesInPptx(args.pptxPath);

  const sofficeOk = !!(await resolveSoffice());
  if (!sofficeOk) {
    warnings.push(
      "Chưa cài LibreOffice — không thể sinh thumbnail / preview. Cài tại https://www.libreoffice.org/download/.",
    );
    return { thumbnailUrl: null, previewImages: [], pdfUrl: null, slideCount, warnings };
  }

  // Step 1: PPTX -> PDF (all slides in one document)
  const pdfRender = await runSoffice([
    "--headless",
    "--convert-to",
    "pdf",
    "--outdir",
    args.uploadsDir,
    args.pptxPath,
  ]);

  let pdfUrl: string | null = null;
  let pdfPath: string | null = null;
  if (pdfRender.ok) {
    const pdfFile = `${pptxBase}.pdf`;
    const absPdf = path.join(args.uploadsDir, pdfFile);
    if (existsSync(absPdf)) {
      pdfUrl = `${publicPrefix}/${pdfFile}`;
      pdfPath = absPdf;
    }
  } else {
    warnings.push(`PDF gen thất bại: ${pdfRender.stderr.slice(0, 120)}`);
  }

  // Step 2: legacy single-PNG thumbnail (first slide). Kept as a fallback for
  // the case where pdf-to-png-converter is unavailable or fails.
  let legacyThumb: string | null = null;
  const pngRender = await runSoffice([
    "--headless",
    "--convert-to",
    "png",
    "--outdir",
    args.uploadsDir,
    args.pptxPath,
  ]);
  if (pngRender.ok) {
    const pngFile = `${pptxBase}.png`;
    if (existsSync(path.join(args.uploadsDir, pngFile))) {
      legacyThumb = `${publicPrefix}/${pngFile}`;
    }
  }

  // Step 3: PDF -> per-slide PNGs via pdf-to-png-converter
  const previewImages: string[] = [];
  let thumbnailUrl: string | null = legacyThumb;

  if (pdfPath) {
    const pdfToPng = await loadPdfToPng();
    if (!pdfToPng) {
      warnings.push("Không sinh được preview từng slide — pdf-to-png-converter không khả dụng.");
    } else {
      try {
        const slideCap =
          args.maxSlides && args.maxSlides > 0
            ? args.maxSlides
            : slideCount && slideCount > 0
              ? slideCount
              : undefined;
        const pages = await pdfToPng(pdfPath, {
          viewportScale: 2.0,
          outputFolder: args.uploadsDir,
          outputFileMaskFunc: (pageNumber: number) =>
            `${pptxBase}_slide_${String(pageNumber).padStart(3, "0")}.png`,
          pagesToProcess: slideCap ? Array.from({ length: slideCap }, (_, i) => i + 1) : undefined,
          strictPagesToProcess: false,
        });
        for (const p of pages) {
          previewImages.push(`${publicPrefix}/${path.basename(p.path)}`);
        }
        if (previewImages.length > 0) {
          thumbnailUrl = previewImages[0];
        }
      } catch (err) {
        logger.warn({ err, pptxPath: args.pptxPath }, "PDF -> per-slide PNG failed");
        warnings.push(
          `Không sinh được preview từng slide: ${err instanceof Error ? err.message.slice(0, 120) : "unknown"}`,
        );
      }
    }
  }

  return { thumbnailUrl, previewImages, pdfUrl, slideCount, warnings };
}

async function countSlidesInPptx(pptxPath: string): Promise<number | null> {
  try {
    const zip = new StreamZip.async({ file: pptxPath });
    const entries = await zip.entries();
    const slideCount = Object.keys(entries).filter(
      (n) => /^ppt\/slides\/slide\d+\.xml$/i.test(n),
    ).length;
    await zip.close();
    return slideCount > 0 ? slideCount : null;
  } catch (err) {
    logger.warn({ err, pptxPath }, "countSlidesInPptx failed");
    return null;
  }
}

/**
 * Resolve a safe target path inside outDir.
 * Strips path components entirely and uses only the basename — this is
 * sufficient for our use case (we just want the .pptx files), and is the
 * strongest defense against zip-slip / path-traversal attacks.
 */
function safeTargetPath(outDir: string, entryName: string): string | null {
  const baseName = path.basename(entryName);
  if (!baseName || baseName === "." || baseName === "..") return null;
  // Strip any null bytes / control chars that could confuse fs APIs.
  const sanitized = baseName.replace(/[\x00-\x1f]/g, "_");
  const target = path.join(outDir, sanitized);
  // Verify final path stays inside outDir
  const resolvedOut = path.resolve(outDir) + path.sep;
  const resolvedTarget = path.resolve(target);
  if (!resolvedTarget.startsWith(resolvedOut) && resolvedTarget !== path.resolve(outDir)) {
    return null;
  }
  return target;
}

async function extractZip(archivePath: string, outDir: string): Promise<string[]> {
  const zip = new StreamZip.async({ file: archivePath });
  try {
    const entries = await zip.entries();
    const extracted: string[] = [];
    for (const entry of Object.values(entries)) {
      if (entry.isDirectory) continue;
      if (!entry.name.toLowerCase().endsWith(".pptx")) continue;
      const targetPath = safeTargetPath(outDir, entry.name);
      if (!targetPath) {
        logger.warn({ entry: entry.name }, "Skipping unsafe zip entry");
        continue;
      }
      await zip.extract(entry.name, targetPath);
      extracted.push(targetPath);
    }
    return extracted;
  } finally {
    await zip.close().catch((err) => logger.warn({ err }, "zip close failed"));
  }
}

async function extractRar(archivePath: string, outDir: string): Promise<string[]> {
  const { createExtractorFromFile } = await import("node-unrar-js");
  // Stage to a per-archive subdir so we can move sanitized files out.
  const rarStageDir = path.join(outDir, "_rar_stage");
  await fs.mkdir(rarStageDir, { recursive: true });
  const extractor = await createExtractorFromFile({
    filepath: archivePath,
    targetPath: rarStageDir,
  });
  const list = extractor.getFileList();
  const headers = [...list.fileHeaders].filter(
    (h) => !h.flags.directory && h.name.toLowerCase().endsWith(".pptx"),
  );
  if (headers.length === 0) {
    await fs.rm(rarStageDir, { recursive: true, force: true }).catch(() => {});
    return [];
  }
  const fileNames = headers.map((h) => h.name);
  const result = extractor.extract({ files: fileNames });
  // Iterate the lazy result to drive actual extraction.
  for (const _ of result.files) {
    // intentionally consume iterator
  }

  // Move only sanitized PPTX files out of the rar stage; the rar lib may have
  // created subdirectories which we ignore.
  const extracted: string[] = [];
  for (const header of headers) {
    const safeName = path.basename(header.name);
    if (!safeName.toLowerCase().endsWith(".pptx")) continue;
    const stagePath = path.join(rarStageDir, header.name);
    if (!existsSync(stagePath)) {
      logger.warn({ entry: header.name, stagePath }, "RAR entry missing after extract");
      continue;
    }
    const finalPath = safeTargetPath(outDir, safeName);
    if (!finalPath) continue;
    await fs.copyFile(stagePath, finalPath);
    extracted.push(finalPath);
  }
  await fs.rm(rarStageDir, { recursive: true, force: true }).catch(() => {});
  return extracted;
}

export async function processTemplateArchive(args: {
  archivePath: string;
  archiveName: string;
  uploadsDir: string;
  publicPrefix?: string;
}): Promise<ProcessArchiveResult> {
  const publicPrefix = (args.publicPrefix ?? "/api/uploads").replace(/\/$/, "");
  const warnings: string[] = [];

  const stem = `arch_${Date.now()}_${slugify(args.archiveName)}`;
  const stageDir = path.join(args.uploadsDir, stem);
  await fs.mkdir(stageDir, { recursive: true });

  const ext = path.extname(args.archiveName).toLowerCase();
  let pptxPaths: string[] = [];
  try {
    if (ext === ".zip") {
      pptxPaths = await extractZip(args.archivePath, stageDir);
    } else if (ext === ".rar") {
      pptxPaths = await extractRar(args.archivePath, stageDir);
    } else {
      throw new Error(`Định dạng không hỗ trợ: ${ext}`);
    }
  } catch (err) {
    logger.error({ err, archive: args.archiveName }, "Archive extraction failed");
    throw new Error(`Không thể giải nén: ${err instanceof Error ? err.message : "lỗi không xác định"}`);
  }

  if (pptxPaths.length === 0) {
    warnings.push("Không tìm thấy file .pptx trong archive");
    return { archiveName: args.archiveName, files: [], warnings };
  }

  const results: ExtractedPptx[] = [];
  for (const pptxPath of pptxPaths) {
    const baseName = path.basename(pptxPath);
    const slug = slugify(path.basename(baseName, ".pptx"));
    const suggestedTitle = humanizeTitle(baseName);

    const finalPptxName = `${Date.now()}_${slug}.pptx`;
    const finalPptxPath = path.join(args.uploadsDir, finalPptxName);
    await fs.copyFile(pptxPath, finalPptxPath);

    const rendered = await renderPptxAssets({
      pptxPath: finalPptxPath,
      uploadsDir: args.uploadsDir,
      publicPrefix,
    });
    for (const w of rendered.warnings) warnings.push(`[${baseName}] ${w}`);

    results.push({
      name: baseName,
      suggestedTitle,
      pptxUrl: `${publicPrefix}/${finalPptxName}`,
      pptxPath: finalPptxPath,
      thumbnailUrl: rendered.thumbnailUrl,
      previewImages: rendered.previewImages,
      pdfUrl: rendered.pdfUrl,
      slideCount: rendered.slideCount,
    });
  }

  void fs.rm(stageDir, { recursive: true, force: true }).catch(() => {});

  return { archiveName: args.archiveName, files: results, warnings };
}
