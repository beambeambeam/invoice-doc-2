import React from "react";
import { listSalesPersons } from "../../api/salesPersons.api.js";
import DataList from "../../components/DataList.jsx";

export default function SalesPersonList() {
  const fetchData = React.useCallback((params) => listSalesPersons(params), []);

  const columns = [
    { key: "code", label: "Code" },
    { key: "name", label: "Name" },
    {
      key: "start_work_date",
      label: "Start Work Date",
      render: (value) => (value ? String(value).slice(0, 10) : "-"),
    },
  ];

  return (
    <DataList
      title="Sales Persons"
      fetchData={fetchData}
      columns={columns}
      searchPlaceholder="Search code or name..."
      itemName="sales persons"
      basePath="/sales-persons"
      itemKey="code"
    />
  );
}
