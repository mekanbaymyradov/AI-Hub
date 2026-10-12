/** Crop an image to its centered square and re-encode it as a `size`-pixel WebP file. */
export async function toSquareWebP(file: File, size = 256, quality = 0.85): Promise<File> {
  const image = await createImageBitmap(file);
  const side = Math.min(image.width, image.height);

  const canvas = document.createElement("canvas");
  canvas.width = size;
  canvas.height = size;
  const context = canvas.getContext("2d");
  if (!context) throw new Error("Your browser can't process images.");

  context.imageSmoothingQuality = "high";
  context.drawImage(image, (image.width - side) / 2, (image.height - side) / 2, side, side, 0, 0, size, size);
  image.close();

  const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, "image/webp", quality));
  if (!blob) throw new Error("Couldn't convert the image.");
  return new File([blob], "avatar.webp", { type: "image/webp" });
}
