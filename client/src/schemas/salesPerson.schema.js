import { z } from "zod";

export const salesPersonFormSchema = z.object({
  code: z.string().min(1, "Code should not be null"),
  name: z.string().min(1, "Name should not be null"),
  start_work_date: z.string().min(1, "Start work date should not be null"),
});
