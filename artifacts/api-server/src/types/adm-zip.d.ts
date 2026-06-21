declare module "adm-zip" {
  interface IZipEntry {
    entryName: string;
    isDirectory: boolean;
    getData(): Buffer;
  }
  class AdmZip {
    constructor(buffer?: Buffer | string);
    getEntries(): IZipEntry[];
  }
  export = AdmZip;
}
