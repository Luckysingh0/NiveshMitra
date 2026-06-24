import React, { useEffect, useState } from "react";
import {
  PieChart,
  Pie,
  Cell,
  ResponsiveContainer,
  Tooltip,
  Legend,
} from "recharts";

const COLORS = [
  "#8ab4f8",
  "#81c995",
  "#fdd663",
  "#9b72cb",
  "#f28b82",
  "#78d9ec",
];

// Rough long-term annual return assumptions per asset class (educational only).
function assetAnnualReturn(asset = "") {
  const a = asset.toLowerCase();
  if (a.includes("small")) return 0.14;
  if (a.includes("mid")) return 0.13;
  if (a.includes("flexi") || a.includes("multi")) return 0.12;
  if (a.includes("international") || a.includes("us ") || a.includes("global"))
    return 0.12;
  if (a.includes("large") || a.includes("index") || a.includes("equity"))
    return 0.11;
  if (a.includes("reit") || a.includes("real")) return 0.09;
  if (a.includes("gold")) return 0.08;
  if (a.includes("debt") || a.includes("bond") || a.includes("fixed"))
    return 0.07;
  if (a.includes("liquid") || a.includes("cash")) return 0.055;
  return 0.1;
}

// Future value of a monthly SIP compounded monthly.
function sipFutureValue(monthly, annualRate, years) {
  const r = annualRate / 12;
  const n = years * 12;
  if (monthly <= 0 || n <= 0) return 0;
  return monthly * (((Math.pow(1 + r, n) - 1) / r) * (1 + r));
}

const inr = (n) => "₹" + Math.round(n || 0).toLocaleString("en-IN");
const compact = (n) => {
  const v = Math.round(n || 0);
  if (v >= 1e7) return "₹" + (v / 1e7).toFixed(2) + " Cr";
  if (v >= 1e5) return "₹" + (v / 1e5).toFixed(2) + " L";
  return inr(v);
};

