// Sales person CRUD: list (search, pagination) and get by code.
import { pool } from "../db/pool.js";

export async function listSalesPersons({
  search = "",
  page = 1,
  limit = 10,
} = {}) {
  const offset = (Number(page) - 1) * Number(limit);
  const searchParam = `%${search}%`;

  const countResult = await pool.query(
    `SELECT COUNT(*) as total FROM sales_person WHERE code ILIKE $1 OR name ILIKE $1`,
    [searchParam],
  );
  const total = Number(countResult.rows[0].total);

  const { rows } = await pool.query(
    `SELECT code, name, start_work_date
     FROM sales_person
     WHERE code ILIKE $1 OR name ILIKE $1
     ORDER BY code ASC
     LIMIT $2 OFFSET $3`,
    [searchParam, Number(limit), offset],
  );

  return {
    data: rows,
    total,
    page: Number(page),
    limit: Number(limit),
    totalPages: Math.ceil(total / Number(limit)),
  };
}

export async function getSalesPersonByCode(code) {
  if (!code || String(code).trim() === "") return null;
  const { rows } = await pool.query(
    `SELECT code, name, start_work_date
     FROM sales_person
     WHERE code = $1`,
    [String(code).trim()],
  );
  return rows[0] ?? null;
}

export async function createSalesPerson({
  code,
  name,
  start_work_date,
} = {}) {
  const resolvedCode = String(code || "").trim();
  if (!resolvedCode) throw new Error("Sales person code is required");

  await pool.query(
    `INSERT INTO sales_person (code, name, start_work_date)
     VALUES ($1, $2, $3)`,
    [resolvedCode, name, start_work_date || null],
  );

  return { code: resolvedCode };
}

export async function updateSalesPersonByCode(
  code,
  { name, start_work_date } = {},
) {
  const resolvedCode = String(code || "").trim();
  if (!resolvedCode) return null;

  const result = await pool.query(
    `UPDATE sales_person
     SET name = $1, start_work_date = $2
     WHERE code = $3`,
    [name, start_work_date || null, resolvedCode],
  );

  return result.rowCount > 0 ? { ok: true } : null;
}
