import React from "react";
import { formatBaht, formatDate } from "../utils.js";
import { listReceiptInvoices } from "../api/receipts.api.js";
import ListPickerModal from "./ListPickerModal.jsx";

const COLUMNS = [
  { key: "invoice_no", label: "Invoice No" },
  { key: "invoice_date", label: "Date", render: (v) => formatDate(v) },
  { key: "amount_due", label: "Amount Due", align: "right", render: (v) => formatBaht(v) },
  { key: "amount_received", label: "Received", align: "right", render: (v) => formatBaht(v) },
  { key: "amount_remain", label: "Remaining", align: "right", render: (v) => formatBaht(v) },
];

export default function InvoicePickerModal({
  isOpen,
  onClose,
  onSelect,
  customerCode,
  excludeReceiptNo = "",
  initialSearch = "",
}) {
  const fetchData = React.useCallback(
    (params) => listReceiptInvoices({
      ...params,
      customer_code: customerCode,
      exclude_receipt_no: excludeReceiptNo || undefined,
    }),
    [customerCode, excludeReceiptNo],
  );

  const handleSelect = React.useCallback((row) => onSelect(row), [onSelect]);

  return (
    <ListPickerModal
      isOpen={isOpen}
      onClose={onClose}
      onSelect={handleSelect}
      initialSearch={initialSearch}
      title="Select Invoice"
      searchPlaceholder="Search invoice no..."
      fetchData={fetchData}
      columns={COLUMNS}
      itemName="invoice"
      emptySearch="No unpaid invoices found."
      emptyDefault={customerCode ? "No unpaid invoices for this customer." : "Select a customer first."}
      getSelectLabel={(row) => row.invoice_no}
    />
  );
}
