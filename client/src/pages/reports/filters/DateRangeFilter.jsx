import React from "react";

export default function DateRangeFilter({ dateFrom, dateTo, onChange, label = "Date Range" }) {
  return (
    <div className="filter-group">
      <label className="filter-label">{label}</label>
      <div className="filter-row">
        <input
          type="date"
          className="form-control"
          value={dateFrom}
          onChange={(e) => onChange({ dateFrom: e.target.value })}
          placeholder="From"
        />
        <span className="filter-separator">to</span>
        <input
          type="date"
          className="form-control"
          value={dateTo}
          onChange={(e) => onChange({ dateTo: e.target.value })}
          placeholder="To"
        />
      </div>
    </div>
  );
}
