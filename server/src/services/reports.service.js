// Report queries: sales by product, monthly sales, customer buying. All filters via parameterized queries.
import { pool } from "../db/pool.js";

export async function getInvoicesMonthlySummary({ limit = 20 } = {}) {
  const safeLimit = Math.min(Math.max(1, Number(limit) || 20), 500);
  const { rows } = await pool.query(
    `select i.invoice_no, i.invoice_date, c.name as customer_name, i.amount_due
     from invoice i
     join customer c on c.id = i.customer_id
     order by i.invoice_date desc
     limit $1`,
    [safeLimit]
  );
  return { data: rows };
}

export async function getSalesByProductSummary({
  product_id,
  product_code,
  date_from,
  date_to,
  page = 1,
  limit = 10,
  sortBy = "value_sold",
  sortDir = "desc",
} = {}) {
  const offset = (Number(page) - 1) * Number(limit);
  let resolvedProductId = product_id;
  if (!resolvedProductId && product_code) {
    const r = await pool.query("SELECT id FROM product WHERE code = $1", [String(product_code).trim()]);
    if (r.rowCount > 0) resolvedProductId = r.rows[0].id;
  }

  let whereClause = "WHERE 1=1";
  const params = [];
  let paramIndex = 1;

  if (resolvedProductId) {
    whereClause += ` AND p.id = $${paramIndex++}`;
    params.push(resolvedProductId);
  }
  if (date_from) {
    whereClause += ` AND i.invoice_date >= $${paramIndex++}`;
    params.push(date_from);
  }
  if (date_to) {
    whereClause += ` AND i.invoice_date <= $${paramIndex++}`;
    params.push(date_to);
  }

  const allowedSort = {
    product_code: "p.code",
    product_name: "p.name",
    quantity_sold: "SUM(li.quantity)",
    value_sold: "SUM(li.extended_price)",
  };
  const sortColumn = allowedSort[sortBy] || allowedSort.value_sold;
  const sortDirection = sortDir === "asc" ? "ASC" : "DESC";

  const countResult = await pool.query(
    `
      SELECT COUNT(DISTINCT p.id) as total
      FROM invoice_line_item li
      JOIN product p ON p.id = li.product_id
      JOIN invoice i ON i.id = li.invoice_id
      ${whereClause}
    `,
    params,
  );
  const total = Number(countResult.rows[0].total);

  const { rows } = await pool.query(
    `
      SELECT p.code as product_code, p.name as product_name,
             SUM(li.quantity) as quantity_sold,
             SUM(li.extended_price) as value_sold
      FROM invoice_line_item li
      JOIN product p ON p.id = li.product_id
      JOIN invoice i ON i.id = li.invoice_id
      ${whereClause}
      GROUP BY p.id, p.code, p.name
      ORDER BY ${sortColumn} ${sortDirection}
      LIMIT $${paramIndex++} OFFSET $${paramIndex++}
    `,
    [...params, Number(limit), offset],
  );

  return {
    data: rows,
    total,
    page: Number(page),
    limit: Number(limit),
    totalPages: Math.ceil(total / Number(limit)),
  };
}

export async function getSalesByCustomerSummary({
  product_id,
  product_code,
  customer_id,
  customer_code,
  date_from,
  date_to,
  page = 1,
  limit = 10,
  sortBy = "product_code",
  sortDir = "asc",
} = {}) {
  const offset = (Number(page) - 1) * Number(limit);
  let resolvedProductId = product_id;
  if (!resolvedProductId && product_code) {
    const r = await pool.query("SELECT id FROM product WHERE code = $1", [String(product_code).trim()]);
    if (r.rowCount > 0) resolvedProductId = r.rows[0].id;
  }
  let resolvedCustomerId = customer_id;
  if (!resolvedCustomerId && customer_code) {
    const r = await pool.query("SELECT id FROM customer WHERE code = $1", [String(customer_code).trim()]);
    if (r.rowCount > 0) resolvedCustomerId = r.rows[0].id;
  }

  let whereClause = "WHERE 1=1";
  const params = [];
  let paramIndex = 1;

  if (resolvedProductId) {
    whereClause += ` AND p.id = $${paramIndex++}`;
    params.push(resolvedProductId);
  }
  if (resolvedCustomerId) {
    whereClause += ` AND c.id = $${paramIndex++}`;
    params.push(resolvedCustomerId);
  }
  if (date_from) {
    whereClause += ` AND i.invoice_date >= $${paramIndex++}`;
    params.push(date_from);
  }
  if (date_to) {
    whereClause += ` AND i.invoice_date <= $${paramIndex++}`;
    params.push(date_to);
  }

  const allowedSort = {
    product_code: "p.code",
    product_name: "p.name",
    customer_code: "c.code",
    customer_name: "c.name",
    quantity_sold: "SUM(li.quantity)",
    value_sold: "SUM(li.extended_price)",
  };
  const sortColumn = allowedSort[sortBy] || allowedSort.product_code;
  const sortDirection = sortDir === "asc" ? "ASC" : "DESC";

  const countResult = await pool.query(
    `
      SELECT COUNT(*) as total FROM (
        SELECT 1 FROM invoice i
        JOIN customer c ON c.id = i.customer_id
        JOIN invoice_line_item li ON li.invoice_id = i.id
        JOIN product p ON p.id = li.product_id
        ${whereClause}
        GROUP BY p.id, c.id
      ) sub
    `,
    params,
  );
  const total = Number(countResult.rows[0].total);

  const { rows } = await pool.query(
    `
      SELECT p.code as product_code, p.name as product_name,
             c.code as customer_code, c.name as customer_name,
             SUM(li.quantity) as quantity_sold,
             SUM(li.extended_price) as value_sold
      FROM invoice i
      JOIN customer c ON c.id = i.customer_id
      JOIN invoice_line_item li ON li.invoice_id = i.id
      JOIN product p ON p.id = li.product_id
      ${whereClause}
      GROUP BY p.id, p.code, p.name, c.id, c.code, c.name
      ORDER BY ${sortColumn} ${sortDirection}
      LIMIT $${paramIndex++} OFFSET $${paramIndex++}
    `,
    [...params, Number(limit), offset],
  );

  return {
    data: rows,
    total,
    page: Number(page),
    limit: Number(limit),
    totalPages: Math.ceil(total / Number(limit)),
  };
}

