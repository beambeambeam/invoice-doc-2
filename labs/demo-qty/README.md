# Demo — เพิ่ม 2 Feature: Notes ใน Line Item และ Total Quantity

> Base จาก Lab 8
>
> **Feature 1:** เพิ่ม field `notes` (หมายเหตุ) ใน line item ทุก layer ตั้งแต่ฐานข้อมูล → service → UI
>
> **Feature 2:** เพิ่ม calculated textbox "Total Quantity" ใน Summary card ที่แสดงยอดรวม qty แยกตาม unit แบบ read-only

> แต่ละ step จะบอกว่าไฟล์ไหน, before เป็นยังไง, และ after ต้องเพิ่มอะไร (ช่องว่าง `____________` = ส่วนที่น้องต้องเติมเอง)

---

## Overview — สิ่งที่จะทำ

| # | งาน | ไฟล์หลัก |
|---|-----|---------|
| 1 | Database migration | `database/sql/demo_notes_field.sql` |
| 2 | Server: Invoice Service | `server/src/services/invoices.service.js` |
| 3 | Client: LineItemRow | `client/src/components/LineItemRow.jsx` |
| 4 | Client: LineItemsEditor | `client/src/components/LineItemsEditor.jsx` |
| 5 | Client: InvoiceForm | `client/src/components/InvoiceForm.jsx` |
| 6 | Client: InvoicePage | `client/src/pages/invoices/InvoicePage.jsx` |

---

## Step 1 — Database: เพิ่ม Column

> Demo นี้ใช้ **incremental migration** — ไม่ drop table เดิม เพียงแค่เพิ่ม column ที่ขาดไป
> ใช้ `IF NOT EXISTS` เพื่อให้รันซ้ำได้ปลอดภัย

งานของคุณคือ **สร้าง migration script** ชื่อ `database/sql/demo_notes_field.sql`:

```sql
\set ON_ERROR_STOP on

-- เพิ่ม notes ให้ line item
ALTER TABLE ____________
  ADD COLUMN IF NOT EXISTS ____________  text;
```

> **คิดดู:** ทำไมต้องเพิ่มที่ `invoice_line_item` ไม่ใช่ `invoice`?

### รันและตรวจสอบ

**macOS / Linux:**
```bash
cat database/sql/demo_notes_field.sql | docker exec -i pgdatabase psql -U root -d invoices_db
```

**Windows (PowerShell):**
```powershell
Get-Content database\sql\demo_notes_field.sql | docker exec -i pgdatabase psql -U root -d invoices_db
```

