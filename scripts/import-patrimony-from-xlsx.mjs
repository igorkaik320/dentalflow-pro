import fs from "node:fs/promises";
import path from "node:path";
import JSZip from "jszip";
import { XMLParser } from "fast-xml-parser";
import { createClient } from "@supabase/supabase-js";

const {
  TARGET_SUPABASE_URL,
  TARGET_SUPABASE_SERVICE_ROLE_KEY,
  TARGET_SUPABASE_ANON_KEY,
  IMPORT_USER_EMAIL,
  IMPORT_USER_PASSWORD,
  TARGET_CLINIC_ID,
  INVENTARIO_XLSX_PATH = "C:\\Users\\USER\\Downloads\\INVENTARIO.xlsx",
} = process.env;

const dryRun = process.argv.includes("--dry-run") || process.env.DRY_RUN === "1";

const authKey = TARGET_SUPABASE_SERVICE_ROLE_KEY || TARGET_SUPABASE_ANON_KEY;
const shouldSignIn = !TARGET_SUPABASE_SERVICE_ROLE_KEY;

if (!dryRun && (!TARGET_SUPABASE_URL || !authKey || !TARGET_CLINIC_ID)) {
  console.error("Missing env vars: TARGET_SUPABASE_URL, TARGET_CLINIC_ID and either TARGET_SUPABASE_SERVICE_ROLE_KEY or TARGET_SUPABASE_ANON_KEY");
  process.exit(1);
}

if (!dryRun && shouldSignIn && (!IMPORT_USER_EMAIL || !IMPORT_USER_PASSWORD)) {
  console.error("Missing env vars for authenticated import: IMPORT_USER_EMAIL, IMPORT_USER_PASSWORD");
  process.exit(1);
}

const supabase = dryRun ? null : createClient(TARGET_SUPABASE_URL, authKey, {
  auth: { persistSession: false, autoRefreshToken: false },
});

const parser = new XMLParser({
  ignoreAttributes: false,
  attributeNamePrefix: "@_",
  removeNSPrefix: false,
});

const statusDefault = "Bom";
const mainSheetNames = [
  "administração",
  "copa",
  "lavanderia",
  "area interna",
  "banheiro interno",
  "area externa",
  "biomedicas",
  "recepção",
  "banheiro cliente",
  "hyperslim",
  "fachada",
  "garragem",
  "garagem",
  "area comum 1º pav",
  "avaliação 1",
  "avaliação 2",
  "atendimento 2",
  "atendimento 3",
  "atendimento 4",
  "atendimento 5",
  "atendimento 6",
  "atendimento 7",
  "atendimento 8",
  "atendimento 9",
  "atendimento 10",
  "atendimento 11",
  "atendimento 12",
  "estoque",
];

const canonicalEnvironmentBySheet = new Map([
  ["administracao", "Administração"],
  ["copa", "Copa"],
  ["lavanderia", "Lavanderia"],
  ["area interna", "Área Interna"],
  ["banheiro interno", "Banheiro Interno"],
  ["area externa", "Área Externa"],
  ["biomedicas", "Biomédicas"],
  ["recepcao", "Recepção"],
  ["banheiro cliente", "Banheiro Cliente"],
  ["hyperslim", "Hyperslim"],
  ["fachada", "Fachada"],
  ["garragem", "Garagem"],
  ["garagem", "Garagem"],
  ["area comum 1o pav", "Área Comum 1º Pav"],
  ["area comum 1º pav", "Área Comum 1º Pav"],
  ["avaliacao 1", "Avaliação 1"],
  ["avaliacao 2", "Avaliação 2"],
  ["atendimento 2", "Atendimento 2"],
  ["atendimento 3", "Atendimento 3"],
  ["atendimento 4", "Atendimento 4"],
  ["atendimento 5", "Atendimento 5"],
  ["atendimento 6", "Atendimento 6"],
  ["atendimento 7", "Atendimento 7"],
  ["atendimento 8", "Atendimento 8"],
  ["atendimento 9", "Atendimento 9"],
  ["atendimento 10", "Atendimento 10"],
  ["atendimento 11", "Atendimento 11"],
  ["atendimento 12", "Atendimento 12"],
  ["estoque", "Estoque"],
]);

function arr(value) {
  if (!value) return [];
  return Array.isArray(value) ? value : [value];
}