export default function PlanDashboard({ plan, profile }) {
  const horizon = Number(profile?.horizonYears) || 10;
  const baseSIP = Number(plan?.monthlySIP) || 10000;

  // Editable per-asset monthly amounts so the user can simulate "what if".
  const [amounts, setAmounts] = useState({});

  useEffect(() => {
    if (!plan?.allocation) return;
    const init = {};
    for (const a of plan.allocation) {
      init[a.asset] = Math.round((baseSIP * a.percent) / 100);
    }
    setAmounts(init);
  }, [plan?.templateId, baseSIP]);

  if (!plan) {
    return (
      <div className="dash empty">
        <h3>Your plan appears here</h3>
        <p>
          Chat with NiveshMitra about your goals, horizon, income and how you
          feel about market dips. Once we know enough, a personalized plan is
          generated automatically.
        </p>
        {profile && <ProfileProgress profile={profile} />}
      </div>
    );
  }

  const pieData = plan.allocation.map((a) => ({
    name: a.asset,
    value: a.percent,
  }));

  const totalMonthly = plan.allocation.reduce(
    (s, a) => s + (amounts[a.asset] || 0),
    0,
  );
  const totalCorpus = plan.allocation.reduce(
    (s, a) =>
      s +
      sipFutureValue(
        amounts[a.asset] || 0,
        assetAnnualReturn(a.asset),
        horizon,
      ),
    0,
  );
  const totalInvested = totalMonthly * horizon * 12;

  function resetAmounts() {
    const init = {};
    for (const a of plan.allocation) {
      init[a.asset] = Math.round((baseSIP * a.percent) / 100);
    }
    setAmounts(init);
  }

  return (
    <div className="dash">
      <div className="plan-header">
        <span className="cat-pill">
          {plan.riskCategory || profile?.riskCategory}
        </span>
        <h2>{plan.templateName}</h2>
        <p className="tagline">{plan.tagline}</p>
        <div className="plan-stats">
          <Stat
            label="Risk score"
            value={plan.riskScore ?? profile?.riskScore ?? "—"}
          />
          <Stat label="Target return" value={plan.expectedReturn} />
          <Stat
            label="Monthly SIP"
            value={
              plan.monthlySIP
                ? `₹${plan.monthlySIP.toLocaleString("en-IN")}`
                : "—"
            }
          />
        </div>
      </div>

      <div className="chart-wrap">
        <ResponsiveContainer width="100%" height={240}>
          <PieChart>
            <Pie
              data={pieData}
              dataKey="value"
              nameKey="name"
              outerRadius={90}
              innerRadius={45}
              paddingAngle={2}
              label={(d) => `${d.value}%`}
            >
              {pieData.map((_, i) => (
                <Cell key={i} fill={COLORS[i % COLORS.length]} />
              ))}
            </Pie>
            <Tooltip />
            <Legend />
          </PieChart>
        </ResponsiveContainer>
      </div>

      <div className="sim-head">
        <h3 className="ms-title">Adjust & simulate</h3>
        <button className="ghost tiny" onClick={resetAmounts}>
          Reset
        </button>
      </div>
      <p className="sim-sub">
        Drag a sector to see how its monthly amount could grow over {horizon}{" "}
        years.
      </p>

      <div className="alloc-list">
        {plan.allocation.map((a, i) => {
          const amt = amounts[a.asset] || 0;
          const rate = assetAnnualReturn(a.asset);
          const fv = sipFutureValue(amt, rate, horizon);
          const sliderMax = Math.max(
            baseSIP,
            Math.round((baseSIP * a.percent) / 100) * 3,
            5000,
          );
          return (
            <div className="alloc-item" key={a.asset}>
              <div className="alloc-top">
                <span
                  className="dot"
                  style={{ background: COLORS[i % COLORS.length] }}
                />
                <strong>{a.asset}</strong>
                <span className="pct">{a.percent}%</span>
              </div>
              <div className="examples">{a.examples.join(" · ")}</div>

              <input
                type="range"
                className="alloc-slider"
                min={0}
                max={sliderMax}
                step={500}
                value={amt}
                style={{ accentColor: COLORS[i % COLORS.length] }}
                onChange={(e) =>
                  setAmounts((m) => ({
                    ...m,
                    [a.asset]: Number(e.target.value),
                  }))
                }
              />
              <div className="alloc-proj">
                <span className="proj-amt">{inr(amt)}/mo</span>
                <span className="proj-arrow">→</span>
                <span className="proj-fv">{compact(fv)}</span>
                <span className="proj-rate">
                  @ {(rate * 100).toFixed(1)}% p.a.
                </span>
              </div>
            </div>
          );
        })}
      </div>

      <div className="sim-total">
        <div>
          <div className="stat-label">Total / month</div>
          <div className="sim-total-val">{inr(totalMonthly)}</div>
        </div>
        <div>
          <div className="stat-label">You invest</div>
          <div className="sim-total-val">{compact(totalInvested)}</div>
        </div>
        <div>
          <div className="stat-label">Projected in {horizon} yrs</div>
          <div className="sim-total-val accent">{compact(totalCorpus)}</div>
        </div>
      </div>
      <p className="sim-note">
        Estimates use assumed long-term average returns and are not guaranteed.
      </p>

      <h3 className="ms-title">Milestones</h3>
      <ul className="milestones">
        {plan.milestones.map((m, i) => (
          <li key={i}>
            <span className="ms-dot" />
            <div>
              <div>{m.label}</div>
              {m.targetYear && <small>by {m.targetYear}</small>}
            </div>
          </li>
        ))}
      </ul>

      <p className="disclaimer">{plan.disclaimer}</p>
    </div>
  );
}

function Stat({ label, value }) {
  return (
    <div className="stat">
      <div className="stat-value">{value}</div>
      <div className="stat-label">{label}</div>
    </div>
  );
}

function ProfileProgress({ profile }) {
  const items = [
    ["Goals", (profile.goals || []).length ? profile.goals.join(", ") : null],
    ["Horizon", profile.horizonYears ? `${profile.horizonYears} yrs` : null],
    [
      "Monthly income",
      profile.monthlyIncome ? `₹${profile.monthlyIncome}` : null,
    ],
    [
      "Investable / mo",
      profile.monthlyInvestable ? `₹${profile.monthlyInvestable}` : null,
    ],
    ["Fear tolerance", profile.fearTolerance],
  ];
  const done = items.filter(([, v]) => v).length;
  return (
    <div className="progress">
      <div className="progress-bar">
        <div
          className="progress-fill"
          style={{ width: `${(done / items.length) * 100}%` }}
        />
      </div>
      <ul className="progress-list">
        {items.map(([k, v]) => (
          <li key={k} className={v ? "ok" : ""}>
            <span>{v ? "✓" : "○"}</span> {k}
            {v && <em>{v}</em>}
          </li>
        ))}
      </ul>
    </div>
  );
}
