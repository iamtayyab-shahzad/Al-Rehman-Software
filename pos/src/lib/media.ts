/** Cloudinary (and local) image URLs with optional on-the-fly resize. */

export const PLACEHOLDER_IMAGE = "/products/placeholder.svg";

type MediaOpts = {
  /** Requested width in CSS pixels. Omitted = original delivery URL. */
  width?: number;
};

/**
 * Injects Cloudinary URL transforms for list/grid thumbnails.
 * Local paths, data URLs, and non-Cloudinary hosts are returned unchanged.
 */
export function mediaUrl(
  src: string | undefined | null,
  opts: MediaOpts = {},
): string {
  const value = (src || "").trim();
  if (!value) return PLACEHOLDER_IMAGE;
  if (!opts.width || opts.width < 1) return value;
  if (!value.includes("res.cloudinary.com") || !value.includes("/upload/")) {
    return value;
  }
  const transform = `f_auto,q_auto,c_fill,w_${Math.round(opts.width)}`;
  if (value.includes("/upload/f_auto") || value.includes("/upload/w_")) {
    return value;
  }
  return value.replace("/upload/", `/upload/${transform}/`);
}
