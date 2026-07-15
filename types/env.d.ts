declare interface Window {
  htmlDocx?: {
    asBlob(html: string): Blob | BlobPart;
  };
}
