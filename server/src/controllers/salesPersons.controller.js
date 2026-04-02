import {
  listSalesPersons,
  getSalesPersonByCode,
  createSalesPerson,
  updateSalesPersonByCode,
} from "../services/salesPersons.service.js";
import { sendList, sendOne, sendCreated, sendOk, sendError } from "../utils/response.js";
import logger from "../utils/logger.js";

export async function handleList(req, res) {
  try {
    const { search = "", page = 1, limit = 10 } = req.query;
    const result = await listSalesPersons({ search, page, limit });
    sendList(res, result);
  } catch (err) {
    logger.error("listSalesPersons failed", { error: err?.message ?? String(err) });
    sendError(res, err?.message ?? String(err), 500);
  }
}

export async function handleGet(req, res) {
  try {
    const code = decodeURIComponent(req.params.code || "");
    const row = await getSalesPersonByCode(code);
    if (!row) return sendError(res, "Sales person not found", 404);
    sendOne(res, row);
  } catch (err) {
    logger.error("getSalesPerson failed", { code: req.params.code, error: err?.message ?? String(err) });
    sendError(res, err?.message ?? String(err), 500);
  }
}

export async function handleCreate(req, res) {
  try {
    const result = await createSalesPerson(req.body);
    sendCreated(res, result);
  } catch (err) {
    logger.error("createSalesPerson failed", { error: err?.message ?? String(err) });
    sendError(res, err?.message ?? String(err), 400);
  }
}

export async function handleUpdate(req, res) {
  try {
    const code = decodeURIComponent(req.params.code || "");
    const existing = await getSalesPersonByCode(code);
    if (!existing) return sendError(res, "Sales person not found", 404);
    const result = await updateSalesPersonByCode(code, {
      name: req.body.name !== undefined ? req.body.name : existing.name,
      start_work_date: req.body.start_work_date !== undefined ? req.body.start_work_date : existing.start_work_date,
    });
    sendOk(res, result);
  } catch (err) {
    logger.error("updateSalesPerson failed", { code: req.params.code, error: err?.message ?? String(err) });
    sendError(res, err?.message ?? String(err), 400);
  }
}
