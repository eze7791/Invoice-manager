import { eq } from "drizzle-orm";
import { describe, expect, it } from "vitest";
import { schema } from "../src/db";
import { createClient } from "../src/services/clients";
import { getDashboard } from "../src/services/dashboard";
import { createDraft, issueInvoice, markPaid, todayInSpain } from "../src/services/invoices";
import { clientSchema, invoiceDraftSchema } from "../src/validation";
import { createIssuer, db } from "./helpers";

describe("dashboard", () => {
  it("resume lo facturado, lo pendiente y lo vencido del emisor", async () => {
    const issuerId = await createIssuer("dash");
    await db
      .update(schema.issuers)
      .set({ firstName: "A", lastName: "B", nif: "12345678Z", street: "C", postalCode: "1", city: "D" })
      .where(eq(schema.issuers.id, issuerId));
    const clientId = (await createClient(db, issuerId, clientSchema.parse({ type: "empresa", companyName: "X SL" }))).id;
    const today = todayInSpain();
    const make = async (issueDate: string, dueDate: string | null, price: number) =>
      issueInvoice(
        db,
        issuerId,
        (await createDraft(db, issuerId, invoiceDraftSchema.parse({ clientId, issueDate, dueDate, irpfRate: 15, paymentMethod: "efectivo", lines: [{ description: "x", quantity: 1, unitPrice: price }] }))).id,
      );

    const paid = await make(today, null, 100); // 85 € cobrada
    await markPaid(db, issuerId, paid.id, { method: "efectivo", paidOn: null, note: null });
    await make(today, null, 200); // 170 € pendiente
    await make(`${Number(today.slice(0, 4)) - 1}-12-01`, "2000-01-01", 100); // año anterior, vencida
    await createDraft(db, issuerId, invoiceDraftSchema.parse({ clientId, irpfRate: 0, paymentMethod: "efectivo", lines: [] })); // borrador: no cuenta

    const d = await getDashboard(db, issuerId);
    expect(d.month).toEqual({ count: 2, total: "255.00", base: "300.00", irpf: "45.00" });
    expect(d.unpaid).toMatchObject({ count: 2, total: "255.00" });
    expect(d.overdue).toMatchObject({ count: 1, total: "85.00" });
    expect(d.clientCount).toBe(1);
    expect(d.recent).toHaveLength(4);
    expect(d.monthly).toEqual([{ month: today.slice(0, 7), base: "300.00" }]);
  });
});
