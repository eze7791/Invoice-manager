import { and, count, eq, gte, isNull, lt, lte, sql, sum } from "drizzle-orm";
import type { Db } from "../db";
import { schema } from "../db";
import { listInvoices, todayInSpain } from "./invoices";

const { invoices, clients } = schema;

const zero = (v: string | null | undefined) => v ?? "0.00";

/** Resumen para la pantalla de inicio. Solo cuenta facturas emitidas. */
export async function getDashboard(db: Db, issuerId: string) {
  const today = todayInSpain();
  const monthStart = `${today.slice(0, 7)}-01`;
  const yearStart = `${today.slice(0, 4)}-01-01`;
  const issued = and(eq(invoices.issuerId, issuerId), eq(invoices.status, "emitida"));

  const totals = (where: ReturnType<typeof and>) =>
    db
      .select({ count: count(), total: sum(invoices.grandTotal), base: sum(invoices.taxableBase), irpf: sum(invoices.irpfTotal) })
      .from(invoices)
      .where(where)
      .then((r) => r[0]!);

  const [month, year, unpaid, overdue, clientCount, recent, monthly] = await Promise.all([
    totals(and(issued, gte(invoices.issueDate, monthStart), lte(invoices.issueDate, today))),
    totals(and(issued, gte(invoices.issueDate, yearStart), lte(invoices.issueDate, today))),
    totals(and(issued, isNull(invoices.paidAt))),
    totals(and(issued, isNull(invoices.paidAt), lt(invoices.dueDate, today))),
    db
      .select({ count: count() })
      .from(clients)
      .where(and(eq(clients.issuerId, issuerId), isNull(clients.archivedAt)))
      .then((r) => r[0]!.count),
    listInvoices(db, issuerId).then((list) => list.slice(0, 5)),
    // Facturado por mes en el año en curso (base imponible).
    db
      .select({ month: sql<string>`to_char(${invoices.issueDate}, 'YYYY-MM')`, base: sum(invoices.taxableBase) })
      .from(invoices)
      .where(and(issued, gte(invoices.issueDate, yearStart)))
      .groupBy(sql`1`)
      .orderBy(sql`1`),
  ]);

  const shape = (t: { count: number; total: string | null; base: string | null; irpf: string | null }) => ({
    count: t.count,
    total: zero(t.total),
    base: zero(t.base),
    irpf: zero(t.irpf),
  });

  return {
    today,
    month: shape(month),
    year: shape(year),
    unpaid: shape(unpaid),
    overdue: shape(overdue),
    clientCount,
    recent,
    monthly: monthly.map((m) => ({ month: m.month, base: zero(m.base) })),
  };
}