export async function getSalesByProductMonthlySummary({
  product_id,
  product_code,
  year,
  month,
  date_from,
  date_to,
  page = 1,
  limit = 10,
  sortBy = "year",
  sortDir = "desc",
} = {}) {
  const offset = (Number(page) - 1) * Number(limit);
  let resolvedProductId = product_id;
  if (!resolvedProductId && product_code) {
    const r = await pool.query("SELECT id FROM product WHERE code = $1", [String(product_code).trim()]);
    if (r.rowCount > 0) resolvedProductId = r.rows[0].id;
  }

  let whereClause = "WHERE 1=1";
  const params = [];
  let paramIndex = 1;

  if (resolvedProductId) {
    whereClause += ` AND p.id = $${paramIndex++}`;
    params.push(resolvedProductId);
  }
  if (year) {
    whereClause += ` AND EXTRACT(year FROM i.invoice_date) = $${paramIndex++}`;
    params.push(year);
  }
  if (month) {
    whereClause += ` AND EXTRACT(month FROM i.invoice_date) = $${paramIndex++}`;
    params.push(month);
  }
  if (date_from) {
    whereClause += ` AND i.invoice_date >= $${paramIndex++}`;
    params.push(date_from);
  }
  if (date_to) {
    whereClause += ` AND i.invoice_date <= $${paramIndex++}`;
    params.push(date_to);
  }

  const allowedSort = {
    year: "year",
    month: "month",
    product_code: "p.code",
    product_name: "p.name",
    quantity_sold: "SUM(li.quantity)",
    value_sold: "SUM(li.extended_price)",
  };
  const sortColumn = allowedSort[sortBy] || allowedSort.year;
  const sortDirection = sortDir === "asc" ? "ASC" : "DESC";

  const countResult = await pool.query(
    `
      SELECT COUNT(*) as total FROM (
        SELECT 1 FROM invoice_line_item li
        JOIN invoice i ON i.id = li.invoice_id
        JOIN product p ON p.id = li.product_id
        ${whereClause}
        GROUP BY EXTRACT(year FROM i.invoice_date), EXTRACT(month FROM i.invoice_date), p.id
      ) sub
    `,
    params,
  );
  const total = Number(countResult.rows[0].total);

  const yearMonthSecondaryOrder =
    sortBy === "year" && sortDir === "desc"
      ? ", month DESC"
      : sortBy === "year"
        ? ", month ASC"
        : sortBy === "month" && sortDir === "desc"
          ? ", year DESC"
          : sortBy === "month"
            ? ", year ASC"
            : "";
  const extraFallbackOrder = !["year", "month"].includes(sortBy) ? ", year DESC, month DESC" : "";

  const { rows } = await pool.query(
    `
      SELECT
        EXTRACT(year FROM i.invoice_date) as year,
        EXTRACT(month FROM i.invoice_date) as month,
        p.code as product_code,
        p.name as product_name,
        SUM(li.quantity) as quantity_sold,
        SUM(li.extended_price) as value_sold
      FROM invoice_line_item li
      JOIN invoice i ON i.id = li.invoice_id
      JOIN product p ON p.id = li.product_id
      ${whereClause}
      GROUP BY year, month, p.id, p.code, p.name
      ORDER BY ${sortColumn} ${sortDirection}${yearMonthSecondaryOrder}${extraFallbackOrder}
      LIMIT $${paramIndex++} OFFSET $${paramIndex++}
    `,
    [...params, Number(limit), offset],
  );

  return {
    data: rows,
    total,
    page: Number(page),
    limit: Number(limit),
    totalPages: Math.ceil(total / Number(limit)),
  };
}

