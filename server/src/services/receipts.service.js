import { pool } from "../db/pool.js";

const PAYMENT_METHODS = new Set(["cash", "bank transfer", "check"]);

function normalizePaymentMethod(value) {
  return String(value || "").trim().toLowerCase();
}

function receiptYearSuffix(receipt_date) {
  const raw = String(receipt_date || "").trim();
  if (/^\d{4}-\d{2}-\d{2}$/.test(raw)) return raw.slice(2, 4);
  const d = new Date(raw);
  if (Number.isNaN(d.getTime())) throw new Error("Invalid receipt date");
  return String(d.getFullYear()).slice(-2);
}

async function resolveReceiptId(receipt_no) {
  const result = await pool.query("SELECT id FROM receipt WHERE receipt_no = $1", [receipt_no]);
  return result.rowCount > 0 ? result.rows[0].id : null;
}

async function generateReceiptNo(client, receipt_date) {
  const yy = receiptYearSuffix(receipt_date);
  const prefix = `RCT${yy}-`;
  const result = await client.query(
    `
      SELECT COALESCE(MAX(CAST(RIGHT(receipt_no, 5) AS integer)), 0) AS max_running
      FROM receipt
      WHERE receipt_no LIKE $1
        AND receipt_no ~ '^RCT[0-9]{2}-[0-9]{5}$'
    `,
    [`${prefix}%`],
  );
  const next = Number(result.rows[0]?.max_running || 0) + 1;
  return `${prefix}${String(next).padStart(5, "0")}`;
}

async function getCustomerByCode(client, customer_code) {
  const code = String(customer_code || "").trim();
  const result = await client.query(
    `
      SELECT c.id, c.code, c.name, c.address_line1, c.address_line2, co.name AS country_name
      FROM customer c
      LEFT JOIN country co ON co.id = c.country_id
      WHERE c.code = $1
    `,
    [code],
  );
  if (result.rowCount === 0) throw new Error(`Customer not found: ${code}`);
  return result.rows[0];
}

async function getInvoiceFinancials(client, invoice_id, exclude_receipt_id = null) {
  const result = await client.query(
    `
      SELECT
        i.id AS invoice_id,
        i.invoice_no,
        i.invoice_date,
        i.customer_id,
        i.amount_due,
        COALESCE(SUM(
          CASE
            WHEN $2::bigint IS NOT NULL AND r.id = $2 THEN 0
            ELSE rli.amount_received
          END
        ), 0::numeric) AS amount_already_received
      FROM invoice i
      LEFT JOIN receipt_line_item rli ON rli.invoice_id = i.id
      LEFT JOIN receipt r ON r.id = rli.receipt_id
      WHERE i.id = $1
      GROUP BY i.id, i.invoice_no, i.invoice_date, i.customer_id, i.amount_due
    `,
    [invoice_id, exclude_receipt_id],
  );
  if (result.rowCount === 0) return null;
  const row = result.rows[0];
  const amount_due = Number(row.amount_due || 0);
  const amount_already_received = Number(row.amount_already_received || 0);
  return {
    ...row,
    amount_due,
    amount_already_received,
    amount_remaining: amount_due - amount_already_received,
  };
}

async function enrichLineItems(client, line_items, customer_id, exclude_receipt_id = null) {
  if (!Array.isArray(line_items) || line_items.length === 0) {
    throw new Error("At least one receipt line item is required.");
  }

  const seen = new Set();
  const enriched = [];

  for (const line of line_items) {
    const invoice_no = String(line.invoice_no || "").trim();
    if (!invoice_no) throw new Error("Line item missing invoice_no");
    if (seen.has(invoice_no)) throw new Error(`Duplicate invoice in receipt: ${invoice_no}`);
    seen.add(invoice_no);

    const lineAmount = Number(line.amount_received_here);
    if (Number.isNaN(lineAmount) || lineAmount < 0) {
      throw new Error(`Amount received cannot be negative for invoice ${invoice_no}`);
    }

    const invoiceResult = await client.query(
      "SELECT id, customer_id, invoice_date, amount_due FROM invoice WHERE invoice_no = $1",
      [invoice_no],
    );
    if (invoiceResult.rowCount === 0) throw new Error(`Invoice not found: ${invoice_no}`);

    const invoice = invoiceResult.rows[0];
    if (Number(invoice.customer_id) !== Number(customer_id)) {
      throw new Error(`Invoice ${invoice_no} does not belong to the selected customer.`);
    }

    const financials = await getInvoiceFinancials(client, invoice.id, exclude_receipt_id);
    if (!financials) throw new Error(`Invoice not found: ${invoice_no}`);
    if (financials.amount_remaining <= 0) {
      throw new Error(`Invoice ${invoice_no} is already fully paid.`);
    }
    if (lineAmount > financials.amount_remaining) {
      throw new Error(`Amount received for ${invoice_no} exceeds remaining balance.`);
    }

    enriched.push({
      id: line.id != null ? Number(line.id) : undefined,
      invoice_id: Number(invoice.id),
      invoice_no,
      invoice_date: invoice.invoice_date,
      full_amount_due: financials.amount_due,
      amount_already_received: financials.amount_already_received,
      amount_remaining: financials.amount_remaining,
      amount_received_here: lineAmount,
      amount_still_remaining: financials.amount_remaining - lineAmount,
    });
  }

  return enriched;
}

