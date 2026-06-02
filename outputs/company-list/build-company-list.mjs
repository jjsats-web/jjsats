import fs from "node:fs/promises";
import path from "node:path";
import JSZip from "jszip";
import { FileBlob, SpreadsheetFile } from "@oai/artifact-tool";

const inputPath = "C:/Users/USER/Downloads/excel/เวิร์กบุ๊ก1.xlsx";
const outputPath = "C:/quotation/my-next-app/outputs/company-list/รายชื่อบริษัทก่อสร้างตกแต่งภายใน_100กม.xlsx";
const origin = "13.786390, 100.302771";

const companies = [
  {
    name: "ห้างหุ้นส่วนจำกัด ธนภูมิ เอ็นจิเนียริ่ง",
    phone: "02-800-2593, 081-527-5157",
    line: "0815275157",
    address: "29/2 หมู่ที่ 6 ต.ศาลายา อ.พุทธมณฑล จ.นครปฐม 73170",
    work: "รับเหมาก่อสร้างบ้าน อาคาร อพาร์ทเม้นท์ อาคารพาณิชย์ โรงงาน โครงสร้างเหล็ก รีโนเวท ต่อเติม และงานตกแต่งภายใน",
    source: "https://www.tanapum-engineering.com/",
  },
  {
    name: "บริษัท พีจีโฮม จำกัด",
    phone: "084-289-9794",
    line: "pghome4289",
    address: "518 ต.เจดีย์หัก อ.เมือง จ.ราชบุรี 70000",
    work: "รับสร้างบ้าน ออกแบบบ้าน ขออนุญาตก่อสร้าง และดูแลงานก่อสร้างครบวงจรในราชบุรี นครปฐม และสมุทรสงคราม",
    source: "https://www.pghome.co.th/contact",
  },
  {
    name: "บริษัท สุนทรีดีไซน์ จำกัด",
    phone: "080-681-7699, 097-982-7879",
    line: "sarawutnui",
    address: "38/804 ม.เค.ซี.รามอินทรา 7 ถ.ไทยรามัญ แขวงสามวาตะวันตก เขตคลองสามวา กรุงเทพมหานคร 10510",
    work: "ออกแบบตกแต่งภายใน รีโนเวท ต่อเติมบ้าน อาคาร อพาร์ทเม้นท์ คอนโด โรงแรม สำนักงาน และผลิตเฟอร์นิเจอร์บิวท์อิน",
    source: "https://www.soon-ta-ree-design.com/",
  },
  {
    name: "The Room 460",
    phone: "094-460-1000",
    line: "@TheRoom460",
    address: "54/1 ม.2 ต.บางขนุน อ.บางกรวย จ.นนทบุรี 11130",
    work: "ออกแบบตกแต่งภายใน เฟอร์นิเจอร์บิวท์อิน งานบิ้วอินบ้าน คอนโด ทาวน์โฮม สำนักงาน ร้านอาหาร และอพาร์ทเม้นท์",
    source: "https://www.theroom460.com/aboutus",
  },
  {
    name: "Neo Decor Design Co., Ltd.",
    phone: "087-687-1828, 086-355-2447, 02-193-0524",
    line: "0876871828",
    address: "45/12 หมู่ 12 ต.บางแม่นาง อ.บางใหญ่ จ.นนทบุรี 11140",
    work: "รับออกแบบตกแต่งภายใน ออฟฟิศ บิ้วอินบ้าน ห้องนอน ครัว ผลิตเฟอร์นิเจอร์ลอยตัวและบิวท์อิน",
    source: "https://neodecordesign.com/%E0%B8%95%E0%B8%B4%E0%B8%94%E0%B8%95%E0%B9%88%E0%B8%AD%E0%B9%80%E0%B8%A3%E0%B8%B2/",
  },
  {
    name: "LDA Inter Construction Co., Ltd.",
    phone: "063-810-0099, 02-120-6009",
    line: "ldainter",
    address: "40/98 Moo 11 Bangmaenang, Bangyai, Nonthaburi 11140",
    work: "Design & Build งานสถาปัตยกรรม ก่อสร้าง ต่อเติม ตกแต่งภายใน งานระบบ และเฟอร์นิเจอร์ติดตั้ง",
    source: "https://www.ldainter.com/",
  },
  {
    name: "บริษัท แลนดี้ โฮม (ประเทศไทย) จำกัด - นนทบุรี",
    phone: "02-938-3456-7",
    line: "@landyhome",
    address: "32/51 ถนนประชาชื่น-นนทบุรี 4 ต.บางเขน อ.เมืองนนทบุรี จ.นนทบุรี 11000",
    work: "รับสร้างบ้านบนที่ดินลูกค้า มีแบบบ้านให้เลือก และให้คำปรึกษาด้านการออกแบบ",
    source: "https://www.yellowpages.co.th/profile/%E0%B8%9A%E0%B8%A3%E0%B8%B4%E0%B8%A9%E0%B8%B1%E0%B8%97-%E0%B9%81%E0%B8%A5%E0%B8%99%E0%B8%94%E0%B8%B5%E0%B9%89-%E0%B9%82%E0%B8%AE%E0%B8%A1-%E0%B8%9B%E0%B8%A3%E0%B8%B0%E0%B9%80%E0%B8%97%E0%B8%A8%E0%B9%84%E0%B8%97%E0%B8%A2-%E0%B8%88%E0%B8%B3%E0%B8%81%E0%B8%B1%E0%B8%94-%E0%B8%99%E0%B8%99%E0%B8%97%E0%B8%9A%E0%B8%B8%E0%B8%A3%E0%B8%B5-1vPhC5ZtK",
  },
  {
    name: "บริษัท อาร์.เอส.พี.บี. 249 จำกัด",
    phone: "092-324-6289, 095-945-9178, 02-162-0848",
    line: "0923246289",
    address: "199/28 ซอย 5 หมู่บ้านฮาบิเทีย ราชพฤกษ์ ต.บางคูวัด อ.เมืองปทุมธานี จ.ปทุมธานี 12000",
    work: "รับสร้างบ้าน อาคาร ตึกแถว ก่อสร้างทุกรูปแบบ งานพื้น ตกแต่งภายใน รีโนเวท จัดสวน และวัสดุปูพื้น",
    source: "https://www.rsp249.com/",
  },
  {
    name: "บริษัท เก็ทไอเดีย ดีไซน์ จำกัด",
    phone: "088-914-4965",
    line: "j_designer",
    address: "41/66 หมู่บ้านกรีนวิลล์ หทัยราษฎร์ ต.ลาดสวาย อ.ลำลูกกา จ.ปทุมธานี 12150",
    work: "ออกแบบตกแต่งภายในและภายนอก งาน 3D รับเหมาก่อสร้าง รีโนเวททาวน์โฮม ตึกแถว และบิวท์อิน",
    source: "https://www.xn--12cm4bbhqbb2duadb0fwfcww6vqb4f.com/",
  },
  {
    name: "dooDeco / บริษัท เน็กซเตอร์ ลีฟวิ่ง จำกัด",
    phone: "06-2197-7314, 06-5523-1770, 06-1384-9853, 06-3209-7620",
    line: "dooDeco",
    address: "1 ถนนปูนซิเมนต์ไทย แขวงบางซื่อ เขตบางซื่อ กรุงเทพมหานคร 10800",
    work: "ออกแบบตกแต่งภายในบ้าน คอนโด และพื้นที่เชิงพาณิชย์ พร้อมบิ้วอินและติดตั้งเฟอร์นิเจอร์ฟิตอินครบวงจร",
    source: "https://doodeco.com/",
  },
  {
    name: "A.i.Design Studio Company Limited",
    phone: "081-832-0753, 02-272-6753",
    line: "aidesign.th",
    address: "4 Soi Senanikom 1 Soi 32 Ladprao, Bangkok 10230",
    work: "ออกแบบตกแต่งภายในบ้าน เพนท์เฮาส์ คอนโด สำนักงาน โชว์รูม ร้านค้า โรงแรม รีสอร์ท โรงพยาบาล คลินิก และพื้นที่สาธารณะ",
    source: "https://www.aidesign.co.th/",
  },
  {
    name: "STUDIO PREMIUM CO., LTD.",
    phone: "085-878-2494, 082-545-3635",
    line: "Studio3635",
    address: "6/2 ซอยร่วมเกล้า 4 ถนนร่มเกล้า แขวงมีนบุรี เขตมีนบุรี กรุงเทพมหานคร 10510",
    work: "ออกแบบ ก่อสร้าง ต่อเติม รีโนเวท ตกแต่งภายใน งานบิวท์อิน และงานอีเวนต์/พรีเมี่ยมครบวงจร",
    source: "https://studiopremium.co.th/",
  },
  {
    name: "Feel-idea design",
    phone: "092-767-5626, 086-707-0626",
    line: "feelidea",
    address: "133/49 หมู่บ้านรื่นฤดี 3 ถ.หทัยราษฎร์ เขตมีนบุรี กรุงเทพมหานคร 10510",
    work: "ออกแบบ ตกแต่ง รีโนเวท และก่อสร้างสไตล์โมเดิร์น",
    source: "https://bangkok.worldplaces.me/th/review/85450995-feel-idea-design.html",
  },
  {
    name: "แพรวพรรณราย คอนสตรัคชั่น / PPRCON",
    phone: "089-794-7252, 086-307-1065, 083-428-1117",
    line: "0834281117",
    address: "42/649 หมู่ 5 ซ.นิมิตใหม่ 20 แขวงทรายกองดิน เขตคลองสามวา กรุงเทพมหานคร 10510",
    work: "รับเหมาก่อสร้าง รีโนเวท ซ่อมแซมบ้าน ต่อเติม ปูกระเบื้อง ทำรั้ว งานปูน งานสี และงานช่างครบวงจร",
    source: "https://pprcon.com/",
  },
  {
    name: "JITTAKA INTERIOR & CONSTRUCTION CO., LTD.",
    phone: "098-874-6614",
    line: "@jittakaicservices",
    address: "88/252 ซอยบรมราชชนนี 62/4 แขวงศาลาธรรมสพน์ เขตทวีวัฒนา กรุงเทพมหานคร 10170",
    work: "ที่ปรึกษา ออกแบบตกแต่งภายใน ประสานงานโครงการตกแต่งภายใน และผลิตเฟอร์นิเจอร์ไม้ตามแบบ",
    source: "https://jittaka.com/",
  },
  {
    name: "a7design",
    phone: "065-192-4441, 095-919-3632",
    line: "@a7design / aiizmj7",
    address: "ซอยรามคำแหง 129/4 ถนนรามคำแหง แขวงสะพานสูง เขตสะพานสูง กรุงเทพมหานคร 10240",
    work: "Architecture and Interior Design งานออกแบบสถาปัตยกรรม ภายใน ภูมิทัศน์ และก่อสร้าง",
    source: "https://www.a7design.co.th/contact/",
  },
  {
    name: "บริษัท เพนท์เฮ้าส์ ดีไซน์ กรุ๊ป จำกัด",
    phone: "093-696-4515, 090-246-3635",
    line: "@penthousedesign",
    address: "13/8 ซอยเรือนไทย แขวงสายไหม เขตสายไหม กรุงเทพมหานคร 10220",
    work: "ออกแบบตกแต่งภายในและงานก่อสร้างระดับพรีเมียมสำหรับบ้าน คอนโด ออฟฟิศ ร้านอาหาร และโครงการพาณิชย์",
    source: "https://www.penthouse-design.com/contact-us",
  },
  {
    name: "บริษัท ซีซั่น เพ้นท์ จำกัด",
    phone: "02-579-9617-8, 086-413-8000",
    line: "@seasonpaint",
    address: "9/6 ซ.พหลโยธิน 42 ถ.พหลโยธิน แขวงเสนานิคม เขตจตุจักร กรุงเทพมหานคร 10900",
    work: "รับเหมาก่อสร้าง รีโนเวทอาคาร ตกแต่งภายใน ซ่อมแซมอาคาร ทาสี กันซึม งานสุขาภิบาล ไฟฟ้า และก่อสร้างอาคารใหม่",
    source: "https://www.seasonpaint.co.th/about-us/",
  },
  {
    name: "บริษัท บิลท์อินเวิร์ค โปรเฟสชั่นแนล จำกัด",
    phone: "098-267-1726, 080-998-6626",
    line: "@builtinwork",
    address: "599/165 ถนนรัชดาภิเษก แขวงจตุจักร เขตจตุจักร กรุงเทพมหานคร 10900",
    work: "ออกแบบตกแต่งภายในครบวงจร ตกแต่งร้านค้า ร้านยา คลินิก ร้านอาหาร คาเฟ่ บ้าน คอนโด และติดตั้งทั่วประเทศ",
    source: "https://www.builtinwork.com/contact",
  },
  {
    name: "บริษัท เอส ซี แกรนด์ จำกัด",
    phone: "02-066-6663, 065-575-1555",
    line: "@thescgrand",
    address: "751, 753 ถ.เพชรเกษม แขวงบางหว้า เขตภาษีเจริญ กรุงเทพมหานคร 10160",
    work: "รับสร้างบ้านหรูอัจฉริยะ ออกแบบบ้านโมเดิร์น บ้าน 2-3 ชั้น และรับสร้างบ้านในกรุงเทพฯ/ปริมณฑล",
    source: "https://www.scgrand.co.th/contact-us/",
  },
  {
    name: "บริษัท กริท บิลด์ จำกัด",
    phone: "093-364-9782",
    line: "@gritbuild",
    address: "โครงการคริสตัล ดีไซน์ เซ็นเตอร์ อาคาร L4 ชั้น 2 ห้อง 4L4-205,207,209 เลขที่ 1448/19 ซ.ลาดพร้าว 87 แขวงคลองจั่น เขตบางกะปิ กรุงเทพมหานคร",
    work: "รับสร้างบ้าน ออกแบบและก่อสร้างโดยทีมวิศวกรและสถาปนิก ควบคุมคุณภาพและดูแลหลังส่งมอบ",
    source: "https://gritbuild.net/contact-us/",
  },
  {
    name: "บริษัท สิริปันทวี จำกัด",
    phone: "080-902-0955, 092-955-9523, 092-862-3555",
    line: "@siripantawi",
    address: "5/16 ซอยบรมราชชนนี 13 แขวงอรุณอมรินทร์ เขตบางกอกน้อย กรุงเทพมหานคร 10700",
    work: "รับสร้างบ้านครบวงจร ตรวจบ้าน รีโนเวท บิ้วอิน ตกแต่งภายใน และบริการเสริมด้านบ้าน",
    source: "https://siripantawi.com/th/contact_us",
  },
  {
    name: "บริษัท เอฟดี โฮม ดีไซน์ แอดดิชันแนล จำกัด",
    phone: "065-536-4146, 091-789-5958",
    line: "@FD789",
    address: "10/187 ซอยรามอินทรา 8 แยก 20 แขวงอนุสาวรีย์ เขตบางเขน กรุงเทพมหานคร 10220",
    work: "ติดตั้งฉากกั้นห้อง ผ้าม่าน วอลเปเปอร์ มุ้งจีบ และตกแต่งบ้าน/คอนโดครบวงจร",
    source: "https://www.fdhome.co.th/",
  },
  {
    name: "บริษัท ธัญรินท์ เดคอร์เรชั่น จำกัด",
    phone: "02-865-4655-6, 099-286-0101",
    line: "@tanyarin",
    address: "18 ซ.บางแวก 122 แขวงบางไผ่ เขตบางแค กรุงเทพมหานคร 10160",
    work: "ตกแต่งพื้นผิวภายในและภายนอก ฉาบ Special Paint ติดแผ่นทอง ออกแบบ ติดตั้ง ปรับพื้น ทำเฟอร์นิเจอร์ Built-in และงานผิวตกแต่งครบวงจร",
    source: "https://page.line.me/wqk2980x",
  },
  {
    name: "SP Asset",
    phone: "02-091-5995, 090-052-2222",
    line: "@spasset",
    address: "134 ซอยประชาสงเคราะห์ 23 แขวงดินแดง กรุงเทพมหานคร 10400",
    work: "ออกแบบบ้าน รับสร้างบ้าน ตกแต่งภายใน รีโนเวท งานบิวท์อิน จัดหาเฟอร์นิเจอร์ลอยตัว ของตกแต่ง และผ้าม่าน",
    source: "https://www.spasset.com/index.php/main/contact",
  },
  {
    name: "Allsenses Design & Built Co., Ltd.",
    phone: "081-135-0358",
    line: "0811350358",
    address: "138/12 ถ.นนทบุรี ต.ท่าทราย อ.เมืองนนทบุรี จ.นนทบุรี 11000",
    work: "ออกแบบ รับเหมา รีโนเวท รับสร้างบ้าน พร้อมตกแต่งครบวงจร งานไฟฟ้า ระบบน้ำ ปูหิน/กระเบื้อง งานสี และบริการหลังการขาย",
    source: "https://www.thaithurkic.com/allsenses-design-built-co-ltd-081-135-0358",
  },
  {
    name: "บริษัท อินฟินิท การ์เด้น แอนด์ แลนด์สเคป ดีไซน์ จำกัด",
    phone: "093-245-6363, 099-324-6363",
    line: "",
    address: "243/6 ถนนอ่อนนุช แขวงประเวศ เขตประเวศ กรุงเทพมหานคร 10250",
    work: "ออกแบบจัดสวน Landscape & Hardscape ระบบสวน น้ำตก บ่อปลาคาร์ฟ ไฟสวน และงานภูมิทัศน์ครบวงจร",
    source: "https://www.infinitegardenandlandscape.com/",
  },
  {
    name: "บริษัท ซีคอน จำกัด (Seacon Home)",
    phone: "1391, 02-237-3781, 02-237-2900",
    line: "@seaconhome",
    address: "107-115 ถนนสี่พระยา แขวงสี่พระยา เขตบางรัก กรุงเทพมหานคร 10500",
    work: "รับสร้างบ้าน ออกแบบบ้าน และบริการก่อสร้างบ้านโดยระบบซีคอน/พรีคาสท์",
    source: "https://www.seacon.co.th/seacon_update/site-seeing/",
  },
  {
    name: "Royal House",
    phone: "02-459-4646",
    line: "Line OA (หน้าเว็บไม่ระบุ ID)",
    address: "1148 ถนนนครไชยศรี เขตดุสิต กรุงเทพมหานคร 10300",
    work: "รับสร้างบ้าน ออกแบบบ้าน และให้คำปรึกษาการสร้างบ้าน มีสาขาในกรุงเทพฯ และปริมณฑล",
    source: "https://www.royalhouse.co.th/contact-us/",
  },
  {
    name: "บริษัท โปรเจค อินทีเรีย วิชั่น จำกัด",
    phone: "02-915-5512-3",
    line: "",
    address: "386/1 ถ.หทัยราษฎร์ แขวงสามวาตะวันตก เขตคลองสามวา กรุงเทพมหานคร 10510",
    work: "ออกแบบตกแต่งภายใน รับเหมาตกแต่งภายใน งานสถาปัตยกรรม ภูมิสถาปัตยกรรม และผลิตเฟอร์นิเจอร์ให้บริษัท/ร้านค้าทั่วประเทศ",
    source: "https://www.thaijob.com/company/3336",
  },
];