เปิด [http://localhost:8080](http://localhost:8080) (Adminer) → ตรวจสอบว่า `invoice_line_item` มี column `notes` แล้ว

---

## Step 2 — Server: แก้ Invoice Service

**ไฟล์:** `server/src/services/invoices.service.js`

### 2.1 `getInvoice` — ดึง `notes` ขึ้นมาด้วย

**Before:**
```sql
select li.id,
       p.code as product_code, p.name as product_name,
       u.code as units_code,
       li.quantity, li.unit_price, li.extended_price
from invoice_line_item li
```

**After:** (เพิ่ม `li.notes` ต่อท้าย `li.extended_price`)
```sql
select li.id,
       p.code as product_code, p.name as product_name,
       u.code as units_code,
       li.quantity, li.unit_price, li.extended_price, ____________
from invoice_line_item li
```

> **คิดดู:** ถ้าลืมเพิ่ม `li.notes` ตรงนี้ แต่ทำ step อื่นครบ — จะเกิดอะไรขึ้น?

---

### 2.2 `createInvoice` — รับและบันทึก `notes`

INSERT line item — เพิ่ม column และ parameter:

**Before:**
```js
await client.query(
  `insert into invoice_line_item (id, created_at, invoice_id, product_id, quantity, unit_price, extended_price)
   values ((select coalesce(max(id),0)+1 from invoice_line_item), now(), $1,$2,$3,$4,$5)`,
  [invoice_id, li.product_id, li.quantity, li.unit_price, li.extended_price],
);
```

**After:** (เพิ่ม column `notes` และ `$6`)
```js
await client.query(
  `insert into invoice_line_item (id, created_at, invoice_id, product_id, quantity, unit_price, extended_price, ____________)
   values ((select coalesce(max(id),0)+1 from invoice_line_item), now(), $1,$2,$3,$4,$5,$6)`,
  [invoice_id, li.product_id, li.quantity, li.unit_price, li.extended_price, ____________ ?? null],
);
```

> **คิดดู:** ทำไมต้องใช้ `?? null` ก่อนส่งเข้า database?

---

### 2.3 `updateInvoice` — ทำแบบเดียวกัน

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

**After:** (เพิ่ม `notes=$5` และขยับ `WHERE` เป็น `$6, $7`)
```js
await client.query(
  `UPDATE invoice_line_item
   SET product_id=$1, quantity=$2, unit_price=$3, extended_price=$4, ____________=$5
   WHERE id=$6 AND invoice_id=$7`,
  [li.product_id, li.quantity, li.unit_price, extended_price, ____________ ?? null, lineId, id],
);
```

INSERT new line item (ในส่วน `else` ของ updateInvoice):

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

### ทดสอบ

```
GET http://localhost:4000/api/invoices/INV-001
```
ควรเห็น `"notes": null` ในแต่ละ item ใน `line_items`

---

## Step 3 — Client: LineItemRow

**ไฟล์:** `client/src/components/LineItemRow.jsx`

เพิ่ม `<td>` ใหม่สำหรับ Notes หลัง Extended Price cell และก่อน Actions cell:

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

**After:** (เพิ่ม `<td>` ตรงกลาง)
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

> **คิดดู:** ข้อมูลของแถวนี้อยู่ใน prop ชื่ออะไร? ช่องว่างแรกควรเติมว่าอะไร?

---

## Step 4 — Client: LineItemsEditor

**ไฟล์:** `client/src/components/LineItemsEditor.jsx`

### 4.1 เพิ่ม column header

**Before:**
```jsx
<th style={{ width: '12%' }} className="text-right">Extended</th>
<th style={{ width: '100px' }} className="text-center">Actions</th>
```

**After:** (เพิ่ม `<th>` ตรงกลาง)
```jsx
<th style={{ width: '12%' }} className="text-right">Extended</th>
<th style={{ width: '18%' }}>____________</th>
<th style={{ width: '100px' }} className="text-center">Actions</th>
```

---

### 4.2 เพิ่ม `notes` ใน default row

ทำทั้ง 2 จุด ได้แก่ function `addRow()` และ `insertRowAfter()`:

**Before:**
```js
{ product_code: "", product_name: "", quantity: 1, unit_price: 0 }
```

**After:**
```js
{ product_code: "", product_name: "", quantity: 1, unit_price: 0, ____________: "" }
```

> **คิดดู:** ถ้าไม่เพิ่ม `notes: ""` ใน default row จะเกิดอะไรขึ้นตอนกด Add Item?

---

### 4.3 อัพเดต `colSpan` ของ empty-state row

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

**ไฟล์:** `client/src/components/InvoiceForm.jsx`

### 5.1 เพิ่ม `notes` ใน items default state

**Before:**
```js
const [items, setItems] = React.useState([{ product_code: "", quantity: 1, unit_price: 0 }]);
```

**After:**
```js
const [items, setItems] = React.useState([{ product_code: "", quantity: 1, unit_price: 0, ____________: "" }]);
```

---

### 5.2 เพิ่ม Total Quantity calculation

วางหลังบรรทัด `const amountDue = subtotal + vat;`:

```js
// Group quantities by units_code for Total Quantity display
const totalQtyByUnit = items
  .filter(it => it.product_code && it.____________)   // เฉพาะ item ที่รู้ unit แล้ว
  .reduce((acc, it) => {
    const unit = it.____________;                      // key คือ units_code
    acc[unit] = (acc[unit] || 0) + Number(it.____________ || 0);  // สะสม quantity
    return acc;
  }, {});
```

> **คิดดู:** ทำไมต้อง filter เฉพาะ item ที่มี `product_code` และ `units_code`?

---

### 5.3 โหลดค่าตอน edit mode

ในส่วน `React.useEffect` ที่ดู `initialData`:

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

### 5.4 เพิ่ม `notes` ใน payload

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

### 5.5 เพิ่ม Total Quantity textbox ใน Summary card JSX

วางต่อจาก Total row ใน Summary card:

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

> **คิดดู:** ทำไม textbox นี้ถึงต้องเป็น `readOnly`? และทำไมถึงซ่อนเมื่อ `totalQtyByUnit` ว่างเปล่า?

---

## Step 6 — Client: InvoicePage

**ไฟล์:** `client/src/pages/invoices/InvoicePage.jsx`

### 6.1 Edit mode — map `notes` เข้า initialData

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

### 6.2 View mode — เพิ่ม Notes column ใน line items table

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

## ทดสอบครบทุก Flow

| ทดสอบ | วิธี | ผลที่คาดหวัง |
|-------|------|-------------|
| สร้าง invoice | เพิ่ม line items หลาย unit | Total Quantity แสดง group by unit ใน Summary |
| กรอก Notes | กรอก Notes บางรายการ ไม่กรอกบางรายการ | บันทึกได้ปกติ |
| ดู invoice | เปิดหน้า view | ตาราง line items มีคอลัมน์ Notes แสดงค่าถูกต้อง |
| แก้ invoice | กด Edit | Notes ทุก row โหลดกลับมาครบ |
| ไม่กรอก notes | สร้าง invoice โดยไม่ใส่ notes | บันทึกได้ปกติ (notes เป็น null) |
| ตรวจ DB | ดูใน Adminer | column `notes` ใน `invoice_line_item` มีค่าที่กรอกไว้ |
