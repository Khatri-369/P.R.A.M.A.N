import multer from "multer";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { randomUUID } from "node:crypto";
import { mkdirSync } from "node:fs";
import { open } from "node:fs/promises";
import { fail } from "../utils/common.js";
export const uploadDirectory =
  process.env.UPLOAD_DIR ||
  fileURLToPath(new URL("../uploads/", import.meta.url));
mkdirSync(uploadDirectory, { recursive: true });
const allowed = {
  ".pdf": "application/pdf",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".png": "image/png",
  ".txt": "text/plain",
  ".docx":
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
};
export const upload = multer({
  storage: multer.diskStorage({
    destination: uploadDirectory,
    filename: (req, file, cb) =>
      cb(null, randomUUID() + path.extname(file.originalname).toLowerCase()),
  }),
  limits: { fileSize: 10 * 1024 * 1024, files: 1, fields: 6 },
  fileFilter: (req, file, cb) => {
    const extension = path.extname(file.originalname).toLowerCase();
    if (allowed[extension] !== file.mimetype)
      return cb(
        Object.assign(
          new Error(
            "Allowed files: PDF, JPG, PNG, TXT and DOCX with matching MIME types.",
          ),
          { status: 400 },
        ),
      );
    cb(null, true);
  },
}).single("file");
export async function inspectFile(file) {
  const handle = await open(file.path, "r");
  const buffer = Buffer.alloc(8192);
  let bytesRead;
  try {
    ({ bytesRead } = await handle.read(buffer, 0, buffer.length, 0));
  } finally {
    await handle.close();
  }
  const b = buffer.subarray(0, bytesRead),
    extension = path.extname(file.originalname).toLowerCase();
  const valid =
    extension === ".pdf"
      ? b.subarray(0, 5).toString() === "%PDF-"
      : extension === ".png"
        ? b.subarray(0, 8).equals(Buffer.from("89504e470d0a1a0a", "hex"))
        : [".jpg", ".jpeg"].includes(extension)
          ? b[0] === 255 && b[1] === 216 && b[2] === 255
          : extension === ".docx"
            ? b.subarray(0, 4).equals(Buffer.from("504b0304", "hex")) &&
              b.includes(Buffer.from("[Content_Types].xml"))
            : b.length > 0 && !b.includes(0);
  if (!valid) fail(400, "File contents do not match the selected file type.");
}
