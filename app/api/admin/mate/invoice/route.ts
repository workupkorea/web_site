import { join } from "node:path";
import ExcelJS, { type Worksheet } from "exceljs";
import { isAdmin } from "@/lib/admin-auth";
import { listMateActivities, listMateShipments } from "@/lib/mate-activity-server";
import { MATE_SHIPPING_COST, mateResponseProducts } from "@/lib/mate-activities";
import { formatMatePhone, parseRound, seoulDate } from "@/lib/mate";

type Cells = (string | number | null)[];
const noCache = { "Cache-Control": "private, no-store" };

function error(message: string, status: number) {
  return Response.json({ error: message }, { status, headers: noCache });
}

function populate(sheet: Worksheet, first: number, width: number, records: Cells[], sampleNumber = first) {
  const sample = sheet.getRow(sampleNumber);
  const styles = Array.from({ length: width }, (_, index) => sample.getCell(index + 1).style);
  const height = sample.height;
  const lastRow = sheet.rowCount;
  for (let index = first; index <= lastRow; index++) {
    const row = sheet.getRow(index);
    row.values = [];
    delete (row as Partial<typeof row>).height;
  }
  for (const [index, record] of records.entries()) {
    const row = sheet.getRow(first + index);
    row.height = height;
    for (const [column, value] of record.entries()) {
      const cell = row.getCell(column + 1);
      cell.style = { ...styles[column] };
      cell.value = value === "" ? null : value;
    }
  }
}

export async function GET(request: Request) {
  if (!(await isAdmin())) return error("관리자 로그인이 필요합니다.", 403);
  const query = new URL(request.url).searchParams;
  const round = parseRound(query.get("round"));
  const activity = parseRound(query.get("activity"));
  if (!round || !activity) return error("회차를 확인해 주세요.", 400);

  try {
    const activities = await listMateActivities(round);
    if (activities.error) throw activities.error;
    const selected = activities.data?.find((item) => item.activity_no === activity);
    if (!selected) return error("등록된 회차를 찾지 못했습니다.", 404);
    const shipments = await listMateShipments(round, activity);
    if (!shipments.length) return error("송장을 내려받을 참여 응답이 없습니다.", 404);

    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.readFile(join(process.cwd(), "public", "templates", "giveaway-invoice-template.xlsx"));
    const summary = workbook.getWorksheet("1차선정");
    const waybill = workbook.getWorksheet("엑셀파일 첫행-제목없음");
    if (!summary || !waybill) throw new Error("Invalid invoice template");

    const products: Cells[] = [];
    const deliveries: Cells[] = [];
    for (const shipment of shipments) {
      const { name, sns_id, phone, address } = shipment.recipient;
      const phoneLabel = formatMatePhone(phone);
      const items = mateResponseProducts(selected.product_name, shipment);
      for (const product of items) {
        products.push([null, null, "@" + sns_id, name, phoneLabel, address, product.name, product.color, product.size, 1]);
      }
      const inventory = items.map((item) => [item.name, item.color, item.size].filter(Boolean).join("_") + "(1)").join(", ");
      deliveries.push([name, null, address, phoneLabel, phoneLabel, 1, MATE_SHIPPING_COST, "010", inventory]);
    }
    populate(summary, 3, 10, products);
    populate(waybill, 1, 9, deliveries, 2);

    const buffer = await workbook.xlsx.writeBuffer();
    const filename = `워크업_메이트_${round}기_${activity}회차_송장_${seoulDate()}.xlsx`;
    return new Response(new Uint8Array(buffer), {
      headers: {
        ...noCache,
        "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        "Content-Disposition": `attachment; filename="mate-${round}-activity-${activity}.xlsx"; filename*=UTF-8''${encodeURIComponent(filename)}`,
        "X-Content-Type-Options": "nosniff",
      },
    });
  } catch {
    return error("송장 파일을 만들지 못했습니다. 다시 시도해 주세요.", 500);
  }
}