export async function getReceiptsReport({
  customer_code,
  date_from,
  date_to,
  page = 1,
  limit = 10,
  sortBy = "receipt_date",
  sortDir = "desc",
} = {}) {
  const offset = (Number(page) - 1) * Number(limit);
  const allowedSort = {
    receipt_no: "r.receipt_no",
    receipt_date: "r.receipt_date",
    customer_code: "c.code",
    customer_name: "c.name",
    payment_method: "r.payment_method",
    payment_notes: "r.payment_notes",
    total_received: "r.total_received",
  };
  const sortColumn = allowedSort[sortBy] || allowedSort.receipt_date;
  const sortDirection = sortDir === "asc" ? "ASC" : "DESC";

  let whereClause = "WHERE 1=1";
  const params = [];
  let paramIndex = 1;

  if (customer_code) {
    whereClause += ` AND c.code = $${paramIndex++}`;
    params.push(String(customer_code).trim());
  }
  if (date_from) {
    whereClause += ` AND r.receipt_date >= $${paramIndex++}`;
    params.push(date_from);
  }
  if (date_to) {
    whereClause += ` AND r.receipt_date <= $${paramIndex++}`;
    params.push(date_to);
  }

  const countResult = await pool.query(
    `
      SELECT COUNT(*) AS total
      FROM receipt r
      JOIN customer c ON c.id = r.customer_id
      ${whereClause}
    `,
    params,
  );

  const { rows } = await pool.query(
    `
      SELECT
        r.receipt_no,
        r.receipt_date,
        c.code AS customer_code,
        c.name AS customer_name,
        r.payment_method,
        r.payment_notes,
        r.total_received
      FROM receipt r
      JOIN customer c ON c.id = r.customer_id
      ${whereClause}
      ORDER BY ${sortColumn} ${sortDirection}, r.id DESC
      LIMIT $${paramIndex++} OFFSET $${paramIndex++}
    `,
    [...params, Number(limit), offset],
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

export async function getInvoiceReceiptsReport({
  customer_code,
  invoice_date_from,
  invoice_date_to,
  page = 1,
  limit = 10,
  sortBy = "invoice_date",
  sortDir = "desc",
} = {}) {
  const offset = (Number(page) - 1) * Number(limit);
  const allowedSort = {
    invoice_no: "i.invoice_no",
    invoice_date: "i.invoice_date",
    customer_code: "c.code",
    customer_name: "c.name",
    invoice_amount_due: "i.amount_due",
    invoice_amount_received: "ir.amount_received",
    invoice_amount_still_remaining: "ir.amount_remain",
    receipt_no: "r.receipt_no",
    receipt_date: "r.receipt_date",
    receipt_amount: "rli.amount_received",
  };
  const sortColumn = allowedSort[sortBy] || allowedSort.invoice_date;
  const sortDirection = sortDir === "asc" ? "ASC" : "DESC";

  let whereClause = "WHERE 1=1";
  const params = [];
  let paramIndex = 1;

  if (customer_code) {
    whereClause += ` AND c.code = $${paramIndex++}`;
    params.push(String(customer_code).trim());
  }
  if (invoice_date_from) {
    whereClause += ` AND i.invoice_date >= $${paramIndex++}`;
    params.push(invoice_date_from);
  }
  if (invoice_date_to) {
    whereClause += ` AND i.invoice_date <= $${paramIndex++}`;
    params.push(invoice_date_to);
  }

  const countResult = await pool.query(
    `
      SELECT COUNT(*) AS total
      FROM invoice i
      JOIN customer c ON c.id = i.customer_id
      LEFT JOIN invoice_received ir ON ir.invoice_id = i.id
      LEFT JOIN receipt_line_item rli ON rli.invoice_id = i.id
      LEFT JOIN receipt r ON r.id = rli.receipt_id
      ${whereClause}
    `,
    params,
  );

  const { rows } = await pool.query(
    `
      SELECT
        i.invoice_no,
        i.invoice_date,
        c.code AS customer_code,
        c.name AS customer_name,
        i.amount_due AS invoice_amount_due,
        COALESCE(ir.amount_received, 0::numeric) AS invoice_amount_received,
        COALESCE(ir.amount_remain, i.amount_due) AS invoice_amount_still_remaining,
        r.receipt_no,
        r.receipt_date,
        rli.amount_received AS receipt_amount
      FROM invoice i
      JOIN customer c ON c.id = i.customer_id
      LEFT JOIN invoice_received ir ON ir.invoice_id = i.id
      LEFT JOIN receipt_line_item rli ON rli.invoice_id = i.id
      LEFT JOIN receipt r ON r.id = rli.receipt_id
      ${whereClause}
      ORDER BY ${sortColumn} ${sortDirection} NULLS LAST, i.id DESC, r.id DESC NULLS LAST
      LIMIT $${paramIndex++} OFFSET $${paramIndex++}
    `,
    [...params, Number(limit), offset],
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
