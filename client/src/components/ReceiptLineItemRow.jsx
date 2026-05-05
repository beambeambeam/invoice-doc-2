import React from "react";
import { formatBaht } from "../utils.js";

export default function ReceiptLineItemRow({
  index,
  item,
  onChange,
  onRemove,
  onPickInvoice,
  canPickInvoice,
  hasDuplicate,
}) {
  const remainingAfter = Number(item.amount_remaining || 0) - Number(item.amount_received_here || 0);

  return (
    <tr>
      <td className="text-center">{index + 1}</td>
      <td>
        <div style={{ display: "flex", gap: 6, alignItems: "stretch" }}>
          <input
            type="text"
            className="form-control"
            value={item.invoice_no || ""}
            readOnly
            placeholder={canPickInvoice ? "Select invoice" : "Select customer first"}
            style={{ flex: 1, background: "var(--bg-body)" }}
          />
          <button
            type="button"
            className="btn btn-primary"
            onClick={() => onPickInvoice(index)}
            disabled={!canPickInvoice}
            title={canPickInvoice ? "List of Values" : "Select customer first"}
          >
            LoV
          </button>
          {item.invoice_no && (
            <button
              type="button"
              onClick={() => onChange(index, {
                invoice_no: "",
                full_amount_due: 0,
                amount_already_received: 0,
                amount_remaining: 0,
                amount_received_here: 0,
              })}
              title="Clear"
              style={{
                padding: "0 8px",
                border: "1px solid var(--border)",
                borderRadius: "var(--radius-sm)",
                background: "var(--bg-body)",
                color: "var(--text-muted)",
                cursor: "pointer",
                fontSize: "1.1rem",
                lineHeight: 1,
              }}
            >
              ×
            </button>
          )}
        </div>
        {hasDuplicate && <span className="form-error">Invoice already selected in another row.</span>}
      </td>
      <td className="text-right">{formatBaht(item.full_amount_due || 0)}</td>
      <td className="text-right">{formatBaht(item.amount_already_received || 0)}</td>
      <td className="text-right">{formatBaht(item.amount_remaining || 0)}</td>
      <td>
        <input
          type="number"
          min="0"
          step="0.01"
          className="form-control"
          value={item.amount_received_here}
          onChange={(e) => onChange(index, { amount_received_here: e.target.value })}
          style={{ textAlign: "right" }}
        />
      </td>
      <td className="text-right" style={{ color: remainingAfter < 0 ? "#ef4444" : "inherit" }}>
        {formatBaht(remainingAfter)}
      </td>
      <td className="text-center">
        <button
          type="button"
          className="btn btn-danger"
          style={{ padding: "6px 12px" }}
          onClick={() => onRemove(index)}
        >
          Delete
        </button>
      </td>
    </tr>
  );
}