// const escapeFormulaText = (text) => String(text ?? "").replace(/"/g, '""');
const mapsUrl = (company) =>
  `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(`${company.name} ${company.address}`)}`;
const escapeXml = (text) =>
  String(text ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
const domainLabel = (url) => {
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return "แหล่งข้อมูล";
  }
};

async function addWorksheetHyperlinks(xlsxPath, sheetName, links) {
  const buffer = await fs.readFile(xlsxPath);
  const zip = await JSZip.loadAsync(buffer);
  const workbookXml = await zip.file("xl/workbook.xml").async("string");
  const workbookRelsXml = await zip.file("xl/_rels/workbook.xml.rels").async("string");

  const sheetMatch = [...workbookXml.matchAll(/<(?:[A-Za-z0-9_]+:)?sheet\b[^>]*name="([^"]*)"[^>]*\sr:id="([^"]+)"/g)]
    .find((match) => match[1] === sheetName);
  if (!sheetMatch) throw new Error(`Cannot find worksheet ${sheetName}`);

  const relId = sheetMatch[2];
  const relTag = [...workbookRelsXml.matchAll(/<Relationship\b[^>]*>/g)]
    .map((match) => match[0])
    .find((tag) => tag.includes(`Id="${relId}"`));
  const relMatch = relTag?.match(/Target="([^"]+)"/);
  if (!relTag || !relMatch) throw new Error(`Cannot find workbook relationship ${relId}`);

  const sheetPath = relMatch[1].startsWith("/")
    ? relMatch[1].replace(/^\//, "")
    : `xl/${relMatch[1]}`;
  const sheetRelsPath = path.posix.join(
    path.posix.dirname(sheetPath),
    "_rels",
    `${path.posix.basename(sheetPath)}.rels`,
  );

  let sheetXml = await zip.file(sheetPath).async("string");
  let sheetRelsXml = zip.file(sheetRelsPath)
    ? await zip.file(sheetRelsPath).async("string")
    : '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"></Relationships>';
  const sheetPrefix = sheetXml.match(/<([A-Za-z0-9_]+):worksheet\b/)?.[1];
  const xmlPrefix = sheetPrefix ? `${sheetPrefix}:` : "";

  const existingIds = [...sheetRelsXml.matchAll(/Id="rId(\d+)"/g)].map((match) => Number(match[1]));
  let nextId = existingIds.length ? Math.max(...existingIds) + 1 : 1;

  const hyperlinkNodes = [];
  const relationshipNodes = [];
  for (const link of links) {
    const id = `rId${nextId++}`;
    relationshipNodes.push(
      `<Relationship Id="${id}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/hyperlink" Target="${escapeXml(link.target)}" TargetMode="External"/>`,
    );
    hyperlinkNodes.push(`<${xmlPrefix}hyperlink ref="${link.ref}" r:id="${id}"/>`);
  }

  sheetRelsXml = sheetRelsXml.replace("</Relationships>", `${relationshipNodes.join("")}</Relationships>`);

  const hyperlinksXml = `<${xmlPrefix}hyperlinks xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">${hyperlinkNodes.join("")}</${xmlPrefix}hyperlinks>`;
  const insertionMatch = sheetXml.match(
    /<(?:[A-Za-z0-9_]+:)?(?:printOptions|pageMargins|pageSetup|headerFooter|rowBreaks|colBreaks|customProperties|cellWatches|ignoredErrors|smartTags|drawing|legacyDrawing|picture|oleObjects|controls|webPublishItems|tableParts|extLst)\b|<\/(?:[A-Za-z0-9_]+:)?worksheet>/,
  );
  const insertionIndex = insertionMatch?.index;
  if (insertionIndex === undefined) throw new Error("Cannot find worksheet hyperlink insertion point");
  sheetXml = `${sheetXml.slice(0, insertionIndex)}${hyperlinksXml}${sheetXml.slice(insertionIndex)}`;

  zip.file(sheetPath, sheetXml);
  zip.file(sheetRelsPath, sheetRelsXml);
  const output = await zip.generateAsync({
    type: "nodebuffer",
    compression: "DEFLATE",
    compressionOptions: { level: 6 },
  });
  await fs.writeFile(xlsxPath, output);
}

