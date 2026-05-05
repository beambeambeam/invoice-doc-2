import React from "react";
import InvoicePickerModal from "./InvoicePickerModal.jsx";
import ReceiptLineItemRow from "./ReceiptLineItemRow.jsx";
import { formatBaht } from "../utils.js";

function emptyRow() {
  return {
    invoice_no: "",
    full_amount_due: 0,
    amount_already_received: 0,
    amount_remaining: 0,
    amount_received_here: 0,
  };
}

export default function ReceiptLineItemsEditor({
  value,
  onChange,
  customerCode,
  excludeReceiptNo = "",
}) {
  const [pickerOpen, setPickerOpen] = React.useState(false);
  const [pickerRowIndex, setPickerRowIndex] = React.useState(0);

  const items = value;

  const update = (index, patch) => {
    const next = items.map((item, i) => {
      if (i !== index) return item;
      const updated = { ...item, ...patch };
      const amountRemaining = Number(updated.amount_remaining || 0);
      const amountReceivedHere = Number(updated.amount_received_here || 0);
      updated.amount_received_here = Number.isNaN(amountReceivedHere) ? 0 : amountReceivedHere;
      updated.amount_still_remaining = amountRemaining - updated.amount_received_here;
      return updated;
    });
    onChange(next);
  };

  const addRow = () => onChange([...items, emptyRow()]);
  const removeRow = (index) => onChange(items.filter((_, i) => i !== index));

  const handlePickInvoice = (index) => {
    setPickerRowIndex(index);
    setPickerOpen(true);
  };

  const handleSelectInvoice = (row) => {
    const next = items.map((item, i) => i === pickerRowIndex ? {
      ...item,
      invoice_no: row.invoice_no,
      full_amount_due: Number(row.amount_due || 0),
      amount_already_received: Number(row.amount_received || 0),
      amount_remaining: Number(row.amount_remain || 0),
      amount_received_here: Number(row.amount_remain || 0),
      amount_still_remaining: 0,
    } : item);
    onChange(next);
    setPickerOpen(false);
  };

  const totalReceived = items.reduce((sum, item) => sum + Number(item.amount_received_here || 0), 0);

  return (
    <div className="card">
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
        <div>
          <h4 style={{ margin: 0 }}>Receipt Lines</h4>
          <span style={{ color: "var(--text-muted)", fontSize: "0.85rem" }}>
            Select unpaid invoices for the chosen customer.
          </span>
        </div>
        <button type="button" className="btn btn-primary" onClick={addRow}>
          Add Line
        </button>
      </div>

      <div className="table-container">
        <table className="modern-table">
          <thead>
            <tr>
              <th className="text-center" style={{ width: 60 }}>No</th>
              <th>Invoice No.</th>
              <th className="text-right">Full Amount Due</th>
              <th className="text-right">Amount Already Received</th>
              <th className="text-right">Amount Remaining</th>
              <th className="text-right">Amount Received Here</th>
              <th className="text-right">Amount Still Remaining</th>
              <th className="text-center">Action</th>
            </tr>
          </thead>
          <tbody>
            {items.map((item, index) => {
              const invoiceNo = String(item.invoice_no || "").trim();
              const duplicateCount = invoiceNo ? items.filter((row) => String(row.invoice_no || "").trim() === invoiceNo).length : 0;
              return (
                <ReceiptLineItemRow
                  key={index}
                  index={index}
                  item={item}
                  onChange={update}
                  onRemove={removeRow}
                  onPickInvoice={handlePickInvoice}
                  canPickInvoice={!!String(customerCode || "").trim()}
                  hasDuplicate={duplicateCount > 1}
                />
              );
            })}
            {items.length === 0 && (
              <tr>
                <td colSpan="8" className="text-center" style={{ padding: 32, color: "var(--text-muted)" }}>
                  No receipt lines yet.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      <div style={{ display: "flex", justifyContent: "flex-end", marginTop: 16 }}>
        <div style={{ minWidth: 240, padding: "12px 16px", background: "var(--bg-body)", borderRadius: "var(--radius-sm)" }}>
          <div className="flex justify-between">
            <span className="font-bold">Total Received</span>
            <span className="font-bold">{formatBaht(totalReceived)}</span>
          </div>
        </div>
      </div>

      <InvoicePickerModal
        isOpen={pickerOpen}
        onClose={() => setPickerOpen(false)}
        onSelect={handleSelectInvoice}
        customerCode={customerCode}
        excludeReceiptNo={excludeReceiptNo}
        initialSearch={items[pickerRowIndex]?.invoice_no || ""}
      />
    </div>
  );
}
