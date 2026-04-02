import { Router } from "express";
import { handleList, handleGet, handleCreate, handleUpdate } from "../controllers/salesPersons.controller.js";

const router = Router();
router.get("/", handleList);
router.post("/", handleCreate);
router.get("/:code", handleGet);
router.put("/:code", handleUpdate);

export default router;
