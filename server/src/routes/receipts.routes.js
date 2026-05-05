import { Router } from "express";
import * as c from "../controllers/receipts.controller.js";

const r = Router();

r.get("/", c.listReceipts);
r.get("/invoice-lov", c.listReceiptInvoices);
r.get("/:receiptNo", c.getReceipt);
r.post("/", c.createReceipt);
r.put("/:receiptNo", c.updateReceipt);
r.delete("/:receiptNo", c.deleteReceipt);

export default r;
