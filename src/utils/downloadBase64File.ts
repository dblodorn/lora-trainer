/**
 * Decodes a base64-encoded string into binary data and triggers a
 * browser file download.
 *
 * @param base64Data - The base64-encoded file content
 * @param filename - The desired name for the downloaded file
 * @param mimeType - The MIME type of the file (e.g. "application/zip")
 */
export function downloadBase64File(
  base64Data: string,
  filename: string,
  mimeType: string,
): void {
  const byteCharacters = atob(base64Data);
  const byteNumbers = new Array(byteCharacters.length);
  for (let i = 0; i < byteCharacters.length; i++) {
    byteNumbers[i] = byteCharacters.charCodeAt(i);
  }
  const byteArray = new Uint8Array(byteNumbers);
  const blob = new Blob([byteArray], { type: mimeType });

  const url = window.URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  window.URL.revokeObjectURL(url);
}