function validatePaymentMethod(payment_method) {
  const normalized = normalizePaymentMethod(payment_method);
  if (!PAYMENT_METHODS.has(normalized)) {
    throw new Error("Payment method must be one of cash, bank transfer, check.");
  }
  return normalized;
}

export async function listReceipts({
  search = "",
  page = 1,
  limit = 10,
  sortBy = "receipt_date",
  sortDir = "desc",
} = {}) {
  const offset = (Number(page) - 1) * Number(limit);
  const allowedSort = ["receipt_no", "receipt_date", "customer_code", "customer_name", "payment_method", "total_received"];
  const sortColumnMap = {
    receipt_no: "r.receipt_no",
    receipt_date: "r.receipt_date",
    customer_code: "c.code",
    customer_name: "c.name",
    payment_method: "r.payment_method",
    total_received: "r.total_received",
  };
  const sortColumn = sortColumnMap[allowedSort.includes(sortBy) ? sortBy : "receipt_date"];
  const sortDirection = sortDir === "asc" ? "ASC" : "DESC";
  const searchParam = `%${search}%`;

  const countResult = await pool.query(
    `
      SELECT COUNT(*) AS total
      FROM receipt r
      JOIN customer c ON c.id = r.customer_id
      WHERE r.receipt_no ILIKE $1
         OR c.code ILIKE $1
         OR c.name ILIKE $1
         OR r.payment_method ILIKE $1
         OR COALESCE(r.payment_notes, '') ILIKE $1
    `,
    [searchParam],
  );

  const { rows } = await pool.query(
    `
      SELECT
        r.receipt_no,
        r.receipt_date,
        c.code AS customer_code,
        c.name AS customer_name,
        r.payment_method,
        r.total_received
      FROM receipt r
      JOIN customer c ON c.id = r.customer_id
      WHERE r.receipt_no ILIKE $1
         OR c.code ILIKE $1
         OR c.name ILIKE $1
         OR r.payment_method ILIKE $1
         OR COALESCE(r.payment_notes, '') ILIKE $1
      ORDER BY ${sortColumn} ${sortDirection} NULLS LAST, r.id DESC
      LIMIT $2 OFFSET $3
    `,
    [searchParam, Number(limit), offset],
  );

  const total = Number(countResult.rows[0].total);
  return {
    data: rows,
    total,
    page: Number(page),
    limit: Number(limit),
    totalPages: Math.ceil(total / Number(limit)),
  };
}

export async function getReceipt(receiptNo) {
  const receipt_id = await resolveReceiptId(String(receiptNo || "").trim());
  if (receipt_id == null) return null;

  const headerResult = await pool.query(
    `
      SELECT
        r.id,
        r.receipt_no,
        r.receipt_date,
        r.payment_method,
        r.payment_notes,
        r.total_received,
        c.code AS customer_code,
        c.name AS customer_name,
        c.address_line1,
        c.address_line2,
        co.name AS country_name
      FROM receipt r
      JOIN customer c ON c.id = r.customer_id
      LEFT JOIN country co ON co.id = c.country_id
      WHERE r.id = $1
    `,
    [receipt_id],
  );
  if (headerResult.rowCount === 0) return null;

  const linesResult = await pool.query(
    `
      SELECT
        rli.id,
        i.id AS invoice_id,
        i.invoice_no,
        i.amount_due AS full_amount_due,
        i.invoice_date,
        rli.amount_received AS amount_received_here
      FROM receipt_line_item rli
      JOIN invoice i ON i.id = rli.invoice_id
      WHERE rli.receipt_id = $1
      ORDER BY rli.id
    `,
    [receipt_id],
  );

  const lines = [];
  for (const row of linesResult.rows) {
    const financials = await getInvoiceFinancials(pool, row.invoice_id, receipt_id);
    const full_amount_due = Number(row.full_amount_due || 0);
    const amount_already_received = Number(financials?.amount_already_received || 0);
    const amount_remaining = full_amount_due - amount_already_received;
    const amount_received_here = Number(row.amount_received_here || 0);
    lines.push({
      id: row.id,
      invoice_no: row.invoice_no,
      full_amount_due,
      amount_already_received,
      amount_remaining,
      amount_received_here,
      amount_still_remaining: amount_remaining - amount_received_here,
    });
  }

  const { id, ...header } = headerResult.rows[0];
  return { header, line_items: lines };
}

