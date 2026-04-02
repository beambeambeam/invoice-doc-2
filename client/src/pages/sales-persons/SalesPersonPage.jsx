import React from "react";
import { useNavigate, Link, useParams } from "react-router-dom";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { toast } from "react-toastify";
import { getSalesPerson, createSalesPerson, updateSalesPerson } from "../../api/salesPersons.api.js";
import Loading from "../../components/Loading.jsx";
import { AlertModal } from "../../components/Modal.jsx";
import { salesPersonFormSchema } from "../../schemas/salesPerson.schema.js";

const defaultValues = {
  code: "",
  name: "",
  start_work_date: "",
};

export default function SalesPersonPage({ mode: propMode }) {
  const { id } = useParams();
  const mode = propMode || (id ? "view" : "create");
  const nav = useNavigate();

  const [err, setErr] = React.useState("");
  const [submitting, setSubmitting] = React.useState(false);
  const [loading, setLoading] = React.useState(mode !== "create");
  const [alertModal, setAlertModal] = React.useState({ isOpen: false, title: "Validation Error", message: "" });

  const {
    register,
    handleSubmit,
    formState: { errors },
    reset,
    watch,
  } = useForm({
    defaultValues,
    resolver: zodResolver(salesPersonFormSchema),
  });

  const form = watch();

  React.useEffect(() => {
    if (mode === "create") return;

    getSalesPerson(id)
      .then((salesPerson) => {
        if (!salesPerson) {
          setErr("Sales person not found");
          return;
        }

        reset({
          code: salesPerson.code || "",
          name: salesPerson.name || "",
          start_work_date: salesPerson.start_work_date ? String(salesPerson.start_work_date).slice(0, 10) : "",
        });
        setLoading(false);
      })
      .catch((e) => {
        setErr(String(e.message || e));
        setLoading(false);
      });
  }, [id, mode, reset]);

  const onInvalid = (validationErrors) => {
    const messages = Object.values(validationErrors).map((entry) => entry?.message).filter(Boolean);
    setAlertModal({
      isOpen: true,
      title: "Save Failed.",
      message: (
        <ul style={{ margin: 0, paddingLeft: 20, color: "var(--text-main)" }}>
          {messages.map((message, index) => (
            <li key={index} style={{ marginBottom: 4 }}>{message}</li>
          ))}
        </ul>
      ),
    });
  };

  const onValid = async (data) => {
    setErr("");
    setSubmitting(true);
    try {
      if (mode === "create") {
        await createSalesPerson(data);
        toast.success("Sales person created.");
      } else {
        await updateSalesPerson(id, { name: data.name, start_work_date: data.start_work_date });
        toast.success("Sales person updated.");
      }
      nav("/sales-persons");
    } catch (e) {
      const message = String(e.message || e);
      setErr(message);
      toast.error(message);
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) return <Loading size="large" />;

  const isView = mode === "view";
  const isCreate = mode === "create";
  const title = isCreate ? "Create Sales Person" : isView ? "Sales Person Details" : "Edit Sales Person";

  if (isView) {
    return (
      <div>
        <div className="page-header">
          <h3 className="page-title">{title}</h3>
          <div className="flex gap-4">
            <Link to="/sales-persons" className="btn btn-outline">← Back</Link>
            <Link to={`/sales-persons/${id}/edit`} className="btn btn-primary">Edit</Link>
          </div>
        </div>
        <div className="card">
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "2rem" }}>
            <div>
              <div style={{ fontSize: "0.8rem", color: "var(--text-muted)", marginBottom: 4 }}>Code</div>
              <div style={{ fontWeight: 600, fontSize: "1.1rem", marginBottom: "1rem" }}>{form.code}</div>
              <div style={{ fontSize: "0.8rem", color: "var(--text-muted)", marginBottom: 4 }}>Name</div>
              <div style={{ fontWeight: 600, fontSize: "1.1rem" }}>{form.name}</div>
            </div>
            <div>
              <div style={{ fontSize: "0.8rem", color: "var(--text-muted)", marginBottom: 4 }}>Start Work Date</div>
              <div style={{ fontWeight: 600, fontSize: "1.1rem" }}>{form.start_work_date || "-"}</div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div>
      <div className="page-header">
        <h3 className="page-title">{title}</h3>
        <Link to="/sales-persons" className="btn btn-outline">
          <svg style={{ marginRight: 8 }} width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="19" y1="12" x2="5" y2="12"></line><polyline points="12 19 5 12 12 5"></polyline></svg>
          Back
        </Link>
      </div>

      {err && <div className="alert alert-error">{err}</div>}

      <AlertModal
        isOpen={alertModal.isOpen}
        onClose={() => setAlertModal((prev) => ({ ...prev, isOpen: false }))}
        title={alertModal.title}
        message={alertModal.message}
      />

      <div className="card">
        <form onSubmit={handleSubmit(onValid, onInvalid)}>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 2fr", gap: "1rem", marginBottom: "1rem" }}>
            <div className="form-group">
              <label className="form-label">Code <span className="required-marker">*</span></label>
              <input className="form-control" placeholder="SP001" disabled={!isCreate} {...register("code")} />
              {errors.code && <span className="form-error">{errors.code.message}</span>}
            </div>
            <div className="form-group">
              <label className="form-label">Name <span className="required-marker">*</span></label>
              <input className="form-control" placeholder="Sales Person Name" {...register("name")} />
              {errors.name && <span className="form-error">{errors.name.message}</span>}
            </div>
          </div>

          <div className="form-group" style={{ marginBottom: "1rem", maxWidth: 280 }}>
            <label className="form-label">Start Work Date <span className="required-marker">*</span></label>
            <input type="date" className="form-control" {...register("start_work_date")} />
            {errors.start_work_date && <span className="form-error">{errors.start_work_date.message}</span>}
          </div>

          <div className="flex justify-between items-center" style={{ marginTop: "2rem", paddingTop: "1rem", borderTop: "1px solid var(--border)" }}>
            <p style={{ margin: 0, color: "var(--text-muted)", fontSize: "0.9rem" }}>
              Fill in the code, name, and start date before saving.
            </p>
            <button type="submit" className="btn btn-primary" disabled={submitting}>
              {submitting ? (isCreate ? "Creating..." : "Updating...") : (isCreate ? "Create Sales Person" : "Update Sales Person")}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