function normalizeText(value) {
  return String(value || "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim();
}

function displayEnvironment(value, fallback) {
  const canonical = canonicalEnvironmentBySheet.get(normalizeText(fallback));
  if (canonical) return canonical;
  const raw = String(value || fallback || "").replace(/^ambiente:\s*/i, "").trim();
  return raw
    .toLowerCase()
    .split(/\s+/)
    .map((word) => word ? word[0].toUpperCase() + word.slice(1) : word)
    .join(" ")
    .replace("1º Pav", "1º Pav");
}

function columnName(cellRef) {
  return String(cellRef || "").replace(/[0-9]/g, "");
}

function rowNumber(cellRef) {
  return Number(String(cellRef || "").replace(/[A-Z]/gi, "")) || 0;
}

function cellText(cell, sharedStrings) {
  if (!cell) return "";
  if (cell.f) return String(typeof cell.f === "object" ? cell.f["#text"] || "" : cell.f);
  const rawValue = cell.v;
  const value = rawValue === undefined ? "" : (typeof rawValue === "object" ? richText(rawValue) : String(rawValue));
  if (cell["@_t"] === "s") return sharedStrings[Number(value)] || "";
  if (cell["@_t"] === "inlineStr") return richText(cell.is);
  return value;
}

function richText(node) {
  if (!node) return "";
  if (typeof node === "string") return node;
  if (node["#text"] !== undefined) return String(node["#text"]);
  if (node.t !== undefined) return typeof node.t === "object" ? richText(node.t) : String(node.t);
  if (node.r) return arr(node.r).map((part) => richText(part)).join("");
  return "";
}

function targetPath(baseDir, target) {
  const cleanTarget = String(target || "").replace(/\\/g, "/");
  const resolved = path.posix.normalize(path.posix.join(baseDir, cleanTarget));
  return resolved.replace(/^\//, "");
}

function relMap(relsXml) {
  const relationships = parser.parse(relsXml).Relationships?.Relationship;
  const map = new Map();
  for (const rel of arr(relationships)) {
    map.set(rel["@_Id"], rel["@_Target"]);
  }
  return map;
}

function extContentType(filePath) {
  const ext = path.extname(filePath).toLowerCase();
  if (ext === ".png") return "image/png";
  if (ext === ".webp") return "image/webp";
  if (ext === ".gif") return "image/gif";
  return "image/jpeg";
}

function safePathPart(value) {
  return normalizeText(value).replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "") || "item";
}

async function readXml(zip, filePath) {
  const file = zip.file(filePath);
  if (!file) return null;
  return file.async("text");
}

async function getSharedStrings(zip) {
  const xml = await readXml(zip, "xl/sharedStrings.xml");
  if (!xml) return [];
  const data = parser.parse(xml);
  return arr(data.sst?.si).map((si) => richText(si));
}

async function getWorkbookSheets(zip) {
  const workbookXml = await readXml(zip, "xl/workbook.xml");
  const relsXml = await readXml(zip, "xl/_rels/workbook.xml.rels");
  if (!workbookXml || !relsXml) throw new Error("Workbook metadata not found.");
  const workbook = parser.parse(workbookXml);
  const rels = relMap(relsXml);
  return arr(workbook.workbook?.sheets?.sheet).map((sheet) => ({
    name: sheet["@_name"],
    relId: sheet["@_r:id"],
    path: targetPath("xl", rels.get(sheet["@_r:id"])),
  }));
}

async function getSheetMedia(zip, sheetPath) {
  const sheetXml = await readXml(zip, sheetPath);
  if (!sheetXml) return [];
  const sheet = parser.parse(sheetXml).worksheet;
  const drawingRelId = sheet?.drawing?.["@_r:id"];
  if (!drawingRelId) return [];

  const sheetRelsPath = path.posix.join(path.posix.dirname(sheetPath), "_rels", `${path.posix.basename(sheetPath)}.rels`);
  const sheetRelsXml = await readXml(zip, sheetRelsPath);
  if (!sheetRelsXml) return [];
  const sheetRels = relMap(sheetRelsXml);
  const drawingPath = targetPath(path.posix.dirname(sheetPath), sheetRels.get(drawingRelId));

  const drawingXml = await readXml(zip, drawingPath);
  const drawingRelsXml = await readXml(zip, path.posix.join(path.posix.dirname(drawingPath), "_rels", `${path.posix.basename(drawingPath)}.rels`));
  if (!drawingXml || !drawingRelsXml) return [];

  const drawingRels = relMap(drawingRelsXml);
  const matches = Array.from(drawingXml.matchAll(/r:embed="([^"]+)"/g)).map((match) => match[1]);
  return matches
    .map((relId) => drawingRels.get(relId))
    .filter(Boolean)
    .map((target) => targetPath(path.posix.dirname(drawingPath), target));
}

function parseRows(sheetXml, sharedStrings) {
  const worksheet = parser.parse(sheetXml).worksheet;
  const rows = arr(worksheet?.sheetData?.row);
  const matrix = new Map();
  for (const row of rows) {
    const number = Number(row["@_r"]) || 0;
    const values = {};
    for (const cell of arr(row.c)) {
      values[columnName(cell["@_r"])] = cellText(cell, sharedStrings).trim();
    }
    matrix.set(number, values);
  }
  return matrix;
}

function extractPhotoSheetName(value) {
  const text = String(value || "").trim();
  const match = text.match(/'?([^'!]+)'?!A1/i);
  if (match) return match[1].trim();
  return text && !/^foto$/i.test(text) ? text.replace(/^#?'/, "").replace(/'!A1$/i, "").trim() : "";
}

async function parseInventory(zip) {
  const sharedStrings = await getSharedStrings(zip);
  const sheets = await getWorkbookSheets(zip);
  const sheetByName = new Map(sheets.map((sheet) => [sheet.name, sheet]));
  const mediaByPhotoSheet = new Map();

  for (const sheet of sheets) {
    const media = await getSheetMedia(zip, sheet.path);
    if (media.length > 0) mediaByPhotoSheet.set(sheet.name, media);
  }

  const items = [];
  for (const sheet of sheets) {
    if (!mainSheetNames.map(normalizeText).includes(normalizeText(sheet.name))) continue;
    const xml = await readXml(zip, sheet.path);
    if (!xml) continue;
    const rows = parseRows(xml, sharedStrings);
    const environment = displayEnvironment(rows.get(1)?.A, sheet.name);

    for (const [rowIndex, row] of rows.entries()) {
      if (rowIndex <= 2) continue;
      const name = String(row.B || "").trim();
      if (!name) continue;
      const photoSheetName = extractPhotoSheetName(row.F);
      const photoSheet = photoSheetName ? sheetByName.get(photoSheetName) : null;
      const media = photoSheet ? (mediaByPhotoSheet.get(photoSheet.name) || []) : [];
      items.push({
        source_sheet: sheet.name,
        source_row: rowIndex,
        environment,
        name,
        quantity: Number.parseInt(row.A, 10) || 1,
        color: row.C || null,
        supplier: row.D || null,
        model: row.E || null,
        description: null,
        status: statusDefault,
        media,
      });
    }
  }
  return items;
}

async function uploadFirstPhoto(zip, item) {
  const mediaPath = item.media?.[0];
  if (!mediaPath) return null;
  const media = zip.file(mediaPath);
  if (!media) return null;
  const bytes = await media.async("nodebuffer");
  const extension = path.extname(mediaPath).toLowerCase() || ".jpg";
  const objectPath = `${TARGET_CLINIC_ID}/${safePathPart(item.environment)}/${safePathPart(item.source_sheet)}-${item.source_row}${extension}`;
  const { error } = await supabase.storage.from("patrimony-photos").upload(objectPath, bytes, {
    contentType: extContentType(mediaPath),
    upsert: true,
  });
  if (error) throw error;
  const { data } = supabase.storage.from("patrimony-photos").getPublicUrl(objectPath);
  return data.publicUrl;
}

async function upsertItem(zip, item) {
  const photoUrl = await uploadFirstPhoto(zip, item);
  const payload = {
    clinic_id: TARGET_CLINIC_ID,
    environment: item.environment,
    name: item.name,
    quantity: item.quantity,
    color: item.color,
    supplier: item.supplier,
    model: item.model,
    photo_url: photoUrl,
    description: item.description,
    status: item.status,
    source_sheet: item.source_sheet,
    source_row: item.source_row,
  };

  const { data: existing, error: existingError } = await supabase
    .from("patrimonies")
    .select("id")
    .eq("clinic_id", TARGET_CLINIC_ID)
    .eq("source_sheet", item.source_sheet)
    .eq("source_row", item.source_row)
    .maybeSingle();
  if (existingError) throw existingError;

  if (existing?.id) {
    const { error } = await supabase.from("patrimonies").update(payload).eq("id", existing.id);
    if (error) throw error;
    return "updated";
  }

  const { error } = await supabase.from("patrimonies").insert(payload);
  if (error) throw error;
  return "inserted";
}

const fileBuffer = await fs.readFile(INVENTARIO_XLSX_PATH);
const zip = await JSZip.loadAsync(fileBuffer);
const items = await parseInventory(zip);

if (dryRun) {
  const byEnvironment = Object.fromEntries(
    Array.from(items.reduce((map, item) => map.set(item.environment, (map.get(item.environment) || 0) + 1), new Map()).entries())
      .sort((a, b) => a[0].localeCompare(b[0], "pt-BR", { numeric: true }))
  );
  console.log(JSON.stringify({
    parsed: items.length,
    withPhotos: items.filter((item) => item.media?.length > 0).length,
    byEnvironment,
    sample: items.slice(0, 5).map(({ media, ...item }) => ({ ...item, mediaCount: media.length })),
  }, null, 2));
  process.exit(0);
}

if (shouldSignIn) {
  const { error } = await supabase.auth.signInWithPassword({
    email: IMPORT_USER_EMAIL,
    password: IMPORT_USER_PASSWORD,
  });
  if (error) {
    console.error(`Could not sign in import user: ${error.message}`);
    process.exit(1);
  }
}

let inserted = 0;
let updated = 0;
for (const item of items) {
  const result = await upsertItem(zip, item);
  if (result === "inserted") inserted += 1;
  if (result === "updated") updated += 1;
}

console.log(JSON.stringify({
  imported: items.length,
  inserted,
  updated,
  withPhotos: items.filter((item) => item.media?.length > 0).length,
}, null, 2));