const input = await FileBlob.load(inputPath);
const workbook = await SpreadsheetFile.importXlsx(input);
const sheet = workbook.worksheets.getItem("Sheet1");
sheet.name = "รายชื่อบริษัท";
sheet.reset();
sheet.deleteAllDrawings();

sheet.getRange("A1:G1").merge();
sheet.getRange("A1").values = [["รายชื่อบริษัทก่อสร้าง / ตกแต่งภายใน / Designer ภายในรัศมี 100 กม."]];
sheet.getRange("A2:G2").merge();
sheet.getRange("A2").values = [[`ศูนย์กลางพิกัด ${origin} | ตรวจสอบจากแหล่งออนไลน์ ณ วันที่ 6 พฤษภาคม 2026 | ช่องว่างหมายถึงไม่พบ LINE ID เป็นข้อความ`]];

const headers = [
  "ลำดับ",
  "ชื่อบริษัท",
  "เบอร์โทร",
  "ไอดีไลน์(ถ้ามี)",
  "ที่อยู่ใน Google Map",
  "ลักษณะงานบริษัทที่ทำ",
  "แหล่งข้อมูล",
];

const rows = companies.map((company, index) => [
  index + 1,
  company.name,
  company.phone,
  company.line || "ไม่พบ",
  company.address,
  company.work,
  domainLabel(company.source),
]);

