/** Client-side image guard: resize + compress so uploads stay light for the live site. */

export const IMAGE_MAX_EDGE_PX = 1200;
export const IMAGE_MAX_OUTPUT_BYTES = 400 * 1024; // ~400KB after compress
export const IMAGE_MAX_INPUT_BYTES = 8 * 1024 * 1024; // reject huge phone dumps early
/** Base64 data-URL length cap (~400KB binary ≈ 560KB text + header). */
export const IMAGE_MAX_DATA_URL_CHARS = 750_000;

export type PreparedImage = {
  dataUrl: string;
  width: number;
  height: number;
  bytesApprox: number;
};

function loadImage(file: File): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      URL.revokeObjectURL(url);
      resolve(img);
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error("Could not read that image file"));
    };
    img.src = url;
  });
}

function canvasToBlob(
  canvas: HTMLCanvasElement,
  type: string,
  quality: number,
): Promise<Blob> {
  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) => {
        if (!blob) reject(new Error("Image compress failed"));
        else resolve(blob);
      },
      type,
      quality,
    );
  });
}

function blobToDataUrl(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result || ""));
    reader.onerror = () => reject(new Error("Could not encode image"));
    reader.readAsDataURL(blob);
  });
}

/**
 * Rejects oversized data-URL / path strings before they hit the API.
 * Paths like `/products/...` are always fine.
 */
export function assertImageFieldSafe(image: string): void {
  const value = (image || "").trim();
  if (!value) return;
  if (value.startsWith("data:") && value.length > IMAGE_MAX_DATA_URL_CHARS) {
    throw new Error(
      "Image data is too large. Upload a smaller photo (auto-compress max ~400KB).",
    );
  }
}

/**
 * Resize + compress a local image for product/menu/logo use.
 * Throws a short, staff-friendly Error when the file is unsuitable.
 */
export async function prepareProductImage(file: File): Promise<PreparedImage> {
  if (!file.type.startsWith("image/")) {
    throw new Error("Please choose an image file (JPG, PNG, or WebP)");
  }
  if (file.size > IMAGE_MAX_INPUT_BYTES) {
    throw new Error("Image is too large (max 8MB). Choose a smaller photo.");
  }

  const img = await loadImage(file);
  const scale = Math.min(
    1,
    IMAGE_MAX_EDGE_PX / Math.max(img.width, img.height, 1),
  );
  const width = Math.max(1, Math.round(img.width * scale));
  const height = Math.max(1, Math.round(img.height * scale));

  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Browser cannot process images");
  ctx.fillStyle = "#ffffff";
  ctx.fillRect(0, 0, width, height);
  ctx.drawImage(img, 0, 0, width, height);

  const types = ["image/webp", "image/jpeg"];

  let best: Blob | null = null;
  for (const type of types) {
    for (const quality of [0.82, 0.72, 0.62, 0.5]) {
      try {
        const blob = await canvasToBlob(canvas, type, quality);
        if (!best || blob.size < best.size) best = blob;
        if (blob.size <= IMAGE_MAX_OUTPUT_BYTES) {
          const dataUrl = await blobToDataUrl(blob);
          return {
            dataUrl,
            width,
            height,
            bytesApprox: blob.size,
          };
        }
      } catch {
        /* try next */
      }
    }
  }

  if (best && best.size <= IMAGE_MAX_OUTPUT_BYTES * 1.25) {
    const dataUrl = await blobToDataUrl(best);
    return { dataUrl, width, height, bytesApprox: best.size };
  }

  throw new Error(
    "Image is still too heavy after compress. Use a clearer, smaller photo.",
  );
}
