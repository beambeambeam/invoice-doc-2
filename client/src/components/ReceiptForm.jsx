import React from "react";
import { AlertModal } from "./Modal.jsx";
import CustomerPickerModal from "./CustomerPickerModal.jsx";
import ReceiptLineItemsEditor from "./ReceiptLineItemsEditor.jsx";
import { getCustomer } from "../api/customers.api.js";
import { formatBaht } from "../utils.js";

function emptyRow() {
  return {
    invoice_no: "",
    full_amount_due: 0,
    amount_already_received: 0,
    amount_remaining: 0,
    amount_received_here: 0,
    amount_still_remaining: 0,
  };
}

export default function ReceiptForm({ onSubmit, submitting, initialData }) {
  const [receiptNo, setReceiptNo] = React.useState("");
  const [receiptDate, setReceiptDate] = React.useState(new Date().toISOString().slice(0, 10));
  const [customerCode, setCustomerCode] = React.useState("");
  const [customerDetails, setCustomerDetails] = React.useState(null);
  const [paymentMethod, setPaymentMethod] = React.useState("cash");
  const [paymentNotes, setPaymentNotes] = React.useState("");
  const [items, setItems] = React.useState([emptyRow()]);
  const [customerModalOpen, setCustomerModalOpen] = React.useState(false);
  const [customerLoadError, setCustomerLoadError] = React.useState("");
  const [autoCode, setAutoCode] = React.useState(true);
  const [alertModal, setAlertModal] = React.useState({ isOpen: false, title: "Validation Error", message: "" });
  const [confirmedCustomerCode, setConfirmedCustomerCode] = React.useState("");

  React.useEffect(() => {
    if (!initialData) return;
    setReceiptNo(initialData.receipt_no || "");
    setReceiptDate(initialData.receipt_date ? new Date(initialData.receipt_date).toISOString().slice(0, 10) : "");
    setCustomerCode(initialData.customer_code || "");
    setConfirmedCustomerCode(initialData.customer_code || "");
    setPaymentMethod(initialData.payment_method || "cash");
    setPaymentNotes(initialData.payment_notes || "");
    const mappedLines = (initialData.line_items || []).map((line) => ({
      id: line.id,
      invoice_no: line.invoice_no,
      full_amount_due: Number(line.full_amount_due || 0),
      amount_already_received: Number(line.amount_already_received || 0),
      amount_remaining: Number(line.amount_remaining || 0),
      amount_received_here: Number(line.amount_received_here || 0),
      amount_still_remaining: Number(line.amount_still_remaining || 0),
    }));
    setItems(mappedLines.length > 0 ? mappedLines : [emptyRow()]);
  }, [initialData]);

  React.useEffect(() => {
    const code = String(customerCode || "").trim();
    if (!code) {
      setCustomerDetails(null);
      setCustomerLoadError("");
      return;
    }
    let cancelled = false;
    getCustomer(code)
      .then((data) => {
        if (cancelled) return;
        setCustomerDetails(data);
        setCustomerLoadError("");
      })
      .catch(() => {
        if (cancelled) return;
        setCustomerDetails(null);
        setCustomerLoadError("Customer not found");
      });
    return () => { cancelled = true; };
  }, [customerCode]);

  const confirmCustomerSelection = (code, data) => {
    if (confirmedCustomerCode && confirmedCustomerCode !== code) {
      setItems([emptyRow()]);
    }
    setConfirmedCustomerCode(code);
    setCustomerCode(code);
    setCustomerDetails(data);
    setCustomerLoadError("");
  };

  const handleCustomerBlur = () => {
    const code = String(customerCode || "").trim();
    if (!code) {
      setCustomerDetails(null);
      setCustomerLoadError("");
      setConfirmedCustomerCode("");
      setItems([emptyRow()]);
      return;
    }
    getCustomer(code)
      .then((data) => confirmCustomerSelection(code, data))
      .catch(() => {
        setCustomerDetails(null);
        setCustomerLoadError("Customer not found");
      });
  };

  const totalReceived = items.reduce((sum, item) => sum + Number(item.amount_received_here || 0), 0);

  const validate = () => {
    const errors = [];
    if (!receiptDate) errors.push("Receipt date is required.");
    if (!String(customerCode || "").trim() || !customerDetails) errors.push("Customer must be selected.");
    if (!initialData && !autoCode && !String(receiptNo || "").trim()) errors.push("Receipt No is required when auto numbering is off.");
    if (!["cash", "bank transfer", "check"].includes(paymentMethod)) errors.push("Payment method is invalid.");

    const nonEmptyItems = items.filter((item) => String(item.invoice_no || "").trim());
    if (nonEmptyItems.length === 0) errors.push("At least one invoice line is required.");

    items.forEach((item, index) => {
      const rowNo = index + 1;
      const invoiceNo = String(item.invoice_no || "").trim();
      if (!invoiceNo) return;
      const amountReceived = Number(item.amount_received_here);
      const amountRemaining = Number(item.amount_remaining || 0);
      if (Number.isNaN(amountReceived) || amountReceived < 0) {
        errors.push(`Row ${rowNo}: Amount Received Here cannot be negative.`);
      }
      if (amountReceived > amountRemaining) {
        errors.push(`Row ${rowNo}: Amount Received Here cannot exceed Amount Remaining.`);
      }
      const duplicateCount = items.filter((row) => String(row.invoice_no || "").trim() === invoiceNo).length;
      if (duplicateCount > 1) errors.push(`Row ${rowNo}: Invoice ${invoiceNo} is duplicated.`);
    });
    return [...new Set(errors)];
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    const errors = validate();
    if (errors.length > 0) {
      setAlertModal({
        isOpen: true,
        title: "Save Failed.",
        message: (
          <ul style={{ margin: 0, paddingLeft: 20 }}>
            {errors.map((error, index) => <li key={index}>{error}</li>)}
          </ul>
        ),
      });
      return;
    }

    onSubmit({
      receipt_no: initialData ? receiptNo.trim() : (autoCode ? "" : receiptNo.trim()),
      receipt_date: receiptDate,
      customer_code: String(customerCode || "").trim(),
      payment_method: paymentMethod,
      payment_notes: paymentNotes,
      line_items: items
        .filter((item) => String(item.invoice_no || "").trim())
        .map((item) => ({
          ...(item.id != null ? { id: item.id } : {}),
          invoice_no: String(item.invoice_no || "").trim(),
          amount_received_here: Number(item.amount_received_here || 0),
        })),
    });
  };

  return (
    <>
      <AlertModal
        isOpen={alertModal.isOpen}
        onClose={() => setAlertModal((prev) => ({ ...prev, isOpen: false }))}
        title={alertModal.title}
        message={alertModal.message}
      />
      <form onSubmit={handleSubmit}>
        <div className="invoice-form-grid" style={{ display: "grid", gridTemplateColumns: "1fr 280px", gap: 16, marginBottom: 16 }}>
          <div className="card">
            <h4>Receipt Details</h4>
            <div style={{ display: "grid", gap: 12 }}>
              <div className="form-group">
                <label className="form-label">{(!initialData && autoCode) ? "Receipt No" : <>Receipt No <span className="required-marker">*</span></>}</label>
                <div className="flex gap-2">
                  <input
                    className="form-control"
                    value={receiptNo}
                    onChange={(e) => setReceiptNo(e.target.value)}
                    disabled={autoCode && !initialData}
                    placeholder="e.g. RCT26-10301"
                  />
                  {!initialData && (
                    <div className="form-inline-option">
                      <input type="checkbox" checked={autoCode} onChange={(e) => setAutoCode(e.target.checked)} id="receipt_auto" />
                      <label htmlFor="receipt_auto">Auto</label>
                    </div>
                  )}
                </div>
              </div>

              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
                <div className="form-group">
                  <label className="form-label">Date <span className="required-marker">*</span></label>
                  <input type="date" className="form-control" value={receiptDate} onChange={(e) => setReceiptDate(e.target.value)} />
                </div>
                <div className="form-group">
                  <label className="form-label">Payment Method <span className="required-marker">*</span></label>
                  <select className="form-control" value={paymentMethod} onChange={(e) => setPaymentMethod(e.target.value)}>
                    <option value="cash">cash</option>
                    <option value="bank transfer">bank transfer</option>
                    <option value="check">check</option>
                  </select>
                </div>
              </div>

              <div className="form-group">
                <label className="form-label">Customer Code <span className="required-marker">*</span></label>
                <div style={{ display: "flex", gap: 8, alignItems: "stretch" }}>
                  <input
                    className="form-control"
                    value={customerCode}
                    onChange={(e) => setCustomerCode(e.target.value)}
                    onBlur={handleCustomerBlur}
                    placeholder="e.g. C102"
                    style={{ flex: 1 }}
                  />
                  <button type="button" className="btn btn-primary" onClick={() => setCustomerModalOpen(true)}>
                    LoV
                  </button>
                  {customerCode && (
                    <button
                      type="button"
                      onClick={() => {
                        setCustomerCode("");
                        setConfirmedCustomerCode("");
                        setCustomerDetails(null);
                        setCustomerLoadError("");
                        setItems([emptyRow()]);
                      }}
                      title="Clear"
                      style={{
                        padding: "0 12px",
                        border: "1px solid var(--border)",
                        borderRadius: "var(--radius-sm)",
                        background: "var(--bg-body)",
                        color: "var(--text-muted)",
                        cursor: "pointer",
                        fontSize: "1.2rem",
                        lineHeight: 1,
                      }}
                    >
                      ×
                    </button>
                  )}
                </div>
                {customerLoadError && <span className="form-error">{customerLoadError}</span>}
              </div>

              <div className="form-group">
                <label className="form-label">Customer Name</label>
                <input className="form-control" value={customerDetails?.name ?? ""} readOnly disabled placeholder="—" />
              </div>

              <div className="form-group">
                <label className="form-label">Payment Notes</label>
                <textarea
                  className="form-control"
                  value={paymentNotes}
                  onChange={(e) => setPaymentNotes(e.target.value)}
                  rows={3}
                  placeholder="Payment notes"
                />
              </div>
            </div>
          </div>

          <div className="card">
            <h4>Summary</h4>
            <div style={{ display: "grid", gap: 12 }}>
              <div className="form-group">
                <label className="form-label">Total Received</label>
                <input className="form-control" value={formatBaht(totalReceived)} readOnly disabled />
              </div>
              <button type="submit" className="btn btn-primary" disabled={submitting}>
                {submitting ? "Saving..." : (initialData ? "Update Receipt" : "Create Receipt")}
              </button>
            </div>
          </div>
        </div>

        <ReceiptLineItemsEditor
          value={items}
          onChange={setItems}
          customerCode={confirmedCustomerCode || customerCode}
          excludeReceiptNo={initialData?.receipt_no || ""}
        />
      </form>

      <CustomerPickerModal
        isOpen={customerModalOpen}
        onClose={() => setCustomerModalOpen(false)}
        initialSearch={customerCode}
        onSelect={(code) => {
          getCustomer(code)
            .then((data) => confirmCustomerSelection(String(code), data))
            .catch(() => {
              setCustomerLoadError("Customer not found");
            });
          setCustomerModalOpen(false);
        }}
      />
    </>
  );
}
