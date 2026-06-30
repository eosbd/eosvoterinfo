// IMPORTANT: polyfills.ts must be the very first import.
// It patches browser globals (DOMMatrix, ImageData, Path2D) that pdfjs-dist
// requires, before any other module loads them.
import "./polyfills";

import app from "./app";
import { logger } from "./lib/logger";

const port = Number(process.env["PORT"] || "8080");

app.listen(port, (err) => {
  if (err) {
    logger.error({ err }, "Error listening on port");
    process.exit(1);
  }
  logger.info({ port }, "Server listening");
});
