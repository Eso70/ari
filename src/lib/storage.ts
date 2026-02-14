import { writeFile, mkdir } from "fs/promises";
import { existsSync } from "fs";
import path from "path";

const UPLOAD_DIR = "public/uploads";

export async function uploadImage(
  file: File | Blob,
  filename: string
): Promise<{ url: string; path: string }> {
  // Ensure filename doesn't include directory paths - store directly in uploads/
  const name = path.basename(filename) || `img-${Date.now()}.dat`;
  
  // Use process.cwd() first (matches PM2 cwd), then check VPS paths
  const possibleDirs = [
    path.join(process.cwd(), UPLOAD_DIR), // PM2 cwd: /var/www/ari
    "/var/www/ari/public/uploads",
  ];
  
  // Find first existing directory or use process.cwd() as fallback
  let dir = possibleDirs[0];
  for (const possibleDir of possibleDirs) {
    if (existsSync(possibleDir)) {
      dir = possibleDir;
      break;
    }
  }
  
  const filePath = path.join(dir, name);
  
  await mkdir(dir, { recursive: true });
  const buf = Buffer.from(await (file instanceof File ? file.arrayBuffer() : file.arrayBuffer()));
  await writeFile(filePath, buf);
  const url = `/uploads/${name}`;
  return { url, path: `uploads/${name}` };
}

export function getImageUrl(filePath: string): string {
  if (filePath.startsWith("http://") || filePath.startsWith("https://") || filePath.startsWith("/")) return filePath;
  return `/${filePath}`;
}

export function generateImageFilename(originalName: string, _linktreeId?: string): string {
  const ext = (originalName.split(".").pop() || "jpg").toLowerCase().replace(/[^a-z0-9]/g, "") || "jpg";
  const base = (originalName.split(".").slice(0, -1).join(".") || "image").replace(/[^a-z0-9]/gi, "-").toLowerCase().slice(0, 40) || "img";
  // Return just filename (no directory prefix) - files stored directly in public/uploads/
  return `${base}-${Date.now()}-${Math.random().toString(36).slice(2, 9)}.${ext}`;
}

export function validateImageFile(
  file: File,
  maxSizeMB = 5
): { valid: boolean; error?: string } {
  const allowed = ["image/jpeg", "image/jpg", "image/png", "image/gif", "image/webp", "image/svg+xml"];
  if (!allowed.includes(file.type)) return { valid: false, error: `Invalid file type. Allowed: ${allowed.join(", ")}` };
  if (file.size > maxSizeMB * 1024 * 1024) return { valid: false, error: `File size exceeds ${maxSizeMB}MB` };
  return { valid: true };
}

export async function deleteImage(_path: string): Promise<void> {
  // Delete image from all possible locations (VPS and local)
  try {
    const { unlink } = await import("fs/promises");
    const cleanPath = _path.replace(/^\/+/, "").replace(/^uploads\//, "");
    
    const possiblePaths = [
      path.join("/var/www/ari/public/uploads", cleanPath),
      path.join(process.cwd(), "public", "uploads", cleanPath),
    ];
    
    // Try to delete from all possible locations
    for (const possiblePath of possiblePaths) {
      if (existsSync(possiblePath)) {
        await unlink(possiblePath);
        break; // File found and deleted
      }
    }
  } catch {
    // ignore - file might not exist or already deleted
  }
}
