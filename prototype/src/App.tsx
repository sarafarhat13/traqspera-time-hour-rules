import { useState, useEffect, useRef, useCallback, type CSSProperties, type ReactNode } from "react";
import { toast, Toaster } from "sonner";
import {
  ModusWcAlert,
  ModusWcBadge,
  ModusWcButton,
  ModusWcCheckbox,
  ModusWcSwitch,
  ModusWcTabs,
} from "@trimble-oss/moduswebcomponents-react";
import {
  AlertTriangle, ChevronDown, ChevronUp, X, Check,
  GripVertical, Plus, Pencil, Info, Trash2,
  Clock, Filter, User, Users, Briefcase, CreditCard,
  BarChart2, Wrench, FileText, Settings, Shield,
  AlignJustify, ChevronRight, Bell, HelpCircle, Search,
} from "lucide-react";

// ─── Autosave hook ───────────────────────────────────────────────────────────
function useAutosave(onSave: () => void, delay = 800) {
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  return useCallback(() => {
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(onSave, delay);
  }, [onSave, delay]);
}

// ─── Types ────────────────────────────────────────────────────────────────────
type ActiveTab = "hour" | "exclusions";
type ScheduleType = "relative" | "fixed";
type FreeMealTrigger = "always" | "exceeding" | "before_threshold";

type DayRow = {
  label: string;
  totalHours: number;
  regHours: number;
  otHours: number;
  ot2Hours: number;
  travelHours: number;
};

type RuleSetData = {
  days: DayRow[];
  weeklyTotal: number;
  weeklyReg: number;
  weeklyOT: number;
  weeklyTravel: number;
  breakMinHours: number;
  breakLength: number;
  breakAction: "flag" | "auto";
  flag24thDay: boolean;
};

// ─── Default data ──────────────────────────────────────────────────────────────
const defaultDays = (): DayRow[] => [
  { label: "Mon – Thur", totalHours: 0, regHours: 8, otHours: 2, ot2Hours: 0, travelHours: 1 },
  { label: "Friday",     totalHours: 0, regHours: 8, otHours: 2, ot2Hours: 0, travelHours: 1 },
  { label: "Saturday",   totalHours: 0, regHours: 6, otHours: 2, ot2Hours: 0, travelHours: 1 },
  { label: "Sunday",     totalHours: 0, regHours: 0, otHours: 4, ot2Hours: 2, travelHours: 1 },
  { label: "7th Consecutive Day", totalHours: 0, regHours: 0, otHours: 0, ot2Hours: 8, travelHours: 1 },
];

const defaultRuleSet = (): RuleSetData => ({
  days: defaultDays(),
  weeklyTotal: 40, weeklyReg: 10, weeklyOT: 1, weeklyTravel: 2,
  breakMinHours: 1, breakLength: 0.5, breakAction: "flag", flag24thDay: true,
});

// ─── Shared Primitives (Modus) ────────────────────────────────────────────────
function Toggle({ enabled, onChange }: { enabled: boolean; onChange: (v: boolean) => void }) {
  return (
    <ModusWcSwitch
      aria-label="Toggle"
      size="sm"
      value={enabled}
      onInputChange={(e) => {
        const next = Boolean((e as CustomEvent<{ target?: { value?: boolean } }>).detail?.target?.value ?? !enabled);
        onChange(next);
      }}
    />
  );
}

function NumberInput({ value, onChange, step = 0.5, min = 0, suffix, width = 64 }: {
  value: number; onChange: (v: number) => void;
  step?: number; min?: number; suffix?: string; width?: number;
}) {
  return (
    <div className="flex items-center gap-[6px]">
      <div
        className="flex items-center rounded-[4px] bg-white"
        style={{ border: "1px solid #6a6e79" }}
      >
        <input type="text" inputMode="decimal" value={value} min={min}
          onChange={(e) => { const v = parseFloat(e.target.value); if (!isNaN(v)) onChange(v); }}
          className="rounded-l-[4px] px-[8px] py-[5px] text-[12px] font-['Open_Sans',sans-serif] text-[#252a2e] outline-none bg-transparent"
          style={{ width, border: "none" }} />
        <div className="flex flex-col" style={{ borderLeft: "1px solid #6a6e79" }}>
          <button type="button" onClick={() => onChange(Math.round((value + step) * 10) / 10)}
            className="flex h-[14px] w-[20px] items-center justify-center hover:bg-[#dcedf9] transition-colors rounded-tr-[3px]"
            style={{ border: "none", background: "transparent", padding: 0, cursor: "pointer" }}>
            <ChevronUp size={10} className="text-[#464b52]" />
          </button>
          <button type="button" onClick={() => onChange(Math.max(min, Math.round((value - step) * 10) / 10))}
            className="flex h-[14px] w-[20px] items-center justify-center hover:bg-[#dcedf9] transition-colors rounded-br-[3px]"
            style={{ border: "none", borderTop: "1px solid #6a6e79", background: "transparent", padding: 0, cursor: "pointer" }}>
            <ChevronDown size={10} className="text-[#464b52]" />
          </button>
        </div>
      </div>
      {suffix && <span className="text-[12px] text-[#6a6e79] font-['Open_Sans',sans-serif]">{suffix}</span>}
    </div>
  );
}