export async function createReceipt({ receipt_no, receipt_date, customer_code, payment_method, payment_notes, line_items }) {
  const client = await pool.connect();
  try {
    await client.query("begin");
    const customer = await getCustomerByCode(client, customer_code);
    const normalizedPaymentMethod = validatePaymentMethod(payment_method);
    const enriched = await enrichLineItems(client, line_items, customer.id, null);
    const total_received = enriched.reduce((sum, line) => sum + Number(line.amount_received_here || 0), 0);

    const resolvedReceiptNo = String(receipt_no || "").trim() || await generateReceiptNo(client, receipt_date);

    const receiptResult = await client.query(
      `
        INSERT INTO receipt (id, created_at, receipt_no, receipt_date, customer_id, payment_method, payment_notes, total_received)
        VALUES (
          (SELECT COALESCE(MAX(id), 0) + 1 FROM receipt),
          now(),
          $1, $2, $3, $4, $5, $6
        )
        RETURNING id, receipt_no
      `,
      [resolvedReceiptNo, receipt_date, customer.id, normalizedPaymentMethod, payment_notes ?? null, total_received],
    );

    const createdReceiptId = receiptResult.rows[0].id;
    for (const line of enriched) {
      await client.query(
        `
          INSERT INTO receipt_line_item (id, created_at, receipt_id, invoice_id, amount_received)
          VALUES (
            (SELECT COALESCE(MAX(id), 0) + 1 FROM receipt_line_item),
            now(),
            $1, $2, $3
          )
        `,
        [createdReceiptId, line.invoice_id, line.amount_received_here],
      );
    }

    await client.query("commit");
    return { receipt_no: receiptResult.rows[0].receipt_no };
  } catch (err) {
    await client.query("rollback");
    throw err;
  } finally {
    client.release();
  }
}

export async function updateReceipt(receiptNo, { receipt_no, receipt_date, customer_code, payment_method, payment_notes, line_items }) {
  const receipt_id = await resolveReceiptId(String(receiptNo || "").trim());
  if (receipt_id == null) return null;

  const client = await pool.connect();
  try {
    await client.query("begin");

    const customer = await getCustomerByCode(client, customer_code);
    const normalizedPaymentMethod = validatePaymentMethod(payment_method);
    const enriched = await enrichLineItems(client, line_items, customer.id, receipt_id);
    const total_received = enriched.reduce((sum, line) => sum + Number(line.amount_received_here || 0), 0);

    const resolvedReceiptNo = String(receipt_no || "").trim() || String(receiptNo || "").trim() || await generateReceiptNo(client, receipt_date);

    await client.query(
      `
        UPDATE receipt
        SET receipt_no = $1,
            receipt_date = $2,
            customer_id = $3,
            payment_method = $4,
            payment_notes = $5,
            total_received = $6
        WHERE id = $7
      `,
      [resolvedReceiptNo, receipt_date, customer.id, normalizedPaymentMethod, payment_notes ?? null, total_received, receipt_id],
    );

    await client.query("DELETE FROM receipt_line_item WHERE receipt_id = $1", [receipt_id]);
    for (const line of enriched) {
      await client.query(
        `
          INSERT INTO receipt_line_item (id, created_at, receipt_id, invoice_id, amount_received)
          VALUES (
            (SELECT COALESCE(MAX(id), 0) + 1 FROM receipt_line_item),
            now(),
            $1, $2, $3
          )
        `,
        [receipt_id, line.invoice_id, line.amount_received_here],
      );
    }

    await client.query("commit");
    return { receipt_no: resolvedReceiptNo };
  } catch (err) {
    await client.query("rollback");
    throw err;
  } finally {
    client.release();
  }
}

