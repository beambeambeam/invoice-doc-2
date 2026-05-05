import React from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { toast } from "react-toastify";
import ReceiptForm from "../../components/ReceiptForm.jsx";
import Loading from "../../components/Loading.jsx";
import { createReceipt, getReceipt, updateReceipt } from "../../api/receipts.api.js";
import { formatBaht, formatDate } from "../../utils.js";

export default function ReceiptPage({ mode: propMode }) {
  const { id } = useParams();
  const mode = propMode || (id ? "view" : "create");
  const nav = useNavigate();

  const [receiptData, setReceiptData] = React.useState(null);
  const [initialData, setInitialData] = React.useState(null);
  const [err, setErr] = React.useState("");
  const [submitting, setSubmitting] = React.useState(false);
  const [loading, setLoading] = React.useState(mode !== "create");

  React.useEffect(() => {
    if (mode === "create") {
      setLoading(false);
      return;
    }
    getReceipt(id)
      .then((data) => {
        setReceiptData(data);
        setInitialData({ ...data.header, line_items: data.line_items || [] });
        setLoading(false);
      })
      .catch((e) => {
        setErr(String(e.message || e));
        setLoading(false);
      });
  }, [id, mode]);

  const onSubmit = async (payload) => {
    setErr("");
    setSubmitting(true);
    try {
      if (mode === "create") {
        const result = await createReceipt(payload);
        toast.success("Receipt created.");
        nav(`/receipts/${encodeURIComponent(result.receipt_no)}`);
      } else {
        const result = await updateReceipt(id, payload);
        toast.success("Receipt updated.");
        nav(`/receipts/${encodeURIComponent(result.receipt_no || id)}`);
      }
    } catch (e) {
      const msg = String(e.message || e);
      setErr(msg);
      toast.error(msg);
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) return <Loading size="large" />;

  if (mode === "view" && receiptData) {
    const h = receiptData.header;
    const lines = receiptData.line_items || [];
    return (
      <div className="invoice-preview">
        <div className="page-header no-print">
          <h3 className="page-title">Receipt {h.receipt_no}</h3>
          <div className="flex gap-4">
            <Link to="/receipts" className="btn btn-outline">← Back</Link>
            <Link to={`/receipts/${id}/edit`} className="btn btn-outline">Edit</Link>
            <button className="btn btn-primary" onClick={() => window.print()}>Print PDF</button>
          </div>
        </div>

        <div className="card">
          <div className="flex justify-between mb-4">
            <div>
              <div className="brand mb-4">InvoiceDoc v2</div>
              <div className="font-bold">Customer</div>
              <div>{h.customer_name}</div>
              <div className="text-muted">{h.address_line1 || "-"}</div>
              <div className="text-muted">{h.address_line2 || ""}</div>
              <div className="text-muted">{h.country_name || "-"}</div>
            </div>
            <div className="text-right">
              <h2 className="mb-4">RECEIPT</h2>
              <div><span className="font-bold">Date:</span> {formatDate(h.receipt_date)}</div>
              <div><span className="font-bold">Receipt No:</span> {h.receipt_no}</div>
              <div><span className="font-bold">Payment Method:</span> {h.payment_method}</div>
            </div>
          </div>

          {h.payment_notes && (
            <div style={{ marginBottom: 16 }}>
              <span className="font-bold">Payment Notes:</span> {h.payment_notes}
            </div>
          )}

          <div className="table-container">
            <table className="modern-table">
              <thead>
                <tr>
                  <th>Invoice No.</th>
                  <th className="text-right">Full Amount Due</th>
                  <th className="text-right">Amount Received Here</th>
                  <th className="text-right">Amount Still Remaining</th>
                </tr>
              </thead>
              <tbody>
                {lines.map((line) => (
                  <tr key={line.id}>
                    <td>{line.invoice_no}</td>
                    <td className="text-right">{formatBaht(line.full_amount_due)}</td>
                    <td className="text-right">{formatBaht(line.amount_received_here)}</td>
                    <td className="text-right">{formatBaht(line.amount_still_remaining)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="mt-4 flex justify-between">
            <div className="text-muted" style={{ maxWidth: 320, fontSize: "0.85rem" }}>
              Receipt line balances exclude this receipt from the “already received” figure so edits keep the prior paid amount visible.
            </div>
            <div style={{ minWidth: 220 }}>
              <div className="flex justify-between mt-4 p-2 bg-body font-bold" style={{ fontSize: "1.1rem" }}>
                <span>Total Received:</span>
                <span>{formatBaht(h.total_received)}</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="invoice-page">
      <div className="page-header">
        <h3 className="page-title">{mode === "create" ? "Create Receipt" : `Edit Receipt ${id}`}</h3>
        <Link to="/receipts" className="btn btn-outline">Back</Link>
      </div>
      {err && <div className="alert alert-error">{err}</div>}
      <ReceiptForm
        onSubmit={onSubmit}
        submitting={submitting}
        initialData={mode === "create" ? null : initialData}
      />
    </div>
  );
}