function SelectField({ value, onChange, options, placeholder }: {
  value: string; onChange: (v: string) => void;
  options: { value: string; label: string }[]; placeholder?: string;
}) {
  return (
    <div className="relative">
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="appearance-none rounded-[4px] bg-white px-[8px] pr-[28px] py-[5px] text-[12px] font-['Open_Sans',sans-serif] text-[#464b52] outline-none cursor-pointer w-full"
        style={{ border: "1px solid #6a6e79" }}
      >
        {placeholder && <option value="">{placeholder}</option>}
        {options.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
      </select>
      <ChevronDown size={12} className="pointer-events-none absolute right-[8px] top-1/2 -translate-y-1/2 text-[#464b52]" />
    </div>
  );
}

function Checkbox({ checked, onChange, label }: { checked: boolean; onChange: (v: boolean) => void; label: string }) {
  return (
    <ModusWcCheckbox
      aria-label={label}
      label={label}
      size="sm"
      value={checked}
      onInputChange={(e) => {
        const next = Boolean((e as CustomEvent<{ target?: { value?: boolean } }>).detail?.target?.value ?? !checked);
        onChange(next);
      }}
    />
  );
}

function FieldLabel({ children }: { children: ReactNode }) {
  return <p className="text-[12px] font-semibold font-['Open_Sans',sans-serif] text-[#252a2e] mb-[4px]">{children}</p>;
}

function SectionLabel({ children }: { children: ReactNode }) {
  return <p className="text-[11px] font-semibold font-['Open_Sans',sans-serif] text-[#6a6e79] uppercase tracking-[0.08em] mb-[8px]">{children}</p>;
}

// Blue section divider header (matches screenshot navy bars)
function SectionDivider({ children }: { children: ReactNode }) {
  return (
    <div className="bg-[#0e416c] px-[20px] py-[10px] rounded-t-[6px]">
      <h2 className="text-[13px] font-bold font-['Open_Sans',sans-serif] text-white">{children}</h2>
    </div>
  );
}

// White panel body below a SectionDivider
function SectionBody({ children, rounded = "bottom" }: { children: ReactNode; rounded?: "bottom" | "all" }) {
  return (
    <div
      className={`${rounded === "bottom" ? "rounded-b-[6px]" : "rounded-[6px]"}`}
      style={{
        background: "#ffffff",
        border: "1px solid #e0e1e9",
        borderTop: "none",
        boxShadow: "0 1px 3px rgba(0,0,0,0.06)",
        overflow: "hidden",
      }}
    >
      {children}
    </div>
  );
}

// Generic white card shell (for sub-sections inside a SectionBody)
function SubCard({ title, action, children }: { title: string; action?: ReactNode; children: ReactNode }) {
  return (
    <div className="border-t border-[#f0f0f4] first:border-t-0">
      <div className="flex items-center justify-between px-[20px] py-[10px] bg-[#fafafa]">
        <span className="text-[12px] font-bold font-['Open_Sans',sans-serif] text-[#464b52] uppercase tracking-[0.06em]">{title}</span>
        {action}
      </div>
      <div className="px-[20px] pb-[16px] pt-[4px]">{children}</div>
    </div>
  );
}

// ─── Small number input for table cells ───────────────────────────────────────
function CellInput({ value, onChange }: { value: number; onChange: (v: number) => void }) {
  return (
    <input
      type="number"
      value={value || ""}
      min={0}
      placeholder="—"
      onChange={(e) => onChange(parseFloat(e.target.value) || 0)}
      style={{
        width: 52,
        borderRadius: 3,
        border: "1px solid #e0e1e9",
        background: "#ffffff",
        padding: "4px 6px",
        fontSize: 12,
        fontFamily: "Open Sans, sans-serif",
        color: "#252a2e",
        outline: "none",
        textAlign: "center",
      }}
    />
  );
}

const TABLE_HEADER_BG = "#f1f1f6";
const TABLE_HEADER_BORDER = "#e0e1e9";
const TABLE_HEADER_TEXT = "#464b52";

// ─── Folder-style tabs for rule-set sections ──────────────────────────────────
function InnerTabBar<T extends string>({ tabs, active, onChange }: {
  tabs: { key: T; label: string }[];
  active: T;
  onChange: (t: T) => void;
}) {
  return (
    <div
      role="tablist"
      style={{
        display: "flex",
        alignItems: "flex-end",
        gap: 4,
        background: "#f1f1f6",
        borderBottom: "1px solid #d0d1d9",
        padding: "8px 16px 0",
      }}
    >
      {tabs.map((t) => {
        const isActive = t.key === active;
        return (
          <button
            key={t.key}
            type="button"
            role="tab"
            aria-selected={isActive}
            onClick={() => onChange(t.key)}
            style={{
              all: "unset",
              boxSizing: "border-box",
              display: "inline-flex",
              alignItems: "center",
              justifyContent: "center",
              position: "relative",
              zIndex: isActive ? 2 : 1,
              minHeight: 34,
              padding: "8px 16px",
              marginBottom: isActive ? -1 : 0,
              fontFamily: "Open Sans, sans-serif",
              fontSize: 13,
              fontWeight: isActive ? 600 : 500,
              lineHeight: 1.2,
              whiteSpace: "nowrap",
              cursor: "pointer",
              color: isActive ? "#0e416c" : "#6a6e79",
              background: isActive ? "#ffffff" : "#e8e9ef",
              borderTop: isActive ? "1px solid #d0d1d9" : "1px solid #d8d9e0",
              borderLeft: isActive ? "1px solid #d0d1d9" : "1px solid #d8d9e0",
              borderRight: isActive ? "1px solid #d0d1d9" : "1px solid #d8d9e0",
              borderBottom: isActive ? "1px solid #ffffff" : "1px solid transparent",
              borderRadius: "6px 6px 0 0",
              boxShadow: isActive ? "none" : "inset 0 -1px 0 rgba(0,0,0,0.04)",
            }}
          >
            {t.label}
          </button>
        );
      })}
    </div>
  );
}


// ─── Reusable tabbed rule-set container ───────────────────────────────────────
type RuleSetTab = "daily" | "weekly" | "break" | "kiosk" | "equipment" | "meal" | "penalties";

function RuleSetForm({
  data,
  onChange,
  showKiosk = false,
  showEquipment = false,
  kioskMinHours,
  onKioskMinHours,
  kioskBreakLength,
  onKioskBreakLength,
  equipMaxHours,
  onEquipMaxHours,
  descriptionText,
  mealPenaltyState,
  onMealPenaltyChange,
}: {
  data: RuleSetData;
  onChange: (next: RuleSetData) => void;
  showKiosk?: boolean;
  showEquipment?: boolean;
  kioskMinHours?: number;
  onKioskMinHours?: (v: number) => void;
  kioskBreakLength?: number;
  onKioskBreakLength?: (v: number) => void;
  equipMaxHours?: number;
  onEquipMaxHours?: (v: number) => void;
  descriptionText?: string;
  mealPenaltyState: MealPenaltyState;
  onMealPenaltyChange: (next: MealPenaltyState) => void;
}) {
  const [activeTab, setActiveTab] = useState<RuleSetTab>("daily");
  const [previewOpen, setPreviewOpen] = useState(false);

  const updateDay = (idx: number, field: keyof DayRow, val: number) => {
    const days = data.days.map((d, i) => i === idx ? { ...d, [field]: val } : d);
    onChange({ ...data, days });
  };

  const mp = mealPenaltyState;
  const setMp = <K extends keyof MealPenaltyState>(key: K, val: MealPenaltyState[K]) =>
    onMealPenaltyChange({ ...mp, [key]: val });

  const colHeaders = [
    { key: "totalHours",  label: "Total Hours\nAllowed" },
    { key: "regHours",    label: "Reg Hours\nAllowed" },
    { key: "otHours",     label: "OT Hours\nAllowed" },
    { key: "ot2Hours",    label: "OT² Hours\nAllowed" },
    { key: "travelHours", label: "Travel Hours\nAllowed" },
  ] as const;

  const allTabs: { key: RuleSetTab; label: string; show: boolean }[] = [
    { key: "daily",     label: "Daily & Weekly Rules", show: true },
    { key: "break",     label: "Break Rules",    show: true },
    { key: "kiosk",     label: "Kiosk Break",    show: !!showKiosk },
    { key: "equipment", label: "Equipment",      show: !!showEquipment },
    { key: "meal",      label: "Meal Periods",   show: true },
    { key: "penalties", label: "Premiums", show: true },
  ];
  const visibleTabs = allTabs.filter((t) => t.show);

  return (
    <>
      {descriptionText && (
        <div className="px-[20px] pt-[14px] pb-[10px]">
          <p className="text-[12px] font-['Open_Sans',sans-serif] text-[#464b52] leading-[18px]">{descriptionText}</p>
        </div>
      )}

      <div style={{ padding: "0", background: "#ffffff" }}>
        <InnerTabBar
          tabs={visibleTabs}
          active={activeTab}
          onChange={setActiveTab}
        />
      </div>

      <div style={{ padding: "20px", background: "#f5f5f8" }}>

        {/* ── Daily Rules ── */}
        {activeTab === "daily" && (
          <>
            <div className="overflow-x-auto">
              <table className="w-full border-collapse" style={{ border: `1px solid ${TABLE_HEADER_BORDER}`, borderRadius: 4, overflow: "hidden" }}>
                <thead>
                  <tr style={{ background: TABLE_HEADER_BG }}>
                    <th style={{ padding: "10px 12px", textAlign: "left", fontSize: 11, fontWeight: 600, fontFamily: "Open Sans, sans-serif", color: TABLE_HEADER_TEXT, width: 150, borderBottom: `1px solid ${TABLE_HEADER_BORDER}` }} />
                    {colHeaders.map((col) => (
                      <th key={col.key} style={{
                        padding: "10px 8px",
                        fontSize: 11,
                        fontWeight: 600,
                        fontFamily: "Open Sans, sans-serif",
                        color: TABLE_HEADER_TEXT,
                        textAlign: "center",
                        whiteSpace: "pre-line",
                        lineHeight: "13px",
                        borderBottom: `1px solid ${TABLE_HEADER_BORDER}`,
                        borderLeft: `1px solid ${TABLE_HEADER_BORDER}`,
                      }}>
                        {col.label}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {data.days.map((day, idx) => (
                    <tr key={day.label} style={{ background: idx % 2 === 0 ? "#ffffff" : "#fafafa", borderBottom: `1px solid ${TABLE_HEADER_BORDER}` }}>
                      <td style={{ padding: "6px 12px", fontSize: 12, fontWeight: 600, fontFamily: "Open Sans, sans-serif", color: "#252a2e", whiteSpace: "nowrap", borderRight: `1px solid ${TABLE_HEADER_BORDER}` }}>{day.label}</td>
                      {colHeaders.map((col) => (
                        <td key={col.key} style={{ padding: "4px 6px", textAlign: "center", borderRight: `1px solid ${TABLE_HEADER_BORDER}` }}>
                          <CellInput value={day[col.key]} onChange={(v) => updateDay(idx, col.key, v)} />
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <button type="button" onClick={() => onChange({ ...data, flag24thDay: !data.flag24thDay })}
              className="mt-[10px] flex items-center gap-[6px] cursor-pointer"
              style={{ background: "transparent", border: "none", padding: 0 }}>
              <div className="h-[14px] w-[14px] rounded-[2px] flex items-center justify-center shrink-0"
                style={{
                  background: data.flag24thDay ? "#006fb0" : "#ffffff",
                  border: `1px solid ${data.flag24thDay ? "#006fb0" : "#cbced4"}`,
                }}>
                {data.flag24thDay && <Check size={9} className="text-white" strokeWidth={3} />}
              </div>
              <span className="text-[11px] font-['Open_Sans',sans-serif] text-[#464b52]">Flag 24th Consecutive Day</span>
            </button>

            {/* ── Weekly Rules ── */}
            <div className="mt-[24px]">
              <p className="text-[13px] font-semibold font-['Open_Sans',sans-serif] text-[#252a2e] mb-[10px]">Weekly Rules</p>
              <div className="overflow-x-auto">
                <table className="w-full border-collapse" style={{ border: `1px solid ${TABLE_HEADER_BORDER}`, borderRadius: 4, overflow: "hidden" }}>
                  <thead>
                    <tr style={{ background: TABLE_HEADER_BG }}>
                      {["Total Hours Per Week", "Reg Hours Per Week", "OT Hours Per Week", "Travel Hours Per Week"].map((h, i) => (
                        <th key={h} style={{
                          padding: "10px 12px",
                          fontSize: 11,
                          fontWeight: 600,
                          fontFamily: "Open Sans, sans-serif",
                          color: TABLE_HEADER_TEXT,
                          textAlign: "center",
                          borderBottom: `1px solid ${TABLE_HEADER_BORDER}`,
                          borderLeft: i > 0 ? `1px solid ${TABLE_HEADER_BORDER}` : undefined,
                        }}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    <tr style={{ background: "#ffffff", borderBottom: `1px solid ${TABLE_HEADER_BORDER}` }}>
                      {(["weeklyTotal", "weeklyReg", "weeklyOT", "weeklyTravel"] as const).map((field, i) => (
                        <td key={field} style={{ padding: "6px 8px", textAlign: "center", borderRight: i < 3 ? `1px solid ${TABLE_HEADER_BORDER}` : undefined }}>
                          <CellInput value={data[field]} onChange={(v) => onChange({ ...data, [field]: v })} />
                        </td>
                      ))}
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>
          </>
        )}



        {/* ── Break Rules ── */}
        {activeTab === "break" && (
          <>
            <div className="grid grid-cols-2 gap-[20px] mb-[20px]">
              <div>
                <FieldLabel>Minimum Hours Per Day</FieldLabel>
                <p className="text-[11px] font-['Open_Sans',sans-serif] text-[#6a6e79] mb-[6px]">Break is required once this threshold is reached</p>
                <NumberInput value={data.breakMinHours} onChange={(v) => onChange({ ...data, breakMinHours: v })} step={0.5} min={0} suffix="hrs" width={56} />
              </div>
              <div>
                <FieldLabel>Break Length Required</FieldLabel>
                <p className="text-[11px] font-['Open_Sans',sans-serif] text-[#6a6e79] mb-[6px]">Minimum duration of the required break</p>
                <NumberInput value={data.breakLength} onChange={(v) => onChange({ ...data, breakLength: v })} step={0.25} min={0} suffix="hrs" width={56} />
              </div>
            </div>

            <div>
              <FieldLabel>When break requirement is not met</FieldLabel>
              <p className="text-[11px] font-['Open_Sans',sans-serif] text-[#6a6e79] mb-[10px]">Choose how the system responds when an employee works past the threshold without a qualifying break</p>
              <div className="flex gap-[10px]">
                {/* Flag option */}
                <div onClick={() => onChange({ ...data, breakAction: "flag" })}
                  className={`flex-1 cursor-pointer rounded-[6px] border-2 px-[16px] py-[12px] transition-all ${data.breakAction === "flag" ? "border-[#856404] bg-[#fffbf0]" : "border-[#e0e1e9] bg-white hover:border-[#f0d080]"}`}>
                  <div className="flex items-center gap-[8px] mb-[6px]">
                    <div className={`flex h-[14px] w-[14px] shrink-0 items-center justify-center rounded-full border-2 transition-colors ${data.breakAction === "flag" ? "border-[#856404]" : "border-[#cbced4]"}`}>
                      {data.breakAction === "flag" && <div className="h-[7px] w-[7px] rounded-full bg-[#856404]" />}
                    </div>
                    <span className="text-[12px] font-bold font-['Open_Sans',sans-serif] text-[#252a2e]">Flag for review</span>
                  </div>
                  <p className="text-[11px] font-['Open_Sans',sans-serif] text-[#6a6e79] leading-[16px] ml-[22px]">The timesheet entry is flagged and a warning is shown. A supervisor must review and resolve the violation manually.</p>
                </div>
                {/* Auto option */}
                <div onClick={() => onChange({ ...data, breakAction: "auto" })}
                  className={`flex-1 cursor-pointer rounded-[6px] border-2 px-[16px] py-[12px] transition-all ${data.breakAction === "auto" ? "border-[#006fb0] bg-[#f5faff]" : "border-[#e0e1e9] bg-white hover:border-[#b8d9f0]"}`}>
                  <div className="flex items-center gap-[8px] mb-[6px]">
                    <div className={`flex h-[14px] w-[14px] shrink-0 items-center justify-center rounded-full border-2 transition-colors ${data.breakAction === "auto" ? "border-[#006fb0]" : "border-[#cbced4]"}`}>
                      {data.breakAction === "auto" && <div className="h-[7px] w-[7px] rounded-full bg-[#006fb0]" />}
                    </div>
                    <span className="text-[12px] font-bold font-['Open_Sans',sans-serif] text-[#252a2e]">Automatically apply break</span>
                  </div>
                  <p className="text-[11px] font-['Open_Sans',sans-serif] text-[#6a6e79] leading-[16px] ml-[22px]">The system inserts a break of the required length into the entry automatically. Requires Automatic Hour Rule Rollover to be enabled.</p>
                </div>
              </div>
            </div>
          </>
        )}

        {/* ── Kiosk Break ── */}
        {activeTab === "kiosk" && showKiosk && (
          <>
            <p className="text-[12px] font-['Open_Sans',sans-serif] text-[#464b52] leading-[18px] mb-[14px]">
              Shift entries will have a break automatically added based on the minimum number of hours worked in a day that a break must be taken for, and the length of the required break.
            </p>
            <div className="flex items-end gap-[24px]">
              <div>
                <FieldLabel>Minimum Hours Per Day</FieldLabel>
                <NumberInput value={kioskMinHours ?? 4} onChange={onKioskMinHours ?? (() => {})} step={0.5} min={0} width={56} />
              </div>
              <div>
                <FieldLabel>Break Length Required (hours)</FieldLabel>
                <NumberInput value={kioskBreakLength ?? 0.5} onChange={onKioskBreakLength ?? (() => {})} step={0.25} min={0} width={56} />
              </div>
            </div>
          </>
        )}

        {/* ── Equipment ── */}
        {activeTab === "equipment" && showEquipment && (
          <div className="flex items-end gap-[24px]">
            <div>
              <FieldLabel>Maximum Hours Per Day</FieldLabel>
              <NumberInput value={equipMaxHours ?? 10} onChange={onEquipMaxHours ?? (() => {})} step={1} min={0} width={56} suffix="hrs" />
            </div>
          </div>
        )}

        {/* ── Meal Periods ── */}
        {activeTab === "meal" && (
          <div className="flex flex-col gap-[24px]">
            {/* Meal 1 */}
            <CardShell title="First Meal Period" badge="Meal 1" badgeColor="blue"
              action={<div className="flex items-center gap-[8px]"><span className="text-[12px] font-['Open_Sans',sans-serif] text-[#464b52]">{mp.meal1Enabled ? "Enabled" : "Disabled"}</span><Toggle enabled={mp.meal1Enabled} onChange={(v) => setMp("meal1Enabled", v)} /></div>}>
              <div className={`transition-opacity duration-200 ${mp.meal1Enabled ? "opacity-100" : "opacity-40 pointer-events-none"}`}>
                <div className="grid grid-cols-2 gap-0" style={{ borderTop: "none" }}>
                  {/* Trigger */}
                  <div className="px-[20px] py-[18px]" style={{ borderRight: "1px solid #f0f0f4" }}>
                    <SectionLabel>Meal Trigger</SectionLabel>
                    <p className="text-[11px] font-['Open_Sans',sans-serif] text-[#6a6e79] mb-[12px] leading-[15px]">Choose when this meal period is required during a shift.</p>
                    <div className="flex flex-col gap-[4px]">
                      <SoftOption
                        selected={mp.meal1Schedule === "relative"}
                        onSelect={() => setMp("meal1Schedule", "relative")}
                        title="Relative to shift start"
                        description="Meal must begin after this many hours worked"
                      >
                        <NumberInput value={mp.meal1Trigger} onChange={(v) => setMp("meal1Trigger", v)} step={0.5} min={0} suffix="hrs into shift" width={52} />
                      </SoftOption>
                      <SoftOption
                        selected={mp.meal1Schedule === "fixed"}
                        onSelect={() => setMp("meal1Schedule", "fixed")}
                        title="Fixed schedule time"
                        description="Meal is scheduled at a specific clock time each day"
                      >
                        <input type="time" value={mp.meal1FixedTime} onChange={(e) => setMp("meal1FixedTime", e.target.value)}
                          className="rounded-[4px] bg-white px-[8px] py-[4px] text-[12px] font-['Open_Sans',sans-serif] text-[#252a2e] outline-none"
                          style={{ border: "1px solid #6a6e79" }} />
                      </SoftOption>
                    </div>
                  </div>
                  {/* Settings */}
                  <div className="px-[20px] py-[18px] flex flex-col gap-[20px]">
                    <div>
                      <SectionLabel>Meal Duration</SectionLabel>
                      <FieldLabel>Minimum required length</FieldLabel>
                      <NumberInput value={mp.meal1Duration} onChange={(v) => setMp("meal1Duration", v)} step={5} min={0} suffix="min" />
                    </div>
                    <div>
                      <SectionLabel>Waiver</SectionLabel>
                      <div className="flex items-start gap-[10px]">
                        <Toggle enabled={mp.meal1Waiver} onChange={(v) => setMp("meal1Waiver", v)} />
                        <span className="text-[12px] font-['Open_Sans',sans-serif] text-[#252a2e] leading-[20px]">State-compliant waiver allowed for shifts ≤ 6.0 hrs</span>
                      </div>
                    </div>
                    {/* Summary pill */}
                    <div className="mt-auto flex items-start gap-[8px] rounded-[6px] bg-[#f1f1f6] px-[12px] py-[10px]">
                      <div className="h-[6px] w-[6px] rounded-full bg-[#006fb0] shrink-0 mt-[4px]" />
                      <p className="text-[11px] font-['Open_Sans',sans-serif] text-[#464b52] leading-[16px]">
                        {mp.meal1Schedule === "relative"
                          ? `Meal required after ${mp.meal1Trigger} hrs worked · min ${mp.meal1Duration} min`
                          : `Meal scheduled at ${mp.meal1FixedTime} · min ${mp.meal1Duration} min`}
                        {mp.meal1Waiver && " · waiver eligible"}
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            </CardShell>

            {/* Meal 2 */}
            <CardShell title="Second Meal Period" badge="Meal 2" badgeColor="blue"
              action={<div className="flex items-center gap-[8px]"><span className="text-[12px] font-['Open_Sans',sans-serif] text-[#464b52]">{mp.meal2Enabled ? "Enabled" : "Disabled"}</span><Toggle enabled={mp.meal2Enabled} onChange={(v) => setMp("meal2Enabled", v)} /></div>}>
              <div className={`transition-opacity duration-200 ${mp.meal2Enabled ? "opacity-100" : "opacity-40 pointer-events-none"}`}>
                <div className="grid grid-cols-2 gap-0">
                  {/* Trigger */}
                  <div className="px-[20px] py-[18px]" style={{ borderRight: "1px solid #f0f0f4" }}>
                    <SectionLabel>Meal Trigger</SectionLabel>
                    <p className="text-[11px] font-['Open_Sans',sans-serif] text-[#6a6e79] mb-[12px] leading-[15px]">Choose when this meal period is required during a shift.</p>
                    <div className="flex flex-col gap-[4px]">
                      <SoftOption
                        selected={mp.meal2Schedule === "relative"}
                        onSelect={() => setMp("meal2Schedule", "relative")}
                        title="Relative to shift start"
                        description="Meal must begin after this many hours worked"
                      >
                        <NumberInput value={mp.meal2Trigger} onChange={(v) => setMp("meal2Trigger", v)} step={0.5} min={0} suffix="hrs into shift" width={52} />
                      </SoftOption>
                      <SoftOption
                        selected={mp.meal2Schedule === "fixed"}
                        onSelect={() => setMp("meal2Schedule", "fixed")}
                        title="Fixed schedule time"
                        description="Meal is scheduled at a specific clock time each day"
                      >
                        <input type="time" value={mp.meal2FixedTime} onChange={(e) => setMp("meal2FixedTime", e.target.value)}
                          className="rounded-[4px] bg-white px-[8px] py-[4px] text-[12px] font-['Open_Sans',sans-serif] text-[#252a2e] outline-none"
                          style={{ border: "1px solid #6a6e79" }} />
                      </SoftOption>
                    </div>
                  </div>
                  {/* Settings */}
                  <div className="px-[20px] py-[18px] flex flex-col gap-[20px]">
                    <div>
                      <SectionLabel>Meal Duration</SectionLabel>
                      <FieldLabel>Minimum required length</FieldLabel>
                      <NumberInput value={mp.meal2Duration} onChange={(v) => setMp("meal2Duration", v)} step={5} min={0} suffix="min" />
                    </div>
                    <div>
                      <SectionLabel>Waiver</SectionLabel>
                      <div className="flex items-start gap-[10px]">
                        <Toggle enabled={mp.meal2Waiver} onChange={(v) => setMp("meal2Waiver", v)} />
                        <span className="text-[12px] font-['Open_Sans',sans-serif] text-[#252a2e] leading-[20px]">State-compliant waiver allowed when mutual written consent exists</span>
                      </div>
                    </div>
                    <div className="mt-auto flex items-start gap-[8px] rounded-[6px] bg-[#f1f1f6] px-[12px] py-[10px]">
                      <div className="h-[6px] w-[6px] rounded-full bg-[#006fb0] shrink-0 mt-[4px]" />
                      <p className="text-[11px] font-['Open_Sans',sans-serif] text-[#464b52] leading-[16px]">
                        {mp.meal2Schedule === "relative"
                          ? `Meal required after ${mp.meal2Trigger} hrs worked · min ${mp.meal2Duration} min`
                          : `Meal scheduled at ${mp.meal2FixedTime} · min ${mp.meal2Duration} min`}
                        {mp.meal2Waiver && " · waiver eligible"}
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            </CardShell>

            {/* On-Duty Meal */}
            <CardShell title="On-Duty Meal" badge="CA Labor Code § 512(e)" badgeColor="blue"
              action={<div className="flex items-center gap-[8px]"><span className="text-[12px] font-['Open_Sans',sans-serif] text-[#464b52]">{mp.onDutyMealEnabled ? "Enabled" : "Disabled"}</span><Toggle enabled={mp.onDutyMealEnabled} onChange={(v) => setMp("onDutyMealEnabled", v)} /></div>}>
              <div className={`transition-opacity duration-200 ${mp.onDutyMealEnabled ? "opacity-100" : "opacity-40 pointer-events-none"}`}>
                <div className="grid grid-cols-3 gap-[28px] px-[20px] py-[18px]">
                  {/* Agreement requirement */}
                  <div>
                    <SectionLabel>Agreement Requirement</SectionLabel>
                    <div className="flex items-start gap-[10px]">
                      <Toggle enabled={mp.onDutyRequireAgreement} onChange={(v) => setMp("onDutyRequireAgreement", v)} />
                      <span className="text-[12px] font-['Open_Sans',sans-serif] text-[#252a2e] leading-[20px]">
                        Allowed only with signed, revocable agreement
                      </span>
                    </div>
                    {mp.onDutyRequireAgreement && (
                      <div className="mt-[10px] flex items-start gap-[8px] rounded-[6px] bg-[#eef5fa] px-[10px] py-[8px]">
                        <Info size={13} className="mt-[1px] shrink-0 text-[#006fb0]" />
                        <p className="text-[11px] font-['Open_Sans',sans-serif] text-[#464b52] leading-[16px]">
                          Employee must have a valid on-duty meal agreement on file before this meal type can be recorded.
                        </p>
                      </div>
                    )}
                  </div>

                  {/* When no agreement */}
                  <div>
                    <SectionLabel>When Taken Without Agreement</SectionLabel>
                    <div className="flex flex-col gap-[4px]">
                      {([
                        { value: "flag",          label: "Flag entry only" },
                        { value: "pay_time_worked", label: "Pay as time worked" },
                        { value: "flag_and_pay",  label: "Flag & pay as time worked" },
                      ] as { value: OnDutyMealAction; label: string }[]).map((opt) => (
                        <SoftOption
                          key={opt.value}
                          selected={mp.onDutyNoAgreementAction === opt.value}
                          onSelect={() => setMp("onDutyNoAgreementAction", opt.value)}
                          title={opt.label}
                        />
                      ))}
                    </div>
                  </div>

                  {/* Summary */}
                  <div>
                    <SectionLabel>Effective Behavior</SectionLabel>
                    <div className="rounded-[6px] bg-[#f1f1f6] px-[12px] py-[12px] flex flex-col gap-[8px]">
                      <div className="flex items-start gap-[6px]">
                        <Check size={12} className="mt-[2px] shrink-0 text-[#28a745]" />
                        <span className="text-[11px] font-['Open_Sans',sans-serif] text-[#464b52] leading-[16px]">
                          {mp.onDutyRequireAgreement ? "Agreement required to record on-duty meal" : "No agreement required"}
                        </span>
                      </div>
                      <div className="flex items-start gap-[6px]">
                        <AlertTriangle size={12} className="mt-[2px] shrink-0 text-[#856404]" />
                        <span className="text-[11px] font-['Open_Sans',sans-serif] text-[#464b52] leading-[16px]">
                          Without agreement:{" "}
                          {mp.onDutyNoAgreementAction === "flag" && "entry flagged for review"}
                          {mp.onDutyNoAgreementAction === "pay_time_worked" && "meal paid as time worked"}
                          {mp.onDutyNoAgreementAction === "flag_and_pay" && "flagged and paid as time worked"}
                        </span>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </CardShell>

            {/* Free Meal */}
            <CardShell title="Custom Reminders & Notifications" badge="Meal Breaks" badgeColor="blue"
              action={<div className="flex items-center gap-[8px]"><span className="text-[12px] font-['Open_Sans',sans-serif] text-[#464b52]">{mp.freeMealEnabled ? "Enabled" : "Disabled"}</span><Toggle enabled={mp.freeMealEnabled} onChange={(v) => setMp("freeMealEnabled", v)} /></div>}>
              <div className={`transition-opacity duration-200 ${mp.freeMealEnabled ? "opacity-100" : "opacity-40 pointer-events-none"}`}>
                {/* Description */}
                <div className="px-[20px] pt-[14px] pb-[2px]">
                  <p className="text-[12px] font-['Open_Sans',sans-serif] text-[#464b52] leading-[18px]">
                    Configure when employees are prompted with a notification during meal breaks, and customize the message they see.
                  </p>
                </div>

                <div className="grid grid-cols-3 gap-[24px] px-[20px] py-[14px]">
                  {/* When to notify */}
                  <div>
                    <SectionLabel>When to Notify</SectionLabel>
                    <SelectField value={mp.freeMealTrigger} onChange={(v) => setMp("freeMealTrigger", v as FreeMealTrigger)}
                      options={[
                        { value: "always",           label: "Every meal break" },
                        { value: "before_threshold", label: "Before threshold by..." },
                        { value: "exceeding",        label: "Only for breaks exceeding..." },
                      ]} />
                    {mp.freeMealTrigger === "before_threshold" && (
                      <div className="mt-[8px] flex flex-col gap-[6px]">
                        <div className="flex items-center gap-[6px]">
                          <NumberInput value={mp.freeMealBeforeMinutes} onChange={(v) => setMp("freeMealBeforeMinutes", v)} step={1} min={1} suffix="min before" width={52} />
                        </div>
                        <p className="text-[11px] font-['Open_Sans',sans-serif] text-[#6a6e79] leading-[15px]">
                          Employee is notified {mp.freeMealBeforeMinutes} min before the meal threshold is reached.
                        </p>
                      </div>
                    )}
                    {mp.freeMealTrigger === "exceeding" && (
                      <div className="mt-[8px] flex items-center gap-[6px]">
                        <span className="text-[12px] font-['Open_Sans',sans-serif] text-[#464b52]">Longer than:</span>
                        <NumberInput value={mp.freeMealMinutes} onChange={(v) => setMp("freeMealMinutes", v)} step={5} min={1} suffix="min" />
                      </div>
                    )}
                  </div>

                  {/* Message */}
                  <div className="col-span-2">
                    <SectionLabel>Notification Message</SectionLabel>
                    <textarea
                      value={mp.freeMealPrompt}
                      onChange={(e) => setMp("freeMealPrompt", e.target.value)}
                      rows={3}
                      placeholder="Enter the message employees will see during their meal break..."
                      className="w-full rounded-[4px] bg-white px-[10px] py-[6px] text-[12px] font-['Open_Sans',sans-serif] text-[#252a2e] outline-none resize-none leading-[18px]"
                      style={{ border: "1px solid #6a6e79" }}
                    />
                    <p className="mt-[4px] text-[11px] font-['Open_Sans',sans-serif] text-[#6a6e79]">
                      {mp.freeMealPrompt.length}/200 characters
                    </p>
                  </div>
                </div>

              </div>
            </CardShell>
          </div>
        )}

        {/* ── Premiums ── */}
        {activeTab === "penalties" && (
          <CardShell title="Premium Engine" badge="LC § 226.7" badgeColor="red"
            action={<div className="flex items-center gap-[8px]"><span className="text-[12px] font-['Open_Sans',sans-serif] text-[#464b52]">Auto-calculate Meal Penalty Premium Pay</span><Toggle enabled={mp.penaltiesEnabled} onChange={(v) => setMp("penaltiesEnabled", v)} /></div>}>
            <div className={`transition-opacity duration-200 ${mp.penaltiesEnabled ? "opacity-100" : "opacity-40 pointer-events-none"}`}>

              {/* Per-violation table */}
              <div className="px-[20px] pt-[16px] pb-[4px]">
                <div className="overflow-x-auto rounded-[6px] border border-[#e0e1e9]">
                  <table className="w-full border-collapse">
                    <thead>
                      <tr className="bg-[#f5f5f8]">
                        <th className="border-b border-[#e0e1e9] px-[12px] py-[8px] text-left text-[11px] font-semibold font-['Open_Sans',sans-serif] text-[#6a6e79] w-[32px]" />
                        <th className="border-b border-[#e0e1e9] px-[12px] py-[8px] text-left text-[11px] font-semibold font-['Open_Sans',sans-serif] text-[#6a6e79]">Violation</th>
                        <th className="border-b border-[#e0e1e9] px-[12px] py-[8px] text-left text-[11px] font-semibold font-['Open_Sans',sans-serif] text-[#6a6e79] w-[180px]">Pay Type</th>
                        <th className="border-b border-[#e0e1e9] px-[12px] py-[8px] text-center text-[11px] font-semibold font-['Open_Sans',sans-serif] text-[#6a6e79] w-[130px]">Hours Rate</th>
                      </tr>
                    </thead>
                    <tbody>
                      {(mp.violations ?? defaultViolations()).map((v, idx) => {
                        const updateViolation = (patch: Partial<ViolationRule>) => {
                          const next = (mp.violations ?? defaultViolations()).map((r, i) => i === idx ? { ...r, ...patch } : r);
                          setMp("violations", next);
                        };
                        return (
                          <tr key={v.id} className={`${idx % 2 === 0 ? "bg-white" : "bg-[#fafafa]"} ${!v.enabled ? "opacity-50" : ""}`}>
                            {/* Enable toggle */}
                            <td className="border-b border-[#e0e1e9] px-[12px] py-[10px] text-center">
                              <Toggle enabled={v.enabled} onChange={(val) => updateViolation({ enabled: val })} />
                            </td>
                            {/* Label */}
                            <td className="border-b border-[#e0e1e9] px-[12px] py-[10px]">
                              <span className="text-[12px] font-semibold font-['Open_Sans',sans-serif] text-[#252a2e]">{v.label}</span>
                            </td>
                            {/* Pay Type */}
                            <td className="border-b border-[#e0e1e9] px-[12px] py-[8px]">
                              <div className="pointer-events-auto">
                                <SelectField
                                  value={v.payType}
                                  onChange={(val) => updateViolation({ payType: val as PayType })}
                                  options={[
                                    { value: "regular",     label: "Regular Rate" },
                                    { value: "overtime",    label: "Overtime Rate (1.5×)" },
                                    { value: "double_time", label: "Double Time (2×)" },
                                    { value: "flat",        label: "Flat Dollar Amount" },
                                  ]}
                                />
                              </div>
                            </td>
                            {/* Hours Rate */}
                            <td className="border-b border-[#e0e1e9] px-[12px] py-[8px] text-center">
                              <div className="flex justify-center pointer-events-auto">
                                <NumberInput
                                  value={v.hoursRate}
                                  onChange={(val) => updateViolation({ hoursRate: val })}
                                  step={0.25}
                                  min={0}
                                  suffix={v.payType === "flat" ? "$" : "hr(s)"}
                                  width={52}
                                />
                              </div>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Global stacking cap */}
              <div className="flex items-end gap-[32px] px-[20px] pt-[14px] pb-[16px] border-t border-[#f0f0f4] mt-[12px]">
                <div>
                  <FieldLabel>Daily Stacking Cap</FieldLabel>
                  <NumberInput value={mp.stackingCap} onChange={(v) => setMp("stackingCap", v)} step={0.5} min={0} suffix="hr(s)" />
                  <p className="mt-[4px] text-[11px] font-['Open_Sans',sans-serif] text-[#6a6e79]">Max total penalty pay per workday across all violations</p>
                </div>
              </div>

            </div>
          </CardShell>
        )}

      </div>
    </>
  );
}

// ─── Hour Rule Precedence ─────────────────────────────────────────────────────
function PrecedenceSection() {
  const [order, setOrder] = useState(["Company", "Union", "State"]);
  const [dragging, setDragging] = useState<number | null>(null);
  const [dragOver, setDragOver] = useState<number | null>(null);

  const handleDrop = (toIdx: number) => {
    if (dragging === null || dragging === toIdx) return;
    const next = [...order];
    const [moved] = next.splice(dragging, 1);
    next.splice(toIdx, 0, moved);
    setOrder(next);
    setDragging(null);
    setDragOver(null);
  };

  return (
    <div style={{ borderRadius: 6, overflow: "hidden", border: "1px solid #e0e1e9", background: "#ffffff", boxShadow: "0 1px 3px rgba(0,0,0,0.06)" }}>
      <div style={{ background: "#0e416c", padding: "10px 20px" }}>
        <h2 style={{ margin: 0, fontSize: 13, fontWeight: 700, fontFamily: "Open Sans, sans-serif", color: "#ffffff" }}>
          Hour Rule Precedence
        </h2>
      </div>
      <div style={{ padding: "14px 20px", background: "#ffffff" }}>
        <div style={{
          marginBottom: 12,
          display: "flex",
          alignItems: "flex-start",
          gap: 8,
          borderRadius: 4,
          background: "#dcedf9",
          border: "1px solid #b8d9f0",
          padding: "10px 12px",
        }}>
          <Info size={14} style={{ marginTop: 1, flexShrink: 0, color: "#006fb0" }} />
          <p style={{ margin: 0, fontSize: 12, fontFamily: "Open Sans, sans-serif", color: "#0e416c", lineHeight: "18px" }}>
            Drag to arrange the order the rules are looked at, from top to bottom. The most generous rule will be taken when compared with State and Union rules.
          </p>
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          {order.map((label, idx) => {
            const isDragging = dragging === idx;
            const isOver = dragOver === idx && dragging !== idx;
            return (
              <div
                key={label}
                draggable
                onDragStart={() => setDragging(idx)}
                onDragOver={(e) => { e.preventDefault(); setDragOver(idx); }}
                onDrop={() => handleDrop(idx)}
                onDragEnd={() => { setDragging(null); setDragOver(null); }}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 10,
                  borderRadius: 4,
                  border: isOver ? "1px solid #006fb0" : "1px solid #e0e1e9",
                  background: isOver ? "#f5faff" : "#ffffff",
                  padding: "10px 12px",
                  cursor: "grab",
                  userSelect: "none",
                  opacity: isDragging ? 0.4 : 1,
                  transition: "border-color 0.15s, background 0.15s, opacity 0.15s",
                }}
              >
                <GripVertical size={16} color="#9fa3ad" style={{ flexShrink: 0 }} />
                <div style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  width: 22,
                  height: 22,
                  flexShrink: 0,
                  borderRadius: "50%",
                  background: "#0e416c",
                  color: "#ffffff",
                  fontSize: 10,
                  fontWeight: 700,
                  fontFamily: "Open Sans, sans-serif",
                }}>
                  {idx + 1}
                </div>
                <span style={{ fontSize: 13, fontWeight: 600, fontFamily: "Open Sans, sans-serif", color: "#252a2e" }}>
                  {label}
                </span>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

// ─── Hour Rules Tab ───────────────────────────────────────────────────────────
const STATE_OPTIONS = [
  { value: "CA", label: "California (CA)" },
  { value: "NY", label: "New York (NY)" },
  { value: "TX", label: "Texas (TX)" },
  { value: "WA", label: "Washington (WA)" },
  { value: "IL", label: "Illinois (IL)" },
  { value: "FL", label: "Florida (FL)" },
];

const UNION_OPTIONS = [
  { value: "iuoe", label: "IUOE Local 12" },
  { value: "teamsters", label: "Teamsters Local 396" },
  { value: "ibew", label: "IBEW Local 11" },
  { value: "liuna", label: "LIUNA Local 300" },
  { value: "uca", label: "UCA Local 55" },
];

function HourRulesTab({ onSave }: { onSave: () => void }) {
  // Company
  const [companyRules, _setCompanyRules] = useState<RuleSetData>(defaultRuleSet());
  const [companyMealPenalty, _setCompanyMealPenalty] = useState<MealPenaltyState>(defaultMealPenalty());
  const [kioskMinHours, _setKioskMinHours] = useState(4);
  const [kioskBreakLength, _setKioskBreakLength] = useState(0.5);
  const [equipMaxHours, _setEquipMaxHours] = useState(10);

  const setCompanyRules = (r: RuleSetData) => { _setCompanyRules(r); onSave(); };
  const setCompanyMealPenalty = (v: MealPenaltyState) => { _setCompanyMealPenalty(v); onSave(); };
  const setKioskMinHours = (v: number) => { _setKioskMinHours(v); onSave(); };
  const setKioskBreakLength = (v: number) => { _setKioskBreakLength(v); onSave(); };
  const setEquipMaxHours = (v: number) => { _setEquipMaxHours(v); onSave(); };

  // State rules — keyed by state code
  const [selectedState, setSelectedState] = useState("");
  const [stateRulesMap, setStateRulesMap] = useState<Record<string, RuleSetData>>({});
  const [stateMealPenaltyMap, setStateMealPenaltyMap] = useState<Record<string, MealPenaltyState>>({});

  const hasStateRules = selectedState && stateRulesMap[selectedState];

  const addStateRules = () => {
    if (!selectedState) return;
    setStateRulesMap((prev) => ({ ...prev, [selectedState]: defaultRuleSet() }));
    setStateMealPenaltyMap((prev) => ({ ...prev, [selectedState]: defaultMealPenalty() }));
    onSave();
  };
  const deleteStateRules = () => {
    if (!selectedState) return;
    setStateRulesMap((prev) => { const n = { ...prev }; delete n[selectedState]; return n; });
    setStateMealPenaltyMap((prev) => { const n = { ...prev }; delete n[selectedState]; return n; });
    onSave();
  };
  const updateStateRules = (rules: RuleSetData) => {
    setStateRulesMap((prev) => ({ ...prev, [selectedState]: rules }));
    onSave();
  };
  const updateStateMealPenalty = (mp: MealPenaltyState) => {
    setStateMealPenaltyMap((prev) => ({ ...prev, [selectedState]: mp }));
    onSave();
  };

  // Union rules — keyed by union code
  const [selectedUnion, setSelectedUnion] = useState("");
  const [unionRulesMap, setUnionRulesMap] = useState<Record<string, RuleSetData>>({});
  const [unionMealPenaltyMap, setUnionMealPenaltyMap] = useState<Record<string, MealPenaltyState>>({});

  const hasUnionRules = selectedUnion && unionRulesMap[selectedUnion];

  const addUnionRules = () => {
    if (!selectedUnion) return;
    setUnionRulesMap((prev) => ({ ...prev, [selectedUnion]: defaultRuleSet() }));
    setUnionMealPenaltyMap((prev) => ({ ...prev, [selectedUnion]: defaultMealPenalty() }));
    onSave();
  };
  const deleteUnionRules = () => {
    if (!selectedUnion) return;
    setUnionRulesMap((prev) => { const n = { ...prev }; delete n[selectedUnion]; return n; });
    setUnionMealPenaltyMap((prev) => { const n = { ...prev }; delete n[selectedUnion]; return n; });
    onSave();
  };
  const updateUnionRules = (rules: RuleSetData) => {
    setUnionRulesMap((prev) => ({ ...prev, [selectedUnion]: rules }));
    onSave();
  };
  const updateUnionMealPenalty = (mp: MealPenaltyState) => {
    setUnionMealPenaltyMap((prev) => ({ ...prev, [selectedUnion]: mp }));
    onSave();
  };

  const configuredStates = Object.keys(stateRulesMap);
  const configuredUnions = Object.keys(unionRulesMap);

  return (
    <div className="flex flex-col gap-[28px]">
      {/* Precedence */}
      <PrecedenceSection />

      {/* ── Company ── */}
      <div>
        <SectionDivider>Company Timesheet Hour Rule</SectionDivider>
        <SectionBody>
          <RuleSetForm
            data={companyRules}
            onChange={setCompanyRules}
            showKiosk
            showEquipment
            kioskMinHours={kioskMinHours}
            onKioskMinHours={setKioskMinHours}
            kioskBreakLength={kioskBreakLength}
            onKioskBreakLength={setKioskBreakLength}
            equipMaxHours={equipMaxHours}
            onEquipMaxHours={setEquipMaxHours}
            descriptionText="Enter in the max amount of hours allowed for each hour type (regular, overtime, etc.). Timesheet entries created with hours greater than the max amounts will be flagged and a warning will be displayed explaining the error and max number of hours allowed for that type. Company Rules are the default, but the most generous rule will be taken when compared with State and Union rules."
            mealPenaltyState={companyMealPenalty}
            onMealPenaltyChange={setCompanyMealPenalty}
          />
        </SectionBody>
      </div>

      {/* ── State ── */}
      <div>
        <SectionDivider>State Timesheet Hour Rules</SectionDivider>
        <SectionBody>
          {/* Selector bar */}
          <div className="flex items-center gap-[10px] px-[20px] py-[14px] border-b border-[#f0f0f4]">
            <p className="text-[12px] font-['Open_Sans',sans-serif] text-[#464b52] shrink-0">
              You may specify different rules for each individual State.
            </p>
            <div className="flex-1 max-w-[220px]">
              <SelectField
                value={selectedState}
                onChange={setSelectedState}
                placeholder="Select a State"
                options={STATE_OPTIONS.map((s) => ({
                  ...s,
                  label: s.label + (stateRulesMap[s.value] ? " ✓" : ""),
                }))}
              />
            </div>
            {selectedState && !hasStateRules && (
              <button onClick={addStateRules}
                className="flex items-center gap-[5px] rounded-[4px] bg-[#006fb0] px-[12px] py-[5px] text-[11px] font-semibold font-['Open_Sans',sans-serif] text-white hover:bg-[#005a8e] transition-colors">
                <Plus size={12} /> Add Rules
              </button>
            )}
            {hasStateRules && (
              <button onClick={deleteStateRules}
                className="flex items-center gap-[5px] rounded-[4px] border border-[#dc3545] bg-white px-[12px] py-[5px] text-[11px] font-semibold font-['Open_Sans',sans-serif] text-[#dc3545] hover:bg-[#fce8e8] transition-colors">
                <Trash2 size={12} /> Delete
              </button>
            )}
          </div>

          {/* Configured states chips */}
          {configuredStates.length > 0 && (
            <div className="flex flex-wrap gap-[6px] px-[20px] py-[10px] border-b border-[#f0f0f4] bg-[#fafafa]">
              {configuredStates.map((code) => {
                const label = STATE_OPTIONS.find((s) => s.value === code)?.label ?? code;
                return (
                  <button key={code} onClick={() => setSelectedState(code)}
                    className={`rounded-full px-[10px] py-[2px] text-[11px] font-semibold font-['Open_Sans',sans-serif] transition-colors ${selectedState === code ? "bg-[#006fb0] text-white" : "bg-[#dcedf9] text-[#006fb0] hover:bg-[#b8d9f0]"}`}>
                    {label}
                  </button>
                );
              })}
            </div>
          )}

          {/* Rules form */}
          {hasStateRules ? (
            <RuleSetForm
              data={stateRulesMap[selectedState]}
              onChange={updateStateRules}
              descriptionText={`Override rules specific to ${STATE_OPTIONS.find((s) => s.value === selectedState)?.label ?? selectedState}. These will be compared against Company rules; the most generous value applies.`}
              mealPenaltyState={stateMealPenaltyMap[selectedState] ?? defaultMealPenalty()}
              onMealPenaltyChange={updateStateMealPenalty}
            />
          ) : (
            <div className="px-[20px] py-[20px] text-center">
              <p className="text-[12px] font-['Open_Sans',sans-serif] text-[#6a6e79]">
                {selectedState
                  ? `No custom rules configured for ${STATE_OPTIONS.find((s) => s.value === selectedState)?.label}. Click "Add Rules" to create state-specific overrides.`
                  : "Select a state above to view or configure state-specific hour rules."}
              </p>
            </div>
          )}
        </SectionBody>
      </div>

      {/* ── Union ── */}
      <div>
        <SectionDivider>Union Timesheet Hour Rules</SectionDivider>
        <SectionBody>
          {/* Selector bar */}
          <div className="flex items-center gap-[10px] px-[20px] py-[14px] border-b border-[#f0f0f4]">
            <p className="text-[12px] font-['Open_Sans',sans-serif] text-[#464b52] shrink-0">
              You may specify different rules for each individual union.
            </p>
            <div className="flex-1 max-w-[220px]">
              <SelectField
                value={selectedUnion}
                onChange={setSelectedUnion}
                placeholder="Select a Union"
                options={UNION_OPTIONS.map((u) => ({
                  ...u,
                  label: u.label + (unionRulesMap[u.value] ? " ✓" : ""),
                }))}
              />
            </div>
            {selectedUnion && !hasUnionRules && (
              <button onClick={addUnionRules}
                className="flex items-center gap-[5px] rounded-[4px] bg-[#006fb0] px-[12px] py-[5px] text-[11px] font-semibold font-['Open_Sans',sans-serif] text-white hover:bg-[#005a8e] transition-colors">
                <Plus size={12} /> Add Rules
              </button>
            )}
            {hasUnionRules && (
              <button onClick={deleteUnionRules}
                className="flex items-center gap-[5px] rounded-[4px] border border-[#dc3545] bg-white px-[12px] py-[5px] text-[11px] font-semibold font-['Open_Sans',sans-serif] text-[#dc3545] hover:bg-[#fce8e8] transition-colors">
                <Trash2 size={12} /> Delete
              </button>
            )}
          </div>

          {/* Configured unions chips */}
          {configuredUnions.length > 0 && (
            <div className="flex flex-wrap gap-[6px] px-[20px] py-[10px] border-b border-[#f0f0f4] bg-[#fafafa]">
              {configuredUnions.map((code) => {
                const label = UNION_OPTIONS.find((u) => u.value === code)?.label ?? code;
                return (
                  <button key={code} onClick={() => setSelectedUnion(code)}
                    className={`rounded-full px-[10px] py-[2px] text-[11px] font-semibold font-['Open_Sans',sans-serif] transition-colors ${selectedUnion === code ? "bg-[#006fb0] text-white" : "bg-[#dcedf9] text-[#006fb0] hover:bg-[#b8d9f0]"}`}>
                    {label}
                  </button>
                );
              })}
            </div>
          )}

          {/* Rules form */}
          {hasUnionRules ? (
            <RuleSetForm
              data={unionRulesMap[selectedUnion]}
              onChange={updateUnionRules}
              descriptionText={`Override rules specific to ${UNION_OPTIONS.find((u) => u.value === selectedUnion)?.label ?? selectedUnion}. These will be compared against Company rules; the most generous value applies.`}
              mealPenaltyState={unionMealPenaltyMap[selectedUnion] ?? defaultMealPenalty()}
              onMealPenaltyChange={updateUnionMealPenalty}
            />
          ) : (
            <div className="px-[20px] py-[20px] text-center">
              <p className="text-[12px] font-['Open_Sans',sans-serif] text-[#6a6e79]">
                {selectedUnion
                  ? `No custom rules configured for ${UNION_OPTIONS.find((u) => u.value === selectedUnion)?.label}. Click "Add Rules" to create union-specific overrides.`
                  : "Select a union above to view or configure union-specific hour rules."}
              </p>
            </div>
          )}
        </SectionBody>
      </div>
    </div>
  );
}

// ─── Exclusions Tab ───────────────────────────────────────────────────────────
type ExclusionItem = { id: number; label: string; subLabel?: string; enabled: boolean };

function ExclusionSection({ title, description, items, onToggle, onAdd }: {
  title: string; description: string;
  items: ExclusionItem[]; onToggle: (id: number) => void; onAdd: () => void;
}) {
  return (
    <div>
      <SectionDivider>{title}</SectionDivider>
      <SectionBody>
        <div className="px-[20px] py-[14px]">
          <div className="flex items-center justify-between mb-[10px]">
            <p className="text-[12px] font-['Open_Sans',sans-serif] text-[#464b52] leading-[18px]">{description}</p>
            <button onClick={onAdd}
              className="ml-[16px] flex shrink-0 items-center gap-[5px] rounded-[4px] border border-[#006fb0] px-[10px] py-[5px] text-[11px] font-semibold font-['Open_Sans',sans-serif] text-[#006fb0] hover:bg-[#dcedf9] transition-colors">
              <Plus size={12} /> Add / Edit
            </button>
          </div>
          {items.length === 0 ? (
            <p className="text-[12px] font-['Open_Sans',sans-serif] text-[#6a6e79] italic">No excluded items configured.</p>
          ) : (
            <div className="flex flex-col divide-y divide-[#f0f0f4]">
              {items.map((item) => (
                <div key={item.id} className="flex items-center justify-between py-[8px]">
                  <div>
                    <span className="text-[12px] font-semibold font-['Open_Sans',sans-serif] text-[#252a2e]">{item.label}</span>
                    {item.subLabel && <span className="ml-[6px] text-[12px] font-['Open_Sans',sans-serif] text-[#6a6e79]">— {item.subLabel}</span>}
                  </div>
                  <div className="flex items-center gap-[10px]">
                    <Toggle enabled={item.enabled} onChange={() => onToggle(item.id)} />
                    <button className="flex h-[26px] w-[26px] items-center justify-center rounded-[4px] text-[#6a6e79] hover:bg-[#f1f1f6] hover:text-[#252a2e] transition-colors">
                      <Pencil size={13} />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </SectionBody>
    </div>
  );
}

function ExclusionsTab({ onSave }: { onSave: () => void }) {
  const [jobs, setJobs] = useState<ExclusionItem[]>([
    { id: 1, label: "SDIC", subLabel: "Sick Hours", enabled: true },
    { id: 2, label: "Vacation", subLabel: "Vacation", enabled: true },
  ]);
  const [phases, setPhases] = useState<ExclusionItem[]>([]);
  const [rateLevels, setRateLevels] = useState<ExclusionItem[]>([
    { id: 1, label: "Holiday", enabled: true },
  ]);

  const toggle = (setter: React.Dispatch<React.SetStateAction<ExclusionItem[]>>) => (id: number) => {
    setter((prev) => prev.map((item) => item.id === id ? { ...item, enabled: !item.enabled } : item));
    onSave();
  };
  const addItem = (setter: React.Dispatch<React.SetStateAction<ExclusionItem[]>>, prefix: string) => () => {
    setter((prev) => [...prev, { id: Date.now(), label: `${prefix} ${prev.length + 1}`, enabled: true }]);
    onSave();
  };

  return (
    <div className="flex flex-col gap-[20px]">
      <ExclusionSection title="Jobs To Exclude From Rules"
        description="You may specify jobs not to be calculated in hour rules. All Phases for this job will be excluded as well."
        items={jobs} onToggle={toggle(setJobs)} onAdd={addItem(setJobs, "Job")} />
      <ExclusionSection title="Phases To Exclude From Rules"
        description="You may specify a Phase combination not to be calculated in hour rules."
        items={phases} onToggle={toggle(setPhases)} onAdd={addItem(setPhases, "Phase")} />
      <ExclusionSection title="Rate Levels To Exclude From Rules"
        description="You may specify rate levels not to be calculated in hour rules."
        items={rateLevels} onToggle={toggle(setRateLevels)} onAdd={addItem(setRateLevels, "Rate Level")} />
    </div>
  );
}

// ─── Meal & Penalties embedded section ───────────────────────────────────────
type OnDutyMealAction = "flag" | "pay_time_worked" | "flag_and_pay";

type MealPenaltyState = {
  meal1Enabled: boolean; meal1Trigger: number; meal1Duration: number; meal1Schedule: ScheduleType;
  meal1FixedTime: string; meal1Waiver: boolean;
  meal2Enabled: boolean; meal2Trigger: number; meal2Duration: number; meal2Schedule: ScheduleType;
  meal2FixedTime: string; meal2Waiver: boolean;
  freeMealEnabled: boolean; freeMealTrigger: FreeMealTrigger;
  freeMealMinutes: number; freeMealBeforeMinutes: number; freeMealPrompt: string;
  onDutyMealEnabled: boolean; onDutyRequireAgreement: boolean; onDutyNoAgreementAction: OnDutyMealAction;
  penaltiesEnabled: boolean;
  stackingCap: number;
  violations: ViolationRule[];
};

type PayType = "regular" | "overtime" | "double_time" | "flat";

type ViolationRule = {
  id: string;
  label: string;
  enabled: boolean;
  payType: PayType;
  hoursRate: number;
  maxPenalty: number;
};

const defaultViolations = (): ViolationRule[] => [
  { id: "missed", label: "Missed meal break entirely", enabled: true, payType: "regular", hoursRate: 1.0, maxPenalty: 1.0 },
  { id: "short",  label: "Short meal break (< 30 mins)", enabled: true, payType: "regular", hoursRate: 1.0, maxPenalty: 1.0 },
  { id: "late",   label: "Late meal break (past trigger hour)", enabled: true, payType: "regular", hoursRate: 1.0, maxPenalty: 1.0 },
];

const defaultMealPenalty = (): MealPenaltyState => ({
  meal1Enabled: true, meal1Trigger: 5, meal1Duration: 30, meal1Schedule: "relative", meal1FixedTime: "12:00", meal1Waiver: true,
  meal2Enabled: true, meal2Trigger: 10, meal2Duration: 30, meal2Schedule: "relative", meal2FixedTime: "17:00", meal2Waiver: false,
  freeMealEnabled: true, freeMealTrigger: "always", freeMealMinutes: 30, freeMealBeforeMinutes: 10,
  freeMealPrompt: "Was this meal provided free of charge by the employer?",
  onDutyMealEnabled: false, onDutyRequireAgreement: true, onDutyNoAgreementAction: "flag_and_pay",
  penaltiesEnabled: true, stackingCap: 2.0, violations: defaultViolations(),
});

function CardShell({ title, badge: _badge, badgeColor: _badgeColor = "blue", action, children }: {
  title: string; badge?: string; badgeColor?: "blue" | "amber" | "red";
  action?: ReactNode; children: ReactNode;
}) {
  return (
    <div
      style={{
        borderRadius: 8,
        border: "1px solid #e0e1e9",
        background: "#ffffff",
        boxShadow: "0 1px 2px rgba(0,0,0,0.04)",
        overflow: "hidden",
      }}
    >
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          gap: 12,
          padding: "14px 20px",
          borderBottom: "1px solid #f0f0f4",
          background: "#ffffff",
        }}
      >
        <span style={{ fontSize: 15, fontWeight: 700, fontFamily: "Open Sans, sans-serif", color: "#0e416c" }}>
          {title}
        </span>
        {action}
      </div>
      {children}
    </div>
  );
}

/** Soft selectable row used inside meal-period cards (matches Figma: tinted active group, plain inactive). */
function SoftOption({
  selected,
  onSelect,
  title,
  description,
  children,
}: {
  selected: boolean;
  onSelect: () => void;
  title: string;
  description?: string;
  children?: ReactNode;
}) {
  return (
    <div
      role="radio"
      aria-checked={selected}
      onClick={onSelect}
      style={{
        cursor: "pointer",
        borderRadius: 8,
        padding: "12px 14px",
        background: selected ? "#eef5fa" : "transparent",
        border: selected ? "1px solid #d4e6f3" : "1px solid transparent",
        transition: "background 0.15s, border-color 0.15s",
      }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: description || (selected && children) ? 6 : 0 }}>
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            width: 14,
            height: 14,
            flexShrink: 0,
            borderRadius: "50%",
            border: `2px solid ${selected ? "#006fb0" : "#cbced4"}`,
          }}
        >
          {selected && <div style={{ width: 7, height: 7, borderRadius: "50%", background: "#006fb0" }} />}
        </div>
        <span style={{ fontSize: 12, fontWeight: 700, fontFamily: "Open Sans, sans-serif", color: "#252a2e" }}>
          {title}
        </span>
      </div>
      {description && (
        <p style={{ margin: "0 0 8px 22px", fontSize: 11, fontFamily: "Open Sans, sans-serif", color: "#6a6e79", lineHeight: "15px" }}>
          {description}
        </p>
      )}
      {selected && children && <div style={{ marginLeft: 22 }} onClick={(e) => e.stopPropagation()}>{children}</div>}
    </div>
  );
}

// ─── Preset Dialog ────────────────────────────────────────────────────────────
function PresetDialog({ open, onClose, onConfirm }: { open: boolean; onClose: () => void; onConfirm: () => void }) {
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-[1px]">
      <div className="relative w-[440px] rounded-[8px] bg-white shadow-xl">
        <div className="flex items-center justify-between border-b border-[#e0e1e9] px-[20px] py-[14px]">
          <span className="text-[14px] font-bold font-['Open_Sans',sans-serif] text-[#252a2e]">Load Statutory Presets</span>
          <button onClick={onClose} className="text-[#6a6e79] hover:text-[#252a2e] transition-colors"><X size={18} /></button>
        </div>
        <div className="px-[20px] py-[16px]">
          <div className="mb-[16px] flex gap-[10px] rounded-[4px] border border-[#fbad26] bg-[#fffbf0] p-[12px]">
            <AlertTriangle size={16} className="mt-[1px] shrink-0 text-[#856404]" />
            <p className="text-[12px] font-['Open_Sans',sans-serif] text-[#5a4a00] leading-[18px]">This action will overwrite all existing unsaved configurations with California baseline statutory values.</p>
          </div>
          <ul className="flex flex-col gap-[4px]">
            {["5-hour meal trigger for Meal 1", "30-minute meal duration", "10-hour trigger for Meal 2", "LC § 226.7 premium pay penalty defaults", "Company → Union → State rule precedence"].map((item) => (
              <li key={item} className="flex items-center gap-[6px] text-[12px] font-['Open_Sans',sans-serif] text-[#464b52]">
                <Check size={12} className="text-[#006fb0] shrink-0" />{item}
              </li>
            ))}
          </ul>
        </div>
        <div className="flex items-center justify-end gap-[8px] border-t border-[#e0e1e9] px-[20px] py-[12px]">
          <ModusWcButton color="neutral" variant="outlined" size="sm" onButtonClick={onClose}>Cancel</ModusWcButton>
          <ModusWcButton color="primary" variant="filled" size="sm" onButtonClick={onConfirm}>Confirm & Load Presets</ModusWcButton>
        </div>
      </div>
    </div>
  );
}

// ─── Root Settings Page ───────────────────────────────────────────────────────
function JurisdictionSettings() {
  const [activeTab, setActiveTab] = useState<ActiveTab>("hour");
  const [showPresetDialog, setShowPresetDialog] = useState(false);
  const [savedAt, setSavedAt] = useState<Date | null>(null);
  const scheduleAutosave = useAutosave(() => setSavedAt(new Date()));

  const tabKeys: ActiveTab[] = ["hour", "exclusions"];

  return (
    <div className="bg-[#f1f1f6]">
      {/* Header */}
      <div className="bg-[#f1f1f6] px-[24px] pt-[16px]">
        <div className="flex items-start justify-between mb-[12px]">
          <div>
            <h1 className="text-[22px] font-bold font-['Open_Sans',sans-serif] text-[#252a2e] leading-[32px]">Timesheet Hour Rules</h1>
            <p className="text-[11px] font-['Open_Sans',sans-serif] text-[#6a6e79] mt-[1px]">Configure hour rules, meal periods, break policies, and premiums by jurisdiction</p>
          </div>
          <div className="flex items-center gap-[8px] mt-[4px]">
            <ModusWcBadge color="success" size="sm" variant="filled">
              {savedAt
                ? `Saved at ${savedAt.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}`
                : "Last updated by Admin · July 15, 2026"}
            </ModusWcBadge>
          </div>
        </div>

        <div className="mb-[12px]">
          <ModusWcAlert
            variant="info"
            alertTitle="Rule application order"
            alertDescription="Use custom order when applying rules (if set, will look for the lowest allowed per hour type that applies)."
          />
        </div>

        <div className="pb-[16px]">
          <ModusWcTabs
            aria-label="Hour rules sections"
            size="md"
            tabStyle="boxed"
            activeTabIndex={tabKeys.indexOf(activeTab)}
            tabs={[{ label: "Hour Rules", icon: "schedule" }, { label: "Exclusions", icon: "filter_list" }]}
            onTabChange={(e) => {
              const idx = e.detail.newTab;
              if (idx >= 0 && idx < tabKeys.length) setActiveTab(tabKeys[idx]);
            }}
          />
        </div>
      </div>

      {/* Content */}
      <div className="px-[24px] py-[20px] pb-[40px]">
        {activeTab === "hour" && <HourRulesTab onSave={scheduleAutosave} />}
        {activeTab === "exclusions" && <ExclusionsTab onSave={scheduleAutosave} />}
      </div>


      <PresetDialog open={showPresetDialog} onClose={() => setShowPresetDialog(false)} onConfirm={() => setShowPresetDialog(false)} />
    </div>
  );
}

// ─── Nav Sidebar ──────────────────────────────────────────────────────────────
type NavPage =
  | "timesheets" | "clock_in" | "timesheet_summary" | "time_off" | "compliance_dashboard"
  | "employees" | "jobs" | "expenses" | "reports" | "equipment" | "documents" | "global_admin"
  | "s_settings" | "s_permissions" | "s_time_off_setup" | "s_notifications"
  | "s_tenant_images" | "s_hour_rules" | "s_rate_level" | "s_auto_job";

const SETTINGS_PAGES = new Set<NavPage>([
  "s_settings","s_permissions","s_time_off_setup","s_notifications",
  "s_tenant_images","s_hour_rules","s_rate_level","s_auto_job",
]);

type NavSection = {
  key: string;
  label: string;
  icon: ReactNode;
  children?: { key: NavPage; label: string }[];
  page?: NavPage;
};

const NAV_SECTIONS: NavSection[] = [
  { key: "my_info", label: "My Info", icon: <User size={16} />, page: "employees" },
  {
    key: "time", label: "Time", icon: <Clock size={16} />,
    children: [
      { key: "timesheets",         label: "Timesheets" },
      { key: "clock_in",           label: "Clock In and Out" },
      { key: "timesheet_summary",  label: "Timesheet Summary" },
      { key: "time_off",           label: "Time Off" },
      { key: "compliance_dashboard", label: "Compliance Dashboard" },
    ],
  },
  { key: "employees",   label: "Employees",    icon: <Users size={16} />,      page: "employees" },
  { key: "jobs",        label: "Jobs",         icon: <Briefcase size={16} />,  page: "jobs" },
  { key: "expenses",    label: "Expenses",     icon: <CreditCard size={16} />, page: "expenses" },
  { key: "reports",     label: "Reports",      icon: <BarChart2 size={16} />,  page: "reports" },
  { key: "equipment",   label: "Equipment",    icon: <Wrench size={16} />,     page: "equipment" },
  { key: "documents",   label: "Documents",    icon: <FileText size={16} />,   page: "documents" },
  { key: "settings",    label: "Settings",     icon: <Settings size={16} />,   page: "s_hour_rules" },
  { key: "global_admin",label: "Global Admin", icon: <Shield size={16} />,     page: "global_admin" },
];

const TOP_BAR_H       = 48;
const NAV_COLLAPSED_W = 40;
const NAV_EXPANDED_W  = 224;
const SETTINGS_NAV_W  = 200;

// ─── Compliance Dashboard ─────────────────────────────────────────────────────

type FilterKey = "job" | "employee" | "crew" | "supervisor" | "pm" | "cost_center";

type BreakEmployee = {
  id: string;
  name: string;
  role: string;
  crew: string;
  supervisor: string;
  job: string;
  costCenter: string;
  shiftStart: string;
  minutesUntilBreak?: number;
  minutesLate?: number;
  penaltyAmount?: number;
  penaltyCount?: number;
  status: "about_to" | "late" | "premium";
};

const MOCK_EMPLOYEES: BreakEmployee[] = [
  { id: "1",  name: "Marcus Rivera",  role: "Electrician", crew: "Crew A", supervisor: "Tom Blake", job: "Job A", costCenter: "CC-100", shiftStart: "06:00", minutesUntilBreak: 12, status: "about_to" },
  { id: "2",  name: "Dani Okonkwo",   role: "Foreman",     crew: "Crew A", supervisor: "Tom Blake", job: "Job A", costCenter: "CC-100", shiftStart: "06:00", minutesUntilBreak: 8,  status: "about_to" },
  { id: "3",  name: "Priya Nair",     role: "Laborer",     crew: "Crew B", supervisor: "Sara Chen", job: "Job B", costCenter: "CC-200", shiftStart: "06:30", minutesUntilBreak: 22, status: "about_to" },
  { id: "4",  name: "Jake Morales",   role: "Operator",    crew: "Crew C", supervisor: "Sara Chen", job: "Job C", costCenter: "CC-200", shiftStart: "07:00", minutesUntilBreak: 5,  status: "about_to" },
  { id: "5",  name: "Linda Tran",     role: "Electrician", crew: "Crew B", supervisor: "Tom Blake", job: "Job B", costCenter: "CC-200", shiftStart: "06:00", minutesLate: 18,       status: "late" },
  { id: "6",  name: "Carlos Vega",    role: "Laborer",     crew: "Crew C", supervisor: "Sara Chen", job: "Job C", costCenter: "CC-300", shiftStart: "06:00", minutesLate: 34,       status: "late" },
  { id: "7",  name: "Amy Fitzgerald", role: "Inspector",   crew: "Crew A", supervisor: "Tom Blake", job: "Job A", costCenter: "CC-100", shiftStart: "06:00", minutesLate: 7,        status: "late" },
  { id: "8",  name: "Devon King",     role: "Supervisor",  crew: "Crew D", supervisor: "Tom Blake", job: "Job B", costCenter: "CC-300", shiftStart: "05:30", minutesLate: 52,       status: "late" },
  { id: "9",  name: "Rosa Mendez",    role: "Laborer",     crew: "Crew D", supervisor: "Sara Chen", job: "Job C", costCenter: "CC-300", shiftStart: "06:00", penaltyAmount: 90.00,  penaltyCount: 1, status: "premium" },
  { id: "10", name: "Sam Park",       role: "Electrician", crew: "Crew B", supervisor: "Tom Blake", job: "Job B", costCenter: "CC-200", shiftStart: "06:00", penaltyAmount: 180.00, penaltyCount: 2, status: "premium" },
  { id: "11", name: "Nadia Volkov",   role: "Foreman",     crew: "Crew A", supervisor: "Sara Chen", job: "Job A", costCenter: "CC-100", shiftStart: "06:30", penaltyAmount: 270.00, penaltyCount: 3, status: "premium" },
];

const CREWS = ["Crew A", "Crew B", "Crew C", "Crew D"];

const OS = "Open Sans, sans-serif";
const OS_FVS: CSSProperties = { fontVariationSettings: '"wdth" 100' };

function StatusPill({ label, color, bg, borderColor }: { label: string; color: string; bg: string; borderColor: string }) {
  return (
    <div className="relative shrink-0" style={{ borderRadius: 30 }}>
      <div aria-hidden className="absolute inset-0 pointer-events-none border border-solid" style={{ borderColor, borderRadius: 30 }} />
      <div className="flex flex-row items-center justify-center size-full">
        <div className="flex gap-[8px] items-center justify-center px-[8px] py-[2px] relative" style={{ background: bg, borderRadius: 30 }}>
          <p className="font-bold text-[14px] leading-[20px] text-center whitespace-nowrap" style={{ color, fontFamily: OS, ...OS_FVS }}>{label}</p>
        </div>
      </div>
    </div>
  );
}

function AlertBadge({ label, color }: { label: string; color: string }) {
  return (
    <span className="inline-flex items-center rounded px-[6px] py-[2px] text-[11px] font-semibold leading-[16px]"
      style={{ background: color + "1a", color, fontFamily: OS }}>
      {label}
    </span>
  );
}

function CrewAlertButton({ crew, lateCount, onAlert, alerted }: { crew: string; lateCount: number; onAlert: () => void; alerted: boolean }) {
  if (lateCount === 0) return null;
  return (
    <ModusWcButton
      color={alerted ? "neutral" : "primary"}
      variant="filled"
      size="sm"
      disabled={alerted}
      onButtonClick={onAlert}
    >
      {alerted ? `${crew} Notified` : `Send Alert — ${crew} (${lateCount} late)`}
    </ModusWcButton>
  );
}

function EmployeeRow({ emp, idx, selected, onToggle, alerted, onAlert }: {
  emp: BreakEmployee; idx: number;
  selected: boolean; onToggle: () => void;
  alerted: boolean; onAlert: () => void;
}) {
  const rowBg = selected ? "#e8f2fa" : idx % 2 === 0 ? "#ffffff" : "#fafafa";

  const statusNode = () => {
    if (emp.status === "about_to") return (
      <p className="font-semibold text-[14px] leading-[20px] opacity-60" style={{ color: "#0063a3", fontFamily: OS, ...OS_FVS }}>
        In {emp.minutesUntilBreak} min
      </p>
    );
    if (emp.status === "late") return (
      <p className="font-semibold text-[14px] leading-[20px] opacity-60" style={{ color: "#ab1f26", fontFamily: OS, ...OS_FVS }}>
        {emp.minutesLate}m overdue
      </p>
    );
    return (
      <div>
        <p className="font-semibold text-[14px] leading-[20px] opacity-60" style={{ color: "#d97706", fontFamily: OS, ...OS_FVS }}>
          ${emp.penaltyAmount?.toFixed(2)}
        </p>
        <p className="text-[12px] leading-[16px] opacity-60" style={{ color: "#6a6e79", fontFamily: OS, ...OS_FVS }}>
          {emp.penaltyCount} violation{(emp.penaltyCount ?? 0) > 1 ? "s" : ""}
        </p>
      </div>
    );
  };

  return (
    <tr style={{ background: rowBg, borderBottom: "1px solid #e0e1e9" }}>
      <td className="px-[16px] py-[12px] w-[40px]">
        <StyledCheckbox checked={!!selected} onChange={onToggle} />
      </td>
      <td className="px-[16px] py-[12px]">
        <div className="flex items-center gap-[10px]">
          <div className="flex h-[32px] w-[32px] shrink-0 items-center justify-center rounded-full text-[12px] font-bold"
            style={{ background: "#252a2e", color: "#ffffff", fontFamily: OS, ...OS_FVS }}>
            {emp.name.split(" ").map(n => n[0]).join("").slice(0, 2)}
          </div>
          <div>
            <p className="font-semibold text-[14px] leading-[20px] whitespace-nowrap opacity-60" style={{ color: "#171c1e", fontFamily: OS, ...OS_FVS }}>{emp.name}</p>
            <p className="text-[12px] leading-[16px] opacity-60" style={{ color: "#6a6e79", fontFamily: OS, ...OS_FVS }}>{emp.role}</p>
          </div>
        </div>
      </td>
      <td className="px-[16px] py-[12px]">
        <p className="font-semibold text-[14px] leading-[20px] opacity-60 whitespace-nowrap" style={{ color: "#171c1e", fontFamily: OS, ...OS_FVS }}>{emp.crew}</p>
      </td>
      <td className="px-[16px] py-[12px]">
        <p className="font-semibold text-[14px] leading-[20px] opacity-60 whitespace-nowrap" style={{ color: "#171c1e", fontFamily: OS, ...OS_FVS }}>{emp.supervisor}</p>
      </td>
      <td className="px-[16px] py-[12px]">
        <p className="font-semibold text-[14px] leading-[20px] opacity-60 whitespace-nowrap" style={{ color: "#171c1e", fontFamily: OS, ...OS_FVS }}>{emp.job}</p>
      </td>
      <td className="px-[16px] py-[12px]">
        <p className="font-semibold text-[14px] leading-[20px] opacity-60 whitespace-nowrap" style={{ color: "#171c1e", fontFamily: OS, ...OS_FVS }}>{emp.costCenter}</p>
      </td>
      <td className="px-[16px] py-[12px]">
        <p className="font-semibold text-[14px] leading-[20px] opacity-60 whitespace-nowrap" style={{ color: "#171c1e", fontFamily: OS, ...OS_FVS }}>{emp.shiftStart}</p>
      </td>
      <td className="px-[16px] py-[12px]">{statusNode()}</td>
      <td className="px-[16px] py-[12px]">
        <ModusWcButton
          color={alerted ? "neutral" : "primary"}
          variant="filled"
          size="sm"
          disabled={alerted}
          onButtonClick={onAlert}
        >
          {alerted ? "Notified" : "Send Alert"}
        </ModusWcButton>
      </td>
    </tr>
  );
}

const SEARCH_PATH = "M10.0173 8.96129L9.51484 8.99879L9.20734 8.69129C11.0373 6.58379 10.9173 3.36629 8.83234 1.41629C6.74734 -0.533713 3.57484 -0.428713 1.60234 1.47629C-0.51266 3.52379 -0.53516 6.89129 1.54234 8.96129C3.49984 10.9188 6.61984 11.0013 8.68234 9.21629L8.98984 9.52379L8.95234 10.0113L11.8698 12.9288C12.1623 13.2213 12.6348 13.2213 12.9273 12.9288C13.2198 12.6363 13.2198 12.1638 12.9273 11.8713L10.0173 8.96129ZM7.90234 7.90379C6.43984 9.36629 4.05484 9.36629 2.59234 7.90379C1.12984 6.44129 1.12984 4.05629 2.59234 2.59379C4.05484 1.13129 6.43984 1.13129 7.90234 2.59379C9.36484 4.05629 9.36484 6.44129 7.90234 7.90379Z";
const CHEVRON_PATH = "M8.80125 0.323444C8.35875 -0.111556 7.64625 -0.104056 7.21125 0.323444L4.56375 2.97094L1.91625 0.323444C1.49625 -0.104056 0.75375 -0.104056 0.32625 0.323444C-0.10875 0.758444 -0.10875 1.47094 0.32625 1.91344L3.76875 5.35594C3.98625 5.57344 4.27875 5.68594 4.56375 5.68594C4.84875 5.68594 5.14125 5.57344 5.35875 5.35594L8.80125 1.91344C8.90566 1.80905 8.98848 1.68511 9.04498 1.5487C9.10149 1.41229 9.13057 1.26609 9.13057 1.11844C9.13057 0.970796 9.10149 0.824595 9.04498 0.688188C8.98848 0.551782 8.90566 0.427841 8.80125 0.323444Z";

function StyledCheckbox({ checked, onChange, indeterminate }: { checked: boolean; onChange: () => void; indeterminate?: boolean }) {
  return (
    <ModusWcCheckbox
      aria-label="Select row"
      size="sm"
      value={checked}
      indeterminate={!!indeterminate}
      onInputChange={() => onChange()}
    />
  );
}

function SearchIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 13.1467 13.1482" fill="none" style={{ flexShrink: 0 }}>
      <path d={SEARCH_PATH} fill="#6a6e79" />
    </svg>
  );
}
function ChevronIcon() {
  return (
    <svg width="10" height="6" viewBox="0 0 9.13057 5.68594" fill="none" style={{ flexShrink: 0 }}>
      <path d={CHEVRON_PATH} fill="#6a6e79" />
    </svg>
  );
}

function FilterInput({ placeholder, value, onChange, options }: {
  placeholder: string;
  value: string;
  onChange: (v: string) => void;
  options?: string[];
}) {
  return (
    <div className="flex-1 min-w-[120px] relative" style={{ borderRadius: 8 }}>
      <div className="bg-white h-[32px] relative w-full" style={{ borderRadius: 8 }}>
        <div aria-hidden className="absolute opacity-60 pointer-events-none" style={{ inset: "0 0.14% 0 0", borderRadius: 8 }}>
          <div aria-hidden className="absolute border border-solid border-[#6a6e79] pointer-events-none" style={{ inset: -1, borderRadius: 9 }} />
        </div>
        {options ? (
          <div className="flex items-center gap-[8px] px-[12px] size-full relative">
            <SearchIcon />
            <select
              value={value ?? ""}
              onChange={e => onChange(e.target.value)}
              className="flex-1 min-w-0 appearance-none bg-transparent outline-none text-[14px] leading-[20px] cursor-pointer"
              style={{ color: value ? "#171c1e" : "#6a6e79", fontFamily: OS, ...OS_FVS, border: "none" }}>
              <option value="">{placeholder}</option>
              {options.map(o => <option key={o} value={o}>{o}</option>)}
            </select>
            <ChevronIcon />
          </div>
        ) : (
          <div className="flex items-center gap-[8px] px-[12px] size-full relative">
            <SearchIcon />
            <input
              type="text"
              placeholder={placeholder}
              value={value ?? ""}
              onChange={e => onChange(e.target.value)}
              className="flex-1 min-w-0 bg-transparent outline-none text-[14px] leading-[20px] placeholder-[#6a6e79]"
              style={{ color: "#171c1e", fontFamily: OS, ...OS_FVS, border: "none" }} />
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Attestation Modal ────────────────────────────────────────────────────────
function AttestationModal({ day, onClose, onSubmit }: {
  day: { label: string; date: number };
  onClose: () => void;
  onSubmit: () => void;
}) {
  const [brokeBreak, setBrokeBreak] = useState<"yes" | "no" | null>(null);
  const [breakComment, setBreakComment] = useState("");
  const [hurt, setHurt] = useState<"yes" | "no" | null>(null);
  const [hurtComment, setHurtComment] = useState("");

  const dateStr = `Tue 2026/07/${day.date}`;

  const RadioRow = ({ label, selected, onSelect }: { label: string; selected: boolean; onSelect: () => void }) => (
    <button type="button" onClick={onSelect}
      className="flex items-center gap-[10px] w-full px-[14px] py-[12px] text-left transition-colors"
      style={{ background: selected ? "#e8f2fa" : "#f5f5f8", border: "none", cursor: "pointer", borderRadius: 0 }}>
      <div className="flex h-[18px] w-[18px] shrink-0 items-center justify-center rounded-full"
        style={{ border: `2px solid ${selected ? "#0063a3" : "#cbced4"}`, background: "#ffffff" }}>
        {selected && <div className="h-[8px] w-[8px] rounded-full" style={{ background: "#0063a3" }} />}
      </div>
      <span style={{ fontSize: 14, color: "#252a2e", fontFamily: OS, ...OS_FVS }}>{label}</span>
    </button>
  );

  return (
    <div className="fixed inset-0 flex items-center justify-center" style={{ zIndex: 200, background: "rgba(0,0,0,0.45)" }}
      onClick={e => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="bg-white rounded-[10px] shadow-[0_8px_40px_rgba(0,0,0,0.18)] flex flex-col"
        style={{ width: 520, maxHeight: "90vh", overflow: "hidden" }}>
        {/* Header */}
        <div className="flex items-center justify-between px-[24px] py-[20px]" style={{ borderBottom: "1px solid #e0e1e9" }}>
          <p style={{ fontSize: 24, fontWeight: 700, color: "#252a2e", fontFamily: OS, ...OS_FVS }}>Hello Adam!</p>
          <button type="button" onClick={onClose}
            className="flex h-[32px] w-[32px] items-center justify-center rounded-full hover:bg-[#f1f1f6] transition-colors"
            style={{ background: "transparent", border: "none", cursor: "pointer" }}>
            <X size={18} style={{ color: "#6a6e79" }} />
          </button>
        </div>

        <div className="overflow-y-auto flex-1 px-[24px] py-[20px] flex flex-col gap-[20px]">
          {/* Date selector */}
          <div className="relative">
            <select className="w-full appearance-none px-[12px] py-[10px] border border-[#e0e1e9] rounded-[6px] pr-[32px] outline-none"
              style={{ fontSize: 14, color: "#252a2e", fontFamily: OS, ...OS_FVS }}>
              <option>{dateStr}</option>
            </select>
            <ChevronDown size={14} className="absolute right-[10px] top-1/2 -translate-y-1/2 pointer-events-none" style={{ color: "#6a6e79" }} />
          </div>

          {/* Summary */}
          <div>
            <div className="flex items-center gap-[8px] mb-[10px]">
              <div className="flex h-[20px] w-[20px] shrink-0 items-center justify-center rounded-full" style={{ background: "#0063a3" }}>
                <span style={{ fontSize: 11, fontWeight: 700, color: "#ffffff", fontFamily: OS }}>i</span>
              </div>
              <p style={{ fontSize: 14, fontWeight: 600, color: "#252a2e", fontFamily: OS, ...OS_FVS, flex: 1 }}>Summary</p>
              <div className="flex h-[24px] w-[24px] items-center justify-center rounded-full" style={{ background: "#6a6e79" }}>
                <ChevronDown size={13} style={{ color: "#ffffff" }} />
              </div>
            </div>
            <div className="rounded-[6px] px-[16px] py-[14px]" style={{ background: "#dcedf9" }}>
              <p style={{ fontSize: 11, fontWeight: 700, color: "#252a2e", fontFamily: OS, ...OS_FVS, marginBottom: 10 }}>TOTAL</p>
              <div className="flex items-center">
                {[["REG","0.04"],["OT","0.00"],["DT","0.00"],["TVL","11.00"],["QUA","2.00"],["PD","0.00"]].map(([k, v], i) => (
                  <div key={k} className="flex-1 flex flex-col items-center" style={{ borderLeft: i > 0 ? "1px solid #a8c8e8" : undefined }}>
                    <p style={{ fontSize: 10, color: "#6a6e79", fontFamily: OS, ...OS_FVS, marginBottom: 2 }}>{k}</p>
                    <p style={{ fontSize: 14, fontWeight: 600, color: "#252a2e", fontFamily: OS, ...OS_FVS }}>{v}</p>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Did you take your breaks? */}
          <div>
            <p style={{ fontSize: 14, fontWeight: 700, color: "#252a2e", fontFamily: OS, ...OS_FVS, marginBottom: 10 }}>
              Did you take your breaks today? <span style={{ color: "#ab1f26" }}>*</span>
            </p>
            <div className="flex flex-col rounded-[6px] overflow-hidden" style={{ border: "1px solid #e0e1e9" }}>
              <RadioRow label="Yes" selected={brokeBreak === "yes"} onSelect={() => setBrokeBreak("yes")} />
              <div style={{ height: 1, background: "#e0e1e9" }} />
              <RadioRow label="No" selected={brokeBreak === "no"} onSelect={() => setBrokeBreak("no")} />
            </div>
            <div className="mt-[10px]">
              <p style={{ fontSize: 13, fontWeight: 600, color: "#252a2e", fontFamily: OS, ...OS_FVS, marginBottom: 4 }}>
                Additional Comments <span style={{ color: "#ab1f26" }}>*</span>
              </p>
              <input type="text" value={breakComment} onChange={e => setBreakComment(e.target.value)}
                className="w-full px-[12px] py-[9px] rounded-[6px] outline-none"
                style={{ border: `1px solid ${breakComment ? "#e0e1e9" : "#ab1f26"}`, fontSize: 14, fontFamily: OS, ...OS_FVS, color: "#252a2e" }} />
            </div>
          </div>

          {/* Were you hurt? */}
          <div>
            <p style={{ fontSize: 14, fontWeight: 700, color: "#252a2e", fontFamily: OS, ...OS_FVS, marginBottom: 10 }}>
              Were you hurt on the job today? <span style={{ color: "#ab1f26" }}>*</span>
            </p>
            <div className="flex flex-col rounded-[6px] overflow-hidden" style={{ border: "1px solid #e0e1e9" }}>
              <RadioRow label="Yes" selected={hurt === "yes"} onSelect={() => setHurt("yes")} />
              <div style={{ height: 1, background: "#e0e1e9" }} />
              <RadioRow label="No" selected={hurt === "no"} onSelect={() => setHurt("no")} />
            </div>
            <div className="mt-[10px]">
              <p style={{ fontSize: 13, fontWeight: 600, color: "#252a2e", fontFamily: OS, ...OS_FVS, marginBottom: 4 }}>
                Additional Comments
              </p>
              <input type="text" value={hurtComment} onChange={e => setHurtComment(e.target.value)}
                className="w-full px-[12px] py-[9px] rounded-[6px] outline-none"
                style={{ border: "1px solid #e0e1e9", fontSize: 14, fontFamily: OS, ...OS_FVS, color: "#252a2e" }} />
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-[10px] px-[24px] py-[16px]" style={{ borderTop: "1px solid #e0e1e9" }}>
          <button type="button" onClick={onClose}
            className="px-[20px] py-[9px] rounded-[6px] font-semibold transition-colors"
            style={{ background: "#ffffff", border: "1px solid #e0e1e9", color: "#464b52", fontSize: 14, fontFamily: OS, ...OS_FVS, cursor: "pointer" }}>
            Cancel
          </button>
          <button type="button"
            onClick={() => { if (brokeBreak && breakComment) { onSubmit(); onClose(); } }}
            className="px-[20px] py-[9px] rounded-[6px] font-semibold transition-colors"
            style={{ background: "#0063a3", color: "#ffffff", border: "none", fontSize: 14, fontFamily: OS, ...OS_FVS, cursor: "pointer" }}>
            Submit
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Attestation Panel ────────────────────────────────────────────────────────
function AttestationPanel({ days }: { days: { label: string; date: number }[] }) {
  const [attested, setAttested] = useState<Set<number>>(new Set());
  const [collapsed, setCollapsed] = useState(false);
  const [activeDay, setActiveDay] = useState<{ label: string; date: number } | null>(null);

  return (
    <div className="mx-[16px] my-[14px] rounded-[8px] border overflow-hidden" style={{ borderColor: "#fbad26", background: "#fffbf0" }}>
      {/* Header row */}
      <div className="flex items-center gap-[10px] px-[14px] py-[10px]" style={{ background: "#fffbf0" }}>
        <div className="flex h-[22px] w-[22px] shrink-0 items-center justify-center rounded-full" style={{ background: "#fbad26" }}>
          <span style={{ fontSize: 12, fontWeight: 700, color: "#ffffff", fontFamily: OS }}>i</span>
        </div>
        <p style={{ fontSize: 13, fontWeight: 700, color: "#252a2e", fontFamily: OS, ...OS_FVS, flex: 1 }}>Daily Attestation</p>
        <span style={{ fontSize: 12, fontWeight: 600, color: "#6a6e79", fontFamily: OS, ...OS_FVS, marginRight: 8 }}>
          {attested.size}/{days.length}
        </span>
        <button type="button" onClick={() => setCollapsed(v => !v)}
          className="flex h-[24px] w-[24px] items-center justify-center rounded-full transition-colors"
          style={{ background: "#e0e1e9", border: "none", cursor: "pointer" }}>
          {collapsed
            ? <ChevronDown size={13} style={{ color: "#464b52" }} />
            : <ChevronUp size={13} style={{ color: "#464b52" }} />}
        </button>
      </div>

      {!collapsed && (
        <div className="px-[14px] pb-[14px]">
          <p style={{ fontSize: 12, color: "#6a6e79", fontFamily: OS, ...OS_FVS, marginBottom: 10 }}>
            *Click on date to complete or view.
          </p>
          <div className="flex gap-[8px] flex-wrap">
            {days.map(({ label, date }) => {
              const done = attested.has(date);
              return (
                <button key={date} type="button" onClick={() => setActiveDay({ label, date })}
                  className="flex flex-col items-center justify-center rounded-[6px] transition-all"
                  style={{
                    width: 56, height: 64, cursor: "pointer",
                    background: done ? "#e8f5e9" : "#ffffff",
                    border: `2px solid ${done ? "#2e7d32" : "#fbad26"}`,
                  }}>
                  <div className="flex h-[18px] w-[18px] items-center justify-center rounded-full mb-[4px]"
                    style={{ background: done ? "#2e7d32" : "#fbad26" }}>
                    {done
                      ? <Check size={10} style={{ color: "#ffffff" }} strokeWidth={3} />
                      : <X size={10} style={{ color: "#ffffff" }} strokeWidth={3} />}
                  </div>
                  <p style={{ fontSize: 11, fontWeight: 700, color: done ? "#2e7d32" : "#c47f00", fontFamily: OS, ...OS_FVS, lineHeight: 1.2 }}>{label}</p>
                  <p style={{ fontSize: 13, fontWeight: 700, color: done ? "#2e7d32" : "#c47f00", fontFamily: OS, ...OS_FVS, lineHeight: 1.2 }}>{date}</p>
                </button>
              );
            })}
          </div>
        </div>
      )}

      {activeDay && (
        <AttestationModal
          day={activeDay}
          onClose={() => setActiveDay(null)}
          onSubmit={() => {
            setAttested(prev => new Set([...prev, activeDay.date]));
            setActiveDay(null);
          }}
        />
      )}
    </div>
  );
}

// ─── Clock In / Out Page ──────────────────────────────────────────────────────
const CLOCK_MOCK_ENTRIES = [
  { date: "Tue, Jul 22", jobNum: "740-EC2", start: "7:02 AM", end: "3:45 PM", dept: "Main Orders", job: "003699 - AEP Carrollton Sub", phase: "5554 - Renewal - Asphalt", payRule: "5b", reg: 8, ot: 0.72, ot2: 0, qty: 0, travel: 1.00, perDiem: 0 },
  { date: "Tue, Jul 22", jobNum: "740-EC2", start: "7:02 AM", end: "3:45 PM", dept: "Main Orders", job: "003699 - AEP Carrollton Sub", phase: "Break", payRule: "5b", reg: 0, ot: 0, ot2: 0, qty: 0, travel: 0, perDiem: 0 },
  { date: "Wed, Jul 23", jobNum: "740-EC2", start: "6:58 AM", end: "3:32 PM", dept: "Main Orders", job: "003699 - AEP Carrollton Sub", phase: "5554 - Renewal - Asphalt", payRule: "5b", reg: 8, ot: 0.57, ot2: 0, qty: 0, travel: 1.00, perDiem: 0 },
  { date: "Thu, Jul 24", jobNum: "740-EC2", start: "7:01 AM", end: "4:18 PM", dept: "Main Orders", job: "003699 - AEP Carrollton Sub", phase: "5554 - Renewal - Asphalt", payRule: "5b", reg: 8, ot: 1.28, ot2: 0, qty: 0, travel: 1.00, perDiem: 0 },
  { date: "Mon, Jul 28", jobNum: "740-EC2", start: "6:55 AM", end: "3:40 PM", dept: "Main Orders", job: "003699 - AEP Carrollton Sub", phase: "5554 - Renewal - Asphalt", payRule: "5b", reg: 8, ot: 0.75, ot2: 0, qty: 0, travel: 1.00, perDiem: 0 },
];

function ClockDisplay({ elapsed, clocked }: { elapsed: number; clocked: "out" | "in" | "break" }) {
  const now = new Date();
  const dateStr = now.toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric" });
  const h = Math.floor(elapsed / 3600).toString().padStart(2, "0");
  const m = Math.floor((elapsed % 3600) / 60).toString().padStart(2, "0");
  const s = (elapsed % 60).toString().padStart(2, "0");
  const timeStr = `${h}:${m}:${s}`;

  const statusColor = clocked === "break" ? "#d97706" : clocked === "in" ? "#10b981" : "#6a6e79";
  const statusLabel = clocked === "break" ? "On Break" : clocked === "in" ? "On the Clock" : "Not Clocked In";

  return (
    <div className="bg-white content-stretch flex flex-col items-start py-[8px] relative w-full">
      <div className="flex flex-col font-normal h-[24px] justify-center leading-[0] relative shrink-0 text-[12px] text-black text-center w-full"
        style={{ fontFamily: OS, ...OS_FVS }}>
        <p className="leading-[20px]">{dateStr}</p>
      </div>
      <div className="flex flex-col font-bold h-[40px] justify-center leading-[0] relative shrink-0 text-[30px] text-black text-center w-full"
        style={{ fontFamily: OS, ...OS_FVS }}>
        <p className="leading-[40px]">{timeStr}</p>
      </div>
      <div className="content-stretch flex gap-[4px] items-center justify-center relative shrink-0 w-full mt-[4px]">
        <div className="size-[8px] rounded-full shrink-0" style={{ background: statusColor }} />
        <p className="font-bold text-[12px] leading-[20px]" style={{ color: statusColor, fontFamily: OS, ...OS_FVS }}>{statusLabel}</p>
      </div>
    </div>
  );
}

function ClockInOutPage() {
  const [clocked, setClocked] = useState<"out" | "in" | "break">("out");
  const [elapsed, setElapsed] = useState(0);
  const [breakElapsed, setBreakElapsed] = useState(0);
  const [startTime, setStartTime] = useState<Date | null>(null);
  const [breakStart, setBreakStart] = useState<Date | null>(null);
  const [crew, setCrew] = useState("740 - Adam Hazey's Crew");
  const [dept, setDept] = useState("3300 - Job Cost");
  const [job, setJob] = useState("003699 - AEP Carrollton Sub");
  const [phase, setPhase] = useState("5554 - Renewal - Asphalt");
  const [travel, setTravel] = useState("1.00");
  const [qty, setQty] = useState("0");
  const [perDiem, setPerDiem] = useState(false);
  const [comment, setComment] = useState("");
  const [showForm, setShowForm] = useState(false);
  const [timeline, setTimeline] = useState<{ time: string; label: string; sub: string; color: string }[]>([]);
  const [breakRows, setBreakRows] = useState<{ start: string; end: string | null }[]>([]);
  const [showEarlyBreakModal, setShowEarlyBreakModal] = useState(false);
  const MANDATORY_BREAK = 30; // seconds for testing (change to 30 * 60 for production)

  useEffect(() => {
    if (clocked === "out") return;
    const id = setInterval(() => {
      if (clocked === "in" && startTime) setElapsed(Math.floor((Date.now() - startTime.getTime()) / 1000));
      if (clocked === "break" && breakStart) setBreakElapsed(Math.floor((Date.now() - breakStart.getTime()) / 1000));
    }, 1000);
    return () => clearInterval(id);
  }, [clocked, startTime, breakStart]);



  const fmt = (s: number) => {
    const h = Math.floor(s / 3600).toString().padStart(2, "0");
    const m = Math.floor((s % 3600) / 60).toString().padStart(2, "0");
    const sec = (s % 60).toString().padStart(2, "0");
    return `${h}:${m}:${sec}`;
  };

  const now = new Date();
  const totalReg = CLOCK_MOCK_ENTRIES.reduce((s, e) => s + e.reg, 0);
  const totalOT  = CLOCK_MOCK_ENTRIES.reduce((s, e) => s + e.ot, 0);
  const totalTravel = CLOCK_MOCK_ENTRIES.reduce((s, e) => s + e.travel, 0);

  // Colors per state
  const stateColor = clocked === "out" ? "#0063a3" : clocked === "break" ? "#d97706" : "#ab1f26";
  const stateColorLight = clocked === "out" ? "rgba(0,99,163,0.15)" : clocked === "break" ? "rgba(215,119,6,0.15)" : "rgba(171,31,38,0.15)";
  const stateColorMid   = clocked === "out" ? "rgba(0,99,163,0.28)" : clocked === "break" ? "rgba(215,119,6,0.28)" : "rgba(171,31,38,0.28)";
  const stateColorStrong= clocked === "out" ? "rgba(0,99,163,0.50)" : clocked === "break" ? "rgba(215,119,6,0.50)" : "rgba(171,31,38,0.50)";
  const btnLabel = clocked === "out" ? "CLOCK IN" : clocked === "break" ? "END BREAK" : "CLOCK OUT";

  const confirmEndBreak = () => {
    const t = new Date().toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
    setClocked("in"); setBreakStart(null); setShowEarlyBreakModal(false);
    setTimeline(prev => [{ time: t, label: "Break Ended", sub: `After ${fmt(breakElapsed)}`, color: "#0063a3" }, ...prev]);
    setBreakRows(prev => prev.map((r, i) => i === prev.length - 1 && r.end === null ? { ...r, end: t } : r));
  };

  const handleMainBtn = () => {
    const t = new Date().toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
    if (clocked === "out") {
      setClocked("in"); setStartTime(new Date()); setElapsed(0);
      setTimeline(prev => [{ time: t, label: "Clocked In", sub: job, color: "#0063a3" }, ...prev]);
    } else if (clocked === "in") {
      setClocked("out"); setStartTime(null); setElapsed(0);
      setTimeline(prev => [{ time: t, label: "Clocked Out", sub: `After ${fmt(elapsed)}`, color: "#ab1f26" }, ...prev]);
    } else {
      if (breakElapsed < MANDATORY_BREAK) {
        setShowEarlyBreakModal(true);
      } else {
        confirmEndBreak();
      }
    }
  };

  const handleBreak = () => {
    const t = new Date().toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
    setClocked("break"); setBreakStart(new Date()); setBreakElapsed(0);
    setShowBreakAlert(false);
    setTimeline(prev => [{ time: t, label: "Break Started", sub: "Taking a break", color: "#d97706" }, ...prev]);
    setBreakRows(prev => [...prev, { start: t, end: null }]);
  };

  const [showBreakAlert, setShowBreakAlert] = useState(false);
  const BREAK_INTERVAL = 30; // 30 seconds for testing (change to 30 * 60 for production)

  useEffect(() => {
    if (clocked !== "in") { setShowBreakAlert(false); return; }
    if (elapsed >= BREAK_INTERVAL) setShowBreakAlert(true);
  }, [elapsed, clocked]);

  const SelectField = ({ label, value, onChange, options }: { label: string; value: string; onChange: (v: string) => void; options: string[] }) => (
    <div>
      <p style={{ fontSize: 11, fontWeight: 600, color: "#6a6e79", fontFamily: OS, ...OS_FVS, marginBottom: 4, textTransform: "uppercase", letterSpacing: "0.05em" }}>{label}</p>
      <div className="relative">
        <select value={value} onChange={e => onChange(e.target.value)}
          className="w-full appearance-none px-[10px] py-[8px] border border-[#e0e1e9] rounded-[6px] pr-[28px] outline-none bg-white"
          style={{ fontSize: 13, color: "#252a2e", fontFamily: OS, ...OS_FVS }}>
          {options.map(o => <option key={o}>{o}</option>)}
        </select>
        <ChevronDown size={12} className="absolute right-[8px] top-1/2 -translate-y-1/2 pointer-events-none" style={{ color: "#6a6e79" }} />
      </div>
    </div>
  );

  const fmtHMS = (s: number) => {
    const h = Math.floor(s / 3600).toString().padStart(2, "0");
    const m = Math.floor((s % 3600) / 60).toString().padStart(2, "0");
    const sec = (s % 60).toString().padStart(2, "0");
    return `${h}h ${m}m ${sec}s`;
  };

  const breakRemaining = Math.max(0, MANDATORY_BREAK - breakElapsed);
  const breakRemainingFmt = `${Math.floor(breakRemaining / 60)}:${(breakRemaining % 60).toString().padStart(2, "0")}`;

  return (
    <div style={{ background: "#f1f1f6", fontFamily: OS }}>
      {/* Early break modal */}
      {showEarlyBreakModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center" style={{ background: "rgba(0,0,0,0.45)" }}>
          <div className="bg-white rounded-[12px] shadow-[0_8px_32px_rgba(0,0,0,0.18)] p-[32px]" style={{ width: 420, maxWidth: "90vw" }}>
            <div className="flex items-center gap-[12px] mb-[16px]">
              <div className="flex h-[40px] w-[40px] items-center justify-center rounded-full shrink-0" style={{ background: "#fef3e2" }}>
                <AlertTriangle size={20} style={{ color: "#d97706" }} />
              </div>
              <p style={{ fontSize: 17, fontWeight: 700, color: "#252a2e", fontFamily: OS, ...OS_FVS }}>Clocking Back In Early</p>
            </div>
            <p style={{ fontSize: 13, color: "#464b52", fontFamily: OS, ...OS_FVS, lineHeight: 1.6, marginBottom: 8 }}>
              You are clocking back in early. Please confirm that this is your intention, or wait until your break is finished.
            </p>
            <p style={{ fontSize: 13, fontWeight: 600, color: "#d97706", fontFamily: OS, ...OS_FVS, marginBottom: 24 }}>
              Time remaining on break: {breakRemainingFmt}
            </p>
            <div className="flex gap-[12px]">
              <button type="button" onClick={() => setShowEarlyBreakModal(false)}
                className="flex-1 py-[10px] rounded-[8px]"
                style={{ border: "1px solid #e0e1e9", background: "#ffffff", cursor: "pointer", fontSize: 13, fontWeight: 600, color: "#252a2e", fontFamily: OS }}>
                Wait — Stay on Break
              </button>
              <button type="button" onClick={confirmEndBreak}
                className="flex-1 py-[10px] rounded-[8px]"
                style={{ border: "none", background: "#0063a3", cursor: "pointer", fontSize: 13, fontWeight: 600, color: "#ffffff", fontFamily: OS }}>
                Confirm Early Clock In
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Top header */}
      <div className="px-[32px] pt-[24px] pb-[20px]" style={{ borderBottom: "1px solid #e0e1e9", background: "#ffffff" }}>
        <p style={{ fontSize: 22, fontWeight: 700, color: "#252a2e", fontFamily: OS, ...OS_FVS }}>Clock In &amp; Out</p>
        <p style={{ fontSize: 13, color: "#6a6e79", fontFamily: OS, ...OS_FVS }}>
          {now.toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric", year: "numeric" })}
        </p>
      </div>

      <div className="flex" style={{ minHeight: 520, overflow: "hidden" }}>
        {/* ── Left panel: concentric circle clock ── */}
        <div className="flex flex-col items-center justify-start flex-1 pt-[56px] pb-[48px] px-[32px]" style={{ minWidth: 0, overflow: "hidden" }}>
          {/* Clock display */}
          <div className="w-full mb-[24px]" style={{ maxWidth: 420 }}>
            <ClockDisplay elapsed={elapsed} clocked={clocked} />
          </div>

          {/* Break alert banner */}
          {showBreakAlert && (
            <div className="w-full flex items-center gap-[12px] mb-[24px] px-[16px] py-[12px] rounded-[8px]"
              style={{ background: "#fffbeb", border: "1px solid #fbbf24", maxWidth: 420 }}>
              <AlertTriangle size={18} style={{ color: "#d97706", flexShrink: 0 }} />
              <div className="flex-1">
                <p style={{ fontSize: 13, fontWeight: 700, color: "#92400e", fontFamily: OS, ...OS_FVS }}>Break Reminder</p>
                <p style={{ fontSize: 12, color: "#b45309", fontFamily: OS, ...OS_FVS }}>
                  You've been clocked in for {Math.floor(elapsed / 60)} min. Time to take a break!
                </p>
              </div>
              <button type="button" onClick={handleBreak}
                className="rounded-[6px] px-[10px] py-[6px] shrink-0"
                style={{ background: "#d97706", border: "none", cursor: "pointer", color: "#ffffff", fontSize: 12, fontWeight: 600, fontFamily: OS }}>
                Take Break
              </button>
            </div>
          )}

          {/* Concentric rings */}
          <style>{`
            @keyframes clock-pulse {
              0%   { transform: scale(1);    opacity: 1; }
              50%  { transform: scale(1.07); opacity: 0.7; }
              100% { transform: scale(1);    opacity: 1; }
            }
            .ring-outer { animation: clock-pulse 2.4s ease-in-out infinite; }
            .ring-mid   { animation: clock-pulse 2.4s ease-in-out infinite 0.3s; }
            .ring-inner { animation: clock-pulse 2.4s ease-in-out infinite 0.6s; }
          `}</style>
          <div className="relative flex items-center justify-center" style={{ width: 260, height: 260, flexShrink: 0 }}>
            <div className="ring-outer absolute rounded-full" style={{ width: 260, height: 260, background: stateColorLight }} />
            <div className="ring-mid absolute rounded-full" style={{ width: 200, height: 200, background: stateColorMid }} />
            <div className="ring-inner absolute rounded-full" style={{ width: 148, height: 148, background: stateColorStrong }} />
            {/* Main button */}
            <button type="button" onClick={handleMainBtn}
              className="relative flex items-center justify-center rounded-full font-black transition-transform active:scale-95"
              style={{ width: 104, height: 104, background: stateColor, border: "none", cursor: "pointer", color: "#ffffff", fontSize: 13, letterSpacing: "0.08em", fontFamily: OS, fontWeight: 900, boxShadow: `0 4px 24px ${stateColorStrong}`, textAlign: "center", lineHeight: 1.2 }}>
              {btnLabel}
            </button>
          </div>

          {/* Sub-action buttons */}
          {clocked === "in" && (
            <div className="flex items-center gap-[40px] mt-[32px]">
              <button type="button"
                onClick={() => { setShowForm(v => !v); if (!showForm) { setClocked("out"); setStartTime(null); setElapsed(0); setBreakStart(null); setBreakElapsed(0); } }}
                className="flex flex-col items-center gap-[6px]"
                style={{ background: "transparent", border: "none", cursor: "pointer" }}>
                <div className="flex h-[48px] w-[48px] items-center justify-center rounded-full bg-white shadow-[0_2px_8px_rgba(0,0,0,0.12)]">
                  <Briefcase size={20} style={{ color: "#464b52" }} />
                </div>
                <p style={{ fontSize: 11, color: "#6a6e79", fontFamily: OS, ...OS_FVS }}>Edit Job</p>
              </button>
              <button type="button" onClick={handleBreak}
                className="flex flex-col items-center gap-[6px]"
                style={{ background: "transparent", border: "none", cursor: "pointer" }}>
                <div className="flex h-[48px] w-[48px] items-center justify-center rounded-full bg-white shadow-[0_2px_8px_rgba(0,0,0,0.12)]">
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#464b52" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M17 8h1a4 4 0 0 1 0 8h-1" />
                    <path d="M3 8h14v9a4 4 0 0 1-4 4H7a4 4 0 0 1-4-4Z" />
                    <line x1="6" y1="2" x2="6" y2="4" />
                    <line x1="10" y1="2" x2="10" y2="4" />
                    <line x1="14" y1="2" x2="14" y2="4" />
                  </svg>
                </div>
                <p style={{ fontSize: 11, color: "#6a6e79", fontFamily: OS, ...OS_FVS }}>Take Break</p>
              </button>

            </div>
          )}

          {/* Collapsible job form */}
          {(showForm || clocked === "out") && (
            <div className="mt-[28px] w-full bg-white rounded-[10px] shadow-[0_2px_12px_rgba(0,0,0,0.08)] p-[20px]" style={{ maxWidth: 420 }}>
              <p style={{ fontSize: 13, fontWeight: 700, color: "#0e416c", fontFamily: OS, ...OS_FVS, marginBottom: 14 }}>Job Details</p>
              <div className="grid grid-cols-2 gap-[12px]">
                <SelectField label="Crew" value={crew} onChange={setCrew} options={["740 - Adam Hazey's Crew", "Crew B", "Crew C"]} />
                <SelectField label="Department" value={dept} onChange={setDept} options={["3300 - Job Cost", "3400 - Operations", "3500 - Admin"]} />
                <div className="col-span-2">
                  <SelectField label="Job" value={job} onChange={setJob} options={["003699 - AEP Carrollton Sub", "003700 - Job B", "003701 - Job C"]} />
                </div>
                <SelectField label="Phase" value={phase} onChange={setPhase} options={["5554 - Renewal - Asphalt", "5555 - Phase B", "5556 - Phase C"]} />
                <div>
                  <p style={{ fontSize: 11, fontWeight: 600, color: "#6a6e79", fontFamily: OS, ...OS_FVS, marginBottom: 4, textTransform: "uppercase", letterSpacing: "0.05em" }}>Travel</p>
                  <input type="text" value={travel} onChange={e => setTravel(e.target.value)}
                    className="w-full px-[10px] py-[8px] border border-[#e0e1e9] rounded-[6px] outline-none bg-white"
                    style={{ fontSize: 13, color: "#252a2e", fontFamily: OS, ...OS_FVS }} />
                </div>
                <div>
                  <p style={{ fontSize: 11, fontWeight: 600, color: "#6a6e79", fontFamily: OS, ...OS_FVS, marginBottom: 4, textTransform: "uppercase", letterSpacing: "0.05em" }}>Quantity</p>
                  <input type="text" value={qty} onChange={e => setQty(e.target.value)}
                    className="w-full px-[10px] py-[8px] border border-[#e0e1e9] rounded-[6px] outline-none bg-white"
                    style={{ fontSize: 13, color: "#252a2e", fontFamily: OS, ...OS_FVS }} />
                </div>
                <button type="button" onClick={() => setPerDiem(v => !v)} className="flex items-center gap-[8px]"
                  style={{ background: "transparent", border: "none", padding: 0, cursor: "pointer", alignSelf: "center" }}>
                  <div className="h-[16px] w-[16px] rounded-[3px] flex items-center justify-center shrink-0"
                    style={{ background: perDiem ? "#0063a3" : "#ffffff", border: `1px solid ${perDiem ? "#0063a3" : "#cbced4"}`, boxShadow: "0 1px 2px rgba(0,0,0,0.05)" }}>
                    {perDiem && <Check size={10} className="text-white" strokeWidth={3} />}
                  </div>
                  <span style={{ fontSize: 13, color: "#252a2e", fontFamily: OS, ...OS_FVS }}>Per Diem</span>
                </button>
                <div className="col-span-2">
                  <p style={{ fontSize: 11, fontWeight: 600, color: "#6a6e79", fontFamily: OS, ...OS_FVS, marginBottom: 4, textTransform: "uppercase", letterSpacing: "0.05em" }}>Comment</p>
                  <input type="text" value={comment} onChange={e => setComment(e.target.value)} placeholder="Optional note..."
                    className="w-full px-[10px] py-[8px] border border-[#e0e1e9] rounded-[6px] outline-none bg-white placeholder-[#b0b7c3]"
                    style={{ fontSize: 13, color: "#252a2e", fontFamily: OS, ...OS_FVS }} />
                </div>
              </div>
            </div>
          )}

          {/* Timesheet table — inside left panel, below circle/form */}
          <div className="w-full mt-[32px] rounded-[8px] overflow-hidden" style={{ border: "1px solid #e0e1e9" }}>
            <div className="px-[16px] py-[12px]" style={{ background: "#0e416c" }}>
              <p style={{ fontSize: 14, fontWeight: 700, color: "#ffffff", fontFamily: OS, ...OS_FVS }}>
                Timesheet for Pay Period August 1 – August 7, 2026
              </p>
            </div>
            <AttestationPanel days={[
              { label: "Tue", date: 22 },
              { label: "Wed", date: 23 },
              { label: "Thu", date: 24 },
              { label: "Mon", date: 28 },
            ]} />
            <div>
              <table className="w-full border-collapse" style={{ tableLayout: "fixed" }}>
                <thead>
                  <tr style={{ background: "#e0e1e9" }}>
                    {["Date", "Job #", "Start", "End", "Dept", "Job", "Phase", "Rule", "Reg", "OT", "OT2", "Qty", "Travel", "Per Diem"].map(h => (
                      <th key={h} className="px-[6px] py-[6px] text-left" style={{ borderBottom: "1px solid #cbced4" }}>
                        <p style={{ fontSize: 10, fontWeight: 600, color: "#6a6e79", fontFamily: OS, ...OS_FVS, whiteSpace: "nowrap" }}>{h}</p>
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {CLOCK_MOCK_ENTRIES.map((e, i) => (
                    <tr key={i} style={{ background: i % 2 === 0 ? "#ffffff" : "#fafafa", borderBottom: "1px solid #e0e1e9" }}>
                      <td className="px-[6px] py-[6px]"><p style={{ fontSize: 11, color: "#252a2e", fontFamily: OS, ...OS_FVS, whiteSpace: "nowrap" }}>{e.date}</p></td>
                      <td className="px-[6px] py-[6px]"><p style={{ fontSize: 11, color: "#252a2e", fontFamily: OS, ...OS_FVS, whiteSpace: "nowrap" }}>{e.jobNum}</p></td>
                      <td className="px-[6px] py-[6px]"><p style={{ fontSize: 11, color: "#252a2e", fontFamily: OS, ...OS_FVS, whiteSpace: "nowrap" }}>{e.start}</p></td>
                      <td className="px-[6px] py-[6px]"><p style={{ fontSize: 11, color: "#252a2e", fontFamily: OS, ...OS_FVS, whiteSpace: "nowrap" }}>{e.end}</p></td>
                      <td className="px-[6px] py-[6px]" style={{ maxWidth: 90 }}><p style={{ fontSize: 11, color: "#252a2e", fontFamily: OS, ...OS_FVS, wordBreak: "break-word" }}>{e.dept}</p></td>
                      <td className="px-[6px] py-[6px]" style={{ maxWidth: 120 }}><p style={{ fontSize: 11, color: "#252a2e", fontFamily: OS, ...OS_FVS, wordBreak: "break-word" }}>{e.job}</p></td>
                      <td className="px-[6px] py-[6px]" style={{ maxWidth: 110 }}><p style={{ fontSize: 11, color: "#252a2e", fontFamily: OS, ...OS_FVS, wordBreak: "break-word" }}>{e.phase}</p></td>
                      <td className="px-[6px] py-[6px]"><p style={{ fontSize: 11, color: "#252a2e", fontFamily: OS, ...OS_FVS }}>{e.payRule}</p></td>
                      <td className="px-[6px] py-[6px] text-right"><p style={{ fontSize: 11, color: "#252a2e", fontFamily: OS, ...OS_FVS }}>{e.reg > 0 ? e.reg.toFixed(2) : "—"}</p></td>
                      <td className="px-[6px] py-[6px] text-right"><p style={{ fontSize: 11, color: e.ot > 0 ? "#0063a3" : "#252a2e", fontFamily: OS, ...OS_FVS }}>{e.ot > 0 ? e.ot.toFixed(2) : "—"}</p></td>
                      <td className="px-[6px] py-[6px] text-right"><p style={{ fontSize: 11, color: "#252a2e", fontFamily: OS, ...OS_FVS }}>{e.ot2 > 0 ? e.ot2.toFixed(2) : "—"}</p></td>
                      <td className="px-[6px] py-[6px] text-right"><p style={{ fontSize: 11, color: "#252a2e", fontFamily: OS, ...OS_FVS }}>{e.qty > 0 ? e.qty : "—"}</p></td>
                      <td className="px-[6px] py-[6px] text-right"><p style={{ fontSize: 11, color: "#252a2e", fontFamily: OS, ...OS_FVS }}>{e.travel > 0 ? e.travel.toFixed(2) : "—"}</p></td>
                      <td className="px-[6px] py-[6px] text-center"><p style={{ fontSize: 11, color: "#252a2e", fontFamily: OS, ...OS_FVS }}>{e.perDiem > 0 ? `$${e.perDiem}` : "—"}</p></td>
                    </tr>
                  ))}
                  {breakRows.map((br, i) => (
                    <tr key={`break-${i}`} style={{ background: "#fffbeb", borderBottom: "1px solid #fde68a" }}>
                      <td className="px-[10px] py-[8px]"><p style={{ fontSize: 12, color: "#92400e", fontFamily: OS, ...OS_FVS, whiteSpace: "nowrap" }}>
                        {now.toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" })}
                      </p></td>
                      <td className="px-[10px] py-[8px]"><p style={{ fontSize: 12, color: "#92400e", fontFamily: OS, ...OS_FVS }}>—</p></td>
                      <td className="px-[10px] py-[8px]"><p style={{ fontSize: 12, color: "#92400e", fontFamily: OS, ...OS_FVS, whiteSpace: "nowrap" }}>{br.start}</p></td>
                      <td className="px-[10px] py-[8px]">
                        <p style={{ fontSize: 12, color: "#92400e", fontFamily: OS, ...OS_FVS, whiteSpace: "nowrap" }}>
                          {br.end ?? "—"}
                        </p>
                      </td>
                      <td className="px-[10px] py-[8px]"><p style={{ fontSize: 12, color: "#92400e", fontFamily: OS, ...OS_FVS }}>—</p></td>
                      <td className="px-[10px] py-[8px]"><p style={{ fontSize: 12, color: "#92400e", fontFamily: OS, ...OS_FVS }}>—</p></td>
                      <td className="px-[10px] py-[8px]">
                        <span style={{ fontSize: 11, fontWeight: 600, color: "#92400e", background: "#fde68a", borderRadius: 4, padding: "2px 6px", fontFamily: OS }}>Break</span>
                      </td>
                      <td colSpan={7} className="px-[10px] py-[8px]"><p style={{ fontSize: 12, color: "#b45309", fontFamily: OS, ...OS_FVS }}>—</p></td>
                    </tr>
                  ))}
                  <tr style={{ background: "#f1f1f6", borderTop: "2px solid #e0e1e9" }}>
                    <td colSpan={8} className="px-[10px] py-[8px]"><p style={{ fontSize: 12, fontWeight: 700, color: "#252a2e", fontFamily: OS, ...OS_FVS }}>Totals</p></td>
                    <td className="px-[10px] py-[8px] text-right"><p style={{ fontSize: 12, fontWeight: 700, color: "#252a2e", fontFamily: OS, ...OS_FVS }}>{totalReg.toFixed(2)}</p></td>
                    <td className="px-[10px] py-[8px] text-right"><p style={{ fontSize: 12, fontWeight: 700, color: "#0063a3", fontFamily: OS, ...OS_FVS }}>{totalOT.toFixed(2)}</p></td>
                    <td className="px-[10px] py-[8px] text-right"><p style={{ fontSize: 12, fontWeight: 700, color: "#252a2e", fontFamily: OS, ...OS_FVS }}>—</p></td>
                    <td className="px-[10px] py-[8px] text-right"><p style={{ fontSize: 12, fontWeight: 700, color: "#252a2e", fontFamily: OS, ...OS_FVS }}>—</p></td>
                    <td className="px-[10px] py-[8px] text-right"><p style={{ fontSize: 12, fontWeight: 700, color: "#252a2e", fontFamily: OS, ...OS_FVS }}>{totalTravel.toFixed(2)}</p></td>
                    <td className="px-[10px] py-[8px]" />
                  </tr>
                </tbody>
              </table>
            </div>
          </div>
        </div>

        {/* ── Right panel: stats + timeline ── */}
        <div className="flex flex-col overflow-y-auto" style={{ width: 300, flexShrink: 0, borderLeft: "1px solid #e0e1e9", background: "#ffffff", padding: "28px 20px", gap: 0 }}>
          <p style={{ fontSize: 18, fontWeight: 700, color: "#252a2e", fontFamily: OS, ...OS_FVS, marginBottom: 24 }}>
            Today · {now.toLocaleDateString("en-US", { month: "short", day: "numeric" })}
          </p>

          {/* Stats rows */}
          {[
            { label: "Total Hours", value: clocked !== "out" ? fmtHMS(elapsed) : "00h 00m 00s", bold: true },
          ].map(row => (
            <div key={row.label} className="flex items-baseline justify-between py-[16px]" style={{ borderBottom: "1px solid #e0e1e9" }}>
              <p style={{ fontSize: 13, color: "#6a6e79", fontFamily: OS, ...OS_FVS }}>{row.label}</p>
              <p style={{ fontSize: row.bold ? 22 : 14, fontWeight: row.bold ? 700 : 400, color: "#252a2e", fontFamily: OS, ...OS_FVS, letterSpacing: row.bold ? "-0.5px" : 0 }}>{row.value}</p>
            </div>
          ))}
          <div className="flex items-center justify-between py-[16px]" style={{ borderBottom: "1px solid #e0e1e9" }}>
            <p style={{ fontSize: 13, color: "#6a6e79", fontFamily: OS, ...OS_FVS }}>Current Status</p>
            <div className="flex items-center gap-[8px]">
              <p style={{ fontSize: 14, fontWeight: 600, color: stateColor, fontFamily: OS, ...OS_FVS }}>
                {clocked === "out" ? "Not active yet!" : clocked === "break" ? "On Break" : "On the Clock"}
              </p>
              <div className="h-[8px] w-[8px] rounded-full" style={{ background: stateColor }} />
            </div>
          </div>
          {clocked === "break" && (
            <div className="flex items-center justify-between py-[16px]" style={{ borderBottom: "1px solid #e0e1e9", background: "#fffbeb" }}>
              <p style={{ fontSize: 13, color: "#92400e", fontFamily: OS, ...OS_FVS }}>Break Duration</p>
              <p style={{ fontSize: 18, fontWeight: 700, color: "#d97706", fontFamily: OS, ...OS_FVS, letterSpacing: "-0.5px" }}>{fmt(breakElapsed)}</p>
            </div>
          )}
          <div className="flex items-center justify-between py-[16px]" style={{ borderBottom: "1px solid #e0e1e9" }}>
            <p style={{ fontSize: 13, color: "#6a6e79", fontFamily: OS, ...OS_FVS }}>Job</p>
            <p style={{ fontSize: 13, color: clocked === "out" ? "#cbced4" : "#252a2e", fontFamily: OS, ...OS_FVS, maxWidth: 200, textAlign: "right" }}>
              {clocked === "out" ? "No Job Selected" : job.split(" - ")[0]}
            </p>
          </div>
          <div className="flex items-center justify-between py-[16px]" style={{ borderBottom: "1px solid #e0e1e9" }}>
            <p style={{ fontSize: 13, color: "#6a6e79", fontFamily: OS, ...OS_FVS }}>Phase</p>
            <p style={{ fontSize: 13, color: clocked === "out" ? "#cbced4" : "#252a2e", fontFamily: OS, ...OS_FVS }}>
              {clocked === "out" ? "—" : phase.split(" - ")[0]}
            </p>
          </div>

          {/* Timeline */}
          {timeline.length > 0 && (
            <div className="mt-[24px]">
              <div className="flex items-center justify-between mb-[16px]">
                <p style={{ fontSize: 15, fontWeight: 700, color: "#252a2e", fontFamily: OS, ...OS_FVS }}>Earlier Today</p>
              </div>
              <div className="flex flex-col gap-[0px]">
                {timeline.map((e, i) => (
                  <div key={i} className="flex gap-[12px]">
                    <div className="flex flex-col items-center">
                      <div className="h-[10px] w-[10px] rounded-full shrink-0 mt-[4px]" style={{ background: e.color }} />
                      {i < timeline.length - 1 && <div className="w-[1px] flex-1 mt-[2px]" style={{ background: "#e0e1e9", minHeight: 28 }} />}
                    </div>
                    <div className="pb-[16px]">
                      <p style={{ fontSize: 12, color: "#6a6e79", fontFamily: OS, ...OS_FVS }}>{e.time}</p>
                      <p style={{ fontSize: 14, fontWeight: 700, color: "#252a2e", fontFamily: OS, ...OS_FVS }}>{e.label}</p>
                      <p style={{ fontSize: 12, color: "#6a6e79", fontFamily: OS, ...OS_FVS }}>{e.sub}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>


    </div>
  );
}

function ComplianceDashboard() {
  const [activeSection, setActiveSection] = useState<"about_to" | "late" | "premium" | "all">("all");
  const [alertedCrews, setAlertedCrews] = useState<Set<string>>(new Set());
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [alertedIds, setAlertedIds] = useState<Set<string>>(new Set());
  const [search, setSearch] = useState("");
  const [filterEmployee, setFilterEmployee] = useState("");
  const [filterCrew, setFilterCrew] = useState("");
  const [filterJob, setFilterJob] = useState("");
  const [filterCostCenter, setFilterCostCenter] = useState("");
  const [filterSupervisor, setFilterSupervisor] = useState("");

  const uniqueEmployees   = [...new Set(MOCK_EMPLOYEES.map(e => e.name))];
  const uniqueCrews       = [...new Set(MOCK_EMPLOYEES.map(e => e.crew))];
  const uniqueSupervisors = [...new Set(MOCK_EMPLOYEES.map(e => e.supervisor))];
  const uniqueJobs        = [...new Set(MOCK_EMPLOYEES.map(e => e.job))];
  const uniqueCostCenters = [...new Set(MOCK_EMPLOYEES.map(e => e.costCenter))];

  const aboutTo = MOCK_EMPLOYEES.filter(e => e.status === "about_to");
  const late    = MOCK_EMPLOYEES.filter(e => e.status === "late");
  const premium = MOCK_EMPLOYEES.filter(e => e.status === "premium");

  const hasFilter = search || filterEmployee || filterCrew || filterJob || filterCostCenter || filterSupervisor;

  const basePool =
    activeSection === "about_to" ? aboutTo :
    activeSection === "late"     ? late :
    activeSection === "premium"  ? premium :
    MOCK_EMPLOYEES;

  const displayed = basePool.filter(e => {
    if (search && !e.name.toLowerCase().includes(search.toLowerCase()) && !e.role.toLowerCase().includes(search.toLowerCase())) return false;
    if (filterEmployee   && e.name       !== filterEmployee)   return false;
    if (filterCrew       && e.crew       !== filterCrew)       return false;
    if (filterSupervisor && e.supervisor !== filterSupervisor) return false;
    if (filterJob        && e.job        !== filterJob)        return false;
    if (filterCostCenter && e.costCenter !== filterCostCenter) return false;
    return true;
  });

  const crewLateMap = CREWS.reduce<Record<string, number>>((acc, crew) => {
    acc[crew] = late.filter(e => e.crew === crew).length;
    return acc;
  }, {});

  const totalPenalty = premium.reduce((s, e) => s + (e.penaltyAmount ?? 0), 0);

  // Summary card styled like Traqspera quick-action cards
  const SECTION_TINT: Record<string, string> = {
    about_to: "#e8f2fa",
    late:     "#faeaea",
    premium:  "#fef3e2",
  };

  const SummaryCard = ({ label, count, sub, dotColor, section }: {
    label: string; count: number; sub: string; dotColor: string; section: "about_to" | "late" | "premium";
  }) => {
    const active = activeSection === section;
    return (
      <button onClick={() => setActiveSection(active ? "all" : section)}
        className="text-left transition-all w-full"
        style={{
          background: active ? SECTION_TINT[section] : "#ffffff",
          borderRadius: 8,
          boxShadow: active
            ? `0 0 0 2px ${dotColor}, 0px 1px 1px rgba(0,0,0,0.05)`
            : "0px 1px 1px rgba(0,0,0,0.05)",
          padding: 24,
          border: "none",
          cursor: "pointer",
        }}>
        <div className="flex items-center justify-between mb-[12px]">
          <p className="font-semibold text-[14px] leading-[20px]" style={{ color: "#6a6e79", fontFamily: OS, ...OS_FVS }}>{label}</p>

        </div>
        <h2 className="font-bold leading-[1]" style={{ color: dotColor, fontFamily: OS, ...OS_FVS, fontSize: 36, fontWeight: 700 }}>{count}</h2>
        <p className="mt-[6px] font-semibold text-[12px] leading-[16px]" style={{ color: "#6a6e79", fontFamily: OS, ...OS_FVS }}>{sub}</p>
      </button>
    );
  };

  return (
    <div className="min-h-screen p-[24px]" style={{ background: "#f1f1f6" }}>
      {/* Page header */}
      <div className="mb-[20px] flex items-center justify-between">
        <div>
          <p className="font-bold text-[18px] tracking-[0.027px] leading-[27px]" style={{ color: "#000000", fontFamily: OS, ...OS_FVS }}>
            Compliance Dashboard
          </p>
          <p className="font-semibold text-[12px] leading-[16px] mt-[4px]" style={{ color: "#6a6e79", fontFamily: OS, ...OS_FVS }}>
            Live break and meal period compliance — {new Date().toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric" })}
          </p>
        </div>
        <div className="flex items-center gap-[6px] px-[12px] py-[6px]"
          style={{ background: "#dcedf9", borderRadius: 8 }}>
          <div className="h-[8px] w-[8px] rounded-full animate-pulse" style={{ background: "#0063a3" }} />
          <p className="font-semibold text-[14px]" style={{ color: "#0063a3", fontFamily: OS, ...OS_FVS }}>Live — updates every 60s</p>
        </div>
      </div>

      {/* Summary cards — Quick Actions style */}
      <div className="mb-[6px]">
        <p className="font-semibold text-[18px] tracking-[0.027px] leading-[27px] mb-[12px]" style={{ color: "#000000", fontFamily: OS, ...OS_FVS }}>
          Exception Summary
        </p>
      </div>
      <div className="grid grid-cols-3 gap-[16px] mb-[24px]">
        <SummaryCard label="About to Take Break" count={aboutTo.length} sub="Break due within 30 minutes" dotColor="#0063a3" section="about_to" />
        <SummaryCard label="Late for Break" count={late.length} sub="Break window already passed" dotColor="#ab1f26" section="late" />
        <SummaryCard label="Meal Premiums Incurred" count={premium.length} sub={`$${totalPenalty.toFixed(2)} total accrued today`} dotColor="#d97706" section="premium" />
      </div>



      {/* Filter row — search + dropdowns */}
      <div className="mb-[16px] flex items-center gap-[8px]">
        <FilterInput placeholder="Search" value={search} onChange={setSearch} />
        <FilterInput placeholder="Employee" value={filterEmployee} onChange={setFilterEmployee} options={uniqueEmployees} />
        <FilterInput placeholder="Crew" value={filterCrew} onChange={setFilterCrew} options={uniqueCrews} />
        <FilterInput placeholder="Supervisor" value={filterSupervisor} onChange={setFilterSupervisor} options={uniqueSupervisors} />
        <FilterInput placeholder="Job" value={filterJob} onChange={setFilterJob} options={uniqueJobs} />
        <FilterInput placeholder="Cost Center" value={filterCostCenter} onChange={setFilterCostCenter} options={uniqueCostCenters} />
        <ModusWcButton
          color="primary"
          variant="filled"
          size="sm"
          disabled={selectedIds.size === 0}
          onButtonClick={() => {
            if (selectedIds.size === 0) return;
            setAlertedIds(prev => new Set([...prev, ...selectedIds]));
            setSelectedIds(new Set());
          }}
        >
          Send Alert{selectedIds.size > 0 ? ` (${selectedIds.size})` : ""}
        </ModusWcButton>
        {hasFilter && (
          <ModusWcButton
            color="primary"
            variant="borderless"
            size="sm"
            onButtonClick={() => { setSearch(""); setFilterEmployee(""); setFilterCrew(""); setFilterSupervisor(""); setFilterJob(""); setFilterCostCenter(""); }}
          >
            Clear ×
          </ModusWcButton>
        )}
      </div>

      {/* Main table — Traqspera table style */}
      <div style={{ background: "#ffffff", borderRadius: 8, boxShadow: "0px 1px 1px rgba(0,0,0,0.05)", overflow: "hidden" }}>
        {/* Toolbar */}
        <div className="flex items-center gap-[12px] px-[16px] py-[10px] border-b" style={{ borderColor: "#0d3560", background: "#252a2e", minHeight: 48 }}>
          {activeSection !== "all" && (
            <AlertBadge
              label={activeSection === "about_to" ? "About to Take Break" : activeSection === "late" ? "Late for Break" : "Meal Premiums Incurred"}
              color={activeSection === "about_to" ? "#7ec8f7" : activeSection === "late" ? "#f7a0a5" : "#fcd99a"}
            />
          )}
          <p className="font-semibold text-[12px]" style={{ color: "#b0b7c3", fontFamily: OS, ...OS_FVS }}>
            {displayed.length} employee{displayed.length !== 1 ? "s" : ""}
          </p>
          {selectedIds.size > 0 && (
            <>
              <span className="font-semibold text-[12px]" style={{ color: "#7ec8f7", fontFamily: OS, ...OS_FVS }}>
                {selectedIds.size} selected
              </span>
              <button
                onClick={() => setSelectedIds(new Set())}
                className="text-[13px] font-semibold"
                style={{ background: "transparent", border: "none", color: "#b0b7c3", cursor: "pointer", fontFamily: OS, ...OS_FVS }}>
                Deselect all
              </button>
            </>
          )}
        </div>
        <table className="w-full border-collapse">
          <thead>
            <tr style={{ background: "#e0e1e9", borderBottom: "2px solid #e0e1e9" }}>
              {/* Select-all checkbox */}
              <th className="px-[16px] py-[10px] w-[40px]" style={{ borderBottom: "2px solid #e0e1e9", background: "#e0e1e9" }}>
                <StyledCheckbox
                  checked={displayed.length > 0 && displayed.every(e => selectedIds.has(e.id))}
                  indeterminate={displayed.some(e => selectedIds.has(e.id)) && !displayed.every(e => selectedIds.has(e.id))}
                  onChange={() => {
                    const allSelected = displayed.every(e => selectedIds.has(e.id));
                    if (allSelected) {
                      setSelectedIds(prev => { const n = new Set(prev); displayed.forEach(e => n.delete(e.id)); return n; });
                    } else {
                      setSelectedIds(prev => new Set([...prev, ...displayed.map(e => e.id)]));
                    }
                  }} />
              </th>
              {["Employee", "Crew", "Supervisor", "Job", "Cost Center", "Shift Start", "Status", "Action"].map(h => (
                <th key={h} className="px-[16px] py-[10px] text-left"
                  style={{ borderBottom: "2px solid #e0e1e9", background: "#e0e1e9" }}>
                  <p className="font-semibold whitespace-nowrap" style={{ fontSize: 14, color: "#464b52", fontFamily: OS, ...OS_FVS }}>{h}</p>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {displayed.length === 0 ? (
              <tr>
                <td colSpan={9} className="px-[16px] py-[32px] text-center">
                  <p className="font-semibold text-[14px]" style={{ color: "#6a6e79", fontFamily: OS, ...OS_FVS }}>No exceptions to display.</p>
                </td>
              </tr>
            ) : (
              displayed.map((emp, i) => (
                <EmployeeRow key={emp.id} emp={emp} idx={i}
                  selected={selectedIds.has(emp.id)}
                  onToggle={() => setSelectedIds(prev => { const n = new Set(prev); n.has(emp.id) ? n.delete(emp.id) : n.add(emp.id); return n; })}
                  alerted={alertedIds.has(emp.id)}
                  onAlert={() => setAlertedIds(prev => new Set([...prev, emp.id]))} />
              ))
            )}
          </tbody>
        </table>
        <div className="flex items-center justify-between px-[16px] py-[10px]" style={{ borderTop: "1px solid #e0e1e9", background: "#ffffff" }}>
          <p className="font-semibold text-[12px]" style={{ color: "#6a6e79", fontFamily: OS, ...OS_FVS }}>
            Showing {displayed.length} of {MOCK_EMPLOYEES.length} employees
          </p>
          <p className="font-semibold text-[12px]" style={{ color: "#6a6e79", fontFamily: OS, ...OS_FVS }}>
            Last refreshed: {new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
          </p>
        </div>
      </div>
    </div>
  );
}

// ─── Top Bar ──────────────────────────────────────────────────────────────────
function TopBar({ onMenuClick }: { onMenuClick: () => void }) {
  return (
    <div className="fixed top-0 left-0 right-0 flex items-center bg-white border-b border-[#e0e1e9] px-[12px]"
      style={{ height: TOP_BAR_H, zIndex: 60 }}>
      {/* Left: hamburger + logo */}
      <button onClick={onMenuClick}
        className="flex h-[32px] w-[32px] shrink-0 items-center justify-center rounded-[4px] text-[#464b52] hover:text-[#252a2e] hover:bg-[#f1f1f6] transition-colors mr-[10px]">
        <AlignJustify size={16} />
      </button>
      <div className="flex items-center gap-[7px] mr-[16px]">
        <div className="flex h-[24px] w-[24px] shrink-0 items-center justify-center rounded-[4px] bg-[#0d3560]">
          <span className="text-[11px] font-black text-white font-['Open_Sans',sans-serif]">T</span>
        </div>
        <span className="text-[14px] font-bold text-[#0d3560] font-['Open_Sans',sans-serif] whitespace-nowrap">Traqspera</span>
      </div>
      {/* Center: tenant selector */}
      <button className="flex items-center gap-[6px] rounded-[4px] border border-[#e0e1e9] bg-[#f5f5f8] px-[10px] py-[5px] text-[12px] text-[#464b52] font-['Open_Sans',sans-serif] hover:bg-[#eaeaef] transition-colors">
        Enterprise
        <ChevronDown size={12} />
      </button>
      {/* Right: viewing + icons */}
      <div className="ml-auto flex items-center gap-[6px]">
        <button className="flex items-center gap-[6px] rounded-[4px] border border-[#e0e1e9] bg-[#f5f5f8] px-[10px] py-[5px] text-[12px] text-[#464b52] font-['Open_Sans',sans-serif] hover:bg-[#eaeaef] transition-colors">
          Viewing as Admin
          <ChevronDown size={12} />
        </button>
        <button className="flex h-[32px] w-[32px] items-center justify-center rounded-full text-[#6a6e79] hover:text-[#252a2e] hover:bg-[#f1f1f6] transition-colors">
          <Bell size={15} />
        </button>
        <button className="flex h-[32px] w-[32px] items-center justify-center rounded-full text-[#6a6e79] hover:text-[#252a2e] hover:bg-[#f1f1f6] transition-colors">
          <HelpCircle size={15} />
        </button>
        <div className="flex h-[30px] w-[30px] items-center justify-center rounded-full bg-[#252a2e] text-white text-[11px] font-bold font-['Open_Sans',sans-serif] cursor-pointer">
          JD
        </div>
      </div>
    </div>
  );
}

// ─── Nav Sidebar ──────────────────────────────────────────────────────────────
function NavSidebar({ activePage, onNavigate, collapsed, onToggleCollapse }: {
  activePage: NavPage;
  onNavigate: (p: NavPage) => void;
  collapsed: boolean;
  onToggleCollapse: () => void;
}) {
  const [expandedSections, setExpandedSections] = useState<Set<string>>(new Set(["time"]));

  const toggleSection = (key: string) =>
    setExpandedSections((prev) => { const n = new Set(prev); n.has(key) ? n.delete(key) : n.add(key); return n; });

  const isChildActive = (section: NavSection) =>
    section.children?.some((c) => c.key === activePage) ?? false;

  const navW = collapsed ? NAV_COLLAPSED_W : NAV_EXPANDED_W;

  return (
    <div className="fixed left-0 flex flex-col transition-all duration-200"
      style={{ width: navW, top: TOP_BAR_H, height: `calc(100vh - ${TOP_BAR_H}px)`, background: "#0d3560", zIndex: 40, overflow: "hidden" }}>

      {/* Nav items */}
      <div className="flex-1 overflow-y-auto py-[4px]" style={{ scrollbarWidth: "none" }}>
        {NAV_SECTIONS.map((section) => {
          const hasChildren = !!section.children?.length;
          const isOpen = expandedSections.has(section.key);
          const childActive = isChildActive(section);
          const settingsActive = section.key === "settings" && SETTINGS_PAGES.has(activePage);
          const directActive = !hasChildren && section.page === activePage;
          const rowActive = directActive || settingsActive || childActive;

          return (
            <div key={section.key}>
              <button
                title={collapsed ? section.label : undefined}
                onClick={() => {
                  if (collapsed) {
                    // expand nav first, then navigate
                    onToggleCollapse();
                    if (!hasChildren && section.page) onNavigate(section.page);
                  } else {
                    if (hasChildren) toggleSection(section.key);
                    else if (section.page) onNavigate(section.page);
                  }
                }}
                className="flex w-full items-center transition-colors"
                style={{
                  position: "relative",
                  height: 44,
                  paddingLeft: collapsed ? 0 : 14,
                  paddingRight: collapsed ? 0 : 14,
                  justifyContent: collapsed ? "center" : "flex-start",
                  gap: collapsed ? 0 : 10,
                  background: rowActive ? "rgba(255,255,255,0.10)" : "transparent",
                  borderLeft: rowActive ? "3px solid #f59e0b" : "3px solid transparent",
                }}>
                <span className="shrink-0" style={{ color: rowActive ? "#fff" : "rgba(255,255,255,0.72)" }}>
                  {section.icon}
                </span>
                {!collapsed && (
                  <>
                    <span className="flex-1 text-left text-[13px] font-semibold text-white font-['Open_Sans',sans-serif] whitespace-nowrap">
                      {section.label}
                    </span>
                    {hasChildren
                      ? <span style={{ color: "rgba(255,255,255,0.45)" }}>{isOpen ? <ChevronUp size={13} /> : <ChevronDown size={13} />}</span>
                      : <ChevronRight size={13} color="rgba(255,255,255,0.30)" />
                    }
                  </>
                )}
                {collapsed && (
                  <span style={{ position: "absolute", right: 3, color: "rgba(255,255,255,0.35)" }}>
                    <ChevronRight size={9} />
                  </span>
                )}
              </button>

              {/* Children — only show when expanded nav */}
              {!collapsed && hasChildren && isOpen && section.children && (
                <div style={{ background: "rgba(0,0,0,0.15)" }}>
                  {section.children.map((child) => {
                    const active = activePage === child.key;
                    return (
                      <button key={child.key} onClick={() => onNavigate(child.key)}
                        className="flex w-full items-center transition-colors"
                        style={{
                          height: 38, paddingLeft: 42, paddingRight: 14,
                          background: active ? "rgba(255,255,255,0.10)" : "transparent",
                          borderLeft: active ? "3px solid #4da6e8" : "3px solid transparent",
                        }}>
                        <span className="text-[12px] font-['Open_Sans',sans-serif]"
                          style={{ color: active ? "#fff" : "rgba(255,255,255,0.68)", fontWeight: active ? 600 : 400 }}>
                          {child.label}
                        </span>
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ─── Settings Sub-Nav ─────────────────────────────────────────────────────────
const SETTINGS_ITEMS: { key: NavPage; label: string; icon: ReactNode }[] = [
  { key: "s_settings",       label: "Settings",               icon: <Settings size={15} /> },
  { key: "s_permissions",    label: "Permissions",            icon: <Shield size={15} /> },
  { key: "s_time_off_setup", label: "Time Off Setup",         icon: <Clock size={15} /> },
  { key: "s_notifications",  label: "Notifications",          icon: <AlignJustify size={15} /> },
  { key: "s_tenant_images",  label: "Tenant Images",          icon: <FileText size={15} /> },
  { key: "s_hour_rules",     label: "Hour Rules",             icon: <Filter size={15} /> },
  { key: "s_rate_level",     label: "Rate Level",             icon: <BarChart2 size={15} /> },
  { key: "s_auto_job",       label: "Automatic Job Settings", icon: <Wrench size={15} /> },
];

function SettingsSubNav({ activePage, onNavigate, navW }: {
  activePage: NavPage; onNavigate: (p: NavPage) => void; navW: number;
}) {
  const [search, setSearch] = useState("");
  const filtered = SETTINGS_ITEMS.filter((i) =>
    i.label.toLowerCase().includes(search.toLowerCase())
  );
  return (
    <div className="fixed flex flex-col" style={{ left: navW, top: TOP_BAR_H, width: SETTINGS_NAV_W + 16, height: `calc(100vh - ${TOP_BAR_H}px)`, zIndex: 39, padding: "12px 8px", pointerEvents: "none" }}>
      <div className="flex flex-col bg-white rounded-[8px] shadow-[0_2px_12px_rgba(0,0,0,0.12)] border border-[#e0e1e9] h-full overflow-hidden" style={{ pointerEvents: "auto" }}>
        {/* Search */}
        <div className="px-[10px] py-[10px] border-b border-[#f0f0f4]">
          <div className="relative">
            <Search size={12} className="pointer-events-none absolute left-[8px] top-1/2 -translate-y-1/2 text-[#6a6e79]" />
            <input type="text" placeholder="Search" value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full rounded-[4px] border border-[#e0e1e9] bg-[#f5f5f8] pl-[24px] pr-[8px] py-[5px] text-[12px] font-['Open_Sans',sans-serif] text-[#252a2e] outline-none focus:border-[#006fb0]" />
          </div>
        </div>
        {/* Items */}
        <div className="flex-1 overflow-y-auto py-[4px]" style={{ scrollbarWidth: "none" }}>
          {filtered.map((item) => {
            const active = activePage === item.key;
            return (
              <button key={item.key} onClick={() => onNavigate(item.key)}
                className="flex w-full items-center gap-[10px] py-[9px] transition-colors text-left"
                style={{
                  paddingLeft: 14, paddingRight: 10,
                  background: active ? "#dcedf9" : "transparent",
                  borderLeft: active ? "3px solid #006fb0" : "3px solid transparent",
                }}>
                <span style={{ color: active ? "#006fb0" : "#6a6e79" }} className="shrink-0">{item.icon}</span>
                <span className="text-[12px] font-['Open_Sans',sans-serif]"
                  style={{ color: active ? "#006fb0" : "#464b52", fontWeight: active ? 600 : 400 }}>
                  {item.label}
                </span>
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}

// ─── Placeholder page ─────────────────────────────────────────────────────────
function PlaceholderPage({ title }: { title: string }) {
  return (
    <div className="flex items-center justify-center min-h-[400px]">
      <div className="text-center">
        <div className="mx-auto mb-[12px] flex h-[48px] w-[48px] items-center justify-center rounded-full bg-[#e0e1e9]">
          <FileText size={22} className="text-[#6a6e79]" />
        </div>
        <p className="text-[16px] font-bold font-['Open_Sans',sans-serif] text-[#252a2e]">{title}</p>
        <p className="mt-[4px] text-[12px] font-['Open_Sans',sans-serif] text-[#6a6e79]">This page is under construction.</p>
      </div>
    </div>
  );
}

// ─── Root ─────────────────────────────────────────────────────────────────────
export default function App() {
  const [activePage, setActivePage] = useState<NavPage>("s_hour_rules");
  const [navCollapsed, setNavCollapsed] = useState(true);
  const inSettings = SETTINGS_PAGES.has(activePage);
  const navW = navCollapsed ? NAV_COLLAPSED_W : NAV_EXPANDED_W;

  const contentLeft = navW + (inSettings ? SETTINGS_NAV_W + 16 : 0);

  return (
    <div className="min-h-screen bg-[#f1f1f6]">
      <Toaster position="top-right" richColors />
      <TopBar onMenuClick={() => setNavCollapsed((v) => !v)} />
      <NavSidebar
        activePage={activePage}
        onNavigate={setActivePage}
        collapsed={navCollapsed}
        onToggleCollapse={() => setNavCollapsed((v) => !v)}
      />
      {inSettings && <SettingsSubNav activePage={activePage} onNavigate={setActivePage} navW={navW} />}
      <div style={{ marginLeft: contentLeft, marginTop: TOP_BAR_H, minHeight: `calc(100vh - ${TOP_BAR_H}px)` }}>
        {/* Time */}
        {activePage === "timesheets"        && <PlaceholderPage title="Timesheets" />}
        {activePage === "clock_in"          && <ClockInOutPage />}
        {activePage === "timesheet_summary" && <PlaceholderPage title="Timesheet Summary" />}
        {activePage === "time_off"          && <PlaceholderPage title="Time Off" />}
        {activePage === "compliance_dashboard" && <ComplianceDashboard />}
        {/* Other */}
        {activePage === "employees"         && <PlaceholderPage title="Employees" />}
        {activePage === "jobs"              && <PlaceholderPage title="Jobs" />}
        {activePage === "expenses"          && <PlaceholderPage title="Expenses" />}
        {activePage === "reports"           && <PlaceholderPage title="Reports" />}
        {activePage === "equipment"         && <PlaceholderPage title="Equipment" />}
        {activePage === "documents"         && <PlaceholderPage title="Documents" />}
        {activePage === "global_admin"      && <PlaceholderPage title="Global Admin" />}
        {/* Settings sub-pages */}
        {activePage === "s_hour_rules"      && <JurisdictionSettings />}
        {activePage === "s_settings"        && <PlaceholderPage title="Settings" />}
        {activePage === "s_permissions"     && <PlaceholderPage title="Permissions" />}
        {activePage === "s_time_off_setup"  && <PlaceholderPage title="Time Off Setup" />}
        {activePage === "s_notifications"   && <PlaceholderPage title="Notifications" />}
        {activePage === "s_tenant_images"   && <PlaceholderPage title="Tenant Images" />}
        {activePage === "s_rate_level"      && <PlaceholderPage title="Rate Level" />}
        {activePage === "s_auto_job"        && <PlaceholderPage title="Automatic Job Settings" />}
      </div>
    </div>
  );
}