export async function deleteReceipt(receiptNo) {
  const receipt_id = await resolveReceiptId(String(receiptNo || "").trim());
  if (receipt_id == null) return null;
  await pool.query("DELETE FROM receipt WHERE id = $1", [receipt_id]);
  return { ok: true };
}

export async function listReceiptInvoices({
  customer_code,
  search = "",
  page = 1,
  limit = 10,
  sortBy = "invoice_date",
  sortDir = "desc",
  exclude_receipt_no,
} = {}) {
  const code = String(customer_code || "").trim();
  if (!code) {
    return { data: [], total: 0, page: Number(page), limit: Number(limit), totalPages: 0 };
  }

  const customerResult = await pool.query("SELECT id FROM customer WHERE code = $1", [code]);
  if (customerResult.rowCount === 0) {
    return { data: [], total: 0, page: Number(page), limit: Number(limit), totalPages: 0 };
  }

  const customer_id = Number(customerResult.rows[0].id);
  const exclude_receipt_id = exclude_receipt_no ? await resolveReceiptId(String(exclude_receipt_no).trim()) : null;
  const offset = (Number(page) - 1) * Number(limit);
  const searchParam = `%${search}%`;
  const allowedSort = {
    invoice_no: "i.invoice_no",
    invoice_date: "i.invoice_date",
    amount_due: "i.amount_due",
    amount_received: "amount_received",
    amount_remain: "amount_remain",
  };
  const sortColumn = allowedSort[sortBy] || allowedSort.invoice_date;
  const sortDirection = sortDir === "asc" ? "ASC" : "DESC";

  const baseParams = [customer_id, exclude_receipt_id, searchParam];
  const dataParams = [...baseParams, Number(limit), offset];
  const countResult = await pool.query(
    `
      WITH invoice_status AS (
        SELECT
          i.id AS invoice_id,
          i.invoice_no,
          i.invoice_date,
          i.amount_due,
          COALESCE(SUM(
            CASE
              WHEN $2::bigint IS NOT NULL AND r.id = $2 THEN 0
              ELSE rli.amount_received
            END
          ), 0::numeric) AS amount_received
        FROM invoice i
        LEFT JOIN receipt_line_item rli ON rli.invoice_id = i.id
        LEFT JOIN receipt r ON r.id = rli.receipt_id
        WHERE i.customer_id = $1
        GROUP BY i.id, i.invoice_no, i.invoice_date, i.amount_due
      )
      SELECT COUNT(*) AS total
      FROM invoice_status
      WHERE invoice_no ILIKE $3
        AND (amount_due - amount_received) > 0
    `,
    baseParams,
  );

  const { rows } = await pool.query(
    `
      WITH invoice_status AS (
        SELECT
          i.id AS invoice_id,
          i.invoice_no,
          i.invoice_date,
          i.amount_due,
          COALESCE(SUM(
            CASE
              WHEN $2::bigint IS NOT NULL AND r.id = $2 THEN 0
              ELSE rli.amount_received
            END
          ), 0::numeric) AS amount_received
        FROM invoice i
        LEFT JOIN receipt_line_item rli ON rli.invoice_id = i.id
        LEFT JOIN receipt r ON r.id = rli.receipt_id
        WHERE i.customer_id = $1
        GROUP BY i.id, i.invoice_no, i.invoice_date, i.amount_due
      )
      SELECT
        invoice_no,
        invoice_date,
        amount_due,
        amount_received,
        amount_due - amount_received AS amount_remain
      FROM invoice_status i
      WHERE invoice_no ILIKE $3
        AND (amount_due - amount_received) > 0
      ORDER BY ${sortColumn} ${sortDirection} NULLS LAST, invoice_id DESC
      LIMIT $4 OFFSET $5
    `,
    dataParams,
  );

  const total = Number(countResult.rows[0].total);
  return {
    data: rows.map((row) => ({
      ...row,
      amount_due: Number(row.amount_due || 0),
      amount_received: Number(row.amount_received || 0),
      amount_remain: Number(row.amount_remain || 0),
    })),
    total,
    page: Number(page),
    limit: Number(limit),
    totalPages: Math.ceil(total / Number(limit)),
  };
}
