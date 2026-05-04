# Demo — Two New Features: Notes on Line Items & Total Quantity

> Based on Lab 8
>
> **Feature 1:** Add a `notes` field to each line item across every layer — database → service → UI
>
> **Feature 2:** Add a read-only calculated "Total Quantity" textbox in the Summary card that shows total qty grouped by unit

> Each step tells you which file to edit, what the code looks like before, and what to add after (`____________` = fill in yourself)

---

## Overview

| # | Task | File |
|---|------|------|
| 1 | Database migration | `database/sql/demo_notes_field.sql` |
| 2 | Server: Invoice Service | `server/src/services/invoices.service.js` |
| 3 | Client: LineItemRow | `client/src/components/LineItemRow.jsx` |
| 4 | Client: LineItemsEditor | `client/src/components/LineItemsEditor.jsx` |
| 5 | Client: InvoiceForm | `client/src/components/InvoiceForm.jsx` |
| 6 | Client: InvoicePage | `client/src/pages/invoices/InvoicePage.jsx` |

---

## Step 1 — Database: Add Column

> This demo uses **incremental migration** — never drop existing tables, just add what's missing.
> Use `IF NOT EXISTS` so the script is safe to re-run.

Create a migration script named `database/sql/demo_notes_field.sql`:

```sql
\set ON_ERROR_STOP on

-- Add notes to line item
ALTER TABLE ____________
  ADD COLUMN IF NOT EXISTS ____________  text;
```

> **Think about it:** Why do we add `notes` to `invoice_line_item` and not `invoice`?

### Run and verify

**macOS / Linux:**
```bash
cat database/sql/demo_notes_field.sql | docker exec -i pgdatabase psql -U root -d invoices_db
```

**Windows (PowerShell):**
```powershell
Get-Content database\sql\demo_notes_field.sql | docker exec -i pgdatabase psql -U root -d invoices_db
```

