import { z } from "zod";

export const CreateReceiptSchema = z.object({
  receipt_no: z.string().optional(),
  receipt_date: z.string().min(8, "Receipt date is required"),
  customer_code: z.string().min(1, "Customer code is required"),
  payment_method: z.enum(["cash", "bank transfer", "check"]),
  payment_notes: z.string().optional().nullable(),
  line_items: z.array(
    z.object({
      id: z.coerce.number().int().optional(),
      invoice_no: z.string().min(1, "Invoice no is required"),
      amount_received_here: z.coerce.number().min(0),
    }),
  ).min(1, "At least one line item is required"),
});
