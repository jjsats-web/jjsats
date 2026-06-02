import { FileBlob, SpreadsheetFile } from "@oai/artifact-tool";

const input = await FileBlob.load("C:/Users/USER/Downloads/excel/เวิร์กบุ๊ก1.xlsx");
const workbook = await SpreadsheetFile.importXlsx(input);
console.log("workbook", Object.keys(workbook));
console.log("worksheets", Object.keys(workbook.worksheets), workbook.worksheets.items?.length);
const sheet = workbook.worksheets.items[0];
console.log("sheet", Object.keys(sheet));
const range = sheet.getRange("A1:B2");
console.log("range", Object.keys(range).slice(0, 100));
console.log(workbook.help("range.format", { include: "examples,notes", maxChars: 4000 }).ndjson);
console.log(workbook.help("worksheet", { include: "examples,notes", maxChars: 4000 }).ndjson);
console.log(workbook.help("*", { search: "fill|font|columnWidth|wrap|borders|format", include: "examples,notes,index", maxChars: 12000 }).ndjson);
console.log(workbook.help("range", { include: "examples,notes,index", maxChars: 16000 }).ndjson);
console.log(workbook.help("*", { search: "table|freeze|filter", include: "examples,notes,index", maxChars: 10000 }).ndjson);
