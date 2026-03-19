import { useEffect, useMemo, useState } from "react";

export default function App() {
  const [properties, setProperties] = useState([]);
  const [propertyId, setPropertyId] = useState("");
  const [month, setMonth] = useState("2026-02");
  const [dashboard, setDashboard] = useState(null);

  const [loading, setLoading] = useState(false);
  const [msg, setMsg] = useState("");
  const [error, setError] = useState("");

  const [selectedUnit, setSelectedUnit] = useState(null);
  const [invoice, setInvoice] = useState(null);

  const [simulateSpike, setSimulateSpike] = useState(false);

  const selectedProperty = useMemo(
    () => properties.find((p) => p.id === propertyId),
    [properties, propertyId],
  );

  const [dailySeries, setDailySeries] = useState([]);

  async function apiGet(url) {
    const res = await fetch(url);
    if (!res.ok) throw new Error(await res.text());
    return res.json();
  }

  async function apiPost(url) {
    const res = await fetch(url, { method: "POST" });
    if (!res.ok) throw new Error(await res.text());
    const text = await res.text();
    try {
      return text ? JSON.parse(text) : {};
    } catch {
      return {};
    }
  }

  async function loadProperties() {
    setLoading(true);
    setMsg("");
    setError("");
    try {
      const data = await apiGet("/api/Properties");
      setProperties(data);
      if (data.length && !propertyId) setPropertyId(data[0].id);
    } catch (e) {
      setError(String(e));
    } finally {
      setLoading(false);
    }
  }

  async function loadDashboard(pid = propertyId, m = month) {
    if (!pid) return;
    setLoading(true);
    setMsg("");
    setError("");
    try {
      const data = await apiGet(
        `/api/Dashboard/property/${pid}?month=${encodeURIComponent(m)}`,
      );
      setDashboard(data);
      const daily = await apiGet(
        `/api/Dashboard/property/${pid}/daily?month=${encodeURIComponent(m)}`,
      );

      setDailySeries(
        (daily.daily || []).map((d) => ({
          label: String(d.day).slice(8, 10), // "01", "02", ...
          value: Number(d.usageKwh) || 0,
        })),
      );

      if (selectedUnit?.unitId) {
        const fresh =
          data?.units?.find((u) => u.unitId === selectedUnit.unitId) || null;
        setSelectedUnit(fresh);
      }
    } catch (e) {
      setError(String(e));
      setDashboard(null);
    } finally {
      setLoading(false);
    }
  }

  async function simulateReadings() {
    if (!propertyId) return;
    setLoading(true);
    setMsg("");
    setError("");
    try {
      const data = await apiPost(
        `/api/Readings/simulate?propertyId=${propertyId}&days=30&spike=${
          simulateSpike ? "true" : "false"
        }`,
      );
      setMsg(`Simulated readings inserted: ${data.inserted ?? "OK"}`);
      await loadDashboard();
    } catch (e) {
      setError(String(e));
    } finally {
      setLoading(false);
    }
  }

  async function generateBilling() {
    if (!propertyId) return;
    setLoading(true);
    setMsg("");
    setError("");
    try {
      const data = await apiPost(
        `/api/Billing/generate?propertyId=${propertyId}&month=${encodeURIComponent(
          month,
        )}`,
      );
      setMsg(
        `Billing: generated=${data.generated ?? 0}, updated=${
          data.updated ?? 0
        }, skippedNoPlan=${data.skippedNoPlan ?? 0}`,
      );
      await loadDashboard();
    } catch (e) {
      setError(String(e));
    } finally {
      setLoading(false);
    }
  }

  async function loadInvoiceForUnit(unit) {
    if (!unit?.unitId) return;
    setLoading(true);
    setMsg("");
    setError("");
    try {
      const data = await apiGet(
        `/api/Billing/unit/${unit.unitId}?month=${encodeURIComponent(month)}`,
      );
      setInvoice(data);
    } catch {
      setInvoice(null);
      setMsg("No invoice found for this unit/month. Generate billing first.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadProperties();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (propertyId) loadDashboard(propertyId, month);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [propertyId, month]);

  const totals = useMemo(() => {
    const units = dashboard?.units || [];
    const totalInvoices = units.reduce(
      (sum, u) => sum + (Number(u.invoiceTotalAmount) || 0),
      0,
    );
    const countInvoices = units.filter(
      (u) => u.invoiceTotalAmount != null,
    ).length;
    const avgInvoice = countInvoices > 0 ? totalInvoices / countInvoices : 0;
    return { totalInvoices, avgInvoice };
  }, [dashboard]);

  const usageSeries = useMemo(() => {
    const units = dashboard?.units || [];
    return units
      .slice()
      .sort((a, b) => Number(b.totalUsageKwh) - Number(a.totalUsageKwh))
      .map((u) => ({
        label: u.unitNumber,
        value: Number(u.totalUsageKwh) || 0,
      }));
  }, [dashboard]);

  // Line chart works best with stable x-order, so we also create a sorted series by unitNumber
  const usageSeriesByUnit = useMemo(() => {
    const units = dashboard?.units || [];
    return units
      .slice()
      .sort((a, b) => String(a.unitNumber).localeCompare(String(b.unitNumber)))
      .map((u) => ({
        label: u.unitNumber,
        value: Number(u.totalUsageKwh) || 0,
      }));
  }, [dashboard]);

  const invoiceSeries = useMemo(() => {
    const units = dashboard?.units || [];
    return units
      .slice()
      .sort(
        (a, b) =>
          Number(b.invoiceTotalAmount || 0) - Number(a.invoiceTotalAmount || 0),
      )
      .map((u) => ({
        label: u.unitNumber,
        value: Number(u.invoiceTotalAmount) || 0,
      }));
  }, [dashboard]);

  const invoiceSeriesByUnit = useMemo(() => {
    const units = dashboard?.units || [];
    return units
      .slice()
      .sort((a, b) => String(a.unitNumber).localeCompare(String(b.unitNumber)))
      .map((u) => ({
        label: u.unitNumber,
        value: Number(u.invoiceTotalAmount) || 0,
      }));
  }, [dashboard]);

  const spikeRows = useMemo(() => {
    const spikes = dashboard?.spikeAlerts || [];
    const units = dashboard?.units || [];
    return spikes.map((s) => {
      const match = units.find((u) => u.unitId === s.unitId);
      return {
        unitNumber: match?.unitNumber ?? shortId(s.unitId),
        tenantName: match?.tenantName ?? "-",
        daysCount: s.daysCount,
        avgDailyKwh: s.avgDailyKwh,
        maxDailyKwh: s.maxDailyKwh,
        threshold: s.threshold,
      };
    });
  }, [dashboard]);

  return (
    <div style={ui.page}>
      <div style={ui.header}>
        <div style={ui.brand}>
          <div style={ui.logo}>⚡</div>
          <div>
            <div style={ui.title}>EnergyOps Dashboard</div>
            <div style={ui.subTitle}>
              Smart Submeter Billing + Monitoring Platform (Demo)
            </div>
          </div>
        </div>

        <div style={ui.headerRight}>
          <span style={ui.chip}>
            Month: <b style={{ fontWeight: 800 }}>{month || "YYYY-MM"}</b>
          </span>
          <span style={{ ...ui.chip, ...ui.chipAccent }}>
            {loading ? "Loading..." : "Live"}
          </span>
        </div>
      </div>

      <div style={ui.content}>
        <div style={ui.panel}>
          <div style={ui.panelGrid}>
            <div style={{ ...ui.field, gridColumn: "span 6" }}>
              <label style={ui.label}>Property</label>
              <select
                value={propertyId}
                onChange={(e) => {
                  setSelectedUnit(null);
                  setInvoice(null);
                  setPropertyId(e.target.value);
                }}
                style={ui.select}
              >
                <option value="">Select property</option>
                {properties.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name} - {p.address}
                  </option>
                ))}
              </select>
              {selectedProperty && (
                <div style={ui.helper}>Selected: {selectedProperty.name}</div>
              )}
            </div>

            <div style={{ ...ui.field, gridColumn: "span 3" }}>
              <label style={ui.label}>Month (YYYY-MM)</label>
              <input
                value={month}
                onChange={(e) => setMonth(e.target.value)}
                placeholder="2026-02"
                style={ui.input}
              />
              <div style={ui.helper}>Example: 2026-02</div>
            </div>

            <div
              style={{
                ...ui.field,
                gridColumn: "span 3",
                alignItems: "center",
              }}
            >
              <label style={ui.label}>Simulate spike</label>
              <Toggle
                checked={simulateSpike}
                onChange={() => setSimulateSpike((v) => !v)}
              />
              <div style={ui.helper}>Enable then simulate readings.</div>
            </div>

            <div style={{ ...ui.field, gridColumn: "span 12" }}>
              <div style={ui.actions}>
                <Button
                  tone="primary"
                  onClick={simulateReadings}
                  disabled={!propertyId || loading}
                >
                  Simulate Readings (30 days)
                </Button>
                <Button
                  tone="accent"
                  onClick={generateBilling}
                  disabled={!propertyId || loading}
                >
                  Generate Billing
                </Button>
                <Button
                  tone="ghost"
                  onClick={() => loadDashboard()}
                  disabled={!propertyId || loading}
                >
                  Refresh
                </Button>
              </div>

              {(msg || error) && (
                <div style={{ marginTop: 10 }}>
                  {error ? (
                    <Notice tone="error" text={error} />
                  ) : (
                    <Notice tone="info" text={msg} />
                  )}
                </div>
              )}
            </div>
          </div>
        </div>

        {!dashboard ? (
          <div style={ui.card}>
            <Empty
              title="Select a property"
              desc="Once selected, the dashboard loads automatically."
            />
          </div>
        ) : (
          <div style={ui.grid}>
            <div style={ui.leftCol}>
              <div style={ui.stats}>
                <Stat
                  tone="blue"
                  icon="⚡"
                  label="Total Usage (kWh)"
                  value={fmtNum(dashboard.propertyTotalUsageKwh)}
                />
                <Stat
                  tone="violet"
                  icon="📅"
                  label="Daily Avg (kWh)"
                  value={fmtNum(dashboard.propertyDailyAvgKwh)}
                />
                <Stat
                  tone="green"
                  icon="💳"
                  label="Total Invoices ($)"
                  value={fmtMoney(totals.totalInvoices)}
                />
                <Stat
                  tone="orange"
                  icon="📈"
                  label="Avg Invoice ($)"
                  value={fmtMoney(totals.avgInvoice)}
                />
                <Stat
                  tone="pink"
                  icon="🏆"
                  label="Top Consumer"
                  value={dashboard.topConsumer?.unitNumber ?? "-"}
                />
                <Stat
                  tone="red"
                  icon="🚨"
                  label="Spike Alerts"
                  value={String(dashboard.spikeAlerts?.length ?? 0)}
                />
              </div>

              {/* NEW: LINE CHARTS */}
              <div style={ui.cards2}>
                <div style={ui.card}>
                  <CardHeader
                    title="Usage (kWh) Line"
                    sub="Same data, shown as a line (x = unit)"
                  />
                  <LineChart data={dailySeries} height={220} gradient="blue" />
                </div>

                <div style={ui.card}>
                  <CardHeader
                    title="Invoices ($) Line"
                    sub="Same data, shown as a line (x = unit)"
                  />
                  <LineChart
                    data={invoiceSeriesByUnit}
                    height={220}
                    gradient="green"
                  />
                </div>
              </div>

              <div style={ui.card}>
                <CardHeader title="Units" sub="Click a row to view invoice." />
                <Table
                  columns={[
                    { key: "unitNumber", label: "Unit" },
                    { key: "tenantName", label: "Tenant" },
                    {
                      key: "totalUsageKwh",
                      label: "Usage (kWh)",
                      format: fmtNum,
                    },
                    {
                      key: "invoiceTotalAmount",
                      label: "Invoice ($)",
                      format: (v) => (v == null ? "-" : fmtMoney(v)),
                    },
                    {
                      key: "invoiceStatus",
                      label: "Status",
                      render: (row) => <StatusPill value={row.invoiceStatus} />,
                    },
                  ]}
                  rows={dashboard.units || []}
                  onRowClick={(row) => {
                    setSelectedUnit(row);
                    setInvoice(null);
                    loadInvoiceForUnit(row);
                  }}
                  selectedRowKey={selectedUnit?.unitId}
                  rowKey="unitId"
                />
              </div>

              <div style={ui.card}>
                <CardHeader
                  title="Spike Alerts"
                  sub="Only rows that meet threshold appear."
                />
                <Table
                  columns={[
                    { key: "unitNumber", label: "Unit" },
                    { key: "tenantName", label: "Tenant" },
                    { key: "daysCount", label: "Days" },
                    {
                      key: "avgDailyKwh",
                      label: "Avg/day (kWh)",
                      format: fmtNum,
                    },
                    {
                      key: "maxDailyKwh",
                      label: "Max/day (kWh)",
                      format: fmtNum,
                    },
                    { key: "threshold", label: "Threshold", format: fmtNum },
                  ]}
                  rows={spikeRows}
                />
              </div>
            </div>

            <div style={ui.rightCol}>
              <div style={ui.stickyCard}>
                <CardHeader
                  title="Invoice Details"
                  sub={
                    selectedUnit
                      ? `${selectedUnit.unitNumber} (${selectedUnit.tenantName || "No tenant"})`
                      : "Select a unit row"
                  }
                />

                {!selectedUnit ? (
                  <Empty
                    title="Click a unit row"
                    desc="Invoice details for the selected month show here."
                  />
                ) : invoice ? (
                  <div style={ui.detail}>
                    <KV label="Month" value={invoice.billingMonth} />
                    <KV
                      label="Total Usage"
                      value={`${fmtNum(invoice.totalUsageKwh)} kWh`}
                    />
                    <KV
                      label="Rate"
                      value={`$${fmtNum(invoice.ratePerKwhSnapshot)}/kWh`}
                    />
                    <KV
                      label="Fixed Fee"
                      value={`$${fmtNum(invoice.fixedFeeSnapshot)}`}
                    />
                    <Divider />
                    <KV
                      label="Total"
                      value={fmtMoney(invoice.totalAmount)}
                      strong
                    />
                    <KV label="Status" value={invoice.status} />
                    <KV
                      label="Generated"
                      value={fmtDate(invoice.generatedAt)}
                    />
                  </div>
                ) : (
                  <Empty
                    title="No invoice loaded"
                    desc="Generate billing, then click a unit row."
                  />
                )}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

/* ---------------- UI Components ---------------- */

function Button({ tone, children, ...props }) {
  const t = toneStyles[tone] || toneStyles.ghost;
  return (
    <button
      {...props}
      style={{
        ...ui.btn,
        ...t,
        opacity: props.disabled ? 0.55 : 1,
      }}
    >
      {children}
    </button>
  );
}

function CardHeader({ title, sub }) {
  return (
    <div style={{ marginBottom: 12 }}>
      <div style={{ fontSize: 15, fontWeight: 900, color: "#0f172a" }}>
        {title}
      </div>
      <div style={{ fontSize: 12, color: "#475569", marginTop: 4 }}>{sub}</div>
    </div>
  );
}

function Notice({ tone, text }) {
  const isErr = tone === "error";
  return (
    <div
      style={{
        padding: 12,
        borderRadius: 14,
        fontSize: 13,
        lineHeight: 1.35,
        border: `1px solid ${
          isErr ? "rgba(239,68,68,0.35)" : "rgba(59,130,246,0.35)"
        }`,
        background: isErr ? "rgba(239,68,68,0.08)" : "rgba(59,130,246,0.08)",
        color: "#0f172a",
      }}
    >
      {text}
    </div>
  );
}

function Empty({ title, desc }) {
  return (
    <div
      style={{
        padding: 18,
        borderRadius: 16,
        border: "1px dashed rgba(100,116,139,0.35)",
        background: "rgba(255,255,255,0.65)",
      }}
    >
      <div style={{ fontWeight: 900, color: "#0f172a" }}>{title}</div>
      <div
        style={{
          marginTop: 6,
          fontSize: 12,
          color: "#475569",
          lineHeight: 1.4,
        }}
      >
        {desc}
      </div>
    </div>
  );
}

function Stat({ tone, icon, label, value }) {
  const t = statTones[tone] || statTones.blue;
  return (
    <div style={{ ...ui.stat, borderColor: t.border }}>
      <div style={ui.statTop}>
        <div style={{ ...ui.statIcon, background: t.iconBg, color: t.iconFg }}>
          {icon}
        </div>
        <div style={ui.statLabel}>{label}</div>
      </div>
      <div style={ui.statValue}>{value ?? "-"}</div>
    </div>
  );
}

function StatusPill({ value }) {
  const v = (value || "").toLowerCase();
  const tone =
    v === "draft"
      ? {
          bg: "rgba(59,130,246,0.10)",
          bd: "rgba(59,130,246,0.35)",
          fg: "#1d4ed8",
        }
      : v === "paid"
        ? {
            bg: "rgba(34,197,94,0.10)",
            bd: "rgba(34,197,94,0.35)",
            fg: "#15803d",
          }
        : v === "overdue"
          ? {
              bg: "rgba(239,68,68,0.10)",
              bd: "rgba(239,68,68,0.35)",
              fg: "#b91c1c",
            }
          : {
              bg: "rgba(100,116,139,0.10)",
              bd: "rgba(100,116,139,0.25)",
              fg: "#334155",
            };

  return (
    <span
      style={{
        padding: "6px 10px",
        borderRadius: 999,
        border: `1px solid ${tone.bd}`,
        background: tone.bg,
        fontSize: 12,
        fontWeight: 800,
        color: tone.fg,
        display: "inline-block",
      }}
    >
      {value || "-"}
    </span>
  );
}

function Toggle({ checked, onChange }) {
  return (
    <button
      type="button"
      onClick={onChange}
      style={{
        ...ui.toggle,
        borderColor: checked
          ? "rgba(34,197,94,0.45)"
          : "rgba(100,116,139,0.35)",
        background: checked ? "rgba(34,197,94,0.10)" : "rgba(100,116,139,0.08)",
      }}
    >
      <span
        style={{
          ...ui.toggleDot,
          transform: "none",
          background: checked ? "#22c55e" : "#94a3b8",
        }}
      />
      <span
        style={{
          marginLeft: 10,
          fontSize: 13,
          fontWeight: 800,
          color: "#0f172a",
        }}
      >
        {checked ? "Enabled" : "Disabled"}
      </span>
    </button>
  );
}

function Divider() {
  return (
    <div
      style={{
        height: 1,
        background: "rgba(100,116,139,0.20)",
        margin: "12px 0",
      }}
    />
  );
}

function KV({ label, value, strong }) {
  return (
    <div style={ui.kv}>
      <div style={{ fontSize: 12, color: "#64748b" }}>{label}</div>
      <div
        style={{
          fontSize: 13,
          fontWeight: strong ? 900 : 700,
          color: "#0f172a",
        }}
      >
        {value ?? "-"}
      </div>
    </div>
  );
}

function Table({ columns, rows, onRowClick, rowKey = "id", selectedRowKey }) {
  return (
    <div style={{ width: "100%", overflowX: "auto" }}>
      <table style={ui.table}>
        <thead>
          <tr>
            {columns.map((c) => (
              <th key={c.key} style={ui.th}>
                {c.label}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows && rows.length > 0 ? (
            rows.map((r) => {
              const key = r[rowKey] ?? JSON.stringify(r);
              const selected = selectedRowKey && selectedRowKey === r[rowKey];
              return (
                <tr
                  key={key}
                  onClick={() => onRowClick && onRowClick(r)}
                  style={{
                    ...ui.tr,
                    cursor: onRowClick ? "pointer" : "default",
                    background: selected
                      ? "rgba(59,130,246,0.06)"
                      : "transparent",
                  }}
                >
                  {columns.map((c) => {
                    const raw = r[c.key];
                    const cell = c.render
                      ? c.render(r)
                      : c.format
                        ? c.format(raw)
                        : (raw ?? "-");
                    return (
                      <td key={c.key} style={ui.td}>
                        {cell}
                      </td>
                    );
                  })}
                </tr>
              );
            })
          ) : (
            <tr>
              <td
                colSpan={columns.length}
                style={{ padding: 12, color: "#64748b" }}
              >
                No data
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
}

/* ---------------- Charts (SVG, no libs) ---------------- */

function MiniBarChart({ data, height = 200, gradient = "blue" }) {
  const width = 900;
  const padX = 22;
  const padY = 26;
  const gap = 14;

  const max = Math.max(...(data.map((d) => d.value) || [0]), 0);
  const usableH = height - padY * 2;
  const bars = data.length || 1;
  const barW = Math.max(30, (width - padX * 2 - gap * (bars - 1)) / bars);

  const gId = `g_${gradient}_${Math.random().toString(16).slice(2)}`;

  const gradStops =
    gradient === "green"
      ? [
          { o: "0%", c: "#22c55e" },
          { o: "100%", c: "#16a34a" },
        ]
      : [
          { o: "0%", c: "#60a5fa" },
          { o: "100%", c: "#2563eb" },
        ];

  return (
    <svg viewBox={`0 0 ${width} ${height}`} style={{ width: "100%", height }}>
      <defs>
        <linearGradient id={gId} x1="0" y1="0" x2="0" y2="1">
          {gradStops.map((s) => (
            <stop key={s.o} offset={s.o} stopColor={s.c} />
          ))}
        </linearGradient>
      </defs>

      <rect
        x="0"
        y="0"
        width={width}
        height={height}
        rx="14"
        fill="rgba(2,6,23,0.03)"
      />
      <line
        x1={padX}
        y1={height - padY}
        x2={width - padX}
        y2={height - padY}
        stroke="rgba(100,116,139,0.35)"
      />

      {data.map((d, i) => {
        const x = padX + i * (barW + gap);
        const h = max > 0 ? (d.value / max) * usableH : 0;
        const y = height - padY - h;

        return (
          <g key={`${d.label}-${i}`}>
            <rect
              x={x}
              y={y}
              width={barW}
              height={h}
              rx="12"
              fill={`url(#${gId})`}
              opacity="0.92"
            />
            <text
              x={x + barW / 2}
              y={height - 8}
              textAnchor="middle"
              fontSize="12"
              fill="#334155"
            >
              {d.label}
            </text>
          </g>
        );
      })}
    </svg>
  );
}

function LineChart({ data, height = 220, gradient = "blue" }) {
  const width = 900;
  const padX = 34;
  const padY = 26;

  const max = Math.max(...(data.map((d) => d.value) || [0]), 0);
  const min = Math.min(...(data.map((d) => d.value) || [0]), 0);

  const usableW = width - padX * 2;
  const usableH = height - padY * 2;
  const n = Math.max(data.length, 1);

  const xFor = (i) => padX + (n === 1 ? 0 : (i / (n - 1)) * usableW);
  const yFor = (v) => {
    if (max === min) return height / 2;
    const t = (v - min) / (max - min);
    return height - padY - t * usableH;
  };

  const gId = `lg_${gradient}_${Math.random().toString(16).slice(2)}`;
  const stroke = gradient === "green" ? "#16a34a" : "#2563eb";
  const fillTop =
    gradient === "green" ? "rgba(34,197,94,0.20)" : "rgba(59,130,246,0.18)";

  const points = data.map((d, i) => ({
    x: xFor(i),
    y: yFor(d.value),
    label: d.label,
    value: d.value,
  }));

  const pathD = points
    .map((p, i) => `${i === 0 ? "M" : "L"} ${p.x.toFixed(2)} ${p.y.toFixed(2)}`)
    .join(" ");

  const areaD =
    points.length > 0
      ? `${pathD} L ${points[points.length - 1].x.toFixed(2)} ${(height - padY).toFixed(2)} L ${points[0].x.toFixed(2)} ${(height - padY).toFixed(2)} Z`
      : "";

  return (
    <svg viewBox={`0 0 ${width} ${height}`} style={{ width: "100%", height }}>
      <defs>
        <linearGradient id={gId} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={fillTop} />
          <stop offset="100%" stopColor="rgba(255,255,255,0)" />
        </linearGradient>
      </defs>

      <rect
        x="0"
        y="0"
        width={width}
        height={height}
        rx="14"
        fill="rgba(2,6,23,0.03)"
      />

      <line
        x1={padX}
        y1={height - padY}
        x2={width - padX}
        y2={height - padY}
        stroke="rgba(100,116,139,0.35)"
      />
      <line
        x1={padX}
        y1={padY}
        x2={padX}
        y2={height - padY}
        stroke="rgba(100,116,139,0.18)"
      />

      {areaD && <path d={areaD} fill={`url(#${gId})`} />}

      <path
        d={pathD}
        fill="none"
        stroke={stroke}
        strokeWidth="3"
        strokeLinejoin="round"
        strokeLinecap="round"
      />

      {points.map((p, i) => (
        <g key={`${p.label}-${i}`}>
          <circle
            cx={p.x}
            cy={p.y}
            r="5.5"
            fill="#ffffff"
            stroke={stroke}
            strokeWidth="2"
          />
          <text
            x={p.x}
            y={height - 8}
            textAnchor="middle"
            fontSize="12"
            fill="#334155"
          >
            {p.label}
          </text>
        </g>
      ))}
    </svg>
  );
}

/* ---------------- Helpers ---------------- */

function fmtNum(n) {
  const x = Number(n);
  if (!Number.isFinite(x)) return "-";
  return x.toLocaleString(undefined, { maximumFractionDigits: 2 });
}

function fmtMoney(n) {
  const x = Number(n);
  if (!Number.isFinite(x)) return "-";
  return x.toLocaleString(undefined, { style: "currency", currency: "USD" });
}

function fmtDate(iso) {
  if (!iso) return "-";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return String(iso);
  return d.toLocaleString();
}

function shortId(id) {
  if (!id) return "-";
  const s = String(id);
  if (s.length <= 10) return s;
  return `${s.slice(0, 6)}...${s.slice(-4)}`;
}

/* ---------------- Styles (no CSS file needed) ---------------- */

const ui = {
  page: {
    minHeight: "100vh",
    width: "100%",
    margin: 0,
    padding: 0,
    boxSizing: "border-box",
    fontFamily:
      "ui-sans-serif, system-ui, -apple-system, Segoe UI, Roboto, Arial",
    color: "#0f172a",
    background:
      "radial-gradient(900px 500px at 10% 0%, rgba(59,130,246,0.22), transparent 55%)," +
      "radial-gradient(900px 500px at 90% 10%, rgba(168,85,247,0.18), transparent 55%)," +
      "linear-gradient(180deg, #f8fafc 0%, #eef2ff 40%, #f1f5f9 100%)",
  },

  header: {
    padding: "18px 20px",
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12,
  },

  brand: { display: "flex", alignItems: "center", gap: 12 },
  logo: {
    width: 44,
    height: 44,
    borderRadius: 14,
    display: "grid",
    placeItems: "center",
    background: "rgba(37,99,235,0.10)",
    border: "1px solid rgba(37,99,235,0.20)",
    boxShadow: "0 16px 30px rgba(15,23,42,0.10)",
    fontSize: 18,
  },
  title: { fontSize: 18, fontWeight: 950 },
  subTitle: { fontSize: 12, color: "#475569", marginTop: 2 },

  headerRight: { display: "flex", gap: 10, flexWrap: "wrap" },
  chip: {
    padding: "8px 12px",
    borderRadius: 999,
    border: "1px solid rgba(100,116,139,0.20)",
    background: "rgba(255,255,255,0.70)",
    fontSize: 12,
    color: "#0f172a",
  },
  chipAccent: {
    border: "1px solid rgba(34,197,94,0.25)",
    background: "rgba(34,197,94,0.10)",
  },

  content: { padding: "0 20px 20px 20px", boxSizing: "border-box" },

  panel: {
    borderRadius: 18,
    border: "1px solid rgba(100,116,139,0.18)",
    background: "rgba(255,255,255,0.75)",
    boxShadow: "0 18px 40px rgba(15,23,42,0.10)",
    padding: 14,
  },

  panelGrid: {
    display: "grid",
    gridTemplateColumns: "repeat(12, 1fr)",
    gap: 12,
  },

  field: { display: "flex", flexDirection: "column", gap: 6, minWidth: 0 },
  label: { fontSize: 12, color: "#475569", fontWeight: 800 },
  helper: { fontSize: 12, color: "#64748b" },

  select: {
    width: "100%",
    padding: "10px 12px",
    borderRadius: 14,
    border: "1px solid rgba(100,116,139,0.22)",
    background: "#ffffff",
    color: "#0f172a",
    outline: "none",
  },

  input: {
    width: "100%",
    padding: "10px 12px",
    borderRadius: 14,
    border: "1px solid rgba(100,116,139,0.22)",
    background: "#ffffff",
    color: "#0f172a",
    outline: "none",
  },

  actions: { display: "flex", gap: 10, flexWrap: "wrap" },

  btn: {
    borderRadius: 14,
    padding: "10px 12px",
    border: "1px solid rgba(100,116,139,0.18)",
    background: "rgba(255,255,255,0.75)",
    color: "#0f172a",
    cursor: "pointer",
    fontWeight: 900,
    boxShadow: "0 14px 26px rgba(15,23,42,0.10)",
  },

  grid: {
    marginTop: 14,
    display: "grid",
    gridTemplateColumns: "minmax(0, 2fr) minmax(0, 1fr)",
    gap: 14,
  },

  leftCol: { display: "flex", flexDirection: "column", gap: 14, minWidth: 0 },
  rightCol: { minWidth: 0 },

  stats: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
    gap: 12,
  },

  stat: {
    borderRadius: 18,
    padding: 14,
    border: "1px solid rgba(100,116,139,0.18)",
    background: "rgba(255,255,255,0.78)",
    boxShadow: "0 16px 30px rgba(15,23,42,0.08)",
  },
  statTop: { display: "flex", alignItems: "center", gap: 10, marginBottom: 8 },
  statIcon: {
    width: 36,
    height: 36,
    borderRadius: 14,
    display: "grid",
    placeItems: "center",
    border: "1px solid rgba(100,116,139,0.15)",
  },
  statLabel: { fontSize: 12, fontWeight: 900, color: "#475569" },
  statValue: { fontSize: 20, fontWeight: 950, color: "#0f172a" },

  cards2: {
    display: "grid",
    gridTemplateColumns: "repeat(2, minmax(0, 1fr))",
    gap: 14,
  },

  card: {
    borderRadius: 18,
    border: "1px solid rgba(100,116,139,0.18)",
    background: "rgba(255,255,255,0.78)",
    padding: 14,
    boxShadow: "0 18px 40px rgba(15,23,42,0.10)",
  },

  stickyCard: {
    position: "sticky",
    top: 14,
    borderRadius: 18,
    border: "1px solid rgba(100,116,139,0.18)",
    background: "rgba(255,255,255,0.82)",
    padding: 14,
    boxShadow: "0 18px 40px rgba(15,23,42,0.10)",
  },

  detail: {
    borderRadius: 16,
    border: "1px solid rgba(100,116,139,0.15)",
    background: "rgba(248,250,252,0.80)",
    padding: 12,
  },

  kv: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "baseline",
    gap: 12,
    padding: "6px 0",
  },

  table: { width: "100%", minWidth: 720, borderCollapse: "collapse" },
  th: {
    textAlign: "left",
    fontSize: 12,
    padding: "10px 10px",
    color: "#64748b",
    borderBottom: "1px solid rgba(100,116,139,0.18)",
  },
  tr: { borderBottom: "1px solid rgba(100,116,139,0.10)" },
  td: { padding: "10px 10px", fontSize: 13, color: "#0f172a" },

  toggle: {
    width: "fit-content",
    display: "flex",
    alignItems: "center",
    padding: "8px 10px",
    borderRadius: 999,
    border: "1px solid rgba(100,116,139,0.25)",
    cursor: "pointer",
    background: "rgba(100,116,139,0.08)",
  },
  toggleDot: {
    width: 18,
    height: 18,
    borderRadius: 999,
    transition: "transform 120ms ease",
  },
};

const toneStyles = {
  primary: {
    border: "1px solid rgba(37,99,235,0.25)",
    background: "rgba(37,99,235,0.10)",
  },
  accent: {
    border: "1px solid rgba(168,85,247,0.25)",
    background: "rgba(168,85,247,0.10)",
  },
  ghost: {
    border: "1px solid rgba(100,116,139,0.18)",
    background: "rgba(255,255,255,0.75)",
  },
};

const statTones = {
  blue: {
    border: "rgba(37,99,235,0.20)",
    iconBg: "rgba(37,99,235,0.10)",
    iconFg: "#1d4ed8",
  },
  violet: {
    border: "rgba(168,85,247,0.20)",
    iconBg: "rgba(168,85,247,0.10)",
    iconFg: "#7c3aed",
  },
  green: {
    border: "rgba(34,197,94,0.20)",
    iconBg: "rgba(34,197,94,0.10)",
    iconFg: "#15803d",
  },
  orange: {
    border: "rgba(249,115,22,0.20)",
    iconBg: "rgba(249,115,22,0.10)",
    iconFg: "#c2410c",
  },
  pink: {
    border: "rgba(236,72,153,0.20)",
    iconBg: "rgba(236,72,153,0.10)",
    iconFg: "#be185d",
  },
  red: {
    border: "rgba(239,68,68,0.20)",
    iconBg: "rgba(239,68,68,0.10)",
    iconFg: "#b91c1c",
  },
};
