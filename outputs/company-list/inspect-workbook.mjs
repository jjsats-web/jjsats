import { FileBlob, SpreadsheetFile } from "@oai/artifact-tool";

const inputPath = "C:/Users/USER/Downloads/excel/เวิร์กบุ๊ก1.xlsx";
const input = await FileBlob.load(inputPath);
const workbook = await SpreadsheetFile.importXlsx(input);

console.log(workbook.worksheets.items.map((sheet) => sheet.name).join("\n"));