sheet.getRange("A4").write([headers, ...rows]);

const tableRange = `A4:G${companies.length + 4}`;
const table = sheet.tables.add(tableRange, true);
table.name = "CompanyLeads";

sheet.getRange("A1:G1").format.fill = "#1F4E79";
sheet.getRange("A1:G1").format.font = { color: "#FFFFFF", bold: true, size: 16 };
sheet.getRange("A1:G1").format.horizontalAlignment = "center";
sheet.getRange("A1:G1").format.rowHeightPx = 34;

sheet.getRange("A2:G2").format.fill = "#EAF3F8";
sheet.getRange("A2:G2").format.font = { color: "#1F2937", italic: true, size: 10 };
sheet.getRange("A2:G2").format.rowHeightPx = 28;

sheet.getRange("A4:G4").format.fill = "#305496";
sheet.getRange("A4:G4").format.font = { color: "#FFFFFF", bold: true };
sheet.getRange("A4:G4").format.horizontalAlignment = "center";
sheet.getRange("A4:G4").format.wrapText = true;
sheet.getRange("A4:G4").format.rowHeightPx = 38;

sheet.getRange(`A5:G${companies.length + 4}`).format.borders = {
  preset: "insideHorizontal",
  style: "thin",
  color: "#D9E2F3",
};
sheet.getRange(`A5:G${companies.length + 4}`).format.wrapText = true;
sheet.getRange(`A5:G${companies.length + 4}`).format.rowHeightPx = 70;
sheet.getRange(`A5:A${companies.length + 4}`).format.horizontalAlignment = "center";
sheet.getRange(`A5:A${companies.length + 4}`).format.columnWidthPx = 55;
sheet.getRange(`B5:B${companies.length + 4}`).format.columnWidthPx = 250;
sheet.getRange(`C5:C${companies.length + 4}`).format.columnWidthPx = 165;
sheet.getRange(`D5:D${companies.length + 4}`).format.columnWidthPx = 150;
sheet.getRange(`E5:E${companies.length + 4}`).format.columnWidthPx = 390;
sheet.getRange(`F5:F${companies.length + 4}`).format.columnWidthPx = 500;
sheet.getRange(`G5:G${companies.length + 4}`).format.columnWidthPx = 180;
sheet.getRange("A4:G4").format.columnWidthPx = 120;
sheet.getRange("A:A").format.columnWidthPx = 55;
sheet.getRange("B:B").format.columnWidthPx = 250;
sheet.getRange("C:C").format.columnWidthPx = 165;
sheet.getRange("D:D").format.columnWidthPx = 150;
sheet.getRange("E:E").format.columnWidthPx = 390;
sheet.getRange("F:F").format.columnWidthPx = 500;
sheet.getRange("G:G").format.columnWidthPx = 180;
sheet.getRange(`E5:E${companies.length + 4}`).format.font = { color: "#0563C1" };
sheet.getRange(`G5:G${companies.length + 4}`).format.font = { color: "#0563C1" };

sheet.freezePanes.freezeRows(4);

const preview = await workbook.inspect({
  kind: "table",
  range: "รายชื่อบริษัท!A1:G12",
  include: "values,formulas",
  tableMaxRows: 12,
  tableMaxCols: 7,
});
console.log(preview.ndjson);

const formulaErrors = await workbook.inspect({
  kind: "match",
  searchTerm: "#REF!|#DIV/0!|#VALUE!|#NAME\\?|#N/A",
  options: { useRegex: true, maxResults: 100 },
  summary: "formula error scan",
});
console.log(formulaErrors.ndjson);

await workbook.render({ sheetName: "รายชื่อบริษัท", range: "A1:G18", scale: 1 });

await fs.mkdir("C:/quotation/my-next-app/outputs/company-list", { recursive: true });
const output = await SpreadsheetFile.exportXlsx(workbook);
await output.save(outputPath);
await addWorksheetHyperlinks(outputPath, "รายชื่อบริษัท", companies.flatMap((company, index) => {
  const row = index + 5;
  return [
    { ref: `E${row}`, target: mapsUrl(company) },
    { ref: `G${row}`, target: company.source },
  ];
}));
console.log(`saved:${outputPath}`);