Open [http://localhost:8080](http://localhost:8080) (Adminer) → confirm that `invoice_line_item` has a `notes` column.

---

## Step 2 — Server: Update Invoice Service

**File:** `server/src/services/invoices.service.js`

### 2.1 `getInvoice` — return `notes` from database

**Before:**
```sql
select li.id,
       p.code as product_code, p.name as product_name,
       u.code as units_code,
       li.quantity, li.unit_price, li.extended_price
from invoice_line_item li
```

**After:** (add `li.notes` after `li.extended_price`)
```sql
select li.id,
       p.code as product_code, p.name as product_name,
       u.code as units_code,
       li.quantity, li.unit_price, li.extended_price, ____________
from invoice_line_item li
```

> **Think about it:** If you skip this step but complete all others, what will the front-end see?

---

### 2.2 `createInvoice` — INSERT `notes`

**Before:**
```js
await client.query(
  `insert into invoice_line_item (id, created_at, invoice_id, product_id, quantity, unit_price, extended_price)
   values ((select coalesce(max(id),0)+1 from invoice_line_item), now(), $1,$2,$3,$4,$5)`,
  [invoice_id, li.product_id, li.quantity, li.unit_price, li.extended_price],
);
```

**After:** (add `notes` column and `$6`)
```js
await client.query(
  `insert into invoice_line_item (id, created_at, invoice_id, product_id, quantity, unit_price, extended_price, ____________)
   values ((select coalesce(max(id),0)+1 from invoice_line_item), now(), $1,$2,$3,$4,$5,$6)`,
  [invoice_id, li.product_id, li.quantity, li.unit_price, li.extended_price, ____________ ?? null],
);
```

> **Think about it:** Why `?? null` before passing the value to the database?

---

### 2.3 `updateInvoice` — same pattern

UPDATE existing line item:

**Before:**
```js
await client.query(
  `UPDATE invoice_line_item
   SET product_id=$1, quantity=$2, unit_price=$3, extended_price=$4
   WHERE id=$5 AND invoice_id=$6`,
  [li.product_id, li.quantity, li.unit_price, extended_price, lineId, id],
);
```

**After:** (add `notes=$5`, shift WHERE to `$6, $7`)
```js
await client.query(
  `UPDATE invoice_line_item
   SET product_id=$1, quantity=$2, unit_price=$3, extended_price=$4, ____________=$5
   WHERE id=$6 AND invoice_id=$7`,
  [li.product_id, li.quantity, li.unit_price, extended_price, ____________ ?? null, lineId, id],
);
```

INSERT new line item (inside the `else` branch):

**Before:**
```js
await client.query(
  `INSERT INTO invoice_line_item (id, created_at, invoice_id, product_id, quantity, unit_price, extended_price)
   VALUES ((select coalesce(max(id),0)+1 from invoice_line_item), now(), $1,$2,$3,$4,$5)`,
  [id, li.product_id, li.quantity, li.unit_price, extended_price],
);
```

**After:**
```js
await client.query(
  `INSERT INTO invoice_line_item (id, created_at, invoice_id, product_id, quantity, unit_price, extended_price, ____________)
   VALUES ((select coalesce(max(id),0)+1 from invoice_line_item), now(), $1,$2,$3,$4,$5,$6)`,
  [id, li.product_id, li.quantity, li.unit_price, extended_price, ____________ ?? null],
);
```

### Test
```
GET http://localhost:4000/api/invoices/INV-001
```
You should see `"notes": null` in each item inside `line_items`.

---

## Step 3 — Client: LineItemRow

**File:** `client/src/components/LineItemRow.jsx`

Add a new `<td>` for Notes after the Extended Price cell and before the Actions cell:

**Before:**
```jsx
<td>
  <div style={{ textAlign: "right", fontWeight: 600, color: "var(--primary)", fontSize: "0.95rem" }}>
    {formatBaht(computeExtended(it))}
  </div>
</td>
<td>
  {/* Actions */}
  ...
</td>
```

**After:** (insert a new `<td>` in between)
```jsx
<td>
  <div style={{ textAlign: "right", fontWeight: 600, color: "var(--primary)", fontSize: "0.95rem" }}>
    {formatBaht(computeExtended(it))}
  </div>
</td>
{/* Notes — editable text */}
<td>
  <input
    type="text"
    className="form-control"
    value={____________ || ""}
    onChange={(e) => update(i, { ____________: e.target.value })}
    placeholder="Notes..."
    style={{ padding: "6px 10px", fontSize: "0.9rem" }}
  />
</td>
<td>
  {/* Actions */}
  ...
</td>
```

> **Think about it:** Row data comes through a prop — what is it called? What goes in the first blank?

---

## Step 4 — Client: LineItemsEditor

**File:** `client/src/components/LineItemsEditor.jsx`

### 4.1 Add column header

**Before:**
```jsx
<th style={{ width: '12%' }} className="text-right">Extended</th>
<th style={{ width: '100px' }} className="text-center">Actions</th>
```

**After:**
```jsx
<th style={{ width: '12%' }} className="text-right">Extended</th>
<th style={{ width: '18%' }}>____________</th>
<th style={{ width: '100px' }} className="text-center">Actions</th>
```

---

### 4.2 Add `notes` to default row objects

Do this in both `addRow()` and `insertRowAfter()`:

**Before:**
```js
{ product_code: "", product_name: "", quantity: 1, unit_price: 0 }
```

**After:**
```js
{ product_code: "", product_name: "", quantity: 1, unit_price: 0, ____________: "" }
```

> **Think about it:** What happens if you forget `notes: ""` when a new row is created?

---

### 4.3 Update `colSpan` for the empty-state row

**Before:**
```jsx
<td colSpan="8" ...>
```

**After:**
```jsx
<td colSpan="____________" ...>
```

---

## Step 5 — Client: InvoiceForm

**File:** `client/src/components/InvoiceForm.jsx`

### 5.1 Add `notes` to items default state

**Before:**
```js
const [items, setItems] = React.useState([{ product_code: "", quantity: 1, unit_price: 0 }]);
```

**After:**
```js
const [items, setItems] = React.useState([{ product_code: "", quantity: 1, unit_price: 0, ____________: "" }]);
```

---

### 5.2 Add Total Quantity calculation

Place this after `const amountDue = subtotal + vat;`:

```js
// Group quantities by units_code for Total Quantity display
const totalQtyByUnit = items
  .filter(it => it.product_code && it.____________)   // only items with a known unit
  .reduce((acc, it) => {
    const unit = it.____________;                      // key is units_code
    acc[unit] = (acc[unit] || 0) + Number(it.____________ || 0);  // accumulate quantity
    return acc;
  }, {});
```

> **Think about it:** Why filter out items that don't have `product_code` or `units_code`?

---

### 5.3 Load values in edit mode

Inside the `React.useEffect` that watches `initialData`:

**Before:**
```js
unit_price: Number(li.unit_price)
```

**After:**
```js
unit_price: Number(li.unit_price),
____________: li.____________ || ""
```

---

### 5.4 Add `notes` to the payload

**Before:**
```js
const out = {
  product_code: ...,
  quantity: ...,
  unit_price: ...,
};
```

**After:**
```js
const out = {
  product_code: ...,
  quantity: ...,
  unit_price: ...,
  ____________: String(x.____________ || "").trim() || null,
};
```

---

### 5.5 Add Total Quantity textbox to Summary card JSX

Place this after the Total row inside the Summary card:

```jsx
{Object.keys(totalQtyByUnit).length > 0 && (
  <div style={{ borderTop: "1px solid var(--border)", paddingTop: 10, marginTop: 2 }}>
    <div style={{ fontSize: "0.75rem", color: "var(--text-muted)", marginBottom: 4 }}>____________</div>
    <textarea
      readOnly
      rows={Object.keys(totalQtyByUnit).length}
      value={Object.entries(totalQtyByUnit)
        .map(([unit, qty]) => `${qty.toFixed(2).padStart(8)} ${unit}`)
        .join("\n")}
      style={{ fontFamily: "monospace", fontSize: "0.85rem", width: "100%", resize: "none",
               background: "var(--bg-body)", border: "1px solid var(--border)",
               borderRadius: "var(--radius-sm)", padding: "6px 8px" }}
    />
  </div>
)}
```

> **Think about it:** Why must this textbox be `readOnly`? Why hide it when `totalQtyByUnit` is empty?

---

## Step 6 — Client: InvoicePage

**File:** `client/src/pages/invoices/InvoicePage.jsx`

### 6.1 Edit mode — map `notes` into initialData

**Before:**
```js
line_items: inv.line_items.map(li => ({
  ...
  unit_price: li.unit_price
}))
```

**After:**
```js
line_items: inv.line_items.map(li => ({
  ...
  unit_price: li.unit_price,
  ____________: li.____________ || ""
}))
```

---

### 6.2 View mode — add Notes column to line items table

**Before:**
```jsx
<th className="text-right">Extended</th>
```

**After:**
```jsx
<th className="text-right">Extended</th>
<th>____________</th>
```

---

**Before:**
```jsx
<td className="text-right font-bold">{formatBaht(li.extended_price)}</td>
</tr>
```

**After:**
```jsx
<td className="text-right font-bold">{formatBaht(li.extended_price)}</td>
<td>{li.____________ || ""}</td>
</tr>
```

---

## Test All Flows

| Test | How | Expected result |
|------|-----|-----------------|
| Create invoice | Add line items with different units | Total Quantity shows grouped by unit in Summary |
| Enter Notes | Fill Notes on some rows, leave others blank | Saves successfully |
| View invoice | Open view page | Notes column shows correctly in line items table |
| Edit invoice | Click Edit | All Notes fields load back correctly |
| No notes entered | Create without filling Notes | Saves successfully (notes is null) |
| Check DB | View in Adminer | `notes` column in `invoice_line_item` contains values you entered |
