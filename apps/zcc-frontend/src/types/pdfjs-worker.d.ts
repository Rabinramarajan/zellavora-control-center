// pdf.js ships its worker module without type declarations; importing it
// registers `globalThis.pdfjsWorker` for in-thread parsing.
declare module 'pdfjs-dist/build/pdf.worker.min.mjs' {
  export const WorkerMessageHandler: unknown;
}
