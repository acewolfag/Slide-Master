import { Router } from "express";
import multer from "multer";
import path from "path";
import { fileURLToPath } from "url";
import fs from "fs";
import { parseToken } from "./auth";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const uploadsDir = path.resolve(__dirname, "../../uploads");

if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir, { recursive: true });
}

function requireAuth(req: any, res: any, next: any): void {
  const authHeader = req.headers.authorization;
  if (!authHeader?.startsWith("Bearer ")) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }
  const payload = parseToken(authHeader.slice(7));
  if (!payload) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }
  next();
}

const storage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, uploadsDir),
  filename: (_req, file, cb) => {
    const ext = path.extname(file.originalname);
    const base = path.basename(file.originalname, ext).replace(/[^a-zA-Z0-9_-]/g, "_").slice(0, 40);
    cb(null, `${Date.now()}_${base}${ext}`);
  },
});

const upload = multer({
  storage,
  limits: { fileSize: 20 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    // Note: SVG removed — uploads are served at /api/uploads/* and SVG can
    // execute embedded scripts in the browser (XSS vector).
    const allowed = [
      "image/jpeg", "image/png", "image/gif", "image/webp",
      "application/pdf",
      "application/msword", "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      "application/vnd.ms-excel", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "application/vnd.ms-powerpoint", "application/vnd.openxmlformats-officedocument.presentationml.presentation",
      "text/plain",
      // Archive types — used by admin/customer chat to exchange ZIP deliveries.
      "application/zip",
      "application/x-zip-compressed",
      "application/x-rar-compressed",
      "application/vnd.rar",
      "application/octet-stream",
    ];
    if (allowed.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error("Loại file không được hỗ trợ"));
    }
  },
});

const router = Router();

function formatFiles(files: Express.Multer.File[]) {
  return files.map((f) => ({
    name: f.originalname,
    url: `/api/uploads/${f.filename}`,
    type: f.mimetype,
    size: f.size,
  }));
}

router.post("/upload", requireAuth, upload.array("files", 10), (req, res): void => {
  const files = req.files as Express.Multer.File[];
  if (!files || files.length === 0) {
    res.status(400).json({ error: "Không có file nào được tải lên" });
    return;
  }
  res.json({ files: formatFiles(files) });
});

// Public attachment upload — for guests submitting custom-request forms.
// Limited to 3 files per request and rate-limited at the app layer.
const guestUpload = multer({
  storage: multer.diskStorage({
    destination: (_req, _file, cb) => cb(null, uploadsDir),
    filename: (_req, file, cb) => {
      const ext = path.extname(file.originalname);
      const base = path
        .basename(file.originalname, ext)
        .replace(/[^a-zA-Z0-9_-]/g, "_")
        .slice(0, 40);
      cb(null, `guest_${Date.now()}_${base}${ext}`);
    },
  }),
  limits: { fileSize: 10 * 1024 * 1024, files: 3 },
  fileFilter: (_req, file, cb) => {
    const allowed = [
      "image/jpeg", "image/png", "image/gif", "image/webp",
      "application/pdf",
    ];
    if (allowed.includes(file.mimetype)) cb(null, true);
    else cb(new Error("Loại file không được hỗ trợ"));
  },
});

router.post("/upload-attachment", guestUpload.array("files", 3), (req, res): void => {
  const files = req.files as Express.Multer.File[];
  if (!files || files.length === 0) {
    res.status(400).json({ error: "Không có file nào được tải lên" });
    return;
  }
  res.json({ files: formatFiles(files) });
});

export default router;
