/**
 * Utility functions for client-side image processing.
 */

/**
 * Resizes an image file and converts it into a compressed WebP format.
 * Center-crops the image to a square so it functions cleanly as an avatar.
 *
 * @param file The original image File (JPEG, PNG, WebP, etc.)
 * @param targetSize The square width & height in pixels (default 256px)
 * @param quality WebP compression quality between 0 and 1 (default 0.85)
 * @returns A Promise resolving to a WebP File ready for upload
 */
export async function resizeAndCompressImageToWebP(
  file: File,
  targetSize: number = 256,
  quality: number = 0.85
): Promise<File> {
  return new Promise((resolve, reject) => {
    // Validate that the file is an image
    if (!file.type.startsWith('image/')) {
      return reject(new Error('Selected file is not an image.'));
    }

    const reader = new FileReader();

    reader.onload = (readerEvent) => {
      const img = new Image();

      img.onload = () => {
        try {
          const canvas = document.createElement('canvas');
          canvas.width = targetSize;
          canvas.height = targetSize;

          const ctx = canvas.getContext('2d');
          if (!ctx) {
            return reject(new Error('Unable to create canvas 2D rendering context.'));
          }

          // Enable high-quality image smoothing
          ctx.imageSmoothingEnabled = true;
          ctx.imageSmoothingQuality = 'high';

          // Calculate center-crop coordinates to maintain aspect ratio
          const sourceWidth = img.width;
          const sourceHeight = img.height;
          const minDimension = Math.min(sourceWidth, sourceHeight);

          const sourceX = (sourceWidth - minDimension) / 2;
          const sourceY = (sourceHeight - minDimension) / 2;

          // Draw the center-cropped image onto the target square canvas
          ctx.drawImage(
            img,
            sourceX,
            sourceY,
            minDimension,
            minDimension,
            0,
            0,
            targetSize,
            targetSize
          );

          // Export as image/webp
          canvas.toBlob(
            (blob) => {
              if (!blob) {
                return reject(new Error('Browser failed to encode image to WebP.'));
              }

              const webpFile = new File([blob], 'avatar.webp', {
                type: 'image/webp',
                lastModified: Date.now(),
              });

              resolve(webpFile);
            },
            'image/webp',
            quality
          );
        } catch (err) {
          reject(err);
        }
      };

      img.onerror = () => {
        reject(new Error('Failed to load image for processing.'));
      };

      img.src = readerEvent.target?.result as string;
    };

    reader.onerror = () => {
      reject(new Error('Failed to read file from disk.'));
    };

    reader.readAsDataURL(file);
  });
}
